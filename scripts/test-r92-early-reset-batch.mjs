#!/usr/bin/env node
/**
 * R92 Web 前期「维度提升 / 反物质星系」购买器漏买自测（Node 直跑，无需浏览器）。
 *
 * 目的：直接加载**生产代码**（`src/game.js` 原样抽取，不复制逻辑），证明：
 *
 *   1. 首次无限前 `requestDimensionBoost(true)` / `requestGalaxyReset(true)` 的
 *      `bulk` 参数是**无效的**（批量的前置分别是 Break Infinity 升级 5e9 IP
 *      与 9 次永恒的里程碑，见 src/core/dimboost.js:239-245、src/core/galaxy.js:151-158），
 *      一次调用只买 1 个 —— 旧实现的 `routine` 每拍（默认 10 s）就只买 1 个。
 *   2. R92 修法后，**同一次调度动作内**买光当前买得起的次数，仍全部走原版
 *      `requestDimensionBoost` / `requestGalaxyReset`（真实 softReset、真实递增要求）。
 *   3. 要求不满足时原版函数原地返回，循环必须能**退出**（不允许死循环）。
 *   4. 顺序仍是「先重置类动作、再买反物质维度」（AD16），总开关关闭时一个都不买。
 *
 * 用法：node scripts/test-r92-early-reset-batch.mjs
 * 退出码 0 = 全部通过。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB = join(__dirname, "..");

/**
 * 最小 Decimal 垫片：只实现被测代码实际用到的比较/四则。
 *
 * 为什么不用 `import Decimal from "../modules/break_infinity.js"`：
 * 该文件是 ESM 语法但扩展名是 `.js`，解析结果取决于最近的 package.json。
 * 工作区根 package.json 目前是 `"type": "commonjs"`（2026-11-07 起），
 * 直接 import 会抛 `Unexpected token 'export'` —— 与本轮被测逻辑无关的环境问题。
 * 夹具自带垫片后，行为判据只依赖生产代码本身。
 */
class Decimal {
  constructor(value) {
    this.value = Number(value);
  }
  static max(a, b) {
    const left = a instanceof Decimal ? a.value : Number(a);
    const right = b instanceof Decimal ? b.value : Number(b);
    return new Decimal(Math.max(left, right));
  }
  eq(other) { return this.value === (other instanceof Decimal ? other.value : Number(other)); }
  gt(other) { return this.value > (other instanceof Decimal ? other.value : Number(other)); }
  gte(other) { return this.value >= (other instanceof Decimal ? other.value : Number(other)); }
  lt(other) { return this.value < (other instanceof Decimal ? other.value : Number(other)); }
  minus(other) { return new Decimal(this.value - (other instanceof Decimal ? other.value : Number(other))); }
  times(other) { return new Decimal(this.value * (other instanceof Decimal ? other.value : Number(other))); }
  plus(other) { return new Decimal(this.value + (other instanceof Decimal ? other.value : Number(other))); }
}

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

/** 从生产文件里抽取一个函数（按花括号配对），避免在测试里抄一份逻辑。 */
function extractFunction(relPath, signature) {
  const source = readFileSync(join(WEB, relPath), "utf-8");
  const start = source.indexOf(signature);
  assert.ok(start >= 0, `生产代码里找不到 ${signature}`);
  let depth = 0;
  for (let i = source.indexOf("{", start); i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`函数体不完整：${signature}`);
}

/** 抽取模块级 const 声明（单行）。 */
function extractConst(relPath, name) {
  const source = readFileSync(join(WEB, relPath), "utf-8");
  const match = source.match(new RegExp(`^const ${name} = .*;$`, "m"));
  assert.ok(match, `生产代码里找不到 const ${name}`);
  return match[0];
}

/**
 * 构造一个最小但形状真实的早期世界。
 *
 * @param {object} opt
 * @param {number} [opt.boostAffordable]  还能买几次维度提升（0 = 买不动）
 * @param {number} [opt.galaxyAffordable] 还能买几次星系
 * @param {boolean} [opt.boostStuck]      true = canBeBought 恒真但买了不生效（要求不满足）
 * @param {boolean} [opt.throwOnBoost]    true = 购买函数抛错
 */
function createRoutineWorld(opt = {}) {
  const calls = [];
  const sandbox = {
    console, Math, Object, Array, Number, String, JSON, Boolean, Error, Decimal,
    globalThis: null,
  };
  sandbox.globalThis = sandbox;

  const boostLimit = opt.boostAffordable ?? 0;
  const galaxyLimit = opt.galaxyAffordable ?? 0;
  sandbox.player = {
    auto: { autobuyersOn: opt.autobuyersOn !== false, sacrifice: { multiplier: 2 } },
    break: opt.break !== false,
    totalTickBought: 0,
    dimensionBoosts: 0,
    galaxies: 0,
    sacrificed: new Decimal(0),
  };
  sandbox.Currency = { antimatter: { value: new Decimal("1e10") } };
  sandbox.NormalChallenge = { isRunning: opt.challenge === true };
  sandbox.InfinityChallenge = { isRunning: false };
  sandbox.EternityChallenge = { isRunning: false };
  sandbox.Pelle = { isDoomed: false };
  sandbox.Player = { canCrunch: false };
  // canBeBought 与生产一致：只看次数上限/挑战，**不检查要求**（要求由购买函数内部判）。
  // 因此这里恒为真，由 `requestDimensionBoost` 桩按「要求是否满足」决定是否真的加计数。
  sandbox.DimBoost = {
    get canBeBought() {
      return true;
    },
  };
  sandbox.__antimatterSeen = [];
  sandbox.Galaxy = {
    get canBeBought() {
      return sandbox.player.galaxies < galaxyLimit;
    },
  };
  sandbox.Sacrifice = { canSacrifice: false, nextBoost: new Decimal(1) };
  sandbox.AntimatterDimension = () => ({
    amount: new Decimal(0),
    isAvailableForPurchase: false,
    isAffordable: false,
  });
  sandbox.buyMaxTickSpeed = () => { calls.push("tickspeed"); };
  sandbox.requestDimensionBoost = () => {
    calls.push("dimboost");
    sandbox.__antimatterSeen.push(sandbox.Currency.antimatter.value.value);
    if (opt.throwOnBoost) throw new Error("boom");
    // 要求不满足时原版函数原地返回，计数不变
    if (opt.boostStuck) return;
    // 不保留反物质时，softReset 已把反物质清零 ⇒ 下一次提升的要求不再满足
    if (opt.keepAntimatter === false && sandbox.Currency.antimatter.value.value <= 0) return;
    if (sandbox.player.dimensionBoosts >= boostLimit) return;
    sandbox.player.dimensionBoosts += 1;
    // 不保留反物质时 softReset 会清空反物质 ⇒ 下一次提升的要求不再满足
    // （对应生产里 OrekiKeepAntimatter.active 为假的场景）。
    if (opt.keepAntimatter === false) sandbox.Currency.antimatter.value = new Decimal(0);
  };
  sandbox.requestGalaxyReset = () => {
    calls.push("galaxy");
    sandbox.player.galaxies += 1;
    return true;
  };
  sandbox.sacrificeReset = () => { calls.push("sacrifice"); return true; };
  sandbox.buyMaxDimension = tier => { calls.push(`dim${tier}`); };
  sandbox.bigCrunchResetRequest = () => { calls.push("crunch"); };

  vm.createContext(sandbox);
  const fnSource = [
    extractConst("src/game.js", "MAX_EARLY_RESET_BATCH"),
    extractFunction("src/game.js", "function buyAffordableDimensionBoosts()"),
    extractFunction("src/game.js", "function buyAffordableGalaxies()"),
    extractFunction("src/game.js", "export function tryOrekiEarlyRoutine()").replace(/^export\s+/, ""),
    extractFunction("src/game.js", "function earlyRoutineSnapshot()"),
    extractFunction("src/game.js", "function earlyRoutineChanged(before)"),
  ].join("\n");
  vm.runInContext(`${fnSource}\nglobalThis.__ROUTINE__ = tryOrekiEarlyRoutine;`, sandbox);
  return { sandbox, routine: sandbox.__ROUTINE__, calls };
}

// =============================================== 第 1 组：一次调用买光买得起的提升
{
  const world = createRoutineWorld({ boostAffordable: 5, galaxyAffordable: 3 });
  const acted = world.routine();
  check("1. 一次 routine 调用买光 5 次维度提升（旧实现只买 1 次）", () => {
    assert.equal(world.sandbox.player.dimensionBoosts, 5);
  });
  check("2. 一次 routine 调用买光 3 次星系（旧实现只买 1 次）", () => {
    assert.equal(world.sandbox.player.galaxies, 3);
  });
  check("3. 批量购买返回真实动作回执（供调度器判断是否占拍）", () => {
    assert.equal(acted, true);
  });
  check("4. 每次都真的走了原版购买入口（5 次成功 + 1 次要求不满足后退出）", () => {
    const boosts = world.calls.filter(c => c === "dimboost").length;
    const galaxies = world.calls.filter(c => c === "galaxy").length;
    assert.equal(boosts, 6, `提升尝试 ${boosts} 次`);
    assert.equal(galaxies, 3);
  });
}

// =============================================== 第 2 组：顺序仍然遵守 AD16
{
  const world = createRoutineWorld({ boostAffordable: 2, galaxyAffordable: 1 });
  world.routine();
  check("5. 重置类动作（提升/星系）排在买反物质维度之前", () => {
    const firstDimBuy = world.calls.findIndex(c => /^dim\d+$/.test(c));
    const lastReset = Math.max(
      world.calls.lastIndexOf("dimboost"),
      world.calls.lastIndexOf("galaxy"),
      world.calls.lastIndexOf("sacrifice"));
    assert.ok(lastReset >= 0);
    if (firstDimBuy >= 0) assert.ok(lastReset < firstDimBuy, `调用顺序：${world.calls.join(">")}`);
  });
}

// =============================================== 第 3 组：要求不满足时必须退出
{
  const world = createRoutineWorld({ boostStuck: true });
  let acted;
  const started = Date.now();
  try {
    acted = world.routine();
  } finally { /* 只要返回就说明没有死循环 */ }
  const elapsed = Date.now() - started;
  check("6. canBeBought 恒真但要求不满足时循环立即退出（不死循环）", () => {
    assert.ok(elapsed < 1000, `耗时 ${elapsed} ms`);
    assert.equal(world.sandbox.player.dimensionBoosts, 0);
  });
  check("7. 一个真实变化都没有时 routine 返回 false（不占调度节拍）", () => {
    assert.equal(acted, false);
  });
  check("8. 无进展时最多尝试一次，不会重复空转", () => {
    assert.equal(world.calls.filter(c => c === "dimboost").length, 1);
  });
}

// =============================================== 第 4 组：异常与开关边界
{
  const world = createRoutineWorld({ boostAffordable: 5, throwOnBoost: true });
  let acted;
  const started = Date.now();
  acted = world.routine();
  check("9. 购买函数抛错时被就地捕获、不死循环", () => {
    assert.ok(Date.now() - started < 1000);
    assert.equal(world.sandbox.player.dimensionBoosts, 0);
    assert.equal(acted, false);
  });
}

{
  const world = createRoutineWorld({ boostAffordable: 5, galaxyAffordable: 3, autobuyersOn: false });
  const acted = world.routine();
  check("10. 自动购买器总开关关闭时一个都不买", () => {
    assert.equal(acted, false);
    assert.equal(world.sandbox.player.dimensionBoosts, 0);
    assert.equal(world.sandbox.player.galaxies, 0);
  });
}

{
  const world = createRoutineWorld({ boostAffordable: 5, galaxyAffordable: 3, challenge: true });
  const acted = world.routine();
  check("11. 挑战进行中一个都不买", () => {
    assert.equal(acted, false);
    assert.equal(world.sandbox.player.dimensionBoosts, 0);
    assert.equal(world.sandbox.player.galaxies, 0);
  });
}

// =============================================== 第 5 组：批量上限常量本身
{
  const world = createRoutineWorld({ boostAffordable: 1000 });
  world.routine();
  check("12. 硬上限 MAX_EARLY_RESET_BATCH 生效（异常数值下不会无限买）", () => {
    const boosts = world.calls.filter(c => c === "dimboost").length;
    assert.ok(boosts <= 100, `实际调用 ${boosts} 次`);
  });
}

// =============================================== 第 6 组：字段名与「要求持续满足」语义
//
// 这一组针对真实生产缺陷（R92 初版）：批量循环用 `player.dimBoosts` 取计数，
// 而原版真实字段是 `player.dimensionBoosts`（src/core/player.js:210）。
// `player.dimBoosts` 恒为 undefined ⇒ `before` 与购买后都读到 undefined
// ⇒ `undefined === undefined` 立即 break ⇒ 每次仍只买 1 个，批量完全失效。
// 夹具里**故意只定义 `dimensionBoosts`**（不定义 `dimBoosts`），
// 任何回退到错误字段名的写法都会让下面第 13 项直接失败。
{
  // 保留反物质（src/core/oreki-keep-antimatter.js 的窗口 + dimboost.js:210 的
  // `canKeepAntimatter`）后，下一次提升的要求仍可能满足 ⇒ 一次调用应连续买多个。
  const world = createRoutineWorld({ boostAffordable: 4, keepAntimatter: true });
  const acted = world.routine();
  check("13. 保留反物质使要求持续满足时，一次调用连续买 4 次提升", () => {
    assert.equal(world.sandbox.player.dimensionBoosts, 4,
      `实际买到 ${world.sandbox.player.dimensionBoosts} 次（1 次说明字段名或守卫失效）`);
    assert.equal(acted, true);
  });
  check("14. 保留反物质窗口内反物质余额不被清空（AD4 结算语义）", () => {
    const seen = world.sandbox.__antimatterSeen;
    assert.ok(seen.length >= 4, `只记录了 ${seen.length} 次`);
    assert.ok(seen.every(v => v === seen[0]), `反物质余额发生变化：${seen.join(",")}`);
  });
}

{
  // 要求只满足 1 次：买到第 2 次时原版 `requestDimensionBoost` 原地返回，
  // 计数不变 ⇒ 循环必须立刻停，不能靠上限硬撑到 100 次。
  const world = createRoutineWorld({ boostAffordable: 1, keepAntimatter: true });
  world.routine();
  check("15. 要求只满足 1 次时只买 1 次就停（不空转到上限）", () => {
    assert.equal(world.sandbox.player.dimensionBoosts, 1);
    const attempts = world.calls.filter(c => c === "dimboost").length;
    assert.equal(attempts, 2, `实际尝试 ${attempts} 次（应为 1 次成功 + 1 次失败后退出）`);
  });
}

{
  // 不保留反物质（OrekiKeepAntimatter 窗口之外）：第 1 次提升后反物质被清空，
  // 第 2 次的要求不再满足 ⇒ 只能买 1 次。证明循环是「按真实要求」停，不是按次数硬撑。
  const world = createRoutineWorld({ boostAffordable: 5, keepAntimatter: false });
  world.routine();
  check("16. 不保留反物质时只买 1 次（要求驱动，不是次数驱动）", () => {
    assert.equal(world.sandbox.player.dimensionBoosts, 1,
      `实际买到 ${world.sandbox.player.dimensionBoosts} 次`);
  });
}

console.log(`\nR92 定向测试：${passed}/${passed + failures.length} 通过`);
if (failures.length) {
  console.log("失败项：");
  for (const line of failures) console.log(`  - ${line}`);
  process.exit(1);
}
