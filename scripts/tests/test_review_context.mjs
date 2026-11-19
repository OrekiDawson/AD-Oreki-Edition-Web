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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "review-context-"));
const file = path.join(tmp, "files.txt");
fs.writeFileSync(file, "src/core/oreki-smart-executor.js\nsrc/components/only-ui.js\n");
assert.ok(fs.readFileSync(file, "utf8").includes("oreki-smart-executor"));

console.log("PASS  R120-01 跨仓审查分类与上下文夹具");
