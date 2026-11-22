// [Oreki AD5] 打破无限闸门：按真实 IP 自动购买间隔升级
//
// ── 事实（R19 真新档 601 s 实测 + 源码逐行核对）──────────────────────
// 1. `breakInfinity()`（src/game.js:77）第一行就是
//        if (!Autobuyer.bigCrunch.hasMaxedInterval) return;
//    即 **「把大坍缩自动器间隔拉到 ≤100」是 Break 的前置，不是后果**。
// 2. 间隔从 150000 起，每级 `×0.6`、价格 `×2`
//    （src/core/autobuyers/autobuyer.js:169-177 `upgradeInterval`）
//    → 需要 15 级，成本序列 1,2,4,…,16384，**累计 32767 IP**。
// 3. `upgradeInterval()` **没有任何 `canBeUpgraded` 门控**（与其它自动器不同），
//    唯一门槛是 IP 余额；且全仓库**只有 UI 按钮调用它**
//    （src/components/tabs/autobuyers/AutobuyerIntervalButton.js:34），
//    **没有任何自动购买器会升级它** → 玩家必须手点 15 次。
// 4. 未 Break 时每次坍缩固定给 1 IP（src/game.js:103-105，div=308 → 308/308=1）。
// 5. R19 实测：AD4 修好 canCrunch 死锁后，首次无限 @91 s；
//    但 601 s 内只发生 25 次坍缩，IP 停在 1e0.7。
//    → 按 1 IP/次、约 24 s/次的外推，攒满 32767 IP 需要 **约 9 天**。
//    这就是**第二道时间墙**，而且它的本质是「自动化缺口 + 阶段奖励缺口」，
//    不是数值平衡问题。
//
// ── 本模块做什么 ─────────────────────────────────────────────────────
// 间隔升级自动化：只要玩家开了自动购买器、且 IP 余额够，
// 就自动购买大坍缩自动器的间隔升级（走游戏自身的 `upgradeInterval(false)`，
// 不伪造 interval、不绕过成本）。这消除「必须手点 15 次」的自动化缺口。
//
// ── 边界 ─────────────────────────────────────────────────────────────
// · 只在 `!player.break` 时生效；Break 之后一律不再发放。
// · 不向玩家账户注入 IP；每次升级都从真实余额扣除。
// · 不写任何新的存档字段（用会话内状态 + 存档里本来就有的 interval）。
// · 不改 `gainedInfinityPoints`、不改 `div`、不改 `-0.75`、不改 `totalIPMult`。
// · 受玩家既有的「自动购买器」总开关 `player.auto.autobuyersOn` 控制。
//
// ── 为什么 32767 这个数字仍然重要 ────────────────────────────────────
// 它恰好等于把间隔从 150000 拉到 100 所需的**全部**成本，
// 只能通过真实无限循环逐步挣到并按序支付。

import { PlayerProgress } from "./player-progress.js";

/**
 * 把间隔从 150000 拉到 100 所需的完整成本。
 * 逐级核算：interval ← max(interval × 0.6, 100)，cost ← cost × 2，
 * 起始 interval=150000 / cost=1，需要 15 级 → 1+2+4+…+16384 = 32767。
 */
export const BREAK_INTERVAL_TOTAL_COST = 32767;

export const OrekiBreakInfinityGate = {
  /**
   * 是否处于「Break 闸门」窗口（只读判断，无副作用）。
   */
  active() {
    try {
      if (player.break) return false;
      if (!player.auto.autobuyersOn) return false;
      if (!PlayerProgress.infinityUnlocked()) return false;
      if (NormalChallenge.isRunning || InfinityChallenge.isRunning || EternityChallenge.isRunning) return false;
      // [Oreki R40-A5] 毁灭态（佩勒）也允许用真实 IP 买间隔升级。
      //
      // 原因（实测，见 `_tools/_r40/R40A4-佩勒诊断.md` §7/§8）：
      //   进毁灭态那一帧 `Autobuyer.reset()` 会把 interval 打回 `baseInterval`（150000），
      //   因为此时 `keepAutobuyers` 里程碑（2 次永恒）与 Pelle 升级都还不成立
      //   （`autobuyers/autobuyer.js:185-189` + `reality.js:643` 清了永恒次数）。
      //   而 `breakInfinity()` 第一行就要求 `hasMaxedInterval`（`game.js:85`），
      //   所以「间隔买不回 100 ⇒ 永远破不了无限 ⇒ 反物质夹在 1.8e308」。
      //   本模块走的是游戏自身的 `upgradeInterval(false)`（真实扣 IP），
      //   和玩家在自动购买器页手点 15 次完全等价，不是补贴。
      if (Autobuyer.bigCrunch.hasMaxedInterval) return false;
      return true;
    } catch (e) {
      return false;
    }
  },

  /** 按真实 IP 成本升级大坍缩自动器间隔。 */
  tryOpen() {
    try {
      if (!this.active()) return false;
      let purchased = false;
      const bc = Autobuyer.bigCrunch;
      let guard = 0;
      while (!bc.hasMaxedInterval && guard < 64) {
        guard++;
        if (Currency.infinityPoints.value.lt(bc.cost)) break;
        const before = bc.interval;
        bc.upgradeInterval(false);
        if (bc.interval === before) break; // 买不动了，退出，避免死循环
        purchased = true;
      }

      return purchased;
    } catch (e) {
      return false;
    }
  },
};
