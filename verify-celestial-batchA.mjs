// [Oreki R27] Batch A 真实验证：全新存档 → 特蕾莎浇注 → 天神 run → V 解锁链
//
// 用法: node _tools/verify-celestial-batchA.mjs [root] [port] [seconds]
// 全程一个 Edge 实例（CDP），跑完关闭；默认游戏速度 10000×。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser, openGame } from "./lib/edge-launch.mjs";

const ROOT = path.resolve(process.argv[2] || "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition");
const PORT = Number(process.argv[3] || 8280);
const SECONDS = Number(process.argv[4] || 300);

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml", ".webm": "video/webm", ".mp3": "audio/mpeg",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontographic", ".ico": "image/x-icon",
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end("nf"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
});
await new Promise(r => server.listen(PORT, "127.0.0.1", r));
console.log(`静态服务器已起：http://127.0.0.1:${PORT}`);

const { browser, cleanup } = await launchBrowser({ port: PORT + 100, headless: true });
const { page, errors } = await openGame(browser, { port: PORT, url: "http://127.0.0.1" });
console.log("游戏页面已打开");

// 全新存档：清空 localStorage 后重载（本 temp profile 本就没有存档，双重保险）
await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await page.reload({ waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 150; i++) {
  const ok = await page.evaluate(() => typeof player === "object" && typeof gameLoop === "function").catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}
// 确保自动购买器总开关打开、速度 10000×
await page.evaluate(() => {
  try { player.auto.autobuyersOn = true; } catch (e) {}
  try { GameSpeed.set(10000); } catch (e) {}
});
console.log(`自动购买器=${await page.evaluate(() => player.auto.autobuyersOn)}  速度=${await page.evaluate(() => GameSpeed.effectiveFactor)}`);

const sample = async () => page.evaluate(() => {
  const lg = v => { try { const n = v && v.toNumber ? v.toNumber() : Number(v); return Number.isFinite(n) && n > 0 ? Math.log10(n) : (n <= 0 ? 0 : NaN); } catch { return NaN; } };
  const entered = (window.OrekiCelestialAutomation && window.OrekiCelestialAutomation._entered) || {};
  return {
    real: player.records.realTimePlayed,
    realities: player.realities,
    eternitiesLog: lg(Currency.eternities.value),
    infinitiesLog: lg(Currency.infinitiesTotal.value),
    rmLog: lg(Currency.realityMachines.value),
    dtLog: lg(player.records.thisReality.maxDT),
    repLog: lg(player.records.thisReality.maxReplicanti),
    pouredLog: lg(player.celestials.teresa.pouredAmount),
    pouredRaw: (() => { try { return player.celestials.teresa.pouredAmount.toNumber(); } catch { return 0; } })(),
    a147: (() => { try { return Achievement(147).isUnlocked; } catch { return false; } })(),
    teresaUnlocked: (() => { try { return Teresa.isUnlocked; } catch { return false; } })(),
    effarigBit: (() => { try { return TeresaUnlocks.effarig.isUnlocked; } catch { return false; } })(),
    effarigUnlockEt: (() => { try { return EffarigUnlock.eternity.isUnlocked; } catch { return false; } })(),
    run_teresa: player.celestials.teresa.run,
    run_effarig: player.celestials.effarig.run,
    run_enslaved: player.celestials.enslaved.run,
    run_v: player.celestials.v.run,
    entered,
    vCanUnlock: (() => { try { return V.canUnlockCelestial; } catch { return false; } })(),
    vUnlocked: (() => { try { return V.isUnlocked; } catch { return false; } })(),
    doomed: (() => { try { return Pelle.isDoomed; } catch { return false; } })(),
    endState: (() => { try { return GameEnd.endState; } catch { return 0; } })(),
    frozen: (() => { try { return ui.view.modal.progressBar !== undefined && GameStorage.lastSave !== undefined; } catch { return false; } })(),
  };
});

const rows = [];
const startWall = Date.now();
console.log("\n   t(s)  现实   A147  Teresa浇(log)   天神进入             V可解锁  V已解锁  终局态  错误数");
let lastLog = -10;
while ((Date.now() - startWall) < SECONDS * 1000) {
  await new Promise(r => setTimeout(r, 1000));
  const t = ((Date.now() - startWall) / 1000);
  if (t - lastLog >= 5) {
    lastLog = t;
    const s = await sample();
    rows.push({ t, ...s });
    const ent = Object.keys(s.entered).filter(k => s.entered[k]).join("/") || "—";
    console.log(
      `  ${String(t.toFixed(0)).padStart(4)}  ${String(s.realities).padStart(4)}  ${String(s.a147).padStart(5)}  ${String(s.pouredLog.toFixed(2)).padStart(11)}  ${ent.padStart(20)}  ${String(s.vCanUnlock).padStart(8)}  ${String(s.vUnlocked).padStart(8)}  ${String(Number(s.endState).toFixed(2)).padStart(7)}  ${String(errors.length).padStart(5)}`
    );
  }
}

const final = await sample();
console.log("\n===== 最终采样 =====");
console.log(JSON.stringify(final, null, 2));
console.log("\n===== 汇总 =====");
console.log(`运行墙钟: ${((Date.now() - startWall) / 1000).toFixed(1)}s  采样点数: ${rows.length}`);
console.log(`console error 数: ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 5).join("\n---\n"));

const out = { generatedAt: new Date().toISOString(), seconds: SECONDS, final, rows, errors: errors.slice(0, 10) };
fs.writeFileSync(path.join(ROOT, "..", "_research", `verify-celestial-batchA-${Date.now()}.json`), JSON.stringify(out, null, 2));
console.log("已写入研究目录 JSON 采样");

await cleanup();
server.close();
console.log("已关闭 Edge 与服务器");
