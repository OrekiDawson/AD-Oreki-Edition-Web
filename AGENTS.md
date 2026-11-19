# Web MOD · Agent 工作规则

> **当前执行状态：`R120-01` 进行中（用户于 2026-11-20 明确继续）。** 本文件适用于本仓 Agent；仅推进用户最近明确授权的审查迁移、双端规则与游戏节奏任务，不恢复无关历史任务或定时计划。
>
> 本文优先于旧轮次说明、旧版 AGENTS 快照和交接文件中的冲突措辞。详细事实按需查阅源码与专题文档；[优化前规则原文](docs/agent-policy/LEGACY_2026-11-17.md) 仅供历史追溯，**不会自动继承为当前指令**。

## 1. 先确认权限、预算与运行状态

- **停工优先**：未获用户明确复工、任务范围、人民币预算、期限和 Provider 授权前，不启动 Goal、Lead/Subagent、付费审查、构建、AVD、自动发布、知识库定时更新或其他新开发。用户单独授权某次文档/仓库操作，仅对该操作生效。
- **付费硬门禁**：累计支出达周期预算 **80%** 时报告并压缩非关键调用；达 **100%** 或下一批调用可能超预算立即停止新增收费任务。DeepSeek 实际可用余额 **低于 ¥10** 时全员暂停；余额未知、凭据撤销或无预算时默认不产生付费调用。不得自行充值、重建密钥、切换账号/Provider 绕开限制。
- **费用归因**：区分 DeepSeek Harness **账号登录态**、API Key 与 Kodus BYOK；依据真实账单记录金额、调用与有效修复，不把某个 Key 的全部费用武断归给 Kody。规则文件不是云端扣费上限，云端 Provider/订阅/自动审查需在平台侧独立停用。
- **价格时间窗**：复工后先重新核验官方现行峰谷规则；若仍为工作日北京时间 09:00–12:00、14:00–18:00 高峰，则按既有计划全员停止，峰前十分钟安全收尾。不得为了“连续工作”违反用户暂停或预算。未完成 Goal 保持真实 paused/blocked，不能伪记 complete。

## 2. 质量与 GitHub 合并门禁

- 先读相关源码/配置/事实，按风险做**最小必要修改与验证**。构建成功、CI 绿色、截图、模型自评都不能代替真实游戏/功能验收；未运行写 `NOT RUN`，失败写 `FAIL`，受阻写 `BLOCKED`，仅有证据才写 `PASS`。文档单改不机械做游戏长跑。
- 使用受保护分支、PR、Required Checks、签名/发布审批。不得强推、关闭 Ruleset、跳过 CI/人工审批或伪造验证。真实 Critical/P0/P1、阻塞性 Medium 必须修复或证据充分地判定误报；非阻塞意见记录合理处置。
- **审查信息读取**：合并前同时检查 PR 普通评论、Reviews、Review Threads、最新 HEAD SHA、Checks；所有需解决的线程归零。Kody 无可用 Provider 出现 `Skipped` / `BYOK Configuration Required` 表示 **KODY NOT RUN**，不是 PASS；不因缺密钥自行重接 Provider，也不制造空 Commit 或重复触发收费审查。
- **Kody PR 审查（R120-01）**：云端自动审查保持 Manual；`kody-trigger.yml` 仅在 OrekiDawson 的同仓、`main`、非 Draft PR 上，经稳定窗口、作者白名单、同 Head 去重和预算门禁后，以 OrekiDawson 身份发送精确评论 `@kody start-review`。Kody 使用 Balanced、简体中文和最多 3 条路径限定的核心规则；`KODY NOT RUN` / `Skipped` 如实记录为 NOT RUN。触发命令上限不等于 Provider 模型调用硬上限，不得夸大成本保证。
- **旧 Oreki Audit（备份）**：Android/Web 的 `codex-deepseek-review.yml` 与 `OREKI_AUDIT_ENABLED` 默认保持停用，仅保留回滚代码；未经用户明确恢复，不得调用 DeepSeek、发布自制 Review 或重新扩权。Oreki Audit App 不再是日常代码审查权威。
- **替代合并门禁**：业务 PR 按工作区 `AGENTS.md` 执行：Required Checks、Ruleset、审批与分支保护全部通过；需解决 Review Threads 归零且普通评论逐条有结论；变更范围对应的真实运行验证（Web Playwright/Chromium 手机视口；未运行记 `NOT RUN`）；高风险改动（阶段门禁、存档、自动购买器、构建/部署链）完成独立定向复核。
- **过渡边界**：工作区规则 PR 已合并后按替代门禁执行；不得借本节绕过真实 P0/P1、Ruleset、Required Checks 或既有审批。用户**明确逐次授权**的纯文档维护按其批准范围处理审查缺失，但必须保留记录，不得推广为业务/生产 PR 的常规豁免。
- 只有授权开发会话内才主动处理 Issues/PR；不轮询空任务、不启用未经批准的持续监控或夜间 Agent。若用户日后重新启用 Kody，仅限已批准预算下的 Balanced/最少必要审查，不使用 Heavy。

## 3. Agent Response 及时反馈

- 收到用户任务、Steer 或重要反馈后，尽快发送有实际内容的简体中文 Response；长任务原则上每 2 分钟至少一次，写明已完成、当前操作、真实障碍和下一步。
- P0、构建/运行失败、Subagent 异常、CI 阻塞、预算预警、重大风险及成功交付立即反馈。Lead 负责整体同步并及时核实 Subagent 结论；Subagent 通过任务文件报告关键变化。
- 每次正常用户可见回合必须有实际正文，禁止只调用工具或等待后静默结束。反馈须区分 `PASS / FAIL / BLOCKED / NOT RUN`，不得把计划或 Subagent 自述写成已验证完成，也不得为凑频率制造无意义调用或打断长跑。

## 4. 项目技术边界

- 上游基线冻结为 2026-07-17 的 `IvarK/AntimatterDimensionsSourceCode` commit `5409e320`；不自动升级/重写冻结基线。与 Android 保持可见规则与核心行为一致，差异留证。
- Web 玩法、自动购买器、阶段门禁、存档和教程遵守真实进度原则：大坍缩后不得越过 Infinity；永恒、现实内容按真实结算解锁；不通过切页伪造状态刷新。MOD 调度节拍与原版自动器节拍分离，尊重玩家手动设置和托管边界。
- 采用现有 JavaScript/Node、Playwright/Chromium 手机视口和必要真实浏览器验证；静态检查或本地页面能打开不能替代真实 GUI/存档测试。新档合法墙钟 **≤180 分钟**通关是长期目标。
- `oreki.net` 的部署副本在 `OrekiDawson.github.io`；只从已验证 Web 源码/提交同步，正式 Pages 部署遵守 CI/CD、受保护环境、验收及回滚门禁，不直接拼改部署副本。
- 规则与事实：[docs/DELIVERY_RULES.md](docs/DELIVERY_RULES.md)、[docs/FACTS.md](docs/FACTS.md)、[docs/GIT_MAIN_CICD_SYNC.md](docs/GIT_MAIN_CICD_SYNC.md)。

## 5. 工作方式与文档卫生

- 尽量复用已有任务、索引、证据与历史失败记录；不要无意义全量反编译、跨仓同步、重复大上下文调用、重复构建或等待轮询。并行 Agent 严格隔离文件与独占资源，使用实际可用的交接机制，不假设后台自动运行。
- 中文为默认文档、PR/Issue 正文及有意义代码注释语言；标识符、API、协议、路径、原文错误消息保留准确拼写。只解释必要的意图/边界，不为中文化重写第三方或生成代码。
- README 供读者使用，`AGENTS.md` 只保留常驻执行约束；专题技术手册、历史决策、日记、临时轮次放入 `docs/`。新增常驻规则前先合并/替换旧条款，避免重复和矛盾；建议根规则保持 **12 KiB 以下**。
- 历史任务编号、提交、原始证据和已发布产物不因规则优化而重写；本文件与相应专题文档冲突时遵循最新用户授权、冻结/预算/安全门禁及本文件的明确状态优先级。
