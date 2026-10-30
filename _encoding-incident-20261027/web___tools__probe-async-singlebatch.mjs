// P0 鍏抽敭闂锛氭寮忕绾胯矾寰勶紙diff 鈮?50s 鈫?fast=false锛宼icks 鈮?1000锛変細涓嶄細钀借繘
//            `_run` 鐨勩€屽崟鎵规棭閫€銆嶅垎鏀紙entry=0/exit=0 鈫?涓嶆竻杩涘害鏉°€佷笉瑙ｅ喕銆佷笉閲嶅惎 intervals锛夛紵
// P2 琛ュ厖锛氭崲鎴愪腑鏈熷瓨妗?+ 鎵嬪姩鍚敤鑷姩璐拱鍣紝閲忛珮 F 涓嬬殑璐拱鑺傚銆?
// 涓嶆敼 src銆?
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const ROOT = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };
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
await new Promise(r => server.listen(8460, "127.0.0.1", r));

const browser = await launchViaConnect({ protocolTimeout: 300000 });
const page = await browser.newPage();
const errs = [];
const NOISE = /googletagmanager|google-analytics|kaspersky-labs|progress\.info is not a function|ModalProgressBar|Vue warn/;
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => { if (m.type() === "error" && !NOISE.test(m.text())) errs.push(`CONSOLE: ${m.text().slice(0, 160)}`); });
await page.goto("http://127.0.0.1:8460/index.html", { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 80; i++) {
  const ok = await page.evaluate(() => { try { return typeof gameLoop === "function" && typeof Async === "object" && typeof player === "object"; } catch (e) { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}
console.log("PASS 灏辩华");

await page.evaluate(() => {
  const lg = v => { if (v && typeof v.log10 === "function") { const d = v.log10(); const n = d && d.toNumber ? d.toNumber() : Number(d); return Number.isFinite(n) ? n : NaN; } const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.log10(n) : NaN; };
  const num = v => { const n = v && v.toNumber ? v.toNumber() : Number(v); return Number.isFinite(n) ? n : NaN; };
  const st = { entry: 0, exit: 0, then: 0, maxTicks: null, exitIntervalState: null };
  const ab = { calls: 0 };
  window.__q = {
    lg, num, st,
    reset() { st.entry = 0; st.exit = 0; st.then = 0; st.maxTicks = null; st.exitIntervalState = null; return true; },
    hook() {
      if (window.Async.__hooked2) return true;
      const orig = Async.run.bind(Async);
      Async.run = (fun, maxIter, config = {}) => {
        const c = { ...config };
        c.asyncEntry = (...a) => { st.entry++; try { const b = ui.$viewModel.modal.progressBar; if (b && b.max != null) st.maxTicks = b.max; } catch (e) { } return config.asyncEntry && config.asyncEntry(...a); };
        c.asyncExit = (...a) => { st.exit++; st.exitIntervalState = (() => { try { return GameIntervals.gameLoop.isStarted; } catch (e) { return null; } })(); return config.asyncExit && config.asyncExit(...a); };
        c.then = config.then ? (...a) => { st.then++; return config.then(...a); } : undefined;
        return orig(fun, maxIter, c);
      };
      window.Async.__hooked2 = true;
      return true;
    },
    state() {
      return { ...st,
        locked: (() => { try { return GameSpeed.isSimulationLocked; } catch (e) { return null; } })(),
        intervals: (() => { try { return GameIntervals.gameLoop.isStarted; } catch (e) { return null; } })(),
        bar: (() => { try { return ui.$viewModel.modal.progressBar !== undefined; } catch (e) { return null; } })(),
        asyncEnabled: (() => { try { return Async.enabled; } catch (e) { return null; } })(),
      };
    },
    load(text, F) {
      try { GameIntervals.stop(); } catch (e) { }
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { }
      GameSpeed.set(F);
      return true;
    },
    sim(sec, real, fast) { simulateTime(sec, real, fast); return true; },
    cleanup() { try { GameSpeed.endSimulation(); } catch (e) { } try { ui.$viewModel.modal.progressBar = undefined; } catch (e) { } try { Async.enabled = true; } catch (e) { } return true; },
    snap() {
      return { game: player.records.totalTimePlayed, real: player.records.realTimePlayed,
        amLog: lg(Currency.antimatter.value), ipLog: lg(Currency.infinityPoints.value),
        inf: num(Currency.infinities.value), speedup: (() => { try { return getGameSpeedupFactor(); } catch (e) { return null; } })() };
    },
    // 鑷姩璐拱鍣細鍚敤鍓?N 涓淮搴﹁喘涔板櫒锛堣嫢瀛樻。閲屾病涔拌繃鍒欒烦杩囷級锛屽彧璇荤粺璁¤皟鐢?
    enableAB() {
      const out = [];
      for (const b of Autobuyers.all) {
        if (!b) continue;
        try {
          if (b.isBought) { b.isEnabled = true; out.push((b.constructor && b.constructor.name) || "anon"); }
        } catch (e) { /* ignore */ }
      }
      return out;
    },
    abCount() {
      let n = 0, enabled = 0;
      for (const b of Autobuyers.all) { if (!b) continue; n++; try { if (b.isEnabled) enabled++; } catch (e) { } }
      return { total: n, enabled };
    },
    hookAB() {
      if (window.__abHooked) return true;
      for (const b of Autobuyers.all) {
        if (!b || typeof b.tick !== "function") continue;
        const orig = b.tick.bind(b);
        b.tick = (...a) => { ab.calls++; return orig(...a); };
      }
      window.__abHooked = true;
      return true;
    },
    resetAB() { ab.calls = 0; return true; },
    abCalls() { return ab.calls; },
    runFrames(n, ms) { for (let i = 0; i < n; i++) gameLoop(ms); return this.snap(); },
  };
  window.__q.hook();
});

const e = (v, d = 3) => (Number.isFinite(v) ? v.toExponential(d) : "鈥?);
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  鈥?${detail}` : ""}`); };
const note = t => console.log(`NOTE  ${t}`);
const save = f => fs.readFileSync(path.join(SAVE_DIR, f), "utf-8");
const MID = "132._9.1e137IP.txt";

// ================= A. 鐢熶骇闃堝€奸檮杩戯細diff 50s 璧?fast=false =================
console.log("\n========== A. 姝ｅ紡绂荤嚎闃堝€奸檮杩戯紙fast=false锛宼icks=20脳绉掞級 ==========");
console.log("   绉掓暟   ticks   entry  exit   then   閿?    intervals  杩涘害鏉?);
const A = [];
for (const S of [50, 55, 60, 90, 120, 300]) {
  await page.evaluate(({ text }) => { window.__q.load(text, 10000); window.__q.reset(); }, { text: save(MID) });
  await page.evaluate((S) => window.__q.sim(S, false, false), S);
  for (let i = 0; i < 600; i++) {
    const st = await page.evaluate(() => window.__q.state());
    if (!st.locked && st.then > 0) break;
    await new Promise(r => setTimeout(r, 80));
  }
  const st = await page.evaluate(() => window.__q.state());
  A.push({ S, ticks: S * 20, ...st });
  console.log(`  ${String(S).padStart(6)} ${String(S * 20).padStart(7)} ${String(st.entry).padStart(6)} ${String(st.exit).padStart(5)} ${String(st.then).padStart(6)} ${String(st.locked).padStart(6)} ${String(st.intervals).padStart(11)} ${String(st.bar)}`);
  await page.evaluate(() => window.__q.cleanup());
}
const singleBatch = A.filter(r => r.entry === 0 && r.exit === 0);
check("[A1] 鏈満鍦ㄦ寮忛槇鍊硷紙鈮?0s 鈫?fast=false锛宼icks鈮?000锛変笅**娌℃湁**鍛戒腑銆屽崟鎵规棭閫€銆嶏紙entry=1/exit=1锛?,
  singleBatch.length === 0,
  singleBatch.length ? `鍛戒腑绉掓暟锛?{singleBatch.map(r => r.S).join("/")}` : `S=50~300 鍏ㄩ儴璧板垎鎵硅矾寰勶紙ticks 1000~6000锛塦);
note("[A1-缁撹] 璇ョ己闄锋槸**缁撴瀯鎬?*鐨勶紙鏃╅€€鍒嗘敮涓€鏃﹁蛋鍒板氨涓嶆竻鐞嗭級锛屼絾鏈満 1000 ticks 闇€瑕?>60ms锛宍runForTime` 蹇呯劧鍒嗘壒锛? +
  "鎵€浠?*姝ｅ紡绂荤嚎闃堝€艰繖鏉¤矾寰勫綋鍓嶈Е鍙戜笉鍒?*銆備笉鑳芥妸瀹冨啓鎴愩€岀敓浜у凡澶嶇幇銆嶃€?);

// A3锛氶潪鐢熶骇璺緞锛圫=1 鈫?20 ticks锛宖ast=false锛夐獙璇?鏃╅€€鍒嗘敮纭疄涓嶆竻鐞?
await page.evaluate(({ text }) => { window.__q.load(text, 10000); window.__q.reset(); }, { text: save(MID) });
await page.evaluate(() => window.__q.sim(1, false, false));
await new Promise(r => setTimeout(r, 600));
const small = await page.evaluate(() => window.__q.state());
await page.evaluate(() => window.__q.cleanup());
console.log(`  S=1锛?0 ticks锛岄潪鐢熶骇璺緞锛夛細entry=${small.entry} exit=${small.exit} then=${small.then} 閿?${small.locked} intervals=${small.intervals} 杩涘害鏉?${small.bar}`);
check("[A2] 鏃╅€€鍒嗘敮鏈韩纭疄涓嶆竻鐞嗭細entry=0/exit=0锛岄攣鏈噴鏀俱€乮ntervals 鏈噸鍚€佽繘搴︽潯娈嬬暀",
  small.entry === 0 && small.exit === 0 && small.locked === true && small.intervals === false,
  `entry=${small.entry} exit=${small.exit} locked=${small.locked} intervals=${small.intervals} bar=${small.bar}`);
note("[A2-璇存槑] 杩欐潯鐢?S=1锛堥潪鐢熶骇鍙傛暟锛夎瘉鏄庡垎鏀涓猴紱鐢熶骇闃堝€间笉缁忚繃杩欓噷锛堣 A1锛夈€? +
  "瑕佺湡姝ｈЕ鍙戯紝闇€瑕併€宖ast=false 涓?ticks 灏戝埌鑳藉湪涓€娈?60ms 鍐呰窇瀹屻€嶆垨銆孉sync.enabled 宸茶缃?false銆嶏紝涓よ€呭湪鏈満姝ｅ紡娴佺▼閲岄兘涓嶆垚绔嬨€?);

// ================= B. 鑷姩璐拱鍣ㄨ妭濂忥紙涓湡瀛樻。 + 鎵嬪姩鍚敤锛?=================
console.log("\n========== B. 鑷姩璐拱鍣ㄨ妭濂忥紙涓湡瀛樻。 132锛?==========");
await page.evaluate(({ text }) => { window.__q.load(text, 1); window.__q.hookAB(); }, { text: save(MID) });
const abBefore = await page.evaluate(() => window.__q.abCount());
const abEnabled = await page.evaluate(() => window.__q.enableAB());
console.log(`  鑷姩璐拱鍣ㄦ€绘暟 ${abBefore.total}锛屽師鏈惎鐢?${abBefore.enabled} 涓紱鏈鎵嬪姩鍚敤锛堝凡璐拱鑰咃級${abEnabled.length} 涓猔);
const B = [];
for (const F of [1, 10000]) {
  await page.evaluate(({ text, F }) => { window.__q.load(text, F); window.__q.enableAB(); window.__q.resetAB(); }, { text: save(MID), F });
  const s0 = await page.evaluate(() => window.__q.snap());
  const s1 = await page.evaluate(() => window.__q.runFrames(200, 20));
  const calls = await page.evaluate(() => window.__q.abCalls());
  const r = { F, calls, dGame: s1.game - s0.game, dReal: s1.real - s0.real, dIp: s1.ipLog - s0.ipLog, dInf: s1.inf - s0.inf };
  B.push(r);
  console.log(`  F=${String(F).padStart(5)}锛?00 甯э紝螖娓告垙=${e(r.dGame)}ms锛屛旂幇瀹?${r.dReal.toFixed(0)}ms锛岃喘涔板櫒 tick=${r.calls}锛屛攍og10(IP)=${r.dIp.toFixed(4)}锛屛旀棤闄?${e(r.dInf)}`);
}
const b1 = B[0], b2 = B[1];
const density1 = b1.calls / (b1.dGame / 1e3), density2 = b2.calls / (b2.dGame / 1e3);
console.log(`  鍐崇瓥瀵嗗害锛堣喘涔板櫒 tick / 娓告垙绉掞級锛欶=1 ${density1.toExponential(3)}锛孎=10000 ${density2.toExponential(3)}锛堟瘮 ${(density1 / density2).toFixed(0)}脳锛塦);
check("[B1] 璐拱鍣ㄨЕ鍙戞鏁扮敱甯ф暟鍐冲畾锛堟瘡甯?1~4 娆★級锛屼笉闅忔父鎴忔椂闂存斁澶э紙F=10000 鐨勬父鎴忔椂闂存槸 10000脳锛岃Е鍙戞鏁板彧鏈変釜浣嶆暟鍊嶏級",
  (b2.calls / Math.max(b1.calls, 1)) < 10 && (b2.dGame / b1.dGame) > 100,
  `F=1 ${b1.calls} 娆?/ F=10000 ${b2.calls} 娆★紝鑰屾父鎴忔椂闂存瘮 ${(b2.dGame / b1.dGame).toFixed(0)}脳`);
check("[B2] 鍗曚綅娓告垙鏃堕棿鐨勫喅绛栧瘑搴﹂殢 F 绾挎€т笅闄嶏紙F=1 鑷冲皯鏄?F=10000 鐨?100 鍊嶏級",
  density1 / Math.max(density2, 1e-12) > 100,
  `${(density1 / density2).toFixed(0)}脳`);

// ================= C. 鍊欓€変紭鍖栧師鍨嬶細鎶婅喘涔板櫒 interval 鍘嬪埌"姣忓抚涓€娆?锛堜笉鏀?src锛屼粎鏀硅繍琛屾椂閰嶇疆锛?=================
console.log("");
console.log("========== C. 涓婇檺瀹為獙锛氳喘涔板櫒 interval 鍘嬪埌 1ms锛堢瓑浠蜂簬姣忓抚閮藉厑璁歌Е鍙戯級 ==========");
const C = [];
for (const mode of ["榛樿 interval", "interval=1ms"]) {
  await page.evaluate(({ text, F }) => { window.__q.load(text, F); window.__q.enableAB(); window.__q.resetAB(); }, { text: save(MID), F: 10000 });
  if (mode !== "榛樿 interval") {
    await page.evaluate(() => {
      for (const b of Autobuyers.all) {
        try { if (b.data && typeof b.data.interval === "number") b.data.interval = 1; } catch (e) { }
      }
      return true;
    });
  }
  const s0 = await page.evaluate(() => window.__q.snap());
  const s1 = await page.evaluate(() => window.__q.runFrames(200, 20));
  const calls = await page.evaluate(() => window.__q.abCalls());
  const r = { mode, calls, dIp: s1.ipLog - s0.ipLog, dInf: s1.inf - s0.inf, dGame: s1.game - s0.game };
  C.push(r);
  console.log(`  ${mode.padEnd(14)}锛?00 甯?@F=10000锛岃喘涔板櫒 tick=${String(r.calls).padStart(5)}锛屛攍og10(IP)=${r.dIp.toFixed(4)}锛屛旀棤闄?${e(r.dInf)}`);
}
const gain = C[1].dIp / Math.max(C[0].dIp, 1e-9);
console.log(`  螖log10(IP) 姣斿€硷細${gain.toFixed(2)}脳锛坕nterval=1ms / 榛樿锛塦);
check("[C1] 鎶婅喘涔板櫒 interval 鍘嬪埌 1ms 鑳芥樉钁楁彁楂樺悓涓€娓告垙鏃堕棿绐楀唴鐨勪骇鍑猴紙>2脳锛?,
  gain > 2, `${gain.toFixed(2)}脳`);
note(`[C1-鍚箟] 杩欐槸"璐拱鍣ㄨ妭濂?杩欎竴椤逛紭鍖栫殑**涓婄晫**锛氫笉鏀?src銆佸彧鎶?interval 浠?鐜板疄姣"鎹㈡垚鏇村皬鐨勫€硷紝` +
  `鍚屾牱 200 甯у氨澶氬嚭 ${gain.toFixed(2)}脳 鐨?IP锛坙og10锛夈€傛槸鍚﹀€煎緱鍋氾紝鍙栧喅浜庢寮忔敼鎴?娓告垙鏃堕棿璇箟"鍚庤兘鎷垮埌鍏朵腑澶氬皯銆俙);

check("[E] 鍏ㄦ祦绋嬫棤鏈崟鑾疯剼鏈紓甯?, errs.length === 0, errs.slice(0, 3).join(" | "));

fs.writeFileSync("C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/probe-async-singlebatch.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), A, B, C, abBefore, abEnabled, verdict: results, errors: errs }, null, 2));
console.log("\n宸插啓鍏?_research/probe-async-singlebatch.json");
const pass = results.filter(r => r.ok).length;
console.log(`\n==== 缁撴灉锛?{pass} 閫氳繃 / ${results.length - pass} 澶辫触 ====`);
await browser.close();
server.close();
process.exit(pass === results.length ? 0 : 1);
