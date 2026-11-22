# Web 全流程跑次连续性与离线补算门禁

日期：2026-11-22（UTC+8）

## 背景

R124 Web 完整运行器已在 `main@3dfc85c774de579fcc53a5b7bea4e6cc8f85f5f3` 上启动真实新档、手机视口运行。运行过程中发现宿主或进程会间歇暂停数分钟；恢复页面后，原版会显示“离线进度模拟”或“在你离开的 X 分 X 秒里”的补算弹窗。

这类补算不是连续前台运行证据，不能让运行器继续把页面状态汇总为 PACING、ENDGAME 或终局稳定性结果。

## 无效跑次证据

- 运行目录：`~/.local/state/oreki-pr-watch/reports/R124/web-full-20261122-161500`
- 源码：`3dfc85c774de579fcc53a5b7bea4e6cc8f85f5f3`
- 原始采样：442 条
- 截图：70 张
- 首次 Infinity：约 10.9 秒
- 首次 Eternity：约 854.1 秒
- 首次 Reality：未观测到
- `runtimeErrors`、`consoleErrors`：运行时快照均为空

最后一张 `进度-4706秒.png` 显示“在你离开的 4 分 31 秒里”的离线资源补算；`进度-5105秒.png` 显示“离线进度模拟”尚未完成。另有一次约 348 秒墙钟间隔只对应约 17 秒 Node 单调时钟推进。

因为页面实际进入过离线补算，这个跑次不能用于判定产品 `PACING FAIL`。它只能证明 3dfc85c 候选在约 85 分钟观测内未进入 Reality，以及运行器原先缺少连续性门禁。

该跑次通过终端 SIGINT 停止时也未执行最终检查点导出，因此 `checkpoints` 为空。新的安全停止路径不再依赖 SIGINT。

## 修复

运行器新增以下门禁：

1. 同时记录 `Date.now()` 和 `performance.now()`；两者差值超过 60 秒时，记录连续性中断并把总体结果降为 `RUNTIME-ERROR`。
2. 读取 `player.speedrun.offlineTimeUsed`；超过原版开始离线模拟的 10 秒阈值时，同样阻断总体 PASS。新档载入自身的毫秒级初始化误差不误报。
3. 支持 `--stop-file`；检测到停止文件后完成最终采样、检查点导出和门禁汇总，不依赖终端信号。

## 验证

- `node --test scripts/tests/test_web_full_run_policy.mjs`：13/13 PASS。
- 19.6 秒真实 Chromium smoke：
  - 正常连续性最大偏差约 0.00066 秒；
  - `offlineTimeUsed` 为 21ms，未误报；
  - 安全停止文件正常生效；
  - 最终存档导出成功；
  - 总体结果 `STOPPED-NOT-RUN`，五项门禁均 `NOT RUN`。

## 当前门禁状态

- `GAMEPLAY LEGALITY`：`NOT RUN`
- `PACING`：`NOT RUN`
- `ENDGAME`：`NOT RUN`
- `POST-ENDGAME STABILITY`：`NOT RUN`
- `SAVE COMPATIBILITY`：`NOT RUN`

下一步必须在宿主连续运行、无离线补算的条件下，从合并后的准确 `main` 重新执行完整新档跑次。
