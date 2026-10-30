// 智能购买器（解释器 + 执行层）的单测（node 版：只桩掉被触到的全局，不启动浏览器）
//
// 关键一条：leaf 断言必须是**集合比对**，不能比数量。
// 「改名前后条数都是 18」⇒ 数量相同、集合不同，只比数量是错的但绿的。
import { evaluateCondition, OrekiSmartStrategy } from "../../AD-Oreki-Edition/src/core/oreki-smart-strategy.js";
import { OrekiSmartExecutor } from "../../AD-Oreki-Edition/src/core/oreki-smart-executor.js";

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(ok ? `  ok   ${name}` : `  FAIL ${name}: got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
  ok ? pass++ : fail++;
};
const ok = (name, cond, detail = "") => {
  console.log(cond ? `  ok   ${name}` : `  FAIL ${name}${detail ? `: ${detail}` : ""}`);
  cond ? pass++ : fail++;
};

// ── 最小全局桩：只实现本测试用到的叶子
class FakeDec {
  constructor(v) { this.v = v instanceof FakeDec ? v.v : v; }
  toNumber() { return this.v; }
  valueOf() { return this.v; }
  gt(x) { return this.v > (x instanceof FakeDec ? x.v : x); }
  gte(x) { return this.v >= (x instanceof FakeDec ? x.v : x); }
  lt(x) { return this.v < (x instanceof FakeDec ? x.v : x); }
  lte(x) { return this.v <= (x instanceof FakeDec ? x.v : x); }
  eq(x) { return this.v === (x instanceof FakeDec ? x.v : x); }
}
globalThis.Decimal = FakeDec;
globalThis.player = {
  break: false, infinities: new FakeDec(0), eternities: new FakeDec(0), realities: 0,
  dimensionBoosts: 0, auto: { autobuyersOn: true },
};
globalThis.PlayerProgress = {
  infinityUnlocked: () => false, eternityUnlocked: () => false, realityUnlocked: () => false,
};
globalThis.NormalChallenge = { isRunning: false };
globalThis.InfinityChallenge = { isRunning: false };
globalThis.EternityChallenge = { isRunning: false };
globalThis.Teresa = { isUnlocked: false };
globalThis.Pelle = { isDoomed: false, canArmageddon: false };
globalThis.Autobuyer = { bigCrunch: { hasMaxedInterval: false } };
globalThis.Currency = { realityShards: { value: new FakeDec(0) } };
globalThis.PelleUpgrade = { keepAutobuyers: { isBought: false } };
globalThis.GameEnd = { endState: 0 };

console.log("1) 条件求值的三种形状");
eq("not 叶子（开局未解锁）", evaluateCondition({ not: { leaf: "progress.infinityUnlocked" } }), true);
eq("all + lt", evaluateCondition({ all: [{ leaf: "player.infinities", op: "lt", value: 1 }, { not: { leaf: "progress.infinityUnlocked" } }] }), true);
eq("any 一真即真", evaluateCondition({ any: [{ leaf: "challenge.normalRunning" }, { leaf: "pelle.doomed" }] }), false);
eq("lt 是双向比较（不是和 0 比）", evaluateCondition({ leaf: "player.dimensionBoosts", op: "lt", value: 5 }), true);
eq("lt 反向必须为假", evaluateCondition({ leaf: "player.dimensionBoosts", op: "lt", value: 0 }), false);

console.log("2) 未知叶子/未知算子必须抛，不许静默 false");
let t1 = false; try { evaluateCondition({ leaf: "no.such.leaf" }); } catch (e) { t1 = true; }
eq("未知叶子抛错", t1, true);
let t2 = false; try { evaluateCondition({ leaf: "player.realities", op: "between", value: 1 }); } catch (e) { t2 = true; }
eq("未知算子抛错", t2, true);

console.log("3) spec 结构");
const ds = OrekiSmartStrategy.debugState();
eq("stage 条数", ds.stages, 9);
eq("strategy 条数", ds.strategies, 8);
// 集合比对：报错带具体名字
const missing = ds.declaredLeafIds.filter(x => !ds.leafIds.includes(x));
const extra = ds.leafIds.filter(x => !ds.declaredLeafIds.includes(x));
ok("叶子集合与 spec 完全一致（missing）", missing.length === 0, `missing=[${missing}]`);
ok("叶子集合与 spec 完全一致（extra）", extra.length === 0, `extra=[${extra}]`);
eq("叶子数 = 18", ds.leafIds.length, 18);

console.log("4) 阶段识别在桩状态下应为 early");
const d = OrekiSmartStrategy.evaluate(true);
eq("ok", d.ok, true);
eq("stage", d.stage && d.stage.id, "early");
eq("goal", d.goal && d.goal.id, "unlock-first-infinity");
eq("degraded", d.degraded, false);
// 阻塞项是**真字段**，不是摆设：桩里 hasMaxedInterval=false ⇒ intervalNotMaxed 必须命中
ok("blockers 命中 intervalNotMaxed", (d.blockers ?? []).some(b => b.id === "intervalNotMaxed"),
  JSON.stringify((d.blockers ?? []).map(b => b.id)));

console.log("5) precedence：挑战期间不得判成 infinity（同时命中时取大者）");
globalThis.PlayerProgress.infinityUnlocked = () => true;
globalThis.NormalChallenge.isRunning = true;
const dCh = OrekiSmartStrategy.evaluate(true);
eq("stage", dCh.stage && dCh.stage.id, "challenges");
globalThis.NormalChallenge.isRunning = false;
globalThis.PlayerProgress.infinityUnlocked = () => false;

console.log("6) manualOverride 与执行层闸门（顺序：先验闸门，再验让路）");
// 闸门测试必须在任何 noteManualAction 之前，否则这个 goal 一直被 hold 住，测不出接管逻辑。
const calls = [];
OrekiSmartExecutor.setEnabled(true);
let r = OrekiSmartExecutor.tick({ routine: false, early: false, eternity: false, reality: false });
eq("tick 返回决策", r && r.ok, true);
eq("未注册 ⇒ 不动手", calls.length, 0);
eq("executor.acted", r.executor && r.executor.acted, false);

console.log("7) 执行层：模块连续 3 帧无动作才接管，且只调该模块自己的方法");
OrekiSmartExecutor.register("routine", () => { calls.push("routine"); return true; });
OrekiSmartExecutor.observe("routine", true);     // 先把 idle 归零（上一节留下 1 帧计数）
eq("idle 已归零", OrekiSmartExecutor.debugState().idle.routine, 0);
OrekiSmartExecutor.tick({ routine: false });     // idle=1
eq("第 1 帧不动手", calls.length, 0);
OrekiSmartExecutor.tick({ routine: false });     // idle=2
eq("第 2 帧不动手", calls.length, 0);
r = OrekiSmartExecutor.tick({ routine: false }); // idle=3 → 动手
ok("第 3 帧接管", calls.length >= 1, `calls=${calls.length}`);
ok("调的是 routine 例程", calls[0] === "routine", `calls=${JSON.stringify(calls)}`);
eq("executor.acted", r.executor && r.executor.acted, true);

console.log("8) 执行层：模块本帧有动作时绝不插手");
const before = calls.length;
OrekiSmartExecutor.tick({ routine: true });
eq("有动作 ⇒ idle 归零", OrekiSmartExecutor.debugState().idle.routine, 0);
OrekiSmartExecutor.tick({ routine: false });
OrekiSmartExecutor.tick({ routine: false });
eq("重新计数期间不动手", calls.length, before);

console.log("9) manualOverride：noteManualAction 后该 goal 进入 hold");
OrekiSmartStrategy.noteManualAction("unlock-first-infinity");
const d2 = OrekiSmartStrategy.evaluate(true);
eq("manualHold.goalId", d2.manualHold && d2.manualHold.goalId, "unlock-first-infinity");
eq("hold 剩余为正", d2.manualHold.untilMs > Date.now(), true);

console.log("10) 执行层：手动 hold 期间一个动作都不发");
OrekiSmartExecutor.tick({ routine: false });
OrekiSmartExecutor.tick({ routine: false });
OrekiSmartExecutor.tick({ routine: false });
const beforeHold = calls.length;
r = OrekiSmartExecutor.tick({ routine: false });
OrekiSmartExecutor.tick({ routine: false });
OrekiSmartExecutor.tick({ routine: false });
OrekiSmartExecutor.tick({ routine: false });
eq("hold 期间不动手", calls.length, beforeHold);
eq("hold 原因可读出", r.executor && r.executor.reason, "manual-hold");

console.log("11) 执行层：没买到的 verb 要冷却，不能饿死后面的（smoke2 实测 370/409 次空转在同一个 verb）");
const verbsSeen = [];
OrekiSmartExecutor.register("routine", () => { verbsSeen.push("x"); return false; }); // 恒失败
OrekiSmartStrategy.clearManualHolds();  // 清掉上一段用例留下的 60 s 让路
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tickUntilPick = async () => {
  // 250 ms 的同 source 超频闸门是**墙钟**，测试里必须真的等，不能靠连续 tick 骗过去
  await sleep(300);
  for (let i = 0; i < 3; i++) OrekiSmartExecutor.tick({ routine: false });
  OrekiSmartExecutor.tick({ routine: false });
  return OrekiSmartExecutor.debugState().action?.verb ?? null;
};
// 清掉上一段 idle，直接看第 3 帧触发后的 verb 轮换
OrekiSmartExecutor.observe("routine", true);
const v1 = await tickUntilPick();
const v2 = await tickUntilPick();
ok("第一次与第二次挑的是不同 verb", v1 !== v2, `v1=${v1} v2=${v2}`);
ok("冷却表里有条目", Object.keys(OrekiSmartExecutor.debugState().noopUntil).length > 0,
  JSON.stringify(OrekiSmartExecutor.debugState().noopUntil));

console.log("12) 手动优先是**按 goal 分域**：挡住 A 不能连累 B");
// 切到 infinity 阶段（goal=unlock-eternity，策略 infinityOptimize → buyInfinityUpgrade/early）
GlobalThis: {
  globalThis.PlayerProgress.infinityUnlocked = () => true;
}
let earlyCalls = 0;
// 注意方法名是模块的真实 API（复数）：verb 叫 buyInfinityUpgrade，方法是 buyInfinityUpgrades
OrekiSmartExecutor.register("early", { buyInfinityUpgrades: () => { earlyCalls++; return true; } });
OrekiSmartStrategy.clearManualHolds();
// (a) 挡的是别的 goal → 当前 goal 照常动手
OrekiSmartStrategy.noteManualAction("unlock-first-infinity");
OrekiSmartExecutor.observe("early", true);
await sleep(300);
for (let i = 0; i < 4; i++) OrekiSmartExecutor.tick({ early: false });
ok("挡住别的 goal 时本 goal 仍然动手", earlyCalls > 0, `earlyCalls=${earlyCalls}`);
eq("当前阶段", OrekiSmartStrategy.evaluate(true).goal.id, "unlock-eternity");
// (b) 挡住当前 goal → 不动手
const beforeOwn = earlyCalls;
OrekiSmartStrategy.clearManualHolds();
OrekiSmartStrategy.noteManualAction("unlock-eternity");
OrekiSmartExecutor.observe("early", true);
await sleep(300);
for (let i = 0; i < 5; i++) OrekiSmartExecutor.tick({ early: false });
eq("挡住当前 goal 时不动手", earlyCalls, beforeOwn);
eq("hold 读得出来", OrekiSmartExecutor.debugState().manualHold?.goalId, "unlock-eternity");
OrekiSmartStrategy.clearManualHolds();

console.log("13) 「同帧不抢」计数器：模块有动作时接管必须是 0");
const st = OrekiSmartExecutor.debugState();
eq("takeoverWhileModuleActed", st.takeoverWhileModuleActed, 0);
ok("takeovers 计数有在动", st.takeovers > 0, `takeovers=${st.takeovers}`);
// 构造违例：先让 idle 达标，再在同一帧观察里声称模块刚动作过 —— 由于 observe 会清零 idle，
// 结构上做不到；这里只能验证「做不到」这件事本身（idle 归零 ⇒ 不接管）。
OrekiSmartExecutor.observe("early", true);
const beforeConflict = OrekiSmartExecutor.debugState().takeoverWhileModuleActed;
for (let i = 0; i < 3; i++) OrekiSmartExecutor.tick({ early: true });
eq("模块连续 3 帧都有动作 ⇒ 永不接管", OrekiSmartExecutor.debugState().takeoverWhileModuleActed, beforeConflict);

console.log("14) 执行层：不写任何 player 字段（静态自查，先剥注释）");
const raw = await import("node:fs").then(m => m.readFileSync(
  new URL("../../AD-Oreki-Edition/src/core/oreki-smart-executor.js", import.meta.url), "utf8"));
const code = raw
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map(line => line.replace(/\/\/.*$/, "")).join("\n");
const assignments = [...code.matchAll(/\bplayer\.[A-Za-z0-9_.]+\s*=[^=]/g)].map(m => m[0].trim());
eq("player.* 赋值条数", assignments.length, 0);
ok("没有直接写 player.break", !/player\.break\s*=/.test(code), "found assignment");

console.log(`\n通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
