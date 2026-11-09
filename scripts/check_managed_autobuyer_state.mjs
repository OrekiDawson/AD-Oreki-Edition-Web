// ---------------------------------------------------------------------------
// [R97] `oreki-managed-autobuyer-state.js` 纯逻辑自检（不依赖浏览器 / 游戏循环）
//
// 覆盖用户第 1～9 条语义的关键分支，含**反向断言**（不该写时绝不写）与
// 「严格晚于登记时刻」的等值边界（now === recordedAt 必须不恢复）。
//
// 运行：node scripts/check_managed_autobuyer_state.mjs
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import * as Managed from "../src/core/oreki-managed-autobuyer-state.js";

let passed = 0;
let failed = 0;

function test(name, fn) {
  Managed.resetForTest();
  try {
    fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL  ${name}\n      ${error && error.message ? error.message : error}`);
  }
}

/** 假自动器：只实现本模块读取的 isUnlocked / isBought / isActive。 */
function makeItem({ active = true, unlocked = true, bought = false } = {}) {
  return {
    _active: active,
    isUnlocked: unlocked,
    isBought: bought,
    get isActive() { return this._active; },
    set isActive(value) { this._active = value; },
  };
}

/** 假注册表：与真实 `Autobuyer` 相同的访问形状（维度访问器为函数）。 */
function makeRegistry(items = {}) {
  const dims = [];
  for (let tier = 1; tier <= 8; tier += 1) {
    dims.push(items[`dim${tier}`] || makeItem());
  }
  const accessor = tier => dims[tier - 1];
  return {
    antimatterDimension: accessor,
    tickspeed: items.tickspeed || makeItem(),
    dimboost: items.dimboost || makeItem(),
    galaxy: items.galaxy || makeItem(),
    sacrifice: items.sacrifice || makeItem(),
    bigCrunch: items.crunch || makeItem(),
    ipMult: items.ipmult || makeItem(),
    // 非受管项：用于验证「只碰受管键」。
    eternity: items.eternity || makeItem({ active: false }),
  };
}

function setMasters({ mod = true, vanilla = true } = {}) {
  globalThis.OrekiSmartExecutor = { enabled: mod };
  globalThis.player = { auto: { autobuyersOn: vanilla } };
  globalThis.OrekiIu15Sprint = undefined;
  globalThis.Pelle = undefined;
}

// ---------------------------------------------------------------------------
// 0. 状态机本身
// ---------------------------------------------------------------------------
test("状态机：同一 key 只登记一次，重复登记不刷新时间戳", () => {
  assert.equal(Managed.noteManagedActiveDisabled("dim1", 1000), true);
  assert.equal(Managed.noteManagedActiveDisabled("dim1", 1500), false, "重复登记必须返回 false");
  assert.equal(Managed.isManagedActivePending("dim1"), true);
  assert.equal(Managed.describeManagedActive().includes("pending=[dim1]"), true);
  assert.equal(Managed.debugState().defers, 1, "重复登记不得增加计数");
});

test("状态机：now === recordedAt 不恢复（严格晚于）", () => {
  Managed.noteManagedActiveDisabled("dim1", 2000);
  assert.equal(Managed.consumeManagedActiveRestoreDue("dim1", 2000), false, "等值边界必须 false");
  assert.equal(Managed.isManagedActivePending("dim1"), true, "未到点不得消费");
  assert.equal(Managed.consumeManagedActiveRestoreDue("dim1", 2000.001), true, "严格晚于才恢复");
  assert.equal(Managed.consumeManagedActiveRestoreDue("dim1", 3000), false, "只能恢复一次");
  assert.equal(Managed.isManagedActivePending("dim1"), false);
});

test("状态机：clear 清登记并返回是否真的清掉", () => {
  Managed.noteManagedActiveDisabled("galaxy", 100);
  assert.equal(Managed.clearManagedActivePending("galaxy"), true);
  assert.equal(Managed.clearManagedActivePending("galaxy"), false);
  assert.equal(Managed.isManagedActivePending("galaxy"), false);
});

// ---------------------------------------------------------------------------
// 1. 已在期望状态 → 不写、不登记（幂等）
// ---------------------------------------------------------------------------
test("已在期望态：applyAll 全程 0 写入、0 登记", () => {
  setMasters();
  const registry = makeRegistry();
  const result = Managed.applyAll({ wantCrunch: true, autobuyers: registry, nowMs: 1000 });
  assert.equal(result.applied, true);
  assert.equal(result.wrote, 0);
  assert.equal(Managed.debugState().writes, 0);
  assert.equal(Managed.debugState().defers, 0);
  assert.deepEqual(Managed.debugState().pending, []);
});

// ---------------------------------------------------------------------------
// 2. 玩家手动关闭 → 本帧只登记，不抢写
// ---------------------------------------------------------------------------
test("玩家关闭：本帧只登记、绝不写", () => {
  setMasters();
  const dim3 = makeItem({ active: false });
  const registry = makeRegistry({ dim3 });
  const result = Managed.applyAll({ wantCrunch: true, autobuyers: registry, nowMs: 2000 });
  assert.equal(result.wrote, 0, "登记帧不得写入");
  assert.equal(dim3.isActive, false, "本帧必须保持玩家关闭状态");
  assert.equal(Managed.isManagedActivePending("dim3"), true);
  assert.equal(Managed.debugState().defers, 1);
});

// ---------------------------------------------------------------------------
// 3. 严格晚于登记时刻恢复，且只恢复一次
// ---------------------------------------------------------------------------
test("恢复时机：等值帧不写，下一帧写一次，之后不再写", () => {
  setMasters();
  const dim3 = makeItem({ active: false });
  const registry = makeRegistry({ dim3 });
  Managed.applyAll({ wantCrunch: true, autobuyers: registry, nowMs: 2000 });
  // 同一时刻再来一帧：now === recordedAt → 不得写。
  const sameFrame = Managed.applyAll({ wantCrunch: true, autobuyers: registry, nowMs: 2000 });
  assert.equal(sameFrame.wrote, 0, "等值帧不得写入");
  assert.equal(dim3.isActive, false);
  // 严格晚于登记时刻 → 恢复一次。
  const due = Managed.applyAll({ wantCrunch: true, autobuyers: registry, nowMs: 2001 });
  assert.equal(due.wrote, 1, "到点必须恰好写一次");
  assert.equal(dim3.isActive, true);
  assert.equal(Managed.debugState().restores, 1);
  assert.equal(Managed.debugState().writes, 1);
  // 之后 100 帧：已在期望态，不再写。
  for (let i = 0; i < 100; i += 1) {
    Managed.applyAll({ wantCrunch: true, autobuyers: registry, nowMs: 2002 + i });
  }
  assert.equal(Managed.debugState().writes, 1, "恢复后不得重复写");
  assert.equal(Managed.debugState().defers, 1, "不得重复登记");
});

// ---------------------------------------------------------------------------
// 4. 策略要求关闭 → 清登记且永不开启
// ---------------------------------------------------------------------------
test("wantOff：清登记且绝不强制开启", () => {
  setMasters();
  const crunch = makeItem({ active: false });
  const registry = makeRegistry({ crunch });
  Managed.applyAll({ wantCrunch: true, autobuyers: registry, nowMs: 3000 });
  assert.equal(Managed.isManagedActivePending("crunch"), true);
  const off = Managed.applyAll({ wantCrunch: false, autobuyers: registry, nowMs: 3001 });
  assert.equal(off.wrote, 0);
  assert.equal(crunch.isActive, false, "策略要求关闭时不得开启");
  assert.equal(Managed.isManagedActivePending("crunch"), false, "必须清掉待恢复登记");
  // 再过很久也不得开启。
  Managed.applyAll({ wantCrunch: false, autobuyers: registry, nowMs: 9999 });
  assert.equal(crunch.isActive, false);
  assert.equal(Managed.debugState().writes, 0);
});

// ---------------------------------------------------------------------------
// 5. 两个总开关任一关闭 → 不写、不消费登记
// ---------------------------------------------------------------------------
test("总开关关闭：不写、不消费登记；恢复后按原登记恢复一次", () => {
  setMasters();
  const dim2 = makeItem({ active: false });
  const registry = makeRegistry({ dim2 });
  Managed.applyAll({ wantCrunch: true, autobuyers: registry, nowMs: 4000 });
  assert.equal(Managed.isManagedActivePending("dim2"), true);

  // 原版总开关关闭。
  setMasters({ mod: true, vanilla: false });
  const vanillaOff = Managed.applyAll({ wantCrunch: true, autobuyers: registry, nowMs: 5000 });
  assert.equal(vanillaOff.applied, false);
  assert.equal(vanillaOff.reason, "vanilla-off");
  assert.equal(dim2.isActive, false, "总开关关闭时不得开启");
  assert.equal(Managed.isManagedActivePending("dim2"), true, "总开关关闭时不得消费登记");

  // MOD 总开关关闭。
  setMasters({ mod: false, vanilla: true });
  const modOff = Managed.applyAll({ wantCrunch: true, autobuyers: registry, nowMs: 5100 });
  assert.equal(modOff.applied, false);
  assert.equal(modOff.reason, "mod-off");
  assert.equal(dim2.isActive, false);
  assert.equal(Managed.isManagedActivePending("dim2"), true);

  // 两个都恢复 → 到点恢复一次。
  setMasters();
  const restored = Managed.applyAll({ wantCrunch: true, autobuyers: registry, nowMs: 5200 });
  assert.equal(restored.wrote, 1);
  assert.equal(dim2.isActive, true);
  assert.equal(Managed.debugState().writes, 1);
});

// ---------------------------------------------------------------------------
// 6. 未解锁 / 不可用项跳过（fail-closed）
// ---------------------------------------------------------------------------
test("未解锁跳过：不写、不登记、不误判", () => {
  setMasters();
  const locked = makeItem({ active: false, unlocked: false, bought: false });
  const registry = makeRegistry({ dim5: locked });
  const result = Managed.applyAll({ wantCrunch: true, autobuyers: registry, nowMs: 6000 });
  assert.equal(result.wrote, 0);
  assert.equal(result.skipped, 1, "锁定的项必须计入 skipped");
  assert.equal(locked.isActive, false);
  assert.equal(Managed.isManagedActivePending("dim5"), false);
});

// ---------------------------------------------------------------------------
// 7. 只碰受管键
// ---------------------------------------------------------------------------
test("只碰受管键：非受管项完全不动", () => {
  setMasters();
  const decoy = makeItem({ active: false });
  const registry = makeRegistry({ eternity: decoy });
  Managed.applyAll({ wantCrunch: true, autobuyers: registry, nowMs: 7000 });
  assert.equal(decoy.isActive, false, "非受管自动器不得被写");
  const pendingKeys = Managed.debugState().pending.map(row => row.key);
  assert.equal(pendingKeys.includes("eternity"), false);
  // 受管键固定 14 项：8 维度 + 计数频率 + 维度提升 + 星系 + 献祭 + 坍缩 + IP 倍率。
  assert.equal(Managed.MANAGED_KEYS.length, 14);
  for (const key of pendingKeys) {
    assert.equal(Managed.MANAGED_KEYS.includes(key), true, `出现了未登记的键：${key}`);
  }
});

// ---------------------------------------------------------------------------
// 8. IP 倍率共用同一状态机
// ---------------------------------------------------------------------------
test("ipmult：与其它项共用同一套延迟状态机", () => {
  setMasters();
  const ipMult = makeItem({ active: false });
  const registry = makeRegistry({ ipmult: ipMult });
  Managed.applyAll({ wantCrunch: true, autobuyers: registry, nowMs: 8000 });
  assert.equal(ipMult.isActive, false);
  assert.equal(Managed.isManagedActivePending("ipmult"), true, "ipmult 必须登记在同一张表");
  assert.equal(Managed.debugState().defers, 1);
  Managed.applyAll({ wantCrunch: true, autobuyers: registry, nowMs: 8001 });
  assert.equal(ipMult.isActive, true, "下一帧恢复一次");
  assert.equal(Managed.debugState().restores, 1);
  assert.equal(Managed.debugState().writes, 1);
});

// ---------------------------------------------------------------------------
// 9. 重复 tick 不重复写（幂等）
// ---------------------------------------------------------------------------
test("重复 tick：已恢复后 60 帧无任何新写入", () => {
  setMasters();
  const dim8 = makeItem({ active: false });
  const registry = makeRegistry({ dim8 });
  Managed.applyAll({ wantCrunch: true, autobuyers: registry, nowMs: 9000 });
  Managed.applyAll({ wantCrunch: true, autobuyers: registry, nowMs: 9001 });
  assert.equal(Managed.debugState().writes, 1);
  for (let i = 0; i < 60; i += 1) {
    Managed.applyAll({ wantCrunch: true, autobuyers: registry, nowMs: 9002 + i });
  }
  assert.equal(Managed.debugState().writes, 1, "不得逐帧重复写");
  assert.equal(Managed.debugState().defers, 1, "不得逐帧重复登记");
  assert.equal(dim8.isActive, true);
});

// ---------------------------------------------------------------------------
// 10. 与其它模块协调：IU15 冲刺封锁期间整体让路
// ---------------------------------------------------------------------------
test("IU15 冲刺：整体不接管、不写、不登记", () => {
  setMasters();
  globalThis.OrekiIu15Sprint = { active: true };
  const dim1 = makeItem({ active: false });
  const registry = makeRegistry({ dim1 });
  const result = Managed.applyAll({ wantCrunch: true, autobuyers: registry, nowMs: 10000 });
  assert.equal(result.applied, false);
  assert.equal(result.reason, "iu15-sprint");
  assert.equal(dim1.isActive, false, "冲刺封锁期间不得抢开 ID 自动器");
  assert.equal(Managed.isManagedActivePending("dim1"), false, "不得登记");
  assert.equal(Managed.debugState().writes, 0);
});

// ---------------------------------------------------------------------------
// 11. 与其它模块协调：佩勒毁灭态里不重开大坍缩
// ---------------------------------------------------------------------------
test("Pelle 毁灭态：不重开大坍缩自动器", () => {
  setMasters();
  globalThis.Pelle = { isDoomed: true };
  const crunch = makeItem({ active: false });
  const registry = makeRegistry({ crunch });
  const result = Managed.applyAll({ wantCrunch: true, autobuyers: registry, nowMs: 11000 });
  assert.equal(result.applied, true);
  assert.equal(result.wrote, 0);
  assert.equal(crunch.isActive, false, "毁灭态必须让终局模块保持关闭");
  assert.equal(Managed.isManagedActivePending("crunch"), false, "策略要求关闭时只清登记");
  assert.equal(Managed.debugState().writes, 0);
});

// ---------------------------------------------------------------------------
// 汇总
// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) process.exitCode = 1;
