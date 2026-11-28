/**
 * AD: Oreki Edition — 全局游戏速度系统
 *
 * 速度只有两种互斥模式：
 * - stage：按真实游戏状态选择 Break 前 500×、Break 后 70×、首次 Reality 后 3000×。
 *   阶段切换与智能自动操作总开关完全解耦。
 * - manual：固定使用玩家保存的 1×～100000× 倍率。
 *
 * 速度保存在 localStorage，不写入游戏存档。旧版本曾同时保存
 * `oreki-game-speed-stage-managed`、`oreki-game-speed-dynamic` 和
 * `oreki-game-speed-stage`；加载时只迁移一次，然后写入新的 mode 键。
 * 旧手动倍率不会被升级覆盖。
 */

const STORAGE_KEY = "oreki-game-speed";
const MODE_KEY = "oreki-game-speed-mode";
const MANUAL_KEY = "oreki-game-speed-manual";
const LEGACY_STAGE_MANAGED_KEY = "oreki-game-speed-stage-managed";
const LEGACY_DYNAMIC_KEY = "oreki-game-speed-dynamic";
const LEGACY_STAGE_KEY = "oreki-game-speed-stage";
const AUTOBUYER_SCALE_KEY = "oreki-autobuyer-interval-scale";
const TICKSPEED_SCALE_KEY = "oreki-tickspeed-autobuyer-interval-scale";

export const SPEED_MODE_STAGE = "stage";
export const SPEED_MODE_MANUAL = "manual";

export const GAME_SPEED_DEFAULT = 500;
export const GAME_SPEED_POST_BREAK = 70;
export const GAME_SPEED_POST_REALITY = 3000;
export const GAME_SPEED_MIN = 1;
export const GAME_SPEED_MAX = 100000;

const MAX_REASON = "上限 100000×：更高倍率不会让离散机制（自动购买器、离线模拟）跟上，只会放大计时失真";

function target_player() {
  return (typeof window !== "undefined" && window.player) ? window.player : null;
}

function positive(value) {
  if (typeof value === "number") return value > 0;
  if (value && typeof value.gt === "function") return value.gt(0);
  if (value && typeof value.toNumber === "function") return value.toNumber() > 0;
  return false;
}

export function parseSpeedFactor(input) {
  if (input === null || input === undefined) {
    return { ok: false, value: GAME_SPEED_DEFAULT, message: "请输入一个数字" };
  }
  const text = String(input).trim().replace(/[×xX*]\s*/gu, "").replace(/,/gu, "");
  if (text === "") return { ok: false, value: GAME_SPEED_DEFAULT, message: "请输入一个数字" };
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/u.test(text)) {
    return { ok: false, value: GAME_SPEED_DEFAULT, message: "格式无效：请输入普通数字，例如 1000" };
  }
  const value = Number(text);
  if (!Number.isFinite(value)) {
    return { ok: false, value: GAME_SPEED_DEFAULT, message: "数值无效（不允许 NaN / Infinity）" };
  }
  if (value <= 0) return { ok: false, value: GAME_SPEED_DEFAULT, message: "倍率必须大于 0" };
  if (value < GAME_SPEED_MIN) {
    return { ok: false, value: GAME_SPEED_MIN, message: `倍率不能低于 ${GAME_SPEED_MIN}×` };
  }
  if (value > GAME_SPEED_MAX) {
    return { ok: false, value: GAME_SPEED_MAX, message: `倍率不能高于 ${GAME_SPEED_MAX}×（${MAX_REASON}）` };
  }
  return { ok: true, value, message: "" };
}

function storageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function storageSet(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
    return true;
  } catch (e) {
    return false;
  }
}

function storageRemove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (e) { /* 存储不可用时只影响迁移持久化 */ }
}

function readStoredFactor(key) {
  const raw = storageGet(key);
  if (raw === null) return null;
  const parsed = parseSpeedFactor(raw);
  return parsed.ok ? parsed.value : null;
}

function readStoredFlag(key, fallback = false) {
  const raw = storageGet(key);
  return raw === null ? fallback : raw === "1";
}

function readStoredMode() {
  const raw = storageGet(MODE_KEY);
  return raw === SPEED_MODE_STAGE || raw === SPEED_MODE_MANUAL ? raw : null;
}

function progressionStageForState(broken, realities) {
  if (positive(realities)) return "post-reality";
  return broken === true ? "post-break" : "pre-break";
}

function progressionSpeedForStage(stage) {
  if (stage === "post-reality") return GAME_SPEED_POST_REALITY;
  return stage === "post-break" ? GAME_SPEED_POST_BREAK : GAME_SPEED_DEFAULT;
}

function progressionStageForPlayer() {
  const p = target_player();
  return p ? progressionStageForState(p.break === true, p.realities) : "pre-break";
}

export function progressionSpeedForState(broken, realities) {
  return progressionSpeedForStage(progressionStageForState(broken, realities));
}

function migrateLegacyMode(effectiveStored, manualStored) {
  const existing = readStoredMode();
  if (existing !== null) return existing;

  const legacyManagedRaw = storageGet(LEGACY_STAGE_MANAGED_KEY);
  const legacyDynamicRaw = storageGet(LEGACY_DYNAMIC_KEY);
  let mode;
  if (legacyManagedRaw !== null) {
    mode = legacyManagedRaw === "1" ? SPEED_MODE_STAGE : SPEED_MODE_MANUAL;
  } else if (legacyDynamicRaw !== null) {
    // 旧版本没有 stage-managed 键时，dynamic 默认开启；旧默认实际是自动速度。
    mode = legacyDynamicRaw === "1" ? SPEED_MODE_STAGE : SPEED_MODE_MANUAL;
  } else if (effectiveStored !== null && manualStored === null) {
    // 旧版有明确自定义值但没有托管键：保留它作为手动倍率。
    mode = SPEED_MODE_MANUAL;
  } else {
    mode = SPEED_MODE_STAGE;
  }
  storageSet(MODE_KEY, mode);
  storageRemove(LEGACY_STAGE_MANAGED_KEY);
  storageRemove(LEGACY_DYNAMIC_KEY);
  storageRemove(LEGACY_STAGE_KEY);
  return mode;
}

const storedEffective = readStoredFactor(STORAGE_KEY);
const storedManual = readStoredFactor(MANUAL_KEY);
const initialMode = migrateLegacyMode(storedEffective, storedManual);
let speedMode = initialMode;
let manualFactor = storedManual ?? storedEffective ?? GAME_SPEED_DEFAULT;
let currentFactor = initialMode === SPEED_MODE_STAGE
  ? progressionSpeedForStage(progressionStageForPlayer())
  : manualFactor;

// 新键第一次建立后立即持久化，刷新不重新猜测模式。
if (readStoredFactor(STORAGE_KEY) === null) storageSet(STORAGE_KEY, currentFactor);
if (readStoredFactor(MANUAL_KEY) === null) storageSet(MANUAL_KEY, manualFactor);
if (readStoredMode() === null) storageSet(MODE_KEY, speedMode);

let autobuyerIntervalScaling = readStoredFlag(AUTOBUYER_SCALE_KEY);
let tickspeedIntervalScaling = readStoredFlag(TICKSPEED_SCALE_KEY);
let simulationToken = null;
let lastProgressionStage = progressionStageForPlayer();

function persistMode() {
  return storageSet(MODE_KEY, speedMode);
}

function persistManualFactor() {
  return storageSet(MANUAL_KEY, manualFactor);
}

function persistEffectiveFactor() {
  return storageSet(STORAGE_KEY, currentFactor);
}

function setMode(mode) {
  speedMode = mode === SPEED_MODE_MANUAL ? SPEED_MODE_MANUAL : SPEED_MODE_STAGE;
  persistMode();
  if (speedMode === SPEED_MODE_STAGE) {
    lastProgressionStage = progressionStageForPlayer();
    currentFactor = progressionSpeedForStage(lastProgressionStage);
  } else {
    currentFactor = manualFactor;
  }
  persistEffectiveFactor();
  return { ok: true, mode: speedMode, value: currentFactor, persisted: persistMode() };
}

export const GameSpeed = {
  get storageKey() { return STORAGE_KEY; },
  get modeStorageKey() { return MODE_KEY; },
  get manualStorageKey() { return MANUAL_KEY; },
  get min() { return GAME_SPEED_MIN; },
  get max() { return GAME_SPEED_MAX; },
  get defaultFactor() { return GAME_SPEED_DEFAULT; },
  get postBreakFactor() { return GAME_SPEED_POST_BREAK; },
  get postRealityFactor() { return GAME_SPEED_POST_REALITY; },
  get mode() { return speedMode; },
  get isStageManaged() { return speedMode === SPEED_MODE_STAGE; },
  get isManual() { return speedMode === SPEED_MODE_MANUAL; },
  get manualFactor() { return manualFactor; },
  get factor() { return currentFactor; },
  get effectiveFactor() { return simulationToken === null ? currentFactor : simulationToken.factor; },
  get isSimulationLocked() { return simulationToken !== null; },
  get modeLabel() {
    return speedMode === SPEED_MODE_STAGE
      ? `阶段自动（当前 ${this.format(this.factor)}×）`
      : `手动固定（${this.format(this.factor)}×）`;
  },
  /** 诊断/测试：真实玩家对象的只读阶段输入。 */
  get progressionState() {
    const p = target_player();
    return {
      break: p?.break === true,
      realities: p?.realities?.toString?.() ?? p?.realities ?? null,
    };
  },

  get scaleAutobuyerInterval() { return autobuyerIntervalScaling; },
  setScaleAutobuyerInterval(value) {
    autobuyerIntervalScaling = !!value;
    storageSet(AUTOBUYER_SCALE_KEY, autobuyerIntervalScaling ? "1" : "0");
    return autobuyerIntervalScaling;
  },
  get autobuyerScaleStorageKey() { return AUTOBUYER_SCALE_KEY; },

  get scaleTickspeedAutobuyerInterval() { return tickspeedIntervalScaling; },
  setScaleTickspeedAutobuyerInterval(value) {
    tickspeedIntervalScaling = !!value;
    storageSet(TICKSPEED_SCALE_KEY, tickspeedIntervalScaling ? "1" : "0");
    return tickspeedIntervalScaling;
  },
  get tickspeedAutobuyerScaleStorageKey() { return TICKSPEED_SCALE_KEY; },

  setStageMode() {
    return setMode(SPEED_MODE_STAGE);
  },

  setManualMode() {
    return setMode(SPEED_MODE_MANUAL);
  },

  /** 仅在真实 Break/Reality 阶段变化时应用一次阶段倍率。 */
  tickProgressionSpeed() {
    if (speedMode !== SPEED_MODE_STAGE || simulationToken !== null) return false;
    const p = target_player();
    if (!p) return false;
    const stage = progressionStageForState(p.break === true, p.realities);
    if (stage === lastProgressionStage) return false;
    lastProgressionStage = stage;
    const next = progressionSpeedForStage(stage);
    if (currentFactor === next) return false;
    currentFactor = next;
    persistEffectiveFactor();
    return true;
  },

  /** 应用手动倍率；成功即切换为 manual，并保留该倍率。 */
  set(input) {
    const result = parseSpeedFactor(input);
    if (!result.ok) return result;
    speedMode = SPEED_MODE_MANUAL;
    manualFactor = result.value;
    currentFactor = result.value;
    const persisted = persistMode() && persistManualFactor() && persistEffectiveFactor();
    return {
      ok: true,
      mode: speedMode,
      value: result.value,
      persisted,
      message: persisted ? "" : "已生效，但浏览器拒绝写入本地存储，刷新后可能恢复上次设置",
    };
  },

  /** 恢复阶段模式，并按当前真实 Break/Reality 状态立即计算倍率。 */
  resetDefault() {
    const result = setMode(SPEED_MODE_STAGE);
    return {
      ...result,
      message: result.persisted ? "" : "已生效，但浏览器拒绝写入本地存储，刷新后可能恢复上次设置",
    };
  },

  beginSimulation() {
    simulationToken = { factor: currentFactor };
    return simulationToken;
  },

  endSimulation(token) {
    if (token !== undefined && token !== null && simulationToken !== token) return;
    simulationToken = null;
  },

  format(value = this.factor) {
    if (Number.isInteger(value)) return String(value);
    return String(Math.round(value * 100) / 100);
  }
};

export function installSpeedGlobals(target = window) {
  target.GameSpeed = GameSpeed;
  target.OrekiSpeed = GameSpeed;
  target.getGlobalSpeedFactorRaw = () => GameSpeed.effectiveFactor;
  target.getGlobalSpeedFactor = () => GameSpeed.effectiveFactor;
  Object.defineProperty(target, "globalSpeedFactor", {
    configurable: true,
    get: () => GameSpeed.factor
  });
  try {
    if (!target.__orekiSpeedStageTimer) {
      const schedule = typeof target.setInterval === "function"
        ? target.setInterval.bind(target)
        : setInterval;
      target.__orekiSpeedStageTimer = schedule(() => {
        try {
          GameSpeed.tickProgressionSpeed();
        } catch (e) { /* 阶段控制器异常不得影响主循环 */ }
      }, 1000);
    }
  } catch (e) { /* 非浏览器环境忽略 */ }
  return GameSpeed;
}

installSpeedGlobals();
