// [R40-S2] 面板取证：打开设置 → 游戏玩法，截「智能自动购买器」那块，并把七行文字读回来。
//
// 为什么要单独跑这个：面板在设置页，长测脚本一直停在主界面，
// 「组件写对了」和「玩家能看到」是两件事。这里只证明后者。
//
// 用法：node _tools/_r40/panel-shot.mjs [tag]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "AD-Oreki-Edition");
const TAG = process.argv[2] || "r40s2-panel";
const PORT = Number(process.env.OREKI_HTTP_PORT || 8884);
const EDGE_PORT = Number(process.env.OREKI_CDP_PORT || 9374);

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon",
  ".webm": "video/webm", ".woff2": "font/woff2",
};

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
  const f = path.join(ROOT, rel);
  if (!f.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(PORT, "127.0.0.1", r));

const { browser, cleanup } = await launchBrowser({ port: EDGE_PORT });
let page, errors = [];
try {
  ({ page, errors } = await openGame(browser, { port: PORT }));
} catch (e) {
  console.error("openGame failed:", e.message);
  await cleanup();
  server.close();
  process.exit(1);
}
await new Promise(r => setTimeout(r, 12000)); // 让存档/界面稳定，先跑一会儿游戏

/** 按可见文字点击（面板层级靠文字定位，不依赖内部 vue 结构） */
const clickByText = async (text, scope = ".o-tab-btn, button, a") => {
  return await page.evaluate((t, sel) => {
    const nodes = [...document.querySelectorAll(sel)];
    const hit = nodes.find(n => (n.textContent || "").trim().includes(t) && n.offsetParent !== null);
    if (!hit) return false;
    hit.click();
    return true;
  }, text, scope);
};
const dumpTexts = async (sel) => await page.evaluate(
  s => [...document.querySelectorAll(s)].filter(n => n.offsetParent !== null)
    .map(n => (n.textContent || "").trim().slice(0, 20)).filter(Boolean).slice(0, 40), sel);

const report = { tag: TAG, steps: [] };

report.tabTexts = await dumpTexts(".o-tab-btn:not(.o-tab-btn--subtab)");
report.steps.push({ step: "dump top tabs", tabs: report.tabTexts });

// 用 Tab API 导航，不用文字点按钮：DOM 点法实测会点错（同一个文字在多个页签里出现，
// 命中的是外层页签，切完还停在原来的子页签上）。Tab 是游戏自己的导航入口，等价于玩家点击。
// 反复把页签按回去：实测 ui.view.tab 会在一两秒内被别的调用（自动切页签）抢回挑战页，
// 单次 show() 取不到图。这里每 200 ms 按一次、按够 2 秒，再立刻读 DOM + 截图。
report.nav = await page.evaluate(() => {
  try {
    const opt = Tab.options;
    const sub = opt.subtabs.find(s => s.key === "gameplay" || s.id === 2);
    if (!sub) return { ok: false, why: "no-gameplay-subtab", keys: opt.subtabs.map(s => s.key) };
    window.__r40Nav = () => { opt.show(true); sub.show(true); };
    window.__r40Nav();
    window.__r40NavTimer = setInterval(window.__r40Nav, 200);
    return { ok: true, key: sub.key ?? null, status: { tab: ui.view.tab, sub: ui.view.subtab } };
  } catch (e) {
    return { ok: false, why: String(e.message) };
  }
});
report.steps.push({ step: "Tab.options.subtabs.gameplay.show()", ok: report.nav.ok });
await new Promise(r => setTimeout(r, 2000));

const panel = await page.evaluate(() => {
  try { clearInterval(window.__r40NavTimer); } catch (e) { /* ignore */ }
  const el = document.querySelector(".c-oreki-smart__panel");
  if (!el) return { found: false };
  const rect = el.getBoundingClientRect();
  return {
    found: true,
    text: el.innerText,
    lines: [...el.querySelectorAll(".c-oreki-smart__line")].map(n => n.innerText.replace(/\s+/g, " ").trim()),
    rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
    overflowX: el.scrollWidth > el.clientWidth,
  };
});
report.panel = panel;

const shot = path.join(HERE, `${TAG}.png`);
try {
  const handle = await page.$(".c-oreki-smart__panel");
  if (handle) await handle.screenshot({ path: shot });
  else await page.screenshot({ path: shot });
  report.screenshot = shot;
} catch (e) {
  report.screenshot = `failed: ${e.message}`;
}

report.pageErrors = errors.slice(0, 5);
console.log(JSON.stringify(report, null, 1));
fs.writeFileSync(path.join(HERE, `${TAG}.json`), JSON.stringify(report, null, 1));

await cleanup();
server.close();
process.exit(0);
