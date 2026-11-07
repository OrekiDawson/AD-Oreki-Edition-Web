#!/usr/bin/env node
/**
 * R78 Web 调度器行为自测（Node 直跑，无需浏览器）。
 *
 * 目的：证明 R78 改动后「全局节拍 / 同帧唯一 / no-op 不占拍 / 关闭即停」
 * 这四条行为在真实代码里成立 —— 不是靠读代码下结论。
 *
 * 用法：
 *   node scripts/test-scheduler-beat.mjs
 * 退出码 0 = 全部通过。
 *
 * 为什么能在 Node 里跑：
 *   oreki-smart-executor.js 只依赖 `localStorage` / `performance` / `globalThis`，
 *   这三者都能用 20 行垫片模拟。不需要 jsdom、不需要浏览器。
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "src", "core", "oreki-smart-executor.js");
const code = readFileSync(SRC, "utf-8");

// ------------------------------------------------------------------ 极简宿主垫片

/** 可控的单调时钟：测试里手动推进。 */
let monoNow = 1000;
const perfShim = { now: () => monoNow };

/** localStorage 垫片：只存字符串。 */
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
};
sandbox.globalThis = sandbox;

vm.createContext(sandbox);

// 把 ESM 改造成 vm 可执行脚本：
//   1) 去掉 import 语句（策略模块在测试里不需要真实语义，用空壳替身）
//   2) export const → const，末尾挂到 globalThis
const cjs = code
  .replace(/^import\s.*?;\s*$/gm, "")
  .replace(/export const OrekiSmartExecutor =/, "const OrekiSmartExecutor =")
  .concat("\nglobalThis.__EXEC__ = OrekiSmartExecutor;\n");

// 给被去掉的 import 提供替身：只要存在、方法可调用即可。
// OrekiSmartStrategy 在 runCycle 路径上不被调用（它只在 tick/observe 里用），
// 所以空壳足够，且不会掩盖被测逻辑。
sandbox.OrekiSmartStrategy = {
  drives: () => true,
  tick: () => {},
  evaluate: () => null,
};

vm.runInContext(cjs, sandbox, { filename: "oreki-smart-executor.js" });
const EXEC = sandbox.__EXEC__;

// ------------------------------------------------------------------ 断言工具

let checks = 0;
const fails = [];

function check(name, ok, detail = "") {
  checks++;
  if (!ok) fails.push(detail ? `${name}  ← ${detail}` : name);
}

/** 造一个「能记时间戳」的任务。acted=true 表示真动作，false 表示 no-op。 */
function makeTask(log, id, acted = true) {
  return () => {
    log.push({ id, at: monoNow });
    return { acted, changed: acted ? 1 : 0, verb: id, label: id };
  };
}

/** 重置调度器到已知状态。 */
function reset(intervalSec = 10, strictGlobal = false) {
  EXEC.setEnabled(true);
  EXEC.setIntervalSec(intervalSec);
  EXEC.setStrictGlobal(strictGlobal);
  // 清全部时间戳：通过 debugState 拿不到内部 STATE，改用「关闭再打开」+ 足够长时间
  monoNow += 10 * 60 * 1000;
}

// ------------------------------------------------------------------ R85：新存档默认值与用户可调边界

check("R85 新存档默认间隔为 10 秒（10000ms）", EXEC.intervalSec === 10,
      `实际为 ${EXEC.intervalSec} 秒`);
check("R85 1 秒边界有效", EXEC.setIntervalSec(0).intervalSec === 1,
      `实际为 ${EXEC.intervalSec} 秒`);
check("R85 60 秒边界有效", EXEC.setIntervalSec(61).intervalSec === 60,
      `实际为 ${EXEC.intervalSec} 秒`);
EXEC.setIntervalSec(37);
check("R85 合法用户设置写入后保持", localStorageShim.getItem("oreki.automation.intervalSec") === "37",
      `存储值为 ${localStorageShim.getItem("oreki.automation.intervalSec")}`);
EXEC.setIntervalSec(10);

// ------------------------------------------------------------------ 场景 1：首帧不得连买

{
  reset(1);
  monoNow += 1000; // 确保过了任何残留节拍
  const log = [];
  const tasks = [
    ["a", 1, makeTask(log, "a")],
    ["b", 1, makeTask(log, "b")],
    ["c", 1, makeTask(log, "c")],
    ["d", 1, makeTask(log, "d")],
    ["e", 1, makeTask(log, "e")],
  ];
  EXEC.runCycle(tasks);
  check("R78-1 首帧只允许 1 个真动作（同帧唯一）",
        log.length === 1, `实际执行了 ${log.length} 个: ${log.map(x => x.id).join(",")}`);
}

// ------------------------------------------------------------------ 场景 2：1 秒间隔

{
  reset(1);
  monoNow += 1000;
  const log = [];
  const tasks = [["a", 1, makeTask(log, "a")], ["b", 2, makeTask(log, "b")]];

  EXEC.runCycle(tasks);
  const first = log.length;

  // 推进 500ms（不足 1 秒）→ 不应放行
  monoNow += 500;
  EXEC.runCycle(tasks);
  check("R78-2a 距上次真动作 500ms 时拒绝（1 秒档）",
        log.length === first, `又执行了 ${log.length - first} 个`);

  // 再推进 600ms（累计 1100ms）→ 应放行 1 个
  monoNow += 600;
  EXEC.runCycle(tasks);
  check("R78-2b 累计 1100ms 后放行恰好 1 个",
        log.length === first + 1, `增量为 ${log.length - first}`);
}

// ------------------------------------------------------------------ 场景 3：60 秒档

{
  reset(60);
  monoNow += 60 * 1000;
  const log = [];
  const tasks = [["a", 1, makeTask(log, "a")]];

  EXEC.runCycle(tasks);
  const base = log.length;

  monoNow += 59 * 1000; // 59 秒，不足
  EXEC.runCycle(tasks);
  check("R78-3a 59 秒时拒绝（60 秒档）", log.length === base,
        `又执行了 ${log.length - base} 个`);

  monoNow += 2000; // 累计 61 秒
  EXEC.runCycle(tasks);
  check("R78-3b 61 秒时放行 1 个", log.length === base + 1,
        `增量为 ${log.length - base}`);
}

// ------------------------------------------------------------------ 场景 4：no-op 不占节拍

{
  reset(1);
  monoNow += 1000;
  const log = [];
  // 第一个任务是 no-op，第二个是真动作；同一帧里第二个应该能上
  const tasks = [
    ["noop", 1, makeTask(log, "noop", false)],
    ["real", 2, makeTask(log, "real", true)],
  ];
  EXEC.runCycle(tasks);
  const realRan = log.some((x) => x.id === "real");
  check("R78-4a no-op 之后同帧仍放行真动作", realRan,
        `本帧执行: ${log.map(x => x.id).join(",") || "(无)"}`);

  // 真动作占拍后，立刻再来一次不应放行
  const before = log.length;
  EXEC.runCycle(tasks);
  check("R78-4b 真动作已占拍，紧接着的帧被拒",
        log.length === before, `又执行了 ${log.length - before} 个`);
}

// ------------------------------------------------------------------ 场景 5：关闭即停

{
  reset(1);
  monoNow += 1000;
  const log = [];
  const tasks = [["a", 1, makeTask(log, "a")]];

  EXEC.setEnabled(false);
  EXEC.runCycle(tasks);
  check("R78-5 关闭后 runCycle 一个都不执行", log.length === 0,
        `执行了 ${log.length} 个`);
  EXEC.setEnabled(true);
}

// ------------------------------------------------------------------ 场景 6：间隔改动立即生效

{
  reset(60);
  monoNow += 60 * 1000;
  const log = [];
  const tasks = [["a", 1, makeTask(log, "a")]];

  EXEC.runCycle(tasks);
  const base = log.length;

  // 改成 1 秒，推进 1.1 秒 → 应该放行（如果还用旧值 60 秒就会被拒）
  EXEC.setIntervalSec(1);
  monoNow += 1100;
  EXEC.runCycle(tasks);
  check("R78-6 改成 1 秒后立即按新值调度",
        log.length === base + 1, `增量为 ${log.length - base}`);
}

// ------------------------------------------------------------------ 场景 7：连续型不再豁免

{
  reset(1);
  monoNow += 1000;
  const log = [];
  // 即使传了 cls="cont"，也必须受全局节拍约束
  const tasks = [
    ["routine", 1, makeTask(log, "routine"), "cont"],
    ["early", 2, makeTask(log, "early"), "cont"],
    ["eternity", 3, makeTask(log, "eternity"), "cont"],
  ];
  EXEC.runCycle(tasks);
  check("R78-7 连续型（cont）不再豁免：同帧仍只 1 个",
        log.length === 1, `实际 ${log.length} 个: ${log.map(x => x.id).join(",")}`);
}

// ------------------------------------------------------------------ 场景 8：界面提示的默认间隔必须等于代码默认值
//
// R94 实测缺陷：设置页说明文字长期写着「默认 3 秒」，而 R85 起
// `oreki-smart-executor.js` 的 `INTERVAL_DEFAULT_SEC` 已经是 10 秒。
// 玩家会照提示以为「恢复默认」是 3 秒。这里让两个来源互相对齐，防止再次漂移：
// 代码常量是唯一事实，界面文案必须写出同一个数字。
{
  const UI_SRC = join(__dirname, "..", "src", "components", "tabs", "options-gameplay", "OptionsGameplayTab.js");
  const ui = readFileSync(UI_SRC, "utf-8");
  const m = code.match(/const INTERVAL_DEFAULT_SEC = (\d+);/);
  check("R94-1 执行层存在 INTERVAL_DEFAULT_SEC 常量", Boolean(m), "没匹配到常量");
  const def = m ? Number(m[1]) : NaN;
  check(`R94-2 设置页提示写的默认值等于代码默认值（${def} 秒）`,
        Number.isFinite(def) && ui.includes(`默认 ${def} 秒`),
        `界面文案里找不到「默认 ${def} 秒」`);
  check("R94-3 设置页不再残留旧的「默认 3 秒」", !ui.includes("默认 3 秒"),
        "界面文案仍在写默认 3 秒");
}

// ------------------------------------------------------------------ 场景 9：教程附录 F 必须与真实节拍/真实顺序一致
//
// R94 缺陷（本轮发现并修）：第 1、2 章的 `automation` 字段已按统一自动节拍
// （默认 10 秒一次）与 R90/R92/R93 的真实出手顺序改写，但附录 F
// （`apx_automation.body`）里仍写着「每帧固定顺序为：买计数频率 → 维度提升 → 星系 → 维度」，
// 与同一份教程的第 1 章正文自相矛盾，也与 `src/game.js` 的真实顺序相反。
// 附录正文是玩家会单独翻阅的速查表，所以这里让「附录 ≠ 章节 ≠ 代码」任意一方漂移都失败。
{
  const TUTORIAL_JSON = join(__dirname, "..", "src", "core", "oreki-tutorial-data.json");
  const GAME_SRC = join(__dirname, "..", "src", "game.js");
  const data = JSON.parse(readFileSync(TUTORIAL_JSON, "utf-8"));
  const gameJs = readFileSync(GAME_SRC, "utf-8");
  const appendix = (data.appendices ?? []).find(a => a.id === "apx_automation");
  check("R94-4 教程存在附录 F（apx_automation）", Boolean(appendix), "找不到 apx_automation");
  const body = appendix?.body ?? "";
  const ch1 = body.slice(body.indexOf("### 第 1 章"), body.indexOf("### 第 2 章"));
  const ch2 = body.slice(body.indexOf("### 第 2 章"), body.indexOf("### 第 3 章"));
  check("R94-5 附录 F 第 1 章不再写「每帧固定顺序」（已改为统一自动节拍）",
        ch1.length > 0 && !ch1.includes("每帧固定顺序") && !ch1.includes("每帧买一次"),
        "附录 F 第 1 章仍在按「每帧」描述开局例程");
  check("R94-6 附录 F 第 1 章的出手顺序与 game.js 真实顺序一致",
        ch1.includes("能买就买维度提升 → 能买就买反物质星系 → 买计数频率"),
        "附录 F 第 1 章的购买顺序与生产代码不一致");
  check("R94-7 附录 F 第 2 章不再写「每帧处理」（与 10 秒节拍一致）",
        ch2.length > 0 && !ch2.includes("每帧处理"),
        "附录 F 第 2 章仍写「每帧处理」");
  // 代码侧顺序证据（文档断言的来源）：提升 → 星系 → 计数频率 → 献祭 → 维度升序
  const order = ["buyAffordableDimensionBoosts();", "buyAffordableGalaxies();",
    "buyMaxTickSpeed();", "sacrificeReset();", "for (let tier = 1; tier <= 8; tier++)"]
    .map(snippet => gameJs.indexOf(snippet));
  check("R94-8 game.js 的真实出手顺序与附录 F 文案同源",
        order.every(index => index > 0) && order.every((v, i) => i === 0 || order[i - 1] < v),
        `实际位置：${order.join(",")}`);
}

// ------------------------------------------------------------------ 汇总

console.log(`\nR78 Web 调度器行为自测：${checks} 项检查，失败 ${fails.length} 项`);
if (fails.length) {
  for (const f of fails) console.log("  FAIL", f);
  process.exit(1);
}
console.log("  全部通过");
process.exit(0);
