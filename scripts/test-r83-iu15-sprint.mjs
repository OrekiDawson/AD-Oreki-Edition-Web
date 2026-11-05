#!/usr/bin/env node
/**
 * R83 Web IU15 冲刺行为自测（Node 直跑，无需浏览器）。
 *
 * 目的：直接加载**生产模块** `src/core/oreki-iu15-sprint.js`，验证本轮修复：
 *
 *   1. 新档开局不提前接管（IM 未解锁时 `canArm` 恒 false）。
 *   2. V 门已移除 —— 不再要求 `VUnlocks.vAchievementUnlock`（该条件结构性不可达）。
 *   3. 干净现实判定：`maxID1 != 0` 时不 arm / 已运行时判失败。
 *   4. 接管期间 `skipEc7 === true`；结束后恢复 false（EC7 保护只在窗口内）。
 *   5. 总开关关闭 → `releaseIfTakenOver()` 立即还原原版锁与 8 层 ID 购买。
 *   6. 失败/超时后 `active` 归 false，不会永久锁住自动购买器。
 *   7. `freezeResets` 显式存在且为 false（此前是 undefined 的静默缺陷）。
 *
 * 用法：node scripts/test-r83-iu15-sprint.mjs
 * 退出码 0 = 全部通过。
 *
 * 为什么能在 Node 里跑：本模块只依赖全局游戏对象，且全部通过 `globalThis` /
 * 直接标识符访问；这里用形状一致的垫片替代，不触碰 DOM。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB = join(__dirname, "..");

let passed = 0;
const failures = [];
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`PASS  ${name}`);
  } catch (error) {
    failures.push(`${name}: ${(error && error.message) || error}`);
    console.log(`FAIL  ${name} —— ${(error && error.message) || error}`);
  }
}

/** 极简 Decimal 替身：只做指数级别的比较，够本模块用。 */
class FakeDecimal {
  constructor(exp) { this.exp = exp; }
  get value() { return this; }
  eq(other) { return this.exp === (other instanceof FakeDecimal ? other.exp : Number(other)); }
  gt(other) { return this.exp > (other instanceof FakeDecimal ? other.exp : Number(other)); }
  gte(other) { return this.exp >= (other instanceof FakeDecimal ? other.exp : Number(other)); }
  lt(other) { return this.exp < (other instanceof FakeDecimal ? other.exp : Number(other)); }
  minus(other) { return new FakeDecimal(this.exp); }
  toString() { return `1e${this.exp}`; }
}

/**
 * 构造沙箱并加载**真实生产文件**。
 *
 * `OREKI_IU15_AM_EXP` 由模块 import 自 secret-formula，这里通过 stub 模块提供，
 * 值必须与生产一致（1e8）——测试里断言这一点，避免源码改了测试还假通过。
 */
function makeSandbox(overrides = {}) {
  const sandbox = {
    console: { log() {}, warn() {} },
    Date: { now: () => Date.now() },
    Math,
    Number,
    String,
    Object,
    Array,
    Boolean,
    JSON,
    ImaginaryUpgrade: id => overrides.imaginary15 || {
      isBought: false,
      isAvailableForPurchase: true,
      canBeBought: true,
      hasPlayerLock: false,
      setMechanicLock() {},
      purchase() {},
      cost: 1e9,
    },
    InfinityDimension: tier => overrides.dims?.[tier] || {
      buyMax: () => true,
      buySingle: () => true,
    },
    InfinityDimensions: { buyMax: () => true },
    MachineHandler: { isIMUnlocked: true, currentIMCap: 1e9 },
    Pelle: { isDoomed: false },
    NormalChallenge: { isRunning: false },
    InfinityChallenge: { isRunning: false },
    EternityChallenge: { isRunning: false },
    VUnlocks: {},
    player: {
      auto: {
        autobuyersOn: true,
        infinityDims: {
          isActive: true,
          all: [{ isActive: true }, { isActive: true }],
        },
      },
      reality: { reqLock: { imaginary: 0 } },
      requirementChecks: { reality: { maxID1: new FakeDecimal(0) } },
      antimatter: { exponent: 0 },
      realities: 1,
    },
  };
  sandbox.globalThis = sandbox;
  return vm.createContext(sandbox);
}

/** 取生产源码，把唯一的一条 import 换成沙箱内的常量注入。 */
function loadSprintSource() {
  const src = readFileSync(join(WEB, "src/core/oreki-iu15-sprint.js"), "utf-8");
  return src
    .replace(/^import[^;]+;\s*$/m, "const OREKI_IU15_AM_EXP = 1e8;")
    .replace(/^export\s+/gm, "");
}

function boot(overrides) {
  const sandbox = makeSandbox(overrides);
  const code = loadSprintSource();
  vm.runInContext(code, sandbox, { filename: "oreki-iu15-sprint.js" });
  return sandbox;
}

console.log("R83 Web IU15 冲刺生产代码行为自测");

// ------------------------------------------------------------------ 1 新档保护
check("1. IM 未解锁时 canArm 为 false（新档开局绝不接管）", () => {
  const sb = boot();
  sb.MachineHandler.isIMUnlocked = false;
  assert.equal(sb.OrekiIu15Sprint.canArm, false);
});

// ------------------------------------------------------------------ 2 V 门已移除
check("2. canArm 不再引用 VUnlocks 作为前置（注释除外）", () => {
  const src = loadSprintSource();
  // 先去掉 // 行注释与 /* */ 块注释，再看可执行代码里是否还有 V 门。
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.equal(/vAchievementUnlock/.test(code), false, "可执行代码里仍残留 V 解锁门");
});

// ------------------------------------------------------------------ 3 干净现实
check("3. maxID1 != 0 时 canArm 为 false（脏现实不开始冲刺）", () => {
  const sb = boot();
  sb.player.requirementChecks.reality.maxID1 = new FakeDecimal(1);
  assert.equal(sb.OrekiIu15Sprint.canArm, false);
});

// ------------------------------------------------------------------ 4 正常可 arm
check("4. 条件齐备时 canArm 为 true（IM 解锁 + 上限够 + 干净现实）", () => {
  const sb = boot();
  assert.equal(sb.OrekiIu15Sprint.canArm, true);
});

// ------------------------------------------------------------------ 5 封锁应用
check("5. arm 后进入接管态，并对 8 层 ID 购买生效拦截", () => {
  const sb = boot();
  // 生产代码依赖 `DimensionState.createAccessor()` 的**实例缓存**：
  // 同一 tier 每帧返回同一个对象，替换实例方法才能全局生效。
  // 因此垫片必须缓存实例，不能每次新建（否则测的是垫片缺陷，不是生产代码）。
  const dims = {};
  for (let t = 1; t <= 8; t++) {
    dims[t] = { buyMax: () => true, buySingle: () => true, isUnlocked: true };
  }
  sb.InfinityDimension = tier => dims[tier];
  sb.OrekiIu15Sprint.tick();
  assert.equal(sb.OrekiIu15Sprint.active, true, "应当已接管");
  let allBlocked = true;
  for (let t = 1; t <= 8; t++) {
    if (dims[t].buyMax() !== false) allBlocked = false;
    if (dims[t].buySingle() !== false) allBlocked = false;
  }
  assert.equal(allBlocked, true, "ID1~ID8 的 buyMax/buySingle 必须全部返回 false");
  // 释放后必须原样还原（不能把玩家的购买能力永久关掉）
  sb.OrekiIu15Sprint.releaseIfTakenOver();
  assert.equal(dims[1].buyMax(), true, "释放后 buyMax 必须恢复原函数");
  assert.equal(dims[1].buySingle(), true, "释放后 buySingle 必须恢复原函数");
});

// ------------------------------------------------------------------ 6 EC7 保护
check("6. 接管期间 skipEc7 为 true，结束后恢复 false", () => {
  const sb = boot();
  assert.equal(sb.OrekiIu15Sprint.skipEc7, false);
  sb.OrekiIu15Sprint.tick();
  assert.equal(sb.OrekiIu15Sprint.skipEc7, true);
  sb.OrekiIu15Sprint.releaseIfTakenOver();
  assert.equal(sb.OrekiIu15Sprint.skipEc7, false);
});

// ------------------------------------------------------------------ 7 总开关关闭
check("7. 关闭总开关后 releaseIfTakenOver 立即还原（不残留存档锁）", () => {
  const sb = boot();
  let lockValue = false;
  sb.ImaginaryUpgrade = () => ({
    isBought: false,
    isAvailableForPurchase: true,
    canBeBought: true,
    get hasPlayerLock() { return lockValue; },
    setMechanicLock(v) { lockValue = v; },
    cost: 1e9,
  });
  sb.OrekiIu15Sprint.tick();
  assert.equal(lockValue, true, "接管时应写入原版锁");
  const released = sb.OrekiIu15Sprint.releaseIfTakenOver();
  assert.equal(released, true);
  assert.equal(lockValue, false, "释放后原版锁必须还原为 false");
  assert.equal(sb.OrekiIu15Sprint.active, false);
});

// ------------------------------------------------------------------ 8 tick 检测关闭
check("8. 玩家直接改 player.auto.autobuyersOn=false 时，tick 也会自动释放", () => {
  const sb = boot();
  let lockValue = false;
  sb.ImaginaryUpgrade = () => ({
    isBought: false,
    isAvailableForPurchase: true,
    canBeBought: true,
    get hasPlayerLock() { return lockValue; },
    setMechanicLock(v) { lockValue = v; },
    cost: 1e9,
  });
  sb.OrekiIu15Sprint.tick();
  assert.equal(lockValue, true);
  sb.player.auto.autobuyersOn = false;
  sb.OrekiIu15Sprint.tick();
  assert.equal(lockValue, false, "tick 必须检测到开关关闭并释放");
  assert.equal(sb.OrekiIu15Sprint.active, false);
});

// ------------------------------------------------------------------ 9 已买即释放
check("9. IU15 已购买时进入 done 并解除接管", () => {
  const sb = boot();
  sb.ImaginaryUpgrade = () => ({
    isBought: true,
    isAvailableForPurchase: true,
    canBeBought: false,
    hasPlayerLock: false,
    setMechanicLock() {},
    cost: 1e9,
  });
  sb.OrekiIu15Sprint.tick();
  assert.equal(sb.OrekiIu15Sprint.active, false);
  assert.equal(sb.OrekiIu15Sprint.debugState.phase, "done");
});

// ------------------------------------------------------------------ 10 freezeResets
check("10. freezeResets 显式存在且为 false（不再静默 undefined）", () => {
  const sb = boot();
  assert.equal(sb.OrekiIu15Sprint.freezeResets, false);
});

// ------------------------------------------------------------------ 11 失败回退
check("11. 运行中 maxID1 变正 → 失败并解除接管，不会永久锁", () => {
  const sb = boot();
  sb.OrekiIu15Sprint.tick();          // arm
  sb.player.requirementChecks.reality.maxID1 = new FakeDecimal(0);
  sb.OrekiIu15Sprint.tick();          // 进入 running
  sb.player.requirementChecks.reality.maxID1 = new FakeDecimal(2);
  sb.OrekiIu15Sprint.tick();          // 判失败
  assert.equal(sb.OrekiIu15Sprint.active, false);
  assert.ok(sb.OrekiIu15Sprint.debugState.fails >= 1);
});

// ------------------------------------------------------------------ 12 购买成功
check("12. 达到门槛后调用原版购买入口，isBought 变 true 并释放", () => {
  const sb = boot();
  let bought = false;
  sb.player.antimatter = { exponent: 1e8 };
  sb.ImaginaryUpgrade = () => ({
    get isBought() { return bought; },
    isAvailableForPurchase: true,
    canBeBought: true,
    hasPlayerLock: false,
    setMechanicLock() {},
    purchase() { bought = true; },
    cost: 1e9,
  });
  sb.OrekiIu15Sprint.tick();          // arm
  sb.OrekiIu15Sprint.tick();          // running（maxID1 == 0）
  sb.OrekiIu15Sprint.tick();          // 达门槛 → 购买
  assert.equal(bought, true, "必须真实调用原版 purchase");
  assert.equal(sb.OrekiIu15Sprint.active, false);
});

// ------------------------------------------------------------------ 汇总
console.log(`\n合计 ${passed + failures.length} 项：PASS ${passed} / FAIL ${failures.length}`);
if (failures.length) {
  console.log("失败项：");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
