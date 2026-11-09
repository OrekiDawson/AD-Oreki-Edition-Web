#!/usr/bin/env node
/**
 * [R97 P0] Web 端「永恒层阶段门禁」回归自测（Node 直跑，不需要浏览器）。
 *
 * 背景（Android 4bf947f 已确证的 P0 根因）：
 *   首次无限（02:01）之后、Break Infinity 尚未完成时，自动化被驱动去
 *   `buyEternityUpgrades()` + 原版 `Eternity.tick()`（Web 对应 `tickEternity()`），
 *   提前点亮时间研究并卡死。Android 的修法是在 `hasInfinity()` 之后加
 *   `if (!GameApi.isBroken()) return`，并把 EC 调度移到该门禁之后。
 *
 * 本脚本验证 Web 端**逐条等价**的那道门禁（`oreki-smart-executor.js` 的
 * `eternityStageAllowed()`），并且验证它在**两条路径**上都生效：
 *   ① `game.js` 的任务队列（`["eternity", ...]` / `["eternityReset", ...]`）；
 *   ② 执行层兜底路径 `invoke()`（source === "eternity" 的所有 verb）。
 * 只守 ① 是不够的：队列被挡后模块会被记成 no-op，3 帧后兜底就会替它动手。
 *
 * 覆盖（对应任务要求的三条）：
 *   · pre-break（已首次无限、Break=false）→ 一次永恒动作都不发；
 *   · post-break（已首次无限、Break=true）→ 正常发出一次；
 *   · hasInfinity=false（还没首次无限）→ 即使 Break 标志异常为真也不动作。
 * 外加：判据抛错时 fail-closed、判据不存在时不误放行。
 *
 * 说明：这是 **Node 静态/逻辑断言**，不是浏览器实测；浏览器验收由主 Agent 统一安排。
 *
 * 用法：node scripts/check_stage_gate.mjs      （退出码 0 = 全过）
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const EXEC_SRC = readFileSync(join(ROOT, "src", "core", "oreki-smart-executor.js"), "utf8");
const GAME_SRC = readFileSync(join(ROOT, "src", "game.js"), "utf8");

let checks = 0;
const failures = [];
function check(name, ok, detail = "") {
  checks += 1;
  if (!ok) failures.push(detail ? `${name}  ← ${detail}` : name);
}

/**
 * 在**全新的 vm 上下文**里加载真实的 `oreki-smart-executor.js`。
 * 每个场景独立加载，避免 STATE（idle / 节拍 / 冷却）在场景之间串味。
 */
function loadExecutor({ isBroken = false, hasInfinity = true, throwInProbe = false } = {}) {
  let monoNow = 1000;
  const store = new Map();
  const sandbox = {
    performance: { now: () => monoNow },
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
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
    globalThis: null,
  };
  sandbox.globalThis = sandbox;
  sandbox.player = { auto: { autobuyersOn: true }, break: isBroken === true };
  sandbox.PlayerProgress = {
    infinityUnlocked() {
      if (throwInProbe) throw new Error("probe failure");
      return hasInfinity === true;
    },
  };
  // import 被剥掉后需要同名替身；tick() 里会调 evaluate()
  sandbox.OrekiSmartStrategy = {
    evaluate: () => ({
      ok: true,
      stage: { id: "test-stage" },
      strategy: { id: "test-strategy", priority: ["buyEternityUpgrade"] },
      manualHold: null,
    }),
  };

  vm.createContext(sandbox);
  const code = EXEC_SRC
    .replace(/^import\s.*?;\s*$/gm, "")
    .replace(/export const OrekiSmartExecutor =/, "const OrekiSmartExecutor =")
    .concat("\nglobalThis.__EXEC__ = OrekiSmartExecutor;\n");
  vm.runInContext(code, sandbox, { filename: "oreki-smart-executor.js" });

  return {
    EXEC: sandbox.__EXEC__,
    sandbox,
    advance: ms => { monoNow += ms; },
  };
}

/**
 * 通过真实的 `tick()` 兜底路径发起一次 `buyEternityUpgrade`。
 * 返回 { called, result }——called 表示假的永恒模块真的被调用了。
 */
function runEternityVerbOnce(env) {
  const { EXEC, sandbox } = env;
  const calls = [];
  // 真实 Autobuyer 形状的最小替身：只实现本 verb 会走的方法。
  EXEC.register("eternity", {
    buyEternityUpgrades() {
      calls.push("buyEternityUpgrades");
      return true;
    },
  });
  // 兜底路径要求该 source 连续 3 帧「无动作」才会接管（IDLE_FRAMES_BEFORE_ACT）。
  EXEC.observe("eternity", { dims: false, tt: false });
  EXEC.observe("eternity", { dims: false, tt: false });
  EXEC.observe("eternity", { dims: false, tt: false });
  const result = EXEC.tick(null);
  return { called: calls.length, result, sandbox };
}

// ---------------------------------------------------------------------------
// 一、判据真值表（极性双向）
// ---------------------------------------------------------------------------
{
  const preBreak = loadExecutor({ isBroken: false, hasInfinity: true });
  check("pre-break：已首次无限但 Break=false → 门禁关闭",
    preBreak.EXEC.eternityStageAllowed() === false);

  const postBreak = loadExecutor({ isBroken: true, hasInfinity: true });
  check("post-break：已首次无限且 Break=true → 门禁打开（不反向阻断首次永恒）",
    postBreak.EXEC.eternityStageAllowed() === true);

  const noInfinity = loadExecutor({ isBroken: true, hasInfinity: false });
  check("hasInfinity=false：即使 Break 标志为真也不放行",
    noInfinity.EXEC.eternityStageAllowed() === false);

  const neither = loadExecutor({ isBroken: false, hasInfinity: false });
  check("hasInfinity=false 且 Break=false → 门禁关闭（双向都假）",
    neither.EXEC.eternityStageAllowed() === false);

  const broken = loadExecutor({ throwInProbe: true });
  check("判据抛错 → fail-closed（绝不因异常放行）",
    broken.EXEC.eternityStageAllowed() === false,
    `实际返回值 ${broken.EXEC.eternityStageAllowed()}`);

  // 没有 PlayerProgress 时必须失败关闭（旧环境/加载异常）
  const bare = loadExecutor();
  delete bare.sandbox.PlayerProgress;
  check("缺 PlayerProgress → fail-closed",
    bare.EXEC.eternityStageAllowed() === false);
}

// ---------------------------------------------------------------------------
// 二、执行层兜底路径：门禁挡住时一次都不许调永恒动作
// ---------------------------------------------------------------------------
{
  const env = loadExecutor({ isBroken: false, hasInfinity: true });
  const { called, result } = runEternityVerbOnce(env);
  check("pre-break：兜底路径 0 次永恒动作",
    called === 0, `实际调用 ${called} 次`);
  check("pre-break：tick() 明确回报「阶段门禁」而不是静默无动作",
    result?.executor?.acted === false &&
      typeof result?.executor?.detail === "string" &&
      result.executor.detail.includes("阶段门禁"),
    `executor=${JSON.stringify(result?.executor)}`);
}
{
  const env = loadExecutor({ isBroken: true, hasInfinity: true });
  const { called, result } = runEternityVerbOnce(env);
  check("post-break：同一路径正常发出 1 次永恒动作",
    called === 1, `实际调用 ${called} 次`);
  check("post-break：tick() 记录 acted=true（门禁不吞正常流程）",
    result?.executor?.acted === true,
    `executor=${JSON.stringify(result?.executor)}`);
}
{
  const env = loadExecutor({ isBroken: true, hasInfinity: false });
  const { called } = runEternityVerbOnce(env);
  check("hasInfinity=false：兜底路径 0 次永恒动作",
    called === 0, `实际调用 ${called} 次`);
}

// ---------------------------------------------------------------------------
// 三、game.js 任务队列接线（静态断言：两个永恒任务都必须走同一门禁）
// ---------------------------------------------------------------------------
{
  check("game.js 的 eternity 任务走 orekiEternityTick 包装",
    /\[\s*"eternity"\s*,\s*30\s*,\s*orekiEternityTick\s*,/.test(GAME_SRC),
    "未找到 [\"eternity\", 30, orekiEternityTick, ...]");
  check("game.js 的 eternityReset 任务走 orekiEternityResetTick 包装",
    /\[\s*"eternityReset"\s*,\s*31\s*,\s*orekiEternityResetTick\s*,/.test(GAME_SRC),
    "未找到 [\"eternityReset\", 31, orekiEternityResetTick, ...]");

  const tickCalls = GAME_SRC.match(/OrekiEternityAutomation\.tick\(\)/g) ?? [];
  const resetCalls = GAME_SRC.match(/OrekiEternityAutomation\.tickEternity\(\)/g) ?? [];
  check("game.js 里 OrekiEternityAutomation.tick() 只有 1 处（在门禁包装内）",
    tickCalls.length === 1, `实际 ${tickCalls.length} 处`);
  check("game.js 里 OrekiEternityAutomation.tickEternity() 只有 1 处（在门禁包装内）",
    resetCalls.length === 1, `实际 ${resetCalls.length} 处`);

  // 两处调用必须和 eternityStageAllowed() 出现在同一个包装函数体里（前后 4 行内）
  const lines = GAME_SRC.split("\n");
  const guardNear = callText => {
    const idx = lines.findIndex(line => line.includes(callText));
    if (idx < 0) return false;
    const window = lines.slice(Math.max(0, idx - 4), idx + 1).join("\n");
    return window.includes("eternityStageAllowed()");
  };
  check("OrekiEternityAutomation.tick() 被 eternityStageAllowed() 直接守卫",
    guardNear("OrekiEternityAutomation.tick()"));
  check("OrekiEternityAutomation.tickEternity() 被 eternityStageAllowed() 直接守卫",
    guardNear("OrekiEternityAutomation.tickEternity()"));

  // 执行层的同一个判据必须被 invoke() 用于 source === "eternity"
  check("执行层 invoke() 对 source===\"eternity\" 复用同一判据",
    /spec\.source === "eternity" && !eternityStageAllowed\(\)/.test(EXEC_SRC));
}

// ---------------------------------------------------------------------------
// 汇总
// ---------------------------------------------------------------------------
if (failures.length) {
  console.error(`\n${checks} 项检查，失败 ${failures.length} 项：`);
  for (const f of failures) console.error(`  FAIL  ${f}`);
  process.exit(1);
}
console.log(`\nR97 阶段门禁（Web）自测：${checks} 项检查全部通过`);
console.log("  覆盖：pre-break 无动作 / post-break 有动作 / hasInfinity=false 无动作 / fail-closed");
