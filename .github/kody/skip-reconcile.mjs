#!/usr/bin/env node
/**
 * Kody GitHub App 明确返回 skipped 时退还共享 Kody 配额。
 * 只处理 GitHub 的受信任 check_run 完成事件，不读取或执行 PR 代码。
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  SHARED_QUOTA_REPOSITORIES,
  markKodySkippedQuota,
} from "../codex/audit-quota.mjs";

export function confirmedKodySkip(event) {
  const check = event?.check_run;
  return event?.action === "completed" &&
    check?.status === "completed" &&
    check?.conclusion === "skipped" &&
    check?.name === "Kody Code Review" &&
    check?.app?.slug === "kody-ai" &&
    SHARED_QUOTA_REPOSITORIES.includes(String(event?.repository?.full_name ?? "")) &&
    /^[a-f0-9]{40}$/iu.test(String(check?.head_sha ?? "")) &&
    Number.isSafeInteger(Number(check?.id)) && Number(check?.id) > 0;
}

export function kodySkipPullRequests(event) {
  if (!confirmedKodySkip(event)) return [];
  const check = event.check_run;
  const repository = event.repository.full_name;
  const unique = new Set();
  const output = [];
  for (const pr of check.pull_requests ?? []) {
    const number = Number(pr?.number);
    if (!Number.isSafeInteger(number) || number < 1 || unique.has(number)) continue;
    unique.add(number);
    output.push({
      repository,
      pr: number,
      headSha: check.head_sha,
      checkRunId: check.id,
      checkUrl: check.html_url ?? "",
    });
  }
  return output;
}

/** 安全补查 check_run.pull_requests 为空的同仓 PR，仅接受唯一 HEAD 命中。 */
async function githubJson(path, token) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "oreki-kody-skip-reconcile",
    },
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status} for ${path}`);
  return response.json();
}

export function hadEarlierRealKodyReview(current, checks) {
  const completedAt = Date.parse(current?.completed_at ?? "");
  return checks.some(check =>
    check?.app?.slug === "kody-ai" &&
    check?.name === "Kody Code Review" &&
    check?.status === "completed" &&
    ["success", "failure"].includes(check?.conclusion) &&
    check?.id !== current?.id &&
    Number.isFinite(Date.parse(check?.completed_at ?? "")) &&
    Number.isFinite(completedAt) &&
    Date.parse(check.completed_at) <= completedAt
  );
}

async function resolvedKodySkipCandidates(event, token) {
  const direct = kodySkipPullRequests(event);
  if (direct.length) return direct;
  if (!confirmedKodySkip(event)) return [];
  const repository = event.repository.full_name;
  const sha = event.check_run.head_sha;
  const possible = await githubJson(
    `/repos/${repository}/commits/${sha}/pulls?per_page=100`,
    token,
  );
  const matching = possible.filter(pr => pr?.head?.sha === sha);
  if (matching.length !== 1) {
    console.log("Kody skip: PR 关联为空或不唯一，禁止推测退额目标。");
    return [];
  }
  return [{
    repository,
    pr: matching[0].number,
    headSha: sha,
    checkRunId: event.check_run.id,
    checkUrl: event.check_run.html_url ?? "",
  }];
}

export async function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error("GITHUB_EVENT_PATH is required");
  const event = JSON.parse(readFileSync(eventPath, "utf8"));
  if (!confirmedKodySkip(event)) return;
  const token = process.env.GH_TOKEN;
  if (!token) throw new Error("GH_TOKEN is required");
  const matches = await resolvedKodySkipCandidates(event, token);
  if (!matches.length) {
    console.log("Kody skip: 无可靠 PR 关联，保留原始计数等待核对。");
    return;
  }
  const repository = event.repository.full_name;
  const sha = event.check_run.head_sha;
  const checks = await githubJson(
    `/repos/${repository}/commits/${sha}/check-runs?check_name=Kody%20Code%20Review&filter=all&per_page=100`,
    token,
  );
  if ((checks.total_count ?? 0) > (checks.check_runs?.length ?? 0)) {
    throw new Error("Kody Check 证据分页不完整，拒绝自动退额");
  }
  if (hadEarlierRealKodyReview(event.check_run, checks.check_runs ?? [])) {
    console.log("Kody skip: 同一 HEAD 已存在 Kody 实际完成的审查，保守保留用量。");
    return;
  }
  for (const match of matches) {
    const result = await markKodySkippedQuota(token, match);
    console.log(
      `Kody skip: ${match.repository}#${match.pr}@${match.headSha} ` +
      `CheckRun=${match.checkRunId} => ${result.reason}; ` +
      `counts=${result.counts?.used ?? "unchanged"}`,
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`Kody skip quota reconciliation failed: ${error.message}`);
    process.exitCode = 1;
  });
}
