// 闄愬畾寰鍘熷瀷锛堥殧绂诲疄楠岋紝涓嶆敼 src锛夛細
//   A      = 鐜扮姸锛氭瘡甯?1 娆″喅绛?+ gameLoop(20ms)
//   Bn     = 鏈寸礌寰锛氭瘡甯?k 娆?(鍐崇瓥 + gameLoop(20/k))  鈥斺€?宸茬煡浼氭妸甯х骇鏈哄埗涓€璧锋斁澶?k 鍊嶏紙涓婄晫鍙傝€冿級
//   Bs     = 闄愬畾寰鍘熷瀷锛氬井姝ュ唴鎶娿€屽彲 stub 鐨勫抚绾ф満鍒躲€嶆崲鎴愬氨鍦?no-op锛屽井姝ョ粨鏉熷悗鍙窇涓€娆?
//   As     = 瀵圭収锛氬崟甯у唴鍚屾牱 stub锛堢敤鏉ラ噺鍑鸿繖浜涙満鍒舵瘡甯х殑 CPU 鎴愭湰锛?
//
// 鍏抽敭闄愬埗锛堟湰杞璇佹槑鐨勪簨瀹烇級锛?
//   gameLoop 閲岃繕鏈変竴鎵广€屾寜鍚嶅瓧鐩存帴璋冪敤銆嶇殑鑷敱鍑芥暟锛坙aitelaRealityTick / applyAutoprestige /
//   updateImaginaryMachines / replicantiLoop / updateTachyonGalaxies 鈥︼級锛屽畠浠湪 ESM 閲屾槸鍙缁戝畾锛?
//   澶栭儴鏃犳硶 stub锛涙墍浠?Bs **涓嶅彲鑳?*瀹屽叏绛変环浜庛€屽彧寰鐢熶骇+閲囪喘銆嶃€傛湰鑴氭湰鎶婅繖閮ㄥ垎濡傚疄閲忓寲銆?

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const ROOT = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };
const argNum = (k, d) => { const h = process.argv.find(a => a.startsWith(`--${k}=`)); const v = h ? Number(h.split("=")[1]) : NaN; return Number.isFinite(v) && v > 0 ? v : d; };
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
await new Promise(r => server.listen(8440, "127.0.0.1", r));

const browser = await launchViaConnect({ protocolTimeout: 300000 });
const page = await browser.newPage();
const errs = [];
const NOISE = /googletagmanager|google-analytics|kaspersky-labs/;
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => { if (m.type() === "error" && !NOISE.test(m.text())) errs.push(`CONSOLE: ${m.text().slice(0, 160)}`); });
await page.goto("http://127.0.0.1:8440/index.html", { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 80; i++) {
  const ok = await page.evaluate(() => { try { return typeof gameLoop === "function" && typeof player === "object" && typeof Currency === "function"; } catch (e) { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}
console.log("PASS  娓告垙鍚姩灏辩华");

await page.evaluate(() => {
  const cnt = {};
  const bump = k => { cnt[k] = (cnt[k] || 0) + 1; };
  // 鍙?stub 鐨勫抚绾ф満鍒讹紙瀵硅薄鏂规硶锛岃繍琛屾椂鑳芥敼鍐欙級
  const TARGETS = [
    ["Autobuyers.tick", () => Autobuyers, "tick", "autobuyers"],
    ["Tutorial.tutorialLoop", () => Tutorial, "tutorialLoop", "tutorial"],
    ["DeltaTimeState.update", () => DeltaTimeState, "update", "deltaTime"],
    ["Achievements.autoAchieveUpdate", () => Achievements, "autoAchieveUpdate", "achieve"],
    ["BlackHoles.updatePhases", () => BlackHoles, "updatePhases", "blackHole"],
    ["Ra.memoryTick", () => Ra, "memoryTick", "raMemory"],
    ["AutomatorBackend.update", () => AutomatorBackend, "update", "automator"],
    ["Pelle.gameLoop", () => Pelle, "gameLoop", "pelle"],
    ["GalaxyGenerator.loop", () => GalaxyGenerator, "loop", "galaxyGen"],
    ["GameEnd.gameLoop", () => GameEnd, "gameLoop", "gameEnd"],
    ["V.checkForUnlocks", () => V, "checkForUnlocks", "vUnlock"],
    ["InfinityDimensions.tryAutoUnlock", () => InfinityDimensions, "tryAutoUnlock", "idUnlock"],
    ["GameUI.update", () => GameUI, "update", "ui"],
  ];
  const saved = new Map();

  const lg = v => { if (v && typeof v.log10 === "function") { const d = v.log10(); const n = d && d.toNumber ? d.toNumber() : Number(d); return Number.isFinite(n) ? n : NaN; } const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.log10(n) : NaN; };
  const num = v => { const n = v && v.toNumber ? v.toNumber() : Number(v); return Number.isFinite(n) ? n : NaN; };

  window.__ms = {
    lg, num,
    resetCnt() { for (const k of Object.keys(cnt)) delete cnt[k]; return true; },
    counters() { return { ...cnt }; },
    // 璁℃暟鍖呰锛坰tub 鏃朵粛鐒惰鏁帮紝渚夸簬璇佹槑銆岃鎶戝埗銆嶈€屼笉鏄€岃鍒犻櫎銆嶏級
    // 鍙鏁般€佷笉鎶戝埗锛圓 / Bn 鐢級锛岃"璋冪敤娆℃暟"鍦ㄥ洓涓柟妗堥棿鍙瘮
    countSystems() {
      for (const [name, getObj, method, key] of TARGETS) {
        let obj;
        try { obj = getObj(); } catch (e) { continue; }
        if (!obj || typeof obj[method] !== "function") continue;
        const id = `${name}`;
        if (saved.has(id)) continue;
        const orig = obj[method];
        saved.set(id, { obj, method, orig });
        obj[method] = function (...args) { bump(key); return orig.apply(obj, args); };
      }
      return [...saved.keys()];
    },
    stubSystems() {
      for (const [name, getObj, method, key] of TARGETS) {
        let obj;
        try { obj = getObj(); } catch (e) { continue; }
        if (!obj || typeof obj[method] !== "function") continue;
        const id = `${name}`;
        if (saved.has(id)) continue;
        const orig = obj[method];
        saved.set(id, { obj, method, orig });
        obj[method] = function (...args) { bump(key); return undefined; };
      }
      return [...saved.keys()];
    },
    restoreSystems() {
      for (const [id, rec] of saved) { rec.obj[rec.method] = rec.orig; saved.delete(id); }
      return true;
    },
    stubbed() { return [...saved.keys()]; },
    decide(doCrunch = true) {
      for (let t = 1; t <= 8; t++) { try { buyAsManyAsYouCanBuy(t); } catch (e) { /* ignore */ } }
      try { buyMaxTickSpeed(); } catch (e) { /* ignore */ }
      try { if (DimBoost.canBeBought) requestDimensionBoost(1); } catch (e) { /* ignore */ }
      try { if (Galaxy.canBeBought) requestGalaxyReset(1); } catch (e) { /* ignore */ }
      if (doCrunch) {
        try { if (Player.canCrunch) bigCrunchReset(); } catch (e) { /* ignore */ }
        try { if (Player.canEternity) eternityResetRequest(); } catch (e) { /* ignore */ }
      }
    },
    load(text, F) {
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      GameSpeed.set(F);
      this.restoreSystems();
      return this.snap();
    },
    snap() {
      const safe = f => { try { return f(); } catch (e) { return undefined; } };
      return {
        game: player.records.totalTimePlayed,
        real: player.records.realTimePlayed,
        amLog: lg(Currency.antimatter.value),
        ipLog: lg(Currency.infinityPoints.value),
        epLog: lg(Currency.eternityPoints.value),
        rmLog: lg(Currency.realities.value),
        inf: num(Currency.infinities.value),
        eter: num(Currency.eternities.value),
        real2: num(Currency.realities.value),
        galaxies: num(player.galaxies),
        dimBoosts: num(player.dimensionBoosts),
        speedup: safe(() => getGameSpeedupFactor()),
        bh: safe(() => BlackHoles.areUnlocked && !BlackHoles.arePaused),
        raMem: safe(() => { const p = Ra.pets.all.find(x => String(x.key).toLowerCase() === 'teresa'); return p ? num(p.memories) : undefined; }),
        raMomentum: safe(() => num(player.celestials.ra.momentumTime)),
        laitela: safe(() => num(player.celestials.laitela.darkMatter)),
        gameEnd: safe(() => GameEnd.endState),
      };
    },
    // A锛氭瘡甯?1 娆″喅绛?
    runA(frames, ms, doDecide, doCrunch) {
      this.countSystems();
      for (let i = 0; i < frames; i++) { if (doDecide) this.decide(doCrunch); gameLoop(ms); }
      this.restoreSystems();
      return this.snap();
    },
    // Bn锛氭湸绱犲井姝ワ紙甯х骇鏈哄埗涓€甯?k 娆★級
    runBn(frames, ms, k, doDecide, doCrunch) {
      this.countSystems();
      const sub = ms / k;
      for (let i = 0; i < frames; i++) {
        for (let j = 0; j < k; j++) { if (doDecide) this.decide(doCrunch); gameLoop(sub); }
      }
      this.restoreSystems();
      return this.snap();
    },
    // Bs锛氶檺瀹氬井姝ワ紙寰鍐?stub 甯х骇鏈哄埗锛涚粨鏉熷悗 **涓?* 鍥炴斁鈥斺€斿洖鏀炬墍闇€鍐呴儴 diff 鎷夸笉鍒帮級
    runBs(frames, ms, k, doDecide, doCrunch) {
      const sub = ms / k;
      const ids = this.stubSystems();
      for (let i = 0; i < frames; i++) {
        for (let j = 0; j < k; j++) { if (doDecide) this.decide(doCrunch); gameLoop(sub); }
      }
      this.restoreSystems();
      return { snap: this.snap(), stubbed: ids };
    },
    // As锛氬崟甯?stub 瀵圭収锛堥噺鍑鸿 stub 鐨勬満鍒舵瘡甯х殑 CPU 鎴愭湰 鈫?鐢?CPU 宸帹鏂紝涓嶉潬鐚滐級
    runAs(frames, ms, doDecide, doCrunch) {
      this.stubSystems();
      for (let i = 0; i < frames; i++) { if (doDecide) this.decide(doCrunch); gameLoop(ms); }
      this.restoreSystems();
      return this.snap();
    },
  };
});

const e = (v, d = 3) => (Number.isFinite(v) ? v.toExponential(d) : "鈥?);
const fmt = v => (Number.isFinite(v) ? v.toFixed(3) : "鈥?);
const saveText = (f) => fs.readFileSync(path.join(SAVE_DIR, f), "utf-8");

// 鍦烘櫙琛細{ 鍚嶇О, 瀛樻。, F, 甯ф暟, 鍐崇瓥? , 鍓嶇疆鐘舵€?}
const SCEN = [
  { key: "S1 鏂板瓨妗ｂ啋棣栦釜鏃犻檺", file: null, F: 10000, frames: 2000, decide: true, crunch: true },
  { key: "S2 涓湡(9.1e137IP)", file: "132._9.1e137IP.txt", F: 10000, frames: 300, decide: true },
  { key: "S3 榛戞礊婵€娲?, file: "132._9.1e137IP.txt", F: 10000, frames: 300, decide: true, bh: true },
  { key: "S4 Ra/鍚庢湡(1123)", file: "1123._Endgame.txt", F: 10000, frames: 120, decide: true },
  { key: "S5 浣庡€嶇巼 F=1", file: "132._9.1e137IP.txt", F: 1, frames: 300, decide: true },
  { key: "S6 鏋侀珮鍊嶇巼 F=100000", file: "132._9.1e137IP.txt", F: 100000, frames: 300, decide: true },
  { key: "S7 寮傚父澶?diff(2000ms/甯?", file: "132._9.1e137IP.txt", F: 10000, frames: 30, decide: true, frameMs: 2000 },
  { key: "S8 鏆傚仠鍚庢仮澶?, file: "132._9.1e137IP.txt", F: 10000, frames: 300, decide: true, paused: true },
];

const K = argNum("k", 10);
const rows = [];
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  鈥?${detail}` : ""}`); };
const note = t => console.log(`NOTE  ${t}`);

console.log(`\n寰娆℃暟 k=${K}锛涘抚闀块粯璁?${FRAME_MS}ms锛汚/Bn/Bs/As 鍥涗釜鏂规 脳 ${SCEN.length} 涓満鏅痋n`);

for (const sc of SCEN) {
  const ms = sc.frameMs || FRAME_MS;
  // 鏂板瓨妗ｅ満鏅細鐢ㄥ綋鍓嶉〉闈㈤噷鐨勬柊寮€灞€搴忓垪鍖栨枃鏈紙涓庡熀绾垮悓涓€浠斤級
  const text = sc.file ? saveText(sc.file) : await page.evaluate(() => GameSaveSerializer.serialize(player));
  const prep = async (extra) => page.evaluate(({ text, F, bh, paused }) => {
    const s = window.__ms.load(text, F);
    try {
      if (bh) {
        player.blackHolePause = false;
        player.blackHole = player.blackHole || [];
        for (let i = 0; i < 3; i++) {
          player.blackHole[i] = player.blackHole[i] || {};
          player.blackHole[i].unlocked = true;
          player.blackHole[i].active = true;
          player.blackHole[i].phase = 0;
        }
      }
      if (paused) player.options.gamePaused = false;   // 璁板綍锛氫粠銆屾湭鏆傚仠銆嶅紑濮嬶紝閬垮厤鏁存琚?return
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
    } catch (e) { /* ignore */ }
    return { s0: window.__ms.snap(), text: null };
  }, { text, F: sc.F, bh: !!sc.bh, paused: !!sc.paused });

  const run = async (fn, ...args) => {
    const t0 = Date.now();
    const out = await page.evaluate(({ fn, args }) => window.__ms[fn](...args), { fn, args });
    const cpuMs = Date.now() - t0;
    const c = await page.evaluate(() => window.__ms.counters());
    return { out, cpuMs, counters: c };
  };

  const base = await prep();
  // A
  await page.evaluate(() => window.__ms.resetCnt());
  const A = await run("runA", sc.frames, ms, sc.decide, !!sc.crunch);
  const sA = A.out;
  // Bn
  const s0b = await prep();
  await page.evaluate(() => window.__ms.resetCnt());
  const Bn = await run("runBn", sc.frames, ms, K, sc.decide, !!sc.crunch);
  // Bs
  const s0c = await prep();
  await page.evaluate(() => window.__ms.resetCnt());
  const Bs = await run("runBs", sc.frames, ms, K, sc.decide, !!sc.crunch);
  // As锛坰tub 瀵圭収锛?
  const s0d = await prep();
  await page.evaluate(() => window.__ms.resetCnt());
  const As = await run("runAs", sc.frames, ms, sc.decide, !!sc.crunch);

  const d = (x, y) => ({ am: x.amLog - y.amLog, ip: x.ipLog - y.ipLog, ep: x.epLog - y.epLog, inf: x.inf - y.inf, eter: x.eter - y.eter, bh: x.bh, raMem: (x.raMem || 0) - (y.raMem || 0), momentum: (x.raMomentum || 0) - (y.raMomentum || 0) });
  const row = {
    key: sc.key, F: sc.F, k: K, frames: sc.frames, frameMs: ms,
    A: { cpuMs: A.cpuMs, state: sA, d: d(sA, base.s0) },
    Bn: { cpuMs: Bn.cpuMs, state: Bn.out, d: d(Bn.out, s0b.s0) },
    Bs: { cpuMs: Bs.cpuMs, state: Bs.out.snap, d: d(Bs.out.snap, s0c.s0), stubbed: Bs.out.stubbed },
    As: { cpuMs: As.cpuMs, state: As.out, d: d(As.out, s0d.s0) },
    counters: { A: A.counters, Bn: Bn.counters, Bs: Bs.counters, As: As.counters },
  };
  rows.push(row);

  const cpuPerFrame = x => x.cpuMs / sc.frames;
  console.log(`=== ${sc.key}  (F=${sc.F}, ${sc.frames} 甯?脳 ${ms}ms, k=${K})`);
  console.log(`   A : CPU/甯?${fmt(cpuPerFrame(A))}ms  螖log10(IP)=${fmt(row.A.d.ip)} 螖鏃犻檺=${e(row.A.d.inf)} 螖鏄熺郴=${fmt(row.A.state.galaxies - base.s0.galaxies)} 螖Ra璁板繂=${e(row.A.d.raMem, 2)}`);
  console.log(`   Bn: CPU/甯?${fmt(cpuPerFrame(Bn))}ms  螖log10(IP)=${fmt(row.Bn.d.ip)} 螖鏃犻檺=${e(row.Bn.d.inf)} 螖鏄熺郴=${fmt(row.Bn.state.galaxies - s0b.s0.galaxies)} 螖Ra璁板繂=${e(row.Bn.d.raMem, 2)}`);
  console.log(`   Bs: CPU/甯?${fmt(cpuPerFrame(Bs))}ms  螖log10(IP)=${fmt(row.Bs.d.ip)} 螖鏃犻檺=${e(row.Bs.d.inf)} 螖鏄熺郴=${fmt(row.Bs.state.galaxies - s0c.s0.galaxies)} 螖Ra璁板繂=${e(row.Bs.d.raMem, 2)}  琚?stub: ${row.Bs.stubbed.length} 椤筦);
  console.log(`   As: CPU/甯?${fmt(cpuPerFrame(As))}ms  螖log10(IP)=${fmt(row.As.d.ip)} 螖鏃犻檺=${e(row.As.d.inf)} 螖鏄熺郴=${fmt(row.As.state.galaxies - s0d.s0.galaxies)} 螖Ra璁板繂=${e(row.As.d.raMem, 2)}`);
  console.log(`   璁℃暟/甯э紙A vs Bn vs Bs锛夛細榛戞礊鐩镐綅 ${fmt((row.counters.A.blackHole || 0) / sc.frames)} / ${fmt((row.counters.Bn.blackHole || 0) / sc.frames)} / ${fmt((row.counters.Bs.blackHole || 0) / sc.frames)}锛沗 +
    `Ra璁板繂 ${fmt((row.counters.A.raMemory || 0) / sc.frames)} / ${fmt((row.counters.Bn.raMemory || 0) / sc.frames)} / ${fmt((row.counters.Bs.raMemory || 0) / sc.frames)}锛沗 +
    `鎴愬氨 ${fmt((row.counters.A.achieve || 0) / sc.frames)} / ${fmt((row.counters.Bn.achieve || 0) / sc.frames)} / ${fmt((row.counters.Bs.achieve || 0) / sc.frames)}`);
  console.log("");
}

// ===== 鍒ゅ畾 =====
console.log("========== 鍒ゅ畾 ==========");

// 1) Bn 鎶婂抚绾ф満鍒舵斁澶?k 鍊嶏紙璇佹槑銆屾湸绱犲井姝ャ€嶄笉鍙敤浜庣敓浜э級
const bhA = rows.filter(r => r.counters.A.blackHole !== undefined);
check("[1] 鏈寸礌寰锛圔n锛変細鎶婂抚绾ф満鍒惰皟鐢ㄦ鏁版斁澶у埌 k 鍊?,
  rows.every(r => (r.counters.Bn.blackHole || 0) >= (r.counters.A.blackHole || 0) * (r.K || 1) * 0.99 || (r.counters.A.blackHole || 0) === 0),
  `渚嬶細${rows[2].key} 榛戞礊鐩镐綅 A=${fmt((rows[2].counters.A.blackHole || 0) / rows[2].frames)}/甯?鈫?Bn=${fmt((rows[2].counters.Bn.blackHole || 0) / rows[2].frames)}/甯э紙k=${rows[2].k}锛塦);

// 2) Bs 鑳芥妸鍙?stub 鐨勬満鍒跺帇鍥炪€屾瘡甯?0 娆°€嶏紙闈?stub锛? 浣?*娌℃湁鍥炴斁** 鈫?鐘舵€佸亸绂?
const s3 = rows[2];
const s3a = rows[2];
const diverged = Math.abs(s3a.Bs.d.ip - s3a.A.d.ip) > 0.05;
check("[2] 闄愬畾寰锛圔s锛夋妸甯х骇鏈哄埗鎹㈡垚浜?no-op锛屼絾**娌℃湁鍥炴斁** 鈫?鐘舵€佷笌 A 涓嶇瓑浠?,
  diverged,
  `S3锛欰 鐨?螖log10(IP)=${fmt(s3a.A.d.ip)} vs Bs=${fmt(s3a.Bs.d.ip)}锛堥粦娲炵浉浣嶄笉鍐嶆帹杩涳紝speedup 涓嶅悓锛塦);
note(`[2-椋庨櫓] Bs 鐨勮皟鐢ㄨ鏁颁粛鏄?k 娆?甯э紙琚?stub 璁″埌锛夛紝浣嗘瘡娆￠兘鏄?no-op锛氶粦娲炵浉浣嶃€丷a 璁板繂銆佹垚灏辨鏌ュ湪寰閲?*瀹屽叏涓嶇敓鏁?*锛宍 +
  `寰缁撴潫鍚庝篃娌℃湁鍥炴斁 鈫?S3 鐨?螖log10(IP) 浠?${fmt(s3a.A.d.ip)} 鍙樻垚 ${fmt(s3a.Bs.d.ip)}銆俙 +
  `瑕佸仛鍒?姣忓抚鍙窇涓€娆?蹇呴』鍥炴斁锛岃€?gameLoop 鍐呴儴鐨?diff/speedup 灞€閮ㄥ€煎閮ㄦ嬁涓嶅埌 鈫?**涓嶆敼 src 鏃犳硶鍥炴斁**銆俙);

// 3) CPU 鎴愭湰锛氳 stub 鐨勬満鍒舵瘡甯у崰澶氬皯
const costRows = rows.map(r => {
  const a = r.A.cpuMs / r.frames, s = r.As.cpuMs / r.frames;
  return { key: r.key, a, s, saved: a - s, pct: (a - s) / a };
});
console.log("\n  琚?stub 鏈哄埗姣忓抚 CPU 鎴愭湰锛圓 鈭?As锛夛細");
for (const c of costRows) console.log(`    ${c.key.padEnd(24)} A=${fmt(c.a)}ms  As=${fmt(c.s)}ms  宸?${fmt(c.saved)}ms锛?{(c.pct * 100).toFixed(1)}%锛塦);
const avgPct = costRows.reduce((s, c) => s + c.pct, 0) / costRows.length;
check("[3] 琚?stub 鐨勯偅鎵规満鍒舵瘡甯ф湁鍙祴鐨?CPU 鎴愭湰锛堜笉鏄浂鎴愭湰鍙拷鐣ラ」锛?,
  costRows.some(c => c.saved > 0.05), `骞冲潎鍙渷 ${(avgPct * 100).toFixed(1)}%`);
note(`[3-璇存槑] 銆孉s 鐪佷笅鐨?CPU銆? 13 椤瑰彲 stub 鏈哄埗鐨勫悎璁℃垚鏈€傚畠缁欏嚭**涓婇檺**锛氬嵆浣挎妸瀹冧滑鍏ㄩ儴鎸夊抚璺戜竴娆°€乣 +
  `寰閲屽畬鍏ㄤ笉璺戯紝鑳界渷涓嬫潵鐨勪篃鍙湁杩欓儴鍒嗐€傜湡姝ｇ殑棰勭畻鍒ゆ柇瑕佺敤杩欎釜鏁帮紝鑰屼笉鏄?Bn 鐨勫抚鏁版瘮渚嬨€俙);

// 4) 寰娆℃暟涓婇檺锛?ms/甯?鐩爣锛?
const perSub = rows.map(r => r.Bn.cpuMs / r.frames / r.k);
console.log("\n  寰鍗曚环锛圔n 姣忓抚 CPU 梅 k锛屽惈鎵€鏈夋満鍒讹級锛?);
for (const [i, r] of rows.entries()) console.log(`    ${r.key.padEnd(24)} ${fmt(perSub[i])}ms/寰 鈫?4ms 棰勭畻鏈€澶氱害 ${Math.floor(4 / Math.max(perSub[i], 1e-9))} 娆?甯э紙鍚叏閮ㄦ満鍒讹級`);
note("[4-璇存槑] 4ms/甯?鏄?*瀹為獙鐩爣**锛屼笉鏄凡瀹炵幇淇濊瘉銆備笂琛ㄨ鏄庯細鍦ㄥ惈鍏ㄩ儴鏈哄埗鐨勬儏鍐典笅锛屾湰鏈?4ms 鍙兘鏀拺寰堝皯鐨勫井姝ワ紱" +
  "鍙湁鍏堝墺绂诲抚绾ф満鍒讹紝寰鎵嶅彲鑳藉璧锋潵 鈥斺€?杩欓渶瑕?src 渚ч挬瀛愩€?);

check("[5] 璁板綍鍒般€屾柊瀛樻。鍦烘櫙涓?Bn 涓?A 鐨勮祫婧愬樊寮傚法澶э紝涓斾笉鏄畨鍏ㄧ瓑浠枫€?,
  Math.abs(rows[0].Bn.d.inf - rows[0].A.d.inf) > 0 || Math.abs(rows[0].Bn.d.ip - rows[0].A.d.ip) > 0.01,
  `S1 螖log10(IP)锛欰=${fmt(rows[0].A.d.ip)} vs Bn=${fmt(rows[0].Bn.d.ip)}`);

check("[E] 鍏ㄦ祦绋嬫棤鏈崟鑾疯剼鏈紓甯?, errs.length === 0, errs.slice(0, 3).join(" | "));

fs.writeFileSync("C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/exp-microstep-proto.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), k: K, frameMs: FRAME_MS, rows, costs: costRows, verdict: results, errors: errs }, null, 2));
console.log("\n宸插啓鍏?_research/exp-microstep-proto.json");
const pass = results.filter(r => r.ok).length;
console.log(`\n==== 缁撴灉锛?{pass} 閫氳繃 / ${results.length - pass} 澶辫触 ====`);
await browser.close();
server.close();
process.exit(pass === results.length ? 0 : 1);
