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
- Android/Web 共享每日最多 100 次真实模型审查；日期按 Asia/Shanghai 分区。
- 第一次端到端在模型调用前因配置失败终止，未产生模型 Token。
- 修复后真实模型审查完成两次：Web PR #75 使用 `22,265` Token；Android PR #186 使用 `18,833` Token。
- 两次审查都带 `CROSS_REPO=true` 与对端 main SHA；结果明确标记原 Diff 截断和未覆盖文件。

## 共享配额与原生 Review

- 配额权威存储为 Web 仓 `oreki-audit-quota` 分支的 `quota/state.json`。
- 预占以读取到的 ref SHA 为 parent 创建新 commit，再用 `force=false` 更新 ref；并发请求只有一个能成功，冲突方重读重试。
- 同一个审查身份完成成功后直接复用报告，不重复扣减；模型已开始后崩溃保留消耗，不自动回收。
- 结构化审查使用 JSON Schema，一次 `POST /pulls/{n}/reviews` 可提交多个 inline comment 与 suggestion。
- 配额服务不可用时，Run `44563852386` 返回 `AI_REVIEW_NOT_EXECUTED`，由 `oreki-audit[bot]` 更新单一评论：[PR #75 评论](https://github.com/OrekiDawson/AD-Oreki-Edition-Web/pull/75#issuecomment-7014201212)。

## 当前阻塞

- Oreki Audit App 已具备 `Pull requests:write`，但 Web 仓 `Contents:write` 未授权；创建共享配额写令牌返回 HTTP 422。
- 因此当前模型调用与配额原子预占均为 `BLOCKED`，没有在无配额状态下调用模型。
- 原生 Review 发布逻辑与行定位夹具为 `PASS`，但真实 End-to-End Review 线程仍为 `NOT RUN`，需先授予 Web 仓 `Contents:write`。
