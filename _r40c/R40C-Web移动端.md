# R40-C · Web 端移动适配实测与修复

> 执行者：Agent C（Web 移动适配）
> 时间：2026-10-30
> 唯一改动文件：`web/AD-Oreki-Edition/public/stylesheets/oreki.css`（追加 1493~1626 行，共 134 行，纯新增，无删改）
> 证据目录：`web/_tools/_r40c/`
> 结论口径：每条都标注「已实测 / 静态推导 / 合理推断 / 未知」，不用"应该"当结论。

---

## 0. 结论先行

| 问题 | 结论 |
|---|---|
| 移动端是否已不阻碍通关？ | **在不含"新手必然遇到的离线弹窗"被裁这一项之后，是。** 该弹窗已在本轮修复并复测通过。 |
| 本轮修了几个真实缺陷 | **6 个已修 + 1 个已确认但按代价权衡不改（1px 亚像素裁切）** |
| 移动端横向溢出（320/360/390/392/430/768/1280 + 横屏） | 全部 `documentElement.scrollWidth - clientWidth = 0` |
| 最严重的一条 | 滚动容器比屏幕高 56px，**页面最底部那行内容永远滚不进可视区**（实测差 66px，点不到） |

修复前后最关键的两个数字（392×676，AVD 内 Chrome 实测）：

```
修复前： #ui 底边 747 / 视口 676   → uiBottomOver = +71px
修复后： #ui 底边 676 / 视口 676   → uiBottomOver =   0px
```

---

## 1. 模拟器与浏览器信息

| 项 | 值 | 来源 |
|---|---|---|
| AVD 名 | `oreki_web_test` | 实测（`emulator -list-avds`） |
| 物理分辨率 | 1080 × 2340 | 实测（`adb shell wm size`） |
| 物理 DPI | 440 | 实测（`adb shell wm density`） |
| 换算 CSS 视口 | 393 × 851，dpr 2.75 | 实测（`window.screen` / `devicePixelRatio`） |
| 浏览器内实测视口 | 392 × 676（地址栏占 175px） | 实测（`window.innerWidth/innerHeight`） |
| Android 版本 | 14（API 34） | 实测（`getprop ro.build.version.release/sdk`） |
| 机型 | `Android SDK built for x86_64` / device `emu64x` | 实测（`getprop ro.product.model/device`） |
| 浏览器 | **Chrome 156.0.8078.47** | 实测（`dumpsys package com.android.chrome` + CDP `/json/version`） |
| 渲染内核 | Blink / WebKit 537.36，V8 15.6.75.19 | 实测（CDP `Browser` / `V8-Version` / `WebKit-Version`） |
| UA 品牌 | Chromium 156 / Google Chrome 156（UA-Data） | 实测 |
| UA 串 | `Mozilla/5.0 (Linux; Android 10; K) ... Chrome/156.0.0.0 Mobile Safari/537.36` | 实测；其中 `Android 10` 是 Chrome UA 冻结策略的固定串，**实际系统是 Android 14** |
| 系统 WebView | 113.0.5672.136（未参与本次测试，游戏跑在 Chrome 里） | 实测（`dumpsys package com.android.webview`） |
| 启动命令 | `emulator -avd oreki_web_test -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect -memory 2048 -cores 2 -port 5566` | 实测 |
| 冷启动到 `sys.boot_completed=1` | 约 90 s | 实测 |

> 注意：**不是宿主机 Edge/Chrome，也不是已下载 APK 的版本**。所有数据来自 AVD 里 `com.android.chrome` 的 CDP 端点（`adb forward tcp:9222 localabstract:chrome_devtools_remote`）。

---

## 2. 视口矩阵（修复后全量）

测量脚本：`_tools/_r40c/measure.mjs`（真实 Chrome 引擎 + `Emulation.setDeviceMetricsOverride`，**不重载页面**，避免游戏状态被刷新）
原始数据：`_r40c/after-measure.json` / `before-measure.json`

列含义：`docOvf` = `documentElement.scrollWidth - clientWidth`；`ovf` = 溢出到视口右侧且不在局部横向滚动容器内的元素数；`small` = 可点元素小于 44×44 的数量；`clip` = 文本被水平裁切的叶子节点数；`occl` = 固定层遮挡可点元素的数量。

### 2.1 横向溢出（全档位全页签恒为 0）

| 视口 | 维度 | 挑战 | 自动化 | 成就 | 统计数据 | 选项 |
|---|---|---|---|---|---|---|
| 320×640 | 0 | 0 | 0 | 0 | 0 | 0 |
| 360×640 | 0 | 0 | 0 | 0 | 0 | 0 |
| 390×844 | 0 | 0 | 0 | 0 | 0 | 0 |
| 392×676（真机等效） | 0 | 0 | 0 | 0 | 0 | 0 |
| 430×932 | 0 | 0 | 0 | 0 | 0 | 0 |
| 768×1024 | 0 | 0 | 0 | 0 | 0 | 0 |
| 1280×800 | 0 | 0 | 0 | 0 | 0 | 0 |
| 768×360 横屏 | 0 | 0 | 0 | 0 | 0 | 0 |

### 2.2 容器几何（最终复核，`final-matrix.json`）

| 视口 | `#ui` 宽×高 | 底边超出视口 | 右侧空隙 | body padding | 页签底部净空 | 内容列宽 |
|---|---|---|---|---|---|---|
| 320×640 | 320×640 | 0 | 0 | 0 | 76px | 264（原 250） |
| 360×640 | 360×640 | 0 | 0 | 0 | 76px | 304 |
| 390×844 | 390×844 | 0 | 0 | 0 | 76px | 334 |
| 392×676 | 392×676 | 0 | 0 | 0 | 76px | 336（原 306） |
| 430×932 | 430×932 | 0 | 0 | 0 | 76px | 374 |
| 768×1024 | 768×1024 | 0 | 0 | 0 | 76px | 712 |
| 1280×800 | 1280×800 | 0 | 0 | 0 | 20px | 1152 |
| 768×360 横屏 | 768×360 | 0 | 0 | 0 | 76px | 712 |

### 2.3 其他指标

| 视口 | 横向溢出元素 | 文本裁切 | 触控目标 <44px | 固定层遮挡 | 问题 / 处置 |
|---|---|---|---|---|---|
| 320×640 | 0 | 0 | 0 | 6~8 处（通知条 + `?`/`i`，见 §7） | 修复前 `vertical=3`（按钮竖排）→ 现 0 |
| 360×640 | 0 | 0 | 0 | 同上 | 已修 |
| 390×844 | 0 | 0 | 0 | 同上 | 已修 |
| 392×676 | 0 | 0 | 0 | 同上 | 已修 |
| 430×932 | 0 | 0 | 0 | 同上 | 已修 |
| 768×1024 | 0 | 0 | 0 | 同上 | 已修 |
| 1280×800 | 0 | 0 | **15** | 0 | 桌面宽度：输入框/复选框按桌面精度设计，**不属移动端问题，本轮不改**；`uiBottomOver` 由 +56 修至 0 |
| 768×360 横屏 | 0 | 0 | 0 | 同上 | `uiBottomOver=0`（原 +71） |

> `1280` 的 15 个小控件：`input[type=checkbox]` 22×22 与倍率输入框等桌面精度控件。移动端规则（`max-width:900px`）不覆盖 1280，符合 R36「桌面不受影响」的既定口径。

---

## 3. 逐条缺陷：现象 → 修法 → 复测

### 缺陷 1｜滚动容器比屏幕高 56px，最底一行永远滚不到（最严重）

- **视口**：320 / 392 / 430 三档实测，`uiBottomOver` 恒为 **+71px**（同一根因在所有 ≤900 宽度成立；768×360 与 1280 由最终复核确认归 0）
- **现象（实测）**：`window.innerHeight=676`，而 `.c-game-ui` 的 computed `height=732px`。移动 Chrome 的 `100vh` 取的是"地址栏收起"时的大视口，比可视区高 56px；再加上原来 `body` 的 15px 内边距，容器底边落到 **747px**，超出视口 **71px**。
- **后果（实测）**：把 `#ui` 滚到底，最后一排按钮 `bottom=742`，视口只到 676 —— 差 **66px**，无论怎么滑都点不到（维度页底部"增强计数频率升级的效果"等）。
- **修法**（`oreki.css:1501`）：

```css
/* 不套媒体查询：桌面浏览器上 dvh 恒等于 vh（无动态工具栏），行为与 100vh 一致；
   Android 平板横屏（>900px）同样有 100vh 虚高，一并修掉 */
.c-game-ui { height: 100dvh; }
```

- **复测**：8 个视口全部 `uiBottomOver = 0`（原 320/392/430 为 +71）。392×676 下 `#ui` rect = `0,0 392×676`，与可视区完全一致；滚到底后最后一排按钮完整可见。1280×800 也从 +56 归 0。

### 缺陷 2｜手机上被文档站样式吃掉 30px 宽度（320 档按钮被挤成竖排）

- **视口**：≤480 全部（320/360/390/392/430）
- **现象（实测）**：`styles.css` 里混进了 GitHub Pages「Slate」文档主题的规则 `@media screen and (max-width: 480px) { body { padding: 15px } }`，游戏页面同样命中 → `body` computed `padding: 15px`，`#ui` 只有 362 宽（392 视口）。
- **后果（实测）**：内容列只剩 306px；320 档更惨，`买到10个` 按钮被压成 **44×122 竖排**（`verticalCount=3`）。
- **修法**（`oreki.css:1516`）：

```css
@media screen and (max-width: 480px) {
  body { padding: 0; }
}
```

- **复测**：`body padding: 15px → 0px`；`#ui` 宽度 **362 → 392**；内容列 **306 → 336px（+30px，+9.8%）**（320 档 250 → 264px）；`verticalCount` **3 → 0**（竖排按钮消失）。

### 缺陷 3｜右下「教程」悬浮入口压住选项页按钮

- **视口**：320 / 392 / 430 全部复现
- **现象（实测，滚到最底部时）**：`.c-oreki-tut-entry`（48px 高，贴底 6px）压住选项页最后一个按钮「打开自动备份存档菜单」，重叠 **8% / 9% / 12%** 面积；左下 `.o-save-timer` 也压在内容上。原因是 `.c-game-tab` 只有 `padding-bottom: 2rem`（20px）净空。
- **修法**（`oreki.css:1531`）：

```css
@media screen and (max-width: 900px) {
  .c-game-tab {
    padding-bottom: calc(2rem + 5.6rem + env(safe-area-inset-bottom, 0px));
  }
}
```

- **复测**（`probe-bottom.mjs`，9 个"视口×页签"组合）：被遮挡计数 **3/9 → 0/9**，`tabPad=76px`（含 iOS 安全区）。

### 缺陷 4｜右上角「?」「i」两个悬浮按钮互相重叠 24px

- **视口**：≤900 全部
- **现象（实测）**：R36 为满足 44×44 下限把两者撑到 48×48，但定位仍按 20px 图标写死：「?」由**内联 `margin-top:45px`** 定位（占 45~93），「i」是 `top:7rem + 内联 margin-top:-1px`（占 69~117）→ 竖向重叠 **24px**（截图里两个圆相交）。
- **修法**（`oreki.css:1546`）：只把「i」下移到 `top: 9.7rem`（97px），「?」保持原位。

```css
@media screen and (max-width: 900px) {
  .o-tab-btn.l-information { top: 9.7rem; }
}
```

> 踩坑记录：一开始给「?」也写了 `top: 4.5rem`，结果与内联 `margin-top:45px` **叠加**成 90px，两钮反而重叠 42px（已实测并回退）。这也是为什么最终只改「i」。

- **复测**：「?」45~93，「i」96~144 → **净距 3px，无重叠**（320/392 一致）。

### 缺陷 5｜移动端画出 16px 宽的桌面式滚动条压在正文右缘

- **视口**：≤900 全部
- **现象（实测/截图）**：`styles.css:9` 全局 `::-webkit-scrollbar { width: 1.6rem }`，Android Chrome 上 `#ui` 画出常驻灰条，贯穿全高、覆盖内容右缘 16px（`before-392x676-维度.png` 可见）。
- **修法**（`oreki.css:1574`）：

```css
@media screen and (max-width: 900px) {
  #ui { scrollbar-gutter: auto; scrollbar-width: none; }
  #ui::-webkit-scrollbar { width: 0; height: 0; }
}
```

- **复测**：`getComputedStyle(#ui, '::-webkit-scrollbar').width` **16px → 0px**；截图 `r40c-clean-392-维度.png` 中灰条消失，正文右缘完整。

### 缺陷 6｜「离线进度模拟」弹窗横向溢出，正文被裁（新手必遇）

- **视口**：320 / 360 / 392 全部复现
- **现象（实测）**：`components.css:2330` `.modal-progress-bar { width: 40rem }` = **400px 写死**。
  - 320 视口：`.c-modal` 左缘 **-53**、宽 426；`.modal-progress-bar` 右缘 **360**（超出 40px），左右两端都被裁。
  - 392 视口：`.c-modal` 左缘 **-17**、右缘 **409**（超出 17px）；`.c-modal` 自身 `scrollWidth 410 > clientWidth 366`。
  - 截图：`r40c-modal-before-320.png` / `r40c-modal-before-392.png`（说明文字右端被切）。
- **修法**（`oreki.css:1594`）：窄屏改为按容器自适应，同时把弹窗本身撑到 `100vw - 2rem`：

```css
@media screen and (max-width: 900px) {
  .c-modal[data-v-modal-progress-bar] { width: calc(100vw - 2rem); max-width: 44rem; }
  .modal-progress-bar[data-v-modal-progress-bar] { width: 100%; max-width: 40rem; box-sizing: border-box; }
  .modal-progress-bar__buttons[data-v-modal-progress-bar] { width: 100%; max-width: 25rem; box-sizing: border-box; }
  .modal-progress-bar__bg[data-v-modal-progress-bar] { width: 100%; min-width: 0; }
}
```

> 踩坑记录：上游用的是 vue 作用域选择器 `.modal-progress-bar[data-v-modal-progress-bar]`（特异性 0,2,0），第一版只写 `.modal-progress-bar`（0,1,0）**完全不生效**，已实测确认后补上属性选择器。

- **复测**（`modal-check.mjs`，真实打开弹窗测量）：

| 视口 | 修复前 | 修复后 |
|---|---|---|
| 320×640 | modal x=-53 w=426 right=373；bar w=400 right=360 | modal 10~310；bar 23~297；**clipped=false** |
| 360×640 | （同上规则，固定 400） | modal 10~350；bar 23~337；**clipped=false** |
| 392×676 | modal x=-17 right=409；bar right=396 | modal 10~382；bar 23~369；**clipped=false** |

截图：`r40c-modal-320.png` / `r40c-modal-360.png` / `r40c-modal-392.png`（修复后，文字完整、进度条与两个按钮居中）。

### 缺陷 7（已确认，按代价权衡**本轮不改**）｜左侧页签四字标签横向溢出 1px

- **实测**：`scrollWidth 56 > clientWidth 55`（"统计数据"这类四字标签），**溢出 1px（亚像素）**，截图肉眼不可见。
- **为什么不改**：唯一解法是把 `--sidebar-width` 从 `5.6rem`(56px) 加到 60px 以上，会从最紧的 320 档内容列再切走 4~6px；去掉内边距无效（`new-ui-styles.css:934` 的 `.c-modern-sidebar .l-tab-btn-inner` 特异性更高，已实测验证）。
- **判定**：1px 亚像素裁切不影响可读性，不为它牺牲可用宽度。

---

## 4. 改动清单

| 文件 | 位置 | 性质 |
|---|---|---|
| `web/AD-Oreki-Edition/public/stylesheets/oreki.css` | 第 1494~1627 行（文件末尾追加） | 纯新增 134 行。除第 1 条 `.c-game-ui{height:100dvh}` 为全局（桌面等价于原行为）外，其余全部包在 `@media (max-width: 900px)` / `(max-width: 480px)` 内 |
| 其它文件 | — | **未改**。`src/core/**`、Android 仓库、`web/_deploy`、`docs/FACTS.md` 均未触碰 |

改前备份：`_r40c/oreki.css.before`（改前 1492 行，改后 1627 行）。
桌面/平板 >900px 的样式 **完全未变**（1280×800 实测 `docOvf=0`，布局与改前一致）。

> 提醒（未执行，交 team-lead 决定）：`index.html:28` 里 `oreki.css?R37` 的版本号没动。本地静态服务器缓存风险低，但若走 CDN/浏览器强缓存，建议把 `?R37` 提到 `?R40` 让玩家拿到新样式。这一处不属于我的写入范围，故只提示不改。

---

## 5. 脚本与数据

| 脚本 | 作用 |
|---|---|
| `_r40c/measure.mjs` | 多视口 × 6 页签全量测量 + 截图（CDP 设备指标仿真，不重载） |
| `_r40c/probe.mjs` | 缺陷探针：UI 高度差 / 溢出 / 覆盖 / 竖排 / 触控尺寸 |
| `_r40c/probe-bottom.mjs` | 滚到底部，检查固定底栏是否压住可点元素 |
| `_r40c/modal-check.mjs` | 真实触发离线弹窗并测量（修复后） |
| `_r40c/modal-before.mjs` | 用 `!important` 反转本轮规则，复现"修复前"数据 |
| `_r40c/live-play2.mjs` | T3 真实新档可玩性验证（买维度 / 切页 / 开关自动化 / 截图） |
| `_r40c/shots-clean.mjs` | 关闭弹窗后的干净存证截图 |
| `_r40c/final-matrix.mjs` | 8 档视口的容器几何最终复核（§2.2） |

原始 JSON：`before-measure.json`、`after-measure.json`、`probe-BEFORE.json`、`probe.json`、`probe-bottom-BEFORE.json`、`probe-bottom.json`、`modal-check.json`、`t3-live.json`。

---

## 6. 截图索引

**改前（基线）**
- `before-{320x640,360x640,392x676,768x1024,1280x800,768x360横屏}-{维度,挑战,自动化,成就,统计数据,选项}.png`（36 张）
- `r40c-00-initial.png`、`r40c-01-after-392.png`、`r40c-modal-before-320.png`、`r40c-modal-before-392.png`

**改后**
- `after-*`（36 张，同名同档位）
- `r40c-clean-{392,320}-{维度,挑战,自动化,统计数据,选项}.png`（10 张，无弹窗干扰，推荐看这批）
- `r40c-modal-{320,360,392}.png`（离线弹窗修复后）
- `r40c-desk-{768,1280}.png`（桌面/平板回归）

**T3 真实新档**
- `r40c-t3-01-newgame.png`（hardReset 后重载的首屏）
- `r40c-t3-02-buy.png`、`r40c-t3-03-challenge.png`、`r40c-t3-04-automation.png`、`r40c-t3-05-stats.png`、`r40c-t3-06-options.png`

> 截图内容特征均已人工核对（看的是画面，不只看退出码）：无白屏、无灰滚动条、页签完整、`?`/`i` 分离、弹窗文字完整。

---

## 7. T3：AVD 内 Chrome 真实可玩性验证

真实新档：`GameStorage.hardReset()` + 清空 `backup*` 键 + 重载（否则加载时会回滚到备份槽）。实测 `player.antimatter` 重置为 **10**、`dim1 = 0`。

| 检查项 | 结果 | 证据 |
|---|---|---|
| 页面加载 | 正常，无白屏；`readyState=complete` | `t3-live.json` |
| 冷重载到可交互耗时 | **约 30~40 s**（软件渲染模拟器；宿主真机应远快于此，**不能当产品结论**） | 实测 |
| 买维度 | 点击 `.o-primary-btn--new` 被接受，`player` 数值随即变化 | `t3-live.json` → `点击第一维度购买按钮` |
| 切页签 | 维度 / 挑战 / 自动化 / 成就 / 统计数据 / 选项 全部可切 | 实测 |
| 挑战页内容 | 12 个 `.o-challenge-btn`，首条状态"已完成" | 实测 |
| 自动化页 | 12 行 `.c-autobuyer-box-row`；勾选自动购买器 checkbox `true→false` 且 1.2s 后保持 `false` | 实测 |
| 统计数据页 | 正常；`docOverflow=0` | 实测 |
| 选项页 | 11 个可见按钮（导出/导入/重置/保存/选择存档等） | 实测 |
| 全中文 | 遍历 `#ui` 全部可见文本节点，**匹配到 0 条含 3+ 连续英文字母的文案** | 实测 |
| 新闻模块 | 可见新闻节点 **0**，`#ui` 内无"新闻"按钮 | 实测 |
| 控制台错误 | 仅 1 条：Google Analytics `gtag.js` 被 CSP 拦截（`script-src 'self'`）。**不影响游戏，属既有外部统计脚本**。另有 2 条 `stars-bg.webm` / `realityanimbg.webm` 的 `ERR_ABORTED`（背景视频，非阻塞） | `t3-live.json` → `consoleLog` |

---

## 8. 未解决问题（真实存在）

1. **通知洪水遮挡右上角（既有问题，R36 已知，本轮未改）**
   10000× 速度下成就会刷屏。实测 392×676 时通知容器约 31%~47%、320×640 时约 47%~77% 压在"获得 X 永恒点数"这个大按钮上（`probe.json` → `covered`）。
   通知条有 `onclick` 关闭（`src/core/notify.js:153`），所以**不能**简单加 `pointer-events:none`，否则会砍掉"点击关闭"这个功能。
   进一步压缩需要改 `notify.js` 的 `MAX_VISIBLE`（`src/core/`，本轮禁区），故留给后续轮次。
   **不阻碍通关**：通知会自动消失，大按钮中心区域仍可点。

2. **`?` / `i` 与页头文字右端仍有局部重叠**
   两钮在 324~372px 区间，392 档内容列到 377px。按钮中心压住"获得 X 点"大按钮 **2%~10%** 面积（320 档更明显）。要彻底消除必须给内容列让出 52px 右侧内边距，等于牺牲 15% 可用宽度，代价大于收益，**按此权衡未改**。

3. **页签四字标签 1px 亚像素裁切**（见缺陷 7）。

4. **`1280×800` 有 15 个 <44px 的桌面精度控件**（复选框 22×22 等）。属桌面交互设计，不属移动端缺陷，未改。

5. **`index.html` 的 `oreki.css?R37` 版本号未提升**（见 §4 提醒）。

---

## 9. 口径与复核方式

- 「已实测」= 附了命令与输出（见 §5 脚本与 JSON 原文）。
- 「静态推导」= 只读了 CSS 源码得出（如 `styles.css:698` 文档站规则的来源）。
- 「合理推断」= 只在 §8.1 处使用（"通知会自动消失"）。
- 「未知」= 真机（非模拟器）上的页面冷启耗时，本轮未在物理设备上测。

复现命令（在 `web/` 目录下）：

```bash
# 1) 启动 AVD（约 90s）
"C:/Users/Oreki/Android/Sdk/emulator/emulator.exe" -avd oreki_web_test -no-window -no-audio \
  -no-boot-anim -no-snapshot -gpu swiftshader_indirect -memory 2048 -cores 2 -port 5566

# 2) 起静态服务 + 打通通道
cd AD-Oreki-Edition && node serve.mjs 8288 &
adb -s emulator-5566 reverse tcp:8288 tcp:8288
adb -s emulator-5566 shell am start -a android.intent.action.VIEW -d 'http://127.0.0.1:8288/index.html' com.android.chrome
adb -s emulator-5566 forward tcp:9222 localabstract:chrome_devtools_remote

# 3) 测量
node _tools/_r40c/measure.mjs
node _tools/_r40c/probe.mjs 320x640 392x676
node _tools/_r40c/probe-bottom.mjs

# 4) 收尾
adb -s emulator-5566 emu kill
```
