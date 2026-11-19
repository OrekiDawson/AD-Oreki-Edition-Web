# R120-01 按需跨仓审查验证

## 已实现

- 单一 `codex-deepseek-review.yml` 分为 classify、review、publish 三个 Job。
- `.github/codex/review-context.mjs` 使用真实路径规则分类共享玩法。
- 调度器改动会读取 Android 的调度器、阶段和玩家意图模块；仅在命中共享路径时触发。
- 对端源码只读取 main 的指定片段，并记录仓库名和 Commit SHA。
- Diff 与对端上下文均有字符上限；超限记录 `truncated`，不得宣称全量审查。
- 相同 Head SHA 与审查配置版本只发布一次；评论 Job 使用 Oreki Audit App 且与模型 API Key 隔离。

## 已完成验证

- Web 调度器分类：`PASS`，命中 `scheduler`，读取 Android 对端 main 的 3 个相关文件。
- Android 调度器分类：`PASS`，命中 `scheduler`，读取 Web 对端 main 的 3 个相关文件。
- 纯 UI 路径：`PASS`，不读取对端仓库。
- 未知 `src/core` 规则：标记人工确认，不静默视为完整审查。
- 本地分类器、Workflow YAML、权限与去重策略测试：`PASS`。

## 首次部署故障与修复

- 首次真实 `pull_request_target` 触发发现 main 缺少 `.github/codex/deepseek-models.json`，分类前置配置版本计算失败。
- 修复 PR 补齐模型元数据，并将 GITHUB_OUTPUT 写入合并为单块，修复 actionlint `SC2129`。
- 修复已进入 main；最终端到端结果以本目录后续 Run 记录为准。

## 成本

- 默认模型 `deepseek-flash`，low effort，只读。
- 每次 PR 更新最多一次主要模型审查，无自动第二轮。
- 每日 Workflow 运行上限由 `OREKI_AUDIT_DAILY_LIMIT` 控制。
- 第一次端到端在模型调用前因配置失败终止，未产生模型 Token。
