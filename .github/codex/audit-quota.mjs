#!/usr/bin/env node
/**
 * Android/Web 共享 AI 审查配额。
 *
 * Web 仓库的 oreki-audit-quota 分支是持久化权威记录；每次更新都基于读取到的
 * ref SHA 创建新 commit，并以 force=false 更新 ref。并发请求持有同一 parent 时，
 * 只有一个 ref 更新能成功，其他请求必须重读后重新判断，从而提供跨仓 CAS。
 */

import crypto from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

export const LIMIT = 100;
export const KODY_KIND = "kody_start_review";
export const KODY_DAILY_LIMIT = 100;
export const KODY_WARNING_AT = 80;
export const COORDINATOR_REPO = "AD-Oreki-Edition-Web";
export const QUOTA_BRANCH = "oreki-audit-quota";
const OWNER = "OrekiDawson";
const API = "https://api.github.com";
const RETAIN_DAYS = 8;
const STATE_PATH = "quota/state.json";

export function shanghaiDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function isModelReviewRecord(record) {
  return record?.kind == null || record.kind === "model_review";
}

export function consumedCount(records) {
  return records.filter(record =>
    isModelReviewRecord(record) && record.status !== "released").length;
}

export function reservePure(records, candidate, {
  date = shanghaiDate(),
  limit = LIMIT,
  now = new Date().toISOString(),
} = {}) {
  const sameIdentity = records.filter(record =>
    isModelReviewRecord(record) && record.identity === candidate.identity);
  const completed = sameIdentity.find(record => record.status === "model_succeeded");
  if (completed) {
    return { allowed: false, reused: true, reason: "identity-complete", record: completed, records };
  }
  const active = sameIdentity.find(record =>
    record.status === "reserved" || record.status === "model_started");
  if (active) {
    return { allowed: false, reused: false, reason: "identity-in-progress", record: active, records };
  }
  if (consumedCount(records.filter(record => record.date === date)) >= limit) {
    return { allowed: false, reused: false, reason: "daily-quota-exhausted", record: null, records };
  }
  const attempt = sameIdentity.length + 1;
  const requestId = crypto.createHash("sha256")
    .update(`${candidate.identity}:${date}:${attempt}`).digest("hex");
  const record = {
    ...candidate,
    kind: "model_review",
    requestId,
    date,
    attempt,
    status: "reserved",
    modelCalls: 0,
    reservedAt: now,
    updatedAt: now,
    report: "",
  };
  return {
    allowed: true,
    reused: false,
    reason: "reserved",
    record,
    records: [...records, record],
  };
}

export function transitionPure(records, { identity, status, report = "", now = new Date().toISOString() }) {
  const index = records.findLastIndex(record => record.identity === identity &&
    !["released", "model_succeeded", "model_failed"].includes(record.status));
  if (index < 0) throw new Error(`active quota record not found: ${identity}`);
  const current = records[index];
  if (status === "released" && current.status !== "reserved") {
    return { ok: false, reason: "model-already-started", record: current, records };
  }
  const next = {
    ...current,
    status,
    updatedAt: now,
    modelCalls: status === "model_started" || status === "model_succeeded" ||
      status === "model_failed" ? Math.max(1, current.modelCalls) : current.modelCalls,
    report: status === "model_succeeded" ? report : current.report,
  };
  const output = [...records];
  output[index] = next;
  return { ok: true, reason: status, record: next, records: output };
}

function isKodyRecord(record) {
  return record?.kind === KODY_KIND;
}

function isActiveKodyRecord(record, date) {
  return isKodyRecord(record) &&
    record.date === date &&
    record.status !== "released";
}

export function kodyQuotaCounts(records, date) {
  const active = records.filter(record => isActiveKodyRecord(record, date));
  const byRepository = {};
  for (const record of active) {
    const repository = String(record.repository ?? "");
    byRepository[repository] = (byRepository[repository] ?? 0) + 1;
  }
  const used = active.length;
  return {
    used,
    remaining: Math.max(0, KODY_DAILY_LIMIT - used),
    warning: used >= KODY_WARNING_AT,
    byRepository,
  };
}

function importKodyEvidence(records, evidence, date, now) {
  const output = [...records];
  const seen = new Set(
    output
      .filter(record => isKodyRecord(record) && record.date === date)
      .map(record => String(record.commentId ?? ""))
      .filter(Boolean),
  );
  for (const item of evidence) {
    const repository = String(item?.repository ?? "");
    const commentId = String(item?.commentId ?? "").trim();
    if (!repository || !commentId) {
      throw new Error("Kody quota evidence requires repository and unique comment id");
    }
    if (seen.has(commentId)) continue;
    seen.add(commentId);
    output.push({
      kind: KODY_KIND,
      identity: `kody-comment:${repository}#${commentId}`,
      repository,
      commentId,
      commentUrl: String(item?.url ?? ""),
      source: "observed_comment",
      date,
      status: "posted",
      createdAt: String(item?.createdAt ?? now),
      updatedAt: now,
    });
  }
  return output;
}

/**
 * 原子预占 Kody 全局共享额度。
 *
 * 两个仓库共用同一份记录，不设置仓库保留额度或单仓上限。调用前读到的
 * GitHub 原始评论先按 commentId 合并进状态，再判断当前自然日总用量；
 * 同一 identity 的并发请求只允许一个 active 记录。
 */
export function reserveKodyPure(records, candidate, {
  date = shanghaiDate(),
  now = new Date().toISOString(),
  evidence = [],
} = {}) {
  const output = importKodyEvidence(records, evidence, date, now);
  const identity = String(candidate?.identity ?? "");
  if (!identity) throw new Error("Kody quota identity is required");
  const prior = output.find(record =>
    isActiveKodyRecord(record, date) && record.identity === identity);
  if (prior) {
    return {
      allowed: false,
      reused: true,
      reason: prior.status === "posted" ? "identity-complete" : "identity-in-progress",
      record: prior,
      records: output,
      counts: kodyQuotaCounts(output, date),
    };
  }
  const counts = kodyQuotaCounts(output, date);
  if (counts.used >= KODY_DAILY_LIMIT) {
    return {
      allowed: false,
      reused: false,
      reason: "daily-quota-exhausted",
      record: null,
      records: output,
      counts,
    };
  }
  const record = {
    kind: KODY_KIND,
    identity,
    repository: String(candidate.repository ?? ""),
    pr: Number(candidate.pr),
    headSha: String(candidate.headSha ?? ""),
    source: "automated_trigger",
    date,
    status: "reserved",
    commentId: "",
    commentUrl: "",
    reservedAt: now,
    updatedAt: now,
  };
  const reserved = [...output, record];
  return {
    allowed: true,
    reused: false,
    reason: "reserved",
    record,
    records: reserved,
    counts: kodyQuotaCounts(reserved, date),
  };
}

export function attachKodyCommand(records, {
  identity,
  commentId,
  commentUrl = "",
  now = new Date().toISOString(),
}) {
  const index = records.findLastIndex(record =>
    isKodyRecord(record) &&
    record.identity === identity &&
    record.status === "reserved");
  if (index < 0) throw new Error(`active Kody quota reservation not found: ${identity}`);
  if (commentId == null || !String(commentId).trim()) {
    throw new Error("Kody trigger comment id is missing");
  }
  const output = [...records];
  output[index] = {
    ...output[index],
    status: "posted",
    commentId: String(commentId),
    commentUrl: String(commentUrl),
    updatedAt: now,
  };
  return {
    ok: true,
    record: output[index],
    records: output,
    counts: kodyQuotaCounts(output, output[index].date),
  };
}

export function releaseKodyCommand(records, {
  identity,
  now = new Date().toISOString(),
}) {
  const index = records.findLastIndex(record =>
    isKodyRecord(record) &&
    record.identity === identity &&
    record.status === "reserved");
  if (index < 0) return { ok: false, reason: "reservation-not-found", records };
  const output = [...records];
  output[index] = {
    ...output[index],
    status: "released",
    updatedAt: now,
  };
  return {
    ok: true,
    reason: "released",
    record: output[index],
    records: output,
    counts: kodyQuotaCounts(output, output[index].date),
  };
}

export function applyCas(records, expectedVersion, currentVersion, transform) {
  if (expectedVersion !== currentVersion) throw new Error("quota conflict");
  return transform(records);
}

async function api(path, token, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "oreki-audit-quota",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`GitHub API ${response.status}: ${body.slice(0, 500)}`);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

async function getRef(token) {
  try {
    return await api(
      `/repos/${OWNER}/${COORDINATOR_REPO}/git/ref/heads/${QUOTA_BRANCH}`,
      token,
    );
  } catch (error) {
    if (error.status !== 404) throw error;
    return null;
  }
}

async function ensureBranch(token) {
  let ref = await getRef(token);
  if (ref) return ref;
  const main = await api(`/repos/${OWNER}/${COORDINATOR_REPO}/git/ref/heads/main`, token);
  try {
    await api(`/repos/${OWNER}/${COORDINATOR_REPO}/git/refs`, token, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${QUOTA_BRANCH}`, sha: main.object.sha }),
    });
  } catch (error) {
    if (error.status !== 422) throw error;
  }
  ref = await getRef(token);
  if (!ref) throw new Error("quota branch unavailable");
  return ref;
}

async function readState(token, ref, date) {
  const tree = await api(
    `/repos/${OWNER}/${COORDINATOR_REPO}/git/trees/${ref.object.sha}?recursive=1`,
    token,
  );
  const filePath = STATE_PATH;
  const entry = tree.tree.find(item => item.path === filePath && item.type === "blob");
  const state = { version: ref.object.sha, treeSha: tree.sha, path: filePath, records: [] };
  if (!entry) return state;
  const blob = await api(
    `/repos/${OWNER}/${COORDINATOR_REPO}/git/blobs/${entry.sha}`,
    token,
  );
  const decoded = JSON.parse(Buffer.from(blob.content, blob.encoding).toString("utf8"));
  state.records = Array.isArray(decoded.records) ? decoded.records : [];
  return state;
}

async function updateState(token, state, transform, date) {
  const result = applyCas(state.records, state.version, state.version, records => transform(records));
  const output = result.records || result;
  const dates = [...new Set(output.map(record => record.date))].sort();
  const retain = new Set(dates.slice(-RETAIN_DAYS));
  const pruned = output.filter(record => retain.has(record.date) || record.date === date);
  const blob = await api(`/repos/${OWNER}/${COORDINATOR_REPO}/git/blobs`, token, {
    method: "POST",
    body: JSON.stringify({
      content: Buffer.from(`${JSON.stringify({ schema: 1, date, records: pruned }, null, 2)}\n`)
        .toString("base64"),
      encoding: "base64",
    }),
  });
  const tree = await api(`/repos/${OWNER}/${COORDINATOR_REPO}/git/trees`, token, {
    method: "POST",
    body: JSON.stringify({
      base_tree: state.treeSha,
      tree: [{ path: state.path, mode: "100644", type: "blob", sha: blob.sha }],
    }),
  });
  const commit = await api(`/repos/${OWNER}/${COORDINATOR_REPO}/git/commits`, token, {
    method: "POST",
    body: JSON.stringify({
      message: `audit quota ${date}: ${result.reason || "update"}`,
      tree: tree.sha,
      parents: [state.version],
    }),
  });
  await api(`/repos/${OWNER}/${COORDINATOR_REPO}/git/refs/heads/${QUOTA_BRANCH}`, token, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });
  return result;
}

async function mutate(token, date, transform) {
  let lastError;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const ref = await ensureBranch(token);
      const state = await readState(token, ref, date);
      return await updateState(token, state, transform, date);
    } catch (error) {
      lastError = error;
      if (![409, 422].includes(error.status)) throw error;
      await new Promise(resolve => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }
  throw lastError;
}

export async function reserveKodyQuota(token, candidate, evidence = [], {
  now = new Date(),
} = {}) {
  const date = shanghaiDate(now);
  return mutate(token, date, records => reserveKodyPure(records, candidate, {
    date,
    now: now.toISOString(),
    evidence,
  }));
}

export async function attachKodyQuota(token, identity, {
  commentId,
  commentUrl = "",
  now = new Date(),
} = {}) {
  const date = shanghaiDate(now);
  return mutate(token, date, records => attachKodyCommand(records, {
    identity,
    commentId,
    commentUrl,
    now: now.toISOString(),
  }));
}

export async function releaseKodyQuota(token, identity, {
  now = new Date(),
} = {}) {
  const date = shanghaiDate(now);
  return mutate(token, date, records => releaseKodyCommand(records, {
    identity,
    now: now.toISOString(),
  }));
}

function argument(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

async function main() {
  const mode = argument("mode");
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is required");
  const now = argument("now") ? new Date(argument("now")) : new Date();
  const date = shanghaiDate(now);
  const identity = argument("identity");
  const candidate = {
    identity,
    repository: argument("repository"),
    pr: Number(argument("pr")),
    headSha: argument("head-sha"),
    configVersion: argument("config-version"),
    crossRepo: argument("cross-repo") === "true",
    peerRepo: argument("peer-repo"),
    peerSha: argument("peer-sha"),
  };
  let result;
  if (mode === "reserve") {
    result = await mutate(token, date, records => reservePure(records, candidate, {
      date,
      limit: LIMIT,
      now: now.toISOString(),
    }));
  } else if (mode === "transition") {
    const reportPath = argument("report");
    const report = reportPath ? fs.readFileSync(reportPath, "utf8") : "";
    result = await mutate(token, date, records => transitionPure(records, {
      identity,
      status: argument("status"),
      report,
      now: now.toISOString(),
    }));
  } else {
    throw new Error(`unknown quota mode: ${mode}`);
  }
  const output = {
    date,
    limit: LIMIT,
    used: consumedCount(result.records.filter(record => record.date === date)),
    ...result,
  };
  delete output.records;
  fs.writeFileSync(argument("out"), `${JSON.stringify(output, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
