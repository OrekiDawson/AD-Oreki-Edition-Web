// 鏃堕棿璇箟锛堜簩锛夛細RUPG22 / RUPG23 / EU6 / IU 鐨勬椂闂磋緭鍏ョ幇鐘跺揩鐓?//
// 鈿狅笍 鐘舵€佽鏄庯紙2026-10-26 绗笁杞級锛?//   鐢ㄦ埛宸叉妸椤圭洰鏈€楂樼洰鏍囨敼涓恒€屾渶澶у寲缂╃煭鐜板疄閫氬叧鏃堕棿銆嶅苟**鏆傜紦** Q1/Q2锛圧UPG22銆丒U6锛変慨澶嶃€?//   鐢熶骇浠ｇ爜宸插洖婊氬埌鍩虹嚎 470d0e8锛屾湰鑴氭湰鍥犳鏀逛负**鐜扮姸蹇収**锛?//   鏂█鐨勭洰鏍囦笉鏄€屼笌瀹樻柟涓€鑷淬€嶏紝鑰屾槸銆岀簿纭煡閬撶幇鍦ㄧ敤鐨勬槸浠€涔堝彛寰勩€佹斁澶у灏戝€嶃€嶏紝
//   浠ヤ究璇勪及銆屼繚鐣欐斁澶?= 鏈夋晥鍔犻€熴€嶈繕鏄€岄渶瑕侀噸鏂拌璁°€嶃€?//
// 棰勬湡鍊间竴寰嬬敱鏈剼鏈?*鐙珛璁＄畻**锛堝彧鐢ㄥ畼鏂瑰叕寮?+ 鑷繁璁惧畾鐨勮緭鍏ワ級锛?// 涓嶈皟鐢ㄧ敓浜т唬鐮侀噷鐨?inGameTimeOf / totalInGameTimeMs 鏉ョ畻鏈熸湜鍊笺€?//
// 鐢ㄦ硶: node verify-time-rupg.mjs [root] [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition");
const port = Number(process.argv[3] || 8220);

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
const note = (n, d = "") => { notes.push({ n, d }); console.log(`NOTE  ${n}${d ? "  鈥?" + d : ""}`); };
const rel = (a, b) => Math.abs(a - b) / Math.max(1, Math.abs(b));

// 鈥斺€?鐙珛鍙傝€冨疄鐜帮紙鐓ф妱瀹樻柟鍏紡锛屼笉寮曠敤鐢熶骇浠ｇ爜锛夆€斺€?const MS_PER_DAY = 86400000;                       // 涓?TimeSpan.totalDays = _ms / 864e5 鍚屽紡
const official22 = days => Math.pow(10, Math.pow(1 + 2 * Math.log10(days + 1), 1.6));
const eu6Normal = days => Math.max(days, 1);
const eu6Doomed = days => 1 + days;

const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(e.message));
await page.setViewport({ width: 1200, height: 800 });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 6500));

await page.evaluate(() => {
  try { GameIntervals.stop(); } catch (e) { /* ignore */ }
  window.__r = {
    current22() { return RealityUpgrade(22).effectValue.toNumber(); },
    rupg23Effect() { return Number(RealityUpgrade(23).effectValue); },
    eu6() { const v = EternityUpgrade.tdMultRealTime.effectValue; return v && v.toNumber ? v.toNumber() : Number(v); },
    // 鐩存帴鎽嗙姸鎬侊細time / realTime / inGameTime 涓夎€呴兘鏄惧紡缁欏嚭
    setReality(realMs, F) {
      player.records.thisReality.realTime = realMs;
      player.records.thisReality.time = realMs * F;
      player.records.thisReality.inGameTime = realMs;
    },
    setTotal(realMs, F) {
      player.records.totalTimePlayed = realMs * F;
      player.records.totalInGameTime = realMs;
    },
    // 鍙鍘熷瀛楁锛堜笉缁?inGameTimeOf锛?    rawInGameMs() { return player.records.thisReality.inGameTime; },
    rawTimeMs() { return player.records.thisReality.time; },
    bestReality(ms) { player.records.bestReality.time = ms; },
    gateNow() { return Time.thisReality.totalMinutes / getGlobalSpeedFactor() < 15; },
    gateOfficialEquiv() { return player.records.thisReality.inGameTime / 60000 < 15; },
    setF(v) { GameSpeed.set(v); },
    F() { return getGlobalSpeedFactor(); },
    doomed(v) { player.celestials.pelle.doomed = v; },
    runFrame(d = 1) { gameLoop(d); },
  };
});

console.log("\n鐜: 鍏ㄦ柊寮€灞€锛屽凡鍋滄帀鎵€鏈?interval锛屾墜鍔ㄦ帶甯?);
console.log("鍙ｅ緞: 鐜扮姸蹇収锛圦1/Q2 宸叉寜鐢ㄦ埛瑕佹眰鏆傜紦锛屼唬鐮佸洖婊氬埌 470d0e8锛塡n");

// ================= A. RUPG22 鐜扮姸 =================
console.log("=== A. RUPG22銆岃秴瓒婃椂鍏夈€嶏細鐜扮姸杈撳叆 = records.thisReality.time锛堟湭鍓?F锛?==");
const FS = [1, 2, 137, 10000];
const REAL_SECS = [600, 3600];
const rupg22 = await page.evaluate(({ fs, secs }) => {
  const r = window.__r;
  const out = [];
  for (const F of fs) {
    for (const s of secs) {
      r.setF(F);
      r.setReality(s * 1000, F);
      out.push({ F, eff: r.F(), realMs: s * 1000, current: r.current22() });
    }
  }
  return out;
}, { fs: FS, secs: REAL_SECS });

console.log("    F  瀹為檯F  鐜板疄(鍒嗛挓)   鐜扮姸 effect    瀹樻柟鍙ｅ緞(鐪熷疄澶╂暟)  鐜扮姸/瀹樻柟");
const rowsA = rupg22.map(x => {
  const realDays = x.realMs / MS_PER_DAY;
  return {
    ...x, realDays,
    official: official22(realDays),                      // 瀹樻柟鍦?F=1 绛変环鍙ｅ緞
    scaledByF: official22(x.realMs * x.eff / MS_PER_DAY), // 鐜扮姸搴斿綋绛変簬杩欎釜
    doubleDiv: official22(x.realMs / x.eff / MS_PER_DAY),
    msAsDays: official22(x.realMs),
  };
});
for (const x of rowsA) {
  console.log(`  ${String(x.F).padStart(5)} ${String(x.eff).padStart(6)}  ${String(x.realMs / 60000).padStart(9)}  ${x.current.toExponential(4).padStart(13)}  ${x.official.toExponential(4).padStart(18)}  ${(x.current / x.official).toExponential(3)}`);
}

check("[A1] F=1 鏃剁幇鐘?= 瀹樻柟鍏紡(鐪熷疄澶╂暟)锛團=1 鏃犳斁澶э紝杩欐槸鍘熺増閿氱偣锛?,
  rel(rowsA.filter(x => x.F === 1)[0].current, rowsA.filter(x => x.F === 1)[0].official) < 1e-9);
check("[A2] 浠绘剰 F 涓嬬幇鐘?= 瀹樻柟鍏紡(F 脳 鐪熷疄澶╂暟) 鈥斺€?绮剧‘鍒荤敾銆岃緭鍏ヨ F 鏀惧ぇ銆?,
  rowsA.every(x => rel(x.current, x.scaledByF) < 1e-9),
  rowsA.map(x => `F${x.F}:${rel(x.current, x.scaledByF).toExponential(1)}`).join(" "));
check("[A3] 鏀惧ぇ鏂瑰悜姝ｇ‘锛欶 瓒婂ぇ effect 瓒婂ぇ锛堝崟璋冧笉鍑忥級",
  [600, 3600].every(s => {
    const g = rowsA.filter(x => x.realMs === s * 1000).map(x => x.current);
    return g.every((v, i) => i === 0 || v >= g[i - 1] - 1e-9);
  }));
check("[A4] 涓嶆槸銆岄噸澶嶉櫎 F銆嶏細鐜扮姸 鈮?瀹樻柟鍏紡(澶╂暟/F)",
  rowsA.filter(x => x.F > 1).every(x => rel(x.current, x.doubleDiv) > 1e-6));
check("[A5] 涓嶆槸銆屽ぉ/姣娣锋穯銆嶏細鐜扮姸 鈮?瀹樻柟鍏紡(姣褰撳ぉ鏁?",
  rowsA.every(x => rel(x.current, x.msAsDays) > 1e-6));
note(`[A-缁撹] RUPG22 鐜扮姸 = 鏃堕棿缁村害鍊嶇巼璇汇€屽惈 F 鐨勬父鎴忔椂闂淬€嶏紝瀹為檯鏀惧ぇ ${(rowsA.find(x => x.F === 10000 && x.realMs === 600000).current / rowsA.find(x => x.F === 10000 && x.realMs === 600000).official).toExponential(2)} 鍊嶏紙F=10000銆佺幇瀹?10 鍒嗛挓锛塦);

// ================= B. RUPG23锛堟湭鏀癸紝绛変环锛?================
console.log("\n=== B. RUPG23銆屽揩閫熷鐜般€嶏細闂ㄦ涓庢晥鏋滐紙涓庡畼鏂圭瓑浠凤紝鏈彈褰卞搷锛?==");
const rupg23 = await page.evaluate((fs) => {
  const r = window.__r;
  const out = [];
  for (const F of fs) {
    for (const realMin of [5, 10, 14.9, 15.1, 20]) {
      r.setF(F);
      r.setReality(realMin * 60000, F);
      r.bestReality(realMin * 60000);
      out.push({ F, realMin, gateNow: r.gateNow(), gateOff: r.gateOfficialEquiv(), effect: r.rupg23Effect() });
    }
  }
  return out;
}, FS);
let gateAllEqual = true;
for (const x of rupg23) if (x.gateNow !== x.gateOff) gateAllEqual = false;
check(`[B1] RUPG23 闂ㄦ鍦?F=${FS.join("/")} 涓嬩笌瀹樻柟鍒ゅ畾涓€鑷达紙${rupg23.length} 缁勶級`, gateAllEqual);
check("[B2] RUPG23 鏁堟灉鍙緷璧?bestReality锛堝凡褰掍竴鍖栵級锛屼笌 F 鏃犲叧",
  [5, 10, 14.9, 15.1, 20].every(m => {
    const g = rupg23.filter(x => x.realMin === m).map(x => x.effect);
    return g.every(v => rel(v, g[0]) < 1e-12);
  }));
check("[B3] 鏁堟灉绗﹀悎瀹樻柟 15/clamp(minutes, 1/12, 15)",
  rupg23.every(x => rel(x.effect, 15 / Math.min(Math.max(x.realMin, 1 / 12), 15)) < 1e-9));

// ================= C. 鏃у瓨妗?/ 鍘嗗彶鍊嶇巼 =================
console.log("\n=== C. 鏃у瓨妗ｅ垵濮嬪寲涓庡巻鍙插€嶇巼鍙樺寲 ===");
const legacy = await page.evaluate(() => {
  const r = window.__r;
  const out = {};
  r.setF(10000);
  r.setReality(600000, 10000);
  player.records.thisReality.inGameTime = 0;
  r.runFrame(1);
  out.sameFactor = { inGameMs: r.rawInGameMs(), timeMs: r.rawTimeMs(), effect: r.current22() };
  r.setF(10000);
  r.setReality(600000, 100);
  player.records.thisReality.inGameTime = 0;
  r.runFrame(1);
  out.historyFactor = { inGameMs: r.rawInGameMs(), timeMs: r.rawTimeMs(), effect: r.current22() };
  r.setF(1);
  r.setReality(600000, 1);
  r.runFrame(1);
  const base = r.current22();
  r.setF(10000);
  r.runFrame(1);
  out.midSwitch = { effectRatio: r.current22() / base };
  r.setF(1);
  return out;
});
console.log("  C1:", JSON.stringify(legacy.sameFactor));
console.log("  C2:", JSON.stringify(legacy.historyFactor));
console.log("  C3:", JSON.stringify(legacy.midSwitch));
check("[C1] 鏃у瓨妗ｉ甯цˉ榻愬悗 inGameTime = time/F锛堝巻鍙叉亽瀹氬亣璁炬垚绔嬶級",
  rel(legacy.sameFactor.inGameMs, 600000) < 1e-3, String(legacy.sameFactor.inGameMs));
check("[C2] 鍘嗗彶鍊嶇巼鈮犲綋鍓嶅€嶇巼鏃?inGameTime 鍩哄噯缂╁皬锛堟澶?100 鍊嶏級鈥斺€斿凡鐭ヨ繎浼?,
  Math.abs(legacy.historyFactor.inGameMs / 600000 - 0.01) < 5e-4,
  `ratio=${(legacy.historyFactor.inGameMs / 600000).toFixed(6)}`);
check("[C3] 涓€旀敼鍊嶇巼涓嶉噸绠楀巻鍙诧紙1ms 澧欓挓鍐?effect 鍙樺寲 < 0.1%锛?,
  legacy.midSwitch.effectRatio < 1.001 && legacy.midSwitch.effectRatio > 0.999,
  legacy.midSwitch.effectRatio.toFixed(6));
check("[C4] 鐜扮姸 effect 鐢卞師濮?time 鍐冲畾锛堜笌 inGameTime 鐨勮ˉ榻愬亸宸棤鍏筹級",
  rel(legacy.historyFactor.effect, official22(legacy.historyFactor.timeMs / MS_PER_DAY)) < 1e-6,
  `${legacy.historyFactor.effect.toFixed(4)} vs ${official22(legacy.historyFactor.timeMs / MS_PER_DAY).toFixed(4)}`);
note("[C-鍚箟] 鏃у瓨妗ｇ殑銆屽熀鍑嗚繎浼笺€嶅彧褰卞搷 inGameTime锛堢粺璁′笌鏈鏈惎鐢ㄧ殑淇锛夛紝涓嶆薄鏌?RUPG22 鐜扮姸鏀剁泭");

// ================= D. EU6 鐜扮姸锛堜袱鍒嗘敮锛?================
console.log("\n=== D. EU6銆宼dMultRealTime銆嶏細闈炴湯鏃?/ 鏈棩涓ゅ垎鏀幇鐘?===");
const REAL_MS_EU = 2 * MS_PER_DAY;
const eu6 = await page.evaluate(({ fs, realMs }) => {
  const r = window.__r;
  const out = [];
  for (const F of fs) {
    r.setF(F);
    r.doomed(false);
    r.setTotal(realMs, F);
    out.push({ F, branch: "normal", eff: r.F(), current: r.eu6() });
    r.doomed(true);
    const eff = r.F();
    r.setReality(realMs, eff);
    out.push({ F, branch: "doomed", eff, current: r.eu6() });
    r.doomed(false);
  }
  r.setF(1);
  r.doomed(false);
  r.setTotal(60000, 1);
  out.push({ F: 1, branch: "normal", eff: 1, current: r.eu6(), floor: true });
  r.setF(1);
  return out;
}, { fs: FS, realMs: REAL_MS_EU });

const realDaysEU = REAL_MS_EU / MS_PER_DAY;
const rowsD = eu6.map(x => {
  const official = x.floor ? 1 : (x.branch === "normal" ? eu6Normal(realDaysEU) : eu6Doomed(realDaysEU));
  const scaledByEff = x.branch === "normal" ? eu6Normal(realDaysEU * x.eff) : eu6Doomed(realDaysEU * x.eff);
  const doubleDiv = x.branch === "normal" ? eu6Normal(realDaysEU / x.eff) : eu6Doomed(realDaysEU / x.eff);
  const msAsDays = x.branch === "normal" ? eu6Normal(REAL_MS_EU) : eu6Doomed(REAL_MS_EU);
  return { ...x, official, scaledByEff, doubleDiv, msAsDays };
});
console.log("    F  瀹為檯F  鍒嗘敮      鐜扮姸 effect   瀹樻柟鍙ｅ緞   鐜扮姸/瀹樻柟   閲嶅闄鍊?);
for (const x of rowsD) {
  console.log(`  ${String(x.F).padStart(5)} ${String(x.eff).padStart(6)}  ${(x.floor ? "normal*" : x.branch).padEnd(8)} ${x.current.toExponential(4).padStart(11)} ${x.official.toExponential(3).padStart(9)}  ${(x.current / x.official).toExponential(3).padStart(9)}  ${x.doubleDiv.toExponential(3).padStart(9)}`);
}
const realRows = rowsD.filter(x => !x.floor);
check("[D1] 闈炴湯鏃ュ垎鏀幇鐘?= max(鐪熷疄澶╂暟 脳 F, 1)锛堣 F 绾挎€ф斁澶э級",
  realRows.filter(x => x.branch === "normal").every(x => rel(x.current, x.scaledByEff) < 1e-9),
  realRows.filter(x => x.branch === "normal").map(x => `F${x.F}:${x.current}`).join(" "));
check("[D2] 鏈棩鍒嗘敮鐜扮姸 = 1 + 鐪熷疄澶╂暟 脳 瀹為檯F锛堝疄闄匜 鍦ㄦ湯鏃ユ槸 鈭欶锛?,
  realRows.filter(x => x.branch === "doomed").every(x => rel(x.current, x.scaledByEff) < 1e-9),
  realRows.filter(x => x.branch === "doomed").map(x => `F${x.F}:${x.current.toFixed(3)}`).join(" "));
check("[D3] 鏈棩鍒嗘敮淇濈暀 +1 缁撴瀯锛堜笉浼氶€€鍖栨垚闈炴湯鏃ュ叕寮忥級",
  realRows.filter(x => x.branch === "doomed").every(x => rel(x.current, eu6Normal(realDaysEU)) > 1e-6));
check("[D4] 涓ゆ敮閮戒笉鏄€岄噸澶嶉櫎 F銆?,
  realRows.filter(x => x.F > 1).every(x => rel(x.current, x.doubleDiv) > 1e-6));
check("[D5] 涓ゆ敮閮戒笉鏄€屽ぉ/姣娣锋穯銆?,
  realRows.every(x => rel(x.current, x.msAsDays) > 1e-6));
check("[D6] 闈炴湯鏃ョ殑 max(...,1) 涓嬮檺浠嶄繚鐣欙細鐜板疄 1 鍒嗛挓 鈫?1脳",
  rel(rowsD.find(x => x.floor).current, 1) < 1e-9);
note("[D-缁撹] EU6 鐜扮姸鎶?鈭欶 ~ F 涔樿繘鏃堕棿缁村害鍊嶇巼锛汧=10000 鏃堕潪鏈棩 20000脳銆佹湯鏃?201脳锛堝畼鏂瑰垎鍒?2脳 涓?3脳锛?);

// ================= E. IU19 / IU202 鐜扮姸 =================
console.log("\n=== E. IU19 / IU202 鐜扮姸锛堝悓鏍疯鏈墺 F 鐨勬椂闂达級===");
const iu = await page.evaluate(() => {
  const r = window.__r;
  const num = v => (v && typeof v.toNumber === "function") ? v.toNumber() : Number(v);
  const out = [];
  for (const F of [1, 2, 137, 10000]) {
    r.setF(F);
    player.records.totalTimePlayed = 60 * 60000 * F;
    player.records.thisInfinity.time = 3 * 60000 * F;
    player.records.thisInfinity.inGameTime = 3 * 60000;
    out.push({
      F: r.F(),
      totalTimeMult: num(InfinityUpgrade.totalTimeMult.effectValue),
      thisInfinityTimeMult: num(InfinityUpgrade.thisInfinityTimeMult.effectValue),
    });
  }
  r.setF(1);
  return out;
});
for (const x of iu) {
  console.log(`  F=${String(x.F).padStart(6)}: totalTimeMult=${x.totalTimeMult.toFixed(4)}脳  thisInfinityTimeMult=${x.thisInfinityTimeMult.toFixed(4)}脳`);
}
const iuTotalRef = Math.pow(60 / 2, 0.15);
const iuInfRef = Math.max(Math.pow(3 / 4, 0.25), 1);
check("[E1] IU19 totalTimeMult = (鐜板疄鍒嗛挓 脳 F / 2)^0.15锛堢幇鐘讹細琚箓娆℃斁澶э級",
  iu.every(x => rel(x.totalTimeMult, Math.pow(60 * x.F / 2, 0.15)) < 1e-9),
  iu.map(x => `F${x.F}:${(x.totalTimeMult / iuTotalRef).toFixed(2)}脳`).join(" "));
check("[E2] IU202 thisInfinityTimeMult = max((鐜板疄鍒嗛挓 脳 F / 4)^0.25, 1)锛堢幇鐘讹細琚箓娆℃斁澶э級",
  iu.every(x => rel(x.thisInfinityTimeMult, Math.max(Math.pow(3 * x.F / 4, 0.25), 1)) < 1e-9),
  iu.map(x => `F${x.F}:${(x.thisInfinityTimeMult / iuInfRef).toFixed(2)}脳`).join(" "));
note("[E-缁撹] IU 鐨勬斁澶ф槸骞傛鍨嬶紙0.15 / 0.25锛夛紝F=10000 鏃跺垎鍒?3.98脳 / 9.31脳锛屾槸鐪熷疄鐢熶骇鍊嶇巼鑰岄潪鏄剧ず鍊?);

check("[F] 鍏ㄦ祦绋嬫棤鏈崟鑾疯剼鏈紓甯?, errs.length === 0, errs.slice(0, 3).join(" | "));

const pass = results.filter(r => r.p).length;
console.log(`\n==== 缁撴灉: ${pass} 閫氳繃 / ${results.length - pass} 澶辫触 / ${notes.length} 鏉＄粨璁?====`);
await browser.close();
server.close();
process.exit(pass === results.length ? 0 : 1);
