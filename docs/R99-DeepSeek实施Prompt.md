# R99 DeepSeek 实施 Prompt：Web 无需频繁切页推进

你正在维护 `OrekiDawson/AD-Oreki-Edition-Android` 对应的 Web 仓库 `web/AD-Oreki-Edition`。请先读取并遵守当前工作区的 `AGENTS.md`、`RULES_INDEX.md`、`docs/rules/CORE.md`、`docs/rules/WEB.md`、`docs/rules/AGENT_WORKFLOW.md`、`docs/长期规则_验证与证据.md`、`docs/FACTS.md` 以及本目录的 `docs/R99-Web-无切页推进机制研究.md`。

## 1. 目标

修复并验证：玩家停留在任意合理游戏页面时，合法的 Web 原版游戏推进、原版自动购买器和 MOD 自动化仍能持续运行，不需要玩家频繁切页才能触发购买、资源增长、重置、阶段推进或状态更新。

“无切页推进”不是伪造资源，也不是强制替玩家切页。业务必须继续由真实游戏循环、原版模型 API 和现有 Oreki 阶段模块完成；界面只负责显示真实状态。

## 2. 已知源码证据

重点取证路径：

1. `src/game.js`：`gameLoop`、`Autobuyers.tick()`、`OrekiSmartExecutor.runCycle()`、`GAME_TICK_AFTER`、`GameUI.update()`。
2. `src/core/intervals.js`：`GameIntervals.gameLoop`。
3. `src/core/autobuyers/autobuyers.js` 与 `src/core/autobuyers/autobuyer.js`：原版购买器的 `tick`、`canTick`、自身间隔。
4. `src/core/oreki-smart-executor.js`、`src/core/oreki-early-automation.js`、`src/core/oreki-eternity-automation.js`、`src/core/oreki-dilation-automation.js`、`src/core/oreki-reality-automation.js`、`src/core/oreki-celestial-automation.js`、`src/core/oreki-endgame-automation.js`。
5. `src/core/ui.js`、`src/core/tabs.js`、`src/components/GameUiComponentFixed.js`、`src/components/ui-modes/classic/ClassicUi.js`、`src/components/ui-modes/modern/ModernUi.js`。
6. `src/core/big-crunch.js`、`src/core/eternity.js`、`src/core/reality.js`、挑战、时间研究、无限维度、Effarig 和 Pelle 相关入口。

不要因为看到 `Tab.*.show()` 就假设业务必须切页。先证明该调用是否参与资源、解锁、结算或阶段判定；如果只是结算后的导航引导或可见性恢复，必须与业务路径分离。

## 3. 强制边界

### 3.1 禁止把切页变成业务前置

1. 不得通过 `Tab.show()`、模拟点击、切换 Vue 页面、切换 Fragment 或重新挂载组件来触发游戏业务。
2. 不得为了让自动化“生效”而强制替玩家切到某个页面。
3. 不得把页面组件的 `mounted`、`updated`、局部定时器或页面可见性作为资源增长、购买、重置或阶段推进的唯一驱动。
4. 原版已有的用户体验导航可以保留，但必须证明它不影响业务，并在代码或报告中标明是 UI/UX 副作用。
5. 不得伪造资源、结算、成就、解锁位、存档进度或跳过真实成长。

### 3.2 UI 更新

1. 全局 Header、侧栏、阶段摘要和自动化状态必须由全局 `GAME_EVENT.UPDATE` 或等价共享响应式状态更新。
2. 非当前页面组件可以不挂载，但组件重新挂载时必须从当前真实模型读取完整状态，不能依赖上一次挂载时的缓存。
3. 需要跨页面显示的状态放入可重建的共享状态快照，不放入某个详情页面的私有计时器。
4. 如果观察到“切页后才显示”，先区分“业务已经发生但当前组件未重绘”和“业务真的没有发生”，不能用切页掩盖问题。
5. `GameUI.update()` 只能通知 UI 重读状态，不得承担业务调度职责。

### 3.3 调度器和智能自动购买器

1. MOD 主动操作继续遵守现有全局行动节拍。
2. 原版自动购买器自身购买继续遵守原版机制和自身间隔，不得被 MOD 全局节拍额外限速。
3. 智能自动购买器的配置优化独立于全局行动节拍。
4. 玩家手动修改受管节拍后，不在下一帧立即抢写；在下一个策略调度 Tick 恢复当时最新策略值。
5. 不得强制打开玩家已经关闭的原版自动购买器。
6. 不得把页面切换当作下一 Tick 的替代品。

### 3.4 阶段保护

必须保留 R99 既有阶段契约：

1. Big Crunch 是进入 Infinity 阶段的真实重置。
2. 首次 Big Crunch 完成后，不能同一帧、同一 Tick 或同一自动化行动节拍立即 Break Infinity。
3. 首次 Big Crunch 后必须观察到真实 Infinity 阶段和资源成长，保持 `brake=false`，再在独立 Tick 中依据真实前置合法 Break。
4. 不得仅凭 `hasInfinity=true`、初始化字段或页面显示判断已经 Break。
5. Break 不能被当作 Eternity 的证明；Eternity 必须继续使用真实阶段门。
6. 不得为了无切页推进而放宽 `PlayerProgress.infinityUnlocked()`、`player.break` 或其他真实前置。

## 4. 实施步骤

### 4.1 先做静态审计

输出每个疑似页面依赖的文件、函数、调用链和分类：

1. 真正的业务前置。
2. 仅 UI/UX 导航。
3. 仅 UI 通知或编辑器行为。
4. 可能造成画面滞后的挂载/销毁问题。

使用 `rg` 检查 Oreki 自动化模块是否读取 `Tabs.current`、`ui.view` 或组件生命周期作为动作前置。不要只统计 `Tab.show()` 调用次数。

### 4.2 只实施最小修复

优先修复可以明确证明的以下问题：

1. 业务逻辑被错误放在页面组件生命周期或页面局部计时器中。
2. 全局状态已变化，但 Header/侧栏没有在 `GAME_EVENT.UPDATE` 后重读。
3. 组件重新挂载后使用旧快照，导致切页后才恢复正确显示。
4. 新增代码把 `Tab.show()` 当成自动化成功条件。

不要进行无关重构，不要重写原版导航系统，不要复制一套新的游戏循环，不要把 Python 或 Shell 包装成所谓迁移。Web 端生产逻辑使用当前项目的 JavaScript 结构；Android 若需同步，新增或修改业务只能使用 Kotlin，禁止 Java/Smali。

### 4.3 阶段覆盖

至少核对 Infinity、Break、Eternity、EC、Dilation、Reality、天神和 Pelle。每个阶段都要说明：

1. 实际业务入口。
2. 是否由 `gameLoop` 调用。
3. 是否读取当前页面。
4. 页面切换调用是业务前置还是 UI 引导。
5. 无切页时应观察到的真实资源/状态变化。

## 5. 验收要求

### 5.1 静态验收

1. 主循环仍然调用原版自动购买器、Oreki 自动化和 UI 更新。
2. Oreki 业务路径没有新增当前页面前置。
3. 新增代码没有用 `Tab.show()` 包装业务动作。
4. R99 首次 Big Crunch/Break/Eternity 阶段保护仍存在。
5. Android/Web 行为契约保持一致。

### 5.2 真实运行验收

使用真实新档或明确记录的测试存档；不要只看函数调用次数。玩家停留在一张与当前目标无关的页面，分别观察：

1. Infinity 资源、购买和升级继续变化。
2. 首次 Big Crunch 后保持 `brake=false`，真实经历 Infinity 成长。
3. 合法前置满足后，Break 在后续独立 Tick 完成。
4. Eternity、EC、Dilation、Reality、天神和 Pelle 的合法自动化不需要频繁切页。
5. 自动购买器按自身机制运行，不被全局行动间隔错误限速。
6. UI 全局状态在下一次 `GAME_EVENT.UPDATE` 后显示最新值。
7. 切页前后的存档/关键状态快照一致，不因切页产生额外资源或结算。

移动端 GUI 验收必须尽量使用真实移动端视口和截图；不能用桌面窗口截图冒充。未运行的项目明确标记 `NOT RUN`，遇到环境冲突标记 `BLOCKED`，不能把推测写成 `PASS`。

## 6. 文档与长期规则

完成真实证据后：

1. 将“Web 游戏推进不依赖频繁切页；切页只属于 UI 导航，不是业务前置”写入正确的 Android/Web 共用长期规则正文。
2. 使用现有连续层级编号 `1.`、`1.1`、`1.1.1`；R99 只能作为来源/任务标识，不替代正文编号。
3. 更新根 `RULES_INDEX.md`、Web `docs/RULES_INDEX.md` 和 Android 对应索引，使入口唯一且不重复。
4. 不把历史、已失效、归档说明或流水账写进 README；README 只保留当前有效的项目说明、使用入口和结构信息。
5. `FACTS.md` 只追加实际运行验证过的事实，不能把静态推断写成事实。
6. 保护共享硬链接、其他 Agent 的在途修改和当前脏工作区。

## 7. 最终报告格式

报告必须包含：

1. 当前问题的真实触发路径。
2. 修改文件、函数和调用链。
3. 哪些页面调用被保留为 UI 引导，哪些被移出业务路径。
4. 静态检查结果。
5. 真实 GUI/移动端截图、日志和存档状态对应关系。
6. Infinity 到 Pelle 的阶段验证结果。
7. Android/Web 等价性结果。
8. `PASS`、`FAIL`、`BLOCKED`、`NOT RUN` 分项结论。
9. 未解决阻碍和下一步最小任务。

只有证据完整时才宣布生产修复 PASS；不要因“切页后看起来正常”就判定业务已修复。
