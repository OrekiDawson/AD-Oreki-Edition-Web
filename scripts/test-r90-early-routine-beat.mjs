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
import Decimal from "../modules/break_infinity.js";

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
    dimBoosts: 0,
    galaxies: 0,
    sacrificed: new Decimal(0),
  };
  sandbox.Currency = { antimatter: { value: new Decimal("1e10") } };
  sandbox.NormalChallenge = { isRunning: opt.challenge === true };
  sandbox.InfinityChallenge = { isRunning: false };
  sandbox.EternityChallenge = { isRunning: false };
  sandbox.Pelle = { isDoomed: false };
  sandbox.DimBoost = { canBeBought: opt.withDimBoost === true };
  sandbox.Galaxy = { canBeBought: opt.withGalaxy === true };
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
  sandbox.requestDimensionBoost = () => { calls.push("dimboost"); sandbox.player.dimBoosts += 1; };
  sandbox.requestGalaxyReset = () => { calls.push("galaxy"); sandbox.player.galaxies += 1; return true; };
  sandbox.sacrificeReset = () => { calls.push("sacrifice"); return true; };
  sandbox.buyMaxDimension = tier => {
    calls.push(`dim${tier}`);
    if (action === "dimension") sandbox.AntimatterDimension(tier).amount = new Decimal(999);
  };
  sandbox.bigCrunchResetRequest = () => { calls.push("crunch"); };

  vm.createContext(sandbox);
  const fnSource = [
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
  check("7. 动作顺序不变：计数频率 → 维度提升 → 星系 → 献祭 → 维度升序 → 首次坍缩", () => {
    routine();
    assert.deepEqual(calls, [
      "tickspeed", "dimboost", "galaxy", "sacrifice",
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
