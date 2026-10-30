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
