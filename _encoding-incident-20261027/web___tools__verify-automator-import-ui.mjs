// 瀵煎叆寮圭獥 UI 鍐掔儫锛氱‘璁ゆ柊澧炵殑銆屼細鍒囨崲鍒版柊鑴氭湰銆嶆彁绀烘寜鐘舵€佹纭覆鏌擄紝涓斿脊绐楄兘姝ｅ父鎵撳紑
//
// 鎬濊矾锛氫笉纰扮粍浠跺疄渚嬶紝鍙湅鐪熷疄 DOM 鈥斺€?show() 鍚庣瓑涓€涓覆鏌撹妭鎷嶏紝璇?.c-modal 鏂囨湰銆?//
// 鐢ㄦ硶锛歯ode verify-automator-import-ui.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const ROOT = process.env.OREKI_ROOT || "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition";
const REPO = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/ADScriptAndGuide";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";
const OUT = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/automator-import-ui.json";
const PORT = 8498;

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon"
};
const SCRIPT_A = fs.readFileSync(path.join(REPO, "NinjatsuScripts/Ninja RealFast v3.txt"), "utf-8").trim();
const SCRIPT_B = fs.readFileSync(path.join(REPO, "LSFScripts/LSF-NORM.txt"), "utf-8").trim();
const SAVE = fs.readFileSync(path.join(SAVE_DIR, "861._92R+1.0e11RM.txt"), "utf-8");

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(ROOT, "." + p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(PORT, "127.0.0.1", r));

const browser = await launchViaConnect({ protocolTimeout: 300000 });
const page = await browser.newPage();
const errs = [];
const NOISE = /googletagmanager|google-analytics|kaspersky-labs|Vue warn|progress\.info/;
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => {
  if (m.type() === "error" && !NOISE.test(m.text())) errs.push(`CONSOLE: ${m.text().slice(0, 200)}`);
});
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 80; i++) {
  const ok = await page.evaluate(() => {
    try { return GameUI.initialized && typeof Modal === "object"; } catch (e) { return false; }
  }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

await page.evaluate(s => {
  try { GameIntervals.stop(); } catch (e) { /* ignore */ }
  try { AutomatorBackend.stop(); } catch (e) { /* ignore */ }
  player = GameSaveSerializer.deserialize(s);
  player.lastUpdate = Date.now();
  GameStorage.loadPlayerObject(player);
  player.lastUpdate = Date.now();
  try { GameIntervals.stop(); } catch (e) { /* ignore */ }
  window.__prime = (raw, state) => {
    AutomatorBackend.importFullScriptData(raw, { presets: false, constants: false });
    const id = AutomatorBackend.state.editorScript;
    AutomatorBackend.state.topLevelScript = id;
    if (state === "stopped") AutomatorBackend.stop();
    else AutomatorBackend.start(id, state === "paused" ? AUTOMATOR_MODE.PAUSE : AUTOMATOR_MODE.RUN);
    return { running: AutomatorBackend.isRunning, isOn: AutomatorBackend.isOn };
  };
  window.__openToast = () => {
    Modal.importScriptData.show();
    return true;
  };
  window.__readModal = () => {
    const el = document.querySelector(".c-modal");
    return el ? el.innerText.replace(/\s+/g, " ").trim() : null;
  };
  window.__closeModal = () => {
    try { Modal.importScriptData.removeFromQueue(); } catch (e) { /* ignore */ }
    return true;
  };
}, SAVE);

const rows = [];
const check = (name, ok, detail) => {
  rows.push({ name, ok, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? `  鈥斺€?${detail}` : ""}`);
};
const openAndRead = async state => {
  const primed = await page.evaluate(({ a, s }) => window.__prime(a, s), { a: SCRIPT_A, s: state });
  await page.evaluate(() => window.__openToast());
  await new Promise(r => setTimeout(r, 600));
  const text = await page.evaluate(() => window.__readModal());
  await page.evaluate(() => window.__closeModal());
  await new Promise(r => setTimeout(r, 300));
  return { primed, text };
};

let r = await openAndRead("running");
check("杩愯涓細寮圭獥姝ｅ父娓叉煋", Boolean(r.text && r.text.includes("瀵煎叆鑷姩鏈鸿剼鏈?)), (r.text ?? "null").slice(0, 90));
check("杩愯涓細鍑虹幇銆岀珛鍒诲垏鎹㈠埌鏂拌剼鏈户缁繍琛屻€嶆彁绀?, /姝ｅ湪杩愯/.test(r.text ?? "") && /绔嬪埢鍒囨崲鍒版柊鑴氭湰/.test(r.text ?? ""),
  (r.text ?? "").slice(0, 200));

r = await openAndRead("paused");
check("鏆傚仠涓細鍑虹幇銆屼繚鎸佹殏鍋溿€嶆彁绀?, /宸叉殏鍋?.test(r.text ?? "") && /淇濇寔鏆傚仠/.test(r.text ?? ""),
  (r.text ?? "").slice(0, 200));

r = await openAndRead("stopped");
check("鍋滄鐘舵€佷笅锛氫笉鍑虹幇鍒囨崲鎻愮ず", !/鍒囨崲鍒版柊鑴氭湰|淇濇寔鏆傚仠/.test(r.text ?? ""),
  (r.text ?? "").slice(0, 200));

check("椤甸潰/鎺у埗鍙版棤閿欒", errs.length === 0, errs.length ? errs.slice(0, 4).join(" | ") : "0 鏉?);

fs.writeFileSync(OUT, JSON.stringify({
  generatedAt: new Date().toISOString(), rows, pageErrors: errs,
}, null, 1), "utf-8");
const failed = rows.filter(x => !x.ok).length;
console.log(`\n鍚堣 ${rows.length} 椤癸細PASS ${rows.length - failed} / FAIL ${failed}`);

await browser.close();
server.close();
process.exit(failed === 0 ? 0 : 1);
