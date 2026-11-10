# R99 Web 无切页推进机制研究

## 1. 研究范围与结论

### 1.1 研究范围

本报告针对 Web 仓库当前源码进行静态取证，范围包括：

1. `src/game.js` 主循环与 Oreki 调度入口。
2. `src/core/intervals.js` 游戏计时器。
3. `src/core/autobuyers/` 原版自动购买器。
4. `src/core/oreki-*.js` 自动化模块。
5. `src/core/tabs.js`、`src/core/ui.js` 与 Classic/Modern Vue UI 生命周期。
6. Infinity、Break、Eternity、EC、Dilation、Reality、天神和 Pelle 的相关入口。

本轮没有修改生产 JavaScript，也没有把静态证据冒充真实移动端 GUI 验收。移动端浏览器实测状态为 `NOT RUN`。

### 1.2 结论

当前源码显示，正常游戏推进不依赖玩家频繁切换页面。原版自动购买器、资源增长、重置结算和 Oreki 自动化均由全局 `gameLoop` 驱动；它们没有以 `Tabs.current`、当前组件是否挂载或当前子页面为业务前置。

“停留在一个页面时看起来不更新”更可能来自以下 UI 边界：

1. 当前页面之外的详情组件可能没有挂载，或者已经被 Vue 销毁，因此不会继续渲染该页面自己的局部状态。
2. `GameUI.update()` 会在全局游戏 Tick 后发出更新事件，但它不能让一个没有挂载的页面组件显示在屏幕上。
3. 少数原版重置、挑战、研究或天神入口会调用 `Tab.*.show()`，这些调用主要是操作后的界面引导或可见性恢复，不是自动化能够运行的业务条件。
4. 游戏真正暂停、浏览器后台计时器冻结、自动购买器关闭/未解锁、阶段前置不满足时，推进确实会停止；这些问题不能通过切页修复。

因此，R99 的最小正确方向是：让业务继续留在全局游戏循环和原版模型 API 中；让 UI 订阅全局状态快照并在重新挂载时立即重读状态；禁止把切页当成自动化的启动手段。

## 2. 全局调用链证据

### 2.1 主循环

调用链为：

```text
GameIntervals.gameLoop
  -> gameLoop()
     -> Autobuyers.tick()                 原版自动购买器
     -> 原版资源增长、重置与结算
     -> OrekiSmartExecutor.runCycle()
        -> Oreki 各阶段自动化模块
     -> AutomatorBackend / Pelle / GameEnd 等原版循环
     -> GAME_TICK_AFTER
     -> GameUI.update()
```

`src/core/intervals.js` 中的 `GameIntervals.gameLoop` 以 `player.options.updateRate` 调用 `gameLoop()`。`src/game.js` 的 `gameLoop` 在正常运行路径中先处理原版自动购买器，再处理 Oreki 自动化，最后发送 `GAME_TICK_AFTER` 并调用 `GameUI.update()`。

如果当前停留在 Dimensions、Infinity、Eternity、Reality 或任意其他页面，这条调用链仍然存在。页面不是 `gameLoop` 的参数，也不是 `Autobuyers.tick()` 的判定项。

### 2.2 主循环的真实早退条件

`src/game.js` 的早退条件属于全局游戏状态，而非当前页面：

1. 游戏处于暂停、开始窗口或结束画面时，只更新 UI 后返回。
2. 浏览器休眠时间过长时，主循环进入已有的休眠补偿/模拟时间路径。
3. `realTimeMechanics()` 判定不能继续时，主循环会返回。

这些条件应在日志中独立记录，不能用“切到另一个页面后恢复”误判为页面依赖。

## 3. 原版自动购买器证据

### 3.1 原版购买器不读取当前页面

`src/core/autobuyers/autobuyers.js` 的 `Autobuyers.tick()` 只检查全局自动购买开关，然后遍历已注册的购买器；每个购买器的 `canTick` 再检查自身是否激活、是否解锁、是否达到自身间隔和游戏条件。

`src/core/autobuyers/autobuyer.js` 的 `AutobuyerState.canTick` 与 `IntervaledAutobuyerState.canTick` 使用的是：

1. `player.auto.autobuyersOn`。
2. 购买器自身的 `isActive`、`isUnlocked` 或 `isBought`。
3. `player.records.realTimePlayed - lastTick` 与购买器自己的有效间隔。

没有发现 `Tabs.current`、当前 Vue 组件或页面挂载状态参与这些判定。

### 3.2 Big Crunch / Break

`BigCrunchAutobuyerState.tick()` 通过原版 `bigCrunchResetRequest(true)` 入口执行；其 `canTick` 依赖 `Player.canCrunch` 和购买器自身状态，而不是 Infinity 页面是否打开。`bigCrunchTabChange()` 在结算后调用 `Tab.infinity.upgrades.show()` 或 `Tab.dimensions.antimatter.show()`，作用是把玩家放到适合继续查看的页面。

该导航调用不能被实现成“先切页，Break 才会发生”的隐含前置。R99 的首次大坍缩保护仍然有效：首次 Big Crunch 后必须真实经历 Infinity 阶段，不能在同一 Tick 或同一自动行动节拍中非法 Break。

### 3.3 其他阶段

原版购买器的 Eternity、Reality 和维度购买逻辑同样挂在 `Autobuyers.tick()`，并由自身的资源、解锁、间隔和阶段状态决定。当前静态扫描没有发现它们必须打开对应详情页。

## 4. Oreki 自动化证据

### 4.1 调度器与智能自动购买器边界

`src/game.js` 中的 Oreki 路径把主动 MOD 操作交给 `OrekiSmartExecutor.runCycle()`，而策略计算和原版自动购买器配置优化在调度边界外执行。这个边界与当前规则 §80、§81 一致：

1. MOD 主动操作遵守全局行动节拍。
2. 原版自动购买器自身购买遵守原版机制和自身间隔。
3. 自动购买器策略配置不应因为玩家停留在某个页面而停止。
4. 玩家手动改动受管节拍后，不在下一帧抢写，而在下一个策略调度 Tick 恢复最新策略值。

### 4.2 阶段模块

静态扫描显示以下模块使用游戏模型 API，而不是页面点击：

| 阶段 | 主要实现 | 页面依赖结论 |
|---|---|---|
| Infinity | `oreki-early-automation.js`、原版维度/升级 API | 未发现当前页依赖 |
| Break | `oreki-break-infinity.js`、原版 Break 入口 | 未发现当前页依赖；必须保留 R99 阶段门 |
| Eternity | `oreki-eternity-automation.js`、`orekiEternityTick` | 使用 `PlayerProgress.infinityUnlocked()` 与 `player.break` 等真实状态，不依赖 Eternity 页 |
| EC | `tryInstantCompleteChallenges()`、EC 研究/挑战模型 | 页面调用主要是引导，不是完成条件 |
| Dilation | `oreki-dilation-automation.js` | 由主循环/天神自动化调用，不依赖 Dilation 页 |
| Reality | `oreki-reality-automation.js` | 由自动化执行器调用，不依赖 Reality 页 |
| 天神 | `oreki-celestial-automation.js` | 使用天神运行状态与原版 API |
| Pelle | `oreki-endgame-automation.js`、`Pelle.gameLoop` | 使用终局模型与原版循环 |

`src/core/oreki-smart-executor.js` 的 Eternity 保护会在 `PlayerProgress.infinityUnlocked()` 或 `player.break` 不满足时 fail-closed。该保护必须继续存在，不能为了“无切页推进”而放宽。

## 5. Vue 与界面更新证据

### 5.1 全局更新事件

`src/core/ui.js` 的全局 Vue mixin 在组件创建时注册更新处理器，在销毁时移除；`GameUI.update()` 通过 UI 事件队列最终发送 `GAME_EVENT.UPDATE`。因此，已挂载的 Header、侧栏和当前页面组件可以在游戏 Tick 后刷新。

### 5.2 当前页面组件的挂载边界

`src/components/ui-modes/classic/ClassicUi.js` 通过当前 `Tabs.current` 选择页面内容；Modern UI 通过动态 slot 继续承载当前页面。`src/components/GameUiComponentFixed.js` 中也存在大量基于当前 tab/subtab 的 `v-if`。

结果是：

1. 当前页组件可以收到 UI 更新并重新渲染。
2. 非当前页组件可能根本没有挂载，因此不能期待它在屏幕上实时绘制。
3. 页面切换会触发组件重新挂载；如果组件的 `created`/`mounted` 初始化不读取当前真实模型，就会出现“切页后才显示正确”的假象。
4. 业务逻辑不能放在页面组件的 `mounted`、页面局部计时器或页面可见性回调中。

这解释了“操作已经发生但屏幕不更新”与“切页后突然更新”可以同时出现：游戏模型已经变化，但当前可见组件没有在正确的全局更新事件中读取它。

## 6. `Tab.show()` 调用分类

### 6.1 目前确认属于界面引导或可见性恢复

以下调用发生在业务动作已经决定或结算之后，当前证据显示它们主要用于把玩家带到相关页面：

1. `src/core/big-crunch.js`：Big Crunch 后切到 Infinity 升级或反物质维度。
2. `src/core/eternity.js`：首次低量永恒后切到时间维度。
3. `src/core/infinity-challenges.js`、`src/core/normal-challenges.js`：挑战开始/退出后的反物质维度页面。
4. `src/core/reality.js`：Reality 后的反物质维度或 Enslaved 可见性恢复。
5. `src/core/dimensions/infinity-dimension.js`：首次解锁无限维度后的对应页面。
6. `src/core/time-studies/`：研究购买后的研究、挑战或膨胀页面。
7. `src/core/celestials/effarig.js`、`src/core/celestials/pelle/strikes.js`：天神初始化或冲击解锁后的相关页面。

这些调用仍需逐项回归，避免某个调用被误写成业务前置；但不能把它们整体当成“自动化必须切页”的证据。

### 6.2 明确属于 UI/编辑器行为

`src/core/automator/automator-backend.js` 对当前 Automator 子页面的读取用于编辑器撤销/重做等交互；`src/core/tab-notifications.js` 对当前页面的读取用于通知显示和清除。这些不应影响资源增长、重置结算或阶段推进。

## 7. 最小改造方案

### 7.1 业务层

1. 保持 `gameLoop`、原版模型 API 和 Oreki 阶段模块作为唯一业务驱动入口。
2. 删除或改写任何“为了让自动化生效而调用 `Tab.show()`”的新增路径。
3. 原版为用户提供的导航引导可以保留，但必须标注为 UI/UX 副作用，不能作为自动化成功条件。
4. 所有阶段继续使用真实资源、真实结算和真实前置；不得通过切页、直接写解锁位或伪造资源推进。
5. 保持首次 Big Crunch、Break Infinity、Eternity 的阶段隔离和 R99 保护。

### 7.2 UI 层

1. Header、侧栏、全局阶段摘要等必须由全局 `GAME_EVENT.UPDATE` 驱动，不依赖详情页挂载。
2. 详情页组件挂载时必须从当前游戏模型/共享快照重新读取，不得依赖“之前在该页运行过”的局部状态。
3. 需要跨页面显示的自动化状态应放入共享响应式状态或可重建快照，不应放进某个页面组件私有计时器。
4. 如果某个页面确实需要展示自动化结果，应显示“最后业务 Tick、当前阶段、资源变化和阻塞原因”，而不是通过自动切页制造刷新。
5. `GameUI.update()` 只负责通知 UI 重读状态，不承担业务调度。

### 7.3 Android 对等要求

Android 应保持同一行为契约：业务由 Kotlin 调度/阶段模块执行，界面由状态观察刷新；不能通过切换 Fragment、Activity 或页面来触发实际游戏动作。不得新增 Java/Smali 业务逻辑。

## 8. 验证矩阵

### 8.1 静态验证

1. `rg` 检查 Oreki 自动化模块不读取 `Tabs.current` 作为动作前置。
2. `rg` 检查新增代码不以 `Tab.show()` 包装自动化业务调用。
3. 检查主循环仍包含原版自动购买器、Oreki 调度和 `GameUI.update()`。
4. 检查 R99 的 `infinityUnlocked`、`player.break`、首次 Big Crunch 保护仍然存在。

### 8.2 真实运行验证

每个阶段都应使用同一张与目标无关的页面停留至少一个完整观察窗口，记录：

1. 游戏 Tick 是否继续。
2. 资源、购买次数和阶段状态是否继续变化。
3. 自动购买器配置是否按自身间隔工作。
4. 页面切换前后的存档/状态快照是否一致。
5. Header 和当前页面是否在下一次全局 UI 更新后显示最新状态。

重点场景：首次 Big Crunch 后保持 `brake=false` 并观察真实 Infinity 成长；随后在合法前置满足后独立 Tick 执行 Break；再验证 Eternity、EC、Dilation、Reality、天神和 Pelle。

### 8.3 证据状态

| 项目 | 状态 |
|---|---|
| Web 源码调用链静态取证 | PASS |
| 当前页面不是原版自动购买器业务前置 | PASS（静态证据） |
| UI 挂载/销毁可造成局部画面滞后 | PASS（源码证据） |
| 移动端真实浏览器 GUI 验证 | NOT RUN |
| Android/Web 生产修复 | NOT RUN，本轮只产出研究与 Prompt |
| R99 180 分钟全流程验收 | NOT RUN |

