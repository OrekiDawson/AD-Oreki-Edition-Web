# 反物质维度 · Oreki Edition（Web）

基于《反物质维度》（Antimatter Dimensions）的网页 MOD，提供简体中文界面、教程、智能自动化、速度设置及移动端布局，并与 Android 版共同维护核心玩法的一致性。

**在线体验：<https://oreki.net>**

- [中文知识库](https://wiki.oreki.net) · [Android 版本](https://github.com/OrekiDawson/AD-Oreki-Edition-Android)
- [当前 PR](https://github.com/OrekiDawson/AD-Oreki-Edition-Web/pulls) · [问题反馈](https://github.com/OrekiDawson/AD-Oreki-Edition-Web/issues) · [历史与事实](docs/FACTS.md)

> 在线部署版本、某次新档通关成绩及 Kody 审查开关都可能变化。请以部署记录、实际页面、运行证据和最新授权为准，不把 README 中的历史说明当作实时状态。

**[中文目录导览与归档约定](docs/目录与中文命名约定.md)**：源码位于 `src/`，可读说明位于 `docs/`，任务及验收分别位于 `tasks/`、`reports/`；[旧项目暂停记录](archive/项目暂停记录.md) 已从根目录归档，保留 Git 历史。工程必须识别的英文文件名维持原样。

## 开始游戏与存档

使用桌面浏览器或 Android Chrome 打开 [oreki.net](https://oreki.net)。存档通常保存在当前浏览器的站点存储中，**不会自动跨设备同步**。换浏览器、换设备或清理站点数据前，请从游戏内的存档工具导出备份并妥善保存。

## MOD 特点

- 在原版合法推进与挑战结算基础上，优化自动化和阶段过渡，减少无意义等待或切页。
- MOD 调度 tick 为 **1–60 秒**，默认 10 秒，与原版自动购买器节拍相互独立。
- 所有受管自动购买器配置由调度器按合法阶段策略管理，玩家修改后在下一 tick 校正。
- 阶段门禁、资源、存档与终局只由真实游戏状态决定，不依赖切页伪刷新，也不虚构成就或结算。
- 不提供 STD/IAP 商店；历史存档中的购买字段只做兼容读取，不恢复任何商店倍率、外观购买或时间跳跃效果。
- 存档与原版保持双向互通：原版存档可导入，本版导出的存档可由原版重新导入。
- **真实新档墙钟 ≤180 分钟**完成原版终局是长期验收目标；某次测试通过不能保证所有设备与版本都通过。
- 长期体验目标按五阶段自然展开：0～30 分钟建立玩法理解，30～75 分钟展开无限/永恒，75～130 分钟进入现实与主要天神，130～165 分钟推进后期与 Pelle，165～180 分钟完成真实结算与收尾。详见 [长期 Agent 规则](AGENTS.md)。

## 本地运行

需要 Node.js。由于游戏使用浏览器 ES 模块，应通过 HTTP 访问，不能直接以 `file://` 打开页面。

```bash
node serve.mjs 8080
```

浏览器访问 <http://127.0.0.1:8080/>。该本地服务器不等于正式部署。

教程源数据位于 `src/core/oreki-tutorial-data.json`，修改后应使用项目现有检查与生成流程，不直接改生成物。

## 目录与测试

| 路径 | 用途 |
| --- | --- |
| `src/main.js`、`src/game.js` | 启动入口及游戏主循环 |
| `src/core/` | 游戏机制、存档、自动化和教程数据 |
| `src/components/` | 界面组件 |
| `public/` | 静态资源与样式 |
| `scripts/` | 内容生成、检查及定向测试 |
| `docs/`、`reports/` | 规则、事实、历史验证与部署证据 |

按改动范围执行必要 Node 检查、Playwright/Chromium 手机视口和真实浏览器测试。影响阶段、自动化或存档的修改必须有对应行为证据；`PASS`、`FAIL`、`BLOCKED`、`NOT RUN` 不得混用。

正式发布由受保护的 GitHub Pages 流程从已验证源码部署。部署成功、浏览器页面可打开、完整游戏验收是不同概念。

## 规则、上游与许可

- [Agent 长期规则](AGENTS.md) · [交付要求](docs/DELIVERY_RULES.md) · [事实索引](docs/FACTS.md)
- [双端差异](WEB_ANDROID_DIFFERENCES.md) · [规则索引](docs/RULES_INDEX.md)
- Web 上游基线冻结于 2026-07-17 的 `IvarK/AntimatterDimensionsSourceCode` Commit `5409e320`；重大升级需另行授权，不自动追随上游。
- 许可证及第三方声明见 `LICENSE`、`MOD-LICENSE`、`NOTICE.md`。

需要最新测试和上线状态时，请查看对应 PR、工作流和报告，而不是依赖旧轮次截图或固定 SHA。
