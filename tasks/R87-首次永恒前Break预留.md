# R87：首次无限→首次永恒的真实成长瓶颈（Web）

## 状态

生产修复与定向测试完成；提交、Pages 部署按本任务收尾记录。未运行完整浏览器矩阵。

## 根因

首次永恒前，`BigCrunchAutobuyer.waitingForId1Peak` 依赖「无限点数 ≥ ID1 的 `ipRequirement`」暂停自动坍缩，以便把本纪反物质峰值攒到 ID1 门槛。R82 只给无限升级路径加了 ID1 资金预留；Break Infinity 升级自动购买是独立任务，原规则只有「单笔 ≤ 当前 IP 的一半」，**不能保证买完仍高于 ID1 门槛**。IP 恰好接近门槛时，一笔便宜升级即可把余额压到门槛以下，HOLD 解除、下一次坍缩清零反物质，ID1 峰值从头再爬。

## 生产修改

- `src/core/oreki-autobuy-break-infinity.js`
  - 复用 `OrekiEarlyAutomation.shouldReserveIpForId1()` 与 `leavesId1Reserve(cost)`，不复制门槛、不写死 1e8。
  - 首次永恒前、ID1 未解锁、IP 已达原版门槛时，跳过任何「真实扣费后会跌破门槛」的 Break 升级；其余仍按原版最便宜优先购买。
  - 购买仍调用 `upgrade.purchase()`，不写 `breakInfinityUpgradeBits`、不伪造扣费或奖励。
- `src/core/oreki-early-automation.js`、`src/core/oreki-iu15-sprint.js`：保留并提交既有 R85 的 Oreki 智能开关让路逻辑，避免关闭智能自动化后仍被 MOD 接管。
- `src/core/oreki-tutorial-data.json` + 同步生成的 `.gen.js`：附录 F 新增「十九、打破无限后的升级不再抢走 ID1 的点数」。

## 验证（定向）

| 项目 | 命令 | 结果 |
|---|---|---|
| 新增 Break 预留行为夹具 | `node scripts/test-r87-break-id1-reserve.mjs` | **13/13 通过** |
| 既有 IP 倍率购买夹具 | `node scripts/test-early-ipmult.mjs` | **7/7 通过** |
| 既有 ID1 成长链夹具 | `node scripts/test-r82-id1-growth.mjs` | **17/17 通过** |
| 教程结构/术语/数值校验 | `node scripts/validate_tutorial.mjs` | **2189/2189 通过** |

覆盖边界：IP 恰好等于门槛、略高于门槛、连续 30 拍、HOLD 不解除、ID1 已解锁、首次永恒后、IP 未到门槛、远高于门槛、自动购买器关闭、Oreki 智能开关关闭、可重复升级真实成本、原版 `purchase()` 位图与余额同步。

## 未覆盖

- 未运行真实浏览器/新档墙钟；本次为纯游戏逻辑修复，按项目规则复用既有 Android Chrome 基线验收，不冒充新浏览器验收。
- 未验证真实 3 小时通关时间；逻辑收益是消除 ID1 HOLD 被 Break 商店打断的回归，不等同于全流程缩短百分比。
