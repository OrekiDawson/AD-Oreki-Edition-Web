// R40-M · 佩勒终局段机制验证（用 R38 后期检查点，不是新手通关验收）
//
// 目的：只回答一件事——从毁灭现实开始，`records.totalAntimatter` 的指数能不能真的爬到 1000
// （`endState >= 1` 的充要条件，见 game-end.js 里 R38-M 的推导）。
// R38-M 实测旧版在 e316 停住 105 秒（当时归因为大坍缩竞争），修完 `_stopDoomedResets`
// 之后到底能到多少，此前**从未测过**。
//
// 用法：node doomtest.mjs [秒]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "AD-Oreki-Edition");
const DURATION = (Number(process.argv[2]) || 600) * 1000;
const PORT = Number(process.env.OREKI_HTTP_PORT || 8883);
const CDP = Number(process.env.OREKI_CDP_PORT || 9373);
const TAG = process.env.OREKI_TAG || `r40m-doom-${Date.now()}`;
const CP = path.resolve(HERE, "..", "_r39b", "cp-late.txt");
const JSONL = path.join(HERE, `${TAG}.jsonl`);
const LOG = path.join(HERE, `${TAG}.log`);

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon",
  ".webm": "video/webm", ".woff2": "font/woff2",
};
const logLines = [];
function log(...a) {
  const s = a.map(x => (typeof x === "string" ? x : JSON.stringify(x))).join(" ");
  console.log(s);
  logLines.push(s);
  try { fs.writeFileSync(LOG, logLines.join("\n") + "\n"); } catch (e) { /* ignore */ }
}
function killEdge() {
  const ps = `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | `
    + `Where-Object { $_.CommandLine -like '*remote-debugging-port=${CDP}*' } | `
    + `ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
  try { execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: "ignore" }); } catch (e) { /* ignore */ }
}
killEdge();

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(ROOT, "." + p);
  if (!f.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(PORT, "127.0.0.1", r));
log(`[serve] ${ROOT} -> http://127.0.0.1:${PORT}/ (cdp ${CDP}, ${DURATION / 1000}s)`);

const SAMPLE = () => {
  const o = { t: Math.round((Date.now() - window.__r40T0) / 100) / 10 };
  const safe = (k, f) => { try { o[k] = f(); } catch (e) { o[k] = "ERR"; } };
  safe("step", () => globalThis.OrekiEndgameAutomation?.step);
  safe("iu15", () => ImaginaryUpgrade(15).isBought === true);
  safe("iu25", () => ImaginaryUpgrade(25).isBought === true);
  safe("iu25av", () => ImaginaryUpgrade(25).isAvailableForPurchase === true);
  safe("laiTier", () => player.celestials.laitela.difficultyTier);
  safe("laiRun", () => Laitela.isRunning === true);
  safe("laiUnl", () => Laitela.isUnlocked === true);
  safe("ent", () => +Number(player.celestials.laitela.entropy).toFixed(3));
  safe("imL", () => Math.round(Math.log10(Number(Currency.imaginaryMachines.value)) * 100) / 100);
  safe("ds6", () => TimeStudy.reality.isBought === true);
  safe("glyphN", () => Glyphs.activeWithoutCompanion.length);
  safe("hold", () => globalThis.OrekiCelestialAutomation?.holdReality === true);
  safe("pelleUnl", () => Pelle.isUnlocked === true);
  safe("doomed", () => Pelle.isDoomed === true);
  safe("pamE", () => Number(player.celestials?.pelle?.records?.totalAntimatter?.exponent ?? 0));
  safe("amE", () => Number(player.antimatter?.exponent ?? 0));
  safe("ad1E", () => Number(AntimatterDimension(1).amount.exponent ?? 0));
  safe("endState", () => { try { return +Number(GameEnd.endState).toFixed(5); } catch (e) { return null; } });
  safe("isGameEnd", () => player.isGameEnd === true);
  safe("bcActive", () => Autobuyer.bigCrunch.isActive === true);
  safe("etActive", () => Autobuyer.eternity.isActive === true);
  safe("realities", () => player.realities);
  safe("err", () => globalThis.OrekiEndgameAutomation?._lastError || "");
  return o;
};

let cleanup = async () => {};
try {
  const launched = await launchBrowser({ port: CDP });
  const browser = launched.browser;
  cleanup = launched.cleanup;
  const { page, errors } = await openGame(browser, { port: PORT });
  const msgs = [];
  page.on("console", m => {
    const t = m.text();
    if (t.startsWith("[R38-") || t.startsWith("[R40-") || m.type() === "error") {
      msgs.push(t.slice(0, 240));
      if (msgs.length > 200) msgs.shift();
    }
  });

  const cp = fs.readFileSync(CP, "utf8").trim();
  await page.evaluate(s => {
    try { localStorage.clear(); localStorage.setItem("dimensionSave", s); } catch (e) { /* ignore */ }
  }, cp);
  await page.reload({ waitUntil: "load", timeout: 60000 });
  log(`[load] 检查点 ${CP} (${cp.length} bytes)`);

  for (let i = 0; i < 200; i++) {
    const ok = await page.evaluate(() => {
      try { return typeof player === "object" && typeof Currency === "object"; } catch (e) { return false; }
    }).catch(() => false);
    if (ok) break;
    await new Promise(r => setTimeout(r, 300));
  }
  await page.evaluate(() => {
    window.__r40T0 = Date.now();
    try {
      player.auto.autobuyersOn = true;
      if (!player.isGameEnd) {
        // 让自动化接管（与玩家打开自动购买器同一条路径）
        Autobuyer.bigCrunch.isActive = true;
        Autobuyer.eternity.isActive = true;
      }
    } catch (e) { /* ignore */ }
  });
  log("[start] 已开启自动购买器");

  const t0 = Date.now();
  let lastLog = -1;
  let dead = 0;
  let picked = null;
  while (Date.now() - t0 < DURATION) {
    const s = await page.evaluate(SAMPLE).catch(e => ({ err: String(e && e.message), t: 0 }));
    if (s && s.err && /detach|closed|Target page|Session closed|crash/i.test(String(s.err))) {
      dead++;
      if (dead >= 15) { log("[dead] 页面不可用，中止"); break; }
    } else if (s && !s.err) dead = 0;
    try { fs.appendFileSync(JSONL, JSON.stringify(s) + "\n"); } catch (e) { /* ignore */ }

    const el = Math.floor((Date.now() - t0) / 1000);
    if (el - lastLog >= 10) {
      lastLog = el;
      log(`[${String(el).padStart(3)}s] step=${s.step} ds6=${s.ds6 ? 1 : 0} lai=${s.laiUnl ? 1 : 0}/${s.laiTier}/${s.laiRun ? 1 : 0} ` +
        `ent=${s.ent} imL=${s.imL} iu15=${s.iu15 ? 1 : 0} iu25=${s.iu25 ? 1 : 0}/${s.iu25av ? 1 : 0} ` +
        `glyph=${s.glyphN} hold=${s.hold ? 1 : 0} pelle=${s.pelleUnl ? 1 : 0}/${s.doomed ? 1 : 0} ` +
        `pamE=${Number(s.pamE || 0).toFixed(1)} end=${s.endState} gameEnd=${s.isGameEnd ? 1 : 0} err=${s.err}`);
    }
    if (s.isGameEnd === true && !picked) {
      picked = { t: el, pamE: s.pamE, endState: s.endState };
      log(`[GAMEEND] *** 真实终局触发 *** t=${el}s pamE=e${Number(s.pamE).toFixed(1)} endState=${s.endState}`);
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  const fin = await page.evaluate(SAMPLE).catch(() => null);
  log("[final]", JSON.stringify(fin));
  if (msgs.length) log("[console-tail]", JSON.stringify(msgs.slice(-14)));
  if (errors?.length) log("[pageerror]", errors.slice(0, 5));
  log(`[out] JSONL=${JSONL}`);
} finally {
  await cleanup();
  server.close();
  killEdge();
}
