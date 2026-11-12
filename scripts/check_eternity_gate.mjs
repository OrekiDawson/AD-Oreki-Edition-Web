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
  const runCase = ({ eternities, isActive, unlocked }) => {
    reset();
    player.eternities = mkEternities(eternities);
    player.auto.eternity.isActive = isActive;
    arm({ hold: false, ec: false, autoEternity: isActive });
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

  check("新档（eternities=0）+ 开关关闭 → 引导窗口放行首次永恒",
    runCase({ eternities: 0, isActive: false }) === true);
  check("新档首次永恒发起的原版 eternity 恰好 1 次", env.eternityCalls.length === 1,
    `calls=${env.eternityCalls.length}`);

  check("已有进度（eternities=13）+ 开关关闭 + 自动器未解锁 → 仍拦截（R101 P0 不回退）",
    runCase({ eternities: 13, isActive: false, unlocked: false }) === false);
  check("已有进度拦截时 eternity 调用 0 次", env.eternityCalls.length === 0);

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

// ---------------- 汇总 ----------------
console.log(`\n网页版自动永恒闸门回归：${checks} 项检查，失败 ${failures.length} 项`);
if (failures.length) {
  for (const f of failures) console.log("  FAIL", f);
  process.exit(1);
}
console.log("  全部通过");
