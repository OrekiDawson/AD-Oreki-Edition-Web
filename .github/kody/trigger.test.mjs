import assert from "node:assert/strict";
import test from "node:test";

import {
  DAILY_TRIGGER_LIMIT,
  TRIGGER_BODY,
  assertPaginationComplete,
  budgetDecision,
  countSharedTriggersSince,
  dailyCommentsPath,
  findKodyReviewForHead,
  findTriggerReservation,
  millisecondsUntilShanghaiMidnight,
  quotaPostWindowOpen,
  shouldWaitForQuotaMidnight,
  sameShanghaiQuotaDay,
  shanghaiDayStart,
  sharedDailyCommentsPaths,
  sharedTriggerQuotaEvidence,
  triggerIdentity,
  validatePullRequest,
  validateTriggerIdentity,
} from "./trigger.mjs";

const repository = "OrekiDawson/AD-Oreki-Edition-Android";

function pr(overrides = {}) {
  return {
    number: 1,
    draft: false,
    state: "open",
    merged_at: null,
    user: { login: "OrekiDawson" },
    base: { ref: "main" },
    head: { sha: "a".repeat(40), repo: { full_name: repository } },
    ...overrides,
  };
}

test("允许仓库所有者、main、同仓、非 Draft", () => {
  assert.deepEqual(validatePullRequest(pr(), repository), {
    allowed: true,
    reason: "eligible",
  });
});

test("拒绝其他作者、Bot、Fork、Draft、关闭 PR 和错误目标分支", () => {
  assert.equal(validatePullRequest(pr({ user: { login: "someone" } }), repository).reason,
    "author_not_allowed");
  assert.equal(validatePullRequest(pr({ user: { login: "dependabot[bot]" } }), repository).reason,
    "author_not_allowed");
  assert.equal(validatePullRequest(pr({
    head: { sha: "b".repeat(40), repo: { full_name: "fork/repo" } },
  }), repository).reason, "fork_or_cross_repository");
  assert.equal(validatePullRequest(pr({ draft: true }), repository).reason, "draft");
  assert.equal(validatePullRequest(pr({ state: "closed" }), repository).reason, "pr_not_open");
  assert.equal(validatePullRequest(pr({ merged_at: "2026-11-20T00:00:00Z" }), repository)
    .reason, "pr_not_open");
  assert.equal(validatePullRequest(pr({ base: { ref: "dev" } }), repository).reason,
    "base_not_main");
});

test("PAT 身份必须严格等于 OrekiDawson", () => {
  assert.equal(validateTriggerIdentity("OrekiDawson").allowed, true);
  assert.equal(validateTriggerIdentity("orekidawson").allowed, false);
  assert.equal(validateTriggerIdentity("oreki-bot").allowed, false);
});

test("同一 Head 由成功、中性或进行中 Check Run 保守去重，不依赖提交时间", () => {
  const head = "a".repeat(40);
  const identity = triggerIdentity(repository, 7, head);
  assert.ok(findTriggerReservation([
    { external_id: identity, status: "completed", conclusion: "success" },
  ], identity));
  assert.ok(findTriggerReservation([
    { external_id: identity, status: "in_progress", conclusion: null },
  ], identity));
  assert.ok(findTriggerReservation([
    { external_id: identity, status: "completed", conclusion: "neutral" },
  ], identity));
  assert.equal(findTriggerReservation([
    { external_id: identity, status: "completed", conclusion: "failure" },
  ], identity), null);
  assert.equal(findTriggerReservation([
    { external_id: triggerIdentity(repository, 7, "b".repeat(40)),
      status: "completed", conclusion: "success" },
  ], identity), null);
});

test("Kody Review 或初始化评论已覆盖同一 Head 时跳过", () => {
  const head = "c".repeat(40);
  assert.equal(findKodyReviewForHead(
    [{ user: { login: "kody-ai[bot]" }, commit_id: head }],
    [],
    head,
  )?.kind, "review");
  assert.equal(findKodyReviewForHead(
    [],
    [{ user: { login: "kody-ai[bot]" }, body: `blob/${head}/file` }],
    head,
  )?.kind, "comment");
});

test("UTC+08:00 自然日边界正确", () => {
  assert.equal(
    shanghaiDayStart(new Date("2026-11-20T15:59:59Z")).toISOString(),
    "2026-11-19T16:00:00.000Z",
  );
  assert.equal(
    shanghaiDayStart(new Date("2026-11-20T16:00:00Z")).toISOString(),
    "2026-11-20T16:00:00.000Z",
  );
  assert.equal(sameShanghaiQuotaDay(
    new Date("2026-11-20T15:59:59Z"),
    new Date("2026-11-20T00:00:00Z"),
  ), true);
  assert.equal(sameShanghaiQuotaDay(
    new Date("2026-11-20T16:00:00Z"),
    new Date("2026-11-20T15:59:59Z"),
  ), false);
  assert.equal(quotaPostWindowOpen(
    new Date("2026-11-20T15:59:50Z"),
    new Date("2026-11-20T15:59:40Z"),
  ), false);
  assert.equal(quotaPostWindowOpen(
    new Date("2026-11-20T15:59:30Z"),
    new Date("2026-11-20T15:59:20Z"),
  ), true);
  assert.equal(millisecondsUntilShanghaiMidnight(new Date("2026-11-20T15:59:50Z")), 10000);
  assert.equal(shouldWaitForQuotaMidnight(
    new Date("2026-11-20T15:59:50Z"),
    new Date("2026-11-20T15:59:40Z"),
  ), true);
  assert.equal(shouldWaitForQuotaMidnight(
    new Date("2026-11-20T16:00:01Z"),
    new Date("2026-11-20T15:59:50Z"),
  ), false);
});

function triggerComment(id, createdAt, overrides = {}) {
  return {
    id,
    user: { login: "OrekiDawson" },
    body: TRIGGER_BODY,
    created_at: createdAt,
    html_url: `https://github.com/example/repo/pull/${id}#issuecomment-${id}`,
    ...overrides,
  };
}

test("Android/Web 合计按唯一评论 ID 计数，Webhook 重试不重复计数", () => {
  const since = new Date("2026-11-20T16:00:00Z");
  const groups = [
    {
      repository: "OrekiDawson/AD-Oreki-Edition-Android",
      comments: [
        triggerComment(1, "2026-11-20T16:00:01Z"),
        triggerComment(2, "2026-11-20T16:00:02Z"),
        triggerComment(2, "2026-11-20T16:00:02Z"),
      ],
    },
    {
      repository: "OrekiDawson/AD-Oreki-Edition-Web",
      comments: [
        triggerComment(3, "2026-11-20T16:00:03Z"),
        triggerComment(4, "2026-11-20T16:00:04Z"),
      ],
    },
  ];
  assert.equal(countSharedTriggersSince(groups, since), 4);
  assert.deepEqual(
    sharedTriggerQuotaEvidence(groups, since).map(item => item.commentId),
    ["1", "2", "3", "4"],
  );
  assert.deepEqual(
    sharedTriggerQuotaEvidence(groups, since).map(item => item.pr),
    [1, 2, 3, 4],
  );
});

test("仅精确主动指令计数；回复、Bot、Oreki Audit 和自然日外评论均排除", () => {
  const since = new Date("2026-11-20T16:00:00Z");
  const groups = [{
    repository,
    comments: [
      triggerComment(10, "2026-11-20T16:00:01Z"),
      triggerComment(11, "2026-11-20T16:00:02Z", { body: "@kody start-review 请继续" }),
      triggerComment(12, "2026-11-20T16:00:03Z", { user: { login: "kody-ai[bot]" } }),
      triggerComment(15, "2026-11-20T16:00:04Z", { user: { login: "oreki-audit[bot]" } }),
      triggerComment(13, "2026-11-20T15:59:59Z"),
      triggerComment(14, "2026-11-21T16:00:00Z"),
    ],
  }];
  assert.deepEqual(
    sharedTriggerQuotaEvidence(groups, since).map(item => item.commentId),
    ["10"],
  );
});

test("同一 PR 再次主动指令按新评论计新请求", () => {
  const since = new Date("2026-11-20T16:00:00Z");
  const groups = [{
    repository,
    comments: [
      triggerComment(20, "2026-11-20T16:00:01Z"),
      triggerComment(21, "2026-11-20T16:01:01Z"),
    ],
  }];
  assert.equal(countSharedTriggersSince(groups, since), 2);
});

test("80 次预警但放行，100 次阻止新增主动请求", () => {
  assert.deepEqual(budgetDecision(79), {
    allowed: true,
    warning: false,
    remaining: 21,
    reason: "budget_available",
  });
  assert.deepEqual(budgetDecision(80), {
    allowed: true,
    warning: true,
    remaining: 20,
    reason: "daily_warning_reached",
  });
  assert.equal(budgetDecision(99).allowed, true);
  assert.deepEqual(budgetDecision(DAILY_TRIGGER_LIMIT), {
    allowed: false,
    warning: true,
    remaining: 0,
    reason: "daily_trigger_cap_reached",
  });
});

test("预算同时读取 Android 与 Web 评论源", () => {
  const since = new Date("2026-11-20T16:00:00Z");
  const paths = sharedDailyCommentsPaths(repository, since);
  assert.equal(paths.length, 2);
  assert.match(paths[0].path, /AD-Oreki-Edition-Android/);
  assert.match(paths[1].path, /AD-Oreki-Edition-Web/);
  assert.equal(paths[0].path, dailyCommentsPath(paths[0].repository, since));
});

test("分页仍有下一页且达到上限时拒绝使用不完整数据", () => {
  assert.doesNotThrow(() => assertPaginationComplete(false, 10, 10));
  assert.doesNotThrow(() => assertPaginationComplete(true, 9, 10));
  assert.throws(() => assertPaginationComplete(true, 10, 10), /incomplete/);
});
