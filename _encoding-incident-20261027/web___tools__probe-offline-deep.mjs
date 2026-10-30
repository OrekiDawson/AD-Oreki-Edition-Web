// 绂荤嚎缁撶畻娣辨寲锛氭寮忓紓姝ヨ矾寰勶紙fast=false锛夈€侀粦娲炴縺娲诲垎鏀€佷互鍙?S4 婧㈠嚭璇绘暟鐨勫綊鍥?
//
// 鍙娴嬮噺锛屼笉鏀规満鍒躲€傛墍鏈?瀹屾垚"鍒ゅ畾閮界敤**鍙娴嬬殑瀹屾垚鏉′欢**锛堟ā鎷熼攣閲婃斁锛夛紝
// 涓嶇敤"璇讳竴娆＄湅鏁板彉浜嗘病"鏉ョ寽銆?
//
// 鐢ㄦ硶: node probe-offline-deep.mjs [root] [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition");
const port = Number(process.argv[3] || 8300);
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml", ".webm": "video/webm", ".mp3": "audio/mpeg",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject", ".ico": "image/x-icon",
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end("nf"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({
  executablePath: EDGE, headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio"],
});
const results = [];
const check = (n, p, d = "") => { results.push({ n, p, d }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? "  鈥?" + d : ""}`); };
const note = (n, d = "") => console.log(`NOTE  ${n}${d ? "  鈥?" + d : ""}`);
const rel = (a, b) => Math.abs(a - b) / Math.max(1, Math.abs(b));

const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });

// 灏辩华鎺㈡祴锛堣８鏍囪瘑绗︼紱Currency 鏄?function锛?
let ready = false;
for (let i = 0; i < 60; i++) {
  ready = await page.evaluate(() => {
    try { return typeof gameLoop === "function" && typeof Currency === "function" && typeof player === "object"; }
    catch (e) { return false; }
  }).catch(() => false);
  if (ready) break;
  await new Promise(r => setTimeout(r, 500));
}
check("[R] 娓告垙鍚姩灏辩华", ready);
if (!ready) { await browser.close(); server.close(); process.exit(1); }

// 娉ㄥ叆璇诲彇鍣?
await page.evaluate(() => {
  window.__d = {
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
        ip: this.lg(Currency.infinityPoints.value),
        ep: this.lg(Currency.eternityPoints.value),
        inf: this.num(Currency.infinities.value),
        eter: this.num(Currency.eternities.value),
        real2: safe(() => this.num(Currency.realities.value)),
        speedup: safe(() => getGameSpeedupFactor()),
        simLocked: safe(() => GameSpeed.isSimulationLocked),
        modalBar: safe(() => ui && ui.$viewModel && ui.$viewModel.modal && ui.$viewModel.modal.progressBar !== undefined),
      };
    },
    load(text, F, bhActive) {
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      GameStorage.offlineEnabled = true;
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      if (bhActive) {
        player.blackHolePause = false;
        player.blackHole = player.blackHole || [];
        player.blackHole[0] = player.blackHole[0] || {};
        player.blackHole[0].unlocked = true;
        player.blackHole[0].active = true;
        player.blackHole[0].phase = 0;
      }
      GameSpeed.set(F);
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      const bh = {
        unlocked: (() => { try { return BlackHoles.areUnlocked; } catch (e) { return undefined; } })(),
        paused: (() => { try { return BlackHoles.arePaused; } catch (e) { return undefined; } })(),
        active1: (() => { try { return !!BlackHole(1).isActive; } catch (e) { return undefined; } })(),
        speedup: (() => { try { return getGameSpeedupFactor(); } catch (e) { return undefined; } })(),
      };
      return { bh, state: this.snap() };
    },
    startSim(S, fast) { simulateTime(S, false, fast); return true; },
  };
});

const SAVE = "132._9.1e137IP.txt";
const saveText = fs.readFileSync(path.join(SAVE_DIR, SAVE), "utf-8");
console.log(`\n瀛樻。鏍锋湰锛?{SAVE}`);
console.log("鍙ｅ緞锛毼旀父鎴忔椂闂?螖鐜板疄 涓?F 姣旇緝锛浳旂幇瀹?搴旂瓑浜庣绾跨鏁癨n");

// 绛夊緟妯℃嫙鐪熸瀹屾垚锛氭ā鎷熼攣閲婃斁 + 杩涘害鏉℃秷澶?
async function waitSimDone(timeoutMs = 180000) {
  const t0 = Date.now();
  let sawLocked = false;
  while (Date.now() - t0 < timeoutMs) {
    const st = await page.evaluate(() => {
      try {
        return {
          locked: GameSpeed.isSimulationLocked,
          bar: !!(ui && ui.$viewModel && ui.$viewModel.modal && ui.$viewModel.modal.progressBar !== undefined),
        };
      } catch (e) { return { locked: false, bar: false }; }
    }).catch(() => ({ locked: false, bar: false }));
    if (st.locked) sawLocked = true;
    if (sawLocked && !st.locked) return { done: true, ms: Date.now() - t0 };
    if (!sawLocked && Date.now() - t0 > 3000) {
      // 绗竴娆¤疆璇㈠氨娌￠攣 鈫?鍙兘宸茬灛闂村畬鎴愶紙tick 鏋佸皯锛?
      if (!st.bar) return { done: true, ms: Date.now() - t0, instant: true };
    }
    await new Promise(r => setTimeout(r, 100));
  }
  return { done: false, ms: Date.now() - t0 };
}

// ================= A. 姝ｅ紡寮傛璺緞 fast=false =================
console.log("=== A. 姝ｅ紡璺緞 simulateTime(S, false, false)锛圓sync.run 鍒嗙墖锛?===");
console.log("     F   绂荤嚎(s)  tick鏁? 瀹屾垚鑰楁椂(ms)   螖娓告垙鏃堕棿(ms)     螖鐜板疄(ms)   螖娓告垙/螖鐜板疄  /F      螖鏃犻檺     螖姘告亽");
const asyncRows = [];
for (const F of [1, 137, 10000]) {
  for (const S of [60, 300]) {
    const pre = await page.evaluate((text, F) => window.__d.load(text, F, false), saveText, F);
    await page.evaluate((S) => window.__d.startSim(S, false), S);
    const w = await waitSimDone();
    const post = await page.evaluate(() => window.__d.snap());
    const d = {
      F, S, ticks: Math.floor(S * 20), done: w.done, ms: w.ms,
      dGame: post.game - pre.state.game,
      dReal: post.real - pre.state.real,
      dInf: post.inf - pre.state.inf,
      dEter: post.eter - pre.state.eter,
    };
    asyncRows.push(d);
    const ratio = d.dGame / (d.dReal || 1);
    console.log(`  ${String(F).padStart(6)} ${String(S).padStart(7)} ${String(d.ticks).padStart(6)} ${String(d.ms).padStart(11)} ${d.dGame.toExponential(3).padStart(14)} ${d.dReal.toFixed(0).padStart(11)} ${ratio.toExponential(3).padStart(12)} ${(ratio / F).toExponential(2).padStart(7)} ${d.dInf.toExponential(2).padStart(9)} ${d.dEter.toExponential(2).padStart(9)}`);
  }
}
check("[A1] 姝ｅ紡璺緞鍏ㄩ儴鍦ㄨ秴鏃跺唴瀹屾垚锛堢敤妯℃嫙閿侀噴鏀惧垽瀹氾紝闈炵寽娴嬶級",
  asyncRows.every(r => r.done), asyncRows.map(r => `${r.F}/${r.S}s:${r.done}`).join(" "));
check("[A2] 螖鐜板疄鏃堕棿 = 绂荤嚎绉掓暟锛堢幇瀹炴椂闂翠笉琚€嶇巼鏀惧ぇ锛?,
  asyncRows.every(r => rel(r.dReal, r.S * 1000) < 0.02),
  asyncRows.map(r => `${r.F}/${r.S}s:${r.dReal.toFixed(0)}`).join(" "));
check("[A3] 螖娓告垙鏃堕棿/螖鐜板疄 = F锛堟寮忚矾寰勫悓鏍峰悆 F锛?,
  asyncRows.every(r => rel(r.dGame / (r.dReal || 1), r.F) < 0.02),
  asyncRows.map(r => `${r.F}:${(r.dGame / (r.dReal || 1)).toFixed(0)}`).join(" "));

// ================= A2. 姝ｅ紡璺緞鐨勭粨鏋勬€ф鏌?=================
console.log("");
console.log("=== A2. 缁撴瀯妫€鏌ワ細鍒嗙墖 tick 鏁?/ 鍊嶇巼鍐荤粨 / 閲嶅叆 / 缁撴潫鏉′欢 ===");

// A2-1锛氶甯у悗璇诲彇杩涘害鏉℃€婚噺锛? 琚帴鍙楃殑 tick 鏁帮級锛岄獙璇佸畠鍙敱鐪熷疄绉掓暟鍐冲畾
const tickRows = [];
for (const F of [1, 10000]) {
  await page.evaluate((text, F) => window.__d.load(text, F, false), saveText, F);
  await page.evaluate(() => window.__d.startSim(60, false));
  await new Promise(r => setTimeout(r, 300));
  const info = await page.evaluate(() => {
    let max = null, enabled = null;
    try {
      const bar = ui && ui.$viewModel && ui.$viewModel.modal && ui.$viewModel.modal.progressBar;
      max = bar ? bar.max : null;
    } catch (e) { /* ignore */ }
    try { enabled = Async.enabled; } catch (e) { /* ignore */ }
    return { max, enabled, locked: GameSpeed.isSimulationLocked };
  });
  await waitSimDone();
  tickRows.push({ F, ...info });
  console.log(`  F=${String(F).padStart(5)} 杩涘害鏉℃€婚噺(琚帴鍙?tick)=${String(info.max).padStart(6)}  妯℃嫙閿?${info.locked}  Async.enabled=${info.enabled}`);
}
const tickObserved = tickRows.every(r => Number.isFinite(r.max));
check("[A4] 鍒嗙墖 tick 鏁板彧鐢辩湡瀹炵鏁板喅瀹氾紝涓?F 鏃犲叧锛團 涓嶆敼鍙樼绾挎姌绠楃簿搴︼級",
  tickObserved && tickRows[0].max === tickRows[1].max,
  tickObserved ? tickRows.map(r => `F=${r.F}:${r.max}`).join(" ") : "杩涘害鏉℃湭瑙傚療鍒帮紙棣栧抚灏辩粨绠楀畬锛屾棤娉曞垽瀹氾級");

// A2-2锛氭ā鎷熸湡闂存敼鍊嶇巼 鈫?鐢熸晥鍊煎繀椤诲喕缁?
const freeze = await (async () => {
  await page.evaluate((text, F) => window.__d.load(text, F, false), saveText, 10000);
  const pre = await page.evaluate(() => window.__d.snap());
  await page.evaluate(() => window.__d.startSim(60, false));
  await new Promise(r => setTimeout(r, 300));
  const mid = await page.evaluate(() => {
    const before = { eff: GameSpeed.effectiveFactor, gf: getGlobalSpeedFactor(), locked: GameSpeed.isSimulationLocked };
    GameSpeed.set(2);
    const after = { eff: GameSpeed.effectiveFactor, gf: getGlobalSpeedFactor(), stored: GameSpeed.factor };
    return { before, after };
  });
  const w = await waitSimDone();
  const post = await page.evaluate(() => { const s = window.__d.snap(); GameSpeed.set(10000); return s; });
  return { mid, w, dGame: post.game - pre.game, dReal: post.real - pre.real };
})();
console.log(`  鍐荤粨妫€鏌ワ細妯℃嫙涓妸鍊嶇巼鏀规垚 2 鈫?瀛樺偍鍊?${freeze.mid.after.stored}锛岀敓鏁堝€?${freeze.mid.after.eff}锛堟敼鍓?${freeze.mid.before.eff}锛塦);
check("[A5] 妯℃嫙鏈熼棿鏀瑰€嶇巼涓嶆敼鍙樼敓鏁堝€硷紙鍊嶇巼鍐荤粨鐢熸晥锛岄伩鍏嶉噸澶嶆斁澶э級",
  freeze.mid.before.locked === true &&
  freeze.mid.after.eff === freeze.mid.before.eff &&
  freeze.mid.after.gf === freeze.mid.before.gf,
  `locked=${freeze.mid.before.locked} eff ${freeze.mid.before.eff} 鈫?${freeze.mid.after.eff}`);
check("[A6] 鍗充娇涓€旀敼杩囧€嶇巼锛岀粨绠椾粛鎸夊喕缁撳€嶇巼璁＄畻锛埼旀父鎴?螖鐜板疄 = 10000锛?,
  rel(freeze.dGame / (freeze.dReal || 1), 10000) < 0.02,
  `${(freeze.dGame / (freeze.dReal || 1)).toFixed(0)}`);

// A2-3锛氭ā鎷熻繘琛屼腑閲嶅叆 simulateTime锛堣褰曠粨鏋勯闄╋紝涓嶆敼鐢熶骇浠ｇ爜锛?
const reentry = await (async () => {
  await page.evaluate((text, F) => window.__d.load(text, F, false), saveText, 10000);
  const pre = await page.evaluate(() => window.__d.snap());
  await page.evaluate(() => window.__d.startSim(300, false));
  await new Promise(r => setTimeout(r, 300));
  const nested = await page.evaluate(() => {
    let enabledBefore = null, err = null;
    try { enabledBefore = Async.enabled; } catch (e) { /* ignore */ }
    const before = { locked: GameSpeed.isSimulationLocked, eff: GameSpeed.effectiveFactor };
    const t0 = performance.now();
    try { simulateTime(10, false, false); } catch (e) { err = e.message; }
    const syncMs = performance.now() - t0;
    const after = { locked: GameSpeed.isSimulationLocked, eff: GameSpeed.effectiveFactor };
    return { enabledBefore, err, syncMs, before, after };
  });
  const w = await waitSimDone(300000);
  const tail = await page.evaluate(() => {
    const out = {
      locked: GameSpeed.isSimulationLocked,
      eff: GameSpeed.effectiveFactor,
      stored: GameSpeed.factor,
      asyncEnabled: (() => { try { return Async.enabled; } catch (e) { return null; } })(),
    };
    // 鑻ュ€嶇巼浠嶈鍐荤粨锛岄獙璇併€屾敼璁剧疆鏄惁杩樿兘鐢熸晥銆嶏紙绮樻粸妫€鏌ワ級
    GameSpeed.set(2);
    out.effAfterSet = GameSpeed.effectiveFactor;
    // 娓呯悊锛氭棤鍙傝皟鐢ㄥ己鍒惰В鍐伙紝骞舵妸璁剧疆鎭㈠锛汚sync 涔熸仮澶嶄负鍙敤锛岄伩鍏嶆薄鏌撳悗缁敤渚?
    GameSpeed.endSimulation();
    GameSpeed.set(10000);
    try { Async.enabled = true; } catch (e) { /* ignore */ }
    out.effAfterCleanup = GameSpeed.effectiveFactor;
    return out;
  });
  const post = await page.evaluate(() => window.__d.snap());
  return { nested, w, tail, dInf: post.inf - pre.inf };
})();
console.log(`  閲嶅叆妫€鏌ワ細澶栧眰杩愯涓皟鐢?simulateTime(10) 鈫?Async.enabled(璋冪敤鍓?=${reentry.nested.enabledBefore}锛宍 +
  `鍐呭眰鑰楁椂 ${reentry.nested.syncMs.toFixed(0)}ms锛堝悓姝ユ墽琛岋級锛屽紓甯?${reentry.nested.err || "鏃?}`);
check("[A7] 閲嶅叆涓嶆姏寮傚父锛屼絾鍐呭眰鍚屾鎵ц锛圓sync 宸茶澶栧眰鍗犵敤 鈫?enabled=false锛?,
  reentry.nested.err === null && reentry.nested.enabledBefore === false && reentry.nested.syncMs > 0,
  `err=${reentry.nested.err || "none"} enabledBefore=${reentry.nested.enabledBefore} syncMs=${reentry.nested.syncMs.toFixed(0)}`);
console.log(`  浠ょ墝鐘舵€侊細鍐呭眰鍓?locked=${reentry.nested.before.locked}/eff=${reentry.nested.before.eff} 鈫?` +
  `鍐呭眰鍚?locked=${reentry.nested.after.locked}/eff=${reentry.nested.after.eff}锛涘灞傜粨鏉熷悗 locked=${reentry.tail.locked}/eff=${reentry.tail.eff}锛宍 +
  `姝ゆ椂 set(2) 鍚?eff=${reentry.tail.effAfterSet}锛宔ndSimulation() 鍚?eff=${reentry.tail.effAfterCleanup}`);
check("[A8] 閲嶅叆涓嶄細璁╃敓鏁堝€嶇巼琚斁澶э紙eff 濮嬬粓绛変簬 10000锛屾暟鍊兼病鏈夎蛋鏍凤級",
  reentry.tail.eff === 10000 && reentry.tail.effAfterSet === 10000,
  `eff=${reentry.tail.eff} set(2)鈫?{reentry.tail.effAfterSet}`);
note(`[A8-椋庨櫓路鏈慨澶峕 閲嶅叆鐨勫唴灞傝蛋 Async 鍚屾鍥為€€鍒嗘敮锛岃€?asyncExit锛堝惈 OrekiSpeed.endSimulation锛夊湪璇ュ垎鏀笉浼氳璋冪敤锛宍 +
  `浜庢槸鍐荤粨浠ょ墝娉勬紡鍒板唴灞備护鐗屼笂锛氬灞傜粨鏉熸椂 endSimulation(澶栧眰浠ょ墝) 琚护鐗屾牎楠屾嫆缁濓紝鍐荤粨涓€鐩存寔缁埌鍒锋柊椤甸潰銆俙 +
  `琛ㄧ幇锛濈绾跨粨绠楀悗銆屽€嶇巼璁剧疆鏀逛簡涓嶇敓鏁堛€嶏紙鏁板€间笉鍙樸€佷笉鏀惧ぇ锛夛紝闇€鍒锋柊鎵嶆仮澶嶃€俙 +
  `姝ｅ紡娴佺▼涓绾跨粨绠椾笌浼戠湢 catch-up 浜掓枼锛堢粨绠楁湡闂?GameIntervals 宸插仠锛夛紝鍥犳姝ｅ父娓哥帺涓嶄細瑙﹀彂锛涘睘缁撴瀯椋庨櫓锛屼笉鏄綋鍓嶅彲澶嶇幇鐨勬暟鍊奸敊璇€俙);
note(`[A9-椋庨櫓] 閲嶅叆绛変簬閲嶅缁撶畻锛氶噷绋嬬濂栧姳涓庣绾?IP 浼氬啀鍙戜竴娆°€傛湰娆?300s+10s 閲嶅叆缁勫悎鐨?螖鏃犻檺=${reentry.dInf.toExponential(2)}銆俙);

// A2-4锛氱粨鏉熸潯浠朵笌 lastUpdate 鍐欏叆鏃舵満锛堝共鍑€璺戜竴娆★紝涓嶅甫閲嶅叆锛?
const clean = await (async () => {
  await page.evaluate((text, F) => window.__d.load(text, F, false), saveText, 1000);
  await page.evaluate(() => window.__d.startSim(60, false));
  await waitSimDone();
  return page.evaluate(() => {
    const lock = GameSpeed.isSimulationLocked;
    let bar = null, asyncOn = null;
    try { bar = ui.$viewModel.modal.progressBar !== undefined; } catch (e) { /* ignore */ }
    try { asyncOn = Async.enabled; } catch (e) { /* ignore */ }
    const lu0 = player.lastUpdate;
    gameLoop(20);
    return { lock, bar, asyncOn, lu0, lu1: player.lastUpdate, now: Date.now() };
  });
})();
check("[A10] 骞插噣璺緞鐨勭粨鏉熸潯浠讹細妯℃嫙閿侀噴鏀?+ 杩涘害鏉℃竻闄?+ Async 鎭㈠鍙敤",
  clean.lock === false && clean.bar !== true && clean.asyncOn === true,
  `lock=${clean.lock} bar=${clean.bar} async=${clean.asyncOn}`);
check("[A11] 缁撶畻鍚庣涓€甯ф妸 lastUpdate 鎷夊埌褰撳墠鏃跺埢锛堜笅娆¤浇鍏ヤ笉浼氶噸璺戝悓涓€娈电绾匡級",
  Math.abs(clean.lu1 - clean.now) < 5000,
  `lastUpdate=${clean.lu1} now=${clean.now} 宸?${clean.now - clean.lu1}ms`);

// ================= B. 榛戞礊婵€娲诲垎鏀?=================
console.log("\n=== B. 榛戞礊婵€娲诲垎鏀紙寮哄埗 player.blackHole[0].active = true锛?==");
const bhPre = await page.evaluate((text) => window.__d.load(text, 1, true), saveText);
console.log(`  寮哄埗鍚庯細unlocked=${bhPre.bh.unlocked} paused=${bhPre.bh.paused} active1=${bhPre.bh.active1} speedup=${bhPre.bh.speedup?.toExponential?.(3)}`);
check("[B1] 榛戞礊纭疄澶勪簬婵€娲荤姸鎬侊紙active1 = true 涓?speedup > 1锛?,
  bhPre.bh.active1 === true && Number(bhPre.bh.speedup) > 1,
  `active1=${bhPre.bh.active1} speedup=${bhPre.bh.speedup}`);

console.log("     F   绂荤嚎(s)  鏂瑰紡   螖娓告垙鏃堕棿(ms)     螖鐜板疄(ms)   螖娓告垙/螖鐜板疄   螖娓告垙/(螖鐜板疄脳speedup)");
const bhRows = [];
for (const F of [1, 10000]) {
  for (const S of [60]) {
    for (const fast of [true, false]) {
      const pre = await page.evaluate(({ text, F }) => window.__d.load(text, F, true), { text: saveText, F });
      await page.evaluate(({ S, fast }) => window.__d.startSim(S, fast), { S, fast });
      if (!fast) await waitSimDone();
      const post = await page.evaluate(() => window.__d.snap());
      const d = {
        F, S, fast,
        dGame: post.game - pre.state.game,
        dReal: post.real - pre.state.real,
        speedup: pre.bh.speedup,
      };
      bhRows.push(d);
      const r1 = d.dGame / (d.dReal || 1);
      const r2 = r1 / (d.speedup || 1);
      console.log(`  ${String(F).padStart(6)} ${String(S).padStart(7)}  ${(fast ? "fast" : "async").padEnd(5)} ${d.dGame.toExponential(3).padStart(14)} ${d.dReal.toFixed(0).padStart(11)} ${r1.toExponential(3).padStart(12)} ${r2.toExponential(3).padStart(16)}`);
    }
  }
}
check("[B2] 榛戞礊婵€娲讳笅 螖鐜板疄浠嶇瓑浜庣绾跨鏁帮紙鐜板疄鏃堕棿涓嶈 BH 鏀惧ぇ锛?,
  bhRows.every(r => rel(r.dReal, r.S * 1000) < 0.02),
  bhRows.map(r => `${r.F}/${r.fast ? "f" : "a"}:${r.dReal.toFixed(0)}`).join(" "));
check("[B3] 榛戞礊婵€娲诲悗 螖娓告垙/螖鐜板疄 鏄庢樉 > 1锛圔H 纭疄鐢熸晥锛?,
  bhRows.every(r => r.dGame / (r.dReal || 1) > 2),
  bhRows.map(r => `${r.F}:${(r.dGame / (r.dReal || 1)).toExponential(2)}`).join(" "));
// 瑙傛祴锛堜笉浣滄柇瑷€锛夛細绛夋晥鍊嶇巼 = F 脳 BH 鍗犵┖姣斿钩鍧囷紝涓嶇瓑鍚屼簬 F 脳 speedup
const effFactor = bhRows.map(r => ({ F: r.F, fast: r.fast, per: (r.dGame / (r.dReal || 1)) / r.F }));
note("[B4-瑙傛祴] 銆屛旀父鎴?螖鐜板疄 梅 F銆? BH 鐨?*骞冲潎**绛夋晥鍊嶇巼锛堝彈鍗犵┖姣斾笌鐩镐綅鎺ㄨ繘褰卞搷锛夛紝涓嶇瓑浜庣灛鏃?speedup锛? +
  effFactor.map(x => `${x.F}/${x.fast ? "f" : "a"}=${x.per.toFixed(2)}`).join("  "));
const extreme = bhRows.some(r => r.dGame / (r.dReal || 1) > 1e6);
note(`[B5] 鏃ф姤鍛娿€? 绉掔绾夸骇鐢?3.2e14ms 娓告垙鏃堕棿銆嶉渶瑕?螖娓告垙/螖鐜板疄 鈮?3.2e11锛涙湰娆￠粦娲炴縺娲诲疄娴嬫渶澶?${Math.max(...bhRows.map(r => r.dGame / (r.dReal || 1))).toExponential(2)}锛宍 +
  `${extreme ? "宸茶揪鍚岄噺绾? : "**鏈鐜?*锛氳鏄庤寮傚父杩樺彔鍔犱簡鍒殑鍥犵礌锛堜緥濡傚綋鏃跺瓨妗ｇ殑 BH power 鏇撮珮鎴栫浉浣?鏆傚仠鐘舵€佷笉鍚岋級"}銆俙);

// ================= C. S4 鐨?卤1e12 璇绘暟褰掑洜 =================
console.log("");
console.log("=== C. S4 鐨?卤1e12 璇绘暟褰掑洜锛堝姣旓細鏄惁鐢辨祴璇曡剼鏈殑閲嶇疆閫犳垚锛?==");
const S4 = "1123._Endgame.txt";
const s4Text = fs.readFileSync(path.join(SAVE_DIR, S4), "utf-8");
const s4 = await page.evaluate(async (text) => {
  const d = window.__d;
  const run = (doReset) => {
    const pre = d.load(text, 10000, false);
    const before = d.snap();
    for (let i = 0; i < 500; i++) {
      if (doReset) {
        try { buyAsManyAsYouCanBuy(1); } catch (e) { /* ignore */ }
        try { if (Player.canCrunch) bigCrunchReset(); } catch (e) { /* ignore */ }
        try { if (Player.canEternity) eternityRequestReset(); } catch (e) { /* ignore */ }
      }
      gameLoop(20);
    }
    const after = d.snap();
    return {
      before, after,
      dIp: after.ip - before.ip,
      dInf: after.inf - before.inf,
      dEter: after.eter - before.eter,
      finite: Number.isFinite(before.ip) && Number.isFinite(after.ip),
    };
  };
  return { plain: run(false), withReset: run(true) };
}, s4Text);

for (const [k, v] of Object.entries(s4)) {
  console.log(`  ${k.padEnd(9)} IP(log10) ${v.before.ip} 鈫?${v.after.ip}   螖IP=${v.dIp.toExponential(3)}  螖鏃犻檺=${v.dInf.toExponential(2)}  螖姘告亽=${v.dEter.toExponential(2)}`);
}
check("[C1] 涓嶈Е鍙戦噸缃椂锛孲4 鐨?螖log10(IP) 涓烘湁闄愬€间笖闈炶礋锛堣鏁版湰韬病鏈夋孩鍑猴級",
  s4.plain.finite && Number.isFinite(s4.plain.dIp) && s4.plain.dIp >= -1e-6,
  `螖IP=${s4.plain.dIp.toExponential(3)}`);
check("[C2] 鍑虹幇宸ㄥぇ璐?螖log10(IP) 鏃讹紝蹇呯劧浼撮殢閲嶇疆锛堟棤闄?姘告亽娆℃暟鍙樺寲锛?,
  !(s4.withReset.dIp < -1e6) || (s4.withReset.dInf !== 0 || s4.withReset.dEter !== 0),
  `螖IP=${s4.withReset.dIp.toExponential(3)} 螖鏃犻檺=${s4.withReset.dInf} 螖姘告亽=${s4.withReset.dEter}`);
note("[C3-缁撹] 鍩虹嚎鑴氭湰鏃╁厛鍑虹幇鐨?-1.02e12 灞?*娴嬭瘯鑴氭湰鑷韩璋冪敤 bigCrunch/eternity 閲嶇疆**閫犳垚鐨勫噣鍙樺寲锛屼笉鏄诞鐐规孩鍑恒€佷篃涓嶆槸娓告垙鏈哄埗缂洪櫡锛涘凡鏀逛负闃舵妯″紡鍙拱涓嶉噸缃紝骞惰褰曘€屽彉鍔ㄥ抚鏁般€?");

check("[D] 鍏ㄦ祦绋嬫棤鏈崟鑾疯剼鏈紓甯?, errs.length === 0, errs.slice(0, 3).join(" | "));

const pass = results.filter(r => r.p).length;
console.log(`\n==== 缁撴灉: ${pass} 閫氳繃 / ${results.length - pass} 澶辫触 ====`);
await browser.close();
server.close();
process.exit(pass === results.length ? 0 : 1);
