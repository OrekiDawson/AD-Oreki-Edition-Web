#!/usr/bin/env node
/**
 * R107-01 P1 阶段化节拍（stage-capped beat）自测（Node 直跑，无需浏览器）。
 *
 * 验证 `effectiveInterval = min(玩家配置, stageCap(realities))`：
 *   0→1s、1~9→2s、10~49→3s、>=50→5s；玩家配置仍是上限；未知 realities 回退旧行为。
 * 只读/只驱动调度器，不改游戏状态。
 *
 * 用法：node scripts/test-stage-beat-cap.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "src", "core", "oreki-smart-executor.js");
const code = readFileSync(SRC, "utf-8");

let monoNow = 1000;
const perfShim = { now: () => monoNow };
const store = new Map();
const localStorageShim = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const sandbox = {
  performance: perfShim,
  localStorage: localStorageShim,
  console,
  Date,
  Math,
  Object,
  Array,
  Number,
  String,
  JSON,
  parseInt,
  parseFloat,
  isNaN,
  setTimeout,
  clearTimeout,
  globalThis: null,
  player: { realities: 0 },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const cjs = code
  .replace(/^import\s.*?;\s*$/gm, "")
  .replace(/export const OrekiSmartExecutor =/, "const OrekiSmartExecutor =")
  .concat("\nglobalThis.__EXEC__ = OrekiSmartExecutor;\n");
sandbox.OrekiSmartStrategy = { drives: () => true, tick: () => {}, evaluate: () => null };
vm.runInContext(cjs, sandbox, { filename: "oreki-smart-executor.js" });
const EXEC = sandbox.__EXEC__;

let checks = 0;
const fails = [];
function check(name, ok, detail = "") {
  checks++;
  if (!ok) fails.push(detail ? name + "  ← " + detail : name);
}
function task(log, id) {
  return () => { log.push({ id, at: monoNow }); return { acted: true, changed: 1, verb: id, label: id }; };
}
/** 重置到「刚发生一次动作后」的干净状态：把时间推进一大截，清掉节拍。 */
function settle(intervalSec = 10) {
  EXEC.setEnabled(true);
  EXEC.setIntervalSec(intervalSec);
  EXEC.setStrictGlobal(false);
  monoNow += 24 * 60 * 60 * 1000;
}
function runOne() { const log = []; EXEC.runCycle([["t", 10, task(log, "t")]]); return log.length; }
/** 断言：从 action 后 base 起，advanceMs 内（不足以达到 expected）不放行；再多 200ms 放行。 */
function expectBeat(label, intervalSec, advanceBelowMs, extraMs = 600) {
  settle(intervalSec);
  const log = [];
  EXEC.runCycle([["t", 10, task(log, "t")]]);
  const afterFirst = log.length;
  monoNow += advanceBelowMs;
  EXEC.runCycle([["t", 10, task(log, "t")]]);
  const stillBlocked = log.length === afterFirst;
  monoNow += extraMs;
  EXEC.runCycle([["t", 10, task(log, "t")]]);
  const allowed = log.length === afterFirst + 1;
  check(label, stillBlocked && allowed, "first=" + afterFirst + ", afterAdvance=" + log.length);
}

// 1. realities=0 → cap 1s（即使玩家配置 10s）
sandbox.player.realities = 0;
EXEC.setIntervalSec(10);
check("realities=0: 玩家配置 10s 仍保存", EXEC.intervalSec === 10, "intervalSec=" + EXEC.intervalSec);
check("realities=0: effectiveIntervalSec=1", EXEC.effectiveIntervalSec === 1, "effective=" + EXEC.effectiveIntervalSec);
check("realities=0: debugState.stageCapSec=1", EXEC.debugState().stageCapSec === 1, "cap=" + EXEC.debugState().stageCapSec);
expectBeat("realities=0: <1s 被拒、>=1s 放行", 10, 500);

// 2. realities=3 → cap 2s
sandbox.player.realities = 3;
check("realities=3: effective=2", EXEC.effectiveIntervalSec === 2, "effective=" + EXEC.effectiveIntervalSec);
expectBeat("realities=3: <2s 被拒", 10, 1500);

// 3. realities=40 → cap 3s
sandbox.player.realities = 40;
check("realities=40: effective=3", EXEC.effectiveIntervalSec === 3, "effective=" + EXEC.effectiveIntervalSec);
expectBeat("realities=40: <3s 被拒", 10, 2500);

// 4. realities=60 → cap 5s
sandbox.player.realities = 60;
check("realities=60: effective=5", EXEC.effectiveIntervalSec === 5, "effective=" + EXEC.effectiveIntervalSec);
expectBeat("realities=60: <5s 被拒", 10, 4500);

// 5. 玩家配置低于 cap → 用玩家配置（min）
sandbox.player.realities = 60;
EXEC.setIntervalSec(2);
check("realities=60 + 玩家配置 2s: effective=2（min）", EXEC.effectiveIntervalSec === 2, "effective=" + EXEC.effectiveIntervalSec);
expectBeat("realities=60 + 玩家配置 2s: 按 2s", 2, 1500);

// 6. 未知 realities（删除字段）→ cap=Infinity，保持旧行为（玩家配置 10s）
delete sandbox.player.realities;
EXEC.setIntervalSec(10);
check("未知 realities: effective=10（旧行为）", EXEC.effectiveIntervalSec === 10, "effective=" + EXEC.effectiveIntervalSec);
expectBeat("未知 realities: <10s 被拒", 10, 9300, 900);

// 7. 存储/UI 配置不被改写
sandbox.player.realities = 0;
EXEC.setIntervalSec(10);
monoNow += 5000;
check("存储仍是玩家配置（10）", localStorageShim.getItem("oreki.automation.intervalSec") === "10",
  "stored=" + localStorageShim.getItem("oreki.automation.intervalSec"));
check("effective 只读不改配置", EXEC.intervalSec === 10 && EXEC.effectiveIntervalSec === 1,
  "configured=" + EXEC.intervalSec + ", effective=" + EXEC.effectiveIntervalSec);

// 8. strictGlobal 模式同样使用 effective
sandbox.player.realities = 0;
EXEC.setStrictGlobal(true);
EXEC.setIntervalSec(10);
monoNow += 1000;
const logS = [];
EXEC.runCycle([["a", 1, task(logS, "a")], ["b", 2, task(logS, "b")]]);
check("strictGlobal: 首帧仍只 1 个动作", logS.length === 1, "count=" + logS.length);
monoNow += 700;
EXEC.runCycle([["a", 1, task(logS, "a")]]);
check("strictGlobal: 700ms 内（effective=1s）被拒", logS.length === 1, "count=" + logS.length);
monoNow += 500;
EXEC.runCycle([["a", 1, task(logS, "a")]]);
check("strictGlobal: 1.2s 后放行", logS.length === 2, "count=" + logS.length);

console.log("");
if (fails.length === 0) {
  console.log("R107-01 P1 阶段化节拍自测：" + checks + " 项检查全部通过");
  process.exit(0);
}
console.log("R107-01 P1 阶段化节拍自测：FAIL " + fails.length + "/" + checks);
for (const f of fails) console.log("  FAIL  " + f);
process.exit(1);
