# R112-01-W2：Web 端第二个独立 P1（侧栏「最新资源」不随真实解锁刷新）

| 项 | 内容 |
| --- | --- |
| 任务 | task-3 · R112-01-W2（Web 端第二个独立 P1） |
| 执行者 | r112-web2（Web 端独立开发者） |
| 时间 | 2026-11-15 05:59–06:5x（北京时间，周日全天低谷时段） |
| 仓库/基线 | `OrekiDawson/AD-Oreki-Edition-Web` · `origin/main` = `6f45370`（PR #37 合并后）；冻结上游 `5409e320` 未动 |
| 工作树 | `/home/oreki/AD-Oreki-Unified/worktrees/web/r112-web2`（`git worktree add`，分支 `r112-01/web-p1-2`） |
| 结论 | **P1 FOUND → 已修复 → PR（目标 main，单一目标）；未部署 oreki.net、未改 Pages、未动 Android/AVD** |

## 1. 一句话结论

现代 UI 侧栏货币的默认档（选项→视觉效果里的「侧栏（现代 UI）: 最新资源」）**只在页面加载那一刻解析一次**：
新档从反物质起步后，真实解锁无限点数 / 永恒点数 / 现实机器都不会切换侧栏货币，**必须刷新页面才会变成最新资源**。
这是「GUI 实时更新」类真实缺陷（player 不是 Vue 响应式对象 + computed 永久缓存）。
已用 `ModernSidebarCurrency.js` 的最小修复（8 行有效代码）解决，并新增 Playwright 回归用例：
**修复前 FAIL / 修复后 PASS**，同一用例与既有 2 条移动端用例一起 3 passed。

## 2. 前置核对（真实输出）

- `git fetch origin --prune`；`origin/main` = `6f45370fbcbf111e7fae9e69fdb69ddca4a0eb44`（任务给定值一致）。
- 主检出 `web/AD-Oreki-Edition` 在 `feat/r108-01-web-reality-chain`，未触碰其未提交内容；本轮新建独立 worktree。
- `gh run list --limit 10`：全部 `completed/success`，最新 main push Run `43629514366`。
- 环境：Node v26.13.0 / npm 11.20.0 / Playwright 1.65.0 / Chromium **158.0.8127.18**；本地静态服务器动态端口真实 ES 模块加载。
- 真实运行：Pixel 7 手机视口 **412×915**、DPR 2.625、`isMobile`+`hasTouch`、Android Chrome UA；全新 browser context（无存档）；默认 10000×、统一自动节拍 10 s。

## 3. P1：侧栏「最新资源」档不随真实解锁刷新（修复前）

### 3.1 症状与证据（真实运行，未改任何 player 字段）

确定性三阶段探针（`probe2.mjs`，同一上下文顺序采集）：

| 时刻 | 真实状态 | 侧栏应有 | 修复前实际 |
| --- | --- | --- | --- |
| T0 新档（未首次无限） | `availableIds=[2]`（反物质） | 反物质 | 反物质（正确） |
| T1 首次无限真实结算后（inf=1、IP=9，**未刷新页面**） | `availableIds=[2,3]`、latest=3 | 无限点数 | **仍是反物质（resolvedId=2）** |
| T2 手动触发 `$recompute('resource')`（根因验证） | 同上 | 无限点数 | 仍是反物质 —— 说明该 computed 连强制重算依赖都没挂上 |

补充 90 s 连续采样（`probe1`，10000× 新档自然推进到 et=5）：侧栏名称全程 `反物质`（`sidebarName` 只有 1 个取值），
而同一时段内 `PlayerProgress.eternityUnlocked()` 已为 true、`availableIds` 已包含 3/4/5。
即：**整局会话里侧栏货币都停在开局资源**，与「最新资源」的语义和选项页文案直接矛盾。

### 3.2 根因（读码 + 运行时内省）

`src/components/ui-modes/modern/ModernSidebarCurrency.js` 旧实现：

```js
resource() {   // computed
  return this.sidebarID === 0
    ? this.resourceDB.filter(e => e.isAvailable()).sort((a, b) => b.id - a.id)[0]
    : this.resourceDB.find(e => e.id === this.sidebarID);
}
update() { this.sidebarID = player.options.sidebarResourceID; /* ... */ }
```

1. `player` 是**普通对象**（`src/core/player.js` 直接赋值 `window.player`，全仓没有把它做成 Vue 响应式；
   `src/core/ui.js` 的 `ReactivityComplainer` 还专门检查它不能变成响应式）。因此 `e.isAvailable()` 读到的解锁状态
   **不会给 computed 建立响应式依赖**。
2. `sidebarID` 默认恒为 0，赋值同值不会让 computed 失效。
3. `src/core/ui.js` 的全局 mixin 在 `created` 里**先调用一次 `update()`**（页面初始化完成后才挂载侧栏），
   这次求值发生在 `makeRecomputable()` 包装 computed getter 之前（`ui.js:13-36`、`ui.js:79-85`），
   所以连「`$recompute('resource')` 强制失效」这条上游兜底也接不上（运行时内省：`_computedWatchers.resource.getter`
   已换成注入 `recomputed.resource` 的包装，但该 watcher 从未在包装后求值过）。
4. 结果：computed 永久命中第一次缓存 → 侧栏停在开局资源；刷新页面（组件重新挂载、此时已解锁的资源在首次求值里）
   才会显示最新资源 —— 与「刷新前 / 刷新后不一致」的现场一致。

上游对照：冻结基线 `5409e320` 的 `ModernSidebarCurrency.vue` 与旧实现逐字相同（上游继承缺陷，不是 MOD 回归）；
本次按「MOD 自身 P1」修，不改基线、不整包移植。

### 3.3 最小修复（`src/components/ui-modes/modern/ModernSidebarCurrency.js`，+27/-4）

- `data()` 新增响应式字段 `defaultResourceID: 2`（「最新资源」档当前解析到的资源 id）。
- `resource` computed 只读响应式字段：`sidebarID === 0 ? defaultResourceID : sidebarID`。
- `update()` 每帧把「当前真实可用资源里的最大 id」写入 `defaultResourceID`（只有真的解锁新资源才赋值 → 才触发重算）；
  显式选择档（`sidebarID !== 0`）语义完全不变。
- 不改存档结构/字段、不改资源定义、不改显示格式与样式，不新增定时器。

### 3.4 修复后 A/B（同口径真实运行）

| 项 | 修复前 | 修复后 |
| --- | --- | --- |
| T1 首次无限后 `resolvedId` / 显示名 | 2 / 反物质 | **3 / 无限点数** |
| 90 s 采样侧栏名称取值数 | 1（恒反物质） | 随解锁变化（本轮接口用例断言无限点数） |
| 新增回归用例 `.github/tests/sidebar-resource-live.spec.mjs` | **FAIL**（10 s 内 resolvedId 始终 2，而 latestAvailableId=3） | **PASS** |
| `npx playwright test --config=.github/playwright.config.mjs`（3 条移动端用例） | — | **3 passed（6.8 s）**；修复前失败输出见 `evidence/spec-prefix-fail.log`，修复后见 `evidence/spec-postfix-pass.log` |

回归用例只读 DOM/状态、不写 player 字段、不注入存档；首次无限由默认 10000× 真实游玩自然达成（CI 兼容）。

## 4. 定向验收（真实移动 Chromium，重点四区）

`reports/R112-01/web2/accept-r112-web2.mjs`（真实新档 + 真实 UI 点击/输入 + 状态断言，未写任何 player 进度字段）：
**42/42 PASS，pageerror 0**（`accept-final.log` / `evidence/accept-result-final.json`）。

| 区域 | 覆盖 | 结果 |
| --- | --- | --- |
| S1 自动购买器 | 面板 7 行实时数据；MOD 总开关「启用↔关闭」即时生效并写 localStorage；关闭后 8 s `actionCount/attemptCount/lastBeatAt` 全冻结且原版 `player.auto.autobuyersOn` 不变；改 1 秒间隔后 UI/存储即时一致；开启后 8 s 内真实进度（无限次数 5→7、IP→3.9e10）；面板阶段/目标行来自真实 `debugState`；1 秒间隔下真实点击购买 → `manualClickCount+2`、让路 `remainSec=60`、让路窗口内 actionCount 冻结；阶段门禁 `eternityStageAllowed === (infinityUnlocked && break)`；et=0 时无永恒层任务/页签；真实 UI 导出的存档文本可反序列化且基线自洽 | **17/17 PASS** |
| S2 GUI 实时更新 | 6 s × 26 次 DOM/状态采样：顶栏反物质 26/26 互不相同、IP 文本刷新、侧栏数值 4 种取值、存档计时 5.61→11.54 s 递增；侧栏「最新资源」用例断言 resolvedId=3/名称=无限点数 | **6/6 PASS** |
| S3 存档 | 自动化设置 UI 修改 → 刷新后 `enabled=true/interval=1` 保持；真实 UI 导出存档（7340 字符、反序列化校验通过）；写入后重载：阶段/无限次数/累计反物质不回退、阶段门禁页签一致；全新上下文真实 UI 导入（导入弹窗解析出「反物质/无限次数/离线进度」，确认后 inf 10→11、break=true、累计反物质 log10 增长、页签门禁一致）；导入后再重载与导出基线一致 | **13/13 PASS** |
| S4 阶段门禁 | 从新档 220 s 窗口每 200 ms 采样（125 个 pre-eternity 转换样本）：`infinity/eternity/reality` 页签可见性全程严格等于真实永久解锁标志；**首次永恒 74.9 s 真实结算**（et=5）时永恒页签才出现；reality=0 期间现实页签全程不可用；没有「未结算就出页签」的样本 | **6/6 PASS** |

修复前后页签门禁与自动购买器行为未变化（本次改动只在侧栏货币显示层）。

## 5. 改动文件

1. `src/components/ui-modes/modern/ModernSidebarCurrency.js`：+27/-4（含注释），修复「最新资源」档实时解析。
2. `.github/tests/sidebar-resource-live.spec.mjs`：新增 Playwright 移动端回归用例（真实首次无限 + DOM/状态断言，不写存档）。
3. `reports/R112-01/web2/REPORT.md`：本报告。

> 原始证据（探针 JSON、A/B 截图、验收 JSON/日志、修复前失败输出）7 MB 保留在本地
> `worktrees/web/r112-web2/reports/R112-01/web2/evidence/`，按证据分层规则不批量入库。

## 6. 边界（如实）

- **未部署 oreki.net、未改 Pages 仓库、未动 Android/AVD**（按任务边界）。
- 冻结上游基线 `5409e320` 未动；未整包移植；本缺陷与上游同源，属 MOD 产品层修复。
- 真机 Android Chrome / AVD 复验：**NOT RUN**（本轮用 Playwright 手机视口 + 触控替代）。
- 侧栏资源「选择下拉」在探针中实测会随解锁刷新（未复现同类缺陷），故未扩范围修改；其余设置项未逐项做刷新实时性矩阵，记 **NOT RUN / 后续**。
- 未发现需要新增的 Android/Web 行为差异。
