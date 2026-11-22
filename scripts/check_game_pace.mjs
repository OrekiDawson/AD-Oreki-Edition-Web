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
const tutorialGenerated = fs.readFileSync(
  path.join(ROOT, "src/core/oreki-tutorial-data.gen.js"), "utf8",
);
const tutorialStage = fs.readFileSync(path.join(ROOT, "src/core/oreki-tutorial.js"), "utf8");
const game = fs.readFileSync(path.join(ROOT, "src/game.js"), "utf8");
const eternity = fs.readFileSync(
  path.join(ROOT, "src/core/oreki-eternity-automation.js"),
  "utf8",
);
const reality = fs.readFileSync(path.join(ROOT, "src/core/reality.js"), "utf8");
const normalChallenges = fs.readFileSync(
  path.join(ROOT, "src/core/normal-challenges.js"),
  "utf8",
);

assert.match(speed, /export const GAME_SPEED_DEFAULT = 500;/);
assert.match(speed, /export const GAME_SPEED_POST_BREAK = 900;/);
assert.match(speed, /export const GAME_SPEED_POST_REALITY = 3000;/);
assert.match(speed, /export const GAME_SPEED_MAX = 100000;/);
assert.match(speed, /let dynamicEnabled = readStoredFlag\(DYNAMIC_KEY, true\);/);
assert.match(speed, /tickProgressionSpeed\(\)/);
assert.match(speed, /progressionStageForState\(p\.break === true, p\.realities\)/);
assert.match(options, /speedPresets: \[1, 10, 100, 1000, 3000, 10000, 100000\]/);
assert.match(options, /Break 前 500×，Break 后 900×，Reality 后 3000×/);
assert.match(
  reality,
  /const simCount = \(multiversalSim \+ 1\) \* \(amplifiedSim \+ 1\) \+ player\.partSimulatedReality - 1;/,
);
assert.doesNotMatch(reality, /player\.partSimulatedReality - 1 \+ 4;/);
assert.match(eternity, /const TT_REWARD_MULTIPLIER = 1;/);
assert.equal(tutorialText.includes("默认 10000×"), false);
assert.equal(tutorialText.includes("默认 3000×"), false);
assert.equal(tutorialText.includes("500×/900×/3000×"), true);
assert.equal(tutorialStage.includes("默认 3000×"), false);
assert.equal(tutorialStage.includes("500×/900×/3000×"), true);
assert.match(eternity, /get eternityResetActive\(\)/);
assert.equal((eternity.match(/get eternityResetActive\(\)/g) || []).length, 1);
assert.match(eternity, /tickEternity\(\) \{[\s\S]*?if \(!this\.eternityResetActive\) return false;/);
assert.match(eternity, /if \(EternityChallenge\.isRunning\) \{[\s\S]*?challenge\.canBeCompleted/);
assert.match(eternity, /tryEternityChallenge8Purchases\(\)/);
assert.match(eternity, /InfinityDimensions\.buyMax\(\)/);
assert.match(eternity, /ReplicantiUpgrade\.chance/);
assert.doesNotMatch(eternity, /ReplicantiUpgrade\.(?:chance|interval|galaxies)\.autobuyerTick\(\)/);
assert.match(normalChallenges, /export function c11MatterGrowthPower\(/);
assert.match(normalChallenges, /const divisor = infinityChallengeRunning \? factor : factor \* Math\.sqrt\(factor\);/);
assert.match(normalChallenges, /return diff \/ divisor \/ 20;/);
assert.match(normalChallenges, /c11MatterGrowthPower\(diff\)/);
assert.doesNotMatch(normalChallenges, /diff \/ getGlobalSpeedFactor\(\) \/ 20/);
assert.equal(fs.existsSync(path.join(ROOT, "src/core/oreki-instant-challenges.js")), false);
assert.doesNotMatch(game, /tryInstantCompleteChallenges|oreki-instant-challenges/);
assert.equal(tutorialText.includes("阶段速度"), true);
const obsoleteChallengeCompletion = /(?:进入|点进去).{0,2}(?:即|就)完成|瞬时完成|一口气补满|下一帧.{0,8}(?:结算|发奖|完成)|各点一次|点一遍|这一个动作|白拿|至少给它一帧时间再退出|补满并结算/;
assert.doesNotMatch(tutorialText, obsoleteChallengeCompletion);
assert.doesNotMatch(tutorialGenerated, obsoleteChallengeCompletion);

console.log("PASS  R125 Web 节奏：500×/900×/3000×、无额外现实模拟、TT 收益恢复原版");
