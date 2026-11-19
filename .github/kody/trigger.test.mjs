import assert from "node:assert/strict";
import test from "node:test";

import {
  TRIGGER_BODY,
  budgetDecision,
  countTriggersSince,
  findKodyReviewForHead,
  findTriggerForHead,
  shanghaiDayStart,
  validatePullRequest,
  validateTriggerIdentity,
} from "./trigger.mjs";

const repository = "OrekiDawson/AD-Oreki-Edition-Web";

function pr(overrides = {}) {
  return {
    number: 1,
    draft: false,
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

test("拒绝其他作者、Bot、Fork、Draft 和错误目标分支", () => {
  assert.equal(validatePullRequest(pr({ user: { login: "someone" } }), repository).reason,
    "author_not_allowed");
  assert.equal(validatePullRequest(pr({ user: { login: "dependabot[bot]" } }), repository).reason,
    "author_not_allowed");
  assert.equal(validatePullRequest(pr({
    head: { sha: "b".repeat(40), repo: { full_name: "fork/repo" } },
  }), repository).reason, "fork_or_cross_repository");
  assert.equal(validatePullRequest(pr({ draft: true }), repository).reason, "draft");
  assert.equal(validatePullRequest(pr({ base: { ref: "dev" } }), repository).reason,
    "base_not_main");
});

test("PAT 身份必须严格等于 OrekiDawson", () => {
  assert.equal(validateTriggerIdentity("OrekiDawson").allowed, true);
  assert.equal(validateTriggerIdentity("orekidawson").allowed, false);
  assert.equal(validateTriggerIdentity("oreki-bot").allowed, false);
});

test("同一 Head 的精确触发评论会被识别，旧评论不会误拦截新 SHA", () => {
  const comments = [
    {
      user: { login: "OrekiDawson" },
      body: TRIGGER_BODY,
      created_at: "2026-11-19T10:01:00Z",
    },
  ];
  assert.ok(findTriggerForHead(comments, "2026-11-19T10:00:00Z"));
  assert.equal(findTriggerForHead(comments, "2026-11-19T10:02:00Z"), null);
});

test("其他作者、Bot 或改写正文不构成去重命中", () => {
  const comments = [
    { user: { login: "someone" }, body: TRIGGER_BODY, created_at: "2026-11-19T10:01:00Z" },
    { user: { login: "OrekiDawson" }, body: `${TRIGGER_BODY} please`, created_at: "2026-11-19T10:01:00Z" },
  ];
  assert.equal(findTriggerForHead(comments, "2026-11-19T10:00:00Z"), null);
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
});

test("每仓 50 次触发上限使双仓共享总量不超过 100", () => {
  const since = new Date("2026-11-20T16:00:00Z");
  const comments = Array.from({ length: 50 }, (_, index) => ({
    user: { login: "OrekiDawson" },
    body: TRIGGER_BODY,
    created_at: new Date(since.getTime() + index * 1000).toISOString(),
  }));
  assert.equal(countTriggersSince(comments, since), 50);
  assert.equal(budgetDecision(49, 50).allowed, true);
  assert.equal(budgetDecision(50, 50).allowed, false);
});
