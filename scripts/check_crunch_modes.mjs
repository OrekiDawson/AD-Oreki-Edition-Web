// [Oreki R71] 大坍缩自动购买器「三种触发模式都能选、且选了就留住」的回归测试。
//
// 为什么要有这个文件：
//   R71 报「第三种模式无法点击选择」。根因不是按钮没接事件，而是
//   `BigCrunchAutobuyerState.isUnlocked` 这个**每帧都被读的 getter** 里
//   带着一段 AU4b 归一化：只要模式是 AMOUNT 且 amount < 10，就把模式改回 X_HIGHEST。
//   玩家点下去，下一次 UI 读取就把它弹回去 —— 感官上就是「这个选项点不动」。
//
// 本测试**直接执行真实的 getter 源码**（从文件里切出方法体，用 Function 构造运行），
// 不是重写一份逻辑。覆盖：
//   ① 首次接管（lastTick == 0）仍会做一次归一化 —— 保住 AU4b 防死锁的初衷
//   ② 归一化只发生一次，之后玩家改回 AMOUNT 不再被覆盖
//   ③ 已经跑过（lastTick > 0）时，三种模式都能选、都能留住
//   ④ 「重启读档」= 新建实例 + 同一份存档数据，选择仍然保住
//
// 用法：node scripts/check_crunch_modes.mjs      （退出码 0 = 全过）

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = fs.readFileSync(
  path.join(ROOT, "src/core/autobuyers/big-crunch-autobuyer.js"), "utf-8");

let checks = 0;
const failures = [];
function check(name, ok, detail = "") {
  checks += 1;
  if (!ok) failures.push(detail ? `${name}  ← ${detail}` : name);
}

// ---------------- 从真实源码里切出 isUnlocked 的 getter 体 ----------------
const start = SRC.indexOf("get isUnlocked() {");
if (start < 0) throw new Error("找不到 isUnlocked getter（源码结构变了？）");
const open = SRC.indexOf("{", start);
let depth = 0, end = -1;
for (let i = open; i < SRC.length; i += 1) {
  if (SRC[i] === "{") depth += 1;
  else if (SRC[i] === "}") {
    depth -= 1;
    if (depth === 0) { end = i; break; }
  }
}
const body = SRC.slice(open + 1, end);

// ---------------- 最小运行环境 ----------------
const MODE = { AMOUNT: 0, TIME: 1, X_HIGHEST: 2 };
// break_infinity 的 Decimal 是**可构造**的（源码里有 `new Decimal(10)`），
// 所以这里用普通构造函数而不是箭头函数，否则 `TypeError: Decimal is not a constructor`。
function Decimal(v) {
  this.v = typeof v === "number" ? v : (v && typeof v.v === "number" ? v.v : 0);
}
Decimal.prototype.lt = function (other) { return this.v < Decimal.valueOf(other); };
Decimal.lt = (a, b) => Decimal.valueOf(a) < Decimal.valueOf(b);
Decimal.valueOf = (x) => (typeof x === "number" ? x : (x && typeof x.v === "number" ? x.v : 0));

const Pelle = { isDoomed: false };
const PelleStrikes = { infinity: { hasStrike: true } };
const PlayerProgress = { infinityUnlocked: () => true };

// getter 体里自带 `const unlocked = ...`，所以不能把 unlocked 当参数名；
// 用 `this` 绑定实例（真实代码就是靠 this.data / this.canBeUpgraded 取值）。
const runner = new Function(
  "Decimal", "AUTO_CRUNCH_MODE", "Pelle", "PelleStrikes", "PlayerProgress",
  body,
);

/** 造一个「自动器实例」：data + 迁移标志 + canBeUpgraded，然后按真实 getter 求值。 */
function makeInstance(data) {
  const inst = { data, canBeUpgraded: true };
  return () => runner.call(inst, Decimal, MODE, Pelle, PelleStrikes, PlayerProgress);
}

function freshSave(over = {}) {
  return { mode: MODE.AMOUNT, amount: new Decimal(1), xHighest: new Decimal(1), lastTick: 0, ...over };
}

// ---------------- ① 首次接管仍做一次归一化（AU4b 初衷） ----------------
{
  const save = freshSave();
  const read = makeInstance(save);
  read();
  check("首次接管：AMOUNT + amount<10 会被归一化成 X_HIGHEST",
    save.mode === MODE.X_HIGHEST, `mode=${save.mode}`);
  check("首次接管：归一化同时把 xHighest 设为 10",
    save.xHighest.v === 10, `xHighest=${save.xHighest.v}`);
}

// ---------------- ② 归一化只发生一次，玩家改回去不再被覆盖 ----------------
{
  const save = freshSave();
  const read = makeInstance(save);
  read();                       // 首次归一化
  save.mode = MODE.AMOUNT;      // 玩家主动选回 AMOUNT
  read(); read(); read();       // 连续多帧读取
  check("归一化后玩家改回 AMOUNT 不再被弹回",
    save.mode === MODE.AMOUNT, `mode=${save.mode}`);
}

// ---------------- ③ 已经跑过（lastTick>0）时三种模式都能留住 ----------------
for (const [name, mode] of [
  ["第一种：大坍缩后获得 X 无限点数（AMOUNT）", MODE.AMOUNT],
  ["第二种：每 X 秒自动大坍缩（TIME）", MODE.TIME],
  ["第三种：最高无限点数的 X 倍（X_HIGHEST）", MODE.X_HIGHEST],
]) {
  const save = freshSave({ mode, lastTick: 12345 });
  const read = makeInstance(save);
  read(); read();
  check(`${name} 选择后保持`, save.mode === mode, `mode=${save.mode}`);
}

// ---------------- ④ 重启读档：新实例 + 同一份存档，选择仍保住 ----------------
for (const [name, mode] of [
  ["AMOUNT", MODE.AMOUNT],
  ["TIME", MODE.TIME],
  ["X_HIGHEST", MODE.X_HIGHEST],
]) {
  const save = freshSave({ mode, lastTick: 999 });   // 存档里已 tick 过
  const readAfterReload = makeInstance(save);
  readAfterReload();
  check(`重启读档后 ${name} 仍保持`, save.mode === mode, `mode=${save.mode}`);
}

// ---------------- ⑤ 三条互不串味：切换不残留 ----------------
{
  const save = freshSave({ lastTick: 5 });
  const read = makeInstance(save);
  for (const mode of [MODE.X_HIGHEST, MODE.TIME, MODE.AMOUNT, MODE.TIME, MODE.X_HIGHEST]) {
    save.mode = mode;
    read();
    if (save.mode !== mode) {
      check(`切换链里 ${mode} 被改写`, false, `got=${save.mode}`);
    }
  }
  check("连续切换 5 次都不残留旧模式", save.mode === MODE.X_HIGHEST, `mode=${save.mode}`);
}

// ---------------- ⑥ 归一化不得触碰其它自动器设置 ----------------
{
  const save = freshSave({ time: 3, interval: 100, isActive: true, increaseWithMult: false });
  const read = makeInstance(save);
  read();
  check("归一化不改 time", save.time === 3);
  check("归一化不改 interval", save.interval === 100);
  check("归一化不改 isActive", save.isActive === true);
  check("归一化不改 increaseWithMult", save.increaseWithMult === false);
}


// ---------------------------------------------------------------- [R96] 智能大坍缩决策
import { readFileSync } from "node:fs";
const policySrc = readFileSync(new URL("../src/core/oreki-crunch-policy.js", import.meta.url), "utf8");
const autobuyerSrc = readFileSync(new URL("../src/core/autobuyers/big-crunch-autobuyer.js", import.meta.url), "utf8");
check("智能坍缩决策模块存在", policySrc.includes("export class OrekiCrunchPolicy"));
check("挑战最优先", policySrc.indexOf("NormalChallenge.isRunning") < policySrc.indexOf("player.break"));
check("未 Break 放行", policySrc.includes('"pre-break-ip"'));
check("永恒前保护 ID 峰值", policySrc.includes('"id-peak-wait"'));
check("判据异常 fail-closed", policySrc.includes("allow: false") && policySrc.includes("exception:"));
check("原版自动器接入决策", autobuyerSrc.includes("OrekiCrunchPolicy.decide()"));
check("决策接入点在 willInfinity 内", autobuyerSrc.indexOf("OrekiCrunchPolicy.decide()") > autobuyerSrc.indexOf("willInfinity"));

// ---------------- 汇总 ----------------
console.log(`\n大坍缩三种触发模式回归：${checks} 项检查，失败 ${failures.length} 项`);
if (failures.length) {
  for (const f of failures) console.log("  FAIL", f);
  process.exit(1);
}
console.log("  全部通过");
