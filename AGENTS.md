# AD-Oreki-Edition-Web 规则

本仓库是 Web MOD 源码仓库。Web 工作流持续 **ACTIVE**，独立开发、独立验收、独立发布；不得因 Android、AVD、APK 构建或插件 PR 阻断而暂停。旧规则已归档到 `archive/rules-pre-reset-2026-11-11/`，不再生效。

## 1. 边界

- 当前冻结的 Web 上游基线；不跟随 Android 版本号假装同源验证。
- 与 Android MOD 核心游戏行为保持等价；差异记录在 `WEB_ANDROID_DIFFERENCES.md` 或对应技术记录中。
- 保持移动端可用性；玩家可见文本使用简体中文和项目官方术语。
- `web/_deploy/site/` 是部署副本，不是第二个源码入口。

## 2. 验证

- 优先针对性测试；测试范围由实际风险决定，不强制全量回归。
- 真实游戏进度和存档不得伪造；不得用界面文字或内部字段代替真实结算。
- 涉及移动端、阶段、教程、自动购买器或 GUI 的改动，默认使用 Playwright + Chromium 执行对应的真实浏览器验证；重大 Android Chrome 兼容问题按需补充真实设备/AVD 验证。
- 未运行写 `NOT RUN`，失败写 `FAIL`，不伪造 `PASS`。

## 3. 交付

- 构建、运行和测试入口以 `README.md` 与 `docs/FACTS.md` 为准。
- 已验收版本才允许部署；本地页面可打开不等于线上部署成功。
- 部署前从本仓同步到部署仓库，核对入口、资源、模块路径和移动端表现。
- Web 独立保持 ACTIVE。自身关键浏览器场景通过后可独立部署 oreki.net，不等待 Android 修复、构建或发布；门禁未通过时只阻止对应版本部署，不停止其他 Web 开发。

## 4. 事实与历史

- 工程事实、教程数据、存档结论和测试结果保留在 `docs/FACTS.md`、`docs/`、`tasks/`、`reports/`。
- 历史任务与报告保留原样，不要求每轮通读。
- 旧规则：[archive/rules-pre-reset-2026-11-11/](archive/rules-pre-reset-2026-11-11/)，只供追溯。

## 5. 自主排障

- 发现 Web 运行、存档或 GUI 异常时，先自行收集日志与复现证据，再定位根因。
- 授权范围内直接做最小修复；修复后执行针对性验证并检查回归。
- 无法复现或验证时如实说明；不隐藏异常、不伪造测试结果。

## 6. Python 合理使用原则

- Python 可用于构建辅助、自动化测试、存档分析、调试及数据处理；优先复用现有工具，避免无必要的依赖和脚本膨胀。
- Android 新增或修改的游戏业务逻辑仍必须使用 Kotlin；禁止新增 Java/Smali 游戏业务实现。Python 不得替代 Android Kotlin 业务代码。
- 既有 Python 构建脚本允许必要的维护和 Bug 修复；迁移到 Gradle/Kotlin/Rust 应以实际收益和风险为依据，不强制为迁移而迁移。
- GitHub 语言统计由 .gitattributes 的 Linguist 属性独立管理；只排除真实的生成或第三方内容，不伪装文件语言，不影响 Git 跟踪与构建。
- 旧版已废止规则见 [归档](archive/rules-pre-reset-2026-11-11/python-strict-ban-2026-11-11.md)。

## 7. DeepSeek 峰谷计费约束（强制）

- 完整规则见全局 `~/.dsh/AGENTS.md` 第五节；本仓库的开发工作同样适用，不得在高峰计费时段进行任何开发动作。
- 已核实峰段（2026-11-12，官方价格页）：UTC 周一至周五 01:00–04:00、06:00–10:00；北京时间 09:00–12:00、14:00–18:00。其余时间（含周末与中国法定节假日）为低谷。
- **“高峰前 10 分钟开始收尾”是收尾启动时刻，不是收尾完成截止时刻。** 例如高峰 09:00 时 **08:50 才开始**收尾，09:00 前完成；高峰 14:00 时 **13:50 才开始**收尾，14:00 前完成。08:50/13:50 之前正常开展可安全结束的开发，不得误读为必须在这些时间以前把 `/goal` 设为 `complete` 或提前停工；如有更早结束的独立原因可正常收口。
- 高峰开始时必须停止全部 DeepSeek 开发请求；不为等到收尾窗口而启动无法安全完成的长任务。本规则优先于交付节奏。不要把 `13:50 开始收尾` 错写成 `13:50 前完成收尾`，也不要将历史上提前完成的收尾记录改写为按时完成。
- **在 08:50–09:00 或 13:50–14:00 的收尾窗口内**：停止启动新开发，安全结束子 Agent 和任务，保存代码与测试现场，中文 Commit/Push，记录未完成事项、恢复位置和 PASS/FAIL/BLOCKED/NOT RUN；**在高峰开始之前**调用 DSH/Harness 的实际 Goal 状态控制，把本次 `/goal` 设置为 `complete` 并复核 `phase=complete`、`activation=disarmed`。`complete` 只代表当前执行周期安全收口，不代表 R102 任务、测试或发布全部 PASS。
- 官方调整峰谷后以新公布为准，并同步更新全局与本条。


## 8. Web Playwright 长期调试与验收规则（强制）

- Playwright + Chromium 是 Web 版的默认真实浏览器调试、自动化测试与发布验收工具；优先复用现有环境，缺失时安装兼容版本。
- 原生 Playwright 是默认方案：用 Playwright Test 启动并管理 Chromium，browser.newContext() 创建隔离环境，Locator API 操作与断言，Trace / Console / pageerror / 截图定位问题；不以 connectOverCDP() 或直接发送 CDP 指令作为常规调试方式。
- CDP 只用于原生 Playwright 无法满足的底层诊断（Chromium 性能事件、网络/渲染内部状态、临时附着既有浏览器），使用时说明原因；日常点击、输入、滚动、存档导入导出、阶段与挑战验收、自动购买器 GUI、常规截图与错误采集仍走 Playwright 高层 API。
- 涉及 Web 游戏逻辑、自动化、阶段推进、挑战、存档、教程或 GUI 的生产修改，必须执行与改动相关的 Playwright 真实浏览器测试；Node 静态断言、代码审查和浏览器启动成功不能代替行为验收。
- 默认使用与 Android Chrome 近似的手机视口、触控和移动端配置；不为无关变更扩展桌面专用回归。模拟 Chromium 不等于真机 Chrome，重大触控、布局及兼容缺陷按需在 AVD/真机 Android Chrome 补充验证。
- 排查 Bug 时按需收集浏览器 Console、pageerror、截图、Playwright Trace 及游戏关键状态；使用 `savestates/` 的真实存档副本复现，比较修复前后真实资源、阶段、结算、交互和存档持久化。
- 采用最小必要迭代：真实复现 → 定位根因 → 生产修复 → Playwright 定向复测；维护少量核心回归用例，不因微小修改执行全量回归或无限增加重复脚本。
- 浏览器测试失败时自行定位并尝试修复；无法复现或运行须明确记录 `FAIL` / `BLOCKED` / `NOT RUN`，不得伪报 `PASS`。
- oreki.net 部署前，本次变更影响的关键 Playwright 浏览器场景必须 `PASS`；静态测试不能代替发布门禁。Web 自身通过门禁即可独立部署，不等待 Android。
- 本规则跨 R102 及后续轮次持续生效，优先于旧的 Web 暂停指令；DeepSeek 高峰期限制仍适用于使用 DeepSeek 的开发 Agent。

## 9. 双端协作、CI/CD 与交付长期增量规则（2026-11-12）

- **强制读取 [Web 移动端开发与交付长期规则](docs/DELIVERY_RULES.md)**。本节补充现有 Web Playwright、DeepSeek 峰谷、原版结算和真实存档规则，不重新启用旧归档。
- Web 保持 ACTIVE，独立 Node + Playwright CI；必须以真实移动 Chromium/必要 Android Chrome 验收本次业务变更，浏览器冒烟或静态 PASS 不代替实际玩法 PASS。源码/生成教程数据必须同步，部署严格 fail-closed。
- ChatGPT 管理 GitHub Pages 和 oreki.net；两小时至少一份**合格稳定版**为节奏目标，不因 Android 构建 BLOCKED 而停工，也不绕过 Web 自身发布门禁。
- 当轮已完成成果中文 Commit/Push，普通已验收改动可推 main，高风险与 CI/CD/生产部署走 PR，禁止强推；只在真实完成部署并验证线上资源后报告 DEPLOY PASS。
- /goal、180 分钟真实通关、双端等价、阶段门禁、智能购买器、实时 GUI、教程附录 F、测试存档、最小必要原版对照和 Goal 收口的完整约束见上述增量规则。
