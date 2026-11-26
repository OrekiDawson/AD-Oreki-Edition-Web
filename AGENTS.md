# Web MOD · Agent 长期规则

> **AGENTS.md 章节规范（长期强制）**：文件名与根标题保持标准；正文只使用连续的 `## 1. ...`、`### 1.1 ...`、`#### 1.1.1 ...` 等层级编号。新增规则必须归入所属主题，不得无编号插入文件最前端、叠加第二套目录或为每轮创建重复章；修改编号时同步修复本文及跨仓 `§` 引用。跨仓共性规则以 Workspace 为权威；纯目录重排不改变权限、预算、验收或发布门禁。

## 1. 总则与授权

### 1.1 统一规则来源与继承

- **单一权威来源**：[Workspace 最新 AGENTS.md](https://github.com/OrekiDawson/AD-Oreki-Edition-Workspace/blob/main/AGENTS.md) 是 ChatGPT/Agent 分工、任务编号与 `/goal`、费用/审查、游戏真实性与五阶段 180 分钟目标、Subagent 调度、GitHub/CI/CD、中文规范及交付的**全项目长期规则**。本仓继承其中适用条款；本仓 `AGENTS.md` 仅补充本平台技术和运行约束，**不得以内容未在本文件逐字重复为由忽略跨仓规则**。
- **每三分钟主动汇报（长期强制）**：执行中的主 Agent/Lead 必须按真实墙钟每 3 分钟至少向用户可见的会话或授权渠道反馈一次当前任务、可核实进展、当前动作、阻断及下一步；Subagent 同频向 Lead 汇报，由 Lead 汇总。长构建、测试及等待期间仍应反馈，无新增成果时如实说明。重要阻断、安全风险和任务结束立即反馈；反馈后继续执行，不视为停止或结束 Goal。不得为汇报重复轮询、付费调用或中断运行中的进程；工具无法支持时如实记录限制及超时。暂停或任务结束后停止空心跳。完整口径见 [Workspace AGENTS.md §1.1](https://github.com/OrekiDawson/AD-Oreki-Edition-Workspace/blob/main/AGENTS.md)。
- **Android 五渠道发布协作（长期强制）**：遵循 [Workspace AGENTS.md](https://github.com/OrekiDawson/AD-Oreki-Edition-Workspace/blob/main/AGENTS.md)，Stable Release 与 Pre-release 均使用 GitHub Releases、OneDrive、Google Drive、小米云盘、本地 SSH/SFTP 五渠道，复用同一签名 APK/SHA-256 及签名要求的配套 idsig/SHA-256；Windows 三家云盘使用官方客户端，不以 rclone 为交付依赖。逐渠道核实 GitHub 上传、各本地路径/哈希及客户端状态，部分成功不得宣称五渠道完成；预发布独立路径，不覆盖稳定 latest。Android 为发行责任仓，其他仓仅维护适用引用和证据，不自动取得发布权限。旧四渠道规则以此为准。
- **Android 滚动发布协作（长期强制）**：依 Workspace 最新规则，GitHub Releases 保留各版本 Tag/资产作为历史归档；OneDrive、Google Drive、小米云盘、本地 SSH/SFTP 使用固定路径/文件名，按类型滚动替换而非追加，各仅保留最新 Stable 和最新 Pre-release APK 及其必要配套 idsig。两类不得互相覆盖。验证新包、旧版可恢复性、本地交付路径、客户端状态、APK 与 idsig 配对及 SHA-256 后安全回收被替代的项目冗余副本和旧目录；失败保留/恢复上个可用版本并记 BLOCKED，不删除唯一成果、有效回滚点、历史证据、密钥或存档。禁止按 release-id 永久累积云盘/SSH 版本，不改变现有发布权限与门禁。
- **发布验收以本地交付为准（2026-11-25 用户授权）**：遵循 Workspace 最新五渠道验收口径。GitHub Releases 核实真实上传及资产信息；OneDrive、Google Drive、小米云盘仅核对官方客户端实际同步路径、文件大小、SHA-256、必要 idsig 及登录/可用状态，无已知同步失败即 `PASS（本地交付）`。不强制云端回读、远端下载、二次哈希、云端对象 ID、上传完成日志或内部接口；已知 401/登录失效/同步失败仍 `BLOCKED`，不虚称远端已核验。SSH/SFTP 核对约定本机分发目录及文件哈希、SSH 服务状态，不要求远程回拉或 SFTP 子系统实测；远程传输能力单列。此条覆盖旧远端回读要求，不改变五渠道同一 APK、滚动替换、签名与发行门禁。
- **六仓开放 PR 总量硬上限 5（长期强制）**：遵循 [Workspace AGENTS.md §4.1](https://github.com/OrekiDawson/AD-Oreki-Edition-Workspace/blob/main/AGENTS.md)。Workspace、Android、Web、Wiki、Pages、frame-observer 合计所有 OPEN PR（含 Draft、Ready、WAITING/BLOCKED、机器人及其他 Owner）最多 5 个；Lead 统一计数和分配预留名额，实际开放数加预留达到 5 即禁止创建/重开，超限 `PR_BACKLOG_BLOCKED`，先修复、合规合并或确认成果已保存后关闭被替代/经 Owner 确认延期的 PR，不为凑数量丢弃独有成果或绕过门禁。计数未知时禁止新增，可继续安全本地开发、现有 PR 修复和验证。低于 5 才分配普通 Agent 新额度，优先 P0 业务，汇报总数/预留及下一收口动作；原 Kody 付费并发、预算、Owner、CI、安全门禁不变。 ChatGPT 授权规则维护名额例外依 Workspace §4.1；实际 OPEN 仍计数，普通 Agent 上限不变。
- **最新跨仓调度与持续执行（2026-11-26 用户授权）**：以 [Workspace AGENTS.md §1.1–1.2](https://github.com/OrekiDawson/AD-Oreki-Edition-Workspace/blob/main/AGENTS.md) 为权威。取消峰谷、工作日、节假日和固定时段的开发、构建、测试、Git/CI/CD、审查及发布停工限制；全天按真实授权执行。安全、用户暂停、数据保护、真实预算/权限/资源硬门禁 > 六仓既有 PR 实质收口 > 新增 P0/P1 > 普通功能和技术债。未满 5 个也优先收口；只有当前可执行收口项均已推进且剩余受真实外部阻断或用户冻结、不争抢资源时，才转入独立 P0。Lead 不得主动结束回合后空等、因阶段完成、CI/Kody、资源或单一 Provider 阻断全局停工；每三分钟反馈后继续下一项。只有真实全部完成、用户明确暂停/结束或全部任务硬阻断、系统/会话实际中断才安全交接；不绕门禁、不空转、不虚构后台运行。云端定时调度不限制本地时段，共享对象按实际 Owner、HEAD、资源锁和 Issue #20 交接避让。四小时交付全天适用，取消时段豁免，仍以合格候选及安全发布门禁为准；不改变本仓业务、设备、发布及付费权限。
- **PR 快速流转与满额强制收口（长期强制）**：Issue 是长期任务池，PR 是短期交付队列；未具备独立可审查范围的任务留在 Issue/可恢复分支。六仓所有 OPEN（含 Draft、机器人、WAITING/BLOCKED）日常 0–2 个，3–4 正常，达到 5 即实际收口，超过 5 为 `PR_BACKLOG_BLOCKED`。合并优先于关闭；修复真实审查/CI/冲突，验证并合并有效成果；不得为数字关闭高投入 PR、降低优先级、丢弃成果或另起重复 PR。被替代须有 main 实现及验证，延期/取消须有用户或 Owner 授权及可恢复证据。每次合并/关闭回读六仓总数，满额持续至低于 5；仅报告或等待不是收口，关闭未合并不计交付。Lead 统一预留名额及调度；ChatGPT 直接维护授权的长期规则/任务书同步 PR 不受创建名额限制，仍计入真实 OPEN，其他 Agent 不得借名规避；CI/Kody/Ruleset/预算/Owner 门禁不豁免。
- **规则继承完整性门禁（长期强制）**：按 [Workspace AGENTS.md §4.1](https://github.com/OrekiDawson/AD-Oreki-Edition-Workspace/blob/main/AGENTS.md) 核对规则 PR 原 HEAD/Diff、有效条款、替代 PR、已合并 Commit、main 文件及条款位置、适用范围和验证证据；逐条确认全部有效约束和必要引用/配置已真实继承后才允许 `SUPERSEDED` 关闭。发现遗漏/冲突标记 `RULE_INHERITANCE_BLOCKED`，修复并回读优先于新增 P0；历史未合并规则按主题去重核查，不恢复已废止规则、不机械重开、不重复付费审查。逐仓区分权威已生效、仓内 main 合并、平台执行及本机同步，不以一仓合并冒充六仓完成。
- **Windows PowerShell 执行入口（2026-11-25 用户长期要求）**：Windows 原生会话中的所有 PowerShell 命令、脚本、MCP 工具调用、维护任务和交接示例统一使用 PowerShell 7+ 的 `pwsh`，禁止使用 Windows PowerShell `powershell.exe`。调用文件时采用 `pwsh -NoProfile -File <path>` 或等价显式入口；工具发现、PATH、文档示例和自动化不得回退到 `powershell.exe`。仅第三方程序内部不可控的兼容层可如实记录例外，不得把该例外扩展为 Agent 的默认入口。
- **完整日志落盘、失败根因优先（长期强制）**：关键构建、测试、签名、反编译、部署命令事先安排完整 stdout/stderr 日志或原生完整报告，保留真实退出码、脱敏命令、时间、HEAD、任务和日志路径；会话成功输出可精简，禁止仅凭 `Select-Object -Last 3`、`tail` 或过滤输出留证，pwsh 原生命令结束立即捕获 `$LASTEXITCODE`，其他 shell 同样保留生产命令真实退出码。失败先读取首次有意义的错误、失败任务/用例、文件行号和必要异常上下文，查已有 Gradle/test-results 等报告，区分根因与连带失败；无新修复、新假设或环境恢复不得原样重复执行。关键证据不可恢复时允许一次有明确目的且完整记录的最小复现。按需读取摘要与相关片段以节省 Token，不泄露凭据/存档等敏感内容；遵守磁盘配额，回收冗余但保留唯一失败和验收证据。适用本地及 CI；不改变真实门禁。
- **全局资源与安全同步（长期强制）**：遵循 Workspace §2.1、§5.1、§5.3 及专项生命周期规范。项目数据合计 80 GiB 硬上限，64 GiB 预警并安全回收，72 GiB 或预计超过额度时优先回收并暂缓重型写入，80 GiB 或配额拒绝停止新增写入、保全成果、清理；低于 64 GiB 且满足其他门禁时恢复。必须核实实际硬配额，不凭文档宣称 PASS。主树在安全检查点 clean/快进，保护 WIP、密钥、存档、唯一证据和活动 Owner；已合并且无独有内容/活动引用的工作树安全释放。启动/恢复及距上次刷新 60 分钟核对六仓 main 与有效规则；关键操作核对最新 HEAD、Owner，超过 10 分钟按最小范围刷新。远端合并不等于本机同步。
- **业务优先（新增开发任务内部排序）**：遵循 [Workspace AGENTS.md §1.1](https://github.com/OrekiDawson/AD-Oreki-Edition-Workspace/blob/main/AGENTS.md) 的新增开发内部 P0 游戏业务优先规则，既有 PR 收口仍在其前。全量反编译、全 APK 源码化、Smali 退役及非阻断 AGP/R8/旧构建链迁移为 P1；普通目录和工具链治理为 P2。仅直接阻断 P0 业务、构建、真实验收或安全交付的最小工程闭包临时升 P0。保留 Kotlin-only、源码化长期终局和全部安全、签名、存档、发布门禁，不以源码覆盖率冒充游戏进度。本条覆盖旧轮次相反优先级和一次性迁移时限，不授权接管其他仓库或本机任务。
- **先读取再执行**：启动、恢复、跨仓交接和关键合并/部署前，按照 Workspace 生效规则核验最新 `origin/main:AGENTS.md`（云端用 GitHub API 可替代只读刷新）、本仓规则、事实、任务书、实际 PR/CI 与运行证据；遵守已有 60 分钟常规刷新和关键动作前的短间隔刷新。读取失败或未证实最新版本时记录 `STALE/BLOCKED`，不能声称已同步。本仓更细的合法技术约束继续有效；**用户最新授权与安全/预算硬限制优先，其他冲突以 Workspace 跨仓规则为准**，发现不可兼容之处只作最小修复并报告，不静默放宽门禁。
- **运行方式**：当前已启动轮次仅续做，不重新发 `/goal` 或改编号；Agent 输出、人工注释/文档和有意义的 Commit 使用简体中文、LF；按风险做最小必要真实验证，结果如实为 `PASS / FAIL / BLOCKED / NOT RUN`；保护未提交文件、唯一构建/测试证据及 Git worktree，避免重复工具安装和无限临时工作树。不得把文档/CI/规则 PASS 冒充真实游戏、上线或正式发布 PASS。
- **本机资源保护与生命周期（长期强制）**：遵守 [Workspace AGENTS.md §2.1、§5.1、§5.3](https://github.com/OrekiDawson/AD-Oreki-Edition-Workspace/blob/main/AGENTS.md) 与 [Git 工作树生命周期规范](https://github.com/OrekiDawson/AD-Oreki-Edition-Workspace/blob/main/项目管理/Git工作树生命周期规范.md)。本机开发启动前核实实际 CPU/RAM/Swap/I/O/磁盘余量、cgroup 预算与唯一重型任务许可；重型构建、反编译、AVD、浏览器长跑、Timeshift 创建/清理不得重叠，保护桌面、网络与远程救援，压力异常先暂停新增负载，不自动重试失控任务。当前轮次若有资源硬门禁，须以真实验收及用户授权解除，不能以重启或文档合并代替。Subagent/Owner 任务完成、取消或替代后先保存独有成果、WIP 与证据，再实际回收安全的工作树与无引用临时生成物；Lead 交接/收尾核对主检出及全部 worktree、实际释放空间。禁止强制 remove/reset/clean、跨 Owner 删除、清空在用缓存或从 Windows 第三方 ext4 驱动批量清理；正式资产与有效回滚点只读保护。具体阈值由 Workspace 与当前任务书管理，不在本仓另设独立预算。本仓 Node/npm、Playwright/Chromium、构建与长跑均纳入实际资源准入，复用可再生依赖；保存真实存档、长跑/故障证据和部署来源，清理过期且无引用的浏览器临时数据及生成物，不删除线上资产。

- **Web 专属继承重点**：保持独立冻结上游及 Android 同条件行为等价；关闭新闻，优先 Android Chrome 默认手机视口；简体中文玩家教程、MOD 独有内容仅附录 F；真实挑战结算、合法阶段门禁及调度器独占全部自动购买器及原版全局按钮（1～60 秒、默认 10 秒，手动修改下一 tick 恢复，MOD 总开关独立）；`savestates/` 样本记录版本/来源/用途/预期；Playwright 新档、存档互通、五阶段 PACING/终局及真实性定向验证，测试不以假状态替代。

### 1.2 游戏优先与规则审查边界

- 跨仓唯一调度顺序以 Workspace §1.1 为准：硬停止条件 > 既有 PR 实质收口 > 新增 P0/P1 > 普通功能及技术债；在已授权范围内执行，不以新增 P0 绕开可推进的 PR。
- 规则变更 PR 按 Workspace §1.1 优先收口，Lead 可将独立规则整改交给专职 Subagent；每个活跃小时最多投入一个非阻断规则 PR 的 Lead 规则批次边界不限制已有 PR 的实质收口。WAITING/BLOCKED 后立即推进其他独立事项，同 HEAD 不重复付费。
- 会话活跃且存在已授权的游戏核心任务时，在当前可执行 PR 收口项均已推进且不争抢资源时，每个自然小时至少推进一项游戏核心工作；纯规则、fetch、Issue/PR 刷新、等待 Kody 或 CI 绿灯不计游戏推进，且不得冒充玩家体验或五项门禁成果。若该自然小时没有已授权的游戏核心任务（例如仅授权规则/审查批次），如实记录 `WAITING` 或无可推进项，不得越权启动游戏开发或把规则/巡查成果冒充游戏推进。

### 1.3 授权、预算与运行状态

- **实时授权优先**：用户明确授权的范围直接执行；未授权的付费调用、全量开发、自动发布和无人值守任务不得擅自启动。最新明确暂停优先于更早的恢复；当前 Goal/编号、PR、Kody 开关、测试状态以最新用户指令、实际平台配置及任务记录为准，不在本长期规则中永久冻结某一轮状态。历史 AGENTS 快照只供追溯。
- **付费门禁（最新授权）**：遵循 Workspace 权威规则：取消 DeepSeek 固定余额和余额未知的停工/付费前置门禁，余额仅供参考；实际 Provider 拒绝请求时仅阻断对应付费路径，不暂停无关已授权任务。周期预算 80% 预警、100% 或预计超额停止新增收费任务，保留真实授权、有效凭据、安全、Kody 额度及现行权限门禁；不得自行充值、重建密钥或切换账号/Provider 绕限。
- **事实与验收**：未运行为 `NOT RUN`，失败为 `FAIL`，受阻为 `BLOCKED`，只有真实证据才能写 `PASS`。单测、CI、构建、安装、真实运行、发布及线上验证分开标识，不伪造结果或把旧候选结果移植到新提交。

### 1.4 任务编号与 Goal

- ChatGPT 是所有项目任务编号的唯一分配者。
- Lead 只能使用 ChatGPT 已明确分配的编号；Subagent 继承当前编号；Codex、DeepSeek、其他 Agent、调度器和 GitHub Actions 不得自行创建、推算、递增或生成编号。
- 新任务只用单层 `R整数`；禁止 `R122-01`、`R122.1`、`R122-A` 等子编号。用户说继续时沿用当前编号，中途新增需求默认纳入当前任务。
- `R121-01` 是本规则生效前已存在、由用户明确要求本轮沿用的历史兼容编号；它不是新编号，本轮结束前不得重命名，也不得据此创建任何新子编号或派生编号。
- 所有历史编号、提交和证据保持原样；下一轮编号由 ChatGPT 明确指定，不得按历史最大值推算。

## 2. Web 技术与玩法

### 2.1 Web 技术与游戏约束

- 上游基线冻结于 2026-07-17 的 `IvarK/AntimatterDimensionsSourceCode` Commit `5409e320`，未经授权不整体升级。Android/Web 玩家可见行为、功能与中文教程应等价，差异留证。
- 不伪造资源、进度、挑战结算、成就、存档或终局，不以切换页签刷新假状态。首次大坍缩后不能非法跳过 Infinity，永恒与现实按真实进度开放。
- **智能自动购买器完整托管（P0）**：MOD 调度器独占全部自动购买器及全局控制项的策略与有效调度，覆盖原版全局启停、批量状态切换、全局购买数量切换及单项启停、模式、数量、限制、阈值、间隔、优先级。MOD 托管开启时允许玩家操作，下一有效 tick 按最新合法阶段、资源、挑战、解锁、冷却、收益重算并恢复全局与逐项配置；不得粗暴全开、沿用过期快照或让批量数量覆盖各项最优模式。只有独立的 MOD 调度器总开关由玩家决定是否托管，关闭立即停止 MOD 自动执行与回写且不得擅自重开；原版全局开关不能关闭 MOD 托管。挑战限制、游戏强制禁用及安全暂停优先。tick 由玩家设置 1～60 秒，默认 10 秒，阶段或主循环不得擅改；保留原版合法冷却与升级条件，但不得存在竞争性独立执行入口、重复调度或虚假间隔。补齐所有阶段实际存在的自动购买及策略缺口，真实购买、扣费、结算，禁止越级、误重置、死锁、无效重试。GUI 全局按钮与各项实际配置/执行同步，保留有趣手动操作。双端逐一枚举所有购买器/控制入口，真实生产路径验收三个全局按钮、单项修改、MOD 总开关、1/10/60 秒、阶段重置、导入存档与挑战限制；策略完整、配置正确、真实执行、GUI 同步及双端等价独立取证，180 分钟通关不能替代。关联 [Android #164](https://github.com/OrekiDawson/AD-Oreki-Edition-Android/issues/164) / [Web #52](https://github.com/OrekiDawson/AD-Oreki-Edition-Web/issues/52)。
- **五阶段体验契约**：真实新档必须按以下顺序自然展开主要玩法；时间区间是长期体验目标而非按时钟触发的阶段开关。

  | 真实墙钟 | 玩家体验目标（同时作为 `PACING` 阶段—机制映射） |
  | --- | --- |
  | 0～30 分钟 | 快速成长，建立基础维度、升级和首次关键突破的理解 |
  | 30～75 分钟 | 逐步展开无限、Break、永恒、IP/EP、时间研究与挑战 |
  | 75～130 分钟 | 展开现实、主要天神、现实升级和自动化恢复 |
  | 130～165 分钟 | 完成后期挑战、Pelle 解锁与终局过程 |
  | 165～180 分钟 | 完成最终突破、原版真实结算与收尾 |

  上表同时是 `PACING` 的唯一阶段—机制内容判据；`docs/DELIVERY_RULES.md` 与 `docs/SHARED_GAMEPLAY_STANDARD.md` 引用同一映射。
  每阶段必须有实际游戏内容、合法资源增长和真实推进过程，不能被自动化瞬间跳过；阶段转换必须由真实机制自然决定，不得按墙钟强制锁定/解锁，也不得用固定等待、降低性能、擅改调度 tick 或伪造进度凑时间。阶段边界允许 **±5 分钟**审查容差：边界 ±5 分钟内不得仅凭秒数判失败，超出后仍须结合内容是否被压缩判断。首个 Reality 早于 **70 分钟**（75 分钟边界减 5 分钟）进入即触发 `PACING FAIL` 阻断审查；这是对真实运行结果的判定阈值，不是按时钟解锁条件。
- **独立验收维度**：候选版本分别记录 `GAMEPLAY LEGALITY`（资源、购买、挑战、结算、解锁、存档、成就合法）、`PACING`（五阶段自然展开且内容未被明显压缩）、`ENDGAME`（真实新档 ≤180 分钟到达原版终局）与 `POST-ENDGAME STABILITY`（终局后状态和存档正常）。以上四项与独立 `SAVE COMPATIBILITY` 共同作为五项门禁，分别使用 `PASS / FAIL / BLOCKED / NOT RUN`；ENDGAME PASS 不代表 PACING PASS，CI、构建、单测或审查完成也不能替代真实玩家体验。
- **节奏失败快速阻断**：真实新档一旦有可靠证据确认候选严重偏离五阶段目标，立即标记 `PACING FAIL`，最低 P1；同时存在非法解锁、伪造结算、存档损坏或核心玩法不可用时升级 P0。安全保存运行证据与检查点后，暂停该候选的无效长跑、合并和发布，优先定位直接根因；修复后先定向验证受影响节奏，恢复后才重启完整新档验收。允许调整有证据支持的倍率、经济曲线、动态速度和阶段自动化策略。
- **STD/IAP 商店移除与原版存档双向兼容（长期强制）**：Android/Web MOD 都不得提供独立 STD/IAP 商店的正常导航、购买/支付、6h/24h 商店时间跳或任何商店/广告额外游戏倍率；运行时商店乘法效果为 ×1、加法效果为 0，禁止从旧购买态重新激活。正常游戏内 Infinity/Break、Eternity、Time Study、Reality、Teresa Perk Shop 等合法升级/商店不在此范围。
- **原版存档互通门禁**：每个平台必须通过“同平台官方原版导出 → MOD 导入并合法游玩 → MOD 导出 → 同平台官方原版实际导入”及反向再导入回归。保留官方存档编码、结构、关键字段、槽位、已购历史记录和原版格式兼容；MOD 只在运行时禁用商店效果，不得清零、删除、伪造旧购买记录或以保存 `IAP.enabled=false` 作为关闭商店手段。新增 MOD 专属配置采用不污染原版导出的方式保留，不能让原版读取失败或丢失进度。Android 官方 3.21.0 与 Web 官方冻结基线的存档载体不同，跨 Android/Web 直接互读另须真实格式转换验证，不得推定已经支持。
- **`SAVE COMPATIBILITY` 独立阻断门禁**：原版→MOD 与 MOD→原版任一方向失败、存档重要信息损坏或历史购买记录被抹掉，均记 `SAVE COMPATIBILITY FAIL`，至少 P1，阻断稳定版合并及发布，先安全留存原始存档再修复；未知或未测记 `NOT RUN` / `BLOCKED`。涉及商店或存档的改动，测试必须覆盖官方新旧档、MOD 新旧档、曾购买商品的档、导入导出及重启保持，不能仅凭结构检查宣称 PASS。
- **终局硬指标**：新档合法墙钟 **≤180 分钟**完成原版真实终局，并确认终局后状态；运行证据绑定明确源码 Commit、部署 Commit、运行 ID 与新档起点，旧版本的里程碑不得算作当前版本。使用 JS/Node、Playwright/Chromium 手机视口及必要真实浏览器、空存储新档验证；静态检查不能替代实际 GUI/存档行为。
- GitHub Pages 部署副本与开发源码分离；`oreki.net` 只从已验证源码与受保护的 CI/CD 发布，不直接拼改部署副本。详细事实见 `docs/DELIVERY_RULES.md`、`docs/FACTS.md`、`docs/GIT_MAIN_CICD_SYNC.md`。

### 2.2 商店退役与存档互通

- Web 版永久移除可访问的 STD/IAP 商店、支付入口、购买动作、商店倍率、外观商品购买与 6/24 小时时间跳跃。只保留原版 IAP 存档字段和 `shopPurchases` 兼容键，历史购买数据不得恢复数值效果。
- 商店移除不得改变原版玩家存档结构。必须保留原版存档导入、本版导出、原版再次导入的双向互通验证；测试至少使用上游冻结基线生成的真实存档。
- 商店 UI、支付网络请求或商店增益重新进入生产代码视为回归；发布门禁必须包含手机 Chromium 无商店入口、全部倍率中性、旧购买状态不可复活及原版存档往返测试。

## 3. Android 跨仓协作

### 3.1 P1 全量 Smali/DEX 清零

- **权威目标（P1）**：Android 按业务需求增量恢复生产 Smali/DEX 为经 AGP 标准源码编译与运行验证的过渡 Java/Kotlin，最终清零生产 Smali 补丁、手工 DEX 注入、`build_mod.py` 依赖及 APK 二次打包。JADX/REA 只是恢复分析工具，反编译输出不等于编译/语义 PASS；新增、修复和实质修改的 Android 业务必须 Kotlin。仅直接阻断 P0 的最小闭包临时升 P0；不再要求 R126 单一窗口一次性恢复。CI/Kody/发布门禁不变。
- **本仓职责（Web 源仓）**：仅跟踪/修复实际受 Android 迁移影响的共享接口、跨端存档兼容、发布/下载链接、官方构建指令或文档引用；Android 源码/工具链的唯一 Owner 仍在 Android 仓。没有受影响的引用就记录“无需改业务”，不以 Android 工程迁移擅自调整 Web 游戏、Wiki 正文、Pages 部署、签名或本地环境。
- **验收**：要求 Android 权威 Issue 的 `PRODUCTION_SMALI_FILES=0`、`PRODUCTION_SMALI_DEPENDENCIES=0`、`MANUAL_DEX_INJECTION_PATHS=0`、`BUILDMOD_PRODUCTION_DEPENDENCIES=0`、`LEGACY_APK_REPACK_PATHS=0` 与 AGP 全游戏、Tick、存档、关键运行 PASS 真实证据；缺失时保持 OPEN/BLOCKED，不能在本仓宣称迁移成功。用户数据、安全、真实玩家 P0 优先。权威入口：[Android #52](https://github.com/OrekiDawson/AD-Oreki-Edition-Android/issues/52)、[#61](https://github.com/OrekiDawson/AD-Oreki-Edition-Android/issues/61)、[#25](https://github.com/OrekiDawson/AD-Oreki-Edition-Android/issues/25)、[Workspace #47](https://github.com/OrekiDawson/AD-Oreki-Edition-Workspace/issues/47)、[#20](https://github.com/OrekiDawson/AD-Oreki-Edition-Workspace/issues/20)。

### 3.2 P1 AGP 与目录治理

- Android [#61](https://github.com/OrekiDawson/AD-Oreki-Edition-Android/issues/61) 根目录标准化按 **P1 工程迁移（普通目录整理 P2）** 执行，与 [#52](https://github.com/OrekiDawson/AD-Oreki-Edition-Android/issues/52) 的 `build_mod.py` 退役执行「迁移即清理」：替代一个可达生产环节，同批删除失效入口与无消费者的专用工具；共享工具由最后使用者退出时删除。详见 Workspace 最新 `AGENTS.md` 和 [Issue #20](https://github.com/OrekiDawson/AD-Oreki-Edition-Workspace/issues/20)。
- Web 只负责确认自身与 Android 目录/构建变更相关的跨仓脚本、共享数据、链接和行为等价，不因 Android P0 擅自迁移 Web 目录或调整 Web 业务、部署/发布门禁。Android 代码 Owner 与 Web Owner 避让；真实玩家 P0/P1 和存档安全仍优先。规则合并后按既有授权立即安全同步本机并验证，不冒充已合并或同步成功。


> 此文件只存长期约束；具体轮次、Kody 启停、PR 状态与最新上线结果由最新授权、GitHub 和任务记录决定。

### 3.3 P1 64 位 ABI 与测试设备

- **Android 正式支持**仅 `arm64-v8a`、`x86_64`；停止 `armeabi-v7a`、`x86` 32 位兼容。实施归 Android [#285](https://github.com/OrekiDawson/AD-Oreki-Edition-Android/issues/285)，协同 #52 生产 Smali 全量清零/#61 根级 AGP；生产 `.so`、AGP ABI 过滤、包内 JNI、启动/Tick/存档、发布必须真实验证。原版历史 ABI/DEX/研究/存档不因移除 32 位 JNI 而抹除。未获得 ARM64 原生库/实机证据时如实保留 BLOCKED 或 NOT RUN，不得伪造完成。
- **日常设备策略**：优先使用 x86_64 Linux 电脑的唯一 API37 AVD 作为日常开发与大多数定向回归机；用户 Android ARM64 真机仅在可用、授权时偶尔做抽样安装、JNI、存档、冷启动与性能验证。**不要求每个普通 PR 跑手机**；本次 ABI 全面退役需单独提供 ARM64 真机证据或明确 NOT RUN。
- **本仓协作（Web 源仓）**：仅修复确有影响的共享发布元数据、下载/安装指南、ABI 支持说明、CI/交叉引用及跨端存档说明，不因此触碰 Android 构建脚本、改变 Web 业务、Wiki 独立写作或 Pages 部署门禁。继续当前已授权轮次，不重复 `/goal`。权威任务：[Android #285](https://github.com/OrekiDawson/AD-Oreki-Edition-Android/issues/285)、[Workspace #47](https://github.com/OrekiDawson/AD-Oreki-Edition-Workspace/issues/47)、[#20](https://github.com/OrekiDawson/AD-Oreki-Edition-Workspace/issues/20)。

### 3.4 P0 包名变更的 Web 协作

- Android MOD 的最终正式 `applicationId` 经用户确认改为 `net.oreki.antimatterdimensions`（自有域名 `oreki.net`），Debug 为 `net.oreki.antimatterdimensions.debug`；这属于 Android P0 身份迁移，权威实施任务 Android #52/#61/#25/#17、PR #276，调度见 Workspace #20。与原 Android `com.oreki.antimatterdimensions` 是**不同系统应用**；不能覆盖安装，也不会自动继承旧包私有数据，必须由 Android 侧验证旧存档导出→新包导入。
- **Web 只修实际受影响的共享引用**：下载页/帮助文档、安卓安装包名、跨端存档指南、深链/App Links、共享脚本/发布元数据如硬编码旧 applicationId，按实际变化修正。**不改 Web 的应用 URL、游戏存档结构、Web 部署路径或业务行为**；Android 的源 namespace/混淆 ABI 不得全局改名。必要测试最小化，保持 Android/Web 存档互通、PACING 和发布门禁。
- Android 规则 PR 合并后立即传递本机安全同步；Web 规则合并也同样要求本机读回核验，未验证不得冒充本机已更新。沿用现有 R126，不新 /goal。

## 4. 质量、审查与合并

### 4.1 GitHub 审查与质量门禁

- **风险分级**：A 类为纯文档/注释/索引，定向核实事实、版权、链接及敏感信息；B 类为 Actions、审查触发器、共享配额、权限、构建与发布工具，重点核实并发、幂等、边界、失败恢复和回滚，不因“未改游戏代码”而轻审；C 类为游戏业务、存档、结算和高风险机制，完整审查风险并做最小必要真实验证。混合 PR 按最高真实风险设置门禁，按文件聚焦测试。
- **集中修复、避免复审循环**：先核对最新 PR HEAD、Diff、普通评论、Reviews、Review Threads 与 Required Checks；同一 HEAD、同一审查配置和适用范围已经有效审过时不重复主动请求。集中解决同一批问题、定向验证后再复审；不制造空提交，不因风格建议无限扩项，也不为归零机械关闭线程。
- **规则治理专职 Subagent（长期强制，三仓共用 1 名）**：Lead 在当前已授权且实际运行的多 Agent 会话中，若存在可执行的规则/审查治理任务，应优先**仅委派 1 名跨 Android、Web、Wiki（兼顾 Workspace 交接）的规则治理 Subagent**，而非每仓各派 1 名或让所有 Agent 都处理规则；须核实实际 Subagent 可用性与现行数量限制，不凭文档声称已启动。该 Subagent 是当前授权范围内的持续任务执行者：在已认领、独立的工作树和明确 Owner/文件范围内，负责各仓 `AGENTS.md`/专项长期规范一致性、有效规则 PR 的定向修复与去重、Kody/Codex Review Threads 的逐条核实、必要 CI/Ruleset 检查、过期/重复 PR 的安全收口和 [Workspace Issue #20](https://github.com/OrekiDawson/AD-Oreki-Edition-Workspace/issues/20) 的证据交接；Wiki 优先监督已配置的 **Kody 原生自动审查**，只在自动失败且符合现行费用/Provider/授权门禁时人工兜底，不重复发起相同 HEAD/配置收费审查。全项目最多 3 个已授权且相互独立的在途付费 Kody 审查，其中 Wiki 原生审查只占并发槽，不占 Android/Web 每日额度；多个 PR 可以 Ready，但转 Ready 或推送新 HEAD 前必须核对全局在途数。全项目 3 个在途槽是所有优先级共享的唯一并发硬上限，不另设非阻断 2 槽或长期固定预留。全局 3 槽满且自动触发无法隔离时，记录 `REVIEW_BLOCKED(concurrency-guard)`，槽位释放后按真实优先级推进；不得取消在途审查插队。Android/Web 共享池 80 次仅预警、不因此自动停审，100 次为硬上限；临近 100 次时，Lead 必须在为 Android/Web 的任何非 P0/P1、非安全、非合并阻断项新建 PR、转为 Ready 或推送新 HEAD 前核对实时余量与在途量，为当日更高优先级审查动态预留额度；受限 PR 额度不足时记录 `REVIEW_BLOCKED(quota)` 及 Owner/HEAD/已用量/在途量/原因/下一动作，待额度恢复或用户放行后继续。Wiki 每日审查额度独立统计，不得读取、写入或扣减 Android/Web 共享池；Wiki 请求若被送入共享配额实现，必须失败关闭为 `not-shared-quota-repository`；全项目并发槽仍按 Workspace §1.1 包含 Wiki 原生审查。基础设施尚未在 `reserveKodyQuota` 实现全项目在途槽计数时，记录独立的 `MECHANISM_GAP(quota-unenforced)` 并修复机制；该标记表示机制缺口、不能单独据此阻塞审查。修复前 Lead 在每次可能触发收费的 Ready/推送前核实全局在途数、实际配额、授权和隔离；全局未满 3 槽且满足其他门禁即可推进，否则记录明确阻断，释放后恢复，不得退回永久单审查。**Lead 仍独占任务优先级、授权与预算、跨仓冲突、最终合并及正式发布决策，不得由 Subagent 绕过审批、Required Checks 或冒充 Review PASS**。Lead 每批次先识别真正阻断当前操作的 Critical/High/安全与 CI 问题并交给该 Subagent；“规则 PR 优先”是**发现与委派的优先权，不代表 Lead 必须亲自清空规则队列**。非阻断规则建议由该 Subagent 集中处理，不得因为措辞/风格复审无限修改 `AGENTS.md`、空提交、反复开 PR 或制造空轮询；出现真实结果或单个 PR 进入外部等待、受阻时，记录 `Owner/HEAD/CI/Review/下一动作` 后应立即检查并推进队列中其他独立规则项；同一已授权队列内 Subagent 可自续跑，但每次 PR 状态变化须向 Lead 上报真实证据；Lead 保留核实、叫停、改派、优先级与预算否决权；单个 PR 合并/关闭、一次批次结束或单个 PR `WAITING/BLOCKED` 均不构成释放条件，只有队列已清空、无可安全执行事项、全部剩余事项均不可安全执行或出现硬停止条件时，才正常释放并记录交接。Lead 与其余合适的 Subagent 在无冲突且允许执行时**在可执行收口项已推进且不争抢资源时推进 Android/Web 的玩家 P0/P1、挑战原版结算、五阶段 PACING、180 分钟终局、存档兼容及最小真实验证**，Wiki 内容/Pages 独立必要任务遵守同一收口顺序；不可把仅处理规则、仅派遣 Agent 或等待 Kody 冒充游戏开发成果。安全/数据损坏/预算停工、实际云端本地 Owner 避让、Kody Balanced/费用限额和最新用户明确指令始终优先；没有可用 Subagent 时 Lead 仅做必要安全收口并记录 `BLOCKED`，不为此停掉可独立执行的主线任务。
- **规则变更 PR 优先收口（长期强制）**：Lead 每次开始 Issue/PR 批次、接收新的审查结果或准备认领普通 PR 时，**优先核对并实际推进当前六仓未关闭的规范/规则 PR**，包括 `AGENTS.md`、适用的 `DELIVERY_RULES`、跨仓策略、审查/预算/权限/调度规则、构建与发布门禁及其必要引用。执行优先级仅以本文件 §1.1 的统一调度顺序为准，“规则 PR 优先”按 §1.1 的收口优先顺序执行，已有规则 PR 的实质收口优先于新增游戏核心和功能开发，但不得为制造收口工作新建非必要规则 PR；不得将仅含 Changelog 的 PR 冒充规则变更。先读最新 `origin/main`、Workspace Issue #20 的 Owner/HEAD/交接和各 PR 的 Diff、CI、Review Threads，避免重复认领与覆盖；对无冲突且在授权范围内的规则 PR，执行 `TRIAGE → ACT → VERIFY → PERSIST`：确认规则冲突、修复可信审查意见、运行文档/CI 最小必要检查、推进合格 Draft、核实 Required Checks/审批后合并，或标记具体 `REVIEW_BLOCKED / CI_BLOCKED / CONFLICT / SUPERSEDED` 及下一动作。**优先处理不等于无审查自动合并**：不得绕过 Ruleset、未经授权触发收费 Kody、将 skipped 当 PASS，或为刷进度重复评论。规则 PR 合并后应即时刷新相关仓库 `origin/main` 并重读已生效规则，通知受影响的 Lead/Subagent 按新规则继续；未合并的新规则不得提前宣称生效。云端并发按实际 Owner 与明确交接避免冲突；单个规则 PR 受阻时继续处理无冲突的下一项，不能让全部开发停摆。
- **具备审查条件的 PR 必须及时 Ready（长期强制）**：`Draft` 仅适用于真实 WIP、缺少独立可审查的 Diff/说明、明确冻结且禁止合并的历史证据、存在尚需先排除的严重冲突与安全阻断，或已确认的并发/额度硬限制（全局 3 槽已满、真实费用/授权或日配额不足，且新增付费触发无法安全隔离）导致新增付费审查会突破实际硬门禁。**除上述事实性例外外，修改已完成、范围清楚且可供审查时，Codex 必须及时将 PR 标记 `Ready for review` 并推进审查，不得只因 CI 尚在运行、预计会出现审查意见或担心 Kody 费用而长期留在 Draft**。Ready 只表示允许开始审查，**不等于 Required Checks PASS、Kody Review PASS、游戏验收 PASS 或允许合并**；阻断仍须逐项核实并解决。Lead 每次接收子任务、CI/Review 结果及收口时检查本仓开放 PR，真实不能 Ready 的记录 `Owner / 最新 HEAD / 阻断 / CI / Review / 下一动作`，按需交接至 [Workspace Issue #20](https://github.com/OrekiDawson/AD-Oreki-Edition-Workspace/issues/20)。**收费审查与 Draft/Ready 状态分开管理**：核实事件自动审查触发、Provider、Balanced、既有授权及限额，不重复发送 `@kody start-review`，不为送审私自启用新的付费 Provider；授权或费用受阻如实记 `REVIEW_BLOCKED`，但不得反过来把本来可送审的独立 PR 无限压在 Draft。并发或额度条件解除后应立即 Ready；未解决 P0/P1、分支保护、冲突或必要 Review Threads 必须在合并前解决，不通过切换状态绕过硬门禁。跨仓总规则来源：[Workspace 已合并 PR #27](https://github.com/OrekiDawson/AD-Oreki-Edition-Workspace/pull/27)及[Workspace AGENTS.md](https://github.com/OrekiDawson/AD-Oreki-Edition-Workspace/blob/main/AGENTS.md)。
- **合并底线**：真实 P0/P1 与阻塞性问题必须修复或有充分反证；必要线程、审批、Ruleset、Required Checks 与测试均满足后正常合并。不得强推、跳过平台保护、虚构审核或将 `Skipped` / `KODY NOT RUN` 写作 PASS。文档变更不机械运行无关游戏长跑。
- **Kodus 的规则分层**：通用审查标准归 Kodus Global Rules，项目执行规范归本仓 `AGENTS.md`；不重复抄写为项目级 Kody Rules。Kody 从仓库文件读指令与否以实际配置/证据核实。自动生成的规则先审批去重，只有真正跨仓适用的候选可提升 Global，不能默认未经批准直接生效。
- **Kody 动态授权与费用**：Kody 仅限 Balanced，严禁 Heavy。每次启用付费审查先确认最新用户授权、云端配置、工作流与预算；处于暂停/不确定状态时不得主动触发，也不得重新连接付费 Provider。Android/Web 若获准恢复，遵守两仓共享 UTC+8 自然日 100 次主动审查请求、80 次预警、按原始评论 ID 去重、无单仓 50 次硬上限；这并非模型 API 硬计费上限。**`AD-Oreki-Wiki` 使用独立审查统计，绝不写入、读取或扣减 Android/Web 共享计数池；Wiki 仍受自身授权、平台额度与计费限制，不是无限制审查。** 旧 Oreki Audit 等链路是否启用须检查实时设置，禁止重复触发。
- **Kody 跳过一律不计额度**：所有 Kody 已确认 `skipped` 的审查均不计入项目主动审查额度。触发前跳过不占位；已预占或已发 `@kody start-review` 而 Kody 官方 Check Run 最终确认为 `skipped` 的，按仓库、PR、HEAD 与 Kody Check Run 证据幂等退额；Android/Web 共享 100 次池与 Wiki 独立统计均遵守。未完成审查可临时预占防并发超额；真正完成的审查（即使无问题）仍计数。只有 GitHub Actions 的 `skipped`、缺失回执或不明状态不足以认定 Kody 已跳过，不得擅自退额或把 `SKIPPED` 写为审查 PASS。Kody 平台实际收费另行遵循其规则。

- **Subagent 完成后再调度（长期强制）**：每次 Subagent 完成、失败、取消或释放资源后，Lead 应及时接收并核实真实 Commit/PR/测试证据、更新队列，再按已授权且无冲突的任务继续派发；无安全且有价值的任务时正常释放并记录原因，不制造占位任务。Lead 占用 AVD、签名、最终构建/部署或等待长跑/CI 时，不依赖这些资源的 Android/Web 游戏修复、定向测试准备或 AGP/R8 工程工作，在已授权且安全可执行时仍应并行推进；不得因等待 Lead 合并 PR 而让已完成 Agent 无故闲置，也不得改动他人认领的 PR 或工作树。真实预算、安全、权限及用户暂停等硬门禁与本条冲突时优先。

#### 4.1.1 仅规则变更时的 Kody skipped 例外

- 对当前 PR HEAD 的**实际完整 Diff** 核验：仅新增/修改 `AGENTS.md`（含子目录同名文件），不得混入代码、CI、其他文档、构建或发布文件；若混入任何其他路径，不适用本例外。
- 当 Kody **官方**针对该 HEAD/配置确认因纯规则文件而 `skipped`，该结果不计付费审查配额，亦不等于 Review PASS；不为取得形式上的 PASS 重复触发 Kody。若 Kody skipped 的原因不明、服务故障或未返回官方结论，不得套用本例外。
- 只要当前 HEAD 的适用 Required Checks、审批、分支保护、Ruleset、合并冲突及其他人工阻断均已核验满足，允许直接自动合并纯 AGENTS.md PR，无需额外等待 Kody 的 PASS 或逐项向用户征询。**不得**绕过 GitHub 强制要求的 Kody Check 或任何其他保护规则；若平台仍将其判为 Required 且未满足，保持 BLOCKED。
- 合并后回读 GitHub 验证 merged 状态、merge commit 和 main；记录 Kody skipped 的真实原因、HEAD、门禁证据及结果。规则本身的授权不等于任何 PR 已满足合并条件。

## 5. 工作方式与环境

### 5.1 执行效率与反馈

- **定期 fetch 与规则重载（长期强制）**：活跃授权会话启动/恢复立即检查，距上次成功刷新达 60 分钟时核对六仓 Owner、Git 锁、远端后逐仓 `git fetch --prune origin`，记录 origin/main SHA，重读主线及工作树适用 AGENTS.md、Workspace 权威规则、Issue #20 和任务相关专项规则；失败保留错误，不伪记成功。新授权与新规则即时采用，离线不补跑，无峰谷等待，不另建后台定时器。
- **关键动作前的有效性门禁**：新建开发分支、领取新 Issue/PR、修改影响跨仓规则的文件，或合并/发布/部署/变更重要 CI 配置前，若距离上次成功远端刷新超过 **10 分钟**，应先按最小范围重新 fetch、核对最新 `origin/main`、PR HEAD、Required Checks 与相关 `AGENTS.md`/规则；即便未超时，合并等操作仍须即时确认远端最新 HEAD 和 Owner。未获证实的规则/远端状态标记 `STALE/BLOCKED`，不要用缓存结论强行合并或发布。**`fetch` 只更新远端跟踪引用，不等于工作树已经同步**；禁止因此擅自 `pull/rebase/reset --hard/clean/stash`、强制切换、强推或覆盖未提交文件、其他 Agent 工作树。仅在干净且可安全快进的本地 `main` 上才允许 `merge --ff-only`，否则保持 `FETCHED_ONLY`，使用经核实的独立干净 worktree 继续工作。若无 Git 工作树（例如云端只接 GitHub），用 GitHub API 读取各仓默认分支 HEAD 与规则正文作等价**只读刷新**，不得把 API 检查称作本机已执行 `git fetch`。记录上次成功刷新时间、四仓 SHA、实际重读的规则及失败原因；无变化不刷 GitHub 评论。
- 先按路径/符号/Diff 缩小任务范围，复用未失效的测试及日志；工具相同失败两次应先诊断，不做无价值全量扫描、重试或无关重构。脚本尽量单责复用，不为假想需求提前增加复杂度。
- 重要进展、失败、预算预警及交付及时用简体中文反馈；长任务原则上每 2 分钟至少反馈一次有实质内容的完成情况、真实障碍与下一步。Lead/Subagent 使用可复核交接资料，避免重复读取上下文、无任务轮询或资源冲突。
- **本地 Codex 时间机制**：时间提醒仅用于真实耗时、三分钟反馈、60 分钟规则刷新与四小时交付节奏，不用于峰谷停工。只在有真实外部等待且无其他安全工作时采用有界等待；不以 clock.sleep、cron、systemd timer、后台守护进程或空轮询代替实际推进，不宣称离线或结束会话仍运行。
- **本地持续收口**：全天主动推进实际 Issue/PR；按事件（完成、失败、审查返回、Owner 交接）重评队列，优先已有 PR 实质收口，无可安全执行项才记录真实阻断。每小时持久化有效证据，不重复巡检、空提交或付费请求。
- **本地 Lead 必须处理 Issues/PR（INTAKE → TRIAGE → ACT → VERIFY → PERSIST）**：先读取 [Workspace Issue #20](https://github.com/OrekiDawson/AD-Oreki-Edition-Workspace/issues/20) 的 Owner、PR/Issue 编号、HEAD SHA、CI、Review 与最新交接，再检查 六仓开放 Issue、Draft/Ready PR、真实 CI 失败及 Kody High/Review Threads；优先本机 AGP/AVD/存档/Playwright 与云端无法完成的独立事项。**有合法授权、无冲突、可安全执行的工作时，不得止步于列表/分析/计划**，须主动完成可执行的修复、分支与 PR、定向验证、审查线程回复及实质修复后解决、推进 Ready/合并满足真实门禁的 PR、关闭确认被替代且无独有内容的历史 Issue/PR，并逐项回读最新状态。任何时间写 GitHub 前先核对并在 #20 留下 Owner、HEAD、操作范围的有效认领；仅实际被其他 Owner 占用的具体对象只读，明确交接后立即恢复；有竞态或归属不明则只读并安全退出。不得争抢分支/工作树/AVD/签名或重复付费审查。按最新 Ruleset/Required Checks、真实审查、预算、五项游戏验收执行；付费授权未知标记 `REVIEW_BLOCKED` 而非偷触发，`Skipped` 不等于 PASS。每小时本地持久化本轮标识、真实动作、证据、阻断与下一步，Issue #20 只在有实质变化时增量同步；不可空 Commit、刷评论、擅建 `/goal` 或 R 编号。
- 详细事实、当轮步骤、当前状态、工具版本、PR、构建回执和历史报告放在对应 `tasks/`、`reports/`、`docs/`；`AGENTS.md` 只留长期约束。任何规则整理不得改写历史任务编号、源代码证据或已发布产物；用户最新明确指令、实际 GitHub 门禁和预算安全约束优先。

### 5.2 持续推进与有效验证

- **继承跨仓权威**：遵循 [Workspace AGENTS.md](https://github.com/OrekiDawson/AD-Oreki-Edition-Workspace/blob/main/AGENTS.md) 的持续执行、短测收敛、Owner 避让和 Subagent 连续调度规则；以该规则实际合并进入 main 后的版本为准，不提前宣称未合并 PR 已生效。
- **阶段完成不等于轮次完成**：当前 Goal active、且仍有已授权、无冲突的安全任务时，Lead/Subagent 在修复、一次短测、一次 PR、一次报告或一次审查后，应立即转向下一项最高优先级工作。只有真实完成、用户暂停、预算/安全硬停止、资源或权限实质阻断、会话退出等才正常停下。不得为了消耗时长或 Token 空转；长任务要在安全检查点收口。
- **测试假设驱动**：每轮定向测试记录候选 HEAD、输入、预期状态变化、实际证据和停止条件；同一代码/条件下不得反复做没有新增验证目标的相同短测，失败先定位根因。Web 的 180 秒检查点续跑仅证明局部挑战进展，不能代替新档 180 分钟完整 PACING、Reality、Pelle 和终局验证；Playwright 探针应清理浏览器和临时依赖。
- **等待外部资源不等于全局停工**：GitHub 对象被其他 Owner 占用、CI/Kody 排队、审批、AVD 或签名资源等待时继续独立安全工作；不争抢已认领对象，明确交接后立即继续对应任务。

### 5.3 环境故障诊断与安全恢复

- **禁止过早 BLOCKED**：遇到 Playwright/浏览器启动失败、依赖缺失、测试服务端口占用、CI 或构建 等环境异常，Agent 必须先在授权时间/权限/预算/Owner 边界内完成有证据的自主定位和最小安全恢复；一次或两次失败、单独的 `offline`、构建工具存在或静态检查 PASS 都不能证明环境不可恢复，也不能把环境失败归咎于 APK/业务代码。
- **诊断闭环**：先核对是否与其他 Agent、AVD、浏览器、构建任务争用资源；收集命令、版本、退出码、stderr/日志、进程/端口、磁盘/内存/OOM、权限及相关设备状态；区分进程退出、连接未就绪、系统未启动、应用安装/启动失败。依据证据逐项选择不同的最小恢复方案，并验证恢复后的真实功能，不按固定次数机械重试。
- **保护现场与密钥**：优先只读诊断、冷启动/禁用快照、兼容渲染或隔离临时环境等非破坏性手段；不得未经核实抢占共享 ADB server、AVD、浏览器或工作树，不清空 userdata、不删他人 AVD、不重置共享环境、不打印/复制密钥、不强推或绕过安全门禁。涉及系统级修改须符合用户已有授权及最小影响原则。
- **BLOCKED 的证据门槛**：只有确认硬件、权限、资源、外部服务、安全限制或不可安全修复的实际阻断，才标记 `ENVIRONMENT_BLOCKED`，附已尝试的互不重复方案、日志/退出码、已排除原因、剩余根因、Owner 和可执行恢复步骤；否则保持 `DIAGNOSING`。独立云端自动化受其单轮截止限制应标 `DEFERRED`，不伪称永久阻断。
- **隔离与持续推进**：环境故障期间继续其他合法、不冲突任务；恢复后重跑受影响的最小真实验证。环境修复成功、CI PASS 或 APK 构建成功均不得代替 Android AVD/真机、Web 真实浏览器、Wiki 线上功能等各自的实际验收。
