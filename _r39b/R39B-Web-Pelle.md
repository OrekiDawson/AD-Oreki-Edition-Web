# R39-B · Web 终局链路实测报告（未达成 GameEnd，附精确卡点）

日期：2026-10-30
长跑：`r39b-full.jsonl`（1 s 采样，2019 条，墙钟 2080.7 s ≈ 34.7 分钟后仍在跑）
存档：全新档（`localStorage.clear()` 后 reload），端口 HTTP 8872 / CDP 9362

---

## 一、真实里程碑（已实测，来自 jsonl 而非推断）

| 里程碑 | 现实耗时 |
|---|---|
| 买入 IU15 | **6.8 分钟**（R38 是 8.4 分钟，本轮更快） |
| 莱特拉解锁 | 6.8 分钟 |
| 现实数 ≥ 100 | 9.1 分钟 |
| 莱特拉 tier 8 | **9.6 分钟** |
| Pelle 解锁 | **未达成** |
| `player.isGameEnd === true` | **未达成** |

前 10 分钟非常快：`realities` 到 2080 s 时已 280+，`laiTier=8`，`iu15=1`。
之后 25 分钟全部空转在 EC（永恒挑战）阶段，`laiTier` 恒 8、`pelleUnl` 恒 false。

---

## 二、卡点定位（每一条都有本轮真实探针证据）

探针脚本：`_tools/_r39b/probe.mjs` / `probe2..6.mjs`（只读，通过 CDP 9362 连到同一局长跑）。

### 链条

```
EC1..EC12 各 5 次  →  TimeStudy.reality（膨胀研究 6，ds6）  →  IU25  →  Pelle 解锁  →  1e1000 反物质  →  GameEnd
```

### 实测到的断点

1. **`EternityChallenge(1).completions = 5/5`，但 EC2 进不去。**
   `TimeStudy.eternityChallenge(2).canBeBought === false`，而它的三条子条件实测是：
   ```
   isAffordable = true        （TT = 5e7，早就够）
   allSecondaryRequirementsMet = true
   config.requirement = [171]  →  TimeStudy(171).isBought = false   ← 断在这里
   player.challenge.eternity.unlocked = 0
   ```
2. **171 买得上，但留不住。** 手动实测：
   `TimeStudy(71).purchaseUntil()` → 返回后 `bought71=true bought171=true`；
   下一条探针（约 1 分钟后）再看，`TimeStudy(171).isBought` 又变回 `false`，
   且 11..200 号研究**全部为空**（`bought1_10`、`boughtStudies` 都是空串）。
   原因：**现实重置会清空时间研究**，而这一局每 10~20 秒就重置一次现实（280 次 / 34 分钟）。
3. **`shouldHoldReset()` 不能把这个窗口让出来。**
   `src/core/oreki-eternity-automation.js:432` 的 `primaryMet` 判据是
   `study.config.requirement.some(s => TimeStudy(s).isBought)`；
   现实刚重置完时 171 必然为 false ⇒ `primaryMet=false` ⇒ 返回 false ⇒ **不压现实** ⇒
   下一帧现实照常重置 ⇒ 171 永远买不上。
   **这是一条自我维持的死锁**，不是「跑得慢」。
4. 因此 `ds6` 永远 `isBought=false`、`canBeBought=false`；`IU25` 的 `checkRequirement`
   要求 `TimeStudy.reality.isBought`，于是 `IU25` 连 `isAvailableForPurchase` 都进不去
   （实测 `iu25q=false`、`iu25pos=false`）。Pelle 自然无从谈起。

### 另外修掉的一个确定性 bug

`oreki-endgame-automation.js:208` 的 `iu25ConditionsReady()` 末尾写的是
`Currency.imaginaryMachines.value.gte(OREKI_IU25_COST)`。
本作 `Currency.imaginaryMachines.value` 是**普通 Number**（没有 Decimal 方法），
调用 `.gte` 抛 TypeError → 被外层 `catch` 吞掉 → 恒返回 false。
实测 `imLog10=10`（=1e10 IM）、`OREKI_IU25_COST=5e9` 时该函数仍返回 false。
**这与同文件 176 行注释里记录过的同类坑是同一个**（那次是 `.lte`）。
已改为 `Number(...) >= OREKI_IU25_COST`。

---

## 三、没有做的改动（以及为什么）

**没有**去改 `shouldHoldReset` 的压现实条件。原因是：
- 它需要「EC 准备期也要压现实」，但压多久、怎么和「EP 收益 ≥ 10 倍才永恒」的门槛共存，
  必须靠长跑对照来定；拍一个数字上去很可能把前 10 分钟那段的推进也一起拖死。
- 本轮已经没有足够时间做「改前 / 改后」两组 30 分钟长跑对照。
- 上一轮刚因为「没验证就改」付出了验错成本（见 FACTS 里 R38 的几条），这里不再重复。

**结论：Web 端到 Pelle 的距离不是「调个判据」，而是 EC 阶段的时序死锁。
下一轮最值得做的一件事就是把这个死锁拆开（按下面顺序）。**

---

## 四、下一轮的最小可行改法（按证据给，不是猜）

1. 给 `OrekiEternityAutomation` 加一个**有界准备期**：
   `shouldHoldReset()` 在「目标 EC 的 primary study 未买、但 TT ≥ 100 且 `TimeStudy(71).canBeBought`」
   时也返回 true，并记 `_prepHoldUntil = now + N`（N 取 15~20 s），到点无条件放手。
   这样现实被压住的窗口只够「买 71 → 买 171 → 买 EC 研究 → start」，不会长期停摆。
2. 在同一窗口内让 `buyEcStudiesAndStart()` 先 `TimeStudy(71).purchaseUntil()`
   再买 EC 研究（现在只对 `config.requirement` 逐个 `purchaseUntil()`，
   而 171 的 `purchaseUntil` 本身会连带买 71，实测有效，缺的是「窗口」不是「买法」）。
3. 用 `_tools/_r39b/probe6.mjs` 作为回归指标：目标是
   `EternityChallenge(2).canBeBought === true` 且 `current` 变非 0，
   然后看 `ecCompletions` 是否从 `[5,0,...]` 往上走。
4. 只有 EC1..EC12 都到 5 次之后，再回头看 `ds6 → IU25 → Pelle`，那一段才轮到
   `driveDoomed` 与 `endState` 的判据。

---

## 五、结论（诚实版）

- Web 端本轮**没有**抵达 Pelle，**没有**触发 `isGameEnd`。
- 前 10 分钟的加速是真的（IU15 6.8 min、莱特拉 tier 8 9.6 min），比 R38 更快。
- 卡点已从「Pelle 文案与判据不一致」推进到「EC 阶段时序死锁」，
  并从「看起来慢」变成「有具体方法体与实测数值支撑」。
- `180 分钟内通关` 这个目标本轮**未达成**，缺口在 EC 阶段，不在终局判据。
