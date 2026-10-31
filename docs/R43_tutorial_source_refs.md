# R43 教程「关键数值」溯源台账

> 本文件是**开发用**台账，不进入任何玩家可见界面。
> 2026-10-31 R43：玩家反馈教程里出现 `src/core/speed-config.js:32` 这类源码路径，
> 属于开发者信息；已从 `src/core/oreki-tutorial-data.json` 的 `numbers[].src` 字段整体移除，
> 原值原样迁到这里，供后续核对数值时反查。
> 生成方式：`python web/_tools/_r43/rewrite_tutorial_content.py`（脚本内 `strip_src()`）。

共 170 条。

| 章节 | 数值项 | 值 | 原溯源 |
|---|---|---|---|
| ch00 | 默认速度倍率 | 10000× | `src/core/speed-config.js:32 GAME_SPEED_DEFAULT` |
| ch00 | 倍率可调区间 | 1× ~ 100000× | `src/core/speed-config.js:33 / :44` |
| ch00 | 倍率保存位置 | 浏览器本地，不进存档 | `src/core/speed-config.js:134 GameSpeed` |
| ch00 | 天神页签解锁条件 | 成就 147 | `src/core/celestials/teresa.js:12` |
| ch00 | 毁灭现实（佩勒）解锁条件 | 买下虚幻升级 25 | `src/core/celestials/pelle/pelle.js:121-123` |
| ch01 | 初始反物质 | 10 | `src/core/player.js:12` |
| ch01 | 第 1~4 维度基础成本 | 10 / 100 / 1e4 / 1e6 反物质 | `src/core/dimensions/antimatter-dimension.js:345` |
| ch01 | 每买 10 个的价格倍率（第 1~4 维度） | ×1e3 / ×1e4 / ×1e5 / ×1e6 | `src/core/dimensions/antimatter-dimension.js:347` |
| ch01 | 计数频率基础成本 / 每次涨价 | 1000 反物质 / ×10 | `src/core/tickspeed.js:154-158` |
| ch01 | 每次计数频率的加速 | 每秒时刻数 ×1.1245 | `src/core/tickspeed.js:41-46` |
| ch01 | 计数频率解锁条件 | 第 2 维度买到 1 个 | `src/core/tickspeed.js:123-126` |
| ch01 | 第 1 次维度提升需求 | 20 个第 4 维度 | `src/core/dimboost.js:100-107` |
| ch01 | 维度提升加成 | ×2（第 1 次只作用于第 1 维度） | `src/core/dimboost.js:22-23, :42-47` |
| ch01 | 第 5 维度解锁条件 | 维度提升 ≥ 1 次 | `src/core/dimensions/antimatter-dimension.js:535-540` |
| ch02 | 第 5~8 维度基础成本 | 1e9 / 1e13 / 1e18 / 1e24 反物质 | `src/core/dimensions/antimatter-dimension.js:345` |
| ch02 | 每买 10 个的价格倍率（第 5~8 维度） | ×1e8 / ×1e10 / ×1e12 / ×1e15 | `src/core/dimensions/antimatter-dimension.js:347` |
| ch02 | 第 2~5 次维度提升需求 | 各 20 个（第 5 / 6 / 7 / 8 维度） | `src/core/dimboost.js:100-107` |
| ch02 | 第 6 次起每级增量 | 每级 +5 个第 8 维度（原版 +15） | `src/core/dimboost.js:110-126` |
| ch02 | 维度献祭解锁条件 | 维度提升 ≥ 5 次 | `src/core/sacrifice.js:11` |
| ch02 | 献祭倍率公式 | (log10(第 1 维度数量) / 上次献祭时的同一数值)²，最低 1× | `src/core/sacrifice.js:72-90` |
| ch02 | 第 1 个反物质星系需求 | 第 1 个 80 个第 8 维度，之后每个 +60（80 / 140 / 200 / 260 / 320） | `src/core/galaxy.js:43, :69-75` |
| ch02 | 星系对计数频率的效果 | 前两个各把基线抬到 1/1.11888888、1/1.11267177，第 3 个起按 0.965^(星系数−2) × 0.8 | `src/core/tickspeed.js:41-64` |
| ch02 | 买星系的副作用 | 维度提升次数清零（成就 143 之前） | `src/core/galaxy.js:125-127` |
| ch03 | 大坍缩门槛 | 1.7976931348623157e308（= Number.MAX_VALUE） | `src/core/player.js:985-988 + modules/break_infinity.js:1546` |
| ch03 | 未打破无限时的单次坍缩收益 | 308 ÷ 30 ≈ 10.27，取整后乘 IP 倍率（首次约 10 IP） | `src/game.js:139-143, :176` |
| ch03 | 打破无限后的单次坍缩收益 | 10^(log10(本纪最高反物质)/30 − 0.75) × IP 倍率 | `src/game.js:141` |
| ch03 | 首次无限实测时刻 | t = 4 秒（默认 10000×、纯生产自动化） | `web/_tools/_r21-300.jsonl（milestone 首次无限）` |
| ch03 | 首次无限后解锁的自动购买器 | 5 个（维度 / 计数频率 / 维度提升 / 星系 / 大坍缩） | `src/core/autobuyers/big-crunch-autobuyer.js:11-25` |
| ch04 | 一次性无限升级成本 | 1 / 2 / 3 / 5 / 7 / 10 / 20 / 40 / 80 / 300 / 1000 IP | `src/core/secret-formula/infinity/infinity-upgrades.js:16-330` |
| ch04 | 「无限点数 ×2」第 n 次价格 | 10^n IP（第 1 次 10 IP），每次把 IP 收入 ×2 | `src/core/infinity-upgrades.js:136-158` |
| ch04 | 大坍缩自动器初始间隔 / 升级成本 | 150000 毫秒 / 1 IP 起，每级 ×2 | `src/core/player.js:82-83 + src/core/autobuyers/autobuyer.js:169-177` |
| ch04 | 间隔每级缩短 | ×0.6（下限 100 毫秒） | `src/core/autobuyers/autobuyer.js:165-183` |
| ch04 | 拉满间隔的级数与总花费 | 15 级，合计 32767 IP | `src/core/oreki-break-infinity-gate.js:58-64` |
| ch04 | 普通挑战 10~12 解锁条件 | 完成 16 次无限 | `src/core/secret-formula/challenges/normal-challenges.js:105-124` |
| ch04 | 实测：首次无限 → 打破无限 | t = 4 s → t = 5 s | `web/_tools/_r21-300.jsonl（milestone 首次无限 / Break）` |
| ch05 | 大坍缩自动器初始间隔 | 150000 毫秒 | `src/core/player.js:81-83` |
| ch05 | 每级间隔变化 | ×0.6，下限 100 毫秒 | `src/core/autobuyers/autobuyer.js:169-177` |
| ch05 | 拉满需要的级数 | 15 级（150000×0.6^14 ≈ 117.5 仍未到 100，第 15 级落到 70.5 被下限截成 100） | `src/core/oreki-break-infinity-gate.js:46-51` |
| ch05 | 单级价格序列 | 1、2、4、…、16384 无限点数（每级 ×2） | `src/core/autobuyers/autobuyer.js:172` |
| ch05 | 拉满累计成本 | 32767 无限点数（= 2^15 − 1） | `src/core/oreki-break-infinity-gate.js:51` |
| ch05 | 间隔拉满的判据 | 大坍缩自动器 interval ≤ 100 毫秒 | `src/core/autobuyers/autobuyer.js:165-167` |
| ch05 | 打破无限前置条件 | 大坍缩自动器间隔 ≤ 100 毫秒 | `src/game.js:95` |
| ch05 | 打破无限时免费做的事 | 所有自动购买器间隔直接拉满 | `src/game.js:97-99` |
| ch05 | 打破无限升级数量 | 12 个（9 个一次性 + 3 个可重复） | `src/core/secret-formula/infinity/break-infinity-upgrades.js:29-146` |
| ch05 | 最便宜的打破无限升级 | 1e4 无限点数（基于总反物质的维度加成） | `src/core/secret-formula/infinity/break-infinity-upgrades.js:30-36` |
| ch05 | 最贵的打破无限升级 | 1e15 无限点数（自动购买器速度加倍） | `src/core/secret-formula/infinity/break-infinity-upgrades.js:98-102` |
| ch05 | 实测：打破无限发生的时刻 | t = 5 秒（首次无限后 1 秒） | `web/_tools/_r21-300.jsonl（milestone Break）` |
| ch05 | 打破无限后无限点数尺度 | 10^(log10(本纪最高反物质)/30 − 0.75) × 无限点数倍率 | `src/game.js:149-163` |
| ch05 | 3 个可重复的打破无限升级的等级与涨幅 | 计数频率成本增速 8 级（每级 ×5）/ 维度成本增速 7 级（每级 ×5e3）/ 无限点数自动生成 10 级（每级 ×10） | `src/core/secret-formula/infinity/break-infinity-upgrades.js:104-136` |
| ch06 | 无限维度解锁阈值（本纪最高反物质） | 1e1100 / 1e1900 / 1e2400 / 1e10500 / 1e30000 / 1e45000 / 1e54000 / 1e60000 | `src/core/dimensions/infinity-dimension.js:41-50` |
| ch06 | ID1 额外门槛与基础成本 | IP ≥ 1e8；成本 1e8 IP，每买一次 ×1e3 | `src/core/dimensions/infinity-dimension.js:53-59` |
| ch06 | 无限挑战解锁阈值 | 1e2000 / 1e11000 / 1e12000 / 1e14000 / 1e18000 / 1e22500 / 1e23000 / 1e28000 | `src/core/secret-formula/challenges/infinity-challenges.js:14, 26, 43, 56, 69, 84, 107, 123` |
| ch06 | 无限挑战目标 | 1e650 / 1e10500 / 1e5000 / 1e13000 / 1e16500 / 2e22222 / 1e10000 / 1e27000 | `src/core/secret-formula/challenges/infinity-challenges.js:7, 19, 32, 49, 62, 75, 100, 113` |
| ch06 | 复制器解锁价 | 1e140 IP | `src/core/replicanti.js:511-521` |
| ch06 | IP 换算尺度（现实解锁前） | 30（原版 308） | `src/game.js:102, :139` |
| ch06 | 实测：ID1~ID8 全解锁时刻 | t = 10 秒（默认 10000×、纯生产自动化） | `web/_tools/_r21-300.jsonl（milestone ID1-8 全解锁）` |
| ch06 | 无限维度基础成本与涨幅 | 1e8 / 1e9 / 1e10 / 1e20 / 1e140 / 1e200 / 1e250 / 1e280 IP；涨幅 1e3 / 1e6 / 1e8 / 1e10 / 1e15 / 1e20 / 1e25 / 1e30 | `src/core/dimensions/infinity-dimension.js:53-58` |
| ch07 | 复制器解锁价 | 1e140 IP（一次性扣款） | `src/core/replicanti.js:519-529` |
| ch07 | 复制器初始状态 | 数量 1 / 复制概率 1% / 结算间隔 1000 毫秒 | `src/core/replicanti.js:503-511` |
| ch07 | 间隔升级 | 1e140 IP 起，每级 ×1e10，间隔 ×0.9，下限 50 毫秒 | `src/core/replicanti.js:394, :406-408` |
| ch07 | 概率升级 | 1e150 IP 起，每级 ×1e15，每级 +1%，上限 100% | `src/core/replicanti.js:343, :347-352` |
| ch07 | 复制器倍率公式 | log2(复制器数量)²，乘到无限维度上 | `src/core/replicanti.js:266-272` |
| ch07 | 复制器星系门槛 | 复制器数量 ≥ 1.797e308 才能买，买后清零（成就 126 之前） | `src/core/replicanti.js:553-556, :34-47` |
| ch07 | 永恒判据 | 本纪最高 IP ≥ 1.7976931348623157e308 | `src/core/player.js:965-967 + src/game.js:397-400` |
| ch07 | 首次永恒 EP 收益 | 约 4.9e6（5^(log10(1.797e308)/30 − 0.7)，EP 倍率 1） | `src/game.js:379-381` |
| ch07 | 复制器自动器所需的永恒次数 | 星系 3 次 / 概率 50 次 / 间隔 60 次 / 星系上限 80 次 | `src/core/secret-formula/eternity/eternity-milestones.js:11-13, :123-140` |
| ch08 | TT 的 EP 价格 | 1 × 2^已用 EP 购买次数（第 1 个 1 EP，第 n 个 2^(n−1) EP） | `src/core/time-theorems.js:100-107` |
| ch08 | TT 的 IP / 反物质价格 | IP：1 × 1e100^n；反物质：1e20000 × 1e20000^n | `src/core/time-theorems.js:70-91` |
| ch08 | 买 TT 的硬前置 | 必须已买过至少 1 个时间维度 | `src/core/time-theorems.js:111-114` |
| ch08 | 时间维度 1~4 的解锁 | tier < 5 直接可买，5~8 需要对应时间研究 | `src/core/dimensions/time-dimension.js:185-187` |
| ch08 | 膨胀研究 1 的门槛 | 时间之理总数 12900 + 永恒挑战 11/12 各 5 次 | `src/core/time-studies/dilation-time-study.js:72-74 + src/components/tabs/time-studies/DilationTimeStudy.js:33` |
| ch08 | TT 数量与 EP 的关系 | TT ≈ log2(累计 EP)；12900 TT 对应约 1e3883 EP（2^12900） | `src/core/time-theorems.js:100-107` |
| ch08 | 自动化买研究的时间间隔 | 每 30 帧一轮（STUDY_TICK_INTERVAL） | `src/core/oreki-eternity-automation.js:42` |
| ch08 | 自动永恒的触发条件 | 本次 EP 收益 ≥ 当前 EP × 10 才重置 | `src/core/oreki-eternity-automation.js:590-592` |
| ch09 | 每关完成次数上限 | 5 次（无名氏运行中 EC1 单独放宽到 1000 次） | `src/core/eternity-challenge.js:82-84` |
| ch09 | 12 关研究价（时间之理） | 30 / 35 / 40 / 70 / 130 / 85 / 115 / 115 / 415 / 550 / 1 / 1 | `src/core/secret-formula/eternity/time-studies/ec-time-studies.js:6,18,30,42,54,66,78,90,102,114,126,136` |
| ch09 | 每关购买前要补齐的普通研究 | 171,171,171,143,42,121,111,123,151,181,181,181 | `src/core/time-studies/ec-time-study.js:55-61` |
| ch09 | EC11 与 EC12 的额外补买 | EC11 补 191，EC12 补 193 | `src/core/time-studies/ec-time-study.js:66-72` |
| ch09 | EC11 禁用分叉研究 | 72、73 | `src/core/secret-formula/eternity/time-studies/ec-time-studies.js:131` |
| ch09 | EC12 禁用分叉研究 | 71、72 | `src/core/secret-formula/eternity/time-studies/ec-time-studies.js:141` |
| ch09 | 两条分叉的互斥条件 | 71 要求 EC12 未解锁；73 要求 EC11 未解锁 | `src/core/secret-formula/eternity/time-studies/normal-time-studies.js:146,190` |
| ch09 | 引导窗口内入口资源缩放 | ÷100（现实未解锁，或本次现实还没买回膨胀研究 6 时生效） | `src/core/time-studies/ec-time-study.js:10,119-125` |
| ch09 | EC1 入口资源 | 永恒次数 20000（窗口内 200），每次完成 +20000 | `src/core/secret-formula/eternity/time-studies/ec-time-studies.js:12` |
| ch09 | EC2 入口资源 | 来自时间维度的计数频率升级 1300（窗口内 13），每次完成 +150 | `src/core/secret-formula/eternity/time-studies/ec-time-studies.js:24` |
| ch09 | EC3 入口资源 | 第八维度 17300（窗口内 173），每次完成 +1250 | `src/core/secret-formula/eternity/time-studies/ec-time-studies.js:36` |
| ch09 | EC7 入口资源 | 反物质 1e500000（窗口内 1e499998），每次完成 ×1e300000 | `src/core/secret-formula/eternity/time-studies/ec-time-studies.js:84` |
| ch09 | EC12 单次限时 | 1.0 / 0.8 / 0.6 / 0.4 / 0.2 秒（每次完成收紧 0.2 秒） | `src/core/secret-formula/challenges/eternity-challenges.js:188` |
| ch09 | EC4 无限次数上限 | 16 / 12 / 8 / 4 / 0 次（每次完成减 4） | `src/core/secret-formula/challenges/eternity-challenges.js:52` |
| ch09 | 181 的挑战前置 | EC1、EC2、EC3 各完成至少 1 次 | `src/core/secret-formula/eternity/time-studies/normal-time-studies.js:463-468` |
| ch09 | 191 与 193 的挑战前置 | EC10 完成至少 1 次 | `src/core/secret-formula/eternity/time-studies/normal-time-studies.js:477,494` |
| ch09 | 现实重置清空内容 | player.eternityChalls = {}（全部 EC 次数归零） | `src/core/reality.js:651` |
| ch09 | 进入即完成的补次数位置 | while (!challenge.isFullyCompleted) challenge.addCompletion(false) | `src/core/oreki-instant-challenges.js:158-160` |
| ch10 | 膨胀研究 1 的成本 | 5000 TT，本 MOD 现实前 ÷1000 → 5 TT | `src/core/secret-formula/eternity/time-studies/dilation-time-studies.js:1-19 + src/core/time-studies/dilation-time-study.js:14, :50` |
| ch10 | 膨胀研究 1 的三个条件 | 累计 TT ≥ 12900、231~234 任一已买、EC11 与 EC12 各 5 次 | `src/core/secret-formula/eternity/time-studies/dilation-time-studies.js:5-19` |
| ch10 | 膨胀研究 2~5 的成本（解锁 TD5~TD8） | 1e6 / 1e7 / 1e8 / 1e9 TT → ÷1000 = 1000 / 1e4 / 1e5 / 1e6 TT | `src/core/secret-formula/eternity/time-studies/dilation-time-studies.js:21-58` |
| ch10 | 膨胀研究 6（现实）的成本与要求 | 1 TT；要求 TD8 已买 + 本纪最高 EP 指数 ≥ 4000（成就项在 EC11/12 满 5 次后豁免） | `src/core/secret-formula/eternity/time-studies/dilation-time-studies.js:44-55, :59-70, :81-86` |
| ch10 | 超光速粒子公式 | (log10(反物质) / 400)^1.5 × TP 倍数 | `src/core/dilation.js:168-181` |
| ch10 | 膨胀惩罚 | 产量按 0.75 次方压缩（dilatedValueOf） | `src/core/dilation.js:216-220` |
| ch10 | 膨胀升级 DU1~DU3 的成本 | 1e4 ×10 / 1e6 ×100 / 1e7 ×20（DT） | `src/core/secret-formula/eternity/dilation-upgrades.js:26-37, :75-86, :112-123` |
| ch10 | 自动化压现实的门槛 | 本纪最高膨胀时间 ≥ 1e30 才放开现实 | `src/core/oreki-dilation-automation.js:33-40` |
| ch11 | 现实解锁条件 | 时间维度 8 已买 + 本纪最高 EP 指数 ≥ 4000 + 膨胀研究 6（1 TT，成就项可用豁免） | `src/core/secret-formula/eternity/time-studies/dilation-time-studies.js:45-55 + src/core/reality.js:119-121` |
| ch11 | 现实按钮的实时判据 | maxEP.exponent ≥ 4000 且 TimeStudy.reality.isBought（两条，不含成就） | `src/core/reality.js:119-121` |
| ch11 | 现实机器公式 | RM = 3^(log10(EP)/4000 − 1)，EP 指数 4000 时 1 RM、5333 时 10 RM | `src/core/machines.js:26-41` |
| ch11 | 低 RM 段的线性替换 | 1 ≤ RM < 10 时改用 27/4000 × log10(EP) − 26，再向下取整 | `src/core/machines.js:33-41` |
| ch11 | 首次现实前的 EP 折减 | log10(EP) 超过 8000 按 8000 封顶；超过 6000 的部分只按 25% 计入 | `src/core/machines.js:29-33` |
| ch11 | 符文槽数量 | 3 + RU9 + RU24，即五条形态升级拿满后是 5 个 | `src/core/glyphs/glyph-core.js:66-72` |
| ch11 | 基础符文类型 | 力量 / 无限 / 复制 / 时间 / 膨胀（5 种；鹿颈长、现实、诅咒、同伴不属于基础类型） | `src/core/constants.js:324-330 + src/core/constants.js:517-526` |
| ch11 | 现实升级价格 | RU1/RU2 = 1 RM 起、RU3/RU4 = 2 RM 起、RU5 = 3 RM 起（×30/×50）；RU6~RU10 = 15 RM；RU11~RU15 = 50 RM；RU16~RU20 = 1500 RM；RU21~RU25 = 100000 RM | `src/core/secret-formula/reality/reality-upgrades.js:29-65 + src/core/secret-formula/reality/reality-upgrades.js:100-190 + src/core/secret-formula/reality/reality-upgrades.js:239-390` |
| ch11 | RU9 词域扩张的形态要求 | 恰好装备 1 个等级 ≥3 的符文，并在一次永恒后 EP 指数 ≥ 4000；装第二个符文或装 <3 级的单符文会永久锁死 | `src/core/secret-formula/reality/reality-upgrades.js:123-140` |
| ch11 | RU24 合成之象的形态要求 | 装备 0 个非同伴符文，且本次现实可得 RM ≥ 5000；只要在某次现实结算时装着符文就永久锁死 | `src/core/secret-formula/reality/reality-upgrades.js:373-385` |
| ch11 | RU25 轻松现实的门槛 | 100000 RM；最佳 EP 指数 ≥ 11111 | `src/core/secret-formula/reality/reality-upgrades.js:387-397` |
| ch11 | 自动现实的节奏 | 首次立即；之后现实升级未买齐 8 s 一次，买齐 15 s 一次；最短间隔 2000 ms | `src/core/oreki-reality-automation.js:33-36, :156-160` |
| ch12 | 复兴点数每次现实的收益 | 本次现实倍数 × clamp(现实次数^(1/3), 1, 20)，向下取整 | `src/core/reality.js:305-318` |
| ch12 | 复兴点数的档位 | 第 1 次 1 点、第 8 次 2 点、第 27 次 3 点、第 64 次 4 点、第 1000 次 10 点、8000 次封顶 20 点 | `src/core/reality.js:318` |
| ch12 | 单个复兴节点的价格 | 固定 1 复兴点数；只能买与已买节点相邻的 | `src/core/perks.js:32-38` |
| ch12 | 自动机解锁门槛 | 自动点数 ≥ 100 | `src/core/player.js:1001-1003` |
| ch12 | 自动点数的来源 | 每次现实 +2（封顶 50 次 = 100 点）；黑洞解锁 +10；RU10 +15；RU25 +100 | `src/core/secret-formula/reality/automator.js:540-552` |
| ch12 | 黑洞解锁价格 | 100 RM，手动点击，无自动解锁 | `src/core/black-hole.js:338-352` |
| ch12 | 第一个黑洞的初始参数 | 间隔 3600 秒、持续 10 秒、强度 180 倍（占空比 0.28%） | `src/core/black-hole.js:64-103` |
| ch12 | 黑洞三种升级的起始价与倍率 | 间隔 15 RM 起（价格 ×3.5，间隔 ×0.8）；强度 20 RM 起（价格 ×2，强度 ×1.35）；持续 10 RM 起（价格 ×4，持续 ×1.3） | `src/core/black-hole.js:68-103` |
| ch12 | 第二个黑洞的造价 | 三种升级的起始价格全部 ×1000，间隔从 360 秒起 | `src/core/black-hole.js:66-68` |
| ch12 | 黑洞变成永久启动的判据 | 占空比 = 持续 /（持续 + 间隔）≥ 0.9999 | `src/core/black-hole.js:223-225` |
| ch12 | 第二个黑洞的解锁来源 | 买下 RU20 奇点宇称（1500 RM）时，如果黑洞 1 已解锁就同时解锁黑洞 2 | `src/core/reality-upgrades.js:176-186` |
| ch13 | 特蕾莎的解锁条件 | 成就 147「现实专精」：购买所有的现实升级（RU1~RU25） | `src/core/secret-formula/achievements/normal-achievements.js:1070-1076` |
| ch13 | 向特蕾莎投入的速率 | min((已投入 + 1e6) × 0.01 × 投入时长², 当前 RM)，投入时长按真实秒累积 | `src/core/celestials/teresa.js:14-21` |
| ch13 | 投入上限 | 1e24（到顶后不再扣 RM） | `src/core/celestials/teresa.js:9` |
| ch13 | 特蕾莎给的 RM 倍率 | max(250 × (已投入/1e24)^0.1, 1)：投 1e6 时 ×3.95，投满 ×250 | `src/core/celestials/teresa.js:47-49` |
| ch13 | 特蕾莎的六档解锁价格 | 1e6 开局全永恒升级 / 1e10 撤销符文 / 1e14 特蕾莎的现实 / 1e18 自动 EP / 1e21 复兴商店 / 1e24 鹿颈长 | `src/core/secret-formula/celestials/teresa.js:2-41` |
| ch13 | 遗迹碎片公式 | floor((EP 指数 / 30)^已装备符文词条数) × 炼金鹿颈长倍率；除数原版 7500 已缩到 30 | `src/core/celestials/effarig.js:191-194` |
| ch13 | 鹿颈长解锁位的实际价格 | 权重调节 10 / 符文筛选 200 / 配置保存 3000 / 现实 5e5（原版 1e7 / 2e8 / 3e9 / 5e11 统一 ÷1e6） | `src/core/celestials/effarig.js:255-259 + src/core/secret-formula/celestials/effarig.js:2-40` |
| ch13 | 鹿颈长三阶段的解锁动作 | 大坍缩 → 无限阶段；永恒 → 永恒阶段；现实 → 现实阶段（鹿颈长符文） | `src/core/big-crunch.js:150-151 + src/core/eternity.js:58-59 + src/core/reality.js:355-356` |
| ch13 | 无名氏的解锁条件 | 鹿颈长的「永恒」阶段解锁即出现，不需要另外做提示收集 | `src/core/celestials/enslaved.js:178-180` |
| ch14 | 薇的六项解锁条件 | 现实次数 ≥ 60、永恒次数 ≥ 1e70、无限次数 ≥ 1e160、本纪最高膨胀时间 ≥ 1e30、本纪最高复制器 ≥ 1e20000、当前现实机器 ≥ 1e60 | `src/core/secret-formula/celestials/v.js:65-67 + src/core/secret-formula/celestials/v.js:69-120` |
| ch14 | 现实次数门槛的 MOD 缩放 | 原版 10000 → 本作 60（OREKI_V_UNLOCK_REALITIES） | `src/core/secret-formula/celestials/v.js:65` |
| ch14 | 空间定理的计算 | 前六项运行解锁的档数之和 + 后三项档数 × 2 | `src/core/celestials/V.js:189-196` |
| ch14 | 太阳神的解锁条件 | 空间定理 ≥ 36（前六项各打满 6 档正好 36） | `src/core/celestials/ra/ra.js:366-368` |
| ch14 | 太阳神宠物等级上限 | 单只 25 级，共四只；总等级到 20 解锁「追忆」 | `src/core/celestials/ra/ra.js:326-333 + src/core/celestials/ra/ra.js:237-243` |
| ch14 | 宠物单级记忆需求 | floor((L + L²/10)^5.52 × 1.5^max(0, L−15) × 2500)，尾乘 2500 是本作从原版 1e6 缩下来的 | `src/core/celestials/ra/ra.js:304-309` |
| ch14 | 无名氏现实的入场券 | 1e40 年储藏时间，且历史最佳符文等级 ≥ 5000、历史最佳符文稀有度 ≥ 100 | `src/core/celestials/enslaved.js:13-25` |
| ch15 | 莱特拉的解锁条件 | IU15「消解存在」已买，价格 1e9 IM | `src/core/celestials/laitela/laitela.js:36-38` |
| ch15 | IU15 的达成条件 | 本现实内 maxID1 = 0（从未买第一无限维度）且反物质指数 ≥ 1e8 | `src/core/secret-formula/reality/imaginary-upgrades.js:206-217` |
| ch15 | 熵的增长公式 | clamp((log10(反物质)/2e7)², 0, 100)/200，每秒最多 0.5；熵从 0 到 1 即完成 | `src/core/celestials/laitela/laitela.js:81-83 + src/core/celestials/laitela/laitela.js:30` |
| ch15 | 难度层级与可用维度 | 完成时真实用时 < 30 秒则层级 +1；可用普通维度层数 = 8 − 层级，到 0 即「完全不稳定」；源码无额外上限判断 | `src/game.js:1138-1140 + src/core/celestials/laitela/laitela.js:53-55` |
| ch15 | 暗物质维度层数 | 4 层，分别由 IU15 / IU16 / IU17 / IU18 解锁 | `src/core/celestials/laitela/dark-matter-dimension.js:26-39 + src/core/celestials/laitela/dark-matter-dimension.js:223` |
| ch15 | 暗物质维度的升级价格 | 间隔 10 DM 起、价格 ×5、间隔 ×0.92、最低压到 10 秒；暗物质强度 10 DM 起、价格 ×10；暗能量强度 10 DE 起、价格按层 ×1.65/×1.6/×1.55/×1.5；四层起始价分别是 10 / 10×1200² / 10×1200⁵ / 10×1200¹³ | `src/core/celestials/laitela/dark-matter-dimension.js:6-19 + src/core/celestials/laitela/dark-matter-dimension.js:109-112` |
| ch15 | 飞升的收益与判据 | 间隔压到 10 秒下限才能飞升；每次 +500 暗物质强度、+500 暗能量强度；飞升后把买得起的间隔升级一次性重买 | `src/core/celestials/laitela/dark-matter-dimension.js:13-16, :215-221, :163` |
| ch15 | 符文炼金的解锁门槛 | 太阳神的鹿颈长宠物到 2 级（不是 IU15，也不随莱特拉解锁） | `src/core/secret-formula/celestials/ra.js:112-117 + src/components/tabs/glyphs/sidebar/GlyphFilterPanel.js:78` |
| ch15 | 炼金资源数量 | 21 种；前 5 种与五类基础符文同名（力量 / 无限 / 时间 / 复制 / 膨胀），第 6 种是「基数」，鹿颈长对应第 11 种；能解锁多少种由鹿颈长等级决定 | `src/core/secret-formula/celestials/alchemy.js:8-439` |
| ch15 | 奇点的冷凝上限与收益 | 上限 = 200 × 10^扩容次数（扩容最多 50 次）；收益 = floor(11^扩容次数 × 奇点倍率 × (1+IU10)) | `src/core/celestials/laitela/singularity.js:218-230` |
| ch16 | IU25 的价格 | 5e9 IM（本作从原版 1.6e15 缩放） | `src/core/secret-formula/reality/imaginary-upgrades.js:354-358` |
| ch16 | IU25 的达成条件 | 在莱特拉的现实中、maxAllowedDimension = 0、装备的非同伴符文 ≤ 1、时间研究「解锁现实」已买，并完成这一次现实 | `src/core/secret-formula/reality/imaginary-upgrades.js:359-366` |
| ch16 | 佩勒的解锁条件 | IU25 已买 | `src/core/celestials/pelle/pelle.js:121-123` |
| ch16 | 佩勒的裂隙数量 | 5 个：空洞 / 枯朽 / 混沌 / 轮回 / 悖论，各有三级演化 | `src/core/secret-formula/celestials/rifts.js:6-190` |
| ch16 | 末日的触发条件 | 遗烬收益 ≥ 1 | `src/core/celestials/pelle/pelle.js:145-152` |
| ch16 | 遗烬收益公式 | ((log10(总反物质+2) + log10(总无限点数+2) + log10(总永恒点数+2)) / 1.64)^7.5 − 已持有遗烬 | `src/core/celestials/pelle/pelle.js:271-287` |
| ch16 | 终局判据 | endState = (log10(log10(总反物质)+1) − 1) / (log10(1001) − 1) ≥ 1，等价于反物质指数 ≥ 1000 | `src/core/celestials/pelle/game-end.js:75-97` |
| ch16 | 终局目标的缩放 | 反物质指数目标 = 1e3（OREKI_PELLE_END_TARGET_EXP），偏移 = 1（OREKI_PELLE_END_OFFSET） | `src/core/celestials/pelle/game-end.js:69-70` |
| ch17 | 隐藏成就总数 | 32 条，编号 11~48（11~18、21~28、31~38、41~48） | `src/core/secret-formula/achievements/secret-achievements.js:1-193` |
| ch17 | 手动存档次数 | 100 次 | `src/core/secret-formula/achievements/secret-achievements.js:8-10` |
| ch17 | 概率型成就 | 每秒 1/100000（仅在线判定） | `src/core/secret-formula/achievements/secret-achievements.js:43-45` |
| ch17 | Emoji 记数法累计星系 | 1e5 个反物质星系 | `src/core/secret-formula/achievements/secret-achievements.js:55-59` |
| ch17 | 连续失败次数 | 10 次（计数存在内存里，刷新页面会清零） | `src/core/secret-formula/achievements/secret-achievements.js:77-80` |
| ch17 | 最快无限或永恒 | 不超过 1 毫秒 | `src/core/secret-formula/achievements/secret-achievements.js:106-110` |
| ch17 | 统计页面停留 | 900 秒（15 分钟） | `src/core/secret-formula/achievements/secret-achievements.js:166-170` |
| ch17 | 拖动复兴节点 | 累计 60 秒 | `src/core/secret-formula/achievements/secret-achievements.js:173-176` |
| ch17 | 无名氏存储现实时间 | 超过 24 小时（86400000 毫秒） | `src/core/secret-formula/achievements/secret-achievements.js:179-183` |
| ch17 | 自动机报错数 | 错误数量大于代码行数 | `src/core/secret-formula/achievements/secret-achievements.js:189-192` |
| ch17 | 痛苦记数法在线时长 | 600 秒，且必须已完成过一次永恒 | `src/core/secret-formula/achievements/secret-achievements.js:31-38` |
| ch17 | 进 EC12 的速度门槛 | 进入瞬间速度倍率低于 0.001 | `src/core/eternity-challenge.js:212` |
| ch17 | 恢复隐藏成就的唯一入口 | 成就页 → 隐藏成就子页签（secret） | `src/core/secret-formula/tabs.js:150-166` |

## 附录 G（本 MOD 与原版的差异清单）的溯源

附录 G 正文里的「依据」列已按 R43 决策 2 删除（玩家不该看到源码路径）。原始依据逐条留档如下，供核验用。

- `src/core/celestials/effarig.js:191-193`
- `src/core/celestials/effarig.js:215`
- `src/core/celestials/effarig.js:258`
- `src/core/celestials/effarig.js:44,67,123,191-193,215,258`
- `src/core/celestials/laitela/dark-matter-dimension.js`
- `src/core/celestials/laitela/laitela.js:30`
- `src/core/celestials/laitela/laitela.js:30,81-83`
- `src/core/celestials/laitela/singularity.js`
- `src/core/celestials/pelle/game-end.js:59-60`
- `src/core/dimboost.js:125`
- `src/core/machines.js:14`
- `src/core/machines.js:14,80`
- `src/core/reality-upgrades.js:9`
- `src/core/reality.js:750-752`
- `src/core/secret-formula/celestials/v.js:65-67`
- `src/core/secret-formula/reality/imaginary-upgrades.js:21`
- `src/core/secret-formula/reality/imaginary-upgrades.js:21,49`
- `src/core/secret-formula/reality/imaginary-upgrades.js:49`
- `src/core/speed-config.js:24-26,124,196-235`
- `src/core/speed-config.js:24-44,124,196-235`
- `src/core/speed-config.js:32,33,44`
- `src/core/time-studies/dilation-time-study.js:55`
- `src/core/time-studies/dilation-time-study.js:9,48-50`
- `src/core/time-studies/dilation-time-study.js:9,55`
- `src/core/time-studies/ec-time-study.js:10`
- `src/core/time-studies/ec-time-study.js:10,121-122`
- `src/game.js:110-116`
- `src/game.js:112`
- `src/game.js:115`
