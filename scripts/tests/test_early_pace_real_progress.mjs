import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { aggregateAutomation } from "../../scripts/gen_tutorial_module.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = relative => fs.readFileSync(path.join(ROOT, relative), "utf8");

test("首次 Break 前按真实无限次数增长 IP，不直接补资源", () => {
  const game = read("src/game.js");
  assert.match(game, /player\.infinities\.add\(1\)/);
  assert.doesNotMatch(game, /firstInfinityDimensionBoostActive/);
  assert.doesNotMatch(game, /ip\.max\(DC\.E8\)/);
});

test("间隔升级只按真实 IP 余额购买", () => {
  const gate = read("src/core/oreki-break-infinity-gate.js");
  assert.match(gate, /bc\.upgradeInterval\(false\)/);
  assert.doesNotMatch(gate, /Currency\.infinityPoints\.add\(/);
  assert.doesNotMatch(gate, /grantedThisSession/);
});

test("教程不再宣称自动补足 IP", () => {
  const tutorialText = read("src/core/oreki-tutorial-data.json");
  const tutorial = JSON.parse(tutorialText);
  const appendix = tutorial.appendices.find(item => item.id === "apx_automation");
  const appendixBody = aggregateAutomation(tutorial.chapters);

  assert.ok(appendix, "自动化总览附录必须存在");
  assert.equal(appendix.auto, "automation", "总览正文必须由各章 automation 字段生成");
  assert.equal(Object.hasOwn(appendix, "body"), false, "总览正文不得写回源 JSON");
  assert.doesNotMatch(tutorialText, /本作会直接把余额补到 32767/);
  assert.doesNotMatch(tutorialText, /由本作单独补足/);
  assert.doesNotMatch(appendixBody, /单次坍缩收益兜到 1e8/);
  assert.match(appendixBody, /真实大坍缩条件/);
  assert.match(appendixBody, /不直接增加无限次数或无限点数/);
});

