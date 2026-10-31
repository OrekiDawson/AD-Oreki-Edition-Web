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
| 字号三档 | **Web 无此功能**，按 `docs/TUTORIAL_SCHEMA.md`「双端渲染差异」表 Web 侧就是固定字号；实测 `.c-oreki-tut__text` 恒为 `12.5px`，页面内不存在任何字号控件，CSS 变量 `--oreki-tut-font-scale` 为空 | `items.font` |

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

- 小/中 = 222 / 261 = **0.851**，与源码系数 **0.85** 对得上（`TutorialActivity.smali:1709` 注释「小 0.85 / 中 1.0 / 大 1.2」）。
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
