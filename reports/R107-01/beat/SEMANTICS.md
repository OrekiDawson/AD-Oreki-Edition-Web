# 阶段化节拍（stage-capped beat）语义规格（Web ↔ Android 共用）

> 状态：Web 已实现（\`src/core/oreki-smart-executor.js\`，未 commit）；Android 由 hook-migrate 同步实现，
> 两端必须按本文档同一张表、同一公式落地，并在各自 FACTS 记录实现位置与验证证据。

## 1. 公式

\`\`\`
effectiveIntervalSec = min(player.intervalSec, stageCapSec(player.realities))
\`\`\`

- \`player.intervalSec\`：玩家在「选项 → 游戏玩法 → 智能自动操作」里配置的 1~60 s，
  是**上限**，继续按原语义持久化到存档/localStorage，UI 输入值与展示值**不变**。
- \`stageCapSec(realities)\`：按下表取值。
- 只有 **MOD 自动化调度器**（阶段任务 tick + 执行层 verb）使用 effective 值；
  **原版自动购买器**（Autobuyers.tick、原版永恒/坍缩自动器等）不经过该调度器，不受影响。
- 不写 \`player\` 字段、不改 UI、不改游戏结算/资源/进度。
- 读不到现实数（初始化中 / Node 夹具）时 cap = Infinity，即退回旧行为（仅受玩家配置约束）。

## 2. 分档（当前实现）

| realities | stageCapSec | 依据 |
|---|---|---|
| \`== 0\` | 1 s | 首无限→Break→首永恒→首现实链最需要高频；Android 实测默认 10 s 首现实 ≈42 min，1 s ≈14.6 min；Web R50 旧默认 3 s 曾 739.6 s 通关，R85 改 10 s 后显著变慢 |
| \`1 ~ 9\` | 2 s | 现实奖励/升级重复期，仍以购买与结算频率为主 |
| \`10 ~ 49\` | 3 s | 现实树/天神（Teresa/Effarig/Enslaved）阶段，策略决策占比上升 |
| \`>= 50\` | 5 s | Laitela/Pelle 等后期内容，动作以策略决策为主 |

分档可微调，但两端必须同步改表并更新本文档与 FACTS；不允许一端单独改。

**双端实测（2026-11-14）**：
- Android（Lead AVD，默认配置、不注入 interval）：首 reality 由 42.4 min 缩短到 **16.3 min**，
  UI/存储仍为默认 10 s，`effective=min(配置,cap)` 按分档生效 —— **PASS**。
- Web（本目录 `run-default/`，默认设置、不注入 interval/速度，观察 1337.8 s 后被 Lead 叫停）：
  首无限 6.3 s、Break 10.4 s、首永恒 83.2 s、首 reality 427.0 s、r10 706.8 s、r15 938.8 s、
  r20 1177.4 s；`configuredIntervalSec=10 / stored=null`，effective 依次为 1→2→3 —— 与分档一致。

## 3. 观测接口（供探针/验收）

Web：\`OrekiSmartExecutor.intervalSec\`（玩家配置）、
\`OrekiSmartExecutor.effectiveIntervalSec\`（实际生效）、
\`OrekiSmartExecutor.debugState().stageCapSec\` / \`.effectiveIntervalSec\` / \`.beat.nextInMs\`（按 effective 计算）。

Android hook-migrate 对应实现建议暴露同名只读探针（或等价测点），便于双端对照。

## 4. 与旧行为差异

- 旧：任意两次 MOD 真动作间隔 ≥ 玩家配置（默认 10 s）。
- 新：间隔 ≥ min(玩家配置, 阶段上限)。玩家配置仍是上界；阶段上限只会让节拍**更快**，不会更慢。
- UI「调度间隔 10 秒」与实际生效值可能不同（例如 realities=0 时实际 1 s），这是有意设计；
  面板/文档需说明「配置为上限，前中期会按阶段加快」。
