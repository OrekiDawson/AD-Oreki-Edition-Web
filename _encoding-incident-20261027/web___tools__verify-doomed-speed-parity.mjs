// 姣佺伃鐜板疄锛圥elle锛夊€嶇巼涓€鑷存€ф帰閽?
//
// 鐩殑锛氱‘璁?`getGlobalSpeedFactor()` 鍦ㄦ瘉鐏幇瀹炰腑鏄惁浠嶆槸鍏ㄩ鍊嶇巼銆?
// 鏂规硶锛氬悓涓€瀛樻。鍒嗗埆鐢?F=1 涓?F=10000 鍚勮窇鍥哄畾甯ф暟锛屾瘮杈冦€屾父鎴忔椂闂?/ 鐜板疄鏃堕棿銆嶄箣姣旓紝
//       鍐嶇湅 F=10000 鐩稿 F=1 鐨勬斁澶у€嶆暟銆?
//       鈥斺€?璇ユ瘮鍊间笌瀛樻。鑷韩鐨勫畼鏂规父鎴忛€熷害鍥犲瓙鏃犲叧锛堝悓涓€瀛樻。鍐呯浉浜掓姷娑堬級銆?
// 鏈熸湜锛?
//   闈炴瘉鐏瓨妗ｏ細F 鏀惧ぇ鍊嶆暟 = 10000锛堝洖褰掍繚鎶わ紝涓嶅簲鍙樺寲锛?
//   姣佺伃瀛樻。  锛氫慨澶嶅墠 = 100锛坰qrt锛夛紝淇鍚?= 10000
//
// 鐢ㄦ硶锛歯ode verify-doomed-speed-parity.mjs [--frames=80] [--warm=30]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const ROOT = process.env.OREKI_ROOT || "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon"
};

const argNum = (k, d) => {
  const h = process.argv.find(a => a.startsWith(`--${k}=`));
  const v = h ? Number(h.split("=")[1]) : NaN;
  return Number.isFinite(v) && v > 0 ? v : d;
};
const FRAMES = argNum("frames", 80);
const WARM = argNum("warm", 30);
const FRAME_MS = 20;

const CASES = [
  { label: "闈炴瘉鐏?/ 1R", file: "598._1R+1DB+1e9AM.txt", expectDoomed: false },
  { label: "姣佺伃鐜板疄 / 鏃╂湡浣╁嫆", file: "1002._1e6AM+Cel7.txt", expectDoomed: true },
];
const FACTORS = [1, 10000];

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
await new Promise(r => server.listen(8493, "127.0.0.1", r));

const browser = await launchViaConnect({ protocolTimeout: 300000 });
const page = await browser.newPage();
const errs = [];
const NOISE = /googletagmanager|google-analytics|kaspersky-labs|Vue warn|progress\.info/;
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => {
  if (m.type() === "error" && !NOISE.test(m.text())) errs.push(`CONSOLE: ${m.text().slice(0, 160)}`);
});
await page.goto("http://127.0.0.1:8493/index.html", { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 80; i++) {
  const ok = await page.evaluate(() => {
    try { return typeof gameLoop === "function" && typeof GameSpeed === "object"; } catch (e) { return false; }
  }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

await page.evaluate(() => {
  window.__p = {
    setup(text, F) {
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      GameSpeed.set(F);
      // 鍏ㄩ儴鑷姩璐拱鍣ㄥ叧闂細閬垮厤閲囪喘鎶婃椂闂?璧勬簮鎼呰繘娴嬮噺
      const walk = o => {
        for (const k of Object.keys(o)) {
          const v = o[k];
          if (v && typeof v === "object") {
            if ("isActive" in v) v.isActive = false;
            walk(v);
          }
        }
      };
      walk(player.auto);
      player.auto.autobuyersOn = false;
      try { AutomatorBackend.stop(); } catch (e) { /* ignore */ }
      return {
        F: GameSpeed.factor,
        eff: getGlobalSpeedFactor(),
        raw: getGlobalSpeedFactorRaw(),
        doomed: Boolean(Pelle.isDoomed),
        realityTime: player.records.thisReality.time,
        realityReal: player.records.thisReality.realTime,
      };
    },
    step(n, ms) {
      for (let i = 0; i < n; i++) gameLoop(ms);
      return {
        time: player.records.thisReality.time,
        real: player.records.thisReality.realTime,
        infTime: player.records.thisInfinity.time,
        infReal: player.records.thisInfinity.realTime,
        am: String(Currency.antimatter.value),
      };
    },
  };
});

const out = [];
for (const c of CASES) {
  const text = fs.readFileSync(path.join(SAVE_DIR, c.file), "utf-8");
  const perF = {};
  for (const F of FACTORS) {
    const info = await page.evaluate(({ t, f }) => window.__p.setup(t, f), { t: text, f: F });
    await page.evaluate(({ n, ms }) => window.__p.step(n, ms), { n: WARM, ms: FRAME_MS });
    const a = await page.evaluate(() => window.__p.step(0, 0));
    const b = await page.evaluate(({ n, ms }) => window.__p.step(n, ms), { n: FRAMES, ms: FRAME_MS });
    const dt = b.time - a.time;
    const dr = b.real - a.real;
    perF[F] = {
      aTime: a.time, bTime: b.time, aReal: a.real, bReal: b.real,
      doomed: info.doomed,
      effAtSetup: info.eff,
      ratio: dr > 0 ? dt / dr : NaN,
      dt, dr,
      amStable: a.am === b.am,
    };
    if (info.doomed !== c.expectDoomed) {
      errs.push(`CASE:${c.label} doomed 鐘舵€佷笌棰勬湡涓嶇锛?{info.doomed} != ${c.expectDoomed}锛塦);
    }
  }
  const scale = perF[10000].ratio / perF[1].ratio;
  out.push({
    case: c.label, file: c.file,
    doomed: perF[10000].doomed,
    ratioF1: +perF[1].ratio.toFixed(4),
    ratioF10k: +perF[10000].ratio.toFixed(4),
    fScaling: +scale.toFixed(2),
    effAtSetupF10k: perF[10000].effAtSetup,
    rawF10k: { aTime: perF[10000].aTime, bTime: perF[10000].bTime, aReal: perF[10000].aReal, bReal: perF[10000].bReal },
    rawF1: { aTime: perF[1].aTime, bTime: perF[1].bTime, aReal: perF[1].aReal, bReal: perF[1].bReal },
  });
}

const table = out
  .map(r => `${r.case}\t doomed=${r.doomed}\t ratio(F=1)=${r.ratioF1}\t ratio(F=10000)=${r.ratioF10k}\t 鏀惧ぇ=${r.fScaling}脳`)
  .join("\n");
console.log("---- 鏃堕挓姣旓紙娓告垙鏃堕棿 / 鐜板疄鏃堕棿锛?----");
console.log(table);

const doomed = out.find(r => r.doomed);
const normal = out.find(r => !r.doomed);
const okDoomed = doomed && Math.abs(doomed.fScaling - 10000) / 10000 < 0.02;
const okNormal = normal && Math.abs(normal.fScaling - 10000) / 10000 < 0.02;
console.log(`\n[鍒ゅ畾] 姣佺伃鐜板疄鍏ㄩ鍊嶇巼: ${okDoomed ? "PASS" : "FAIL"}锛?{doomed ? doomed.fScaling : "n/a"}脳锛塦);
console.log(`[鍒ゅ畾] 闈炴瘉鐏洖褰掍繚鎶?   : ${okNormal ? "PASS" : "FAIL"}锛?{normal ? normal.fScaling : "n/a"}脳锛塦);
console.log(`[鍒ゅ畾] 鎺у埗鍙?椤甸潰閿欒    : ${errs.length === 0 ? "PASS锛? 鏉★級" : `FAIL锛?{errs.length} 鏉★級`}`);
if (errs.length) console.log(errs.slice(0, 8).join("\n"));

fs.writeFileSync(
  "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/doomed-speed-parity.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), root: ROOT, frames: FRAMES, warm: WARM, rows: out, errors: errs }, null, 1),
  "utf-8"
);

await browser.close();
server.close();
process.exit(okDoomed && okNormal && errs.length === 0 ? 0 : 1);
