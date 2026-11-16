#!/usr/bin/env node
// ---------------------------------------------------------------------------
// [R116-02] 调度器托管自动购买器 —— 纯逻辑自检（不启动浏览器）
//
// 验收目标：
//   1. 只在托管 Tick 上处理一次；同一 Tick 不重复写（逐帧调用也不会刷写）。
//   2. 玩家手动改动启停后，下一次有效 Tick 恢复；大坍缩 mode/xHighest 不托管
//      （单一所有者，避免强写 mode 使受管 interval 失效）。
//   3. 大坍缩暂停/未知时不强制关闭，保留原生一次性 release；只在允许时恢复开启。
//   4. 两个总开关关闭 → 不写、不消费 Tick；重新开启后恢复托管。
//   5. IU15 冲刺整体让路；Pelle 只让大坍缩，其余项仍对账；未解锁项 fail-closed。
//   6. 只写配置，不调用购买/tick 接口（配置恢复 ≠ 真实购买）。
//
// 运行：node scripts/check_managed_autobuyer_state.mjs
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import * as Managed from "../src/core/oreki-managed-autobuyer-state.js";

let passed = 0;
let failed = 0;
function test(name, fn) {
  Managed.resetForTest();
  resetFakes();
  try {
    fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL  ${name}\n      ${error && error.message ? error.message : error}`);
  }
}

/** 最小 Decimal 替身：只实现本模块比较/显示需要的 eq/toNumber。 */
class FakeDecimal {
  constructor(value) { this.value = Number(value); }
  eq(other) { return this.value === Number(other && other.value !== undefined ? other.value : other); }
  toNumber() { return this.value; }
  toString() { return String(this.value); }
}

function makeItem({ active = true, unlocked = true, bought = false } = {}) {
  return {
    _active: active,
    isUnlocked: unlocked,
    isBought: bought,
    tickCalls: 0,
    get isActive() { return this._active; },
    set isActive(value) { this._active = value; },
    tick() { this.tickCalls += 1; return true; },
  };
}

let dims;
let registry;
let bigCrunch;

function resetFakes() {
  globalThis.Decimal = FakeDecimal;
  globalThis.AUTO_CRUNCH_MODE = { AMOUNT: 0, TIME: 1, X_HIGHEST: 2 };
  globalThis.player = {
    auto: { autobuyersOn: true },
    records: { gameCreatedTime: 111 },
    realities: 0,
  };
  globalThis.OrekiSmartExecutor = { enabled: true };
  delete globalThis.OrekiIu15Sprint;
  delete globalThis.Pelle;

  dims = Array.from({ length: 8 }, () => makeItem({ active: true }));
  const dimAccessor = tier => dims[tier - 1];
  dimAccessor.isActive = true; // 组级开关（原版 UI 的唯一可见 checkbox）
  bigCrunch = makeItem({ active: true });
  bigCrunch.mode = 2; // X_HIGHEST
  bigCrunch.xHighest = new FakeDecimal(10);
  registry = {
    antimatterDimension: dimAccessor,
    tickspeed: makeItem({ active: true }),
    dimboost: makeItem({ active: true }),
    galaxy: makeItem({ active: true }),
    sacrifice: makeItem({ active: true }),
    bigCrunch,
    ipMult: makeItem({ active: true }),
  };
}

const apply = (tick, extra = {}) => Managed.applyAll({
  wantCrunch: true,
  autobuyers: registry,
  tick,
  ...extra,
});

// ---------------------------------------------------------------------------
// 0. 目标配置计算
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// 1. 同一 Tick 不重复处理
// ---------------------------------------------------------------------------
test("首 Tick：全部已是目标态 ⇒ 0 写入", () => {
  const result = apply(1);
  assert.equal(result.applied, true);
  assert.equal(result.wrote, 0);
  assert.equal(Managed.debugState().ticks, 1);
});

test("同一 Tick 多次调用 ⇒ tick-wait，不写配置", () => {
  apply(1);
  registry.antimatterDimension.isActive = false;
  const same = apply(1);
  assert.equal(same.applied, false);
  assert.equal(same.reason, "tick-wait");
  assert.equal(registry.antimatterDimension.isActive, false, "同一 Tick 内必须保留玩家操作");
  const state = Managed.debugState();
  const writesBefore = state.writes;
  for (let i = 0; i < 20; i += 1) apply(1);
  assert.equal(Managed.debugState().writes, writesBefore, "逐帧调用不得刷写");
});

// ---------------------------------------------------------------------------
// 2. 手动关闭 → 下一 Tick 恢复
// ---------------------------------------------------------------------------
test("玩家关闭维度组/计数频率/大坍缩 ⇒ 下一 Tick 恢复开启", () => {
  apply(1);
  registry.antimatterDimension.isActive = false;
  registry.tickspeed.isActive = false;
  bigCrunch.isActive = false;
  const result = apply(2);
  assert.equal(result.applied, true);
  assert.equal(registry.antimatterDimension.isActive, true, "维度组必须恢复");
  assert.equal(registry.tickspeed.isActive, true);
  assert.equal(bigCrunch.isActive, true);
  assert.equal(result.wrote, 3);
  assert.deepEqual([...result.restored].sort(), ["crunch", "dim1", "tickspeed"]);
});

test("wantCrunch=false ⇒ 不主动关闭大坍缩（保留原生一次性结算机会）", () => {
  apply(1, { wantCrunch: false });
  assert.equal(bigCrunch.isActive, true, "暂停目标也不得把原生自动器关掉");
  bigCrunch.isActive = false; // 玩家/终局模块关闭
  apply(2, { wantCrunch: false });
  assert.equal(bigCrunch.isActive, false, "暂停期间不得擅自重新开启");
});test("决策未知（null）⇒ 不碰大坍缩，也不改模式", () => {
  apply(1);
  bigCrunch.isActive = false;
  bigCrunch.mode = 0;
  const result = apply(2, { wantCrunch: null });
  assert.equal(result.applied, true);
  assert.equal(bigCrunch.isActive, false, "未知状态不得改启停");
  assert.equal(bigCrunch.mode, 0, "未知状态不得改模式");
});

// ---------------------------------------------------------------------------
// 3. 手动改模式/阈值 → 下一 Tick 恢复
// ---------------------------------------------------------------------------
test("不强制大坍缩 mode/xHighest：玩家选择保持，单一所有者只托管 interval", () => {
  apply(1);
  bigCrunch.mode = 0;
  bigCrunch.xHighest = new FakeDecimal(99);
  apply(2);
  assert.equal(bigCrunch.mode, 0, "托管层不得改写 mode");
  assert.equal(Number(bigCrunch.xHighest), 99, "托管层不得改写 xHighest");
});// ---------------------------------------------------------------------------
// 4. 总开关 / 特殊阶段
// ---------------------------------------------------------------------------
test("MOD 总开关关闭 ⇒ 不写、不消费 Tick；重开后同 Tick 恢复", () => {
  apply(1);
  globalThis.OrekiSmartExecutor.enabled = false;
  registry.antimatterDimension.isActive = false;
  const off = apply(2);
  assert.equal(off.applied, false);
  assert.equal(off.reason, "mod-off");
  assert.equal(registry.antimatterDimension.isActive, false);
  assert.equal(Managed.debugState().lastTick, 1, "关闭时不得消费 Tick");
  globalThis.OrekiSmartExecutor.enabled = true;
  const on = apply(2);
  assert.equal(on.applied, true);
  assert.equal(registry.antimatterDimension.isActive, true);
});

test("原版自动购买器总开关关闭 ⇒ 整体让路，不写", () => {
  apply(1);
  globalThis.player.auto.autobuyersOn = false;
  registry.antimatterDimension.isActive = false;
  const result = apply(2);
  assert.equal(result.applied, false);
  assert.equal(result.reason, "vanilla-off");
  assert.equal(registry.antimatterDimension.isActive, false);
});

test("IU15 冲刺整体让路；Pelle 只让大坍缩，其余 13 项仍对账", () => {
  apply(1);
  registry.antimatterDimension.isActive = false;
  globalThis.OrekiIu15Sprint = { active: true };
  assert.equal(apply(2).reason, "iu15-sprint");
  assert.equal(registry.antimatterDimension.isActive, false, "冲刺期间整体让路");
  delete globalThis.OrekiIu15Sprint;
  globalThis.Pelle = { isDoomed: true };
  const result = apply(2);
  assert.equal(result.applied, true, "Pelle 不应整体跳过");
  assert.equal(registry.antimatterDimension.isActive, true, "其余受管自动器仍应恢复");
  bigCrunch.isActive = false;
  apply(3);
  assert.equal(bigCrunch.isActive, false, "Pelle 下大坍缩保持关闭");
});test("未解锁/未购买项 ⇒ fail-closed 跳过，不写", () => {
  apply(1);
  registry.galaxy.isUnlocked = false;
  registry.galaxy.isBought = false;
  registry.galaxy.isActive = false;
  const result = apply(2);
  assert.equal(registry.galaxy.isActive, false);
  assert.equal(result.restored.includes("galaxy"), false);
});

// ---------------------------------------------------------------------------
// 5. 只写配置，不触发购买
// ---------------------------------------------------------------------------
test("只写配置：不调用任何自动器 tick/购买接口", () => {
  apply(1);
  dims.forEach(dim => { dim.isActive = false; });
  bigCrunch.isActive = false;
  apply(2);
  const all = [...dims, registry.tickspeed, registry.dimboost, registry.galaxy,
    registry.sacrifice, registry.bigCrunch, registry.ipMult];
  all.forEach(item => assert.equal(item.tickCalls, 0, "托管层不得触发购买"));
});

// ---------------------------------------------------------------------------
// 6. 换存档 / 无 Tick
// ---------------------------------------------------------------------------
test("换存档：下一次 Tick 按新档真实字段重算，不保留旧统计", () => {
  apply(1);
  registry.antimatterDimension.isActive = false;
  globalThis.player.records.gameCreatedTime = 222;
  const result = apply(2);
  assert.equal(result.applied, true);
  assert.equal(registry.antimatterDimension.isActive, true, "新档同一 Tick 也按当前目标恢复");
  assert.equal(Managed.debugState().saveId, 222);
});

test("没有调度器 Tick 注入/可读 ⇒ no-tick，不写", () => {
  globalThis.OrekiSmartExecutor = { enabled: true };
  registry.antimatterDimension.isActive = false;
  const result = Managed.applyAll({ wantCrunch: true, autobuyers: registry });
  assert.equal(result.applied, false);
  assert.equal(result.reason, "no-tick");
  assert.equal(registry.antimatterDimension.isActive, false);
});

console.log(`\nR116-02 托管自动购买器夹具：${passed} PASS / ${failed} FAIL`);
if (failed) process.exit(1);
process.exit(0);
