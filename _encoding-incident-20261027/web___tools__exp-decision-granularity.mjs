// 鍐崇瓥绮掑害 A/B 瀹為獙锛氶獙璇併€屾瘡甯у彧璺戜竴娆￠噰璐€嶆槸鍚﹂檺鍒堕珮 F 鐨勫疄闄呮敹鐩?
//
// 鍙ｅ緞璇存槑锛堥噸瑕侊級锛?
//   * 甯?= 澧欓挓浠ｇ悊锛屽浐瀹?20ms/甯э紙绛変环绋冲畾 50fps锛夛紝涓嶆槸鐪熷疄娴忚鍣ㄨ鏃?
//   * 绛栫暐 A锛氭瘡甯?1 娆″喅绛栵紙鐜扮姸鍩虹嚎锛?
//   * 绛栫暐 B锛氭瘡甯?k 娆″喅绛栵紝鎶婅繖涓€甯х殑 diff 骞冲垎鎴?k 娈碉紙姣忔 frameMs/k锛?
//     鈥斺€?涓嶆敼鍙樺崟娆″喅绛栫殑璇箟锛屽彧鏀瑰彉鍐崇瓥鍙戠敓鐨勯鐜?
//   * 姣忎釜 (F, k) 缁勫悎閲嶅 REPS 娆★紝閫愭璁板綍甯ф暟/澧欓挓/娓告垙鏃堕棿/鏈€?
//   * 鍏ㄩ儴鍙窇鍦ㄧ嫭绔嬪壇鏈瓨妗ｄ笂锛涗笉瑙︾ _saves 鍘熷鏂囦欢
//
// 鐢ㄦ硶锛歯ode exp-decision-granularity.mjs [--reps=3] [--port=8310]

import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition";
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml", ".mp3": "audio/mpeg",
  ".ttf": "font/ttf", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
};
const arg = k => {
  const hit = process.argv.find(a => a.startsWith(`--${k}=`));
  return hit ? hit.split("=")[1] : null;
};
const REPS = Number(arg("reps") || 3);
const PORT = Number(arg("port") || 8310);
const FRAME_MS = 20;
const FRAMES_BUDGET = 20000;     // 涓庡熀绾夸竴鑷?
const OPS_BUDGET = 400000;       // 甯ф暟 脳 k 鐨勭‖涓婇檺锛岄槻姝?k 寰堝ぇ鏃惰窇涓嶅畬

const ROOT_ABS = path.resolve(ROOT);
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(ROOT_ABS, "." + p);
  // 娉ㄦ剰锛氬繀椤荤敤 path.relative 鍒ゅ畾瓒婄晫銆傜洿鎺?f.startsWith(ROOT) 鍦?Windows 涓婁細鍥?
  // 鍒嗛殧绗︿笉鍚岋紙\ vs /锛夎€屾妸鍏ㄩ儴璇锋眰璇垽鎴愯秺鐣?鈫?403 鈫?椤甸潰鎵撲笉寮€銆?
  const rel = path.relative(ROOT_ABS, f);
  if (rel.startsWith("..") || path.isAbsolute(rel)) { res.writeHead(403).end(); return; }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(PORT, "127.0.0.1", r));

// 鈥斺€?娴忚鍣ㄥ惎鍔細涓嶈蛋 puppeteer.launch 鈥斺€?
// 鏈満 Edge 鍦ㄣ€屽凡鏈夊悗鍙拌繘绋嬨€嶆椂浼氭妸鏂板惎鍔ㄥ娲剧粰鏃㈡湁瀹炰緥锛坙auncher 绔嬪埢 exit 0锛夛紝
// puppeteer.launch 鍥犳鎶?鈥淔ailed to launch the browser process: Code: 0鈥濄€?
// 鏀逛负鑷繁璧?Edge锛堝浐瀹?--remote-debugging-port锛? puppeteer.connect锛岀ǔ瀹氫笖鍙簿纭洖鏀惰嚜宸遍偅涓€涓繘绋嬫爲銆?
const puppeteer = (await import("puppeteer-core")).default;
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const { spawn } = await import("node:child_process");
const os = await import("node:os");

const dbgPort = 9300 + Math.floor(Math.random() * 300);
const profileDir = path.join(os.tmpdir(), `oreki-ab-prof-${Date.now()}`);
const edgeProc = spawn(EDGE, [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--mute-audio",
  "--no-first-run", "--no-default-browser-check", "--disable-background-mode",
  `--remote-debugging-port=${dbgPort}`, `--user-data-dir=${profileDir}`,
  "--window-size=1200,800", "about:blank",
], { stdio: "ignore", detached: false });

let browser = null;
{
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    try {
      const r = await fetch(`http://127.0.0.1:${dbgPort}/json/version`);
      if (r.ok) { await r.json(); break; }
    } catch (e) { /* 杩樻病璧锋潵 */ }
    await new Promise(r => setTimeout(r, 300));
  }
  browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${dbgPort}`, protocolTimeout: 900000 });
}
const closeBrowser = async () => {
  try { await browser.disconnect(); } catch (e) { /* ignore */ }
  try {
    const { spawnSync } = await import("node:child_process");
    spawnSync("taskkill", ["/PID", String(edgeProc.pid), "/T", "/F"], { stdio: "ignore" });
  } catch (e) { /* ignore */ }
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
};

const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
const NOISE = /googletagmanager|google-analytics|kaspersky-labs/;
page.on("console", m => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (NOISE.test(t)) return;                     // 澶栭儴缁熻鑴氭湰琚湰鏈?AV 鐨?CSP 鎷︽埅锛屼笌椤圭洰鏃犲叧
  errs.push(`CONSOLE: ${t.slice(0, 200)}`);
});

await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "load", timeout: 60000 });

// 灏辩华鎺㈡祴锛氭湰椤圭洰鍏ㄥ眬鎸傚湪鍏ㄥ眬璇嶆硶鐜锛屼笖 Currency 鏄?function
let ready = false;
for (let i = 0; i < 80; i++) {
  ready = await page.evaluate(() => {
    try {
      return typeof gameLoop === "function" && typeof Currency === "function" &&
        typeof buyAsManyAsYouCanBuy === "function" && typeof player === "object";
    } catch (e) { return false; }
  }).catch(() => false);
  if (ready) break;
  await new Promise(r => setTimeout(r, 500));
}
if (!ready) {
  let diag = {};
  try {
    diag = await page.evaluate(() => ({
      url: location.href, title: document.title, readyState: document.readyState,
      bodyLen: document.body ? document.body.innerText.length : -1,
      tGameLoop: typeof gameLoop, tCurrency: typeof Currency, tPlayer: typeof player,
      tBuy: typeof buyAsManyAsYouCanBuy,
    }));
  } catch (e) { diag = { evalError: e.message }; }
  console.error(`FAIL  娓告垙鏈湪 30s 鍐呭惎鍔細${JSON.stringify(diag)}`);
  console.error(`      鎹曡幏鍒扮殑椤甸潰閿欒锛?{errs.slice(0, 3).join(" | ") || "锛堟棤锛?}`);
  await closeBrowser(); server.close();
  process.exit(1);
}
console.log("PASS  娓告垙鍚姩灏辩华");

// 鈥斺€?椤甸潰鍐呭疄楠岄┍鍔ㄥ櫒 鈥斺€?
await page.evaluate(() => {
  const cnt = { buys: 0, units: 0, boosts: 0, galaxies: 0, crunchTries: 0, crunches: 0, tickspeed: 0 };
  window.__x = {
    lg(v) {
      if (v && typeof v.log10 === "function") {
        const d = v.log10();
        const n = d && d.toNumber ? d.toNumber() : Number(d);
        return Number.isFinite(n) ? n : NaN;
      }
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? Math.log10(n) : NaN;
    },
    num(v) { const n = v && v.toNumber ? v.toNumber() : Number(v); return Number.isFinite(n) ? n : NaN; },
    snap() {
      const safe = f => { try { return f(); } catch (e) { return undefined; } };
      return {
        game: player.records.totalTimePlayed,
        real: player.records.realTimePlayed,
        amLog: this.lg(Currency.antimatter.value),
        ipLog: this.lg(Currency.infinityPoints.value),
        inf: this.num(Currency.infinities.value),
        galaxies: this.num(player.galaxies),
        dimBoosts: this.num(player.dimensionBoosts),
        speedup: safe(() => getGameSpeedupFactor()),
        simLocked: safe(() => GameSpeed.isSimulationLocked),
        ach188: safe(() => Achievement(188).isUnlocked),
      };
    },
    resetCounters() {
      for (const k of Object.keys(cnt)) cnt[k] = 0;
      return true;
    },
    counters() { return { ...cnt }; },
    // 鍗曟鍐崇瓥锛氳涔変笌鍘熷熀绾垮畬鍏ㄤ竴鑷达紙涓嶆柊澧炪€佷笉鍒犲噺浠讳綍鍔ㄤ綔锛?
    decide(aggressive) {
      for (let t = 1; t <= 8; t++) {
        try { if (buyAsManyAsYouCanBuy(t) === true) cnt.buys++; } catch (e) { /* 鏈В閿?*/ }
      }
      try { if (buyMaxTickSpeed()) cnt.tickspeed++; } catch (e) { /* ignore */ }
      const b0 = this.num(player.dimensionBoosts);
      try { if (DimBoost.canBeBought) requestDimensionBoost(1); } catch (e) { /* ignore */ }
      cnt.boosts += Math.max(0, this.num(player.dimensionBoosts) - b0);
      const g0 = this.num(player.galaxies);
      try { if (Galaxy.canBeBought) requestGalaxyReset(1); } catch (e) { /* ignore */ }
      cnt.galaxies += Math.max(0, this.num(player.galaxies) - g0);
      if (aggressive) {
        try { if (Player.canCrunch) { cnt.crunchTries++; bigCrunchReset(); cnt.crunches++; } } catch (e) { /* ignore */ }
      }
    },
    // 鍏ㄦ柊寮€灞€锛堢嫭绔嬪壇鏈級锛屼笌鍩虹嚎 setupFresh 鍚屾簮
    setupFresh(F) {
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      if (!window.__freshText) window.__freshText = GameSaveSerializer.serialize(player);
      player = GameSaveSerializer.deserialize(window.__freshText);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      GameSpeed.set(F);
      this.resetCounters();
      return this.snap();
    },
    // 绛栫暐鎵ц锛歯Frames 甯э紝姣忓抚 k 娆″喅绛栵紙姣忔 diff = frameMs/k锛?
    run(nFrames, frameMs, k, aggressive) {
      const sub = frameMs / k;
      let maxInfPerFrame = 0;
      let lockedSeen = false;
      for (let i = 0; i < nFrames; i++) {
        const inf0 = this.num(Currency.infinities.value) || 0;
        for (let j = 0; j < k; j++) {
          this.decide(aggressive);
          gameLoop(sub);
        }
        const inf1 = this.num(Currency.infinities.value) || 0;
        maxInfPerFrame = Math.max(maxInfPerFrame, inf1 - inf0);
        try { if (GameSpeed.isSimulationLocked) lockedSeen = true; } catch (e) { /* ignore */ }
        if (Number.isFinite(inf1) && inf1 > 0) {
          return { reached: true, frames: i + 1, maxInfPerFrame, lockedSeen, state: this.snap() };
        }
      }
      return { reached: false, frames: nFrames, maxInfPerFrame, lockedSeen, state: this.snap() };
    },
    // 瀵圭収锛氫笉鍋氫换浣曞喅绛栵紝鍙窇鏃堕棿锛堢敤鏉ラ噺鍖?k 娈电Н鍒嗘湰韬殑宸紓锛?
    runNoDecision(nFrames, frameMs, k) {
      const sub = frameMs / k;
      for (let i = 0; i < nFrames; i++) {
        for (let j = 0; j < k; j++) gameLoop(sub);
      }
      return this.snap();
    },
  };
});

const e2 = v => (Number.isFinite(v) ? v.toExponential(2) : "鈥?);

// ================= 0. 瀵圭収缁勶細鏃犲喅绛栨椂锛宬 娈电Н鍒嗕笌 1 娈电殑宸紓 =================
console.log("\n========== 0. 瀵圭収锛氫笉鍋氫换浣曞喅绛栨椂锛宬 娈电Н鍒?vs 1 娈碉紙閲忓寲鍒嗘璇樊锛?==========");
const ctrl = [];
for (const k of [1, 10, 100]) {
  const s0 = await page.evaluate((F) => window.__x.setupFresh(F), 10000);
  const s1 = await page.evaluate(({ n, ms, k }) => window.__x.runNoDecision(n, ms, k), { n: 200, ms: FRAME_MS, k });
  ctrl.push({ k, dGame: s1.game - s0.game, dAm: s1.amLog - s0.amLog, game: s1.game });
}
console.log("     k   螖娓告垙鏃堕棿(ms)   螖log10(AM)   螖娓告垙/鏈熸湜(200脳20脳10000)");
for (const r of ctrl) {
  const expect = 200 * FRAME_MS * 10000;
  console.log(`  ${String(r.k).padStart(4)} ${String(r.dGame).padStart(14)} ${String(r.dAm.toFixed(6)).padStart(12)} ${String((r.dGame / expect).toFixed(9)).padStart(12)}`);
}
const ctrlBase = ctrl[0];
const ctrlMaxDev = Math.max(...ctrl.map(r => Math.abs(r.dGame / ctrlBase.dGame - 1)));
console.log(`  鍒嗘璇樊涓婇檺锛殀螖k/螖1 鈭?1| 鏈€澶?= ${(ctrlMaxDev * 100).toFixed(6)}%`);

// ================= 1. A/B 涓诲疄楠?=================
// 绛栫暐琛細F=10000 璇?k=1/10/100锛汧=1000 璇?k=1/10锛坘=100 鍦?F=1000 涓?ops 棰勭畻涓嶅锛?
const PLAN = [
  { F: 1000, ks: [1, 10] },
  { F: 10000, ks: [1, 10, 100] },
];

console.log("\n========== 1. A/B 涓诲疄楠岋紙姣忎釜缁勫悎閲嶅 " + REPS + " 娆★級 ==========");
console.log("鍙ｅ緞锛?0ms/甯э紱B 鐨勬瘡甯ф妸 20ms 骞冲垎鎴?k 娈碉紝姣忔鍓嶅仛涓€娆″喅绛栵紱甯ф暟鍗冲閽熶唬鐞?);

const rows = [];
for (const { F, ks } of PLAN) {
  for (const k of ks) {
    const framesBudget = Math.min(FRAMES_BUDGET, Math.floor(OPS_BUDGET / k));
    for (let rep = 1; rep <= REPS; rep++) {
      const s0 = await page.evaluate((F) => window.__x.setupFresh(F), F);
      const t0 = Date.now();
      const r = await page.evaluate(({ n, ms, k }) => window.__x.run(n, ms, k, true), { n: framesBudget, ms: FRAME_MS, k });
      const simMs = Date.now() - t0;
      const c = await page.evaluate(() => window.__x.counters());
      rows.push({
        F, k, rep,
        reached: r.reached,
        frames: r.frames,
        wallProxyMs: r.frames * FRAME_MS,
        gameMs: r.state.game - s0.game,
        realMs: r.state.real - s0.real,
        amLog: r.state.amLog,
        galaxies: r.state.galaxies,
        dimBoosts: r.state.dimBoosts,
        maxInfPerFrame: r.maxInfPerFrame,
        lockedSeen: r.lockedSeen,
        simMs,
        ops: r.frames * k,
        counters: c,
        framesBudget,
      });
      const last = rows[rows.length - 1];
      console.log(`  F=${String(F).padStart(5)} k=${String(k).padStart(3)} rep${rep}  ` +
        `${last.reached ? "鍒拌揪" : "鏈埌杈?}  甯?${String(last.frames).padStart(5)}  ` +
        `澧欓挓浠ｇ悊=${(last.wallProxyMs / 1000).toFixed(1)}s  娓告垙=${e2(last.gameMs / 1000)}s  ` +
        `AM=${last.amLog?.toFixed(2)}  鏄熺郴/鎻愬崌=${last.galaxies}/${last.dimBoosts}  ` +
        `涔板叆娆℃暟=${c.buys} 鎻愬崌=${c.boosts} 鏄熺郴=${c.galaxies} 鍧嶅=${c.crunches}  ` +
        `ops=${last.ops} 妯℃嫙鑰楁椂=${(simMs / 1000).toFixed(1)}s`);
    }
  }
}

// ================= 2. 姹囨€讳笌鍒ゅ畾 =================
const agg = (F, k) => {
  const sub = rows.filter(r => r.F === F && r.k === k);
  const reached = sub.filter(r => r.reached);
  const frames = sub.map(r => r.frames);
  return {
    F, k, reps: sub.length, reachedReps: reached.length,
    framesMin: Math.min(...frames), framesMax: Math.max(...frames),
    frameSpread: Math.max(...frames) / Math.min(...frames),
    wallProxy: sub.map(r => r.wallProxyMs / 1000),
    gameS: sub.map(r => r.gameMs / 1000),
    simMs: sub.map(r => r.simMs),
    counters: sub.map(r => r.counters),
    maxInfPerFrame: Math.max(...sub.map(r => r.maxInfPerFrame)),
    lockedSeen: sub.some(r => r.lockedSeen),
  };
};

console.log("\n========== 2. 姹囨€伙紙鍚?F 涓嬩笉鍚?k 瀵规瘮锛?==========");
const summary = [];
for (const { F, ks } of PLAN) {
  const base = agg(F, 1);
  console.log(`\n--- F=${F} ---`);
  console.log("     k  鍒拌揪/閲嶅  甯ф暟鑼冨洿        甯ф暟姣? 澧欓挓浠ｇ悊(s)      娓告垙鏃堕棿(s)      CRUNCH  涔板叆   瀹炴祴CPU(s)    鐪熷疄澧欓挓涓嬬晫(s)");
  for (const k of ks) {
    const a = agg(F, k);
    const ratio = a.framesMin / base.framesMin;
    summary.push({ F, k, ...a });
    const realWall = a.simMs.map((ms, i) => Math.max(a.wallProxy[i] * 1000, ms) / 1000);
    a.realWall = realWall;
    a.framesRatio = ratio;
    console.log(`  ${String(k).padStart(4)} ${String(a.reachedReps + "/" + a.reps).padStart(8)}  ` +
      `${String(a.framesMin).padStart(5)}~${String(a.framesMax).padEnd(5)} ${ratio.toFixed(3).padStart(9)}  ` +
      `${a.wallProxy.map(v => v.toFixed(1)).join("/").padStart(14)}  ` +
      `${a.gameS.map(v => e2(v)).join("/").padStart(16)}  ` +
      `${String(a.counters.reduce((s, c) => s + c.crunches, 0)).padStart(6)}  ` +
      `${String(a.counters.reduce((s, c) => s + c.buys, 0)).padStart(5)}  ` +
      `${a.simMs.map(v => (v / 1000).toFixed(1)).join("/").padStart(14)}  ` +
      `${realWall.map(v => v.toFixed(1)).join("/").padStart(12)}`);
  }
}

// 鍒ゅ畾
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  鈥?${detail}` : ""}`);
};
const note = (t) => console.log(`NOTE  ${t}`);

console.log("\n========== 3. 鍒ゅ畾 ==========");

// 3.1 A 缁勫繀椤诲鐜颁笂涓€杞熀绾匡紙F=1000 鈫?3200锛孎=10000 鈫?1200锛夛紝宸殑鍙槸 chunk 绮掑害锛堜笂涓€杞?100 甯?鈫?鏈疆 1 甯э級
const a1000 = agg(1000, 1), a10000 = agg(10000, 1);
check("[A1] 绛栫暐 A锛坘=1锛変笁娆￠噸澶嶅畬鍏ㄤ竴鑷达紙甯ф暟鏋佸樊 = 1锛?,
  a1000.frameSpread === 1 && a10000.frameSpread === 1 && a1000.reachedReps === REPS && a10000.reachedReps === REPS,
  `F=1000 ${a1000.framesMin}~${a1000.framesMax}锛孎=10000 ${a10000.framesMin}~${a10000.framesMax}`);
note(`[A2] 涓庝笂涓€杞熀绾跨殑宸紓鏉ヨ嚜 chunk 绮掑害锛氫笂涓€杞瘡 100 甯ф墠鍒ゅ畾涓€娆＄粓鐐癸紙F=1000 鎶?3200銆丗=10000 鎶?1200 = 100 鐨勬暣鏁板€嶏級锛屾湰杞€愬抚鍒ゅ畾 鈫?${a1000.framesMin} / ${a10000.framesMin}銆傝繖鏄矑搴﹀樊寮傦紝涓嶆槸琛屼负鍙樺寲銆俙);

// 3.2 瀹夊叏鎬э細姣忓抚鏈€澶?1 娆″潔濉屻€佹棤绂荤嚎妯℃嫙娉ㄥ叆
const maxInf = Math.max(...rows.map(r => r.maxInfPerFrame));
const locked = rows.some(r => r.lockedSeen);
check("[S1] 娌℃湁浠讳綍涓€甯у彂鐢?>1 娆″潔濉岋紙鏃犲悓甯ч噸澶嶉噸缃級", maxInf <= 1, `鍗曞抚鏈€澶?螖鏃犻檺 = ${maxInf}`);
check("[S2] 鍏ㄥ疄楠屾湡闂存病鏈夎Е鍙戠绾挎ā鎷燂紙鏈嚭鐜版ā鎷熼攣锛?, locked === false, `lockedSeen=${locked}`);

// 3.3 B 鐨勬敹鐩?
for (const { F, ks } of PLAN) {
  const base = agg(F, 1);
  for (const k of ks.filter(x => x > 1)) {
    const a = agg(F, k);
    const frameGain = base.framesMin / a.framesMin;
    const wallGain = (base.framesMin * FRAME_MS) / (a.framesMin * FRAME_MS);
    const costGain = base.simMs[0] / a.simMs[0];
    const gameRatio = a.gameS[0] / base.gameS[0];
    check(`[B-${F}-k${k}] B 鐨勫抚鏁帮紙澧欓挓浠ｇ悊锛変弗鏍煎皯浜?A`, frameGain > 1.02,
      `A=${base.framesMin} 甯?鈫?B=${a.framesMin} 甯э紝鏀剁泭 ${frameGain.toFixed(3)}脳`);
    note(`  F=${F} k=${k}锛氬抚鏁版敹鐩?${frameGain.toFixed(3)}脳锛堝閽熶唬鐞嗗悓姣斾緥 ${wallGain.toFixed(3)}脳锛夛紱` +
      `鍒拌揪鏃舵父鎴忔椂闂?${e2(base.gameS[0])}s 鈫?${e2(a.gameS[0])}s锛?{gameRatio.toFixed(3)}脳锛夛紱` +
      `鍚屾牱鐨勫抚閲屽喅绛栨鏁?脳${k}锛岃剼鏈ā鎷熻€楁椂 ${(a.simMs[0] / 1000).toFixed(1)}s vs A ${(base.simMs[0] / 1000).toFixed(1)}s锛圕PU 鎴愭湰 ${costGain.toFixed(2)}脳 鏇寸渷/鏇磋垂瑙佺鍙凤級`);
  }
}

// 3.4 璇箟椋庨櫓妫€鏌ワ細鍐崇瓥娆℃暟鏄惁绾挎€ц啫鑳€
console.log("\n========== 4. 鍐崇瓥娆℃暟锛堣涔夐闄╃殑鏍稿績瑙傛祴锛?==========");
console.log("     F     k   鍐崇瓥娆℃暟/甯?  涔板叆鎴愬姛娆℃暟   涔板叆鎴愬姛/鍗冨抚   鎻愬崌   鏄熺郴   鍧嶅");
for (const a of summary) {
  const dec = a.counters.reduce((s, c) => s + c.buys + c.tickspeed + c.boosts + c.galaxies, 0);
  const frames = a.framesMin * a.reps;
  const buys = a.counters.reduce((s, c) => s + c.buys, 0);
  console.log(`  ${String(a.F).padStart(6)} ${String(a.k).padStart(4)} ${String(a.k).padStart(11)} ` +
    `${String(buys).padStart(13)} ${String((buys / frames * 1000).toFixed(0)).padStart(14)} ` +
    `${String(a.counters.reduce((s, c) => s + c.boosts, 0)).padStart(6)} ` +
    `${String(a.counters.reduce((s, c) => s + c.galaxies, 0)).padStart(5)} ` +
    `${String(a.counters.reduce((s, c) => s + c.crunches, 0)).padStart(5)}`);
}
note("涔板叆鎴愬姛/鍗冨抚 鏄€屾湁鏁堣喘涔板姩浣溿€嶇殑瀵嗗害銆俴 瓒婂ぇ锛岃繖涓瘑搴﹀簲杩戜技 脳k锛堝喅绛栨満浼氬彉澶氾級锛屼絾姣忔涔板叆鐨勪欢鏁颁細鍙樺皬 鈥斺€?鎴愭湰妯″瀷瑙佷笅鏉°€?);

// 3.5 鎴愭湰妯″瀷锛氬崟鍏冧环鏍煎彧闅?bought/10 鍙樺寲锛屾墍浠ユ洿棰戠箒璐拱涓嶄細鏇翠究瀹滐紙涔熶笉鏄洿璐碉級
console.log("\n========== 5. 璇箟椋庨櫓锛氭洿棰戠箒璐拱浼氫笉浼氬彉渚垮疁 / 鍙樿吹 ==========");
const costCheck = await page.evaluate(() => {
  const savedText = GameSaveSerializer.serialize(player);
  const dim = () => AntimatterDimension(1);
  const rearm = () => {
    player = GameSaveSerializer.deserialize(savedText);
    GameStorage.loadPlayerObject(player);
    // 鎶?AM 璋冨埌銆屽崟浠舵垚鏈?脳 100銆嶏紝淇濊瘉涓ょ涔版硶閮借惤鍦ㄥ悓涓€涓环鏍奸樁姊紙bought/10 涓嶅彉锛夊唴
    Currency.antimatter.value = dim().cost.times(100);
  };
  // 鍦烘櫙 1锛氫竴娆?buyAsManyAsYouCanBuy锛堜拱鍒?10 鐨勬暣鏁板€嶈竟鐣岋級
  rearm();
  const a0 = Currency.antimatter.value;
  const n0 = dim().bought;
  buyAsManyAsYouCanBuy(1);
  const spent1 = a0.minus(Currency.antimatter.value).toString();
  const gained1 = dim().bought - n0;
  // 鍦烘櫙 2锛氬垎 gained1 娆°€佹瘡娆′拱 1 浠?
  rearm();
  const b0 = Currency.antimatter.value;
  const m0 = dim().bought;
  for (let i = 0; i < gained1; i++) buyOneDimension(1);
  const spent2 = b0.minus(Currency.antimatter.value).toString();
  const gained2 = dim().bought - m0;
  return { spent1, spent2, gained1, gained2 };
});

const relDiff = (a, b) => {
  const x = Number(a), y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0)) return (a === b ? 0 : NaN);
  return Math.abs(x - y) / Math.max(Math.abs(x), Math.abs(y));
};
const sameBought = costCheck.gained1 === costCheck.gained2;
const sameSpent = costCheck.spent1 === costCheck.spent2 || relDiff(costCheck.spent1, costCheck.spent2) < 1e-9;
console.log(`  涓€娆′拱婊★細bought +${costCheck.gained1}锛孉M 娑堣€?${Number(costCheck.spent1).toExponential(6)}`);
console.log(`  鍒?${costCheck.gained1} 娆′拱锛歜ought +${costCheck.gained2}锛孉M 娑堣€?${Number(costCheck.spent2).toExponential(6)}`);
check("[S3] 銆屽垎澶氭涔般€嶄笌銆屼竴娆′拱銆嶄欢鏁颁笌 AM 鎬绘秷鑰楅兘鐩稿悓锛堟垚鏈彧闅?bought/10 闃舵鍙樺寲锛屾棤鎵归噺鎶樻墸锛?,
  sameBought && sameSpent,
  `浠舵暟 ${costCheck.gained1} vs ${costCheck.gained2}锛涙秷鑰楁瘮 ${(Number(costCheck.spent2) / Number(costCheck.spent1)).toFixed(9)}`);

// 3.6 鍐崇瓥绮掑害瀹氬緥锛氭妸銆屾瘡甯ф父鎴忔椂闂?/ k銆嶅綋鎴愬喅绛栫矑搴︼紝璺?F 搴旇缁欏嚭鍚屾牱鐨勫埌杈炬父鎴忔椂闂?
console.log("");
console.log("========== 6. 鍐崇瓥绮掑害瀹氬緥锛堣法 F 瀵圭収锛?==========");
console.log("  鍐崇瓥绮掑害 = 20ms 脳 F / k锛堟瘡娆″喅绛栦箣闂存帹杩涚殑娓告垙绉掓暟锛?);
const cadence = [];
for (const a of summary) {
  const perDecisionS = (FRAME_MS * a.F / a.k) / 1000;
  cadence.push({ F: a.F, k: a.k, perDecisionS, gameS: a.gameS[0] });
  console.log(`  F=${String(a.F).padStart(5)} k=${String(a.k).padStart(3)} 鈫?绮掑害 ${perDecisionS.toFixed(1).padStart(6)}s/鍐崇瓥锛屽埌杈炬父鎴忔椂闂?${e2(a.gameS[0])}s`);
}
const pairs = [];
for (const x of cadence) {
  for (const y of cadence) {
    if (x.F === y.F || x.k <= y.k) continue;
    if (Math.abs(x.perDecisionS - y.perDecisionS) < 1e-9) pairs.push([x, y]);
  }
}
for (const [x, y] of pairs) {
  const dev = Math.abs(x.gameS / y.gameS - 1);
  console.log(`  鈫?鍚岀矑搴?${x.perDecisionS}s锛欶=${x.F}/k=${x.k} 涓?F=${y.F}/k=${y.k} 鐨勫埌杈炬父鎴忔椂闂?${e2(x.gameS)} vs ${e2(y.gameS)}锛堝亸宸?${(dev * 100).toFixed(2)}%锛塦);
}
check("[L1] 鍐崇瓥绮掑害鐩稿悓銆丗 涓嶅悓鏃讹紝鍒拌揪棣栦釜鏃犻檺鎵€闇€鐨勩€庢父鎴忔椂闂淬€忎竴鑷达紙卤3%锛?,
  pairs.length > 0 && pairs.every(([x, y]) => Math.abs(x.gameS / y.gameS - 1) <= 0.03),
  pairs.length ? `${pairs.length} 缁勫悓绮掑害瀵圭収` : "娌℃湁褰㈡垚鍚岀矑搴﹀鐓э紙k 缁勫悎涓嶈冻锛?);

// 3.7 甯ф暟鏀剁泭 vs 鐪熷疄澧欓挓鏀剁泭锛堝繀椤诲垎寮€鎶ワ級
console.log("");
console.log("========== 7. 甯ф暟鏀剁泭 涓?鐪熷疄澧欓挓鏀剁泭锛堝垎寮€锛?==========");
console.log("  鐪熷疄澧欓挓涓嬬晫 = max(甯ф暟 脳 20ms, 鏈瀹炴祴 CPU 鏃堕棿)銆傚抚鏁版瘮渚嬩笉鑳界洿鎺ュ綋鐜板疄鏃堕棿姣斾緥锛?);
console.log("  鑻ユ瘡甯х殑 CPU 鎴愭湰瓒呰繃 20ms锛屽抚鏁板彉灏戜篃涓嶄細璁╃幇瀹炴椂闂村悓姣斿彉灏戯紙浼氳 CPU 椤朵綇锛夈€?);
for (const { F, ks } of PLAN) {
  const base = agg(F, 1);
  const baseReal = Math.max(base.wallProxy[0] * 1000, base.simMs[0]) / 1000;
  for (const k of ks.filter(x => x > 1)) {
    const a = agg(F, k);
    const real = Math.max(a.wallProxy[0] * 1000, a.simMs[0]) / 1000;
    const frameGain = base.framesMin / a.framesMin;
    const wallGain = baseReal / real;
    const cpuPerFrame = a.simMs[0] / a.framesMin;
    console.log(`  F=${String(F).padStart(5)} k=${String(k).padStart(3)}锛氬抚鏁?${base.framesMin}鈫?{a.framesMin}锛?{frameGain.toFixed(2)}脳锛夛紝` +
      `鐪熷疄澧欓挓 ${baseReal.toFixed(1)}s鈫?{real.toFixed(1)}s锛?{wallGain.toFixed(2)}脳锛夛紝` +
      `CPU/甯?${cpuPerFrame.toFixed(1)}ms锛?0ms 甯ч绠楃殑 ${(cpuPerFrame / FRAME_MS).toFixed(2)} 鍊嶏級` +
      `${cpuPerFrame > FRAME_MS ? " 鈫?宸茶秴甯ч绠楋紝闈?CPU 椤朵綇" : ""}`);
    check(`[W-${F}-k${k}] 鐪熷疄澧欓挓涔熸湁鏀瑰杽锛?1.02脳锛塦, wallGain > 1.02,
      `${wallGain.toFixed(2)}脳`);
  }
}

// 3.8 璇箟缁嗚妭锛氬悓涓€鏃跺埢杩炵画鍐崇瓥锛堜腑闂翠笉鎺ㄨ繘鏃堕棿锛夎繕浼氫笉浼氱户缁拱鍏?
console.log("");
console.log("========== 8. 璇箟缁嗚妭锛氬悓涓€甯у唴澶氭鍐崇瓥鏄惁绛変簬銆屽悓涓€鏃跺埢杩炵偣澶氫笅銆?==========");
const multi = await page.evaluate(() => {
  const out = [];
  for (const F of [1, 10000]) {
    window.__x.setupFresh(F);
    // 鍏堣窇 200 甯э紝璁╄祫婧愭定璧锋潵锛屽啀鍦ㄣ€屽悓涓€鏃跺埢銆嶈繛缁喅绛?5 娆★紙涓棿涓嶈皟 gameLoop锛?
    for (let i = 0; i < 200; i++) { window.__x.decide(false); gameLoop(20); }
    const rounds = [];
    for (let r = 0; r < 5; r++) {
      const before = window.__x.counters().buys;
      window.__x.decide(false);
      rounds.push(window.__x.counters().buys - before);
    }
    out.push({ F, rounds });
  }
  return out;
});
for (const m of multi) {
  console.log(`  F=${String(m.F).padStart(5)}锛氬悓涓€鏃跺埢杩炵画 5 娆″喅绛栧悇鑷拱鍏ョ殑缁村害鏁?= ${m.rounds.join(" / ")}`);
}
const secondRoundBuys = multi.map(m => m.rounds[1] || 0);
note(`绗?2 娆°€屽悓涓€鏃跺埢銆嶅喅绛栦粛浼氫拱鍏?${secondRoundBuys.join(" / ")} 涓淮搴?鈫?k>1 鐨勬晥鏋滈噷锛屾湁涓€閮ㄥ垎鏄€屽悓涓€鏃跺埢鎶婂墿浣?AM 涔熻姳鎺夈€嶏紝` +
  `涓嶅畬鍏ㄦ槸銆屾洿鏃╁喅绛栥€嶃€傝繖瀵圭帺瀹剁殑绛変环鎿嶄綔鏄€屾墜鐐逛袱涓嬨€嶏紝涓嶆槸鏂扮殑鏈哄埗锛屼絾**纭疄姣旂幇鐘舵洿鍏呭垎鍦拌姳閽?*锛屽睘闇€瑕佹槑绀虹殑琛屼负宸紓銆俙);

check("[E] 鍏ㄦ祦绋嬫棤鏈崟鑾疯剼鏈紓甯?, errs.length === 0, errs.slice(0, 3).join(" | "));

// ================= 钀界洏 =================
const out = {
  generatedAt: new Date().toISOString(),
  frameMs: FRAME_MS, reps: REPS, framesBudget: FRAMES_BUDGET, opsBudget: OPS_BUDGET,
  control: ctrl, controlMaxDev: ctrlMaxDev,
  rows,
  summary: summary.map(s => ({
    F: s.F, k: s.k, reachedReps: s.reachedReps, reps: s.reps,
    framesMin: s.framesMin, framesMax: s.framesMax,
    wallProxyS: s.wallProxy, gameS: s.gameS, simMs: s.simMs, maxInfPerFrame: s.maxInfPerFrame,
  })),
  verdict: results,
  errors: errs,
};
const outFile = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/exp-decision-granularity.json";
fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
console.log(`\n宸插啓鍏ワ細${outFile}`);

const pass = results.filter(r => r.ok).length;
console.log(`\n==== 缁撴灉锛?{pass} 閫氳繃 / ${results.length - pass} 澶辫触 ====`);

await closeBrowser();
server.close();
process.exit(pass === results.length ? 0 : 1);
