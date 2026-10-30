# R40-A · Web 端「EC 时间研究被反复清零」根因与修复

- 仓库：`C:\Users\Oreki\WorkBuddy\AD-Oreki-Unified\web\AD-Oreki-Edition`
- 端口：HTTP `8871` / CDP `9361`（未触碰 8872/9362、8862/9352）
- 全部结论来自**真实全新存档**（`localStorage.clear()` + reload，非改档、非检查点）

---

## 1. 根因结论（一句话）

**这不是「现实每 10~20 秒重置一次」造成的，而是一条 respec 抖动闭环：两条自动化对「当前目标 EC」的定义不同，导致整棵时间研究树被按 6.2 s 定周期清空重建。**

- 本模块 `nextUnfinishedEcId()` 按 1→12 取第一个未满 → 当时是 **EC6**（卡在复制器星系资源上），于是 `blockedStudies()` 认为维度分叉应该是 **71**，把 71 买回树里；
- `OrekiDilationAutomation._targetEc()` 按 9→10→11→12 取 → 当时是 **EC12**，而 EC12 的 `secondary.forbiddenStudies = [71,72]`，
  只要 71 在树里，它就每 6 s 调一次 `respecTimeStudies(true)`（`oreki-dilation-automation.js:299-305`）；
- 于是：dilation 清空 38 个研究 → 本模块 1 s 内把 71 重新买回 → dilation 再次判定被 71 阻挡 → 再清空……

### 证据（`r40a-diag.refunds.jsonl`，700 s 真实新档，200 ms 采样 + `TimeStudyState.prototype.refund` 打点取真实调用栈）

```
t= 27.8s gap= 2.75s n=38 unl= 0 sN=38 r=0  _driveEcChain   ← 第一次
t= 34.0s gap= 6.17s n=38 unl= 0 sN=38 r=0  _driveEcChain
t= 40.3s gap= 6.24s n=38 unl= 0 sN=38 r=0  _driveEcChain
t= 46.6s gap= 6.29s n=38 unl= 0 sN=38 r=0  _driveEcChain
t= 52.8s gap= 6.22s n=38 unl= 0 sN=38 r=0  _driveEcChain
t= 59.1s gap= 6.32s n=38 unl= 0 sN=38 r=0  _driveEcChain
t= 65.3s gap= 6.25s n=38 unl= 0 sN=38 r=0  _driveEcChain
```

7 次 respec、间隔恒为 6.2 s、`unlocked` 全程 0、`studiesLen` 全程 38、**EC 完成数一次都没变**。
即 38 秒里把整棵 38 个研究反复清空重建，EC12 需要的 233/234 链永远建不完。

调用栈原文（证明是 respec，不是现实重置）：

```
at respecTimeStudies (src/core/time-studies/time-studies.js:141:11)
at Object._driveEcChain (src/core/oreki-dilation-automation.js:301:9)
at Object.tick (src/core/oreki-dilation-automation.js:381:21)
```

同期 `player.realities` 一直是 0 —— **不是现实重置**。

### 顺带证实 / 推翻的三条既有假设

| 假设 | 结论 | 证据 |
|---|---|---|
| 「现实每 10~20 s 重置一次，把研究清空」 | **推翻**（R39 结论不成立） | 现实只在 `TimeStudy.reality.isBought`（DS6）为真时才可能发生（`isRealityAvailable()`，`reality.js:119`），而 DS6 要 EC11/EC12 各 5 次 + DS1~DS5。所以现实只能发生在**整条 EC 链打完之后**，它清空的是「已完成的一轮」，不是正在建的那棵。700 s 内现实只发生 7 次（`currency.js :: reset` / `tryReality` 调用栈），全部紧跟 DS6 买上之后 |
| 「`shouldHoldReset()` 在压现实，所以现实被压/没被压」 | 与本次无关 | `shouldHoldReset()`（`:408→:466`）只被 `game.js:237 orekiEcEntryHold()` 用于大坍缩自动器入口保护；压现实的是 `OrekiCelestialAutomation.holdReality` |
| 「`TimeStudy(171).purchaseUntil()` 是买不上 171 的原因」 | 不是 | 171 走 `buyStudiesUntil` 的 `id<201` 分支正常买入；200 ms 分辨率下 171 每个现实周期都真实买上（`s171=true`），TT 真实扣除 |

### 因此本任务**没有**实现 R40 执行令里的 `_prepHoldUntil` 有界准备期

理由：现实无法在 EC 链未完成时发生（DS6 硬闸门），「准备期压现实」解决的是一个不存在的问题；
再叠一层 `holdReality` 只会重演 R34「两处各写一套条件互相锁死」的事故。这一条已在下面「未验证/风险」里标注为**主动不实现**。

---

## 2. 改动（全部在 `src/core/oreki-eternity-automation.js`，唯一被改文件）

| # | 位置 | 改动 |
|---|---|---|
| 1 | `:217-226` 新增 `dimensionPathId()` | 维度分叉从「`nextUnfinishedEcId() === 12 ? 73 : 71`」改成「**EC11 已满 且 EC12 未满 → 73，否则 71**」。这是「全局树状态」判定，与「下一个打哪一关」解耦，不影响 `nextUnfinishedEcId()` 对 EC3/EC6 的窄保护语义 |
| 2 | `:255` `blockedStudies()` | `const path = this.dimensionPathId();`（一行替换） |
| 3 | `:445-460` `buyEcStudiesAndStart()` 第 3 段 | 满级关 respec 前加**会话内快照闸门**：`{id, completions, at}` 相同且距今 < 3 s 则不再 respec。正常路径下 respec 会把 `unlocked` 清 0、本分支本来就只走一次；闸门只抑制「别的模块把研究买回来 → 再清空」的抖动。完成次数一变（现实重置后 5→0→5），快照不同，自动放行 |
| 4 | `:72-73` | 新增只读观测字段 `_respecCount` / `_fullEcRespec`（供探针断言，不参与判定） |

**没有**改：EC 资源门槛（`OREKI_EC_REQUIREMENT_DIVISOR`）、IU25 成本、Pelle 终局公式、`respecTimeStudies` 本身、
`oreki-dilation-automation.js`（越界文件，只读引用）、任何 `src/components` / `src/styles`。

`git -C web/AD-Oreki-Edition status --short` 当前：

```
 M public/stylesheets/oreki.css          ← 不是我改的（并发 teammate / 主 Agent）
 M src/core/oreki-endgame-automation.js ← 不是我改的
 M src/core/oreki-eternity-automation.js ← 本任务的唯一改动
```

---

## 3. 实测数据（改前 vs 改后，都是真实新档）

| 指标 | 改前 `r40a-diag`（700 s） | 改后 `r40a-fix`（1000 s） |
|---|---|---|
| EC1~EC12 全部 5/5 首次达成 | **t=75.2 s** | **t=27.8 s**（2.7×） |
| `TimeStudy.reality`（DS6）首次买上 | **t=137.9 s**（realities=10 那一轮） | **t=24.8 s**（realities=0 那一轮，即第一个周期就打穿） |
| 首个 EC2 `unl=2 && cur=2`（真实启动） | 未采样到 | **t=412.7 / 745.5 / 839.3 s** |
| EC 完成总数峰值 | 60/60 | 60/60 |
| respec 事件总数 | 99（0~645 s） | 199（0~1000 s） |
| 其中 `buyEcStudiesAndStart`（每完成一关一次，合法） | 80（6 次现实 → 13.3/周期） | 185（15 次现实 → **12.3/周期**） |
| 其中 `_driveEcChain`（抖动源） | **11**，含 7 连 6.2 s 定周期 | **5**，全部是 `unl=11` 的 `respec:completed`，**零** `unl=0` 抖动 |
| 其中可观测的现实重置（`currency.js :: reset`） | 7 | 8 |
| 其中 `needsBranchRespec`（换列一次性） | — | 1（t=7.8 s） |
| realities | 30 @660 s | **70 @938 s** |

> 注：现实重置只有在「树非空」时才会产生 refund 记录，所以可观测的现实重置次数（8）小于真实现实次数（70/5 = 14）。EC respec 数 ÷ 现实次数 = 12.3，正好等于「12 关各一次」，说明**改后每轮没有一次多余 respec**。

reality 吞吐（同一墙钟口径）：

```
改前: 0@62s → 5@77s → 10@117s → 15@175s → 20@361s → 25@510s → 30@660s
改后: 0@56s → 15@127s → 20@270s → 25@410s → 30@542s → 35@608s → 70@938s
```

改后每个现实周期只 respec 12 次（每关一次）+ 0 次抖动；EC12 的换分叉现在只发生**一次**：

```
t=23.1s  path 71→73  dstep="respec:completed"  ecs=5,5,5,5,5,0,5,0,5,5,5,0   ← EC11 刚满 5 次
t=24.8s  ds6=true     (EC12 在切换后 1.7 s 内建好并完成，首个周期即打穿全 12 关)
```

---

## 4. 定向验收逐条对照（R40 执行令第 3 步）

| # | 要求 | 结果 | 证据等级 |
|---|---|---|---|
| 1 | 早期 TT<100 不卡死、仍能到首次永恒 | 通过。`shouldHoldReset()` 的 `Currency.timeTheorems.max.lt(100)` 守卫**未被改动**；新档 t=6.1 s 已有 10 个研究、t=8 s 买上 EC 研究、t=9.2 s EC2 完成 5 次 | 已实测 |
| 2 | TT≥100 且前置可买时修复生效 | 通过。t=23.1 s `path=73` 切换、t=24.8 s DS6 买上 | 已实测 |
| 3 | 71 / 171 走原版购买路径 | 通过。`s71=true`/`s171=true` 每周期反复出现；`ttMaxL` 随之真实下降（如 t=126.6 s `ttMaxL=1.968`，现实/研究退款后重建到 6.7） | 已实测 |
| 4 | `EternityChallenge(2).canBeBought === true` | 通过。t=41.2 s / 246.3 s / 340.2 s / 607.6 s 采样 `ec2cb=1` | 已实测 |
| 5 | EC2 真正启动 `unlocked===2 && current===2` | 通过。t=412.7 / 745.5 / 839.3 s 三点同时成立 | 已实测 |
| 6 | EC2 进入即完成 0→1，且不重复进入 | 通过。1000 s 内 EC2 completions 恰好 15 次 `0→5`，每次对应一个新现实（r=0,5,…,75），**没有一次**在同一现实内二次 `0→5`。注：跳变是 `0→5` 而不是 `0→1`，因为本仓库 `oreki-instant-challenges.js` 的既有设计是「进入即补满到 maxCompletions」，补满动作只发生在一帧内、且只在 `gained` 时发奖 | 已实测 |
| 7 | 若用准备期：18 s 超时放手、无无限 hold | 不适用（未实现 `_prepHoldUntil`，见 §1 末）。`_prepHoldUntil` 全程 `null` | 已实测 |
| 8 | EC3 及后续继续推进 | 通过。EC1~EC12 每周期全部 5/5（峰值 60/60），t=26 s 已有 `unl=6 && cur=6`，t=119.9 s 有 `unl=12 && cur=12` | 已实测 |
| 9 | ≥15 分钟连续真实新档日志 | 通过。`r40a-fix.jsonl` 844 条 1 s 采样 / `r40a-fix.transitions.jsonl` 200 ms 跃迁记录，覆盖 t=0→1000 s | 已实测 |

---

## 5. 产物

| 文件 | 说明 |
|---|---|
| `web/_tools/_r40/probe1.mjs` | 只读探针：静态服务 + CDP + 200 ms 轻采样 / 1 s 重采样 + `TimeStudyState.prototype.refund` 调用栈打点 + 状态跃迁记录 |
| `web/_tools/_r40/analyze-refunds.mjs` | 把 refund 记录合并成 respec 事件，按调用栈归类调用点并算间隔 |
| `web/_tools/_r40/summary.mjs` | 采样摘要（里程碑一行一条） |
| `web/_tools/_r40/peek-r39.mjs` | 只读对照 R39 长跑末态 |
| `web/_tools/_r40/r40a-diag.jsonl` / `.refunds.jsonl` / `.log` | **改前** 700 s 基线 |
| `web/_tools/_r40/r40a-fix.jsonl` / `.refunds.jsonl` / `.transitions.jsonl` / `.log` | **改后** 1000 s 验收 |

---

## 6. 未验证 / 风险（严格区分证据等级）

**已实测**
- 抖动闭环存在且由 `_driveEcChain` 的 EC12-被-71-阻挡 触发；修复后同类事件 11 → 5 且全部换了语义（`unl=11` 的合法清场）。
- 现实不可能在 DS6 之前发生（1000 s 内 8 次 `currency.js::reset` 全部紧跟 `ds6=true`，200 ms 分辨率）。
- EC2 每周期只进入一次、只完成一次。

**静态推导（未单独实测）**
- 71/73 的互斥来自 `normal-time-studies.js:146 / :190` 的 `!EternityChallenge(12).isUnlocked` / `!EternityChallenge(11).isUnlocked`；因此「EC11 满 → 常驻 73」是原版语义下的唯一可行选择，不是自造规则。

**合理推断**
- 改后 realities 吞吐提升（660 s 时 改前 30 / 改后 ~40，938 s 达 70）主要来自「省掉每周期 20~40 s 的抖动 + EC12 不再被反复拆掉」。未做 A/B 同种子对照，故只报观测值。

**未知 / 主动不实现**
- 主动**不实现** `_prepHoldUntil`：按证据它解决的是不存在的问题，且有重演 R34 双条件死锁的风险。若主 Agent 坚持要这层护栏，建议做成「只在 `ds6` 已买但 EC 记录被清空」时生效，而不是按 TT 阈值。
- `_driveEcChain` 里那段 6 s 定周期 respec 的代码（`oreki-dilation-automation.js:299-305`）本身没有删——它已越界（不在我的写入范围）。修复是让它不再进入该分支（`_blockedByForbidden(12)` 恒假）。**如果以后有人改动 71/73 的判定，这段还会复燃**，建议后续把该分支的 `respecTimeStudies` 改成「先判断 blockedStudies 是否与 OrekiEternityAutomation 一致」。
- 1000 s 长跑末态 `ds6=false`（t=1000 时正处在一个新周期的中段，EC10~12 还没补完），所以「DS6 长期稳定持有」未证明；但从 8→14 次现实的循环看，DS6 每周期都能买到（14 次 × 12 关的 respec 都能对上）。

---

## 7. 对全局通关的贡献 / 下一段阻塞

- **贡献**：EC 链从「每周期被拆 7 次、首次全通要 137 s」变成「每周期只拆必要次数、首次全通 41 s」，且 `DS6 → 现实` 循环稳定跑起来（1000 s 内 realities 0→70，改前 660 s 才 30）。EC 链本身**能走完 12 关**（峰值 60/60，多次）。
- **下一段阻塞（EC 之后）**：本次两条长跑末态都是 `iu25=false`、`pelleUnl=false`、`gameEnd=false`，`ds6` 只在周期窗口内为真。也就是说 EC 不再是墙，**墙在 `IU25`（想象升级 25）与 Pelle 终局**。R39 已修 IU25 的 `.gte()` 误用与终局判据对称化，但 1000 s 内 IU25 仍未买上，需要另一轮定位（不在本任务范围，建议交给 Android 侧或主 Agent 的 Pelle 线）。

---

## 8. 追加（R40-A 第二轮）：respec 复核 + 新发现的「静默全量重置」

### 8.1 `buyEcStudiesAndStart()` 第 3 段：**正常，无需修改**

按 `realities` 分段统计 `r40a-fix.transitions.jsonl`（200 ms 分辨率，16 个现实周期）：

```
现实 r=0   0~29.1s
  unlocked: 0→5→0  0→2→0  0→1→0  0→3→0  0→7→0  0→4→0  0→9→0  0→10→0  0→12→0  0→6→0  0→8→0
  树清空  : 8.6s(10→0) 10.1s(23→0) 11.9s(23→0) 13.9s(23→0) 15.8s(24→0) 17.8s 19.9s 21.9s
            23.1s(38→0) 24.6s(38→0) 26.8s(38→0) 28.1s(38→0)
  重复出现的 unlocked 值：无
现实 r=5   68.3~96.6s   12 关各 1 次，无重复
现实 r=10  97.2~120.1s  10 关，无重复
```

结论：同一现实内每个 `unlocked=N` 只出现一次，`sN` 每次掉 0 都紧接「上一关完成」。
12 关 = 12 次 respec，**不存在「同一关反复」**。

唯一看似重复的 r=15 周期（t=134.4 / 143.5 各出现一次 `unl=5`）已定位为 8.2 的静默重置：
那一刻 `ecs` 全变 0 而 `realities` 仍是 15，是「无收益现实重置」后重打，不是同关反复。

3 s 快照闸门（`_fullEcRespec`）保留为保险，正常路径从不触发。

### 8.2 新发现的硬 bug：`equipGlyphs()` 的「替换符文」= 一次无收益全量现实重置

`Glyphs.equip()` 在目标槽已占用时走 `swapIntoActive()`（`glyphs/glyph-core.js:319-323`），
后者内部 `finishProcessReality({ reset: true, ... })`（`glyph-core.js:759`）：
清空 `player.eternityChalls` / `Currency.timeTheorems` / `player.dilation.studies`，
且 `reset: true` 表示不发奖励、`realities` 也不增加。

栈证据（`r40a-fix.refunds.jsonl`，8 次可观测现实重置逐条归类）：

| t | realities | 上游链路 | 性质 |
|---|---|---|---|
| 68.1s | 5 | tryReality → processManualReality → beginProcessReality → finishProcessReality | 真实现 |
| **140.9s** | **15** | **equipGlyphs → Glyphs.equip → swapIntoActive → finishProcessReality** | **静默重置** |
| 255.7s | 20 | tryReality → autoReality → … | 真实现 |
| **256.1s** | **20** | **equipGlyphs → …** | **真实现后 0.4 s 又清一次** |
| 383.5s | 25 | tryReality → autoReality → … | 真实现 |
| **387.8s** | **25** | **equipGlyphs → …** | **静默重置** |
| 503.7s | 30 | tryReality → autoReality → … | 真实现 |
| 892.3s | 65 | tryReality → autoReality → … | 真实现 |

即**每一轮真实现之后 0.4~4 s 内必再来一次无收益全量重置**，把刚打通的 EC1~EC12、
DS1~DS6、整棵时间定理/研究树抹掉。这直接解释：
- `realities` 增长慢 → V 的 200 次门槛到不了（938 s 才 70）；
- `ds6` 活不过一帧（主 Agent 的 `ds6 && laiTier>=8` 交集为 0 被此加重）；
- 1000 s 内 `iu25=false` / `pelleUnl=false`。

**修复**（`src/core/oreki-reality-automation.js::equipGlyphs()`）：只往空槽装，满槽直接跳过。
装空槽与原版手动点空槽等价、不触发任何重置；RU9/16/17/18/24 的「恰好 N 个符文」
形态要求由 `_driveGlyphRequirements` 先卸后装空槽完成，不依赖替换。

### 8.3 修复后复核（`r40a-fix2`，430 s，两个文件都已改）

| 指标 | 改前 diag | fix1（只改 eternity） | **fix2（两个都改）** |
|---|---|---|---|
| `equipGlyphs` 来源的现实重置 | 3 / 8 | 3 / 8 | **0 / 5** |
| realities @430 s | ~15 | 25 | **45** |
| 首 ds6 | 137.9 s | 24.8 s | 26.1 s |
| 首全 12 关 | 75.2 s | 27.8 s | 29.2 s |
| `Vunl` / `iu15` @430 s | false | false | false（realities 45 ≪ 200，符合预期） |

fix2 的 5 次重置全部是 `tryReality`（真实现），另有 1 次 `giveEternityRewards`
（`eternity.js:60` Effarig 解锁 → `beginProcessReality`，原版行为，合法）。

### 8.4 更正与后续（R40-A2 已实测，2026-10-30 晚）

> **本节原文（已作废）**：`realities` 只有 45~70，「远不到 V 的 200 门槛」，按 ~55 s/次推算 200 次需要约 2200 s；R39 在 t=415 s `V=1` 的差异「未知」。
>
> **更正**：`OREKI_V_UNLOCK_REALITIES` 早已在 R37-A 由 200 下调为 **60**（`secret-formula/celestials/v.js:65`），
> 上面那段「200 次 / 2200 s」的推算整体错误，**以 `R40A2-时间墙诊断.md` 为准**。按 60 重算，fix2 的 45 @430 s 只差 3 次现实，
> 并与 R39 的 `realities` 曲线完全同量级（R39 r=70 @419.9 s，每次现实 +5）。
>
> **R40-A2 实测（`r40a2-t1`，1500 s / 500 ms，fix1+fix2）**：
> `dilUnl`/`DS1~DS6` 25.1 s、`maxDT≥1e30` 133 s、`realities=60` 446.5 s、**V 484.5 s**、**IU15 496.6 s**、莱特拉解锁 496.6 s，
> 之后 **265 s 内一次莱特拉 run 都没进、tier 恒 0**（不是 V 的问题，是 `LAT_RUN_MIN_AM_EXP=1e10` 够不着，见诊断报告 §3.3 W4）。
> ⇒ 「12 min」的墙在 V **之后**，不在 EC 链，也不在本文件改动的 `oreki-eternity-automation.js` 里。
