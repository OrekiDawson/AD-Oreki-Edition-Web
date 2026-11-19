# Kodus 审查配置（R120-01 当前状态）

## R120-01 当前状态（2026-11-20，优先于下方历史记录）

- GitHub Actions 的 `kody-trigger.yml` 只负责资格判断、5 分钟稳定窗口、预算、同 Head SHA 去重和精确评论 `@kody start-review`；真实审查由 Kodus GitHub App 完成。
- 仅 OrekiDawson 同仓、`main`、非 Draft PR 自动进入；Fork、其他用户、Bot 跳过。触发 Job 固定检出任信 `main`，PAT 发送评论前核验 `/user` 身份。
- `automatedReviewActive=false`、`reviewCadence.type=manual`、`runOnDraft=false`；不使用 Heavy，不批量重审历史 PR。
- Kody Rules 合计最多 3 条，按仓库和路径限定；规则自动生成关闭，`repoInstructionsEnabled=false`，不把整份 AGENTS 注入审查。
- Android 当前 2 条：真实进度/阶段门禁与调度器权威、Kotlin 业务实现；Web 当前 1 条：真实进度/阶段门禁与调度器权威。
- `suggestionControl.severityLevelFilter=medium`，PR 摘要关闭，自动批准与 Request Changes 关闭，Committable Suggestion 开启；模型为 DeepSeek Flash、Thinking High。
- 每仓每日最多 50 条触发评论，双仓合计不超过 100 条。该上限只约束触发命令，不证明 Provider 模型调用硬上限。
- `codex-deepseek-review.yml` 保留为回滚资产，`OREKI_AUDIT_ENABLED=false`；未经用户明确恢复，不调用 DeepSeek 或发布自制 Review。

## 历史决策（2026-11-17，已由 R120-01 替代）

- 停止使用本项目自建的 Kody 自定义规则，Kodus 只保留**基础 Code Review**；业务规则由 `AGENTS.md`、CI、针对性测试与 Agent 执行，不在 Kodus 中重复维护。
- 本仓不再保存任何 Kodus 仓库侧配置或规则文件；审查配置全部在 https://app.kodus.io 维护。
- 统一 **Balanced**，禁止 **Heavy**；不新增收费 AI 审查服务。

## 本仓已移除

- `.kody/rules/gameplay-parity.md`
- `kodus-config.yml`

这两项在云端本就不生效（`kodyConfigFileOverridesWebPreferences=false`）。回滚材料：本文件所在分支的父提交 `a33ce77` 仍保留原始文件。

## 历史线上现状（2026-11-17 实测）

| 项 | 值 |
| --- | --- |
| 自定义 Kody Rules | **0 条**（`kodus rules view --json` 两次核验均为 `[]`） |
| `automatedReviewActive` | `true`（新 PR 自动执行一次基础审查） |
| `reviewCadence` | `auto_pause` / 3 次推送 |
| `kodyConfigFileOverridesWebPreferences` | `false`（仓库配置不覆盖云端） |
| 强度 | 云端无 `reviewMode` 字面字段；以 `suggestionControl` 与 `reviewCadence` 表达，禁止 Heavy |

## 维护方式

- 只在云端 UI 或官方 CLI 查看/调整：`kodus config remote show`、`kodus rules view`。
- 不创建、不同步新的自定义规则；不运行 `kodus config centralized sync`。
- 合并门禁不变：Kody 对当前最终 HEAD 完成审查（或历史有效审查覆盖同一 Diff）、0 未解决线程、CI 通过；`skipping` 不记为 PASS。
- 无法访问云端页面时相关项记 `NOT RUN`，不得宣称「云端已为 Balanced」。
