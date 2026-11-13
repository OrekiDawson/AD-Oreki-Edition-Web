# Web 与 Android 实现差异表（WEB_ANDROID_DIFFERENCES.md）

> **本文件是硬链接共享文件。** 三个路径指向同一个 inode：
> - 项目总根：`AD-Oreki-Unified/WEB_ANDROID_DIFFERENCES.md`
> - Web 仓库：`web/AD-Oreki-Edition/WEB_ANDROID_DIFFERENCES.md`
> - Android 仓库：`android/AD_Oreki_Edition_Android/WEB_ANDROID_DIFFERENCES.md`
>
> 只通过**一个**路径编辑；Git 不保存硬链接关系，两个仓库各自正常追踪内容副本。
> `git checkout / reset / pull / merge` 之后必须重新核对 `stat -c '%d %i'`，
> 关系断了就按 §6 的安全流程重建。

**最后更新**：2026年11月1日（R51）
**维护规则**：见项目根 `AGENTS.md` §21 与本节 §15；每轮开工先读、收工必更新。
**自 R51 起的强制要求**：每轮涉及 Web / Android 功能变化时，必须同步评估本文件是否需要更新。
本文件是**双端一致性事实清单**，不是待办列表——过期结论必须删改，不得堆积。

## 0. 怎么读这张表

| 字段 | 取值约定 |
|---|---|
| 差异类型 | `无差异` / `UI` / `逻辑` / `数值` / `性能` / `平台限制` |
| 是否预期 | `预期`（设计允许，写清原因）/ `需修复`（违反双端一致）/ `缺失`（一端根本没实现） |
| 验证状态 | `已验证`（有运行期证据）/ `待验证`（只有读码或静态推导）/ `待修复` / `未验证` |
| 证据 | 源码位置 / 测试记录 / 提交号。**没有运行期证据的一律不许写「已验证」** |

**判定门槛（写死，别放宽）**：
- 「已验证」= 有本轮或最近两轮内的**真实运行证据**（AVD 实测 / 浏览器实测 / logcat / 采样 jsonl），且报告里能查到命令与输出。
- 纯读码、纯 smali 反编译、纯静态断言 → 只能写 `待验证`。
- 「代码看起来一样」**不是**双端一致的证据。

---

## 1. 游戏核心逻辑与数值公式

| 功能模块 | Web 实现 | Android 实现 | 差异类型 | 是否预期 | 一致性要求 | 验证状态 | 证据 | 负责人/后续 |
|---|---|---|---|---|---|---|---|---|
| 游戏速度倍率 | `getGameSpeedupFactor()`，默认 F=10000，`OrekiSpeed` 注入点唯一 | `OrekiSpeed` / `apply` 注入，F=10000；时间补偿（记忆 √F / 动量 F / 暗物质 √F）另行注入 | 逻辑+性能 | 预期（DEX 侧只能改常量与调用点） | 同输入下「现实时间 vs 游戏内时间」比例一致 | 待验证 | Web `src/core/oreki-speed*.js`；Android `scripts/build_mod.py` 的 `[4n]` 天体时间补偿自检 | R41：两端各跑一次 F=1 / F=10000 对照表 |
| 时间倍率下「已流逝时间」缩放 | 主循环按 `diff × F` | `IntervaledAutobuyerState.c()` 已改为按倍率缩放已流逝时间 | 逻辑 | 预期 | 自动购买器的「间隔」语义一致 | 待验证 | Android 构建日志 `[Oreki AC]` | R41 |
| 终局判据 | `game-end.js`：`OFFSET = 1`、`TARGET = 1000`，`endState >= 1 ⟺ 反物质指数 ≥ 1000` | `patch_pelle_end_target()` 把两条 `const-wide` 立即数改成 `1.0` / `1000.0`（后续修为 `1001.0`）；`OrekiPelleRecord.smali`（R42）补写 `PelleRecords.totalAntimatter`，由构建期断言强制挂在 `onAutoBuyerTick` | 数值 | 预期 | 判据字面一致（1e1000） | **待验证**（常量与记录写入都已就位，但从未跑到佩勒；`endState` 目前仍恒 0） | Web `src/core/celestials/pelle/game-end.js`；`OrekiPelleRecord.smali`；FACTS §C.15 / §C.17 / §C.59 | R51-AND-01：推进到佩勒再验 |
| IU25 成本 | `OREKI_IU25_COST = 5e9`（原版 1.6e15） | 未确认是否同步 | 数值 | 需修复（若未同步） | 同一常量 | 未验证 | Web `secret-formula/reality/imaginary-upgrades.js` | R41 用 REA 查 Android 侧 IU25 成本常量 |
| EC 入口资源门槛缩放 | `OREKI_EC_REQUIREMENT_DIVISOR = 100`（Reality 解锁前生效，`isOrekiBootstrapRun()` 判定） | 未确认是否有对应缩放 | 数值 | 需修复（若未同步，Android 会有不可达的 EC） | 同一缩放与同一生效窗口 | 未验证 | Web `src/core/time-studies/ec-time-study.js` | R41：REA 查 `requirementTotal` 对应方法 |
| V 解锁阈值 | `realities 200 / dilatedTime 1e30 / replicanti 1e20000` | `patch_v_unlock_thresholds()` 同步三项（常量 + 进度分母两处） | 数值 | 预期 | 三项同时一致 | 待验证 | Android 构建日志 `[R34 Agent C]`；Web `secret-formula/celestials/v.js` | R41 |

## 2. 维度 / 升级 / 自动化

| 功能模块 | Web 实现 | Android 实现 | 差异类型 | 是否预期 | 一致性要求 | 验证状态 | 证据 | 负责人/后续 |
|---|---|---|---|---|---|---|---|---|
| 维度自动购买 | 原版自动器 + `oreki-early-automation.js` 开局例行 | 原版自动器；`[Oreki AU2~AU7]` 把解锁条件放宽到「首次无限后」，并在 `Game.autoBuyerTick` 挂 `OrekiStageAuto.onAutoBuyerTick()` | 逻辑 | 预期（Android 侧原版解锁更晚） | 首次无限后即可自动买维度/速度/提升/星系/坍缩/IP 倍率 | 待验证 | Android 构建日志 `[Oreki AU2..AU8]` | R41 |
| 维度批量购买退化 | 原版 `buyMax` 语义 | `[Oreki AB2]` 不可负担时退化为买 1 个（`OREKI_NO_AB2=1` 可关，仅用于 A/B 对照） | 逻辑 | 预期 | 开局不因买不起而完全停摆 | 待验证 | Android `patch_autobuyer_batch_fallback()` | R41 |
| 时间维度 / 时间定理 / 时间研究自动化 | `oreki-eternity-automation.js`：`buyTimeDimensions` / `buyTimeTheorems` / `buyTimeStudies` / `buyDilationStudies`，每 30 帧一轮 | **已实现**：`oreki/OrekiEternity.smali`（452 行，`tick()` → `buyTimeTheorems` / `buyTimeDimensions` / `buyNormalStudies` / `tryEternity`），由 `OrekiStageAuto.onAutoBuyerTick` 在 `isDoomed` 判定之后调用 | 逻辑 | 预期 | 同语义的时间研究自动购买 | **待验证**（代码存在且被调用，但**尚无一条运行期日志证明它真的买到过时间研究**） | Android `OrekiEternity.smali`；调用点 `OrekiStageAuto.smali` 的 `OrekiEternity.tick()` | R51：补 `OREKI_ET_*` 运行期日志后再判 |
| 现实自动循环 | `oreki-reality-automation.js`：8 s / 15 s 分阶段节流 + 符文管理 | 未找到等价模块 | 缺失 | 需修复 | 同语义 | 未验证 | 同上 | R41 |
| 符号/记数法 | 默认原版 Scientific | 默认 Scientific（`[DARK]`/记数法补丁） | UI | 预期 | 默认值一致 | 待验证 | Android 构建日志 | 已完成待复核 |
| 金币下限 | 无此概念 | `[4d]` `getStds` 读取边界钳制 ≥ 10000 | 平台限制 | 预期（商店/广告体系是 Android 独有） | 不影响玩法 | 待验证 | Android 构建日志 `[4d]` | — |

## 3. 挑战与挑战奖励

| 功能模块 | Web 实现 | Android 实现 | 差异类型 | 是否预期 | 一致性要求 | 验证状态 | 证据 | 负责人/后续 |
|---|---|---|---|---|---|---|---|---|
| 「进入即完成」 | `oreki-instant-challenges.js`：进入后按原版结算路径补满 | `OrekiInstantChallenge.smali`（挂在 `Challenges.update` 入口）+ `patch_instant_challenge_rewards()` 真实补发 IP / 无限次数 / EP 并更新最速记录 | 逻辑 | 预期（实现语言不同） | 进入即完成、奖励真实结算、幂等 | 待验证（IC1 已在 R39 实测；EC 全链未实测） | Android `reports/r39a/R39A-Android-IC1.md`；Web `src/core/oreki-instant-challenges.js` | R41 |
| IC 自动进入的极性 | `b.K()Z` 语义「已完成」→ 未完成才 start | R39 修 4 处极性 + 构建期三连断言；R40 仍在用 | 逻辑 | — | 未完成才进入，已完成绝不重进 | 已验证（R39 AVD：IC1 进入即完成、IP 28→97、30 s 不重入） | Android `6d7f089`；`check_challenge_auto_polarity()` | 回归已纳入构建期断言 |
| EC 前置时间研究的购买入口 | `buyEcStudiesAndStart()` 用 `study.purchaseUntil()`（会 `commitToGameState(buyStudiesUntil(...))` 补齐整条前置） | 原来只调 `purchase()`（`fp3.D`）⇒ 链式前置买不上、该关永远买不上；R40B 改为失败后调 `c;->N(Continuation)`（= `NormalTimeStudyState.purchaseUntil`） | 逻辑 | 需修复（已修） | 同一入口语义 | 部分实测（AVD：EC12 完成次数 **0→5**，同期 `eternities` ×1700~3500、`infinities` +9~10 个数量级 ⇒ **走的是真实永恒重置，不是写完成位**；**但「前置链由 `purchaseUntil` 补齐」未确认**——B3 去掉 233/234 后 EC12 照样 0→5，而跑完树上仍无 233）；变异自测 11/11 | `reports/r40b/R40B-Android-验收.md` §3；`ec_run_b3.jsonl` | R41：打临时日志确认 `purchaseUntil` 是否真被调用 |
| EC 互斥时间研究分叉 | R40A 新增 `dimensionPathId()`：**EC11 已满且 EC12 未满 → 73，否则 71**；原实现按 `nextUnfinishedEcId()===12` 判定 → 与 `oreki-dilation-automation._targetEc()` 互斥要求打架，每 6.2 s respec 一次 | 没有「选分叉」概念，改为检测 `b.p`（forbiddenStudies）冲突：`A()==0 && z()==1 && O()==0` 时走原版 `respecTimeStudies(auto=true)`，6 s 冷却 / 全程 32 次上限；EC11/12 才触发，EC1~EC10 的 `b.p` 为空数组故不触发 | 逻辑 | 预期（平台机制不同：Web 有整棵树的可用性判定，Android 只有冲突检测） | 两端都能把 EC11/12 打满 | 未验证（AVD 夹具 B2 保留了 71/72，跑完 `studies` 仍是 60 条、71 仍在树上 ⇒ **该分支本轮根本没触发**，既不能证真也不能证伪） | Web：改前 EC1~12 全 5/5 `75.2 s` → 改后 `27.8 s`；Android `reports/r40b/R40B-Android-验收.md` §3.3 | R41：造一个必定冲突的夹具再测 |
| EC 满级后的退关时序 | `buyEcStudiesAndStart()` 第 3 段：满 5/5 → `respecTimeStudies(true)` 清 `unlocked` → 下一关 | 无独立退关流程；靠 `respecForEc()` 的冲突检测间接推进 | 逻辑 | 需修复（若 Android 卡在同一关） | 12 关各 5/5 后能继续 | 未验证 | Web 侧 R40A 实测：每现实 12 次 respec、无重复 | R41 |
| EC 重复进入 / 重复发奖 | `EternityChallenge.isRunning` 守卫 + 完成位 | `b.K()Z` 完成位守卫 | 逻辑 | 无差异（语义对齐） | 幂等 | 已验证（R39 AVD：重启不重复发奖） | R39 报告 | — |
| EC 资源门槛 | 见 §1「EC 入口资源门槛缩放」 | 未确认 | 数值 | 需修复（若未同步） | 同值 | 未验证 | — | R41 |
| EC12 限时判定 | 按倍率还原（`inGameSecondsOf`） | `[Oreki EC12]` 已改为按倍率还原 | 逻辑 | 预期 | 同一还原口径 | 待验证 | Android 构建日志 | R41 |
| 挑战界面「进入即完成」提示 | `FailableEcText.js` 等文案 | 中文文案（Android 官方简体中文） | UI | 预期 | 术语一致 | 待验证 | — | R41 文案对照 |

## 4. 无限 / 永恒 / 现实 / 天神 / 终局

| 功能模块 | Web 实现 | Android 实现 | 差异类型 | 是否预期 | 一致性要求 | 验证状态 | 证据 | 负责人/后续 |
|---|---|---|---|---|---|---|---|---|
| 首次现实入口 | `processManualReality(false)`（与玩家点按钮同一函数） | **已实现**：`oreki/OrekiReality.smali`，走原版 `prestige/f;->f()Z`（canReality）+ `prestige/f;->b(Cont)`（与原版现实自动器同一条路径）；最小间隔 2 秒（R58 由 1 秒改到与 Web 同值） | 逻辑 | 无（R59 起已接线并由 `onAutoBuyerTick` 每帧调用） | 同语义 | **读码 + 静态**；未在 AVD 上跑到 Reality 阶段 | Web `oreki-reality-automation.js`；`OrekiReality.smali` | R58/R59 已更新，R41 结论作废 |
| **Break 闸门（自动打破无限）** | `oreki-break-infinity-gate.js` `tryOpen()`：`!grantedThisSession && !Pelle.isDoomed` → 补差额 → `while(!hasMaxedInterval) upgradeInterval(false)` → `x0(true)`，同一 tick 三步连做 | **已实现**：`oreki/OrekiBreakGate.smali`（711 行），走原版真实序列（`Player.x0(true)` + `autobuyer.a.c()` 不省），并有 `OREKI_GATE / OREKI_GRANT / OREKI_BUY / OREKI_BREAK / OREKI_ABORT` 五类状态日志 | **实现差异** | 预期（实现语言不同，语义同源） | 必须走原版真实路径，`a.c()` 不许省 | **待验证**：A27 实测 `OREKI_GATE: window=1` 出现过一次，但 `brake` 仍为 false、`interval` 未到 100 ⇒ **闸门进过窗口但没落到 `:bg_do_break`** | `OrekiBreakGate.smali`；Web `gate.js:102-122` | R51-AND-01：先修 IP 收入（已做），再看闸门能否走完 |
| **间隔阶段补贴（32767 IP）** | `BREAK_INTERVAL_TOTAL_COST = 2^15 − 1`；只补「差值」，会话级幂等，`!Pelle.isDoomed` 门内 | **已实现**：补贴逻辑并入 `OrekiBreakGate.smali`（`sGranted` 会话级幂等 + `OREKI_GRANT` 日志），差额由原版成本函数动态推算，未写死 32767 | 实现差异 | 预期 | 补贴额必须动态推、只覆盖到 Break 那一刻 | **待验证**：A27 日志里 `OREKI_GRANT` 一次都没出现 ⇒ 补贴分支从未进入（与闸门没走到补贴步骤一致） | `OrekiBreakGate.smali`；Web `gate.js:46-51` | R51-AND-01 |
| 符文自动装备 | R40A 改为**只装空槽**：绝不替换已占用槽 | **无符文自动装备自动化** | 逻辑 | 需修复（Web 已修 bug，Android 无对应功能） | 不触发静默重置；能拿到 RU9/16/17/18/24 | 待验证（Web 修完未跑完整验收） | 见下方 §4.1 专项 | R41 |
| 幻象机器（IM）类型坑 | `Currency.imaginaryMachines.value` 是 **Number**，调用 `.gte()/.lte()` 会 TypeError 且被 catch 吞成 `false` | 未确认（smali 侧无此 API 形态） | 逻辑 | 预期（平台 API 不同） | 判定结果一致 | 已验证（Web R39 修 `iu25ConditionsReady`） | FACTS §C.19 | — |
| 莱特拉 tier 升级 | `OrekiEndgameAutomation.driveLaitela()`：`tier>=8` 前用有界 `holdReality` 抢 30 s 窗口；R40 新增「EC 链全通即提前压现实（90 s 上限）」护住 DS6 | 未找到等价自动化 | 缺失 | 需修复 | 能真实升到 tier 8 并买 IU25 | 待验证 | 见 FACTS §C.21~C.23 | R41 |
| 佩勒（毁灭现实）驱动 | `driveDoomed()`：`maxAll` + 维度提升 + 星系 + 佩勒升级；**每 100 ms 关掉大坍缩/永恒自动器**，让 `records.totalAntimatter` 单调增长 | **原版通路已核对齐全、未被我们改动**：① `prestige/f;->o(Lqw3;ZLCont;)` 里 `Pelle.isDoomed && keepAutobuyers.canBeApplied && CrunchAutobuyerState.hasMaxedInterval → Player;->x0(Z)`（= `player.break`，序列化键 `break`）L7445-7530；② `Pelle.armageddon` = `celestials/pelle/c;->g(ZZLCont;)`，L3874 调 `prestige/f;->l`；③ 自动器 `reset()` = `UpgradeableAutobuyerState;->h()V`，读 `keepAutobuyers` 早退。**缺的只是驱动**（没人调 `armageddon`，`remnants` 恒 0 → 碎片 0 → 5e6 买不起 → 间隔被重置回 150000 → `hasMaxedInterval` 恒 false → break 永不开）。R40P 结论：**策略修正**——不是「关掉大坍缩囤产量」，而是「末日循环 → 碎片 → keepAutobuyers → 用真实 IP 买满间隔 → 再末日一次」 | 缺失（驱动层未实现；原版三处通路完整） | 需修复 | 反物质峰值能涨到 1e1000 | **未验证：break 未置真**（见 `reports/r40p-Android佩勒破无限.md`） | FACTS §C.15/§C.17；`prestige/f.smali:7445-7530`；`pelle/c.smali:3650/3874`；`UpgradeableAutobuyerState.smali:271` | R41：末日循环驱动 + AVD 实测 break |
| 终点记录写入（`PelleRecords.totalAntimatter`） | `currency.js:215-217`：反物质 setter 里 `if (Pelle.isDoomed) records.totalAntimatter = records.totalAntimatter.max(value)`，**每次赋值都抬峰值** | **玩法路径上完全没有写入点**：setter `d()` 只有两处调用者 —— `player/e.m()`（存档反序列化）与 `ve3.b()`（佩勒打击 #5，把记录**置常量清空**）。反物质 setter 只有 `thisInfinity/thisEternity/thisReality` 三条 `maxAM` | **缺失（原版移植本身的缺口）** | 需修复 | 必须是 setter 路径的**等价移植**并保留 `max()` 语义；**禁止用每帧采样替代**（会漏掉帧内峰值，且测不出来） | **未验证**：本轮不可能验到，需 Android 真能进佩勒 | FACTS §C.59（REA `ev_36243241…` / `ev_4639a438…`，原版 APK sha256 `d7860864…`） | R42：`OREKI_PELLE_REC` 为诊断入口；现在必须 `doomed=0 / rec=0` |
| 终局触发后 | `GameEnd.gameLoop` 置 `player.isGameEnd` | 常量已镜像（`TARGET=1001.0` 已修，`720f145`），置位点未改 | 数值 | 预期 | `endState>=1` 判据双端等价 | **部分验证**：公式等价已用位模式复核（`TARGET=1001` 时交会点恰在 `E=1000`）；但因上行缺写入点，**Android 侧 `endState` 恒 0，判定物理不可达** | FACTS §C.59；`celestials/pelle/b.smali` `b()D` | R42：先补记录写入，再谈终局 |

### 4.1 专项：符文替换会触发「无收益的完整现实重置」（Web 实测根因，Android 侧无此功能）

- 原版 `Glyphs.equip()` 在目标槽已占用时走 `swapIntoActive()`（`src/core/glyphs/glyph-core.js:319-323`），
  而 `swapIntoActive()` 里有一行 `finishProcessReality({ reset: true, ... })`（`:759`）
  ⇒ **一次完整现实重置，`realities` 不增、不发奖励**，却清空 EC 完成记录 / 时间定理 / 整棵时间研究树 / 膨胀研究。
- Web 旧 `equipGlyphs()` 的「替换更弱符文」分支正好命中它。R40A 实测 8 次可观测现实重置里有 3 次来自本条
  （t=140.9 / 256.1 / 387.8 s，全部紧跟在上一次真实现之后）。
- 修法：`equipGlyphs()` 只往空槽装，满槽直接跳过。
- Android：**没有符文自动装备自动化**，因此不存在这条 bug，但也拿不到 RU9/16/17/18/24 的符文形态要求。
  → 差异类型 `缺失`，`需修复`，`未验证`。

## 5. 购买与资源消耗

| 功能模块 | Web 实现 | Android 实现 | 差异类型 | 是否预期 | 一致性要求 | 验证状态 | 证据 | 负责人/后续 |
|---|---|---|---|---|---|---|---|---|
| 广告加成（十乘区） | 无此概念 | `t5.d/b/c` 三处改写：跳过时间与购买门槛（保留 Doomed）、十个乘区取真实数值、兜底不再抛 `NoSuchElementException` | 平台限制 | 预期（Android 有广告体系） | 不影响核心数值平衡 | 待验证 | Android 构建日志 `[5] Ad Bonus` | — |
| 商店金币读取下限 | 无此概念 | `[4d]` `getStds` 读取边界钳制 ≥ 10000 | 平台限制 | 预期 | — | 待验证 | 同上 | — |
| 时间研究购买（批量） | `TimeTheoremPurchaseType.*.purchase(true)` | 原版对应入口；R40B 补了 `purchaseUntil` 路径 | 逻辑 | 无差异 | 同成本、同前置 | 待验证 | — | R41 |
| 无尽/永恒的自动重置阈值 | `tickEternity()`：EP 收益 ≥ 当前 10 倍 | 未确认 | 数值 | 需修复（若不同） | 同阈值 | 未验证 | Web `oreki-eternity-automation.js` | R41 |

## 6. 存档 / 导入导出 / 重置

| 功能模块 | Web 实现 | Android 实现 | 差异类型 | 是否预期 | 一致性要求 | 验证状态 | 证据 | 负责人/后续 |
|---|---|---|---|---|---|---|---|---|
| 存档载体 | `localStorage["dimensionSave"]`（JSON 字符串） | `SharedPreferences` + 自定义编码（`files/player.json` 为 root 下的可读副本） | 平台限制 | 预期（不可能互通） | **不要求互通**，只要求各自幂等 | 已验证（R39 AVD：重启不重复发奖） | `environment/测试环境记录.md` | — |
| 旧存档时间换算 | 无（Web 是干净新档体系） | `[4e]` 三处 ×100 + 哨兵回落；`[4g]/[4i]/[4j]/[4m]` 把最速无限、最近十次无限/永恒/现实归一化 | 平台限制 | 预期（历史存档带旧单位） | 不把旧档读成错误时间 | 待验证 | Android 构建日志 `[4e]/[4g]/[4i]/[4j]/[4m]` | R41 |
| 重置清空范围 | 现实重置清 EC 完成记录 / 时间定理 / 时间研究 / 膨胀研究（`reality.js:651/666/673`） | 原版同源行为 | 无差异 | — | 一致 | 待验证 | FACTS §C.11 | R41 |

## 7. 游戏速度与真实墙钟耗时

| 功能模块 | Web 实现 | Android 实现 | 差异类型 | 是否预期 | 一致性要求 | 验证状态 | 证据 | 负责人/后续 |
|---|---|---|---|---|---|---|---|---|
| F=10000 下的实际吞吐 | 单页 Edge + 1 s 采样实测 | AVD 实测（CPU 受限，单次 gameTick ≈22 ms） | 性能 | 预期（设备差异） | 都不得出现「倍率不生效」 | 待验证 | Web `_r40m/*.jsonl`；Android `environment/测试环境记录.md` §性能 | R41 |
| 动态速度模式 | 有（`OrekiSpeed` 动态倍率） | `[T2]` 设置页两个按钮 → `setDynamic` / `modeLabel` | 逻辑 | 预期 | 语义一致 | 待验证 | Android 构建日志 `[T2]` | R41 |
| 新手真实通关 ≤180 min | **未达成**（R40 长跑 17 min 达到 V+IU15，此后卡在莱特拉/IU25） | **未验证**（连 EC 全链都未 AVD 实测） | 逻辑 | 需修复 | 两端各自从全新存档、无教程、真实墙钟 ≤180 min 触发 `isGameEnd` | 未验证 | `web/_tools/_r40m/r40m-long1-abort.log` | R41：**最高优先** |

## 8. 自动化行为与触发条件

| 功能模块 | Web 实现 | Android 实现 | 差异类型 | 是否预期 | 一致性要求 | 验证状态 | 证据 | 负责人/后续 |
|---|---|---|---|---|---|---|---|---|
| 自动化总开关语义 | `player.auto.autobuyersOn` 一票否决所有 oreki 模块 | 原版自动购买器开关 + `OrekiStageAuto` | 逻辑 | 预期 | 关掉即完全停止 | 待验证 | — | R41 |
| 挑战中的自动化窗口 | 任意挑战中 / Pelle / 天神现实中按模块各自设门 | 未系统整理 | 逻辑 | 需修复（若窗口不同） | 同窗口 | 未验证 | — | R41 |
| 自动机（Automator）等待分支 | Web 有 automator | `[AW]` `vo.smali` 追加 `isWaiting()Z` / `waitStart()J` 只读访问器 + `updateAutomator$1` 状态分支 | 逻辑 | 预期 | 等待态可见、不误判 | 待验证 | Android 构建日志 `[AW]` | R41 |
| 每帧全量重置防护 | R39 修 IC1 极性；R40 修 `dimensionPathId` + 符文替换 | R39 修 4 处极性 + 构建期三连断言 | 逻辑 | 无差异（都已修） | 不得出现「每帧一次大坍缩/现实重置」 | 已验证（R39 AVD 30 s 不重入） | `6d7f089` | — |

## 9. UI / 交互 / 导航 / 中文术语

| 功能模块 | Web 实现 | Android 实现 | 差异类型 | 是否预期 | 一致性要求 | 验证状态 | 证据 | 负责人/后续 |
|---|---|---|---|---|---|---|---|---|
| 主导航 | 侧栏 **10 项**：维度 / 自动化 / 挑战 / 无限 / 永恒 / 现实 / 天神 / 成就 / 统计数据 / 选项 | 底栏 **12 项**：维度 / 自动化 / 挑战 / 无限 / 永恒 / 现实 / 天神 / 成就 / 统计数据 / 选项 / 商店 / 信息 | UI | 预期（Android 多商店/信息） | 排序按进度一致 | 待验证（R39 实测 9 页可切） | Android `AGENTS.md §3-D` 坐标表 | R41 |
| 术语基准 | 跟随 Android 官方简体中文 | Android 官方简体中文字符串资源 | UI | 预期（Android 是基准源） | 全部玩家可见文本简体中文 | 待验证 | `web/upstream/ADChinese`（对照） | R41 |
| 深色模式 | 深色主题 + R40C CSS 修复 | 原创页面全部深色 | UI | 预期 | 都是深色 | 待验证 | Web `public/stylesheets/oreki.css`（R40C 改动） | R41 |
| 教程入口 | MOD 中文教程（侧栏） | 「打开 Oreki 中文教程」按钮，颜色固定 `#0078D7` | UI | 预期 | 都有常驻中文教程 | 待验证 | Android `[T1]/[T1b]` | R41 |
| 顶栏「当前页面」 | 无（侧栏高亮） | 有 | UI | 预期（窄屏导航需要） | — | 待验证 | Android 构建日志 `[R32]` | — |
| 新闻模块 | **关闭** | 无此模块 | UI | 预期 | Web 保持关闭 | 待验证 | — | — |
| 首启「更新日志」弹窗 | 无此弹窗 | `res/raw/changelog.txt`，R40B 已改简体中文 | UI | 预期（Android 独有） | 中文、不破坏换行 | 待验证（构建产物已改，未截图确认） | `patch_changelog_zh()` | R40 已在 AVD 上复核 |
| 移动端适配 | R40C：安全区 / 底部导航遮挡 / 表格横向滚动 / 超长数字不撑破容器 | 原生布局（无此问题） | 平台限制 | 预期 | Web 在 320~430 dp 不阻碍操作 | 待验证 | `web/_tools/_r40c/R40C-Web移动端.md` | R41 |

## 10. 移动端性能与平台限制

| 功能模块 | Web 实现 | Android 实现 | 差异类型 | 是否预期 | 一致性要求 | 验证状态 | 证据 | 负责人/后续 |
|---|---|---|---|---|---|---|---|---|
| 帧率 / CPU | 浏览器单页，Edge 实测 | 单次 `gameTick` ≈22 ms，CPU 受限（提频实验否定） | 性能 | 预期 | 都不出现可见卡顿 | 待验证 | Android `patch_frame_cadence()` 注释里的实测 | — |
| 主循环驱动 | `requestAnimationFrame` + 固定 diff | Kotlin 协程 / Handler | 平台限制 | 预期 | 同一 tick 语义 | 待验证 | — | — |
| 后台/离线结算 | 无（关页面即停） | 有离线结算页（「在你离开的 X 时 Y 分 Z 秒里」） | 平台限制 | 预期 | — | 已验证（本轮首启截图见 `reports/r40b/shots/01_launch.png`） | — | — |
| **UI 可测性（观测工具链）** | 浏览器 CDP / Edge 长跑封装 `web/_tools/lib/edge-launch.mjs` | **`uiautomator dump` 不可用**：游戏持续动画 ⇒ `ERROR: could not get idle state`，且**失败时不写 XML**，磁盘上留的是上一次的旧文件。可用通道是 frame-observer 的 `GET /ui?depth=48&max=3000&flat=1`（无障碍服务即时控件树，不需要等 idle）+ `GET /events` 事件时间线 | 平台限制 | 预期 | 两端的「读界面」都不能靠截图人眼 | 已验证（R40 实测：游戏前台下 `/ui` 返回 97 个节点含完整中文文本与 bounds；同一时刻 uiautomator 连续 3 次失败） | `frame-observer` 提交 `4fd58bc` / `d0bec16`；封装 `android/AD_Oreki_Edition_Android/tools/fo.py` | 后续所有 Android UI 结论必须走 `/ui` 或 `/events` |

---

## 11. 本轮（R40）新增/变更的差异条目索引

| 变更 | 条目位置 |
|---|---|
| Web 新增 `dimensionPathId()`，EC 分叉判定改为「EC11 已满 & EC12 未满 → 73」 | §3「EC 互斥时间研究分叉」 |
| Web `equipGlyphs()` 改为只装空槽（修「替换触发静默现实重置」） | §4.1 |
| Web `driveLaitela()` 新增「EC 链全通即提前压现实（90 s 上限）」护住 DS6 | §4「莱特拉 tier 升级」 |
| Android 补 EC 前置研究 `purchaseUntil` + 互斥分叉 respec | §3 前两条 |
| Android 首启更新日志改简体中文 | §9 |
| Web 移动端 CSS 修复 | §9「移动端适配」 |

## 12. 已知的「看着一样其实不一样」清单（防误判）

1. **两端的 EC 分叉是两种机制，不能因为都能打满就说「实现一致」**：Web 是「选一条路径」，
   Android 是「检测到冲突再 respec」。语义等价但实现不同，**任何一端改判定都要重测另一端**。
2. **Android 自动化只覆盖「首次无限 → 攒 IP → 拉间隔」这一段，永恒 / 现实 / 天神 / 佩勒的自动化都还没有。**
   但**不要说成「Android 缺这些功能」**——原版 APK 里 `celestials/` 下 `effarig / laitela / nameless / pelle / ra / teresa / v` 全在，
   `Player$Celestials` 的七个字段也全在（2026-10-31 实测）。**功能齐、驱动缺**，这是两件不同的事，
   把它写成「缺 2700 行」会让人误判工作量。
   ⇒ 更上游的一条在 FACTS C.59：**Android 连终点记录都没写**，所以哪怕自动化全齐也到不了终局。
   判断「Android 能不能通关」必须先看 C.59，而不是数自动化条目。
3. **`RealityUpgrades.allBought` 这类标志在两端语义不同**（Web 有 `allBought` getter，Android 靠 `b.b()`），
   不要用同一个词当同一件事。
4. **构建通过 ≠ 运行通过**。Android 侧 EC 改动在 R40 之前只有「smali 汇编通过 + 构建期断言 + 变异自测」，
   **没有一次 AVD 实测**；R40 补上了 AVD 实测（见 §3 各条的「验证状态」列），但**只有前置齐全那一个场景**，
   其余场景仍为 `待验证`。
5. **`challenge.eternity.unlocked` 的语义极易误读**：它是「当前唯一解锁的那一关的 id」，
   `0` = 一关都没解锁。而 `Eternity.reset()` 每次都会把它清回 `0`。
   所以「跑完之后 `unlocked` 还是 0」**不能**推断成「没进过 EC」——
   R40 就差点据此把一次真实的 EC 完成误判成失败。
   另一个坑：`build/agentc_dark/late_save.json` 原样是 `completions` 全 5 但 `unlocked=0` 的**自相矛盾夹具**，
   直接拿它测「EC 能不能进」会得到「一关都进不去」的假缺陷。
6. **`uiautomator` 在游戏页面上基本不可用**：见 §10 第 1 条。凡是「用 uiautomator 验证 Android UI」的结论，
   都要先确认那次 dump 真的成功（失败时**不写文件**，磁盘上是上一次的旧 XML，极易误读）。

## 13. 硬链接维护流程（每次改动后照做）
```bash
cd /c/Users/Oreki/WorkBuddy/AD-Oreki-Unified
# 1) 确认三处仍是同一 inode 与同一设备号
stat -c '%d %i %n' WEB_ANDROID_DIFFERENCES.md \
  web/AD-Oreki-Edition/WEB_ANDROID_DIFFERENCES.md \
  android/AD_Oreki_Edition_Android/WEB_ANDROID_DIFFERENCES.md
# 2) 内容一致性
cmp WEB_ANDROID_DIFFERENCES.md web/AD-Oreki-Edition/WEB_ANDROID_DIFFERENCES.md && \
cmp WEB_ANDROID_DIFFERENCES.md android/AD_Oreki_Edition_Android/WEB_ANDROID_DIFFERENCES.md
```

断了就重建（**先确认内容一致再删**，绝不做「先删后建」）：

```bash
# 只在「根文件是唯一有效版本」时执行
cmp WEB_ANDROID_DIFFERENCES.md web/AD-Oreki-Edition/WEB_ANDROID_DIFFERENCES.md \
  && rm web/AD-Oreki-Edition/WEB_ANDROID_DIFFERENCES.md \
  && ln WEB_ANDROID_DIFFERENCES.md web/AD-Oreki-Edition/WEB_ANDROID_DIFFERENCES.md
```

若某个仓库里那份**有未提交的有效修改**，先把它 `git diff` 出来人工合并进根文件，再重建链接。

## 14. 本轮（R42）变更索引与「已实现 / 已构建 / 已安装 / 已验证」四态

> 四个状态**不许混写**。「已实现」= 代码在仓库；「已构建」= 产出 APK；「已安装」= 装进 AVD；
> 「已验证」= 有运行期证据（logcat / 字段真值 / 控件树读数）。缺哪一项就写缺哪一项。

| 变更 | 条目位置 | 已实现 | 已构建 | 已安装 | 已验证 |
|---|---|---|---|---|---|
| 终点记录写入 `PelleRecords.totalAntimatter`（补 Web `currency.js:215` 的第四条） | §4 第一行 | 否（待落盘） | 否 | 否 | 否 |
| 自动 Break Infinity（AD5b，走原版四步序列） | §4「Break 闸门」 | 进行中 | 否 | 否 | 否 |
| 间隔阶段补贴（AD5 B，动态推差额） | §4「间隔阶段补贴」 | 进行中 | 否 | 否 | 否 |
| `endState` 判据 `TARGET=1001.0`（消掉分母 off-by-one） | §4「终局触发后」 | 是（`720f145`） | 部分（候选包含，正式包不含） | 部分 | 公式等价已复核；运行期未验 |
| `OrekiStageAuto` 八处极性 + AchAudit 相邻两行极性 | FACTS §C.50 / §C.54 | 是（`a97580c`/`81cc909`） | 部分（候选包含，正式包不含） | 部分 | **是**：`mode=2/xHighest=1e1`、interval 150000→19440、`OREKI_ACHAUDIT` 每 5 s 一轮 |
| 教程 ch05 Break Infinity 机制 | FACTS §C.60 | 是（`ad8ffeb`/`986dcac`） | 是（05:39 候选包含资产） | 否 | Web 五项验收过 4；Android ①②④ 待补 |
| Web 智能路线择优 | FACTS（待编号） | 进行中 | 不适用 | 不适用 | 否 |

### 14.1 三条「不要被表面现象骗到」的判据（本轮新增）

1. **看 APK 先数 `assets/`，别看 mtime。** 正式包 mtime 比候选包新一天，内容却是旧包（22 项资产 vs 24 项），
   教程正文因此为空。见 FACTS §C.55 / §C.67。
2. **看 smali 极性先找已知语义的基准样本。** `Lju;->t(D)Z`（canAfford）是标准样本。
   `OrekiAchAudit` 是**相邻两行各错一次**，只修一行会停在「0 轮」或「1 轮」，见 FACTS §C.54。
3. **`uiautomator dump` 在这个应用上恒失败**（`could not get idle state`），失败时**不写文件**，
   磁盘上是上一次的旧 XML，极易误读成「页面没变」。要控件树就走 FrameObserver 的 `/ui`（a11y 通道，无需 MediaProjection 授权）。
   另：`oreki_test` 在 `-gpu swiftshader_indirect` 下会**画面冻结但应用在跑**（screencap md5 恒定、logcat 正常），
   换 `-gpu angle_indirect` 才正常。见 FACTS §C.64。

---

## 15. R51（2026年11月1日）双端差异清单（五类标签）

> 本节自 R51 起为**必更区**。每轮涉及功能变化时先改本节，再改对应分节。
> 五类标签的语义（用户 2026-11-01 16:08 指定，不得混用）：
> **【设计差异】** 有意保留的平台差异　**·　【实现差异】** 两端都实现但写法不同　**·　【功能缺口】** 一端有、另一端没有　**·　【待验证】** 无充分运行期证据　**·　【已解决】** 原差异已消除且有证据

### 15.1 R51 涉及的八个主题

| # | 主题 | 标签 | Web 位置 | Android 位置 | 当前事实与证据 | 后续任务 |
|---|---|---|---|---|---|---|
| 1 | 挑战「启动即完成」 | 【实现差异】+【待验证】 | `src/core/oreki-instant-challenges.js`（225 行，进入后按原版出口结算） | `OrekiInstantChallenge.smali`（挂 `Challenges.update` 入口）+ `patch_instant_challenge_rewards()` | 语义一致（进入→原版结算→发奖→幂等）。**IC1 有 AVD 实测**（IP 28→97、30 s 不重入）；**EC 全链无本轮实测**，最近一次是 R40B 的 EC12 完成次数 0→5 | R51-03：Web/Android 各自跑一遍 IC + EC，记录完成数与奖励 |
| 2 | 智能调度器 | 【功能缺口】（**未接线**） | `src/core/oreki-smart-executor.js`（1185 行，唯一调度器，默认 3 s） | `oreki/OrekiAutomationScheduler.smali`（1352 行，设置页 + 持久化键齐备） | **A27 实测**：logcat 有 `OREKI_SCHED: init 调度：已启用 · 间隔 1 秒`，但 `OrekiStageAuto.smali` 与 `build_mod.py` **均无任何 `OrekiAutomationScheduler` 引用** ⇒ 调度器只初始化，**没有管辖任何动作**，从未出现 `OREKI_SCHED act` | R51-SCHED-01：接线 + 十项运行期验收 |
| 3 | 教程 | 【已解决】（Web 侧待复核） | `src/core/oreki-tutorial-data.json`（唯一正文源） | 构建期生成 `assets/oreki_tutorial.txt`（A28 构建实测 167445 字节） | 单源已成立：Android 资产由 Web JSON 生成，不手写第二份。运行时渲染**未做逐页验收** | R51-05：Android 运行时逐页渲染 + 术语核对 |
| 4 | 默认科学记数法 | 【已解决】 | 默认 Scientific，且**不覆盖**玩家已选 | `build_mod.py:4864` 起「默认科学记数法」补丁组 | 补丁存在且有构建期断言；**未做「玩家先改成 Emoji 再重启，记数法是否被覆盖」的运行期实测** | R51-05：补一条「改过记数法后重启不被覆盖」的实测 |
| 5 | Android 深色模式 | 【设计差异】 | 深色主题（`public/stylesheets/oreki.css`） | 构建日志 `[DARK] activity ok(Theme.DeviceDefault → Theme.Material 固定深色)` | 原创页面统一深色，属平台设计选择；Web 是网页深色主题，实现不同但观感目标一致 | — |
| 6 | Web 移动端适配 | 【待验证】 | 视口 320/360/393/411/980/1280 与安全区 | 原生布局，无此问题 | R51 正在做（`web/reports/_r51/`）。**此前从未完成六视口全量验收**，仅有 R40C 的定向修复 | R51-WEB-01 |
| 7 | 终局判定 | 【实现差异】+【待验证】 | `src/core/celestials/pelle/game-end.js`：`OFFSET=1`／`TARGET=1000`，`endState>=1 ⟺ 反物质指数 ≥1000` | `celestials/pelle/b.smali` 常量镜像为 `1.0`／`1001.0`（`720f145`）；`OrekiPelleRecord.smali`（R42）补 `PelleRecords.totalAntimatter` 写入 | 常量等价已用位模式复核；`OrekiPelleRecord.tick()` 由构建期断言强制挂在 `onAutoBuyerTick`。**但从未跑到佩勒**，`endState` 仍恒 0 ⇒ 判据物理不可达 | R51-AND-01：推进到佩勒后再验 |
| 8 | 挑战奖励结算 | 【实现差异】 | 原版结算路径 + 最速记录 | `patch_instant_challenge_rewards()` 补发 IP / 无限次数 / EP 并更新最速记录 | 走原版结算，不写完成位；幂等性有 R39 重启实测 | R51-03 |

### 15.2 R51 中发现并已消除的差异

| 差异 | 消除方式 | 证据 |
|---|---|---|
| 无限升级自动购买在列表首项 `return-void`，后续 16 项与 ipMult 分支永远轮不到 | `OrekiStageAuto.buyInfinityUpgrades` 改为 `goto :oreki_sa_iup_next` 继续遍历 | A27 实测 `infinityUpgradeBits` 0→2047；A28 到 131071 |
| ipMult 可重复升级被 `ID1.y()==0` 闸门永久挡住（全新档恒成立） | 改为「仅 ID1 已解锁但未买下时保留 IP」 | 同上 |
| **ipMult 用 `fp3.D()` 购买 = 扣钱不涨级**（`uu1.E(Z)` 是空实现） | A29 改走原版路径：`ln0.i(cost)` 扣费 + `I()/J()` 涨级；成功判据变为真实状态变化 | FACTS C.98 / C.99；Web 侧用 `purchase()` 无此问题 |
| **320px 下通知层盖住「大坍缩」按钮，点击命中率 44%** | `.l-notification-container { pointer-events: none }` + 子项 `auto` | Web 实测 44% → **97%**（`reports/_r51/run_320_fix.log`） |

### 15.3 仍然存在的最大功能缺口（按对通关的影响排序）

| # | 缺口 | 影响 | 位置 |
|---|---|---|---|
| 1 | Android 无现实（Reality）自动循环 | 永远停在永恒层 | Web 有 `oreki-reality-automation.js`（643 行），Android 无对应类 |
| 2 | Android 无符文（Glyph）自动装备 | 拿不到 RU9/16/17/18/24 的符文形态要求 | Web `oreki-reality-automation.js` 的 `equipGlyphs()`（只装空槽） |
| 3 | Android 无天神 / 莱特拉驱动 | 到不了 IU25 与 DS6 | Web `oreki-celestial-automation.js`（823 行）、`oreki-endgame-automation.js`（918 行） |
| 4 | Android 无佩勒（毁灭现实）驱动 | `records.totalAntimatter` 涨不起来 ⇒ 终局不可达 | Web `driveDoomed()`；Android 原版通路完整但**没人调用** |
| 5 | 调度器未接线 | 设置页的开关与间隔**实际不生效** | 见 §15.1 第 2 行 |

> 注意：第 3、4 项**不是「原版没有这些代码」**——原版 APK 里 `celestials/` 七个天神与 `pelle/` 全在，
> 缺的是**驱动层**（谁来按节奏调用它们）。见 §12 第 2 条。


---

## 附：R57-B 状态更正（2026年11月2日，【实测】）

本节只纠正旧行里已失效的状态标记，**不复制 R51 旧结论**。

| 项 | 旧标记 | 现标记 | 依据 |
|---|---|---|---|
| 首次现实入口（第 73 行「Android 无自动现实」） | 缺失 | **已实现**：`oreki/OrekiReality.smali`，走原版 `prestige/f;->f()Z`（canReality）+ `prestige/f;->b(Cont)`（原版现实自动器同一条路径） | 读码；尚未在 AVD 上跑到 Reality |
| 首次永恒后无限层自动化 | 未知 | **已修并已实测**：删除 `onAutoBuyerTick` 里 `eternitiesZero()` 的硬门。受控夹具（`eternities=1e1`）实测 `ipMultUpgrades` 6→13、`IP` 9.3e6→1.14e13 | FACTS C.104 |
| ID1 解锁门槛 | 「疑似把成本当门槛」 | **论断作废**：maxAM 到 5.55e3118 后 `ID解锁=[0,1,2]`、`ID买次=[2,1,1]`，说明 `k()` 分支正常，无需修改 | FACTS C.104 |
| 调度默认间隔 | Android 3 秒 / Web 3 秒 | **两端均 1 秒**（Android R57-A 改，Web R57-B 改），Android 已见 `OREKI_SCHED: init … 间隔 1 秒` | 实测 + 读码 |
| Reality 升级 / 符文 / Dilation / Celestial / Laitela / Pelle 驱动 | 缺失 | **仍然缺失**（未变）。本批未动这些层 | 读码：Android 侧无对应类 |

## 附：R58 更正（2026年11月2日，【读码】）

**推翻两条旧结论**（此前把它们标成「Android 缺失」是错的）：

| 能力 | 旧标记 | 更正 | 依据 |
|---|---|---|---|
| Reality 升级自动购买 | Android 缺失 | **原版已有**：`Game.autoBuyerTick`（`a.smali:7697` 起）在 **9401 行无条件调用** `reality/upgrades/b;->a(Cont)` | 读码 |
| Dilation 自动推进 | Android 缺失 | **原版已有**：同方法 **9360 附近无条件调用** `eternity/dilation/b;->a(Cont)` | 读码 |

**真正仍缺的**（未变）：

| 能力 | Android | Web |
|---|---|---|
| 符文自动装备 | **未实现**（原版无自动装备） | 已实现 `equipGlyphs()` |
| Celestial 驱动 | **未实现** | 已实现 823 行 |
| Laitela / Pelle 驱动 | **未实现** | 已实现 918 行 |
| 现实节奏收敛 | 仅 2 秒最小间隔（R58 由 1 秒改到 2 秒） | 完整：膨胀窗口 + 阶段节拍 + 天神压制 |

**部署状态**：Pages 已从 R50 的旧产物（与源码差 47 个文件、`.json` 数据文件整体缺失）
同步到与源码逐文件一致（`cebc601`）。

## 附：R59 更正（2026年11月2日）

| 能力 | Android 状态 | Web 状态 | 证据等级 |
|---|---|---|---|
| 符文自动装备（只填空槽） | **代码已修正但运行期未生效**（`oreki/OrekiGlyphAuto.smali`）：R59/R60 五处极性全反、R62 修到第六处，另有**第七处根因**——`GlyphType` 被 R8 改写为 `.super Ljava/lang/Object;`（不是 `java.lang.Enum` 子类），调 `Enum->name()` 让 ART 拒收整个类（实测 1461 条 VerifyError），已改 `Object.toString()` | 已实现 `equipGlyphs()` | Android：读码 + 静态 + 装机（VerifyError 0）；**装备正例仍未取得**——用 869 份存档里的 `637` 造出 3/5 空槽夹具（加载成功），但 `OREKI_GLYPH` 仍 0 条，具体卡点未定 |
| 符文满槽不替换 | 已实现（找不到 null 槽直接返回） | 已实现（`freeSlot < 0 → continue`） | 读码 |
| 现实后立即补装 | 天然满足（每 tick 检查） | **本轮新增**当帧补装 | Web 读码 |
| RU9/16/17/18/24 形态推进 | **未实现** | 已实现 `satisfyGlyphRequirements()` | — |
| Celestial / Laitela / Pelle 驱动 | **未实现** | 已实现 | — |

Android 侧关键接口（逐指令确证，详见 FACTS C.106）：
`Glyphs->e:[Glyph;`（槽）、`Glyphs->L(Glyph;I)V`（装备，**无 Reality 回调**）、
`Player.Q().d().e()`（背包）、`Glyph->l()`=槽位号 / `m()`=等级 / `e()`=强度。

## 附：R62 状态（2026年11月2日）

| 能力 | Android | 证据等级 |
|---|---|---|
| 符文自动装备 | 代码六处极性 + 一处 VerifyError 根因已修；装机无崩溃；**装备正例未取得** | 装机实测 |
| 特蕾莎浇注 | `OrekiTeresaAuto` 已实现（复用原版 `MainActivity.yo` + 主循环 `a->r()`）；**pouredAmount 未增长** | 装机实测 |
| 现实压制 | `isHolding()` 已接入 `OrekiReality`；实测 `realities` 仍在涨，**未生效** | 装机实测 |
| 869 份存档 | 全部可解码（`scripts/savecodec.py`），470 份含 Reality+符文，最高 Cel7 | 实测 |

**本轮修正的一条错误推断**：曾认为「现实每 2 秒清空 `reality.upgradeBits`」导致
Teresa 不浇；实测 `upgradeBits` 在现实后**仍为 0xFFFFF**（RU 是一次性永久解锁，现实不清），
该因果链不成立，真实卡点待查。

---

## 附：R65 状态（2026年11月2日，全部以运行期证据为准）

### 15.4 本轮七项差异的当前状态

| # | 能力 | Android | Web | 证据 |
|---|---|---|---|---|
| 1 | Break Infinity 升级自动购买 | **已实现并实测**：R87 已从 `oreki/OrekiBreakShop.smali` 整体迁移为 `oreki/OrekiBreakShop.kt`，保留 `tick()I`，仍走原版 `D(Z,Continuation)Boolean`（与 Break 页按钮同一条路径）。存档 `breakInfinityUpgradeBits` 0 → **511**，`breakInfinityRebuyables` = `[8,6,10]`。R87 增加 ID1 资金预留：首次永恒前、ID1 未解锁、IP 已达原版门槛时，买后不得跌破门槛 | **已重写并实测**：`src/core/oreki-autobuy-break-infinity.js`，同样「最便宜且 2×价格 ≤ IP」规则，一次一拍买一条；R87 复用 `OrekiEarlyAutomation.shouldReserveIpForId1()` / `leavesId1Reserve(cost)`，同一 ID1 预留语义 | Android：R87 Kotlin→D8 DEX 已含 `OrekiBreakShop`，运行期/APK 验收待 3.21 门禁；Web：R87 `test-r87-break-id1-reserve.mjs` 13/13，旧 R65 A/B/C/C2 四段保留 |
| 2 | 坍缩策略 | 实测沿用 R64 两段式：`auto.bigCrunch.mode=1`（TIME）、`time=1`；买过 Break 升级后走 X_HIGHEST/10 分支未在本轮重测 | 同 R64（`shouldHoldCrunch` + `OrekiSmartStrategy`） | 存档字段直读 |
| 3 | ID1 解锁与购买 | **已解锁并购买**：logcat `OREKI_ID: 1/2/3`，说明原版 `M()`（解锁）+`h(true)`（买最大）链路可用 | `tryFirstId1AutoUnlock()` → `InfinityDimensions.buyMax()`（同「Max All」按钮） | Android logcat；Web 读码 |
| 3b | ID1 的 IP 门槛 | **4e8**（原版 Android 值） | **1e8**（原版 Web 值） | 两端各自原版公式；教程第 6 章已注明差异，不做机械统一 |
| 4 | 智能策略识别 | 未改：仍由 `OrekiStageAuto` 分流，**未接 `oreki-smart-strategy.json`** | 已接：JSON 为唯一策略源，`OrekiSmartStrategy.evaluate()` 只读解释 | 读码 |
| 5 | 自动化调度 | **本轮才真正生效**：`noteActed`/`noteNoop` 的 `if-gez` 极性错误修好前，记账恒空转（无 `act` 日志、间隔恒放行）。修复后 logcat 出现 `OREKI_SCHED: act breakShop @…`，`dbg` 行显示 `idx=11 iv=1` | `runCycle()` 单时钟 + `didAct()` 判定 | logcat 原文见 FACTS C.112 |
| 6 | 动作间隔 | 间隔读取正确（`iv=1`）、节拍记账正确；**但启动瞬间 8 条升级仍被连买（12~39 ms）**，稳态无候选可买，无法再取间隔正例 → **记为未解释缺陷** | 间隔闸门 R50 起生效，本轮 A/B 两段实测按节拍放行 | 见「未完成」 |
| 7 | 挑战启动即完成 | 未改动（沿用 R4 的 `OrekiChallengeAuto` / `OrekiInstantChallenge` 注入点） | 未改动（`tryInstantCompleteChallenges()` 仍在 `EternityChallenge(12).tryFail()` 之前） | **本轮未做运行期取证** |
| 8 | 教程覆盖 | 由 `oreki_tutorial_gen.py` 从同一 JSON 生成，构建期回读校验通过 | 同源直读 | 构建日志 `oreki_tutorial.txt: 170291 字节` |

### 15.5 本轮**消除**的一条旧差异

§15.3 第 5 行「调度器未接线 ⇒ 设置页的开关与间隔实际不生效」**部分作废**：

- 接线本身早在 R51 就完成了（`OrekiStageAuto.onAutoBuyerTick` 里有 `beginFrame`/`allow`/`noteActed`）；
- 真正的问题是 `noteActed` / `noteNoop` 的**首个判定极性反了**（`if-gez` 应为 `if-ltz`），
  于是记账恒空转、`OREKI_SCHED act` 一条都不出现，看起来就像「没接线」。
- 现已修好并有 act 日志为证。

### 15.6 本轮新增的**未解释**差异（诚实记录）

| 现象 | 观测 | 已排除 | 结论 |
|---|---|---|---|
| 启动瞬间连买 8 条 Break 升级，间隔 12~39 ms | logcat `act breakShop` 的 `taskGap=12/13/15/16/37/39` | 已排除：`idx` 错误（dbg 显示 11）、`iv` 读 0（dbg 显示 1）、`noteActed` 空转（act 行本身存在）、间隔闸门极性（已改 `if-lt` 并重建，行为未变） | **未定位**。按 R65 收敛令，不再为单条日志新增构建；下一轮改用「静态断言 + 单方法级夹具」定位，不再整包构建 |

---

## 附：R66 状态（2026年11月3日）

### 16.1 R65 遗留「间隔不生效」是否已解决

**已解决（运行期正例）**。同一受控夹具（`breakInfinityUpgradeBits` 511→256）下：

| 版本 | 8 条 Break 升级耗时 | `taskGap` |
|---|---|---|
| R65 | **82 ms** | 4~27 ms |
| R66 | **7.07 s** | 999~1019 ms |

修复方式：**不再继续调 `allow()` 的分支极性**，改为在 `OrekiBreakShop` 内部用
`sLastBuyAt` + `Scheduler.intervalMs()` 自守闸门（三次比较，语义无歧义），
调度器那道闸门保留作双保险。同时新增 `sReserve` 原子预约，防同一调用栈内的重入。

### 16.2 策略源共享

| 项 | Android | Web |
|---|---|---|
| 唯一策略源 | `oreki-smart-strategy.json`（构建期编译成 `OrekiStrategyData.smali`） | 同一份 JSON（`oreki-smart-strategy.js` 解释） |
| 阶段数 | 19（全部编译进数据表） | 19 |
| 取值叶子 | 19 个，已接线 7 个（break / dimensionBoosts / infinities / realities / infinityUnlocked / doomed），其余标 `unknownLeaf` 计数 | 全部 |
| 输出 | 日志 `OREKI_GOAL stage=<i> <id> goal=<goal> unknownLeaf=<n>`；`sStage` 供后续 UI 读取 | 面板 + `evaluate()` |
| 是否驱动动作 | **否**（只判断，动作仍走各阶段模块的原版入口） | 由 `OrekiSmartExecutor` 执行 |

### 16.3 尚未对齐/未完成

| 项 | 状态 |
|---|---|
| Android 策略面板 UI | 未做（目前只有日志与 `sStage` 静态字段） |
| 12 个未接线叶子 | 未接（`celestial.*Unlocked`、`challenge.*Running`、`timeStudy.studiesBought`、`game.endState` 等），都需逐个在 REA 里核对 getter |
| 首次 Eternity | 仍未触发（`eternities` 实测为 0）；R65 已修 EP 门槛极性，当前卡点待查 |
| 挑战「启动即完成」 | 本轮未做新的运行期取证 |
| Reality / Glyph / Celestial / Laitela / Pelle | 本轮未推进（沿用 R62 状态） |
| 全新存档 3 小时通关 | 未验证（本轮数据全部来自续跑档 + 受控夹具） |

---

## 附：R67 状态（2026年11月3日）

### 17.1 R66「策略层恒定 stage=-1」已定位并修复

根因是 **6 处叠加**，首因是 `StrategyData.fill()` 的守卫写反：

| # | 位置 | 错误 | 现在的语义 |
|---|---|---|---|
| 1 | `fill()` 守卫 | `if-eqz v0, :ret`（null 就返回） | 独立的 `sFilled` 标记 + `if-nez`；全部数组填完才置位 |
| 2 | `leaf()` 边界 | `if-lt p0, len, :l_zero`（合法下标返回 0） | `if-ltz p0 → NaN`（负数）、`if-ge p0, len → NaN`（越界） |
| 3 | `evalStage()` 取反 | `if-ne v13, v3`（neg≠0 跳过取反） | `if-eqz v13, :es_check`（neg==0 才跳过） |
| 4 | `nameOf()` | 多余 `if-ltz p0, :n_out` | 只检查上界 |
| 5 | 未接线叶子 | 返回 `0.0`（= 假，`not()` 会翻成真） | 返回 **NaN** → 合取项 fail-closed + `degraded=1` |
| 6 | 算子表 | 缺 eq / gt | 六算子齐全，未知算子构建期 `SystemExit` |

日志格式：`stage=<i> <id> goal=<goal> unknownLeaf=<n> degraded=<0|1>`。

### 17.2 首次永恒：`holdCrunch()` 极性反了

`tryEternity()` 里 `if-eqz v0, :et_end` = **false 才结束** ⇒ 需要保护时反而按永恒、窗口关闭后不按。
改为 `if-nez`。判定链现为：`holdCrunch（true 跳过）→ canEternity（false 跳过）→ gainedEP ≥ EP×10（不足跳过）`。

### 17.3 策略驱动（Android 新增，Web 已有等价能力）

| 项 | Android（R67 新增） | Web（既有） |
|---|---|---|
| 依据 | 当前阶段的 `strategy` 名（同一份 JSON） | `decision.strategy.priority` |
| 门控对象 | `reality` / `glyph` / `teresa` 三个后期模块 | 全体动作按 priority 排序 |
| 规则 | **黑名单**：仅 `growth` / `fastUnlock` 时禁用 | 优先级自然靠后 |
| 失败策略 | `sStage < 0` → 全部放行（fail-open） | `decision.ok !== true` → 全帧不动（fail-closed） |
| 面板/日志 | `OREKI_GOAL ... degraded=` | `degraded` / 新增 `degradedCount` / `degradedStops` |

**为什么 Android 用黑名单而 Web 用排序**：Web 的叶子全部可用，priority 能精确表达；
Android 尚有 12 个叶子未接线，后期阶段会被 fail-closed 判为不成立、停在较早阶段，
白名单会把后期模块永久禁掉。黑名单只覆盖「还没第一次无限」两个绝对不可能的阶段。

### 17.4 本轮未完成（双端一致）

| 项 | 状态 |
|---|---|
| 全新存档 3 小时通关 | **未验证**。本轮运行期证据来自续跑档 + 受控夹具 |
| 首次永恒运行期确认 | 待本次构建装机后观察 `eternities` 是否从 0 增长 |
| 12 个未接线叶子 | 未接（`celestial.*Unlocked`、`challenge.*Running`、`progress.{eternity,reality,dilation}Unlocked`、`timeStudy.studiesBought`、`reality.{perks,upgrades}Bought`、`game.endState`、`automator.unlocked`） |
| 挑战「启动即完成」 | 本轮无新运行期取证（沿用 R62/R64） |
| Reality / Glyph / Celestial / Laitela / Pelle | 未推进 |

---

## 附：R70 状态（2026年11月3日）

### 18.1 首次永恒：Android 改为「进原版协程链」

| 项 | R69 及以前 | R70 |
|---|---|---|
| 启动方式 | `prestige/c.d(...)` + 自造 `OrekiEcContinuation` | `new Eternity$confirmEternity$4(1,null)` + `g.p(lambda, true)` |
| 为什么失败 | 自造 Continuation 不是 `Eternity$eternity$1`，挂起点返回 `COROUTINE_SUSPENDED` 且无人恢复 | 由 `MainActivity.Co` 作用域驱动，挂起点自动恢复 |
| 防重入 | 无 | `sEtPending` + `log10(eternities)` 变化或 600 帧超时释放 |
| 现实升级 10 保护 | 无 | `holdForRu10()`：10 秒上限 + 一次性闩锁 |
| Web | 已有 `eternity(false, true)` | 逻辑未改，新增 25 项回归测试 |

### 18.2 关于 `if-ltz` 的一次误判（双端共用的教训）

`if-ltz` 是「小于零时跳转」，不是「大于等于零」。R70 中途据此误改过一次 EP 收益闸门，
被 Android 夹具与 Web 回归同时拦下。两端断言现已锁死该行必须为 `if-ltz`。

### 18.3 两端的顺序差异（有意保留）

| 顺序 | Android | Web |
|---|---|---|
| 1 | `holdCrunch()`（反物质成长窗口） | `active`（总开关 / 挑战 / Pelle） |
| 2 | `prestige/c.f()`（永恒资格） | IU15 冲刺保护 |
| 3 | `holdForRu10()` | `Player.canEternity` |
| 4 | 收益 ≥ EP×10 | `holdForRealityUpgrade10()` |
| 5 | 启动原版协程 | `ecEntryPending()` |
| 6 | — | 收益 ≥ EP×10 → `eternity(false, true)` |

Android 没有 `ecEntryPending` / IU15 冲刺这两项：前者是 EC 入口等待（Android 由
`OrekiInstantChallenge` + `OrekiChallengeAuto` 另行判定），后者是网页版独有的
`OrekiIu15Sprint` 模块。**玩家可见结果一致**：资格不足、收益不足、需要保护时都不按。

## 19. R107-01 实测差异增量（2026-11-14，Web 侧真实浏览器 + Android 既有运行证据）

> 来源：web 仓库 reports/R107-01/README.md §4（Android 侧本轮未实跑，引用既有真实运行证据并逐条标注）。

| # | 能力 | Web（本轮实测） | Android（既有运行证据） | 判定 |
| --- | --- | --- | --- | --- |
| 1 | 新闻/顶栏 | 新闻 DOM 0、无入口 | 无新闻模块；MOD 用「顶栏显示当前页面」替换滚动新闻条 | 设计差异（预期） |
| 2 | 阶段解锁显示 | 首坍缩后无限入口 24ms 出现；永恒/现实按阶段隐藏 | bm4.g()/h() + ll2.g() + MainActivity.W8() 汇聚门禁；非法存档恢复拦回 | 实现差异（语义一致） |
| 3 | 自动购买器总开关 | 关闭立即停止；原版 autobuyersOn 不变 | R101 P1 修复后真实点击关闭 2s/35s/重启后 player.json autobuyersOn=false | 实现差异（语义一致） |
| 4 | 1~60s 间隔 | 1s/60s 实测生效、钳制、刷新保持 | 调度器 1~60s + **阶段化节拍 OrekiBeatStrategy（早期1s/无限2s/无限维度3s/永恒5s/终局10s）** | **功能缺口：Web 缺阶段化节拍** |
| 5 | 手动优先 | 真实点击 → 60s 目标级让路、actionCount 冻结 | OrekiPlayerIntent 对玩家配置改动让路 | 实现差异（两端都不覆盖玩家意图） |
| 6 | 180min 进度 | 首次现实 33.7min；realities=15 后 EP 冻结 3683.25；未通关 | R104/R105 记录 180min 内不可达终局 | **功能缺口：两端均未达 180min 门禁** |

结论：四项体验验收 Web 全 PASS；无「必须立即改 Web」的等价阻断。阶段化节拍属进度策略调整，需受控实验 + 教程同步，不擅自改默认值。

## 19. R107-01 实测差异增量（2026-11-14，Web 侧真实浏览器 + Android 既有运行证据）

> 来源：web 仓库 reports/R107-01/README.md §4（Android 侧本轮未实跑，引用既有真实运行证据并逐条标注）。

| # | 能力 | Web（本轮实测） | Android（既有运行证据） | 判定 |
| --- | --- | --- | --- | --- |
| 1 | 新闻/顶栏 | 新闻 DOM 0、无入口 | 无新闻模块；MOD 用「顶栏显示当前页面」替换滚动新闻条 | 设计差异（预期） |
| 2 | 阶段解锁显示 | 首坍缩后无限入口 24ms 出现；永恒/现实按阶段隐藏 | bm4.g()/h() + ll2.g() + MainActivity.W8() 汇聚门禁；非法存档恢复拦回 | 实现差异（语义一致） |
| 3 | 自动购买器总开关 | 关闭立即停止；原版 autobuyersOn 不变 | R101 P1 修复后真实点击关闭 2s/35s/重启后 player.json autobuyersOn=false | 实现差异（语义一致） |
| 4 | 1~60s 间隔 | 1s/60s 实测生效、钳制、刷新保持 | 调度器 1~60s + **阶段化节拍 OrekiBeatStrategy（早期1s/无限2s/无限维度3s/永恒5s/终局10s）** | **功能缺口：Web 缺阶段化节拍** |
| 5 | 手动优先 | 真实点击 → 60s 目标级让路、actionCount 冻结 | OrekiPlayerIntent 对玩家配置改动让路 | 实现差异（两端都不覆盖玩家意图） |
| 6 | 180min 进度 | 首次现实 33.7min；realities=15 后 EP 冻结 3683.25；未通关 | R104/R105 记录 180min 内不可达终局 | **功能缺口：两端均未达 180min 门禁** |

结论：四项体验验收 Web 全 PASS；无「必须立即改 Web」的等价阻断。阶段化节拍属进度策略调整，需受控实验 + 教程同步，不擅自改默认值。
