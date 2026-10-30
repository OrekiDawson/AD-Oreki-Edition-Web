// 一次性探针：确认 format 对超大指数（1e8 级）的表现，决定 IU15 文案怎么写
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "AD-Oreki-Edition");
const PORT = 8874, CDP_PORT = 9364;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon", ".webm": "video/webm", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(ROOT, "." + p);
  if (!f.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404).end(); return; } res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" }); res.end(d); });
});
await new Promise(r => server.listen(PORT, "127.0.0.1", r));
const { browser, cleanup } = await launchBrowser({ port: CDP_PORT, headless: true });
const { page } = await openGame(browser, { port: PORT });

const out = await page.evaluate(() => {
  const r = {};
  const probe = (label, fn) => { try { r[label] = String(fn()); } catch (e) { r[label] = "ERR:" + e.message; } };
  probe("pow10_1e8_toString", () => Decimal.pow(10, 1e8).toString());
  probe("pow10_1e8_log10", () => Decimal.pow(10, 1e8).log10());
  probe("format_pow10_1e8", () => format(Decimal.pow(10, 1e8)));
  probe("format_str_1e100000000", () => format("1e100000000"));
  probe("format_DC_E1e8", () => format(DC.E1e8 ?? "noDC"));
  probe("format_pow10_1e6", () => format(Decimal.pow(10, 1e6)));
  probe("format_pow10_1e7", () => format(Decimal.pow(10, 1e7)));
  probe("format_pow10_1e9", () => format(Decimal.pow(10, 1e9)));
  probe("notation", () => player.options.notation);
  probe("formatX_pow10_1e8", () => formatX(Decimal.pow(10, 1e8)));
  probe("formatInt", () => formatInt(1e8));
  probe("format_1e8_number", () => format(1e8));
  return r;
});
console.log(JSON.stringify(out, null, 2));
await cleanup(); server.close();
