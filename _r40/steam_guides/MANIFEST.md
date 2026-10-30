# 参照资料索引（写教程正文前先读这里）

本目录放的是**外部参照资料**，不是项目产物。所有文件都是抓取快照，随时可重抓。

## 一、口径：哪个是权威

| 用途 | 用哪个 | 说明 |
|---|---|---|
| **章节顺序 / 该讲哪些机制** | `../ref_guides/wiki_guide.wiki` | fandom 原版 Guide 页原文，106 个标题，写到终局 |
| **中文表述 / 术语怎么叫** | `steam_guide_ad-cn-*.md` | 中文攻略，术语最贴官方汉化 |
| **数值与解锁条件** | **都不行**，回 `src/` 源码 | 攻略是原版的，本项目有大量改动 |
| **译名最终基准** | `../../AD-Oreki-Edition/docs/TUTORIAL_GLOSSARY.md` | 由 APK 官方 zh-rCN 字符串统计得出 |

⚠ **攻略里的数值几乎都过时。** 已知差异（以代码为准）：

| 项 | 攻略写的（原版） | 本项目实际 |
|---|---|---|
| 终局 | 反物质 `ee15.955`（指数 ≈9e15） | 指数 **1000**（`OREKI_PELLE_END_TARGET_EXP`） |
| V 解锁 | 现实 10000 次 / DT 1e320 / 复制器 1e320000 | **60 / 1e30 / 1e20000** |
| IU15 | iU35，1.5e12 | **IU15**，门槛 1e8 |
| 现实解锁 | 1e4000 EP + 前 13 行成就 | 另加 TD8；且 **EC11/EC12 全满可豁免成就项** |
| DS1 | 12900 时间之理 | 引导窗口内 ÷1000 ⇒ **13 时间之理** |

完整对照见 `../R40-分段耗时预算.md` 与 `../R40A4-佩勒诊断.md`。

## 二、文件清单

### 规范命名（优先使用）
`steam_guide_<语言>-<主题>_<指南ID>.md` —— 由 `_fetch.py` 抓取，`_index.json` 记录元数据。

| 文件 | 覆盖阶段 |
|---|---|
| `steam_guide_ad-cn-full-run_3181166341.md` | ①→⑩ 全流程，到 Cel7 + 终局 |
| `steam_guide_ad-cn-pre-reality_2902999812.md` | ①→⑧，细节最全（40 节） |
| `steam_guide_ad-cn-reality-onward_2917210272.md` | ⑧→⑩，含 5 个附录 |
| `steam_guide_ad-cn-pre-reality-supplement_2936619880.md` | ④→⑧，补 2020–22 改动 |
| `steam_guide_ad-cn-p1-from-zero_3817468561.md` | ①→④ |
| `steam_guide_ad-cn-p2-eternity_3817477040.md` | ⑥ |
| `steam_guide_ad-cn-p3-eternity-challenges_3817477410.md` | ⑦ EC |
| `steam_guide_ad-cn-p4-dilation-reality_3817477688.md` | ⑥后半→⑧ |
| `steam_guide_ad-cn-ec-cheatsheet_3817478070.md` | ⑦ EC 顺序 / 研究树 / 用时速查 |
| `steam_guide_ad-en-secret-achievements_2907622156.md` | ⑪ 隐藏成就（30 个） |
| `steam_guide_ad-en-time-theorems_2963610414.md` | ⑥ 时间之理详解 |
| `steam_guide_ad-en-eternity-and-ec-ninjatsu_2909710573.md` | ⑥⑦ 简报 |

### 历史遗留（同一批数据，早期简版提取器产出）
`guide_<ID>.md`（4 个）+ `raw_<ID>.html`（4 个）+ `extract.py`。
与上表前 4 篇**同源**，只是提取器更简单、段落边界略糙。
**新写的内容不要引用这一批**，保留到当前一轮工作结束即可清理。

### 抓取工具
- `_fetch.py`：规范抓取器（含 429 退避、`div.bb_table` 转换）
- `extract.py`：早期简版提取器（仅处理 `subSectionTitle` / `subSectionDesc`）

## 三、抓取注意事项（踩过的坑）

1. **Steam App ID 是 1399720**（不是 1391520，后者 302 到商店首页，看起来像被墙）。
2. App hub 页面有区域限制，**只能直连单篇** `sharedfiles/filedetails/?id=<ID>&l=schinese`。
3. 连续请求会 **429**，必须退避重试；带登录 cookie 更稳。
4. Steam 的表格是 `div.bb_table` 不是 `<table>`，不特殊处理会「一格一行」。
5. 需要代理：`export https_proxy=http://127.0.0.1:7897`。
6. **不要把 cookie 落在仓库里**（已清理过一次 `sc.jar`）。
