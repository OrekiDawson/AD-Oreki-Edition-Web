#!/usr/bin/env node
import assert from "node:assert/strict";

class MemoryStorage {
  constructor(entries = []) {
    this.values = new Map(entries);
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

async function loadSpeed(storage, player) {
  globalThis.window = {
    localStorage: storage,
    setInterval: () => 1,
    player,
  };
  return import(`../src/core/speed-config.js?test=${Math.random()}`);
}

const freshStorage = new MemoryStorage();
const freshPlayer = { realities: 0, break: false };
const { GameSpeed, progressionSpeedForState } = await loadSpeed(freshStorage, freshPlayer);

assert.equal(progressionSpeedForState(false, 0), 1000);
assert.equal(progressionSpeedForState(true, 0), 1800);
assert.equal(progressionSpeedForState(true, { gt: () => true }), 3000);
assert.equal(GameSpeed.factor, 1000);
assert.equal(GameSpeed.isStageManaged, true);

GameSpeed.tickProgressionSpeed();
assert.equal(freshStorage.getItem("oreki-game-speed-stage"), "pre-break");
freshPlayer.break = true;
assert.equal(GameSpeed.tickProgressionSpeed(), true);
assert.equal(GameSpeed.factor, 1800);
freshPlayer.realities = { gt: () => true };
assert.equal(GameSpeed.tickProgressionSpeed(), true);
assert.equal(GameSpeed.factor, 3000);

assert.equal(GameSpeed.set(2400).ok, true);
assert.equal(GameSpeed.isStageManaged, false);
freshPlayer.break = false;
freshPlayer.realities = 0;
assert.equal(GameSpeed.tickProgressionSpeed(), false);
assert.equal(GameSpeed.factor, 2400, "玩家手动倍率不得被阶段托管覆盖");

const reloadStorage = new MemoryStorage([
  ["oreki-game-speed", "20000"],
  ["oreki-game-speed-stage-managed", "1"],
  ["oreki-game-speed-stage", "post-reality"],
]);
const reload = await loadSpeed(reloadStorage, { realities: 1, break: true });
assert.equal(reload.GameSpeed.factor, 20000);
assert.equal(reload.GameSpeed.tickProgressionSpeed(), false,
  "刷新不是阶段变化，不得把动态升档后的倍率重置");
assert.equal(reload.GameSpeed.factor, 20000);

const advancedStorage = new MemoryStorage([
  ["oreki-game-speed", "20000"],
  ["oreki-game-speed-stage-managed", "1"],
  ["oreki-game-speed-stage", "post-break"],
]);
const advanced = await loadSpeed(advancedStorage, { realities: 1, break: true });
assert.equal(advanced.GameSpeed.tickProgressionSpeed(), true);
assert.equal(advanced.GameSpeed.factor, 3000, "真实阶段推进后才应用新阶段默认速度");

const manualStorage = new MemoryStorage([
  ["oreki-game-speed", "2400"],
  ["oreki-game-speed-stage-managed", "0"],
]);
const manual = await loadSpeed(manualStorage, { realities: 1, break: true });
assert.equal(manual.GameSpeed.tickProgressionSpeed(), false);
assert.equal(manual.GameSpeed.factor, 2400);

console.log("PASS  Web 阶段速度：1000× → 1800× → 3000×；刷新保留动态升档，手动倍率优先");
process.exit(0);
