// 通用冒烟测试：静态目录 + headless Edge，检查游戏是否真正启动
// 用法: node smoke.mjs --root <dir> --port <port> [--wait <ms>]
//   或: node smoke.mjs <dir> <port> [waitMs]   （run-all.sh 用的位置参数形式）
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const k = process.argv[i].replace(/^--/, "");
  args[k] = process.argv[i + 1];
}
// 兼容位置参数：node smoke.mjs <root> <port> [waitMs]
if (!args.root && process.argv[2] && !process.argv[2].startsWith("--")) {
  args.root = process.argv[2];
  args.port = process.argv[3];
  args.wait = process.argv[4];
}
if (!args.root) {
  console.error("缺少项目目录：node smoke.mjs --root <dir> --port <port>，或 node smoke.mjs <dir> <port>");
  process.exit(2);
}
const root = path.resolve(args.root);
const port = Number(args.port || 8099);
const waitMs = Number(args.wait || 9000);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".webm": "video/webm", ".mp4": "video/mp4", ".mp3": "audio/mpeg",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
  ".otf": "font/otf", ".eot": "application/vnd.ms-fontobject",
  ".ico": "image/x-icon", ".sfd": "application/octet-stream",
  ".map": "application/json; charset=utf-8",
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end("not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
});

await new Promise(r => server.listen(port, "127.0.0.1", r));
console.log(`[serve] http://127.0.0.1:${port}/  root=${root}`);

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

const errors = [];
const warnings = [];
page.on("console", m => {
  const t = m.type();
  if (t === "error") errors.push(m.text());
  else if (t === "warning") warnings.push(m.text());
});
page.on("pageerror", e => errors.push("PAGEERROR: " + e.message));
page.on("requestfailed", r => {
  const u = r.url();
  if (!/fonts\.googleapis|gstatic/.test(u)) errors.push("REQFAIL: " + u + " " + (r.failure()?.errorText || ""));
});

await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, waitMs));

const result = await page.evaluate(() => {
  const out = {
    hasSpeedFn: typeof getGlobalSpeedFactor === "function",
    speedFactor: typeof getGlobalSpeedFactor === "function" ? getGlobalSpeedFactor() : null,
    hasPlayer: typeof player !== "undefined" && player !== null,
    uiChildCount: document.querySelector("#ui")?.children.length ?? -1,
    bodyTextLen: (document.body.innerText || "").length,
    bodySample: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 220),
    am: typeof player !== "undefined" ? String(player.antimatter) : null,
    gameLoopRunning: typeof GameIntervals !== "undefined",
  };
  return out;
});

console.log("[result]", JSON.stringify(result, null, 2));
console.log(`[console] errors=${errors.length} warnings=${warnings.length}`);
errors.slice(0, 10).forEach(e => console.log("  ERR " + e.slice(0, 240)));

await browser.close();
server.close();
process.exit(0);
