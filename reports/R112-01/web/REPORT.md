# R112-01 Web P1：窄屏通知条遮挡右上角「?」「i」悬浮按钮

> 任务：R112-01-W（Web 端独立 P1 验证与最小修复）
> 结论：**P1 FOUND + 已修复**（不是「无 P1」）
> 源码基线：`origin/main` = `09d513f`（R111-01 合并后）；分支 `r112-01/web-p1`
> 日期：2026-11-15（北京时间低谷时段）

## 1. 环境与真实运行方式

| 项 | 值 |
| --- | --- |
| Node / npm | Node v26.13.0 / npm 11.20.0 |
| 浏览器 | Playwright 1.65.0 + **Chromium 158.0.8127.18**（非 Edge、非桌面假装手机） |
| 视口 | 主验收 Pixel 7 手机视口 412×915（isMobile + hasTouch + Android Chrome UA）；补充 360×740、320×640 |
| 本地入口 | `node serve.mjs 8123` → `http://127.0.0.1:8123/`（真实 ES 模块加载，非 file://） |
| 初始状态 | 全新 browser context（无存档），默认设置：游戏速度 10000×、更新间隔 33 ms、统一自动节拍 10 s |
| CI 基线 | `gh run list --limit 10`：全部 success，最新 main Run 43605224696 |

## 2. 冒烟验收（真实浏览器，默认设置，真实点击/触控）

| 场景 | 结果 | 证据 |
| --- | --- | --- |
| 页面加载 + 开始新局 | **PASS** | loading 遮罩消失、`#ui` 渲染、pageerror 0；全新上下文自动开局，t0+3.3 s 达成首次无限（10000× 正常速度） |
| GUI 数值随 tick 更新 | **PASS** | 每 120 ms 采样 8 次，顶栏反物质显示 8/8 互不相同 |
| 自动购买器开关 | **PASS** | 点「暂停自动购买器」→ `player.auto.autobuyersOn` true→false；4 s 内 infinities 1→1、IP 10→10（冻结）；点「恢复」→ 3 s 内 infinities 1→2（恢复推进） |
| 关键按钮可点 | **PASS** | 真触控 tap：`买到 10 个` → 第一维度 1.146e191→2.254e191；`购买最大数量（M）` → 维度/AM 真实变化（AM 达 1.7976931348623157e308 = 无限门槛）；412/360/320 三档可见控件中心命中自身、无横向溢出 |
| 阶段显示 | **PASS** | 首次无限前可用页签仅 维度/选项/统计数据/成就/自动化；t0+3.3 s 首次无限后出现 挑战/无限；**永恒**页签直到 et=5 真实结算后才出现；240 s 内 realities=0，现实页签始终不可用 |
| 240 s 连续跑次（234 采样） | **PASS** | pageerror 0；UI 文本无 NaN/undefined/[object；`documentElement.scrollWidth == innerWidth` 全程成立 |
| 窄屏右上角「?」「i」可点性 | **FAIL → 已修复**（见 §3） | 见 §3 A/B |

## 3. P1：通知条盖住右上角「?（玩法说明）」「i（信息）」悬浮按钮

### 3.1 症状（修复前，真实运行）

`#notification-container` 是 `position:absolute; top:0; right:0; z-index:1000`，通知逐条从 y≈0 往下堆；
`HowToPlay` 的「?」（y 45~93）与「i」（y 96~144）是 `right:2rem` 的 48×48 悬浮按钮 —— 两者同在一条右侧竖带里。
通知条是 `pointer-events:auto`，因此**点击按钮命中的是通知（= 关闭一条通知），按钮本身收不到点击**。

- 默认 10000× 新档 10 s（20 次 ×500 ms）采样：平均 **2.55 条通知在屏**，「?」被遮挡 **8/20**、「i」被遮挡 **8/20 = 40%**。
- `elementFromPoint` 在「?」中心命中的是 `DIV.o-notification.o-notification--success`，不是按钮。

### 3.2 确定性 A/B（同一会话内用 addStyleTag 还原修复前规则，主循环冻结，真实 notify + 真实触控）

| 步骤 | 修复前 | 修复后 |
| --- | --- | --- |
| 2 条通知时「?」中心的命中元素 | `DIV.o-notification o-notification--success`（isSelf=false） | `DIV.o-tab-btn l-help-me`（isSelf=true） |
| 通知容器几何 | right=0px，max-width≈354px（盖住 x 303~406） | right=80px，max-width=322px（通知右缘 332 < 按钮左缘 344） |
| 触控 tap「?」 | **未打开玩法说明**，通知 2→1（点击被通知吃掉） | **打开玩法说明**（Modal.h2p.isOpen=true），通知 2→2（未消耗） |
| 触控 tap「i」 | 视遮挡条数而定 | 打开信息弹窗（Modal.information.isOpen=true） |

### 3.3 根因与修复

- 根因（上游继承 + MOD 窄屏适配遗漏）：通知容器与悬浮按钮共用右上角，MOD 在 R36/R51 已修过「通知容器遮挡大坍缩按钮」「教程/工具弹窗被通知遮挡（z-index 1001）」，但两个悬浮按钮没做同类处理。
- 修复（`public/stylesheets/oreki.css`，仅窄屏 `max-width: 900px`）：把通知容器右边界由 0 改为 `right: 8rem`（本页根字号 **1rem = 10px**，按钮竖带占右侧 68px → 80px 留 12px 净空），`max-width` 由 86vw 改为 `calc(100vw - 9rem)`（左缘仍留 10px），子项 `max-width` 同步同一算式（避免 320px 档 76vw 比容器更宽而反向溢出左缘）。
- **不改**：通知内容、条数（MAX_VISIBLE=4）、时长、点击关闭行为、z-index、桌面（>900px）布局。

### 3.4 修复后验证（全部真实运行）

| 验证 | 结果 |
| --- | --- |
| 新增回归用例 `.github/tests/notification-icon-hit.spec.mjs`（真实 notify 生成 4 条 + `elementFromPoint` + 真触控 tap「?」） | **PASS**（`npx playwright test --config=.github/playwright.config.mjs`：2 passed，含既有 web-smoke） |
| 反向验证用例有效性：临时还原修复前 CSS 再跑同一用例 | **FAIL**（断言「?」被 `DIV.o-notification` 遮挡），证明用例抓得住旧缺陷；随后恢复修复 |
| 320/360/412/768 四档 | 「?」「i」中心命中均为按钮自身；`scrollWidth == innerWidth`；通知容器左缘 ≥10px，无左溢出 |
| 桌面 1280 档 | 容器 right=0px 未变（修复未影响桌面） |
| 通知仍可点击关闭 | 四档实测点击通知体 → 容器子项数 -1，行为未变 |
| 通知不再遮挡其它按钮 | 4 条通知在 320/360/412 三档下，覆盖可见按钮中心的计数 = 0 |

### 3.5 已知边界（如实记录）

- 桌面（>900px）同样存在通知条与右上角图标的几何重叠（图标 20×20、通知 right:0）；本轮按「窄屏移动端 P1」范围只修 ≤900px，桌面未改，留作后续评估。**NOT FIXED（有意）**。
- 本轮**未部署 oreki.net**、未改 Pages 仓库、未动 Android（按任务边界）。
- 真机 Android Chrome / AVD 复验：**NOT RUN**（本轮按要求不碰 AVD；用 Playwright 手机视口 + 触控替代）。
- 上述场景之外（永恒/现实/天神/佩勒层、存档导入导出、离线结算）：**NOT RUN**（非本次修复范围）。

## 4. 改动文件

1. `public/stylesheets/oreki.css`：+31 行（仅新增窄屏规则与说明注释，无删除/改写上下游规则）。
2. `.github/tests/notification-icon-hit.spec.mjs`：新增 Playwright 回归用例（UI 命中 + 真触控，不推进游戏进度、不写存档字段）。

> 本报告不含大日志、Trace 或截图原图；原始证据（probe JSON / 前后截图 / Run 输出）留在本地 `.tmp/r112-web/evidence/` 与会话工作目录中，PR/CI 只保留可复核的判据与用例。
