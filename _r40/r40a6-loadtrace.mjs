// 临时诊断 2：新档冷启动后的前 12 秒，每 250 ms 打一行，看 fresh 证据与成长速度。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "../lib/edge-launch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "AD-Oreki-Edition");
const PORT = 8868;
const CDP = 9358;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon", ".webm": "video/webm", ".woff2": "font/woff2", ".woff": "font/woff", ".otf": "font/otf", ".eot": "application/vnd.ms-fontobject", ".map": "application/json" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/__blank.html") { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end("blank"); return; }
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(ROOT, "." + p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(PORT, "127.0.0.1", r));

const { browser, cleanup } = await launchBrowser({ port: CDP });
const page = await browser.newPage();
page.on("pageerror", e => console.log("[pageerror]", e.message));
await page.createCDPSession().then(c => c.send("Emulation.setFocusEmulationEnabled", { enabled: true })).catch(() => {});

await page.goto(`http://127.0.0.1:${PORT}/__blank.html`, { waitUntil: "load" });
await page.evaluate(() => localStorage.clear());
const navAt = Date.now();
await page.evaluateOnNewDocument(() => {
  try { localStorage.clear(); } catch (e) { /* ignore */ }
  window.__init = null;
  const iv = setInterval(() => {
    try {
      if (typeof player === "object" && player !== null && player.records) {
        window.__init = {
          createdAt: player.records.gameCreatedTime,
          now: Date.now(),
          realities: player.realities,
          brk: player.break === true,
          endState: (() => { try { return Number(GameEnd.endState.toFixed(6)); } catch (e) { return null; } })(),
          totalAM: String(player.records.totalAntimatter),
          boosts: player.dimensionBoosts,
          galaxies: player.galaxies,
          factor: (() => { try { return GameSpeed.factor; } catch (e) { return null; } })(),
        };
        clearInterval(iv);
      }
    } catch (e) { /* not ready */ }
  }, 10);
});
await page.goto(`http://127.0.0.1:${PORT}/index.html?fresh=${Date.now()}`, { waitUntil: "load", timeout: 120000 });
console.log("[load] 从导航到 load 完成 =", Date.now() - navAt, "ms");

for (let i = 0; i < 48; i++) {
  const r = await page.evaluate(() => {
    const p = player;
    const L = v => { try { const n = v.log10(); return Number.isFinite(n) ? Math.round(n * 10) / 10 : null; } catch (e) { return null; } };
    return {
      init: window.__init,
      ageMs: Date.now() - p.records.gameCreatedTime,
      realPlayed: p.records.realTimePlayed,
      f: (() => { try { return GameSpeed.factor; } catch (e) { return null; } })(),
      brk: p.break === true,
      r: p.realities,
      boosts: p.dimensionBoosts,
      gal: p.galaxies,
      amL: L(p.antimatter),
      totAML: L(p.records.totalAntimatter),
      end: (() => { try { return Number(GameEnd.endState.toFixed(4)); } catch (e) { return null; } })(),
      save: (localStorage.getItem("dimensionSave") || "").length,
    };
  }).catch(e => ({ err: String(e.message) }));
  if (i === 0) console.log("[init]", JSON.stringify(r.init));
  console.log(`[${i}] age=${r.ageMs}ms real=${r.realPlayed} f=${r.f} brk=${r.brk} r=${r.r} boost=${r.boosts} gal=${r.gal} amL=${r.amL} totAML=${r.totAML} end=${r.end} save=${r.save}`);
  await new Promise(r2 => setTimeout(r2, 250));
}

await cleanup();
server.close();
process.exit(0);
