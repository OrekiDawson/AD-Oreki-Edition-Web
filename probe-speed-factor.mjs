// 探针：真新档下采样全局速度因子、动态速度控制器状态与反物质增长速率。
// 目的：定位「同驱动两次运行结果差异巨大」是否由速度因子造成。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8700);
const SEC = Number(process.argv[4] || 60);

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(root, "." + p);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404).end(); return; } res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" }); res.end(d); });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"],
});
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 100; i++) {
  const ok = await page.evaluate(() => { try { return typeof player === "object"; } catch { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

const T0 = Date.now();
console.log("=== 初始速度状态 ===");
console.log(JSON.stringify(await page.evaluate(() => {
  const out = {};
  try { out.factor = getGlobalSpeedFactor(); } catch (e) { out.factor = "ERR:" + e.message; }
  try { out.isDynamic = GameSpeed.isDynamic; } catch (e) { out.isDynamic = "ERR:" + e.message; }
  try { out.localStorage_dynamic = localStorage.getItem("oreki-game-speed-dynamic"); } catch (e) { out.localStorage_dynamic = "ERR:" + e.message; }
  try { out.localStorage_speed = localStorage.getItem("oreki-game-speed"); } catch (e) { out.localStorage_speed = "ERR:" + e.message; }
  try { out.modeLabel = GameSpeed.modeLabel; } catch (e) { out.modeLabel = "ERR:" + e.message; }
  return out;
}), null, 2));

// 观察 60 秒内的速度变化与反物质增长
let last = null;
while (Date.now() - T0 < SEC * 1000) {
  const s = await page.evaluate(() => {
    const L = v => { try { if (v === null || v === undefined) return null; const t = v.toString(); const i = t.indexOf("e"); if (i >= 0) return +(Math.log10(Math.abs(Number(t.slice(0, i)))) + Number(t.slice(i + 1))).toFixed(2); return Number(t); } catch (e) { return null; } };
    return {
      factor: (() => { try { return getGlobalSpeedFactor(); } catch (e) { return null; } })(),
      isDynamic: (() => { try { return GameSpeed.isDynamic; } catch (e) { return null; } })(),
      amL: L(Currency.antimatter.value),
      maxEtL: L(player.records.thisEternity.maxAM),
      totalGame: player.records.totalTimePlayed,
      realTime: player.records.realTimePlayed,
    };
  }).catch(() => null);
  if (s) {
    const t = +((Date.now() - T0) / 1000).toFixed(0);
    if (!last || t % 10 === 0) {
      console.log(`t=${t}s factor=${s.factor} dynamic=${s.isDynamic} am=1e${s.amL} maxEt=1e${s.maxEtL} 游戏时间=${(s.totalGame / 1000).toFixed(0)}s 现实时间=${(s.realTime / 1000).toFixed(0)}s`);
      last = s;
    }
  }
  await new Promise(r => setTimeout(r, 1000));
}
console.log("=== 结束速度状态 ===");
console.log(JSON.stringify(await page.evaluate(() => {
  const out = {};
  try { out.factor = getGlobalSpeedFactor(); } catch (e) { out.factor = "ERR:" + e.message; }
  try { out.isDynamic = GameSpeed.isDynamic; } catch (e) { out.isDynamic = "ERR:" + e.message; }
  try { out.localStorage_dynamic = localStorage.getItem("oreki-game-speed-dynamic"); } catch (e) { out.localStorage_dynamic = "ERR:" + e.message; }
  try { out.localStorage_speed = localStorage.getItem("oreki-game-speed"); } catch (e) { out.localStorage_speed = "ERR:" + e.message; }
  return out;
}), null, 2));
await browser.close();
server.close();
