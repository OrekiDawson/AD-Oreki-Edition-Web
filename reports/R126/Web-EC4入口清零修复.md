# R126 Web EC4 入口清零修复

- 日期：2026-11-23（UTC+8）
- 分支：`r126/web-ec4-deadlock-main`
- 当前 HEAD：`4563ec3cdb805399e11aa2330b952bf786126329`
- 基线：`origin/main` `00733331ac52b97924bfa08e9c124ec189cfd3f1`

## 症状与根因

R125 的 35× 真实新档在 `t=3081.1s` 后把下一目标固定为 EC4，但自动永恒持续执行原版重置，
把 `Currency.infinitiesTotal` 清零；采样最高仅 `10064 / 1000000`，并发生 16 次回落。
当时用于长跑的候选分支还包含单目标过滤，使 EC5、EC7～EC10 虽可购买却永久饥饿。
当前 `main` 的购买循环本身会遍历原版 `canBeBought`，不存在该过滤器；本 PR 不改购买顺序，
只增加行为回归守卫，防止以后为了“单目标优先”再次引入永久饥饿。

## 修复

1. EC4 不再排除在入口等待保护之外：主研究已买、只差原版入口资源时暂停自动永恒，
   但大坍缩与真实无限次数生产继续运行。EC1 仍按“入口资源就是永恒次数”保留例外。
2. 入口峰值达标后不立即释放保护，保持到原版 `TimeStudy.eternityChallenge(4)` 研究已买下
   或挑战已真实解锁，避免 2 秒 EC 购买窗口内被逐帧自动永恒再次清零。
3. 新增回归测试锁定当前主线的合法降级行为：EC4 暂不可购买时，仍可通过原版
   `canBeBought` 与真实购买入口推进一个其他可完成目标；不写完成位、不发资源、不直接解锁挑战。

## 验证

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| `node scripts/check_eternity_gate.mjs` | PASS | 250 项，失败 0 |
| `node scripts/check_managed_autobuyer_state.mjs` | PASS | 27 PASS / 0 FAIL |
| `node --test scripts/tests/test_web_full_run_policy.mjs` | PASS | 17/17 |
| 生产模块、测试与探针语法 | PASS | `node --check` 全部通过 |
| Git 空白错误 | PASS | `git diff --check` 无输出 |
| 真实存档回归短程 | PASS | 已买下 EC4 研究的存档完成数 `3→4`，墙钟约 `41.2s`；仅作回归，不冒充入口等待分支证据 |
| EC4 未买、只差入口的诊断夹具 | PASS | `ecEntryPending=true`，真实 tick 越过 `1e6`，EC4 `0→1`，约 `20.1s` |
| 页面/控制台/运行错误 | PASS | `errors=[]`，`runtimeError=null` |
| 自动永恒开启下的入口推进 | PASS | `enableEternityAutobuyer=true`，EC4 仍完成一次 |

## 真实短程证据

- 输入存档：`网页端/savestates/327. 3.6e28EP+243TT+EC5×5.txt`
- 输入 SHA-256：`6ea4415fdb32d7b82ddfa304b6abeb8572f47ccc2d6fbe425593d0a77fd2fa66`
- 浏览器：Playwright Chromium，412×915，手机视口、触控、简体中文、Asia/Shanghai
- 采样：40 条，1 秒间隔；EC4 完成后按探针提前停止
- 初始 EC 完成数：`[5,5,5,3,5,3,3,1,0,0,0,0]`
- 最终 EC 完成数：`[5,5,5,4,5,3,3,1,0,0,0,0]`
- 初始 `infinitiesTotal` 指数：`7.14765`
- 最终 EC4 累计入口指数：`6.30103`（已越过 `1e6` 门槛）
- `summary.json` SHA-256：`f1b4ef3577123931aaa2325209e7fb293162f2a4cd749ac3b0688284cd3612d7`
- `checkpoint.txt` SHA-256：`98940292a8e3c2bac5f79ef6dfbd6b37281fa6b86f4f5f3be10601d4a0495848`

### 入口等待分支诊断夹具

首条真实存档回归样本的 EC4 研究已经买下，不能证明新增的“峰值达标后继续等待购买”分支。
因此使用同一真实存档、在测试页内明确构造以下边界，并保留夹具状态与改动说明：

- EC1～3 完成数 `5,5,5`，EC4 完成数 `0`；
- 143 普通研究已买，EC4 研究未买、挑战未解锁；
- `infinitiesTotal=0`，随后只由生产大坍缩/无限次数路径增长。

该夹具只验证诊断分支，不是自然新档，也不计入 `GAMEPLAY LEGALITY / PACING / ENDGAME`。

| 采样 | 结果 |
| --- | --- |
| 夹具即时状态 | `primary143Bought=true`、`entryPending=true`、`entryMet=false`、`bought=false` |
| 首次正常采样（0.8s） | 自动永恒开启，`infinitiesTotal` 已越过 `1e6`，EC4 尚未买下，`entryPending` 仍为 true |
| 完成（20.1s） | EC4 完成数 `0→1`，入口等待解除，`errors=[]` |
| 证据 | 96 条、100ms 采样；`summary.json` `d61862b4…b623`；`checkpoint.txt` `9b629dcc…7065` |

## 未运行与合并边界

- 完整新档首次 Reality 到 Pelle/Credits 的 180 分钟长跑：`NOT RUN`
- `GAMEPLAY LEGALITY / PACING / ENDGAME / POST-ENDGAME STABILITY`：`NOT RUN`
- 原版↔MOD 双向存档矩阵：`NOT RUN`
- Android 等价 AVD 运行：`NOT RUN`

本 PR 是 EC4 P1 修复，不宣称 PACING 或终局 PASS；完整新档、存档矩阵和 Android 真实验收仍按各自证据独立判定。
