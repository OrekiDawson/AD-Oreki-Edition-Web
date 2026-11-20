# R121-01：Kody 自动触发事件记录

## 事实

- 创建 Web PR #93 后，现有 `.github/workflows/kody-trigger.yml`
  对非 Draft 的同仓 PR 自动运行 `node .github/kody/trigger.mjs`。
- 该工作流没有读取“Kody 付费审查暂停”的现行门禁状态。
- `Kody Code Review` 外部检查因此被启动并在约 4 分 58 秒后完成。
- 本地未主动调用 Kody，也未配置或切换 Kody Provider。

## 处置

- 立即关闭 PR #93，保留已推送分支与证据，不依据该检查合并或部署。
- 通过 GitHub API 将 Web 与 Android 仓库的 `kody-trigger.yml` 工作流状态
  改为 `disabled_manually`，阻止后续 PR 重复触发。
- R121-01 的合并依据继续使用 CI、实际运行证据与独立定向复核，不使用
  `Kody Code Review` 的完成状态。

## 待办

- 费用归属和实际扣费只能在 Kody 平台账单侧核验；当前 API 与仓库证据均
  无法证明为 `¥0`，不得写成“未产生费用”。
- 后续 CI 清理应在不重新启用 Kody 的前提下，把暂停状态固化到工作流
  条件中，并通过 Draft PR 或规则变更评审。
