# R32 鹿颈长阶段 1 → 阶段 2 阻塞诊断（源码只读）

- 诊断角色：Agent A（只读，无浏览器 / 无构建 / 未改任何 `src/`）
- 代码根：`C:\Users\Oreki\WorkBuddy\AD-Oreki-Unified\web\AD-Oreki-Edition`
- 数据源：`web/_tools/_r30-nerf.jsonl`（R31，600 s 真实新档，597 采样，effarig run 占 t=165→599 共 427 采样）
- 全部结论均标注证据等级：`[源码事实]` / `[静态推导]` / `[合理推断]` / `[实测数据]`（R31 jsonl 读数）

---

## 0. 结论先行（一句话）

**把 `OREKI_EFFARIG_NERF_DIVISOR` 从 100 提到 1e6，在鹿颈长阶段 1 里是数学上的 no-op**：`nerfFactor` 的自变量是 `Currency.infinityPower.value`，而阶段 1 里无限维度全锁（`ids=[0]*8`）、现实重置又把它清零，于是 `pLog10(0) = 0` → `sqrt(0)=0` → `c/(c+0)=1` → `nerfFactor ≡ 0` **与 `c` 无关**，`multDilation` 恒为 **0.25**、`tickDilation` 恒为 **0.7**。1e6 只改了 `c`，改不动 0.25。真正该改的是 `src/core/celestials/effarig.js:216` 的一行（`Math.sqrt(Math.max(1, power.pLog10()))`）。

---

## 1. 头号结论：1e6 无效的完整证据链

### 1.1 削弱是在「指数」上生效的，不是在数值上

`src/core/celestials/effarig.js:199-231` `[源码事实]`

```js
199:  nerfFactor(power) {
...
215:    c /= OREKI_EFFARIG_NERF_DIVISOR;          // ← 1e6 只改这里
216:    return 3 * (1 - c / (c + Math.sqrt(power.pLog10())));
217:  },
218:  get tickDilation() { return 0.7 + 0.1 * this.nerfFactor(Currency.timeShards.value); },
221:  get multDilation() { return 0.25 + 0.25 * this.nerfFactor(Currency.infinityPower.value); },
228:  multiplier(mult) {
229:    const base = new Decimal(mult).pLog10();
230:    return Decimal.pow10(Math.pow(base, this.multDilation));
231:  },
```

`src/core/dimensions/antimatter-dimension.js:77-78` `[源码事实]` —— 每个 AD 维度的**最终**乘子都要过这道 0.25 次方：

```js
77:  if (Effarig.isRunning) {
78:    multiplier = Effarig.multiplier(multiplier);
79:  } else if (V.isRunning) {
```

### 1.2 `pLog10(0) === 0`（库事实）

`modules/break_infinity.js:1289-1291` `[源码事实]`

```js
Decimal.prototype.pLog10 = function () {
  return this.m <= 0 || this.e < 0 ? 0 : this.log10();
};
```
→ 值 0 返回 0；**0 到 1 之间也返回 0**。

### 1.3 阶段 1 里 `Currency.infinityPower` 恒为 0

- **穷举写入点（`rg -n "infinityPower" src/ | grep -v components`，全仓仅 4 处写入，其余全是读）** `[源码事实]`：
  - `src/core/dimensions/infinity-dimension.js:342` `Currency.infinityPower.reset();`（`resetAmount()` 内）
  - `src/core/dimensions/infinity-dimension.js:382` `InfinityDimension(1).produceCurrency(Currency.infinityPower, diff);` ← **唯一产出**
  - `src/core/eternity.js:206` `Currency.infinityPower.reset();`（永恒重置，阶段 1 不发生）
  - `src/core/reality.js:635` `Currency.infinityPower.reset();`（进 run 的 `beginProcessReality()` 必过）
  - Big Crunch 还会经 `big-crunch.js:164 InfinityDimensions.resetAmount()` 再清一次
  - **没有任何时间研究 / 符文 / 成就 / 商店写入它**
- `reset()` 的落值是**精确 0**：`currency.js:195` `DecimalCurrency.startingValue = DC.D0`（不是 1）
- 唯一产出需要 ID1 解锁（`maxAM ≥ 1e1100`）；R31 实测 `ids = [0,0,0,0,0,0,0,0]`、`id1u=false` 全程 → 产出口每帧加 0 `[实测数据]`

→ **阶段 1 内 `power` 严格恒 0**（不是「很小」，是恒等 0）。同理 `tickDilation` 的自变量 `Currency.timeShards` 也是 0（`reality.js:636` 清零，永恒前没有时间维度）。

**注意这里是「断崖」不是「渐变」**（`[静态推导]`，c=1.5e-3）：`pLog10(1) = 0`（m=1,e=0 → log10(1)=0），因此

| infinityPower | 0 或 1 | 1.0001 | 1.01 | 2 | 10 |
|---|---|---|---|---|---|
| multDilation | **0.25000** | 0.86094 | 0.98327 | 0.99796 | 0.99888 |

→ 判据可以写得更强：**只要 `infinityPower ≤ 1`，multDilation 就是 0.25；一旦 >1 立刻跳到 0.86+**。所以「阶段 1 是否恒 0」不需要逐帧追产出口，只需证明「没有任何写入能把值抬到 >1」，而 ID1 未解锁已经足够。

**修复后的连续性（重要，避免验收误判）** `[静态推导，已数值验证]`：`Math.max(1, ·)` 把钳位点放在 `s = 1`，而原函数在 `s = 1` 处的值恰好就是钳位值，所以复合函数在 `s = 1` **连续**（只有导数拐点，没有跳变）。原先 1 处 0.25 → 0.86 的 **0.61 跳变被彻底消除**，全域变成：

| infinityPower | 0 / 1 / 9.99 / 10 | 1e2 | 1e6 | 1e136 |
|---|---|---|---|---|
| 修复后 multDilation | **0.99888** | 0.99921 | 0.99954 | 0.99990 |

即 **全域波动 0.99888 ~ 0.99990，跨度仅 0.001**，不存在「0.9~1.1 抖动 → 产出抽风」的风险。
（与 Agent B 的初判有出入：钳位不会「只是把跳变挪到 1」，而是把跳变抹平；无需引入 `pLog10 + 1` 之类的软下限，那样反而偏离 Web 语义。）

**验收签名表**（下一轮直接对号入座，不接受「涨了一点」）=`[静态推导]`

| 观测 `effMult` / `effTick` | 判定 |
|---|---|
| **0.2500 / 0.7000** | 未修（R31/R32 现状，1e6 单独无效） |
| **0.2505 / 0.7002** | 只加了 `max(1,·)`，缺除数（Android 只做一半时的签名） |
| **0.99888 / 0.99955** | 除数 + max 均到位 = 正确 |
| 0.99954 / 0.99986 | 只有除数、无 max，且 `infinityPower ≈ 1e6`（瞬态） |
| 0.99990 | 只有除数、无 max，且 `infinityPower ≈ 1e136` |

### 1.4 数值代入：1e6 与 100 结果完全相同

`node -e` 直接跑公式（`c = 1500 / divisor`）`[静态推导，已数值验证]`

| `Currency.infinityPower` | 原式 √pLog10 | nerfFactor | multDilation | tickDilation |
|---|---|---|---|---|
| **0（阶段 1 实际值）** | 0 | **0** | **0.25000** | **0.70000** |
| 1 | 0 | 0 | 0.25000 | 0.70000 |
| 1e10 | 3.162 | 2.9986 | 0.99964 | 0.99986 |
| 1e136 | 11.66 | 2.9996 | 0.99990 | 0.99996 |

也就是说：**只有 `infinityPower ≥ 10` 以上，`divisor` 才开始起作用**；而阶段 1 到结束那一刻都不可能有无限维度。文件头 `effarig.js:93-116` 那段「divisor=1e6 时 sqrt≈11.66」的推导，代入的是 `pLog10 = 136`（= 反物质的指数），**但源码实际传进去的是 `Currency.infinityPower`，不是反物质**。这是 1e6 取值推导里的一个变量错配。

### 1.5 这个 0.25 能解释 R31 的全部数字

`multDilation = 0.25` 时，一个 1e170 的 AD 乘子会被压成：

```
10 ^ (170 ^ 0.25) = 10 ^ 3.62 ≈ 4.2e3
```

`[静态推导]` 即 **每个 AD 乘子的指数被削掉约 166 个数量级**，整个 AD 连乘链退化到「~1e3 量级常数」，只剩 tickspeed 与 AD 数量的线性叠加 —— 于是反物质在对数空间里**近似线性上升**，正好对应实测：

| 区间 | maxAM 变化 | 速率 |
|---|---|---|
| t=165→318（维度提升还在动） | 1e93.06 → 1e156.9 | 0.41 数量级/s |
| t=318→599（维度提升冻结） | 1e156.9 → 1e171.86 | **0.053 数量级/s（线性）** |

`[实测数据]` 按 0.053/s 线性外推，从 1e93 到 1e308 需 **≈ 4050 s ≈ 68 分钟**，这只是阶段 1；阶段 2（ETERNITY）与阶段 3（REALITY）还要各来一遍 → 180 分钟墙钟内不可能完成。这与 R30「90 s 只爬 18 个数量级」、R31「560 s 只爬 34 个数量级」完全自洽。

---

## 2. 第二瓶颈候选（按可能性排序，全部带行号）

### B1（决定性）`nerfFactor` 自变量取错 + `pLog10(0)` 退化 → 1e6 无效

- 位置：`src/core/celestials/effarig.js:216`（以及 `:219` / `:222` 的取值源）
- 证据等级：`[源码事实]` + `[静态推导]` + `[实测数据]`
- 影响量级：multDilation 0.25 → 0.99888，**每个 AD 乘子恢复约 166 个数量级**，聚合后远超阶段 1 缺的 122 个数量级（1e171.9 → 1e308.25）。
- 这是「第二瓶颈」还是「第一瓶颈还在」：**是后者**。1e6 这轮实验即使跑满 600 s，`effarigStage` 仍会是 1，因为公式根本没被改动到。

### B2 自动坍缩策略把阶段 1 的实际目标从 1e308 抬到 ≈ 1e824

- `src/core/autobuyers/big-crunch-autobuyer.js:122-148` `[源码事实]`

```js
122:  get willInfinity() {
123:    if (!player.break || Player.isInAntimatterChallenge) return true;
...
139:    switch (this.mode) {
140:      case AUTO_CRUNCH_MODE.AMOUNT: return gainedInfinityPoints().gte(this.amount);
...
144:      case AUTO_CRUNCH_MODE.X_HIGHEST:
145:      default: return gainedInfinityPoints().gte(this.highestPrevPrestige.times(this.xHighest));
```
`get highestPrevPrestige() { return player.records.thisEternity.maxIP; }`（`:114-116`）

- R31 实测：`bcMode = 2`（X_HIGHEST，`xHighest = 10`，由 `:190-191` 的 `reset()` 写入）、`brk = true` 全程、`maxIP = 1e25.699` 从 t=199 起冻结 `[实测数据]`
- 阶段 1 里 `totalIPMult()` 被硬编码成 1：`src/core/infinity-upgrades.js:83-86` `[源码事实]`

```js
83: export function totalIPMult() {
84:   if (Effarig.isRunning && Effarig.currentStage === EFFARIG_STAGES.INFINITY) {
85:     return DC.D1;
86:   }
```
- IP 收益：`src/game.js:138,150-156` `[源码事实]`，`div = 30`（`isOrekiBootstrapRun()` 在 run 内为 true：`TimeStudy.reality` 未买，`oreki-bootstrap.js:35-47`）

```
IP_gain = 10 ^ (log10(maxAM)/30 − 0.75) × 1
判据：IP_gain ≥ 10 × maxIP = 1e26.699
⇒ log10(maxAM) ≥ (26.699 + 0.75) × 30 = 823.5
```
`[静态推导]`

**结论：`canCrunch` 只要 1e308.25，但自动坍缩要等到 maxAM ≈ 1e823.5 才会真的按下去 —— 多出 515 个数量级。** 在 maxAM = 1e308 时 IP 收益只有 1e9.52，差 17.2 个数量级。

同时注意 `:123` 那行：`if (!player.break) return true`。现实重置本会把 `player.break` 置 false（`reality.js:633`），若保持 false，自动坍缩会在 1.8e308 立刻触发；但 `game.js:195-202`（AD5 自动 Break）在 run 内又把它翻了回来（实测 `brk=true`），**这条「帮忙」的自动化恰好让 B2 生效**。两个模块的交互是这个问题一直没被看见的原因。

补充：`Player.canCrunch` 本身干净 —— `src/core/player.js:954-959` 只判 `thisInfinity.maxAM >= Decimal.NUMBER_MAX_VALUE`，无 `player.break` 前置 `[源码事实]`（与任务书的既有结论一致，未发现其它 `player.break` 守卫导致 `bigCrunchReset` 早退；`big-crunch.js:53,55` 只判 `canCrunch`）。

### B3 `OrekiKeepAntimatter` 在 celestial reality 里被关掉 → 每次维度提升/星系重置清零反物质

- `src/core/oreki-keep-antimatter.js:53` `if (isInCelestialReality()) return false;` `[源码事实]`
- 消费点：`src/core/dimboost.js:210-214`

```js
210:  if (!forcedAMReset && (canKeepAntimatter || OrekiKeepAntimatter.active)) {
211:    Currency.antimatter.bumpTo(Currency.antimatter.startingValue);
212:  } else {
213:    Currency.antimatter.reset();
214:  }
```
- 实测：run 内 `Currency.antimatter` 出现 **48 次对数级下跌**（t=165→599），每次 `dimensionBoosts` 跳变（如 t=175 db 16→17 时 am 1e128.05→1e117.77，跌 10.3 个数量级）`[实测数据]`
- 更关键的对照：**进 run 前** t=164 `dimensionBoosts = 1,252,425`；**进 run 后** 从 12 涨到 23 就冻结（t=318 之后 281 s 一动不动）`[实测数据]`
- 冻结的机制是硬锁，可精确定位 `[源码事实]`：
  - `dimboost.js:126` `amount += Math.round((targetResets - 5) * perBoost);`（`perBoost = 5`，AD1 改动）
  - db=23 时要求 AD8 `totalAmount ≥ 20 + 18×5 = 110`
  - 实测 AD8 从 t=339 起冻结在 **100**（正好是「买 10」的整数倍），260 s 没再动过 → 要求 110 永远达不到 → 维度提升永久停在 23 `[实测数据]`

也就是说：run 内因为反物质被反复清零，AD8 永远买不起第 11 组，维度提升这条乘数引擎彻底停转。**这是 B1 的下游后果**，但独立来看也是一处真实的状态死锁，且 1e6 改不动它（因为 1e6 没生效）。

### B4 `tickDilation` 同根：阶段 1 里 `Currency.timeShards = 0` → 恒 0.7

- `effarig.js:219` + `tickspeed.js:143-148` `[源码事实]`

```js
143:  get current() {
144:    const tickspeed = Effarig.isRunning
145:      ? Effarig.tickspeed
```
- `Effarig.tickspeed = (10 ^ (base ^ tickDilation)) ^ -1`，`base = 3 + log10(1/Tickspeed.baseValue) ≈ 0.0509 × totalUpgrades`
- 0.7 vs 0.9996：以 `totalUpgrades = 200`、`base ≈ 10.2` 计，`10^(10.2^0.7) = 1e5.06` vs `10^(10.2^0.9996) = 1e10.2` → **5.1 个数量级**的每秒步进差 `[静态推导]`
- 同一行修复（B1 的 `Math.max(1, …)`）即可一并解决，因为 `pLog10(timeShards=0)` 也会被抬到 1。

### B5 `isInCelestialReality()` 全量使用点核查（是否误关关键自动化）

`rg -n "isInCelestialReality" src/` 的**非 UI** 调用点逐个判定 `[源码事实]`：

| 位置 | 是否 `return` 早退 | 影响阶段 1 的生产/坍缩 | 判定 |
|---|---|---|---|
| `core/oreki-keep-antimatter.js:53` | 是 | **是**（反物质被清） | 见 B3，唯一真实伤害点 |
| `core/oreki-celestial-automation.js:260` | 是（只包住「进 run」） | 否 | 正常：run 内不再进新 run |
| `game.js:930` | 是 | 否（Ra 自动解锁膨胀，后期） | 无关 |
| `game.js:942` | 是 | 否（Teresa-25 的 TP，后期） | 无关 |
| `core/dilation.js:169` | 否（三元分支） | 否（膨胀中 AM 取值） | 无关 |
| `core/celestials/enslaved.js:186` | 是 | 否（ enslaved 加成） | 无关 |
| `core/time-studies/dilation-time-study.js:72`、`secret-formula/...dilation-time-studies.js:10` | 是 | 否（后期） | 无关 |
| `components/*`（GlyphsTab / ResetRealityButton / RealityReminder / RealityAmplifyButton / EnterDilationModal） | — | 纯 UI | 无关 |

**结论：Big Crunch / AD 购买 / 维度提升的自动化都没有被 `isInCelestialReality()` 关掉**，R29 `68d4cdc` 那一类残留没有复发。唯一的伤害是 `oreki-keep-antimatter.js:53`（B3）。

### B6 自动化是否真的会在 run 内调用真实 `bigCrunchReset()`

逐条核实 `[源码事实]`：

1. **无人停用**：`core/autobuyers/autobuyer.js:21-24`、`autobuyer.js:121-123`、`autobuyers.js:130-134`、`big-crunch-autobuyer.js:106-108` 里**没有任何** celestial / effarig 守卫；`canTick = Player.canCrunch && super.canTick`，只要 `player.auto.autobuyersOn` 与 `player.auto.bigCrunch.isActive` 为真就会 tick（R31 实测 `bcActive=true`）。
2. **调用的是真实 reset，不是点 UI**：`big-crunch-autobuyer.js:172-175`
```js
172:  tick() {
173:    super.tick();
174:    if (this.willInfinity) bigCrunchResetRequest(true);
175:  }
```
→ `big-crunch.js:39-47` → `bigCrunchReset()`（`:49`）。同一入口也被 Automator 的 `$prestige` 使用（`automator/lexer.js:227`）。
3. **阶段 1 解锁的唯一调用链**：`bigCrunchReset`（`:53` 要求 `canCrunch`）→ `bigCrunchGiveRewards`（`:57`）→ `bigCrunchCheckUnlocks`（`:73`）→ `:150-153`
```js
150:  if (Effarig.isRunning && !EffarigUnlock.infinity.isUnlocked) {
151:    EffarigUnlock.infinity.unlock();
152:    beginProcessReality(getRealityProps(true));
153:  }
```
→ `finishProcessReality` → `clearCelestialRuns()`（`reality.js:608`）→ 阶段变 2 → `oreki-celestial-automation.js:166-172` 的 `_enteredStage.effarig !== stage` 允许重新进入。**闭环是通的，唯一缺的是「crunch 真的发生」。**

**所以 B1/B2 是唯二真正卡住 crunch 的两点**；B6 本身无缺陷。

---

## 3. 最小可执行修改清单

> 原则：只动数值/判定，不动阶段推进条件、不写任何解锁位、不伪造状态。

| # | 文件:行 | 函数 | 改成什么 | 预期改善 | 风险 |
|---|---|---|---|---|---|
| **F1（必做）** | `src/core/celestials/effarig.js:216` | `Effarig.nerfFactor` | `return 3 * (1 - c / (c + Math.sqrt(Math.max(1, power.pLog10()))));` | 阶段 1 的 `multDilation` **0.25 → 0.99888**、`tickDilation` **0.7 → 0.99955**；每个 AD 乘子恢复 ≈166 个数量级（1e170 → 1e169.8），一次覆盖缺口 122 个数量级。这是让 1e6 真正生效的最小改动 | 低。原版 `c=1500`、`power=0` 时 nerfFactor 由 0 → 0.002，multDilation 0.25 → 0.2505，`10^(170^0.2505)` 与 `10^(170^0.25)` 差 < 0.01 数量级，**对原版无感**；`power ≥ 10` 时 `Math.max` 不改变任何值 |
| **F2（强烈建议）** | `src/core/autobuyers/big-crunch-autobuyer.js:123` | `willInfinity` | 在 `if (!player.break …) return true;` 之后加一条：`if (Effarig.isRunning && Effarig.currentStage === EFFARIG_STAGES.INFINITY) return true;`（或 `return Player.canCrunch;`） | 把阶段 1 的实际 target 从 **maxAM ≈ 1e823.5** 拉回 **1.797e308**，少爬 **515 个数量级**。改法仍是「先过 `canCrunch` 再 crunch」，`bigCrunchReset` 内部 `:53` 二次兜底，不会产生假坍缩 | 低-中。只作用于鹿颈长阶段 1；该阶段本来就是「必须靠真实坍缩解锁」，无经济副作用。注意 F1 生效后 AM 可能瞬间爆到 1e3000+，此时不修 F2 也能过（IP 收益 1e99 > 1e26.7），所以 F2 是「F1 之后若仍慢」的第二道保险 |
| **F3（建议）** | `src/core/oreki-keep-antimatter.js:53` | `OrekiKeepAntimatter.active` | 把 `if (isInCelestialReality()) return false;` 改为 `if (isInCelestialReality() && !Effarig.isRunning) return false;` | 让 run 内的维度提升不再清零反物质。实测对照：run 外 t=164 维度提升已到 **1,252,425**，run 内被压到 **23 并冻结**；放开后乘数引擎可继续复利，同时消掉实测的 48 次对数级下跌 | 中。会让 `thisInfinity.maxAM` 在 run 内更快到达 1.8e308（这是目标）；但需确认不会让「维度提升 0 成本循环」外溢到其它天神（Teresa/Enslaved/V 各自有资源约束，本条用 `!Effarig.isRunning` 收窄即可） |
| **F4（可选）** | `src/core/autobuyers/big-crunch-autobuyer.js:190-191` | `reset()` | 阶段 1 保持 `AMOUNT` 模式，`amount = 1.797e308`（等价于 canCrunch） | 与 F2 等效，但改动更大 | 中，不推荐（F2 更窄） |

### 不建议的方向（避免下一轮盲测）

- ❌ 继续调大 `OREKI_EFFARIG_NERF_DIVISOR`（1e6 → 1e9）：**在阶段 1 数学上完全无效**（见 §1.4）。
- ❌ 改 `Effarig.multiplier` 的 `multDilation` 下限：会把削弱表整体改掉，且阶段 2/3 的 `c` 本来就小，属于过修。
- ❌ 直接在 run 内 `EffarigUnlock.infinity.unlock()`：伪造阶段推进，违反验收口径。

---

## 4. 证据等级汇总

| 结论 | 等级 |
|---|---|
| `nerfFactor` 在 `power=0` 时恒 0、与 `c` 无关 | `[源码事实]`（effarig.js:216 + break_infinity.js:1290）+ `[静态推导]`（数值已验算） |
| 阶段 1 的 `infinityPower` 恒 0 | `[源码事实]`（infinity-dimension.js:382 / reality.js:635）+ `[实测数据]`（ids 全 0） |
| 1e6 在阶段 1 无效 | `[静态推导]`，**待 R32 探针确认**（见 §5） |
| 0.25 次方把 1e170 压成 1e3.6 | `[静态推导]`（`10^(170^0.25)`），与实测线性增长自洽 |
| 自动坍缩实际门槛 ≈ 1e823.5 | `[静态推导]`（maxIP=1e25.699 实测 + game.js:138,151 公式 + IPMult=1 源码事实） |
| 维度提升锁在 23 / AD8 锁在 100 | `[实测数据]` + `[源码事实]`（dimboost.js:126 公式） |
| run 内没有其它 `isInCelestialReality` 误关 | `[源码事实]`（全量 rg 核查，见表 B5） |
| 修复后能否 180 分钟内通关 | `[合理推断]`：阶段 1 从「68 分钟线性」变成「秒级指数」，但阶段 2/3 仍需实测 |

---

## 5. 主 Agent 如何在**不跑新一轮**的情况下确认本结论

`web/_tools/verify-r21-eternity.mjs:214-227` 已经挂上了 R32 探针，正在跑的这一轮直接读：

| 探针 | 本结论预测值 | 含义 |
|---|---|---|
| `effMult`（`Effarig.multDilation`） | **0.25**（不是 0.9999） | 直接证明 1e6 无效 |
| `effNerf`（`nerfFactor(infinityPower)`） | **0** | 证明退化到 c 无关分支 |
| `ipowL`（`log10(infinityPower)`） | **null**（= 0） | 证明自变量为 0 |
| `tshardL` | **null**（= 0） | 解释 `tickDilation` 也锁 0.7 |
| `effTick` | **0.7** | 同上 |
| `canCrunch` | 全程 false | 佐证「crunch 不是没触发，而是没到门槛」 |

**只要 `effMult = 0.25 && effNerf = 0`，就是 1e6 无效的铁证**，无需再跑 600 s 盲测，直接上 F1（+F2）。

---

## 6. 对全局通关阻塞的意义

- 这条结论把「鹿颈长阶段 1 推不动」从「需要再调一个魔数」变成「一个明确的单行 bug」：`nerfFactor` 的自变量与除数的作用域不匹配，导致 `1e6` 落在数学死区。
- 修复后阶段 1 的反物质会恢复指数增长（每个乘子 +166 个数量级），Big Crunch 在真实 1.8e308 门槛上真实发生，`bigCrunchCheckUnlocks` 真实置位 `EffarigUnlock.infinity` 并真实 `beginProcessReality`，阶段 2 才可能开始 —— 这是无名氏/V/太阳神/莱特拉/Pelle 整条链的第一个闸门。
- 主 Agent 本轮 600 s 实验即便失败，也**不需要再跑一轮盲测**：`effMult=0.25` 一出现即定性，可直接进入 F1 修复后的验证轮。
---

## 7. Android 侧交叉核验（与 Agent B 互相复核后定稿）

Android 不是 WebView 复用 JS，而是 `kajfosz.antimatterdimensions` 的原生 Kotlin 移植（R8 后为 smali），Effarig 在
`android/AD_Oreki_Edition_Android/work/mod/smali/kajfosz/antimatterdimensions/celestials/effarig/a.smali`。三点结论 `[源码事实]`：

1. **阶段 1 的 c = 1500，与 Web 一致**。`h()`（currentStage）首分支返回 `Constants$EffarigStage->a`（ordinal 0 = INFINITY）；`o()`（nerfFactor，`a.smali:592`）里 `if-eqz v0, :cond_1` → `a.smali:647` 载入 `1500.0`。`29.29`（`:636`）是 ordinal 1（ETERNITY = 阶段 2）。**Web 枚举 1-based、Android 0-based，语义对齐，不是 off-by-one。**
2. **Android 完全没有 `OREKI_EFFARIG_NERF_DIVISOR` 这一层缩放**：`a.smali` 内 `0x412E848000000000`（1e6）出现 **0 次**，`o()` 从 1500 直接进 `sqrt(pLog10)`。这是**独立于本报告 §1 的双端机制不等价**，阶段 2/3（infinityPower 可能 >1、`pLog10` 不再归零）同样受影响。
3. `m()`（multDilation，`a.smali:546`）= `0.25 * o(Player->E()) + 0.25`，`Player->E()` = `infinityPower`，与 Web `effarig.js:222` 同构；`BigDouble.pLog10()` 的 0/exponent<0 → 0.0 与 `break_infinity.js:1290` 语义一致。

**Android 落改口径必须两处叠加**（缺一即无效）：
- 在 `o()` 的 `:goto_0` 前插入 `c /= 1e6`（补回丢失的除数）；
- 再对 `pLog10` 结果做 `Math.max(1, ·)`。

两条到位后 Android 阶段 1 = multDilation **0.99888** / tickDilation **0.99955**，与 Web F1 修复后的数值完全一致。
只做 `Math.max`（c 仍为 1500）→ multDilation **0.2505**、tickDilation **0.7001**，等于没修。`[静态推导，已代入实际 c 复核]`

> 注：Agent B 原报告按 c=29.29 估算「只加 max」得 0.2747，实际 c=1500 时更差（0.2505）。已回信更正。

### 7.1 落改锚点陷阱 + 构建期断言（重要，签字表查不出来的失败模式）

`o()` 的 `c` 取值是**三档 switch 汇合**到 `:goto_0` 才完成的：`:cond_1`(1500) / `:cond_0`(29.29) / default(25) 三条路径都 `goto :goto_0`。
若把 `div-double/2addr v0, v2`（`c /= 1e6`）插在 **`:goto_0` 之前**，它会落进某一条分支（通常是最后一档 default 或 `:cond_0`），**只改一档，阶段 1 走的那档不受影响** —— 此时 `effMult` 仍读到 **0.2500**，与「完全没改」的签名**完全相同**。`[smali 事实]`

所以 Android 落改必须带三条构建期断言（Agent B 提出，采纳）：

```python
o_body = src[src.index(".method public static o("):src.index(".end method", start_of_o)]
assert o_body.count("0x412E848000000000L") == 1                      # ① 除数存在且唯一
assert src.index("0x412E848000000000L", start_of_o) < src.index(".end method", start_of_o)   # ② 落在 o() 内
assert src.index("0x412E848000000000L", start_of_o) > src.index(":goto_0", start_of_o)       # ③ 在 :goto_0 之后
```

第 ③ 条是本次讨论真正的坑：**Web 侧改对了、Android 侧锚点错了，签名表会给出误导性的「未修（0.2500）」，从而浪费一整轮验证。**
→ 因此下一轮若 Android 读到 `0.2500`，**先查锚点再下结论**，不要直接判「补丁无效」。

> 反之 Web 侧不存在此风险：`effarig.js:215` 的 `c /= OREKI_EFFARIG_NERF_DIVISOR;` 是 switch 之后的顺序语句，位置天然正确。

**断言的放置位置（Agent B 补充，采纳）**：三条断言必须写在 `patch_effarig_nerf()` **函数体内**，不能做成事后 `verify_*.py`。
理由：`build_mod.py` 的既有模式是「patch 函数自带 assert + `main()` 顺序注册」（如 `patch_autobuyer_batch_fallback`）。若断言放在独立脚本里，一旦有人跳过它直接构建，插错锚点的补丁会一路打进 APK，直到 AVD 才以 `0.2500` 暴露 —— 正好与本节的「签名不可区分」撞在一起，把最贵的排查留到最后。放函数内则锚点一错，`patch_effarig_nerf()` 当场崩，dex 都不会生成。

**根因对比（双端对齐的难点不在取值，而在位置）**：Web 的 `nerfFactor` 是**单出口直线代码**（switch 只赋值、不跳走），所以 `c /= DIVISOR` 天然安全；Android 的 `o()` 是**多分支汇合到同一标签**，除数插在哪条指令之后决定了它作用在哪一档。
