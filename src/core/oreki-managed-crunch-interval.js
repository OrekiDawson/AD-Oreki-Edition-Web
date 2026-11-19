// ---------------------------------------------------------------------------
// [R96 / R116-02] 大坍缩「受管节拍」—— Web 侧（调度器托管 Tick 版）
//
// 与 Android OrekiStageAuto.writeManagedCrunchInterval() 的玩家可见语义等价：
//   1. 只在 MOD 调度器的**托管 Tick** 上处理（严格采用玩家 1～60 秒配置）；
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
  lastMode: null,
  /** 上一帧策略是否 allow；用于识别 deny→allow 的一次性 release。 */
  lastDecisionAllow: null,
  /** 一次性 release 的保留截止时刻（ms）；0 = 无。 */
  releaseUntilMs: 0,
  /** release 期间应写入的间隔（5/60 秒）。 */
  releaseSeconds: null,
  /** release 起始时的「上一无限运行」标记；真实大坍缩重置后据此解除保留。 */
  releaseStartMarker: null,
  /** 存档身份；换档时清 release 状态。 */
  saveId: null,
  /**
   * [R117-01-03b] 托管写入前的玩家原值。
   *
   * 关闭 MOD 总开关时必须把被托管的 `time` 写回原值，否则 TIME 模式玩家会
   * 继承 3600 秒暂停值（最长 1 小时不坍缩）。首次写入前记录；若检测到玩家
   * 在两次托管写入之间手改过，则以玩家最新值为原值。
   */
  originalTime: null,
  originalMode: null,
  /** 最近一次托管写入后的真实运行标记；用于区分玩家改 mode 与原版 reset。 */
  lastCrunchMarker: null,
  /** 原值所属存档身份；换档即失效。 */
  originalSaveId: null,
  /**
   * [R117-01-03b] 已释放标记：MOD 关闭期间 gameLoop 每帧都会走到 applyFromPolicy，
   * 若每次都读/清 localStorage 会造成每帧 I/O。释放一次后置真，直到下一次真正
   * 托管写入才复位。
   */
  released: false,
  /** 已释放所属存档；换档后必须允许对新存档重试。 */
  releasedSaveId: null,
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

function readActualMode() {
  try {
    const mode = player && player.auto && player.auto.bigCrunch && player.auto.bigCrunch.mode;
    return Number.isInteger(mode) ? mode : null;
  } catch (e) {
    return null;
  }
}

function writeActualMode(mode) {
  player.auto.bigCrunch.mode = mode;
}

function targetCrunchMode() {
  const mode = Number(globalThis.AUTO_CRUNCH_MODE && globalThis.AUTO_CRUNCH_MODE.TIME);
  return Number.isInteger(mode) ? mode : 1;
}

/**
 * 读「本次无限运行」的标记：真实大坍缩会把 realTime/time/maxAM 归零。
 *
 * 不能用 Currency.infinities 当令牌：被动无限产生（infinitiedGen / RU11 / Effarig）
 * 也会增加它，而它在每次永恒时清零；两者都会误判 release 已消费。
 */
function readCrunchMarker() {
  try {
    const records = player && player.records && player.records.thisInfinity;
    if (!records) return null;
    const realTime = Number(records.realTime);
    let maxAMLog = null;
    let maxAMIsZero = false;
    try {
      if (records.maxAM) {
        if (typeof records.maxAM.eq === "function" && records.maxAM.eq(0) === true) {
          maxAMIsZero = true;
        }
        if (typeof records.maxAM.log10 === "function") {
          const log = records.maxAM.log10();
          if (log === -Infinity) maxAMIsZero = true;
          else if (typeof log === "number" && !Number.isNaN(log)) maxAMLog = log;
        }
      }
    } catch (e) { /* ignore */ }
    return {
      realTime: Number.isFinite(realTime) ? realTime : null,
      maxAMLog,
      maxAMIsZero,
    };
  } catch (e) {
    return null;
  }
}

/** 标记是否显示「上一无限运行已被重置」= 发生真实大坍缩/永恒。 */
function crunchConsumedSince(start, now) {
  if (!start || !now) return false;
  if (start.realTime !== null && now.realTime !== null && now.realTime < start.realTime - 1e-9) {
    return true;
  }
  if (now.maxAMIsZero === true && start.maxAMIsZero !== true) return true;
  if (start.maxAMLog !== null && now.maxAMLog !== null && now.maxAMLog < start.maxAMLog - 1e-9) {
    return true;
  }
  return false;
}

function markerReadable(marker) {
  return Boolean(marker && marker.realTime !== null);
}

function readSaveId() {
  try {
    const value = player && player.records && player.records.gameCreatedTime;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  } catch (e) {
    return null;
  }
}

/**
 * [R117-01-03b] 托管原值的持久化记录（localStorage，不进存档结构）。
 *
 * 只靠内存快照时，页面刷新后第一次写入会把“上一会话托管写入的 3600”误当
 * 玩家原值，关闭总开关仍恢复不了。这里按存档身份记录：
 *   { saveId, originalTime, writtenTime }
 * 读取时只有 saveId 相同、且当前值仍等于 writtenTime（说明是托管写出的值）
 * 才采用 originalTime。
 */
const MANAGED_TIME_STORAGE_PREFIX = "oreki.crunchInterval.managed";
/** 仅用于区分“本会话写入”与“上一次会话遗留”，刷新后必须变化。 */
function createSessionId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
let MANAGED_TIME_SESSION_ID = createSessionId();
/** 上一拍写出值的匹配窗口：覆盖自动存档 1~3 秒的落盘延迟。 */
const PREVIOUS_WRITE_MATCH_WINDOW_MS = 15000;

function managedTimeStorageKey(saveId) {
  return `${MANAGED_TIME_STORAGE_PREFIX}:${saveId}`;
}

/** 按存档分键读取；saveId 无效返回 null（不跨档读写）。 */
function readPersistedManagedTime(saveId) {
  try {
    if (!Number.isFinite(saveId)) return null;
    if (typeof localStorage === "undefined" || !localStorage) return null;
    const raw = localStorage.getItem(managedTimeStorageKey(saveId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const originalTime = Number(parsed.originalTime);
    const writtenTime = Number(parsed.writtenTime);
    const originalMode = parsed.originalMode === null || parsed.originalMode === undefined
      ? null
      : Number(parsed.originalMode);
    const writtenMode = parsed.writtenMode === null || parsed.writtenMode === undefined
      ? null
      : Number(parsed.writtenMode);
    const previousWrittenTime = Number(parsed.previousWrittenTime);
    const updatedAt = Number(parsed.updatedAt);
    if (!Number.isFinite(originalTime) || !Number.isFinite(writtenTime)) return null;
    return {
      saveId,
      originalTime,
      writtenTime,
      originalMode: Number.isInteger(originalMode) ? originalMode : null,
      writtenMode: Number.isInteger(writtenMode) ? writtenMode : null,
      previousWrittenTime: Number.isFinite(previousWrittenTime) ? previousWrittenTime : null,
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : null,
      sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : null,
    };
  } catch (e) {
    return null;
  }
}

function writePersistedManagedTime(record) {
  try {
    if (!record || !Number.isFinite(record.saveId)) return;
    if (typeof localStorage === "undefined" || !localStorage) return;
    localStorage.setItem(managedTimeStorageKey(record.saveId), JSON.stringify(record));
  } catch (e) { /* 存储不可用不阻断托管 */ }
}

function clearPersistedManagedTime(saveId) {
  try {
    if (!Number.isFinite(saveId)) return;
    if (typeof localStorage === "undefined" || !localStorage) return;
    localStorage.removeItem(managedTimeStorageKey(saveId));
  } catch (e) { /* 存储不可用不阻断托管 */ }
}

/** 一次性 release 窗口/决策残留：释放时必须清空，避免重开继承关闭期间的窗口。 */
function clearReleaseWindow() {
  STATE.releaseUntilMs = 0;
  STATE.releaseSeconds = null;
  STATE.releaseStartMarker = null;
  STATE.lastDecisionAllow = null;
}

/**
 * 当前值是否仍是托管写出值。
 *
 * 只认最近一次与紧邻上一次（上一拍仅限 15 秒落盘窗口内）；不把 5/60/3600
 * 这类玩家可选值长期纳入匹配，避免把玩家手设值误判为托管值。
 */
function persistedContainsManagedTime(
  persisted,
  seconds,
  { includePrevious = true, now = Date.now() } = {},
) {
  if (!persisted || !Number.isFinite(seconds)) return false;
  if (sameInterval(persisted.writtenTime, seconds)) return true;
  if (!includePrevious || !Number.isFinite(persisted.previousWrittenTime)) return false;
  if (!Number.isFinite(persisted.updatedAt) ||
      now - persisted.updatedAt > PREVIOUS_WRITE_MATCH_WINDOW_MS) return false;
  return sameInterval(persisted.previousWrittenTime, seconds);
}

function persistedContainsManagedMode(persisted, mode) {
  return Boolean(persisted && Number.isInteger(mode) &&
    Number.isInteger(persisted.writtenMode) && persisted.writtenMode === mode);
}

function hostingIntervalMs() {
  try {
    const value = globalThis.OrekiSmartExecutor && globalThis.OrekiSmartExecutor.hostingIntervalMs;
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : 1000;
  } catch (e) {
    return 1000;
  }
}

function isPelleDoomed() {
  try {
    return typeof Pelle !== "undefined" && Pelle && Pelle.isDoomed === true;
  } catch (e) {
    return false;
  }
}

function isManagedContextOpen() {
  try {
    const executor = globalThis.OrekiSmartExecutor;
    if (executor && executor.enabled === false) return false;
    if (typeof player === "undefined" || !player || !player.auto ||
        player.auto.autobuyersOn !== true) return false;
    const sprint = globalThis.OrekiIu15Sprint;
    if (sprint && sprint.active === true) return false;
    const crunch = globalThis.Autobuyer && globalThis.Autobuyer.bigCrunch;
    return Boolean(crunch && (crunch.isUnlocked === true || crunch.isBought === true));
  } catch (e) {
    return false;
  }
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
    // MOD 总开关关闭：立即停止托管、把托管字段写回玩家原值。
    // 必须放在 tick 早退之前：关闭后 hostingTick 不再前进，否则永远走不到这里。
    try {
      const executor = globalThis.OrekiSmartExecutor;
      if (executor && executor.enabled === false) {
        OrekiManagedCrunchInterval.releaseToPlayer();
        return false;
      }
    } catch (e) {
      return false;
    }
    if (!isManagedContextOpen()) return false;
    const resolvedTick = resolveTick(tick);
    if (resolvedTick === null) return false;
    if (resolvedTick === STATE.lastTick) return false;
    const actual = readActualInterval();
    if (actual === null) return false;
    const actualMode = readActualMode();
    if (actualMode === null) return false;
    const desiredMode = targetCrunchMode();
    const saveId = readSaveId();
    STATE.lastTick = resolvedTick;
    // 调度策略是受管 mode/time 的唯一权威来源；两项都相等时保持幂等。
    if (sameInterval(actual, desiredSeconds) && actualMode === desiredMode) {
      STATE.skips += 1;
      return false;
    }
    // 首次写入前记录玩家原值；换档或玩家在两次写入之间手改过时同步刷新。
    // 合并为一个条件，避免两处重复赋值后续漏改。
    const originalFresh = STATE.originalTime === null || STATE.originalSaveId !== saveId;
    const timeEdited = STATE.lastValue !== null && !sameInterval(actual, STATE.lastValue);
    const modeEdited = STATE.lastMode !== null && actualMode !== STATE.lastMode;
    if (originalFresh) {
      // 页面刷新/重开后内存态丢失：只有持久化记录来自上一次会话、当前值仍是
      // 最近/紧邻上一次托管写出值，且原值与写出值不同，才复用它。
      const persistedBefore = originalFresh ? readPersistedManagedTime(saveId) : null;
      const persistedBaseUsable = saveId !== null &&
        persistedBefore !== null &&
        (persistedBefore.sessionId !== MANAGED_TIME_SESSION_ID ||
          STATE.originalSaveId !== saveId);
      const timeRecordUsable = persistedBaseUsable &&
        !sameInterval(persistedBefore.originalTime, persistedBefore.writtenTime) &&
        persistedContainsManagedTime(persistedBefore, actual);
      const modeRecordUsable = persistedBaseUsable &&
        persistedBefore.originalMode !== null &&
        persistedContainsManagedMode(persistedBefore, actualMode);
      STATE.originalTime = timeRecordUsable ? persistedBefore.originalTime : actual;
      STATE.originalMode = modeRecordUsable
        ? persistedBefore.originalMode
        : actualMode;
      STATE.originalSaveId = saveId;
    } else {
      // mode 与 time 分别记录原值。原版 Eternal reset 可能只重置 mode，
      // 不能因此把仍受管的 time 误当作玩家新原值。
      if (timeEdited) STATE.originalTime = actual;
      const resetSinceManagedWrite = crunchConsumedSince(
        STATE.lastCrunchMarker,
        readCrunchMarker(),
      );
      if (modeEdited && !resetSinceManagedWrite) STATE.originalMode = actualMode;
    }
    if (actualMode !== desiredMode) writeActualMode(desiredMode);
    if (!sameInterval(actual, desiredSeconds)) writeActualInterval(desiredSeconds);
    STATE.released = false;
    STATE.releasedSaveId = null;
    if (saveId !== null) {
      // 按存档分键；只保留最近一次与紧邻上一次写出值，上一拍仅用于覆盖自动
      // 存档落盘窗口，避免把 60/5 等玩家常用值长期当作托管值。
      const previous = readPersistedManagedTime(saveId);
      writePersistedManagedTime({
        saveId,
        originalTime: STATE.originalTime,
        writtenTime: desiredSeconds,
        originalMode: STATE.originalMode,
        writtenMode: desiredMode,
        previousWrittenTime: previous !== null ? previous.writtenTime : null,
        updatedAt: Date.now(),
        sessionId: MANAGED_TIME_SESSION_ID,
      });
    }
    STATE.writes += 1;
    STATE.lastReason = reason;
    STATE.lastValue = desiredSeconds;
    STATE.lastMode = desiredMode;
    STATE.lastCrunchMarker = readCrunchMarker();
    console.info(
      `[OrekiCrunchInterval] tick=${resolvedTick} managed mode ${actualMode} -> ${desiredMode} ` +
        `interval ${actual} -> ${desiredSeconds} (${reason})`
    );
    return true;
  }

  /**
   * [R117-01-03b] 把受管的 `time` 写回玩家原值（MOD 总开关关闭时调用）。
   *
   * 仅当当前值仍等于上一次托管写入值（即玩家在最后一次写入后没有再手改）
   * 且与原值不同才写；写后清空托管 Tick/原值，重新开启时从新基线开始。
   *
   * @returns {boolean} true = 本次真的写回了一次
   */
  static releaseToPlayer() {
    const saveId = readSaveId();
    // 已释放且仍是同一存档：关闭期间每帧调用直接返回，避免重复 localStorage I/O。
    // 换档后 releasedSaveId 不匹配，允许对新存档重试一次。
    if (STATE.released && STATE.releasedSaveId === saveId) return false;
    // 所有释放出口共用：先清掉一次性 release 窗口/决策残留，避免重开后继承。
    clearReleaseWindow();
    const actual = readActualInterval();
    // 读不到当前值：只清托管 Tick，保留原值与持久化记录，下一帧/下一次关闭重试。
    if (actual === null) {
      STATE.lastTick = 0;
      STATE.released = false;
      STATE.releasedSaveId = null;
      return false;
    }
    const actualMode = readActualMode();
    if (actualMode === null) {
      STATE.lastTick = 0;
      STATE.released = false;
      STATE.releasedSaveId = null;
      return false;
    }
    const persisted = readPersistedManagedTime(saveId);
    const persistedUsable = persisted !== null && saveId !== null &&
      (persisted.sessionId !== MANAGED_TIME_SESSION_ID ||
        STATE.originalSaveId !== saveId);
    const inMemorySave = STATE.originalSaveId === null || saveId === null ||
      STATE.originalSaveId === saveId;
    const persistedTimeHit = persistedUsable &&
      persistedContainsManagedTime(persisted, actual);
    const persistedModeHit = persistedUsable &&
      persistedContainsManagedMode(persisted, actualMode);
    // 内存 lastValue 只在同一存档内有效；换档后必须用目标档的持久化写出值，
    // 否则会把上一档的 lastValue 与当前档 actual 比较，误判玩家手改。
    const lastValue = inMemorySave && STATE.lastValue !== null
      ? STATE.lastValue
      : (persistedTimeHit ? actual : null);
    const lastMode = inMemorySave && STATE.lastMode !== null
      ? STATE.lastMode
      : (persistedModeHit ? persisted.writtenMode : null);
    const original = inMemorySave && STATE.originalTime !== null
      ? STATE.originalTime
      : (persistedTimeHit ? persisted.originalTime : null);
    const originalMode = inMemorySave && STATE.originalMode !== null
      ? STATE.originalMode
      : (persistedModeHit ? persisted.originalMode : null);
    const sameSave = inMemorySave || persistedUsable;
    const changedTime = sameSave && lastValue !== null && original !== null &&
      !sameInterval(lastValue, original);
    const changedMode = sameSave && lastMode !== null && originalMode !== null &&
      lastMode !== originalMode;
    const changed = changedTime || changedMode;

    // 玩家在最后一次托管写入后手改过 ⇒ 尊重玩家，确认无需写回后再清理。
    const timeOverridden = lastValue !== null && !sameInterval(actual, lastValue);
    const modeOverridden = lastMode !== null && actualMode !== lastMode;
    if (timeOverridden || modeOverridden) {
      let wrote = false;
      try {
        if (!timeOverridden && changedTime) {
          writeActualInterval(original);
          wrote = true;
        }
        if (!modeOverridden && changedMode) {
          writeActualMode(originalMode);
          wrote = true;
        }
      } catch (e) {
        STATE.lastTick = 0;
        STATE.released = false;
        return false;
      }
      STATE.lastTick = 0;
      STATE.originalTime = null;
      STATE.originalMode = null;
      STATE.lastCrunchMarker = null;
      STATE.originalSaveId = null;
      STATE.lastValue = null;
      STATE.lastMode = null;
      STATE.released = true;
      STATE.releasedSaveId = saveId;
      clearPersistedManagedTime(saveId);
      console.info(
        `[OrekiCrunchInterval] mod-off partial restore ` +
          `timeOverride=${timeOverridden} modeOverride=${modeOverridden} wrote=${wrote}`
      );
      return wrote;
    }

    if (!changed) {
      // 没有可写回的原值（从未托管 / 原值等于写出值）：确认后才清记录。
      const timeTracked = persistedUsable &&
        Number.isFinite(persisted.originalTime) && Number.isFinite(persisted.writtenTime);
      const modeTracked = persistedUsable &&
        Number.isInteger(persisted.originalMode) && Number.isInteger(persisted.writtenMode);
      const persistedMismatch = (timeTracked && !persistedTimeHit) ||
        (modeTracked && !persistedModeHit);
      STATE.lastTick = 0;
      STATE.originalTime = null;
      STATE.originalMode = null;
      STATE.lastCrunchMarker = null;
      STATE.originalSaveId = null;
      STATE.lastValue = null;
      STATE.lastMode = null;
      STATE.released = true;
      STATE.releasedSaveId = saveId;
      clearPersistedManagedTime(saveId);
      if (persistedMismatch) {
        console.info(
          `[OrekiCrunchInterval] mod-off restore skipped: player override (persisted) ${actual}`
        );
      }
      return false;
    }

    // 真正写回；写失败时保留原值/记录并允许下一帧重试，绝不先清空。
    try {
      if (changedMode) writeActualMode(originalMode);
      if (changedTime) writeActualInterval(original);
    } catch (e) {
      STATE.lastTick = 0;
      STATE.released = false;
      STATE.releasedSaveId = null;
      return false;
    }
    STATE.lastTick = 0;
    STATE.originalTime = null;
    STATE.originalMode = null;
    STATE.lastCrunchMarker = null;
    STATE.originalSaveId = null;
    STATE.lastValue = null;
    STATE.lastMode = null;
    STATE.released = true;
    STATE.releasedSaveId = saveId;
    clearPersistedManagedTime(saveId);
    console.info(
      `[OrekiCrunchInterval] mod-off restore managed mode ${lastMode} -> ${originalMode}, ` +
        `interval ${lastValue} -> ${original}`
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
  static applyFromPolicy(decision = null, tick = null, intervalMs = null) {
    // [R117-01-03b] 总开关关闭：不再计算/写入托管目标，只负责把原值写回。
    try {
      const executor = globalThis.OrekiSmartExecutor;
      if (executor && executor.enabled === false) {
        OrekiManagedCrunchInterval.releaseToPlayer();
        return false;
      }
    } catch (e) {
      return false;
    }
    if (!isManagedContextOpen()) return false;
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

    const now = monotonicNow();
    const allow = decision.allow === true;
    const saveId = readSaveId();
    if (STATE.saveId !== null && saveId !== null && saveId !== STATE.saveId) {
      clearReleaseWindow();
      STATE.originalTime = null;
      STATE.originalMode = null;
      STATE.lastCrunchMarker = null;
      STATE.originalSaveId = null;
      STATE.lastValue = null;
      STATE.lastMode = null;
      STATE.released = false;
      STATE.releasedSaveId = null;
    }
    STATE.saveId = saveId;

    // 佩勒毁灭态：终局模块有意停止大坍缩，interval 托管整体让路（Android 同序）。
    if (isPelleDoomed()) return false;

    // [PR #57 review] 策略的 eternity-cycle / stall-* 等 allow 可能只在**一次** evaluate 中出现，
    // 且会在下一帧立刻回到 eternity-grow。托管 Tick 可能晚于这次 release，若直接按当帧 deny
    // 写回 3600 秒，原生自动器就错过了唯一的结算机会。这里保留 deny→allow 的释放窗口
    //（至少覆盖两个托管 Tick），在窗口内按 5/60 秒写入，直到原生大坍缩发生或超时。
    if (allow && STATE.lastDecisionAllow !== true) {
      // 调用方传入本次实际 Tick 间隔；缺省才回退到执行器读取值。
      const explicitInterval = Number(intervalMs);
      const holdBase = Number.isFinite(explicitInterval) && explicitInterval > 0
        ? explicitInterval
        : hostingIntervalMs();
      const holdMs = Math.max(2000, holdBase * 2);
      const marker = readCrunchMarker();
      if (markerReadable(marker)) {
        STATE.releaseUntilMs = now + holdMs;
        STATE.releaseSeconds =
          typeof player !== "undefined" && player.break
            ? CRUNCH_POST_BREAK_SECONDS
            : CRUNCH_PRE_BREAK_SECONDS;
        STATE.releaseStartMarker = marker;
        console.info(
          `[OrekiCrunchInterval] pending release reason=${decision.reason} ` +
            `holdMs=${holdMs} tickIntervalMs=${holdBase}`
        );
      }
    }
    if (!allow && STATE.releaseUntilMs > 0 && STATE.releaseStartMarker !== null) {
      const marker = readCrunchMarker();
      if (!markerReadable(marker) || crunchConsumedSince(STATE.releaseStartMarker, marker)) {
        // 标记不可读时无法验证是否已消费；或原生大坍缩已消费 → 停止强制 5s。
        STATE.releaseUntilMs = 0;
        STATE.releaseSeconds = null;
        STATE.releaseStartMarker = null;
      }
    }
    STATE.lastDecisionAllow = allow;

    const releaseActive = allow || (STATE.releaseUntilMs > 0 && now < STATE.releaseUntilMs);
    if (releaseActive) {
      const seconds = allow
        ? (typeof player !== "undefined" && player.break
          ? CRUNCH_POST_BREAK_SECONDS
          : CRUNCH_PRE_BREAK_SECONDS)
        : STATE.releaseSeconds;
      return OrekiManagedCrunchInterval.apply(
        seconds,
        allow ? `resume:${decision.reason}` : `release-pending:${decision.reason}`,
        tick
      );
    }

    const seconds =
      decision.reason === "eternity-grow"
        ? eternityWaitMs() / 1000
        : CRUNCH_PAUSE_SECONDS;
    return OrekiManagedCrunchInterval.apply(seconds, `pause:${decision.reason}`, tick);
  }

  /** 是否有尚未被原生大坍缩消费的一次性 release（供启用状态托管同 Tick 恢复大坍缩）。 */
  static hasPendingRelease() {
    return STATE.releaseUntilMs > 0 && monotonicNow() < STATE.releaseUntilMs;
  }

  static describe() {
    return {
      lastTick: STATE.lastTick,
      lastValue: STATE.lastValue,
      lastMode: STATE.lastMode,
      writes: STATE.writes,
      skips: STATE.skips,
      lastReason: STATE.lastReason,
      releasePending: STATE.releaseUntilMs > 0 && monotonicNow() < STATE.releaseUntilMs,
      nowMs: monotonicNow(),
    };
  }

  /** 仅测试：模拟页面刷新后的新会话，使持久化记录被视为“上一次会话”。 */
  static rotateSessionForTest() {
    MANAGED_TIME_SESSION_ID = createSessionId();
  }

  static resetForTest() {
    STATE.lastTick = 0;
    STATE.writes = 0;
    STATE.skips = 0;
    STATE.lastReason = "";
    STATE.lastValue = null;
    STATE.lastMode = null;
    clearReleaseWindow();
    STATE.saveId = null;
    STATE.originalTime = null;
    STATE.originalMode = null;
    STATE.lastCrunchMarker = null;
    STATE.originalSaveId = null;
    STATE.released = false;
    STATE.releasedSaveId = null;
  }
}

try {
  globalThis.OrekiManagedCrunchInterval = OrekiManagedCrunchInterval;
} catch (e) {
  // 非浏览器环境忽略
}
