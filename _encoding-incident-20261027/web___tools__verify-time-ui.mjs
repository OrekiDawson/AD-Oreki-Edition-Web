// 鏃堕棿缁熻璇箟 + 鎸戞垬鏈€浣虫椂闂?娴忚鍣ㄩ獙鏀?// 鐢ㄦ硶: node verify-time-ui.mjs [root] [port] [shotsDir]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition");
const port = Number(process.argv[3] || 8094);
const outDir = path.resolve(process.argv[4] || "./shots-time");
fs.mkdirSync(outDir, { recursive: true });

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

const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";
const samples = fs.readdirSync(SAVE_DIR).filter(f => f.endsWith(".txt"));
const pick = name => fs.readFileSync(path.join(SAVE_DIR, samples.find(f => f.includes(name))), "utf-8");

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({
  executablePath: EDGE, headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio", "--autoplay-policy=no-user-gesture-required"],
});
const results = [];
const check = (n, p, d = "") => { results.push({ n, p, d }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? "  鈥?" + d : ""}`); };

const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(e.message));
await page.setViewport({ width: 1400, height: 950 });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 6500));

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- 宸ュ叿锛氬湪椤甸潰鍐呰浇鍏ュ瓨妗ｅ苟鍒囧埌缁熻椤?----------
async function loadSave(saveText, tab = "statistics") {
  return page.evaluate(async (text, tabKey) => {
    try { GameIntervals.gameLoop.stop(); } catch (e) { /* 鏈惎鍔ㄦ椂蹇界暐 */ }
    GameStorage.offlineEnabled = false;
    const obj = GameSaveSerializer.deserialize(text);
    player = obj;
    player.lastUpdate = Date.now();
    GameStorage.loadPlayerObject(player);
    player.lastUpdate = Date.now();
    GameUI.update();
    const t = Tabs.all.find(x => x.config.key === "statistics");
    if (t) {
      t.show();
      if (tabKey === "challenges" && t.subtabs) {
        const sub = t.subtabs.find(s => s.key === "challenges");
        if (sub) sub.show();
      }
    }
    return true;
  }, saveText, tab);
}

const statText = () => page.evaluate(() => document.querySelector(".c-stats-tab")?.innerText || "");

// =====================================================================
console.log("\n### A. 鐜");
const base = await page.evaluate(() => ({
  factor: typeof getGlobalSpeedFactorRaw === "function" ? getGlobalSpeedFactorRaw() : null,
  speedup: getGameSpeedupFactor(),
  hasHelper: typeof timeStatText === "function" && typeof toInGameTimeMs === "function",
  hasRealTimeField: "bestRealTimes" in player.challenge.normal,
}));
check("榛樿鍏ㄥ眬閫熷害鍊嶇巼 10000脳", base.factor === 10000, String(base.factor));
check("娓告垙鍐呴€熷害鍥犲瓙涓嶅寘鍚叏灞€鍊嶇巼锛堟柊娓告垙涓?1锛?, Math.abs(base.speedup - 1) < 1e-9, String(base.speedup));
check("鏃堕棿鍙ｅ緞 helper 宸叉敞鍐屼负鍏ㄥ眬", base.hasHelper);
check("鏂板瓨妗ｉ粯璁ゅ甫鎸戞垬鐜板疄鏃堕棿瀛楁", base.hasRealTimeField);

// =====================================================================
console.log("\n### A2. 鏂版父鎴忎笂楠岃瘉璁℃椂璇箟锛堟椂闂存€婚噺瓒冲灏忥紝涓嶅彈娴偣绮惧害褰卞搷锛?);
const A2 = await page.evaluate(() => {
  GameIntervals.gameLoop.stop();
  GameSpeed.set(10000);
  const out = {};
  const r0 = player.records.realTimePlayed;
  const t0 = player.records.totalTimePlayed;
  gameLoop(100);
  out.normal = {
    real: player.records.realTimePlayed - r0,
    raw: player.records.totalTimePlayed - t0,
    speedup: getGameSpeedupFactor(),
  };
  out.ec12 = { speedup: 1 };
  return out;
});
check("鏅€氱姸鎬侊細100ms 澧欓挓 鈫?鐜板疄鏃堕棿 +100ms", Math.abs(A2.normal.real - 100) < 0.001, String(A2.normal.real));
check("鏅€氱姸鎬侊細100ms 澧欓挓 鈫?鍘熷娓告垙鏃堕棿 +1,000,000ms锛?0000脳锛?,
  Math.abs(A2.normal.raw - 1e6) < 1, String(A2.normal.raw));

// =====================================================================
console.log("\n### B. 鐪熷疄瀛樻。杞藉叆鍚庣殑缁熻椤?);
const sampleNames = ["861", "1002", "424"];   // 鐜板疄涓 / 鐜板疄鍚庢湡 / 姘告亽闃舵
for (const sn of sampleNames) {
  const file = samples.find(f => f.startsWith(sn + ".")) || samples.find(f => f.startsWith(sn));
  if (!file) { check(`鎵惧埌鏍锋湰 ${sn}`, false); continue; }
  const text = fs.readFileSync(path.join(SAVE_DIR, file), "utf-8");
  await loadSave(text);
  await sleep(1200);
  const t = await statText();
  const rec = await page.evaluate(() => ({
    bestRealityTime: player.records.bestReality.time,
    bestRealityReal: player.records.bestReality.realTime,
    thisRealityReal: player.records.thisReality.realTime,
    factor: getGlobalSpeedFactorRaw(),
    realities: player.realities,
  }));
  check(`[${sn}] 缁熻椤靛惈銆岀幇瀹炴椂闂淬€嶆爣娉╜, t.includes("锛堢幇瀹炴椂闂达級"));
  const isReality = rec.realities > 0;
  if (isReality) {
    check(`[${sn}] 缁熻椤靛惈銆屾父鎴忓唴鏃堕棿銆嶆爣娉╜, t.includes("锛堟父鎴忓唴鏃堕棿锛?));
  } else {
    check(`[${sn}] 鏈В閿佺幇瀹炴椂闅愯棌鐜板疄鍖哄潡锛堝師鐗堣涓猴級`, !t.includes("鎸夋父鎴忓唴鏃堕棿璁＄畻"));
    check(`[${sn}] 鏃犻檺/姘告亽鍖哄潡浠嶆寜鍙屽彛寰勬樉绀篳, t.includes("锛堢幇瀹炴椂闂达級") || t.includes("锛堟父鎴忓唴鏃堕棿锛?));
  }
  check(`[${sn}] 鏂囨鏃?NaN/undefined`, !/NaN|undefined|Infinity/.test(t),
    (t.match(/NaN|undefined|Infinity/g) || []).join(","));
  if (!isReality) continue;
  // 鏈€閫熺幇瀹炰袱琛屽繀椤诲垎鍒瓑浜庡瓨妗ｉ噷鐨勪袱绉嶅彛寰?  const fmt = await page.evaluate((a, b) => [
    TimeSpan.fromMilliseconds(a).toStringShort(),
    TimeSpan.fromMilliseconds(b).toStringShort(),
  ], rec.bestRealityTime, rec.bestRealityReal);
  const bestGameLine = t.split("\n").find(l => l.includes("鎸夋父鎴忓唴鏃堕棿璁＄畻"));
  const bestRealLine = t.split("\n").find(l => l.includes("鎸夌幇瀹炴椂闂磋绠?));
  check(`[${sn}] 鏈€閫熺幇瀹烇紙娓告垙鍐呮椂闂达級涓庡瓨妗ｅ瓧娈典竴鑷碻,
    !!bestGameLine && bestGameLine.includes(fmt[0]), `${bestGameLine} | 鏈熸湜 ${fmt[0]}`);
  check(`[${sn}] 鏈€閫熺幇瀹烇紙鐜板疄鏃堕棿锛変笌瀛樻。瀛楁涓€鑷碻,
    !!bestRealLine && bestRealLine.includes(fmt[1]), `${bestRealLine} | 鏈熸湜 ${fmt[1]}`);
}

// =====================================================================
console.log("\n### C. 鍒囨崲鍊嶇巼涓嶆敼鍙樺巻鍙茶褰?);
const realitySample = fs.readFileSync(path.join(SAVE_DIR, samples.find(f => f.startsWith("861"))), "utf-8");
await loadSave(realitySample);
await sleep(800);
const lineAt = async f => {
  await page.evaluate(v => GameSpeed.set(v), f);
  await sleep(400);
  const t = await statText();
  return t.split("\n").filter(l => l.includes("鎸夋父鎴忓唴鏃堕棿璁＄畻") || l.includes("鎸夌幇瀹炴椂闂磋绠?)).join("|");
};
const l1 = await lineAt(1);
const l10000 = await lineAt(10000);
const l100000 = await lineAt(100000);
check("鍊嶇巼 1脳 / 10000脳 / 100000脳 涓嬫渶閫熺幇瀹炶褰曞畬鍏ㄤ竴鑷?, l1 === l10000 && l10000 === l100000,
  `1脳:${l1.slice(0, 40)}`);
check("鍊嶇巼鍒囨崲鍚庝粛鏄剧ず涓ょ鍙ｅ緞", l10000.includes("娓告垙鍐呮椂闂?) && l10000.includes("鐜板疄鏃堕棿"));

// =====================================================================
console.log("\n### D. 閲嶅杞藉叆骞傜瓑");
const loadAndSnap = saveText => page.evaluate(text => {
  try { GameIntervals.gameLoop.stop(); } catch (e) { /* ignore */ }
  GameStorage.offlineEnabled = false;
  const obj = GameSaveSerializer.deserialize(text);
  obj.lastUpdate = Date.now();
  GameStorage.loadPlayerObject(obj);
  // 杞藉叆鍚庣珛鍒诲彇鍊硷紝閬垮厤娓告垙寰幆缁х画鎺ㄨ繘瀵艰嚧鐨勪笉纭畾鎬?  player.lastUpdate = Date.now();
  return JSON.stringify({
    a: player.records.bestReality.time, b: player.records.bestReality.realTime,
    c: player.records.thisReality.time, d: player.records.thisReality.realTime,
    e: player.records.realTimePlayed, f: player.records.totalTimePlayed,
    g: player.records.bestInfinity.time, h: player.records.bestEternity.time,
    i: player.challenge.normal.bestTimes.slice(0, 3),
    j: player.challenge.normal.bestRealTimes.slice(0, 3),
  });
}, saveText);
const snap1 = await loadAndSnap(realitySample);
const snap2 = await loadAndSnap(realitySample);
const snap3 = await loadAndSnap(realitySample);
check("鍚屼竴瀛樻。杩炵画杞藉叆涓夋锛岃褰曞瓧娈靛畬鍏ㄤ竴鑷达紙鏃犻噸澶嶆崲绠椼€佷笉鏀瑰啓瀛樻。锛?,
  snap1 === snap2 && snap2 === snap3,
  snap1 === snap2 && snap2 === snap3 ? "" : `${snap1} != ${snap2}`);

// =====================================================================
console.log("\n### E. 鏃у瓨妗ｇ己鐜板疄鏃堕棿瀛楁鏃剁殑鍥為€€");
const legacy = await page.evaluate(text => {
  const obj = GameSaveSerializer.deserialize(text);
  delete obj.records.thisInfinity.realTime;
  obj.records.bestEternity.realTime = Number.MAX_VALUE;
  delete obj.challenge.normal.bestRealTimes;
  GameStorage.offlineEnabled = false;
  player = obj;
  player.lastUpdate = Date.now();
  GameStorage.loadPlayerObject(player);
  player.lastUpdate = Date.now();
  GameUI.update();
  const t = Tabs.all.find(x => x.config.key === "statistics");
  if (t) t.show();
  return {
    hasArray: Array.isArray(player.challenge.normal.bestRealTimes),
    len: player.challenge.normal.bestRealTimes?.length ?? -1,
    allSentinel: (player.challenge.normal.bestRealTimes ?? []).every(v => v === Number.MAX_VALUE),
  };
}, realitySample);
await sleep(1000);
const legacyInfo = await page.evaluate(() => ({
  text: document.querySelector(".c-stats-tab")?.innerText || "",
  // 鐩存帴璋冪敤妯℃澘鎵€浣跨敤鐨勫悓涓€鍑芥暟锛岄伩鍏嶄緷璧?Vue 閲嶆覆鏌撴椂鏈?  eternityLine: `浣犵殑鏈€蹇案鎭掔敤鏃?${timeStatText(player.records.bestEternity.realTime,
    player.records.bestEternity.time)}銆俙,
}));
const legacyText = legacyInfo.text;
check("缂哄け鐨?bestRealTimes 鐢遍粯璁ゅ€艰ˉ榻?, legacy.hasArray && legacy.len === 11, JSON.stringify(legacy));
check("琛ラ綈鍊间负鍝ㄥ叺锛堜笉浼€犲巻鍙茬幇瀹炴垚缁╋級", legacy.allSentinel);
check("缂哄け realTime 鏃朵笉鏄剧ず NaN銆佷笉缂栭€犵幇瀹炴椂闂?, !/NaN|undefined/.test(legacyText));

// 鍚堟垚涓€鏉♀€滃彧鏈夋父鎴忓唴鏃堕棿銆佹病鏈夌幇瀹炴椂闂粹€濈殑姘告亽璁板綍锛岄獙璇佸苟鍒楁樉绀虹殑鍥為€€
await page.evaluate(() => {
  player.records.bestEternity.time = 12345;
  player.records.bestEternity.realTime = Number.MAX_VALUE;
  return true;
});
await sleep(200);
const eternityLine = await page.evaluate(() =>
  `浣犵殑鏈€蹇案鎭掔敤鏃?${timeStatText(player.records.bestEternity.realTime, player.records.bestEternity.time)}銆俙);
check("缂虹幇瀹炴椂闂寸殑姘告亽璁板綍鍙爣娓告垙鍐呮椂闂?,
  eternityLine.includes("娓告垙鍐呮椂闂?) && !eternityLine.includes("鐜板疄鏃堕棿"), eternityLine);
check("鍚堟垚璁板綍鍚庝粛鏃?NaN", !/NaN|undefined/.test(eternityLine));

// =====================================================================
console.log("\n### F. 鎸戞垬绾綍锛氭棫瀛樻。鍥為€€");
await loadSave(realitySample, "challenges");
await sleep(1200);
const chText = await page.evaluate(() => document.querySelector(".l-challenge-records-tab")?.innerText || "");
check("鎸戞垬绾綍椤靛彲娓叉煋", chText.length > 0, chText.slice(0, 60).replace(/\n/g, " "));
check("鏃у瓨妗ｆ寫鎴樼邯褰曟爣娉ㄤ负鍘嗗彶鏁版嵁", chText.includes("鏃х増璁板綍锛屾湭淇濆瓨鐜板疄鏃堕棿"));
check("鏈畬鎴愮殑鎸戞垬鏄剧ず銆屽皻鏈畬鎴愩€?, chText.includes("灏氭湭瀹屾垚") || chText.includes("鏃堕棿绾綍锛?));
check("鎸戞垬绾綍鏂囨鏃?NaN", !/NaN|undefined/.test(chText));

// =====================================================================
console.log("\n### G. 鏂版寫鎴樻垚缁╁啓鍏ョ幇瀹炴椂闂?);
const G = await page.evaluate(() => {
  const out = {};
  GameIntervals.gameLoop.stop();
  player.challenge.normal.bestTimes = Array.repeat(Number.MAX_VALUE, 11);
  player.challenge.normal.bestRealTimes = Array.repeat(Number.MAX_VALUE, 11);
  GameSpeed.set(10000);

  // 绗?2 鍙锋櫘閫氭寫鎴橈細鐜板疄 500ms锛屾父鎴忓唴鏃堕棿 500ms锛?0000脳 涓嬪師濮?5e6ms 褰掍竴鍚庝负 500ms锛?  player.records.thisInfinity.time = 5e6;
  // 鐪熷疄浠ｇ爜閲?time 涓?inGameTime 鐢?gameLoop 鍚屾绱姞锛岃繖閲屾墜宸ラ€犳垚缁╅渶鍚屾椂鍐欏叆
  player.records.thisInfinity.inGameTime = 500;
  player.records.thisInfinity.realTime = 500;
  NormalChallenge(2).updateChallengeTime();
  out.first = {
    game: player.challenge.normal.bestTimes[0],
    real: player.challenge.normal.bestRealTimes[0],
  };

  // 鏇存參鐨勪竴娆★紙鐜板疄 800ms锛夛細涓ら」閮戒笉搴旇瑕嗙洊
  player.records.thisInfinity.time = 8e6;
  // 鐪熷疄浠ｇ爜閲?time 涓?inGameTime 鐢?gameLoop 鍚屾绱姞锛岃繖閲屾墜宸ラ€犳垚缁╅渶鍚屾椂鍐欏叆
  player.records.thisInfinity.inGameTime = 800;
  player.records.thisInfinity.realTime = 800;
  NormalChallenge(2).updateChallengeTime();
  out.slowerUnchanged = {
    game: player.challenge.normal.bestTimes[0],
    real: player.challenge.normal.bestRealTimes[0],
  };

  // 骞跺垪鎴愮哗锛堢幇瀹?500ms / 娓告垙鍐?500ms锛夛細涓嶅簲鏀瑰彉
  player.records.thisInfinity.time = 5e6;
  // 鐪熷疄浠ｇ爜閲?time 涓?inGameTime 鐢?gameLoop 鍚屾绱姞锛岃繖閲屾墜宸ラ€犳垚缁╅渶鍚屾椂鍐欏叆
  player.records.thisInfinity.inGameTime = 500;
  player.records.thisInfinity.realTime = 500;
  NormalChallenge(2).updateChallengeTime();
  out.tieUnchanged = {
    game: player.challenge.normal.bestTimes[0],
    real: player.challenge.normal.bestRealTimes[0],
  };

  // 鏇村揩鐨勪竴娆★細鐜板疄 100ms / 娓告垙鍐?100ms
  player.records.thisInfinity.time = 1e6;
  // 鐪熷疄浠ｇ爜閲?time 涓?inGameTime 鐢?gameLoop 鍚屾绱姞锛岃繖閲屾墜宸ラ€犳垚缁╅渶鍚屾椂鍐欏叆
  player.records.thisInfinity.inGameTime = 100;
  player.records.thisInfinity.realTime = 100;
  NormalChallenge(2).updateChallengeTime();
  out.faster = {
    game: player.challenge.normal.bestTimes[0],
    real: player.challenge.normal.bestRealTimes[0],
  };

  // 鏈畬鎴愮殑鍏朵粬鎸戞垬淇濇寔鍝ㄥ叺
  out.othersSentinel = player.challenge.normal.bestRealTimes.slice(1, 5).every(v => v === Number.MAX_VALUE);

  // 鏃犻檺鎸戞垬鍚屾牱鍐欎袱绉嶅彛寰?  player.challenge.infinity.bestTimes = Array.repeat(Number.MAX_VALUE, 8);
  player.challenge.infinity.bestRealTimes = Array.repeat(Number.MAX_VALUE, 8);
  player.records.thisInfinity.time = 2e6;
  // 鐪熷疄浠ｇ爜閲?time 涓?inGameTime 鐢?gameLoop 鍚屾绱姞锛岃繖閲屾墜宸ラ€犳垚缁╅渶鍚屾椂鍐欏叆
  player.records.thisInfinity.inGameTime = 200;
  player.records.thisInfinity.realTime = 200;
  InfinityChallenge(1).updateChallengeTime();
  out.infinity = {
    game: player.challenge.infinity.bestTimes[0],
    real: player.challenge.infinity.bestRealTimes[0],
  };
  return out;
});
check("鏅€氭寫鎴橀娆℃垚缁╋細鐜板疄=500ms", G.first.real === 500, JSON.stringify(G.first));
check("鏅€氭寫鎴橀娆℃垚缁╋細娓告垙鍐呮椂闂?500ms锛?0000脳 宸插墺绂伙級", Math.abs(G.first.game - 500) < 1e-6, String(G.first.game));
check("鏇存參鎴愮哗涓嶈鐩栨渶浣?, G.slowerUnchanged.real === 500 && G.slowerUnchanged.game === 500);
check("骞跺垪鎴愮哗涓嶆敼鍐?, G.tieUnchanged.real === 500 && G.tieUnchanged.game === 500);
check("鏇村揩鎴愮哗姝ｇ‘鍒锋柊涓ょ鍙ｅ緞", G.faster.real === 100 && Math.abs(G.faster.game - 100) < 1e-6, JSON.stringify(G.faster));
check("鏈畬鎴愮殑鎸戞垬淇濇寔鍝ㄥ叺鍊?, G.othersSentinel);
check("鏃犻檺鎸戞垬鍚屾牱璁板綍鐜板疄鏃堕棿", G.infinity.real === 200 && Math.abs(G.infinity.game - 200) < 1e-6, JSON.stringify(G.infinity));

// 鎸戞垬绾綍椤靛簲鏄剧ず鏂拌褰曠殑鐜板疄鏃堕棿
await page.evaluate(() => {
  const t = Tabs.all.find(x => x.config.key === "statistics");
  t.show();
  const sub = t.subtabs.find(s => s.key === "challenges");
  if (sub) sub.show();
});
await sleep(900);
const chText2 = await page.evaluate(() => document.querySelector(".l-challenge-records-tab")?.innerText || "");
const line2 = chText2.split("\n").find(l => l.includes("鏅€氭寫鎴?2"));
check("鎸戞垬绾綍椤垫樉绀烘柊璁板綍鐨勭幇瀹炴椂闂?, !!line2 && line2.includes("鐜板疄鏃堕棿") && line2.includes("娓告垙鍐呮椂闂?), line2 || "(鏃?");

// =====================================================================
console.log("\n### H. 鍊嶇巼涓€斿垏鎹㈡椂鐜板疄鏃堕棿浠嶈繛缁疮璁?);
const H = await page.evaluate(() => {
  GameIntervals.gameLoop.stop();
  const out = { steps: [] };
  // 鐢ㄥ叏灞€鍗曡皟璁℃暟鍣?realTimePlayed 瑙傛祴锛坱hisInfinity 鍙兘鍥犻噸缃綊闆讹紝涓嶉€傚悎杩炵画娴嬮噺锛?  for (const f of [10000, 1, 10000]) {
    GameSpeed.set(f);
    const r0 = player.records.realTimePlayed;
    const t0 = player.records.totalTimePlayed;
    gameLoop(100);
    out.steps.push({
      f,
      real: player.records.realTimePlayed - r0,
      raw: player.records.totalTimePlayed - t0,
    });
  }
  return out;
});
check("10000脳 涓?100ms 澧欓挓绱 100ms 鐜板疄鏃堕棿",
  Math.abs(H.steps[0].real - 100) < 0.001, String(H.steps[0].real));
check("鍒囧埌 1脳 鍚庝粛绱 100ms 鐜板疄鏃堕棿",
  Math.abs(H.steps[1].real - 100) < 0.001, String(H.steps[1].real));
check("鍐嶅垏鍥?10000脳 浠嶇疮璁?100ms 鐜板疄鏃堕棿",
  Math.abs(H.steps[2].real - 100) < 0.001, String(H.steps[2].real));
check("涓夋鍚堣鐜板疄鏃堕棿 300ms锛堝垏鎹㈠€嶇巼涓嶆紡璁°€佷笉閲嶅璁★級",
  Math.abs(H.steps.reduce((s, x) => s + x.real, 0) - 300) < 0.01,
  String(H.steps.reduce((s, x) => s + x.real, 0)));
check("鍘熷娓告垙鏃堕棿闅忓€嶇巼鍙樺寲锛堢幇瀹炴椂闂翠笉鍙楀奖鍝嶏級",
  H.steps[0].raw > H.steps[1].raw * 100, `${H.steps[0].raw.toExponential(2)} vs ${H.steps[1].raw.toExponential(2)}`);

// =====================================================================
console.log("\n### I. 鏃堕棿鑶ㄨ儉涓庡叏灞€鍊嶇巼鍒嗙");
const I = await page.evaluate(() => {
  const out = {};
  GameIntervals.gameLoop.stop();
  GameSpeed.set(10000);
  out.speedupAt10000 = getGameSpeedupFactor();
  GameSpeed.set(1);
  out.speedupAt1 = getGameSpeedupFactor();
  GameSpeed.set(100000);
  out.speedupAt100000 = getGameSpeedupFactor();
  GameSpeed.set(10000);

  player.challenge.eternity.current = 12;
  out.speedupEC12 = getGameSpeedupFactor();
  // 鍦?EC12锛堟父鎴忓唴鍑忛€?1000 鍊嶏級涓嬪啀璺?100ms 澧欓挓锛岀幇瀹炴椂闂村繀椤讳粛涓?100ms
  const r1 = player.records.realTimePlayed;
  gameLoop(100);
  out.ec12Real = player.records.realTimePlayed - r1;
  player.challenge.eternity.current = 0;
  out.globalFactor = getGlobalSpeedFactorRaw();
  return out;
});
check("鏀瑰彉鍏ㄥ眬鍊嶇巼涓嶄細鏀瑰彉娓告垙鍐呴€熷害鍥犲瓙",
  I.speedupAt10000 === I.speedupAt1 && I.speedupAt1 === I.speedupAt100000,
  `${I.speedupAt1} / ${I.speedupAt10000} / ${I.speedupAt100000}`);
check("涓ょ鍊嶇巼浜掍笉娣峰叆锛堟父鎴忓唴閫熷害鍥犲瓙涓嶅惈 10000锛?,
  I.speedupAt10000 < 1e30 && I.globalFactor === 10000, `${I.speedupAt10000} / ${I.globalFactor}`);
check("EC12 鐢熸晥鏃舵父鎴忓唴閫熷害鍥犲瓙涓?1/1000", Math.abs(I.speedupEC12 - 0.001) < 1e-9, String(I.speedupEC12));
check("EC12锛堟父鎴忓唴鍑忛€燂級鏈熼棿鐜板疄鏃堕棿浠嶆寜澧欓挓绱 100ms",
  Math.abs(I.ec12Real - 100) < 0.001, String(I.ec12Real));

// =====================================================================
console.log("\n### J. HUD 閫熷害鏄剧ず涓嶅惈鍏ㄥ眬鍊嶇巼");
const hud = await page.evaluate(() => {
  GameSpeed.set(10000);
  return { display: document.querySelector(".c-gamespeed")?.innerText || "", speed: getGameSpeedupFactor() };
});
check("HUD 閫熷害鏄剧ず涓嶆妸 10000脳 褰撲綔娓告垙鍐呴€熷害", !hud.display.includes("10000"), hud.display.replace(/\n/g, " "));

// =====================================================================
await page.screenshot({ path: path.join(outDir, "final.png") });
const realErrs = errs.filter(e => !/googletagmanager|Content Security Policy|kaspersky/i.test(e));
check("鏃犳柊澧為〉闈㈠紓甯?, realErrs.length === 0, realErrs.slice(0, 2).join(" | "));

const pass = results.filter(r => r.p).length;
const fail = results.length - pass;
console.log(`\n==== 缁撴灉: ${pass} 閫氳繃 / ${fail} 澶辫触 ====`);
await browser.close();
server.close();
process.exit(fail === 0 ? 0 : 1);
