// 汉化验收：用游戏内部 Tabs API 逐个切换主标签 + 子标签，扫描界面上残留的英文文案
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8097);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webm": "video/webm", ".mp3": "audio/mpeg", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf", ".ico": "image/x-icon" };
const server = http.createServer((q, s) => { let p = decodeURIComponent(q.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.join(root, p); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404).end(); return; } s.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" }); s.end(d); }); });
await new Promise(r => server.listen(port, "127.0.0.1", r));

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", args: ["--no-sandbox", "--disable-gpu", "--mute-audio"], protocolTimeout: 60000 });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1000 });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));

// 解锁全部 UI（否则后期标签页是隐藏的）。
// 只动解锁标志，不伪造数值状态，避免把渲染打挂。
await page.evaluate(() => {
  player.antimatter = new Decimal("1e100");
  player.records.totalAntimatter = new Decimal("1e100");
  player.break = true;              // 无限
  Currency.eternities.add(1);       // 永恒（走正式货币接口）
  player.realities = 1;             // 现实（number 字段，不能赋 Decimal）
  GameUI.update();
});
await new Promise(r => setTimeout(r, 1200));

const tabList = await page.evaluate(() => Tabs.all.map(t => ({ key: t.config.key, name: t.config.name })));
console.log(`主标签：${tabList.map(t => `${t.name}(${t.key})`).join(" / ")}\n`);

const ALLOW = new Set([
  "IP", "EP", "RM", "AM", "AD", "ID", "TD", "TS", "EC", "IC", "NC", "BH", "DT", "TP", "RS", "OK",
  "GL", "RU", "RG", "EU", "CU", "AP", "IM", "DM", "LA", "AI", "RNG", "DSM", "MA", "OOM",
  "Shift", "Ctrl", "Alt", "Tab", "Esc", "Enter", "Oreki", "Edition", "GitHub", "Discord", "Reddit",
  "Chrome", "Edge", "Firefox", "Safari", "Windows", "Android",
]);

const scanVisible = () => page.evaluate((allowArr) => {
  const allow = new Set(allowArr);
  const out = [];
  const seen = new Set();
  const root = document.querySelector("#ui") || document.body;
  for (const el of root.querySelectorAll("button, h1, h2, h3, h4, label, .o-primary-btn, .c-options-tab__button, span, td, th")) {
    // 跳过整个标签页的大段说明文本
    if (el.closest(".l-modal, .c-h2p-body")) continue;
    const direct = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join(" ");
    const t = direct.replace(/\s+/g, " ").trim();
    if (t.length < 3 || t.length > 70 || seen.has(t)) continue;
    const words = t.match(/[A-Za-z][A-Za-z'’-]{2,}/g);
    if (!words) continue;
    const bad = words.filter(w => !allow.has(w) && !/^[A-Z]{2,6}$/.test(w));
    if (!bad.length) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}, Array.from(ALLOW));

let total = 0;
const perTab = [];
for (const t of tabList) {
  const ok = await page.evaluate((key) => {
    const tab = Tabs.all.find(x => x.config.key === key);
    if (!tab || !tab.isUnlocked) return false;
    tab.show();
    return true;
  }, t.key);
  if (!ok) { console.log(`【${t.name}】未解锁，跳过\n`); continue; }
  await new Promise(r => setTimeout(r, 1100));

  const bad = await scanVisible();
  // 子标签也扫一遍
  const subKeys = await page.evaluate((key) => {
    const tab = Tabs.all.find(x => x.config.key === key);
    return (tab.subtabs || []).map(s => s.key);
  }, t.key);
  for (const sk of subKeys) {
    const shown = await page.evaluate(([k, s]) => {
      const tab = Tabs.all.find(x => x.config.key === k);
      const sub = (tab.subtabs || []).find(x => x.key === s);
      if (!sub || !sub.isUnlocked) return false;
      sub.show();
      return true;
    }, [t.key, sk]);
    if (!shown) continue;
    await new Promise(r => setTimeout(r, 900));
    const subBad = await scanVisible();
    for (const b of subBad) if (!bad.includes(b)) bad.push(b);
  }

  perTab.push({ tab: t.name, count: bad.length, items: bad });
  total += bad.length;
}

for (const r of perTab) {
  if (!r.count) { console.log(`【${r.tab}】无英文残留`); continue; }
  console.log(`【${r.tab}】疑似英文残留 ${r.count} 处：`);
  for (const b of r.items.slice(0, 20)) console.log(`    · ${b}`);
}
console.log(`\n===== 合计 ${total} 处 =====`);

await browser.close();
server.close();
