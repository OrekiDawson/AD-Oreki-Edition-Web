# R51-SCHED-01　Android 调度器与 onAutoBuyerTick 闭环

| 项 | 内容 |
| --- | --- |
| 任务编号 | R51-SCHED-01 |
| 标题 | 补齐 `OrekiAutomationScheduler` 到 `OrekiStageAuto.onAutoBuyerTick()` 的接线，并产出真实运行期日志 |
| 创建时间 | 2026年11月1日 15:40 |
| 创建者 Agent ID | main |
| 负责 Agent ID | android-scheduler-agent |
| 实际执行者 Agent ID | 待回写 |
| 更新者 Agent ID | main |
| 贡献者 | android-scheduler-agent（调度器本体，R50-AND-04）、待回写 |
| 优先级 | P4 |
| 状态 | 待领取 |
| 来源 | 用户 2026-11-01 15:32 R51-04 |
| 禁止修改 | `OrekiStageAuto.smali` 的阶段推进逻辑（归 R51-AND-01）；只允许接入点与调度包裹 |

## 一、缺口

调度器类、设置页、持久化键均已存在（R50-AND-04），但**从未出现 `OREKI_SCHED act` 运行日志**，
即调度器没有真正管理任何动作。代码存在 ≠ 功能生效。

## 二、必须实测的十项

1. 1 秒间隔　2. 3 秒间隔　3. 60 秒间隔　4. 运行中改间隔　5. 关闭后重开
6. no-op 不占节拍　7. 持久化跨进程　8. 普通模式原版连续购买不受限
9. 严格模式连续购买受限　10. 真实 `OREKI_SCHED act` 日志（动作 / 条件 / 结果 / 时间）

## 三、语义约束

- 默认档：间隔只管辖**策略决策**（reality / celestial / perk / endgame / breakUpgrades / breakGate / executor verb）。
- `routine` / `early` / `eternity` / `eternityReset` 属原版自动购买器等价物，按原版 tick 节奏。
- 严格模式才把上述纳入限流，UI 必须明示会变慢甚至停滞。
- 同帧最多一个受调度动作；关闭立即清队列与冷却，但**不得清历史真实执行时间戳**（否则可绕过间隔）。
- 原版总自动购买开关关闭时，Oreki 不得越权操作。

## 四、验收

静态断言、初始化日志、设置页截图**均不构成验收**；必须有连续 ≥ 60 秒的运行期日志，含至少两种间隔下的真实动作间隔值。
