// [Oreki R44] 阶段识别静态自测 —— 用**真实解释器**（不是重写一份语法）在伪造 player 状态下求值。
//
// 为什么要在 node 里跑：
//   · 本机浏览器是单实例独占（OREKI_CDP_PORT=9300），另一条线在用；本轮不允许开浏览器。
//   · 解释器只依赖裸全局（`player` / `PlayerProgress` / `Pelle` ... 由 src/merge-globals.js 注入
//     window），所以在 node 里把这些名字造出来就能直接 import 真实模块，
//     连带把 `assertSpecLeaves()` 的双向叶子比对、`detectStage()` 的 precedence 平票判定、
//     `evaluate()` 的 failSafe 一起测到 —— 比重写一份语法可信得多。
//
// 它证明四件事：
//   ① 20 个阶段逐个可达，且 13 个进度节点各自**有且仅有 1 个** stage 命中（不重叠、不遗漏）；
//   ② 状态空间穷举下**任意两个 stage 不会同时为真**（互斥），所以 precedence 只是防御性裁决；
//   ③ 18 个 goal 的 `done` 全部可求值，且每条都有能判成 true 的状态（不是「永远判不出」）；
//   ④ 跳序 / 手动推进 / 现实重置后仍能正确重新识别（不是固定脚本顺序）。
//
// 用法：node scripts/check_stage_detect.mjs        （退出码 0 = 全过）

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, "src/core/oreki-smart-strategy.json"), "utf8"));

// ════════════════════════════════════════════════════════════════════
// 1. 伪造全局环境
// ════════════════════════════════════════════════════════════════════

/** 只要支持 gte/gt/lt/lte/eq/toNumber 就够 —— 解释器只调这几个。 */
class FakeDecimal {
  constructor(v) { this.v = Number(v); }
  gte(o) { return this.v >= numOf(o); }
  gt(o) { return this.v > numOf(o); }
  lt(o) { return this.v < numOf(o); }
  lte(o) { return this.v <= numOf(o); }
  eq(o) { return this.v === numOf(o); }
  toNumber() { return this.v; }
}
function numOf(o) { return o instanceof FakeDecimal ? o.v : Number(o); }

/** 当前被测状态。叶子每次调用都实时读它，所以换状态 = 改 S 的字段。 */
const S = {};
const DEFAULT_STATE = {
  antimatter: 1e1,
  dimensionBoosts: 0,
  infinities: 0,
  eternities: 0,
  realities: 0,
  breakUnlocked: false,
  normalRunning: false,
  infinityRunning: false,
  eternityRunning: false,
  normalCompleted: 0,
  infinityCompleted: 0,
  eternityCompletions: 0,
  studies: 0,
  dilationUnlocked: false,
  upgradesBought: 0,
  perks: 0,
  perkPoints: 0,
  activeGlyphs: 0,
  automatorUnlocked: false,
  teresa: false,
  effarig: false,
  enslaved: false,
  v: false,
  ra: false,
  laitela: false,
  pelleUnlocked: false,
  doomed: false,
  canArmageddon: false,
  keepAutobuyers: false,
  maxedInterval: false,
  shards: 0,
  endState: 0,
  achievements: new Set(),
  infinityGoal: 1.7976931348623157e308,
  eternityGoal: 1e16,
};

function setState(patch) {
  for (const k of Object.keys(DEFAULT_STATE)) S[k] = DEFAULT_STATE[k];
  S.achievements = new Set();
  Object.assign(S, patch);
  if (S.teresa) S.achievements.add(147);
  if (S.v) S.achievements.add(151);
}

// 原版符号 → 读 S 的 facade。
globalThis.player = {
  get antimatter() { return S.antimatter; },
  get dimensionBoosts() { return S.dimensionBoosts; },
  get infinitied() { return S.infinities; },
  get infinities() { return S.infinities; },
  get eternities() { return S.eternities; },
  get realities() { return S.realities; },
  get break() { return S.breakUnlocked; },
  get timestudy() { return { studies: Array(S.studies).fill(1) }; },
  get reality() {
    return {
      perks: new Set(Array(S.perks).fill(0).map((_, i) => i)),
      perkPoints: S.perkPoints,
      glyphs: { active: Array(S.activeGlyphs).fill(0).map(() => ({ level: 1 })) },
      upgradeBits: 0,
    };
  },
};
globalThis.Decimal = FakeDecimal;

globalThis.PlayerProgress = {
  infinityUnlocked: () => S.infinities > 0 || S.eternities > 0 || S.realities > 0,
  eternityUnlocked: () => S.eternities > 0 || S.realities > 0,
  realityUnlocked: () => S.realities > 0,
  dilationUnlocked: () => S.dilationUnlocked,
};

globalThis.Player = {
  get infinityGoal() { return S.infinityGoal; },
  get eternityGoal() { return S.eternityGoal; },
  get automatorUnlocked() { return S.automatorUnlocked; },
};

globalThis.Currency = {
  infinityPoints: { get value() { return new FakeDecimal(1e1); } },
  eternityPoints: { get value() { return new FakeDecimal(1e2); } },
  timeTheorems: { get value() { return new FakeDecimal(1e3); } },
  realityMachines: { get value() { return new FakeDecimal(1e4); } },
  realityShards: { get value() { return S.shards; } },
  perkPoints: { get value() { return S.perkPoints; } },
};

const runningChallenge = () => (S.normalRunning ? { id: 1 } : S.infinityRunning ? { id: 8 } : S.eternityRunning ? { id: 5 } : null);

globalThis.NormalChallenge = { get isRunning() { return S.normalRunning; } };
globalThis.InfinityChallenge = { get isRunning() { return S.infinityRunning; } };
globalThis.EternityChallenge = { get isRunning() { return S.eternityRunning; } };
void runningChallenge;

globalThis.NormalChallenges = {
  all: Array.from({ length: 12 }, (_, i) => ({ id: i + 1, get isCompleted() { return i < S.normalCompleted; } })),
};
globalThis.InfinityChallenges = {
  all: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, get isCompleted() { return i < S.infinityCompleted; } })),
};
globalThis.EternityChallenges = { get completions() { return S.eternityCompletions; } };

// 一次性现实升级是 id 6..25 共 20 个（rebuyable 是 1..5，没有 isUnlocked）
globalThis.RealityUpgrades = {
  all: Array.from({ length: 25 }, (_, i) => {
    const id = i + 1;
    return { id, get isUnlocked() { return id >= 6 && id - 5 <= S.upgradesBought; } };
  }),
};

globalThis.Achievement = id => ({ get isUnlocked() { return S.achievements.has(id); } });
globalThis.Teresa = { get isUnlocked() { return S.teresa; } };
globalThis.TeresaUnlocks = { effarig: { get isUnlocked() { return S.effarig; } } };
globalThis.EffarigUnlock = { eternity: { get isUnlocked() { return S.enslaved; } } };
globalThis.VUnlocks = { raUnlock: { get isUnlocked() { return S.ra; } } };
globalThis.Laitela = { get isUnlocked() { return S.laitela; } };
globalThis.Pelle = {
  get isUnlocked() { return S.pelleUnlocked; },
  get isDoomed() { return S.doomed; },
  get canArmageddon() { return S.canArmageddon; },
};
globalThis.PelleUpgrade = { keepAutobuyers: { get isBought() { return S.keepAutobuyers; } } };
globalThis.Autobuyer = { bigCrunch: { get hasMaxedInterval() { return S.maxedInterval; } } };
globalThis.GameEnd = { get endState() { return S.endState; } };
globalThis.TimeStudy = {
  reality: { get cost() { return 1e9; } },
  dilation: { get isBought() { return S.dilationUnlocked; } },
};

// ════════════════════════════════════════════════════════════════════
// 2. import 真实解释器（依赖上面的全局，所以必须放在后面）
// ════════════════════════════════════════════════════════════════════
const { evaluate, evaluateCondition } = await import(
  new URL("../src/core/oreki-smart-strategy.js", import.meta.url)
);

const stages = SPEC.stages;
const goals = SPEC.goals;
let failures = 0;
const fail = msg => { failures++; console.error(`  ✗ ${msg}`); };
const ok = msg => console.log(`  ✓ ${msg}`);

/** 当前状态下所有命中的 stage（用真实 evaluateCondition + 真实 LEAVES）。 */
function hitsNow() {
  const hits = [];
  for (const stage of stages) {
    let v;
    try { v = evaluateCondition(stage.detect); } catch (e) { v = `ERR:${e.message}`; }
    if (v === true) hits.push(stage.id);
    else if (typeof v === "string") hits.push(v);
  }
  return hits;
}

// ════════════════════════════════════════════════════════════════════
// 3. 13 个进度节点 → 期望阶段（每个阶段恰好一个夹具，保证 20 个阶段全覆盖）
// ════════════════════════════════════════════════════════════════════
const FIXTURES = [
  // ① 开局与普通维度
  { node: 1, label: "开局：0 维度提升", state: {}, expect: "early" },
  // ② 第一次无限
  { node: 2, label: "攒第一无限：3 次维度提升", state: { dimensionBoosts: 3 }, expect: "preInfinity" },
  // ③ 打破无限（未 break）
  { node: 3, label: "已无限、未打破", state: { infinities: 3, dimensionBoosts: 5 }, expect: "breakInfinity" },
  // ④ 无限维度与无限挑战（两个夹具：挑战中 / 不在挑战）
  { node: 4, label: "已 break、正在跑 IC", state: { infinities: 40, breakUnlocked: true, infinityRunning: true }, expect: "challenges" },
  { node: 4, label: "已 break、无挑战（刷 ID）", state: { infinities: 40, breakUnlocked: true }, expect: "infinityDimensions" },
  // ⑤ 第一次永恒（一棵研究都没买）
  { node: 5, label: "刚进永恒、0 研究", state: { infinities: 60, breakUnlocked: true, eternities: 1 }, expect: "eternity" },
  // ⑥ 时间维度与时间研究
  { node: 6, label: "已在研究树上（12 棵）", state: { breakUnlocked: true, eternities: 20, studies: 12 }, expect: "timeStudy" },
  // ⑦ 永恒挑战
  { node: 7, label: "正在跑 EC5", state: { breakUnlocked: true, eternities: 20, studies: 12, eternityRunning: true }, expect: "eternityChallenges" },
  // ⑧ 时间膨胀
  { node: 8, label: "膨胀研究 1 已买", state: { breakUnlocked: true, eternities: 60, studies: 30, dilationUnlocked: true }, expect: "dilation" },
  // ⑨ 第一次现实
  { node: 9, label: "第 1 次现实后", state: { breakUnlocked: true, eternities: 60, realities: 1, dilationUnlocked: true, activeGlyphs: 1 }, expect: "reality" },
  // ⑩ 符文 / 现实升级 / 复兴树（两个夹具）
  {
    node: 10, label: "第 5 次现实、20 个一次性 RU 已买齐、自动机未解锁",
    state: { breakUnlocked: true, realities: 5, dilationUnlocked: true, activeGlyphs: 2, upgradesBought: 20, perks: 4, perkPoints: 2 },
    expect: "glyphs",
  },
  {
    node: 10, label: "自动机已解锁（复兴树段）",
    state: { breakUnlocked: true, realities: 12, dilationUnlocked: true, activeGlyphs: 2, upgradesBought: 18, perks: 12, perkPoints: 3, automatorUnlocked: true },
    expect: "realityTree",
  },
  // ⑪ 天神系列（五段）
  { node: 11, label: "特蕾莎已解锁、鹿颈长未解锁", state: { breakUnlocked: true, realities: 20, teresa: true }, expect: "celestialsTeresa" },
  { node: 11, label: "鹿颈长已解锁、无名氏未解锁", state: { breakUnlocked: true, realities: 20, teresa: true, effarig: true }, expect: "celestialsEffarig" },
  { node: 11, label: "无名氏已解锁、薇未解锁", state: { breakUnlocked: true, realities: 25, teresa: true, effarig: true, enslaved: true }, expect: "celestialsEnslaved" },
  { node: 11, label: "薇已解锁、太阳神未解锁", state: { breakUnlocked: true, realities: 30, teresa: true, effarig: true, enslaved: true, v: true }, expect: "celestialsV" },
  { node: 11, label: "太阳神已解锁、莱特拉未解锁", state: { breakUnlocked: true, realities: 35, teresa: true, effarig: true, enslaved: true, v: true, ra: true }, expect: "celestialsRa" },
  // ⑫ 莱特拉
  { node: 12, label: "莱特拉已解锁、佩勒未解锁", state: { breakUnlocked: true, realities: 60, teresa: true, effarig: true, enslaved: true, v: true, ra: true, laitela: true }, expect: "laitela" },
  // ⑬ 佩勒（未毁灭 / 已毁灭）
  { node: 13, label: "佩勒页签已开、未毁灭", state: { breakUnlocked: true, realities: 80, teresa: true, effarig: true, enslaved: true, v: true, ra: true, laitela: true, pelleUnlocked: true }, expect: "pelle" },
  {
    node: 13, label: "已进入毁灭现实（endState 1.05）",
    state: { breakUnlocked: true, realities: 90, teresa: true, effarig: true, enslaved: true, v: true, ra: true, laitela: true, pelleUnlocked: true, doomed: true, endState: 1.05, shards: 6e6, keepAutobuyers: true, maxedInterval: true },
    expect: "doomed",
  },
];

console.log(`\n[1] 13 个进度节点 → 阶段命中（${FIXTURES.length} 个夹具）`);
const coveredStages = new Set();
for (const f of FIXTURES) {
  setState(f.state);
  const hits = hitsNow();
  const tag = `节点${String(f.node).padStart(2)} ${f.label}`;
  if (hits.length === 1 && hits[0] === f.expect) {
    coveredStages.add(hits[0]);
    const d = evaluate(true);
    if (d.ok !== true || d.degraded === true) fail(`${tag}：evaluate 降级 ${d.error ?? ""}`);
  } else {
    fail(`${tag}：期望 [${f.expect}]，实际 [${hits.join(", ")}]`);
  }
}
if (failures === 0) ok(`全部 ${FIXTURES.length} 个夹具各命中且仅命中 1 个 stage`);
if (coveredStages.size !== stages.length) {
  fail(`stage 覆盖不全：${stages.map(s => s.id).filter(id => !coveredStages.has(id)).join(", ")} 从未被命中`);
} else {
  ok(`${stages.length} 个 stage 全部可达（无死段）`);
}

// 节点编号覆盖检查：13 个节点号必须全部出现
const nodeSet = new Set(FIXTURES.map(f => f.node));
const missingNodes = Array.from({ length: 13 }, (_, i) => i + 1).filter(n => !nodeSet.has(n));
if (missingNodes.length) fail(`用户列的进度节点缺覆盖：${missingNodes.join(", ")}`);
else ok("用户列的 13 个进度节点全部有夹具");

// 每个 stage 的 coversNodes 与夹具节点号必须一致（spec 自述和实测对得上）
for (const stage of stages) {
  const f = FIXTURES.find(x => x.expect === stage.id);
  const declared = stage.coversNodes ?? [];
  if (!declared.includes(f.node)) {
    fail(`stage ${stage.id} 的 coversNodes=${JSON.stringify(declared)} 与夹具节点 ${f.node} 不一致`);
  }
}

// ════════════════════════════════════════════════════════════════════
// 4. 互斥性：穷举结构布尔量的全部组合
//    「互斥」的判定口径：**只在可达存档上要求互斥**。
//    不可达组合（例如 teresa=true 但 realities=0 —— 成就 147 要求买齐现实升级，
//    没有现实就不可能有它）由 spec.conventions.stagePrecedence 兜底（取 precedence 最大者），
//    这类组合只统计、不判失败，但要打印出来，免得以为 0 是白来的。
// ════════════════════════════════════════════════════════════════════
console.log("\n[2] 可达状态下两个 stage 不同时为真（互斥）");
const BOOLS = [
  "breakUnlocked", "dilationUnlocked", "normalRunning", "infinityRunning", "eternityRunning",
  "automatorUnlocked", "teresa", "effarig", "enslaved", "v", "ra", "laitela", "pelleUnlocked", "doomed",
];
/** 存档可达性：把「必须有前置」的位串成链。任何一条不满足就是不可达（损坏/导入的存档）。 */
function reachable(st) {
  if (st.teresa && st.real < 1) return false;
  if (st.effarig && !st.teresa) return false;
  if (st.enslaved && !st.effarig) return false;
  if (st.v && !st.enslaved) return false;
  if (st.ra && !st.v) return false;
  if (st.laitela && !st.ra) return false;
  if (st.pelleUnlocked && !st.laitela) return false;
  if (st.doomed && !st.pelleUnlocked) return false;
  if (st.studies > 0 && st.eter < 1 && st.real < 1) return false;
  if (st.dilationUnlocked && st.eter < 1 && st.real < 1) return false;
  if (st.breakUnlocked && st.inf < 1 && st.eter < 1 && st.real < 1) return false;
  if (st.automatorUnlocked && st.real < 1) return false;
  return true;
}

let reachableCount = 0;
let corruptOverlapCount = 0;
const overlaps = new Map();
const kbools = BOOLS.length;
for (let mask = 0; mask < Math.pow(2, kbools); mask++) {
  const st = {};
  for (let i = 0; i < kbools; i++) st[BOOLS[i]] = Boolean(mask & (1 << i));
  for (const inf of [0, 1]) for (const eter of [0, 1]) for (const real of [0, 1, 2]) for (const studies of [0, 1]) {
    const full = { ...st, inf, eter, real, studies };
    setState({
      ...st,
      infinities: inf,
      eternities: eter,
      realities: real,
      studies,
    });
    const hits = hitsNow().filter(h => !h.startsWith("ERR:"));
    if (reachable(full)) {
      reachableCount++;
      if (hits.length > 1) {
        const key = hits.join("+");
        if (!overlaps.has(key)) overlaps.set(key, full);
      }
    } else if (hits.length > 1) {
      corruptOverlapCount++;
    }
  }
}
if (overlaps.size) {
  fail(`可达状态下发现 ${overlaps.size} 组 stage 同时为真（应先修互斥，而不是靠 precedence）：`);
  for (const [k, v] of overlaps) console.error(`     ${k}  ← ${JSON.stringify(v)}`);
} else {
  ok(`${reachableCount} 个可达状态穷举：无任何一组 stage 重叠`);
}
console.log(`  · 参考：不可达（损坏存档）组合里有 ${corruptOverlapCount} 个同时命中多段，由 precedence 裁决，不计失败`);

// ════════════════════════════════════════════════════════════════════
// 5. goals：全部可求值，且每条都能判成 true
// ════════════════════════════════════════════════════════════════════
console.log("\n[3] goals[].done 可求值 + 可达");
const goalTrue = new Map();
let goalErrors = 0;
for (const f of FIXTURES) {
  setState(f.state);
  for (const g of goals) {
    let v;
    try { v = evaluateCondition(g.done); } catch (e) { goalErrors++; fail(`goal ${g.id} 求值抛错：${e.message}`); continue; }
    if (v === true) goalTrue.set(g.id, f.label);
  }
}
for (const g of goals) {
  if (typeof g.done !== "object" || g.done === null) { goalErrors++; fail(`goal ${g.id} 的 done 不是结构化条件`); }
  else if (!goalTrue.has(g.id)) fail(`goal ${g.id} 在任何夹具下都判不成 true（可能是死条件）`);
}
if (goalErrors === 0 && goalTrue.size === goals.length) {
  ok(`${goals.length} 条 goal 全部可求值、且都有判成 true 的状态`);
}

// ════════════════════════════════════════════════════════════════════
// 6. 跳序 / 手动推进 / 重置后重新识别
// ════════════════════════════════════════════════════════════════════
console.log("\n[4] 跳序与手动推进后的重新识别");
const REPLAN = [
  {
    label: "跳过鹿颈长直接有薇（玩家提前完成）：应识别为最远的那一段",
    state: { breakUnlocked: true, realities: 30, teresa: true, effarig: true, enslaved: true, v: true },
    expect: "celestialsV",
  },
  {
    label: "现实重置后 break/永恒计数归零（毁灭前）：不应退回无限期阶段",
    state: { breakUnlocked: false, eternities: 0, realities: 24, teresa: true, effarig: true },
    expect: "celestialsEffarig",
  },
  {
    label: "天神期里跑 EC（现实之后 EC 仍可跑）：阶段仍是天神，不是 EC",
    state: { breakUnlocked: false, eternities: 0, realities: 7, teresa: true, eternityRunning: true },
    expect: "celestialsTeresa",
  },
  {
    label: "已毁灭但特蕾莎未解锁（异常存档）：doomed 最高优先",
    state: { realities: 3, doomed: true, pelleUnlocked: true },
    expect: "doomed",
  },
  {
    label: "多个天神位一次性全开（读档/作弊存档）：取最远的那个",
    state: { breakUnlocked: true, realities: 70, teresa: true, effarig: true, enslaved: true, v: true, ra: true, laitela: true },
    expect: "laitela",
  },
];
for (const r of REPLAN) {
  setState(r.state);
  const hits = hitsNow();
  const d = evaluate(true);
  if (hits.length === 1 && hits[0] === r.expect && d.stage?.id === r.expect) ok(r.label);
  else fail(`${r.label}：期望 [${r.expect}]，detect 命中 [${hits.join(", ")}]，evaluate 给出 [${d.stage?.id}]`);
}

// ════════════════════════════════════════════════════════════════════
// 7. 决策对象四字段齐全（抽一个状态贴真实输出）
// ════════════════════════════════════════════════════════════════════
console.log("\n[5] evaluate() 决策对象");
setState(FIXTURES.find(f => f.expect === "doomed").state);
const sample = evaluate(true);
for (const key of ["stage", "goal", "strategy", "blockers"]) {
  if (sample[key] === undefined || sample[key] === null) fail(`决策对象缺字段 ${key}`);
}
if (sample.degraded === true) fail(`决策降级：${sample.error}`);
if (failures === 0) {
  ok("stage / goal / strategy / blockers 四字段齐全，未降级");
  console.log("\n  真实输出（已毁灭状态）：");
  console.log(JSON.stringify({
    ok: sample.ok,
    stage: sample.stage,
    goal: sample.goal,
    strategy: { id: sample.strategy.id, title: sample.strategy.title, priority: sample.strategy.priority },
    blockers: sample.blockers.map(b => b.id),
    route: { current: sample.route?.current, confidence: sample.route?.confidence, reason: sample.route?.reason },
    degraded: sample.degraded,
  }, null, 2).replace(/^/gm, "  "));
}

// ════════════════════════════════════════════════════════════════════
// 8. 叶子登记双向比对（不依赖 evaluate 的 failSafe，直接对源码做）
// ════════════════════════════════════════════════════════════════════
console.log("\n[6] 叶子登记一致性");
const src = fs.readFileSync(path.join(ROOT, "src/core/oreki-smart-strategy.js"), "utf8");
const leavesBlock = src.slice(src.indexOf("const LEAVES = {"), src.indexOf("/** 比较算子"));
const implemented = new Set([...leavesBlock.matchAll(/^\s{2}"([a-zA-Z.]+)"\s*:/gm)].map(m => m[1]));
const declared = new Set(SPEC.conditionGrammar.leaves);
const missing = [...declared].filter(x => !implemented.has(x));
const extra = [...implemented].filter(x => !declared.has(x));
if (missing.length || extra.length) fail(`叶子不一致 missing=[${missing}] extra=[${extra}]`);
else ok(`JSON 与 LEAVES 表逐字一致（${declared.size} 个）`);

// 解释器不许出现 purchase（只读契约）
const purchaseHits = (src.match(/purchase/g) ?? []).length;
if (purchaseHits !== 0) fail(`解释器出现 purchase ${purchaseHits} 次，违反只读契约`);
else ok("解释器全文 0 处 purchase");

// ════════════════════════════════════════════════════════════════════
console.log(failures === 0 ? "\n全部通过\n" : `\n失败 ${failures} 项\n`);
process.exit(failures === 0 ? 0 : 1);
