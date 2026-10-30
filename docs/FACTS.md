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

### F.2 窄屏三个已修缺陷（2026-10-30，修复集中在 `public/stylesheets/oreki.css` 的 `@media (max-width:620px)`）

| 缺陷 | 根因（文件:行） | 实测（392×676） |
|---|---|---|
| 维度行「倍率向上溢出」 | `new-ui-styles.css:659` 行高写死 `5.5rem` + `components.css:2960` 文本容器写死 `3.5rem`，而 620px 断点已把行改成两行网格 | 行高 55px（内容需 74px），文本顶出行框 **+19px**、行间距 0 → 压到上一行。修后 110px / **−5px** |
| 自动购买器**横向**溢出 | `styles.css:4392` `.c-autobuyer-box-row { width: 96rem }` = **960px** | 行宽 960px、右缘溢出 **+573px**；修后 393px / **+1px** |
| 同页控件偏小 | 无统一触控尺寸：挑战按钮 150×30、子页签 146×25、check 16×16、帮助图标 20×20 | 67 个可点元素中 20 个 <44×44；修后 **剩 1**（checkbox 本体 22×22，可点区域在 44×44 的 label 上） |

**同类控件高度分布（挑战页，修复后）**：44px × 17 / 60px × 1 / 70px × 2。
⇒ 「同页控件高度不一致」**尚未收敛**，是待决策项（见 `AGENTS.md §19` 的相对一致条款）。 `[实测]`

---

## B. 仓库与产物

| 事实 | 值 | 等级 |
|---|---|---|
| 工作区根 | `C:\Users\Oreki\WorkBuddy\AD-Oreki-Unified`（**不是 git 仓库**） | `[实测]` |
| Web 源码 | `web\AD-Oreki-Edition`（分支 master，**无远端**） | `[实测]` |
| Web 部署 | `web\_deploy\site`（main → `https://oreki.net`，GitHub Pages） | `[实测]` |
| Android 源码 | `android\AD_Oreki_Edition_Android`（main，含构建与发布脚本） | `[实测]` |
| 规则文件三处硬链接 | 根 `AGENTS.md` ≡ `web/AD-Oreki-Edition/docs/AGENTS_GLOBAL.md` ≡ `android/AD_Oreki_Edition_Android/docs/AGENTS_GLOBAL.md`（同 inode；改根那一份，用 `scripts/check_agents_sync.py` 校验） | `[实测]` |
| Android 构建入口 | `C:/Users/Oreki/scoop/apps/python/current/python.exe scripts/build_mod.py`（输出 `build/unsigned.apk → build/aligned.apk → release/反物质维度.apk`） | `[读码]` |
| 构建前必做 | 先把当前 `release/反物质维度.apk` 复制到 `build/backup_<阶段>.apk`（`build_sign()` 会先 `unlink` 目标） | `[读码]` |
| **发版坑** | `publish_apk.py` 默认发 `release/`，**不会**自动提升 `build/gradle-stage/` 的候选包；不先 `cp` 就会发出旧包 | `[实测]` |
| 交付顺序 | **Android APK 优先于源码 push**：构建 → AVD 实测 → 双云盘回读 SHA-256 → 才 commit/push | `[实测]` |
| APK 基线 | `com.oreki.antimatterdimensions`，`versionCode 30190000` / `versionName 3.19.0`，证书 SHA-256 `95960bce…3197` | `[读码]` |

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

### C.4 V 卡死的真实链路（R35 定位，最值钱的一条）

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

---

## D. Android 逆向事实（REA / smali）

| 事实 | 值 | 等级 |
|---|---|---|
| R8 混淆映射 | `Effarig` → `celestials/effarig/a`；`V` → `celestials/v/a`；`Currency` 基类 → `ln0`/`ju`；字段 `ln0.w`=IP、`ln0.e`=infinities、`ln0.F`=EP | `[读码]` |
| Dalvik 跳转极性 | `if-eqz` = 值为 0 则跳；`if-nez` = 非 0 则跳；`if-gt A,B` = A>B 则跳。**R33/R34 共四次因写反导致「两条路都拒绝」** | `[实测]` |
| `suspend` 不能进同步 tick | `commitToGameState`（`eternity/studies/e.smali` 的 `b(List,ZZ,Continuation)`）是 suspend；`fp3.D(Z,vh0)` 是普通方法可同步调 | `[读码]` |
| 挑战真正的 start | **不是** `E(Z)Z`（那是「这一关研究还能不能买」），是 `D(Z,Continuation)`（`b.smali:472`，`:983` 是唯一写 `current` 非 0 的地方） | `[读码]` |
| `y()` 语义 | `y() = I() == L()`，即「已满级」返回 1（`b.smali:3834`）—— 写跳转时最容易搞反 | `[读码]` |
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

## G. 仍未知 / 待证

- Android 端 EC 研究自动购买链在真机上是否真的能推进（`OrekiChallengeAuto.tick()` R35 已修正 8 处极性并汇编通过，**装机实测进行中**）。 `[未知]`
- Ra → Laitela → Pelle 全链在 180 分钟内是否物理可达（当前 Ra 只到 20 级需 `3.48e16` 记忆 vs 可产 `6.17e14`，差 56×）。 `[推断]`
- V 的 `realities` 项（200 次，实测 80/200，节奏约 0.175 次/秒）在 `dilatedTime` 打通后能否在剩余预算内自然达标。 `[推断]`
- Web 移动端「教程」弹窗内容与关闭、弹窗文本逐字换行 —— **未验证**。 `[未知]`
- 360px 窄屏下 `.l-reality-button` 右缘被裁 23px —— **已实测存在，未修**（最小修法见
  `handoff/R35-真Chrome验收-2026-10-30.md` §3②）。 `[未知]`

