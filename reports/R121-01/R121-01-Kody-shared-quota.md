# R121-01 Kody 双仓全局共享配额

## 口径

- Android/Web 共用同一个 UTC+8 自然日计数池，每日上限 100 次。
- 只统计 OrekiDawson 主动发送、正文精确为 `@kody start-review` 的 GitHub issue comment。
- 以原始评论唯一 ID 去重；Webhook 重试、回复、追问、行内讨论、修复提交、Kody 自动消息和 Oreki-Audit 自有审查均不计数。
- 同一 PR 的新评论仍是新请求；两仓没有保留额度或单仓上限。
- 80 次预警，100 次阻止新增主动请求，并展示全局已用、全局剩余及两仓实际用量。
- 当前 Kody 付费审查继续暂停；本修改不构成恢复授权。

## 原子扣减

复用 Web 仓库 `oreki-audit-quota` 协调分支上的共享 CAS 状态。触发流程在发送评论前原子预占 Kody 专用记录；并发请求基于同一父版本创建提交，仅一个 ref 更新可成功，冲突方重读后重新判断。预占成功后才发送评论，成功后回填原始评论 ID；PR 在发送前失效则释放预占。

旧 Oreki Audit 模型调用记录与 Kody 主动指令记录使用不同 `kind`，互不占用对方配额，也不会把 Oreki Audit 审查算入 Kody 的 100 次。

## 代码与测试

- `.github/codex/audit-quota.mjs`：共享 CAS、Kody 预占/回填/释放、按评论 ID 归并、全局与分仓统计。
- `.github/kody/trigger.mjs`：读取两仓当日评论、调用原子预占、发送成功后回填、输出可追溯队列。
- `.github/kody/trigger.test.mjs`：精确指令、双仓累计、评论 ID 去重、同 PR 新请求、自然日、80/100 边界及行内/机器人排除。
- `scripts/tests/test_audit_quota.mjs`：跨仓累计、单仓可用全部 100 次、并发 CAS 冲突、100 次拒绝、次日重置、与 Oreki Audit 配额隔离。

本地结果：

| 测试 | 结果 |
| --- | --- |
| `node --test .github/kody/trigger.test.mjs` | `PASS`，12/12 |
| `node scripts/tests/test_audit_quota.mjs` | `PASS` |
| Node 语法检查 | `PASS` |

## 收费入口风险

两仓 GitHub 工作流当前均为 `disabled_manually`。仓库源码中主动发送精确 `@kody start-review` 的入口仅保留 Kody 触发器，并已接入原子配额门禁；旧 Oreki Audit 工作流停用，且不会发送 Kody 审查指令。

风险未清零：Kodus 是外部 GitHub App，云端自动审查入口不由本仓源码完全控制。R121-01 已记录过 PR 创建后由平台侧连接 Kody 的实际事故；本地无法据此证明不存在其他平台侧自动入口，也不能确认历史费用为 0。因此本报告不把“共享配额”描述为免费保证，后续也不会主动触发收费审查。

## CI 与提交

- Commit：待提交后回填。
- CI：待推送后回填。
