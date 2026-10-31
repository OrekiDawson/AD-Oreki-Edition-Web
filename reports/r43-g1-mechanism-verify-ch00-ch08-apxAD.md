# R43 教程机制核验报告（Web · ch00–ch08 · 附录 A–D）

- 核验对象：`web/AD-Oreki-Edition/src/core/oreki-tutorial-data.json` 的 `chapters[0..8]` 与 `appendices[apx_terms / apx_achievements / apx_notation / apx_bilingual]`
- 代码基线：`web/AD-Oreki-Edition/src/**`（只读，未改任何源码/教程文本）
- 方法说明：本报告**没有新跑浏览器/模拟器**。凡标【静态】= 逐行读代码推导；标【日志】= 引用仓库内历史实测日志 `web/_tools/_r21-300.jsonl`；标【无法核实】= 需要运行时或多版本对照，未猜。
- 结论枚举：台账现有枚举只有「已检-无问题 / 已检-已修复 / 无法核实」，**缺少「已检-有问题」**；下表对有确认错误的单元写 `已检-有问题`，请台账补这一档。

## 一、最高优先级：代码与教程直接矛盾（必改）

1. **ch04/ch05 的整章节奏不存在。** 首次无限后的下一帧，`tryOpenBreakInfinityGate()` 就把 IP 补到 32767、买满 15 级间隔并调用 `breakInfinity()`（`src/core/oreki-break-infinity-gate.js:101-120`，主循环调用 `src/game.js:864`）。教程却写「IP 攒到 32767」「间隔还没拉满」「点 15 次」。
2. **ch04 的「无限点数 ×2」不会被自动购买。** `InfinityIPMultUpgrade` 继承 `GameMechanicState`，**没有** `isAvailableForPurchase`（`src/core/infinity-upgrades.js:136-184`）；自动循环第一道判断 `if (!upgrade.isAvailableForPurchase) continue` 会把它跳过（`src/core/oreki-early-automation.js:92-97`）。教程写「这一条同样由程序代买」是错的；且它要成就 41（16 个一次性升级，`src/core/infinity-upgrades.js:169-171`）才可买，第一次坍缩的 10 IP 根本买不到。
3. **ch06 的「无限维度」路径写错。** 无限维度是「维度 / Dimensions」的子页签（`src/core/secret-formula/tabs.js:10-26`），不在「无限」下；「无限」只有无限升级/打破无限/复制器（`tabs.js:248-288`）。
4. **ch08 的「时间维度」路径写错。** 时间维度同样在「维度」下（`tabs.js:27-34`），不在「永恒」下；「永恒」只有时间研究/永恒升级/永恒里程碑/时间膨胀（`tabs.js:300-332`）。
5. **ch07 复制器星系上限升级花的是 IP，不是复制器。** 按钮文案写「价格：N 无限点数」（`src/components/tabs/replicanti/ReplicantiTab.js:88`），购买判定走 `Currency.infinityPoints`（`src/core/replicanti.js:305-307`），初始价 `galCost = 1e170`（`src/core/player.js:392`）。教程三处写「1e170 复制器起，付的是复制器不是 IP」。
6. **ch07 的 `1.797e308` 门槛精度不够。** 判定是 `Decimal.NUMBER_MAX_VALUE = 1.7976931348623157e308`（`src/core/replicanti.js:551`；`src/core/player.js:965-967`；`modules/break_infinity.js:1546`）。`1.797e308 < 门槛`，按教程数字等会等不到。
7. **ch06 trap「IP 不会清」是错的。** 永恒重置无条件执行 `Currency.infinityPoints.reset()`（`src/core/eternity.js:132`），IP 会清零；`maxAM` 也清零（`:145`）。
8. **附录 A 三条机制描述与代码相反**：反物质星系不是「提高维度倍率」（`src/core/galaxy.js:128` + `src/core/tickspeed.js:38-66`）；维度献祭重置的是第 1~7 维（`src/core/sacrifice.js:134`）；无限之力不是「复制器阶段的货币」，而是 ID1 产出、乘 AD 倍率的资源（`src/core/dimensions/infinity-dimension.js:382`；`src/core/dimensions/antimatter-dimension.js:15`）。
9. **附录 B 的成就总数/自动解锁/被堵死三条都不准**：普通 144 + 隐藏 32 = 176（`normal-achievements.js` 144 个唯一 id，`secret-achievements.js` 32 个）；多条隐藏成就有 `checkRequirement/checkEvent` 会自动解锁（`secret-achievements.js:28-35, 50-59, 105-140`）。
10. **附录 D 的页签出现时机**：自动化页签是总反物质 ≥ 1e40（`tabs.js:179`），不是「解锁自动购买器后」；现实页签是买到膨胀研究 6 就出现（`tabs.js:343`），不是「第一次现实后」。

## 二、问题清单

> 位置写法：`steps[i]` = `steps` 数组第 i 项（0 起）；`numbers[i]` 同理；`table.rows[i]` 为表格第 i 行（0 起，不含表头）；`traps[i]` 同理。
> 判定只用「错误 / 过时 / 易误导 / 无法核实」四档；「错误」均给代码行号。

### ch00 第 0 章

| 章节 | 位置 | 教程原文（≤80字） | 判定 | 代码证据 | 建议改法 |
|---|---|---|---|---|---|
| ch00 | steps[1] | 确认「选项 → 游戏玩法 → 速度倍率」显示 10000。这是默认值… | 易误导 | `src/core/speed-config.js:124`（动态速度默认开）；`:196-237`（停滞 4s 每次 ×2、最快 5s 一次、封顶 100000）；`OptionsGameplayTab.js:130` 实时镜像 `GameSpeed.factor` | 补一句：「默认初值 10000；若开着『自动动态速度』，停滞 4 秒后会每次 ×2（上限 100000×），看到更大的数不是出错；想固定 10000 先关掉它。」 |
| ch00 | steps[0] | 点右下角常驻的「教程」按钮… | 过时 | 按钮文案 R42-C 已改为「打开 Oreki 中文教程」：`src/core/oreki-tutorial-entry.js:46`；位置仍是右下（`public/stylesheets/oreki.css:358-366`） | 改为「右下角常驻的『打开 Oreki 中文教程』按钮（蓝底 ? 图标）」 |
| ch00 | stageGoal / traps[0] | 默认 10000× 速度…默认 10000× 是为三小时通关设定的 | 易误导 | 同上；`speed-config.js:33` 下限是 1×，不是 0.001 | 说明「10000 是初值，不是固定值」；trap 里「调 1× 再抱怨慢」在当前动态速度下会被自动升档，措辞要改 |
| ch00 | note | 本 MOD 只改「怎么更快玩到」，不重写基础机制与成本公式…原版攻略机制部分基本仍然适用 | 易误导 | 实际改了 IP/EP 换算尺度（`src/game.js:112,115,149,389`）、AD8 提升斜率（`src/core/dimboost.js:125`）、自动购买器解锁（`src/core/autobuyers/big-crunch-autobuyer.js:14-28`）、Break 闸门（`src/core/oreki-break-infinity-gate.js`） | 改为「本 MOD 改了若干门槛/尺度与自动化，具体见附录 G；原版攻略只能参考产出公式，门槛与解锁不能照抄」 |

### ch01 第 1 章

| 章节 | 位置 | 教程原文（≤80字） | 判定 | 代码证据 | 建议改法 |
|---|---|---|---|---|---|
| ch01 | steps[4] 例外段 | 打开「自动购买器间隔随倍率缩短」之后，反物质维度与计数频率这两个自动购买器的间隔会按倍率一起缩短 | 错误 | 实际是**两个独立开关**：`OptionsGameplayTab.js:310-316`（反物质维度）与 `:318-338`（计数频率）；且开局例程每帧直接调 `buyMaxDimension/buyMaxTickSpeed`（`src/game.js:297-307`），不经过这两个自动器的 interval，开关对本章无影响（`src/core/oreki-early-automation.js:76-97`） | 改为「选项里有两个独立开关，分别只影响原版反物质维度/计数频率自动购买器；本章的 Oreki 例程每帧直接买最大，不受这两个开关影响」 |
| ch01 | buyOrder[0-3] | 维度提升 → 星系 → 计数频率 → 维度 | 易误导 | 实际每帧顺序是**计数频率 → 维度提升 → 星系 → 维度**（`src/game.js:297-307`），与本段 automation 文字一致、与 buyOrder 相反 | 把 buyOrder 改成「实际顺序：计数频率 → 维度提升 → 星系 → 维度（自动，不用你排）」；或明确它是「手动优先级」 |
| ch01 | steps[4] | 速度倍率是不是被调成了 1× | 易误导 | 动态速度默认开，1× 会在停滞 4s 后自动升档（`speed-config.js:196-237`） | 改为「看是否关掉了『自动动态速度』并把倍率设成 1×」 |

### ch02 第 2 章

| 章节 | 位置 | 教程原文（≤80字） | 判定 | 代码证据 | 建议改法 |
|---|---|---|---|---|---|
| ch02 | steps[3] | 第 6 次及以后的维度提升需求从 20 个第 8 维度起，每级只 +5 个 | 错误 | 第 5 次 = 20；第 6 次 = `20 + (6-5)×5 = 25`（`src/core/dimboost.js:125-126`） | 改为「第 5 次需求 20 个第 8 维度，之后每级 +5（第 6 次 25、第 7 次 30…）」 |
| ch02 | traps[2] | 「维度献祭」在第 5 次维度提升之前根本不存在 | 错误 | 买下第 8 维度（成就 18）后按钮就可见（`src/core/sacrifice.js:6-8`）；只是 `canSacrifice` 要求 `purchasedBoosts > 4`（`:10-14`），按钮是灰的 | 改为「第 5 次提升之前按钮已出现但不可点（要 5 次提升 + 第 8 维度有数量）」 |
| ch02 | numbers[7] | 第 3 个起按 0.965^(星系数−2) × 0.8 | 错误 | 代码先 `galaxies -= 2`，再 `perGalaxy.pow(galaxies - 2)` → 实际指数是 **星系数−4**（`src/core/tickspeed.js:55-66`） | 改为「第 3 个起按 0.965^(星系数−4) × 0.8」 |
| ch02 | numbers[5] / table.rows[1] | (log10(第 1 维度数量) / 上次献祭时的同一数值)² | 易误导 | 实际 `(log10(ND1)/10) / max(log10(sacrificed)/10, 1)` 再取 `sacrificeExponent` 次幂（`src/core/sacrifice.js:85-90`） | 改为「(log10(第1维)/10) ÷ max(log10(累计已献祭)/10, 1)，再取献祭指数次幂（基础 2）」 |
| ch02 | automation | AD4 让首次永恒之前的维度提升与星系重置不清反物质 | 过时 | R26 起窗口不再是「首次永恒之前」，而是排除天神现实/挑战/毁灭现实（`src/core/oreki-keep-antimatter.js:43-64`） | 改为「AD4 在非天神现实、非挑战、非毁灭现实时保留反物质」 |
| ch02 | steps[4] | 买星系会把维度提升次数清零，自动器下一帧会重新买回来 | 易误导 | 星系重置会 `softReset(0)` 把维度清零（`src/core/galaxy.js:128`），下一帧要先重新买回 AD4~AD8 才能满足提升需求（`src/core/dimboost.js:100-107`） | 改为「维度提升次数清零、维度也清零；自动器要把维度买回来后才买得回提升，通常几帧内完成」 |

### ch03 第 3 章

| 章节 | 位置 | 教程原文（≤80字） | 判定 | 代码证据 | 建议改法 |
|---|---|---|---|---|---|
| ch03 | traps[2] | 第一次坍缩后 IP 只有 10 左右，别急着去买贵的无限升级 | 过时 | 下一帧 Break 闸门把余额补到 32767 并全部花在间隔上（`src/core/oreki-break-infinity-gate.js:101-120`；`src/game.js:864`），IP 不会停在 10 | 改为「第一次坍缩只给约 10 IP，但下一帧闸门会补到 32767 并花光；你不需要攒 IP」 |
| ch03 | numbers[0] | 1.7976931348623157e308（= Number.MAX_VALUE）src player.js:985-988 | 错误（仅出处） | 实际 `get canCrunch()` 在 `src/core/player.js:958-962`；值本身正确（`modules/break_infinity.js:1546`） | 出处改为 `player.js:958-962` + `break_infinity.js:1546` |
| ch03 | numbers[1-2] | src game.js:139-143, :176 / :141 | 错误（仅出处） | 实际在 `src/game.js:149-163`、`:179` | 改出处 |

### ch04 第 4 章

| 章节 | 位置 | 教程原文（≤80字） | 判定 | 代码证据 | 建议改法 |
|---|---|---|---|---|---|
| ch04 | stageGoal / steps[5] / subtitle | 让 IP 攒到 32767…IP 到 32767 时，Break 闸门会一次性把你的 IP 补到 32767 | 错误 | 闸门不等 IP 到 32767：首次无限后第一帧就直接补到 32767（`src/core/oreki-break-infinity-gate.js:101-108`），随后买满间隔并 Break（`:111-120`；主循环 `src/game.js:864`） | 改为「完成第一次无限后的下一帧，闸门会把 IP 直接补到 32767、买满 15 级间隔并自动 Break；本章的 1~3e4 IP 只是瞬时值」 |
| ch04 | steps[2] / automation | 「无限点数 ×2」第 1 次要 10 IP…这一条同样由程序代买 | 错误 | `InfinityIPMultUpgrade` 无 `isAvailableForPurchase`（`src/core/infinity-upgrades.js:136-184`），自动循环 `if (!upgrade.isAvailableForPurchase) continue` 跳过它（`src/core/oreki-early-automation.js:92-97`）；且需成就 41（16 个一次性升级，`infinity-upgrades.js:169-171`） | 改为「无限点数 ×2 不会被自动购买，要你自己点；而且要买到 16 个一次性升级解锁成就 41 之后才出现」 |
| ch04 | table.rows[6] | 1 IP｜增加维度提升的倍数加成｜3+6 那条 | 错误 | 1 IP 的 `resetBoost` 是「维度提升和反物质星系对维度的需求减少 9」（`src/core/secret-formula/infinity/infinity-upgrades.js:161-171`）；「增加维度提升的倍数加成」是 7 IP 的 `dimboostMult`（`:259-270`） | 该行改成「1 IP｜维度提升和反物质星系对维度的需求减少 9｜3+6 那条」；7 IP 行保持「维度提升倍率 2×→2.5×」 |
| ch04 | buyOrder[0] | 1 IP 的七个：…购买 10 个维度倍率 / 维度提升倍率 | 错误 | 同上；七个 1 IP 里没有「维度提升倍率」 | 把「维度提升倍率」改成「维度提升/星系需求减少 9」 |
| ch04 | entry | IP ≈ 10 | 过时 | 闸门在同一帧/下一帧就补到 32767 并花光（同上） | 改为「IP 瞬时约 10，随后被闸门补到 32767 并花光」 |

### ch05 第 5 章

| 章节 | 位置 | 教程原文（≤80字） | 判定 | 代码证据 | 建议改法 |
|---|---|---|---|---|---|
| ch05 | entry | 这时大坍缩自动器的间隔还没拉满 | 错误 | 首次无限后的下一帧闸门已把间隔买满并 `breakInfinity()`（`oreki-break-infinity-gate.js:101-120`；`game.js:864`） | 改为「进入本章时通常已经自动拉满并 Break；本章用来核对结果」 |
| ch05 | steps[2] | 把这个按钮点 15 次，价格每次翻倍… | 过时 | 闸门自动买 15 级（同上），按钮通常已消失 | 改为「正常流程不用点；若你关掉了自动购买器总开关，才需要手点 15 次」 |
| ch05 | steps[3] | 去…点页面顶部的按钮。本 MOD…会自动替你按一次 | 过时 | `tryOpenBreakInfinityGate` 已在 `game.js:217-225` 自动按过；进入本章时按钮多半已显示「已打破无限」 | 改为「通常已经自动按下；只在总开关关闭或挑战中没按到时才需要手点」 |
| ch05 | traps[3] | 无限点数涨得太慢…先买「无限点数 ×2」 | 过时 | 闸门直接补 32767（`oreki-break-infinity-gate.js:101-108`）；且 IP×2 不自动买（ch04 条） | 删除或改成「只有关掉总开关的纯手动路线才需要」 |
| ch05 | steps[6] | 打破的一瞬间，所有自动购买器的间隔会被免费拉满…此后你不用再为任何购买器的间隔掏无限点数 | 易误导 | `breakInfinity()` 只对当前 `Autobuyers.all` 调 `maxIntervalForFree()`（`src/game.js:97-99`）；永恒重置会把 interval 打回 base（`src/core/autobuyers/autobuyer.js:185-189`），除非拿到 2 次永恒里程碑 | 加一句「永恒重置（未拿 2 次里程碑）会把间隔打回 150000，需要重新拉」 |
| ch05 | numbers[2-4] | 15 级、32767、单级价格 | 无问题 | `autobuyer.js:169-177`；`oreki-break-infinity-gate.js:51` | — |

### ch06 第 6 章

| 章节 | 位置 | 教程原文（≤80字） | 判定 | 代码证据 | 建议改法 |
|---|---|---|---|---|---|
| ch06 | steps[2] / steps[5] / done / table 标题 | 「无限 / Infinity → 无限维度 / Infinity Dimensions」 | 错误 | 无限维度在「维度 / Dimensions」下（`src/core/secret-formula/tabs.js:10-26`）；「无限」只有无限升级/打破无限/复制器（`tabs.js:248-288`） | 全部改为「维度 / Dimensions → 无限维度 / Infinity Dimensions」 |
| ch06 | buyOrder[0] | 无限维度：全部自动买最大，ID1 优先（它直接产 IP） | 错误 | ID1 产的是无限之力 `Currency.infinityPower`（`src/core/dimensions/infinity-dimension.js:382`）；无限之力乘 AD 倍率（`src/core/dimensions/antimatter-dimension.js:15`），IP 仍由大坍缩换算 | 改为「ID1 优先（它产无限之力 → 抬 AD 倍率 → 坍缩换更多 IP，间接产 IP）」 |
| ch06 | traps[3] | 本纪最高反物质在永恒时会清零，IP 不会 | 错误 | 永恒重置 `Currency.infinityPoints.reset()`（`src/core/eternity.js:132`），IP 清零；`thisEternity.maxAM` 也清零（`:145`） | 改为「本纪最高反物质和 IP 都会在永恒时清零；保留的是永恒点数/时间之理（按各自规则）」 |
| ch06 | numbers[4-5] | src replicanti.js:511-521 / game.js:102, :139 | 错误（仅出处） | 实际解锁在 `src/core/replicanti.js:502-509`；尺度在 `src/game.js:149` | 改出处 |

### ch07 第 7 章

| 章节 | 位置 | 教程原文（≤80字） | 判定 | 代码证据 | 建议改法 |
|---|---|---|---|---|---|
| ch07 | steps[4] / table.rows[2] / buyOrder[2] | 1e170 复制器起，付的是复制器不是 IP | 错误 | 星系上限升级花无限点数：按钮文案 `ReplicantiTab.js:88`；`canBeBought` 用 `Currency.infinityPoints`（`src/core/replicanti.js:305-307`）；初始 `galCost = 1e170`（`src/core/player.js:392`） | 全部改为「1e170 无限点数起；买的是『复制器星系上限』，不是用复制器付」 |
| ch07 | stageGoal / steps[4] / steps[5] / numbers[5] / traps[2] | 1.797e308 | 错误（精度） | 判定是 `Decimal.NUMBER_MAX_VALUE` = 1.7976931348623157e308（`src/core/replicanti.js:551`；`src/core/player.js:965-967`；`modules/break_infinity.js:1546`） | 门槛处统一写 `1.7976931348623157e308`（或「Number.MAX_VALUE」），不要用 `1.797e308` |
| ch07 | steps[6] / automation | 本纪最高 IP 一摸到 1.797e308，AD10 会立刻永恒…不等任何间隔（唯一例外在现实阶段） | 错误 | 还有三道门：①本次 EP 收益 ≥ 当前 EP×10（`src/core/oreki-eternity-automation.js:627`）②为 RU10 压住第一次永恒，最多 10s 或 IP 指数 ≥400（`:624, 672-689`；`noEternities` 初值 true，`player.js:261`）③EC 入口排队（`:626`）。RU10 压制发生在**第一次永恒**，不是现实阶段 | 改为「自动永恒在 canEternity 后还要过 EP×10、RU10 压制（首次最多 10 秒/指数 400）、EC 入口三道门」 |
| ch07 | numbers[7] | 首次永恒 EP 收益 约 4.9e6 | 无法核实 | 公式 `5^(log10(maxIP)/30−0.7)` 正确（`src/game.js:390-391`）；但首次触发点被 RU10 压到 IP 指数 ≥400 或 10s 后，EP 可能远大于 4.9e6（指数 400 时约 6.9e8）。需运行时确认 | 改为「按 canEternity 门槛算是 4.9e6；实际首次因 RU10 压制会更大，见运行时」 |
| ch07 | numbers[0-4,6,8] | 解锁 1e140 / 初始 1%/1000ms / 间隔 ×1e10 / 概率 ×1e15 / log2² / 里程碑 | 无问题 | `src/core/replicanti.js:501-512, 336-411, 266-272`；`eternity-milestones.js:11-13,123-140` | — |

### ch08 第 8 章

| 章节 | 位置 | 教程原文（≤80字） | 判定 | 代码证据 | 建议改法 |
|---|---|---|---|---|---|
| ch08 | steps[0] | 「永恒 / Eternity → 时间维度 / Time Dimensions」 | 错误 | 时间维度在「维度 / Dimensions」下（`src/core/secret-formula/tabs.js:27-34`）；「永恒」下没有时间维度（`tabs.js:300-332`） | 改为「维度 / Dimensions → 时间维度 / Time Dimensions」 |
| ch08 | steps[0] | 没买过 TD1 之前，用 EP 换 TT 会被直接拒绝（游戏会弹…） | 易误导 | 自动购买走 `TimeTheorems.buyMax(true)`（`oreki-eternity-automation.js:180`），`checkForBuying(auto=true)` 只 return false，不弹窗（`src/core/time-theorems.js:112-116`）；只有手动点才弹 | 改为「自动购买会静默失败；手动点才会弹提示」 |
| ch08 | automation | AD10 每帧…调 buyMaxTimeDimension 买时间维度 1~4 | 过时 | 实际 for 8→1 买所有已解锁 TD（`src/core/oreki-eternity-automation.js:156-166`），5~8 解锁后也会买 | 改为「买所有已解锁的时间维度（8→1），不止 1~4」 |
| ch08 | numbers[4] / steps[5] | 膨胀研究 1 的门槛：时间之理总数 12900 + 永恒挑战 11/12 各 5 次 | 易误导 | 还要求 `[231,232,233,234].some(isBought)`（`src/core/secret-formula/eternity/time-studies/dilation-time-studies.js:7-17`）；引用的 `time-studies/dilation-time-study.js:72-74` 是购买逻辑，不是条件 | 改为「12900 TT + EC11/12 各 5 次 + 231~234 任一已买」；出处改 `secret-formula/.../dilation-time-studies.js:7-17` |
| ch08 | steps[5] | 顶部或时间研究页显示的时间之理总数 ≥ 12900 | 易误导 | 顶部显示的是当前未花 TT（`src/core/currency.js:355-361`）；门槛看的是 `maxTheorem`（累计，`:361`），DS1 节点显示 `X/12900`（`src/components/tabs/time-studies/DilationTimeStudy.js:33`） | 改为「看时间膨胀研究 1 节点上的 X/12900；顶部是未花 TT，可能小于门槛」 |
| ch08 | numbers[7] | src oreki-eternity-automation.js:590-592 | 错误（仅出处） | 实际在 `oreki-eternity-automation.js:627` | 改出处 |

### 附录 A `apx_terms`

| 章节 | 位置 | 教程原文 | 判定 | 代码证据 | 建议改法 |
|---|---|---|---|---|---|
| apx_terms | 表「反物质星系」行 | 反物质星系｜Antimatter Galaxy｜提高维度倍率 | 错误 | 星系直接改的是计数频率倍率（`src/core/tickspeed.js:38-66`）；`galaxyReset()` 只加星系并 `softReset(0)`（`src/core/galaxy.js:122-133`），不直接乘维度；ch02 自己的 trap 也写「不直接乘维度产量」 | 改为「提高计数频率（全局生产速度），不直接乘维度」 |
| apx_terms | 表「维度献祭」行 | 维度献祭｜Dimensional Sacrifice｜重置前 8 维换倍率 | 错误 | `AntimatterDimensions.resetAmountUpToTier(7)`（`src/core/sacrifice.js:134`）只清第 1~7 维，第 8 维保留并吃倍率 | 改为「重置第 1~7 维，换取第 8 维倍率」 |
| apx_terms | 表「无限之力」行 | 无限之力｜Infinity Power｜复制器阶段的货币 | 错误 | ID1 产 `Currency.infinityPower`（`src/core/dimensions/infinity-dimension.js:382`），它乘 AD 倍率（`src/core/dimensions/antimatter-dimension.js:15`）；不是复制器阶段的货币 | 改为「无限维度产出的资源，按指数乘反物质维度倍率」 |
| apx_terms | 其余 81 行 | — | 无问题 | 名称与 `docs/TUTORIAL_GLOSSARY.md` 一致；未出现「时间定理/时间速率/快子粒子/稀释时间/大灾变/星际生成器/全部最大/倍速」等禁用词（脚本扫描 0 命中） | — |

### 附录 B `apx_achievements`

| 章节 | 位置 | 教程原文 | 判定 | 代码证据 | 建议改法 |
|---|---|---|---|---|---|
| apx_achievements | 开头 | 总数 144 条，其中隐藏成就 32 条（编号 11~48） | 错误 | `normal-achievements.js` 144 个唯一 id（11~188）；`secret-achievements.js` 32 个（11~48，含缺号）→ 合计 176，144 不含隐藏 | 改为「普通成就 144 条 + 隐藏成就 32 条，合计 176 条」 |
| apx_achievements | 开头 | 隐藏成就一条都不会自动解锁 | 错误 | 多条带 `checkRequirement/checkEvent`，条件满足即自动解锁：16、18、22、27、32、35、43、44、45（`secret-achievements.js:28-35, 50-59, 92-93, 105-110, 115-120, 123-140`） | 改为「隐藏成就不会随主线进度自然达成，但部分会在满足条件时自动解锁（如 32 最快无限、43 全音乐符文、44 统计页 15 分钟）」 |
| apx_achievements | 开头 | 有 3 条会被本 MOD 的自动化堵死 | 部分错误 | 26 真被堵死：`tryInstantCompleteChallenges()` 无条件每帧运行，EC 进入即完成、无法失败（`src/game.js:853`；`src/core/oreki-instant-challenges.js:147-171, 218-220`）。34 可手动做：关自动购买器、空树、勾 respec 后手动永恒（`src/core/eternity.js:122-127`）。42 不是自动化堵的：判定是 `getGameSpeedupFactor()<0.001`（`src/core/eternity-challenge.js:208-212`），与速度倍率选项无关（下限 1×，`speed-config.js:33`） | 改为「26 被进入即完成堵死；34 需关自动化手动做；42 需负向黑洞（Reality 阶段）把 game speedup 压到 0.001 以下，不是改速度倍率」 |
| apx_achievements | 表 row 15 | 做一个桶滚！｜触发桶滚彩蛋｜任意，选项 → 视觉效果 | 易误导 | 桶滚由导入框输入 `do a barrel roll` 触发（`src/core/options.js:47-78`，hash 命中 `secretImports[0]`）；选项里没有桶滚按钮（全仓 `components/` 无 barrel） | 改为「在存档导入框输入 `do a barrel roll`」 |
| apx_achievements | 表 row 26 | 在一个永恒挑战里连续失败 10 次 | 错误 | 计数器对任意 `CHALLENGE_FAILED` 累加，且从不重置、不校验 EC 编号（`src/core/secret-formula/achievements/secret-achievements.js:78-86`） | 改为「累计触发 10 次永恒挑战失败（任意 EC、不要求连续；计数在内存，刷新归零）」 |
| apx_achievements | 表 row 27 | 普通挑战 11 里把物质推到 1.79e308 | 错误（精度） | 判定 `Currency.matter.gte(Decimal.NUMBER_MAX_VALUE)` = 1.7976931348623157e308（`secret-achievements.js:92`） | 改为 `1.7976931348623157e308` |
| apx_achievements | 表 row 37 | 导入框输入 `save`，或导入研究树 `tree` | 错误 | 研究树秘密串是 `this.input === "时间研究树"`（`src/components/modals/StudyStringModal.js:138-143`），不是 `tree` | 改为「导入研究树框输入『时间研究树』」 |
| apx_achievements | 表 row 42 | 以低于 0.001 倍的速度进入 EC12｜永恒挑战阶段，需手动降速 | 易误导 | 判定 `enteringGamespeed = getGameSpeedupFactor()`（`eternity-challenge.js:208-212`）；该值不含 Options 的速度倍率（`src/game.js:561-625`），速度倍率最低 1×（`speed-config.js:33`）；要 <0.001 需负向黑洞（Reality 阶段的黑洞充能滑块，`BlackHoleChargingSliders.js:43`） | 改为「需在 Reality 阶段用负向黑洞把 game speedup 压到 0.001 以下再进 EC12；改速度倍率没用」 |
| apx_achievements | 表 row 36 | 离线 16 分 40 秒且期间没有任何进度 | 无法核实 | 触发条件是 `nothingHappened || !somethingHappened`（`AwayProgressModal.js:47`），未找到 1000 秒常量；另 `Theme S9` 可直接令 `nothingHappened` 为真（`:31-33`） | 「16 分 40 秒」需运行时确认；建议补「或用 S9 主题」 |

### 附录 C `apx_notation`

| 章节 | 位置 | 教程原文 | 判定 | 代码证据 | 建议改法 |
|---|---|---|---|---|---|
| apx_notation | 一、工程记数法行 | 工程记数法…界面会写成 `1.23e45` 或 `12.3e44` 这类 | 错误 | 工程记数法指数固定取 3 的倍数（`modules/notations.js:281-300`，`formatMantissaWithExponent(..., 10, 3, ...)`），44 不是 3 的倍数 | 例子改成 `12.3e45`（或 `1.23e45`） |
| apx_notation | 二、三 | 默认 1e5 / 1e9；指数 <1e5 一层 / 1e5~1e9 千分位 / ≥1e9 两层 | 无问题 | `src/core/player.js:791-795`（5/9）；`src/core/new-game.js:93-94`（10^5 / 10^9）；`modules/notations.js:14-18, 79-87, 230-256` | — |
| apx_notation | 三、`ee15.955` | `ee` 是两层指数… | 无问题 | 对数记数法递归输出：`formatDecimal` 返回 `"e"+formatExponent(log10)`，指数 ≥1e9 时再次 `formatDecimal` → `ee...`（`modules/notations.js:496-501, 230-256`） | — |
| apx_notation | 五、22 种 / 15 种痛苦 | — | 无问题 | `src/core/notations.js:15-37`（22 个）、`painful` 标记 15 个（`:16-36`） | — |

### 附录 D `apx_bilingual`

| 章节 | 位置 | 教程原文 | 判定 | 代码证据 | 建议改法 |
|---|---|---|---|---|---|
| apx_bilingual | 子页签「天神导航」 | 天神导航｜Celestial Navigation｜天神 | 错误（术语） | Android 官方 `tab_celestial_navigation_full` = **天神地图**（`android/.../values-zh-rCN/strings.xml:4098`）；「天神导航」在官方 0 次；Web `tabs.js:411` 也写「天神导航」 | 中英表改为「天神地图｜Celestial Navigation」；同时把 `tabs.js:411` 的界面名改成「天神地图」 |
| apx_bilingual | 底栏「自动化」行 | 自动化｜Automation｜解锁自动购买器后 | 错误 | 页签条件是 `player.records.totalAntimatter.gte(1e40)`（`src/core/secret-formula/tabs.js:179`），在首次无限/自动购买器解锁之前就出现 | 改为「总反物质 ≥ 1e40 后」 |
| apx_bilingual | 底栏「现实」行 | 现实｜Reality｜第一次现实后 | 错误 | 条件 `PlayerProgress.realityUnlocked() || TimeStudy.reality.isBought`（`tabs.js:343`），买到膨胀研究 6 就出现，早于第一次现实 | 改为「买到膨胀研究 6（现实研究）后」 |
| apx_bilingual | 底栏「商店」行 | 商店｜Shop｜开局就有 | 易误导 | 条件 `Cloud.isAvailable`（`tabs.js:486`），云服务不可用时不显示 | 改为「云服务可用时（本地/离线构建可能不显示）」 |
| apx_bilingual | 底栏「挑战」行 | 挑战｜Challenges｜解锁第一个普通挑战后 | 易误导 | 条件 `infinityUnlocked()`（`tabs.js:202-208`），第一次大坍缩时出现；C1 在同一帧被自动完成（`big-crunch.js:11-14`） | 改为「第一次大坍缩后（同时自动完成 C1）」 |
| apx_bilingual | 子页签「无限维度」「时间维度」 | 无限维度｜维度；时间维度｜维度 | 无问题（正是 ch06/ch08 路径错误的佐证） | `tabs.js:10-34` | 保持；同时修 ch06/ch08 正文 |
| apx_bilingual | 其余 39 行 | — | 无问题 | 名称与 `tabs.js` 一致；官方串可查到（反物质维度 147、无限维度 81、时间维度 83、普通挑战 14、无限挑战 28、永恒挑战 92、无限升级 23、打破无限 9、复制器 136、时间研究 131、永恒升级 7、永恒里程碑 3、时间膨胀 57、符文 332、现实升级 24、虚幻升级 9、复兴树 5、黑洞 64、符文炼金 12、自动机 60、隐藏成就 6、存档 54、商店 10） | — |

## 三、逐单元状态表（可直接对台账）

> 断言数 = `steps + numbers + table.rows + traps + 5`（5 = stageGoal / entry / done / automation / note 五个元字段）。
> 状态枚举沿用台账；有确认错误的写 `已检-有问题`（台账缺此档，请补）。

| 单元 | 断言条数 | 已核条数 | 结论 | 主要问题一句 |
|---|---:|---:|---|---|
| ch00 | 23 | 23 | 已检-有问题 | 动态速度默认开会把 10000 自动升档；教程按钮文案已改；note「不改机制」与后文自相矛盾 |
| ch01 | 29 | 29 | 已检-有问题 | 「一个开关管两个自动器」错，且开局例程不走这两个 interval；buyOrder 与实际每帧顺序相反 |
| ch02 | 30 | 30 | 已检-有问题 | 第 6 次提升是 25 不是 20；献祭按钮提前可见；星系 tick 公式指数应为 −4；AD4 窗口描述过时 |
| ch03 | 23 | 23 | 已检-有问题 | 「IP 只有 10」过时（下一帧被补到 32767）；两处出处行号漂移 |
| ch04 | 38 | 38 | 已检-有问题 | 闸门首帧就补 32767 并 Break，整章节奏不存在；IP×2 不会被自动买；1 IP 的 resetBoost 被写成 dimboostMult |
| ch05 | 45 | 45 | 已检-有问题 | entry/step3 仍假设未 Break、未拉满；「任何挑战都不生效」对 12 个升级不成立；重置后间隔会回 base |
| ch06 | 39 | 39 | 已检-有问题 | 无限维度页签路径错；ID1「直接产 IP」错；「IP 不会被永恒清」错 |
| ch07 | 28 | 27 | 已检-有问题 | 星系上限升级花 IP 不是复制器；1.797e308 精度不够；自动永恒有三道额外门（RU10 是第一次永恒就压） |
| ch08 | 33 | 33 | 已检-有问题 | 时间维度页签路径错；自动买 TD 是 8→1 全解锁；DS1 条件漏 231~234；顶部显示的是未花 TT |
| apx_terms | 88 | 88 | 已检-有问题 | 反物质星系/维度献祭/无限之力三条机制描述与代码相反；其余术语与官方表一致、无禁用词 |
| apx_achievements | 39 | 38 | 已检-有问题 | 144 不含隐藏（应为 176）；「一条都不会自动解锁」错；「3 条被堵死」只有 26 成立；15/26/27/37/42 的触发写法有误；36 的 16m40s 无法核实 |
| apx_notation | 14 | 14 | 已检-有问题 | 工程记数法例子 `12.3e44` 指数不是 3 的倍数；两个默认值与 ee 说明正确 |
| apx_bilingual | 44 | 44 | 已检-有问题 | 「天神导航」官方是「天神地图」；自动化/现实/商店/挑战四行的出现时机与 tabs.js 不符 |

## 四、出处行号漂移（不影响结论，但教程 `src` 字段应修）

| 位置 | 教程写的 | 实际 |
|---|---|---|
| ch03 numbers[0] | `player.js:985-988` | `player.js:958-962` |
| ch03 numbers[1] | `game.js:139-143, :176` | `game.js:149-163, :179` |
| ch03 numbers[2] | `game.js:141` | `game.js:161-163` |
| ch06 numbers[4] | `replicanti.js:511-521` | `replicanti.js:502-509` |
| ch06 numbers[5] | `game.js:102, :139` | `game.js:149` |
| ch07 numbers[0] | `replicanti.js:519-529` | `replicanti.js:502-509` |
| ch07 numbers[5] | `replicanti.js:553-556` | `replicanti.js:551-552` |
| ch07 numbers[6] | `game.js:397-400` | `game.js:390-391`（`gainedEternityPoints`） |
| ch07 numbers[7] | `game.js:379-381` | `game.js:390-391` |
| ch08 numbers[4] | `time-studies/dilation-time-study.js:72-74` | `secret-formula/eternity/time-studies/dilation-time-studies.js:7-17` |
| ch08 numbers[7] | `oreki-eternity-automation.js:590-592` | `oreki-eternity-automation.js:627` |
| ch02 numbers[5] | `sacrifice.js:72-90` | 正确，但公式被简化过头（见清单） |

## 五、无法核实清单（不猜）

| 单元 | 项 | 为什么无法核实 |
|---|---|---|
| ch07 | numbers[7]「首次约 4.9e6 EP」 | 公式可核；但首次永恒的触发点取决于 RU10 压制（10s 或 IP 指数 400）与运行时产量，静态无法给出确定 EP。历史日志 `_r21-300.jsonl` 的 `epL=6.936` 是 t=6、et=5 的累计值，不能反推首次值 |
| apx_achievements | row 36「离线 16 分 40 秒」 | 代码只判 `nothingHappened || !somethingHappened`（`AwayProgressModal.js:47`），未找到 1000 秒常量；另 S9 主题可直接满足 `nothingHappened`（`:31-33`）。建议运行时实测或删掉秒数 |
| ch03/ch05/ch06 | 「实测 t=4 / t=5 / t=10」 | 已核对 `web/_tools/_r21-300.jsonl:5,7,14-16` 确有这些 milestone 行，但那是历史构建的日志，**不能证明当前 HEAD 仍是同一时刻**；本报告未新跑游戏。教程若把这些数字当「当前实测」应改为「历史实测（R21）」 |
| 全局 | 页签栏位置「顶部/底栏/侧栏」 | 教程同一页签栏出现三种叫法（ch1「底栏」、ch3「侧栏」、ch1/ch2/ch4/ch7/ch8「顶部」）。实际 UI 在 Classic 模式是底部、Modern 模式是左侧栏；未启动浏览器确认当前默认模式。**至少两处叫法必错**，建议统一写「页签栏（桌面左侧 / 移动端底部）」 |

## 六、统计

- 问题行：**57**（「错误」32 / 「过时或易误导」23 / 「无法核实」2；其中 4 行是仅出处行号漂移，已另列第四节）
- 代码与教程直接矛盾：**10 组**（见第一节）
- 覆盖：ch00–ch08 共 288 条结构化断言，已核 287 条（1 条运行时 EP 值）；附录 A–D 共 185 条，已核 184 条（1 条 16m40s）
- 判定依据：全部为【静态推导】，另引用 `_r21-300.jsonl` 的【日志】；本报告没有新跑游戏，故不写「已实测」。
- 未修改任何源码/教程文本；本文件是唯一新增产物。
