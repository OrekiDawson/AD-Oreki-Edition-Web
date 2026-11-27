# Web MOD · Agent 长期规则

> 共性规则以 [Workspace AGENTS.md](https://github.com/OrekiDawson/AD-Oreki-Edition-Workspace/blob/main/AGENTS.md) 为权威；本仓专题细则仍具约束力。开始任务先读 §1 与当前任务/远端状态；修改、审查、发布前按涉及范围读取对应细则，不能以未自动加载为由跳过。最新用户授权、实际平台保护及安全门禁优先。根规则目标 ≤100 行、≤8 KiB；按主题替换旧规则，事实、流程、当前任务分别进入 FACTS、Skill/专项文档、Issue/任务书。

## 1. 总则与授权

[授权与跨仓继承细则](docs/Agent规则/01-总则与授权.md)

### 1.1 统一规则来源与继承
- 六仓既有 PR 实质收口优先于新增 P0，新增业务优先于非阻断架构、规则和目录治理；实际 OPEN PR 合计 ≤5（含 Draft 和预留），ChatGPT 直接授权 PR 例外按 Workspace §4.1，其他 Agent 不得借用。
- 活跃会话恢复、每 60 分钟及关键动作前按 Workspace 规定刷新远端规则、HEAD、Owner、门禁。Lead 每三分钟实质汇报，Subagent 有安全独立任务即续派；等待 CI/Kody 不等于全局停工。
- 用户暂停、权限、安全、预算及资源硬门禁优先；全天执行，无峰谷或固定余额停工。周期预算 80% 预警、100% 或将超额停新增收费，禁止换账号/Provider、擅自充值或绕过限制。
- Coreutils 优先（全局长期强制）：能以标准 Shell、Coreutils、find/grep/sed/awk/jq 可靠完成的不使用 Node.js；仅真实 JS 运行时/生态或可靠性、兼容性必要时例外。PATH 内直接调用命令名，Windows 使用 pwsh，不用 powershell.exe 或绝对可执行路径，除非 PATH 解析或版本冲突。
- 本机项目数据上限 80 GiB，遵循统一回收及资源锁；禁止删除唯一成果、凭据、有效回滚点或他人 WIP。fetch 不等于工作树已同步；仅干净主工作树可安全快进。

### 1.3 任务与 Goal
- R 编号由 ChatGPT 分配；不改历史编号、不添加子编号，活跃 Goal 不重复 /goal 或重置计时。按事实证据验收。

## 2. Web 技术与玩法

[Web 游戏与技术细则](docs/Agent规则/02-Web技术与玩法.md)
### 2.1 Web 技术与游戏约束
- 上游冻结于 2026-07-17 的 5409e320；未经授权不整体升级。使用现有 JS/Node 与 Playwright 手机 Chromium 真实新档，证据绑定源码、部署、运行 ID。
- 双端行为、GUI、中文教程等价；真实合法新档 ≤180 分钟，禁止伪造资源、进度、解锁、挑战、成就、存档和终局。五阶段 0–30、30–75、75–130、130–165、165–180 分钟，首 Reality 早于 70 分钟触发 PACING FAIL 审查，不按时钟强制解锁。节奏明显失败保存证据、停止无效长跑并修复。
- 调度器独占自动购买器与全局控制；开启托管时玩家修改下一有效 tick 按合法状态重算恢复；间隔 1–60 秒默认 10 秒，独立总开关关闭即停止且不擅自重开。不越级、误重置、重复调度或伪结算。
- STD/IAP 商店及商店/广告倍率退役（乘法 ×1、加法 0），保护历史购买字段；原版→MOD→原版真实往返，Android/Web 跨平台不推定可直接互读。GAMEPLAY LEGALITY、PACING、ENDGAME、POST-ENDGAME STABILITY、SAVE COMPATIBILITY 五项独立验收。
- oreki.net 由验证后的 Web 源码部署，Pages 不直接开发业务；详见 [DELIVERY_RULES](docs/DELIVERY_RULES.md)、[FACTS](docs/FACTS.md)。
### 2.2 商店退役与存档互通
- 保留原版存档结构和旧购买记录；商店 UI、支付请求及旧购买增益复活为回归，定向验证。

## 3. Android 跨仓协作

[Android 跨仓协作细则](docs/Agent规则/03-Android跨仓协作.md)
- 全 APK 源码化、AGP/R8、64 位 ABI 与新包名按 Android/Workspace 权威规则；本仓只改实际受影响的共享行为、文档、引用与验证，不抢 Android 业务 Owner。

## 4. 质量、审查与合并

[GitHub 质量与合并细则](docs/Agent规则/04-质量审查与合并.md)
### 4.1 GitHub 审查与质量门禁
- Kody 仅 Balanced；全项目付费在途 ≤3，Android/Web 共享每日 100 次主动审查、80 次预警，Wiki 独立；核实真实授权/Provider/预算，按 HEAD/配置去重。官方 skipped 不计额度、不等于 PASS。
- 必须满足实际 Required Checks、线程解决、审批、Ruleset、Owner 和安全门禁；不强推、不绕过平台保护。纯 AGENTS.md 且 Kody 官方确认规则文件 skipped 按现行例外；其他文件不适用。
- 已有 PR 优先实质收口；规则 PR 逐条继承、合并回读；具备审查条件及时 Ready，不长期 Draft 或重复触发付费。

## 5. 工作方式与环境

[执行与环境细则](docs/Agent规则/05-工作方式与环境.md)
- 关键命令完整 stdout/stderr、退出码、HEAD 与日志落盘；失败先定位根因，最小验证，不重复无新假设的长跑、空轮询、无效审计。按 Owner 隔离工作树、AVD、签名及发布，保护未提交成果。
- 中文文档、Commit、汇报优先；禁止把内部审计、历史记录和任务流水账混入读者正文。新增长期约束先改旧条款；能在 CI 强制的规则尽量使用现有门禁。
