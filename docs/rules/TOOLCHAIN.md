# 工具链与环境
权威：本文件；范围：工具、环境与资源；来源：§33、§43、§54、§58、§63、§66.3、§77.12/15；状态：生效。

- 安装顺序固定：已有可用安装 → WinGet → 官方安装渠道 → Scoop 兜底。先查路径、版本与实际可执行文件，不重复安装；Android SDK 使用官方 SDK Manager 等专用机制。
- 安装/升级选当前兼容正式稳定版，核对架构/JDK/依赖及可信校验值；不把 Preview/Beta/RC/EA 当稳定版，不为升级破坏已可构建环境。版本作为环境事实，不硬编码进永久规则。
- Java 仅作 Kotlin/D8/Gradle 环境，不得当作业务回退。禁止擅改系统 PATH、JAVA_HOME、覆盖现有 JDK；工具失败用有证据的最小修复与等价方案，不无限重试。
- 内存 80/85/90/95% 按资源健康分级降载；先核实进程归属，保护 Harness 与无关进程；CPU/IO/进程数量同时关注。独占规则按 AGENT_WORKFLOW.md。
- 网络/代理与 SDK 下载遵循可信官方源及项目现有可用路径，不重配无关环境。真实时间来自系统时钟；读取失败标未知，不推测补造。
- 低频具体阈值动作及平台命令按 DETAIL_TOOLCHAIN.md 对应历史节读取。
- **RG02-10 构建输入指纹与重复构建拦截**：完整 Release 构建前必须比较「当前有效输入指纹 / 上次成功构建指纹 / 上次 APK SHA-256 / 产物是否完整可用」。指纹覆盖真正影响 APK 内容的输入：参与编译的 Kotlin 源码、smali 补丁与资源、构建脚本、Android 3.21 版本绑定与基线配置、D8/kotlinc/Gradle 必要参数与工具版本；**不覆盖** README、FACTS、AGENTS、tasks、rules、reports 等纯文档。输入未变且已有有效产物 → 直接复用 APK、拒绝重建并写明原因；产物丢失/损坏、工具链实际变化或已证实的非确定性输入 → 允许重建。发现「源码变更但指纹不变」须先修指纹覆盖缺陷，不得继续依赖该指纹放行。
- **RG02-11 Kotlin 快速验证与 Gradle 增量构建**：开发期默认最短有效验证链：修改 Kotlin → kotlinc 定向编译 → 必要 D8/DEX 校验 → ABI/方法签名检查 → 定向测试 → 集中修复；只有进入最终集成阶段才执行 `assembleRelease --offline`。`buildKotlinDex` 已登记真实 inputs（`scripts/payload/kotlin`、`baseline/version-config.json`、kotlinc 库、生成绑定）与 outputs（`build/kt/classes.dex`），输入未变时由 Gradle UP-TO-DATE 跳过，不再每次清空重编；**不得为提高缓存命中率跳过真实变化的编译输入**，不得缓存签名或最终产物状态。

## R95 Linux 优先、Windows 兼容（2026-11-08）

- 新开发优先在 Linux Bash 执行；Windows 11 保留兼容性。脚本必须说明 Linux 与 Windows 的路径、权限、换行和工具行为差异。
- Android 依赖优先使用 Linux 的 Android Studio、SDK、Platform-Tools、Build-Tools、Emulator、ADB、aapt2、D8、apksigner、zipalign，以及 JADX/Apktool；JVM 工具使用 JDK、Kotlin CLI、项目 Gradle Wrapper。系统 Gradle 与项目 Wrapper 必须分开记录和使用，Android 项目优先 `./gradlew assembleRelease --offline`，不因系统版本更新擅自升级项目插件。
- Web 工具链使用 Node.js、npm、pnpm、TypeScript，必要时才使用 Yarn；依赖版本以 `package.json` 和 lockfile 为准。Rust 工具链使用 rustup、rustc、Cargo、rustfmt、Clippy、rust-analyzer。
- Git、GitHub CLI、Python、ripgrep、RustDesk、VS Code、Codex CLI、DeepSeek Harness 属辅助工具；实际版本和路径写入 FACTS，不把本机路径硬编码进通用脚本。
- Linux 仓库和缓存优先位于 ext4。不得假设 Windows 分区固定挂载点；迁移前不得删除原始文件。涉及权限、符号链接、硬链接和大小写时，先检查实际状态。

## R97 快速迭代构建规则（2026-11-09，当前有效）

- 当前 Linux 开发环境的 Android APK 构建通常约 1 分钟，已足以支持高频反馈；不得再以“构建成本很高”为理由拖延必要的候选构建。该耗时只是当前环境实测事实，不是强制 SLA，也不代表 AVD 验收或完整通关测试同样只需 1 分钟。
- 发现关键生产缺陷时，优先采用：最小修复 → 候选构建 → 针对性测试 → AVD 验收 → 继续迭代。开发瓶颈优先看真实游戏进度和运行验收，不机械扩大无关回归范围。
- 候选 APK 可按需要多次构建，不受正式 Release 次数限制，无须逐次请求授权；可适当使用增量编译和缓存，但必须确认实际 Kotlin → D8 → DEX → APK 链路正确，不得把缓存命中、静态分析或独立 DEX 冒充 APK 构建证据。
- 本规则不改变 Kotlin-only、离线优先、针对性验证、RG02-10 输入指纹或正式 Release 门禁；正式稳定版仍须冻结输入、完成必要验证、签名并按两小时稳定版节奏和四渠道规则交付。
