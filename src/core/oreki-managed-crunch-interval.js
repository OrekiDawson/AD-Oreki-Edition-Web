// ---------------------------------------------------------------------------
// [R96 / R116-02] 大坍缩「受管节拍」—— Web 侧（调度器托管 Tick 版）
//
// 与 Android OrekiStageAuto.writeManagedCrunchInterval() 的玩家可见语义等价：
//   1. 只在 MOD 调度器的**托管 Tick** 上处理（与 1s / 5s / 玩家 1～60s 同步）；
//   2. 每个有效 Tick 读一次真实值 player.auto.bigCrunch.time 与当帧策略目标；
//   3. 玩家手动改间隔后，本 Tick 保留其操作；下一次有效 Tick 写回最新目标一次；
//   4. 实际值已等于目标 ⇒ 不写、不持久化（幂等，避免逐帧抖动）；
//   5. 只覆盖这一项受管参数，不碰 mode / amount / 其它原版设置，不擅自开自动器。
//
// 为什么不使用独立计时器：规则要求自动购买器有效周期与调度器 Tick 一致，
// 不允许叠加 setInterval / 自己算恢复时间。本模块复用 OrekiSmartExecutor 的
// hostingTick，与启停/模式托管共享同一拍。
// ---------------------------------------------------------------------------

import { OrekiCrunchPolicy, eternityWaitMs } from "./oreki-crunch-policy.js";

/** 与 Android 常量同名同值（PRE_BREAK / POST_BREAK / ETERNITY_GROW / PAUSE）。 */
export const CRUNCH_PRE_BREAK_SECONDS = 60;
export const CRUNCH_POST_BREAK_SECONDS = 5;
/** [R99] 永恒层成长窗口起点（秒）；实际写入值取 OrekiCrunchPolicy.eternityWaitMs() 的自适应窗口。 */
export const CRUNCH_ETERNITY_GROW_SECONDS = 60;
export const CRUNCH_PAUSE_SECONDS = 3600;

const STATE = {
  /** 已处理到的托管 Tick 序号；同一 tick 不重复处理。 */
  lastTick: 0,
  /** 统计：真正写入次数 / 跳过次数 / 最近原因。 */
  writes: 0,
  skips: 0,
  lastReason: "",
  lastValue: null,
};

function monotonicNow() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function sameInterval(a, b) {
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= 1e-9;
}

/** 读原版真实间隔；读不到返回 null（fail-closed，不猜）。 */
function readActualInterval() {
  try {
    const data = player && player.auto && player.auto.bigCrunch;
    const t = data && data.time;
    return Number.isFinite(t) ? t : null;
  } catch (e) {
    return null;
  }
}

function writeActualInterval(seconds) {
  player.auto.bigCrunch.time = seconds;
}

/** 解析当前托管 Tick：优先显式注入（测试/调用方），其次调度器。 */
function resolveTick(explicit) {
  if (Number.isInteger(explicit) && explicit > 0) return explicit;
  try {
    const executor = globalThis.OrekiSmartExecutor;
    const tick = executor && typeof executor.hostingTick === "function"
      ? executor.hostingTick()
      : null;
    return Number.isInteger(tick) && tick > 0 ? tick : null;
  } catch (e) {
    return null;
  }
}

export class OrekiManagedCrunchInterval {
  /**
   * 在调度器托管 Tick 上应用一次目标间隔。
   *
   * @param {number} desiredSeconds 当帧策略期望的间隔（秒）
   * @param {string} reason 归因，仅用于日志
   * @param {number} [tick] 托管 Tick 序号；缺省从 OrekiSmartExecutor 读取
   * @returns {boolean} true = 本次真的写了；false = 跳过（未到新 Tick/相等/读不到）
   */
  static apply(desiredSeconds, reason, tick = null) {
    if (!Number.isFinite(desiredSeconds)) return false;
    const resolvedTick = resolveTick(tick);
    if (resolvedTick === null) return false;
    if (resolvedTick === STATE.lastTick) return false;
    // MOD 总开关关闭：立即停止托管，不消费 Tick。
    try {
      const executor = globalThis.OrekiSmartExecutor;
      if (executor && executor.enabled === false) return false;
    } catch (e) {
      return false;
    }
    const actual = readActualInterval();
    if (actual === null) return false;
    STATE.lastTick = resolvedTick;
    // 相等则不写、不持久化（幂等）。
    if (sameInterval(actual, desiredSeconds)) {
      STATE.skips += 1;
      return false;
    }
    writeActualInterval(desiredSeconds);
    STATE.writes += 1;
    STATE.lastReason = reason;
    STATE.lastValue = desiredSeconds;
    console.info(
      `[OrekiCrunchInterval] tick=${resolvedTick} managed interval ${actual} -> ${desiredSeconds} (${reason})`
    );
    return true;
  }

  /**
   * 按当帧策略判定算出期望间隔并托管写入。
   *
   * 与 Android applyCrunchPolicy() 的分支同序：
   *   不允许坍缩 → 永恒层等待用自适应窗口、其余用 1 小时硬暂停；
   *   允许坍缩   → Break 前 60 秒收割、Break 后 5 秒下限。
   */
  static applyFromPolicy(decision = null, tick = null) {
    // [R97] 允许调用方传入本帧**唯一**一次 OrekiCrunchPolicy.decide() 的结果：
    // decide() 内部会推进坍缩等待计时，同一帧重复调用可能得出不同结论。
    if (!decision) {
      try {
        decision = OrekiCrunchPolicy.decide();
      } catch (e) {
        return false;
      }
    }
    if (!decision) return false;
    if (!decision.allow) {
      const seconds =
        decision.reason === "eternity-grow"
          ? eternityWaitMs() / 1000
          : CRUNCH_PAUSE_SECONDS;
      return OrekiManagedCrunchInterval.apply(seconds, `pause:${decision.reason}`, tick);
    }
    const seconds =
      typeof player !== "undefined" && player.break
        ? CRUNCH_POST_BREAK_SECONDS
        : CRUNCH_PRE_BREAK_SECONDS;
    return OrekiManagedCrunchInterval.apply(seconds, `resume:${decision.reason}`, tick);
  }

  static describe() {
    return {
      lastTick: STATE.lastTick,
      lastValue: STATE.lastValue,
      writes: STATE.writes,
      skips: STATE.skips,
      lastReason: STATE.lastReason,
      nowMs: monotonicNow(),
    };
  }

  static resetForTest() {
    STATE.lastTick = 0;
    STATE.writes = 0;
    STATE.skips = 0;
    STATE.lastReason = "";
    STATE.lastValue = null;
  }
}

try {
  globalThis.OrekiManagedCrunchInterval = OrekiManagedCrunchInterval;
} catch (e) {
  // 非浏览器环境忽略
}
