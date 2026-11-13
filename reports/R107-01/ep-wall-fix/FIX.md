# R107-01 最小修复：接管自动永恒时同时修正结算门槛

## 改动（仅 1 个生产文件，+29 行）

`src/core/oreki-eternity-automation.js` 的 `_adoptEternityAutobuyerIfNeeded()`
（原 R104 注释块之后、`player.auto.eternity.isActive = true` 之前）：

```diff
@@ -911,6 +911,35 @@ export const OrekiEternityAutomation = {
       if (player.auto.autobuyersOn === false) return;
       if (player.auto.eternity.isActive === true) return;
       if (!this._eternityAutobuyerUnlocked()) return;
+      // [R107 P0] 接管原版「自动永恒」时，必须同时把结算门槛从默认
+      // 「AMOUNT = 1（任何 canEternity 为真的时刻立刻结算）」改成「X_HIGHEST ×10」。
+      // ...（缺陷背景注释，详见源码）
+      if (this._eternityAutobuyerConfigured !== true) {
+        try {
+          const autoCfg = player.auto.eternity;
+          const amountIsDefault = typeof autoCfg.amount?.eq === "function"
+            ? autoCfg.amount.eq(1)
+            : Number(autoCfg.amount) === 1;
+          const xHighestIsDefault = typeof autoCfg.xHighest?.eq === "function"
+            ? autoCfg.xHighest.eq(1)
+            : Number(autoCfg.xHighest) === 1;
+          if (autoCfg.mode === 0 && amountIsDefault && xHighestIsDefault) {
+            autoCfg.mode = globalThis.AUTO_ETERNITY_MODE?.X_HIGHEST ?? 2;
+            autoCfg.xHighest = new Decimal(10);
+          }
+          this._eternityAutobuyerConfigured = true;
+        } catch (e) { /* 配置失败不阻断原有接管流程 */ }
+      }
       player.auto.eternity.isActive = true;
       this._eternityAutobuyerAdopted = true;
```

## 语义

- 只在 **新档会话首次接管**、且**原版配置仍是自动值**（mode=AMOUNT(0)、amount=1、xHighest=1）时改一次：
  - `mode = AUTO_ETERNITY_MODE.X_HIGHEST (2)`
  - `xHighest = 10`
- 效果：原版自动永恒只在 `gainedEP >= 10 × thisReality.maxEP` 时结算
  （`eternity-autobuyer.js:112-121` 的 X_HIGHEST 分支），与 R50 MOD 的
  「EP 收益 ≥ 当前 EP × 10 才永恒」同语义。
- 不满足条件时（玩家已自定义模式/数量、或已接管过）**不改任何字段**。
- 不改 AMOUNT/TIME 模式语义，不改原版 EP 公式、不写进度字段、不伪造结算。

## 为什么这是最小修复

- 不需要动 `runCycle` 节拍（R50→HEAD 的语义收紧仍保留），不需要改 EP 除数、
  不需要改 `isRealityAvailable()` 门槛，也不需要触碰存档/UI。
- 修复点就是回归引入点：R104 commit `62f41e7`（P0-1）接管了开关却没设门槛；
  本次在同一函数内补齐门槛。

## 风险与回滚

| 风险 | 评估 | 缓解 |
|---|---|---|
| 玩家自定义的自动永恒配置被覆盖 | 低：仅在 mode=AMOUNT/amount=1/xHighest=1 且本会话未接管过时改一次 | 三条件同时满足才写；否则不动 |
| 自动永恒变得更保守、部分阶段推进变慢 | 可能（预期内）：X_HIGHEST×10 只在真正大收益时结算 | R50 同门槛曾 739.6 s 通关；修复后实测 12 分钟 r15→r20+ |
| 与 Reality 升级/EC 入口保护的交互 | 未观察到异常：EC 入口保护在 MOD 侧 `tickEternity`，与原版自动器并行 | 49/49 定向验收复跑 |
| 回滚 | 删除这 29 行即可回到 R104 行为 | git diff 单文件、无存档格式变化 |

## 已知取舍

- 这是「恢复 R50 结算语义」而不是「重新设计永恒策略」；如果后续要统一
  `OrekiCrunchPolicy` 式的目标驱动永恒策略，应另开轮次，不与本 P0 混做。
- 该改动会使「接管后第一次永恒」可能比之前晚（需要 maxIP 真涨 10 倍），
  但 R104 接管本身只在 100 次永恒里程碑后发生，前段无影响。
