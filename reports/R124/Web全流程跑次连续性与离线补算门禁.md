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

## R125 审查修复（2026-11-22）

PR #127 的 5 条未解决线程均成立，R125 在最新 `origin/main@970e825` 上做 fix-forward：

1. 页面探针把 `null`/`undefined` 保留为无法读取，不再经 `Number(null) === 0` 冒充“已测量 0ms”。
2. 页面每 50ms 记录心跳缺口；页面 `Date.now()` 墙钟与 Node 单调墙钟之间超过 60 秒也阻断。两者可捕获渲染进程单独冻结，而不仅依赖仅在读档时更新的 `offlineTimeUsed`。
3. 持续观察原版“离线进度模拟”与“在你离开的……”弹窗；出现即保留时间、文本并写入 `runtimeErrors`。
4. 连续性基线提前到清空新档并设置 `startIso` 的同一时刻，页面重载、等待和首张截图期间的暂停不再落在基线之前。
5. 一旦存在运行错误，五项独立门禁全部作废为 `NOT RUN`；原事件与首现实时刻保留作诊断，但不得继续输出 ENDGAME/PACING 的污染结论。

验证：

- `node --test scripts/tests/test_web_full_run_policy.mjs`：17/17 PASS。
- `python3 scripts/tests/test_repository_policy.py`：15/15 PASS。
- 5 秒单实例 headless Chromium 冒烟：11 次采样、2 张截图、读档容差 `offlineTimeUsed=15ms`、连续性最大偏差约 `0.00072s`、`runtimeErrors=[]`、最终存档导出成功、总体 `STOPPED-NOT-RUN` 且五项门禁均为 `NOT RUN`。

以上仅证明运行器门禁修复；完整 PACING、ENDGAME、终局后稳定性与存档兼容仍为 `NOT RUN`。
