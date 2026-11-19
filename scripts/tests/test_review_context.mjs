#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  REPOS,
  classify,
  buildPeerContext,
  extractRelevant,
  planPatchBatches,
  splitPatchHunks,
} from "../../.github/codex/review-context.mjs";

const androidScheduler = classify("android", [
  "app/src/main/kotlin/kajfosz/antimatterdimensions/oreki/OrekiAutomationScheduler.kt",
]);
assert.equal(androidScheduler.crossRepo, true);
assert.equal(androidScheduler.peerRepo, REPOS.web);
assert.deepEqual(androidScheduler.categories, ["scheduler"]);
assert.ok(androidScheduler.peerFiles.includes("src/core/oreki-smart-executor.js"));

const webScheduler = classify("web", ["src/core/oreki-smart-executor.js"]);
assert.equal(webScheduler.crossRepo, true);
assert.equal(webScheduler.peerRepo, REPOS.android);
assert.ok(webScheduler.peerFiles.some(file => file.endsWith("OrekiAutomationScheduler.kt")));

const uiOnly = classify("web", ["src/components/tabs/options-gameplay/OptionsGameplayTab.js"]);
assert.equal(uiOnly.crossRepo, false);
assert.equal(uiOnly.manualRequired, false);

const uncertain = classify("web", ["src/core/new-unknown-game-rule.js"]);
assert.equal(uncertain.crossRepo, false);
assert.equal(uncertain.manualRequired, true);
assert.deepEqual(uncertain.uncertainFiles, ["src/core/new-unknown-game-rule.js"]);

const excerpt = extractRelevant([
  "const unrelated = 1;",
  "export const INTERVAL_DEFAULT_SEC = 10;",
  "function setIntervalSec(value) {",
  "  return value;",
  "}",
].join("\n"), { maxBytes: 500, contextLines: 1 });
assert.match(excerpt.text, /INTERVAL_DEFAULT_SEC = 10/);
assert.match(excerpt.text, /setIntervalSec/);

const skipped = await buildPeerContext({
  classification: uiOnly,
  token: "not-used",
  owner: "OrekiDawson",
  peerSha: "abc",
});
assert.match(skipped.text, /CROSS_REPO=false/);
assert.match(skipped.text, /未读取对端仓库/);
assert.deepEqual(skipped.filesRead, []);

const firstPatch = [
  "diff --git a/src/a.js b/src/a.js\n",
  "--- a/src/a.js\n",
  "+++ b/src/a.js\n",
  "@@ -1 +1 @@\n",
  "-old-a\n",
  "+new-a\n",
  "@@ -20 +20 @@\n",
  "-old-a2\n",
  "+new-a2\n",
].join("");
const secondPatch = [
  "diff --git a/src/b.js b/src/b.js\n",
  "--- a/src/b.js\n",
  "+++ b/src/b.js\n",
  "@@ -1 +1 @@\n",
  "-old-b\n",
  "+new-b\n",
].join("");
assert.equal(splitPatchHunks(firstPatch).hunks.length, 2);
const batches = planPatchBatches("web", [
  { path: "src/a.js", patch: firstPatch },
  { path: "src/b.js", patch: secondPatch },
], 120);
assert.ok(batches.batches.length >= 2);
assert.equal(batches.batches.map(batch => batch.text).join("")
  .match(/new-a2/gu).length, 1);
assert.equal(batches.batches.map(batch => batch.text).join("")
  .match(/new-b/gu).length, 1);
for (const batch of batches.batches) {
  for (const file of batch.files) {
    assert.ok(file.includedHunks.length >= 1);
  }
}
const oversized = planPatchBatches("web", [
  { path: "src/a.js", patch: firstPatch },
], 32, ["src/a.js", "docs/deleted-evidence.md"]);
assert.ok(oversized.batches.every(batch => batch.oversized.includes("src/a.js")));
assert.match(oversized.batches.map(batch => batch.text).join(""), /new-a2/);
assert.deepEqual(oversized.emptyFiles, ["docs/deleted-evidence.md"]);
const emptyFilePlan = planPatchBatches("web", [
  { path: "src/a.js", patch: firstPatch },
], 120, ["src/a.js", "src/empty.js"]);
assert.deepEqual(emptyFilePlan.emptyFiles, ["src/empty.js"]);
const noHunk = planPatchBatches("web", [{
  path: "src/binary.bin",
  patch: "diff --git a/src/binary.bin b/src/binary.bin\nBinary files differ\n",
}], 120, ["src/binary.bin"]);
assert.equal(noHunk.batches.length, 0);
assert.deepEqual(noHunk.unreviewableFiles, ["src/binary.bin"]);
assert.deepEqual(noHunk.emptyFiles, ["src/binary.bin"]);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "review-context-"));
const file = path.join(tmp, "files.txt");
fs.writeFileSync(file, "src/core/oreki-smart-executor.js\nsrc/components/only-ui.js\n");
assert.ok(fs.readFileSync(file, "utf8").includes("oreki-smart-executor"));

console.log("PASS  R120-01 跨仓审查分类与上下文夹具");
