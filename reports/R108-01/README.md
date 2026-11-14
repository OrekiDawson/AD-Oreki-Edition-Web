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
| 旧代码真实新档默认设置跑次 | **已停止**（Lead 裁决；截止 2739.6 s / 45.7 min，IU15 被 IM 上限阻断） | run-default/ + old-run-cutoff.txt |
| 修复后默认设置回归跑次 | **PASS：gameEnd @1867.9 s（31.1 min）**，pageerror 0 | run-fixed4/summary.json |
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
| IU15（理想之构） | **PASS（修复后）**：旧代码默认 10000× 下 IM 上限 7.43e8 < 成本 1e9 永不买入；OREKI_IM_CAP_MULT=3000 后 run-fixed 880.7s / run-fixed3 892.4s 真实买入 | §4.1/§4.3/§3.6 |
| 莱特拉 tier 0→8 | **PASS（修复后）**：旧代码 431s 内 0 次 run、tier 恒 0；窗口 30s→300s 后 run-fixed3 在 906→1809.9s 内 8 次真实 run、tier 0→8 | §4.4/§3.6 |
| IU25 / Pelle / gameEnd | **PASS（修复后）**：IU25+doomed 1826.5 s；**gameEnd 1867.9 s**（endState=1.0417），默认设置 180 min 门禁达成 | §3.7/§4.5 |
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

### 3.6 修复后跑次里程碑（默认设置，真实新档，2 s 只读采样）

| 里程碑 | run-fixed（IM 修复） | run-fixed3（IM+莱特拉窗口修复，仍 RUNNING） |
| --- | --- | --- |
| ep4000 | 109.7 s | 131.4 s |
| 首次 reality | 418.9 s | 434.3 s |
| IM ≥1e9（im1e9） | 655.5 s | 671.2 s |
| IU15 买入 / Laitela 解锁 | **880.7 s** | **892.4 s** |
| ach151（薇页签条件） | 880.7 s | 899.4 s |
| Teresa 解锁 | 1110.5 s | 1130.9 s |
| r15 / r20 / r30 / r50 | 947.2 / 1110.5 / — / — | 968.3 / 1130.9 / 1412.4 / 1863.8 s |
| 莱特拉 tier 1 / 2 / 3 / 4 / 5 / 6 / 7 / 8 | 0 / 0 / 0 / 0 / 0 / 0 / 0 / 0（旧窗口） | 906.4 / 1051.9 / 1274.3 / 1367.9 / 1473.9 / 1594.2 / 1691.1 / **1809.9 s** |
| Effarig 解锁 / stage2 / stage3+Enslaved 页签 | — | 1499.5 / 1527.3 / 1536.5 s |
| r60 | — | 2206 s |
| IU25 / Pelle / doomed / gameEnd | 未达（DS6 帧问题） | 未达，DS6 帧修复后由 run-fixed4 验证（RUNNING） |

### 3.7 最终回归结果（run-fixed4，默认设置 + 三项修复）：**gameEnd PASS**

- 配置：全新存档、默认设置（interval 10s 未写盘、STAGECAP 生效、speed 10000× 注入关闭、动态速度默认开）、
  手机视口 412x839、只做真实 UI 关弹窗；pageerror **0**；采样 832 条 / 1867.9 s。
- 里程碑（真实墙钟）：ep4000 109.7 → 首现实 413.8 → im1e9 650.6 → r10 693.7 → **IU15+Laitela 857.4** →
  ach151 859.7 → r15 931.7 → r20/Teresa 1096.1 → r30 1366.8 → Effarig 解锁 1484.4（stage2 1598.3 / stage3+Enslaved 1605.3）
  → **tier8 1771.8** → **IU25+Pelle+doomed 1826.5** → **endState≥1 / gameEnd 1867.9 s（31.1 min）**。
- 终态：realities=45、IM=1.02e10、tier8、iu15/iu25/pelle/doomed 全真、endState=1.0417、isGameEnd=true、
  Pelle 阶段反物质峰值 log10=1033.92（>=1000 即 endState>=1）；末段动态速度自然升到 40000×（停滞升档机制生效）。
- 判据：player.isGameEnd === true 且 GameEnd.endState = 1.0417（>=1），非写字段、非跳过结算。
- 结论：**Web 默认设置全新档 31.1 分钟真实通关**，远优于 180 分钟目标；三项修复全部被运行期验证。

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

### 4.4 第二阻断：莱特拉 tier 在默认 10000× 下结构性不可达（已修复并验证）

- 运行期证据（run-fixed/，默认设置，2 s 只读采样）：OREKI_IM_CAP_MULT 修复后 Laitela 于 880.7 s 解锁，
  但到 1312.2 s（431 s）内 `laitelaRunning` 采样为 **0 次**、`entropy>0` **0 次**、tier 恒 0。
- 根因（源码 + 采样）：原版 tier 判定要求「本次 Laitela 现实在现实开始后 **30 s** 内完成」（game.js，
  `Time.thisRealityRealTime < 30`）；而现实重置把反物质清零后，AM 指数达到入场线 4e8 的真实时刻是
  realMs≈130–230 s（run-fixed2 实测 r0 129 s / r5 202 s / r10 200 s），默认速度下现实周期本身 136–226 s。
  同时 oreki-endgame 的入场窗口 `LAT_RUN_ENTER_MAX_REAL_MS=15000` 只在现实前 15 s 内允许进 run（那时 AM 才 1e5–1e6）。
  ⇒ 30 s 内不可能「进 run → 熵满 → 完成」⇒ tier 恒 0 ⇒ IU25 要求的 `maxAllowedDimension===0` 永不成立。
- 修复（commit bc45c18）：新增 `OREKI_LAITELA_TIER_WINDOW_SEC=300`（game.js 三处判定同步引用）、
  `LAT_RUN_ENTER_MAX_REAL_MS 15000→290000`、`LAT_TIER_WINDOW_MS 28000→250000`。
  熵公式 / tier 上限 / 奖励 / 解锁语义不变，只把「30 s 窗口」按实测现实周期标定为 300 s。
- 验证（run-fixed3，默认设置全新档）：tier 0→8 真实推进（run-fixed4 最终回归 tier8=1771.8 s，见 §3.7）：
  tier1 906.4 s → tier2 1051.9 → tier3 1274.3 → tier4 1367.9 → tier5 1473.9 → tier6 1594.2 → tier7 1691.1 → **tier8 1809.9 s**，
  共 8 次真实 `Laitela.initializeRun`（laiRuns=8），每次完成都发生在 300 s 窗口内。**PASS（Web 单端）**。
- 双端口径提示：Android 侧同样存在原版 30 s 判定（3.21 基线），若其自动化在默认速度下也依赖 AM 指数入场，
  需要同样的窗口标定；已写入 §5.4 与共享文档，供 Android 侧核对。

### 4.5 第三阻断：tier 8 后 IU25 的 DS6 帧被自动现实抢走（已修复，回归 RUNNING）

- 运行期证据（run-fixed3）：tier8 于 1809.9 s 达成、IM=6.83e9 ≥ IU25 成本 5e9、glyphs 条件可满足，
  但到 2224.5 s（415 s）内 `iu25` 恒 false、`laiRuns` 恒 8、`iu25` 从未出现；同期 realities 仍每 ~190 s 增加。
- 根因（源码顺序 + 采样）：统一调度里 reality 任务（priority 40）先于 endgame（70）执行；DS6（TimeStudy.reality）
  一买上就满足 `isRealityAvailable()`，同一拍/下一拍被自动现实清掉，endgame 永远看不到「DS6 在位」的那一帧。
  IM 早已够，缺的只是这一帧。
- 修复（commit 6988b92）：tier>=8 且 IM 已够、DS6 未在位时，用 `holdForLaitela` 压住自动现实
  （最多 `IU25_HOLD_MAX_MS` 90 s→240 s），让自动化在当前现实内把 EC 链/DS6 打完；DS6 到手后下一拍走
  原版真实路径（卸符文 → initializeRun → tryUnlock → purchase）。到期无条件放手，不永久压死现实。
- 回归：run-fixed4（默认设置）**PASS**：IU25/Pelle/doomed 在 1826.5 s 同时达成（持帧修复生效），endState 0.084 → 0.75 → 0.91 → 1.0417，1867.9 s 达成 gameEnd（§3.7）。

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

### 5.4 双端节奏差异（R108-01 实测数值）

| 机制 | Web（本轮实测） | Android（本轮 Lead 提供） | 判定 |
| --- | --- | --- | --- |
| Teresa 浇注 | 真实墙钟 + 10 倍手感系数；但 celestial 任务约每 19 s 才被统一调度器服务一次，且 OREKI_MAX_REAL_FRAME_MS=100 只累计 100 ms/次 ⇒ 解锁到 1e24 实测 **459.8 s**（设计约 2.3 s） | 走原版主循环按帧累计真实时间（无调度器节流），理论约 2.3 s | **双端节奏差异（非语义差异）**；Web 调度粒度损失列入下一轮评估，禁止用加大系数伪造速度 |
| P0-2 一次性 RU | 一次调用可买多个（cost 升序）、tryUnlock 约 1 s 一次（Web 原生行为） | 本轮已对齐：每拍最多 8 个、tryUnlock 每拍 | **已对齐（Web 无需改）** |
| IM 上限倍率 | OREKI_IM_CAP_MULT=3000（本轮修复 commit 89dcd7d） | OrekiImCapScale.MULT=3000（本轮同步，构建中） | **双端统一 3000**；数值理由与证据写入 docs/SHARED_GAMEPLAY_STANDARD.md 平台专属章节、WEB_ANDROID_DIFFERENCES.md 第 20 节、docs/FACTS.md R108-01 节 |
| IU25 成本 / 莱特拉熵分母 | 5e9 / 2e7（laitela.js R40-A2） | 本轮同值 | 一致；Web 运行期仍 NOT RUN（IU15 未到先） |
| Teresa vp 字段 | 直接 Teresa.pouredAmount（普通 number） | 3.21 字段名不同需反射（vp） | 平台 ABI 差异，语义一致 |

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
| reports/R108-01/web/run-fixed/ | 修复 1（IM 上限）后默认设置跑次（截止 1312.2 s，IU15/Laitela 已验证，tier 卡 0） |
| reports/R108-01/web/run-fixed3/ | 修复 2（莱特拉窗口）后默认设置跑次（tier 0→8 @1809.9 s；IU25 卡 DS6 帧） |
| reports/R108-01/web/run-fixed4/ | 修复 3（DS6 帧 hold）后默认设置回归（RUNNING，目标 gameEnd） |
| reports/R108-01/web/run-fixed2/ | 诊断跑次（未改窗口，证明 AM 指数 130–230 s 才到 4e8、入场窗口错过） |
| web 仓库 reports/R108-01/ | 上述关键文件的仓库镜像（随 commit 提交） |

## 7. PASS / FAIL / BLOCKED / NOT RUN 与恢复点

**PASS**
- 现场核对、harness 可复用；默认设置未被改写（interval 10 s 未写盘、速度 10000× 未注入）。
- 首次 reality 434.2 s；realities 真实增长到 60；RM 正收益；RU 真实购买且真实扣 RM；glyph 成长到 21 枚/28 级。
- Teresa 解锁 1176.1 s；浇注真实推进到 1e24（1635.9 s）；Effarig stage 1→4；Enslaved 页签 1719.4 s。
- 阻断定位（IM 上限 ×300 vs 默认速度 EP 平台）与最小修复已落盘。
- Android P0-1/P0-2 与 Web 同源对照（§5）。

**FAIL（旧代码，均已被修复并被 run-fixed4 最终回归验证通过）**
- 旧代码 IU15 在默认设置 10000× 下买不起（IM 上限 7.43e8 < 成本 1e9）→ gameEnd 不可达（修复 1：89dcd7d）。
- 旧代码莱特拉 tier 结构性不可达（30 s 窗口 vs AM 指数 130–230 s 才到入场线）→ IU25 阻断（修复 2：bc45c18；run-fixed3/run-fixed4 已验证 tier 0→8）。
- 旧代码 tier8 后 IU25 的 DS6 帧被自动现实抢走 → IU25/Pelle 阻断（修复 3：6988b92；run-fixed4 已验证）。

**BLOCKED**
- 修复后的完整回归（IU15→Laitela→IU25→Pelle→gameEnd）BLOCKED 于中期收口时间点，**NOT RUN**；需下一段继续。

**PASS（修复后最终回归）**
- run-fixed4（默认设置 + 三项修复）：IU15/Laitela 857.4 s → tier8 1771.8 s → IU25+Pelle+doomed 1826.5 s → gameEnd 1867.9 s（31.1 min），endState=1.0417，pageerror 0。产物 reports/R108-01/web/run-fixed4/。

**NOT RUN（旧代码跑次截止时）**
- V 天神解锁（截止 r=60 时 vUnl=false，hold 收尾刚开始）；Ra、Lai'tela、IU25、Pelle、doomed、endState、gameEnd。
- **修复后回归（run-fixed/，默认设置 + OREKI_IM_CAP_MULT=3000）：RUNNING**；里程碑落盘于 reports/R108-01/web/run-fixed/milestone-*.json（每到一个里程碑立即写 json + 截图，不等 gameEnd 收口）。
- Android AVD（Lead 独占，本轮不跑）。

**恢复点（环境/命令/产物）**

- 跑次仍在后台运行（job bash-dbeef4686a4b4deb，120 min 上限），产物写 reports/R108-01/web/run-default/。
- 重跑命令：
  cd /home/oreki/AD-Oreki-Unified
  OUT_DIR=/home/oreki/AD-Oreki-Unified/reports/R108-01/web/run-default MAX_WALL_SEC=7200 SAMPLE_MS=2000 node reports/R108-01/web/run-reality-chain.mjs
- 修复后回归建议：同一脚本（默认设置）跑满 120 min，验收判据 = player.isGameEnd=true；若仍未达，按 samples 的 IM 上限（修复后应为 7.43e9）与 IU15/IU25 购买时刻定位下一环。
- 证据汇总：python3 reports/R108-01/web/analyze-run.py
- 分支与 commit：feat/r108-01-web-reality-chain（不 push，由 Lead 决定 PR）。
