# R120-01 Web：调度器对受管自动购买器拥有最高控制权

## 结论

- 受管配置下一调度 Tick 无条件恢复：**PASS**
- 真实 Chromium 小范围定向验收：**PASS**
- 定向 Node 回归：**PASS**
- 整合后 180 分钟终局长跑：见
  `reports/R120-01/web-full-scheduler-final/summary.json`（运行中/最终状态以该文件为准）
- 未解锁自动器提前配置：**FAIL-CLOSED**（跳过，不写）

## 实现

- `src/core/oreki-managed-autobuyer-state.js`
  - 调度 Tick 是启停、购买模式、限额、献祭阈值及大坍缩阈值的唯一恢复时机；
  - 同 Tick 只应用一次；目标已相等时不写；
  - 大坍缩启停严格跟随当帧策略，`null` 决策时不猜；
  - 未解锁/不可读项跳过，不使用固定全开绕过阶段门禁。
- `src/core/oreki-managed-crunch-interval.js`
  - 同一调度 Tick 统一恢复大坍缩 `mode=TIME` 与策略 `time`；
  - 关闭 MOD 后按原记录恢复玩家原值；同一 Tick 与相等值均不重复写。
- `scripts/check_managed_autobuyer_state.mjs`
  - 覆盖启停双极性、模式、限额、阈值、多项统一恢复、阶段反转、
    存档重载、未知态与重复 Tick 幂等。
- `scripts/verify-managed-autobuyer-authority.mjs`
  - 等待新档真实首次无限后，在真实 `player.auto` 与真实原版存档入口上验收。
- `reports/R107-01/runner/run-180min.mjs`
  - 源码根改为按脚本位置解析，避免隔离工作树意外验证另一分支。

## 受管字段范围

- 反物质维度 1～8：`isActive`、`mode=BUY_10`
- 计数频率：`isActive`、`mode=BUY_SINGLE`（保持已验证基线）
- 维度提升：`isActive`、`limitDimBoosts=false`、`limitUntilGalaxies=false`
- 反物质星系：`isActive`、`limitGalaxies=false`
- 献祭：`isActive`、`multiplier=2`
- 无限点数倍率：`isActive`（已合法进入无限层后）
- 大坍缩：`isActive`、`mode=TIME`、`time`、`amount=10`、
  `xHighest=10`、`increaseWithMult=false`
- 调度动作优先级继续由现有 `OrekiSmartExecutor` 策略提供；没有第二套优先级状态。

## 真实浏览器证据

- 浏览器：Chromium `159.0.8154.6`，412×915 手机视口；
- 前置：全新存档，合法完成首次无限；
- 定向检查：17/17 PASS；
- `pageerror=0`、`console error=0`；
- 覆盖真实修改、同 Tick 临时保留、下一 Tick 恢复、阶段开/关反转、
  `mode/time` 恢复、幂等、原版存档写入与 reload 后恢复、关闭 MOD 后写回
  玩家原值（且不覆盖最后一次托管写入后的玩家手改）；
- 证据：`reports/R120-01/scheduler-authority/summary.json`、
  `reports/R120-01/scheduler-authority/managed-authority-final.png`。

## 定向 Node 结果

- `check_managed_autobuyer_state.mjs`：25 PASS / 0 FAIL
- `check_stage_gate.mjs`：18/18 PASS
- `check_eternity_gate.mjs`：178/178 PASS
- R100 新档自动购买器：39/39 PASS
- 调度器行为：22/22 PASS
- 托管 Tick：17/17 PASS
- 受管大坍缩节拍夹具：44/44 PASS

