#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  LIMIT,
  applyCas,
  consumedCount,
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

console.log("PASS  R120-01 双仓共享审查配额夹具");
