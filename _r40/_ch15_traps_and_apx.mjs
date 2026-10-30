import fs from "node:fs";

const P = "src/core/oreki-tutorial-data.json";
const data = JSON.parse(fs.readFileSync(P, "utf-8"));

// ── 1. ch15 numbers[3] 的行号修正（原 1134-1136 落在函数尾的 `};` 附近，不含判定）──
const ch15 = data.chapters.find(c => c.id === "ch15");
const tierRow = ch15.numbers.find(n => n.label.includes("难度层级"));
if (!tierRow) throw new Error("找不到「难度层级」那一行");
const beforeSrc = tierRow.src;
tierRow.src = "src/game.js:1138-1140 + src/core/celestials/laitela/laitela.js:53-55";

// ── 2. ch15 trap[3]（飞升）改写：原文写「重置间隔升级」，代码里没有 reset ──
const beforeTrap3 = ch15.traps[3];
ch15.traps[3] = "飞升不会重置暗物质维度本身，也不会清掉间隔升级的购买次数：它把基础间隔乘上 1200 的飞升次数次方，再把买得起的间隔升级一次性重买。所以间隔还没压到 10 秒下限时点飞升，等于把进度推回去一截。";

// ── 3. ch15 trap[4] 去掉「奇点卡住的最常见原因」这个没有依据的因果判断 ──
const beforeTrap4 = ch15.traps[4];
ch15.traps[4] = "难度层级只能靠「真实用时 < 30 秒完成」累积：把熵的增长速度拖慢，层级就永远停在低档，后面暗能量与奇点也就上不去。";

// ── 4. apx_changes 重写（加入速度两行，节号后移）──
const apx = data.appendices.find(a => a.id === "apx_changes");
const body = `用途：本作对原版做了十几处「尺度缩放」，另外加了一个原版没有的游戏速度开关。这张表只列**有源码依据**的改动，一条一行：**表里没有出现的机制，就是原版原值**。

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

### 二、游戏速度（本作新增的开关）

| 机制 | 原版 → 本作 | 依据（本作文件:行号） |
|---|---|---|
| 游戏速度 | 原版没有这个开关（固定 1×）→ 本作默认 10000×，可调范围 1× ~ 100000× | \`src/core/speed-config.js:32,33,44\` |
| 动态提速 | 原版没有 → 本作默认开启：进度指纹连续 4 秒没变化就把倍率 ×2，最快每 5 秒调一次，封顶 100000× | \`src/core/speed-config.js:24-26,124,196-235\` |

这个开关只放大**游戏内时间流逝的倍率**，不改变任何门槛与公式；把它调回 1× 就等于原版节奏。选项在「选项 → 游戏玩法」。

### 三、明确**没有**改的

| 机制 | 本作 = 原版 | 依据 |
|---|---|---|
| 膨胀研究 1 的累计时间之理门槛 | 12900，不缩放 | \`src/core/time-studies/dilation-time-study.js:55\` |
| 暗物质维度的全部数值 | 层数 4；间隔升级 10 起、×5、×0.92、压到 10 秒；强度升级 10 起、×10；四层起始价 1200 的 0 / 2 / 5 / 13 次方；飞升 +500 / +500 | \`src/core/celestials/laitela/dark-matter-dimension.js\`（与原版逐行相同，只有 import 后缀不同） |
| 奇点的全部数值 | 冷凝上限 200 × 10^扩容次数、扩容最多 50 次、收益 11^扩容次数 × 倍率 ×（1+虚幻升级 10） | \`src/core/celestials/laitela/singularity.js\`（与原版逐行相同，只有 import 后缀与一条提示文案不同） |
| 末日中保留自动购买器后 break 不丢 | 原版就有这条（\`reality.js\` 的佩勒分支与本作一致） | \`src/core/reality.js:750-752\` |

### 四、怎么用这张表

- 对着外部 wiki 抄数字时，先查一眼：**表里有的按本作写，表里没有的按原版写**。
- 缩放只改**门槛与价格**，不改产出公式。所以「攒到某个数再重置」这类说法要按本作的门槛看，「每秒产多少」这类说法不用换算。
- 想自己核对某一行的原文，把「依据」那一列的文件路径与行号拿去搜即可；每一行都能在源码里读到常数名与注释里写的「原版是多少」。

出处：\`src/game.js:110-116\`、\`src/core/time-studies/ec-time-study.js:10\`、\`src/core/time-studies/dilation-time-study.js:9,55\`、\`src/core/reality-upgrades.js:9\`、\`src/core/celestials/effarig.js:44,67,123,191-193,215,258\`、\`src/core/secret-formula/celestials/v.js:65-67\`、\`src/core/secret-formula/reality/imaginary-upgrades.js:21,49\`、\`src/core/machines.js:14\`、\`src/core/dimboost.js:125\`、\`src/core/celestials/laitela/laitela.js:30\`、\`src/core/celestials/pelle/game-end.js:59-60\`、\`src/core/speed-config.js:24-44,124,196-235\`、\`src/core/reality.js:750-752\`；原版对照取自 \`web/upstream/official/src/\` 同路径文件。`;

apx.body = body;

fs.writeFileSync(P, JSON.stringify(data, null, 2) + "\n", "utf-8");
console.log(`numbers[3].src: ${beforeSrc} → ${tierRow.src}`);
console.log(`trap3 原文: ${beforeTrap3}`);
console.log(`trap4 原文: ${beforeTrap4}`);
console.log(`apx_changes 正文 ${body.length} 字符`);
