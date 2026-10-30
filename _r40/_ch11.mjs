// ch11 现实与符文
import fs from "node:fs";
const PATH = "c:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition/src/core/oreki-tutorial-data.json";
const data = JSON.parse(fs.readFileSync(PATH, "utf8"));
const c = data.chapters.find(x => x.id === "ch11");

c.title = "第 11 章　现实与符文";
c.subtitle = "1 RM 起：第一次现实、三个符文槽与五条符文形态升级";
c.stageKey = "reality";
c.draft = false;

c.stageGoal = "完成第一次现实拿到现实机器（RM），并把现实升级 RU9、RU24、RU16、RU17、RU18 这五条「符文形态」升级全部买下。判据：现实次数 ≥ 1、RM > 0、符文槽数量达到 5 个（3 个基础 + RU9 + RU24 各 1 个）。";

c.entry = "第 10 章已买下膨胀研究 6「解锁现实」（1 TT）；时间维度 8 已买；本纪最高永恒点数（EP）指数 ≥ 4000。";

c.steps = [
  {
    text: "先确认「现实」按钮亮起。它真正判断的只有两条：本纪最高 EP 指数 ≥ 4000、膨胀研究 6 已买（src/core/reality.js:119-121）。膨胀研究 6 自己还要求时间维度 8，那是第 10 章已经买过的。",
    auto: false,
  },
  {
    text: "第一次现实由程序替你按下：现实次数为 0 时走 processManualReality(false)，和手动点击是同一条带奖励的结算路径，会在这一帧锁存随机种子、发起始符文与同伴符文。",
    auto: true,
  },
  {
    text: "之后每 8 秒自动现实一次（现实升级还没买齐的阶段），买齐后放慢到 15 秒——因为现实会清空永恒挑战完成记录、时间研究与膨胀研究，节奏太快会把「现实 → 重打 EC → 再现实」打成互相清零。",
    auto: true,
  },
  {
    text: "看 RM 够不够：RM = 3^(log10(EP)/4000 − 1)。EP 刚好 1e4000 时是 1 RM，1e5333 才 10 RM；EP 指数在 4000~5333 之间时公式换成线性 27/4000 × 指数 − 26，所以第一次现实通常只拿到个位数 RM。",
    auto: false,
  },
  {
    text: "打开「现实 / Reality」页签，符文槽默认只有 3 个。五种基础符文是力量、无限、复制、时间、膨胀，分别强化反物质维度、无限维度、复制器、时间维度与膨胀时间。",
    auto: false,
  },
  {
    text: "符文形态不要手动折腾：自动机会按 9 → 24 → 16 → 17 → 18 的顺序自动装卸符文去满足条件。RU9 要「恰好 1 个等级 ≥3 的符文」、RU24 要「0 个符文且本次现实可得 RM ≥ 5000」、RU16/17/18 各要「恰好 4 个特定形态的符文」。",
    auto: true,
  },
  {
    text: "自己要做的只有一件：RM 一到手就点现实升级。RU1 时间放大器、RU2 复制放大器各 1 RM 起，RU3 永恒放大器、RU4 超光速放大器各 2 RM 起，每买一次价格 ×30；RU5 无界放大器 3 RM 起、每级 ×50。",
    auto: false,
  },
  {
    text: "判据：顶部现实次数 ≥ 1、RM > 0，且「现实」页签里的符文槽从 3 个变成 5 个。看到 EC 完成记录归零是现实重置的正常结果，不是存档坏了。",
    auto: false,
  },
];

c.buyOrder = [
  "RU1 时间放大器（1 RM 起，每级 ×30）：直接放大膨胀时间获取",
  "RU2 复制放大器（1 RM 起，每级 ×30）：直接放大复制器获取",
  "RU3 永恒放大器（2 RM 起）：永恒次数 ×3 起，加快 EP 段位爬升",
  "RU4 超光速放大器（2 RM 起）：超光速粒子 ×3 起，为膨胀时间打底",
  "RU9 词域扩张（15 RM）：符文形态满足后 +1 符文槽，是五条形态升级的第一条",
  "RU24 合成之象（100000 RM）：+1 符文槽，但要「0 个符文 + 可得 RM ≥ 5000」才解锁",
  "RU16/RU17/RU18（各 1500 RM）：都要「恰好 4 个」特定形态的符文，槽位够了再谈",
  "RU25 轻松现实（100000 RM，最佳 EP 指数 ≥ 11111）：本阶段不用想",
];

c.automation = "现实按钮由 `oreki-reality-automation.js` 接管：现实次数为 0 时调 processManualReality(false)，之后调 autoReality()，两条都走原版的带奖励结算（src/core/oreki-reality-automation.js:156-160）。它只在 isRealityAvailable() 为真时动手，不伪造 EP、不伪造时间研究；符文选择弹窗打开时暂停（:53），毁灭现实（佩勒）与天神现实中另有规则。符文由同一模块每 30 帧装卸一次去满足 RU9/24/16/17/18 的「符文形态」要求（:424-440），五条全部拿到之后才回到「装评分最高的符文」的常规策略（:443-452）。现实升级本身也是自动买的（:220-233），但自动购买只买「已解锁且买得起」的那些，不会替你解锁；全部受「自动购买器总开关」控制。";

c.challenges = null;

c.numbers = [
  {
    label: "现实解锁条件",
    value: "时间维度 8 已买 + 本纪最高 EP 指数 ≥ 4000 + 膨胀研究 6（1 TT，成就项可用豁免）",
    src: "src/core/secret-formula/eternity/time-studies/dilation-time-studies.js:45-55 + src/core/reality.js:119-121",
  },
  {
    label: "现实按钮的实时判据",
    value: "maxEP.exponent ≥ 4000 且 TimeStudy.reality.isBought（两条，不含成就）",
    src: "src/core/reality.js:119-121",
  },
  {
    label: "现实机器公式",
    value: "RM = 3^(log10(EP)/4000 − 1)，EP 指数 4000 时 1 RM、5333 时 10 RM",
    src: "src/core/machines.js:26-41",
  },
  {
    label: "低 RM 段的线性替换",
    value: "1 ≤ RM < 10 时改用 27/4000 × log10(EP) − 26，再向下取整",
    src: "src/core/machines.js:33-41",
  },
  {
    label: "首次现实前的 EP 折减",
    value: "log10(EP) 超过 8000 按 8000 封顶；超过 6000 的部分只按 25% 计入",
    src: "src/core/machines.js:29-33",
  },
  {
    label: "符文槽数量",
    value: "3 + RU9 + RU24，即五条形态升级拿满后是 5 个",
    src: "src/core/glyphs/glyph-core.js:66-72",
  },
  {
    label: "基础符文类型",
    value: "力量 / 无限 / 复制 / 时间 / 膨胀（5 种；鹿颈长、现实、诅咒、同伴不属于基础类型）",
    src: "src/core/constants.js:324-330 + src/core/constants.js:517-526",
  },
  {
    label: "现实升级价格",
    value: "RU1/RU2 = 1 RM 起、RU3/RU4 = 2 RM 起、RU5 = 3 RM 起（×30/×50）；RU6~RU10 = 15 RM；RU11~RU15 = 50 RM；RU16~RU20 = 1500 RM；RU21~RU25 = 100000 RM",
    src: "src/core/secret-formula/reality/reality-upgrades.js:29-65 + src/core/secret-formula/reality/reality-upgrades.js:100-190 + src/core/secret-formula/reality/reality-upgrades.js:239-390",
  },
  {
    label: "RU9 词域扩张的形态要求",
    value: "恰好装备 1 个等级 ≥3 的符文，并在一次永恒后 EP 指数 ≥ 4000；装第二个符文或装 <3 级的单符文会永久锁死",
    src: "src/core/secret-formula/reality/reality-upgrades.js:123-140",
  },
  {
    label: "RU24 合成之象的形态要求",
    value: "装备 0 个非同伴符文，且本次现实可得 RM ≥ 5000；只要在某次现实结算时装着符文就永久锁死",
    src: "src/core/secret-formula/reality/reality-upgrades.js:373-385",
  },
  {
    label: "RU25 轻松现实的门槛",
    value: "100000 RM；最佳 EP 指数 ≥ 11111",
    src: "src/core/secret-formula/reality/reality-upgrades.js:387-397",
  },
  {
    label: "自动现实的节奏",
    value: "首次立即；之后现实升级未买齐 8 s 一次，买齐 15 s 一次；最短间隔 2000 ms",
    src: "src/core/oreki-reality-automation.js:33-36, :156-160",
  },
];

c.done = "现实次数 ≥ 1、RM > 0，符文槽从 3 个扩到 5 个（RU9 与 RU24 都已买到），RU1~RU4 至少各买一级。";

c.next = "进第 12 章：用复兴树点数、自动机与黑洞把「现实 → 攒 RM → 再现实」压到秒级循环。";

c.traps = [
  "别手动往第 2、第 3 个空槽里塞符文：RU9 的失败判据是「装了 2 个以上符文」，一旦在你买下 RU9 之前装第二个，这个 +1 符文槽就永久没了。要装也只装一个等级 ≥3 的。",
  "同理，RU24 要求「某次现实结算时 0 个符文」。自动机会在 RU9 之后主动卸空，你手动装回去就会把它锁死。想手动玩就先别碰符文。",
  "RU6 宇宙重影（15 RM）要求「未使用复制器星系完成第一次永恒」，RU7 无尽造物要求「至多 1 个反物质星系完成第一次无限」。这两条都是 canLock，拿到对应的星系就永久锁死，不是暂时不可用。",
  "现实会清空永恒挑战完成记录、时间研究与膨胀研究（保留 TT 之外的一切）。所以现实之后要重打 EC1~EC12，这是设计。",
  "符文替换槽位在原版里会触发一次完整的、不发奖励的现实重置（glyph-core.js:759）。自动机因此只往空槽装、绝不替换；你自己也别在满槽时点替换。",
  "第一次现实之前 EP 指数超过 6000 的部分只按 25% 折算，硬堆到 1e9000 再现实并不会多给 RM。",
];

c.table = {
  head: ["现实升级", "价格", "作用", "解锁形态"],
  rows: [
    ["RU1 时间放大器", "1 RM 起，每级 ×30", "膨胀时间获取速度 ×3 起", "直接可买"],
    ["RU2 复制放大器", "1 RM 起，每级 ×30", "复制器获取速度 ×3 起", "直接可买"],
    ["RU3 永恒放大器", "2 RM 起，每级 ×30", "永恒次数 ×3 起", "直接可买"],
    ["RU4 超光速放大器", "2 RM 起，每级 ×30", "超光速粒子 ×3 起", "直接可买"],
    ["RU5 无界放大器", "3 RM 起，每级 ×50", "无限次数 ×5 起", "直接可买"],
    ["RU6 宇宙重影", "15 RM", "按复制器星系数量加速复制器", "未用复制器星系完成第一次永恒"],
    ["RU9 词域扩张", "15 RM", "+1 符文槽", "恰好 1 个等级 ≥3 的符文"],
    ["RU10 生存延续", "15 RM", "每次现实开局给 100 次永恒", "手动永恒时 IP 指数 ≥ 400"],
    ["RU16~RU18", "各 1500 RM", "符文相关的高阶加成", "恰好 4 个特定形态的符文"],
    ["RU24 合成之象", "100000 RM", "+1 符文槽", "0 个符文 + 可得 RM ≥ 5000"],
    ["RU25 轻松现实", "100000 RM", "解锁自动现实", "最佳 EP 指数 ≥ 11111"],
  ],
};

c.note = "本章 challenges 为 null：现实层没有独立挑战条目，它的挑战就是第 9 章的 EC1~EC12（现实后需要重打），已在第 9 章说明，这里不重复。";

fs.writeFileSync(PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log("ch11 已写入");
