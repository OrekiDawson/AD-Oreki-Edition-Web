// ch16 佩勒与终局
import fs from "node:fs";
const PATH = "c:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition/src/core/oreki-tutorial-data.json";
const data = JSON.parse(fs.readFileSync(PATH, "utf8"));
const c = data.chapters.find(x => x.id === "ch16");

c.title = "第 16 章　佩勒与终局";
c.subtitle = "毁灭、五个裂隙与反物质 1e1000";
c.stageKey = "doomed";
c.draft = false;

c.stageGoal = "在莱特拉的完全不稳定状态下达成现实买下 IU25，进入佩勒并「毁灭」，然后把佩勒里的反物质推到 1e1000，让 isGameEnd 变真。判据：反物质 ≥ 1e1000（即反物质指数 ≥ 1000），终局进度条 endState ≥ 1。";

c.entry = "第 15 章已解锁莱特拉并把难度层级推到 8（maxAllowedDimension = 0）；装备的符文 ≤ 1 个；时间研究「解锁现实」仍持有。";

c.steps = [
  {
    text: "IU25 的门槛不是资源而是状态：必须在莱特拉的现实里、难度层级已经到 8（所有普通维度被禁）、装备的非同伴符文 ≤ 1 个、并且这一次现实真的完成。价格 5e9 IM。",
    auto: false,
  },
  {
    text: "IU25 有个永久锁：一旦你在持有该升级条件的情况下装备第二个非同伴符文，它就锁死，只能重开一轮。全程只留一个符文最安全。",
    auto: false,
  },
  {
    text: "买下 IU25 后进「天神 / Celestials」页签的佩勒，点「毁灭」。毁灭会把大部分机制关掉并重开资源，这是设计不是故障。",
    auto: false,
  },
  {
    text: "佩勒里有五个裂隙：空洞、枯朽、混沌、轮回、悖论，每个有三级演化。裂隙会随时间填充，填满后给对应的佩勒升级。填得越快，能买的升级越多。",
    auto: false,
  },
  {
    text: "「末日」是佩勒层的重置：遗烬收益 ≥ 1 时才能按。它按遗烬收益结算一次残余，然后走一次完整的现实重置（不发奖励）。遗烬收益 = ((log10(总反物质+2) + log10(总无限点数+2) + log10(总永恒点数+2)) / 1.64)^7.5，再减去已持有的遗烬。",
    auto: false,
  },
  {
    text: "终局判据只有一个数：佩勒记录里的总反物质峰值。endState = (log10(log10(总反物质)+1) − 1) / (log10(1001) − 1)，它 ≥ 1 的那一刻 player.isGameEnd 被置真。化简后就是「反物质指数 ≥ 1000」，即反物质 ≥ 1e1000。",
    auto: false,
  },
  {
    text: "这个 1e1000 必须靠真实产量涨上去，重置刷不出来：大坍缩会把它按住。所以这一段的正确打法是先把佩勒升级与裂隙推起来，再让反物质自己往上跑。",
    auto: false,
  },
  {
    text: "判据：顶部反物质显示 1e1000 或更大，终局进度条走满，出现制作人员名单。",
    auto: false,
  },
];

c.buyOrder = [
  "IU25（5e9 IM）：条件达成后再买，别提前装备第二个符文",
  "佩勒裂隙：五个都先填到第一级，再考虑往第二、三级推",
  "佩勒升级：优先买能直接抬反物质产量与解锁维度的那些",
  "末日：遗烬收益 ≥ 1 就按，越早攒遗烬，后面越省时间",
  "终局前：把大坍缩相关的自动重置压住，别让反物质峰值被反复清零",
];

c.automation = "IU25、进入佩勒、佩勒升级与终局推进都由 `oreki-endgame-automation.js` 接管：它按原版 API 调 `ImaginaryUpgrade(25).purchase()`、`Pelle.initializeRun()`、`PelleUpgrade.all[i].purchase()`，买不起就下一帧重试，不写任何解锁位、不发货币。模块头注释明确写了「这条链在原版里全部只有 UI 调用点，自动化一概不碰」，所以没有这个模块时即使材料齐了也不会往前走。毁灭（进入佩勒）与末日（重置）仍要你自己确认，它们是不可逆操作。";

c.challenges = null;

c.numbers = [
  {
    label: "IU25 的价格",
    value: "5e9 IM（本作从原版 1.6e15 缩放）",
    src: "src/core/secret-formula/reality/imaginary-upgrades.js:354-358",
  },
  {
    label: "IU25 的达成条件",
    value: "在莱特拉的现实中、maxAllowedDimension = 0、装备的非同伴符文 ≤ 1、时间研究「解锁现实」已买，并完成这一次现实",
    src: "src/core/secret-formula/reality/imaginary-upgrades.js:359-366",
  },
  {
    label: "佩勒的解锁条件",
    value: "IU25 已买",
    src: "src/core/celestials/pelle/pelle.js:121-123",
  },
  {
    label: "佩勒的裂隙数量",
    value: "5 个：空洞 / 枯朽 / 混沌 / 轮回 / 悖论，各有三级演化",
    src: "src/core/secret-formula/celestials/rifts.js:6-190",
  },
  {
    label: "末日的触发条件",
    value: "遗烬收益 ≥ 1",
    src: "src/core/celestials/pelle/pelle.js:145-152",
  },
  {
    label: "遗烬收益公式",
    value: "((log10(总反物质+2) + log10(总无限点数+2) + log10(总永恒点数+2)) / 1.64)^7.5 − 已持有遗烬",
    src: "src/core/celestials/pelle/pelle.js:271-287",
  },
  {
    label: "终局判据",
    value: "endState = (log10(log10(总反物质)+1) − 1) / (log10(1001) − 1) ≥ 1，等价于反物质指数 ≥ 1000",
    src: "src/core/celestials/pelle/game-end.js:75-97",
  },
  {
    label: "终局目标的缩放",
    value: "反物质指数目标 = 1e3（OREKI_PELLE_END_TARGET_EXP），偏移 = 1（OREKI_PELLE_END_OFFSET）",
    src: "src/core/celestials/pelle/game-end.js:69-70",
  },
];

c.done = "IU25 已买、佩勒已毁灭、反物质 ≥ 1e1000、endState ≥ 1、player.isGameEnd 为真并出现制作人员名单。";

c.next = "通关。想继续玩可以读第 17 章与各附录，那里有隐藏条件、成就总表、记数法与术语速查。";

c.traps = [
  "IU25 会永久锁：持有条件时装备第二个非同伴符文，这条升级就锁死。进莱特拉前先把符文卸到 1 个以内。",
  "佩勒的「毁灭」不可逆（在当前存档内）。点之前先确认存档已经备份或已经接受这个后果。",
  "反物质在佩勒里会被大坍缩反复清零，而终局看的是「峰值」不是「当前值」。但峰值同样需要一个不被重置打断的窗口才能涨到 1e1000。",
  "遗烬收益是按总反物质、总无限点数、总永恒点数三个量的对数算的，缺一项都会把结果拉低一个数量级。三项都要堆。",
  "末日会走一次完整现实重置且不发奖励。它不是你「变强」的手段，是遗烬的结算手段——按之前先攒够收益。",
  "第 14 章的薇与太阳神不是通关前置。终局链是 IU15 → 莱特拉 → IU25 → 佩勒，跳过它们不影响 isGameEnd。",
];

c.table = {
  head: ["阶段", "门槛", "关键数值", "产出"],
  rows: [
    ["IU25", "莱特拉完全不稳定 + 符文 ≤ 1 + 完成现实", "5e9 IM", "解锁佩勒"],
    ["毁灭（进入佩勒）", "IU25 已买", "不可逆", "关闭大部分机制"],
    ["五个裂隙", "毁灭之后", "空洞 / 枯朽 / 混沌 / 轮回 / 悖论", "佩勒升级"],
    ["末日", "遗烬收益 ≥ 1", "按三个总量对数算的 7.5 次方", "结算遗烬"],
    ["终局", "反物质 ≥ 1e1000", "endState ≥ 1", "isGameEnd = true"],
  ],
};

c.note = "本章 challenges 为 null：佩勒没有挑战系统，裂隙与末日都是同一存档内的进度机制。";

fs.writeFileSync(PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log("ch16 已写入");
