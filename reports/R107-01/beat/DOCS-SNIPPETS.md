# docs/FACTS.md / WEB_ANDROID_DIFFERENCES.md 建议条目（供 Lead 合并）

## A. docs/FACTS.md 新增

\`\`\`md
### C.xx 阶段化节拍：MOD 自动化 effectiveInterval = min(玩家配置, 阶段上限)

- 事实（2026-11-14）：玩家配置 1~60 s 只作为**上限**；MOD 调度器按 realities 分档加速：
  0→1 s、1~9→2 s、10~49→3 s、>=50→5 s。只影响 MOD 自动化调度（阶段任务/执行层 verb），
  不写 player 字段、不改 UI 配置值、不影响原版自动购买器与游戏结算。
- 依据：Android 实测默认 10 s 首 reality≈42 min、1 s≈14.6 min；Web R50 旧默认 3 s 曾 739.6 s 通关，
  R85 默认改 10 s 后显著变慢；R107 修复后 interval=1 时 r20@731 s。
- 实现：Web \`src/core/oreki-smart-executor.js\`（STAGE_BEAT_CAPS / stageBeatCapSec / effectiveBeatMs）；
  Android 由 hook-migrate 同步（同一张表，见 \`reports/R107-01/beat/SEMANTICS.md\`）。
- 观测：\`OrekiSmartExecutor.effectiveIntervalSec\`、\`debugState().stageCapSec\`；
  UI/存储仍显示玩家配置（默认 10 s）。
- 验证：默认设置真实新档 45 min 跑次（不注入 interval/速度）首无限/Break/首永恒/首现实时间与
  realities 数见 \`reports/R107-01/beat/\`；49/49 定向验收复跑 PASS（其中 2 项节拍断言按新语义更新）。
\`\`\`

## B. WEB_ANDROID_DIFFERENCES.md 新增行

\`\`\`md
| 阶段化自动节拍（R107-01 P1） | 玩家配置 1~60 s 为上限，MOD 调度器按 realities 分档取 min：0→1 s、1~9→2 s、10~49→3 s、>=50→5 s；不改 UI/存档/原版自动购买器 | Android 由 hook-migrate 同步实现，必须使用同一分档表与公式（见 reports/R107-01/beat/SEMANTICS.md） | 已同步（2026-11-14 Web 实现）；Android 实现待 hook-migrate 落地后按 FACTS 记录核对 |
\`\`\`

## C. 备注

- 以上为片段，未直接修改共享文档；合并时保留原编号/表格风格。
- 证据目录：\`reports/R107-01/beat/\`。
