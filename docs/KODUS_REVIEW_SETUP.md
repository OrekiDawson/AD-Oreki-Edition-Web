# Kodus 审查配置（云端唯一来源，无自定义规则）

## 决策（2026-11-17）

- 停止使用本项目自建的 Kody 自定义规则，Kodus 只保留**基础 Code Review**；业务规则由 `AGENTS.md`、CI、针对性测试与 Agent 执行，不在 Kodus 中重复维护。
- 本仓不再保存任何 Kodus 仓库侧配置或规则文件；审查配置全部在 https://app.kodus.io 维护。
- 统一 **Balanced**，禁止 **Heavy**；不新增收费 AI 审查服务。

## 本仓已移除

- `.kody/rules/gameplay-parity.md`
- `kodus-config.yml`

这两项在云端本就不生效（`kodyConfigFileOverridesWebPreferences=false`）。回滚材料：本文件所在分支的父提交 `a33ce77` 仍保留原始文件。

## 线上现状（2026-11-17 实测）

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