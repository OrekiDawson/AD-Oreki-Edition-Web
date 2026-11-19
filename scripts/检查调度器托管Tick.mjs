#!/usr/bin/env node
/**
 * [R116-02] 调度器托管 Tick 自测（Node 直跑，无需浏览器）。
 *
 * 验收目标：
 *   · 托管 Tick 严格采用玩家配置的 1 / 10 / 60 秒周期，阶段不得改写；
 *   · 同一窗口内反复调用不重复前进；
 *   · 时间跨越很久只前进一拍（不突发补跑）；
 *   · 关闭 MOD 总开关时 Tick 不前进，重新开启后恢复；
 *   · debugState().hosting 暴露真实 tick/interval。
 *
 * 用法：node scripts/检查调度器托管Tick.mjs
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

// ---------------------------------------------------------------- 1. 默认 10s
reset(10, 0);
check("新档默认 10 秒周期", EXEC.intervalSec === 10 && EXEC.hostingIntervalMs === 10000,
  "actual=" + EXEC.hostingIntervalMs);
const t1 = EXEC.hostingTick();
check("首个 Tick 从 1 开始", t1 === 1, "tick=" + t1);
monoNow += 9999;
check("9.999s 内不前进", EXEC.hostingTick() === t1, "tick=" + EXEC.hostingTick());
monoNow += 1;
const t2 = EXEC.hostingTick();
check("跨 10s 前进到 2", t2 === 2, "tick=" + t2);
check("同一窗口反复调用不重复前进",
  EXEC.hostingTick() === 2 && EXEC.hostingTick() === 2);

// ---------------------------------------------------------------- 2. 60s 边界
EXEC.setIntervalSec(60);
check("60 秒配置实际生效", EXEC.hostingIntervalMs === 60000,
  "actual=" + EXEC.hostingIntervalMs);
monoNow += 59999;
check("59.999s 内不前进", EXEC.hostingTick() === 2,
  "tick=" + EXEC.hostingTick());
monoNow += 1;
const t3 = EXEC.hostingTick();
check("跨 60s 前进到 3", t3 === 3, "tick=" + t3);

// ------------------------------------------------- 3. 1s 边界与阶段无关
sandbox.player.realities = 60;
EXEC.setIntervalSec(1);
check("高现实阶段仍严格使用 1 秒配置", EXEC.hostingIntervalMs === 1000);
monoNow += 1000;
const t4 = EXEC.hostingTick();
check("1s 配置在 1s 边界前进", t4 === 4, "tick=" + t4);

// --------------------------------------------- 4. 长时间空档不补跑
monoNow += 60_000;
const t5 = EXEC.hostingTick();
check("空档 60s 只前进一拍（不突发补跑）", t5 === 5, "tick=" + t5);

// --------------------------------------------- 5. 关闭即停 / 重开恢复
let managedReleaseCalls = 0;
sandbox.OrekiManagedCrunchInterval = {
  releaseToPlayer: () => { managedReleaseCalls += 1; return true; },
};
EXEC.setEnabled(false);
check("关闭总开关时通知受管大坍缩间隔写回原值", managedReleaseCalls === 1,
  "calls=" + managedReleaseCalls);
monoNow += 30_000;
check("关闭 MOD 总开关后 Tick 不前进", EXEC.hostingTick() === 5, "tick=" + EXEC.hostingTick());
EXEC.setEnabled(true);
monoNow += 1000;
check("重新开启后恢复前进", EXEC.hostingTick() === 6, "tick=" + EXEC.hostingTick());

// --------------------------------------------- 6. 诊断字段
const dbg = EXEC.debugState();
check("debugState().hosting.tick 与实际一致", dbg.hosting && dbg.hosting.tick === 6,
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
