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
import { isExactTriggerComment } from "./trigger.mjs";

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
      checkStartedAt: check.started_at ?? check.created_at ?? "",
      checkUrl: check.html_url ?? "",
    });
  }
  return output.length === 1 ? output : [];
}

export function kodyTriggerCommentEvidence(comments, repository, pr) {
  return comments
    .filter(isExactTriggerComment)
    .map(comment => ({
      repository,
      pr,
      commentId: String(comment.id),
      url: comment.html_url ?? "",
      createdAt: comment.created_at,
    }))
    .filter(item =>
      item.commentId &&
      Number.isFinite(Date.parse(String(item.createdAt ?? ""))));
}

export function realKodyReviews(checks, currentCheckId, evidence = [],
  targetPr = null) {
  const triggerTimes = evidence
    .map(item => ({
      commentId: String(item.commentId ?? ""),
      at: Date.parse(String(item.createdAt ?? "")),
    }))
    .filter(item => item.commentId && Number.isFinite(item.at))
    .sort((left, right) => left.at - right.at);
  return checks
    .filter(check => {
      const realOrRunning =
        ["queued", "in_progress"].includes(check?.status) ||
        (check?.status === "completed" && ["success", "failure"].includes(check?.conclusion));
      return check?.app?.slug === "kody-ai" &&
        check?.name === "Kody Code Review" &&
        realOrRunning &&
        (targetPr == null ||
          (check?.pull_requests?.length
            ? check.pull_requests.some(pr => Number(pr?.number) === Number(targetPr))
            : true)) &&
        String(check?.id ?? "") !== String(currentCheckId ?? "") &&
        Number.isFinite(Date.parse(String(check?.started_at ?? check?.created_at ?? "")));
    })
    .map(check => {
      const startedAt = check.started_at ?? check.created_at;
      const startedMs = Date.parse(String(startedAt ?? ""));
      const trigger = triggerTimes
        .filter(item => item.at <= startedMs)
        .sort((left, right) => right.at - left.at)[0] ?? null;
      return {
        startedAt,
        commentId: trigger?.commentId ?? "",
      };
    });
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

export async function githubListAll(path, token, maxPages = 10) {
  const output = [];
  let next = path;
  for (let page = 0; next && page < maxPages; page += 1) {
    const response = await fetch(`https://api.github.com${next}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "oreki-kody-skip-reconcile",
      },
    });
    if (!response.ok) throw new Error(`GitHub API ${response.status} for ${next}`);
    output.push(...await response.json());
    const link = response.headers.get("link") ?? "";
    const match = link.match(/<([^>]+)>;\s*rel="next"/);
    next = match ? match[1].replace("https://api.github.com", "") : "";
    if (next && page + 1 >= maxPages) {
      throw new Error("Kody skip comment evidence pagination incomplete");
    }
  }
  return output;
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
    checkStartedAt: event.check_run.started_at ?? event.check_run.created_at ?? "",
    checkUrl: event.check_run.html_url ?? "",
  }];
}

export async function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error("GITHUB_EVENT_PATH is required");
  const token = process.env.GH_TOKEN;
  if (!token) throw new Error("GH_TOKEN is required");
  const eventName = String(process.env.GITHUB_EVENT_NAME ?? "").trim();
  if (!eventName) throw new Error("GITHUB_EVENT_NAME is required");
  let event = JSON.parse(readFileSync(eventPath, "utf8"));
  if (eventName === "workflow_dispatch") {
    const input = String(process.env.INPUT_CHECK_RUN_ID ?? "").trim();
    if (!/^[1-9][0-9]*$/u.test(input)) {
      throw new Error("workflow_dispatch check_run_id is invalid");
    }
    const check = await githubJson(
      `/repos/${process.env.GITHUB_REPOSITORY}/check-runs/${input}`,
      token,
    );
    event = {
      action: "completed",
      repository: { full_name: process.env.GITHUB_REPOSITORY },
      check_run: check,
    };
  }
  if (!confirmedKodySkip(event)) return;
  const matches = await resolvedKodySkipCandidates(event, token);
  if (!matches.length) {
    console.log("Kody skip: 无可靠 PR 关联，保留原始计数等待核对。");
    return;
  }
  const repository = event.repository.full_name;
  const sha = event.check_run.head_sha;
  let headCommittedAt = "";
  try {
    const headCommit = await githubJson(`/repos/${repository}/commits/${sha}`, token);
    headCommittedAt =
      headCommit?.commit?.committer?.date ??
      headCommit?.commit?.author?.date ??
      "";
  } catch (error) {
    console.warn(
      `Kody skip: head commit metadata unavailable; exact-head records only: ${error.message}`,
    );
  }
  const checks = await githubJson(
    `/repos/${repository}/commits/${sha}/check-runs?check_name=Kody%20Code%20Review&filter=all&per_page=100`,
    token,
  );
  if ((checks.total_count ?? 0) > (checks.check_runs?.length ?? 0)) {
    throw new Error("Kody Check 证据分页不完整，拒绝自动退额");
  }
  for (const match of matches) {
    const currentPr = await githubJson(
      `/repos/${repository}/pulls/${match.pr}`,
      token,
    );
    const currentPullRequestHeadSha = currentPr?.head?.sha ?? "";
    if (!currentPullRequestHeadSha) {
      throw new Error(`Kody skip: PR #${match.pr} current head is unavailable`);
    }
    let currentPullRequestHeadCommittedAt = headCommittedAt;
    if (currentPullRequestHeadSha !== sha) {
      const currentHeadCommit = await githubJson(
        `/repos/${repository}/commits/${currentPullRequestHeadSha}`,
        token,
      );
      currentPullRequestHeadCommittedAt =
        currentHeadCommit?.commit?.committer?.date ??
        currentHeadCommit?.commit?.author?.date ??
        "";
      if (!Number.isFinite(Date.parse(String(currentPullRequestHeadCommittedAt)))) {
        throw new Error(`Kody skip: PR #${match.pr} current head time is unavailable`);
      }
    }
    let commentsFetchFailed = false;
    let comments = [];
    try {
      comments = await githubListAll(
        `/repos/${repository}/issues/${match.pr}/comments?sort=created&direction=desc&per_page=100`,
        token,
      );
    } catch (error) {
      commentsFetchFailed = true;
      console.warn(
        `Kody skip: PR #${match.pr} comment evidence unavailable; ` +
        `exact-head records only: ${error.message}`,
      );
    }
    match.checkStartedAt = event.check_run.started_at ?? event.check_run.created_at ?? "";
    match.headCommittedAt = headCommittedAt;
    match.currentPullRequestHeadSha = currentPullRequestHeadSha;
    match.currentPullRequestHeadCommittedAt = currentPullRequestHeadCommittedAt;
    match.evidence = kodyTriggerCommentEvidence(comments, repository, match.pr);
    match.priorRealReviews = realKodyReviews(
      checks.check_runs ?? [],
      event.check_run.id,
      match.evidence,
      match.pr,
    );
    const startedMs = Date.parse(String(match.checkStartedAt ?? ""));
    const result = await markKodySkippedQuota(token, match, {
      now: Number.isFinite(startedMs) ? new Date(startedMs) : new Date(),
    });
    if (!result.ok &&
        commentsFetchFailed &&
        result.reason === "no-matching-kody-trigger") {
      throw new Error(
        `Kody skip: ${match.repository}#${match.pr} requires retry: ${result.reason}`,
      );
    }
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
