#!/usr/bin/env node
/**
 * [R120-01] 调度周期边界与阶段无关性自测（Node 直跑，无需等待真实秒数）。
 *
 * 正式语义：调度周期严格等于玩家配置的 1～60 秒，默认 10 秒；
 * 阶段变化、现实数和游戏主循环 tick 均不得缩短或放大配置周期。
 *
 * 用例覆盖：1/10/60 秒边界、非法存储回退、改周期后下一窗口、
 * 长时间空档不补跑、strictGlobal 同周期和配置持久化。
 *
 * 用法：node scripts/test-scheduler-period.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "src", "core", "oreki-smart-executor.js");

let monoNow = 1000;
let checks = 0;
const fails = [];
function check(name, ok, detail = "") {
  checks++;
  if (!ok) fails.push(detail ? `${name}  ← ${detail}` : name);
}

function loadExecutor(initialStore = new Map()) {
  const store = initialStore;
  const sandbox = {
    performance: { now: () => monoNow },
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    },
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
    player: { realities: 0 },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const code = readFileSync(SRC, "utf-8")
    .replace(/^import\s.*?;\s*$/gm, "")
    .replace(/export const OrekiSmartExecutor =/, "const OrekiSmartExecutor =")
    .concat("\nglobalThis.__EXEC__ = OrekiSmartExecutor;\n");
  sandbox.OrekiSmartStrategy = { drives: () => true, tick: () => {}, evaluate: () => null };
  vm.runInContext(code, sandbox, { filename: "oreki-smart-executor.js" });
  return { EXEC: sandbox.__EXEC__, sandbox, store };
}

function task(log, id) {
  return () => {
    log.push({ id, at: monoNow });
    return { acted: true, changed: 1, verb: id, label: id };
  };
}

const { EXEC, sandbox, store } = loadExecutor();
check(
  "旧档缺少周期字段时默认 10 秒",
  EXEC.intervalSec === 10 && EXEC.effectiveIntervalSec === 10,
  `configured=${EXEC.intervalSec}, effective=${EXEC.effectiveIntervalSec}`,
);

for (const seconds of [1, 10, 60]) {
  sandbox.player.realities = seconds === 60 ? 60 : 0;
  EXEC.setIntervalSec(seconds);
  check(
    `${seconds} 秒配置在任意阶段严格生效`,
    EXEC.intervalSec === seconds &&
      EXEC.effectiveIntervalSec === seconds &&
      EXEC.hostingIntervalMs === seconds * 1000,
    `configured=${EXEC.intervalSec}, effective=${EXEC.effectiveIntervalSec}, hosting=${EXEC.hostingIntervalMs}`,
  );
  check(
    `${seconds} 秒配置持久化`,
    store.get("oreki.automation.intervalSec") === String(seconds),
    `stored=${store.get("oreki.automation.intervalSec")}`,
  );
}

EXEC.setIntervalSec(0);
check("下越界安全钳制到 1 秒", EXEC.intervalSec === 1);
EXEC.setIntervalSec(61);
check("上越界安全钳制到 60 秒", EXEC.intervalSec === 60);
check("NaN 安全回退 10 秒", EXEC.setIntervalSec(Number.NaN).intervalSec === 10);

const invalid = loadExecutor(new Map([
  ["oreki.automation.intervalSec", "NaN"],
  ["oreki.automation.enabled", "1"],
]));
check("损坏的旧档周期安全回退 10 秒", invalid.EXEC.intervalSec === 10);

monoNow = 1000;
const changed = loadExecutor();
changed.EXEC.setIntervalSec(60);
changed.EXEC.hostingTick();
monoNow += 30_000;
changed.EXEC.setIntervalSec(10);
check("改周期后立即采用新值计算下一次窗口", changed.EXEC.hostingIntervalMs === 10000);
check("30 秒已超过新 10 秒窗口时立即前进一拍", changed.EXEC.hostingTick() === 2);
monoNow += 120_000;
check("长时间空档只前进一拍，不补偿执行", changed.EXEC.hostingTick() === 3);

changed.EXEC.setStrictGlobal(true);
const log = [];
changed.EXEC.setIntervalSec(10);
monoNow += 10_000;
changed.EXEC.runCycle([["a", 1, task(log, "a")], ["b", 2, task(log, "b")]]);
check("strictGlobal 首个窗口仍最多一个动作", log.length === 1);
monoNow += 9_000;
changed.EXEC.runCycle([["a", 1, task(log, "a")]]);
check("strictGlobal 9 秒内拒绝", log.length === 1);
monoNow += 1_000;
changed.EXEC.runCycle([["a", 1, task(log, "a")]]);
check("strictGlobal 满 10 秒后放行一次", log.length === 2);

console.log("");
if (fails.length === 0) {
  console.log(`R120-01 调度周期边界自测：${checks} 项检查全部通过`);
  process.exit(0);
}
console.log(`R120-01 调度周期边界自测：FAIL ${fails.length}/${checks}`);
for (const failure of fails) console.log("  FAIL  " + failure);
process.exit(1);
