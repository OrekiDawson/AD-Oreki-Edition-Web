// [R40-S1] 解释器自测（Node，不启浏览器）：只验证「决策对象形状 / 阶段识别 / 手动保护 / failSafe」。
//
// 为什么值得单独写一个：
//   `oreki-smart-strategy.js` 只读全局对象（PlayerProgress / player / Pelle / ...），
//   所以在 Node 里用桩替身就能把它跑起来，不需要开 10000× 跑一遍游戏。
//   这样「解释器逻辑错」和「游戏数值不对」能分开定位 —— 上一轮佩勒那个坑就是
//   把两者混在一起查，多花了两轮。
//
// 注意：这里 stub 的数值**不代表游戏真实值**，只用来驱动分支。真值以
// `_tools/_r40/R40S1-智能策略叶子取值表.md` 与实测 jsonl 为准。
//
// 用法：node _tools/_r40/r40s1-interp-selftest.mjs

import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MOD = path.resolve(HERE, "..", "..", "AD-Oreki-Edition", "src", "core", "oreki-smart-strategy.js");

/** 最小 Decimal 桩：只实现解释器用到的那几个方法。 */
class FakeDecimal {
  constructor(v) { this.v = Number(v); }
  gt(o) { return this.v > unwrap(o); }
  lt(o) { return this.v < unwrap(o); }
  gte(o) { return this.v >= unwrap(o); }
  eq(o) { return this.v === unwrap(o); }
  toNumber() { return this.v; }
}
function unwrap(o) { return o instanceof FakeDecimal ? o.v : Number(o); }

/** 造一份「可调」的全局状态。改 `state` 再调 evaluate(true) 即可驱动不同分支。 */
function installGlobals(state) {
  globalThis.Decimal = FakeDecimal;
  globalThis.player = {
    break: state.break === true,
    infinities: new FakeDecimal(state.infinities ?? 0),
    eternities: new FakeDecimal(state.eternities ?? 0),
    realities: state.realities ?? 0,
  };
  globalThis.PlayerProgress = {
    infinityUnlocked: () => state.infinityUnlocked === true,
    eternityUnlocked: () => state.eternityUnlocked === true,
    realityUnlocked: () => state.realityUnlocked === true,
  };
  globalThis.NormalChallenge = { isRunning: state.normalRunning === true };
  globalThis.InfinityChallenge = { isRunning: state.infinityRunning === true };
  globalThis.EternityChallenge = { isRunning: state.eternityRunning === true };
  globalThis.Teresa = { isUnlocked: state.teresaUnlocked === true };
  globalThis.Pelle = {
    isDoomed: state.doomed === true,
    canArmageddon: state.canArmageddon === true,
  };
  globalThis.Autobuyer = { bigCrunch: { hasMaxedInterval: state.maxedInterval === true } };
  globalThis.Currency = { realityShards: { value: new FakeDecimal(state.shards ?? 0) } };
  globalThis.PelleUpgrade = { keepAutobuyers: { isBought: state.keepAutobuyers === true } };
}

const base = {
  infinityUnlocked: false, eternityUnlocked: false, realityUnlocked: false,
  normalRunning: false, infinityRunning: false, eternityRunning: false,
  teresaUnlocked: false, doomed: false, canArmageddon: false,
  maxedInterval: false, shards: 0, keepAutobuyers: false, break: false,
  infinities: 0, eternities: 0, realities: 0,
};

installGlobals({ ...base });
const { evaluate, noteManualAction, debugState, evaluateCondition } =
  await import(`file://${MOD.split(path.sep).join("/")}`);

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  [ok]   ${name}`); } else { fail++; console.error(`  [FAIL] ${name}  ${detail ?? ""}`); }
}

console.log("A. 阶段识别");
{
  installGlobals({ ...base });
  const d = evaluate(true);
  check("全新档 → early", d.ok && d.stage.id === "early", JSON.stringify(d.stage));
  check("early 的目标是 unlock-first-infinity", d.goal?.id === "unlock-first-infinity", String(d.goal?.id));
  check("early 的策略是 growth", d.strategy?.id === "growth", String(d.strategy?.id));
  check("priority 是数组且非空", Array.isArray(d.strategy.priority) && d.strategy.priority.length > 0);
}
{
  installGlobals({ ...base, infinityUnlocked: true, infinities: 5 });
  const d = evaluate(true);
  check("已无限未永恒 → infinity", d.stage.id === "infinity", JSON.stringify(d.stage));
}
{
  installGlobals({ ...base, infinityUnlocked: true, infinities: 3, normalRunning: true });
  const d = evaluate(true);
  // 期望值改成「按 spec 数组顺序取第一个匹配」——这是本实现与文档约定的确定性语义。
  // 真实的 spec 缺陷（infinity 与 challenges 同时成立、无 precedence）见
  // `R40S1-智能策略叶子取值表.md` §3，不要在这里假装它不存在。
  check("未永恒 + 普通挑战 → 按 spec 顺序仍是 infinity", d.stage.id === "infinity", JSON.stringify(d.stage));
  console.log("  [warn] 阶段重叠：infinity 与 challenges 的 detect 同时成立，spec 缺 precedence 字段，已报 team-lead");
}
{
  installGlobals({ ...base, infinityUnlocked: true, eternities: 1, eternityUnlocked: true, realityUnlocked: true, teresaUnlocked: true, doomed: true, canArmageddon: true });
  const d = evaluate(true);
  check("毁灭态 → doomed", d.stage.id === "doomed", JSON.stringify(d.stage));
  check("doomed 策略是 pelleEndgame", d.strategy.id === "pelleEndgame", String(d.strategy.id));
  check("pelleEndgame 的 priority 含 armageddonLoopForShards", d.strategy.priority.includes("armageddonLoopForShards"), JSON.stringify(d.strategy.priority));
  check("guards 被原样带出（不是空）", d.strategy.guards.length >= 4, String(d.strategy.guards.length));
}

console.log("B. 叶子与比较");
{
  installGlobals({ ...base, shards: 1e6 });
  check("shards gte 1e6", evaluateCondition({ leaf: "reality.shards", op: "gte", value: 1e6 }) === true);
  check("shards lt 5e6", evaluateCondition({ leaf: "reality.shards", op: "lt", value: 5e6 }) === true);
  check("all/any/not 组合", evaluateCondition({ all: [
    { leaf: "reality.shards", op: "gte", value: 1 },
    { not: { leaf: "player.break" } },
  ] }) === true);
  let threw = false;
  try { evaluateCondition({ leaf: "not.a.leaf" }); } catch (e) { threw = true; }
  check("未知叶子必须抛错（不许静默 false）", threw);
  let threw2 = false;
  try { evaluateCondition("这是一句说明文字"); } catch (e) { threw2 = true; }
  check("字符串条件视为不可求值（抛错）", threw2);
}

console.log("C. 阻碍项");
{
  installGlobals({ ...base, doomed: true, shards: 1e6 });
  const d = evaluate(true);
  const ids = (d.blockers ?? []).map(b => b.id);
  check("末日态能识别 intervalNotMaxed", ids.includes("intervalNotMaxed"), JSON.stringify(ids));
  check("字符串 detect 的阻碍项被跳过而不是报错", !ids.includes("challengeRewardMissing"), JSON.stringify(ids));
}

console.log("D. 手动保护（按 goal 分域）");
{
  installGlobals({ ...base });
  evaluate(true);
  noteManualAction("unlock-first-infinity");
  const d = evaluate(true);
  check("同 goal 进入保护", d.manualHold?.goalId === "unlock-first-infinity", JSON.stringify(d.manualHold));
  check("保护是有期限的（不是永久）", typeof d.manualHold?.untilMs === "number" && d.manualHold.untilMs > Date.now());
}

console.log("E. failSafe");
{
  installGlobals({ ...base, infinityUnlocked: true, infinities: 2 });
  evaluate(true); // 先建立 lastKnownGood
  // 让「所有阶段的 detect 都抛错」——这才是真正的致命错误路径：
  // detectStage 里每个阶段都求值失败 ⇒ no-stage-matched ⇒ 外层 catch ⇒ 回落 lastKnownGood。
  const boom = () => { throw new Error("boom"); };
  globalThis.PlayerProgress = { infinityUnlocked: boom, eternityUnlocked: boom, realityUnlocked: boom };
  const d = evaluate(true);
  check("抛错后返回 degraded 而不是抛给调用方", d.degraded === true, JSON.stringify({ degraded: d.degraded, err: d.error }));
  check("回落到 lastKnownGood 的阶段", d.stage?.id === "infinity", String(d.stage?.id));
  const dbg = debugState();
  check("降级计数增加", dbg.degradedCount >= 1, String(dbg.degradedCount));
  check("lastError 记录了原因", /boom|no-stage-matched/.test(dbg.lastError), dbg.lastError);
}
{
  // 反面：单个阻碍项求值失败**不应该**让整个决策降级（局部降级 vs 整体停机）
  installGlobals({ ...base, infinityUnlocked: true, infinities: 2 });
  evaluate(true);
  const okBreak = globalThis.Autobuyer;
  globalThis.Autobuyer = {
    get bigCrunch() { throw new Error("blocker-only"); },
  };
  const d = evaluate(true);
  check("阻碍项抛错不应拖垮整个决策", d.ok === true && d.degraded === false, JSON.stringify({ ok: d.ok, degraded: d.degraded }));
  globalThis.Autobuyer = okBreak;
}

console.log("F. spec 对齐");
{
  installGlobals({ ...base });
  const dbg = debugState();
  check("实现的叶子数 == spec 声明数（16）", dbg.leaves === dbg.declaredLeaves && dbg.leaves === 16, `${dbg.leaves}/${dbg.declaredLeaves}`);
  check("specId 读到", dbg.specId === "oreki-smart-autobuyer", String(dbg.specId));
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
