import { readFileSync, appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const TRIGGER_AUTHOR = "OrekiDawson";
export const TRIGGER_BODY = "@kody start-review";
export const KODY_LOGIN = "kody-ai[bot]";
export const REPOSITORIES = Object.freeze([
  "OrekiDawson/AD-Oreki-Edition-Android",
  "OrekiDawson/AD-Oreki-Edition-Web",
]);

export function validatePullRequest(pr, repositoryFullName) {
  if (!pr) return { allowed: false, reason: "missing_pull_request" };
  if (pr.user?.login !== TRIGGER_AUTHOR) return { allowed: false, reason: "author_not_allowed" };
  if (pr.base?.ref !== "main") return { allowed: false, reason: "base_not_main" };
  if (pr.head?.repo?.full_name !== repositoryFullName) {
    return { allowed: false, reason: "fork_or_cross_repository" };
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

export function findTriggerForHead(comments, commitCreatedAt) {
  const commitTime = Date.parse(commitCreatedAt);
  if (!Number.isFinite(commitTime)) return null;
  return comments.find(comment =>
    isExactTriggerComment(comment) &&
    Number.isFinite(Date.parse(comment.created_at)) &&
    Date.parse(comment.created_at) >= commitTime
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

export function countTriggersSince(comments, since) {
  const sinceMs = since.getTime();
  return comments.filter(comment =>
    isExactTriggerComment(comment) &&
    Number.isFinite(Date.parse(comment.created_at)) &&
    Date.parse(comment.created_at) >= sinceMs
  ).length;
}

export function budgetDecision(repoTriggerCount, perRepoLimit) {
  if (!Number.isInteger(perRepoLimit) || perRepoLimit < 1) {
    throw new Error("per-repo trigger limit must be a positive integer");
  }
  return repoTriggerCount < perRepoLimit
    ? { allowed: true, reason: "budget_available" }
    : { allowed: false, reason: "daily_trigger_cap_reached" };
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

function writeSummary({ status, reason, pr, headSha, commentUrl, budgetCount }) {
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
  if (Number.isInteger(budgetCount)) lines.push(`- 当前仓库当日已触发：${budgetCount}`);
  if (commentUrl) lines.push(`- 触发评论：${commentUrl}`);
  lines.push("- Kody 审查结果：未验证；发送触发命令不等于审查完成。");
  appendFileSync(summaryPath, `${lines.join("\n")}\n`);
}

function finishSkip(reason, pr = null, headSha = "", budgetCount = null) {
  const safeReason = String(reason).replaceAll(/[^a-zA-Z0-9_-]/g, "_");
  writeOutput("kody_review_state", "skipped");
  writeOutput("skip_reason", safeReason);
  writeSummary({
    status: "skipped",
    reason: safeReason,
    pr,
    headSha,
    budgetCount,
  });
  console.log(`Kody trigger skipped: ${safeReason}`);
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
    throw new Error(`GitHub API ${method} ${path} failed: ${response.status} ${message}`);
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
    next = match ? match[1].replace("https://api.github.com", "") : "";
  }
  return items;
}

async function getPullRequest(repository, number, token) {
  const response = await requestJson(`/repos/${repository}/pulls/${number}`, { token });
  return response.json();
}

async function sleep(seconds) {
  if (seconds > 0) await new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

export async function main() {
  const token = requiredEnv("GH_TOKEN");
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
  if (eventName === "synchronize") {
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
  const commit = await (await requestJson(
    `/repos/${repository}/commits/${headSha}`,
    { token },
  )).json();
  const commitCreatedAt = commit?.commit?.committer?.date;
  if (findTriggerForHead(comments, commitCreatedAt)) {
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

  const since = shanghaiDayStart(new Date());
  const dailyComments = [];
  for (const repo of REPOSITORIES) {
    const repoComments = await listAllPages(
      `/repos/${repo}/issues/comments?since=${encodeURIComponent(since.toISOString())}&per_page=100`,
      token,
    );
    dailyComments.push(...repoComments);
  }
  const repoTriggerCount = countTriggersSince(
    dailyComments.filter(comment => comment.repository_url?.endsWith(`/repos/${repository}`)),
    since,
  );
  const perRepoLimit = Number.parseInt(
    process.env.MAX_TRIGGERS_PER_REPO_PER_DAY ?? "50",
    10,
  );
  const budget = budgetDecision(repoTriggerCount, perRepoLimit);
  if (!budget.allowed) {
    finishSkip(budget.reason, pr, headSha, repoTriggerCount);
    return;
  }

  const latest = await getPullRequest(repository, prNumber, token);
  if (latest.head?.sha !== headSha || latest.draft === true) {
    finishSkip("head_changed_before_comment", latest, latest.head?.sha ?? "", repoTriggerCount);
    return;
  }

  const created = await (await requestJson(
    `/repos/${repository}/issues/${prNumber}/comments`,
    {
      method: "POST",
      token,
      body: { body: TRIGGER_BODY },
    },
  )).json();

  writeOutput("kody_review_state", "trigger_posted");
  writeOutput("head_sha", headSha);
  writeOutput("comment_id", created.id);
  writeOutput("comment_url", created.html_url);
  writeSummary({
    status: "trigger_posted",
    reason: "comment_created",
    pr,
    headSha,
    commentUrl: created.html_url,
    budgetCount: repoTriggerCount + 1,
  });
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
