# Web 阶段速度校准与 PACING 修复

日期：2026-11-22（UTC+8）

## 结论

当前候选真实新档在 `2527.8s`（约 42.1 分钟）首次进入 Reality，低于规则允许的最早边界 70 分钟，因此判：

- `PACING = FAIL`
- `PROGRESSION = BLOCKED`
- `GAMEPLAY LEGALITY / ENDGAME / POST-ENDGAME STABILITY / SAVE COMPATIBILITY = NOT RUN`

运行器按 `first-reality-before-70-minutes` 自动停止，不再把余下时间当作 180 分钟验收。

## 真实证据

运行目录：

`/home/oreki/AD-Oreki-Edition/测试与验收/R125/Web-PACING-180分钟-真实去注入-20261122`

- 源码 Commit：`1176c363d0e9dc705f068de345141942937c48ed`
- 首次 Infinity：`20.7s`
- 首次 Break：`592.4s`
- 首次 canEternity / dwell 起点：约 `712.7s`
- 首次 Eternity：`903.4s`，距 180 秒 dwell 结束约 `10.7s`
- 首次 Reality：`2527.8s`
- 采样：254 条
- 截图：44 张
- runtime errors：0
- console errors：0
- 连续性最大偏差：`0.003658585s`

首次 Eternity 的调度修复有效：驻留结束后只多等待一个默认调度拍，未复现旧版约 100 秒饥饿延迟。

## 根因

首个 Reality 前的阶段速度为 `500×` 校准前的 `1000×/1800×`。在无任何 IP 注入、真实挑战与真实结算下，Eternity 到 Reality 的完整时间研究与 EC 链仅用约 27 分钟，压过目标阶段 30～75 分钟的多数内容段。

这不是门禁错误，也不是挑战被瞬秒或结算被伪造；问题在于 Reality 前全局游戏速度使真实机制链整体过快。

## 修复

仅调整阶段托管的新档速度：

| 阶段 | 旧值 | 新值 |
|---|---:|---:|
| Break 前 | 1000× | 500× |
| Break 后、Reality 前 | 1800× | 900× |
| Reality 后 | 3000× | 3000× |

玩家手动倍率、动态升档与存档内业务字段不变。阶段仍只由真实 `player.break` / `player.realities` 状态切换，不按墙钟解锁。

按旧跑次比例外推，新档首次 Eternity 约为 30 分钟，首次 Reality 约为 84 分钟；这只是待验证预测，不是 PASS。必须使用新档重跑并重新记录真实里程碑。

原版间隔自动购买器继续按 `interval / 当前游戏速度` 执行。新档 500× 下，最慢的默认星系购买器为 `20000ms / 500 = 40ms`，仍为 25Hz 自动购买，不依赖 MOD 的 1～60 秒战略节拍，不通过降低帧率或暂停自动器来拉长游戏。

## Android 同步

Android 当前同类阶段速度为 `1000/1800/3000`，且使用同一 Reality 前 EC 门槛链。Web 新档定向验证通过后，必须将 Android 的阶段速度同步为 `500/900/3000`，重新构建并做真实 AVD 验证；不得把本次 Web 预测写成 Android PASS。
