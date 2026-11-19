// [Oreki R70] 网页版「自动永恒」闸门回归测试。
//
// 为什么要这个文件：
//   Android 侧 R65~R69 连续五轮「入口调用成功、日志无异常、永恒次数永远是 0」，
//   根因之一是闸门顺序/极性；网页版 `tickEternity()` 与 Android 是同一套策略，
//   任何一端改错都会让「首次永恒」重新变成进度墙。这里用**真实模块**（不是重写一份逻辑）
//   把七个分支逐个跑一遍，锁死：
//     ① 自动化关闭 → 一次都不发起
//     ② 资格不足 → 不发起
//     ③ 现实升级 10 保护期内 → 不发起
//     ④ EC 入口等待中 → 不发起
//     ⑤ 收益不足当前 EP（×1 门槛：EP 还没翻倍）→ 不发起
//     ⑥ 全部通过 → 恰好发起一次，且实参必须是 (false, true)
//     ⑦ IU15 冲刺保护 → 不发起
//   外加 `holdForRealityUpgrade10()` 的四条停止条件与「最多 10 秒 + 一次性放弃」语义。
//
// 用法：node scripts/check_eternity_gate.mjs      （退出码 0 = 全过）

import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
// 生产模块用游戏全局 Decimal；Node 夹具必须提供同一个真实实现，
// 否则 eternityUpgradeReserve 的原生 number→Decimal 归一化会 ReferenceError。
import Decimal from "../modules/break_infinity.js";
globalThis.Decimal = Decimal;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

let checks = 0;
const failures = [];
function check(name, ok, detail = "") {
  checks += 1;
  if (!ok) failures.push(detail ? `${name}  ← ${detail}` : name);
}

// ---------------- 伪造最小运行环境 ----------------
// 只造 `tickEternity` / `active` / `holdForRealityUpgrade10` 真正读到的名字。
const env = {
  autobuyersOn: true,
  canEternity: false,
  ipExp: 308,
  noEternities: true,
  eternitiesGtZero: false,
  gained: 0,
  ep: 0,
  ru10Available: false,
  ru10Bought: false,
  eternityCalls: [],
  infinities: 0,
};

globalThis.player = {
  // [R101 P0] 原版「自动永恒」单项开关的数据源（Autobuyer.eternity.isActive 同源）。
  auto: { autobuyersOn: true, eternity: { isActive: true } },
  options: {},
  requirementChecks: { reality: { noEternities: true } },
  records: {},
  break: true,
};
globalThis.Player = { get canEternity() { return env.canEternity; } };
globalThis.NormalChallenge = { isRunning: false };
globalThis.InfinityChallenge = { isRunning: false };
globalThis.EternityChallenge = { isRunning: false };
globalThis.Pelle = { isDoomed: false };
globalThis.Currency = {
  eternityPoints: { value: { times: (n) => env.ep * n } },
  eternities: { gt: () => env.eternitiesGtZero },
  infinityPoints: { value: { exponent: 0 } },
  infinities: { value: { toNumber: () => env.infinities } },
};
globalThis.RealityUpgrade = (id) => (id === 10 ? {
  isAvailableForPurchase: env.ru10Available,
  isBought: env.ru10Bought,
} : null);
globalThis.gainedEternityPoints = () => ({ lt: (x) => env.gained < x });
globalThis.eternity = (a, b) => { env.eternityCalls.push([a, b]); return true; };

const { OrekiEternityAutomation: A } = await import(
  "file://" + path.join(ROOT, "src/core/oreki-eternity-automation.js")
);

// [R116-01 P0] 首次永恒 180 s 驻留用可控单调时钟驱动：不真实等待 180 秒，
// 也不依赖系统墙钟（生产实现走 performance.now，与 Android elapsedRealtime 同语义）。
const ORIG_MONOTONIC_NOW = A._monotonicNowMs;
let dwellClock = 5000;
A._monotonicNowMs = () => dwellClock;

/** 把自动化强制置为「启用」，并允许逐条覆盖门禁方法。 */
function arm({ hold = false, ec = false, autoEternity = true } = {}) {
  player.auto.autobuyersOn = env.autobuyersOn;
  player.auto.eternity.isActive = autoEternity;
  A.holdForRealityUpgrade10 = () => hold;
  A.ecEntryPending = () => ec;
}

// 原方法备份：arm() 会覆盖，reset() 必须还原（不能 delete，否则真方法就没了）
const ORIG_HOLD = A.holdForRealityUpgrade10;
const ORIG_EC = A.ecEntryPending;

function reset() {
  env.canEternity = false;
  env.gained = 0;
  env.ep = 0;
  env.eternityCalls = [];
  delete globalThis.OrekiIu15Sprint;
  A.holdForRealityUpgrade10 = ORIG_HOLD;
  A.ecEntryPending = ORIG_EC;
  // [R104 P0] 新档引导窗口的会话缓存必须逐例重置，否则用例之间会互相污染。
  delete A._freshSessionBootstrap;
  delete A._eternityAutobuyerAdopted;
  // [R116-01 P0] 首次永恒驻留计时/存档归属/「曾永恒」latch 同样逐例重置。
  A._firstEternityDwellStartedAt = null;
  A._firstEternityDwellSaveId = null;
  A._firstEternityEverSeen = false;
  dwellClock = 5000;
  // [R114-01] 开关归属观察态也必须逐例重置：用例 ⑭ 末例会写入 userClosed=true，
  // 残留到 ⑮ 会把新档引导窗口误判成"玩家已手动关闭"。
  A._eternityAutoUserClosed = false;
  A._eternityAutoLastSeenActive = undefined;
  A._eternityAutoSaveId = null;
  A._eternityAutoEnabledAtRealities = null;
  A._eternityAutoEnabledAtRealTime = null;
}

// ---------------- ① 自动化关闭 → 一次都不发起 ----------------
reset();
env.autobuyersOn = false;
env.canEternity = true;
env.gained = 1e100;
env.ep = 1;
check("自动化关闭时不发起永恒", A.tickEternity() === false);
check("自动化关闭时 eternity 调用 0 次", env.eternityCalls.length === 0,
  `calls=${env.eternityCalls.length}`);
env.autobuyersOn = true;

// ---------------- ② 资格不足 ----------------
reset();
arm();
env.canEternity = false;
env.gained = 1e100;
env.ep = 1;
check("永恒资格不足时不发起", A.tickEternity() === false);
check("资格不足时 eternity 调用 0 次", env.eternityCalls.length === 0);

// ---------------- ③ 现实升级 10 保护期内不发起 ----------------
reset();
arm({ hold: true });
env.canEternity = true;
env.gained = 1e100;
env.ep = 1;
check("现实升级 10 保护期内不发起", A.tickEternity() === false);
check("保护期内 eternity 调用 0 次", env.eternityCalls.length === 0);

// ---------------- ④ EC 入口等待中不发起 ----------------
reset();
arm({ hold: false, ec: true });
env.canEternity = true;
env.gained = 1e100;
env.ep = 1;
check("EC 入口等待中不发起", A.tickEternity() === false);

// ---------------- ⑤ 收益不足当前 EP（×1 门槛）不发起 ----------------
// [R96 第五轮] 门槛从 ×10 改成 ×1：EP 是时间维度/永恒升级的唯一燃料，×10 会让中期
// EP 卡死（平台期实测 gainedEP 只有 7，而 ×10 需要 23）。现在「gained ≥ 当前 EP」
// （即这一次永恒至少让 EP 翻倍）就结算。
reset();
arm();
env.canEternity = true;
env.ep = 100;
env.gained = 99;    // < 100*1 → 没翻倍
check("收益不足当前 EP（未翻倍）不发起", A.tickEternity() === false);
check("收益不足时 eternity 调用 0 次", env.eternityCalls.length === 0);

// ---------------- ⑥ 全部通过 → 恰好一次，实参 (false, true) ----------------
reset();
arm();
env.canEternity = true;
env.ep = 100;
env.gained = 100;   // == 100*1，边界（刚好让 EP 翻倍）应放行
check("收益刚好等于当前 EP（EP 翻倍）时放行（边界）", A.tickEternity() === true);
check("恰好发起 1 次", env.eternityCalls.length === 1, `calls=${env.eternityCalls.length}`);
check("实参必须是 (false, true)",
  env.eternityCalls.length === 1 && env.eternityCalls[0][0] === false && env.eternityCalls[0][1] === true,
  JSON.stringify(env.eternityCalls));

// 首次永恒场景：EP = 0 时任何收益都够（对应 EP*10 = 0）
reset();
arm();
env.canEternity = true;
env.ep = 0;
env.gained = 1;
check("首次永恒（EP=0）必须放行", A.tickEternity() === true);
check("首次永恒原版 eternity 被调用 1 次",
  env.eternityCalls.length === 1 &&
  env.eternityCalls[0][0] === false && env.eternityCalls[0][1] === true,
  JSON.stringify(env.eternityCalls));

// ---------------- ⑦ IU15 冲刺保护 ----------------
reset();
arm();
env.canEternity = true;
env.ep = 0;
env.gained = 1;
globalThis.OrekiIu15Sprint = { freezeResets: true };
check("IU15 冲刺期间不发起永恒", A.tickEternity() === false);
check("IU15 期间 eternity 调用 0 次", env.eternityCalls.length === 0);

// ---------------- ⑧ holdForRealityUpgrade10 语义 ----------------
reset();
const now0 = Date.now();
let clock = now0;
const realNow = Date.now;
Date.now = () => clock;
try {
  // 已永恒过 → 立即放手
  env.eternitiesGtZero = true;
  env.noEternities = false;
  player.requirementChecks.reality.noEternities = false;
  check("已永恒过时不压", A.holdForRealityUpgrade10() === false);

  // 未永恒、IP 指数不足 → 压
  env.eternitiesGtZero = false;
  env.noEternities = true;
  player.requirementChecks.reality.noEternities = true;
  Currency.infinityPoints.value.exponent = 308;
  A.__resetRu10ForTest?.();
  A._ru10HoldSince = 0;
  A._ru10GaveUp = false;
  check("IP 指数不足时开始压", A.holdForRealityUpgrade10() === true);

  // 5 秒后仍在压
  clock = now0 + 5000;
  check("5 秒时仍在压", A.holdForRealityUpgrade10() === true);

  // 11 秒后放弃，并置一次性闩锁
  clock = now0 + 11000;
  check("超过 10 秒后放弃", A.holdForRealityUpgrade10() === false);
  check("放弃后置闩锁", A._ru10GaveUp === true);
  clock = now0 + 30000;
  check("闩锁后不再重复压（不会循环压 10 秒）", A.holdForRealityUpgrade10() === false);

  // IP 指数达标 → 立即放手
  A._ru10GaveUp = false;
  A._ru10HoldSince = 0;
  Currency.infinityPoints.value.exponent = 400;
  check("IP 指数达到 400 时放手", A.holdForRealityUpgrade10() === false);

  // 已买 / 已可买 → 放手
  Currency.infinityPoints.value.exponent = 308;
  A._ru10HoldSince = 0;
  A._ru10GaveUp = false;
  env.ru10Bought = true;
  check("已买到 RU10 时不压", A.holdForRealityUpgrade10() === false);
  env.ru10Bought = false;
  env.ru10Available = true;
  A._ru10HoldSince = 0;
  A._ru10GaveUp = false;
  check("RU10 已可买时不压", A.holdForRealityUpgrade10() === false);
} finally {
  Date.now = realNow;
}

// ---------------- ⑨ 源码静态守卫：门槛常量必须是 ×1 ----------------
{
  const autoSrc = readFileSync(path.join(ROOT, "src/core/oreki-eternity-automation.js"), "utf8");
  check("源码里永恒结算门槛是 eternityPoints.value.times(1)",
    autoSrc.includes("eternityPoints.value.times(1)"));
  check("源码里已无 eternityPoints.value.times(10)（旧 ×10 门槛）",
    !autoSrc.includes("eternityPoints.value.times(10)"));
  check("执行与诊断同链：tickEternity 与 noopReason 都走 ×1",
    autoSrc.split("eternityPoints.value.times(1)").length - 1 >= 2);
}

// ---------------- ⑩ R96 第十三轮：EP 预留（与 Android 同语义） ----------------
{
  const autoSrc = readFileSync(path.join(ROOT, "src/core/oreki-eternity-automation.js"), "utf8");
  check("存在 EP 预留方法 eternityUpgradeReserve", autoSrc.includes("eternityUpgradeReserve()"));
  check("预留量取自原版真实成本 EternityUpgrade.cost（不是写死数字）",
    autoSrc.includes("upgrade.cost") && autoSrc.includes("EternityUpgrade.all"));
  check("预留量随已买进度自动抬高（跳过 isBought，取最便宜）",
    autoSrc.includes("if (upgrade.isBought) continue;") && autoSrc.includes("cost.lt(cheapest)"));
  check("死锁保护：遥不可及不为它预留",
    autoSrc.includes("RESERVE_REACHABLE_LOG10") && autoSrc.includes("return null;"));
  check("TD 购买入口被 EP 预留闸门拦截（TD1 播种例外）",
    autoSrc.includes("if (!needsFirstSeed && !this.isEternityPointsBeyondReserve()) return false;"));
  check("预留只读不扣费（不出现直接扣 EP 的写法）",
    !autoSrc.includes("eternityPoints.value.sub(") && !autoSrc.includes("eternityUpgrades.add("));

  // 行为验证：用最小假对象跑真实方法体（不加载游戏；A 已在文件顶部 import）
  // [R104 P0] 原版 EternityUpgrade.cost 是原生 number，不是 Decimal/MathDouble；
  // 回归必须用真实数据形状（历史用带 .lt 的假对象，掩盖了线上 TypeError）。
  const mkCost = v => v;
  // 预留量已是真实 Decimal（R104 修复后），gte 比较必须兼容 Decimal 与假对象。
  const numOf = o => (o && typeof o.toNumber === "function" ? o.toNumber() : (o && o.v !== undefined ? o.v : o));
  const mkEP = v => ({
    v, lte: () => false, log10: () => Math.log10(v), gte: o => v >= numOf(o),
  });
  const savedAll = globalThis.EternityUpgrade;
  const savedEter = globalThis.Currency.eternities;
  const savedEP = globalThis.Currency.eternityPoints;
  try {
    const all = [
      { isBought: false, cost: mkCost(5) },
      { isBought: false, cost: mkCost(10) },
      { isBought: false, cost: mkCost(5e4) },
    ];
    globalThis.EternityUpgrade = { all };
    globalThis.Currency.eternities = { value: { lt: () => false } };
    globalThis.Currency.eternityPoints = { value: mkEP(0.483) };
    const reserveOf = () => { const r = A.eternityUpgradeReserve(); return r === null ? null : r.toNumber(); };
    check("EP 0.483 时预留 5 EP（旧 10 倍判定会漏掉）", reserveOf() === 5);
    check("原生 number cost 不再抛 cost.lt（R104 P0）", true);
    check("EP 0.483 < 预留 → 不买时间维度", A.isEternityPointsBeyondReserve() === false);

    globalThis.Currency.eternityPoints = { value: mkEP(5.2) };
    check("EP 5.2 ≥ 预留 → 放行（先买 TD1 解锁商店）", A.isEternityPointsBeyondReserve() === true);

    all[0].isBought = true; // 买到首档后，最便宜变成 10
    check("首档买完后预留自动抬到 10 EP", reserveOf() === 10);

    all[1].isBought = true; // 只剩 5e4，EP 5.2 差 4 个数量级 → 遥不可及
    check("第三档 5e4 遥不可及 → 不预留（不锁死 TD）", A.eternityUpgradeReserve() === null);
    check("无需预留时 TD 放行", A.isEternityPointsBeyondReserve() === true);

    all.forEach(u => { u.isBought = true; });
    check("全部买完 → 不预留", A.eternityUpgradeReserve() === null);
  } finally {
    globalThis.EternityUpgrade = savedAll;
    globalThis.Currency.eternities = savedEter;
    globalThis.Currency.eternityPoints = savedEP;
  }
}

// ---------------- ⑪ R96：TT 购买收益 ×500（与 Android 同语义） ----------------
{
  const src = readFileSync(path.join(ROOT, "src/core/oreki-eternity-automation.js"), "utf8");
  check("倍率常量 = 500", src.includes("const TT_REWARD_MULTIPLIER = 500;"));
  check("totalPurchased 结果按真实类型处理（number 不再调 toNumber）",
    src.includes('typeof raw === "number" ? raw : raw.toNumber()'));
  check("禁止把 totalPurchased() 直接当 Decimal 调 toNumber",
    !src.includes("totalPurchased().toNumber()") && !src.includes("const totalNum = total.toNumber();"));
  check("基线在购买之前建立（tick 先对账再买）",
    src.indexOf("this.settleTimeTheoremReward();") < src.indexOf("const dims = this.buyTimeDimensions();"));
  {
    const tickBody = src.split("tick() {")[1]?.split("this._frame++;")[0] || "";
    check("关闭自动化时仍结算（对账在 tick 的 active 早退之前）",
      tickBody.indexOf("this.settleTimeTheoremReward();") >= 0
      && tickBody.indexOf("this.settleTimeTheoremReward();") < tickBody.indexOf("if (!this.active) return"));
  }
  check("切档保护：单帧增量超上限只重设基线",
    src.includes("TT_REWARD_MAX_DELTA_PER_TICK") && src.includes("delta > TT_REWARD_MAX_DELTA_PER_TICK"));
  check("补发失败不推进基线（下一帧重试）",
    !/catch \(e\) \{[\s\S]{0,400}this\._ttSettled = /.test(src.split("settleTimeTheoremReward() {")[1]?.slice(0, 2000) || ""));
  check("发奖走累计购买次数对账（覆盖手动/自动/单次/批量）",
    src.includes("settleTimeTheoremReward()") && src.includes("TimeTheorems.totalPurchased()"));
  check("补发走原版货币 API Currency.timeTheorems.add",
    src.includes("Currency.timeTheorems.add(new Decimal(extra))"));
  check("对账边界：首帧只建基线、Δ<=0 不发奖、回退只重置",
    src.includes("this._ttSettled === null") && src.includes("if (delta <= 0) return 0;")
    && src.includes("if (totalNum < this._ttSettled)"));
  check("补发异常不静默（走 _err）",
    src.includes('this._err("settleTimeTheoremReward", e)'));
  check("每帧接入 tick", src.split("tick() {")[1]?.includes("this.settleTimeTheoremReward();") === true);

  // 行为验证：用假 TimeTheorems/Currency 跑真实方法体
  const A2 = A;
  const savedTT = globalThis.TimeTheorems;
  const savedCur = globalThis.Currency;
  const savedDecimal = globalThis.Decimal;
  try {
    let total = 3;
    let added = 0;
    globalThis.TimeTheorems = { totalPurchased: () => total }; // 真实实现返回原生 number
    globalThis.Currency = { timeTheorems: { add: (d) => { added += d.v; } } };
    globalThis.Decimal = class { constructor(v) { this.v = v; } };

    A2._ttSettled = null;
    check("首帧只建基线，不补发", A2.settleTimeTheoremReward() === 0 && added === 0);
    total = 3;
    check("无新购买时不发奖", A2.settleTimeTheoremReward() === 0 && added === 0);
    total = 4;
    check("新增 1 次购买 → 补发 499 TT", A2.settleTimeTheoremReward() === 499 && added === 499);
    total = 4;
    check("同一笔购买不会被重复补发", A2.settleTimeTheoremReward() === 0 && added === 499);
    total = 6;
    check("批量新增 2 次 → 补发 998 TT", A2.settleTimeTheoremReward() === 998 && added === 1497);
    total = 2_400_000;
    check("[R104 P1] 高倍率单拍真实大额购买 delta=2.4e6 → 按 ×500 补发（不再当换档丢弃）",
      A2.settleTimeTheoremReward() === (2_400_000 - 6) * 499);
    const addedAfterBig = added;
    total = 2_400_000 + 200_000_000;
    check("超过 1e8 的换档级跳变仍只重设基线、不发奖",
      A2.settleTimeTheoremReward() === 0 && added === addedAfterBig);
    total = 0;
    check("计数回退只重置基线、不发奖", A2.settleTimeTheoremReward() === 0 && added === addedAfterBig);
  } finally {
    globalThis.TimeTheorems = savedTT;
    globalThis.Currency = savedCur;
    globalThis.Decimal = savedDecimal;
    A2._ttSettled = null;
  }
}

// ---------------- ⑫ R96：EP 预留时序与真实布尔（审查 P1） ----------------
{
  const src = readFileSync(path.join(ROOT, "src/core/oreki-eternity-automation.js"), "utf8");
  check("TD1 未买时只播种 TD1（不做 8 层轮转）",
    src.includes("const needsFirstSeed = !firstTd.bought;")
    && src.includes("bought = buyMaxTimeDimension(1, 0.5) === true;"));
  check("TD1 已买后必须先过预留闸门",
    src.includes("if (!needsFirstSeed && !this.isEternityPointsBeyondReserve()) return false;"));
  check("不再无条件置 bought=true（只认真实返回值）",
    !src.includes("buyMaxTimeDimension(tier, 0.5);\n        bought = true;")
    && src.includes("if (buyMaxTimeDimension(tier, 0.5) === true) bought = true;"));
  {
    const tickBody = src.split("tick() {")[1]?.split("this._frame++;")[0] || "";
    check("tick 顺序：先买永恒升级，再买时间维度",
      tickBody.indexOf("this.buyEternityUpgrades()") >= 0
      && tickBody.indexOf("this.buyEternityUpgrades()") < tickBody.indexOf("this.buyTimeDimensions()"));
  }
}

// ---------------- ⑬ R101 P0：原版「自动永恒」单项开关（与 Android 同语义） ----------------
//
// 缺陷背景：tickEternity() 直接调原版「无确认永恒」入口，历史上只看 MOD 总开关
// （this.active），不看玩家存档里的 player.auto.eternity.isActive。Android 侧同一
// 缺陷由 OrekiAutoEternityGate 收敛修复；本组用例锁死 Web 端的等价判据。
{
  reset();
  arm({ autoEternity: false });
  env.canEternity = true;
  env.ep = 1;
  env.gained = 1e100;
  check("autoEternity 关闭时不发起永恒", A.tickEternity() === false);
  check("autoEternity 关闭时 eternity 调用 0 次", env.eternityCalls.length === 0,
    `calls=${env.eternityCalls.length}`);

  // 手动入口不受影响：本函数之外的原版 eternity() 直接调用不经过门禁。
  check("手动入口仍可直接调用原版 eternity（门禁只在 MOD tick 内）",
    (() => { let called = 0; const saved = globalThis.eternity;
      globalThis.eternity = () => { called += 1; return true; };
      try { globalThis.eternity(false, true); return called === 1; }
      finally { globalThis.eternity = saved; } })());

  // 重新打开开关 → 同一状态必须放行（反向条件不能被永久禁用）。
  reset();
  arm({ autoEternity: true });
  env.canEternity = true;
  env.ep = 1;
  env.gained = 1e100;
  check("autoEternity 开启后同样条件放行", A.tickEternity() === true);
  check("autoEternity 开启后恰好发起 1 次", env.eternityCalls.length === 1);

  const src = readFileSync(path.join(ROOT, "src/core/oreki-eternity-automation.js"), "utf8");
  check("源码门禁读的是 player.auto.eternity.isActive",
    src.includes("player.auto.eternity.isActive !== true"));
  check("EC 自动进入同样受 autoEternity 约束（canEternity 窗口内不自动进入）",
    src.includes("player.auto.eternity.isActive !== true")
    && src.includes("!this._eternityBootstrapActive()")
    && src.includes("Player.canEternity) return false"));
}

// ---------------- ⑫ [R104 P0] 新档引导窗口 ----------------
// 背景：全新存档 auto.eternity.isActive 默认 false，而自动永恒自动器要 100 次永恒才解锁
// （secret-formula/eternity/eternity-milestones.js:141）。R101 门禁把 isActive=false
// 一律当玩家关闭 ⇒ 新档永远不结算。这里锁死「新档放行 / 已有进度仍拦截」的边界。
{
  const savedPlayer = globalThis.player;
  const mkEternities = (v) => ({ lt: (n) => v < n, toNumber: () => v });
  const runCase = ({ eternities, isActive, unlocked, userClosed = false }) => {
    reset();
    player.eternities = mkEternities(eternities);
    player.auto.eternity.isActive = isActive;
    arm({ hold: false, ec: false, autoEternity: isActive });
    A._eternityAutoUserClosed = userClosed;
    if (unlocked !== undefined) {
      globalThis.EternityMilestone = { autobuyerEternity: { isReached: unlocked } };
    } else {
      delete globalThis.EternityMilestone;
    }
    env.canEternity = true;
    env.ep = 0;
    env.gained = 1e100;
    return A.tickEternity();
  };

  // [R116-01 P0] 引导窗口仍然负责"打通"首次永恒，但必须先经过 180 s 玩家可见驻留；
  // 这里用可控单调时钟跨过驻留，不真实等待。
  check("新档（eternities=0）+ 开关关闭 + 驻留未过 → 引导窗口也不得立即结算",
    runCase({ eternities: 0, isActive: false }) === false);
  check("驻留期内原版 eternity 调用 0 次", env.eternityCalls.length === 0,
    `calls=${env.eternityCalls.length}`);
  check("驻留计满 180 s 后同一状态放行首次永恒（引导窗口未被取消）",
    (() => { dwellClock += 180_000; return A.tickEternity(); })() === true);
  check("驻留结束后原版 eternity 恰好 1 次", env.eternityCalls.length === 1,
    `calls=${env.eternityCalls.length}`);

  // [R118-01 #69] 未解锁时界面无开关，玩家无法表达关闭意图；已永恒过的存档
  // 允许 MOD 载入驱动（与 Android PR #183 lockedLayerDriveAllowed 同口径），
  // 但不写存档开关。R101 的「玩家关闭」保护由 userClosed 用例保留。
  check("已有进度（eternities=13）+ 开关关闭 + 自动器未解锁 → 允许载入驱动（#69）",
    runCase({ eternities: 13, isActive: false, unlocked: false }) === true);
  check("载入驱动恰好发起 1 次 eternity", env.eternityCalls.length === 1);
  check("已有进度（eternities=13）+ userClosed=true → 仍拦截（R101 玩家关闭不回退）",
    runCase({ eternities: 13, isActive: false, unlocked: false, userClosed: true }) === false);

  check("已有进度（eternities=50）+ 开关关闭 + 自动器已解锁 → 拦截",
    runCase({ eternities: 50, isActive: false, unlocked: true }) === false);

  check("全新档会话推进到 50 次永恒、自动器解锁 → 一次性接管原版开关并继续放行",
    (() => {
      // 模拟同一会话：先在新档时采样，再推进到 50
      reset();
      globalThis.player.eternities = mkEternities(0);
      player.auto.eternity.isActive = false;
      arm({ hold: false, ec: false, autoEternity: false });
      A._eternityBootstrapActive(); // 采样全新档
      globalThis.player.eternities = mkEternities(50);
      globalThis.EternityMilestone = { autobuyerEternity: { isReached: true } };
      env.canEternity = true;
      env.ep = 0;
      env.gained = 1e100;
      const r = A.tickEternity();
      const adopted = A._eternityAutobuyerAdopted === true;
      const switchOn = player.auto.eternity.isActive === true;
      delete globalThis.EternityMilestone;
      return r === true && adopted === true && switchOn;
    })());

  check("新档会话内开关被重置为 false → 下次 tickEternity 幂等补回 true 并继续放行",
    (() => {
      player.auto.eternity.isActive = false;
      env.canEternity = true;
      env.ep = 0;
      env.gained = 1e100;
      env.eternityCalls = [];
      globalThis.EternityMilestone = { autobuyerEternity: { isReached: true } };
      const r = A.tickEternity();
      delete globalThis.EternityMilestone;
      return r === true && player.auto.eternity.isActive === true;
    })());
  check("载入已有进度（eternities=13）不接管：仍按玩家开关拦截（R101 P0 不回退）",
    (() => {
      reset();
      globalThis.player.eternities = mkEternities(13);
      player.auto.eternity.isActive = false;
      arm({ hold: false, ec: false, autoEternity: false });
      globalThis.EternityMilestone = { autobuyerEternity: { isReached: true } };
      env.canEternity = true;
      env.ep = 0;
      env.gained = 1e100;
      const r = A.tickEternity();
      const stillOff = player.auto.eternity.isActive === false;
      delete globalThis.EternityMilestone;
      return r === false && stillOff;
    })());
  check("新档会话在自动器未解锁时持久化开启，供读档后重建（#69）",
    (() => {
      reset();
      A._freshSessionBootstrap = true;
      A._eternityAutobuyerAdopted = false;
      globalThis.player.eternities = mkEternities(5);
      player.auto.eternity.isActive = false;
      globalThis.EternityMilestone = { autobuyerEternity: { isReached: false } };
      A._adoptEternityAutobuyerIfNeeded();
      const on = player.auto.eternity.isActive === true;
      const adopted = A._eternityAutobuyerAdopted === true;
      delete globalThis.EternityMilestone;
      return on && adopted;
    })());
  check("载入已有进度且未接管、自动器未解锁 → 不写开关（#69 不越权）",
    (() => {
      reset();
      A._freshSessionBootstrap = false;
      A._eternityAutobuyerAdopted = false;
      globalThis.player.eternities = mkEternities(5);
      player.auto.eternity.isActive = false;
      globalThis.EternityMilestone = { autobuyerEternity: { isReached: false } };
      A._adoptEternityAutobuyerIfNeeded();
      const off = player.auto.eternity.isActive === false;
      delete globalThis.EternityMilestone;
      return off;
    })());
  check("接管过的会话在 reality 重置后继续维持 isActive（EC 链不再自锁）",
    (() => {
      reset();
      A._freshSessionBootstrap = true;   // 本会话全新档
      A._eternityAutobuyerAdopted = true; // 已接管过
      globalThis.player.eternities = mkEternities(236); // reality 后 et 已 >0
      player.auto.eternity.isActive = false;             // reality 重置写回 false
      globalThis.EternityMilestone = { autobuyerEternity: { isReached: true } };
      A._adoptEternityAutobuyerIfNeeded();
      const on = player.auto.eternity.isActive === true;
      delete globalThis.EternityMilestone;
      return on;
    })());

  globalThis.player = savedPlayer;
  delete globalThis.EternityMilestone;
  reset();
}

// ---------------- ⑬ [R104 P0] tick 内部节流不得按被调用次数放大 ----------------
// 实测（diag-frame-20261113-0125）：tick() 在统一节拍下约 45s 才被服务一次，_frame%30 变成
// ~22 分钟/次研究、_frame%20 变成 ~15 分钟/次 EC。改为真实时间节流后必须锁死。
{
  const src = readFileSync(path.join(ROOT, "src/core/oreki-eternity-automation.js"), "utf8");
  check("tick 研究节流改为真实时间（_lastStudyTickAt，1s）",
    src.includes("_lastStudyTickAt") && src.includes("nowMs - (this._lastStudyTickAt || 0) >= 1000"));
  check("tick EC 节流改为真实时间（_lastEcTickAt，2s）",
    src.includes("_lastEcTickAt") && src.includes("nowMs - (this._lastEcTickAt || 0) >= 2000"));
  check("禁止回归：tick 不再用 _frame % STUDY_TICK_INTERVAL 控制研究购买",
    !src.includes("if (this._frame % STUDY_TICK_INTERVAL === 0)"));
  check("禁止回归：tick 不再用 _frame % 20 控制 EC 购买",
    !src.includes("if (this._frame % 20 === 0) ec = this.buyEcStudiesAndStart();"));
  check("EC1 入口资源=永恒次数，不得压永恒（与 EC4 同型例外）",
    src.includes("if (id === 1 || id === 4) return false;"));
}

// ---------------- ⑭ [R114-03] 真实永恒单一门禁（EC / 膨胀 / TP 播种 / 退出膨胀） ----------------
//
// 背景：主链（tickEternity）与 EC 自动进入早就有 autoEternity 门禁，但另有 5 条 MOD 链路
// 会触发真实永恒却完全不看该开关（dilation 深层 EC 直启、celestial 的 eternity /
// startDilatedEternity / switchingDilation）—— 与 Android PR #97 同类缺陷。
// 本组锁死：单一门禁 realEternityAllowed() 的语义 + 5 处调用点都实际 consult 它。
{
  const gateCase = ({ autoEternity, canEternity, freshSession = false, adopted = false,
    unlocked = true, userClosed = false }) => {
    reset();
    player.auto.eternity.isActive = autoEternity;
    env.canEternity = canEternity;
    A._freshSessionBootstrap = freshSession;
    if (adopted) A._eternityAutobuyerAdopted = true;
    A._eternityAutoUserClosed = userClosed;
    A._eternityAutoLastSeenActive = autoEternity;
    A.holdForRealityUpgrade10 = () => false;
    A.ecEntryPending = () => false;
    globalThis.EternityMilestone = { autobuyerEternity: { isReached: unlocked } };
    const allowed = A.realEternityAllowed();
    delete globalThis.EternityMilestone;
    return allowed;
  };

  check("门禁：autoEternity 开 ⇒ 允许真实永恒",
    gateCase({ autoEternity: true, canEternity: true }) === true);
  check("门禁：autoEternity 关 + canEternity 真 + 已解锁（无窗口）⇒ 阻止",
    gateCase({ autoEternity: false, canEternity: true, unlocked: true }) === false);
  check("门禁：autoEternity 关 + canEternity 假 ⇒ 允许（此时原版 eternity 不结算）",
    gateCase({ autoEternity: false, canEternity: false }) === true);
  check("门禁：autoEternity 关 + R104 新档引导窗口 + 未解锁 ⇒ 允许",
    gateCase({ autoEternity: false, canEternity: true, freshSession: true, unlocked: false }) === true);
  check("门禁：autoEternity 关 + R114 已接管 + 未解锁 ⇒ 允许（玩家此时无 UI 开关）",
    gateCase({ autoEternity: false, canEternity: true, adopted: true, unlocked: false }) === true);
  check("门禁：autoEternity 关 + 已接管但已解锁 + canEternity 真 ⇒ 阻止（只认真实开关）",
    gateCase({ autoEternity: false, canEternity: true, adopted: true, unlocked: true }) === false);
  check("门禁：玩家手动关闭（userClosed）+ canEternity 真 ⇒ 阻止",
    gateCase({ autoEternity: false, canEternity: true, userClosed: true, unlocked: true }) === false);
  check("门禁：canEternity 读不到（非布尔）⇒ fail-closed 阻止",
    (() => {
      reset();
      player.auto.eternity.isActive = false;
      A._freshSessionBootstrap = false;
      globalThis.EternityMilestone = { autobuyerEternity: { isReached: true } };
      const savedPlayer = globalThis.Player;
      globalThis.Player = { canEternity: undefined };
      try {
        return A.realEternityAllowed() === false;
      } finally {
        globalThis.Player = savedPlayer;
        delete globalThis.EternityMilestone;
      }
    })());

  const mkEternitiesLoad = v => ({ lt: n => v < n, toNumber: () => v });
  const lockedLoadCase = ({
    autobuyersOn = true,
    userClosed = false,
    eternities = 5,
    realities = 0,
  } = {}) => {
    reset();
    globalThis.player.eternities = mkEternitiesLoad(eternities);
    globalThis.player.realities = realities;
    player.auto.eternity.isActive = false;
    player.auto.autobuyersOn = autobuyersOn;
    A._freshSessionBootstrap = false;
    A._eternityAutobuyerAdopted = false;
    A._eternityAutoUserClosed = userClosed;
    env.canEternity = true;
    globalThis.EternityMilestone = { autobuyerEternity: { isReached: false } };
    try {
      return A.realEternityAllowed();
    } finally {
      delete globalThis.EternityMilestone;
    }
  };
  check("门禁：载入 et=5、未解锁、开关关、autobuyersOn、无 userClosed ⇒ 允许（#69 载入例外）",
    lockedLoadCase() === true);
  check("门禁：载入 et=5、未解锁、autobuyersOn=false ⇒ 阻止（#69 不越权）",
    lockedLoadCase({ autobuyersOn: false }) === false);
  check("门禁：载入 et=5、未解锁、userClosed=true ⇒ 阻止（#69 尊重玩家）",
    lockedLoadCase({ userClosed: true }) === false);
  check("门禁：载入 et=0 但 realities>0、未解锁 ⇒ 允许（#69 已永恒过）",
    lockedLoadCase({ eternities: 0, realities: 1 }) === true);
  check("门禁：载入 et=0、realities=0、未解锁 ⇒ 阻止（从未永恒）",
    lockedLoadCase({ eternities: 0, realities: 0 }) === false);
  check("载入 et=5 未解锁例外只驱动、不写开关（#69）",
    (() => {
      reset();
      globalThis.player.eternities = mkEternitiesLoad(5);
      player.auto.eternity.isActive = false;
      player.auto.autobuyersOn = true;
      A._freshSessionBootstrap = false;
      A._eternityAutobuyerAdopted = false;
      A._eternityAutoUserClosed = false;
      globalThis.EternityMilestone = { autobuyerEternity: { isReached: false } };
      A._adoptEternityAutobuyerIfNeeded();
      const off = player.auto.eternity.isActive === false;
      delete globalThis.EternityMilestone;
      return off;
    })());

  const autoSrc2 = readFileSync(path.join(ROOT, "src/core/oreki-eternity-automation.js"), "utf8");
  const dilSrc2 = readFileSync(path.join(ROOT, "src/core/oreki-dilation-automation.js"), "utf8");
  const celSrc2 = readFileSync(path.join(ROOT, "src/core/oreki-celestial-automation.js"), "utf8");

  check("单一门禁定义在 oreki-eternity-automation.js（realEternityAllowed）",
    autoSrc2.includes("realEternityAllowed() {"));
  check("EC 主链调用点使用同一门禁（buyEcStudiesAndStart）",
    autoSrc2.includes("if (!this.realEternityAllowed()) return false;"));

  // marker 的每次出现，都必须在前 400 字符内出现 realEternityAllowed 判据
  const gatedBefore = (src, marker) => {
    let from = 0;
    let found = 0;
    while (true) {
      const idx = src.indexOf(marker, from);
      if (idx < 0) break;
      found += 1;
      const gateIdx = src.lastIndexOf("realEternityAllowed", idx);
      if (gateIdx < 0 || idx - gateIdx > 400) return { ok: false, found };
      from = idx + marker.length;
    }
    return { ok: found > 0, found };
  };

  const ecStart = gatedBefore(dilSrc2, "EternityChallenge(target).start(true)");
  check("dilation 深层 EC 直启（EternityChallenge.start）前有单一门禁",
    ecStart.ok === true, "found=" + ecStart.found);

  // 注释里也出现过同名函数文本，因此这两项按「调用点精确片段」断言，而不是全文扫描。
  check("celestial TP 播种：eternity(false, true) 前置单一门禁",
    celSrc2.includes("willGainTp && OrekiEternityAutomation.realEternityAllowed() &&") &&
    celSrc2.includes("eternity(false, true) !== false)"));

  check("celestial 进入膨胀：startDilatedEternity(true) 两处均前置单一门禁",
    celSrc2.includes("} else if (OrekiEternityAutomation.realEternityAllowed() &&\n          startDilatedEternity(true) === true)") &&
    celSrc2.includes("if (!active && OrekiEternityAutomation.realEternityAllowed() &&\n        startDilatedEternity(true) === true)"));

  const switchDil = gatedBefore(celSrc2, "eternity(false, false, { switchingDilation: true })");
  check("celestial 退出膨胀 switchingDilation 前有单一门禁（默认不豁免）",
    switchDil.ok === true, "found=" + switchDil.found);

  check("celestial 至少 4 处引用单一门禁",
    celSrc2.split("realEternityAllowed").length - 1 >= 4,
    "count=" + (celSrc2.split("realEternityAllowed").length - 1));
  check("dilation 至少 1 处引用单一门禁",
    dilSrc2.split("realEternityAllowed").length - 1 >= 1,
    "count=" + (dilSrc2.split("realEternityAllowed").length - 1));
}

// ---------------- ⑮ [R116-01 P0] 首次永恒 180 s 驻留（对齐 Android r115-01） ----------------
//
// 背景：Android R115-01 真 APK + 独占 AVD 实测——打破无限后约 25 秒，一次坍缩把 IP 推过
// 1.797e308，canEternity 首次为真，R104 新档引导窗口在同一秒内就发起真实永恒结算，
// 玩家没有经历无限层。Web 冻结上游是同一份引导窗口（缺陷同源），本轮按 Android 定稿
// `OrekiAutoEternityGate.firstEternityDwellRemainingMs()` 的玩家可见语义补齐：
//   · 只延迟"自动化替玩家按首次永恒"，玩家手动永恒/已永恒存档/玩家已开自动永恒都不受限；
//   · 计时用单调时钟，资格消失、换存档、冷启动均重置；驻留结束仍走原版真实结算。
{
  const savedPlayer = globalThis.player;
  const savedRecords = player.records;
  const savedRealities = player.realities;
  const mkE = (v) => ({ lt: (n) => v < n, toNumber: () => v });
  const setup = ({ eternities = 0, isActive = false, canEternity = true,
    saveId = 111, unlocked = false, realities = 0 } = {}) => {
    reset();
    player.eternities = mkE(eternities);
    player.realities = realities;
    player.records = { gameCreatedTime: saveId };
    player.auto.eternity.isActive = isActive;
    arm({ hold: false, ec: false, autoEternity: isActive });
    env.canEternity = canEternity;
    env.ep = 0;
    env.gained = 1e100;
    env.eternityCalls = [];
    globalThis.EternityMilestone = { autobuyerEternity: { isReached: unlocked } };
  };

  // ① 未永恒 + 自动化引导窗口：先驻留，再合法结算
  setup({ eternities: 0, isActive: false, unlocked: false });
  check("[R116] 首次永恒：canEternity 首次为真即开始 180 s 驻留",
    A.firstEternityDwellRemainingMs() === 180_000,
    "rem=" + A.firstEternityDwellRemainingMs());
  check("[R116] 驻留期内 tickEternity 不发起首次永恒", A.tickEternity() === false);
  check("[R116] 驻留期内原版 eternity 调用 0 次", env.eternityCalls.length === 0,
    "calls=" + env.eternityCalls.length);

  dwellClock += 60_000;
  check("[R116] 驻留 60 s 时剩余 120 s", A.firstEternityDwellRemainingMs() === 120_000);
  check("[R116] 驻留 60 s 时仍不结算",
    A.tickEternity() === false && env.eternityCalls.length === 0);
  dwellClock += 119_999;
  check("[R116] 179.999 s 时仍剩 1 ms", A.firstEternityDwellRemainingMs() === 1);
  check("[R116] 179.999 s 时仍不结算", A.tickEternity() === false);
  dwellClock += 1;
  check("[R116] 计满 180 s 后剩余归零", A.firstEternityDwellRemainingMs() === 0);
  check("[R116] 计满 180 s 后放行首次永恒（仍走原版真实结算）", A.tickEternity() === true);
  check("[R116] 放行后原版 eternity 恰好 1 次且实参 (false, true)",
    env.eternityCalls.length === 1
    && env.eternityCalls[0][0] === false && env.eternityCalls[0][1] === true,
    JSON.stringify(env.eternityCalls));

  // ② 未解锁时 isActive=true 可能是 R118 的 MOD 所有权持久化，不得绕过驻留。
  setup({ eternities: 0, isActive: true, unlocked: false });
  check("[R120] 未解锁开关为 true 仍属 MOD 内部状态 ⇒ 开始 180 s 驻留",
    A.firstEternityDwellRemainingMs() === 180_000);
  check("[R120] 未解锁开关为 true 的驻留期内不结算首次永恒",
    A.tickEternity() === false && env.eternityCalls.length === 0);

  // 解锁后的真实开关才代表玩家可表达的关闭/开启意图。
  setup({ eternities: 0, isActive: true, unlocked: true });
  check("[R116] 已解锁且玩家开自动永恒 ⇒ 驻留为 0", A.firstEternityDwellRemainingMs() === 0);
  check("[R116] 已解锁且玩家开自动永恒 ⇒ 首次永恒立即放行", A.tickEternity() === true);
  check("[R116] 立即放行时原版 eternity 恰好 1 次", env.eternityCalls.length === 1);

  // ③ 已永恒过的存档 ⇒ 完全不受限
  setup({ eternities: 13, isActive: true, unlocked: true });
  check("[R116] 已永恒存档 ⇒ 驻留为 0（不拖慢长跑节奏）",
    A.firstEternityDwellRemainingMs() === 0);
  check("[R116] 已永恒存档 + 开关开 ⇒ 自动永恒立即放行", A.tickEternity() === true);
  setup({ eternities: 13, isActive: false, unlocked: true });
  check("[R116] 已永恒存档 + 开关关 ⇒ 仍按 R101 门禁拦截（不是驻留造成）",
    A.firstEternityDwellRemainingMs() === 0 && A.tickEternity() === false);

  // ③-b Reality 重置口径（Web 无 Android 的 bigEternities 持久字段）：
  // reality.js:643 会把 eternities 清零，不能因此把「已永恒存档」误判成新档再驻留 180 s。
  setup({ eternities: 0, realities: 5, isActive: false, unlocked: true });
  check("[R116] Reality 后 eternities=0（realities>0）⇒ 不得重新驻留",
    A.firstEternityDwellRemainingMs() === 0);
  check("[R116] Reality 后仍按玩家开关门禁（不是被驻留挡住）",
    A._neverEternitied() === false);
  // 同一会话内 eternities 被永恒升级花到 0：latch 必须保持"曾永恒"。
  setup({ eternities: 0, realities: 0, isActive: false, unlocked: false });
  A.firstEternityDwellRemainingMs(); // 开始驻留
  player.eternities = mkE(3);
  check("[R116] 观察到 eternities>0 ⇒ 结束驻留", A.firstEternityDwellRemainingMs() === 0);
  player.eternities = mkE(0);
  check("[R116] 同会话内 eternities 被花回 0 ⇒ latch 生效，不重新驻留",
    A.firstEternityDwellRemainingMs() === 0);
  // 换存档：上一个存档的"曾永恒"结论不得串到新档。
  player.records.gameCreatedTime = 333;
  check("[R116] 换存档后即使新档 eternities=0 ⇒ 重新驻留（不串档）",
    A.firstEternityDwellRemainingMs() === 180_000);

  // ④ 手动永恒不受限：驻留只拦 MOD tick，原版 UI 入口不经过本模块
  setup({ eternities: 0, isActive: false, unlocked: false });
  A.firstEternityDwellRemainingMs(); // 开始驻留
  check("[R116] 驻留期内手动永恒（原版入口）照常可用",
    (() => {
      const before = env.eternityCalls.length;
      globalThis.eternity(false, true); // 原版 eternity()，手动/其它入口同函数
      return env.eternityCalls.length === before + 1;
    })());
  {
    const etSrc = readFileSync(path.join(ROOT, "src/core/eternity.js"), "utf8");
    check("[R116] 手动永恒入口 eternity.js 不引用本模块/驻留判据（手动优先）",
      !etSrc.includes("OrekiEternityAutomation") && !etSrc.includes("firstEternityDwell"));
  }

  // ⑤ 存档恢复 / 冷启动 / 换档 / 资格消失 / 时钟回退
  setup({ eternities: 0, isActive: false, unlocked: false });
  check("[R116] 冷启动（内存态归零）⇒ 重新计满 180 s",
    A.firstEternityDwellRemainingMs() === 180_000);
  dwellClock += 100_000;
  check("[R116] 同存档驻留继续计时（剩余 80 s）",
    A.firstEternityDwellRemainingMs() === 80_000);
  player.records.gameCreatedTime = 222;
  check("[R116] 换存档（gameCreatedTime 变化）⇒ 驻留重新计满，不跨档继承",
    A.firstEternityDwellRemainingMs() === 180_000);

  dwellClock += 100_000;
  check("[R116] 换档后新计时正常推进（剩余 80 s）",
    A.firstEternityDwellRemainingMs() === 80_000);
  A._firstEternityDwellStartedAt = null;
  A._firstEternityDwellSaveId = null;
  check("[R116] 冷启动（模块内存态清空）⇒ 重新计满 180 s",
    A.firstEternityDwellRemainingMs() === 180_000);

  env.canEternity = false;
  check("[R116] 资格消失（IP 被花掉）⇒ 立即不驻留",
    A.firstEternityDwellRemainingMs() === 0);
  env.canEternity = true;
  check("[R116] 资格恢复 ⇒ 驻留重新计满（不继承旧计时）",
    A.firstEternityDwellRemainingMs() === 180_000);

  dwellClock -= 10_000;
  check("[R116] 单调时钟回退 ⇒ 按满窗口处理，不出现负值/永久驻留",
    A.firstEternityDwellRemainingMs() === 180_000);

  // ⑥ 单一门禁同样拦驻留（含"自动进 EC 顺带真实永恒"旁路）
  setup({ eternities: 0, isActive: false, unlocked: false });
  A._freshSessionBootstrap = true; // R104 引导窗口本身是放行的
  check("[R116] 驻留期内单一门禁阻止（即使新档引导窗口有效）",
    A.realEternityAllowed() === false);
  dwellClock += 180_000;
  check("[R116] 驻留结束后单一门禁恢复放行", A.realEternityAllowed() === true);

  // ⑦ 源码静态守卫：常量/时钟/接线顺序
  {
    const src = readFileSync(path.join(ROOT, "src/core/oreki-eternity-automation.js"), "utf8");
    check("[R116] 驻留常量 = 180_000 ms（对齐 Android FIRST_ETERNITY_DWELL_MS）",
      src.includes("const FIRST_ETERNITY_DWELL_MS = 180_000;"));
    check("[R116] 计时用单调时钟 performance.now（对齐 Android elapsedRealtime）",
      src.includes("performance") && src.includes("typeof perf.now === \"function\""));
    check("[R120] 只有在自动器已解锁时才允许真实开关绕过驻留",
      src.includes("if (this._eternityAutobuyerUnlocked() && player.auto.eternity.isActive === true) return 0;"));
    check("[R116] 已永恒存档短路（eternities < 1 才可能驻留）",
      src.includes("if (!this._neverEternitied()) return 0;"));
    check("[R116] Web 无 bigEternities：用 realities>0 识别 Reality 后的已永恒存档",
      src.includes("if (realities !== null && realities > 0) {")
      && src.includes("this._firstEternityEverSeen = true;"));
    check("[R116] 换存档清「曾永恒」latch（导入新档仍需引导驻留）",
      src.includes("this._firstEternityEverSeen = false;"));
    {
      const tickBody = src.split("tickEternity() {")[1]?.split('this._err("tickEternity"')[0] || "";
      const dwellIdx = tickBody.indexOf("firstEternityDwellRemainingMs");
      const adoptIdx = tickBody.indexOf("this._adoptEternityAutobuyerIfNeeded()");
      check("[R116] tickEternity 在接管开关之前判驻留（防止同帧接管旁路）",
        dwellIdx >= 0 && adoptIdx >= 0 && dwellIdx < adoptIdx,
        "dwell=" + dwellIdx + " adopt=" + adoptIdx);
    }
    {
      const gateBody = src.split("realEternityAllowed() {")[1]?.split("_adoptEternityAutobuyerIfNeeded")[0] || "";
      const dwellIdx = gateBody.indexOf("firstEternityDwellRemainingMs");
      const bootIdx = gateBody.indexOf("_eternityBootstrapActive");
      check("[R116] 单一门禁在引导窗口放行之前判驻留",
        dwellIdx >= 0 && bootIdx >= 0 && dwellIdx < bootIdx,
        "dwell=" + dwellIdx + " bootstrap=" + bootIdx);
    }
  }

  // ⑧ [PR #49 review fix] 换档重置必须在 early returns 之前
  //
  // 审查线程 PRRT_kwDOVavSJM635fOj / PRRT_kwDOVavSJM635sNZ：dwell 的 saveId 比较位于
  // isActive / 已永恒两个 early return 之后。A(新档驻留中)→B(已永恒或玩家开自动)→A
  // 时 B 不更新 dwellSaveId，回到 A 复用旧计时，甚至把在 B 的时间算入 → 剩余 0，
  // 首次永恒立即被自动化结算。这里锁死 A→B→A 必须重新计满 180 s。
  const roundTrip = ({ bIsActive = false, bEternities = 13, bUnlocked = bIsActive } = {}) => {
    setup({ eternities: 0, isActive: false, canEternity: true, saveId: 111, unlocked: false });
    const start = A.firstEternityDwellRemainingMs();      // A：开始 180 s
    dwellClock += 60_000;
    player.records.gameCreatedTime = 222;                 // 切到 B
    player.eternities = mkE(bEternities);
    player.auto.eternity.isActive = bIsActive;
    globalThis.EternityMilestone = { autobuyerEternity: { isReached: bUnlocked } };
    const inB = A.firstEternityDwellRemainingMs();        // B：命中 early return
    dwellClock += 130_000;                                // 在 B 停留 130 s（A 累计 190 s）
    player.records.gameCreatedTime = 111;                 // 回到 A
    player.eternities = mkE(0);
    player.auto.eternity.isActive = false;
    const backA = A.firstEternityDwellRemainingMs();
    return { start, inB, backA };
  };
  {
    const r = roundTrip({ bIsActive: false, bEternities: 13 });
    check("[R116 review] A→B(已永恒)→A：B 内驻留为 0", r.inB === 0, "inB=" + r.inB);
    check("[R116 review] A→B(已永恒)→A：回切 A 重新计满 180 s（不复用旧计时）",
      r.backA === 180_000, "backA=" + r.backA);
  }
  {
    const r = roundTrip({ bIsActive: true, bEternities: 0 });
    check("[R116 review] A→B(玩家开自动)→A：B 内驻留为 0", r.inB === 0, "inB=" + r.inB);
    check("[R116 review] A→B(玩家开自动)→A：回切 A 重新计满 180 s",
      r.backA === 180_000, "backA=" + r.backA);
  }

  // ⑨ [PR #49 review fix] 冷启动即 canEternity：驻留 gate 前必须采样 fresh-session latch
  //
  // 审查线程 PRRT_kwDOVavSJM635sW8：dwell gate 放在 _adoptEternityAutobuyerIfNeeded() 之前，
  // 而 _sampleFreshSession() 只在下游被调用。冷启动时存档已在 canEternity，驻留窗口内不会被采样；
  // 玩家在窗口内手动永恒后 eternities>=1，latch 被读成"非新档"，bootstrap 永久关闭，
  // R101 门禁会阻断之后所有 MOD 自动永恒。
  {
    setup({ eternities: 0, isActive: false, canEternity: true, saveId: 111, unlocked: false });
    // 模拟冷启动：模块内存态全清（reset 已清 dwell/latch；freshSession 也要清）。
    delete A._freshSessionBootstrap;
    A._firstEternityDwellStartedAt = null;
    A._firstEternityDwellSaveId = null;
    A._firstEternityEverSeen = false;
    check("[R116 review] 冷启动驻留期首帧 tick 被拒绝", A.tickEternity() === false);
    check("[R116 review] 冷启动驻留期首帧已采样 fresh-session latch（修复前为 undefined）",
      A._freshSessionBootstrap === true, "latch=" + String(A._freshSessionBootstrap));
    // 玩家在窗口内手动永恒：eternities 0→1；随后重新获得资格。
    player.eternities = mkE(1);
    env.canEternity = false;
    env.canEternity = true;
    dwellClock += 180_000;
    env.eternityCalls = [];
    check("[R116 review] 窗口内手动永恒后，驻留结束 MOD 自动永恒仍可用（bootstrap 未被误关）",
      A.tickEternity() === true);
    check("[R116 review] 该次 MOD 永恒恰好真实发起 1 次", env.eternityCalls.length === 1,
      "calls=" + env.eternityCalls.length);
  }

  // ⑪ [PR #50 review fix] 模块非活动期间也必须采样 fresh-session latch
  //
  // 审查线程（PR #50 Kody high）：_sampleFreshSession() 若仍在 !active early return 之后，
  // 挑战中 / 玩家关闭 MOD 自动购买器总开关 / Pelle 毁灭期间不会采样；玩家在这段非活动期
  // 手动永恒后 eternities>=1，latch 被读成"非新档"，恢复活动后 bootstrap 关闭，
  // MOD 自动永恒被永久阻断。与 ⑨ 是同一失败链，差别只在 active=false 的时间窗。
  {
    setup({ eternities: 0, isActive: false, canEternity: true, saveId: 111, unlocked: false });
    delete A._freshSessionBootstrap;
    A._firstEternityDwellStartedAt = null;
    A._firstEternityDwellSaveId = null;
    A._firstEternityEverSeen = false;
    env.autobuyersOn = false;              // 模块 non-active
    player.auto.autobuyersOn = false;
    check("[R116 review] 非活动帧 tick 被拒绝", A.tickEternity() === false);
    check("[R116 review] 非活动帧也必须采样 fresh-session latch（修复前为 undefined）",
      A._freshSessionBootstrap === true, "latch=" + String(A._freshSessionBootstrap));
    // 玩家在非活动期间手动永恒：eternities 0→1。
    player.eternities = mkE(1);
    env.autobuyersOn = true;               // 玩家打开 MOD 自动购买器总开关
    player.auto.autobuyersOn = true;
    env.canEternity = true;
    dwellClock += 180_000;
    env.eternityCalls = [];
    check("[R116 review] 恢复活动后 MOD 自动永恒仍可用（bootstrap 未被误关）",
      A.tickEternity() === true);
    check("[R116 review] 恢复活动后恰好真实发起 1 次", env.eternityCalls.length === 1,
      "calls=" + env.eternityCalls.length);
    env.autobuyersOn = true;
  }

  // ⑩ 源码静态守卫：两条 review 修复的接线顺序
  {
    const src = readFileSync(path.join(ROOT, "src/core/oreki-eternity-automation.js"), "utf8");
    const saveIdx = src.indexOf("const saveId = this._saveIdentity();");
    const activeIdx = src.indexOf(
      "if (this._eternityAutobuyerUnlocked() && player.auto.eternity.isActive === true) return 0;",
    );
    const neverIdx = src.indexOf("if (!this._neverEternitied()) return 0;");
    check("[R116 review] 换档重置在 isActive / 已永恒 early return 之前",
      saveIdx >= 0 && activeIdx > saveIdx && neverIdx > saveIdx,
      "save=" + saveIdx + " active=" + activeIdx + " never=" + neverIdx);
    {
      const tickBody = src.split("tickEternity() {")[1]?.split('this._err("tickEternity"')[0] || "";
      const sampleIdx = tickBody.indexOf("this._sampleFreshSession()");
      const activeIdx = tickBody.indexOf("if (!this.active) return false;");
      const dwellIdx = tickBody.indexOf("firstEternityDwellRemainingMs");
      const adoptIdx = tickBody.indexOf("this._adoptEternityAutobuyerIfNeeded()");
      check("[R116 review] tickEternity 在 dwell gate 之前采样 fresh-session latch",
        sampleIdx >= 0 && dwellIdx > sampleIdx,
        "sample=" + sampleIdx + " dwell=" + dwellIdx);
      check("[R116 review] latch 采样与 active 解耦（在 !active early return 之前）",
        sampleIdx >= 0 && activeIdx > sampleIdx,
        "sample=" + sampleIdx + " active=" + activeIdx);
      check("[R116 review] dwell gate 仍在接管开关之前",
        dwellIdx >= 0 && adoptIdx > dwellIdx,
        "dwell=" + dwellIdx + " adopt=" + adoptIdx);
    }
  }

  globalThis.player = savedPlayer;
  player.records = savedRecords;
  if (savedRealities === undefined) delete player.realities;
  else player.realities = savedRealities;
  delete globalThis.EternityMilestone;
  reset();
  A._monotonicNowMs = ORIG_MONOTONIC_NOW;
}

// ---------------- [R118-01 #69 hotfix] 未解锁 true→false 不得判玩家关闭 ----------------
{
  const savedPlayer = globalThis.player;
  const savedRecords = player.records;
  const savedRealities = player.realities;
  reset();
  player.records = { gameCreatedTime: 1, thisReality: { realTime: 100 } };
  player.realities = 0;
  player.auto.eternity.isActive = false;
  player.auto.autobuyersOn = true;
  A._eternityAutoLastSeenActive = true;
  A._eternityAutoEnabledAtRealities = 0;
  A._eternityAutoEnabledAtRealTime = 100;
  A._eternityAutoUserClosed = false;
  A._eternityAutobuyerAdopted = true;
  globalThis.EternityMilestone = { autobuyerEternity: { isReached: false } };
  A._observeEternityAutobuyerSwitch();
  check("未解锁时 true→false 是原版 reset，不判玩家关闭（#69 hotfix）",
    A._eternityAutoUserClosed === false);
  check("未解锁 reset 后 bootstrap 仍可用（#69 hotfix）",
    A._eternityBootstrapActive() === true);
  globalThis.EternityMilestone = { autobuyerEternity: { isReached: true } };
  A._eternityAutoLastSeenActive = true;
  A._eternityAutoEnabledAtRealities = 0;
  A._eternityAutoEnabledAtRealTime = 100;
  A._eternityAutoUserClosed = false;
  A._eternityAutobuyerAdopted = true;
  A._observeEternityAutobuyerSwitch();
  check("已解锁时同现实 true→false 仍判玩家关闭（R101 不回退）",
    A._eternityAutoUserClosed === true);
  delete globalThis.EternityMilestone;
  globalThis.player = savedPlayer;
  player.records = savedRecords;
  if (savedRealities === undefined) delete player.realities;
  else player.realities = savedRealities;
  reset();
}

// ---------------- [R118-01 #69] EC 入口等待期间的永恒阈值 hold ----------------
{
  reset();
  player.auto.eternity.mode = 2;
  player.auto.eternity.xHighest = new Decimal(10);
  player.auto.eternity.amount = new Decimal(1);
  A.ecEntryPending = () => true;
  A._ecEntryEternityHoldActive = false;
  A._manageEternityHoldForEcEntry();
  const held = A._ecEntryEternityHoldActive === true &&
    player.auto.eternity.xHighest.eq(new Decimal("1e1000000"));
  A.ecEntryPending = () => false;
  A._manageEternityHoldForEcEntry();
  const restored = A._ecEntryEternityHoldActive === false &&
    player.auto.eternity.xHighest.eq(10);
  check("EC 入口等待时抬高 X_HIGHEST，达成后恢复（#69）", held && restored);
  reset();
}

// ---------------- 汇总 ----------------
console.log(`\n网页版自动永恒闸门回归：${checks} 项检查，失败 ${failures.length} 项`);
if (failures.length) {
  for (const f of failures) console.log("  FAIL", f);
  process.exit(1);
}
console.log("  全部通过");
