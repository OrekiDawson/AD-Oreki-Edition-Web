# R107-01 P1：阶段化自动节拍（stage-capped beat）实现与验证

> 目标：解决「默认 10 s 节拍下 180 min 仍卡 realities 15」——MOD 自动化在现实数少的阶段
> 需要更高购买/结算频率，而玩家配置不应被改动。方案：effectiveInterval = min(玩家配置, 阶段上限)。
> 状态标记：已证实 / 推断 / 未验证 分开写；本目录只放本次 P1 的证据。

## 1. 实现（Web 生产代码，未 commit）

**文件**：`src/core/oreki-smart-executor.js`

- 新增常量/函数：`STAGE_BEAT_CAPS`、`readRealitiesForBeat()`、`stageBeatCapSec()`、`effectiveBeatMs()`。
- 闸门与倒计时改用 effective 值：`taskGateFree`、`globalGateFree`、executor `waitMs`、
  `debugState().beat.nextInMs`。
- 只读探针：`OrekiSmartExecutor.effectiveIntervalSec`、
  `debugState().effectiveIntervalSec / stageCapSec`。
- **不改**：玩家配置 `intervalSec`、UI 输入/展示、localStorage、`player` 字段、
  游戏结算/资源/进度、原版自动购买器（`Autobuyers.tick` 不经过本调度器）。
- 读不到 `player.realities`（Node 夹具/初始化中）→ cap=Infinity，保持旧行为。

分档与依据见 [SEMANTICS.md](SEMANTICS.md)：

| realities | cap | 依据 |
|---|---|---|
| 0 | 1 s | 首无限→Break→首永恒→首现实链（Android AVD 实测默认 10 s 首现实 42.4 min，1 s 档 16.3 min；R50 旧默认 3 s 曾 739.6 s 通关） |
| 1–9 | 2 s | 现实奖励/升级重复期 |
| 10–49 | 3 s | 现实树/天神期 |
| >=50 | 5 s | Laitela/Pelle 后期，策略决策为主 |

配套静态回归：新增 `scripts/test-stage-beat-cap.mjs`（19 项）并加入 CI 列表
（`.github/workflows/ci.yml`，R107-01 P1 注释）。

## 2. 真实验证（默认设置，不注入 interval/速度）

跑次：`run-default/`（Playwright + Chromium，Pixel 7 移动视口；全新存档；默认 10 s 配置、
动态速度默认开启；只关教程/弹窗，不改任何设置）。

**状态：PARTIAL（Lead 启动 Android 默认 180 min 跑次、要求独占 CPU，本跑次在观察窗口
1337.8 s 时主动停止；完整 30–45 min 跑次待另约浏览器窗口）。**
证据：`run-default/summary-partial.json`（由 samples.jsonl + milestones 回填）。

| 里程碑 | wall（默认 10 s 配置，实际 effective=1→2→3） |
|---|---|
| 首无限 | **6.3 s** |
| Break | **10.4 s** |
| 首永恒 | **83.2 s** |
| 首次 reality | **427.0 s** |
| realities=5 | 427.0 s |
| realities=10 | 706.8 s |
| realities=15（旧默认 180 min 的卡点） | **938.8 s** |
| realities=20 | **1177.4 s** |
| 观察结束 | 1337.8 s，realities=20，stage=celestialsTeresa，goal=unlock-effarig |

- 实际生效节拍 / 配置未被改写：`configuredIntervalSec=10`、`storedInterval=null`（默认未写盘）、
  realities=0 时 `effective=1`，r5 起 `effective=2`，r10 起 `effective=3`（与分档一致）。
- 页面未出现 pageerror（终止前未捕获到错误；终止时脚本未写 summary）。

## 3. 对照（旧默认 10 s 基线，量化）

| 指标 | 旧默认 10 s（`reports/R107-01/run-180min`） | 本次默认 10 s + stage cap | 变化 |
|---|---|---|---|
| 首次 reality | 2024.3 s | **427.0 s** | **≈4.74× 更快** |
| realities=15 | 3969.4 s | **938.8 s** | **≈4.23× 更快** |
| realities=20 | 未到达（180 min 卡 15） | **1177.4 s** | 旧配置 180 min 未达到 |
| 首永恒 | 524.3 s | **83.2 s** | ≈6.3× 更快 |
| 首无限 | 24.4 s | **6.3 s** | ≈3.9× 更快 |

> 口径说明：旧基线是在宿主高负载（load 25–31）下记录；本次跑次宿主 load ≈15 且中途被终止。
> 数字按「争抢环境」记录，绝对值有波动，但「首次现实/ realities 15 由分钟级 4000 s 级降到
> 1000 s 级」的方向与量级明确；Android AVD 默认配置实测为 42.4 min → 16.3 min（Lead 提供）。

## 4. 结论

- **已证实**：默认 10 s 配置下，Web MOD 自动化实际按阶段上限运行（1→2→3 s），
  前中期 milestone 显著提前；realities 突破旧默认的 15 卡点（19.6 min 到 r20）。
- **推断**：若跑满 30–45 min，按本次趋势应能到 r30+；180 min 内通关可行性显著提高，
  但仍需完整默认配置跑次验证（见待验证清单）。
- **未验证**：完整 30–45 min 默认跑次（本次 22.3 min 被终止）、180 min gameEnd 跑次、
  长稳/存档重载后的节拍一致性。

## 5. 回归：定向验收 49/49——PASS

- 最终一次：`reports/R107-01/accept-r107-01-after-beat-rerun3.log` → **49/49 PASS（EXIT:0）**。
- 验收脚本按新语义调整 3 处**测试断言**（生产行为不变，原因与 diff 见 §5.1）：
  1. S3 基线节拍：从「固定 10 s gap」改为「min(10, 阶段上限) 的实际 gap」；
  2. S3 60 s 项：60 s 仍是存储/UI 配置，但实际节拍受阶段上限约束（断言
     `effective = min(60, cap)` 与观测 gap 一致）；
  3. S1 无意义切页/业务仍执行：临时关闭原版 `automaticTabSwitching`（解锁跳页是原版行为，
     非 MOD 切页），并用累计 `served/lastBeatAt` 替代会饱和的 12 条 beat.log 计数；
     Decimal 资源比较改用 log10（避免 float Infinity 相等）。
- 中间失败记录（透明保留）：`accept-r107-01-after-beat.log`（46/49）、
  `...-rerun.log`（48/49）、`...-rerun2.log`（48/49），失败原因均为上述测试口径，
  修正断言后 49/49。

## 6. 静态测试（非浏览器）

CI 列表（`.github/workflows/ci.yml`）全部 PASS：
`check_stage_gate`、`check_eternity_gate`、`test-r100-newgame-autobuyers`、
`test-scheduler-beat`、`test-r91-early-beat-share`、`test-r88-executor-clock`、
`test-r90-early-routine-beat`、`test-r87-break-id1-reserve`、**新增 `test-stage-beat-cap`（19/19）**、
`check_deploy_workflow`、`validate_tutorial`。

非 CI 的 3 个脚本 `check_crunch_policy` / `check_crunch_modes` / `check_managed_crunch_interval`
仍失败；已在 **HEAD（未含本次改动）** 的干净导出里复现同样失败，属既有问题、与本次改动无关
（不在 CI 列表，未在本次扩大范围修复）。

## 7. 证据文件

| 文件 | 内容 |
|---|---|
| `SEMANTICS.md` | Web/Android 共用语义规格（公式、分档、依据、观测接口） |
| `DOCS-SNIPPETS.md` | FACTS / WEB_ANDROID_DIFFERENCES 建议片段 |
| `run-default-beat.mjs` | 默认设置真实新档跑次脚本（可续跑） |
| `run-default/` | samples.jsonl、milestones-*.json、summary-partial.json、screenshots、run.log |
| `run-default.stdout.log` | 跑次 stdout |
| `host.log` | 跑次开始/停止时的宿主负载与原因 |

## 8. 待验证清单（待 Lead 安排浏览器窗口）

1. 完整 30–45 min 默认设置（不注入 interval/速度）跑次：确认 r30+、记录 fps/速度/节拍；
2. 默认设置 180 min / gameEnd 跑次：确认 180 min 门禁是否 PASS；
3. 刷新/读档后：UI 仍显示玩家配置（默认 10 s），effective 按 realities 重算；
4. Android 侧同语义已 AVD PASS（Lead：默认 10 s 不变，首 reality 42.4→16.3 min），
   双端里程碑对照可补一张表。
