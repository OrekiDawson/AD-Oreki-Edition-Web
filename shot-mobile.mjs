// 移动端可用性截图实验
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8095);
const out = path.resolve(process.argv[4] || "./shots");
fs.mkdirSync(out, { recursive: true });
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webm": "video/webm", ".mp3": "audio/mpeg", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf", ".eot": "application/vnd.ms-fontobject", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404).end(); return; } res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" }); res.end(d); });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));
const puppeteer = (await import("puppeteer-core")).default;
const b = await puppeteer.launch({ executablePath: EDGE, headless: "new", args: ["--no-sandbox", "--disable-gpu", "--mute-audio"] });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await p.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load" });
await new Promise(r => setTimeout(r, 6000));
await p.screenshot({ path: path.join(out, "mobile-main.png") });
const info = await p.evaluate(() => ({
  vw: window.innerWidth,
  docW: document.documentElement.scrollWidth,
  bodyW: document.body.scrollWidth,
}));
console.log("main:", JSON.stringify(info));
await p.evaluate(() => {
  player.antimatter = new Decimal("1e100");
  GameUI.update();
  const opt = Tabs.all.find(t => t.config.key === "options");
  opt && opt.show();
  const sub = opt && opt.subtabs.find(s => s.key === "gameplay");
  sub && sub.show();
});
await new Promise(r => setTimeout(r, 1500));
await p.screenshot({ path: path.join(out, "mobile-options.png") });
const info2 = await p.evaluate(() => ({ vw: window.innerWidth, docW: document.documentElement.scrollWidth }));
console.log("options:", JSON.stringify(info2));
await b.close(); server.close();
