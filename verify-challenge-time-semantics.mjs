// 定向回归：挑战时间语义统一（挑战成绩 / 限时判定 / 时间门槛成就 必须同源）
//
// 层级说明（不要误读为浏览器集成测试）：
//   本脚本是 **Node 纯函数 + 静态守卫** 级验证。本机 Edge 无头启动失败
//   （puppeteer: "Failed to launch the browser process: Code: 0"，与本项目无关），
//   因此运行时集成验证暂由 `verify-time-equivalence.mjs` 承担，待浏览器可用时补跑。
//   本脚本能确定的：换算函数在三种倍率历史下的数值、以及全部调用点确实改用了它。
//
// 要证明的三件事：
//   1. 倍率恒定时，新口径与旧口径（原始时间 ÷ 当前倍率）数值完全一致 —— 无行为回归；
//   2. 倍率中途改变时，旧口径会把整段历史按新倍率重算（EC12 限时被放大/瞬间超时），
//      新口径不受影响；
//   3. 挑战限时判定与时间门槛站点已全部改用同源函数（静态守卫）。
//
// 用法: node verify-challenge-time-semantics.mjs [root]
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(process.argv[2] || "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition");

// ---- 在导入 time.js 之前注入它依赖的全局（真实应用由 merge-globals.js 提供）----
globalThis.TimeSpan = class TimeSpan {
  constructor(ms) { this.totalMilliseconds = Number(ms) || 0; }
  static fromMilliseconds(v) { return new TimeSpan(v); }
  get totalSeconds() { return this.totalMilliseconds / 1000; }
};
let CURRENT_F = 1;
globalThis.getGlobalSpeedFactor = () => CURRENT_F;
globalThis.player = { records: {} };

const time = await import(pathToFileURL(path.join(root, "src/core/time.js")).href);
const { inGameTimeOf, inGameSecondsOf, toInGameTimeMs } = time;

const results = [];
const check = (n, p, d = "") => { results.push({ n, p, d }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// 旧口径（修复前各站点的写法）：原始时间 ÷ 当前倍率
const legacySeconds = (section) => (section.time / 1000) / CURRENT_F;

// ============ A. 倍率恒定：新口径 === 旧口径（无回归）============
console.log("\n=== A. 倍率恒定 F=10000 ===");
{
  CURRENT_F = 10000;
  // 现实 300ms、F=10000 → 原始游戏时间 3,000,000ms；累加器逐帧 diff/F = 300ms
  const sec = { time: 3_000_000, inGameTime: 300, realTime: 300 };
  const neu = inGameSecondsOf(sec);
  const old = legacySeconds(sec);
  console.log(`  原始时间=${sec.time}ms  累加器=${sec.inGameTime}ms`);
  console.log(`  新口径=${neu}s   旧口径=${old}s`);
  check("[A1] 新口径 = 0.3 秒（现实 300ms，不随 F 膨胀）", near(neu, 0.3, 1e-12), String(neu));
  check("[A2] 【无回归】恒定倍率下新口径 === 旧口径", near(neu, old, 1e-12), `${neu} vs ${old}`);
}

// ============ B. 倍率中途改变：旧口径失真，新口径正确 ============
console.log("\n=== B. 倍率中途切换（每段 100ms 现实，累计 300ms）===");
{
  // 场景 B1：历史在 F=1 下，之后把倍率调高到 10000
  //   原始时间 = 100 + 1_000_000 + 100 = 1,000,200ms，累加器 = 300ms
  CURRENT_F = 10000;
  const raised = { time: 1_000_200, inGameTime: 300, realTime: 300 };
  const neuRaised = inGameSecondsOf(raised);
  const oldRaised = legacySeconds(raised);
  console.log(`  [调高] 原始=${raised.time}ms 累加器=${raised.inGameTime}ms`);
  console.log(`         新口径=${neuRaised}s  旧口径=${oldRaised}s`);
  check("[B1] 调高倍率后新口径仍为 0.3 秒", near(neuRaised, 0.3, 1e-12), String(neuRaised));
  check("[B2] 【缺陷证据】旧口径把 300ms 算成 0.1 秒（限时被无形放宽 3 倍）",
    oldRaised < neuRaised / 2, `${oldRaised} vs ${neuRaised}`);

  // 场景 B3：历史在 F=10000 下，之后把倍率调低回 1
  //   原始时间 = 1_000_000 + 100 + 1_000_000 ≈ 2,000,100ms，累加器 = 300ms
  CURRENT_F = 1;
  const lowered = { time: 2_000_100, inGameTime: 300, realTime: 300 };
  const neuLow = inGameSecondsOf(lowered);
  const oldLow = legacySeconds(lowered);
  console.log(`  [调低] 原始=${lowered.time}ms 累加器=${lowered.inGameTime}ms`);
  console.log(`         新口径=${neuLow}s  旧口径=${oldLow}s`);
  check("[B3] 调低倍率后新口径仍为 0.3 秒", near(neuLow, 0.3, 1e-12), String(neuLow));
  check("[B4] 【缺陷证据】旧口径把 300ms 算成 2000 秒（EC12 首次限时 1 秒会瞬间判失败）",
    oldLow > 1000, `${oldLow.toFixed(1)} 秒`);
  check("[B5] 失真幅度超 6000 倍", oldLow / neuLow > 6000, `${(oldLow / neuLow).toFixed(0)}×`);
}

// ============ C. 旧存档回退路径 ============
console.log("\n=== C. 旧存档没有 inGameTime 字段时的回退 ===");
{
  CURRENT_F = 10000;
  const sec = { time: 1_000_000, realTime: 100 };
  check("[C1] 回退为原始时间 ÷ 当前倍率 = 100ms", near(inGameTimeOf(sec), 100, 1e-9), String(inGameTimeOf(sec)));
  check("[C2] 秒换算 = 0.1 秒", near(inGameSecondsOf(sec), 0.1, 1e-12), String(inGameSecondsOf(sec)));
}

// ============ D. 异常值不得产生 NaN ============
console.log("\n=== D. 异常/缺失字段 ===");
{
  check("[D1] 无 section → 0", inGameSecondsOf(undefined) === 0);
  check("[D2] time 为 NaN → 0", inGameSecondsOf({ time: NaN }) === 0);
  check("[D3] inGameTime 为 0 时回退原始时间", near(inGameSecondsOf({ time: 200_000, inGameTime: 0 }), 0.02, 1e-12),
    String(inGameSecondsOf({ time: 200_000, inGameTime: 0 })));
}

// ============ E. 静态守卫：调用点必须改用同源函数 ============
console.log("\n=== E. 静态守卫 ===");
{
  const BAD = /Time\.this(Infinity|Eternity|Reality)\.total\w+\s*\/\s*getGlobalSpeedFactor\(\)/;
  const GATE_FILES = [
    "src/core/secret-formula/challenges/eternity-challenges.js",
    "src/core/secret-formula/achievements/normal-achievements.js",
    "src/core/secret-formula/eternity/time-studies/normal-time-studies.js",
    "src/core/secret-formula/reality/reality-upgrades.js",
    "src/components/ui-modes/FailableEcText.js",
  ];
  const offenders = [];
  for (const rel of GATE_FILES) {
    const text = fs.readFileSync(path.join(root, rel), "utf8");
    text.split(/\r?\n/).forEach((line, i) => { if (BAD.test(line)) offenders.push(`${rel}:${i + 1}`); });
  }
  check("[E1] 时间门槛/限时站点已无「原始时间 ÷ 当前倍率」", offenders.length === 0, offenders.join(", "));

  const ec = fs.readFileSync(path.join(root, "src/core/secret-formula/challenges/eternity-challenges.js"), "utf8");
  check("[E2] EC12 checkRestriction 使用 inGameSecondsOf(thisEternity)",
    /checkRestriction:\s*restriction\s*=>\s*inGameSecondsOf\(player\.records\.thisEternity\)/.test(ec));

  const ui = fs.readFileSync(path.join(root, "src/components/ui-modes/FailableEcText.js"), "utf8");
  check("[E3] EC 限时显示与判定同源（FailableEcText 使用 inGameSecondsOf）",
    /inGameSecondsOf\(player\.records\.thisEternity\)/.test(ui));

  const nc = fs.readFileSync(path.join(root, "src/core/normal-challenges.js"), "utf8");
  const ic = fs.readFileSync(path.join(root, "src/core/infinity-challenges.js"), "utf8");
  check("[E4] 普通挑战成绩用累加器（inGameTimeOf(thisInfinity)）",
    /inGameTimeOf\(player\.records\.thisInfinity\)/.test(nc));
  check("[E5] 无限挑战成绩用累加器（inGameTimeOf(thisInfinity)）",
    /inGameTimeOf\(player\.records\.thisInfinity\)/.test(ic));
}

const pass = results.filter(r => r.p).length;
console.log(`\n==== 结果: ${pass} 通过 / ${results.length - pass} 失败 ====`);
process.exit(pass === results.length ? 0 : 1);
