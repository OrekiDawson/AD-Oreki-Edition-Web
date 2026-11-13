# R107-01 P0 根因：EP e4000 墙的「永恒自动结算循环」

> 状态标记：**已证实** = 本仓源码/真实运行数据可直接复核；**推断** = 有强证据但未逐调用栈证明。
> 证据目录：`reports/R107-01/ep-wall-fix/`（diag-stall2/、diag-stall3/、verify-fix/）。

## 1. 现象（已证实）

两轮真实新档（10000×，间隔 1s）都在 **realities=15、EP=e3683.25** 处彻底冻结：
- 主跑 `reports/R107-01/run-180min/`：10794.3 s，EP 从 wall 4909.4 s 起冻结在 e3683.25，共 5890.1 s 零增长。
- A/B `reports/R107-01/run-interval1/`：3596.2 s，EP 从 wall 649.2 s 的 e3683.63 起冻结，共 2950.1 s。
- 冻结签名：`realities=15, maxEpExponent=3683, gainedEPLog10=5.43, maxIP=5e130`、
  `dimBoost=4, gal=1, id1Unl=false, amLog10=maxAMLog10=130.699`、`canEternity=false`、
  `served.eternityReset=6`（MOD 执行层不再结算永恒）、`eAdopted=true, eAutoActive=true`。

## 2. 现场取证（只读；未写任何 player 字段）

新增三个诊断脚本（均为 Playwright + 真实 UI 配置，不改存档字段）：
- `probe-ep-wall-a/b.mjs`：20000×/100000× 复现；两者同样在 realities≈15、EP≈e3683 处冻结。
- `diag-stall2.mjs`：10000× + 间隔 1s，冻结持续 60 s 后写入 200 ms 逐帧跟踪并继续采样。
- `diag-stall3.mjs`：冻结后执行只读交互诊断（读 canTick 子条件、手动调原版
  `Autobuyers.tick()` / `buyMaxDimension(1)` / `AntimatterDimensions.tick(1000)`）。

关键运行：`diag-stall2` 在 wall 748.2 s 捕捉到稳定冻结；`diag-stall3` 在 wall 666.5 s 捕捉到同一状态并完成交互诊断。

### 冻结现场实测值（已证实）

| 字段 | 值 | 含义 |
|---|---|---|
| `player.antimatter` | `4.999999999999999e+130` | 恰好等于 SAM perk 的 startingValue |
| `player.records.thisInfinity.maxAM` | 同 5e130 | 本次无限从未产出过更高峰值 |
| `player.records.thisEternity.maxIP` | `5e130`（log10=130.699） | 恰好等于 SIP2 perk 的 startingValue |
| `Currency.infinityPoints` | `≈4e130`（log10=130.59） | 同上，被永恒重置回起始值 |
| 8 个反物质维度 amount | 全部 `0` | 每次采样都是刚重置后的状态 |
| `Autobuyer.antimatterDimension(1).canTick` | **true** | 所有购买条件（active/affordable/interval）都满足 |
| 同上 `data.lastTick` | **0** | 自动购买器从未 tick 过（每次重置被清零） |
| `Autobuyers.tick()` 手动调用后 300 ms | 维度仍 0、lastTick 仍 0 | 调用后被下一帧重置抵消 |
| `eternities`（54 位截断串） | 冻结期间持续快速上涨 | 永恒奖励在持续发生 |
| `player.auto.eternity` | `{mode:0(AMOUNT), amount:1, isActive:true}` | 原版自动永恒被接管且是默认「立刻结算」配置 |

## 3. 根因链

### 3.1 直接原因（已证实 + 代码路径可复核）

**R104 的「接管原版自动永恒」修复（commit `62f41e7`，P0-1）只打开了开关，没有改结算门槛。**

- 默认存档 `player.auto.eternity = {mode:0(AMOUNT), amount:1, xHighest:1, isActive:false}`
  （`src/core/player.js:73-80`）。
- `EternityAutobuyerState.willEternity` 在 AMOUNT 模式下是
  `gainedEternityPoints().gte(this.amount)`（`src/core/autobuyers/eternity-autobuyer.js:101-121`），
  amount=1 ⇒ **只要 `Player.canEternity` 为真，本帧就结算永恒**。
- `_adoptEternityAutobuyerIfNeeded()`（`src/core/oreki-eternity-automation.js:900-917`）
  在 100 次永恒的里程碑解锁后把 `isActive` 置 true，但保留默认 AMOUNT=1。

### 3.2 为什么 canEternity 会被立刻恢复（推断，证据充分）

- 永恒重置把 IP 设回 SIP2 的起始值 5e130（`currency.js` 的 `startingValue`，perk 见 `perks.js`）。
- 但每帧的 `preProductionGenerateIP(diff)`（`src/core/big-crunch.js:173-191`）会按
  `InfinityUpgrade.ipGen` / `BreakInfinityUpgrade.ipGen` **被动加 IP**，与本局是否坍缩无关。
- 在 10000× 下 `diff` 每帧极大，被动 IP 在一帧内就能把 IP 重新推过 `Player.infinityGoal`（1.797e308）
  ⇒ 下一帧 `canEternity` 又为真 ⇒ 原版自动永恒再次结算。
- 于是形成「**每帧/近每帧永恒重置**」：`thisEternity.maxIP` 永远刚被重置成 5e130，
  `gainedEP = 5^(log10(maxIP)/30−0.7)×mult ≈ e5.4`（冻结样本 `gainedEPLog10=5.43`），
  而当前 EP 已经是 e3683 —— **gainedEP 比 EP 小 3678 个数量级**，EP 永远不会再涨。

### 3.3 为什么 R50（旧代码）能通关（已证实）

- R50 提交 `a926a45` 的 `src/core/oreki-eternity-automation.js` **没有**
  `_adoptEternityAutobuyerIfNeeded`（`git show a926a45:... | grep adopt` 无结果），
  也不写 `player.auto.eternity.isActive`；原版自动永恒保持默认 `isActive=false`。
- 永恒由 MOD 自己的 `tickEternity()` 驱动，门槛是「EP 收益 ≥ 当前 EP 的 10 倍」，
  只有真正的大收益才结算 ⇒ `maxIP` 能一路涨到 e4.3e7（R50 fresh8 实测），EP 持续增长，
  realities 从 0 涨到 100、739.6 s 通关。
- 结论：**回归点是 R104 的自动永恒接管，而不是 EP 除数/机制不可达**。

### 3.4 排除项（已证实）

| 假设 | 结论 |
|---|---|
| EP 除数 30/308 切换错误 | 排除：冻结时 `ds6=false` ⇒ `isOrekiBootstrapRun()=true` ⇒ 除数已经是 30 |
| `isRealityAvailable()` 门槛写错 | 排除：它要求 `maxEP.exponent≥4000 && TimeStudy.reality.isBought`，冻结时 maxEP 指数只有 3683 |
| AM 产量/维度机制坏了 | 排除：逐帧跟踪里 AM 可在重置后正常涨到 e1153+，只是被下一次永恒重置清掉 |
| 崩溃/异常 | 排除：`pageErrors=0`，gameLoop 持续运行（记录时间与被动生成都在走） |

## 4. 为什么 R104 验收没发现

R104 的回归跑次只验证到「首次永恒 / 首次现实 / realities 5~10」等前段里程碑，
冻结要到**第一次大幅 EP 跳变（e117→e3683）之后**才出现；该跳变发生在本轮 realities≈15 的
reality tree 阶段，因此只有在 180 分钟全程 / 更长的 A/B 跑次里才暴露。

## 5. 残留不确定（推断）

- 重置频率是「每帧」还是「每几帧一次」，没有插桩统计每次 eternity 调用；
  证据是 `lastTick` 恒 0、维度恒 0、IP 恒起始值，以及 et/被动计数器持续上涨。
- 被动 IP 生成的具体档位（`InfinityUpgrade.ipGen` 是否已购）未在冻结快照中逐项取证；
  但「canEternity 被快速恢复」这一行为在修复前样本中反复出现（EP 冻结、maxIP 恒 5e130）。
