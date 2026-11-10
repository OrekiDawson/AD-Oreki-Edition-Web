# 规则索引
本索引只登记路由，不另立正文。用户授权优先，其后安全、真实性，再按职责与明确替代关系执行。

| 触发 | 权威正文 | 加载 |
|---|---|---|
| 所有 Agent | [CORE](rules/CORE.md) | 常驻 |
| 派发/接力/独占资源 | [AGENT_WORKFLOW](rules/AGENT_WORKFLOW.md) | 按需 |
| Android 业务/基线/REA | [ANDROID](rules/ANDROID.md) | 按需 |
| Web 逻辑/移动端 | [WEB](rules/WEB.md) | 按需 |
| 构建/签名/发布 | [RELEASE](rules/RELEASE.md) | 按需 |
| R97 快速迭代构建 | [TOOLCHAIN](rules/TOOLCHAIN.md) + [RELEASE](rules/RELEASE.md) | 按需 |
| Git/index/硬链接/编号 | [GIT](rules/GIT.md) | 按需 |
| 安装/环境/资源 | [TOOLCHAIN](rules/TOOLCHAIN.md) | 按需 |
| Linux 优先 / Windows 兼容（R95） | [TOOLCHAIN](rules/TOOLCHAIN.md) | 按需 |
| 教程/UI/文档 | [TUTORIAL](rules/TUTORIAL.md) | 按需 |
| 规则维护 | [GOVERNANCE](rules/GOVERNANCE.md) | 按需 |
| 两套系统的节拍归属（R96 §80） | [AGENTS.md §80](AGENTS.md) | 按需 |
| 智能自动购买器节拍管理（R96 §81，归属=原版购买器） | [AGENTS.md §81](AGENTS.md) | 按需 |
| 双端 UI 实时刷新 / 省电模式（R99 §11） | [docs/长期规则_验证与证据.md §11](docs/长期规则_验证与证据.md) | 按需 |
| 双调度器 Tick 强制 GUI 同步（R99 §12） | [docs/长期规则_验证与证据.md §12](docs/长期规则_验证与证据.md) | 按需 |
| 代理网络与主动搜索（R99 §33.9/§33.10） | [DETAIL_TOOLCHAIN §33.9/§33.10](docs/rules/DETAIL_TOOLCHAIN.md) | 按需 |
| LF-only 换行符（R99 GIT §LF-only） | [docs/rules/GIT.md](docs/rules/GIT.md) | 按需 |

## 迁移对照

| 原编号 | 当前状态及正文 |
|---|---|
| §60 | 单 Agent 模式历史失效；组织规则归 AGENT_WORKFLOW，安全归 GIT/TOOLCHAIN |
| §61、§77.1–6、§79.1–7 | 合并至 AGENT_WORKFLOW，不再分立多个权威 |
| §76 | 长期条款按职责分流；规则初始化限制仅适用于原任务 |
| §79.8 | R91 临时分工只留历史，无未来效力 |
| R97 | 子 Agent 大规模生产开发、明确所有权、动态并行角色与持续接力统一见 AGENT_WORKFLOW；候选构建次数限制废止，正式稳定版资源与门禁仍见 RELEASE |
| R97 | 子 Agent 大规模生产开发、明确所有权、动态并行角色与持续接力统一见 AGENT_WORKFLOW；候选构建次数限制废止，正式稳定版资源与门禁仍见 RELEASE |
| §77.15 | WinGet 顺序保留在 TOOLCHAIN |
| §78 | GOVERNANCE |
| Android/Web 原入口 | [原文归档](rules/archive/PLATFORM_ORIGINAL.md) |
| 全局原文 | [完整归档](rules/archive/GLOBAL_ORIGINAL.md) |
| 原规则索引 | [完整归档](rules/archive/INDEX_ORIGINAL.md) |

历史编号不删除、不复用、不重排；全局导航保留编号入口。归档为历史证据，内部“生效”“唯一权威”字样不再具有当前效力。

## 低频具体细则

[Android](rules/DETAIL_ANDROID.md) · [Web](rules/DETAIL_WEB.md) · [Release](rules/DETAIL_RELEASE.md) · [Toolchain](rules/DETAIL_TOOLCHAIN.md) · [Tutorial](rules/DETAIL_TUTORIAL.md)。
入口概述为摘要，具体数值/命令/操作只按对应细则读取；与归并契约冲突的旧协作、授权、停止、环境事实条款不恢复效力。无需通读整份低频细则。

当前 Android APK 四渠道交付、rclone、GitHub Release 和 SSH/SFTP 规则见 `docs/rules/RELEASE.md` 的 R96 节。

## 隔离交付

本版在独立 worktree 审查分支交付，未修改运行中工作区的共享 inode。
两仓库携带同版模块，独立 clone 均可读取。由维护者审查整合，整合时须保链原位写入共享权威文件并同步镜像，禁止覆盖在途任务成果。
