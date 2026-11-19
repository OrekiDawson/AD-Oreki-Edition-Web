#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  findingBody,
  findingLocationValid,
  validDiffLines,
} from "../../.github/codex/publish-review.mjs";

const files = [
  {
    filename: "src/example.js",
    patch: [
      "@@ -10,3 +10,4 @@",
      " const before = 1;",
      "-const oldValue = 2;",
      "+const newValue = 3;",
      "+const added = 4;",
      " const after = 5;",
    ].join("\n"),
  },
  {
    filename: "app/src/main/kotlin/Example.kt",
    patch: [
      "@@ -1,1 +1,2 @@",
      " class Example",
      "+fun added() = Unit",
    ].join("\n"),
  },
];
const lines = validDiffLines(files);
assert.equal(findingLocationValid({ path: "src/example.js", line: 11, side: "RIGHT" }, lines), true);
assert.equal(findingLocationValid({
  path: "src/example.js",
  start_line: 11,
  line: 12,
  side: "RIGHT",
}, lines), true);
assert.equal(findingLocationValid({ path: "src/example.js", line: 13, side: "LEFT" }, lines), false);
assert.equal(findingLocationValid({
  path: "app/src/main/kotlin/Example.kt",
  line: 2,
  side: "RIGHT",
}, lines), true);
assert.equal(findingLocationValid({ path: "missing.js", line: 1, side: "RIGHT" }, lines), false);

const body = findingBody({
  severity: "high",
  title: "边界错误",
  reason: "通知 @owner 且值可能越界",
  trigger: "输入为 0",
  fix: "钳制最小值",
  suggestion: "const value = '@safe'.length + Math.max(1, input);",
});
assert.match(body, /```suggestion/);
assert.match(body, /Math\.max/);
assert.match(body, /@\u200bowner/);
assert.match(body, /'@safe'/);

console.log("PASS  R120-01 GitHub Review 定位与 suggestion 夹具");
