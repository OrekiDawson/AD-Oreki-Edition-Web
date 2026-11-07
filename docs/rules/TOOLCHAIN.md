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