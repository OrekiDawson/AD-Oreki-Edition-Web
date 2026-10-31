# R43 · Web 教程机制核验（第 0~8 章 + 附录 A/B/C/D）

核验人：r43-g1-verify-early（只读任务，未修改任何游戏源码 / 教程文本）
数据源：`src/core/oreki-tutorial-data.json`（schemaVersion=1）
代码基线：`web/AD-Oreki-Edition/src/**`
标记：【读码证实】= 常量 / 表达式可直接读出；【合理推断】= 由调用链推导（未实跑）；【无法核实】= 无代码依据或依赖实跑

**判定口径**：`错误` = 与代码直接冲突（含页签路径、币种、触发方式）；`过时` = 代码改过但教程仍是旧口径（含源码行号漂移以外的实质变化）；`易误导` = 字面不算硬错，但会把玩家带偏。

**三档标注**：第一节 28 行的「代码证据」列**全部为【读码证实/实测】**（常量与表达式直接读出）；第一节未出现【合理推断】——凡只能推断不能证实的都移入第四节；第四节即【无法核实】清单。

---

## 一、问题清单

| 单元 | 位置 | 教程原文（截断） | 判定 | 代码证据 | 建议改法 |
|---|---|---|---|---|---|
| ch00 | steps[0] | 「Web 端点右下角常驻的『教程』按钮」 | 过时 | `src/core/oreki-tutorial-entry.js:46` `label.textContent = "打开 Oreki 中文教程"`；`:18` `TUTORIAL_ENTRY_ID = "oreki-tutorial-entry"` | 「Web 端点右下角常驻的『打开 Oreki 中文教程』按钮」 |
| ch00 | steps[1] | 「确认『选项 → 游戏玩法 → 速度倍率』显示 10000」 | 易误导 | `OptionsGameplayTab.js:255` 行标题是 `<b>游戏速度：×{{ speedFactorText }}</b>`，界面上没有名为「速度倍率」的条目；`speed-config.js:124` `dynamicEnabled = readStoredFlag(DYNAMIC_KEY, true)`（默认开）+ `:196-238` 每 5 s 无进展即 ×2，上限 100000× | 「确认『选项 → 游戏玩法 → 游戏速度：×N』显示 ×10000；下方『自动动态速度』默认开着，长时间跑会自己升到更高倍率」 |
| ch01 | steps[4] | 「『选项 → 游戏玩法 → 速度倍率』是不是被调成了 1×」 | 易误导 | 同 `OptionsGameplayTab.js:255`（条目名「游戏速度」） | 「『选项 → 游戏玩法 → 游戏速度』是不是被调成了 ×1」 |
| ch02 | numbers[5] / table.rows[1][2] | 「(log10(第 1 维度数量) / 上次献祭时的同一数值)²」 | 易误导 | `sacrifice.js:90` `(nd1Amount.log10() / 10) / Math.max(sacrificed.log10() / 10, 1)`：分母有 `max(…, 1)` 下限，即上次献祭的 AD1 ≤ 1e10 时一律按 1e10 计，并非「同一数值」 | 「(log10(第一维)/10 ÷ max(log10(上次献祭的第一维)/10, 1))²，上次不到 1e10 时按 1e10 算」 |
| ch02 | automation | 「本 MOD 让首次永恒之前的维度提升与星系重置不清反物质」 | 过时 | `oreki-keep-antimatter.js:41-68`：`active` = 非天神现实、非普通/无限/永恒挑战、非毁灭态即保留，与「首次永恒之前」无关 | 「只要不在天神现实 / 挑战 / 毁灭态，维度提升与星系重置都不清反物质」 |
| ch04 | steps[2] | 「『无限点数 ×2』第 1 次要 10 无限点数，正好是第一次坍缩的收益」 | 易误导 | `infinity-upgrades.js:172-174` `get isRequirementSatisfied() { return Achievement(41).isUnlocked; }`；`normal-achievements.js:202-205` 成就 41 要求 `player.infinityUpgrades.size >= 16` → 第一次坍缩时买不到 | 「『无限点数 ×2』要先解锁成就 41（买满 16 个无限升级）才能买，第 1 次 10 无限点数」 |
| ch05 | challenges | 「任何挑战进行中『打破无限』会直接返回（普通挑战、无限挑战、永恒挑战都算）」 | 易误导 | `game.js:94-96`：`breakInfinity()` 只判 `InfinityChallenge.isRunning`；普通/永恒挑战靠本 MOD 闸门 `oreki-break-infinity-gate.js:67`（且要求 `player.auto.autobuyersOn`） | 「无限挑战里 breakInfinity() 直接返回；普通/永恒挑战里是本 MOD 闸门在拦（关掉自动购买器总开关就不再拦）」 |
| ch05 | steps[2] | 「把这个按钮点 15 次…你只要看这个按钮是不是已经消失」 | 易误导 | `oreki-break-infinity-gate.js:90-126`：IP 不足 32767 时自动补足并 `bc.upgradeInterval(false)` 循环买满（同段自己也写了「本 MOD 会…连续替你买完」） | 「不用点：IP 够 32767 后闸门会自动补足并逐级买满，你只要确认按钮消失」 |
| ch06 | steps[5] / done | 「『无限 → 无限维度』8 个格子全部有数量」 | 错误 | `tabs.js:17-29`「无限维度」是「维度」页签的子页签（`condition: InfinityDimension(1).isUnlocked`）；`tabs.js:245-289`「无限」页只有无限升级 / 打破无限 / 复制器 | 「『维度 → 无限维度』8 个格子全部有数量」 |
| ch06 | numbers[5] | 「无限点数换算尺度（现实解锁前）= 30（原版 308）」 | 过时 | `game.js:149` `const baseDivisor = isOrekiBootstrapRun() ? 30 : 308;`；`oreki-bootstrap.js:35-42` 窗口 = 现实未解锁**或**本现实未买回膨胀研究 6 | 「无限点数换算尺度（引导窗口内）= 30；窗口 = 现实未解锁或本现实未买回膨胀研究 6（原版 308）」 |
| ch07 | steps[4] / table.rows[2][1] | 「星系上限…1e170 复制器起，付的是复制器不是无限点数」 | 错误 | `player.js:392` `galCost: DC.E170`（`replicanti.js:514` 同）；`replicanti.js:426` `get baseCost() { return player.replicanti.galCost; }`；UI `ReplicantiTab.js:94` 文案「价格：… 无限点数」 | 「1e170 **无限点数**起，付的是无限点数」 |
| ch07 | steps[4] / numbers[5] / steps[5] | 「等复制器数量涨到 1.797e308」「本纪最高无限点数一摸到 1.797e308」 | 易误导 | `replicanti.js:553-556` `if (!Replicanti.amount.gte(Decimal.NUMBER_MAX_VALUE)) return false;`（= 1.7976931348623157e308）；`player.js:958-963` `goal = Decimal.NUMBER_MAX_VALUE` | 统一写 1.7976931348623157e308（1.797e308 比门槛低 0.07%，按字面数字达不到） |
| ch07 | steps[5] | 「自动永恒会立刻替你执行永恒…不等任何间隔」 | 易误导 | `oreki-eternity-automation.js:626-627`：`ecEntryPending()` 或 `gainedEternityPoints().lt(Currency.eternityPoints.value.times(10))` 都会跳过；与本章 ch08 numbers[7]「≥10 倍才重置」自相矛盾 | 「自动永恒每帧检查，但要求本次收益 ≥ 当前永恒点数的 10 倍、且不在 EC 入口排队」 |
| ch08 | steps[0] | 「『永恒 → 时间维度』最便宜的 TD1」 | 错误 | `tabs.js:30-41`「时间维度」是「维度」页签的子页签（`condition: eternityUnlocked`） | 「『维度 → 时间维度』最便宜的 TD1」 |
| ch08 | steps[5] | 「时间之理总数 ≥ 12900 —— 膨胀研究 1 的硬门槛（另需 EC11、EC12 各 5 次）」 | 易误导 | `dilation-time-studies.js:14-20`：还要求 `[231,232,233,234].some(id => TimeStudy(id).isBought)`（三个分叉研究任一） | 「门槛 = 12900 时间之理 + 231~234 任一已买 + EC11/EC12 各 5 次」 |
| ch08 | table.rows[5][2] | 「6 \| 离线时获得永恒点数」 | 易误导 | `eternity-milestones.js:25-40`：离线 EP = 最佳 EP/分钟 的 25%，离线里程碑 200 / 1000 任一激活即显示「已禁用」，关闭离线进度时也不生效 | 「离线时按最佳 EP/分钟 的 25% 给永恒点数（离线里程碑 200/1000 激活或关闭离线进度时不生效）」 |
| apx_terms | 一、核心机制·反物质星系 行 | 「反物质星系 \| Antimatter Galaxy \| 提高维度倍率」 | 错误 | `tickspeed.js:55-66` `perGalaxy(0.965).pow(galaxies - 2).times(0.8)`（星系只改计数频率倍率）；`galaxy.js` 无任何维度倍率项 | 「提高计数频率（每次购买计数频率更值，不直接乘维度产量）」 |
| apx_terms | 一、核心机制·无限之力 行 | 「无限之力 \| Infinity Power \| 复制器阶段的货币」 | 错误 | `antimatter-dimension.js:15` `Currency.infinityPower.value.pow(InfinityDimensions.powerConversionRate).max(1)` → 所有 AD ×(无限之力^7)；`h2p.js:408` 官方口径「第一无限维度…生产无限之力，能给所有反物质维度带来 (无限之力^7) 的加成」 | 「第一无限维度的产物，给所有反物质维度 ×(无限之力^7) 的加成」 |
| apx_achievements | 一、第 21 号 行 | 「买下时间研究 11 左侧的隐藏格」 | 错误 | `src/components/tabs/time-studies/SecretTimeStudy.js:47-55`：`if (!player.secretUnlocks.viewSecretTS) { … viewSecretTS = true; … SecretAchievement(21).unlock(); }` —— 只是**显示**，不购买、不消耗 TT | 「点开时间研究 11 左侧那格看不见的研究（显示出来就解锁）」 |
| apx_achievements | 一、第 26 号 行 | 「在一个永恒挑战里连续失败 10 次」 | 错误 | `game.js:853` 每帧无条件 `tryInstantCompleteChallenges()`；`oreki-instant-challenges.js:147-171` 无 `player.auto.autobuyersOn` 判定 → 进入即补满，永远失败不了 | 「本 MOD 下无法获得（进入即完成，且不区分总开关）」 |
| apx_achievements | 一、第 37 号 行 | 「导入框输入 `save`，或导入研究树 `tree`」 | 错误 | `options.js:55-65` 哈希表只有 4 条，实测 `sha512_256("TREE")` 不在表内（idx = -1，`save` = idx 2 ✓）；研究树彩蛋串是中文 `StudyStringModal.js:138-143` `this.input === "时间研究树"` | 「导入框输入 `save`；研究树框输入『时间研究树』」 |
| apx_achievements | 一、第 36 号 行 / 二、第 3 行 | 「离线 16 分 40 秒且期间没有任何进度」 | 错误 | `game.js:1269` `if (seconds > 600)` 才弹离线窗；`:1283` 已先 `seconds *= getGlobalSpeedFactor()` → 门槛 600 游戏秒（默认 10000× 时约 0.06 真实秒）；全仓无 1000 s 常量对应 | 「离线时间 × 全局倍率 > 600 游戏秒，且期间没有任何进度」 |
| apx_achievements | 导语 | 「有 3 条会被本 MOD 的自动化堵死」 | 易误导 | 只有 26 号能证明被彻底堵死（`game.js:853` 无开关判定）；`oreki-eternity-automation.js:136` 与 `oreki-early-automation.js:58` 都判 `player.auto.autobuyersOn`，关掉总开关后 36 / 42 都能做 | 「有 1 条（26 号）被自动化彻底堵死；36、42 只需先关掉自动购买器总开关」 |
| apx_achievements | 一、第 42 号 行 | 「以低于 0.001 倍的速度进入 EC12」 | 易误导 | `speed-config.js:33` `GAME_SPEED_MIN = 1`（Web 速度下限 1×，压不到 0.001）；只能靠负向黑洞 `game.js:578-579` `factor *= player.blackHoleNegative` | 「开负向黑洞把速度压到 0.001 以下再进 EC12（Web 速度下限是 1×）」 |
| apx_notation | 一、第 4 行 | 「工程记数法…界面会写成 `1.23e45` 或 `12.3e44` 这类」 | 错误 | `modules/notations.js:41-44` `exponentOffset = value.exponent % 3;` → 指数必为 3 的倍数；`:296-297` `formatMantissaWithExponent(..., 10, 3, false)` | 「`1.23e45` 或 `12.3e42`（指数固定为 3 的倍数）」 |
| apx_bilingual | 导语（两处） | 「系统语言是英文时，底栏与子页签会显示英文」 | 错误 | Web 无 i18n：`tabs.js:4` `name: "维度"` 等全部硬编码中文，仓库无语言切换与词条表 | 「本作界面固定中文；此表仅用于对照原版英文名」 |
| apx_bilingual | 二、天神导航 行 | 「天神导航 \| Celestial Navigation」 | 错误 | Android 官方 `mod/res/values-zh-rCN/strings.xml:4098` `tab_celestial_navigation_full = 天神地图`；Web 用 `tabs.js:411`「天神导航」 | 「天神地图（Web 沿用旧译『天神导航』）」 |
| apx_bilingual | 一、自动化 行 | 「自动化 \| Automation \| 解锁自动购买器后」 | 易误导 | `tabs.js:176-183` 该页签 `condition` 是 `player.records.totalAntimatter.gte(1e40)` | 「总反物质 ≥ 1e40 后出现」 |

---

## 二、逐单元状态表（直接对齐 `reports/r43-tutorial-chapter-inventory.md` 的行 id）

| 单元 | 断言条数 | 已核条数 | 结论 | 主要问题一句 |
|---|---|---|---|---|
| ch00 | 21 | 21 | 已核-2 处（错 0） | 教程按钮文案过时；「速度倍率」条目名不存在且未提默认开启的动态倍率 |
| ch01 | 27 | 27 | 已核-1 处（错 0） | 「速度倍率」条目名不存在（实际是「游戏速度」） |
| ch02 | 28 | 28 | 已核-2 处（错 0） | 献祭分母有 1e10 下限；保留反物质的窗口已不是「首次永恒之前」 |
| ch03 | 21 | 21 | 已核-无问题 | 门槛 / 收益 / 页签 / 自动坍缩 / 5 个购买器全部一致 |
| ch04 | 36 | 36 | 已核-1 处（错 0） | 「无限点数 ×2」要先解锁成就 41，第一次坍缩时买不到 |
| ch05 | 43 | 43 | 已核-2 处（错 0） | 挑战内拦截打破无限的路径写混；「点 15 次」与同段自动代买矛盾 |
| ch06 | 37 | 37 | 已核-2 处（错 1） | 「无限 → 无限维度」页签层级错；尺度 30 的生效窗口过时 |
| ch07 | 26 | 26 | 已核-3 处（错 1） | 星系上限付的是无限点数不是复制器；1.797e308 精度不够；自动永恒还有 10 倍闸 |
| ch08 | 31 | 31 | 已核-3 处（错 1） | 「永恒 → 时间维度」页签层级错；膨胀研究 1 漏了 231~234；里程碑 6 描述过简 |
| apx_terms | 82 | 82 | 已核-2 处（错 2） | 反物质星系写成「提高维度倍率」；无限之力写成「复制器阶段货币」 |
| apx_achievements | 40 | 40 | 已核-6 处（错 4） | 21 / 26 / 36 / 37 四条触发方式写错；「3 条被堵死」实为 1 条；42 号漏了「必须靠负黑洞」 |
| apx_notation | 16 | 16 | 已核-1 处（错 1） | 工程记数法例子 `12.3e44` 违反「指数为 3 的倍数」 |
| apx_bilingual | 46 | 46 | 已核-3 处（错 2）+ 1 条无法核实 | 前提「英文界面」不成立；天神导航应为「天神地图」；自动化出现条件不对 |

合计：**28 处问题**（错误 12 / 过时 3 / 易误导 13），另 **1 条无法核实**。

---

## 三、代码与教程矛盾（最关键产出，逐条给出「代码实际值 vs 教程值」）

1. **币种矛盾**：复制器「星系上限」升级 —— 教程「1e170 **复制器**起，付的是复制器不是无限点数」 vs 代码 `player.js:392` `galCost: DC.E170` + `ReplicantiTab.js:94`「价格：… **无限点数**」。这会让玩家在复制器阶段错误攒复制器而不攒 IP。
2. **页签路径矛盾（2 处）**：「无限 → 无限维度」（ch06 steps[5]/done）、「永恒 → 时间维度」（ch08 steps[0]）在 `tabs.js` 中都不存在，二者都是「维度」的子页签（`:17-29`、`:30-41`）。按教程操作会找不到入口。
3. **精度矛盾**：复制器星系门槛 / 永恒门槛 —— 教程写 1.797e308，代码判 `Decimal.NUMBER_MAX_VALUE` = **1.7976931348623157e308**（`replicanti.js:553`、`player.js:958-963`）。二者相差 0.07%，按字面数字理解会导致「明明到了却点不动」。
4. **触发方式矛盾（附录 B 4 条）**：21 号是「点击显示」而非「购买」；26 号在本作不可达（`game.js:853` 无开关判定）；36 号门槛是 600 **游戏**秒而非 1000 真实秒；37 号的树串是「时间研究树」而非 `tree`。
5. **机制归属矛盾（附录 A 2 条）**：反物质星系的作用对象是**计数频率**（`tickspeed.js:55-66`），不是维度倍率；无限之力是 **ID1 产出 + AD×(IP^7)**（`antimatter-dimension.js:15`、`h2p.js:408`），不是「复制器阶段的货币」。
6. **前提矛盾**：附录 D 假设「英文界面」，但 Web 端 `tabs.js` 全部硬编码中文、无 i18n 代码，该前提在本仓库不成立；且「天神导航」与 Android 官方「天神地图」（`strings.xml:4098`）不一致。
7. **门槛矛盾**：膨胀研究 1 —— 教程只写「12900 TT + EC11/EC12 各 5 次」，代码还要求 `231~234` 任一（`dilation-time-studies.js:14-20`）。只按教程刷 TT 会以为「够了却买不了」。
8. **自动化窗口矛盾**：教程仍用「首次永恒之前 / 现实解锁前」描述 308→30 缩放与反物质保留，代码判据都已换成 `isOrekiBootstrapRun()`（现实未解锁**或**本现实未买回 DS6）与「非天神现实/非挑战/非毁灭态」（`game.js:149`、`oreki-keep-antimatter.js:41-68`）—— 现实之后每轮重爬同样生效。
9. **开关归属矛盾**：「有 3 条被自动化堵死」；实际上 `oreki-instant-challenges` 是唯一**不看总开关**的模块（`game.js:853`），其余自动化都判 `autobuyersOn`（`oreki-eternity-automation.js:136`、`oreki-early-automation.js:58`），所以能被「关掉开关」绕过的 36 / 42 不该算「堵死」。
10. **同章自相矛盾**：ch07 steps[5]「自动永恒…不等任何间隔、不需要你点」 vs ch08 numbers[7]「本次收益 ≥ 当前 EP ×10 才重置」；代码以后者为准（`oreki-eternity-automation.js:627`）。

---

## 四、无法核实（不猜）

| 单元 | 位置 | 内容 | 原因 |
|---|---|---|---|
| apx_bilingual | 二、视觉效果 / 游戏玩法 两行 | 「Visual / Gameplay」与官方中文的对应 | Android 官方 `values-zh-rCN/strings.xml` 里 `>视觉效果<`、`>游戏玩法<` 均 0 命中（rg 全文件），没有官方中文基准可比；Web 端也不存在对应英文界面 |

补充说明（可核实但非本次实跑）：

- ch03 numbers[3]「首次无限 4 秒」、ch04 numbers[6]「无限→打破 4→5 秒」、ch05 numbers[11]「5 秒」、ch06 numbers[6]「ID1~8 全解锁 10 秒」：与 `web/_tools/_r21-300.jsonl` 的里程碑行（`{"milestone":"首次无限","t":4}` … `{"milestone":"ID1-8 全解锁","t":10}`）一致，但本轮为只读静态核验、未实跑，故按【合理推断】记，不计入错误。

---

## 五、核验为真的高价值项（摘要，供台账背书）

- 无限点数：`player.js:958-963` 门槛 `Decimal.NUMBER_MAX_VALUE`；`game.js:161-163` 未打破 = `308/30 ≈ 10.27` 再 `floor()`（`game.js:192`），打破后 `10^(log10(maxAM)/30 − 0.75)` —— 与 ch03 numbers[1]/[2]、ch05 numbers[12] 完全一致（教程的「取整后」是对的）。
- 自动购买器间隔：`autobuyer.js:165-177` 成本 ×2、间隔 ×0.6、下限 100 ms；`150000 × 0.6^14 ≈ 117.5` 未到 100，第 15 级落到 70.5 被截成 100；累计 `2^15 − 1 = 32767` —— 与 ch05 numbers[1]~[4] 逐位一致。
- 打破无限：`game.js:94-104` 前置 `hasMaxedInterval`、翻转开关、免费拉满全体间隔；`BreakInfinityButton.js:27` 文案「已打破无限」；`AutobuyerIntervalButton.js:31-52` 满级后按钮**整块消失**（`v-if="!isMaxed && isUpgradeable"` / `v-else-if="!isMaxed"` 双假）—— 与 ch04 steps[6]、ch05 steps[1] 一致。
- 12 个打破无限升级：9 一次 + 3 可重复（1e6/×5/8 级、1e7/×5e3/7 级、1e7/×10/10 级）—— ch05 numbers[8]/[13]、table 全部一致。
- 无限维度：`infinity-dimension.js:41-57` 阈值 `1e1100…1e60000`、成本 `1e8…1e280`、涨幅 `1e3…1e30`；ID1 需 IP ≥ 1e8 —— ch06 numbers[0]/[1]/[7]、table 全部一致。
- 无限挑战：`infinity-challenges.js` 解锁 `1e2000…1e28000`、目标 `1e650…1e27000`；IC2 解锁献祭自动器（`sacrifice-autobuyer.js:12-14`）—— ch06 一致。
- 复制器：`player.js:383-393` 初始 1 / 1% / 1000 ms；`replicanti.js:343-352` 概率 +1%/×1e15/上限 1；`:383-402` 间隔 ×0.9/×1e10/下限 50；`:266-272` `log2(amount)²` 且乘到 ID（`infinity-dimension.js:25`）；解锁价 `1e140` —— ch07 numbers[0]~[4] 一致。
- 首次永恒 EP：`new Decimal(5).pow(308/30 − 0.7)` ≈ **4.87e6** —— ch07 numbers[7]「约 4.9e6」一致。
- 时间之理：`time-theorems.js:79-109` 1×2^n EP / 1×1e100^n IP / 1e20000×1e20000^n AM；`:111-116` 必须有 TD1（否则提示「你需要购买至少一个时间维度」）—— ch08 steps[0]/steps[2]/numbers[0]/[1]/[2] 一致（仅 steps[0] 的页签路径错）。
- 里程碑 1~10 与复制器自动器阈值（星系 3 / 概率 50 / 间隔 60 / 上限 80 次永恒）—— ch07 numbers[8]、ch08 table 一致（除第 6 行描述过简）。
- 附录 C：`Settings.exponentCommas = { show: true, min: 1e5, max: 1e9 }`（`modules/notations.js:14-18`）+ `player.js:790-795` `notationDigits: { comma: 5, notation: 9 }`；分支 `noSpecialFormatting(exponent) = exponent < min`（`:79-81`）、`showCommas = show && exponent < max`（`:82-84`）—— 附录 C §2 三分支与 1e5 / 1e9 默认值全对；对数记数法 ≥1e9 退化成 `ee`（`:496-501`）也成立。
- 附录 B 计数：普通成就 **144** 条（`normal-achievements.js`，id 11~188 有跳号）、隐藏成就 **32** 条（`secret-achievements.js`，id 11~48）—— 导语的 144 / 32 / 11~48 全对；14 号 `IEATASS` 实测 `sha512_256` = 表内 index 1 ✓；18 号 `Math.random() < 0.00001` 每秒一次（`intervals.js:63`）✓；46 号 `storedReal > 24*60*60*1000`（`enslaved.js:96`）✓；47 / 48 号触发点也都在（`tabs.js:232`、`AutomatorTextEditor.js:165`）。

---

## 六、附：源码行号漂移（不单独计为问题，但建议同步）

| 教程引用 | 实际位置 |
|---|---|
| `game.js:274-311`（开局自动化） | `game.js:284-319` |
| `game.js:141`（IP 除数）/ `:102` / `:139` | `game.js:149` / `:112` / `:149` |
| `game.js:182-193` / `:312-328`（ID1 兜底 / ID1 自动买） | `game.js:192-201` / `:325-337` |
| `game.js:397-400`（requiredIPForEP） | `game.js:407-410` |
| `oreki-eternity-automation.js:579-592` / `:591` / `:1-32` | `:607-633` / `:627` / `:802-824` |
| `dilation-time-study.js:72-74`（DS1 条件） | `dilation-time-studies.js:6-18` |
