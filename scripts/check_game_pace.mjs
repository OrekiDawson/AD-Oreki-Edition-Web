#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const speed = fs.readFileSync(path.join(ROOT, "src/core/speed-config.js"), "utf8");
const options = fs.readFileSync(
  path.join(ROOT, "src/components/tabs/options-gameplay/OptionsGameplayTab.js"),
  "utf8",
);
const tutorial = JSON.parse(fs.readFileSync(
  path.join(ROOT, "src/core/oreki-tutorial-data.json"), "utf8",
));
const tutorialText = JSON.stringify(tutorial);
const reality = fs.readFileSync(path.join(ROOT, "src/core/reality.js"), "utf8");
const eternity = fs.readFileSync(
  path.join(ROOT, "src/core/oreki-eternity-automation.js"),
  "utf8",
);

assert.match(speed, /export const GAME_SPEED_DEFAULT = 1000;/);
assert.match(speed, /export const GAME_SPEED_POST_BREAK = 1800;/);
assert.match(speed, /export const GAME_SPEED_POST_REALITY = 3000;/);
assert.match(speed, /export const GAME_SPEED_MAX = 100000;/);
assert.match(speed, /let dynamicEnabled = readStoredFlag\(DYNAMIC_KEY, true\);/);
assert.match(speed, /tickProgressionSpeed\(\)/);
assert.match(speed, /progressionSpeedForState\(p\.break === true, p\.realities\)/);
assert.match(options, /speedPresets: \[1, 10, 100, 1000, 3000, 10000, 100000\]/);
assert.match(options, /Break 前 1000×，Break 后 1800×，Reality 后 3000×/);
assert.match(
  reality,
  /const simCount = \(multiversalSim \+ 1\) \* \(amplifiedSim \+ 1\) \+ player\.partSimulatedReality - 1;/,
);
assert.doesNotMatch(reality, /player\.partSimulatedReality - 1 \+ 4;/);
assert.match(eternity, /const TT_REWARD_MULTIPLIER = 1;/);
assert.equal(tutorialText.includes("默认 10000×"), false);
assert.equal(tutorialText.includes("阶段速度"), true);

console.log("PASS  R121-01 新档节奏：1000×/1800×/3000× 阶段速度、无额外现实模拟、TT 收益恢复原版");
