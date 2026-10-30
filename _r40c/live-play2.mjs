// R40-C · T3 真实可玩性验证（v3：每步轮询到目标出现再操作，记录前后状态）
import fs from "node:fs";
const OUT = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_tools/_r40c";
const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await browser.pages();
const page = pages.find(p => p.url().includes("8288")) || pages[pages.length - 1];
const sleep = ms => new Promise(r => setTimeout(r, ms));
await page.setCacheEnabled(false);

const consoleLog = [];
page.on("console", m => { if (m.type() === "error") consoleLog.push({ type: "error", text: m.text().slice(0, 220) }); });
page.on("pageerror", e => consoleLog.push({ type: "pageerror", text: String(e).slice(0, 220) }));

async function poll(fn, timeout = 40000, step = 400) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const v = await page.evaluate(fn).catch(() => null);
    if (v) return v;
    await sleep(step);
  }
  return null;
}
const ev = fn => page.evaluate(fn);
const shot = n => page.screenshot({ path: `${OUT}/${n}.png` }).catch(() => {});
const log = [];

// ---- 新档 ----
const reset = await ev(() => {
  GameStorage.hardReset();
  for (const k of Object.keys(localStorage)) if (/^backup/i.test(k)) localStorage.removeItem(k);
  return { am: String(player.antimatter), d1: String(player.dimensions.antimatter[0].amount), ls: Object.keys(localStorage) };
});
await page.evaluate(() => { window.onbeforeunload = null; location.reload(); }).catch(() => {});
const readySec = await (async () => {
  const t0 = Date.now();
  for (;;) {
    const ok = await page.evaluate(() => { try { return !!(document.querySelector("#ui") && typeof player === "object" && document.querySelector(".l-tab-btn-inner")); } catch { return false; } }).catch(() => false);
    if (ok) return Math.round((Date.now() - t0) / 1000);
    if (Date.now() - t0 > 120000) return -1;
    await sleep(500);
  }
})();
await sleep(1500);
const atLoad = await ev(() => ({ am: String(player.antimatter), d1: String(player.dimensions.antimatter[0].amount), head: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 90) }));
await shot("r40c-t3-01-newgame");
log.push({ step: "新档（hardReset 后重载）", reset, readySec, atLoad });

// ---- 关弹窗 ----
for (let i = 0; i < 6; i++) {
  const c = await ev(() => { const b = [...document.querySelectorAll(".c-modal button")].find(x => /跳过|嗯嗯|确定/.test(x.innerText || "")); if (b) { b.click(); return b.innerText.trim(); } return null; }).catch(() => null);
  if (!c) break;
  log.push({ step: "关闭弹窗", button: c });
  await sleep(1000);
}

// ---- 买维度 ----
const buy = await ev(() => {
  const btn = document.querySelector(".c-dimension-row .o-primary-btn--new");
  if (!btn) return null;
  const b = { am: String(player.antimatter), d1: String(player.dimensions.antimatter[0].amount), label: btn.innerText.replace(/\s+/g, " ").trim() };
  btn.click();
  return b;
});
await sleep(1000);
const buyAfter = await ev(() => ({ am: String(player.antimatter), d1: String(player.dimensions.antimatter[0].amount) }));
await shot("r40c-t3-02-buy");
log.push({ step: "点击第一维度购买按钮", before: buy, after: buyAfter });

// ---- 挑战页 ----
await ev(() => { const t = [...document.querySelectorAll(".l-tab-btn-inner")].find(x => x.innerText.trim() === "挑战"); t && t.click(); });
const ch = await poll(() => {
  const n = document.querySelectorAll(".o-challenge-btn").length;
  return n ? { challengeBtns: n, first: (document.querySelector(".o-challenge-btn") || {}).innerText, text: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 140) } : null;
}, 15000);
await shot("r40c-t3-03-challenge");
log.push({ step: "挑战页", ...(ch || { challengeBtns: 0 }) });

// ---- 自动化页 + 开关 ----
await ev(() => { const t = [...document.querySelectorAll(".l-tab-btn-inner")].find(x => x.innerText.trim() === "自动化"); t && t.click(); });
const rows = await poll(() => {
  const r = document.querySelectorAll(".c-autobuyer-box-row").length;
  return r ? { rows: r } : null;
}, 15000);
const toggle = await ev(() => {
  const cb = document.querySelector(".c-autobuyer-box-row input[type=checkbox]");
  if (!cb) return { ok: false, reason: "no checkbox" };
  const before = cb.checked;
  cb.click();
  return { ok: true, before, afterClick: cb.checked, cls: String(cb.className) };
});
await sleep(1200);
const toggleAfter = await ev(() => {
  const cb = document.querySelector(".c-autobuyer-box-row input[type=checkbox]");
  return cb ? { checked: cb.checked } : null;
});
await shot("r40c-t3-04-automation");
log.push({ step: "自动化页开关自动购买器", ...(rows || {}), toggle, toggleAfter });

// ---- 统计数据页 ----
await ev(() => { const t = [...document.querySelectorAll(".l-tab-btn-inner")].find(x => x.innerText.trim() === "统计数据"); t && t.click(); });
await sleep(1500);
await shot("r40c-t3-05-stats");
log.push({ step: "统计数据页", ...(await ev(() => ({ docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, text: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 120) }))) });

// ---- 选项页 ----
await ev(() => { const t = [...document.querySelectorAll(".l-tab-btn-inner")].find(x => x.innerText.trim() === "选项"); t && t.click(); });
await sleep(1500);
await shot("r40c-t3-06-options");
log.push({ step: "选项页", ...(await ev(() => ({ buttons: [...document.querySelectorAll("#ui button")].filter(b => b.getClientRects().length).length, text: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 120) }))) });

// ---- 英文残留 / 新闻 ----
const en = await ev(() => {
  const bad = []; const w = document.createTreeWalker(document.querySelector("#ui"), NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) {
    const t = (n.nodeValue || "").trim();
    if (t.length < 3) continue;
    const el = n.parentElement;
    if (!el || el.getClientRects().length === 0) continue;
    if (/^[\d.,eE+\-×*/^%()\s]+$/.test(t)) continue;
    if (/[A-Za-z]{3,}/.test(t)) bad.push(t.slice(0, 44));
  }
  return bad.slice(0, 15);
});
const news = await ev(() => [...document.querySelectorAll('[class*="news"], #news')].filter(e => e.getClientRects().length > 0).length);
log.push({ step: "残留英文", count: en.length, sample: en });
log.push({ step: "可见新闻节点", count: news });

fs.writeFileSync(`${OUT}/t3-live.json`, JSON.stringify({ readySec, log, consoleLog }, null, 2));
console.log(JSON.stringify({ readySec, log, consoleLog }, null, 1).slice(0, 4000));
await browser.disconnect();
