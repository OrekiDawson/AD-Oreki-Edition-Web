import fs from "node:fs";

const P = "src/core/oreki-tutorial-data.json";
const data = JSON.parse(fs.readFileSync(P, "utf-8"));
if (data.appendices.some(a => a.id === "apx_changes")) {
  console.log("apx_changes 已存在，先删再写");
  data.appendices = data.appendices.filter(a => a.id !== "apx_changes");
}

const body = `用途：本作对原版做了十几处「尺度缩放」，目的都是把原本要几千小时的后期压进几个小时。这张表只列**有源码依据**的改动，一条一行：**表里没有出现的机制，就是原版原值**。

### 一、门槛与价格的缩放

| 机制 | 原版 → 本作 | 依据（本作文件:行号） |
|---|---|---|
| 首次永恒前的无限点数尺度 | 308 → 30 | \`src/game.js:112\` |
| Reality 之前的永恒点数尺度 | 308 → 30 | \`src/game.js:115\` |
| 永恒挑战的入口资源门槛（Reality 之前） | 全额 → ÷100 | \`src/core/time-studies/ec-time-study.js:10,121-122\` |
| 膨胀研究的时间之理成本（现实后重建窗口内） | 全额 → ÷1000 | \`src/core/time-studies/dilation-time-study.js:9,48-50\` |
| 一次性现实升级的价格 | 全额 → ÷1000 | \`src/core/reality-upgrades.js:9\` |
| 鹿颈长的碎片产量除数 | 7500 → 30 | \`src/core/celestials/effarig.js:191-193\` |
| 鹿颈长的解锁价格 | 全额 → ÷1e6 | \`src/core/celestials/effarig.js:258\` |
| 鹿颈长的削弱强度 | 全额 → ÷1e6 | \`src/core/celestials/effarig.js:215\` |
| 薇的三项门槛 | 10000 现实 / 1e320 膨胀时间 / 1e320000 复制器 → 60 / 1e30 / 1e20000 | \`src/core/secret-formula/celestials/v.js:65-67\` |
| 虚幻升级 15 的反物质门槛 | 指数 1.5e12 → 1e8 | \`src/core/secret-formula/reality/imaginary-upgrades.js:49\` |
| 虚幻升级 25 的成本 | 1.6e15 虚幻机器 → 5e9 虚幻机器 | \`src/core/secret-formula/reality/imaginary-upgrades.js:21\` |
| 虚幻机器的产出上限 | ×1 → ×100 | \`src/core/machines.js:14,80\` |
| 维度提升对第八维度的需求斜率 | 15 / 次 → 5 / 次 | \`src/core/dimboost.js:125\` |
| 莱特拉的熵产量分母 | 1e11 → 2e7 | \`src/core/celestials/laitela/laitela.js:30,81-83\` |
| 终局目标（佩勒） | 反物质指数 9e15 → 1e3，即反物质 1e1000 | \`src/core/celestials/pelle/game-end.js:59-60\` |

### 二、明确**没有**改的

| 机制 | 本作 = 原版 | 依据 |
|---|---|---|
| 膨胀研究 1 的累计时间之理门槛 | 12900，不缩放 | \`src/core/time-studies/dilation-time-study.js:55\` |
| 暗物质维度的全部数值 | 层数 4；间隔升级 10 起、×5、×0.92、压到 10 秒；强度升级 10 起、×10；四层起始价 1200 的 0 / 2 / 5 / 13 次方；飞升 +500 / +500 | \`src/core/celestials/laitela/dark-matter-dimension.js\`（与原版逐行相同，只有 import 后缀不同） |
| 奇点的全部数值 | 冷凝上限 200 × 10^扩容次数、扩容最多 50 次、收益 11^扩容次数 × 倍率 ×（1+虚幻升级 10） | \`src/core/celestials/laitela/singularity.js\`（与原版逐行相同，只有 import 后缀与一条提示文案不同） |
| 大坍缩、永恒、现实的产出公式 | 形状不变，只换了上面那两处指数尺度 | \`src/game.js:112,115\` |

### 三、怎么用这张表

- 对着外部 wiki 抄数字时，先查一眼：**表里有的按本作写，表里没有的按原版写**。
- 缩放只改**门槛与价格**，不改产出公式。所以「攒到某个数再重置」这类说法要按本作的门槛看，「每秒产多少」这类说法不用换算。
- 想自己核对某一行的原文，把「依据」那一列的文件路径与行号拿去搜即可；每一行都能在源码里读到常数名与注释里写的「原版是多少」。

出处：\`src/game.js:110-116\`、\`src/core/time-studies/ec-time-study.js:10\`、\`src/core/time-studies/dilation-time-study.js:9,55\`、\`src/core/reality-upgrades.js:9\`、\`src/core/celestials/effarig.js:44,67,123,191-193,215,258\`、\`src/core/secret-formula/celestials/v.js:65-67\`、\`src/core/secret-formula/reality/imaginary-upgrades.js:21,49\`、\`src/core/machines.js:14\`、\`src/core/dimboost.js:125\`、\`src/core/celestials/laitela/laitela.js:30\`、\`src/core/celestials/pelle/game-end.js:59-60\`；原版对照取自 \`web/upstream/official/src/\` 同路径文件。`;

data.appendices.push({
  id: "apx_changes",
  title: "附录 G　本 MOD 与原版的差异清单",
  body,
});

fs.writeFileSync(P, JSON.stringify(data, null, 2) + "\n", "utf-8");
console.log(`appendices = ${data.appendices.length}，apx_changes 正文 ${body.length} 字符`);
