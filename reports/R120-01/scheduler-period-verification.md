# R120-01 调度周期与自动购买器控制权验证

## 最终规则

- 调度 tick 周期严格采用玩家配置的 1～60 秒，新档和缺失配置默认 10 秒。
- 阶段变化、现实数和游戏主循环不得覆盖配置周期；不存在 `1/2/3/5` 秒阶段上限。
- 受管自动购买器的启停、模式、次数、阈值和优先级只在下一次有效调度 tick 恢复。
- 同一 tick 不重复写；长时间空档恢复后只前进一拍，不做补偿 tick。

## 实现

- Web 源码：`c3584512d878c17ffdac1a1d0014da5bdbcf0b12`
- Android 源码：`3489379c1`
- Web 配置存储：`localStorage.oreki.automation.intervalSec`
- Android 配置存储：`oreki_prefs / oreki.automation.intervalSec`
- 两端默认值、合法范围和生效语义一致；均复用现有调度器，没有新增计时器或第二套控制逻辑。

## 验证

| 验证 | 结果 | 证据 |
| --- | --- | --- |
| Web 周期边界 | PASS `17/17` | 受控单调时钟，覆盖 1/10/60 秒、非法存储、改周期、空档与 strictGlobal |
| Web 通用调度 | PASS `22/22` | `scripts/test-scheduler-beat.mjs` |
| Web 托管 tick | PASS `16/16` | `scripts/检查调度器托管Tick.mjs` |
| Web 真实 Chromium 托管授权 | PASS `16/16` | `reports/R120-01/scheduler-authority/summary.json` |
| Android Debug 单测 | PASS | `:app:testDebugUnitTest`，含新周期边界测试 |
| Android Kotlin 确定性夹具 | PASS | Kotlin 静态契约 8 项 + 语义场景 19 项 |
| Web CI | PASS | [Run 44539521136](https://github.com/OrekiDawson/AD-Oreki-Edition-Web/actions/runs/44539521136) |
| Android 源码 CI | PASS | [Run 44539818989](https://github.com/OrekiDawson/AD-Oreki-Edition-Android/actions/runs/44539818989) |

真实 Chromium 验收覆盖手动关闭后恢复开启、手动开启后恢复关闭、维度/计数频率购买模式、维度提升与星系限额、献祭、大坍缩阈值和 mode/time 在同 tick 恢复、存档 reload 后下一 tick 校正，以及重复 tick 零写入；console error 和 pageerror 均为 0。

## 未执行

- 按本次规则“不要因配置修改执行完整 180 分钟长跑”，未启动新的完整长跑。
- 旧语义下已启动的三小时候选长跑在发现阶段上限覆盖周期后安全 `Ctrl-C` 终止，结果标记为 `FAIL（主动终止）`，不用于最终通关结论。
- Android AVD/真机运行仍为 `BLOCKED`；本轮只有 JVM 单测与 CI/静态验证，不标记稳定版。

## 工具债务

`scripts/check_automation_scheduler.py` 仍包含旧 Smali/旧“手动优先”时期的历史断言，当前运行有 10 项断言漂移；该脚本不在现行 CI 主路径。不得将它的失败解释为本次周期实现失败，也不得将其他绿灯解释为该遗留脚本已通过。
