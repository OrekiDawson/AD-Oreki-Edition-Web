#!/usr/bin/env node
/**
 * [R120-01] 调度器自动购买器最高控制权 —— 真实 Chromium 定向验收。
 *
 * 覆盖：
 *   1. 策略要求开启/关闭时，手动反向修改仅保留到下一调度 tick；
 *   2. 连续修改维度、计数频率、限额、献祭与大坍缩阈值后同 tick 统一恢复；
 *   3. 大坍缩 mode/time 与启用状态共享同一托管节拍；
 *   4. 同一 tick 重入不写，配置已达标的新 tick 零写入；
 *   5. 保存并重载后，原版存档中的手动值由下一调度 tick 恢复；
 *   6. 所有写入发生在真实原版 `player.auto` 字段，并保持页面无异常。
 *
 * 本脚本不伪造资源或归档结果：先等待新档真实完成首次无限，再操作已解锁自动器。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPlaywright, startStaticServer } from "./lib/browser-harness.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "reports", "R120-01", "scheduler-authority");
fs.mkdirSync(OUT, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const playwright = loadPlaywright([
  path.join(ROOT, "node_modules"),
  "/home/oreki/AD-Oreki-Edition/工作树/web/r120-01",
  "/home/oreki/AD-Oreki-Edition/node_modules",
]);
const { server, url } = await startStaticServer(ROOT);
let browser = null;
const consoleErrors = [];
const pageErrors = [];
const result = {
  criterion: "R120-01 managed autobuyer scheduler authority",
  source: {
    repo: ROOT,
    sha: process.env.R120_SOURCE_SHA || null,
  },
  browser: null,
  server: url,
  stage: null,
  checks: [],
  consoleErrors,
  pageErrors,
  result: "FAIL",
};

try {
  browser = await playwright.chromium.launch({
    headless: true,
    args: [
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "--disable-features=CalculateNativeWinOcclusion",
      "--mute-audio",
      "--no-sandbox",
      "--disable-dev-shm-usage",
    ],
  });
  result.browser = {
    version: browser.version(),
    executable: playwright.chromium.executablePath(),
  };
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    locale: "zh-CN",
  });
  const page = await context.newPage();
  page.on("pageerror", error => pageErrors.push(String(error && error.stack || error)));
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForFunction(
    () => globalThis.player && globalThis.Autobuyer &&
      globalThis.OrekiManagedAutobuyerState && globalThis.OrekiManagedCrunchInterval,
    null,
    { timeout: 120_000 },
  );
  // 等待真实首次无限，使大坍缩自动器通过原版进度合法解锁。
  await page.waitForFunction(
    () => {
      try {
        const inf = Currency && Currency.infinities && Currency.infinities.value;
        return Boolean(inf && inf.gt(0));
      } catch (e) {
        return false;
      }
    },
    null,
    { timeout: 90_000, polling: 250 },
  );
  result.stage = await page.evaluate(() => ({
    infinities: Currency?.infinities?.value?.toString?.() ?? null,
    break: player.break === true,
    realities: player.realities?.toString?.() ?? null,
    crunchUnlocked: Boolean(Autobuyer.bigCrunch?.isUnlocked),
  }));

  const live = await page.evaluate(() => {
    const state = OrekiManagedAutobuyerState;
    const interval = OrekiManagedCrunchInterval;
    const cfg = state.MANAGED_FIELDS;
    const checks = [];
    const check = (name, condition, detail) => {
      if (!condition) throw new Error(`${name}: ${detail}`);
      const item = { name, pass: true, detail };
      checks.push(item);
      return item;
    };
    const activeAll = () => {
      const dims = player.auto.antimatterDims;
      return dims.isActive === true && dims.all.every(dim => dim.isActive === true);
    };
    state.resetForTest();
    interval.resetForTest();

    const tick = OrekiSmartExecutor.hostingTick() + 1_000_000;
    state.applyAll({ wantCrunch: true, autobuyers: Autobuyer, tick });
    const baselineGame = player.records.gameCreatedTime;
    interval.apply(60, "r120-baseline", tick);
    check("真实大坍缩自动器已合法解锁", Autobuyer.bigCrunch.isUnlocked === true,
      `unlocked=${Autobuyer.bigCrunch.isUnlocked}`);

    player.auto.antimatterDims.isActive = false;
    player.auto.antimatterDims.all[0].isActive = false;
    player.auto.tickspeed.isActive = false;
    player.auto.dimBoost.isActive = false;
    player.auto.galaxy.isActive = false;
    for (const dim of player.auto.antimatterDims.all) dim.mode = AUTOBUYER_MODE.BUY_SINGLE;
    player.auto.tickspeed.mode = AUTOBUYER_MODE.BUY_MAX;
    player.auto.dimBoost.limitDimBoosts = true;
    player.auto.dimBoost.limitUntilGalaxies = true;
    player.auto.galaxy.limitGalaxies = true;
    player.auto.sacrifice.multiplier = new Decimal(999);
    player.auto.bigCrunch.isActive = true;
    player.auto.bigCrunch.amount = new Decimal(999);
    player.auto.bigCrunch.xHighest = new Decimal(999);
    player.auto.bigCrunch.increaseWithMult = true;
    player.auto.bigCrunch.mode = AUTO_CRUNCH_MODE.X_HIGHEST;
    player.auto.bigCrunch.time = 999;

    const same = state.applyAll({ wantCrunch: false, autobuyers: Autobuyer, tick });
    check("同一调度 tick 不抢写", same.reason === "tick-wait", `reason=${same.reason}`);
    check("手动修改在 tick 前临时保留",
      player.auto.antimatterDims.isActive === false &&
      player.auto.bigCrunch.isActive === true &&
      player.auto.bigCrunch.mode === AUTO_CRUNCH_MODE.X_HIGHEST,
      "同 tick 内玩家值保持不变");

    const applied = state.applyAll({
      wantCrunch: false,
      autobuyers: Autobuyer,
      tick: tick + 1,
    });
    check("策略要求开启的自动器恢复开启", activeAll() && player.auto.tickspeed.isActive &&
      player.auto.dimBoost.isActive && player.auto.galaxy.isActive,
      `restored=${applied.restored.join(",")}`);
    check("策略要求关闭的大坍缩恢复关闭", player.auto.bigCrunch.isActive === false,
      `active=${player.auto.bigCrunch.isActive}`);
    check("维度购买模式恢复 BUY_10",
      player.auto.antimatterDims.all.every(dim => dim.mode === AUTOBUYER_MODE.BUY_10),
      player.auto.antimatterDims.all.map(dim => dim.mode).join(","));
    check("计数频率购买模式恢复 BUY_SINGLE",
      player.auto.tickspeed.mode === AUTOBUYER_MODE.BUY_SINGLE,
      `mode=${player.auto.tickspeed.mode}`);
    check("维度提升/星系限额恢复", player.auto.dimBoost.limitDimBoosts === false &&
      player.auto.dimBoost.limitUntilGalaxies === false &&
      player.auto.galaxy.limitGalaxies === false,
      `limitDimBoosts=${player.auto.dimBoost.limitDimBoosts} ` +
      `limitUntilGalaxies=${player.auto.dimBoost.limitUntilGalaxies} ` +
      `limitGalaxies=${player.auto.galaxy.limitGalaxies}`);
    check("献祭与大坍缩阈值恢复",
      (!Autobuyer.sacrifice.isUnlocked ||
        player.auto.sacrifice.multiplier.eq(new Decimal(cfg.sacrificeMultiplier))) &&
      player.auto.bigCrunch.amount.eq(new Decimal(cfg.crunchAmount)) &&
      player.auto.bigCrunch.xHighest.eq(new Decimal(cfg.crunchXHighest)) &&
      player.auto.bigCrunch.increaseWithMult === cfg.crunchIncreaseWithMult,
      `sacrificeUnlocked=${Autobuyer.sacrifice.isUnlocked} ` +
      `sacrifice=${player.auto.sacrifice.multiplier} ` +
      `amount=${player.auto.bigCrunch.amount} xHighest=${player.auto.bigCrunch.xHighest} ` +
      `increase=${player.auto.bigCrunch.increaseWithMult}`);

    interval.apply(5, "r120-stage-resume", tick + 1);
    check("大坍缩 mode/time 恢复同一策略拍", player.auto.bigCrunch.mode === AUTO_CRUNCH_MODE.TIME &&
      Math.abs(player.auto.bigCrunch.time - 5) < 1e-9,
      `mode=${player.auto.bigCrunch.mode} time=${player.auto.bigCrunch.time}`);

    player.auto.bigCrunch.mode = AUTO_CRUNCH_MODE.AMOUNT;
    player.auto.bigCrunch.time = 77;
    const sameInterval = interval.apply(60, "r120-same-interval-tick", tick + 1);
    check("同一 tick 不重复写 mode/time", sameInterval === false &&
      player.auto.bigCrunch.mode === AUTO_CRUNCH_MODE.AMOUNT &&
      player.auto.bigCrunch.time === 77,
      `same=${sameInterval} mode=${player.auto.bigCrunch.mode} time=${player.auto.bigCrunch.time}`);
    interval.apply(60, "r120-next-interval-tick", tick + 2);
    check("下一 tick 恢复 mode/time", player.auto.bigCrunch.mode === AUTO_CRUNCH_MODE.TIME &&
      Math.abs(player.auto.bigCrunch.time - 60) < 1e-9,
      `mode=${player.auto.bigCrunch.mode} time=${player.auto.bigCrunch.time}`);

    const writesBefore = state.debugState().writes;
    const idem = state.applyAll({
      wantCrunch: false,
      autobuyers: Autobuyer,
      tick: tick + 2,
    });
    const intervalWritesBefore = interval.describe().writes;
    const idemInterval = interval.apply(60, "r120-idempotent", tick + 3);
    check("重复执行 tick 零写入",
      idem.wrote === 0 && state.debugState().writes === writesBefore &&
      idemInterval === false && interval.describe().writes === intervalWritesBefore,
      `activeWrites=${idem.wrote} intervalWrite=${idemInterval}`);

    player.auto.bigCrunch.isActive = true;
    state.applyAll({ wantCrunch: true, autobuyers: Autobuyer, tick: tick + 3 });
    check("阶段目标反转后下一 tick 开启大坍缩", player.auto.bigCrunch.isActive === true,
      `active=${player.auto.bigCrunch.isActive}`);

    // 为 reload 验收写入一组尚未恢复的手动值，并走原版存档入口持久化。
    player.auto.antimatterDims.isActive = false;
    player.auto.antimatterDims.all[1].isActive = false;
    player.auto.tickspeed.isActive = false;
    player.auto.tickspeed.mode = AUTOBUYER_MODE.BUY_SINGLE;
    player.auto.bigCrunch.amount = new Decimal(123);
    player.auto.bigCrunch.xHighest = new Decimal(456);
    player.auto.bigCrunch.mode = AUTO_CRUNCH_MODE.AMOUNT;
    player.auto.bigCrunch.time = 321;
    GameStorage.save(true);
    return {
      checks: [
        ...checks,
        check("真实存档入口完成写入", localStorage.getItem(GameStorage.localStorageKey) !== null,
          `gameCreatedTime=${baselineGame}`),
      ],
      gameCreatedTime: baselineGame,
    };
  });
  result.checks.push(...live.checks);

  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForFunction(
    () => globalThis.player && globalThis.OrekiManagedAutobuyerState &&
      globalThis.OrekiManagedCrunchInterval &&
      globalThis.OrekiSmartExecutor.debugState().hosting.tick >= 1,
    null,
    { timeout: 120_000, polling: 100 },
  );
  await page.waitForFunction(
    () => {
      try {
        const dims = player.auto.antimatterDims;
        return dims.isActive === true && dims.all[1].isActive === true &&
          player.auto.tickspeed.isActive === true &&
          player.auto.tickspeed.mode === AUTOBUYER_MODE.BUY_SINGLE &&
          player.auto.bigCrunch.amount.eq(new Decimal(10)) &&
          player.auto.bigCrunch.xHighest.eq(new Decimal(10)) &&
          player.auto.bigCrunch.mode === AUTO_CRUNCH_MODE.TIME;
      } catch (e) {
        return false;
      }
    },
    null,
    { timeout: 30_000, polling: 100 },
  );
  result.checks.push(await page.evaluate(() => {
    const state = OrekiManagedAutobuyerState.debugState();
    const interval = OrekiManagedCrunchInterval.describe();
    if (state.lastTick < 1 || interval.lastTick < 1) {
      throw new Error(`reload ticks missing active=${state.lastTick} interval=${interval.lastTick}`);
    }
    return {
      name: "保存并 reload 后下一调度 tick 恢复策略值",
      pass: true,
      detail: `activeTick=${state.lastTick} intervalTick=${interval.lastTick} ` +
        `mode=${player.auto.bigCrunch.mode} time=${player.auto.bigCrunch.time}`,
    };
  }));
  await page.screenshot({
    path: path.join(OUT, "managed-authority-final.png"),
    fullPage: false,
  });

  assert(pageErrors.length === 0, `pageerrors=${pageErrors.length}`);
  assert(consoleErrors.length === 0, `consoleErrors=${consoleErrors.length}`);
  result.result = "PASS";
} catch (error) {
  result.error = String(error && error.stack || error);
  result.result = "FAIL";
} finally {
  try { if (browser) await browser.close(); } catch (e) { /* ignore */ }
  await new Promise(resolve => server.close(resolve));
  result.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.result === "PASS" ? 0 : 1;
}
