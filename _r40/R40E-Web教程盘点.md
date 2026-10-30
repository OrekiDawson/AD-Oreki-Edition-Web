# R40E · Web 端教程盘点（只读调研 · 缺口清单 + 补齐方案）

- 盘点时间：2026-10-30
- 标准口径：`AD-Oreki-Unified/AGENTS.md` §24（教程标准的唯一源，本报告不另立标准）
- 工作区：`C:\Users\Oreki\WorkBuddy\AD-Oreki-Unified`
- 仓库：`web/AD-Oreki-Edition`
- 纪律：**只读**。本轮未修改任何教程文件、未改渲染组件、未提交 git、未跑 npm/构建/浏览器长跑。
- 标注约定：`[读码]` = 本轮实读源码；`【未核对】` = 未核实，不得当作结论；行号均为当前 HEAD 工作区实际行号。

---

## 0. 结论先行

1. **Web 端存在两套各自维护、互不复用的教程**（不是一套）：`src/core/oreki-tutorial.js`（弹窗版，7 章 / 39 小节 / 170 条）与 `src/components/tutorial/OrekiTutorial.js`（H2P 页签版，8 个 HTML 常量 + 17 条里程碑）。两者入口不同、格式不同、内容不同，**同一件事会给出两套说法**。`[读码]`
2. 两套加起来的覆盖**只到「首次永恒 → 现实」**。EC（第 7 阶段）、天神细节（第 9 阶段）、隐藏条件（第 11 阶段）基本是空白；**Pelle 只有一句话 + 4 条提示**，终局判据写了「1×10^1000」但没给可执行的推进步骤。`[读码]`
3. **11 个阶段里 0 个达到「操作手册」级**（§24.3 十字段）。最好的 3 个是「基本可用」（开局/提升星系/首次无限），最差的 1 个「完全缺失」。`[读码]`
4. **现有数据结构撑不住攻略**：`sections[].points[]` 是纯字符串数组，弹窗用 `{{ }}` 插值 → **不能写编号步骤、不能写表格、不能加粗、不能折叠、不能标记章节完成**。要写 §24.3 那种手册必须先扩结构（最小改动方案见 §4.2）。`[读码]`
5. **按进度定位只有半套**：弹窗有 6 阶段快照（`STAGE_DEFS`），但**打开时永远停在第 1 章**（`index: 0`，无 watch）；切章也**不重置滚动位置**。H2P 版有 17 步清单且新档会自动落到教程页，但它与弹窗版章节完全不对应。`[读码]`
6. **教程不是懒加载**：`index.html:53` 只加载 `src/main.js`（ES module），`main.js → globals.js → modal.js:35/239 → OrekiTutorialModal.js → oreki-tutorial.js` 全静态 import，另外 `oreki-tutorial.js:25` 在模块求值时就调 `scheduleTutorialEntry()`。当前 40KB 无所谓，补齐到 ~150KB 后就该拆包了。`[读码]`
7. **关键反直觉事实**：本 MOD 从开局到佩勒几乎**全自动**（`game.js:866-893` 依序 tick 五个自动化 + 挑战进入即完成 + 终局链自动化）。所以攻略的正确写法不是「教玩家点 300 下」，而是「告诉他只有 5 件事需要他做，其余看判据」。§24.4 第 7 条要求的正是这个。`[读码]`
8. **Steam 指南佐证「缺的是一整层，不是细节」**（详见 §7）：抓了 12 篇指南（9 篇中文 ≈ 14.9 万汉字），成熟攻略的主轴是「重置层 + 货币区间」（如「三、打破无限（3e4–5e11 IP）」）。我们 7 章里只有 `intro`/`basics` 能在指南的章节轴上找到位置，其余 5 章本质是附录。**章节级缺口 = 缺「按进度区间命名的正文层」**。

### 三句话统计

- **缺口分布**：完全缺失 **1** 个（⑪隐藏条件）/ 只有一句话 **2** 个（⑦EC、⑨天神）/ 有但不含操作步骤 **5** 个（③⑤⑥⑧⑩）/ 基本可用 **3** 个（①②④）。
- **建议章节数**：**15 章 + 5 附录**（第 0 章导览 → 第 14 章隐藏条件总表；附录 = 自动化对照表 / 关键数值与出处 / 术语表 / 成就总表 / 中英译名对照），最后一章是 Pelle → Doomed → `isGameEnd`。
- **是否需要改数据结构**：**需要**。现有 `points[]` 纯文本无法承载编号步骤与表格；最小改动 = 给 section 增加 `steps / table / note` 三个可选字段 + 章节级 `stages[]` 与 `done()`，渲染端加 3 个分支，CSS 加约 40 行。

---

## 1. 现状盘点

### 1.1 两套教程的对照（这是本次盘点的第一个发现）

| 维度 | 弹窗版（正文数据） | H2P 页签版 |
|---|---|---|
| 数据文件 | `src/core/oreki-tutorial.js`（594 行 / 40,191 字节 / 22,485 字符） | `src/components/tutorial/OrekiTutorial.js`（326 行 / 15,831 字节 / 10,056 字符） |
| 渲染 | `src/components/modals/OrekiTutorialModal.js`（192 行），Vue 模板 + `{{ }}` 插值 | `src/components/modals/H2PModal.js:134` `v-html="activeTab.info()"` |
| 入口 1 | 右下角常驻按钮 `.c-oreki-tut-entry`（`oreki-tutorial-entry.js:62-69`，`oreki-tutorial.js:25` 调用） | 「帮助 / ?」按钮 → H2P 弹窗首个页签（`H2PModal.js:28`） |
| 入口 2 | 「选项 → 游戏玩法 → 内置教程」（`OptionsGameplayTab.js:265-270` → `Modal.orekiTutorial.show()`，注册在 `modal.js:239`） | 新档打开帮助时自动落在此页（`H2PModal.js:68-69`）+ `Tutorial.emphasizeH2P()`（`:73`） |
| 结构 | 章节 → 小节 → 条目（纯文本） | 「你现在该做什么」清单（17 步）+ 8 段手写 HTML |
| 进度能力 | 6 阶段快照 + 三态（已进入 / 条件已满足 / 未解锁） | 17 条里程碑勾选（`done` 用存档真实判定） |
| 排版能力 | 只有 `<ul><li>` | 任意 HTML（`<ol>/<b>/<p>`），但样式只覆盖 ul/ol/p |

`[读码]` 两套的章节内容不对应：弹窗版有「阶段突破」（AD3~AD9 机制解释，71 条），H2P 版完全没有；H2P 版有 17 步里程碑清单，弹窗版完全没有。**同一个玩家从两个入口进去，会看到两种「下一步」。**

### 1.2 数据层结构（`src/core/oreki-tutorial.js`）

```
TUTORIAL_CHAPTERS = [                      // 177-594
  {
    key: "intro",                          // 章节唯一键
    title: "Mod 介绍",                     // 章节标题
    subtitle: "这是什么版本，哪些是改过的",  // 副标题
    kind: "stages",                        // 仅 "阶段指南" 使用，特殊章节类型
    sections: [                            // 小节数组
      {
        heading: "这是什么",                // 小节标题
        points: ["…", "…"]                 // 纯字符串数组，无任何内联标记
      }
    ]
  }
]
```

- 字段全集只有：`key / title / subtitle / kind / sections[].heading / sections[].points[]`。**没有** `steps`、`table`、`code`、`collapsed`、`done`、`stages`、`links`、`images`。
- 无 i18n 层、无版本号字段（改文案无法提示"教程已更新"）。
- 阶段快照是**另一份独立数据**：`STAGE_DEFS`（39-125），6 个阶段，字段 `key/name/unlocked()/entered()/focus/nextSteps[]`；快照函数 `getTutorialStageSnapshot()`（144-172）；未解锁前缀 `TUTORIAL_LOCKED_PREFIX`（175）。

### 1.3 现有全部章节与小节（含行号）

**A. 弹窗版 `src/core/oreki-tutorial.js` —— 7 章 / 39 小节 / 170 条**

| # | 章节 key | 标题 | 行号范围 | 小节数 | 条目数 | 讲的哪个游戏阶段 |
|---|---|---|---|---|---|---|
| 1 | `intro` | Mod 介绍 | 178–215 | 3 | 15 | 元信息（非游戏阶段）：版本差异 AD3~AD9 / AU2~AU4b / AB2 |
| 2 | `basics` | 新手入门 | 217–254 | 4 | 12 | ① 开局维度 → ② 提升/星系 → ④ 首次无限 |
| 3 | `automation` | 自动化 | 256–303 | 5 | 17 | ③ 自动购买器（页面位置 / 总开关 / 间隔 / 可选提速开关） |
| 4 | `stages` | 阶段指南 | 305–310 | 0（`kind:"stages"`） | 0 | 运行时快照：6 阶段三态 + 当前阶段步骤 |
| 5 | `breakthrough` | 阶段突破 | 311–438 | 10 | 71 | ④→⑥ 的机制解释（AD7/AD5/AD5b/AD3/AD3b/AD6/AD8/AD9/AD4） |
| 6 | `mod` | Mod 专属机制 | 439–506 | 7 | 25 | 元信息：AU2/AU3/AU4、AU4b、AB2、速度倍率、动态速度、工具 |
| 7 | `faq` | 常见问题 | 507–593 | 10 | 30 | 横跨 ③④⑤ 的排障（IP 不涨 / ID1 锁 / Break 灰 / 速度自变 / 资源不涨 / 购买器不动 / 阶段未解锁 / 该做什么 / 时间口径 / 存档） |

小节级清单一览（heading 行号 → 区间）：

- **intro（178–215）**：这是什么 184–191；本 Mod 改了什么（细节见第 5、6 章）193–205；爽玩思路 207–213
- **basics（217–254）**：把维度买起来 222–228；第一次重置 230–236；首次无限 238–245；两个容易漏的点 247–252
- **automation（256–303）**：在哪看 261–267；总开关管什么、不管什么 269–277；什么时候能用 279–285；怎么调 287–293；两个可选提速开关 295–301
- **stages（305–310）**：无静态小节，全部由快照生成
- **breakthrough（311–438）**：先看这一条（否则后面都不会动）317–325；AD7 · 开局就不再需要手点 327–337；AD5 / AD5b · Break 闸门 339–350；AD3 · 首次 ID1 的 IP 兜底 + 自动购买 352–361；AD3b · IP 够了之后为什么反而不坍缩了 363–372；AD6 · 首次无限之后的无限维度与无限升级 374–385；AD8 · Reality 之前的 IP 兑换尺度 387–398；AD9 · Reality 之前的 EP 兑换尺度 400–409；AD4 · 首次永恒之前保留反物质 411–421；把这几条连起来看（真实时间线）423–436
- **mod（439–506）**：自动购买器提前接管（AU2 / AU3 / AU4）445–451；大坍缩默认策略（AU4b）453–460；买最大退化（AB2）462–469；全局速度倍率 471–477；动态速度：什么时候会自己升档 479–488；两个可选工具 490–495；没有改的部分 497–504
- **faq（507–593）**：IP 一直不涨 513–519；ID1 一直锁着 521–527；「打破无限」按钮一直是灰的 529–535；速度自己变高了 537–543；资源不涨了 545–552；自动购买器不工作 554–561；阶段没解锁 563–569；怎么知道现在该做什么 571–577；时间对不上 579–584；存档出问题了 586–591

**B. H2P 页签版 `src/components/tutorial/OrekiTutorial.js` —— 1 个清单 + 8 段正文**

| 常量 | 标题 | 行号 | 讲什么 |
|---|---|---|---|
| `STEPS` | 17 条里程碑 | 29–115 | 从「买第 1 维度」到「反物质 1×10^1000」的一条线性清单，每条带 `done()` 真实判定 |
| `BASICS` | ⓪ 界面速查 | 256–264 | 侧栏 10 项 / ? 与 i 按钮 / 底部信息栏 / 通知 |
| `ORIGIN` | ① 开局 30 秒 | 179–183 | 8 个维度的循环、买法 |
| `DIM_RESET` | ② 维度、维度提升、反物质星系、大坍缩 | 185–191 | 四个重置机制的定性说明 |
| `INFINITY` | ③ 无限：IP、打破无限、无限维度、复制器 | 193–203 | 5 条要点 |
| `ETERNITY` | ④ 永恒：时间维度、时间定理、时间研究、膨胀 | 205–215 | 4 条要点 |
| `REALITY` | ⑤ 现实：符文、现实机器、现实升级、黑洞 | 217–227 | 4 条要点 |
| `CHALLENGES` | ⑥ 挑战：普通 → 无限 → 永恒 | 229–238 | 三档挑战各 1 条 |
| `LATEGAME` | ⑦ 后期：七位天神与佩勒 | 240–254 | 7 位天神各 1 条 + 终局条件 |

辅助函数：`currentStage()` 118–126（0~6）、`STAGE_NAMES` 128–136、`nextStep()` 139–141、`renderChecklist()` 152–177（只显示「当前 + 后 4 步」）、`render()` 312–325。

> 注：文件注释写「已完成 x/16」（`renderChecklist` 用 `STEPS.length`，实际 17 条；"16" 只出现在 `VISIBLE_STEPS` 上方的注释 149 行）——**注释与实际不一致**，属小瑕疵，记在此处备查。`[读码]`

### 1.4 阶段快照：6 个阶段 vs §24.2 的 11 个阶段

`STAGE_DEFS`（39–125）：

| 快照阶段 | 行号 | 解锁判定 | 已进入判定 | 对应 §24.2 |
|---|---|---|---|---|
| 开局（未无限）`early` | 40–54 | `true` | `!isInfinityUnlocked` | ①② |
| 无限期 `infinity` | 55–69 | `isInfinityUnlocked` | `player.infinities > 0` | ④⑤ |
| 永恒期 `eternity` | 70–85 | `isEternityUnlocked` | `player.eternities > 0` | ⑥⑦ |
| 现实期 `reality` | 86–98 | `isRealityUnlocked` | `player.realities > 0` | ⑧ |
| 天神期 `celestials` | 99–111 | `Teresa.isUnlocked` | `Teresa.pouredAmount > 0` | ⑨ |
| 毁灭现实（佩勒）`doomed` | 112–124 | `Pelle.isUnlocked` | `Pelle.isDoomed` | ⑩ |

**问题**：6 个阶段颗粒度远粗于 11 个。EC1~EC12（⑦）与膨胀没有独立阶段；天神（⑨）把「特蕾莎灌注」「V/Ra」「莱特拉」压成一行 `focus`；⑪（隐藏条件）根本没有对应阶段。玩家到「天神期」时，快照只会告诉他「按导航顺序推进天神」，无法定位到具体哪一位。`[读码]`

### 1.5 渲染能力矩阵（决定攻略能写成什么样）

| 能力 | 弹窗版（OrekiTutorialModal.js） | H2P 版（OrekiTutorial.js + H2PModal） |
|---|---|---|
| 有序列表 / 编号步骤 | ❌ 只有 `<ul>`（模板 160–167） | ✅ HTML 里可写 `<ol>`（240–254 已用），样式 `oreki.css:1394-1398` |
| 加粗 / 内联强调 | ❌ `{{ point }}` 纯文本，写 `**x**` 会原样显示 | ✅ `<b>`（ORIGIN 等已用） |
| 表格 | ❌ 无法表达 | ⚠️ 技术上可写 `<table>`（v-html），但**无任何 table 样式**，会用浏览器默认边框，窄屏会撑破 `【未核对：未实际渲染过表格】` |
| 代码块 / 等宽 | ❌ | ⚠️ 无样式 |
| 折叠 / 展开 | ❌ | ❌ |
| 章节内锚点跳转 | ❌ | ❌ |
| 图片 | ❌ | ⚠️ 可 `<img>`，无样式、无资源管线 |
| 章节进度（✔/▶） | ❌（只有 6 阶段行是三态） | ✅ 17 条里程碑三态（`renderChecklist` 152–177） |
| 章节分组 / 目录层级 | ❌ 单层 nav（模板 86–96） | ❌ 单页签 |
| 搜索 | ❌ | ⚠️ 仅 `matches()` 简单包含匹配，命中就整页排第一（`H2PModal.js:49-51`），不定位到章节 |
| 弹窗内固定高度 | ✅ `height: 50vh`（CSS 429），内容区独立滚动（507–511） | ⚠️ 走 h2p 自身滚动区（`H2PModal.js:81` 切页签时重置 `scrollTop`） |

**结论**：想写 §24.3 的「编号步骤 + 关键数值表 + 完成判据」，**弹窗版必须先扩渲染**；H2P 版能吃 HTML，但表格样式与移动端未验证，且它没有章节概念（一页到底），长文会退化成一个巨型页面。

### 1.6 能否「按当前进度高亮/定位到对应章节」

- **弹窗版：不能定位，只能高亮阶段。** `OrekiTutorialModal.js:23` `index: 0` 固定从第 1 章开始；`goTo()`（58–61）只在点击时改 index；`update()`（45–54）每 15 帧重算快照，但**不触发章节跳转**。玩家在「永恒期」打开教程，仍然看到「Mod 介绍」。
- **切章不重置滚动**：`goTo` 未操作 `.c-oreki-tut__scroll` 的 `scrollTop`（对比 `H2PModal.js:81` 有做）。章节越长，切换后越容易停在半截。
- **H2P 版：有清单但无章节**。`renderChecklist` 会显示「当前 + 后 4 步」并高亮 ▶，但整页 HTML 一次性渲染，不能折叠；新档会被 `H2PModal.js:68-69` 送到这一页。
- **两套判定口径不一致**：H2P 版 `currentStage()` 用「反物质 > 1e100」判第 2 阶段（`OrekiTutorial.js:123`），弹窗版用 `isInfinityUnlocked`；H2P 版第 6 阶段判据是 `Pelle.isDoomed`，弹窗版分 `Pelle.isUnlocked` / `isDoomed` 两态。**同一个存档会得到两个"当前阶段"**。`[读码]`

### 1.7 入口、加载与体积

- 入口 3 个：常驻悬浮按钮（`oreki-tutorial-entry.js`，样式 `oreki.css:358-405`，z-index 低于遮罩）、选项页按钮（`OptionsGameplayTab.js:265-270`）、H2P 首屏页签。
- **加载**：`index.html:53` 单入口 `src/main.js`（`type="module"`）→ `main.js:5` `import "./core/oreki-tools.js"`、`main.js:7` `import { init } from "./game.js"`；`globals.js` 静态 import `core/modal.js`，`modal.js:35` 静态 import `OrekiTutorialModal.js`，后者静态 import `oreki-tutorial.js`。**全链路无 `import()`**（全仓仅注释里出现过动态 import，`oreki-dilation-probe.js:26` / `oreki-ec-probe.js:33`）。→ 教程正文**随主包加载**。
- 体积：`oreki-tutorial.js` 40,191 字节；`OrekiTutorial.js` 15,831 字节。合计约 56KB 文本进入初始模块图。
- **渲染开销隐患**：`OrekiTutorial.render()`（312–325）在 `H2PModal` 模板里以 `activeTab.info()` 形式直接调用（`H2PModal.js:134`），**每次 H2P 弹窗重渲染都会重建整页 HTML 字符串**——搜索框 `v-model="searchValue"`（`H2PModal.js:105`）每敲一个字都会触发。当前 10k 字符无感，补齐到 5 万字级别时这里会是明显卡顿点。`[读码]`【未实测耗时】

---

## 2. 缺口清单（对照 §24.2 的 11 个阶段）

严重度定义（本报告统一使用）：
`完全缺失` 无任何文字 ｜ `只有一句话` 有 1 条要点或 1 个词 ｜ `有但不含操作步骤` 有定性说明但无法照着做 ｜ `基本可用` 有步骤，缺数值/顺序细节。

| # | 阶段 | 现有覆盖情况 | 现有章节/行号 | 缺什么 | 严重度 |
|---|---|---|---|---|---|
| ① | 初始维度与反物质 | 有「点第 1 维度、100 反物质开第 2 维、买计数频率」3 条 + H2P 3 条 | `oreki-tutorial.js:222-228`；`OrekiTutorial.js:179-183`；17 步清单前 1 步 `:31-34` | 2~8 维度价格与解锁门槛表；买 1 / 买 10 / 买最大（AB2 退化）差异；快捷键（M / A）；「开局已被 AD7 接管，手点也不必」只在 `:243` 一句带过，未给判据 | 基本可用 |
| ② | 维度购买 / Tickspeed / 维度提升 / 银河 | 有 20 个第四维、80 个第八维两个门槛；H2P 四个机制各 1 段 | `oreki-tutorial.js:230-236`、`:185-191`；`OrekiTutorial.js:185-191` | 三者先后顺序（提升 vs 星系 vs 计数频率的性价比）；成本增长倍率；AD4「重置不清零」对"20 个第四维"判定的实际影响（`:411-421` 只解释机制，没告诉玩家怎么用）；重置后买不起的手动补救 | 基本可用 |
| ③ | 自动购买器解锁 / 配置 / 升级 | 有页面位置、总开关三条件、100ms 间隔、默认买 10、大坍缩策略；H2P 未涉及 | `oreki-tutorial.js:261-301`；`:317-325` | 逐个购买器的解锁/购买顺序与价格；间隔升级由哪个挑战提供（只列了 C1-8/9/10/11 编号，未给"升到几级够用"）；批量购买档位；佩勒内恢复顺序（`:283` 一句「需要在佩勒升级里逐个恢复」）；除总开关外每个独立开关的清单 | 有但不含操作步骤 |
| ④ | 无限前置与首次无限 | 有 1.8e308 → 大坍缩 → IP，且给了真实时间线（11s/13s/15~16s） | `oreki-tutorial.js:238-245`、`:423-436`、`:327-337`；faq `:513-535` | 「本纪最高反物质」与「当前反物质」的区别（AD3b 讲了一半，没落到 UI 上哪个数字）；首次无限后页签/按钮变化的清单；手动点会不会冲突（`:334` 一句） | 基本可用 |
| ⑤ | 无限升级 / 无限挑战及顺序 | H2P 有 5 条要点（无限升级 / 打破无限 / ID1-8 / 复制器 / 自动化）；挑战章 1 段 | `OrekiTutorial.js:193-203`、`:229-238`；`oreki-tutorial.js:352-385`（AD3/AD6 机制解释） | ID1 双门槛的可操作写法（1e8 IP + 1e1100 本纪最高反物质，现在只在 faq 里）；无限升级购买顺序（「IP 倍率为何最后买」在 `:380` 是机制解释，玩家视角缺）；IC1~IC8 解锁顺序/奖励/门槛；复制器解锁条件 | 有但不含操作步骤 |
| ⑥ | 时间研究 / 时间维度 / 永恒 | H2P 4 条要点 + 弹窗 2 节讲 IP/EP 尺度 | `OrekiTutorial.js:205-215`；`oreki-tutorial.js:387-409`；`STAGE_DEFS` 70–85 | 时间研究编号与分叉路线；TT ↔ EP 换算；**「必须先买 1 个时间维度才能用 EP 换 TT」这条硬前置（`time-theorems.js:114`）完全没写**；TD1~8 解锁条件；EC 解锁门槛；DS1 三条前置 | 有但不含操作步骤 |
| ⑦ | 永恒挑战 EC1~EC12 | 仅一句「永恒挑战：限制最狠（禁研究、禁维度等），奖励直接改变玩法」 | `OrekiTutorial.js:234`（1 条）；`oreki-tutorial.js` 无 EC 章节 | 12 关的前置研究编号与 TT 成本（`ec-time-studies.js`）；推荐顺序；EC11/EC12 的 `forbiddenStudies` 冲突（71/72/73）；每关目标、奖励、完成判据；「进入即完成」在 EC 上的表现 | 只有一句话 |
| ⑧ | 现实解锁 / 升级 / 自动化 | H2P 4 条（符文 / 现实升级 / 黑洞 / 炼金）+ 快照 4 条步骤 | `OrekiTutorial.js:217-227`；`oreki-tutorial.js:86-98`（`nextSteps` 4 条） | 解锁条件（`maxEP.exponent >= 4000 && TimeStudy.reality.isBought`，`reality.js:119`）；符文类型/等级/槽位/献祭的操作；现实升级 RU1~RU25 顺序与成就 147 的因果；Perk 优先级；自动现实节奏（8s / 15s） | 有但不含操作步骤 |
| ⑨ | Teresa / Effarig / Enslaved（含 V / Ra / 莱特拉） | 每位天神 1 条要点 + 快照 1 条「按导航顺序推进」 | `OrekiTutorial.js:242-249`；`oreki-tutorial.js:99-111` | 特蕾莎灌注的操作与「按住」语义；鹿颈长试炼；无名氏存储/释放；V 六项解锁条件（`v.js:70-135`）；Ra 记忆；莱特拉熵与不稳定层级；各天神「已进/已完」判据 | 只有一句话 |
| ⑩ | Pelle / Doomed / 终局流程 | Pelle 1 条（进入前备份 + 终局 1e1000）+ 快照 4 条 | `OrekiTutorial.js:249-251`；`oreki-tutorial.js:112-124` | 毁灭现实禁用了什么（清单）；佩勒升级购买顺序；裂缝 / 打击；`endState` 的 14 档标记（`game-end.js:1-12`）与终局后会发生什么；「反物质最大值」在哪个 UI 上看 | 有但不含操作步骤 |
| ⑪ | 隐藏条件 / 特殊机制 / 关键解锁 | 无 | 无 | 成就 147（天神页解锁因）；TT 硬前置（先买时间维度）；EC11/EC12 分叉；IU15 的 `maxID1` 必须为 0 与 EC7 的冲突；IU25 的「临门卸符文」；总开关 = 一切自动化的前提；AD8/AD9 的生效窗口（不是「首次永恒前」而是「Reality 前」） | 完全缺失 |

**统计**：完全缺失 1 ｜ 只有一句话 2 ｜ 有但不含操作步骤 5 ｜ 基本可用 3 ｜ 操作手册级 **0**。

**额外缺口（表外，但违反 §24.3/§24.4）**：
- 全篇**没有一个编号步骤块**（`points` 结构决定的）。最好的一条 `nextSteps`（`oreki-tutorial.js:46-53`）是 6 条字符串，没有"点哪个按钮"的精确路径。
- 全篇**没有一张表格**，因此「EC 编号 / 前置研究 / TT 成本」「V 六项条件」这类必须表格化的内容无处安放。
- **已有 2 处行号引用已失效**（§24.7 第 2 条：数值必须能在源码找到出处）：`oreki-tutorial.js:396` 写 `src/game.js:97` 的 `OREKI_PRE_ETERNITY_IP_DIVISOR`，实际在 `src/game.js:102`；`:407` 写 `src/game.js:100` 的 `OREKI_PRE_REALITY_EP_DIVISOR`，实际在 `src/game.js:105`。补正文时应统一改成「文件 + 常量名」而不写行号，避免再次漂移。`[读码]`
- `【未核对】` 标注机制**不存在**——所有文案都是断言式，没有「来源 / 未核对」标记，违反 §24.4 第 1 条的可追溯要求。

---

## 3. 章节骨架提案（只到「章节 + 小节标题」，不写正文）

设计原则：
1. 一条主线到底（第 1 章 → 第 14 章 = 终局），**不做「阶段指南」这种运行时分叉章节**，改为「每章顶部显示当前是否已完成」。
2. 每章内部固定按 §24.3 十字段排小节顺序：目标 → 进入条件 → 操作 → 优先级 → 自动化 → 挑战 → 数值 → 判据 → 下一步 → 卡点。
3. 已被 MOD 自动化的阶段，小节标题直接写「不需要手动操作」并在附录 A 给对照表（§24.4 第 7 条）。

### 3.1 章节树（15 章 + 5 附录）

**第 0 章 怎么用这份教程**
- 这份教程能带你走到哪里（终局判据 `isGameEnd`）
- 三个入口在哪（右下角按钮 / 选项 → 游戏玩法 / 帮助页首屏）
- 阅读约定：▶ 现在做、✔ 已完成、⚠ 卡点、表 数值
- **全程只需要你做的 5 件事**（总开关 / 备份存档 / 少数决策点 / 判据确认 / 卡住时查表）
- 本 MOD 与原版的差异总表（指向附录 A、B）

**第 1 章 开局：反物质与 8 个维度**（阶段①）
- 界面速查：侧栏 10 项 / 顶部资源 / 底部信息栏
- 第 1 维度：反物质 ↔ 产能的循环
- 第 2~8 维度的解锁顺序与价格
- 购买模式：买 1 / 买 10 / 买最大（含 AB2「买不起 10 个就买 1 个」）
- 快捷键：M（买最大）、A（自动购买器总开关）
- 「这一步已被 AD7 接管」：你可以手点，也可以完全不点
- 完成判据与下一步

**第 2 章 计数频率 · 维度提升 · 反物质星系**（阶段②）
- 计数频率（Tickspeed）做什么、什么时候买
- 维度提升：需求曲线与「20 个第四维」
- 反物质星系：成本增长与「80 个第八维」
- 三者推荐顺序（含"先提再星"的理由）
- AD4：为什么这个阶段重置不清零反物质（MOD 行为，不要照原版攻略）
- 完成判据：反物质逼近 1.8e308

**第 3 章 第一次无限与「打破无限」**（阶段④）
- 1.8e308 与「大坍缩」：本纪最高反物质 vs 当前反物质
- 第一次无限后多出来的东西（页签 / 无限升级 / 自动购买器 AU2·AU3·AU4）
- **唯一必须你手动的一步**：打开自动购买器总开关（并逐个开子开关）
- 「打破无限」的真实前置：大坍缩间隔 ≤ 100ms、15 级、累计 32767 IP
- AD5 / AD5b 已经替你做完了（何时会失效）
- 完成判据 + 卡点（按钮一直灰）

**第 4 章 无限升级 · 无限维度 · 复制器**（阶段⑤前半）
- 无限升级购买顺序（为什么「IP 倍率」要最后买）
- ID1 的双门槛：1e8 IP + 本纪最高反物质 1e1100
- AD3 / AD3b 的两段窗口：为什么「IP 够了反而不坍缩」
- ID2~ID8 与 IP 增长循环
- 复制器（Replicanti）解锁与星系兑换
- 自动购买器间隔升级（哪个挑战给哪个购买器）
- 完成判据：IP 到 1.797e308，永恒按钮亮

**第 5 章 挑战：普通 C1~C12 与无限挑战 IC1~IC8**（阶段⑤后半）
- 三档挑战的区别（普通 / 无限 / 永恒）
- MOD 行为：进入即完成（`oreki-instant-challenges.js`）
- 普通挑战 1~12 的解锁顺序与奖励用途
- 无限挑战 IC1~IC8 的解锁条件与奖励
- 什么时候打、打完继续做什么
- 完成判据

**第 6 章 第一次永恒与时间研究**（阶段⑥前半）
- 永恒按钮出现条件（IP 1.797e308）
- EP / 时间定理（TT）/ 时间研究的关系
- **硬前置：必须先买 1 个时间维度才能用 EP 换 TT**
- 时间研究主线顺序（含关键研究编号）
- 时间维度 TD1~TD8 的解锁条件
- AD8 / AD9：MOD 把 IP/EP 尺度从 308 收到 30，生效窗口是「Reality 之前」
- 完成判据

**第 7 章 永恒挑战 EC1~EC12**（阶段⑦）
- EC 是什么，与普通/无限挑战的差别
- 12 关前置研究编号与 TT 成本（表格）
- 推荐顺序与「先 EC9→10→11→12」的原因
- EC11 / EC12 的分叉冲突：必须 respec 换掉 71 / 72 / 73
- 每关的目标、奖励、完成判据
- 进入即完成在 EC 上的表现
- 完成判据：12 关全部 ×5

**第 8 章 膨胀：DS1 与膨胀时间**（阶段⑥后半）
- DS1 的三条前置（231~234 任一 / EC11+EC12 满 / maxTT）
- 「时间膨胀」到底削弱什么、换什么
- 速子粒子与膨胀升级
- maxDT 与后续天神门槛（1e30）
- MOD 行为：TT 需求在 bootstrap 窗口内被缩放
- 完成判据

**第 9 章 现实：符文 · 现实升级 · 复兴**（阶段⑧）
- 现实解锁条件（maxEP 1e4000 + 膨胀研究 6）
- 第一次现实给什么（初始符文 / 同伴符文）
- 符文：类型 / 等级 / 槽位 / 装备与献祭
- 现实升级 RU1~RU25 的购买顺序与成就 147 的因果
- 复兴树 Perk 优先级
- MOD 行为：自动现实节奏与「压现实」窗口
- 完成判据

**第 10 章 天神链 1：特蕾莎 → 鹿颈长 → 无名氏**（阶段⑨）
- 天神页怎么开（成就 147 = 买齐所有现实升级）
- 特蕾莎：灌注 RM 的操作与「按住」语义、时间定理、解锁位
- 鹿颈长：试炼与符文等级
- 无名氏：存储 / 释放真实时间
- 每位天神的「已进入 / 已完成」判据
- 哪些操作 MOD 已经代劳

**第 11 章 天神链 2：薇（V）与太阳神（Ra）**（阶段⑨）
- V 的六项解锁条件（表格：现实 / 永恒 / 无限 / 膨胀时间 / 复制器 / 现实机器）
- V 的 run 目标与「符文骑士」
- Ra：四神与记忆系统
- 完成判据

**第 12 章 莱特拉与虚幻升级**（阶段⑨尾 / ⑩前置）
- IU15「理想之构」：`maxID1` 必须为 0（含 EC7 的副作用与跳过规则）
- 反物质指数门槛（MOD 缩放值，原版 1.5e12 不适用）
- 莱特拉：熵 / 维度上限 / 不稳定层级
- IU25「彻底抹除」：成本 + 必须先卸符文
- 完成判据：`Pelle.isUnlocked`

**第 13 章 佩勒：毁灭现实 → 终局**（阶段⑩）
- 进入前：**先导出存档备份**（不可逆）
- 毁灭现实禁用了什么（清单）
- 佩勒升级的购买顺序、裂缝、打击
- 终局判据：`endState` 公式与「反物质指数 1000」（表格给 14 档标记）
- 终局之后会发生什么（`END_STATE_MARKERS`）
- 完成判据：`player.isGameEnd === true`

**第 14 章 隐藏条件与卡点总表**（阶段⑪）
- 成就 147 → 天神页解锁的因果链
- 「先买 1 个时间维度才能换 TT」这条硬前置
- EC11/EC12 的研究分叉冲突
- IU15 与 EC7 的死结
- IU25 的卸符文前置
- 自动购买器总开关 = 一切自动化的前提
- 总卡点表：症状 → 原因 → 解决（收编现有 faq 10 条）

**附录 A 自动化对照表**（机制 / 模块 / 生效窗口 / 攻略怎么写）
**附录 B 关键数值与出处**（每个数字 → 文件:行号）
**附录 C 术语表**（简体中文基准，可引 `steam_guides` 的 60+ 缩写表并校正）
**附录 D 成就总表**（时机 / 成就名 / 要点，据 §7.6 新增）
**附录 E 中英译名对照**（据 §7.6 新增）

### 3.2 章节 → 必引源码与配置

| 章 | 覆盖阶段 | 必须引用的源码 / 配置 | 备注 |
|---|---|---|---|
| 0 | 全部 | `src/core/celestials/pelle/game-end.js`（`endState` / `isGameEnd`） | 终局判据唯一源 |
| 1 | ① | `src/core/dimensions/antimatter-dimension.js`（`buyMaxDimension` AB2 退化）、`src/game.js` `tryOrekiEarlyRoutine` | `oreki-tutorial.js:335` 已引 |
| 2 | ② | `src/core/dimboost.js`、`src/core/galaxy.js`、`src/core/tickspeed.js`、`src/core/oreki-keep-antimatter.js` | AD4 在 `dimboost.js` 的 `softReset` 判定 |
| 3 | ④ | `src/game.js` `breakInfinity` 前置、`src/core/autobuyers/autobuyer.js` `upgradeInterval`（×0.6 / ×2）、`src/core/oreki-break-infinity-gate.js`、`src/core/oreki-autobuy-break-infinity.js` | 32767 IP = sum(2^0..2^14) |
| 4 | ⑤ | `src/core/dimensions/infinity-dimension.js`（`UNLOCK_REQUIREMENTS[1]`）、`src/core/infinity-upgrades.js`、`src/core/replicanti.js`、`src/core/oreki-early-automation.js` | ID1 双门槛 |
| 5 | ⑤ | `src/core/secret-formula/challenges/normal-challenges.js`、`infinity-challenges.js`、`src/core/oreki-instant-challenges.js` | 挑战奖励表 |
| 6 | ⑥ | `src/core/time-theorems.js:114`（硬前置）、`src/core/secret-formula/eternity/time-studies/normal-time-studies.js`、`src/core/dimensions/time-dimension.js`、`src/core/oreki-eternity-automation.js`、`src/game.js:102/105`（AD8/AD9 常量） | 研究编号必须逐个核对 |
| 7 | ⑦ | `src/core/secret-formula/eternity/time-studies/ec-time-studies.js`（id/cost/requirement/`forbiddenStudies` 131、141）、`src/core/oreki-dilation-automation.js`（9→10→11→12 顺序与压现实） | 12 关成本：30/35/40/70/130/85/115/115/415/550/1/1 |
| 8 | ⑥ | `src/core/secret-formula/eternity/time-studies/dilation-time-studies.js`（DS1 三条前置）、`src/core/time-studies/dilation-time-study.js:54`（12900）、`:9`（`OREKI_DILATION_TT_DIVISOR = 1000`）、`src/core/dilation.js` | 必须在教程里说明 MOD 缩放 |
| 9 | ⑧ | `src/core/reality.js:119`（`isRealityAvailable`）、`src/core/reality-upgrades.js`、`src/core/glyphs/*`、`src/core/oreki-reality-automation.js`、成就 147（`secret-formula/achievements/normal-achievements.js:1070`） | RU 顺序 + 成就 147 |
| 10 | ⑨ | `src/core/celestials/teresa.js`（`pourRM`）、`effarig.js`、`enslaved.js`、`src/core/oreki-celestial-automation.js` | 灌注是"真实秒"语义 |
| 11 | ⑨ | `src/core/secret-formula/celestials/v.js:70-135`（六项条件 + `OREKI_V_UNLOCK_*` 65-67）、`src/core/celestials/ra/*` | 六项条件必须做成表 |
| 12 | ⑨/⑩ | `src/core/secret-formula/reality/imaginary-upgrades.js`（`OREKI_IU15_AM_EXP = 1e8` :49、`OREKI_IU25_COST = 5e9` :21）、`src/core/celestials/laitela/laitela.js`、`src/core/oreki-iu15-sprint.js`、`src/core/oreki-endgame-automation.js` | IU15 的 maxID1=0 死结 |
| 13 | ⑩ | `src/core/celestials/pelle/pelle.js`、`secret-formula/celestials/pelle-upgrades.js`、`src/core/celestials/pelle/game-end.js`（`OREKI_PELLE_END_OFFSET = 1`、`TARGET_EXP = 1e3`）、`src/core/oreki-endgame-automation.js` | 终局判据公式 |
| 14 | ⑪ | 上述全部 + `src/core/player.js:63`（`autobuyersOn: true` 默认） | 卡点表逐条给文件行号 |

### 3.3 已被 MOD 自动化、攻略应写「不需要手动操作」的部分

依据：`game.js:866-893` 的主循环 tick 顺序 `OrekiEarlyAutomation → OrekiEternityAutomation(tick/tickEternity) → OrekiRealityAutomation → OrekiCelestialAutomation → OrekiEndgameAutomation`，加上 `oreki-instant-challenges.js`、`oreki-dilation-automation.js`、`oreki-iu15-sprint.js`、`oreki-autobuy-break-infinity.js`。`[读码]`

| 机制 | 模块 / 位置 | 攻略怎么写 |
|---|---|---|
| 开局买维度 / 计数频率 / 提升 / 星系 / 首次坍缩 | AD7 `game.js tryOrekiEarlyRoutine` | 「不需要手点；手动点也不冲突」 |
| Break 的 IP 补足与间隔拉满、按 Break | AD5 / AD5b `oreki-break-infinity-gate.js` | 「唯一要你确认的是总开关」 |
| Break Infinity 升级 | `oreki-autobuy-break-infinity.js` | 「不用买，会自动买」 |
| ID1 的 1e8 IP 兜底与自动购买 | AD3 `game.js gainedInfinityPoints` / `tryFirstId1AutoUnlock` | 「不要手点大坍缩」 |
| 无限维度 / 无限升级 | AD6 `oreki-early-automation.js` | 「不用点 Max All」 |
| 时间维度 / TT / 时间研究 | `oreki-eternity-automation.js` | 「不用手动点研究树，但要看研究是否按预期点亮」 |
| C / IC / EC 进入即完成 | `oreki-instant-challenges.js` | 「进关即完成，不需要打」 |
| EC9~12 顺序、DS1、压现实 | `oreki-dilation-automation.js` | 「EC 会按 9→12 自动打；这段时间现实会暂停，属正常」 |
| 首次现实 / 现实循环 / RU / 符文 | `oreki-reality-automation.js` | 「现实会自动按 8s/15s 节奏进行」 |
| 特蕾莎灌注 / 天神 run / V 解锁 / 膨胀启动 | `oreki-celestial-automation.js` | 「灌注会自动做，不用按住」 |
| IU15 冲刺 | `oreki-iu15-sprint.js` | 「会尝试冲刺，失败会冷却重试」 |
| IU 购买 / 莱特拉 / IU25 / 佩勒 / 佩勒升级 | `oreki-endgame-automation.js` | 「终局链全自动，只需确认没被卡住」 |

**关键前提（必须写成第 3 章的第一条编号步骤）**：`player.auto.autobuyersOn` 默认 `true`（`player.js:63`），但玩家（或旧攻略）一旦关掉，**AD3/AD5/AD6/AD7 全部停止**（`oreki-tutorial.js:319` 已说明，但埋在「阶段突破」而不是操作步骤里）。当前教程把这条放在第 5 章开头，位置错了。

`【未核对】` `oreki-celestial-automation.js` 与 `oreki-endgame-automation.js` 是否也受总开关约束——两个文件头注释未明示，需读 `active` getter 才能定论。

---

### 3.4 章节 key 冻结表（**已被 R40G 落地版取代，见 3.4.1**）

> ⚠️ **本节为盘点阶段的提案，现已被 `src/core/oreki-tutorial-data.json` 的实际结构取代。**
> 请以 **3.4.1** 的 `chNN` 为准；本节保留只为说明「当初为什么建议 15 章」。

#### 提案：20 个 key（历史，已作废）

两端生成器（Web 的 `TUTORIAL_CHAPTERS`、Android 的章节生成器）必须用**同一套 key**，否则后期改名要返工。以下为建议冻结值：

| # | key | 标题（含进度坐标） | 绑定快照阶段 `stages` | 完成判据 `done()`（建议，落地前逐个核 API） |
|---|---|---|---|---|
| 0 | `intro` | 怎么用这份教程 | `[]` | `true` |
| 1 | `dims` | 开局：反物质与 8 个维度（10 AM ~ 1e130 AM） | `["early"]` | `AntimatterDimension(8).amount > 0` |
| 2 | `resets-early` | 计数频率·维度提升·星系（1e13 ~ 1.8e308 AM） | `["early"]` | `player.dimensionBoosts >= 1 && player.galaxies >= 1` |
| 3 | `first-infinity` | 第一次无限与打破无限（1.8e308 AM ~ 5e11 IP） | `["early","infinity"]` | `player.break === true` |
| 4 | `infinity-dims` | 无限升级·无限维度·复制器（1e8 ~ 1e308 IP） | `["infinity"]` | `InfinityDimension(1).isUnlocked` |
| 5 | `challenges` | 挑战：普通 C1~C12 与无限 IC1~IC8 | `["infinity"]` | `PlayerProgress.infinityChallengeCompleted()` |
| 6 | `eternity` | 第一次永恒与时间研究（1.8e308 IP → 1e17 EP） | `["eternity"]` | `player.eternities.gt(0) && player.timestudy.studies.length > 0` |
| 7 | `ec` | 永恒挑战 EC1~EC12（130 ~ 12900 TT） | `["eternity"]` | `EternityChallenge(12).isFullyCompleted` |
| 8 | `dilation` | 膨胀与 DS1（0 ~ 1e15 DT） | `["eternity"]` | `PlayerProgress.dilationUnlocked()` |
| 9 | `reality` | 现实：符文·现实升级·复兴（1e4000 EP → 1e6 RM） | `["reality"]` | `player.realities > 0 && Glyphs.active.length > 0` |
| 10 | `celestials-1` | 特蕾莎 → 鹿颈长 → 无名氏（1e6 ~ 1e49 RM） | `["celestials"]` | `Teresa.pouredAmount > 0`（章内再分三档） |
| 11 | `celestials-2` | 薇与太阳神（1e49 ~ 1e300 RM） | `["celestials"]` | `V.isUnlocked`【需核 getter 名】 |
| 12 | `laitela` | 莱特拉与虚幻升级（1e300 RM → 1e9 iM） | `["celestials"]` | `Pelle.isUnlocked` |
| 13 | `pelle` | 佩勒：毁灭现实 → 终局（10 AM ~ 1e1000 AM） | `["doomed"]` | `player.isGameEnd` |
| 14 | `hidden` | 隐藏条件与卡点总表 | `[]` | `—` |

附录（与章节同构，`kind: "appendix"`）：

| key | 标题 |
|---|---|
| `appendix-automation` | 自动化对照表（机制 / 模块 / 生效窗口） |
| `appendix-numbers` | 关键数值与出处（数值 → 文件:行号） |
| `appendix-glossary` | 术语表（AM/IP/EP/RM/TT/DT/EC/iM/TS/RU…） |
| `appendix-achievements` | 成就总表（时机 / 成就 / 要点） |
| `appendix-zh-en` | 中英译名对照 |

**`stageToChapter` 建议映射**（给两端共用，快照 6 阶段 → 章节）：

```
early      -> ["dims", "resets-early", "first-infinity"]
infinity   -> ["infinity-dims", "challenges"]
eternity   -> ["eternity", "ec", "dilation"]
reality    -> ["reality"]
celestials -> ["celestials-1", "celestials-2", "laitela"]
doomed     -> ["pelle"]
```

> 收敛原则：`key` 一旦冻结**不再改名**；标题可以改（标题里带进度坐标，随数值调整），key 不动。这样两端正文可以独立迭代，目录与深链不会失效。


### 3.4.1 实际落地的单源结构（`oreki-tutorial-data.json`，2026-10-30 现状）

盘点结束后 R40G 已落地 JSON 单源，**本章节树与 §3.1 的 15 章提案不同**，以实际文件为准。中间经过一次结构修正：EC 阶段原先没有归属章，team-lead 已插入 `ch09`，章节总数由 16 变 17，`ch10`~`ch16` 整体后移一位。

- 顶层：`schemaVersion: 1`、`updatedAt`、`note`（声明「唯一内容源」）、`chapters[17]`
- 每章字段：`id / title / subtitle / stageKey / draft / stageGoal / entry / steps[] / buyOrder[] / automation / challenges / numbers[] / done / next / traps / table / note`
  —— 与 §24.3 十字段一一对应，`numbers[].src` 带出处（符合 §24.7 第 2 条）。
- **id 用 `ch00`~`ch16`，没有 `key` 字段**；阶段绑定用 `stageKey`（`early/infinity/eternity/reality/celestials/doomed`，ch00 与 ch16 为 `null`）。

> **下表是快照，不是冻结值。** 章节数与 `draft` 每天在动（20:47 → 21:09 → 21:17 三版里，章数 16→17、`draft:false` 从 1 章涨到 7 章），任何写死的数字都会在几十分钟内过期。取现值的命令：
>
> ```
> node -e "const d=require('./web/AD-Oreki-Edition/src/core/oreki-tutorial-data.json');console.log('章数',d.chapters.length);for(const c of d.chapters)console.log(c.id,c.stageKey,c.draft?'draft':'已写',c.title)"
> ```
>
> 下表读取时刻：**2026-10-30 21:40 前后**。

| id | stageKey | 标题 | 覆盖 §24.2 阶段 | 快照状态（21:40） |
|---|---|---|---|---|
| ch00 | null | 开始之前 | 导览 | 已写（4 步 + 3 条数值） |
| ch01 | early | 开局：10 反物质到第一次维度提升 | ① | 已写（5 步 + 9 条数值） |
| ch02 | early | 维度献祭与第一个反物质星系 | ② | 已写（6 步 + 9 条数值） |
| ch03 | early | 第一次无限 | ④ | 已写（5 步 + 5 条数值） |
| ch04 | infinity | 无限升级与无限挑战 | ⑤ | 已写（7 步 + 7 条数值） |
| ch05 | infinity | 打破无限 | ④尾 / ⑤ | 已写（6 步 + 7 条数值） |
| ch06 | infinity | 无限维度与无限挑战补全 | ⑤ | 已写（6 步 + 7 条数值） |
| ch07 | eternity | 复制器与首次永恒 | ⑤ / ⑥ | `draft`，未写正文 |
| ch08 | eternity | 时间研究与永恒里程碑 | ⑥ | `draft` |
| ch09 | eternity | 永恒挑战（EC1~EC12） | ⑦ | **本次交付正文（见 §3.4.3）** |
| ch10 | eternity | 时间膨胀 | ⑥ | `draft` |
| ch11 | reality | 现实与符文 | ⑧ | `draft` |
| ch12 | reality | 复兴树、自动机与黑洞 | ⑧ | `draft` |
| ch13 | celestials | 天神（一）：特蕾莎、鹿颈长、无名氏 | ⑨ | `draft` |
| ch14 | celestials | 天神（二）：薇、太阳神、莱特拉 | ⑨ | `draft` |
| ch15 | doomed | 佩勒与终局 | ⑩ | `draft`（1 条数值） |
| ch16 | null | 隐藏条件与成就总表 | ⑪ | **本次交付正文（见 §3.4.3）** |

**§24.2 第 ⑦ 阶段（EC1~EC12）缺章问题已解决**：`ch09` 独立成章，章节标题为「永恒挑战（EC1~EC12）」。判定依据成立——EC 单项预算约 1.43 万汉字，比整个永恒阶段（0.79 万）还大，塞进 `ch08` 写不下；趁当时只有 `ch00`~`ch06` 有正文时改，改动成本最低。

**仍存在的一处结构问题**：§24.2 第 ③ 阶段（自动购买器）没有专章，靠每章的 `automation` 字段分散承载。这本身符合字段设计意图，但**必须保证 ch01 / ch03 / ch05 三章的 `automation` 字段真的写到「总开关 + 逐个开关 + 间隔升级」**，否则第 ③ 阶段会从「有但不含操作步骤」掉回「只有一句话」。

**`stageToChapter`（按实际 `stageKey` 统计，供两端共用）**：

```
early      -> [ch01, ch02, ch03]
infinity   -> [ch04, ch05, ch06]
eternity   -> [ch07, ch08, ch09, ch10]
reality    -> [ch11, ch12]
celestials -> [ch13, ch14]
doomed     -> [ch15]
null       -> [ch00, ch16]
```

> 结论：key 不需要另造，直接用 `chNN`；我 §3.4 提案里的 `dims/ec/pelle` 等 slug **作废**，避免两端各拿一套 key。

### 3.4.2 章节键 ↔ 我提的 20 个章节单元（缺失章节清单最终形态）

左列是我第一轮提的 20 个单元（15 章 + 5 附录，均已作废，只用于对账），中列是实际落地的 `chNN`。**「覆盖方式」一列写清是整章对应、拆成两章、还是两单元挤在一章。**

| # | 我提的单元 | 内容 | 落地章节 | 覆盖方式 |
|---|---|---|---|---|
| 0 | `intro` | 怎么用这份教程 | ch00 | 整章对应 |
| 1 | `dims` | 开局：反物质与 8 个维度 | ch01 | 整章对应 |
| 2 | `resets-early` | 计数频率 / 维度提升 / 星系 | ch02 | 整章对应 |
| 3 | `first-infinity` | 第一次无限与打破无限 | ch03 + ch05 | **拆成两章**（首次无限在 ch03，Break 单独成 ch05） |
| 4 | `infinity-dims` | 无限升级 / 无限维度 / 复制器 | ch04 + ch06 | **拆成两章**，且复制器被移到 ch07 |
| 5 | `challenges` | 普通挑战 C、无限挑战 IC | ch04 + ch06 | 两章各写一半（ch04 写 IC，ch06 写 C） |
| 6 | `eternity` | 第一次永恒与时间研究 | ch07 + ch08 | **拆成两章** |
| 7 | `ec` | 永恒挑战 EC1~EC12 | ch09 | 整章对应（本轮新增） |
| 8 | `dilation` | 膨胀与 DS1 | ch10 | 整章对应 |
| 9 | `reality` | 现实 / 符文 / 现实升级 / 复兴 | ch11 + ch12 | **拆成两章**（符文与复兴分开） |
| 10 | `celestials-1` | 特蕾莎 → 鹿颈长 → 无名氏 | ch13 | 整章对应 |
| 11 | `celestials-2` | 薇与太阳神 | ch14 前半 | 与 12 合章 |
| 12 | `laitela` | 莱特拉与虚幻升级 | ch14 后半 | **与 11 合章**，单章要装两个天神，偏薄 |
| 13 | `pelle` | 佩勒：毁灭现实 → 终局 | ch15 | 整章对应 |
| 14 | `hidden` | 隐藏条件与卡点总表 | ch16 | 整章对应 |
| A1 | `appendix-automation` | 自动化对照表（机制 / 模块 / 生效窗口） | 无独立载体 | **没有归属**：内容散在每章 `automation` 字段，无法全局检索 |
| A2 | `appendix-numbers` | 关键数值与出处 | 无独立载体 | **没有归属**：内容散在每章 `numbers` 字段，同上 |
| A3 | `appendix-glossary` | 术语表 | `apx_terms` | 附录键对应 |
| A4 | `appendix-achievements` | 成就总表 | `apx_achievements` + ch16 | 附录与章节各写一份（附录是全表，章节是顺手拿法） |
| A5 | `appendix-zh-en` | 中英译名对照 | `apx_bilingual` | 附录键对应 |
| — | （新增，原提案没有） | 记数法说明 | `apx_notation` | 本轮新增 |
| — | （新增，原提案没有） | 卡点速查表 | `apx_blockers` | 本轮新增 |

**结论（这就是缺失章节清单的最终形态）**：

1. **17 章里没有「孤儿章」**——每个 `chNN` 都能对上至少一个单元。
2. **两个单元没有独立载体**：`appendix-automation` 与 `appendix-numbers`。它们的价值是「一页查全」，散进字段后就查不全了。若后续要补，最省事的做法是各加一个附录键（`apx_automation` / `apx_numbers`），数据直接从各章字段聚合生成，不新增人工维护。
3. **一处合章偏薄**：`celestials-2` 与 `laitela` 挤在 ch14。莱特拉带暗物质维度、虚幻升级、符文炼金、连续统、奇点五套机制，与薇 + 太阳神装在同一章会把单章推到 1 万汉字以上。若要拆，建议 `ch14` 保留薇与太阳神、新增 `ch14b` 给莱特拉（总数变 18 章），需要 team-lead 决定，本文不动 JSON。
4. **六条 MOD 特有内容各自归属**：

| MOD 特有内容 | 归属章 | 依据 |
|---|---|---|
| 终局判据 `1e1000`（`OREKI_PELLE_END_TARGET_EXP = 1e3` 即指数 1000） | ch15 | `src/core/celestials/pelle/game-end.js:59-60` |
| 薇的三项解锁缩放（60 现实 / 1e30 膨胀时间 / 1e20000 复制器） | ch14 | `src/core/secret-formula/celestials/v.js:65-67` |
| 虚幻升级 15 的编号与 1e8 门槛 | ch14 | `OREKI_IU15_AM_EXP` |
| 虚幻升级 25 的 5e9 成本 | ch14 | `OREKI_IU25_COST` |
| 现实解锁「全部前期成就」的豁免（EC11 与 EC12 各 5 次后生效） | ch10（判定）+ ch09（前置链条） | `src/core/secret-formula/eternity/time-studies/dilation-time-studies.js:69-78` |
| 膨胀研究 1 的门槛 | ch09 结尾 + ch10 开头 | 见下条更正 |

**关于 DS1 的数值更正（重要）**：我上一轮在 §7.5 写过「12900 TT，bootstrap 窗口内 ÷1000 → 13 TT」，**这一条是错的，本轮已用源码与实测双重核对**：

- `÷1000` 只作用于**购买价格**，不作用于累计门槛。`src/core/time-studies/dilation-time-study.js:28-52` 的 `cost` getter 里才有 `Math.floor(base / OREKI_DILATION_TT_DIVISOR)`，`OREKI_DILATION_TT_DIVISOR = 1000`（同文件 `:9`）。
- 解锁门槛写死在 `get totalTimeTheoremRequirement()`，返回常量 `12900`，不参与任何缩放（`src/core/time-studies/dilation-time-study.js:54-56`）；判定在 `src/core/secret-formula/eternity/time-studies/dilation-time-studies.js:3-19`。
- 实测证据：探针 `ttNeed` 在真实新档里恒为 **12900**（`web/_tools/_r36d/_r36d-dil-*.jsonl`），`ttMaxL` 最高到 6.90（约 8e6 时间之理），门槛早就过。
- 所以正确写法是：**门槛 12900 累计时间之理不变，窗口内购买价 5000 → 5 时间之理**。DS1 归 ch09 结尾 / ch10 开头。
- 顺带：`12900 / 1000 = 12.9`，`Math.floor` 得 12 不是 13，所以「13」这个数在代码里也不成立（若真要缩放门槛，写法也会是 12）。

## 4. 数据可行性判断

### 4.1 现有格式能不能承载「编号步骤 + 表格 + 数值 + 章节进度」

| 需求 | 弹窗版现状 | 结论 |
|---|---|---|
| 编号步骤 | `points[]` → `<ul><li>{{ point }}</li>` | **不能**。只能靠字符串里手写「1. 」假装，无缩进、无嵌套、无勾选 |
| 表格 | 无数据结构、无样式 | **不能** |
| 数值强调（如 1e1100、EC11） | 无内联标记 | **不能**（写 `**1e1100**` 会原样显示） |
| 章节进度 | 只有 6 阶段三态行 | **不能**按章节标记完成 |
| 折叠 / 长章分页 | 无 | **不能**，50vh 面板内靠滚动 |

→ **结论：必须扩数据结构，否则写不出 §24.3 的手册。** 这是硬约束，不是优化项。

### 4.2 最小改动方案（不动游戏逻辑，只动教程）

**① 数据结构（`src/core/oreki-tutorial.js`）** —— 向后兼容，旧字段保留：

```js
{
  key, title, subtitle,
  stages: ["eternity"],        // 新增：绑定快照 key，用于"跳到当前阶段"与进度
  done: () => PlayerProgress.eternityUnlocked(),  // 新增（可选）：章节完成判定
  sections: [{
    heading,
    kind: "points" | "steps" | "table" | "note" | "checklist",  // 新增，默认 points
    points: [],                 // 原有
    steps: [],                  // 新增：字符串数组 → <ol>
    table: { head: [], rows: [[]] },  // 新增
    note: "",                   // 新增：灰字提示
    checks: [{ text, done: () => bool }]  // 新增（可选）：章内勾选项
  }]
}
```

**② 渲染（`src/components/modals/OrekiTutorialModal.js:152-168`）** —— 在现有 `<ul>` 分支前加 3 个 `v-if`：

- `kind === "steps"` → `<ol class="c-oreki-tut__steps-list">`（模板约 +12 行）
- `kind === "table"` → `<div class="c-oreki-tut__table-wrap"><table>`（约 +14 行）
- `kind === "note"` → `<div class="c-oreki-tut__note">`（约 +4 行）

**③ 样式（`public/stylesheets/oreki.css`，插在 507–533 段之后）** —— 约 40 行：

- `ol`：`list-style: decimal`、`padding-left: 2rem`、`li { margin-bottom: .4rem }`
- `table`：`border-collapse: collapse`、`th/td { padding: .3rem .6rem; border: .1rem solid rgba(255,255,255,18%) }`、外层 `overflow-x: auto`（窄屏保命，避免 §19 的溢出问题）
- `.c-oreki-tut__note`：左侧色条 + 小字号（沿用 1408–1422 的样式语言）

**④ 交互补齐（三条小改，各 3~8 行）**：

- `goTo()`（58–61）末尾加 `this.$refs.scroll.scrollTop = 0`（给 `.c-oreki-tut__scroll` 加 ref）
- `created()` 里按 `getTutorialStageSnapshot().key` 映射到 `chapters[i].stages.includes(key)`，把 `index` 初始化到匹配章（解决「永远停在第 1 章」）
- nav 按钮显示章内 `done()` 的 ✔/○（复用现有 `.c-oreki-tut__nav-btn--active` 语言）

**⑤ 去重（建议同轮做，否则两条教程继续分叉）**：
`src/components/tutorial/OrekiTutorial.js` 改为读同一份 `TUTORIAL_CHAPTERS` 生成 HTML（约 326 行 → 60 行），删掉 8 个手写常量。收益：一处改动两端同步、H2P 页签立刻获得编号步骤与表格能力、消除「两个入口两种说法」。

**⑥ 懒加载（体量到 5 万字后必须做）**：
把正文从 `src/core/oreki-tutorial.js` 拆到 `src/core/tutorial/chapters/*.js`，`oreki-tutorial.js` 只留 `getTutorialStageSnapshot()` 与 `import()` 入口；`OrekiTutorialModal` 的 `mounted()` 里 `await import()` 后填充 `chapters`。同时给 `OrekiTutorial.render()` 加结果缓存（否则 `H2PModal` 每敲一个字重建整页字符串，见 §1.7）。

**不建议**改成 markdown / HTML 字符串大礼包：会失去「按字段渲染」的能力（章节进度、图表、Android 复用），也会让 §24.6 的双端同步变成人工比对两坨 HTML。

### 4.3 体量估算与首屏影响

| 项 | 现状 | 补齐后（估） |
|---|---|---|
| 章节数 | 7 | **15（含第 0 章）+ 5 附录** |
| 小节数 | 39 | 约 **120~150**（每章 8~10 个十字段小节） |
| 条目 / 步骤数 | 170 条 | 约 **600~900 条**（含编号步骤与表格行） |
| 正文字数 | 22,485 字符 / 7,601 汉字（含注释） | 约 **5 万汉字**（中文 1 汉字 = 1 字符，故 5 万字符即 5 万汉字；区间 4~6.5 万） |
| 文件字节 | 40KB | 约 **150KB（120~200KB）** |
| 是否懒加载 | ❌ 随主包（`main.js → globals.js → modal.js:35 → OrekiTutorialModal → oreki-tutorial.js`） | **建议改为 `import()` 首次打开时加载** |

**影响判断**：
- 现在 40KB 文本进初始模块图无感；**到 150KB 时**，多出约 110KB 源码要在首屏解析（无压缩的 ES module，不走 bundler，是真源码体积）。对 4G 首屏与低端安卓 Chrome，是可见成本。
- 更实际的风险不是下载而是**渲染**：`OrekiTutorial.render()` 每次 H2P 弹窗重渲染都重建整页字符串（`H2PModal.js:134`），5 万字时代会在搜索框输入时卡顿。**必须先做缓存/懒加载，再补内容**——否则教程写完当天就是新的性能问题。
- 结论：**顺序应为「先扩结构 + 拆包 + 缓存（半天级）→ 再分章补正文（按 11 阶段分批）」，不要先堆文字后改结构**，否则 600 条文案要迁移两次。

---

## 5. 风险与未核对项

| 项 | 状态 | 说明 |
|---|---|---|
| 移动端 320/360px 下表格与长文是否溢出 | `【未核对】` | 表格方案里已用 `overflow-x: auto` 兜底，但未实测；按 §19 需 44px 触控与不溢出双验收 |
| H2P 版 `v-html` 渲染表格的实际表现 | `【未核对】` | 全仓无 `table` 教程样式，需实际渲染确认 |
| `oreki-celestial-automation` / `oreki-endgame-automation` 是否受总开关约束 | `【未核对】` | 只看文件头注释不够，需读 `active` getter；影响「不需要手动操作」的表述是否成立 |
| IC1~IC8、RU1~RU25、佩勒升级的具体顺序与数值 | `【未核对】` | 本报告只给篇目与引用文件，未逐条核对奖励数值；写正文时必须逐个查源码 |
| EC 每关的前置研究编号是否与当前 MOD 一致 | `【读码】` | 已核 `ec-time-studies.js` 的 `id/cost/requirement/forbiddenStudies`；目标数值（`secondary.required`）未逐关展开 |
| Android 端教程内容 | 不在本报告范围 | 见 `agent-f-tutorial-android` 的报告；此处只提示：Android 是 smali + 资源字符串独立维护（`scripts/payload/smali/.../tutorial/TutorialActivity.smali`），Web 补完后必然产生第二次分叉，需在 §24.6 的双端同步机制里解决 |

---

## 6. 交付动作（按性价比排序）

1. **先扩结构与拆包**（半天）：`sections[].kind/steps/table/note` + 三处模板分支 + 40 行 CSS + `goTo` 重置滚动 + 按阶段初始化 index + 正文 `import()` + `render()` 缓存。
2. **并轨**（半天）：`OrekiTutorial.js` 改为消费 `TUTORIAL_CHAPTERS`，删 8 个手写常量，消除双入口两种说法。
3. **分三批补正文**：批 1 = 第 0~5 章（开局到无限，覆盖 §24.2 ①②③④⑤）；批 2 = 第 6~9 章（永恒 / EC / 膨胀 / 现实，覆盖 ⑥⑦⑧）；批 3 = 第 10~14 章 + 附录（天神 / 终局 / 隐藏条件，覆盖 ⑨⑩⑪）。每批写完必须回填附录 B（数值 → 文件行号），否则违反 §24.7 第 2 条。
4. **本轮已交付的两块正文**（不并入 JSON，由 team-lead 合并）：`R40E-ch09-ch16.json`（ch09 永恒挑战 + ch16 隐藏条件与成就总表，两章十字段齐全）与 `R40E-附录草稿.md`（`apx_terms` / `apx_achievements` / `apx_notation` / `apx_bilingual` / `apx_blockers` 五节）。两者都留了 `src` 行号，合并时直接跑 `validate_tutorial.mjs` 即可。
5. **拿 Steam 语料当素材库，不当模板**（§7）：`steam_guides/` 的 12 篇可直接取材「每章动作序列 / 成就清单 / TT 预算表」，但**所有数值必须回 `src/` 复核**——终局、V、IU15/25、现实解锁、DS1 五处已被 MOD 改写（§7.5 表），照抄会写出错误攻略。

---

## 7. Steam 社区指南对照（第二轮补充数据源）

数据源：Steam 社区 **App ID 1399720**（Antimatter Dimensions 的社区枢纽；`1391520` 是商店页 appid，两者不同，见 7.1 坑 1），经 `http://127.0.0.1:7897` 代理抓取。
落盘目录：`web/_tools/_r40/steam_guides/`，共 **12 篇**、合计 **347,819 字符**（其中汉字 **149,234**）（其中 9 篇中文正文贡献全部汉字，3 篇英文为补充）；抓取器 `_fetch.py`（可复现），索引 `_index.json`。

### 7.1 抓取过程中的四个坑（给后续复现的人）

1. **不是地区封锁，是 App ID 用错了**（此条由 `agent-f-tutorial-android` 指出，本轮已复核）：`/app/1391520/guides/` 会 302 到 `store.steampowered.com/app/1391520`——因为 **1391520 是商店页 appid**；社区枢纽挂在 **1399720** 下，`/app/1399720/guides/` 返回 **200 / 91,729 字节**，页面含 `View All (29)` 与 10 张卡片，`data-publishedfileid="(\d+)"` 可直接正则抠 ID，卡片标题在 `class="workshopItemTitle"` 内。`[实测]` 结论：**列表页可用，不必靠搜索猜 ID**；本报告前 9 篇是走弯路抓的，方法本身没错但低效。
2. **限流**：连续请求会 429（一次重试 60s→120s→180s 才过）。抓取器已改成间隔 30s + 指数退避。
3. **表格不是 `<table>`**：Steam 新表格是 `div.bb_table / bb_table_tr / bb_table_th|td`，直接转文本会变成「一格一行」。`_fetch.py` 的 `convert_bb_tables()` 先做括号配平再转 Markdown 表格，EC 顺序表与成就表现在可读。
4. 该目录里另有 `guide_*.md` / `raw_*.html`（20:01–20:03 生成）与 `extract.py`，**是 team-lead 自己抓的**，不是 `agent-f-tutorial-android` 的产物（他只把 4 个页面抓到 `/tmp`，从未写入仓库）。team-lead 已写 `steam_guides/MANIFEST.md` 定死归属：本报告第 7.2 节那批 `steam_guide_*.md`（命名规范、含 `_index.json`）为**权威**，`guide_*.md` / `raw_*.html` / `extract.py` 为历史遗留、不得引用。同批清理掉的还有 `sc.jar`（内含 Steam 登录 sessionid，已删除）与 `jina_*.txt`。

**表格导出的确切格式（给 Android 消费方，可直接按此解析）**：

```
| # | 挑战 | 挑战内路径 | IP 目标 |
| --- | --- | --- | --- |
| 1 | EC1x1 | 无限维度 | 1e1800 |
| 5 | EC5x1 | — | 1e750 |
```

- 标准 GitHub 风格管道表；表头下一行固定是 `| --- | --- |` 分隔行（无对齐冒号）。
- 每行一条记录，单元格前后各一个空格；**空单元格输出为两个空格**（`|  |`），解析后会得到空串。
- 单元格内不含未转义的 `|`（原文没有），可以安全地 `line.strip().strip('|').split('|')` 后 `strip()`，并跳过第 2 行。
- 表格前后各有一个空行，与段落分开。

### 7.2 抓取清单

| # | 标题 | ID | 作者 | 发表 / 更新 | 覆盖阶段 | 全文/分页 | 章节数 | 字符 |
|---|---|---|---|---|---|---|---|---|
| 1 | 反物质维度全流程攻略 | 3181166341 | Fanytastic | 2024-03-12 / 同日 | ①→⑩（到 Cel7 + 终局） | 单页 26 节 | 26 | 95,885 |
| 2 | 反物质维度现实前中文攻略 | 2902999812 | Fanytastic | 2022-12-17 / 8-20 | ①→⑧（到首次现实） | 单页 40 节 | 40 | 73,529 |
| 3 | 反物质维度现实更新中文攻略 | 2917210272 | Fanytastic | 2023-01-12 / 8-8 | ⑧→⑩（现实到终局）+ 5 附录 | 单页 42 节 | 42 | 88,799 |
| 4 | 反物质维度现实前增补攻略 | 2936619880 | Fanytastic | 2023-02-20 / 8-8 | ④→⑧（补 2020–2022 改动） | 单页 10 节 | 10 | 22,950 |
| 5 | 中文攻略（一）：从零到无限 | 3817468561 | 白开水不加糖 | 2026-10-10 | ①→④ | 单页 17 节 | 17 | 9,444 |
| 6 | 中文攻略（二）：永恒 | 3817477040 | 白开水不加糖 | 2026-10-10 | ⑥ | 单页 7 节 | 7 | 4,328 |
| 7 | 中文攻略（三）：永恒挑战 | 3817477410 | 白开水不加糖 | 2026-10-10 | ⑦ | 单页 6 节 | 6 | 9,689 |
| 8 | 中文攻略（四）：时间膨胀与现实 | 3817477688 | 白开水不加糖 | 2026-10-10 | ⑥后半 → ⑧ | 单页 8 节 | 8 | 5,195 |
| 9 | 反物质维度永恒挑战速查表 | 3817478070 | 白开水不加糖 | 2026-10-13 | ⑦（EC 顺序 / 研究树 / 用时表） | 单页 9 节 | 9 | 16,689 |
| 10 | Eternity + Eternity Challenges | 2909710573 | Ninjatsu | 2022-12-30 | ⑥⑦（EC 规划权威源） | 单页 1 节（**正文只有一个 Google 表格外链**） | 1 | 1,464 |
| 11 | Time Theorems and how to use them Correctly | 2963610414 | 【未记】 | 【未核对】 | ⑥（TS 用法逐个） | 单页 69 节 | 69 | 16,428 |
| 12 | Secret Achievement Guide | 2907622156 | 【未记】 | 【未核对】 | ⑪（隐藏成就约 30 条） | 单页 3 节 | 3 | 3,419 |

- 「全文/分页」：12 篇**全部是单页多节**（Steam 的 `subSection`），没有真正分页，抓一次即完整。
- 第 10 篇（Ninjatsu）正文只有一句 + 表外链（Google Sheets），**不能直接引用为正文**，但它是中文速查表（第 9 篇）的数据源，引用时应注明「按 Ninjatsu 表 v2.6 转写」。
- 第 11 篇是英文 TS 用法长文（69 节），可作为第 6 章「时间研究」的英文交叉校对源。
- 第 12 篇列出约 30 条隐藏成就的触发条件，**直接对应我方 §24.2 第 ⑪ 阶段（目前完全缺失）**，是补齐「隐藏条件」章最省力的素材。
- 最新一代（5–9，2026-10 发布）自述基于 **AD Wiki Guide + Ninjatsu 永恒挑战表格 v2.6** 重写，术语取自「Steam 版简体中文汉化补丁」——是与我们术语表对齐的最佳参照。
- 体量对照（两种口径都算过，比值一致）：**34.8 万「字符」≈ 14.9 万「汉字」**；我们现有两套教程合计 **2.2 万字符 ≈ 1.0 万汉字**（`oreki-tutorial.js` 7,601 汉字 + `OrekiTutorial.js` 2,429 汉字，含注释）→ **约 1:15**。这不是要求抄到 15 万字，而是说明「手册级」的密度基准；首版目标 5 万汉字 ≈ 素材的 1/3，属于「浓缩手册」。

### 7.3 成熟攻略的章节主轴（决定我们的章节该怎么切）

以《全流程攻略》（26 节）为主干，章节名是**「重置层 + 货币区间」**：

```
一、无限（10 – 1e308 AM）       二、无限升级（1 – 3e4 IP）
三、打破无限（3e4 – 5e11 IP）   四、无限挑战（5e11 – 1e140 IP）
五、复制器（1e140 – 1e308 IP）  六、早期永恒（1 – 1e17 EP）
七、早期 EC（130–330 TT）       八、中期 EC（330–860 TT）
九、后期 EC（860–12900 TT）     十、前期时间膨胀（0 – 1e15 DT）
十一、后期时间膨胀              十二、早期现实（2–30 REAL）
十三、完成现实升级（1e4–1e6 RM）
十四、Cel1（1e6–1e21 RM）…二十、Cel7（拆 5 小节到终局）
```

三条可复用规律：
1. **每章标题自带进度坐标**（货币量级或次数），玩家看界面数字就知道「我在第几章」。我们的 7 章标题（「自动化」「阶段突破」「Mod 专属机制」）**一个坐标都没有**。
2. **一章 = 一个重置层的一段，而不是一个机制**。我们把「维度/提升/星系」压进 1 章、EC 0 章、Cel1~Cel7 0 章。
3. **每章末尾固定有「本阶段成就清单」**（表：时机 / 成就 / 要点），9 篇里 5 篇都有。我们完全没有成就维度的内容。

### 7.4 章节级缺口（Steam 章节 → 我们现有章节）

| 指南的章节单元 | 指南覆盖内容 | 我们的对应 | 章节级结论 |
|---|---|---|---|
| 一、无限（10–1e308 AM） | 维度 / 献祭 / 提升 / 星系 / 首次坍缩，每个量级都有动作与成就 | `basics`（4 小节 / 12 条） | 单元对得上，**密度差约 10 倍**（指南 17 节 vs 我们 4 小节） |
| 二、无限升级 | 逐条无限升级的购买时机与 IP 阈值 | 无 | **缺章** |
| 三、打破无限 | BI 升级顺序 + 自动购买器逐档设置（866 / 950 / 2.2e3 IP 等） | 无（`faq` 3 条） | **缺章** |
| 四、无限挑战 | IC1~IC8 逐个的进入条件与收益 | 无 | **缺章** |
| 五、复制器 | 复制器解锁、星系兑换、相关升级 | H2P 1 条要点 | **缺章** |
| 六、早期永恒 | 里程碑、EU、TS 主线 | `breakthrough`（机制向，非操作向） | 有内容但**没有章节位置** |
| 七~九、EC 三段 | 顺序表 + 每关研究树 + TT 预算 + 成就 | 无（H2P 1 句） | **缺 3 章**（可按 TT 区间压成 1 章 + 1 张表） |
| 十~十一、时间膨胀 | DS1、速子、膨胀升级顺序 | 无 | **缺章** |
| 十二~十三、现实与 RU | 首次现实、RU1~25、符文配置、Perk | H2P 4 条 + 快照 4 步 | **缺章** |
| 十四~二十、Cel1~Cel7 | 每位天神 1 章（符文配置 / 解锁判据 / 成就） | H2P 7 条要点 | **缺 7 章**（可压成 3 章） |
| 附录（缩写 / 隐藏成就 / 记数法 / 译名） | 4~5 个附录 | 无 | **缺附录** |

**结论（章节级，不是内容级）**：指南的 20 个章节单元里，我们只有 **2 个**能对上（`intro` / `basics`）；其余 5 章（`automation` / `stages` / `breakthrough` / `mod` / `faq`）在指南的进度轴上**没有位置**——它们是「机制说明 + Mod 差异 + 排障」，本质属于附录。所以缺口不是「写得太简略」，而是**缺了「按进度区间命名的正文层」，把附录当成了正文**。这也解释了为什么新手打开教程找不到「我现在该干嘛」。

### 7.5 指南与代码的冲突（一律以代码为准）

| 项 | Steam 指南写的 | 本 MOD 实际（源码） | 处理 |
|---|---|---|---|
| 终局判据 | 「剧终（大约 ee15.955 反物质）」，即指数约 9e15 | `OREKI_PELLE_END_TARGET_EXP = 1e3`、`OREKI_PELLE_END_OFFSET = 1`，`endState>=1 ⟺ 反物质指数 = 1000`（`celestials/pelle/game-end.js:12-14, 68-70`） | **必须写 1×10^1000** 并注明是 MOD 缩放；照抄指南会让玩家等一个永远到不了的数 |
| V 解锁 | 「现实次数 10000」「膨胀时间 1e320」「复制器 1e320000」 | `OREKI_V_UNLOCK_REALITIES = 60`、`..._DILATED_TIME = 1e30`、`..._REPLICANTI = 1e20000`；其余三项未改：永恒 1e70 / 无限 1e160 / RM 1e60（`secret-formula/celestials/v.js:65-67, 76-135`） | 六项做成表，标注哪三项被缩放 |
| IU15 理想之构 | 「iU35，到达 e1.5e12（ee12.176）反物质」 | 编号 **IU15**，门槛 `OREKI_IU15_AM_EXP = 1e8`（`secret-formula/reality/imaginary-upgrades.js:49, 213-216`） | 编号与数值都要改；「始终没有 ID1」的前提不变 |
| IU25 彻底抹除 | 原版成本 1.6e15 | `OREKI_IU25_COST = 5e9`（同上 `:21`） | 写 5e9 |
| 现实解锁 | 「1e4000 EP + 前 13 行全部成就」 | `TD8 已买 && maxEP ≥ 1e4000 && (首个 Perk \|\| 全部 pre-Reality 成就 \|\| (EC11 与 EC12 全满 && 未解锁现实))`（`dilation-time-studies.js:45-55`，豁免函数 `:81-88`） | **MOD 用 EC11/EC12 满级替代了「13 行成就」**，这是最容易卡住新手的一条，必须写 |
| 膨胀 DS1 | 「12900 TT」 | 门槛 **12900 不变**；只有购买价 ÷1000（5000 → **5 时间之理**）（`time-studies/dilation-time-study.js:9, 28-52, 54-56`；`dilation-time-studies.js:3-19`；实测 `ttNeed = 12900`） | 写「累计 12900 时间之理 + 窗口内只花 5 时间之理」，不要写 13 |
| EC1 前置 | 「20000 次永恒、30 TT」 | 一致：`20000 + min(completions,4)×20000`、cost 30（`ec-time-studies.js:5-16`） | 可直接引用；其余 11 关数值未与指南逐条比对 `【未核对】` |
| 通用阈值 | 1.8e308 无限、1e308 IP 才能永恒、1e4000 EP 才能现实 | 与代码一致（`1.797...e308`） | 可引用 |

> 注：9 篇指南全部基于**原版**（含 2026-10 的新版系列）。凡被 MOD 缩放的数值，教程必须同时给「原版值」和「本版值」并标明，否则玩家拿指南一对就懵。

### 7.6 对 §3 章节骨架的三条修正（据指南校准）

1. **章节标题加进度坐标**：`第 4 章 打破无限（3e4 ~ 5e11 IP）`、`第 8 章 永恒挑战 EC（130 ~ 12900 TT）`。只改标题、不动结构——但这条直接决定玩家能否自己定位。
2. **每章末尾固定加「本阶段成就清单」小节**（表：时机 / 成就名 / 达成要点）。指南 5 篇都有，我们 0 处；成就又是长期倍率来源（`oreki-tutorial.js:249` 只有一句「成就提供额外倍率」）。
3. **附录从 3 个扩到 5 个**：术语表（指南（一）/（四）已有 60+ 缩写，可引用后按 MOD 校正）、成就总表、记数法说明、中英译名对照（`2917210272` 附录一）、卡点表。

章节总数不变：**15 章 + 5 附录**（原 3 附录 + 成就总表 + 译名对照）。体量估算不变（5 万字级）——对照 14.9 万汉字原始语料仍属「浓缩手册」，符合「不需要搜攻略」而非「替代 wiki」的定位。
