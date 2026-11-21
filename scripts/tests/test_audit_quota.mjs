#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  KODY_DAILY_LIMIT,
  KODY_KIND,
  KODY_SKIP_PENDING_KIND,
  KODY_WARNING_AT,
  LIMIT,
  SHARED_QUOTA_REPOSITORIES,
  applyCas,
  attachKodyCommand,
  clearPendingKodySkip,
  consumedCount,
  importKodyEvidence,
  isSharedQuotaRepository,
  kodyQuotaCounts,
  markKodySkippedPure,
  queuePendingKodySkip,
  releaseKodyCommand,
  reserveKodyPure,
  reservePure,
  shanghaiDate,
  transitionPure,
} from "../../.github/codex/audit-quota.mjs";

const candidate = index => ({
  identity: `review-${index}`,
  repository: index % 2 ? "AD-Oreki-Edition-Android" : "AD-Oreki-Edition-Web",
  pr: index,
  headSha: `head-${index}`,
  configVersion: "config",
  crossRepo: true,
  peerRepo: "peer",
  peerSha: "peer-sha",
});

const date = "2026-11-19";
const records99 = Array.from({ length: 99 }, (_, index) => ({
  ...candidate(index),
  requestId: `r${index}`,
  date,
  status: "model_succeeded",
  modelCalls: 1,
  report: "",
}));
const last = reservePure(records99, candidate(99), { date, limit: LIMIT });
assert.equal(last.allowed, true);
assert.equal(last.records.length, 100);
assert.equal(consumedCount(last.records), 100);
const rejected = reservePure(last.records, candidate(100), { date, limit: LIMIT });
assert.equal(rejected.allowed, false);
assert.equal(rejected.reason, "daily-quota-exhausted");
assert.equal(reservePure(last.records, candidate(101), { date, limit: LIMIT }).reason,
  "daily-quota-exhausted");

const initialVersion = "ref-1";
let authoritative = records99;
const first = applyCas(authoritative, initialVersion, initialVersion,
  current => reservePure(current, candidate(1000), { date, limit: LIMIT }).records);
authoritative = first;
assert.throws(() => applyCas(records99, initialVersion, "ref-2",
  current => reservePure(current, candidate(1001), { date, limit: LIMIT }).records),
/quota conflict/u);

const completed = reservePure([], candidate(1), { date, now: "2026-11-19T00:00:00Z" });
const completedRecords = transitionPure(completed.records, {
  identity: candidate(1).identity,
  status: "model_succeeded",
  report: "reuse-me",
  now: "2026-11-19T00:01:00Z",
}).records;
const reused = reservePure(completedRecords, candidate(1), { date });
assert.equal(reused.reused, true);
assert.equal(reused.record.report, "reuse-me");
assert.equal(consumedCount(completedRecords), 1);

const failedStart = transitionPure(reservePure([], candidate(3), { date }).records, {
  identity: candidate(3).identity,
  status: "model_started",
}).records;
const failed = transitionPure(failedStart, {
  identity: candidate(3).identity,
  status: "model_failed",
}).records;
const retry = reservePure(failed, candidate(3), { date });
assert.equal(retry.allowed, true);
assert.equal(retry.record.attempt, 2);
assert.equal(consumedCount(retry.records), 2);

const reserved = reservePure([], candidate(2), { date });
const released = transitionPure(reserved.records, {
  identity: candidate(2).identity,
  status: "released",
}).records;
assert.equal(consumedCount(released), 0);
const started = transitionPure(reserved.records, {
  identity: candidate(2).identity,
  status: "model_started",
}).records;
assert.equal(transitionPure(started, {
  identity: candidate(2).identity,
  status: "released",
}).ok, false);

assert.equal(shanghaiDate(new Date("2026-11-19T15:59:59Z")), "2026-11-19");
assert.equal(shanghaiDate(new Date("2026-11-19T16:00:00Z")), "2026-11-20");

const kodyDate = "2026-11-20";
const kodyAndroid = "OrekiDawson/AD-Oreki-Edition-Android";
const kodyWeb = "OrekiDawson/AD-Oreki-Edition-Web";
const kodyWiki = "OrekiDawson/AD-Oreki-Wiki";
assert.deepEqual(SHARED_QUOTA_REPOSITORIES, [kodyAndroid, kodyWeb]);
assert.equal(isSharedQuotaRepository(kodyAndroid), true);
assert.equal(isSharedQuotaRepository(kodyWeb), true);
assert.equal(isSharedQuotaRepository(kodyWiki), false);
const kodyEvidence = (repository, ids) => ids.map(id => ({
  repository,
  pr: 121,
  commentId: String(id),
  url: `https://example.test/${repository}/${id}`,
  createdAt: `2026-11-20T00:00:${String(id % 60).padStart(2, "0")}Z`,
}));
const kodyCandidate = (identity, repository) => ({
  identity,
  repository,
  pr: 121,
  headSha: "a".repeat(40),
});

const kodyFirst = reserveKodyPure([], kodyCandidate("trigger-a", kodyAndroid), {
  date: kodyDate,
  now: "2026-11-20T16:01:00Z",
  evidence: kodyEvidence(kodyAndroid, [1]),
});
assert.equal(kodyFirst.allowed, true);
assert.deepEqual(kodyFirst.counts, {
  used: 2,
  remaining: KODY_DAILY_LIMIT - 2,
  warning: false,
  byRepository: {
    [kodyAndroid]: 2,
  },
});

const kodyAttached = attachKodyCommand(kodyFirst.records, {
  identity: "trigger-a",
  commentId: "2",
  commentUrl: "https://example.test/comment/2",
  now: "2026-11-20T16:02:00Z",
});
assert.equal(kodyAttached.record.status, "posted");
assert.equal(kodyAttached.counts.used, 2);
// Kody 明确 skipped 的审查不计入配额；成功触发评论不等于成功审查。
const verifiedSkip = markKodySkippedPure(kodyAttached.records, {
  repository: kodyAndroid,
  pr: 121,
  headSha: "a".repeat(40),
  checkRunId: 98123,
  checkStartedAt: "2026-11-20T16:03:00Z",
  checkUrl: "https://example.test/check/98123",
  now: "2026-11-20T16:04:00Z",
});
assert.equal(verifiedSkip.ok, true);
assert.equal(verifiedSkip.reason, "kody-skipped-refunded");
assert.equal(verifiedSkip.counts.used, 1); // 保留无关、未确认跳过的评论 #1
assert.equal(verifiedSkip.records.find(item => item.commentId === "2").status, "skipped");
assert.equal(verifiedSkip.records.find(item => item.commentId === "1").status, "posted");
const skippedAgain = markKodySkippedPure(verifiedSkip.records, {
  repository: kodyAndroid,
  pr: 121,
  headSha: "a".repeat(40),
  checkRunId: 98123,
});
assert.equal(skippedAgain.reason, "already-skipped");
assert.equal(skippedAgain.records, verifiedSkip.records); // 幂等：不产生新提交
assert.equal(skippedAgain.counts.used, 1);

const observedOnly = {
  kind: KODY_KIND,
  identity: `kody-comment:${kodyAndroid}#9101`,
  repository: kodyAndroid,
  pr: 121,
  commentId: "9101",
  source: "observed_comment",
  date: kodyDate,
  status: "posted",
  createdAt: "2026-11-20T16:04:00Z",
  updatedAt: "2026-11-20T16:04:00Z",
};
const observedRecords = [observedOnly];
const observedSkip = markKodySkippedPure(observedRecords, {
  repository: kodyAndroid,
  pr: 121,
  headSha: "b".repeat(40),
  checkRunId: 98127,
  checkStartedAt: "2026-11-20T16:04:30Z",
  headCommittedAt: "2026-11-20T15:00:00Z",
  currentPullRequestHeadSha: "b".repeat(40),
  currentPullRequestHeadCommittedAt: "2026-11-20T16:00:00Z",
});
assert.equal(observedSkip.ok, true);
assert.equal(observedSkip.records[0].status, "skipped");
assert.equal(observedSkip.records[0].headSha, "b".repeat(40));

const lateRequest = markKodySkippedPure(observedRecords, {
  repository: kodyAndroid,
  pr: 121,
  headSha: "b".repeat(40),
  checkRunId: 98128,
  checkStartedAt: "2026-11-20T16:03:00Z",
  headCommittedAt: "2026-11-20T15:00:00Z",
  currentPullRequestHeadSha: "b".repeat(40),
  currentPullRequestHeadCommittedAt: "2026-11-20T16:00:00Z",
});
assert.equal(lateRequest.ok, false);
assert.equal(lateRequest.reason, "trigger-after-check");
assert.equal(lateRequest.records, observedRecords);

const oldHeadObserved = {
  ...observedOnly,
  identity: `kody-comment:${kodyAndroid}#9104`,
  commentId: "9104",
  createdAt: "2026-11-20T15:30:00Z",
};
const oldHeadSkip = markKodySkippedPure([oldHeadObserved], {
  repository: kodyAndroid,
  pr: 121,
  headSha: "c".repeat(40),
  checkRunId: 98131,
  checkStartedAt: "2026-11-20T17:00:00Z",
  headCommittedAt: "2026-11-20T16:00:00Z",
  currentPullRequestHeadSha: "d".repeat(40),
  currentPullRequestHeadCommittedAt: "2026-11-20T16:30:00Z",
});
assert.equal(oldHeadSkip.ok, false);
assert.equal(oldHeadSkip.reason, "unattributed-trigger");
assert.equal(oldHeadSkip.records[0].status, "posted");
assert.equal(oldHeadSkip.records[0].headSha, undefined);

const delayedOldHeadComment = {
  ...oldHeadObserved,
  createdAt: "2026-11-20T16:10:00Z",
};
const delayedOldHeadSkip = markKodySkippedPure([delayedOldHeadComment], {
  repository: kodyAndroid,
  pr: 121,
  headSha: "c".repeat(40),
  checkRunId: 98136,
  checkStartedAt: "2026-11-20T17:00:00Z",
  headCommittedAt: "2026-11-20T16:00:00Z",
  currentPullRequestHeadSha: "d".repeat(40),
  currentPullRequestHeadCommittedAt: "2026-11-20T16:30:00Z",
});
assert.equal(delayedOldHeadSkip.ok, true);
assert.equal(delayedOldHeadSkip.records[0].headSha, "c".repeat(40));

const futureHeadComment = {
  ...oldHeadObserved,
  createdAt: "2026-11-20T16:40:00Z",
};
const futureHeadSkip = markKodySkippedPure([futureHeadComment], {
  repository: kodyAndroid,
  pr: 121,
  headSha: "c".repeat(40),
  checkRunId: 98139,
  checkStartedAt: "2026-11-20T17:00:00Z",
  headCommittedAt: "2026-11-20T16:00:00Z",
  currentPullRequestHeadSha: "d".repeat(40),
  currentPullRequestHeadCommittedAt: "2026-11-20T16:30:00Z",
});
assert.equal(futureHeadSkip.ok, false);
assert.equal(futureHeadSkip.records[0].status, "posted");
assert.equal(futureHeadSkip.records[0].headSha, undefined);

const timelineAttributedComment = {
  ...oldHeadObserved,
  identity: `kody-comment:${kodyAndroid}#9105`,
  commentId: "9105",
  headSha: "c".repeat(40),
  createdAt: "2026-11-20T16:40:00Z",
};
const timelineAttributedSkip = markKodySkippedPure([timelineAttributedComment], {
  repository: kodyAndroid,
  pr: 121,
  headSha: "c".repeat(40),
  checkRunId: 98143,
  checkStartedAt: "2026-11-20T17:00:00Z",
  headCommittedAt: "2026-11-20T16:00:00Z",
  currentPullRequestHeadSha: "d".repeat(40),
  currentPullRequestHeadCommittedAt: "2026-11-20T16:30:00Z",
});
assert.equal(timelineAttributedSkip.ok, true);
assert.equal(timelineAttributedSkip.records[0].status, "skipped");

const racedReservation = reserveKodyPure([], kodyCandidate("raced-attach", kodyAndroid), {
  date: kodyDate,
  now: "2026-11-20T16:04:10Z",
}).records;
const racedSkip = markKodySkippedPure(racedReservation, {
  repository: kodyAndroid,
  pr: 121,
  headSha: "a".repeat(40),
  checkRunId: 98129,
  checkStartedAt: "2026-11-20T16:04:20Z",
});
const racedAttach = attachKodyCommand(racedSkip.records, {
  identity: "raced-attach",
  commentId: "9102",
  commentUrl: "https://example.test/comment/9102",
  createdAt: "2026-11-20T16:04:15Z",
  now: "2026-11-20T16:04:30Z",
});
assert.equal(racedAttach.record.status, "skipped");
assert.equal(racedAttach.record.commentId, "9102");
assert.equal(racedAttach.counts.used, 0);

const importedDuringSkipReservation =
  reserveKodyPure([], kodyCandidate("comment-import-race", kodyAndroid), {
    date: kodyDate,
    now: "2026-11-20T16:05:00Z",
  }).records;
const importedDuringSkip = reserveKodyPure(
  importedDuringSkipReservation,
  kodyCandidate("comment-import-race", kodyAndroid),
  {
    date: kodyDate,
    now: "2026-11-20T16:05:05Z",
    evidence: kodyEvidence(kodyAndroid, [9103]).map(item => ({
      ...item,
      createdAt: "2026-11-20T16:05:05Z",
    })),
  },
);
const importedThenSkipped = markKodySkippedPure(importedDuringSkip.records, {
  repository: kodyAndroid,
  pr: 121,
  headSha: "a".repeat(40),
  checkRunId: 98130,
  checkStartedAt: "2026-11-20T16:05:10Z",
  headCommittedAt: "2026-11-20T15:00:00Z",
});
const importedThenAttached = attachKodyCommand(importedThenSkipped.records, {
  identity: "comment-import-race",
  commentId: "9103",
  commentUrl: "https://example.test/comment/9103",
  createdAt: "2026-11-20T16:05:05Z",
  now: "2026-11-20T16:05:20Z",
});
assert.equal(importedThenAttached.record.status, "skipped");
assert.equal(importedThenAttached.record.skipCheckRunId, "98130");
assert.equal(importedThenAttached.counts.used, 0);

const missingStart = markKodySkippedPure(racedReservation, {
  repository: kodyAndroid,
  pr: 121,
  headSha: "a".repeat(40),
  checkRunId: 98132,
});
assert.equal(missingStart.ok, false);
assert.equal(missingStart.reason, "missing-check-start-time");
assert.equal(missingStart.records, racedReservation);
const missingCreated = markKodySkippedPure(racedReservation, {
  repository: kodyAndroid,
  pr: 121,
  headSha: "a".repeat(40),
  checkRunId: 98145,
  checkCreatedAt: "",
  checkStartedAt: "2026-11-20T16:04:30Z",
});
assert.equal(missingCreated.ok, false);
assert.equal(missingCreated.reason, "missing-check-created-time");

const idempotentEvidence = [{
  repository: kodyAndroid,
  pr: 121,
  commentId: "9200",
  url: "https://example.test/comment/9200",
  createdAt: "2026-11-20T03:06:00Z",
}];
const importedOnce = importKodyEvidence([], idempotentEvidence, kodyDate,
  "2026-11-20T03:06:01Z");
assert.equal(importedOnce.length, 1);
const importedTwice = importKodyEvidence(importedOnce, idempotentEvidence, kodyDate,
  "2026-11-20T03:06:02Z");
assert.equal(importedTwice, importedOnce);
const backfilled = importKodyEvidence(importedOnce, [{
  ...idempotentEvidence[0],
  headSha: "c".repeat(40),
}], kodyDate, "2026-11-20T03:06:03Z");
assert.equal(backfilled.length, 1);
assert.equal(backfilled[0].headSha, "c".repeat(40));

const pendingIdentity = {
  repository: kodyAndroid,
  pr: 121,
  headSha: "a".repeat(40),
  checkRunId: 98140,
  checkStartedAt: "2026-11-20T06:00:00Z",
};
const pendingOnce = queuePendingKodySkip([], pendingIdentity, "unattributed-trigger",
  "2026-11-20T06:00:01Z");
assert.equal(pendingOnce.length, 1);
assert.equal(pendingOnce[0].kind, KODY_SKIP_PENDING_KIND);
assert.equal(pendingOnce[0].status, "pending_attribution");
assert.equal(kodyQuotaCounts(pendingOnce, kodyDate).used, 0);
const pendingTwice = queuePendingKodySkip(pendingOnce, pendingIdentity,
  "unattributed-trigger", "2026-11-20T06:00:02Z");
assert.equal(pendingTwice, pendingOnce);
assert.equal(clearPendingKodySkip(pendingOnce, "missing"), pendingOnce);

const shadowReservation = reserveKodyPure([], kodyCandidate("shadow-reservation", kodyAndroid), {
  date: kodyDate,
  now: "2026-11-20T06:06:00Z",
}).records;
const shadowEvidence = reserveKodyPure(shadowReservation,
  kodyCandidate("shadow-reservation", kodyAndroid), {
    date: kodyDate,
    now: "2026-11-20T06:06:05Z",
    evidence: [
      { ...kodyEvidence(kodyAndroid, [9201])[0], createdAt: "2026-11-20T06:06:05Z" },
      { ...kodyEvidence(kodyAndroid, [9202])[0], createdAt: "2026-11-20T06:07:00Z" },
    ],
  });
const newerManualSkip = markKodySkippedPure(shadowEvidence.records, {
  repository: kodyAndroid,
  pr: 121,
  headSha: "a".repeat(40),
  checkRunId: 98137,
  checkStartedAt: "2026-11-20T06:07:10Z",
  headCommittedAt: "2026-11-20T05:00:00Z",
  currentPullRequestHeadSha: "a".repeat(40),
  priorRealReviews: [{
    startedAt: "2026-11-20T06:06:30Z",
    commentId: "9201",
  }],
});
assert.equal(newerManualSkip.ok, true, newerManualSkip.reason);
assert.equal(newerManualSkip.records.find(record => record.commentId === "9201").status,
  "posted");
assert.equal(newerManualSkip.records.find(record => record.commentId === "9202").status,
  "skipped");
assert.equal(newerManualSkip.counts.used, 2);
const automaticAttachAfterManualSkip = attachKodyCommand(newerManualSkip.records, {
  identity: "shadow-reservation",
  commentId: "9201",
  commentUrl: "https://example.test/comment/9201",
  createdAt: "2026-11-20T06:06:05Z",
  now: "2026-11-20T06:07:20Z",
});
assert.equal(automaticAttachAfterManualSkip.record.status, "posted");
assert.equal(automaticAttachAfterManualSkip.counts.used, 1);

const oldAutomaticRequest = {
  ...observedOnly,
  identity: `kody-trigger:${kodyAndroid}#121@${"a".repeat(40)}`,
  headSha: "a".repeat(40),
  commentId: "9300",
  source: "automated_trigger",
  createdAt: "2026-11-20T04:00:00Z",
};
const newerManualRequest = {
  ...observedOnly,
  identity: `kody-comment:${kodyAndroid}#9301`,
  commentId: "9301",
  createdAt: "2026-11-20T04:05:00Z",
};
const manualNotShadowed = markKodySkippedPure(
  [oldAutomaticRequest, newerManualRequest],
  {
    repository: kodyAndroid,
    pr: 121,
    headSha: "a".repeat(40),
    checkRunId: 98138,
    checkStartedAt: "2026-11-20T04:06:00Z",
    headCommittedAt: "2026-11-20T03:00:00Z",
    currentPullRequestHeadSha: "a".repeat(40),
    priorRealReviews: [{
      startedAt: "2026-11-20T04:01:00Z",
      commentId: "9300",
    }],
  },
);
assert.equal(manualNotShadowed.ok, true);
assert.equal(manualNotShadowed.records.find(record => record.commentId === "9300").status,
  "posted");
assert.equal(manualNotShadowed.records.find(record => record.commentId === "9301").status,
  "skipped");

const skipFirst = attachKodyCommand(
  reserveKodyPure([], kodyCandidate("same-head-first", kodyAndroid), {
    date: kodyDate,
    now: "2026-11-20T00:00:05Z",
  }).records,
  {
    identity: "same-head-first",
    commentId: "9001",
    createdAt: "2026-11-20T00:00:10Z",
  },
);
const skipLater = attachKodyCommand(
  reserveKodyPure(skipFirst.records, kodyCandidate("same-head-later", kodyAndroid), {
    date: kodyDate,
    now: "2026-11-20T00:00:15Z",
  }).records,
  {
    identity: "same-head-later",
    commentId: "9004",
    createdAt: "2026-11-20T00:00:20Z",
  },
);
const createdBeforeLaterRequest = markKodySkippedPure(skipLater.records, {
  repository: kodyAndroid,
  pr: 121,
  headSha: "a".repeat(40),
  checkRunId: 98144,
  checkCreatedAt: "2026-11-20T00:00:15Z",
  checkStartedAt: "2026-11-20T00:00:30Z",
});
assert.equal(createdBeforeLaterRequest.ok, true);
assert.equal(
  createdBeforeLaterRequest.records.find(record => record.commentId === "9001").status,
  "skipped",
);
assert.equal(
  createdBeforeLaterRequest.records.find(record => record.commentId === "9004").status,
  "posted",
);
const skipSecond = attachKodyCommand(
  reserveKodyPure(skipFirst.records, kodyCandidate("same-head-second", kodyAndroid), {
    date: kodyDate,
    now: "2026-11-20T00:00:15Z",
  }).records,
  {
    identity: "same-head-second",
    commentId: "9002",
    createdAt: "2026-11-20T00:00:20Z",
  },
);
const oneSkipRefund = markKodySkippedPure(skipSecond.records, {
  repository: kodyAndroid,
  pr: 121,
  headSha: "a".repeat(40),
  checkRunId: 98125,
  checkStartedAt: "2026-11-20T00:00:30Z",
});
assert.equal(oneSkipRefund.ok, true);
assert.equal(oneSkipRefund.records.find(record => record.commentId === "9001").status, "posted");
assert.equal(oneSkipRefund.records.find(record => record.commentId === "9002").status, "skipped");
assert.equal(oneSkipRefund.counts.used, 1);

const skipThird = attachKodyCommand(
  reserveKodyPure(oneSkipRefund.records, kodyCandidate("same-head-third", kodyAndroid), {
    date: kodyDate,
    now: "2026-11-20T00:00:35Z",
  }).records,
  {
    identity: "same-head-third",
    commentId: "9003",
    createdAt: "2026-11-20T00:00:40Z",
  },
);
const replayedSkip = markKodySkippedPure(skipThird.records, {
  repository: kodyAndroid,
  pr: 121,
  headSha: "a".repeat(40),
  checkRunId: 98125,
  checkStartedAt: "2026-11-20T00:00:30Z",
});
assert.equal(replayedSkip.reason, "already-skipped");
assert.equal(replayedSkip.records, skipThird.records);
assert.equal(replayedSkip.records.find(record => record.commentId === "9003").status, "posted");

const reviewedBeforeSkip = markKodySkippedPure(skipFirst.records, {
  repository: kodyAndroid,
  pr: 121,
  headSha: "a".repeat(40),
  checkRunId: 98126,
  checkStartedAt: "2026-11-20T00:00:30Z",
  priorRealReviews: [{
    startedAt: "2026-11-20T00:00:15Z",
    commentId: "9001",
  }],
});
assert.equal(reviewedBeforeSkip.ok, false);
assert.equal(reviewedBeforeSkip.reason, "prior-real-kody-review");
assert.equal(reviewedBeforeSkip.records, skipFirst.records);

const unattributedEarlierReview = markKodySkippedPure(skipFirst.records, {
  repository: kodyAndroid,
  pr: 121,
  headSha: "a".repeat(40),
  checkRunId: 98141,
  checkStartedAt: "2026-11-20T00:00:30Z",
  priorRealReviews: [{
    startedAt: "2026-11-20T00:00:05Z",
    commentId: "",
  }],
});
assert.equal(unattributedEarlierReview.ok, true);
assert.equal(unattributedEarlierReview.records[0].status, "skipped");

const unattributedTargetReview = markKodySkippedPure(skipFirst.records, {
  repository: kodyAndroid,
  pr: 121,
  headSha: "a".repeat(40),
  checkRunId: 98142,
  checkStartedAt: "2026-11-20T00:00:30Z",
  priorRealReviews: [{
    startedAt: "2026-11-20T00:00:20Z",
    commentId: "",
  }],
});
assert.equal(unattributedTargetReview.ok, false);
assert.equal(unattributedTargetReview.reason, "prior-real-kody-review");

const sameTimeReview = markKodySkippedPure(skipFirst.records, {
  repository: kodyAndroid,
  pr: 121,
  headSha: "a".repeat(40),
  checkRunId: 98133,
  checkStartedAt: "2026-11-20T00:00:30Z",
  priorRealReviews: [{
    startedAt: "2026-11-20T00:00:10Z",
    commentId: "9001",
  }],
});
assert.equal(sameTimeReview.ok, false);
assert.equal(sameTimeReview.reason, "prior-real-kody-review");

const otherRequestStillRefunds = markKodySkippedPure(skipSecond.records, {
  repository: kodyAndroid,
  pr: 121,
  headSha: "a".repeat(40),
  checkRunId: 98134,
  checkStartedAt: "2026-11-20T00:00:30Z",
  priorRealReviews: [{
    startedAt: "2026-11-20T00:00:15Z",
    commentId: "9001",
  }],
});
assert.equal(otherRequestStillRefunds.ok, true);
assert.equal(
  otherRequestStillRefunds.records.find(record => record.commentId === "9002").status,
  "skipped",
);

assert.throws(() => markKodySkippedPure(kodyAttached.records, {
  repository: kodyAndroid, pr: 121, headSha: "invalid", checkRunId: 98123,
}), /invalid verified/u);
const unrelatedSkip = markKodySkippedPure(verifiedSkip.records, {
  repository: kodyWeb, pr: 121, headSha: "a".repeat(40), checkRunId: 98124,
});
assert.equal(unrelatedSkip.ok, false);
assert.equal(unrelatedSkip.records, verifiedSkip.records);
assert.equal(kodyQuotaCounts(kodyAttached.records, kodyDate).used, 2); // 真实未跳过的审查仍占位
const refundedCapacity = reserveKodyPure(verifiedSkip.records,
  kodyCandidate("after-skip", kodyWeb), { date: kodyDate });
assert.equal(refundedCapacity.counts.used, 2); // 退额后可重新申请

const kodyAttachedAgain = attachKodyCommand(kodyAttached.records, {
  identity: "trigger-a",
  commentId: "2",
  commentUrl: "https://example.test/comment/2",
});
assert.equal(kodyAttachedAgain.ok, true);
assert.equal(kodyAttachedAgain.counts.used, 2);
assert.equal(kodyAttachedAgain.records.length, kodyAttached.records.length);

const observedDuringAttach = [
  ...kodyFirst.records,
  {
    kind: KODY_KIND,
    identity: `kody-comment:${kodyAndroid}#2`,
    repository: kodyAndroid,
    commentId: "2",
    source: "observed_comment",
    date: kodyDate,
    status: "posted",
  },
];
const mergedAttach = attachKodyCommand(observedDuringAttach, {
  identity: "trigger-a",
  commentId: "2",
  now: "2026-11-20T00:03:00Z",
});
assert.equal(mergedAttach.counts.used, 2);
assert.equal(mergedAttach.records.filter(record =>
  record.kind === KODY_KIND && record.commentId === "2").length, 1);
const wrongDayEvidence = reserveKodyPure([], kodyCandidate("wrong-day", kodyWeb), {
  date: "2026-11-21",
  evidence: kodyEvidence(kodyWeb, [4000]),
});
assert.equal(wrongDayEvidence.counts.used, 1);

const orphanReservation = reserveKodyPure([], kodyCandidate("orphan", kodyAndroid), {
  date: kodyDate,
  now: "2026-11-20T00:04:00Z",
}).records;
const recoveredOrphan = reserveKodyPure(orphanReservation, kodyCandidate("orphan", kodyAndroid), {
  date: kodyDate,
  now: "2026-11-20T00:05:00Z",
  evidence: [{
    ...kodyEvidence(kodyAndroid, [5000])[0],
    createdAt: "2026-11-20T00:04:30Z",
  }],
});
assert.equal(recoveredOrphan.reason, "identity-in-progress");
assert.equal(recoveredOrphan.counts.used, 2);
assert.equal(recoveredOrphan.record.commentId, "");
assert.equal(recoveredOrphan.records.filter(record =>
  record.kind === KODY_KIND && record.commentId === "5000").length, 1);

const laterCommentsReservation = reserveKodyPure([], kodyCandidate("later-comments", kodyAndroid), {
  date: kodyDate,
  now: "2026-11-20T00:06:00Z",
}).records;
const laterComments = reserveKodyPure(
  laterCommentsReservation,
  kodyCandidate("later-comments", kodyAndroid),
  {
    date: kodyDate,
    now: "2026-11-20T00:07:00Z",
    evidence: [
      { ...kodyEvidence(kodyAndroid, [5001])[0], createdAt: "2026-11-20T00:06:20Z" },
      { ...kodyEvidence(kodyAndroid, [5002])[0], createdAt: "2026-11-20T00:06:40Z" },
    ],
  },
);
assert.equal(laterComments.reason, "identity-in-progress");
assert.equal(laterComments.counts.used, 3);
assert.equal(laterComments.records.filter(record =>
  record.kind === KODY_KIND && ["5001", "5002"].includes(record.commentId)).length, 2);

const occupiedComment = attachKodyCommand(
  reserveKodyPure([], kodyCandidate("other-head", kodyAndroid), {
    date: kodyDate,
    now: "2026-11-20T00:07:10Z",
  }).records,
  { identity: "other-head", commentId: "5003", createdAt: "2026-11-20T00:07:26Z" },
);
const staleReservation = reserveKodyPure([], kodyCandidate("stale-head", kodyAndroid), {
  date: kodyDate,
  now: "2026-11-20T00:07:25Z",
}).records;
const notClaimed = reserveKodyPure([...occupiedComment.records, ...staleReservation],
  kodyCandidate("stale-head", kodyAndroid), {
  date: kodyDate,
  now: "2026-11-20T00:07:30Z",
  evidence: [{ ...kodyEvidence(kodyAndroid, [5003])[0], createdAt: "2026-11-20T00:07:26Z" }],
});
assert.equal(notClaimed.reason, "identity-in-progress");
assert.equal(notClaimed.counts.used, 2);

const midnightReservation = reserveKodyPure([], kodyCandidate("midnight", kodyWeb), {
  date: "2026-11-20",
  now: "2026-11-20T15:59:59Z",
}).records;
const midnightAttached = attachKodyCommand(midnightReservation, {
  identity: "midnight",
  commentId: "6000",
  createdAt: "2026-11-20T16:00:01Z",
});
assert.equal(midnightAttached.record.date, "2026-11-21");
assert.equal(kodyQuotaCounts(midnightAttached.records, "2026-11-20").used, 0);
assert.equal(kodyQuotaCounts(midnightAttached.records, "2026-11-21").used, 1);

const midnightOrphan = reserveKodyPure([], kodyCandidate("midnight-orphan", kodyWeb), {
  date: "2026-11-20",
  now: "2026-11-20T15:59:58Z",
}).records;
const midnightRecovered = reserveKodyPure(
  midnightOrphan,
  kodyCandidate("midnight-orphan", kodyWeb),
  {
    date: "2026-11-21",
    now: "2026-11-20T16:00:02Z",
    evidence: [{ ...kodyEvidence(kodyWeb, [6001])[0], createdAt: "2026-11-20T16:00:01Z" }],
  },
);
assert.equal(midnightRecovered.reason, "identity-in-progress");
assert.equal(midnightRecovered.record.date, "2026-11-20");
assert.equal(kodyQuotaCounts(midnightRecovered.records, "2026-11-20").used, 1);
assert.equal(kodyQuotaCounts(midnightRecovered.records, "2026-11-21").used, 1);

const kodyDuplicate = reserveKodyPure(kodyAttached.records, kodyCandidate("trigger-b", kodyWeb), {
  date: kodyDate,
  evidence: kodyEvidence(kodyAndroid, [1, 2]),
});
assert.equal(kodyDuplicate.allowed, true);
assert.equal(kodyDuplicate.counts.used, 3);
assert.deepEqual(kodyDuplicate.counts.byRepository, {
  [kodyAndroid]: 2,
  [kodyWeb]: 1,
});

const kodyReleased = releaseKodyCommand(kodyDuplicate.records, {
  identity: "trigger-b",
});
assert.equal(kodyReleased.ok, true);
assert.equal(kodyReleased.counts.used, 2);

const seventyNine = reserveKodyPure([], kodyCandidate("warning-seed", kodyWeb), {
  date: kodyDate,
  evidence: kodyEvidence(kodyWeb, Array.from({ length: KODY_WARNING_AT - 2 },
    (_, index) => 1000 + index)),
});
assert.equal(seventyNine.counts.used, 79);
assert.equal(seventyNine.counts.warning, false);
const eighty = reserveKodyPure(seventyNine.records, kodyCandidate("warning-hit", kodyAndroid), {
  date: kodyDate,
});
assert.equal(eighty.allowed, true);
assert.equal(eighty.counts.used, KODY_WARNING_AT);
assert.equal(eighty.counts.warning, true);

const full = reserveKodyPure([], kodyCandidate("boundary-hit", kodyAndroid), {
  date: kodyDate,
  evidence: kodyEvidence(kodyAndroid, Array.from({ length: KODY_DAILY_LIMIT - 1 },
    (_, index) => 2000 + index)),
});
assert.equal(full.allowed, true);
assert.equal(full.counts.used, KODY_DAILY_LIMIT);
assert.equal(full.counts.remaining, 0);
assert.deepEqual(full.counts.byRepository, {
  [kodyAndroid]: KODY_DAILY_LIMIT,
});
const blocked = reserveKodyPure(full.records, kodyCandidate("boundary-blocked", kodyWeb), {
  date: kodyDate,
  evidence: kodyEvidence(kodyAndroid, Array.from({ length: KODY_DAILY_LIMIT - 1 },
    (_, index) => 2000 + index)),
});
assert.equal(blocked.allowed, false);
assert.equal(blocked.reason, "daily-quota-exhausted");
assert.equal(blocked.counts.used, KODY_DAILY_LIMIT);

const wikiOnly = reserveKodyPure([], kodyCandidate("wiki-only", kodyWiki), {
  date: kodyDate,
  evidence: kodyEvidence(kodyWiki, [7000, 7001]),
});
assert.equal(wikiOnly.allowed, false);
assert.equal(wikiOnly.reason, "not-shared-quota-repository");
assert.equal(wikiOnly.counts.used, 0);
assert.equal(wikiOnly.records.some(record => record.repository === kodyWiki), false);

// 历史状态中即使存在误入的 Wiki 记录，也必须保留原记录但不从共享池扣减。
const wikiHistoricalRecord = {
  kind: KODY_KIND,
  identity: `kody-comment:${kodyWiki}#8000`,
  repository: kodyWiki,
  pr: 121,
  commentId: "8000",
  source: "observed_comment",
  date: kodyDate,
  status: "posted",
};
const sharedWithWikiHistory = reserveKodyPure(
  [wikiHistoricalRecord],
  kodyCandidate("shared-last-slot", kodyWeb),
  {
    date: kodyDate,
    evidence: kodyEvidence(kodyAndroid, Array.from({ length: 99 }, (_, index) => 7100 + index)),
  },
);
assert.equal(sharedWithWikiHistory.allowed, true);
assert.equal(sharedWithWikiHistory.counts.used, KODY_DAILY_LIMIT);
assert.equal(sharedWithWikiHistory.counts.byRepository[kodyWiki], undefined);
assert.equal(sharedWithWikiHistory.records.some(record =>
  record.identity === wikiHistoricalRecord.identity), true);

const wikiWhenSharedPoolFull = reserveKodyPure(
  sharedWithWikiHistory.records,
  kodyCandidate("wiki-during-full-pool", kodyWiki),
  { date: kodyDate },
);
assert.equal(wikiWhenSharedPoolFull.allowed, false);
assert.equal(wikiWhenSharedPoolFull.reason, "not-shared-quota-repository");
assert.equal(wikiWhenSharedPoolFull.counts.used, KODY_DAILY_LIMIT);
assert.equal(wikiWhenSharedPoolFull.records.length, sharedWithWikiHistory.records.length);
assert.throws(() => reserveKodyPure([], kodyCandidate("bad-evidence", kodyWeb), {
  date: kodyDate,
  evidence: [{
    repository: "unknown/repository",
    pr: 121,
    commentId: "9999",
    url: "https://example.test/9999",
    createdAt: "2026-11-20T00:00:00Z",
  }],
}), /unrecognized Kody quota evidence repository/u);

const kodyBase = reserveKodyPure([], kodyCandidate("cas-seed", kodyWeb), {
  date: kodyDate,
  evidence: kodyEvidence(kodyWeb, Array.from({ length: 99 }, (_, index) => 3000 + index)),
}).records;
const casAuthority = applyCas(kodyBase, "ref-kody-1", "ref-kody-1",
  records => reserveKodyPure(records, kodyCandidate("cas-android", kodyAndroid), {
    date: kodyDate,
  }).records);
assert.throws(() => applyCas(kodyBase, "ref-kody-1", "ref-kody-2",
  records => reserveKodyPure(records, kodyCandidate("cas-web", kodyWeb), {
    date: kodyDate,
  }).records), /quota conflict/u);
assert.equal(kodyQuotaCounts(casAuthority, kodyDate).used, 100);
assert.equal(reserveKodyPure(casAuthority, kodyCandidate("cas-web-retry", kodyWeb), {
  date: kodyDate,
}).reason, "daily-quota-exhausted");

const nextDay = reserveKodyPure(casAuthority, kodyCandidate("next-day", kodyWeb), {
  date: "2026-11-21",
});
assert.equal(nextDay.allowed, true);
assert.equal(nextDay.counts.used, 1);
assert.equal(nextDay.counts.remaining, 99);
assert.equal(consumedCount(casAuthority), 0);
assert.equal(reservePure(casAuthority, candidate(500), {
  date: kodyDate,
  limit: LIMIT,
}).allowed, true);

console.log("PASS  R121-01 Kody 双仓全局共享配额夹具");
