# R107-01 第二阶段：EP e4000 墙根因、最小修复与验证

> 范围：只改 Web 生产代码 1 个文件（+29 行），未 commit/push；未改 Android 仓库；未写任何游戏进度字段。
> 结论标记：**已证实 / 推断 / 未验证** 分开写，禁止把静态推断当 PASS。

## 结论摘要

- **根因（已证实）**：R104 为打通首次永恒，接管了原版「自动永恒」开关
  （`oreki-eternity-automation.js::_adoptEternityAutobuyerIfNeeded`），但保留了默认
  `mode=AMOUNT/amount=1`。该配置会在 `Player.canEternity` 为真时**立即结算永恒**；
  而 IP 被动生成让 canEternity 很快恢复，形成近每帧永恒重置：
  `thisEternity.maxIP` 永远钉在 SIP2 起始值 5e130，`gainedEP≈1e5.4` ≪ 当前 EP e3683
  ⇒ EP 冻结、realities 卡 15、`isRealityAvailable()` 永假。
- **最小修复**：接管时若原版配置仍为默认值，改一次
  `mode=X_HIGHEST(2), xHighest=10`（= R50 的「EP 收益 ≥ 当前 EP ×10 才永恒」门槛）。
- **验证（真实新档，interval=1）**：
  - 10000×：r5 410.8 s、r10 573 s、r15 654.2 s、r20 731.2 s、**r50 1055.4 s**；
  - 100000×：r50 1011.9 s；两跑次均无冻结签名、pageErrors=0；
  - 49/49 定向验收 **PASS**。
- **未完成项**：gameEnd 30 min 窗口内未到；默认间隔 180 min 全量跑次 **NOT RUN**。

## 目录

| 文件 | 内容 |
|---|---|
| `ROOT-CAUSE.md` | 根因链、冻结现场实测、R50 对照、排除项、残留不确定 |
| `FIX.md` | 单文件 diff、语义、为什么最小、风险与回滚 |
| `VERIFICATION.md` | 修复前后对照、真实跑次里程碑、49/49、状态总表 |
| `ANDROID.md` | Android PR #15 判断、Web/Android 差异、待移植清单（未改 Android 仓库） |
| `DOCS-SNIPPETS.md` | `docs/FACTS.md` 与 `WEB_ANDROID_DIFFERENCES.md` 的建议片段 |
| `static-regression-diff.md` | R50→HEAD 静态回归点（R1 连续购买路径不再每帧、R2 默认节拍 3→10s、R3 坍缩策略、R4 门槛） |
| `ab-freeze-timeline.json` | A/B 主跑冻结前后时间线 |
| `diag-stall2/` | 修复前冻结复现：60 s 持续判定 + 200 ms 逐帧跟踪 |
| `diag-stall3/interactive-diag.json` | 修复前冻结现场交互诊断（canTick 子条件/lastTick/手动调用） |
| `verify-fix/` | 修复后 12 min 定向验证（r15→r20+） |
| `verify-fix-long/` | 修复后 10000×、17.6 min 到 r50 |
| `verify-gameend-100k/` | 修复后 100000×、16.9 min 到 r50 |
| `verify-gameend-focus/` | 修复后 gameEnd 专项尝试（30 min 上限） |
| `probe-ep-wall-a/`、`probe-ep-wall-b/`、`probe/` | 修复前 20000×/100000× 复现探针 |
| `diag-host.log` | 各跑次开始时的宿主负载记录 |

## 生产改动

仅 `src/core/oreki-eternity-automation.js`（+29 行，见 `FIX.md` 的 diff）：
接管原版自动永恒时，若配置为默认 `AMOUNT=1/xHighest=1` 且本会话未配置过，
改一次 `mode=X_HIGHEST, xHighest=10`。不覆盖玩家自定义、不改 EP 公式/除数/现实门槛/存档字段。

## 复现命令

```bash
# 修复后定向验证（r15→r20+）
node reports/R107-01/ep-wall-fix/verify-ep-wall-fix.mjs

# 延长验证（默认 10000×，可用 FIX_SPEED / STOP_REALITIES / MAX_WALL_SEC 调整）
DIAG_OUT=verify-fix-long MAX_WALL_SEC=1800 FIX_SPEED=10000 \
  node reports/R107-01/ep-wall-fix/verify-ep-wall-long.mjs

# 定向验收 49/49
node reports/R107-01/accept-r107-01.mjs
```
