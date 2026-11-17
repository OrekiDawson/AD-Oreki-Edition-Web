#!/usr/bin/env node
/**
 * [R116-02] 调度器托管 Tick 自测（Node 直跑，无需浏览器）。
 *
 * 验收目标：
 *   · 托管 Tick 与调度器 effectiveInterval 同步：1s / 5s / 玩家配置动态变化；
 *   · 同一窗口内反复调用不重复前进；
 *   · 时间跨越很久只前进一拍（不突发补跑）；
 *   · 关闭 MOD 总开关时 Tick 不前进，重新开启后恢复；
 *   · debugState().hosting 暴露真实 tick/interval。
 *
 * 用法：node scripts/check_scheduler_hosting.mjs
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
  checks += 1;
  if (!ok) fails.push(detail ? `${name}  ← ${detail}` : name);
}
function reset(intervalSec = 10, realities = 0) {
  EXEC.setEnabled(true);
  EXEC.setIntervalSec(intervalSec);
  EXEC.setStrictGlobal(false);
  sandbox.player.realities = realities;
  monoNow += 24 * 60 * 60 * 1000;
}

// ---------------------------------------------------------------- 1. 1s Tick
reset(10, 0); // realities=0 → 阶段上限 1s，玩家配置 10s 不放大
check("realities=0：托管间隔=1000ms", EXEC.hostingIntervalMs === 1000,
  "actual=" + EXEC.hostingIntervalMs);
const t1 = EXEC.hostingTick();
check("首个 Tick 从 1 开始", t1 === 1, "tick=" + t1);
monoNow += 500;
check("半拍内不前进", EXEC.hostingTick() === t1, "tick=" + EXEC.hostingTick());
monoNow += 500;
const t2 = EXEC.hostingTick();
check("跨 1s 前进到 2", t2 === 2, "tick=" + t2);
check("同一 1s 窗口反复调用不重复前进",
  EXEC.hostingTick() === 2 && EXEC.hostingTick() === 2);

// ---------------------------------------------------------------- 2. 5s Tick
sandbox.player.realities = 60; // 阶段上限 5s
EXEC.setIntervalSec(10);
check("realities=60：托管间隔=5000ms", EXEC.hostingIntervalMs === 5000,
  "actual=" + EXEC.hostingIntervalMs);
monoNow += 4999;
check("4.999s 内不前进（5s Tick）", EXEC.hostingTick() === 2,
  "tick=" + EXEC.hostingTick());
monoNow += 1;
const t3 = EXEC.hostingTick();
check("跨 5s 前进到 3", t3 === 3, "tick=" + t3);

// ------------------------------------------------- 3. 动态 5s → 1s 同步
sandbox.player.realities = 0;
EXEC.setIntervalSec(10);
check("动态切换后托管间隔=1000ms", EXEC.hostingIntervalMs === 1000);
monoNow += 1000;
const t4 = EXEC.hostingTick();
check("间隔变短后下一 1s 窗口即前进", t4 === 4, "tick=" + t4);

// --------------------------------------------- 4. 玩家配置仍是上限（1s 配置）
EXEC.setIntervalSec(1);
monoNow += 1000;
check("玩家 1s 配置：1s 前进", EXEC.hostingTick() === 5, "tick=" + EXEC.hostingTick());

// --------------------------------------------- 5. 长时间空档不补跑
monoNow += 60_000;
const t6 = EXEC.hostingTick();
check("空档 60s 只前进一拍（不突发补跑）", t6 === 6, "tick=" + t6);

// --------------------------------------------- 6. 关闭即停 / 重开恢复
let managedReleaseCalls = 0;
sandbox.OrekiManagedCrunchInterval = {
  releaseToPlayer: () => { managedReleaseCalls += 1; return true; },
};
EXEC.setEnabled(false);
check("关闭总开关时通知受管大坍缩间隔写回原值", managedReleaseCalls === 1,
  "calls=" + managedReleaseCalls);
monoNow += 30_000;
check("关闭 MOD 总开关后 Tick 不前进", EXEC.hostingTick() === 6, "tick=" + EXEC.hostingTick());
EXEC.setEnabled(true);
monoNow += 1000;
check("重新开启后恢复前进", EXEC.hostingTick() === 7, "tick=" + EXEC.hostingTick());

// --------------------------------------------- 7. 诊断字段
const dbg = EXEC.debugState();
check("debugState().hosting.tick 与实际一致", dbg.hosting && dbg.hosting.tick === 7,
  JSON.stringify(dbg.hosting));
check("debugState().hosting.intervalMs 与实际一致", dbg.hosting.intervalMs === 1000,
  JSON.stringify(dbg.hosting));

console.log(`\nR116-02 调度器托管 Tick：${checks} 项检查，失败 ${fails.length} 项`);
if (fails.length) {
  for (const f of fails) console.log("  FAIL", f);
  process.exit(1);
}
console.log("  全部通过");
process.exit(0);
