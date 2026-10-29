// [Oreki R27] 天神 / 特蕾莎浇注 / V 解锁 自动化。
//
// ── 为什么需要（专家已复核的源码事实）────────────────────────────────────
// 1. 特蕾莎浇注 `Teresa.pourRM(diff)`（teresa.js:14）的 `diff` 是**真实秒**（内部
//    `timePoured += diff`，公式 `(poured+1e6)*0.01*timePoured²`）。全仓**唯一调用点**
//    是 `TeresaTab.js` 的「按住」按钮——纯 UI 驱动。不自动化则 `pouredAmount` 永远 0，
//    于是 `TeresaUnlocks.effarig`（鹿颈长解锁位）永远不亮 → 整条天神链（鹿颈长/无名氏/
//    V/Ra/莱特拉/Pelle）全断。
// 2. 天神 run 入口 `X.initializeRun()`（teresa.js:28、effarig.js:17、enslaved.js:148、
//    v.js:182）全仓唯一调用点是 `EnterCelestialsModal.js:81-86`（6 个天神）。不自动化
//    则天神现实永远进不去。
// 3. V 解锁 `V.unlockCelestial()`（v.js:177）唯一调用点 `VTab.js:109`，前置
//    `V.canUnlockCelestial`（v.js:174，6 项 mainUnlock 同一现实内同时达标）。
//
// ── 时间语义（关键）────────────────────────────────────────────────────
// 浇注必须用**真实墙钟时间差**，绝不能用 gameLoop 的 `diff`（那是游戏内毫秒，会被
// 10000× 放大成「瞬间注满」，等于作弊式跳过）。本模块自己用 `Date.now()` 算真实帧间隔，
// 并把浇注系数提速 10×（保留「按住」手感，不归零 `timePoured`）。
//
// ── 不浇水的护栏 ───────────────────────────────────────────────────────
// 现实升级（RU1~5 可重复 + RU6~25 一次性）必须先买齐，否则 RM 全浇进特蕾莎会导致
// 成就 147「购买所有现实升级」永远拿不到 → 特蕾莎解锁位永远不亮（死循环）。所以：
// 只要还有「当前可购买」的 RU（不管本帧买不买得起），就**不浇**，把 RM 留给 RU。

import { Teresa, TeresaUnlocks } from "./celestials/teresa.js";
import { Effarig } from "./celestials/effarig.js";
import { Enslaved } from "./celestials/enslaved.js";
import { V, VUnlocks } from "./celestials/V.js";
import { RealityUpgrades, RealityUpgrade } from "./reality-upgrades.js";
import { OrekiRealityAutomation } from "./oreki-reality-automation.js";

/** 浇注系数：把 0.01 这一项乘 10，原本 ≈23.2s 真实按住降到 ≈2.3s 真实。保留手感不归零。 */
const OREKI_TERESA_POUR_RATE = 10;
/** 真实帧间隔上限（毫秒）：防止后台/卡顿后一次性把 RM 全浇掉。 */
const OREKI_MAX_REAL_FRAME_MS = 100;

export const OrekiCelestialAutomation = {
  _lastRealMs: 0,
  /** 已尝试进入过的天神（避免反复进入把生产卡在天神削弱态） */
  _entered: {},
  _vUnlocked: false,

  /**
   * 是否存在「当前可购买且尚未购买」的现实升级（一次性或可重复）。
   *
   * ⚠️ 一次性 RU 必须同时判 `!upg.isBought`，否则死锁：
   * 一次性现实升级的解锁资格位是 `player.reality.upgReqs`（reality-upgrades.js:76
   * `isAvailableForPurchase` 读的就是它），而**购买完成后这个位不会被清除**
   * （全仓只有 `:86` 的一处置位 `player.reality.upgReqs |= (1 << this.id)`，
   * 没有任何清除代码）。真正记录「已购买」的是另一个位掩码
   * `player.reality.upgradeBits`（`BitPurchasableMechanicState.isBought`，
   * game-mechanics/bit-purchasable.js:22）。
   * 所以若只看 `isAvailableForPurchase`，一旦任意一次性 RU 解锁，这个判断就**永远为真**
   * → 永远不浇特蕾莎 → 成就 147「购买所有现实升级」永远拿不到
   * → 特蕾莎解锁位永远不亮 → 整条天神链死锁。
   */
  _hasBuyableRU() {
    try {
      for (const upg of RealityUpgrades.all) {
        // 一次性 RU（id ≥ 6）：解锁资格位 + 未购买位，两个都要判
        if (upg.isAvailableForPurchase && !upg.isBought) return true;
      }
      for (let id = 1; id <= 5; id++) {
        // 可重复 RU（id 1~5）：canBeBought 已含「未买满」判定
        if (RealityUpgrade(id).canBeBought) return true;
      }
    } catch (e) {
      // 异常时保守地认为「还有可买的」，避免误浇
      return true;
    }
    return false;
  },

  /** 某天神是否「可进入」（解锁位已亮、且尚未进入过、且当前不在其 run 中） */
  _canEnter(name) {
    try {
      if (Pelle.isDoomed) return false;
      if (player.celestials[name].run) return false;
      if (this._entered[name]) return false;
      switch (name) {
        case "teresa": return Teresa.isUnlocked;
        // Effarig 没有自己的 isUnlocked getter；它的解锁位就是 TeresaUnlocks.effarig
        // （= 特蕾莎浇注到 1e24，teresa.js:15-20）。
        case "effarig": return TeresaUnlocks.effarig.isUnlocked;
        case "enslaved": return Enslaved.isUnlocked;
        // V 同样没有 isUnlocked getter；真实解锁位是 VUnlocks.vAchievementUnlock
        // （v.js:100-101 的 bits 读写 + v.js:174 canUnlockCelestial）。
        case "v": return VUnlocks.vAchievementUnlock.isUnlocked;
        default: return false;
      }
    } catch (e) {
      return false;
    }
  },

  _enterRun(name) {
    try {
      switch (name) {
        case "teresa": Teresa.initializeRun(); break;
        case "effarig": Effarig.initializeRun(); break;
        case "enslaved": Enslaved.initializeRun(); break;
        case "v": V.initializeRun(); break;
        default: return false;
      }
      this._entered[name] = true;
      return true;
    } catch (e) {
      return false;
    }
  },

  tick() {
    const result = { poured: false, entered: [], vUnlocked: false };
    try {
      if (!player.auto.autobuyersOn) return result;
      if (Pelle.isDoomed) return result;

      // 1) 先买现实升级（RU1~5 可重复 + RU6~25 一次性），幂等，留给 RU 的 RM 不能浇。
      try {
        OrekiRealityAutomation.buyRebuyableUpgrades();
        OrekiRealityAutomation.buyRealityUpgrades();
      } catch (e) { /* 单项失败不影响其它 */ }

      // 2) 特蕾莎浇注：只在「特蕾莎已解锁（A147 达成）= 没有可买 RU」后才浇。
      //    用真实墙钟时间差，绝不用 gameLoop 的放大 diff。
      try {
        if (Teresa.isUnlocked && !this._hasBuyableRU()) {
          const now = Date.now();
          if (!this._lastRealMs) this._lastRealMs = now;
          let realMs = now - this._lastRealMs;
          this._lastRealMs = now;
          if (realMs < 0) realMs = 0;
          if (realMs > OREKI_MAX_REAL_FRAME_MS) realMs = OREKI_MAX_REAL_FRAME_MS;
          const diff = (realMs / 1000) * OREKI_TERESA_POUR_RATE;
          Teresa.pourRM(diff);
          result.poured = true;
        }
      } catch (e) { /* 单点异常不击穿主循环 */ }

      // 3) V 解锁：必须**在进入 V 的 run 之前**做。
      //    `V.canUnlockCelestial` = `VUnlocks.vAchievementUnlock.canBeUnlocked`
      //    （v.js:174），而进入 V run 的前置 `_canEnter("v")` 判的是
      //    `VUnlocks.vAchievementUnlock.isUnlocked` —— 先解锁才可能进 run，顺序反了会死锁。
      try {
        if (V.canUnlockCelestial) {
          V.unlockCelestial();
          this._vUnlocked = true;
          result.vUnlocked = true;
        }
      } catch (e) { /* 单点异常不击穿主循环 */ }

      // 4) 进入天神 run（teresa/effarig/enslaved/v）。每神只进一次，随后由自动现实
      //    完成该 run（拿奖励、清 run），避免长时间卡在天神削弱态拉低产量。
      //    同一时刻只进一个：新天神的 initializeRun 会 clearCelestialRuns 清掉正在
      //    跑的那个，必须等当前 run 被现实完成（清 run）后再进下一个。
      //    ⚠️ 这里必须 break：若一帧内连进多个天神的 run，后一个的 clearCelestialRuns()
      //    会把前一个的 run 直接清掉，等于两个 run 都没真正开始（白跑一次现实）。
      if (!isInCelestialReality()) {
        for (const name of ["teresa", "effarig", "enslaved", "v"]) {
          try {
            if (this._canEnter(name)) {
              if (this._enterRun(name)) {
                result.entered.push(name);
                // 一帧只进一个，下一帧再考虑下一个
                break;
              }
            }
          } catch (e) { /* 单点异常不击穿主循环 */ }
        }
      }
    } catch (e) {
      // 整帧兜底：任何未捕获异常都不应击穿 gameLoop
    }
    return result;
  }
};

try {
  globalThis.OrekiCelestialAutomation = OrekiCelestialAutomation;
} catch (e) {
  // 非浏览器环境忽略
}
