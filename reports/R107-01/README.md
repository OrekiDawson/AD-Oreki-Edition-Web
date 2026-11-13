# R107-01 · Web 行为等价与体验定向验收报告（子 Agent G / web-parity）

- 轮次：R107-01（2026-11-13 夜，DeepSeek 低谷时段）
- 仓库：`web/AD-Oreki-Edition`（独立 Git）；分支 `main`，HEAD `1d1f7ae824884f2efc53cff69096a662bc3f8499`；**未 commit / 未 push**（Lead 统一提交）
- 本轮工作区改动：仅 `reports/R107-01/`（新增报告、验收脚本、证据）；**生产代码 0 改动**（未发现需要修复的真实缺陷）
- 环境：Playwright 1.65.0 原生 API + Chromium 158.0.8127.18；Pixel 7 移动上下文 412×839、DPR 2.625、`isMobile`、`hasTouch`、zh-CN、Android Chrome UA；本地静态服务（`serve` 逻辑内置于验收脚本）
- 约束遵守：真实全新 browser context；只做真实 UI 点击/输入；不写任何 `player` 进度字段；不改游戏时间源；存档仅来自本轮真实游玩的 UI 导出

---

## 1. 结论摘要

| 项目 | 结果 | 说明 |
|---|---|---|
| S0 关闭新闻 | **PASS** | 新闻 DOM 节点 0；正文无「新闻」；视觉效果页无新闻入口 |
| S1 无意义切页 | **PASS** | 无输入 60 s 自动切页 **0 次**；停留「选项→游戏玩法」25 s 期间业务仍以统一节拍执行且无强制切页 |
| S2 阶段解锁显示 | **PASS** | 新档无无限/永恒/现实入口；首次大坍缩后「无限」入口 **24 ms** 内出现（不刷新），永恒/现实仍不出现 |
| S3 自动购买器 | **PASS** | 总开关立即停止；原版 `autobuyersOn` 不被改动；1 s/60 s 间隔真实生效；0→1、999→60 边界钳制；刷新持久化；手动点击触发 60 s 让路；阶段门禁语义正确 |
| S4 阶段切换后的自动购买器 | **PASS** | 真实运行到首次永恒（S4 等待 350 s），永恒入口无刷新出现、执行层阶段切换并执行永恒层任务，现实入口仍未出现 |
| **定向验收合计** | **49/49 PASS** | `result.json` 全部检查 PASS，pageerror 0 |
| 180 分钟真实墙钟通关 | **FAIL（两个真实新档跑次都未通关）** | 默认 10 s 主跑：180 min 时 realities=15、EP e3683；间隔 1 s A/B：60 min 时同样 realities=15、EP e3683。详见 §5/§6 |
| 180 分钟瓶颈（本轮新证据） | **EP e4000 现实门槛** | 主跑 EP 冻结 **5890.1 s**、A/B 冻结 **2950.1 s**；A/B 把首次现实从 33.7 min 压到 4.9 min，但仍无法越过 EP 指数 4000 |
| Android 侧复测 | **NOT RUN** | AVD `emulator-5554` 由 Lead 独占，本轮未获批准操作；对照仅引用仓库中既有的 Android 真实运行证据，并逐条标注来源 |
| Web 生产代码修改 | **无** | 未发现需要修复的真实缺陷；不为了「有改动」而改代码 |

### 1.1 本次报告回答了什么

1. 用户要求的四项体验（关闭新闻、无意义切页、自动购买器、阶段解锁显示）在真实移动视口下是否成立 —— **成立，49/49 PASS**。
2. 与 Android 既有行为是否有真实差异 —— **4 条实现/UI 差异 + 1 条进度节拍差异**，均不影响本次四项验收的通过；详见 §4。
3. 180 分钟真实墙钟的瓶颈在哪里 —— 以本轮两个真实新档跑次 + R50 历史完成跑次 + R104 16 个跑次为证据，瓶颈**不在加载/性能/存档**：
   ① 默认节拍 10 s 与目标驱动坍缩把前段推进压慢 20 倍量级（把间隔改 1 s 后首次现实 33.7 min→4.9 min）；
   ② 更硬的结构性阻断是 **EP 指数卡在 3683 < 4000** 的 `isRealityAvailable()` 门槛，A/B 在 realities=15 冻结 2950 s。
   详见 §5/§6。

---

## 2. 环境与方法

| 项 | 值 |
|---|---|
| 验收脚本 | `reports/R107-01/accept-r107-01.mjs`（Playwright 原生 API；自起静态服务；每场景独立 browser context） |
| 运行器（180 min） | `reports/R107-01/runner/run-180min.mjs`（复用 R104 已验证 runner；全新 context + 出生快照校验 + 10 s 只读采样） |
| A/B 运行器 | `reports/R107-01/runner/run-ab-interval1.mjs`（同 runner + 启动时通过真实 UI 把间隔设为 1 s） |
| 浏览器 | Chromium 158.0.8127.18（Playwright 1.65.0，`/home/oreki/.npm/_npx/e41f203b7505f1fb`） |
| 视口 | 412×839（Pixel 7 手机）DPR 2.625、isMobile、hasTouch、zh-CN |
| 源码基线 | `1d1f7ae`（main） |
| 游戏默认值 | 游戏速度 10000×（动态升档默认开启）；智能自动操作默认启用、间隔 10 秒（产品默认，本轮未修改） |
| 真实新档判据 | 出生快照 `antimatter=10 / infinitiesLog10=null / dimensionBoosts=0 / galaxies=0 / realities=0 / endState=0` + `storageAtStart=[]` |
| 未运行 | Android AVD/真机 Chrome（Lead 独占）、oreki.net 部署（本轮无生产改动，未触发部署） |

### 2.1 验收脚本的方法学

- 每个场景 `browser.newContext()` 隔离，无 storage 残留；S2/S3 的存档来自 S2 内真实 UI「导出存档」。
- 所有交互都是 Locator/真实点击（打开抽屉使用真实指针点遮罩关闭抽屉），没有用 CDP 改 DOM、没有隐藏弹窗、没有写 `player` 字段。
- 原版教程/成就/离线弹窗会拦截点击：用真实按钮文字（「嗯呐」「确定」等）点掉，不 `display:none`。
- 断言失败会写 `result.json` 并保留证据；崩溃也会落盘（`RUNNER/scenario-crash`），不会静默通过。
- 过程说明：验收脚本自身迭代了 3 次才稳定（run1 `result-run1-beforefix.json`、run2 `result-run2-beforefix.json`、run3 `result-run3-firstpass.json`）。失败原因均为**测试夹具问题**，不是产品缺陷：
  1. 全屏「大坍缩」按钮会替换页签区（原版行为）→ 导航前需先真实点掉；
  2. 打开抽屉后 locator 点遮罩会因动画超时 → 改用真实指针点右侧遮罩；
  3. S1 用「当前反物质」衡量增长，而自动坍缩会把当前反物质清零 → 改用累计 `records.totalAntimatter`；
  4. S3 阶段门禁断言写成了「`eternities=0` ⇒ 不允许永恒层动作」，与源码真实语义（`infinityUnlocked && player.break`）不符 → 改为按源码语义断言。
  以上均在报告中保留，便于复核方法学没有放宽判定。

---

## 3. 验收证据（49/49 PASS）

完整逐项结果：`reports/R107-01/result.json`；截图/console/pageerror：`reports/R107-01/evidence/`；运行日志：`reports/R107-01/suite.stdout.log`。

### 3.1 S0 关闭新闻（5/5）

| 检查 | 结果 | 实测 |
|---|---|---|
| `news-nodes-absent-in-dom` | PASS | `#news / .c-news-ticker / [class*=news-ticker] / .c-news-line` 全部 0 |
| `no-news-text-rendered` | PASS | 正文无「新闻」 |
| `fresh-save-baseline` | PASS | antimatter≈10、infinities=0、realities=0 |
| `no-news-entry-in-visual-options` | PASS | 选项→视觉效果页无新闻入口 |
| `no-pageerror` | PASS | 0 |

证据：`evidence/s0-01-fresh-news.png`、`s0-02-options-visual.png`、`s0-console.json`。

### 3.2 S1 无意义切页（6/6）

| 检查 | 结果 | 实测 |
|---|---|---|
| `no-automatic-tab-switch-without-input` | PASS | 60 s 无输入，`ui.view.tab/subtab` 变化 **0 次** |
| `business-ticks-without-tab-switch` | PASS | 同一 60 s 内 `execLog` 1→7 拍、`lastBeatAt` 前进 |
| `production-grows-while-idle` | PASS | 累计 `records.totalAntimatter` 8.1e130 → 9.6e370，infinities 0→14 |
| `no-forced-tab-switch-while-away` | PASS | 停留「选项/游戏玩法」25 s，页签变化 0 次 |
| `business-ticks-while-away-from-dimensions` | PASS | `execLog` 7→10、totalAM 2.7e402→2.0e529、infinities 15→19 |
| `no-pageerror` | PASS | 0 |

证据：`evidence/s1-01-idle-60s.png`、`s1-01-idle-60s.json`、`s1-02-away-tab.json`、`s1-console.json`。

### 3.3 S2 阶段解锁显示（11/11）

| 检查 | 结果 | 实测 |
|---|---|---|
| `fresh-no-high-stage-entry` | PASS | infinity/eternity/reality 均不可用 |
| `fresh-sidebar-has-no-locked-stage-entry` | PASS | 抽屉仅 维度/自动化/成就/统计数据/选项 |
| `fresh-no-locked-content-rendered` | PASS | 组件 AntimatterDimensionsTab，无时间研究/现实文本 |
| `stage-gate-blocks-eternity-layer-before-infinity` | PASS | `eternityStageAllowed=false` |
| `big-crunch-reachable-by-real-play` | PASS | 真实点击后 `Player.canCrunch=true` |
| `first-crunch-enters-infinity-stage` | PASS | infinities=1、IP=9 |
| `infinity-entry-appears-without-reload` | PASS | 无限页签出现；抽屉含「无限」；**UI 延迟 24 ms** |
| `eternity-reality-still-absent` | PASS | eternity/reality 均不可用，eternities=0 |
| `no-pageerror` | PASS | 0 |

证据：`evidence/s2-01-fresh-locked.png`、`s2-02-after-first-crunch.png`、`s2-03-export.json`、`r107-real-infinity-save.txt`。

### 3.4 S3 自动购买器（21/21）

| 检查组 | 结果 | 关键实测 |
|---|---|---|
| 阶段恢复 / 阶段门禁 | PASS | 导入真实无限存档后 `stage=infinityDimensions`；`allowed=(infinityUnlocked && break)` 成立；目标 `unlock-eternity` |
| UI 默认值 | PASS | 开关「启用」、面板「调度间隔 10 秒」、输入框 10 |
| 调度真实执行 | PASS | 10 s 节拍：gaps `[null,10029,10002]` ms |
| 总开关关闭 | PASS | 立即 `enabled=false`、存储 `"0"`；5.5 s 内 execLog/lastBeatAt/actionCount/attemptCount 全冻结；`player.auto.autobuyersOn` 仍为 true |
| 重新开启 | PASS | 立即生效、存储 `"1"` |
| 1 s 间隔 | PASS | 实测 gaps `[1019,1024,1028]` ms；面板即时「调度间隔 1 秒」 |
| 1~60 秒边界 | PASS | 输入 0 → 1（存储 1）；输入 999 → 60（存储 60） |
| 60 s 间隔 | PASS | 实测 gap **60032 ms**；面板「调度间隔 60 秒」 |
| 刷新持久化 | PASS | 60 s 配置刷新后仍为 60；阶段未推进 |
| 手动优先 | PASS | 真实点击购买 → manualClick 0→2；`manualHold={goalId:"unlock-eternity",remainSec:60}`；5.2 s 后 actionCount 仍 0、剩余 55 s（执行层让路） |
| 不越阶段（显示/任务） | PASS | eternities=0 时无永恒页签、无时间研究文本；无 eternityReset 执行 |

证据：`evidence/s3-*.json/png`、`s3-s4-console.json`。

### 3.5 S4 阶段切换后的自动购买器（6/6）

| 检查 | 结果 | 实测 |
|---|---|---|
| `real-run-reaches-eternity-within-window` | PASS | S4 等待 350 s 后 eternities 0→5（真实结算，非写字段） |
| `eternity-entry-appears-without-reload` | PASS | 永恒页签出现、抽屉含「永恒」 |
| `executor-stage-switched-to-eternity-allowed` | PASS | `stage=eternityTimeStudy`、`allowed=true`、goal=unlock-dilation |
| `reality-entry-still-absent-at-first-eternity` | PASS | reality 不可用、realities=0 |
| `eternity-layer-task-executed-after-unlock` | PASS | execLog 出现 `eternityReset` 任务 |
| `no-pageerror` | PASS | 0 |

证据：`evidence/s4-01-after-first-eternity.png/.json`、`s4-02-eternity-task.json`、`s3-s4-console.json`。

---

## 4. 与 Android 已知行为对照（真实差异）

> Android 侧本轮 **NOT RUN**（AVD Lead 独占）。以下 Android 事实全部来自仓库内既有真实运行证据，
> 逐条给出文件位置；不把「读码」写成「已验证」。

| # | 能力 | Web（本轮实测） | Android（既有运行证据） | 判定 |
|---|---|---|---|---|
| 1 | 新闻 / 顶栏 | 新闻 DOM 0、无入口、无空白（本轮 PASS） | 无新闻模块；MOD 用「顶栏显示当前页面」替换原版滚动新闻条（`android/docs/FACTS.md:9876` R101 性能三组对照） | **【设计差异】预期**：两端都关闭新闻；Android 需要顶栏，Web 用侧栏高亮 |
| 2 | 阶段解锁显示 | 首次大坍缩后无限入口 **24 ms** 内出现；永恒/现实按阶段隐藏（本轮 PASS） | 入口由 `bm4.g()/h()` + `ll2.g()` + `MainActivity.W8()` 汇聚门禁控制；非法存档恢复被拦回 `jp4.b`（`android/docs/FACTS.md:9839-9840`，R101 实测） | **【实现差异】**：语义一致，Web 的恢复汇聚点是 `Tabs.findRestorableTab()`（R103-07 修复） |
| 3 | 自动购买器总开关 | 关闭立即停止 5.5 s 全冻结；原版 `autobuyersOn` 不变（本轮 PASS） | R101 P1 修复后，真实点击关闭 2 s/35 s/重启后 `player.json` 的 `autobuyersOn` 都为 false；MOD 不再恢复总开关（`android/docs/FACTS.md:9860`） | **【实现差异】**：语义一致；Web 面板入口在「选项→游戏玩法」，Android 在「教程→Oreki 设置」（`android/docs/FACTS.md:8291`） |
| 4 | 1~60 s 间隔 | 1 s / 60 s 实测生效；0→1、999→60 钳制；刷新保持（本轮 PASS） | 调度器 1~60 s 钳制 + 跨重启保存（`android/docs/FACTS.md:6371,7772`）；另有**按阶段自动调间隔** `OrekiBeatStrategy`：早期 1 s / 无限 2 s / 无限维度 3 s / 永恒 5 s / 终局 10 s（`android/docs/FACTS.md:9248`，§128） | **【功能缺口】Web 缺阶段化节拍**：Web 固定默认 10 s；这是 §6 的 180 分钟可调项（见建议 2） |
| 5 | 手动优先 | 真实点击 → 60 s 目标级让路、执行层 actionCount 冻结（本轮 PASS） | `OrekiPlayerIntent` 对**玩家配置改动**让路（总开关/坍缩模式/间隔），不在下一帧抢写、下一 tick 恢复（`android/docs/FACTS.md:9248-9253`）；不以「点击」计数 | **【实现差异】**：两端都满足「不覆盖玩家意图」，触发方式不同；未发现违反等价的行为 |
| 6 | 180 分钟进度 | 见 §5/§6：当前版本首次现实 1852 s、50.5 min 仍无天神/Pelle | Android 180 min 真实跑次同样未通关；R104 P1-01 实测第二永恒在 180 min 内不可达，R105 首次/第二永恒分别 374.6 s / 1307.2 s；`android/docs/FACTS.md:4539` 明确「Android 端在现有代码下不可能在 180 分钟内到达终局」 | **【功能缺口】两端都未达 180 min 门禁**：本报告给出 Web 侧可量化瓶颈与改进建议 |

**结论**：本轮四项体验验收在 Web 侧全部 PASS；与 Android 的差异集中在「阶段化节拍（Android 有/Web 无）」与「手动优先触发方式」。没有发现需要为了双端等价而立即修改 Web 生产代码的缺陷——阶段化节拍属于**进度策略调整**，需要按 §6 建议先做受控实验与教程同步，不在本轮擅自改默认值。

---

## 5. 本轮 180 分钟真实新档跑次

> 两个跑次均为**真实全新存档**（出生快照 PASS），只读 10 s 采样，不使用离线结算、不写进度字段。
> 两轮均已收口（主跑 180 min 上限停止、A/B 60 min 上限停止）；数值以对应目录的
> `summary.json` / `samples.jsonl` 为准。

### 5.1 主跑（默认设置：智能自动操作 10 s，游戏速度 10000× 动态升档）

- 目录：`reports/R107-01/run-180min/`；源码 `1d1f7ae`；起点 2026-11-13 22:47:44 (+08:00)
- 运行环境：宿主 load average 25–31（其他 Agent 的 AVD / D8 并发负载），fps 19–60；
  但游戏内时间按帧间差分积分，里程碑墙钟与 R104 的 60 fps 跑次基本一致（见 §6.2）
- 关键里程碑（真实墙钟，秒）：首次无限 **24.4**、首次 Break **54.3**、首次永恒 **524.3**、
  首次时间研究 **564.4**、首次膨胀研究 **1994.5**、首次现实时间研究 **2014.4**、首次现实 **2024.3**
- 首次现实用时 **33.7 分钟 = 10800 s 预算的 18.7%**
- **终态（180 分钟上限停止）**：
  - 结果 `FAIL`：`真实墙钟达到上限 180 分钟仍未出现 player.isGameEnd=true；最后进度 r=15 endState=0 totAMLog10=-Infinity`
  - `realities=15`（wall 3969.4 s 达到，约 66.2 min）、`endState=0`、`gameEnd=false`、`teresa=false`、`pelleUnl=false`
  - `epLog10=3683.25`、`maxEpExponent=3683`、`ecDone=12×5`、`dsN=5`、`ds6=false`
  - **EP 墙实测**：wall **4909.4 s → 10799.5 s**，EP log10 只在 3683.25/3683.26/3683.63 之间，
    **连续 5890.1 s（98.2 分钟）零增长**；`isRealityAvailable()` 要求 `thisReality.maxEP.exponent >= 4000`
  - 采样：1080 条（10 s 间隔）、43 张截图；pageerror **0**；console 错误仅 2 条 gtag CSP（离线预期）
  - 全程游戏速度 10000×→100000×（4 次动态升档）、智能自动操作默认 10 s
- 证据：`run-180min/summary.json`、`run-180min/samples.jsonl`、`run-180min/console.log`、`run-180min/screenshots/`

### 5.2 受控 A/B（唯一变量：把「智能自动操作」间隔改为 1 秒）

- 目录：`reports/R107-01/run-interval1/`；运行器 `runner/run-ab-interval1.mjs`
- 间隔修改方式：**真实 UI 点击**（☰→选项→游戏玩法→输入 1→应用间隔），执行层记录
  `[ab] 调度间隔请求=1 结果={"path":"ui-real-click","applied":1,"attempt":0} 存储=1`
- 关键里程碑（真实墙钟，秒）：

| 里程碑 | 默认 10 s 主跑 | 间隔 1 s A/B | 加速 |
|---|---|---|---|
| 首次无限 | 24.4 | 6.1 | 4.0× |
| 首次 Break | 54.3 | 16.1 | 3.4× |
| 首次永恒 | 524.3 | 96.1 | 5.5× |
| 首次现实时间研究 (ds6) | 2014.4 | 256.1 | 7.9× |
| 首次现实 (realities≥1) | 2024.3 | 296.2 | 6.8× |
| 5 现实 | 2024.3 | 296.2 | 6.8× |
| 10 现实 | 2979.5 | 449.1 | 6.6× |
| 15 现实 | 3969.4 | 559.1 | 7.1× |
| 现实升级 RU10 | 4034.3 | 316.2 | 12.8× |

- **重要负向发现**：A/B 在 wall≈569 s 达到 realities=**15** 后，EP（log10）冻结在 **3683.25**，
  直到 60 min 采样结束（wall 3599.3 s）**连续 2950.1 s 零变化**；`ecDone` 已 12×5、`dsN=5`、`ttLog10≈6.7`。
  该值与 R104 pass7/pass8 记录的 EP 卡 e3682~3683 是同一堵墙：`isRealityAvailable()` 要求
  `player.records.thisReality.maxEP.exponent >= 4000`（`src/core/reality.js:120`），
  当前 EP 指数 3683 < 4000 ⇒ **现实循环冻结在 realities=15**。
- 结论：把节拍从 10 s 调到 1 s 能把「首次现实」从 33.7 min 压到 **4.9 min**（6.8×），
  但**不能**越过 EP e4000 的现实门槛；180 分钟门禁的第二个（也是更硬的）瓶颈是现实循环的 EP 墙。

### 5.3 A/B 的 60 分钟终态

- 目录：`reports/R107-01/run-interval1/summary.json`；运行 3596.2 s（60 min 上限）后停止
- 结果：`FAIL — 真实墙钟达到上限 60 分钟仍未出现 player.isGameEnd=true；最后进度 r=15 endState=0`
- 终态：`realities=15`、`epLog10=3683.25`、`maxEpExponent=3683`、`ecDone=12×5`、`dsN=5`、`ds6=false`、
  `ruBought=18 项`、`glyphs=15`、`teresa=false`、`pelleUnl=false`、`gameEnd=false`
- **EP 墙实测**：从 wall **649.2 s** 到 **3599.3 s**，EP log10 只在 **3683.25 / 3683.63** 两个值之间，
  **连续 2950.1 s（49.2 分钟）零增长**；而 `isRealityAvailable()` 要求 `thisReality.maxEP.exponent >= 4000`
  （`src/core/reality.js:120`）⇒ 现实数永远停在 15，天神/莱特拉/佩勒链无法开始。
- 证据：`analysis/ep-wall-observation.json`、`run-interval1/samples.jsonl`、`run-interval1/console.log`
  （console 可见 `ep-high-grow` / `eternity-grow` / `eternity-ip-jump` 循环，但无法把 EP 指数推过 4000）。


---

## 6. 180 分钟通关瓶颈分析（含历史对照）

### 6.1 历史完成证据：R50 时期 Web 曾在 12.3 分钟内真实通关

来源：`web/reports/_r50/r50-fresh8.jsonl` + `r50-fresh8.summary.json`（2026-11-01，独立于本轮）。
零起点基线 `r50-newgame8.json`：hardReset 后 250 ms 轮询抓到的最早帧
`rtp=6021ms / realities=0 / eternities=0 / infinities=3 / normalBits=2 / speed=10000`。

| 里程碑 | 墙钟 (s) |
|---|---|
| 首次无限 | 9.6 |
| 首次永恒 | 19.6 |
| 首次现实 | 79.6 |
| V 解锁 | 394.6 |
| IU15 / 莱特拉 | 414.6 |
| IU25 / 佩勒 / doomed | 699.6 |
| **gameEnd（isEnd=true）** | **739.6（12.3 min）** |

终态 `realities=100、iu15=iu25=pelle=doomed=true、end=1.104`。
这条证据只说明「旧代码 + 10000×→40000× 下，机制上可达 180 分钟目标」，**不是当前版本的结论**。

### 6.2 当前版本 vs 历史完成跑次

| 指标 | R50 fresh8（旧代码） | R104 pass10（62f41e7，60 fps） | R107 主跑（1d1f7ae，本轮） | R107 A/B（间隔 1 s） |
|---|---|---|---|---|
| 首次永恒 | 19.6 s | 522.2 s | 524.3 s | 96.1 s |
| 首次现实 | 79.6 s | 1852.1 s | 2024.3 s | 296.2 s |
| 到达 realities=15 | —（300 s 时 realities=35） | 未达 | **3969.4 s** | **559.1 s** |
| 卡在 realities=15 的 EP 墙 | — | 未跑到（50.5 min 停） | **5890.1 s 零增长** | **2950.1 s 零增长** |
| 终局 | 739.6 s | 50.5 min 未通关 | **180 min 未通关（realities=15、EP e3683）** | 60 min 未通关（realities=15、EP e3683） |

结论：当前版本**首次现实比旧代码慢 23–25 倍**；把默认节拍改成 1 s 可把首次现实拉回 **296 s**
（仍比旧代码慢 3.7×），但随后卡在 EP e3683 的现实门槛。

### 6.3 归因（提交/代码级，可复核）

1. **统一节拍默认值 3 s → 10 s**（`29e48cf`，R85，2026-11-06；`src/core/oreki-smart-executor.js:107`）。
   R50 fresh8 使用默认 3 s；本轮主跑默认 10 s。A/B 实测 1 s 相对 10 s 快 4.0–7.9×，证明节拍是**数量级因子**。
2. **R96 目标驱动大坍缩**（`a1cf8f8`/`cae9a53`）：把「默认放行坍缩」改成「收益窗口内才放行」，
   首次永恒前 IP 主要靠坍缩循环积累；A/B 的 console 仍可见 `ep-high-grow` / `eternity-grow` 循环，
   说明该策略在现实循环里持续按住坍缩。
3. **R104 把模块内帧节流改为真实时间窗**（`62f41e7`，RUN-NOTES §5 第 5/7 项：`_frame%30/%20` → 1 s/2 s）：
   解决卡死的同时，也把时间研究/EC/现实自动化的动作频率限制到 1–2 s 一次（旧代码是每帧尝试）。
4. **每拍最多 1 个真动作 + 默认 10 s**：R104 pass10 的 executor 记账显示 routine/celestial/early/eternity
   按 10 s 节拍轮转；这是当前版本「慢」的直接执行层原因。
5. **EP e4000 现实门槛（第二个硬瓶颈）**：`isRealityAvailable()` 要求
   `thisReality.maxEP.exponent >= 4000`（`src/core/reality.js:120`）。A/B 在 EP 指数 3683 处冻结 280+ s；
   R104 pass7/pass8 也记录过同一堵墙（e3682.74）。不解决它，即使节拍调到 1 s 也无法把现实数推到
   100（更不用说天神/莱特拉/佩勒链）。

### 6.4 已排除的因子

| 因子 | 证据 | 结论 |
|---|---|---|
| 游戏速度不够 | 主跑动态升档到 100000×；A/B 仅 10000× 却快 6.8× | 不是速度问题；A/B 在游戏内时间少 10 倍时仍然更快 |
| 存档不新/被污染 | 主跑与 A/B 出生快照均为 antimatter=10 / infinities=0 / realities=0，storage 空 | 不是残留存档 |
| 宿主 CPU 争用 | load 25–31，fps 19–60；主跑首次永恒 524.3 s vs R104 60 fps 的 522.2 s | 对**里程碑墙钟**影响 <1%；只影响自动器每帧触发次数（次要） |
| 浏览器/加载失败 | pageerror 0；console 仅 gtag CSP 被拦截（离线预期） | 不是 Web 运行故障 |

### 6.5 瓶颈清单（按对 180 分钟终局的影响排序）

| # | 瓶颈 | 观测证据 | 影响 |
|---|---|---|---|
| 1 | **EP e4000 现实门槛**：EP 指数冻结 3683 | **主跑 4909.4–10799.5 s 连续 5890.1 s 零变化**；A/B 649.2–3599.3 s 连续 2950.1 s 零变化；R104 pass7/pass8 同值 | 现实数卡 15，无法到 100；天神/莱特拉/佩勒链全部不可达 |
| 2 | **默认节拍 10 s**（旧代码 3 s；Android 阶段化 1–10 s） | A/B 1 s：首次现实 296.2 s vs 主跑 2024.3 s | 首次现实从 33.7 min 压到 4.9 min（6.8×） |
| 3 | **坍缩策略在现实循环里按住坍缩** | console `ep-high-grow`/`eternity-grow` 循环；EP/maxAM 长时间不动 | 与 #1 叠加，使现实循环停滞 |
| 4 | **帧节流改真实时间后动作频率上限** | R104 RUN-NOTES §5 第 5/7 项；A/B 仍有 1 s 级动作上限 | 中后期 EC/现实升级链变慢 |
| 5 | 天神/莱特拉/佩勒自动化从未在真实新档跑通 | R104 16 个跑次最远 realities=10；本轮主跑/A-B 见 §5 | 终局判据无任何运行期证据 |

### 6.6 可执行改进建议

1. **先修 EP e4000 墙（P0/P1 级，优先级最高）**：这是当前 180 分钟门禁的硬阻断。
   建议以主跑 4909.4–10799.5 s（5890 s）与 A/B 649.2–3599.3 s（2950 s）两个冻结现场（`analysis/ep-wall-observation.json`）为复现夹具，检查 `isRealityAvailable()` 之前
   `maxEP` 的增长路径（gainedEP 与当前 EP 的倍率、TT ×500 奖励、EP 倍率链、`ep-high-grow` 的实际效果），
   并补一条运行期探针（EP 指数/每分钟增量）进 runner。
2. **阶段化节拍（对齐 Android）**：Android `OrekiBeatStrategy` 早期 1 s / 无限 2 s / 无限维度 3 s /
   永恒 5 s / 终局 10 s（`android/docs/FACTS.md§128`）；Web 固定默认 10 s。建议把 Web 默认改为阶段化，
   并同步教程 JSON/生成模块（`oreki-tutorial-data.json` 6 处「默认 10 秒」）后再跑真实新档复验。
3. **重新评估首次永恒前的坍缩等待窗口**：用 R50 的 19.6 s 作为「可达到性上界」做实验分支对照，
   只在实验分支调参，验证后再决定是否进生产。
4. **给 180 分钟门禁加分阶段预算**（建议值）：首次现实 ≤ 15 min；realities=100 + all RU ≤ 45 min；
   特蕾莎/鹿颈长/无名氏 ≤ 60 min；IU15→IU25→Pelle ≤ 90 min；Pelle 终局 ≤ 150 min。
   当前主跑首次现实 33.7 min 已超第一段 2.2×。
5. **runner 取证固化**：把首次现实 / realities 20/100 / ach147 / Teresa / IU15 / IU25 / Pelle / gameEnd
   写进 `events`（本轮 runner 已含 reality20/100、teresa、pelleUnl 事件），每轮 180 分钟门禁使用同一判据。


---

## 7. Web 生产代码修改

**无。** 本轮未修改 `src/`、`index.html`、`public/` 等生产文件；未改默认节拍、未改坍缩策略、未改存档结构。
原因：四项验收 49/49 PASS，未复现需要修复的真实产品缺陷；180 分钟瓶颈的根因是**速度/策略设计问题**，
影响面（所有玩家推进速度）与教程同步成本较大，已给出可执行建议与受控实验数据，交由 Lead 决定是否在下一轮实施。

---

## 8. 复现入口与证据清单

### 8.1 一键复现

```bash
cd /home/oreki/AD-Oreki-Unified/web/AD-Oreki-Edition
node reports/R107-01/accept-r107-01.mjs            # 49 项定向验收，产物在本目录
node reports/R107-01/runner/run-180min.mjs --mode full --out reports/R107-01/run-180min --max-min 180 --shot-ms 300000 --probe-et 0
node reports/R107-01/runner/run-ab-interval1.mjs --mode full --out reports/R107-01/run-interval1 --max-min 60 --shot-ms 300000 --probe-et 0 --interval 1
```

> 运行器会自动选择机器上已安装的 Playwright 1.65.0；若路径不同，修改 `PW_CANDIDATES` 即可。

### 8.2 文件

| 路径 | 内容 |
|---|---|
| `reports/R107-01/README.md` | 本报告 |
| `reports/R107-01/accept-r107-01.mjs` | 49 项验收脚本 |
| `reports/R107-01/result.json` | 最终验收结果（49/49 PASS） |
| `reports/R107-01/evidence/` | 截图 + console/pageerror + 各检查 JSON |
| `reports/R107-01/suite.stdout.log` / `suite-run.log` | 最终验收运行日志 |
| `reports/R107-01/result-run{1,2,3}-*.json` / `suite-run{1,2,3}-*.log` | 验收脚本自身迭代（夹具问题）的保留证据 |
| `reports/R107-01/runner/run-180min.mjs` | 180 min 真实新档运行器 |
| `reports/R107-01/runner/run-ab-interval1.mjs` | 间隔 1 s 的 A/B 运行器 |
| `reports/R107-01/run-180min/` | 本轮 180 min 主跑（summary/samples/screenshots/console） |
| `reports/R107-01/run-interval1/` | 间隔 1 s 的 A/B 跑次 |
| `reports/R107-01/analysis/` | 历史跑次对照表、R50 完成证据、瓶颈底稿 |

### 8.3 未完成 / 未运行

| 项 | 状态 | 原因 |
|---|---|---|
| Android AVD 同项复测 | **NOT RUN** | `emulator-5554` 由 Lead 独占，未获批准操作 |
| Android 真机 Chrome | **NOT RUN** | 同上 |
| oreki.net 部署 | **NOT RUN** | 无生产改动；部署门禁与凭据问题沿用 R103-07/R105-04 记录，不属于本轮范围 |
| 180 分钟内真实通关 | **见 §5** | 以本轮真实跑次结果为准，未伪造完成 |

---

## 9. 状态标记（诚实口径）

| 项 | 标记 |
|---|---|
| S0 关闭新闻 | PASS |
| S1 无意义切页 | PASS |
| S2 阶段解锁显示 | PASS |
| S3 自动购买器（阶段感知/总开关/1~60s/手动优先） | PASS |
| S4 首次永恒后的阶段切换 | PASS |
| 定向验收合计 | PASS（49/49） |
| Web 生产代码修改 | 无（0 文件） |
| 180 分钟真实通关 | **FAIL**（主跑 180 min 停止于 realities=15；A/B 60 min 同样卡 realities=15；EP 墙见 §6.5#1） |
| Android 侧本轮复测 | NOT RUN（引用既有证据） |
| 双端行为等价 | 无新增阻断差异；4 条实现差异 + 1 条节拍缺口 |
