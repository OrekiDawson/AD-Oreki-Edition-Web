// 绂荤嚎缁撶畻鎺㈤拡锛堝彧璇绘祴閲忥紝涓嶆敼鏈哄埗锛?
//
// 鐩殑锛氬洖绛斻€岀绾跨粨绠楀埌搴曞悆涓嶅悆 F銆嶏紝浠ュ強"脳F / 梅F 鐩镐簰鎶垫秷"鐨勪唬鐮佸瑙傛槸鍚︾瓑浜庢渶缁堢粨鏋滀笌 F 鏃犲叧銆?
//
// 鍋氭硶锛氬浐瀹氬瓨妗?+ 鍥哄畾绂荤嚎绉掓暟 + 鎸囧畾 F锛岃皟鐢ㄧ湡瀹炵殑 simulateTime(seconds, real, fast)锛?
//       娴嬶細螖娓告垙鏃堕棿銆佄旂幇瀹炴椂闂淬€佄旇祫婧愩€佄旀棤闄?姘告亽娆℃暟銆佺粨绠楀墠鍚庣殑 speedup銆?
//
// 娉ㄦ剰锛歠ast=true 鏃跺浐瀹?50 tick锛堢‘瀹氭€уソ銆佸揩锛夛紱fast=false 鏃惰蛋绂荤嚎 tick 涓婇檺涓庡紓姝ュ脊绐椼€?
//       涓ょ閮芥祴锛岄伩鍏嶅彧娴嬩竴鏉″垎鏀€?
//
// 鐢ㄦ硶: node probe-offline.mjs [root] [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition");
const port = Number(process.argv[3] || 8250);
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";

// 涓や唤浠ｈ〃鎬у瓨妗ｏ細涓€浠姐€屾棤榛戞礊銆嶏紙璧?:946 鍒嗘敮锛夛紝涓€浠姐€屾湁榛戞礊銆嶏紙璧?:944/:987 鍒嗘敮锛?
const SAVES = [
  { key: "pre-bh", file: "29._2AG+9DB+1e50AM.txt", desc: "2 AG / 9 DB / 1e50 AM锛堟棤榛戞礊锛? },
  { key: "with-bh", file: "132._9.1e137IP.txt", desc: "9.1e137 IP锛堝簲宸茶В閿侀粦娲烇級" },
];

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
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 800 });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 6500));

const FS = [1, 137, 10000];
const SECS = [60, 600, 3600];

console.log("绂荤嚎缁撶畻鎺㈤拡锛毼旀父鎴忔椂闂?/ 螖鐜板疄鏃堕棿 / 螖璧勬簮");
console.log("鍥哄畾瀛樻。 + 鍥哄畾绂荤嚎绉掓暟 + 鎸囧畾 F锛岃皟鐢ㄧ湡瀹?simulateTime()\n");

const all = [];
for (const s of SAVES) {
  const saveText = fs.readFileSync(path.join(SAVE_DIR, s.file), "utf-8");
  console.log(`\n========== 瀛樻。 ${s.key}锛?{s.desc} ==========`);
  for (const fast of [true, false]) {
    console.log(`\n--- 妯″紡 ${fast ? "fast=true锛堝浐瀹?50 tick锛? : "fast=false锛堣蛋绂荤嚎 tick 涓婇檺锛?} ---`);
    console.log("     F   绂荤嚎(s)   螖娓告垙鏃堕棿(ms)     螖鐜板疄(ms)   娓告垙/鐜板疄    脳F/?       螖log10(IP)   螖鏃犻檺      螖姘告亽");
    for (const F of FS) {
      for (const secs of SECS) {
        const r = await page.evaluate(async (text, F, secs, fast) => {
          try { GameIntervals.stop(); } catch (e) { /* ignore */ }
          GameStorage.offlineEnabled = true;
          const obj = GameSaveSerializer.deserialize(text);
          player = obj;
          player.lastUpdate = Date.now();
          GameStorage.loadPlayerObject(player);
          player.lastUpdate = Date.now();
          try { GameIntervals.stop(); } catch (e) { /* ignore */ }
          GameSpeed.set(F);
          const lg = v => {
            const n = v && v.toNumber ? v.toNumber() : Number(v);
            return Number.isFinite(n) && n > 0 ? Math.log10(n) : NaN;
          };
          const read = () => ({
            game: player.records.totalTimePlayed,
            real: player.records.realTimePlayed,
            ip: lg(Currency.infinityPoints.value),
            inf: Currency.infinities.value.toNumber ? Currency.infinities.value.toNumber() : Number(Currency.infinities.value),
            eter: Currency.eternities.value.toNumber ? Currency.eternities.value.toNumber() : Number(Currency.eternities.value),
            speedup: getGameSpeedupFactor(),
            bhUnlocked: BlackHoles.areUnlocked,
          });
          const before = read();
          simulateTime(secs, false, fast);
          const after = read();
          GameSpeed.set(1);
          const d = (a, b) => (Number.isFinite(a) && Number.isFinite(b)) ? a - b : NaN;
          return {
            F, secs, bh: before.bhUnlocked, speedup: before.speedup,
            dGame: d(after.game, before.game),
            dReal: d(after.real, before.real),
            dIp: d(after.ip, before.ip),
            dInf: d(after.inf, before.inf),
            dEter: d(after.eter, before.eter),
          };
        }, saveText, F, secs, fast);
        all.push({ save: s.key, mode: fast ? "fast" : "limit", ...r });
        const fx = v => (Number.isFinite(v) ? v : 0);
        const ratio = fx(r.dGame) / (fx(r.dReal) || 1);
        const e3 = v => (Number.isFinite(v) ? v.toExponential(3) : "鈥?);
        const e2 = v => (Number.isFinite(v) ? v.toExponential(2) : "鈥?);
        console.log(`  ${String(F).padStart(6)} ${String(secs).padStart(8)} ${e3(r.dGame).padStart(14)} ${(Number.isFinite(r.dReal) ? r.dReal.toFixed(0) : "鈥?).padStart(12)} ${e3(ratio).padStart(11)} ${e2(fx(ratio) / F).padStart(9)}  ${e2(r.dIp).padStart(11)} ${e2(r.dInf).padStart(8)} ${e2(r.dEter).padStart(8)}`);
      }
    }
  }
}

// 姹囨€伙細鍚屼竴 (save, mode, secs) 涓嬶紝螖娓告垙鏃堕棿 闅?F 鐨勫€嶇巼
console.log("\n\n========== 姹囨€伙細螖娓告垙鏃堕棿 鐩稿 F=1 鐨勫€嶇巼 ==========");
console.log("瀛樻。    妯″紡   绂荤嚎(s)   F=137/F=1     F=10000/F=1");
for (const s of SAVES) {
  for (const mode of ["fast", "limit"]) {
    for (const secs of SECS) {
      const g = F => {
        const row = all.find(r => r.save === s.key && r.mode === mode && r.secs === secs && r.F === F);
        return row ? row.dGame : NaN;
      };
      const b = g(1);
      const e3 = v => (Number.isFinite(v) ? v.toExponential(3) : "鈥?);
      console.log(`${s.key.padEnd(8)}${mode.padEnd(6)} ${String(secs).padStart(7)}   ${e3(g(137) / b).padStart(12)} ${e3(g(10000) / b).padStart(13)}`);
    }
  }
}

console.log("\n========== 鍒よ ==========");
console.log("路 鑻?F=10000/F=1 鈮?10000 鈫?绂荤嚎杩涘害琚?F 绾挎€у姞閫燂紝涓庡湪绾夸竴鑷淬€?);
console.log("路 鑻?鈮?1 鈫?绂荤嚎杩涘害涓?F 鏃犲叧锛堛€屽厛涔樺悗闄ゃ€嶇湡鐨勬姷娑堜簡锛夈€?);
console.log("路 鑻ヤ粙浜庝袱鑰呬箣闂?鈫?瀛樺湪涓?tick 鏁?榛戞礊璺緞鐩稿叧鐨勯儴鍒嗘姷娑堬紝闇€瑕佹寜瀛樻。绫诲瀷鍒嗗埆璇存槑銆?);
console.log("路 螖鐜板疄鏃堕棿 搴旀亽 鈮?绂荤嚎绉掓暟锛堢幇瀹炴椂闂翠笉寰楄 F 鏀惧ぇ锛夈€?);

await browser.close();
server.close();
