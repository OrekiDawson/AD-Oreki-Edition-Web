# Kodus Cloud 在线 PR 审查

本仓已移除 Oreki Audit Bot 的 GitHub Actions 和执行器；历史 R115 报告保留。
改用 [Kodus Cloud](https://app.kodus.io) 的 Community BYOK 方案。

- 通过 Kodus 账号与 GitHub App 授权启用 `OrekiDawson/AD-Oreki-Edition-Web`；不可单靠仓库文件宣称云端已连接。
- 在 Kodus 自己的 BYOK 页面配置模型密钥；不得上传密钥至仓库或普通 CI。
- 每仓核实 `kodus-config.yml` 与 `.kody/rules/gameplay-parity.md` 已被在线服务读取。
- 当前保留手动审查：Kodus 云端自动审查无法自动继承本项目工作日高峰和 DeepSeek CNY <10 熔断。确认预算与时段条件后才启动收费审查。
- Kody 评论是辅助审查；不能代替 Node、Playwright、Required Checks 和 Pages 发布验证。
- 旧 `oreki-audit` GitHub App、仓库 Secrets/Variables 需在 GitHub 管理界面另外撤销；移除工作流不会自动销毁账户凭据。
