import assert from "node:assert/strict";
import test from "node:test";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

import {
  confirmedKodySkip,
  githubListAll,
  kodyTriggerCommentEvidence,
  kodySkipPullRequests,
  main as reconcileKodySkip,
  realKodyReviews,
} from "./skip-reconcile.mjs";

const repository = "OrekiDawson/AD-Oreki-Edition-Android";
const workflow = readFileSync(
  new URL("../workflows/kody-trigger.yml", import.meta.url),
  "utf8",
);

test("Kody 工作流只使用合法并发键，并按事件身份隔离", () => {
  assert.doesNotMatch(workflow, /^\s+queue:\s*/m);
  assert.match(workflow,
    /group: kody-skip-reconcile-\$\{\{ github\.repository \}\}-\$\{\{ github\.event\.check_run\.id \}\}/);
  assert.match(workflow,
    /group: kody-trigger-budget-\$\{\{ github\.repository \}\}-\$\{\{ github\.event\.pull_request\.number \|\| inputs\.pr_number \}\}/);
  const reconcileJob = workflow.split("reconcile_skipped:")[1].split("steps:")[0];
  assert.match(reconcileJob, /contents: read/);
  assert.match(reconcileJob, /issues: read/);
  assert.match(reconcileJob, /pull-requests: read/);
});

test("评论证据超过分页上限时失败关闭", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    async json() { return [{ id: 1 }]; },
    headers: { get: () => '<https://api.github.com/next-page>; rel="next"' },
  });
  try {
    await assert.rejects(
      githubListAll("/comments", "token", 1),
      /pagination incomplete/u,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Kody skipped 入口读取事件名并覆盖自动事件与手动重核分支", async () => {
  const directory = mkdtempSync(join(tmpdir(), "oreki-kody-skip-"));
  const eventPath = join(directory, "event.json");
  const previous = {
    GITHUB_EVENT_PATH: process.env.GITHUB_EVENT_PATH,
    GITHUB_EVENT_NAME: process.env.GITHUB_EVENT_NAME,
    GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY,
    GH_TOKEN: process.env.GH_TOKEN,
    INPUT_CHECK_RUN_ID: process.env.INPUT_CHECK_RUN_ID,
  };
  const restore = () => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
  process.env.GITHUB_EVENT_PATH = eventPath;
  process.env.GITHUB_REPOSITORY = repository;
  process.env.GH_TOKEN = "test-token";
  try {
    writeFileSync(eventPath, JSON.stringify({
      action: "completed",
      repository: { full_name: repository },
      check_run: {
        id: 100,
        name: "Kody Code Review",
        status: "completed",
        conclusion: "success",
        head_sha: "a".repeat(40),
        app: { slug: "kody-ai" },
        pull_requests: [{ number: 42 }],
      },
    }));
    process.env.GITHUB_EVENT_NAME = "check_run";
    delete process.env.INPUT_CHECK_RUN_ID;
    await reconcileKodySkip();

    writeFileSync(eventPath, "{}");
    process.env.GITHUB_EVENT_NAME = "workflow_dispatch";
    process.env.INPUT_CHECK_RUN_ID = "0";
    await assert.rejects(
      reconcileKodySkip(),
      /workflow_dispatch check_run_id is invalid/u,
    );

    process.env.GITHUB_EVENT_NAME = "";
    await assert.rejects(
      reconcileKodySkip(),
      /GITHUB_EVENT_NAME is required/u,
    );
  } finally {
    restore();
    rmSync(directory, { recursive: true, force: true });
  }
});

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
    new Date("2026-11-20T04:00:00Z"),
    new Date("2026-11-20T03:59:59Z"),
  ), false);
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

test("预算只读取 Android 与 Web 评论源，不读取 Wiki", () => {
  const since = new Date("2026-11-20T16:00:00Z");
  const paths = sharedDailyCommentsPaths(repository, since);
  assert.equal(paths.length, 2);
  assert.match(paths[0].path, /AD-Oreki-Edition-Android/);
  assert.match(paths[1].path, /AD-Oreki-Edition-Web/);
  assert.equal(paths.some(item => item.repository.includes("AD-Oreki-Wiki")), false);
  assert.equal(paths[0].path, dailyCommentsPath(paths[0].repository, since));
});

test("分页仍有下一页且达到上限时拒绝使用不完整数据", () => {
  assert.doesNotThrow(() => assertPaginationComplete(false, 10, 10));
  assert.doesNotThrow(() => assertPaginationComplete(true, 9, 10));
  assert.throws(() => assertPaginationComplete(true, 10, 10), /incomplete/);
});

test("只有 Kody 官方 completed/skipped Check 才能退额", () => {
  const event = {
    action: "completed",
    repository: { full_name: repository },
    check_run: {
      id: 9871,
      name: "Kody Code Review",
      status: "completed",
      conclusion: "skipped",
      head_sha: "a".repeat(40),
      started_at: "2026-11-21T12:59:00Z",
      app: { slug: "kody-ai" },
      pull_requests: [{ number: 42 }, { number: 42 }],
      html_url: "https://example.test/checks/9871",
    },
  };
  assert.equal(confirmedKodySkip(event), true);
  assert.equal(kodySkipPullRequests(event).length, 1);
  assert.equal(kodySkipPullRequests(event)[0].pr, 42);
  assert.equal(kodySkipPullRequests(event)[0].checkStartedAt, "2026-11-21T12:59:00Z");
  assert.equal(confirmedKodySkip({
    ...event, check_run: { ...event.check_run, conclusion: "success" },
  }), false); // 无问题的正常审查依然计入
  assert.equal(confirmedKodySkip({
    ...event, check_run: { ...event.check_run, app: { slug: "github-actions" } },
  }), false); // 普通 GitHub Workflow Skipped 不可冒充
  assert.equal(confirmedKodySkip({
    ...event, check_run: { ...event.check_run, name: "Kody trigger" },
  }), false);
  assert.equal(confirmedKodySkip({
    ...event, repository: { full_name: "OrekiDawson/AD-Oreki-Wiki" },
  }), false); // Wiki 不属于 Android/Web 共享额度
  assert.deepEqual(kodySkipPullRequests({ ...event, check_run: {
    ...event.check_run, pull_requests: [],
  } }), []); // 关联不明时不误退款
  assert.deepEqual(kodySkipPullRequests({ ...event, check_run: {
    ...event.check_run, pull_requests: [{ number: 42 }, { number: 43 }],
  } }), []); // 单个 Check 关联多个 PR 时无法证明归属
});

test("已完成、运行中或排队 Kody Review 关联到启动前最近请求", () => {
  const checks = [
    {
      id: 1,
      app: { slug: "kody-ai" },
      name: "Kody Code Review",
      status: "completed",
      conclusion: "success",
      started_at: "2026-11-21T12:58:00Z",
      pull_requests: [{ number: 42 }],
    },
    {
      id: 2,
      app: { slug: "kody-ai" },
      name: "Kody Code Review",
      status: "completed",
      conclusion: "skipped",
      started_at: "2026-11-21T12:59:00Z",
      pull_requests: [{ number: 42 }],
    },
    {
      id: 3,
      app: { slug: "github-actions" },
      name: "Kody Code Review",
      status: "completed",
      conclusion: "success",
      started_at: "2026-11-21T12:58:30Z",
      pull_requests: [{ number: 42 }],
    },
    {
      id: 4,
      app: { slug: "kody-ai" },
      name: "Kody Code Review",
      status: "in_progress",
      conclusion: null,
      started_at: "2026-11-21T12:58:40Z",
      pull_requests: [{ number: 42 }],
    },
    {
      id: 5,
      app: { slug: "kody-ai" },
      name: "Kody Code Review",
      status: "queued",
      conclusion: null,
      started_at: null,
      created_at: "2026-11-21T12:58:50Z",
      pull_requests: [{ number: 42 }],
    },
    {
      id: 6,
      app: { slug: "kody-ai" },
      name: "Kody Code Review",
      status: "completed",
      conclusion: "success",
      started_at: "2026-11-21T12:58:55Z",
      pull_requests: [{ number: 99 }],
    },
    {
      id: 7,
      app: { slug: "kody-ai" },
      name: "Kody Code Review",
      status: "completed",
      conclusion: "success",
      started_at: "2026-11-21T12:59:00Z",
      pull_requests: [],
    },
  ];
  const evidence = [
    { commentId: "70", createdAt: "2026-11-21T12:57:50Z" },
    { commentId: "71", createdAt: "2026-11-21T12:58:20Z" },
  ];
  assert.deepEqual(realKodyReviews(checks, 2, evidence, 42, true), [
    { startedAt: "2026-11-21T12:58:00Z", commentId: "70" },
    { startedAt: "2026-11-21T12:58:40Z", commentId: "71" },
    { startedAt: "2026-11-21T12:58:50Z", commentId: "71" },
    { startedAt: "2026-11-21T12:59:00Z", commentId: "71" },
  ]);
  assert.equal(realKodyReviews(checks, 2, evidence, 42, false).length, 3);
});

test("skipped Check 到达时可从 PR 评论补齐精确触发证据", () => {
  const comments = [
    {
      id: 77,
      user: { login: "OrekiDawson" },
      body: "@kody start-review",
      html_url: "https://example.test/pull/7#issuecomment-77",
      created_at: "2026-11-21T12:58:30Z",
    },
    {
      id: 78,
      user: { login: "OrekiDawson" },
      body: "@kody start-review please",
      html_url: "https://example.test/pull/7#issuecomment-78",
      created_at: "2026-11-21T12:58:40Z",
    },
  ];
  assert.deepEqual(kodyTriggerCommentEvidence(comments, repository, 7), [{
    repository,
    pr: 7,
    commentId: "77",
    url: "https://example.test/pull/7#issuecomment-77",
    createdAt: "2026-11-21T12:58:30Z",
  }]);
});
