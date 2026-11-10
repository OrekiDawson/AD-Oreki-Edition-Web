#!/usr/bin/env node
/**
 * R100 P1 方案 B：新档自动购买器解锁自测（Node 直跑，无需浏览器）。
 *
 * 目的：证明「新档立即解锁反物质维度 1～8 / 计数频率 / 维度提升 / 反物质星系自动购买器」
 * 在真实源码里成立，且**大坍缩自动购买器仍然只在首次真实大坍缩后解锁**。
 *
 * 做法：把四个自动购买器模块与 `autobuyer.js` 用 vm 载入，剥掉 import/export，
 * 用与源码形状一致的假 `Pelle` / `Player` / `NormalChallenge` / `PlayerProgress` 垫片，
 * 直接读 `isUnlocked` / `canTick` 的真实 getter。不复制业务逻辑、不改源码。
 *
 * 用法：node scripts/test-r100-newgame-autobuyers.mjs
 * 退出码 0 = 全部通过。
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "src", "core");

const checks = [];
let fails = 0;
function check(name, ok, detail = "") {
  checks.push(name);
  if (ok) {
    console.log(`PASS  ${name}${detail ? `  (${detail})` : ""}`);
  } else {
    fails += 1;
    console.error(`FAIL  ${name}${detail ? `  (${detail})` : ""}`);
  }
}

/** 把 ESM 源码改造成 vm 可执行脚本。 */
function loadModule(relPath, exportNames) {
  const code = readFileSync(join(SRC, relPath), "utf-8")
    .replace(/^import\s.*?;\s*$/gm, "")
    .replace(/^export\s+/gm, "");
  return { code, exportNames };
}

function makeSandbox() {
  const sandbox = {
    console,
    Math,
    Number,
    Array,
    Object,
    Error,
    NotImplementedError: class NotImplementedError extends Error {},
    // 原版常量垫片：本测试只关心 isUnlocked / canTick 分支，值本身不参与判断。
    DC: { E10: { pow: () => 0 }, E40: 0, E140: 0, D1: 1, D2: 2 },
    Decimal: { lt: () => false, gt: () => false, subtract: () => 0 },
    AUTOBUYER_MODE: { BUY_SINGLE: 0, BUY_10: 1 },
    AUTO_CRUNCH_MODE: { AMOUNT: 0, TIME: 1, X_HIGHEST: 2 },
    PRESTIGE_EVENT: { INFINITY: 1 },
    GameSpeed: undefined,
    // 反物质维度自动购买器的 canTick 会读这两个全局（源码 autobuyer 行 107/113）
    Autobuyer: { antimatterDimension: { collapseDisplay: false } },
    AntimatterDimension: () => ({ isAvailableForPurchase: true, isAffordable: true }),
    Tickspeed: { isAvailableForPurchase: true, isAffordable: true },
    DimBoost: { canBeBought: true, requirement: { isSatisfied: true } },
    Galaxy: { canBeBought: true, requirement: { isSatisfied: true } },
    getGlobalSpeedFactor: () => 1,
    // 默认：真正全新存档（未无限、未完成任何普通挑战、非毁灭）。
    player: {
      records: { realTimePlayed: 1e9 },
      auto: {
        autobuyersOn: true,
        antimatterDims: {
          all: Array.from({ length: 8 }, () => ({ isBought: false, isActive: true, lastTick: 0, interval: 500, cost: 1, bulk: 1, mode: 1 })),
          isActive: true,
        },
        tickspeed: { isBought: false, isActive: true, lastTick: 0, interval: 500, cost: 1, mode: 0 },
        dimBoost: { isActive: true, lastTick: 0, interval: 4000, cost: 1 },
        galaxy: { isActive: true, lastTick: 0, interval: 20000, cost: 1 },
        bigCrunch: { isActive: true, lastTick: 0, mode: 0, amount: 1 },
      },
    },
    Pelle: { isDisabled: () => false, isDoomed: false },
    NormalChallenge: id => ({ isCompleted: false, id }),
    PlayerProgress: { infinityUnlocked: () => false },
    Achievement: () => ({ isUnlocked: false, tryUnlock: () => {} }),
    GameUI: { update: () => {} },
    EternityMilestone: new Proxy({}, { get: () => ({ isReached: false }) }),
    PelleUpgrade: new Proxy({}, { get: () => ({ canBeApplied: false }) }),
    BreakInfinityUpgrade: new Proxy({}, { get: () => ({ isBought: false }) }),
    Laitela: { continuumActive: false },
    Currency: { infinityPoints: { purchase: () => true, value: 0 } },
    Player: { canCrunch: false, defaultStart: { auto: {
      antimatterDims: { all: Array.from({ length: 8 }, () => ({ interval: 500 })) },
      tickspeed: { interval: 500 }, dimBoost: { interval: 4000 }, galaxy: { interval: 20000 },
      bigCrunch: { interval: 150000 },
    } } },
  };
  sandbox.Math.clampMax = (v, m) => Math.min(v, m);
  sandbox.Math.clampMin = (v, m) => Math.max(v, m);
  sandbox.globalThis = sandbox;
  return sandbox;
}

const ctx = vm.createContext(makeSandbox());

/** 载入 autobuyer.js 基类，返回 AutobuyerState 等类。 */
function loadBase() {
  const src = readFileSync(join(SRC, "autobuyers/autobuyer.js"), "utf-8")
    .replace(/^import\s.*?;\s*$/gm, "")
    .replace(/^export\s+/gm, "");
  vm.runInContext(`${src}\n;globalThis.__base = { AutobuyerState, IntervaledAutobuyerState, UpgradeableAutobuyerState };`, ctx);
  return ctx.__base;
}

const base = loadBase();
ctx.AutobuyerState = base.AutobuyerState;
ctx.IntervaledAutobuyerState = base.IntervaledAutobuyerState;
ctx.UpgradeableAutobuyerState = base.UpgradeableAutobuyerState;

/** 载入一个具体自动购买器类。 */
function loadAutobuyer(file, className) {
  const src = readFileSync(join(SRC, "autobuyers", file), "utf-8")
    .replace(/^import\s.*?;\s*$/gm, "")
    .replace(/^export\s+/gm, "");
  vm.runInContext(`${src}\n;globalThis.__loaded = ${className};`, ctx);
  return ctx.__loaded;
}

const DimCls = loadAutobuyer("antimatter-dimension-autobuyer.js", "AntimatterDimensionAutobuyerState");
const TickCls = loadAutobuyer("tickspeed-autobuyer.js", "TickspeedAutobuyerState");
const BoostCls = loadAutobuyer("dimboost-autobuyer.js", "DimBoostAutobuyerState");
const GalaxyCls = loadAutobuyer("galaxy-autobuyer.js", "GalaxyAutobuyerState");
const CrunchCls = loadAutobuyer("big-crunch-autobuyer.js", "BigCrunchAutobuyerState");

// ---------------------------------------------------------------- 1. 全新存档解锁矩阵
for (let tier = 1; tier <= 8; tier += 1) {
  const inst = new DimCls(tier);
  check(`新档：反物质维度 ${tier} 自动购买器已解锁`, inst.isUnlocked === true, `isUnlocked=${inst.isUnlocked}`);
  check(`新档：反物质维度 ${tier} 自动购买器可 tick`, inst.canTick === true, `canTick=${inst.canTick}`);
}
{
  const t = new TickCls();
  check("新档：计数频率自动购买器已解锁", t.isUnlocked === true, `isUnlocked=${t.isUnlocked}`);
  check("新档：计数频率自动购买器可 tick", t.canTick === true, `canTick=${t.canTick}`);
}
{
  const d = new BoostCls();
  check("新档：维度提升自动购买器已解锁", d.isUnlocked === true, `isUnlocked=${d.isUnlocked}`);
}
{
  const g = new GalaxyCls();
  check("新档：反物质星系自动购买器已解锁", g.isUnlocked === true, `isUnlocked=${g.isUnlocked}`);
}

// ---------------------------------------------------------------- 2. 反向断言：大坍缩仍在首次大坍缩后
{
  const c = new CrunchCls();
  check("新档：大坍缩自动购买器【未】解锁（首次真实大坍缩前）", c.isUnlocked === false, `isUnlocked=${c.isUnlocked}`);
  check("新档：大坍缩自动购买器不可 tick", c.canTick === false, `canTick=${c.canTick}`);
}

// ---------------------------------------------------------------- 3. 反向断言：高层自动器不受影响
{
  const InfDimCls = loadAutobuyer("infinity-dimension-autobuyer.js", "InfinityDimensionAutobuyerState");
  const inst = new InfDimCls(1);
  check("新档：无限维度自动购买器仍未解锁（不越阶段）", inst.isUnlocked === false, `isUnlocked=${inst.isUnlocked}`);
}

// ---------------------------------------------------------------- 4. 首次真实大坍缩后，大坍缩自动器解锁
{
  // 用独立的 vm 上下文重载，避免同一上下文重复声明类名
  const ctx2 = vm.createContext({ ...makeSandbox(), PlayerProgress: { infinityUnlocked: () => true } });
  ctx2.globalThis = ctx2;
  const baseSrc = readFileSync(join(SRC, "autobuyers/autobuyer.js"), "utf-8")
    .replace(/^import\s.*?;\s*$/gm, "").replace(/^export\s+/gm, "");
  vm.runInContext(`${baseSrc}\n;globalThis.AutobuyerState=AutobuyerState;globalThis.IntervaledAutobuyerState=IntervaledAutobuyerState;globalThis.UpgradeableAutobuyerState=UpgradeableAutobuyerState;`, ctx2);
  const crunchSrc = readFileSync(join(SRC, "autobuyers/big-crunch-autobuyer.js"), "utf-8")
    .replace(/^import\s.*?;\s*$/gm, "").replace(/^export\s+/gm, "");
  vm.runInContext(`${crunchSrc}\n;globalThis.__loaded = BigCrunchAutobuyerState;`, ctx2);
  const inst = new ctx2.__loaded();
  check("首次大坍缩后：大坍缩自动购买器已解锁", inst.isUnlocked === true, `isUnlocked=${inst.isUnlocked}`);
}

// ---------------------------------------------------------------- 5. 总开关 / 单项开关仍然生效
{
  const dim = new DimCls(1);
  ctx.player.auto.autobuyersOn = false;
  check("关闭原版自动购买器总开关后不 tick", dim.canTick === false, `canTick=${dim.canTick}`);
  ctx.player.auto.autobuyersOn = true;
  dim.isActive = false;
  check("单项关闭后不 tick", dim.canTick === false, `canTick=${dim.canTick}`);
  dim.isActive = true;
  check("单项重新打开后恢复 tick", dim.canTick === true, `canTick=${dim.canTick}`);
}

// ---------------------------------------------------------------- 6. 已购买升级(isBought) 未被本改动写入
{
  for (let tier = 1; tier <= 8; tier += 1) {
    const inst = new DimCls(tier);
    check(`新档：维度 ${tier} 未写 isBought（不改购买记录）`, inst.isBought === false, `isBought=${inst.isBought}`);
  }
  const t = new TickCls();
  check("新档：计数频率未写 isBought（不改购买记录）", t.isBought === false, `isBought=${t.isBought}`);
}

// ---------------------------------------------------------------- 7. 实际执行：tick() 真的调用原版购买函数
{
  // 用真实 tick()，只把最底层的原版购买函数换成计数器（不复制业务逻辑）
  let buy10 = 0;
  ctx.buyMaxDimension = () => { buy10 += 1; };
  ctx.buyOneDimension = () => {};
  const dim1 = new DimCls(1);
  // BUY_10 是默认模式；bulk=1
  dim1.data.mode = 1;
  dim1.tick();
  check("实际执行：反物质维度自动购买器 tick() 调用了原版 buyMaxDimension", buy10 === 1, `calls=${buy10}`);

  let tickBuy = 0;
  ctx.buyTickSpeed = () => { tickBuy += 1; };
  const ts = new TickCls();
  const before = ts.data.lastTick;
  ts.tick();
  check("实际执行：计数频率自动购买器 tick() 调用了原版购买函数", tickBuy === 1, `calls=${tickBuy}`);
  check("实际执行：tick() 按原版语义推进 lastTick", ts.data.lastTick !== before, `lastTick ${before} -> ${ts.data.lastTick}`);
}

// ---------------------------------------------------------------- 结果
console.log("");
if (fails === 0) {
  console.log(`PASS  ${checks.length}/${checks.length}  R100 P1 新档自动购买器解锁`);
  process.exit(0);
}
console.error(`FAIL  ${fails}/${checks.length} 项未通过`);
process.exit(1);
