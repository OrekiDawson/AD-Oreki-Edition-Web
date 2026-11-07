# RELEASE 按需细则

范围：仅对应历史编号的具体操作、数值、命令和格式。入口摘要不是第二权威正文。涉及协作、授权、验证频率、版本身份及停止条件的旧交叉条款，统一由 CORE、AGENT_WORKFLOW、ANDROID、WEB、RELEASE、GIT 的归并契约取代；以下不恢复旧单 Agent、固定环境或任务专属限制。环境实测和事故叙述只作历史证据。

## 6.5. Android 构建批次化：批量开发、集中构建、集中验证（2026-10-29 用户确立，长期有效，**本节是构建节奏的唯一源**）

> 用户原话：「不要为了构建次数漂亮而拖延交付。完成一批就构建，一次验证尽可能覆盖多个真实功能。」

1. **开发阶段**先完成一批**关联**生产修改，再统一跑静态检查与 smali 结构检查；
   **禁止**每改一个文件或一个小问题就构建 APK。
2. 优先复用既有 REA 结果、构建脚本与原版 APK 对照结论；**不重复解包、不重复下载、不跑不相关检查**。
3. 一批改完后，统一跑项目既有构建流程 + `verifyRelease` + `verifyPatchContract`，
   产出**一个集成候选 APK**。
4. 装包后**集中验证**：购买 / 重置 / 挑战即时结算 / 阶段推进 / 中文教程等关键路径，
   一次装包覆盖多个真实功能。
5. 失败时先按日志与源码定位根因，把相关修复**合并成一批**再决定是否重建；
   只有需要验证 APK 实际行为时才做完整构建。
6. 最终发布必须使用**已验证的候选 APK**并核对 SHA-256；
   **不得以「减少构建次数」为由跳过运行验证**。
7. Web 与 Android 可并行开发；Android 的重型构建与 AVD 测试**错峰执行**，遵守开发机内存门禁
   （80% 不再加并发 / 85% 不接重型任务 / 90% 停止 / 95% 保护模式）。
8. 每轮报告必须写明：**本轮完整 APK 构建次数、每次构建原因、最终验证结果**。

### 6.5.1 Gradle 增量构建与构建缓存（2026-11-02 用户确立，长期有效）

> 用户原话：「不得把 Android 每轮构建默认理解为必须从头完整执行全部任务。」

**一、事实基线（R66 实测，勿凭印象复述）**

| 项 | 现状 |
|---|---|
| `assembleRelease` | 历史上 `outputs.upToDateWhen { false }` 无条件执行；R66 起改为「指纹判定 + `onlyIf`」 |
| `org.gradle.caching` | `false`（未启用构建缓存） |
| `org.gradle.parallel` / `vfs.watch` | `false` |
| 反编译基线树 `work/base_decoded` | **27744 个文件 / 0.40 GB**（不是早期记的 11 万 / 1.7 GB） |
| 整棵树 `(path,size,mtime)` 滚动哈希 | **约 4.2 秒**（相对 8.5 分钟完整构建可忽略） |
| `scripts/payload` | 35 个文件，内容哈希约 17 毫秒 |
| `scripts/*.py` | 69 个文件，内容哈希约 150 毫秒 |

**二、规则**

1. **先判断再构建**：每轮先看哪些任务的输入真的变了，不为「确保最新」而无条件全量重跑。
2. **优先用增量**：能声明 `inputs`/`outputs` 的任务就声明；不能的（本项目的 Python 流水线）用
   `scripts/build_fingerprint.py` 这类**显式指纹**兜底，不得直接退回 `upToDateWhen { false }`。
3. **分级指纹，不哈希巨量只读输入**：小而常变的走内容 sha256；大而只读的（反编译树、原始 APK、keystore）
   走 `(路径, 体积, mtime)` 滚动哈希。
4. **文本文件哈希前做 CRLF→LF 归一化**：换行风格不影响 APK 字节，却会让指纹误判。
5. **`assembleRelease` 允许跳过**（输入指纹一致 + 候选 APK 存在）；
   **`installToRelease` / `publishRelease` 一律强制真实构建**（`taskGraph.whenReady` 置 `forceFullBuild`），
   增量跳过只服务开发期。
6. **安全阀不可省**：候选 APK 不存在 / 指纹文件缺失或损坏 → 一律视为 stale；
   `-PorekiForceBuild=1` 可强制重建；构建失败**不得**更新指纹基线（`--commit` 只在 `doLast` 执行）。
7. **区分任务结果**：`UP-TO-DATE`（输入未变跳过）、`FROM-CACHE`（缓存恢复）、`SKIPPED`（条件跳过）、
   `NO-SOURCE`（无源）、正常执行 —— 报告里不得混为一谈。
8. **配置缓存与构建缓存先评估副作用再启用**：本项目任务几乎全是 `Exec` 调外部 Python 脚本，
   输入输出没有 Gradle 原生声明，盲目开 `org.gradle.caching` 只会产生错误的缓存命中。
   未验证的优化只能记为【待验证】，**不得写成已实现**。
9. **失败先修具体任务**，不得一遇增量问题就退回全量重建，除非能证明增量判断不安全。
10. **每轮记录构建效率**：实际执行任务数、`UP-TO-DATE` / `SKIPPED` 数、完整构建耗时、与上轮差异。

**三、命令**

```bash
python scripts/build_fingerprint.py --show        # 看当前指纹与各段耗时
python scripts/build_fingerprint.py --check       # 判定是否 stale（Gradle 每次自动调用）
./gradlew assembleRelease                          # 输入未变 → SKIPPED（秒级）
./gradlew assembleRelease -PorekiForceBuild=1      # 强制真实构建
./gradlew installToRelease                         # 强制真实构建（发布链路）
```

**四、优化必须以官方文档为依据**

参考（按优先级）：

1. Android Developers 中文 · 优化构建速度 — https://developer.android.google.cn/build/optimize-your-build?hl=zh-cn
2. Android Developers 中文 · Build Analyzer — https://developer.android.google.cn/build/build-analyzer?hl=zh-cn
3. Gradle · Performance — https://docs.gradle.org/current/userguide/performance.html
4. Gradle · Best practices for performance — https://docs.gradle.org/current/userguide/best_practices_performance.html

对应到本项目的落实点：

| 官方原则 | 本项目做法 |
|---|---|
| 先用 Build Analyzer / 性能分析定位真实耗时，不凭感觉改配置 | `./gradlew assembleRelease --profile` 产出 `build/reports/profile/`；耗时分布见 §6.5.1 一 |
| 正确声明输入输出与任务依赖 | 每条 `Exec` 显式 `dependsOn`；无法用 Gradle 原生 input 的用 `build_fingerprint.py` 兜底 |
| 消除不必要的始终运行任务 | 逐个复核 `outputs.upToDateWhen { false }`：`assembleRelease` 已改为 `onlyIf`；`verifyRelease`/`verifyPatchContract` 保留（秒级、且是交付闸门） |
| 逐步启用增量 / Build Cache / Configuration Cache | 增量已启用并验证；Build Cache 与 Configuration Cache **尚未启用**，理由与前置条件见 Android `docs/Gradle构建说明.md §9.7`，不得写成已完成 |
| 耗时逻辑放执行阶段，不放配置阶段 | `build.gradle` 配置阶段只做路径与变量计算；所有 Python 调用都在 `Exec`/`doLast` 里 |
| 大型输入树分阶段、文件级检测 | 分级指纹：payload/脚本走内容哈希，`work/base_decoded` 走 `(path,size,mtime)` 滚动哈希（4.2 s / 27744 文件） |
| 确定性无副作用任务才可缓存 | 当前只有 `assembleRelease` 具备确定性，但它有外部写（apktool 重建 `work/mod`），**故不启用缓存** |
| 签名 / 发布 / 云盘复制必须明确执行 | `installToRelease` / `publishRelease` 由 `taskGraph.whenReady` 强制全量，永不跳过 |
| 确认无共享写入才并行 | `work/mod` 是共享工作树，**禁止并发构建**；`org.gradle.parallel=false` 保持不变 |
| 开发与发布用不同任务组合 | 开发用 `assembleRelease`（可跳过）；发布用 `installToRelease` / `publishRelease`（强制全量） |
| 不盲目升级 Gradle/AGP/JDK | 仍用仓库内 `tools/jdk/jdk-17.0.20.1+1`，本项无收益不动 |

**五、验收口径（用户 2026-11-02 指定，缺一不可）**

- **A** 输入未变化，连续构建时可跳过的任务显示 `UP-TO-DATE` 或 `FROM-CACHE`；
- **B** 修改一个真实 smali 输入后，相关任务重新执行，下游任务也重新执行；
- **C** 修改教程或构建脚本后，对应生成与检查任务正确失效，不得继续用旧结果；
- **D** 正常执行与缓存恢复的有效产物一致（SHA-256 核对）；**未启用 Build Cache 时，
  以「指纹恢复后 digest 一致 + 产物 SHA-256 不变」作为等价证明，并注明未使用 FROM-CACHE**；
- **E** 最终 APK 仍通过原有完整性、安装与运行验证。

### 6.5.2 语义夹具优先于「构建 + logcat」（2026-11-03 用户确立，长期有效）

> 用户原话：「不要再只检查 Smali 中是否存在某条指令。必须建立真正的语义夹具。」

**背景（本轮实测代价）**：R65 与 R66 各烧掉 6~7 次整包构建（每次 8~10 分钟），
原因全是同一个模式 —— **极性写反 → 编译通过 → 装机后日志不对 → 猜一处改一处**。
R67 定位到 R66 的 `stage=-1` 是**六处叠加**错误（fill 守卫 / leaf 边界 / 取反 / 名字越界 /
未接线返回值 / 缺算子），任何单点修复都看不到效果。

**规则**

1. **涉及分支极性的改动，必须先有夹具，再改代码**。适用范围：
   `fill/leaf/evalStage/nameOf/goalOf/tryEternity/allow/noteActed/noteNoop` 这类
   「比较 + 条件跳转」密集的方法。
2. **夹具必须跑真实数据**，不得只断言「某条指令存在」。合格形态：
   - 从生成产物（smali 数据表）解析出真实结构，用与目标平台**逐指令等价**的模型求值；
   - 与权威源（策略 JSON）逐项对照，随机环境批量比对；
   - 覆盖边界：等于 / 差一个最小步长 / 越界 / 负数 / NaN / 取反。
3. **夹具必须进构建断言**（`build_mod.py` 4b），失败即中止，不等到 apktool。
4. **夹具失败时改代码，不改期望**。确需改期望，必须在 commit message 写明「为什么旧期望是错的」。
5. 现有夹具（改动这些文件后必须全绿）：
   | 夹具 | 覆盖 | 项数 |
   |---|---|---|
   | `scripts/fixture_scheduler_semantics.py` | 调度间隔 / no-op / 严格档 / 预约 | 24 |
   | `scripts/fixture_strategy_semantics.py` | 策略数据表 / 六算子 / fail-closed / 全阶段正反例 / drives | 70 |
   | `scripts/fixture_eternity_gate.py` | 首次永恒三闸门（从 smali 提取助记符 + 用户判定表） | 11 |
6. **仍未验证的事不能写成已完成**：夹具证明的是「语义正确」，不是「运行期达到目标」。
   `eternities` 是否真的增长、`isGameEnd` 是否真的为真，必须另有运行期证据。



## 6.6. Android 交付顺序：APK 优先于源码 push（2026-10-30 用户确立，长期有效，**本节是发布顺序的唯一源**）

> 用户原话：「安卓交付 apk 比 push 源码优先。」
> 与 §6.7.1（自动覆盖双云盘，不再询问）互补：§6.7.1 规定**发布要不要问**，本节规定**发布与 push 谁先谁后**。

3. **顺序固定**：Gradle 构建 → 签名与 `verifyRelease` / `verifyPatchContract` 校验 →
   `oreki_test` AVD 安装与实测 → 双云盘上传（**上传服务报告成功即记为已发布，不再下载回读**）→
   **然后**才做 Android 仓库的中文 commit 与 push。
2. **不得为了先 push 源码而推迟 APK 交付**。源码 push 可以延后，但必须：
   保留工作区修改、在交接文档记录未提交状态与原因，**不得回滚或清理**。
3. **不得把未通过实测的 APK 冒充正式版**。候选包验收前不得覆盖 `release/` 下的正式包；
   旧稳定包必须保留，保证可回滚。
4. **「上传请求已发出」不算交付**。只有「本地 `release/` 包 SHA-256 已记录 + 两处云盘副本写入后
   本地重算一致 + 上传服务报告成功」三项全过，才能说该端已交付。
   **不要求把云端文件下载回来复算哈希**（2026-10-31 用户明确取消该项，见 §6.7.1）。
5. Web 与 Pages **不受此约束**，可与 Android 并行提交、推送、部署；
   本节只约束 Android 的「产物 → 源码」先后关系。


## 6.7. 发布与实测环境（2026-10-29 用户确立，长期有效）

### 6.7.1 Android 发版：自动覆盖双云盘，不再询问

通过验证并构建成功后**自动发布**：`C:\Users\Oreki\OneDrive\反物质维度.apk` 与
`C:\Users\Oreki\小米云盘\反物质维度.apk` 两处同名覆盖 → 记录上传结果 → 报告。
流程与脚本见 Android `AGENTS.md §3-B` / `scripts/publish_apk.py`（本节只声明「不再询问是否上传」）。

**核验口径（2026-10-31 用户明确修改，长期有效）**：
- **两处云盘副本写入后，在本地重算这两个副本的 SHA-256，与 `release/` 正式包对比一致**；
- **上传服务报告成功即记录为上传成功**；
- **不要求把云端文件下载回来、也不要求复算云端 SHA-256**（原「三项全过」里的「回读哈希一致」一项作废）。
- 因此报告里能写的最高结论是「**本地已替换、上传服务报告成功**」，**不得**写成「云端内容已核验」。

同步失败 ≠ 构建失败。纯研究 / 实验回退 / 构建失败时**不重建、不覆盖**。
OneDrive 根目录的 `desktop.ini` 与 `.849C9593-…` 是同步必需文件，严禁移动。
**所有开发文档一律用中文写、统一放 `docs/`**。

### 6.7.2 测 Chrome 与测 App **共用唯一 AVD，必须严格串行**（2026-10-31 11:25 修订）

> **本节旧版标题是「测 Chrome 与测 App 必须用两个独立模拟器」，已废止。**
> 旧版要求同时开两台 AVD，与用户 11:25 补充令「全程最多一台、Android 与 Web Chrome 必须串行」直接冲突，
> 且实测两台 AVD 可占 6.4 核（FACTS C.75），是构建签名失败（INC-2026-1031-03）的诱因之一。
> **现行为：一台 AVD，串行，靠「测前清场 + 测后复位」解决旧版担心的互相干扰。**

- 唯一 AVD `oreki_test`（Android 14 / API 34 / **1440×3200 / density 560**，真机规格见 §29）。
- **Android 应用测试与 Web Chrome 测试必须串行**，不得同时进行；切换用途时必须先做清场：
  - 切到 Chrome 前：`adb shell am force-stop com.oreki.antimatterdimensions`
  - 切到 App 前：`adb shell am force-stop com.android.chrome`（Chrome 包名按实际安装的 x86_64 变体核对）
  - 长墙钟测量期间，**禁止对目标包执行** `force-stop` / `pm clear`。
- 旧版担心的风险（互抢前台、`pm clear` 误杀导致墙钟数据作废）**仍然成立**，
  但对策从「开第二台」改为「串行 + 清场 + 记录切换时刻」，墙钟区间跨切换的样本一律作废重测。
- adb 真实路径：`C:\Users\Oreki\Android\Sdk\platform-tools\adb.exe`（`%LOCALAPPDATA%\Android\Sdk` 在本机不存在）。
- 宿主静态服务器 `http://127.0.0.1:8099`；模拟器内访问宿主用 `http://10.0.2.2:8099`。
- 上机前确认**没有其他 Agent 在同一台 AVD 上操作**；启停权只属于主 Agent（§28）。


## §32 发布流程时间预算与超时处理（用户 2026-10-31 18:38 下达，长期有效，**本节是发布计时的唯一源**）

适用于全部 Web 部署、Android 构建、APK 交付任务。

### 一、预算（目标值，不是上限借口）

| 阶段 | 预算 |
|---|---|
| Web 部署 | **6 分钟** |
| Android 构建 + 验证 | **8 分钟** |
| 双网盘交付 | **3 分钟** |
| 汇总记录 | **1 分钟** |
| **合计** | **约 18 分钟** |

首次依赖下载等不可控因素单独说明，不计入常规预算。

### 二、开始前先定范围

1. 发布前先确定**本轮发布提交**与**实际要交付的内容**，写下来再动手。
2. **不得反复检查已经确认过的信息**（同一份哈希、同一个提交、同一次校验结果，一轮只取一次）。

### 三、每阶段必须记时

每个阶段都要记录 **开始时间 / 结束时间 / 耗时**，禁止只报总耗时。报告里给表格，不给叙述。

### 四、超预算时的处置

1. 单阶段超预算，**立即定位具体阻塞点**，只允许在这六类里归因：
   网络下载或连接等待 / Git 或远程服务等待 / 构建进程占用 / **Agent 之间任务冲突** / 重复执行 / 无必要的验证或轮询。
2. **超时后不得盲目重试，不得无限轮询，不得重复启动构建或部署进程。**
3. 一次修复尝试仍不通过 → 保留本地有效产物，报告阻塞原因，转入其他可交付工作。

### 五、并行与最小充分验证

1. 能安全并行的**只读**工作可以并行；**Chrome 测试与 Android 原生测试、正式 Gradle 构建仍串行**（§31 四）。
2. 发布验证采取**最小充分原则**：验证「部署提交正确 / 页面可访问 / 关键功能可用」即可，**不做与本次变更无关的全量回归**。
3. 网络或平台服务确实不可用时，保留本地有效产物，明确报告阻塞，**不得为赶时间跳过必要验证**。

### 六、每轮收尾

报告实际耗时与预算差异，并列出本轮发现的重复等待，**逐轮消除**。

> 目标：让发布成为快速、可预测的交付步骤，而不是每轮开发的主要耗时来源。


## 71　APK 网盘交付覆盖偏好（2026年11月5日）

用户希望正常 APK 交付到既定 OneDrive、小米云盘同名路径时无需反复询问；仅适用于已授权交付对象，不扩展到其它个人文件。执行仍须满足适用的文件安全确认要求，先备份旧包、核验备份成功，再覆盖并复算哈希。

2026年11月5日18:38用户进一步明确：交付以 APK 放入两个既定网盘文件夹为准，不要求云端回读，也不等待上传客户端状态。报告只写「文件夹已写入、本地哈希一致」，不得冒称云端内容或真机玩法已核验。此口径取代本文此前要求上传服务成功的交付门槛，备份与本地校验要求保留。


## 70　Android 产物只允许 APK（长期有效）

- 来源：用户 2026年11月5日 16:42 明确要求；优先级 P0，状态生效；适用本项目及后续 Android 构建交付。
- 只生成和交付 `.apk`，禁止生成 `.xapk`。已有历史分包素材仅作为构建输入保留，不改写为 XAPK，不删除历史素材。
- 构建、校验、安装和网盘发布均须以可安装 APK 为目标，不得更换扩展名冒充格式转换。
