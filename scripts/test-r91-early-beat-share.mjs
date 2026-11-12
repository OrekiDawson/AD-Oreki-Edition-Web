#!/usr/bin/env node
/**
 * R91 Web 首次无限 → 首次永恒：early 阶段模块能否真正拿到调度节拍
 *
 * 目的：直接加载**生产代码**做行为夹具（不复制逻辑）：
 *   · `src/core/oreki-early-automation.js` 的 `hasRealWork()` / `shouldRequestBeat()`
 *   · `src/core/oreki-smart-executor.js` 的真实 `runCycle`（R88/R91 后的节拍实现）
 *
 * 证明的缺陷：
 *   R78 起全系统只有一个共享节拍：任意两次真动作之间 ≥ 用户配置间隔
 *   （默认 10 s），同一拍最多放行一个任务。`game.js` 的优先提示只在
 *   「ID1 未解锁且 IP 已达门槛」时打开，ID1 一解锁立即关闭；而这一段正是
 *   ID2~ID8 与无限升级必须连续购买的阶段。`routine`（反物质维度/星系）
 *   在反物质持续增长时几乎每拍都能真的买到东西，于是唯一名额被它吃掉，
 *   `early` 拿不到节拍 ⇒ 无限力量上不去 ⇒ maxAM 摸不到首次永恒门槛。
 *
 * 用法：node scripts/test-r91-early-beat-share.mjs
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

/**
 * 加载早期自动化模块（生产源码，去掉 import/export 后放进 vm）。
 * @param {{id1Unlocked?: boolean, id1CanUnlock?: boolean, ip?: string,
 *          upgradeCost?: string, eternityUnlocked?: boolean, break?: boolean,
 *          challenge?: boolean}} opt
 */
function createEarlyWorld(opt = {}) {
  const ip = new Decimal(opt.ip ?? "1e8");
  const dimension = {
    tier: 1,
    isUnlocked: opt.id1Unlocked === true,
    isAvailableForPurchase: opt.id1Unlocked === true,
    canUnlock: opt.id1CanUnlock === true,
    ipRequirement: new Decimal("1e8"),
  };
  const upgrade = {
    id: "dimMult",
    cost: new Decimal(opt.upgradeCost ?? "1e4"),
    isAvailableForPurchase: true,
    get canBeBought() { return ip.gte(this.cost); },
    purchase: () => true,
  };
  const sandbox = {
    console, Math, Object, Array, Number, String, JSON, Boolean, Error, Set, Map, Decimal,
    globalThis: null,
    player: { break: opt.break !== false, auto: { autobuyersOn: true } },
    Currency: { infinityPoints: { value: ip } },
    InfinityDimension: () => dimension,
    InfinityDimensions: {
      all: [dimension],
      canBuy: () => true,
    },
    InfinityUpgrade: { all: [upgrade] },
    NormalChallenge: { isRunning: opt.challenge === true },
    InfinityChallenge: { isRunning: false },
    EternityChallenge: { isRunning: false },
    Pelle: { isDoomed: false },
    PlayerProgress: { eternityUnlocked: () => opt.eternityUnlocked === true },
    OrekiIu15Sprint: { tick() {}, active: false, freezeResets: false },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const source = readFileSync(join(WEB, "src/core/oreki-early-automation.js"), "utf-8")
    .replace(/^import\s.*?;\s*$/gm, "")
    .replace(/^export\s+/gm, "")
    .concat("\nglobalThis.__EARLY__ = OrekiEarlyAutomation;\n");
  vm.runInContext(source, sandbox);
  return sandbox.__EARLY__;
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

/** 跑 n 拍，返回 early / routine 各自真正动手的次数。 */
function runBeats(exec, advance, { beats, hint, routineActs, earlyActs = true }) {
  const served = { routine: 0, early: 0 };
  exec.setPriorityHint(hint);
  for (let i = 0; i < beats; i++) {
    advance(1100);      // 越过 1 s 的共享节拍
    exec.runCycle([
      ["routine", 10, () => { if (!routineActs) return false; served.routine++; return true; }],
      ["early", 20, () => { if (!earlyActs) return false; served.early++; return true; }],
    ]);
  }
  return served;
}

// ============================================================ 第 1 组：真实可买判据
{
  // ID1 还没解锁、maxAM 没到 1e1100，IP 已到 1e8：early 一条都买不了
  // （任何扣费都会跌破 ID1 预留），不得抢拍，以免饿死 routine。
  const early = createEarlyWorld({ id1Unlocked: false, id1CanUnlock: false, ip: "1e8" });
  check("1. ID1 峰值等待期间 hasRealWork() 为假（升级会吃掉 ID1 预留）", () => {
    assert.equal(early.hasRealWork(), false);
  });
  check("2. ID1 峰值等待期间不申请优先节拍", () => {
    assert.equal(early.shouldRequestBeat(), false);
  });
}

{
  // maxAM 已经到 1e1100 ⇒ ID1 可以解锁 ⇒ 真的有活干。
  const early = createEarlyWorld({ id1Unlocked: false, id1CanUnlock: true, ip: "1e8" });
  check("3. ID1 达成解锁条件时 hasRealWork() 为真", () => {
    assert.equal(early.hasRealWork(), true);
  });
  check("4. ID1 达成解锁条件时申请优先节拍", () => {
    assert.equal(early.shouldRequestBeat(), true);
  });
}

{
  // ID1 已解锁：ID2~ID8 与无限升级阶段必须继续申请节拍（旧实现此处窗口已关闭）。
  const early = createEarlyWorld({ id1Unlocked: true, ip: "1e12" });
  check("5. ID1 解锁后仍申请节拍（旧实现窗口在此关闭）", () => {
    assert.equal(early.shouldRequestBeat(), true);
  });
}

{
  const early = createEarlyWorld({ id1Unlocked: true, ip: "1e12", eternityUnlocked: true });
  check("6. 已解锁永恒后不再申请节拍（窗口只覆盖首次永恒前）", () => {
    assert.equal(early.shouldRequestBeat(), false);
  });
  const ch = createEarlyWorld({ id1Unlocked: true, ip: "1e12", challenge: true });
  check("7. 挑战中不申请节拍", () => {
    assert.equal(ch.shouldRequestBeat(), false);
  });
  const pre = createEarlyWorld({ id1Unlocked: true, ip: "1e12", break: false });
  check("8. 未 Break 不申请节拍", () => {
    assert.equal(pre.shouldRequestBeat(), false);
  });
}

// ================================================= 第 2 组：共享节拍下的公平性
{
  const { exec, advance } = createExecutorHarness();
  const served = runBeats(exec, advance, { beats: 6, hint: "", routineActs: true });
  // [R104 P0] 原断言是「缺陷复现：routine 独占 6/6、early=0」——那正是 R104-02 实测到的
  // 调度饿死：priority 10 的 routine 每拍都 didAct，priority 30/31 的 eternity/eternityReset
  // 与更后面的 reality/celestial/endgame 永远轮不到（新档 canEternity=true 后 400+ 秒
  // 一次都没调用 tickEternity）。oreki-smart-executor.js 已加饥饿兜底：
  // 连续 2 拍没被尝试过的任务排序时临时前置。现期望 routine=4 / early=2，
  // 即 routine 不再独占，early 也能稳定拿到节拍。
  check("[R104 P0] 无优先提示时饥饿兜底让 early 也拿到节拍（routine 4/6、early 2/6）", () => {
    assert.equal(served.routine, 4, `routine 实际 ${served.routine} 拍`);
    assert.equal(served.early, 2, `early 实际 ${served.early} 拍`);
  });
}

{
  const { exec, advance } = createExecutorHarness();
  const served = runBeats(exec, advance, { beats: 6, hint: "early", routineActs: true });
  check("10. 有优先提示时 early 与 routine 交替拿拍（各 3/6）", () => {
    assert.equal(served.early, 3, `early 实际 ${served.early} 拍`);
    assert.equal(served.routine, 3, `routine 实际 ${served.routine} 拍`);
  });
  check("11. 优先提示不得让 early 连续霸占节拍（上限 = ceil(6/2)）", () => {
    assert.ok(served.early <= 3, `early 抢了 ${served.early} 拍`);
  });
}

{
  const { exec, advance } = createExecutorHarness();
  const served = runBeats(exec, advance, { beats: 6, hint: "early", routineActs: false });
  check("12. routine 无动作时 early 每拍都能拿到（提示不被公平规则饿死）", () => {
    assert.equal(served.early, 6, `early 实际 ${served.early} 拍`);
    assert.equal(served.routine, 0);
  });
}

{
  const { exec, advance } = createExecutorHarness();
  const served = runBeats(exec, advance, { beats: 4, hint: "", routineActs: false, earlyActs: true });
  check("13. 无提示时 early 靠 no-op 顺延也能拿到节拍（回归：R78 语义不变）", () => {
    assert.equal(served.early, 4);
  });
}

console.log(`\nR91 定向测试：${passed}/${passed + failures.length} 通过`);
if (failures.length) {
  console.log("失败项：");
  for (const line of failures) console.log(`  - ${line}`);
  process.exit(1);
}
