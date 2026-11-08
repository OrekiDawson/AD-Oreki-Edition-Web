#!/usr/bin/env node
/**
 * R94 Web「首次无限 → 首次永恒」ID1 峰值窗口定向夹具（Node 直跑，无需浏览器）。
 *
 * 背景（上一轮源码定位）：
 *   `src/core/autobuyers/big-crunch-autobuyer.js` 的 `waitingForId1Peak`（:170-186）
 *   在「已 Break + ID1 未解锁 + IP ≥ 1e8 + 本纪 maxAM < 1e1100」时让 `willInfinity`
 *   （:144）返回 false ⇒ 自动大坍缩暂停，等本纪反物质峰值爬到 ID1 的反物质门槛
 *   （`infinity-dimension.js:41-59 / 87-102`）。本轮要回答的是**这个窗口能不能安全提速**。
 *
 * 本夹具分四组，回答四个问题（全部直接读生产源码/真实 getter，不复刻逻辑）：
 *   组 1：窗口的进入/释放条件是否与 ID1 的真实门槛同源（阈值漂移就失败）。
 *   组 2：`willInfinity` 在窗口内是否真的拦住坍缩（收益不足时），达到门槛/解锁后是否
 *         真的恢复；R96 起策略的 ip-jump 优先于峰值等待，收益 ≥10× 时窗口内也会放行（4b）。
 *   组 3：窗口是否**可终止且无旁路**——峰值指标是否连续更新、是否有别的 MOD 路径
 *         在窗口内强制坍缩（新增旁路会让测试失败）。
 *   组 4：量化窗口的墙钟上界——窗口内的反物质峰值爬升由原版自动购买器承担，
 *         其 effectiveInterval = interval / F（高倍率下每帧都能触发），
 *         受节拍限制的只有「解锁并买 ID1」与「触发首次永恒」两个真动作。
 *
 * 用法：node scripts/test-r94-id1-peak-window.mjs
 * 退出码 0 = 全部通过；任一断言失败即非 0，并打印失败项。
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB = join(__dirname, "..");
const readSrc = rel => readFileSync(join(WEB, rel), "utf-8");

let passed = 0;
const failures = [];
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`PASS  ${name}`);
  } catch (error) {
    failures.push(`${name}: ${(error && error.message) || error}`);
    console.log(`FAIL  ${name} —— ${(error && error.message) || error}`);
  }
}

// ------------------------------------------------------------------ 数值替身
// 只实现被测代码用到的比较/运算。必须按**指数**建模：本项目会出现 1e1100 级别，
// 直接用 JS number 会被压成 Infinity，让 `maxAM < 1e1100` 恒为 false。
class Big {
  constructor(value) {
    this.exp = Big.toExp(value);
  }
  static fromExp(exp) {
    const instance = Object.create(Big.prototype);
    instance.exp = exp;
    return instance;
  }
  static toExp(value) {
    if (value instanceof Big) return value.exp;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 310;
    if (numeric <= 0) return -Infinity;
    return Math.log10(numeric);
  }
  gte(other) { return this.exp >= Big.toExp(other); }
  gt(other) { return this.exp > Big.toExp(other); }
  lt(other) { return this.exp < Big.toExp(other); }
  lte(other) { return this.exp <= Big.toExp(other); }
  eq(other) { return this.exp === Big.toExp(other); }
  times(other) { return Big.fromExp(this.exp + Big.toExp(other)); }
  /** 原版 Decimal#log10() 口径：返回数量级（本替身按指数建模，直接返回 exp）。 */
  log10() { return this.exp; }
  minus(other) {
    const otherExp = Big.toExp(other);
    if (this.exp - otherExp > 15) return Big.fromExp(this.exp);
    return new Big(this.toNumber() - Math.pow(10, otherExp));
  }
  toNumber() { return this.exp === -Infinity ? 0 : Math.pow(10, this.exp); }
}

/** 从生产源码里截取一个 getter（缩进 2 的 `  }` 为方法结束）。 */
function extractGetter(source, signature) {
  const start = source.indexOf(signature);
  assert.ok(start > 0, `生产代码里找不到 ${signature}`);
  const end = source.indexOf("\n  }", start) + 4;
  assert.ok(end > start, `无法确定 ${signature} 的结束位置`);
  return source.slice(start, end);
}

/** 解析 `const NAME = [ ... ];` 这种常量数组，返回每项的 log10 指数（null = undefined）。 */
function parseExpArray(source, name) {
  const matched = source.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  assert.ok(matched, `生产代码里找不到 ${name} 数组`);
  return matched[1].split(",").map(token => {
    const trimmed = token.trim();
    if (trimmed === "") return undefined; // 尾逗号产生的空项，下面过滤掉
    if (trimmed === "undefined" || trimmed === "null") return null;
    const dc = trimmed.match(/^DC\.E(\d+)$/);
    if (dc) return Number(dc[1]);
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric) && numeric > 0) return Math.log10(numeric);
    throw new Error(`无法解析 ${name} 的数组项：${trimmed}`);
  }).filter(exp => exp !== undefined);
}

// ================================================================ 生产源码
const AUTO_SRC = readSrc("src/core/autobuyers/big-crunch-autobuyer.js");
const ID_SRC = readSrc("src/core/dimensions/infinity-dimension.js");
const CURRENCY_SRC = readSrc("src/core/currency.js");
const BIG_CRUNCH_SRC = readSrc("src/core/big-crunch.js");
const GAME_SRC = readSrc("src/game.js");
const EXECUTOR_SRC = readSrc("src/core/oreki-smart-executor.js");
const AUTOBUYER_SRC = readSrc("src/core/autobuyers/autobuyer.js");
const SPEED_SRC = readSrc("src/core/speed-config.js");
const PLAYER_SRC = readSrc("src/core/player.js");
const EARLY_SRC = readSrc("src/core/oreki-early-automation.js");
const ENDGAME_SRC = readSrc("src/core/oreki-endgame-automation.js");

const holdGetter = extractGetter(AUTO_SRC, "  get waitingForId1Peak() {");
const willInfinityGetter = extractGetter(AUTO_SRC, "  get willInfinity() {");

// [R96] `willInfinity` 现在会先问 `OrekiCrunchPolicy.decide()`。夹具必须装入**真实策略
// 源码**（只剥掉 `export` 外壳），否则 getter 会因为缺依赖抛错，测不到真实的放行/拦截行为。
const POLICY_SCRIPT = `${readSrc("src/core/oreki-crunch-policy.js").replace(/^export\s+/gm, "")}
globalThis.OrekiCrunchPolicy = OrekiCrunchPolicy;
`;

/**
 * 用**生产 getter 原文**构造一个最小自动器实例；`OrekiCrunchPolicy` 也装入真实源码。
 * 因此「窗口内是否拦截」同时覆盖了 R96 目标驱动策略与 R94 峰值窗口两条判据。
 * @param {{break?:boolean, id1Unlocked?:boolean, ipExp?:number, maxAMExp?:number,
 *          challenge?:boolean, doomed?:boolean, gainedIpExp?:number}} opt
 */
function makeBigCrunchAutobuyer(opt = {}) {
  const sandbox = {
    console, Math, Object, Array, Number, String, JSON, Boolean, Error, Date,
    Big,
    AUTO_CRUNCH_MODE: { AMOUNT: 0, TIME: 1, X_HIGHEST: 2 },
    player: {
      break: opt.break !== false,
      records: { thisEternity: { maxAM: Big.fromExp(opt.maxAMExp ?? 500) } },
      // [R96 第四轮] 策略用「EP / 大永恒次数 / 已购永恒升级」三项判永恒层；
      // R94 夹具是「首次永恒前」的 ID1 峰值窗口，三项必须全零（-Infinity 即数值 0）。
      eternities: Big.fromExp(-Infinity),
      eternityPoints: Big.fromExp(-Infinity),
      eternityUpgrades: { size: 0 },
    },
    Player: { isInAntimatterChallenge: false },
    PlayerProgress: { infinityUnlocked: () => true, eternityUnlocked: () => false },
    InfinityDimension: tier => ({
      isUnlocked: opt.id1Unlocked === true,
      // 与 src/core/dimensions/infinity-dimension.js 的 UNLOCK_REQUIREMENTS 同形。
      amRequirement: Big.fromExp(1100 + (tier - 1) * 300),
      ipRequirement: 1e8,
    }),
    NormalChallenge: { isRunning: opt.challenge === true },
    InfinityChallenge: { isRunning: false },
    Pelle: { isDoomed: opt.doomed === true },
    Currency: { infinityPoints: { value: Big.fromExp(opt.ipExp ?? 13) } },
    DC: { E8: Big.fromExp(8), E1100: Big.fromExp(1100) },
    Time: { thisInfinityRealTime: { totalSeconds: 0 } },
    gainedInfinityPoints: () => Big.fromExp(opt.gainedIpExp ?? 20),
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(POLICY_SCRIPT, sandbox, { filename: "oreki-crunch-policy.js" });
  vm.runInContext(`
    class BigCrunchAutobuyerState {
${holdGetter}
${willInfinityGetter}
      get mode() { return AUTO_CRUNCH_MODE.X_HIGHEST; }
      get highestPrevPrestige() { return Big.fromExp(1); }
      get xHighest() { return Big.fromExp(1); }
      get time() { return 1; }
    }
    globalThis.__BC__ = new BigCrunchAutobuyerState();
  `, sandbox, { filename: "big-crunch-autobuyer.js" });
  return { bc: sandbox.__BC__, sandbox };
}

/** 把 ESM 转成 vm 可执行脚本（去 import/export，导出对象挂到 globalThis）。 */
function loadModule(relativePath, exportName) {
  let source = readSrc(relativePath)
    .replace(/^import\s.*?;\s*$/gm, "")
    .replace(/^export\s+/gm, "");
  source += `\nglobalThis.__MOD__ = ${exportName};\n`;
  return source;
}

/** 加载真实的 OrekiEarlyAutomation，供「窗口内是否还有可买项」检查。 */
function makeEarlyAutomation(opt = {}) {
  const sandbox = {
    console, Math, Object, Array, Number, String, JSON, Boolean, Error, Date,
    Big,
    Currency: { infinityPoints: { value: Big.fromExp(opt.ipExp ?? 8) } },
    player: { break: true, auto: { autobuyersOn: true } },
    PlayerProgress: { eternityUnlocked: () => false },
    NormalChallenge: { isRunning: false },
    InfinityChallenge: { isRunning: false },
    EternityChallenge: { isRunning: false, isUnlocked: () => false },
    Pelle: { isDoomed: false },
    OrekiSmartExecutor: null,
    OrekiIu15Sprint: { tick: () => {} },
    InfinityDimension: tier => ({
      isUnlocked: tier !== 1,
      ipRequirement: 1e8,
      purchases: 0,
    }),
    InfinityDimensions: { canBuy: () => true, all: [], buyMax: () => {} },
    InfinityUpgrade: { all: opt.upgrades ?? [] },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(loadModule("src/core/oreki-early-automation.js", "OrekiEarlyAutomation"),
    sandbox, { filename: "oreki-early-automation.js" });
  return { early: sandbox.__MOD__, sandbox };
}

// ================================================================ 组 1：阈值同源
const idUnlockRequirements = parseExpArray(ID_SRC, "UNLOCK_REQUIREMENTS");
const idBaseCosts = parseExpArray(ID_SRC, "BASE_COSTS");
const holdIpExp = Number(AUTO_SRC.match(/Currency\.infinityPoints\.value\.lt\(DC\.E(\d+)\)/)[1]);
const holdPeakExp = Number(AUTO_SRC.match(
  /player\.records\.thisEternity\.maxAM\.lt\(DC\.E(\d+)\)/)[1]);

check("1. HOLD 的峰值阈值与 ID1 的反物质门槛同源（都是 1e1100）", () => {
  assert.equal(idUnlockRequirements[1], 1100,
    `infinity-dimension.js UNLOCK_REQUIREMENTS[1] 应为 1e1100，实际 1e${idUnlockRequirements[1]}`);
  assert.equal(holdPeakExp, idUnlockRequirements[1],
    `big-crunch-autobuyer.js 的 HOLD 阈值 1e${holdPeakExp} 与 ID1 门槛 1e${idUnlockRequirements[1]} 不一致`);
});

check("2. HOLD 的 IP 阈值与 ID1 的 ipRequirement（= 首次购买成本）同源（都是 1e8）", () => {
  assert.equal(idBaseCosts[1], 8, `BASE_COSTS[1] 应为 1e8，实际 1e${idBaseCosts[1]}`);
  assert.equal(holdIpExp, idBaseCosts[1],
    `HOLD 的 IP 阈值 1e${holdIpExp} 与 ID1 门槛 1e${idBaseCosts[1]} 不一致`);
  // infinity-dimension.js:59 `this.ipRequirement = BASE_COSTS[1]`（IP 门槛与首次成本同一字面量）
  assert.match(ID_SRC, /this\.ipRequirement = BASE_COSTS\[1\];/);
});

check("3. 预留额度恰好覆盖「解锁后买下第一层 ID1」：门槛 = 首次成本 ⇒ 余额 ≥ 门槛即可负担", () => {
  const requirement = Math.pow(10, idBaseCosts[1]);
  const firstPurchaseCost = requirement; // BASE_COSTS[1] 同时是 ipRequirement 与 baseCost
  assert.ok(requirement >= firstPurchaseCost,
    `余额 ${requirement} 买不起首次成本 ${firstPurchaseCost}`);
  // 真实购买判据：infinity-dimension.js:108-110 `Currency.infinityPoints.gte(this.cost)`
  assert.match(ID_SRC, /get isAffordable\(\) \{\s*\n\s*return Currency\.infinityPoints\.gte\(this\.cost\);/);
});

// ================================================================ 组 2：拦得住、也放得开
// [R96 顺序对齐] willInfinity 现在先问 OrekiCrunchPolicy：策略把「单次收益 ≥ 10 倍 IP」
// （ip-jump）排在「等 ID 峰值」之前，因此窗口内**收益不足**才会暂停；收益足够时允许
// 结算一次（否则 ID6→ID7 那种长达 1.7 小时的峰值窗口会把 IP 增长完全掐死）。
check("4. 窗口内收益不足时 `willInfinity` 必须为 false（不是只看 waitingForId1Peak）", () => {
  const { bc } = makeBigCrunchAutobuyer({ ipExp: 13, maxAMExp: 500, gainedIpExp: 13 });
  assert.equal(bc.waitingForId1Peak, true, "前置：窗口应成立");
  assert.equal(bc.willInfinity, false, "收益不足（<10 倍）时窗口内必须暂停，否则反物质峰值被清零");
});

check("4b. 窗口内单次收益 ≥10 倍 IP → 策略按 ip-jump 放行（与 Android 同序，避免峰值窗口掐死 IP 增长）", () => {
  const { bc } = makeBigCrunchAutobuyer({ ipExp: 13, maxAMExp: 500, gainedIpExp: 14 });
  assert.equal(bc.waitingForId1Peak, true, "前置：R94 峰值窗口本身仍成立");
  assert.equal(bc.willInfinity, true, "收益 ≥10 倍时策略应优先放行，不能等 1.7 小时的峰值窗口");
});

check("5. 峰值未到 1e1100 时保持 HOLD；恰好到 1e1100 立即释放（边界正确）", () => {
  assert.equal(makeBigCrunchAutobuyer({ maxAMExp: 1099.999 }).bc.waitingForId1Peak, true);
  assert.equal(makeBigCrunchAutobuyer({ maxAMExp: 1100 }).bc.waitingForId1Peak, false);
});

check("6. 峰值到达门槛后 `willInfinity` 恢复为 true（坍缩链重新接通）", () => {
  const { bc } = makeBigCrunchAutobuyer({ maxAMExp: 1100, ipExp: 13, gainedIpExp: 20 });
  assert.equal(bc.waitingForId1Peak, false);
  assert.equal(bc.willInfinity, true);
});

check("7. ID1 一旦解锁立即释放 HOLD（解锁瞬间不残留等待）", () => {
  const { bc } = makeBigCrunchAutobuyer({ id1Unlocked: true, maxAMExp: 500, ipExp: 13 });
  assert.equal(bc.waitingForId1Peak, false);
  assert.equal(bc.willInfinity, true);
});

check("8. IP 未到 1e8 时不 HOLD（先照常坍缩攒 IP，不是一开始就停摆）", () => {
  const { bc } = makeBigCrunchAutobuyer({ ipExp: 7.9, maxAMExp: 500 });
  assert.equal(bc.waitingForId1Peak, false);
  assert.equal(bc.willInfinity, true);
});

check("9. 挑战 / 毁灭态不 HOLD（窗口只在普通 Break 后成立）", () => {
  assert.equal(makeBigCrunchAutobuyer({ challenge: true }).bc.waitingForId1Peak, false);
  assert.equal(makeBigCrunchAutobuyer({ doomed: true }).bc.waitingForId1Peak, false);
});

check("10. 未 Break 时 `willInfinity` 恒为 true（原版首次无限路径不受影响）", () => {
  const { bc } = makeBigCrunchAutobuyer({ break: false, ipExp: 13, maxAMExp: 500 });
  assert.equal(bc.willInfinity, true);
});

// ================================================================ 组 3：可终止 + 无旁路
check("11. 峰值指标每次反物质写入都连续更新（HOLD 不会因记录不刷新而死锁）", () => {
  assert.match(CURRENCY_SRC,
    /player\.records\.thisEternity\.maxAM = player\.records\.thisEternity\.maxAM\.max\(value\);/,
    "currency.js 缺少 thisEternity.maxAM 的连续更新");
  assert.match(ID_SRC,
    /get antimatterRequirementReached\(\) \{\s*\n\s*return player\.records\.thisEternity\.maxAM\.gte\(this\.amRequirement\);/,
    "ID1 的 antimatterRequirementReached 必须读同一个 thisEternity.maxAM");
});

check("12. 大坍缩只清 thisInfinity.maxAM，不清本纪峰值（门槛不会被坍缩回滚）", () => {
  assert.match(BIG_CRUNCH_SRC, /player\.records\.thisInfinity\.maxAM = DC\.D0;/);
  assert.doesNotMatch(BIG_CRUNCH_SRC, /player\.records\.thisEternity\.maxAM\s*=/,
    "big-crunch.js 若重置本纪峰值，HOLD 永远无法解除");
});

check("13. 全部强制坍缩调用点在白名单内（新增 MOD 旁路会让本条失败）", () => {
  const expected = new Set([
    "src/core/big-crunch.js",                          // 定义 + 手动入口内部调用
    "src/core/autobuyers/big-crunch-autobuyer.js",     // 自动坍缩，受 willInfinity 门控
    "src/components/modals/prestige/BigCrunchModal.js", // 玩家手动确认弹窗
    "src/components/ui-modes/BigCrunchButton.js",      // 玩家手动按钮
    "src/core/automator/lexer.js",                     // Automator 脚本 $prestige（玩家脚本）
    "src/core/oreki-endgame-automation.js",            // 仅毁灭态、且先 `if (player.break) return`
    "src/game.js",                                     // 开局例程：仅 !player.break 分支
  ]);
  const actual = new Set();
  const files = readdirSync(join(WEB, "src"), { recursive: true })
    .map(p => String(p).replace(/\\/g, "/"))
    .filter(p => p.endsWith(".js"));
  for (const rel of files) {
    if (/bigCrunchResetRequest\s*\(/.test(readSrc(`src/${rel}`))) actual.add(`src/${rel}`);
  }
  const added = [...actual].filter(f => !expected.has(f));
  const removed = [...expected].filter(f => !actual.has(f));
  assert.deepEqual(added, [], `出现未登记的强制坍缩调用方：${added.join(", ")}`);
  assert.deepEqual(removed, [], `预期调用方消失（路径/命名变化需同步本表）：${removed.join(", ")}`);
});

check("14. 自动坍缩只在 `willInfinity` 为真时请求坍缩", () => {
  assert.match(AUTO_SRC,
    /tick\(\) \{\s*\n\s*super\.tick\(\);\s*\n\s*if \(this\.willInfinity\) bigCrunchResetRequest\(true\);/);
});

check("15. 开局例程的强制坍缩只在 `!player.break` 分支（窗口内不会越权坍缩）", () => {
  assert.match(GAME_SRC,
    /if \(!player\.break && Player\.canCrunch\) bigCrunchResetRequest\(true\);/);
});

check("16. 毁灭态补坍缩路径先返回 `if (player.break) return;`（不构成窗口旁路）", () => {
  const start = ENDGAME_SRC.indexOf("_pulseDoomedCrunch(keepAuto) {");
  assert.ok(start > 0, "找不到 _pulseDoomedCrunch");
  const block = ENDGAME_SRC.slice(start, start + 800);
  assert.match(block, /if \(player\.break\) return;/);
});

// ================================================================ 组 4：墙钟上界量化
const gameSpeedDefault = Number(SPEED_SRC.match(
  /export const GAME_SPEED_DEFAULT = (\d+);/)[1]);
const defaultIntervalSec = Number(EXECUTOR_SRC.match(
  /const INTERVAL_DEFAULT_SEC = (\d+);/)[1]);

check("17. 原版自动购买器的有效间隔 = interval / F（高倍率下按游戏时间触发）", () => {
  assert.equal(gameSpeedDefault, 10000, "默认倍率应为 10000×");
  assert.match(AUTOBUYER_SRC,
    /get effectiveInterval\(\) \{\s*\n\s*return this\.interval \/ Math\.max\(1, getGlobalSpeedFactor\(\)\);/);
});

check("18. HOLD 内的峰值爬升不受 MOD 节拍限制：原版自动购买器在 10000× 下每帧都能触发", () => {
  const dimBoostInterval = Number(PLAYER_SRC.match(
    /dimBoost: \{[\s\S]*?interval: (\d+),/)[1]);
  const galaxyInterval = Number(PLAYER_SRC.match(
    /galaxy: \{[\s\S]*?interval: (\d+),/)[1]);
  const adIntervals = PLAYER_SRC.match(
    /antimatterDims: \{[\s\S]*?interval: \[([^\]]+)\]/)[1]
    .split(",").map(s => Number(s.trim()));
  const frameMs = 1000 / 60;
  const rows = [
    ["维度提升", dimBoostInterval],
    ["反物质星系", galaxyInterval],
    ...adIntervals.map((ms, i) => [`反物质维度 ${i + 1}`, ms]),
  ].map(([name, interval]) => {
    const effective = interval / gameSpeedDefault;
    assert.ok(effective < frameMs,
      `${name} 的有效间隔 ${effective}ms 不小于一帧 ${frameMs.toFixed(2)}ms`);
    return `${name} ${interval}ms→${effective}ms`;
  });
  // 证据落到测试输出里，报告可直接引用
  console.log(`      · ${rows.join(" · ")}`);
});

check("19. 受统一节拍限制的只有「解锁/购买 ID1」与「触发首次永恒」两个真动作（上界 = 2 拍）", () => {
  assert.ok(defaultIntervalSec >= 1, "默认间隔不应小于 1 秒（WEB.md 合法范围 1~60 秒）");
  // `early`（买无限维度/无限升级）与 `eternityReset`（触发永恒）都注册在同一个调度器
  assert.match(GAME_SRC, /\["early", 20, \(\) => OrekiEarlyAutomation\.tick\(\)/);
  assert.match(GAME_SRC,
    /\["eternityReset", 31, \(\) => OrekiEternityAutomation\.tickEternity\(\)/);
  // 统一全局节拍：任一真动作之间必须 ≥ intervalSec，且没有 `cont` 类旁路
  assert.match(EXECUTOR_SRC, /if \(!globalGateFree\(gateNow\)\) break;/);
  assert.doesNotMatch(EXECUTOR_SRC, /if \(task\.cls === "cont"\)/,
    "调度器不得为任何任务恢复连续型豁免（R78 语义：无豁免）");
  console.log(`      · 默认间隔 ${defaultIntervalSec}s ⇒ 该阶段墙钟上界 ≈ ${2 * defaultIntervalSec}s + 亚秒级自然爬升`);
});

check("20. 窗口内「余额恰好等于门槛」时进阶模块自动让拍（不空占节拍买 IP 升级）", () => {
  const upgrade = {
    id: "cheapOneShot",
    cost: 1e7,
    isAvailableForPurchase: true,
    canBeBought: true,
    purchase() { this.bought = true; return true; },
  };
  // 余额恰好 = 门槛：任何扣费都会跌破预留 ⇒ hasRealWork 为假 ⇒ 不申请优先拍
  const atFloor = makeEarlyAutomation({ ipExp: 8, upgrades: [upgrade] });
  atFloor.sandbox.InfinityDimensions.canBuy = () => true;
  assert.equal(atFloor.early.shouldRequestBeat(), false,
    "余额 = 门槛时不应申请优先拍（会把唯一的拍从 routine 抢走）");
  // 余额高于门槛：只买买完仍 ≥ 门槛的升级 ⇒ 允许申请优先拍
  const aboveFloor = makeEarlyAutomation({ ipExp: 13, upgrades: [upgrade] });
  assert.equal(aboveFloor.early.shouldRequestBeat(), true);
  // 两条购买路径都必须过同一个预留判据（一次性 + 可重复各一处）
  const guardCount = (EARLY_SRC.match(/if \(reserveId1Ip && !this\.leavesId1Reserve\(upgrade\.cost\)\) continue;/g) || []).length;
  assert.equal(guardCount, 2, `预留判据应同时覆盖两轮购买，实际 ${guardCount} 处`);
});

// ================================================================ 汇总
console.log(`\nR94 ID1 峰值窗口定向夹具：${passed}/${passed + failures.length} 通过`);
if (failures.length > 0) {
  console.log("失败项：");
  for (const failure of failures) console.log(`  · ${failure}`);
  process.exit(1);
}
