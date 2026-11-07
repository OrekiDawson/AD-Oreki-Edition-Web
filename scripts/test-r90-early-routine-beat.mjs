#!/usr/bin/env node
/**
 * R90 Web 首次无限 → 首次永恒：早期例程是否饿死 early 阶段模块
 *
 * 目的：直接加载**生产代码**做行为夹具：
 *   · `src/game.js` 的 `tryOrekiEarlyRoutine()`（原样抽取，不复制逻辑）
 *   · `src/core/oreki-smart-executor.js` 的真实 `runCycle`（R88 后的节拍实现）
 *
 * 证明的缺陷：
 *   R78 把调度器改成「一次真动作 = 全局节拍 + 同帧唯一名额」，no-op 才会顺延。
 *   而 `tryOrekiEarlyRoutine()` 无论有没有真的买到东西都 `return true`，
 *   于是它每拍都被判为「已动作」并吃掉整拍；`early`（无限维度 / 无限升级）
 *   排在 routine 之后，永远轮不到。首次无限之后 ID1 与无限升级都靠 early，
 *   这条饿死链会把「首次无限 → 首次永恒」直接卡死。
 *
 * 用法：node scripts/test-r90-early-routine-beat.mjs
 * 退出码 0 = 全部通过。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

/**
 * 最小 Decimal 垫片：只实现本夹具实际用到的构造与比较。
 *
 * 为什么不用 `import Decimal from "../modules/break_infinity.js"`：该文件是 ESM 语法
 * 但扩展名是 `.js`，解析结果取决于最近的 package.json。工作区根 package.json 目前是
 * `"type": "commonjs"`，直接 import 会抛 `Unexpected token 'export'` —— 与本轮被测
 * 逻辑无关的环境问题。夹具自带垫片后，行为判据只依赖生产代码本身。
 */
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

/**
 * 抽取模块级 const 声明（单行）。
 * [R92] 例程新增 `MAX_EARLY_RESET_BATCH`，vm 沙箱里必须能解析到它。
 */
function extractConst(relPath, name) {
  const source = readFileSync(join(WEB, relPath), "utf-8");
  const match = source.match(new RegExp(`^const ${name} = .*;$`, "m"));
  assert.ok(match, `生产代码里找不到 const ${name}`);
  return match[0];
}

/**
 * 构造一个最小但形状真实的早期世界。
 * @param {{action?: "none"|"tickspeed"|"dimension", resources?: object}} opt
 */
function createRoutineWorld(opt = {}) {
  const action = opt.action ?? "none";
  const calls = [];
  const sandbox = {
    console, Math, Object, Array, Number, String, JSON, Boolean, Error, Decimal,
    globalThis: null,
  };
  sandbox.globalThis = sandbox;
  sandbox.player = {
    auto: {
      autobuyersOn: opt.autobuyersOn !== false,
      sacrifice: { multiplier: 2 },
    },
    break: opt.break !== false,
    totalTickBought: 10,
    dimensionBoosts: 0,
    galaxies: 0,
    sacrificed: new Decimal(0),
  };
  sandbox.Currency = { antimatter: { value: new Decimal("1e10") } };
  sandbox.NormalChallenge = { isRunning: opt.challenge === true };
  sandbox.InfinityChallenge = { isRunning: false };
  sandbox.EternityChallenge = { isRunning: false };
  sandbox.Pelle = { isDoomed: false };
  // [R92] 例程改成「一次调用买光买得起的次数」，因此这里的 canBeBought 必须是
  // **要求驱动**的：买过 1 次之后要求不再满足（本夹具只模拟各买到 1 次）。
  // 若写成恒真静态属性，循环会一直买到 MAX_EARLY_RESET_BATCH。
  sandbox.DimBoost = {
    get canBeBought() { return opt.withDimBoost === true && sandbox.player.dimensionBoosts === 0; },
  };
  sandbox.Galaxy = {
    get canBeBought() { return opt.withGalaxy === true && sandbox.player.galaxies === 0; },
  };
  sandbox.Sacrifice = { canSacrifice: opt.withSacrifice === true, nextBoost: new Decimal(2) };
  sandbox.Player = { canCrunch: opt.withCrunch === true };
  // 访问器必须与生产一致：同一 tier 永远返回同一个状态对象（DimensionState.createAccessor 会缓存）。
  const dimensionStates = new Map();
  sandbox.AntimatterDimension = tier => {
    if (!dimensionStates.has(tier)) {
      dimensionStates.set(tier, {
        amount: new Decimal(tier * 10),
        isAvailableForPurchase: opt.withDimension === true,
        isAffordable: opt.withDimension === true,
      });
    }
    return dimensionStates.get(tier);
  };
  sandbox.AntimatterDimension.all = [1, 2, 3, 4, 5, 6, 7, 8].map(tier => sandbox.AntimatterDimension(tier));
  sandbox.buyMaxTickSpeed = () => {
    calls.push("tickspeed");
    if (action === "tickspeed") sandbox.player.totalTickBought += 1;
  };
  sandbox.requestDimensionBoost = () => { calls.push("dimboost"); sandbox.player.dimensionBoosts += 1; };
  sandbox.requestGalaxyReset = () => { calls.push("galaxy"); sandbox.player.galaxies += 1; return true; };
  sandbox.sacrificeReset = () => { calls.push("sacrifice"); return true; };
  sandbox.buyMaxDimension = tier => {
    calls.push(`dim${tier}`);
    if (action === "dimension") sandbox.AntimatterDimension(tier).amount = new Decimal(999);
  };
  sandbox.bigCrunchResetRequest = () => { calls.push("crunch"); };

  vm.createContext(sandbox);
  const fnSource = [
    // [R92] 例程现在把维度提升/星系的批量购买委托给两个辅助函数，
    // 必须一并抽取，否则 vm 里 `buyAffordableDimensionBoosts is not defined`
    // 会被 `tryOrekiEarlyRoutine` 的外层 catch 吞成「恒返回 false」的假失败。
    extractConst("src/game.js", "MAX_EARLY_RESET_BATCH"),
    extractFunction("src/game.js", "function buyAffordableDimensionBoosts()"),
    extractFunction("src/game.js", "function buyAffordableGalaxies()"),
    extractFunction("src/game.js", "export function tryOrekiEarlyRoutine()"),
    extractFunction("src/game.js", "function earlyRoutineSnapshot()"),
    extractFunction("src/game.js", "function earlyRoutineChanged(before)"),
  ].map(source => source.replace(/^export\s+/, "")).join("\n");
  vm.runInContext(`${fnSource}\nglobalThis.__ROUTINE__ = tryOrekiEarlyRoutine;`, sandbox);
  return { sandbox, routine: sandbox.__ROUTINE__, calls };
}

/** 真实 runCycle 夹具：单调时钟可控，只跑传入的任务。 */
function createExecutorHarness() {
  let monoNow = 100000;
  const sandbox = {
    console, Math, Object, Array, Number, String, JSON, Boolean, Error, Set, Map,
    performance: { now: () => monoNow },
    player: { auto: { autobuyersOn: true } },
    globalThis: null,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const source = readFileSync(join(WEB, "src/core/oreki-smart-executor.js"), "utf-8")
    .replace(/^import\s.*?;\s*$/gm, "")
    .replace(/^export\s+/gm, "")
    .concat("\nglobalThis.__EXEC__ = OrekiSmartExecutor;\n");
  vm.runInContext(source, sandbox);
  const exec = sandbox.__EXEC__;
  exec.setEnabled(true);
  exec.setIntervalSec(1);
  exec.setStrictGlobal(false);
  return { exec, advance: ms => { monoNow += ms; } };
}

// ================================================================ 第 1 组：静默空转不得冒充动作
{
  const { routine } = createRoutineWorld({ action: "none" });
  check("1. 没有任何可买项时，早期例程必须返回 false（不得冒充动作）", () => {
    assert.equal(routine(), false, "全空转却 return true 会吃掉整拍");
  });
}

{
  const { routine } = createRoutineWorld({ action: "none" });
  check("2. 早期例程空转时，同一拍必须让给 early（不得饿死）", () => {
    const h = createExecutorHarness();
    let earlyActs = 0;
    const tasks = [
      ["breakUpgrades", 5, () => 0],
      ["routine", 10, () => routine()],
      ["early", 20, () => { earlyActs++; return true; }],
    ];
    for (let i = 0; i < 5; i++) {
      h.exec.runCycle(tasks);
      h.advance(1000);
    }
    assert.equal(earlyActs, 5, `5 拍内 early 只被执行 ${earlyActs} 次（应为 5）`);
  });
}

// ================================================================ 第 2 组：真动作仍要占拍
{
  const { routine } = createRoutineWorld({ action: "tickspeed" });
  check("3. 真的买到计数频率时，早期例程必须返回 true", () => {
    assert.equal(routine(), true);
  });
}

{
  const { routine } = createRoutineWorld({ action: "tickspeed" });
  check("4. 早期例程真的动作时，early 不得在同一拍执行（同帧单动作）", () => {
    const h = createExecutorHarness();
    let earlyActs = 0;
    const tasks = [
      ["routine", 10, () => routine()],
      ["early", 20, () => { earlyActs++; return true; }],
    ];
    h.exec.runCycle(tasks);
    assert.equal(earlyActs, 0, "routine 已真实动作，early 必须让位");
    h.advance(1000);
    h.exec.runCycle(tasks);
    assert.equal(earlyActs, 0, "routine 仍能继续买到，early 继续让位");
  });
}

{
  const { routine } = createRoutineWorld({ action: "dimension", withDimension: true });
  check("5. 只买到维度（反物质余额不变）也必须识别为真动作", () => {
    assert.equal(routine(), true);
  });
}

// ================================================================ 第 3 组：原有边界不得改变
{
  const off = createRoutineWorld({ autobuyersOn: false });
  const challenge = createRoutineWorld({ challenge: true });
  check("6. 总开关关闭 / 挑战中仍返回 false", () => {
    assert.equal(off.routine(), false);
    assert.equal(challenge.routine(), false);
  });
}

{
  const { routine, calls } = createRoutineWorld({
    action: "none", break: false, withDimBoost: true, withGalaxy: true, withSacrifice: true,
    withDimension: true, withCrunch: true,
  });
  check("7. 动作顺序：维度提升 → 星系 → 计数频率 → 献祭 → 维度升序 → 首次坍缩", () => {
    routine();
    // [R93] 计数频率从最前面移到重置之后：每次 softReset / galaxyReset 都会
    // `resetTickspeed()`（player.totalTickBought = 0），先买会被同拍清零。
    // 断言方向不变（仍是「重置类动作先于维度购买」这一 AD16 语义），只更新位置。
    assert.deepEqual(calls, [
      "dimboost", "galaxy", "tickspeed", "sacrifice",
      "dim1", "dim2", "dim3", "dim4", "dim5", "dim6", "dim7", "dim8",
      "crunch",
    ]);
  });
}

console.log(`\n合计 ${passed + failures.length} 项：PASS ${passed} / FAIL ${failures.length}`);
if (failures.length) {
  console.error("\n失败项：\n" + failures.map(f => "  - " + f).join("\n"));
  process.exit(1);
}
