#!/usr/bin/env node
/**
 * R88 Web executor 时钟与共享节拍回归（Node 直跑，无需浏览器）。
 *
 * 覆盖纪元时间与单调时间混用导致的阶段队列冻结、executor 空转占拍，
 * 以及 runCycle 已动作后 executor 同帧再次动作这三类缺陷。
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "src", "core", "oreki-smart-executor.js");
const source = readFileSync(SRC, "utf-8")
  .replace(/^import\s.*?;\s*$/gm, "")
  .replace(/^export\s+/gm, "")
  .concat("\nglobalThis.__EXEC__ = OrekiSmartExecutor;\n");

function createHarness(executorResult) {
  let monoNow = 10000;
  let wallNow = 1900000000000;
  let result = executorResult;
  let executorCalls = 0;
  const store = new Map();

  // 刻意让两个时钟相差巨大：只要把 Date.now() 写进单调节拍，本测试就会稳定复现冻结。
  class FakeDate extends Date {
    static now() { return wallNow; }
  }

  const decision = {
    ok: true,
    stage: { id: "infinity" },
    goal: { id: "r88-clock", title: "R88 时钟回归", done: false },
    strategy: { id: "r88-clock", priority: ["buyInfinityUpgrade"] },
    blockers: [],
  };
  const sandbox = {
    console,
    Date: FakeDate,
    performance: { now: () => monoNow },
    localStorage: {
      getItem: key => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: key => store.delete(key),
    },
    player: { auto: { autobuyersOn: true } },
    Math, Object, Array, Number, String, JSON, Boolean, Error, Set, Map,
    parseInt, parseFloat, isNaN, setTimeout, clearTimeout,
    globalThis: null,
  };
  sandbox.globalThis = sandbox;
  sandbox.OrekiSmartStrategy = {
    evaluate: () => decision,
    noteManualAction() {},
    debugState: () => ({ degradedCount: 0 }),
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "oreki-smart-executor.js" });

  const exec = sandbox.__EXEC__;
  exec.setEnabled(true);
  exec.setIntervalSec(1);
  exec.setStrictGlobal(false);
  exec.register("early", {
    buyInfinityUpgrades() {
      executorCalls++;
      return result;
    },
  });
  // 执行层只在所属模块连续三帧无动作后接管；直接复用公开 observe API 建立前置状态。
  exec.observe("early", false);
  exec.observe("early", false);
  exec.observe("early", false);

  return {
    exec,
    advance(ms) { monoNow += ms; wallNow += ms; },
    executorCalls: () => executorCalls,
  };
}

let passed = 0;
const failures = [];
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`PASS  ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error?.message ?? error}`);
    console.log(`FAIL  ${name} —— ${error?.message ?? error}`);
  }
}

check("1. executor no-op 后阶段队列立即继续，不被纪元时间冻结", () => {
  const h = createHarness(false);
  const outcome = h.exec.tick({ early: false });
  assert.equal(outcome.executor.acted, false);
  const phaseCalls = [];
  h.exec.runCycle([["early", 20, () => { phaseCalls.push("early"); return true; }]]);
  assert.deepEqual(phaseCalls, ["early"]);
  assert.equal(h.exec.debugState().beat.log.at(-1)?.task, "early");
});

check("2. executor 成功动作严格遵守 1 秒边界", () => {
  const h = createHarness(true);
  assert.equal(h.exec.tick({ early: false }).executor.acted, true);
  const executorBeat = h.exec.debugState().beat;
  assert.equal(executorBeat.lastAt, 10000, "lastBeatAt 必须写单调时间，不能写 Date.now() 纪元时间");
  assert.equal(executorBeat.log.at(-1)?.task, "executor");
  let phaseActs = 0;
  const tasks = [["breakGate", 6, () => { phaseActs++; return true; }]];
  h.advance(999);
  h.exec.runCycle(tasks);
  assert.equal(phaseActs, 0, "999ms 时不得放行");
  h.advance(1);
  h.exec.runCycle(tasks);
  assert.equal(phaseActs, 1, "恰好 1000ms 时应放行");
  const log = h.exec.debugState().beat.log;
  assert.equal(log.at(-1)?.gapMs, 1000);
});

check("3. runCycle 已真动作后 executor 同帧不得再动作", () => {
  const h = createHarness(true);
  h.exec.runCycle([["early", 20, () => true]]);
  const outcome = h.exec.tick({ early: false });
  assert.equal(outcome.executor.acted, false);
  assert.equal(outcome.executor.reason, "interval-wait");
  assert.equal(h.executorCalls(), 0, "同帧 gate 必须在 invoke 前拦截");
  assert.equal(h.exec.debugState().beat.log.length, 1);
});

check("4. executor no-op 不占拍，breakGate 同帧仍可运行", () => {
  const h = createHarness(false);
  h.exec.tick({ early: false });
  const before = h.exec.debugState().beat;
  assert.equal(before.lastAt, 0);
  assert.equal(before.log.length, 0);
  assert.equal(before.served.executor, undefined, "no-op 不得记为 executor 已服务");

  let breakGateActs = 0;
  h.exec.runCycle([["breakGate", 6, () => { breakGateActs++; return { acted: true }; }]]);
  assert.equal(breakGateActs, 1);
  const after = h.exec.debugState().beat;
  assert.equal(after.log.length, 1);
  assert.equal(after.log[0].task, "breakGate");
});

console.log(`\nR88 executor 时钟回归：PASS ${passed} / FAIL ${failures.length}`);
if (failures.length) {
  console.error(failures.map(item => `  - ${item}`).join("\n"));
  process.exit(1);
}
