# 反物质维度 · Oreki Edition（Web）

**打开浏览器，让反物质开始增长。**

[立即游玩](https://oreki.net/) · [中文 Wiki](https://wiki.oreki.net/) · [Android 版](https://github.com/OrekiDawson/AD-Oreki-Edition-Android)

在《反物质维度》（Antimatter Dimensions）中，数字的增长只是开场。维度、重置、挑战和一层又一层新的机制，才是游戏真正的谜题。

Oreki Edition 的 Web 版保留这些谜题，尝试把等待变短、把操作变顺，让你更快看到下一种玩法。无需安装客户端，打开支持现代 JavaScript 的浏览器即可开始。

## 这里有什么？

- 简体中文界面与教程，兼顾桌面和手机屏幕。
- 可调整的速度设置及智能调度器：默认每 10 秒运行一次，可设为 1～60 秒。
- 受管自动购买器由调度器统一配置，手动修改会在下一 tick 被校正；原版自动购买器的内部节拍保持独立。
- 取消 STD/IAP 商店与额外商店加成，保留原版合法游戏机制。
- 以原版双向存档兼容、Android/Web 核心行为一致及约 180 分钟真实新档通关为持续验收目标。

无限之后还有永恒，永恒之后还有现实。我们希望加速的是旅程，而不是跳过终点前的所有风景。资源、解锁、挑战和成就仍由真实游戏状态决定。

## 游戏之前，记得备份

浏览器存档通常保存在本站的本地站点数据里，并不会自动同步到另一台设备。换浏览器、清理数据或迁移版本前，请先使用游戏内的导出功能备份。

[开始游玩](https://wiki.oreki.net/player/getting-started/) · [玩法机制](https://wiki.oreki.net/player/gameplay/) · [存档说明](https://wiki.oreki.net/player/gameplay/saves)

## 在自己的电脑上运行

安装 Node.js 后，在仓库根目录执行：

```bash
node serve.mjs 8080
```

访问 <http://127.0.0.1:8080/>。游戏使用 ES 模块，请通过 HTTP 服务访问，不要直接双击 HTML 文件。

想顺着代码看看一次游戏更新是怎样发生的？

| 从哪里读 | 你会遇到什么 |
| --- | --- |
| `src/main.js`、`src/game.js` | 启动、初始化与游戏循环 |
| `src/core/` | 资源、进度、存档与自动化机制 |
| `src/components/` | 玩家实际看到的界面 |
| `public/` | 样式和静态资源 |
| `scripts/` | 内容生成与验证工具 |

教程的数据源位于 `src/core/oreki-tutorial-data.json`，修改后使用现有生成流程更新对应产物。涉及游戏行为的改动还应检查真实浏览器中的运行结果。

## 继续探索

- [开发者专区](https://wiki.oreki.net/developer/) · [双端差异](WEB_ANDROID_DIFFERENCES.md)
- [协作规则](AGENTS.md) · [交付说明](docs/DELIVERY_RULES.md) · [事实索引](docs/FACTS.md)
- [问题反馈与建议](https://github.com/OrekiDawson/AD-Oreki-Edition-Web/issues)

## 上游与许可

本版基于 [Antimatter Dimensions 原版源码](https://github.com/IvarK/AntimatterDimensionsSourceCode)，冻结 Web 基线为 2026-07-17 的 `5409e320`。感谢原版作者与贡献者。

许可及第三方归属见 [LICENSE](LICENSE)、[MOD-LICENSE](MOD-LICENSE) 与 [NOTICE.md](NOTICE.md)。

愿你的下一次增长，带来一个新的问题，而不仅是更长的一串数字。
