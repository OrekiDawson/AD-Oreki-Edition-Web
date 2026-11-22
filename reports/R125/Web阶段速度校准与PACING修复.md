# Web 阶段速度校准与 PACING 修复

日期：2026-11-22（UTC+8）

## 结论

当前候选真实新档在 `2527.8s`（约 42.1 分钟）首次进入 Reality，低于规则允许的最早边界 70 分钟，因此判：

- `PACING = FAIL`
- `PROGRESSION = BLOCKED`
- `GAMEPLAY LEGALITY / ENDGAME / POST-ENDGAME STABILITY / SAVE COMPATIBILITY = NOT RUN`

运行器按 `first-reality-before-70-minutes` 自动停止，不再把余下时间当作 180 分钟验收。

将 Break 前/后速度改为 `500×/900×` 后，第二次真实新档仍在 `2618.4s`
（约 43.6 分钟）进入 Reality，仅延后约 1.5 分钟。由此确认单纯降低
`1000×/1800×` 不足以修复 EC 链被调度拍压缩的问题。

进一步把 Break 后降到 `1×` 后，新档在 `703.1s` Break；至 `1366.4s`
（22.8 分钟）仍没有首次永恒，IP 指数只有 `e2.22`，说明原版速度过慢，
继续运行会在 180 分钟内无法进入 Reality。该档只保留为边界取证。

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

首个 Reality 前的阶段速度为 `1000×/1800×`；改为 `500×/900×` 后实测几乎不改善。
在无任何 IP 注入、真实挑战与真实结算下，Eternity 到 Reality 的完整时间研究与 EC 链仍只用约 27 分钟。自动化每 10 秒只有一个受控动作，但高倍率使每次挑战准备和结算在一次动作内跨过完整资源段。

这不是门禁错误，也不是挑战被瞬秒或结算被伪造；问题在于 Reality 前全局游戏速度使真实机制链整体过快。

## 修复

仅调整阶段托管的新档速度：

| 阶段 | 旧值 | 新值 |
|---|---:|---:|
| Break 前 | 1000× | 500× |
| Break 后、Reality 前 | 1800× | 70× |
| Reality 后 | 3000× | 3000× |

玩家手动倍率、动态升档与存档内业务字段不变。阶段仍只由真实 `player.break` / `player.realities` 状态切换，不按墙钟解锁。

`500×/900×` 已被证明仍过快，`1×` 已被证明过慢；`100×` 的真实新档仍在
`3180.4s`（53.0 分钟）提前 Reality，按规则判 `PACING FAIL`。现采用下一档 `70×`，
以真实资源成长与 10 秒调度拍共同决定 EC 推进；这只是待验证方案，不是 PASS。
必须使用全新档重跑并重新记录真实里程碑。

原版间隔自动购买器继续按 `interval / 当前游戏速度` 执行。新档 500× 下，最慢的默认星系购买器为 `20000ms / 500 = 40ms`，仍为 25Hz 自动购买，不依赖 MOD 的 1～60 秒战略节拍，不通过降低帧率或暂停自动器来拉长游戏。

## Android 同步

Android 当前同类阶段速度为 `500/900/3000`，且使用同一 Reality 前 EC 门槛链。Web 新档定向验证通过后，必须将 Android 的阶段速度同步为 `500/70/3000`，重新构建并做真实 AVD 验证；不得把本次 Web 预测写成 Android PASS。

## 2026-11-23 后续实测与 35× 候选

`500×/70×/3000×` 的新档长跑再次确认 PACING FAIL：

- 首次 Infinity：`31.1s`
- 首次 Break：`711.2s`
- 首次 Eternity：`1671.0s`
- 首次 Reality：`3511.1s`（58 分 31 秒）
- Reality 后 EC 与第二次 Reality 继续真实推进，第二次 Reality 于约 `6182.8s`
  出现，阶段进入 `realityTree`，未发现自动永恒或 Reality 入口死锁。

因此直接问题不是首个永恒条件、自动永恒购买器或 Reality 门禁，而是 Break 后至
首次 Reality 的 35～58 分钟内容被 `70×` 全局时间压缩。根据已有 `1800× → 900×
→ 100× → 70×` 实测点，单纯高倍率微调收益递减，候选改为：

| 阶段 | 已失败值 | 待验证候选 |
| --- | ---: | ---: |
| Break 前 | 500× | 500× |
| Break 后、Reality 前 | 70× | 35× |
| Reality 后 | 3000× | 3000× |

该候选不按墙钟锁阶段，不写资源或完成位，只改变真实阶段内的全局时间倍率。
已通过：

- `node scripts/check_speed_stage.mjs`
- `node scripts/check_game_pace.mjs`
- `node scripts/validate_tutorial.mjs --stats`（2158/2158）
- `node --test scripts/tests/test_early_pace_real_progress.mjs`（3/3）

真实新档首次 Reality、180 分钟终局、通关后稳定性与 Android 同步仍为 `NOT RUN`；
35× 尚未取得真实 PACING PASS，不得提前合并或宣称修复完成。
