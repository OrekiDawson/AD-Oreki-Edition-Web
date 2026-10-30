// 鏃堕棿璇箟锛堜笁锛夛細bestInfinity 鐩存帴鏂█ + Enslaved 閲婃斁甯?+ 鐜板疄鏃堕棿鍌ㄥ瓨涓婇檺
//
// 鍙寮忔牳楠岋細涓嶆敼娓告垙浠ｇ爜銆佷笉鏀瑰钩琛°€?//
// 鐢ㄦ硶: node verify-time-enslaved.mjs [root] [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition");
const port = Number(process.argv[3] || 8230);

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
const notes = [];
const check = (n, p, d = "") => { results.push({ n, p, d }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? "  鈥?" + d : ""}`); };
const note = (n, d) => { notes.push({ n, d }); console.log(`NOTE  ${n}${d ? "  鈥?" + d : ""}`); };
const near = (a, b, eps) => Math.abs(a - b) <= eps;

const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(e.message));
await page.setViewport({ width: 1200, height: 800 });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 6500));

await page.evaluate(() => {
  try { GameIntervals.stop(); } catch (e) { /* ignore */ }
  window.__t = {
    read() {
      const r = player.records;
      return {
        iTime: r.thisInfinity.time,
        iInGame: r.thisInfinity.inGameTime,
        iReal: r.thisInfinity.realTime,
        totalRaw: r.totalTimePlayed,
        totalInGame: r.totalInGameTime,
        totalReal: r.realTimePlayed,
        bestInf: r.bestInfinity.time,
        bestInfReal: r.bestInfinity.realTime,
        stored: player.celestials.enslaved.stored,
        storedReal: player.celestials.enslaved.storedReal,
      };
    },
    delta(a, b) { const o = {}; for (const k of Object.keys(a)) o[k] = b[k] - a[k]; return o; },
    setF(v) { GameSpeed.set(v); },
    F() { return getGlobalSpeedFactor(); },
    unlockEnslaved() {
      if (!Enslaved.isUnlocked) player.celestials.effarig.unlockBits |= (1 << EffarigUnlock.eternity.id);
      return Enslaved.isUnlocked;
    },
  };
});

console.log("\n鐜: 鍏ㄦ柊寮€灞€锛屽凡鍋滄帀鎵€鏈?interval\n");

// ================= A. bestInfinity.time 鐩存帴鏂█ =================
console.log("=== A. bestInfinity.time 鐩存帴鏂█锛堜笉缁?UI锛?==");
const bestInf = await page.evaluate(() => {
  const t = window.__t;
  const out = [];
  for (const F of [1, 10000]) {
    t.setF(F);
    const R = 90000;                       // 鐜板疄 90 绉?    player.records.thisInfinity.time = R * F;
    player.records.thisInfinity.inGameTime = R;
    player.records.thisInfinity.realTime = R;
    player.records.thisInfinity.maxAM = Decimal.NUMBER_MAX_VALUE;   // 璁?Player.canCrunch 鎴愮珛
    player.records.bestInfinity.time = 999999999999;
    player.records.bestInfinity.realTime = 999999999999;
    const expectGame = inGameTimeOf(player.records.thisInfinity);
    bigCrunchReset(true);
    out.push({
      F: t.F(), R,
      expectGame,
      bestTime: player.records.bestInfinity.time,
      bestReal: player.records.bestInfinity.realTime,
      // 閲嶇疆鍚庢湰娆¤褰曞簲娓呴浂
      afterResetTime: player.records.thisInfinity.time,
      afterResetInGame: player.records.thisInfinity.inGameTime,
    });
  }
  t.setF(1);
  return out;
});
for (const x of bestInf) {
  console.log(`  F=${String(x.F).padStart(6)}: bestInfinity.time=${x.bestTime}  bestInfinity.realTime=${x.bestReal}  鏈熸湜 ${x.expectGame}`);
}
check("[A1] F=1 鏃?bestInfinity.time = inGameTimeOf(thisInfinity)锛? 瀹樻柟 time锛?,
  near(bestInf[0].bestTime, bestInf[0].expectGame, 1e-6), String(bestInf[0].bestTime));
check("[A2] F=10000 鏃?bestInfinity.time 鍚屾牱绛変簬 inGameTime锛屼笉琚€嶇巼姹℃煋",
  near(bestInf[1].bestTime, bestInf[1].expectGame, 1e-6) && near(bestInf[1].bestTime, 90000, 1e-6),
  String(bestInf[1].bestTime));
check("[A3] 涓ょ F 涓?bestInfinity.time 瀹屽叏鐩稿悓锛堝悓涓€娈电幇瀹炴椂闂达級",
  near(bestInf[0].bestTime, bestInf[1].bestTime, 1e-6),
  `${bestInf[0].bestTime} vs ${bestInf[1].bestTime}`);
check("[A4] bestInfinity.realTime 璁板綍鐨勬槸鐜板疄鏃堕棿锛屼袱绉?F 涓嬮兘鏄?90000",
  near(bestInf[0].bestReal, 90000, 1e-6) && near(bestInf[1].bestReal, 90000, 1e-6),
  `${bestInf[0].bestReal} / ${bestInf[1].bestReal}`);
check("[A5] Big Crunch 鍚庢湰娆¤鏃剁殑 time 涓?inGameTime 涓€璧峰綊闆?,
  bestInf.every(x => x.afterResetTime === 0 && x.afterResetInGame === 0));

// ================= B. Enslaved 閲婃斁甯э紙鐪熷疄璧?useStoredTime 鈫?gameLoop锛?================
console.log("\n=== B. Enslaved 閲婃斁鍌ㄥ瓨鐨勬父鎴忔椂闂达紙F=1 / F=10000锛?==");
const release = await page.evaluate(() => {
  const t = window.__t;
  // 娉ㄦ剰锛氶噴鏀捐矾寰勪笉鏍￠獙 Enslaved.isUnlocked锛坈anRelease 鍙湅鍌ㄥ瓨/鎸戞垬/鏈棩鐘舵€侊級锛?  // 鎵€浠ヨ繖閲屼笉寮鸿瑙ｉ攣 Effarig锛岄伩鍏嶈Е鍙?upstream 鐨?eternitiedGain 绫诲瀷闂锛堣鎶ュ憡 搂6 闄勬敞锛夈€?  player.challenge.eternity.current = 0;
  player.celestials.enslaved.isStoringReal = false;
  player.celestials.enslaved.isStoring = false;
  player.celestials.pelle.doomed = false;

  const out = [];
  for (const F of [1, 10000]) {
    t.setF(F);
    const S = 1e9;                                     // 鍌ㄥ瓨鐨勬父鎴忔椂闂达紙姣锛?    player.celestials.enslaved.stored = S;
    const canRelease = Enslaved.canRelease(false);
    Enslaved.useStoredTime(false);                     // 鐪熷疄閲婃斁鍏ュ彛
    const nextTick = Enslaved.nextTickDiff;
    const isRelease = Enslaved.isReleaseTick;
    const storedAfterRelease = player.celestials.enslaved.stored;
    const before = t.read();
    gameLoop(1);                                       // 閲婃斁甯э細passDiff=1 鈫?realDiff = 1脳F
    const after = t.read();
    out.push({
      F: t.F(), S, canRelease, nextTick, isRelease, storedAfterRelease,
      d: t.delta(before, after),
      releasedStillPending: Enslaved.isReleaseTick,
    });
  }
  t.setF(1);
  return { skipped: false, out };
});

if (release.skipped) {
  check("[B] Enslaved 閲婃斁甯э紙鏃犳硶瑙ｉ攣 Enslaved锛屾祴璇曡烦杩囷級", false, "unlock 澶辫触");
} else {
  for (const x of release.out) {
    console.log(`  F=${String(x.F).padStart(6)}: nextTickDiff=${x.nextTick}  螖time=${x.d.time || x.d.iTime}  螖inGame=${x.d.iInGame}  螖real=${x.d.iReal}`);
  }
  check("[B1] 閲婃斁鍏ュ彛鎶婂偍瀛橀噺鍘熸牱鏀捐繘 nextTickDiff锛坈lampMax 1e300 涓嶇敓鏁堬級",
    release.out.every(x => x.nextTick === x.S), release.out.map(x => x.nextTick).join(" / "));
  check("[B2] 閲婃斁鍚?stored 琚竻绌?, release.out.every(x => x.storedAfterRelease === 0));
  check("[B3] 閲婃斁甯ф湰韬笉鍐嶈鏍囪涓?release锛堝抚鏈浣嶏級", release.out.every(x => x.releasedStillPending === false));
  check("[B4] 螖thisInfinity.time = 鍌ㄥ瓨鐨勬父鎴忔椂闂达紙F=1 涓?F=10000 閮芥槸 1e9锛?,
    release.out.every(x => near(x.d.iTime, 1e9, 1e-3)),
    release.out.map(x => x.d.iTime).join(" / "));
  check("[B5] 螖thisInfinity.inGameTime = 鍌ㄥ瓨閲?/ F锛團=1 寰?1e9锛孎=10000 寰?1e5锛?,
    near(release.out[0].d.iInGame, 1e9, 1e-3) && near(release.out[1].d.iInGame, 1e5, 1e-3),
    release.out.map(x => x.d.iInGame).join(" / "));
  check("[B6] 閲婃斁甯х殑鐜板疄鏃堕棿鍙寜澧欓挓 1ms 绱锛屼笉琚€嶇巼鏀惧ぇ",
    release.out.every(x => near(x.d.iReal, 1, 1e-6)),
    release.out.map(x => x.d.iReal).join(" / "));
  check("[B7] 瀛樻。绾?totalTimePlayed / totalInGameTime 涓庢湰娆″彛寰勪竴鑷?,
    near(release.out[0].d.totalRaw, 1e9, 1e-3) && near(release.out[1].d.totalRaw, 1e9, 1e-3) &&
    near(release.out[1].d.totalInGame, 1e5, 1e-3));
  note("[B-缁撹] 閲婃斁閲忔槸銆屾父鎴忔椂闂淬€嶅崟浣嶏細螖time 涓?F 鏃犲叧锛涜€?inGameTime锛? 瀹樻柟 time 绛変环閲忥級鍦?F=10000 涓嬫槸 1e5锛?
    + "杩欎笌銆?e9 鍌ㄥ瓨鏄湪 F=10000 涓嬫敀鍑烘潵鐨勶紙绛変环浜庡畼鏂圭殑 1e5锛夈€嶅畬鍏ㄨ嚜娲?);
}

// ================= C. 鐜板疄鏃堕棿鍌ㄥ瓨锛氫笂闄愪笌 F 鏃犲叧 =================
console.log("\n=== C. 鍌ㄥ瓨鐜板疄鏃堕棿锛氫笂闄愬父閲忎笌濉厖鏄惁鍙?F 褰卞搷 ===");
const realStore = await page.evaluate(() => {
  const t = window.__t;
  // 鍌ㄥ瓨鐜板疄鏃堕棿瑕佹眰 Enslaved 宸茶В閿侊紱瑙ｉ攣 Effarig.eternity 鍚庯紝upstream 鐨?passivePrestigeGen
  // 浼氳蛋 eternitiedGain 鍒嗘敮锛堝彉閲忓垵鍊兼槸 Number 0锛屽彧鏈変拱鍒?RUPG14 鎵嶄細鍙樻垚 Decimal锛夛紝
  // 鍥犳杩欓噷鍚屾椂鎶?RUPG14 鐨勪綅鎵撳紑锛屼繚鎸佽繍琛岀幆澧冭嚜娲斤紙涓嶆敼浠讳綍鏃堕棿閫昏緫锛夈€?  t.unlockEnslaved();
  player.reality.upgradeBits |= (1 << RealityUpgrade(14).id);
  const caps = {
    timeCap: Enslaved.timeCap,
    storedRealTimeCap: Enslaved.storedRealTimeCap,
    efficiency: Enslaved.storedRealTimeEfficiency,
  };
  const out = [];
  for (const F of [1, 10000]) {
    t.setF(F);
    player.celestials.enslaved.storedReal = 0;
    player.celestials.enslaved.isStoring = false;
    player.celestials.enslaved.isStoringReal = true;
    const storing = Enslaved.isStoringRealTime;
    player.lastUpdate = Date.now() - 200;             // 鐪熷疄澧欓挓 200ms
    const before = t.read();
    gameLoop();
    const after = t.read();
    player.celestials.enslaved.isStoringReal = false;
    player.lastUpdate = Date.now();
    out.push({ F: t.F(), storing, d: t.delta(before, after) });
  }
  t.setF(1);
  return { caps, out };
});
console.log("  涓婇檺甯搁噺:", JSON.stringify(realStore.caps));
for (const x of realStore.out) {
  console.log(`  F=${String(x.F).padStart(6)}: 螖storedReal=${x.d.storedReal.toFixed(1)}  螖real=${x.d.totalReal.toFixed(1)}  螖raw=${x.d.totalRaw}`);
}
check("[C1] 娓告垙鏃堕棿鍌ㄥ瓨涓婇檺 timeCap = 1e300锛堟父鎴忔绉掑父閲忥紝涓嶆槸鏃堕暱锛?,
  realStore.caps.timeCap === 1e300, String(realStore.caps.timeCap));
check("[C2] 鐜板疄鏃堕棿鍌ㄥ瓨涓婇檺 = 8 灏忔椂锛?8,800,000 鐜板疄姣锛? Ra 鍔犳垚",
  realStore.caps.storedRealTimeCap === 1000 * 3600 * 8, String(realStore.caps.storedRealTimeCap));
check("[C3] 鐜板疄鏃堕棿鍌ㄥ瓨鏁堢巼 0.7", realStore.caps.efficiency === 0.7);
check("[C4] 濉厖鎸夊閽燂細F=1 涓?F=10000 涓?200ms 閮藉緱鍒?鈮?40ms 鍌ㄥ瓨锛?.7 鏁堢巼锛?,
  realStore.out.every(x => near(x.d.storedReal, 140, 12)),
  realStore.out.map(x => x.d.storedReal.toFixed(1)).join(" / "));
check("[C5] 鐜板疄鏃堕棿鍌ㄥ瓨鏈熼棿涓嶄骇鐢熸父鎴忔椂闂达紙涓ょ F 涓?螖totalTimePlayed 閮?= 0锛?,
  realStore.out.every(x => near(x.d.totalRaw, 0, 1e-6)),
  realStore.out.map(x => x.d.totalRaw).join(" / "));
check("[C6] 鐜板疄鏃堕棿鎸夊閽?200ms 绱锛屼笉琚€嶇巼鏀惧ぇ",
  realStore.out.every(x => near(x.d.totalReal, 200, 25)),
  realStore.out.map(x => x.d.totalReal.toFixed(1)).join(" / "));

check("[D] 鍏ㄦ祦绋嬫棤鏈崟鑾疯剼鏈紓甯?, errs.length === 0, errs.slice(0, 3).join(" | "));

const pass = results.filter(r => r.p).length;
console.log(`\n==== 缁撴灉: ${pass} 閫氳繃 / ${results.length - pass} 澶辫触 / ${notes.length} 鏉＄粨璁哄娉?====`);
await browser.close();
server.close();
process.exit(pass === results.length ? 0 : 1);
