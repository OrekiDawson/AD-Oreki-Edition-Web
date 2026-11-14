# DeepSeek / Agent 与 GitHub main、CI/CD 同步协作规范

> 生效日期：2026-11-14（UTC+8）。本文件是仓库 `AGENTS.md` 与 `docs/DELIVERY_RULES.md` 的补充，不替代现有 DeepSeek 高峰全员停工、上游基线冻结、Kotlin/Playwright/AGP、PR/Required Checks、真实验收与发布规则。仅规范 MOD 开发仓库的 Git 同步；**不授权自动追踪或合并上游原版**。

## 1. 角色与唯一基线

- `origin/main` 是本仓库 MOD **正式已合并代码**的共同基线；开发分支可以领先，但未合并内容不得称为 `main` 或已发布版本。Android、Web 各自维护独立 `main`，不得互相替代源代码、构建与运行证据。
- DeepSeek Lead / 其他开发 Agent 负责安全同步、修改、提交、PR 与冲突协调；GitHub Actions 负责执行受控的源码检查、测试和构建/发布门禁。**CI/CD 不自动将远程 `main` 拉回 Agent 的本地工作区。**
- `main` 不等于原版上游分支；不得借“同步 main”自动升级或替换已冻结的游戏原版基线。

## 2. 每次开发前

1. 检查仓库与工作树：`git status --short --branch`、`git branch --show-current`、`git worktree list`。确认当前任务所属的仓库、分支、工作树与其他 Agent 是否存在共享文件。
2. 执行 `git fetch origin --prune`，记录 `git rev-parse origin/main` 与当前 `git rev-parse HEAD`。检查 `git log --oneline --left-right HEAD...origin/main`，识别领先、落后或分歧。
3. **干净工作树**按当前分支政策以快进、合并或变基安全同步；**非干净工作树**先保护未提交与未跟踪文件，必要时在独立工作树/临时分支保存，再同步。不得擅自重置、删除、覆盖他人工作；不能安全同步时明确报告 `BLOCKED` 与原因，转做不冲突任务。
4. 多 Agent 并行开发使用独立分支与工作树，协调同一文件的所有权。遵循本仓既有 worktree 映射及共享构建、AVD、Pages 部署资源的隔离规则。

## 3. 提交、PR 与主干同步

- 关键提交前及每次 Push/PR 合并前重新 `git fetch origin`，检查 `origin/main` 与目标分支是否有新提交。远程变化时合并或变基并处理冲突；若多人共享同一分支，不得擅自改写已公布历史。
- 高风险、CI/CD、构建/部署与未过门禁改动使用 PR；保留仓库允许的普通变更提交流程，但**不得通过直接推送绕过必需 CI/Ruleset**。
- 禁止 `git push --force`、未经明确授权的 `git reset --hard` 或 `git clean -fd` 等破坏性操作；禁止关闭 Ruleset、跳过检查或将冲突视作自动解决。
- PR 合并只能在所要求的检查通过且符合当前仓库保护规则后进行。PR 通过不等于主干新提交、最终构建或真实运行验收已通过；合并后核对目标 `main` SHA。

## 4. CI/CD 的准确性与发布边界

- 流水线应记录触发事件、仓库、分支、`github.sha`、构建产物及所测试的确切 Git SHA；不得把某个旧提交的绿灯当作新提交的验收。
- 正式构建/签名/独立验签/验收/发布遵守既有 CI/CD 门禁；CI/CD 产物必须与拟发布的源提交、版本和 SHA-256 对应。PR 绿灯、源码静态 PASS 不可冒充 APK/AVD 或 Playwright/生产部署 PASS。
- 默认禁止工作流直接修改业务代码并回写 `main`。确需自动提交必须另经授权，并设计防循环触发、冲突与权限隔离；工作流产出的发布记录也不代表 Agent 工作树已同步。
- Android 发布仍要求同一 APK 经 GitHub Releases、OneDrive、Google Drive 与本地 SFTP 四渠道校验一致；Web 部署仍遵守独立移动浏览器/Pages 发布门禁。不得借同步规则触发未经请求的构建、签名或部署。
- 任何流程故障都应修复门禁或如实记为 `FAIL/BLOCKED/NOT RUN`；不得用手工上线绕开既有保护。

## 5. 当前轮次与交付记录

- 本规则不新开 `/goal`、不重置计时、不变更现有任务编号；不得为了同步仓库而覆盖任何未完成 P0/P1 修复或现有证据。
- 每轮交付至少报告：仓库与工作分支；开发起点 `origin/main` SHA；最终提交 SHA；合并后 `main` SHA（如有）；领先/落后/冲突状态；实际 CI Run 及 `PASS/FAIL/BLOCKED/NOT RUN`；发布渠道与产物 SHA-256（如有）；未完成项。
- **优先级**：安全、用户明确暂停与现有 DeepSeek 高峰全员停工规则 > 必需 CI/CD 与真实发布门禁 > 开发同步和交付节奏。本文件不覆盖仓库其它更严格且有效的限制。

## 6. 最小执行核对

```bash
git status --short --branch
git fetch origin --prune
git rev-parse HEAD
git rev-parse origin/main
git log --oneline --left-right HEAD...origin/main
```

核查后由 Agent 根据是否存在未提交文件、是否共享分支、仓库保护规则决定安全同步方式；**不要机械执行会丢失修改的重置或自动合并命令**。
