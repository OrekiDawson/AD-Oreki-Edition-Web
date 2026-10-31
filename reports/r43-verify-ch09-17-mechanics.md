# R43 · Web 教程机制核验（第 9~17 章 + 附录 E/F/G）

核验人：r43-g2-verify-late（只读任务，未修改任何游戏源码/教程文本）
数据源：`src/core/oreki-tutorial-data.json`（schemaVersion=1）
代码基线：`web/AD-Oreki-Edition/src/**`；原版对照：`web/upstream/official/src/**`（同路径）
标记：【实测】= 可执行的常量/表达式直接读取；【静态推导】= 由代码路径推导；【无法核实】= 无代码依据或依赖实跑

---

## 一、问题清单

| 单元 | 位置 | 教程原文（截断） | 判定 | 代码证据 | 建议改法 |
|---|---|---|---|---|---|
| ch09 | table.rows[7][2]（EC8 行） | 「无限点数 1e4000 / 1e40」 | 错误 | `ec-time-studies.js:96` 基数 `DC.E1000.pow(n).times(DC.E4000)`；`ec-time-study.js:119-122` 引导窗口内 `base.div(100)` → 实际 **1e3998** | 「无限点数 1e4000 / 1e3998」 |
| ch09 | table.rows[8][2]（EC9 行） | 「无限之力 1e17500 / 1e175」 | 错误 | `ec-time-studies.js:108` 基数 `DC.E2000.pow(n).times(DC.E17500)`；÷100 → **1e17498**；`oreki-eternity-automation.js:432-433` 注释自证「门槛 1e17498」 | 「无限之力 1e17500 / 1e17498」 |
| ch09 | numbers[9].value（EC2） | 「1300（窗口内 13），每次完成 +150」 | 易误导 | `ec-time-studies.js:24` 每次 +150 是**除法前**；`ec-time-study.js:121` 窗口内 ÷100 → 每完成一次实为 **+1.5** | 「1300（窗口内 13），每次完成 +150（窗口内 +1.5）」 |
| ch09 | steps[0].text | 「同一帧内就把完成次数直接补到 5 次」 | 易误导 | `oreki-instant-challenges.js:218-221` 由 `game.js:853` 在循环中调用；本帧 `EternityChallenge.start()` 在 `game.js:883` 之后，实际是**下一帧**补满（模块头注释 `:4` 写「下一次游戏循环」） | 「进入后的下一次游戏循环内补到 5 次」 |
| ch09 | automation | 「oreki-dilation-automation.js 在 EC11 或 EC12 未满时压住自动现实」 | 错误 | `oreki-dilation-automation.js:169` `if (!EternityChallenge(11).isFullyCompleted) return this._release("shallow")` → 只有 **EC11 已满且 EC12 未满**才压现实；且受 240 s / 停滞 90 s / 冷却 10 s / 早期预算 120 s 限制（`:52-76`） | 「只在 EC11 已满、EC12 未满时压住现实（并有 240 s / 90 s 停滞 / 10 s 冷却的护栏）」 |
| ch10 | steps[1].text | 「本 MOD 在现实解锁前按 1/1000 缩放」 | 易误导 | `oreki-bootstrap.js:35-42` `isOrekiBootstrapRun()` = **现实未解锁 或 本现实未买回膨胀研究 6**；`dilation-time-study.js:48-50` 用的是这个判定 → 现实之后每次重爬同样生效 | 「在引导窗口内（现实未解锁，或本现实还没买回膨胀研究 6）」 |
| ch11 | numbers[8].value | 「RU16~RU20 = 1500 RM；RU21~RU25 = 100000 RM」 | 错误 | `reality-upgrades.js:9` `OREKI_REALITY_UPGRADE_COST_DIVISOR = 1000`；`:39-42` `get cost()` 对 id≥6 一律 `÷1000` → RU6~15 = **0.015/0.05 RM**、RU16~20 = **1.5 RM**、RU21~25 = **100 RM** | 「RU6~RU10 = 0.015 RM；RU11~RU15 = 0.05 RM；RU16~RU20 = 1.5 RM；RU21~RU25 = 100 RM（一次性 RU 统一 ÷1000）」 |
| ch11 | table.rows[5][1]（RU6） | 「15 RM」 | 错误 | 同上 → **0.015 RM** | 「0.015 RM」 |
| ch11 | table.rows[7][1]（RU9） | 「15 RM」 | 错误 | 同上 → **0.015 RM** | 「0.015 RM」 |
| ch11 | table.rows[8][1]（RU16~RU18） | 「各 1500 RM」 | 错误 | 同上 → **各 1.5 RM** | 「各 1.5 RM」 |
| ch11 | table.rows[9][1]（RU24） | 「100000 RM」 | 错误 | 同上 → **100 RM** | 「100 RM」 |
| ch11 | table.rows[10][1]（RU25） | 「100000 RM」 | 错误 | 同上 → **100 RM** | 「100 RM」 |
| ch11 | buyOrder[4]/[5]/[6]/[7] | 「RU9 词域扩张（15 RM）」「RU24（100000 RM）」「RU16/17/18 各 1500 RM」「RU25（100000 RM）」 | 错误 | 同上 | 分别改 0.015 / 100 / 1.5 / 100 |
| ch11 | traps[3] | 「现实会清空…时间研究与膨胀研究（保留 TT 之外的一切）」 | 错误 | `reality.js:669` `Currency.timeTheorems.reset()`（TT 一并清空）；`:672-681` 膨胀研究/膨胀升级/TP 清空；`:690-695` DT/各层货币清空 —— 现实清掉的东西远不止这三项 | 「现实会清空 EC 完成记录、时间研究与 TT、膨胀研究/升级、TP/DT 与各层货币；只有复兴节点、符文、成就与永久记录保留」 |
| ch11 | steps[5].text + numbers[9].value | 「RU16/17/18 各要「恰好 4 个特定形态的符文」」 | 错误 | `reality-upgrades.js:150-176` `OREKI_RELAXED_REALITY_UPGRADES` 豁免 **18 / 20 / 21**：RU18（4 个 ≥10 级符文）在本作到达现实后即解锁，不再校验形态 | 「RU16/RU17 要「恰好 4 个」；RU18 在本作被豁免（原版要 4 个 10 级符文）」 |
| ch11 | numbers[9].value | 「装第二个符文或装 <3 级的单符文会永久锁死」 | 易误导 | `reality-upgrades.js:128-131` `hasFailed` 还有第三条：**0 个符文且仓库里没有 ≥3 级符文** 也判失败 | 补一句「0 个符文且仓库无 ≥3 级符文同样会锁死」 |
| ch12 | numbers[0].value | 「clamp(现实次数^(1/3), 1, 20)，向下取整」 | 易误导 | `reality.js:318` 无 `floor`；`currency.js:410-413` perkPoints 是普通 Number，可累加小数 | 去掉「向下取整」，或写明「不取整，小数累计」 |
| ch12 | steps[8].text + numbers[4].value | 「自动点数来源：现实 +2/黑洞 +10/RU10 15/RU25 100；第 50 次现实自己就开」 | 错误 | `perks.js` 21 个复兴节点带 `automatorPoints`（SEP1 5、SEP3 10、STP 5、REAL 10、TP4 10、ECB 15…），`automator-points.js:11-31` 计入 totalPoints；现实次数项 `automator.js:543` `2*clampMax(realities,50)` 只是其中一项 → 实际远早于 50 次现实 | 「来源还包括复兴节点（21 个节点各带 5~15 点），实际解锁通常远早于 50 次现实」 |
| ch12 | steps[8].text | 「凑到 100 就解锁『自动机 / Automator』页签」 | 易误导 | `tabs.js:174-183` 该子页签条件只有 `PlayerProgress.realityUnlocked()`；100 点门槛在 `player.js:1001-1003`，`AutomatorTab.js:64,109` 用 `v-if="automatorUnlocked"` 决定显示**编辑器**还是点数清单 | 「页签在解锁现实后就出现；100 自动点解锁的是脚本编辑器」 |
| ch13 | numbers[5].value | 「词条数是所有已装备非同伴符文的『效果位』去重后的总个数」 | 易误导 | `effarig.js:180-189` 分两组（生成类 / 非生成类）各自 OR 后计数再相加 —— 同一效果位可被计两次 | 「生成类符文并集的效果位数 + 非生成类符文并集的效果位数」 |
| ch15 | steps[4].text | 「间隔…最低压到 10 秒」 | 错误 | `dark-matter-dimension.js:45-46` `intervalPurchaseCap = 10`、`:58` `clampMin(cap, rawInterval)`；`rawInterval` 单位是毫秒（`:49-55` `1000*tierFactor*…`）；`DarkMatterDimensionRow.js:97` UI 原文「间隔已达到上限 10 **毫秒**」 | 「最低压到 10 毫秒」 |
| ch15 | numbers[6].value | 「…最低压到 10 秒」 | 错误 | 同上 | 「最低压到 10 毫秒」 |
| ch15 | table.rows[1][2] | 「4 层；四层起始价…」同行未提间隔单位；buyOrder[2]「每层先把『间隔』买到 10 级上限」 | 错误 | `intervalPurchaseCap` 是**间隔的下限值（10 ms）**，不是「10 级」；从 1000 ms 压到 10 ms 需 `log(0.01)/log(0.92)≈55` 次（`:175` `maxIntervalPurchases`） | 「把间隔一直买到 10 毫秒（约 55 次）」 |
| ch15 | steps[5].text | 「飞升…暗物质强度与暗能量强度各 +500」 | 错误 | `dark-matter-dimension.js:19-20` `POWER_DM/DE_PER_ASCENSION = 500`；`:96` `.times(Math.pow(powerDMPerAscension, ascensions))`、`:94` `.times(Math.pow(500, ascensions))` → **每次飞升 ×500（幂乘）** | 「每次飞升使暗物质强度与暗能量强度各 ×500」 |
| ch15 | numbers[7].value / table.rows[2][2] / traps[3] | 「每次 +500 暗物质强度、+500 暗能量强度」 | 错误 | 同上 | 改「×500」 |
| ch16 | automation | 「毁灭（进入佩勒）与末日（重置）仍要你自己确认」 | 错误 | `oreki-endgame-automation.js:445-451` `Pelle.initializeRun()`（与 UI「毁灭」同路径）；`:583-585` `Pelle.armageddon(true)` 在 `canArmageddon` 且停滞时自动执行 | 「毁灭与末日由 oreki-endgame-automation 自动执行（受自动购买器总开关控制）；手动点只是另一种选择」 |
| ch16 | steps[2].text / steps[4].text / traps[1] | 「点『毁灭』」「『末日』是佩勒层的重置」暗示需手动 | 易误导 | 同上 | 标注「通常已被自动化按下」 |
| ch17 | steps[3].text / table.rows[10][2]（21） | 「买下时间研究 11 左侧的隐藏研究/隐藏格」 | 错误 | `SecretTimeStudy.js:44-56`：点一下**显示**该隐藏研究即解锁成就 21，不购买、不消耗 TT | 「点击时间研究 11 左侧那格看不见的研究把它显示出来」 |
| ch17 | steps[3].text / table.rows[15][2] / numbers[4]（26） | 「手动进 EC4 反复超限失败 10 次」 | 错误 | `game.js:853` 每帧无条件调用 `tryInstantCompleteChallenges()`；`oreki-instant-challenges.js:147-171` 无 `player.auto.autobuyersOn` 判定；`eternity.js:194` 进入即把无限次数清零 → EC4 永远在下一帧补满，**无法失败** → 成就 26 在本作不可达 | 改为「本 MOD 下 26 号无法解锁（进入即完成不区分总开关），不要为它折腾」 |
| ch17 | numbers[7].value / traps[3] | 「离线 16 分 40 秒且期间没有任何进度」 | 错误 | `game.js:1269` `if (seconds > 600)` 才弹离线窗；`:1281` `seconds *= getGlobalSpeedFactor()` → 门槛是 **600 游戏秒**，默认 10000× 时约 0.06 真实秒；1000 s 无任何常量对应 | 「离线时间 × 全局倍率 > 600 游戏秒（默认 10000× 时几乎立刻满足）」 |
| apx_blockers | 第 8 行「自动现实把永恒挑战打断」 | 「膨胀自动化在 EC11 或 EC12 未满时会压住现实」 | 错误 | 同 ch09（`oreki-dilation-automation.js:169`） | 同 ch09 改法 |
| apx_blockers | 第 13 行「你真失败」 | 「关掉自动购买器，手动进 EC4 反复超限」 | 错误 | 同 ch17（`game.js:853` + `oreki-instant-challenges.js` 无开关判定） | 「本 MOD 下无法获得」 |
| apx_blockers | 第 9 行「现实按钮一直灰着」 | 「解锁现实的三条件：TD8 / EP 指数 4000 / 全部前期成就」 | 易误导 | 三条是**膨胀研究 6** 的条件（`dilation-time-studies.js:44-55`）；「现实」按钮本身只判 `maxEP.exp>=4000 && TimeStudy.reality.isBought`（`reality.js:119-121`） | 「膨胀研究 6（解锁现实）要 TD8 + EP 指数 4000 + 成就；按钮本身只看后两条」 |
| apx_blockers | 第 1 行「反物质停在 1.80e308」 | 「把大坍缩自动购买器间隔拉到 100 毫秒…打破无限会自己触发」 | 易误导 | `oreki-break-infinity-gate.js:60-118` 会自动拉满间隔并（非毁灭态）补足 32767 IP，随后由 AD5b 调 `breakInfinity()` —— 总开关开着时不需要手动拉间隔 | 「确认自动购买器总开关开着即可；本 MOD 会自动拉间隔并打破无限」 |
| apx_automation | 整节（字段 `auto`） | 字段值为字符串 `"automation"` | 错误 | `oreki-tutorial-data.json` `appendices[5].auto === "automation"`，无 `body`；`OrekiTutorialModal.js:81` 只读 `appendix.body` → **附录 F 整页空白** | 把汇总文本写进 `body`（或渲染器支持 `auto` 字段） |
| apx_changes | 三-1 行（暗物质维度） | 「间隔升级…压到 10 秒」「飞升 +500 / +500」 | 错误 | 同 ch15（`dark-matter-dimension.js:45,58,94-96`） | 「压到 10 毫秒」「飞升 ×500 / ×500（与原版一致，教程此前描述有误）」 |
| apx_changes | 一-4 行（膨胀研究 TT） | 「（现实后重建窗口内）」 | 易误导 | `oreki-bootstrap.js:35-42`：窗口 = 现实未解锁 **或** 本现实未买回 DS6 | 「（引导窗口内：现实未解锁，或本现实未买回膨胀研究 6）」 |
| apx_changes | 一-1 / 一-2 行 | 「首次永恒前的无限点数尺度 308→30」「现实之前的永恒点数尺度 308→30」 | 易误导 | `game.js:149` / `:389` 用的是 `isOrekiBootstrapRun()`，不是「首次永恒前/现实之前」；现实之后每次重爬同样生效 | 「引导窗口内 308 → 30」 |

---

## 二、逐单元覆盖率与状态

| 单元 | 断言条数 | 已核条数 | 结论 | 主要问题 |
|---|---|---|---|---|
| ch09 | 44 | 44 | 已检-待修(5) | EC8/EC9 窗口内门槛写错（1e40/1e175），EC2 完成增量未按 ÷100 折算 |
| ch10 | 26 | 26 | 已检-待修(1) | 「现实解锁前」应为「引导窗口内」（现实后每轮重爬同样缩放） |
| ch11 | 37 | 37 | 已检-待修(10) | 一次性现实升级价格全部按原版写（实际统一 ÷1000）；RU18 已被豁免；现实不清 TT 的说法反了 |
| ch12 | 37 | 37 | 已检-待修(3) | 自动点数来源漏了复兴节点；「100 点才出页签」应为「100 点才出编辑器」；perk 点数不向下取整 |
| ch13 | 29 | 28 | 已检-待修(1) | 碎片词条数不是全局去重（两组分别去重再相加）；1 条量级类断言无法核实 |
| ch14 | 28 | 27 | 已检-无问题 | 六项门槛、空间定理、太阳神公式全部对上；1 条「其余五项 15 次现实达标」为经验值无法核实 |
| ch15 | 33 | 33 | 已检-待修(5) | 暗物质维度间隔下限是 10 **毫秒**不是 10 秒；飞升是 ×500 不是 +500（含表格与 traps） |
| ch16 | 27 | 27 | 已检-待修(2) | 毁灭与末日实际由自动化执行，教程说「要你自己确认」 |
| ch17 | 60 | 59 | 已检-待修(3) | 成就 21 是点击显示不是购买；成就 26 在本 MOD 不可达；成就 36 的「16 分 40 秒」与 `seconds > 600` 不符 |
| apx_blockers | 19 | 19 | 已检-待修(4) | 第 8/13 行原因写错；第 9 行把膨胀研究 6 的三条件当成按钮条件；第 1 行把已自动化的步骤写成手动 |
| apx_automation | 1 | 1 | 已检-待修(1) | 字段 `auto` 与渲染器 `body` 不匹配 → Web 端整页空白 |
| apx_changes | 20 | 20 | 已检-待修(4) | 暗物质维度那行（10 秒 / +500）与「与原版逐行相同」矛盾；两处「窗口」定义过窄 |

> 说明：`已检-待修` 不在台账现有枚举（已检-无问题 / 已检-已修复 / 无法核实）内，建议并入台账时新增该状态或记为「待核验」并在备注写「已定位 N 处错误」。

---

## 三、代码与教程矛盾（最关键产出）

1. **一次性现实升级价格**：教程用原版价（15 / 50 / 1500 / 100000 RM），代码对 id≥6 一律 ÷1000（`reality-upgrades.js:9,39-42`），实际 0.015 / 0.05 / 1.5 / 100 RM。影响 ch11 的 1 条数值 + 6 行表格 + 4 条购买顺序，以及 ch12「买 RU20（1500 RM）」。
2. **暗物质维度间隔下限**：代码 `intervalPurchaseCap = 10` 是毫秒（`dark-matter-dimension.js:45,58`；UI 文案 `DarkMatterDimensionRow.js:97` 自称「10 毫秒」），教程全篇写「10 秒」。
3. **飞升收益**：`Math.pow(500, ascensions)`（`dark-matter-dimension.js:94-96`）是幂乘，教程写「各 +500」。
4. **成就 26 不可达**：`tryInstantCompleteChallenges()` 不受自动购买器总开关控制（`game.js:853`、`oreki-instant-challenges.js:147-171`），EC4 进入即满，永远不失败；教程却给了「关总开关手动失败」的解法。
5. **附录 F 空白**：`appendices[5]` 只有 `auto: "automation"`，渲染器只读 `body`（`OrekiTutorialModal.js:81`）。
6. **自动化归属错位**：佩勒「毁灭/末日」已自动化（`oreki-endgame-automation.js:445-451,583-585`），教程写「仍要你自己确认」；反之 ch09 把「EC11 才压现实」写成「EC11 或 EC12 未满就压」。
7. **成就 36 阈值**：`seconds > 600` 游戏秒（`game.js:1269`，`:1281` 已乘倍率），与「16 分 40 秒」无对应关系。
8. **成就 21 语义**：点击显示隐藏研究即解锁（`SecretTimeStudy.js:44-56`），无需购买。

---

## 四、无法核实项（不猜）

| 单元 | 位置 | 原文 | 原因 |
|---|---|---|---|
| ch13 | steps[5].text 末句 | 「前几次现实就能买下（鹿颈长四个解锁位）」 | 依赖实跑碎片产量，无静态依据 |
| ch14 | steps[1].text | 「其余五项通常在现实次数 15 上下就已经达标」 | 经验值，代码只定义门槛不定义达成时点 |
| ch17 | numbers[7].text / table.rows[15][2]（32） | 「自动化跑起来自然达成（最速无限 ≤1 ms）」 | 需实跑 `Time.bestInfinity.totalMilliseconds` |
| ch17 | table.rows[22][2]（33） | 「在商店页点购买硬币」 | 商店页签条件是 `Cloud.isAvailable`（`tabs.js:486`），部署环境未验证 |
| ch12 | entry / 全章 | 「现实次数 ≥ 3、RM 在 1e4 量级」 | 阶段描述，非代码常量 |
| apx_automation | — | 无正文可核 | 字段缺失，除「空白」外无法逐条核验 |
