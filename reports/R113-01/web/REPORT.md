# R113-01 · Web P1：桌面 / 平板通知条盖住右上角「?」「i」悬浮按钮（R112 未修桌面补全）

| 项 | 内容 |
| --- | --- |
| 任务 | R113-01 Web 独立 P1（team task-3） |
| 执行者 | web-p1 |
| 时间 | 2026-11-15 09:20–（UTC+8，周日全低谷） |
| 仓库/基线 | `OrekiDawson/AD-Oreki-Edition-Web` · `origin/main` = `1d64e2f`（冻结上游 `5409e320` 未动） |
| 工作树/分支 | `worktrees/web/r113-web-p1` · `r113-01/web-p1`（`git worktree add` 自 origin/main） |
| 结论 | **P1 FOUND → 已修复 → 本地真实 Chromium 回归 5/5 PASS**；未部署、未碰 Android/AVD |

## 1. 一句话结论

R112-01 只修了手机（≤900px）的通知条遮挡，并明确把桌面记为「未修（有意）」（`reports/R112-01/Web-P1.md` §6）。
本轮实测补全：**1280×800 / 1024×768 下 4 条通知在屏时，「?（玩法说明）」「i（信息）」悬浮按钮中心命中的是通知条**，
真实点击「?」只会关掉一条通知、玩法说明打不开 —— 与 R112 手机端缺陷同源同判据（按钮可见不可点）。
已用**仅 >900px 生效的 3 行 CSS**（`@media (min-width: 901px) { .l-notification-container { right: 4.4rem } }`）修复，
并新增 2 条桌面/平板 Playwright 回归用例：**修复前 2 failed / 修复后 5 passed**（含原有 3 条）。

## 2. 前置核对（真实输出）

- `git fetch origin --prune`；`origin/main` = `1d64e2f`（PR #38 合并提交），与任务给定一致；冻结上游 `5409e320` 未动。
- 主检出 `web/AD-Oreki-Edition` 在 `feat/r108-01-web-reality-chain`（落后 main 10 个提交，工作区干净），未触碰。
- 本轮新建独立 worktree `worktrees/web/r113-web-p1`（分支 `r113-01/web-p1`）。
- 环境：Node v26.13.0 / npm 11.20.0 / Playwright **1.65.0** / Chromium **158.0.8127.18**；本地 `node serve.mjs 8131` 真实 ES 模块加载。
- 双端最高玩法目标与非伪造约束：本轮只改 CSS 命中几何 + 测试，不写任何 `player` 字段、不改游戏时间源。

## 3. 复现（修复前，真实 Chromium）

脚本：`.tmp-r113/probe-toast.mjs`（本机临时证据，未入库）；流程：启动新档 → 冻结主循环 → 清空启动通知 →
`GameUI.notify.success` 造 4 条 120s 长寿命通知 → `elementFromPoint` 命中测试 → **真实鼠标点击**「?」。

### 3.1 修复前（1280×800 / 1024×768）

| 判据 | 1280×800 | 1024×768 |
| --- | --- | --- |
| 通知容器 computed `right` | `0px`（rect x=1144..1270） | `0px`（rect x=888..1014） |
| 「?」rect / 中心 | 1240,45,20,20 / (1250,55) | 984,45,20,20 / (994,55) |
| 「?」中心命中元素 | `DIV.o-notification.o-notification--success` | `DIV.o-notification.o-notification--success` |
| 真实点击「?」后 | 通知 4→**3**、`Modal.h2p.isOpen=false`、H2P 页签 **0** | 同左 |

即：按钮点不到，点击被通知吃掉（通知关闭 / H2P 不打开），与 R112 手机端 40% 遮挡相同性质。

### 3.2 根因

- `public/stylesheets/styles.css:5665`：`.l-notification-container { position:absolute; top:0; right:0; margin-right:1rem }`。
- `public/stylesheets/components.css:2267`：`.l-help-me { position:absolute; right:2rem; width/height:2rem }`，
  HowToPlay「?」`top≈4.5rem`、「i」`top≈9.6rem` —— 两者都在右侧竖带 `[vw-40, vw-20]`。
- 通知条 `z-index:1000`（高于图标）且子项 `pointer-events:auto` ⇒ `right:0` 的容器左向铺开时正好盖住图标。
- R112 的 `right:8rem` 只在 `@media (max-width:900px)` 内生效，>900px 仍走上游 `right:0` ⇒ 桌面/平板遗漏。

## 4. 修复（最小、单文件、仅 >900px）

`public/stylesheets/oreki.css` **+18 行**（含 11 行注释），新增：

```css
@media screen and (min-width: 901px) {
  .l-notification-container {
    right: 4.4rem; /* 本页根字号 10px：20px 图标 + right:2rem 边距 → 让出 44px */
  }
}
```

- 不动通知内容、条数（MAX_VISIBLE）、时长、点击关闭行为、`z-index`；
- 不动 R112 的 ≤900px 规则（手机端 computed `right` 仍为 `80px`，实测未变）；
- 不改 JS / 存档 / 游戏逻辑，不新增定时器。

## 5. 修复前后 A/B（同口径，真实 Chromium）

| 判据 | 修复前 | 修复后 |
| --- | --- | --- |
| 1280 容器 `right` / rect | `0px` / 1144..1270 | `44px` / 1100..1226 |
| 1280「?」中心命中 | `o-notification` | **`DIV.o-tab-btn.l-help-me [?]`（按钮自身）** |
| 1280 真实点击「?」 | 通知 4→3，H2P 未打开 | **通知保持 4，`Modal.h2p.isOpen=true`，H2P 页签 16** |
| 1024 同上 | 通知 4→3，H2P 未打开 | **通知保持 4，H2P 打开，16 页签** |
| 412（手机） | `right:80px`、命中按钮、H2P 打开 | **完全一致（无变化）** |

视觉证据（同一 4 条通知、未点击）：`evidence/toast-ab/before-1280-4toast-noClick.png`（「?」「i」被盖住不可见）
vs `evidence/toast-ab/after-1280-4toast-noClick.png`（右侧 20×20 图标露出且可点）。

## 6. 回归

### 6.1 Playwright 套件（本地真实 Chromium）

命令：`cd worktrees/web/r113-web-p1 && npx playwright test --config=.github/playwright.config.mjs`

- 修复后：**5 passed（14.0s）** —— `notification-icon-hit`（手机 412）、**新增** `notification-icon-hit-desktop`（1280 / 1024 两条）、
  `sidebar-resource-live`、`web-smoke`。
- 反向验证用例有效性：临时 `git checkout -- public/stylesheets/oreki.css`（还原修复前）再跑桌面用例 → **2 failed**；
  恢复修复后 → 2 passed。

### 6.2 手机视口回归（本次改动相关路径 + 关键路径，360×800 与 392×676）

脚本：`.tmp-r113/regress-mobile.mjs`；Android Chrome UA + `isMobile`/`hasTouch` + DPR 3 / 2.625，全新 context、真实触控。

| 检查 | pixel5 360×800 | narrow 392×676 |
| --- | --- | --- |
| 启动 `#ui` + `GameUI.initialized` | PASS | PASS |
| 4s 内反物质真实变化（GUI 实时更新） | PASS | PASS |
| 启动信息弹窗真实点击可关 | PASS | PASS |
| 「?」「i」中心命中按钮自身（通知在屏） | PASS | PASS |
| 通知容器 `right=80px`（R112 窄屏规则未变） | PASS | PASS |
| 点「?」打开 / 关闭玩法说明 | PASS | PASS |
| 抽屉导航打开 → 选项页签（抽屉收起 + 导出存档出现） | PASS | PASS |
| 返回维度页签 + 无横向溢出 | PASS | PASS |
| pageerror / 非预期 console error | 0 / 0 | 0 / 0 |
| 合计 | **13/13 PASS** | **13/13 PASS** |

（唯一 console error 为 `googletagmanager` 被页面 CSP 阻断，属预期，与上线验收口径一致。）

## 7. 边界与未做（如实）

- 真机 Android Chrome / AVD：**NOT RUN**（本轮用 Playwright 手机视口 + 触控替代；任务边界不碰 AVD）。
- oreki.net / Pages 部署：**NOT RUN**（由 Lead 统一决定）。
- Android 仓库、签名、密钥：**零触碰**。
- 桌面通知条仍会临时盖住页面右侧内容（上游 `z-index:1000` 设计）；本轮只解决「按钮可见不可点」的功能性遮挡，
  不调整通知层级/位置以外的观感（不在 P1 范围）。

## 8. 证据索引

仓库内（随 PR）：

- `reports/R113-01/web/REPORT.md`（本文件）
- `reports/R113-01/web/evidence/before-toast-probe.json` / `after-toast-probe.json`（命中元素、容器几何、真实点击结果）
- `reports/R113-01/web/evidence/toast-ab/before-1280-4toast-noClick.png` / `after-1280-4toast-noClick.png`
- `reports/R113-01/web/evidence/mobile-regression.json`（两档手机视口 26 项检查明细）

本机原始证据（不入库，可再生）：

- `.tmp/r113-web/toast/toast-desktop.json`、`.tmp/r113-web/toast-after2/toast-desktop.json`
- `.tmp/r113-web/scan1/`（360/392 全页控件遮挡/横向溢出扫描，修复前基线：主界面与各页签 0 遮挡）
- `.tmp/r113-web/h2p/h2p-result.json`（392×676 教程弹窗渲染检查：18 章、0 横向溢出）
- `worktrees/web/r113-web-p1/.tmp-r113/*.mjs`（复现/回归脚本）

## 9. 复现命令

```bash
cd /home/oreki/AD-Oreki-Unified/worktrees/web/r113-web-p1
npm ci
node serve.mjs 8131 &                 # 真实 ES 模块静态服务
npx playwright test --config=.github/playwright.config.mjs   # 5 passed
# 反向验证：git checkout -- public/stylesheets/oreki.css 后再跑桌面用例 → 2 failed；恢复后 2 passed
```
