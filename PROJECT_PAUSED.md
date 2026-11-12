# WEB DEVELOPMENT ACTIVE — AD-Oreki-Edition-Web

- 状态修正日期：2026-11-12（Asia/Hong_Kong）
- 项目状态：**ACTIVE**，独立开发、测试及发布；不因 Android、AVD 或插件工作暂停。R101 的 Web 生产变更（autoEternity 门禁 + 教程/附录 F 文案）已合入源码
- 当前授权轮次：R102；R101 历史记录保留。Web 持续并行，Playwright 作为默认真实浏览器调试和发布验收工具（见 AGENTS.md §8）。
- 本轮 Web 变更：
  1. src/core/oreki-eternity-automation.js：tickEternity() 增加「原版自动永恒开关」判据；
     buyEcStudiesAndStart() 在 canEternity 为真且开关关闭时不自动进入 EC（与 Android 等价）。
  2. src/core/oreki-tutorial-data.json：教程与附录 F 同步「必须打开原版自动永恒开关才会自动结算」
     以及永恒结算阈值 ×1（与双端真实代码一致）。
  3. scripts/check_eternity_gate.mjs：回归用例扩到 70 项（含开关正/反向、手动入口不受影响），全部通过。
- 验证：node --check 语法通过；check_eternity_gate.mjs 70/70 PASS；真实浏览器运行 NOT RUN
  （本机无可用浏览器驱动，未伪造 PASS）。
- 部署 oreki.net：取决于生产变更验收口径，本轮未部署（浏览器验收未完成）。
- 恢复方式：读 AGENTS.md / docs/FACTS.md；node serve.mjs 8080 本地运行；
  部署走 web/_deploy/deploy_pages.py，先同步源码再验证。

- 历史说明：此前 R101 因缺少浏览器驱动而未完成真实浏览器验收和 oreki.net 部署；该事实继续为 NOT RUN，但不再作为暂停 Web 开发的理由。相关生产变更须在 Playwright 真实浏览器验收 PASS 后方可发布。
