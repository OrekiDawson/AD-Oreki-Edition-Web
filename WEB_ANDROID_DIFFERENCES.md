# Web 与 Android 实现差异表（WEB_ANDROID_DIFFERENCES.md）

> **本文件是硬链接共享文件。** 三个路径指向同一个 inode：
> - 项目总根：`AD-Oreki-Unified/WEB_ANDROID_DIFFERENCES.md`
> - Web 仓库：`web/AD-Oreki-Edition/WEB_ANDROID_DIFFERENCES.md`
> - Android 仓库：`android/AD_Oreki_Edition_Android/WEB_ANDROID_DIFFERENCES.md`
>
> 只通过**一个**路径编辑；Git 不保存硬链接关系，两个仓库各自正常追踪内容副本。
> `git checkout / reset / pull / merge` 之后必须重新核对 `stat -c '%d %i'`，
> 关系断了就按 §6 的安全流程重建。

**最后更新**：2026-10-30（R40）
**维护规则**：见项目根 `AGENTS.md` §21；每轮开工先读、收工必更新。

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
| 终局判据 | `game-end.js`：`OFFSET = 1`、`TARGET = 1000`，`endState >= 1 ⟺ 反物质指数 ≥ 1000` | `patch_pelle_end_target()` 把两条 `const-wide` 立即数改成 `1.0` / `1000.0`，置位点与 `gameLoop` 不动 | 数值 | 预期 | 判据字面一致（1e1000） | 待验证（常量已对齐，未跑到佩勒） | Web `src/core/celestials/pelle/game-end.js`；FACTS §C.15 / §C.17 | R41：Android 侧跑到佩勒再验 |
| IU25 成本 | `OREKI_IU25_COST = 5e9`（原版 1.6e15） | 未确认是否同步 | 数值 | 需修复（若未同步） | 同一常量 | 未验证 | Web `secret-formula/reality/imaginary-upgrades.js` | R41 用 REA 查 Android 侧 IU25 成本常量 |
| EC 入口资源门槛缩放 | `OREKI_EC_REQUIREMENT_DIVISOR = 100`（Reality 解锁前生效，`isOrekiBootstrapRun()` 判定） | 未确认是否有对应缩放 | 数值 | 需修复（若未同步，Android 会有不可达的 EC） | 同一缩放与同一生效窗口 | 未验证 | Web `src/core/time-studies/ec-time-study.js` | R41：REA 查 `requirementTotal` 对应方法 |
| V 解锁阈值 | `realities 200 / dilatedTime 1e30 / replicanti 1e20000` | `patch_v_unlock_thresholds()` 同步三项（常量 + 进度分母两处） | 数值 | 预期 | 三项同时一致 | 待验证 | Android 构建日志 `[R34 Agent C]`；Web `secret-formula/celestials/v.js` | R41 |

## 2. 维度 / 升级 / 自动化

| 功能模块 | Web 实现 | Android 实现 | 差异类型 | 是否预期 | 一致性要求 | 验证状态 | 证据 | 负责人/后续 |
|---|---|---|---|---|---|---|---|---|
| 维度自动购买 | 原版自动器 + `oreki-early-automation.js` 开局例行 | 原版自动器；`[Oreki AU2~AU7]` 把解锁条件放宽到「首次无限后」，并在 `Game.autoBuyerTick` 挂 `OrekiStageAuto.onAutoBuyerTick()` | 逻辑 | 预期（Android 侧原版解锁更晚） | 首次无限后即可自动买维度/速度/提升/星系/坍缩/IP 倍率 | 待验证 | Android 构建日志 `[Oreki AU2..AU8]` | R41 |
| 维度批量购买退化 | 原版 `buyMax` 语义 | `[Oreki AB2]` 不可负担时退化为买 1 个（`OREKI_NO_AB2=1` 可关，仅用于 A/B 对照） | 逻辑 | 预期 | 开局不因买不起而完全停摆 | 待验证 | Android `patch_autobuyer_batch_fallback()` | R41 |
| 时间维度 / 时间定理 / 时间研究自动化 | `oreki-eternity-automation.js`：`buyTimeDimensions` / `buyTimeTheorems` / `buyTimeStudies` / `buyDilationStudies`，每 30 帧一轮 | 未找到等价模块（原版只有手动 UI） | 缺失 | 需修复（这是 Android 无法推进到 Reality 的结构性原因） | Android 也应有同语义的时间研究自动购买 | 未验证 | Web `src/core/oreki-eternity-automation.js`；Android 侧无对应 payload 类（R40B 报告未列出） | R41：这是 Android 端**最高优先**缺口 |
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
| 首次现实入口 | `processManualReality(false)`（与玩家点按钮同一函数） | 原版 UI 按钮；自动化未确认 | 逻辑 | 缺失（Android 无自动现实） | 同语义 | 未验证 | Web `oreki-reality-automation.js` | R41 |
| 符文自动装备 | R40A 改为**只装空槽**：绝不替换已占用槽 | **无符文自动装备自动化** | 逻辑 | 需修复（Web 已修 bug，Android 无对应功能） | 不触发静默重置；能拿到 RU9/16/17/18/24 | 待验证（Web 修完未跑完整验收） | 见下方 §4.1 专项 | R41 |
| 幻象机器（IM）类型坑 | `Currency.imaginaryMachines.value` 是 **Number**，调用 `.gte()/.lte()` 会 TypeError 且被 catch 吞成 `false` | 未确认（smali 侧无此 API 形态） | 逻辑 | 预期（平台 API 不同） | 判定结果一致 | 已验证（Web R39 修 `iu25ConditionsReady`） | FACTS §C.19 | — |
| 莱特拉 tier 升级 | `OrekiEndgameAutomation.driveLaitela()`：`tier>=8` 前用有界 `holdReality` 抢 30 s 窗口；R40 新增「EC 链全通即提前压现实（90 s 上限）」护住 DS6 | 未找到等价自动化 | 缺失 | 需修复 | 能真实升到 tier 8 并买 IU25 | 待验证 | 见 FACTS §C.21~C.23 | R41 |
| 佩勒（毁灭现实）驱动 | `driveDoomed()`：`maxAll` + 维度提升 + 星系 + 佩勒升级；**每 100 ms 关掉大坍缩/永恒自动器**，让 `records.totalAntimatter` 单调增长 | 未找到等价自动化 | 缺失 | 需修复 | 反物质峰值能涨到 1e1000 | 未验证（Web 亦未跑到） | Web `src/core/oreki-endgame-automation.js` | R41：这是两端**共同的**最大未知 |
| 终局触发后 | `GameEnd.gameLoop` 置 `player.isGameEnd` | 常量已镜像，置位点未改 | 数值 | 预期 | `endState>=1` 判据一致 | 待验证 | FACTS §C.17 | R41 |

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
2. **Android 没有时间研究/现实/莱特拉/佩勒的自动购买自动化**。这四块是目前 Android 无法到达终局的结构性原因，
   不是「数值差一点」。任何「双端一致」的结论在补齐这四块之前都不成立。
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
