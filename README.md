# `web/_tools` — 验证工具与实测报告

本目录是一个**独立的 git 仓库**，以孤儿分支 `verify-tools` 推送到
`https://github.com/OrekiDawson/AD-Oreki-Edition-Web.git`。

## 为什么单独建仓库

本目录不在 `web/AD-Oreki-Edition` 里面，所以 2026-10-31 之前它**不在任何版本控制之下**。
后果不是「报告提交不了」这么轻——是**每一条「已实测」都缺了「哪个脚本、哪一版」这一环**。

具体丢过一次：R40-A5 记录「真实新档 783.1 s、`isGameEnd = true`」，
但产出这个数字的跑分脚本事后无法追踪——它从来没被版本控制过，只能靠文件名在磁盘上翻。

> 规则：**报告里的每个数字，都要能追到「哪个脚本、哪个 commit」。**
> 追不到的数字，下一轮必须重跑，不能引用。

## 只版本化脚本和报告

本目录 137 MB，其中 `.mjs` + `.md` 只有 2.4 MB。其余是 jsonl 采样、日志、截图、`node_modules`。

- **进库**：`.mjs`（跑分/探针/验收）、`.md`（报告）、`.py`（辅助）、`lib/`
- **不进库**：`*.jsonl`、`*.log`、`*.stdout`、`*.out`、`shots*/`、`node_modules/`、`__pycache__/`

jsonl 是可以重跑出来的；报告不能。

## 怎么用

```bash
cd "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_tools"
git add _r40/你的新脚本.mjs
git add _r40/你的报告.md
git commit -m "R41 xxx：一句话结论"
git push            # 已 set-upstream 到 origin/verify-tools
```

**只 `git add` 你这一轮新建/修改的文件，不要 `git add -A`。** 别人可能正有未验的半成品在目录里。

## 报告里怎么引用

写 `_tools@<短 hash>`，例如 `_tools@9ec9bcd`。这样一年后还能 checkout 出当时的脚本。

## 目录约定

| 目录 | 内容 |
|---|---|
| `_r40/` | R40 系列（佩勒、终端、教程、执行层）的报告与探针 |
| `_r39b/` | R39 系列长跑与佩勒诊断 |
| `lib/` | 共用模块（`edge-launch.mjs` 提供 `launchBrowser` / `openGame`） |
| `_encoding-incident-20261027/` | 一次编码事故的历史快照，**只读，别改** |

## 采样口径（硬规则）

同一个代码、同一份存档，**采样强度能改变结论**：

| 跑法 | 20 现实 | 100 现实 | 通关 |
|---|---|---|---|
| `pelle-probe` 基线 | 227.1 s | 639.1 s | 708.1 s |
| 轻采样 | 230.0 s | 687.4 s | 769 s |
| 重采样（每帧 `evaluate()` + 两次 `querySelectorAll`） | 261.7 s | 876.5 s | 未达 |

重采样会让帧率下降 → 「每帧只 tick 一次」的自动购买器触发次数下降 → 整体慢 10~35%。
**比教程有没有开着的影响大一个量级。**

⇒ **任何「多少秒通关」的数字，必须注明采样方式，基线一律用 `pelle-probe` 的采样强度。
每帧调 `evaluate()` 的重采样脚本不得用于产出通关时间。**
