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

### 六、由此产生的排期变更（结论未变，但理由换了）

佩勒破无限循环**暂缓**，Android 先做前中期**能力逐项核对**（不是「补」——补什么还没确定）。
理由不是「Android 落后」，而是：Android 若走不到佩勒门口，打通最后一道门没有意义；
而走到哪一步、卡在哪个机制，现在**只有猜测没有证据**。

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

本次跑的 `brk` 变化**4 次**，不止末日那一次：

| t | brk | 阶段 | 判定 |
|---|---|---|---|
| 0.1 → 4.1 | false→true | idle | **自动买 Break Infinity 升级**（`ivl 150000→100`、`bcUnl false→true`） |
| 4.1 → 68.1 | true→false | idle | 永恒重置 |
| 68.1 → 72.1 | false→true | idle | 再次买到（`ipL=25.7`、`ivl=100`） |
| 72.1 → 662.2 | true→false | wait-remnants | 末日（现实重置清 break） |
| 662.2 → 706.1 | false→true | broken | **这一次才是 `finishProcessReality` 置真**（C.31） |

⇒ 正确表述：**早期靠买升级，末日路径靠 `finishProcessReality` 置真。**
此前「`break` 只能由 `finishProcessReality` 置真」是过度概括，会让 Android 侧误以为
break 只能从末日拿到，从而漏掉「间隔拉满后应该自动买 break」这一步。

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

### 七、本条的未知项

- 是否**全程 10000×**、中途有无调倍率：jsonl 里 `ticksPsL` 抖动过大（0 → 243 → 36），
  **无法从数据判定**，待 agent-a 确认。若中途调速，本条应改写为「非恒速跑」。
- 只有 1 次成功样本，前置段方差未知（另一次同链路跑是 783.1 s，差 75 s）。
