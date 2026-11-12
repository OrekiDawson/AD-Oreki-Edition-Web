# Web 开发、移动浏览器验收及 Pages 发布长期增量规则

> 生效日期：2026-11-12。本文件由 [AGENTS.md](../AGENTS.md) 引用，与现行 Web Playwright、DeepSeek 峰谷和真实存档规定一同生效。已归档旧规则只供追溯。

## 1. 项目目标与工作流程

- Android/Web 同步推进，玩家可见 MOD 行为等价；新档真实墙钟不超过 180 分钟通关，减少无意义等待和重复切页，保留有趣手动操作。严禁伪造资源、存档、阶段、挑战完成和成就。
- 新轮开发 Prompt 原样以 `/goal 基于原版https://github.com/IvarK/AntimatterDimensionsSourceCode和/home/oreki/Antimatter+Dimensions_3.21.0_APKPure.xapk制作反物质维度MOD。` 开头。轮内追加/修改不再用 /goal，不重置计时或历史编号；编号由 ChatGPT 按台账决定。Agent 读取当前有效 AGENTS、FACTS、tasks、最新状态及相关源码，Prompt 每轮重申适用规则。
- P0 优先处理崩溃、不可达/错误可达阶段、存档损坏与核心功能失效；P1 处理通关瓶颈、自动化、实时 GUI 与跨端偏差；P2 才是非阻断迁移、体验/代码质量。避免只为凑工作量审计、重构或修改业务代码。
- Web 保持 ACTIVE 且独立开发、独立 CI 和发布；Android APK/AVD 阻断不应阻碍 Web 自身已合格版本上线。Web 上游保持当前独立冻结基线，不能因 Android 版本不同就伪称原版行为一致。

## 2. 玩法、界面与定位

- 挑战启动后只能通过原版真实结算链完成；智能购买器阶段感知、手动优先、支持 1–60 秒间隔及总开关，关闭立即停止，不强制恢复玩家已关闭的原版设置、不跨阶段解锁或伪造购买记录。
- UI 对资源、真实阶段、自动操作和玩家配置的改变及时响应；不得依赖切页才触发业务。Web 关闭新闻，主要面向 Android Chrome 默认手机视口，正常移动端可用即可，不强制桌面专项验收。
- 教程保留原版含义，全文简体中文、玩家视角；MOD 专属内容集中附录 F，与 Android 一致。教程 JSON 修改后必须按现有生成脚本同步对应生成模块；生产部署门禁必须严格验证同步，不能因 CI 的历史 advisory 绿灯视为教程同步 PASS。
- Agent 主动采集 Console、pageerror、Playwright Trace、截图、DOM/控件状态、真实存档来复现 Bug 和确定根因，不用遮挡 UI、吞错误或直接写假阶段/资源来骗过测试。

## 3. 真实验收

- 按修改范围运行最小必要 Node/Playwright 测试。涉及阶段、挑战、存档、自动购买器、教程或 GUI 的生产改动，必须在真实 Chromium 移动端上下文验证；重大兼容问题按需补充 AVD/真机 Android Chrome。
- 关键条件做正反极性与阈值边界；与官方原版相同阶段的操作和 GUI 做针对性对比，不要求每轮完整从头跑到结局。Playwright 启动冒烟 PASS 不能代替业务行为 PASS，Node 检查 PASS 不能代替真实浏览器行为 PASS。
- `savestates/` 保存有版本、用途、来源及预期的可复用测试存档，禁止提交隐私/凭据。保护玩家存档、历史状态与已验证结果。结果明确区分 PASS / FAIL / BLOCKED / NOT RUN。

## 4. GitHub、CI/CD 和交付

- GitHub 源码仓 `OrekiDawson/AD-Oreki-Edition-Web` 与 Pages 仓 `OrekiDawson/OrekiDawson.github.io` 职责独立；`web/_deploy/site/` 不能变成第二份功能源码。ChatGPT 管理 Pages 与 CI/CD，Agent 每轮根据实际改动核对 Actions 与部署证据。
- Web main 上的 Node/Playwright CI 与生产部署分离：正式部署必须具备实际移动端验收、教程源/生成物一致、受信任主干 SHA、受控发布 Token 和线上加载核验。CI 绿灯不能自动代表生产已上线，Deploy 失败不等于 Web 版本已发布。
- 成果无论成功或失败均以中文 Commit/Push 保存；普通已验证改动可推 main，高风险、CI/CD、生产部署或未过门禁的改动走分支/PR，CI 合格再合并。禁止强推/丢改动，Push ≠ 生产发布。
- 两小时至少交付一个**合格**稳定版为节奏目标，服从真实验收门禁和现行 DeepSeek 峰谷安全规则；未合格时如实标记超期及阻碍，不能伪报 PASS。Web 验收合格即可部署 oreki.net，无需等待 Android 四渠道。
- 可并行开发独立文件，真实浏览器会话及正式部署采用可追溯的独占控制。维护相关 FACTS/tasks/README/教程与 Android 差异记录，不无差别重写历史文档。授权轮次结束后停止，不擅自开启下一轮；Goal complete 只代表执行轮次收口。
