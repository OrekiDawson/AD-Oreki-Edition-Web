# Kodus 审查配置（R120-01 当前状态）

## R120-01 当前状态（2026-11-20，优先于下方历史记录）

- GitHub Actions 的 `kody-trigger.yml` 只负责资格判断、5 分钟稳定窗口、预算、同 Head SHA 去重和精确评论 `@kody start-review`；真实审查由 Kodus GitHub App 完成。
- 仅 OrekiDawson 同仓、`main`、非 Draft PR 自动进入；Fork、其他用户、Bot 跳过。触发 Job 固定检出任信 `main`，PAT 发送评论前核验 `/user` 身份。
- `automatedReviewActive=false`、`reviewCadence.type=manual`、`runOnDraft=false`；不使用 Heavy，不批量重审历史 PR。
- Kody Rules 合计最多 3 条，按仓库和路径限定；规则自动生成关闭，`repoInstructionsEnabled=false`，不把整份 AGENTS 注入审查。
- Android 当前 2 条：真实进度/阶段门禁与调度器权威、Kotlin 业务实现；Web 当前 1 条：真实进度/阶段门禁与调度器权威。
- `suggestionControl.severityLevelFilter=medium`，PR 摘要关闭，自动批准与 Request Changes 关闭，Committable Suggestion 开启；模型为 DeepSeek Flash、Thinking High。
- Android/Web 两仓共用每个 UTC+8 自然日的 100 次全局计数池，不设仓库保留额度或单仓硬上限；80 次预警，100 次拒绝新增主动请求。仅按 GitHub 原始评论唯一 ID 统计有效 `@kody start-review` 指令，Webhook 重试不重复计数；回复、讨论、修复提交、Kody 回复和 Oreki-Audit 自有审查不计数。同一 PR 再次主动发送属于新请求。统计展示全局已用、全局剩余和两端实际用量。
- 预占与扣减复用 Web 协调分支上的共享 CAS 状态，并发请求基于同一父版本提交，只有一个能成功且冲突方必须重读；支付/统计状态不换算成 Provider 模型调用硬上限。
- 用户已于 2026-11-20 明确恢复 Kody 审查；GitHub Actions 负责必要触发，Kodus 云端 `reviewCadence.type=manual`，避免平台自动审查与触发器重复。审查只允许 Balanced，严禁 Heavy。
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
