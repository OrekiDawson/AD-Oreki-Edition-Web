# R103-07 Web 行为一致与 Pages 自动部署状态核查

- 轮次任务：R103-07（Web 子任务）
- 执行时间：2026-11-12 21:35–22:10（Asia/Shanghai，低谷计费时段）
- 仓库：`AD-Oreki-Edition-Web`（独立 Git）
- 结论概览：**定向浏览器验收 54/54 PASS**；发现并修复 **2 个真实 Web 缺陷**；oreki.net **自动 Pages 部署 BLOCKED**（缺少环境与跨仓凭据，未执行任何生产部署）。

## 1. 测试环境

| 项 | 值 |
|---|---|
| 运行器 | Playwright 1.65.0（`/tmp/pwtest`，未写入仓库依赖）+ Chromium 158 headless（`chromium-1254`） |
| 视口 | Pixel 7 移动上下文 412×839、DPR 2.625、`isMobile`、`hasTouch`、zh-CN、Android Chrome UA |
| 本地服务 | `node serve.mjs 8099` → `http://127.0.0.1:8099/` |
| 游戏参数 | 仓库默认全局速度 10000×（MOD 自带设置，未修改）；未启用任何加速脚本 |
| 存档通道 | 只用 UI「导出存档 / 导入存档」与真实游玩产生的存档；反向用例仅手改 `options.lastOpenTab`（模拟手改/损坏存档） |
| 认证输入 | 使用 Playwright Locator/真实点击与输入；未用 CDP 指令替代日常操作 |

复现脚本：`accept-r103-07.mjs`（报告产物，非仓库构建依赖）。完整输出：`suite-run.log`、`result.json`。

## 2. 结果总表

| 场景 | 检查 | 结果 |
|---|---|---|
| S1 新档阶段门禁 + 反向用例 | 11 | **PASS 11/11** |
| S2 首次大坍缩 → 无限阶段 | 15 | **PASS 15/15** |
| S3 自动购买器（总开关/间隔/持久化/手动优先/不越阶段） | 18 | **PASS 18/18** |
| S4 合法存档导入与刷新持久化 | 10 | **PASS 10/10** |
| 合计 | 54 | **PASS 54/54**（pageerror 全场景 0） |

### S1 新档（真实浏览器）

- 新档状态：`infinity=false / eternity=false / reality=false`，底栏/侧栏（手机为抽屉）无「无限 / 永恒 / 现实 / 天神」入口；侧栏仅 `["维度","自动化","成就","统计数据","选项"]`。
- 时间维度锁定：`Tab.dimensions.time.isUnlocked=false`；时间研究不可达：永恒父页签 `isAvailable=false`、渲染组件为 `AntimatterDimensionsTab`、页面文本无「时间研究/时间之理」。
- 说明（非缺陷）：`Tab.eternity.studies.isUnlocked` 原版就没有独立 condition，恒为 true；Web 的门禁在**父页签可用性**，故验收按父页签 + DOM + 恢复路径判定。
- 反向用例（修复后全部被拦截）：
  - 手改存档 `options.lastOpenTab=7`（永恒）后刷新 → 落到 `dimensions/antimatter`，未渲染 `TimeStudiesTab`；
  - 手改 `options.lastOpenSubtab[0]=2`（时间维度）后刷新 → 被重置回 `antimatter`；
  - URL `#eternity` 与 `?tab=eternity&subtab=studies` 均不改变页签（本项目无路由，URL 无法直达）。
- 证据：`evidence/s1-*.json/png`、`evidence/s1-console.log`。

### S2 首次大坍缩 → 无限阶段

- 用真实按钮点击（买到 10 个/购买最大数量/维度提升/星系/计数频率）把新档推进到 `Player.canCrunch=true`，点击「大坍缩」并在确认弹窗点「确定」。
- 首次坍缩后：`infinityUnlocked=true、infinities=1、IP=10`；`永恒/现实` 入口不存在，无限页已出现；页面未渲染任何永恒层内容。
- 自动 Break 观测（100 ms 采样）：`inf=1 → break=false`；`inf=2 → break 仍为 false`；随后才 `break=true`。即 **首次坍缩后不会立即自动 Break Infinity**（与 README §4.3、Android `MIN_INFINITIES_BEFORE_AUTO_BREAK=2` 对齐）。
- Break 打开瞬间：`eternityTab=false、eternities=0`，没有提前打开永恒入口。
- 反向用例：用本场景真实无限阶段存档手改 `lastOpenTab=7` 后刷新 → 被拦截（`dimensions/antimatter`，无时间研究内容）。
- 正向回归：同一存档手改 `lastOpenTab=6`（已解锁的无限页）后刷新 → 正常恢复 `infinity/upgrades`，证明门禁没有误伤合法恢复。
- 证据：`evidence/s2-*`，自动 Break 时间线 `evidence/s2-03-break-timeline.json`。

### S3 自动购买器（选项 → 游戏玩法，全部真实点击/输入）

- 默认：总开关「启用」、`调度间隔 10 秒`、输入框 10；`execLog` 实测执行间隔 `[null,10010,10031] ms`（≈10 s）。
- 关闭总开关：`enabled=false` 立即生效，`localStorage.oreki.automation.enabled="0"`，UI 显示「关闭」；随后 5.5 s 内 `execLog` 条数、`lastBeatAt`、`actionCount/attemptCount` 全部不变 = **立即停止**；`player.auto.autobuyersOn` 仍为 true（不会强改原版开关）。
- 重新开启：`enabled=true`、本地存储 `"1"`。
- 1 秒间隔：`intervalSec=1`、存储 `"1"`、面板立即显示「调度间隔 1 秒」；实测执行间隔 `[1012,1026,1020] ms`。
- 60 秒间隔：`intervalSec=60`、存储 `"60"`、面板显示「调度间隔 60 秒」；等待真实下一拍 `gapMs=60025 ms`（`taskGapMs=61050`）。
- 持久化：刷新后 `enabled=true、intervalSec=60`（随后再置 1 并在 S4 刷新验证）。
- 手动优先：间隔 1 秒下真实点击「买到 10 个」→ `manualClickCount 0→2`，`manualHold={goalId:"unlock-eternity", remainSec:60}`，5 s 后仍剩余 55 s；该窗口内智能执行层 `actionCount/attemptCount` 不变（让路生效）。
- 不越阶段：`eternities=0` 时永恒页签不存在、无时间研究内容；`execLog` 中没有任何 `eternity/eternityReset` 任务执行（`eternityStageAllowed` 仅在 Break 后为 true，与 Android 判据同源）。
- 证据：`evidence/s3-*`。

### S4 合法存档导入

- 存档来源：S2 真实游玩后在「选项 → 存档」点击「导出存档」得到的真实存档（长度 7,204，解码有效，来源既可为剪贴板证据）。
- 新上下文导入：导入弹窗正确识别（反物质/无限次数/覆盖警告），点击「导入」后 `infinityUnlocked=true、infinities≥3、无限页可见、永恒页不可见`，无永恒层内容。
- 持久化：导入触发的离线模拟期间 `canSave()=false`（原版语义），等待真实自动存档落盘 `17.1 s` 后 `localStorage` 已含导入进度（`savedInfinities=9 ≥ imported 3`）。
- 刷新后：阶段与资源保持（`stage=infinityDimensions、infinityTab=true、infinities 6→3136`（游戏持续自动坍缩）），MOD 间隔设置 `1 秒` 与开关状态保持；未出现永恒入口。
- 证据：`evidence/s4-*`、`evidence/r103-real-infinity-save.txt`（本场景导入用的真实存档副本）。

## 3. 发现并修复的真实缺陷

### 3.1 P1：存档恢复可绕过阶段门禁直达「时间研究」（Web 独有路径）

- 复现（修复前，真实浏览器）：新档/首次坍缩后，把手改存档的 `player.options.lastOpenTab` 设为 7（永恒页 id）并刷新 → `init()` 直接 `Tab.eternity.show(true)`，页面渲染出 `TimeStudiesTab`（时间研究树），即使 `eternities=0`。证据截图：`before-fix/01-prefix-fresh-save-crafted-lastOpenTab7-rendered-TimeStudiesTab.png`、`before-fix/02-prefix-infinity-save-crafted-lastOpenTab7-rendered-TimeStudiesTab.png`。
- 根因：`TabState.show()` 只重置**子页签**的解锁状态，不校验**父页签**；存档恢复入口（`game.js init`、`GameStorage.loadSlot`）直接信任 `lastOpenTab`。Android 端有 `MainActivity.W8()` / `bm4.g()` 汇聚门禁，Web 这条恢复路径缺同等判据。
- 最小修复（3 文件，未改存档结构/未改原版逻辑）：
  - `src/core/tabs.js`：新增 `Tabs.findRestorableTab(id)`，只返回「已解锁且未被玩家隐藏」的页签，否则 null；
  - `src/game.js`：init 恢复页签改用该门禁，非法时退回 `Tab.dimensions`；
  - `src/core/storage/storage.js`：`loadSlot()` 同样过门禁。
- 修复后复测：S1/S2 反向用例全部被拦截；合法页签（无限页）恢复仍正常；`node --check` 通过。

### 3.2 P2：应用自动操作间隔后面板仍显示旧间隔

- 复现（真实浏览器）：选项 → 游戏玩法，把间隔从 10 改为 1（或 60）并点「应用间隔」后，执行层 `intervalSec` 已正确变化且节拍实测生效，但面板文字仍显示「调度间隔 10 秒」。
- 根因：`OptionsGameplayTab` 的 `automationIntervalLabel` / `automationModeLabel` 直接读普通对象 `OrekiSmartExecutor`（无响应式依赖），Vue computed 首次求值后被永久缓存。
- 最小修复（1 文件）：新增 data 镜像 `automationIntervalLive`，在 `update()` 中同步执行层真实值；两个 computed 改读镜像。修复后面板即时显示 1/60 秒，档位文案同步。
- 证据：`evidence/s3-04-interval-1s.json`、`evidence/s3-05-interval-60s.json`（labels 已含「调度间隔 1 秒 / 60 秒」）。

### 3.3 观察项（非缺陷，未改代码）

- `GameStorage.import()` 的 `save(true)` 在导入触发的离线模拟期间被 `canSave()` 拒绝（原版语义），因此导入后需等一次自动存档才落盘（本机实测 17.1 s）。这是上游行为，S4 按真实玩家流程等待自动存档后验证刷新持久化；如要求「导入后立刻刷新也不丢」，需要上游级改动，本轮未扩大范围。
- 原版子页签没有独立解锁条件（如「时间研究」），Web 门禁始终由父页签可用性 + 渲染层决定；验收不应把子页签 `isUnlocked` 当门禁。

## 4. Android/Web 阶段门禁与自动购买器差异判定

- **结论：未发现新的真实行为差异需要 Kotlin/Web 双向修改。** 本次唯一真实偏差是 Web 存档恢复路径缺父页签门禁（Android 由 `W8()` 汇聚点覆盖），已按 Web 侧最小修复。
- 自动购买器对照（以两端实现锚点为准）：
  - 间隔 1–60 s、默认 10 s、总开关关闭立即停止、手动优先 60 s、原版自动购买器开关不被强改——本轮机端实测与 `oreki-smart-executor.js` 注释声明的 Android `OrekiAutomationScheduler` 语义一致；
  - 阶段门禁 `eternityStageAllowed = infinityUnlocked && player.break`（Web）与 Android `OrekiStageAuto` 的 Break 前不驱动永恒层一致；自动 Break 需 `infinities ≥ 2`，首次坍缩不自动 Break；
  - 本轮未新增 `WEB_ANDROID_DIFFERENCES.md` 条目（无新的平台差异）。

## 5. oreki.net 自动 Pages 部署核查（BLOCKED，未执行生产部署）

### 5.1 现状事实（2026-11-12 21:53–22:05 实查）

| 项 | 实测 |
|---|---|
| 部署工作流 | `.github/workflows/deploy.yml`（manual `workflow_dispatch`，输入 `approved_sha`；CI 复用 + 严格教程校验 + 按 `approved_sha` 检出并双重核验 HEAD + 同步 Pages 仓）。核查期间上游新增防回退：4acde60 在 CI logic job 增加 `scripts/check_deploy_workflow.mjs` 结构守卫；本地 `node scripts/check_deploy_workflow.mjs` **PASS**（本机复跑）。 |
| Actions 中工作流状态 | `Deploy Web to oreki.net (manual)` **active**（id 415879883），但 **run 列表为空，从未运行过** |
| Environment | `GET /repos/.../environments` → `total_count: 0`，工作流引用的 `web-production` **不存在** |
| 仓库 Secrets | `GET /repos/.../actions/secrets` → `total_count: 0`；**`PAGES_DEPLOY_TOKEN` 不存在**（环境级 Secrets 返回 404） |
| Actions 权限 | `enabled: true`，`allowed_actions: all` |
| Pages 仓 | `OrekiDawson/OrekiDawson.github.io` 存在，`build_type=legacy`、`source=main/`、`CNAME=oreki.net`、证书 approved、`https_enforced=false`；main 无分支保护 |
| 最近一次线上部署 | 2026-11-12 11:43，作者 `OrekiDawson`（**手工提交**「deploy: 同步 1bf34c3 …」，非工作流产物） |
| 线上一致性 | `https://oreki.net/src/main.js` SHA-256 与仓库 `1bf34c3` 的 `src/main.js` **完全一致**；线上仍是 1bf34c3 版本，未包含本轮修复 |
| 本地发布门禁预检 | `node --check` 3 文件 OK；`check_stage_gate` 18/18、`check_eternity_gate` 70/70、`test-r100-newgame-autobuyers` 39/39、`test-scheduler-beat` 22/22、`validate_tutorial` **PASS**、`check_deploy_workflow` **PASS**（部署 job 的严格教程门禁与 exact-SHA 守卫均可通过） |

### 5.2 阻断结论

自动 Pages 部署 **BLOCKED**，实际阻断为两项缺失（不是 token 权限范围问题，是本机根本查不到 token/环境）：

1. Environment `web-production` 未创建（deploy job 引用了它；环境 Secrets 因此无处挂载）；
2. 未配置跨仓凭据 `PAGES_DEPLOY_TOKEN`（工作流用它 checkout/push Pages 仓，缺它会在「Require cross-repository deploy credential」一步 fail-closed 失败）。

另一客观现状：工作流从未被触发，线上由 owner 手工同步；因此「自动部署」目前在仓库侧完全没有可验证的运行记录。新增的 exact-SHA 门禁（`approved_sha` 双重核验 + CI 结构守卫）只提高安全性，不改变上述两项缺失阻断。

### 5.3 最小权限修复方案（需用户/ChatGPT 手工配置，本轮未执行）

1. **建 Environment**：仓库 Settings → Environments → New environment，名称必须为 `web-production`（建议加 required reviewers 作为发布闸门）。
2. **建最小权限 Token**：GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token：
   - Resource owner：`OrekiDawson`；
   - Repository access：Only select repositories → **仅** `OrekiDawson/OrekiDawson.github.io`；
   - Permissions：**Contents = Read and write**（Metadata 自动 Read）；不需要 Actions/Pages/Workflow 权限（Pages 使用 legacy branch 构建，push 即触发）；
   - 设置合理过期时间，记录轮换方式。
3. **挂 Secret**：Settings → Environments → `web-production` → Add secret，名称必须为 **`PAGES_DEPLOY_TOKEN`**，值为上一步 PAT（仓库级同名 Secret 也可，但环境级更符合最小暴露）。
4. **触发**：Actions → `Deploy Web to oreki.net (manual)` → Run workflow（分支 `main`），`approved_sha` 填当前 `main` 的 40 位 SHA（必须等于本次 dispatch 的 `GITHUB_SHA`，工作流会用该 SHA 检出并双重核验实际 HEAD）；该工作流会先重跑 Web CI，再严格校验教程同步，再同步 `src/modules/public/index.html` 等部署文件并保留 CNAME/Ads.txt。
5. **核验**：`gh run watch`；Pages 仓应出现 `deploy: sync validated AD Web <sha>`；`GET /repos/OrekiDawson/OrekiDawson.github.io/pages` status=built；再比对 `https://oreki.net/src/main.js` 与目标 commit 的 SHA-256。

> 说明：环境名 `web-production` 与 Secret 名 `PAGES_DEPLOY_TOKEN` 取自 `.github/workflows/deploy.yml`，改名必须同时改工作流；本轮**未创建环境、未写入 Secret、未触发部署**（任务要求不执行正式生产部署）。

## 6. 结果与证据索引

- 汇总：`result.json`（54/54 PASS）、`suite-run.log`。
- 场景证据目录：`evidence/`（S1/S2/S3/S4 截图、状态 JSON、Console/pageerror 日志；pageerror 全为 0；唯一 console error 是离线环境 CSP 拦截 googletagmanager，与游戏无关）。
- 修复前复现截图：`before-fix/`。
- 导入用真实存档副本：`evidence/r103-real-infinity-save.txt`（由真实游玩导出，非构造进度）。

## 7. 未执行 / 说明

- **生产部署：NOT RUN**（按要求不执行；只做本地构建/静态检查与线上一致性核查）。
- **Android Chrome / AVD：NOT RUN**（本轮为 Web 定向验收，未涉及 Android 构建与 AVD）。
- GitHub Actions 部署工作流：**BLOCKED**（见 §5，等待用户配置 Environment 与 Secret）。
- 本报告脚本依赖 `/tmp/pwtest` 的 Playwright 1.65.0 与本地 `serve.mjs`；浏览器二进制未提交进仓库。