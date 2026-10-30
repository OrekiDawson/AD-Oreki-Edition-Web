// R40-C · T3 真实可玩性验证（v2：等待 UI 就绪后再操作）
import fs from "node:fs";

const OUT = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_tools/_r40c";
const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await browser.pages();
const page = pages.find(p => p.url().includes("8288")) || pages[pages.length - 1];
const sleep = ms => new Promise(r => setTimeout(r, ms));

const consoleLog = [];
page.on("console", m => { if (["error", "warning"].includes(m.type())) consoleLog.push({ type: m.type(), text: m.text().slice(0, 260) }); });
page.on("pageerror", e => consoleLog.push({ type: "pageerror", text: String(e).slice(0, 260) }));
page.on("requestfailed", r => consoleLog.push({ type: "requestfailed", text: r.url().slice(0, 140) + " :: " + (r.failure()?.errorText || "") }));
await page.setCacheEnabled(false);

// 轮询等待游戏就绪
async function waitReady(timeout = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const ok = await page.evaluate(() => {
      try { return !!(document.querySelector("#ui") && typeof player === "object" && player && document.querySelector(".l-tab-btn-inner")); }
      catch { return false; }
    }).catch(() => false);
    if (ok) return Math.round((Date.now() - t0) / 1000);
    await sleep(1000);
  }
  return -1;
}

// ---------- 1. 真实新档 ----------
const reset = await page.evaluate(() => {
  try {
    GameStorage.hardReset();
    const keys = Object.keys(localStorage);
    for (const k of keys) if (/^backup/i.test(k)) localStorage.removeItem(k);
    return { ok: true, keysBefore: keys, keysAfter: Object.keys(localStorage), saved: String(player.antimatter) };
  } catch (e) { return { ok: false, err: String(e) }; }
});
console.log("reset:", JSON.stringify(reset));

const t0 = Date.now();
await page.evaluate(() => { window.onbeforeunload = null; location.reload(); }).catch(() => {});
const ready = await waitReady();
console.log("ready in", ready, "s; wall", Math.round((Date.now() - t0) / 1000), "s");

const atLoad = await page.evaluate(() => ({
  am: String(player.antimatter),
  dim1: String(player.dimensions.antimatter[0].amount),
  tickspeed: String(player.tickspeed),
  ip: String(player.infinityPoints),
  saveAge: (() => { const s = parseInt((localStorage.getItem(GameStorage.localStorageKey) || "").length, 10); return s; })(),
  head: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 100),
  created: new Date(player.records.gameCreatedTime).toISOString?.() || String(player.records.gameCreatedTime),
}));
await page.screenshot({ path: `${OUT}/r40c-t3-01-newgame.png` }).catch(() => {});
console.log("atLoad:", JSON.stringify(atLoad));

// 关掉可能弹出的离线/教程弹窗
for (let i = 0; i < 5; i++) {
  const closed = await page.evaluate(() => {
    const btn = [...document.querySelectorAll(".c-modal button")].find(b => /跳过|嗯嗯|确定|关闭/.test(b.innerText || ""));
    if (btn) { btn.click(); return btn.innerText.trim(); }
    return null;
  }).catch(() => null);
  if (!closed) break;
  console.log("closed modal:", closed);
  await sleep(1200);
}

const steps = [];
const shot = async n => { await page.screenshot({ path: `${OUT}/${n}.png` }).catch(() => {}); };

// ---------- 2. 买维度 ----------
const buy = await page.evaluate(() => {
  const btn = document.querySelector(".c-dimension-row .o-primary-btn--new");
  if (!btn) return { ok: false, reason: "no buy button" };
  const before = { am: String(player.antimatter), d1: String(player.dimensions.antimatter[0].amount) };
  const label = btn.innerText.replace(/\s+/g, " ").trim();
  btn.click();
  return {
    ok: true, label, before,
    after: { am: String(player.antimatter), d1: String(player.dimensions.antimatter[0].amount) },
    clicked: true,
  };
});
await sleep(1500);
steps.push({ step: "买维度1（点击 o-primary-btn--new）", ...buy, d1After1_5s: await page.evaluate(() => String(player.dimensions.antimatter[0].amount)) });
await shot("r40c-t3-02-buy");

// ---------- 3. 挑战页 ----------
await page.evaluate(() => { const t = [...document.querySelectorAll(".l-tab-btn-inner")].find(x => x.innerText.trim() === "挑战"); t && t.click(); });
await sleep(1500);
steps.push({
  step: "打开挑战页",
  ...(await page.evaluate(() => ({
    challengeBtns: document.querySelectorAll(".o-challenge-btn").length,
    first: (document.querySelector(".o-challenge-btn") || {}).innerText || null,
    header: (document.querySelector(".c-challenge-header, .l-challenge-header") || {}).innerText || null,
    visibleText: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 160),
  }))),
});
await shot("r40c-t3-03-challenge");

// ---------- 4. 自动化页开关 ----------
await page.evaluate(() => { const t = [...document.querySelectorAll(".l-tab-btn-inner")].find(x => x.innerText.trim() === "自动化"); t && t.click(); });
await sleep(1500);
const auto = await page.evaluate(() => {
  const row = document.querySelector(".c-autobuyer-box-row");
  if (!row) return { ok: false, rows: 0, text: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 160) };
  const btn = row.querySelector("button");
  const before = btn ? btn.innerText.replace(/\s+/g, " ").trim() : null;
  if (btn) btn.click();
  return { ok: true, rows: document.querySelectorAll(".c-autobuyer-box-row").length, before, afterClick: btn ? btn.innerText.replace(/\s+/g, " ").trim() : null };
});
await sleep(1500);
auto.after1_5s = await page.evaluate(() => {
  const btn = document.querySelector(".c-autobuyer-box-row button");
  return btn ? btn.innerText.replace(/\s+/g, " ").trim() : null;
});
steps.push({ step: "自动化页开关", ...auto });
await shot("r40c-t3-04-automation");

// ---------- 5. 统计数据页 ----------
await page.evaluate(() => { const t = [...document.querySelectorAll(".l-tab-btn-inner")].find(x => x.innerText.trim() === "统计数据"); t && t.click(); });
await sleep(1500);
steps.push({
  step: "统计数据页",
  ...(await page.evaluate(() => ({
    text: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 200),
    docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }))),
});
await shot("r40c-t3-05-stats");

// ---------- 6. 选项页 ----------
await page.evaluate(() => { const t = [...document.querySelectorAll(".l-tab-btn-inner")].find(x => x.innerText.trim() === "选项"); t && t.click(); });
await sleep(1500);
await shot("r40c-t3-06-options");

// ---------- 7. 残留英文 ----------
const english = await page.evaluate(() => {
  const bad = [];
  const w = document.createTreeWalker(document.querySelector("#ui"), NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const t = (n.nodeValue || "").trim();
    if (t.length < 3) continue;
    const el = n.parentElement;
    if (!el || el.getClientRects().length === 0) continue;
    if (/^[\d.,eE+\-×*/^%()\s]+$/.test(t)) continue;
    if (/[A-Za-z]{3,}/.test(t)) bad.push({ text: t.slice(0, 44), cls: String(el.className || "").slice(0, 26) });
  }
  return bad.slice(0, 20);
});
steps.push({ step: "残留英文文案", count: english.length, sample: english });

const news = await page.evaluate(() => ({
  visibleNewsNodes: [...document.querySelectorAll('[class*="news"]')].filter(e => e.getClientRects().length > 0).length,
  newsButton: [...document.querySelectorAll("#ui button")].filter(b => /新闻/.test(b.innerText || "")).map(b => b.innerText.replace(/\s+/g, " ").slice(0, 20)),
}));
steps.push({ step: "新闻模块", ...news });

const info = await page.evaluate(() => ({
  vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio, screenW: screen.width, screenH: screen.height,
  ua: navigator.userAgent,
}));

fs.writeFileSync(`${OUT}/t3-live.json`, JSON.stringify({ info, readySec: ready, reset, atLoad, steps, consoleLog }, null, 2));
console.log("INFO:", JSON.stringify(info));
console.log("STEPS:", JSON.stringify(steps, null, 1).slice(0, 2600));
console.log("CONSOLE:", JSON.stringify(consoleLog.slice(0, 12)));
await browser.disconnect();
