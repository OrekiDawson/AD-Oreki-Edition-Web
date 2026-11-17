# Kodus Cloud 在线 PR 审查

本仓已移除 Oreki Audit Bot 的 GitHub Actions 和执行器；历史 R115 报告保留。
改用 [Kodus Cloud](https://app.kodus.io) 的 Community BYOK 方案。

- 通过 Kodus 账号与 GitHub App 授权启用 `OrekiDawson/AD-Oreki-Edition-Web`；不可单靠仓库文件宣称云端已连接。
- 在 Kodus 自己的 BYOK 页面配置模型密钥；不得上传密钥至仓库或普通 CI。
- 每仓核实 `kodus-config.yml` 与 `.kody/rules/gameplay-parity.md` 已被在线服务读取。
- 审查触发策略以 Kodus 云端实际配置为准，`kodus-config.yml` 的手动模式不代表可以跳过审查。Kodus 云端自动审查无法自动继承本项目工作日高峰和 DeepSeek 余额低于 ¥10 时的停工规则；仅在时段、预算均允许时触发收费审查。
- **合并硬门禁**：按根目录 `AGENTS.md` 第 15 节，合并任何需要 Kody 审查的 PR 前，必须核验 Kody 对最终 HEAD SHA 已完成审查、逐条处置意见且未解决 Review Threads 为零；排队、未触发或不可用均记录 `BLOCKED`，不得以 P0 热修、纯文档或人工复核为由自动豁免。这里的 Kody 结论虽不能代替 Node、Playwright、Required Checks 和 Pages 发布验证，但也不能被这些检查替代。
- 旧 `oreki-audit` GitHub App、仓库 Secrets/Variables 需在 GitHub 管理界面另外撤销；移除工作流不会自动销毁账户凭据。
