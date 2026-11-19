#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mergeBatchResults } from "../../.github/codex/review-batches.mjs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "review-batches-"));
const plan = {
  sourceFiles: ["a.js", "b.js"],
  excludedFiles: [],
  batchCount: 2,
  head: "head",
  peerSha: "peer",
  batches: [
    { id: "b01", oversized: [], files: [{ path: "a.js", includedHunks: [1] }] },
    { id: "b02", oversized: [], files: [{ path: "b.js", includedHunks: [1, 2] }] },
  ],
};

fs.writeFileSync(path.join(tmp, "meta-b01.json"), JSON.stringify({
  status: "success", reason: "model_succeeded", modelStarted: true,
}));
fs.writeFileSync(path.join(tmp, "batch-b01.json"), JSON.stringify({
  status: "complete",
  summary: "one",
  findings: [{
    severity: "medium", path: "a.js", line: 1, side: "RIGHT",
    title: "duplicate", reason: "r", trigger: "t", fix: "f",
  }],
  unmapped_findings: [],
  covered_files: ["a.js"],
  uncovered_files: [],
}));

const partial = mergeBatchResults(plan, tmp);
assert.equal(partial.status, "partial");
assert.deepEqual(partial.uncovered_files, ["b.js"]);
assert.equal(partial.model_calls, 1);

fs.writeFileSync(path.join(tmp, "meta-b02.json"), JSON.stringify({
  status: "reused", reason: "model_succeeded", modelStarted: false,
}));
fs.writeFileSync(path.join(tmp, "batch-b02.json"), JSON.stringify({
  status: "complete",
  summary: "two",
  findings: [{
    severity: "medium", path: "a.js", line: 1, side: "RIGHT",
    title: "duplicate", reason: "different copy", trigger: "t", fix: "f",
  }],
  unmapped_findings: [],
  covered_files: ["b.js"],
  uncovered_files: [],
}));

const complete = mergeBatchResults(plan, tmp);
assert.equal(complete.status, "complete");
assert.deepEqual(complete.covered_files, ["a.js", "b.js"]);
assert.deepEqual(complete.uncovered_files, []);
assert.equal(complete.findings.length, 1);
assert.equal(complete.model_calls, 1, "复用结果不得重复计入模型调用");
assert.equal(complete.coverage.find(file => file.path === "b.js").covered_hunks.length, 2);
const uncertainPlan = structuredClone(plan);
uncertainPlan.classification = {
  manualRequired: true,
  uncertainFiles: ["src/core/new-rule.js"],
};
const uncertain = mergeBatchResults(uncertainPlan, tmp);
assert.equal(uncertain.status, "partial");
assert.deepEqual(uncertain.uncertain_files, ["src/core/new-rule.js"]);

const failing = structuredClone(plan);
failing.batchCount = 1;
failing.batches = [{
  id: "b01",
  oversized: ["large.js"],
  files: [{ path: "a.js", includedHunks: [1] }, { path: "large.js", includedHunks: [1] }],
}];
const failingDir = fs.mkdtempSync(path.join(os.tmpdir(), "review-batches-"));
fs.writeFileSync(path.join(failingDir, "meta-b01.json"), JSON.stringify({
  status: "success", reason: "model_succeeded", modelStarted: true,
}));
fs.writeFileSync(path.join(failingDir, "batch-b01.json"), JSON.stringify({
  status: "complete",
  summary: "claims complete",
  findings: [],
  unmapped_findings: [],
  covered_files: ["a.js", "large.js"],
  uncovered_files: [],
}));
const oversized = mergeBatchResults(failing, failingDir);
assert.equal(oversized.status, "partial", "超大 hunk 不得被静默计为完整覆盖");
assert.match(oversized.summary, /large\.js/);
const missingDir = fs.mkdtempSync(path.join(os.tmpdir(), "review-batches-"));
const unknown = mergeBatchResults({
  sourceFiles: ["a.js"],
  excludedFiles: [],
  batchCount: 1,
  head: "head",
  batches: [{ id: "b01", oversized: [], files: [{ path: "a.js", includedHunks: [1] }] }],
}, missingDir);
assert.equal(unknown.status, "failed", "批次产物整体缺失时不得伪装成未执行");

console.log("PASS  R120-01 审查批次规划与聚合夹具");
