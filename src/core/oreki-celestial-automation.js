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
import { Effarig, EffarigUnlock, EFFARIG_STAGES } from "./celestials/effarig.js";
import { Enslaved } from "./celestials/enslaved.js";
import { V, VUnlocks } from "./celestials/V.js";
import { RealityUpgrades, RealityUpgrade } from "./reality-upgrades.js";
import { OrekiRealityAutomation } from "./oreki-reality-automation.js";

/** 浇注系数：把 0.01 这一项乘 10，原本 ≈23.2s 真实按住降到 ≈2.3s 真实。保留手感不归零。 */
const OREKI_TERESA_POUR_RATE = 10;
/** 真实帧间隔上限（毫秒）：防止后台/卡顿后一次性把 RM 全浇掉。 */
const OREKI_MAX_REAL_FRAME_MS = 100;

/**
 * [Oreki R30] 鹿颈长解锁位的**购买顺序**（按 cost 升序，见
 * `secret-formula/celestials/effarig.js`）：
 *   adjuster 1e7 → glyphFilter 2e8 → setSaves 3e9 → run 5e11
 * 后三个（infinity / eternity / reality）没有 cost，是**阶段解锁位**，
 * 只能由真实的 Big Crunch / Eternity / Reality 触发（big-crunch.js:150、eternity.js:58），
 * 本模块绝不购买、也绝不直接 `unlock()`。
 */
const OREKI_EFFARIG_BUY_ORDER = ["adjuster", "glyphFilter", "setSaves", "run"];

export const OrekiCelestialAutomation = {
  _lastRealMs: 0,
  /** 已尝试进入过的天神（避免反复进入把生产卡在天神削弱态） */
  _entered: {},
  /** [Oreki R30] 进入时的鹿颈长阶段快照（name -> EFFARIG_STAGES 值），用于阶段推进后重新进入 */
  _enteredStage: {},
  _vUnlocked: false,
  _unlocksBought: 0,

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
      // [Oreki R28] **只判一次性现实升级（id ≥ 6）**。
      //
      // ── R28 实测根因（300 秒真实新档）────────────────────────────────
      // 原实现遍历 `RealityUpgrades.all`（**包含可重复的 1~5**），判
      // `upg.isAvailableForPurchase && !upg.isBought`：
      //   · 可重复 RU 继承 `RebuyableMechanicState`，其 `isAvailableForPurchase`
      //     **恒为 true**（game-mechanics/rebuyable.js:30）；
      //   · `isBought` 只定义在 `BitPurchasableMechanicState`
      //     （game-mechanics/bit-purchasable.js:22），可重复 RU **根本没有这个属性**
      //     → `!upg.isBought` 恒等于 `!undefined === true`。
      // 于是这个守卫**永远返回 true** → 特蕾莎永远不浇注 →
      // `Teresa.pouredAmount` 恒为 0 → `TeresaUnlocks.effarig`（鹿颈长解锁位，
      // 门槛 1e24，teresa.js:15-20）永不亮 → 整条天神链在鹿颈长处断掉。
      // 实测末态确认：`allRuBought=true`、`a147=true`、`teresaRun=true`，
      // 但 `pouredL=null`（= log10(0) = -∞）、`effarigUnlocked=false`。
      //
      // ── 为什么只判一次性 ────────────────────────────────────────────
      // 一次性 RU 有真正的「购买记录」位（`player.reality.upgradeBits`），
      // 是成就 147「购买所有现实升级」的真实依据；可重复的 1~5 是刷取循环，
      // 买多少都不影响成就 147，也**不应该**阻止浇注（原版里特蕾莎与放大器
      // 是并行推进的，玩家通常一边买放大器一边按住浇注）。
      // 所以：**一次性 RU 全部买齐 → 才允许浇注**。
      for (const upg of RealityUpgrades.all) {
        if (upg.id < 6) continue;
        // 解锁资格位 + 未购买位，两个都要判
        if (upg.isAvailableForPurchase && !upg.isBought) return true;
      }
    } catch (e) {
      // 异常时保守地认为「还有可买的」，避免误浇
      return true;
    }
    return false;
  },

  /**
   * [Oreki R30] 购买鹿颈长解锁位（按 cost 升序，买不起就跳过）。
   *
   * ── 为什么必须有这一步 ────────────────────────────────────────────────
   * `EffarigUnlock.run`（「鹿颈长的现实」，cost 5e11 遗迹碎片）是**进入鹿颈长 run 的
   * 真正入场券**：原版 UI 里不买它，`Entcelestials` 的入口按钮就是禁用的。
   * R29 的 `_canEnter("effarig")` 只判 `TeresaUnlocks.effarig.isUnlocked`（特蕾莎浇到 1e24），
   * 于是自动化**没买票就进了 run** —— 等于跳过了真实前置。
   *
   * ── 走真实路径 ──────────────────────────────────────────────────────
   * `EffarigUnlockState.purchase()`（celestials/effarig.js:130）内部是
   * `Currency.relicShards.purchase(this.cost)`（currency.js:159，真实扣款）→ `unlock()`
   * （置 `player.celestials.effarig.unlockBits` 对应位）→ `config.onPurchased()`（原版回调）。
   * 碎片不够时 `purchase()` 自己返回，**不伪造**。
   *
   * @returns {number} 本次真实买到的条数
   */
  buyEffarigUnlocks() {
    let bought = 0;
    for (const key of OREKI_EFFARIG_BUY_ORDER) {
      try {
        const unlock = EffarigUnlock[key];
        if (!unlock || unlock.isUnlocked) continue;
        // 买不起就跳过（`purchase()` 内部也会再判一次，这里只是省掉无意义的调用）
        if (!Currency.relicShards.gte(unlock.cost)) continue;
        unlock.purchase();
        if (unlock.isUnlocked) bought++;
      } catch (e) {
        // ── onPurchased 的 UI 副作用可能在没有对应界面时抛错 ──
        // 注意：`purchase()` 里 `unlock()` 在 `onPurchased()` **之前**执行
        // （celestials/effarig.js:132-133），所以这里吞掉异常不会丢解锁位，
        // 只需把位状态再确认一遍。
        try {
          if (EffarigUnlock[key].isUnlocked) bought++;
        } catch (e2) { /* ignore */ }
      }
    }
    this._unlocksBought += bought;
    return bought;
  },

  /** 某天神是否「可进入」（解锁位已亮、且尚未进入过、且当前不在其 run 中） */
  _canEnter(name) {
    try {
      if (Pelle.isDoomed) return false;
      if (player.celestials[name].run) return false;
      switch (name) {
        case "teresa": return !this._entered[name] && Teresa.isUnlocked;
        // Effarig 没有自己的 isUnlocked getter；它的解锁位就是 TeresaUnlocks.effarig
        // （= 特蕾莎浇注到 1e24，teresa.js:15-20）。
        //
        // [Oreki R30] **还必须持有入场券 `EffarigUnlock.run`**（cost 5e11 碎片）。
        // 少了这一条，R29 的自动化在 170 s 就直接进了 run，绕过真实前置。
        //
        // 另外鹿颈长是**三阶段**的（INFINITY → ETERNITY → REALITY）：
        // 每个阶段都由一次真实的重置推进，而推进函数内部会
        // `beginProcessReality(getRealityProps(true))`（big-crunch.js:152 / eternity.js:60）
        // → `finishProcessReality` → `clearCelestialRuns()`（reality.js:608）把 run 清掉。
        // 所以「进入过就不再进」的旧规则会让 INFINITY 之后再也无法进入 ETERNITY 阶段。
        // 这里改成**按阶段各进一次**：阶段没变就不重复进，阶段推进了就允许再进。
        case "effarig": {
          if (!TeresaUnlocks.effarig.isUnlocked) return false;
          if (!EffarigUnlock.run.isUnlocked) return false;
          const stage = Effarig.currentStage;
          if (stage >= EFFARIG_STAGES.COMPLETED) return false;
          return this._enteredStage.effarig !== stage;
        }
        case "enslaved": return !this._entered[name] && Enslaved.isUnlocked;
        // V 同样没有 isUnlocked getter；真实解锁位是 VUnlocks.vAchievementUnlock
        // （v.js:100-101 的 bits 读写 + v.js:174 canUnlockCelestial）。
        case "v": return !this._entered[name] && VUnlocks.vAchievementUnlock.isUnlocked;
        default: return false;
      }
    } catch (e) {
      return false;
    }
  },

  _enterRun(name) {
    try {
      const stageBefore = Effarig.currentStage;
      switch (name) {
        case "teresa": Teresa.initializeRun(); break;
        case "effarig": Effarig.initializeRun(); break;
        case "enslaved": Enslaved.initializeRun(); break;
        case "v": V.initializeRun(); break;
        default: return false;
      }
      this._entered[name] = true;
      // 记录进入时的鹿颈长阶段：阶段推进后（run 被 clearCelestialRuns 清掉）才允许再进
      if (name === "effarig") this._enteredStage.effarig = stageBefore;
      return true;
    } catch (e) {
      return false;
    }
  },

  tick() {
    const result = { poured: false, entered: [], vUnlocked: false, unlocks: 0, stage: 0 };
    try {
      if (!player.auto.autobuyersOn) return result;
      if (Pelle.isDoomed) return result;
      try {
        result.stage = Effarig.currentStage;
      } catch (e) { /* ignore */ }

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

      // 3.5) [Oreki R30] 买鹿颈长解锁位（遗迹碎片，按 cost 升序）。
      //      `run`（5e11）是进入鹿颈长现实的入场券，必须在第 4 步之前买到。
      //      买不起就跳过；`infinity / eternity / reality` 三个阶段位不在购买列表里，
      //      只能由真实的 Big Crunch / Eternity / Reality 触发。
      try {
        result.unlocks = this.buyEffarigUnlocks();
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

/**
 * [Oreki R30] 只读观测快照：主 Agent / 定向脚本可直接读
 * `OrekiCelestialAutomation.debugState`，不需要自己拼十几个 getter。
 * 全部字段都是**读真实状态**，不写入任何东西。
 */
Object.defineProperty(OrekiCelestialAutomation, "debugState", {
  get() {
    const lg = v => {
      try {
        const n = Number(v && typeof v === "object" && typeof v.toString === "function" ? v.toString() : v);
        if (!Number.isFinite(n)) {
          // Decimal 超大值走字符串指数拆解
          const t = String(v);
          const i = t.indexOf("e");
          if (i < 0) return Number.isFinite(n) ? Math.log10(Math.abs(n)) : null;
          return Math.log10(Math.abs(Number(t.slice(0, i)))) + Number(t.slice(i + 1));
        }
        return n === 0 ? null : Math.log10(Math.abs(n));
      } catch (e) {
        return null;
      }
    };
    const pick = fn => { try { return fn(); } catch (e) { return null; } };
    const unlock = key => pick(() => EffarigUnlock[key].isUnlocked === true);
    return {
      pouredAmount: pick(() => lg(Teresa.pouredAmount)),
      pouredAmountRaw: pick(() => Teresa.pouredAmount),
      relicShards: pick(() => lg(Currency.relicShards.value)),
      relicShardsRaw: pick(() => Currency.relicShards.value),
      shardsGainedPerReality: pick(() => Effarig.shardsGained),
      glyphEffectAmount: pick(() => Effarig.glyphEffectAmount),
      unlocks: {
        adjuster: unlock("adjuster"),
        glyphFilter: unlock("glyphFilter"),
        setSaves: unlock("setSaves"),
        run: unlock("run"),
        infinity: unlock("infinity"),
        eternity: unlock("eternity"),
        reality: unlock("reality"),
      },
      effarigStage: pick(() => Effarig.currentStage),
      effarigStageName: pick(() => Effarig.currentStageName),
      effarigRunning: pick(() => Effarig.isRunning === true),
      entered: pick(() => JSON.parse(JSON.stringify(this._entered))),
      enteredStage: pick(() => JSON.parse(JSON.stringify(this._enteredStage))),
      currentRun: pick(() => ["teresa", "effarig", "enslaved", "v"]
        .filter(n => player.celestials[n] && player.celestials[n].run)),
      inCelestialReality: pick(() => isInCelestialReality() === true),
      realities: pick(() => player.realities),
      unlocksBought: this._unlocksBought,
      vUnlocked: this._vUnlocked,
    };
  },
  enumerable: true,
  configurable: true,
});

try {
  globalThis.OrekiCelestialAutomation = OrekiCelestialAutomation;
} catch (e) {
  // 非浏览器环境忽略
}
