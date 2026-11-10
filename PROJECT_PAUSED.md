# PROJECT PAUSED — AD-Oreki-Edition-Web

- 暂停日期：2026-11-11（Asia/Hong_Kong）
- 项目状态：PAUSED（主动暂停开发；不是完成，也不是稳定发布）
- 当前轮次：R101（未宣称完成）
- 封存前 HEAD：6a61f1281d4af7a5f8f003b4f50ee1381893b7c0
- 封存提交：本文件所在提交（`chore: 封存当前开发成果，暂停项目开发`）
- 分支 / 远程：main → <https://github.com/OrekiDawson/AD-Oreki-Edition-Web.git>

## 当前开发状态

- Web 保留现有独立上游基线，不跟随 Android 版本号冒充同源验证。
- 工作区中的统一规则同步（AGENTS_GLOBAL、CORE、DETAIL_*、RULES_INDEX、README）已随本封存提交保存；旧规则正文仍在 Git 历史与 `docs/rules/archive/` 中，本次未继续重构规则。
- 现有 AGENTS、FACTS、tasks、RULES_INDEX、历史报告与测试证据全部保留。
- 在线站点由独立的 `OrekiDawson.github.io` 仓库部署，本仓库不是部署源。

## 已知阻碍（未验收）

- P0：MOD 存档导入原版后出现异常永恒次数，尚未解决。
- 后期真实通关与 180 分钟真实墙钟目标尚未完成最终验收。
- 性能验收保留历史测量与现行标准，不伪造 PASS。

## 重要本地资产（不强行入 Git，保留在原位置）

| 资产 | 路径 | 说明 |
| --- | --- | --- |
| Web 源码 | `web/AD-Oreki-Edition/` | 本仓库 |
| 存档入口 | `savestates/` | 只有 README 与 manifest 入库；用户真实存档不入库 |
| 私人存档分析 | `web/_saves/` | `analysis.json`、`inventory.json`、`profile.json`、`time_records.json` 等，含个人数据，禁止公开 |
| 部署工具 | `web/_deploy/` | `deploy_pages.py`、`filelist.txt`、`site/` 部署副本 |
| 辅助工具工作副本 | `web/_tools/` | 同一 Web 远程的 `verify-tools` 分支，含未提交脚本与证据，原样保留 |
| 旧 Windows worktree 元数据 | `web/_wt_head/`、`web/_wt_deploy/` | 指针指向 Windows 路径，已不可用；保留不清理 |
| 运行环境 | Node.js v26.13.0 | `node serve.mjs 8080` 启动本地服务器 |

## 未来恢复方式

1. `git checkout main && git pull --ff-only`
2. 先读 `README.md`、`docs/RULES_INDEX.md`、`docs/FACTS.md`，再决定是否恢复 R101。
3. 本地运行：`node serve.mjs 8080`，打开 `http://127.0.0.1:8080`。
4. 恢复开发时重新设计极简开发规则；现有规则与历史记录原样保留。
5. 部署前先同步到 `OrekiDawson.github.io` 仓库并按该仓库流程验证；不要把本站源码直接当作部署副本。
6. 未完成的 P0 与 180 分钟真实墙钟、性能门禁必须重新立项验收。
