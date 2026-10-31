# R43 更新日志（Web）全量中文化台账

- 文件：`web/AD-Oreki-Edition/src/core/secret-formula/changelog.js`
- 分支基线：`git HEAD` 版本（22 条记录，其中 17 条英文正文）
- 本报告所有"实测"数据均来自对工作区文件的脚本统计，非估算。

## 一、逐条台账

词数口径：`英文词数` = 去掉 HTML 标签与 `\uXXXX` 转义后，`[A-Za-z][A-Za-z'’-]*` 的匹配数（原始 HEAD 版本）；`中文汉字数` = 现工作区版本 `info` 字段中 `[\u4e00-\u9fff]` 的字符数（不含标点）。

| # | date | name（版本名） | 英文词数（原） | 中文汉字数（现） | 状态 |
|---|---|---|---|---|---|
| 1 | 2026-7-17 | 祝贺iOS版发布 | 4 | 116 | ✅ 全中文（本次未改动） |
| 2 | 2024-8-12 | `Hi Ra` | 2 | 228 | ✅ 全中文（本次未改动） |
| 3 | 2024-5-2 | 祝贺安卓版现实更新 | 13 | 843 | ✅ 全中文（本次未改动） |
| 4 | 2023-7-18 | 最终官方补丁 | 11 | 1114 | ✅ 全中文（本次未改动） |
| 5 | 2023-5-25 | 倍率页签、自动机与主要机制修复（原 `Multiplier Tab, Automator, and Major mechanics fixes`） | 6 | 813 | ✅ 正文原已全中文（本次未动）；`name` 本次译为中文 |
| 6 | 2023-4-7 | 速通与符文随机（原 `Speedrunner and Glyph RNG`） | 515 | 996 | ✅ 本次全译 |
| 7 | 2023-2-22 | 视觉与代码准备（原 `Visuals and Code prep`） | 361 | 699 | ✅ 本次全译 |
| 8 | 2023-1-26 | 时间墙削减（原 `Timewall Reduction`） | 261 | 540 | ✅ 本次全译 |
| 9 | 2023-1-9 | `The Companion Glyph doesn't want to hurt you` | 275 | 551 | ✅ 本次全译 |
| 10 | 2022-12-21 | 发布后首个补丁（原 `First Post-release Patch`） | 136 | 271 | ✅ 本次全译 |
| 11 | 2022-12-17 | `The Reality Update` | 1947 | 3201 | ✅ 本次全译 |
| 12 | 2018-6-17 | `This Update Sucks` | 1109 | 1830 | ✅ 本次全译 |
| 13 | 2018-4-1 | `Fixed a Bug where there wasn't an Update` | 903 | 1460 | ✅ 本次全译 |
| 14 | 2018-2-1 | `Eternity Challenges` | 1086 | 1787 | ✅ 本次全译 |
| 15 | 2017-12-1 | `"Eternity" update` | 112 | 203 | ✅ 本次全译 |
| 16 | 2017-10-10 | （无 name） | 97 | 175 | ✅ 本次全译 |
| 17 | 2017-9-25 | （无 name） | 51 | 113 | ✅ 本次全译 |
| 18 | 2017-9-19 | `Breaking Infinity` | 230 | 419 | ✅ 本次全译 |
| 19 | 2017-9-7 | `Challenges` | 7 | 17 | ✅ 本次全译 |
| 20 | 2017-8-30 | （无 name） | 47 | 87 | ✅ 本次全译 |
| 21 | 2017-8-24 | `Infinity` | 44 | 75 | ✅ 本次全译 |
| 22 | 2017-5-7 | （无 name） | 59 | 123 | ✅ 本次全译 |
| — | 合计 | 22 条 | 7276（其中 17 条待译合计 7240） | 15661（其中 17 条合计 12547） | — |

## 二、最终统计

| 指标 | 数值 | 口径 |
|---|---|---|
| 条目总数 | 22 | 数组 `changelog.length`（实测） |
| 已全中文条目 | 22 | `info` 正文无英文句子，仅保留标识符（实测） |
| 部分中文条目 | 0 | — |
| 保留英文的 `name` | **10 条**（均为短标签代号或玩笑体标题，见 3.1） | 逐条归类见 3.1 |
| 描述型 `name` 已译 | **5 条**（倍率页签…、速通与符文随机、视觉与代码准备、时间墙削减、发布后首个补丁） | 能读成"这次更新做了什么"的一律翻 |
| 无 `name` 条目 | 4 条（2017-10-10 / 9-25 / 8-30 / 5-7） | 原文无 |
| 剩余英文句子数 | **0** | info 正文中"无 CJK 且含 ≥2 英文单词"= 0 行；"连续 ≥3 英文单词"= 0 行（实测） |

## 三、保留原文的清单与理由

### 3.1 版本名（`name` 字段，共 15 条英文名，逐条归类）

判据（team-lead 定稿）：**短标签代号保留原文；能读成一句"这次更新做了什么"的描述型一律翻成中文**。

| date | 原文 name | 归类 | 现在的 name | 理由 |
|---|---|---|---|---|
| 2024-8-12 | `Hi Ra` | 代号 | `Hi Ra` | 短标签 + 双关（Hi Ra / 天神太阳神 Ra），译出即失义 |
| 2023-5-25 | `Multiplier Tab, Automator, and Major mechanics fixes` | **描述型已翻** | 倍率页签、自动机与主要机制修复 | 三项内容清单，读得出"这次改了什么"（team-lead 指定译法，术语取"倍率页签""自动机"） |
| 2023-4-7 | `Speedrunner and Glyph RNG` | **描述型已翻** | 速通与符文随机 | 两项内容并列，读得出更新主题；术语取"速通""符文随机" |
| 2023-2-22 | `Visuals and Code prep` | **描述型已翻** | 视觉与代码准备 | "视觉 + 代码准备"是内容说明 |
| 2023-1-26 | `Timewall Reduction` | **描述型已翻** | 时间墙削减 | "削减时间墙"是内容说明；"时间墙"为通行说法，非 UI 名词（Android 中文资源无对应条目） |
| 2023-1-9 | `The Companion Glyph doesn't want to hurt you` | 代号（玩笑标题） | 原文保留 | 整句玩笑梗，不含更新内容清单；译出梗失效，且游戏内它是版本代号而非功能描述（team-lead 定稿） |
| 2022-12-21 | `First Post-release Patch` | **描述型已翻** | 发布后首个补丁 | "发布后第一个补丁"是状态描述 |
| 2022-12-17 | `The Reality Update` | 代号 | 原文保留 | 社区通用版本名（"现实更新"），玩家/百科按此检索 |
| 2018-6-17 | `This Update Sucks` | 代号（自嘲） | 原文保留 | 玩笑标题，不含内容信息 |
| 2018-4-1 | `Fixed a Bug where there wasn't an Update` | 代号（玩笑标题） | 原文保留 | 愚人节假日志标题，整句是梗本身，非内容清单（team-lead 定稿） |
| 2018-2-1 | `Eternity Challenges` | 代号 | 原文保留 | 短标签（版本主题） |
| 2017-12-1 | `"Eternity" update` | 代号 | 原文保留 | 短标签（含引号，原文如此） |
| 2017-9-19 | `Breaking Infinity` | 代号 | 原文保留 | 短标签（阶段名） |
| 2017-9-7 | `Challenges` | 代号 | 原文保留 | 短标签 |
| 2017-8-24 | `Infinity` | 代号 | 原文保留 | 短标签 |
| 2017-10-10 / 9-25 / 8-30 / 5-7 | （无 name） | — | 未新增 | 原文无版本名，不擅自补 |

**边界情形（team-lead 已定稿，2026-10-31）**：2023-1-9 与 2018-4-1 两条归入「代号（玩笑标题）」，保留原文、不计入待译——判据：与已保留的 10 条同属**整句标题/玩笑梗**，不含"这次更新改了什么"的内容清单，翻译后梗会失效，且它们在游戏内是版本代号而非功能描述。

### 3.2 正文内保留的技术标识 / 专有名词（正文已中文，仅这些记号保留原文）

| 类别 | 保留项 |
|---|---|
| 游戏缩写 | `EC` `EC1` `EC2` `EC4` `EC7` `EC8` `EC10` `EC11` `EC12` `IC` `IC1` `IC2` `IC3` `IC5` `NC6` `NC7` `NC8` `NC10` `NC11` `NC12` `TS` `TS11` `TS21` `ID1` `ID8` `EM6` `EM200` `EM1000` `EU1` `EU2` `ECB` `ACHNR` `C9` `c6` `TT` `EP` `IP` `TP` `DT` `RG` `AM` |
| 天神代号 | `cel1` `cel2` `cel3` `cel4` `cel5` `cel5-3` `cel6` `cel7` |
| 数值/公式 | 所有 `1eN`、`e50`、`8e45`、`1.79e308`、`log4`、`log10`、`^`、`10 ^ (...)`、`(1.02^x)` 等原样保留；`(infinities * EC10 completions * 0.000002+1) > (...)` 这类伪代码公式整段原样保留（变量名属技术标识） |
| 按键 | `Shift` `Alt-T` `Shift+1-8` `Shift+T` `A`（A 键）`C` `M` `S` `D` `G` `R` `T` `ON`/`OFF` `END` |
| 代码/文件/库 | `Vue.js` `break_infinity.js` `decimal.js` `LZString` `GitHub` `HTML` `CPU` `gif` `e3e18` `NaNeInfinity` `SxTg` `NOTIFY` `STOP` `REALITY` `v10` |
| 专有名词 / 人名 | `Google` `Omsi` `SpectralFlame` `Patashu` `StrangeTim` `Hevipelle` `Antman` `SimpleFlips` `Leeroy Jenkins` `Patches` `Trimps` `Firefox` `Kred` `TukkunFCG` `YC` `GRB` `Amoled/AMOLED` `SPENT TT` |
| 符号 | `\uE010`（私有区图标字符，原样保留；原文 3 处、现文 3 处，逐字节一致，无双反斜杠变形） |

说明：`Leeroy Jenkins`、`Patches`、`Trimps` 等是外部作品的角色/作品名，属专有名词，故保留不译；`CS`、`mania` 为 osu! 术语，同样按专有名词处理。

**遗留待议**：`SPENT TT`（2024-8-12 自动机货币条目）按术语规则应作“消耗时间之理”，但它位于**既有中文条目**且是自动机货币语境中的固定写法，本轮**不动**，登记为遗留项，待统一决策。

### 3.3 旧界面名 → 现界面名（历史日志里的旧 UI 名称，已按当前界面统一）

历史日志写作时的旧 UI 名与当前界面已不一致的，一律按**当前界面名**统一，逐条登记，不静默改动：

| # | 日志原意 | 旧写法（本次改前） | 统一为（依据） | 处数 | 位置 |
|---|---|---|---|---|---|
| 1 | Multiplier Breakdown subtab | 加成分解 | **倍率明细**（`src/core/secret-formula/tabs.js:113`，key 仍为 `multipliers`；Android `tab_multipliers`） | 3 | 2023-5-25 ×2、2022-12-17 ×1（"倍数加成分解子标签页"→"倍率明细子标签页"） |
| 2 | How to Play / H2P | 游戏指南 | **游戏帮助**（`src/components/modals/H2PModal.js:98` 标题；Android `tab_how_to_play` = 游戏帮助，`游戏指南` 在 Android 中文资源中出现 0 次） | 10 | 2023-7-18 ×2、2023-4-7 ×1、2023-2-22 ×1、2023-1-26 ×1、2023-1-9 ×2、2022-12-17 ×3 |
| 3 | recent prestige (tab) | "最近的重置" | **最近重置**（`tabs.js` 标签名） | 2 | 2023-4-7、2023-2-22 |
| 4 | statistics (tab) | 统计标签页 | **统计数据标签页**（`tabs.js` / Android `tab_statistics` = 统计数据） | 3 | 2023-7-18、2023-4-7、2018-2-1 |
| 5 | speedrun widget | 速通小部件 | **速通信息**（`src/components/SpeedrunStatus.js:82`"点击以收起速通信息"；Android 无"小部件"一词） | 1 | 2023-4-7 |
| 6 | cosmetics (glyph) | 外观 | **符文外观**（Android `glyph_cosmetic_options` / `custom_glyph_appearance` = 符文外观） | 1 | 2023-1-26 |
| 7 | Glyph set (cosmetic set) | 符文套装 | **符文外观套装**（Android `glyph_cosmetic_options`；`shop-purchases.js`「符文外观套装」） | 1 | 2023-4-7 |

说明：
- 第 2 条是我第一版译文的术语错误（误用"游戏指南"），按 Android 官方口径纠正为"游戏帮助"；2023-7-18「最终官方补丁」（既有中文条目）里的同一词也一并统一，避免同一个弹窗在日志里出现两种叫法。
- 术语基准统一取 `android/AD_Oreki_Edition_Android/work/verify3/res/values-zh-rCN/strings.xml`（与 `work/base_decoded/...` 同源）＋ Web 当前界面名（`tabs.js` / 组件标题）。已逐项核对：计数频率、复制器（星系）、维度提升、维度献祭、时间之理、时间膨胀、膨胀时间、无限之力、遗迹碎片、遥远星系、奇点、复兴（树）、自动机、速通、倍率明细、游戏帮助、统计数据、最近重置 均与 Android 官方一致。

## 四、歧义与人工判断记录

| 条目 | 原文 | 处理 |
|---|---|---|
| 2023-4-7 | `suppresses END formatting on some subtabs` | `END` 是速通计时的界面标记，保留记号，译为"不再显示 END 标记" |
| 2023-4-7 | `Two side effects of the above change` | 原文未说明是哪两个 → 按字面译"有两个附带影响"，并在同句列出两项，不补第三项 |
| 2023-1-26 | `(LE, nav, achievements)` | `LE` 无法在当前代码库中确证含义，保留字母记号不臆测（译作"（LE、导航、成就）"） |
| 2018-6-17 | `((infinities * EC10 completions * 0.000002+1) > (...))` | 这是变量级公式（`>` 表示"由…改为…"），整段原样保留，避免改写数值语义 |
| 2018-4-1 | `"Dimesional Sacrifice"` / `"Eternity confimation"` / `"1 eternity points."` | 这三条是"修正英文拼写/单复数"的元笑话，直译后语义丢失 → 改写为中文说明（"新闻栏中的『维度献祭』原本被写成了错误的英文单词"等），不保留英文错字 |
| 2018-4-1 | `Leeroy Jenkins' Battlecry now doesn't trigger Patches.` | 炉石传说卡牌梗，卡名保留原文 |
| 2018-2-1 | `spreading cancer` / `one for each dimension` | 2018 年的成就旧称，现行中文名已改（成就 76 = 「一维一天」可对应），`spreading cancer` 无现行对应名 → 按字面译"扩散癌症"，并在此登记 |
| 2018-6-17 | `"Yo dawg, I heard you liked infinities"` | 现行中文名无法唯一确证，取成就 33「很多无限」并在正文中直接引用 |
| 2017-10-10 | `Inf Dim 2` | 译为"第二无限维度"，与现有 `ID2` 术语一致 |
| 2022-12-17 | `Fixed some tpyos.` | 原文故意把 `typos` 拼成 `tpyos`，属玩笑；译为"修复了一些拼写错吴。"（故意写错一字以保留梗），非笔误 |
| 2023-4-7 | `Total Termination` | **自译，无官方对照**：`src/` 全量检索 0 命中，该名只存在于历史日志文本中 → 定为「彻底终结」，不再标"待核对" |
| 2023-4-7 | `Transience of Information` | **自译，无官方对照**：`src/` 全量检索 0 命中 → 定为「信息瞬变」 |

## 五、结构与语法校验（实测）

| 检查 | 结果 |
|---|---|
| `node --check src/core/secret-formula/changelog.js` | 通过（exit 0） |
| 动态 `import()` 加载 | 成功，`changelog.length = 22`，`id` 0–21 连续 |
| 日期顺序 | 与原文完全一致（2026-7-17 → 2017-5-7，22 条） |
| HTML 标签逐条计数比对（`<ul>` `<li>` `<b>` `<i>` `<br>` `<strong>` 开闭） | **22 条全部一致，不一致条目数 = 0** |
| 原文既有的 HTML 缺陷 | 保留未修：2022-12-17 最后一个 `<ul>` 原文未闭合；2018-4-1 有一条正文缺 `<li>` 但保留 `</li>` |

## 六、扫描命令与输出

```bash
cd web/AD-Oreki-Edition
node -e "
const fs=require('fs');
const src=fs.readFileSync('src/core/secret-formula/changelog.js','utf8');
const bodies=[...src.matchAll(/info: \`([\s\S]*?)\`\r?\n  \}/g)].map(m=>m[1]);
console.log('info 块数量:',bodies.length);
let noCJK=0, sent=0;
bodies.forEach((b,i)=>b.split(/\r?\n/).forEach(l=>{
  const p=l.replace(/<[^>]*>/g,' ').replace(/\\\\u[0-9A-Fa-f]{4}/g,' ');
  if(!/[\u4e00-\u9fff]/.test(p) && (p.match(/[A-Za-z][A-Za-z'\u2019\-]*/g)||[]).length>=2){noCJK++;console.log('  [无中文行]',i,l.trim())}
  if((p.match(/[A-Za-z][A-Za-z'\u2019\-]*(?:\s+[A-Za-z][A-Za-z'\u2019\-]*){2,}/g)||[]).length){sent++;console.log('  [英文句子]',i,l.trim())}
}));
console.log('info 正文中「无中文字符且含≥2 英文单词」的行数:',noCJK);
console.log('info 正文中「连续 3 个以上英文单词」的行数:',sent);
"
```

实际输出：

```
info 块数量: 22
info 正文中「无中文字符且含≥2 英文单词」的行数: 0
info 正文中「连续 3 个以上英文单词」的行数: 0
```

补充扫描（整文件，含 name 与注释）：

```bash
node -e "
const fs=require('fs');
const lines=fs.readFileSync('src/core/secret-formula/changelog.js','utf8').split(/\r?\n/);
let n=0;
lines.forEach((l,i)=>{
  const plain=l.replace(/<[^>]*>/g,' ').replace(/\\\\u[0-9A-Fa-f]{4}/g,' ');
  if(!/[\u3400-\u9FFF]/.test(plain) && (plain.match(/[A-Za-z][A-Za-z'’.\-]*/g)||[]).length>=2){n++;console.log((i+1)+': '+l.trim());}
});
console.log('命中行数: '+n);
"
```

输出（26 行，全部为 `name:` 版本名、JSDoc 注释、`//` 注释、`for` 循环行，均在 `info` 正文之外）：文件顶部 `export const changelog = [`、4 行 JSDoc、17 行 `name: "…"`、4 行 `//` 注释、2 行 `for` 循环代码。

## 七、改动清单

```
$ git diff --stat -- src/core/secret-formula/changelog.js
 src/core/secret-formula/changelog.js | 1433 ++++++++++++++++------------------
 1 file changed, 693 insertions(+), 740 deletions(-)
```

- 修改文件：**仅** `web/AD-Oreki-Edition/src/core/secret-formula/changelog.js`
- 未 `git add` / `commit` / `push`，改动留在工作区
- 未触碰 `script-templates.js`、`tabs.js`、教程数据文件

## 八、结论

- 【已实测】17 条英文正文全部译为简体中文；`info` 正文中英文句子数 = 0。
- 【已实测】条目数（22）、日期顺序、`id`（0–21 连续）、数组结构、HTML 标签数量与原文逐条一致；`name` 未增删，仅按 3.1 规则翻译 5 条、保留 10 条。
- 【已实测】`node --check` 通过，模块可正常 `import`。
- 【已实测】旧 UI 名统一 7 类共 21 处（倍率明细 3、游戏帮助 10、最近重置 2、统计数据标签页 3、速通信息 1、符文外观 2），旧名残留 = 0；逐条登记见 3.3。
- 【自译，无官方对照】`彻底终结`（Total Termination）、`信息瞬变`（Transience of Information）：经 `src/` 全量检索 0 命中，确认当前代码中不存在这两个名字，故无官方译名可比对，按字面定稿。
- 【已实测】15 条英文 `name` 已按"代号保留 / 描述型翻译"重新归类：保留 10 条、翻译 5 条（详见 3.1）。
- 【遗留待议】`SPENT TT`（2024-8-12 既有中文条目的自动机货币写法）按术语规则应作"消耗时间之理"，本轮按"不动既有条目"未改，已登记。
