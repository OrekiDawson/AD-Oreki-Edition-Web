# Web MOD · Agent 长期规则

> 跨仓共性规则以 [Workspace AGENTS.md](https://github.com/OrekiDawson/AD-Oreki-Edition-Workspace/blob/main/AGENTS.md) 为唯一权威。启动先读该入口、本文件、当前任务与必要事实；涉及对应事项必须先读以下细则适用章节，不默认全文加载所有细则。共享重复条款不作为另一权威来源，最新用户授权与 Workspace 权威口径优先；根入口的按需加载及 PATH 约定覆盖旧措辞，不降低安全、预算、审查、CI、验收或发布门禁。根 AGENTS.md 目标 100 行、8 KiB，复杂例外说明；规则按主题编号、避免重复，临时任务进 Issue、事实进 FACTS、可机器检查约束进 CI。

## 1. 总则与授权

- 继承 Workspace 权威规则，不重复跨仓约束。真实授权、预算、Owner、任务编号与 Goal 按 Workspace 执行。
- 详细口径：[执行细则 1](docs/agent-policy/执行细则-01.md)。

### 1.1 统一规则来源与继承
- 详见[执行细则 1](docs/agent-policy/执行细则-01.md)对应章节。

### 1.2 游戏优先与规则审查边界
- 详见[执行细则 1](docs/agent-policy/执行细则-01.md)对应章节。

### 1.3 授权、预算与运行状态
- 详见[执行细则 1](docs/agent-policy/执行细则-01.md)对应章节。

### 1.4 任务编号与 Goal
- 详见[执行细则 1](docs/agent-policy/执行细则-01.md)对应章节。

## 2. Web 技术与玩法

- 冻结独立上游，与 Android 同条件可见行为等价。关闭新闻及商店/加成，双向原版存档互通；调度器独占全部自动购买器、原版全局按钮，周期 1–60 秒默认 10 秒，手改下一 tick 恢复。简体中文教程，MOD 独有仅附录 F；Playwright 手机视口、真实新档 ≤180 分钟，五阶段节奏和五项独立门禁；PACING FAIL 停止无效长跑及不合格合并发布，定向修复。存档双向不通过阻断稳定交付。
- 详细口径：[执行细则 2](docs/agent-policy/执行细则-02.md)。

### 2.1 Web 技术与游戏约束
- 详见[执行细则 2](docs/agent-policy/执行细则-02.md)对应章节。

### 2.2 商店退役与存档互通
- 详见[执行细则 2](docs/agent-policy/执行细则-02.md)对应章节。

## 3. Android 跨仓协作

- 仅协作实际受 Android 源码化、AGP、ABI 或包名迁移影响的 Web 引用/共享逻辑，不额外承担 Android 本机任务。维持双端一致。
- 详细口径：[执行细则 3](docs/agent-policy/执行细则-03.md)。

### 3.1 P1 全量 Smali/DEX 清零
- 详见[执行细则 3](docs/agent-policy/执行细则-03.md)对应章节。

### 3.2 P1 AGP 与目录治理
- 详见[执行细则 3](docs/agent-policy/执行细则-03.md)对应章节。

### 3.3 P1 64 位 ABI 与测试设备
- 详见[执行细则 3](docs/agent-policy/执行细则-03.md)对应章节。

### 3.4 P0 包名变更的 Web 协作
- 详见[执行细则 3](docs/agent-policy/执行细则-03.md)对应章节。

## 4. 质量、审查与合并

- Required Checks、Kody Balanced、Ruleset、线程、预算/Owner 按实际 HEAD 核验；Node checks 与 Mobile Chromium smoke 依范围及平台门禁执行。纯 AGENTS.md 官方 skipped 例外按 Workspace，含细则不适用。
- 详细口径：[执行细则 4](docs/agent-policy/执行细则-04.md)。

### 4.1 GitHub 审查与质量门禁
- 详见[执行细则 4](docs/agent-policy/执行细则-04.md)对应章节。

#### 4.1.1 仅规则变更时的 Kody skipped 例外
- 详见[执行细则 4](docs/agent-policy/执行细则-04.md)对应章节。

## 5. 工作方式与环境

- Coreutils/Shell 优先，PATH 命令名；仅确需 JS 的业务/前端/Playwright 等使用 Node。关键日志落盘、最小必要定向测试，保护 WIP、安全同步，避免重复长跑和空轮询。
- 详细口径：[执行细则 5](docs/agent-policy/执行细则-05.md)。

### 5.1 执行效率与反馈
- 详见[执行细则 5](docs/agent-policy/执行细则-05.md)对应章节。

### 5.2 持续推进与有效验证
- 详见[执行细则 5](docs/agent-policy/执行细则-05.md)对应章节。

### 5.3 环境故障诊断与安全恢复
- 详见[执行细则 5](docs/agent-policy/执行细则-05.md)对应章节。
