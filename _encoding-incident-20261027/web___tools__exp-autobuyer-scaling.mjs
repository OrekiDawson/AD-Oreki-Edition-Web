// 瀹為獙锛氬弽鐗╄川缁村害鑷姩璐拱鍣ㄧ殑 interval 鎸夊叏灞€鍊嶇巼缂╂斁锛堝紑鍏抽粯璁ゅ叧闂級
// 瀵圭収锛氬悓涓€瀛樻。銆佸悓涓€绐楀彛銆丗=1 / F=10000锛屽紑鍏?off/on
//
// 鐢ㄦ硶锛歯ode exp-autobuyer-scaling.mjs [--reps=3] [--frames=200]
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
const REPS = argNum("reps", 3);
const FRAMES = argNum("frames", 200);
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
await new Promise(r => server.listen(8480, "127.0.0.1", r));

const browser = await launchViaConnect({ protocolTimeout: 300000 });
const page = await browser.newPage();
const errs = [];
const NOISE = /googletagmanager|google-analytics|kaspersky-labs|Vue warn|progress\.info/;
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => { if (m.type() === "error" && !NOISE.test(m.text())) errs.push(`CONSOLE: ${m.text().slice(0, 160)}`); });
await page.goto("http://127.0.0.1:8480/index.html", { waitUntil: "load", timeout: 60000 });
let ready = false;
for (let i = 0; i < 80; i++) {
  ready = await page.evaluate(() => { try { return typeof gameLoop === "function" && typeof Autobuyers === "object" && typeof player === "object"; } catch (e) { return false; } }).catch(() => false);
  if (ready) break;
  await new Promise(r => setTimeout(r, 400));
}
if (!ready) { console.log("FAIL 娓告垙鏈惎鍔?); await browser.close(); server.close(); process.exit(1); }
console.log("PASS 灏辩华");

await page.evaluate(() => {
  const lg = v => { if (v && typeof v.log10 === "function") { const d = v.log10(); const n = d && d.toNumber ? d.toNumber() : Number(d); return Number.isFinite(n) ? n : NaN; } const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.log10(n) : NaN; };
  const num = v => { const n = v && v.toNumber ? v.toNumber() : Number(v); return Number.isFinite(n) ? n : NaN; };
  const ad = () => Autobuyer.antimatterDimension.zeroIndexed;   // tier 1-8
  const c = { adTicks: [0, 0, 0, 0, 0, 0, 0, 0], adOrder: [], tickTicks: 0, galaxyTicks: 0 };
  let hooked = false;

  window.__a = {
    lg, num,
    hook() {
      if (hooked) return true;
      ad().forEach((b, i) => {
        const orig = b.tick.bind(b);
        b.__origTick = orig;
        b.tick = (...args) => { c.adTicks[i]++; if (c.adOrder.length < 40) c.adOrder.push(i + 1); return orig(...args); };
      });
      for (const [key, b] of [["tickTicks", Autobuyer.tickspeed], ["galaxyTicks", Autobuyer.galaxy]]) {
        if (!b || typeof b.tick !== "function") continue;
        const orig = b.tick.bind(b);
        b.tick = (...args) => { c[key]++; return orig(...args); };
      }
      hooked = true;
      return true;
    },
    resetCnt() { c.adTicks = [0, 0, 0, 0, 0, 0, 0, 0]; c.adOrder = []; c.tickTicks = 0; c.galaxyTicks = 0; return true; },
    cnt() { return { adTicks: [...c.adTicks], adOrder: [...c.adOrder], tickTicks: c.tickTicks, galaxyTicks: c.galaxyTicks }; },
    // 鍚屼竴瀛樻。 + 鍥哄畾鍒濆鐘舵€侊紱scaling 鎺у埗瀹為獙寮€鍏?
    setup(text, F, scaling) {
      try { GameIntervals.stop(); } catch (e) { }
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { }
      GameSpeed.set(F);
      const on = GameSpeed.setScaleAutobuyerInterval(scaling);
      // 璁╁弽鐗╄川缁村害璐拱鍣ㄥ叏閮ㄥ彲鐢紙瀛樻。閲屾湭蹇呬拱杩囷紱涓や晶鍚屾牱澶勭悊锛?
      let enabled = 0;
      const pre = [];
      ad().forEach(b => {
        try {
          pre.push({ bought: !!b.isBought, interval: b.interval });
          if (!b.isBought) b.data.isBought = true;
          b.isEnabled = true;
          enabled++;
        } catch (e) { /* ignore */ }
      });
      this.resetCnt();
      const eff = b => { try { return b.effectiveInterval; } catch (e) { return null; } };
      return {
        scaling: on, enabled, pre,
        effInterval: ad().map(eff), interval: ad().map(b => b.interval),
        // 闈炵洰鏍囪喘涔板櫒锛氬紑鍏充笉搴旀敼鍙樺畠浠殑鐢熸晥闂撮殧
        otherEff: { tickspeed: eff(Autobuyer.tickspeed), galaxy: eff(Autobuyer.galaxy) },
      };
    },
    snap() {
      return {
        amLog: lg(Currency.antimatter.value), ipLog: lg(Currency.infinityPoints.value),
        inf: num(Currency.infinities.value), eter: num(Currency.eternities.value),
        game: player.records.totalTimePlayed, real: player.records.realTimePlayed,
        speedup: (() => { try { return getGameSpeedupFactor(); } catch (e) { return null; } })(),
      };
    },
    run(n, ms) { for (let i = 0; i < n; i++) gameLoop(ms); return this.snap(); },
    defaultFlag() {
      // 妯℃嫙"棣栨璁块棶"锛氭竻鎺夐敭鍚庨噸鏂拌榛樿鍊?
      try { const key = GameSpeed.autobuyerScaleStorageKey; window.localStorage.removeItem(key); return GameSpeed.scaleAutobuyerInterval; } catch (e) { return null; }
    },
  };
  window.__a.hook();
});

const e = (v, d = 3) => (Number.isFinite(v) ? v.toExponential(d) : "鈥?);
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  鈥?${detail}` : ""}`); };
const note = t => console.log(`NOTE  ${t}`);
const saveText = fs.readFileSync(path.join(SAVE_DIR, SAVE_FILE), "utf-8");

// 榛樿鍊兼鏌ワ紙浠讳綍 setup 涔嬪墠锛?
const defFlag = await page.evaluate(() => window.__a.defaultFlag());
check("[C0] 瀹為獙寮€鍏抽粯璁ゅ叧闂紙娓呮帀 localStorage 閿悗璇诲埌鐨勪粛鏄?false锛?, defFlag === false, `璇诲埌 ${defFlag}`);

const rows = [];
for (const F of [1, 10000]) {
  for (const scaling of [false, true]) {
    for (let rep = 1; rep <= REPS; rep++) {
      const info = await page.evaluate(({ text, F, scaling }) => window.__a.setup(text, F, scaling), { text: saveText, F, scaling });
      const s0 = await page.evaluate(() => window.__a.snap());
      const t0 = Date.now();
      const s1 = await page.evaluate(({ n, ms }) => window.__a.run(n, ms), { n: FRAMES, ms: FRAME_MS });
      const cpuMs = Date.now() - t0;
      const cnt = await page.evaluate(() => window.__a.cnt());
      const row = {
        F, scaling, rep, cpuMs, info,
        dAm: s1.amLog - s0.amLog, dIp: s1.ipLog - s0.ipLog, dInf: s1.inf - s0.inf,
        dGame: s1.game - s0.game, dReal: s1.real - s0.real,
        adTotal: cnt.adTicks.reduce((a, b) => a + b, 0), adTicks: cnt.adTicks,
        adOrder: cnt.adOrder, tickTicks: cnt.tickTicks, galaxyTicks: cnt.galaxyTicks,
      };
      rows.push(row);
      console.log(`  F=${String(F).padStart(5)} 寮€鍏?${scaling ? "on " : "off"} rep${rep}锛欰D璐拱 ${String(row.adTotal).padStart(5)} 娆?` +
        `(tier ${row.adTicks.join("/")})锛屛攍og10(AM)=${row.dAm.toFixed(3)}锛屛攍og10(IP)=${row.dIp.toFixed(3)}锛屛旀棤闄?${e(row.dInf)}锛宍 +
        `CPU/甯?${(cpuMs / FRAMES).toFixed(3)}ms锛宔ffInterval=${info.effInterval.map(v => (v === null ? "鈥? : (v < 0.01 ? v.toExponential(1) : v.toFixed(1)))).join(",")}`);
    }
  }
}

const agg = (F, scaling) => {
  const sub = rows.filter(r => r.F === F && r.scaling === scaling);
  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  return {
    adTotal: avg(sub.map(r => r.adTotal)), dIp: avg(sub.map(r => r.dIp)), dAm: avg(sub.map(r => r.dAm)),
    dInf: avg(sub.map(r => r.dInf)), cpu: avg(sub.map(r => r.cpuMs / FRAMES)),
    adTicks: sub[0].adTicks, order: sub[0].adOrder, tickTicks: sub[0].tickTicks, galaxyTicks: sub[0].galaxyTicks,
    dGame: avg(sub.map(r => r.dGame)), eff: sub[0].info.effInterval, otherEff: sub[0].info.otherEff,
  };
};

console.log("\n========== 姹囨€伙紙姣忔閲嶅鐨勫钩鍧囷級 ==========");
console.log("     F   寮€鍏?  AD璐拱娆℃暟   螖log10(AM)   螖log10(IP)   螖鏃犻檺       CPU/甯?   姣忓抚璐拱   AM澧炵泭");
for (const F of [1, 10000]) {
  for (const s of [false, true]) {
    const a = agg(F, s);
    console.log(`  ${String(F).padStart(5)} ${s ? " on " : " off"} ${String(a.adTotal.toFixed(0)).padStart(10)} ${a.dAm.toFixed(4).padStart(11)} ${a.dIp.toFixed(4).padStart(12)} ${e(a.dInf).padStart(10)} ${a.cpu.toFixed(3).padStart(9)}ms ${(a.adTotal / FRAMES).toFixed(2).padStart(9)}`);
  }
}

const f1off = agg(1, false), f1on = agg(1, true);
const f10koff = agg(10000, false), f10kon = agg(10000, true);

console.log("");
check("[C1] F=1 鏃跺紑鍏充笉鏀瑰彉琛屼负锛堣喘涔版鏁颁笌浜у嚭瀹屽叏涓€鑷达級",
  Math.abs(f1on.adTotal - f1off.adTotal) < 1e-9 && Math.abs(f1on.dIp - f1off.dIp) < 1e-9,
  `off ${f1off.adTotal.toFixed(0)} 娆?/ on ${f1on.adTotal.toFixed(0)} 娆★紱螖log10(IP) ${f1off.dIp.toFixed(6)} vs ${f1on.dIp.toFixed(6)}`);
check("[C2] F=10000 鏃跺紑鍏虫樉钁楁彁楂樿喘涔版鏁帮紙鈮?.5脳锛屼笂闄愬彈甯ч绾︽潫锛?,
  f10kon.adTotal / Math.max(f10koff.adTotal, 1) >= 1.5,
  `off ${f10koff.adTotal.toFixed(0)} 娆★紙${(f10koff.adTotal / FRAMES).toFixed(2)}/甯э級鈫?on ${f10kon.adTotal.toFixed(0)} 娆★紙${(f10kon.adTotal / FRAMES).toFixed(2)}/甯э級锛?{(f10kon.adTotal / Math.max(f10koff.adTotal, 1)).toFixed(2)}脳`);
check("[C3] F=10000 鏃跺悓绐楀彛鍙嶇墿璐ㄥ闀挎樉钁楁洿楂橈紙螖log10(AM) 鈮?1.5脳锛?,
  f10kon.dAm / Math.max(f10koff.dAm, 1) >= 1.5,
  `off ${f10koff.dAm.toFixed(1)} 鈫?on ${f10kon.dAm.toFixed(1)}锛?{(f10kon.dAm / Math.max(f10koff.dAm, 1)).toFixed(2)}脳锛塦);
check("[C4] 璐拱椤哄簭鏈鐮村潖锛堜粛鎸?tier 1鈫? 寰幆锛屼笌鍏抽棴鏃跺悓妯″紡锛?,
  JSON.stringify(f10kon.order.slice(0, 8)) === JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8]),
  `寮€鍚悗鍓?8 娆★細${f10kon.order.slice(0, 8).join(",")}`);
check("[C5] 闈炵洰鏍囪喘涔板櫒鐨勭敓鏁堥棿闅斾笉鍙楀紑鍏冲奖鍝嶏紙鏈哄埗闅旂锛涜Е鍙戞鏁颁細闅忔父鎴忕姸鎬佽嚜鐒跺彉鍖栵級",
  f10kon.otherEff.tickspeed === f10koff.otherEff.tickspeed && f10kon.otherEff.galaxy === f10koff.otherEff.galaxy,
  `tick閫熷害 eff ${f10koff.otherEff.tickspeed} vs ${f10kon.otherEff.tickspeed}锛涙槦绯?eff ${f10koff.otherEff.galaxy} vs ${f10kon.otherEff.galaxy}`);
check("[C6] CPU 寮€閿€鏈夌晫锛堝紑鍏冲紑鍚悗姣忓抚鑰楁椂 鈮?鍏抽棴鏃剁殑 4 鍊嶏級",
  f10kon.cpu <= f10koff.cpu * 4,
  `off ${f10koff.cpu.toFixed(3)}ms/甯?鈫?on ${f10kon.cpu.toFixed(3)}ms/甯э紙${(f10kon.cpu / f10koff.cpu).toFixed(2)}脳锛塦);
check("[E] 鍏ㄦ祦绋嬫棤鏈崟鑾疯剼鏈紓甯?, errs.length === 0, errs.slice(0, 3).join(" | "));

note("[鍙ｅ緞] 甯ф暟 脳 20ms 鏄閽熶唬鐞嗭紙绋冲畾 50fps 鐨勭悊鎯冲€硷級锛屼笉鏄湡瀹炴祻瑙堝櫒璁℃椂锛汣PU 鏄湰娆℃棤澶寸幆澧冪殑瀹炴祴鑰楁椂锛岀湡瀹炴祻瑙堝櫒鍙細鏇存參銆?);
note(`[鏈哄埗] 鐢熸晥闂撮殧锛欶=1 鏃?off/on 閮芥槸 ${f1off.eff.slice(0, 3).map(v => v.toFixed(1)).join("/")}ms锛沗 +
  `F=10000 鏃?off=${f10koff.eff.slice(0, 3).map(v => v.toFixed(1)).join("/")}ms锛宱n=${f10kon.eff.slice(0, 3).map(v => v.toExponential(1)).join("/")}ms锛? interval 梅 F锛夈€俙);

fs.writeFileSync("C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/exp-autobuyer-scaling.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), save: SAVE_FILE, frames: FRAMES, frameMs: FRAME_MS, reps: REPS, rows, verdict: results, errors: errs }, null, 2));
console.log("\n宸插啓鍏?_research/exp-autobuyer-scaling.json");
const pass = results.filter(r => r.ok).length;
console.log(`\n==== 缁撴灉锛?{pass} 閫氳繃 / ${results.length - pass} 澶辫触 ====`);
await browser.close();
server.close();
process.exit(pass === results.length ? 0 : 1);
