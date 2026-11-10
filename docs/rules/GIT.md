# Git、共享文件与工作区保护
权威：本文件；范围：所有仓库；来源：§2、§15、§52、§74、§77.13；状态：生效。

- 开工核实各实际仓库分支、HEAD、远端、未提交/暂存修改及远端差异；frame-observer 地址从实际配置读取。Android/Web/辅助仓库独立管理，无实际修改不造空提交。
- 禁止 force push、reset --hard、清理工作区、丢弃已有修改、覆盖远端历史。先审 staged diff，仅暂存本轮文件，禁止盲目 git add -A；简体中文 subject/body，正常 push，先检查远端分叉。权限或冲突受阻保留成果并报告。
- 并行工作使用独立 Git index/worktree 与明确文件责任方；不自动合并其他任务成果。已有授权内的代码保存不必等全部验收；提交不等于发布。
- 共享规则修改前查所有实际路径、文件 ID/inode、nlink、Git 跟踪状态、使用方与 SHA-256；采用保链原位编辑，不删除重建或临时替换。修改后复查 ID、链接数与哈希。
- 独立 clone 必须有仓库内完整可读规则。共享规则的两仓分发视为同一权威发布的镜像，不能单边立规；隔离审查阶段不重建或更改运行中工作区硬链接。
- 任务编号由 ChatGPT 在用户授权的任务 Prompt 中明确指定，用户本人可直接指定或覆盖；Codex、DeepSeek Harness、WorkBuddy 与其他执行 Agent 必须使用既定编号，不得自行新增、重排、删除、复用编号、擅造变体或更改历史提交标识。遇到冲突保持原编号并报告，不得为整理美观而追溯修改。

## LF-only 换行符长期规则（2026-11-10 R99 用户补充，长期有效，**本节是换行符规范的唯一源**）

AD-Oreki-Edition 全项目（Android、Web、frame-observer、GitHub Pages、共享规则与文档、
构建/测试脚本与配置、以及未来新增文本文件）一律遵守以下十条：

1. 所有受控文本文件采用 **UTF-8（无 BOM）+ LF（`\n`）**。
2. Windows、Linux、CI 的**检出与提交**均不得引入 CRLF。
3. **存量 CRLF 必须清理**，不得只规范新文件。
4. **新文件必须符合 LF-only**。
5. **二进制文件不得进行文本换行转换**（APK、DEX、JAR、图片、压缩包、字体等）。
6. **共享硬链接不得被转换工具拆开**；必须核对 inode / 设备号 / nlink，采用原位写入。
7. **默认禁止无依据的 CRLF 例外**。
8. 外部协议确需 CRLF 时，**必须记录证据、范围和验证方式**。
9. **换行符迁移不改变程序业务语义**。
10. **后续 Agent 修改文件时必须维持 LF-only**。

配套：`.gitattributes` 由 `* text=auto` 起头，按扩展名声明 `text eol=lf`，并**保留**
`docs/AGENTS_GLOBAL.md`、`docs/SHARED_GAMEPLAY_STANDARD.md`、`docs/FACTS.md` 等
共享硬链接的 `-text` 保护（`-text` 规则必须排在按扩展名规则之后才生效）。
`.editorconfig` 统一声明 `charset = utf-8`、`end_of_line = lf`、`insert_final_newline = true`。
仓库级建议 `core.autocrlf=input`、`core.eol=lf`；不擅自覆盖用户全局设置。
纯换行修改必须单独归类、独立提交，不与业务改动混杂。
