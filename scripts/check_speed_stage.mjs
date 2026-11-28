#!/usr/bin/env node
import assert from "node:assert/strict";

class MemoryStorage {
  constructor(entries = []) {
    this.values = new Map(entries);
  }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const timers = [];
async function loadSpeed(storage, player) {
  globalThis.window = {
    localStorage: storage,
    setInterval: () => {
      const token = { unref() { return this; } };
      timers.push(token);
      return token;
    },
    clearInterval: () => {},
    player,
  };
  return import(`../src/core/speed-config.js?test=${Math.random()}`);
}

const freshStorage = new MemoryStorage();
const freshPlayer = { realities: 0, break: false };
const fresh = await loadSpeed(freshStorage, freshPlayer);
assert.equal(fresh.progressionSpeedForState(false, 0), 500);
assert.equal(fresh.progressionSpeedForState(true, 0), 70);
assert.equal(fresh.progressionSpeedForState(true, { gt: () => true }), 3000);
assert.equal(fresh.GameSpeed.mode, "stage");
assert.equal(fresh.GameSpeed.factor, 500);
assert.equal(freshStorage.getItem("oreki-game-speed-mode"), "stage");
fresh.GameSpeed.tickProgressionSpeed();
freshPlayer.break = true;
assert.equal(fresh.GameSpeed.tickProgressionSpeed(), true);
assert.equal(fresh.GameSpeed.factor, 70);
freshPlayer.realities = { gt: () => true };
assert.equal(fresh.GameSpeed.tickProgressionSpeed(), true);
assert.equal(fresh.GameSpeed.factor, 3000);

assert.equal(fresh.GameSpeed.set(2400).ok, true);
assert.equal(fresh.GameSpeed.mode, "manual");
assert.equal(fresh.GameSpeed.factor, 2400);
assert.equal(freshStorage.getItem("oreki-game-speed-manual"), "2400");
freshPlayer.break = false;
freshPlayer.realities = 0;
assert.equal(fresh.GameSpeed.tickProgressionSpeed(), false);
assert.equal(fresh.GameSpeed.factor, 2400, "手动固定倍率不得被真实阶段变化覆盖");
assert.equal(fresh.GameSpeed.setManualMode().value, 2400);
assert.equal(fresh.GameSpeed.setStageMode().value, 500);
assert.equal(fresh.GameSpeed.setManualMode().value, 2400, "切回手动应恢复最近一次手动值");

const legacyManualStorage = new MemoryStorage([
  ["oreki-game-speed", "2400"],
  ["oreki-game-speed-stage-managed", "0"],
]);
const legacyManual = await loadSpeed(legacyManualStorage, { realities: 1, break: true });
assert.equal(legacyManual.GameSpeed.mode, "manual");
assert.equal(legacyManual.GameSpeed.factor, 2400);
assert.equal(legacyManualStorage.getItem("oreki-game-speed-mode"), "manual");
assert.equal(legacyManualStorage.getItem("oreki-game-speed-manual"), "2400");
assert.equal(legacyManualStorage.getItem("oreki-game-speed-stage-managed"), null);

const legacyStageStorage = new MemoryStorage([
  ["oreki-game-speed", "20000"],
  ["oreki-game-speed-stage-managed", "1"],
  ["oreki-game-speed-dynamic", "1"],
]);
const legacyStage = await loadSpeed(legacyStageStorage, { realities: 1, break: true });
assert.equal(legacyStage.GameSpeed.mode, "stage");
assert.equal(legacyStage.GameSpeed.factor, 3000);
assert.equal(legacyStageStorage.getItem("oreki-game-speed-dynamic"), null);

const legacyDynamicManualStorage = new MemoryStorage([
  ["oreki-game-speed", "777"],
  ["oreki-game-speed-dynamic", "0"],
]);
const legacyDynamicManual = await loadSpeed(legacyDynamicManualStorage, { realities: 0, break: true });
assert.equal(legacyDynamicManual.GameSpeed.mode, "manual");
assert.equal(legacyDynamicManual.GameSpeed.factor, 777);

const invalidStorage = new MemoryStorage([
  ["oreki-game-speed", "not-a-number"],
  ["oreki-game-speed-stage-managed", "0"],
]);
const invalid = await loadSpeed(invalidStorage, { realities: 0, break: false });
assert.equal(invalid.GameSpeed.mode, "manual");
assert.equal(invalid.GameSpeed.factor, 500);
assert.equal(invalidStorage.getItem("oreki-game-speed-manual"), "500");

for (const timer of timers) timer.unref?.();
console.log("PASS Web 速度模式：真实阶段 500→70→3000、手动固定、旧配置迁移");
