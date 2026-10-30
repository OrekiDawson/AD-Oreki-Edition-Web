// [Oreki R27] 诊断：EC11/EC12 完成度、TT、膨胀研究解锁链
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchBrowser, openGame } from "./lib/edge-launch.mjs";

const ROOT = path.resolve(process.argv[2] || "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition");
const PORT = Number(process.argv[3] || 8282);
const SECONDS = Number(process.argv[4] || 120);

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404).end("nf"); return; } res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" }); res.end(data); });
});
await new Promise(r => server.listen(PORT, "127.0.0.1", r));
const { browser, cleanup } = await launchBrowser({ port: PORT + 100, headless: true });
const { page, errors } = await openGame(browser, { port: PORT, url: "http://127.0.0.1" });
await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await page.reload({ waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 150; i++) { const ok = await page.evaluate(() => typeof player === "object" && typeof gameLoop === "function").catch(() => false); if (ok) break; await new Promise(r => setTimeout(r, 400)); }
await page.evaluate(() => { try { player.auto.autobuyersOn = true; } catch (e) {} try { GameSpeed.set(10000); } catch (e) {} });

const sample = async () => page.evaluate(() => {
  const tc = id => { try { return { c: EternityChallenge(id).completions, full: EternityChallenge(id).isFullyCompleted, run: EternityChallenge(id).isRunning, unlock: EternityChallenge(id).isUnlocked }; } catch (e) { return { err: String(e) }; } };
  let ttMax = null, ttVal = null;
  try { ttMax = Currency.timeTheorems.max.toNumber(); } catch (e) {}
  try { ttVal = Currency.timeTheorems.value.toNumber(); } catch (e) {}
  const tsBought = [231,232,233,234].filter(id => { try { return TimeStudy(id).isBought; } catch { return false; } });
  let dilReq = null, dilCan = null;
  try { dilReq = TimeStudy.dilation.config.requirement(); } catch (e) { dilReq = "ERR:"+e; }
  try { dilCan = TimeStudy.dilation.canBeBought; } catch (e) { dilCan = "ERR"; }
  return {
    realities: player.realities,
    ec11: tc(11), ec12: tc(12),
    ttMax, ttVal, ts231_234: tsBought,
    dilUnlocked: (() => { try { return PlayerProgress.dilationUnlocked(); } catch { return false; } })(),
    dilBought: (() => { try { return TimeStudy.dilation.isBought; } catch { return false; } })(),
    dilReq, dilCan,
    glyphMaxLevel: (() => { try { return Math.max(...Glyphs.inventoryList.filter(g=>g&&g.type!=="companion").map(g=>g.level), 0); } catch { return 0; } })(),
    a147: (() => { try { return Achievement(147).isUnlocked; } catch { return false; } })(),
  };
});

const start = Date.now();
console.log("   t  real  EC11  EC12  TTmax  231-234  dilBought dilReq dilCan  gMax A147");
let last = -10;
while ((Date.now() - start) < SECONDS * 1000) {
  await new Promise(r => setTimeout(r, 1000));
  const t = (Date.now() - start) / 1000;
  if (t - last >= 5) {
    last = t;
    const s = await sample();
    console.log(`  ${String(t.toFixed(0)).padStart(3)} ${String(s.realities).padStart(4)}  ${String(s.ec11.c).padStart(3)}/${String(s.ec11.full).padStart(1)}  ${String(s.ec12.c).padStart(3)}/${String(s.ec12.full).padStart(1)}  ${String(s.ttMax==null?"?":Math.log10(s.ttMax).toFixed(1)).padStart(6)}  [${s.ts231_234.join(",")}]  ${String(s.dilBought).padStart(5)}  ${String(s.dilReq).padStart(5)} ${String(s.dilCan).padStart(5)} ${String(s.glyphMaxLevel).padStart(4)} ${String(s.a147).padStart(5)}`);
  }
}
const f = await sample();
console.log("\n最终:", JSON.stringify(f, null, 2));
console.log("errors:", errors.length);
await cleanup(); server.close();
