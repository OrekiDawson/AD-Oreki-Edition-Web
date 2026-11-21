#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  KODY_DAILY_LIMIT,
  KODY_KIND,
  KODY_WARNING_AT,
  LIMIT,
  SHARED_QUOTA_REPOSITORIES,
  applyCas,
  attachKodyCommand,
  consumedCount,
  isSharedQuotaRepository,
  kodyQuotaCounts,
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
