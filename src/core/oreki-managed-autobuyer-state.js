// ---------------------------------------------------------------------------
// [R97 → R116-02] 目标驱动型智能自动购买器 —— 受托管原版自动器统一管理（Web）
//
// 本模块是 MOD 调度器托管层的**唯一启用状态写入口**：
//   1. 只在调度器**托管 Tick** 上处理一次（OrekiSmartExecutor.hostingTick()），
//      与玩家配置的 1～60 秒周期严格同步；同一 tick 不重复写。
//   2. 每个有效 Tick 都按**当前阶段最新状态**重新计算启用目标：
//      玩家手动改动启停后，本 Tick 内允许保留其操作，下一次有效 Tick 恢复目标。
//   3. 启停目标：反物质维度 ×8、无限维度 ×8、计数频率、维度提升、星系、献祭、
//      无限点数倍率、已解锁的时间维度、时间之理与永恒点数倍率保持开启；
//      大坍缩严格跟随当帧策略的 true/false，策略要求关闭时下一 Tick 关闭，
//      一次性 release 由调用方以 true 明确传入。
//   4. **单一所有者**：本模块托管启用状态、基础购买模式、限制项及大坍缩
//      amount / xHighest / increaseWithMult；大坍缩 mode / interval 由
//      OrekiManagedCrunchInterval 在同一个托管 Tick 强制到策略值。玩家修改只允许
//      存活到下一次有效 Tick。
//   5. MOD 全局自动化启用时，原版自动购买器总开关也在下一托管 Tick 恢复。
//      关闭 MOD 时按 saveId 写回首次接管前
//      的原值（若玩家在最后一次托管写入后再次手改，则保留玩家最新值）。
//   6. IU15 冲刺整体让路（冲刺模块有意关闭 ID 自动器）；佩勒毁灭态只让大坍缩目标
//      保持关闭，其余 21 项仍按目标对账（与 Android 旧实现一致，避免玩家关闭后
//      整个阶段无法恢复）。
//   7. 只写启用状态，不调用购买/tick/结算接口；「配置已恢复」≠「真实购买已执行」。
//   8. 换存档/阶段重置后不保留旧目标：每次 Tick 都按当前真实字段重新计算。
//
// 与 Android OrekiStageAuto.applyManagedAutobuyerStates() 的关系：
//   双端在「启停托管 / 总开关让路 / 手动下一 Tick 恢复」上语义一致；
//   本 PR **未**同步 Android 的 Tick 触发时机/大坍缩 interval 托管细节，
//   Android 侧同步事项登记在 #164，不能仅凭本文件声称双端已完成。
// ---------------------------------------------------------------------------

const TAG = "OREKI_MANAGED_AUTO";
const ORIGINAL_STORAGE_KEY = "oreki.managedAutobuyerOriginals";

/** 受托管项的固定键序（用于自检/面板展示；读写仍按实际枚举）。 */
export const MANAGED_KEYS = Object.freeze([
  "dim1", "dim2", "dim3", "dim4", "dim5", "dim6", "dim7", "dim8",
  "infinityDim1", "infinityDim2", "infinityDim3", "infinityDim4",
  "infinityDim5", "infinityDim6", "infinityDim7", "infinityDim8",
  "tickspeed", "dimboost", "galaxy", "sacrifice", "crunch", "ipmult",
  "timeDim1", "timeDim2", "timeDim3", "timeDim4", "timeDim5", "timeDim6", "timeDim7", "timeDim8",
  "timeTheorem", "epMult",
]);

/**
 * 当前策略的受管参数目标。
 *
 * 这些值对应原版真实配置字段，并只在对应自动器已解锁时应用。购买上限/模式不是
 * 为了让玩家"改不动"而写死：基础维度采用原版 10 次批量，计数频率采用单次购买，
 * 维度提升/星系取消人为限额，献祭阈值为 2×；大坍缩启停和节拍仍由当帧策略决定。
 */
export const MANAGED_FIELDS = Object.freeze({
  dimensionMode: "BUY_10",
  tickspeedMode: "BUY_SINGLE",
  sacrificeMultiplier: 2,
  crunchAmount: 10,
  crunchXHighest: 10,
  // TIME 是受管模式；关闭原版 amount 自增，避免每次坍缩后与固定阈值互相覆盖。
  crunchIncreaseWithMult: false,
});

const STATE = {
  /** 已处理到的托管 Tick 序号；同一 tick 不重复处理。 */
  lastTick: 0,
  lastGlobalTick: 0,
  /** 存档身份（records.gameCreatedTime），仅用于诊断与换档复位。 */
  saveId: null,
  /** 统计：处理 tick 数 / 真实写入数 / 跳过项数。 */
  ticks: 0,
  writes: 0,
  skips: 0,
  lastTickAt: 0,
  lastRestored: [],
  lastReason: "",
  /** 当前存档的首次原值/最近托管写值；关闭 MOD 时据此安全回滚。 */
  originalRecord: null,
};

/** 日志里的时间统一保留 1 位小数，避免不同浏览器打印位数不一致。 */
function fmtMs(value) {
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : "NaN";
}

function logLine(message) {
  try {
    console.info(`[${TAG}] ${message}`);
  } catch (e) {
    // 非浏览器环境忽略
  }
}

function modeValue(name, fallback) {
  try {
    const mode = Number(globalThis.AUTOBUYER_MODE && globalThis.AUTOBUYER_MODE[name]);
    return Number.isInteger(mode) ? mode : fallback;
  } catch (e) {
    return fallback;
  }
}

function sameDecimal(actual, target) {
  try {
    return Boolean(actual && typeof actual.eq === "function" && actual.eq(target));
  } catch (e) {
    return false;
  }
}

function decimalTarget(value) {
  try {
    return typeof Decimal !== "undefined" && Decimal ? new Decimal(value) : value;
  } catch (e) {
    return value;
  }
}

function serializeManagedValue(value) {
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  try {
    if (value && typeof value.toString === "function") return { decimal: value.toString() };
  } catch (e) { /* ignore */ }
  return null;
}

function deserializeManagedValue(value) {
  if (value && typeof value === "object" && typeof value.decimal === "string") {
    return decimalTarget(value.decimal);
  }
  return value;
}

function readOriginalRecord(saveId) {
  try {
    const raw = globalThis.localStorage?.getItem(ORIGINAL_STORAGE_KEY);
    if (!raw) return { saveId, fields: {} };
    const parsed = JSON.parse(raw);
    if (parsed && parsed.saveId === saveId && parsed.fields && typeof parsed.fields === "object") {
      return parsed;
    }
  } catch (e) { /* malformed/unavailable storage is treated as empty */ }
  return { saveId, fields: {} };
}

function writeOriginalRecord() {
  try {
    const record = STATE.originalRecord;
    if (record && Object.keys(record.fields).length > 0) {
      globalThis.localStorage?.setItem(ORIGINAL_STORAGE_KEY, JSON.stringify(record));
    }
  } catch (e) { /* persistence failure leaves the in-memory baseline usable */ }
}

function ensureOriginalRecord(saveId) {
  if (STATE.originalRecord && STATE.originalRecord.saveId === saveId) {
    return STATE.originalRecord;
  }
  STATE.originalRecord = readOriginalRecord(saveId);
  return STATE.originalRecord;
}

/** 在首次真实写入前记录原值，并持续记录最近一次托管写出值。 */
function rememberManagedWrite(key, actual, target) {
  const record = ensureOriginalRecord(STATE.saveId);
  if (!record.fields[key]) {
    record.fields[key] = { original: serializeManagedValue(actual), written: null };
  }
  record.fields[key].written = serializeManagedValue(target);
  writeOriginalRecord();
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

/** 读存档身份；仅用于诊断与换档时清统计，不参与目标计算。 */
function readSaveId() {
  try {
    const value = player && player.records && player.records.gameCreatedTime;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  } catch (e) {
    return null;
  }
}

function readRealities() {
  try {
    const value = player && player.realities;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (value && typeof value.toNumber === "function") {
      const num = value.toNumber();
      return Number.isFinite(num) ? num : null;
    }
  } catch (e) { /* ignore */ }
  return null;
}

function isIu15SprintLocking() {
  try {
    return globalThis.OrekiIu15Sprint && globalThis.OrekiIu15Sprint.active === true;
  } catch (e) {
    return false;
  }
}

function isPelleDoomed() {
  try {
    return typeof Pelle !== "undefined" && Pelle && Pelle.isDoomed === true;
  } catch (e) {
    return false;
  }
}

/** 取自动器注册表：优先调用方注入（便于纯逻辑自检），其次全局。 */
function resolveAutobuyers(explicit) {
  if (explicit) return explicit;
  return globalThis.Autobuyer || null;
}

/**
 * 单项启用状态对账（纯函数，供测试直接覆盖）。
 *
 * @param {string} key 受托管键
 * @param {boolean} actual 真实 isActive
 * @param {boolean} target 当前阶段目标
 * @param {(value: boolean) => void} write 唯一写入口
 * @returns {boolean} true = 本次真的写了一次
 */
export function reconcile(key, actual, target, write) {
  if (!key || typeof write !== "function") return false;
  if (target !== true && target !== false) return false;
  if (actual === target) return false;
  try {
    write(target);
  } catch (e) {
    logLine(`key=${key} event=write-failed error=${e && e.name ? e.name : "unknown"}`);
    return false;
  }
  return true;
}

/**
 * 每个调度器托管 Tick 调用一次。
 *
 * @param {object} [options]
 * @param {boolean|null} [options.wantCrunch] 当前阶段策略是否要求大坍缩运行；null=未知不动
 * @param {object} [options.autobuyers] 自动器注册表（默认 globalThis.Autobuyer）
 * @param {number} [options.tick] 托管 Tick 序号（默认从 OrekiSmartExecutor 读取）
 * @param {number} [options.nowMs] 当前单调时钟（仅日志/诊断）
 * @returns {{applied: boolean, reason: string, tick: number|null, checked: number, wrote: number, restored: string[]}}
 */
export function applyAll({
  wantCrunch = null,
  autobuyers = null,
  tick = null,
  nowMs = (typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now()),
} = {}) {
  const resolvedTick = resolveTick(tick);
  if (resolvedTick === null) {
    return { applied: false, reason: "no-tick", tick: null, checked: 0, wrote: 0, restored: [] };
  }
  if (resolvedTick === STATE.lastTick) {
    return { applied: false, reason: "tick-wait", tick: resolvedTick, checked: 0, wrote: 0, restored: [] };
  }

  // 闸门一：MOD 总开关。取不到执行层也按关闭处理（fail-closed）。
  const executor = globalThis.OrekiSmartExecutor;
  if (!executor || executor.enabled === false) {
    return { applied: false, reason: "mod-off", tick: resolvedTick, checked: 0, wrote: 0, restored: [] };
  }
  const auto = globalThis.player?.auto;
  if (typeof auto?.autobuyersOn !== "boolean") {
    return { applied: false, reason: "no-player-auto", tick: resolvedTick, checked: 0, wrote: 0, restored: [] };
  }

  const saveId = readSaveId();
  if (STATE.saveId !== null && saveId !== null && saveId !== STATE.saveId) {
    STATE.lastRestored = [];
  }
  STATE.saveId = saveId;
  ensureOriginalRecord(saveId);
  if (STATE.lastGlobalTick !== resolvedTick) {
    STATE.lastGlobalTick = resolvedTick;
    if (!Object.prototype.hasOwnProperty.call(STATE.originalRecord.fields, "autobuyersOn")) {
      rememberManagedWrite("autobuyersOn", auto.autobuyersOn, true);
    }
    if (!auto.autobuyersOn) {
      auto.autobuyersOn = true;
      logLine(`key=autobuyersOn tick=${resolvedTick} event=field-restored target=true`);
    }
  }
  // IU15 冲刺：冲刺模块有意关闭 ID 自动器，托管层整体让路（不消费 Tick）。
  if (isIu15SprintLocking()) {
    return { applied: false, reason: "iu15-sprint", tick: resolvedTick, checked: 0, wrote: 0, restored: [] };
  }

  const root = resolveAutobuyers(autobuyers);
  if (!root) {
    return { applied: false, reason: "no-registry", tick: resolvedTick, checked: 0, wrote: 0, restored: [] };
  }

  // 到这里才消费 Tick：总开关关闭/未知状态绝不推进 lastTick。
  STATE.lastTick = resolvedTick;
  STATE.lastTickAt = nowMs;
  STATE.ticks += 1;

  let checked = 0;
  let wrote = 0;
  let skipped = 0;
  const restored = [];

  const field = (key, actual, target, write, same = Object.is) => {
    checked += 1;
    try {
      if (actual === null || actual === undefined) {
        skipped += 1;
        STATE.skips += 1;
        return;
      }
      if (same(actual, target)) return;
      rememberManagedWrite(key, actual, target);
      write(target);
      wrote += 1;
      STATE.writes += 1;
      restored.push(key);
      logLine(`key=${key} tick=${resolvedTick} event=field-restored target=${target}`);
    } catch (e) {
      skipped += 1;
      STATE.skips += 1;
      logLine(`key=${key} tick=${resolvedTick} event=field-reconcile-failed ` +
        `error=${e && e.name ? e.name : "unknown"}`);
    }
  };

  const each = (key, item, target, group = null) => {
    checked += 1;
    try {
      if (!item) {
        skipped += 1;
        STATE.skips += 1;
        return;
      }
      const unlocked = item.isUnlocked === true || item.isBought === true;
      if (!unlocked) {
        skipped += 1;
        STATE.skips += 1;
        return;
      }
      const actual = group ? group.read() : item.isActive === true;
      if (actual !== target) rememberManagedWrite(key, actual, target);
      const didWrite = reconcile(key, actual, target, value => {
        if (group) group.write(value);
        else item.isActive = value;
      });
      if (didWrite) {
        wrote += 1;
        STATE.writes += 1;
        restored.push(key);
        logLine(`key=${key} tick=${resolvedTick} event=isActive-restored target=${target}`);
      }
    } catch (e) {
      skipped += 1;
      STATE.skips += 1;
      logLine(`key=${key} tick=${resolvedTick} event=reconcile-failed error=${e && e.name ? e.name : "unknown"}`);
    }
  };

  // [R118-01 #69] 反物质维度 ×8：原版 canTick = 组级 static isActive **且** 每层
  // data.isActive。旧实现只写组级开关；当存档组级=true、个体 data.isActive=false 时
  // （失败存档实测），8 层永不采购，AD8 永远到不了 EC3 入口 173。
  // 这里同时保证组级 true，并逐层对账个体 isActive；写入仍走原版 setter。
  const dims = root.antimatterDimension;
  const dimensionMode = modeValue(MANAGED_FIELDS.dimensionMode, 10);
  const dimensionItems = [];
  try {
    if (dims && dims.isActive !== true) {
      rememberManagedWrite("dimGroup", dims.isActive, true);
      dims.isActive = true;
      wrote += 1;
      STATE.writes += 1;
      // 组级恢复沿用旧诊断口径，restored 记 dim1（逐层差异仍会各自记录）。
      restored.push("dim1");
    }
  } catch (e) { /* 组级写入失败不阻断逐层 */ }
  for (let tier = 1; tier <= 8; tier += 1) {
    let dim = null;
    try {
      dim = typeof dims === "function" ? dims(tier) : (dims && (dims[tier - 1] || dims[tier])) || null;
    } catch (e) {
      dim = null;
    }
    each(`dim${tier}`, dim, true);
    dimensionItems.push({ key: `dim${tier}.mode`, item: dim });
  }

  // 无限维度自动器与反物质维度分开登记。原版 Eternity/Reality reset 会把每层
  // `isActive` 重置为 false；若只托管反物质维度，EC1 等真实挑战会因 ID 不再购买
  // 而长期停在低层，资源目标无法自然达到。
  const infinityDims = root.infinityDimension;
  try {
    if (infinityDims && infinityDims.isActive !== true) {
      rememberManagedWrite("infinityDimGroup", infinityDims.isActive, true);
      infinityDims.isActive = true;
      wrote += 1;
      STATE.writes += 1;
      restored.push("infinityDim1");
    }
  } catch (e) { /* 组级写入失败不阻断逐层 */ }
  for (let tier = 1; tier <= 8; tier += 1) {
    let dimension = null;
    try {
      dimension = typeof infinityDims === "function"
        ? infinityDims(tier)
        : (infinityDims && (infinityDims[tier - 1] || infinityDims[tier])) || null;
    } catch (e) {
      dimension = null;
    }
    each(`infinityDim${tier}`, dimension, true);
  }

  each("tickspeed", root.tickspeed, true);
  each("dimboost", root.dimboost, true);
  each("galaxy", root.galaxy, true);
  each("sacrifice", root.sacrifice, true);
  // 大坍缩启停同样由策略唯一决定；null 表示决策未知，保持现状。
  // Pelle 毁灭态的策略目标恒为关闭。
  const wantCrunchNow = wantCrunch === true && !isPelleDoomed();
  if (wantCrunch !== null) {
    each("crunch", root.bigCrunch, wantCrunchNow);
  } else {
    checked += 1;
    skipped += 1;
    STATE.skips += 1;
  }
  each("ipmult", root.ipMult, true);
  const timeDims = root.timeDimension;
  const unlockedTimeDims = timeDims?.zeroIndexed.filter(dimension => dimension.isUnlocked) ?? [];
  if (unlockedTimeDims.length > 0) {
    field("timeDimGroup", timeDims.isActive, true, value => { timeDims.isActive = value; });
    for (const dimension of unlockedTimeDims) {
      each(`timeDim${dimension.tier}`, dimension, true);
    }
  }
  each("timeTheorem", root.timeTheorem, true);
  each("epMult", root.epMult, true);

  for (const { key, item } of dimensionItems) {
    if (!item || (item.isUnlocked !== true && item.isBought !== true)) continue;
    field(key, item.mode, dimensionMode, value => { item.mode = value; });
  }
  if (root.tickspeed &&
      (root.tickspeed.isUnlocked === true || root.tickspeed.isBought === true)) {
    field(
      "tickspeed.mode",
      root.tickspeed.mode,
      modeValue(MANAGED_FIELDS.tickspeedMode, 1),
      value => { root.tickspeed.mode = value; },
    );
  }
  if (root.dimboost && (root.dimboost.isUnlocked === true || root.dimboost.isBought === true)) {
    field("dimboost.limitDimBoosts", root.dimboost.limitDimBoosts, false,
      value => { root.dimboost.limitDimBoosts = value; });
    field("dimboost.limitUntilGalaxies", root.dimboost.limitUntilGalaxies, false,
      value => { root.dimboost.limitUntilGalaxies = value; });
  }
  if (root.galaxy && (root.galaxy.isUnlocked === true || root.galaxy.isBought === true)) {
    field("galaxy.limitGalaxies", root.galaxy.limitGalaxies, false,
      value => { root.galaxy.limitGalaxies = value; });
  }
  if (root.sacrifice &&
      (root.sacrifice.isUnlocked === true || root.sacrifice.isBought === true)) {
    const multiplier = decimalTarget(MANAGED_FIELDS.sacrificeMultiplier);
    field("sacrifice.multiplier", root.sacrifice.multiplier, multiplier,
      value => { root.sacrifice.multiplier = value; }, sameDecimal);
  }
  // mode/time 由 OrekiManagedCrunchInterval 统一管理；这里只对另外三项配置对账，
  // 避免两个模块在同一 Tick 争夺同一字段。amount/xHighest 即使在 TIME 模式不参与
  // 当前触发，也属于存档中的受管阈值，读档后必须恢复，不能让玩家值变成永久目标。
  if (wantCrunch !== null && root.bigCrunch &&
      (root.bigCrunch.isUnlocked === true || root.bigCrunch.isBought === true)) {
    field(
      "crunch.amount",
      root.bigCrunch.amount,
      decimalTarget(MANAGED_FIELDS.crunchAmount),
      value => { root.bigCrunch.amount = value; },
      sameDecimal,
    );
    field(
      "crunch.xHighest",
      root.bigCrunch.xHighest,
      decimalTarget(MANAGED_FIELDS.crunchXHighest),
      value => { root.bigCrunch.xHighest = value; },
      sameDecimal,
    );
    field(
      "crunch.increaseWithMult",
      root.bigCrunch.increaseWithMult,
      MANAGED_FIELDS.crunchIncreaseWithMult,
      value => { root.bigCrunch.increaseWithMult = value; },
    );
  }

  STATE.lastRestored = restored;
  STATE.lastReason = "ok";
  return {
    applied: true,
    reason: "ok",
    tick: resolvedTick,
    checked,
    wrote,
    restored,
  };
}

/**
 * MOD 总开关关闭时把本模块实际写过的字段恢复到首次接管前原值。
 *
 * 只有当前值仍等于该字段最近一次托管写出值时才回滚；玩家在最后一次写入后自行
 * 修改的值保持不变。原值与最近写出值按当前存档 saveId 持久化，页面刷新后仍可恢复。
 */
export function releaseAll({ autobuyers = null } = {}) {
  const saveId = readSaveId();
  const record = ensureOriginalRecord(saveId);
  const root = resolveAutobuyers(autobuyers);
  if (!root || Object.keys(record.fields).length === 0) {
    STATE.originalRecord = record;
    return false;
  }

  let released = 0;
  const release = (key, read, write, same = Object.is) => {
    const item = record.fields[key];
    if (!item) return;
    try {
      const actual = read();
      if (actual === null || actual === undefined) return;
      if (!same(actual, deserializeManagedValue(item.written))) return;
      const original = deserializeManagedValue(item.original);
      if (same(actual, original)) return;
      write(original);
      released += 1;
      logLine(`key=${key} event=player-value-restored source=mod-off`);
    } catch (e) {
      logLine(`key=${key} event=player-value-restore-failed ` +
        `error=${e && e.name ? e.name : "unknown"}`);
    }
  };

  const auto = globalThis.player?.auto;
  if (auto) {
    release("autobuyersOn", () => auto.autobuyersOn, value => { auto.autobuyersOn = value; });
  }
  const dims = root.antimatterDimension;
  release("dimGroup", () => dims && dims.isActive, value => { dims.isActive = value; });
  for (let tier = 1; tier <= 8; tier += 1) {
    const item = typeof dims === "function" ? dims(tier) : (dims && (dims[tier - 1] || dims[tier]));
    release(`dim${tier}`, () => item && item.isActive, value => { item.isActive = value; });
    release(`dim${tier}.mode`, () => item && item.mode, value => { item.mode = value; });
  }
  const infinityDims = root.infinityDimension;
  release("infinityDimGroup", () => infinityDims && infinityDims.isActive,
    value => { infinityDims.isActive = value; });
  for (let tier = 1; tier <= 8; tier += 1) {
    const item = typeof infinityDims === "function"
      ? infinityDims(tier)
      : (infinityDims && (infinityDims[tier - 1] || infinityDims[tier]));
    release(`infinityDim${tier}`, () => item && item.isActive, value => { item.isActive = value; });
  }
  for (const key of ["tickspeed", "dimboost", "galaxy", "sacrifice", "crunch", "ipmult"]) {
    const item = key === "crunch" ? root.bigCrunch : root[key];
    release(key, () => item && item.isActive, value => { item.isActive = value; });
  }
  const timeDims = root.timeDimension;
  if (timeDims) {
    release("timeDimGroup", () => timeDims.isActive, value => { timeDims.isActive = value; });
    for (const dimension of timeDims.zeroIndexed) {
      release(`timeDim${dimension.tier}`, () => dimension.isActive, value => { dimension.isActive = value; });
    }
  }
  for (const key of ["timeTheorem", "epMult"]) {
    const item = root[key];
    if (item) release(key, () => item.isActive, value => { item.isActive = value; });
  }
  release("tickspeed.mode", () => root.tickspeed && root.tickspeed.mode,
    value => { root.tickspeed.mode = value; });
  release("dimboost.limitDimBoosts",
    () => root.dimboost && root.dimboost.limitDimBoosts,
    value => { root.dimboost.limitDimBoosts = value; });
  release("dimboost.limitUntilGalaxies",
    () => root.dimboost && root.dimboost.limitUntilGalaxies,
    value => { root.dimboost.limitUntilGalaxies = value; });
  release("galaxy.limitGalaxies",
    () => root.galaxy && root.galaxy.limitGalaxies,
    value => { root.galaxy.limitGalaxies = value; });
  release("sacrifice.multiplier",
    () => root.sacrifice && root.sacrifice.multiplier,
    value => { root.sacrifice.multiplier = value; }, sameDecimal);
  release("crunch.amount",
    () => root.bigCrunch && root.bigCrunch.amount,
    value => { root.bigCrunch.amount = value; }, sameDecimal);
  release("crunch.xHighest",
    () => root.bigCrunch && root.bigCrunch.xHighest,
    value => { root.bigCrunch.xHighest = value; }, sameDecimal);
  release("crunch.increaseWithMult",
    () => root.bigCrunch && root.bigCrunch.increaseWithMult,
    value => { root.bigCrunch.increaseWithMult = value; });

  try { globalThis.localStorage?.removeItem(ORIGINAL_STORAGE_KEY); } catch (e) { /* ignore */ }
  STATE.originalRecord = null;
  STATE.lastTick = 0;
  STATE.lastGlobalTick = 0;
  STATE.lastReason = released > 0 ? "released-to-player" : "release-noop";
  return released > 0;
}

/** 面板/日志用摘要。 */
export function describeManagedActive() {
  return `tick=${STATE.lastTick} restored=[${STATE.lastRestored.join(",")}] ` +
    `writes=${STATE.writes} skips=${STATE.skips}`;
}

/** 结构化只读状态，便于控制台验收。 */
export function debugState() {
  return {
    lastTick: STATE.lastTick,
    lastTickAt: STATE.lastTickAt,
    saveId: STATE.saveId,
    ticks: STATE.ticks,
    writes: STATE.writes,
    skips: STATE.skips,
    lastRestored: [...STATE.lastRestored],
    lastReason: STATE.lastReason,
    realities: readRealities(),
    fields: { ...MANAGED_FIELDS },
  };
}

/** 仅供自检/测试复位。 */
export function resetForTest() {
  STATE.lastTick = 0;
  STATE.lastGlobalTick = 0;
  STATE.saveId = null;
  STATE.ticks = 0;
  STATE.writes = 0;
  STATE.skips = 0;
  STATE.lastTickAt = 0;
  STATE.lastRestored = [];
  STATE.lastReason = "";
  STATE.originalRecord = null;
}

try {
  globalThis.OrekiManagedAutobuyerState = {
    MANAGED_KEYS,
    MANAGED_FIELDS,
    reconcile,
    applyAll,
    releaseAll,
    describeManagedActive,
    debugState,
    resetForTest,
  };
} catch (e) {
  // 非浏览器环境忽略
}
