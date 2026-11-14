## 本次 Web 修改

- 任务编号/Issue：
- 游戏逻辑、GUI、教程、存档、移动兼容影响：
- 与 Android 端差异及原版对照：

## 证据（未执行写 NOT RUN）

- Node/静态定向检查：PASS / FAIL / BLOCKED / NOT RUN
- Playwright 真正启动游戏并操作相关场景：PASS / FAIL / BLOCKED / NOT RUN
- Android Chrome / AVD（必要时）：PASS / FAIL / BLOCKED / NOT RUN
- 教程 JSON 与生成模块同步：PASS / FAIL / BLOCKED / NOT RUN
- GitHub Actions URL / 截图或 Trace：
- 改动是否需部署 oreki.net：是 / 否

## 发布安全

- [ ] 未提交私人存档、Token 或凭据
- [ ] 未将 Node 或浏览器冒烟 PASS 冒充实际玩法 PASS
- [ ] 部署仅在相关 Playwright 业务验收及严格发布门禁 PASS 后触发
- [ ] 保留 Pages 的 CNAME 和部署专属资源
- [ ] 已记录未完成项及必要的跨端差异

> PR 合并 ≠ oreki.net 已部署。详见 `AGENTS.md`、`docs/DELIVERY_RULES.md`。

> 新 PR 将收到 `github-actions[bot]` 的非阻断规模与高风险范围摘要；如超过 100 个文件、20,000 行或涉及大文件，请在正文解释来源和验证边界。机器人提示不代表代码审查批准，也不能替代既有 CI 与真实运行验收。
