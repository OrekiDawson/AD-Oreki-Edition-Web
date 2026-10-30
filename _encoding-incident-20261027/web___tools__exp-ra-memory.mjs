// Ra 瀹犵墿璁板繂澧為€燂細F=1 vs F=10000 杩愯鏃跺鐓э紙Web 鐗堬級
//
// 鐩殑锛氱粰 Android 鍚岀被娴嬭瘯锛圱eresa/V 璁板繂澧為噺姣?鈮?.0008 / 1.0007锛夊仛璺ㄧ瀵圭収銆?//
// 鍙ｅ緞锛?//   * 鐜板疄鏃堕棿绐楀彛 = 甯ф暟 脳 20ms锛堝浐瀹氬抚闀匡紝绛変环绋冲畾 50fps锛夛紱30s 绐楀彛 = 1500 甯?//   * 鍚屼竴瀛樻。銆佸悓涓€鐘舵€侊紙Ra.run=true銆侀粦娲炴殏鍋溿€佹棤鍚嶆皬鏈湪鍌ㄥ瓨鐜板疄鏃堕棿锛夛紝姣忎釜鏉′欢閲嶅 REPS 娆?//   * 涓嶅仛浠讳綍璐拱/鏅嬪崌鍐崇瓥锛堢函鏃堕棿鎺ㄨ繘锛夛紝鎺掗櫎鑷姩鍖栦笌璐拱绛栫暐骞叉壈
//   * 璁板綍锛歍eresa / V 鐨勮蹇嗕笌璁板繂鍧楀墠鍚庡€笺€佸閲忋€佺湡瀹炲瓧娈靛閲?vs 閫愬抚鍏紡绱姞銆乵emoryTick 鍏ュ弬
//
// 鐢ㄦ硶锛歯ode exp-ra-memory.mjs [--reps=3] [--window=30]

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const ROOT = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";
const SAVE_FILE = "1000._9.73e14iM+Cel6+1.84e45SG.txt";   // Ra 宸茶В閿併€乀eresa/V 婊＄骇涓旀湁璁板繂杩涘害
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };

const argNum = (k, d) => {
  const hit = process.argv.find(a => a.startsWith(`--${k}=`));
  const v = hit ? Number(hit.split("=")[1]) : NaN;
  return Number.isFinite(v) && v > 0 ? v : d;
};
const REPS = argNum("reps", 3);
const WINDOW_S = argNum("window", 30);
const FRAME_MS = 20;
const FRAMES = Math.round(WINDOW_S * 1000 / FRAME_MS);

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
await new Promise(r => server.listen(8430, "127.0.0.1", r));

const browser = await launchViaConnect({ protocolTimeout: 180000 });
const page = await browser.newPage();
const errs = [];
const NOISE = /googletagmanager|google-analytics|kaspersky-labs/;
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => { if (m.type() === "error" && !NOISE.test(m.text())) errs.push(`CONSOLE: ${m.text().slice(0, 160)}`); });

await page.goto("http://127.0.0.1:8430/index.html", { waitUntil: "load", timeout: 60000 });
let ready = false;
for (let i = 0; i < 80; i++) {
  ready = await page.evaluate(() => {
    try {
      return typeof gameLoop === "function" && typeof Ra === "object" && typeof buyAsManyAsYouCanBuy === "function";
    } catch (e) { return false; }
  }).catch(() => false);
  if (ready) break;
  await new Promise(r => setTimeout(r, 400));
}
if (!ready) {
  console.log("FAIL  娓告垙鏈惎鍔?);
  await browser.close(); server.close();
  process.exit(1);
}
console.log("PASS  娓告垙鍚姩灏辩华");

await page.evaluate(() => {
  const PETS = ["teresa", "v"];
  const ctrl = { calls: 0, argSum: 0, generateChunksTrue: 0, perPet: {} };
  const petOf = key => Ra.pets.all.find(p => p.key === key);

  window.__ra = {
    num(v) { const n = typeof v === "number" ? v : Number(v); return Number.isFinite(n) ? n : NaN; },
    resetCtrl() {
      ctrl.calls = 0; ctrl.argSum = 0; ctrl.generateChunksTrue = 0;
      for (const k of PETS) {
        ctrl.perPet[k] = { calls: 0, argSum: 0, memSum: 0, chunkSum: 0, secondsSum: 0, firstArg: null, lastArg: null };
      }
    },
    ctrl() { return JSON.parse(JSON.stringify(ctrl)); },
    // 鍚屼竴瀛樻。銆佸悓涓€鐘舵€侊紱鍙敼 F
    setup(text, F) {
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      // 鈥斺€?鍥哄畾鏉′欢锛堜袱渚у畬鍏ㄤ竴鑷达級鈥斺€?      player.celestials.ra.run = true;                 // Ra 澶勪簬杩愯鐘舵€?鈫?鍏佽浜х敓璁板繂鍧?      player.blackHolePause = true;                    // 鍐荤粨榛戞礊锛宻peedup 绋冲畾锛屾帓闄ょ浉浣嶆姈鍔?      player.celestials.enslaved.isStoringReal = false; // 鍏佽 generateChunks
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      GameSpeed.set(F);
      this.installHooks();
      this.resetCtrl();
      return this.snap();
    },
    installHooks() {
      for (const k of PETS) {
        const pet = petOf(k);
        if (!pet || pet.__wrapped) continue;
        const orig = pet.tick.bind(pet);
        pet.__origTick = orig;
        pet.tick = (realDiff, generateChunks) => {
          const before = { m: pet.memories, c: pet.memoryChunks };
          const p = ctrl.perPet[k];
          p.calls++;
          p.argSum += realDiff;
          if (p.firstArg === null) p.firstArg = realDiff;
          p.lastArg = realDiff;
          p.secondsSum += realDiff / 1000;
          const ret = orig(realDiff, generateChunks);
          p.memSum += pet.memories - before.m;
          p.chunkSum += pet.memoryChunks - before.c;
          ctrl.calls++;
          ctrl.argSum += realDiff;
          if (generateChunks) ctrl.generateChunksTrue++;
          return ret;
        };
        pet.__wrapped = true;
      }
    },
    snap() {
      const out = { F: (() => { try { return getGlobalSpeedFactor(); } catch (e) { return NaN; } })() };
      for (const k of PETS) {
        const pet = petOf(k);
        out[k] = pet ? {
          level: pet.level,
          memories: this.num(pet.memories),
          chunks: this.num(pet.memoryChunks),
          chunkPS: (() => { try { return this.num(pet.memoryChunksPerSecond); } catch (e) { return NaN; } })(),
          memMult: (() => { try { return this.num(pet.memoryUpgradeCurrentMult); } catch (e) { return NaN; } })(),
          hasRemembrance: !!pet.hasRemembrance,
        } : null;
      }
      out.momentumTime = (() => { try { return this.num(player.celestials.ra.momentumTime); } catch (e) { return NaN; } })();
      out.productionPerChunk = (() => { try { return this.num(Ra.productionPerMemoryChunk); } catch (e) { return NaN; } })();
      out.raRunning = (() => { try { return !!Ra.isRunning; } catch (e) { return null; } })();
      out.raUnlocked = (() => { try { return !!Ra.isUnlocked; } catch (e) { return null; } })();
      out.enslavedStoringReal = (() => { try { return !!Enslaved.isStoringRealTime; } catch (e) { return null; } })();
      out.bhPaused = (() => { try { return !!BlackHoles.arePaused; } catch (e) { return null; } })();
      out.bhActive = (() => { try { return BlackHoles.list.map(h => !!h.isActive); } catch (e) { return null; } })();
      out.speedup = (() => { try { return this.num(getGameSpeedupFactor()); } catch (e) { return NaN; } })();
      return out;
    },
    // 绾椂闂存帹杩涳細涓嶅仛浠讳綍鍐崇瓥锛屽浐瀹氬抚闀?    run(frames, frameMs) {
      for (let i = 0; i < frames; i++) gameLoop(frameMs);
      return this.snap();
    },
  };
});

const e = (v, d = 6) => (Number.isFinite(v) ? v.toExponential(d) : "鈥?);
const saveText = fs.readFileSync(path.join(SAVE_DIR, SAVE_FILE), "utf-8");
console.log(`瀛樻。锛?{SAVE_FILE}`);
console.log(`绐楀彛锛?{WINDOW_S}s 鐜板疄鏃堕棿 = ${FRAMES} 甯?脳 ${FRAME_MS}ms锛堝浐瀹氬抚闀匡紝涓嶅仛浠讳綍璐拱鍐崇瓥锛塦);
console.log(`姣忎釜鏉′欢閲嶅 ${REPS} 娆n`);

const rows = [];
for (const F of [1, 10000]) {
  for (let rep = 1; rep <= REPS; rep++) {
    const s0 = await page.evaluate(({ text, F }) => window.__ra.setup(text, F), { text: saveText, F });
    const t0 = Date.now();
    const s1 = await page.evaluate(({ n, ms }) => window.__ra.run(n, ms), { n: FRAMES, ms: FRAME_MS });
    const realMs = Date.now() - t0;
    const c = await page.evaluate(() => window.__ra.ctrl());
    const row = {
      F, rep, realMs,
      teresa: { dMem: s1.teresa.memories - s0.teresa.memories, dChunk: s1.teresa.chunks - s0.teresa.chunks, before: s0.teresa, after: s1.teresa },
      v: { dMem: s1.v.memories - s0.v.memories, dChunk: s1.v.chunks - s0.v.chunks, before: s0.v, after: s1.v },
      dMomentum: s1.momentumTime - s0.momentumTime,
      ctrl: c,
      state: { s0: { raRunning: s0.raRunning, bhPaused: s0.bhPaused, bhActive: s0.bhActive, enslaved: s0.enslavedStoringReal, speedup: s0.speedup, prod: s0.productionPerChunk },
               s1: { raRunning: s1.raRunning, bhPaused: s1.bhPaused, enslaved: s1.enslavedStoringReal, speedup: s1.speedup, prod: s1.productionPerChunk } },
    };
    rows.push(row);
    console.log(`  F=${String(F).padStart(5)} rep${rep}  Teresa 螖mem=${e(row.teresa.dMem)} (+${e(row.teresa.dMem / row.teresa.before.memories, 3)} 鐩稿)  ` +
      `螖chunk=${e(row.teresa.dChunk)} | V 螖mem=${e(row.v.dMem)} (+${e(row.v.dMem / row.v.before.memories, 3)} 鐩稿)  螖chunk=${e(row.v.dChunk)} | ` +
      `螖momentum=${e(row.dMomentum)} | tick 璋冪敤=${c.calls} 鍏ュ弬鍜?${e(c.argSum)} | 澧欓挓=${(realMs / 1000).toFixed(2)}s`);
  }
}

// 鈥斺€?姹囨€伙細姣斿€?鈥斺€?const agg = (F, key) => {
  const sub = rows.filter(r => r.F === F);
  return {
    dMem: sub.map(r => r[key].dMem),
    dChunk: sub.map(r => r[key].dChunk),
    argSum: sub.map(r => r.ctrl.argSum),
    calls: sub.map(r => r.ctrl.calls),
  };
};
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  鈥?${detail}` : ""}`);
};
const note = t => console.log(`NOTE  ${t}`);

console.log("\n========== 姹囨€?==========");
console.log("     鎸囨爣        F=1 澧為噺(3 娆?                     F=10000 澧為噺(3 娆?                  姣斿€?姣忔)");
const summary = {};
for (const [label, key] of [["Teresa 璁板繂", "teresa"], ["V 璁板繂", "v"]]) {
  const a = agg(1, key), b = agg(10000, key);
  summary[key] = { avg1: a.dMem.reduce((x, y) => x + y, 0) / a.dMem.length,
    avg2: b.dMem.reduce((x, y) => x + y, 0) / b.dMem.length, ratios: a.dMem.map((x, i) => b.dMem[i] / x) };
  console.log(`  ${label.padEnd(10)} ${a.dMem.map(v => e(v, 3)).join(" / ")}`.padEnd(58) +
    `${b.dMem.map(v => e(v, 3)).join(" / ")}`.padEnd(36) +
    summary[key].ratios.map(v => v.toFixed(2)).join(" / "));
}
const rT = summary.teresa.ratios, rV = summary.v.ratios;

console.log("\n========== 鍒ゅ畾 ==========");

// 1) 鐘舵€佸浐瀹氭鏌?const st = rows[0].state.s0;
check("[S1] 涓や釜 F 鐨勫垵濮嬬姸鎬佷竴鑷达紙Ra 杩愯 / 榛戞礊鏆傚仠 / 鏃犲悕姘忔湭鍌ㄥ瓨 / 鍚屼竴瀛樻。锛?,
  rows.every(r => r.state.s0.raRunning === true && r.state.s0.bhPaused === true && r.state.s0.enslaved === false),
  `Ra.run=${st.raRunning} BH鏆傚仠=${st.bhPaused} ENSLAVED鍌ㄥ瓨=${st.enslaved} prod/chunk=${e(st.prod, 3)}`);
check("[S2] 鍏ㄧ▼ Ra 涓€鐩村浜庤繍琛岀姸鎬侊紙璁板繂鍧楀厑璁镐骇鐢燂級",
  rows.every(r => r.state.s1.raRunning === true && r.state.s1.enslaved === false),
  "s1 鍏ㄩ儴 run=true / 鏈偍瀛?);

// 2) F=1 蹇呴』鏈夐潪闆跺閲?const nzT = summary.teresa.avg1 > 0, nzV = summary.v.avg1 > 0;
check("[S3] F=1 涓?Teresa / V 鐨勮蹇嗛兘鏈夐潪闆跺閲忥紙鍏堣瘉鏄庡彲娴嬶紝鍐嶈皥姣斿€硷級",
  nzT && nzV, `Teresa 螖=${e(summary.teresa.avg1)}锛孷 螖=${e(summary.v.avg1)}`);

// 3) 娴偣绮惧害锛氬閲忕浉瀵归噺绾у繀椤昏繙澶т簬 double 鍒嗚鲸鐜囷紙2^-52 鈮?2.2e-16锛?const relT = summary.teresa.avg1 / rows.find(r => r.F === 1).teresa.before.memories;
const relV = summary.v.avg1 / rows.find(r => r.F === 1).v.before.memories;
check("[S4] 澧為噺鐩稿閲忕骇杩滃ぇ浜?double 鍒嗚鲸鐜囷紙>1e-9锛夛紝鎺掗櫎娴偣绮惧害鎶婂閲忓悆鎺?,
  relT > 1e-9 && relV > 1e-9, `Teresa 螖/mem=${e(relT, 3)}锛孷 螖/mem=${e(relV, 3)}`);

// 4) 閲嶅涓€鑷存€?const spread = arr => {
  const mn = Math.min(...arr), mx = Math.max(...arr);
  return mx / mn - 1;
};
check("[S5] 鍚屼竴 F 涓?3 娆￠噸澶嶇殑澧為噺涓€鑷达紙绂绘暎搴?<0.1%锛?,
  spread(summary.teresa.ratios.map((_, i) => rows.filter(r => r.F === 1)[i].teresa.dMem)) < 1e-3 &&
  spread(rows.filter(r => r.F === 10000).map(r => r.teresa.dMem)) < 1e-3,
  `Teresa F=1 绂绘暎 ${(spread(rows.filter(r => r.F === 1).map(r => r.teresa.dMem)) * 100).toFixed(4)}%`);

// 5) 瀛楁澧為噺 vs 鍏紡绱姞锛堝尯鍒?婧愮爜鍏紡"涓?鏈€缁堝瓧娈?锛?const t1 = rows.find(r => r.F === 1);
const teresaFormula = rows.map(r => r.ctrl.perPet.teresa.memSum);
check("[S6] 瀛楁澧為噺 == 閫愬抚鍏紡绱姞鐨?螖memories锛堝悓涓€鍙ｅ緞锛岄潪涓ゆ鐙珛娴嬮噺锛?,
  rows.every((r, i) => Math.abs(r.teresa.dMem / teresaFormula[i] - 1) < 1e-9),
  `鏍蜂緥 F=1: 瀛楁 ${e(t1.teresa.dMem)} vs 閫愬抚绱姞 ${e(t1.ctrl.perPet.teresa.memSum)}`);

// 6) memoryTick 鍏ュ弬锛氶獙璇?sqrt(F) 璺緞
const arg1 = agg(1, "teresa").argSum[0], arg2 = agg(10000, "teresa").argSum[0];
const call1 = agg(1, "teresa").calls[0], call2 = agg(10000, "teresa").calls[0];
const argPerCall1 = arg1 / call1, argPerCall2 = arg2 / call2;
const sqrtF = Math.sqrt(10000);
console.log(`  memoryTick 鍏ュ弬锛欶=1 姣忔璋冪敤 ${argPerCall1.toFixed(3)}ms锛汧=10000 姣忔 ${argPerCall2.toFixed(3)}ms锛涙瘮鍊?${(argPerCall2 / argPerCall1).toFixed(3)}锛坰qrt(F)=${sqrtF}锛塦);
check("[S7] memoryTick 鐨勫叆鍙傛瘮鍊?== sqrt(F)锛堣瘉鏄庤蛋鐨勬槸 realDiff/鈭欶 璺緞锛岃€屼笉鏄函澧欓挓鎴栨暣 F锛?,
  Math.abs(argPerCall2 / argPerCall1 / sqrtF - 1) < 0.02,
  `瀹炴祴 ${(argPerCall2 / argPerCall1).toFixed(2)}脳锛岀悊璁?${sqrtF}脳`);

// 7) 璁板繂澧為噺姣斿€?console.log(`\n  Teresa 璁板繂澧為噺姣旓紙F=10000 / F=1锛夛細${rT.map(v => v.toFixed(2)).join(" / ")}锛堝潎鍊?${(rT.reduce((a, b) => a + b, 0) / rT.length).toFixed(2)}锛塦);
console.log(`  V      璁板繂澧為噺姣旓紙F=10000 / F=1锛夛細${rV.map(v => v.toFixed(2)).join(" / ")}锛堝潎鍊?${(rV.reduce((a, b) => a + b, 0) / rV.length).toFixed(2)}锛塦);
const meanT = rT.reduce((a, b) => a + b, 0) / rT.length;
const meanV = rV.reduce((a, b) => a + b, 0) / rV.length;
check("[S8] Web 鐨勮蹇嗗閲忛殢 F 鏄捐憲鏀惧ぇ锛堣繙澶т簬 1锛?,
  meanT > 10 && meanV > 10, `Teresa ${meanT.toFixed(2)}脳锛孷 ${meanV.toFixed(2)}脳`);
note(`[瀵圭収] Android 鍚屾潯浠跺疄娴嬫瘮鍊间负 Teresa鈮?.0008銆乂鈮?.0007锛堝熀鏈笉鍙?F 褰卞搷锛夛紱` +
  `Web 鏈満瀹炴祴 Teresa鈮?{meanT.toFixed(1)}脳銆乂鈮?{meanV.toFixed(1)}脳锛堚増鈭欶=${sqrtF}锛夈€俙);

// 8) momentumTime 涔熻褰曪紙涓嶅綋浣滀富瑕佽瘉鎹紝浣嗗畠鏄彟涓€鏉¤ F 鏀惧ぇ鐨勮矾寰勶級
const mom1 = rows.find(r => r.F === 1).dMomentum, mom2 = rows.find(r => r.F === 10000).dMomentum;
console.log(`  momentumTime 澧為噺锛欶=1 ${e(mom1)} ms锛汧=10000 ${e(mom2)} ms锛涙瘮鍊?${(mom2 / mom1).toFixed(2)}`);
note(`momentumTime 姣斿€?鈮團锛?{(mom2 / mom1).toFixed(0)}脳锛夎鏄庡畠璧扮殑鏄?realDiff 鏁村€嶆斁澶э紱` +
  `璇ュ瓧娈甸噺绾?${e(mom1)} ms 杩滃ぇ浜庣獥鍙ｅ閲忥紝鏈姤鍛婂彧浣滄梺璇侊紝涓嶄綔涓鸿蹇嗘垚闀跨殑涓昏瘉鎹€俙);

check("[E] 鍏ㄦ祦绋嬫棤鏈崟鑾疯剼鏈紓甯?, errs.length === 0, errs.slice(0, 3).join(" | "));

const out = {
  generatedAt: new Date().toISOString(),
  save: SAVE_FILE, windowS: WINDOW_S, frames: FRAMES, frameMs: FRAME_MS, reps: REPS,
  rows, summary: {
    teresa: { avg1: summary.teresa.avg1, avg2: summary.teresa.avg2, ratios: rT },
    v: { avg1: summary.v.avg1, avg2: summary.v.avg2, ratios: rV },
    argPerCall1, argPerCall2, sqrtF,
  },
  verdict: results, errors: errs,
};
fs.writeFileSync("C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/exp-ra-memory.json", JSON.stringify(out, null, 2));
console.log("\n宸插啓鍏?_research/exp-ra-memory.json");

const pass = results.filter(r => r.ok).length;
console.log(`\n==== 缁撴灉锛?{pass} 閫氳繃 / ${results.length - pass} 澶辫触 ====`);
await browser.close();
server.close();
process.exit(pass === results.length ? 0 : 1);
