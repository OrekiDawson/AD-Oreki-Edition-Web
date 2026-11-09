# R51-AND-01　Android 真实新档极速通关

| 项 | 内容 |
| --- | --- |
| 任务编号 | R51-AND-01 |
| 标题 | Android 真实新档推进至 `isGameEnd=true && endState>=1`，含 Eternity / Reality / Celestial / Pelle 阶段自动化补齐 |
| 创建时间 | 2026年11月1日 15:40 |
| 创建者 Agent ID | main |
| 负责 Agent ID | main |
| 实际执行者 Agent ID | main |
| 更新者 Agent ID | main |
| 贡献者 | main（本轮全部改动） |
| 优先级 | P5 |
| 状态 | 进行中 |
| 来源 | 用户 2026-11-01 15:32 R51-01 |
| 禁止修改 | `OrekiAutomationScheduler.smali`（归 R51-SCHED-01）；`scripts/payload/smali/.../oreki/tutorial/**`（归 R51-05）；同一 AVD 不得被其他 Agent 占用 |

## 一、目标

真实新档（`pm clear` 后全新安装状态、不预置任何标记）从开局推进到终局：

```
Infinity 前期 → ID1-8 → Dimension Boost / Galaxy → Eternity + EC → Reality
→ Glyph → Celestial（Teresa / Effarig / Enslaved / V / Ra / Laitela）→ Pelle → isGameEnd
```

判据只有一条：`player.isGameEnd === true && endState >= 1`（存档字段实测，不接受 UI 文案）。

## 二、已证瓶颈（2026年11月1日 15:40，主 Agent【读码】+【实测】）

| # | 事实 | 证据 |
| --- | --- | --- |
| 1 | Android 阶段自动化止于 `eternities==0` 窗口 | `OrekiStageAuto.smali:132-141`，已永恒即 `return` |
| 2 | `OrekiEternity.tick()` 只做时间定理 / 时间维度 / 普通时间研究 / 按永恒 | `OrekiEternity.smali` 方法表 |
| 3 | Reality 之后零自动推进（无 reality 重置、无 glyph 装备、无 celestial 操作、无 Pelle 推进） | `scripts/payload/smali/.../oreki/` 全目录扫描，未命中任何 `reality/`、`celestials/` 的自动调用 |
| 4 | `StageAssist` 可点亮成就位，但写 `stage_assist_used` 永久标记，**真实通关验收禁用** | `StageAssist.smali:1368` 原文 |
| 5 | Web 对应能力为 6368 行 JS（`oreki-*automation.js` 六件套） | `wc -l` 实测 |

## 三、执行顺序（每步先证瓶颈再改）

1. 真实新档基线：一次安装、全程不重启、不 force-stop、屏幕常亮、≥60 s 采样，记录
   `AD1.amount` / `IP` / `infinities` / `eternities` 序列（C.92 零重启法）。
2. 定位当前档位最慢的一段（ID 解锁 / DB-Galaxy / Eternity 循环 / EC）。
3. 最小修改对应代码路径，构建 A27，装机复测同一指标。
4. 依次向 Reality / Glyph / Celestial / Pelle 推进，每阶段建立「进入即验证」的存档断言。
5. 全链贯通后跑一次完整零重启通关计时。

## 四、禁止

- 不伪造存档状态、不直接写 `isGameEnd` / `endState`。
- 不使用 `StageAssist` 的成就位写入能力替代真实推进。
- 不以「代码已写」「静态断言通过」作为阶段完成证据。

## 五、A27 实测记录（2026年11月1日 15:54，执行者 main）

**新档基线（A26，`pm clear` 后 60 s 采样）**：【实测】

| 指标 | 值 |
| --- | --- |
| `infinities` | 10 → 14 |
| `IP` | 5 → 13 |
| `ipMultUpgrades` | **0** |
| `infinityUpgradeBits` | **0** |
| `dimensionBoosts` / `galaxies` | 16→10 / 2→1 |
| `brake` | false |

**结论（A27 修复前）**：每次坍缩只兑现约 1~2 IP，IP 是**线性**增长。根因不是数值不够，
而是三段死锁叠加：

1. `buyInfinityUpgrades` 循环**每 tick 都在列表首项 `return-void`**，后面的 ipMult 分支一次都轮不到；
2. ipMult 闸门用 `ID1.y()==0`（没买过 ID1）判「不买 ipMult」，全新档恒成立 ⇒ ipMult 恒不买；
3. 于是 IP 只能 +2/坍缩，永远到不了 interval 升满所需的 32767 IP，更到不了 ID1 的 1e8。

**A27 改动**（提交 `26c118b`）：

- 无限升级循环买到后 `return-void` → 继续遍历（不再卡首项）；
- ipMult 闸门改为「仅 ID1 已解锁但未买下时保留 IP」（`G() && y()==0`），未解锁时正常买；
- 加 `OREKI_IUP_SIZE / B0 / Z0` 入口探针（当时为每 300 次，实测节流失效，A27b 改为只打一次）；
- `applyCrunchPolicy` 的 `if-gtz` → `if-gez`，消除 `OREKI_AU4B` 每 tick 刷屏（25 s 打出 1007 行）。

**A27 装机实测（25 s）**：【实测】

- `infinityUpgradeBits` **0 → 2047**（11 个一次性升级真买到）；
- `OREKI_IUP_BUY: resetBoost` 出现 **1007 次** ⇒ 循环仍卡在 `resetBoost` 提前退出，
  证明第 1 段死锁尚未解开（A27 的改动在 A27b 才生效）；
- `ipMultUpgrades` 仍为 0，与上述判断一致。

**A27b 改动**：循环内 `return-void` → `goto :oreki_sa_iup_next`；探针改为只打一次。

**待验证**：A28 装机后 `ipMultUpgrades` 是否开始增长、IP 是否转为指数增长、`brake` 是否转 true。

## 六、REA 调用链结论（2026年11月1日 16:20，执行者 rea-agent，【读码】）

| 项 | 结论 | 位置 |
| --- | --- | --- |
| Reality 重置真实入口 | `prestige/f;->b(Lsw3;)Ljava/lang/Object;`（suspend 函数，入参是 Continuation） | `prestige/f.smali:1668` |
| **`endState` 不是存档字段** | 它是计算属性：`pelle/b;->b()D` 读 `PelleRecords.totalAntimatter` 后算 `log10/1000` | `celestials/pelle/b.smali:338` |
| `isGameEnd` 唯一写入点 | `pelle/b;->d(D)V` 内 `b:355-414`，由 `a.smali:14490` 每帧调 | 同上 |
| Teresa / V | **原版主循环已自动推进**（`teresa/c;->b(Z)V` / `v/b;->w()V`），不需要额外驱动 | `celestials/teresa/c.smali`、`celestials/v/b.smali` |
| Laitela | 原版有 `AnnihilationAutobuyerState`，可走原版自动器 | `celestials/laitela/**` |
| 当前补丁覆盖 | 只到「首次永恒之前」 | `OrekiStageAuto.smali:132-141` |
| suspend 调用纪律 | 传 continuation 时必须给 `OrekiEcContinuation;->a` 实例，**不能传 null**（传 null 会 NPE 且被 catch 吞成静默失败） | R50 实测 |

**修正一条既有误解**：`reports/r51/poll.py` 打印 `endState=None` **不是采集失败**，
而是 Player 根本没有这个字段。要判终局必须读 `pelle/b;->b()D`，不能读存档 JSON 的 `endState`。

## 七、A29 零重启基线（2026年11月1日 17:03 起，执行者 main，【实测】）

条件：`oreki_test`，A29 一次 `install` + `pm clear`，17:03 后**不重启、不 force-stop、不锁屏、不切后台**，90 s 采样。

| t (s) | AM | inf | IP | brake | db/gal | ipMult 等级 | bigCrunches |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 4.89e100 | 0 | 0 | false | 17 / 1 | 0 | — |
| 88 | 8.47e113 | 0 | 0 | false | 37 / 2 | — | — |
| 178 | 5.7e318 | 27 | 2.02e5 | **true** | 22 / 8 | — | — |
| 268 | 3.71e1359 | 27 | 7.74e6 | true | 106 / 8 | 6 | — |
| 358 | 1.22e1363 | 27 | 1.06e7 | true | 106 / 8 | — | — |
| 448 | 2.13e1361 | 27 | 2.56e7 | true | 107 / 8 | — | — |
| 538 | 2.53e1366 | 27 | 4.07e7 | true | 108 / 8 | — | — |
| 628 | 2.12e1371 | 27 | **5.58e7** | true | 108 / 8 | 7 | 16 |

**阶段跃迁**：首次无限 → Break 在 **178 秒内**完成（A28 到同阶段用时 >8 分钟）。

**C.98 结论**：`ipMultUpgrades` 0→7 单调递增，IP 单调涨到 5.58e7（无回落），
证明「`ln0.i` 扣费 + `I()/J()` 涨级」这条路径真实生效。
`OREKI_IPM_LV` 在 A29 里**一行都没有**，因为旧阈值是「每 100 级一行」——已在 A30 修为「前 50 级每级可见」。

**当前墙**：ID1 解锁需 IP ≥ 1e8，实测 5.58e7；`X_HIGHEST/10` 要求单次 gain ≥ 历史最高 ×10，
所以下一次坍缩的 gain 会跨到 5.58e8 级别，**那一次应同时解锁 ID1**。这不是死锁，是最后一跳。

## 八、ID1 解锁并买下（【实测】，采样相对时刻）

> 起点 = 2026年11月1日 17:03（真实时钟读数，`scripts/oreki_time.py --human`）。
> 下表用**相对时刻 t**，绝对时刻未逐点读取，故不写墙钟（FACTS C.100）。

| t (s) | AM | IP | ID 解锁 | ID 买次 | dimensionBoosts / gal |
| --- | --- | --- | --- | --- | --- |
| 0（续采） | 1.51e1379 | 9.25e7 | 无 | 全 0 | 108 / 8 |
| **60** | 2.16e1402 | 1.83e7 | **[ID1, ID2]** | **[1, 0, …]** | 53 / 7 |
| 120 | 8.45e2203 | 5.85e7 | ID1, ID2 | 1, 0 | 136 / 10 |
| 180 | 2.87e2337 | 9.87e7 | ID1, ID2 | 1, 0 | 142 / 11 |
| 240 | 3.99e2354 | 1.39e8 | ID1, ID2 | 1, 0 | 142 / 11 |

**里程碑**：从全新档到 **ID1 解锁并真实买下（`baseAmount/10 = 1`）**用时约 21 分钟，
期间零重启。AM 从 1e1379 涨到 1e2377（后续续采），`dimensionBoosts` 108→142、gal 8→11。

**下一道墙**：ID2 已解锁但未买下（`ID买次=[1,0,…]`），其成本高于当前 IP（2.8e8），
需要 IP 继续涨到 1e9 级 —— 依赖 `X_HIGHEST/10` 的下一轮坍缩。

## 九、A30 零重启基线（起点 2026年11月1日 17:57:29 真实读数，12×90 s，【实测】）

| t (s) | AM | IP | dimensionBoosts | gal | ID 解锁 / 买次 |
| --- | --- | --- | --- | --- | --- |
| 0 | 1.28e113 | 0 | 17 | 1 | — |
| 90 | 2.18e274 | 0 | **36** | 2 | — |
| 180 | 5.7e1173 | 8.69e5 | 90 | 7 | — |
| 270 | 1.41e1359 | 6.81e6 | 106 | 8 | — |
| 451 | 5.29e1359 | 2.19e7 | 107 | 8 | — |
| 631 | 9.81e1370 | 5.02e7 | 108 | 8 | — |
| 901 | 4e1376 | 9.26e7 | 108 | 8 | — |
| **991** | **6.19e2184** | 6.7e6 | 136 | 10 | **ID1, ID2 / 1, 0** |

**与 A29 对比**：到「ID1 买下」A29 约 21 分钟、A30 约 **16.5 分钟**（快 4.5 分钟）。
两条曲线形状一致（Break 都在 3 分钟内），差异来自 A30 的 ipMult 保留闸门与日志修复后重跑。

**C.100 直接证据**：`t=90` 时 AM=2.18e274（**< 1.79e308**）而 `Player.dimensionBoosts`=**36** ——
内部字段与界面显示次数是两个口径，界面在该阶段最多显示 16。见 `FACTS.md` C.100.1。

**A30 未达项**：`OREKI_SCHED act` **0 条**（`allow("breakGate")` 恒拒），
调度器只初始化未管辖任何动作。排查已排除：数组长度（11 项一致、无越界）、
`isContIdx(8)` 判为非连续型、`Player$Options.c()` 确实读 `autobuyersOn`。
剩因需在 `allow()` 的 deny 出口加诊断日志后确定，不得盲改。


