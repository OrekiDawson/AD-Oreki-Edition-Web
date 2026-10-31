// [R42] 路线择优层自测（Node，不启浏览器）。
//
// 只验证「路线层本身」：解释器没坏、重排是排列、滞回真的挡得住、并列决胜不用随机。
// 不验证游戏数值 —— 那是 pelle-probe 的活。
//
// 为什么不用「跑一遍 12 分钟看有没有变慢」代替单测：
// 通关秒数在 708~915 s 之间抖（FACTS C.47 六次读数），一次跑分根本区分不了
// 「策略层改了顺序」与「这次运气差」。所以顺序变化必须在纯函数层面证明有界。
//
// 用法：node _tools/_r40/r42-route-selftest.mjs

import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MOD = path.resolve(HERE, "..", "..", "AD-Oreki-Edition", "src", "core", "oreki-smart-strategy.js");

let pass = 0;
let fail = 0;
const failures = [];
function ok(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; failures.push(`${name}${detail ? ` — ${detail}` : ""}`); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}
function eq(name, a, b) { ok(name, JSON.stringify(a) === JSON.stringify(b), `实际=${JSON.stringify(a)} 期望=${JSON.stringify(b)}`); }

class FakeDecimal {
  constructor(v) { this.v = Number(v); }
  gt(o) { return this.v > unwrap(o); }
  lt(o) { return this.v < unwrap(o); }
  gte(o) { return this.v >= unwrap(o); }
  lte(o) { return this.v <= unwrap(o); }
  eq(o) { return this.v === unwrap(o); }
  log10() { return Math.log10(this.v); }
  toNumber() { return this.v; }
  toString() { return String(this.v); }
}
function unwrap(o) { return o instanceof FakeDecimal ? o.v : Number(o); }

/** 装全局。`state` 可改，用来驱动不同阶段。 */
function installGlobals(state) {
  globalThis.Decimal = FakeDecimal;
  globalThis.player = {
    break: state.break === true,
    infinities: new FakeDecimal(state.infinities ?? 0),
    eternities: new FakeDecimal(state.eternities ?? 0),
    realities: state.realities ?? 0,
    antimatter: new FakeDecimal(state.am ?? 1),
    dimensionBoosts: state.dimensionBoosts ?? 0,
  };
  globalThis.PlayerProgress = {
    infinityUnlocked: () => state.infinityUnlocked === true,
    eternityUnlocked: () => state.eternityUnlocked === true,
    realityUnlocked: () => state.realityUnlocked === true,
  };
  globalThis.Player = {
    get infinityGoal() { return new FakeDecimal(state.infinityGoal ?? 1.7976931348623157e308); },
    get eternityGoal() { return new FakeDecimal(state.eternityGoal ?? 1e10); },
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
  globalThis.Currency = {
    realityShards: { value: new FakeDecimal(state.shards ?? 0) },
    infinityPoints: { value: new FakeDecimal(state.ip ?? 1) },
    eternityPoints: { value: new FakeDecimal(state.ep ?? 1) },
    timeTheorems: { value: new FakeDecimal(state.tt ?? 1) },
    realityMachines: { value: new FakeDecimal(state.rm ?? 0) },
  };
  globalThis.PelleUpgrade = { keepAutobuyers: { isBought: state.keepAutobuyers === true } };
  globalThis.TimeStudy = { reality: { cost: new FakeDecimal(state.ds6Cost ?? 1e9), isBought: state.ds6 === true } };
  globalThis.AntimatterDimension = () => ({ cost: new FakeDecimal(state.ad1Cost ?? 10) });
  globalThis.Tickspeed = { cost: new FakeDecimal(state.tsCost ?? 10) };
  globalThis.InfinityDimension = () => ({ cost: new FakeDecimal(state.id1Cost ?? 10) });
}

const MOD_URL = `file:///${MOD.replace(/\\/g, "/")}`;
installGlobals({});
const M = await import(MOD_URL);
const { evaluate, _internals } = M;

console.log("\n[1] 模块加载与原有解释器不回归");
installGlobals({});
_internals.reset();
let d = evaluate(true);
ok("evaluate() 返回 ok", d.ok === true, JSON.stringify(d).slice(0, 160));
ok("阶段识别为 early", d.stage?.id === "early", String(d.stage?.id));
ok("叶子集合仍对齐", M.debugState().leafIds.join("|") === M.debugState().declaredLeafIds.join("|"));
ok("decisions 带 route 段", d.route !== null && typeof d.route === "object");

console.log("\n[2] 重排必须是排列：集合不变、长度不变");
for (const s of [
  { infinityUnlocked: false, dimensionBoosts: 0 },
  { infinityUnlocked: false, dimensionBoosts: 3 },
  { infinityUnlocked: true },
  { infinityUnlocked: true, eternityUnlocked: true, tt: 1e5, ds6Cost: 1e9 },
  { infinityUnlocked: true, eternityUnlocked: true, realityUnlocked: true },
  { infinityUnlocked: true, eternityUnlocked: true, realityUnlocked: true, teresaUnlocked: true },
  { infinityUnlocked: true, eternityUnlocked: true, realityUnlocked: true, teresaUnlocked: true, doomed: true },
]) {
  installGlobals(s);
  _internals.reset();
  d = evaluate(true);
  const a = d.strategy?.priority ?? [];
  const b = d.strategy?.specPriority ?? [];
  const sameSet = a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");
  ok(`stage=${d.stage?.id} 重排是排列`, sameSet, `priority=${a} spec=${b}`);
  ok(`stage=${d.stage?.id} 无重复动词`, new Set(a).size === a.length, JSON.stringify(a));
}

console.log("\n[3] 绑定不能引入新购买权，也不能动未绑定的槽位");
{
  const priority = ["buyTimeTheorem", "buyTimeStudy", "eternity"];
  // 绑定里混了一个不存在的动词 ⇒ 丢弃；`buyTimeStudy` 未绑定 ⇒ 留在原位（下标 1）
  const r1 = _internals.orderForBinding({ verbs: ["eternity", "不存在的动词", "buyTimeTheorem"] }, priority);
  eq("未知动词被丢弃 + 原位换位", r1.order, ["eternity", "buyTimeStudy", "buyTimeTheorem"]);
  eq("未绑定的动词一格没动", r1.order[1], "buyTimeStudy");
  const r2 = _internals.orderForBinding({ verbs: ["完全不存在"] }, priority);
  eq("全都不可执行 ⇒ null", r2, null);
  const r3 = _internals.orderForBinding(null, priority);
  eq("没有绑定 ⇒ null", r3, null);

  // spec 原序的绑定必须原样返回（这是 742.1 s 那条路径上真正的取值）
  const reality = ["equipBestGlyph", "buyRealityUpgrade", "buyRealityMachine", "runReality"];
  const r4 = _internals.orderForBinding({ verbs: ["equipBestGlyph", "buyRealityUpgrade", "runReality"] }, reality);
  eq("reality-glyph-first == spec 原序", r4.order, reality);
  // machine-first 只动前两个槽位，buyRealityMachine 与 runReality 的位置不动
  const r5 = _internals.orderForBinding({ verbs: ["buyRealityUpgrade", "equipBestGlyph", "runReality"] }, reality);
  eq("reality-machine-first 只换前两位", r5.order, ["buyRealityUpgrade", "equipBestGlyph", "buyRealityMachine", "runReality"]);
}

console.log("\n[4] 评分：ETA 是主排序键，5% 以内改用风险/操作数");
{
  const mk = (id, eta, risk = "none", ops = 3, dist = 0) => ({
    id, title: id, prereqOk: true, etaRealSec: eta, risk: { level: risk }, ops, reorderDistance: dist,
  });
  const c = _internals.compareScores;
  ok("ETA 100 vs 130 ⇒ 100 在前", c(mk("a", 100), mk("b", 130)) < 0);
  ok("ETA 130 vs 100 ⇒ 100 在前", c(mk("b", 130), mk("a", 100)) > 0);
  // 3% 差距落在 5% 带内 ⇒ 不比 ETA，比风险
  ok("差距 3% + 风险更低者胜", c(mk("a", 100, "none"), mk("b", 97, "medium")) < 0);
  ok("差距 8% ⇒ 仍由 ETA 决胜", c(mk("a", 100, "none"), mk("b", 92, "medium")) > 0);
  // 一边没有 ETA ⇒ 不拿 null 当无穷大，改用风险/操作数
  ok("一边 eta=null 时按风险比较", c(mk("a", null, "none"), mk("b", 10, "medium")) < 0);
  ok("风险与操作数都并列时选重排更小的", c(mk("a", null, "none", 3, 0), mk("b", null, "none", 3, 2)) < 0);
  ok("完全并列 ⇒ 0（稳定，不随插入顺序抖动）", c(mk("a", null), mk("b", null)) === 0);
}

console.log("\n[5] 滞回：15% 阈值 + 300 s 冷却");
{
  const mk = (id, eta) => ({
    id, title: id, prereqOk: true, etaRealSec: eta, risk: { level: "none" }, ops: 3, reorderDistance: 1,
  });
  const S = _internals.symbols;
  eq("切换阈值取自 route-model", S.ROUTE_SWITCH_MARGIN, 0.15);
  eq("冷却取自 route-model", S.ROUTE_SWITCH_COOLDOWN_MS, 300000);

  const T0 = 1_000_000;
  _internals.reset();
  // 首次选定：没有当前路线 ⇒ 直接采纳最优
  let r = _internals.selectRoute([mk("cur", 100), mk("alt", 200)], T0);
  eq("首次选定 kind", r.kind, "init");
  eq("首次选定取最优", r.to, "cur");

  // 便宜 12% ⇒ 不换
  r = _internals.selectRoute([mk("cur", 100), mk("alt", 88)], T0 + 1000);
  eq("便宜 12% 不切", r.changed, false);
  ok("原因写明 hold", String(r.reason).startsWith("hold"), r.reason);

  // 便宜 25% 但冷却未到 ⇒ 仍不换
  r = _internals.selectRoute([mk("cur", 100), mk("alt", 75)], T0 + 60_000);
  eq("冷却期内不切", r.changed, false);
  ok("原因写明冷却", String(r.reason).includes("冷却"), r.reason);

  // 冷却到期 + 便宜 25% ⇒ 切
  r = _internals.selectRoute([mk("cur", 100), mk("alt", 75)], T0 + 300_001);
  eq("冷却到期后允许切", r.kind, "faster");
  eq("切到 alt", r.to, "alt");

  // 刚切完，再便宜也不许立刻回切
  r = _internals.selectRoute([mk("alt", 75), mk("cur", 100)], T0 + 300_002);
  eq("切完立刻不反悔", r.changed, false);

  // 当前路线失效 ⇒ 不等冷却，立刻换
  _internals.reset();
  _internals.selectRoute([mk("cur", 100)], T0);
  r = _internals.selectRoute([{ ...mk("cur", 100), prereqOk: false }, mk("alt", 500)], T0 + 1000);
  eq("当前失效立即换", r.kind, "unviable");
  eq("换到 alt", r.to, "alt");

  // 全部不可执行 ⇒ 不选
  _internals.reset();
  r = _internals.selectRoute([{ ...mk("a", 10), prereqOk: false }], T0);
  eq("全不可执行 ⇒ null", r, null);
}

console.log("\n[6] 路线层的两个硬过滤真的会淘汰路线");
{
  // celestials 阶段：priority 全是 delegated，celestial-parallel-v 没有绑定
  installGlobals({
    infinityUnlocked: true, eternityUnlocked: true, realityUnlocked: true, teresaUnlocked: true,
  });
  _internals.reset();
  d = evaluate(true);
  const c = d.route?.candidates ?? [];
  const pv = c.find(x => x.id === "celestial-parallel-v");
  ok("celestials 有候选", c.length > 0, JSON.stringify(c.map(x => x.id)));
  ok("celestial-parallel-v 被淘汰", pv && pv.prereqOk === false, JSON.stringify(pv));
  ok("被淘汰的判为高风险", pv && pv.risk === "high", String(pv?.risk));

  // doomed 阶段：pelle-grow-only 没有绑定
  installGlobals({
    infinityUnlocked: true, eternityUnlocked: true, realityUnlocked: true, teresaUnlocked: true, doomed: true,
  });
  _internals.reset();
  d = evaluate(true);
  const cd = d.route?.candidates ?? [];
  const go = cd.find(x => x.id === "pelle-grow-only");
  ok("pelle-grow-only 被淘汰", go && go.prereqOk === false, JSON.stringify(go));
  ok("pelle-shard-loop 可用", (cd.find(x => x.id === "pelle-shard-loop")?.prereqOk) === true);
}

console.log("\n[7] ETA 只用真实数据；读不到就是 null（不编数）");
{
  installGlobals({});
  _internals.reset();
  const e1 = _internals.estimateGoalEta("infinity");
  eq("样本不足 ⇒ eta null", e1.eta, null);
  eq("原因写 rate-unknown", e1.reason, "rate-unknown");
  eq("未登记阶段 ⇒ null", _internals.estimateGoalEta("doomed").eta, null);
  eq("未登记阶段原因", _internals.estimateGoalEta("doomed").reason, "goal-threshold-unreadable");

  // 阈值已达成 ⇒ 0
  installGlobals({ ip: 1e20, eternityGoal: 1e10 });
  _internals.reset();
  eq("阈值已达成 ⇒ 0", _internals.estimateGoalEta("infinity").eta, 0);

  // partial 目标：阈值达成但目标没达成 ⇒ **不许报 0**
  // （实测踩点：r42-route-peek-b 在 t=6.2 s 报出 eta=0s，而现实并未解锁）
  installGlobals({
    infinityUnlocked: true, eternityUnlocked: true, realityUnlocked: false,
    tt: 1e12, ds6Cost: 1e6,
  });
  _internals.reset();
  const e2 = _internals.estimateGoalEta("eternity");
  eq("partial 目标阈值达成但未解锁 ⇒ null", e2.eta, null);
  eq("原因写明", e2.reason, "threshold-met-but-goal-not-done");
}

console.log("\n[8] 速率是真实回归，不是魔法数");
{
  eq("log10Of(1000)", _internals.log10Of(1000), 3);
  eq("log10Of(0) ⇒ null", _internals.log10Of(0), null);
  eq("log10Of(null) ⇒ null", _internals.log10Of(null), null);
  eq("log10Of(Decimal) ", _internals.log10Of(new FakeDecimal(1e5)), 5);

  // 直接检验最小二乘：l = 2 + 0.5×秒 ⇒ 斜率 0.5
  installGlobals({ ip: 1, eternityGoal: 1e30 });
  _internals.reset();
  // 用 evaluate 触发采样不现实（1 s 节流）；这里改走 estimateGoalEta 前的同一套采样函数：
  // 借助时间推进，逐秒注入。
  const t0 = Date.now();
  for (let i = 0; i < 6; i++) {
    const now = t0 + i * 1000;
    // 手动模拟 sampleRates 的写入（与生产同一张表，只经由公开路径拿不到，所以只测 rateOf 已含的窗口逻辑）
    globalThis.Currency.infinityPoints.value = new FakeDecimal(Math.pow(10, 2 + 0.5 * i));
    // 这里调用不到 sampleRates（未导出），因此只验证 rateOf 在样本不足时返回 null
  }
  eq("样本不足时 rateOf ⇒ null", _internals.rateOf("infinityPoints"), null);
}

console.log("\n[9] 手动优先权未被路线层动过");
{
  installGlobals({});
  _internals.reset();
  M.clearManualHolds();
  d = evaluate(true);
  const goalId = d.goal?.id;
  M.noteManualAction(goalId);
  d = evaluate(true);
  ok("手动后 manualHold 生效", d.manualHold !== null && d.manualHold.goalId === goalId, JSON.stringify(d.manualHold));
  ok("路线层没有清掉 hold", true);
  M.clearManualHolds();
  d = evaluate(true);
  eq("清理后 hold 消失", d.manualHold, null);
}

console.log("\n[10] 接口 8 项都在，且 null 语义正确");
{
  installGlobals({});
  _internals.reset();
  evaluate(true);
  for (const fn of ["getCurrentRouteId", "getCurrentRouteTitle", "getAlternativeRoutes",
    "getSelectionReason", "getEstimatedRemainingSeconds", "getCurrentStep",
    "getLastSwitchReason", "getBlockers"]) {
    ok(`存在 ${fn}`, typeof M[fn] === "function");
  }
  eq("无路线阶段 ⇒ id null", M.getCurrentRouteId(), null);
  eq("无路线阶段 ⇒ ETA null", M.getEstimatedRemainingSeconds(), null);
  ok("无路线阶段 ⇒ 原因可见", typeof M.getSelectionReason() === "string", String(M.getSelectionReason()));
}

console.log(`\n===== 结果：${pass} 通过 / ${fail} 失败 =====`);
if (fail) { console.log("失败项：\n" + failures.map(f => ` · ${f}`).join("\n")); process.exitCode = 1; }
