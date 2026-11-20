# Kodus 审查配置（R121-01 当前状态）

## R121-01 当前状态（2026-11-20，优先于下方历史记录）

- **2026-11-21 最新用户指令：Kody 恢复可用。** 先前的暂停事件只作为历史审计记录。
  当日通过 `gh api repos/.../actions/workflows/kody-trigger.yml` 回读到 Android/Web
  两个触发器的 `state=active`；可核对页面为 [Android 触发器](https://github.com/OrekiDawson/AD-Oreki-Edition-Android/actions/workflows/kody-trigger.yml)
  与 [Web 触发器](https://github.com/OrekiDawson/AD-Oreki-Edition-Web/actions/workflows/kody-trigger.yml)。
  仍只允许 Balanced、严禁 Heavy，并继续遵守 Android/Web 共享 100 次、按原始评论唯一 ID 去重和同 Head 最少必要复审规则。
- GitHub Actions 的 `kody-trigger.yml` 只负责资格判断、5 分钟稳定窗口、预算、同 Head SHA 去重和精确评论 `@kody start-review`；真实审查由 Kodus GitHub App 完成。
- 仅 OrekiDawson 同仓、`main`、非 Draft PR 自动进入；Fork、其他用户、Bot 跳过。触发 Job 固定检出任信 `main`，PAT 发送评论前核验 `/user` 身份。
- `automatedReviewActive=false`、`reviewCadence.type=auto_pause`、`runOnDraft=false`；不新增自动触发器，不批量重审历史 PR。
- 通用审查标准只维护在 Kodus Global Rules；当前唯一规则为 `Oreki 全局审查基线`（ID `6b9b0794-457a-427c-8a07-ff348a8574ce`）。Android/Web/Wiki 的 Repository 与 Directory Rules 均为空，不重复复制项目业务规则。
- `repoInstructionsEnabled=true`，Kody 主动读取目标仓库的 `AGENTS.md`；Wiki 另参考 `content/wiki-rules.md`。`AGENTS.md` 是项目执行规范，Global Rules 是审查规范。
- 自动规则生成关闭（三仓均不足官方要求的 3 个月审查历史），`kodyKnowledgeApproval.enabled=true`；未来启用时候选规则必须先审批，不得直接生效或自动提升为 Global。
- 2026-11-20 从 [Kodus Global 设置](https://app.kodus.io/settings/code-review/global/general) 逐项读取：

| 配置项 | 当前值 | 来源 |
| --- | --- | --- |
| `suggestionControl.severityLevelFilter` | `low` | [Global 设置](https://app.kodus.io/settings/code-review/global/general) |
| `suggestionControl.groupingMode` | `minimal` | [Global 设置](https://app.kodus.io/settings/code-review/global/general) |
| `suggestionControl.severityLimits` | `low=3 / medium=5 / high=5` | [Global 设置](https://app.kodus.io/settings/code-review/global/general) |
| `summary.generatePRSummary` | `false` | [Global 设置](https://app.kodus.io/settings/code-review/global/general) |
| `isRequestChangesActive` | `true` | [Global 设置](https://app.kodus.io/settings/code-review/global/general) |
| `pullRequestApprovalActive` | `false` | [Global 设置](https://app.kodus.io/settings/code-review/global/general) |

这些值保留真实阻塞能力，关闭 PR 摘要生成和自动批准。规则内容另见 2026-11-20 读取的 [Global Rule「Oreki 全局审查基线」](https://app.kodus.io/settings/code-review/global/kody-rules/6b9b0794-457a-427c-8a07-ff348a8574ce?teamId=577e813f-b16f-49f6-9999-7c7b288b8e84)（ID `6b9b0794-457a-427c-8a07-ff348a8574ce`），用于核对审查分级与禁止 Heavy 等基线内容。
- 实际审查运行模型为 `deepseek-flash`；该结论来自 2026-11-20 的 [Kodus Token Usage](https://app.kodus.io/usage/tokens) 动态用量记录，不是固定配置证明。CLI 未提供可核对的 Thinking 档位字段，不为该字段作未经证据支持的声明。
- 前文 `automatedReviewActive=false`、`reviewCadence` 和 `runOnDraft=false` 条目已于同日用 `kodus config remote show OrekiDawson/AD-Oreki-Edition-Android`、`...-Web` 和 `...-Wiki` 逐库读取。Repository/Directory Rules 另用 `kodus rules view --json` 按三个 repository ID 核验，均返回 `[]`；Global 设置页不能单独证明这些仓库级值。
- Android 的自动触发实证为 `pull_request_target` 事件 [Run 44767526027](https://github.com/OrekiDawson/AD-Oreki-Edition-Android/actions/runs/44767526027)：PR #206，Head `1d0b951324220c4923f46315f72634c055c5e2da`。该链路在最新恢复授权后重新启用；每次启用或配置变化仍须回读云端设置、工作流状态和共享配额，不能只引用历史 Run。
- Android/Web 两仓共用每个 UTC+8 自然日的 100 次全局计数池，不设仓库保留额度或单仓硬上限；80 次预警，100 次拒绝新增主动请求。仅按 GitHub 原始评论唯一 ID 统计有效 `@kody start-review` 指令，Webhook 重试不重复计数；回复、讨论、修复提交、Kody 回复和 Oreki-Audit 自有审查不计数。同一 PR 再次主动发送属于新请求。统计展示全局已用、全局剩余和两端实际用量。
- 预占与扣减复用 Web 协调分支上的共享 CAS 状态，并发请求基于同一父版本提交，只有一个能成功且冲突方必须重读；支付/统计状态不换算成 Provider 模型调用硬上限。
- Kody 已恢复；GitHub Actions 负责必要触发，并保持 `automatedReviewActive=false`、`reviewCadence.type=auto_pause`，避免平台自动审查与触发器重复。所有场景都只允许 Balanced，严禁 Heavy。
- `codex-deepseek-review.yml` 保留为回滚资产，`OREKI_AUDIT_ENABLED=false`；未经用户明确恢复，不调用 DeepSeek 或发布自制 Review。

### 旧项目级规则迁移映射

项目级 Kody Rules 已清空，原有约束没有丢弃：

- Android「真实进度/阶段门禁与调度器权威」→ `AGENTS.md` §4：阶段按真实状态解锁，禁止伪造资源、成就或结算；自动购买器的受管配置以合法阶段策略为权威，并按 `1～60` 秒、缺省 `10` 秒调度恢复。
- Android「Kotlin 业务实现」→ `AGENTS.md` §4：新增或修改游戏业务只能使用 Kotlin，原版 DEX/Smali 仅作为已核实 ABI/兼容入口。
- Web「真实进度/阶段门禁与调度器权威」→ `AGENTS.md` §4：禁止越过真实结算解锁或伪造状态；受调度器管理的自动购买器配置按合法阶段策略在下一 tick 校正。
- 跨仓审查行为 → Kodus Global Rule `6b9b0794-457a-427c-8a07-ff348a8574ce`：读取仓库 `AGENTS.md`、按实际 Diff 分级、去重复审、优先真实缺陷并禁止 Heavy。

因此，Repository/Directory Rules 为空不表示削减业务覆盖；业务执行规则由仓库 `AGENTS.md` 提供，通用审查方法由 Global Rule 提供。

## PR 审查效率基线（2026-11-20）

- A 类（文档/非行为）：快速检查事实、链接、版权、规范、敏感信息和明显错误，不执行无关业务扫描、构建或游戏长跑。
- B 类（CI、Actions、审查触发器、共享配额、Webhook、构建/发布工具）：属于基础设施定向深入审查，不是轻审；必须检查并发原子性、幂等与 Webhook 重试去重、权限、状态一致性、边界、失败恢复、回滚及对下游审查链的实际影响。Android PR #205 修改共享配额与审查触发链路，是 B 类中的高风险案例，不得因未改游戏代码而降低审查等级。
- C 类（Kotlin/JS 游戏业务、存档、资源结算、挑战、阶段门禁、自动购买器）：保持完整风险审查与对应真实运行证据。
- 混合 PR 按最高等级验收，但不同文件采用各自审查重点。同一 HEAD、同一审查配置版本和适用范围已有有效结果时不得重复请求；一批修复完成并定向测试后统一复审。不得以空 Commit、关闭重开、改标题触发复审，也不得将“已审查”替代真实运行 PASS。
- 达到收口条件时及时合并：最终 HEAD 审查完成，Critical/P0/P1 和阻塞性 Medium 已解，Review Threads 合理归零，Required Checks 与必要定向测试通过，分支保护允许。Codex 自动审查、Kody Balanced、共享 100 次配额、签名和发布门禁均不因效率优化降低。

## 历史决策（2026-11-17，已由 R121-01 替代）

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
