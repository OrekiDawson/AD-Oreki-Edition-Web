import { readFileSync, appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  KODY_DAILY_LIMIT as DAILY_TRIGGER_LIMIT,
  KODY_WARNING_AT as DAILY_TRIGGER_WARNING,
  attachKodyQuota,
  releaseKodyQuota,
  reserveKodyQuota,
} from "../codex/audit-quota.mjs";

export const TRIGGER_AUTHOR = "OrekiDawson";
export const TRIGGER_BODY = "@kody start-review";
export const KODY_LOGIN = "kody-ai[bot]";
export const CHECK_NAME = "Kody trigger";
export const SHARED_QUOTA_REPOSITORIES = [
  "AD-Oreki-Edition-Android",
  "AD-Oreki-Edition-Web",
];
export { DAILY_TRIGGER_LIMIT, DAILY_TRIGGER_WARNING };

export function validatePullRequest(pr, repositoryFullName) {
  if (!pr) return { allowed: false, reason: "missing_pull_request" };
  if (pr.user?.login !== TRIGGER_AUTHOR) return { allowed: false, reason: "author_not_allowed" };
  if (pr.base?.ref !== "main") return { allowed: false, reason: "base_not_main" };
  if (pr.head?.repo?.full_name !== repositoryFullName) {
    return { allowed: false, reason: "fork_or_cross_repository" };
  }
  if (pr.state !== "open" || pr.merged_at != null) {
    return { allowed: false, reason: "pr_not_open" };
  }
  if (pr.draft === true) return { allowed: false, reason: "draft" };
  if (!pr.head?.sha) return { allowed: false, reason: "missing_head_sha" };
  return { allowed: true, reason: "eligible" };
}

export function validateTriggerIdentity(login) {
  return login === TRIGGER_AUTHOR
    ? { allowed: true, reason: "identity_verified" }
    : { allowed: false, reason: "pat_identity_mismatch" };
}

export function isExactTriggerComment(comment) {
  return comment?.user?.login === TRIGGER_AUTHOR &&
    typeof comment.body === "string" &&
    comment.body.trim() === TRIGGER_BODY;
}

export function triggerIdentity(repository, prNumber, headSha) {
  return `kody-trigger:${repository}#${prNumber}@${headSha}`;
}

export function findTriggerReservation(checkRuns, externalId) {
  return checkRuns.find(run =>
    run.external_id === externalId &&
    (run.status === "in_progress" ||
      (run.status === "completed" && ["success", "neutral"].includes(run.conclusion)))
  ) ?? null;
}

export function findKodyReviewForHead(reviews, comments, headSha) {
  const review = reviews.find(item =>
    item?.user?.login === KODY_LOGIN &&
    item.commit_id === headSha
  );
  if (review) return { kind: "review", url: review.html_url ?? "" };

  const comment = comments.find(item =>
    item?.user?.login === KODY_LOGIN &&
    typeof item.body === "string" &&
    item.body.includes(headSha)
  );
  return comment ? { kind: "comment", url: comment.html_url ?? "" } : null;
}

export function shanghaiDayStart(now) {
  const shanghai = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return new Date(Date.UTC(
    shanghai.getUTCFullYear(),
    shanghai.getUTCMonth(),
    shanghai.getUTCDate(),
  ) - 8 * 60 * 60 * 1000);
}

export function sameShanghaiQuotaDay(now, snapshotNow) {
  return shanghaiDayStart(now).getTime() === shanghaiDayStart(snapshotNow).getTime();
}

export function quotaPostWindowOpen(now, snapshotNow, marginMs = 15_000) {
  if (!sameShanghaiQuotaDay(now, snapshotNow)) return false;
  const dayEnd = shanghaiDayStart(now).getTime() + 24 * 60 * 60 * 1000;
  return dayEnd - now.getTime() > marginMs;
}

export function millisecondsUntilShanghaiMidnight(now) {
  const dayEnd = shanghaiDayStart(now).getTime() + 24 * 60 * 60 * 1000;
  return Math.max(0, dayEnd - now.getTime());
}

export function dailyCommentsPath(repository, since) {
  return `/repos/${repository}/issues/comments?since=${encodeURIComponent(since.toISOString())}&per_page=100`;
}

export function sharedDailyCommentsPaths(currentRepository, since) {
  const owner = String(currentRepository).split("/")[0];
  if (!owner) throw new Error("repository owner is missing");
  return SHARED_QUOTA_REPOSITORIES.map(name => {
    const repository = `${owner}/${name}`;
    return { repository, path: dailyCommentsPath(repository, since) };
  });
}

/**
 * 只统计 OrekiDawson 主动发送的精确 start-review 评论。
 *
 * GitHub issue comment ID 是原始指令的可追溯唯一标识；同一 ID 在 API 重试或
 * 两个输入集合中重复出现时只计一次。回复、讨论、Bot 消息和旧 Oreki Audit
 * 摘要因正文不等于精确指令，不会被计入。
 */
export function sharedTriggerQuotaEvidence(commentGroups, since) {
  const startMs = since.getTime();
  const endMs = startMs + 24 * 60 * 60 * 1000;
  const unique = new Map();
  for (const group of commentGroups) {
    const repository = String(group?.repository ?? "");
    if (!repository) throw new Error("quota comment repository is missing");
    for (const comment of group.comments ?? []) {
      if (!isExactTriggerComment(comment)) continue;
      const createdAt = Date.parse(comment.created_at);
      if (!Number.isFinite(createdAt) || createdAt < startMs || createdAt >= endMs) {
        continue;
      }
      const commentId = comment.id == null ? "" : String(comment.id).trim();
      if (!commentId) {
        throw new Error("start-review command lacks a traceable comment id");
      }
      const key = `${repository}#${commentId}`;
      if (unique.has(key)) continue;
      const pullMatch = String(comment.html_url ?? "").match(/\/pull\/(\d+)(?:[\/#?]|$)/);
      unique.set(key, {
        repository,
        pr: pullMatch ? Number(pullMatch[1]) : null,
        commentId,
        url: comment.html_url ?? "",
        createdAt: new Date(createdAt).toISOString(),
      });
    }
  }
  return [...unique.values()].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt));
}

export function countSharedTriggersSince(commentGroups, since) {
  return sharedTriggerQuotaEvidence(commentGroups, since).length;
}

export function assertPaginationComplete(hasNextPage, pagesRead, maxPages) {
  if (hasNextPage && pagesRead >= maxPages) {
    throw new Error("GitHub API pagination exceeded; refusing an incomplete budget or dedupe view");
  }
}

export function budgetDecision(sharedTriggerCount, dailyLimit = DAILY_TRIGGER_LIMIT) {
  if (!Number.isInteger(sharedTriggerCount) || sharedTriggerCount < 0) {
    throw new Error("shared trigger count must be a non-negative integer");
  }
  if (!Number.isInteger(dailyLimit) || dailyLimit < 1) {
    throw new Error("daily trigger limit must be a positive integer");
  }
  if (sharedTriggerCount >= dailyLimit) {
    return {
      allowed: false,
      warning: true,
      remaining: 0,
      reason: "daily_trigger_cap_reached",
    };
  }
  const warning = sharedTriggerCount >= DAILY_TRIGGER_WARNING;
  return {
    allowed: true,
    warning,
    remaining: dailyLimit - sharedTriggerCount,
    reason: warning ? "daily_warning_reached" : "budget_available",
  };
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is missing`);
  return value;
}

function writeOutput(key, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  appendFileSync(outputPath, `${key}=${String(value).replaceAll("\n", " ")}\n`);
}

function writeSummary({
  status,
  reason,
  pr,
  headSha,
  commentUrl,
  quotaCounts,
}) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  const lines = [
    "## Kody 审查触发",
    "",
    `- 状态：\`${status}\``,
    `- 原因：\`${reason}\``,
  ];
  if (pr) lines.push(`- PR：${process.env.GITHUB_REPOSITORY}#${pr.number}`);
  if (headSha) lines.push(`- Head SHA：\`${headSha}\``);
  if (quotaCounts) {
    lines.push(`- 全局已用：${quotaCounts.used}/${DAILY_TRIGGER_LIMIT}`);
    lines.push(`- 全局剩余：${quotaCounts.remaining}`);
    for (const name of SHARED_QUOTA_REPOSITORIES) {
      const repository = `${String(process.env.GITHUB_REPOSITORY).split("/")[0]}/${name}`;
      lines.push(`- ${name} 实际用量：${quotaCounts.byRepository[repository] ?? 0}`);
    }
  }
  if (quotaCounts?.warning) {
    lines.push(`- 配额预警：已达到 ${DAILY_TRIGGER_WARNING} 次，新增请求仍可在 100 次前执行。`);
  }
  if (commentUrl) lines.push(`- 触发评论：${commentUrl}`);
  lines.push("- Kody 审查结果：未验证；发送触发命令不等于审查完成。");
  appendFileSync(summaryPath, `${lines.join("\n")}\n`);
}

function finishSkip(reason, pr = null, headSha = "", quotaCounts = null) {
  const safeReason = String(reason).replaceAll(/[^a-zA-Z0-9_-]/g, "_");
  writeOutput("kody_review_state", "skipped");
  writeOutput("skip_reason", safeReason);
  writeSummary({
    status: "skipped",
    reason: safeReason,
    pr,
    headSha,
    quotaCounts,
  });
  console.log(`Kody trigger skipped: ${safeReason}`);
}

async function releaseReservation(token, identity, now) {
  try {
    return await releaseKodyQuota(token, identity, { now });
  } catch (error) {
    console.error(`Kody quota release failed; reservation remains consumed: ${error.message}`);
    return null;
  }
}

async function releaseReservationOrThrow(token, identity, now) {
  let released = await releaseReservation(token, identity, now);
  if (released?.ok === false && released.reason === "reservation-not-found") {
    console.log("Kody quota reservation not found; treating release as idempotent");
    return released;
  }
  if (released?.ok !== true) {
    // PATCH 可能已落地但响应丢失；重读同一 identity 再释放一次可识别该情况。
    released = await releaseReservation(token, identity, now);
  }
  if (released?.ok === false && released.reason === "reservation-not-found") {
    console.log("Kody quota reservation released before retry");
    return released;
  }
  if (released?.ok !== true) {
    throw new Error(
      `failed to release Kody quota reservation for ${identity}: ` +
        `${released?.reason ?? "transport-or-service-error"}`,
    );
  }
  return released;
}

function emitQuotaEvidence(evidence) {
  for (const item of evidence) {
    console.log(
      `OREKI_KODY_QUOTA_COMMAND repo=${item.repository} id=${item.commentId} ` +
        `created_at=${item.createdAt} url=${item.url}`,
    );
  }
}

function writeQuotaOutputs(quotaCounts) {
  writeOutput("quota_warning", quotaCounts.warning);
  writeOutput("shared_trigger_used", quotaCounts.used);
  writeOutput("shared_trigger_remaining", quotaCounts.remaining);
  writeOutput("shared_trigger_by_repo", JSON.stringify(quotaCounts.byRepository));
}

async function requestJson(path, { method = "GET", token, body } = {}) {
  if (!token) throw new Error("GH_TOKEN is missing");
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "oreki-kody-trigger",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const message = (await response.text()).slice(0, 500);
    const error = new Error(`GitHub API ${method} ${path} failed: ${response.status} ${message}`);
    error.status = response.status;
    throw error;
  }
  return response;
}

async function listAllPages(path, token, maxPages = 10) {
  const items = [];
  let next = path;
  for (let page = 0; next && page < maxPages; page += 1) {
    const response = await requestJson(next, { token });
    items.push(...await response.json());
    const link = response.headers.get("link") ?? "";
    const match = link.match(/<([^>]+)>;\s*rel="next"/);
    assertPaginationComplete(Boolean(match), page + 1, maxPages);
    next = match ? match[1].replace("https://api.github.com", "") : "";
  }
  return items;
}

async function getPullRequest(repository, number, token) {
  const response = await requestJson(`/repos/${repository}/pulls/${number}`, { token });
  return response.json();
}

async function loadStableSharedQuota(repository, token) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const startedAt = new Date();
    const since = shanghaiDayStart(startedAt);
    const commentGroups = [];
    for (const source of sharedDailyCommentsPaths(repository, since)) {
      commentGroups.push({
        repository: source.repository,
        comments: await listAllPages(source.path, token),
      });
    }
    const finishedAt = new Date();
    if (shanghaiDayStart(finishedAt).getTime() === since.getTime()) {
      return {
        evidence: sharedTriggerQuotaEvidence(commentGroups, since),
        now: finishedAt,
      };
    }
  }
  throw new Error("UTC+8 quota day changed repeatedly while loading comments; retry later");
}

async function findTriggerCheck(repository, headSha, externalId, token) {
  const response = await requestJson(
    `/repos/${repository}/commits/${headSha}/check-runs?check_name=${encodeURIComponent(CHECK_NAME)}&filter=all&per_page=100`,
    { token },
  );
  const payload = await response.json();
  return findTriggerReservation(payload.check_runs ?? [], externalId);
}

async function createCompletedTriggerCheck(
  repository,
  prNumber,
  headSha,
  externalId,
  commentUrl,
  token,
  {
    conclusion = "success",
    title = "Kody 审查触发已发送",
    summary = `已以 OrekiDawson 身份发送触发评论。PR #${prNumber}，Head \`${headSha}\`，评论 ${commentUrl}。Kody 审查结果仍需独立核验。`,
  } = {},
) {
  await requestJson(`/repos/${repository}/check-runs`, {
    method: "POST",
    token,
    body: {
      name: CHECK_NAME,
      head_sha: headSha,
      external_id: externalId,
      status: "completed",
      conclusion,
      output: {
        title,
        summary,
      },
    },
  });
}

async function sleep(seconds) {
  if (seconds > 0) await new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

export async function main() {
  const token = requiredEnv("GH_TOKEN");
  const checkToken = requiredEnv("CHECK_TOKEN");
  const repository = requiredEnv("GITHUB_REPOSITORY");
  const eventName = requiredEnv("EVENT_NAME");
  const event = JSON.parse(readFileSync(requiredEnv("GITHUB_EVENT_PATH"), "utf8"));

  const identity = await (await requestJson("/user", { token })).json();
  const identityDecision = validateTriggerIdentity(identity.login);
  if (!identityDecision.allowed) throw new Error(identityDecision.reason);

  let pr = event.pull_request ?? null;
  if (eventName === "workflow_dispatch") {
    const input = requiredEnv("INPUT_PR_NUMBER");
    if (!/^[1-9]\d*$/.test(input)) throw new Error("invalid PR number input");
    pr = await getPullRequest(repository, Number(input), token);
  }

  const eligibility = validatePullRequest(pr, repository);
  if (!eligibility.allowed) {
    finishSkip(eligibility.reason, pr, pr?.head?.sha ?? "");
    return;
  }

  const prNumber = pr.number;
  const headSha = pr.head.sha;
  const externalId = triggerIdentity(repository, prNumber, headSha);
  if (event.action === "synchronize") {
    const seconds = Number.parseInt(process.env.STABILIZATION_SECONDS ?? "300", 10);
    await sleep(Number.isFinite(seconds) && seconds >= 0 ? seconds : 300);
    const current = await getPullRequest(repository, prNumber, token);
    const currentEligibility = validatePullRequest(current, repository);
    if (!currentEligibility.allowed || current.head.sha !== headSha) {
      finishSkip("head_changed_or_pr_became_ineligible", current, current.head?.sha ?? "");
      return;
    }
    pr = current;
  }

  const comments = await listAllPages(
    `/repos/${repository}/issues/${prNumber}/comments?per_page=100`,
    token,
  );
  if (await findTriggerCheck(repository, headSha, externalId, checkToken)) {
    finishSkip("trigger_exists_for_head", pr, headSha);
    return;
  }

  const reviews = await listAllPages(
    `/repos/${repository}/pulls/${prNumber}/reviews?per_page=100`,
    token,
  );
  if (findKodyReviewForHead(reviews, comments, headSha)) {
    finishSkip("kody_already_processed_head", pr, headSha);
    return;
  }

  let quotaSnapshot = await loadStableSharedQuota(repository, token);
  emitQuotaEvidence(quotaSnapshot.evidence);
  writeOutput("quota_evidence", JSON.stringify(quotaSnapshot.evidence));
  let reservation = await reserveKodyQuota(
    token,
    {
      identity: externalId,
      repository,
      pr: prNumber,
      headSha,
    },
    quotaSnapshot.evidence,
    { now: quotaSnapshot.now },
  );
  let quotaCounts = reservation.counts;
  writeQuotaOutputs(quotaCounts);
  if (!reservation.allowed) {
    finishSkip(reservation.reason, pr, headSha, quotaCounts);
    return;
  }

  let latest = null;
  for (let dayAttempt = 0; dayAttempt < 3; dayAttempt += 1) {
    try {
      latest = await getPullRequest(repository, prNumber, token);
    } catch (error) {
      await releaseReservation(token, externalId, quotaSnapshot.now);
      throw error;
    }
    if (latest.state !== "open" || latest.merged_at != null) {
      await releaseReservationOrThrow(token, externalId, quotaSnapshot.now);
      finishSkip("pr_not_open", latest, latest.head?.sha ?? "", quotaCounts);
      return;
    }
    if (latest.head?.sha !== headSha || latest.draft === true) {
      await releaseReservationOrThrow(token, externalId, quotaSnapshot.now);
      finishSkip("head_changed_before_comment", latest, latest.head?.sha ?? "", quotaCounts);
      return;
    }
    if (quotaPostWindowOpen(new Date(), quotaSnapshot.now)) {
      break;
    }
    const untilMidnight = millisecondsUntilShanghaiMidnight(new Date());
    if (untilMidnight > 0) {
      await sleep(Math.ceil(untilMidnight / 1000) + 1);
    }
    await releaseReservationOrThrow(token, externalId, quotaSnapshot.now);
    if (dayAttempt === 2) {
      throw new Error("UTC+8 quota day changed repeatedly before trigger POST");
    }
    quotaSnapshot = await loadStableSharedQuota(repository, token);
    emitQuotaEvidence(quotaSnapshot.evidence);
    writeOutput("quota_evidence", JSON.stringify(quotaSnapshot.evidence));
    reservation = await reserveKodyQuota(
      token,
      {
        identity: externalId,
        repository,
        pr: prNumber,
        headSha,
      },
      quotaSnapshot.evidence,
      { now: quotaSnapshot.now },
    );
    quotaCounts = reservation.counts;
    writeQuotaOutputs(quotaCounts);
    if (!reservation.allowed) {
      finishSkip(reservation.reason, pr, headSha, quotaCounts);
      return;
    }
  }
  if (!latest) throw new Error("PR state unavailable before trigger POST");

  let created;
  try {
    created = await (await requestJson(
      `/repos/${repository}/issues/${prNumber}/comments`,
      {
        method: "POST",
        token,
        body: { body: TRIGGER_BODY },
      },
    )).json();
  } catch (error) {
    // 4xx 明确表示请求被拒；5xx/网络断开的结果不确定，保守保留预占并等待人工核对。
    if (Number(error.status) >= 400 && Number(error.status) < 500) {
      await releaseReservation(token, externalId, quotaSnapshot.now);
    }
    throw error;
  }

  writeOutput("kody_review_state", "trigger_posted");
  writeOutput("head_sha", headSha);
  writeOutput("comment_id", created.id);
  writeOutput("comment_url", created.html_url);
  let attached = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      attached = await attachKodyQuota(token, externalId, {
        commentId: created.id,
        commentUrl: created.html_url,
        createdAt: created.created_at,
        now: quotaSnapshot.now,
      });
      break;
    } catch (error) {
      if (attempt === 3) {
        console.error(
          `OREKI_KODY_QUOTA_ATTACH_FAILED comment=${created.id} ` +
            `identity=${externalId}: ${error.message}`,
        );
        writeOutput("quota_attach_state", "failed_after_comment");
        await createCompletedTriggerCheck(
          repository,
          prNumber,
          headSha,
          externalId,
          created.html_url,
          checkToken,
          {
            conclusion: "neutral",
            title: "Kody 触发已发送，但配额回填失败",
            summary: `评论 ${created.html_url} 已发送，但配额回填三次失败。` +
              `Check Run 使用 neutral 阻止重复评论；请人工核对 ${externalId}。`,
          },
        );
        throw new Error(
          `trigger comment posted but quota attach failed for ${externalId}; ` +
            `comment ${created.id}`,
        );
      }
      await sleep(attempt);
    }
  }
  if (attached) quotaCounts = attached.counts;
  writeSummary({
    status: "trigger_posted",
    reason: "comment_created",
    pr,
    headSha,
    commentUrl: created.html_url,
    quotaCounts,
  });

  let checkError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await createCompletedTriggerCheck(
        repository,
        prNumber,
        headSha,
        externalId,
        created.html_url,
        checkToken,
      );
      checkError = null;
      break;
    } catch (error) {
      checkError = error;
      if (attempt < 3) await sleep(attempt * 2);
    }
  }
  if (checkError) {
    writeOutput("check_record_state", "failed_after_comment");
    throw new Error(`trigger comment posted but Check Run creation failed: ${checkError.message}`);
  }
  writeOutput("check_record_state", "success");
  console.log(`Kody trigger posted for ${repository}#${prNumber} at ${headSha}`);
}

const isDirectRun = process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch(error => {
    console.error(`Kody trigger failed: ${error.message}`);
    process.exitCode = 1;
  });
}
