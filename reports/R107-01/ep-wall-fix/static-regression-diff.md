# 静态回归点：R50（a926a45，2026-11-01）vs HEAD（1d1f7ae/53f0d62，2026-11-14）

> 方法：`git show <R50>:<file>` 与工作树逐段对比；只列与「中期成长引擎 / EP 增益 / 自动化节拍」有关的差异。
> 结论等级：**已证实**=代码直接可见；**推断**=需要运行期验证。

## R1【已证实】连续购买路径的"每帧执行"被取消，压到 1~10 秒 1 次

- R50 的 `src/core/oreki-smart-executor.js`：`runCycle()` 把 `cls==="cont"` 的 4 条任务
  （`routine / early / eternity / eternityReset`）单独放进 **continuous 组**，在节拍闸**之前**
  **每帧直接执行**（R50 行 ~846-873）：

  ```js
  const continuous = STATE.strictGlobal ? [] : ordered.filter(t => t.cls === "cont");
  const scheduled  = ordered.filter(t => STATE.strictGlobal || t.cls !== "cont");
  for (const task of continuous) { try { task.fn(); } catch (e) {...} }   // 不受 interval 约束
  for (const task of scheduled) { ...节拍闸... }
  ```

  注释里写明依据：「原版自动购买器等价物（买反物质维度/计数频率/维度提升/星系/献祭、买无限维度/无限升级、
  买时间研究、重开）不属于间隔管辖对象」；R50 实测 3 s 间隔会让新档 146 s 仍 preInfinity。

- HEAD 的同一文件：`runCycle()` **删除了 continuous 组**，所有任务统一走
  `frameGateFree()` + `globalGateFree()` + `taskGateFree()` 三道闸（当前 `oreki-smart-executor.js`
  runCycle 内 "R78 统一全局节拍" 段），并显式注明「这是一次**语义收紧**，不是回退」。
- 行为差异：这 4 条承担「买维度 / 买无限维度 / 买时间研究 / 永恒重开 / 买无限升级」的动作，
  **执行频率从每帧（60/s）降到默认 10 s 一次（0.1/s），玩家设 1 s 时也只有 1/s**。
- 影响面：中期成长引擎（maxIP 曲线、EP 增益、EC/时间研究推进）全部依赖这些动作的频率。
- 证据：`git show a926a45:src/core/oreki-smart-executor.js | sed -n '820,905p'`；
  当前 `src/core/oreki-smart-executor.js` runCycle（"R78 统一全局节拍" 段）、
  `src/game.js` runCycle 任务表（routine/early/eternity/eternityReset 标 `"cont"`）。

## R2【已证实】默认节拍 3 s → 10 s

- R50：`INTERVAL_DEFAULT_SEC = 3`（commit e022830，2026-11-01）。
- HEAD：`INTERVAL_DEFAULT_SEC = 10`（commit `29e48cf`，R85，2026-11-06，`src/core/oreki-smart-executor.js:107`）。
- 影响：即使不看 R1，默认配置下所有策略动作上限也降低 3.3×。

## R3【已证实 R50 无此模块；与冻结现场相关为推断】目标驱动坍缩 + 受管坍缩间隔（R96/R97/R104 新增）

- R50 没有 `src/core/oreki-crunch-policy.js`、`oreki-managed-crunch-interval.js`、
  `oreki-managed-autobuyer-state.js`（`git cat-file -e` 均不存在）。
- HEAD 的 `gameLoop` 每帧：
  `OrekiCrunchPolicy.decide()` → `OrekiManagedCrunchInterval.applyFromPolicy()` →
  `OrekiManagedAutobuyerState.applyAll({ wantCrunch: decision.allow })`
  （`src/game.js:1097-1115`）。
- 冻结现场 A/B console 实测到 `[OrekiCrunchInterval] managed interval 60 -> 3600 (pause:ep-high-grow)`
  与 `3600 -> 60 (pause:eternity-grow)` 循环；`ep-high-grow` 的触发条件是
  `isInEternityLayer() && !Player.canEternity && EP.log10() >= 3000`
  （`oreki-crunch-policy.js:175-195`），**冻结现场正好满足**（EP=e3683.25、canEt=false）。
- **推断**：该 hold 把大坍缩自动器间隔压到 3600 s / 关闭 `isActive`，在「AM 停在
  startingValue、维度为 0、无法自然长回 e308」的状态下没有退出路径；R50 无此策略，
  坍缩按原版节奏持续进行。

## R4【已证实】永恒结算门槛 R50 ×10 → HEAD ×1

- R50 `oreki-eternity-automation.js`：`gainedEternityPoints().lt(EP.times(10))` 才拒绝。
- HEAD：`times(1)`（R96 第五轮，commit 0917026）。这一条是**放宽**，不是变慢；
  但意味着「EP 翻倍」即允许重置，配合 R1/R3 的低频执行，会把 EP 推上高位后停在 e3683 附近。
  与冻结现场 `gainedEPLog10=5.43 << epLog10=3683.25` 一致：此时门槛不再放行。

## R5【已证实】评价

- **R1 是最大、最直接的回归点**：它把「原版自动购买器等价物」从每帧执行改成受用户节拍约束，
  与 R50 完成跑次（默认 3 s + 每帧连续路径）相比，成长动作频率低 2 个数量级。
- R2 在此基础上再降 3.3×；R3/R4 改变了坍缩/永恒的触发语义，与冻结现场直接相关。
- 需要运行期逐帧证据确认「冻结时维度是否真的没有被购买 / AM 是否真的没有产量」，
  该证据由 `diag-stall.mjs` 采集（见 README §4）。
