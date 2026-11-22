# Web 现实循环 EC 优先级修复

日期：2026-11-23（UTC+8）

## 实测问题

`500×/70×/3000×` 的真实新档中，自动永恒入口、EC 入口和真实结算均正常：

- 首次 Reality：`3511.1s`
- 第二次 Reality：约 `6192.8s`
- 两次 Reality 前都完整推进了 EC1～EC12，每关 5 次

但每次 Reality 会按原版规则清空 EC 完成记录，自动化随后从 EC1 重新串行开始。
第二次 Reality 前仅 EC 链就花费约 44.7 分钟；按此速度，后续 Reality、主要天神、
Pelle 与终局无法在 180 分钟内完成。

这不是原版永恒入口死锁，也不是调度器永久停滞。问题在 MOD 对重复 Reality 循环的
挑战选择顺序：它统一按 1→12 选下一关，而 `TimeStudy.reality` 的原版硬条件只要求
EC11 与 EC12 各完成 5 次；其余 EC 的成就和奖励在首次循环中已经持久化。

## 修复

- 首次 Reality 前保持 EC1→EC12，保留永恒挑战体系的完整实际展开。
- Reality 后按 EC1→EC2→EC3→EC10→EC11→EC12→EC4～EC9 选择。
- EC1～3 与 EC10 的真实完成记录用于解锁 181/191/193 研究链；EC11/EC12
  仍负责重新满足 `TimeStudy.reality` 的原版硬条件。
- 在同一自动化拍内只处理当前目标；高优先级目标暂时买不起时等待资源，
  不降级串行购买其它 EC。
- 已满的 EC 仍通过原版 `respecTimeStudies(true)` 清除入口并重建研究路径。
- 挑战目标、入口资源、完成次数、奖励与真实结算全部沿用原版。
- IU15 冲刺期间继续禁止重打 EC7。

## 静态验证

- `node scripts/check_eternity_gate.mjs`：244 项 PASS / 0 FAIL
- 新档首轮选择 EC1
- Reality 后先选择 EC1，再依次 EC2、EC3、EC10
- 解锁链满足后选择 EC11
- EC11 满后选择 EC12
- Reality 门槛满足后仍可补其它未完成挑战
- IU15 冲刺仍跳过 EC7

## 未完成

- 新档真实重跑中的首次 Reality：`NOT RUN`
- Reality 后 EC11/EC12 实际重打耗时：`NOT RUN`
- 180 分钟终局与通关后稳定性：`NOT RUN`
- Android 同构优先级同步与 AVD：`NOT RUN`

本修复不伪造挑战完成，也不改变首次 Reality 的 70 分钟 PACING 判定。
