// 校验：全局倍率是否真的作用在游戏时间上（R9 收尾诊断）
// 对照 realTimePlayed 与 totalInGameTime 的增速，以及自动器实际触发次数。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8560);
const SEC = Number(process.argv[4] || 20);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(root, "." + p);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404).end(); return; } res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" }); res.end(d); });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new", args: ["--no-sandbox", "--disable-gpu", "--mute-audio"] });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 100; i++) {
  const ok = await page.evaluate(() => { try { return typeof player === "object" && typeof AntimatterDimension === "function"; } catch { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

const read = () => page.evaluate(() => {
  const ab = (() => { try { return Autobuyer.antimatterDimension(1); } catch (e) { return null; } })();
  return {
    F: (() => { try { return getGlobalSpeedFactor(); } catch (e) { return null; } })(),
    scaleSwitch: (() => { try { return GameSpeed.n; } catch (e) { return "ERR"; } })(),
    real: player.records.realTimePlayed,
    inGame: (() => { try { return player.records.totalInGameTime?.toNumber?.() ?? player.records.totalInGameTime; } catch (e) { return null; } })(),
    rawTotal: player.records.totalTimePlayed,
    dim1LastTick: ab ? ab.data.lastTick : null,
    dim1Interval: ab ? ab.interval : null,
    dim1Effective: ab ? ab.effectiveInterval : null,
    am: player.antimatter ? String(player.antimatter) : String(Currency.antimatter.value),
  };
});

const a = await read();
const t0 = Date.now();
await new Promise(r => setTimeout(r, SEC * 1000));
const b = await read();
const realElapsed = (Date.now() - t0) / 1000;

console.log(JSON.stringify({
  F: a.F,
  自动器缩放开关: a.scaleSwitch,
  realTimePlayed增速: `${((b.real - a.real) / realElapsed).toFixed(1)} ms/s`,
  totalInGameTime增速: `${(((b.inGame - a.inGame)) / realElapsed).toFixed(0)} ms/s`,
  rawTotalTimePlayed增速: `${((b.rawTotal - a.rawTotal) / realElapsed).toFixed(0)} ms/s`,
  '游戏时间/现实时间': `${((b.inGame - a.inGame) / Math.max(1, (b.real - a.real))).toFixed(1)}×`,
  dim1: { interval: a.dim1Interval, effective: a.dim1Effective, lastTick: `${a.dim1LastTick} → ${b.dim1LastTick}` },
  反物质: `${a.am} → ${b.am}`,
}, null, 2));
await browser.close();
server.close();
