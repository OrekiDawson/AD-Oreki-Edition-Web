// 閫氬叧鏃堕棿鍩虹嚎锛堝彧璇伙紝涓嶆敼鏈哄埗锛?
//
// 鐩殑锛氱粰銆岀埥鐜┿€嶇洰鏍囧缓绔?*鍙鐜?*鐨勫垎闃舵鍩哄噯銆備骇鍑轰袱绫绘暟鎹細
//   Part 1銆屾柊瀛樻。 鈫?棣栦釜鏃犻檺銆嶏細鑷姩璐績鐜╁锛岃褰曞埌杈鹃涓棤闄愭墍闇€鐨勫抚鏁帮紙鈫?澧欓挓鎺ㄧ畻鍊硷級
//   Part 2銆岄樁娈靛熀绾裤€嶏細浠庝唬琛ㄦ€у瓨妗ｅ嚭鍙戯紝鍥哄畾澧欓挓棰勭畻鍐呯殑璧勬簮/鏅嬪崌/閲岀▼纰戝彉鍖?
//
// 鈿狅笍 鍙ｅ緞澹版槑锛堝繀椤讳笌鐪熷疄璁℃椂鍖哄垎锛夛細
//   路 鏈剼鏈敤**鍥哄畾 20ms passDiff** 鎵嬪姩椹卞姩 gameLoop锛岀瓑浠蜂簬銆岀ǔ瀹?50fps銆嶇殑鐞嗘兂杩愯銆?
//   路 鍥犳銆屽閽?鎺ㄧ畻) = 甯ф暟 脳 20ms銆嶆槸**鎺ㄧ畻鍊?*锛屼笉鏄湡瀹炴祻瑙堝櫒璁℃椂锛?
//     鐪熷疄鐜杩樺彈涓荤嚎绋嬮樆濉炪€侀〉闈㈠悗鍙拌妭娴併€佸抚鐜囨尝鍔ㄥ奖鍝嶃€?
//   路 娓告垙鏃堕棿(ms) 鏉ヨ嚜 records.totalTimePlayed锛屾槸鐪熷疄绱姞鍊笺€?
//
// 鐢ㄦ硶: node baseline-progression.mjs [root] [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition");
const port = Number(process.argv[3] || 8270);
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";
const FRAME_MS = 20;
// Part 1锛堟柊瀛樻。鈫掗涓棤闄愶級闇€瑕佷竴濂楀畬鏁寸殑寮€灞€绛栫暐椹卞姩锛屾湰杞湭瀹屾垚 鈫?榛樿璺宠繃
const RUN_PART1 = !process.argv.includes("--no-fresh");

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
  protocolTimeout: 600000,
});
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 800 });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
// 绛夊緟娓告垙鐪熸鍚姩锛堝叏灞€绗﹀彿鎸傝浇瀹屾垚锛夛紝鏈€澶?30s锛涜秴鏃跺垯鏁翠綋澶辫触
// 娉ㄦ剰锛氭湰椤圭洰鐨勫叏灞€鏄敤 `let/const` 鎸傚湪銆屽叏灞€璇嶆硶鐜銆嶉噷鐨勶紙涓嶆槸 window 灞炴€э級锛?
// 涓?page.waitForFunction 閲屾嬁涓嶅埌杩欎簺璇嶆硶缁戝畾锛屾墍浠ョ敤 Node 渚ц疆璇?page.evaluate 鎺㈡祴銆?
let ready = false;
for (let i = 0; i < 60; i++) {
  ready = await page.evaluate(() => {
    try {
      return typeof gameLoop === "function" &&
        typeof Currency === "function" &&
        typeof buyAsManyAsYouCanBuy === "function" &&
        typeof player === "object";
    } catch (e) {
      return false;
    }
  }).catch(() => false);
  if (ready) break;
  await new Promise(r => setTimeout(r, 500));
}
if (!ready) {
  console.error("FAIL  娓告垙鏈湪 30s 鍐呭畬鎴愬惎鍔紙gameLoop / Currency / buyAsManyAsYouCanBuy / player 鏈氨缁級");
  await browser.close();
  server.close();
  process.exit(1);
}
await new Promise(r => setTimeout(r, 500));
console.log("PASS  娓告垙鍚姩灏辩华锛坓ameLoop / Currency / player 宸叉寕杞斤級");

// 娉ㄥ叆閫氱敤璇诲彇鍣ㄤ笌璐績绛栫暐
await page.evaluate(() => {
  window.__b = {
    lg(v) {
      // Decimal 鐢?log10() 鍙栫簿纭寚鏁帮紝閬垮厤 toNumber() 婧㈠嚭鎴?Infinity
      if (v && typeof v.log10 === "function") {
        const d = v.log10();
        const n = d && d.toNumber ? d.toNumber() : Number(d);
        return Number.isFinite(n) ? n : NaN;
      }
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? Math.log10(n) : NaN;
    },
    num(v) {
      const n = v && v.toNumber ? v.toNumber() : Number(v);
      return Number.isFinite(n) ? n : NaN;
    },
    snap() {
      const safe = fn => { try { return fn(); } catch (e) { return undefined; } };
      return {
        game: player.records.totalTimePlayed,
        real: player.records.realTimePlayed,
        amLog: this.lg(Currency.antimatter.value),
        ipLog: this.lg(Currency.infinityPoints.value),
        epLog: this.lg(Currency.eternityPoints.value),
        rmLog: this.lg(Currency.realityMachines.value),
        inf: this.num(Currency.infinities.value),
        eter: this.num(Currency.eternities.value),
        real: player.records.realTimePlayed,
        realities: safe(() => this.num(Currency.realities.value)),
        galaxies: this.num(player.galaxies),
        dimBoosts: this.num(player.dimensionBoosts),
        speedup: safe(() => getGameSpeedupFactor()),
        bh: safe(() => BlackHoles.areUnlocked && !BlackHoles.arePaused),
        dilation: safe(() => !!player.dilation.active),
        doomed: safe(() => Pelle.isDoomed),
        gameEnd: safe(() => GameEnd.endState),
        ach188: safe(() => Achievement(188).isUnlocked),
      };
    },
    // 璐績璐拱锛氱淮搴?1-8 涔版渶澶с€佽鏁伴鐜囦拱鏈€澶с€佺淮搴︽彁鍗?鏄熺郴鑳戒拱灏变拱
    greedy(aggressive = false) {
      // 娉ㄦ剰锛歜uyMaxDimension 鐨勫墠缃槸銆岃兘涓€娆′拱鍒?10 涓€嶏紝寮€灞€鍙湁 10 AM 鏃朵細鐩存帴 return锛?
      // 鎵€浠ュ紑灞€蹇呴』鐢?buyAsManyAsYouCanBuy锛堣兘涔板嚑涓拱鍑犱釜锛夈€?
      for (let t = 1; t <= 8; t++) {
        try { buyAsManyAsYouCanBuy(t); } catch (e) { /* 鏈В閿?*/ }
      }
      try { buyMaxTickSpeed(); } catch (e) { /* ignore */ }
      // 姝ｇ‘ API锛欴imBoost.canBeBought / Galaxy.canBeBought锛堜笉鏄?canBuyDimensionBoost()锛?
      try { if (DimBoost.canBeBought) requestDimensionBoost(1); } catch (e) { /* ignore */ }
      try { if (Galaxy.canBeBought) requestGalaxyReset(1); } catch (e) { /* ignore */ }
      if (aggressive) {
        try { if (Player.canCrunch) bigCrunchReset(); } catch (e) { /* ignore */ }
        try { if (Player.canEternity) eternityResetRequest(); } catch (e) { /* ignore */ }
      }
    },
    // 鍏ㄦ柊寮€灞€锛堢嫭绔嬪壇鏈級锛岃繑鍥炶捣鐐瑰揩鐓?
    setupFresh(F) {
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      if (!window.__freshText) window.__freshText = GameSaveSerializer.serialize(player);
      player = GameSaveSerializer.deserialize(window.__freshText);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      GameSpeed.set(F);
      window.__freshStart = this.snap();
      return window.__freshStart;
    },
    // 鍒嗙墖鎺ㄨ繘锛氳窇 n 甯ц椽蹇冿紝杩斿洖鏈€鏂扮姸鎬?
    step(n, frameMs, aggressive = true) {
      for (let i = 0; i < n; i++) {
        this.greedy(aggressive);
        gameLoop(frameMs);
      }
      const s = this.snap();
      return {
        inf: s.inf, amLog: s.amLog, galaxies: s.galaxies, dimBoosts: s.dimBoosts,
        game: s.game, real: s.real,
      };
    },
  };
});

// ============ Part 1锛氭柊瀛樻。 鈫?棣栦釜鏃犻檺 ============
let part1MeasurementOk = null;   // null = 鏈繍琛岋紱true/false = 娴嬮噺鏄惁缁欏嚭纭畾缁撹
let freshRows = null;            // Part 1 缁撴灉锛堜緵钀界洏锛?
if (RUN_PART1) {
console.log("========== Part 1锛氭柊瀛樻。 鈫?棣栦釜鏃犻檺锛堝悓涓€澧欓挓棰勭畻锛岃椽蹇冭嚜鍔ㄧ帺瀹讹級 ==========");
console.log("鍙ｅ緞锛氬浐瀹?20ms/甯э紙= 绋冲畾 50fps 鐨勫閽熶唬鐞嗭級銆備笁涓?F 缁欍€愬悓鏍风殑甯ф暟棰勭畻銆戯紝");
console.log("      鍗冲悓鏍风殑鐜板疄鏃堕棿棰勭畻锛涙瘮杈冪殑鏄€屽悓鏍风幇瀹炴椂闂村唴璋佸厛鍒拌揪閲岀▼纰戙€嶃€?);
console.log("      甯ф暟鏄閽熶唬鐞嗭紝涓嶆槸鐪熷疄璁℃椂锛涗笉鍚?F 鐨勩€庢父鎴忔椂闂淬€忓垪闀垮害涓嶅悓锛屼笉鍙í鍚戞瘮杈冦€?);
console.log("");

const FRAMES_PER_F = (() => {
  const arg = process.argv.find(a => a.startsWith("--frames="));
  const v = arg ? Number(arg.split("=")[1]) : NaN;
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 20000;   // 20000 甯?= 400s 澧欓挓浠ｇ悊
})();
const CHUNK = 100;

console.log(`姣?F 澧欓挓棰勭畻锛?{FRAMES_PER_F} 甯э紙${(FRAMES_PER_F * FRAME_MS / 1000).toFixed(0)}s 澧欓挓浠ｇ悊锛塦);
console.log("     F   缁撴灉              甯ф暟(澧欓挓浠ｇ悊)  澧欓挓(s)   鍒拌揪鏃舵父鎴忔椂闂?s)  AM(log10)  鏄熺郴/缁村害鎻愬崌");
freshRows = [];
for (const F of [1, 1000, 10000]) {
  const start = await page.evaluate((F) => window.__b.setupFresh(F), F);
  const cap = FRAMES_PER_F;
  let frames = 0, reached = false, last = null, hitGame = 0;
  const t0 = Date.now();
  while (frames < cap) {
    const n = Math.min(CHUNK, cap - frames);
    last = await page.evaluate(({ n, frameMs }) => window.__b.step(n, frameMs), { n, frameMs: FRAME_MS });
    frames += n;
    if (Number.isFinite(last.inf) && last.inf > 0) { reached = true; hitGame = last.game - start.game; break; }
  }
  const elapsed = Date.now() - t0;
  const gameMs = reached ? hitGame : (last ? last.game - start.game : 0);
  const r = {
    F, reached, frames, frameCap: cap,
    wallMs: frames * FRAME_MS,
    gameMs,
    amLog: last ? last.amLog : NaN,
    galaxies: last ? last.galaxies : NaN,
    dimBoosts: last ? last.dimBoosts : NaN,
    simMs: elapsed,
  };
  freshRows.push(r);
  const gs = `${(r.gameMs / 1000).toExponential(3)}`;
  console.log(`  ${String(F).padStart(6)} ${r.reached ? "PASS 宸插埌杈?     " : "鏈埌杈?瓒呴绠?  "}` +
    ` ${String(r.frames).padStart(10)} ${(r.wallMs / 1000).toFixed(1).padStart(9)}` +
    `  ${(r.reached ? gs : "鈥?).padStart(16)}  ${String(r.amLog?.toFixed(2)).padStart(10)}` +
    `  ${String(r.galaxies)}/${String(r.dimBoosts)}   [妯℃嫙鑰楁椂 ${(elapsed / 1000).toFixed(1)}s]`);
}

// 鈥斺€?鍒ゅ畾 鈥斺€?
// 鍒嗕袱绾э紝閬垮厤鎶娿€屾祴閲忔垚鍔熴€嶅拰銆屼笉鍙橀噺鎴愮珛銆嶆贩鎴愪竴涓?FAIL锛?
//   娴嬮噺鍒ゅ畾锛氭瘡涓?F 蹇呴』缁欏嚭纭畾缁撹锛堝埌杈?/ 鏄庣‘瓒呴绠楋級锛屼笉寰楄緭鍑烘棤娉曞垽瀹氭垚璐ョ殑鏁板瓧
//   涓嶅彉閲忓垽瀹氾細鈶?鍒拌揪鐨?F 涔嬮棿锛屽抚鏁帮紙澧欓挓锛夐殢 F 鍗曡皟涓嶅
//               鈶?鍒拌揪鐨?F 涔嬮棿锛屽埌杈炬椂鐨勩€庢父鎴忔椂闂淬€忓簲澶ц嚧鐩稿悓锛團 鍙帇鏃堕挓锛屼笉璇ユ敼鍙樻父鎴忓唴杩涚▼锛?
const allDeterminate = freshRows.length === 3 && (freshRows.every(r => r.reached === true) || freshRows.some(r => r.reached === false));
const reachedRows = freshRows.filter(r => r.reached);
console.log("");
part1MeasurementOk = allDeterminate;
console.log(`  [娴嬮噺] 涓変釜 F 鍧囩粰鍑虹‘瀹氱粨璁猴紙鍒拌揪甯ф暟 / 鏄庣‘瓒呴绠楋級锛?{allDeterminate ? "PASS" : "FAIL"}`);
if (reachedRows.length >= 2) {
  const g = reachedRows.map(r => r.gameMs / 1000);
  const spread = Math.max(...g) / Math.min(...g);
  const framesDesc = reachedRows.every((r, i, a) => i === 0 || a[i - 1].frames >= r.frames);
  const invOk = spread <= 3;
  console.log(`  [P1-a] 鍒拌揪鏃舵父鎴忔椂闂达細${reachedRows.map(r => `F=${r.F}:${(r.gameMs / 1000).toExponential(3)}s`).join("  ")}` +
    `  鈫?鏋佸樊 ${spread.toFixed(2)}脳锛堥槇鍊?3脳锛?{invOk ? "PASS" : "FAIL"}`);
  console.log(`  [P1-b] 甯ф暟锛堝閽熶唬鐞嗭級闅?F 鍗曡皟涓嶅锛?{reachedRows.map(r => `${r.F}:${r.frames}`).join(" ")}  ${framesDesc ? "PASS" : "FAIL"}`);
  if (!invOk) {
    console.log(`         瑙ｈ锛氭瘡甯ф帹杩涚殑娓告垙鏃堕棿 = 20ms 脳 F锛孎=10000 鏃朵竴甯?= ${(20 * 10000 / 1000).toFixed(0)}s 娓告垙鏃堕棿锛宍);
    console.log("               閲囪喘/鏅嬪崌姣忓抚鍙窇涓€娆?鈫?楂?F 涓嬪喅绛栫矑搴﹀彉绮楋紝闇€瑕佹洿澶氭父鎴忔椂闂存墠鑳芥帹杩涘悓涓€閲岀▼纰戙€?);
    console.log("               杩欐槸**鏈哄埗鍙戠幇**锛堜笉鏄祴閲忓櫔澹帮級锛氶珮 F 鐨勬敹鐩婁笉鏄嚎鎬х殑锛屽ぉ鑺辨澘鏉ヨ嚜鎸夊抚瑙﹀彂鐨勯噰璐€?);
  }
} else {
  console.log(`  [P1-a/P1-b] 鏃犳硶鍒ゅ畾锛氬彧鏈?${reachedRows.length} 涓€嶇巼鍦ㄩ绠楀唴鍒拌揪锛堜笉鍙橀噺妫€鏌ヨ嚦灏戦渶瑕?2 涓級`);
}
const notReached = freshRows.filter(r => !r.reached);
if (notReached.length) {
  console.log(`  鏈埌杈剧殑鍊嶇巼锛堟槑纭涓轰笂鐣岋紝涓嶅綋杩涘害浣跨敤锛夛細${notReached.map(r => `F=${r.F} 鍦?${(r.frameCap * FRAME_MS / 1000)}s 澧欓挓鍐呮湭鍒拌揪`).join("锛?)}`);
}
} else {
  console.log("========== Part 1锛氭柊瀛樻。 鈫?棣栦釜鏃犻檺 ==========");
  console.log("宸叉寜 --no-fresh 璺宠繃锛堝彧璺?Part 2 鐨勯樁娈靛熀绾匡級銆傚幓鎺夎鍙傛暟鍗冲彲璺?Part 1銆?);
}

// ============ Part 2锛氶樁娈靛熀绾?============
const STAGES = [
  { key: "S1-preinf", file: "29._2AG+9DB+1e50AM.txt", name: "鏃犻檺鍓嶏紙2 AG / 9 DB锛? },
  { key: "S2-eternity", file: "132._9.1e137IP.txt", name: "姘告亽鏈燂紙9.1e137 IP锛? },
  { key: "S3-2R", file: "729._2R+6.9e19EP+167TT.txt", name: "2 娆＄幇瀹? },
  { key: "S4-endgame", file: "1123._Endgame.txt", name: "缁堝眬瀛樻。" },
];
const BUDGET_FRAMES = 500;   // 10s 澧欓挓锛堟帹绠楋級

console.log("\n\n========== Part 2锛氶樁娈靛熀绾匡紙鍥哄畾 10s 澧欓挓棰勭畻锛?==========");
console.log(`姣忔牸锛毼攍og10(涓昏祫婧? 锛涙湯灏鹃噷绋嬬鐘舵€乗n`);

const stageRows = [];
for (const st of STAGES) {
  const saveText = fs.readFileSync(path.join(SAVE_DIR, st.file), "utf-8");
  console.log(`--- ${st.key}锛?{st.name}锛?{st.file}锛?--`);
  console.log("     F   螖log10(IP)  螖log10(EP)  螖log10(RM)   螖鏃犻檺      螖姘告亽      螖鐜板疄     鏈熬 speedup  BH婵€娲? 鑶ㄨ儉  鏈棩  缁堝眬鎬? 鍙樺姩甯?);
  for (const F of [1, 10000]) {
    const r = await page.evaluate((text, F, frameMs, frames, greedy) => {
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      GameSpeed.set(F);
      const b = window.__b;
      const s0 = b.snap();
      let resets = 0;
      for (let i = 0; i < frames; i++) {
        const i0 = b.num(Currency.infinities.value);
        const e0 = b.num(Currency.eternities.value);
        if (greedy) b.greedy(false);   // 鍙拱涓嶉噸缃紝閬垮厤娴嬭瘯鑴氭湰鑷韩鍒堕€犺礋澧為暱
        gameLoop(frameMs);
        const i1 = b.num(Currency.infinities.value);
        const e1 = b.num(Currency.eternities.value);
        if ((Number.isFinite(i1) && Number.isFinite(i0) && i1 !== i0) ||
            (Number.isFinite(e1) && Number.isFinite(e0) && e1 !== e0)) resets++;
      }
      const s1 = b.snap();
      GameSpeed.set(1);
      const d = (a, c) => (Number.isFinite(a) && Number.isFinite(c)) ? a - c : NaN;
      return {
        F,
        dIp: d(s1.ipLog, s0.ipLog), dEp: d(s1.epLog, s0.epLog), dRm: d(s1.rmLog, s0.rmLog),
        dInf: d(s1.inf, s0.inf), dEter: d(s1.eter, s0.eter), dReal: d(s1.realities, s0.realities),
        dGame: s1.game - s0.game,
        resets,
        end: s1,
      };
    }, saveText, F, FRAME_MS, BUDGET_FRAMES, true);
    stageRows.push({ stage: st.key, ...r, name: st.name });
    const e2 = v => (Number.isFinite(v) ? v.toExponential(2) : "鈥?);
    console.log(`  ${String(F).padStart(6)} ${e2(r.dIp).padStart(11)} ${e2(r.dEp).padStart(11)} ${e2(r.dRm).padStart(11)} ${e2(r.dInf).padStart(9)} ${e2(r.dEter).padStart(9)} ${e2(r.dReal).padStart(9)} ${String(r.end.speedup?.toExponential(2) ?? "鈥?).padStart(12)} ${String(r.end.bh).padStart(7)} ${String(r.end.dilation).padStart(5)} ${String(r.end.doomed).padStart(5)} ${String(Number(r.end.gameEnd).toFixed(2)).padStart(6)}  ${String(r.resets).padStart(4)}`);
  }
}

// 钀界洏锛屼究浜庝笅娆″鐓?
const out = {
  generatedAt: new Date().toISOString(),
  frameMs: FRAME_MS,
  part1_fresh: RUN_PART1 ? freshRows : null,
  part1_measurement: part1MeasurementOk,
  part2_stages: stageRows,
};
const outFile = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/baseline-progression.json";
fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
console.log(`\n宸插啓鍏ュ熀绾挎暟鎹細${outFile}`);

console.log("\n========== 鍒よ鎻愰啋 ==========");
console.log("路 Part 1 鐨勩€屽閽?鎺ㄧ畻)銆? 甯ф暟 脳 20ms锛屾槸 50fps 鐞嗘兂鍊硷紝涓嶆槸鐪熷疄娴忚鍣ㄨ鏃躲€?);
console.log("路 Part 2 鐨勯绠楀浐瀹氫负 10s 澧欓挓锛?*涓嶅悓闃舵/涓嶅悓 F 鐨?螖 鍙兘涓庡悓闃舵鐨勫彟涓€ F 姣?*锛?);
console.log("  涓嶈兘妯悜姣旇緝涓嶅悓闃舵锛屼篃涓嶈兘鎶娿€屾父鎴忔椂闂存帹杩涙洿澶氥€嶅綋鎴愩€岄€氬叧鏇村揩銆嶃€?);
console.log("路 甯у唴鍙湁涓€娆?greedy()锛屾墍浠ラ珮 F 涓嬭嚜鍔ㄤ拱鐩稿娓告垙鏃堕棿鏄€屾瘡 F 姣涓€娆°€嶏紝鏈熀绾垮凡鍥哄畾杩欎竴鐐广€?);

const exitCode = part1MeasurementOk === false ? 1 : 0;
console.log("");
console.log(`鎬讳綋锛歅art1 娴嬮噺=${part1MeasurementOk === null ? "璺宠繃" : (part1MeasurementOk ? "PASS" : "FAIL")}锛沗 +
  `閫€鍑虹爜=${exitCode}锛堜笉鍙橀噺 FAIL 鍙綔涓烘満鍒跺彂鐜帮紝涓嶅崟鐙垽澶辫触锛塦);

await browser.close();
server.close();
process.exit(exitCode);
