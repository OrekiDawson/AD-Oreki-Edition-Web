# R108-01 · Web 真实新档「Reality 后链 → 天神 → Pelle → gameEnd」验证与双端对照（中期报告）

> 角色：R108-01 Web 专职 teammate（web）· 工作目录 /home/oreki/AD-Oreki-Unified
> 仓库：web/AD-Oreki-Edition（独立 Git）· 源码基线 ce0ec9db26eb08791519185f816024568557288d（origin/main，R107-01 PR #20 之后）
> 本轮 Web 工作分支：feat/r108-01-web-reality-chain（从 ce0ec9db 新建）
> 生成时刻：2026-11-14 09:11 +08（中期收口；真实新档跑次仍在运行，未达 120 min 上限）
> 产物目录：reports/R108-01/web/（工作区证据）；web 仓库镜像：reports/R108-01/

## 0. 状态总表（截止 2604.9 s / 43.4 min 真实墙钟）

| 项 | 状态 | 证据 |
| --- | --- | --- |
| 现场核对（HEAD/分支/工作区/文档） | PASS | §1 |
| 真实新档默认设置跑次 | **RUNNING**（未结束，后续里程碑 NOT RUN） | run-default/ |
| 首次 reality | **PASS 434.2 s** | milestone-firstReality.json |
| realities 持续增长 | **PASS** r5 434.2 / r10 709.6 / r15 945.6 / r20 1176.1 / r30 1547.1 / r50 2115.2 / r60 2566.2 s | samples.jsonl |
| RM 正收益 | **PASS** RM 27.84 → 1e1200（首次 709.6 s；每现实按公式产出） | samples.jsonl |
| RU 真实购买（RM 扣费） | **PASS** upgradeBits 7→20 项；实测 RM 27.84 → 27.825（bit9 购买，价格 15/1000=0.015 RM，真实扣款） | samples.jsonl 540.4→570.9 s |
| glyph 成长 | **PASS** 总数 0→21、最高等级 28（r20 起 21 枚） | samples.jsonl |
| Teresa 解锁 | **PASS 1176.1 s**（成就 147「20 个一次性 RU 买齐」） | milestone-teresaUnlocked.json |
| Teresa 浇注（pouredAmount 真实增长到 1e24） | **PASS，但慢**：1176.1 → 1635.9 s（459.8 s）才解锁鹿颈长；设计值约 2.3 s | §3.4 / §4.2 |
| Effarig stage 1→4 | **PASS** stage2 1697.9 / stage3 1719.4 / 完成(4) 1842 s | samples.jsonl |
| Enslaved 页签解锁 | **PASS 1719.4 s**（鹿颈长永恒阶段完成即亮）；无名氏 run 按 R33 结论**不进**（无门票，进则自锁） | samples.jsonl |
| V 天神解锁（VUnlocks.vAchievementUnlock） | **RUNNING** 截止 r=60、2604 s 仍 false（hold 收尾刚开始） | samples.jsonl |
| Ra / Lai'tela | **NOT RUN**（未到；终局链设计上不依赖 Ra） | — |
| IU15（理想之构） | **FAIL/阻断**：默认 10000× 下 IM 上限 7.43e8 < 成本 1e9，截止 43 min 未买入 | §4.1 |
| IU25 / Pelle / gameEnd | **NOT RUN**（被 IU15 阻断；跑次继续观测） | — |
| 真实阻断定位 | **PASS**（IM 上限常数 ×300 与默认速度下的 EP 平台不匹配） | §4.1 |
| Web 侧最小修复 | 已实现并提交（OREKI_IM_CAP_MULT 300→3000，commit 89dcd7d），**回归 RUNNING/NOT RUN** | §4.3 |
| Android P0-1/P0-2 与 Web 同源对照 | **PASS（源码级）** | §5 |

## 1. 现场核对

- git rev-parse HEAD：ce0ec9db26eb08791519185f816024568557288d（= origin/main，R107-01 PR #20 合并提交）。
- 初始 checked-out 分支为已合并的 feat/r107-01-stage-beat（d440ed7）；git diff ce0ec9db d440ed7 为空（树一致），已从 ce0ec9db 新建本轮分支，工作区初始干净。
- 上游冻结基线未动（5409e320，见 docs/SHARED_GAMEPLAY_STANDARD.md §11 与仓库 AGENTS.md §10）。
- 已读：仓库 AGENTS.md、docs/SHARED_GAMEPLAY_STANDARD.md、docs/FACTS.md R107-01 节、reports/R107-01/README.md、accept-r107-01.mjs、beat/run-default-beat.mjs、ep-wall-fix/verify-ep-wall-fix.mjs、handoff/R107-01-交接-2026-11-14-终版.md。
- harness 已确认可复用：Node 26 + Playwright 1.65（Chromium 158 headless-shell）+ 自带静态服务；手机视口 412x839、DPR2.625、isMobile/hasTouch、zh-CN、Android Chrome UA；每跑次独立 browser.newContext()。

## 2. 方法（真实新档，不伪造）

- 全新 browser context（空 storage；boot 校验 realities=0、localStorage 为空）。
- **默认设置**：不注入调度间隔（配置 10 s，STAGECAP 生效 1/2/3/5 s）、不注入游戏速度（默认 10000× + 动态升档默认开启）、不改任何 player 字段、不改游戏时间源。
- 只做真实 UI 点击：关闭教程/常规弹窗；不 display:none、不发 CDP 改 DOM。
- 只读采样：每 2 s 读取真实游戏对象（player / Currency / Teresa / Effarig / Enslaved / V / Ra / Laitela / Pelle / ImaginaryUpgrade / GameEnd / OrekiSmartExecutor.debugState()），写 samples.jsonl；关键状态首次出现写 milestone-*.json + 截图。
- 判据：player.isGameEnd === true（GameEnd.endState >= 1）；endState = (log10(log10(totalAM)+1)-1)/(log10(1001)-1)，endState>=1 等价于 Pelle 阶段反物质 log10(totalAM)>=1000（src/core/celestials/pelle/game-end.js）。
- 采样探针已知局限（如实记录）：Teresa.pouredAmount / Currency.imaginaryMachines 是普通 number，探针里用了 Decimal 的 log10()，故这两项显示 null；浇注与 IM 的到达用「解锁位/阶段」等真实状态字段判定，不用探针数字。

## 3. 真实跑次结果（截止 2604.9 s / 43.4 min，仍在运行）

### 3.1 阶段里程碑（真实墙钟，2 s 采样）

| 里程碑 | 墙钟 (s) | 当时 realities / RM / RU | 备注 |
| --- | --- | --- | --- |
| 首次无限/永恒 | 6.3 / 83.2（R107 同源复现，本轮日志同量级） | r=0 | 未单独写 milestone 文件 |
| ep4000（EP 指数 ≥4000） | 125.7 | r=0 | R107 EP 墙修复仍有效 |
| 首次 reality | **434.2** | r=5（单次现实 +5：模拟现实 +4 常驻） | RM 27.84；一次性 RU 7 项 |
| r5 | 434.2 | 同上 | |
| r10 | 709.6 | RM 1e1200（IU6 抬 RM 上限） | RU 15 项 |
| r15 | 945.6 | glyph 总数 16 | RU 19 项 |
| r20 | 1176.1 | RU 20/20（ruAll）、**Teresa 解锁** | glyph 21；stage celestialsTeresa |
| r30 | 1547.1 | | stage celestialsEffarig（stage 2 在 1697.9） |
| r50 | 2115.2 | | stage celestialsEnslaved |
| r60 | 2566.2 | | V 第一项门槛（realities≥60）刚满足 |

### 3.2 现实循环节奏（每 +5 realities 的间隔，真实墙钟）

| 段 | 间隔 (s) |
| --- | --- |
| r0→r5（首次现实前） | 434.2 |
| r5→r10 | 275.4 |
| r10→r15 | 236.0 |
| r15→r20 | 230.5 |
| r20→r25 | 214.9 |
| r25→r30 | 156.1 |
| r30→r35 | 148.6 |
| r35→r40 | 146.3 |
| r40→r45 | 136.4 |
| r45→r50 | 136.8 |
| r50→r55 | 224.3 |
| r55→r60 | 226.7 |

解读：默认 10 s 配置 + STAGECAP 下，每次现实要重打 EC11/12 + 膨胀研究 6（DS6），单轮约 136–275 s；与 R107 beat 跑次（r20 @1177 s）同量级，**明显慢于 interval=1 的 A/B**（R107 verify-fix：r50 @1055 s）——这是默认配置的既有节拍差异，不是新回归。

### 3.3 配置审计（默认设置未被改写）

- configuredIntervalSeen = ["10"]（玩家配置始终 10 s，localStorage 未写 interval）。
- effectiveInterval 首次出现：1 s @0、2 s @434.2、3 s @709.6、5 s @2115.2 —— 与 STAGECAP 分档（realities 0 / 1–9 / 10–49 / ≥50）完全一致。
- 速度：全程 speed=10000、dynamic=true，**从未升档**（见 §4.2 归因：动态升档信号持续变化 ⇒ 不判停滞）。
- pageerror：0（summary 未写，采样期间未见 STATE ERROR）。

### 3.4 Teresa 浇注（Web 运行期确实在增长 pouredAmount）

- 1176.1 s：Teresa.isUnlocked=true（成就 147），一次性 RU 20/20 已买齐。
- 1635.9 s：TeresaUnlocks.effarig.isUnlocked=true —— 该解锁位要求 **pouredAmount ≥ 1e24**（secret-formula/celestials/teresa.js price 1e24），即 Web 运行期 pouredAmount **真实从 0 涨到 1e24**。
- 随后 Effarig stage 1→2→3→4（1697.9 / 1719.4 / 1842 s），进一步证明鹿颈长链是真实推进而非跳步。
- **代价**：459.8 s（设计期望约 2.3 s）。归因见 §4.2，本轮不修（属节奏问题，不是阻断）。

### 3.5 其它真实状态（截止 2604.9 s）

realities=60、RM=1e1200（hardcap 经 IU6 两次抬升）、ruBits popcount=20/20、glyphs 21（装备 5、最高 28 级）、Teresa 已浇满、Effarig stage=4（完成）、Enslaved 页签已亮但 run 未进（按 R33：无 1e40 年 + 5000 级符文门票，进则自锁）、VUnlocks=false、Ra/Laitela/Pelle/gameEnd 均未到。

## 4. 真实阻断：IM（虚幻机器）上限常数与默认速度下的 EP 平台不匹配

### 4.1 阻断链（运行时数字 + 源码公式，逐环可复核）

1. 默认 10000× 下，本跑次每次现实的 EP 峰值（player.records.thisReality.maxEP.exponent）实测平台：r10 3,427,220 / r15 3,436,298 / r40 3,012,078 / r45 2,252,563，**全跑次峰值 3,436,298**（samples.jsonl）。
2. Web IM 上限公式（src/core/machines.js:79-84）：
   baseIMCap = (max(log10(uncappedRM) − 1000, 0))^2 × (max(log10(uncappedRM) − 100000, 1))^0.2 × OREKI_IM_CAP_MULT
   其中 log10(uncappedRM) = 3 × (log10(EP)/4000 − 1)（machines.js:47-51）。
   代入 EP=3,436,298：log10(uncappedRM)=2577.2 ⇒ **cap = 1577.2^2 × 300 = 7.43e8**。
3. IU15「理想之构」成本 = 1e9（secret-formula/reality/imaginary-upgrades.js:15 cost），而默认速度下 IM 上限 7.43e8 **小于成本 1e9**，IM 只会从下方逼近上限（machines.js:103-106），因此 IU15 **物理上买不起**。
4. IU15 冲刺模块（oreki-iu15-sprint.js）的第一道闸：canArm 要求 MachineHandler.currentIMCap >= ImaginaryUpgrade(15).cost ⇒ 永不 arm ⇒ IU15 永不买入 ⇒ Laitela 永不解锁 ⇒ IU25/Pelle/gameEnd 全部不可达。
5. 为什么速度不会自动救场：动态升档只在「1 s 进度指纹连续 4 s 不变」时 ×2（speed-config.js:196-232）；本跑次 infinities/IP/eternities/realities/maxAM 持续变化 ⇒ 43 min 内 speed 恒 10000（samples 全程），EP 平台也就固定在 3.4e6 量级。
   反证：R107-01 的 100k 定向探针（ep-wall-fix/verify-gameend-100k.stdout.log）在 speed=100000 下 w≈900 s 达到 stage=laitela / goal=unlock-pelle（r=35），说明**链路机制本身能走通，卡的是默认速度下的 EP→IM 上限标定**。

结论：**Web 侧存在真实阻断（默认设置下不可达 gameEnd），根因是 OREKI_IM_CAP_MULT=300 是按 R50 存档的 log10(uncappedRM)≈6621 标定的，而全新档默认 10000× 的实际平台只有 ≈2577。**

### 4.2 非阻断但真实的节奏损失：Teresa 浇注 460 s

- 浇注按真实墙钟（oreki-celestial-automation.js:38-40, 673-681），但每次只取 min(实际间隔, OREKI_MAX_REAL_FRAME_MS=100 ms)。
- 本跑次 celestial 任务被统一调度器服务约每 19 s 一次（served.celestial 计数增速），于是每次只累积 100 ms×10 系数的浇注时长 ⇒ 需要约 25 次服务（~460 s）才到 1e24，而设计期望 2.3 s。
- 判定：**不影响正确性，只损失约 7.5 min 中前期时间**。本轮不修（改动会触碰浇注手感/上限语义，风险大于收益）。

### 4.3 Web 侧最小修复（已提交，回归 RUNNING）

- 改动：src/core/machines.js 的 OREKI_IM_CAP_MULT 300 → **3000**（1 行常量 + 说明注释）。
- 依据：默认速度下实测 EP 峰值 3.44e6 ⇒ 上限从 7.43e8 抬到 **7.43e9**（IU15 成本 1e9 的 7.4 倍、IU25 成本 5e9 的 1.49 倍），恢复 R50 注释所声明的「上限 ≈ e9 量级、IU15 只需 10% 出头」的设计意图；曲线形状/指数/刷新条件一律未动，IM 仍按 60 s 时间常数从下方逼近上限，真实时间成本保留。
- 提交：89dcd7ded0e2df139eacc836a4a66685e69b3da4（分支 feat/r108-01-web-reality-chain，未 push）。
- 状态：**回归 RUNNING / 未完成**——修复在中期收口时写入并提交，真实浏览器回归（默认设置新档跑到 IU15→Laitela→IU25→Pelle→gameEnd）在跑次结束后执行；本轮不虚报 PASS。
- 未做的备选（留给后续裁决）：下调 IU25 成本、或让动态升档对「长周期低进展」也敏感；两者都会改更多语义，不作为最小修复。

## 5. Android P0-1 / P0-2 与 Web 同源实现对照

> 对照对象：Android scripts/payload/kotlin/kajfosz/antimatterdimensions/oreki/OrekiRealityPacing.kt（312 行）与 OrekiRealityUpgrades.kt（395 行，HEAD 78dba931）；Web src/core/oreki-reality-automation.js（685 行）、src/core/oreki-celestial-automation.js（823 行）、src/core/machines.js。
> 结论先行：**P0-1 语义等价（公式/阈值/窗口/兜底一致）；P0-2 购买路径与扣费一致，但节奏参数有 4 处实现差异（Web 更激进、Android 更保守）**，均不是伪造/越权。

### 5.1 P0-1 现实节奏（Android OrekiRealityPacing.shouldReset ↔ Web OrekiRealityAutomation.shouldReality）

| 语义点 | Web（文件:行） | Android（文件:行） | 判定 |
| --- | --- | --- | --- |
| bootstrap：realities==0 无条件放行 | oreki-reality-automation.js:119 | OrekiRealityPacing.kt:253-257；调用点 OrekiReality.smali（先 canReality 后 shouldReset） | 等价 |
| 2% RM 收益门控 | :190-192 gain = MachineHandler.gainedRealityMachines × (simulatedRealityCount(false)+1)；gain.gte(have×0.02) | :283-296 gain = fh2.g(gainedEP).clampMax(fh2.d()).multiply(prestige.f.g()) | **等价**。smali 反编译核实 prestige/f;->g()I = p(false)+1（= simulatedRealityCount(false)+1），与 Web 同源；Android 注释称其为「RM 倍率」属注释不准确，非实现差异 |
| DS1 10 s 窗口 | :141 | :33,:266-271（DS1_WINDOW_MS=10000） | 等价（Web dilationUnlocked() = TimeStudy.dilation.isBought；Android 读同一研究位） |
| 未买齐一次性 RU 8 s / 已买齐 15 s | :35-36,:163-170 | :35-36,:278 | 等价 |
| 就绪后最小间隔 2 s | :29,:142 | OrekiReality.smali 的 2 s 防抖（0x7d0，R58-1 与 Web 对齐） | 等价（位置不同，同值 2000 ms） |
| hardcap 兜底 interval*3 | :197 | :298 | 等价 |
| 压现实 hold（V 收尾/深挑战/莱特拉/IU15 冲刺） | :111-139 只读 OrekiCelestialAutomation.holdReality | setHold/isHeld 存在但**当前无调用方** | 阶段性差异：Android P0-3/P0-4 未实现；补天神链时必须同时接 hold，否则 V 的 maxDT 判据无法在同一现实内达成 |
| Teresa 浇注期压现实 | 无单独 veto；靠 _hasBuyableRU 决定是否浇（celestial-automation:103-140） | OrekiReality.smali 在 pacing 前查 OrekiTeresaAuto.isHolding() | 实现差异（平台阶段差异），不改变 P0-1 规则等价性 |

### 5.2 P0-2 现实升级自动购买（Android OrekiRealityUpgrades ↔ Web buyRebuyable/buyReality/tryUnlock）

| 语义点 | Web（文件:行） | Android（文件:行） | 判定 |
| --- | --- | --- | --- |
| 现实前不动作 | oreki-reality-automation.js:635 | OrekiRealityUpgrades.kt:340-343 | 等价 |
| RU1~5 可重复 | :248-262 while (canBeBought && purchase())（无每次上限） | :347-360 每项 while (n < REBUYABLE_SAFE_MAX=100) | 差异：Android 加 100/拍/项安全上限；真实 purchase() 扣费路径相同 |
| 一次性 RU6~25 | :267-287 cost 升序，一次调用可买多个 | :375-386 cost 升序，**每拍最多 1 个真实购买**，最多尝试 5 个候选 | **节奏差异（实质）**：同一窗口 Web 可买多个、Android 只能 1 个 |
| tryUnlock 复检 | :232-246，被服务到且 ≥1 s 时调用（约 1 s 一次） | :362-370 每 10 拍一次 | **节奏差异（实质）**：Android ≈10×拍间隔（30–50 s） |
| 购买顺序 | :645-646 tryUnlock → RU1~5 → RU6~25 | :347-383 RU1~5 →（每 10 拍）tryUnlock → RU6~25 | 顺序差异，无资源语义差异 |
| 调用频率 | 每帧 runCycle 任务（game.js:1149）+ 模块内 1 s/2 s 时间窗 | OrekiStageAuto 每拍一次（STAGECAP 1–5 s） | **节奏差异**：Web 购买/复检频率上限显著更高 |
| 总开关/毁灭态 | active 检查 autobuyersOn 与 Pelle.isDoomed（:50-60） | 永恒层门禁内调度；毁灭态整体停摆（P0-4 未实现） | 等价（阶段范围不同） |

**结论**：P0-1 与 Web 逐条同源（2% 门控、DS1 10 s、8 s/15 s、hardcap 5 s 兜底、bootstrap 不变）；P0-2 动作全部走原版 purchase()（真实扣 RM、真实写购买位），差异集中在节奏（Android 每拍最多 1 个一次性 RU、tryUnlock 每 10 拍）。若要双端里程碑对齐，Android 侧建议把一次性 RU 的 1 个/拍 放开到「买得起就继续」，或把 tryUnlock 提到每拍/每 2 拍；否则 25 个一次性 RU 至少需要 25 拍。

### 5.3 对 Lead 提出的四个 Web 同源项的运行期/源码核对

| 项 | Android 侧问题 | Web 侧同源状态 | 判定 |
| --- | --- | --- | --- |
| Teresa 浇注（poured 不增长） | Android vp/浇注不生效 | **Web 运行期实测 pouredAmount 真实增长到 1e24**（1635.9 s 解锁鹿颈长，随后 Effarig 1→4），机制生效；但比设计慢（459.8 s，见 §4.2） | Web **未阻断**，仅慢 |
| IM 上限 ×300 | 上限低于 IU15 成本 | **Web 阻断已确认**：默认速度 EP 平台 3.44e6 ⇒ 上限 7.43e8 < IU15 1e9（§4.1） | Web **同样阻断**，本轮修复 |
| IU25 成本 5e9 | 成本高于上限 | Web OREKI_IU25_COST=5e9（imaginary-upgrades.js:21/357）；修复后上限 7.43e9，IU25 占 67%，可攒到；修复前不可达 | 修复后预计可推进，**回归 RUNNING** |
| 莱特拉熵除数 2e7 | 熵增速不足 | Web laitela.js 已定 2e7（R40-A2 注释：指数 1.15e8 ⇒ 0.165/s，6 s 填满；阈值取 2e8 留余量），driveLaitela 入场线 LAT_RUN_MIN_AM_EXP=4e8 与此配套；运行期 **NOT RUN**（IU15 未到先） | 静态一致，**运行期 NOT RUN** |

## 6. 证据清单

| 路径 | 内容 |
| --- | --- |
| reports/R108-01/web/REPORT.md | 本报告 |
| reports/R108-01/web/run-reality-chain.mjs | 默认设置真实新档跑次脚本（只读采样、真实 UI 关闭弹窗） |
| reports/R108-01/web/analyze-run.py | samples.jsonl → 里程碑/节奏/停滞/配置审计 |
| reports/R108-01/web/run-default/samples.jsonl | 2 s 只读采样（截至收口 1214 条） |
| reports/R108-01/web/run-default/milestone-*.json + screenshots/ | 里程碑状态 + 截图 |
| reports/R108-01/web/run-default/run.log | 跑次日志 |
| reports/R108-01/web/analysis.json | 自动汇总（里程碑/间隔/停滞/配置） |
| reports/R108-01/web/source-head.txt | 跑次时源码 HEAD 与工作区干净度 |
| web 仓库 reports/R108-01/ | 上述关键文件的仓库镜像（随 commit 提交） |

## 7. PASS / FAIL / BLOCKED / NOT RUN 与恢复点

**PASS**
- 现场核对、harness 可复用；默认设置未被改写（interval 10 s 未写盘、速度 10000× 未注入）。
- 首次 reality 434.2 s；realities 真实增长到 60；RM 正收益；RU 真实购买且真实扣 RM；glyph 成长到 21 枚/28 级。
- Teresa 解锁 1176.1 s；浇注真实推进到 1e24（1635.9 s）；Effarig stage 1→4；Enslaved 页签 1719.4 s。
- 阻断定位（IM 上限 ×300 vs 默认速度 EP 平台）与最小修复已落盘。
- Android P0-1/P0-2 与 Web 同源对照（§5）。

**FAIL**
- IU15 在默认设置 10000× 下买不起（IM 上限 7.43e8 < 成本 1e9）→ 默认设置 gameEnd 不可达；这是本轮 Web 侧的真实阻断（已修复，回归未完成）。

**BLOCKED**
- 修复后的完整回归（IU15→Laitela→IU25→Pelle→gameEnd）BLOCKED 于中期收口时间点，**NOT RUN**；需下一段继续。

**NOT RUN**
- V 天神解锁（截止 r=60 时 vUnl=false，hold 收尾刚开始）；Ra、Lai'tela、IU25、Pelle、doomed、endState、gameEnd。
- Android AVD（Lead 独占，本轮不跑）。

**恢复点（环境/命令/产物）**

- 跑次仍在后台运行（job bash-dbeef4686a4b4deb，120 min 上限），产物写 reports/R108-01/web/run-default/。
- 重跑命令：
  cd /home/oreki/AD-Oreki-Unified
  OUT_DIR=/home/oreki/AD-Oreki-Unified/reports/R108-01/web/run-default MAX_WALL_SEC=7200 SAMPLE_MS=2000 node reports/R108-01/web/run-reality-chain.mjs
- 修复后回归建议：同一脚本（默认设置）跑满 120 min，验收判据 = player.isGameEnd=true；若仍未达，按 samples 的 IM 上限（修复后应为 7.43e9）与 IU15/IU25 购买时刻定位下一环。
- 证据汇总：python3 reports/R108-01/web/analyze-run.py
- 分支与 commit：feat/r108-01-web-reality-chain（不 push，由 Lead 决定 PR）。
