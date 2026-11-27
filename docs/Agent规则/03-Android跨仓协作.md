# Android跨仓协作细则

> 承接原根 AGENTS.md 对应章节的有效规则。代码路径默认相对于仓库根目录；共性规则以 Workspace 最新权威版本为准。返回[规则入口](../../AGENTS.md)。

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

