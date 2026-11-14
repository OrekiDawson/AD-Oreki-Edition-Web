import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const OUT = "/home/oreki/AD-Oreki-Unified/reports/R109-01/web-pages/live/diag";
fs.mkdirSync(OUT, { recursive: true });
const req = createRequire("/home/oreki/.npm/_npx/e41f203b7505f1fb/noop.js");
const { chromium } = req("playwright");
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 839 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: "zh-CN", userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Mobile Safari/537.36" });
const page = await ctx.newPage();
const log = [];
const bad = [];
page.on("console", m => log.push({ type: m.type(), text: m.text().slice(0, 500) }));
page.on("pageerror", e => log.push({ type: "pageerror", text: String(e).slice(0, 800) }));
page.on("response", r => { if (r.status() >= 400) bad.push({ status: r.status(), url: r.url() }); });
page.on("requestfailed", r => bad.push({ status: "failed", url: r.url(), err: r.failure()?.errorText }));
await page.goto("https://oreki.net/?diag=" + Date.now(), { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(20000);
const state = await page.evaluate(() => {
  const ui = document.querySelector("#ui");
  const scripts = [...document.querySelectorAll("script[src]")].map(s => s.getAttribute("src"));
  return {
    readyState: document.readyState,
    title: document.title,
    uiDisplay: ui ? getComputedStyle(ui).display : null,
    uiHidden: ui ? ui.hidden : null,
    bodyText: document.body.innerText.slice(0, 500),
    bodyClasses: document.body.className,
    globals: {
      game: typeof globalThis.game, GameUI: typeof globalThis.GameUI, Currency: typeof globalThis.Currency,
      player: typeof globalThis.player, Decimal: typeof globalThis.Decimal,
    },
    scriptCount: scripts.length,
    scriptsSample: scripts.slice(0, 10),
    loadingEl: !!document.querySelector("#loading, #loading-screen, #splash, .c-loading"),
    localStorageKeys: Object.keys(localStorage).slice(0, 10),
  };
});
await page.screenshot({ path: OUT + "/diag.png", fullPage: false });
fs.writeFileSync(OUT + "/console.json", JSON.stringify(log, null, 2));
fs.writeFileSync(OUT + "/bad.json", JSON.stringify(bad, null, 2));
fs.writeFileSync(OUT + "/state.json", JSON.stringify(state, null, 2));
console.log(JSON.stringify({ state, badCount: bad.length, bad: bad.slice(0, 20), logCount: log.length, log: log.slice(0, 30) }, null, 2));
await browser.close();
