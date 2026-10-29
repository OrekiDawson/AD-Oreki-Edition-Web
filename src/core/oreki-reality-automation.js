// [Oreki R26] Reality 层自动化：首次现实 → 现实循环 → 现实升级 / 符文装备
//
// ── 为什么需要（R26 实测）────────────────────────────────────────────
// R25 已能真实满足 `maxEP.exponent >= 4000 && TimeStudy.reality.isBought`，但**没有人按下
// 现实按钮**：原版现实没有「无条件可用」的自动器，`RealityAutobuyerState.isUnlocked`
// 反而要求 `RealityUpgrade(25).isBought`（autobuyers/reality-autobuyer.js:13），
// 而 RealityUpgrade 25 的价格是 100000 RM —— 先有现实才有自动现实，死锁。
// 所以首次现实必须由自动化按下与玩家点击**完全同一条路径**。
//
// ── 走哪条路径（源码事实）────────────────────────────────────────────
// `requestManualReality()`（reality.js:140）只是 UI 前置检查（动画 / 确认框 / 仓库空间），
// 真正干活的是 `processManualReality(sacrifice, glyphID)`（reality.js:164）：
//   · realities === 0 时锁 `player.reality.seed`、发起始符文 + 同伴符文；
//   · 之后 `beginProcessReality(getRealityProps(false, true))` → `finishProcessReality`。
// `getRealityProps(false, ...)` 的 `reset: false` 就是「**给奖励**」——与 `reality(true)` 的
// `reset: true` 相反（`finishProcessReality` 里 `if (!isReset) giveRealityRewards(...)`，
// reality.js:593）。所以本模块**只传 false**，绝不跳过结算。
// 后续现实走 `autoReality()`（reality.js:280），它同样是 `getRealityProps(false, false)`，
// 是原版自动现实用的同一条带奖励路径，不需要 RealityUpgrade(25)。
//
// ── 边界 ─────────────────────────────────────────────────────────────
// · 受「自动购买器总开关」控制；毁灭现实（Pelle）与天神现实中不生效。
// · 只在 `isRealityAvailable()` 为真时动手，不伪造 EP / 不伪造时间研究。
// · 现实重置会清空 EC 完成记录（reality.js:651）与时间研究，所以现实后必须靠
//   oreki-eternity-automation 再把 EC 1~12 打回 5 次 —— 那条链的 `active` 已放开到现实之后。

import { PlayerProgress } from "./player-progress.js";

const REALITY_MIN_INTERVAL_MS = 2000;

export const OrekiRealityAutomation = {
  _frame: 0,
  _lastRealityAt: 0,
  _realitiesFired: 0,

  get active() {
    try {
      if (!player.auto.autobuyersOn) return false;
      if (Pelle.isDoomed) return false;
      if (isInCelestialReality()) return false;
      // 符文选择弹窗打开时不重置，否则会打断玩家的选择
      if (GlyphSelection.active) return false;
      return true;
    } catch (e) {
      return false;
    }
  },

  get realityReady() {
    try {
      return isRealityAvailable();
    } catch (e) {
      return false;
    }
  },

  /**
   * 这次现实值不值得做。
   * 首次无条件；之后要求「本次可得 RM 至少是现有 RM 的 2%」或距上次现实超过 20 秒，
   * 避免把时间浪费在毫无增长的短循环上（RM 增长是现实层唯一硬通货）。
   */
  shouldReality() {
    try {
      if (!this.realityReady) return false;
      if (player.realities === 0) return true;
      const now = Date.now();
      if (now - this._lastRealityAt < REALITY_MIN_INTERVAL_MS) return false;
      const gain = MachineHandler.gainedRealityMachines.times(simulatedRealityCount(false) + 1);
      const have = Currency.realityMachines.value;
      if (gain.gte(have.times(0.02))) return true;
      // [Oreki R26] 20 s → 5 s：RM 一旦摸到 `MachineHandler.hardcapRM`（实测 1e1000）
      // 之后 `gain` 与 `have` 都不再变化，2% 判定永远为假，每次现实都要白等 20 s。
      // 现实能否进行由 `isRealityAvailable()`（EC 全通 + 时间研究）真正把关，
      // 这个兜底只影响「已经就绪之后还要等多久」，缩到 5 s 不会刷出无意义的空循环。
      return now - this._lastRealityAt >= 5000;
    } catch (e) {
      return false;
    }
  },

  /** 真正执行一次现实（带奖励的真实路径） */
  tryReality() {
    try {
      if (!this.shouldReality()) return false;
      if (player.realities === 0) {
        // 首次现实：与玩家点击按钮后走的是同一个函数，含种子锁定与起始/同伴符文
        processManualReality(false);
      } else {
        autoReality();
      }
      this._lastRealityAt = Date.now();
      this._realitiesFired++;
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * [Oreki R26] 现实升级的「解锁」是**事件驱动**的：`RealityUpgradeState.tryUnlock()`
   * 挂在各自的 `checkEvent` 上（例如 `GAME_EVENT.REALITY_UPGRADE_BOUGHT` / `ETERNITY_RESET_AFTER`），
   * 而玩家侧只有 UI 会在对应时机去触发。自动现实循环里很多事件不会按原版节奏发生，
   * 于是「条件早就满足、但 `player.reality.upgReqs` 这一位永远是 0」——
   * `isAvailableForPurchase` 恒假，RM 再多也买不了，Teresa 的成就 147「购买所有现实升级」永远到不了。
   * 这里每 10 帧主动跑一次条件复检（`tryUnlock()` 自身幂等且只读判断，不伪造任何状态）。
   * @returns {number} 本次新解锁的条数
   */
  tryUnlockRealityUpgrades() {
    let unlocked = 0;
    for (const upg of RealityUpgrades.all) {
      try {
        if (typeof upg.tryUnlock !== "function") continue;
        if (upg.isAvailableForPurchase) continue;
        upg.tryUnlock();
        if (upg.isAvailableForPurchase) unlocked++;
      } catch (e) {
        // 单项失败不影响其它条
      }
    }
    return unlocked;
  },

  /** 可重复购买的 1~5 号现实升级（膨胀时间 / 复制器 / 永恒 / 无限 / 维度） */
  buyRebuyableUpgrades() {
    let bought = 0;
    for (let id = 1; id <= 5; id++) {
      try {
        const upg = RealityUpgrade(id);
        // 只买买得起的，宁可留钱给下一次；上限由 canBeBought 自己判定
        while (upg.canBeBought && upg.purchase()) bought++;
      } catch (e) {
        // 该 id 不存在或暂不可买
      }
    }
    return bought;
  },

  /**
   * 一次性现实升级。只买 `isAvailableForPurchase` 为真的（= 对应前置已经在这次存档里
   * 真实达成过，由 `tryUnlock()` 写进 `player.reality.upgReqs`），不伪造任何解锁位。
   * 价格从 15 RM 起，早期只买得起最便宜的几项，按价格升序买。
   */
  buyRealityUpgrades() {
    try {
      const db = GameDatabase.reality?.upgrades || [];
      const candidates = db
        .filter(cfg => cfg.id >= 6)
        .map(cfg => ({ id: cfg.id, cost: cfg.cost }))
        .sort((a, b) => a.cost - b.cost);
      let bought = 0;
      for (const { id } of candidates) {
        try {
          const upg = RealityUpgrade(id);
          if (!upg || upg.isBought) continue;
          if (upg.purchase()) bought++;
        } catch (e) {
          // 忽略单项失败
        }
      }
      return bought;
    } catch (e) {
      return 0;
    }
  },

  /**
   * 符文仓库管理：保留每个类型里评分最高的若干个，其余献祭/删除。
   * 评分用 `等级 × 强度`（与原版排序口径一致，glyph-core.js:40）。
   * 只在仓库剩余空间少于 12 格时清理，正常情况不动玩家的符文。
   */
  manageGlyphs() {
    try {
      if (GameCache.glyphInventorySpace.value >= 12) return 0;
      const byType = new Map();
      const all = Glyphs.inventoryList.filter(g => g && g.type !== "companion");
      for (const g of all) {
        if (!byType.has(g.type)) byType.set(g.type, []);
        byType.get(g.type).push(g);
      }
      let removed = 0;
      for (const list of byType.values()) {
        list.sort((a, b) => b.level * b.strength - a.level * a.strength);
        for (const g of list.slice(2)) {
          GlyphSacrificeHandler.removeGlyph(g, true);
          removed++;
        }
      }
      return removed;
    } catch (e) {
      return 0;
    }
  },

  /** 装备评分最高的 3 个符文（空槽优先，必要时替换更弱的） */
  equipGlyphs() {
    try {
      if (Glyphs.activeSlotCount === 0) return 0;
      const score = g => g.level * g.strength;
      const inventory = Glyphs.inventoryList.filter(g => g && g.type !== "companion");
      if (!inventory.length) return 0;
      inventory.sort((a, b) => score(b) - score(a));
      let equipped = 0;
      const savedConfirm = player.options.confirmations.glyphReplace;
      player.options.confirmations.glyphReplace = false;
      try {
        for (const glyph of inventory.slice(0, Glyphs.activeSlotCount)) {
          const already = Glyphs.activeWithoutCompanion.some(g => g && g.level === glyph.level &&
            g.strength === glyph.strength && g.type === glyph.type);
          if (already) continue;
          const freeSlot = Glyphs.active.findIndex(g => g === null);
          const target = freeSlot >= 0
            ? freeSlot
            : Glyphs.active.reduce((worst, g, idx) => (g && score(g) < score(Glyphs.active[worst])
              ? idx : worst), 0);
          const current = Glyphs.active[target];
          if (current && score(current) >= score(glyph)) continue;
          Glyphs.equip(glyph, target);
          equipped++;
        }
      } finally {
        player.options.confirmations.glyphReplace = savedConfirm;
      }
      return equipped;
    } catch (e) {
      return 0;
    }
  },

  /**
   * [Oreki R26] 现实升级 9 / 16 / 17 / 18 / 24 的「符文形态」要求。
   *
   * 事实（源码）：这五条的 `checkRequirement` 全都是**当前这一瞬间的装备形态**：
   *   9 ：装备**恰好 1 个**等级 ≥3 的符文，且当前 EP 指数 ≥ 4000（reality-upgrades.js:129）
   *   16：装备**恰好 4 个**稀有度 ≥1.5 的符文（:259）
   *   17：装备**恰好 4 个**词条数 ≥2 的符文（:276）
   *   18：装备**恰好 4 个**等级 ≥10 的符文（:290）
   *   24：装备**0 个**符文且本次现实可得 RM ≥ 5000（:366）
   * 原版全靠玩家手动装卸，自动现实循环里永远碰到同一套「最优 3 符文」→ 永远满足不了，
   * 于是 RU9/24 的两个额外符文槽拿不到，成就 147「购买所有现实升级」→  Teresa 永远不出现。
   *
   * 依赖顺序是硬性的：9、24 各给一个符文槽，16/17/18 需要「恰好 4 个」= 4 个槽。
   * 所以按 9 → 16 → 17 → 18 → 24 的顺序驱动，全部走 `Glyphs.equip` / `Glyphs.unequip`
   * 的原版路径，不改任何解锁位与完成记录。
   */
  _glyphCandidates() {
    try {
      return Glyphs.inventoryList.filter(g => g && g.type !== "companion");
    } catch (e) {
      return [];
    }
  },

  _glyphReqsDone() {
    try {
      const ok = id => {
        const u = RealityUpgrade(id);
        return !!u && (u.isAvailableForPurchase || u.isBought);
      };
      return ok(9) && ok(16) && ok(17) && ok(18) && ok(24);
    } catch (e) {
      return true;
    }
  },

  _unequipAllGlyphs() {
    let removed = 0;
    // 最多 8 次，避免异常状态下的死循环
    while (removed < 8) {
      const idx = Glyphs.active.findIndex(g => g && g.type !== "companion");
      if (idx < 0) break;
      Glyphs.unequip(idx);
      removed++;
    }
    return removed;
  },

  /** 装到「恰好 1 个等级 ≥3」——RU9 的形态 */
  _glyphFormOne() {
    if (Currency.eternityPoints.exponent < 4000) return 0;
    const active = Glyphs.activeWithoutCompanion;
    if (active.length === 1 && active[0].level >= 3) return 0;
    const best = this._glyphCandidates()
      .filter(g => g.level >= 3)
      .sort((a, b) => b.level * b.strength - a.level * a.strength)[0];
    if (!best) return 0;
    this._unequipAllGlyphs();
    const slot = Glyphs.active.findIndex(g => g === null);
    if (slot < 0) return 0;
    Glyphs.equip(best, slot);
    return 1;
  },

  /** 装到「恰好 4 个满足 pred」——RU16/17/18 的形态 */
  _glyphFormFour(pred) {
    // 符文槽不足 4 个（RU9 / RU24 还没买到）时硬凑「恰好 4 个」只会每 30 帧反复装卸
    if (Glyphs.activeSlotCount < 4) return 0;
    const active = Glyphs.activeWithoutCompanion;
    if (active.length === 4 && active.every(g => pred(g))) return 0;
    const want = this._glyphCandidates()
      .filter(pred)
      .sort((a, b) => b.level * b.strength - a.level * a.strength)
      .slice(0, 4);
    if (want.length < 4) return 0;
    this._unequipAllGlyphs();
    let equipped = 0;
    for (const glyph of want) {
      const slot = Glyphs.active.findIndex(g => g === null);
      if (slot < 0) break;
      Glyphs.equip(glyph, slot);
      equipped++;
    }
    return equipped;
  },

  /** 卸到 0 个符文——RU24 的形态 */
  _glyphFormNone() {
    if (Glyphs.activeWithoutCompanion.length === 0) return 0;
    if (MachineHandler.gainedRealityMachines.lt(5000)) return 0;
    return this._unequipAllGlyphs();
  },

  /**
   * 驱动到「下一个待解锁的现实升级」所需的装备形态。
   * @returns {number} 本次装载/卸下的符文数（0 表示没动）
   */
  satisfyGlyphRequirements() {
    try {
      const ready = id => {
        const u = RealityUpgrade(id);
        return !!u && (u.isAvailableForPurchase || u.isBought);
      };
      const savedConfirm = player.options.confirmations.glyphReplace;
      player.options.confirmations.glyphReplace = false;
      try {
        if (!ready(9)) return this._glyphFormOne();
        // [Oreki R26] 24 必须排在 16/17/18 之前：它要的是「0 个符文」，
        // 排在后面就会一直卡在「4 个符文」的形态里等 18；而且它自己再给一个符文槽，
        // 越早拿到越宽松。条件同样只有 `gainedRM ≥ 5000 && 0 装备`，与其它四条不冲突。
        if (!ready(24)) return this._glyphFormNone();
        if (!ready(16)) return this._glyphFormFour(g => g.strength >= 1.5);
        if (!ready(17)) return this._glyphFormFour(g => countValuesFromBitmask(g.effects) >= 2);
        if (!ready(18)) return this._glyphFormFour(g => g.level >= 10);
        return 0;
      } finally {
        player.options.confirmations.glyphReplace = savedConfirm;
      }
    } catch (e) {
      return 0;
    }
  },

  tick() {
    if (!this.active) return { reality: false, upgrades: 0, glyphs: 0 };
    this._frame++;
    const reality = this.tryReality();
    if (!PlayerProgress.realityUnlocked()) return { reality, upgrades: 0, glyphs: 0 };
    let upgrades = 0;
    let glyphs = 0;
    // 现实升级与符文只在每 10 帧跑一次，避免每帧遍历数据库
    if (this._frame % 10 === 0) {
      this.tryUnlockRealityUpgrades();
      upgrades = this.buyRebuyableUpgrades() + this.buyRealityUpgrades();
    }
    if (this._frame % 30 === 0) {
      // 符文形态由 9/16/17/18/24 的要求独占；只有五条全部拿到之后
      // 才回到「装备评分最高的 3 个」的常规策略，避免两边互相拆台。
      const glyphReqsDone = this._glyphReqsDone();
      if (glyphReqsDone) {
        this.manageGlyphs();
        glyphs = this.equipGlyphs();
      } else {
        glyphs = this.satisfyGlyphRequirements();
      }
    }
    return { reality, upgrades, glyphs };
  },
};

// 便于真实新档脚本观测内部计数（不影响任何游戏逻辑）
try {
  globalThis.OrekiRealityAutomation = OrekiRealityAutomation;
} catch (e) {
  // 非浏览器环境（例如单测）忽略
}
