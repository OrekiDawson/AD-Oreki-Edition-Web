# Web 首次永恒与 PACING 诊断

日期：2026-11-22（UTC+8）

Owner：本机 Codex Lead

## 结论状态

按 Owner 对 2026-11-22 当前 Web 新档验证的明确指令，记录：

- **PACING：FAIL**
- **PROGRESSION：BLOCKED**
- 五阶段目标仍按 0～30、30～75、75～130、130～165、165～180 分钟五段判定。
- 高 IP 增长、首次 Infinity 或后续仍触发 Eternity，均不得把整体阶段阻塞改判为 PASS。

## 真实运行证据

### 首次失败跑次

本地证据：

`/home/oreki/AD-Oreki-Edition/测试与验收/R125/Web-PACING-FAIL-20261122`

- 真实墙钟：900.3 秒。
- 采样：91 条。
- 截图：18 张。
- 首次 Infinity：10.7 秒。
- 首次 Break：40.7 秒。
- 首次 Eternity：752.8 秒。
- 首次 Reality：`NOT RUN`。
- `runtimeErrors=[]`，连续性最大偏差约 0.00095 秒，`offlineTimeUsed=13ms`。
- 最终存档已通过 `GameStorage.exportModifiedSave` 真实导出。

### 只读门禁诊断跑次

本地证据：

`/home/oreki/AD-Oreki-Edition/测试与验收/R125/Web-首次永恒门禁诊断-20261122`

- 真实墙钟：840.3 秒。
- 采样：85 条。
- 首次 Infinity：21.2 秒。
- 首次 Break：51.3 秒。
- 首次 `canEternity=true`：482.8 秒，`thisEternity.maxIP=e568.55`，永恒门槛为 `e308.25`。
- 首次 Eternity：763.7 秒。
- 从 `canEternity=true` 到真实 Eternity：281 秒。
- 首次永恒驻留固定为 180 秒；驻留结束后的额外延迟：101 秒。
- 最终存档已真实导出；`runtimeErrors=[]`。

## 根因区分

### 已排除

- 不是 `Player.canEternity` 门槛错误：实际 `maxIP` 已高出门槛约 260 个数量级。
- 不是 MOD 自动化关闭：`active=true`、`eternityResetActive=true`、`autobuyersOn=true`。
- 不是全新档识别失败：`freshSessionBootstrap=true`、`adopted=true`。
- 不是玩家关闭：`userClosed=false`。
- 不是 EC pending 门禁：`ecEntryPending=false`。
- 不是运行错误或离线补算：两次跑次均无 runtime error、无连续性中断。

### 已确认的合法延迟

- `firstEternityDwellRemainingMs()` 按代码固定驻留 180 秒，诊断快照记录 `dwellStartedAt=482073ms`。
- 原版 `EternityAutobuyerState.isUnlocked` 在 100 次永恒前为 false，且新档 `isActive` 初始为 false；首次永恒由 MOD 的新档引导与接管路径驱动。
- 实际 Eternity 由原版 `eternity(false, true)` 合法入口完成，没有强制结算、没有注入资源或直接改存档。

### 调度延迟

- Web `runCycle` 每拍最多执行一个主动动作；默认调度间隔为 10 秒。
- 驻留结束后，低优先级 `routine/early/break` 等任务仍可能先占唯一动作槽。
- 诊断跑次在 180 秒驻留结束后仍额外等待约 101 秒，接近 10 个默认调度拍。
- 因此本次主要表现为“已满足条件但真实结算入口被后续排程延迟”，不是永久门禁阻断。

## 修复

1. `OrekiEternityAutomation.shouldPrioritizeSettlement()` 只在所有既有真实条件均允许、dwell 已结束时返回 true。
2. `game.js` 将该状态映射为 `eternityReset` 调度优先提示。
3. 该提示只改变“先问谁”；仍受全局 1～60 秒节拍、同帧单动作、自动器开关、Break、canEternity、dwell、EC pending、收益门槛和原版 `eternity()` 入口约束。
4. `noopReason("eternity")` 现在明确显示“首次永恒驻留中（剩余 N 秒）”，避免把驻留误报为普通空状态。
5. 运行探针新增只读字段：canEternity、永恒门槛/maxIP、自动永恒开关与解锁、dwell、adoption、EC pending、调度尝试序号、节拍和最近任务结果。

## 验证

- `node scripts/check_eternity_gate.mjs`：229/229 PASS。
- Web `scripts/tests/*.mjs`：20/20 PASS。
- `python3 scripts/tests/test_repository_policy.py`：15/15 PASS。
- `node --check`：`src/game.js`、`src/core/oreki-eternity-automation.js`、`src/core/oreki-smart-executor.js`、`scripts/run-r124-full-web.mjs` 全部 PASS。

## Android 同步核对

- Android 使用相同的 `Player.canEternity` 语义、180 秒首次永恒 dwell、autoEternity 接管和真实原版结算入口。
- Android 的 `tickEternityGated()` 在每个 autoBuyerTick 中直接运行，不经过 Web `runCycle` 的单动作候选排序；未发现同构的 100 秒优先级排队路径。
- Android AVD/真机尚未重跑，本项为 `NOT RUN`。若后续真实运行出现同类延迟，必须另立定向证据，不以本 Web 修复推断 Android PASS。

## 后续门禁

修复后必须使用全新 Web 新档重跑，至少验证首次 Eternity 在 dwell 结束后不超过一个默认调度拍即触发。完整 Reality、Dilation、Pelle 与 Credits 仍需更长真实跑次，当前不得宣布 PACING 或 ENDGAME PASS。
