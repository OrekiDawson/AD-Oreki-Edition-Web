// ch10 时间膨胀
import fs from "node:fs";
const PATH = "c:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition/src/core/oreki-tutorial-data.json";
const data = JSON.parse(fs.readFileSync(PATH, "utf8"));
const c = data.chapters.find(x => x.id === "ch10");

c.title = "第 10 章　时间膨胀";
c.subtitle = "12900 TT → 本纪最高 EP 指数 4000：打开现实";
c.draft = false;
c.stageGoal = "买膨胀研究 1（5 TT）解锁时间膨胀，把时间维度 5~8 买齐，启动膨胀并攒到 1e30 膨胀时间，最后用膨胀研究 6 打开现实。判据：「永恒 / Eternity」页出现可点的「现实」按钮。";
c.entry = "已满足膨胀研究 1 的三个条件：累计时间之理 ≥ 12900、231~234 中至少一条已买、永恒挑战 11 与 12 各打满 5 次。";
c.steps = [
  {
    text: "先确认时间维度 5~8 是否买齐：TD5~TD8 不由研究直接解锁，而是由膨胀研究 2~5 逐层打开，每一层都要求上一层 TD 已经买过。缺一层就点不开下一层。",
    auto: false,
  },
  {
    text: "买膨胀研究 1（成本 5000 TT，本 MOD 在现实解锁前按 1/1000 缩放，实际 5 TT）。买到即解锁「时间膨胀」，页面上多出膨胀升级。",
    auto: true,
  },
  {
    text: "启动膨胀：进「永恒 / Eternity → 时间膨胀 / Time Dilation」，打开开关。膨胀期间所有产量按 0.75 次方被压缩，换来膨胀时间（DT）与超光速粒子（TP）。这是本阶段唯一的成长方式，不要因为产量掉了就关掉。",
    auto: false,
  },
  {
    text: "膨胀升级用 DT 买，前三个可重复：DU1 1e4 DT 起每级 ×10、DU2 1e6 起每级 ×100、DU3 1e7 起每级 ×20；其余是一次性升级，按界面上能买就买。",
    auto: false,
  },
  {
    text: "超光速粒子按 (log10(反物质)/400)^1.5 结算，所以反物质每多两个数量级，TP 只涨一点点。它主要用来解锁超光速粒子星系，不直接产 DT。",
    auto: false,
  },
  {
    text: "最后是膨胀研究 6（成本 1 TT）：它要求时间维度 8 已买、本纪最高 EP 的指数 ≥ 4000、以及全部现实前成就。「全部成就」这一条在本 MOD 里只要 EC11 与 EC12 各满 5 次就豁免，所以真正要盯的只有前两条。",
    auto: false,
  },
  {
    text: "判据：「时间研究 → 时间和膨胀」里膨胀研究 6 显示可买并已买下，且「永恒 / Eternity」页顶部出现「现实」按钮。",
    auto: false,
  },
];
c.buyOrder = [
  "膨胀研究 1：5 TT，一切的前置，最先买",
  "膨胀研究 2~5：各 1000 / 1e4 / 1e5 / 1e6 TT，按 TD5→TD8 顺序买",
  "膨胀升级 DU1~DU3：DT 够就买，它们直接放大 DT 产量",
  "膨胀研究 6：1 TT，最后买（要 EP 指数 4000）",
  "时间之理：不要为了 DS2~DS5 提前囤，EP 涨数量级时 TT 会跟着涨",
];
c.automation = "本阶段由两条自动化接力。AD10 继续买时间维度、TT 与普通时间研究；`OrekiCelestialAutomation.tickDilation()` 在膨胀研究 1 到手后**真实启动膨胀**并播种起始超光速粒子，同时在「本纪最高膨胀时间 < 1e30」之前压住现实按钮（src/core/oreki-dilation-automation.js:33-40，压现实的共用判定见同文件 hold）。膨胀升级本身有原版自动购买器（解锁后可在「自动化 / Automation」里开）。全部受 player.auto.autobuyersOn 总开关控制。";
c.challenges = null;
c.numbers = [
  { label: "膨胀研究 1 的成本", value: "5000 TT，本 MOD 现实前 ÷1000 → 5 TT", src: "src/core/secret-formula/eternity/time-studies/dilation-time-studies.js:1-19 + src/core/time-studies/dilation-time-study.js:14, :50" },
  { label: "膨胀研究 1 的三个条件", value: "累计 TT ≥ 12900、231~234 任一已买、EC11 与 EC12 各 5 次", src: "src/core/secret-formula/eternity/time-studies/dilation-time-studies.js:5-19" },
  { label: "膨胀研究 2~5 的成本（解锁 TD5~TD8）", value: "1e6 / 1e7 / 1e8 / 1e9 TT → ÷1000 = 1000 / 1e4 / 1e5 / 1e6 TT", src: "src/core/secret-formula/eternity/time-studies/dilation-time-studies.js:21-58" },
  { label: "膨胀研究 6（现实）的成本与要求", value: "1 TT；要求 TD8 已买 + 本纪最高 EP 指数 ≥ 4000（成就项在 EC11/12 满 5 次后豁免）", src: "src/core/secret-formula/eternity/time-studies/dilation-time-studies.js:59-70, :78-96" },
  { label: "超光速粒子公式", value: "(log10(反物质) / 400)^1.5 × TP 倍数", src: "src/core/dilation.js:168-181" },
  { label: "膨胀惩罚", value: "产量按 0.75 次方压缩（dilatedValueOf）", src: "src/core/dilation.js:216-220" },
  { label: "膨胀升级 DU1~DU3 的成本", value: "1e4 ×10 / 1e6 ×100 / 1e7 ×20（DT）", src: "src/core/secret-formula/eternity/dilation-upgrades.js:26-37, :75-86, :112-123" },
  { label: "自动化压现实的门槛", value: "本纪最高膨胀时间 ≥ 1e30 才放开现实", src: "src/core/oreki-dilation-automation.js:33-40" },
];
c.done = "膨胀研究 6 已买下，「永恒 / Eternity」页出现可点的「现实」按钮。";
c.next = "进第 11 章：做第一次现实，开始攒现实机器与符文。";
c.traps = [
  "膨胀一开产量会明显变慢，这是 0.75 次方惩罚，不是卡了。关掉膨胀反而拿不到 DT。",
  "膨胀研究 1 的三个条件里，最容易漏的是「231~234 任一已买」——它是 EC 研究的另一条分支，没买就永远灰。",
  "TD5~TD8 需要膨胀研究 2~5 逐个解锁，且每层都要求上一层 TD 已买。卡在 TD6 通常是 TD5 没买，不是研究没买到。",
  "本纪最高 EP 指数 4000 是硬门槛：EP 停在 1e3999 时膨胀研究 6 就是不可买，别怀疑按钮坏了。",
  "现实一开，本纪的膨胀时间会清零。自动化会在 1e30 之前压住现实，看到它迟迟不现实是正常的。",
];
c.table = {
  head: ["研究", "作用", "成本（原版 → 本 MOD ÷1000）", "前置"],
  rows: [
    ["膨胀研究 1", "解锁时间膨胀", "5000 TT → 5 TT", "12900 TT + 231~234 任一 + EC11/12 各 5 次"],
    ["膨胀研究 2", "解锁第五时间维度", "1e6 TT → 1000 TT", "膨胀研究 1"],
    ["膨胀研究 3", "解锁第六时间维度", "1e7 TT → 1e4 TT", "时间维度 5"],
    ["膨胀研究 4", "解锁第七时间维度", "1e8 TT → 1e5 TT", "时间维度 6"],
    ["膨胀研究 5", "解锁第八时间维度", "1e9 TT → 1e6 TT", "时间维度 7"],
    ["膨胀研究 6", "解锁现实", "1 TT", "时间维度 8 + EP 指数 4000"],
  ],
};
c.note = "本章 challenges 为 null：永恒挑战已在第 9 章打满，本章只有膨胀与时间维度。";

fs.writeFileSync(PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log("ch10 已写入");
