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
}

const storage = new MemoryStorage();
globalThis.window = {
  localStorage: storage,
  setInterval: () => 1,
};

const { GameSpeed, progressionSpeedForState } = await import(
  "../src/core/speed-config.js?test=stage-speed",
);

assert.equal(progressionSpeedForState(false, 0), 1000);
assert.equal(progressionSpeedForState(true, 0), 1800);
assert.equal(progressionSpeedForState(true, { gt: () => true }), 3000);
assert.equal(progressionSpeedForState(false, { toNumber: () => 1 }), 3000);

window.player = { realities: 0, break: false };
assert.equal(GameSpeed.factor, 1000);
assert.equal(GameSpeed.isStageManaged, true);
assert.equal(storage.getItem("oreki-game-speed-stage-managed"), "1");
assert.equal(GameSpeed.tickProgressionSpeed(), false);

window.player.break = true;
assert.equal(GameSpeed.tickProgressionSpeed(), true);
assert.equal(GameSpeed.factor, 1800);

window.player.realities = { gt: () => true };
assert.equal(GameSpeed.tickProgressionSpeed(), true);
assert.equal(GameSpeed.factor, 3000);

assert.equal(GameSpeed.set(2400).ok, true);
assert.equal(GameSpeed.isStageManaged, false);
window.player.break = false;
window.player.realities = 0;
assert.equal(GameSpeed.tickProgressionSpeed(), false);
assert.equal(GameSpeed.factor, 2400, "玩家手动倍率不得被阶段托管覆盖");

console.log("PASS  Web 阶段速度：1000× → 1800× → 3000×，手动倍率优先");
process.exit(0);
