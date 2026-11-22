# Web 历史 PR #106 覆盖核对

## 结论

当前 Web `main=b3569afe` 已包含 #106 的生产行为，并由后续 #112、#115、#116、#117
及 R124 #118 修正覆盖：

- `src/core/oreki-instant-challenges.js` 已删除，`game.js` 不再调用即时挑战。
- TT 购买收益为原版 ×1。
- Reality 模拟次数已移除额外 `+4`。
- 新档阶段速度为 1000×、Break 后 1800×、Reality 后 3000×；动态升档保留，刷新不覆盖。
- 自动永恒已区分原版永恒复位与玩家关闭，并包含余额消费到 0 的冷启动识别。
- 无限维度自动器已纳入受管配置并在 MOD 关闭时恢复玩家值。
- 阶段速度提示读取响应式镜像，手动倍率/恢复默认后立即刷新。
- 当前主线的定向门禁：`check_game_pace`、`check_speed_stage`、
  `check_eternity_gate` 219 项、`check_managed_autobuyer_state` 27 项均 PASS。

## #106 独有内容

生产业务代码无独立未合并块；其 3 份报告已在当前 main 存在。

唯一仍具长期价值的是完整新档跑分器，但旧 `scripts/run-first-reality.mjs`
有 1069 行并存在未解决审查：

- 默认 `--probe-et` 会主动触发永恒，污染正常 PACING 证据。
- Reality 时间由采样时刻近似，可能跨过 70 分钟边界后误判 PASS。
- PACING 定向结果曾被写入通用 ENDGAME `result`。

本任务改为新增 `scripts/run-r124-full-web.mjs`：

- 默认不主动调用永恒或挑战结算。
- 页面内 50ms 只读监测首次事件的真实发生时刻。
- 首次 Reality 早于 70 分钟立即停止并记 `PACING-FAIL`。
- `PACING`、`ENDGAME`、`POST-ENDGAME STABILITY`、`GAMEPLAY LEGALITY`、
  `SAVE COMPATIBILITY` 分开记录，不互相冒充 PASS。
- 真实 180 分钟、Five Gates 与存档矩阵仍为 `NOT RUN`，需在准确 main/APK/部署版本上运行。

## 定向验证

- `node --test scripts/tests/test_web_full_run_policy.mjs`：8/8 PASS。
- `check_game_pace.mjs`：PASS。
- `check_speed_stage.mjs`：PASS。
- `check_eternity_gate.mjs`：219/219 PASS。
- Mobile Chromium 60 秒冒烟：13 次采样、4 张截图、0 pageerror；
  首次 Infinity 10.7 秒、首次 Break 40.8 秒，速度由 1000× 切至 1800×，
  结果严格输出 `STOPPED-NOT-RUN`。
- 完成源码 SHA/出生快照加固后的 12 秒复验：5 次采样、3 张截图、
  全新存档 `storageAtStart=[]`、0 pageerror，结果仍为 `STOPPED-NOT-RUN`。
- 终局后稳定性仅凭 `isGameEnd` 持续为真不足以证明存档/重载恢复，因此保持
  `NOT RUN`；确认窗口回归才记 `FAIL`。`STOPPED-NOT-RUN`、PACING/ENDGAME FAIL
  与运行错误均以非零退出码结束，避免包装脚本把未完成运行当成功。

## #106 处置建议

生产行为已由当前 main 覆盖，本替代 PR 合并后可关闭 #106 为 `SUPERSEDED`。
关闭说明必须链接本 PR，并明确旧 1069 行 runner 的 3 个审查问题已由新 runner 修正；
不得宣称真实 180 分钟或五项门禁 PASS。
