#!/usr/bin/env node
/**
 * R93 Web 前期：「计数频率」是否被同一次调用里的维度提升 / 星系重置清零？
 *
 * 缺陷（生产代码证据）：
 *   · `softReset()`（src/core/dimboost.js:200-206）在 `!canKeepDimensions` 时执行
 *     `AntimatterDimensions.reset(); player.sacrificed = DC.D0; resetTickspeed();`
 *   · `resetTickspeed()`（src/core/tickspeed.js:71-73）把 `player.totalTickBought = 0`
 *   · 本阶段 `canKeepDimensions` 依赖现实级 Perk `antimatterNoReset`，首次永恒前不存在
 *   ⇒ 每一次维度提升 / 星系重置都会把计数频率清零。
 *   旧顺序 `buyMaxTickSpeed()` 在最前面（R92 版 game.js），于是同一次调用里
 *   刚花钱买到的计数频率立刻被重置清零：反物质白扣、倍率不生效。
 *
 * 本夹具直接抽取生产代码 `tryOrekiEarlyRoutine()` 与三个辅助函数，
 * 桩里**如实模拟 resetTickspeed() 的清零行为**，断言：
 *   1. 计数频率购买排在维度提升 / 星系重置之后；
 *   2. 调用结束时 `player.totalTickBought > 0`（买到的没被清掉）；
 *   3. 没有重置发生时仍然照常购买计数频率（功能未丢）。
 *
 * 用法：node scripts/test-r93-tickspeed-order.mjs
 * 退出码 0 = 全部通过。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

/** 最小 Decimal 垫片（理由见 test-r92：根 package.json type=commonjs 阻断 ESM .js 解析）。 */
class Decimal {
  constructor(value) { this.value = Number(value); }
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

function extractConst(relPath, name) {
  const source = readFileSync(join(WEB, relPath), "utf-8");
  const match = source.match(new RegExp(`^const ${name} = .*;$`, "m"));
  assert.ok(match, `生产代码里找不到 const ${name}`);
  return match[0];
}

/**
 * 构造早期世界。桩严格照原版行为：
 * - `requestDimensionBoost` / `requestGalaxyReset` 成功后调用 `resetTickspeed()` 的等价物
 *   （`player.totalTickBought = 0` + 维度数量清零）；
 * - `buyMaxTickSpeed()` 真实消耗「反物质」并递增 `player.totalTickBought`。
 */
function createWorld(opt = {}) {
  const calls = [];
  const boostCount = opt.boosts ?? 0;
  const galaxyCount = opt.galaxies ?? 0;
  const sandbox = {
    console, Math, Object, Array, Number, String, JSON, Boolean, Error, Decimal,
    globalThis: null,
  };
  sandbox.globalThis = sandbox;
  sandbox.player = {
    auto: { autobuyersOn: true, sacrifice: { multiplier: 2 } },
    break: opt.break !== false,
    totalTickBought: 0,
    dimensionBoosts: 0,
    galaxies: 0,
    sacrificed: new Decimal(0),
  };
  sandbox.Currency = { antimatter: { value: new Decimal("1e100") } };
  sandbox.NormalChallenge = { isRunning: false };
  sandbox.InfinityChallenge = { isRunning: false };
  sandbox.EternityChallenge = { isRunning: false };
  sandbox.Pelle = { isDoomed: false };
  sandbox.Player = { canCrunch: false };
  sandbox.DimBoost = {
    get canBeBought() { return sandbox.player.dimensionBoosts < boostCount; },
  };
  sandbox.Galaxy = {
    get canBeBought() { return sandbox.player.galaxies < galaxyCount; },
  };
  sandbox.Sacrifice = { canSacrifice: false, nextBoost: new Decimal(1) };
  sandbox.AntimatterDimension = () => ({
    amount: new Decimal(0),
    isAvailableForPurchase: false,
    isAffordable: false,
  });
  // 原版 resetTickspeed()：totalTickBought = 0（src/core/tickspeed.js:71-73）
  sandbox.__resetTickspeed = () => { sandbox.player.totalTickBought = 0; };
  sandbox.buyMaxTickSpeed = () => {
    calls.push("tickspeed");
    sandbox.player.totalTickBought += 1;
  };
  sandbox.requestDimensionBoost = () => {
    calls.push("dimboost");
    if (sandbox.player.dimensionBoosts >= boostCount) return;
    sandbox.player.dimensionBoosts += 1;
    sandbox.__resetTickspeed();     // softReset → resetTickspeed()
  };
  sandbox.requestGalaxyReset = () => {
    calls.push("galaxy");
    if (sandbox.player.galaxies >= galaxyCount) return;
    sandbox.player.galaxies += 1;
    sandbox.__resetTickspeed();     // galaxyReset → softReset(0) → resetTickspeed()
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

// ================================================== 第 1 组：有重置时的顺序与存活
{
  const world = createWorld({ boosts: 3, galaxies: 2 });
  world.routine();
  check("1. 计数频率购买排在维度提升/星系重置之后", () => {
    const lastReset = Math.max(world.calls.lastIndexOf("dimboost"), world.calls.lastIndexOf("galaxy"));
    const tick = world.calls.indexOf("tickspeed");
    assert.ok(lastReset >= 0, `没有发生重置：${world.calls.join(">")}`);
    assert.ok(tick > lastReset, `调用顺序：${world.calls.join(">")}`);
  });
  check("2. 调用结束时计数频率没有被同拍重置清零（totalTickBought > 0）", () => {
    assert.ok(world.sandbox.player.totalTickBought > 0,
      `totalTickBought=${world.sandbox.player.totalTickBought}（0 表示刚买的被清掉了）`);
  });
  check("3. 批量重置仍然全部完成（R92 行为未回退）", () => {
    assert.equal(world.sandbox.player.dimensionBoosts, 3);
    assert.equal(world.sandbox.player.galaxies, 2);
  });
}

// ================================================== 第 2 组：无重置时功能不丢
{
  const world = createWorld({ boosts: 0, galaxies: 0 });
  world.routine();
  check("4. 没有重置发生时仍照常购买计数频率", () => {
    assert.equal(world.sandbox.player.totalTickBought, 1);
    assert.ok(world.calls.includes("tickspeed"));
  });
}

// ================================================== 第 3 组：旧顺序会失败（回归防线）
{
  // 直接模拟旧顺序：先买计数频率，再做一次重置 —— 必须被清零，
  // 证明本夹具确实能捕捉到该缺陷（不是恒真断言）。
  const world = createWorld({ boosts: 1, galaxies: 0 });
  world.sandbox.buyMaxTickSpeed();
  world.sandbox.requestDimensionBoost(true);
  check("5. 旧顺序（先买后重置）确实会清零 totalTickBought —— 夹具能捕捉缺陷", () => {
    assert.equal(world.sandbox.player.totalTickBought, 0);
  });
}

console.log(`\nR93 定向测试：${passed}/${passed + failures.length} 通过`);
if (failures.length) {
  console.log("失败项：");
  for (const line of failures) console.log(`  - ${line}`);
  process.exit(1);
}
