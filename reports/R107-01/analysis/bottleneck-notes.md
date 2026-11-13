# R107-01 180 分钟真实墙钟通关瓶颈分析（工作底稿）

> 本文件是 `reports/R107-01/README.md` 的支撑数据与推导底稿；最终结论以 README 为准。
> 数据来源全部为真实运行：R50 历史跑次（web/reports/_r50）、R104/R105 历史跑次（reports/R104、reports/R105）、
> R107 本轮真实新档跑次（reports/R107-01/run-180min）。未修改任何游戏时间源或进度字段。

## 1. 对照数据（同一判据：新档起算的真实墙钟秒）

### 1.1 历史完成跑次（R50 时期，2026-11-01，代码为当时 main）

来源：`web/reports/_r50/r50-fresh8.jsonl` + `r50-fresh8.summary.json`；零起点基线
`r50-newgame8.json` = hardReset 后 250ms 轮询抓到的最早帧：`rtp=6021ms / realities=0 / eternities=0 /
infinities=3 / normalBits=2 / speed=10000`。

| 里程碑 | 墙钟 (s) |
|---|---|
| 首次无限 | 9.6 |
| 首次永恒 | 19.6 |
| 首次现实 | 79.6 |
| V 解锁 | 394.6 |
| IU15 / 莱特拉 | 414.6 |
| IU25 / 佩勒 / doomed | 699.6 |
| **gameEnd（isEnd=true）** | **739.6** |

终态 `realities=100、iu15=iu25=pelle=doomed=true、end=1.104`。这是**旧代码在 10000×→40000× 速度下**
的真实完成证据，不是本轮数据，仅用于证明「180 分钟目标在机制上可达」。

### 1.2 当前 HEAD 主跑（R104 pass10，2026-11-13，源码 62f41e7 = 当前 1d1f7ae 的代码前身）

来源：`reports/R104/web/run-20261113-073558-pass10/summary.json`（clean 源码、全新 browser context）。

| 里程碑 | 墙钟 (s) |
|---|---|
| 首次无限 | 22.1 |
| 首次 Break | 52.0 |
| 首次永恒 | 522.2 |
| 首次时间研究 | 562.2 |
| 首次膨胀研究 dsN | 1812.1 |
| 首次现实 | 1852.1（realities 一次跳到 5） |
| 停止时（3032.2 s = 50.5 min） | realities=10、ecDone=5,5,0,…、ach147=false、teresa=false、无天神/Pelle、gameEnd=false |

### 1.3 本轮 R107 真实新档主跑

见 `reports/R107-01/run-180min/summary.json`（结果回填到 README）。

## 2. 直接对照：当前版本比 R50 慢多少

| 指标 | R50 fresh8 | R104 pass10 | 倍数 |
|---|---|---|---|
| 首次永恒 | 19.6 s | 522.2 s | 26.6× |
| 首次现实 | 79.6 s | 1852.1 s | 23.3× |
| 到终局 | 739.6 s | 50.5 min 仍未到（realities=10） | ≥4.1×（且链条未走完） |

## 3. 归因（代码/提交级，均可复核）

1. **统一节拍默认值 3 s → 10 s**（`29e48cf`，R85，2026-11-06；`src/core/oreki-smart-executor.js` 第 107 行）。
   R50 fresh8 跑在默认 3 s 上；当前为 10 s。单这一项约 3.3×。
2. **R96 目标驱动大坍缩（`a1cf8f8`/`cae9a53`）**：把「默认放行坍缩」改成「收益窗口内才放行」，
   并加入 30 s → 最长 10 min 的成长窗口。首次永恒前的 IP 主要靠坍缩循环积累，
   坍缩被按住 ⇒ 首次永恒从 19.6 s 量级变成 522 s 量级。
3. **R104 把模块内帧计数节流改成真实时间窗**（`62f41e7` RUN-NOTES §5 第 5/7 项：`_frame%30/%20` → 1 s/2 s；
   第 6 项 EC1 入口豁免、第 8 项现实重置后 adopt、第 9 项 TT 奖励上限 50→1e8）。
   这些修复解决了「节拍被放大」的卡死，但也意味着时间研究/EC/现实自动化最多 1~2 s 一次动作，
   而 R50 时期是每帧尝试（60 次/s 量级）。
4. **每拍最多 1 个真动作 + 默认 10 s**：R104 pass10 的 executor 记账（served/delta）显示
   routine/celestial/early/eternity 等任务按 10 s 节拍轮转；R50 没有这层统一队列。
5. **已排除的因子**：
   - 游戏速度：本轮/ R104 动态倍率 10000→100000，高于 R50 的 10000→40000，不是速度问题。
   - 存档不新：R107 主跑出生快照 `antimatter=10 / infinities=0 / realities=0 / endState=0`，storage 起点为空，判定 PASS。
   - CPU 争用：本次宿主 load average 25–31（其他 Agent 的 AVD/D8 负载），fps 低至 19–28；
     但首次永恒时间 524.3 s 与 pass10（60 fps）522.2 s 基本一致 ⇒ 游戏内时间按帧间差分积分，
     里程碑墙钟对 fps 不敏感；只有自动购买器每帧触发次数受 fps 影响（次要因子）。

## 4. 瓶颈清单（按对 180 分钟终局的影响排序）

| # | 瓶颈 | 观测证据 | 影响 |
|---|---|---|---|
| 1 | 首次现实前 30 min（1852 s，17.1% 预算）且首次永恒前 522 s | 1.2/1.3 表 | 消耗预算的 1/6，但只是一个阶段 |
| 2 | 现实循环吞吐：realities 5→10 用 1180 s（≈236 s/现实） | pass10 | 现实/碎片是现实升级与符文链的燃料；按此速率 100 现实需 >6 h |
| 3 | 现实后 EC 链重建停滞：50.5 min 时 ecDone=5,5,0…（只完成 EC1/2） | pass10 | EC 12×5 是 TimeStudy.reality / 膨胀研究 6 的前置；不重建则现实升级买不齐 |
| 4 | 成就 147（买齐全部一次性现实升级）未达成 ⇒ 特蕾莎未解锁 | pass10 ach147=false/teresa=false | 天神链起点，未解锁 ⇒ Effarig/Enslaved/V/Ra/Laitela/Pelle 全部不可达 |
| 5 | 天神/莱特拉/佩勒链从未在真实新档跑通（R104 16 个跑次最远 realities=10） | R104 RUN-NOTES §6 | 终局判据 `records.totalAntimatter ≥ 1e1000` 完全没有运行期证据 |
| 6 | 统一节拍默认 10 s 与 R50 的 3 s / Android 的阶段化 1~10 s 不一致 | §3.1；Android FacTS §128 OrekiBeatStrategy | 前期推进被节拍限制，属于可直接测量的可调项 |

## 5. 可执行改进建议（按性价比）

1. **先做可控 A/B**：同一新档，仅把「智能自动操作间隔」设为 1 秒（玩家可配范围 1~60 s 内），
   对照默认 10 s 的里程碑时间。本轮已启动 `reports/R107-01/run-interval1/`。
   若首次现实/首次永恒显著提前，说明节拍是主因之一；否则瓶颈在坍缩策略与现实循环。
2. **对齐 Android 的阶段化节拍**（`OrekiBeatStrategy`：早期 1 s / 无限 2 s / 无限维度 3 s / 永恒 5 s / 终局 10 s）。
   Web 目前固定默认 10 s，是双端实现差异；改成阶段化默认值需要同步教程 JSON/生成模块并重跑验收。
3. **重新评估首次永恒前的坍缩等待窗口**：目标驱动策略的成长窗口 30 s→10 min 在首次永恒前收益不明确，
   建议用 R50 的 19.6 s 作为「可达到性上界」做对照实验（仅实验分支，不改生产）。
4. **现实循环专项**：先修 EC 链重建（P0 #9 同类）与现实自动化吞吐，再谈 100 现实；
   在 realities=10 状态下，EC 链每卡住 1 个 EC，现实升级链就少一条。
5. **为 180 分钟门禁增加分段预算**（建议）：首次现实 ≤ 15 min、EC 12×5 + ds6 ≤ 25 min、
   特蕾莎/鹿颈长/无名氏 ≤ 45 min、IU15→IU25→Pelle ≤ 60 min、Pelle 终局 ≤ 35 min。
   当前首次现实 30.9 min 已超第一段预算 2×。
6. **跑次取证固化**：把首次现实/ach147/Teresa/IU15/IU25/doomed/gameEnd 写进 runner 的 events/summary，
   每轮 180 分钟门禁用同一判据（`player.isGameEnd` 首次 true）。


## 6. 本轮 A/B 受控实验（间隔 1 秒 vs 默认 10 秒）

运行器：`runner/run-ab-interval1.mjs`，与主跑同一源码/同一浏览器/同一手机视口；
唯一变量是启动时通过**真实 UI**（选项→游戏玩法→输入 1→应用间隔）把「智能自动操作」间隔从默认 10 s 改为 1 s，
并记录 `[ab] 调度间隔请求=1 结果={"path":"ui-real-click","applied":1,"attempt":0} 存储=1`。

| 里程碑 | 默认 10 s（run-180min） | 间隔 1 s（run-interval1） | 加速 |
|---|---|---|---|
| 首次无限 | 24.4 s | 6.1 s | 4.0× |
| 首次 Break | 54.3 s | 16.1 s | 3.4× |
| 首次永恒 | 524.3 s | 96.1 s | 5.5× |
| 首次现实时间研究 (ds6) | 2014.4 s | 256.1 s | 7.9× |
| 首次现实 (realities≥1) | ~待最终（>2019 s） | 296.2 s | ≥6.8× |
| 5 现实 | — | 296.2 s | — |
| 现实升级 RU10 | — | 316.2 s | — |

补充：默认跑次在 1994–2014 s 才拿到首个膨胀研究/现实时间研究；A/B 在 256 s 就拿到。
A/B 的游戏速度为 10000×（动态升档未触发，因为进度一直在变），默认跑次已升到 100000×，
即 A/B 在**游戏内时间少 10 倍**的情况下，真实墙钟仍快约 7 倍 ⇒ 节拍（10 s→1 s）是数量级级别的主因。


## 7. A/B 终态（60 min 上限）

- 目录 `reports/R107-01/run-interval1/`；停止于 wall 3596.2 s，`result=FAIL`（60 min 上限内未 gameEnd）。
- 终态：`realities=15`、`epLog10=3683.25`、`maxEpExponent=3683`、`ecDone=12×5`、`dsN=5`、`ds6=false`、
  `ruBought=18`、`glyphs=15`、`teresa=false`、`pelleUnl=false`。
- EP 墙：wall 649.2→3599.3 s（2950.1 s）EP log10 仅在 3683.25/3683.63 两值间；`isRealityAvailable()`
  要求 `thisReality.maxEP.exponent >= 4000`（`src/core/reality.js:120`）。
- 结论：节拍 1 s 只能解决前段速度，**不能越过 EP e4000 门**；180 min 门禁当前被这一结构性门槛阻断。


## 8. 主跑 180 分钟终态（默认 10 s）

- 目录 `reports/R107-01/run-180min/`；wall 10794.3 s 停止，`result=FAIL`（180 min 上限内未 gameEnd）。
- 终态：`realities=15`（wall 3969.4 s 达到）、`epLog10=3683.25`、`maxEpExponent=3683`、`ecDone=12×5`、
  `dsN=5`、`ds6=false`、`teresa=false`、`pelleUnl=false`、`gameEnd=false`、`endState=0`。
- EP 墙：wall 4909.4→10799.5 s（**5890.1 s = 98.2 分钟**）EP log10 仅在 3683.25/3683.26/3683.63。
- 与 A/B 完全同构：两轮独立真实新档都卡在 EP e4000 门槛 ⇒ 这是**与节拍无关的结构性阻断**，
  是当前 180 分钟门禁的第一优先级修复项。
