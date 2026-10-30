// 一次性探针：确认 gainedInfinityPoints 里 div 的真实取值与类型
import path from "node:path";
import http from "node:http";
import fs from "node:fs";
import { launchBrowser, openGame } from "./lib/edge-launch.mjs";

const root = path.resolve("../AD-Oreki-Edition");
const port = 8790;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  fs.readFile(path.resolve(root, "." + p), (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(p).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const { browser, cleanup } = await launchBrowser({ port: 9430 });
const { page } = await openGame(browser, { port });
await page.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
await page.reload({ waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 100; i++) {
  const ok = await page.evaluate(() => { try { return typeof player === "object"; } catch { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 300));
}

const out = await page.evaluate(() => {
  const t = v => (v && v.constructor ? v.constructor.name : typeof v);
  const show = v => { try { return v.toString(); } catch (e) { return "ERR:" + e.message; } };
  const r = {};
  r.ach103 = { type: t(Achievement(103).effect), value: show(Achievement(103).effect) };
  r.ts111 = { type: t(TimeStudy(111).effect), value: show(TimeStudy(111).effect) };
  r.min30 = { type: t(Effects.min(30, Achievement(103), TimeStudy(111))), value: show(Effects.min(30, Achievement(103), TimeStudy(111))) };
  r.min308 = { type: t(Effects.min(308, Achievement(103), TimeStudy(111))), value: show(Effects.min(308, Achievement(103), TimeStudy(111))) };
  return r;
});
console.log(JSON.stringify(out, null, 2));
await cleanup();
server.close();
process.exit(0);
