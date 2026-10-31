# R42-C 移动端实测报告（Web）

脚本与原始数据都在本目录。本文只写「哪个引擎、哪一档、哪个数字」，不合并口径。

- `avd-chrome-widths.mjs` / `avd-chrome-widths-report.json` —— **AVD Chrome 真引擎**
- `mobile-widths.mjs` / `mobile-widths-report.json` —— **宿主机 Edge 模拟**
- `nav-probe-320.mjs` / `nav-main-probe.mjs` —— 窄屏教程导航几何深查（结论见 §3）

截图落在 `shots_avd/`、`shots/`，两者都在 `.gitignore` 的 `*.png` 规则里，**不入库**，路径为本地绝对/相对路径。

---

## 0. 口径分档（先说清哪一档是什么引擎）

| 宽度 | 引擎 | 设备/环境 | 如何得到 | 是否算「手机宽度结论」 |
|---|---|---|---|---|
| 320 | **Android Chrome 156** | `emulator-5556`（oreki_web_test） | `wm density 540` → `1080/(540/160)=320` | 算 |
| 360 | **Android Chrome 156** | 同上 | `wm density 480` | 算 |
| 390 | **Android Chrome 156** | 同上 | `wm density 443` → 389.9→390 | 算 |
| 430 | **Android Chrome 156** | 同上 | `wm density 402` → 429.9→430 | 算 |
| 845×390 横屏 | **Android Chrome 156** | 同上 | `wm size 2340x1080` 交换物理宽高 | 算 |
| 768 | 宿主机 Edge（HeadlessChrome/156 内核） | Windows，`setViewport` | 桌面引擎 + 视口模拟 | **不算**，仅参考 |
| 1280 | 宿主机 Edge | 同上 | 同上 | **不算**，仅参考 |

- AVD 侧全程只改 `wm density`，没有改物理分辨率（测完 `wm density reset`），也没有动其他档的基线。
- 横屏不用 `settings put system user_rotation`：headless AVD 上 `rotation` 恒 0，改用 `wm size 2340x1080` 交换宽高，测完 `wm size reset`。
- 视口落点：`innerWidth` 精确命中 320 / 360 / 390 / 430 / 845，无 1px 偏差。

---

## 1. AVD Chrome 五档实测（主结论）

| 档 | density | `innerWidth × innerHeight` | DPR | 整页横向溢出 | 溢出元素数 | <44px 可点元素 | 教程底栏到模态边距 | 底栏自身溢出 | 表格撑破自滚容器 | 教程滚到底 |
|---|---|---|---|---|---|---|---|---|---|---|
| 320 | 540 | 320 × 597 | 3.375 | **false** | 0 | **0** | **0px** | false | false | true |
| 360 | 480 | 360 × 630 | 3.0 | false | 0 | 0 | 0px | false | false | true |
| 390 | 443 | 390 × 692 | 2.77 | false | 0 | 0 | 0px | false | false | true |
| 430 | 402 | 430 × 821 | 2.51 | false | 0 | 0 | 0px | false | false | true |
| 横屏 845 | 443 | 845 × 311 | 2.77 | false | 0 | 0 | 0px | false | false | true |

`[已实测]` 五档的 `document.scrollWidth == document.clientWidth`，`overflowCount`（越出视口右沿的可点/块级元素）为 0。

---

## 2. team-lead 指定的三项重点复核

### 2.1 320 宽教程底栏「间隙 0px」在 Android Chrome 下是否依然不溢出

`[已实测]` **不溢出，且几何自洽。** 320 档读数：

```
footer.w = 274   footer.scrollW = 274   footer.clientW = 274   selfOverflow = false
lastRight = 297  modal.right = 297      gapToModalEdge = 0
footerKids:
  上一章        x=23  right=83   w=60  h=48
  回到当前进度  x=90  right=185  w=95  h=48
  5 / 17        x=191 right=230  w=39  h=18
  下一章        x=237 right=297  w=60  h=48
```

`footer.scrollWidth == footer.clientWidth` 说明底栏内部没有生成横向滚动；`lastRight == modal.right` 说明最后一个按钮正好压到模态右内沿而不是越出去。三个按钮高 48px ≥ 44px。

> 这一档在 Edge 模拟下的结论与 AVD Chrome 一致（同样是 `gapToModalEdge=0`、`selfOverflow=false`），两套引擎没有分歧。

### 2.2 表格的自身滚动容器在窄屏下是否仍不撑破整页

`[已实测]` **不撑破。** 每一档都量了正文里的表格块与外层滚动盒：

```
320: tables[].w=270  right=293   scrollBoxW=274  scrollBoxRight=297  overflowsScrollBox=false
360/390/430/845: overflowsScrollBox=false（同上）
pageOverflowWithModal=false（五档全 false）
```

即表格自身与外层滚动盒之间留 4px，没有横向突破；弹窗打开后整页也没有被撑出横向滚动条。

### 2.3 触控目标 ≥44px 这一档，AVD Chrome 与 Edge 模拟是否一致

`[已实测]` **一致：两套引擎在 320/360/390/430 四档的 `smallCount` 都是 0。**

- AVD Chrome：320/360/390/430/845 五档 `smallCount=0`，教程导航内 `navSmall=0`。
- Edge 模拟：320/360/390/430/768 五档 `smallCount=0`；**1280 档有 6 个 <44px 的可点元素**。
  - 这 6 个是桌面布局下的按钮（宽屏不进入 `max-width:900px` 断点，走的是鼠标命中，不是触屏目标），不构成移动端缺陷；但它确实是「七宽度全过」这句话不成立的地方，所以单列。

---

## 3. 新发现：窄屏教程导航降级为横向滚动条，且**不跟随当前章**

### 3.1 现象

`avd_w_320_tut.png` 里，320 宽下教程弹窗左侧看不到章节目录，只有正文。先怀疑是裁切，实测否掉了。

`[已实测]` AVD Chrome 320 档（`nav-probe-320.mjs`，density=540）：

```
layout:  flex-direction: column   gap: 10px
nav:     y=70  h=116.9  dir=row  overflow-x:auto  overflow-y:hidden
         scrollLeft=0   scrollWidth=5135   clientWidth=274   clientHeight=117
按钮数:  25（18 章 + 7 附录），每个高 114px，宽 145~316px
可视带内按钮数: 2  （只有第 0 章、第 1 章）
当前章按钮: idx=13  x=2837.4  →  activeInBand = false
```

### 3.2 成因：这是**写明的降级**，不是裁切

`web/AD-Oreki-Edition/public/stylesheets/oreki.css:659` 起是 `@media screen and (max-width: 900px)`，其中 `:670-686` 明确把导航改成横向滚动：

```css
.c-oreki-tut__nav {
  flex: 0 0 auto;
  flex-direction: row;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 0.3rem;
}
.c-oreki-tut__nav-btn {
  flex: 0 0 auto;
  width: auto;
  white-space: nowrap;
}
```

所以「窄屏没有左侧章节目录」= 设计意图，`docs/TUTORIAL_SCHEMA.md` 里「章节目录：左侧列表」这句在 ≤900px 需要补一条降级说明。

### 3.3 真正的缺陷：横向条停在 scrollLeft=0，不看当前章

`[已实测]` 打开教程时正文停在第 13 章，而导航条可视区里只有第 0、1 章两个按钮；当前章按钮在 x=2837.4，`scrollLeft` 仍是 0。用户看到「正文是天神（一）」，但目录里高亮的按钮在屏幕外 2800px 处。

- 影响：窄屏下无法从目录判断自己在哪一章，也无法点回去，只能靠底部「上一章/下一章」逐个翻。
- 建议修法（一行）：`show()` 之后把导航滚到当前章——
  `nav.scrollLeft = activeBtn.offsetLeft - nav.clientWidth / 2 + activeBtn.offsetWidth / 2`。
- 归属：这是 `OrekiTutorialModal.js` / `oreki.css` 的渲染层，不是我的文件所有权范围，本轮**只报不改**。

### 3.4 附带读数（供排期参考，不判为缺陷）

- 横向条高 116.9px，占 320×597 视口高度的 **19.6%**；每个按钮高 114px，是被多行的章标题撑起来的（`min-height: 3.6rem` + 标题换行）。
- 弹窗主区 `.c-oreki-tut__main` 实测 y=196.9、h=443.5 → 底沿 640.4，而 `.c-oreki-tut__layout` 底沿只到 514.1，**溢出 126.3px**。正文仍在自滚容器内（`scroll.h=261`、`scrollH=4157`，能滚到底），所以**不影响可读性**；但底栏位置是靠 `position` 撑住的，属于「勉强不破」，改导航条高度时要连带复核。

---

## 4. 截图清单（本地路径；`*.png` 未入库）

AVD Chrome（`web/_tools/_r42/shots_avd/`）：

```
avd_w_320.png            avd_w_320_tut.png
avd_w_360.png            avd_w_360_tut.png
avd_w_390.png            avd_w_390_tut.png
avd_w_430.png            avd_w_430_tut.png
avd_w_横屏_845x390.png    avd_w_横屏_845x390_tut.png
nav_probe_320.png        ← 只截弹窗本体，用于看横向导航条
```

Edge 模拟（`web/_tools/_r42/shots/`）：

```
r42_w_320.png  r42_w_320_tut.png
r42_w_360.png  r42_w_360_tut.png
r42_w_390.png  r42_w_390_tut.png
r42_w_430.png  r42_w_430_tut.png
r42_w_768.png  r42_w_768_tut.png
r42_w_1280.png r42_w_1280_tut.png
r42_w_横屏_844x390.png  r42_w_横屏_844x390_tut.png
```

---

## 5. 侧栏/底栏动态显示与新闻（沿用上一轮实测，未变）

`[已实测]`（`tabs-scan.mjs` / `tabs-scan-report.json`）

- 新档：底栏 5 项（维度、自动化、成就、统计数据、选项），不出现未解锁的空页面。
- 解锁后：9 项（维度、自动化、挑战、无限、永恒、现实、成就、统计数据、选项），重名 0、空页 0。
- 新闻条：DOM 节点数 0（Web 关闭新闻）。
- 踩坑记录：点击处理器挂在 `.l-tab-btn-inner` 自己身上（`ModernTabButton.js:54`），点父 `div` 不切页；第一版「10 页正文长度全是 638」就是踩这个坑，已修。

---

## 6. 未做 / 做不到（直说）

- `[未做]` 1280 档的横向溢出**没有**用真机引擎复测——1280 不是手机宽度，team-lead 已同意保持 Edge 结果。
- `[未做]` 真机（物理手机）验证：全程是 AVD。
- `[未做]` Safari / iOS WebView：只有 Android Chrome 与 Chromium 内核 Edge。
- `[未知]` 三段式折叠屏（宽度连续变化时的重排）：没测中间态。
- `[未知]` 系统级“字号放大”（Android 字体缩放 `fontScale`）对教程的影响：本轮只测了游戏内三档字号（那一项在 Android 侧，见教程验收报告）。
