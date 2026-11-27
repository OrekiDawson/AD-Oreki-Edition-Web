# Web玩法与协作

> 现行专项细则，根 AGENTS.md 按任务引用，不全量预载。跨仓统一要求以 Workspace 当前根规则及适用专项为准；本仓最新明确更新及用户授权覆盖旧状态。历史轮次、版本及过期描述不作为当前授权。相对链接按本文件位置调整；路径和章节编号仍以仓库根为基准。

## 2. Web 技术与玩法

### 2.1 Web 技术与游戏约束

- 上游基线冻结于 2026-07-17 的 `IvarK/AntimatterDimensionsSourceCode` Commit `5409e320`，未经授权不整体升级。Android/Web 玩家可见行为、功能与中文教程应等价，差异留证。
- 不伪造资源、进度、挑战结算、成就、存档或终局，不以切换页签刷新假状态。首次大坍缩后不能非法跳过 Infinity，永恒与现实按真实进度开放。
- **智能自动购买器完整托管（P0）**：MOD 调度器独占全部自动购买器及全局控制项的策略与有效调度，覆盖原版全局启停、批量状态切换、全局购买数量切换及单项启停、模式、数量、限制、阈值、间隔、优先级。MOD 托管开启时允许玩家操作，下一有效 tick 按最新合法阶段、资源、挑战、解锁、冷却、收益重算并恢复全局与逐项配置；不得粗暴全开、沿用过期快照或让批量数量覆盖各项最优模式。只有独立的 MOD 调度器总开关由玩家决定是否托管，关闭立即停止 MOD 自动执行与回写且不得擅自重开；原版全局开关不能关闭 MOD 托管。挑战限制、游戏强制禁用及安全暂停优先。tick 由玩家设置 1～60 秒，默认 10 秒，阶段或主循环不得擅改；保留原版合法冷却与升级条件，但不得存在竞争性独立执行入口、重复调度或虚假间隔。补齐所有阶段实际存在的自动购买及策略缺口，真实购买、扣费、结算，禁止越级、误重置、死锁、无效重试。GUI 全局按钮与各项实际配置/执行同步，保留有趣手动操作。双端逐一枚举所有购买器/控制入口，真实生产路径验收三个全局按钮、单项修改、MOD 总开关、1/10/60 秒、阶段重置、导入存档与挑战限制；策略完整、配置正确、真实执行、GUI 同步及双端等价独立取证，180 分钟通关不能替代。关联 [Android #164](https://github.com/OrekiDawson/AD-Oreki-Edition-Android/issues/164) / [Web #52](https://github.com/OrekiDawson/AD-Oreki-Edition-Web/issues/52)。
- **五阶段体验契约**：真实新档必须按以下顺序自然展开主要玩法；时间区间是长期体验目标而非按时钟触发的阶段开关。

  | 真实墙钟 | 玩家体验目标（同时作为 `PACING` 阶段—机制映射） |
  | --- | --- |
  | 0～30 分钟 | 快速成长，建立基础维度、升级和首次关键突破的理解 |
  | 30～75 分钟 | 逐步展开无限、Break、永恒、IP/EP、时间研究与挑战 |
  | 75～130 分钟 | 展开现实、主要天神、现实升级和自动化恢复 |
  | 130～165 分钟 | 完成后期挑战、Pelle 解锁与终局过程 |
  | 165～180 分钟 | 完成最终突破、原版真实结算与收尾 |

  上表同时是 `PACING` 的唯一阶段—机制内容判据；`docs/DELIVERY_RULES.md` 与 `docs/SHARED_GAMEPLAY_STANDARD.md` 引用同一映射。
  每阶段必须有实际游戏内容、合法资源增长和真实推进过程，不能被自动化瞬间跳过；阶段转换必须由真实机制自然决定，不得按墙钟强制锁定/解锁，也不得用固定等待、降低性能、擅改调度 tick 或伪造进度凑时间。阶段边界允许 **±5 分钟**审查容差：边界 ±5 分钟内不得仅凭秒数判失败，超出后仍须结合内容是否被压缩判断。首个 Reality 早于 **70 分钟**（75 分钟边界减 5 分钟）进入即触发 `PACING FAIL` 阻断审查；这是对真实运行结果的判定阈值，不是按时钟解锁条件。
- **独立验收维度**：候选版本分别记录 `GAMEPLAY LEGALITY`（资源、购买、挑战、结算、解锁、存档、成就合法）、`PACING`（五阶段自然展开且内容未被明显压缩）、`ENDGAME`（真实新档 ≤180 分钟到达原版终局）与 `POST-ENDGAME STABILITY`（终局后状态和存档正常）。以上四项与独立 `SAVE COMPATIBILITY` 共同作为五项门禁，分别使用 `PASS / FAIL / BLOCKED / NOT RUN`；ENDGAME PASS 不代表 PACING PASS，CI、构建、单测或审查完成也不能替代真实玩家体验。
- **节奏失败快速阻断**：真实新档一旦有可靠证据确认候选严重偏离五阶段目标，立即标记 `PACING FAIL`，最低 P1；同时存在非法解锁、伪造结算、存档损坏或核心玩法不可用时升级 P0。安全保存运行证据与检查点后，暂停该候选的无效长跑、合并和发布，优先定位直接根因；修复后先定向验证受影响节奏，恢复后才重启完整新档验收。允许调整有证据支持的倍率、经济曲线、动态速度和阶段自动化策略。
- **STD/IAP 商店移除与原版存档双向兼容（长期强制）**：Android/Web MOD 都不得提供独立 STD/IAP 商店的正常导航、购买/支付、6h/24h 商店时间跳或任何商店/广告额外游戏倍率；运行时商店乘法效果为 ×1、加法效果为 0，禁止从旧购买态重新激活。正常游戏内 Infinity/Break、Eternity、Time Study、Reality、Teresa Perk Shop 等合法升级/商店不在此范围。
- **原版存档互通门禁**：每个平台必须通过“同平台官方原版导出 → MOD 导入并合法游玩 → MOD 导出 → 同平台官方原版实际导入”及反向再导入回归。保留官方存档编码、结构、关键字段、槽位、已购历史记录和原版格式兼容；MOD 只在运行时禁用商店效果，不得清零、删除、伪造旧购买记录或以保存 `IAP.enabled=false` 作为关闭商店手段。新增 MOD 专属配置采用不污染原版导出的方式保留，不能让原版读取失败或丢失进度。Android 官方 3.21.0 与 Web 官方冻结基线的存档载体不同，跨 Android/Web 直接互读另须真实格式转换验证，不得推定已经支持。
- **`SAVE COMPATIBILITY` 独立阻断门禁**：原版→MOD 与 MOD→原版任一方向失败、存档重要信息损坏或历史购买记录被抹掉，均记 `SAVE COMPATIBILITY FAIL`，至少 P1，阻断稳定版合并及发布，先安全留存原始存档再修复；未知或未测记 `NOT RUN` / `BLOCKED`。涉及商店或存档的改动，测试必须覆盖官方新旧档、MOD 新旧档、曾购买商品的档、导入导出及重启保持，不能仅凭结构检查宣称 PASS。
- **终局硬指标**：新档合法墙钟 **≤180 分钟**完成原版真实终局，并确认终局后状态；运行证据绑定明确源码 Commit、部署 Commit、运行 ID 与新档起点，旧版本的里程碑不得算作当前版本。使用 JS/Node、Playwright/Chromium 手机视口及必要真实浏览器、空存储新档验证；静态检查不能替代实际 GUI/存档行为。
- GitHub Pages 部署副本与开发源码分离；`oreki.net` 只从已验证源码与受保护的 CI/CD 发布，不直接拼改部署副本。详细事实见 `docs/DELIVERY_RULES.md`、`docs/FACTS.md`、`docs/GIT_MAIN_CICD_SYNC.md`。

### 2.2 商店退役与存档互通

- Web 版永久移除可访问的 STD/IAP 商店、支付入口、购买动作、商店倍率、外观商品购买与 6/24 小时时间跳跃。只保留原版 IAP 存档字段和 `shopPurchases` 兼容键，历史购买数据不得恢复数值效果。
- 商店移除不得改变原版玩家存档结构。必须保留原版存档导入、本版导出、原版再次导入的双向互通验证；测试至少使用上游冻结基线生成的真实存档。
- 商店 UI、支付网络请求或商店增益重新进入生产代码视为回归；发布门禁必须包含手机 Chromium 无商店入口、全部倍率中性、旧购买状态不可复活及原版存档往返测试。

## 3. Android 跨仓协作

### 3.1 P1 全量 Smali/DEX 清零

- **权威目标（P1）**：Android 按业务需求增量恢复生产 Smali/DEX 为经 AGP 标准源码编译与运行验证的过渡 Java/Kotlin，最终清零生产 Smali 补丁、手工 DEX 注入、`build_mod.py` 依赖及 APK 二次打包。JADX/REA 只是恢复分析工具，反编译输出不等于编译/语义 PASS；新增、修复和实质修改的 Android 业务必须 Kotlin。仅直接阻断 P0 的最小闭包临时升 P0；不再要求 R126 单一窗口一次性恢复。CI/Kody/发布门禁不变。
- **本仓职责（Web 源仓）**：仅跟踪/修复实际受 Android 迁移影响的共享接口、跨端存档兼容、发布/下载链接、官方构建指令或文档引用；Android 源码/工具链的唯一 Owner 仍在 Android 仓。没有受影响的引用就记录“无需改业务”，不以 Android 工程迁移擅自调整 Web 游戏、Wiki 正文、Pages 部署、签名或本地环境。
- **验收**：要求 Android 权威 Issue 的 `PRODUCTION_SMALI_FILES=0`、`PRODUCTION_SMALI_DEPENDENCIES=0`、`MANUAL_DEX_INJECTION_PATHS=0`、`BUILDMOD_PRODUCTION_DEPENDENCIES=0`、`LEGACY_APK_REPACK_PATHS=0` 与 AGP 全游戏、Tick、存档、关键运行 PASS 真实证据；缺失时保持 OPEN/BLOCKED，不能在本仓宣称迁移成功。用户数据、安全、真实玩家 P0 优先。权威入口：[Android #52](https://github.com/OrekiDawson/AD-Oreki-Edition-Android/issues/52)、[#61](https://github.com/OrekiDawson/AD-Oreki-Edition-Android/issues/61)、[#25](https://github.com/OrekiDawson/AD-Oreki-Edition-Android/issues/25)、[Workspace #47](https://github.com/OrekiDawson/AD-Oreki-Edition-Workspace/issues/47)、[#20](https://github.com/OrekiDawson/AD-Oreki-Edition-Workspace/issues/20)。

### 3.2 P1 AGP 与目录治理

- Android [#61](https://github.com/OrekiDawson/AD-Oreki-Edition-Android/issues/61) 根目录标准化按 **P1 工程迁移（普通目录整理 P2）** 执行，与 [#52](https://github.com/OrekiDawson/AD-Oreki-Edition-Android/issues/52) 的 `build_mod.py` 退役执行「迁移即清理」：替代一个可达生产环节，同批删除失效入口与无消费者的专用工具；共享工具由最后使用者退出时删除。详见 Workspace 最新 `AGENTS.md` 和 [Issue #20](https://github.com/OrekiDawson/AD-Oreki-Edition-Workspace/issues/20)。
- Web 只负责确认自身与 Android 目录/构建变更相关的跨仓脚本、共享数据、链接和行为等价，不因 Android P0 擅自迁移 Web 目录或调整 Web 业务、部署/发布门禁。Android 代码 Owner 与 Web Owner 避让；真实玩家 P0/P1 和存档安全仍优先。规则合并后按既有授权立即安全同步本机并验证，不冒充已合并或同步成功。


> 此文件只存长期约束；具体轮次、Kody 启停、PR 状态与最新上线结果由最新授权、GitHub 和任务记录决定。

### 3.3 P1 64 位 ABI 与测试设备

- **Android 正式支持**仅 `arm64-v8a`、`x86_64`；停止 `armeabi-v7a`、`x86` 32 位兼容。实施归 Android [#285](https://github.com/OrekiDawson/AD-Oreki-Edition-Android/issues/285)，协同 #52 生产 Smali 全量清零/#61 根级 AGP；生产 `.so`、AGP ABI 过滤、包内 JNI、启动/Tick/存档、发布必须真实验证。原版历史 ABI/DEX/研究/存档不因移除 32 位 JNI 而抹除。未获得 ARM64 原生库/实机证据时如实保留 BLOCKED 或 NOT RUN，不得伪造完成。
- **日常设备策略**：优先使用 x86_64 Linux 电脑的唯一 API37 AVD 作为日常开发与大多数定向回归机；用户 Android ARM64 真机仅在可用、授权时偶尔做抽样安装、JNI、存档、冷启动与性能验证。**不要求每个普通 PR 跑手机**；本次 ABI 全面退役需单独提供 ARM64 真机证据或明确 NOT RUN。
- **本仓协作（Web 源仓）**：仅修复确有影响的共享发布元数据、下载/安装指南、ABI 支持说明、CI/交叉引用及跨端存档说明，不因此触碰 Android 构建脚本、改变 Web 业务、Wiki 独立写作或 Pages 部署门禁。继续当前已授权轮次，不重复 `/goal`。权威任务：[Android #285](https://github.com/OrekiDawson/AD-Oreki-Edition-Android/issues/285)、[Workspace #47](https://github.com/OrekiDawson/AD-Oreki-Edition-Workspace/issues/47)、[#20](https://github.com/OrekiDawson/AD-Oreki-Edition-Workspace/issues/20)。

### 3.4 P0 包名变更的 Web 协作

- Android MOD 的最终正式 `applicationId` 经用户确认改为 `net.oreki.antimatterdimensions`（自有域名 `oreki.net`），Debug 为 `net.oreki.antimatterdimensions.debug`；这属于 Android P0 身份迁移，权威实施任务 Android #52/#61/#25/#17、PR #276，调度见 Workspace #20。与原 Android `com.oreki.antimatterdimensions` 是**不同系统应用**；不能覆盖安装，也不会自动继承旧包私有数据，必须由 Android 侧验证旧存档导出→新包导入。
- **Web 只修实际受影响的共享引用**：下载页/帮助文档、安卓安装包名、跨端存档指南、深链/App Links、共享脚本/发布元数据如硬编码旧 applicationId，按实际变化修正。**不改 Web 的应用 URL、游戏存档结构、Web 部署路径或业务行为**；Android 的源 namespace/混淆 ABI 不得全局改名。必要测试最小化，保持 Android/Web 存档互通、PACING 和发布门禁。
- Android 规则 PR 合并后立即传递本机安全同步；Web 规则合并也同样要求本机读回核验，未验证不得冒充本机已更新。沿用现有 R126，不新 /goal。

