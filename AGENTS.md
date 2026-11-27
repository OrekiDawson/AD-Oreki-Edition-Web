# Web MOD · Agent 长期规则

## 1. 总则与授权
> 启动/恢复先读本根规则与 [Workspace AGENTS.md](https://github.com/OrekiDawson/AD-Oreki-Edition-Workspace/blob/main/AGENTS.md)。跨仓调度、权限、预算、Goal、PR、交付与资源规则由 Workspace 唯一维护；只按当前任务加载其适用专项及下列本仓细则，不全量背诵。细则仍有强制性；最新用户授权、平台保护及安全优先。

- 现有 PR 实质收口优先；六仓 OPEN PR 合计最多 5，含 Draft，ChatGPT 直接授权例外依 Workspace；不得绕过门禁。Kody Balanced、预算与并发遵循权威规则。
- Coreutils 优先：能用可靠 Shell 工具完成不用 Node.js；确需 JS 业务/生态除外。已加入 PATH 的工具直接用命令名；Windows 用 pwsh，不用绝对可执行路径或 powershell.exe，解析/版本冲突等必要例外除外。
- 关键命令完整日志落盘，真实退出码、HEAD、证据；失败先定位根因。只做最小必要验证，不重复无价值构建/审计。
- Lead 每 3 分钟真实反馈；有授权且可安全执行时持续推进，Subagent 完成即核验再派，不争抢 Owner/独占资源。当前 Goal 不重开、不改编号、不重置计时。
- 根 AGENTS.md 目标 ≤100 行且 ≤8 KiB、连续章节编号；新增规则先合并旧条，事实归 FACTS、任务归 Issue、流程归专项/Skill、机器可验证约束归 CI。README 面向读者。

### 1.1 统一规则来源与继承
- [授权、继承与 Goal 细则](docs/agent-policy/01-授权与继承.md)。

## 2. Web 技术与玩法

### 2.1 Web 技术与游戏约束
- 冻结上游 2026-07-17 Commit 5409e320，未经授权不整体升级；Android/Web 玩家可见行为及中文教程等价，MOD 独有内容仅附录 F。
- 真新档 ≤180 分钟，五阶段自然展开、边界 ±5 分钟，首次现实早于 70 分钟触发 PACING FAIL；禁止伪造资源、结算、成就、解锁、存档、终局，不能用刷新或定时强开阶段凑数。
- 调度器独占全局及逐项自动购买器，玩家修改下一有效 tick 恢复；周期 1–60 秒、默认 10 秒，独立 MOD 总开关关闭即停止，不误重置、不越级、不抢手动。
- Web 关闭新闻，优先 Android Chrome 手机视口；真实 Chromium/Playwright 验证资源、阶段、购买、GUI、存档，按改动范围做最小必要测试。五项门禁独立记录，PACING FAIL 立即停止该候选的无效长跑及稳定晋升。
- [Web 游戏契约及跨仓技术细则](docs/agent-policy/02-Web玩法与协作.md)，改动机制、节奏或存档前读对应章节。

### 2.2 商店退役与存档互通
- 删除独立 STD/IAP 商店、支付、商店/广告加成、时间跳；保留 IAP/shopPurchases 兼容字段及历史购买记录，不允许旧购买态复活增益。
- 同平台官方原版↔MOD 实际双向存档往返；跨 Android/Web 载体未经真实验证不得宣称互通。

## 3. Android 跨仓协作
- Android 源码化、标准 AGP/R8、64 位 ABI 与包名迁移由 Android 主责；Web 仅修改真实受影响的共享玩法/接口/教程/存档，不代做 Android 工程。

## 4. 质量、审查与合并

### 4.1 GitHub 审查与质量门禁
- 当前 HEAD 的 Required Checks（Node checks/Mobile Chromium smoke 以实际规则为准）、Kody、Review Threads 和 Ruleset 满足才合并；纯 AGENTS.md 官方 skipped 例外按 Workspace，不能扩大。
- oreki.net 由 Pages 部署副本接收已验证 Web 源码，禁止绕过源仓或直接拼改生产部署；验证上线 SHA、移动端、存档与受影响行为。
- [审查、运行与环境细则](docs/agent-policy/03-质量与执行.md)。

## 5. 工作方式与环境
- 复用事实和真实运行证据，关键动作前及时刷新规则与 HEAD；安全同步，不覆盖 WIP，不以构建或历史版本结果冒充本版实际验收。
