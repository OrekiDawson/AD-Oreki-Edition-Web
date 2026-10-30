// 瀹為獙 v2锛氬€欓€夎喘涔板櫒锛圱ick Speed / 澶у潔濉岋級鍦ㄥ彈鎺ч殧绂荤姸鎬佷笅鐨?off/on 瀵规瘮
//
// 涓婁竴鐗堜袱涓己闄峰凡淇細
// 1. effectiveInterval 鏈変袱閬撻棬锛堝疄渚?usesSpeedScaledInterval + 鍏ㄥ眬 GameSpeed.scaleAutobuyerInterval锛夛紝
//    鍙紑鍓嶈€呬笉浼氱敓鏁堬紱鏈増涓や釜閮藉紑锛屽苟鎶婇潪鐩爣瀹炰緥锛堝惈 AD锛夋樉寮忓帇鍥?false锛屼繚璇佷竴娆″彧缂╂斁涓€涓€?// 2. 澶氱閲嶇疆璐拱鍣ㄥ悓鏃舵椿璺冧細璁╃姸鎬佸湪鍑犲抚鍐呭穿濉岋紙螖galaxy 涓鸿礋锛夛紝鏃犳硶姣旇緝锛?//    鏈増鍙繚鐣欑洰鏍囪喘涔板櫒锛屽叾浣?prestige 璐拱鍣ㄥ叧闂紝涓?arm 涔嬮棿鐘舵€佸畬鍏ㄤ竴鑷淬€?//
// 鍦烘櫙锛歮axed = 瀛樻。鐜扮姸锛堥棿闅斿凡婊＄骇锛夛紱default = 鐩爣璐拱鍣ㄩ棿闅旈噸缃负鍒濆鍊硷紙鍒氳В閿佺殑鐜╁锛?// 鐢ㄦ硶锛歯ode exp-autobuyer-candidates2.mjs [--reps=2] [--frames=300]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const ROOT = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";
const SAVE_FILE = "132._9.1e137IP.txt";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };
const argNum = (k, d) => { const h = process.argv.find(a => a.startsWith(`--${k}=`)); const v = h ? Number(h.split("=")[1]) : NaN; return Number.isFinite(v) && v > 0 ? v : d; };
const REPS = argNum("reps", 2);
const FRAMES = argNum("frames", 300);
const FRAME_MS = 20;

const ROOT_ABS = path.resolve(ROOT);
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(ROOT_ABS, "." + p);
  const rel = path.relative(ROOT_ABS, f);
  if (rel.startsWith("..") || path.isAbsolute(rel)) { res.writeHead(403).end(); return; }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(8482, "127.0.0.1", r));

const browser = await launchViaConnect({ protocolTimeout: 300000 });
const page = await browser.newPage();
const errs = [];
const NOISE = /googletagmanager|google-analytics|kaspersky-labs|Vue warn|progress\.info/;
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => { if (m.type() === "error" && !NOISE.test(m.text())) errs.push(`CONSOLE: ${m.text().slice(0, 160)}`); });
await page.goto("http://127.0.0.1:8482/index.html", { waitUntil: "load", timeout: 60000 });
let ready = false;
for (let i = 0; i < 80; i++) {
  ready = await page.evaluate(() => { try { return typeof gameLoop === "function" && typeof Autobuyers === "object" && typeof player === "object"; } catch (e) { return false; } }).catch(() => false);
  if (ready) break;
  await new Promise(r => setTimeout(r, 400));
}
if (!ready) { console.log("FAIL 娓告垙鏈惎鍔?); await browser.close(); server.close(); process.exit(1); }
console.log("PASS 灏辩华");

const LIST = ["tickspeed", "dimboost", "galaxy", "bigCrunch"];

await page.evaluate((LIST) => {
  const lg = v => { if (v && typeof v.log10 === "function") { const d = v.log10(); const n = d && d.toNumber ? d.toNumber() : Number(d); return Number.isFinite(n) ? n : NaN; } const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.log10(n) : NaN; };
  const num = v => { const n = v && v.toNumber ? v.toNumber() : Number(v); return Number.isFinite(n) ? n : NaN; };
  const inst = key => Autobuyer[key];
  const counts = {};
  let hooked = false;

  window.__c = {
    lg, num, LIST,
    hook() {
      if (hooked) return;
      for (const key of LIST) {
        const b = inst(key);
        const orig = b.tick.bind(b);
        counts[key] = 0;
        b.tick = (...args) => { counts[key]++; return orig(...args); };
      }
      hooked = true;
    },
    resetCnt() { for (const key of LIST) counts[key] = 0; },
    cnt() { return { ...counts }; },
    // 鐩爣瀹炰緥缂╂斁 = true锛屽叾浣欙紙鍚?AD 鐨?8 涓級鏄惧紡鍘嬫垚 false
    applyScaling(target, scaled) {
      for (const key of LIST) {
        const b = inst(key);
        const want = scaled && key === target;
        Object.defineProperty(b, "usesSpeedScaledInterval", { configurable: true, get: () => want });
      }
      for (const b of Autobuyer.antimatterDimension.zeroIndexed) {
        Object.defineProperty(b, "usesSpeedScaledInterval", { configurable: true, get: () => false });
      }
      return {
        targetEff: inst(target).effectiveInterval,
        targetRaw: inst(target).interval,
        adEff: Autobuyer.antimatterDimension.zeroIndexed[0].effectiveInterval,
        adRaw: Autobuyer.antimatterDimension.zeroIndexed[0].interval,
      };
    },
    setup(text, F, target, scaled, scenario) {
      try { GameIntervals.stop(); } catch (e) { }
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { }
      GameSpeed.set(F);
      // 绗簩閬撻棬涔熷紑锛氬彧鏈夊０鏄庝簡 usesSpeedScaledInterval 鐨勫疄渚嬫墠鐪熸琚缉鏀?      GameSpeed.setScaleAutobuyerInterval(scaled);

      const before = {};
      for (const key of LIST) {
        const b = inst(key);
        before[key] = { bought: !!b.isBought, active: !!b.isActive, interval: b.interval };
        if (!b.isBought) b.data.isBought = true;
        // 鍙暀鐩爣锛屽睆钄藉叾瀹?prestige 璐拱鍣紙arm 涔嬮棿涓€鑷达級
        b.isActive = key === target;
      }
      if (scenario === "default") {
        const b = inst(target);
        b.data.interval = b.baseInterval;
        b.data.cost = 1;
      }
      // 澶у潔濉屾ā寮忚涓?AMOUNT 涓旈槇鍊?1锛岃 canTick 鍙彈闂撮殧涓?canCrunch 闄愬埗
      if (target === "bigCrunch") {
        player.auto.bigCrunch.mode = AUTO_CRUNCH_MODE.AMOUNT;
        player.auto.bigCrunch.amount = new Decimal(1);
      }
      // Tick Speed 鍦烘櫙锛氬厑璁歌秴杩?1.8e308 缁х画澧為暱锛屽惁鍒欎骇閲忓湪鍑犲崄甯у唴瑙﹂《鏃犳硶姣旇緝
      if (target === "tickspeed") player.break = true;
      player.auto.autobuyersOn = true;

      const g = this.applyScaling(target, scaled);
      this.resetCnt();
      return {
        target, F, scaled, scenario, g,
        before,
        afterInterval: inst(target).interval,
        breakOn: !!player.break,
        autobuyersOn: player.auto.autobuyersOn,
        galaxies: player.galaxies, dimboosts: DimBoost.purchasedBoosts,
      };
    },
    snap() {
      return {
        amLog: lg(Currency.antimatter.value), ipLog: lg(Currency.infinityPoints.value),
        inf: num(Currency.infinities.value), eter: num(Currency.eternities.value),
        galaxies: player.galaxies, dimboosts: DimBoost.purchasedBoosts,
        tickUpg: (() => { try { return Tickspeed.totalUpgrades; } catch (e) { return null; } })(),
        ipPerInf: (() => { try { return num(gainedInfinityPoints()); } catch (e) { return null; } })(),
        game: player.records.totalTimePlayed, real: player.records.realTimePlayed,
      };
    },
    run(n, ms) { for (let i = 0; i < n; i++) gameLoop(ms); return this.snap(); },
  };
  window.__c.hook();
}, LIST);

const e = (v, d = 3) => (Number.isFinite(v) ? v.toExponential(d) : "鈥?);
const rows = [];
const saveText = fs.readFileSync(path.join(SAVE_DIR, SAVE_FILE), "utf-8");

const matrix = [];
for (const target of ["tickspeed", "bigCrunch"]) {
  for (const scenario of ["maxed", "default"]) {
    for (const F of [1, 10000]) {
      for (const scaled of [false, true]) matrix.push({ target, scenario, F, scaled });
    }
  }
}

for (const cfg of matrix) {
  for (let rep = 1; rep <= REPS; rep++) {
    const info = await page.evaluate(({ text, cfg }) =>
      window.__c.setup(text, cfg.F, cfg.target, cfg.scaled, cfg.scenario), { text: saveText, cfg });
    const s0 = await page.evaluate(() => window.__c.snap());
    const t0 = Date.now();
    const s1 = await page.evaluate(({ n, ms }) => window.__c.run(n, ms), { n: FRAMES, ms: FRAME_MS });
    const cpuMs = Date.now() - t0;
    const cnt = await page.evaluate(() => window.__c.cnt());
    const row = {
      ...cfg, rep, cpuMs, info,
      ticks: cnt[cfg.target],
      dAm: s1.amLog - s0.amLog, dIp: s1.ipLog - s0.ipLog,
      dInf: s1.inf - s0.inf, dGal: s1.galaxies - s0.galaxies, dBoost: s1.dimboosts - s0.dimboosts,
      dTickUpg: (s1.tickUpg ?? 0) - (s0.tickUpg ?? 0),
      absInf0: s0.inf, absIp0: s0.ipLog,
      eff: info.g.targetEff, raw: info.g.targetRaw, adEff: info.g.adEff, adRaw: info.g.adRaw,
      intervalNow: info.afterInterval,
    };
    rows.push(row);
    console.log(`  ${cfg.target.padEnd(10)} ${cfg.scenario.padEnd(7)} F=${String(cfg.F).padStart(5)} ${cfg.scaled ? "on " : "off"} rep${rep}锛歚 +
      `tick=${String(row.ticks).padStart(3)} eff=${(row.eff < 0.01 ? row.eff.toExponential(1) : row.eff.toFixed(0))}ms(raw ${row.raw}) ` +
      `螖logAM=${row.dAm.toFixed(3)} 螖logIP=${row.dIp.toFixed(3)} 螖鈭?${e(row.dInf)} 螖tickUpg=${row.dTickUpg} ` +
      `inf0=${e(row.absInf0)} CPU/甯?${(cpuMs / FRAMES).toFixed(3)}ms`);
  }
}

const agg = (target, scenario, F, scaled) => {
  const sub = rows.filter(r => r.target === target && r.scenario === scenario && r.F === F && r.scaled === scaled);
  if (!sub.length) return null;
  const avg = k => sub.reduce((a, b) => a + b[k], 0) / sub.length;
  return {
    ticks: avg("ticks"), dAm: avg("dAm"), dIp: avg("dIp"), dInf: avg("dInf"),
    dTickUpg: avg("dTickUpg"), cpu: avg("cpuMs") / FRAMES,
    eff: sub[0].eff, raw: sub[0].raw, adEff: sub[0].adEff,
  };
};

console.log("\n========== 姹囨€伙紙鍚?REAL 绐楀彛 = 甯ф暟 脳 20ms锛?==========");
for (const target of ["tickspeed", "bigCrunch"]) {
  for (const scenario of ["maxed", "default"]) {
    for (const F of [1, 10000]) {
      for (const s of [false, true]) {
        const a = agg(target, scenario, F, s);
        console.log(` ${target.padEnd(10)} ${scenario.padEnd(7)} F=${String(F).padStart(5)} ${s ? "on " : "off"} ` +
          `tick=${a.ticks.toFixed(1).padStart(6)} 螖logAM=${a.dAm.toFixed(3).padStart(9)} 螖logIP=${a.dIp.toFixed(3).padStart(9)} ` +
          `螖鈭?${e(a.dInf).padStart(9)} 螖tickUpg=${a.dTickUpg.toFixed(1).padStart(7)} CPU=${a.cpu.toFixed(3)}ms eff=${(a.eff < 0.01 ? a.eff.toExponential(1) : a.eff.toFixed(0)).padStart(8)}ms`);
      }
    }
  }
}

// 鏈哄埗鏂█锛氱缉鏀惧繀椤荤湡鐨勬敼鍙?effectiveInterval锛屼笖 AD 涓嶈鐗佃繛
const badScaling = rows.filter(r => {
  const expect = r.scaled ? r.raw / Math.max(1, r.F) : r.raw;
  return Math.abs(r.eff - expect) > 1e-6 || r.adEff !== r.adRaw;
});
console.log(`\n[鏈哄埗] 缂╂斁娉ㄥ叆鏈夋晥涓?AD 鏈鐗佃繛锛?{badScaling.length === 0 ? "PASS" : "FAIL锛? + badScaling.length + " 琛屼笉绗︼級"}`);

fs.writeFileSync("C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/exp-autobuyer-candidates2.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), save: SAVE_FILE, frames: FRAMES, frameMs: FRAME_MS, reps: REPS, rows, errors: errs }, null, 2));
console.log("宸插啓鍏?_research/exp-autobuyer-candidates2.json");
if (errs.length) console.log("寮傚父锛?, errs.slice(0, 3));
await browser.close();
server.close();
