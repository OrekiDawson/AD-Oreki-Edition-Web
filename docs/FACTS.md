# FACTS.md — AD-Oreki-Unified 重要事实台账

**用途**：把反复被遗忘、反复被重新推导、一旦搞错就会返工的**事实**集中记在这里。
规则（怎么协作、怎么验收）在 `AGENTS.md`；**事实**（世界是什么样的）在这里。

**证据等级**（每条事实后面必须标）：

- `[实测]` —— 本机真跑过，有命令与输出
- `[读码]` —— 源码/反编译逐行核对过
- `[推断]` —— 由已证实事实推导，尚未直接验证
- `[未知]` —— 没验证，不要当结论用

**写入纪律**：

1. 只写**会长期有用**的事实，不写临时状态、不写一次性的调试输出。
2. 每条都要能追到文件:行号或命令，**不许写「我记得」**。
3. 事实被推翻时**改这一条**，不要在旁边追加新说法（否则以后不知道信哪个）。
4. 出现新的硬骨头（踩了两次以上的坑、或花了 20 分钟以上才搞清的机制）→ 立刻登记。
5. 与 `AGENTS.md` 冲突时以 `AGENTS.md` 为准；与本文件冲突时以代码为准，并来改本文件。

---

## 0. 阅读向导（先看这里，2026-11-05 整理）

本文件已积累多轮事实，**不是每一节都仍然有效**。按下表判断可信度：

| 分区 | 内容 | 状态 |
| --- | --- | --- |
| A | 当前开发环境与常用命令 | **现行** |
| B | 仓库与产物 | **现行**（产物哈希以最新一次交付为准） |
| C（C.1~C.11） | 核心玩法机制 | **现行**，但遇到「某节被后文推翻」的标注时以标注为准 |
| C.12 起 | 各轮专项结论 | **按节内标注**：带「已推翻 / 仅保留观测数据」的只作历史证据 |
| D | Android 逆向事实 | **现行**（混淆名以 3.20 为准） |
| E | 已修复的根因 | **现行**，用于防止被静默改回 |
| F | 测试工具位置 | **现行** |
| G | 仍未知 / 待证 | **现行**，这些不要当结论用 |
| R81 / R82 / R83 | 各轮交付事实 | **现行**，但属于阶段性结论 |

**纪律提醒**：本文件与 `reports/` 的分工是 —— 本文件只写「结论 + 证据等级 + 出处」，
完整实验过程、原始日志、一次性调试输出属于 `reports/`，不要回填到这里。

已被推翻的结论**保留证据**并标注「历史结论，已被 X 推翻」，不直接删除；
但**不得**再被当作现行事实引用。

---

## A. 环境与命令（路径类，最容易反复踩）

| 事实 | 值 | 等级 |
|---|---|---|
| adb 位置 | `C:/Users/Oreki/Android/sdk/platform-tools/adb.exe`，**不在 PATH**，需先 `export PATH="/c/Users/Oreki/Android/sdk/platform-tools:$PATH"` | `[实测]` |
| 操作 `/data/...` | 必须 `export MSYS_NO_PATHCONV=1`，否则 Git Bash 会把 `/data` 改写成 `C:/Program Files/...` | `[实测]` |
| 正确 Python | `C:/Users/Oreki/scoop/apps/python/current/python.exe`（系统 `python` 不是它） | `[实测]` |
| 系统 `python` 缺 Pillow | `import PIL` 报 `ModuleNotFoundError`；量像素要走 `ffmpeg` 抽灰度或换 scoop python | `[实测]` |
| ffmpeg | `/c/ProgramData/chocolatey/bin/ffmpeg`（可直接用，缩图/抽 raw 都行） | `[实测]` |
| node | bash 里可用（`node -v` = v22.22.2）；`web/_tools` 已装 `puppeteer-core` | `[实测]` |
| GitHub 下载代理 | `http://127.0.0.1:7897` | `[实测]` |
| 模拟器 | 只操作 AVD：`oreki_test`（`emulator-5554`，装了游戏）、`oreki_web_test`（`emulator-5556`，装真 Chrome 用） | `[实测]` |
| AVD 名称读取 | `getprop ro.boot.qemu.avd_name`（`ro.kernel.qemu.avd_name` 是空的） | `[实测]` |
| 状态栏「No internet connection」 | 模拟器连不上 Google 连通性检查，**不代表真没网**；`ping oreki.net` 通就正常 | `[实测]` |


---

## R81 跨版本构建事实（2026年11月5日）

- `[实测]` 3.20 原版 SHA-256 为 `085fc1278682d11136658f10fc875a9e6970737874b7e78650a1578ef3dc6400`；主 DEX 方法引用数为 65536。新增调用需分 DEX，不能用 const-string/jumbo 处理方法索引溢出。
- `[实测]` 3.19 密度分包不可合入 3.20：`0x7f08022c` 已被新版 drawable/c83 使用。构建工具已切换同版 mdpi 分包并在写入前检查版本和资源 ID。
- `[读码/实测]` 主题 TypeError 来自调用前 `PKG_DIR` 为 str；主题加载器 3.20 为 fs.x，偏好容器 cz0，记数法 l63/yh4，新档 player.h，子页标题 xn4。主题子步骤和守卫已定向通过。
- `[读码/实测]` START 天赋旧 eg3.a:dg3 / rf3.k 对应新版 gi3.a:fi3 / th3.k；未映射会在 Application 初始化时触发 VerifyError。生命周期回调旧 pu.a 对应原版 3.20 fw.a。
- `[读码]` Web 永恒升级真实存在于 eternity.js（六项一次性升级），旧执行器将其误标为 unsupported。R81 已接入原版购买函数，Android Kotlin 通过 x81.i 注册表及原版 qr3.D 调用，不直接改资源或奖励。
- `[实测]` R81 最终候选版本 3.20.0/30200000、包名 com.oreki.antimatterdimensions、v3签名有效，四个DEX；classes4.dex与Kotlin编译结果逐字节相同（2637800字节）。最终APK为81519879字节，SHA-256 `27634e17a20dc77d1b88a3af55ec9098ba8d1eff1d5b0e5807fa92230ad7ef99`；已通过模拟器启动、持续循环、普通挑战重进返回及重启读档，18:37写入release与双网盘文件夹，三副本哈希一致。无限维度解锁后购买、IP倍率本轮实际扣费、首次永恒代购和完整终局未覆盖，不能据此宣称三小时通关。
- `[实测]` Web永恒商店修复源码f9747b6、Pages部署9107863均已推送，线上 https://oreki.net/ 对应模块返回200且与本地修复一致。Android Chrome 133默认视口已加载实际游戏，不是桌面模拟，也不代表最新版兼容性。

## R82 首次永恒前 ID1 成长链（2026年11月5日）

- `[读码]` ID1 解锁为**双条件**：`thisEternity.maxAM >= k()` 且（永恒未解锁时）`IP >= f`。`k()` 在 3.20 实测 1e1100，`f` = `BASE_COSTS[1]` = 1e8；`p()` = `(perk放行 || maxAM达标) && v()`。旧代码用 `Double.MAX_VALUE` 当 ID1 门槛是错的，那是 `Player.canCrunch` 的无限反物质目标。
- `[读码]` `OrekiStageAuto.computeHoldCrunch()` 曾写成 `else if (eternitiesZero()) return false`，语义与设计相反：首次永恒前完全不保护，坍缩反复清零反物质，`maxAM` 永远到不了 1e1100。R82 已改为 `else if (!eternitiesZero())`，并加构建期极性断言。
- `[读码]` 货币扣费三个方法必须区分（`bq0.smali`）：`i(BigDouble)Z` 1050-1074 只判余额不扣钱；`u(BigDouble)Lbq0;` 1206-1220 只 subtract+m 写回不判余额；`o(BigDouble)Z` 1122-1140 = `i`+`u`，等价 Web `Currency.purchase()`。R81 误把 `i()` 当购买入口，导致 IP 倍率涨级不扣费（伪造进度）；R82 已锁定 `o()` 并加构建期守卫。
- `[实测]` R81 真机日志中 `sacrifice` 连续每拍 `act`、`idBuy` 全程无 `act`：固定顺序 + 每拍单动作必然饥饿。R82 改为仅 ID1 窗口内优先 `idBuy`，不放宽任何闸门。
- `[读码]` Web `tryFirstId1AutoUnlock()` 原在 `gameLoop` 每帧直接 `buyMax()`，绕过统一节拍且只判 `DC.E8`。R82 移除该直购旁路，统一由 `OrekiEarlyAutomation.tick()` 在节拍内完成。
- `[实测]` `work/3.20` 参考目录在本轮中途由含 `app/src/main/java` 的 90MB 树变为空目录（0 条目）；本轮未写入该目录，语义核对改用 `work/base_decoded_320` 的 smali。
- `[实测]` R82 最终 APK：3.20.0/30200000、`com.oreki.antimatterdimensions`、81,519,879 字节、SHA-256 `e031a256c03ee8ec44d341b438704e44ecbc40ab558f8ac6007d565ab1656253`、v3 签名有效、4 个 DEX、`classes4.dex` 与 Kotlin 编译产物逐字节一致。已写入 release 与双网盘同名文件，三副本哈希一致。
- `[实测]` AVD（oreki_test）本轮日志统计 `act sacrifice` 32 次、`act idBuy` 8 次、`act breakShop` 7 次，ID1/ID2/ID3 均有真实购买记录，反物质达 1.50e1129；无 `FATAL EXCEPTION`。自动购买器页面不再出现 R73 遗留注入导致的 `NoSuchFieldError: ->b:Lvn;`。
- `[读码]` 4 处 3.19→3.20 类型漂移在本轮构建期被守卫抓出并修正：`bq0.g0` 的类型应为 `Lup0;`（非 `Lip0;`）；时间研究注册表 `l43`→`i63`（3.20 的 `l43` 已被 R8 复用为无关 lambda 类）；Kotlin 函数接口 `ui1`→`vl1`（两版身份互换）；R73 模式标题注入在 3.20 必须跳过（原版 `mainactivity/l0.D` 已自带）。
- `[实测]` Web 定向测试 17/17（`test-r82-id1-growth.mjs`，第 1 组直接加载生产 getter）、IP 倍率 7/7、调度节拍 10/10。https://oreki.net/src/core/oreki-early-automation.js 与本地逐字节一致。

## R83 IU15 冲刺与 Kotlin 迁移（2026年11月5日）

- `[读码]` 莱特拉解锁**只**取决于 `ImaginaryUpgrade(15).isBought`（`celestials/laitela/laitela.js:37-39`），与薇/太阳神无关。IU15 原版双条件：`player.requirementChecks.reality.maxID1.eq(0)` 且反物质指数达门槛（本作缩放为 `OREKI_IU15_AM_EXP = 1e8`）。
- `[读码]` `ImaginaryUpgradeState.hasPlayerLock` 直接读写 `player.reality.reqLock.imaginary`（`imaginary-upgrades.js:38-45`），**会进存档**。任何临时机制锁若不显式还原，异常退出后就是永久锁——R83 已把「关闭总开关立即释放」做成硬性路径。
- `[读码]` Web `OrekiIu15Sprint.canArm` 原本要求 `VUnlocks.vAchievementUnlock.isUnlocked`；该解锁需 10000 次现实 + 1e320 膨胀时间（`secret-formula/celestials/v.js:17-27` 实测记录），在本作 180 分钟目标内结构性不可达 ⇒ 等于永久禁用冲刺。R83 已移除该门。
- `[读码]` `oreki-eternity-automation.js` 两处读 `globalThis.OrekiIu15Sprint?.freezeResets`，但该模块从未定义此 getter，`undefined === true` 恒 false —— 冻结逻辑从未生效。R83 显式定义为 `false`（实测证明冻结会把反物质指数卡死，本就不该冻结）。
- `[读码]` 旧 Android `OrekiAuto.idBuyBlocked()` 只有 IM 前置闸与「IU15 已买/需求位已亮」判定，**不检测自动购买器总开关**，且失败计数为进程内静态字段（重开即归零，不构成真正的失败回退）。R83 整类迁到 Kotlin，判定收敛到 `OrekiIu15Sprint`。
- `[读码]` EC 启动唯一入口是 `challenge/eternity/b.D(Z, Continuation)`，内部写 `PlayerEternityChallenges.h(id)` 作为 current；其自身失败分支返回 `Boolean.FALSE`。R83 在该方法开头注入守卫，判定由 Kotlin `OrekiIu15Sprint.shouldBlockEcStart(ecId)` 提供。
- `[读码]` IU15 真实购买入口是 `qr3.D(Z, Continuation)Boolean`：`a(Z)` 判可买 → `y().o(cost)` 真实扣虚幻机器 → `E(true)` 置已买位 → `C(ZZ)` 通知；`qw.B()Z` 读已买位。`qw.E(Z)` 只是 BitSet 写位，绕过扣费即伪造进度。
- `[实测]` R83 Kotlin 编译产物含 `OrekiAuto`（6 方法）、`OrekiIu15Sprint`（12 方法）、`OrekiStageAuto`（14）、`OrekiAutomationScheduler`（21）、`OrekiTrace`（6），全部 javap ABI 校验通过；DEX 2.65 MB。

## R84 原版基线 3.21 与基线管理机制（2026年11月6日）

- `[实测]` 3.21.0 官方 APK：包名 `kajfosz.antimatterdimensions`、versionCode `30210000`、minSdk 32 / targetSdk 37、内层 APK 77,633,785 B、SHA-256 `4e9970a808d10b6cc1a1068b078ec3c7d922051086a576c66d071c1216f527ac`。来源为用户提供的 APKPure XAPK（XAPK 本身 SHA-256 `ad1b367ecf872bd71c12b714622424511599177f3a4b9c1a6bb4493bee0dc68a`）。
- `[实测]` 3.21 与 3.20 的**签名证书完全一致**（`24c5158c0de5d472f018107476ca6e5fd8c1442b404c3fe49a26c2024dd1fd14`），可判定为同一官方签名的连续版本。
- `[实测]` 3.20 → 3.21 游戏包类数 1242 → 1242：**新增 7 个（全部 UI/皮肤类，含 `OreoNewsWidgetView`），删除 0**。全量类文件 15354 → 15319，差额几乎全是 R8 顶层短名重排，判断升级内容时必须按 `kajfosz/` 包过滤。
- `[读码]` 3.21 把 LAUNCHER intent-filter 全部搬到 **28 个 `activity-alias`** 且默认 `enabled=false`（原版新增「主屏幕图标」选择功能）；3.20 及更早是 `MainActivity` 直接带 LAUNCHER。任何按「activity + LAUNCHER」找启动组件的代码在 3.21 上会命中 0。
- `[读码]` 3.21 的 IU15 锁对象类型由 `Lwz1;` 改为 `Lg02;`（同为 `.super .../imaginary_upgrades/a`、同样只覆写 `C(ZZ)V`）。
- `[读码]` 3.21 的四个自动机状态字符串资源 ID 整体 −7：`automator_paused` `0x7f11037a`→`0x7f110373`、`automator_running` `…382`→`…37b`、`automator_cannot_run` `…34d`→`…346`、`automator_stopped` `…387`→`…380`。资源 ID 由 aapt 分配、R8 不改，但**会随资源表增删整体位移**，所以同样不能跨版本硬编码。
- `[读码]` 3.21 的 EC12 限时判定闭包类由 `k81` 改为 `u81`（`cmpg-double v0, v6, v0` 锚点与寄存器不变）。
- `[读码]` 3.21 中 Currency 抽象基类 `bq0` 改名为 `iq0`；其子类 `aw`（3.20 的 Currency 基类）**在 3.21 中已不存在**，属上游内联/合并。
- `[实测]` 3.21 的 MOD 别名表只推导出 **5/23** 条可唯一确定（`bq0→iq0`、`fd0→ld0`、`fw→iw`、`iu→lu`、`k5→l5`）；其余 18 条（含 `gi3`/`fi3`/`th3`/`w50`/`aw`）在 3.21 存在多个结构同构候选，无法自动判定。**3.21 的 MOD 迁移未完成**，构建 fail-closed 停止，不产出 APK。
- `[读码]` 官方 Web 源码仓 `IvarK/AntimatterDimensionsSourceCode` 最新提交仍是 `5409e320`（2026-07-17），**无 3.21 对应提交或标签**。因此 3.21 的 Web 侧基线无法建立，`web.commit` 留空并由 `baseline verify` 明确报出。
- `[实测]` 基线管理工具（Rust，零第三方依赖）五命令 `update / verify / diff / status / rollback` 全部可用；3.20 与 3.21 的 inventory 各 15319~15354 类，可用于后续增量 diff 而无需重复反编译。
- `[实测]` `scripts/build_mod.py` 原有的 **25 处** `_baseline_version().startswith("3.20")` 分支已全部收敛为 `baseline/version-config.json` 的声明式配置（现存 0 处）。配置化改造后 3.20 构建仍 EXIT=0、产出 77.7 MiB APK，未破坏现有可构建状态。

## B. 仓库与产物

| 事实 | 值 | 等级 |
|---|---|---|
| 工作区根 | `C:\Users\Oreki\AD-Oreki-Unified`（**不是 git 仓库**） | `[实测]` |
| Web 源码 | `web\AD-Oreki-Edition`（分支 main，远端 `origin/main`） | `[实测]` |
| Web 部署 | `web\_deploy\site`（main → `https://oreki.net`，GitHub Pages） | `[实测]` |
| Android 源码 | `android\AD_Oreki_Edition_Android`（main，含构建与发布脚本） | `[实测]` |
| 规则文件三处硬链接 | 根 `AGENTS.md` ≡ `web/AD-Oreki-Edition/docs/AGENTS_GLOBAL.md` ≡ `android/AD_Oreki_Edition_Android/docs/AGENTS_GLOBAL.md`（同 inode；改根那一份，用 `scripts/check_agents_sync.py` 校验） | `[实测]` |
| Android 构建入口 | `C:/Users/Oreki/scoop/apps/python/current/python.exe scripts/build_mod.py`（输出 `build/unsigned.apk → build/aligned.apk → release/反物质维度.apk`） | `[读码]` |
| 构建前必做 | 先把当前 `release/反物质维度.apk` 复制到 `build/backup_<阶段>.apk`（`build_sign()` 会先 `unlink` 目标） | `[读码]` |
| **发版坑** | `publish_apk.py` 默认发 `release/`，**不会**自动提升 `build/gradle-stage/` 的候选包；不先 `cp` 就会发出旧包 | `[实测]` |
| 交付顺序 | **Android APK 优先于源码 push**：构建 → AVD 实测 → 双云盘回读 SHA-256 → 才 commit/push | `[实测]` |
| APK 基线 | `com.oreki.antimatterdimensions`；当前稳定版 3.20.0 / 30200000（`release/反物质维度.apk`，SHA-256 `82156A4055D36522BF247CCF37606E07CEF9D37C79BB46BE1DA727FF3D590051`），R91 3.21 候选 3.21.0 / 30210000；证书 SHA-256 `95960bce…3197` | `[实测]` |

---

## C. 原版玩法机制（改数值前必须知道）

### C.1 `pLog10(0) = 0` —— 让「调分母」彻底失效的恒等式

`Effarig.nerfFactor(power) = 3 * (1 - c / (c + sqrt(power.pLog10())))`。
`power = 0` 时 `sqrt(0) = 0` → `c/c = 1` → **`nerfFactor ≡ 0`，与 `c` 完全无关**。
所以「把 nerf 的分母调大/调小」在 power=0 时没有任何效果。
修法：`sqrt(Math.max(1, power.pLog10()))`（`web/AD-Oreki-Edition/src/core/celestials/effarig.js`）。 `[读码+实测]`

### C.2 页面冻结不是游戏 bug

浏览器把页面判为 `hidden` 后，渲染进程**停止调度 `setTimeout`/`setInterval`/`rAF`**，而
`GameIntervals.gameLoop.isStarted` 仍然是 `true` —— 看起来像「游戏卡死」，其实是浏览器
Page Lifecycle。`--disable-background-timer-throttling` 只防**降频**，**不防**整页冻结。
Web 端「约 420 秒整局冻结」已按此结论排除为环境问题（720 秒复测：`visibilityState` 全程
visible、tick 18132 无停滞、存档每 30 秒 23 次全在）。 `[实测]`

### C.3 V（薇）解锁的六项条件与缩放后的取值

`VUnlocks.vAchievementUnlock.requirement()` = 六项 `mainUnlock` 的
`.every(e => e.progress() >= 1)`（`src/core/secret-formula/celestials/v.js:230-235`）。
Oreki Edition 缩放后（`v.js:43-45`）：

| 项 | 缩放值 | 常量 |
|---|---|---|
| realities | 200 | `OREKI_V_UNLOCK_REALITIES` |
| dilatedTime | `1e30` | `OREKI_V_UNLOCK_DILATED_TIME` |
| replicanti | `1e20000` | `OREKI_V_UNLOCK_REPLICANTI` |
| eternities / infinities / realityMachines | 保持原版（`1e70` / `1e160` / `1e60`） | — |

**`emphasizeEnd(f) = Math.pow(f, 10)`**（`secret-formula/celestials/navigation.js`）。
所以除 `realities` 外，其余五项的 `progress()` **不是线性比值，而是比值的 10 次方**；
读数时看到 `10.690` 别以为「进度 1069%」，它对应 `(log10(1e88.7)/70)^10 = 10.69`。
`[读码+实测]`

**纪律**：改阈值时 `requirement` 显示值与 `progress` 分母**必须同步**，否则 `progress` 永远到不了 1。 `[读码]`

### C.4 V 卡死的真实链路（R35 定位，**R36 已修正**）

> ⚠️ **R36 更正**：R35 把「EC9 的无限之力门槛 1e17498」判成唯一资源墙。
> **R36 实测证明那是错的**：真实运行里无限之力早已到 `1.29e12931925`，
> 比门槛高 **1.29e7 个数量级**。真正的卡点是**前置普通时间研究没被买**，
> 见 **C.8**。R35 的「缩小 EC9 门槛」方向是无效改动，**不要再沿用**。

```
EC11 5/5 + EC12 5/5   ← dilation-time-studies.js:1-16 的 ecRequirement
   + [231,232,233,234] 里有一个已买
   + Currency.timeTheorems.max >= totalTimeTheoremRequirement
        ↓
DS1「解锁时间膨胀」cost 5000 TT  = TimeStudy.dilation.isBought
        ↓
PlayerProgress.dilationUnlocked()  ← player-progress.js:51，就是 DS1
        ↓
startDilatedEternity 才可能
        ↓
player.records.thisReality.maxDT > 0  →  V 的 dilatedTime 项才可能 >= 1
```

`gates{notUnlocked: 35497, passed: 0}` 是这条链的**结果**，不是原因；`tickDilation` 的门没问错。

阻断点在于**现实自动化按 ~28.6 秒循环，每次现实清空 EC 完成记录**（`reality.js:651`），而
EC9 目标 `e1750` IP、EC10 `e3000`、EC11 `e450`、EC12 `e110000` 且 EC12 有 10 秒限时
（`restriction = max(10 - 2*completions, 1)/10`），28.6 秒窗口内打不到 →
EC9~EC12 从来没被完成过（实测 `ecDone = "5,5,5,5,5,5,5,5,0,0,0,0"`）。
另注：`maxDT` **每个现实清零**（`reality.js:696`），所以达标必须在同一个现实内完成。 `[读码+实测]`

### C.5 36 空间定理只可能来自 RU0~RU5

`v.js:83` 是 `if (!V.isFlipped && isHard) continue;` ⇒ RU6/7/8 在 Ra 解锁（`unlockHardV`）前
**永远不可能完成** ⇒ 36 定理只能由 RU0~RU5 各 6 层给出（6×6 = 36，正好够）。 `[读码]`

### C.6 后期数值天花板（不要再「多跑一会儿」）

| 事实 | 值 | 等级 |
|---|---|---|
| EP 峰值 `maxEpL` | `1.43e7`；1300 秒长测末态只有 `4.7e6~5.8e6`，**再跑更久不会涨** | `[实测]` |
| IM 上限链 | `log10RM = 3*(log10EP/4000 - 1)`；`baseIMCap = (log10RM-1000)² * (...)^0.2` ⇒ EP `1.43e7` → cap `9.45e7` | `[读码+实测]` |
| glyph 等级 | `dtBase = max(1, maxDT.pLog10())^1.3 * 0.025`；`maxDT=1e175` → 峰值 **2061**（不是 13） | `[实测]` |
| glyph 等级取字段 | **不是** `Glyphs.bestLevel`（296 样本全 null），要用 `gainedGlyphLevel().actualLevel` | `[实测]` |
| TP 播种 | `rewardTP()` 只在「膨胀中做一次真实永恒」时触发（`eternity.js:99`）；`DT 速率 = TP × 乘子`。曾误判为「TP 死锁」，实测 `tpL=88.06`、`maxDTL=175.36`，**结论已撤回** | `[实测]` |

### C.7 挑战「进入即完成」必须真实结算

补发奖励的正确模式（Web `src/core/oreki-instant-challenges.js`、Android `OrekiInstantChallenge.smali`）：
临时抬高 `records.maxAM` 到 `goal` → 调**原版**收益函数 → **立刻还原**。还原本身就是幂等的一部分。 `[读码+实测]`

### C.8 EC9~EC12 买不上的真正原因：**前置普通时间研究没被买**（R36 定位，★推翻 R35 结论★）

> ⚠️ **R36 收尾更正（必读）**：本节「根因」结论**已被同轮 A 组的后续实测部分推翻**，
> 见下方「C.8.1 根因更正」。**「资源不是墙」这一条结论仍然成立**（无限之力高出 1.29e7 个数量级）。
> 本节的**修法本身有效且已被两次独立采样验证**（EC1~12 全部 5/5），
> 但它**不是**「修复前 EC9 买不上」的根因 —— 详见 C.8.1。

**实测证据**（`web/_tools/_r36a/_r36a-ec9.jsonl`，真实新档 330 秒连续采样）：

| 字段 | 实测值 | 含义 |
|---|---|---|
| `infPowerL` | **12931925.9** | 无限之力 = `1.29e12931925` |
| `ecReqTot9L` | **17498** | EC9 门槛 = `1e17498` |
| `ec9StudyBought` | **false** | EC9 的前置普通时间研究**没买** |
| `ecUnlocked` | **8** | 只解锁到 EC8，EC9 起全部买不上 |
| `ecDone` | `[5,5,5,5,5,5,5,5,0,0,0,0]` | EC1~EC8 各 5/5，EC9~EC12 恒 0 |

⇒ 无限之力比门槛高 **1.29e7 个数量级**，**资源根本不是墙**。 `[实测]`

#### C.8.1 根因更正（A 组后续实测，2026-10-30）

**修复前** `ec9StudyBought=false` / `ecUnlocked=8` / EC9~12 恒 0 的**真正原因是
「普通时间研究自动购买器」没把 EC9 的前置研究 151 买上**，
而不是「EC 购买逻辑不补前置」本身。
`buyTimeStudies()` 会遍历整个 normal 研究库逐个 `purchaseUntil()`，
正常情况下 151 会被自动买上；**它没被买上，是因为在那个采样窗口里
普通研究购买循环没能跑到 151**（资源/时序问题）。 `[读码+实测]`

**因此本轮修复的准确定位是**：
- 修法**有效**（`web/AD-Oreki-Edition/src/core/oreki-eternity-automation.js`）：
  EC 购买循环在 `!study.canBeBought` 时按 `study.config.requirement` **主动补齐前置研究**，
  这让 EC 推进**不再依赖普通研究自动购买器的遍历顺序与时序**。
- 效果实测：EC1~12 全部打满 5/5，**首次 t=73.21s（330s 采样）与 t=79.50s（420s 复跑）两次独立复现**；
  `dilationUnlocked`=true（t=73.21s）、`maxDTL` 峰值 **11.6**、`realities≥10`（t=225.69s）。 `[实测]`
- 但**不能说**「是本修复让 EC9 从买不上变成买得上」—— 修复前 A 组的另一份采样里
  EC9 也在 t=22.38s 就完成了 5/5（那次普通研究自动购买器恰好买上了 151）。 `[实测]`

**给下一轮的硬结论**：EC9~EC12 的购买**不是当前阻塞点**，R35 的「1e17498 资源墙」与
本节的「前置研究没被买」都已被实测排除。**真正的阻塞在别处**，见 **C.10**。 `[实测]`

**根因（逐行读码）**：`src/core/time-studies/ec-time-study.js:76-87`

```js
get canBeBought() {
  if (!this.isAffordable) return false;                              // ① 资源
  if (player.challenge.eternity.unlocked !== 0) return false;       // ② 同一时刻只开一关
  if (!this.config.requirement.some(s => TimeStudy(s).isBought)) return false;  // ③ 前置普通研究 ← 真凶
  return this.allSecondaryRequirementsMet;                           // ④ 二级资源
}
```

- EC9 的 `requirement` = **[151]**（`secret-formula/eternity/time-studies/normal-time-studies.js:430`
  「所有时间维度提升 1e4 倍」，cost 8 TT）；EC10/11/12 = **[181]**。
  （`ec-time-studies.js:100-111` / `:113-122`）
- `src/core/oreki-eternity-automation.js` 的 `buyEcStudiesAndStart()` 原来**只调 `study.purchase()`**，
  **从不补前置研究** ⇒ 第③条恒为 false ⇒ `canBeBought` 恒 false
  ⇒ EC9~EC12 永远买不上 ⇒ `unlocked` 停在 8
  ⇒ EC11/EC12 永远开不了 ⇒ DS1 买不到 ⇒ V 不解锁 ⇒ **全局永远无法通关**。 `[读码]`
- 讽刺的是**同方法的注释已经写对了方法论**（「官方购买入口不是 `purchase()` 而是 `purchaseUntil()`」），
  **但实现没照做** —— 注释与实现不一致，这就是 bug 由来。 `[读码]`

**R36 的修复**（`src/core/oreki-eternity-automation.js`，属主=主 Agent）：
1. 循环开头 `if (player.challenge.eternity.unlocked !== 0) break;`（已开一关就别再烧 TT 补别的关的前置）；
2. `study.canBeBought` 为 false 时，按 `study.config.requirement` 补齐前置普通研究链
   （普通研究自带 `purchaseUntil()` → `buyStudiesUntil()`，连同整条前置一起买），再 `study.purchase()`。
- **没有**动 EC 资源门槛、**没有**写任何解锁标志位。 `[读码]`

**EC 门槛公式本身**（`ec-time-studies.js:108`）：
`required: completions => DC.E2000.pow(Math.min(completions, 4)).times(DC.E17500)`
⇒ completions 0→`1e17500`、1→`1e19500`、2→`1e21500`、3→`1e23500`、4→`1e25500`；
AD15 的 `/100` 只把第 0 档变成 `1e17498`，**对第 1~4 档几乎无效**（`1e19500/100 = 1e19498`）。 `[读码+算术]`

**双端差异（重要）**：Web 端 `oreki-eternity-automation.js` 有 `challenge.start(true)`（真 `challenge.start()`），
所以 **Web 端会真的自动启动 EC**；而 R35 在 Android 实测「自动开打 100% 失效」
（`OrekiChallengeAuto.smali:198` 传 `null` continuation）。
⇒ **两端在这一环不等价**，Android 侧必须由 Agent B 对齐。 `[实测]`

**已知次要缺陷**：`_ecTarget`（`oreki-eternity-automation.js:295`）只在 `:295`（定义，初值 1）
与 `:368`（`shouldHoldReset`）出现，**从不推进**，恒为 1
⇒ `shouldHoldReset()` 的大坍缩保护实际上只对 EC1 生效。 `[读码]`

### C.9 真终局链与 IU 链（R36-C 读码 + 实测，**最重要的路线图**）

```
EC1~EC12 全通  →  Reality  →  天神 V（6 项 progress() ≥ 1）
                              ↓ 其中 dilatedTime 恒 0 = 当前唯一未达标项
                       IU15（莱特拉唯一入口）
                          门A：IM 存量 ≥ 1e9 且 currentIMCap ≥ 1e9
                          门B：maxID1 == 0（永不买第一无限维度）
                            且 player.antimatter.exponent ≥ 1.5e12
                          ↓
                       莱特拉（Laitela.isRunning）
                          ↓
                       IU25「彻底抹除」cost 1.6e15
                          硬性要求 Laitela.isRunning && Laitela.maxAllowedDimension === 0
                          && Glyphs.activeWithoutCompanion.length <= 1
                          && TimeStudy.reality.isBought
                          ↓
                       ★ 佩勒（Pelle）= 真终局 GameEnd
```

| 事实 | 值 | 等级 |
|---|---|---|
| `OREKI_IM_CAP_MULT = 10.6` **是必要的且 load-bearing** | 原版 IM 上限 **9.4517e7** < IU15 的 1e9 ⇒ 莱特拉直接买不到；×10.6 后 **1.0019e9 ≥ 1e9**，**余量仅 0.19%（极紧）** | `[读码]`+`[实测]` |
| IU15 是**莱特拉唯一入口** | `src/core/secret-formula/celestials/laitela.js:11-13` | `[读码]` |
| IU15 门 B 的机制 | `maxID1` 记录**第一无限维度的购买量**（`src/core/dimensions/infinity-dimension.js:385`）⇒ 从不买 ID1 则恒为 0；但不买 ID1 ⇒ 无限点数产出为 0（`infinity-dimension.js:127-140`）⇒ 唯一绕法是**现实机器项**（`antimatter-dimension.js:48` + `AlchemyResource.force`，`secret-formula/celestials/alchemy.js:310-318`，需炼金 tier 4 / Effarig L17） | `[读码]` |
| 门 B 的达成方式 | `antimatter-dimension.js:600-607` 把 AD1 产出抬成 `10^(log10(P1)^k)`，被 `Decimal.MAX_VALUE`（指数 9e15）封顶 ⇒ 「打到反物质上限」即可。存档 `1123._Endgame.txt` 实测 `antimatter.exponent = 9.00000e+15` | `[读码]`+`[实测]` |
| **Ra 记忆不是真终局阻塞** | 默认 10000× 下**上游原版曲线（尾乘 1e6）5 秒就到 Ra L20**，R35 的 ÷400 属过度缩放，保持原样即可；且 IU25 不依赖 Ra 宠物等级（IU23/IU24 才依赖 `Ra.isRunning`） | `[实测]` |
| **V 六项没有第二道墙** | 真实新档 1319 秒内 6 项中 5 项已达标，`realities` 实测到 **240** 次（门槛 200）✔；唯一不达标是 `dilatedTime = 0.000` | `[实测]` |
| IU25 还差 6 个数量级 | IM 上限 1.0019e9 vs IU25 cost 1.6e15；抬升来源是 `baseIMCap` 第二项（需 `log10(uncappedRM) > 1e5`，当前 10722）或 IU6（×1e100 硬上限）或 IU13 的倍率 | `[读码]`+`[实测]` |

### C.10 ★ IU15 永久锁死死锁链（R36 主 Agent 读码定位，★此前所有轮次均未记录★）

**这是莱特拉（从而佩勒）在当前自动化下不可达的根因。**

| 环节 | 位置 | 事实 |
|---|---|---|
| 1 | `src/core/oreki-early-automation.js:68-80` | `buyInfinityDimensions()` 调 `InfinityDimensions.buyMax()` |
| 2 | `src/core/dimensions/infinity-dimension.js:398-410` | `buyMax()` 里 `unlockedDimensions.forEach(d => d.buyMax(false))` ⇒ **买 ID1** |
| 3 | `src/game.js:865` | `OrekiEarlyAutomation.tick()` **每帧调用** |
| 4 | `src/core/dimensions/infinity-dimension.js:385` | `player.requirementChecks.reality.maxID1 = maxID1.clampMin(InfinityDimension(1).amount)` ⇒ 买过 ID1 即 **maxID1 > 0** |
| 5 | `src/core/secret-formula/reality/imaginary-upgrades.js:161-162` | IU15「理想之构」`hasFailed: () => maxID1.gt(0)`；`checkRequirement: () => maxID1.eq(0) && player.antimatter.exponent >= 1.5e12` |
| 6 | `src/core/imaginary-upgrades.js:72` | `get isPossible() { return this.config.hasFailed ? !this.config.hasFailed() : true; }` |
| 7 | `src/core/secret-formula/celestials/navigation.js:1430` | `if (player.requirementChecks.reality.maxID1.neq(0)) return 0.5;` ⇒ **莱特拉进度被砍到 50%** |

⇒ IU15 是莱特拉**唯一入口**（`laitela.js:11-13`），故 IU25「彻底抹除」与**佩勒不可达**。 `[读码]`

**关键：这是可以按现实分阶段解决的，不是不可逆。**
`maxID1` **每个现实会重置**：`src/core/player.js:1005-1020` 的
`Player.resetRequirements("reality")` 把整个 `requirementChecks.reality` 换成新对象、`maxID1: DC.D0`。 `[读码]`

**R36 已实施但未实测的修法**（commit `f223f63`）：
`oreki-early-automation.js` 新增 `isIu15SprintActive()` ——
在 IU15 具备解锁条件（`MachineHandler.isIMUnlocked` 且 `!ImaginaryUpgrade(15).isAvailableForPurchase`）
且**本现实尚未买过 ID1**（`maxID1.eq(0)`）且反物质指数已接近门槛时，
**暂停购买无限维度**，改走**现实机器（RM）路线**
（`antimatter-dimension.js:48` 的 `Currency.realityMachines.value.powEffectOf(AlchemyResource.force)` 是原版
为「不买 ID1 也能堆反物质」准备的路径；RM 上限 `MachineHandler.baseRMCap = DC.E1000`，
而 V 的 realityMachines 门槛只要 1e60 ⇒ 量级绰绰有余）。
**不写 `maxID1`、不伪造反物质、不改任何存档字段。** `[读码]`

**符号可达性已核对**：`MachineHandler` / `ImaginaryUpgrade` 经
`src/merge-globals.js` → `src/core/globals.js:98/102` 挂到 `window`，
故在**无 import** 的 `oreki-early-automation.js` 中可直接引用。 `[读码]`

⚠️ **本项尚未经真实新档实测**，下一轮第一件事必须验收它。 `[未知]`

### C.11 R36 新发现的双端差异（Agent B 只读调研）

| 事实 | 详情 | 等级 |
|---|---|---|
| **Android 原版有 ID 自动购买器，Web 原版没有** | Android：`autobuyer/InfinityDimensionsAutobuyerState.smali` 调 `dimension/infinity/a;->c()Z`（= Web 的 `InfinityDimensions.buyMax()`）。Web 原版源码注释明写 `// Called from "Max All" UI buttons and nowhere else` ⇒ **Web 是 Oreki 自己补的 AD6 模块在每帧买 ID** | `[读码]` |
| ⇒ C.10 的 IU15 死锁**双端都有** | 两端都会买 ID1 ⇒ 两端 IU15 都被锁死。Web 侧已修（`f223f63`），**Android 侧本轮未修** | `[读码]` |
| Android EC 自动开打是 **NPE 被吞**，不是「缺 continuation」 | `ContinuationImpl.<init>(null)` ⇒ `_context = null` ⇒ 后续 `getContext()` **抛 NPE** ⇒ 被 `tick()` 的 catch 吞掉 ⇒ **每帧静默失败**。这比「传 null 导致不执行」更精确 | `[读码]` |
| 原版 `Parser$StartEcCommand` 传 `z=true` | `:360` 处 `const/4 v?, 0x1` ⇒ 走的是**静默 automator 模式**，不是弹确认框 | `[读码]` |
| REA doctor 的 `healthy:false` **不等于不可用** | `healthy:false` 的原因是缺 Hopper/Ghidra/IDA **原生**反编译引擎；`workbuddy` 客户端注册是 `aligned`；`search-android-classes` 实测可用（JADX headless 成功加载 **20032 个类**） | `[实测]` |
| Web 侧「膨胀从未启动」是错的 | 实测 `dilationUnlocked`=true、`player.dilation.studies.length`=6、`maxDTL` 峰值 **11.6**。R35 的「dilatedTime 恒 0」**被推翻** | `[实测]` |
| `_ecTarget` 是**死变量** | 恒为 1 ⇒ `shouldHoldReset()` 只对 EC1 生效，不覆盖 EC2~EC12 | `[读码]` |
| `emphasizeEnd` = 比值的 **10 次方** | `navigation.js:4-6` `Math.pow(fraction, 10)` ⇒ V 六项里除 `realities` 外**五项 progress 都不是线性比值**。实测基线：`dilatedTime` 1e11.6 ⇒ progress = **7.47e-05**（不是 0.387） | `[读码]+[实测]` |
| 每现实会清空膨胀研究与 DT | `reality.js:673-676` 清 `player.dilation.studies` + `active=false`；`reality.js:696` 清零 `maxDT` | `[读码]` |



## D. Android 逆向事实（REA / smali）

| 事实 | 值 | 等级 |
|---|---|---|
| R8 混淆映射 | `Effarig` → `celestials/effarig/a`；`V` → `celestials/v/a`；`Currency` 基类 → `ln0`/`ju`；字段 `ln0.w`=IP、`ln0.e`=infinities、`ln0.F`=EP | `[读码]` |
| Dalvik 跳转极性 | `if-eqz` = 值为 0 则跳；`if-nez` = 非 0 则跳；`if-gt A,B` = A>B 则跳。**R33/R34 共四次因写反导致「两条路都拒绝」** | `[实测]` |
| `suspend` 不能进同步 tick | `commitToGameState`（`eternity/studies/e.smali` 的 `b(List,ZZ,Continuation)`）是 suspend；`fp3.D(Z,vh0)` 是普通方法可同步调 | `[读码]` |
| 挑战真正的 start | **不是** `E(Z)Z`（那是「这一关研究还能不能买」），是 `D(Z,Continuation)`（`b.smali:472`，`:983` 是唯一写 `current` 非 0 的地方） | `[读码]` |
| `y()` 语义 | **同名不同类，别混**：`challenge/eternity/b.y()` = `I() == L()` 即「已满级」返回 1（`b.smali:3834`）；但 `challenge/antimatter/b.y()` = `K()` 即「已完成」（`antimatter/b.smali:1209`）。写跳转时最容易搞反 | `[读码]` |
| `challenge/antimatter/b.K()Z` 真实语义 | = `H().e(id)`，**`true` 表示「这一关已完成」**。`H()` 返回完成位 BitSet：基类（`antimatter/b.smali:811`）返回 `PlayerInfinityChallenges.b()`；`normal/a` 覆盖（`normal/a.smali:854`）为 `PlayerNormalChallenges.f()`。**不能按方法名猜，也不能信注释** | `[读码]`+`[REA]` |
| `normal|infinity/a.D(Z,Continuation)` 返回值 | 真正写入 `current` 之后返回 `Boolean.valueOf(true)`（`normal/a.smali` `:cond_5 → move p2,p1` 尾部）；解锁判据 `v()`/`B()` 为假时在失败出口返回 `Boolean.valueOf(false)`。⇒ **`true` = 成功进入**。真的挂起时返回 `CoroutineSingletons.a` | `[读码]` |
| 挑战解锁判据 | 普通：`normal/a.B()Z`（`normal/a.smali:345`，id==1 或已完成 或 反物质 ≤ `lu.b` 即解锁）；无限：`g40.B()Z`（`g40.smali:116`，`PlayerInfinityChallenges.f() >= id`）。两者都**只读存档**，可安全当预检用 | `[读码]` |
| 挑战 start 内含完整重置 | `challenge/antimatter/c;->a(Continuation)` → `prestige/e;->h(ZZ,Continuation)` = **完整大坍缩重置**。⇒ 每帧重复「进入挑战」＝每帧一次全量重置，游戏必然不可操作 | `[读码]` |
| 自动购买器极性 bug | `build_mod.py` 三段放行补丁原本是 `if-nez X, :..._er`，而 `orekiEarly ≡ !hasInfinity` ⇒ **两条路都拒绝**。改 `if-eqz` 后：零点击 50 秒从 `[101,79,60,50,0,0,0,0]` 变 `[660,490,390,320,240,190,150,120]` | `[实测]` |
| `setBackgroundTintList` 必崩 | `TutorialEntry.smali` 调 `Landroid/view/View;->setBackgroundTintList` → `NoSuchMethodError`；改 `TextView` 也一样。**整段移除 tint**，只留 `setBackgroundColor(#0078D7)` 才不崩 | `[实测]` |
| 语言默认值三处 | 同一个 `language` 键被三处用不同默认值读：`attachBaseContext`(决定界面)、`onCreate`(写 `Ljw0->T`)、`jw0.<clinit>`(静态初值)。必须三处对齐 `zh_CN`，且加「紧跟 `const-string v5, "language"`」锚点断言 | `[实测]` |
| UI 是 Compose | `uiautomator dump` 常返回空/陈旧，**只能靠截图 + 像素聚类**定位坐标 | `[实测]` |

---

## E. 已修复的根因（防止被静默改回）

1. **鹿颈长（Effarig）阶段 1 永久卡死**：`pLog10(0)=0` → 见 C.1。修后 `effarigStage=4` 三阶段全通，161 秒真实解锁无名氏。 `[实测]`
2. **Android 自动购买器全程空转**：跳转极性写反 → 见 D。 `[实测]`
3. **语言显示 English 而实际中文**：三处默认值不一致 → 见 D。 `[实测]`
4. **鹿颈长阶段 2 的 IP 硬顶**：`Effarig.isRunning && currentStage === EFFARIG_STAGES.ETERNITY` 时
   `ip = ip.min(DC.E1E6)`（原版 `DC.E200`），把「打穿反物质」变成「等比等 totalIPMult 慢慢爬」。 `[实测]`
5. **鹿颈长 run 内反物质被清零**：`oreki-keep-antimatter.js` 加
   `if (player.celestials.effarig.run === true) return true;`。 `[实测]`
6. **无名氏跳过门票自锁**：自动化只判 `Enslaved.isUnlocked` 而不是 `ENSLAVED_UNLOCKS.RUN`。 `[实测]`
7. **Android 进 IC1 后无法切换任何页面（软锁，R39）**：`OrekiChallengeAuto.tryNormal()/tryInfinity()` 里
   4 处判据极性全反 —— `b.K()` 之后写成 `if-eqz`（＝未完成的跳过、**已完成的每帧重进**），
   `D()` 的 Boolean 写成 `if-nez`（＝失败当成功、成功反而继续试下一关）。机制：
   手动进 IC1 → `OrekiInstantChallenge` 同帧结算并清 `current` → 下一帧因 `K()==true` 把「已完成的 IC1」
   当目标再调 `D()` → `D()` 内部 `challenge/antimatter/c;->a()` 是**完整大坍缩重置** → 再被清 `current`
   ⇒ **每帧一次全量重置**，页面切不动。修法：`if-nez v3`（K 已完成跳过）+ `if-eqz v2`（D 返回 false 才试下一关）
   + 解锁预检 `B()`。已加构建期断言 `build_mod.py::check_challenge_auto_polarity()`（指令三连匹配）。 `[读码]`

---

## F. 测试工具位置

| 工具 | 路径 | 用途 |
|---|---|---|
| Web 长测探针（真实新档 + CDP 逐帧采样） | `web/_tools/_r35a-vgate.mjs` | 清 localStorage 起全新档，采样 `dilU/DS1/DS6/TP/maxDT/hold/gates/vProg/ecDone/raUnlocked` 等 |
| Web 启动库 | `web/_tools/lib/edge-launch.mjs` | `launchBrowser()` / `openGame()` / `cleanup()` |
| Android 驱动 | `android/AD_Oreki_Edition_Android/scripts/simtest.py` | `pull / inject / launch / crunch / shot / clock / crash / state / pref / load` |
| 存档编解码 | `android/AD_Oreki_Edition_Android/scripts/savecodec.py` | 870 个后期存档解码 |
| 规则同步校验 | `scripts/check_agents_sync.py` | 校验 `AGENTS.md` 三处 inode + SHA-256 |

**真 Chrome 验收环境**（R35 建成）：

```
AVD oreki_web_test → emulator-5556
adb -s emulator-5556 install-multiple base.apk split_chrome.apk split_config.en.apk split_config.zh.apk split_on_demand.apk
# 绕过首次运行向导：
echo 'chrome --disable-fre --no-first-run --no-default-browser-check' > /data/local/tmp/chrome-command-line && chmod 644 它
# CDP 直连（读 DOM / 真触摸 / 截图都比 uiautomator 可靠）：
adb -s emulator-5556 forward tcp:9222 localabstract:chrome_devtools_remote
curl http://127.0.0.1:9222/json/list
```
`[实测]`

### F.1 Web 移动端 UI 事实（真 Chrome CDP 实测）

| 事实 | 值 | 等级 |
|---|---|---|
| 侧栏项数（Web 线上） | **10 项**：维度 / 自动化 / 挑战 / 无限 / 永恒 / 现实 / 天神 / 成就 / 统计数据 / 选项。`window.Tab` 有 **11 个键**（多一个 `shop`），商店未解锁时**不显示**在侧栏 | `[实测]` |
| 侧栏几何（392 CSS px 宽） | 每项 55×45，从 `y=70` 起、步长 45，第 10 项 `y=475`，底边 520 = 容器高 ⇒ **不用滚动就全可见** | `[实测]` |
| 判定「切页成功」的正确姿势 | **不要**看 `.o-tab-btn--subtab` 的可见列表（它把 10 个隐藏页的子标签全返回，永远不变）。要看**主内容区的特征文案**或截图 | `[实测]` |
| 剧情引言是**队列**，不是单个弹窗 | 关闭控件是 `<i class="c-modal-celestial-quote__end fa-check-circle">`（不是 button），**每点一次只前进一条**。后期存档实测积压 **62 条**，即进游戏后前 62 次触摸全被吞掉。这是原版行为 | `[实测]` |
| 窄屏阈值 | `.l-reality-button { width: 35rem }`（rem=10px ⇒ 350px）+ 左边距 33px = 383px。**视口 ≤ 383px 时右缘被裁**（360dp 常见小屏中招），且是「裁掉」不是「可横滚」 | `[实测]` |
| 记数法实际输出（Scientific） | `1e6.993e9`、`2e234,662,665`、`2e89`、`1e1000` —— 指数 ≥1e9 时指数自身再套一次科学记数法，符合用户口径 | `[实测]` |

---

### F.2 窄屏缺陷与修复（2026-10-30 R35 / 2026-10-30 R36）

**R35 修的三处**（当时都放在 `public/stylesheets/oreki.css` 的 `@media (max-width:620px)` 里）：

| 缺陷 | 根因（文件:行） | 实测（392×676） |
|---|---|---|
| 维度行「倍率向上溢出」 | `new-ui-styles.css:659` 行高写死 `5.5rem` + `components.css:2960` 文本容器写死 `3.5rem`，而 620px 断点已把行改成两行网格 | 行高 55px（内容需 74px），文本顶出行框 **+19px**、行间距 0 → 压到上一行。修后 110px / **−5px** |
| 自动购买器**横向**溢出 | `styles.css:4392` `.c-autobuyer-box-row { width: 96rem }` = **960px** | 行宽 960px、右缘溢出 **+573px**；修后 393px / **+1px** |
| 同页控件偏小 | 无统一触控尺寸：挑战按钮 150×30、子页签 146×25、check 16×16、帮助图标 20×20 | 67 个可点元素中 20 个 <44×44；修后 **剩 1**（checkbox 本体 22×22，可点区域在 44×44 的 label 上） |

**R36 的关键结论：620px 断点不够，必须扩到 900px。** `[实测]`

| 事实 | 值 | 等级 |
|---|---|---|
| `new-ui-styles.css` **不是**静态引入的 | 它由 `src/components/ui-modes/modern/ModernUi.js:56` 在 Vue 模板里以 `<link>` **运行时注入**，因此排在 `index.html` 静态引入的 `oreki.css` **之后**（同优先级时以它为准） | `[实测]` |
| 它的窄屏断点原本也是 620px | 于是 **768px 竖屏平板**与 **676×392 手机横屏**上「头部无限按钮 / 维度行七列 / 选项页两列 / 重置按钮」全部没被适配：768 下 `.c-prestige-button-container` right=**817**（溢出 49px），676 横屏 right=**759**（溢出 83px） | `[实测]` |
| 断点统一后的做法 | `oreki.css` 与 `new-ui-styles.css` 全部窄屏块统一改成 **`max-width: 900px`**；需要压过动态注入文件的规则继续用 `!important` | `[实测]` |
| **高特异性覆盖陷阱**（本轮真实踩坑） | 上游 `components.css` 里大量规则带 `[data-v-*]` 属性选择器（特异性 0,2,0），**高于**我们 0,1,0 的裸类名规则 ⇒ `.l-tt-save-load-btn { min-width: 44px }` 被整条压掉。必须写成 `.l-tt-save-load-btn[data-v-time-study-save-load-button] { … }` 才生效 | `[实测]` |
| 符文页溢出是**桌面端也有的**问题 | `.l-player-glyphs-column { width: 65rem }` = 650px 塞进 `.l-reality-button-column { width: 44rem }` = 440px ⇒ 无论桌面还是窄屏都溢出 210px。修法不限断点：列宽改 `width:100%; max-width:65rem` + 列内 `overflow-x:auto` 局部滚动 | `[实测]` |
| 缓存击穿 | `index.html` 的 `oreki.css` 与 `ModernUi.js` 的 `new-ui-styles.css` 原本**都没有版本查询串**（对比 `styles.css?3`）⇒ 改样式后老用户拿不到新版。R36 两者都加了 `?R36` | `[实测]` |

**R36 之后的触控档位（360px 挑战页实测）**：`AGENTS.md §19` 的「相对一致」条款已收敛 —— `[实测]`

| 档位 | 类名 | 实测尺寸 |
|---|---|---|
| 主档 56px | `.o-challenge-btn` | 150×**56** |
| 次档 48px | `.o-primary-btn` / `.o-primary-btn--subtab-option` / `.o-tab-btn` | 147×**48** / 48×**48** |
| 绝对下限 44px | `.l-tab-btn-inner`（侧栏项） | 55×**44** |

档差 56↔48 = **14.3%**、48↔44 = **8.3%**，均 ≤ §19 要求的 20%。 `[实测]`

### F.3 R36 · 通知洪水治理（`src/core/notify.js`）

| 事实 | 值 | 等级 |
|---|---|---|
| 根因 | 原版 `notify.js` 直接 `appendChild`，**无队列、无上限、无去重**。R35 实测峰值 **72 条**堆在右上角、遮挡 **143%** 视口 | `[实测]` |
| 修法 | ① 同时最多 `MAX_VISIBLE = 3` 条；② 同文本重复**合并**成一条并显示 `×N`；③ 按优先级「现实/永恒/打击」挤掉最低级、低级折叠进「还有 N 条」；④ 折叠条可点击清零 | `[实测]` |
| 优先级表 | `info`/`automator`=0，`success`/`error`=1，`infinity`/`eternity`/`black-hole`=2，`reality`/`strike`=3 | `[读码]` |
| 副作用 | 窄屏下原版 `.o-notification { white-space: nowrap }` 会让长中文提示横向溢出，已在 ≤900px 改为 `normal` + `max-width: min(76vw, 26rem)` | `[实测]` |
| 单元测试 | `web/_tools/_r36_notify_test.mjs`（**不需要浏览器、不需要构建**）：7 组用例 / 18 项断言全通过，退出码 0 | `[实测]` |
| 浏览器实测 | 7 视口 × 10 页实测，容器内 `.o-notification` 元素数 **1~5**（含离场动画中的残留与汇总条），远低于原来的 72 | `[实测]` |

### F.4 R36 · 多视口几何验收工具

| 工具 | 作用 | 等级 |
|---|---|---|
| `web/_tools/_r36_viewports.mjs` | 7 视口（320/360/392/430/768/1280 + 676×392 横屏）× 10 页，逐页量整页横向溢出、右缘越界元素、按钮高度直方图、<44×44 清单、关键类名尺寸 | `[实测]` |
| `web/_tools/_r36_notify_test.mjs` | 通知洪水单元测试（mock DOM，零浏览器依赖） | `[实测]` |
| `web/_tools/_r36_cssdiag.mjs` | 查指定选择器的**计算样式**与样式表加载顺序，用于定位「覆盖没生效」类问题 | `[实测]` |
| **测量坑 1**：可见性判定 | 只看元素自身的 `display`/`visibility` 会把 `display:none` 祖先下的**隐藏页签残留 DOM** 误判成可见。必须用 `e.getClientRects().length > 0` | `[实测]` |
| **测量坑 2**：越界判定 | 局部滚动容器（`overflow:auto/scroll/hidden`）里的内容超出是**设计如此**，不能算「被裁」；要沿祖先链查 `overflowX` | `[实测]` |
| **测量坑 3**：通知条 | `.o-notification` 入场动画用 `translateX`，动画期间 `rect` 会短暂出界 ⇒ 量越界时要排除带 `a-notification--enter/--leave` 的元素 | `[实测]` |
| **测量坑 4**：页面解锁 | 新档只解锁 5 个侧栏页（维度/自动化/成就/统计数据/选项），挑战/无限/永恒/现实/天神页**根本不存在**。要量这些页必须临时把 `Tab[*].config.condition` 置为 `() => true`（**纯几何测量脚手架，不构成任何玩法/通关结论**） | `[实测]` |

**R36 七视口最终实测结果** `[实测]`：

| 视口 | 整页横向溢出 | 右缘越界元素 | <44×44 的按钮 |
|---|---|---|---|
| 320 | 无 | 0 | **0** |
| 360 | 无 | 0 | **0** |
| 392 | 无 | 0 | **0** |
| 430 | 无 | 0 | **0** |
| 768 | 无 | 0 | **0** |
| 1280（桌面） | 无 | 0 | 17（**不在 §19 窄屏规则范围内**） |
| 676×392 横屏 | 无 | 0 | **0** |

---

### F.5 `uiautomator dump` 在持续动画画面上会直接失败，Android UI 验证必须走 `frame-observer`（R40 实测）

游戏画面每帧都在变，`uiautomator dump` 会一直等「界面静止」而永远等不到，直接报
`ERROR: could not get idle state`。**更要命的是失败时不写新 XML，磁盘上留的是上一次的旧文件**
—— 只看「文件存在」会把**上一次的界面**当成当前界面（比报错更危险）。R40 在后期存档界面连续 3 次全败、
文件时间戳没变。

`frame-observer` 原有 `view_tree_snapshot` 也不够用：它只在 `TYPE_WINDOW_STATE_CHANGED` 时产生，
且**深度上限 12 把游戏正文整段切掉**（正文在第 13~18 层，深度 12 的节点 `children` 恒空，
32 个节点里只有 1 个带文字）。

解法（已实测）：R40 给 frame-observer 加
`GET /ui?depth=48&max=3000&flat=1` —— 走**无障碍服务的即时控件树**，不等 idle；
自动快照深度同时 12 → 24。封装命令 `android/AD_Oreki_Edition_Android/tools/fo.py ui`。
实测 `oreki_test`（API34）游戏前台下返回 **97 个**「有文字/可点」节点，含完整中文文本与 bounds。
（frame-observer 侧提交 `4fd58bc` + 行尾修正 `d0bec16`。）

**规则：Android 侧读控件树一律先走 `fo.py ui`；`uiautomator dump` 不要当主路径**，
若非用不可，必须**同时校验 dump 文件时间戳变化**，否则会读到旧界面。
（与 `AGENTS.md §23` 口径一致，本节给的是**为什么**。） `[实测]`

---

## G. 仍未知 / 待证

- Android 端 EC 研究自动购买链在真机上是否真的能推进（`OrekiChallengeAuto.tick()` R35 已修正 8 处极性并汇编通过，**装机实测进行中**）。 `[未知]`
- Ra → Laitela → Pelle 全链在 180 分钟内是否物理可达（当前 Ra 只到 20 级需 `3.48e16` 记忆 vs 可产 `6.17e14`，差 56×）。 `[推断]`
- V 的 `realities` 项（200 次，实测 80/200，节奏约 0.175 次/秒）在 `dilatedTime` 打通后能否在剩余预算内自然达标。 `[推断]`
- Web 移动端「教程」弹窗内容与关闭、弹窗文本逐字换行 —— **未验证**。 `[未知]`
- 360px 窄屏下 `.l-reality-button` 右缘被裁 23px —— **R35 实测存在，R36 已修**
  （窄屏改为 `width:100%; max-width:100%`），但**修后的几何只在 headless Edge 上验过**，
  **未在真 Chrome / AVD 上复测**。 `[推断]`
- 1280px 桌面视口仍有 **17 个** <44×44 的控件（`.o-tab-btn.l-help-me` 20×20、
  `.c-glyph-inventory-option` 190×27、`.l-glyph-equip-button` 106×35 等）。
  §19 的绝对下限目前只约束 ≤900px 窄屏，**桌面档未纳入**。 `[实测]`
- 通知洪水治理只改了 **Web**。Android 是原版 Kotlin 逻辑（smali 补丁改不动
  `notify` 的 Kotlin 类），**两端通知条行为目前不等价**。 `[读码]`

## C.12 Android 虚构升级编号映射 —— 更正 R37 的错误结论（R38 实测）

**R37 的结论是错的，必须废弃**：R37 §6.5 把 Android 的 IU15 映射为「`b->n`，id=9，阈值 3.0E12」，
并据此得出「Android 3.0e12 vs Web 1.5e12 双端不一致」。**这条整个不成立。**

R38 由 Agent B 用 JADX 对 `secret-formula/reality/imaginary_upgrades/a.smali` 的 15 个 `sget` 逐条
反查 `zt3->imaginary_upgrade_N_requirement` 得到完整对照表，再用可变长指令与操作数宽度逐字节核对：

| BitSet | 对应 | 第几项 | 真实升级 | 备注 |
|---|---|---|---|---|
| `b->h` | `imaginaryUpgReqs` | — | **需求是否满足**（不是「已购买」） | 15 个 on-bit |
| `b->i` | — | — | `hasFailed`（**字面量 0 = 恒 true**），仅 IU15 用 | — |
| `b->j` | `singles` | — | **IU13** | 1 个 on-bit |
| **`b->k`** | **`singles`** | **第 5 项** | **IU15「理想之构」** | on-bit 数 **5** |
| `b->l` | `singles` | — | **IU25** | 1 个 on-bit |
| `b->m` | `singles` | — | **IU7** | 1 个 on-bit |
| `b->n` | `singles` | **第 10 项** | **IU20**（解锁所有自动购买器） | on-bit 数 6 |
| `b->o` | `singles` | — | **IU19** | 1 个 on-bit |

**两条自证（这是判定的关键）**
1. `b->k` 恰好 5 个 on-bit，与 `imaginary_upgrades/a.A(Z)Z`（`:317-333`）的 switch 分发项数一致 ——
   它只对 15/16/17/18/25 这 5 个「有机械锁」的升级做分发。
2. `b->n` 的 on-bit 是 6，且它用的是 `0x4285d3ef79800000` = **3.0E12**。R38 实测 `3e12`
   **正是 IU20 的 `cost`**，不是任何 `requirement` ⇒ 反证 R37 把「cost」当成了「门槛」。

**IU15 在 Android 的真实实参是 `BitSet.set(4)` + `1.5e12`**
（`0x4275d3ef79800000` = 1.5e12，与 Web `imaginary-upgrades.js` 的 `>= 1.5e12` **完全一致**）。
⇒ **双端 IU15 门槛本来就一致，不存在 R37 记的那处差异。**

**结论**：R37 `_r37_b_android.md` §6.5 的对照表（尤其 IU15 = id 9 / 3.0e12 这两格）作废；
R37 的 `patch_id_autobuyer_guard()` 若是按 id=9 写的，改动的是 IU20 而不是 IU15。

---

## C.13 IU15 解锁链的真实时间线（R38 实测）

**上下文**：`OREKI_IU15_AM_EXP` 从原版 `1.5e12` 缩到 `1e8` 之后，IU15 到底几秒能拿到、
卡在哪一步。数据来自 `web/_tools/_r38m/purch1.log` / `purch2.log`（真实 Edge + CDP，
存档 realities=10，`GameSpeed.factor = 10000`）。

| 时刻 | 事件 | 探针 |
|---|---|---|
| t=96.7s | 在 r=5 打开原版锁 `setMechanicLock(true)` | `lockOn=true`，但 `maxID1` 已被污染 |
| t=98.8s | 发生一次**自然**现实重置 → r=10 | `maxID1=0`、`lockActive=true` |
| t=109.9s | 锁仍生效 | `amE=5.04e7`、`id1=0`、`maxID1=0`、`lock=1` |
| t≈112s | `amE` 越过 `1e8`，`tryUnlock()` 自动触发 | `imaginaryUpgReqs` 位点亮 ⇒ `isAvailableForPurchase=true` |
| 同一帧 | 锁自动释放（`imaginary-upgrades.js:87`） | `hasPlayerLock=false`，ID1 立刻被买回 |
| t=203s | 尝试 `purchase()` | `canApply=false`、`bought=false`，`IM=7.98e7` < `cost=1e9` |

**结论 1**：`1e8` 门槛下，从现实开始到需求位点亮约 **13 秒**，且全程不需要我们手动调
`tryUnlock()` —— 它注册在 `GAME_EVENT.GAME_TICK_AFTER`（`imaginary-upgrades.js:7`），
需求一满足就自己点亮。**所谓「IU15 冲刺模块」真正要做的只有一件事：在现实开始前把原版锁打开。**

**结论 2**：真正的剩余门槛是 **IM ≥ 1e9（IU15 的 cost）**。实测该存档 realities 10→15 期间
IM 只有 `1.5e7 ~ 1.2e8`（log10 7.2~8.0），差 1~2 个数量级。这不是结构性的墙，
是「再跑几个现实就能到」的正常经济门 —— 与 `1.5e12` 那种上限本身不够的情况性质不同。

**结论 3（通用坑）**：本作 `format()` 对指数 ≥ **1e6** 一律返回「无限」
（`Decimal.MAX_VALUE` 截断）。实测 `format(Decimal.pow(10,1e6))` → "无限"、
`format("1e100000000")` → "无限"。所以**任何以巨大指数表达的需求文案都不能走 format**，
必须手工拼字符串（IU15 现在写的是 `1e${formatInt(OREKI_IU15_AM_EXP)}` → `1e100,000,000`）。
原版 `format("1e1500000000000")` 其实早就显示成「无限」，只是没人能打到所以没暴露。

---

## C.14 `maxID1 == 0` 不只被「购买」破坏 —— EC7 奖励会持续生产 ID8（R38-A 实测）

**这是 IU15 最容易踩错的一条**：以为「关掉 8 层 ID 自动购买器 + 锁住购买」就能守住
`maxID1 == 0`，实际不然。

**机制**：`src/core/time-dimensions/time-dimension.js:331-335`（EC7 奖励）

```js
EternityChallenge(7).reward.applyEffect(p => InfinityDimension(8).amount += p * diff / 1000);
```

而 `infinity-dimension.js:373-375` 又有 ID8 → ID7 → … → ID1 的逐层生产链。
⇒ **只要本现实里 EC7 有完成次数，ID1 的 `amount` 必然 > 0，`maxID1` 同帧变正，IU15 永久失败**
（`requirementChecks.reality.maxID1` 是 `clampMin` 累积，一旦为正就不再回 0）。
这不是购买，`buyMax/buySingle` 全部 no-op 也挡不住。

**实测证据**（R38-A `_r38a/exp2.jsonl`）：只挡购买时，现实重置后约 6 真实秒 ID1 就从 0 涨到 `1e45037`；
活页面取证 8 层 `purchases` 全为 0、`isUnlocked` 全为 1，`amount` 却已到 `1e298831` —— 纯生产。

**正确做法**：现实重置会清空 EC 完成记录，所以冲刺窗口内**不要重打 EC7**。
已落地：`oreki-eternity-automation.js::nextUnfinishedEcId()` 在 `OrekiIu15Sprint.skipEc7` 时跳过 EC7。

**顺带一条会静默卡死终局的坑**：ID 自动购买器被关掉后如果没还原（`player.auto.infinityDims.*.isActive = false`），
ID1 不再被买 ⇒ 无限之力归零 ⇒ EP 卡在 1e2974（现实要求 `maxEP >= 1e4000`）⇒ **现实永远做不了，整局死锁**。
凡是临时关自动购买器的模块，必须「保存 / 还原 8 层逐层开关 + 组开关 + 要求锁」，三样都幂等还原。

---

## C.15 终局判据里 `TARGET` 就是「需要的反物质指数」本身，`OFFSET` 换任何值都一样（R38-M 单测）

**公式**（`src/core/celestials/pelle/game-end.js`）：

```js
endState = (Math.log10(totalAM.plus(1).log10() + 1) - OFFSET) / (Math.log10(TARGET) - OFFSET)
```

令 `E = log10(totalAM)`（反物质指数）。`endState >= 1`
⟺ `log10(E+1) - OFFSET >= log10(TARGET) - OFFSET`
⟺ `log10(E+1) >= log10(TARGET)` ⟺ **`E >= TARGET`**。

⇒ 两件反直觉但必须记住的事：

1. **`TARGET` 不是「多少倍」也不是「多少反物质」，它是「反物质指数必须达到的数值」。**
   原版 `TARGET = 9e15` 的真实含义是「指数要到 9e15」（≈ 反物质 `1e9e15`），不是「反物质 9e15」。
2. **`OFFSET` 取什么值都改不了「`E >= TARGET`」这个交会点** —— 分子分母同减一个常数，
   只在 `TARGET = E` 处相等。所以「把 OFFSET 留着、只缩小 TARGET」是**无效操作**。

**`OFFSET` 唯一的作用是决定分母符号与单调性**：分母必须是 `log10(TARGET) - OFFSET > 0`。
原版取 `8.7` 是因为配 `9e15`（分母 `7.25 > 0`）。一旦 `TARGET < 1e8.7 = 5.01e8`，
分母变负 ⇒ **函数非单调，E 越大 endState 反而越小**，判据彻底失效。
⇒ 想把 `TARGET` 降到 `1e8.7` 以下，**必须同时把 `OFFSET` 压下来**。
本作现取 `OFFSET = 1`、`TARGET = 1e3`：分母 `= 2 > 0`，`E` 从 10 涨到 1000 时 `endState` 从 0 平滑升到 1。

**实测单测**（`web/_tools/_r38m/endprobe.mjs`，内存里临时改写峰值字段后逐点读 `GameEnd.endState`，读完还原）：

| `E` | 10 | 50 | 100 | 300 | 999 | 1000 | 2000 | 1e4 |
|---|---|---|---|---|---|---|---|---|
| `endState` | 0.0207 | 0.3538 | 0.5022 | 0.7393 | 1.0000 | 1.0002 | 1.1506 | 1.5000 |

单调递增、`E = 1000` 过线、页面 0 控制台错误。

**R37 注释里的两处事实错误（已更正，勿再沿用）**：
- ❌「`TARGET = 1e9` 表示门槛从 +10.7 个数量级降到 +3.7 个数量级」——错，它表示「指数要到 1e9」；
- ❌「`totalAntimatter` 初值就是 `1e180000`（`pelle.js:260`）」——错，那句在
  `resetResourcesForDilation()` 里，只在佩勒内做膨胀重置时才跑；真实初值是
  `player.js:712` 的 `DC.D0`（0）。

---

## C.16 佩勒阶段「反物质峰值涨不动」的真凶是重置竞争，不是产量（R38-M 实测）

**症状**：进入佩勒后 `player.celestials.pelle.records.totalAntimatter` 的指数（下称 `pamE`）停住不动，
看起来像「佩勒产量归零」。

**原始采样**（`web/_tools/_r38a/lai6.jsonl`，真实新档，1 秒粒度）：

| t(s) | `pamE` | `amE` | `ad1` |
|---|---|---|---|
| 323.6 | 316 | 154 | 6.86e130 |
| 350.8 | 316 | 308 | 1.51e316 |
| 420.2 | 316 | 308 | 1.96e316 |

`pamE` **105 秒一动不动**，同期 `ad1` 涨了 186 个数量级 ⇒ **产量完全正常，是峰值被按住了**。

**机制**（三行代码就能串起来）：

1. 终局判据读的 `records.totalAntimatter` 是**历史峰值** —— `currency.js:216`
   `player.celestials.pelle.records.totalAntimatter = ...max(value)`；
2. `Player.canCrunch` 的门槛是 `Decimal.NUMBER_MAX_VALUE = 1.797e308`（`player.js:958`）；
3. `Pelle.initializeRun` 会强制 `Autobuyer.bigCrunch.mode = AMOUNT`（`pelle.js:87`），
   而 `big-crunch-autobuyer.js:107` 的 `canTick` 就是 `Player.canCrunch`。

⇒ 反物质一过 `e308` **当帧就坍缩清零**，每周期峰值永远停在 e308 量级，峰值字段再也抬不动。
旁证：`crunchL`（无限次数 log10）在同样 100 秒内从 0 涨到 3.59，即 **≈39 次/秒** ——
远超任何自动化自己 3 秒级的节流，只能是原版自动购买器在打。

**同理要停的还有两个**：
- `Pelle.armageddon` → `finishProcessReality({ reset: true, armageddon: true })`（`pelle.js:149-155`），
  整局现实重置，比坍缩更彻底；
- `Autobuyer.eternity`（`Player.canEternity` 一到就重置换取 EP）。

**正确做法**：佩勒阶段只做「全部最大 + 维度提升 + 星系 + 佩勒升级」这四件**不清空当前反物质**的事，
把 `Autobuyer.bigCrunch.isActive` / `Autobuyer.eternity.isActive` 每帧强制置 false
（`Pelle.initializeRun` 之后原版会重开，所以必须每帧检查）。落地：`oreki-endgame-automation.js::_stopDoomedResets()`。

---

## C.17 终局判据对称化后的精确边界：`endState >= 1 ⟺ 反物质指数 E >= 1000`（R39 实算）

`game-end.js` 现式（`OREKI_PELLE_END_OFFSET = 1`、`OREKI_PELLE_END_TARGET_EXP = 1e3`）：

```
endState = (log10(log10(totalAM)+1) - OFFSET) / (log10(TARGET+1) - OFFSET)
```

令 `E = log10(totalAM)`：

- 分子是 `log10(E+1) - 1`，分母是 `log10(1001) - 1 ≈ 2.000434`，**都带 `+1`，形状对称**；
- `endState >= 1 ⟺ log10(E+1) >= log10(TARGET+1) ⟺ E >= TARGET = 1000`。

**R39 用 node 实算的边界**（不是推导，是算出来的）：

| `E` | `endState` | 是否过线 |
|---|---|---|
| 9 | 0.000000 | 否 |
| 10 | 0.020692 | 否 |
| 100 | 0.502052 | 否 |
| 500 | 0.849734 | 否 |
| 998 | 0.999566 | 否 |
| 999 | 0.999783 | **否** |
| 1000 | 1.000000 | **是** |
| 1001 | 1.000217 | 是 |
| 1e4 | 1.499696 | 是 |

单调性：`[0,1,10,100,1000,1e4]` 全区间 `endState` 单调不减 → `true`。

**为什么必须对称化**：分母原本是 `log10(TARGET)`（不带 `+1`），分子带 `+1`，交会点落在
`E = TARGET - 1 = 999`，与玩家可见文案「反物质 1×10^1000」差一个数量级。这是 R38-C 指出的
off-by-one，R39 已消掉。**改回不带 `+1` 的分母会立刻让文案与判据不一致，别改。**

**另一个必须记住的约束**：`OFFSET` 不能随手调。`TARGET < 1e8.7 = 5.01e8` 时分母
`log10(TARGET) - 8.7` 变负、函数**非单调**（E 越大 endState 越小）。所以「缩 TARGET」必须同时压 `OFFSET`。
`[实算]`

---

## C.18 【机制结论已被 R40-A 推翻，仅保留观测数据】Web 端 Pelle 之前卡在 EC 阶段（R39 提出，R40 修正）

> **R40-A 修正（2026-10-30）**：本节下面写的「现实重置清空时间研究 ⇒ `shouldHoldReset()` 死锁」
> **不是**真实机制，已由 200 ms 级 `TimeStudyState.prototype.refund` 调用栈证据推翻。
> 真实机制是「两条自动化对『当前目标 EC』定义不同 ⇒ 每 6.2 s 一次 respec 抖动」，见 **C.22**。
> 关键反证：`isRealityAvailable()`（`reality.js:119`）要求 `maxEP.exponent >= 4000` **且**
> `TimeStudy.reality.isBought` —— 现实只能在整条 EC 链打完之后发生，清空的是「已完成的一轮」，
> 不可能是「正在建的那棵」；改前 700 s 内 `realities` 从 0 起，抖动期一直是 0（不是现实重置）。
> 另外 `shouldHoldReset()` 只被 `game.js:237 orekiEcEntryHold()` 用于大坍缩自动器入口保护，
> 压现实的是 `OrekiCelestialAutomation.holdReality`，两者不是一回事。
> 保留下文：R39 的里程碑数字与「171 留不住」的观测仍然成立，可作对照基线。

R39 新档长跑（`web/_tools/_r39b/r39b-full.jsonl`，1 s 采样）实测里程碑：
IU15 **6.8 min**、莱特拉解锁 6.8 min、现实数 100 **9.1 min**、`laiTier=8` **9.6 min**；
之后 25 分钟停在 EC，`pelleUnl` 恒 false、`isGameEnd` 恒 false。

链条与断点（全部来自 CDP 只读探针 `_r39b/probe*.mjs`）：

```
EC1..EC12 各 5 次 → TimeStudy.reality（ds6）→ IU25 → Pelle → 反物质 1e1000 → GameEnd
```

- `EternityChallenge(1).completions == 5/5`，但 `TimeStudy.eternityChallenge(2).canBeBought == false`；
  它的三条子条件实测为：`isAffordable=true`、`allSecondaryRequirementsMet=true`、
  `config.requirement=[171]` 且 **`TimeStudy(171).isBought=false`**。
- 171 买得上但**留不住**：`TimeStudy(71).purchaseUntil()` 实测能一次把 71 和 171 都买上，
  一分钟后复查，11~200 号研究**全空**。原因是**现实重置清空时间研究**，而这一局 10~20 s 重置一次现实。
- `oreki-eternity-automation.js:432` 的 `shouldHoldReset()` 要求
  `primaryMet = config.requirement.some(s => TimeStudy(s).isBought)`。
  现实刚重置时 171 必为 false ⇒ 不压现实 ⇒ 下一帧继续重置 ⇒ 171 永远买不上。
  **这是自我维持的死锁，不是「跑得慢」**，所以调阈值/加数值都不会让它前进。
- 连带后果：`ds6` 永远买不到（它的前置是 EC11/EC12 各 5 次），
  `IU25` 的 `checkRequirement` 要求 `TimeStudy.reality.isBought`，
  于是 `iu25q=false` / `iu25pos=false`，Pelle 无从谈起。

**~~下一轮改法~~（R40 判定：不采用）**：原提议是给 `shouldHoldReset()` 加**有界准备期** ——
当「目标 EC 的主研究未买、但 TT ≥ 100 且 `TimeStudy(71).canBeBought`」时也返回 true，
并记 `_prepHoldUntil = now + 15~20 s`，到点无条件放手。

R40-A 判定这条**不必做也不该做**：现实在 EC 链未完成时根本无法发生（DS6 是硬闸门），
「准备期压现实」解决的是一个不存在的问题；再叠一层 `holdReality` 只会重演 R34
「两处各写一套条件互相锁死」的事故。R40 实际采用了另一个改法（见 C.22）。
`[实测]`（推翻了 R39 的机制归属）

## C.19 同名坑第二次：`Currency.imaginaryMachines.value` 是普通 Number，没有 Decimal 方法（R39 实测）

`oreki-endgame-automation.js` 里已经因为 `.lte(0)` 踩过一次（文件 176 行注释），
R39 又在 `iu25ConditionsReady()` 末尾踩了 `.gte(OREKI_IU25_COST)`：

- `Currency.imaginaryMachines.value` 是 **Number**，`.gte` 不存在 → TypeError；
- 外层 `try/catch` 把它吞掉 → 函数**恒返回 false**；
- 实测 `imLog10 = 10`（1e10 IM）、`OREKI_IU25_COST = 5e9` 时仍返回 false。

⇒ **IU25 的前置判定永远是「不就位」**，即使 tier 8 / 研究 / 符文 / IM 全部满足。
已改为 `Number(...) >= OREKI_IU25_COST`。

**规则**：在这个代码库里对 `Currency.*.value` 一律先 `Number(...)` 或 `.toNumber()`，
不要直接调 Decimal 方法；而且**不要用 `try/catch` 包住整个判定然后 `return false`**
—— 那会把「代码写错」伪装成「条件不满足」，R38/R39 各踩一次。`[实测]`

## C.20 `.gitattributes` 的规则顺序反了：`* text=auto` 写在末尾会盖掉前面所有 `-text`（R39 实测）

两仓 `.gitattributes` 原本是「先 `-text` 规则，最后 `* text=auto`」。
gitattributes 是**后面的规则覆盖前面的**，于是 `docs/FACTS.md`、`docs/AGENTS_GLOBAL.md`、
`docs/SHARED_GAMEPLAY_STANDARD.md` 的 `-text` 保护**一直没生效**：

```
$ git check-attr -a docs/FACTS.md
docs/FACTS.md: text: auto        ← 修之前
docs/FACTS.md: text: unset       ← 修之后（把 * text=auto 移到最前面）
```

后果是这些**硬链接共享文件**在 checkout 时可能被 CRLF 改写、甚至被删除重建而断开硬链接，
正是 AGENTS_GLOBAL §0-A 要防的事。R39 已把 `* text=auto` 提到文件最前面。
**改 gitattributes 后必须用 `git check-attr` 复验，而不是看文件里有没有那行字。** `[实测]`

## C.21 DS6（`TimeStudy.reality`）买上即被现实打掉，只活一帧 —— IU25 永远输掉这个竞态（R40 实测）

`isRealityAvailable()`（`reality.js:119`）=
`maxEP.exponent >= 4000 && TimeStudy.reality.isBought`。也就是说 DS6 **一被买上就是「现实可打」**，
下一次 `shouldReality()` 立刻把现实打出去，而现实重置会 `Currency.timeTheorems.reset()`
（`reality.js:672`）⇒ 时间研究整棵清空 ⇒ DS6 消失。

`OrekiEndgameAutomation.driveLaitela()`（`oreki-endgame-automation.js:248`）第 250 行有
`if (now - this._lastSlowMs < SLOW_TICK_MS) return;`，`SLOW_TICK_MS = 500`（`:97`）——
**500 ms 真实时间节流**，采不到「DS6 在位 + tier 8」这个只存在一帧的状态。

证据（`web/_tools/_r39b/r39b-full.jsonl`，2230 条 1 s 采样，覆盖 t=0→2297.7 s，复算命令见下）：

```
ds6 === true          99 条，最大 t = 406.5 s
laiTier >= 8        1672 条，最小 t = 578.2 s
两者同时成立            0 条          ← 交集为空
```

⇒ IU25 的 `checkRequirement`（`imaginary-upgrades.js:296-305`，要求
`Laitela.isRunning && maxAllowedDimension === 0 && TimeStudy.reality.isBought`）**一次都不可能成立**。
R39 末态正是 `iu15=true / laiTier=8 / imL=10.5 / ds6=false / iu25 恒 false`。

**已采用的修法（不要改回「等 DS6 到账再判断」）**：不等 DS6，改成「EC 链已经全部 5/5」就**提前压住现实**，
让 DS6 买上后留得住，再在同一个现实里起 run、卸符文、买 IU25。
上限 `IU25_HOLD_MAX_MS = 90000`（`:95`，接线在 `:297-303`），到点无条件放行，每次现实重置后重新计时。
**规则：凡是「只在一帧内成立」的状态，任何 ≥200 ms 的轮询都不可靠，只能改成提前压制或事件订阅。** `[实测]`

## C.22 EC 分叉抖动：两条自动化对「当前目标 EC」定义不同 ⇒ 每 6.2 s 清空整棵时间研究树（R40 实测）

这是 R39「现实每 10~20 s 重置一次」结论的真实替代机制（C.18 已标为推翻）。

- `OrekiEternityAutomation.nextUnfinishedEcId()` 按 **1→12** 取第一个未满 ⇒ 当时是 EC6 ⇒
  `blockedStudies()` 认为维度分叉该是 **71**，把 71 买回树里；
- `OrekiDilationAutomation._targetEc()` 按 **9→10→11→12** 取 ⇒ 当时是 EC12，而
  EC12 的 `secondary.forbiddenStudies = [71, 72]` ⇒ 只要 71 在树里，
  它每 6 s 调一次 `respecTimeStudies(true)`（`oreki-dilation-automation.js:299-305`）；
- 闭环：dilation 清空 38 个研究 → 本模块 1 s 内把 71 买回 → dilation 再判被 71 阻挡 → 再清空。

证据（`web/_tools/_r40/r40a-diag.refunds.jsonl`，200 ms 采样 + `TimeStudyState.prototype.refund` 取真实调用栈）：
7 次 respec、间隔恒 **6.17~6.32 s**、`unlocked` 全程 **0**、`studiesLen` 恒 38、**EC 完成数一次未变**，
同期 `player.realities` 一直是 **0** ⇒ **确认是 respec 抖动，不是现实重置**。
栈原文：`at respecTimeStudies (time-studies.js:141:11) ← at Object._driveEcChain (oreki-dilation-automation.js:301:9)`。

**修法**：新增 `dimensionPathId()`（`oreki-eternity-automation.js:217`）——
「**EC11 已满且 EC12 未满 → 73，否则 71**」，把维度分叉从「下一个打哪关」解耦；
`blockedStudies()`（`:255`）改用它。另加会话内快照闸门 `{id, completions, at}` + 3 s，
抑制「别的模块把研究买回来 → 再清空」的抖动。

### 收益

**主表：本次已实测到的里程碑（单次运行 T1，不做改前/改后配对）**

出处 `web/_tools/_r40/r40a2-t1.log` / `.jsonl`（2945 条，t 0→1499.5 s）：

| 里程碑 | 实测值 | 出处 | 证据等级 |
|---|---|---|---|
| EC1→EC12 全 5/5 首次达成 | **28.5 s** | `r40a2-t1.jsonl` 的 `ecs` 字段（日志无此行，需复算） | `[实测]` |
| DS6（膨胀研究 6）到手 | **25.1 s** | `r40a2-t1.log` 的 `[FIRST] ds6 t=25.1s` | `[实测]` |
| V 解锁 | **484.5 s** | `[FIRST] Vunl t=484.5s r=60` | `[实测]` |
| iu15 / 莱特拉解锁 | **496.6 s** | `[FIRST] iu15` / `laiUnl` | `[实测]` |
| `realities` 终值 | **185**（不是门槛，只是 T1 跑完的值） | `.jsonl` 末条 | `[实测]` |
| 莱特拉 tier 0→8 | **从未发生**（全文件 `laiTier` 恒 0、`laiRun` 从未为真） | `.jsonl` | `[实测]` |

⚠ **不要把这些数张冠李戴**：`T1` 里 DS6 是 **25.1 s**（不是 24.8）、全 12 关是 **28.5 s**（不是 27.8）、
V 是 **484.5 s**（不是 482.6）。`27.8 / 24.8` 属于另一份文件 `r40a-fix.jsonl`。

**同协议 A/B 副表（保留供 R41 核对）**

`web/_tools/_r40/R40A-Web-EC-根因.md §3` 记录的唯一一对 A/B（同一探针、同一端口、同一配置）：

| 指标 | 改前 `r40a-diag.jsonl`（700 s） | 改后 `r40a-fix.jsonl`（1000 s） |
|---|---|---|
| EC1~EC12 全部 5/5 首次达成 | 75.2 s | **27.8 s** |
| DS6 首次买上 | 137.9 s | **24.8 s** |
| `_driveEcChain` 抖动次数 | 11（含 7 连 6.2 s） | **5**（全为 `unl=11` 合法清场） |
| realities @660 s | 30 | 70 @938 s |

复算核对（统一口径，`ecs` 字段优先、缺失时回落到 `ec1..ec12`）：

```
r40a-diag.jsonl   全12关=75.2   ds6=137.9   （差 -62.7：ds6 晚于全关）
r40a-fix.jsonl    全12关=27.8   ds6= 24.8   （差  +3.0：ds6 早于全关）
r40a-fix2.jsonl   全12关=29.2   ds6= 26.1   （差  +3.1）
r40a2-t1.jsonl    全12关=28.5   ds6= 25.1   （差  +3.4）
```

**`137.9 s` 的精确状态**：t=137.9 的样本是 `realities = 10`、`ds6 = true`、12 关已全满
⇒ 它是**改前首次买上 DS6 的时刻**。该文件 `realities` 全程最高 **35**（末值），**从未到 60**；
`realities=10` 首达是 t=111.5 s。**「137.9 s 是 realities=60 的时刻」是错的。**
**`94.1 s` 作废**（属 `_r40m/run1`，见下），不得用作任何一列。

⚠ **口径纪律**：口头「run1 / run2 / run3」在不同人嘴里指向过不同文件，**一律以文件名为准**：

| 文件 | 角色 |
|---|---|
| `web/_tools/_r40/r40a-diag.jsonl` | 改前基线（700 s，585 条） |
| `web/_tools/_r40/r40a-fix.jsonl` | 改后（1000 s） |
| `web/_tools/_r40/r40a-fix2.jsonl` | 改后双文件（430 s，回归） |
| `web/_tools/_r40/r40a2-t1.jsonl` | **T1 长跑**（1500 s，2945 条，跑到 `realities=185`） |
| `web/_tools/_r40m/run1.console.log` | 并行独立 run，**用了哪份代码没留档** |

⚠ **ds6 早于全 12 关 —— 现象已实测且可复现，机制未解释**：

- **改前顺序正常**：`r40a-diag` 里 ds6 比全 12 关**晚 62.7 s**；
- **改后三条 run 全部反转**：`fix` 早 3.0 s、`fix2` 早 3.1 s、`T1` 早 3.4 s ⇒ **系统性反转，不是采样抖动**；
- 与「DS6 的逻辑前置是 EC11/EC12 各满 5 次」并不矛盾（DS6 不要求 EC1~EC8 全满）；
- **机制仍未定位**，不要当成机制结论用。
  候选解释（`[推断，未验证]`）：EC 链由 `_targetEc()` 按 9→10→11→12 先打高新关、
  `nextUnfinishedEcId()` 再回头补 1~8 ⇒ 先买上 DS6、后集齐全 12 关。

**注意：`_r40m/run1` 不能当前置基线。** 那份 `run1.console.log`（18:11，端口 8872）首次全 12 关在 **t=28.2 s**，
其后 `[WIPE]` 以约 **2.1 s** 节奏把 `ecUnl` 反复打回 0，**t=93.1 s 才再次全 5/5**、`[DS6] bought @t=94.1 s`。
其 WIPE 节奏（2.1 s）与 diag（6.2 s）、fix（12 次/现实周期）都不同，**且用哪份代码没留档** ⇒
`93.1 / 94.1` **只属于这条 run**，任何列都不要用。 `[实测]`

## C.23 `Glyphs.equip()` 换槽 = 一次**无收益的完整现实重置**，`realities` 不增（R40 实测）

`Glyphs.equip()` 在目标槽已占用时会走 `swapIntoActive()`（`glyph-core.js:319-323`），
后者调 `finishProcessReality({ reset: true, glyphUndo: false, restoreCelestialState: true })`
（`glyph-core.js:759`）——这是一次**完整现实重置**：清空 EC 完成记录、时间定理（含整棵研究树）、
膨胀研究；而 `reset: true` 表示**不发奖励、`realities` 也不增加**（`reality.js` 只有 `!isReset` 才结算）。

证据（`web/_tools/_r40/r40a-fix.refunds.jsonl`，按 `finishProcessReality` 的调用者拆分）：

```
swapIntoActive 触发       3 次，t = 140.9 / 256.1 / 387.8 s
  同刻 realities 取值      15 / 20 / 25（事件前后不变 ⇒ 确为无收益重置）
经 beginProcessReality    5 次（真实现；树非空时才有 refund 记录）
可观测现实重置合计        8 次，其中 3 次来自本条
```

**修法**：`equipGlyphs()`（`oreki-reality-automation.js:288`）只保留「装空槽」这一条路径，
`freeSlot < 0` 时直接 `continue` 跳过，**不替换**。装空槽与原版手动点击等价，不触发任何重置。
RU9/16/17/18/24 的「恰好 N 个符文」形态要求改由 `_driveGlyphRequirements` 先卸再装空槽完成，不受影响。
**规则：这个代码库里 `Glyphs.equip()` 到已占用槽 = 静默丢一轮进度，永远只装空槽。** `[实测]`

## C.24 莱特拉熵速率公式：除数 `2e7`，反物质指数 **2e8 即满速 0.5/s**（R40 核对源码，推翻旧注释）

`src/core/celestials/laitela/laitela.js:82`：

```js
get entropyGainPerSecond() {
  return Math.clamp(Math.pow(Currency.antimatter.value.add(1).log10() / OREKI_LAITELA_ENTROPY_DIVISOR, 2), 0, 100) / 200;
}
```

`OREKI_LAITELA_ENTROPY_DIVISOR = 2e7`（`:30`）。因为外层有 `clamp(..., 0, 100)`，
`log10(AM) / 2e7 >= 10` ⇒ 即 **反物质指数 ≥ 2e8 就达到上限 0.5/s**（填满熵 2 秒）。

⚠ `laitela.js` 文件头注释里同时存在两个**历史**除数：原版硬编码 `1e11`、R38 早期候选 `5e8`
（注释原文「(amE/5e8)^2/200」）。当前生效的只有 `2e7`，别照旧注释的除数反推时间。

由此暴露的阈值错误：原 `LAT_RUN_MIN_AM_EXP = 1e10`（`oreki-endgame-automation.js:65`）
比满速点 2e8 **高 50 倍**，等于要求「远超满速」才肯开 run。实测（`web/_tools/_r40/r40a2-t1.jsonl`，2945 条 0.5 s 采样）：

```
全文件 laiTier 取值集合 = {0}      laiRun 为 true 的条数 = 0
IU15 之后 265 s 窗口（522 条）：amE >= 1e10 仅 2 条
```

⇒ 阈值几乎永不满足，莱特拉 run 一次都没起过、tier 恒 0，IU25 的 `maxAllowedDimension === 0` 无从谈起。
已改为 `4e8`（`:65`；推导写在 `:62-64` 的注释里）。

**「改成 4e8 之后 tier 能上 8」是 `[推断]`，尚未实测** —— 不要当已验证结论引用。
`[读码]`（公式）+ `[实测]`（阈值失效）／改后收益 `[推断]`

## C.25 Android 构建期红线守卫是**全文子串扫描**，smali 注释也会命中导致中止构建（R40 实测，第二次踩）

`build_mod.py:2028-2030` 的存档字段红线守卫不做语法分析，纯粹扫全文子串
（内部 `_ec_flatten_all()` 先把全文压平，让变异串与断言串同视图）。
smali 注释里只要出现下面任一字面量，就会被判「触碰存档字段」并中止构建：

```
completions
->F(I)V
PlayerEternityChallenges;->h(I)V
PlayerNormalChallenges;->n(I)V
PlayerInfinityChallenges;->i(I)V
```

修法只有一个：**改写注释的措辞**，例如写「不写解锁位 / 完成次数 / 当前关卡」，
而不是把真实标识符抄进注释。同类前科：R39 曾因注释写完整错误描述符导致扫描器误报。
本轮因这条真实中止过一次构建。
**规则：写 smali 注释时永不出现上述五个字面量；描述意图用中文散文，不抄标识符。** `[实测]`

## C.26 Android 底栏是**两行**结构、页签数随解锁进度变化，坐标一律现取（R40 实测）

`AGENTS.md §7.1` 记的「Android 底栏 12 项」是**槽位总数**，不是可见数；
`§7.3.2` 明确「永恒 / 现实 / 天神等入口**随阶段解锁隐藏属正常行为**」。

⚠ **具体坐标表在 `android/AD_Oreki_Edition_Android/AGENTS.md §3`**（不是工作区根那本）。
它写的是「主 tab **共 11 个**、中心 `y = 2142`、首项 `x = 48`、间距 98 ⇒ `x = 48 + 98*i`」，
并列出 11 个图标（立方体…通知，**没有天神**）。那张表**只对「12 个槽位全解锁」的存档成立**：
新档只显示 7 项时，按 `48+98*i` 点到的是空白 —— 本轮就是这么白跑了一整轮。
**R40 已在该文件 `:405-415` 补了限定块**（「本节的坐标表只在『12 个槽位全解锁』的存档上成立」
＋「`x = 48 + 98*i` 不是通用公式」＋ 要求点前用 `python tools/fo.py ui` 现取），与本节结论一致，**不用再改那份**。

**真实结构（frame-observer 取到的控件树）——底栏分两行**：

| 行 | 资源 id | bounds | 结构 |
|---|---|---|---|
| 主 tab 行 | `com.oreki.antimatterdimensions:id/mainTabLayout` | `0,2076,1080,2208` | `HorizontalScrollView`，**每个图标槽宽 ≈90 px**（实测相邻中心差 82~98，均值 90；1080/90 = 12 槽，与「12 项」吻合） |
| 副 tab 行 | `com.oreki.antimatterdimensions:id/secondaryTabLayout` | `0,2208,1080,2340` | 宽度**三等分**：`0,2208,360,2340` / `360,2208,720,2340` / `720,2208,1080,2340`，文本 **普通 / 无限 / 永恒** |

可见页签数随进度变化：**全新存档 7 个主图标**（实测中心 `475 / 565 / 653 / 750 / 835 / 933 / 1015`），
**后期存档 10 个主图标 + 3 个副页签**。

⇒ **`48 + 98*i` 只在「后期存档、11 项全显示」时成立，不能跨存档通用**（换进度就失效）。
硬证据：`reports/r40b/tmp/walk_report.json` —— 按 `48+98*i` 点的 11 个坐标
（48/146/244/…/1028，y=2142）**全部**返回同一段文本 `["云存档", …, "确定"]`，11 条完全相同。

**另一组「7 点坐标」其实不是主图标行（此前误当作矛盾）**：
`x ≈ 76 / 230 / 385 / 538 / 692 / 847 / 1000` 与
**`x = 1080*(2i+1)/(2*7)`**（= 77.1 / 231.4 / 385.7 / 540 / 694.3 / 848.6 / 1002.9）**逐个吻合，偏差 ≤1.4 px**
⇒ 那是**一行 7 等分**的容器（正是 `android/AGENTS.md §3` 的子 tab 等分公式，只是 N=7），
而主 tab 图标行是 `HorizontalScrollView` + 固定 90 px 槽、左对齐，两者**不是同一行**。
所以「槽宽 90」与「间距 154」并不冲突，是被量了不同的行 —— **但结论不变：主行不能写死坐标**。
**注：这 7 个槽位值来自单次夹具，仅作参考，不要拿去当通用坐标。**

> 顺带说明：`android/AGENTS.md §3` 里的**子 tab 等分公式 `x = 1080*(2i+1)/(2N)` 是正确的**，
> 上面已被 7 等分实测再次验证，**不要把它跟主 tab 的 `48+98i` 一起废掉**。
> 错的只是「主 tab 固定 11 项、固定间距」这一半。 `[实测]`+`[推断]`（7 等分归属为推断）

**规则：点页签前必须先取控件树现算坐标**，首选 `tools/fo.py ui`（见 F.5），
取 `mainTabLayout` / `secondaryTabLayout` 的子节点按 `x` 排序后点中心；
`uiautomator dump` 只作静止页兜底。参考实现：`reports/r40b/tmp/walk2.py`。 `[实测]`

## C.27 首启会连续弹多个简体中文模态弹窗，不逐个关掉则后续所有 `input tap` 全被吞（R40 实测）

全新安装首启的弹窗序列（每个都有一个「确定」按钮）：

```
云存档（默认禁用） → 反作弊系统 → 语言（中文(简体)）
```

不逐个点掉「确定」，后面所有 `input tap` 都会被最上层的模态吃掉 —— 点击事件确实发出去了，
但落在弹窗按钮上，页面完全不切。本轮因此**白跑了一整轮 11 页遍历**。

证据：

- `reports/r40b/tmp/walk_report.json`：11 次点击、11 次都读到 `云存档` 弹窗文本，
  `n_nodes=4`（标题 / 描述 / 启用按钮 / 确定），页面正文一次都没出现；
- `reports/r40b/tmp/fo_state.json`：语言弹窗 `titleText="语言"`、spinner 值 `中文 (简体)`、
  `确定` 按钮 `bounds=[844,1421][1020,1570]`、中心 `[932,1495]`；
- `reports/r40b/tmp/first_run_dialogs.json` = `["语言","语言","语言"]`（语言弹窗被记录到 3 次）。

**规则：任何 Android 自动化在第一次 `tap` 之前，必须先 dump 一次并循环点掉
`text=="确定"` 的节点直到没有模态，再开始做事。** `[实测]`

## C.28 Android EC12 三夹具都能自动完成并真实结算；但两个「修复分支」都没被触发（R40 实测 + 未验证）

权威出处：`android/AD_Oreki_Edition_Android/reports/r40b/R40B-Android-验收.md`（本节与它冲突时以它为准）。

### C.28.1 唯一可以写「已实测」的结论

**EC12 完成次数在 B1/B2/B3 三个夹具下都从 `0` 变 `5`，且走了真实的永恒重置，不是写完成位。**

| 场景 | 夹具改动 | EC12 | eternities | infinities | studies 条数 |
|---|---|---|---|---|---|
| B1 入口+结算 | `completions[11]=0`、`unlocked=0`、`current=0`；含 233、不含 71/72 | **0 → 5** | 1.32e431 → 4.64e435（**×3500**） | 1.07e960 → 1.07e970 | 58 → 58 |
| B2 互斥分叉 | 同 B1，但**保留** 71/72 | **0 → 5** | ×约 1700 | +6.8e969 | 60 → 60（**71 仍在**） |
| B3 前置缺失 | 同 B1，但**去掉** 233/234 | **0 → 5** | ×约 1700 | +6.7e969 | 56 → 56（**233 始终不在**） |

- B1 用时约 **42 s**（5 s 采样，首次出现 5 在 t≈42.2 s）。
- 判「真实结算」的依据：三个场景 `eternities` 都涨了 1700~3500 倍、`infinities` 涨 9~10 个数量级
  —— 每关完成都要走一次真实永恒重置，这个量级不可能来自写完成位。
- APK：`090b9adb…f43`；`logcat` 过滤 `FATAL / VerifyError / AndroidRuntime / ANR in / NoSuchMethod / NoClassDef`
  命中 5 行**全是 `monkey` 自己的 `RuntimeInit` 启动日志**，无一条来自游戏进程。 `[实测]`

### C.28.2 必须标「未验证」的三条（不要写成通过）

1. **「`forbiddenStudies` 冲突 → respec 到 73」= 【未验证】**。
   B2 保留了 71/72，跑完 `studies` 仍 60 条、**71 仍在树上** ⇒ 那条分支**本轮根本没触发**，
   既不能证真也不能证伪。
2. **「`purchaseUntil` 补齐前置」= 【未验证】**。
   B3 去掉 233/234 后 EC12 照样 0→5，但**跑完树上仍然没有 233** ⇒ 机制不明。
   候选解释（`[推断]`）：①`purchaseUntil` 买了整链，EC 跑完又被原版 respec 重建回 56 条；
   ②原版进 EC 的路径并不真的校验 233（门槛在别处）；③别的路径绕过前置。
   要证伪需在 `purchaseUntil` 那行前打临时日志，或 EC 运行期高频抓 `player.timestudy.studies`。列为 R41 待办。
3. **「`unlocked` 的瞬时值」= 【未确认】**。1 s 高频采样 90 次都没抓到 `unlocked=12`，
   只有 3 s 一次的落盘 ⇒ EC 单次运行短于采样粒度，无法据 `unlocked` 判断进入瞬间。

### C.28.3 判定陷阱（今天差点误判成失败的地方）

`unlocked` 跑完**回到 0 是正常的**：`Eternity.reset()` 每次都把 `challenge.eternity.unlocked` 清零。
`challenge.eternity.unlocked` 的语义是「**当前唯一解锁的那一关的 id**」，`0` = 一关都没解锁
（`EternityChallenge.isUnlocked` = `unlocked === this.id`，`src/core/eternity-challenge.js:54`）。

⇒ **两个后果都必须记住**：
- **测「能不能进 EC」不能拿 `completions` 全 5 但 `unlocked=0` 的存档直接跑** —— 那是自相矛盾的夹具，
  必然得到「一关都进不去」，会被误判成产品缺陷。必须按场景重造夹具。
- **判 EC 有没有真跑过要看 `completions` 或 `eternities`，不要看 `unlocked`。** `[实测]`

## C.29 R40B 构建产物指纹与构建期自测（R40 实测）

| 项 | 值 |
|---|---|
| 产物 | `android/AD_Oreki_Edition_Android/release/反物质维度.apk` |
| SHA-256 | `090b9adbd0b4f8ad0a1b799d151c11e6af207ea93c55e13ea40441ba67d69f43` |
| 体积 | 66.5 MiB |
| 签名 | v2 = true / v3 = true（v1 = false），`CN=AD Oreki Edition, OU=Personal Mod, O=Oreki`，证书 SHA-256 `95960bce…19d7` |
| 构建日志 | `android/AD_Oreki_Edition_Android/build/r40b_rebuild.log`（19:11，`EXIT=0`） |
| EC 链断言 | 日志 `:124`「EC 链条断言通过：purchaseUntil 已接线（真实 continuation）、互斥分叉走原版 respec（6 s 冷却 / 32 次上限）、无存档字段写入」 |

**「11/11 变异自测」的口径**：`R40B-Android-验收.md` 头部记
`OREKI_EC_SELFTEST=1 python scripts/build_mod.py` ⇒ 变异自测 **11/11 全部拦下**。
**注意**：`build/r40b_rebuild.log` 那次是**不带**该环境变量跑的，所以只打印「EC 链条断言通过」、不打印计数
（报告另一处还存在一个旧的 8/8）。要现证 11/11，就按上面那条命令重跑一次再引用。

**注意**：`R40B-Android-EC.md` 正文仍写着「未跑 Gradle」，与 19:11 这次全量重建**口径冲突**，
以 `build/r40b_rebuild.log` 与产物为准（该报告写于 19:05，早于重建）。 `[实测]`

## C.30 Android 12 个页面全部有内容、0 空白页、无软锁（R40 实测）

用 `fo.py ui` **现取**底栏可点槽位（**不硬编码坐标**）逐个点进去读标题，12 个不同页面全部渲染出内容：

| # | 页签 | 文本节点 | # | 页签 | 文本节点 |
|---|---|---|---|---|---|
| 1 | 无限维度 | 56 | 7 | 天神地图 | 19 |
| 2 | 自动购买器 | 110 | 8 | 成就 | 18 |
| 3 | 无限升级 | 42 | 9 | 统计数据 | 50 |
| 4 | 时间研究 | 113 | 10 | 选项 | 66 |
| 5 | 符文 | 75 | 11 | 商店 | 65 |
| 6 | 复兴树 | 69 | 12 | 游戏帮助 | 56 |

**0 个空白页**，逐页切换后无软锁、无 ANR。
注：点到的可点槽位有 23 个（tab 内部还有嵌套可点节点，多点几次仍停在同一 tab），去重后是 12 个页面。

**这 12 个标题是从主行 12 个槽位（`id/mainTabLayout`，槽宽 90）逐个点出来的**；
坐标结构见 **C.26**（主行槽宽 90、副行 `id/secondaryTabLayout` 三等分）。
**不要用 `48 + 98*i` 反推**——那只对「12 槽位全解锁」的存档成立。

**这条只证明「导航不坏」，不证明「IC1 本体正常」** —— IC1 的即时完成与奖励结算本轮未单独跑，
标 `[部分实测]`。 `[实测]`

## C.31 佩勒（毁灭现实）的 `player.break` 死锁：反物质夹在 1.8e308，`endState` 封顶 0.75（R40 实测 + 读码）

**现象**：`r40a3-fix2`（900 s）在 t=714.1 s 进入毁灭态后，`endState` 恒 `0.7505`，
从 714.1 s 到 899.5 s 共 371 条采样**零变化**；`isGameEnd` 始终 false；`amE`（`log10(反物质)`）恒 **308**。
同期 `AD1.productionPerSecond` 仍是 1e9 量级、`_lastError` 全程空、`_lastDoomBuyMs` 每 ≤100 ms 刷新
⇒ **自动化在跑，产量在算，只是每帧被丢掉**。`[实测]`

**完整链（每一环都能对到行号）**：

| # | 事实 | 出处 |
|---|---|---|
| ① | 进入毁灭态 → `Pelle.initializeRun()` → `armageddon(false)` → `finishProcessReality({reset:true})` → `player.break = false` | `pelle.js:83 / :155`、`reality.js:633` |
| ② | **原版唯一**能把 break 再次打开的逻辑路径：`isDoomed && keepAutobuyers.canBeApplied && hasMaxedInterval` ⇒ `break = true` | `reality.js:749-752`（官方 upstream 逐字相同） |
| ③ | `keepAutobuyers` = Pelle 升级 id 2，代价 **5e6 遗迹碎片**，货币来自**末日（Armageddon）** | `secret-formula/celestials/pelle-upgrades.js:73-78` |
| ④ | 本作 `tryOpenBreakInfinityGate()` 带 `&& !Pelle.isDoomed`（**该函数官方不存在**，整段是 MOD 加的） | `game.js:203-215` |
| ⑤ | 本作 `driveDoomed()` 只做 maxAll / 维度提升 / 星系 / 买佩勒升级，**从不调 `Pelle.armageddon`、从不请求现实** ⇒ ②一次都不执行 | `oreki-endgame-automation.js:440-470` |
| ⑥ | `_stopDoomedResets()` 每帧把大坍缩与永恒自动器关掉 | `oreki-endgame-automation.js:472-486` |
| ⑦ | 无 break 时维度 tick 直接 `return`，并把反物质 `dropTo(1.7976931348623157e308)`；单帧产量上限 `DC.E315` | `antimatter-dimension.js:663 / :682 / :580-586 / :609` |
| ⑧ | **进入毁灭态时 `hasMaxedInterval` 也是 false**：`Autobuyer.unlock()` 在 `!keepAutobuyers.canBeApplied` 时把间隔重置回默认值 | `autobuyer.js:184-188` |
| ⑨ | 毁灭态初值 `remnants = 0`、`realityShards = 0` ⇒ `realityShardGainPerSecond = (10^(4·r^(1/7.5))−1)/1000 = 0` | `pelle.js` 初值 + `realityShards` 公式 |

⇒ **「只去掉 `&& !Pelle.isDoomed` 守卫」是无效修法**：`breakInfinity()` 第一行
`if (!Autobuyer.bigCrunch.hasMaxedInterval) return;` 会直接返回，而 ⑧ 保证那时它一定是 false。
必须先走末日循环把 `keepAutobuyers` 买下来，间隔才可能被拉满。**这条是 R40 晚间被实测推翻的第一次尝试，写在这里防止再犯。**

**数值自洽**：`endState = 0.7505` 反解 ⇒ `records.totalAntimatter ≈ 1e316.2`，与 ⑦ 的 `E315` 封顶同量级。
而 `OREKI_PELLE_END_TARGET_EXP = 1e3` 要求 `E = 1000` ⇒ **差 684 个数量级**。

**这不是「数值墙」，也不是「目标定太高」**：
原版 `game-end.js` 的分母是 `log10(9e15) - 8.7`，过线点在指数 **9e15**，比本作的 1e3 高 12 个数量级
⇒ **原版毁灭态必然能突破 1.8e308，否则官方自己也通不了关**。
所以病根在「自动化没走完原版那条路」，把 `OREKI_PELLE_END_TARGET_EXP` 下调是篡改通关定义，禁止。

**真正的错在策略，不在参数**：`_stopDoomedResets()` 当初是为了「别把反物质清零」，
但它同时掐断了「拿遗迹碎片换 `keepAutobuyers`」的唯一途径 ⇒ break 永远回不来。
R38-M 记的「反物质峰值被大摁在 e316」正是这条策略的产物，不是另一个独立 bug。

> **规则：毁灭态的正确推进序列 = 反复末日拿遗迹碎片 → 买 `keepAutobuyers`(5e6) → 下一次现实重置自动恢复 break → 反物质才能突破 1.8e308。任何「不重置只囤产量」的写法都是死路。** `[实测]`（现象）+ `[读码]`（链）

## C.32 Steam 社区攻略抓取：App ID 是 **1399720**，不是 1391520（R40 实测，两人各踩一次）

- `store.steampowered.com/api/appdetails?appids=1391520` → `{"success":false}`；
  `steamcommunity.com/actions/SearchApps/Antimatter%20Dimensions` → `{"appid":"1399720"}`。
- `/app/1391520/guides/` **302 到商店首页**（返回「Welcome to Steam」）——这一步极容易被误判成「被墙 / 地区限制」。
- `/app/1399720/guides/` **200 / 91,729 字节 / `View All (29)`**，卡片带 `data-appid="1399720"` 与 `data-publishedfileid`，可直接正则抠 ID + 标题。
- 需要代理：`export https_proxy=http://127.0.0.1:7897 http_proxy=http://127.0.0.1:7897`。

**抓取四个坑**：

1. 连续请求会 **429**，必须退避重试；带登录 cookie 更稳（**但绝不能把 cookie 文件落进仓库**，本轮已误留过一次 `sc.jar`）；
2. 单篇直连 `sharedfiles/filedetails/?id=<ID>&l=schinese` 可用；正文结构是 `div.guide.subSections` → `div.subSectionTitle` + `div.subSectionDesc`；
3. Steam 表格是 **`div.bb_table` 不是 `<table>`**，不特殊处理会「一格一行」；
4. 英文长文原典不在 Steam，在 fandom 的 `Guide` 页（网页 403，走 `api.php?action=query&prop=revisions&rvslots=main&titles=Guide` 可取），256,224 字符 / 106 个标题，写到终局。

**已落盘规模**（`web/_tools/_r40/`）：`steam_guides/` 12 篇中文/英文攻略 ≈ **149,234 汉字**；
`ref_guides/wiki_guide.wiki` 为英文原典。索引与「哪个是权威」见 `steam_guides/MANIFEST.md`。
**攻略数值一律不可直接采信**（终局、V 解锁、IU15、现实解锁全部与本项目不同），数值必须回 `src/` 核对。 `[实测]`

## C.33 膨胀研究 DS1：门槛 12900 不缩放，窗口内只花 5 TT `[源码核对 + 实测]`

**这条是为纠正一个我自己写错的结论而记的**（2026-10-30 晚，team-lead 提出「DS1 ÷1000 = 13 时间之理」，
被 agent-e 用源码反证，我复核后确认对方正确）。

| 项 | 值 | 出处 |
|---|---|---|
| DS1 原版成本 | 5000 TT | `secret-formula/eternity/time-studies/dilation-time-studies.js:6` |
| 窗口内实际支付 | **5 TT**（`floor(5000/1000)`） | `time-studies/dilation-time-study.js:9,48-51` |
| 解锁门槛 | **12900 TT，不参与任何缩放** | `dilation-time-study.js:54-56`（`return this.id === 1 ? 12900 : 0`） |
| 门槛判定读的是 | `Currency.timeTheorems.max`（历史最高，不是余额） | `dilation-time-studies.js:8` |
| 探针实测 | `ttNeed` 恒 12900；`ttMaxL` 最高 6.90（≈8e6） | `web/_tools/_r36d/_r36d-dil-*.jsonl` |

**两个容易混的数**：
- `12900 / 1000 = 12.9` → `floor` 得 **12**，不是 13。用除法反推门槛会得到错数。
- **13 是 EC2 的入口资源**（`1300 / 100 = 13`，`ec-time-study.js:119-125`），属于 ch09，与膨胀无关。
  我在提要求时把这两个数串了，`FACTS` 记在此处防止再串。

**正确写法**：「累计 12900 时间之理的门槛不变，进入引导窗口后**只花 5 时间之理**」。

### C.33.1 DS1 是三段与，只写门槛会让玩家「数够了但按钮是灰的」

`secret-formula/eternity/time-studies/dilation-time-studies.js:6-18`：

```
Currency.timeTheorems.max >= 12900       // 历史最大值 max，不是当前余额
&& [231, 232, 233, 234].some(isBought)   // 至少买一个
&& EternityChallenge(11) 与 (12) 各 5 次全满   // Perk.bypassECDilation 可免
```

第一版只写了门槛，这是残缺的：玩家照着做没反应，只会以为教程写错了。**所有「解锁条件」都要回源码看
`requirement()` 的完整布尔式，不要只抄其中一个比较式。**

### C.33.2 更正一条我自己写错的过度概括：缩放**不**只作用于 cost

C.33 初版我写了「本项目三处 MOD 缩放每一处只作用于 cost，不作用于 requirement」——**这条是错的**，
已被实测推翻，此处明确更正，防止后来者拿它当依据：

| 缩放 | 作用对象 | 是否碰 requirement |
|---|---|---|
| `OREKI_DILATION_TT_DIVISOR = 1000` | 膨胀研究**售价**（`dilation-time-study.js:48-51`） | **不碰**：DS1 门槛 12900 原样 |
| EC 入口 `÷100`（`ec-time-study.js:119-125`） | EC 的**入口资源要求**（`secondary.required`） | **会碰**：EC1 20000 次永恒 → 窗口内 **200**；EC2 1300 计数频率升级 → **13**；EC3 17300 第八维度 → **173** |

⇒ 正确的提法是：**每个缩放系数的适用范围必须逐处读源码确认，不能用一句话概括。**
「成本 / 门槛 / 入口资源要求」是三个不同的东西，同一份 MOD 里缩放可能只碰其中一个、也可能碰两个。

## C.34 双端自动化规模实测：行数**不支持**「Android 落后」，缺口必须按能力逐项核对 `[实测]`（本节含一次自我更正）

> **更正声明（2026-10-31）**：本节初版（23:50）写着「Web 12 个模块 2,962 行 vs Android 2 个类
> 1,834 行」，并据此断言「差距远大于预期」。**这个结论和数字都是错的**，由 agent-b 独立核对后驳回，
> 我复核确认。错误原因见第三节，结论见第五节。保留原文错误说明，是为了防止后人再按同样方法
> 重新得出同样错的结论。

### 一、Web 侧实测清单（12 个机制模块，4,198 行）

统计口径：`src/core/oreki-*.js` 中**参与自动化的模块**，排除教程（`oreki-tutorial*.js`）、
生成物（`*.gen.js`）、探针（`*-probe.js`）、工具（`oreki-tools.js`）。

| 模块 | 行数 |
|---|---:|
| `oreki-celestial-automation.js` | 817 |
| `oreki-eternity-automation.js` | 758 |
| `oreki-endgame-automation.js` | 692 |
| `oreki-reality-automation.js` | 473 |
| `oreki-dilation-automation.js` | 458 |
| `oreki-iu15-sprint.js` | 293 |
| `oreki-instant-challenges.js` | 225 |
| `oreki-early-automation.js` | 199 |
| `oreki-break-infinity-gate.js` | 127 |
| `oreki-keep-antimatter.js` | 77 |
| `oreki-bootstrap.js` | 47 |
| `oreki-autobuy-break-infinity.js` | 32 |
| **合计** | **4,198** |

### 二、Android 侧实测清单（13 个文件，5,808 行）

统计口径：`work/mod/smali/kajfosz/antimatterdimensions/` 下**包根 + `oreki/` 子包**的
`Oreki*.smali` 与 `oreki/*.smali`。`scripts/payload/` 是同一份的镜像，不重复计数。

**机制类（9 个，5,166 行）**

| 文件 | 行数 | 位置 |
|---|---:|---|
| `OrekiSpeed.smali` | 1,321 | 包根 |
| `oreki/StageAssist.smali` | 1,394 | `oreki/` |
| `OrekiChallengeAuto.smali` | 862 | 包根 |
| `oreki/OrekiStageAuto.smali` | 440 | `oreki/` |
| `OrekiAuto.smali` | 381 | 包根 |
| `OrekiInstantChallenge.smali` | 304 | 包根 |
| `oreki/AchievementUnlocker.smali` | 188 | `oreki/` |
| `oreki/OrekiSpeedModeListener.smali` | 100 | `oreki/` |
| `OrekiEcContinuation.smali` | 98 | 包根 |
| `OrekiTrace.smali` | 78 | 包根 |

**界面类（4 个，642 行）**：`oreki/SpeedSettingsActivity.smali` 336、`oreki/SettingsClickListener.smali` 253、
`oreki/StageConfirmListener.smali` 53 —— 不计入机制对比。

⇒ **Android 机制代码 5,166 行 > Web 4,198 行。** 按规模，Android 不落后，反而更多。

### 三、初版错在哪（方法学，比结论更重要）

**错误 1：只扫了 `oreki/` 子包，漏掉包根。**
初版断言「Android 机制类只有 2 个」。实际包根还有 4 个主要机制类
（`OrekiSpeed` 1,321 行、`OrekiChallengeAuto` 862 行、`OrekiAuto` 381 行、
`OrekiInstantChallenge` 304 行），占了 Android 机制代码的一半以上。
`find . -name "Oreki*.smali"` 一条命令就能避免，我却按子包路径去数。

**错误 2：把行数当能力。**
即使数字没错，用「行数少」推「功能没跟上」也是无效推理。行数少可能是实现更紧凑
（smali 里一个方法体比 JS 长得多，同功能行数本来就不可比）。

**错误 3：结论用词过强。**
我写的是「成立且差距远大于预期」。当时手里只有关键词 0 命中，那只能支持「未找到」。

### 四、关键词覆盖探测（结果保留，但**不能**当缺失证据）

限定 `Oreki*.smali` + `oreki/*.smali`，统计提及文件数：

| 关键词 | 提及文件数 |
|---|---:|
| `replicanti` / `Replicanti` | 0 / 0 |
| `sacrifice` / `Sacrifice` | 0 / 0 |
| `eternityChall` | 0 |
| `instantChallenge` | 0 |
| `dilation` | 1 |
| `realityUpgrade` | 1 |

**这张表最典型的一行是 `instantChallenge : 0`——而 `OrekiInstantChallenge.smali` 就存在，304 行。**
原因：smali 里的引用是 `Lkajfosz/antimatterdimensions/OrekiInstantChallenge;`，方法名多半已被混淆，
不会出现 `instantChallenge` 这个 camelCase 串。**关键词 0 命中甚至不能证明「没这个名字」，更别说「没这个功能」。**

至此已累积 **三个** 反例，全部是「按 Web 名字搜 Android，0 命中但功能存在」：

| 按 Web 名搜索 | 在 Android 的实际形态 | 结果 |
|---|---|---|
| `player.break` | `Player.brake:Z`（键仍是 `"break"`，setter `x0(Z)V` @11107，getter `m()Z` @10746） | 0 命中，功能存在 |
| `Pelle` | 混淆类 `.../pelle/c` | 0 命中，功能存在 |
| `instantChallenge` | `OrekiInstantChallenge.smali`（类名在，方法体不出现该串） | 0 命中，类存在 |

⇒ **规则：关键词 0 命中只能记为「未找到」。** 要断言「确认缺失」，必须给出反证：
该阶段 tick 的调用链里只有 A/B/C 三个动作、没有目标动作的调用点，并贴调用链原文。
三态记法固定为 **已有 / 确认缺失 / 未知**，禁止把「未知」写成「缺失」。

### 五、修正后的真实结论

1. **规模上 Android 不落后**（5,166 vs 4,198 行），「Android 前期中期没跟上」**不能由行数证明**。
2. **能力覆盖仍是未知**。已知 Android 有 `OrekiSpeed` / `OrekiChallengeAuto` / `OrekiAuto` /
   `OrekiInstantChallenge` / `StageAssist` / `OrekiStageAuto` 六个自动层，但**具体覆盖到哪一步、
   哪一步只做了一半，没有逐项核对过**。这才是真正待办的事。
3. **已验证（原「待查风险」已关闭）**：`oreki/AchievementUnlocker.smali`（188 行）是**死代码**——
   `requestStage(I)V` 方法体只有 `return-void`、`unlockStage(I)I` 返回 `-0x3`，
   运行时引用数 0（`build_mod.py:1098-1106` 有 `au_refs == 0` 断言自卫）。
   依赖它的 `scripts/verify_row18.py` 本身已坏（找不到 `:s1..:s8` 标签），不能当保留理由。
   ⇒ 定案删除，作为独立的纯删除改动提交，不夹进功能轮。

4. **同一个类里真正危险的是 `StageAssist.unlockRows()`（必须单列）**
   它调 `achievements/a;->E(ZZ)V`（`:718`），而 `E()` 第一句 `if (A()) return;`，
   `A()`（`:482`）**只读「是否已解锁」的 BitSet，不求值任何条件**，随后直接置位。
   ⇒ **这是绕过原版条件强制写完成位**，性质等同「伪造完成位」。
   成就是 Reality 解锁的唯一剩余闸门（C.33），所以它能直接跳过主线。
   触发链唯一入口是 `StageConfirmListener` 的人工对话框确认（全树 1 处），
   `pending` 无人工确认时恒空 ⇒ 自动化路径不会碰它（已用调用链证明，非 grep）。
   处置：不删（已有功能不回退），改为「默认关 + 使用写永久标记 + 验收三层拒判」，见 C.36。

## C.36 助战面板（StageAssist）的三条硬约束与验收拒判规则 `[定案]`

`StageAssist.unlockRows()` 能绕过成就条件直接置位（见 C.34 第 4 条）。保留功能，但必须：

### 一、三条硬约束（缺一不可）

1. **默认关闭**，`oreki_prefs` 里默认 `false`，须玩家显式开启。
2. **使用留痕**：调用过 `unlockRows` 就写一个**独立键**（`stage_assist_used`），
   不复用队列键 `stage_assist`（那个会被 `clearFlag()` 清掉，留不住痕）。
3. **自动化永不调用**：`StageAssist;->request` 全树只有 `StageConfirmListener.smali:32`
   一个调用点，而它是 `DialogInterface$OnClickListener`，`onClick` 只能由按钮触发
   ⇒ 无人确认时 `pending` 恒空，`onTick` 不会进 `run()`。

### 二、现有文案是假的，必须一起改

`dialogMessage0`（`StageAssist.smali:1008-1143`）三处都写「写入走原版解锁流程，不可撤销」，
但 `E(ZZ)` **恰恰不校验条件**；按钮还写「确认点亮」（`SettingsClickListener:211`）。
⇒ 文案必须改为明说「跳过真实条件、会写永久标记、该存档将无法用于真实通关验收」。

### 三、验收拒判：三层，第三层不依赖标记

| 层 | 做法 | 强度 |
|---|---|---|
| L1 | `pm clear` 全新档，贴命令与输出 | 弱（只证明这次是新开） |
| L2 | 读 `stage_assist_used` 标记 | 中（标记可被清） |
| L3 | **逐位重算全部成就** | 强（不依赖任何标记） |

L3 原理：原版 `achievements/a;->D(Z)V`（`:650-716`）本身就是「求条件 → 真才解锁」，
谓词存在字段 `k:Lui1`（null 视为 true）。验收脚本对每个已解锁位比对
`A()`（BitSet 说已解锁）与 `k.invoke()`（条件重算结果）：
**`A()==true && k()==false` ⇒ 该位是被强制置位的**。只读、不写档、覆盖全部 104 位。

⇒ 规则：**任何 Android 通关验收，L3 必须跑，且结果必须为 0 处不一致。** 只跑 L1/L2 不算过。

> **更正记录：这条「必须 0 处不一致」是不可达到的判据，实测已被证伪。**
>
> AVD 全新档（`pm clear`，**一次「强制点亮」都没用过**、`stage_assist_used = 0`）：
> L3 报 **17 处不一致**，`used=0`，**零次 FORCE 记录**。
>
> 原因：**成就条件是「一度满足」的历史事件，谓词不幂等。**
> 例：成就 55「1 分钟内完成一次无限」——解锁当时成立，之后永远为假。
> `A()==true && k()==false` 因此在**干净档上也必然大量出现**，
> 它证明不了「被强制置位」，只能证明「条件是过去式的」。
>
> ⇒ 正确的 L3 必须拆成**两级**，判死级与观察级分离：
>
> | 级 | 判据 | 性质 |
> |---|---|---|
> | **闸门级（判死）** | 在 `achievements/a;->E(ZZ)V`（强制解锁入口，`E` 不查条件）插 `OREKI_FORCE: id=<n>` 日志；**FORCE 集合必须为空，除非 `stage_assist_used=1`** | 可判死，不依赖谓词幂等 |
> | **观察级（不判死）** | `A()==true && k()==false` 的集合与数量，只报告不置否定 | 含历史漂移，不能当缺陷 |
>
> 另：位图范围是 **144**（`z3.c` 18×8），不是 104。原口径少扫 40 位。
>
> ⇒ 方法学：**「比对两个状态」的断言，必须先证明两个状态测的是同一时刻的同一件事。**
> 拿「当前条件」去对「历史结果」，是跨时间比较，必然假阳。
> 这类断言的特征是：**在干净的样本上就会失败** —— 所以判据写完后，
> 第一步应该拿「已知无缺陷」的样本跑一遍，跑不过就是判据错了，不是产品错了。

### 六、由此产生的排期变更（结论未变，但理由换了）

佩勒破无限循环**暂缓**，Android 先做前中期**能力逐项核对**（不是「补」——补什么还没确定）。
理由不是「Android 落后」，而是：Android 若走不到佩勒门口，打通最后一道门没有意义；
而走到哪一步、卡在哪个机制，现在**只有猜测没有证据**。

### 七、更正：本轮的验收判据自己报假红

> **更正记录：C.36 相关的两条判据按字面必然 FAIL，不是故障。** `[实测 + 读码]`
>
> **判据一：「300 s 内教程章节标题不变」。**
> 按字面必然 FAIL —— `OrekiTutorialModal.update()`（`:175-190`）就是**设计成跟阶段自动跳章**：
> 每 15 帧取一次 `getTutorialStageSnapshot()`，阶段签名一变就 `index = getTutorialStartIndex()`。
> 实测跳变序列 7 → 11 → 13，与 `eternity → reality → celestials` 一一对应。
> 这不是故障，是设计行为。
>
> **判据二：「20 现实时的 `totAML`」。**
> 按字面**不可求值**：`player.celestials.pelle.records.totalAntimatter` 只有进毁灭后才有值
> （`src/core/celestials/pelle/pelle.js:260` 才第一次赋值 `1e180000`）。
> 两组和基线都到 **t ≈ 660~675 s** 才非空，所以「20 现实时」这个采样点根本读不到它。
>
> ⇒ 方法学：**判据必须能区分「设计行为」与「故障」。**
> 判不出来的判据会自己报假红，比没有判据更坏 —— 它会训练人忽略红色。
>
> 替代口径（两条）：
>
> 1. 标题**必须与当前阶段匹配**，而不是「不许变」。
>    映射来自 `oreki-tutorial-data.json` 的 `stageKey` + `oreki-tutorial.js:294-318` 的
>    `getTutorialStartIndex()`。注意 `early` 与 `infinity` 两段**不是**固定首章：
>
>    | 阶段 `stageKey` | 定位规则（读码自 `getTutorialStartIndex()`） | 可能落在 |
>    |---|---|---|
>    | `early` | `galaxies ≥ 1` → ch03；`dimensionBoosts ≥ 1` → ch02；否则 ch01 | ch01~ch03 |
>    | `infinity` | `!player.break` → ch04；`break` 且 IP 指数 < 11 → ch05；否则 ch06 | ch04~ch06 |
>    | `eternity` | 该阶段首章 | ch07（覆盖 ch07~ch10） |
>    | `reality` | 该阶段首章 | ch11（覆盖 ch11~ch12） |
>    | `celestials` | 该阶段首章 | ch13（覆盖 ch13~ch15） |
>    | `doomed` | 该阶段首章 | ch16 |
>    | `stageKey` 为 null | ch00（导览章）、ch17（总结章）不参与定位 | — |
>
>    判据写法：`当前章 index` 落在该 `stageKey` 的「可能落在」区间内，且区间端点由数据算、
>    不写死章号；`eternity` 及以上必须精确等于首章（走的是 `firstChapterIndexByStage` 的 fallback）。
>
> 2. 进度用「**N 个现实的到达时刻**」而不是 `totAML` —— 前者全程可读，后者只在毁灭后存在。


---

## C.35 Web 端从全新存档真实通关：`gameEnd` 首次为真 = 708.1 s `[实测]`

2026-10-31，原始数据 `web/_tools/_r40/r40s1-full.jsonl`（892 条逐秒采样，跑满 900 s）。
**这条是「180 分钟真实通关」在 Web 侧的第一个可核验证据**，判据只看「首次过线」那一刻。

### 一、过线瞬间（逐条对照，不是取最大值）

| t | gameEnd | endState | totAML | amE |
|---|---|---|---|---|
| 707.1 | false | 0.99075 | 958.248 | 750 |
| **708.1** | **true** | **1.028735** | **1032.015** | **1031** |

`gameEnd` 全程**只翻转 1 次**，之后 191 条采样全部为 true，**从未回退**。
前一段 `totAML=958`、后一段 `1032`，跨过 1000 的判据线（见 C.31 的 `OREKI_PELLE_END_TARGET_EXP`），
`endState` 0.99 → 1.03 与之同帧。

### 二、墙钟分段

| 段 | 时刻 |
|---|---|
| 0 → 进毁灭（`doomed=true`） | 662.2 s |
| 进毁灭 → `gameEnd` | 46 s |
| **合计** | **708.1 s ≈ 11.8 min** |

参考判据是 180 min（10,800 s），**余量约 15 倍**。

### 三、起点是全新存档（从数据判，不是听报告）

t=0.1 的现场值：`amE=21`、`totAM=0`、`realities=0`、`bcUnl=false`、`ivl=150000`、`strike=false`。
与全新档一致；若是续档，`totAM` 与 `bcUnl` 不会同时是这个状态。

### 四、一个必须更正的口径：`player.break` 有两条来源

本次跑的 `brk` 变化**5 次**（3 次 false→true、2 次 true→false），不止末日那一次。
自行重算命令（不许采信报告，我按 `r40s1-full.jsonl` 892 条逐条比相邻帧数的）：

```
node -e '逐条比 r.brk 与上一帧，变化即记' → brk 翻转次数: 5
首次 gameEnd true: {"t":708.1,"endState":1.028735,"totAML":1032.015}
```

> 更正记录：本条初版写「**4 次**」，但同一节的表里列了 5 行——正文与自己的表对不上。
> 由 agent-a 指出（它把 5 次连行号一起列了出来），我复核确认为 5 次。

| t | brk | 阶段 | 判定 |
|---|---|---|---|
| 0.1 → 4.1 | false→true | idle | **自动买 Break Infinity 升级**（`ivl 150000→100`、`bcUnl false→true`） |
| 4.1 → 68.1 | true→false | idle | **现实重置**（同帧 `realities 0→5`）。初版标「永恒重置」是错的，见下 |
| 68.1 → 72.1 | false→true | idle | 再次买到（`ipL=25.7`、`ivl=100`） |
| 72.1 → 662.2 | true→false | wait-remnants | 末日（现实重置清 break） |
| 662.2 → 706.1 | false→true | broken | **这一次才是 `finishProcessReality` 置真**（C.31） |

⇒ 正确表述：**早期靠买升级，末日路径靠 `finishProcessReality` 置真。**
此前「`break` 只能由 `finishProcessReality` 置真」是过度概括，会让 Android 侧误以为
break 只能从末日拿到，从而漏掉「间隔拉满后应该自动买 break」这一步。

**第二处更正（我自己查出来的）：68.1 s 那次不是「永恒重置」，是「现实重置」。**

判据：同帧 `realities` 从 `0` 跳到 `5`，而永恒重置不会产生现实数。
另外 t=6.1 就做了永恒（见 §五），而 t=60.1 时 `brk` 仍是 `true`
—— 说明永恒重置**根本不清** `player.break`（Break Infinity 是无限层升级，跨永恒保留）。
所以能清它的只有现实及以上。

⇒ 结论：`brk` 的 true→false 只有两种成因——**现实重置**、**末日重置**。
写「永恒重置清 break」是错的，会让人误判 `brk=false` 时机的含义。

### 五、副产品：一条 spec 设计被实测确认

同批 `r40s1-smoke2` 里阶段序列：
`early(0.1s) → preInfinity(1s) → infinity(4.1s) → eternity(6.1s) → reality(68.1s) → timeStudy(93.1s)`，
全程 `smDeg=0/139`。`preInfinity` 命中时 `realities=0`、`brk=false`、`amE=96`
—— 正是「买完第一次维度提升、还没做无限」，与 C.34 之后的判据修改（改用 `player.dimensionBoosts`）一致。

### 六、安全降级的实测价值

同一次 900 s 跑里，策略层因叶子改名**全程降级**（`smDeg=30371`、
`smErr=leaf-mismatch missing=[pelle.canArmageddon] extra=[pelle.armageddonUnlocked]`），
游戏仍 708.1 s 通关、`eErr` 为空。

⇒ 两条结论：
1. **failSafe「整层停机、不抛主循环」是安全降级**，不是崩溃 —— 实测坐实。
2. **策略层当前尚未参与通关**（它全程降级）。所以「708.1 s」这个数字，
   证明的是既有 6 个阶段自动化模块的能力上限，**不是策略层的功劳**。策略层的收益要等它自己跑通再单独量。

### 七、速度口径：**只能写「开跑为默认 10000×」，不能写「全程 10000×」**

探针侧已自证（2026-10-31 补充）：

- **墙钟来源**：`pelle-probe.mjs:74` `t: Math.round((Date.now() - window.__r40T0)/100)/100`，
  `T0` 在 `:202` 页面就绪后立即设置。纯 `Date.now()`，**不经过任何游戏内倍率换算**
  ⇒ 708.1 s 是真实墙钟秒，不是游戏内时间。
- **起跑速度**：默认值 10000（`speed-config.js:32`），探针从不调 `GameSpeed.set`，
  开跑前 `localStorage.clear()` + `reload()`。
- **但不能签「全程」**：**动态速度默认开启**（连续 4 s 无进度就 ×2），
  旧 jsonl 没采倍率字段，无法证明中途没升过档。
- 已给探针补 `spd` / `spdDyn`（读 `oreki-game-speed` 键）。补采后两次 120 s 跑、
  111 条采样**全部 `null`**（= 未写该键 = 用默认值、未升档）。

⇒ 本条与后续所有通关时间的正确写法是：**「开跑为默认 10000×，动态升档见 `spd` 字段」**。
禁止写「全程 10000×」——现有证据不支持。

### 八、其他边界

- 只有 1 次成功样本，前置段方差未知（另一次同链路跑是 783.1 s，差 75 s）。
- **执行层/策略层对通关时间的贡献 ≈ 0**（agent-a 主动声明，我认）。
  选 B 且调的是同一批幂等方法，**未做 A/B 对照**。
  它的价值是「可见性 + 购买权边界 + 兜底重试」，不是加速。
  ⇒ 禁止在任何文档里把它写成「策略层带来的提速」。

## C.37 教程弹窗「2.4 秒自动消失」：不是关闭，是被更高优先级弹窗盖住 `[实测]`

### 一、现象与根因

现象：教程弹窗打开约 2.4 s 后从 DOM 消失，`Modal.show/hide` 打桩零命中。

真因（100 ms 采样 + 覆盖者栈）：

```
t=3000ms  queue=1  current=OrekiTutorialModal  dom=true
t=3100ms  queue=2  current=MessageModal        dom=false
栈：AchievementState.unlock (normal-achievement.js:64) -> bigCrunchReset (big-crunch.js:56)
```

机制链：教程 `priority=0`（`modal.js:239`）→ 成就 55 用 `Modal.message.show(text, {}, 3)`
（`normal-achievement.js:64`；`Modal.message` 自身 priority=2）→
`sortModalQueue` 换掉 `ui.view.modal.current`（`modal.js:150-157`）→
`PopupModal` 只渲染 `view.modal.current`（`GameUiComponentFixed.js:84-87`）→
**教程组件被销毁，但仍在队列里（queue=2）**；点掉消息后 `current` 回到教程，组件**重建**。

⇒ 「2.4 s」= 首次大坍缩到成就 55 的时间差，**不是任何关闭动作**。

### 二、真正的伤害是第二层：阅读位置丢失

组件重建会重跑 `data()`，而其中 `index: getTutorialStartIndex()` 会把章节重置到当前阶段章。
实测：跳到第 10 章 → 被顶掉 → 点掉消息 → 回来落在**第 7 章**。

⇒ 教训：**「消失」只是表象，可恢复但会重置状态的组件重建才是缺陷本体。**
凡是「组件会被销毁重建」的 UI，状态必须外置到模块级或持久层，不能只放在 `data()` 里。

### 三、修法（最小改动）

1. `ModalWrapperChoice` 加 `useEnterToConfirm`（默认 `true`）——它 `created()` 无条件把
   Enter 接到 `doConfirm()`，没传 `confirmFn` 就 `dispatch(CLOSE_MODAL)`。
   纯阅读弹窗传 `false`，其余几十个弹窗行为零变化。
2. `TutorialReadingPosition`（模块级，不写 player、不落 localStorage）跨重建保留章节与滚动位置。
   区分「主动关」与「被顶掉」的依据：**只有主动关闭才派发 `CLOSE_MODAL`**，
   被顶掉走 `sortModalQueue` 不派发。
3. **不改 `core/modal.js`**：priority 3 的消息内容是「你 1 分钟内完成了一次无限，UI 变了」，
   对首次游玩的人是必要信息；且 `Modal.message.show` 带 `props.callback`，
   排队补发要挂起再恢复回调，属改共享基础设施，波及面上百个调用点。
   ⇒ 接受「被打断一次，点掉就回来」，与其它弹窗同等待遇。

### 四、方法学陷阱：用 `defineProperty` 拦响应式对象会毁掉被测现场

第一版诊断脚本用 `Object.defineProperty(ui.view.modal, "queue"/"current", {...})`
把 Vue 的访问器换成了普通属性，**掐断响应式**：`current` 明明有值，DOM 永远不更新，
于是测出「dom 全程 false」的假象，把结论带向「弹窗根本没打开」。

⇒ 规则：**拦响应式对象只能用于「记录谁在写」，不能在同一轮里做 DOM 断言**；
要么只在 `show()` 之前装桩并只读日志、DOM 断言另跑一轮，要么改包方法
（`removeFromQueue` / `Modal.hide` / `Modal.hideAll`）而不碰访问器。

## C.38 推翻 C.37 §三-3：`core/modal.js` 必须改，教程 `priority` 0 → 4 `[实测]`

### 一、我上一轮判断错了，错在只看了「打断一次可接受」

C.37 §三-3 我写的是「不改 `core/modal.js`，接受被打断一次，点掉就回来」。
这条判断只算了「打断」的代价，没算**打断后重建的代价**——而真正的伤害在重建里：
`data()` 重跑，`index: getTutorialStartIndex()` 把读到第 10 章的进度重置回第 7 章（C.37 §二）。

于是形成这样一条链：
```
第 10 章正在读 → 成就说明顶掉 → 组件销毁 → 玩家点掉提示 → 组件重建
→ data() 重跑 → index 从 10 掉到 7 → 玩家发现自己在第 7 章
→ 再读到第 10 章 → 又解锁一个成就 → 再被顶掉 …
```
在默认 10000× 下成就解锁是**密集事件**（成就是在游戏循环里判的，不是按墙钟），
所以这不是「被打断一次」，而是「在读完之前会被反复打断」。C.37 §三-3 的假设不成立。

### 二、改法与位置

`src/core/modal.js:246`：
```js
Modal.orekiTutorial = new Modal(OrekiTutorialModal, 4);   // 原为不传 priority（= 0）
```
4 高于全部既有值：玩法确认弹窗 `1`（`dimensionBoost` / `bigCrunch` / `eternity` / `reality` …
一二十个）、成就与特殊说明 `3`（`normal-achievement.js:64` 的
`Modal.message.show(text, {}, 3)`）。`modalQueue.sort((x,y) => y.priority - x.priority)`
（`modal.js:152`）⇒ 最大者胜，4 是当前最高，够用且没有越权到「超过一切」的地步
（真要更高就会盖住硬重置确认这类必须立刻处理的东西，4 刚好压在它们之上、成就说明之下无对手）。

「教程是玩家主动发起的阅读会话，被任何东西顶掉都是错的」——这是这条改动的唯一理由。
不是「教程更重要」，是「玩家已经明确表示此刻在读书」。

### 三、验收：真跑，逐 100 ms 采样

探针 `web/_tools/_r40/t-tut-priority.mjs`。被测入口是真实路径：
`OptionsGameplayTab.js:362` 的按钮就是 `onclick="Modal.orekiTutorial.show()"`，
所以调 `show()` 等于玩家点按钮，不是绕过 UI。

先空跑 20 s 让提示堆积，实测现场：

```
queueLen: 1     queueNames: ["MessageModal"]     current: "MessageModal"
```
—— 队列里**正好压着一条消息弹窗**，这就是改之前必然被顶掉的场景。

`show()` 之后逐 100 ms 采样 6 s：

| 指标 | 值 |
|---|---|
| `firstVisibleMs` | **0** |
| `zeroSamples`（tutNodes 为 0 的采样数） | **0** |
| `current` 全程取值 | 只有 `OrekiTutorialModal` |
| 章节标题全程取值 | 只有 `第 0 章　开始之前` |
| `pageErrors` | 只有一条 CSP 拦截 googletagmanager，与本次无关 |

判定 `pass: true`（出现 ≤ 1 s ∧ 6 s 内零跌落 ∧ 章节未变）。

### 四、方法学陷阱（第二例）：读了不存在的字段，断言会变成恒真

第一版探针的 `chapterStable` 判据写的是
`window.Modal.orekiTutorial._component?.chapter?.id`，实测**全程 `null`**。
理由：Vue 挂载后 `_component` 上拿不到 `data` 字段。

于是 `chapterStable` 的判据变成「历史集合里非空值 ≤ 1 个」，
而集合是 `[null]` ⇒ **永远为真**。这不是「通过」，这是**根本没有判**。

⇒ 规则：**任何「没变化」类断言，必须先证明「读到了东西」**。
做法是断言里同时要求 `历史集合.size >= 1 且 集合里不含 null`，
或者干脆换一个有内容的读取面（本处改为从 DOM 读章节标题文本）。
凡是「结果恒为默认值」的检查，都要先怀疑字段路径写错了，而不是先庆祝通过。

### 五、与 C.37 的关系

C.37 的根因分析（被 priority 3 顶掉、组件销毁但仍在队列、重建重跑 `data()`）**全部成立**，保留。
被推翻的只有 C.37 §三-3「不改 `core/modal.js`」这一条决策。
`ModalWrapperChoice.useEnterToConfirm` 与 `TutorialReadingPosition` 两项修法仍然有效且必要：
priority 4 挡住的是「成就说明」，挡不住 Esc / × 误关，也挡不住玩家自己切走再回来。

## C.39 七篇附录在 Web 端零渲染入口：数据资产 ≠ 玩家能看的内容 `[实测]`

### 一、实测：`appendices` 只被校验器和生成器消费，没进任何 UI

```
$ grep -rn "appendices" src --include=*.js | grep -v oreki-tutorial-data.gen.js
（零命中）
$ grep -rn "TUTORIAL_APPENDICES" src scripts
（零命中）
```

`data.appendices` 实际存在 **7 篇**（不是 6 篇，此前多处口径写错）：
`apx_terms` / `apx_achievements` / `apx_notation` / `apx_bilingual` /
`apx_blockers` / `apx_automation` / `apx_changes`。

消费方只有两处，都不面向玩家：
- `scripts/validate_tutorial.mjs` 规则 9（数条数与字段完整性）
- `scripts/gen_tutorial_module.mjs`（聚合 `apx_automation`）

`OrekiTutorialModal` 里没有附录区，`oreki-tutorial.js` 也没导出 `TUTORIAL_APPENDICES`。

### 二、为什么这条严重

用户目标是「完全不读外部攻略的纯新手，180 分钟真实通关」。
七篇附录里，术语表、卡点速查、成就表、记数法这四篇**正是新手在没有攻略时唯一的信息来源**：
正文讲的是「按什么顺序做什么」，附录讲的是「这个词是什么意思、卡住了查哪一条」。

18 章正文写得再准，附录不可达 = 新手遇到第一个不认识的词就断线。
校验器 2087 项全绿**不能说明交付完整**——它验的是数据，不是可达性。

⇒ 规则：**「数据存在 + 校验通过」永远不构成「玩家能看到」的证据。**
任何内容类交付，验收必须包含一条「从玩家入口点进去，页面里有字」的实测。

### 三、连带发现：核对数量口径时要数一遍

此前摘要与报告里反复出现「18 章 + **6** 附录」。实际是 **7** 篇。
多出来的那篇是 `apx_changes`（本轮新加）。这说明凡是「N 章 + M 附录」这类数字，
只要没人真去 `JSON.parse` 数一遍，就会在多个文档里同时出错并互相引用为证。

⇒ 规则：凡引用数量（章节数、附录数、检查项数、文件数），一律给出来源命令，
不接受「以报告为准」。

### 四、另一处口径更正：`a5142cf` 的标题少写了一章

`a5142cf` 标题为「教程第14章事实修正」，但其中
「第 14 章结束（薇与太阳神可以没做完…）」这句位于 **`ch15`（莱特拉）的 `entry` 字段**。
该提交同时改动 ch14 与 ch15，标题只写 ch14 是漏的。

已推送的提交不改写历史（不 `--amend`、不强推）。
后续引用该提交时以本条为准：**它动的是 ch14 + ch15**。

## C.40 两条通用教训：产物里的陈旧副本、跨项目规则污染 `[实测 + 自查]`

### 一、「删掉源文件」≠「产物里没有那个文件」

Android 侧删 `AchievementUnlocker.smali` 时发现的坑（`build_mod.py:547-550` 补的 `stale.unlink()`）：

`build_mod.py` 把 `scripts/payload/smali/**` 拷到 `work/mod/` 再打包，
拷贝逻辑**只覆盖、不删除**。于是源码删了，`work/mod/` 里那份旧 smali 还在，
**照样被打进 APK**。

这个 bug 在代码里完全看不出来：
- `git ls-files` 里没有它（源已删）
- `grep -r AchievementUnlocker scripts/` 只会命中 `build_mod.py` 的断言
- 只有真解包 APK 才看得到那个类还在

⇒ 规则：**凡是「拷贝到工作目录再打包」的构建链，必须显式清理陈旧副本**，
不能依赖「源目录有什么就拷什么」。清理逻辑要写成「目标目录里有、源目录里没有 ⇒ unlink」，
并且构建脚本里要有断言验证这件事（本处是 `build_mod.py:1114` 的 `"[AU-DEL] 类文件仍存在"`）。

同类风险面还有：`web/_deploy/site`（filelist.txt 驱动）、任何 `cp -r` 式部署。

### 二、跨项目规则污染：我（team-lead）犯的错

给 `apx_changes` 附录列「本作 vs 原版差异」清单时，我写了：

> 玩家模型：`player_zero` 固定，禁止 `mp_m_freemode_01`。
> 出生点：Downtown 固定坐标，死亡原地重生不传医院。

**这两条是用户另一个项目（FiveM 练车服）的服务器规则，跟《反物质维度》没有任何关系。**
`player_zero` 是 GTA V 的 Michael 模型，Downtown `(215.76, -810.12, 30.73)` 是洛圣都出生点。

这不是「说法不准」，是**把两个项目的规则串在了一起**。危害在于：
写进附录后玩家会去游戏里找「玩家模型设置」，找不到，然后怀疑整篇附录的可信度——
而一篇攻略的可信度是整体性的，一条明显的胡说会让人不再相信另外九条。

⇒ 规则：**跨项目工作时，任何要写进交付物的「事实」，先问一句「这是哪个项目的」。**
判断办法：能在这个项目的仓库里 grep 到依据吗？
grep 不到就不是这个项目的事实，无论它在我脑子里多「显然」。

### 三、同一轮里第二类错误：把「本作内部的两种来源」当成「本作与原版的差异」

`player.break` 有两条来源（买 Break Infinity 升级、末日路径 `finishProcessReality`），
这是 **本作内部** 的两条来源，实测 t=4.1 s / 72.1 s / 706.1 s（FACTS C.35 §四）。

我转述给写附录的人时写成了「原版只能靠买升级，本作新增末日路径」——
**原版也有末日路径**（`reality.js` 两侧同构）。

⇒ 规则：**「有两个来源」和「与原版不同」是两件事。**
前者是内部观察，后者必须两侧对照（本作文件 vs 原版文件 diff 过）才能下结论。
写差异表时，每一条都要能回答「原版那一侧我看了哪个文件的哪一行」。

### 四、L3 有界调用落地（**「有界」没做到声称的程度**）

`OrekiAchAudit.smali:51` `const/16 v1, 0x258`（每 600 次 `tick()`）一次完整审计；
`OrekiSpeed.smali:201` 每个 `apply(D)` 只剩一个 `invoke-static OrekiAchAudit;->tick()V`。

**但「600 次 = 600 帧 = 约 10 秒」这个换算是错的。**

AVD 实测 5975 个 GATE 间隔：中位 **31 ms**、p90 51 ms、p99 115 ms。
GATE 每 600 次 `tick()` 打一行 ⇒ 审计实际约 **32 Hz 在跑**，不是 0.1 Hz。
即 `OrekiSpeed.apply(D)` 被调用的是**每秒约 1.9 万次**（600 / 0.031 s），不是「每帧一次」。

> 算术自查：`600 / 0.031 = 19,355`，约 1.9 万/秒。
> 报告里写「约 3.2 万次/秒」与这个中位数**对不上**（3.2 万需要约 18.75 ms 的间隔）。
> 二者必有一错，须按原始 5975 个间隔重算，不许拿中位数和某个未说明的口径各说一套。

⇒ 结论：
- 开销量级仍可忽略（32 Hz × 104 谓词 ≈ 3,300 次接口调用/秒），
  但**「按次数节流」等于「按调用频率节流」，而调用频率不是帧率** —— 这是设计错，不是数字偏差。
- 正确做法：**按时间节流**（例如 `SystemClock.uptimeMillis()` 每 5000 ms 一次），
  而不是按 `apply` 调用次数。次数节流在「apply 被高频调用」的实现下会自动退化成高频审计。
- 帧耗时的静态估算（< 0.1 µs/帧）**从未被设备实测证实**，且「每帧」这个前提本身已被推翻。

### 四·补 gfxinfo 在这台机器上对 SurfaceView 无效

- 「审计关」组：`Total frames rendered: 1146 / Janky 56.89% / p50 17ms / p90 36ms / p99 109ms`
- 「审计开」组：**`Total frames rendered: 0`**，p50/p90/p99 全是 4950 ms（空直方图默认值）

环境已排除（`mWakefulness=Awake`、`mScreenState=ON`、`mCurrentFocus=…MainActivity`、
进程存活、GATE 每 31 ms 仍在打）。主界面 Surface 在 SurfaceFlinger 里是
`…MainActivity#1126/#1127` ⇒ 游戏画在 **SurfaceView** 上，**HWUI 的帧统计里没有它**。

⇒ 那 1146 帧很可能根本不是游戏主界面（大概是首启更新日志弹窗在动），
**这一组作废，不算交付**。

⇒ 规则：**用测量工具前先证明它测的是被测对象。**
`Total frames rendered > 0` 不构成「测到了游戏」的证据，
必须能对上 SurfaceFlinger 里的那个 surface。

### 五、验收器必须能报红

L3 审计「0 处不一致」这句话本身不构成证据：
如果它永远报绿，那它什么都没验。

⇒ 规则：**任何审计/校验器交付时，必须额外证明它能在真实缺陷上变红。**
做法是人为制造一处已知不一致（本处：手动开一次「强制点亮」），
断言审计器报出**恰好那一处**——多报一处说明有假阳性，少报说明有漏检。

## C.41 执行层四条验收实测通过 + 面板「阻塞：无」的语义 `[实测]`

跑法：全新档（`localStorage.clear()` + reload），端口 8886 / 9386 避让，
数据 `web/_tools/_r40/r40s2-verify-b.jsonl` **205 条 / 221.4 s**，脚本 `r40s2-verify.mjs`。

### 一、四个值（不是「看起来正常」，是逐项读取）

| 项 | 实测值 |
|---|---|
| `smOk` | `true` |
| `smDeg` | `false`（205 条样本里为 true 的条数 **0**） |
| `smDegN` | `0` |
| `smErr` | `""` |
| 控制台本模块报错 | `consoleRelevant=0`、`pageErrors=0` |
| 面板七项 | 全渲染，`700×150`，`overflowX=false` |
| 面板 ①~⑦ | 现实阶段(reality) / 解锁天神(未完成) / 现实推进策略(realityPush) / 装备最优符文→无可买 / 装备最优符文 / 无 / timeStudy+challengeClear → reality+realityPush(20 秒前) |

全量 `error` 只有 1 条：googletagmanager 被 CSP 拦截。**环境噪音，早于本次改动就存在**，
不许把它算成本模块缺陷，也不许为了消它去改 CSP。

### 二、不抢购买权：结构成立 + 计数器兜住「结构推理错了」

接管处加两个运行时计数 `takeovers` / `takeoverWhileModuleActed` + `lastConflict`。205 条样本：

```
takeovers = 205                  （接管尝试，含空转）
takeoverWhileModuleActed = 0     （模块本帧动手时仍被接管 —— 必须为 0）
actionCount = 4                  （真买到，不是尝试次数）
```

`takeoverWhileModuleActed = 0` 本身不新鲜：结构上「摘要非空 ⇒ idle 清零 ⇒ 不挑中」推得出来。
**加计数器的意义是「结构推理错了能被抓到」**——这是把不变量写成可观测值，值得推广。

### 三、手动优先：真的点了真实按钮

t=150.9 s 脚本点了 `购买解锁现实的时间研究以解锁现实`。之后 57 条样本：

```
hold 从 59 s 倒计数到 1 s
actN 4 → 4（无增长）
violations = []
```

「其它 goal 不受影响」用单测证：挡住目标 A，目标 B 照常动手。

### 四、无预测值

正则扫面板文本 `预计|预估|剩余时间|ETA` → `false`。面板只显示实测态。
这条重要：一个猜出来的「预计剩余 12 分钟」，比不显示更坏——玩家会拿它做决策。

### 五、`阻塞：无` 的语义必须写清

`blockers` 那行现在渲染「无」。这是**事实为空**，不是「没实现」：
spec 当前只有 2 条 blocker，现实阶段都不成立。

⇒ 规则：**「空」与「坏」在 UI 上必须可区分。**
待改：渲染成「无（已检查 2 项）」——数量来自 spec 实际 blocker 条数，不写死。

### 六、agent-a 自己抓出的一个「测错不是产品错」

第一版脚本写 `ser[idxFirst].actN`（拿下标当对象），算出 `4 - 0 = 4`，
差点报成「hold 期间照样动手」。改成逐样本与相邻帧比对并输出 `violations` 数组。

⇒ 与 C.38 §四 是同一类：**判据写错时的失败方向是「报出一个不存在的缺陷」或「报出恒真」**，
两种都会骗过自己。凡是「差值」类断言，必须能打印被减的两个原值。

## C.42 Android 连第一次无限都拿不到：缺 AU4b 与首次坍缩调用 `[AVD 实测 + 源码对照]`

### 一、现场读数（AVD 全新档，`pm clear` 后，×10000）

用 `adb exec-out cat /data/data/<pkg>/files/player.json` 逐次取样
（`Player.smali:1033` 的序列化键就是 `brake`；`auto.bigCrunch.interval/cost` 在同一份 JSON，
一次取样两值同源，零注入、不动内存）：

| 时刻 | `brake` | `bigCrunch.interval` | `bigCrunch.cost` | IP | bigCrunches | infinities | AM |
|---|---|---|---|---|---|---|---|
| 46 s | **false** | **150000** | **1** | 0 | 0 | 0 | 3.41e171 |
| 107 s | false | 150000 | 1 | 0 | 0 | 0 | **1.7976931348623277e308** |
| 235 s（停） | false | 150000 | 1 | 0 | 0 | 0 | 1.797e308 |

235 秒里 IP 恒 0、`bigCrunches` 恒 0 ⇒ 间隔一级都买不起 ⇒ `brake` 不可能变真。

### 二、根因候选：两个已知缺失，但因果顺序**未定**（不许写死）

> 更正：本条初版断言「AU4b 缺失**导致** AM 卡在 1.8e308」。**顺序说反了。**
> AU4b 改的是坍缩**策略**（AMOUNT → X_HIGHEST），它只在坍缩**真正发生过**之后才有意义。
> 若自动坍缩一次都没 tick，AU4b 根本轮不到发挥作用。
> 下面两条是**候选**，谁在前必须由 AVD 运行期门控表判定，不能靠读代码推。

**候选一：`[Oreki AU4b]` 在 Android 侧 0 命中。**

Web `src/core/autobuyers/big-crunch-autobuyer.js:19-26`：

```js
// [Oreki AU4b] 用默认策略（AMOUNT，amount = 1）开自动坍缩会把反物质永久卡在 1.8e308：
// 实测 120 s 内 maxAM 恒为 1e25.7、Infinity Dimension 永远不可用，进度实际停滞。
if (unlocked && this.data.mode === AUTO_CRUNCH_MODE.AMOUNT && Decimal.lt(this.data.amount, 10)) {
  this.data.mode = AUTO_CRUNCH_MODE.X_HIGHEST;
  this.data.xHighest = new Decimal(10);
}
```

AVD 读到的 `1.7976931348623277e308` 与这里的 1.8e308 同值 —— **可疑，但同值不等于同因**。

**候选二：首次坍缩调用缺失。**

Web `src/game.js:311`（`tryOrekiEarlyRoutine` 内）：
```js
if (!player.break && Player.canCrunch) bigCrunchResetRequest(true);
```
原版大坍缩自动器间隔 150000 ms，且 `Time.thisInfinityRealTime` 是**真实时间**
（速度倍率在 `realTimeMechanics` 里被除回去），所以开局第一次自动坍缩要干等 150 秒真实时间。

**已知待办（不是新发现）**：`scripts/build_mod.py:3121` 自己记着
「需要先修默认模式（X_HIGHEST），留到下一轮单独处理」。

### 二·补 「g() 未解锁」这条被推翻

一度有结论说 `CrunchAutobuyerState.g()` 未打 AU4 补丁、故 `c()` 恒 false。
**该结论被推翻**：`work/mod`（2026-10-30 22:14）里 `g()` 是 `:810-:883`，
AU4 分支在 `:865-:882`；引用者用的是 `:782-844`，**在 :844 截断**，
而补丁永远加在方法末尾 `return` 之前 ⇒ 截断必然截掉补丁。

按完整方法推演：全新档 `K()=false` → `hasInfinity()=false` → `orekiEarly()=true`
⇒ `g()` 返回 **true**。

> **更正记录（第二层错）：上面这句也是错的，而且错在跳转极性上。**
>
> 注入段的真实指令（`work/mod`，方法内相对行号）：
> ```
> 63: if-nez p0, :oreki_au4_inf      # p0 = K()，非零才跳
> 64: return p0                      # K() 为假 → 直接返回 false，AU4 分支走不到
> 65: :oreki_au4_inf
> 66: invoke-static OrekiAuto;->hasInfinity()Z
> 68: if-eqz p0, :oreki_au4_er
> 69: return p0
> 70: :oreki_au4_er
> 71: invoke-static OrekiAuto;->orekiEarly()Z
> 73: return p0
> ```
>
> `if-nez` 是「**非**零跳转」。K() 为真才跳到后面三项，K() 为假就 `return p0` = false。
> 所以净效果 **= `K()`**，AU4 注入的三项在全新档一次都走不到。
>
> ⇒ 结论：**AU4 补丁在 Android 上是死代码，从未生效。**
> 正确极性应是 `if-eqz p0, :oreki_au4_inf`（K() 为假时去查另外两项）。
>
> AVD 实测 `g()=false` 5976/5976 条样本，与此一致。
>
> ⇒ 方法学（第三层）：**判 smali 的条件分支，必须逐条读 `if-*` 的语义，
> 不能凭助记符的直觉猜。** `if-nez` 不是「if zero」，是「if not zero」。
> 这次我连"更正"都错了一遍，正是因为它长得像 if zero。

⇒ 方法学：**判「这个方法里有没有 X」，行号区间一律不可用，必须按方法边界取全文。**
```
awk '/\.method public final g\(\)Z/,/\.end method/' 文件
```
`grep -A N` 同样会截断。这一条在 Web 侧一样适用。

### 二·补二 判定的唯一办法：运行期门控表

不读代码推，直接 dump 这 10 个值（60 s / 120 s / 200 s 各一次）：

```
Player.m()                          # brake
CrunchAutobuyerState->g()Z          # 解锁门
AutobuyerState->c()Z                # 运行门
player.auto.bigCrunch.isActive      # 开关
player.options.autobuyersOn         # 总开关
player.auto.bigCrunch.mode          # AMOUNT / TIME / X_HIGHEST
player.auto.bigCrunch.amount
player.auto.bigCrunch.xHighest
player.auto.bigCrunch.interval
Player.canCrunch
```

哪一道门是 false 就是事实。**拿到这张表之前不许写补丁。**

### 三、为什么 AU4c 救不了第一环（这条成立）

`canBeUpgraded` 的实现是 `NormalChallenge(12).isCompleted`。
而 AU4c 是「首次无限**之后**一次性启用」。首次无限之前 `canBeUpgraded` 为假、
`PlayerProgress.infinityUnlocked()` 也为假 ⇒ **鸡生蛋**。
所以「补 AU4c」不能解决首坍缩。
但注意：AU4 **本身**已经给 `g()` 加了 `orekiEarly()` 分支（见上），
所以「解锁门」在全新档应当已放行 —— 真正卡住的是哪一环，等门控表。

### 四、结论：Android 实测到不了第一次无限 —— 但「从未可能」这句话过头了

实测事实只有一条，很硬：**AVD 全新档 235 s，`bigCrunches=0`、IP 恒 0、`brake=false`。**
也就是说，在这台 AVD + 这一份已装 APK 上，第一次无限没有自然发生。

但**不许**由此推成「Android 任何版本都不可能出现首次无限」：
- 已装 APK 与 `work/mod` 时间不同（`work/mod` 缺 `OrekiAchAudit`，说明它早于本轮 L3 工作）
- `work/mod` 里 `g()` **有** AU4 分支（`:865-882`），全新档应返回 true
- 也就是说「已装 APK」是否等于「当前代码」，尚未确认

⇒ 已确认的结论（可以写）：
```
在这台 AVD + 已装 APK 上，
自动坍缩未发生 → IP 恒 0 → interval 一级买不起 → brake 恒假
→ 无限维度不可用 → 永恒/现实/佩勒全部不可达
```

⇒ 未确认、不许写的：
```
「Android 代码层面不可能首次无限」（需要门控表 + 重编后复测才能定）
```

**在下一次重编 + 门控表出来之前，不许写「Android 与 Web 机制等价」，
也不许写「Android 根本没写这个功能」——只能写「实测未发生，原因待判定」。**

### 五、方法学：判「Android 有没有某机制」不能用关键词 grep

本次「payload 全树搜不到触发大坍缩的调用」这个结论**恰好是对的**，
但方法是错的——R8 会把 `bigCrunchResetRequest` 改成无意义名字，
`instantChallenge : 0` 就是现成反例（关键词 0 命中，类却有 304 行）。

正确顺序：
1. 先看 Web 实现调用的是什么 API、在哪个**类**里
2. 到 Android 找那个**类**（不是找方法名），看结构上有没有对应调用点
3. 交叉验证用 `build_mod.py` 里有没有对应补丁——补丁脚本是人类写的、不混淆的，
   比 smali 可靠得多

### 六、32767 悬案结案（AVD 两端夹逼）

| 端点 | `interval` | `cost` | 结论 |
|---|---|---|---|
| 全新档 | 150000 | 1 IP | 第 0 级 |
| 旧存档（10-30 14:21） | 100.0 | 32768 IP | 已买 15 级、累计正好 32767 IP |

两边合起来证明：15 级、累计 32767 IP、`interval` 下限 100
（`150000 × 0.6^15 ≈ 70.5`，被夹到 100）—— `OrekiStageAuto.smali:30` 的注释**是对的**。

⇒ 方法学：**用两端夹逼代替单点猜测**。单点只能说「当时是 X」，
两端才说得清「变化规律与边界」。

## C.43 Android 缺 AD5b：interval 会升级，但没人按「打破无限」那一下 `[结构核实]`

### 一、核实方式（这次是可接受的搜法）

```
$ grep -rn "Player;->x0(" scripts/payload/smali/
（0 个文件）
```

这条可信度**高于**普通关键词 grep：`x0` 是 payload 那个命名空间里的**真实方法名**
（`Player.smali:11103` 的 `x0(Z)V`，`brake` 的唯一写入口），不是被 R8 改过的外部名字。
在同一个命名空间里搜它，不存在「改名叫别的」的问题。

### 二、Web 有，Android 没有

Web `src/game.js:203-220` 的 `[Oreki AD5b]`：

```js
if (!player.break && player.auto.autobuyersOn &&
    Autobuyer.bigCrunch.hasMaxedInterval &&
    !NormalChallenge.isRunning && !InfinityChallenge.isRunning && !EternityChallenge.isRunning &&
    !Pelle.isDoomed) { /* 按一次 breakInfinity() */ }
```

守卫一条都不能少：`breakInfinity()` 是**开关**（`player.break = !player.break`），
少 `!player.break` 会每帧来回翻转。

Android 侧：`OrekiStageAuto.upgradeCrunchInterval()` 只做 interval 升级，
文件头注释还写着「interval 自动升级（Break 的唯一前置）」——
**它以为 break 由别人负责，而那个「别人」不存在。**

### 三、这是「两段自动化中间断了一节」

```
interval 拉满（有，OrekiStageAuto.upgradeCrunchInterval）
        ↓  [断]
按下 breakInfinity（无）
```

这类断链比「整段没写」更难发现：
每一段单独看都在，注释还互相声称对方负责。
⇒ 规则：**凡是「A 是 B 的前置」的注释，必须同时指出 B 在哪个文件里。
指不出来就是断链的征兆。**

### 四、当前 Android 端断链清单（按执行顺序）

| # | 环节 | 状态 |
|---|---|---|
| 1 | 自动大坍缩（首次） | **待 A0 门控表判定**（AU4 分支在 `g():865-882`，按完整方法推断应为 true） |
| 2 | 坍缩策略 AMOUNT→X_HIGHEST（AU4b） | Android 侧 0 命中；`build_mod.py:3121` 自认待办 |
| 3 | interval 升级 | 有（`OrekiStageAuto.upgradeCrunchInterval`） |
| 4 | 按下 breakInfinity（AD5b） | **无**（`Player;->x0(` 全 payload 0 调用） |
| 5 | 末日路径置 break | 有（`prestige/f;->o(...)` 与 `reality.js:748-752` 同构） |

⇒ 结论：即使第 1、2 环修好，第 4 环不补，`brake` 仍恒假（除非走末日）。
但**修的顺序必须由 A0 门控表定**，不许照着这张表从上往下盲补。

## C.44 上线 R40：发布源必须是 commit，不是工作区 `[实测]`

### 一、上线结果

`web/_deploy/site` 提交 `31a72e9` → `OrekiDawson/OrekiDawson.github.io` main → `https://oreki.net`

同步：**49 项变更（更新 43 + 新建 6），一致跳过 813，源码缺失 0**。

线上实开验收 7/7（`web/_tools/_r40/r40t-live-verify.mjs`，直接打 `https://oreki.net`）：

| 项 | 结果 |
|---|---|
| 页面能进（`GameUI.initialized`） | PASS，9,506 ms |
| 教程 6 s 内一直可见 | PASS，消失采样 0/49 |
| 教程章节未跳变 | PASS，全程「第 0 章 开始之前」 |
| 目录底部 7 篇附录 | PASS，实际 7 条 |
| 7 篇逐篇正文 > 200 字符 | PASS，2874/2337/1638/1621/2494/6191/3196 |
| `apx_changes` 表格 ≥ 15 行 | PASS，rows=24 |
| 线上无 pageerror | PASS |

### 二、三个坑（都会导致「以为发了其实没发」或「发上去白屏」）

**坑一：`filelist.txt` 漏登记 6 项，而 `--dry-run` 不会报。**

漏了：`oreki-tutorial-data.gen.js`(197KB) / `OrekiTutorialStyles.js` /
`oreki-tutorial-markdown.js` / `oreki-smart-strategy.js` / `oreki-smart-strategy.gen.js` /
`oreki-smart-executor.js`。

原因：`sync_deploy.py` **只按清单走**，清单里没有的它根本不看。
所以「dry-run 报新建 0 项」不代表没有新增文件。

⇒ 查新增唯一可靠办法：**拿源码树和清单做差集**，不是看 dry-run 输出。
这与 R38 漏 `oreki-dilation-automation.js` 导致线上 404 是同一个坑，第二次了。
清单一律 856 → 862。

**坑二：`sync_deploy.py` 读工作区，会把别人未验收的中间态直接发上线。**

同步当下工作区有 3 个 `M`（`OptionsGameplayTab.js` / `oreki-smart-executor.js` /
`oreki-smart-strategy.js`），都是 agent-a 正在改、还没验收的。

改法（已落盘）：`sync_deploy.py` 支持 `OREKI_SYNC_SRC` 覆盖源码根；
发布时先 `git worktree add ../_wt_deploy HEAD`，再
`OREKI_SYNC_SRC=_wt_deploy python sync_deploy.py`。

⇒ 规则：**发布永远发布一个 commit，不发布工作区。**
不然「线上跑的是哪份代码」这个问题永远答不清。

注意 `web/_wt_head` **不能当干净快照**：它是 `df6ef9d` 的 detached worktree，
早于教程单源化，连 `src/core/oreki-tutorial.js` 都不存在。看着干净，其实是更老的版本。

**坑三：Pages 构建完成 ≠ 立刻可用，冷启动会 503。**

推送后约 3 分钟 `https://oreki.net/src/core/oreki-tutorial.js` 仍是旧版 40,191 B
（新版 16,275 B），新文件 404；出现新版后**第一次**加载还撞到一次 503
（`GameUI.initialized` 70 s 未真）。重跑即 9.5 s 正常。

⇒ 判据：**看「某个已登记文件的字节数变了没有」，比看 index.html 返回 200 有效**。
再加一个穿透参数 `?cb=随机` 避免 CDN 缓存误判。

### 三、上线验收不能拿本地副本代替

本地 `_deploy/site` 上 22/22 全过，线上**仍要单独跑一遍**：
- 本地副本可能比远端新（本地同步了但推送失败）
- 远端可能比本地旧（Pages 没重建完）

两者是**三个不同状态**：工作区 / 部署副本 / 线上。
⇒ 规则：**「部署副本通过」不构成「线上可用」的证据**，必须对线上 URL 实开一次。

### 四、线上验收脚本要能直连线上

`r40t-appendix-verify.mjs` 把 baseURL 硬编码成 `http://127.0.0.1:${port}`，只能测本地。
新写 `r40t-live-verify.mjs` 接受完整 URL。

⇒ 规则：**验收脚本的地址必须是参数，不许硬编码。**
硬编码的结果是「线上验收」这一步会被悄悄降级成「本地再跑一遍」。

---

## C.45 引文层把整个弹窗层顶掉，`priority` 在引文面前无效 `[实测]`

### 一、结论

**`ui.view.quotes` 与 `ui.view.modal` 是两个独立队列，引文不参与 `sortModalQueue`。
教程的 `priority = 4` 只能压住 modal 队列内部，压不住引文。**

`src/components/GameUiComponentFixed.js:75-88` 是一条 `v-if / v-else-if` 互斥链：

```
ModalProgressBar            v-if="view.modal.progressBar"
CelestialQuoteModal         v-else-if="view.quotes.current"
CelestialQuoteHistoryDisplay v-else-if="view.quotes.history"
PopupModal                  v-else-if="view.modal.current"
```

`Quote.addToQueue()`（`src/core/celestials/quotes.js:5-8`）只做一件事：入队，`current` 为空就
`advanceQueue()` 置顶；它**不查 modal 队列**，也没有任何 priority 概念。

### 二、实测采样（消失瞬间前后，`r40s3-why-tut.jsonl`）

```
cur:      OrekiTutorialModal -> OrekiTutorialModal    队列首位没变
qLen:     2 -> 2      qNames: 'OrekiTutorialModal#4|MessageModal#2' -> 同一串
nTut:     234 -> 0    nModal: 1 -> 0    nMsg: 1 -> 0
pb:       False -> False
qCur:     None -> 1   nQuoteDom: 0 -> 1
```

`nModal` 与 `nMsg` 同时归零 ⇒ 不是「被盖住」（`.c-modal` 还在，R40T 那次是另一种形态），
是**整片弹窗层不渲染**。

### 三、触发点与触发面

触发点：`realities` 到 20、切 celestials 那一帧，特蕾莎首次引文入队。
四次跑落在 **264.0 / 255.9 / 239.1 / 228.8 s**，都在「进 celestials 后第一次现实重置」附近，
差异来自帧率。

**触发面比教程大**：`PopupModal` 在这条链**末尾**，意味着任何 priority 1 的阻塞式确认框
（`Modal` 实例里 priority = 1 共 **28 个**，逐实例读 `_priority` 实测；优先级口径见 C.38）
在引文出现时同样消失。

### 四、定级：不是「教程读不完」，是「会不会软锁」

S3 已实测教程开着 721.5 s 能通关（见 C.47）⇒ **不影响通关**。
所以按「引文结束后 modal 层是否回来」定级，判据写死：

- `view.quotes.current` 由非空变 null 后 **≤ 2 s 内** `nModal > 0` 且 `cur === "OrekiTutorialModal"` ⇒ 回来了；
- **10 s 仍为 0** ⇒ 判软锁。

**此判定截至 2026-10-31 03:10 未实测，状态 = 待判定。**

---

## C.46 采样强度能改变通关结论，比教程效应大一个量级 `[实测]`

### 一、结论

**同一份代码、同一份全新档，只换采样强度，通关时刻能从 769 s 变成「未达」。**

| 跑法 | 20 现实 | 100 现实 | 通关 |
|---|---|---|---|
| `pelle-probe` 基线 | 227.1 s | 639.1 s | **708.1 s** |
| 轻采样 无教程 | 230.0 s | 687.4 s | **769 s** |
| 轻采样 教程开 | 226.7 s | 650.6 s | **721.5 s** |
| 重采样 教程开 | 261.7 s | 876.5 s | 未达 |
| 重采样 对照 | 249.8 s | 868.5 s | 未达 |

### 二、机制

重采样脚本每秒多跑一次 `strategy.evaluate()`（1 s 节流正好踩满）+ 两次 DOM `querySelectorAll`
→ 帧率下降 → 「每帧只 tick 一次」的自动购买器触发次数下降 → 整体慢 **10~15%**（早期）、
**35%+**（到 100 现实）。

⇒ 规则（长期有效）：**任何「多少秒通关」的数字必须注明采样方式**；基线一律用 `pelle-probe`
的采样强度；**每帧调 `evaluate()` 的重采样脚本不得用于产出通关时间**。
否则会把验证脚本的开销记到产品头上。

---

## C.47 Web 端四次独立通关，跨度 708~783 s `[实测]`

### 一、四个读数（全部 `isGameEnd = true`）

| 来源 | 通关时刻 | 采样 |
|---|---|---|
| `pelle-probe` 基线 | 708.1 s | 基线 |
| S3 轻采样 教程开 | 721.5 s | 轻 |
| S3 轻采样 无教程 | 769 s | 轻 |
| R40-A5 `r40a5-arm2` | 783.1 s | 1 s |

A5 那次细节：`endState = 1.043171`、`log10(totalAM) = 1034.092`、`player.break = true`、
跑满 1800 s / 1784 条采样、`isGameEnd` 只翻转 1 次（false→true）、之后 1017 条全 true 从未回退、
`OrekiEndgameAutomation._lastError` 空串 0 条。

### 二、复现口径

**采样方式一致的前提下，通关时刻落在 700~800 s 区间即视为稳定。** 距离 180 min（10800 s）
预算约 **14 倍余量**。

⚠ **不要把「714 s 到佩勒」当「180 分钟能通关」**——它只证明前 12 分钟不构成瓶颈，
真正的通关验证是上面这四个 `isGameEnd`。

---

## C.48 Web 的「拉满间隔」是一次性阶段奖励 + 真实扣钱，不是产能异常 `[实测 + 读码]`

### 一、结论

**`bcCost` 从 1 跳到 32768 不是「4 秒赚到 32767 IP」，是一次性补贴。**

`src/core/oreki-break-infinity-gate.js`：

- `:103-110` —— `if (!this.grantedThisSession && !Pelle.isDoomed)`：
  `need = BREAK_INTERVAL_TOTAL_COST - Currency.infinityPoints.value`，`need > 0` 就把 IP 补到
  `BREAK_INTERVAL_TOTAL_COST`（`:51` 定义为 **32767 = 2^15 − 1 = 15 级间隔总成本**），
  置 `grantedThisSession = true`；
- `:115-122` —— `while (!bc.hasMaxedInterval && guard < 64)`，走真实的 `upgradeInterval(false)`
  **真扣钱**；
- 补完之后由 `src/game.js:210-233` 的 AD5b 按一次 `breakInfinity()`（原版只有 UI 按钮会调，
  `BreakInfinityButton.js`）。

日志铁证：`bcCost` 1 → 32768 = 2^15，恰好 15 级。

### 二、定性与边界

**这是 MOD 偏差，不是原版等价，不许说成「还原原版通路」。**

相关：`bcUnl` 被 AU4 改成 `canBeUpgraded || infinityUnlocked()`，不是挑战 12。

**毁灭态不发这段补贴**：原版给佩勒安排的开 break 通路是 `src/core/reality.js:750-752`
（`Pelle.isDoomed && keepAutobuyers.canBeApplied && hasMaxedInterval` 时置 `player.break = true`）。
毁灭态补 IP 等于替玩家付账。

---

## C.49 `web/_tools` 从未在版本控制之下 `[实测]`

### 一、结论

**产出「783.1 s 通关」那次跑分脚本事后无法追踪——不是被删，是 `web/_tools` 从来不在任何
git 仓库里。**

原因：`AD-Oreki-Unified` 不是仓库，唯一仓库根是 `web/AD-Oreki-Edition`，而 `web/_tools`
在它**外面**。⇒ 每一条「已实测」都缺了「哪个脚本、哪一版」这一环。

### 二、处理（2026-10-31）

`web/_tools` 建独立仓库，孤儿分支 `verify-tools` 推到
`https://github.com/OrekiDawson/AD-Oreki-Edition-Web.git`。
只版本化 `.mjs` / `.md` / `.py` / `lib/`，`*.jsonl` / `*.log` / `shots*/` / `node_modules/` /
`__pycache__/` 全部 gitignore（137 MB → 约 15 MB）。
首次收录 **648 个文件**，`9ec9bcd`；`README.md` 见 `17011eb`（收录后 649 个）。

⇒ 规则：**报告里的每个数字都要能追到「哪个脚本、哪个 commit」**，引用写 `_tools@<短 hash>`。
追不到的数字下一轮必须重跑，不能引用。
**只 `git add` 自己这一轮的文件，不许 `git add -A`。**

---

## 口径补充：倍率必须写「到达那一刻的当前倍率」

`localStorage["oreki-game-speed"]`（`src/core/speed-config.js:16`，默认
`GAME_SPEED_DEFAULT = 10000`、上限 `100000`）在 `r40s3-attrib900` 里到 **t = 760 s**
才出现第一个动态升档（20000），之后 40000 / 80000 / 100000。

⇒ **700 s 级通关全程是 10000×，动态速度只在通关后参与。**

⇒ 规则：以后报告要写「**到达某里程碑时的当前倍率**」，不能只写「默认 10000×」。

---

## C.50 Android 的 `OrekiStageAuto` 整类因多处极性反向而基本是死代码 `[读码 + 实机观测]`

> 本节**撤回**「先 break 再升 interval 的环形死锁」那个说法。真实结构不是「A 等 B、B 等 A」，
> 是**门链多处极性反向**：每个门单看都像在说一件合理的事，连起来后整类除
> `applyCrunchPolicy()` 之外**零执行**。

### 一、先撤回的那一条，错在哪

`upgradeCrunchInterval()` 的门是 `if-nez v0, :oreki_sa_iv_done`（`v0 = Player->m()Z`，是否已 break）。
`if-nez` = 非零才跳 ⇒ **break 为真才跳走 ⇒ 本方法只在尚未 break 时跑**。方向是**对的**。

它错的是**前提**：`:177` 的注释写「已 break 时原版在 break 那一刻已把全部 interval 拉到最低」，
而 `Player->x0(Z)V`（`work/base_decoded/.../player/Player.smali:11107-11116`）整个方法体 9 行，
**只有一条 `iput-boolean p1 → ->brake:Z`**，不碰 interval、不碰 cost。
⇒ 这处是「**设计前提错**」，不是「极性错」。两者要分开记，否则修法会错。

### 二、判定基准

见 C.51。`if-ltz` = 小于零才跳、`if-gez` = 大于等于零才跳、`if-nez` = 不等于零才跳、`if-eqz` = 等于零才跳。

### 三、逐处核对（行号取 `a22c83f`，理由见 §六）

| 位置 | 代码 | 真实语义 | 注释表达的意图 | 判定 |
|---|---|---|---|---|
| `onAutoBuyerTick:68` | `hasInfinity() → if-nez v0, :oreki_sa_early` | **有**无限才跳去 `enableEarly()` | 「首次无限**之前**开启开局自动化」 | **反** |
| `onAutoBuyerTick:80` | `isDoomed() → if-nez v0, :oreki_sa_ret` | doomed 才返回 | 「Doomed → 不介入」 | **对** |
| `onAutoBuyerTick:86` | `eternitiesZero() → if-nez v0, :oreki_sa_ret` | eternities==0 才返回 | 「已进入永恒 → 停止干预」 | **反** |
| `upgradeCrunchInterval:190` | `m() → if-nez v0, :iv_done` | 已 break 才返回 | 「未 break 才继续」 | 极性**对**，前提**错** |
| `upgradeCrunchInterval:225` | `IP.compareTo(cost) → if-gez v2, :iv_done` | IP **≥** cost 才返回 | 「IP<cost 买不起，停下」 | **反** |
| `tryBuyId1:272` | `m() → if-eqz v0, :id_done` | 未 break 才返回 | 同 | **对** |
| `tryBuyId1:283` | `p() → if-eqz v1, :id_done` | 门槛未达成才返回 | 「未达成就不碰」 | **对** |
| `holdCrunch:320` | `IP.compareTo(1e8) → if-gez v0, :hc_no` | IP **≥** 1e8 才返回（不暂停） | 「IP<1e8 → 先正常坍缩攒 IP」 | **反** |
| `enableEarly:365` | `sEarlyApplied → if-nez v0, :ee_go` | 已应用过才跳去应用 | 「已应用过就直接返回」 | **反**：首次调用就走 `return-void`，`:oreki_ee_go` **不可达** |
| `applyCrunchPolicy:515` | `amount.compareTo(10) → if-ltz v1, :ret_p` | amount **<** 10 才返回 | 「a≥10 尊重玩家设置」 | **反** |
| `OrekiAchAudit.tick:68` | `elapsed vs 5000 → if-ltz v6, :go` | elapsed **<** 5000 才跑审计 | 「不足 5000 ms 直接返回」 | **反** |

`tryBuyId1` 的正文只有两个 `if-eqz`（`:272`、`:283`），**没有 `if-ltz`** —— 有说法称
「`tryBuyId1` 的 `:320 if-ltz`」是把 `holdCrunch:320` 的 `if-gez` 误记到了它头上，
两处的极性、方法、标签都不同。以本表为准。

### 四、串起来才是致命的

- **全新档**：`hasInfinity()` = false → `:68` 不跳 → 落入「已过首次无限」块 → 清 `sEarlyApplied`
  → `isDoomed()` = false → `:80` 不跳 → `eternitiesZero()` = **true** → `:86` 跳走 → `return-void`。
  ⇒ `enableIpMultAutobuyer()` / `upgradeCrunchInterval()` / `tryBuyId1()` **一次都不执行**。
- **有无限的档**：`hasInfinity()` = true → `:68` 跳到 `:oreki_sa_early` → `enableEarly()`
  → 而 `:365` 让它在**首次调用**就 `return-void`（`sEarlyApplied` 初值 false ⇒ 不跳 ⇒ 落到 return）
  → 什么也没开，且 `sEarlyApplied` 永远为 false，下一帧同样什么都不做。

⇒ **`OrekiStageAuto` 除 `applyCrunchPolicy()` 之外，整类是死代码。**

### 五、现象与门的对应

| 观测（agent-b 实机） | 对应哪一处 |
|---|---|
| `interval` 恒 150000 | `upgradeCrunchInterval()` 一次没跑过（`:86` 先 return）；即便跑到，`:225` 也会在买得起时退出 |
| IP 只有 26 | `enableIpMultAutobuyer()` 没跑（`:86`），IP 倍率自动器始终是关的 |
| `bigCrunches` 0 → 7 | **与本类无关**：那是原版大坍缩自动器在 AU4 极性修好后自己跑起来的 |
| 审计约 32 Hz 而非 5 s 一次（C.40 §四 更正） | `OrekiAchAudit:68` 反了：elapsed<5000 才跑，而 `:go` 里每帧又把 `sLast` 刷成当前时刻 ⇒ elapsed 永远 <5000 ⇒ **永不节流** |

### 六、行号为什么锁在 `a22c83f`

`[实测]` 读本节时工作区 `git status` 显示 `M scripts/payload/smali/.../OrekiStageAuto.smali`，
mtime `04:50:47`（读到的时间是 `04:50:49`）—— **agent-b 正在修这个文件**，行号每几分钟就变一次。
所以本节所有行号取自 `a22c83f` 的 blob（修复前）。

⇒ 修复落地后，本节要改成「已修 + 新 commit」，并注明「以下为修复前状态」，
**不要留着旧结论当现状**。

### 七、规则

**凡是注释写了「只应用一次」「已 X 就返回」「未 X 才继续」这类语义的地方，极性必须逐处验。**
不能因为同一文件里别的门碰巧对了就类推 —— `[实测]` 这个文件里 `:80`（isDoomed）是对的、
`:68`（hasInfinity）是反的，**作者自己的理解前后不一致，所以没有任何一处可以类推**。

---

## C.51 判断 smali 分支极性前，必须先找一个语义已知的同型样本当基准 `[读码]`

### 一、结论

**这个项目里分支极性已经错了五次以上（`if-nez` 读反、`if-ltz` 用反、`if-gez` 用反），
靠「再仔细看一遍」治不住。**

### 二、可用的基准样本：`ju;->t(D)Z`（canAfford）

`work/base_decoded/smali/ju.smali:314-350`，全文十几行，语义无歧义（「买得起吗」）：

```smali
invoke-virtual {p0, p1, p2}, Lkajfosz/antimatterdimensions/BigDouble;->compareTo(D)I
move-result p0
if-ltz p0, :cond_0      # 只有「小于零才跳」时，下面这行才可能成立
const/4 p0, 0x1
return p0               # IP >= cost → 返回 true
:cond_0
const/4 p0, 0x0
return p0
```

反推出的对照表（**背表没用，要用它去校准每一处新代码**）：

| 指令 | 跳转条件 |
|---|---|
| `if-ltz` | 值 **<** 0 |
| `if-gez` | 值 **≥** 0 |
| `if-lez` | 值 ≤ 0 |
| `if-gtz` | 值 > 0 |
| `if-nez` | 值 **≠** 0 |
| `if-eqz` | 值 **=** 0 |

用它校准过 `UpgradeableAutobuyerState->v()Z`（`cmpg` + `if-gtz`）、
`UpgradeableAutobuyerState->A(Z)` 首行 `if-nez`、`autobuyer/a;->c()` 的 `if-nez`、
`OrekiStageAuto:211` 等同型门，四处全部自洽。

### 三、规则

**任何要判断极性的新代码，先跑一遍这个基准，再下结论。** 不许凭记忆断言
「`if-nez` 就是 if zero」，也不许采信别人（包括 lead）给的极性判断而不复核。

> **补充（2026-10-31）**：本轮 lead 在把 C.50 交办出去时，自己违反了本条 ——
> 直接采信了上游的极性判断，没有跑基准样本，于是产出了一条机制完全错误的结论
> （「环形死锁」），写到一半才自己核出来。
> **规则对所有人都适用，包括写规则的人。**

---

## C.52 构建期断言只证明「指令在」，不证明「行为对」 `[读码 + 实机]`

### 一、结论

**`verify_au4b()` 的构建期断言全绿，而 AU4b 在运行期是死的（`mode` 恒 0、`xHighest` 恒 1）。**

`if-ltz` 用反之后（`OrekiStageAuto:515`），`amount < 10`（默认 `amount = 1`）时**直接 return**，
恰好绕过它唯一该处理的场景。`[读码]` `android/AD_Oreki_Edition_Android/scripts/build_mod.py:3382-3412`
的 `verify_au4b()` 共 **11 条 `assert`（其中一条在 `for` 循环里跑 3 次，合计 13 次检查）**，
没有一条能发现这件事，因为它们检查的是「`applyCrunchPolicy` 被调用了」「指令序列里有
`const/4 v1, 0x2`」这类**存在性**，不是**极性**。

> 注：交接时这条被记成「8 条断言」，实测是 11 条。数目不影响结论，但按 C.51 的规矩，
> 数字要写实测值。

### 二、更彻底的例证：`OrekiStageAuto` 七处

C.50 那七处（`:68` / `:86` / `:225` / `:320` / `:365` / `:515` / `AchAudit:68`）全是
**代码存在、断言全绿、运行期零执行**。这比 AU4b 单个更彻底：
整个类的代码都在包里，构建期检查一条都不会红，实机上它一次都没跑。

> 补记（C.54）：`AchAudit` 那一处实际是**相邻两行各错一次**，`:68` 只是其中一行；
> 只修这一行仍会停在「0 轮」或「1 轮」，见 C.54 的四象限表。

⇒ **一条在已知错误实现上也全绿的断言，不是断言，是装饰。**

### 三、规则（长期有效）

1. **每一个注入的条件跳转，必须配一条运行期日志，证明这条分支被走过。**
   门控表除数值外还要报**每类标记日志的行数**；没有分支日志的条件跳转，一律算未验证。
2. 凡「未生效」类结论，必须同时给**观测值**与**预期值**两个数
   （例：`mode` 观测 0 / 预期 2），否则下一轮无法判断是否修好。

### 四、归因更正

本轮曾把 `a22c83f` 里的 AU4b / 审计节流 / 144 位判成「agent-h 的成果」，
实际是 **agent-b 工作树里未提交的内容被 `git add` 一并收进了提交**。归因错了。

⇒ 规则：**`git add -A` 式提交会让「谁写的」与「谁提交的」彻底混淆，之后所有归因都失真。**
提交时必须按文件显式 `add`；如果一次提交包含他人的改动，commit message 要写明「含 X 的改动」。


## C.53 线上 `oreki.net` 实测 742.1 s 通关；线上与 HEAD 只差 4 个非玩法文件 `[线上实测]`

**结论：用户现在打开 `https://oreki.net`，能在 180 分钟内通关。742.1 s（12.4 min），相对 180 min 有 14.5 倍余量，不需要为了通关重新部署。**

`pelle-probe` 同款采样（1000 ms / 约 60 字段），直接访问线上域名，`localStorage.clear()` + reload 真实新档，10000×，上限 1800 s：

| 事件 | 线上 | 本地基线 |
|---|---|---|
| `player.break` 首真 | 5.1 s | — |
| 5 / 20 / 100 现实 | 69.1 / 228.0 / 668.1 s | 68.1 / 227.1 / 639.1 s |
| 进毁灭 | 694.1 s | — |
| **`isGameEnd` false→true** | **742.1 s** | 708~783 s |

收尾：`endState = 7.0745`、`log10(totalAM) = 1056.786`、`realities = 100`、`smOk=true`、`smDeg` 样本 0、`smErr=""`。翻转后 **120 s 全部样本仍为 true**。

### 一、线上与 HEAD 的差异：712 个文件全量比哈希

`src/**` 711 + `index.html` 共 712 个，逐个抓下来比 SHA-256：

| 结论 | 数量 |
|---|---|
| 去 CRLF 后哈希完全相同 | **702** |
| 真实差异 | **4** |
| 线上 404（HEAD 有、线上没有） | **6** |

四个真实差异**全部与推进/通关无关**：
`oreki-smart-executor.js`（只有注释 + `debugState` 的 `takeovers/takeoverWhileModuleActed/lastConflict` 三个计数器，`tick()` 执行路径未变）、
`oreki-smart-strategy.js`（`debugState()` 多返回两个字段）、
`OptionsGameplayTab.js`（阻塞空态文案）、
`oreki-tutorial-data.gen.js`（教程正文，25 个 id 一致）。

你点名的四项守卫**线上全在且与 HEAD 字节相同**：`oreki-break-infinity-gate.js:102` 的 `!Pelle.isDoomed`、`game.js:222` 的 AD5b、`oreki-endgame-automation.js`（38,794 B）、`game-end.js:59-60` 的 `OFFSET=1` / `TARGET_EXP=1e3`。

六个 404：`oreki-smart-strategy.json`、`oreki-tutorial-data.json`、`oreki-route-model.{json,gen.js}`、`oreki-dilation-probe.js`、`oreki-ec-probe.js`。HEAD 全树 `grep -rn` 确认**只出现在注释里，无任何 import**（运行时读 `.gen.js` 外壳）。

### 二、比对前必须先「让两边可比特」——CRLF 坑

**线上是 CRLF 行尾，不去掉会误判成「10/10 全不同」**（第一版就踩了，差点得出"线上和 HEAD 完全不一样、必须重新部署"的反向结论）。

⇒ 规则：**比对的第一个动作是「让两边可比特」，不是「直接比」。** 行尾、BOM、编码、路径分隔符都先归一化。

⇒ 规则：**线上验收不能只看首页能不能开。** 全量比哈希 + 逐个 fetch，才能回答"线上跑的是哪一版代码"。

### 三、线上真 bug：`version.txt` 路径错 + 没有 `.catch()`

`src/core/intervals.js:67-76` 的 `checkForUpdates`：
- `fetch("version.txt")` 从 `/index.html` 解析成 `/version.txt` → **404**；文件实际在 `/public/version.txt`（`curl` 实测 200 且是合法 JSON，`version: 11.5`）；
- **没有 `.catch()`** → 每 60 s 一条 `Uncaught (in promise) SyntaxError: Unexpected token '<' ... is not valid JSON`；
- ⇒ 线上「有新版本请刷新」这个功能等于死了。

**副作用（对我们自己有害）**：它污染 `pageErrors` 计数。实测 **2 条 / 140 s，即每 60 s 一条**，全程 863 s 约 14 条。以后任何线上验收的 `pageErrors` 都要先扣掉这一项，否则会把噪声当成故障。

⇒ 规则：**所有 `fetch` 必须有 `.catch()`。** 一个必然失败的请求如果不吞掉，就会长期污染错误计数，让后来的人分不清「真故障」和「已知噪声」。

### 四、倍率口径（必须和秒数一起出现）

`oreki-game-speed` 到 **t=733.1** 才第一次升档（20000），739.1 → 40000（`gameEnd` 就发生在这一档），800.1 → 80000。

⇒ **742 s 里 733 s 是默认 10000×，只有最后 9 秒被动态速度抬到 2~4×；全程 10000× 会略晚一点。**
**任何通关秒数都必须带这句，不能单独引用数字。**

### 五、Web 端通关读数汇总（六次）

| 来源 | 通关 | 采样 |
|---|---|---|
| `pelle-probe` 基线 | 708.1 s | 基线 |
| S3 轻采样 教程开 | 721.5 s | 轻 |
| 线上 `oreki.net` | **742.1 s** | `pelle-probe` 同款 |
| S3 轻采样 无教程 | 769 s | 轻 |
| R40-A5 `r40a5-arm2` | 783.1 s | 1 s |
| R40A6 `run1`（HEAD） | 915.8 s | 1 s |

跨度 708~915.8 s。**采样最密的那次（R40A6，958 条）最慢**，与 C.46「采样强度影响结论」一致。


## C.54 `OrekiAchAudit` 是**相邻两行各错一次**，只修一行仍然等于没修 `[读码 + 实机]`

### 一、结论

`OrekiAchAudit.tick()` 开头两处条件跳转**都写反了**，而且症状**不独立、互相遮蔽**。
agent-k 报的是第 8 个判断（`:go` 那处），agent-b 报的是它上面那处（`:first` 那处），
**两人各看到一半，谁都不是「唯一根因」**。我上一轮据 agent-b 的说法写下「真根因不是 `:68`」，
**这句也是错的**，本条更正。

### 二、四象限推演（极性语义已按 C.51 基准样本核对）

基准：`if-eqz` = v==0 才跳、`if-nez` = v!=0 才跳、`if-ltz` = v<0 才跳、`if-gez` = v>=0 才跳。

| `:first` 处跳转 | `:go` 处跳转 | 首调用 | 之后 | 结果 |
|---|---|---|---|---|
| `if-nez`（原） | `if-ltz`（原） | 不跳，elapsed=now 巨大 → 不跳 → return | 同左，`sLast` 永远是 0 | **0 轮，审计从不执行** |
| `if-nez`（原） | `if-gez`（已修） | 不跳，elapsed 巨大 → 跳 `:go` → 跑一轮并写 `sLast` | `sLast!=0` → 跳 `:first` 只记时间 | **恰好 1 轮** |
| `if-eqz`（已修） | `if-ltz`（原） | 跳 `:first` 只记时间 | elapsed 恒正 → 不跳 → return | **0 轮** |
| `if-eqz`（已修） | `if-gez`（已修） | 记时间 | elapsed≥5000 才跑 | **每 5 s 一轮** ✅ |

第三行的 `if-ltz` 还附带一个反向退化：若 `sLast` 一开始就是非零（读档），
`elapsed < 5000` 时才跑去审计、且 `:go` 立刻把 `sLast` 刷成 `now`，于是下一帧 `elapsed` 又很小
⇒ **节流彻底失效，退化成「每次调用都跑」**（≈19 Hz）。

⇒ **同一处的两个极性错误可以互相抵消成一串不同的伪现象**（0 轮 / 1 轮 / 满负荷）。
看到「只跑了 1 次」就断定根因在相邻某一行，是把**共模故障**当成了单点故障。
**修极性错误必须把同一个方法的每一个条件跳转逐一过一遍，不能修到现象消失就收工。**

### 三、观测值与四象限的吻合

实机 220 s：`OREKI_GATE` **恰好 1 行**、`OREKI_ACHAUDIT` **恰好 37 行**（36 `MISMATCH` + 1 `DONE`）。
只有第二行（`if-nez` + `if-gez`）能同时解释这两个数 —— 即当时的包是**已经修了 `:go`、还没修 `:first`**。
这条对齐本身就是证据：如果只是「logcat 被冲」，`OREKI_GATE` 不会恰好是 1，而是 0 或很多。

### 四、归因（按 C.52 §四 的规矩）

| 内容 | 谁 |
|---|---|
| `:go` 处 `if-ltz`→`if-gez` | **agent-k** 发现（C.50 第 7 项） |
| `:first` 处 `if-nez`→`if-eqz` | **agent-b** 发现并落盘 |
| 「agent-b 是唯一根因」这个说法 | **我（lead）写的，错，本条作废** |
| 「审计每次 tick 都在跑」这个说法 | **我（lead）上一轮说的，错**（0 轮或 1 轮，从不是满负荷） |

### 五、规则（长期有效）

1. **一个方法的条件跳转错误按「类」修，不按「现象」修。** 修完必须能回答「这个方法还剩几个条件跳转、每个的极性依据是什么」。
2. **现象数目（0 轮 / 1 轮 / N 轮）是判据，不是噪声。** 三个不同的轮数对应三种不同的极性组合，能反查哪几处错了。
3. 队友报「真根因是 X 不是 Y」时，**先自己把 X 和 Y 都推一遍四象限**。两个人各报一半的概率远高于一个人报了全部。




## C.55 正式 APK 的 SHA-256 与 R40 备份字节相同 ⇒ R41 的四个修复一个都没进正式包 `[实测]`

**`release/反物质维度.apk` 与 `release/备份-R40重建前-1911.apk` 是同一个文件内容**：

```
090b9adbd0b4f8ad0a1b799d151c11e6af207ea93c55e13ea40441ba67d69f43  release/反物质维度.apk
090b9adbd0b4f8ad0a1b799d151c11e6af207ea93c55e13ea40441ba67d69f43  release/备份-R40重建前-1911.apk
```

尽管 `反物质维度.apk` 的 mtime 是 `10-31 02:53`（比备份新了一天），内容一字未变。

⇒ **R41 的四个提交（`a97580c` 八处极性 / `720f145` TARGET=1001 / `81cc909` AchAudit 首轮 / `80261b7` 删 ipMultAuto）没有任何一个在正式包里。**

坐实这件事的旁证：R41 实测读数（`mode=2/xHighest=1e1`、`interval 150000→19440`）只能来自候选包，与正式包无关。候选包清单（SHA-256 前 16 位）：

| 路径 | 大小 | SHA-256 |
|---|---|---|
| `_b_build/out/反物质维度.apk` | — | `167e60e9f6c074f6` |
| `build/brake_probe/installed.apk` | 69,761,566 | `6b957726cab14f73` |
| `build/knives_stage/反物质维度.apk` | 69,790,387 | `67562279429c97a2` |
| `build/gate_stage/反物质维度.apk` | 69,786,291 | `4775b5e17ef66c9d` |
| **`release/反物质维度.apk`（正式）** | 69,745,182 | **`090b9adbd0b4f8ad`** |

⇒ 规则：**mtime 不能用来判断"这个包是什么版本"，只有 SHA-256 能。** 每次交付前必须报本地 SHA-256，并与「上一份有效版本」对比说明是否真的换了。

⇒ 规则：**正式包只能由主 Agent 提升**。子 Agent 的构建一律放自己的构建根，报路径 + SHA-256，不许直接写 `release/`。


## C.56 Android `GameEnd.endState` 读的是 `PelleRecords.totalAntimatter`，而该字段疑似没有玩法写入路径 `[读码，待 REA 证实]`

### 一、读的一侧已确证

`work/mod/smali/kajfosz/antimatterdimensions/celestials/pelle/b.smali` 的 `b()D` 就是 `GameEnd.endState`：

```
Player.p() → Celestials.d() → Pelle.h() → PelleRecords.a() → BigDouble
  +1 → log10() → +1.0 → Math.log10() → -1.0
再除以 ( Math.log10(TARGET) - 1.0 )
```

**读的是 `PelleRecords.totalAntimatter`，不是当前 `Currency.antimatter`。** 和 Web 同源（`game-end.js:65`）。

### 二、写的一侧搜索结果（`work/mod/smali` 全树）

`PelleRecords.totalAntimatter` 的写入点只有：

| 位置 | 性质 |
|---|---|
| `Player$PelleRecords.smali:50` | 构造函数初始化 |
| `Player$PelleRecords.smali:125` | setter `d(BigDouble)V` 本体 |
| `player/e.smali:13422` | 调 setter，**存档反序列化** |
| `ve3.smali:239` | 调 setter，`Lve3;` 工具类，看着也是存档/初始化路径 |

`ug2.smali:37483` 读了 `PelleRecords.a()`，但**没找到它后面调 `d()` 写回**。

### 三、Web 对照

`src/core/currency.js:215-217`：

```js
if (Pelle.isDoomed) {
  player.celestials.pelle.records.totalAntimatter =
      player.celestials.pelle.records.totalAntimatter.max(value);
}
```

**这是 Web 唯一的玩法期写入点**，挂在反物质货币的 setter 里。

### 四、如果成立，后果是什么

`totalAntimatter` 恒为初值 ⇒ `endState` 恒 0 ⇒ **即使 Break 了、AM 涨到 1e2000，也永远不会 `isGameEnd`**。
这条比 BreakGate 更上游：补 IP、买满、Break 都做对了，终点仍不动。

### 五、待办（不许用 rg 零命中当结论）

必须用 REA 对**原版对照 APK** 取证：`PelleRecords->d` 的引用链、`ug2` 那段是否写回、`ve3` 的真实用途。
结论出来前，本条只能标 `[读码]`，**不得**写成"已确认缺失"。


## C.57 部署清单缺 `src/core/oreki-route-model.gen.js`：直接发布会让主线模块 404 `[实测]`

### 一、事实

`src/core/oreki-smart-strategy.js:40` 有一行**静态** import：

```js
import routeModel from "./oreki-route-model.gen.js";
```

而 `web/_deploy/filelist.txt`（部署清单，862 项）里**没有这一项**。

线上现在没炸，是因为线上跑的是 `6e90ede` 时代的 `oreki-smart-strategy.js`（第 35 行只 import `./oreki-smart-strategy.gen.js`，没有 route-model）。
**一旦按当前 main 重新发布，`oreki-smart-strategy.js` 会因 404 加载失败，连带整条 import 链断掉。**

已补进 `filelist.txt` 第 862 行（紧跟 `oreki-smart-strategy.gen.js`），清单变为 863 项。

### 二、独立闭包检查（不依赖 `--dry-run`）

新脚本 `web/_tools/_r42/check_import_closure.py`：从入口 `src/main.js` 真实求静态 import 闭包，再拿闭包对清单。

```
从 src/main.js 可达 726 个模块
闭包内、但不在 filelist（补之前 1 个：src/core/oreki-route-model.gen.js；补之后 0）
filelist 里有、但源码不存在：0
源码里未被闭包引用、也不在 filelist：2（oreki-dilation-probe.js / oreki-ec-probe.js，探针，正确排除）
判定：PASS
```

**为什么不能只用 `--dry-run`**：`--dry-run` 回答的是「按清单同步会写哪些文件」，它把清单当成对的。
清单本身漏项时，`--dry-run` 只会安静地少写一个文件，不会报错。**必须独立求闭包再对清单。**

⇒ 规则：**每次发布前跑一次 `check_import_closure.py`，必须 PASS。**

### 三、顺带发现的缺口：清单本身不在任何版本控制之下

- `web/_deploy/filelist.txt` 与 `web/sync_deploy.py` 都在 `web/AD-Oreki-Edition` 仓库**外面**；
- `web/` 与 `web/_deploy/` 都不是 git 仓库根（`git rev-parse --show-toplevel` 报 not a git repository）。

⇒ **决定"发什么"的那份清单没有历史**。和 C.49（`_tools` 不在版本控制）是同一类缺口，但影响更大：改错一个字符就能让线上少一个模块，且事后无法追溯是谁改的。

（本条只记录事实与建议，修法待定：把 `sync_deploy.py` + `filelist.txt` 移进某个仓库，或至少给清单加一份入库快照 + 校验。）


## C.58 Pages 与 Web main 的真实差异只有 5 个文件；先归一行尾，否则会得出反向结论 `[实测]`

### 一、差异清单

`diff -rq` 直接比 `_deploy/site` 与 `AD-Oreki-Edition` 会报 **40+ 个文件不同**。
按 CRLF→LF 归一化后重新比哈希，真实差异只有 **5 个**：

| 文件 | 性质 |
|---|---|
| `src/core/intervals.js` | `dea0f47` 的 `version.txt` 修复，**尚未部署** |
| `src/core/oreki-smart-executor.js` | 与 C.53 一致的调试计数差异 |
| `src/core/oreki-smart-strategy.js` | 新增 route-model import（见 C.57） |
| `src/core/oreki-tutorial-data.gen.js` | 教程正文 |
| `src/components/tabs/options-gameplay/OptionsGameplayTab.js` | 阻塞空态文案 |

只在 main 有的 6 个：`oreki-dilation-probe.js`、`oreki-ec-probe.js`、`oreki-route-model.gen.js`、`oreki-route-model.json`、`oreki-smart-strategy.json`、`oreki-tutorial-data.json`。
**后五个里，只有 `oreki-route-model.gen.js` 是运行时依赖（C.57），其余是 `.gen.js` 的源文件或探针，正确排除。**

### 二、规则

**这就是 C.53 §二 那条"比对前先让两边可比特"的第二次实证。** 这次是同一条规则反向作用：不归一化会得到「40+ 个文件不一样、必须整站重发」的假警报。

⇒ 规则：**做部署差异比对，第一个动作永远是归一化行尾，不是直接 `diff -rq`。**

## C.59 **原版 Android 移植本身就不记录 `PelleRecords.totalAntimatter`**，`endState` 在 Android 上恒 0 `[REA 实测]`

### 一、结论

**Android 端（含原版对照 APK）`PelleRecords.totalAntimatter` 在玩法路径上没有任何写入点。**
`GameEnd.endState` 读的正是这个字段，所以 **`endState` 恒 0，终局判定在 Android 上物理不可达**——
与 Break、与自动化、与倍率都无关。

这不是「我们改坏的」，是**原版移植本身缺这一环**。

### 二、REA 取证（本轮实跑，非历史引用）

| 项 | 值 |
|---|---|
| `bash scripts/rea.sh doctor` | jadx `healthy`（Hopper/Ghidra/IDA 缺失属正常） |
| `inspect-android-class` 目标 | `release/对照组_原版仅移除Google.apk` 的 `Player$PelleRecords` |
| evidence_id | `ev_36243241b72bc353e851c315fff19b29d5bc1a69d7c52a56495573aa509ef012` |
| APK sha256 | `d7860864582cb5dff07baf161d20b0c7ee2db5498353705eee7a29802393476a` |
| class_count | 20017 |
| 类结构 | 字段 3 个（`totalAntimatter` / `totalEternityPoints` / `totalInfinityPoints`）；getter `a()/b()/c()`；setter `d()/e()/f()` |
| setter 本体 | 裸 `iput-object`，**没有 `max()` 语义** |
| `trace-android-references --method-name d` | evidence_id `ev_4639a43895bea3b4cd15a9711948747b9f3a6c0473b703a866b6c62d154c52fc`，`total: 2`，`coverage: complete` |

两处调用者：

| 位置 | 真实身份 |
|---|---|
| `kajfosz.antimatterdimensions.player.e.m()V`（dex offset 3310） | **存档反序列化**：`e.smali:13389-13422` 读 `"records"` → `"totalAntimatter"` → `e.a(h32)` 转 BigDouble → setter |
| `defpackage.ve3.b()V`（dex offset 68） | **佩勒打击 #5 的触发器**：`ve3` 持 `a:B`（打击序号），`a()` 读 `Pelle.d()` 的 BitSet 判是否已发生；`b()` 里吐 `you_encountered_pelle_strike` toast、`PelleCollapsed.b(false)`，然后 **`if (a == 5)` 才**把 `records.totalAntimatter` 置成常量 `Llu;->r4`（`totalInfinityPoints` 置 `Llu;->n4`）。**是「打击 5 = 清空记录」，朝下清，不是朝上记。** |

`ug2.smali:37440-37530`（统计展示）全段只有 `a()` / `c()` 取值拼字符串，**没有任何 setter 调用**，与 REA 的 `total: 2` 互相印证。

### 三、断口在哪里

Web `src/core/currency.js:211-217`：

```js
player.records.thisInfinity.maxAM = player.records.thisInfinity.maxAM.max(value);
player.records.thisEternity.maxAM = player.records.thisEternity.maxAM.max(value);
player.records.thisReality.maxAM  = player.records.thisReality.maxAM.max(value);

if (Pelle.isDoomed) {
  player.celestials.pelle.records.totalAntimatter =
      player.celestials.pelle.records.totalAntimatter.max(value);
}
```

**Android 的反物质 setter 有前三条 `maxAM`，没有第四条。**

### 四、为什么必须修，且为什么不能用「每帧采样」糊过去

修它是**恢复原版（Web）既有机制**，不是给自己开口子：判定仍要求「在毁灭态下真实产量把 AM 推到 1e1000」。不修则永远不可达；修了也不降低任何门槛。**这不属于伪造完成位。**

但**禁止用 tick 采样代替**：Web 是「每次赋值就抬峰值」，采样是「每帧读一次」——`endState` 要的正是**历史峰值**，帧内峰值恰恰是被采掉的那个值。而且它**测不出来**：跑 200 秒一切正常，直到进佩勒才发现永远差一口气。属于 C.52「断言全绿但行为不对」的同一族。

⇒ 必须在 setter 路径上做**等价移植**，且 `max()` 语义必须保留（裸 `d(value)` 会变成「最后一次赋值」，比不记录更糟）。

### 五、未验证的部分（不许含糊）

本轮**无法完整验证**这条修复，因为 Android 新档要走到佩勒才用得上它。
在 Android 真能进佩勒之前，这条只能标 `[读码等价移植]` + `[未实测-需进佩勒]`，**不得写「已修复」**。

诊断入口：`OREKI_PELLE_REC rec=<log10> am=<log10> doomed=<0|1>`，30 秒一行。
现在必须是 `doomed=0 / rec=0`；若 `rec` 在非佩勒局里上涨，说明 `Pelle.isDoomed` 谓词判反了（那是红线，会导致正常局刷 `endState`），必须立即停。

### 六、附带确证：Break 之后间隔是免费拉满的

`autobuyer/a;->c()V` 是 `while (!v()) A(true)`，`A(true)` 走**免费**分支，不扣 IP。原版 Break 按钮点完就调它。

⇒ **32767 IP 的用途被精确限定在「够到 Break 那一刻」**，Break 之后 15 级不再需要钱。
⇒ 补贴额只能覆盖「到 Break 为止」的差额，把 Break 之后的级数也算进去就会多补。

原版 Break 按钮的真实执行序列（从 `MainActivityBreakInfinityKt$loadViewsBreakInfinity$1$1.smali:126` 抠出，`const/4 v3,0x1` 处）：

```
if (!Player.m()) {
  if (CrunchAutobuyerState.v()) {
    Player.x0(true);
    g61.a("BREAK_INFINITY");
    autobuyer.a.c();
  }
}
```

四点齐全：已 Break 守卫 / 间隔已满守卫 / `x0(true)` / 事件 / `a.c()`。
**`a.c()` 不许省**——省了它，Break 后其它自动购买器的间隔仍是初始值，后续阶段会被拖死。

---

## C.60 教程 ch05 原先只写「间隔已到 100 毫秒」这个结果，没写怎么到；补齐后需要 15 级 / 32767 IP `[实测 + 读码]`

### 一、事实

`web/AD-Oreki-Edition/src/core/oreki-tutorial-data.json` 的 ch05（第 5 章 打破无限）在本轮之前：

- `entry` 只有一句「大坍缩自动购买器的间隔已到 100 毫秒（这是 Break 的硬前置，不是 Break 的奖励）」——**把目标写成了前置**，玩家读到的第一句就是「你还没到这个章」；
- `numbers` 里**没有任何一条**间隔数值（150000 / ×0.6 / 15 级 / 32767）；
- `challenges` 是 `null`；
- `automation` 引用的 AU6 行号是 `src/core/oreki-autobuy-break-infinity.js:39-55`，**该文件一共只有 32 行**，引用是错的。

补齐后（提交 `ad8ffeb` / Android assets `986dcac`），`numbers` 里新增 6 条间隔数值，`steps` 从 6 条扩到 8 条，`traps` 从 3 条扩到 5 条，`challenges` 由 `null` 改为两条硬约束。

### 二、数字出处（全部已逐行核对）

| 数字 | 值 | 出处 |
|---|---|---|
| 大坍缩自动器初始间隔 | 150000 毫秒 | `src/core/player.js:81-83`（`bigCrunch: { cost: 1, interval: 150000 }`） |
| 每级间隔 | ×0.6，`Math.clampMin(…, 100)` | `src/core/autobuyers/autobuyer.js:173` |
| 每级成本 | ×2 | `src/core/autobuyers/autobuyer.js:172` |
| 拉满级数 | 15（0.6^14 → 117.5 未到 100；0.6^15 → 70.5 被下限截成 100） | 按 `autobuyer.js:173` 逐级核算 |
| 累计成本 | 32767 = 2^15 − 1 | `src/core/oreki-break-infinity-gate.js:51` |
| 拉满判据 | `data.interval <= 100` | `src/core/autobuyers/autobuyer.js:165-167` |
| Break 硬前置 | `if (!Autobuyer.bigCrunch.hasMaxedInterval) return;` | `src/game.js:95` |
| Break 后免费拉满全部间隔 | `maxIntervalForFree()` 循环 | `src/game.js:97-99` |
| 挑战中禁止 Break | `if (InfinityChallenge.isRunning) return;` | `src/game.js:96` |
| 原版手动升间隔需先完成普通挑战 12 | `get canBeUpgraded() { return NormalChallenge(12).isCompleted; }` | `src/core/autobuyers/big-crunch-autobuyer.js:30-32`；按钮模板 `AutobuyerIntervalButton.js:39-52` |

### 三、MOD 与原版的差异（教程里必须讲清，否则「按钮消失」会被当成 bug）

`upgradeInterval()`（`autobuyer.js:169-177`）**没有 `canBeUpgraded` 门控**，唯一门槛是 IP 余额。
所以 MOD 的闸门可以直接无视「普通挑战 12」这条 UI 前置连买 15 级，玩家在自动购买器开着时会看到按钮自己消失。

### 四、规模

补齐后：Web `validate_tutorial.mjs` **2176 项全通过**；Android `oreki_tutorial_gen.py` 生成 **18 章 / 847 条 / 26047 汉字 / 118161 字节**，回读校验逐字一致。

---

## C.61 Web 教程五项渲染验收实测结果（18 章 / 7 附录 / 10 态定位 / 最长章 / 字号）`[实测]`

### 一、实测环境

宿主机 Edge（CDP）+ puppeteer 设备模拟，`node _tools/_r42/tut-accept.mjs`、`tut-stage.mjs`。
截图与 JSON 报告在 `web/_tools/_r42/shots/`、`web/_tools/_r42/tut-*-report.json`。

### 二、逐项

| 项 | 结果 | 证据 |
|---|---|---|
| 18 章逐章可阅读 | 通过：18 章全部打开，正文字符数 **1571 ~ 5731**，占位卡 0、草稿章 0 | `tut-accept-report.json → items.chapters` |
| 7 篇附录入口 | 通过：`.c-oreki-tut__nav-btn--apx` 恰好 **7** 个，逐篇点开正文 **2640 字**以内均非空，副标题均含「附录」 | `items.appendices` |
| 按 stage() 定位 | 通过 **10/10**：新档→ch01、有维度提升→ch02、有星系→ch03、未打破→ch04、已打破 IP=1e0→ch05、IP=1e12→ch06、永恒→ch07、现实→ch11、天神→ch13、佩勒→ch16 | `tut-stage-report.json` |
| 长章不截断 | 通过：最长 **ch09（5731 字）**，内容区 `scrollHeight 5087` vs `clientHeight 338`，滚到底后末块 `bottom=642 < 视口 844`，`atBottom=true` | `items.longest` |
| 字号三档 | **Web 无此功能**，按 `docs/教程数据结构说明.md`「双端渲染差异」表 Web 侧就是固定字号；实测 `.c-oreki-tut__text` 恒为 `12.5px`，页面内不存在任何字号控件，CSS 变量 `--oreki-tut-font-scale` 为空 | `items.font` |

### 三、定位的方法学（否则会得出反向结论）

第一次用「改 `player` 状态 → 打开教程」测定位，5 个状态**全部**落在 ch07。原因不是定位错：
这款 MOD 默认 10000× 速度，测试跑 1~2 分钟游戏自己就推进到永恒了。
正确做法是先 `player.auto.autobuyersOn = false` 冻住自动机，再在**同一个 `page.evaluate`** 里改状态并立刻 `show()`，避免中间夹进一次 tick。改完后 10/10 全对。

---

## C.62 Web 七宽度 + 横屏实测：整页横向溢出 0，触控档无 <44px 按钮；320 宽教程底栏贴边但不溢出 `[实测]`

### 一、结果

| 宽度 | 整页横向溢出 | 越界元素 | <44px 可点元素 | 教程弹窗 | 长章滚到底 |
|---|---|---|---|---|---|
| 320 | 无 | 0 | 0 | 未超出视口，底栏可见 | 是 |
| 360 | 无 | 0 | 0 | 同上 | 是 |
| 390 | 无 | 0 | 0 | 同上 | 是 |
| 430 | 无 | 0 | 0 | 同上 | 是 |
| 768 | 无 | 0 | 0 | 同上 | 是 |
| 1280 | 无 | 0 | **6** | 同上 | 是 |
| 横屏 844×390 | 无 | 0 | 0 | 同上 | 是 |

### 二、两个需要说明的点

1. **1280 那 6 个 <44px 的全部是桌面布局按钮**（「买到 10 个」30px、「维度献祭」25px、「计数频率价格」25px、「购买最大数量」25px、教程入口 36px）。
   44×44 是触控下限，桌面宽度不适用；触控档（≤430 与横屏 844×390）实测 **0** 个不达标。
2. **320 宽教程底栏贴边不溢出**：底栏 `scrollWidth == clientWidth == 274`，「下一章」右缘 297 = 弹窗右缘 297，间隙 0px。
   排版不破，但零余量——再窄 1px 就会溢出，属于需要盯的临界值。

### 三、表格

第 5 章对照表在所有宽度都**在自己的滚动容器内**（`table.right < scrollBox.right`），不存在撑破整页的情况；
宽度随容器走（320→270px、768→718px、1280→500px），没有出现「表格固定宽度把页面撑宽」。

---

## C.63 侧栏按真实进度动态显示：新档 5 项，解锁后 10 项齐全、无重名、无空页 `[实测]`

- 全新存档侧栏：`维度 / 自动化 / 成就 / 统计数据 / 选项`（5 项）。挑战、无限、永恒、现实、天神**都不出现**——符合「按真实进度动态显示」。
- 注入最高阶段（无限/永恒/现实各 1、`Teresa.pouredAmount=1`、`Achievement(147).unlock()`、`player.celestials.pelle.doomed=true`）后：`维度 / 自动化 / 挑战 / 无限 / 永恒 / 现实 / 天神 / 成就 / 统计数据 / 选项`（10 项），**缺项 0、多项 0、重名 0**。
- 逐项点开，`.c-game-tab` 正文长度 86 ~ 3358 字，**空页 0**。
- 新闻条：`#news / .c-news-ticker / [class*=news-ticker]` 节点数 **0**，DOM 里就不存在，符合「Web 关闭新闻」。

一个坑：侧栏的点击处理器挂在 `.l-tab-btn-inner` **自己**身上（`src/components/ui-modes/modern/ModernTabButton.js:54`），
点它的父 `div` 不会切页——第一次扫描时 10 个页面正文长度全是 638，就是这么来的。

---

## C.64 AVD `oreki_test` 在 `-gpu swiftshader_indirect` 下会出现「应用在跑但 screencap 冻结」`[实测]`

现象：`adb exec-out screencap -p` 连续 4 次取到**同一帧**（md5 完全相同），
期间 `logcat` 里 `OREKI_GATE` / `OREKI_ACHAUDIT` 仍在正常输出、`dumpsys window` 的 `mCurrentFocus` 也是本应用，
`dumpsys power` 为 `mWakefulness=Awake`。连按 `KEYCODE_BACK` 也不出帧。

⇒ 画面管线（SurfaceFlinger 合成）卡住，**不是应用卡住**。
⇒ 结论：在这个 AVD 上做 UI 验收时，一旦发现 screencap 与 logcat 行为不一致，应判定为**装置故障**并重启模拟器，不要据此得出「界面没反应」。
⇒ `uiautomator dump` 在这个应用上还有独立问题：`ERROR: could not get idle state`（画面持续动画，永远不 idle），不要去重试它。

---

## C.65 装机 APK 的教程正文是**空的**：`assets/oreki_tutorial.txt` 没进包，界面显示「教程正文缺失（行数 0 / 章节 0）」`[实测]`

### 一、现象（`oreki_test` AVD，装的是 3.19.0 / 2026-10-30 19:42 那个包）

从「选项 → 打开 Oreki 中文教程」进去，界面只有 7 个节点：

```
TextView  Oreki 教程
Button    关闭
Button    打开 OREKI 设置
Button    字号 小 / 字号 中 / 字号 大
TextView  教程正文缺失（行数 0 / 章节 0 / 异常 null）：请重装完整安装包，并把这一行反馈给打包的人。
```

⇒ 章节页签一个都没有，「18 章可阅读」「7 篇附录入口」在**当前装机包上都不成立**。
⇒ 这不是教程代码坏了：MOD 自己的守卫把「正文为空」如实报出来了，报错文案还指明了下一步动作。守卫是好的，**坏的是打包**。

### 二、根因（已核对）

`release/反物质维度.apk`（2026-10-31 02:53，69.7 MB）里 `assets/` 共 **22 项**，
逐个列出：`dexopt/baseline.prof(m)`、`fonts/*`(17)、`realityanimbg_*.mp4`(4) —— **没有 `oreki_tutorial.txt`**。

而同一时刻磁盘上：
- `scripts/payload/assets/oreki_tutorial.txt` 存在（118161 字节，本轮重新生成）
- `work/mod/assets/oreki_tutorial.txt` 也存在（114149 字节，03:15，**比 APK 的 02:53 还晚**）

⇒ 那个 APK 是「资产还没生成 / 还没拷进工作树」之前打的，不是资产的锅，是**打包顺序**的锅。
⇒ 现在两个位置的资产都已就位，**下一次 `build_mod.py` 全量构建应当能进包**，但必须在构建后自查：

```bash
python -c "import zipfile;z=zipfile.ZipFile(r'release/反物质维度.apk');print([n for n in z.namelist() if 'oreki_tutorial' in n])"
```

输出为空就是没进包，不要装机验收。
`build_mod.py:3795` 的 `TUTORIAL_ASSETS` 与 `build_mod.py:3875/3905` 的字节断言只在**生成阶段**，不校验**产物 zip**，这是漏检的缝。

### 三、影响

Android 侧「教程渲染五项验收」的第 1、2、4 项在当前包上**无法通过**（不是没测，是没有东西可测）。
第 3 项（stage 定位）与第 5 项（字号三档）不受影响，见 C.66。

---

## C.66 Android 教程字号三档真实生效：同一段文字高度 222 / 261 / 420 px `[实测]`

> **⚠ 本条结论部分作废（2026-10-31 10:2x 自查 + team-lead 指出）。**
> 下面量到的那段文字，`bounds` 是 `44,686,1036,947`、内容是「教程正文缺失（行数 0 / 章节 0 / 异常 null）：请重装完整安装包……」，
> **是红色诊断文案，不是教程正文**（见 C.68：四处判空极性写反，正文一次都没渲染过）。
> 「字号设置能改变字号」这个结论仍然成立（三档读数两两不同，小/中比例 0.851 命中源码系数 0.85）；
> 但「Android 教程正文的三档字号生效」**未验证**，必须等极性修复包重测。
> 重测口径：行数 > 0 且 章节 > 0、量某一章真实正文段落、三档都要能在控件树里读到同一段的 `bounds`。
> 脚本 `web/_tools/_r42/android-tutorial-accept.mjs` 已按这个口径写好硬门禁。

### 一、方法

正文为空不影响量字号：界面上的报错文案本身就是正文 `TextView`。
固定宽度（992 px）下切换 小 / 中 / 大，从无障碍控件树读 `bounds`，用**同一段文字的高度**做判据。
（装置画面在 `-gpu swiftshader_indirect` 下会冻结，见 C.64，所以走的是控件树不是截图。）

### 二、读数

| 档位 | `bounds` | 高度 |
|---|---|---|
| 字号 小 | `44,686,1036,908` | **222** |
| 字号 中 | `44,686,1036,947` | **261** |
| 字号 大 | `44,686,1036,1106` | **420** |

- 小/中 = 222 / 261 = **0.851**，与源码系数 **0.85** 对得上（`scripts/payload/smali/…/oreki/tutorial/TutorialActivity.smali:1747` 注释「小 0.85 / 中 1.0 / 大 1.2」，`0x3f59999a  # 0.85f` 在 `:1769`；原记 `:1709` 已漂移，2026-10-31 复核）。
- 大/中 = 420 / 261 = 1.609 ≠ 1.2，原因是**换行**：字号变大后这段文字从 2 行变 3 行，高度不是纯比例。
  ⇒ 「三档真实生效」成立（三档读数两两不同，且小/中比例精确落在系数上），但**不要**用 大/中 的比值去反推系数。

### 三、入口

三档按钮在教程界面顶部同一条，等分 1080 宽：`0,466,360,598` / `360,466,720,598` / `720,466,1080,598`（各 360×132 px，远大于 44dp）。
点击后立即重绘当前章，无确认框。

## C.67 逐包清点 `assets/` 是判定「这个 APK 到底是什么」最快的手段 `[实测]`

### 一、清点结果（2026-10-31 09:5x）

| APK | mtime | `assets/` 项数 | 含 `oreki_tutorial.txt` |
|---|---|---|---|
| `release/反物质维度.apk`（**正式**） | 10-31 02:53 | **22** | **✗** |
| `build/brake_probe/installed.apk` | 10-31 01:17 | 22 | ✗ |
| `build/gate_stage/反物质维度.apk` | 10-31 **02:14** | **24** | **✓** |
| `build/knives_stage/反物质维度.apk` | 10-31 03:19 | 24 | ✓ |
| `_h_build/release/反物质维度.apk` | 10-31 03:21 | 24 | ✓ |
| `_b_build/out/反物质维度.apk` | 10-31 **05:39** | 24 | ✓ |

### 二、这张表推翻了一个极易犯的因果假设

`build/gate_stage` 是 **02:14** 打的，已经含 `oreki_tutorial.txt`；
而 **mtime 更晚（02:53）的正式包反而不含**。

⇒ **正式包不是 02:53 那次构建的产物，它是旧包的复制。** 这与 C.55 的 SHA-256 结论（= `备份-R40重建前-1911.apk`）完全吻合，两条独立证据指向同一件事。

⇒ 规则：**看到一个「新 mtime」的 APK，先用 `zipfile` 列一遍 `assets/`，再谈它是什么。**
资产项数（22 vs 24）比 mtime 可靠得多，也比「文件大小差不多」可靠得多。

### 三、「教程正文是空的」的真正原因

装机包（`release/`，22 项资产）里没有 `oreki_tutorial.txt`，所以 AVD 上教程界面只剩 7 个节点、正文 0 行（C.65）。

**这不是教程生成流程的 bug，是「装错了包」。** 05:39 的 `_b_build/out/反物质维度.apk` 带完整资产，可以直接用来做教程视觉验收。

### 四、仍然存在的真缺口：产物 zip 没有断言

`build_mod.py` 的 `TUTORIAL_ASSETS` 断言只校验**生成阶段**（`work/mod/assets/` 里有文件），**不校验产物 APK 的 zip 里有没有**。
⇒ 生成成功但打包漏掉时，构建全绿、包是坏的。

⇒ 规则：**构建收尾必须有一句产物级断言**（本轮改为强制步骤）：

```bash
python -c "import zipfile,sys;n=zipfile.ZipFile(r'release/反物质维度.apk').namelist();print([x for x in n if 'oreki_tutorial' in x])"
```

输出为空 ⇒ **不许装机验收、不许发布**。

## C.68 Android 教程正文「从未显示过」：`TutorialActivity` 四处判空极性全部写反 `[读码 + 实机]`

### 一、现象与一个决定性的旁证

装机包进「选项 → 打开 Oreki 中文教程」，界面只有 7 个节点，正文区显示
「教程正文缺失（行数 0 / 章节 0 / 异常 null）」。

先排除打包问题：**设备内 `base.apk` 里的 `assets/oreki_tutorial.txt` 是 114149 B、839 行、LF、UTF-8、首行正常**
（`adb pull` 后解包核对）。资产是好的。

**决定性旁证**：`:open_fail` 与 `:read_fail` **两条失败路径都会写 `diag`**。
界面 `diag` 为 `null` ⇒ 两条失败路径都没走到 ⇒ **资产打开成功、第一行读出来了，是循环自己跳走的**。

⇒ 规则：**「失败信息为空」本身就是证据。** 一个把异常写进 UI 的组件，只要它显示「异常 null」，
就说明它根本没走进 catch —— 这时不要再去查 IO、查权限、查打包。

### 二、四处都是 `if-eqz` / `if-nez` 写反（同一族）

| # | 位置 | 错写 | 后果 |
|---|---|---|---|
| 1 | `:read_loop` 读循环 | `if-nez v1, :read_end` | 读到**非 null 行**就跳走 ⇒ 循环体一次不执行 ⇒ `lines.size()==0` |
| 2 | `:close_stream` | `if-nez v0, :done` | reader 非 null 时跳过 `close()` ⇒ 流永不关闭（句柄泄漏，与正文无关但同病） |
| 3 | `indexChapters` 入口 | `if-nez v0, :no_lines` | `lines` **有内容**时反而跳去 `:no_lines`（`chCount=0`）⇒ 即使读循环修好，章节索引也一个都建不出来 |
| 4 | 第二遍填充 / 记录渲染 | `if-nez v6, :fill_next`、`if-nez v8, :rec_next` | 把**所有带标签的行**全跳过 ⇒ CH 分支与记录块渲染永远走不到 |

四处均改为 `if-eqz`（= 为零才跳）。

第 3、4 处**特别值得记**：只修第 1 处，「行数」会从 0 变成 839，但「章节」仍是 0、正文仍渲染不出来。
**症状会变成「有行数没内容」，比全 0 更容易被误判成修好了。**

### 三、极性的依据（`tagCode` 编码表）

`tagCode(String)I`：`CH`→1、`TITLE`→2、`SUB`→3、`STAGE`→4、其余记录标签→5+、**无标签→0**。
第一遍计数用的是 `if-eq v6, 1, :count_next`（tagCode == CH 才计数），
与「0 才是无标签」互为印证。所以第二遍「跳过无标签行」必须写 `if-eqz v6`。

**保留未改的一处**：`:no_header` 处 `if-nez v2` 里 `v2` 是 `stepHeaderDone:Z`，
「为真则跳过」是正确语义，不是笔误。**不是所有 `if-nez` 都错，必须逐个判语义，不能批量替换。**

### 四、为什么这四行能活这么久

`build_mod.py` 的 `[R40H]` 断言（`build_mod.py:3924-3960`）检查的是**接线存在性**：
`getAssets()` / `"oreki_tutorial.txt"` / `"oreki_tutorial.legacy.txt"` / `"\|"` / `split` /
`showChapter` / `buildTabs` / `openInitialChapter` / `stage()` / `saveFontSize`，
外加「`const-string` 里汉字 < 600」与「界面文案不许出现英文」。

**一条都不检查条件跳转的方向。** 于是 10 条断言全绿，教程从上线起就没显示过一行正文。

⇒ 这是 C.52「构建期断言只证明指令在，不证明行为对」的**第三例**（前两例：`verify_au4b` 全绿而 AU4b 是死的；`OrekiStageAuto` 七处全绿而整个类是死代码）。

⇒ 规则：**接线断言必须配一条「反写法不存在」的断言**，例如：

```python
assert "if-eqz v1, :read_end" in src, "读循环极性丢了"
assert "if-nez v1, :read_end" not in src, "读循环极性又写反了"
```

单靠「正确写法存在」不够——变异成另一种写法时前者仍可能命中子串。

### 五、连带影响：Android 字号三档的「通过」需要重新验

C.66 记的「同一段文字高 222 / 261 / 420 px」是在正文为空的状态下量的。
当时页面上唯一的长文本是**那行红色诊断信息**。字号随设置变化是真实的，但**量的不是教程正文**。

⇒ 修复后必须重测：量的必须是某一章的真实正文段落，并同时确认「行数 > 0 且章节 > 0」。

## C.69 一条能机械抓出「对象判空写反」的启发式；又抓到 `OrekiChallengeAuto` 两处 `[读码]`

### 一、启发式

```
move-result-object vX   （可隔空行与 # 注释）
        ↓
if-nez vX, :label       ← 可疑
```

**理由**：`move-result-object` 拿回的是对象引用，`if-eqz`（为零才跳）= 「拿到 null 才跳走」。
所以紧跟其后的守卫几乎总该是 `if-eqz`。写成 `if-nez` 等于「**拿到了才跳走**」，
通常意味着把「成功」当成了「失败」。

**必须跳过空行与注释行**才能用：这个代码库里这两句之间经常夹空行，
第一次跑（要求紧邻）在未修的旧副本上命中 0 处，是假阴性。

**验证方式**：拿一份**未修复的旧副本**跑，能命中已知的坏点才算数。
本次在 `android/_h_build/scripts/payload/smali`（未修）命中 3 处，其中
`TutorialActivity.smali:317` 是已确认的真 bug（C.68）—— 启发式成立。

### 二、在旧副本上命中的 3 处，逐个判语义

| 命中 | 判定 | 依据 |
|---|---|---|
| `TutorialActivity.smali:317` `if-nez v1, :read_end` | **错**（已修，C.68） | `readLine()` 非 null 就跳走 ⇒ 循环体不执行 |
| `TutorialEntry.smali:57` `if-nez v0, :ctx_ok` | **对**，不动 | `v0 = getApplicationContext()`；非空就用它，为空才回落到 `p0`。语义正好是「拿到了才去 ctx_ok」 |
| `OrekiChallengeAuto.smali:721` `if-nez v6, :fr_until` | **错**（已修） | 见下 |

⇒ 规则：**启发式只用来找候选，最终判定必须读上下文。** 3 处里 1 处是对的，
批量替换会把 `TutorialEntry` 改坏。

### 三、`OrekiChallengeAuto` 那两处：代码自己就是矛盾的证据

原写法：

```
invoke-virtual {v4, v6, v7}, ...studies/c;->D(ZLvh0;)Ljava/lang/Boolean;
move-result-object v6
if-nez v6, :fr_until          ← 非 null 就跳去兜底
invoke-virtual {v6}, Ljava/lang/Boolean;->booleanValue()Z
move-result v6
if-eqz v6, :fr_bought         ← 为零（false）才算买上
```

两行**都反了**，而且反得互相掩盖：

- `if-nez` 让「非 null」直接跳走 ⇒ 下面 `booleanValue()` **只在 v6 为 null 时可达** ⇒ **对 null 调 `booleanValue()` 就是 NPE**；
- `if-eqz` 让「false（没买上）」跳去 `:fr_bought` ⇒ **当成买好了，这一关再也买不上**；而「true（买上了）」反而白跑一遍 `purchaseUntil`。

⇒ 正常路径下（`D()` 返回非 null）表现是「每次都走整链补买」，
而 `:fr_bought` 这条快路是**不可达的死代码**。所以它能「看起来工作」，只是慢，
一旦 `D()` 返回 null 就会崩。

改为 `if-eqz v6, :fr_until` + `if-nez v6, :fr_bought` 后语义自洽：
null → `purchaseUntil` 兜底；非 null → 真则 `:fr_bought`（单击就买上，不跑昂贵路径），假则落 `:fr_until`。

### 四、为什么 `build_mod.py:2530` 那条断言没能拦住

断言是：

```python
assert ("...studies/c;->D(ZLvh0;)Ljava/lang/Boolean;|move-result-object v6|if-nez v6, :fr_until") in fill, (
    "[R40B] 单击购买失败后没有落到 :fr_until（purchaseUntil 兜底被删）")
```

它的**意图**是「失败后要落兜底」，但它把「失败」和「`if-nez`」绑在了一起，
于是**把错误的写法锁成了必须存在**。这就是 `stageKeyFor` 那次（`76692d8`）的同一个模式：
**守卫自己写反，构建越绿，bug 越稳。**

⇒ 规则：断言里出现条件跳转时，**断言必须同时覆盖「正写法存在」与「反写法不存在」**，
并且注释要写清「这个寄存器此刻代表真还是假」。
只写「某个带跳转的字符串必须出现」，等于给错误写法上保险。

---

## C.70 Web 的「智能策略」是查表，不是择优；`oreki-route-model.json` 从 R40 起是纯数据、无人读 `[读码]`

### 一、结论

`src/core/oreki-smart-strategy.js` 在 R42 之前的全部「决策」只有三行查表，
**没有任何「比较两条路线并选更优」的动作**：

| 行（HEAD `dd155f3`） | 做的事 |
|---|---|
| `:221-248` `detectStage()` | 按 `precedence` 取最大者；相等就 fail closed。没有比较。 |
| `:295-297` | `findById(spec.goals, stage.goal)` / `findById(spec.strategies, stage.strategy)`，单条取。 |
| `:336` | `priority: strategy.priority.slice()` —— 把 spec 里那个数组**原样**抄进决策对象。 |

执行层同样是线性扫这个数组取第一个可执行的：`oreki-smart-executor.js:283-292` `pickExecutable()`。
⇒ **顺序只在 spec 作者恰好写对时才对**，系统本身没有「还有别的走法」这个概念。

### 二、模型写了，解释器没写

`src/core/oreki-route-model.json`（182 行）已经完整定义了多路线择优：
`filter` 6 条硬过滤、8 个评分维度与权重、9 条带 `stageScope` 的路线、
`stability.minImprovementRatio = 0.15` / `cooldownSeconds = 300`、
`replan` 的 5 个触发条件、`interface` 的 8 个查询方法。

但 `rg -n "route-model" src/ scripts/` 在 R42 之前**只有一条命中**：
`scripts/gen_spec_module.mjs:31` 的生成登记表。也就是说这份模型被生成成
`oreki-route-model.gen.js` 之后，**从来没有模块 import 它**。
（C.53 也记过：这两个文件在线上是 404 —— 因为连 import 都没有，部署时漏了也没人发现。）

⇒ 规则：**「规则是数据不是代码」只保证数据不被写死，不保证数据被读取。**
交付一份 spec 时必须同时交付「谁 import 它」的机械证据（`rg` 一条命中都没有 ⇒ 等于没做）。

---

## C.71 智能执行层整局只产生 3~4 次真实购买；同口径通关 771.2 s → 756.0 s `[实测]`

### 一、执行层的真实吞吐（这是判断「值不值得优化它」的唯一依据）

`_r40/r42-base-head.jsonl`（HEAD `dd155f3`，真实新档，1000 s / 961 条，**无模拟器负载**）：

| 指标 | 读数 |
|---|---|
| `exTryN`（尝试次数） | **306** |
| `exActN`（真的买到） | **3** |
| 命中率 | 1.0% |
| 最后一次动作分布 | `runReality@reality:0` 828 条、`equipBestGlyph@reality:0` 28、`buyRealityUpgrade@reality:0` 34、`eternity@eternity:0` 40、`buyTimeTheorem@eternity:0` 24 |
| `takeoverWhileModuleActed` | **0**（购买权边界 B 在整局里没有被违反过） |

⇒ 在 771 s 的整局里，执行层**只买到 3 样东西**。所以「把 15 个 owned 动词重新排序」
这件事的**上限收益 = 3 次购买的时移**，不可能改变通关秒数量级。
这条同时解释了 R40-S2 报告里「贡献接近于 0」的自我评价是对的。

### 二、同口径前后对比（`pelle-probe` 1000 ms / 约 60 字段，10000× 起步）

| 轮次 | 代码 | 墙钟区间 | 宿主负载 | `isGameEnd` 首真 |
|---|---|---|---|---|
| baseline | HEAD `dd155f3` | 9:23:13–9:39:51 | 无 | **771.2 s**（`doomed` 724 s） |
| after-a | 路线层改动 | 9:40:39–9:57:18 | 无 | **756.0 s**（`doomed` 710 s） |

两轮 `isGameEnd` 翻真后分别 **227.8 s / 243.0 s** 持续为 true（225 / 242 条采样全 true），
`smDeg = 0`、`smErr = ""`、`pageErrors` 只剩 Google Tag Manager 的 CSP 噪声。

**756.0 与 771.2 的差（−15.2 s / −2.0%）不能算改进**：改动后每个阶段的 `strategy.priority`
与 spec 原序**逐字相同**（存活探针 `r42-route-peek-b`，8 个阶段全部 `rPriority === rSpecPriority`，
`routeSwitches = 0`），行为等价 ⇒ 这个差是跑分本身的抖动。
C.47 记的六次读数跨度 708~915.8 s，−2% 完全落在这个带里。

### 三、`doomed` 段与 `100 现实` 里程碑（供后续对照）

| 轮次 | 5 现实 | 20 现实 | 100 现实 | `doomed` | `isGameEnd` |
|---|---|---|---|---|---|
| baseline | 70.0 s | 257.0 s | 701.0 s | 724.0 s | 771.2 s |
| after-a | 68.1 s | 222.1 s | 686.1 s | 710.0 s | 756.0 s |

---

## C.72 Android 模拟器会把 Web 跑分拖到「1000 s 内未到 doomed」；判回归前先查 qemu 启动时刻 `[实测]`

### 一、现象

同一份代码、同一台机器、同一口径，第三轮（`r42-after-b.jsonl`，10:06:55–10:23:34）
**1000 s 内连 `doomed` 都没进**，而且在跑的是 `60 realities @999 s`
（前两轮是 `100 realities @701/686 s`）。表面上像一次 30% 的严重回归。

### 二、真实原因：两个 Android AVD 同时在跑

`Get-Process qemu-system-x86_64-headless` 的启动时刻：

| PID | 启动 | 检查时累计 CPU |
|---|---|---|
| 44224 | **9:58:49** | 8998 s |
| 36832 | **10:04:32** | 707 s |

而 baseline（9:23:13–9:39:51）与 after-a（9:40:39–9:57:18）都在 **9:58:49 之前结束**。
third run 全程压在这两个模拟器上。

机内轨迹也吻合：after-b **前 95 s 与基线一致**（`5 realities @69.1 s`），
从 ~200 s 起才分叉（`20 realities @313.1 s`，基线 257 s）。
**「开局正常、中段崩」是宿主抢 CPU 的形状，不是代码回归的形状** ——
代码回归会从第一秒就一起变慢。

### 三、规则（比这次结论更重要）

1. **跑通关秒数前先记录宿主负载**：`Get-Process qemu-system-x86_64-headless,emulator` 的
   `StartTime` 与 `CPU`，和 jsonl 的 `CreationTime` / `LastWriteTime` 放在一起比。
   两个区间有交集 ⇒ 这一轮**作废**，不是回归。
2. **判定「变慢」必须看分叉点**，不能只看终值。
   同时对比一个早期里程碑（如 `5 realities`）与一个中段里程碑（如 `20 realities`）：
   只有中段变慢 ⇒ 先怀疑宿主；两段同时变慢 ⇒ 才怀疑代码。
3. 宁可多跑一轮干净的，也不要用被污染的样本改代码 —— 这次差一点因为 after-b
   去「回退一个其实没有行为差异的改动」。


## C.73 ≤900px 下教程导航是**横向滚动条**（不是被裁），但它不会滚到当前章 `[实测]`

### 一、起因

`avd_w_320_tut.png`（Android Chrome 320 CSS px）里教程弹窗只剩正文、左侧看不到章节目录，
第一反应是「导航被裁掉了」。实测否掉了这个判断。

### 二、读数（AVD `oreki_web_test`，`wm density 540` → 320 CSS px）

```
layout : flex-direction: column   gap: 10px
nav    : y=70  h=116.9  flex-direction: row  overflow-x: auto  overflow-y: hidden
         scrollLeft=0   scrollWidth=5135   clientWidth=274   clientHeight=117
按钮   : 25 个（18 章 + 7 附录，Web 端），每个高 114px、宽 145~316px
可视带 : 只有 2 个按钮（第 0 章、第 1 章）
当前章 : idx=13  x=2837.4  →  activeBtn 不在可视带内
```

代码依据：`web/AD-Oreki-Edition/public/stylesheets/oreki.css:659` 是 `@media screen and (max-width: 900px)`，
其中 `:670-686` 明确写了 `flex-direction: row; overflow-x: auto; overflow-y: hidden`。
⇒ **降级本身是设计意图**，截图里看不到左侧列表 = 横向条停在滚动起点，不是裁切。

### 三、真正的缺陷

横向条**不会跟随当前章**：正文停在第 13 章时，`scrollLeft` 仍是 0，当前章按钮在 x=2837 处，
可视区里只有第 0、1 章。窄屏用户无法从目录判断自己在哪一章，也无法点回去。

修法（渲染层，一行）：`show()` 之后 `nav.scrollLeft = activeBtn.offsetLeft - nav.clientWidth/2 + activeBtn.offsetWidth/2`。

### 四、附带读数（不判缺陷）

横向条高 116.9px，占 320×597 视口的 19.6%；按钮高 114px 是被多行章标题撑起来的。
`.c-oreki-tut__main` 实测 y=196.9 / h=443.5（底沿 640.4），而 `.c-oreki-tut__layout` 底沿只到 514.1，
**溢出 126.3px**；正文仍在自滚容器内（`scroll.h=261` / `scrollH=4157`，能滚到底），
所以不影响可读性，但改导航条高度时要连带复核底栏位置。

脚本：`web/_tools/_r42/nav-probe-320.mjs`、`nav-main-probe.mjs`。

### 五、已修复（2026-10-31 11:33，Web commit `43eecfb`）`[实测-宿主机视口]`

§三 的缺陷已修：`src/components/modals/OrekiTutorialModal.js` 新增 `revealActiveNav()`，
挂在 `mounted` / 阶段推进 / `goTo` / `goToAppendix` / `backToCurrent` / 页脚翻页上。
定位用 `getBoundingClientRect` 差值而不是 `offsetLeft`（弹窗里块的定位祖先不一定是 nav）；
比可视带还宽的长标题（320 宽下的 ch1「开局：10 反物质到第一次维度提升」、ch13「天神（一）…」）
改为对齐左沿，否则居中会把章序号切掉。
宽屏是纵向列表、`scrollWidth == clientWidth`，这段计算是空操作。

`[实测-宿主机视口]` 320 / 360 / 390 / 430 / 横屏 640×320 五档：逐章点 18 次，
当前按钮**左沿可见 18/18**（ch1 / ch13 右沿仍出界，因为按钮比可视带宽，几何上不可能全见），
`scrollLeft` 随章变化（320 宽 ch5 = 1065）；7 篇附录同样跟随。

§四 的两个数字**已不再是当前值**（不是笔误，是修复前后不同）：

| 项 | C.73 原读数 | 现在 | 说明 |
|---|---|---|---|
| 导航条高 | 116.9 px | **47 px** | 根因不是「多行章标题撑起来」，是分组标题 `.c-oreki-tut__nav-label`「附录（不参与主线进度）」在横排里被压到 min-content **逐字换行**，撑出 104 px 高的一列；`align-items: stretch` 再把 25 个按钮全拉到 114 px。修法 `flex: 0 0 auto; align-self: center; white-space: nowrap`，同时按钮 `min-height: 4.4rem`（44 px 触屏目标） |
| `.c-oreki-tut__main` 溢出 layout | 126.3 px | **0** | 同批还修了「底栏被裁」：`.c-oreki-tut__main` / `.c-oreki-tut__scroll` 补 `min-height: 0`，把压缩交给正文滚动盒，表头/提示/底栏 `flex: 0 0 auto` |

`oreki.css` 行号已漂移：900 断点现在在 **`:662`**，nav 降级块 **`:673-679`**（原记 `:659` / `:670-686`；
`oreki.css` 在 11:3x 被另一路改动增加约 230 行）。本条脚本：`web/_tools/_r42/nav-probe-320.mjs`、
`nav-main-probe.mjs`；本轮新增 `web/_tools/_r42b/{viewport-matrix,hit-test,nav-geometry}.mjs`。


## C.74 Android 教程只有 18 章，**7 篇附录只存在于 Web 端** `[实测]`

### 一、判据（team-lead 给的装机前判据，已脚本化）

不看界面，直接从 APK 里数 `CH|` 行：

```
python web/_tools/_r42/apk_tut_asset_check.py <apk> 18
```

CH 行数 = 应该渲染出来的章节数；装机后界面章节数必须等于它，不等就是渲染层的问题，不是资产的问题。
同时校验 `TITLE`/`SUB`/`STAGE` 是否与 `CH` 同数（不同数说明标签写出去了但章节没闭合）。

### 二、读数

| 对象 | 字节 | 行数 | CH | TITLE | 汉字 |
|---|---|---|---|---|---|
| `scripts/payload/assets/oreki_tutorial.txt` | 118219 | 854 | 18 | 18 | — |
| `_b_build/out/反物质维度.apk` 内 `assets/oreki_tutorial.txt`（09:58 包） | 118269 | 853 | 18 | 18 | 26154 |

### 三、附录去哪了

`oreki-tutorial-data.json` 里 `chapters=18`、`appendices=7`（附录 A 术语表 / B 隐藏成就速查 / C 记数法 /
D 中英界面对照 / E 卡住时的症状对照 / F 自动化总览 / G 本 MOD 与原版的差异清单）。

但 `android/AD_Oreki_Edition_Android/scripts/oreki_tutorial_gen.py` 只遍历 `doc["chapters"]`（`:198` 是 `.get()` 校验、`:394` / `:503` / `:574` / `:701` / `:754` 是实际遍历点；2026-10-31 复核仍在，另见 `:539`、`:837`），
**全文没有 `appendices` 这个键**；资产标签表里也没有 APX 一类。⇒ Android 无论装机多少次都看不到这 7 篇。

### 四、影响

「两端共用同一份内容源」在**章节**这一层成立（18 章逐字一致），在**附录**这一层不成立。
Android 用户缺失的是 7 篇查阅型资料（术语、成就、记数法、中英对照、卡点症状、自动化总览、差异清单），
其中「中英界面对照」「卡点症状对照」正是新手最容易用到的两篇。

要补需动 `oreki_tutorial_gen.py`（生成 APX 记录）+ `TutorialActivity.smali`（`tagCode` 认 APX、`buildTabs` 给「附·」前缀、
`chapterForStage` 不受影响）。属于 smali / 构建链，本轮不改，登记待排期。

---

## C.75 判宿主负载要看**核心占用**，不是「几台 AVD」；`emu kill` 一台 ≠ 负载消失 `[实测]`

### 一、这是 C.72 的加强版：同一个坑踩了两次

C.72 记的判据是「比对 qemu 的 `StartTime` 与 jsonl 时间窗」。这一轮证明**光看进程在不在、有几台，仍然会误判**。

场景：team-lead 停掉了 `emulator-5554`（`oreki_test`），并说明「只留 `oreki_web_test` 一台」，
据此判断干净窗口已开。实际测得（final 跑分**进行中**）：

| PID | `StartTime` | 15~20 s 内占用 |
|---|---|---|
| `qemu-system-x86_64-headless` 44224 | 09:58:49 | **5.39 核**（跑完后复测 6.61 核） |
| `qemu-system-x86_64-headless` 39072 | 10:30:04 | 0.99 核（跑完后 0.83） |
| 合计 | — | **6.38 / 12 核** |

被杀的 `36832` 确实不在了，但 `44224`（09:58:49 起，正是最早那台）**一直活着，而且 CPU 还在涨**
（10:31 读 10037 s → 10:36 读 11528 s → 10:41 读 11528 s 以上）。⇒ 「杀掉一台 AVD」与「负载归零」是两件事。

### 二、污染的形状（两次独立复现，可当症状识别用）

| 跑次 | 宿主 | 5 现实 | 20 现实 | 100 现实 | `doomed` | `isGameEnd` |
|---|---|---|---|---|---|---|
| baseline（干净） | 零 qemu，09:23–09:39 | 70.0 s | 257.0 s | 701.0 s | 724.0 s | **771.2 s** |
| after-a（干净） | 零 qemu，09:40–09:57 | 68.1 s | 222.1 s | 686.1 s | 710.0 s | **756.0 s** |
| after-b（2 AVD） | 2 qemu，10:06–10:23 | 69.1 s | 313.1 s | 未达 | 未达 | **未达** |
| final（6.4 核） | 2 qemu，10:32–10:48 | **68.3 s** | **814.4 s** | 未达 | 未达 | **未达** |

**两次被污染的跑分，`5 现实` 都落在 68~69 s（与干净跑分一致），`20 现实` 才崩**（313 / 814 s vs 222~257 s）。
⇒ **「开局正常、中段塌陷」是宿主抢 CPU 的形状**。代码回归会从第一秒一起变慢。
原因也说得通：开局阶段是「每帧只 tick 一次」的确定性推进，CPU 富余；中段是现实/EC 循环，
帧率直接决定循环次数，被抢核就成比例变慢。

### 三、规则

1. **判负载用核心占用，不用进程数**。最小脚本（PowerShell）：
   ```powershell
   $a = Get-Process qemu-system-x86_64-headless | Select Id,StartTime,CPU
   Start-Sleep 20
   $b = Get-Process qemu-system-x86_64-headless | Select Id,StartTime,CPU
   # 每台：(CPU_b - CPU_a) / 20 = 占用核心数；合计 / 逻辑核数 = 负载占比
   ```
   判据：**合计 > 0.5 核 ⇒ 这一轮不能当通关秒数用**。
2. **「只留一台 AVD」不等于「干净」**：一台 AVD 在跑游戏时能吃到 5~6.6 核（12 核机器的一半）。
   要跑通关秒数，必须**零 emulator 进程**，或至少把它的 CPU 压到 0.5 核以下。
3. **每次跑分开始与结束各测一次负载**，两个数都写进报告。只在开头看一眼，会漏掉「中途有人起 AVD」。
4. 被污染的轮次**不要丢**：它是「这个判据有效」的证据。丢了的话，下一轮还会把 814 s 当成回归去改代码。


## C.76 模拟器控制权事故 + 构建脚本会毁掉正式包 `[实测]`

本节记录 2026-10-31 上午两件互相牵连的事实。规则落地见 `AGENTS.md` §28，
台账见项目根 `EMULATOR_CONTROL.md`。

### 一、主 Agent 停止后，子 Agent 在 65 秒内重启了同一台 AVD `[实测]`

| 时刻 | 事件 |
|---|---|
| 10:28:24 | 主 Agent `adb -s emulator-5554 emu kill` |
| 10:28:29 | kill 成功，`adb devices` 只剩 `emulator-5556` |
| 10:28:57 | 停止令送达 `r42-android-break` |
| **10:30:02** | 该 Agent 执行 `emulator.exe -avd oreki_test`（会话第 380–381 行） |
| 10:30:04 | `emulator.exe` PID 19008 + `qemu` PID 39072 落地 |

同日上午子 Agent 累计自行拉起 AVD **8 次**，其中 `10:04:29` 用了 `nohup`。
⇒ **「只发通知」不足以阻止重启，必须有权限收回与台账。**

### 二、主 Agent 的停止令漏发了一个 Agent `[实测]`

10:28 的全局停止只发给了 `r42-web-route` 与 `r42-android-break`，**漏了 `r42-tutorial-mobile`**。
⇒ 规则 9「全局停止必须通知到所有在跑的子 Agent」当时不存在，是本轮补上的。
⇒ 通用教训：**「全局」类指令要按在跑的 Agent 清单逐个核对，不能按印象发。**

### 三、判断负载干净要看核心占用，不看 AVD 台数 `[实测]`

`r42-web-route` 实测：一台跑游戏的 AVD 占 **5.39 → 6.61 核**（12 核机器）。
`emu kill` 掉一台**不等于**负载消失。两次被污染的跑分里，`5 现实` 里程碑与干净样本一致
（68~69 s），`20 现实` 慢 3.2 倍 —— 这是抢核的形状，不是逻辑回归的形状。
⇒ 被污染的轮次**不要丢**，它是「这个判据有效」的证据；丢了下一轮会把 814 s 当成回归去改代码。

### 四、`build_sign()` 会先删正式包再签名，失败即销毁上一份可用版本 `[实测]`

| 时刻 | 事件 |
|---|---|
| 11:02:03 | `build/unsigned.apk` 69,600,183 B |
| 11:02:05 | `build/aligned.apk` 69,601,061 B |
| 11:02:07 | `apksigner` 静默失败：returncode≠0，**stdout/stderr 全空** |
| 11:02:07 | `release/反物质维度.apk` 被留成 **9,462,925 B** 半成品（`7af4c604…`） |
| 11:04 | 机器空载后手工复跑同一条命令：**成功**，69,790,387 B |
| 11:05 | 从 `备份-R40重建前-1911.apk` 恢复，SHA-256 `090b9adb…f43` 一致 |

两个缺陷：①`target` 在签名前就被 `unlink()`；②失败时捕获输出为空却只写「!! 签名失败」，
现场丢失。已改为「签临时文件 → 体积哨兵 → 原子 `replace`」并逐字记录 rc/stdout/stderr。

**未验证**：11:02 那次失败的确切原因（OOM？句柄竞争？）。空载复跑成功，只能记「高负载下瞬时失败」。
⇒ 通用教训：**任何会覆盖交付物的脚本，都必须先写临时文件再原子替换。**「以后小心」不是修复。

## C.77 R42 Pages 部署：线上 404 的阻断项已消除 `[实测]`

| 项 | 值 |
|---|---|
| 发布源 | `AD-Oreki-Edition@cff7b42`（main，已提交快照） |
| 部署仓库 | `OrekiDawson/OrekiDawson.github.io`，`31a72e9 → cd7c964` |
| 站点域名 | `oreki.net`（CNAME） |
| 生成方式 | `web/_deploy/deploy_pages.py`：`git archive HEAD` 导快照 → 按 `filelist.txt` 863 项同步 |
| 部署前差异 | `site/src` 陈旧残留 **0** 个；新增 1、变更 6 |

**部署前的真实阻断项**：`src/core/oreki-route-model.gen.js` 被 `oreki-smart-strategy.js` 静态 import，
但上一版 `filelist.txt` 没有它。若直接发布，主线模块加载即 404。
本轮已补入清单，并用**独立 import 闭包检查**确认（不看 `--dry-run`）：
从 `src/main.js` 可达 **726** 个模块，闭包内未被清单覆盖 **0**，清单里源码不存在 **0**。

**线上核验**（不是「已推送」就完事）：
```
GET https://oreki.net/src/core/oreki-route-model.gen.js
  第 1 次 404 → 第 2 次 404 → 第 3 次 200，12,170 字节，
  sha256 前 16 位 9e5a71c6183f81e1 与本地部署副本逐字节一致
```
⇒ GitHub Pages 传播有延迟（约 20 s 后才 200），**「推送成功」不等于「线上已生效」，
必须按内容哈希核对**。

**未验证**：移动端在 Android Chrome 的真实行为（GLOBAL_STOP 期间不启模拟器）。
本轮只做宿主视口模拟，不得表述为「全平台通过」。

**流程改进**：`deploy_pages.py` 早先版本在工作树脏时直接 abort，
把「有在途改动」误判成「发布不安全」。实际上 `git archive HEAD` 只取已提交内容，
在途改动天然不会进部署副本。现改为**列出在途改动并继续**，报告里写清
「发布的是哪个 commit、哪些改动没进去」。

---

### C.78 模拟器控制权改版 + 真机屏幕标准落地（2026-10-31 11:25~11:35）

**规则源码**：`AGENTS.md` §28（重写）+ §29（新增）。§28 标题里原来的「一次授权」已删——
那四个字本身就是「主 Agent 也要审批」的残留。三处 `docs/AGENTS_GLOBAL.md` 因硬链接自动同步
（1521 行，sha16 `cc1d673c8a73254b` 三处一致，实测）。

**改了什么（不是加规则，是改冲突）**：

| 位置 | 旧条款 | 现行 |
|---|---|---|
| §28 标题 | 「一次授权」 | 「主 Agent 自主启停」 |
| 原 28.1 第 5 条 | 主 Agent 恢复也要「带编号的授权」 | 主 Agent 自主恢复，不需编号 |
| §6.7.2 | **「测 Chrome 与测 App 必须用两个独立模拟器」** | 一台 AVD，串行 + 测前清场 |
| 28.2 台账 | 「没有编号的授权一律无效」（套主 Agent） | 编号只登记**子 Agent 测试任务** |
| `avd_check.py:49` | 引用 `AGENTS.md §21` | 引用 §28，并区分主/子 Agent |
| 两仓 `AGENTS.md` 差异表 | 「唯一源 = §21」 | 指向 `WEB_ANDROID_DIFFERENCES.md` + §27 |

**发现一个文档腐化事实：`AGENTS.md` 没有 §21。** 实际章节只到 §25~§29，但三处文档（两仓 AGENTS.md、`avd_check.py`、原 `EMULATOR_CONTROL.md`）
都在引用「§21」当规则唯一源 —— 指向一个不存在的章节。**这类引用不会报错，只会让读的人找不到规则然后自己发明。**

**真机目标 = Redmi K70**（Xiaomi 23113RKC6C / vermeer，用户 11:33 确认），3200×1440 / 560 dpi / 120 Hz。

**`oreki_test` 改配后实测（11:29，原始读数）**：

| 项 | 值 |
|---|---|
| `wm size` | `Physical size: 1440x3200`（无 override） |
| `wm density` | `Physical density: 560` |
| `dumpsys display` | `real 1440 x 3200`、`density 560 (560.0 x 560.0) dpi` |
| **应用可用区** | **`1440 x 2896`**（`mOverrideDisplayInfo.app`） |
| Insets | statusBars `[0,0][1440,136]`、navigationBars `[0,3032][1440,3200]` |
| 校验 | 3200 − 136 − 168 = **2896**，与应用区精确吻合 |
| dp | 411.4 × 827.4 dp |
| 宽高比 | 物理 1:2.222，应用区 1:2.011（**两者不同，坐标不能按单一系数换算**） |

**三条必须写成「未验证」的硬证据**（不是推断，是系统自报）：
- HDR：`mSupportedHdrTypes=[]` → **不支持**。Dolby Vision / HDR10 / HLG / HDR10+ 全部无法验证。
- 广色域：`colorMode 0, supportedColorModes [0]` → 不支持。
- 120 Hz：声明 `supportedModes fps=120.00001`，但 `renderFrameRate 60.000004` + `refreshRateOverride 60.000004`
  → **渲染锁 60**。`hw.lcd.vsync=120` 只改合成节拍，**据此写「120 Hz 已验证」是伪造**。
- EDID 型号 QCM / 构建日期 06.2006：系统报的是 `EMU_display_0 / GPP / week=27 year=2006`，模拟器自报，非真实 EDID。

**连带失效**：Android `AGENTS.md` §3 的 AVD 坐标表（1080×2340 / 440 dpi 实测）**整表作废**。
不可乘 1.3333 换算：1080:2340（9:19.5）≠ 1440:3200（9:20），且 dp 宽 392.7 → 411.4，布局会重排。已在该节顶部加失效警示。

### C.79 浏览器单实例化 + 教程三症状装机实证 + 交付核验（2026-10-31 12:20~13:20）

**一、浏览器「反复开标签」的真实根因（已改代码，不是立规矩）**

| 症状 | 根因 | 位置 | 修法 |
|---|---|---|---|
| 跑一次脚本多一个 Edge 实例 | `profileDir` 用 `Date.now()` ⇒ 物理上不可能复用 | `edge-launch.mjs` | 固定 `%TEMP%\oreki-cdp-shared-9300` |
| 同端口已有实例仍新建 | 无条件 `spawn` | 同上 | 先探测 `/json/version`，通了就 `connect` |
| 每次调用换端口 | `portCursor++` / 脚本各自写死 9355 / 9356 / 9376 | 同上 + `patch-launch.mjs` | 实例身份钉死 `OREKI_CDP_PORT`(9300)，传入 port 仅作备选探测 |
| 每次调用多一个 Tab | `openGame()` 无条件 `newPage()` | 同上 | 按 `?orekiTag=<tag>` 复用；页面数 ≥ `OREKI_MAX_PAGES`(6) 抛错 |
| 「复用」形同虚设 | `cleanup()` 会 close+kill 自建实例 | 同上 | 默认只 `disconnect`；`OREKI_CLOSE_ON_CLEANUP=1` 才真关 |

**自证读数**（`web/_tools/_r42c/verify-reuse.mjs`，同一进程连跑三次，`pass: true`）：
第 1 次 新建、页面 1→2；第 2/3 次 `reusedInstance=true`、页面 2→2、本 tag 页面恒为 1、`player`/`AntimatterDimension` 均就绪。

**一条重要的反面教训**：曾写过「都没有就复用第一个页面」的档位。复用路径紧接着 `page.goto()`，
跨 Agent 命中同一 Tab 会把对方正在跑的游戏页导航掉，受害方看到的是「采样断流 / `evaluate` hang 但 node 存活」，
**极易误判成游戏代码卡死并把终局结论写反**。已删除该档位，改为到上限直接抛错。

**二、教程三症状装机实证（`emulator-5554`，候选包 12:10 版，`b399827d…`）**

| 症状 | 结论 | 实测证据 |
|---|---|---|
| 打开即落章 | **通过** | 点选项页蓝色入口后落在「第 4 章 无限升级与普通挑战」，不是空白页、不再是最后一章 |
| 点页签切章 | **通过** | 依次点导航条：第4章→第3章→第0章→第1章→第2章，章号与标题逐次正确变化 |
| 每章条数 | **通过** | 数据层 18 章，最少 27 条记录；STEP 128 条 / TRAP 89 条，无空章；设备上第 4 章与末章「⑩ 未实现/未验证」正文完整 |
| 末章边界 | **通过** | 滚到导航条末尾点「旧·⑩ 未实现…」，正常渲染，`logcat` 无 FATAL / VerifyError |

**坐标教训**：按截图比例换算的坐标连点三次全部落空（点在 `y=2592/2600`，按钮实际 `bounds="[370,2326][1070,2466]"`）。
**装机点击必须先 `uiautomator dump` 取 bounds，不得按比例估算。**

**遗留缺陷（已定位，未修）**：`logcat` 存在 `OrekiTutorial: options 容器未就绪，稍后重试` 每 800 ms 刷屏，
至多 10 次。按钮实际已插入且可点，判定条件（`findViewWithTag` 命中 `scrollView_options` 子容器）与
真实插入位置不一致，属噪声 + 无效重试，不影响功能。

**三、终局真实墙钟（Agent A 实测，加速倍率口径）**

新档 10000× 倍率下 **660 s 墙钟到 `GameEnd`**（`endState=1.029`），691 s 时 `endState=2.582`；
四次通关 660 / 694 / 600 / 658 s。1000× 副本（更接近"人真正在玩"）**2040 s = 34 min**。
两者都远低于 180 min 门槛，10000× 口径余量 **16.4 倍**。
若要求「不靠倍率」的纯人工节奏，本轮**无数据**，必须写「未验证」，不得用加速结果冒充。

**关键里程碑（墙钟，`r42c-final1` 单段 691 s，无中断无 resume）**：
EC1~EC12 全 5/5 在 **26 s**（171 在 7 s 买到、EC2 在 7 s 满 5）；RU10 在 **68 s**；
成就 147 / 现实升级全买齐 / **特蕾莎解禁** 同在 **218 s**；莱特拉 tier 8 在 604 s；Pelle/doomed 614 s；现实 100 次。
速度档位：0~652 s 全程默认 10000×，652 s 升 20000、657 s 升 40000（终局前约 8 s）。

> **口径更正（必须照此引用）**：特蕾莎解禁时间用 **218 s**。
> 早前记录里的 `453 s` 属于 `r42c-after3`——那是**加了「给现实让路」护栏后被回退**的版本，
> 只能作为对照数据引用，不得当作最终版本结论。
> 护栏 A/B 实测：加护栏后现实触发 69/135/293/381/433/478/527/582（掉速一半以上），
> 不加为 69/139/197/246，基线 68/134/194/243。**护栏保持回退状态**，只在 `shouldReality()` 留注释。

`player.records.totalTimePlayed` **含加速倍率，不能当墙钟**；墙钟只认 `performance.now()` 自累加（`r42c-wall-ms`）。

**四、交付核验**

| 项 | 结果 |
|---|---|
| 候选 APK | 69,782,195 B，sha256 `b399827dd38a5a0eabf7c073bdc1001d6770c5009bb06112af518a7370f799c0`，签名 v2/v3 均 OK |
| OneDrive | 已覆盖 `C:\Users\Oreki\OneDrive\反物质维度.apk`，本地复核哈希一致；旧版归档 `反物质维度_090b9adb.apk` |
| 小米云盘 | 已覆盖 `C:\Users\Oreki\小米云盘\反物质维度.apk`，本地复核哈希一致 |
| 云端核验 | `attrs=0x20` 全本地，300 s 内未转云端占位 ⇒ 只能写「本地已替换、上传服务报告成功」，**不得写「云端内容已核验」** |
| Pages | `https://oreki.net/src/core/oreki-tutorial-entry.js:36` 已含新文案，200 OK；`orekidawson.github.io` 301 → `oreki.net`（CNAME） |
| 三仓推送 | site `8b38022`、web `eef24c5`、android `b91f65b`，均经本地代理 `127.0.0.1:7897` 推送成功 |

**本轮发布包不含的两处改动**（构建时间早于改动）：
`oreki_dark_theme.py` 的 4 个对比度色值（EC 研究进行中 / 自动购买器设置错误，FAIL 4→0，均达 WCAG AA）。
随下一次构建生效。

## C.78 「底栏」在两端是**不同东西**：Android 两行 ScrollableTabLayout，Web 只有左侧竖栏（无底栏）`[读码]`

用户 2026-10-31 下达长期规则：**导航底栏一律按官方实现，不允许自创形态**。

**官方 Web 没有底栏。** `web/upstream/official/src/components/ui-modes/modern/ModernSidebar.vue:28-37`
只有左侧竖栏 `div.c-modern-sidebar`，`tabs: () => Tabs.newUI`，**无底部导航、无抽屉、无窄屏断点**。
官方 `public/stylesheets/styles.css` 的 media query（960 / 720 / 480px）作用于**文档站**，与游戏 UI 无关。

`Tabs.newUI` 两端**逐项相同**（`src/core/tabs.js:211-223`，官方同文件同位置）：
dimensions → automation → challenges → infinity → eternity → reality → celestials →
achievements → statistics → options → shop，共 **11 项**。
我们 `OREKI_WEB_TAB_ORDER` 只是去掉 `shop`（Web 无商店）后剩 **10 项**，**顺序与官方完全一致**。

**官方 Android 底栏 = 两行 `ScrollableTabLayout`**，见
`work/base_decoded/res/layout/app_bar_main.xml:34-38`：
`bottomNavigationLayout`(BlurView) > `bottomNavigationInnerLayout` >
`mainTabLayout`（主分类，`tabGravity="fill"` / `tabMode="scrollable"` / `tabMaxWidth=4000dp`）+
`secondaryTabLayout`（子页签，`fitAllTabs="true"`）。
文字色走主题属性 `?bottomNavigationText` / `?bottomNavigationTextSelected`，**不硬编码色值**。
官方还允许 4 种导航类型互切（`dialog_navigations.xml`）：侧边 / 始终侧边 / 滑动 / 底部，
中文名依次在 `values-zh-rCN/strings.xml:3741 / 4044 / 4082 / 845`（底部叫「**底部导航栏**」）。

⇒ **教程文案不能写「底栏」。** 同一份 json 供两端使用，而 Web 端屏幕上不存在底栏，
写「点底栏『维度』」会让 Web 玩家找不到入口。统一改为中性的「**「维度」页签**」。

⇒ **坐标表（C.26）仍然成立但只对 Android 有效**；不要拿它去描述 Web。

## C.79 R43 候选版本封板（2026-10-31 18:20）`[实测]`

### 基线

| 项 | 值 |
|---|---|
| Web main（封板前） | `69924831a133485acce0243d0fa45159c87b06f5` |
| Web 候选提交 | `ddc328e0cff9bcc3e10aca613c31072caa96549e` |
| Web 上次部署基线 | `eef24c57cfda7c7921eab4431f8197f0ea8cfba4`（Pages `8b38022`，12:57） |
| Android main（封板前） | `53594da57cb427c43d7c56f653e398e606ea33cc` |
| Android 上次发布源码基线 | `b91f65bc6c40a20787e369b1b4fec72a8035e4ba` |
| 上一版正式 APK（12:10，已投两云盘） | 69,782,195 B / `b399827dd38a5a0eabf7c073bdc1001d6770c5009bb06112af518a7370f799c0` |
| `release/` 内 APK（11:04，更早） | 69,745,182 B / `090b9adbd0b4f8ad0a1b799d151c11e6af207ea93c55e13ea40441ba67d69f43` |

⇒ **两云盘当前那份 12:10 的包，和 `release/` 里 11:04 的不是同一个**。替换正式包前必须按 SHA-256 认出各自来源，不能只看文件名。

### 教程源（本次候选唯一源，两端共用）

- `src/core/oreki-tutorial-data.json` 198,246 B，sha256 `ef95637b38bb76650677a0d383c5fa7fd05c58e1a1573a947af34c4126ccdbfa`
- `src/core/oreki-tutorial-data.gen.js` 198,670 B，sha256 `5519b5cf54920b3f3087169559a9a55566271c130b617f0d7e5336fadfb0bd21`
- `node scripts/validate_tutorial.mjs` → **2150 项 / 0 失败**（14 规则组，E1~E4 全 PASS）
- `node scripts/gen_tutorial_module.mjs --check` → 发布门控通过（草稿 0 章）
- 位置词清零：`rg -o "(顶部|侧栏|底栏|底部导航)的?「"` → **0**；`rg -c "侧栏"` → **0**
  （封板前 32 处；其中 23 处是导航位置词属真错，10 处「顶部反物质 / 顶部按钮 / 页面顶部」是对的，未动）
- `numbers[].src` 全量下线（170 条）；校验器规则 5 已反转为「出现多余键即失败」

### 智能策略（唯一策略源）

`src/core/oreki-smart-strategy.json` 35,224 B，nlink=2（与 `shared/spec/oreki-smart-autobuyer.json` 同 inode `8725724278916525`）
`stages=20 / goals=18 / strategies=11 / blockers=2 / leaves=34`；`node scripts/check_stage_detect.mjs` 全通过
（20 夹具各命中且仅命中 1 段、9368 个可达状态无重叠、18 条 goal 全部可求值、34 叶子 JSON↔LEAVES 逐字一致、解释器 0 处 `purchase`）。

20 段顺序：`early / preInfinity / breakInfinity / challenges / infinityDimensions / eternity / timeStudy /
eternityChallenges / dilation / reality / glyphs / realityTree / celestialsTeresa / celestialsEffarig /
celestialsEnslaved / celestialsV / celestialsRa / laitela / pelle / doomed`。

### Pages 部署制备（`_deploy/deploy_pages.py`，于 `ddc328e` 快照）

```
[1] branch=main HEAD=ddc328e
[2] 清单 863 项
[4] 已同步 863 个文件；快照中缺失 0 个
[5] site/src 下不在清单里的残留：0 个
[6] import 闭包：从 src/main.js 可达 726 个模块；闭包内缺清单 0；清单多 0 → PASS
[7] site 仓库：新增 0、变更 29（含 oreki.css / 教程组件 / 策略与 route-model / changelog）
```

⇒ `filelist.txt` 已覆盖本次新增的全部模块，**不需要改清单**。

### 长期规则入库

用户 2026-10-31 18:10 下达的「长期协作规则 v1」已作为 **`AGENTS.md §31`** 落盘：
根 `AGENTS.md` inode `8162774324763556` nlink 3（与两仓 `docs/AGENTS_GLOBAL.md` 同一文件），123,928 B，
`check_agents_sync.py` → 三处 inode / SHA-256 一致。
冲突裁决写在 §31 第十条：与 §25 的子 Agent 数量条款冲突时以 §31「上限 3 个」为准。

### 本轮明确未做（下一轮）

1. `TutorialProgress.stage()` 永不返回 `0x6`（打完莱特拉仍显示「现实」阶段）—— 需用原版门控条件修，未进本次构建。
2. ch04（自动打破无限 + 无限点数 ×2 必须手点）与 ch05 整章重写。
3. 双语附录 `apx_terms`（164 处）与 `apx_bilingual`（89 处）`中文：English` 形态待裁定。
4. 教程正文里 24 组「中文 / English」对照（E 线已列清单，源在 Web json）。
5. `OrekiTutorialModal.js:499` 等 4 处 `num.src` 死代码清理。

---

## C.80 R45 交付台账（2026-10-31 起，§37 双小时强制交付）`[实测]`

> 每行 = 一次**有效交付**（按 §37 定义）。报告/测试/commit 本身不算。
> 权威源：本表 + git 历史；`release/` 与双云盘按 SHA-256 认来源。

| 时间 | 类型 | 版本标记 | 核验结果 | 备注 |
|---|---|---|---|---|
| 2026-10-31 20:25 | Web | 源码 `f0f3fb2` / 部署仓 `1ab78bb` | `verify_live.py` 7/7 文件 SHA-256 一致（去 CRLF）；`https://oreki.net/` 200 | 本轮首次交付。部署门控抓到真实缺陷：`src/core/oreki-perk-automation.js` 在 import 闭包内但**不在 `filelist.txt`**，上线会 404；已补清单 863 → 864 项后闭包判定 PASS |

### C.80.1 本轮已确认的关键事实

1. **基线新档通关实测（R45 基线，线上 `73b8919` 版本）** `[实测]`：
   `performance.now()` 独立墙钟 **700.4 s** 触发 `isGameEnd`（`endState=1.018048`，realities=100），
   远低于 180 分钟（10800 s）。阶段时序：4.2s 破无限 / 6.3s 首次永恒 / 67.1s 现实×5 /
   136s 复兴树 / 223.7s 特蕾莎 / 268.7s 无名氏 / 479s 莱特拉 / 700.4s 终局。
   ⇒ **180 分钟验收在 Web 侧不是瓶颈**，真正的缺陷是中段执行层停摆与阶段抖动。
2. **阶段识别每秒翻面的根因** `[实测+读码]`：`timeStudy.studiesBought` 叶子取
   `player.timestudy.studies.length`，该值**每次永恒重置清 0**，导致 eternity ↔ timeStudy
   每秒 A→B→A 翻转（基线日志实测 9 次）。R45 已合并为 `eternityTimeStudy`（阶段 20 → 19），
   判据只留单调量；新版本实测序列仅剩一次 `eternityChallenges` 往返。
3. **Material 依赖事实** `[实测·读包]`：`release/反物质维度.apk` 的 `resources.arsc` 含
   `Theme.Material3` 128 次、`Theme.MaterialComponents` 99 次，实际存在
   `Theme.Material3.Dark` / `.NoActionBar` / `.Dialog*` / **`.FocusRings`** 全套；
   `classes.dex` 53 处、`classes2.dex` 174 处 `com/google/android/material` 引用。
   ⇒ 用户所说的「Material 13」（`com.google.android.material:material:1.13.x`）**自带完整
   Material3 主题族**，教程页应复用，不得升级或新增依赖。版本号串不在 arsc 内，属正常。
4. **构建链 JDK 实际取值** `[实测]`：`build_mod.py:4585` **硬编码**
   `tools/jdk/jdk-17.0.20.1+1/bin/java.exe`，即真正编译/签名用 JDK 17；
   而 `build.gradle:25-33` 的目录扫描取「最新」，`verifyEnvironment` 报的是 `jdk-21.0.13+9`。
   ⇒ R44 交接「必须 export JAVA_HOME 否则构建失败」只是 Gradle 自身启动需要，
   **apktool/apksigner 始终走 JDK 17**，两者不矛盾。`verifyEnvironment` 9 项全 PASS。
5. **交付前三个包互不相同** `[实测]`（替换前必须按 SHA-256 认来源）：
   `release/` = `090b9adb…d69f43`（69,745,182 B）；候选 `build/gradle-stage/` = `44384c59…26bd6`（69,786,213 B）；
   OneDrive 与小米云盘 = `b399827d…f799c0`（69,782,195 B，两处相同）。
6. **Edge 资源盘点（§38 首次执行）** `[实测]`：17 个 `msedge.exe` 全属**同一个** WorkBuddy
   自动化实例（主进程 PID 22136，`--headless=new --remote-debugging-port=9300
   --user-data-dir=…Temp\oreki-cdp-shared-9300`）；**用户 Edge 窗口为 0 个**，未受影响。
   关闭 3 个闲置页（2 个 oreki.net 游戏页 + 1 个 newtab）后：进程 19 → 17，内存 2127 → 1178 MB，
   `page` 标签 3 → 0。实例保留供后续验收，用毕整实例退出。

### C.80.2 R45 本轮新增确认（2026-10-31 21:5x，全部带证据）

1. **两次验收跑为什么过不去（可复现的量化证据）** `[实测]`
   用 `_tools/_r45/r45-liveness-probe.mjs` 在 10000×、全新存档下每 20 s 采样 `debugState()`：
   - `celestialsEffarig` / `celestialsEnslaved` / `laitela` 三个阶段恒为
     `owned=0 delegated=3 unsupported=0`，即 `celestial` 策略的 priority
     （`celestialSpecificOrder` / `spendUnlockResource` / `advanceCelestialNav`）
     **三条全是 delegated**，`pickExecutable()` 结构上挑不出可代劳动作；
   - `takeovers=216`、`attemptCount=216` 自 t≈180 s 起完全冻结（验收跑是 235，t≈191 s）；
   - 同期 `realities` 仍在涨（30 → 90），说明**游戏在跑、执行层没在推**。
   ⇒ 结论：不是「挑不出动作后没报」，而是**该阶段本来就没有一条 owned 动作**。
2. **终局真正的门是 IU25 的四条件** `[源码]`
   `imaginary-upgrades.js:296-305`：`IU25` 要求
   `Laitela.isRunning && Laitela.maxAllowedDimension === 0 && TimeStudy.reality.isBought`。
   而 `laitela.js:54` `maxAllowedDimension = 8 - difficultyTier`，
   `game.js:1165` 的 `difficultyTier++` **没有上限**（唯一自增点，已全仓 rg 确认）。
   ⇒ `tier` 一旦越过 8，`maxAllowedDimension` 变负数，IU25 **永久不可买**。这是不可逆毁档风险。
3. **Pelle 解锁唯一判据 = `IU25.isBought`** `[源码]`（`celestial-recon` 取证，五方一致）
   ⇒ 「到 Pelle 终局」等价于「tier 恰好 8 时在同一现实里买到膨胀研究 6 与 IU25」。
4. **探针字段曾有三处错，已修正** `[实测]`
   `effarig` 要读 `isCompleted`（读 `isUnlocked` 会漏「已解锁未完成」）；
   V 的全局是 `Celestial.V`（`player.celestials.v` 不存在）；莱特拉「裂隙」= `maxAllowedDimension >= 6`，
   不是对象键计数。`r45-accept-run.mjs` 已补 `laiTier / laiMaxDim / laiRunning / laiEntropy / ds6 / iu25`。
5. **执行层「长时间零动作」不再静默** `[已改]`
   `oreki-smart-executor.js` 新增 `STATE.noActionSince` / `lastExecAt`、常量 `STALL_REPORT_MS=60000`、
   函数 `stuckNoAction()`，并在 `tickUnsafe()` 里做**双重兜底**（`describeNoAction()` 返回 null
   时仍按阈值补报）；`debugState()` 新增 `stalledSec` / `lastExecAgoSec` / `stallThresholdSec`。
   `executor-selftest.mjs` 由 9 项扩到 **11 项**，全通过（第 10 条钉「模块长期自称有动作」，
   第 11 条钉「laitela 形态 3 条全 delegated」）。
6. **Android 装机后 UI 卡死的真因是 ART `VerifyError`** `[实测]`
   `OrekiEternity.smali` 的 `blocked(III)Z` 是**静态三参**，参数只有 `p0/p1/p2`，
   却按 `p3` 使用；`.locals 4` 下 `p3 → v7`，恰等于寄存器总数 7 ⇒
   `index 7 >= 7`，ART 拒绝整类，`OrekiStageAuto` 每 30 次/s 抛一次异常把 UI 线程打死。
   静态预检的教训：**必须按参数宽度算寄存器总数**（`D`/`J` 占 2 格、非静态含 `this`），
   只查「`p<N>` 映射是否超 v15」会漏掉「恰好等于总数」这一类。
7. **`frame-observer` 已在 AVD 上** `[实测]`
   `emulator-5554` 已装 `com.oreki.frameobserver` 且进程在跑，`adb forward tcp:8731` 已建；
   `/stats` 返回 `"capturing": false, "state": {"v": "未开始"}` ⇒
   **MediaProjection 授权必须由人在设备上点**，工具刻意不提供远程启动接口。

### C.80.3 R46 首次 Android 有效交付（2026-10-31 21:34）

| 项 | 值 |
|---|---|
| 构建入口 | `./gradlew.bat build`（Gradle Wrapper 8.10.2 编排 `scripts/build_mod.py`），`JAVA_HOME=tools/jdk/jdk-17.0.20.1+1` |
| 构建结果 | `BUILD SUCCESSFUL in 9m 21s`（b3；b2 于 21:08 因 `OrekiEternity.blocked(III)Z` 的 ART `VerifyError` 失败） |
| 候选包 | `build/gradle-stage/反物质维度.apk`，69,790,309 B |
| 发布包 | `release/反物质维度.apk`（经 `installToRelease`，**不是**候选包直接改名） |
| SHA-256 | `ca472a5125319dc31a56cf202d2e67ab98d8780b9edaab8622604b330c2ef68c` |
| 旧发布包 SHA-256 | `090b9adbd0b4f8ad0a1b799d151c11e6af207ea93c55e13ea40441ba67d69f43`（已确认被替换，未用旧包冒充） |
| verifyRelease | **15/15 通过**（`build/gradle-reports/verify-release.json`） |
| 装机验证 | `emulator-5554` 增量安装成功；`MainActivity` 到前台；`logcat` 无 `VerifyError` / `Verifier rejected` / `FATAL EXCEPTION` |
| 启动证据 | `reports/_r45/shots/r45_launch.png`：深色主题、离线收益弹窗（无限点数 177→179、无限次数 216→217）、`开始游戏` 按钮、顶栏「选项」 |
| 版本 | `versionName=3.19.0`、`versionCode=30190000`、`minSdk=24`、`targetSdk=37` |
| 网盘 | OneDrive `C:/Users/Oreki/OneDrive/反物质维度.apk` 与小米云盘 `C:/Users/Oreki/小米云盘/反物质维度.apk` 均为 `ca472a51…c2ef68c` / 69,790,309 B / 21:34（按用户要求不做远程回读核验） |

**上一个正式包是 11:04 的 `090b9adb…`，中间近 10 小时没有 Android 版本 —— 本轮已恢复交付。**

### C.80.4 frame-observer 按需求改造：无障碍绑定自愈（2026-10-31 22:05，全部实测）

| 事实 | 证据 |
|---|---|
| `am force-stop` **必然清空**无障碍绑定 | 清空前 `enabled_accessibility_services=com.oreki.frameobserver/...ObserverA11yService`、`accessibility_enabled=1`；force-stop 后两者变成 `null` / `0` |
| 冷启动时 `/ui` **必定 503**，且 HTTP 服务随进程一起停 | force-stop 后 `curl /ui` 返回 503，正文 `无障碍服务未连接（设置里启用 ObserverA11yService 后再试）`；`/stats` 同时不可达 |
| 系统投影对话框由 `com.android.systemui` 弹，**文案是英文** | `uiautomator dump` 得到 `CANCEL`（`android:id/button3`, center 288,2047）与 `START NOW`（`android:id/button1`, center 1107,2047） |
| 开始捕获按钮定位可靠 | `com.oreki.frameobserver:id/btn_start`，文本「开始捕获」，bounds `[56,609][706,777]`，center `(381,693)`；`input tap` 对 app 按钮**有效**（与游戏画布上的合成触摸被忽略不同） |
| **自愈已生效** | 人为写 `null`/`0` 后冷启动：`OrekiA11y: 已写回无障碍绑定: ...ObserverA11yService` → `onCreate ensureBound=true state=notconnected` → 1.2 s 后 `a11y connected` |
| `/stats` 新增 `a11y` 字段可用 | 返回 `"a11y":{"v":"connected"}`（沿用该工具既有的 `{"v":...}` 编码约定，与 `state`/`session` 一致，**未破坏既有消费方**） |
| 改造后四端点全部实测可用 | `/stats` 200（capturing=true, frames 51, fps 10.94）、`/ui` 200（3,259 B）、`/snapshot.jpg` 200（80,454 B, `X-Frame-Id: 212`）、`/events?since=0` 200（34,457 B, 42 条） |
| 构建与产物 | `python tools/build_cli.py` 通过（javac 编译 12 个源文件，含新增 `A11yBinder`），`apksigner verify` 通过，APK SHA-256 `e8a9477edf8ff4d4fa02d7c3b4c3ee9edffa3cb71cb147717587ce4c071d668e`，0.04 MB |
| 权限 | `WRITE_SECURE_SETTINGS` 需 `adb shell pm grant`；已授予并核验 `granted=true`。未授予时自愈静默失败并记 `OrekiA11y` 日志，不影响其它功能 |
| 提交 | `frame-observer` 仓 `50f1ec0f57bea9ec8155adfff694226fd4dc3b7c`（远端已确认） |
| 证据目录 | `android/reports/_r46/frameobs/`：`before-restart.json`、`stats_selfheal.json`、`stats_after_selfheal_auth.json`、`ui_after_auth.json`、`ui_selfheal.json`、`ui_game.json`、`fo2.xml`、`dlg2.xml`、`snap_after_selfheal.jpg`、`events_after_selfheal.txt` |

**投影授权仍然必须人工确认**：本次改造**没有**新增任何 `POST /capture/start` 之类接口；
自愈只处理「无障碍绑定」这件纯本地的事，与 MediaProjection 授权严格分离。

## C.81 R48 收尾事实与 §45 轮次互斥规则落盘（2026-11-01 01:0x）`[实测 + 落盘]`

### C.81.1 §45 已写入共享规则（P0 流程）

`docs/AGENTS_GLOBAL.md` 已追加 **§45 每轮启动与结束的子 Agent 全量收回、轮次互斥规则**。

- 写入方式：原地 `r+b → seek(END) → write → truncate`，**未使用 `cp` / 原子替换 / 删除重建**。
- 写入前后校验：inode `8162774324763556` **未变**，`nlink = 3`，三处路径 md5 一致
  （`d3a2b5957d57` → `8cc5de8eabee`），文件大小 171,399 → 175,911 B。
- `python scripts/check_agents_sync.py` 输出「结论：全部一致」，AGENTS.md 与 FACTS.md 两组三处 inode / SHA-256 均一致。
- §45 与 §39、§40 **并列不覆盖**；仅在**轮次边界**优先于 §39。

### C.81.2 R48 已验证事实（有证据，可复用）

1. **Web 新手教程禁绿已达成** `[真机 Edge 实测]`
   逐章扫 24 章 + hover / active / focus / disabled 全态，**绿色命中 0**。
   变量实测 `--color-reality: #4c9aff`、`--color-good: #4c9aff`、`--color-good-dark: #2f6fd0`；
   关闭按钮描边 `rgb(0, 68, 156)`。**做法是变量作用域重定向**（`.c-modal:has(.c-oreki-tut)` 内重设），
   不是逐类改色 —— 一次覆盖全部引用点，也不会漏掉继承与渐变。
2. **Web 教程关闭按钮出屏已修，且有 A/B 决定性证据** `[实测]`
   360×380 短视口：无注入样式时弹层 `top = -25`、关闭按钮 `top = -17`、`closeInView = false`；
   有样式时 `top = 8`、`closeInView = true`。320 / 360 / 393 / 412 / 851（横屏）全部 `closeInView = true`、无横向滚动。
   根因是 `.l-modal` 用 `top:50% + translate(-50%,-50%)` 居中，内容高于视口时上半截被推出屏幕；
   改为 `inset:0 + flex` 居中后根治。
3. **Android 教程 `VerifyError` 已修** `[真机 logcat]`
   故障：点教程直接摔回桌面，日志 `register v6 has type Reference: android.widget.LinearLayout
   but expected Reference: java.lang.String`。根因是 `footerPill` 调用点把 `p1`（LinearLayout）当 String 传。
   **同类错误已是第三次**，因此新增 `scripts/check_invoke_types.py` 作为构建前闸门：
   静态比对「实参是 `p` 寄存器 vs 形参声明类型」，正确处理 `D`/`J` 双格宽度，`<init>`/`<clinit>` 跳过，
   重载任一匹配即放过。自测注入原 bug 能精确报出。
4. **Android 教程标题不再被状态栏压住** `[真机截图]`
   Android 15+ 对 `targetSdk≥35` 强制 edge-to-edge，连 `Dialog` 也不再自动避让。
   新增 `DrawerInsetListener` 挂真实 `WindowInsets`（`SDK_INT≥30` 走 `systemBars()`，否则 `getSystemWindowInsetTop()`），
   记基础 padding 后 `setPadding(base + inset)`，**不用固定 24dp、不重复叠加**。
5. **官方 Current Tab 未被破坏** `[真机 dumpsys]`
   `id/toolbar` 仍在 `0,136,1440,332`，Oreki 入口是 `wholeOptionsLayout` 的内部子项（§44 合规）。
6. **Android 教程字号药丸同源刷新已修** `[像素采样]`
   点大→只大亮、点小→只小亮、点中→只中亮；像素 `(130,165,193)` 蓝 vs `(64,69,76)` 灰；
   字号真实生效（「阶段目标」高 77 → 89 px）。
7. **章节抽屉**：可弹出、列 24 章、遮罩生效、返回键可关。修复点是 `if-gtz` 极性写反（应为 `if-lez`）。

### C.81.3 自动购买器错位的根因（R48 定位，R49 修复中）`[真机实测 + 读码]`

**不是 Edge 独有**，是共享 CSS 的固定宽度设计问题：

| 规则 | 声明值 | 实际像素（rem = 10px） | 后果 |
|---|---|---|---|
| `styles.css:4392` `.c-autobuyer-box-row` | `width: 96rem` | 960 px | 桌面模式视口约 980 px、扣侧栏后内容约 870 px → 行溢出 |
| `.l-autobuyer-singlet-group` | `width: 97rem` | 970 px | 把行撑到 970 px（真机实测两行 `rowW = 970`）|
| `.o-autobuyer-btn` | `width: 17.5rem` | 175 px | 被放进 `width:25%`（约 97 px）的槽 → 必然外溢约 78 px |

真机复现（411 px 逻辑视口，手机 Chrome）：18 行中 `__toggleSlot` / `__checkboxSlot` 的子元素
**超出所属槽右边界 75–83 px**；截图可见「×1 → ×2 批量购买…」被右侧「购买最大数量」整块压住。

**关键机理**：桌面模式把布局视口报到约 980 px，**恰好绕过 `max-width:900px` 断点** ——
这就是「只有桌面模式出问题」的由来。所以修复**不能只靠媒体查询**，必须用与视口无关的
`min(设计宽, 100%)` 收敛。

**R48 修改（本地未提交，R49 承接）**：`oreki.css` 用 `min(设计宽, 100%)` + 窄屏槽位重排；
Windows Edge 411 / 980 / 1280 三档实测「越界行 0、子元素溢出 0、无横向滚动」，1280 下主行仍 960 px。
**真机复验在 R48 未完成**（手机 Chrome 标签页中途被关闭），不得记为已修复。

### C.81.4 R48 遗留的语义纠正（用户 2026-11-01 00:4x 指出）

用户原话：「挑战应该是开始即完成，而不是未开始时自动完成」。这纠正了此前的实现方向。

- `eternity-challenge.js` 的 `autoComplete.tick()` 曾有两条分支直接 `addCompletion(true)`，
  其中含 Ra 解锁「即时 EC」后的 while 循环 —— **挑战根本没开始就把次数补满**。
- `player.js` 曾把 `autoEC` 默认设为 `true`，等于开局就开着「未开始自动完成」。
- R48 已改：自动化的唯一动作是 `start()` 下一个未完成的 EC；完成统一交 `OrekiInstantChallenge`
  （要求 `current !== 0` 才结算）。
- **验证缺口（必须记住）**：`EC.completions` 有自定义 setter，从控制台强写会在数百毫秒内被存档真值还原，
  所以「写值后读回」的验证方法**无效**；必须用「真实启动 → 等待 → 读真值」。
  R48 因此未能坐实「开始即完成」，只坐实了「未启动不涨次数」。R49 继续。

### C.81.5 FACTS 硬链接校验

`docs/FACTS.md` 三处 inode `3940649674859546`、`nlink = 3`、SHA-256 一致（`f34e79e5756bdecb`）。
本次追加同样使用原地读写，未破坏链接。

## C.82 R49 交付台账与实测数据（2026-11-01 01:07–04:xx）`[实测]`

### C.82.1 交付

| 项 | 值 |
|---|---|
| Web 源码 | `f10968c`（教程同步：挑战启动即完成的前提与 autoEC 默认关闭） |
| Web 前置（同轮并行会话） | `0d4f95b` §45、`fbd193c` 行宽收敛、`45b7373` EC 语义、`c98c325` FACTS、`9a4d893` autoEC 默认关闭 |
| Pages 部署 | 部署仓 `e2ecf58`，864 文件，import 闭包 PASS（2 个 probe 模块未接线属正常） |
| 线上核验 | `oreki.net/src/core/player.js` 第 529 行 `autoEC: false`；`oreki.css` 含 `min(96rem` ⇒ 新版本确实生效 |
| Android 源码 | `a649196`（补提交 `DrawerInsetListener.smali` + `check_invoke_types.py`，此前已打进 APK 但漏提交） |
| APK | `release/反物质维度.apk` 69,790,309 B，SHA-256 `d101ea0926f410c9…` |
| 双网盘 | OneDrive 与小米云盘均 `d101ea09…` / 69,790,309 B（替换掉 10-31 23:23 的旧包 `5af2e259…`） |

**Android 未重新构建的依据**：`find scripts/payload/smali -newermt "2026-11-01 00:22"` 结果 **0 个**，
`build_mod.py` 最后修改 00:16。即 00:22 产出的 `release/反物质维度.apk` 与当前源码一致。
包内已确认 `OrekiInstantChallenge` / `OrekiChallengeAuto` / `OrekiStageAuto` / `DrawerInsetListener` /
`TutorialActivity` 均在 dex 中命中。

### C.82.2 自动购买器六档矩阵（真机 + CDP 视口）

真机 Redmi 23113RKC6C / Android 16，411 px 逻辑视口，真实 `getBoundingClientRect()`：

| 视口来源 | vw | docW | 行数 | 子元素越界 | 行超视口 | 横向滚动 |
|---|---|---|---|---|---|---|
| 真机 Chrome 原生 | 411 | 411 | 18 | **0** | 0 | 无 |
| CDP 320 | 320 | 320 | 16 | 0 | 0 | 无 |
| CDP 360 | 360 | 360 | 16 | 0 | 0 | 无 |
| CDP 393 | 393 | 393 | 16 | 0 | 0 | 无 |
| **手机 Edge 980（桌面模式布局视口）** | 980 | 980 | 16 | **0** | 0 | 无 |
| CDP 1280 | 1280 | 1280 | 16 | 0 | 0 | 无 |

- R48 真机基线是「子元素超出所属槽右边界 **75–83 px**」，R49 实测为 **0**，修复真实有效。
- 手机 Edge 调试通道：`chrome_devtools_remote_32336` → `adb forward tcp:9334`。
- **口径说明**：980 档是在手机 Edge 进程里用 CDP 设置布局视口 + 桌面 UA 复现的，
  **没有走 Edge 菜单里的「请求桌面网站」开关**。缺陷成因就是布局视口取 980，
  所以这个测法覆盖缺陷本身；但菜单路径未走，如实记录为未完成项。

### C.82.3 挑战「启动即完成」实测（隔离浏览器上下文，零存储）

用 CDP `Target.createBrowserContext` 建真正全新存储（`localStorage` 空、`eternities=0`、`eternityChalls={}`）。

**EC5**：`start(true)` 返回 `true` → `current` 写入 5 → **68 ms 后** `completions` 0→5、`current` 归零；
12 次 × 50 ms 采样**全部稳定**（无反复、无重复结算）。

**C2**：`start()` 后 `current=2` → 60 ms 内 `current=0`、`isCompleted=true`，8 次采样稳定。

**IC1**：`start()` 后 `current=1` → 60 ms 内 `current=0`。

**一条必须记住的干扰**：在后期存档上，`completedBits` 会在 3 秒内从 0 跳到 **8190**（12 个普通挑战全置位），
IC 的 `isCompleted` 在 true/false 间闪。**这不是缺陷**，是原版
`eternity.js:181 initializeChallengeCompletions()`：
拿到「保留自动购买器」永恒里程碑后每次永恒都 `NormalChallenges.completeAll()`，
`Achievement(133)` 解锁后同样 `InfinityChallenges.completeAll()`。
⇒ 「未启动不涨完成数」在后期档**无法干净验证**，只能靠代码路径断言（入口是 `current !== 0`）。

### C.82.4 Android 侧代码核对结论

`OrekiInstantChallenge.smali` 已完整覆盖 C/IC/EC：三类各自先判 `current > 0`；
C/IC 抬高 `maxAM` → 原版 `E(false)` 记完成 → `restoreMaxAM()` 还原；
EC 循环 `F(false)` 补满且**带 2000 次安全上限**，只有次数真变大才结算 EP；
幂等靠「完成次数变化 + `current` 归零」双闸门。
`OrekiChallengeAuto` 的 `tryNormal/tryInfinity` 只走启动路径，未发现未启动直接补次数。
Android 无独立 `autoEC` 字段，沿用原版 `player.reality.autoEC`（原版默认关闭），与 Web 改动后一致。

**这是代码核对与包内确认，不是端到端实测** —— Android 挑战流程装机验证本轮未做。

### C.82.5 两条操作教训

1. **不得用模糊文字匹配点击游戏内开关**。本轮为关弹窗按「嗯呐/确定/关闭」匹配按钮，
   误点了真机的「自动重试挑战」开关（`player.options.retryChallenge` 被置 true），
   30 秒内已改回 `false` 并核对 UI。这正是上一轮「页面一直跳转」的成因。
2. **`--user-data-dir` 必须用 `C:/…` 形式**。传 `/c/Users/…` 时 Edge 会解析成 `C:\c\Users\…`，
   建立了一个错误目录且**看起来像新 profile 实则不是**（R48 遗留测试存档就在那里）。
   用 `Target.createBrowserContext` 才是真正零存储，`localStorage` 为空不等于新档
   —— 只有 `gameCreatedTime` 与页面加载时刻吻合、`realTimePlayed` 与墙钟吻合，才能认定是新档。

### C.82.6 新档推进速度（抽样）

全新存档 10000×、默认自动化、无人工操作，实测阶段推进：

| 现实时间 | 永恒次数 | 现实次数 | 阶段 |
|---|---|---|---|
| 0 s（页面创建） | 0 | 0 | — |
| ~90 s | 6.4e4 | 0 | — |
| 150 s | 1.5e6 | 5 | 符文装备与现实升级（glyphs） |
| 210 s | 3.6e87 | 10 | 同上 |

`totalTimePlayed` 17.2 天 ÷ 10000 ≈ 149 s，与墙钟吻合 ⇒ **确认是全新档且速度倍率生效**。

---

## C.83　R50：真实通关路上的三个死锁（Web）

R50 用隔离浏览器上下文（`Target.createBrowserContext`，非用户 Profile）跑真实新档，
默认 10000×、不开教程、零人工点击。下面三条都是**实测字段证据**，不是读码推断。

### C.83.1 死锁一：EC8~EC12 没有任何模块驱动（`r50-diag1`，t≈400 s）

观测：`realities=115`、`timeTheorems=1.5e7`，但 `ecDone=[5,5,5,5,5,5,5,0,0,0,0,0]`、
`player.challenge.eternity.unlocked=62`、`TimeStudy(123)` 从未购买、
`OrekiCelestialAutomation.gates.notUnlocked=8583`、`ds1=false / maxDT=0 / V=false`，
永久停在 `celestialsEnslaved`。

根因三条同时成立：
1. `DEEP_EC_IDS` 只有 `[9,10,11,12]`，EC8 交给通用路径，而现实每 ~25 s 清空
   `player.challenge.eternity.unlocked` 与时间研究树，通用路径来不及补 123 分叉；
2. `hold` 要求「EC11 已满」才压现实，而 `_driveEcChain()` 只在 `hold === true` 时被调用
   ⇒ 「要 hold 才能打 EC11，要 EC11 才能 hold」闭环，`lastRelease="shallow"`；
3. 补前置只调 `buyTimeStudies()`，它按自己的优先级补树，不会为 EC8 专门点 123。

修复（`b192718`）：`DEEP_EC_IDS=[8,9,10,11,12]`；`hold` 改为「EC11 未满且（EC7 未满或
未过 V 门槛）才放手」；`unlocked===0` 时改走原版 `purchaseUntil()`（等价 Shift+点击 EC 研究）。

### C.83.2 死锁二：V 解锁后膨胀链自我关闭

观测：V 解锁后 3 分钟 `ds1=false / ds6=false / tp=0 / maxDT=0 / im` 平在 1.98e9、
`iu25=false`，卡在莱特拉前。

根因：`hold`、`tick()`、`tickDilation()` 三处都以「V 已解锁」为停机条件，而 IU25 的
`checkRequirement` 要求 `TimeStudy.reality.isBought`（DS6），DS6 在膨胀树里。

修复（`3a778d5`）：三处停机条件改判 `ImaginaryUpgrade(25).isBought`；同时
`buyImaginaryUpgrades()` 在买 IU15/IU25 前先用 IU1~IU10、IU13 抬 IM 上限。

### C.83.3 死锁三：IM 上限低于 IU25 成本（物理上买不起）

观测：`im` 连续 30 s 平在 3.16e9 不动，反推 `log10(uncappedRM)=6621`，
而上限公式 `(log10(uncappedRM)-1000)² × …` 给出 3.16e9 < IU25 的 5e9。
R37-A 的 100 倍系数是按 `log10(uncappedRM)=10722` 推的，R50 实测只有 6621。
唯一能乘上限的 IU13 要求「在无名氏的现实中」+ 符文门票，本档 13 级拿不到。

修复（`41933b3`）：`OREKI_IM_CAP_MULT` 100 → 300，上限抬到 ≈9.5e9（IU15 占 10.5%、
IU25 占 53%）；并把「DS1+DS6 一买到就被放手冲掉」改成 IM 达标时不放手。

### C.83.4 真实通关（当前代码的第一次终局）

`r50-save2` 存档（01:56 从零开始）在 02:18 达到：

```json
{"perf":92214,"isGameEnd":true,"endState":2.6129516019644914,"stage":"doomed",
 "realities":"355","doomed":true,"remnants":"632","keepAutobuyers":true,
 "brk":true,"speed":40000}
```

墙钟约 22 分钟（< 180 分钟目标），`endState` 2.61 > 1，`speed` 已由动态提速抬到 40000。
证据：`web/reports/_r50/r50-clear-evidence.txt`。
**口径说明**：该档跨越了三次修复的落地时刻，不能严格证明「只用 bf55b0f 的代码从零到终局」；
可复现的当前代码新档是 `2B2A4FCA`（02:19 起，页面加载时已含全部修复），见 C.83.5。

### C.83.5 当前代码新档（`2B2A4FCA`）推进记录

`startedAt=2026-10-31T18:19:14.210Z`，首状态 `eternities=0 / infinities=0 / realities=0 /
ecDone=0 / speed=10000 / storageKeys=0`。

| 墙钟 | 现实时间 | 阶段 | 现实次数 | EC 完成数（1→12） |
|---|---|---|---|---|
| 02:19 | 0 s | 开局 | 0 | 000000000000 |
| 02:21 | 120 s | celestialsEnslaved | 30 | — |
| 02:40 | 1132 s | celestialsEnslaved | 335 | 5 5 5 0 5 0 0 0 0 0 0 0 |
| 02:42 | 1430 s | celestialsEnslaved | 415 | 5 5 5 5 5 0 0 0 0 0 0 0 |

**这一轮的关键教训**：`ecDone` 里 EC1~EC5 是「先做能做的、顺序不固定」，单看
「35 秒没推进」不能判定死锁；本轮 EC4 在 t≈1200 s 才补上，EC6/EC7 之后才轮到
`hold` 放行去推 EC8~EC12。R49 的「35 秒冻结」结论（真死锁）**在 R50 未复现**，
R50 的真死锁是 C.83.1~C.83.3 这三条，靠字段级证据定位。

### C.83.6 教程中文化（R50-W5，`b578ad8`）

需求：玩家不先懂英文缩写也要能读完整篇教程。做法与验收：

- 唯一正文源 `src/core/oreki-tutorial-data.json`：233 个字符串、448 处替换。
  EC/ID/IC/IM/RM/TD/DT/TP/IU/DM/DE → 永恒挑战/无限维度/无限挑战/虚幻机器/现实机器/
  时间维度/膨胀时间/超光速粒子/虚幻升级/暗物质/暗能量；顺带 DU→膨胀升级、UI→界面、MOD→本作。
- 每种缩写全篇只首次括注一次（「永恒挑战 12（EC12）」）；注释用占位符落盘，
  防止被后两遍替换二次转换（第一版就踩过「（ID1~ID8）」变成「（无限维度 1~无限维度 8）」）。
- **保留并给中文**：`autoEC`（配置键）、`SAM/SIP1/SIP2/SEP1~3/STP/TTF/ACH1~4/ACHNR/START`
  （复兴树节点 ID，正文改为「起始反物质（SAM）」）、时间研究编号、`ALT+`、`Emoji` 记数法、
  成就 41「无需 DLC」、`log10`/`max()`。
- 附录 A 新增三列「中文名 · 英文缩写 · 用途」+「保留原样的技术标识」理由表。
- **布局回归**：上游 `public/stylesheets/styles.css` 里有一条营销页遗留的
  `section { float: right; width: 500px }`，教程每个 block 都是 `<section>`，
  中文长句在 500px 窄栏里排不下，直接压到相邻栏上互相遮挡（第 9 章进入条件实测）。
  修法：`.c-oreki-tut section { float: none; width: auto; }`，只作用于教程，不改上游。
- 验收：`validate_tutorial.mjs` 十三项 PASS；真实打开教程后第 0/9 章与附录 A 的
  `innerText` 裸缩写命中 **0**；桌面 1280×860、手机 390×844 截图核对不压字、不溢出。
  Android 侧由 `scripts/oreki_tutorial_gen.py` 读同一份 JSON 生成 assets：
  24 章 / 1160 条 / 40689 汉字 / 166158 字节，回读校验逐字一致。


---

## C.84 R50 真实新档通关 / Android 发布 / AVD 移动端实测（2026-11-01 03:00~04:00）

### C.84.1 真实全新存档从零到终局：2530 秒（42 分 10 秒）

验收标准（`docs/AGENTS_GLOBAL.md §3.1`）：真实全新存档、默认 10000×、不看教程、
新手 0 门槛，从开始到终局现实时间 ≤ 180 分钟，唯一判据 `player.isGameEnd === true`
且 `endState >= 1`。

**结论：达标。** 样本 `r50-fresh1`（503 条，5 s 一次）。

| 项 | 值 |
| --- | --- |
| 存档创建时刻 | `2026-10-31T18:19:14.212Z`（`startedAtMs=1793470754212`） |
| 创建时校验 | `realities=0`、`infinities=0`、`eternities=0`、`ecDone=0`、`normalDone=0`、`storageKeys=0`、`speed=10000` |
| 首样本 | `+8.9 s`，`stage=eternityTimeStudy`、`real=0`、`am=4.4e203817` |
| 终局样本 | `+2530.2 s`，`stage=doomed`、`real=735`、`isEnd=true`、`end=1.0214385789143967` |
| 墙钟总时长 | **2530 s = 42 分 10 秒**（上限 180 分钟，用掉 23.4%） |
| `iu25` 达成 | `t=2481 s`（墙钟 +2490.1 s）——终局前 40 秒 |
| 通关判据 | `player.isGameEnd === true` 且 `endState = 1.0214 ≥ 1` ✔ |

**速度是 10000× 还是被改过？** 基础倍率全程默认：`getGlobalSpeedupFactor()` 在
`t=0 ~ t=2511` 恒为 **10000**；直到 `t=2511`（墙钟 +2520 s）才出现 20000，
`t=2521` 出现 40000。这是 `game.js:584 getGameSpeedupFactor()` 里
`TIME_GLYPH / BLACK_HOLE / TIME_STORAGE / SINGULARITY_MILESTONE` 这些**游戏内机制**
叠加出来的有效倍率（终局 Doom 阶段才点亮），不是外部脚本改速——`r50_monitor.mjs`、
`new_game_ctx.mjs`、本目录所有 `.mjs` 都没有写 `player.speed` 的代码。
也就是说：0 → `end=0.7506` 这段（占全程 99.6%）全部在 10000× 下完成。

**对照样本 `r50-fresh1b`（不计入新档记录）**：它的 `t=0` 样本已经是
`stage=celestialsEnslaved`、`real=70`、`ecs=5,5,5,5`，是从中局接管的第二次采样，
不是新档；它自己在 `+2266 s` 时也到 `end=1.0723`，只能说明「中局 → 终局 37 分 46 秒」，
不能当作从零起算的成绩。

### C.84.2 Android 构建与双云盘发布（R50-A1）

| 项 | 值 |
| --- | --- |
| 构建 | `./gradlew.bat build` 8 m 16 s，BUILD SUCCESSFUL |
| 门禁 | `verifyRelease` 15/15、`verifyPatchContract` 34/34 |
| 候选 APK | 69,794,405 B，SHA-256 `9dec09010c2b3a992bca133090e2087d65086a54f5f79d41092b00470d4ac4f6` |
| versionCode / Name | 30190000 / 3.19.0 |
| 签名 | v2 + v3，证书 `95960bce…` |
| 替换 | `installToRelease` 覆盖 `release/反物质维度.apk`，哈希一致 |
| 云盘 | `C:\Users\Oreki\OneDrive\反物质维度.apk`、`C:\Users\Oreki\小米云盘\反物质维度.apk`，两处 SHA-256 与源一致 |

### C.84.3 AVD Chrome 真实移动端实测（1440×3200 @560dpi，Chrome 156.0.8078.47）

原生视口 **411×750 CSS px、dpr 3.5、UA 含 Mobile、`meta viewport: width=device-width`**，
`navigator.maxTouchPoints = 5`。七档测量（原生 + 320/360/393/411/980/1280）：

| 视口 | 横向滚动 | 教程按钮可见 | 教程弹窗渲染 | 章节按钮 | 正文滚动区高 | 表格横向溢出 |
| --- | --- | --- | --- | --- | --- | --- |
| 原生 411 | 无 | 是 | 是 | 24 | 379 px | 0 |
| 320 | 无 | 是 | 是 | 24 | 185 px | 0 |
| 360/393/411 | 无 | 是 | 是 | 24 | 379 px | 0 |
| 980 | 无 | 是 | 是 | 24 | — | 0 |
| 1280 | 无 | 是 | 是 | 24 | — | 0 |

目录条 `overflow-x:auto`（`scrollWidth 5007 / clientWidth 302`，320 下），
章节被截断属可横滚，不是缺陷；关闭按钮在 320 与 411 截图中均完整落在视口内。

### C.84.4 本轮修掉的两处实测缺陷（`e035505` → Pages `9e64f86`）

**① 膨胀页升级按钮被裁（真缺陷）**：`.l-dilation-upgrades-grid` 宽 660 px，
`left=-124 / right=536`；10 个 `.o-dilation-upgrade` 里 **6 个在 411 视口外**
（第一个 -109..81，第三个 331..521）。成因是 `grid__row` 为
`flex + justify-content:center` 且按钮写死 `width:19rem` 不收缩，行宽 660 居中后
左右各溢出 124 px，而 `.c-game-ui` 是 `overflow-x:hidden` → 两侧按钮**既看不见也点不到**。
修法：`≤900px` 时行 `flex-wrap`、单元格外边距 1.5rem→0.4rem、
按钮 `width:min(19rem, 50vw - 2.2rem)` 且 `height`→`min-height:9rem`。
复测：411 下网格 `0..411`、**0 个按钮越界**（每行 184 px×2）；
320 下 0 越界（每行 138 px×2）；1280 下仍是原样 660 px、0 越界（桌面零影响）。

**② 教程短屏正文区过矮**：320×568 下正文滚动区仅约 150 px（布局盒写死 50vh）。
修法 `@media (max-height:720px) { .c-oreki-tut__layout { height:72vh } }`，
复测 320 下滚动区 185 px。

**线上核验**：`oreki.css` SHA-256 `92ce0a559729cb936470cbd4458fd3dfc1ef17c1e2532c38327736151230281f`、
`index.html` `6e47f5e35ebb6834e495bfe172297e055bb575784d45e866290731dc82504343`，
与 `_deploy/site` 本地副本逐字节一致（不用耗时判断，用哈希）。

### C.84.5 两条踩坑记录（下次直接省时间）

1. **Android Chrome 的 CDP `/json` 暴露的 `id` 是别名，不能用**：拿 `/json` 里的
   `id` 去 `Target.attachToTarget` 会「附着成功但 `Runtime.enable` / `Runtime.evaluate`
   全部超时」。必须用 `Target.getTargets` 返回的真实 `targetId`（形如
   `32983E98…`），附着后 `1+1` 立刻返回 2。
2. **教程弹窗打不开不是教程的问题**：`GameUiComponentFixed.js:75-87` 是
   `v-if / v-else-if` 链——`ModalProgressBar` → `CelestialQuoteModal`(`view.quotes.current`)
   → `CelestialQuoteHistoryDisplay` → `PopupModal`(`view.modal.current`)。
   只要有一条天体语录在播，`PopupModal` 整块就不渲染，此时
   `Modal.orekiTutorial.isOpen === true`（它确实已是 `ui.view.modal.current`）但 DOM 里
   一个 `.c-oreki-tut` 都没有。量教程前必须先 `Quote.clearAll()`。
   这也是**上游原有行为**，不是本 MOD 引入的缺陷。

### C.84.6 Android「挑战启动即完成」端到端运行验证【本轮首次做实】

R49/R50 之前该功能**只有读码与包内确认**，从未在设备上跑出结果。本轮在 AVD
`oreki_test`（API 34，1440×3200 @560dpi，App versionName 3.19.0 / versionCode 30190000）
上做实：

**运行环境事实**
- 游戏本体是**原生 Java**（`kajfosz.antimatterdimensions.MainActivity`），不是 WebView；
  设备上唯一的 WebView 只加载 AdMob。因此**不能**用 CDP 驱动游戏页，
  必须走真实控件/存档观测。`adb root` 可用，存档在
  `/data/data/com.oreki.antimatterdimensions/files/player.json`（明文 JSON）。
- 钩子确已注入：`build/build.log` 第 135~136 行
  `[Oreki IC] 已在 Challenges.update 入口插入 OrekiInstantChallenge.tick()`、
  `[Oreki CA] ... OrekiChallengeAuto.tick()（先于 IC 结算）`。

**判定实验（二分法 + 低上限排除自然完成）**
存档夹具：把 `challenge.normal.completedBits` 从 8190（C1~C12 全完成）改成
**4094**（清掉 bit12 → C12 未完成），`challenge.normal.current = 12`
（等价于原版 `start()` 之后的「在 C12 中」状态），
`records.thisInfinity.maxAM = 1e10`（把自然打到目标的可能压掉）。
此前的试探还包含：`completedBits=8190` 且 `current=12`（已完成的挑战再进入）。

| 采样（开局后） | completedBits | current | maxAM | 结论 |
| --- | --- | --- | --- | --- |
| t1 ≈ 15 s（读档时的存档） | 4094 | 12 | 1e10 | 尚未 tick |
| t2 ≈ 30 s | **8190** | **0** | **1e133** | 已被结算并退出 |
| t3~t6 | 8190 | 0 | 1e133→1e300 | 之后是正常游玩增长 |

判据三条同时成立：
1. **完成位** 4094 → 8190（C12 记完成），而玩家全程没有任何点击；
2. **`current` 12 → 0**（退出挑战），且这一跳发生在同一个 15 s 采样窗口内；
3. **`maxAM` 1e10 → 1e133**：正是 `rewardAntimatter` 的「把 `thisInfinity.maxAM`
   临时抬到 `challenge.goal` 再交给原版 `gainedInfinityPoints`」留下的签名——
   自然游玩不可能在 15 s 内从 1e10 涨到 1e133。
另外 `completedBits=8190` + `current=12` 的对照实验里 `current` 也回到 0，
符合「原版已完成 → `K()` 为 true → 跳过发奖、仍然退出」的幂等分支，
即**没有发生二次结算**。

**未能做到的部分（如实记录）**：App 的自动存档间隔约 60 s，`lastUpdate` 在同一存档
内不变，因此**无法做到帧级时间戳**；「下一帧完成」这一点是由「一个存档周期内
`current` 由 12 变 0、完成位翻转、maxAM 跳到 goal」三条同时成立推出来的，
不是直接测到的帧号。要拿到帧级证据需要在 smali 里加日志后重新构建（约 8 分钟构建
+ 装机），本轮受通关长跑占用时间未做，记为待办。

### C.85　R50 续：膨胀链活锁的真实定位与五道修复（2026-11-01）

**结论先行**：R49/R50 前期反复出现的「复兴树与黑洞之后停滞」在一个新的真实新档上
**不是天神死锁，而是 `OrekiDilationAutomation` 的压现实判据造成的链式活锁**。
定位方式是逐字段取证（不是读码推测），每一项都来自活页面 `Runtime.evaluate` 的返回值。

#### C.85.1　现象（`r50-fresh2`，真实新档，2840 秒）

| 采样 | realities | v | iu15 | maxDT | imCap | releases |
| --- | --- | --- | --- | --- | --- | --- |
| t=285 s | 75 | false | false | 0 | 2.7159e9 | — |
| t=1500 s | 495 | false | false | 0 | 2.7159e9 | — |
| t=2840 s | 880 | false | false | 0 | 2.7159e9 | 163 |

`imCap` 从 t=285 s 起**冻结 2400 秒不动**，`maxDT` 全程 0，`EC` 完成数每 8~15 秒
被现实清空一次后在 0~9 之间来回（`player.eternityChalls` 直读，`ecs` 字段）。

#### C.85.2　因果链（每一环都有字段证据）

1. `Laitela.isUnlocked = ImaginaryUpgrade(15).isBought`（`celestials/laitela/laitela.js:37`）；
2. `OrekiIu15Sprint.canArm` 要求 `VUnlocks.vAchievementUnlock.isUnlocked === true`
   （`oreki-iu15-sprint.js` 的 `canArm`），实测该项 `false`，`_phase` 恒 `idle`、`attempts=0`；
3. V 的解锁是六项 `mainUnlock.progress() >= 1` 全满足；实测五项远超 1
   （realities 13.58 / eternities 818.3 / infinities 592.3 / replicanti 436.6 / RM 2.28e13），
   **只有 `dilatedTime` 为 0**（`maxDT = 0`）；
4. `maxDT` 恒 0 的根因：`DS1` 买到后立刻被现实清空（`reality.js` 的
   `player.dilation.studies = []`），膨胀一次都没启动过；实测 `r50-fresh2` 的
   `ds6` 只在 t=90~110 s 短暂为真，随后归零；
5. 为什么「买到就清空」：`hold` 的旧判据是「`DS1 && DS6` 在手上且 `IM < IU25 成本`
   → 立刻 `_release("dil-chain-done")`」。`maxDT` 还是 0 时就放手 ⇒ 现实立刻清空
   ⇒ 下一轮再打一遍 EC 全链 ⇒ 无限循环（`releases = 163`）；
6. 连带的第二处死锁：缺膨胀乘数 ⇒ `maxEP` 只到 `1e3872681` ⇒ `log10(uncappedRM)=2907`
   ⇒ `baseIMCap = (2907−1000)^2 × 300 = 1.09e9`；而 `player.reality.iMCap` **只升不降**，
   冻结在历史峰值 2.7159e9 < IU25 成本 5e9 ⇒ IM 天花板本身也不够。

**同一条链在别的档里只是「运气不同」**：`r50-fresh1` 因为某一轮凑巧让 `EC7` 打满，
`hold` 才被放行，V 在 2044 s 解锁并最终 2530 s 通关；`r50-fresh2` 没这个运气，同样
2840 s 仍在原地。所以这不是「某档坏了」，而是判据本身依赖一个每 8~15 秒就被清零的前提。

#### C.85.3　五道修复（全部只改判据与护栏，不动原版游戏规则）

| 提交 | 内容 | 实测效果 |
| --- | --- | --- |
| `27a27ee` | 放手判据由「IM 不够」改为「`maxDT` 已达标（`achieved`）」；去掉 DS6 前置 | 同一存档重载后：`imCap` 3.05e9→4.63e9，V/iu15 保持为真 |
| `88dbdec` | 「IM 够 + 莱特拉已解锁」才允许继续压住，否则放手；冷却 10 s→16 s | `sprint` 由 idle→running，拿到 `maxID1=0` 的干净现实，`iu15` 转真、`lai` 转真 |
| `8937954` | 闸门去掉「EC7 已满」前置（过 V 门槛后）；深层 EC 单次压现实上限 240 s→480 s | `r50-fresh4` 重载后 `releases` 17 次 / V 恒 false → 需要下一修 |
| `8937954` | 达标后不得当场放手，必须走 `HOLD_GRACE_MS`（20 s）宽限 | 重载后 5 分钟：`releases=1`（原因 `grace-after-achieve`），`V=true / iu15=true / lai=true`，冲刺 `fails=0` |
| `bb59a22` | 压现实彻底收敛为有界窗口，任何条件都不再无限压住 | `r50-fresh5`：t=445 s 进入莱特拉阶段（首轮 2044 s，**快 4.6 倍**） |

**为什么「宽限 20 秒」是必需的（实测而非猜测）**：`game.js` 里现实自动化跑在
天神检查之前，放手太早时同帧的现实已经把 `records.thisReality.maxDT` 清零，
V 看到的永远是 0。`r50-fresh4` 重载后 5 分钟的对照实验：直接放手 ⇒ `releases` 17 次、
V 恒 false；改走宽限 ⇒ `releases` 1 次、V 为真。

#### C.85.4　`r50-fresh5` 的中间卡点（已由七修解决，留作对照）

`r50-fresh5` 在 t=1225 s 卡在莱特拉阶段：`im=5.25e9`（已够 IU25 的 5e9）、`ds6=true`、
`tier=4`、`laiRun=false`，`realities` 冻在 80 达 500 秒。原因是 IU25 的判据
「在莱特拉的现实中……达成现实」需要一次现实才能结算，而当时的判据仍在压住现实。
七修（`bb59a22`）把它改成有界窗口后，`r50-fresh6` 通过。

#### C.85.5　`r50-fresh6`：当前 HEAD 真实新档 **760 秒通关**（实测）

* 取档：清空 `localStorage` 后新建，`gameCreatedTime` 与录制起点同秒，`realities=0`；
* 终局样本：`isGameEnd=true`、`endState=1.0084237436763426`、`stage=doomed`、
  `realities=100`、`v/iu15/iu25/pelle/doomed` 全为 true、`spd=40000`；
* **墙钟 760 秒 = 12 分 40 秒**，占 180 分钟预算的 **7.0%**；
* 对比：同一判据修好前的新档 `r50-fresh1` 是 2530.2 秒，`r50-fresh2` 2840 秒仍未通关。
* 里程碑时间线（同一份 `r50-fresh6.jsonl`）：t=445~485 s 进入莱特拉阶段
  （`v=1 / iu15=1`），t=590 s `imCap` 回到 1.39e10（> IU25 成本 5e9），t=760 s 终局。
* 证据文件：`web/reports/_r50/r50-fresh6.jsonl`（152 样本）、`.log`、`.summary.json`。

#### C.85.6　Android：自动化覆盖不到终局（结构性缺口，非本轮引入）

清空存档后的真实新档实测（`gameCreatedTime` 与 `lastUpdate` 差 1621 s）：

* 游戏时间推进比 **恒等于 20000**（`totalTimePlayed` Δ20404480 s / `realTimePlayed` Δ1020.2 s），
  证明倍率生效、不是「倍率没开」；
* 但同时刻仍停在**第一次无限**阶段：`realities=0 / eternities=0 / infinities=98 / galaxies=1`，
  画面为「无限进度 50.57%」。Web 端同期已在做现实。
* 原因在仓库自己的差异表 `WEB_ANDROID_DIFFERENCES.md`：第 165 行写「Android 自动化只覆盖
  『首次无限 → 攒 IP → 拉间隔』这一段，永恒 / 现实 / 天神 / 佩勒的自动化都还没有」，
  第 48/49/72/76/77 行逐项标为 `缺失 / 需修复`（时间研究自动购买、现实自动循环、
  Break 闸门、莱特拉 tier、佩勒驱动）。
* 结论：**Android 端在现有代码下不可能在 180 分钟内到达终局**，这不是靠调参能补的，
  需要补移植上述模块。本轮不伪造通过，如实记为阻塞项。

### C.86　R50 复跑与阻塞点细化（2026-11-01）

#### C.86.1　两次独立真实新档通关（`r50-fresh6` / `r50-fresh8`）

| 轮次 | 新档取证方式 | 终局墙钟 | endState | 末样本 `real` / `spd` |
| --- | --- | --- | --- | --- |
| `r50-fresh6` | `localStorage.clear()` + reload，快照取于 **12.6 s** | **760 s**（12 分 40 秒） | 1.0084237436763426 | 100 / 40000 |
| `r50-fresh8` | `GameStorage.hardReset()`，快照取于 **6.0 s** | **840 s**（14 分 00 秒） | 1.104099675817734 | 100 / 40000 |

两轮终局样本的 `v / iu15 / iu25 / pelle / doomed` 全为 true，`stage.id = doomed`。
里程碑对照（秒）：

| 里程碑 | fresh6 | fresh8 |
| --- | --- | --- |
| V 解锁 | 405 | 495 |
| IU15 买到 | 425 | 515 |
| IU25 / Pelle / Doomed | 720 | 800 |
| 终局 | 760 | 840 |

两轮最慢 840 s = 14 分钟，占 180 分钟预算的 **7.8%**。

#### C.86.2　新档取证方法必须修正（重要，避免后续误判）

起初用「`localStorage.clear()` + `Page.reload` 后等 12~15 s 再读快照」取证，读到
`realities=0` 但 `eternities=1.7e4 / normalBits=8190 / am≈1e5.6e8`，一度误判为「旧档残留」。
逐项排查后确认**不是残留**，而是取证窗口太晚——本作在 10000× 下自动化极快：

* `Player.defaultStart` 实测为 `eternities 0 / antimatter 10 / normalBits 0 / icBits 0`，默认值未被污染；
* `player.records.gameCreatedTime` 等于执行清档的时刻，`realTimePlayed` 仅 12 s；
* `localStorage` 只剩 `dimensionSave` 一个键（3 个键含备份槽），无旧档可加载；
* 两轮录制的前几个样本都落在**最早期阶段**（fresh6 t=5「永恒与时间研究」、fresh8 t=5「无限维度与永恒前置」）。

**正确取证方法**（已固化为 `web/reports/_r50/_fresh8.mjs`）：

1. 调 **`GameStorage.hardReset()`**（与玩家点「硬重置」同一条官方路径），不要手写 `localStorage.clear()`；
2. 重载后 **250 ms 轮询**，取 `records.realTimePlayed` 最小的一帧快照；
3. 判据：`realities / eternities === 0`、`infinities` 个位数、`normalBits ≤ 2`、`speed === 10000`。
   `r50-fresh8` 实测读到 `rtp=6021 ms / realities=0 / eternities=0 / infinities=3 / normalBits=2 / icBits=0 / speed=10000 / autobuyersOn=true`，这一帧才可作为新档基线。

结论：**`r50-fresh8` 是零起点基线**；`r50-fresh6` 因快照偏晚 6 s，只作复现样本，不作零起点基线。

#### C.86.3　Android 阻塞点精确化（替换 C.85.6 的笼统描述）

C.85.6 写的是「自动化只覆盖到攒 IP」。实测把范围收窄到一个具体字段：

| 采样时刻（自 `gameCreatedTime`） | infinities | IP | `ipMultUpgrades` | `breakInfinityUpgradeBits` | `bigCrunch.interval` | 下一级升级成本 |
| --- | --- | --- | --- | --- | --- | --- |
| 1621 s | 98 | 17 | — | 0 | — | — |
| **12873.6 s** | **735** | **447** | **0** | **0** | **906.99**（游戏秒） | **1024 IP** |

* `player.auto.ipMult = true`、`bigCrunch.isActive = true`、`eternity.isActive = false`、`reality.isActive = false`；
* 但 `ipMultUpgrades` **恒为 0**：IP 倍率重复升级一次都没买，`gainedIP` 不随坍缩次数指数上升，
  IP 只能线性爬（735 次坍缩→447 IP）；
* Break 需要「`interval ≤ 100` 且累计 32767 IP」。当前 interval 已在第 10 级（150000×0.6^10≈907），
  余下 5 级共需 31744 IP，而 IP 只有 447 —— 3.6 小时没有跨过这道门，自然到不了永恒层，
  更到不了现实 / 天神 / Pelle。
* 运行时日志佐证：`OREKI_GATE: GATE brake=false g=true c=false b=false mult=10000.0 rt=1.2885924E7`
  （`brake=false` 即 Break 未达成；`rt` 为秒，与 12873 s 一致）。

**下一步最小修复点**：不是补整个「永恒/现实/天神自动化」（`OrekiEternity.smali` 已存在，覆盖永恒层），
而是让 IP 倍率重复升级真的被买（当前 `OrekiStageAuto` 依赖原版 `Game.autoBuyerTick` 的 IPMult 块，
实测该块在 10000× 下 0 次购买）。修通这一条，Break 门才有机会打开，后续层才谈得上验证。

#### C.86.4　Android 阻塞点的二次修正：缺的是「无限升级自动购买」，不是 IP 倍率自动器

C.86.3 把下一步写成「让 IP 倍率重复升级真的被买」。继续取证后必须修正这个说法：

**(1) `player.auto.ipMult = true` 在 Break 之前本来就是空开关。**
Web 端 `IPMultAutobuyerState.isUnlocked` 的实现（`src/core/autobuyers/prestige-currency-multiplier-autobuyer.js:12-14`）是

```js
get isUnlocked() {
  return EternityMilestone.autobuyerIPMult.isReached && !Pelle.isDoomed;
}
```

即「IP 倍率自动购买器」本身要靠**永恒里程碑**解锁，Break 之前不存在。Android 存档里那个
`ipMult: true` 只是布尔位，原版 tick 块会先过 `isUnlocked` 再决定是否购买，所以它永远是空转。
两端同构，不能算 Android 的缺陷。

**(2) 真正的差在「谁去买 `InfinityUpgrade.ipMult` 这个可重复升级」。**
Web 有 `src/core/oreki-early-automation.js::buyInfinityUpgrades()`：

* 遍历 `InfinityUpgrade.all`，每帧**最多买 1 个**、走**单次 `purchase()`**；
* 生效窗口 = 「已达成第一次无限」且「还没解锁永恒」，受 `player.auto.autobuyersOn` 控制；
* 该文件第 30 行有明确取舍：「`InfinityUpgrade.ipMult` 故意**不**用 buyMax ——
  它单次 ×2 IP 但只把永恒门槛平移 93 个反物质指数，对首次永恒几乎无贡献，却会瞬间吃光 IP」。

Android 的 `OrekiStageAuto` / `OrekiBreakGate` 里没有对应路径：前者只翻开关、后者只升 interval
（`OrekiBreakGate.smali` 的注释与 `oreki-break-infinity-gate.js` 一致，都只做 interval 升级）。
于是 `ipMultUpgrades` 恒 0，`gainedIP` 恒为 1~2。

**(3) 量化后果（同一份 Android 存档，相隔 990 秒两次采样）**

| 字段 | 采样 A | 采样 B（+990 s） | 变化 |
| --- | --- | --- | --- |
| `infinities` | 735 | 791 | +56（**1 次坍缩 / 17.7 真实秒**） |
| `infinityPoints` | 447 | 559 | +112（≈ **2 IP / 次坍缩**） |
| `ipMultUpgrades` | 0 | 0 | 不变 |
| `breakInfinityUpgradeBits` | 0 | 0 | 不变 |
| `records.totalTimePlayed` | 2.5747e11 ms | 2.7728e11 ms | +1.98e10 ms（÷990 s = **20000×**，倍率正常） |

Break 需要累计 32767 IP；按 2 IP/次、17.7 秒/次，差 32208 IP ⇒ 需再坍缩约 16104 次
⇒ **约 79 小时**。这就是 Android 端 3.6 小时仍停在第一次无限量级的真实原因。

**(4) 下一步的最小改动（已定位到入口，未实施）**

在 `OrekiStageAuto.onAutoBuyerTick()` 的「已无限 && 未永恒 && 非 Doomed」窗口内，
每帧买 1 个可负担的无限升级（与 Web 的 `buyInfinityUpgrades()` 同策略），不写解锁位、不改成本。

**入口定位进度（如实记录，避免后来者走弯路）**：
`ButtonInfinityUpgrade.smali` 里 `d()V`（:281）**只是按状态刷颜色**，不是购买入口；
点击事件收敛到 `Lqg5;->u(Landroid/view/View;Landroid/widget/TextView;)V`（:987）。
真正的可重复升级 purchase 混淆名尚未定位，因此本文件**不宣称该改动已实施或已验证**。

#### C.86.5　教程中文化双端实机验收（含实际打开检查）

**Web（活页面，CDP 逐面板点开）**：`Modal.orekiTutorial.show()` → 依次点击 24 个
`.c-oreki-tut__nav-btn`，读 `.c-oreki-tut__content` 的 `innerText` 汇总
（记录：`web/reports/_r50/tut-live-check.{txt,json}`，脚本 `_tut_ch2.mjs`）。

| 指标 | 实测值 |
| --- | --- |
| 面板数 / 空面板 | 24 / **0** |
| 弹窗尺寸 | 1238 × 404（1280 视口） |
| 全文总字数 | 77,301 |
| 缩写出现总数 | **32** |
| 11 个中文名命中 | **11 / 11** |
| 正文中的缩写（第 5/7/8/10/11/15 章） | 13 处，**全部带中文注解**（无注解 0） |
| 附录 A 术语表内的缩写 | 19 处，全部位于「中文名 · 英文缩写 · 用途」三列表中 |

**Android（真机 Activity + APK 资源）**：

* 直接拉起 `kajfosz.antimatterdimensions.oreki.tutorial.TutorialActivity`，
  `mCurrentFocus` 确认为该 Activity，截图 `android/reports/r50/r50_tut_android.png`
  （标题「Oreki 教程」、章节标签「开始之前 / 开局：10… / 维度献祭与第… / 第一次无限」、
  正文「第 4 章　无限升级与普通挑战」，中文完整、**无乱码**）；
* 从设备内 `base.apk` 抽出 `assets/oreki_tutorial.txt`（166,158 B），
  与仓库 `android/AD_Oreki_Edition_Android/scripts/payload/assets/oreki_tutorial.txt`
  **SHA-256 逐字节一致**（`62a7fb9cbe215768…`）；
* 该文本 71,316 字，缩写出现 **32** 次，与 Web 完全同分布（`ID` 9、其余各 1~2），
  11 个中文名 **11 / 11** 命中，无括号注解 19 处**全部落在附录 A**（表格单元格 `TBL|` 标记）。

结论：双端教程内容同源、缩写分布一致、正文裸露缩写为 0；此前「只需改源 JSON」的判断成立。

---

### C.87　R50-A8：Android 无限升级自动购买（入口定位 + 首轮实测）

本节替换 C.86.4 末尾「真正的可重复升级 purchase 混淆名尚未定位」这一条 —— 入口已定位并已实测生效。

#### C.87.1　逆向结论：六个混淆名一次说清【读码】

在 `work/base_decoded/smali`（原版 base APK 反编译产物）逐个方法体核对：

| 混淆名 | 真实语义 | 依据 |
| --- | --- | --- |
| `Laz1;` | `InfinityUpgrade` 持有类 | `a:Luu1;` = ipMult；`b..m` = 12 个一次性；`n..r` = `Lwy1/Lxy1/Lyy1/Lzy1/Lvy1` 5 个可重复项；`s:Ljava/util/List;` = `all`（17 项）；`t` = id 列表 |
| `Lry1` | 一次性无限升级（`extends Lav extends Lfp3`） | `n:Ljava/lang/String;` = id 字符串；`D(ZLvh0;)Ljava/lang/Boolean;` 先过 `fp3.a(Z)` 再 `invoke-super` |
| `Luu1` | **`InfinityUpgrade.ipMult`** | 全工程唯一写 `Player.ipMultUpgrades` 的地方：`uu1.J(J)V` → `Player->O0(J)V`；`I()J` → `Player->G()J` 读回 |
| `Lfp3` | 通用「可购买」基类 | `a(Z)Z` = `!B() && z() && A()`；`D(ZLvh0;)` = 扣费 `y().i(x())` → `E(true)` → `C(true,Z)` |
| `Lav` | 位图型升级基类（`extends Lfp3`） | `B()Z` = `J().e(I())` 读位；`E(Z)V` = `J().g(I())` 置位；`I()I` = `ak1.c`（该升级在 BitSet 里的下标） |
| `Laz1;->a` 的解锁门 | 成就 41 | `uu1.A(Z)Z` → `Lz3;->a(0x29)` 即成就 41「购买 16 个无限升级」（Web 同名判据 `infinity-upgrades.js:337 checkRequirement: Achievement(41).isUnlocked`） |

**购买入口**：`Lfp3;->D(ZLvh0;)Ljava/lang/Boolean;`，`Z=false` 即单次购买。
与 UI 点击链 `MainActivityInfinityUpgradesKt$loadViewsInfinityUpgrades$5$1$1:38`
调的是**同一个方法**；`invoke-super` 的接收者是 `Lfp3`（`ry1` 的祖父类，中间隔着 `av`）。
两个实现体都没有 `COROUTINE_SUSPENDED` 分支，所以传 `null` 当 Continuation 是安全的。

#### C.87.2　A8 实测：一次改动把「IP 只能线性爬」改成「IP 复利」【实测】

构建：2026-11-01 08:54 `release/反物质维度.apk`（`classes.dex` 14176644 B 内可见
`buyInfinityUpgrades`），装机到 `emulator-5554`，用**既有存档**（非新档）连跑，
`adb pull /data/data/com.oreki.antimatterdimensions/files/player.json` 两次采样：

| 字段 | 改动前（R50 上一轮） | 09:01 采样 | 09:06 采样（+300 s） |
| --- | --- | --- | --- |
| `ipMultUpgrades` | **0** | **6** | **7** |
| `infinityUpgradeBits` | — | **65535**（16 个一次性全买齐） | 65535 |
| `infinityPoints` | 559 | 3.78e6 | **1.16e7** |
| `infinities` | 791 | 1065 | 1155 |
| `auto.bigCrunch.interval` | 907 | **100.0**（拉满） | 100.0 |
| `auto.bigCrunch.cost` | 1024 | 32768（第 16 级） | 32768 |
| `brake` | false | **false** | **false** |

同时点：`infinityUpgradeBits=65535` → 成就 41 达成 → 原版 `IPMultAutobuyerState` 那条
（AU5 已放宽 `e02.n0()` 解锁门）开始真正买 ipMult ⇒ `ipMultUpgrades` 从 0 变 6/7。
**即：C.86.4 里「`player.auto.ipMult` 是空开关」的成因是前置缺失，不是开关本身坏了。**
坍缩节奏也从 17.7 真实秒/次加快到约 3.3 秒/次（300 s 内 +90 次）。

#### C.87.3　必须记录的坑：`ry1.D(false,null)` 在「已买」的一次性升级上仍会返回 TRUE【实测】

A8 首版直接以 `D()` 的返回值为「买到没买到」的判据，结果 logcat 里
`OREKI_IUP_BUY: timeMult` 在 60 秒内打了 **3493 行**（≈1 行/tick，间隔 27 ms），
而 `infinityUpgradeBits` 早就等于 65535 —— 说明这些「购买成功」是**空转**。

根因：`ry1.D` 在 `fp3.a(Z)` 为假之后还有一条 Ra 记忆分支，满足条件时返回
`Boolean.TRUE` 而不改任何一次性升级状态；循环于是每帧都在第 0 项提前 `return`，
后面 16 项与 ipMult 分支永远轮不到。
A9 修正：进循环先判 `Lav;->B()Z`（该升级的位是否已在 BitSet 里），为真直接跳过，
**不再拿 `D()` 的返回值当状态判据**。

#### C.87.4　仍未打通的一环：`brake` 仍为 false【实测】

* `OrekiBreakGate` 的窗口在 08:58:54.457 打开过（`OREKI_GATE: window=1`），
  说明「非 Doomed / 总开关开 / 不在挑战里」三条早退全部通过；
* 但 15 分钟过去 `brake=false`、`OREKI_BREAK` **一行都没有**、`OREKI_ABORT` 也一行没有
  —— 即既没成功也没走到任一失败出口；
* A9 加了两条取证与一条兜底（`OREKI_BG_PRE` / `OREKI_BRK2`），结果见 C.88。

本文件**不宣称** Android 已经 Break、已经永恒、已经通关。

---

### C.88　R50-A9 实测结论：Android 已打通 Break 层，但仍在 ID1 之前（2026-11-01）

本节是 C.87.4 的**后续事实补充**。C.87.4 记录的是 A8 阶段的历史状态
（「`brake` 仍为 false」），那段文字**保持原样不修改**——它是 A8 当时的真实观测，
不能因为后来打通了就回头篡改历史。本节说明 A9 之后发生了什么。

#### C.88.1　A9 已在既有存档实测打通 Break【实测】

版本：Android `e56ebf328fc19f264dddd59657fa16f89ba6bf2f`（A9），
`emulator-5554`，**既有存档**（非新档），`adb pull /data/data/com.oreki.antimatterdimensions/files/player.json`。

| 字段 | C.87.4（A8） | A9 采样 ①  09:21:34 | A9 采样 ②  09:22:35 |
| --- | --- | --- | --- |
| `brake` | false | **true** | **true** |
| `records.thisInfinity.maxAM` | 1e153 | 3.22492335183615e909 | 2.15118079378893e917 |
| `ipMultUpgrades` | 0 | **7** | 7 |
| `infinityUpgradeBits` | 65535 | **131071** | 131071 |
| `infinityPoints` | 559 | **8.7593197e7** | **9.2818413e7** |
| `infinities` | 791 | 1.418e3（1418） | 1418 |
| `breakInfinityUpgradeBits` | 0 | **0** | **0** |
| `eternities` | 0 | **0** | **0** |
| `dimensions.infinity[0].isUnlocked` | — | **false** | **false** |
| `dimensions.infinity[0].bought` | — | **0** | **0** |
| `records.realTimePlayed` | — | 19228800 ms | 19288809 ms |

`brake=true` 且 `thisInfinity.maxAM` 已到 1e909 / 1e917（远超 1e308 的普通上限），
**这证明 Break 层在 Android 上真的打开了，不是只写了个字段**：
Break 之后 AM 才能继续越过 1e308 这个原本的硬顶，而它现在到了 1e917。
同一时刻 `infinityUpgradeBits` 从 65535 涨到 131071（新增第 17 位，即 2^16），
`ipMultUpgrades` 0→7，`infinityPoints` 559→9.28e7 —— 这三项一起动，
说明无限升级自动购买与 ipMult 复利链已经真实运转。

#### C.88.2　「8.76e7」与「9.28e7」不是矛盾，是两次不同采样【实测】

执行令要求核实这两个数字。查证结果：两者都对，来源是两个不同时间点的独立采样文件。

* `reports/r50/player_a9.json`，mtime **09:21:34**，`infinityPoints = {mantissa: 8.7593197, exponent: 7.0}` → **8.7593197e7**
* `reports/r50/player_a9b.json`，mtime **09:22:35**，`infinityPoints = {mantissa: 9.2818413, exponent: 7.0}` → **9.2818413e7**

A9 提交信息里写的 8.76e7 取自 ①，我方本轮汇报里写的 9.28e7 取自 ②。
两者相差 61 秒、约 522 万 IP。**不是数据冲突，引用时必须带上采样文件名与时间**。
今后凡引用数值一律注明来源文件。

#### C.88.3　09:22 采样显示 Eternity 与无限维度均未推进——不得宣称已通关【实测】

同一份 `player_a9b.json` 里：

* `eternities = {mantissa: 0.0, exponent: 0.0}` → **永恒一次都没做**
* `breakInfinityUpgradeBits = 0` → **Break 升级一个没买**
* `dimensions.infinity[0].isUnlocked = false`、`bought = 0` → **ID1 连解锁都没有**

因此本轮**明确不宣称** Android 已永恒、已现实、已通关。A9 的成果边界就是「Break 层打通」。

#### C.88.4　ID1 迟迟不解锁不是死锁，是两项门槛都还差【读码 + 实测对照】

Web 原版判据（`src/core/dimensions/infinity-dimension.js`）：

```js
// :44-52  UNLOCK_REQUIREMENTS[1] = DC.E1100
// :57     BASE_COSTS[1] = 1e8
get antimatterRequirementReached() {
  return player.records.thisEternity.maxAM.gte(this.amRequirement);   // :88
}
get ipRequirementReached() {
  return !this.hasIPUnlock || Currency.infinityPoints.value.gte(this.ipRequirement);  // :96
}
get canUnlock() {
  return (Perk.bypassIDAntimatter.canBeApplied || this.antimatterRequirementReached) &&
    this.ipRequirementReached;   // :100-101
}
```

即 **ID1 解锁 = `thisEternity.maxAM ≥ 1e1100` 且 `IP ≥ 1e8`**（两条件同时成立）。

对照 A9 采样 ②：`thisInfinity.maxAM = 2.15e917`、`IP = 9.28e7`。

* AM 侧：1e917 vs 1e1100 → **还差 183 个数量级**
* IP 侧：9.28e7 vs 1e8 → **还差约 7.7%**

注意 `antimatterRequirementReached` 读的是 **`thisEternity`** 不是 `thisInfinity`；
在没有永恒之前两者等价，但一旦进入永恒就会分叉，后续回归必须以 `thisEternity` 为准。

**结论**：Android 当前不是卡死，是进度真的还没到。真正缺的是让 AM 从 1e917 推到 1e1100 的
持续增长能力（自动买 AD / 自动 galaxy / 自动维度推进），而不是解锁位没写。

#### C.88.5　下一个缺口已定位：无限维度自动解锁/自动购买【读码】

原版 `InfinityDimensionState.buySingle()` 第一行就是自动解锁：

```js
buySingle() {
  if (!this.isUnlocked) return this.unlock();   // infinity-dimension.js:256
  ...
}
```

`unlock()` 内部先判 `canUnlock`，通过才置 `isUnlocked = true` 并派发
`GAME_EVENT.INFINITY_DIMENSION_UNLOCKED`（:243-252）。也就是说
**只要自动购买器调 `buySingle`，解锁会自动发生**，不需要单独调用 UI 的 `unlockNext()`。

Web 端存在 `UnlockInfinityDimButton`（`src/components/ui-modes/prestige-header/`），
但那只是手动 UI 包装；自动化路径靠 `buySingle` 的短路分支。
**Android 侧 A9 只补了 `buyInfinityUpgrades` 与 `tryBreakInfinity`，尚无无限维度自动购买**——
这是 C.87/C.88 之后的下一个明确缺口，需按 `Lfp3` 同思路定位 ID 的购买入口后补齐。

#### C.88.6　测试纪律：两种测试必须分开记账

执行令要求区分。今后所有 Android 结论必须标注属于哪一类：

| 类型 | 起点 | 能证明什么 | 不能证明什么 |
| --- | --- | --- | --- |
| **阶段验证** | A9 已 Break 的既有存档快照 | 单个机制/单个缺口是否修好 | 不能证明新档能走到这里 |
| **端到端通关** | **真正全新存档**（不修改存档伪造） | 180 分钟预算是否达标、`isGameEnd===true` | —— |

C.88.1 的全部数据属于**阶段验证**。Android 的端到端通关测试**尚未开始**。

#### C.88.7　本节边界

本文件**不宣称**：Android 已解锁无限维度、已进入永恒、已到现实/天神/Pelle/终局。
当前可确证的只有 C.88.1 那一张表：Break 层通了，路还长。

---

### C.89　R50 测试方法论：离线结算弹窗会让全部 Android 基线失效（2026-11-01）

本节记录一个**会让所有 Android 进度数据变成假数据**的坑，以及三次由此产生的误判。
写在这里是因为它比任何一个具体 bug 都更危险——它不报错、不崩溃，只是安静地让数字停住。

#### C.89.1　现象：游戏停在「在你离开的这段时间里」

09:44 直接截屏检查，游戏界面停在离线结算弹窗：

```
在你离开的 15 分 52 秒里，
你获得了 8.25e77 反物质。
[开始游戏]
```

**这个弹窗期间游戏主循环是阻塞的**：不推进时间、不写存档、不跑自动化。
点掉「开始游戏」后进度才恢复——同一份存档在 45 秒内 `AM` 从 `9.25e927` 涨到 `3.19e929`，
而弹窗挂着的那十几分钟里数字几乎不动。

#### C.89.2　由此产生的三次误判（全部撤回）

| 误判结论 | 当时的"证据" | 实际情况 |
| --- | --- | --- |
| 「`bulkBuy` 没有作用于 AD、只影响 ID」 | `dimensions.antimatter[0].bought` 两次采样完全相同 | 弹窗阻塞，那段根本没推进过，采样拿到的是同一帧 |
| 「模拟器卡死，qemu 100% 空转」 | 两次采样 `rtp` 完全相等 + qemu CPU 满载 | 同上；qemu 的 CPU 消耗来自弹窗渲染 |
| 「游戏主线程死循环」 | 同上 + 扫出多处向后 `goto` | 同上；实际所有循环都有界（`buyInfinityUpgrades` 最多 17 项、`upgradeCrunchInterval` 封顶 16 次） |

三次误判的**共同根因**是同一个错误方法：**拿 `player.json` 的两帧去比 `records.realTimePlayed`**。
`player.json` 是**定期写盘**的，两次采样落在同一写盘周期内必然读到完全相同的值，
而这个"相同"既可能是真卡住、也可能是弹窗阻塞、还可能只是没到写盘点——三者无法区分。

#### C.89.3　正确判据（今后一律按这个来）

判断 Android 是否真的在运行，**必须两条以上互相印证**，单看存档字段一律不算：

1. **先看屏**：`adb exec-out screencap -p > x.png` 或者 `dumpsys window | rg mCurrentFocus`
   确认焦点在 `MainActivity`、且**没有离线结算弹窗**；
2. **再看 logcat 时间戳**：`adb logcat -d -v time | rg "OREKI_" | tail -3`，
   时间戳在前进才算在跑（这是最可靠的一条，比存档可靠得多）；
3. **最后才看存档**，且**两次采样间隔 ≥ 60 秒**。

配套的现场修复（已执行）：
```
adb shell svc power stayon true
adb shell settings put system screen_off_timeout 3600000
```
否则模拟器息屏 → 触发离线结算 → 下次看的时候就是弹窗阻塞的假数据。

**这条对 180 分钟目标本身也是真实风险**：如果自动化跑着跑着弹窗阻塞，等待时间全部作废，
而看板上"游戏在运行"的假象会让人误以为在推进。

#### C.89.4　Android 真实在线基线（A9 存档、屏幕常亮后重测）【实测】

换掉弹窗干扰后重测，同一份 A9 存档、真实在线推进：

| 时刻 | 反物质 | ID1 进度 | IP |
| --- | --- | --- | --- |
| 09:47 | 9.25e927 | 89.22% | 3.25e7 |
| 09:52 | 1.76e932 | 91.76% | 7.97e7 |
| 09:58 | 7.48e932 | 92.33% | 9.73e7 |

即 **10 分钟推进约 34 个反物质数量级**，与先前"20 分钟只涨 4 个数量级"的记录**不是同一件事**：
后者是弹窗阻塞下的读数，**作废，不得再引用**。

按此速率，ID1 的 `1e1100` 门槛约需再 98 分钟（估算，非实测）。

#### C.89.5　已确认的真实自动化缺口（不是弹窗造成的）

| 缺口 | 证据 | 影响 |
| --- | --- | --- |
| **AD4「首次永恒前维度提升/星系重置不清零反物质」缺失** | Web `dimension-boost.js:16-23` / `galaxy.js:18-39` 有 `[Oreki AD4]` 保留分支，Android 无对应 | 每次重置反物质归零，AM 无法跨越维度软上限区 |
| **自动献祭完全缺失** | 存档 `sacrificed=0`，而 UI 显示献祭倍率 `×6.17e3` | 白送的量级乘数没吃到 |
| **无限维度只买 ID1、无 8 层 buyMax** | `tryBuyId1()` 只处理 tier 1 | ID2~ID8 永远不会被买 |
| Break Infinity 升级未实现 | `breakInfinityUpgradeBits=0` | Break 后廉价乘数升级全未利用 |

判据「维度处于软上限区」：游戏内显示「你的反物质每秒 ×1.01」，即产量只有存量的 1%
——此时继续买维度推不动成本曲线，必须先抬乘数（献祭 + 重置不清零）。

#### C.89.6　`CrunchAutobuyerState` 访问器映射（逆向成果，供后续复用）

`work/base_decoded/smali/kajfosz/antimatterdimensions/autobuyer/CrunchAutobuyerState.smali`

| 存档字段 | smali 字段 | 读 | 写 |
| --- | --- | --- | --- |
| `amount` | `amount:LBigDouble;` | `E()` / `F()` | `M(BigDouble)V` |
| `increaseWithMult` | `increaseWithMult:Z` | — | `N(Z)V` |
| `mode` | `mode:I` | `I()I` | `a(I)V` |
| `time` | `time:D` | — | `O(D)V` |
| `xHighest` | `xHighest:LBigDouble;` | `L()BigDouble` | `P(BigDouble)V` |

依据是各 setter 方法体的 `iput-object` 目标字段，非按方法名顺序推断。
注意 `G()BigDouble` 同时读 `xHighest` 与 `amount`（复合阈值计算），**不能当纯 getter 用**。

#### C.89.7　`xHighest` 的语义与两端差异【读码】

* 枚举值（`src/core/constants.js:202-206`）：`AMOUNT=0`、`TIME=1`、`X_HIGHEST=2`
* Web 默认（`player.js:78/83-88`）：`mode=0, amount=1, xHighest=1`
* Web 补丁（`big-crunch-autobuyer.js:21-27`，标记 `[Oreki AU4b]`）：切到 `mode=2, xHighest=10`
  ——注释原文：「用默认策略（AMOUNT，amount = 1）开自动坍缩会把反物质永久卡在 1.8e308……换成
  『单次 IP ≥ 10× 历史最高才坍缩』，让反物质在两次坍缩之间继续成长」
* Android 存档实测：`mode=2`（已切）但 **`xHighest=1.0`（未跟着切）**

即 Android 处在「模式对了、倍数没对」的半吊子状态：`X_HIGHEST=1` 等价于
「刚追上历史峰值就立刻坍缩」，每轮只能把峰值顶高一丁点。这是待修项，
但**不属于死锁**——C.89.4 已实测在线速率是 10 分钟 34 个数量级。

#### C.89.8　本节边界

C.89.4 的 09:47~09:58 数据来源于**既有存档的阶段验证**，不是全新存档端到端测试。
Android 的端到端通关测试**仍未开始**。本节不宣称 Android 已解锁 ID1、已永恒、已通关。

---

### C.90　无限维度购买链的三道坑（A11 之后的新证据，2026-11-01）

C.88.5 曾写「只要自动购买器调 `buySingle` 就会自动解锁」。这个说法对 Web 成立，
**对 Android 不成立**——Android 的 `h(Z)` 对应 `buyMax` 而不是 `buySingle`，且它不会解锁。
本节修正该结论并列出完整的三道坑。

#### C.90.1　`InfinityDimensionState` 方法语义【读码，逐方法体核对】

文件：`work/base_decoded/smali/kajfosz/antimatterdimensions/dimension/infinity/InfinityDimensionState.smali`

| 方法 | 等价 Web | 依据 |
| --- | --- | --- |
| `i()V` | `buySingle()` | `:1724-1737` 首行 `if (!isUnlocked) { M(); return; }`；`:1892` `baseAmount += 10` |
| `h(Z)V` | **`buyMax(auto)`** | `:1454` 算 `x()-y()`；`:1544` 用 `Li92;`(LinearCostScaling) 得 count/costMult/totalCost；`:1592` `count<=0` 即 return；`:1656` `baseAmount += 10*count` |
| `M()Z` | `unlock()` | `:975`，派发 `INFINITY_DIMENSION_UNLOCKED` |
| `G()Z` | `isUnlocked` | `:881` |
| `y()J` | `purchases` | `:3936` |
| `p()Z` | `canUnlock` | `thisEternity.maxAM >= 该层门槛` 且 IP 条件 |
| `D()Z` | `isAvailableForPurchase` | `:608-612` 含 `if (!isUnlocked) return false` |

**关键差异**：`h()` 第一句是 `if (!D()) return;`（`:1354-1362`），而 `D()` 里含
`if (!isUnlocked) return false`（`:608-612`）。
⇒ **未解锁时 `h()` 直接返回，且永远解不开锁。**
「未解锁先 unlock」那条短路只存在于 `i()`，不在 `h()`。

#### C.90.2　三道坑（A11 只修了第一道）

| # | 坑 | 状态 |
| --- | --- | --- |
| 1 | `tryBuyId1` 循环头 `if-le` 极性错误，1→8 循环一次不执行 | **A11 已修**（`3f4b99f`） |
| 2 | **`h(Z)` 不解锁**，只调 `h()` 时即使门槛达成也买不进 | **未修**，排 A12 |
| 3 | `D()` 尾部 `:643-663` 形状为「`purchases >= cap` 才返回 true」，与 Web `!isCapped` 极性相反（存疑） | **未验证**，可能是「解锁后仍买不动」的第三道 |

**C.88.5 的修正**：原文「调 `buySingle` 会自动解锁」仅对 Web 成立；
Android 必须在自动购买路径里**显式调 `M()`**，不能依赖 `h()`。

#### C.90.3　A11 实测归因修正

A11 实测（commit `3f4b99f`）：`OREKI_ID_LOOP=1`（循环执行证明）、`OREKI_ID=0`、`bought` 全 0。
当时归因为「`maxAM=1e941 < 1e1100`，`p()` 全为 false」。**该归因不完整**：
即便 `maxAM` 达到 1e1100，只要没先调 `M()`，`h()` 仍会因 `D()` 返回 false 而直接 return。
正确表述是「门槛未达 **且** 解锁链缺失」，两者叠加。

#### C.90.4　正确的自动购买序列

对齐 Web `infinity-dimension.js:398-409`（`InfinityDimensions.buyMax()` 内部先 unlock 再买）：

```
for tier in 1..8:
    d = InfinityDimensionState.a(tier)
    if (d.p())                      # canUnlock 闸门
        if (!d.G()) d.M()           # 显式解锁，不能省
        if (d.G())                  # 解锁成功
            if (d.y() == 0) d.i()   # 首次走 buySingle，把 baseAmount 抬起来
            d.h(1)                  # 再 buyMax 拉满
```

首次必须先 `i()`：`h()` 在 `count<=0` 时直接 return（`:1592`），`baseAmount` 为 0 时买不到。

#### C.90.5　两个容易误判的点（防后人绕路）

**1. `BigDouble` 是可变对象，不是 bug**
`multiplyParts(DD)` 结尾 `iput-wide → mantissa/exponent` 后 `return-object p0`
（`BigDouble.smali:2039` 段），`add(D)` → `addParts` 同形。
所以 `i()`/`h()` 内部 `cost.multiply(...)` 之后**没有 `move-result` 是正常的原地改写**，
不要往「ID 价格不涨」方向排查。

**2. `OrekiEternity:255` 的 `if-gt v2, v3` 严重度低于预期**
应当改为 `if-ge`（原版同构循环 `a.smali:13336`、`MainActivityInfinityDimensionsKt$...$2$1.smali:135`
均用 `if-ge`），但 Android 的 `SparseIntArray.keyAt(index)` 仅在
`sThrowForEmptyArrays=true` 时抛异常，而该开关**默认 false** ⇒ `keyAt(size)` 不崩溃，只读到 0。
实际后果是「多跑一轮、把 key 0 当研究 id 传入」，且整块被 `.catch Ljava/lang/Throwable;` 吞掉。
⇒ **应改，但它不是进度卡住的原因，低优先级。**

#### C.90.6　终局写入点（供后续验收使用）【读码】

`Player.I0(Z)V`（`Player.smali:8690`）是 `isGameEnd` 的写入方法。
核心写 `true` 的位置在 `celestials/pelle/b.smali:414`（`d(D)V` 内，前置 `:398 j0()` 判断未结束）；
UI 侧 `MainActivity$updateUI$9$onAnimationEnd$1.smali:172`；读档侧 `player/e.smali:39174`。

#### C.90.7　本节边界

不含任何「Android 已解锁无限维度」的宣称。截至本节，8 层 `isUnlocked` 仍全为 false、
`bought` 全为 0。第 2、3 道坑未修，ID 购买链尚未打通。

---

### C.91　Android Break 后二次停滞：节拍死区与 bulk 差异（2026-11-01）

本节记录 A10/A11 阶段暴露的两个新事实，以及一条会静默瘫痪整条自动化链的 smali 纪律。

#### C.91.1　`VerifyError` 会静默吃掉整条自动化链【实测】

android-agent 给 `OrekiBreakGate.tick()` 加探针时写了 `const/4 v7, 0x3`，
而 `v6/v7` 在该方法里是 **double 的宽寄存器对**。ART 校验结果是：

```
VerifyError: wide register v6 has type Double/Conflict
```

**后果不是「探针不生效」，而是整个类被 ART 拒收**：
`OrekiBreakGate.tick()` 每帧抛异常，被 `onAutoBuyerTick` 的 `try/catch` 吞掉，
于是**排在它后面的 `tryBreakInfinity`、`tryBuyId1` 也一并永远不执行**，且日志上没有任何异常痕迹。

**纪律**：`oreki/*.smali` 中凡 `.locals 16` 且用到 `v6 / v8 / v10 / v12 / v14` 的方法，
**绝不能写 `v7 / v9 / v11 / v13 / v15`**（它们是宽寄存器对的高半）。
新增探针前先数一遍该方法已有的宽寄存器占用。

这也为 C.88/A11 期间的「某些方法明明在调用链里却毫无日志」提供了一个新解释方向：
先怀疑类被拒收，再怀疑逻辑错误。

**⚠️ 修正与补充（2026-11-01T12:50+08:00，A13 期间实测，由 android-scheduler-agent 事故确认）**

上面那条「绝不能写 v7/v9/v11/v13/v15」**表述不够准确**。精确判据是：

> **写 high-half 是合法的，ART 只在「读」的时候报错。**

实测证据（`OrekiAutomationScheduler.allow(String)` 的真实崩溃）：

```
const-wide/16 v9, 0x0    # v9:v10 成为 long 对
...
const/16 v10, 0x3e8      # 写 v10 —— 合法，ART 不报任何错
...
mul-int v7, v7, v10      # 把 high-half 当 int 读 —— 此处才被校验器拒收
```

ART 原文：`Verifier rejected class ... allow(String) failed to verify:
[0x57] register v10 has type Precise High-half Constant: 0 but expected Integer`

**危害在于写法合法、定义与使用相隔几十行**，肉眼看 log 与代码都看不出问题，
直到装机冷启动才崩（`App.onCreate → OrekiSpeed.init`，即装了就打不开）。

**同一批里还发现一颗未爆炸的雷**：`noteActed` 的 wide 零常量放在 v12:v13，
而 v7 在后面被当 int 读 —— 当时没崩只是因为调用顺序没走到。只修报错那一处，
下一轮换个顺序就会炸。最终共修 4 个方法（`allow` / `noteActed` / `clearPending` / `beginFrame`）。

**既有三道静态闸门都拦不住这类问题**：

| 闸门 | 为什么拦不住 |
| --- | --- |
| smali 汇编器 | 不管寄存器宽度语义，`assembled=true` 照样通过 |
| `check_invoke_types.py` | 只检查 p 寄存器类型 |
| `_lint_smali.py` | 只检查「编号 < .locals」 |

**因此新增第四道闸门 `scripts/check_smali_wide_regs.py`**：
带 kill 的线性数据流分析（写即失效，只报「读」）。已验证有效性——
把该 bug 还原成最小样本能精确报出 `mul-int v7, v7, v10`，且对全 payload 26 个文件 0 误报。

**教训**：「静态检查全绿」不等于「能启动」。`VerifyError` 是 ART 运行时校验，
必须在装机后用「应用能否正常启动」来验证，不能拿汇编通过替代。

#### C.91.2　Break 后的二次停滞：100 ms 自动器节拍 vs 每帧购买的购买死区【实测 + 推断】

A10 新档端到端实测（屏常亮、已排除离线弹窗干扰）：

| 时刻 | 里程碑 |
| --- | --- |
| 02:50 | 新档 |
| 02:52 | AM 1e172、无限 11 次 |
| 03:00:35 | **Break 成功**（`OREKI_BRK2`，`brake=true`） |
| 03:08 | AM 1e837、无限 42 次、IP 1e5 |

即 **首次无限约 90 s、Break 约 10 分钟**。这一段的推进速度是正常的。

**问题出在 Break 之后**：03:01→03:17 之间 AM 从 1e559 涨到 1e909（仍在涨），
但 `AD1.bought` 1340→1350 后**冻结**、`AD8.bought` 420 冻结、`sacrificed` 733 冻结、`infinities` 42 冻结。

量化死结：`AD1` 下一次价格 `1e934`，当前 AM `1e909`；买 10 个只给约 `×2.2` 产量而价格涨约 1 个数量级
——**单次购买是亏的**。能提供乘法器的三条路同时被堵：
维度提升/星系被「需要 431 个第八维度，而 AD8 价格 1e969」挡住；
无限维度被 ID1 的 `1e1100` 门槛挡住；无限升级已买满。

机理解释【推断】：8 个 AD 自动器的 interval 是 **100 ms**，而 10000× 速度下这 100 ms 对应
**1000 秒游戏时间**；`OrekiSpeed.apply(D)` 只按倍率缩放游戏时间差，不提高 tick 频率。
于是每 100 ms 里游戏产量能跨几十个数量级，但价格只涨一点，形成「AM 在涨、价格不动」的死区。
对照 Web：`tryOrekiEarlyRoutine()` 是**每帧**（16.7 ms）调购买，快约 6 倍。

#### C.91.3　更关键的分叉：Web 有 `bulk`，Android 待确认【读码】

`web/AD-Oreki-Edition/src/core/autobuyers/antimatter-dimension-autobuyer.js`：

```js
get bulk() {
  return this.hasUnlimitedBulk ? 1e100 : Math.clampMax(this.data.bulk, this.bulkCap);
}
get hasUnlimitedBulk() { return Achievement(61).isUnlocked; }   // 成就 61 = 打破无限
get bulkCap() { return 512; }

tick() {
  switch (this.mode) {
    case AUTOBUYER_MODE.BUY_SINGLE: buyOneDimension(tier); break;
    case AUTOBUYER_MODE.BUY_10:     buyMaxDimension(tier, this.bulk); break;   // 传 bulk，不是常量 10
  }
}
```

**要点**：`BUY_10` 这个分支名有误导性——它调 `buyMaxDimension(tier, this.bulk)`，传的是 `bulk`。
而 `bulk` 在**成就 61（打破无限）解锁后变为 1e100**，即「每次买满」。

Android 侧实测 `mode=10` 且 `AD1.bought` 每次正好 +10，**与 Web 的「买满」并非同一语义**。
若确认 Android 缺少 `bulk` 等价机制，则单次购买量差约 98 个数量级，
死区的根因就不是节拍（6 倍），而是单次购买量（1e98 倍）。

**待验证**（四条，已下发给 android-agent）：
1. Android `AntimatterDimensionAutobuyerState` 有无 `bulk` 等价字段；
2. 有无 `hasUnlimitedBulk` 等价物（成就 61 的等价判据）；
3. Android 购买方法是否接受 count/limit 参数（对应 `buyMaxDimension(tier, bulk)`）；
4. 若确无 bulk，应在自动器路径上直接调「买满」入口，而非改自动器内部。

#### C.91.4　本节边界

C.91.2 的「首次无限 90 s / Break 10 分钟」是**全新存档端到端实测**（A10 构建），可信；
但 Break 之后的停滞**尚未解决**，因此不构成「Android 能通关」的任何证据。
8 层无限维度 `isUnlocked` 仍全为 false、`bought` 全为 0。

---

### C.92　Android「AM 被离线结算吹高」：一个会污染全部进度数据的方法论坑（2026-11-01）

本节记录 A12 阶段发现的一个**测试方式导致的伪死锁**。它解释的不是游戏 bug，
而是「为什么我们测了这么久一直在原地打转」。

#### C.92.1　现象：AM 指数完全静止，但维度生产是活的【实测】

3 次采样（间隔 3 分钟，期间未重启）：

```
t=  0s  AMexp=919.0  AD1.amount=1e776  AD8amount=420  AD8bought=420  AD1bought=1350  IPexp=5.0  inf=42  sacexp=733
t=180s  AMexp=919.0  AD1.amount=1e776  AD8amount=420  AD8bought=420  AD1bought=1350  IPexp=5.0  inf=42  sacexp=733
t=360s  AMexp=919.0  AD1.amount=1e777  AD8amount=420  AD8bought=420  AD1bought=1350  IPexp=5.0  inf=42  sacexp=733
```

**6 分钟内 `AMexp` 一位没动**（919.0 → 919.0 → 919.0，只有尾数在动），
但 `AD1.amount` 从 1e776 涨到 1e777。⇒ **维度生产是活的，AM 存量纹丝不动。**

算术对齐：

```
AD1.amount 1e777 × 乘数链 1e142 ≈ 1e919 = 当前 AM 存量
AD1 每秒产出 ≈ 1e912
⇒ 每秒新增 / 存量 ≈ 1e-7
```

**存量比产量高 7 个数量级。** 而「下一个买得起的东西」是 AD4 的 1e921，还差 2 个数量级——
按 1e-7 的相对增速需要约 1e9 秒。**这不是「等一会儿就好」，是永远等不到。**

#### C.92.2　因果假设：离线结算只累加产量、不执行购买【推断，证据较强】

**假设**：应用被杀 / 重装 / 模拟器重启后，启动时的「在你离开的 X 分 Y 秒里」离线结算，
会把 `产量 × 时长` 直接加进反物质，**但不执行任何购买**（弹窗期间主循环根本不跑）。

**支持证据**：

1. 每次 force-stop / reinstall / 模拟器重启都会触发一次结算弹窗（FACTS C.89.1 已记录该现象）；
2. A9→A12 期间重启十余次（force-stop、install、AVD 重启），每次都在「维度原地不动」的前提下抬高 AM；
3. 累积效应与观测吻合：AM 被堆到比维度经济高 7 个数量级的位置；
4. 连带解释 `sac 冻结`：献祭需要维度 1~7 长回来才够 `nextBoost`，而 AM 存量太高、买不到维度，
   于是献祭条件长期不满足；
5. 时间相关性吻合：死区出现在 A10 之后，但那段时间正好是重启最频繁的阶段，
   **不宜归因于 A10 的 `autoSacrifice()`**（该归因在 C.91.2 中曾提出，此处修正）。

**该假设尚未最终验证**，验证方法见 C.92.4。

#### C.92.3　对历史数据的污染警告【重要】

若上述假设成立，则 **A9~A12 期间所有 Android 进度采样都受过「十几次重启」的累积污染**，
它们的 AM 绝对值不能当作「自然推进的结果」来用。

**可以继续引用的**：

- 阶段里程碑的**顺序**（首次无限 → Break → ……）
- logcat 证据（`OREKI_BRK2`、`OREKI_ID_LOOP`、`OREKI_SAC` 等）
- 机制是否被触发（解锁位、bought 是否变化）

**不可再引用的**：

- 「AM 到 1e919 用了多久」这类**时间/速度**结论
- 「产量只有 1%」这类**比率**结论（它是存量被吹高的结果，不是经济健康度指标）
- 任何基于这些数据的「多少分钟能到某个里程碑」的推算

#### C.92.4　正确的测试方式（今后 Android 端到端必须遵守）

1. **干净新档 + 全程零重启**：一次 `install` 到位，之后**不 force-stop、不重装、不锁屏、不切后台**
2. 中途采样**只用 `adb pull`**（读文件不影响游戏进程），不做任何会杀进程的操作
3. 屏幕常亮 + `screen_off_timeout=3600000`（C.89.3 已要求）
4. 采样间隔 ≥ 60 秒（`player.json` 定期写盘）
5. **报告时必须写明本轮重启次数**；重启过一次，速度类结论即作废

**判据分层**（避免又误判）：
| 观测量 | 说明 |
| --- | --- |
| `AD1.amount` 序列 | 必须持续增长；停涨才是真问题 |
| `AM` 指数 | 存量被吹高时可能长期不动，**不能单独作为「卡死」判据** |
| `AD8.bought` | 能否补到 431，决定维度提升/星系能否解锁 |

#### C.92.5　本节同时修正主 Agent 的一次计算错误

C.92.1 之前，主 Agent 曾用「UI 显示每秒 ×1.01」推算「涨 1 个数量级需 232 秒、到 AD8 需 44.5 分钟」。

**该推算错误**：`×1.01` 是**产量/存量比值**，不是存量增长率。
存量增长率是 `1e-7` 量级，与 1% 差 5 个数量级。**结论作废，不得引用。**

#### C.92.6　待办（若假设被验证成立）

- 核对 Web `away-progress.js`：离线结算是否同样跳过购买。若是，则属**原版设计**，不改游戏。
- 在 Oreki 自动化补一条：**离线结算恢复后立刻尝试买维度**，把被吹高的 AM 花掉。
  否则真实玩家「切出去一会儿回来」也会撞上同一个脱节状态。
- 端到端测试脚本需内置「重启次数」计数，并在报告中强制披露。

#### C.92.7　本节边界

C.92.2 是**推断**，尚未完成验证。8 层无限维度 `isUnlocked` 仍全为 false、
`bought` 全为 0，Android 仍未打通 ID 购买链，更未通关。

---

### C.93　Android 停滞的真根因：少同步 Web 的 `[Oreki AD1]` 维度提升削弱补丁（2026-11-01）

本节记录今天最终定位到根因的过程，以及一个**双端等价核对方法的重大教训**。

#### C.93.1　真根因：AD8 需求斜率 15/次 vs 5/次【读码 + 数值验证】

Web 在 `src/core/dimboost.js:111-123` 有一个**本项目自己加的削弱补丁**：

```js
// [Oreki AD1] 原版 15/次 的 AD8 需求斜率在 Break 后会把成长反馈环卡死：
// R12 实测（干净驱动、无坍缩、150 s）：提升冻结在 32、星系 6，
// 反物质 15 s 就冲到 1e914 后 135 s 只再涨 15 个数量级并趋缓，
// 因为下一级提升要求 AD8 数量随次数线性抬升，而 AD8 自身已买不起。
// 改成 5/次 让提升继续、产量继续复利；其余（基础 20、折扣、EC5、charged 效果）全不动。
//
// [Oreki R25] 斜率必须钳在 ≥1。`discount` 是时间研究 211/222 的效果之和，
// 买到 211 后 discount 正好 = 5，原来的 `(5 - discount)` 于是变成 0：
// AD8 的需求量从此恒为 20 不再增长，而 maxBuyDimBoosts()（:256）用
// `increase = req2.amount - req1.amount` 做线性外推，一旦 AD8 数量恰好等于 20
// 就出现 0/0 = NaN → bulkRequirement(NaN) →「Cannot read properties of undefined」
// 每帧抛出，gameLoop 直接停摆。
```

**Android 端仍是原版 15/次，没有这个补丁。**

数值验证（`work/base_decoded/smali/kx0.smali`，方法 `a(D)Ljx0;` = `bulkRequirement`）：

```
:cond_0
const/16 v3, 0x8                              # tier == 8
if-ne v2, v3, :cond_1
const-wide/high16 v8, 0x4014000000000000L     # 5.0
sub-double v8, v0, v8                         # targetResets - 5
const-wide/high16 v10, 0x402e000000000000L    # 15.0   ← 原版斜率，未打补丁
sub-double/2addr v10, v4                      # 15 - discount
mul-double/2addr v10, v8
```

**对账**：

| 项 | 值 |
| --- | --- |
| 当前 `dimensionBoosts` | 32 → `targetResets` = 33 |
| Android（15/次） | `20 + (33−5)×15 = 440` → 扣 `InfinityUpgrade.resetBoost` 等后 **实测 431** |
| Web（5/次） | `20 + 28×5 = 160` ⇒ 当前 `AD8 = 420` **立刻满足** |

**且 Web 补丁注释里描述的冻结态「提升冻结在 32、星系 6」，与 Android 实测一字不差**
（`dimensionBoosts=32`、`galaxies=6`）。

⇒ **`db` 停在 32、`gal` 停在 6、AD8 停在 420、`maxAM` 只能靠第四维度缓慢爬升——全是它的下游症状。**

#### C.93.2　修复要点（三条，缺一不可）

1. **斜率 15 → `max(1, 5 − discount)`**
   —— 必须同时做 Web `[Oreki R25]` 的钳制，否则 `discount = 5` 时
   `(5 − discount) = 0` → AD8 需求量恒为 20 → `maxBuyDimBoosts()` 的
   `0/0 = NaN` → 每帧抛异常、gameLoop 停摆（Web 已实测过这个事故）。
2. **幂等 + 锚点断言**：找得到 `0x402e000000000000L # 15.0` 才改，
   找不到必须**抛异常失败**而非静默跳过；重复执行不叠加。
3. **寄存器安全**：改法需要第二对 double 寄存器，
   写错会触发 `VerifyError` **拒收整个类** → 该类所有调用静默失效（C.91.1 教训）。
   改前必须数清 `.locals` 与占用。

落点在 `scripts/build_mod.py` 新增 patch 函数 + 构建期改写 `kx0.smali`，不在 `OrekiStageAuto.smali`。

#### C.93.3　方法论教训：双端等价不能只看 `git log`

这次的根因**不是新 bug，是同步遗漏**：Web 修过、Android 没跟。

**今后做双端等价核对，必须逐个 patch 对，而不是比较提交历史或功能表现。**
具体做法：

1. 在 Web 侧 `rg "\[Oreki [A-Z0-9]+\]" src/core/` 列出**所有带项目标记的补丁点**
2. 对每一条，到 Android 的 `scripts/payload/smali/` 与 `build_mod.py` 里找对应实现
3. 产出「Web 补丁 ↔ Android 实现」对照表，**缺失项单列**
4. 这张表应进 FACTS 并在每轮双端核验时复用

`[Oreki AD1]`、`[Oreki AD4]`、`[Oreki AU4b]`、`[Oreki R25]` 这些标记是**最好的索引**。

#### C.93.4　今日四次错误假设（诚实记录）

定位到真根因之前，先后有四个假设被数据推翻：

| # | 假设 | 提出方 | 被推翻的原因 |
| --- | --- | --- | --- |
| 1 | `holdCrunch` 的 IP 门槛导致停止坍缩、AM 上不去 | android-agent | `infinities` 恒 42，根本没在坍缩 |
| 2 | `autoSacrifice()` 反复清零维度导致产量崩塌 | 主 Agent | `sacrificed` 冻结，献祭没在跑 |
| 3 | tickspeed 抢走 AM 导致维度买不起 | 主 Agent | `totalTickBought` 恒 340，一分钱没花 |
| 4 | 产量公式漏乘计数频率（66 个数量级差距） | 主 Agent | 把 BigDouble 锯齿的两端当两个时刻读错 |

**共同原因**：数据不足时急于定性；其中 2 次与 BigDouble 序列化 `{mantissa, exponent}` 的读取错误有关
（另一次是 C.89.2 的 `xHighest = 1.0×10^1` 误读成 1.0）。

**纪律**：连续多次假设被推翻时，应停止假设、改为分层测量（见 C.92.4 的判据分层）。

#### C.93.5　边界

本节结论成立，但**修复尚未实施、未构建、未验证**。
`dimensionBoosts` 是否真能从 32 往上走，需补丁落地并装机后实测确认。
Android 仍未解锁 ID1、未永恒、未通关。

---

### C.94　IP 有两个来源，不能拿「IP 在涨」推断「坍缩在跑」（2026-11-01）

本节修正一个被反复误用的前提，它导致过多次错误归因。

#### C.94.1　修正：「IP 的唯一来源是坍缩」是错的【读码】

**错误前提**（主 Agent 于 2026年11月1日 多次使用）：
> IP 的唯一来源是坍缩，所以 IP 在涨就说明坍缩在跑。

**实际**：IP 有**两条**独立来源。

| 来源 | 位置 | 触发方式 |
| --- | --- | --- |
| 大坍缩结算 | `src/core/big-crunch.js:70` 与 IP 结算 | 每次坍缩 |
| **`BreakInfinityUpgrade.ipGen` 被动产出** | **`src/core/big-crunch.js:190`**：`Currency.infinityPoints.add(BreakInfinityUpgrade.ipGen.effect × diff/60000)` | **每帧，完全不经过坍缩** |

`ipGen` = Break Infinity 升级「无限点数自动生成」，10 级，每级 ×10。

#### C.94.2　`infinities` 只有一个增量点，且每次必 +≥1【读码】

* `src/core/big-crunch.js:70`：`Currency.infinities.add(gainedInfinities().round())` —— **唯一增量点**
* `src/game.js:542`：`gainedInfinities()` 恒 `≥ 1`（挑战/佩勒特殊情形为 1，其余乘成就与时间研究）

⇒ **不存在「坍缩了却加 0」**。所以 `infinities` 恒定 ⇒ 坍缩**确实**停了，不是计数 bug。

#### C.94.3　三条决定性判据（不需要读教程，30 秒可定性）

| 判据 | 坍缩真停了 | 计数 bug（若有） |
| --- | --- | --- |
| **每分钟 IP 增量 ≈ `ipGen.effect`** | 两数相等 | IP 增量**大于** ipGen ⇒ 有坍缩在结算 |
| `records.thisInfinity.maxAM` | 在涨但 `infinities` 不动 ⇒ 卡在坍缩闸门 | 不涨 ⇒ AM 层另有阻塞 |
| `records.thisInfinity.realTime` | 持续增长（本纪未重置） | 每 100ms 归零（坍缩在跑） |

**第一条最快**：量 60 秒 IP 增量与 `ipGen.effect` 对账。

#### C.94.4　本次实测（2026年11月1日 13:20 采样）

```
infinities = 42（从 03:00 起未变）
IP         = 9.172e5（从 7.37e5 涨 24%）
AM         = 3.865e1384，maxAM = 1e1385
crunch: mode=2（X_HIGHEST），xHighest=10，interval=100
```

**结论**：坍缩确实停了（`infinities` 恒 42），IP 上涨来自 `ipGen`。
原因是 `X_HIGHEST/10` 在「AM 单调增长」局面下永不触发——AM 每帧刷新 maxAM，`AM ≥ 10×maxAM` 永不成立。

#### C.94.5　由此暴露的方法论问题

当天此前至少三次推断建立在这个错误前提上：
* 「IP 在涨 ⇒ 坍缩在跑 ⇒ 我们之前说坍缩停了是错的」
* 「要么计数 bug，要么 IP 有旁路」（实际就是旁路，且是**已知设计**）
* 「所有依赖 `infinities` 的判断都不可信」

**教训**：在把某个量当作「唯一来源」之前，必须先确认它真的只有一条路径。
`rg` 一次写入点比推理一百次要可靠——本例只需 `rg "infinityPoints.add" src/core/` 就能发现两条来源。

#### C.94.6　本节来源

本节结论由 **tutorial-agent** 从「教程口径 + Web 源码」双侧证出（任务单 `R50-AND-05` §十五），
主 Agent 仅做交叉核验与归档。方法论价值高于结论本身：
**当 smali 里刨不动时，用「教程正文 + Web 源码」反查原版应有行为，往往更快。**

### C.95　真机 dump 的换行是 `&#10;`：「整个 XML 里搜关键字」对多行文案恒不成立（2026-11-01）`[实测]`

#### C.95.1　现象

Android 上 `uiautomator dump` / `dumpsys` 导出的层级 XML 里，**多行文案的换行被转义成 `&#10;`**，
不是 `
`。实测样本（A17，`Oreki 设置` 页，29 节点）：

```
text="启用 Oreki 智能调度&#10;（关闭后所有 Oreki 自动动作立即停止，并清空待执行/冷却状态；…）"
text="严格模式：任意两次自动操作之间都必须 ≥ 间隔&#10;（连原版等价的连续购买也一起被限制，会显著变慢甚至停滞。默认关闭。）"
```

于是「关键字出现在整段 XML 字符串里」这种判据，对**跨行文案恒不成立** ——
文案明明在屏上，判定却说「未命中」。

#### C.95.2　影响

* R50-AND-04 的装机验证器（`scripts/verify_scheduler_device.py`）第 5 步：原实现 `关键字 in 整段XML`，
  跨行文案会假阴性；本次已修。
* R50-AND-05 可见性判定出现过同类假阴性。

同一判据还有第二个缺陷：在整段 XML 上搜关键字会**误命中 `class="...关键字..."` / `resource-id`**，
即假阳性。两个方向都错，所以「整段串搜」这件事本身不成立。

#### C.95.3　正确做法

1. **只比对节点的 `text` 属性值**，不要在整段 XML 上搜 —— 包括在 shell 里对 dump 文件做 `grep -c 关键字 dump.xml`：grep 不解码实体，跨行短语同样匹配不到，而且失败现象长得像「文案没渲染」，最容易被误判成 UI 缺陷；
2. 比对前**先做实体解码**：`&#10;` → 换行、`&#13;` → 回车、`&amp;` → `&`、`&lt;`/`&gt;` → `<`/`>`、`&quot;`/`&apos;`；
3. 「dump 里没有」有两种含义（**不存在** / **不在屏内**），断言「存在」时还要校验节点的 `bounds`
   落在屏内，断言「不存在」时必须记录滚动次数，否则 PASS/FAIL 都可能是假的；
4. 拿真机 dump 当**常驻 fixture**（`--fixture <xml>`）跑一遍解析器 —— mock 证明不了真机结构，
   而这条缺陷正是「mock 里写真实换行、真机给 `&#10;`」才漏掉的。

#### C.95.4　本节来源

由 R50-AND-04 实现装机验证时实测发现（真机 dump 见 `reports/r50and04/ui_settings_before.xml`），
tutorial-agent 同期在 R50-AND-05 遇到同一现象，双向印证。

## C.96　坍缩自动器的阈值语义：三种模式比的都是 IP，不是反物质（2026-11-01）

**【实测】Web 源码**（`web/AD-Oreki-Edition/src/core/autobuyers/big-crunch-autobuyer.js:139-146`）：

```js
case AUTO_CRUNCH_MODE.AMOUNT:    return gainedInfinityPoints().gte(this.amount);
case AUTO_CRUNCH_MODE.TIME:      return Time.thisInfinityRealTime.totalSeconds > this.time;
case AUTO_CRUNCH_MODE.X_HIGHEST: return gainedInfinityPoints().gte(this.highestPrevPrestige.times(this.xHighest));
```

三种模式比较对象全部是 **IP**，没有一种比反物质。

**【读码】枚举值**：`AUTO_CRUNCH_MODE = { AMOUNT: 0, TIME: 1, X_HIGHEST: 2 }`（Web `constants.js:202-206`）。

**【实测】Android A26 读数**（装机 75 秒，`mode=2 / xHighest=10`）：
`dimensionBoosts 7→87`、`galaxies 1→11`、`infinities 42→4305`、`IP 5.3e7→6.09e8`、ID1 已买（`baseAmount=10`）、ID2 已解锁。

**【推断，已作废】曾经认为「`F() = amount × 当前反物质`」**。这个推断在当时能解释两个现象，但被更简单的正确解释取代：`amount=1` 能坍缩是因为「本轮已得 IP ≥ 1」恒成立，`amount=1e1000` 不坍缩是因为该门槛永远够不着。**凡以「阈值乘以 AM」为前提的结论一律作废。**

**【实测】正确策略**：Web 用 `X_HIGHEST + xHighest=10`（单次 IP 达本次永恒最高单次 IP 的 10 倍才坍缩），在两处做归一化——`isUnlocked`（`[Oreki AU4b]`）与 `reset()`（`[Oreki R26]`）。Android 必须同样处理，且每 tick 无条件执行即可天然满足「重置后重新归一化」。

**教训**：`amount` 这个名字会误导人往反物质上想。判定任何阈值前，先去看比较式的**左边**是什么 getter，不要看字段名。

## C.97　`bought` 是假指标，真实购买次数是 `baseAmount / 10`（2026-11-01）

**【实测】** 存档里 `dimensions.infinity[i].bought` **恒为 0**，不随购买递增。
真实购买次数 = **`baseAmount / 10`**（对应 smali `y()J`），ID1 买过 1 次时 `baseAmount = 10`。

**【后果】** 曾多次把 `bought=0` 读成「没买成」，据此判断「解锁了但买不下」，全部误判。
判 ID 是否已购买，一律看 `baseAmount / 10 > 0`，不看 `bought`。

## C.98　`D(false,null)` 返回 true ≠ 真的买到：`OREKI_IPM_BUY` 刷到 11600 次，`ipMultUpgrades` 只有 4（2026年11月1日）

**【实测】** A28 装机 8 分钟读数（AVD `oreki_test`，存档 `player.json`）：

| 指标 | 值 |
| --- | --- |
| logcat `OREKI_IPM_BUY` 计数 | **11600**（仍在增长） |
| 存档 `ipMultUpgrades` | **4** |
| 存档 `infinityUpgradeBits` | **131071**（= 2^17−1，17 个一次性 IU 全买满） |
| `auto.bigCrunch.interval` | **100**（已升满 15 级） |
| `auto.bigCrunch.cost` | 32768 |
| `player.break` | **true**（Break 已打通） |
| `infinities` / `IP` | 729 / 7.59e4 |
| `records.thisEternity.maxIP` | 1.006e5 |

**【结论】** `fp3.D(Z,Lvh0;)Ljava/lang/Boolean;` 对 `az1.a`（ipMult 可重复升级）**会连续返回 true 而不真正提升等级**。
`OREKI_IPM_BUY` 打的是「`D()` 返回 true 的次数」，不是「等级」。**不能拿它当购买成功证据**（与 C.52「断言只证明指令在」同源）。

**【危害】** 每次假成功都可能伴随一次 IP 扣除，IP 因此在 1e4 量级反复波动（实测 7.7e4 → 9.8e3 → 7.6e4），
永远攒不到 ID1 解锁所需的 **1e8**。这是 A28 之后的新瓶颈，不是数值不够。

**【正确判据】** 判断某升级是否真买到，只认**存档字段前后差**：
- 一次性升级 → `infinityUpgradeBits` 的位翻转
- 可重复升级 → `ipMultUpgrades` 数值 +1
- 无限维度 → `baseAmount / 10`（见 C.97）

**【待办】** 给可重复购买加「前后值比较」的防假成功闸：值没变即视为失败并进冷却，不再每 tick 重试。

**【同源前例】** `resetBoost` 在 A27 也是每 tick「买到」一次（1007 次 / 25 s），见 `tasks/R51-AND-01.md` §五。

## C.99　C.98 的根因与修复：`uu1.E(Z)` 是空实现，`D()` 对可重复升级只扣钱不涨级（2026年11月1日）

**【读码】根因**：`fp3.D(Z,Lvh0;)` 的购买体是

```
a(p1) 为真 → y().i(x()) 扣钱 → E(true) → C(true,p1) → 返回 true
```

而 `uu1`（ipMult 的实现类）里：

| 方法 | uu1 里的实现 | 后果 |
| --- | --- | --- |
| `E(Z)V` | **空实现**（`uu1.smali:287` 只有 `return-void`） | 等级不增加 |
| `C(ZZ)V` | 未覆盖（用 `fp3` 的空实现） | 记录不更新 |
| `A(Z)Z` | 覆盖为「成就 41 已解锁 且 非 Doomed」 | **不是「买得起」判据** |
| `B()Z` | `ak1.u(this)` | 不是「已买」语义 |

⇒ `D()` 对可重复升级**扣了 IP 但等级不变**，这正是 C.98 观察到的「返回 true ≠ 买到」。

**【读码】正确路径**（原版 `a.smali:8820-8831`）：

```
cost   = uu1.x()LBigDouble;
cursor = uu1.y()Lln0;            // IP 货币容器
cursor.i(cost)                   // 内部先 f() 判买得起，再 l() 扣减，返回「真扣成功」
purchases = uu1.I()J + 1
uu1.J(purchases)                 // 写回等级
```

`ln0.f(BigDouble)Z` = `value.compareTo(cost) >= 0`（买得起）；
`ln0.i(BigDouble)Z` = 买得起则扣减并返回 true（`ln0.smali:1101-1118`）。

**【修复】** A29（提交 `a32d7ce`）：`OrekiStageAuto.buyInfinityUpgrades` 的 ipMult 段改为上面这条路径，
成功判据变成**真实状态变化**——`i()` 返回 false 就什么都不做；只有真涨级才计数并打 `OREKI_IPM_LV`。

**【双端核对】** Web 侧 `oreki-early-automation.js` 用的是原版 `InfinityUpgrade.ipMult.purchase()`
（每帧最多 1 个、刻意不用 buyMax），走的是 JS 原版正确路径，**不存在此缺陷**。故只修 Android。

**【判据教训】** 从此判断「Android 某升级是否真买到」只认三种存档字段差：
`infinityUpgradeBits` 位翻转 / `ipMultUpgrades` 数值 +1 / `baseAmount/10`（C.97）。
`OREKI_IPM_LV` 是**唯一**可信的 ipMult 计数日志——它只在 `J()` 真写入后触发。

### C.99.1　A29 零重启实测：修复有效（2026年11月1日 17:03 起）

**测试条件**：`oreki_test` AVD，A29 一次 `install` + `pm clear`，17:03 起不再重启 / 不 force-stop / 不锁屏 / 不切后台，90 s 采样。

| 时刻 | AM | inf | IP | brake | db / gal | ipMultUpgrades |
| --- | --- | --- | --- | --- | --- | --- |
| t=0 s | 4.89e100 | 0 | 0 | false | 17 / 1 | 0 |
| t=88 s | 8.47e113 | 0 | 0 | false | 37 / 2 | — |
| t=178 s | 5.7e318 | 27 | 2.02e5 | **true** | 22 / 8 | — |
| t=268 s | 3.71e1359 | 27 | **7.74e6** | true | 106 / 8 | **6** |

**结论**【实测】：

1. **C.98 已修复**——`ipMultUpgrades` 从 0 真涨到 6（A28 卡在 4 且 IP 在 1e4 反复蒸发）；
   IP 在 4.5 分钟内从 2.02e5 单调涨到 7.74e6（×38），无回落。
2. `infinityUpgradeBits` = 131071（17 项全买满）、`interval` = 100（Break 前置拉满）、`brake` = true。
3. 首次无限 → Break → 27 次无限，全部在 **178 秒内**完成（A28 到同阶段用了 8 分钟以上）。
4. `OREKI_IPM_LV` **未出现**——因为它的节流阈值是「每 100 级打一行」，而当前只买到 6 级。
   这是日志口径问题，不是功能问题；等级以存档字段为准（已在上表列出）。

**【待改进】** 把 `OREKI_IPM_LV` 的节流从「每 100 级」改成「每级都打（早期）+ 满 50 级后每 10 级」，让早期取证可见。

### C.99.2　A30 零重启对照：到 ID1 从 21 分钟降到 16.5 分钟（2026年11月1日，【实测】）

A29 与 A30 都是 `pm clear` 全新档、默认 10000×、90 s 采样、全程零重启。
A30 起点 = 2026年11月1日 17:57:29（真实读数）。

| 指标 | A29 | A30 |
| --- | --- | --- |
| 首次无限 → Break | 178 s 内 | 180 s 内（形状一致） |
| 到 **ID1 解锁并买下** | 约 21 分钟 | 约 **16.5 分钟** |
| 该时刻 IP | 1.83e7 | 6.7e6（更低即达成，说明 gain 效率更高） |
| `OREKI_IPM_LV` 日志 | 0 条（阈值 100 级过高） | **6 条**（A30 改阈值后可见） |

**结论**【实测】：A30 相比 A29 缩短约 4.5 分钟，来源是「ipMult 保留闸门 + 日志阈值修复」，
不是数值改动。两条曲线的 Break 时点几乎相同，说明差异发生在 Break 之后的 IP 积累段。

**仍未达成**：A30 的 `OREKI_SCHED act` 0 条（`allow("breakGate")` 恒拒），
调度器只初始化未管辖动作。A31 已给 `allow()` 的六个拒绝出口加 `OREKI_SCHED deny <code>` 诊断
（10 秒节流），待装机用运行期数据定位后修，**不盲改**。

### C.99.3　调度器 `act` 恒缺的真因：三处极性写反（2026年11月1日，用户指出 + 【读码】确认）

A30 实测 `OREKI_SCHED init` 正常、`act` 一条没有。根因不是接线缺失，而是
`OrekiAutomationScheduler.smali` 里**三处条件分支极性写反**，且旧检查器只查「标记字符串在不在」，
三处全绿。位置与语义：

| # | 位置 | 原写法 | 实际后果 | 正确写法 |
| --- | --- | --- | --- | --- |
| 1 | `isContIdx(I)Z` | `if-ltz p0, :cont` | `if-ltz` 是「小于零才跳」⇒ idx 0~3（routine/early/eternity/eternityReset）**不跳**，直接返回 false ⇒ 四个连续型任务全被误判为非连续型，默认档被错误限流 | `if-gez p0, :cont` |
| 2 | `allow()` 失败冷却 | `if-gtz v0, :gate` | deadline=0（**从未失败**）时 v0=0 不跳 → 拿 0 与 now 比 → 恒为负 → 下句 `if-lez…:deny` 拒绝 ⇒ **所有任务永远被拒** | `if-lez v0, :gate`，并补 `if-lez v0, :gate`（已过期）/ 否则 `goto :deny_5` |
| 3 | `allow()` 时间戳选择 | `if-eqz v0, :global` | 默认档（v0=0）跳到 `:global` 读 `sLastBeatAt`（全系统节拍）、严格档读 `sLastAct[idx]`（每任务）—— **两模式正好互换** ⇒ 默认档被误施全局节拍，不同策略任务互相挤占 | `if-nez v0, :global` |

**真值表（`isContIdx`，修复后逐项验证）**：`-1 → false`、`0/1/2/3 → true`、`4/8/10 → false`。

**检查器升级**：`scripts/check_automation_scheduler.py` 从「字符串存在性」改为
「语义断言 + 变异自测」，118 条。变异自测做法：把三处分别翻回错误写法，要求检查器**必须报错**。
实测：真源码 118 全过；把 `if-gez p0` 改回 `if-ltz p0` → 立即 3 条失败；还原 → 恢复全过。
**只加断言数量不算数，能对真改坏报红才算。**

**真动作记账**：`OrekiStageAuto.onAutoBuyerTick()` 原先在 `OrekiBreakGate.tick()`（返回 void、
内部多个提前返回）之后**无条件** `noteActed("breakGate")` —— 空转冒充成功、白吃节拍。
改为前后状态快照：`Player.m()Z`（brake）与 `CrunchAutobuyerState.v()Z`（hasMaxedInterval），
任一翻转才 `noteActed`，否则 `noteNoop`。`.locals` 由 1 扩到 6 存快照。

**【当前瓶颈】** `inf` 在 27 停住 90 秒以上：`X_HIGHEST/10` 策略要求单次 gain ≥ 历史最高 IP ×10，
`maxIP` 已被抬到 1e6 级，需要 gain 再涨一个数量级才坍缩。这与 Web 同策略同节奏（Web 599 s 通关），
不是死锁，但**是真实等待**——ID1 需要 IP ≥ 1e8，按每轮 ×10 还需 2 轮左右。

## C.100　1.79e308 AM 之前，维度提升**显示次数**上限是 16（2026年11月1日，用户提供）

**【事实】** 在达到 `1.79e308` AM 之前，原版 Antimatter Dimensions 的 Dimension Boost（维度提升）
**界面显示次数最多为 16 次**。

**证据等级**：本条由用户 2026年11月1日明确提供。**源码位置与两端 UI 读取点仍需核验**
（见文末「后续核验」）。在此之前，任何把它当「已核实代码行为」的引用都不成立。

**对 R51 的强制约束**：

1. **不得**把 MOD 存档或日志里的 `dimensionBoosts` 数值直接当作「原版界面显示次数」。
   两者口径不同：`Player.dimensionBoosts` 是 `D`（double）内部字段（setter `Player;->C0(D)V`，
   `Player.smali:8548`），而界面显示另有计算与上限。
2. A29 采样里出现的 `db=108`、`db=142` 等值**必须重新核对字段来源、单位与统计口径**，
   不得再写成「维度提升 108 次」这种界面口径的表述。
3. 必须区分四个不同的量：
   - 原版界面**显示次数**（受 16 上限约束，1.79e308 前）
   - 存档**内部字段** `Player.dimensionBoosts`（double，无 16 上限）
   - **实际购买次数**（自动器每次 successful buy 累加的次数）
   - 自动器的**执行次数**（含 no-op）
4. **买星系后的清零仍须按原版机制核验**，不能仅凭单个采样值判断「清零失效」。
   （已知两条路径都会写 setter：`prestige/c.smali:5609-5642` 与 `prestige/d.smali:727`，
   写入值是 `0.0` 或 `4.0`。见 §C.93.4 相邻讨论。）
5. **Web 与 Android 必须采用相同的显示语义与统计口径**。

**后续核验清单**（未完成前不得声称已核实）：

- [ ] 原版源码中 Dimension Boost 显示次数的计算与上限逻辑（16 从何而来、1.79e308 之后如何放开）
- [ ] Android `Player.C0(D)` 对应字段的 **UI 读取位置**（`mainactivity/l0.smali` 内 `Player;->u()D` 的使用点）
- [ ] Web 侧对应字段与 UI 显示逻辑（`src/core/dimboost.js` 与维度页组件）
- [ ] 用原版对照 APK 在 1.79e308 之前实测显示行为
- [ ] 修正 R51 相关日志标签与报告，避免把内部值误称「显示次数」

**本轮已发生的误用（记录在案）**：`tasks/R51-AND-01.md` §七/§八 的表格里把
`dimensionBoosts` 直接标成「db」，并在正文把它当作「维度提升次数」讨论 —— 属口径混用，
按本条改为「档位字段 `dimensionBoosts`」，不再与界面显示次数混为一谈。

### C.100.1　A30 零重启实测直接印证本条（2026年11月1日，【实测】）

A30 新档，起点 = 2026年11月1日 17:57:29（真实读数），相对时刻 t：

| t (s) | AM | `Player.dimensionBoosts` | brake | 说明 |
| --- | --- | --- | --- | --- |
| 0 | 1.28e113 | 17 | false | 已超 16 |
| **90** | **2.18e274** | **36** | **false** | **AM 仍 < 1.79e308，内部字段已是 36** |
| 180 | 5.7e1173 | 90 | true | 已 Break，上限放开 |

**结论**：`t=90` 这一点同时满足「AM < 1.79e308」与「`dimensionBoosts`=36 > 16」，
**直接证明内部字段与界面显示次数是两个口径**（界面在该阶段最多显示 16）。
这也是为什么不能拿采样值反推「界面显示多少」。

**尚未核验**（保持【未知】，不得当作已核实）：
- 16 这个上限在 smali 里的具体落点（自然上限还是显式 clamp）；
- Android UI 侧读 `Player;->u()D` 后是否有 `min(16, …)` 之类的格式化；
- Web 侧 `src/core/dimboost.js` 与维度页组件是否同样处理。

## C.101　时间标注口径：采样相对秒数不能反推墙钟（2026年11月1日）

> 编号说明：本条原先占用 `C.100`，2026年11月1日用户指定 `C.100` 为「维度提升显示次数上限」，
> 故本条让位改为 `C.101`。引用时请用新编号。

**【实测】** 本轮曾在 `OrekiStageAuto.smali` 注释与任务单里，把 A29 采样的相对时刻
（`t=808 s`）当成墙钟写下「2026-11-01 17:41」。真实时钟读数为 **2026年11月1日 17:27:47**，
两者相差 13 分钟 —— 说明那是**推算出来的时间**，违反 `AGENTS.md §48` 与 P1。

**【规则落地】** 从此：

1. 采样数据一律用**相对时刻** `t=<n> s` 表达，并在表头写明「起点 = 真实时钟读数 X」。
2. 任何墙钟时间必须**当场调用 `python scripts/oreki_time.py --human` 读取**，不得由 `t` 反推。
3. 无法读取时写「未记录」，不许补造。
4. 代码注释里同样适用：拿不到真实读数就写「相对时刻 t=…」，不要写一个看起来像墙钟的时刻。

**【自检】** 报告中出现「20XX年X月X日 HH:MM」的位置，逐个确认是读来的还是算来的；
本仓库 `scripts/oreki_time.py` 是唯一可信来源（`TZ=Asia/Shanghai date` 在本机有偏差，见 §48）。

## C.102　`x0(true)` 之后同一 tick 内 `m()` 仍返回 0 —— 前后快照为什么会永远「无变化」（2026年11月1日，【实测】）

**【实测】** R56 在 `tryBreakInfinity()` 的真实调用点 `Player.x0(true)` 前后各读一次 `m()`，得到：

```
13:30:37.715 I/OREKI_BRKTRACE2: x0-before brake=0
13:30:37.715 I/OREKI_BRKTRACE2: x0-after  brake=0
13:30:37.715 I/OREKI_BRK2:      Player.x0(true) + autobuyer.a.c()
```

同一时刻的存档：`brake = true`（`inf=27`、`IP=5.27e6`）。

**结论**：`Player.x0(Z)` 的实现是 `iput-boolean p1, p0, Player;->brake:Z`（`Player.smali` 逐行核对，无任何补丁改动它），
`Player.m()Z` 也是 `iget-boolean ... brake` —— 读写同一字段，代码上不可能不一致。
但**在 `x0(true)` 返回后的同一次方法调用里读到的仍是 0**，而存档与后续 tick 读到的是 true。

**这解释了两件事**：

1. 为什么 R53~R55 的「前后快照」永远判为「无变化」→ 走 `noteNoop` → 拿不到 `act`。
   **不是快照写错，而是这个字段的可见性在同一 tick 内不成立**（具体机制尚未查明，
   候选：字段被别的线程/协程回写、或 `x0` 在真实 APK 里另有实现路径）。
2. 为什么「调用了 `x0(true)`」与「状态已变」不能在同一帧内划等号。

**【纪律】** 因此：
- **不得**再用「同 tick 前后读 `brake`」作为 Break 记账依据。
- 若一定要给 Break 记账，应改为**下一 tick 复核**（延迟一帧判定），或用另一个确实即时变化的字段。
- 本条不改变「一次 Break 只记一次」的要求。

**【待查】** `x0` 是否在别处被再次写回（例如 `prestige/f` 的 realityReset 状态机、或 `pause` 相关逻辑），
以及 `brake` 是否为某个 `Player$X` 投影对象的副本字段 —— 本轮到此为止，不再深挖。

**【教训】** 一个「代码上不可能」的矛盾，只要有直接读数证据，就说明我们对运行期的假设错了；
此时应停止改代码，先把读数固化成事实。

## C.103　首次永恒之后，无限层自动化被一道硬门永久掐死（2026年11月1日，【读码】+【实测】）

### 事实

`android/.../oreki/OrekiStageAuto.smali` 的 `onAutoBuyerTick()` 里原有一段：

```
invoke-static {}, Lkajfosz/antimatterdimensions/oreki/OrekiStageAuto;->eternitiesZero()Z
move-result v0
if-eqz v0, :oreki_sa_try_end
```

`eternitiesZero()`（同文件）实现是 `Player.x()（eternities）compareTo 0 == 0 → true`。
因此 `if-eqz` 跳转的条件是 **eternities != 0**，即**首次永恒之后**直接跳到方法末尾。

**被跳过的调用（整段永久失效）**：

`enableIpMultAutobuyer` / `autoSacrifice` / `upgradeBulkAll` /
`buyInfinityUpgrades` / `upgradeCrunchInterval` / `breakGate` / `breakUpgrades` / `tryBuyId1`。

### 为什么这是通关时间墙，而不是「阶段结束就该停」

1. 每次永恒都会清空整个无限升级层（原版 `eternityReset`），
   而 `buyInfinityUpgrades` 是 Oreki 自补、**原版自动器里没有**的一层。
   停在永恒之后 = 此后每一轮无限都拿不到这批乘数。
2. `tryBuyId1` 的判据是 `records.thisEternity.maxAM >= ID.k()` ——
   本来就是**永恒内**语义，被这道门废掉等于无限维度永不购买。
3. `autoSacrifice` / `upgradeBulkAll` 都是每轮无限都要重做的动作。

### 修复

删除该门（提交 `5ea92f1`）。安全性依据：每个调用点自带守卫
（ipMult 幂等 / `canSacrifice` / `hasMaxedBulk` / `canBeBought` /
`hasMaxedInterval` / `!Player.m()` / ID 门槛），当前阶段不适用时退化为空操作，
不会重复扣费、不会重复购买。

### 构建期守卫

`scripts/build_mod.py` 里原本有**两条**断言锁在这道门上，删门后必须先改它们，否则构建红：
- `POLARITY` 表里 `"eternitiesZero()==false（已经永恒过）才停" → if-eqz` 一条 → 换成
  「`eternitiesZero()` 之后不得直跳 `:oreki_sa_try_end`」的正向正则守卫；
- `verify_eternity_chain()` 里用 `eternitiesZero` 当「策略块分叉点」排序句柄 → 换成
  `OrekiStageAuto;->tryBuyId1()V`（策略块末尾的等价句柄），保留「永恒层必须排在策略块之前」的原意。

**【教训】** 删除一段被多处断言锁死的代码，成本不在删，而在找出所有锁它的断言。
本次因此白跑两次 Gradle 构建（各约 3–5 分钟）。

### 同批另一项

`OrekiAutomationScheduler` 默认调度间隔 3 秒 → **1 秒**（R57 执行令要求）。
必须三处同改：`sIntervalDefault` 字段默认、`<clinit>` 的 `sIntervalSec` 初值、
`init()` 里 `SharedPreferences.getInt` 的缺省回退值。玩家已存的值照原样读回。
运行期实测证据：`OREKI_SCHED: init 调度：已启用 · 间隔 1 秒 · 单任务档`。

## C.104　硬门修复已获 eternities>0 的运行期证明；「ID1 门槛 bug」被推翻（2026年11月2日，【实测】）

### 受控测试夹具（明确标记：**不是新档通关成绩**）

`reports/r51/snapshots/r57b_fixture_eternity.json` = `r57_final.json` 仅把
`eternities` 写成 `{exponent:1.0, mantissa:1.0}`（= 1e1），其余字段原样。

### 两组采样（APK `b21b82f1…`，`oreki_test`）

| 采样 | AM | maxAM | inf | IP | eternities | ipMultUpgrades | ID 解锁 | ID 买次 |
|---|---|---|---|---|---|---|---|---|
| 第 1 次（装入后约 10 s） | 1.03e1361 | 1.03e1361 | 2.7e1 | 9.3e6 | **1e1** | **6** | `[]` | `[0,0,0,0,0,0,0,0]` |
| 第 2 次（+35 s） | 4.08e838 | 5.55e3118 | 3.1e1 | 1.14e13 | **1e1** | **13** | `[0,1,2]` | `[2,1,1,0,0,0,0,0]` |

### 结论一：C.103 的硬门修复**真实生效**

`ipMultUpgrades` 在 `eternities = 1e1`（>0，即 C.103 那道门本应跳转的条件）下
从 6 涨到 13，`IP` 从 9.3e6 涨到 1.14e13。这两个数字都只有
`buyInfinityUpgrades` 里的可重复 `ipMult` 分支会推动 —— 即该调用在永恒之后**确实恢复执行**。
修复前该分支被 `if-eqz v0, :oreki_sa_try_end` 整体跳过。

### 结论二：**「`tryBuyId1` 把成本当解锁门槛」是错的**（推翻 R57-A 的推断）

R57-A 记录过一条推断：maxAM=2.09e1373 时 ID 全部未解锁，怀疑 `k()` 返回的是成本 1e1400。
本次实测 maxAM 到 **5.55e3118** 后 `ID解锁=[0,1,2]`、`ID买次=[2,1,1,…]`，说明：

- `k()`（静态数组 `b`）**不是 bug 来源**，该分支能正常走到解锁与购买；
- 之前「全部跳过」只是因为 maxAM 还没到该数组的值，属**正常的门槛未达**，不是字段用错；
- 因此**不需要修改 `tryBuyId1`**。这条推断作废，避免了一次无依据的改动。

**【方法论】** 一个「看起来像 bug」的行为，在拿到跨过门槛后的对照采样之前，不能定案。
本次若按 R57-A 的推断直接改 `tryBuyId1`，会把本来正确的逻辑改坏。

## C.105　现实升级与膨胀的自动购买**原版每帧就在跑**，不是 Android 缺口（2026年11月2日，【读码】）

### 事实

`kajfosz/antimatterdimensions/a.smali` 的 `b(Lkotlin/coroutines/jvm/internal/ContinuationImpl;)Ljava/lang/Object;`
（`Game.autoBuyerTick` 的挂起体，起于 7697 行）里，**按顺序无条件**调用：

| 行 | 调用 | 语义 |
|---|---|---|
| 9360 前后 | `eternity/dilation/b;->a(Cont)` | 膨胀（Dilation）自动购买 |
| 9401 | `reality/upgrades/b;->a(Cont)` | **现实升级自动购买**（`RealityUpgrades$autobuy$1` 是它的状态机） |

两处都在 `TickProfiler$Phase` 切换之间、没有任何 `if` 门挡在调用点前面，
即：**只要原版自动购买器解锁，Android 每 tick 都会自动买现实升级与膨胀升级。**

### 对差距表的影响（重要，避免重复造轮子）

之前把「Reality 升级购买」「Dilation 自动推进」列为 Android「未实现」是**错的**：
这两块由原版自动器承担，Oreki 侧不需要另写一套。真正缺的是：

1. **符文装备**（原版没有自动装备；Web 有 `equipGlyphs()`）。
2. **Celestial / Laitela / Pelle 驱动**（原版全是界面按钮，没有自动器）。
3. **解锁那批自动器本身**所需的 RM / 现实升级前置。

### 顺带修正：现实最小间隔

`OrekiReality.smali` 原本 `0x3e8`（1 秒）就允许再次现实，而 Web `REALITY_MIN_INTERVAL_MS = 2000`。
现实会清空 `eternityChalls`、整棵时间研究树与 `maxDT`，1 秒一次等于把
「买满 EC → 建研究分叉 → 拿膨胀研究 1」整条链每秒打断一次。
已改为 `0x7d0`（2 秒），与 Web 同值。

### 顺带修正：Web 现实节奏的一个真实缺陷

`oreki-reality-automation.js` 的 `shouldReality()` 里，天神压制（`holdReality === true`）
只 `return false`，**没有清 `_readySince`**。压制一旦解除，`now - _readySince` 早已远超
10 000 ms，于是「现实就绪后先给膨胀研究 1 十秒窗口」这段保护**在解除压制的第一帧就被跳过**，
立刻现实 → 清空 `maxDT`，正是该函数注释里描述的病（DS1 拿不到 → RU18 拿不到 → Teresa 不出现）。
已改为压制期间 `this._readySince = 0`。

## C.106　Android 符文（Glyph）真实接口与「只填空槽」的安全依据（2026年11月2日，【读码】逐指令）

### 逐项确证（`reality/glyphs/i.smali` = 原版 `Glyphs`，`Glyph.smali` = `Glyph`）

| 用途 | 真实签名 | 证据 |
|---|---|---|
| 装备槽数组 | `Glyphs->e:[L.../Glyph;` | `L()` 里 `sget-object ... i;->e:[Glyph;` 后 `aput-object v2, v0, v1` 清空、`aput-object p0, v0, p1` 写入 |
| 装备（写入指定槽） | `Glyphs->L(Glyph;I)V` | 同上；随后 `Glyph->x(I)` 把槽号记回符文 |
| 背包列表 | `Player->Q()Player$Reality;->d()Player$Glyphs;->e()Ljava/util/List;` | `Glyphs->C()` 的实现就是这条链再 `new ArrayList(Collection)` |
| 槽位号 | `Glyph->l()I` → 字段 `idx` | **不是等级**（容易误判，特此记录） |
| 等级 | `Glyph->m()I` → 字段 `level` | |
| 强度 | `Glyph->e()D` | 内部用 `type` + `rarity` |
| 稀有度 | `Glyph->n()D` → 字段 `rarity` | |

### 「装备不会触发 Reality」的硬证据

`Glyphs->L(Glyph;I)V` 全长 222 行，方法体内：
**`prestige/f->` 出现 0 次，`ProcessReality`/`processReality` 出现 0 次。**

对照 Web：`Glyphs.equip()` 在目标槽**已占用**时会走 `swapIntoActive()`，后者含
`finishProcessReality({ reset: true })` = 一次**不发奖励**的完整现实重置。
Android 侧 `L` 本身不含该回调，但为与 Web 行为对齐、并避免任何未知分支，
`OrekiGlyphAuto` 仍**只填空槽**：找不到空槽直接返回，不替换、不卸下、不交换。

### 未确证、因此未使用的方法

- `Glyphs->K(Glyph;I)V`
- `Glyphs->b(Glyph;)V`（Ra 的 `allGamespeedGlyphs` 调它，但究竟是「装备」还是「入包」未定）

在语义未定的情况下不写调用 —— 误触一次替换就是一次无奖励现实重置，代价远大于收益。

### 已实现（`oreki/OrekiGlyphAuto.smali`）

`tick()Z`：取 `i->e` 找第一个 null 槽 → 取背包 List → 跳过 `l() >= 0`（已装备）
→ 按 `m() × e()` 取最大 → `Glyphs->L(glyph, slot)` → 打一行 `OREKI_GLYPH`。
每 tick 最多装一枚，装满即变空转；不写任何存档字段，幂等性完全由原版 `idx` 决定。

**未实现**：RU9/16/17/18/24 的「恰好 N 个」形态推进（需要先卸下再装，涉及 `K`/卸下语义与阈值）。

## C.107　符文「已装备」不能用 `idx` 判断——背包符文 idx 也是正数（2026年11月2日，【实测】存档字段）

实测样本（`build/r27_player.json`）：

| 位置 | JSON |
|---|---|
| 已装备（槽 0） | `{"effects":65536,"id":2,"idx":0,"level":1,"rarity":20.0,"type":"power"}` |
| 背包里 | `{"effects":206158430208,"id":1,"idx":20,"level":1,"rarity":0.00415,"type":"companion"}` |

R59 的 `OrekiGlyphAuto` 用「`Glyph->l()`（= `idx`）>= 0 即已装备、跳过」做候选过滤——
**背包符文的 idx 是 20，同样 >= 0**，于是每一枚背包符文都会被跳过，功能等于一枚都装不上。
已改为**与 `Glyphs->e` 数组做同一性比较**（在槽里就跳过），并额外排除 `companion`。

### 受控夹具注入的两个实测结论

1. **只改 `realities` 的夹具可以正常加载**：`r57_final.json` + `realities=1e1(3)` →
   载入后存档 `realities` 保持 3、`antimatter` 仍是 1e1361，文件字节数与推入时一致 ⇒ 未被回落。
2. **注入旧版符文对象会让整份存档被拒**：同样的基础存档，一旦把 `build/r27_player.json`
   里的 `Glyph` 对象塞进 `reality.glyphs.active/inventory`，载入后存档直接变成全新档
   （`realities=0`、`active=[]`、`inventory=[]`、文件体积从 31824 掉到 28144 字节）。
   二分结论：**问题在符文对象的反序列化，不在 `realities`**。
   因此「符文装备正例」本轮**仍未取得** —— 工作区内没有一份「真的走过 Reality 且带符文」的近期存档。

## C.108　R59/R60 的符文自动装备是「死代码」：五处极性全反；并修正 C.107 的归因（2026年11月2日，【实测】+【读码】）

### 五处反转（逐指令核对 `OrekiGlyphAuto.smali`）

| 位置 | 原写法 | 实际后果 | 正确写法 |
|---|---|---|---|
| 槽数组 null 保护 | `if-nez v0, :og_no` | 数组**非 null** 就退出 | `if-eqz` |
| 背包列表 null 保护 | `if-nez v3, :og_no` | 列表**非 null** 就退出 | `if-eqz` |
| GlyphType 判空 | `if-nez v10, :og_score` | 类型非 null 就跳去评分 ⇒ companion 判断整段被跳过 | `if-eqz` |
| companion 判定 | `if-eqz v10, :og_next` | 是 companion 返回 1 不跳（**放行**），普通符文返回 0 反被跳掉 | `if-nez` |
| 候选判空 | `if-nez v8, :og_no` | 选到候选（非 null）反而退出 | `if-eqz` |

净效果：**R59 与 R60 两版都不可能装上任何一枚符文**。
教训：这不是「实现不完整」，是「实现完全没跑过」——本轮之前从未有过正例，所以从没暴露。

### 修正 C.107 的归因（重要）

C.107 说「旧版符文对象被反序列化拒绝」。本轮实测更准确：
**`build/r27_player.json` 整份存档在当前版本都加载不了**（不只是符文对象）。
依据：把该存档按原样 push 进 AVD，启动后存档变成全新档
（`realities: 3 → 0`、`active/inventory` 全空、文件体积 36308 → 28141 字节）。
所以「跨版本注入符文」这条路整体不可行，不是符文字段的问题。

### 符文正例的真实阻塞点（结论）

符文只能由**一次真实 Reality** 产出。而工作区里没有任何「当前版本能加载 + 已到 Reality + 带符文」的存档：
唯一能加载的 `realities=3` 夹具（`r60_fx_ronly.json`）实测 `maxEP=0`、`eternities=0`、`dilation.studies=[]`，
离 `canReality`（EP 指数 ≥ 4000 + 膨胀研究）还很远。
⇒ 要拿正例，必须先真跑到首次 Reality，没有捷径。

## C.109　R62：869 份存档全部可解码 + 符文第七处根因（GlyphType 不是 Enum）+ 现实清 RU 的时间墙（2026年11月2日）

### 一、869 份存档：格式与解码方法（【实测】869/869 全部成功）

来源 `C:/Users/Oreki/Downloads/反物质维度安卓全存档-870个.zip`
（9 246 021 字节，SHA-256 `0b970629…`；869 个 `.txt`，无嵌套压缩）。

**不能自己拼 base64**——载荷做过字符替换，直接 `base64.b64decode` 必然失败
（`Incorrect padding` / `invalid code lengths`）。正确解码在仓库里已有：
`android/AD_Oreki_Edition_Android/scripts/savecodec.py`，顺序是

```
strip() → 去 BOM → 去前缀 "AntimatterDimensionsAndroidSaveFormat"
        → 去 "AAA" → 去尾部 "EndOfSavefile"
        → 替换 "0b"→"+" / "0c"→"/" / "0a"→"0"   ← 关键，缺这步必失败
        → 补 '=' 到 4 的倍数 → base64 → gunzip → JSON
```

本轮我用标准库重新摸了一遍格式，绕了 5 次弯路才对上；**下次直接用 savecodec.decode**。

**索引结果**（`reports/r51/saves_index.json`）：

| 指标 | 数量 |
|---|---|
| 可解码 | 869 / 869 |
| `realities > 0` | 470 |
| 背包符文非空 | 470 |
| 最高进度 | `Cel7+endgame`（realities ≈ 9.27e6，7 个天神全开） |

存档 `version = 30110200`（3.11.2），当前包 `30190000`（3.19.0），
字段比当前版本少 3 个（`creditsFinished` / `pendingPurchasedOfflineMs` /
`savedFinalRiftCheckpoint`），补齐后**可以正常加载**（实测：载入后 `realities`
与 `antimatter` 均保持，文件字节数不变）。

### 二、符文存档里 `active` 是**紧凑数组**，不能塞 `null`

想造「有空槽」的夹具时，把 `active` 某位置设为 `null` 会让**整份存档被拒**
（载入后回落新档：`realities 1731→0`、`active/inventory` 全空、79276→28142 字节）。
正确做法是**删掉数组尾部元素**（`active = active[:3]`），游戏会按「已装备 3 枚」处理。
⇒ 反过来也说明：R59~R62 的 `OrekiGlyphAuto` 在**运行时**找 `null` 槽是对的
（`Glyphs->e` 是定长数组，未装备位置为 null），但**存档层**不能写 null。

### 三、符文第七处根因：`GlyphType` 不继承 `java.lang.Enum`（【实测】VerifyError）

修完第六处极性后，装上新包立刻打出 **1461 条** `VerifyError`：

```
Verifier rejected class OrekiGlyphAuto: tick() failed to verify:
[0x56] 'this' argument 'Precise Reference: GlyphType'
       not instance of 'Reference: java.lang.Enum'
```

根因：`reality/glyphs/GlyphType.smali` 的声明是 **`.super Ljava/lang/Object;`** ——
R8 把 Kotlin `enum` 改写成普通类，它并不是 `java.lang.Enum` 的子类。
而代码里写的是 `invoke-virtual {v10}, Ljava/lang/Enum;->name()`。
ART 因此**拒收整个类**，`tick()` 一次都没执行。

**为什么前几轮没暴露**：六处极性全反，代码根本走不到这一行。
⇒ 教训：**「极性全反」会掩盖后面的类型错误**；修完极性必须立刻跑一次真机。

修法：改 `Object.toString()`（GlyphType 继承 Object，合法；R8 的 enum 型类保留枚举名）。

### 四、Android 现实自动化的时间墙：每 2 秒现实会把 RU 清空（【实测】）

夹具 `realities=1731`、`realityUpgradeBits=0xFFFFF`（20 位全满）、
`teresa.pouredAmount=1.136e21`。40 秒采样：

| 采样 | realities | pouredAmount |
|---|---|---|
| 起点 | 1.731 | 1.1358942413702872e+21 |
| +20 s | 1.732 | 同值（一位没变） |
| +40 s | 1.732 | 同值 |

原因：每次现实都清空 `reality.upgradeBits` → 下一帧「RU 全买完」不成立 →
Teresa 不浇 → 永远回到起点。Web 侧有 `holdReality` + 膨胀窗口 + 天神压制，
Android 侧此前**只有 2 秒最小间隔，没有任何 hold**。

修法：`OrekiTeresaAuto.isHolding()`（只在「RU 全买完且未浇满 1e24」时为真），
`OrekiReality` 在它为真时不现实。RU 没买完时照常现实攒 RM，不会死锁。

### 五、特蕾莎浇注的真实入口（【读码】逐指令）

`kajfosz/antimatterdimensions/a.smali` 的 `public static r()V`（主循环 `a.smali:14331` 每帧调用）：

```java
long now = System.currentTimeMillis();
if (MainActivity.yo) {                    // 「浇注按钮被按住」
    double diff = (now - a.l) / 1000.0;   // 真实秒差
    if (yr4.g()) {                        // pouredAmount < 1e24
        yr4.i += diff;
        double rate  = (teresa.poured + 1e6) * 0.01;
        double delta = min(pow(yr4.i, 2.0) * rate, rm.toDouble());
        double p     = min(delta, 1e24 - yr4.i()) + yr4.i();
        teresa.setPouredAmount(p);        // m(D)V
    }
}
```

⇒ **浇注整件事挂在 `MainActivity.yo` 这一个布尔值上**。
所以 `OrekiTeresaAuto` 只置/撤这个标志，不复制公式：浇注量、速率、RM 扣费、
解锁判定全部走原版同一段代码，时间基准天然是真实毫秒。

`MainActivity.yo` 是 `public static`（`MainActivity.smali:156`），
写它的只有两处：`wt.smali`（触摸监听：按下置真、抬起置假）与
`MainActivity.dispatchTouchEvent`（只在 ACTION_UP 时置假）。
⇒ 我们不碰屏幕时把它置真，它不会被 UI 冲掉。

### 六、`BitSet->a()` 是基数，不是最高位（【读码】）

`.method public final a()I` 的实现是 `iget-wide bits:J` + `Long.bitCount` + 返回 int。
所以「一次性 RU 是否全买完」= `upgradeBits.a() >= 20`。

## C.110　R63 真新档实测：前期很快，卡点在 Break 之后（2026年11月2日，【AVD 实测】）

### 一、完整时间线（3.19.0 全新存档，`pm clear` 起 t=0 = 18:44:09，零手动操作）

| t (s) | AM | thisInfinity.maxAM | infinities | IP | db | gal |
|---|---|---|---|---|---|---|
| 0 | 7.8e104 | 5.5e132 | 0 | 0 | 17 | 1 |
| 90 | 6.0e256 | 7.5e281 | 0 | 0 | 36 | 2 |
| 180 | 2.8e1223 | 3.0e1223 | **27** | 1.0e6 | 100 | 7 |
| 270 | 2.4e1359 | 2.4e1359 | 27 | 7.3e6 | 106 | 8 |
| 360 | 8.6e1362 | 8.6e1362 | 27 | 9.2e6 | 106 | 8 |
| 450 | 4.7e1360 | **1.0e1365** | 27 | 2.4e7 | 107 | 8 |

**前期没有时间墙**：180 秒完成首次无限 + Break Infinity。
Web 的 AD4 死锁（`canCrunch` 要 `maxAM ≥ 1.797e308`，而维度提升/星系重置把反物质清零）
**在 Android 上不成立** —— 这里 180 秒内 db 就冲到 100、gal 7、AM 1e1223。

### 二、真正的死锁在 Break 之后（【AVD 实测】7.5 分钟零坍缩）

t=180 → t=450（7.5 分钟）：

- `infinities` **恒为 27**，一次都没涨
- `IP` 靠**被动生成**从 1e6 涨到 2.4e7（`infinityUpgradeBits=131071` 全买，含 ipGen）
- `breakInfinityUpgradeBits = 0` —— **Break 升级一个都没买**
- `galaxies` 停在 8 不动
- `maxAM` 从 3e1223 涨到 1e1365（6 个数量级 / 3 分钟，靠反物质自然增长）

**闭环**：ID 用 IP 买 → IP 主要靠坍缩 → 坍缩停了 → IP 只靠被动（慢 1390+ 个数量级）
→ ID 永远买不起 → 反物质增长拿不到 ID 乘数。

### 三、坍缩为什么停：X_HIGHEST 门槛失效（【读码】+【实测】）

`applyCrunchPolicy()` 把自动坍缩设成 `mode = X_HIGHEST`，语义是
`gainedIP >= thisEternity.maxIP × xHighest` 才坍缩。

实测存档 `auto.bigCrunch = { mode: 2, amount: 1.0, interval: 100.0 }` ——
**`amount`（即 xHighest）是 1，不是注释里写的 10**。

`amount = 1` 时要求「本次坍缩的 IP ≥ 历史最高单次 IP × 1」，而 IP 当前主要来自被动生成、
单次坍缩的 IP 长期不增长 ⇒ **条件永远不满足 ⇒ 永不坍缩**。

`OREKI_CRUNCH` 位图恒为 `14` = mode(2) + canTick(1) + isUnlocked(1) + holdCrunch(0)：
**没有一条闸门在拦，纯粹是门槛数值不满足**。这与「被 hold 挡住」是两回事，此前的排查方向错了。

`OREKI_AU4B` 在 7.5 分钟里打了 14314 行（每 tick 一条），说明 `P(10)` 那条分支**每帧都在执行**，
但存档读回来仍是 1 ⇒ `P()` 写的字段与序列化出来的 `amount` 不是同一个，或写入被后续覆盖。
**这一点尚未定性**，本轮不动它。

### 四、本轮没做的事（明确）

- 没有改任何代码：三个候选修复（Break 升级购买 / X_HIGHEST 校准 / 恢复周期坍缩）
  都需要先确证 `P()` 的真实写入目标，否则改了也不知道有没有生效。
- 因此**本轮不构建 APK**（无代码变更，不拿未验证改动换交付）。

## C.111　R64：Break 后坍缩改为两段策略 + 教程与代码对齐（2026年11月2日，【读码】+【AVD 实测】+【静态】）

### 一、根因复核：`xHighest` 实测是 1，不是 10（修正 C.110 的一处措辞）

`r63_final.json` 的 `auto.bigCrunch` 完整结构：

```json
{"amount":{"mantissa":1.0},"increaseWithMult":true,"mode":2,"time":1.0,
 "xHighest":{"mantissa":1.0},"cost":32768.0,"interval":100.0,"isActive":true}
```

`mode=2`(X_HIGHEST)、**`xHighest=1.0`**、`time=1.0`。
C.110 写「`amount` 即 xHighest」是错的——`amount` 是 AMOUNT 模式的阈值，X_HIGHEST 用的是独立字段 `xHighest`。
访问器已逐指令确证：`L()` → `iget-object xHighest`，`P(BigDouble)` → `iput-object xHighest`。

### 二、坍缩为什么停：门槛在数值而不是闸门

X_HIGHEST 判据 = `gainedIP >= thisEternity.maxIP × xHighest`。
实测 `thisEternity.maxIP = 2.87e7`、`xHighest = 1.0` ⇒ 要求单次坍缩给出 ≥ 2.87e7 IP。
而单次坍缩的收益长期追不上这个峰值 ⇒ **条件永不满足 ⇒ 7.5 分钟零坍缩**（`infinities` 恒 27）。
IP 只能靠 `ipGen` 被动收入（1e6 → 2.4e7），而 Android 3.19.0 的 ID1 要 IP **4e8**，差 14 倍且越等越远。

`xHighest` 已经是 1，再往下调没有意义 ⇒ 本轮**换模式**而不是调参数。

### 三、修法：两段式坍缩策略（`OrekiStageAuto.applyCrunchPolicy`）

| 阶段 | 判据 | 策略 |
|---|---|---|
| 未 Break | `Player.m() == false` | 不干预 |
| 已在 TIME | `I() == 1` | 原样放手（尊重玩家） |
| Break 后、Break 升级位图为空 | `Player.o().a() == 0` | **TIME 模式 + 1 秒** |
| 买过任意 Break 升级 | 位图非空 | X_HIGHEST + 10（原终局策略） |

**为什么 TIME 模式安全**：ID1 的反物质门槛读 `thisEternity.maxAM`（本永恒峰值，坍缩不清零），
实测已是 1.0e1365 > 1e1100；会被坍缩清零的只有 `thisInfinity.maxAM`，它不是 ID 的判据。

同步修 `if-gtz` → `if-gez`：`compareTo` 在 xHighest==10 时返回 0，原写法不退出 ⇒
每帧重写 `P(10)` 并打一行 `OREKI_AU4B`（R63 实测 7.5 分钟 14314 行）。改后 <10 才写、==10 跳过、>10 保留。
`build_mod.py` 的极性表条目与 `verify_au4b` 断言已同步更新（不是删除守卫）。

### 四、教程与代码对齐（新增长期规则的首次执行）

**发现一处错误宣传**：教程第 5 章原第 7 步写「12 个打破无限升级由程序每帧逐条买下」，
但 R63 真新档实测 `breakInfinityUpgradeBits` 从头到尾是 **0**，同一个真新档里程序一条都没买过。
这属于「宣传了未实现的功能」，已按新规则改正为如实说明（需玩家手动点，并标注为已知缺口）。

**本轮教程覆盖登记**（源：`web/AD-Oreki-Edition/src/core/oreki-tutorial-data.json`）：

| 改动 | 教程位置 | 覆盖内容 |
|---|---|---|
| 两段式自动坍缩策略 | 第 5 章「打破无限」新增 1 步（现 10 步） | 修改内容、玩家可见效果、无需操作、适用阶段（Break 后）、玩家自选模式不被覆盖 |
| `if-gtz`→`if-gez` 消除每帧重写 | 同上一步的附带说明（不单列） | 纯内部性能修复，玩家不可见 → 合并到技术说明，此处登记 |
| 教程第 7 步纠错 | 第 5 章第 7 步原地改写 | 删除失效说法，改为「需手动购买 12 条 Break 升级」 |
| `build_mod.py` 守卫同步 | 不涉及玩家 | 纯构建期断言 |

Android 教程由 `scripts/oreki_tutorial_gen.py` 从同一源生成，本轮回读校验 **1157 条记录逐字一致**（上轮 1156，+1 即新增那步）。

### 五、本轮未实现（明确）

- **Break Infinity 升级自动购买仍未实现**。已确证 `oy.smali` 只持有 12 个静态实例（`a`~`l`，类型 `Lhy;`），
  `hy.A(Z)Z` 是 canBeBought 判定（`!K() && Player.m()`），**没有找到 purchase 入口**。
  在没找到真实购买方法前不写调用（R62 教训：猜错一次等于整类被 ART 拒收）。
- 因此本轮「零手动通关」目标仍差这一段：玩家需要手动买 12 条 Break 升级。

---

## C.112　R65：Break 升级购买链打通 + 调度器记账根因（2026年11月2日，【读码】+【AVD 实测】）

### 一、Android Break Infinity 升级的**真实购买入口**（R64 未找到的那个）

R64 只确认了 `hy.A(Z)Z` 是「可购买判定」，并据此判断「购买入口还没找到」，于是整轮没写调用。
本轮从原版 Break 页按钮的点击监听器一路抠到底，链路是：

```
MainActivityBreakInfinityKt$loadViewsBreakInfinity$2$1.invokeSuspend
  → Lfp3;->D(ZLvh0;)Ljava/lang/Boolean;          ← 唯一购买入口（suspend，方法体内无挂起点）
      → a(Z)Z           可购买综合判定 = !B() && z() && A(Z)
      → y().i(x())      货币扣费（Lln0.i：先 f() 判够不够，再 l() 真扣）
      → E(true)         置已购位（av.E → J().g(I()) → Player.o() = breakInfinityUpgradeBits）
      → C(true, auto)   购买后回调（可重复升级在这里加次数）
```

继承链：`hy → av → fp3`（`hy.smali:105` 的构造调用直接打 `Lfp3;-><init>`），
12 个实例全在 `oy.m`（`List<fp3>`，构造时用 `new-array [Lfp3;` 建好）。

**结论：`fp3.D(false, null)` 与玩家在 Break 页点一下按钮是同一条代码路径。**
mod 侧不写位图、不扣 IP、不算价格 —— 这是「不伪造、不绕过原版」的硬前提。

关于 `Lvh0;`（Continuation）：`D` 被编译成 suspend 方法，但方法体逐指令核对**没有任何挂起点**
（无 `COROUTINE_SUSPENDED` 返回、无状态机分发），第二个参数从未被读取，传 null 安全。

### 二、调度器「没有真正接管」的**真实原因**（两处极性，R51 起就存在）

`WEB_ANDROID_DIFFERENCES.md` §15.3 一直记着「Android 调度器没有真正接管阶段自动化」。
本轮定位到：**不是没接线，是记账方法本身恒空转**。

`OrekiAutomationScheduler.noteActed` / `noteNoop` 的首个判定都写成：

```
idxOf(id) → v
if-gez v, :done        ← 错
```

按 FACTS C.51 基准（`if-ltz` = v<0 才跳、`if-gez` = v>=0 才跳），**任务 id 合法（v>=0）时反而直奔 :done**，
于是：

- `sLastAct[task]` 永不更新 ⇒ `allow()` 的间隔闸门**恒放行**；
- `sServed` / `sActionCount` 永不累加 ⇒ `OREKI_SCHED act` **一条都不出现**；
- `sNoopUntil` 永不写入 ⇒ R56 的「3 秒无效重试冷却」**从未生效**。

运行期证据（R65 首个能编译的包，13:42:57）：把存档的 `breakInfinityUpgradeBits` 从 511 改成 256
（8 条变回未购买）后重开，logcat 出现

```
13:42:57.783 OREKI_BRKUP: 0
13:42:57.790 OREKI_BRKUP: 1
...
13:42:57.865 OREKI_BRKUP: 7      ← 8 条全部买下，总耗时 82 ms
```

**82 毫秒买 8 条 = 1 秒间隔完全没生效**，且全程没有一条 `OREKI_SCHED act`。
改成 `if-ltz` 后同一测试的间隔才符合预期（见 §五）。

顺带清掉 `noteActed` 里两行早期调试残留 `invoke-static {v14, v14}, Log;->i`（v14 从未初始化）。

### 三、`OrekiEternity` 的另一处同源极性（首次永恒永远不触发）

`tryEternity()` 里：

```
v0 = compareTo(gainedEP, Player.EP.copy().multiply(10))
if-gez v0, :et_end      ← if-gez = v0>=0 才跳
```

即「收益已过 10 倍 → 跳过永恒；收益还不够 → 按永恒」，与注释、与 Web `tickEternity()` 完全相反。
实测佐证：续跑档 `eternities` 恒为 0，而反物质峰值已 **1e4653**、ID1~ID3 都买下了 —— 卡点不在资源。
本轮改为 `if-ltz`（v0<0 才跳过）。

### 四、Web 端重写（原实现「能买但推不动进度」）

`src/core/oreki-autobuy-break-infinity.js` 原实现是「遍历 → canBeBought → purchase，能买的全买」，两个问题：

1. 一拍买光所有 → `runCycle` 的「一拍最多一个真动作」失效，且无法表达先后顺序；
2. 没有预算概念 → 数组序靠后的 5e11 / 1e15 一旦买得起就买，而 ID1 门槛是 IP 4e8（Android）/1e8（Web）。

现在与 Android 逐条等价：**候选 = canBeBought 且 2×价格 ≤ 当前 IP，取最便宜的一条，一次调用只买一条**。
`2×价格 ≤ IP` 保证单笔购买不让余额腰斩，也就不可能把 IP 砸到 ID1 门槛以下。

Web 实测（`web/_tools/r65-break-shop.mjs`，真实页面 + 真实 `player`）：

| 段 | 操作 | 结果 |
|---|---|---|
| A | IP=1e7，清空已购，连续直接调用 5 次 | 每次返回 1；已购 0→1→2→3→4；IP 1e7→9.99e6→9.94e6→9.84e6→8.84e6→7.84e6（**逐笔按原价扣除**） |
| B | IP=1e9，恢复主循环跑 20 s | `infinitiedGeneration`（2e7）被调度器自动买下，Break 已购 5→6 条，IP 9.85e8→5.95e8 |
| C | IP=1e10 直接调用 | 返回 1，买下最便宜的 6.25e8 |
| C2 | **预算闸**：最便宜 6.25e8、IP 设 9.375e8（够买但不足两倍） | **返回 0，一条都不买** |

C2 是本轮「不得耗尽 ID1 关键 IP」这条要求的直接反证：规则确实在拦。

### 五、Android 运行期数据（同一台 oreki_test AVD）

| 指标 | R64 终档 | R65 实测 |
|---|---|---|
| `breakInfinityUpgradeBits` | **0** | **511**（9 条一次性升级全部买下） |
| `breakInfinityRebuyables` | — | `[8, 6, 10]`（3 条可重复升级也买了） |
| IP | 7.09e7 | **9.15e28** |
| `infinities` | 179 | 4.35e6 |
| `records.thisEternity.maxAM` | 1e1365 | **1.05e4653** |
| ID | 未解锁 | ID1 / ID2 / ID3 已解锁并购买（logcat `OREKI_ID: 1/2/3`） |
| 坍缩模式 | TIME / 1 s | TIME / 1 s（`auto.bigCrunch.mode=1, time=1`） |

存档直接读自 `/data/data/com.oreki.antimatterdimensions/files/player.json`（emulator root），
原件与改写件留存在 `android/AD_Oreki_Edition_Android/reports/r65/`。

### 六、本轮踩到并已修的三个 ART / 汇编坑

1. **`Invalid register: v16. Must be between v0 and v15`** —— `invoke-static {vA,vB}` / `move-exception` /
   `const-string` 用 4 位寄存器编码，只认 v0~v15。首版把 locals 开到 24 → 汇编期直接失败。
   现固定 `.locals 16`，每个寄存器一种类型且恰好用满。
2. **`Cannot get the location of a label that hasn't been placed yet`** —— `.catch ... :handler` 指向的标签
   写成 `:catch_0`（实际标签是 `:bs_catch`）。smali 不报「标签不存在」，而是在 dexlib2 写 code item 时才抛，
   栈里看不到文件名。已加构建期断言（`build_mod.py` 4b：所有 `.catch` 的三个标签必须已定义）。
3. **`[0x7A] register v12 has type Undefined but expected Integer`** —— v12（选中下标）只在循环体内赋值，
   循环一次没进 `:bs_take` 时在 `:bs_pick` 处是 Undefined。凡「只在循环体内赋值、循环外要读」的寄存器，
   必须在循环前先 `const/4` 定义。

### 七、本轮教程覆盖登记（源 JSON 单一源，Android 由 `oreki_tutorial_gen.py` 生成）

| 改动 | 教程位置 | 覆盖内容 |
|---|---|---|
| Break 升级自动购买（真实购买入口） | 第 5 章第 9 步（新增，章内由 10 步变 12 步） | 改了什么、玩家可见效果（格子自己变灰）、节奏（每 1 秒最多一条）、R64 前是缺口 |
| 「最便宜且不伤余额」的选择规则 | 第 5 章第 10 步（新增） | 候选条件、`2×价格 ≤ IP`、为什么不按页签顺序、不会砸到 ID1 门槛以下 |
| 开关与 1~60 秒间隔 | 第 5 章第 11 步（新增） | 怎么关、怎么调、跨重启保存、关闭后原版自动器照常工作 |
| ID1 门槛的平台差异 | 第 6 章第 1 步（改写） | Android 4e8 / Web 1e8，明确「保留原版差异，不机械统一」 |
| ID1~ID8 的解锁+购买路径 | 第 6 章第 2 步（改写） | 先走原版解锁入口再「买最大」，并列出 8 层反物质阈值 |
| 旧教程「需手动买 12 条」的失效宣传 | 第 5 章第 9 步（原第 8 步整段替换） | 该说法已与实测矛盾，按 R64 规则同轮纠正 |

### 八、未完成（如实记录）

- **全新存档 3 小时通关未验证**。本轮全部运行期数据都来自 R64 续跑档（`reports/r65/player_r65_live.json`），
  按 R65 执行令 §10.1，这只能用于定位瓶颈，**不能冒充新档成绩**。
- 调度器记账修好后，各策略任务才第一次真正受 1 秒节拍约束；「修复后的稳态节奏」只跑了十余分钟，
  不足以判断是否拖慢前期（原 R51 曾因限流过狠导致 146 s 仍在 preInfinity）。
- `tryBuyId1()` 每帧无条件打 `OREKI_ID`（logcat 实测 30 秒 2782 条），属于日志洪水，
  会挤掉其它 tag 的证据；本轮靠 `adb logcat -G 16M` 规避，**未改代码**。
- 特蕾莎浇注 `pouredAmount` 仍未增长；符文装备正例仍未取得（沿用 R62 状态）。

---

## C.113　R66：调度间隔根治 + 策略源接入 + Gradle 增量构建（2026年11月3日，【读码】+【静态检查】+【实测】）

### 一、间隔不生效的根治（第一优先级）

R65 已排除 idx / iv / noteActed / 极性四项，仍无法解释「8 条升级 80 ms 内连买」。
R66 换了个角度：**不在 noteActed 之外找原因，而是不再依赖 noteActed**。

机制层修复（`OrekiAutomationScheduler`）：

| 新增 | 作用 |
|---|---|
| `sReserve:[J` | 每任务一个「进行中动作」时间戳 |
| `reserveOk(I)Z` | allow() 通过间隔闸门后、**返回 true 之前**占位；已有未过期预约则返回 false |
| `clearReserve(String)` | noteActed / noteNoop / noteFail 统一释放 |
| `:deny_7 "reserved"` | 独立拒绝原因，不再与 `disabled` / `interval` 混淆 |
| 预约窗口 2000 ms | 调用方异常未提交时自动过期，**不会把任务永久卡死** |

关键点：预约写在 allow() 内部，因此「外层还没提交时间戳、内层又申请」这种调用（同帧多次
调用 / 同步重入 / 模块内部二次进入）一定会被第二道闸拦住，不再取决于 noteActed 是否被执行。

同时修 `:deny_iv` 的 reason：原先直接落到 `:deny_1` 被写成 `disabled`（误导）。

**确定性语义夹具**（新增 `scripts/fixture_scheduler_semantics.py`，不装机、不构建）：
静态接线 10 项 + 语义场景 14 项，全部通过。覆盖用户列出的全部边界：

| 场景 | 期望 | 结果 |
|---|---|---|
| 第一次合法动作 | 放行 | PASS |
| 1 ms 后重复申请（未提交） | 拒绝 | PASS |
| 满 999 ms | 拒绝 | PASS |
| 满 1000 ms | 放行 | PASS |
| 60 秒档 59.999 s / 60 s | 拒绝 / 放行 | PASS |
| no-op 后 1 ms | 被重试冷却挡 | PASS |
| no-op 不推进成功时间戳（60 秒档放大差异） | 仍按上次成功计时 | PASS |
| MOD 自动化关闭 | 立即拒绝 | PASS |
| 原版总开关关闭 | 拒绝（不绕过玩家意愿） | PASS |
| 严格档：另一任务 1 ms / 1000 ms | 拒绝 / 放行 | PASS |
| 默认档：另一任务 1 ms | 放行（单任务语义） | PASS |
| 异常未提交 1.9 s / 2.0 s | 挡住 / 自动恢复 | PASS |
| **80 ms 内申请 8 次** | **只放行 1 次** | **PASS** |

### 二、OREKI_ID 日志洪水

R65 实测 30 秒 2782 条（每帧每层一条），把 logcat 环形缓冲区冲掉，同时刻的
`OREKI_BRKUP` / `OREKI_SCHED` 证据被挤丢——R65 一度因此误判「没买到」。
改为「购买次数 `InfinityDimensionState.y()` 前后比较，变了才打」，语义不变、不再刷屏。

### 三、策略源接入（第二优先级）

- 新增 `scripts/gen_smart_strategy.py`：把 `oreki-smart-strategy.json` 在**构建前**编译成
  `oreki/OrekiStrategyData.smali`。19 阶段 / 20 合取项 / 73 子句 / 19 叶子 / 3 常量。
- 编译方式是 **DNF（析取范式）**：Android 侧只需两层循环 + 逐子句 double 比较，
  没有递归、没有栈。选它是因为 JSON 里 19 个条件几乎全是 `all[] + not(leaf)`，只有 3 处 `any`。
- 新增 `oreki/OrekiSmartStrategy.smali`：只读解释器 —— 2 秒节流求值，选出优先级最高且成立的阶段，
  打一行 `OREKI_GOAL stage=<i> <id> goal=<goal> unknownLeaf=<n>`。**不买、不点、不写存档。**
- 叶子接线：目前已确证 7 个（`player.break`→`Player.m()`、`player.dimensionBoosts`→`Player.u()D`、
  `player.infinities`→`Player.C()`、`player.realities`→`Player.P()`、`progress.infinityUnlocked`→
  `OrekiAuto.hasInfinity()`、`pelle.doomed`→`pelle/c.q()`）。其余 12 个**没有在 REA 里逐条核对到 getter**，
  统一返回 0 并累加 `sUnknown`，日志里显式暴露——绝不假装取到了值。
- 新增构建断言：`OrekiSmartStrategy` / `OrekiStrategyData` 必须在 payload 里；
  `gen_smart_strategy.py --check` 可判定生成物是否与 JSON 一致。

### 四、Gradle 增量构建（新增长期规则，用户 2026-11-02 确立）

**真实基线（实测，替换早期估计）：**

| 项 | 数值 |
|---|---|
| `work/base_decoded` | **27744 文件 / 0.40 GB**（不是 11 万 / 1.7 GB） |
| 整棵树 `(path,size,mtime)` 滚动哈希 | **4.2 s** |
| `scripts/payload`（35 文件）内容哈希 | 17 ms |
| `scripts/*.py`（69 文件）内容哈希 | 150 ms |
| 指纹总计 | **约 4.4 s**（对 8.5 分钟构建可忽略） |

**实现**：`scripts/build_fingerprint.py` + `build.gradle` 的 `fingerprintInputs` / `onlyIf`。
`assembleRelease` 可跳过；`installToRelease` / `publishRelease` 经 `taskGraph.whenReady`
置 `forceFullBuild` 强制全量。

**实测四态验证：**

| 场景 | digest | 结果 |
|---|---|---|
| 无基线 | — | STALE |
| 提交基线后连续两次 | `15ee47006f368417` | 两次 UP-TO-DATE |
| 给一个 payload smali 加 2 个空格 | `63121e9064e21f3a` | STALE |
| 还原那 2 个空格 | `15ee47006f368417` | UP-TO-DATE（恢复） |

**一个真实坑**：Git autocrlf 与编辑器保存会改换行风格，导致指纹「无意义变化」。
已在哈希前对文本类文件做 CRLF→LF 归一化（换行不影响 smali 汇编与 APK 字节）。

**未启用（【待验证】，不是已实现）**：`org.gradle.caching`（任务全是 Exec 调外部脚本，
无原生 inputs/outputs，强开会错误命中）、`configuration-cache`（用了 taskGraph.whenReady
与项目级可变状态）、`parallel`（任务链串行，收益为零）。

### 五、R66 构建过程记录（三次发布构建，两次因发布阻断）

| 次序 | 结果 | 原因 | 修复 |
|---|---|---|---|
| 1 | 失败（6m45s） | 生成器写 `aput v2, v1, 72` —— `aput/aget` 的三个操作数**都必须是寄存器**，下标也要先 `const/16` 装进寄存器 | 生成器改为 `const/16 v3, i` + `aput v2, v1, v3`；新增 `scripts/lint_smali_literals.py` 并接入 `build_mod.py` 4b 断言（检查**构建树** 11441 个 smali） |
| 2 | 成功（8m44s）但装机 VerifyError | `OrekiStrategyData.fill()`：`[0xBD9] unexpected value in v2 ... expected Double (Low Half)` —— 同一方法里 v2 既作 int 又作 `const-wide` 低位 | `.locals 4 → 6`，double 值改用专用 `v4:v5`；`aput-wide v4, v1, v3` |
| 3 | 见下 | | |

两次失败都在**运行期/汇编期**才暴露，共用掉约 15 分钟。已固化的两道闸门：
`lint_smali_literals.py`（字面量操作数 + `const/16` 范围）与既有的 catch 标签断言，
现在都在 `build_mod.py` 的 4b 阶段跑，不需要等 apktool。

**增量构建与发布构建的边界（本轮实测）**：三次真构建期间，
`assembleRelease` 单跑一次的 SKIPPED 验证耗时 **5 秒**（完整构建 7~9 分钟）；
输入改动（smali / 教程 / 构建脚本三类）均正确触发 STALE，还原后回到 UP-TO-DATE。

### 六、Gradle 增量验收（用户 A~E，本轮实测）

| 项 | 结果 | 证据 |
|---|---|---|
| **A** 输入未变时跳过 | **通过** | `> Task :assembleRelease SKIPPED`，`BUILD SUCCESSFUL in 5s`（完整构建 7m11s / 8m44s） |
| **B** 改真实 smali 触发重跑 | **通过** | 改 `OrekiStrategyData.smali` → digest `cb26bd87 → 87c4c4b4`（STALE）；还原 → 回 `cb26bd87`（UP-TO-DATE） |
| **C** 改教程/构建脚本失效 | **通过** | 改 `payload/assets/oreki_tutorial.txt` → `c44647a7`；改 `scripts/build_mod.py` → `6f83a9c9`；均还原回 `cb26bd87` |
| **D** 产物一致性 | **部分**：未启用 Build Cache，**无 `FROM-CACHE`**；以「指纹恢复后 digest 一致 + `release/` APK SHA-256 不变」作等价证明 | digest 往返一致；APK `7ee845e3…` 在跳过后未被触碰（mtime 与 SHA 均不变） |
| **E** APK 完整性/安装/运行 | 见下一节 | |

**一个必须记住的坑**：指纹曾把 `JAVA_HOME` 纳入环境变量，导致「Gradle 里跑（export 过）」
与「命令行手工跑（没 export）」得到不同指纹，同一工作区一会儿 UP-TO-DATE 一会儿 STALE，
判定不可复现。已把 `JAVA_HOME` 移出——它只决定用哪个 JDK，不影响产物字节。
现在只保留 `OREKI_RELEASE_OUT` 与 `OREKI_TUTORIAL_ALLOW_DRAFT`。

**已知局限（如实记录）**：`scripts/*.py` 参与指纹，因此在一次构建**进行中**修改构建脚本，
会让「产物来自旧脚本、指纹记录新脚本」。本轮就发生过一次（构建中给 `build_mod.py` 加 lint 断言）。
规避办法已写入 AGENTS §6.5.1：构建启动后不再改 `scripts/`。

### 七、间隔修复的运行期正例（R66 决定性证据）

受控夹具（`breakInfinityUpgradeBits` 511 → 256，8 条升级变回未购买），装机后 logcat：

```
16:26:31.494 OREKI_BRKUP: 0   act breakShop taskGap=-1
16:26:32.495 OREKI_BRKUP: 1   act breakShop taskGap=1003
16:26:33.496 OREKI_BRKUP: 2   act breakShop taskGap=999
16:26:34.513 OREKI_BRKUP: 3   act breakShop taskGap=1017
16:26:35.519 OREKI_BRKUP: 4   act breakShop taskGap=1006
16:26:36.527 OREKI_BRKUP: 5   act breakShop taskGap=1008
16:26:37.543 OREKI_BRKUP: 6   act breakShop taskGap=1016
16:26:38.562 OREKI_BRKUP: 7   act breakShop taskGap=1019
```

8 条耗时 **7.07 秒**（R65 同夹具为 **82 毫秒**），`taskGap` 全部落在 999~1019 ms。

**修复方式不是继续调 allow() 的分支极性，而是让模块自己守闸**：
`OrekiBreakShop.canBuyNow()` 用 `sLastBuyAt` + `Scheduler.intervalMs()` 做三次比较
（取 now → 算 diff → 与 interval 比），语义无歧义、与用户设置同源。
调度器那道闸门保留（双保险），但结论以模块内这条为准。

**为什么放弃继续调 allow()**：本轮对 `noteActed`/`noteNoop`/间隔闸门做了三处极性修复后，
实测 8 连买依旧，说明 `allow()` 这条十几分支的长方法里还有未定位的分支。
在没有单步调试手段的前提下继续猜极性的成本已经超过收益（每次验证要 9 分钟构建）。

### 八、策略层 stage 恒为 -1 的修正

首次装机 `OREKI_GOAL: stage=-1 goal=- unknownLeaf=0`。根因不是求值器，而是
`tick()` 里「找到阶段后把下标写入结果」的判定写反：
`if-lt v3, v4, :st_store` 在 v3 < 阶段数（**找到了**）时反而跳过 `move v2, v3`，
于是 `sStage` 永远是初值 -1。已改为 `if-ge`。

这条与 R65 的教训同类：**同一个方法里连续几处「比较 + 跳转」时，极性问题会互相掩盖**。
新增的 `fixture_scheduler_semantics.py` 能覆盖调度器的语义，但覆盖不到
「阶段选择」这类业务分支——下一轮应把 `OrekiSmartStrategy` 的选择逻辑也做成夹具。

### 九、策略层运行期**未通过**（如实记录，不得写成已完成）

最终包（`097d6c9d…`）装机后 `OREKI_GOAL` 仍为 `stage=-1 goal=- unknownLeaf=0`。

已排除/已修：
- 数据表生成正确（19 阶段 / 20 合取项 / 73 子句 / 19 叶子，`--check` 与 JSON 一致）；
- `fill()` 结构正确（12 个 `sput-object` 全部生成，`aput` 下标已改为寄存器）；
- 三处极性已修（选择循环 `if-nez`、`nameOf` 上界、`goalOf` 上界、`es_check` 的 `if-nez`）；
- 无 `OREKI_GOAL_EXC`、无 VerifyError、无 FATAL。

**仍未定位**：`evalStage` 在真机上对 19 个阶段全部返回 false，且 `unknownLeaf` 恒为 0 ——
说明它没有真的走到 `leaf()` 求值，而是在某个「数组为 null → :es_false」的分支提前返回，
但 `fill()` 又没有抛异常（否则会有 `OREKI_GOAL_EXC`）。

下一步（明确、无需整包构建）：把 `OrekiStrategyData` 的 12 个数组**逐一打印长度**，
用 `dbgState` 那种「只读诊断方法 + 每 6 秒一行」的方式定位到底是哪个数组没填上；
或者在桌面上把 `fill()` 生成的 smali 反汇编成等效逻辑跑一遍单测。

**影响评估**：`OrekiSmartStrategy` 是**只读感知层**，只输出日志与 `sStage` 字段，
不买、不点、不写存档。它不工作**不影响**游戏推进、不影响间隔闸门、不影响 Break 购买。
因此本轮判定：**功能未验收，但不阻断发布**。

---

## C.114　R67：策略解释器六处确定性错误 + 首次永恒闸门 + 策略驱动（2026年11月3日）

### 一、R66「恒定 stage=-1 / unknownLeaf=0」的**确定性**根因（不是推断）

R66 曾在 FACTS C.113 §九 记为「未定位」。本轮定位到**不是一处，而是六处**，
且它们是叠加的 —— 所以 R66 每修一处都还是 -1：

| # | 位置 | 错误写法 | 实际语义 | 后果 |
|---|---|---|---|---|
| 1 | `StrategyData.fill()` 守卫 | `sget-object sIds` + `if-eqz v0, :ret` | **sIds 为 null（首次）时直接返回** | 数据表永远不填充，后续所有 `if-eqz v0, :es_false` 全命中 |
| 2 | `leaf(I)` 边界 | `if-lt p0, v1, :l_zero` | **p0 < 长度就返回 0** | 合法下标全部取不到值，且不计 unknown |
| 3 | `evalStage()` 取反 | `if-ne v13, v3, :es_check` | neg≠0 时跳过取反 | 正负条件完全颠倒 |
| 4 | `nameOf()` | 多一行 `if-ltz p0, :n_out` | p0≥0 就返回 "-" | 阶段名永远是 `-` |
| 5 | 未接线叶子返回值 | `0.0` | 等于「该叶子为假」 | `not(unknown)` 会被翻成 true，阶段误判 |
| 6 | 算子表 | 只有 gte/lt/lte/truthy | 缺 eq/gt | JSON 若使用会编译期失败（现补全） |

第 1 条是**首因**：它让后面五条即使修好也看不到效果。这也解释了 R66 的三次「修好极性
但仍然 stage=-1」——数据表根本没建起来，`evalStage` 第一步就 `if-eqz v0, :es_false` 返回。
【读码 + 静态检查】

### 二、修复方式（生成器是唯一源头）

`scripts/gen_smart_strategy.py` 改动，重新生成 `OrekiStrategyData.smali`：

- 新增 `.field public static sFilled:Z`；守卫改为 `sget-boolean sFilled; if-nez v0, :ret`；
  **全部 15 个数组填完之后**才 `sput-boolean` 置位。中途异常不置位 ⇒ 下次整体重填（安全重试）。
  不用「某个数组非空」当判据：部分赋值会被误当成已完成，之后永不重试。
- `CMP` 扩为 `{gte:0, lt:1, lte:2, truthy:3, eq:4, gt:5}`；未知算子 `SystemExit`，不静默编译成 0。

`OrekiSmartStrategy.smali` 改动：

- `leaf()`：`if-eqz 数组 → NaN`、`if-ltz p0 → NaN`（负数）、`if-ge p0, len → NaN`（越界）；
  未接线叶子返回 **NaN** 并累加 `sUnknown`。
- `evalStage()`：取叶子后先做 `cmpl-double v3, v10, v10`（NaN 时 -1），NaN 即走 `:es_fail`
  —— 整条合取项判失败并置 `sDegraded=1`。这是 **fail-closed**：未知不会被 `not()` 翻成 true。
- 取反改 `if-eqz v13, :es_check`（neg==0 跳过）。
- 补 `:es_eq`（cmpl==0）与 `:es_gt`（cmpl>0）分支。
- 日志追加 `degraded=<0|1>`。

### 三、首次永恒：`holdCrunch()` 的极性

`tryEternity()` 原本：

```
holdCrunch() → if-eqz v0, :et_end
```

`if-eqz` = 为 **false** 才跳 ⇒ 窗口**需要保护时（true）继续往下按永恒**，
窗口关闭后（false）反而什么都不做。与整段注释、与用户给定的判定表完全相反。
改为 `if-nez`。判定顺序保持：`holdCrunch → canEternity(f) → gainedEP ≥ EP×10`。
【读码】【静态检查】

### 四、策略真正驱动模块（不再只打日志）

新增 `OrekiSmartStrategy.drives(String task)` + 私有 `stEq(String)`：

- 依据**只有一条**：当前阶段的 `strategy` 名（来自同一份 JSON，编译进 `sStrategies`）。
  Android 不再手写第二套阶段规则。
- 映射：`reality` ← {realityPush, realityTreePush, dilationPush, celestial, pelleEndgame}；
  `glyph` ← {realityPush, realityTreePush, celestial, pelleEndgame}；
  `teresa` ← {celestial, pelleEndgame, realityTreePush, realityPush}。
- **fail-open**：`sStage < 0`（未识别）时恒返回 true —— 策略层异常绝不阻断成长链。
- 接线 `OrekiStageAuto.onAutoBuyerTick` 三处（reality 段的 `allow()` 之前、glyph、teresa）。
  早期阶段（growth / fastUnlock / breakInfinityPush / infinityOptimize / challengeClear /
  eternityPush）不会触发这三个后期模块，把每帧唯一的名额留给当前阶段。

### 五、确定性语义夹具（本轮新增，直接跑数据表）

`scripts/fixture_strategy_semantics.py` —— **72 项**，全部通过：

| 组 | 内容 |
|---|---|
| 规模 | 19 阶段 / 19 叶子 / 3 常量 / 73 子句；id/title/goal/strategy 与 JSON 逐项一致 |
| fill 结构 | `sFilled` 字段存在、守卫是 `if-nez`（**显式断言 `if-eqz v0, :ret` 不得存在**）、置位在全部 sput 之后、sput 次数 = 15 |
| 下标 | `sLeaf` / `sConst` / `sClauseOff+Cnt` / `sTermOff+Cnt` 全部在范围内；`sOp` 全已知；`sNeg` ∈ {0,1} |
| 语义一致 | **400 组随机环境 × 19 阶段**，与 JSON 参考实现逐阶段相等（0 处不一致） |
| 算子边界 | gte/lt/lte/eq/gt/truthy 各 3 个边界（等于、±1e-12、0） |
| 取反 | neg=0 / neg=1 各正反例 |
| fail-closed | `not(未接线叶子)` 恒 false 且置 degraded；仅给 `player.break` 时不得凭空成立 |
| 全阶段正反例 | 从数据表反推每个阶段成立的环境（19/19），单合取项阶段翻转一条子句必不成立 |
| 策略驱动 | `drives` 三个任务分支的策略集合与期望完全相等；fail-open 存在；StageAuto 接线 3 处 |

`scripts/fixture_eternity_gate.py` —— **11 项**，全部通过：
从 smali **提取实际跳转助记符**（`hold=if-nez can=if-eqz ep=if-ltz`），再跑用户给定的 5 行判定表。

两者都已接入 `build_mod.py` 的 4b 阶段断言：构建时先跑夹具，失败即中止，
不必等 apktool 汇编完才发现。

### 六、为什么这两类错误能连犯三轮

`if-eqz / if-nez / if-lt / if-ge / if-gez / if-ltz` 六个助记符在同一方法里密集出现时，
**单靠肉眼核对极易把极性读反**，而错一处只会表现为「日志不对」，不会编译失败。
R65/R66 分别因此烧掉 6~7 次整包构建（每次 8~10 分钟）。

本轮的处置是把它变成**机器判定**：只要改了 `fill/leaf/evalStage/nameOf/goalOf/tryEternity`，
夹具立刻报错，不再依赖构建 + logcat 观察。

### 七、Gradle 增量构建（沿用 R66 规则，本轮实测）

| 项 | 值 |
|---|---|
| 本轮完整发布构建次数 | **1 次**（`installToRelease`，发布链路由 `taskGraph.whenReady` 强制全量） |
| 构建前静态检查 | 32 类 / 32 文件，invoke 类型 0 问题、寄存器 0 问题、字面量 0 问题、catch 标签 0 问题 |
| 指纹 | payload / 脚本 / 教程三类输入均变更 → `STALE`（符合预期，非误判） |

### 八、未完成（如实记录）

- **全新存档 3 小时通关未验证**。本轮运行期证据仍来自 `reports/r65/player_bits256.json`
  受控夹具与 R64 续跑档，按 R65 §10.1 不能冒充新档成绩。
- **首次永恒的运行期验证依赖本轮构建**：极性已由夹具证明正确（5 行判定表全过），
  但 `eternities` 是否真的从 0 增长、增长时刻是否在 ID1 门槛达成之后，需要装机后观察。
- **12 个未接线叶子仍未接**（`celestial.*Unlocked`、`challenge.*Running`、`timeStudy.studiesBought`、
  `game.endState`、`progress.dilationUnlocked`、`progress.eternityUnlocked`、`progress.realityUnlocked`、
  `reality.perksBought`、`reality.upgradesBought`、`automator.unlocked`）。
  影响：这些阶段永远 `degraded=1` 且不成立，因此**后期阶段识别会偏保守**（停留在较早阶段）。
  这是「宁可不动也不按错误阶段乱买」的代价，明确记录为已知限制。
- 挑战「启动即完成」本轮未做新的运行期取证（沿用 R62/R64 结论）。
- Reality / Glyph / Celestial / Laitela / Pelle 未推进（本轮聚焦策略层与永恒闸门）。

### 九、R67 的第二次实证：策略层修好后又暴露 4 处极性（运行期逐步排除）

第一版包（`10d08484…`）装机后 `stage=-1 / unknownLeaf=0 / degraded=1` —— 与 R66 症状不同
（unknownLeaf 从 0 变成 13 又回到 0），说明叶子求值确实被调用了。逐层排查：

| 观察 | 结论 |
|---|---|
| `unknownLeaf=13 degraded=1` | leaf 被调用，但**正常值被判成失败** |
| `cmpl` 后写 `if-gez v3, :es_fail` | `if-gez` = v3 >= 0 才跳 ⇒ **正常值（cmp=0）进失败分支、NaN 反而通过**。改 `if-ltz` |
| 改后 `stage=0 unknownLeaf=0 degraded=0` | 求值跑通，但阶段选错（doomed） |
| `name=- goal=-` | `nameOf/goalOf` 里 `if-ne p0, -1, :n_out` = **p0 != -1 就返回 "-"**。改 `if-eq` |
| `s0=1`（诊断） | evalStage(0) 真的返回 true —— 不是「sStage 未写入」 |
| 算子分派 `if-ne v12, v13, :es_gte` | **不等于 0 就跳到 gte 段** ⇒ truthy(3)/lt(1)/lte(2) 全落进 gte，等价于「所有算子按 >= 判」。truthy 占 81/92 条子句，`0 >= 0` 恒真 ⇒ 最高优先级的 `doomed`（单子句 truthy）恒成立 |

**这一组错误的共同特征**：全部是「条件跳转助记符的极性与意图相反」，
且都只在**运行期**可见（编译、汇编、DEX 校验全部通过）。
R66 的 `stage=-1` 是数据表没建起来；R67 的 `stage=0` 是数据表建起来了但算子判错 —— 两层叠加，
所以每修一层都会看到「新的、不同的错误阶段」，很容易误以为改坏了。

**已固化的静态断言**（`fixture_strategy_semantics.py`，现 77 项）：
`if-ltz v3, :es_fail`（NaN 分支）、`if-eq v12, v13, :es_gte`（算子分派）、
`if-eqz v13, :es_check`（取反）、`if-nez v12, :es_next_clause`（子句成立继续）、
`if-ge p0, v1, :l_nan`（叶子上界）、`if-ltz p0, :l_nan`（叶子下界）。
这六条覆盖了本轮全部踩过的极性错误，任何一条被改回错误写法，构建期即失败。

**教训（写入 AGENTS §6.5.2）**：`if-eq / if-ne / if-lt / if-ge / if-ltz / if-gez / if-lez / if-gtz / if-eqz / if-nez`
十个助记符在同一方法里密集出现时，**必须逐条对照意图核对，并固化成断言**；
靠「读一遍觉得对」的复核在本轮连续失效四次。

---

## C.115　R68：首次永恒的坍缩闸门死锁（2026年11月3日，【读码】+【实测】）

### 一、原版永恒判定的字段映射（REA 逐条核对）

| 方法 | 实现 | 语义 |
|---|---|---|
| `Player$ThisEternity.h()` | `iget maxAM` | 本永恒期**反物质峰值** |
| `Player$ThisEternity.i()` | `iget maxIP` | 本永恒期**无限点数峰值** |
| `prestige/c.f()Z` | `ThisEternity.i()` vs `c.h()` | **永恒资格** = maxIP ≥ requiredIPForEP(1) |
| `prestige/c.g()` | maxIP → log10 → Pow | 可得 EP |
| `prestige/c.b()V` | 首句 `if (f())` + 完整重置 | 原版「按永恒」按钮的**同步**入口 |
| `prestige/c.d(...)` | 7 参数 suspend 桥 | R65/R66 误用，异常被静默吞掉 |
| `InfinityDimensionState.p()Z` | `(eg3.r.k() \|\| maxAM ≥ 本层门槛) && v()` | **ID 层是否已解锁**，不是永恒资格 |
| `eg3.r.k()` | 单条 Perk 旁路 | 只是 p() 的一个子条件 |

**两个必须分清的概念**：`p()` 是完整 ID 解锁判定（解锁 ≠ 买满），`eg3.r.k()` 只是其中一个
Perk 旁路；`f()` 才管永恒资格，且它看的是 **maxIP**，不是 maxAM、更不是当前 IP。

### 二、死锁的运行期证据

同一时刻三次采样（间隔 25 s，读 `files/player.json`）：

| 采样 | 当前 AM | thisEternity.maxAM | thisEternity.maxIP | infinity 次数 |
|---|---|---|---|---|
| t1 | 3.594e300 | 1.378e300 | 1.604e30 | 7.565e6 |
| t2 | 1.646e300 | 1.779e300 | 1.918e30 | 7.722e6 |
| t3 | 2.912e300 | 1.964e300 | 2.233e30 | 7.880e6 |

`infinities` 每 25 秒涨约 1.6e5 ⇒ **坍缩仍每 1 秒触发**；`maxAM` 只能反映「1 秒产量」，
停在 1e300，永远到不了 1.797e308。

### 三、根因：`holdCrunch()` 的解除条件自锁

原条件：`break && eternities==0 && IP>=1e8 && !p()`（p = ID1 已解锁）。

- ID1 未解锁 → 暂停坍缩（对）
- ID1 一旦解锁 → 永久放开坍缩（错）→ 反物质每秒清零 → maxAM 卡住 → maxIP 卡住
- `f()` 恒 false → `tryEternity` 直接返回 → 永远不永恒

**不能改用 `f()` 作闸门**：`f()` 依赖 maxIP，而 maxIP 只在坍缩时刷新；
暂停坍缩 ⇒ maxIP 不刷新 ⇒ `f()` 恒 false ⇒ 二次死锁。

### 四、修复

闸门钉在**反物质峰值**上（`OrekiStageAuto.holdCrunch` 第四条件）：

```
maxAM <  1.7976931348623157e308 (0x7fefffffffffffff) → 继续暂停坍缩
maxAM >= 1.797e308                                  → 放开，这次坍缩把 maxIP 顶到门槛
                                                      → f() 为真 → tryEternity 走 c.b()
```

写入路径未变：仍然只调原版 `prestige/c.b()V`，EP 计算、重置、记录更新全部由原版完成；
mod 侧不写 eternities / EP / 解锁位。

### 五、旧结论作废

R67 曾把「永恒入口」从 `c.d(...)` 换成 `c.b()V`，当时判断「入口改对就会触发」。
本轮证明：入口是对的，但**闸门根本不让反物质达标**，所以入口永远走不到。
两者是串联关系，必须同时成立。

### 六、双端对照

| 项 | Android | Web |
|---|---|---|
| 突破 1.797e308 的手段 | 坍缩闸门：maxAM 未达标时暂停自动坍缩 | `BigCrunchAutobuyerState.isUnlocked` 的 AU4b：mode=X_HIGHEST、xHighest=10，单次 IP ≥ 10× 历史最高才坍缩 |
| 效果 | 两次坍缩之间反物质持续增长 | 同 |
| 结算路径 | `prestige/c.b()V` | 原版 `eternity()` |

Web 不需要新增代码：它的坍缩策略本来就允许反物质继续成长，这是「殊途同归」而不是不一致。

### 七、R68 第二轮：入口四选一的运行期排除（未达成验收，如实记录）

| 入口 | 是否完成永恒 | 证据 |
|---|---|---|
| `prestige/c.d(...)`（R65/R66） | 否 | 自造 Continuation 与 `Eternity$eternity$1` 状态机不匹配 |
| `prestige/c.b()V`（R67） | 否，**只弹窗** | 方法体：`if (f())` → 读 `Confirmations.h()` → 为真时 `new-instance Eternity$confirmEternity$1`；存档实测 `confirmations.eternity = true` |
| `prestige/c.e()V` | 否，同样构造 Modal | invoke 列表为 `n(I,Object[])String` 格式化 + `c(g;String;String;Integer;Runnable;vi1;I)V`（Modal 构造） |
| `prestige/c.c(ZZZ,Boolean,Continuation)` | 否，**无异常** | 这是 `Eternity$eternity$1` 的唯一引用者，即协程本体；传 `OrekiEcContinuation` 后 `instance-of` 为假、按首帧执行，但 `eternities` 仍为 0 且 logcat 无 `OREKI_ET_EXC` |

**额外排除**：把 `auto.eternity.isActive` 置真（原版永恒自动器）也不触发 —— 该自动器在首次永恒前未解锁，属正常。

**当前确定结论**：
1. 闸门死锁（`p()`）已修，`OREKI_HOLD: hold=1 → hold=0` 证明窗口能正确放开；
2. 反物质已能突破 1.797e308（实测 5e308 / 7e308）；
3. 仍未完成永恒，**剩余卡点在资格判定 `f()` 或协程首帧**，两者都缺少可直接读取的运行期数值。

**下一步（需一次诊断构建，不是盲改）**：在 `tryEternity` 里把三个闸门的实际结果打出来
（`hold` / `f()` / `EP 比较` 各一位），即可确定是哪一个为假。届时按结果只改一处。

### 八、R68 最终定位：`f()` 恒假的直接原因是「不坍缩 ⇒ maxIP 不刷新」

最后一次采样（同一时刻）：

| 字段 | 值 |
|---|---|
| `thisEternity.maxAM` | **1.07e5255** |
| `thisEternity.maxIP` | **1.5e309**（自探针注入后从未变化） |
| 当前 IP | 3.89e308 |
| `eternities` / `EP` | 0 / 0 |
| `OREKI_HOLD` | `hold=1 → hold=0`（闸门已正确放开） |

**判读**：`maxAM` 已达 1e5255（远超 1.797e308），闸门也已放开，但 `maxIP` 一动不动。
`maxIP` 只在**发生坍缩**时刷新；而 `maxAM` 能长到 1e5255 恰恰说明**坍缩从未发生**
（否则每秒一次会把 AM 清零到 1e300 量级）。即：**大坍缩自动器处于关闭状态**。

于是链条闭合：
`坍缩不触发 → maxIP 不刷新 → f() = maxIP ≥ requiredIPForEP(1) 恒假
→ tryEternity 在第二道闸门返回 → 永远不永恒`

**结论**：`holdCrunch` 只负责「允许」坍缩，不负责「触发」坍缩。在闸门放开之后，
必须确保**至少发生一次坍缩**（把 `maxIP` 顶到 1.797e308），永恒资格才会成立。

**下一轮唯一改动**（一处，不需再猜）：
在 `holdCrunch` 放开的那一帧，若 `eternities==0 && maxAM ≥ 1.797e308`，则
**主动触发一次大坍缩**（走原版 `bigCrunchResetRequest` / 自动器的 tick），
而不是被动等自动器。完成后再由 `tryEternity` 调 `prestige/c.c(...)` 完成永恒。

---

## C.116　R69：永久永恒的参数真值与「假运行期证据」纠正（2026年11月3日）

### 一、原版真值：`c.d(...)` 的实参元组（REA 逐行）

`autobuyer/EternityAutobuyerState.smali:1010-1037`（原版自动永恒）实际发出：

```
const/16 v6, 0xd                 # 默认参数掩码 0b1101
sget-object v0, prestige/c;->a   # INSTANCE
const/4 v1, 0x0
const/4 v2, 0x1                  # ← 第二位 = true
const/4 v3, 0x0
const/4 v4, 0x0                  # Boolean = null
move-object v5, p1 ; check-cast → ContinuationImpl
invoke-static/range {v0..v6}, prestige/c;->d(...)
```

掩码 0xD = bit0/bit2/bit3 置位 ⇒ 参数 1、3、4 走默认值，**只有第二位被真正传入**。
R68 的 `c.c(false,false,false,null)` 把这一位传成 false，且换了没有掩码的 `c.c`——
注释写 `(false,true,false,null)`、实参却是 `(false,false,false,null)`，属于**注释与代码不一致**的缺陷。
R69 已还原为 `c.d(...)` + `(0,1,0,null)` + `0xD` + 真实 Continuation 实例，
并把「实参元组」写进 `build_mod` 的 ET1 断言与 `fixture_eternity_gate`（23 项）。

### 二、永恒资格的真实门槛是 **1**，不是 1.797e308

```
c.f()  = ThisEternity.i() (maxIP) >= c.h()
c.h()  = r51.c() != null ? b.M(b.I()) : lu.C
r51.c()= Player.q().a().b()  // 永恒挑战 current
         current > 0 ? r51.a(current) : null
lu.C   = BigDouble(1.0, 0.0, false, 4, null) = 1
```

不在永恒挑战中（`challenge.eternity.current = 0`）时 `r51.c()` 为 null ⇒ **门槛 = 1**。
所以 `maxIP = 6.5e30` 时 `f()` **为真**。R68 记的「maxIP 1.5e309 但 f() 为假」是错误推断。

### 三、R68 的运行期证据**作废**（重要纠正）

R68 全部采样期间，游戏实际停在**标题/离线收益界面**（`开始游戏` 按钮未点），
自动化并未进入主循环；读到的「反物质从 1.79e308 涨到 1.39e1497、无限次数增加」
是**离线结算写回存档**的结果，不是自动坍缩在跑。截图与日志已存档
（`reports/r68/r69_screen.png`）。

因此 R68 的「坍缩仍在每秒触发 ⇒ 闸门没生效」推论**不成立**，需重测。

### 四、进入游戏后的真实状态（R69 实测）

点击 `开始游戏` 并关闭首次弹窗后：

| 采样 | eternities | EP | maxAM | maxIP |
|---|---|---|---|---|
| r1 | 0 | 0 | 5.25e4859 | 6.22e30 |
| r5 | 0 | 0 | 2.22e4862 | 6.54e30 |

`OREKI_HOLD: hold=1 → hold=0`（闸门正确放开）；`OREKI_GOAL stage=13`（策略层正常）；
无 `OREKI_ET_EXC`、无 VerifyError/FATAL。

三闸门逐个核对：`hold=false` ✓、`f() = maxIP≥1 = true` ✓、`gainedEP ≥ EP×10` ✓。
**三个闸门全过，`c.d(...)` 也按原版实参调用，但 `eternities` 仍为 0。**

### 五、剩余根因（本轮结论）

`c.c` 是 **suspend 函数**：内部对第 5 参做 `instance-of Eternity$eternity$1`，
命中才走恢复路径。我们传的 `OrekiEcContinuation` 不是该类 ⇒ 走「首次调用」分支 ⇒
一旦方法体遇到挂起点就返回 `COROUTINE_SUSPENDED`，而**没有任何东西会恢复它**。
这与「无异常、无结算」的现象完全吻合。

**下一轮唯一动作**（三选一，都需一次构建）：
1. 用真实构造器造 `Eternity$eternity$1`（先读 `<init>` 签名与所需 continuation），
   并在返回 `COROUTINE_SUSPENDED` 后主动 resume；
2. 或走原版按钮 `c.b()`，先把 `player.options.confirmations.eternity` 临时置 false
   （走 `e()` 分支，b() 内部会用真实 `CoroutineScope` 启动，能自行恢复），完成后再还原；
3. 或在 mod 侧建立一个真实 `CoroutineScope`，用 `launch { c.c(...) }` 的方式驱动。

**验收状态（如实）**：`eternities` 仍为 0、EP 仍为 0，**本轮首要目标未达成**。

---

## C.117　R70：首次永恒真正打通 —— 用原版协程启动器（2026年11月3日）

### 一、R65~R69 五种入口全部失败的**共同**原因

前几轮一直在换「调哪个方法」，但没换「怎么驱动它」。`prestige/c.c(...)` 是 **suspend 函数**，
方法体开头就是：

```
instance-of v0, p5, Lkajfosz/antimatterdimensions/prestige/Eternity$eternity$1;
if-eqz v0, :cond_0
    ... 复用已有状态机（恢复路径）
:cond_0
    new-instance v0, Eternity$eternity$1 ; <init>(this, p5)   # 新建状态机
```

我们传进去的是 `OrekiEcContinuation`（不是 `Eternity$eternity$1`）⇒ 走「新建」分支 ⇒
方法体一旦遇到挂起点就 `return COROUTINE_SUSPENDED`，而**调用方是普通同步代码，
没有任何 scope 会来恢复它** ⇒ 没有异常、没有结算，只有「调用成功」的假象。
这就是「入口换了四种、参数也对、日志全绿，`eternities` 永远 0」的物理原因。

### 二、原版真正可用的启动路径（读码定案）

`prestige/c.b()` 在「确认关闭」时的 `:cond_7` 分支：

```
new-instance v0, Lkajfosz/antimatterdimensions/prestige/Eternity$confirmEternity$4;
const/4 v2, 0x1 ; const/4 v1, 0x0
invoke-direct {v0, v2, v1}, Lkotlin/coroutines/jvm/internal/SuspendLambda;-><init>(ILvh0;)V
invoke-static {v0, v3}, Lkajfosz/antimatterdimensions/g;->p(Lvi1;Z)V
```

- `Eternity$confirmEternity$4.invokeSuspend` 只做一件事：`c.d(..., mask 0xF)`；
  它自己是**真正的 SuspendLambda**，由游戏 scope 驱动状态机 ⇒ 挂起点能被恢复。
- `g.p(lambda, Z)` = `MainActivity.launchOnGameScope`：取 `MainActivity.Co` 协程作用域
  并 `nq5.A(scope, ..., lambda, 3)`。第二参为 false 时**先查 `a.o(0)`**（暂停 / 反作弊冻结），
  命中就 `return-void`，不留日志 —— 模拟器上存档时间戳落后于系统时间时正是这个分支。

R70 采用：`new Eternity$confirmEternity$4(1, null)` + `g.p(lambda, true)`（无条件启动）。
**不伪造任何协程对象**，不写 `eternities` / EP / 解锁位。

### 三、一次被夹具当场推翻的误判（必须记录）

本轮中途我曾把 EP 收益闸门 `if-ltz v0, :et_end` 判为「极性写反」，理由是
「compareTo >= 0 表示收益够，却返回」。**这是错的**：

| 助记符 | 真实语义 |
|---|---|
| `if-eqz` | v == 0 时跳 |
| `if-nez` | v != 0 时跳 |
| `if-ltz` | **v < 0 时跳** |
| `if-gez` | v >= 0 时跳 |
| `if-gtz` | v > 0 时跳 |
| `if-lez` | v <= 0 时跳 |

`if-ltz` 是「小于零才跳」⇒ 原写法 `compareTo < 0（收益不足）才返回` **本来就是对的**。
`fixture_eternity_gate.py` 的判定表当场给出 3 条 FAIL，把它按了回去。
这条已写进断言：**必须是 if-ltz，改成 if-gez 会在 EP=0 时永久拦住首次永恒**。

同一轮里另外两处才是真的写错（新增代码自己写反）：
`sEtPending` 分派应为 `if-eqz`、TTL 递减应为 `if-lez`，均已修正并有断言锁定。

### 四、Android 新增：现实升级 10 保护（与 Web 等价）

`OrekiEternity.holdForRu10()`：
- 条件：`eternities == 0` && `log10(IP) < 400` && 未放弃过；
- 计时：`SystemClock.elapsedRealtime()`（不受改系统时间影响），**最多 10 秒**；
- 超时置 `sRu10GaveUp` 一次性闩锁 ⇒ 本局不再压，物理上不可能长期压死自动永恒；
- 位置：在 `f()` 之后、10 倍收益之前，与 Web `tickEternity` 的顺序一致。

### 五、防重入

`sEtPending / sEtTtl / sEtBefore`：发起后置 pending，每帧比对 `log10(eternities)` 是否变化；
变化即释放；未变化则递减 TTL（600 帧）兜底。**不会重复发起，也不会永久卡死**。

### 六、双端对照

| 项 | Android | Web |
|---|---|---|
| 启动方式 | `new Eternity$confirmEternity$4(1,null)` + `g.p(...,true)` | 原版 `eternity(false, true)` |
| 资格 | `prestige/c.f()` | `Player.canEternity` |
| RU10 保护 | `holdForRu10()`：10 秒 + 一次性闩锁 | `holdForRealityUpgrade10()`：10 秒 + `_ru10GaveUp` |
| 收益闸门 | `gainedEP >= EP×10`（`if-ltz`） | `gainedEternityPoints().lt(EP×10)` → 返回 |
| 回归测试 | `fixture_eternity_gate.py`（33 项） | `scripts/check_eternity_gate.mjs`（25 项） |

### 七、R69 结论的更正

R69 写「参数元组 `(false,true,false,null)` + mask 0xD 是原版自动器的真值」——**这条本身没错**
（`EternityAutobuyerState:1010-1037` 逐行可查），但它**不是**首次永恒的可用入口：
自动器自己是 suspend 调用链的一环，由外层协程驱动；我们不在那条链上。
R70 因此改为「进同一条链」而不是「复刻它的参数」。

### 八、R70 第一次装机实测：`IllegalAccessError`（包内可见的 lambda）

第一版 APK（`db7d6a5e…`）装机后，`OREKI_ET_EXC` 每帧抛出：

```
Illegal class access: 'kajfosz.antimatterdimensions.oreki.OrekiEternity'
  attempting to access 'kajfosz.antimatterdimensions.prestige.Eternity$confirmEternity$4'
```

读码确认：`Eternity$confirmEternity$4` 的声明是

```
.class final Lkajfosz/antimatterdimensions/prestige/Eternity$confirmEternity$4;
```

**没有任何访问标志 ⇒ 包内可见**。`OrekiEternity` 在 `...oreki` 包里，跨包 new 它必然被 DEX 拒绝。

**修法**：新增 `scripts/payload/smali/kajfosz/antimatterdimensions/prestige/OrekiEternityLaunch.smali`
（`public final`，与 lambda 同包），只放三行：

```
new-instance Eternity$confirmEternity$4 ; (1, null)
invoke-static g;->p(Lvi1;Z)V            ; true
```

`OrekiEternity.tryEternity()` 改为 `invoke-static OrekiEternityLaunch;->run()V`。

**这条也说明「日志有异常」不等于「有日志」**：R65~R69 的 `OREKI_ET_EXC` 一直是空的，
因为那时**根本没走到启动代码**（被 suspend 与旧入口挡住）；本轮第一次真正走到，
才把这个访问权限问题暴露出来。

**守卫已加**：`fixture_eternity_gate` 现在断言「转发类必须 public」「必须在 oreki 包里
只能出现 `OrekiEternityLaunch;->run()`、不得出现 `Eternity$confirmEternity$4`」
「转发类不得读写 `Player.x()/y()`」。

### 九、R70 运行期验收：首次永恒**真实达成**（2026-11-03 15:04）

最终 APK：`c5a17de30fbf0b51aa2d23ac342b4be516c2b55d101e829875cb5f25e80e9e5b`（69,806,693 B）。

测试方式：AVD `oreki_test`（1440×3200）+ 受控存档 `reports/r70/et_fixture.json`
（只把当前/本永恒期反物质设为 1.5e309、无限点数设为 2.5e401，**`eternities` 与 EP 都保持 0**），
装机 → 推存档 → 点「开始游戏」→ 进入主循环后观察。

| 观察点 | 结果 |
|---|---|
| `OREKI_ET: launch via OrekiEternityLaunch` | 出现（说明真正走到启动代码） |
| `eternities` | **0 → 1** |
| `eternityPoints` | **0 → 3** |
| 反物质 / 无限点数 | 被原版重置（IP=0，AM 回落到 1e183 重新增长） |
| `thisEternity.maxAM / maxIP` | 已重置（2.499e221 / 0） |
| `options.confirmations.eternity` | **仍为 true**（玩家原始设置未被改动） |
| `OREKI_ET_EXC` / VerifyError / FATAL | 0 条 |
| 界面证据 | 打破无限页显示「你拥有 **1** 永恒次数」；时间维度页已解锁并显示「你拥有 **3** 永恒点数」 |
| 重置后自动化 | 继续运行：IP 回到 9.04e6、无限升级已回购、AM 持续增长 |

证据文件：`reports/r70/v6.png`（1 永恒次数）、`reports/r70/v2.png`（3 永恒点数 + 时间维度页）、
`reports/r70/live2.json`（存档快照）。

**一次性通过的关键**：把「构造 lambda + 交给游戏作用域」放进同包的
`prestige/OrekiEternityLaunch`。第一版 APK 直接在 `oreki` 包里 new 那个包内可见的 lambda，
每帧 `IllegalAccessError`；改成转发类后一次成功。

### 十、R70 未完成

- 全新存档（非受控存档）的首次永恒墙钟未计时；本轮只验证了「机制通了」。
- Web 六视口（320/360/390/430/768/1280）移动端布局未在本轮实测。
- Android 仍缺 `ecEntryPending`（EC 入口等待）等价保护，EC 阶段前可能过早永恒。

---

## C.118　R71：EC 入口保护 + 大坍缩「第三种模式点不动」的根因（2026年11月3日）

### 一、大坍缩三种模式：根因是**每帧执行的副作用**，不是按钮没接事件

`src/core/autobuyers/big-crunch-autobuyer.js` 的 `isUnlocked` 是一个 **每帧都会被读** 的 getter
（`AutobuyerBox.update()`、自动器 tick、`hasMaxedInterval` 判定都会调）。R26-AU4b 为了防「AMOUNT + amount=1
把反物质永久卡在 1.8e308」，在里面写了：

```js
if (unlocked && this.data.mode === AUTO_CRUNCH_MODE.AMOUNT && Decimal.lt(this.data.amount, 10)) {
  this.data.mode = AUTO_CRUNCH_MODE.X_HIGHEST;
  this.data.xHighest = new Decimal(10);
}
```

后果：玩家只要选中 AMOUNT 且 `amount < 10`，**下一次 UI 读取就把它改回 X_HIGHEST**。
玩家视角就是「点下去立刻弹回另一个选项 = 这个模式点不动」。这不是点击事件问题，
也不是索引/映射问题，而是**读 getter 时顺手改了存档状态**。

修法：把归一化改成**一次性迁移**：

- 加实例标志 `_au4bNormalized`（不写存档，不改存档结构）；
- **再加 `this.data.lastTick === 0`** —— 只有「从未 tick 过」才迁移。这一条保证
  **重启读档后也不会重跑**：跑过一次 `lastTick` 就永久 > 0，之后玩家的任何选择都不再被覆盖。

为什么必须两个条件：只有实例标志 → 重启后新实例会再迁一次，玩家的 AMOUNT 又被改掉；
只有 `lastTick === 0` → 同一会话内如果自动器一直没跑起来，每帧都会重复尝试（虽然幂等，但语义更脏）。

回归测试 `scripts/check_crunch_modes.mjs`（**14 项**）**直接执行真实 getter 源码**
（从文件切出方法体，用 `Function.call(instance)` 运行，不是重写一份逻辑），覆盖：
首次接管仍归一化一次、归一化后玩家改回不再被弹、`lastTick>0` 时三种模式都能留住、
重启读档后三种模式都保住、连续切换 5 次不残留、归一化不碰 time/interval/isActive/increaseWithMult。

### 二、Android 侧同一缺陷**不存在**（如实记录）

Android 走的是原版 Kotlin 的 `CrunchAutobuyerState`，没有我们这段 AU4b 归一化；
本作的 Android 补丁只做「首次无限后一次性把 isActive 置 true」（AU4c），不碰 mode。
因此「选了被弹回」的可复现路径只存在于网页版。Android 端本轮**没有盲改 UI**：
Compose 的选项渲染没有证据支持有缺陷，盲改风险高于收益。

### 三、EC 入口保护（Android 新增，与 Web `ecEntryPending` 等价）

Web 的 `tickEternity()` 早已有 `ecEntryPending()`；Android 没有对应闸门，
于是「EC 已解锁、正攒 EP/TT 准备进去」时，自动永恒会把刚攒好的资源清空 ⇒ 永远差一点。

新增 `OrekiEternity.ecHoldForStart()`（只读判定）：

```
current == 0            # 当前不在任何挑战
unlocked > 0            # 至少解锁过一关 EC
r51.a(unlocked) != null # 取得到挑战对象
!y()                    # 该 EC 还没满级（y() = 完成次数 == 动态上限）
```

四条同时成立 ⇒ 本帧不按永恒。**防死锁**：`sEcHoldTtl` 每次命中加一，超过 **300 帧（约 5 秒）**
无条件放行；条件不成立立刻清零，不会累积成永久锁。

### 四、R71 运行期观察（R70 存档续跑，eternities=1 / EP=1）

| 观测 | 值 |
|---|---|
| `timestudy.amBought / ipBought / epBought` | 0 / 1 / 1（TT 通过 IP 与 EP 两条原版渠道买到了） |
| `timestudy.maxTheorem` | 2 |
| EP | 3 → 1（花在 TT 上，属正常） |
| `infinities` | 0 → 1.71e6 → 持续增长（大坍缩自动器在跑） |
| `auto.bigCrunch` | `isActive=true, mode=1(TIME), lastTick>0` |
| `challenge.eternity` | `completions` 全 0、`current=0`（尚未解锁 EC） |

即：**永恒后的 TT/TD/学说购买链是通的**，卡点在「EP 太少、EC 还没解锁」，
需要更多轮永恒把 EP 顶上去 —— 这是原版节奏，不是断点。

### 五、未完成

- EC 解锁与首次 EC 完成**未在本轮跑出来**（EP 只有 1，离 EC1 的解锁成本还很远）。
- 时间维度购买**未确认**（存档无 `timeDimensions` 键，需按 `dimensions.time` 口径重查）。
- Web 六视口未实测；本轮无桌面 Chrome。
- Android 大坍缩第三模式**未在界面上实测**（模拟器连续弹「反作弊 / 语言 / 成就辅助」对话框，
  自动化点击被挡住）。已改用「同源代码 + 真实 getter 执行」的回归测试代替，并明确标注不是界面实测。

---

## C.119　R73：Android 大坍缩「第三模式点不动」的真实根因是**UI 不重绘**（2026年11月4日）

### 一、推翻了 R72 的「循环列表缺 TIME」假设

R72 曾推测「模式循环列表里少了 TIME」。**这是错的。** 本轮逐条核对：

`CrunchAutobuyerState.Q()V`（唯一的模式切换函数）：

```
iget v0, ...->mode:I
add-int/lit8 v0, v0, 0x1
rem-int/lit8 v0, v0, 0x3      # ← (mode + 1) % 3，三态循环完全正确
iput v0, ...->mode:I
```

枚举值（与 Web `AUTO_CRUNCH_MODE` 一致）：`AMOUNT=0`、`TIME=1`、`X_HIGHEST=2`。
`a(I)V` 是纯 setter（一行 `iput`），`I()I` 是纯 getter。**没有归一化、没有缺项、没有越界。**

`Q()` 的调用者只有一个：`MainActivityOptionsKt$toggleCrunchMode$1`，
也就是自动购买器卡片上那个模式按钮的点击回调。

### 二、真正的根因：标题只在构造时设置，`b()` 从不重设

- 模式按钮 `wn.e` 的标题文案，在 `AutobuyerSingleBoxView` **构造函数**里设置一次
  （全文只有一处 `iget-object v2, v2, Lvn;->e:Lwn;`，在第 864 行）。
- 刷新入口 `b(Lxn;Z)V` 只更新：数值、间隔、以及 `w` 按钮的「购买单个/最大」文案，
  **从不碰模式按钮的标题**。

于是行为是：**点击 → mode 真的变了 → 阈值文案跟着变（可观测）→ 但标题不动**。
玩家看到「点了一下没反应」，切到别的页再回来才刷新 —— 这就是被报告为「点不动」的机制。

### 三、AVD 实测证据（eternities=100 存档，选择器已解锁）

连续点击模式按钮并读取界面：

| 点击 | 模式标题 | 阈值 | 判读 |
|---|---|---|---|
| 起始 | 每 X 秒自动大坍缩 | 1.00 | mode=1 |
| 1 | 最高无限点数的 X 倍 | 10.00 | mode→2，标题跟着变了 |
| 2 | 大坍缩后获得 X 无限点数 | **7.260e5** | mode→0，但阈值还是上一个模式的量级 |
| 3 | 大坍缩后获得 X 无限点数 | 10.00 | 标题**卡住不动** |
| 4 | 大坍缩后获得 X 无限点数 | 10.00 | 仍然不动 |
| 切页返回 | 最高无限点数的 X 倍 | 10.00 | **切页才刷新** |

「标题不动但阈值在变」正是「UI 未重绘」的判别特征 —— 若 mode 真的没变，阈值不会变。

存档侧确认 mode 值正常写入：`auto.bigCrunch.mode` 在 0/1/2 之间真实变化。

### 四、修复

在 `AutobuyerSingleBoxView.b()` 收尾处按当前 mode 重设模式按钮文本
（`patch_crunch_mode_label_refresh()`，注入点在 `iput-boolean p2, ...->c:Z` 之前）：

```
vn.e != null && w != null
  → mode == 0 → R.string.auto_crunch_mode_amount     (0x7f11030e)
  → mode == 1 → R.string.auto_crunch_mode_time       (0x7f11030f)
  → mode == 2 → R.string.auto_crunch_mode_x_highest  (0x7f110310)
  → setText(...)
```

- 只对「带模式选择器」的卡片生效，其它自动器零影响；
- 全段只读 mode + 一次 setText，**不写任何存档字段**，不替玩家切换模式；
- 里程碑解锁规则原样保留（选择器不出现时不进入该分支）。

### 五、守卫

`scripts/fixture_crunch_mode_label.py`（20 项）：补丁函数存在且已接入主流程、
注入块关键片段齐全（防拼接截断）、**注入块不得出现 `a(I)V`/`Q()V`**（红线）、
锚点在源文件中唯一、原版 `Q()` 仍为 `% 3`、三个文案资源 id 与 `public.xml` 一致。
已接入 `build_mod.py` 的 4b 断言，失败即中止，不必等 apktool。

### 六、教训

R72 把「模式值不变」和「模式标题不变」混为一谈，据此推断「列表缺项」，方向错了。
**判别方法应是看阈值/触发条件是否跟着变** —— 那才是执行层的真实口径；
标题只是显示。本轮靠这一点把范围从「枚举/循环」收敛到「UI 重绘」。

### 七、R73 的实测结果（重要：**部分修复，TIME 仍未闭环**）

修复后的包（`45e80333…`）在 AVD 上实测（eternities=100 存档，选择器已解锁）：

**已修复**：模式标题**点击后立即刷新**，不再需要切页。连点记录：

| 点击 | 标题（点击后立即读） | 判读 |
|---|---|---|
| 1 | 最高无限点数的 X 倍 | 标题即时更新 ✅ |
| 2 | 大坍缩后获得 X 无限点数 | 即时更新 ✅ |
| 3 | 最高无限点数的 X 倍 | 即时更新 ✅ |
| 4 | 大坍缩后获得 X 无限点数 | 即时更新 ✅ |
| 5/6 | 大坍缩后获得 X 无限点数 | 仍有偶发不更新 |

重启游戏后读到的仍是「最高无限点数的 X 倍」+ 10.00 → **持久化通过**。

**仍未修复**：循环只在 `AMOUNT(0)` ↔ `X_HIGHEST(2)` 之间跳，**TIME(1) 不出现**。
6 次点击后存档 `auto.bigCrunch.mode = 2`；若真走 `Q()` 的 `(mode+1)%3`，
从起始 1 经 6 次应回到 1。**证明卡片按钮不走 `Q()`。**

已排除：`Q()` 函数体确实正确（`rem-int/lit8 v0, v0, 0x3`）、`a(I)V` 是纯 setter、
`I()I` 是纯 getter、枚举值与 Web 一致（0/1/2）、无归一化、无越界。
`sn.smali` 的 18 个 pswitch 分支里没有一条触达 `CrunchAutobuyerState`，
说明卡片模式按钮用的是**另一个监听器**，本轮未定位到。

**下一轮唯一入口**：从 AVD 抓一次真实点击的调用栈（`logcat` + `debug.*` 或
在 `CrunchAutobuyerState.a(I)V` 里临时插一行日志打印调用方），
一次确认「谁在把 mode 设成 0/2」，然后只改那一处。不要继续静态搜。

---

## C.120　R74：大坍缩「第三模式点不动」的真根因 —— **MOD 自己每帧覆盖玩家选择**（2026年11月4日）

### 一、根因（运行时调用栈，非推断）

用 frame-observer 新增的 Logcat 模块 + 临时插桩（`CrunchAutobuyerState.a(I)V` 里打
`new Throwable().getStackTrace()`）抓到：

```
11-04 06:01:07.851 I OREKI_R74_DIAG: mode 0 -> 2
  CrunchAutobuyerState.a(Unknown Source:2)
  <- OrekiStageAuto.applyCrunchPolicy(Unknown Source:73)
  <- OrekiStageAuto.onAutoBuyerTick(Unknown Source:6)
  <- kajfosz.antimatterdimensions.a.b(Unknown Source:0)
  <- kajfosz.antimatterdimensions.a.f(...:116)
  <- MainActivityGameLoopKt$gameLoop$1.invokeSuspend(...:11)
  <- rx0.run(...) <- ThreadPoolExecutor
```

**每一帧 gameLoop 都在把 mode 改成 2。** 玩家在卡片上选 AMOUNT(0) 后下一帧即被覆盖；
TIME(1) 因为旧代码里 `if-eq v1, 1 → ret_p` 的特判被放过 —— 于是三选一实际只有两态可用。

### 二、推翻了 R72/R73 的两个假设

| 轮次 | 假设 | 结论 |
|---|---|---|
| R72 | 模式循环列表缺 TIME | **错**：`Q()` 是 `(mode+1)%3`，完整 |
| R73 | UI 标题不重绘导致「看着点不动」 | **只是表层**：标题不刷新确实存在（已修），但 mode 被改回去才是主因 |

R73 的观察「6 次点击后 mode=2」当时被解释为「不走 Q()」，实际是
**每次点完都被 `applyCrunchPolicy` 立刻改回 2**，所以从存档只能看到 2。

### 三、修法

`OrekiStageAuto.applyCrunchPolicy()` 里两处写 mode 的代码都改成**一次性初始化**：

| 位置 | 原行为 | 现行为 |
|---|---|---|
| 早盘（break 升级位图为空）→ TIME/1s | 每帧 `a(1)` + `O(1.0)` | `sCrunchTimeInit` 只写一次 mode；`O(1.0)` 仍每帧校准（那只是间隔参数） |
| 常规 → X_HIGHEST | 每帧「不是 2 就改成 2」 | `sCrunchPolicyInit` 只做一次 xHighest 默认校准；**不再改 mode** |

闩锁是进程级静态位，不写存档、不改存档结构。重启后若 mode 已是目标值，等值判断会跳过，
不会覆盖玩家选择。

### 四、守卫

- `scripts/fixture_crunch_policy.py`（11 项）：`a(I)V` 次数 ≤2、每次都在 `sCrunch*Init`
  置位之后、无旧的两态兜底、不碰私有字段、保留 `if-eq v1, v2, :ret_p`、有 `.catch` 兜底。
- `build_mod.py` 的 `verify_au4b` 同步改为**精确版**：不再要求「必须有 a(I)V」，
  而是要求「每次 a(I)V 都紧跟一次性闩锁」。
- 已接入 4b 断言链。

### 五、过程教训（两次构建都是自己造成的）

1. **第一次诊断构建只花 16 秒**：Gradle 的 `fingerprintInputs` 只统计
   `payload_smali / base_decoded / build_scripts ...`，**`work/mod` 是产物目录、不在指纹里**。
   直接改 `work/mod` 后 Gradle 判定 `UP-TO-DATE` 整段跳过 ——
   「构建成功但改动没进包」。必须改 `build_mod.py`（会改变 `build_scripts` 指纹）。
2. **第一次正式构建 9m08s 失败**：我自己写的断言「本方法不得出现 a(I)V」与实现矛盾
   （初始化分支必须写一次）。本地夹具因为判据更宽松没报错，两边口径不一致。
   **教训：改完 build_mod 的断言，必须用同一份源码在本地预演一遍，再启动构建。**

---

## C.121　R75：R74 收口 + Kotlin 首个迁移单元（2026年11月4日）

### 一、R74 三态验收（逐一，不只 TIME）

在 AVD `oreki_test` 上逐模式验证（存档 `eternities=100`，选择器已解锁）：

| 模式 | 枚举 | 保持 8~12 秒 | 切页返回 | 自动存盘 | 重启后 |
|---|---|---|---|---|---|
| AMOUNT（大坍缩后获得 X 无限点数） | 0 | ✅ 11s 不变 | ✅ | `mode=0` | ✅ 仍 AMOUNT |
| TIME（每 X 秒自动大坍缩） | 1 | ✅ | ✅ | `mode=1` | ✅ 仍 TIME |
| X_HIGHEST（最高无限点数的 X 倍） | 2 | ✅ 8s 不变 | ✅ | `mode=2` | ✅ |

**关闭自动化**：点总开关后 `options.autobuyersOn` 从 `true` → `false`，`bigCrunch.mode` 保持 0 不再被改写。

> 注意：自动购买器页的「自动购买器 / 已启用」是**总开关**（左侧，x≈245），
> 中间那块「状态切换」（x≈720）是单个自动器的开关，点它不会关总开关 —— R75 一开始点错，已纠正。

### 二、ID1 目标：当前代码已覆盖，无需新增

现有 `OrekiStageAuto.tryBuyId1()` 已实现完整链路：

```
Player.m()（是否 Break） → 遍历 1..8
  → InfinityDimensionState.k()（原版价格）
  → thisEternity.maxAM >= k() ?   （反物质门槛）
  → G() / M()（解锁判定）→ i()（买最大）→ h(true)（原版购买入口）
  → 以「购买前后 y()（已购数）是否变化」判定成功，变了才打 OREKI_ID
```

**AVD 实测（R75）**：日志里 `OREKI_ID` 共 624 条，按维度分布：

| ID | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| 购买次数 | 222 | 130 | 105 | 78 | 33 | 18 | 11 | 7 |

即 **ID1~ID8 全部在真实购买**，ID1 早已突破。当前存档：`AM=1.71e13574`、
`IP=7.65e150`、`infinities=6.0e7`、`thisEternity.maxAM=1.78e31327`。
**结论：R75 设想的「让智能购买器识别 ID1 目标」在现有实现里已经完成且正在运行，本轮无需新增代码。**

### 三、frame-observer 收口

| 项 | 结果 |
|---|---|
| 清空后缓冲归零 | ✅ 复测通过（**先暂停再清空**，否则新日志会立刻打破 0） |
| 断连检测 | ✅ 杀掉 logcat 子进程后 `alive=false` |
| 断连后恢复 | ❌→✅ 修复后通过：`start()` 原来只判 `running`，子进程死了也不重启；改为 `running && isAlive()` |
| 截图 503 | 环境限制（重装后投影授权失效），非缺陷，未反复修 |

### 四、Kotlin 首个迁移单元：`OrekiTrace`

原 Smali：6 个纯静态日志方法，零依赖、无生命周期。迁移到
`scripts/payload/kotlin/kajfosz/antimatterdimensions/OrekiTrace.kt`（`object` + `@JvmStatic`）。

**ABI 核对（javap 实测）**：与 Smali 版逐一对齐，6 个 `public static final void xxx()`，
类名、方法名、参数、返回值完全一致，调用点无需改动。

**工具链**：`tools/kotlinc/`（Kotlin 2.1.0，随仓库携带）+ `tools/bt/android-14/d8.bat` + `android-34/android.jar`。
新增 `scripts/build_kotlin.py`：编译 → ABI 断言 → D8，产物 `build/kt/classes.dex`。

**接入方式**：`build_mod.py` 在 apktool 打包后把该 dex 作为 `classes2.dex` 注入 APK，
并删除同名 `OrekiTrace.smali`（避免 duplicate class）。
选这条路的理由：apktool 3.x 不能反编译裸 dex，仓库也没有独立 baksmali；
Android 原生支持多 dex，改动面最小。

### 五、JAVA_HOME 环境变量：**无权限，已如实记录**

| 项 | 实测 |
|---|---|
| 系统级 `JAVA_HOME` | 空 |
| `where java` / `javac` | 无输出 |
| 可用 JDK | `tools/jdk/jdk-17.0.20.1+1`、`tools/jdk/jdk-21.0.13+9` |
| 当前账户管理员 | **否** |
| 写 Machine 变量 | **失败**：`不允许所请求的注册表访问权` |
| `sudo.exe`（Win11 内置 v1.0.1.0） | 存在，但此非交互会话中执行后**无输出、无写入**，提权无效 |

按要求「无权限就明确报告、不降级为临时设置」，**未写入任何用户级变量**。
已把要求与实际结果写入 `README.md` §6.2，并保留 `scripts/set_java_home_admin.ps1`
供有管理员权限时一键执行（只追加、不覆盖、不重复，并回读校验）。

现有兜底不依赖全局 Java：`gradlew` 与 `build.gradle` 都按目录扫描 `tools/jdk/*`。

---

## C.122　R76-G：工具链升级到 Gradle 9.8.2 + JDK 27 + Kotlin 2.4.21（2026年11月4日）

### 一、本机真实环境（不是推测）

| 项 | 实际值 |
|---|---|
| 系统级 `JAVA_HOME` | `C:\Program Files\Java\jdk-27.0.1.0.3`（Machine 级） |
| JDK 版本 | Oracle JDK **27.0.1.0.3**，build 27.0.1.0.3+1-2，2026-10-25 |
| 系统 Path | 含 `%JAVA_HOME%\bin` |
| Scoop Gradle | `C:\Users\Oreki\scoop\apps\gradle\9.8.2`，shim 在 `C:\Users\Oreki\scoop\shims\gradle` |
| 全局 Gradle 版本 | **9.8.2**（2026-10-19 构建，内置 Kotlin 2.4.10 / Groovy 4.0.33） |
| 仓库内 JDK | `tools/jdk/jdk-17.0.20.1+1`、`tools/jdk/jdk-21.0.13+9` |

> 注意：**WorkBuddy 终端不继承系统新环境变量**（R75 曾误判为「无 JAVA_HOME / 无管理员权限」）。
> 实际是会话级未刷新；系统级配置一直是对的。本文件据此更正 R75 的结论。

### 二、关键事实：本项目不使用 AGP，也不使用 Kotlin Gradle Plugin

`build.gradle` 与 `settings.gradle` 中：

- `com.android.application` 出现 **0 次**
- `org.jetbrains.kotlin` 出现 **0 次**
- 无 `plugins {}`、无 `buildscript`、无 `repositories`、无 `dependencies`
- 无 `gradle/libs.versions.toml`

项目形态是「Gradle 负责任务编排，真正构建由 `scripts/build_mod.py`
（apktool + smali 补丁 + zipalign + apksigner）完成」，Kotlin 由**命令行 kotlinc** 编译。
所以「升级 AGP / 升级 Kotlin Gradle Plugin」在本项目里**没有落点**，
不能编造版本号。真实可升级的是：Gradle Wrapper、JDK、命令行 kotlinc。

### 三、Gradle 9 的破坏性变更（实际踩到并修复）

Gradle 9 移除了 `Task.exec {}`（Gradle 8 只是弃用告警）。升级后首次构建直接失败：

```
Execution failed for task ':verifyEnvironment'
> Could not find method exec() for arguments [...] on task ':verifyEnvironment'
```

修法：项目级注入 `ExecOperations`，5 处 `exec {}` 全部改为 `runExec {}`：

```groovy
import org.gradle.process.ExecOperations
def execOps = project.services.get(ExecOperations)
def runExec = { Closure cfg -> execOps.exec(cfg) }
```

这是**真实的 API 不兼容**，不是环境问题。

### 四、JDK 兼容性结论（有实测证据）

| 组合 | 结果 |
|---|---|
| Gradle **8.10.2**（原 Wrapper）+ JDK 27 | **失败**：`Unsupported class file major version 71`（71 = Java 27）。Groovy 3.0.22 的 ASM 不认 Java 27 字节码 |
| Gradle **9.8.2**（新 Wrapper）+ JDK 27 | **成功**：9m51s 完整 Release 构建 |

Gradle 9.8.2 发行说明首条即「Java 27 support」，与其内置 Groovy 4.0.33 / Kotlin 2.4.10 匹配。

### 五、Kotlin 2.4.21 离线包核对（不靠文件名认定）

| 文件 | 大小 | 完整性 | 版本证据 |
|---|---|---|---|
| `kotlin-compiler-2.4.21.zip` | 86 MB | 133 条目，`testzip()` 无损坏 | `kotlinc/build.txt` = `2.4.21` |
| `kotlin-gradle-plugin-2.4.21.jar` | 30 MB | 16190 条目，无损坏 | MANIFEST `Implementation-Version: 2.4.21` |
| `kotlin-native-image-windows-x86_64-2.4.21.zip` | 105 MB | 79 条目，无损坏 | 顶层目录带 2.4.21 |

**KGP JAR 依赖状况（重要限制）**：
- 无 `.pom`、无 `.module`（无 Maven 元数据）
- 不内嵌依赖：`gnu/trove` 0 个类、`kotlinx/coroutines` 0 个类
- 结论：**不能只把 JAR 丢进 libs 就宣称插件安装成功**。缺 POM 与传递依赖
  （kotlin-compiler-embeddable、trove4j、kotlinx-coroutines、kotlin-daemon-embeddable 等）。
  本项目不用 KGP，因此该限制不影响交付，但如实记录。

### 六、Kotlin 编译器升级实测（2.1.0 → 2.4.21）

`tools/kotlinc` 已替换为 2.4.21（旧版备份在 `tools/kotlinc-2.1.0-backup`）。

| 检查项 | 2.1.0 | 2.4.21 |
|---|---|---|
| `kotlinc -version` | kotlinc-jvm 2.1.0 | kotlinc-jvm **2.4.21**（JRE 27.0.1.0.3） |
| class 文件 major version | 52 | **52**（一致） |
| OrekiTrace 6 个静态方法 | gEnter/gSkip/ctTrue/ctFalse/buyTrue/buyFalse | **完全相同** |
| D8 转 dex | 1792 B | **1824 B**（Kotlin 元数据差异，ABI 未变） |
| `build_kotlin.py --clean` | 正常 | **正常，6 秒** |

**ABI 逐字一致**，`build_kotlin.py` 无需改动（其内置 ABI 断言自动通过）。

### 七、本次构建结果

| 项 | 值 |
|---|---|
| 命令 | `gradle assembleRelease --offline`（Scoop Gradle 9.8.2 + JDK 27） |
| 结果 | **BUILD SUCCESSFUL in 9m 51s** |
| APK | `build/gradle-stage/反物质维度.apk`，69,782,175 B |
| SHA-256 | `621f2bb94767b753964670c4db2ba8bc11cc2c028a8fadf6da02598552b854ad` |
| 版本 | 3.19.0 / 30190000（**未冒充 3.20**） |
| DEX | classes / classes2 / classes3 / **classes4（Kotlin 2.4.21，1824 B）** |
| 签名 | v2 + v3 验证通过，证书 SHA-256 `95960bce…` |
| 3.19 补丁回归 | **44 / 44 PASS** |

### 八、Wrapper 升级注意事项

用 `gradle wrapper --gradle-version 9.8.2` 生成后，`gradlew` 首次运行需下载
`gradle-9.8.2-bin.zip`。本机网络直连 `services.gradle.org` 超时，
因此**本次构建验证使用 Scoop 的本地 9.8.2 发行版**（`gradle` 命令），
Wrapper 文件本身已正确指向 9.8.2，网络恢复后 `gradlew` 即可用。
未做任何"跳过必要任务"的降级。

### 九、验收策略变更

同日起执行 §62「日常实机优先，版本更新完整回归」：
日常改动不再强制跑 44 项静态探测；**游戏版本升级（如 3.19→3.20）仍必须完整回归**。
本次工具链升级属 §62.4「特殊情况」，验证范围为：完整 Release 构建 + 3.19 补丁回归 + 实机启动。

---

## C.123　R76-SDK：Android SDK Command-line Tools 核对（不降级）（2026年11月4日）

### 一、结论先行

下载包 `commandlinetools-win-15859902_latest.zip` 的 `source.properties` 为：

```
Pkg.Revision=22.0
Pkg.Path=cmdline-tools;22.0
```

而本机已安装的是：

```
C:\Users\Oreki\Android\sdk\cmdline-tools\latest\source.properties
Pkg.Revision=23.0
Pkg.Path=cmdline-tools;23.0
```

**已安装版本 23.0 比下载包 22.0 更新**。按「不降级」原则，**未安装该下载包**，
现有 23.0 完整保留。文件名里的 `15859902` 是 Google 的下载 ID，不是版本号；
版本必须以包内 `source.properties` 为准。

### 二、下载包完整性（仅核对，未安装）

| 项 | 结果 |
|---|---|
| 大小 | 155,655,386 B（149 MB） |
| ZIP 完整性 | 330 条目，`testzip()` 无损坏 |
| 顶层结构 | `cmdline-tools/`（单层，符合官方结构） |
| 关键工具 | `bin/sdkmanager.bat`、`bin/avdmanager.bat`、`bin/android.exe`、`bin/apkanalyzer.bat` |
| 版本证据 | `source.properties` → `Pkg.Revision=22.0` |

顶层就是 `cmdline-tools/`，解压到 `sdk/` 下会得到 `sdk/cmdline-tools/...`，
不存在「多嵌套一层」问题；但因版本更旧，**未采用**。

### 三、当前 SDK 实际状态（2026-11-04 实测）

SDK 根目录：`C:\Users\Oreki\Android\sdk`

| 组件 | 已安装 | 可升级到 |
|---|---|---|
| `cmdline-tools/latest` | **23.0.0** | — |
| `emulator` | 37.2.12 | 37.2.13 |
| `platform-tools` | **37.0.1** | — |
| `platforms/android-34` | 3.0.0 | — |
| `platforms/android-36` | 2.0.0 | — |
| `system-images/android-34/default/x86_64` | 2.0.0 | 4.0.0 |
| `system-images/android-36/google_apis/x86_64` | 7.0.0 | — |

**无 `build-tools` 目录**：本项目不依赖 SDK 的 build-tools，
D8/apksigner/zipalign 全部走仓库内 `tools/bt/android-14/`。
这与「非 AGP 工程」的形态一致。

`ANDROID_HOME` / `ANDROID_SDK_ROOT` 两个环境变量**均未设置**；
项目通过脚本内探测定位 SDK（见下），不依赖这两个变量。

### 四、工具可用性实测

| 工具 | 结果 |
|---|---|
| `sdkmanager --version` | 正常，输出 `1.1.16717390 (Android CLI)`（新版已把 sdkmanager 转为 android CLI 的包装，并有 deprecation 提示） |
| `sdkmanager --list_installed` | 正常，返回上表 |
| `avdmanager list avd` | 正常，列出 3 个 AVD |

**AVD 全部保留**：`oreki_test`、`oreki_phone_test`、`oreki_web_test`
（`C:\Users\Oreki\.android\avd\` 下 6 个文件完好）。

注意：`avdmanager` 需要 `JAVA_HOME`；WorkBuddy 终端默认不继承系统变量，
显式设置 `JAVA_HOME=C:\Program Files\Java\jdk-27.0.1.0.3` 后正常。

### 五、修复：`build_kotlin.py` 的硬编码 SDK 路径

原代码：

```python
ANDROID_JAR = pathlib.Path("C:/Users/Oreki/Android/sdk/platforms/android-34/android.jar")
```

这是个人绝对路径，换机器/换 SDK 根目录即失效，也不该出现在 Git 跟踪文件里。

改为 `_find_android_jar()`：优先读 `ANDROID_HOME` / `ANDROID_SDK_ROOT`，
其次常见默认位置，最后按 `platforms/android-*` 最高版本回落；
仍优先 `android-34`（本项目 d8/资源基线按它验证过）。

实测解析结果：`C:\Users\Oreki\Android\sdk\platforms\android-34\android.jar`（存在）。

### 六、未做的操作及原因

| 操作 | 原因 |
|---|---|
| 安装 22.0 cmdline-tools | 比已装的 23.0 旧，降级违反指令 |
| 升级 emulator 37.2.12→37.2.13 | 现有 emulator 已满足 AVD 运行；改它会影响已在用的 3 个 AVD，风险大于收益 |
| 升级 system-image android-34 2.0.0→4.0.0 | 会改动 `oreki_test` 依赖的镜像；本轮未授权删除/重建 AVD |
| 设置 `ANDROID_HOME` | 指令要求「不擅自修改系统级环境变量」；项目已不依赖它 |

---

## C.124　R77：双端调度器节拍修复 + Android 首个业务类 Kotlin 转译（2026年11月4日，【读码】+【实测】）

### 一、Android 调度器「1 秒间隔无效」的真实根因（三处叠加）

R65/R66 都在查「极性写反」「noteActed 没被调用」，方向对了但没查全。R77 逐行读
`OrekiAutomationScheduler`（1830 行 Smali）后确认是**三处独立缺陷叠加**：

| # | 缺陷 | 后果 |
|---|---|---|
| 1 | **连续型豁免**：`routine/early/eternity/eternityReset` 在闸门之前直接 `return true`，既不过间隔、也不占本帧名额 | 这 4 条完全脱离全局时钟 |
| 2 | **首帧跳过预约**：`sLastAct == 0` 时直接 `return true`，**完全跳过 `reserveOk()`** | 首帧每个任务各拿一次名额 ⇒ 启动瞬间多任务同时放行 |
| 3 | **默认档是单任务档**：每条任务各自计时，不同任务互不阻塞 | 8 条任务首帧全放行 ⇒ 「8 条升级 12~39 ms 内连买」 |

关键事实：Android 侧那 4 个「连续型」id **根本没有调用点**（`grep` 全 payload 只命中
调度器自身）。所以缺陷 1 在当前代码里是「潜在雷」而非现实成因；现实成因是 2 + 3。

### 二、更重要的发现：5 个真实购买动作完全绕过调度器

`OrekiStageAuto.onAutoBuyerTick` 里，以下 5 个方法原本都是**每帧无条件直接调用的
void 方法**，`allow/noteActed` 一次都没调：

```
autoSacrifice / upgradeBulkAll / buyInfinityUpgrades / upgradeCrunchInterval / tryBuyId1
```

调度器当时只管辖 `reality / breakGate / breakUpgrades / breakShop` 四条，
而**真正花钱买升级的这 5 条一条都没被管**。这才是「间隔形同虚设」的主因。

### 三、R77 的修复语义（Kotlin 实现）

| 规则 | 实现 |
|---|---|
| 全局统一节拍 | `allow()` 第一道闸恒为 `lastBeatAt`，与档位无关 |
| 首帧也占位 | 放行前一律 `reserveOk()`，杜绝同帧重入 |
| no-op 不占节拍 | `noteNoop` 不推进 `lastBeatAt`，立即让位 |
| 同帧最多 1 个真动作 | `frameActed` 命中后其余全拒 |
| 关闭即停 | `setEnabled(false)` → `allow` 恒 false + `clearPending()` |
| 改间隔立即生效 | `setIntervalSec` 写内存镜像（`@Volatile`）|
| 每拍最多 1 级 | `upgradeCrunchInterval` 循环上限 16 → 1 |

### 四、Kotlin 全量转译（用户 2026-11-04 令后的实际落地）

`OrekiAutomationScheduler` 从 **1830 行 Smali 完整重写为 Kotlin object**：

| 项 | 值 |
|---|---|
| 源文件 | `scripts/payload/kotlin/kajfosz/antimatterdimensions/oreki/OrekiAutomationScheduler.kt` |
| ABI 方法数 | **21 个 public static**（与旧 Smali 版逐字一致） |
| 编译 | kotlinc 2.4.21 + JDK 27，`-classpath android.jar` |
| D8 | 产出 `build/kt/classes.dex`，**12,584 B** |
| APK 槽位 | `classes4.dex`（原 APK 已有 3 个 dex，自动探测槽位） |
| 装包实证 | `logcat -s OREKI_SCHED` → `init 调度：已启用 · 间隔 1 秒 · 单任务档（每条任务各自计时，且全部受全局节拍约束）` |

**注意**：`kotlinc -classpath` **不接受 dex 输入**（实测 `error: source entry is not a
Kotlin file`）。因此 Kotlin 层访问游戏类一律走 `Class.forName` + 反射，
见 `originalAutobuyersOn()`。这是工具链约束，不是"无法迁移"的例外。

### 五、构建期守卫（防止"源码改了但没进 APK"）

- `build_kotlin.py` 的 `EXPECTED_ABI` 表逐个方法用 `javap` 断言；任一缺失即构建失败。
- `KOTLIN_OWNED_CLASSES` 是 Kotlin 已接管类的唯一清单；`build_mod.py` 读该清单，
  逐个删除对应 Smali 版，条件是「dex 里确实含该类」——绝不因 .kt 存在就删。
- `check_smali_descriptors.py` 增加 `_kotlin_dex_descriptors()`：
  把 `build/kt/classes.dex` 里的类描述符并入「已定义集合」，
  否则正常迁移会被误报成「引用了不存在的类」（本次实际踩到，23223 个类里缺 1 个）。

### 六、R77 构建结果

| 项 | 值 |
|---|---|
| 命令 | `python scripts/build_mod.py`（Gradle assembleRelease 同一入口） |
| 结果 | EXIT=0，完整产物 |
| APK | `release/反物质维度.apk`，69,786,271 B |
| SHA-256 | `b825262f64a9aa50c952dc864873bff695b7c7ac19617ea4a5aa3f850408e0df` |
| DEX | classes 14.2M / classes2 9.66M / classes3 7.4K / **classes4 12,584 B** |
| 版本 | 3.19.0 / 30190000（**非 3.20**，不得冒充） |
| 签名 | v2+v3 通过 |

### 七、AVD（R77 恢复）

| 项 | 值 |
|---|---|
| 名称 | `oreki_test`（唯一） |
| Android | 16 / **API 36** |
| ABI | **x86_64**（ARM64 在 x86_64 主机无法启动，已确认并放弃） |
| 分辨率 | **1440×3200**（`wm size` 实测） |
| Chrome | com.android.chrome 133.0.6943.137 |

### 八、待办

- Web 侧同一语义实现未完成（本轮时间被 Kotlin 转译与构建链排障占满）。
- 5 个购买动作的 `allow/noteActed` 接线尚未落地（需在 OrekiStageAuto 侧改造，
  而该文件仍是 Smali —— 按 §64 需先转译再改，属下一轮工作）。
- 3.20 的 8 个补丁锚点仍未迁移。

---

## C.125　R78：双端全局节拍闭环 + OrekiStageAuto Kotlin 全量转译（2026年11月4日，【读码】+【实测】）

### 一、Android 侧：OrekiStageAuto 全量转译（1979 行 Smali → Kotlin）

| 项 | 值 |
|---|---|
| 源文件 | `scripts/payload/kotlin/kajfosz/antimatterdimensions/oreki/OrekiStageAuto.kt` |
| 原 Smali | 1979 行，已删除 |
| ABI 方法数 | **14 个 public static**（逐字一致） |
| 编译 | kotlinc 2.4.21 + JDK 27 |
| D8 产物 | `build/kt/classes.dex` **98,568 B** |
| APK 槽位 | `classes4.dex` |

ABI 清单（`build_kotlin.py` 的 `EXPECTED_ABI` 逐方法 javap 断言）：
onAutoBuyerTick()V / isDoomed()Z / eternitiesZero()Z / enableIpMultAutobuyer()V /
autoSacrifice()Z / upgradeBulkAll()Z / buyInfinityUpgrades()Z / tryBreakInfinity()V /
upgradeCrunchInterval()Z / tryBuyId1()Z / holdCrunch()Z / enableEarly()V /
crunchProbe()V / applyCrunchPolicy()V

注意：5 个购买方法的返回类型从 V 改成 Z。这不是破坏 ABI ——
它们的**唯一调用方**是本类自己的 onAutoBuyerTick（也在本次迁移内），
外部只有 isDoomed()Z 与 holdCrunch()Z 两处 invoke-static（OrekiBreakGate /
OrekiEternity），签名未变。已用全 payload grep 确认。

### 二、为什么最终用 GameApi（缓存反射）而不是类型桩

R78 先实现了 `scripts/gen_kotlin_stubs.py`（从基线 smali 提取公开 ABI 生成同名同包桩类），
实测在复杂类型上不可行，三条硬阻塞：

1. **泛型擦除**：`java.util.List` 在桩里必须写 `<*>`，但原方法返回 List 裸类型时
   桩编译报 `one type argument expected`；
2. **Any 成员冲突**：smali 里 hashCode()I / toString()Ljava/lang/String 是 public，
   桩生成后与 Kotlin 的 Any 成员冲突，报 `hides member of supertype 'Any'`；
3. **递归爆炸**：从 Player 出发递归展开签名类型会拖进 **6677 个类**，
   编译桩要数分钟且桩之间互相引用还要排序。

最终方案 GameApi.kt：**句柄解析一次并缓存为字段**（by lazy），之后每帧只做 Method.invoke。
这不是 R78 禁止的"大量逐次反射" —— 没有任何购买路径或每帧路径会做名称查找。
按用户设置的 1~60 秒间隔，每拍最多 1 次动作，缓存 invoke 的开销不可测。

### 三、R78 的核心修复：5 个真实购买动作纳入全局节拍

修复前（R77 结束时）：onAutoBuyerTick 里这 5 个方法每帧无条件直接调用，
allow() 一次都没走，且每个方法内部还有批量循环：

| 方法 | 旧行为 | 旧上限 |
|---|---|---|
| autoSacrifice | 每帧判定并可能献祭 | 每帧 1 次 |
| upgradeBulkAll | 循环 8 个维度全升 | **一帧 8 次扣费** |
| buyInfinityUpgrades | 买到就继续遍历 | **一帧最多 17 项** |
| upgradeCrunchInterval | 循环买 interval | **一帧最多 16 级** |
| tryBuyId1 | 循环 1..8 层 | **一帧最多 8 次** |

修复后：

| 方法 | 新行为 | 每拍上限 |
|---|---|---|
| autoSacrifice | 返回 Z（真的献祭了才 true） | 1 |
| upgradeBulkAll | **轮转单维度**（sBulkCursor），返回 Z | 1 |
| buyInfinityUpgrades | 只买第一个可买项即 return true | 1 |
| upgradeCrunchInterval | 循环上限 16 → **1**，返回 Z | 1 |
| tryBuyId1 | **轮转单层**（sIdCursor），返回 Z | 1 |

全部按 allow → 执行 → noteActed/noteNoop 三段式接入。no-op 不占节拍。

### 四、构建期守卫的迁移（Smali 断言 → Kotlin 断言）

R78 迁移后有 8 处守卫读 OrekiStageAuto.smali，全部会因文件不存在而失败。逐条换算：

| 守卫 | 原断言 | Kotlin 等价断言 |
|---|---|---|
| 开局闩锁 | sput-boolean ≥2 处 | sEarlyApplied = true/false ≥2 处 + 早退守卫 |
| R41 极性表（8 条） | if-eqz / if-nez / if-ltz / if-gez 助记符 | 对应 if (!x) / if (x) / if (c < 0) / if (c >= 0) |
| R57-1 硬门 | eternitiesZero() 后不得跳 :oreki_sa_try_end | Kotlin 里无该跳转即通过 |
| ET1 挂点 | OrekiEternity.tick() 在 tryBuyId1 之前 | GameApi.eternityTick() 在 tryBuyId1() 之前 |
| AU4b 策略 | a(I)V ≤2 次 + 每次紧跟闩锁置位 | setCrunchMode ≤2 次 + 每次前 40 行内有 sCrunch*Init = true |
| AD5b BreakGate 顺序 | interval → BreakGate → ID1 | runScheduled("crunchInterval") → allow("breakGate") → runScheduled("idBuy") |
| R42 PelleRecord 顺序 | 在 applyCrunchPolicy 与 doomed 早退之前 | Kotlin 同序 |
| R74 大坍缩策略夹具 | 11 项 Smali 断言 | **16 项 Kotlin 断言**（比原来更严） |

fixture_eternity_gate.py 45 项、fixture_crunch_policy.py 16 项、
fixture_strategy_semantics.py 77 项 —— 全部改为读 Kotlin 或做双源兼容。

### 五、构建性能：两处全树扫描的真凶

R78 构建一度 15 分钟不落盘，被误判为卡死。定位到**两处**每次构建都对 23,220 个
smali 文件做 read_text 的守卫：

| 位置 | 用途 | 单次耗时 | 修法 |
|---|---|---|---|
| verify_payload 的 AchievementUnlocker 死代码检查 | 确认全树 0 引用 | **6m57s** | 收窄到 payload smali + kotlin（该类是我们新增后删掉的，原版从不引用） |
| verify_payload 的 StageAssist 调用点检查 | request 只被 1 处调用 | 同上 | 收窄到 payload + 基线 oreki 包（该类是我们新增的，包外不可能有合法调用） |

**根因**：Windows 上每文件 open+read 约 18ms（杀软实时扫描），23,220 × 18ms ≈ 7 分钟。
bytes.count 预筛无效 —— 瓶颈在 IO 不在 CPU。

### 六、Web 侧：runCycle 全局节拍（对应 Android 三处缺陷）

| 缺陷 | 修复 |
|---|---|
| 连续型豁免（cls === "cont" 直接执行） | **删除该分支**，所有任务进同一队列 |
| 默认档只按单任务计时 | 第一道闸恒为 globalGateFree() |
| Date.now() 非单调 | 新增 nowMs()，优先 performance.now() |
| 同帧可多个动作 | 新增 STATE.frameActed + frameGateFree() |

行为自测（scripts/test-scheduler-beat.mjs，Node 直跑，10 项）：

| 场景 | 结果 |
|---|---|
| 首帧 5 个任务同时满足 | 只执行 1 个 PASS |
| 1 秒档：500ms 拒绝 / 1100ms 放行 | PASS |
| 60 秒档：59s 拒绝 / 61s 放行 | PASS |
| no-op 之后同帧仍放行真动作 | PASS |
| 真动作占拍后紧接的帧被拒 | PASS |
| 关闭后一个都不执行 | PASS |
| 改成 1 秒后立即按新值调度 | PASS |
| 连续型（cont）不再豁免 | PASS |

### 七、Web 六档 Android Chrome 验收（非 Edge、非 headless）

| 项 | 值 |
|---|---|
| 设备 | oreki_test AVD，Android 16 / API 36 / x86_64 / 1440×3200 |
| 浏览器 | **com.android.chrome 133.0.6943.137**（真机 Chrome） |
| 系统语言 / 时区 | zh-Hans-CN / Asia/Shanghai（**保持原样，未改动**） |
| 调试通道 | adb forward tcp:9222 localabstract:chrome_devtools_remote |
| 视口 | 320/640、360/740、390/844、430/932、768/1024、1280/800 |
| 结果 | **6/6 通过**（innerWidth 精确匹配，无横向溢出） |

关键踩坑：Chrome 133 已**不再读取** /data/local/tmp/chrome-command-line，
写那个文件开不了 devtools。实际可行的路径是：先完成首次运行引导
（FirstRunActivity → 点「在不登录账号的情况下使用」），之后 Chrome 才会
建立 chrome_devtools_remote socket。

### 八、遗留 Smali / 无法转译清单

| 类 | 状态 | 原因 |
|---|---|---|
| OrekiBreakGate | 仍 Smali | 本轮**未修改**其逻辑，只从 Kotlin 调用 tick()；按 §64「不修改则不必迁移」 |
| OrekiBreakShop | 仍 Smali | 同上 |
| OrekiSmartStrategy / OrekiStrategyData | 仍 Smali | 只读解释器，由 JSON 编译生成，不含购买逻辑 |
| OrekiEternity / OrekiReality / OrekiGlyphAuto / OrekiTeresaAuto / OrekiPelleRecord | 仍 Smali | 同上，本轮未改其逻辑 |
| OrekiAutomationUiListener / SpeedSettingsActivity | **R91 已迁 Kotlin**（`OrekiAutomationUiListener.kt`，旧 Smali 已删除）；SpeedSettingsActivity 仍 Smali，仅 3 条玩家可见文案 | UI 层；R78 时点为 Smali，R91 更新 |

**本轮新增/修改的 Smali 业务逻辑 = 0 行**（所有改动都在 Kotlin 或构建脚本里）。

### 九、待办

- 3.20 的 8 个补丁锚点仍未迁移。
- check_automation_scheduler.py 仍针对旧 Smali 调度器，需整体重写为 Kotlin 断言
  （不被构建调用，不影响交付）。

---

## C.126　R79：REA 6.8.0 环境核实 + 3.20 增量映射（2026年11月5日，【REA实测】）

### 一、REA 实际可用能力（不是文档推断）

| 项 | 实测值 |
|---|---|
| REA 包 | `rea-agents@6.8.0`（`npx -y rea-agents@6.8.0`） |
| MCP 协议版本 | `2025-11-25` |
| `mcp doctor` | **healthy: true**，`adapter: production-stdio` |
| 工具清单 | expected **229** / observed **229**，missing=[] unexpected=[] duplicates=[] |
| Prompts | expected 6 / observed 6 |
| Catalog digest | `fe938a7c6eba3763b22ae2022de76dc4a7812d35d86f1d4efd36b9962b04da0b`（期望=实际） |
| JADX 桥 | `rea-jadx-bridge` **v7**，engine `jadx-headless-mcp` **0.7.1** |
| JADX JAR SHA-256 | `6e5eacf500b64292bfb73c49797c1958f6ee44646e43e868039ae7feb573ff75`（与官方要求值一致） |
| JADX JAR 路径 | `tools/rea/jadx-headless-mcp-0.7.1-all.jar`（42,619,858 B） |
| 运行 JDK | `tools/jdk/jdk-21.0.13+9`（`java_version: 21.0.13`，heap 4046 MiB，worker 1） |

**重要区分**：`mcp.json` 里配置了 `rea` server **不等于**当前 WorkBuddy 会话已加载它的工具。
R79 实测 `.workbuddy/mcp-tool-list.json` 的 11 个 server 条目里**没有 rea**，
`ListMcpResources(server="rea")` 返回空。**实际可用的入口是 CLI**：
`npx -y rea-agents@6.8.0 <command>`，功能完整（doctor 229 工具全通过）。

### 二、REA 对 3.20 APK 的分析身份

| 项 | 值 |
|---|---|
| APK | `work/apk320/kajfosz.antimatterdimensions.apk` |
| SHA-256 | `085fc1278682d11136658f10fc875a9e6970737874b7e78650a1578ef3dc6400` |
| 包名 | `kajfosz.antimatterdimensions` |
| versionName / versionCode | **3.20.0 / 30200000** |
| minSdk / targetSdk / compileSdk | 32 / 37 / 37 |
| 类数量 | **13,862** |
| 资源数 | 1,728 |
| APK 加载耗时 | 6,206 ms（decompile_timeout 90,000 ms） |
| `inspect_android_package` Evidence | `ev_9be41f0f5fa1917d972b2e9be556d11bfab48beeca12f4e29f82d91b5a719e95` |

### 三、版本与签名核实（独立于 REA）

| 项 | 结果 |
|---|---|
| 最新稳定版 | **3.20.0**（Google Play 2026-10-29 更新；APKPure/AppBrain/Uptodown 三源一致） |
| XAPK SHA-256 | `2aac58e2e7a413a0d93cd951ce2d17203019501b361293758f0d3e6f5c1a2345`（与 APKPure 页面公布值一致） |
| 内部 APK SHA-256 | `085fc127…`（与历史记录一致，文件未变） |
| 3.20 签名证书 SHA-256 | `24c5158c0de5d472f018107476ca6e5fd8c1442b404c3fe49a26c2024dd1fd14` |
| 3.19 签名证书 SHA-256 | `24c5158c0de5d472f018107476ca6e5fd8c1442b404c3fe49a26c2024dd1fd14` |
| 结论 | **两版同一签名证书**（`CN=Android, O=Google Inc.`）→ 3.20 候选包可认定为官方签名包 |

> **REA 的 limitations 明确写了**："APK signatures ... are not verified by this provider"。
> 签名核验用的是独立 `apksigner verify --print-certs`，不是 REA 结论。

### 四、R79 新增/修正的 3.20 映射（全部有结构证据）

| 3.19 | 3.20 | 证据 |
|---|---|---|
| `kx0`（维度提升需求计算） | **`c01`** | 7 字段 `a:Z b:I c:D d:Z e:D f:Z g:D` 逐一同名同类型；2 方法 `<init>()V` + `a(D)Lb01;`；5.0/15.0/20.0 三常量齐备全库唯一。REA `inspect_android_method` 的 Java 体含 `Math.rint((15.0d - d3) * (dFloor - 5.0d))`。Evidence `ev_526a72e05c6f32f22109dfe5954dc691454c2a92ae50a203dd1bec73551e2547` |
| `az1`（无限升级注册表） | **`b22`** | 4 方法 `<clinit>/a()BigDouble/b()BigDouble/c()V` + 20 字段 + `public static final s:Ljava/util/List;`，全库唯一 |
| `e02.n0()`（IPMult 解锁判定） | **`os0.F()`** | 方法体逐指令同构（`sget v81.a:o81 → w()Z` + `pelle.c.q()Z` + if-eqz/if-nez 三段），全库唯一 |
| `z51` / `s51`（自动器状态单例） | **`v81` / `o81`** | `o81` 与 3.19 `s51` 的 4 个方法名逐个相同（`k`/`s`/`v`/`w`），构造签名同型 |
| `fp3`（无限升级基类） | **`qr3`** | 19 方法 2 字段，A(Z)Z/B()Z/C(ZZ)V/D(Z,x)Boolean/E(Z)V 四关键签名全中；super `ak1→an1` 同型 |
| `uu1`（ipMult 升级实现） | **`px1`** | 15 方法 6 字段，**super 就是 qr3**；x()/y()/I()/J(J) 全中 |
| `ja4`（NoSuchElement 抛出工具） | **`qw3`** | `public final synthetic`，`public static synthetic j(Ljava/lang/String;)V` 逐字相同 |

**修正的旧映射错误**：`FIELD_ALIASES_320` 的 `ln0.e → bq0.g0` 经 25 字段位置逐一比对**确认正确**
（位置 19），此前怀疑有误是误判。25 个字段位置 100% 对齐，`ln0.w→bq0.w`（IP）、
`ln0.F→bq0.R`（EP）同样正确。

### 五、R79 修复的 3.20 补丁（实际生效）

| 补丁 | 原失败 | 修复方式 |
|---|---|---|
| `patch_dimboost_ad8_slope` | `kx0` 的 5.0 锚点不唯一 | 别名 `kx0→c01` + `mod_file()` 跨 dex |
| `patch_ip_mult_autobuyer` | 找不到 `e02.n0()Z` | 类别名 `e02→os0` + **方法级别名** `n0→F` + 锚点 `z51/s51→v81/o81` |
| `patch_ad_bonus` | B/C 段命中 0 | B 段锚点动态构造（`t5/r5`）；C 段新增 `_ad_t5_anchors_c()`（`ja4→qw3`） |
| `verify_payload` | `z3` 路径打开错文件 | 新增 `_ref_path()`：**文件路径 basename 也套别名**，`smali/z3.smali → smali/s3.smali` 再由 `mod_file()` 跨 dex 回落 |

**同时新增的守卫**：`verify_kotlin_gameapi_aliases()` —— 强制
`GameApi.kt` 的 `ALIAS_320` 与 `build_mod.OBFUSCATION_ALIASES_320` **逐条一致**，
并禁止 `cls("短名")` 裸写。这条守卫直接针对 R79 发现的最危险故障模式：
R8 回收复用旧短名后，Kotlin 反射会**静默指向错误类**（不抛异常）。

### 六、REA 明确排除的候选（避免误映射）

`p51`（EC12 闭包）在 3.20 的候选曾考虑 `ux2`（2 方法 + 60 个 pswitch 与 3.19 完全同数），
但 REA + 结构核对**否定了它**：
- `ux2` 用的是 `Player$Records.l()`（ThisReality），而 3.19 `p51` 用的是 `j()`（ThisEternity）
- `ux2` 只有 `10.0` 一个常量，3.19 `p51` 有 `2.0`/`0.1`/`10.0` 三个
- `ux2` 的 `invoke()` 无参数，3.19 `p51` 的 `invoke(Object)` 有参数

→ **`patch_ec12_restriction` 的 3.20 映射仍未确定**，保留未解决状态，不伪装成成功。

### 七、证据边界（必须随结论一起引用）

- REA 全部结论的 `confidence: observed`、`authority: shipped-artifact`。
- REA 自带的 limitations：静态反编译**不建立运行时行为**；方法签名用 provider 显示类型；
  类清单是代码生成前的解析元数据；**incoming reference 计数是 JADX using nodes，
  不等于 invoke 指令总次数**，且不覆盖动态/反射调用；Manifest 分析**不验证签名**。
- 因此本文件的所有映射都标注为「静态结构 + 方法体语义」证据，
  **不等于**运行时验证；运行时验证见 AVD 章节。

---

## C.127　R79：3.20 增量迁移（38/44）+ 两处长期潜伏 bug 的定位（2026年11月5日）

### 一、版本核实与签名（已完成）

| 项 | 值 |
|---|---|
| 最新稳定版 | **3.20.0**（Google Play 2026-10-29；APKPure / AppBrain / Uptodown 三源一致） |
| XAPK SHA-256 | `2aac58e2e7a413a0d93cd951ce2d17203019501b361293758f0d3e6f5c1a2345` |
| 内部 APK SHA-256 | `085fc1278682d11136658f10fc875a9e6970737874b7e78650a1578ef3dc6400` |
| 包名 / 版本 | `kajfosz.antimatterdimensions` / 3.20.0 / 30200000 |
| minSdk / targetSdk | 32 / 37 |
| **3.19 与 3.20 签名证书** | **完全相同** `24c5158c0de5d472f018107476ca6e5fd8c1442b404c3fe49a26c2024dd1fd14` |

> 签名核验用独立 `apksigner verify --print-certs`，不是 REA 的 Manifest 分析
> （REA limitations 明确写了「APK signatures ... are not verified by this provider」）。

### 二、REA 实际能力（实测，不是文档推断）

| 项 | 值 |
|---|---|
| REA | `rea-agents@6.8.0`，`mcp doctor` → **healthy: true** |
| 工具清单 | expected **229** / observed **229**，missing=[] unexpected=[] |
| Catalog digest | `fe938a7c6eba3763b22ae2022de76dc4a7812d35d86f1d4efd36b9962b04da0b`（期望=实际） |
| JADX 桥 / 引擎 | `rea-jadx-bridge` v7 / `jadx-headless-mcp` **0.7.1** |
| JADX JAR SHA-256 | `6e5eacf500b64292bfb73c49797c1958f6ee44646e43e868039ae7feb573ff75`（与官方要求值一致） |
| 运行 JDK | `tools/jdk/jdk-21.0.13+9`（java_version 21.0.13，heap 4046 MiB） |

**重要区分**：`mcp.json` 里配置了 `rea` server **不等于**当前会话已加载其工具。
R79 实测 `.workbuddy/mcp-tool-list.json` 的 11 个 server 条目里**没有 rea**，
`ListMcpResources(server="rea")` 返回空。**实际可用入口是 CLI**：
`npx -y rea-agents@6.8.0 <command>`。

3.20 APK 的 REA 分析身份：类 **13,862**、资源 **1,728**、加载 **6,206 ms**，
`inspect_android_package` Evidence `ev_9be41f0f5fa1917d972b2e9be556d11bfab48beeca12f4e29f82d91b5a719e95`。

### 三、R79 定位到的两处**长期潜伏 bug**

#### bug 1：类别名替换的 `\b` 词边界在参数类型位置失效

```python
re.sub(rf"\bL{cls};", f"L{new};", text)   # ← 错
```

`.method public D(ZLvh0;)Ljava/lang/Boolean;` 里 **`Z` 与 `L` 都是 word 字符**，
两者之间没有词边界，`\b` 匹配失败 → 该类名从未被替换。

- 为什么长期没被发现：绝大多数调用点写成 `, Lxxx;`（逗号后有边界），只有
  **紧跟类型描述符**的位置（参数列表、数组维度）会漏。
- R79 在 3.20 的 `fp3.D(Z, Continuation)` 上第一次踩到，症状是报
  「缺少方法 `D(ZLkj0;)`」——`rest` 里的 `vh0` 换成了 `kj0`，但 `cls` 的
  `Lfp3` 没换，自相矛盾。
- 已批量修正 **11 处**（去掉 `\b`）。smali 类描述符必为 `Lpkg/Name;`，
  且短名后紧跟分号，不存在误伤。

#### bug 2：注释里写了映射，但**没真正加进别名表**

`OBFUSCATION_ALIASES_320` 里 `fp3` / `uu1` / `az1` 只有大段注释说明「3.19 X → 3.20 Y」，
**键值对本身缺失**。后果与 bug 1 同类：类名不换，方法/字段换了，报出自相矛盾的错误。

已补齐 `fp3→qr3`、`uu1→px1`、`az1→b22`。别名表现在 **23 条**。

### 四、R79 新增的 3.20 映射（全部有结构证据，已固化到 `docs/deobfuscation/mapping_319_to_320.json`）

| 3.19 | 3.20 | 指纹依据 |
|---|---|---|
| `kx0` | `c01` | 7 字段 `a:Z b:I c:D d:Z e:D f:Z g:D` 同名同型 + 2 方法；5.0/15.0/20.0 三常量全库唯一；REA 方法体含 `Math.rint((15.0d-d3)*(dFloor-5.0d))`，Evidence `ev_526a72e0…` |
| `az1` | `b22` | 4 方法 + 20 字段 + `s:Ljava/util/List;`，全库唯一 |
| `e02` | `os0` | `n0()Z` ↔ `F()Z` 方法体逐指令同构（`v81.a:o81 → w()Z && !pelle.c.q()`） |
| `z51` / `s51` | `v81` / `o81` | `o81` 与 `s51` 的 `k/s/v/w` 四方法逐个相同 |
| `fp3` | `qr3` | 19 方法 2 字段；A/B/C/D/E 四关键签名全中；super `ak1→an1` |
| `uu1` | `px1` | 15 方法 6 字段，**super 就是 qr3** |
| `ja4` | `qw3` | `public static synthetic j(Ljava/lang/String;)V` 逐字相同 |
| `vh0` | `kj0` | Kotlin Continuation 接口，2 方法 |
| `av` | `qw` | `public abstract` + super=`qr3` + **5 方法连修饰符逐个相同**（同 super 的另两个候选是 9/4 方法） |
| `u7` | `e7` | `public abstract` + **23 字段 + 1 方法** + `v:Ljava/util/List;` 全库唯一 |
| `l7` | `v6` | `public abstract` + super=`an1` + **10 方法**（含 `w()Z` / `abstract z()D`）全库唯一 |
| `c43` | `z53` | 唯一持有 `a(I)L.../challenge/antimatter/normal/a;` |
| `c21` | `u41` | 唯一持有 `a(I)L.../eternity/studies/b;` |

### 五、3.20 补丁探测进度

**起点 33/44（R75-C）→ R79 达到 38/44（+5）**

已修复：`patch_dimboost_ad8_slope`、`patch_ip_mult_autobuyer`、`patch_ad_bonus`、
`verify_payload`（多轮链式修复）、`verify_eternity_chain`。

仍失败 6 项：

| 补丁 | 阻塞原因 |
|---|---|
| `verify_payload` | 链式符号检查，逐个暴露下一个缺失；`c43→z53`、`c21→u41` 已确认待入表验证 |
| `patch_ec12_restriction` | `p51` 闭包在 3.20 **无同构者**。已用 REA 排除 `ux2`：① `Records.l()`(ThisReality) vs `j()`(ThisEternity)；② 常量集 `10.0` vs `10.0/2.0/0.1`；③ `invoke()` 无参 vs `invoke(Object)` |
| `patch_auto_enter_eternity_challenge` | `c21` 的方法需换 `u41`（映射已确认，待应用） |
| `patch_id_autobuyer_guard` | `c30` 里找不到 `1e8`（`0x4197d78400000000`）—— 门槛常量所在类待定位 |
| `patch_instant_challenge_rewards` | `bq0.g0` 类型是 `Lup0;` 而非 `Lip0;`（3.20 对 Currency 状态类做了拆分）；已放宽为只校验字段名，待验证 |
| `patch_v_unlock_thresholds` | 涉及 `u55/s55/t55/c15/lu` 五类交叉 + 倒序 pswitch 表；**V 是最后阶段内容，对 3h 通关无影响，明确暂缓** |

### 六、R79 结论（诚实记录）

- **3.20 未构建 APK**：核心链路仍有失败项，不满足「核心可玩」标准。
- 唯一可用 APK 仍是 R78 的 **3.19** 版本（SHA `67a81867…`），**不是 3.20**。
- 全新存档 3 小时通关实测**未开始**。
- Web 侧经核对**已完整实现**所有 R79 关注的功能（全局节拍、等待态、速通纪录、
  挑战结算、早期自动化）；R79 曾新增「速跑记录子页」，发现 `PreviousSpeedrunTab`
  已存在后**已删除重复实现**。

---

## C.128　R80：3.20 补丁迁移 40/44 + Web IP 倍率缺陷修复（2026年11月5日，【实测】）

### 一、版本核实（本轮动态查询，不沿用 R79 结论）

| 项 | 值 | 来源 |
|---|---|---|
| 最新正式稳定版 | **3.20.0**（未变） | Google Play 商店页 `kajfosz.antimatterdimensions`，`Updated on Oct 29, 2026`，What's new 标注 `3.20.0` |
| 版本代码 | 30200000 | 本地 APK `AndroidManifest.xml` 解析 |
| 是否需升级迁移基础 | 否，R79 的 3.20 映射继续有效 | — |

结论：**3.20.0 仍是当前最新正式稳定版**，本轮在既有迁移成果上继续，未重启大规模反混淆。

### 二、独立干净工作目录（R80 新增机制）

R79 收尾时 `work/mod` 有被后台探测中途写入的痕迹（`a.smali` mtime 落在探测窗口内），
不可信。R80 新增 `OREKI_MOD` 环境变量（`scripts/build_mod.py:31`），
从 **`work/base_decoded_320` 原版基线**完整复制出 `work/mod_r80`（17,446 文件，23.3 s，
`shutil.copytree`；`cp -r` 与 `robocopy` 均因 Windows 下大目录中断而不可靠）。
旧 `work/mod` 原样保留，未删除。

### 三、补丁链进度：33/44（R75-C）→ 38/44（R79）→ **40/44（R80）**

本轮新增修复（每条都有结构证据，均写入 `scripts/build_mod.py` 行内注释）：

| # | 项 | 根因 | 修法 |
|---|---|---|---|
| 1 | `verify_kotlin_gameapi_aliases` | 守卫按整文件子串匹配 `cls("az1")`，命中说明性注释 | 先剔除 `//` 与 `*` 注释行再比对 |
| 2 | `verify_payload`（py1.c） | 3.20 的 `py1` 被 R8 复用为纯数据类 | 新增 `py1→q12`（`a:List` + `a(I)/b()/c()/d()` 四方法逐字相同） |
| 3 | `verify_payload`（货币现值） | `bn0.w()` 在 3.20 变 `rp0.K()`，且与 `bn0.s()→rp0.G()` **交叉交换** | 新增方法级别名，并让 `_ref_rewrite` 也处理方法级 |
| 4 | `patch_auto_enter_eternity_challenge` | payload 已被 4.5 重写，断言仍按 3.19 名比对 | frag 断言接入 `_alias_frag`；新增 `ii0→xj0`（CoroutineContext） |
| 5 | `patch_instant_challenge_rewards` | `_CURRENCY_BIT_FIELDS` 只含 3.19 名，别名把 `e` 换成 `g0` 后走错分支 | 集合补 `g0`/`R`；新增 `ju→aw` 与 `ju.o→aw.C`、`ju.u→aw.I` |
| 6 | `patch_id_autobuyer_guard` | 3.20 的 IU15 三处阈值换了类名 | `lu→cw`、`c30→s40`、`vw1→qz1`（行号 7050/1884/1152 与 3.19 逐一对齐） |
| 7 | `patch_ec12_restriction` | `p51` 在 3.20 无同名类 | 按四条件指纹（10 个 cmpg-double + 2.0/0.1/10.0 + ThisEternity×6 + invoke(Object)）命中 `k81`；寄存器由 `v2/v3` 平移为 `v6/v7` |

### 四、剩余 4 项与优先级判定

| 补丁 | 对前三小时通关的影响 | 处置 |
|---|---|---|
| `patch_v_unlock_thresholds` | **无**（V 是最后阶段，需 200 现实之后） | 按用户指令**明确暂缓** |
| `patch_ec12_restriction` | 有（EC12 高倍率下限时必败） | 本轮已修（见上表 #7） |
| `patch_instant_challenge_rewards` | 有（挑战不发 IP/EP） | 本轮已修（见上表 #5） |
| `verify_payload` | 构建期守卫 | 本轮已修（见上表 #2/#3） |

### 五、Web 生产代码缺陷（本轮实修，非文档）

**缺陷：`InfinityUpgrade.ipMult` 在首次永恒前永远买不到**（`src/core/oreki-early-automation.js`）

1. `InfinityIPMultUpgrade`（`src/core/infinity-upgrades.js:136`）继承的是
   `GameMechanicState`，**不是** `SetPurchasableMechanicState` ——
   它**没有** `isAvailableForPurchase` getter（返回 `undefined`）。
   旧代码 `if (!upgrade.isAvailableForPurchase) continue;` 恒为真 →
   ipMult 每一帧都被跳过。这是「IP 倍率从来不涨」的直接原因。
2. `InfinityUpgrade.all` 按数据库声明序（`secret-formula/infinity/infinity-upgrades.js:334`），
   ipMult 排在**第 18 位（最后）**；旧逻辑 `bought >= UPGRADES_PER_TICK` 一买到就 break，
   17 条一次性升级未买完前 ipMult 一次都轮不到。

修法：`isAvailableForPurchase === false` 才跳过（区分 undefined 与 false）；
一次性升级与可重复升级分两轮、各自每拍 1 个名额。
**未改任何数值 / 价格 / 存档字段。**

行为自测：`node scripts/test-early-ipmult.mjs` → **PASS 7/7**。
教程同步：附录 F 新增「十五、首次永恒前的无限升级购买（本版修正）」。

### 六、诚实边界

- 本 FACTS 条目的「40/44」来自 `scripts/r80_patch_run.py --keep-going` 的
  定向补丁链运行日志（`build/_r80_patch4.log`），不是完整 44 项探测。
- **Android 3.20 Release APK 尚未构建**（本条写入时补丁链仍在收尾）。

### R85：智能自动购买器默认调度间隔（2026-11-06）

- 已核实生产入口：`src/core/oreki-smart-executor.js` 的新存档默认值为 10 秒，调度换算为 `intervalSec * 1000 = 10000` 毫秒；用户可调范围仍为 1～60 秒。
- localStorage 中已有 1～60 秒合法值会保留；缺失、非整数、越界值回退 10 秒。`setIntervalSec` 仍即时更新内存状态并将用户输入钳制到 1/60 秒。
- 关闭智能自动购买器后 `runCycle` 不执行任务，既有的 `releaseIfTakenOver` 会释放 IU15 接管；不会改变原版循环、原版自动购买器或手动操作。
- Web 定向行为自测：`node scripts/test-scheduler-beat.mjs`，14 项检查通过；教程校验 2189/2189 通过。

### R86：Android 3.21 门禁与 Web 独立交付（2026-11-06，紧急保存点）

- Android 3.21 官方基线 APK 已核实：`versionName=3.21.0`、`versionCode=30210000`、包名 `kajfosz.antimatterdimensions`、`minSdk=32`、`targetSdk=37`、双 DEX；基线 SHA-256 为 `4e9970a808d10b6cc1a1068b078ec3c7d922051086a576c66d071c1216f527ac`。
- REA 已直接检查该 APK：包证据 `ev_6704dda2c967a878b6b27432f39a2713592ea4cbc69a8f739e46aa32eebdce0e`；`iq0` 类证据 `ev_bb5f5f3631b58c130628ae97211bded4b98b2be6d04fb63a2d5013e7d6aebdb5`。完整 JADX 导出位于 `work/output_code_321_r86`，没有覆盖旧导出。
- `aliases=CONFIG` / 缺少 `OBFUSCATION_CONFIG` 只是表面错误；真实根因是 `baseline/version-config.json` 的 3.21 配置尚无可供构建消费的完整 `bindings.json`，因此迁移门禁仍应保持 fail-closed，禁止填假值或放宽门禁。
- `scripts/baseline_bindings.py` 已增加基于稳定游戏宿主、唯一同构方法及真实 DEX 指令引用关系的绑定证据，并修正多 DEX 枚举：3.21 实测默认包短类与游戏包可能分处 `smali` / `smali_classes2`，不能只扫描包含游戏包的单一 DEX 根。
- 中途结果（修正多 DEX 枚举前）为 41 个所需类中 35 个 `CONFIRMED`，未确认 6 个：`am0`、`fd0`、`fw`、`kajfosz/antimatterdimensions/player/e`、`os0`、`qw3`。其中 `am0 -> fl0` 已有多个独立真实调用宿主但类形状从 27 增至 28 方法；`os0.F()Z -> nr5.u()Z` 的真实 Smali 指令链已人工逐条核对；其余应在恢复后用修正后的全 DEX 派生重新确认。紧急停止指令到达后，新的全 DEX 派生已安全终止，未把不完整结果写成正式绑定。
- 本轮没有启动 Android Release 构建，没有生成或安装 3.21 MOD APK，也没有 OneDrive / 小米云盘上传。Kotlin、D8、最终 APK DEX 集成及实际设备游戏验收仍未执行，不能宣称 3.21 Release 已打通。
- Web 使用真实 Android Chrome（Chrome 133，默认 CSS 视口 412×796）完成 7/7 定向检查：缺失/无效配置默认 10 秒、合法 37 秒保留、1/60 秒边界即时生效、关闭后不执行任务并清空队列、无横向溢出。未重复已通过且代码未变化的 scheduler 14/14 与教程 2189/2189。
- GitHub Pages 已由 Web 源提交 `29e48cff7aa699c8122f3d1bc69fde12a7a6b487` 的干净 HEAD 快照部署；Pages 提交为 `1073aedd80c200f3839d7985c74cd15639e6c330`，Actions run `42203360325` 成功。线上 `oreki-smart-executor.js` 与部署提交字节一致，SHA-256 `76ceba7b4f90379ec30e35a3ffc7d8316a26be8f9d4f50b1360f79fe21922630`。

### R87：首次无限→首次永恒的真实提速与 Android 3.21 迁移（2026-11-06）

- Web 生产修复：`src/core/oreki-autobuy-break-infinity.js` 复用 `OrekiEarlyAutomation.shouldReserveIpForId1()` / `leavesId1Reserve(cost)`。首次永恒前、ID1 未解锁、IP 已达到原版 `ipRequirement` 时，跳过任何真实扣费后会跌破门槛的 Break Infinity 升级；其余仍按原版最便宜优先购买，购买走 `upgrade.purchase()`，不写位图、不伪造扣费或奖励。此前 R82 只覆盖无限升级路径，Break 商店可把 IP 压到 1e8 以下，使 `waitingForId1Peak` HOLD 解除、自动坍缩清零反物质。`[读码]` + Node 行为夹具。
- Web 定向验证：`node scripts/test-r87-break-id1-reserve.mjs` 13/13、`node scripts/test-early-ipmult.mjs` 7/7、`node scripts/test-r82-id1-growth.mjs` 17/17、`node scripts/validate_tutorial.mjs` 2189/2189 通过；未运行完整浏览器矩阵，未把定向夹具写成全流程通关证明。
- Android R87：`OrekiBreakShop` 已从 Smali 整体迁移到 Kotlin，保留 `public static final int tick()` ABI；`GameApi.kt` 增加 Break 升级原版购买链的缓存反射与基线绑定；`build_kotlin.py` / `build_mod.py` 增加 ABI、Kotlin-owned 与 ID1 预留构建契约。`python scripts/build_kotlin.py --clean` 通过，`build/kt/classes.dex` 已生成且包含 `OrekiBreakShop`；`python -m py_compile scripts/build_mod.py scripts/build_kotlin.py` 通过。
- Android 3.21 `bindings.json` 已生成，41 类全部 CONFIRMED（34 条来自全 DEX 派生 + 7 条来自真实字段/方法/调用链定向证据）；`baseline_bindings.py verify` 通过。实际三次构建分别暴露 `fl0` 方法名、Ad Bonus C 锚点、`iq0.g0` 字段类型问题，均已修复；交付截止前最后一次构建未完成并已停止，**未生成 R87 APK**，未上传 OneDrive / 小米云盘，不能宣称 3.21 Release 已交付。
- Web 教程附录 F 新增「十九、打破无限后的升级不再抢走第一无限维度的点数」；Android 构建期由 `scripts/oreki_tutorial_gen.py` 从同一份 Web JSON 生成 `oreki_tutorial.txt`，因此 3.21 构建时语义同步（本轮尚未生成 APK，不能宣称 Android 已装载该正文）。
- Web Pages 最终：源提交 `7a7121f`，部署提交 `192e4a3`；Actions `42215594429` success；线上 `oreki-autobuy-break-infinity.js` 返回 200 且含 R87 判据。

### R88：Android 3.21 Release 收敛与 Web 调度时钟修复（2026-11-06）

- Android 使用真实 3.21 APK（SHA-256 `4e9970a808d10b6cc1a1068b078ec3c7d922051086a576c66d071c1216f527ac`）完成一次 R88 全量 JADX 导出到 `work/output_code_321_r88`；REA 定向确认 `nr5.u()Z` 是 3.21 IP 倍率自动购买器解锁判定，证据 `ev_27890e5ca98314b5dea551d8602aeae92ea13e0568e46ff29e1e76c568766fe7`。
- Android 构建根因修复：教程入口校验支持真实启用的 launcher `activity-alias`；V 门槛补丁在 `u55` 不具备 `Ls55 + g:List` 结构时 fail-closed 暂缓，避免把 3.21 WeakHashMap 工具类当作旧 V 类；UI 层按真实 3.21 DEX 迁移到 `lz0/z63/wi4/player.h/uo4` 与 `Player$Options.E0`。
- 最后一次 `assembleRelease --offline -PorekiBase=work/base_decoded_321` 已通过 Kotlin、D8、41 项绑定、补丁契约、教程、Manifest、三份 DEX smali 汇编和 UI 迁移，最终在 apktool `buildResources` 创建临时文件时因 Windows `Access denied` 失败。**未生成 3.21 Release APK**；按紧急停止指令未重试、未安装、未运行、未上传云盘。
- Web 生产修复统一调度时钟为 `performance.now()`，executor 同样遵守 frame/global/task gate，且只有真实 `outcome.acted` 才消耗共享节拍；空转不再饿死阶段队列。R88 定向测试 4/4，相关既有夹具合计 55/55 通过；紧急指令后未重复测试或部署 Pages。
- 独立基线升级说明书位于 `docs/ANDROID_BASELINE_UPGRADE_GUIDE.md`。

### R89：Windows apktool 临时文件修复与 Android 3.21 候选包（2026-11-06）

- R88 的 `Access denied` 已定位到 apktool `ApkBuilder.buildResources` 的 `File.createTempFile("APKTOOL", null)`：失败发生在 Java 默认临时目录的**创建**阶段，不是资源解析、smali 汇编或正式 APK 覆盖。R88 进程的 `java.io.tmpdir/TEMP/TMP` 为 `C:\Users\Oreki\AppData\Local\Temp\`；当前同用户 Java 探针可正常创建、写入、删除 `APKTOOL*.tmp`，未发现 Defender、路径长度或 ACL 的持续证据，也未发现冲突句柄。
- 最小修复：`scripts/build_mod.py` 为 apktool 子进程设置仓库内唯一临时目录 `build/apktool-tmp-<pid>`，同时设置 `TEMP`、`TMP`、`-Djava.io.tmpdir`；没有再关闭安全软件或修改系统权限。使用 R88 已准备的 `work/mod` 做定向构建成功。
- Android 3.21 Release 候选包已生成：`build/gradle-stage/反物质维度.apk`，82,621,937 B，SHA-256 `95f3917544986a1608f6ff5deca616af2fe87a9ed5760ac4950b012dd0a77a96`；versionName `3.21.0`、versionCode `30210000`、包名 `com.oreki.antimatterdimensions`。APK 含 4 个 DEX；`classes4.dex` 2,660,136 B 且包含 `OrekiBreakShop`、`OrekiBaselineBindings`、`GameApi`；`assets/oreki_tutorial.txt` 191,496 B。签名 `apksigner verify --min-sdk-version 32` 通过 v3，证书 SHA-256 `95960bce0d8806124d72755d827fcd9216919cac29147635767a967360ed3197`；v1/v2 为 false（该包 minSdk 32，v3 可用）。
- 候选包同时复制到 `release/反物质维度_3.21.0_R89候选.apk`、`C:\Users\Oreki\OneDrive\反物质维度_3.21.0_R89候选.apk`、`C:\Users\Oreki\小米云盘\反物质维度_3.21.0_R89候选.apk`，三处本地 SHA-256 一致；未覆盖旧 3.20 的 `反物质维度.apk`。安装、启动、挑战/存档/回归与真实墙钟验收**未执行**，不得称为正式稳定版。
- Web R88 已提交 `e661dcc`，R88 定向时钟夹具 4/4；Pages 部署提交 `a357203`，线上核验见部署记录。

## R90 早期例程真实动作回执（2026年11月7日，Web）

- `[读码]` `src/game.js` 的 `tryOrekiEarlyRoutine()` 自 2026-10-29 起无条件 `return true`（原第 338 行）。R78 把调度器改成「一次真动作 = 全局节拍 + 同帧唯一名额，no-op 才顺延」后，这条返回值让 `routine` 每拍都吃掉唯一名额。
- `[读码]` `runCycle` 的固定顺序为 `breakUpgrades(5) → breakGate(6) → routine(10) → early(20)`；`OrekiSmartExecutor.tick()` 又受 `frameActed` 限制（R88）。因此 `early`（无限维度 / 无限升级）在 `routine` 有返回值时永远轮不到；首次无限之后 ID1 与首次永恒都没有推进入口。
- `[实测]` 新增 `scripts/test-r90-early-routine-beat.mjs`（真实 `runCycle` + 原样抽取的 `tryOrekiEarlyRoutine`）：修复前第 1 项「空转返回 true」失败、第 2 项「5 拍内 early 执行 0 次」失败；修复后 7/7。
- `[代码]` 修复：`tryOrekiEarlyRoutine()` 在动作前记录快照（反物质、`totalTickBought`、`dimBoosts`、`galaxies`、8 层维度数量），动作后仅当任一项变化才返回 true；购买顺序、成本与扣费路径不变。
- `[实测]` 相关回归：R87 13/13、R82 17/17、R80 7/7、R88 4/4、调度 14/14、R83 12/12；教程校验 2189/2189。
- `[未验证]` 未跑真实浏览器新档墙钟；收益为「early 模块重新获得节拍」的机制级修复。Android 侧未改；需在 Android `OrekiStageAuto`/调度器核对同类「空转也上报 act」的返回值语义。

## R90 Android 3.21 运行候选与 v2/v3 签名（2026年11月7日）

- `[构建]` 第三次 R90 全量构建通过，候选为 `build/r90-stage/反物质维度.apk`，82,621,937 B，SHA-256 `41d14a8318166224d065cd79ec751f4f4f1222a600fda2170b3a0406b474b7cb`；versionName `3.21.0`、versionCode `30210000`、包名 `com.oreki.antimatterdimensions`、4 个 DEX。
- `[实测]` 候选已安装到 AVD `oreki_test` 并启动到真实游戏主界面；进程持续存活，未见 `FATAL EXCEPTION`、`VerifyError` 或 `NoSuchMethodError`。两次主界面状态间资源实际变化：无限点数 `1.47e32 → 1.52e32`，反物质 `2.46e1672 → 6.97e1403`。
- `[代码]` Firebase ABI 修复：3.20 `Lud1` → 3.21 `ee1`，42 项 bindings 验证通过；`OrekiInstantChallenge` 使用 3.21 真实 Currency 字段 `iq0.d0:Lrp0;` / `iq0.z:Lup0;` / `iq0.d:Lop0;`。
- `[签名]` `apksigner verify --min-sdk-version 24 --max-sdk-version 27` 通过 v2；`--min-sdk-version 28 --max-sdk-version 32` 通过 v3；证书 SHA-256 `95960bce0d8806124d72755d827fcd9216919cac29147635767a967360ed3197`。`publish_apk.py --dry-run` 已通过，v2=True、v3=True，证书一致。
- `[读码]` `OrekiStageAuto.runScheduled()` 仅在 action 返回 true 时 `noteActed`，否则 `noteNoop`；未发现 Web R90 同类空转误占节拍路径。仍发现 `OrekiAutomationScheduler.servedCount()` 返回任务索引而非 `served[idx]` 的诊断计数缺陷；`upgradeCrunchInterval()`/`autoSacrifice()` 的无条件 true 是否构成真实缺陷仍需 `GameApi` 原版状态证据，未定性。
- `[未验证]` 智能调度 1 秒/60 秒、关闭停止、真实购买扣款、存档退出恢复、挑战结算、全新存档和三小时真实墙钟均未完成；`OREKI_ACHAUDIT` 的 12 项 mismatch 语义未确认。当前只能是 R90 运行候选，不是正式稳定版；旧 3.20 稳定包与 R89 候选未被覆盖。
- [实测] R90 候选 verifyRelease 14/14 通过（v2/v3 分段验签、EC12 动态定位、OrekiInstantChallenge 检查）；verifyPatchContract 仍为 11/17，旧 3.19 硬编码路径未适配 R90。

## R91 Android 3.21 正式交付（2026年11月7日）

- `[时间]` 开工 2026-11-07 13:20:48 +08，交付节点 15:20:48 +08。Android 仓 R91 开始时 HEAD `5fb8efc`；当前 HEAD `4388fdf`（14:06:59 §79 规则提交），生产修改仍在工作区未提交。
- `[构建]` 本轮首次正式 Gradle 构建成功：`build/gradle-stage/反物质维度.apk`，耗时 10m37s，4 个任务执行；3.21 基线 `work/base_decoded_321`，42 项 bindings CONFIRMED；Kotlin 输入 9 个文件（8 个 payload `.kt` + 生成绑定），`classes4.dex` 2,664,968 B。候选副本 `build/r91-candidate/反物质维度_d46.apk` 同字节。
- `[产物]` 82,621,937 B，SHA-256 `D46B4B1BDBB627030ECD2B17D5882A2A0D9E9E42C42B25BC7FEDB955ADE01716`，versionName `3.21.0` / versionCode `30210000` / 包名 `com.oreki.antimatterdimensions`，4 个 DEX，v2+v3 签名，证书 SHA-256 `95960bce...3197`。
- `[门禁]` `verifyRelease` **14/14 PASS**（`build/gradle-reports/verify-release.json`，failed=0）；`verifyPatchContract` **17/17 PASS**（`reports/r91-gates/verify-patch-contract-gradle-stage-apk.json`，passed=17/total=17，132 s，exit 0）。旧脚本对 3.21 树为 11/17；修复后对 R90、R89、R91 Gradle 候选均 17/17；3.20 稳定包按版本前置校验被拒绝（exit 2），未把旧包伪报 PASS。
- `[3.21 契约修复]` EC12 闭包 `smali_classes2/u81.smali`（`OrekiSpeed.unscale(D)D` → `move-result-wide` → `cmpg-double` 相邻序列）；`Challenges.update` 位于 `smali_classes2/kajfosz/antimatterdimensions/challenge/antimatter/c.smali`（suspend `b(D,ContinuationImpl;)`，`OrekiChallengeAuto.tick()` 后唯一 `OrekiInstantChallenge.tick()`）；挑战入口 `n63`（普通）/`c22`（无限）/`x81`（永恒）；记数法 `wi4`/`z63`/`Player$Options`/`oh2`/`player.h`。详见 `reports/r91-gates/R91-task-2-verify-patch-contract-evidence.md`。
- `[Kotlin 迁移]` `OrekiAutomationUiListener` 已整类迁 Kotlin（`scripts/payload/kotlin/.../OrekiAutomationUiListener.kt`，旧 Smali 删除）；`OrekiAutomationScheduler.servedCount()` 修正为返回真实 `served[idx]`；`OrekiStageAuto` 增加 `autoSacrifice`/`upgradeCrunchInterval` 等真实状态变化成功判定；`build_kotlin.py` / `check_automation_scheduler.py` 同步更新。`buildKotlinDex` 成功，`classes4.dex` 2,664,968 B；构建日志 `首次永恒判定链夹具：47 项检查，失败 0 项`。`SpeedSettingsActivity` 仅 3 条玩家可见文案（间隔提示、恢复默认 10 秒、说明默认 10 秒），无逻辑改动。
- `[AVD]` R91 候选已用 `adb -s emulator-5554 install -r` 安装：`Success`，versionName `3.21.0` / versionCode `30210000`；未执行 `pm clear`，`firstInstallTime` 保持 2026-11-04 15:38:35，旧存档保留。环境与安装证据：`reports/r91-avd/00-ENV.md`、`01-install.log`、`02-dumpsys-package.txt`。启动仅到进程/前台（`/ui` 与 logcat 有侧证，无有效游戏截图）；Agent B 交接报告 `reports/r91-avd/08-handoff-to-lead.md` 明确 14 项 UI 验收除安装/版本/APK 哈希外均未验证，frame-observer 切到游戏后帧通道冻结。**详细 UI/功能验收 PENDING/未验证，不得写成 PASS。**
- `[Web]` R91 源提交 `0dda298`（6 个文件：5 个修改 + 1 个新增测试）已推送；Pages 部署提交 `945fed2` 已推送；线上 `https://oreki.net/src/core/oreki-early-automation.js` 返回 200、包含 `shouldRequestBeat`，SHA-256 `43D9C12062CB6C033A300D53915C43E1B4B4DD10AEFB4FDDE7716B4D3E24EBB4`。R91 定向夹具 13/13；相关回归 74 项、教程校验 2189/2189 为执行记录（Agent E 本轮未重跑）。
- `[发布边界]` `release/反物质维度.apk` 仍为 3.20 稳定版，SHA-256 `82156A4055D36522BF247CCF37606E07CEF9D37C79BB46BE1DA727FF3D590051`；R89 `95F3917544986A1608F6FF5DECA616AF2FE87A9ED5760AC4950B012DD0A77A96`、R90 `41D14A8318166224D065CD79EC751F4F4F1222A600FDA2170B3A0406B474B7CB` 均保留。R91 尚未写入 `release/`、未上传双云盘、未 commit/push，不得写成已正式发布。
- `[未验证]` 智能调度 1/10/60 秒、关闭停止、真实购买扣款、存档退出恢复、挑战结算、全新存档、真实 180 分钟墙钟、教程/UI 详验均 PENDING；AVD 详细结果未确认前，R91 只能称交付候选。


## R91 Lead AVD 复核补充（2026-11-07 14:30 +08）

- 设置页真实 UI：默认 10 秒、保存 1/60 秒、恢复默认 10 秒、空串/61 非法拒绝、关闭/恢复启用、force-stop 重启保持均 PASS；证据 `reports/r91-avd/09-lead-results.md` 及 13-settings.png～30-restart-settings.png。
- 自动购买器页面显示已启用；游戏活动期间无限点数从 2.52e32 变成 2.56e32，反物质持续变化；`OREKI_GATE`/`OREKI_CRUNCH` 有日志。但未捕获 `OREKI_SCHED act`，后期存档当前无可执行任务，不能把原版自动购买器或诊断日志当作本调度器实际购买；调度器实际购买仍未验证。
- 挑战真实结算、无限/ID1 IP 预留专项、新档 180 分钟墙钟、真机表现均未验证。
- R91 候选已复制到 `release/反物质维度_R91候选_d46.apk`、OneDrive 与小米云盘同名候选；三处 SHA-256 均为 `D46B4B1BDBB627030ECD2B17D5882A2A0D9E9E42C42B25BC7FEDB955ADE01716`；旧 `release/反物质维度.apk` 3.20 未覆盖，未执行正式 `installToRelease`/`publishRelease`。

## R92 独立新档验收与前期提速（2026-11-07）

- `[时间]` 开工 2026-11-07 14:55 +08（创建独立 AVD），双小时交付节点 16:55 +08，沿用 R92 实际开始时间，未重置；本轮未启动 R93。
- `[规则]` RG01 分层规则为权威：根 `AGENTS.md`/`RULES_INDEX.md` 原先是旧版全文、与远端新版分层入口分叉（3 个 inode）。已先把旧根文件原样归档为 `docs/rules/archive/ROOT_AGENTS_PRE_RG01_20261107.md`、`ROOT_INDEX_PRE_RG01_20261107.md`（Android 与 Web 两仓各一份），再用远端新版入口重建三处硬链接；`python scripts/check_agents_sync.py` 现为「全部一致」。`FACTS.md` 硬链接未动。提交：Android `9612c13`、Web `9a25576`，均已 push。
- `[AVD]` 新建独立 AVD `oreki_r92_fresh`（`C:\Users\Oreki\.android\avd\oreki_r92_fresh.avd`，`system-images;android-34;default;x86_64`，Android 14，1080×2400），串口 `emulator-5556`（与旧 `oreki_test` 的 `sdk_gphone64_x86_64` 系统镜像不同）。**全程未对 `oreki_test` 执行 pm clear / 卸载 / 恢复出厂 / 改 userdata / 改存档**。
- `[故障]` 新旧两个模拟器进程一度同时消失，`adb devices` 为空。三次重启失败：`-gpu swiftshader_indirect` 报 `Critical: Failed to load opengl32sw (找不到指定的模块。)`；`-gpu host` 仍 `Showing crashdialog to get consent`；并出现 `FATAL | Running multiple emulators with the same AVD is an experimental feature`（孤儿 qemu 进程 + `*.lock` 残留）。根因（有证据）：**宿主缺少 opengl32sw，有窗口模式的渲染后端不可用**；主机可用内存仅约 2.4 GB（16 GB 被 ChatGPT/codex/msedge 占用）是加重因素。恢复办法：停孤儿 `qemu-system-x86_64.exe`、清 `multiinstance.lock`、改**无窗口**启动（`qemu-system-x86_64-headless.exe`）→ 设备正常上线。与 AVD 数据、APK、存档无关。日志 `reports/r92-avd-emulator*.log`。
- `[实测]` 新档真实性：模拟器重启后游戏给出离线结算「在你离开的 38 分 13 秒里：反物质 从 1.52e160 增加到 1.98e187，无限点数 从 98 增加到 102，无限次数 从 49 增加到 51」——反物质从 1 起步，说明**确为该 AVD 上从零开始的新档**。Lead 点击「开始游戏」后状态：反物质宇宙阶段、**反物质 2.23e250、无限点数 118、永恒点数 0**；即约 40 分钟真实墙钟（游戏速度 10000×）已推进到首次无限之后、首次永恒之前。
- `[实测]` MOD 日志：`OREKI_SCHED init 调度：已启用 · 间隔 10 秒`、`OREKI_EARLY applied`、`OREKI_GATE` 每 5 s、`OREKI_CRUNCH` 每约 8 s、`OREKI_ACHAUDIT DONE scanned=144 unlocked=115 mismatch=12`；**无 FATAL EXCEPTION / VerifyError / NoSuchMethodError**。
- `[未验证]` `OREKI_SCHED act`、普通挑战真实结算、ID1 IP 预留、存档重启恢复四项**本轮没有取得运行证据**：新档停在首次永恒前，IP 仅 118（ID1 需 1e8 IP），没有任何可执行的调度动作，不把 `OREKI_GATE`/`OREKI_CRUNCH` 诊断日志当作 act。全新存档 180 分钟墙钟通关也未完成。
- `[代码·Web]` `src/game.js`：开局「维度提升 / 反物质星系」由每拍 1 次改为单次调度动作内买光当前买得起的次数（仍走原版 `requestDimensionBoost`/`requestGalaxyReset`，计数变化守卫 + 硬上限 100 + 总开关/挑战中不买 + 重置类动作在前）。同时修掉真实缺陷：`player.dimBoosts` 在原版**不存在**（真实字段 `player.dimensionBoosts`，`src/core/player.js:210`），旧写法让守卫恒判「没变化」并立刻 break ⇒ 批量购买在生产环境完全不生效；`game.js` 4 处 + 两个夹具已改真字段名。定向测试 16/16、R90 占拍 7/7、相关回归 14/17/12/4/7/1 全 exit 0、教程校验通过。
- `[代码·Android]` `scripts/payload/kotlin/.../OrekiIu15Sprint.kt`：IU15 冲刺接管判据从只看原版自动购买器开关，改为同时看本作自动化总开关（`GameApi.autobuyersOn() && OrekiAutomationScheduler.isEnabled()`）——修复「关闭本作总开关后 IU15 接管不解除」的缺陷（此前该文件为未提交历史 WIP，本轮核实语义后随 R92 提交）。
- `[构建]` `gradlew assembleRelease --offline`，16:02:40 → 16:17:11（14m31s），工具链：JDK 27.0.1.0.3、Gradle 9.8.2、kotlinc + D8（android-14 build-tools）、apktool、apksigner；Kotlin ABI 校验通过（`OrekiAutomationUiListener` 3 个方法），`classes4.dex` 注入 classes4。产物 `build/gradle-stage/反物质维度.apk` 82,621,937 B，SHA-256 `0764E0F1910355A87F9F98C331AD7E1D6284729F9C562749AF9B9EACC376B1B0`，3.21.0 / 30210000，v2+v3，证书 `95960bce…3197` 未更换。
- `[门禁]` `verifyRelease` **14/14 PASS**（126 s）；`verifyPatchContract` **17/17 PASS**（120 s）。最终 APK 已 `adb -s emulator-5556 install -r` 成功、游戏前台运行、无崩溃。
- `[发布]` 门禁未覆盖「调度器实际购买 / 挑战真实结算 / ID1 预留 / 存档恢复」，因此**不覆盖 `release/反物质维度.apk`**，只交付带版本标识的候选：`release/反物质维度_R92候选_0764.apk`、`C:\Users\Oreki\OneDrive\反物质维度_R92候选_0764.apk`、`C:\Users\Oreki\小米云盘\反物质维度_R92候选_0764.apk`，四处 SHA-256 一致（Coreutils `cp` + `sha256sum` 本地核验，未回读云端）。旧 3.20 稳定包与 R89/R90/R91 候选全部保留。
- `[Web 交付]` 源提交 `17e7a9f`（R92：修复前期维度提升批量购买字段名失效并补齐夹具）已 push；Pages 提交 `6e8a933` 已 push；线上 `https://oreki.net/src/game.js` SHA-256 `0dddc1b3c5505bc6a99cf53a3b100225dc1291e0c991d71ba24b634f3df38b81`，含 `player.dimensionBoosts`（4 处）且不含 `player.dimBoosts`。
- `[已确认的下一步瓶颈]` 3.21 真实证据（`work/base_decoded_321` 逐行核对）：`DimBoostAutobuyerState.g()Z` 需普通挑战 10 完成、`GalaxyAutobuyerState.g()Z` 需挑战 11 完成，而 Android 的 `OrekiStageAuto.enableEarly()` 只打开这两个原版自动器 ⇒ **Android 在首次无限之前没有自动维度提升 / 星系购买**，只能手点；Web 侧由 MOD 例程补上，**双端不一致**。已核实的 3.21 入口线索：`Player.u()D` = `dimensionBoosts` 公开 getter、`Lm01;->c(DZZZ)V` = 维度提升请求入口；星系请求入口在 `prestige/d` 的 suspend 链，尚未确认可否安全反射调用。- `[续跑·16:30~16:55]` 存档恢复实测：冷启动读回上次落盘存档并继续推进（IP 290→330，`OfflineSimulation: away 0.3 min, simulated 0.3 min, completed`）；但强杀会丢掉「上次落盘之后」的进度（维度提升 35→15、无限进度 80.20%→31.70%），属 3.21 原版落盘节奏（payload 内无任何存档代码），不是 MOD 逻辑。
- `[归因]` 轮询 5 分钟零 `OREKI_SCHED act` 不是抓取失败：逐条核对 `OrekiStageAuto.onAutoBuyerTick()` 的全部受节拍任务，本档（IP 330、反物质 1.56e167、首次无限后未 Break 升级）在原版判据下**没有任何可执行动作**（ID1 需 IP 1e8、无限升级需 IP ≥1e6、献祭前置未满足、早已 Break）⇒ 无 act 是正确行为；IP 增速约 6/分钟，本轮窗口内不可能触发。标记 NOT RUN（原因明确），不写成 PASS。
- `[瓶颈·已定位到行]` `OrekiStageAuto.kt:144-147` `if (!GameApi.hasInfinity()) { enableEarly(); return }` —— 首次无限之前调度器**一个任务都不跑**；而 `enableEarly()` 只开原版 `Auto.i()`/`Auto.p()`，其 3.21 解锁条件是普通挑战 10/11（`DimBoostAutobuyerState.g()Z` / `GalaxyAutobuyerState.g()Z`）⇒ Android 首次无限前**没有自动维度提升/星系**。新档实测界面同时显示「维度提升 (19) 需要 95 第八维度 / 当前 100」＝买得起却没人替它买，与 Web（MOD 例程 + R92 批量购买）双端不一致。下一轮修复 ABI 已核实：`Player.u()D`/`Player.A()J` 取计数，`UpgradeableAutobuyerState.t()`/`A(Z)` 为原版购买入口。
- `[ABI]` 「首次无限前自动维度提升/星系」的 3.21 真实入口已逐行核实：原版请求入口是 `Lm01;->n(Z)V`（游戏的四个重置按钮 `i22/j22/k22/l22.C(ZZ)V` 都调它；`n(false)`=维度提升、`n(true)`=星系重置，内部自带挑战中/前置/上限守卫并走 `m57.u(...)` 原版结算），计数用 `Player.u()D`（dimensionBoosts）与 `Player.A()J`（galaxies）；**不采用** `m01.d(DI)V`→`m01.c(DZZZ)V` 那条路，因为它的参数由 autobuyer 协程 `q(Lrj0;)` 计算，复刻风险高。- `[关键发现]` Android 侧**没有** Web 的 AD4「保留反物质」实现（`rg keepAntimatter|保留反物质 scripts/payload` 0 命中），而 3.21 原版在未解锁成就 111 / 未拿现实 Perk 时会在维度提升/星系重置时**清零反物质** ⇒ 直接移植 Web 的「批量自动维度提升/星系」会把 AD4 当初解决的死锁闭环（反物质反复清零 → 爬不到 1.797e308 → 发不出坍缩 → 没有 IP）重新装回 Android。下一轮必须**先补 AD4 等价的 Kotlin 实现（重置前后保留反物质，窗口与 Web 一致），再加受节拍约束的批量重置**，两者缺一不可；这也解释了 Android 侧一直没做这段自动化的原因。
- `[逆向·16:47]` `m01.n(Z)V`（3.21 `smali_classes2/m01.smali:2092-2245`）整段读完：`Z=false` 分支 = 守卫（普通挑战 `n63.f()` / 无限挑战 `c22.d()`）→ `fl0.r(cw, Player.u()D)` 取需求 → `m57.u(...)` 换算 → `Player.C0(D)` **写回新的维度提升数**；`Z=true` 分支只是「`e22.k()` 为真且 `Player.A()==0` 时把星系数置 1」，**不是星系重置请求**。⇒ 真正的重置执行体在 `m01.c(DZZZ)V`（内部回调 `m01.n`/`m01.m`），`n(false)` 自身不做需求判定 ⇒ **在读完 `m01.c`/`fl0.r`/`m57.u` 之前不落代码**，避免白触发一次重置；星系请求入口仍未定位（`prestige/d` suspend 链），明确只做维度提升一半。AD4 等价可实现：反物质货币 `iq0.d`（`op0`），`op0.K()` 取值、`op0.C(BigDouble)` 加（同步 `Player.Records`）。- `[工具坑]` Git 的 **racy-git** 索引问题在本工作区真实出现过：同一秒内追加 `FACTS.md` 后 `git add` 报「no changes added to commit」，但 `git diff HEAD` 明明有差异（索引 stat 缓存与文件 mtime 同秒 ⇒ Git 误判为 clean）。可靠修法：`git update-index --really-refresh -- <file>` 后再 `git add`；若仍不行，改用 `git hash-object` + `git update-index --cacheinfo` 强制写入索引。另：github.com 直连 443 一度不通（`Recv failure: Connection was reset`），本机 clash 实测监听 **7897**，用**进程级** `-c http.proxy=http://127.0.0.1:7897` 完成 push，不改全局配置。- `[代码·R92 Android]` 修掉双端不一致：Web 从 R82 起 `buyInfinityUpgrades()` 有 `shouldReserveIpForId1()` + `leavesId1Reserve(cost)`，而 Android 只有 Break 商店（R87）有这条底线、无限升级路径没有 ⇒ IP 会被花到 ID1 门槛以下（门槛一破，「暂停坍缩」解除、反物质清零、峰值门槛重爬）。本轮在 Kotlin 落地：`OrekiBreakShop` 新增公开判据 `id1ReserveActive()`（首次永恒前 + ID1 未解锁 + IP 已达标），`OrekiStageAuto.buyInfinityUpgrades()` 在窗口内暂停无限升级购买（保守到底线；Web 是按单条 cost 精算，差异已记录）。`build_kotlin.py` 通过（`classes4.dex` 2,665,088 B），`check_automation_scheduler.py` 新增 3 条静态断言后 **50/50 全过**；提交 `2aef2cd`。- `[构建·R92 第二次]` 带「无限升级 ID1 IP 预留」Kotlin 改动的完整 Release 构建：`gradlew assembleRelease --offline` 16:57:28 → 17:09:24（11m56s），产物 `build/gradle-stage/反物质维度.apk` 82,621,937 B，SHA-256 `6CB5E274424ECDC103B1CD0F80ED197F9158DA9D343E8C3B9682BADCB522F123`，3.21.0 / 30210000，v2+v3，证书 `95960bce…3197`。`verifyRelease` 14/14（83 s）、`verifyPatchContract` 17/17（118 s）；反编译确认 `OrekiBreakShop.id1ReserveActive()Z` 与 `OrekiStageAuto` 中的调用点已进入 DEX。
- `[交付·R92 第二次]` 新候选 `release/反物质维度_R92候选_6cb5.apk` + OneDrive + 小米云盘同名文件，四处 SHA-256 一致（Coreutils `cp` + `sha256sum` 本地核验，未回读云端）；已 `adb -s emulator-5556 install -r` 成功、冷启动后 `OREKI_SCHED: init 调度：已启用 · 间隔 10 秒`、无 FATAL/VerifyError/NoSuchMethodError。旧 `release/反物质维度.apk`（3.20）与 R89/R90/R91、R92 的 0764 候选全部保留，未覆盖。- `[逆向·17:20]` `fl0.r(Lcw;D)` 实为 `new BigDouble(D)` 的构造快捷方式；`m01.i()D` = `floor(Player.u())`（整数提升数，非需求量）；`m01.n(false)` 的可见链路只有 守卫 → `BigDouble(当前提升数)` → `m57.u(...)` → `Player.C0(...)`，**方法内没有任何 `m01.c`/`m01.m` 调用** ⇒ 真正的重置在 `m57.u` 的四个回调里或别处 ⇒ **读完 `m57.u` 之前不反射调用 `m01.n(false)`**。
- `[AVD 观察]` 反复 `am force-stop` 冷启动会让新档回滚到上次落盘（本轮观察：IP 550→554、无限次数 275→277，但维度提升 19→2、无限进度 31%→6.45%）⇒ 180 分钟墙钟测试必须一次连续运行、中途不杀进程；这也是本轮之前"进度看似停滞"的原因之一。- `[代码·R92 关键修复]` 运行日志抓到 `OREKI_API_MISS: missing invoke g0: IllegalArgumentException` ⇒ 定位为**真实缺陷**：`GameApi.setAutobuyersOn()` 绑的是 `Options.g0`，而 3.21 里 `g0` 是 `g0(I)V`（参数 int），反射用 Boolean 调用必抛 `IllegalArgumentException` 并被 `call()` 吞成 null ⇒ `enableEarly()` 的「打开原版自动购买器」**从未生效**，调度器 `allow()` 的 `originalAutobuyersOn()` 闸门可能长期为假（所有受节拍任务被拒、日志里没有 act）。3.21 真实符号已逐行核实：字段 `Player$Options.autobuyersOn:Z`（第 25 行）、getter `c()Z`（第 1071 行）、**setter `e0(Z)V`（第 1126 行 `iput-boolean p1`）**。已改为绑定 `e0(Z)` 并显式限定参数类型；`check_automation_scheduler.py` 新增 2 条断言（**52 项全过**）。提交 `f0f5af6`。- `[构建·R92 第三次]` 带「autobuyersOn setter 修复」的完整 Release 构建：17:20:54 → 17:31:44（10m50s），产物 82,621,937 B，SHA-256 `1340917533B65D7153723B68125F68EE1B0EAA7840FAFE100F0AC244B6767C1D`；`verifyRelease` 14/14（68 s）、`verifyPatchContract` 17/17（104 s）。
- `[修复验证]` 新包安装到 `emulator-5556` 并冷启动后：**`OREKI_API_MISS: missing invoke g0` 不再出现**（旧包每次启动 1 条），`OREKI_SCHED: init 调度：已启用 · 间隔 10 秒` 与 `OREKI_EARLY: applied` 正常 ⇒ e0(Z) setter 绑定生效。游戏内随后推进到 **无限进度 99.72%**（反物质 2.42e307、维度提升 35、第八维度 180、IP 652），维度提升已买得起但**原版 autobuyer 仍锁在挑战 10/11** ⇒ 仍无 `OREKI_SCHED act`（act 需 sacrifice 倍数 ≥2 或 IP 跨门槛）。
- `[交付·R92 第三次]` `release/反物质维度_R92候选_1340.apk` + OneDrive + 小米云盘同名文件，四处 SHA-256 一致；旧 3.20 稳定包与 6cb5/0764 候选保留。
## R93 首次无限前自动成长与正式发布（2026-11-07 18:02 +08 开始）

- `[时间]` R93 实际开始 2026-11-07 18:02:15 +08；双小时节点 20:02:15 +08，不重置计时。
- `[根因·关键]` `1340` 在 AVD 上运行期只有 `OREKI_SCHED init` / `OREKI_EARLY applied` / `OREKI_GATE` / `OREKI_CRUNCH`，**没有任何 act/deny/noop** ⇒ `OrekiStageAuto.onAutoBuyerTick()` 一直走 `!GameApi.hasInfinity()` 早退分支 ⇒ 在已有多次无限的存档上 `hasInfinity()` 仍为 false，sacrifice/bulk/infinityUpgrades/idBuy 等**全部受节拍任务从未执行**。旧实现的 `infinities()` → `compareToDouble` 反射链任一环失败都静默变 false。修复：`OrekiAuto.hasInfinity()` 改为直接读 `BigDouble.toDouble() > 0`（提交 `97c0734`，`build_kotlin.py` 通过、`check_automation_scheduler.py` 52/52）。
- `[实测·UI]` 游戏内真实导航（☰ → 自动化 → 自动购买器）确认：自动购买器总开关「已启用」；`自动进行 维度提升` 已勾选、间隔 4.000 秒；`自动购买 反物质星系`、`无限维度 / 第一无限维度 / 无限点数倍率` 均勾选。在真实 UI 内把 `献祭` 玩家阈值 2.00 → 1.05（证据 `reports/r93-avd/03/05/06-*.png`）后仍无 act，与上述根因一致。
- `[修正]` R92 的表述需精确化：原版「自动进行维度提升」在**首次无限之后**可用（与 Web AU3 的 `canBeUpgraded || infinityUnlocked()` 一致）；缺口只在**首次无限之前**。因此 R93 的实现必须在首次无限后让位给原版自动器，避免双重执行。- `[构建·R93 第一次]` 18:10:17 → 18:29:37 完整 Release 构建（含 R93 的 hasInfinity 健壮化 + prestigeBatch 首次无限前维度提升），APK 82,626,033 B，SHA-256 `78D765807427B22B12CDA823E1AE2327BE68D572879D833F99C18D3AFCA5D7A6`；`verifyRelease` 14/14、`verifyPatchContract` 17/17、`check_automation_scheduler.py` 57/57。
- `[调度链路]` R93 首次观察到真实调度器执行日志 `OREKI_SCHED: noop prestigeBatch` + `deny noop-retry-wait task=prestigeBatch`（R92 时完全为零）⇒ `allow()`/`noteNoop()` 链路已工作；但 `hasInfinity()` 在游戏内仍为 false（已反编译确认 OrekiAuto 的 toDouble 路径在 APK 内、`Player.C()` 确为 infinities），导致后无限阶段任务仍不执行；**第一条真实 act 仍未取得**，不写成 PASS。
- `[交付·R93]` `release/反物质维度_R93候选_78d7.apk` + OneDrive + 小米云盘，四处 SHA-256 一致；旧 3.20 稳定包与 R92 候选全部保留。- `[交付·R93 最终]` 最终构建 18:59:42 → 19:09:15，APK 82,626,033 B，SHA-256 `30AFA7103C784A0D6FEB785B2284D96A490CB2C776E87D45652C98246E5E4EB3`；`verifyRelease` 14/14、`verifyPatchContract` 17/17；交付 `release/反物质维度_R93候选_30af.apk` + OneDrive + 小米云盘（四处 SHA 一致），旧 3.20 与 R92 候选保留。
- `[R93 Android 生产修改]` ①`OrekiAuto.hasInfinity()` 多源判定（`97c0734`/`6c5e430`）；②`GameApi.player()` 不再缓存 null（`58d3624`）；③`hasInfinity` 反射必须选静态桥（`502dc5c`）；④新增 `prestigeBatch` 首次无限前自动维度提升 + `withKeptAntimatter`（`2735fe5`）。`check_automation_scheduler.py` 57/57。
- `[调度链路]` R93 首次出现真实执行日志 `OREKI_SCHED: noop prestigeBatch` / `deny noop-retry-wait task=prestigeBatch`（R92 为零）⇒ allow/noteNoop 链路已工作；但 `hasInfinity()` 在游戏内仍为 false，**第一条真实 act 仍未取得**，三项运行门禁与 180 分钟墙钟维持 NOT RUN。
- `[Web R93]` 修复「先买计数频率再同拍重置 ⇒ 反物质白扣、倍率恒为基础值」：`buyMaxTickSpeed()` 移到维度提升/星系重置之后；源提交 `72cce3b`（merge RG02 后 HEAD `c0559c3`）、Pages `8619567`，线上 `src/game.js` SHA-256 `7a83ccef394b9ae4e9b7b956ef8c7076c7d66de868bee8d8b508670a2c06be4e`；定向 5/5、R92 16/16、R90 7/7、回归全 exit 0。- `[RG02 同步]` 以 GitHub origin/main 为准完整读取 12 个规则文件（Android `0d4c771`、Web `3ca3fec`），两仓共享规则逐文件 blob 比对全部 SAME；本地 ff-only 到最新规则提交。**RG02-04（候选 APK 仅本地）自本轮读取后生效**：曾在读取前复制到双网盘的 R92/R93 候选按「历史云端候选不自动删除」保留，但**此后不再向双网盘复制任何候选**；只有正式稳定版才允许双网盘交付。
- `[诊断]` 一次性探针（3 秒）输出 `inf=0.0e0 ip=null broken=false hasInf=false boosts=0.0` —— 触发时存档尚未加载，不能据此判定 in-game 值；in-game 持续 `noop prestigeBatch` 仍是 hasInfinity 为 false 的独立证据。下一轮按 RG02-02 完整核实 `Player.C()`/`Player.m()`/`Player.infinities` 的完整描述符后再绑定，禁止短名猜测。- `[纠正·19:33]` 「无 act」诊断修正：游戏内实测 0 永恒点数、IP 1.37e3、反物质 3.37e154、`broken=false`、`infinities=0.0e0` ⇒ 存档**尚未完成第一次无限**，`hasInfinity()==false` 是正确状态。真正问题在 `autoPrestigeBatch()` 内部提前返回（最可能是 `eternitiesZero()` 反射链或维度提升需求判据）；下一轮先加一次性诊断日志定位，不再盲改。- `[R94 开始]` 2026-11-07 20:27:03 +08；Android `3ab910b`、Web `c1d14f4`。
- `[R94 根因·关键]` `antimatterValue()` 恒 null 的真因是**绑定表把字段描述符当类名**：`scripts/build_kotlin.py` 用 `entry["to"].split(".")[-1].rstrip(";")` 处理 `Liq0;` 这类无包名描述符，结果留下前缀 `L` → 生成 `put("bq0","Liq0")`、`put("rp0","Lyp0")` → `Class.forName("Liq0")` 必失败 → `currencyHolderCls()`/`currencyImplCls()` 为 null → 运行期 `OREKI_API_MISS: missing class bq0 / rp0`（R93 实测）。修复：新增 `_descriptor_to_binary_name()`（去 `;`、去 `L`、`/`→`.`），并在生成的 `OrekiBaselineBindings.className()` 加运行时 `normalize()` 兜底；生成结果 `bq0→iq0`、`rp0→yp0`。该修复同时纠正所有短名重映射绑定（RG02-02）。
- `[R94 ABI 核对]` `iq0.d:Lop0;`=反物质、`op0.K()LBigDouble;`/`op0.C(BigDouble)Liq0;`、`iq0.w:Lyp0;`=IP、`m01.h()LBigDouble;`/`m01.n(Z)V`/`m01.i()D`、`Player.u()D`/`Player.A()J` 全部按 3.21 反编译树原文核对。
- `[R94 构建]` 唯一一次：20:29:56→20:39:51（9分55秒），预算闸门 `round=R94 used=0/1 ALLOW`；APK 82,626,033 B SHA-256 `C7307BF28587FF9FDB51A930F808A89EB17D98BF4811619007F41F69249958B1`；`verifyRelease` 14/14、`verifyPatchContract` 17/17。
- `[R94 第一条 act]` 真实取得：`act bulk` / `act sacrifice` 共 12 条/2 分钟，`gap≈10020ms`、`sacrifice taskGap≈50139ms`；同屏前后 65 s 反物质 3.11e102→4.35e119；离线结算 23 s 反物质 1.09e50→9.69e142、无限次数 886→887（`reports/r94-avd/`）。- `[R94 Web]` Web 修真实缺陷「选项页默认间隔写成 3 秒而实际为 10 秒」+ 教程第 1/2 章 automation 失真 + 附录 F 新增「保留反物质」；源 `29c34ae`、Pages `3780af0`，线上 game.js/教程数据/OptionsGameplayTab.js SHA-256 均与本地一致；定向测试 17/17、R90 7/7、R92 16/16、R93 5/5、R88 4/4、R82 17/17。
- `[R94 瓶颈定位]` 下一段时间墙：`big-crunch-autobuyer.js` 的 `waitingForId1Peak`（Break 后 ID1 未解锁 + IP≥1e8 + 本纪峰值<1e1100 ⇒ 自动坍缩停摆），需按该窗口量化后再提速。
- `[R94 命名]` 新增 Kotlin 业务代码全部可读命名；诊断字段 `probeAt/probeLeft` 重命名为 `diagnosticProbeNextAtMillis/diagnosticProbeRemaining`（仅日志；当前 APK 内为旧名，下轮构建包含）。- `[R94 save/restart]` PASS：重启后离线摘要「反物质 2.38e136→2.81e225、维度提升 13→31」、调度器 `init 已启用·间隔10秒` 持久化；重启后立即 `act bulk` + `deny frame-held task=infinityUpgrades`（同帧单动作守卫真实生效）。
- `[R94 未完成]` 总开关真实关闭测试 NOT RUN：选项页/搜索/底部导航均未暴露 Oreki 调度开关入口（Manifest 无独立 Oreki 设置 Activity）——这本身是**玩家找不到总开关**的产品缺陷线索，列入下一轮待修。- `[R94 总开关·PASS]` 玩家真实路径：选项 → 打开 Oreki 中文教程 → 打开 Oreki 设置 → 「启用 Oreki 智能调度」勾选框。关闭后返回游戏 50 s 内 **0 act** 且日志持续 `deny disabled task=eternity`；重新勾选后 50 s 内 **5 act**（`act bulk` 每 ≈10 s）+ `deny frame-held task=infinityUpgrades`。此前「入口缺失」判断已纠正（入口在教程页右上角）。
- `[R94 证据目录]` `reports/r94-avd/`：act 前后截图、离线结算 886→887、重启持久化 2.38e136→2.81e225 / 提升 13→31、开关前后 19/20/22/23/28/29 截图与 logcat-switch-final.txt。- `[R94 挑战]` NOT RUN：存档普通挑战 1~4 已全部「已完成」，无新可进入项；需在新档长跑中于首次无限后立即验证。
- `[R94 总结]` P0 修复 + 首条 act + 总开关 + save/restart + 构建预算(1 次) + 双门禁 全 PASS；prestigeBatch(阶段不适用)/星系(未实现)/挑战(已完成)/ID1(未达门槛)/180 分钟(未跑) 均 NOT RUN 且原因明确；候选 `C7307BF2…58B1` 仅本地交付。- `[R94 新档·关键]` 全新存档（`pm clear`）墙钟起点 **2026-11-07 21:05:34**，APK `C7307BF2…58B1`；**约 3 分 16 秒后完成首次无限**（21:08:50 截图：6 无限点数、维度提升 11、星系 2、无限进度 33.13%、解锁粘滞键）。`antimatterValue()` 修复实证：探针 `pb … am=2.65e88/6.92e144/4.51e121/8.59e252`（非 null 且随进度增长）。
- `[R94 修正]` 首次无限前的维度提升**实际由原版自动购买器承担**（`enableEarly()` 打开，4 秒间隔），`prestigeBatch` 全程 noop、未产生 act ⇒ R92/R93「首次无限前没有自动维度提升」的判断在本版不成立；MOD 该任务属冗余（且预判用 `m01.h()=2.0`，非原版 AD8 判据），下一轮应删除或改用一致判据并去重。
- `[R94 长跑]` 新档会话持续运行（未 force-stop），当前 6 无限点数 / 0 永恒，作为跨轮 180 分钟基线保留。- `[R94 长跑·21:16]` 新档 16 无限点数、反物质 8.45e110；**挑战 1~4 在玩家全程未操作的情况下已「已完成」** ⇒ 挑战自动完成链路真实生效，但 logcat 无逐项挑战日志（观测缺口，下轮补）。
- `[R94 新缺陷线索]` `OREKI_GOAL: stage=-1 - goal=- unknownLeaf=2 degraded=1` 连续输出 ⇒ 目标解析器降级、策略层退化为固定顺序；下一轮第一优先定位（很可能又是绑定/字段读取失败）。- `[R94 长跑里程碑]` 21:05:34 起点 → 21:08:50 首次无限（3m16s）→ 21:09:37 12 IP/1.27e115 → 21:12:56 **24 IP/反物质 4.10e258**（逼近 Break 1.797e308），挑战 1~4 已完成；`act bulk` 持续 ≈10 s 节拍。- `[R94 长跑·21:12:32]` 新档约 7 分钟：**30 无限点数**、反物质 5.61e99（坍缩后）、挑战 1~4 已完成、act 29 条（bulk 25/sacrifice 4）、`OREKI_CRUNCH: 8`；会话持续。- `[R94 OREKI_GOAL 定位]` 降级来自 `OrekiSmartStrategy.leaf()`：未接线叶子走 `:l_doom` 分支累加 sUnknown 并返回 NaN（fail-closed），`unknownLeaf=2` 即本次识别有 2 次落到未接线叶子；`drives()` 对 sStage<0 fail-open。下一轮：用 `sLeafNames` 与 `leaf()` 分支做差集列出未接线叶子 → 接线或改早期阶段 JSON 条件；该 Smali 类按 CORE §5 应整类迁 Kotlin（债务）。- `[R94 策略夹具]` `fixture_strategy_semantics.py` **77/77 PASS**（19 阶段/19 叶子/73 子句），数据语义与 Web 源一致 ⇒ `OREKI_GOAL` 降级不是数据错误，而是 `leaf()` 对后期叶子（`celestial.*`/`progress.dilationUnlocked`/`automator.unlocked`）**未接线**导致 NaN fail-closed；`drives()` fail-open 故自动化仍按固定顺序推进。
- `[R94 长跑·21:17:30]` 新档约 12 分钟：**60 无限点数**、反物质 2.65e77、维度提升 (9)、星系 (1)、进度 25.12%、act 58 条（bulk 49/sacrifice 9）。- `[R94 长跑·21:18:07]` 约 13 分钟：**62 无限点数**、反物质 3.70e264（逼近 Break 1.797e308）、维度提升 (32)、星系 (2)、进度 85.83%；act 62 / deny 72 / noop 24。
- `[R94 Web 专项2]` 已派发第二个 Web Agent（不占 Android 构建预算）：目标为「首次无限→首次永恒」的 ID1 峰值窗口（`big-crunch-autobuyer.js:144/170-186` 的 `waitingForId1Peak` 停摆）+ 同阶段下一瓶颈；要求有证据、测试、部署与线上核验。- `[R94 长跑·21:28:31]` 约 23 分钟：**3.20e6 无限点数**、反物质 4.76e221、0 永恒；「打破无限」页提示需自动大坍缩间隔 0.1 s，调度器已在执行 `act crunchInterval` 逐级购买；act 累计 124 条。13 分钟→23 分钟 IP 从 62 涨到 3.2e6（≈5 万倍）。
- `[R94 Web 专项2 · ID1 峰值窗口结论]` `waitingForId1Peak`（`big-crunch-autobuyer.js:144 / 170-186`）窗口**真实存在但不是可安全提速的墙**：HOLD 阈值与 ID1 门槛同源（`DC.E1100`=UNLOCK_REQUIREMENTS[1]、`DC.E8`=BASE_COSTS[1]=ipRequirement，`infinity-dimension.js:41-59/87-102`），而大坍缩会清零当前反物质（`big-crunch.js:159` 只清 thisInfinity.maxAM），所以「暂停坍缩等峰值」是设计必需、不能取消。窗口内的峰值爬升**不由 MOD 节拍决定**：原版自动购买器首次无限后即解锁且默认 active（AU2/AU3），有效间隔 = interval/F（`autobuyer.js:117-118`；10000× 下维度提升 0.4ms、星系 2ms、维度 0.05~0.12ms），并在帧内最多 32 微步里触发（`game.js:989-1004/1220-1229`）；受统一节拍约束的只有 `early`（解锁并买 ID1）与 `eternityReset`（触发首次永恒）两个真动作 ⇒ 该阶段墙钟上界 ≈ 2 拍 + 亚秒～数秒自然爬升，占 180 分钟目标 <0.25%。**未改任何生产代码/数值/门槛**；新增 `scripts/test-r94-id1-peak-window.mjs` **20/20**（阈值同源、HOLD/释放边界、`willInfinity` 拦截、maxAM 连续更新、强制坍缩调用点白名单、微步/有效间隔量化）。证据与推导见 `docs/R94_ID1峰值窗口量化.md`。
- `[R94 Web 专项2 · 教程同步]` 修一处玩家可见失真（本批 R94 Web 改动的未同步项）：附录 F（`apx_automation.body`）第 1/2 章仍写「每帧固定顺序：买计数频率 → 维度提升 → 星系 → 维度」与「每帧处理」，既与已按统一节拍改写的第 1/2 章 `automation` 字段矛盾，也与 `src/game.js:355-380` 的真实顺序、`oreki-smart-executor.js` 默认 10 s 节拍矛盾。已只同步附录 F 两段并 `node scripts/gen_tutorial_module.mjs` 重生成 `.gen.js`（`validate_tutorial` **2189/2189**）；`test-scheduler-beat` 扩到 **22/22**，反向还原旧文案实测 FAIL 3 项。
- `[R94 Web 专项2 · 下一瓶颈]` Web 真正有量级的墙在**开局（首次无限之前）**：此时原版维度/提升/星系购买器尚未解锁，唯一的 `tryOrekiEarlyRoutine` 受 10 s 全局节拍约束。R94 本地 headless 探针 ~159 s 时 maxAM 仅 1e96、维度提升 10、`served.routine=16`（≈每 10 s 一次）；对照 R78 之前的 R45 基线 4.2 s 破无限 ⇒ 开场采购密度比 ID1 窗口大 1~2 个数量级。调整它需要主 Agent/用户裁决「全局节拍 vs 开局例外」，本轮未动生产代码。另：第 4/6/7/8/11 章 `automation` 字段与附录 F 对应段落仍残留「每帧」表述，属同一类文档失真，列入下轮统一核对。
- `[R94 Web 专项2 · 部署]` 源提交 `2e5fe22` 已 push `main`。`python _deploy/deploy_pages.py` 生成部署副本（清单 863 项、import 闭包 PASS、site 变更仅 `src/core/oreki-tutorial-data.gen.js`），Pages 提交 `c2f8f12` 已 push，Actions run **42377575177**（head `c2f8f12`）completed/success。线上 `https://oreki.net/src/core/oreki-tutorial-data.gen.js` 200、237,681 B，去 CRLF 归一化 SHA-256 `0A67D36C978CAB363901784AC03F278CA0ACE30DE1B18F9FFD549BF61E102DB4` 与本轮源 HEAD 一致；本轮未改生产代码，`https://oreki.net/src/game.js` 200、归一化 SHA-256 `BF527E32FEDC8FC306EE778F0F2E1B5E8D91C2F1B9323AA559B1FA1FD6C1FE91` 与 HEAD 一致（线上仍是前批 `29c34ae` 内容）。- `[R94 Web 专项2·结论]` ID1 峰值窗口（`big-crunch-autobuyer.js:138-186`）判定为**设计必需、不可安全提速**：坍缩清零当前反物质，峰值只能靠不坍缩的当前值涨到 1e1100；三个提速候选全部否决；墙钟上界 ≈2 拍+数秒，占 180 分钟目标 <0.25%（Web `docs/R94_ID1峰值窗口量化.md`）。顺带修复教程附录 F 第 1/2 章「每帧固定顺序」失真。
- `[R94 Web 专项2·交付]` `test-r94-id1-peak-window.mjs` 20/20、`test-scheduler-beat` 22/22、R90/R92/R93/R82/early-ipmult 全过、`validate_tutorial` 2189/2189；Web 源 `2e5fe22`/`15adca3`、Pages `c2f8f12`，线上教程数据与 game.js SHA 已核验。
- `[R94 下一目标]` Web 真正的墙在**开局（首次无限前）**：原版购买器未解锁，唯一购买自动化 `tryOrekiEarlyRoutine` 受 10 s 全局节拍约束，R94 探针 ~159 s 仅 maxAM 1e96（served.routine=16），对照 R45 基线 4.2 s 破无限差 1~2 个数量级；是否给开局节拍例外需用户裁决。- `[R94 里程碑·21:36:45]` 约 31 分钟：**打破无限已解锁**（按钮点亮）、2.19e7 无限点数、0 永恒、反物质 3.37e65、act 148 条；首次无限（3m16s）后的第二个关键里程碑。- `[R94 正式发布·21:45]` **Android 3.21 稳定版已发布**：`release/反物质维度.apk` = `C7307BF28587FF9FDB51A930F808A89EB17D98BF4811619007F41F69249958B1`（82,626,033 B），本地+OneDrive+小米云盘三处 SHA 一致；旧 3.20 备份 `release/反物质维度_3.20稳定版_备份_82156a40.apk`（`82156A40…0051`）；签名证书与旧版相同（可原地升级）。门禁：1 次构建 + 14/14 + 17/17 + 57/57 + v2/v3 + 真实运行。
- `[R94 发布已知限制]` ①自动打破无限缺失（需玩家点一次，长跑 ~32 min 观察）；②`OREKI_GOAL stage=-1 degraded=1`（后期叶子未接线，策略退化但 fail-open）；③首次永恒/180 分钟终局未达成。
- `[R94 README 修正]` 删除「候选已复制双网盘」错误表述；`当前稳定发布` = 3.21.0 / 30210000 / `C7307BF2…`。- `[R94 Break 激活·PASS]` **21:28:38**（起点 +23m04s）自动化真实打破无限：`x0-before brake=0` → `x0-after brake=1` + `OREKI_BRK2`；`Player.m()`=`player.brake`、`Player.x0(Z)` 写该字段，由 Kotlin `tryBreakInfinity()` 在 `crunchMaxedInterval` 通过后调用原版 setter + `maxAllIntervalsForFree()`，未人工点击。
- `[R94 新缺陷·P0级]` `OrekiBreakGate.tick()` DEX **VerifyError**：`rp0` vs `yp0` 类型不匹配（旧 Smali 业务类硬编码 3.20 类型），`breakGate` 任务每拍失败（`OREKI_API_MISS: missing invoke tick: VerifyError`），break 商店后续自动化失效；主链未阻塞（`breakUpgrades` Kotlin 路径完成 Break）。修法：按 CORE §5 整类迁 Kotlin，禁止直接补 Smali。
- `[R94 进度·21:46]` 41 分钟：6.82e7 IP、0 永恒、反物质 1.87e80、act 179（sacrifice 73/bulk 72/infinityUpgrades 17/crunchInterval 15/breakUpgrades 1）；ID1 未解锁、首次永恒未达成。
- `[R94 README 修正2]` 已知限制①由「未自动打破」更正为「`OrekiBreakGate` VerifyError（breakGate 失效，Break 已由 breakUpgrades 完成）」。- `[R94 ID1 窗口]` 21:50:46（约 45 分钟）：IP **9.06e7**（逼近 1e8）、0 永恒、反物质 **6.55e281** 单调爬升（HOLD 生效）；距 ID1 的 1e1100 峰值门槛约 e819，按当前加速预计 10~30 分钟；act 累计 196+。
- `[R94 下一轮预备]` 已写 `OrekiBreakGate` Kotlin 迁移设计（711 行/5 方法、ABI 保留、删除 smali、契约检查、单独一轮完成），以及 ID1 窗口观测点。- `[R94 API 缺口清单]` 长跑 50 分钟 logcat 去重：`missing invoke tick: VerifyError` **267 次**（OrekiBreakGate，break 商店自动化失效）；`missing method Currency.o(BigDouble)=purchase on iq0` 1 次（观察）。已验证正常：`idIpRequirement`（ID 类静态字段 `f`，ID1 IP 门槛 1e8）、`iq0.d/w`、`Player.m/x0`、`m01.h/n/i`、`Player.u/A` ⇒ ID1 IP 预留判据有效。
- `[R94 状态·21:55]` IP 在 2.8e7~9.3e7 间随升级购买波动、反物质随坍缩在 e157~e281 重置、act 208；未跨 1e8 → HOLD 未触发 → ID1/首次永恒未达成；属正常爬升，无死锁证据。- `[R94 双端核对]` ID1 IP 预留语义一致：Web `oreki-early-automation.js:183-194` 的 `shouldReserveIpForId1()` 同样要求「IP ≥ ID1.ipRequirement」才预留，`:278-287` 的 `leavesId1Reserve()` 为纯算术预测；Android `OrekiBreakShop.kt:113-120` 逐条对应 ⇒ **不存在移植缺陷**，IP 未过 1e8 属收敛前正常爬升，不构成 P0，不动紧急构建。- `[R94 清理·af1f8d0]` 删除冗余 `prestigeBatch`（实测由原版自动器承担、`m01.h()` 返回 2.0 非 AD8 判据）与全部诊断探针；`OrekiStageAuto.kt`、`OrekiAutomationScheduler.kt`、`check_automation_scheduler.py`（57→52 项）；`build_kotlin.py` RC=0（classes4.dex 2,669,156 B）、契约 52/52。将随下一轮构建进入 APK。- `[R94 清理2·1388b9f]` 删除 VerifyError 的 `OrekiBreakGate` 死类（旧 Smali 引用 3.20 类型 `rp0`，3.21 为 `yp0`，DEX 校验器拒绝；仅自引用；break 商店由 Kotlin `OrekiBreakShop` 承担）⇒ 6 文件 −751 行；`build_kotlin.py` RC=0（classes4.dex 2,668,132 B）、契约 51/51。将随下一轮构建进入 APK，验收点：`OREKI_API_MISS` 归零 + `breakShop` 正常。- `[R94 长跑受阻·关键]` 22:02 起游戏被**原版反作弊冻结**（弹窗原文「系统当前时间早于你上一次游玩的时间 → 游戏将冻结」）：tick 仍在跑（`OREKI_GATE rt` 增长）但数值不动、`act` 停在 227 条。冻结前 IP 已实测 **1.86e8 > 1e8**（ID1 IP 门槛达成，证据：离线弹窗「无限点数 1.85e8 → 1.86e8」）。高度怀疑 MOD ×10000 速度注入把游戏时间增量写回时间戳，使存档"上次游玩时间"远超真实时间。**未通过改系统时间/改存档绕过**；本次长跑记 BLOCKED（非 PASS、非死锁）；修复前不再启动新长跑。- `[R94 更正·关键]` 长跑**并未冻结**：`adb root` 读取存档 `player.json` 增量比对 —— `lastUpdate` +60007 ms、`infinityPoints` 2.41e8→**2.51e8**、存档持续更新 ⇒ 游戏逻辑正常；先前「静止截图」是 `打破无限` 页不显示实时数值 + 弹窗链所致，上一节 BLOCKED 结论**作废**。仍待核实：`brake=false`（Eternity 后原版行为 vs 异常）与 `eternities=11` 的字段语义（EP=0、replicanti 未解锁，矛盾，不据此宣称首次永恒）。
- `[R94 方法]` 长跑观测改用**存档增量**（`player.json` 的 `lastUpdate`/`infinityPoints`），不再依赖静态页面截图。- `[R94 存档核对·22:22]` `player.json` 实测：`bigEternities=0`、`eternityUpgradeBits=0`、`EP=0`、`thisEternity.realTime≈71.8min`（覆盖整轮）⇒ **首次永恒未达成**；`eternities=11` 字段语义矛盾，不采信。ID1 未解锁（本纪 maxAM 1.70e321 ≪ 1e1100）。694 次无限、IP 2.51e8、提升 19、星系 1。
- `[R94 Break 回归·待查]` 21:28:38 曾实测 Break 激活（brake 0→1），当前存档 `brake=false` ⇒ 反物质被钉在 `Number.MAX_VALUE`、坍缩前停摆；全 payload 未发现 `setBrake(false)` 调用点，原因未明，需构建级诊断（记录 brake 变化时刻/调用栈）后修。- `[R94 Break 丢失·静态定位]` 3.21 全树 `Player->brake` 只有 1 个写入点（`x0(Z)` setter），调用者仅 2 处：原版「打破无限」按钮（`MainActivityBreakInfinityKt$loadViewsBreakInfinity$1$1:420`，先判 `m()`+`CrunchAutobuyerState.v()` 再 `x0(true)`）与整局重置 `prestige/f.a():400`；Kotlin 侧只有 `setBrake(true)`，无 `setBrake(false)`。推断：Break 丢失后原版把大坍缩间隔恢复未满 ⇒ `tryBreakInfinity()` 的 `crunchMaxedInterval` 前置不成立 ⇒ **无法自愈**，反物质钉在 MAX_VALUE、IP 缓慢增长。下一轮：①`breakUpgrades` 里先买满间隔再重试 Break（自愈）；②首次检测到 brake true→false 时打印 `OREKI_BREAK_LOST`（含 IP/间隔/时间）定位丢失时刻。- `[R94 生产修复·待构建]` `OrekiStageAuto.kt` 新增 Break 自愈：`breakUpgrades` 内若 `!isBroken()` 且间隔未满 → 先 `upgradeCrunchInterval()` 买满再 `tryBreakInfinity()`；新增 `detectBreakLoss()` 在 true→false 时打印一次 `OREKI_BREAK: break-lost ip= maxed= infinities=`。验证：`build_kotlin.py` RC=0（classes4.dex 2,668,808 B）、契约 51/51。**未构建**（R94 预算已用），随下一轮构建生效。- `[R94 构建预算账本缺陷]` 20:39:51 的 R94 主构建已产出 `c7307bf2…9958B1`，但 `assembleRelease.doLast` 里的 `exec --record-success` **未执行**（账本 mtime 停在 20:30:28，builds=[]、allow=true）⇒ RG02-13 失效。已改为独立 `releaseBudgetRecord` 任务 + `finalizedBy`；**诚实记账：R94 主构建 1/1 已用**，不利用 allow=true 再跑常规构建，只保留一次紧急重建。
- `[R94 首次永恒·UI 实证]` 复制器页显示解锁价 **1e140 IP**（当前 3.0e8，差 e132），`EP=0`、`eternityUpgradeBits=0`、`thisEternity` 覆盖整轮 ⇒ 首次永恒未达成（存档 `eternities=11` 语义仍待查）。- `[R94 Web 改动·5555f3f/b203fb1]` 教程附录 F 6 处「每帧」校正为**共享节拍**表述（`oreki-smart-executor.js:107` 默认 10 秒，真动作 ≥ 间隔）；`gen_tutorial_module.mjs` 生成 18 章/237910 B，`validate_tutorial.mjs` 通过（E4 automation 36 项）；线上 `https://oreki.net/src/core/oreki-tutorial-data.gen.js` 部署后 75 秒核验 **HTTP 200 / SHA a441f25e… / 新措辞命中**。- `[R94 证据修正]` `OREKI_GATE` 的 `brake=` 自首条（13:06:07）到 Break 后（13:28:38 有 `x0-after brake=1`）**始终为 false** ⇒ 该字段绑定不可靠（`b=` 在 Break 后翻转，更接近真实状态）；「Break 丢失」的直接依据改为存档 `brake=false` + 反物质钉在 `Number.MAX_VALUE`。长跑未冻结：`OREKI_BRKUP_ST ip` 8.23e7→1.34e8→2.35e8→**3.37e8**（13:49→14:25）。- `[R94 双端教程同步]` Android 教程由 Web 单源 JSON 生成：`oreki_tutorial_gen.py` 重新生成 25 章/1308 条/49657 汉字/197950 字节，回读逐字一致；产物 `scripts/payload/assets/oreki_tutorial.txt` 差异 27+/16−，命中「共享节拍」「每 10 秒最多一个真动作」「等下一拍重试」⇒ 双端附录 F 一致，随下一轮构建进入 APK。- `[R94 存档键名核实]` `player/i.smali` 依据版本旗标在 `"brake"`/`"break"` 两个键间切换读写，本机存档 `"brake": false` 且读路径同样读 `"brake"` ⇒ **读写一致，brake=false 是真实存档值**；加载链不重置 brake（`f.a()` 调用者仅 `jw3:23`/`f:8513`）⇒ break 丢失只能来自 `x0(false)` 显式调用，来源待 `OREKI_BREAK` 诊断。原版按钮是 **toggle**（`game.js:111`），Kotlin 用 setter `x0(true)` 方向安全。- `[R94 契约测试]` `check_automation_scheduler.py` 新增第 15 组 6 条断言钉住 Break 自愈（crunchIntervalIsMaxed 存在、块内先买满间隔再 tryBreakInfinity、detectBreakLoss 在 crunchProbe 之后、独立 OREKI_BREAK 标签）→ **57 项检查失败 0 项**。- `[R94 硬性结论]` 未 Break 时反物质上限 = `Number.MAX_VALUE`，单次坍缩 IP ≈ `10^(308.25/30−0.7)` ≈ **3.76e9**，全部倍数后约 **1e15** 量级；而复制器需 **1e140 IP**、ID1 需 **1e1100 maxAM** ⇒ **未 Break 时数学上不可达**。故 Break 丢失是 180 分钟目标的**确证 P0 阻断**；当前长跑（IP 3.4e8、694 无限）不可能再产出新里程碑。修复已在源码就绪（`6b90469`+`7ccab34`），只差一次构建 + AVD 验收。- `[R94 长跑终止·FAIL]` 21:05:34→**22:51:30**（1h45m56s），用户裁决 A 结束。终态：IP 3.37e8、694 无限、反物质钉 `1.7976931e308`、`brake=false`、EP 0、无 ID1/无永恒。**判定 FAIL：Break 未自动重新激活导致无法通关，不记为 180 分钟成功。** 证据：`reports/r94-avd/80-final-stop.png`、`player-final-stop-20261107-225130.json`、`playerBackup-…json`、`logcat-full-run-….txt`（6.5 MB）。- `[R94 紧急重建交付]` 23:10:31 完成（10m54s），新 APK **`b513be9b8d58e68ae1255739d782a45a7ac4c4ea1388dc5eab0832a8a06cc833`**（82,621,937 B）；`verify_release` **14/14**（`OREKI_BASE=work/base_decoded_321`）、`verify_patch_contract` 17/17、`check_automation_scheduler` 57/57、签名一致；已交付 `release/` + OneDrive + 小米云盘（三处 SHA 一致），旧稳定版备份为 `反物质维度_3.21初版_备份_c7307bf2.apk`。R94 实跑 2 次完整构建（20:39 + 23:10），首次未记账（已修），本次按用户裁决作 RG02-12 紧急重建。
- `[R94 新长跑]` 全新存档起点 **23:18:18**（安装 23:17:32、`pm clear`、`init 已启用·间隔10秒`、`EARLY applied`；`logcat -c` 后 20 秒 VerifyError **0 条**）。- `[R94 教程同步]` 第 5 章补充「间隔已满自动按原版同序激活 Break；被清回未打破则下一拍重买间隔再激活」；Web `b64fdde` + Pages `6e72da5`，线上 238,229 B / SHA `45174749…` 与本地一致、新措辞命中；Android assets 由同源重生（1308 条逐字一致）。
- `[R94 新长跑·23:23]` 起点 23:18:18；23:23 已 22 条 act、3 次无限、IP 6、反物质 1.86e177、提升 25、星系 1；`OREKI_API_MISS`/`VerifyError` 0 条；Break 预计 ~23:41 自动触发。