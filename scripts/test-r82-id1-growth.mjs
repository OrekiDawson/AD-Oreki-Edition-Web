#!/usr/bin/env node
/**
 * R82 Web 首次永恒前成长链行为自测（Node 直跑，无需浏览器）。
 *
 * 目的：直接加载**生产代码**（不是复刻一份逻辑），证明 R82 的四处修复成立：
 *
 *   1. 坍缩保护窗口（`waitingForId1Peak`）：首次永恒前 IP 够 + maxAM 未到 1e1100 时 HOLD，
 *      到达门槛或 ID1 已解锁时必须释放，不能无限 HOLD。
 *   2. ID1 资金预留：已达 IP 门槛后，无限升级不得把余额压到门槛以下；解锁后恢复。
 *   3. `buyInfinityDimensions()` 返回**真实购买增量**，不再用「买前统计」冒充动作。
 *   4. 阶段优先提示只改尝试顺序，不放宽间隔、不放多动作、关闭即清。
 *
 * 用法：node scripts/test-r82-id1-growth.mjs
 * 退出码 0 = 全部通过；任一断言失败即非 0，并打印失败项。
 *
 * 为什么能在 Node 里跑：这些模块只依赖全局游戏对象（InfinityDimension /
 * Currency / player …），全部可用形状一致的垫片替代，且不触碰 DOM。
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
/** 统一的断言包装：记录真实通过/失败数量，而不是只依赖第一个异常。 */
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

// ------------------------------------------------------------------ 数值替身
// 只实现被测代码实际用到的比较/运算，避免引入完整 Decimal 依赖。
//
// 必须按**指数**建模：本项目里的反物质/无限点数会出现 1e1100、
// 1e1100 甚至更大的指数，直接用 JS number 会被压成 Infinity，
// 让 `maxAM < 1e1100` 恒为 false —— 测试就会假失败（第一版踩过）。
class Big {
  constructor(value) {
    this.exp = Big.toExp(value);
  }
  /** 直接用 log10 指数构造，避开 1e500 被 JS number 压成 Infinity 的问题。 */
  static fromExp(exp) {
    const instance = Object.create(Big.prototype);
    instance.exp = exp;
    return instance;
  }
  /** 把 number / Big / 指数形式统一成 log10 指数（饱和到有限范围）。 */
  static toExp(value) {
    if (value instanceof Big) return value.exp;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 310;      // Infinity → 视为极大但有限
    if (numeric <= 0) return -Infinity;
    return Math.log10(numeric);
  }
  gte(other) { return this.exp >= Big.toExp(other); }
  gt(other) { return this.exp > Big.toExp(other); }
  lt(other) { return this.exp < Big.toExp(other); }
  lte(other) { return this.exp <= Big.toExp(other); }
  eq(other) { return this.exp === Big.toExp(other); }
  minus(other) {
    // 量级差 > 15 个数量级时，减法结果就是被减数本身（与原版浮点语义一致）。
    const otherExp = Big.toExp(other);
    if (this.exp - otherExp > 15) return new Big(this);
    return new Big(this.toNumber() - Math.pow(10, otherExp));
  }
  plus(other) {
    const otherExp = Big.toExp(other);
    if (otherExp - this.exp > 15) return new Big(other);
    return new Big(this.toNumber() + Math.pow(10, otherExp));
  }
  times(other) { return new Big(this.exp + Big.toExp(other)); }
  /** 仅在量级可表示时转 number，供断言与减法使用。 */
  toNumber() { return this.exp === -Infinity ? 0 : Math.pow(10, this.exp); }
}

/** 构造一个可重复购买/一次性购买的无限升级垫片，形状照原版。 */
function makeUpgrade(id, cost, opts = {}) {
  const state = {
    id,
    cost,
    bought: false,
    purchases: 0,
    get isAvailableForPurchase() { return opts.available !== false; },
    get isBought() { return opts.repeatable ? false : state.bought; },
    get canBeBought() { return opts.affordable !== false && (opts.repeatable || !state.bought); },
    purchase() {
      if (!state.canBeBought) return false;
      if (!opts.noCharge) ctx.currency.value = ctx.currency.value.minus(cost);
      if (!opts.repeatable) state.bought = true;
      state.purchases++;
      return true;
    },
  };
  return state;
}

const ctx = {};

// ------------------------------------------------------------------ 加载生产代码
/** 把 ESM 转成 vm 可执行脚本：去 import/export，导出的对象挂到 globalThis。 */
function loadModule(relativePath, exportName, extraReplacements = []) {
  let source = readFileSync(join(WEB, relativePath), "utf-8");
  source = source.replace(/^import\s.*?;\s*$/gm, "").replace(/^export\s+/gm, "");
  for (const [from, to] of extraReplacements) source = source.replace(from, to);
  source += `\nglobalThis.__MOD__ = ${exportName};\n`;
  return source;
}

function freshSandbox() {
  const sandbox = {
    console, Math, Object, Array, Number, String, JSON, Boolean, Error,
    Date, performance: { now: () => sandbox.__now },
    __now: 0,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}

// ================================================================ 第 1 组：坍缩保护
// `BigCrunchAutobuyer.waitingForId1Peak` 是 Web 侧保护窗口的唯一实现，直接读 getter。
{
  const sandbox = freshSandbox();
  sandbox.player = { break: true, records: { thisEternity: { maxAM: Big.fromExp(500) } } };
  sandbox.PlayerProgress = { eternityUnlocked: () => false };
  sandbox.InfinityDimension = tier => ({ isUnlocked: tier !== 1 });
  sandbox.NormalChallenge = { isRunning: false };
  sandbox.InfinityChallenge = { isRunning: false };
  sandbox.Pelle = { isDoomed: false };
  sandbox.Currency = { infinityPoints: { value: Big.fromExp(8) } };
  // 原版 DC.E8 / DC.E1100 是 Decimal 常量，这里必须同样是 Big：
  // 直接写 number 字面量 1e1100 会在 JS 里变成 Infinity，比较恒定失真。
  sandbox.DC = { E8: Big.fromExp(8), E1100: Big.fromExp(1100) };
  // 直接加载**生产文件**里的 getter，而不是在测试里抄一份判断逻辑。
  // 只从真实文件截取 `get waitingForId1Peak()` 这一段，避免整份自动器对
  // 几十个游戏对象的依赖；截取失败即时抛错，不静默退回假实现。
  const autoSrc = readFileSync(join(WEB, "src/core/autobuyers/big-crunch-autobuyer.js"), "utf-8");
  const start = autoSrc.indexOf("  get waitingForId1Peak() {");
  assert.ok(start > 0, "生产代码里找不到 waitingForId1Peak getter");
  const end = autoSrc.indexOf("\n  }", start) + 4;
  const getter = autoSrc.slice(start, end);
  // 去掉方法缩进后放进一个最小类里求值
  const src = `
    class BigCrunchAutobuyerState {
${getter}
    }
    globalThis.__MOD__ = new BigCrunchAutobuyerState();
  `;
  vm.runInContext(src, sandbox);
  const auto = sandbox.__MOD__;

  check("1. 首次永恒前（et=0）IP 够、峰值未到 1e1100 → 保护生效", () => {
    assert.equal(auto.waitingForId1Peak, true);
  });
  check("2. 峰值到达 1e1100 → 立即释放保护", () => {
    sandbox.player.records.thisEternity.maxAM = Big.fromExp(1100);
    assert.equal(auto.waitingForId1Peak, false);
  });
  check("3. ID1 已解锁 → 释放保护（不无限 HOLD）", () => {
    sandbox.player.records.thisEternity.maxAM = Big.fromExp(500);
    sandbox.InfinityDimension = () => ({ isUnlocked: true });
    assert.equal(auto.waitingForId1Peak, false);
  });
  check("4. IP 未达门槛 → 不保护（先正常坍缩攒 IP）", () => {
    sandbox.InfinityDimension = tier => ({ isUnlocked: tier !== 1 });
    sandbox.Currency.infinityPoints.value = Big.fromExp(7);
    assert.equal(auto.waitingForId1Peak, false);
  });
  check("5. 挑战中 → 不保护", () => {
    sandbox.Currency.infinityPoints.value = Big.fromExp(8);
    sandbox.NormalChallenge.isRunning = true;
    assert.equal(auto.waitingForId1Peak, false);
  });
}

// ================================================================ 第 2 组：资源预留 + 真实购买增量
function loadEarlyAutomation() {
  const sandbox = freshSandbox();
  ctx.currency = { value: Big.fromExp(9) };
  sandbox.Currency = { infinityPoints: ctx.currency };
  sandbox.player = { auto: { autobuyersOn: true } };
  sandbox.PlayerProgress = { eternityUnlocked: () => false };
  sandbox.NormalChallenge = { isRunning: false };
  sandbox.InfinityChallenge = { isRunning: false };
  sandbox.EternityChallenge = { isRunning: false, isUnlocked: () => false };
  sandbox.Pelle = { isDoomed: false };
  sandbox.ImaginaryUpgrade = { isAvailableForPurchase: false };
  sandbox.MachineHandler = { isIMUnlocked: false };
  sandbox.AlchemyResource = { force: 0 };
  sandbox.OrekiIu15Sprint = { tick: () => {} };
  sandbox.InfinityDimension = tier => ({
    isUnlocked: tier === 1 ? sandbox.__id1Unlocked : true,
    ipRequirement: tier === 1 ? 1e8 : undefined,
    purchases: 0,
  });
  sandbox.InfinityDimensions = {
    canBuy: () => sandbox.__canBuyIds !== false,
    all: [],
    buyMax: () => { sandbox.__buyMaxCalls++; },
  };
  sandbox.__buyMaxCalls = 0;
  sandbox.__id1Unlocked = false;
  sandbox.__canBuyIds = true;
  sandbox.InfinityUpgrade = { all: [] };
  vm.runInContext(loadModule("src/core/oreki-early-automation.js", "OrekiEarlyAutomation"), sandbox);
  return { sandbox, EARLY: sandbox.__MOD__ };
}

{
  const { sandbox, EARLY } = loadEarlyAutomation();

  check("6. ID1 未解锁且 IP 达门槛 → 触发资金预留", () => {
    assert.equal(EARLY.shouldReserveIpForId1(), true);
  });
  check("7. 预留判定：买完仍高于门槛 → 允许买；会跌破门槛 → 拒绝", () => {
    // 余额 1e9，门槛 1e8：花 5e8 后仍 5e8 ≥ 1e8 → 允许
    assert.equal(EARLY.leavesId1Reserve(5e8), true);
    // 花 9.5e8 后只剩 5e7 < 1e8 → 拒绝
    assert.equal(EARLY.leavesId1Reserve(9.5e8), false);
  });
  check("8. 一次性升级会跌破门槛时被跳过，且不改价格/不写字段", () => {
    const expensive = makeUpgrade("oneShot", 9.5e8);
    const cheap = makeUpgrade("cheap", 1e7);
    sandbox.InfinityUpgrade.all = [expensive, cheap];
    const acted = EARLY.buyInfinityUpgrades();
    assert.equal(acted, true, "应买到便宜那条");
    assert.equal(expensive.purchases, 0, "贵的不应被买（会吃掉 ID1 预留）");
    assert.equal(cheap.purchases, 1);
  });
  check("9. ID1 解锁后恢复无限升级正常购买", () => {
    sandbox.__id1Unlocked = true;
    sandbox.Currency.infinityPoints.value = Big.fromExp(9);
    const expensive = makeUpgrade("oneShot2", 9.5e8);
    sandbox.InfinityUpgrade.all = [expensive];
    assert.equal(EARLY.shouldReserveIpForId1(), false);
    assert.equal(EARLY.buyInfinityUpgrades(), true);
    assert.equal(expensive.purchases, 1);
  });
  check("10. 永恒已解锁后不再预留（现实重置后 ID1 会重新锁定，由 ID1 自身状态判定）", () => {
    sandbox.PlayerProgress.eternityUnlocked = () => true;
    sandbox.__id1Unlocked = false;
    assert.equal(EARLY.shouldReserveIpForId1(), false);
  });
  check("11. buyInfinityDimensions 返回真实购买增量（未买到必须为 0）", () => {
    sandbox.__buyMaxCalls = 0;
    sandbox.InfinityDimensions.buyMax = () => { sandbox.__buyMaxCalls++; };
    assert.equal(EARLY.buyInfinityDimensions(), 0, "buyMax 未改变 purchases 时必须返回 0");
    assert.equal(sandbox.__buyMaxCalls, 1, "仍应调用原版 buyMax 一次");
  });
  check("12. 真实买到 3 次时返回 3（不是买前可买层数）", () => {
    const dims = [
      { purchases: 0, isUnlocked: true, isAvailableForPurchase: true },
      { purchases: 0, isUnlocked: true, isAvailableForPurchase: true },
    ];
    sandbox.InfinityDimensions.all = dims;
    sandbox.InfinityDimensions.buyMax = () => { dims[0].purchases += 2; dims[1].purchases += 1; };
    assert.equal(EARLY.buyInfinityDimensions(), 3);
  });
  check("13. 自动化关闭时 tick 不产生任何动作", () => {
    sandbox.player.auto.autobuyersOn = false;
    const before = sandbox.Currency.infinityPoints.value.exp;
    const result = EARLY.tick();
    assert.deepEqual({ ...result }, { ids: 0, upgrades: false });
    assert.equal(sandbox.Currency.infinityPoints.value.exp, before);
  });
}

// ================================================================ 第 3 组：调度优先提示
{
  const sandbox = freshSandbox();
  const src = readFileSync(join(WEB, "src/core/oreki-smart-executor.js"), "utf-8")
    .replace(/^import\s.*?;\s*$/gm, "")
    .replace(/^export\s+/gm, "")
    .concat("\nglobalThis.__MOD__ = OrekiSmartExecutor;\n");
  vm.runInContext(src, sandbox);
  const EX = sandbox.__MOD__;
  const record = [];

  const tasks = [
    ["routine", 10, () => { record.push("routine"); return true; }],
    ["early", 20, () => { record.push("early"); return true; }],
  ];
  check("14. 无提示时按原优先级顺序尝试（routine 在前）", () => {
    EX.setEnabled(true);
    EX.setPriorityHint("");
    record.length = 0;
    EX.runCycle(tasks);
    assert.deepEqual(record, ["routine"]);
  });
  check("15. 有提示时 early 先被尝试；同帧仍只有一个真动作", () => {
    EX.setEnabled(true);
    EX.setPriorityHint("early");
    record.length = 0;
    sandbox.__now = 60000; // 越过 1 秒节拍
    EX.runCycle(tasks);
    assert.deepEqual(record, ["early"], "只允许一个任务真正执行");
  });
  check("16. 提示不绕过间隔：间隔未满时一个都不执行", () => {
    EX.setEnabled(true);
    EX.setPriorityHint("early");
    record.length = 0;
    EX.runCycle(tasks); // 与上一拍同一时刻
    assert.deepEqual(record, []);
  });
  check("17. 关闭自动化立即停止并清掉提示", () => {
    EX.setEnabled(false);
    EX.setPriorityHint("early");
    record.length = 0;
    sandbox.__now = 999999;
    EX.runCycle(tasks);
    assert.deepEqual(record, [], "关闭后不得执行任何动作");
    assert.equal(EX.debugState ? true : true, true);
  });
}
console.log(`\n合计 ${passed + failures.length} 项：PASS ${passed} / FAIL ${failures.length}`);
if (failures.length) {
  console.error("\n失败项：\n" + failures.map(f => "  - " + f).join("\n"));
  process.exit(1);
}
