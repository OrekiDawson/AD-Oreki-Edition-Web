# R42 · Web 智能路线择优：现状判定 + 路线层落地 + 同口径实测

日期 2026-10-31 · agent `r42-web-route`（Web 侧）
代码提交：`AD-Oreki-Edition@b7447b5`（分支 `main`，父提交 `dd155f3`）
工具与脚本：`_tools@<待提交>`，本报告与 `r42-route-selftest.mjs` / `r42-route-peek.mjs` 同批入库
原始数据：`_r40/r42-base-head.jsonl`（961 条）、`_r40/r42-after-a.jsonl`（984 条）、
`_r40/r42-after-b.jsonl`（979 条，**作废**，见 §5）、`_r40/r42-route-peek-{a,b}.jsonl`

---

## 0. 一句话结论

**现状是查表，不是择优** —— 已补上缺失的路线择优解释器（`route-model.json` 从 R40 起就是纯数据、无人读），
**但它在这条 742.1 s 路径上不会重排任何一步**：8 个阶段的 `strategy.priority` 与原序逐字相同，`routeSwitches = 0`。
原因不是「没实现」，是**数据说话**：执行层整局只买到 3 次东西，重排 15 个动词的上限收益就是这 3 次的时移。

同口径前后：**HEAD 771.2 s → 改动后 756.0 s**（两轮都无模拟器负载）。
这个 −15.2 s **不算改进**，行为等价，属于跑分抖动（C.47 六次跨度 708~915.8 s）。

---

## 1. 现状判定：查表，证据到行

行号基于改动前的 HEAD `dd155f3`。

| 位置 | 事实 |
|---|---|
| `oreki-smart-strategy.js:221-248` | `detectStage()` 遍历 9 个阶段，取 `precedence` **最大者**；相等 fail closed。**只做筛选，不做比较。** |
| `:295-297` | `findById(spec.goals, stage.goal)` → `findById(spec.strategies, stage.strategy)`，单条取，无备选集合。 |
| `:336` | `priority: Array.isArray(strategy.priority) ? strategy.priority.slice() : []` —— 数组**原样**进入决策对象。 |
| `:299-307` | `done` 只是把 `goal.done` 求值成 `true/false/null`，**不参与任何排序**。 |
| `oreki-smart-executor.js:283-292` | `pickExecutable()` 线性扫 `priority`，取第一个 `policy==="owned"` 且 source 就绪的。 |
| `oreki-smart-executor.js:344` | `const pick = pickExecutable(priority, now)` —— 顺序的全部作用就在这里。 |

**判定：不存在「多条可行路线的比较与择优」能力。** 顺序由 spec 作者写死；系统没有「还有别的走法」这个概念。

### 1.1 一个更关键的事实：模型写了，解释器从来没写

`src/core/oreki-route-model.json`（182 行）已经完整定义了多路线择优：

- `filter.rules` 6 条（`prereqMissing` / `challengeConflict` / `keyResourceBroke` / `pointlessReset` / `softLockRisk` / `missingFeature`）
- `evaluation.dimensions` 8 个加权维度 + `tieBreak`「差距 < 15% 时选复杂度更低、风险更低的」
- `routes` 9 条，每条带 `stageScope` / `steps` / `why` / `risk`
- `stability.minImprovementRatio = 0.15`、`cooldownSeconds = 300`、`switchOnlyWhen` / `neverSwitchFor`
- `interface.methods` 8 个查询方法（`getCurrentRouteId` … `getBlockers`）

但 R42 之前 `rg -n "route-model" src/ scripts/` **只有一条命中**：`scripts/gen_spec_module.mjs:31` 的生成登记表。
它被机械生成成 `oreki-route-model.gen.js` 之后，**没有任何模块 import 它**。
（C.53 里那 6 个线上 404 就包含这两个文件 —— 连 import 都没有，部署漏了也没人发现。）

⇒ 所以本轮**不是重复造轮子，也不是新造规则**：是把已经写好的模型接上解释器。

---

## 2. 改了什么

只动 `src/core/oreki-smart-strategy.js` / `.json` / `.gen.js`（提交 `b7447b5`）。
`oreki-smart-executor.js`、`oreki-break-infinity-gate.js`、`oreki-endgame-automation.js`、
`game-end.js`、`intervals.js`、任何 Android 文件 —— **一行没动**。

### 2.1 新增「路线择优层」（`oreki-smart-strategy.js:274-724`）

每条候选路线算**六个量**（`scoreRoute()`，`:558`）：

| # | 量 | 怎么算 | 读不到时 |
|---|---|---|---|
| ① | `prereqOk` | 绑定在当前 `strategy.priority` 下能否产出有效动词（`orderForBinding()`，`:535`） | `false` ⇒ `filter.missingFeature` 淘汰 |
| ② | `resourceCost` | 排在推进动作之前、需要花钱的动词，各自「重赚回这笔」的真实秒数之和（`verbPenalty()`，`:494`） | 记 0 并计 `resourceCostUnknownVerbs`，**不虚构** |
| ③ | `unlocks` | 绑定里 `advances` 字段（数据） | `[]` |
| ④ | `etaRealSec` | 目标距离 ÷ 实测 log 速率，再加 ②（`estimateGoalEta()`，`:454`） | `null` |
| ⑤ | `risk` | `none` / `medium`（首步是重置类）/ `high`（无绑定），全由结构推出 | — |
| ⑥ | `ops` | 绑定涉及的动词数 | — |

**排序**（`compareScores()`，`:625`）：主键 `etaRealSec`；差距 < 5% 时依次比 `risk` → `ops` → `reorderDistance`（与原序差异位数）。

**滞回**（`selectRoute()`，`:652`）：常量**取自 `route-model.stability`**，不写死 ——
`ROUTE_SWITCH_MARGIN = 0.15`、`ROUTE_SWITCH_COOLDOWN_MS = 300000`。
新路线必须便宜 ≥15% **且**距上次切换 ≥300 s 才切；唯一例外是当前路线 `prereqOk` 变 false（失效）时立即换。

**ETA 的口径（唯一会出数字的地方，所以写死规矩）**：
只用两样真实数据 —— 游戏自身的阈值 getter（`Player.infinityGoal` / `Player.eternityGoal` / `TimeStudy.reality.cost`）
与最近 12 个 1 s 采样做最小二乘得到的 log10/真实秒斜率。缺任一项即为 `null`。
**没有用 `route-model.calibration.baseline` 那张分段表当秒数** —— 那是 R40 两条 run 的历史先验，
其中「等 V 456 s」那段已被 R41 的修复作废，拿它当绝对秒数必然输出错数。它只出现在 `route.prior` 字段里作参照。

### 2.2 新增 `spec.routeBindings`（6 条，`oreki-smart-strategy.json`）

`route-model.layering` 原文是「「怎么买」在 oreki-smart-strategy.json，两层严格分离」，
所以「每条路线对应哪个动词顺序」放在 strategy.json，而不是改 route-model.json（那不在我的可写范围）。

绑定的硬约束（`orderForBinding()` 里实现，自测覆盖）：**绑定里的动词必须已经出现在该策略的 `priority` 里**，
否则直接丢弃；而且**只在原位换位** —— 绑定涉及的动词按绑定顺序填回它们原本占的那几个槽位，
未参与绑定的动词一格不动。⇒ 本层**不可能引入一个新的购买权**。

### 2.3 三条红线的处理

| 红线 | 处理 |
|---|---|
| 手动优先权 | 路线层**不读不写** `manualHolds`；`decision.manualHold` 语义一字未改。自测 §9 覆盖。 |
| 购买权边界 | 只重排已有动词（§2.2）。执行层仍是「模块本帧无动作才补一手」。实测 `takeoverWhileModuleActed = 0`。 |
| 研究 30 帧节流 | 本层不调用任何购买方法；`buyTimeStudy` / `buyDilationStudy` 仍是 `delegated`。 |

### 2.4 8 个界面查询方法

`getCurrentRouteId / getCurrentRouteTitle / getAlternativeRoutes / getSelectionReason /
getEstimatedRemainingSeconds / getCurrentStep / getLastSwitchReason / getBlockers`
（`:955-1005`），全部只读、读不到返回 `null`。

⚠ **面板还没接这些方法**。`src/components/tabs/options-gameplay/OptionsGameplayTab.js` 不在我的可写范围，
它现在仍只渲染执行层的七项（`OrekiSmartExecutor.debugState()`，逐字段取、不遍历键），
所以新增的 `route` 字段不会破坏它，但也**不会显示出来**。
路线相关只读接口已经就位，接面板是下一步（对应 `route-model.ui.items` 的 9 条）。

### 2.5 两条路线被真正淘汰（这是本层唯一改变结论的地方）

| 路线 | 结果 | 原因 |
|---|---|---|
| `celestial-parallel-v` | 淘汰 / `risk=high` | 它需要「推进天神的同时压住现实攒薇的三项记录」，而 `celestial` 策略的三个动词全 `delegated`，没有任何动词能表达「压住现实」⇒ 无绑定 |
| `pelle-grow-only` | 淘汰 / `risk=high` | 「只囤产量不末日」没有任何可执行动词（`maxAll` 不在策略动词表里）；`route-model` 自己也写着「这条应被 filter.softLockRisk 直接淘汰」 |

其余 7 条里，`eternity-ec-first` / `eternity-tt-first` / `reality-glyph-first` / `reality-machine-first` /
`celestial-nav-order` / `pelle-shard-loop` 有绑定，`timeStudy` 阶段因为 `challengeClear` 的 priority
与这些绑定零交集而被整体判为「无可执行路线」（这是正确行为：挑战期间的购买顺序归挑战模块）。

---

## 3. 为什么它不能提速（带数据）

这是本报告最重要的一节，也是我**没有**把它包装成「优化成功」的原因。

`_r40/r42-base-head.jsonl`（HEAD，真实新档，1000 s / 961 条，无模拟器负载）：

| 指标 | 读数 |
|---|---|
| `exTryN` 执行层尝试次数 | **306** |
| `exActN` 真的买到 | **3** |
| 命中率 | **1.0%** |
| `takeoverWhileModuleActed`（抢帧计数） | **0** |
| 最后一次动作分布 | `runReality@reality:0` **828 条**、`buyRealityUpgrade@reality:0` 34、`eternity@eternity:0` 40、`equipBestGlyph@reality:0` 28、`buyTimeTheorem@eternity:0` 24 |

⇒ 在 771 s 的整局里，执行层**只买到 3 样东西**。
「重排 15 个 owned 动词」这件事的**上限收益 = 3 次购买的时移**，不可能改变通关秒数的量级。
这与 R40-S2 报告「本层额外购买量接近于 0」的自我评价一致，现在有了整局计数作为硬证据。

### 3.1 由此得到的结论（不是猜测）

1. **智能策略/执行层不是当前的瓶颈**，优化它无法把 742.1 s 往下压。
2. 它的真实价值在可观测性与兜底（阶段/目标/策略/阻塞/让路），不在提速。
3. 想在 Web 端继续压时间，必须动 §4 那两段，而不是这一层。

---

## 4. 真正的时间花在哪（给 R43 的数据，不在本轮可写范围）

基线 771.2 s 的分段（`r42-base-head.jsonl`，阶段由 `detectStage()` 的实际输出切段）：

| 区段 | 区间 | 耗时 | 占比 |
|---|---|---|---|
| 开局 → 第一次无限 | 0 → 4 s | 4 s | 0.5% |
| 无限阶段 | 4 → 6 s | 2 s | 0.3% |
| 永恒阶段 | 6 → 70 s | 63 s | 8.2% |
| **现实阶段** | **70 → 258 s** | **188 s** | **24.4%** |
| **celestials 阶段** | **258 → 724 s** | **466 s** | **60.4%** |
| 佩勒阶段 | 724 → 771.2 s | 47 s | 6.1% |

466 s 那一段的形态（`[实测]`）：**每一轮现实重置都把 EC 链清零重打一遍**。
`ecs` 在 t = 257 / 302 / 325 / 358 … 反复从 `0,0,0,0,0,0,0,0,0,0,0,0` 回到 `5,5,5,5,5,5,5,5,5,5,5,5`，
`realityStudy`（DS6）同步 `false → true`。约 20 个循环，每个 20 s 上下。

（这条只陈述现象，**没有**验证「EC 链是否必须重打」——那属于 eternity / celestial 自动化的语义，
`[未知]`。谁接手这一段，第一件事应该是回答「能不能让一个现实撑到三项 records 同时达标」。）

---

## 5. 验证：做了什么，没做什么

### 5.1 做了什么

| 项 | 结果 |
|---|---|
| 单测 `r42-route-selftest.mjs`（Node，桩替身，无浏览器） | **76 / 76 通过** |
| 浏览器存活探针 `r42-route-peek.mjs`（真实新档，2 s 一读，**不产出通关秒数**） | 路线层挂到活对象；`rPriority === rSpecPriority` 在 early / preInfinity / infinity / eternity / reality 五个阶段逐字相同；`routeSwitches = 0`；`switchMargin=0.15 / cooldown=300000 / tieBand=0.05` 确认取自 route-model |
| `gen_spec_module.mjs --check` | `[ok]`（JSON 与 `.gen.js` 同步） |
| `pageErrors` | 只剩 Google Tag Manager 的 CSP 噪声（`googletagmanager.com`），**没有** `version.txt` 那条（`dea0f47` 的修复生效） |
| `smDeg` / `smErr` | 整局 0 条降级 / 空串 |

### 5.2 同口径前后对比（`pelle-probe.mjs`，1000 ms / 约 60 字段，10000× 起步，1000 s 窗口）

| 轮次 | 代码 | 墙钟区间 | 宿主负载 | `doomed` | `isGameEnd` 首真 | 翻真后持续 |
|---|---|---|---|---|---|---|
| baseline | HEAD `dd155f3` | 9:23:13–9:39:51 | 无 | 724.0 s | **771.2 s** | 227.8 s / 225 条全 true |
| after-a | 路线层改动 | 9:40:39–9:57:18 | 无 | 710.0 s | **756.0 s** | 243.0 s / 242 条全 true |

里程碑对照：

| 轮次 | 5 现实 | 20 现实 | 100 现实 | `doomed` | `isGameEnd` | 终值 `endState` / `log10(totalAM)` |
|---|---|---|---|---|---|---|
| baseline | 70.0 s | 257.0 s | 701.0 s | 724.0 s | 771.2 s | 12.434588 / 1060 |
| after-a | 68.1 s | 222.1 s | 686.1 s | 710.0 s | 756.0 s | 13.174093 / 1060.027 |

**结论分级：`[实测]` 触发 `isGameEnd`，且 120 s 内持续为 true。变快 2.0% 属于抖动，不算改进。**

### 5.3 作废的一轮（必须写出来）

`r42-after-b`（10:06:55–10:23:34）1000 s 内**连 `doomed` 都没进**，表面像 30% 回归。
真实原因是宿主上跑了两个 Android AVD：

| PID | `StartTime` | 检查时累计 CPU |
|---|---|---|
| `qemu-system-x86_64-headless` 44224 | **9:58:49** | 8998 s |
| `qemu-system-x86_64-headless` 36832 | **10:04:32** | 707 s |

baseline 与 after-a 都在 9:58:49 **之前**结束；after-b 全程压在两个模拟器上。
机内轨迹也吻合：after-b 前 95 s 与基线一致（`5 realities @69.1 s`），~200 s 起才分叉（`20 realities @313.1 s`）。
**「开局正常、中段崩」是抢 CPU 的形状，不是代码回归的形状。**

⇒ 规则写进 FACTS C.72：跑通关秒数前先记 `qemu` 的 `StartTime`，与 jsonl 的时间窗比对；有交集即作废。

### 5.4 没做到的（如实标注）

- **没有最终版代码在干净宿主上的通关秒数**。after-a 跑的是前一版，两版差异只有一处：
  前一版把 `runReality` 提到 `buyRealityMachine` 前面（`buyRealityMachine` 是 `unsupported`，执行层本来就不动手 ⇒ 行为等价），
  最终版改成「只在原位换位」，reality 阶段顺序回到与 spec 逐字相同。**这处差异在 `[读码]` 层面无行为影响，但没有被单独跑分验证。**
  ⇒ 部分弥补：**最终版确实在真实浏览器里连续跑了 979 条采样 / 999.3 s**（`r42-after-b`），
  `smDeg = 0` 条、`smErr = ""`、`pageErrors` 无新增 ⇒ 「最终版能加载、能跑完整局、不降级」是 `[实测]`；
  只有**那次的秒数**因宿主被两个 AVD 占满而不可用（见 §5.3）。
- 存活探针 `r42-route-peek-a` 在 t=6.2 s 报出过 `eta=0s（threshold-reached）`，而当时现实并未解锁。
  已定位为「`TimeStudy.reality.cost` 只是必要条件」，并加了自证：`partial` 目标下若阈值已达成但目标未达成，一律报 `null`
  ＋ `threshold-met-but-goal-not-done`。修复后被单测覆盖（§7 两条断言），**未在真机上复测到该分支再次触发**（`[读码]`）。
- `ETA` 在 `reality` / `celestials` / `doomed` 三个阶段**恒为 `null`**（`goal-threshold-unreadable`）：
  它们的目标不是单资源阈值。`eternity` 阶段虽然登记了 TT 阈值，但 TT 是靠购买增长的（不是连续产出），
  12 s 窗口的斜率通常是 0 ⇒ `rate-unknown`。⇒ **实际运行中 ETA 几乎总是「无法估算」**，排序由此退化为「风险 → 操作数 → 与原序差异」。
  这不是 bug，是 `route-model.calibration.confidence.unknown` 要求的「不许编数」；但也说明**这个模型要真正有用，
  还需要给目标定义「可测的进度量」（例如「每个现实周期的 EC 完成数」），那是 R43 的活。**

---

## 6. 结论分级汇总

| # | 结论 | 级别 |
|---|---|---|
| 1 | 改动前是查表，不比较路线（行号见 §1） | `[读码]` |
| 2 | `oreki-route-model.json` 从 R40 到 R42 无任何 import | `[读码]` + `rg` 一条命中 |
| 3 | 执行层整局只买到 3 次（`exActN=3 / exTryN=306`） | `[实测]` |
| 4 | 改动后 8 个阶段 `priority` 与原序逐字相同、`routeSwitches=0` | `[实测]`（浏览器存活探针） |
| 5 | 同口径 771.2 s → 756.0 s；−2.0% 是抖动不是改进 | `[实测]` |
| 6 | `isGameEnd` 触发后 120 s 持续 true | `[实测]` |
| 7 | 6 条硬过滤 / 15% 滞回 / 300 s 冷却 / 5% 持平带按 route-model 生效 | `[实测]`（单测）+ `[读码]` |
| 8 | 智能层不是瓶颈，优化它无法压低通关秒数 | `[实测]`（第 3 条的推论） |
| 9 | celestials 段 466 s（60%）是当前最大可压缩块 | `[实测]`（分段耗时） |
| 10 | 「EC 链每轮现实重打」是否必要 | `[未知]` |
| 11 | 最终版代码在干净宿主上的通关秒数 | `[未知]`（见 §5.4） |

---

## 7. 复现

```bash
# 单测（无浏览器，~1 s）
cd "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web"
node _tools/_r40/r42-route-selftest.mjs        # 期望：76 通过 / 0 失败

# 存活探针（2 s 一读，**不产出通关秒数**）
node _tools/_r40/r42-route-peek.mjs 180 r42-route-peek-x

# 通关秒数（唯一合法口径）
cd _tools && node _r40/pelle-probe.mjs 1000 r42-x 1000
# ⚠ 跑前先执行：Get-Process qemu-system-x86_64-headless,emulator | Select StartTime
```

`r42-route-selftest.mjs` 覆盖 10 组 76 条断言：模块加载与叶子对齐、7 个阶段的「重排必须是排列」、
绑定不能引入新动词且不动未绑定槽位、ETA 主键与 5% 持平带、15% 滞回 + 300 s 冷却 + 失效立即换、
两条硬过滤真的淘汰、ETA 读不到即 `null`、`log10Of` 边界、手动优先权未被触碰、8 个接口的 `null` 语义。
