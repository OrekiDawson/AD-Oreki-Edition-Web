// [Oreki AD10] 永恒阶段的通路自动化：时间维度 → 时间定理 → 时间研究
//
// ── 为什么需要（R21 实测 + 源码逐行核对）────────────────────────────
// 首次永恒只需 15 秒（AD4～AD9 已解决），但现实一直不可达。真实原因链：
//   1. `isRealityAvailable()`（src/core/reality.js:119）要求
//        `player.records.thisReality.maxEP.exponent >= 4000` **且** `TimeStudy.reality.isBought`
//      EP 早已满足（实测 1e694437），所以唯一闸门是那个时间研究。
//   2. `TimeStudy.reality` = `DilationTimeStudyState.studies[6]`
//      （src/core/time-studies/dilation-time-study.js:84），属于时间膨胀研究，
//      需要先有大量**时间定理（TT）**并点亮前置研究。
//   3. `TimeTheorems.checkForBuying()`（src/core/time-theorems.js:112）有一条硬前置：
//        `if (PlayerProgress.realityUnlocked() || TimeDimension(1).bought) return true;`
//      即**必须先买过至少一个时间维度**，否则连用 EP 换 TT 都不允许。
//      原版这里会弹「你需要购买至少一个时间维度」的提示——正好是玩家卡住的点。
//   4. 而时间维度 1~4 的解锁条件是 `this._tier < 5`（src/core/dimensions/time-dimension.js:186），
//      只要花 EP 就能买；到 5~8 才需要时间研究。
//
// 也就是说，从「已经能无限次永恒」到「现实」之间，玩家必须手动完成一连串
// 机械操作：买时间维度 → 用 EP 买几百上千次 TT → 逐个点亮时间研究。
// 10000× 速度下这套点击根本跟不上，进度就死在这里（实测 EP 涨到 1e694437 却
// 一个时间研究都没买上）。
//
// ── 本模块做什么（三步，全部走原版真实购买路径）──────────────────────
// A) 买时间维度 1~4：调 `buyMaxTimeDimension(tier, fraction)`，按 EP 扣费。
// B) 用 EP（以及 AM/IP）买时间定理：调 `TimeTheorems.buyMax(true)`，
//    内部走 `TimeTheoremPurchaseType.*.purchase(true)`，成本与增量全是原版公式。
// C) 买时间研究：对存在的普通研究 id 逐个尝试 `TimeStudy(id).purchase()`，
//    能买的就买（前置不满足时 purchase 自己返回 false，不会越级）。
//    为了控制开销，这一项每 30 帧才跑一轮。
//
// ── 边界 ─────────────────────────────────────────────────────────────
// · 只在 `!PlayerProgress.realityUnlocked()` 时生效；现实之后完全交给原版后期内容。
// · 受玩家既有的「自动购买器」总开关控制，关掉即完全停止。
// · 任意挑战中、毁灭现实中不生效（避免干扰挑战内的资源约束）。
// · 不伪造解锁标志、不写历史记录、不跳阶段；现实仍须真实满足
//   `maxEP.exponent >= 4000 && TimeStudy.reality.isBought`。
// · 不碰 `gainedInfinityPoints` / `gainedEternityPoints` 的公式。

import { PlayerProgress } from "./player-progress.js";
// [R101 P0] 原版「自动永恒」开关直接读存档数据 player.auto.eternity.isActive
// （= Autobuyer.eternity.isActive 的 getter 数据源），避免为一行判据引入
// autobuyers 模块的整条导入链（那会让 scripts/check_eternity_gate.mjs 这类
// 纯 Node 回归脚本在 import 期就撞上浏览器全局 window）。

/** 每多少帧跑一次「买时间研究」（233 次尝试比较重，不宜每帧跑） */
const STUDY_TICK_INTERVAL = 30;

/**
 * [R96] 永恒升级 EP 预留的「遥不可及」判定（数量级差）。
 *
 * 原版真实成本序列：5 → 10 → 5e4 → 1e16（`eternity-upgrades.js`）。
 *   · 第一档：刚进永恒层 EP 常低到 0.3~0.5，与 5 EP 差 1.0~1.2 个数量级；
 *     阈值若取 1.0（10 倍）会被误判成遥不可及而放弃预留 ⇒ TD1 把 EP 吃干。
 *   · 第三档 5e4：阈值若放大到 6（1e6 倍），EP≈20 时就会为它预留 ⇒ TD 被长期锁死。
 * 取 2.0（100 倍）：第一档能预留，第三档在 EP≈20 时正确跳过。
 */
const RESERVE_REACHABLE_LOG10 = 2.0;

/**
 * TT 购买收益保持原版 ×1。
 *
 * 旧 MOD 曾把每次真实购买补发到 500 TT，这会让时间研究链、
 * 永恒挑战和首次现实明显提前。五阶段节奏规则生效后，购买收益恢复原版 ×1；
 * 成本曲线、购买资格、资源扣费与真实购买结算仍全部沿用原版。对账逻辑保留，
 * 以避免存档或手动购买路径绕过统一口径：
 *   · 每帧读 `TimeTheorems.totalPurchased()`（= amBought + ipBought + epBought 之和）；
 *   · 与上一次基线比较，增量 Δ 就是「本帧真实发生的购买次数」；
 *   · 补发 Δ×(1−1) TT（即 0）走原版 `Currency.timeTheorems.add`，随后立刻推进基线。
 * 这样手动点击、原版自动购买、MOD 自动购买、单次/批量购买**全部覆盖**，
 * 且同一笔购买不可能被发两次（基线在发奖后立即前进）。
 */
const TT_REWARD_MULTIPLIER = 1;

/**
 * [R104 P1] 单帧购买次数上限：只用于拦截**数量级异常的换档跳变**（例如会话内导入更高进度存档）。
 *
 * 高倍率下每次服务都可能真实购买数十万 TT；旧的小上限会把合法批量购买误判成换档，
 * 从而让时间研究链停滞。这里因此保留数量级级保护，而不是限制正常购买。
 * 合法真实购买量远小于 1e8；只有换档级跳变才会超过它。
 */
const TT_REWARD_MAX_DELTA_PER_TICK = 1e8;

/**
 * [R116-01 P0] 首次永恒自动结算前的驻留窗口（毫秒）。
 *
 * 与 Android r115-01/p0-first-eternity-dwell 的
 * `OrekiAutoEternityGate.FIRST_ETERNITY_DWELL_MS = 180_000L` 同一玩家可见语义：
 * 只延迟「自动化替玩家按首次永恒」，不改变任何游戏机制（详见
 * `firstEternityDwellRemainingMs()` 的语义说明）。
 */
const FIRST_ETERNITY_DWELL_MS = 180_000;

/**
 * 普通时间研究 id 列表：直接从数据库取，不再手写区间。
 *
 * [Oreki R25] 原来手写的是「11~73 + 每组 x01~x03」，漏掉了所有 x04：214 / 224 / 234
 * （normal-time-studies.js 里确实存在这三个）。R25 实测末态 boughtIds 里恰好没有 214/234。
 * 影响：
 *   · 234 是 EC12 的另一条入口（ec-time-studies.js:139 `requirement: [233, 234]`，
 *     AT_LEAST_ONE），214 又是 227/228 的前置（normal-time-studies.js:633）——
 *     这条路整条不可达；
 *   · 好在 233（←225/226←213）这一条能走通，所以 EC12 还能靠 233 满足；
 *     真正的 EC12 死锁是「买错维度分叉（71）」，见 `blockedStudies()`。
 *   但手写枚举与数据库脱节本身就是隐患（以后再加 x04 还会漏），改为直接读数据库。
 */
function* studyIds() {
  const db = (typeof GameDatabase !== "undefined" && GameDatabase.eternity?.timeStudies?.normal) || [];
  for (const study of db) yield study.id;
  // 兜底：万一数据库还没初始化，仍用旧的枚举形状（不会更差）
  if (!db.length) {
    for (let id = 11; id <= 73; id++) yield id;
    for (let hundred = 80; hundred <= 240; hundred += 10) {
      for (let k = 1; k <= 4; k++) yield hundred + k;
    }
  }
}

export const OrekiEternityAutomation = {
  _frame: 0,
  /** [R104 P0] 研究/EC 的真实时间节流（毫秒）；不再用被服务次数放大后的 _frame 取模。 */
  _lastStudyTickAt: 0,
  _lastEcTickAt: 0,
  /** [R116-01 P0] 首次永恒驻留计时起点（单调时钟毫秒）；null = 尚未开始/已重置。 */
  _firstEternityDwellStartedAt: null,
  /** [R116-01 P0] 驻留计时所属存档身份（records.gameCreatedTime）；换档即重置。 */
  _firstEternityDwellSaveId: null,
  /** [R116-01 P0] 本会话是否已确认「本存档曾经永恒过」（latch；换档才清）。 */
  _firstEternityEverSeen: false,
  /** [Oreki R40-A] 「满级关换关 respec」的次数与上次快照，仅用于观测与防抖 */
  _respecCount: 0,
  _fullEcRespec: null,
  /**
   * [Oreki R42-C] 被 catch 吞掉的异常（只读观测，不参与任何判定）。
   *
   * 本模块几乎所有方法都是 `try { ... } catch (e) { return false; }`。这在
   * 「资源不够、前置没满足」时是对的，但它同时把**写错的代码**伪装成「条件不满足」：
   * `FACTS` C.19 与 C.22 各踩过一次（`Currency.*.value.gte()` 抛 TypeError、
   * `VUnlocks` 漏 import 抛 ReferenceError），表现都是「判据永远为假」，
   * 从外部看不出任何异常。
   *
   * 这里只做一件事：把每个外层 catch 的异常消息记下来，供探针读。
   * **不改变任何返回值、不改变任何游戏状态**，所以「记录」与「行为」是两件事，
   * 加它不会让原本能跑的逻辑变慢或变快（同一个异常一条字符串，重复消息不重复写）。
   */
  _lastError: "",

  /**
   * 记录一次被吞掉的异常。同一个 tag+消息只写一次，避免每帧字符串拼接。
   * @param {string} tag 调用点（方法名）
   * @param {*} e 捕获到的异常
   */
  _err(tag, e) {
    const msg = `${tag}: ${(e && e.message) || e}`;
    if (this._lastError !== msg) this._lastError = msg;
  },

  get active() {
    try {
      // [Oreki R26] 原来这里写着 `if (PlayerProgress.realityUnlocked()) return false;`，
      // 意味着**第一次现实之后整套「买时间维度 / TT / 时间研究 / 自动永恒」全部停摆**。
      // 但现实重置会把 `player.eternityChalls`（EC 完成记录）、时间定理、时间维度、
      // 膨胀研究全部清空（reality.js:651 / :670 / :673），
      // 而再次现实的唯一闸门仍是 `TimeStudy.reality.isBought`（需要 EC11/EC12 各 5 次 +
      // 8 级时间维度 + 数百万 TT）。不放开这一层，第二次现实就永远等不到 —— 现实层直接卡死。
      // 现在只排除天神现实（那里有各自的资源约束，不能乱买）。
      //
      // [Oreki R29] **上面这条「排除天神现实」是错的，已撤销 —— 它造成了一个真实死锁。**
      //
      // ── 死锁链（源码事实）─────────────────────────────────────────────
      // 1. 天神 run 的结算写入点在 `reality.js:341-342`：
      //      `if (Currency.antimatter.gt(player.celestials.teresa.bestRunAM))
      //         player.celestials.teresa.bestRunAM = Currency.antimatter.value;`
      //    —— 它发生在**现实结算**（`finishProcessReality` → `giveRealityRewards`）里。
      //    也就是说：run 必须靠「一次带奖励的现实」才能真正结算。
      // 2. 但 `isRealityAvailable()`（reality.js:119-121）是
      //      `player.records.thisReality.maxEP.exponent >= 4000 && TimeStudy.reality.isBought`
      //    —— 硬依赖 `TimeStudy.reality`（膨胀研究 6）。
      // 3. 而现实重置会清空 EC 完成记录 / 时间定理 / 时间维度 / 膨胀研究
      //    （reality.js:651 / :670 / :673），于是 `TimeStudy.reality` 变成未购买。
      // 4. 重买它需要 EC11 + EC12 各 5 次 + 8 级时间维度 + 数百万 TT —— 全靠本模块。
      // ⇒ 一旦进了天神 run，本模块停摆 → EC 再也打不回来 → `isRealityAvailable()` 永假
      //   → run 永远等不到那次结算现实 → **天神链彻底卡死**。
      //
      // 实测证据（R28 300 秒真实新档，`web/_tools/_r28-300.jsonl`）：
      //   t=202s 起 `realities` 永久停在 30 直到结束；末态 `ecDone` 全 0、
      //   `teresaRun=true` 但 `effarigUnlocked=false`、`endState=0`。
      //   即：进了特蕾莎 run 之后，现实再也发生不了。
      //
      // ── 为什么放开是安全的 ──────────────────────────────────────────
      // 天神现实里本模块买的仍然是**原版允许买的东西**（时间维度 / TT / 时间研究 /
      // 膨胀研究），全部走 `purchase()` 系列真实路径、真实扣费、真实前置判定；
      // 买不上就返回 false，不存在伪造。佩勒毁灭态仍由下面的 `Pelle.isDoomed` 排除。
      // 唯一的变化是：不再因为「处于天神 run」而整套停摆。
      if (!player.auto.autobuyersOn) return false;
      if (NormalChallenge.isRunning || InfinityChallenge.isRunning || EternityChallenge.isRunning) return false;
      if (Pelle.isDoomed) return false;
      return true;
    } catch (e) {
      this._err("active", e);
      return false;
    }
  },

  /**
   * 永恒重置的独立门禁。
   *
   * `active` 还负责时间维度、TT 与时间研究购买；挑战中必须关闭这些经济动作。
   * 但永恒挑战的完成只能由“达到原版目标后的真实永恒”产生，不能把重置本身一起停掉。
   * 因此只在 EC 内额外放行重置入口；普通/无限挑战与 Pelle 毁灭态仍不接管。
   */
  get eternityResetActive() {
    try {
      if (player.auto.autobuyersOn === false || Pelle.isDoomed) return false;
      if (EternityChallenge.isRunning) return true;
      return this.active;
    } catch (e) {
      this._err("eternityResetActive", e);
      return false;
    }
  },

  /**
   * A) 用 EP 买时间维度 1~8。
   *
   * [Oreki R25] 原来只买到 4 级。但膨胀研究 6（`TimeStudy.reality`）的第一条要求是
   * `TimeStudy.timeDimension(8).isBought`（dilation-time-studies.js:50），
   * 而 `TimeStudy.timeDimension(8)` 就是**膨胀研究 5**（dilation-time-study.js:78
   * `studies[tier - 3]`），也就是 5~8 级时间维度的解锁链。
   * 这里按 `isUnlocked` 自己判定（8→1 顺序，高级维度对 DD 的加成最大），
   * 只买得起才买，成本与扣费全走原版 `buyMaxTimeDimension`。
   */
  /**
   * [R96] 当前应保留的 EP（Decimal）；null 表示无需预留、EP 可自由花。
   *
   * 为什么需要：实测 Android 侧 `bigE=8、EP=0、eupBits=0`，34 分钟一次永恒升级都没买到 ——
   * 时间维度 TD1（成本 1/3/9/27…）每次永恒重置后立刻把个位数 EP 吃干。
   * 永恒升级给的是**乘数**（idMultEP / idMultEternities / tdMultAchs…），
   * TD 给的是**层数**，早期乘数收益远高于多买一层 TD。
   *
   * 预留量 = 「尚未购买的永恒升级里最便宜那一项」的**真实成本**（`EternityUpgrade.cost`
   * 来自原版 config，不是常量），因此买到一档后自动抬到下一档；
   * 全部买完或最便宜项遥不可及时返回 null（死锁保护）。
   */
  eternityUpgradeReserve() {
    if (Currency.eternities.value.lt(1)) return null;
    let cheapest = null;
    for (const upgrade of EternityUpgrade.all) {
      if (upgrade.isBought) continue;
      const rawCost = upgrade.cost;
      if (rawCost === null || rawCost === undefined) continue;
      // [R104 P0] 原版 cost 是**原生 number**（secret-formula/eternity/eternity-upgrades.js：
      // cost: 5 / 10 / 5e4 / 1e16 / 1e40 …），直接 .lt() 会抛 TypeError；
      // 异常被 buyTimeDimensions 的 catch 吞掉 ⇒ 每次调用都返回 false ⇒ TD/TT 永远买不到，
      // 整条时间研究/膨胀/现实链停摆（R104-02 实测 t≈612s 起 _lastError="cost.lt is not a function"）。
      const cost = rawCost instanceof Decimal ? rawCost : new Decimal(rawCost);
      if (cheapest === null || cost.lt(cheapest)) cheapest = cost;
    }
    if (cheapest === null) return null;
    const ep = Currency.eternityPoints.value;
    if (ep.lte(0)) return cheapest;
    if (cheapest.log10() - ep.log10() > RESERVE_REACHABLE_LOG10) return null;
    return cheapest;
  },

  /** EP 是否已超出预留区（可自由花）。 */
  isEternityPointsBeyondReserve() {
    const reserve = this.eternityUpgradeReserve();
    if (reserve === null) return true;
    return Currency.eternityPoints.value.gte(reserve);
  },

  buyTimeDimensions() {
    try {
      // [R96] EP 预留闸门（修正版）。
      //
      // 旧实现有两个真缺陷（独立审查指出，已复核）：
      //   a) 只要 `EP ≥ 预留量` 就放行**全部** TD，会把「刚好够买升级」的钱花掉；
      //   b) `buyMaxTimeDimension(...)` 返回 false 时仍然置 `bought = true`，属于假成功。
      //
      // 现在的规则：
      //   1) 唯一例外是「播种首个 TD1」——它未解锁时允许花掉 EP 解锁/购买它
      //      （永恒升级商店的前置就是 TD1 已买）。
      //   2) TD1 已买之后，**先让调用方买永恒升级**（tick 已改为 upgrades 先于 dims），
      //      这里只在「超出预留区」时才继续买 TD。
      //   3) 每次购买都用返回值判定，绝不假装成功。
      const firstTd = TimeDimension(1);
      const needsFirstSeed = !firstTd.bought;
      if (!needsFirstSeed && !this.isEternityPointsBeyondReserve()) return false;

      let bought = false;
      if (needsFirstSeed) {
        // 只播种第一层：买 1 次就够解锁商店，不做 8 层轮转（避免把预留花光）。
        if (firstTd.isUnlocked && firstTd.isAffordable) {
          bought = buyMaxTimeDimension(1, 0.5) === true;
        }
        return bought;
      }

      for (let tier = 8; tier >= 1; tier--) {
        const td = TimeDimension(tier);
        if (!td.isUnlocked) continue;
        if (!td.isAffordable) continue;
        // 只认真实返回值；失败不计入 bought，避免「假成功」掩盖没买到。
        if (buyMaxTimeDimension(tier, 0.5) === true) bought = true;
      }
      return bought;
    } catch (e) {
      this._err("buyTimeDimensions", e);
      return false;
    }
  },

  /**
   * B) 用 EP / IP / AM 买时间定理。
   * 注意 `TimeTheorems.buyMax` 内部会先调 `checkForBuying(true)`，
   * 拿不到「已买时间维度」这条前置时直接返回 0，不会报错也不会弹窗。
   */
  buyTimeTheorems() {
    try {
      return TimeTheorems.buyMax(true) > 0;
    } catch (e) {
      this._err("buyTimeTheorems", e);
      return false;
    }
  },

  /**
   * [R96] TT 购买收益 ×500 的唯一发奖点（每帧调用，幂等）。
   *
   * 边界：
   *   · 首次调用只建立基线（`_ttSettled === null`），不为历史购买补发；
   *   · Δ = 0（余额不足 / 购买失败 / 恰好不够）→ 不发奖；
   *   · Δ < 0（读档回退、永恒重置清空计数）→ 只重置基线；
   *   · 补发抛错 → 记录错误并推进基线，避免每帧重试风暴（不静默：走 `_err`）。
   */
  settleTimeTheoremReward() {
    try {
      // 注意：`TimeTheorems.totalPurchased()` 在 3.21 里是
      // `am.amount + ip.amount + ep.amount`，返回**原生 number**（不是 Decimal）。
      // 之前写成 `total.toNumber()` 会抛 TypeError，被 catch 后又调一次同样抛错，
      // 结果是 Web 端一次都不会发奖（测试替身带 toNumber 才假绿）。这里按真实类型取。
      const raw = TimeTheorems.totalPurchased();
      const totalNum = typeof raw === "number" ? raw : raw.toNumber();
      if (!Number.isFinite(totalNum)) return 0;

      // 基线在**购买之前**建立：tick 里先调本方法再买，首帧那笔购买才不会被当成历史。
      if (this._ttSettled === null || this._ttSettled === undefined) {
        this._ttSettled = totalNum;
        return 0;
      }
      if (totalNum < this._ttSettled) {
        // 读档回退 / 永恒重置清空计数：只重置基线
        this._ttSettled = totalNum;
        return 0;
      }
      const delta = totalNum - this._ttSettled;
      if (delta <= 0) return 0;

      // 切档保护：单帧正常最多买几十次，出现巨大跳变说明换了存档（购买计数更高），
      // 绝不能把别人的历史购买当成新购发奖 —— 只重设基线。
      if (delta > TT_REWARD_MAX_DELTA_PER_TICK) {
        this._err("settleTimeTheoremReward", new Error(
          `delta ${delta} 超出单帧上限 ${TT_REWARD_MAX_DELTA_PER_TICK}，按切档处理只重设基线`));
        this._ttSettled = totalNum;
        return 0;
      }

      const extra = delta * (TT_REWARD_MULTIPLIER - 1);
      Currency.timeTheorems.add(new Decimal(extra));
      this._ttSettled = totalNum;
      return extra;
    } catch (e) {
      this._err("settleTimeTheoremReward", e);
      // 失败**不推进基线**：下一帧重试，避免这笔奖励被永久吞掉。
      return 0;
    }
  },

  /**
   * [Oreki R45] 只读自述：「这条动作为什么买了 0 个」。
   * 由 `oreki-smart-executor.js::explainNoop()` 调用；只读、不改状态、说不清返回空串。
   * 分支顺序照抄真实入口的门禁顺序（`tickEternity()` / `TimeTheorems.buyMax()`），
   * 不另造一套判据 —— 解释与执行必须走同一条链，否则面板会开始撒谎。
   */
  noopReason(verbId) {
    try {
      if (verbId === "buyTimeTheorem") {
        const canBuy = PlayerProgress.realityUnlocked() || TimeDimension(1).bought;
        if (!canBuy) return "还没买过时间维度 1，原版不允许用 EP 换时间之理";
        if (player.eternities.eq(0)) return "还没做过永恒，三种货币都不够换时间之理";
        return "反物质 / IP / EP 三种货币都不够买下一个时间之理";
      }
      if (verbId === "eternity") {
        // EC 中 active 故意为 false（避免挑战内买 TT/TD/TS），但
        // eternityResetActive 仍为 true；解释链必须与真实重置入口一致。
        if (!this.eternityResetActive) {
          return "永恒自动器未启用（自动购买器关闭，或处于 Pelle 末日态）";
        }
        if (player.auto.eternity.isActive !== true && !this._eternityBootstrapActive()) {
          return "永恒自动器未启用（原版自动永恒开关已关闭）";
        }
        if (globalThis.OrekiIu15Sprint?.freezeResets === true) {
          return "IU15 冲刺期间禁止永恒（永恒会把反物质指数打回 0）";
        }
        if (!Player.canEternity) return "还没到可永恒门槛（IP 需 1.797e308）";
        const dwellMs = this.firstEternityDwellRemainingMs();
        if (dwellMs > 0) {
          return `首次永恒驻留中（剩余 ${Math.ceil(dwellMs / 1000)} 秒）`;
        }
        if (this.holdForRealityUpgrade10()) {
          return "为拿现实升级 10 暂压本现实里的第一次永恒（IP 指数需 ≥400），最多压 10 秒";
        }
        if (this.ecEntryPending()) return "正在等 EC 入口（主研究已买、只差资源），先不重置";
        if (EternityChallenge.isRunning) {
          const challenge = EternityChallenge.current;
          return challenge?.canBeCompleted
            ? ""
            : "当前永恒挑战未达到原版完成条件";
        }
        // 与 tickEternity() 同一门槛（×1）：收益不足当前 EP 就不重置，面板文案同步。
        if (gainedEternityPoints().lt(Currency.eternityPoints.value.times(1))) {
          return "本次永恒收益不足当前 EP（没让 EP 翻倍），等涨起来再重置";
        }
        return "";
      }
      return "";
    } catch (e) {
      this._err("noopReason", e);
      return "";
    }
  },

  /**
   * 首次永恒驻留结束后，让真实永恒结算在下一调度拍优先获得唯一动作槽。
   *
   * 这不是绕过调度器或门禁：仍由 runCycle 的全局间隔、同帧单动作和 tickEternity
   * 的全部合法条件决定是否真的结算。它只消除 routine/early 等低优先级动作长期
   * 先占槽导致的额外等待。新档实测 canEternity 于 482 s 成立，180 s 驻留结束后
   * 仍约 100 s 才结算；默认 10 s 节拍表明这是后续任务先占槽的调度延迟。
   */
  shouldPrioritizeSettlement() {
    try {
      if (!this.eternityResetActive) return false;
      if (this.noopReason("eternity") !== "") return false;
      // priorityHint 必须与 tickEternity 的真实入口门禁一致。否则玩家关闭
      // auto.eternity 后会长期把唯一优先槽钉在永不动作的 eternityReset 上，
      // 饿死 early 购买。这里只做只读判据，不调用会推进状态的 _justCrunchedFrame()。
      if (player.auto.eternity.isActive !== true && !this._eternityBootstrapActive()) {
        return false;
      }
      if (player.break !== true) return false;
      if ((this._crunchSkipFrames ?? 0) > 0) return false;
      return true;
    } catch (e) {
      this._err("shouldPrioritizeSettlement", e);
      return false;
    }
  },

  /**
   * 目标 EC 需要的「互斥研究列」。
   *
   * 时间研究树有三组互斥列（`requiresST` 表示「买了对方就要花空间定理」，
   * 而 Reality 之前 `V.availableST` 恒为 0，等于只能选一列）：
   *   列 A：121 / 122 / 123（normal-time-studies.js:306-345）
   *   列 B：131(←121) / 132(←122) / 133(←123)（:352-...）
   *   列 C：141(←131) / 142(←132) / 143(←133)（:388-...）
   *   151 只要列 C 任意一个（:430）。
   *
   * 而各 EC 的主前置是写死的（ec-time-studies.js）：
   *   · EC4 → 143 → 133 → 123（第 43-44 行 `requirement: [143]`）
   *   · EC8 → 123（第 90-92 行 `requirement: [123]`）
   *   · EC6 → 121（第 65-68 行 `requirement: [121]`）
   * 也就是说 EC4/EC8 与 EC6 必须在**不同列**里打，必须靠 respec 换列。
   * R25 实测：贪心按 id 升序只会买到 121 列，末态 `ts143 = false`、`ts123 = false`，
   * 于是 ec4.cur 早就 ≥ tot（met = true）却 `bought = false`、EC4 永远是 0 次。
   */
  preferredColumn() {
    try {
      const id = this.nextUnfinishedEcId();
      if (id === 4 || id === 8) return 123;
      return 121;
    } catch (e) {
      this._err("preferredColumn", e);
      return 121;
    }
  },

  /**
   * [Oreki R40-A] 目标维度分叉：73（时间维度）还是 71（反物质维度）。
   *
   * ── 为什么需要单独一个判定（R40-A 200ms 真实新档实测）───────────────
   * 原实现是 `path = this.nextUnfinishedEcId() === 12 ? 73 : 71`，即「只有当前目标正好是
   * EC12 时才走 73」。但两条自动化对「当前目标」的定义不同：
   *   · 本模块 `nextUnfinishedEcId()` 按 1→12 取第一个未满 = 可能是 **EC6**
   *     （EC6 卡在复制器星系资源上，会长期停在那里）；
   *   · `OrekiDilationAutomation._targetEc()` 按 9→10→11→12 取，此时是 **EC12**，
   *     而 EC12 的 `secondary.forbiddenStudies = [71,72]`（ec-time-studies.js:141），
   *     只要 71 在树里它每 6 s 就 `respecTimeStudies(true)` 一次。
   * 于是形成闭环：dilation 清空整棵树（期望换到 73）→ 本模块认为目标是 EC6（允许 71）
   * → 立刻把 71 买回来 → dilation 再次判定被 71 阻挡 → 再 respec……
   *
   * 实测证据（`_r40/r40a-diag.refunds.jsonl`，700 s 真实新档）：
   *   t=27.8 / 34.0 / 40.3 / 46.6 / 52.8 / 59.1 / 65.3 s 连续 7 次 respec，
   *   间隔恒为 6.2 s，`unlocked=0`、`studiesLen=38` 全程不变、EC 完成数一次都没增加
   *   —— 纯抖动，38 s 里把 38 个研究反复清空重建，EC12 需要的 233/234 链永远建不完。
   *
   * 修法：把「维度分叉」从「当前目标是不是 12」改成「EC11 是否已满、EC12 是否未满」。
   * 这是**全局树状态**问题，与「下一个要打哪一关」解耦，因此不影响
   * `nextUnfinishedEcId()` 对 EC6/EC3 等窄保护的语义。
   *
   * 为什么必须换到 73：原版 71 要求 `!EternityChallenge(12).isUnlocked`、
   * 73 要求 `!EternityChallenge(11).isUnlocked`（normal-time-studies.js:146 / :190），
   * 而 EC12 的 `forbiddenStudies=[71,72]`、EC11 的是 `[72,73]` —— 两关天然互斥，
   * 在 EC11 打满之后必须常驻 73 一侧，直到 EC12 也打满。
   * 全程只走原版 `purchase()`，不写任何解锁位。
   */
  dimensionPathId() {
    try {
      const ec11 = EternityChallenge(11);
      const ec12 = EternityChallenge(12);
      if (ec11.completions >= ec11.maxCompletions && ec12.completions < ec12.maxCompletions) return 73;
      return 71;
    } catch (e) {
      this._err("dimensionPathId", e);
      return 71;
    }
  },

  /**
   * 当前不允许购买的研究集合：
   *   1) 与目标 EC 所需列互斥的另外两列；
   *   2) 维度分叉里没选中的那两条（71/73 只能留一条，见下）。
   *
   * 维度分叉（DIMENSION_PATH，normal-time-studies.js:146/188）：
   *   · EC11 的 forbiddenStudies = [72, 73]（ec-time-studies.js:131）→ 只能走 71 那条；
   *   · EC12 的 forbiddenStudies = [71, 72]（ec-time-studies.js:141）→ 只能走 73 那条；
   *   81 的前置是 71、83 的前置是 73，而默认 allowedDimPathCount = 1，
   *   买错一条就再也买不到另一条 → 对应 EC 的 `hasForbiddenStudies` 恒真。
   *   R25 实测：末态 `ts71 = true` → `ec12.forb = true, met = false`。
   */
  blockedStudies() {
    const col = this.preferredColumn();
    const blocked = new Set();
    for (const id of [121, 122, 123]) if (id !== col) blocked.add(id);
    if (col === 123) {
      blocked.add(131).add(132);
      blocked.add(141).add(142);
    } else if (col === 122) {
      blocked.add(131).add(133);
      blocked.add(141).add(143);
    } else {
      blocked.add(132).add(133);
      blocked.add(142).add(143);
    }
    // [Oreki R40-A] 由 `dimensionPathId()` 统一决定，不再看 nextUnfinishedEcId()。
    const path = this.dimensionPathId();
    for (const id of [71, 72, 73]) if (id !== path) blocked.add(id);
    return blocked;
  },

  /** 已经买错列/买错分叉 → 只能靠 respec 换回来 */
  needsBranchRespec() {
    try {
      if (!this.active) return false;
      if (player.challenge.eternity.unlocked !== 0) return false;
      for (const id of this.blockedStudies()) {
        if (TimeStudy(id).isBought) return true;
      }
      return false;
    } catch (e) {
      this._err("needsBranchRespec", e);
      return false;
    }
  },

  /** C) 逐个尝试购买时间研究；前置不满足的 purchase 会自己返回 false */
  buyTimeStudies() {
    try {
      const blocked = this.blockedStudies();
      let bought = 0;
      for (const id of studyIds()) {
        if (blocked.has(id)) continue;
        try {
          const study = TimeStudy(id);
          if (!study || study.isBought) continue;
          if (study.purchase()) bought++;
        } catch (e) {
          // 该 id 不存在或暂时不可买，跳过
        }
      }
      return bought;
    } catch (e) {
      this._err("buyTimeStudies", e);
      return 0;
    }
  },

  /**
   * D) 买时间膨胀研究（1~6）。
   * `TimeStudy.reality` 就是`DilationTimeStudyState.studies[6]`（dilation-time-study.js:84），
   * 而膨胀研究是逐级门槛：
   *   1 → 5000 TT、2 → 1e6、3 → 1e7、4 → 1e8、5 → 1e9、6 → 1 TT，
   * 每一级都要求前一级或对应的时间维度研究。
   * 实测（R21）普通研究已买 22 个、TT 已有 260 万，但一个膨胀研究都没买 ——
   * 因为普通研究循环根本覆盖不到这个集合，这就是 Reality 卡死的最后一环。
   */
  buyDilationStudies() {
    try {
      let bought = 0;
      for (let id = 1; id <= 6; id++) {
        try {
          const study = DilationTimeStudyState.studies[id];
          if (!study || study.isBought) continue;
          if (study.purchase()) bought++;
        } catch (e) {
          // 该级暂时不可买（TT 不足或前置未满足）
        }
      }
      return bought;
    } catch (e) {
      this._err("buyDilationStudies", e);
      return 0;
    }
  },

  /**
   * E) 购买永恒挑战（EC）的研究，并自动进入当前已解锁的 EC。
   *
   * 事实：EC 的解锁不是靠「打完上一个」，而是靠**买下对应的 EC 时间研究**——
   *   `ECTimeStudyState.purchase()` 里写着 `player.challenge.eternity.unlocked = this.id`
   *   （src/core/time-studies/ec-time-study.js:34）。
   * 而 `EternityChallenge.isUnlocked` 就是 `player.challenge.eternity.unlocked === this.id`
   * （src/core/eternity-challenge.js:54），也就是**同一时刻只有一关是开着的**。
   *
   * 这条链是 Reality 的必经之路：膨胀研究 1 要求 EC11 与 EC12 全部完成
   * （secret-formula/eternity/time-studies/dilation-time-studies.js:19），
   * 而膨胀研究 6（= TimeStudy.reality）还要求全部 pre-Reality 成就。
   *
   * 这里只负责按下「开始」那一下；挑战中的资源目标、完成次数与奖励
   * 仍由原版挑战和永恒结算自然产生，不写完成位或补发资源。
   */
  /**
   * [Oreki R37-A] 删除了死变量 `_ecTarget`（恒为 1，中间没有任何赋值）。
   *
   * 原缺陷（R36-A 报告点出）：`shouldHoldReset()` 读 `this._ecTarget`（旧 :404），
   * 而它从定义（旧 :295）到读取之间**没有任何写入点**，所以「暂停自动永恒
   * 让 EC 入口资源爬满」这条保护**只对 EC1 生效**；EC2~EC12 全程被自动永恒打断，
   * 入口资源的峰值缓存（`ECTimeStudyState.invalidateCachedRequirements()`）反复清零。
   * 现在直接读 `nextUnfinishedEcId()`（本对象已有的真实实现，按 1→12 找第一个未满的），
   * 与 `_driveEcChain` 的目标完全一致，不再有第二份状态。
   */

  /**
   * E) 推进永恒挑战（EC1→EC12），为 Reality 的膨胀研究 1 铺路。
   *
   * 关键机制（源码逐个核对，这是之前卡在 EC2 的真正原因）：
   * 1. `ECTimeStudyState.canBeBought` 里有
   *      `if (player.challenge.eternity.unlocked !== 0) return false;`
   *    ——**只要已经解锁了某一关，就再也买不了别的 EC 研究**。
   *    `unlocked` 只在 `respecTimeStudies()` 里被清 0（time-studies.js:149），
   *    而它会退款并清空普通研究。所以原版流程是：打完一关 → 重洗时间研究 → 买下一关。
   *    之前只调 `purchase()`，一关满级后 `unlocked` 永远停在那，于是永远买不到 EC3。
   * 2. 官方购买入口不是 `purchase()` 而是 `purchaseUntil()`
   *    （ec-time-study.js:52）：它会先 `commitToGameState(buyStudiesUntil(目标, id))`
   *    补齐该 EC 需要的研究路径再重试购买；EC11/12 还补 191/193。
   *
   * 本方法一关一关推进，每步都走原版真实路径：
   *   - 挑战在跑 → 不重复进入（完成由原版挑战目标与真实永恒结算决定）
   *   - 当前关没满 5 次 → start(true)
   *   - 当前关已满 → respecTimeStudies(true) 清 unlocked 并退款
   *   - unlocked === 0 → 对目标关 purchaseUntil()，买上了立刻 start(true)
   *   - 买不上就停在这一关等资源（不跳关、不伪造）
   */
  buyEcStudiesAndStart() {
    try {
      // 1) 能买的 EC 研究都买掉（canBeBought 会自己校验：unlocked 为 0 / 主研究已买 / 二级资源达标）
      const targetId = this.nextUnfinishedEcId();
      if (!targetId) return false;
      for (const id of this.ecPriorityOrder()) {
        try {
          // 只处理当前目标；高优先级目标暂时买不起时等待资源，不能在同一拍
          // 降级购买低优先级 EC，否则 Reality 后仍会重新串行打完整条 1→12 链。
          if (id !== targetId) continue;
          // 【R36 修复】已经解锁了某一关就不能再买别的 EC 研究
          // （ec-time-study.js:80 `if (player.challenge.eternity.unlocked !== 0) return false;`）。
          // 不 break 的话，后面的 id 会白跑一轮「补前置研究」，白白烧掉 TT。
          if (player.challenge.eternity.unlocked !== 0) break;

          const study = TimeStudy.eternityChallenge(id);
          if (!study || study.isBought) continue;
          // 关键：**已经打满 5 次的 EC 不要再买它的研究**。
          // 否则会出现死循环：买下已满级的 EC 研究 → 下一帧判定「已满」→ respec 清空研究树
          // → 再把同一关买回来…… 实测后果是 TT 一直在退，但已买普通研究恒为 0，
          // 整个时间研究链永远建立不起来（R23 实测：59 秒 TT 367 万、研究 0 个）。
          const challenge = EternityChallenge(id);
          if (challenge && challenge.completions >= this.ecRequiredCompletions(id)) continue;

          // 【R36 关键修复 · 真正的全局阻塞点】
          // EC9~EC12 买不上的真正原因**不是资源**，而是**前置普通时间研究没买**。
          // ECTimeStudyState.canBeBought（src/core/time-studies/ec-time-study.js:76-87）有三条：
          //   ① this.isAffordable                      —— 资源
          //   ② player.challenge.eternity.unlocked !== 0 —— 同一时刻只能开着一关
          //   ③ this.config.requirement.some(s => TimeStudy(s).isBought)  ← **前置研究**
          //      EC9 的 requirement 是 [151]（normal-time-studies.js:430「所有时间维度提升 1e4 倍」），
          //      EC10/11/12 是 [181]。
          // 原实现只调 study.purchase()，**从不补前置** ⇒ 第③条恒为 false ⇒
          // canBeBought 恒 false ⇒ EC9~EC12 永远买不上。
          // R36 实测（web/_tools/_r36a/_r36a-ec9.jsonl）：
          //   infPowerL = 1.29e12931925  ≫ 门槛 1e17498（资源早就够了）
          //   ecReqTot9L = 17498、ecUnlocked = 8、ecDone = [5,5,5,5,5,5,5,5,0,0,0,0]
          //   ec9StudyBought = false
          // ⇒ R35「EC9 是无限之力 1e17498 墙」的结论**是错的**，
          //   真正卡住的是「研究 151 没被买」。
          //
          // 修法：买不动时，按 EC 配置里的 requirement 补齐前置普通研究链
          // （普通研究自带 purchaseUntil() → buyStudiesUntil()，会连同整条前置一起买）。
          // 买不上就等下一帧（TT 会继续涨），不跳关、不伪造。
          if (!study.canBeBought) {
            for (const sid of (study.config?.requirement || [])) {
              try {
                const pre = TimeStudy(sid);
                if (pre && !pre.isBought) pre.purchaseUntil();
              } catch (e) {
                // 该前置研究暂时不可买，等下一帧
              }
            }
          }
          study.purchase();
        } catch (e) {
          // 该 EC 研究暂不可买
        }
      }

      // 2) 已有挑战在跑就不重复进入；完成仍由原版挑战机制产生。
      if (EternityChallenge.isRunning) return false;

      // 3) 进入当前已解锁的那一关
      const unlockedId = player.challenge.eternity.unlocked;
      if (!unlockedId) return false;
      let challenge;
      try {
        challenge = EternityChallenge(unlockedId);
      } catch (e) {
        return false;
      }
      if (!challenge || !challenge.isUnlocked) return false;
      if (challenge.completions >= this.ecRequiredCompletions(unlockedId)) {
        // [AD11.1] 这一关已满：必须 respecTimeStudies 才能把 unlocked 清 0，
        // 否则 ECTimeStudyState.canBeBought 里那条 unlocked !== 0 就直接 return false，
        // 后面所有 EC 研究永远买不上（实测卡在 EC2 满级后无法推进）。
        // respec 会退款并清空普通研究，下一步由 AD10 的自动买研究重新补齐。
        //
        // [Oreki R40-A] 加一层「同一关 + 同一完成次数快照只 respec 一次」的会话内闸门。
        // 正常路径下 respec 会把 unlocked 清 0、本分支自然只走一次；但若有别的模块
        // 在同一帧内又把这一关的研究买回来（实测 `_driveEcChain` 每 6 s 会 respec 一次，
        // 之后本模块 30 帧内的 `buyTimeStudies` 会把 71/EC 研究补回去），
        // 就会出现「重置 → 重买 → 再重置」的无限循环。
        // 3 s 窗口只抑制这种同快照抖动：一旦这一关的完成次数真的变了（例如现实重置后
        // 从 5 回到 0 再打回 5），快照不同，闸门自动放行。
        const now = Date.now();
        const mark = this._fullEcRespec;
        if (mark && mark.id === unlockedId && mark.completions === challenge.completions
          && now - mark.at < 3000) {
          return false;
        }
        this._fullEcRespec = { id: unlockedId, completions: challenge.completions, at: now };
        this._respecCount++;
        respecTimeStudies(true);
        return false;
      }
      // [R101 P0 对齐 Android] 原版「进入永恒挑战」在 Player.canEternity 为真时
      // 会先执行一次真实永恒（eternity-challenge.js:209
      // `if (Player.canEternity) eternity(false, auto, { enteringEC: true })`）。
      // 因此 autoEternity 关闭且此刻 canEternity 为真时，自动进入 EC == 自动永恒。
      // 该窗口内不自动进入；canEternity 为假时 EC 进入不会结算，自动化照常推进。
      // Android 同源门禁：OrekiAutoEternityGate.challengeAutoStartAllowed()。
      // [R114-03] 统一走单一门禁 realEternityAllowed()（与 dilation/celestial 的 5 处同源）。
      if (!this.realEternityAllowed()) return false;
      return challenge.start(true) === true;
    } catch (e) {
      this._err("buyEcStudiesAndStart", e);
      return false;
    }
  },

  shouldHoldReset() {
    try {
      if (!this.active) return false;
      if (player.challenge.eternity.unlocked !== 0) return false;
      // [Oreki R37-A] 这里原先读死变量 `_ecTarget`（恒 1）→ 只保护 EC1。改读真实目标。
      const id = this.nextUnfinishedEcId();
      if (!id || id > 12) return false;
      const challenge = EternityChallenge(id);
      if (!challenge) return false;
      if (challenge.completions >= this.ecRequiredCompletions(id)) return false;
      const study = TimeStudy.eternityChallenge(id);
      if (!study) return false;
      if (study.isBought) return false;
      // 守卫一：必须先进入时间研究阶段（TT 已经能攒起来），否则开局会被永久卡住。
      // R22 实测教训：没有这个守卫时，EC1 的入口门槛在开局就不满足，
      // 于是全程不坍缩 → 无限次数为 0、TT 为 0，整局停摆。
      if (Currency.timeTheorems.max.lt(100)) return false;
      // 守卫二：只差「二级资源」时才值得暂停。
      // EC 研究的主前置是某条时间研究（config.requirement），
      // 若连这条研究都没买上，暂停坍缩也换不来进度，反而拖死开局。
      const primaryMet = (study.config.requirement || []).some(s => {
        try {
          return TimeStudy(s).isBought;
        } catch (e) {
          return false;
        }
      });
      if (!primaryMet) return false;
      return !study.isEntryGoalMet;
    } catch (e) {
      this._err("shouldHoldReset", e);
      return false;
    }
  },

  /**
   * G) 自动永恒（带 EC 入口保护）。
   *
   * 为什么需要：原版没有「自动永恒」，玩家必须手动点；而 10000× 下永恒收益变化极快，
   * 新手不可能一直盯着。更重要的是——**永恒会把 EC 的入口采样清空**：
   * `eternity()` 里有一行 `ECTimeStudyState.invalidateCachedRequirements();`（eternity.js:147），
   * 它会丢掉 `requirementCurrent` 缓存的「本次运行内观察到的最高资源值」。
   * EC3 的入口要求是 `AntimatterDimension(8).totalAmount >= 17300`
   * （ec-time-studies.js:35-36，且每完成一次 +1250），这个量必须**在一次永恒之内**爬到，
   * 一旦中途永恒就前功尽弃 —— 这正是实测「EC2 满级后永远进不去 EC3」的直接原因。
   *
   * 所以：当「下一个未完成的 EC」的**主研究已经买好、只差入口资源**时，
   * 暂停自动永恒（但**不暂停大坍缩**，坍缩不影响 totalAmount 的峰值记录，
   * 而且 EC1/EC2 需要的永恒次数增长不能被拖慢 —— R22 实测过全局暂停坍缩是反效果）。
   *
   * 其余情况按「EP 收益 ≥ 当前 EP 的 10 倍」才永恒，避免无意义的频繁重置。
   */
  nextUnfinishedEcId() {
    try {
      // [Oreki R38-A] IU15 冲刺期间**永远不重打 EC7**。
      // 事实：`TimeDimensions.tick()` 末尾
      //   EternityChallenge(7).reward.applyEffect(p => InfinityDimension(8).amount += p * diff/1000)
      // （time-dimension.js:331-335）只要 EC7 有完成次数就会持续生产 ID8，
      // 而 `InfinityDimensions.tick()` 又把 ID8→ID7→…→ID1 逐层生产
      // （infinity-dimension.js:373-375）。⇒ 只要 EC7 完成过，ID1 的 amount 必然 > 0，
      // `player.requirementChecks.reality.maxID1` 同帧变正，IU15 永久失败。
      // 现实重置会清空 EC 完成记录，所以「不重打 EC7」= ID1 全程恒 0。
      const skipEc7 = (() => {
        try { return globalThis.OrekiIu15Sprint?.skipEc7 === true; } catch (e) { return false; }
      })();
      for (const id of this.ecPriorityOrder()) {
        if (id === 7 && skipEc7) continue;
        const challenge = EternityChallenge(id);
        if (challenge && challenge.completions < this.ecRequiredCompletions(id)) return id;
      }
      return 0;
    } catch (e) {
      this._err("nextUnfinishedEcId", e);
      return 0;
    }
  },

  /**
   * [R125] Reality 后的 EC 优先级。
   *
   * 首次 Reality 前按 1→12 完整走一遍，保留永恒挑战体系的实际展开。
   * Reality 后，重新满足 `TimeStudy.reality` 的原版硬条件只需要 EC11 与 EC12
   * 各完成 5 次（dilation-time-studies.js）；研究 181/191/193 要求 EC1～3 与
   * EC10 有真实完成记录，而 Reality 会清空这些记录。EC4～7 的奖励也以
   * completions > 0 生效。因此后续循环保持 1→12 顺序，但 EC1～7 只需补到 1 次；
   * EC8～12 与膨胀模块的 `DEEP_EC_IDS` 共用满 5/5 定义，避免 respec 抖动。
   *
   * 这里只决定自动化选择哪一关；挑战目标、入口资源、完成次数与结算仍由原版处理。
   */
  ecPriorityOrder() {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  },

  /**
   * 当前阶段实际需要完成的次数。Reality 后 EC1～7 的奖励或研究门槛只要求
   * completions > 0，补到 1 次即可；EC8～12 与膨胀模块 `DEEP_EC_IDS` 共用满 5/5。
   */
  ecRequiredCompletions(id) {
    const challenge = EternityChallenge(id);
    const max = challenge?.maxCompletions ?? 5;
    const realities = this._realitiesValue();
    if (realities !== null && realities > 0 && id >= 1 && id <= 7) {
      return Math.min(1, max);
    }
    return max;
  },

  /** 下一个 EC 是否「只差入口资源」（主研究已买、但二级门槛未满足） */
  ecEntryPending() {
    try {
      if (!this.active) return false;
      if (player.challenge.eternity.unlocked !== 0) return false;
      const id = this.nextUnfinishedEcId();
      if (!id) return false;
      // [R125] EC4 入口是 `Currency.infinitiesTotal`（本次无限次数 + 永久保留次数）。
      // `initializeResourcesAfterEternity()` 会调用 `Currency.infinities.reset()`，而首次
      // 到达 EC4 时时间研究 191 尚未解锁，不能靠 5% banked 自动累积。35× 真实新档中
      // 自动永恒把 EC4 入口反复清零，峰值仅 10064 / 1000000，并长期挡住 EC5、EC7~10。
      // 因此 EC4 与其它“只差入口资源”的 EC 一样暂停自动永恒；大坍缩仍继续执行，
      // 无限次数会由其真实产出累积，入口满足后仍由原版购买与挑战入口继续。
      //
      // [R104 P0] EC1 仍需例外：入口资源就是**永恒次数**
      // （ec-time-studies.js:9-12 secondary.resource="永恒次数"、current=Currency.eternities、
      //   required=20000 → MOD 的 OREKI_EC_REQUIREMENT_DIVISOR=100 下为 200）。
      // 压住永恒 ⇒ 永恒次数不涨 ⇒ 200 永远到不了 ⇒ ecEntryPending 永远 true ⇒ 永恒永远被压住。
      // 实测（pass3，t=1042→1712 s 共 670 秒零进度）：et=48、ecPend=true、canEt=true、EP 恒 6.79e5。
      if (id === 1) return false;
      const study = TimeStudy.eternityChallenge(id);
      if (!study || study.isBought) return false;
      const primaryMet = (study.config.requirement || []).some(s => {
        try {
          return TimeStudy(s).isBought;
        } catch (e) {
          return false;
        }
      });
      if (!primaryMet) return false;
      // EC4 入口达标不等于研究已买下。EC 循环按 2 秒节流，而原版自动永恒每帧
      // 都可能清空 infinities 与入口峰值缓存；必须保持到研究真正买下/挑战启动，
      // 否则会反复出现“刚达标又被永恒清零”。
      if (id === 4) return true;
      return !study.isEntryGoalMet;
    } catch (e) {
      this._err("ecEntryPending", e);
      return false;
    }
  },

  /**
   * [R118-01 #69] EC 入口等待期间临时抬高原版自动永恒的 X_HIGHEST 阈值。
   *
   * 原版 EternityAutobuyer 每帧在 Oreki tick 之前执行，不经过 `tickEternity` 的
   * `ecEntryPending()` 门禁；保持 X_HIGHEST ×10 时会持续永恒并重置维度，导致
   * EC3 等入口资源（AD8 totalAmount）永远攒不满（实测 et=21560→23127、AD8=0、
   * EC3 current=0/173、maxEP 停滞）。
   *
   * 这里只改 X_HIGHEST 阈值，不关开关、不动 userClosed，避免触发玩家关闭语义；
   * 入口达成后恢复原配置。配置读取/写入失败不阻断 tick。
   */
  _manageEternityHoldForEcEntry() {
    try {
      const pending = this.ecEntryPending();
      const cfg = player?.auto?.eternity;
      if (!cfg) return;
      if (pending && this._ecEntryEternityHoldActive !== true) {
        this._ecEntryEternityHoldSaved = {
          mode: cfg.mode,
          amount: cfg.amount,
          xHighest: cfg.xHighest,
          time: cfg.time,
          increaseWithMult: cfg.increaseWithMult,
        };
        cfg.mode = globalThis.AUTO_ETERNITY_MODE?.X_HIGHEST ?? 2;
        // 用足够大的阈值覆盖高倍率存档（xHighest 是 Decimal，可安全承载大指数）。
        cfg.xHighest = new Decimal("1e1000000");
        this._ecEntryEternityHoldActive = true;
      } else if (!pending && this._ecEntryEternityHoldActive === true) {
        const saved = this._ecEntryEternityHoldSaved;
        if (saved) {
          cfg.mode = saved.mode;
          cfg.amount = saved.amount;
          cfg.xHighest = saved.xHighest;
          cfg.time = saved.time;
          cfg.increaseWithMult = saved.increaseWithMult;
        }
        this._ecEntryEternityHoldActive = false;
        this._ecEntryEternityHoldSaved = null;
      }
    } catch (e) {
      // 配置读写失败不阻断 tick
    }
  },

  /**
   * [R97 P0 对齐 Android] 同帧大坍缩观测：用 `Currency.infinities` 的整数令牌变化
   * 识别「刚刚发生过一次大坍缩」，并只跳过该帧一次。Android 侧对应
   * `detectResetGenerations()` + `crunchSkipFrames`；Web 长期缺失此保护，
   * 会出现「大坍缩后同帧立刻永恒」。
   */
  _justCrunchedFrame() {
    try {
      const now = Currency.infinities.value.toNumber();
      if (!Number.isFinite(now)) return false;
      const prev = this._lastInfinitiesToken;
      this._lastInfinitiesToken = now;
      if (prev === undefined || prev === null) return false;
      // [R104 P0] 连续坍缩下逐帧武装会**永久**挡死永恒：R104-02 真实新档实测
      // canEternity=true 持续 400+ 秒、tickEternity 每拍都在这里返回 false
      // （反物质自动坍缩器在高倍率下几乎每帧都触发大坍缩）。
      // 只容忍连续 2 帧；超过就放行——此时「同帧无坍缩」在物理上不可满足，
      // 继续挡只会让新档永远不结算。正常偶发坍缩仍按原语义跳 1 帧。
      const crunched = now > prev;
      this._crunchSkipStreak = crunched ? (this._crunchSkipStreak ?? 0) + 1 : 0;
      if (this._crunchSkipStreak > 2) {
        this._crunchSkipStreak = 0;
        this._crunchSkipFrames = 0;
        return false;
      }
      if (crunched) this._crunchSkipFrames = 1;
      if (this._crunchSkipFrames > 0) { this._crunchSkipFrames -= 1; return true; }
      return false;
    } catch (e) {
      return false;
    }
  },

  // ------------------------------------------------------------ [R104 P0] 新档引导
  //
  // 缺陷（R104-02 真实新档实测，2026-11-12）：全新存档的 auto.eternity.isActive 默认 false，
  // 而原版「自动永恒」自动器要到 100 次永恒才解锁
  // （src/core/secret-formula/eternity/eternity-milestones.js:141 autobuyerEternity），
  // 解锁前界面上没有这个开关。R101 门禁把 isActive=false 一律当成玩家主动关闭
  // ⇒ 新档在 canEternity 为真后永远不结算（实测 t≈312s canEt=true 但 EP=0、eternities=0、
  // 执行器 stalledSec=241）。
  //
  // 修法（与 Android OrekiAutoEternityGate 同一语义）：
  //   · 本会话从「从未永恒过」的全新档启动 → 引导窗口；
  //   · 引导窗口内、开关关闭也允许 MOD 驱动永恒：还没永恒过，或原版自动器仍未解锁；
  //   · 自动器解锁后由本模块一次性把原版开关置 true（真实存档字段），此后只认开关；
  //   · 载入已有进度存档（eternities>0）时引导窗口关闭，R101 P0 语义不变。
  _eternitiesLt(n) {
    try {
      const v = player.eternities;
      if (v === undefined || v === null) return false;
      if (typeof v.lt === "function") return v.lt(n) === true;
      if (typeof v.toNumber === "function") return v.toNumber() < n;
      if (typeof v === "number") return v < n;
    } catch (e) { /* ignore */ }
    return false;
  },

  _sampleFreshSession() {
    if (this._freshSessionBootstrap === undefined) {
      this._freshSessionBootstrap = this._eternitiesLt(1);
    }
    return this._freshSessionBootstrap === true;
  },

  _eternityAutobuyerUnlocked() {
    try {
      const milestone = globalThis.EternityMilestone?.autobuyerEternity;
      if (milestone && typeof milestone.isReached === "boolean") return milestone.isReached;
    } catch (e) { /* ignore */ }
    // 读不到里程碑时按原版配置值保守判断（100 次永恒解锁自动永恒）。
    return !this._eternitiesLt(100);
  },

  // ------------------------------------------------------- [R114-01] 开关归属判定
  //
  // 与 Android 定稿 OrekiAutoEternityAdoption.kt 同语义的 Web 最小实现：
  //   1. 原版 Reality 复位把 auto.eternity.isActive 置 false 是**原版设计**
  //      （autobuyers/eternity-autobuyer.js:105-109：未达 autobuyerEternity 里程碑即关）；
  //   2. 每帧观察开关真实值：为 true → 记 adopted=true、清 userClosed（玩家手动开 ⇒ 重新接管）；
  //   3. 观察到 true→false 时区分归属：
  //        · realities 增加 / thisReality 计时回退（reality.js:666-668 复位）⇒ 原版复位，
  //          不是玩家的关闭决定，随后由本模块补回 true；
  //        · 同现实内被关（两个信号都可用且都没回退）⇒ 判玩家手动关闭，userClosed 粘滞，
  //          本会话不再强行打开；
  //   4. 门禁：未解锁（界面上没有这个开关）时允许「已接管 / 本会话全新档」驱动；
  //      已解锁只认原版开关真实值 —— 绝不每帧无条件把开关置 true；
  //   5. 关闭 MOD 总开关或原版总开关 autobuyersOn=false ⇒ 不写、不驱动；
  //   6. [R114-02] 托管状态绑定**存档身份**（player.records.gameCreatedTime）：
  //      导入/切换存档后上一个存档的归属状态一律失效（对齐 Android
  //      OrekiAutoEternityAdoption.bindSave()），绝不把新存档里玩家关闭的开关写成 true。
  //
  // 为什么 Web 不需要额外持久化（用户裁决：不改存档格式、不写 player.json 字段）：
  //   adopted 的判定源就是**存档里已落盘的 isActive 真实值** —— 读档时开关为 true 即视为
  //   「MOD 已接管」，reality 复位后补回 true 正是玩家上一次的真实意愿；读档时为 false
  //   则 adopted=false ⇒ 依旧严格尊重玩家关闭（R101 P0 不回退）。userClosed / enabledAt
  //   只是会话内的归属推断，不需要跨会话存活；跨存档隔离靠第 6 条的存档身份绑定完成。
  _realitiesValue() {
    try {
      const v = player?.realities;
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (v && typeof v.toNumber === "function") {
        const n = v.toNumber();
        return Number.isFinite(n) ? n : null;
      }
    } catch (e) { /* ignore */ }
    return null;
  },

  _thisRealityRealTime() {
    try {
      const v = player?.records?.thisReality?.realTime;
      if (typeof v === "number" && Number.isFinite(v)) return v;
    } catch (e) { /* ignore */ }
    return null;
  },

  /** 当前永恒段真实时间；用于识别永恒结算把自动永恒开关复位，而非玩家手动关闭。 */
  _thisEternityRealTime() {
    try {
      const v = player?.records?.thisEternity?.realTime;
      if (typeof v === "number" && Number.isFinite(v)) return v;
    } catch (e) { /* ignore */ }
    return null;
  },

  /** 永恒进度稳定令牌；真实永恒结算必须让其变化。 */
  _eternitiesToken() {
    try {
      const v = player?.eternities;
      return v === undefined || v === null ? null : String(v);
    } catch (e) { /* ignore */ }
    return null;
  },

  /**
   * 永恒次数是否单调增加。
   *
   * 进入/完成 EC 可能让 `thisEternity.realTime` 从 0 重置到 0，时间回退判据
   * 无法识别这次原版永恒结算；此时永恒次数增加是可靠证据。永恒次数不在
   * 永恒层消费，只有 Reality 会清零，因此“增加”可以明确排除玩家手动关闭。
   */
  _eternitiesIncreased(beforeToken, afterToken) {
    if (beforeToken === null || beforeToken === undefined ||
        afterToken === null || afterToken === undefined) return false;
    try {
      return new Decimal(afterToken).gt(new Decimal(beforeToken));
    } catch (e) {
      return false;
    }
  },

  /** 存档身份：Web 真实字段 records.gameCreatedTime（player.js:275 / storage.js:434）。 */
  _saveIdentity() {
    try {
      const v = player?.records?.gameCreatedTime;
      if (typeof v === "number" && Number.isFinite(v)) return v;
    } catch (e) { /* ignore */ }
    return null;
  },

  // [R114-02] 对齐 Android OrekiAutoEternityAdoption.bindSave()：托管状态必须绑定存档身份。
  // 导入/切换存档后，上一个存档的 adopted / userClosed / enabledAt 基线 / 新档会话采样
  // 一律失效，重新按新存档的真实开关观察。否则实测会串味：A 档 adopted 后导入 B 档，
  // B 档里玩家关闭的 isActive 被写成 true；A 档的「全新档」窗口也会串到已有进度档。
  // 读不到身份（存档尚未就绪）⇒ fail-closed：不改任何状态，等下次调用再判定。
  _bindSaveIdentity() {
    const id = this._saveIdentity();
    if (id === null) return;
    const previous = this._eternityAutoSaveId;
    if (previous === id) return;
    this._eternityAutoSaveId = id;
    // 首次记录身份（本会话还没有上一个存档）：内存态本来就属于当前存档，不清空。
    // 只有「已知上一个存档 → 身份变化」才是导入/切换存档，此时才让旧状态失效。
    if (previous === undefined || previous === null) return;
    this._eternityAutobuyerAdopted = undefined;
    this._eternityAutoUserClosed = false;
    this._eternityAutoEnabledAtRealities = null;
    this._eternityAutoEnabledAtRealTime = null;
    this._eternityAutoEnabledAtEternityRealTime = null;
    this._eternityAutoEnabledAtEternities = null;
    this._eternityAutoLastSeenActive = undefined;
    // [R116-01] 首次永恒驻留的「曾永恒」latch 同样按存档身份失效。
    this._firstEternityEverSeen = false;
    // 新档会话判定与 R107 的一次性结算模式配置同样按存档身份重来，不得串档。
    delete this._freshSessionBootstrap;
    this._eternityAutobuyerConfigured = false;
  },

  /**
   * 玩家通过 UI / 热键切换自动永恒时立即记录意图。
   *
   * 仅靠下一次帧观察无法区分「永恒重置把开关关掉」和「玩家在两次观察之间手动关掉」；
   * 因此真实输入路径必须在写入 isActive 的同一事件中通知本模块。
   */
  notePlayerEternityAutobuyerToggle(active) {
    this._bindSaveIdentity();
    if (active === true) {
      this._eternityAutobuyerAdopted = true;
      this._eternityAutoUserClosed = false;
      this._eternityAutoEnabledAtRealities = this._realitiesValue();
      this._eternityAutoEnabledAtRealTime = this._thisRealityRealTime();
      this._eternityAutoEnabledAtEternityRealTime = this._thisEternityRealTime();
      this._eternityAutoEnabledAtEternities = this._eternitiesToken();
      this._eternityAutoLastSeenActive = true;
    } else {
      this._eternityAutoUserClosed = true;
      this._eternityAutoLastSeenActive = false;
    }
  },

  _observeEternityAutobuyerSwitch() {
    try {
      // 先做存档身份绑定（换档即清空上一个存档的归属状态）。
      this._bindSaveIdentity();
      if (typeof player === "undefined" || !player || !player.auto || !player.auto.eternity) return;
      const active = player.auto.eternity.isActive === true;
      const realities = this._realitiesValue();
      const realTime = this._thisRealityRealTime();
      const eternityRealTime = this._thisEternityRealTime();
      const eternities = this._eternitiesToken();
      if (active) {
        // 玩家（或上一会话）真实开着 ⇒ 本会话视为已接管，恢复链路成立。
        this._eternityAutobuyerAdopted = true;
        this._eternityAutoUserClosed = false;
        this._eternityAutoEnabledAtRealities = realities;
        this._eternityAutoEnabledAtRealTime = realTime;
        this._eternityAutoEnabledAtEternityRealTime = eternityRealTime;
        this._eternityAutoEnabledAtEternities = eternities;
        this._eternityAutoLastSeenActive = true;
        return;
      }
      if (this._eternityAutoLastSeenActive === true) {
        // 真实 UI/热键关闭会先调用 notePlayerEternityAutobuyerToggle(false)。
        // 该显式意图优先于同一帧发生的永恒结算信号，不能被 observer 清除。
        if (this._eternityAutoUserClosed === true) {
          this._eternityAutoLastSeenActive = false;
          return;
        }
        // [R118-01 #69 hotfix] 自动器未解锁时界面不渲染该开关（AutobuyerBox.js），
        // 玩家无法在此状态手动关闭；true→false 只可能是原版
        // ETERNITY_RESET_AFTER → Autobuyers.reset()（未解锁置 false）。
        // 若不排除，PR #70 的持久化写入会被误判为玩家关闭并置 userClosed，
        // 使新档首永恒后 bootstrap 永久关闭（实测 et=5 恒停、maxEP=39、EC 不推进）。
        if (!this._eternityAutobuyerUnlocked()) {
          this._eternityAutoUserClosed = false;
        } else {
          const realitiesReset = this._eternityAutoEnabledAtRealities !== null &&
            realities !== null && realities > this._eternityAutoEnabledAtRealities;
          const realTimeReset = this._eternityAutoEnabledAtRealTime !== null &&
            realTime !== null && realTime < this._eternityAutoEnabledAtRealTime;
          const eternityRealTimeReset =
            this._eternityAutoEnabledAtEternityRealTime !== null &&
            eternityRealTime !== null &&
            eternityRealTime < this._eternityAutoEnabledAtEternityRealTime;
          const eternitiesChanged =
            this._eternityAutoEnabledAtEternities !== null &&
            eternities !== null &&
            eternities !== this._eternityAutoEnabledAtEternities;
          // EC 连续结算常出现 realTime 从 0 回到 0；只比较“回退”会漏掉
          // 第 100 次永恒解锁自动永恒后的原始 reset，随后把程序性 false
          // 误判为玩家关闭。永恒次数增加只可能来自真实 eternity()，
          // 因而与 Reality 清零、玩家手动关闭都可以区分。
          const eternitiesIncreased = this._eternitiesIncreased(
            this._eternityAutoEnabledAtEternities,
            eternities,
          );
          // 本永恒真实时间回退是结算的直接证据。仅在时间不可读时才退回永恒计数变化，
          // 永恒次数增加同样是结算证据；显式玩家关闭已在上面提前返回。
          const eternityReset = eternityRealTimeReset || eternitiesIncreased ||
            (eternityRealTime === null && eternitiesChanged);
          if (realitiesReset || realTimeReset || eternityReset) {
            // 原版 Reality/永恒结算复位：不判玩家关闭，交给接管逻辑补回 true。
            this._eternityAutoUserClosed = false;
          } else if (realities !== null && realTime !== null) {
            // 同现实内被关：判玩家手动关闭（粘滞，尊重）。
            this._eternityAutoUserClosed = true;
          }
        }
      }
      this._eternityAutoLastSeenActive = false;
    } catch (e) { /* 观察失败不改变既有行为 */ }
  },

  _eternityBootstrapActive() {
    // 门禁可先于 tickEternity 被 EC 入口调用：这里也要绑定存档身份，
    // 否则换档后的第一次门禁仍会读到上一个存档的 adopted / 新档采样。
    this._bindSaveIdentity();
    // 「本会话是否全新档」必须无条件 latch（即使本次不解锁也采样），
    // 与 R104 引入该窗口时一致：首次调用时的 eternities 决定整会话结论。
    const freshSession = this._sampleFreshSession();
    // 本会话玩家手动关闭过 ⇒ 一律不放行（与 Android userClosed 同语义）。
    if (this._eternityAutoUserClosed === true) return false;
    const unlocked = this._eternityAutobuyerUnlocked();
    // 未解锁：界面上没有这个开关（components/tabs/autobuyers/AutobuyerBox.js:138
    // 未解锁不渲染）⇒ 不存在玩家的关闭决定。已接管过 / 本会话全新档都允许驱动：
    //   · adopted 条款对齐 Android OrekiAutoEternityGate.bootstrapActive()；
    //   · 全新档窗口是 R104 P0 的既有修复。
    if (!unlocked) {
      return this._eternityAutobuyerAdopted === true || freshSession === true ||
        this._lockedLayerDriveAllowed();
    }
    // 已解锁：只认原版开关真实值（Android 定稿语义），这里绝不绕过。
    return false;
  },

  /**
   * [R118-01 #69] 自动器未解锁时的载入驱动例外。
   *
   * 与 Android PR #183 `lockedLayerDriveAllowed` 同口径：界面在 eternities<100 时
   * 不渲染该开关（AutobuyerBox.js），玩家无法在此状态表达关闭意图；若存档已永恒过
   * （et≥1）、MOD 与原版自动购买器总开关均开启、且本会话未观察到玩家手动关闭，
   * 则允许 MOD 驱动永恒/EC 入口，修复「修复前导出的存档」读档后 EC 链死锁。
   *
   * 本例外**不写** player.auto.eternity，保留存档原值；已解锁（et≥100）仍只认
   * 开关真实值。修复后新存档由 `_adoptEternityAutobuyerIfNeeded()` 持久化开关，
   * 两条路径互不替代。
   */
  _lockedLayerDriveAllowed() {
    try {
      // 名称即契约：只服务于界面未渲染开关的锁定层。已解锁时任何调用都不得
      // 绕过玩家真实开关，即使当前调用方已先判断 unlocked，也在这里纵深防御。
      if (this._eternityAutobuyerUnlocked()) return false;
      if (player.auto.autobuyersOn === false) return false;
      if (this._eternityAutoUserClosed === true) return false;
      // 用 _everEternitied() 而不是裸 et≥1：玩家把永恒次数花在永恒升级后 et 可能变 0，
      // 但 realities>0 / 会话 latch 仍能证明本存档已永恒过（与 Android #183 同口径）。
      return this._everEternitied() === true;
    } catch (e) {
      return false;
    }
  },

  // ------------------------------------------------- [R116-01 P0] 首次永恒驻留窗口
  //
  // 玩家可见缺陷（Android R115-01 真 APK + 独占 AVD 实测，报告 reports/R115-01/）：
  //   打破无限后约 25 秒，一次坍缩把 IP 推过 1.797e308，canEternity 首次为真；
  //   同一秒内 R104 新档引导窗口就发起**真实永恒结算**，玩家没有经历无限层。
  //   Web 冻结上游是同一份 R104 引导窗口（_eternityBootstrapActive()），缺陷同源
  //   （R115-01 报告 §16 已用读码确认 Web `grep dwell` = 0，本轮补齐）。
  //
  // 语义（只约束「自动化替玩家按首次永恒」，不改变任何游戏机制；逐条对齐 Android
  // OrekiAutoEternityGate.firstEternityDwellRemainingMs()）：
  //   · 只作用于**首次永恒**（本存档尚未永恒过）且玩家**没有亲自开启**原版自动永恒开关的引导/托管窗口；
  //   · 玩家手动点永恒走原版 UI（eternity.js 的 eternityResetRequest() → eternity()），
  //     不经过本模块，随时可用（手动优先）；
  //   · 玩家一旦打开「自动永恒」开关，立即按原语义执行，不再驻留；
  //   · 已永恒过的存档完全不受影响（自动化长跑节奏不变）；
  //   · 资格消失（例如玩家花掉 IP）即重置计时；换存档（records.gameCreatedTime 变化）
  //     与冷启动（本模块内存态归零）都会重新计时，不跨档继承旧计时；
  //   · 计时用单调时钟（performance.now），与 Android SystemClock.elapsedRealtime 同语义：
  //     系统墙钟跳变既不会缩短驻留，也不会把驻留拖成永久；
  //   · 驻留结束仍由原版 canEternity + 自动永恒**真实结算**，不伪造任何资源/次数。
  //
  // 平台字段差异：Android 首次判据读 eternities 与 bigEternities；Web 冻结上游
  // **没有** bigEternities 字段（全仓 0 处），因此 Web 的等价判据是 eternities < 1。
  /** 单调时钟（毫秒）：优先 performance.now（不受系统墙钟跳变影响），缺失时退回 Date.now。 */
  _monotonicNowMs() {
    try {
      const perf = globalThis.performance;
      if (perf && typeof perf.now === "function") return perf.now();
    } catch (e) { /* 回退到墙钟 */ }
    return Date.now();
  },

  /**
   * 本存档是否曾经永恒过。
   *
   * Android 有持久字段 `bigEternities`；Web 冻结上游**没有**该字段，reality 重置还会把
   * `eternities` 清零（reality.js:643 `Currency.eternities.reset()`）。因此 Web 的等价判据是：
   *   · `eternities > 0` ⇒ 已永恒过；
   *   · `realities > 0` ⇒ 本存档必然推进过永恒层（Reality 需要 EC/时间研究链），已永恒过；
   *   · 本会话一旦观察到上述任一信号就 latch，即使之后 eternities 被永恒升级花到 0 也不回退；
   *   · 换存档（gameCreatedTime 变化）清 latch，不把上一个存档的结论带进新档。
   * 读不到 eternities 时按「非首次」处理（与 Android neverEternitied() 的 fail-open 一致）。
   */
  _everEternitied() {
    if (this._firstEternityEverSeen === true) return true;
    try {
      if (this._eternitiesLt(1) !== true) {
        this._firstEternityEverSeen = true;
        return true;
      }
      const realities = this._realitiesValue();
      if (realities !== null && realities > 0) {
        this._firstEternityEverSeen = true;
        return true;
      }
      // eternities 是会被永恒升级消耗的货币；不能把「当前余额 0」当成新档。
      // Reality 之前 bestEternity / recentEternities 会保留首次永恒后的真实历史，
      // 用它们恢复「曾经永恒过」，避免读档或消费完余额后重复 180 s 首次驻留。
      const bestEternity = player.records?.bestEternity;
      const bestRecorded = [bestEternity?.time, bestEternity?.realTime]
        .some(value => Number.isFinite(value) && value < Number.MAX_VALUE);
      const recentRecorded = Array.isArray(player.records?.recentEternities) &&
        player.records.recentEternities.some(run =>
          Array.isArray(run) && Number.isFinite(run[0]) && run[0] < Number.MAX_VALUE
        );
      if (bestRecorded || recentRecorded) {
        this._firstEternityEverSeen = true;
        return true;
      }
    } catch (e) { /* 读不到按未永恒处理 */ }
    return false;
  },

  /** 是否从未永恒过（首次永恒驻留的唯一前提）。 */
  _neverEternitied() {
    return !this._everEternitied();
  },

  /**
   * 首次永恒自动结算前的剩余驻留时间（毫秒）；0 = 不驻留、可立即自动结算。
   *
   * 计时从「本存档里本模块首次观测到 canEternity 为真」开始；资格消失即重置，
   * 换存档（gameCreatedTime 变化）也重置，避免跨档继承旧计时。
   */
  firstEternityDwellRemainingMs() {
    try {
      // 先按存档身份失效上一个存档的「曾永恒」latch（与 _eternityBootstrapActive 同口径）。
      this._bindSaveIdentity();
      // [PR #49 review fix] 换存档即重置计时，且必须放在所有 early return **之前**：
      // A(新档驻留中) → B(已永恒 / 玩家开自动) → A 时，B 会命中下面两个 early return；
      // 若把 saveId 比较留在其后，B 不更新 _firstEternityDwellSaveId / 计时起点，
      // 回到 A 会复用 A 的旧计时并把在 B 停留的时间算进去（驻留被截断甚至直接归零，
      // 首次永恒被自动化立即结算）。与 Android dwellSaveId 同语义：每次调用先绑定当前存档。
      const saveId = this._saveIdentity();
      if (saveId !== this._firstEternityDwellSaveId) {
        this._firstEternityDwellSaveId = saveId;
        this._firstEternityDwellStartedAt = null;
        // 换存档：不继承上一个存档的「曾永恒」结论（导入无进度新档仍需引导窗口）。
        this._firstEternityEverSeen = false;
      }
      // 只有已解锁后的真实开关才代表玩家可以表达的意图。自动器未解锁时，R118 的
      // 跨读档所有权修复会把 isActive 持久化为 true；不能把这层 MOD 内部状态误当成
      // 玩家亲自打开开关，否则会绕过首次永恒 180 s 驻留（R120-01 真实新档实测）。
      if (this._eternityAutobuyerUnlocked() && player.auto.eternity.isActive === true) return 0;
      // 非首次永恒：既有自动化节奏完全不受影响。
      if (!this._neverEternitied()) return 0;
      // 资格消失：重置计时，下次重新具备资格时重新计满 180 s。
      if (!Player.canEternity) {
        this._firstEternityDwellStartedAt = null;
        return 0;
      }
      const now = this._monotonicNowMs();
      if (this._firstEternityDwellStartedAt === null
        || this._firstEternityDwellStartedAt === undefined) {
        this._firstEternityDwellStartedAt = now;
        return FIRST_ETERNITY_DWELL_MS;
      }
      const elapsed = now - this._firstEternityDwellStartedAt;
      if (elapsed >= FIRST_ETERNITY_DWELL_MS) return 0;
      // 时钟回退（理论不可发生）时按满窗口处理，绝不把驻留变成负数或永久。
      return elapsed < 0 ? FIRST_ETERNITY_DWELL_MS : FIRST_ETERNITY_DWELL_MS - elapsed;
    } catch (e) {
      // fail-open：驻留只是节奏保护，绝不能像 R104 那样把首次永恒永久卡死。
      this._err("firstEternityDwellRemainingMs", e);
      return 0;
    }
  },

  /**
   * [R114-03] **单一门禁**：MOD 是否允许发起一次「真实永恒（含真实结算）」。
   *
   * 为什么需要：本模块之外的 4 条 MOD 链路也会触发真实永恒或等价结算，
   * 历史上各自只判 autobuyersOn / Pelle，**完全不看** autoEternity 单项开关
   * ⇒ 玩家手动关掉自动永恒后仍可能被真实结算（与 Android PR #97 同类缺陷）：
   *   · 自动进入 EC：原版 eternity-challenge.js:209 在 Player.canEternity 真时先 eternity() 结算；
   *   · 进入膨胀 startDilatedEternity()：原版 dilation.js:43-52 内部调 eternity()；
   *   · 膨胀中永恒播种 TP（eternity(false, true)）；
   *   · 退出膨胀 switchingDilation（eternity(false, false, { switchingDilation: true })）。
   *
   * 语义（逐条对齐 Android OrekiAutoEternityGate.challengeAutoStartAllowed()）：
   *   1. autoEternity 单项开关真实开着 ⇒ 允许；
   *   2. [R116-01] 首次永恒驻留窗口内 ⇒ 阻止（含「自动进 EC 顺带真实永恒」的旁路）；
   *   3. 否则处于 R104 新档引导 / R114 已接管（adopted）窗口 ⇒ 允许（未解锁时玩家无法表达意愿）；
   *   4. 否则 Player.canEternity 为假 ⇒ 允许：此时原版 eternity() 会直接 return false，
   *      或仅做一次**无奖励**的膨胀切换重置（eternity.js:74-78 里 switchingDilation 在
   *      !canEternity 时被置 force=true，不进 giveEternityRewards）——那是原版
   *      「进入/退出膨胀」的固有行为，不是结算；
   *   4. 其余（玩家关掉开关且此刻会真实结算）⇒ 阻止。
   *
   * 读不到开关/资格 ⇒ fail-closed（宁可少自动一次，也不误结算）。
   *
   * @returns {boolean} true = 允许发起真实永恒/结算
   */
  realEternityAllowed() {
    try {
      // 未解锁时 isActive 可能只是 MOD 持久化的内部所有权状态，不能绕过首次驻留。
      if (this._eternityAutobuyerUnlocked() && player.auto.eternity.isActive === true) return true;
      // [R116-01 P0] 首次永恒驻留期间不放行任何 MOD 发起的真实结算。
      // 与 Android challengeAutoStartAllowed() 的 dwell 首条判据同语义；dwell 为 0 时
      // （非首次永恒 / 玩家已开自动永恒 / 资格未成立）本行不改变既有行为。
      if (this.firstEternityDwellRemainingMs() > 0) return false;
      if (this._eternityBootstrapActive()) return true;
      // 只有**明确** read 到 canEternity=false 才放行（此时原版 eternity() 不会发奖励）；
      // 读不到 / 非布尔 ⇒ fail-closed（宁可少自动一次，也不误结算）。
      const canEternity = Player.canEternity;
      return canEternity === false;
    } catch (e) {
      return false;
    }
  },
  _adoptEternityAutobuyerIfNeeded() {
    try {
      // [R114-01] 归属判定必须**先**观察真实值（adopted / userClosed / 本现实已启用）。
      // 与 Android OrekiAutoEternityAdoption.kt 同语义：只在「原版复位/重启/读档」时补回，
      // 玩家主动关闭（同现实内被关）粘滞尊重，绝不每帧无条件置 true。
      this._observeEternityAutobuyerSwitch();
      // 关闭 MOD 总开关或原版总开关 ⇒ 不写、不驱动（玩家意愿优先）。
      if (player.auto.autobuyersOn === false) return;
      if (player.auto.eternity.isActive === true) return;
      // 本会话玩家手动关闭过 ⇒ 尊重，绝不重开（直到玩家自己再打开）。
      if (this._eternityAutoUserClosed === true) return;
      // [R118-01 #69] 未解锁：界面上没有这个开关，不存在玩家的关闭决定。
      //
      // 若本会话由 MOD 引导（全新档或已接管），这里必须把开关真实值持久化为 true：
      // 否则刷新/导入后 `_eternityBootstrapActive()` 只剩内存 latch（新会话 et≥1 时
      // `_sampleFreshSession()` 为 false），`tickEternity()` 与 EC 入口的
      // `realEternityAllowed()` 都会永久拒绝，EC1 需要的永恒次数无法增长，首现实死锁。
      // 解锁后 `_observeEternityAutobuyerSwitch()` 会按存档真实值接管；玩家解锁后
      // 手动关闭仍会被识别为 userClosed 并粘滞尊重。
      if (!this._eternityAutobuyerUnlocked()) {
        // 只有「全新档 / 已接管」才持久化开关；修复前导出的 et≥1 存档走
        // _lockedLayerDriveAllowed() 的载入例外，只驱动、不写存档原值。
        const freshOrAdopted =
          this._eternityAutobuyerAdopted === true || this._sampleFreshSession() === true;
        if (freshOrAdopted) {
          // 同时把解锁后要用的结算门槛配置好，避免解锁瞬间按原版 AMOUNT=1 每帧永恒。
          this._configureEternityAutobuyerOnce();
          player.auto.eternity.isActive = true;
          this._eternityAutobuyerAdopted = true;
          this._eternityAutoUserClosed = false;
          this._eternityAutoLastSeenActive = true;
          this._eternityAutoEnabledAtRealities = this._realitiesValue();
          this._eternityAutoEnabledAtRealTime = this._thisRealityRealTime();
          this._eternityAutoEnabledAtEternityRealTime = this._thisEternityRealTime();
          this._eternityAutoEnabledAtEternities = this._eternitiesToken();
        }
        return;
      }
      // 未接管过且本会话不是全新档 ⇒ 不动（R101 P0：载入已有进度时严格按玩家开关）。
      // 接管来源（R114-01）：本会话观察到开关真实值为 true（该值由存档持久化）。
      if (this._eternityAutobuyerAdopted !== true && this._sampleFreshSession() !== true) return;
      this._configureEternityAutobuyerOnce();
      player.auto.eternity.isActive = true;
      this._eternityAutobuyerAdopted = true;
      // 写入后同步观察基线：下一次 true→false 才不会被误判成「原版复位」。
      this._eternityAutoUserClosed = false;
      this._eternityAutoLastSeenActive = true;
      this._eternityAutoEnabledAtRealities = this._realitiesValue();
      this._eternityAutoEnabledAtRealTime = this._thisRealityRealTime();
      this._eternityAutoEnabledAtEternityRealTime = this._thisEternityRealTime();
      this._eternityAutoEnabledAtEternities = this._eternitiesToken();
    } catch (e) { /* ignore */ }
  },

  /**
   * [R107 P0] 接管原版「自动永恒」时，必须同时把结算门槛从默认
   * 「AMOUNT = 1（任何 canEternity 为真的时刻立刻结算）」改成「X_HIGHEST ×10」。
   *
   * 缺陷背景（R107-01 冻结现场逐帧实证，见 reports/R107-01/ep-wall-fix/）：
   * R104 为打通首次永恒接管该开关后，默认配置会在 Player.canEternity 为真的**每一帧**
   * 立刻永恒；永恒里程碑带来的被动 IP 增长又让 canEternity 很快恢复为真，形成
   * 「每帧永恒重置」循环：
   *   · thisEternity.maxIP 永远停在 SIP2 的起始值 5e130；
   *   · gainedEP 恒约 1e5.4（EP 除数 30），远小于已到 e3683 的当前 EP；
   *   · AM/维度/IP 每帧被重置回起始值，dimension 自动购买器 lastTick 恒为 0；
   *   · EP 冻结、realities 卡在 15，isRealityAvailable() 永假（A/B 主跑冻结 5890 s）。
   * R50（无接管，由 MOD 自己的 EP ≥ 10× 当前 EP 门槛驱动）不存在该问题。
   * 这里只在「新档会话首次接管 + 原版配置仍是自动值」时改一次，不覆盖玩家自定义配置。
   * 解锁前持久化 isActive（#69）时也要先调用本方法，避免解锁瞬间按 AMOUNT=1 每帧永恒。
   */
  _configureEternityAutobuyerOnce() {
    // EC 入口 hold 期间不要覆盖临时抬高的阈值；hold 结束后再由下一次 _adopt 配置。
    if (this._ecEntryEternityHoldActive === true) return;
    if (this._eternityAutobuyerConfigured === true) return;
    try {
      const autoCfg = player.auto.eternity;
      const amountIsDefault = typeof autoCfg.amount?.eq === "function"
        ? autoCfg.amount.eq(1)
        : Number(autoCfg.amount) === 1;
      const xHighestIsDefault = typeof autoCfg.xHighest?.eq === "function"
        ? autoCfg.xHighest.eq(1)
        : Number(autoCfg.xHighest) === 1;
      if (autoCfg.mode === 0 && amountIsDefault && xHighestIsDefault) {
        autoCfg.mode = globalThis.AUTO_ETERNITY_MODE?.X_HIGHEST ?? 2;
        autoCfg.xHighest = new Decimal(10);
      }
      this._eternityAutobuyerConfigured = true;
    } catch (e) { /* 配置失败不阻断原有接管流程 */ }
  },

  tickEternity() {
    try {
      // [R114-01] 先观察开关归属（即使本帧因 active=false 不驱动，也不要漏掉玩家的关闭/复位）。
      this._observeEternityAutobuyerSwitch();
      // [PR #49/#50 review fix] 采样 R104「本会话是否全新档」latch，且必须与模块是否
      // active 解耦（放在 !active early return 之前）：挑战进行中、玩家关闭 MOD 自动购买器
      // 总开关、Pelle 毁灭等都会让 active=false；若此时不采样，玩家在非活动期间手动永恒后
      // eternities>=1，latch 会被读成"非新档"，bootstrap 窗口永久关闭 ⇒ R101 门禁阻断
      // 之后所有 MOD 自动永恒。与 _observeEternityAutobuyerSwitch() 同级，按本会话首次
      // 观测到的存档 eternities 固化结论（换档时 _bindSaveIdentity 会清掉重新采样）。
      this._sampleFreshSession();
      if (!this.eternityResetActive) return false;
      // [R116-01 P0] 首次永恒驻留：玩家未亲自开启自动永恒时，MOD 不得在 canEternity
      // 出现的首个合法帧就替玩家结算首次永恒。驻留仍必须在
      // _adoptEternityAutobuyerIfNeeded() 之前，否则「同帧接管并打开开关」会把驻留旁路。
      if (this.firstEternityDwellRemainingMs() > 0) return false;
      this._adoptEternityAutobuyerIfNeeded();
      // [R101 P0 对齐 Android] 原版「自动永恒」单项开关关闭时，MOD 不得主动永恒。
      //
      // 缺陷背景：本函数直接调用原版「无确认永恒」入口，历史上只受 MOD 总开关
      // （this.active）约束，完全不看玩家存档里的 auto.eternity.isActive。
      // Android 同缺陷由 OrekiAutoEternityGate 收敛修复（单一 Kotlin 门禁）；
      // Web 这里补同一条判据。读不到开关时 fail-closed（宁可不自动，也不误结算）。
      // 玩家手动点击永恒按钮走原版 UI 入口（eternity.js），不经过本函数。
      try {
        if (player.auto.eternity.isActive !== true &&
            !this._eternityBootstrapActive()) return false;
      } catch (e) {
        return false;
      }
      // [Oreki R38-A] IU15 冲刺期间禁止永恒：永恒会把反物质指数打回 0，
      // 而 IU15 要求 `antimatter.exponent >= 1.5e12`，只能在同一个大坍缩周期内连续增长。
      try {
        if (globalThis.OrekiIu15Sprint?.freezeResets === true) return false;
      } catch (e) { /* 读取失败不改变既有行为 */ }
      // [R97 P0 对齐 Android] 真实 Break 前置：未打破无限不得进入永恒。
      // Android 侧同序门禁为 automation-off → doomed → not-broken → same-frame-crunch
      // → cannot-eternity → ep-gain-too-low；此处补上 Web 长期缺失的两条。
      // 依据：`oreki-smart-executor.js:470` 明确 `player.break === true` 对应
      // Android 的 `GameApi.isBroken()`（同源于原版真实存档字段）。此前误写
      // 不存在的 `PlayerProgress.breakInfinityUnlocked()` 会永久阻断永恒，已修正。
      if (player.break !== true) return false;
      // [R97 P0 对齐 Android] 同帧大坍缩保护：原版自动购买器在同一 tick 内于本函数
      // **之后**执行大坍缩，因此「刚观测到坍缩」的这一帧必须先跳过，下一帧再判定。
      if (this._justCrunchedFrame()) return false;
      if (!Player.canEternity) return false;
      // [Oreki R26] 现实升级 10「生存延续」的解锁条件是
      //   `Currency.infinityPoints.exponent >= 400 && player.requirementChecks.reality.noEternities`
      // （reality-upgrades.js:146-148），而 `noEternities` 在第一次永恒时就被置 false
      // （eternity.js:96），现实重置又会把它复位为 true。
      // 自动永恒默认在 `Player.canEternity`（IP = 1.797e308，指数 308）就立刻触发，
      // 永远差 92 个指数 → 这条现实升级在**每一次现实**里都拿不到
      // → 成就 147「购买所有的现实升级」永远不成立 → Teresa 永远不出现。
      // 这里只在「还没拿到 RU10」时，把本现实运行里的第一次永恒压到 IP 指数 ≥ 400。
      if (this.holdForRealityUpgrade10()) return false;
      // 入口保护：只在「主研究已买、只差资源」时生效，不拖慢 EC1/EC2 的永恒次数增长
      if (this.ecEntryPending()) return false;
      // EC 中完成次数只能由真实目标达成后触发的原版永恒结算产生。
      // 不用全局 EP×1 门槛压住挑战退出，否则达标后仍可能长期不结算；
      // `canBeCompleted` 同时覆盖原版目标与 EC4/EC12 的限制条件。
      if (EternityChallenge.isRunning) {
        const challenge = EternityChallenge.current;
        if (!challenge || !challenge.canBeCompleted) return false;
        return eternity(false, true) === true;
      }
      // [R96 第五轮] 永恒结算门槛 ×10 → ×1：收益只要让 EP 翻倍（gained ≥ 当前 EP）就结算。
      //
      // 实测缺陷（平台期 bigE=3、EP=2.16、maxIP 1e593、maxAM 1e124044）：×10 门槛要求
      // maxIP 达 1e804（gainedEP=23），而当时 gainedEP 只有 7 ⇒ **EP 永不增长**。
      // 而 EP 是中期唯一引擎燃料：时间维度用 EP 买（TD1=1 / TD2=5 / TD3=100）、
      // 永恒升级首档 5 EP ⇒ EP 卡住 ⇒ 时间维度只有 1 层、永恒升级 0 个 ⇒ 乘数停滞。
      // Android 同口径实机效果（同一存档 6 分钟）：bigE 3→7、EP 2.16→5.4、首个永恒升级买到。
      if (gainedEternityPoints().lt(Currency.eternityPoints.value.times(1))) return false;
      return eternity(false, true) === true;
    } catch (e) {
      this._err("tickEternity", e);
      return false;
    }
  },

  /**
   * 是否应该为了现实升级 10 压住第一次永恒。
   * 只读判断 + 会话内计时；**最多压 10 秒**，避免 IP 被自动买无限维度花掉时把这局卡死。
   *
   * [Oreki R42-C] **真缺陷修复，不是注释补充**。
   *
   * 原写法是 `player.eternities > 0`。`player.eternities` 是 Decimal
   * （`player.js:377` 初始 `DC.D0`；`Currency.eternities.value` 就是它），
   * 而 break_infinity 的 `Decimal#valueOf()` 会抛
   * `Implicit conversion from Decimal to number`。
   * 于是本函数**每一帧都在 throw**，被下面的 catch 吞掉、恒返回 false：
   * 「为现实升级 10 压住第一次永恒」这条机制从写下来那天起就没生效过。
   *
   * 后果链（`reality-upgrades.js:146-148`）：
   *   RU10 的 checkRequirement 是 `IP 指数 ≥ 400 && noEternities`，
   *   而 `noEternities` 在第一次永恒时被置 false（`eternity.js:96`）；
   *   自动永恒在 `Player.canEternity`（IP = 1.797e308，即指数 308）就触发，
   *   永远差 92 个指数 ⇒ RU10 每个现实都拿不到 ⇒ 成就 147「购买所有现实升级」
   *   永不成立 ⇒ 特蕾莎不出现。
   * ⇒ **这是一条被判据写错掐死的推进链**，与 FACTS C.19 记录的
   *   `Currency.*.value.gte()` 是同一类（Decimal 方法/运算符用错 + catch 吞异常）。
   *
   * 修法：改成 Currency 对象自己的 `gt()`（内部走 Decimal 比较），
   * 指数比较先显式取 Number —— 两种写法都不会触发隐式转换。
   * 语义不变：仍是「已经永恒过 / IP 指数已达标 / 已买 / 已可买」四条任一即放手。
   *
   * ── 同时把「10 秒上限」改成**单次**上限（`_ru10GaveUp` 闩锁）──────────────
   * 旧实现超时后只清 `_ru10HoldSince`，下一帧又会重新置位，于是「压 10 s → 放 1 帧
   * → 再压 10 s」可以无限循环。原版这条路因为 `player.eternities > 0` 恒抛异常而
   * 从未走到过，一旦修好比较就**有可能真的把永恒按住不放**（例如某个现实里 IP 指数
   * 一直够不到 400）。现在超时后置 `_ru10GaveUp = true`，直到 `stop` 条件整体
   * 翻转（本现实结束 / 已买到 / 已可买）才重新武装 ⇒ **每个现实最多压 10 秒，
   * 物理上不可能长期压死自动永恒**。
   */
  _ru10HoldSince: 0,
  _ru10GaveUp: false,

  holdForRealityUpgrade10() {
    try {
      const noEternitiesYet = player.requirementChecks.reality.noEternities;
      const upg = RealityUpgrade(10);
      const ipExp = Number(Currency.infinityPoints.value.exponent);
      const stop = !noEternitiesYet || !upg || upg.isAvailableForPurchase || upg.isBought ||
        Currency.eternities.gt(0) || ipExp >= 400;
      if (stop) {
        this._ru10HoldSince = 0;
        this._ru10GaveUp = false;
        return false;
      }
      if (this._ru10GaveUp) return false;
      if (!this._ru10HoldSince) this._ru10HoldSince = Date.now();
      if (Date.now() - this._ru10HoldSince > 10000) {
        this._ru10HoldSince = 0;
        this._ru10GaveUp = true;
        return false;
      }
      return true;
    } catch (e) {
      this._err("holdForRealityUpgrade10", e);
      return false;
    }
  },

  /**
   * H) 仅针对 EC3 的「窄保护」：暂停大坍缩，让第八反物质维度在一次坍缩周期内爬够 17300。
   *
   * 为什么只做 EC3、且只暂停坍缩：
   * - `AntimatterDimension(8).totalAmount`（antimatter-dimension.js:514）是
   *   `amount.max(continuumAmount)`，而每次大坍缩都会 `reset()` 把 amount 清零，
   *   所以这个值只能在**两次坍缩之间**积累。R23 实测：AD8 数量长期为 0、
   *   EC3 采样只到 10/17300 —— 因为自动坍缩按「10× 最高 IP」触发，周期太短。
   * - 但 R22 已实测：全局暂停坍缩会拖慢 EC1/EC2 需要的永恒次数增长（反效果）。
   *   所以这里把条件收窄到「下一关就是 EC3、主研究 171 已买、入口还没达标」。
   * - 不暂停永恒：EC3 的门槛是维度数量，不是跨永恒的累计量；而永恒会影响 AD8 重建速度，
   *   这里只关掉坍缩这一个变量，便于定位。
   *
   * 退出条件（任一满足即恢复坍缩）：
   *   1) EC3 入口达标（isEntryGoalMet 为真）
   *   2) EC3 已买上（isBought）或已进入/完成
   *   3) 下一关不再是 EC3
   *   4) 不在自动化窗口（挑战中 / 毁灭现实 / 总开关关闭 / 已解锁 Reality）
   */
  shouldHoldCrunch() {
    try {
      if (!this.active) return false;
      if (player.challenge.eternity.unlocked !== 0) return false;
      if (this.nextUnfinishedEcId() !== 3) return false;
      const study = TimeStudy.eternityChallenge(3);
      if (!study || study.isBought) return false;
      const primaryMet = (study.config.requirement || []).some(s => {
        try {
          return TimeStudy(s).isBought;
        } catch (e) {
          return false;
        }
      });
      if (!primaryMet) return false;
      return !study.isEntryGoalMet;
    } catch (e) {
      this._err("shouldHoldCrunch", e);
      return false;
    }
  },

  /**
   * I) EC6 的入口是「复制器星系 ≥ 1」（ec-time-studies.js:71，AD15 已按 /100 缩放）。
   *
   * 为什么必须单独处理（R25 实测 + 源码核对）：
   * 1. `Replicanti.galaxies.max = ReplicantiUpgrade.galaxies.value + extra`
   *    （replicanti.js:550-552），而 `value` 就是 `player.replicanti.boughtGalaxyCap`，
   *    初始 0；`extra` 来自时间研究 131，效果是 `floor(boughtGalaxyCap / 2)` = 0。
   *    所以不先买「复制器星系上限」升级，上限恒为 0 → `canBuyMore` 恒 false → 永远 0 个。
   *    R25 实测末态 `repGalMax: 0`、`repGal: 0`。
   * 2. 复制器星系的自动购买器在**买到时间研究 131 后被硬性禁用**：
   *    `ReplicantiGalaxyAutobuyerState.isEnabled` 是
   *    `Achievement(138).isUnlocked || !TimeStudy(131).isBought`（replicanti-galaxy-autobuyer.js:16）。
   *    自动化为了推进研究树一定买了 131 → 自动器永久关闭（R25 实测 rgAutoOn = false）。
   *    这里直接走原版手动购买函数 `replicantiGalaxy(true)`（它本身只校验
   *    `RealityUpgrade(6)` 与 `canBuyMore`，不受自动器开关影响），不伪造任何状态。
   * 3. `player.replicanti.galaxies` 会被 `Replicanti.reset()`（eternity.js:120）清零，
   *    所以只在下一次 EC 就是 EC6 时才刷，避免每帧拖慢别的关。
   */
  tryReplicantiGalaxyForEc6() {
    try {
      if (!this.active) return false;
      if (this.nextUnfinishedEcId() !== 6) return false;
      const study = TimeStudy.eternityChallenge(6);
      if (!study || study.isBought) return false;
      const primaryMet = (study.config.requirement || []).some(s => {
        try {
          return TimeStudy(s).isBought;
        } catch (e) {
          return false;
        }
      });
      if (!primaryMet) return false;
      if (EternityChallenge(6).completions >= EternityChallenge(6).maxCompletions) return false;
      let did = false;
      if (Replicanti.galaxies.bought < 1) {
        if (Replicanti.galaxies.max < 1) {
          // 上限升级（1e170 IP 起，成本对当前进度可以忽略）
          ReplicantiUpgrade.galaxies.purchase();
          did = true;
        }
        // `replicantiGalaxy()` 内部自己做 canBuyMore（复制器数量 ≥ 1.8e308）校验
        if (Replicanti.galaxies.max >= 1) {
          replicantiGalaxy(true);
          did = did || Replicanti.galaxies.bought >= 1;
        }
      }
      if (Replicanti.galaxies.bought >= 1 && !study.isBought) {
        // [R25] 必须在**同一个函数调用里**把 EC6 研究买掉：
        // `player.replicanti.galaxies` 每次永恒都会被 `Replicanti.reset()` 清零
        // （eternity.js:120），而永恒自动化每帧都在跑（et 每秒几千次）。
        // 若留到 20 帧一次的 EC 循环再买，`requirementCurrent` 缓存早被
        // `invalidateCachedRequirements()` 清掉，又要重新攒 —— 与 AD16 修的是同一类
        // 「同帧被重置冲掉」问题。
        study.purchase();
        did = true;
      }
      return did;
    } catch (e) {
      this._err("tryReplicantiGalaxyForEc6", e);
      return false;
    }
  },

  /**
   * R81：补齐原版永恒升级商店。先保留首个时间维度的购买机会，随后每拍最多
   * 买一项未购升级；完全委托原版扣费与前置检查，不直接写升级或资源存档。
   */
  buyEternityUpgrades() {
    if (!this.active) return false;
    try {
      // 时间维度是时间之理购买的前置，不能让 5 EP 升级抢走新永恒的启动资金。
      if (!TimeDimension(1).bought) return false;
      for (const upgrade of EternityUpgrade.all) {
        if (upgrade.isBought || !upgrade.canBeBought) continue;
        return upgrade.purchase() === true;
      }
      return false;
    } catch (error) {
      // 加载过程缺失游戏对象时保留原有自动化，不把异常误记为购买成功。
      this._err("buyEternityUpgrades", error);
      return false;
    }
  },

  /**
   * EC8 的原版规则禁止 Infinity Dimension 与 Replicanti Upgrade 自动购买器，
   * 但挑战本身仍分别允许最多 50 / 40 次手动购买。即时完成模块退役后，
   * 必须补上这条受限购买链，否则进入 EC8 会清空无限维度并永久停在原地。
   *
   * 这里只调用原版购买入口：
   *   · 仍有维度未完成首次购买时，逐次调用 `buySingle()`，并为每个未首购维度
   *     保留一次额度；维度可能已解锁但当前 IP 尚买不起；
   *   · 八维都至少购买一次后才调用 `buyMax()`；
   *   · `ReplicantiUpgrade.*.purchase()` 自己按 `player.eterc8repl` 截断并递减。
   * 不调用绕过 EC8 计数的 `autobuyerTick()`，不写任何购买次数或完成状态。
   */
  tryEternityChallenge8Purchases() {
    try {
      if (Pelle.isDoomed) return false;
      const challenge = EternityChallenge(8);
      if (!challenge?.isRunning || !player.auto.autobuyersOn) return false;
      if (player.auto.eternity.isActive !== true && !this._eternityBootstrapActive()) return false;
      let acted = false;
      if (InfinityDimensions.canBuy()) {
        const dimensions = InfinityDimensions.all;
        for (const dimension of dimensions) dimension.unlock();
        const unpurchasedCount = dimensions.filter(dimension => dimension.purchases === 0).length;
        if (unpurchasedCount === 0) {
          const before = dimensions.reduce((sum, dimension) => sum + dimension.purchases, 0);
          InfinityDimensions.buyMax();
          const after = dimensions.reduce((sum, dimension) => sum + dimension.purchases, 0);
          acted = after > before || acted;
        } else {
          // 普通「全部购买」会优先把低价 ID1 买到上限；EC8 只有不可恢复的
          // 50 次额度，提前花光会让尚未首购的 ID 永久无法获得生产倍率。
          // 已解锁但暂时买不起的高阶维度也必须计入保留额度。预留额度先允许
          // 未首购维度自己使用；只有重复购买才必须停在剩余未首购数之外。
          const purchasable = dimensions.filter(dimension => dimension.isUnlocked);
          while (player.eterc8ids > 0) {
            let boughtThisPass = false;
            for (const dimension of purchasable.slice().reverse()) {
              if (player.eterc8ids <= 0) break;
              if (dimension.purchases !== 0 ||
                !dimension.isAvailableForPurchase ||
                !dimension.buySingle()) continue;
              acted = true;
              boughtThisPass = true;
            }
            const reserve = dimensions.filter(dimension => dimension.purchases === 0).length;
            for (const dimension of purchasable.slice().reverse()) {
              if (player.eterc8ids <= reserve) break;
              if (!dimension.isAvailableForPurchase || !dimension.buySingle()) continue;
              acted = true;
              boughtThisPass = true;
            }
            if (!boughtThisPass) break;
          }
        }
      }
      for (const upgrade of [
        ReplicantiUpgrade.chance,
        ReplicantiUpgrade.interval,
        ReplicantiUpgrade.galaxies,
      ]) {
        while (upgrade.canBeBought && player.eterc8repl > 0) {
          const before = upgrade.value;
          upgrade.purchase();
          if (upgrade.value === before) break;
          acted = true;
        }
      }
      return acted;
    } catch (e) {
      this._err("tryEternityChallenge8Purchases", e);
      return false;
    }
  },

  tick() {
    // [R96] TT ×500：**先**对账（建基线/结算上一帧的真实购买），**再**买。
    // 顺序反了会让首帧的购买被当成历史购买而漏发。
    // 且这一步与 `active` 无关：玩家关掉自动后手动买同样要按 ×500 结算 ——
    // 它是「真实购买后的奖励口径」，不是自动动作。
    this.settleTimeTheoremReward();

    // EC8 内常规 `active` 必须关闭，以免购买 TD/TT/研究；但挑战允许的
    // 50 次无限维度与 40 次复制器升级仍需由调度任务合法推进。
    const ec8 = this.tryEternityChallenge8Purchases();
    if (!this.active) return { dims: false, tt: false, studies: 0, dilation: 0, ec: false, ec8 };
    // [R118-01 #69] EC 入口等待期间压住原版 EternityAutobuyer（它不经过 tickEternity 门禁）。
    this._manageEternityHoldForEcEntry();
    // [R96] 顺序修正：TD1 已买时**先买永恒升级**（乘数优先），再考虑时间维度；
    // TD1 尚未存在时只能先播种它（升级商店前置）。旧顺序先放行全部 TD，
    // 会把刚够升级的 EP 花掉（审查指出的 P1）。
    const upgrades = this.buyEternityUpgrades();
    const dims = this.buyTimeDimensions();
    const tt = this.buyTimeTheorems();
    this._frame++;
    let studies = 0;
    let dilation = 0;
    let ec = false;
    // [R104 P0] 帧计数节流在 runCycle 统一节拍下会被放大 100~1000 倍：
    // tick() 实际约 45s 才被服务一次（探针 diag-frame-20261113-0125：_frame 90s 只涨 2），
    // 于是 _frame%30 变成 ~22 分钟才买一次研究、_frame%20 变成 ~15 分钟才试一次 EC。
    // 改为真实时间节流：只要被服务到就按 1s/2s 间隔推进，不再依赖被调用次数。
    const nowMs = Date.now();
    if (nowMs - (this._lastStudyTickAt || 0) >= 1000) {
      this._lastStudyTickAt = nowMs;
      // 换列（121 ↔ 123）或换维度分叉（71 ↔ 73）只能靠 respec：
      // 这些研究互斥，买了一条就再也买不到另一条
      if (this.needsBranchRespec()) {
        respecTimeStudies(true);
      } else {
        studies = this.buyTimeStudies();
        dilation = this.buyDilationStudies();
      }
    }
    this.tryReplicantiGalaxyForEc6();
    // EC 的进入会触发 eternity 重置；真实时间 2s 节流（原先按帧计数）
    if (nowMs - (this._lastEcTickAt || 0) >= 2000) {
      this._lastEcTickAt = nowMs;
      ec = this.buyEcStudiesAndStart();
    }
    return { dims, tt, upgrades, studies, dilation, ec, ec8 };
  },
};

// 便于真实新档脚本观测内部判定（例如 ecEntryPending / nextUnfinishedEcId），
// 与 oreki-reality-automation.js 的做法一致；不参与任何游戏逻辑。
try {
  globalThis.OrekiEternityAutomation = OrekiEternityAutomation;
} catch (e) {
  // 非浏览器环境忽略
}
