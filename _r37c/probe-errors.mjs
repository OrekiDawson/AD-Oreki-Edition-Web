import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";
const ROOT = path.resolve("../AD-Oreki-Edition");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".webm": "video/webm", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.resolve(ROOT, "." + p); fs.readFile(f, (e, d) => { if (e) { res.writeHead(404).end(); return; } res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" }); res.end(d); }); });
await new Promise(r => server.listen(9353, "127.0.0.1", r));
const { browser, cleanup } = await launchBrowser({ port: 9352 });
try {
  const page0 = await browser.newPage();
  const errs = [];
  page0.on("pageerror", e => errs.push(String(e && e.stack || e).slice(0, 400)));
  page0.on("response", r => { if (r.status() >= 400) errs.push("HTTP " + r.status() + " " + r.url()); });
  page0.on("console", m => { if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 300)); });
  await page0.goto("http://127.0.0.1:9353/index.html", { waitUntil: "load", timeout: 60000 });
  await new Promise(r => setTimeout(r, 6000));
  const diag = await page0.evaluate(() => ({
    hasPlayer: typeof window.player,
    hasModal: typeof window.Modal,
    modalKeys: window.Modal ? Object.keys(window.Modal).slice(0, 12) : null,
    h2pTabs: window.GameDatabase?.h2p?.tabs?.length,
    gameInit: window.GameUI?.initialized
  }));
  console.log("ERRS:", JSON.stringify(errs.slice(0, 10), null, 1));
  console.log("DIAG:", JSON.stringify(diag, null, 1));
} finally { await cleanup(); server.close(); }
