#!/usr/bin/env node
/**
 * R87 Web 首次无限 → 首次永恒提速：Break 升级是否绕过 ID1 资金预留
 *
 * 目的：直接加载**生产代码**做行为夹具，而不是查字符串。参与求值的真实文件：
 *   · src/core/oreki-autobuy-break-infinity.js      —— 被测的自动购买入口
 *   · src/core/oreki-early-automation.js           —— ID1 预留判据的唯一来源
 *   · src/core/break-infinity-upgrades.js          —— 真实的升级状态类
 *   · src/core/game-mechanics/*.js                 —— 真实的 purchase() / canBeBought
 *   · src/core/secret-formula/infinity/break-infinity-upgrades.js —— 真实价格表
 *   · src/core/autobuyers/big-crunch-autobuyer.js  —— 真实 waitingForId1Peak getter
 *   · modules/break_infinity.js                    —— 真实 Decimal 实现
 * 只有游戏全局对象（player / Currency / 挑战状态）用形状一致的垫片替代。
 *
 * 为什么必须验这条链：
 *   1. ID1 的解锁门槛是 `maxAM ≥ 1e1100` **且** `IP ≥ 1e8`（infinity-dimension.js:87-101）；
 *   2. 首次永恒前，大坍缩自动器靠 `waitingForId1Peak`（big-crunch-autobuyer.js:170-186）
 *      在 `IP ≥ 1e8` 时暂停坍缩，否则每次坍缩都把反物质清零、峰值永远到不了 1e1100；
 *   3. R82 只给 `InfinityUpgrade` 加了预留；Break 升级由 `breakUpgrades` 任务独立购买，
 *      其预算判据是「单笔 ≤ 当前 IP 的一半」——这条判据只能保证不腰斩，
 *      **不能保证余额仍在 1e8 之上**。IP 刚好在门槛附近时，一笔 1e4 的升级就能把余额压到门槛以下。
 *
 * 用法：node scripts/test-r87-break-id1-reserve.mjs
 * 退出码 0 = 全部通过。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";
import Decimal from "../modules/break_infinity.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB = join(__dirname, "..");

let passed = 0;
const failures = [];
/** 统一断言包装：记录真实通过/失败数量，而不是只依赖第一个异常。 */
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

/** 去掉 import/export，把指定的顶层声明挂到 sandbox 全局（vm 的 class/let 不会自动成为全局）。 */
function loadDefs(sandbox, relPath, names) {
  let source = readFileSync(join(WEB, relPath), "utf-8")
    .replace(/^import\s.*?;\s*$/gm, "")
    .replace(/^export\s+/gm, "");
  if (names.length) source += `\n${names.map(n => `globalThis.${n} = ${n};`).join("\n")}\n`;
  vm.runInContext(source, sandbox, { filename: relPath });
}

/** 取出生产文件里的一个方法/函数表达式，避免在测试里抄一份逻辑。 */
function extractMethod(relPath, signature) {
  const source = readFileSync(join(WEB, relPath), "utf-8");
  const start = source.indexOf(signature);
  assert.ok(start > 0, `生产代码里找不到 ${signature}`);
  const end = source.indexOf("\n  }", start) + 4;
  return source.slice(start, end);
}

function makeCurrency(initial) {
  return {
    _value: new Decimal(initial),
    get value() { return this._value; },
    set value(v) { this._value = v; },
    gte(x) { return this._value.gte(x); },
    gt(x) { return this._value.gt(x); },
    lt(x) { return this._value.lt(x); },
    lte(x) { return this._value.lte(x); },
    subtract(x) { this._value = this._value.minus(x); return this._value; },
    add(x) { this._value = this._value.plus(x); return this._value; },
    purchase(x) {
      if (this._value.lt(x)) return false;
      this._value = this._value.minus(x);
      return true;
    },
  };
}

/**
 * 构造一个「真实生产代码 + 最小游戏全局」的世界。
 * @param {{ip?: string, id1Unlocked?: boolean, eternityUnlocked?: boolean, break?: boolean,
 *          autobuyersOn?: boolean, smartEnabled?: boolean, maxAM?: string}} opt
 */
function createWorld(opt = {}) {
  const sandbox = {
    console, Math, Object, Array, Number, String, JSON, Boolean, Error, Date, Set, Map,
    Decimal,
    window: null,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  sandbox.NotImplementedError = class NotImplementedError extends Error {};
  sandbox.GameUI = { update() {} };
  sandbox.GameEnd = { creditsEverClosed: false };

  sandbox.player = {
    break: opt.break !== false,
    auto: { autobuyersOn: opt.autobuyersOn !== false },
    infinityUpgrades: new Set(),
    infinityRebuyables: { 0: 0, 1: 0, 2: 0 },
    records: { thisEternity: { maxAM: new Decimal(opt.maxAM ?? "1e500") } },
  };
  sandbox.Currency = { infinityPoints: makeCurrency(opt.ip ?? "1e8") };
  sandbox.PlayerProgress = { eternityUnlocked: () => opt.eternityUnlocked === true };
  sandbox.NormalChallenge = { isRunning: false };
  sandbox.InfinityChallenge = { isRunning: false };
  sandbox.EternityChallenge = { isRunning: false, isUnlocked: () => false };
  sandbox.Pelle = { isDoomed: false };
  sandbox.PelleStrikes = { powerGalaxies: { trigger() {} } };
  sandbox.SpeedrunMilestones = () => ({ tryComplete() {} });
  sandbox.GameCache = {
    tickSpeedMultDecrease: { invalidate() {} },
    dimensionMultDecrease: { invalidate() {} },
  };
  sandbox.OrekiSmartExecutor = { enabled: opt.smartEnabled !== false };
  sandbox.OrekiIu15Sprint = { tick() {}, active: false };
  sandbox.InfinityDimension = tier => ({
    isUnlocked: tier === 1 ? opt.id1Unlocked === true : true,
    ipRequirement: new Decimal("1e8"),
    purchases: 0,
  });
  sandbox.InfinityDimensions = { canBuy: () => true, all: [], buyMax: () => {} };
  sandbox.ImaginaryUpgrade = { isAvailableForPurchase: false };
  sandbox.MachineHandler = { isIMUnlocked: false };
  sandbox.AlchemyResource = { force: 0 };
  sandbox.DC = { E8: new Decimal("1e8"), E1100: new Decimal("1e1100") };

  // 真实购物车基础类（Effect → GameMechanicState → Purchasable/Set/Rebuyable）
  loadDefs(sandbox, "src/core/game-mechanics/effect.js", ["Effect"]);
  loadDefs(sandbox, "src/core/game-mechanics/game-mechanic.js", ["GameMechanicState"]);
  loadDefs(sandbox, "src/core/game-mechanics/puchasable.js", ["PurchasableMechanicState"]);
  loadDefs(sandbox, "src/core/game-mechanics/set-purchasable.js", ["SetPurchasableMechanicState"]);
  loadDefs(sandbox, "src/core/game-mechanics/rebuyable.js", ["RebuyableMechanicState"]);

  // 真实价格表（secret-formula）→ GameDatabase → 真实升级状态类
  loadDefs(sandbox, "src/core/secret-formula/infinity/break-infinity-upgrades.js", ["breakInfinityUpgrades"]);
  sandbox.GameDatabase = { infinity: { breakUpgrades: sandbox.breakInfinityUpgrades } };
  // mapGameDataToObject 也直接取生产实现（game-database.js:61）
  const gd = readFileSync(join(WEB, "src/core/secret-formula/game-database.js"), "utf-8");
  const mapStart = gd.indexOf("window.mapGameDataToObject");
  assert.ok(mapStart > 0, "生产代码里找不到 mapGameDataToObject");
  // 结束位置取「行首的 };」——函数体内部还有 `const out = {};` 这类 `};` 片段
  const mapEnd = gd.indexOf("\n};", mapStart) + 3;
  assert.ok(mapEnd > mapStart, "mapGameDataToObject 的函数体不完整");
  vm.runInContext(gd.slice(mapStart, mapEnd), sandbox);
  loadDefs(sandbox, "src/core/break-infinity-upgrades.js", ["BreakInfinityUpgrade"]);

  // 真实 ID1 预留判据 + 真实自动购买入口
  loadDefs(sandbox, "src/core/oreki-early-automation.js", ["OrekiEarlyAutomation"]);
  loadDefs(sandbox, "src/core/oreki-autobuy-break-infinity.js", ["tryBuyBreakInfinityUpgrades"]);

  // 真实 waitingForId1Peak getter（big-crunch-autobuyer.js:170-186）
  const getter = extractMethod("src/core/autobuyers/big-crunch-autobuyer.js", "  get waitingForId1Peak() {");
  vm.runInContext(
    `class BigCrunchAutobuyerState {\n${getter}\n}\nglobalThis.__HOLD__ = new BigCrunchAutobuyerState();`,
    sandbox
  );

  return {
    sandbox,
    buy: sandbox.tryBuyBreakInfinityUpgrades,
    hold: sandbox.__HOLD__,
    upgrades: sandbox.BreakInfinityUpgrade,
    byId: id => sandbox.BreakInfinityUpgrade.all.find(u => u.id === id),
    currency: sandbox.Currency.infinityPoints,
    ip: () => sandbox.Currency.infinityPoints.value,
  };
}

const THRESHOLD = new Decimal("1e8");

// ================================================================ 第 1 组：ID1 收购窗口的不变量
// 修复前这组必须失败 —— 那正是本轮要证明的生产缺陷。
{
  const w = createWorld({ ip: "1e8" });
  check("1. IP 恰好等于门槛时，宁可本拍不动，也不得买到门槛以下", () => {
    const bought = w.buy();
    assert.equal(bought, 0, "1e8 时任何一笔都会跌破门槛，本拍必须让位");
    assert.ok(w.ip().eq(THRESHOLD), `余额必须原样保留在 1e8，实际 ${w.ip().toExponential(6)}`);
  });
}

{
  const w = createWorld({ ip: "1.0001e8" });
  check("1b. IP 略高于门槛时，仍然允许买「买完不跌破门槛」的便宜升级", () => {
    assert.equal(w.buy(), 1, "1e4 的升级买完仍剩 1e8，应放行");
    assert.ok(w.ip().gte(THRESHOLD), `购买后 IP=${w.ip().toExponential(6)}`);
    assert.equal(w.byId("totalMult").isBought, true);
  });
}

{
  const w = createWorld({ ip: "1.05e8" });
  check("2. 连续 30 拍自动购买，任何一拍都不得把 IP 压到门槛以下", () => {
    let buys = 0;
    for (let i = 0; i < 30; i++) {
      if (w.buy() === 1) buys++;
      assert.ok(w.ip().gte(THRESHOLD),
        `第 ${i + 1} 拍后 IP=${w.ip().toExponential(6)} < 1e8`);
    }
    assert.ok(buys > 0, "窗口内应仍然买到「买完不跌破门槛」的升级，不能一刀切停买");
  });
}

{
  const w = createWorld({ ip: "1.0001e8", maxAM: "1e500" });
  check("3. 自动购买 Break 升级后，首次 ID1 的「攒峰值」HOLD 不得被解除", () => {
    assert.equal(w.hold.waitingForId1Peak, true, "前置：IP 达标且峰值未到 1e1100，HOLD 应生效");
    assert.equal(w.buy(), 1, "1e4 的升级买完仍剩 1e8，应放行（不是一刀切停买）");
    assert.equal(w.hold.waitingForId1Peak, true,
      `购买后 IP=${w.ip().toExponential(6)}，HOLD 被解除 → 自动坍缩会立刻清零反物质`);
  });
}

{
  const w = createWorld({ ip: "1.05e8" });
  check("4. 便宜升级仍可买，但会跌破门槛的那一档必须拦住", () => {
    // 1e4 / 5e4 / 1e5 / 1e6 都安全；1e7 会把 1.05e8 压到 9.4e7 < 1e8
    for (let i = 0; i < 12; i++) w.buy();
    assert.ok(w.ip().gte(THRESHOLD), `最终 IP=${w.ip().toExponential(6)} < 1e8`);
    assert.equal(w.byId("challengeMult").isBought, false, "1e7 的升级不得在门槛窗口内被买");
    assert.equal(w.byId("infinitiedGeneration").isBought, false, "2e7 的升级不得在门槛窗口内被买");
  });
}

// ================================================================ 第 2 组：不得误伤正常购买
{
  const w = createWorld({ ip: "1e8", id1Unlocked: true });
  check("5. ID1 已解锁 → 预留解除，正常购买", () => {
    assert.equal(w.buy(), 1);
    assert.equal(w.byId("totalMult").isBought, true);
    assert.ok(w.ip().lt(THRESHOLD), "解锁后应允许把余额花到门槛以下");
  });
}

{
  const w = createWorld({ ip: "1e8", eternityUnlocked: true, id1Unlocked: true });
  check("6. 首次永恒之后 → 预留解除，正常购买", () => {
    assert.equal(w.buy(), 1);
    assert.equal(w.byId("totalMult").isBought, true);
  });
}

{
  const w = createWorld({ ip: "5e7" });
  check("7. IP 还没到门槛 → 不预留，照常买最便宜的一条", () => {
    assert.equal(w.buy(), 1);
    assert.equal(w.byId("totalMult").isBought, true);
    assert.ok(w.ip().lt(new Decimal("5e7")));
  });
}

{
  const w = createWorld({ ip: "1e20" });
  check("8. IP 远高于门槛 → 预留不造成停摆（仍按最便宜优先购买）", () => {
    const boughtIds = [];
    for (let i = 0; i < 6; i++) {
      if (w.buy() !== 1) break;
      boughtIds.push(w.upgrades.all.find(u => u.purchases === i + 1)?.id);
    }
    assert.ok(w.byId("totalMult").isBought, "最便宜的 totalMult 应先被买");
    assert.ok(new Decimal(w.ip()).gte(THRESHOLD));
  });
}

{
  const w = createWorld({ ip: "1e8", autobuyersOn: false });
  check("9. 自动购买器总开关关闭 → 一个动作都不做，余额不变", () => {
    assert.equal(w.buy(), 0);
    assert.equal(w.ip().eq(THRESHOLD), true);
    assert.equal(w.byId("totalMult").isBought, false);
  });
}

{
  const w = createWorld({ ip: "1e8", smartEnabled: false });
  check("10. Oreki 智能自动化关闭 → 一个动作都不做，余额不变", () => {
    assert.equal(w.buy(), 0);
    assert.equal(w.ip().eq(THRESHOLD), true);
  });
}

{
  const w = createWorld({ ip: "1e9" });
  check("11. 可重复 Break 升级走真实 config.cost()，购买后计数 +1 且真实扣费", () => {
    // 先把一次性升级全部标记为已买，隔离可重复项
    for (const upgrade of w.upgrades.all) {
      if (!upgrade.config.rebuyable) w.sandbox.player.infinityUpgrades.add(upgrade.id);
    }
    const before = w.ip();
    const costBefore = w.upgrades.tickspeedCostMult.cost;
    assert.equal(w.buy(), 1, "应买到一条可重复升级");
    assert.equal(w.upgrades.tickspeedCostMult.boughtAmount, 1);
    const spent = before.minus(w.ip());
    assert.ok(spent.gt(0), "必须真实扣除 IP");
    assert.ok(spent.eq(costBefore), "扣费应等于原版首级价格（1e6）");
  });
}

{
  const w = createWorld({ ip: "1e9" });
  check("12. 购买走原版 purchase()：位图与余额同步变化，不伪造进度", () => {
    assert.equal(w.buy(), 1);
    assert.equal(w.sandbox.player.infinityUpgrades.has("totalMult"), true);
    assert.ok(w.ip().eq(new Decimal("1e9").minus(1e4)), "余额应正好少 1e4");
  });
}

console.log(`\n合计 ${passed + failures.length} 项：PASS ${passed} / FAIL ${failures.length}`);
if (failures.length) {
  console.error("\n失败项：\n" + failures.map(f => "  - " + f).join("\n"));
  process.exit(1);
}
