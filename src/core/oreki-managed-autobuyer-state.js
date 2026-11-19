// ---------------------------------------------------------------------------
// [R97 → R116-02] 目标驱动型智能自动购买器 —— 受托管原版自动器统一管理（Web）
//
// 本模块是 MOD 调度器托管层的**唯一启用状态写入口**：
//   1. 只在调度器**托管 Tick** 上处理一次（OrekiSmartExecutor.hostingTick()），
//      与 1s / 5s / 玩家 1～60s / 阶段上限动态同步；同一 tick 不重复写。
//   2. 每个有效 Tick 都按**当前阶段最新状态**重新计算启用目标：
//      玩家手动改动启停后，本 Tick 内允许保留其操作，下一次有效 Tick 恢复目标。
//   3. 启停目标：反物质维度 ×8、计数频率、维度提升、星系、献祭、无限点数倍率恒开；
//      大坍缩严格跟随当帧策略的 true/false，策略要求关闭时下一 Tick 关闭，
//      一次性 release 由调用方以 true 明确传入。
//   4. **单一所有者**：本模块托管启用状态、基础购买模式、限制项及大坍缩
//      amount / xHighest / increaseWithMult；大坍缩 mode / interval 由
//      OrekiManagedCrunchInterval 在同一个托管 Tick 强制到策略值。玩家修改只允许
//      存活到下一次有效 Tick。
//   5. 两个总开关（MOD 全局自动化 / 原版自动购买器总开关）任一关闭：
//      整体不接管，不写配置，也不消费 Tick；重新开启后从下一个有效 Tick 恢复。
//   6. IU15 冲刺整体让路（冲刺模块有意关闭 ID 自动器）；佩勒毁灭态只让大坍缩目标
//      保持关闭，其余 13 项仍按目标对账（与 Android 旧实现一致，避免玩家关闭后
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

/** 受托管项的固定键序（用于自检/面板展示；读写仍按实际枚举）。 */
export const MANAGED_KEYS = Object.freeze([
  "dim1", "dim2", "dim3", "dim4", "dim5", "dim6", "dim7", "dim8",
  "tickspeed", "dimboost", "galaxy", "sacrifice", "crunch", "ipmult",
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
  /** 存档身份（records.gameCreatedTime），仅用于诊断与换档复位。 */
  saveId: null,
  /** 统计：处理 tick 数 / 真实写入数 / 跳过项数。 */
  ticks: 0,
  writes: 0,
  skips: 0,
  lastTickAt: 0,
  lastRestored: [],
  lastReason: "",
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
  // 闸门二：原版自动购买器总开关。必须严格为 true。
  let vanillaOn = false;
  try {
    vanillaOn = typeof player !== "undefined" && player && player.auto &&
      player.auto.autobuyersOn === true;
  } catch (e) {
    vanillaOn = false;
  }
  if (!vanillaOn) {
    return { applied: false, reason: "vanilla-off", tick: resolvedTick, checked: 0, wrote: 0, restored: [] };
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
  const saveId = readSaveId();
  if (STATE.saveId !== null && saveId !== null && saveId !== STATE.saveId) {
    // 换存档：目标配置在本次 Tick 已按新档真实字段重算；这里只清诊断残留。
    STATE.lastRestored = [];
  }
  STATE.saveId = saveId;

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
  STATE.saveId = null;
  STATE.ticks = 0;
  STATE.writes = 0;
  STATE.skips = 0;
  STATE.lastTickAt = 0;
  STATE.lastRestored = [];
  STATE.lastReason = "";
}

try {
  globalThis.OrekiManagedAutobuyerState = {
    MANAGED_KEYS,
    MANAGED_FIELDS,
    reconcile,
    applyAll,
    describeManagedActive,
    debugState,
    resetForTest,
  };
} catch (e) {
  // 非浏览器环境忽略
}
