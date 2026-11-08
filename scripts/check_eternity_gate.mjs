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
};

globalThis.player = {
  auto: { autobuyersOn: true },
  options: {},
  requirementChecks: { reality: { noEternities: true } },
  records: {},
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
function arm({ hold = false, ec = false } = {}) {
  player.auto.autobuyersOn = env.autobuyersOn;
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

// ---------------- 汇总 ----------------
console.log(`\n网页版自动永恒闸门回归：${checks} 项检查，失败 ${failures.length} 项`);
if (failures.length) {
  for (const f of failures) console.log("  FAIL", f);
  process.exit(1);
}
console.log("  全部通过");
