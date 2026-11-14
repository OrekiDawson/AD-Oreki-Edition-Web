# R109-01 P1-C 附加：Android ↔ Web 终局链差异清单（只读审计）

> 角色：R109-01 web-pages 子 Agent（task-4 完成后的追加任务）· Lead：lead
> 时间：2026-11-14 12:35–12:45 +08（周六，DeepSeek 低谷）
> 工作树：`_wt_r109_web`（分支 `r109-01/web-pages`，源码基线 = Web main `8914ea5b`；部署证据见 `reports/R109-01/web-pages/REPORT.md`）
> 方法：**低内存只读审计**——只读源码/文档/构建脚本，**未启动浏览器、未启动 Gradle/AVD、未运行任何游戏或测试**。本文所有"Android 现状"均来自当前 Kotlin/构建脚本读码，验证状态一律标 `读码（待 AVD 验证）`，**不冒充运行期 PASS**。
> Web 参照：当前 main（冻结上游 `IvarK/AntimatterDimensionsSourceCode` @ `5409e320`，2026-07-17）。注意：本地对象库**无法解析** `5409e320`（仓库历史为压缩导入，无上游原 commit 对象），故上游基线以 `docs/SHARED_GAMEPLAY_STANDARD.md` / `docs/FACTS.md` 登记为准；本文对 Web 的引用全部落在当前 main 的可读文件行号上。
> Android 参照（只读）：`android/AD_Oreki_Edition_Android/scripts/payload/kotlin/kajfosz/antimatterdimensions/oreki/{OrekiLaitela,OrekiPelle,OrekiStageAuto,OrekiRealityPacing,OrekiIu15Sprint}.kt` 与 `GameApi.kt`、`OrekiCrunchPolicy.kt`。

## 0. 结论摘要（先看这个）

| # | 结论 | 等级 | 证据 |
| --- | --- | --- | --- |
| 1 | Android 佩勒（doomed）阶段**没有任何增产动作**（Web 的 `maxAll` + 维度提升 + 星系三件套缺失），反物质/峰值增长只剩原版自动器 | **P0（终局不可达）** | Web `oreki-endgame-automation.js:722-726`；Android `OrekiPelle.kt:247-294` 无上述调用；`OrekiStageAuto.kt:355` 把增产块整体置于 `!isDoomed()` 内 |
| 2 | Android 佩勒阶段**没有 `_pulseDoomedCrunch` 等价物**（按一次大坍缩换真实 IP → 买满 15 级间隔）；而原版"开 Break"需要 `Autobuyer.bigCrunch.hasMaxedInterval` | **P0（终局不可达）** | Web `:838-851`；Android 只有 `GameApi.crunchIntervalIsMaxed()` 用于**非毁灭** Break 兜底（`OrekiStageAuto.kt:438-458`），毁灭态不执行 |
| 3 | Android 佩勒阶段**未强制关闭**大坍缩/永恒自动器；`OrekiCrunchPolicy.evaluate()` 无 `isDoomed` 分支，毁灭 + 未 Break 会落 `pre-break-ip=allow`，可能把反物质按回 e308，破坏单调峰值 | **P0（终局不可达）** | Web `_stopDoomedResets()` `:868-881`；Android `OrekiCrunchPolicy.kt:130-137`；`OrekiStageAuto.kt:1845` `applyManagedAutobuyerStates(decision.allow)` |
| 4 | Android tier≥8 阶段在"IM 不足"时也压现实；而 IM 的唯一来源是现实产出的 RM（Web R47-A 已实测该策略"自己掐死自己"） | **P1（可能永久卡 IU25）** | Web `:480-528`（R47-A 改为只在 DS6 窗口压）；Android `OrekiLaitela.kt:327-337`（条件未齐即 hold） |
| 5 | Android 在 tier≥8 进 run 后若 IU25 买不成，**不立即撤 run**；run 完成时原版 `difficultyTier++` 无上限，tier 8→9 后 `maxAllowedDimension=-1`，IU25 永久不可买 | **P1（存档不可逆风险）** | Web R45·4 `:587-608` 明确"本帧就撤 run"；Android `OrekiLaitela.kt:318-323`（只放开压现实） |
| 6 | Android tier≥8 起 run 前**没有残熵 >0.9 保护**（Web R45·5），可触发"进 run 即结算"把 8 顶成 9 | **P1（同上）** | Web `:542-554`；Android `OrekiLaitela.kt:327-332` 无该判据（tier<8 分支有：`:373-376`） |
| 7 | Android IU25 买到后**不撤 run**（tier8 时 8 层无限维度停产），Web 明确撤 run 恢复 ID 产量 | P1 | Web `:446-453`；Android `OrekiLaitela.kt:280-283` 只 `setHold(false)` |
| 8 | Android 的 `GameApi.imaginaryTryUnlock()` 在 3.21 上是 **no-op**（`a.R()` 不存在，函数直接 return true），而 Web 显式调 `ImaginaryUpgrade(25).tryUnlock()`；一次性 IU 的 `imaginaryRequirementBits` 无人值守时可能永不刷新 → `canBeBought` 恒 false | **P0 风险（需 AVD 首查）** | `GameApi.kt:2152-2177` 自述"实测 class a 上不存在"；Web `:556-561`；R108-01 Android AVD 已有 IU15 同类死锁证据（`reports/R108-01/R108-01-REPORT.md` §B） |
| 9 | Android 大灾变判据与 Web 不同：无 20 s 最小间隔、无 6 s 反物质停滞判据、买到 keepAutobuyers 后**不等** `hasMaxedInterval` 就允许大灾变（会白清进度而不开 Break） | P1 | Web `:770-810`；Android `OrekiPelle.kt:275-285` |
| 10 | Android 没有 `tier>8` 不可逆状态诊断（Web 会 `console.warn` 并给出人工处理提示） | P2（可观测性） | Web `:471-479`；Android `OrekiLaitela.kt` 无对应分支 |

**总体判断**：R108-01 的 Android 侧只实现了"莱特拉 tier + IU25 购买 + 佩勒 doom/升级/大灾变"的**骨架**；Web R37→R50→R108 在真实跑次里踩平的 6 类终局死锁（IM 上限、DS6 帧竞态、佩勒重置竞争、开 Break 的 IP 间隔、tier 溢出、残熵）中，Android 目前**只对齐了 IM 上限、tier 窗口、DS6 帧竞态三类的方向**，佩勒阶段的增产/停重置/脉冲坍缩/撤 run/tier 溢出保护**尚未对齐**。按当前代码，Android 端 `endState` 大概率仍封顶在约 0.75（反物质被 e308 夹住）→ `gameEnd` 不可达。该判断是读码推导，**必须由 Lead 用 AVD 实测确认/证伪**（验证点见 §4）。

## 1. Web 侧参照（当前 main）关键行为与行号

文件：`web/AD-Oreki-Edition/src/core/oreki-endgame-automation.js`（935 行；MOD-only 文件，冻结上游无此文件）。

| 行为 | 行号 | 要点 |
| --- | --- | --- |
| 主入口 `tick()` | 233-245 | 总开关关闭即返回；`isGameEnd` 后停止；顺序 `buyImaginaryUpgrades → driveLaitela → drivePelle` |
| IU 购买 | 353-402 | 先抬 IM 上限（IU1-10 + IU13，cap < 1.5×IU25 成本时），再只买 IU15/25 |
| `iu25ConditionsReady()` | 409-435 | `isRunning && maxAllowedDimension===0 && DS6 && 符文≤1 && IM≥OREKI_IU25_COST(5e9)`；符文 >1 时调 `Glyphs.unequipAll(true)`；异常写 `_lastError` |
| `driveLaitela()` tier<8 | 636-655 | `ent>=0`；amE<4e8 时压现实；realMs≥290s 等下一现实；`ent>0.9` 跳过本帧；否则 `initializeRun()` |
| run 在位 | 619-634 | 压现实（`LAT_TIER_WINDOW_MS=250000`）；8 s（`LAT_RUN_ABORT_MS`）未涨到 0.9 熵则 `clearCelestialRuns()` 退出，恢复 ID8 产量 |
| tier≥8 未就绪 | 468-528 | 记录 `_laiDiag`；`ready = ds6 && im>=5e9`；**只有** `!ds6 && im>=5e9` 时压现实（≤240 s，`IU25_HOLD_MAX_MS`）；run 在位则撤 run |
| tier≥8 就绪 | 529-611 | 卸符文（含 `deleteAllUnprotected` 兜底）；残熵>0.9 不起 run；`initializeRun`；`iu25.tryUnlock()`；同帧 `purchase()`；**买不成立即 `clearCelestialRuns()`**（R45·4，防 tier 9） |
| tier>8 | 471-479 | `console.warn` 不可逆，提示人工处理 |
| IU25 已买 | 446-453 | 若 run 在位则 `clearCelestialRuns()`，恢复 8 层 ID 生产 |
| `drivePelle()` | 662-677 | `Pelle.isUnlocked && !isDoomed` → `Pelle.initializeRun()`；已 doomed → `driveDoomed()` |
| `driveDoomed()` | 704-746 | 100 ms 节流；`_stopDoomedResets()` → `maxAll()` → `requestDimensionBoost(true)` → `requestGalaxyReset(true)` → 佩勒升级（keepAutobuyers 优先、rebuyables、singles）→ `_pulseDoomedCrunch()` → `_maybeArmageddon()` |
| `_maybeArmageddon` | 770-810 | `player.break` 后不再末日；`Pelle.canArmageddon`；最小间隔 20 s；keepAutobuyers 已买→要求 `Autobuyer.bigCrunch.hasMaxedInterval`；未买→反物质指数停滞 6 s 才末日 |
| `_pulseDoomedCrunch` | 838-851 | 仅在 keepAutobuyers 已买、间隔未满、IP 不够买下一级、`Player.canCrunch` 时按一次 `bigCrunchResetRequest(true)`（同时解锁 `PelleStrikes.infinity` 自动器） |
| `_stopDoomedResets` | 868-881 | 每帧强制关 `Autobuyer.bigCrunch.isActive` / `Autobuyer.eternity.isActive`，保持反物质单调增长 |
| 机制常量 | 48/69/71/78/99/159/161/163 | `LAT_RUN_ENTER_MAX_REAL_MS=290000`、`LAT_RUN_MIN_AM_EXP=4e8`、`LAT_RUN_ABORT_MS=8000`、`LAT_TIER_WINDOW_MS=250000`、`IU25_HOLD_MAX_MS=240000`、`DOOM_BUY_MS=100`、`DOOM_ARMAGEDDON_MIN_MS=20000`、`DOOM_STALL_MS=6000` |

上游机制（当前 main 的 MOD 化版本，供 Android 对齐语义）：
- `src/core/celestials/laitela/laitela.js:30` `OREKI_LAITELA_ENTROPY_DIVISOR=2e7`；`:48` `OREKI_LAITELA_TIER_WINDOW_SEC=300`；`initializeRun()` = `clearCelestialRuns(); celestial.run=true`。
- `src/game.js:1375-1405`：run 完成时 `thisRealityRealTime < 300 s` 才 `difficultyTier++`（无上限）。
- `src/core/celestials/pelle/game-end.js:59-68`：`endState = (log10(log10(AM+1)+1) − 1) / (log10(1001) − 1)`；`endState>=1 ⟺ AM 指数≥1000`。
- `src/core/celestials/pelle/pelle.js`（未改）：`initializeRun` 置 doomed、强制 `bigCrunch.mode=AMOUNT`；`armageddon` = `finishProcessReality({reset:true, armageddon:true})`。

## 2. 逐项差异清单（L=莱特拉/IU25，P=佩勒/末日，I=IU25 前置）

### L1. tier<8 入场条件与时序
- **Web 行为**：`tier<8` 时，要求 `ent>=0`、amE≥4e8、本现实真实时间 <290 s、残熵≤0.9，才 `Laitela.initializeRun()`；amE 不足时压现实让它涨（≤250 s）；超出 290 s 等下个现实（`:636-655`）。
- **Android 现状**：`OrekiLaitela.tick()` tier<8 分支实现同样四判据（`OrekiLaitela.kt:350-385`）：ent<0 等待、amE<4e8 压现实、realMs≥290s 放行、ent>0.9 跳过、`enterRun()`；压现实走 `OrekiRealityPacing.setHold(true,"laitela")`（`:234-249`）。
- **是否等价**：**基本等价**（常量一致：`RUN_MIN_AM_EXP=4e8`、`RUN_ENTER_MAX_REAL_MS=290000`、`HOLD_MAX_MS=250000`；Android 的 tier 窗口 300 s 由 build_mod 补丁与 Web `OREKI_LAITELA_TIER_WINDOW_SEC=300` 同源）。
- **缺失动作**：无阻断项；仅"reality 代际计时"来源不同（Web 用 `player.records.thisReality.realTime`，Android 用 `resetCount()` 变化 + `elapsedRealtime`，精度够用）。
- **建议 Kotlin 落点**：无需改动；保留 `OrekiLaitela.tick()` tier<8 段。
- **Lead AVD 验证点**：新档首次进莱特拉后，确认 tier 从 0 递增、`OREKI_LAITELA` 日志出现 `enterRun ok`、每次现实周期不被压死。

### L2. tier<8 run 在位：压现实 + 8 s 放弃
- **Web 行为**：run 在位时压现实（`ent>=0 && realMs<250000`）；若 run 超过 `LAT_RUN_ABORT_MS=8000` 仍无进展（熵未满），主动 `clearCelestialRuns()` 撤 run，恢复 ID8 产量再进（`:619-634`）。理由：tier≥1 时 run 让 `tier>maxAllowedDimension` 的 ID 停产，amE 掉下去后熵速率会跌到 0.0024/s，400+ 秒填不满。
- **Android 现状**：run 在位时，`ent>=0 && realMs<300000 && !holdExpired()` 则压现实，否则放开压现实并 `return`（`OrekiLaitela.kt:341-349`）。**没有"8 s 未进展就撤 run"的路径**（无 `clearCelestialRuns` 等价调用；只有原版在熵满时自动退 run）。
- **是否等价**：**否（部分缺失）**。
- **缺失动作**：run 卡住（amE 低 ⇒ 熵慢）时 Android 会一直占着 run/压现实，直到 hold 窗口/现实窗口耗尽；Web 会主动退出重进。
- **建议 Kotlin 落点**：`OrekiLaitela.kt` tier<8 run 在位分支增加 `runAtMs` 计时与 `RUN_ABORT_MS=8_000` 超时撤 run：需要先确认原版 `clearCelestialRuns` 的 Android ABI（或 Laitela 单例的 run setter）；**先补 ABI 取证再写业务**。
- **Lead AVD 验证点**：tier 2→8 期间观察 `OREKI_LAITELA` 是否出现"长期 run 在位但熵不涨"；如出现，记录时长与 amE。

### L3. tier≥8 起 run 的前置（DS6 / IM / 符文）
- **Web 行为**：`ready = ds6 (TimeStudy.reality.isBought) && im >= OREKI_IU25_COST(5e9)`；就绪后先卸符文（`activeWithoutCompanion<=1`，必要时 `deleteAllUnprotected`），残熵>0.9 不起 run，再 `initializeRun()` + `tryUnlock()` + 同帧 `purchase()`（`:468-611`）。
- **Android 现状**：`OrekiLaitela.kt:296-338`：`iuCanBeBought("s")` 为真直接买；符文 >1 时 `unequipAll()`（30 s 限频）；run 在位则放开压现实并返回；`capReady = im>=4.5e9`；`ds6Ready = GameApi.canReality()`（原版 `prestige/f.f()`，含 maxRM 门槛）；三者齐则 `enterRun()`，否则压现实 ≤250 s。
- **是否等价**：**部分等价**。差异：(a) IM 阈值 4.5e9 vs Web 5e9（只提前进 run，购买仍由原版 `canBuy` 守门，可接受，但会多跑几次 churn）；(b) DS6 用 `canReality()` 代理，比"DS6 已买"更严格（要求 maxRM 达阈值），可能延后起 run；(c) Web 用 `TimeStudy.reality.isBought` 精确判据。
- **缺失动作**：Android 未记录 `_laiDiag` 等价诊断字段（tier/maxDim/ds6/im/imCap/glyphs/realSec），面板与探针无法解释"为什么没推进"。
- **建议 Kotlin 落点**：`OrekiLaitela.kt` tier≥8 分支补只读诊断（Log.i 限频即可，不改状态）；阈值考虑与 Web 对齐 5e9（或明确记录 4.5e9 的理由）。
- **Lead AVD 验证点**：tier=8 后出现 `OREKI_LAITELA IU25 prep enterRun` 前，先确认 `canReality=true`（DS6 在位）与 `glyphs<=1`；若 `canReality` 长期 false 而 DS6 实际已买（用时间研究面板确认），说明代理过严。

### L4. tier≥8 未就绪时的压现实策略（关键分歧）
- **Web 行为**：R47-A 明确改为**只在 `!ds6 && im>=5e9` 时压现实**（最多 240 s），目的是"截 DS6 那一帧"；其余帧一律不压现实，让现实照常循环产出 RM → IM。原因（Web 实测）：IM 只由现实产出的 RM 转换，压现实 = 不再产 RM = IM 不涨，会"自己掐死自己"（`:480-528`）。
- **Android 现状**：tier≥8 时，只要 `iuCanBeBought("s")` 为 false 且未到 run/prepare，就 `if (!holdExpired()) setHold(true)`（`OrekiLaitela.kt:327-337`）。**包括 `im<4.5e9` 的情况**——即 IM 不足时也压住现实。
- **是否等价**：**否（结构性偏差）**。在默认/高倍速下，IM 累积依赖现实循环；Android 的"IM 不足也压现实"正是 Web R47-A 已实测失败并改掉的策略。若 AVD 中观察到 `OREKI_LAITELA IU25 wait im=<低值> hold=true` 长时间循环，即命中此问题。
- **缺失动作**：区分"等 DS6"与"等 IM"：仅 `!ds6 && im够` 时压现实；`im不够` 时应放开现实，让现实产出 RM→IM。
- **建议 Kotlin 落点**：`OrekiLaitela.kt` tier≥8 分支，把 `setHold(true)` 条件改为 `(!ds6Ready && capReady && glyphs<=1)`；`!capReady` 时 `setHold(false)` 并让现实循环（与 Web `:519-527` 对齐）。
- **Lead AVD 验证点**：tier=8 后统计 `OREKI_LAITELA` 的 `IU25 wait` 行与 `OREKI_REALITY_PACING hold=...`：若 `im<4.5e9` 时 hold 长期为 true，即确认此差异。

### L5. tier≥8 购买失败时立即撤 run（防 tier 9）
- **Web 行为**：R45·4：`purchase()` 失败时**本帧就 `clearCelestialRuns()`**，不再等 20 s 兜底（原 20 s 比"2 s 熵满"晚一个数量级，等于没有）。理由：tier 8 时 run 在位 → 8 层 ID 停产但 AM 不清零；熵速率在 AM 指数≥2e8 时 0.5/s ⇒ 2 s 填满；完成时 `game.js` 只要 realTime<300 s 就 `difficultyTier++`（无上限）⇒ tier 9 后 `maxAllowedDimension=-1`，IU25 永久不可买（`:587-608`）。
- **Android 现状**：`iuCanBeBought("s")` false 且 `isRunning()` 时，只 `setHold(false)` 并 return（`OrekiLaitela.kt:318-323`），**不撤 run**。run 完成 → tier 9 → 存档不可逆。
- **是否等价**：**否（P1 风险）**。
- **缺失动作**：run 在位且本帧买不成时立即撤 run；同时保留"重试冷却"（Web 用 `_iu25RetryAt = now + 1500`）。
- **建议 Kotlin 落点**：`OrekiLaitela.kt` tier≥8 `isRunning()` 分支：先尝试购买（或在 `iuCanBeBought` 为 false 且有 run 时），调用原版 `clearCelestialRuns` ABI（需先取证；若不可用，退路是 Laitela 的 run setter，必须用真实原版入口，不写存档字段）。
- **Lead AVD 验证点**：tier=8 + run 在位 + `iuCanBeBought=false` 时，观察 `OREKI_LAITELA` 日志与 tier 是否在 ~2 s 内跳到 9；一旦跳到 9，该存档 IU25 永久不可买，需要备份存档再测。

### L6. 残熵 >0.9 保护
- **Web 行为**：tier≥8 与 tier<8 都检查 `ent > 0.9` 时不起 run（Web R45·5），避免"按下去 1~2 帧就结算"把 tier 顶到 9（`:542-554`、`:647-650`）。
- **Android 现状**：仅 tier<8 分支有 `entropy() > 0.9 → setHold(false); return`（`OrekiLaitela.kt:373-376`）；tier≥8 分支无此检查（`:327-332` 直接 enterRun）。
- **是否等价**：**否（P1）**。
- **缺失动作**：tier≥8 起 run 前加 `entropy()>0.9` 跳过本帧。
- **建议 Kotlin 落点**：`OrekiLaitela.kt` tier≥8 `capReady && ds6Ready && glyphs<=1` 分支前增加 `if (entropy() > 0.9) return false`。
- **Lead AVD 验证点**：观察 tier=8 时是否存在"enterRun 后 1–2 拍即 tier=9"的日志/状态跳变。

### L7. IU25 买到后撤 run（恢复 ID 产量）
- **Web 行为**：`ImaginaryUpgrade(25).isBought` 后，若 `Laitela.isRunning` 则 `clearCelestialRuns()`，并清 hold（`:446-453`）。原因：tier8 时 `maxAllowedDimension=0`，8 层无限维度全停产，继续留 run 会压死佩勒前产量。
- **Android 现状**：`iu25Bought()` 时只 `setHold(false); return false`（`OrekiLaitela.kt:280-283`），不撤 run。
- **是否等价**：**否（P1，但影响窗口短）**。
- **缺失动作**：IU25 买到后撤 run。
- **建议 Kotlin 落点**：`OrekiLaitela.kt:280-283`，在 `setHold(false)` 前加"若 `isRunning()` 则撤 run"（同一 `clearCelestialRuns` ABI）。
- **Lead AVD 验证点**：IU25 买入后确认 `isRunning` 变 false、ID 层产量恢复（否则佩勒前 EP/AM 增长被按死）。

### L8. IU25 前置判定 `iu25ConditionsReady`
- **Web 行为**：显式只读判定：`isRunning && maxAllowedDimension===0 && TimeStudy.reality.isBought && 符文≤1 && IM≥5e9`；符文 >1 时调原版 `Glyphs.unequipAll(true)`（`:409-435`）。异常写 `_lastError` 而不是伪装"条件不满足"。
- **Android 现状**：不复制条件，直接依赖原版 `iuCanBeBought("s")`（`GameApi` 内 `is3.a(true)` = 原版 canBuy），并在 tier≥8 每 2 拍读 `iuCanBeBought`（`OrekiLaitela.kt:300-310`）。**没有显式前置诊断**（只有一条限频 `IU25 wait` 文本）。
- **是否等价**：**判定等价（交给原版）**，但**可观测性与错误归类不等价**（Web 能区分"tier>8 / DS6 未买 / IM 不够 / 符文多"四种；Android 只有一个笼统 wait）。
- **缺失动作**：增加与 Web 同构的只读前置判定/日志（不改购买路径，仍由原版 `canBuy` 守门）。
- **建议 Kotlin 落点**：`OrekiLaitela.kt` 增加只读 `iu25Diag()`：tier/maxAllowedDimension/isRunning/entropy/im/IM cap/glyph count/canReality，限频输出；购买仍走 `iuCanBeBought`。
- **Lead AVD 验证点**：tier=8 后按 Web 四类原因逐项核对日志，确认不是"永远 wait 而不知哪条缺"。

### L9. tier>8 不可逆告警
- **Web 行为**：`tier > 8` 时 `console.warn` 并说明 `maxAllowedDimension` 已非 0，IU25 的 `=== 0` 不再成立，需人工处理（`:471-479`）。
- **Android 现状**：无 tier>8 分支；tier 9 时 `iuCanBeBought` 恒 false，日志只显示 `IU25 wait`。
- **是否等价**：否（P2 可观测性）。
- **缺失动作**：tier>8 时输出明确错误日志（不改状态）。
- **建议 Kotlin 落点**：`OrekiLaitela.kt` 入口处 `tier > 8` 限频 Log.w。
- **Lead AVD 验证点**：若出现 tier=9，确认日志能指出"存档已永久失去 IU25"。

### L10. IU15 入口与 IM 上限提升
- **Web 行为**：`buyImaginaryUpgrades()` 每 2 s：`MachineHandler.currentIMCap < OREKI_IU25_COST*1.5` 时反复买 IU1–IU10 与 IU13（真实 `purchase()`）抬高上限；随后只买 IU15/IU25（`:353-402`）。
- **Android 现状**：IM 上限由构建期 `OrekiImCapScale`（`MULT=3000`，与 Web `OREKI_IM_CAP_MULT` 同值）实现，不动态购买 IU1–10/IU13；IU15 由 `OrekiIu15Sprint` 状态机负责（锁 ID1–8 购买、`iu15AffordableByCap()`、`purchaseIu15()`；`OrekiIu15Sprint.kt:523-600`）。
- **是否等价**：**结果目标一致，机制不同**。Web 走原版可重复 IU 抬上限；Android 走构建期乘数。风险：Android 若未来移除/调整 `OrekiImCapScale`，IU15/IU25 会重新不可达；且 Web 的"抬上限到 1.5×成本"是自适应，Android 是固定倍率（当前 3000 倍，理论上足够 7.35e9 > 5e9，但依赖 EP 量级）。
- **缺失动作**：无必须改动；建议在 Android 文档登记"IM 上限=构建期倍率"，并在 AVD 验证上限实际值 > 5e9。
- **建议 Kotlin 落点**：若需更稳，可在 `OrekiLaitela`/新 IM 模块里补"cap 不足时买 IU1-10/IU13"（与 Web 同构），但当前不是 P0。
- **Lead AVD 验证点**：IU15 前读 `iMCap`；IU25 前确认 `iMCap >= 5e9` 且 `im` 能到 5e9。

### L11. 符文条件与自动装备抑制
- **Web 行为**：`Glyphs.unequipAll(true)`；若仍 >1，`Glyphs.deleteAllUnprotected()` 再卸（`:529-538`）。Web 的符文自动化只装空槽（R40A），所以卸下后不会立刻被装回。
- **Android 现状**：`activeGlyphCount()` 读 `Glyphs.active` 列表长度（**含同伴符文**，Web 用 `activeWithoutCompanion`）；>1 时 `unequipAll()`（限频 30 s），并用 `shouldSuppressGlyphAuto()`（`tier>=8 && !iu25Bought`）让 `OrekiStageAuto` 暂停 `GameApi.glyphTick()`（`OrekiStageAuto.kt:400-403`，`OrekiLaitela.kt:174-193`）。
- **是否等价**：**近似等价，有一处口径差异**：`activeGlyphCount` 含同伴符文，IU25 要求 `activeWithoutCompanion<=1`；若玩家装了同伴，Android 会误判 glyphs=2 而触发不必要的 `unequipAll`（清空符文配置）。
- **缺失动作**：读取"非同伴符文数"（原版 `Glyphs.activeWithoutCompanion` 的 ABI 需取证），或明确记录当前口径。
- **建议 Kotlin 落点**：`OrekiLaitela.activeGlyphCount()` 改为非同伴计数（先补 ABI 证据）。
- **Lead AVD 验证点**：装 1 个普通符文 + 1 个同伴符文时，确认 `glyphs` 日志值与 IU25 实际 canBuy 条件一致。

### L12. 压现实的统一出口与释放
- **Web 行为**：`_laiHold` 由 endgame 模块在每 500 ms tick 重算；由真实的现实自动化模块读取（`oreki-reality-automation.js`）。
- **Android 现状**：`OrekiLaitela.setHold()` → `OrekiRealityPacing.setHold(hold, "laitela")`；`OrekiRealityPacing.shouldReset()` 在 `realities>0` 时 veto（`OrekiRealityPacing.kt:221-227, 288-296`）。所有异常/早退路径都会 `setHold(false)`。
- **是否等价**：**等价（且 Android 的统一出口更明确）**。
- **缺失动作**：无（但注意 L4 的策略差异会让 hold 时机不同）。
- **建议 Kotlin 落点**：无。
- **Lead AVD 验证点**：观察 `OREKI_REALITY_PACING` 的 `hold=... none` 切换是否随 `OREKI_LAITELA` 状态同步，无"压住不释放"。

### P1. 进入毁灭现实（doom）
- **Web 行为**：`Pelle.isUnlocked && !isDoomed` 时调 `Pelle.initializeRun()`（UI「毁灭」同路径），下一 tick 进 `driveDoomed()`（`:662-677`）。
- **Android 现状**：`iu25Bought() && !isDoomed` 时 `doom()`（`Pelle.initializeRun` 的 `h(Cont)`，`OrekiPelle.kt:193-202, 261-271`），失败 3 s 重试。
- **是否等价**：**等价**。
- **缺失动作**：无。
- **建议 Kotlin 落点**：无。
- **Lead AVD 验证点**：IU25 后确认进入 doomed（`isDoomed=true`、佩勒页签出现）。

### P2. 毁灭阶段的产量动作（maxAll / 维度提升 / 星系）——**最大缺口**
- **Web 行为**：每 100 ms：`maxAll()`（全部最大）、`if (DimBoost.canBeBought) requestDimensionBoost(true)`、`if (Galaxy.canBeBought) requestGalaxyReset(true)`。三者都不清空当前反物质（`:722-726`）。
- **Android 现状**：`OrekiPelle.tick()` 只做"买佩勒升级 + 大灾变"（`OrekiPelle.kt:247-294`）；`OrekiStageAuto` 的五个购买动作（bulk/sacrifice/infinityUpgrades/crunchInterval/ID）全在 `if (!GameApi.isDoomed())` 块内（`OrekiStageAuto.kt:355` 起，块尾 `:519-521`）；毁灭态没有 `maxAll`/dimboost/galaxy 调用。
- **是否等价**：**否（P0）**。Web R38-M 实测：毁灭态没有这些动作时，反物质产量与 `records.totalAntimatter` 峰值增长会显著变慢；而 `endState` 只读峰值。
- **缺失动作**：在毁灭态补 `maxAll()`、可买时维度提升、可买时星系（全部走原版入口，不写字段）。
- **建议 Kotlin 落点**：`OrekiPelle.tick()` 新增 `doomedProduction()`：需要先补 ABI 取证——原版"全部最大"入口（Web `antimatter-dimension.js:272 maxAll`）、`requestDimensionBoost(true)`、`requestGalaxyReset(true)` 在 3.21 Android 的对应方法；`GameApi` 已有 `dimensionAutobuyers`/`dimBoostAutobuyer`/`galaxyAutobuyer`，但"立即购买一次"入口需新增反射封装。**先取证 ABI，再写业务**（不得猜混淆名）。
- **Lead AVD 验证点**：进入 doomed 后 60 s 内，比较"反物质指数 / 维度数量 / 维度提升数 / 星系数"是否增长；若几乎不动，即确认该缺口；同时记录 `records.totalAntimatter` 峰值曲线。

### P3. 毁灭阶段关闭大坍缩/永恒自动器
- **Web 行为**：每 100 ms 强制 `Autobuyer.bigCrunch.isActive=false`、`Autobuyer.eternity.isActive=false`；自动器开着会按 AMOUNT 模式在 AM 刚过 1.797e308 时反复清零，破坏 `records.totalAntimatter` 的单调峰值（`:868-881`）。
- **Android 现状**：`OrekiPelle.tick()` 不管理自动器；`OrekiStageAuto.applyCrunchPolicy()` 在早退门禁之前每帧运行（`:325`），内部 `OrekiCrunchPolicy.evaluate()` **没有 `isDoomed` 分支**（`OrekiCrunchPolicy.kt:130-137`：`inAnyChallenge`→allow、`!hasInfinity`→allow、`!isBroken`→`pre-break-ip` allow）；`applyManagedAutobuyerStates(decision.allow)` 会按 allow 维持/恢复大坍缩自动器（`OrekiStageAuto.kt:1742-1758, 1845`）。
- **是否等价**：**否（P0 风险）**。若毁灭态 `isBroken=false`（常见：佩勒会关 Break），决策落 `pre-break-ip=allow` ⇒ 大坍缩自动器被保留/恢复 ⇒ 反物质被反复清零，峰值封顶。Web 正是修了这一点才有 gameEnd。
- **缺失动作**：毁灭态强制关闭 bigCrunch/eternity 自动器（每拍幂等），或让 `OrekiCrunchPolicy` 在 `isDoomed` 时返回 `false`。
- **建议 Kotlin 落点**：`OrekiPelle.tick()` 开头加 `GameApi.setAutobuyerActive(GameApi.crunchState(), false)`（或 `OrekiStageAuto.applyCrunchPolicy` 增加 `isDoomed→deny` 分支）；永恒自动器同理（`GameApi` 已有 `eternityAutobuyerCls` / setActive 封装）。
- **Lead AVD 验证点**：doomed 后统计 `infinities` 增量与 `player.auto.bigCrunch.isActive`；若 `infinities` 持续快速增长、AM 指数在 e308 附近反复回落，即确认此差异。

### P4. 毁灭阶段脉冲大坍缩（IP → 买满 15 级间隔）
- **Web 行为**：`_pulseDoomedCrunch(keepAuto)`：只在 `keepAutobuyers` 已买、`!hasMaxedInterval`、IP 不够买下一级、`Player.canCrunch` 时按一次 `bigCrunchResetRequest(true)`。副作用是 `PelleStrikes.infinity.trigger()`，同时解锁大坍缩自动器；单次收益实测 6.2e9 IP ≫ 32767（`:838-851`）。
- **Android 现状**：无等价物。`OrekiStageAuto` 的 `upgradeCrunchInterval()` 只在 `!isDoomed` 的 Break 兜底/购买块内（`:438-522`）；`OrekiPelle.tick()` 不按大坍缩按钮。
- **是否等价**：**否（P0，终局不可达）**。因果链：无真实 IP ⇒ `Autobuyer.bigCrunch.hasMaxedInterval` 恒 false ⇒ 原版"开 Break"的条件（`Pelle.isDoomed && keepAutobuyers.canBeApplied && hasMaxedInterval → player.break=true`）永不成立 ⇒ AM 被 `Player.infinityGoal` 夹在 1.797e308 ⇒ `endState` 封顶约 0.75 ⇒ `gameEnd` 不可达。这与 Web R40-A5 实测链完全一致。
- **缺失动作**：补"脉冲大坍缩"（真实入口：`bigCrunchResetRequest(true)` 的 Android ABI，即原版大坍缩按钮/触发路径）与"买满 interval"（`upgradeCrunchInterval` 已有，需允许毁灭态调用）。
- **建议 Kotlin 落点**：`OrekiPelle.tick()` 增加 `pulseDoomedCrunch()`：条件与 Web 同（keep 已买、interval 未满、IP<下一级成本、canCrunch），走原版 `bigCrunchReset` 入口；随后让已有 `upgradeCrunchInterval` 在毁灭态可用。
- **Lead AVD 验证点**：doomed + keepAutobuyers 后，观察 `ip` 是否出现大幅跃升、`auto.bigCrunch.interval` 是否从 150000 买满、`player.break` 是否最终为 true；这是 Android 终局链是否可能打通的决定性验证点。

### P5. 大灾变判据
- **Web 行为**：`player.break` 后不再末日；`Pelle.canArmageddon`；距上次末日≥20 s；keepAutobuyers 已买→要求 `hasMaxedInterval`；未买→反物质指数停滞 `DOOM_STALL_MS=6 s` 才末日（`:770-810`）。
- **Android 现状**：`can && !isBroken() && (keepBought || doomedSeconds > 45)` 即大灾变（`OrekiPelle.kt:275-285`）；**无最小间隔、无停滞判据、无 `hasMaxedInterval` 门槛**。
- **是否等价**：**否（P1）**。买到 keepAutobuyers 后、interval 未满时 Android 会继续大灾变（清 DT/TP/膨胀升级）却不打开 Break，纯损耗；且缺少 20 s 冷却可能连续大灾变。
- **缺失动作**：对齐 Web 三判据（20 s 最小间隔、keep 后要求 `hasMaxedInterval`、未 keep 时 6 s 停滞）。
- **建议 Kotlin 落点**：`OrekiPelle.kt` `tick()` 的大灾变分支；`hasMaxedInterval` 可复用 `GameApi.crunchIntervalIsMaxed()`（`OrekiStageAuto.kt:243-249`）；停滞用 `GameApi.antimatterExponent()` 记录峰值与时刻。
- **Lead AVD 验证点**：记录每次大灾变的时间戳/原因与 `interval`；若出现"大灾变间隔 <20 s"或"interval 未满却大灾变"，即确认差异。

### P6. 佩勒升级购买顺序
- **Web 行为**：keepAutobuyers 最优先（货币是 realityShards，价格 5e6）；然后 `PelleUpgrade.rebuyables`；最后 `PelleUpgrade.singles`（跳过 keep）（`:727-738`）。
- **Android 现状**：keep 优先；随后按注册表字段顺序遍历所有 `ph3/vw3/sh3` 对象，**可买就买**（`OrekiPelle.kt:218-239`），不区分可重复/单次顺序。
- **是否等价**：**近似等价**（不会买错货币，但可能先花碎片买单次项，推迟可重复项的产出乘子）。
- **缺失动作**：按"rebuyables 优先、singles 次之"分组遍历。
- **建议 Kotlin 落点**：`OrekiPelle.upgrades()` 返回时按类型分组（`vw3/sh3`=可重复，`ph3`=单次），先 rebuyables。
- **Lead AVD 验证点**：doomed 早期记录碎片消费顺序，确认产出乘子尽早拉起来。

### P7. gameEnd 判据与峰值记录
- **Web 行为**：`endState` 读 `player.celestials.pelle.records.totalAntimatter`（`currency.js` setter 每次取 max）；`GameEnd.gameLoop` 在 `endState>=1` 置 `isGameEnd`（`game-end.js:59-68`）。
- **Android 现状**：构建期 `patch_pelle_end_target()` 把常量改为 `OFFSET=1.0 / TARGET=1001.0`（与 Web 同交会点 E=1000）；`OrekiPelleRecord.smali`（R42）在 `applyCrunchPolicy` 与 doomed 早退**之前**每帧写峰值（`OrekiStageAuto.kt:304`；build_mod.py:1790, 5933）；终局由原版 `GameEnd.gameLoop` 置位。
- **是否等价**：**判据/写入点等价（静态）**；**运行期未验证**（R108-01 报告：Android gameEnd NOT RUN）。
- **缺失动作**：无代码改动；但 P2/P3/P4 不通则本项物理不可达。
- **建议 Kotlin 落点**：无。
- **Lead AVD 验证点**：doomed 后定期读 `records.totalAntimatter` 与 `endState`；确认 `endState` 随峰值单调上升，而不是封顶 0.75。

### P8. 毁灭阶段的总开关/异常/节流
- **Web 行为**：总开关关时 `tick()` 直接返回；所有动作 try/catch；`driveDoomed` 100 ms 节流。
- **Android 现状**：`OrekiPelle.tick()` 检查 `OrekiAutomationScheduler.isEnabled()`（`OrekiPelle.kt:249`），异常 fail-closed（`:290-293`），500 ms 节流。
- **是否等价**：**等价（节流粒度不同）**。
- **缺失动作**：无（可考虑把毁灭态提高频次，与 Web 100 ms 对齐，但 500 ms 足够）。
- **建议 Kotlin 落点**：无。
- **Lead AVD 验证点**：关闭总开关后确认 doom/armageddon/购买全部停止（不 undo 已发生的 doom）。

### P9. Break 后停止大灾变
- **Web 行为**：`player.break` 为 true 时 `_maybeArmageddon` 直接 `_doomPhase="broken"` 返回（`:771-774`）。
- **Android 现状**：条件里 `!GameApi.isBroken()`（`OrekiPelle.kt:277,283`），等价。
- **是否等价**：**等价**。
- **缺失动作**：无。
- **建议 Kotlin 落点**：无。
- **Lead AVD 验证点**：Break 置真后确认不再有大灾变日志。

### P10. 毁灭阶段其余自动化的门禁
- **Web 行为**：进入 doomed 后，仓库内 7 处 oreki 自动化都在 `Pelle.isDoomed` 处 early return；只由 endgame 模块接管（`:682-688`）。
- **Android 现状**：`OrekiStageAuto.kt:355` 的外层 `if (!GameApi.isDoomed())` 已把永恒/EC/现实/符文/特蕾莎/莱特拉整块跳过；`OrekiPelle.tick()` 在门禁之前调用（`:311-314`），毁灭态确实只剩它 + 少量前置诊断/crunch policy。
- **是否等价**：**等价（门禁位置更集中）**。
- **缺失动作**：无（但见 P3：`applyCrunchPolicy` 仍在门禁外，需要在其中补 doomed 处理）。
- **建议 Kotlin 落点**：`OrekiCrunchPolicy.evaluate()` 增加 `isDoomed→deny`。
- **Lead AVD 验证点**：doomed 后确认现实/永恒/EC 日志不再出现（除 Pelle 相关）。

### I1. `iu25ConditionsReady` 的显式条件 vs 原版 canBuy
- 见 L8：Web 显式判定 + 原版 purchase；Android 只读原版 `canBuy`。建议补只读诊断，不复制购买条件。

### I2. `tryUnlock` 刷新（关键风险）
- **Web 行为**：`ImaginaryUpgrade(25).tryUnlock()` 在条件成立时置 `player.reality.imaginaryUpgReqs` 位（跨现实保留）；不调用的话 `isAvailableForPurchase` 可能一直 false（`imaginary-upgrades.js:63`）。
- **Android 现状**：`GameApi.imaginaryTryUnlock()` 尝试反射 `a.R()`，**实测该类不存在该方法**（注释与日志：`OREKI_API_MISS 86 次`），函数直接 `return true`（不刷新）。`OrekiLaitela.kt:300-303` 每 1 s 调它，但实际是 no-op。
- **是否等价**：**否（P0 风险）**。一次性 IU 的 requirement bits 若在无人值守路径不刷新，`iuCanBeBought("s")` 恒 false，IU25 永远买不到——这正是 R108-01 AVD 上 IU15 遇到的同类死锁（`GameApi.kt:2140-2150` 注释与 R108-01 报告 §B）。
- **缺失动作**：找到 3.21 Android 上真实的"一次性 IU 条件位刷新"入口（JADX 导出里 `is3`/`qr3` 的刷新方法），补 ABI 后调用；若确实不存在，则必须确认原版在哪些事件里刷新这些位（例如现实结算/莱特拉 run 开始），并在这些事件后触发。
- **建议 Kotlin 落点**：`GameApi.imaginaryTryUnlock`（先取证再改）；或在 `OrekiLaitela` tier≥8 分支每次进入 run 后调用真实刷新点。
- **Lead AVD 验证点**：tier=8 且 `canReality=true` 后，读 `player.reality.imaginaryUpgReqs`（或 `iuCanBeBought("s")`）是否变 true；若恒 false，即确认该 P0 风险，Android IU25 物理不可达。

### I3. 符文计数口径
- 见 L11：Web `activeWithoutCompanion` vs Android `activeGlyphCount()`（全部 active，含同伴）。
- **建议**：先补 ABI 再改；否则 AVD 会出现"卸符文仍不足"或"误卸同伴"。

### I4. IM 成本阈值
- Web 用 `OREKI_IU25_COST=5e9` 精确值；Android 用 `4.5e9`（90%）提前进 run。购买仍由原版 canBuy 守门，不产生"少花钱"；但会增加起/撤 run 次数。
- **建议**：与 Web 对齐 5e9（或保留 4.5e9 但在日志中说明）。

### I5. DS6 判据代理
- Web 用 `TimeStudy.reality.isBought`；Android 用 `GameApi.canReality() = prestige/f.f()`（DS6 已买 + maxRM 达标）。代理更严格，可能延迟起 run。
- **建议**：补 `TimeStudy.reality` 的直接只读 ABI；或在 AVD 中确认 `canReality=false` 时 DS6 确实未买。

## 3. 跨端差异（教程 / 自动购买器 / GUI / 数值）

> 本节只记录**玩家可见**差异；平台实现差异（Kotlin/JS、native/浏览器）不单列。状态：`读码`=待 AVD/浏览器验证；`文档`=`WEB_ANDROID_DIFFERENCES.md` 既有结论（该文件最后更新 2026-11-01/R51，部分状态已过期，引用处保留原文状态）。

| 类别 | 差异 | 说明 | 证据 | 状态 |
| --- | --- | --- | --- | --- |
| 教程 | 入口/呈现不同，**正文同源** | Android 由 `build_mod.py` 从 Web `src/core/oreki-tutorial-data.json` 生成教程 asset（`build_mod.py:6501-6504, 6643-6669`），`TutorialActivity.kt` 读取；Web 用侧栏/弹窗渲染同一份 JSON | 构建脚本断言 `TutorialActivity` "没有从唯一教程 asset 读取正文" 会失败 | 读码（同源）；正文一致性待浏览器/AVD 对照 |
| 教程 | 入口形态 | Android 常驻「打开 Oreki 中文教程」按钮；Web 侧栏入口 + modal | `WEB_ANDROID_DIFFERENCES.md` §9；Web 线上截图 `reports/R109-01/web-pages/evidence/live-initial.png`（右下角 ? 按钮） | 文档/截图 |
| 自动购买器 | 架构不同 | Web：`oreki-smart-executor` + 各 `oreki-*-automation.js`；Android：`OrekiStageAuto` + `OrekiAutomationScheduler` 统一节拍（原版自动器仍工作） | `OrekiStageAuto.kt:1-60`；Web `src/core/oreki-smart-executor.js` | 文档 §8（待验证） |
| 自动购买器 | 解锁时机 | Android 把原版自动器解锁放宽到「首次无限后」；Web 按原版 + 开局例行 | `WEB_ANDROID_DIFFERENCES.md` §2 | 文档（待验证） |
| 自动购买器 | 批量购买退化 | Android 买不起时退化为买 1 个（`OREKI_NO_AB2=1` 可关，仅 A/B）；Web 保持原版 buyMax | 同上 §2 | 文档（待验证） |
| 自动购买器 | 大坍缩策略 | Android 有 `OrekiCrunchPolicy`（收益/目标驱动、自适应窗口）；Web 是 smart-executor 任务调度；"何时坍缩"的节奏可能不同（玩家可见 IP/EP 增速差） | `OrekiCrunchPolicy.kt`；Web `oreki-smart-executor.js` | 读码；需双端同存档对照 |
| GUI | 主导航 | Web 侧栏 10 项（维度/自动化/挑战/无限/永恒/现实/天神/成就/统计数据/选项）+ 移动端汉堡抽屉；Android 底栏 12 项（多商店/信息） | `WEB_ANDROID_DIFFERENCES.md` §9；本次线上实测抽屉只列 7 项（未解锁项隐藏） | 文档 + Web 实测 |
| GUI | 移动端导航 | Web 412×839 用汉堡抽屉（`.c-oreki-nav__toggle`，本次实测 PASS）；Android 原生底栏 | `reports/R109-01/web-pages/evidence/live-after-nav.png` | Web 已验证；Android 原生 |
| GUI | 启动/离线 | Android 有离线结算页；Web 关闭页面即停（无离线） | `WEB_ANDROID_DIFFERENCES.md` §10 | 文档（平台限制） |
| GUI | 首启更新日志 | Android 有 `changelog.txt` 弹窗（已改简体中文）；Web 无 | 同上 §9 | 文档（待截图确认） |
| GUI | 广告/商店/金币 | Android 独有（广告十乘区、金币下限 ≥10000）；Web 无 | 同上 §5 | 文档（平台限制） |
| GUI | 新闻 | Web 关闭；Android 无此模块 | 同上 §9 | 文档 |
| 数值 | 终局判据 | Web `OFFSET=1 / TARGET=1e3`（对称分母，交会 E=1000）；Android 构建期改为 `1.0/1001.0`（同交会点） | `game-end.js:59-68`；build_mod `patch_pelle_end_target()` | 读码；AVD 终局待验 |
| 数值 | 莱特拉熵分母 | 两端均 2e7（Web `laitela.js:30`；Android build_mod 幂等常量替换，R108-01 已登记） | 同上 | 读码/构建日志（待 AVD） |
| 数值 | 莱特拉 tier 窗口 | 两端均 300 s（Web `OREKI_LAITELA_TIER_WINDOW_SEC`；Android `patch_laitela_tier_window` 把 `Game.k` 的 30.0 改 300.0） | `src/game.js:1383,1396,1403`；`OrekiLaitela.kt:46-54` | 读码/构建日志（待 AVD） |
| 数值 | IM 上限 | 两端均 ×3000（Web `OREKI_IM_CAP_MULT`；Android `OrekiImCapScale`；R108-01 登记"Android 同步取值 3000"） | R108-01 报告 §B.3 | 文档（Android AVD 部分验证） |
| 数值 | 游戏速度 | 两端默认 F=10000、动态升档；Android 时间补偿（记忆/动量/暗物质）另行注入 | `WEB_ANDROID_DIFFERENCES.md` §1 | 文档（待验证） |
| 数值 | 默认记数法 | 两端默认 Scientific（Web `player.js:800`；Android 原版默认） | 同上 §2 | 读码/文档 |
| 数值 | 终局墙钟 | Web：真实新档默认设置 **gameEnd 1867.9 s**（PASS，`reports/R108-01/web/`）；Android：**NOT RUN**，且按本文 §0 的 P0 缺口当前物理不可达 | R108-01 Web 报告；R108-01 Android 报告"≤10800s 到 gameEnd NOT RUN" | Web PASS / Android NOT RUN |
| 数值 | Teresa 浇注 | R108-01 发现 Web 459.8 s（设计约 2.3 s，celestial 调度 + 单帧上限导致）；Android 走原版主循环按帧累计，无该损失 | R108-01 报告 §B.3 | 文档（已知双端节奏差异，待裁） |
| 数值 | IU25 成本 | 两端均 5e9（Android build_mod 按 Web `OREKI_IU25_COST` 缩放） | `OrekiLaitela.kt:24-25` | 读码/构建日志 |
| 存档 | 载体 | Web `localStorage["dimensionSave"]` JSON；Android `SharedPreferences` + 编码（root `files/player.json` 可读副本） | `WEB_ANDROID_DIFFERENCES.md` §6 | 文档（不要求互通） |

## 4. 建议优先级与 Lead AVD 验证清单

### 4.1 优先修复（按终局链依赖顺序）
1. **I2 / IU25 可买性**（最高先验，若 bits 不刷新一切免谈）：tier=8 + DS6 后确认 `iuCanBeBought("s")` 为 true；否则查 `is3`/`qr3` 的真实刷新入口。
2. **L5 + L6 + L7**（tier 溢出不可逆）：run 在位买不成立即撤 run、残熵>0.9 不起 run、IU25 后撤 run。需要先取证 `clearCelestialRuns` 的 Android ABI。
3. **L4**（压现实策略）：把 `setHold(true)` 收窄到 `!ds6 && capReady`，IM 不足时放开现实。
4. **P3**（毁灭态关大坍缩/永恒自动器）：`OrekiCrunchPolicy` 加 `isDoomed→deny`，`OrekiPelle` 每拍幂等关闭。
5. **P4**（脉冲大坍缩 + 买满 interval）：Android 终局是否可达的决定性一项。
6. **P2**（maxAll/dimboost/galaxy）：决定峰值增长与 `endState` 曲线。
7. **P5**（大灾变判据）、**I3**（符文口径）、**I5**（DS6 判据）、**P6**（升级顺序）、**L2**（8 s 撤 run）、**L9/诊断**（可观测性）。

### 4.2 AVD 验证点（Lead 执行；建议先备份存档）
| # | 场景 | 观察项 | PASS 判据 |
| --- | --- | --- | --- |
| V1 | 新档→IU15→莱特拉 | `OREKI_LAITELA enterRun ok`、tier 0→8、每个现实周期 | tier 稳定递增、无长期卡 tier |
| V2 | tier=8 + DS6 | `iuCanBeBought("s")` / `imaginaryRequirementBits`、`canReality` | 至少一次 `IU25 purchase ok=true`（I2） |
| V3 | tier=8 run 在位但买不成 | tier 是否 2 s 内跳到 9 | 不出现 tier=9（L5/L6） |
| V4 | IU25 买入后 | `isRunning`、ID 产量 | run 关闭、ID 恢复（L7） |
| V5 | doomed 进入 | `isDoomed`、佩勒页签 | 正常进入（P1） |
| V6 | doomed 前 60 s | 反物质指数、维度数、dimboost、galaxy、`records.totalAntimatter` | 均单调增长（P2） |
| V7 | doomed 自动器 | `infinities` 增量、`auto.bigCrunch.isActive` | 大坍缩/永恒自动器为 false，AM 不被反复清零（P3） |
| V8 | doomed + keepAutobuyers | `ip`、`auto.bigCrunch.interval`、`player.break` | 出现大幅 IP、interval 买满、break=true（P4） |
| V9 | 大灾变 | 时间戳、interval、DT/TP 清空 | 间隔≥20 s、keep 后 interval 满才大灾变（P5） |
| V10 | 终局 | `endState`、`isGameEnd` | `endState` 单调→≥1，`isGameEnd=true`（P7） |
| V11 | 关闭总开关 | doom/armageddon/购买 | 全部停止（P8） |

### 4.3 验证所需证据（与项目规则一致）
- logcat 过滤 `OREKI_LAITELA|OREKI_PELLE|OREKI_REALITY_PACING|OREKI_PELLE_REC|OREKI_CRUNCH`；
- frame-observer `/ui` 或 `/snapshot.jpg`（不用 uiautomator）；
- `player.json` 中的 `isGameEnd`、`celestials.pelle.records.totalAntimatter`、`celestials.laitela.difficultyTier`、`reality.imaginaryMachines`、`auto.bigCrunch.interval`、`break`；
- 每项标注 PASS/FAIL/BLOCKED/NOT RUN，**不得用读码结论冒充运行期 PASS**。

## 5. 证据与限制

- **只读**：本次未启动浏览器、未启动 Gradle/AVD、未运行任何游戏/测试；所有 Android 现状为静态读码，**未经运行验证**。
- **不猜 ABI**：本文对 Android 侧需要新增/修改的点（`clearCelestialRuns`、maxAll、dimboost/galaxy 立即购买、interval 升级、IU bits 刷新、非同伴符文计数）均标"先补 ABI 取证再写业务"，不得按推测的混淆名直接改。
- **上游对象不可用**：本地仓库无 `5409e320` 原 commit 对象，本文 Web 引用均来自当前 main（=冻结上游 + 已合入 MOD 修改），并在 `docs/SHARED_GAMEPLAY_STANDARD.md` 登记的上游基线下理解。
- **既有文档状态过期**：`WEB_ANDROID_DIFFERENCES.md` 最后更新 2026-11-01/R51，其中"Android 莱特拉/佩勒缺失""终局不可达"等条目已部分被 R108-01 的 Kotlin 驱动取代；引用时保留原文状态，本文不篡改历史结论。
- **范围外**：Ra/Lai'tela 全域、天神 run、V/Ra 门禁、符文自动化深度、Android 构建链/AGP 不属本次审计。

## 6. 一句话交付

Android 端终局链已具备"莱特拉 tier + IU25 + 佩勒 doom/升级/大灾变"骨架，但与 Web 真实跑通版本相比，**佩勒阶段的增产动作、停重置、脉冲大坍缩、interval/break 通路整体缺失**，另有 **tier≥8 撤 run / 残熵 / tier 溢出 / IU25 bits 刷新** 四处高风险差异；在补齐并按 §4.2 跑完 AVD 之前，Android 的 `gameEnd` 不能宣称可达。