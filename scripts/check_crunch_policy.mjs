// [R96] 智能大坍缩决策（`src/core/oreki-crunch-policy.js`）定向回归。
//
// 为什么要有这个文件：
//   自动大坍缩的决定权从「固定节奏」改成了「按真实目标判断」，一旦某个分支写反、
//   或等待窗口没有上限，玩家的 IP / 永恒进度会被**静默冻结**（Android 端实测
//   IP 1e145 冻结 46 分钟）。这类缺陷靠肉眼读代码不可靠，必须逐分支执行真实源码。
//
// 做法：
//   **直接执行 `src/core/oreki-crunch-policy.js` 的真实源码**（Node `vm` 沙箱里只注入
//   原版全局 `player` / `Currency` / `InfinityDimension` / `Player` / `PlayerProgress`
//   / `gainedInfinityPoints` 与可控单调时钟），**不重写一份决策逻辑**。
//   `willInfinity` 的接入语义同样从 `big-crunch-autobuyer.js` 里切出真实 getter 体执行。
//
// 覆盖（≥ 12 项）：
//   · 7 条优先级的全部 reason 分支，以及「挑战优先于其它一切」的顺序
//   · 15 分钟 / 3 分钟等待上限的 低于 / 等于 / 高于 三个边界
//   · 放行后等待计时清零（不会把上一轮等待累计进下一轮）
//   · 判据异常 fail-closed（`exception:` 前缀 + 不放行）
//   · `ip-jump` 的 log10 比较（恰好 10 倍放行、9.9 倍等待）
//   · `willInfinity`：决策 deny → false；allow 后仍由原版三种模式判定
//
// 用法：node scripts/check_crunch_policy.mjs      （退出码 0 = 全过）
// 也由 scripts/check_crunch_modes.mjs 汇总调用。

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POLICY_PATH = path.join(ROOT, "src/core/oreki-crunch-policy.js");
const AUTOBUYER_PATH = path.join(ROOT, "src/core/autobuyers/big-crunch-autobuyer.js");

const POLICY_SRC = fs.readFileSync(POLICY_PATH, "utf-8");
const AUTOBUYER_SRC = fs.readFileSync(AUTOBUYER_PATH, "utf-8");

// ---------------------------------------------------------------- 真实源码装载
const CLASS_MARKER = "export class OrekiCrunchPolicy";

/** 把真实策略源码变成可在 vm 里执行的脚本（只做 ESM 语法外壳剥离，逻辑一行不改）。 */
function policyClassSource() {
  if (!POLICY_SRC.includes(CLASS_MARKER)) {
    throw new Error("策略源码结构变了：找不到 `export class OrekiCrunchPolicy`");
  }
  return `${POLICY_SRC.replace(CLASS_MARKER, "class OrekiCrunchPolicy")}
;globalThis.__OrekiCrunchPolicy = OrekiCrunchPolicy;`;
}

// ---------------------------------------------------------------- 数值夹具
// 只复刻策略真正用到的 Decimal 能力。用「10 的指数」表示，可覆盖 1e1100 这类
// 超出 Number 上限（约 1.8e308）的原版门槛；比较/乘法都在指数上做。
function dec(exponent) {
  return {
    __exp: exponent,
    log10() { return exponent; },
    gte(other) { return exponent >= exponentOf(other); },
    gt(other) { return exponent > exponentOf(other); },
    times(other) { return dec(exponent + exponentOf(other)); },
  };
}

function exponentOf(value) {
  if (typeof value === "number") return Math.log10(value);
  if (value && typeof value.__exp === "number") return value.__exp;
  throw new TypeError(`测试夹具不认识该数值类型: ${String(value)}`);
}

// ---------------------------------------------------------------- 运行沙箱
/**
 * 造一个「原版游戏状态 + 可控单调时钟」的沙箱，装载真实策略源码。
 *
 * cfg 字段（都可在测试中直接改，因为沙箱里全是 getter）：
 *   normalChallenge / infinityChallenge 挑战是否运行中
 *   broken            player.break
 *   infinityUnlocked  PlayerProgress.infinityUnlocked()（true = 已做过首次无限）
 *   eternityUnlocked  PlayerProgress.eternityUnlocked()（策略已不用它判永恒层，仅保留桩）
 *   eternitiesExponent    大永恒次数（10 的指数；-Infinity = 0）
 *   eternityPointsExponent 当前 EP（10 的指数；-Infinity = 0）
 *   eternityUpgradesBought 已购永恒升级数量（>0 也算已进入永恒层）
 *   canEternity       Player.canEternity
 *   lockedFrom        从第几层开始「未解锁」（1..8；9 = 8 层全解锁 → pending === null）
 *   maxAMExponent     player.records.thisEternity.maxAM（10 的指数）
 *   ipExponent        Currency.infinityPoints.value（10 的指数）
 *   gainedExponent    gainedInfinityPoints()（10 的指数）
 *   now               单调时钟当前毫秒
 *   missingGained     全局 gainedInfinityPoints 不存在（Android 侧对应「读不到」）
 *   throwOn           让指定判据抛错，验证 fail-closed
 */
function makeHarness(over = {}) {
  const cfg = {
    normalChallenge: false,
    infinityChallenge: false,
    broken: true,
    infinityUnlocked: true,
    eternityUnlocked: false,
    // 永恒层判定用（与 Android eternitiesZero() 三项同口径；-Infinity 表示数值 0）
    eternitiesExponent: -Infinity,
    eternityPointsExponent: -Infinity,
    eternityUpgradesBought: 0,
    canEternity: false,
    lockedFrom: 1,
    maxAMExponent: 0,
    ipExponent: 0,
    gainedExponent: 0,
    now: 0,
    missingGained: false,
    throwOn: null,
    ...over,
  };
  const clock = { t: cfg.now };
  const logs = [];
  const throwIf = name => {
    if (cfg.throwOn !== name) return;
    throw new TypeError(`注入异常：${name}`);
  };

  const dimensions = [null];
  for (let tier = 1; tier <= 8; tier += 1) {
    dimensions.push({
      get isUnlocked() { return tier < cfg.lockedFrom; },
      // 与 src/core/dimensions/infinity-dimension.js 的 UNLOCK_REQUIREMENTS 同形：ID1=1e1100，逐层抬高。
      amRequirement: dec(1100 + (tier - 1) * 300),
      ipRequirement: 1e8,
    });
  }

  const sandbox = {
    console: { info(message) { logs.push(String(message)); } },
    performance: { now: () => clock.t },
    NormalChallenge: { get isRunning() { return cfg.normalChallenge; } },
    InfinityChallenge: { get isRunning() { return cfg.infinityChallenge; } },
    player: {
      get break() { return cfg.broken; },
      // 与 Android `OrekiStageAuto.eternitiesZero()` 三项同口径（见策略 isInEternityLayer）。
      get eternities() { throwIf("eternities"); return dec(cfg.eternitiesExponent); },
      get eternityPoints() { throwIf("eternityPoints"); return dec(cfg.eternityPointsExponent); },
      get eternityUpgrades() {
        throwIf("eternityUpgrades");
        return { size: cfg.eternityUpgradesBought };
      },
      records: {
        thisEternity: {
          get maxAM() { throwIf("maxAM"); return dec(cfg.maxAMExponent); },
        },
      },
    },
    PlayerProgress: {
      // 原版 hasInfinity 口径：首次无限是否已完成（与 Android `!GameApi.hasInfinity()` 等价）。
      infinityUnlocked() { throwIf("infinityUnlocked"); return cfg.infinityUnlocked; },
      eternityUnlocked() { throwIf("eternityUnlocked"); return cfg.eternityUnlocked; },
    },
    Player: {
      get canEternity() { throwIf("canEternity"); return cfg.canEternity; },
    },
    Currency: {
      infinityPoints: {
        get value() { throwIf("ip"); return dec(cfg.ipExponent); },
      },
    },
    InfinityDimension(tier) { throwIf("infinityDimension"); return dimensions[tier]; },
    gainedInfinityPoints() { throwIf("gainedInfinityPoints"); return dec(cfg.gainedExponent); },
  };
  if (cfg.missingGained) sandbox.gainedInfinityPoints = undefined;

  const context = vm.createContext(sandbox);
  vm.runInContext(policyClassSource(), context, { filename: POLICY_PATH });
  const policy = context.__OrekiCrunchPolicy;
  return { cfg, clock, logs, policy, decide: () => policy.decide() };
}

// ---------------------------------------------------------------- willInfinity 接入
/** 从自动器真实源码里切出指定 getter 的**方法体**（大括号配平）。 */
function extractGetterBody(source, signature) {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`找不到 ${signature}（源码结构变了？）`);
  const open = source.indexOf("{", start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end < 0) throw new Error(`${signature} 的大括号不配平`);
  return source.slice(open + 1, end);
}

const AUTO_CRUNCH_MODE = { AMOUNT: 0, TIME: 1, X_HIGHEST: 2 };
const WILL_INFINITY_BODY = extractGetterBody(AUTOBUYER_SRC, "get willInfinity() {");
const willInfinityRunner = new Function(
  "player", "Player", "OrekiCrunchPolicy", "AUTO_CRUNCH_MODE", "gainedInfinityPoints", "Time",
  WILL_INFINITY_BODY,
);

function makeAutobuyerInstance(over = {}) {
  return {
    mode: AUTO_CRUNCH_MODE.X_HIGHEST,
    amount: dec(1),
    time: 0,
    highestPrevPrestige: dec(10),
    xHighest: dec(10),
    ...over,
  };
}

function runWillInfinity(instance, env) {
  return willInfinityRunner.call(
    instance, env.player, env.Player, env.OrekiCrunchPolicy, AUTO_CRUNCH_MODE,
    env.gainedInfinityPoints, env.Time,
  );
}

// ---------------------------------------------------------------- 断言集合
export function runCrunchPolicyChecks(check) {
  const d = decision => `${decision.allow}:${decision.reason}`;

  // ============================================================ 一、静态：规则与数值口径
  const REASONS = [
    "challenge-running", "pre-infinity", "pre-break-ip", "eternity-ready",
    "eternity-ip-jump", "eternity-grow", "id-peak-reached", "id-peak-wait",
    "id-ip-farm", "ip-jump", "gain-wait",
  ];
  const missingReasons = REASONS.filter(r => !POLICY_SRC.includes(`"${r}"`));
  check("静态：11 个决策 reason 全部存在（含 eternity-ip-jump / eternity-grow / ip-jump / gain-wait）",
    missingReasons.length === 0, `缺: ${missingReasons.join(",")}`);

  check("静态：等待上限常量与 Android 一致（15 分钟 900000 / 3 分钟 180000）",
    /PEAK_WAIT_LIMIT_MS\s*=\s*900000/.test(POLICY_SRC) &&
    /GAIN_WAIT_LIMIT_MS\s*=\s*180000/.test(POLICY_SRC));

  check("静态：峰值门槛取原版 amRequirement（修复了此前误用不存在的 id.requirement）",
    POLICY_SRC.includes("id.amRequirement") && !POLICY_SRC.includes("id.requirement"));

  check("静态：收益判据调用原版 gainedInfinityPoints()，且不 import game.js（避开 ESM 循环依赖）",
    POLICY_SRC.includes("gainedInfinityPoints()") && !POLICY_SRC.includes("../game.js"));

  check("静态：等待计时用单调时钟（performance.now 优先 / Date.now 兜底）",
    POLICY_SRC.includes("performance.now") && POLICY_SRC.includes("Date.now"));

  check("静态：优先级顺序——挑战 > 首次无限 > Break > 永恒层 > canEternity",
    POLICY_SRC.indexOf("NormalChallenge.isRunning") <
      POLICY_SRC.indexOf("PlayerProgress.infinityUnlocked()") &&
    POLICY_SRC.indexOf("PlayerProgress.infinityUnlocked()") < POLICY_SRC.indexOf("player.break") &&
    POLICY_SRC.indexOf("player.break") < POLICY_SRC.indexOf("this.isInEternityLayer()") &&
    POLICY_SRC.indexOf("this.isInEternityLayer()") < POLICY_SRC.indexOf("Player.canEternity"));

  check("静态：永恒层不再无条件放行（post-eternity 移除，改为 eternity-ip-jump / eternity-grow）",
    !POLICY_SRC.includes('"post-eternity"') &&
    POLICY_SRC.includes('"eternity-ip-jump"') && POLICY_SRC.includes('"eternity-grow"'));

  check("静态：永恒层等待上限与 Android 一致（10 分钟 = 600000 ms，走 waitWithin 墙钟）",
    /ETERNITY_GROW_WAIT_LIMIT_MS\s*=\s*600000/.test(POLICY_SRC) &&
    POLICY_SRC.includes('this.waitWithin("eternity-grow", ETERNITY_GROW_WAIT_LIMIT_MS)'));

  check("静态：永恒层没有 canEternity 放行（全文件仅首次永恒前一处），eternity-ready 只属于首次永恒前",
    POLICY_SRC.split("if (Player.canEternity) return").length - 1 === 1 &&
    POLICY_SRC.indexOf("if (Player.canEternity) return") >
      POLICY_SRC.indexOf("this.isInEternityLayer()") &&
    POLICY_SRC.split('reason: "eternity-ready"').length - 1 === 1 &&
    POLICY_SRC.indexOf('reason: "eternity-ready"') >
      POLICY_SRC.indexOf("this.isInEternityLayer()"));

  check("静态：永恒层判定用 EP/永恒次数/已购永恒升级三项（不用 reality 后恒真的 eternityUnlocked）",
    !POLICY_SRC.includes("if (PlayerProgress.eternityUnlocked())") &&
    POLICY_SRC.includes("player.eternities.gt(0)") &&
    POLICY_SRC.includes("player.eternityPoints.gt(0)") &&
    POLICY_SRC.includes("player.eternityUpgrades.size > 0"));

  // 与 Android 逐条同序的核心：ip-jump 必须在「等 ID 峰值」之前，否则峰值窗口会掐死 IP 增长。
  check("静态：ip-jump 判定排在 nextLockedDimension（等 ID 峰值）之前",
    POLICY_SRC.indexOf('this.gainVersusIp()') > 0 &&
    POLICY_SRC.indexOf('this.gainVersusIp()') < POLICY_SRC.indexOf("this.nextLockedDimension()") &&
    POLICY_SRC.indexOf('return { allow: true, reason: "ip-jump" }') <
      POLICY_SRC.indexOf("this.nextLockedDimension()"));

  check("静态：等待都有上限（id-peak-wait 走 15 分钟、gain-wait 走 3 分钟）",
    POLICY_SRC.includes('this.waitWithin("id-peak-wait", PEAK_WAIT_LIMIT_MS)') &&
    POLICY_SRC.includes('this.waitWithin("gain-wait", GAIN_WAIT_LIMIT_MS)'));

  // ============================================================ 二、优先级与放行分支
  {
    const h = makeHarness({ normalChallenge: true, broken: false, canEternity: true, lockedFrom: 9 });
    const decision = h.decide();
    check("分支：普通挑战运行中 → 放行 challenge-running（且优先于 Break/canEternity）",
      decision.allow === true && decision.reason === "challenge-running", d(decision));
  }
  {
    const h = makeHarness({ infinityChallenge: true, canEternity: true, lockedFrom: 9 });
    const decision = h.decide();
    check("分支：无限挑战运行中 → 放行 challenge-running",
      decision.allow === true && decision.reason === "challenge-running", d(decision));
  }
  {
    const h = makeHarness({ infinityUnlocked: false, broken: false, canEternity: true, lockedFrom: 1 });
    const decision = h.decide();
    check("分支：尚未完成首次无限 → 放行 pre-infinity（且优先于 Break/canEternity）",
      decision.allow === true && decision.reason === "pre-infinity", d(decision));
  }
  {
    const h = makeHarness({ broken: false, canEternity: true, lockedFrom: 1 });
    const decision = h.decide();
    check("分支：已无限但未 Break → 放行 pre-break-ip（且优先于 canEternity）",
      decision.allow === true && decision.reason === "pre-break-ip", d(decision));
  }
  // ---- [R96 第四轮] 永恒层（首次永恒后、膨胀前）：收益驱动，不再无条件放行 ----
  {
    // [R96 第四轮·反向断言] 永恒层里 canEternity 长期为真（maxIP 早已 ≥ 1.797e308），
    // 用它放行等于回到无条件坍缩。因此即使 canEternity 为真、收益不足，也必须阻止。
    const h = makeHarness({ eternityPointsExponent: 1, canEternity: true, gainedExponent: 0, ipExponent: 5 });
    const decision = h.decide();
    check("永恒层：canEternity 为真但收益不足 → 必须阻止 eternity-grow（不得放行）",
      decision.allow === false && decision.reason === "eternity-grow", d(decision));
  }
  {
    // 一次坍缩恰好让 IP 涨 10 倍（log10 差 = 1，边界相等）→ 放行 eternity-ip-jump。
    const h = makeHarness({ eternityPointsExponent: 1, gainedExponent: 6, ipExponent: 5 });
    const decision = h.decide();
    check("永恒层：一次坍缩恰好 ≥10 倍 IP → 放行 eternity-ip-jump",
      decision.allow === true && decision.reason === "eternity-ip-jump", d(decision));
  }
  {
    // 9.9 倍（log10 差 ≈ 0.9956 < 1）→ 不放行，按 eternity-grow 等待。
    const h = makeHarness({
      eternityPointsExponent: 1, gainedExponent: Math.log10(9.9e5), ipExponent: 5,
    });
    const decision = h.decide();
    check("永恒层：9.9 倍（log10 差 < 1）→ 阻止 eternity-grow",
      decision.allow === false && decision.reason === "eternity-grow", d(decision));
  }
  {
    // 收益不足时不再无条件放行：即使有未解锁 ID 且峰值已达标，也必须先按住让维度成长。
    const h = makeHarness({
      eternityPointsExponent: 1, gainedExponent: 5, ipExponent: 5,
      lockedFrom: 1, maxAMExponent: 1100,
    });
    const decision = h.decide();
    check("永恒层：收益不足 → 阻止 eternity-grow（不再走 id-peak-reached 无条件放行）",
      decision.allow === false && decision.reason === "eternity-grow", d(decision));
  }
  {
    // 10 分钟墙钟上限：599999 仍阻止、满 600000 放行一次（stall-eternity-grow），之后重新计时。
    const h = makeHarness({ eternityPointsExponent: 1, gainedExponent: 5, ipExponent: 5 });
    const first = h.decide();
    h.clock.t = 599999;
    const beforeLimit = h.decide();
    h.clock.t = 600000;
    const atLimit = h.decide();
    const reenter = h.decide();
    check("永恒层：等待 599999 ms 仍阻止（eternity-grow）",
      first.reason === "eternity-grow" && beforeLimit.allow === false &&
      beforeLimit.reason === "eternity-grow", d(beforeLimit));
    check("永恒层：等待满 600000 ms（10 分钟）→ 放行 stall-eternity-grow",
      atLimit.allow === true && atLimit.reason === "stall-eternity-grow", d(atLimit));
    check("永恒层：放行一次后重新计时（不会连续放行）",
      reenter.allow === false && reenter.reason === "eternity-grow", d(reenter));
  }
  {
    // 大永恒次数 > 0 / 已购永恒升级 > 0 也算永恒层（与 Android eternitiesZero() 三项口径一致）。
    const byEternities = makeHarness({
      eternitiesExponent: 1, gainedExponent: 5, ipExponent: 5,
    }).decide();
    check("永恒层：大永恒次数 > 0 也判为永恒层",
      byEternities.allow === false && byEternities.reason === "eternity-grow", d(byEternities));
    const byUpgrades = makeHarness({
      eternityUpgradesBought: 1, gainedExponent: 5, ipExponent: 5,
    }).decide();
    check("永恒层：已购永恒升级 > 0 也判为永恒层",
      byUpgrades.allow === false && byUpgrades.reason === "eternity-grow", d(byUpgrades));
  }
  {
    // 现实重置后：realities>0（eternityUnlocked 恒真）但 EP / 永恒次数 / 升级已清零
    // → 必须回到「首次永恒前」分支，不能误入永恒层（Android `eternitiesZero()` 同口径）。
    const h = makeHarness({ eternityUnlocked: true, canEternity: true, gainedExponent: 0, ipExponent: 5 });
    const decision = h.decide();
    check("永恒层：现实重置后（eternityUnlocked=true 但 EP/永恒次数/升级清零）→ 走首次永恒前分支",
      decision.allow === true && decision.reason === "eternity-ready", d(decision));
  }
  {
    const h = makeHarness({ canEternity: true, lockedFrom: 1, maxAMExponent: 0, ipExponent: 0 });
    const decision = h.decide();
    check("首次永恒前：本永恒 maxIP 已达永恒门槛 → 放行 eternity-ready",
      decision.allow === true && decision.reason === "eternity-ready", d(decision));
  }
  {
    // ID1 峰值门槛 = 1e1100：等于 / 高于都放行，低于则进入等待（阈值三边界）。
    const atPeak = makeHarness({ lockedFrom: 1, maxAMExponent: 1100 }).decide();
    check("分支：反物质峰值恰好等于门槛 → 放行 id-peak-reached",
      atPeak.allow === true && atPeak.reason === "id-peak-reached", d(atPeak));
    const abovePeak = makeHarness({ lockedFrom: 1, maxAMExponent: 1101 }).decide();
    check("分支：反物质峰值高于门槛 → 放行 id-peak-reached",
      abovePeak.allow === true && abovePeak.reason === "id-peak-reached", d(abovePeak));
  }
  {
    // IP = 1e8 = ID1 的 ipRequirement：等于即「IP 已够」，低于则继续攒 IP。
    const ipEnough = makeHarness({ lockedFrom: 1, maxAMExponent: 1099, ipExponent: 8 }).decide();
    check("分支：IP 恰好等于门槛、峰值未达 → 阻止 id-peak-wait",
      ipEnough.allow === false && ipEnough.reason === "id-peak-wait", d(ipEnough));
    const ipAbove = makeHarness({ lockedFrom: 1, maxAMExponent: 1099, ipExponent: 9 }).decide();
    check("分支：IP 高于门槛、峰值未达 → 阻止 id-peak-wait",
      ipAbove.allow === false && ipAbove.reason === "id-peak-wait", d(ipAbove));
    const ipBelow = makeHarness({ lockedFrom: 1, maxAMExponent: 1099, ipExponent: 7 }).decide();
    check("分支：IP 低于门槛 → 放行 id-ip-farm（继续攒 IP）",
      ipBelow.allow === true && ipBelow.reason === "id-ip-farm", d(ipBelow));
  }

  {
    // [R96 顺序对齐] 有未解锁 ID、峰值未到、IP 也已够时，仍然「收益 ≥ 10 倍」优先放行：
    // 否则 ID6→ID7 的峰值窗口（实测 1.7 小时）会把 IP 增长完全掐死。
    const jumpFirst = makeHarness({
      lockedFrom: 1, maxAMExponent: 1099, ipExponent: 8, gainedExponent: 9,
    }).decide();
    check("顺序：pending≠null 且收益恰好 10 倍 → 放行 ip-jump（优先于 id-peak-wait）",
      jumpFirst.allow === true && jumpFirst.reason === "ip-jump", d(jumpFirst));

    const notEnough = makeHarness({
      lockedFrom: 1, maxAMExponent: 1099, ipExponent: 8, gainedExponent: Math.log10(9.9e8),
    }).decide();
    check("顺序：pending≠null 且收益 9.9 倍 → 仍按 id-peak-wait 阻止（不误放行）",
      notEnough.allow === false && notEnough.reason === "id-peak-wait", d(notEnough));

    // IP 还没到 ipRequirement（否则会走 id-ip-farm）时，10 倍收益同样优先放行。
    const jumpBeforeFarm = makeHarness({
      lockedFrom: 1, maxAMExponent: 1099, ipExponent: 7, gainedExponent: 8.5,
    }).decide();
    check("顺序：pending≠null、IP 未达门槛、收益 10+ 倍 → 放行 ip-jump（优先于 id-ip-farm）",
      jumpBeforeFarm.allow === true && jumpBeforeFarm.reason === "ip-jump", d(jumpBeforeFarm));
  }

  // ============================================================ 三、等待上限（真实墙钟）
  {
    const h = makeHarness({ lockedFrom: 1, maxAMExponent: 1099, ipExponent: 8 });
    const first = h.decide();
    h.clock.t = 899999;
    const beforeLimit = h.decide();
    h.clock.t = 900000;
    const atLimit = h.decide();
    check("上限：ID 峰值等待 899999 ms 仍阻止（id-peak-wait）",
      first.reason === "id-peak-wait" && beforeLimit.allow === false &&
      beforeLimit.reason === "id-peak-wait", d(beforeLimit));
    check("上限：ID 峰值等待满 900000 ms → 放行 stall-id-peak-wait",
      atLimit.allow === true && atLimit.reason === "stall-id-peak-wait", d(atLimit));
    // 放行后重新计时：再次立即进入等待，不应沿用上一轮已到期的计时。
    const reenter = h.decide();
    check("上限：放行一次后立即允许重新等待（不会连续放行）",
      reenter.allow === false && reenter.reason === "id-peak-wait", d(reenter));
  }
  {
    const h = makeHarness({ lockedFrom: 9, gainedExponent: 10, ipExponent: 10 });
    const first = h.decide();
    h.clock.t = 179999;
    const beforeLimit = h.decide();
    h.clock.t = 180000;
    const atLimit = h.decide();
    check("上限：收益等待 179999 ms 仍阻止（gain-wait）",
      first.reason === "gain-wait" && beforeLimit.allow === false &&
      beforeLimit.reason === "gain-wait", d(beforeLimit));
    check("上限：收益等待满 180000 ms → 放行 stall-gain-wait",
      atLimit.allow === true && atLimit.reason === "stall-gain-wait", d(atLimit));
  }
  {
    // 放行后计时清零：先等 10 分钟，再放行一次，然后重新等待；
    // 若计时没清零，第二轮会在 900000 ms 之前就被上一轮的累计误放行。
    const h = makeHarness({ lockedFrom: 1, maxAMExponent: 1099, ipExponent: 8 });
    h.decide();                          // t=0 开始等待
    h.clock.t = 600000;
    const stillWaiting = h.decide();     // 已等 10 分钟，仍阻止
    h.cfg.canEternity = true;
    const allowed = h.decide();          // 放行 → 等待计时清零
    h.cfg.canEternity = false;
    h.clock.t = 600001;
    const secondRound = h.decide();      // 第二轮从 600001 重新计时
    h.clock.t = 600001 + 899999;
    const secondRoundBefore = h.decide();
    h.clock.t = 600001 + 900000;
    const secondRoundAt = h.decide();
    check("计时：放行后连续等待时长清零（不会把上一轮累计到下一轮）",
      stillWaiting.reason === "id-peak-wait" && allowed.reason === "eternity-ready" &&
      secondRound.reason === "id-peak-wait" && secondRoundBefore.allow === false &&
      secondRoundAt.allow === true && secondRoundAt.reason === "stall-id-peak-wait",
      `${d(stillWaiting)} / ${d(allowed)} / ${d(secondRound)} / ${d(secondRoundBefore)} / ${d(secondRoundAt)}`);
  }

  // ============================================================ 四、ip-jump 的 log10 边界
  {
    // 一次坍缩恰好让 IP 涨 10 倍：log10(1e11) - log10(1e10) = 1 → 放行（等于边界）。
    const tenTimes = makeHarness({ lockedFrom: 9, gainedExponent: 11, ipExponent: 10 }).decide();
    check("收益：恰好 10 倍（log10 差 = 1）→ 放行 ip-jump",
      tenTimes.allow === true && tenTimes.reason === "ip-jump", d(tenTimes));
    // 9.9 倍：log10 差 ≈ 0.9956 < 1 → 等待。
    const almost = makeHarness({
      lockedFrom: 9, gainedExponent: Math.log10(9.9e10), ipExponent: 10,
    }).decide();
    check("收益：9.9 倍（log10 差 < 1）→ 阻止 gain-wait",
      almost.allow === false && almost.reason === "gain-wait", d(almost));
    // 1 倍（几乎没有收益）也必须等待，不能靠「有收益就坍缩」。
    const same = makeHarness({ lockedFrom: 9, gainedExponent: 10, ipExponent: 10 }).decide();
    check("收益：1 倍（log10 差 = 0）→ 阻止 gain-wait",
      same.allow === false && same.reason === "gain-wait", d(same));
    const huge = makeHarness({ lockedFrom: 9, gainedExponent: 100, ipExponent: 10 }).decide();
    check("收益：90 个数量级 → 放行 ip-jump",
      huge.allow === true && huge.reason === "ip-jump", d(huge));
  }

  // ============================================================ 五、节流日志（保留既有行为）
  {
    const h = makeHarness({ broken: false });
    h.decide(); h.decide(); h.decide();
    check("日志：同一决策重复调用只打印一次（throttleLog 状态翻转才打印）",
      h.logs.length === 1, `logs=${h.logs.length}`);
    h.cfg.broken = true;
    h.cfg.eternityPointsExponent = 1;   // 决策从 pre-break-ip 翻转为 eternity-grow
    h.decide();
    check("日志：决策状态翻转时重新打印",
      h.logs.length === 2, `logs=${h.logs.length}`);
  }

  // ============================================================ 六、异常 fail-closed
  for (const [label, over] of [
    ["PlayerProgress.infinityUnlocked() 抛错", { throwOn: "infinityUnlocked" }],
    ["player.eternities 抛错", { throwOn: "eternities" }],
    ["player.eternityPoints 抛错", { throwOn: "eternityPoints" }],
    ["player.eternityUpgrades 抛错", { throwOn: "eternityUpgrades" }],
    ["Player.canEternity 抛错", { throwOn: "canEternity" }],
    ["thisEternity.maxAM 抛错", { throwOn: "maxAM", maxAMExponent: 1099, ipExponent: 9 }],
    ["InfinityDimension 抛错", { throwOn: "infinityDimension" }],
    ["gainedInfinityPoints() 抛错", { throwOn: "gainedInfinityPoints", lockedFrom: 9 }],
  ]) {
    const decision = makeHarness(over).decide();
    check(`异常：${label} → fail-closed 阻止且 reason 以 exception: 开头`,
      decision.allow === false && decision.reason === "exception:TypeError", d(decision));
  }
  {
    // 收益判据「读不到」（全局函数不存在）与 Android 的 null 分支同义：
    // 不放行，走 gain-wait 的 3 分钟上限兜底，而不是永久 exception 阻止。
    const decision = makeHarness({ lockedFrom: 9, missingGained: true }).decide();
    check("异常：收益判据读不到 → 按「收益不够」处理（gain-wait，不误伤为永久阻止）",
      decision.allow === false && decision.reason === "gain-wait", d(decision));
  }

  // ============================================================ 七、willInfinity 接入语义
  {
    // 用真实策略给出 deny（ID1 峰值等待），策略下的收益再大也不允许坍缩。
    const h = makeHarness({ lockedFrom: 1, maxAMExponent: 1099, ipExponent: 8 });
    const env = {
      player: { break: true },
      Player: { isInAntimatterChallenge: false },
      OrekiCrunchPolicy: h.policy,
      gainedInfinityPoints: () => dec(200),
      Time: { thisInfinityRealTime: { totalSeconds: 9999 } },
    };
    const instance = makeAutobuyerInstance({ mode: AUTO_CRUNCH_MODE.X_HIGHEST });
    check("接入：决策 deny → willInfinity 返回 false（即使单次收益远超 10× 最高）",
      runWillInfinity(instance, env) === false);

    const timeInstance = makeAutobuyerInstance({ mode: AUTO_CRUNCH_MODE.TIME, time: 1 });
    check("接入：决策 deny → TIME 模式到点也返回 false",
      runWillInfinity(timeInstance, env) === false);

    // 未 Break 时原版语义优先：willInfinity 恒为 true（与策略无关）。
    const preBreakEnv = { ...env, player: { break: false } };
    check("接入：未 Break 时 willInfinity 仍恒为 true（原版语义不变）",
      runWillInfinity(instance, preBreakEnv) === true);

    // 决策 allow 后，仍由原版三种模式判定：X_HIGHEST 满足才坍缩。
    const allowH = makeHarness({ lockedFrom: 9, gainedExponent: 100, ipExponent: 10 });
    const allowEnv = {
      ...env,
      OrekiCrunchPolicy: allowH.policy,
      gainedInfinityPoints: () => dec(100),
      Time: { thisInfinityRealTime: { totalSeconds: 10 } },
    };
    check("接入：决策 allow + X_HIGHEST 收益达标 → willInfinity 返回 true",
      runWillInfinity(makeAutobuyerInstance({ mode: AUTO_CRUNCH_MODE.X_HIGHEST }), allowEnv) === true);
    check("接入：决策 allow + X_HIGHEST 收益不达标 → 仍返回 false（原版阈值照样生效）",
      runWillInfinity(makeAutobuyerInstance({
        mode: AUTO_CRUNCH_MODE.X_HIGHEST, highestPrevPrestige: dec(200), xHighest: dec(10),
      }), allowEnv) === false);
    check("接入：决策 allow + TIME 模式到点 → willInfinity 返回 true",
      runWillInfinity(makeAutobuyerInstance({
        mode: AUTO_CRUNCH_MODE.TIME, time: 5,
      }), allowEnv) === true);
  }
}

// ---------------------------------------------------------------- ESM 集成自检
/**
 * 用**真实 ESM import**（不是 vm 切源码）装载策略模块，确认：
 * 1) 模块自身没有语法 / 导出问题；
 * 2) 它只依赖原版全局（`player` / `Currency` / ...），没有 `import game.js`
 *    → 不存在 `game.js → autobuyers → big-crunch-autobuyer → oreki-crunch-policy → game.js`
 *    的循环依赖；
 * 3) 导出类可以直接决策。
 * 全局在结束后恢复，不影响其它检查。
 */
export async function runCrunchPolicyModuleLoadCheck(check) {
  const stubs = {
    player: {
      break: true,
      records: { thisEternity: { maxAM: { gte: () => false } } },
      eternities: { gt: () => false },
      eternityPoints: { gt: () => false },
      eternityUpgrades: { size: 0 },
    },
    NormalChallenge: { isRunning: false },
    InfinityChallenge: { isRunning: false },
    PlayerProgress: { infinityUnlocked: () => true, eternityUnlocked: () => false },
    Player: { canEternity: true },
    Currency: { infinityPoints: { value: { gte: () => false } } },
    InfinityDimension: () => ({ isUnlocked: false, amRequirement: {}, ipRequirement: 1e8 }),
    gainedInfinityPoints: () => ({ log10: () => 10 }),
  };
  const saved = new Map();
  for (const [key, value] of Object.entries(stubs)) {
    saved.set(key, Object.prototype.hasOwnProperty.call(globalThis, key) ? globalThis[key] : undefined);
    globalThis[key] = value;
  }
  // 模块会按真实行为打印一次状态翻转日志，这里静音以保持测试输出干净。
  const originalInfo = console.info;
  console.info = () => {};
  try {
    const module = await import(pathToFileURL(POLICY_PATH).href);
    const decision = module.OrekiCrunchPolicy.decide();
    check("ESM：真实模块可 import（无循环依赖/语法问题），导出类可直接决策",
      typeof module.OrekiCrunchPolicy === "function" &&
      decision.allow === true && decision.reason === "eternity-ready",
      `${decision.allow}:${decision.reason}`);
  } finally {
    console.info = originalInfo;
    for (const [key, value] of saved) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
}

// ---------------------------------------------------------------- 直接运行
async function runStandalone() {
  let checks = 0;
  const failures = [];
  const check = (name, ok, detail = "") => {
    checks += 1;
    if (!ok) failures.push(detail ? `${name}  ← ${detail}` : name);
  };
  runCrunchPolicyChecks(check);
  await runCrunchPolicyModuleLoadCheck(check);
  console.log(`\n智能大坍缩决策回归：${checks} 项检查，失败 ${failures.length} 项`);
  if (failures.length) {
    for (const failure of failures) console.log("  FAIL", failure);
    process.exitCode = 1;
    return;
  }
  console.log("  全部通过");
}

const invokedDirectly = Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) await runStandalone();
