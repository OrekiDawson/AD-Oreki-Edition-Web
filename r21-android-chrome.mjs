// R21：在 Android 模拟器内的 Chrome（真实 Android 浏览器）里驱动真实新档
//
// 与 verify-real-newgame-to-eternity.mjs 的区别：
//   - 不自己起桌面浏览器，puppeteer.connect 到 `adb forward` 出来的
//     chrome_devtools_remote，页面是模拟器里 Chrome 打开的那个页签；
//   - 阶段判定完全一样（不伪造状态，只做真实 API 调用）；
//   - 额外产出 UI 断言：侧栏 10 项顺序、横向溢出、教程入口、控制台错误。
//
// 用法：node r21-android-chrome.mjs <总时长秒> [jsonl]
// 前置：adb forward tcp:9222 localabstract:chrome_devtools_remote
//       Chrome 已打开 http://10.0.2.2:8099/index.html
import fs from "node:fs";
import puppeteer from "puppeteer-core";

const DURATION = Number(process.argv[2] || 900) * 1000;
const JSONL = process.argv[3] || "";
const CDP = process.env.CDP_URL || "http://127.0.0.1:9222";

const log = (...a) => console.log(...a);

const browser = await puppeteer.connect({ browserURL: CDP, defaultViewport: null });
const pages = await browser.pages();
log(`已连接 CDP，页签数=${pages.length}`);
for (const p of pages) log(`  tab: ${p.url()}`);

let page = pages.find(p => p.url().includes("10.0.2.2:8099")) ||
  pages.find(p => p.url().includes("index.html"));
if (!page) {
  log("没找到游戏页签，列出全部 URL 后退出");
  await browser.disconnect();
  process.exit(2);
}
log(`使用页签: ${page.url()}`);

const consoleErrors = [];
page.on("console", m => {
  if (m.type() === "error" || m.type() === "warning") consoleErrors.push(`[${m.type()}] ${m.text()}`);
});
page.on("pageerror", e => consoleErrors.push(`[pageerror] ${String(e && e.message || e)}`));

// ── UA / 视口事实 ────────────────────────────────────────────
const env = await page.evaluate(() => ({
  ua: navigator.userAgent,
  devicePixelRatio: window.devicePixelRatio,
  screenW: screen.width, screenH: screen.height,
  innerW: innerWidth, innerH: innerHeight,
  chromeVersion: (navigator.userAgent.match(/Chrome\/[\d.]+/) || [""])[0],
  hardwareConcurrency: navigator.hardwareConcurrency,
}));
log(`环境: ${JSON.stringify(env)}`);

// ── 全新存档 ────────────────────────────────────────────────
await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
await page.reload({ waitUntil: "load", timeout: 120000 });
for (let i = 0; i < 300; i++) {
  const ok = await page.evaluate(() => {
    try { return typeof player === "object" && typeof AntimatterDimension === "function"; }
    catch { return false; }
  }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

// ── UI 断言（新档首屏） ────────────────────────────────────
const ui = await page.evaluate(() => {
  const out = {};
  const docEl = document.documentElement;
  out.scrollWidth = docEl.scrollWidth;
  out.clientWidth = docEl.clientWidth;
  out.horizontalOverflow = docEl.scrollWidth > docEl.clientWidth + 1;
  out.bodyOverflow = document.body.scrollWidth > docEl.clientWidth + 1;

  // 侧栏（左侧 tab 列）文本顺序
  const side = document.querySelector(".l-tab-bar, .c-tab-bar, .tab-bar, #tabs");
  const tabs = [...document.querySelectorAll(".l-tab-bar__tab, .c-tab-bar__tab, .tab")];
  out.tabCount = tabs.length;
  out.tabTexts = tabs.map(t => (t.textContent || "").trim().replace(/\s+/g, "")).filter(Boolean);

  const entry = document.getElementById("oreki-tutorial-entry");
  out.tutorialEntry = entry ? (() => {
    const r = entry.getBoundingClientRect();
    return {
      exists: true, w: Math.round(r.width), h: Math.round(r.height),
      x: Math.round(r.x), y: Math.round(r.y),
      inViewport: r.x >= 0 && r.y >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
      visible: getComputedStyle(entry).display !== "none" && r.width > 0,
      text: (entry.textContent || "").trim(),
    };
  })() : { exists: false };
  out.sideBarFound = !!side;
  out.hasLoadingGone = !document.getElementById("loading") || getComputedStyle(document.getElementById("loading")).display === "none";
  out.playerExists = typeof player === "object";
  return out;
});
log(`UI: ${JSON.stringify(ui, null, 1)}`);

// ── 自动化驱动（与桌面脚本同源，全部走真实 API） ────────────
const install = await page.evaluate(() => {
  try {
    const st = { upg: 0, ipMult: 0, interval: 0, idBuy: 0, idUnlock: 0, crunch: 0, breakCalls: 0, etCalls: 0, errs: [] };
    globalThis.__st = st;
    globalThis.__ticks = 0;
    const step = () => {
      globalThis.__ticks++;
      try {
        for (let t = 8; t >= 1; t--) {
          const d = AntimatterDimension(t);
          if (d.isAvailableForPurchase && d.isAffordable) { buyMaxDimension(t); st.upg++; }
        }
        try { if (typeof buyTickSpeed === "function") buyTickSpeed(); } catch (e) { /* ignore */ }
        try { if (DimBoost.canBeBought) requestDimensionBoost(1); } catch (e) { /* ignore */ }
        try { if (Galaxy.canBeBought) requestGalaxyReset(1); } catch (e) { /* ignore */ }
        for (const u of InfinityUpgrade.all) {
          try { if (u.isAvailableForPurchase && u.canBeBought) { u.purchase(); st.upg++; } } catch (e) { /* ignore */ }
        }
        try { if (InfinityUpgrade.ipMult.canBeBought) { InfinityUpgrade.ipMult.buyMax(); st.ipMult++; } } catch (e) { /* ignore */ }
        try {
          const bc = Autobuyer.bigCrunch;
          while (!bc.hasMaxedInterval) {
            if (!bc.canBeUpgraded) break;
            const before = bc.interval;
            bc.upgradeInterval(false);
            if (bc.interval === before) break;
            st.interval++;
          }
          if (bc.hasMaxedInterval && !player.break) { breakInfinity(); st.breakCalls++; }
        } catch (e) { /* ignore */ }
        try {
          for (let t = 1; t <= 8; t++) {
            const d = InfinityDimension(t);
            if (!d.isUnlocked) { if (d.canUnlock) { d.unlock(); st.idUnlock++; } }
            else if (d.isAvailableForPurchase && d.isAffordable) { const b = d.amount; d.buyMax(); if (!b.eq(d.amount)) st.idBuy++; }
          }
        } catch (e) { /* ignore */ }
        try { for (const u of BreakInfinityUpgrade.all) { if (u.canBeBought) u.purchase(); } } catch (e) { /* ignore */ }
        try {
          if (!player.break) { if (Player.canCrunch) { bigCrunchReset(); st.crunch++; } }
          else if (!player.auto.bigCrunch.isActive) { player.auto.bigCrunch.isActive = true; }
        } catch (e) { /* ignore */ }
        try { if (Player.canEternity) { eternity(false); st.etCalls++; } }
        catch (e) { if (st.errs.length < 6) st.errs.push(String(e && e.message || e)); }
      } catch (e) { if (st.errs.length < 6) st.errs.push(String(e && e.message || e)); }
    };
    setInterval(step, 10);
    setTimeout(step, 0);
    return null;
  } catch (e) { return String(e && e.message || e); }
});
if (install) { log("驱动安装失败: " + install); await browser.disconnect(); process.exit(1); }

const T0 = Date.now();
const stages = {};
let printed = -1;
const samples = [];
let fpsProbe = null;

while (Date.now() - T0 < DURATION) {
  const s = await page.evaluate(() => {
    const S = v => { try { return v === null || v === undefined ? null : v.toString(); } catch (e) { return null; } };
    const L = v => {
      const t = S(v); if (t === null) return null;
      const i = t.indexOf("e");
      if (i >= 0) return Math.log10(Math.abs(Number(t.slice(0, i)))) + Number(t.slice(i + 1));
      return Math.log10(Math.abs(Number(t)) || 1);
    };
    const st = globalThis.__st || {};
    const ids = [];
    for (let t = 1; t <= 8; t++) { try { ids.push(InfinityDimension(t).isUnlocked ? 1 : 0); } catch (e) { ids.push(0); } }
    return {
      amL: L(Currency.antimatter.value),
      maxInfL: L(player.records.thisInfinity.maxAM),
      maxEtL: L(player.records.thisEternity.maxAM),
      ipL: L(player.infinityPoints),
      maxIPL: L(player.records.thisEternity.maxIP),
      inf: L(player.infinities), et: L(player.eternities),
      brk: player.break, canCrunch: Player.canCrunch,
      upg: player.infinityUpgrades.size,
      ipMult: player.IPMultPurchases,
      bcInterval: player.auto.bigCrunch.interval,
      ids, id1u: ids[0] === 1,
      canEt: Player.canEternity,
      goalL: L(Player.eternityGoal),
      mult: L(GameCache.totalIPMult.value),
      ticks: globalThis.__ticks,
      st: { upg: st.upg, ipMult: st.ipMult, interval: st.interval, idBuy: st.idBuy, idUnlock: st.idUnlock, crunch: st.crunch, etCalls: st.etCalls, errs: st.errs },
    };
  }).catch(e => ({ err: String(e && e.message || e) }));
  if (s.err) { await new Promise(r => setTimeout(r, 1000)); continue; }

  const t = +((Date.now() - T0) / 1000).toFixed(0);
  const mark = (k, c) => { if (c && stages[k] === undefined) { stages[k] = t; log(`  ★ ${k} @ ${t}s`); } };
  mark("首次无限", s.inf >= 1);
  mark("16个无限升级", s.upg >= 16);
  mark("间隔拉满", s.bcInterval <= 100);
  mark("Break", s.brk === true);
  mark("ID1解锁", s.id1u === true);
  mark("canEternity", s.canEt === true);
  mark("首次永恒", s.et >= 1);

  if (t % 15 === 0 && t !== printed) {
    printed = t;
    log(`t=${String(t).padStart(4)}s am=1e${String(s.amL).slice(0, 7)} maxEt=1e${String(s.maxEtL).slice(0, 7)} IP=1e${String(s.ipL).slice(0, 7)} inf=${s.inf} 升级=${s.upg} ipMult=${s.ipMult} 间隔=${s.bcInterval} brk=${s.brk} ID=[${s.ids.join("")}] canEt=${s.canEt} ticks=${s.ticks}`);
  }
  if (JSONL) {
    try {
      fs.appendFileSync(JSONL, JSON.stringify({
        t, amL: s.amL, maxEtL: s.maxEtL, ipL: s.ipL, maxIPL: s.maxIPL, inf: s.inf, et: s.et,
        brk: s.brk, upg: s.upg, ipMult: s.ipMult, bcInterval: s.bcInterval, ids: s.ids,
        canEt: s.canEt, crunch: s.st.crunch, etCalls: s.st.etCalls, mult: s.mult, ticks: s.ticks,
      }) + "\n");
    } catch (e) { /* ignore */ }
  }
  samples.push({ t, ...s });
  if (s.et >= 1) break;
  await new Promise(r => setTimeout(r, 1000));
}

// ── 采样期帧率（衡量模拟器 Chrome 的真实渲染能力）───────────
fpsProbe = await page.evaluate(() => new Promise(res => {
  let n = 0; const t0 = performance.now();
  const tick = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else res({ frames: n, ms: Math.round(performance.now() - t0) }); };
  requestAnimationFrame(tick);
})).catch(() => null);

const fin = await page.evaluate(() => globalThis.__st).catch(() => null);
const finalUi = await page.evaluate(() => {
  const docEl = document.documentElement;
  return {
    scrollWidth: docEl.scrollWidth, clientWidth: docEl.clientWidth,
    horizontalOverflow: docEl.scrollWidth > docEl.clientWidth + 1,
    innerW: innerWidth, innerH: innerHeight,
  };
}).catch(() => null);

log(`\n===== 结果（${Math.round((Date.now() - T0) / 1000)}s）=====`);
log(`里程碑: ${JSON.stringify(stages)}`);
log(`驱动统计: ${JSON.stringify(fin)}`);
log(`采样期帧率: ${JSON.stringify(fpsProbe)}`);
log(`末态 UI: ${JSON.stringify(finalUi)}`);
const last = samples[samples.length - 1];
if (last) {
  log(`末态: IP=1e${String(last.ipL).slice(0, 7)} maxIP=1e${String(last.maxIPL).slice(0, 7)} maxEt=1e${String(last.maxEtL).slice(0, 7)} inf=${last.inf} 升级=${last.upg} ipMult=${last.ipMult} 间隔=${last.bcInterval} brk=${last.brk} ID=[${last.ids.join("")}] canEt=${last.canEt} 永恒=${last.et}`);
  log(`永恒门槛=1e${String(last.goalL).slice(0, 7)}  totalIPMult=1e${String(last.mult).slice(0, 6)}`);
}
if (consoleErrors.length) {
  log(`控制台错误/警告 ${consoleErrors.length} 条：`);
  for (const e of consoleErrors.slice(0, 15)) log("  " + e);
}
await browser.disconnect();
