#!/usr/bin/env node
/**
 * R80 Web 早期自动化行为自测（Node 直跑，无需浏览器）。
 *
 * 目的：证明本轮对 `OrekiEarlyAutomation.buyInfinityUpgrades()` 的两处修复
 * 在真实代码里成立，而不是靠读代码下结论：
 *
 *   缺陷 1（ipMult 永远买不到）
 *     `InfinityIPMultUpgrade` 继承 `GameMechanicState`，**没有**
 *     `isAvailableForPurchase` getter（返回 undefined）。
 *     旧代码 `if (!upgrade.isAvailableForPurchase) continue;` 恒为真
 *     → ipMult 每一帧都被跳过。本测试用一个「严格照原版形状」的假对象
 *     证明旧写法买 0 个、新写法买得到。
 *
 *   缺陷 2（一次性升级把 ipMult 挤到队尾）
 *     `InfinityUpgrade.all` 里 ipMult 排在最后（第 18 位）。
 *     旧写法一买到就 break，只要还有一次性升级可买，ipMult 永远轮不到。
 *     本测试构造「17 条一次性都可买 + ipMult 可买」，断言新代码两条路径都被执行。
 *
 * 用法：
 *   node scripts/test-early-ipmult.mjs
 * 退出码 0 = 全部通过。
 *
 * 为什么能在 Node 里跑：
 *   `oreki-early-automation.js` 的 `buyInfinityUpgrades()` 只依赖全局
 *   `InfinityUpgrade` / `player` / `Pelle` 等，全部可用垫片替代。
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "src", "core", "oreki-early-automation.js");
const code = readFileSync(SRC, "utf-8");

// ------------------------------------------------------------------ 假升级对象

/**
 * 一次性升级：形状照 `InfinityUpgradeState`（有 isAvailableForPurchase）。
 * @param {string} id
 * @param {{available?: boolean, affordable?: boolean}} opt
 */
function makeOneShot(id, opt = {}) {
  const state = {
    id,
    bought: false,
    purchases: 0,
    get isAvailableForPurchase() { return opt.available !== false; },
    get isBought() { return state.bought; },
    get canBeBought() { return !state.bought && opt.affordable !== false; },
    purchase() {
      if (!state.canBeBought) return false;
      state.bought = true;
      state.purchases++;
      return true;
    },
  };
  return state;
}

/**
 * ipMult：形状照 `InfinityIPMultUpgrade` —— **刻意不提供 isAvailableForPurchase**，
 * 这正是让它被旧代码误杀的根因。
 * @param {{affordable?: boolean}} opt
 */
function makeIpMult(opt = {}) {
  const state = {
    id: "ipMult",
    purchases: 0,
    get isBought() { return false; },
    get canBeBought() { return opt.affordable !== false; },
    purchase() {
      if (!state.canBeBought) return false;
      state.purchases++;
      return true;
    },
  };
  return state;
}

// ------------------------------------------------------------------ 宿主垫片

const sandbox = {
  console,
  Math,
  Object,
  Array,
  Number,
  String,
  JSON,
  Boolean,
  Error,
  globalThis: null,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

// 依赖替身：本测试只测 buyInfinityUpgrades()，其余全部给最小可运行壳。
sandbox.player = { auto: { autobuyersOn: true } };
sandbox.NormalChallenge = { isRunning: false };
sandbox.InfinityChallenge = { isRunning: false };
sandbox.EternityChallenge = { isRunning: false, isUnlocked: () => false };
sandbox.Pelle = { isDoomed: false };
sandbox.InfinityDimensions = { canBuy: () => false, all: [], buyMax: () => {} };
sandbox.ImaginaryUpgrade = { isAvailableForPurchase: false };
sandbox.MachineHandler = { isIMUnlocked: false };
sandbox.Currency = { realityMachines: { value: { powEffectOf: () => 1 } } };
sandbox.AlchemyResource = { force: 0 };
sandbox.OrekiIu15Sprint = { tick: () => {} };

// 把 ESM 改造成 vm 可执行脚本（去 import / 去 export，末尾挂到 globalThis）
const cjs = code
  .replace(/^import\s.*?;\s*$/gm, "")
  .replace(/^export\s+/gm, "")
  .concat("\nglobalThis.__EARLY__ = OrekiEarlyAutomation;\n");

vm.runInContext(cjs, sandbox, { filename: "oreki-early-automation.js" });
const EARLY = sandbox.__EARLY__;
if (!EARLY || typeof EARLY.buyInfinityUpgrades !== "function") {
  console.error("FATAL: 没能从源码里取出 OrekiEarlyAutomation.buyInfinityUpgrades");
  process.exit(2);
}

// ------------------------------------------------------------------ 断言工具

let checks = 0;
const fails = [];
function check(name, ok, detail = "") {
  checks++;
  if (!ok) fails.push(detail ? `${name}  ← ${detail}` : name);
}

// ------------------------------------------------------------------ 用例

// 用例 1：只有 ipMult 可买（首次永恒前的真实形态：一次性升级早已买完）
{
  const ipMult = makeIpMult();
  sandbox.InfinityUpgrade = { all: [ipMult] };
  const got = EARLY.buyInfinityUpgrades();
  check("ipMult 单条可买时必须买到（缺陷 1）", got === true && ipMult.purchases === 1,
    `got=${got} purchases=${ipMult.purchases}`);
}

// 用例 2：17 条一次性升级都可买 + ipMult 可买 → 两组都要动
{
  const oneshots = Array.from({ length: 17 }, (_, i) => makeOneShot(`u${i}`));
  const ipMult = makeIpMult();
  sandbox.InfinityUpgrade = { all: [...oneshots, ipMult] };
  const got = EARLY.buyInfinityUpgrades();
  const oneshotBought = oneshots.filter(u => u.purchases > 0).length;
  check("ipMult 不被一次性升级挤掉（缺陷 2）", ipMult.purchases === 1,
    `ipMult purchases=${ipMult.purchases}`);
  check("一次性升级仍按每帧 1 个的名额购买", oneshotBought === 1,
    `oneshot bought=${oneshotBought}`);
  check("返回值表示本帧确有动作", got === true, `got=${got}`);
}

// 用例 3：ipMult 买不起时不应报假成功
{
  const oneshots = Array.from({ length: 17 }, (_, i) => makeOneShot(`u${i}`, { affordable: false }));
  const ipMult = makeIpMult({ affordable: false });
  sandbox.InfinityUpgrade = { all: [...oneshots, ipMult] };
  const got = EARLY.buyInfinityUpgrades();
  check("全都买不起时返回 false（no-op 不占拍）", got === false, `got=${got}`);
  check("全都买不起时确实一个都没买", ipMult.purchases === 0, `purchases=${ipMult.purchases}`);
}

// 用例 4：一次性升级已全部买完 → 每帧仍能持续买 ipMult
{
  const ipMult = makeIpMult();
  sandbox.InfinityUpgrade = { all: [...Array.from({ length: 17 }, (_, i) => {
    const u = makeOneShot(`u${i}`);
    u.bought = true;
    return u;
  }), ipMult] };
  let hits = 0;
  for (let i = 0; i < 5; i++) {
    if (EARLY.buyInfinityUpgrades()) hits++;
  }
  check("买完一次性升级后 ipMult 可连续购买", ipMult.purchases === 5 && hits === 5,
    `purchases=${ipMult.purchases} hits=${hits}`);
}

// ------------------------------------------------------------------ 结果

if (fails.length === 0) {
  console.log(`PASS  ${checks}/${checks}  R80 早期自动化 IP 倍率修复`);
  process.exit(0);
}
console.error(`FAIL  ${fails.length}/${checks} 项未通过`);
for (const f of fails) console.error("  · " + f);
process.exit(1);
