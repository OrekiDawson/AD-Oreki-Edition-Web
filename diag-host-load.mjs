// 诊断：宿主无头 Edge 打开页面后，游戏是否完成初始化
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("../AD-Oreki-Edition");
const port = 8391;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webm": "video/webm", ".mp3": "audio/mpeg", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio"],
});
const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 160)); });
page.on("requestfailed", r => errs.push("reqfail: " + r.url().slice(0, 90) + " " + (r.failure()?.errorText || "")));

await page.setViewport({ width: 1280, height: 900 });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
for (const wait of [1000, 3000, 6000, 12000]) {
  await new Promise(r => setTimeout(r, wait === 1000 ? wait : wait - 1000 * 0));
  const state = await page.evaluate(() => ({
    player: typeof player,
    Tabs: typeof Tabs,
    uiChildren: document.getElementById("ui")?.children.length ?? -1,
    loading: getComputedStyle(document.getElementById("loading")).display,
    errs: (window.errorMessages || []).slice(0, 3),
  }));
  console.log(`after ~${wait}ms`, JSON.stringify(state));
  if (state.player !== "undefined") break;
}
console.log("page errors:", JSON.stringify(errs.slice(0, 6), null, 1));
await browser.close();
server.close();
