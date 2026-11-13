# R107-01 修复验证（web-parity，2026-11-14）

> 环境：Playwright + Chromium（Pixel 7 视口 412×839/DPR2.625/isMobile/hasTouch/zh-CN），
> 真实新档；间隔=1s、固定游戏速度（注明 10000× / 100000×）、动态速度关闭。
> 宿主为共享机器（gate-gui 同期做 Android 验收），wall 数字按「争抢环境」记录。
> 所有速度/间隔均为玩家可配置项；**未写任何 `player` 字段、未改 `gameEnd`/进度字段、未伪造结算**。

## 1. 修复前基线（已证实 FAIL）

| 跑次 | wall | 结果 | 证据 |
|---|---|---|---|
| A/B 主跑（interval=1，10000×） | 3596.2 s | realities=15、EP=e3683.25，冻结 2950.1 s | `reports/R107-01/run-interval1/` |
| 180 min 主跑（默认 10s） | 10794.3 s | realities=15、EP 冻结 5890.1 s | `reports/R107-01/run-180min/` |
| diag-stall2（修复前复现） | 748.2 s | 稳定冻结；AM=5e130、dims=0、autobuyer `lastTick=0` | `ep-wall-fix/diag-stall2/` |
| diag-stall3（修复前交互诊断） | 666.5 s | 冻结现场；手动 `Autobuyers.tick()` 后 300 ms 仍回到起始态 | `ep-wall-fix/diag-stall3/interactive-diag.json` |

## 2. 修复后定向验证（10000×，interval=1）——PASS

跑次 `ep-wall-fix/verify-fix/`（`verify-ep-wall-fix.mjs`；`traceInstalled` 未定义 bug 已修，`summary.json` 已补写）：

| 里程碑 | wall |
|---|---|
| r1 / r5 | 410.8 s |
| r10 | 573.0 s |
| **r15（修复前永久冻结点）** | **654.2 s** |
| **r20** | **731.2 s** |
| 首次 EP ≥ e4000 | 104.9 s |

- 冻结签名检查：无「AM=5e130 持续 ≥60 s」窗口（`stall_windows=[]`）；`pageErrors=0`；
  最高 EP log10≈3.56e6。
- 结论：**realities 从 15 突破到 20+，isRealityAvailable() 反复通过（每次 reality 推进的前提）**。

## 3. 延长验证：r50 与 gameEnd 尝试

### 3.1 两个 30 min 窗口跑次（均到 r50 停止）

| 跑次 | 速度 | wall | 结果 | 冻结窗口 | 最高 EP |
|---|---|---|---|---|---|
| `verify-fix-long/` | 10000× | **r50 @ 1055.4 s** | 阶段推进到 celestialsEnslaved（Teresa→Effarig→Enslaved） | 无 | log10 3.26e6 |
| `verify-gameend-100k/` | 100000× | **r50 @ 1011.9 s** | 阶段推进到 laitela（goal unlock-pelle） | 无 | log10 6.29e6 |

两个跑次 `pageErrors=0`、`realityAvailable=true` 采样 45/49 次，均未出现修复前的 EP 冻结签名。

### 3.2 gameEnd 专项跑次（100000×，只以 gameEnd 为停止条件，30 min 上限）

跑次 `verify-gameend-focus/`（1800 s 上限，实际到 1798.4 s；期间宿主负载 0.6~17）：

| 里程碑 | wall |
|---|---|
| r10 / r15 | 561.4 s / 670.3 s |
| r16 / r20 | 737.5 s / 737.5 s |
| r30 | 1417.8 s |
| r50 | 1568.9 s |
| **结束时** | **realities=75、stage=laitela、goal=unlock-pelle、gameEnd=未发生（endState=0）** |

- `gameEndAtWall=null`，`pageErrors=0`，`realityAvailableTrue` 采样 54 次，无冻结签名。
- 结论：**30 min / r75 内未到 gameEnd**；EP 墙已修好，但后期 celestial/Laitela→Pelle 链与
  R50→HEAD 的节拍回归仍可能让「180 min 通关」超时（见 `static-regression-diff.md`）。

> 完整 180 分钟默认配置真实跑次：**NOT RUN**（本轮时间预算内未执行全量 180 min）。

## 4. 回归：定向验收 49/49——PASS

- 命令：`node reports/R107-01/accept-r107-01.mjs`
- 结果：**49/49 PASS**（S0 5、S1 6、S2 11、S3 21、S4 6），`EXIT:0`。
- 日志：`reports/R107-01/accept-r107-01-after-epfix.log`；结果：`reports/R107-01/result.json`。
- 修复前结果备份：`reports/R107-01/result-r107-01-beforefix-epfix.json`。

## 5. 结论与门禁建议

- 「EP e4000 墙」根因已证实（见 `ROOT-CAUSE.md`）：R104 接管原版自动永恒后保留默认
  `AMOUNT=1`，形成近每帧永恒重置，`maxIP` 钉死在 SIP2 起始值 5e130，EP 无法增长。
- 最小修复（+29 行，单文件）后：**realities 15→20→50、EP 持续增长、无冻结**，
  阶段推进到 Teresa/Effarig/Enslaved/Laitela，49/49 验收 PASS。
- 建议：把本修复作为 **180 min 门禁的修复候选**；注意 gameEnd 在 30 min 内**未完成**
  （见 §3），且 R50→HEAD 还有「连续购买路径不再每帧执行」的节拍回归（见
  `static-regression-diff.md` R1/R2），若 180 min 门禁最终仍超时，应优先评估该回归。
- 门禁最终 PASS 仍需要一次 **默认间隔、完整 180 分钟、真实跑到 gameEnd** 的跑次（本轮 NOT RUN）。

## 6. 状态总表

| 项 | 状态 |
|---|---|
| 根因定位 | **已证实** |
| 最小修复 | **已完成**（未 commit/push） |
| realities 突破 15 | **PASS（r20、最高 r50）** |
| isRealityAvailable 通过 | **PASS**（reality 持续推进 + rav 采样） |
| realities 持续增长 | **PASS（15→20→30→50）** |
| gameEnd | **FAIL/NOT RUN**：30 min、100000×、r75、stage=laitela/unlock-pelle 未到 gameEnd |
| 180 min 默认配置真实跑次 | **NOT RUN** |
| 49/49 定向验收 | **PASS（49/49）** |
