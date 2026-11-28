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
const freshPlayer = { realities: 0, break: false, eternities: 0, infinities: 0 };
const { GameSpeed, progressionSpeedForState } = await loadSpeed(freshStorage, freshPlayer);

assert.equal(progressionSpeedForState(false, 0, 0, 0), 60);
assert.equal(progressionSpeedForState(false, 0, 0, { gt: () => true }), 500);
assert.equal(progressionSpeedForState(true, 0, 0), 70);
assert.equal(progressionSpeedForState(true, 0, { gt: () => true }), 27);
assert.equal(progressionSpeedForState(true, { gt: () => true }, { gt: () => true }), 3000);
assert.equal(GameSpeed.factor, 60);
assert.equal(GameSpeed.isStageManaged, true);

GameSpeed.tickProgressionSpeed();
assert.equal(freshStorage.getItem("oreki-game-speed-stage"), "pre-infinity");
freshPlayer.infinities = { gt: () => true };
assert.equal(GameSpeed.tickProgressionSpeed(), true);
assert.equal(GameSpeed.factor, 500);
assert.equal(freshStorage.getItem("oreki-game-speed-stage"), "post-infinity");
freshPlayer.break = true;
assert.equal(GameSpeed.tickProgressionSpeed(), true);
assert.equal(GameSpeed.factor, 70);
freshPlayer.eternities = { gt: () => true };
assert.equal(GameSpeed.tickProgressionSpeed(), true);
assert.equal(GameSpeed.factor, 27);
assert.equal(freshStorage.getItem("oreki-game-speed-stage"), "post-eternity");
freshPlayer.realities = { gt: () => true };
assert.equal(GameSpeed.tickProgressionSpeed(), true);
assert.equal(GameSpeed.factor, 3000);

assert.equal(GameSpeed.set(2400).ok, true);
assert.equal(GameSpeed.isStageManaged, false);
freshPlayer.break = false;
freshPlayer.realities = 0;
freshPlayer.eternities = 0;
freshPlayer.infinities = 0;
assert.equal(GameSpeed.tickProgressionSpeed(), false);
assert.equal(GameSpeed.factor, 2400, "玩家手动倍率不得被阶段托管覆盖");
GameSpeed.resetDefault();
assert.equal(GameSpeed.factor, 60, "回到阶段托管后按当前存档选择开局倍率");

const reloadStorage = new MemoryStorage([
  ["oreki-game-speed", "20000"],
  ["oreki-game-speed-stage-managed", "1"],
  ["oreki-game-speed-stage", "post-reality"],
]);
const reload = await loadSpeed(reloadStorage, {
  realities: 1,
  break: true,
  eternities: { gt: () => true },
});
assert.equal(reload.GameSpeed.factor, 20000);
assert.equal(reload.GameSpeed.tickProgressionSpeed(), false,
  "刷新不是阶段变化，不得把动态升档后的倍率重置");
assert.equal(reload.GameSpeed.factor, 20000);

const advancedStorage = new MemoryStorage([
  ["oreki-game-speed", "20000"],
  ["oreki-game-speed-stage-managed", "1"],
  ["oreki-game-speed-stage", "post-break"],
]);
const advanced = await loadSpeed(advancedStorage, {
  realities: 1,
  break: true,
  eternities: { gt: () => true },
});
assert.equal(advanced.GameSpeed.tickProgressionSpeed(), true);
assert.equal(advanced.GameSpeed.factor, 3000, "真实阶段推进后才应用新阶段默认速度");

const manualStorage = new MemoryStorage([
  ["oreki-game-speed", "2400"],
  ["oreki-game-speed-stage-managed", "0"],
]);
const manual = await loadSpeed(manualStorage, {
  realities: 1,
  break: true,
  eternities: { gt: () => true },
});
assert.equal(manual.GameSpeed.tickProgressionSpeed(), false);
assert.equal(manual.GameSpeed.factor, 2400);

const existingEternityStorage = new MemoryStorage([
  ["oreki-game-speed", "70"],
  ["oreki-game-speed-stage-managed", "1"],
  ["oreki-game-speed-stage", "post-break"],
]);
const existingEternity = await loadSpeed(existingEternityStorage, {
  realities: 0,
  break: true,
  eternities: { gt: () => true },
});
assert.equal(existingEternity.GameSpeed.tickProgressionSpeed(), true);
assert.equal(existingEternity.GameSpeed.factor, 27,
  "已有永恒次数的存档进入首次现实前阶段时采用 27×");

for (const [infinities, expected] of [[0, 60], [1, 500]]) {
  const oldStorage = new MemoryStorage([
    ["oreki-game-speed", "500"],
    ["oreki-game-speed-stage-managed", "1"],
    ["oreki-game-speed-stage", "pre-break"],
  ]);
  const migrated = await loadSpeed(oldStorage, { realities: 0, break: false, eternities: 0, infinities });
  migrated.GameSpeed.tickProgressionSpeed();
  assert.equal(migrated.GameSpeed.factor, expected);
}

console.log("PASS  Web 阶段速度：60× → 500× → 70× → 27× → 3000×；旧档迁移、动态升档和手动倍率");
process.exit(0);
