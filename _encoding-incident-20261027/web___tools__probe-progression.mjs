// 鎺ㄨ繘閫熷害鎺㈤拡锛堝彧璇绘祴閲忥紝涓嶆敼浠讳綍鏈哄埗锛?//
// 鐩殑锛氬洖绛斻€屾煇涓€嶇巼鍙樺ぇ锛屾槸鍚︾湡鐨勭缉鐭簡鐜板疄閫氬叧鏃堕棿銆嶃€?// 鏂规硶锛氬悓涓€浠藉瓨妗ｃ€佸悓涓€娈靛浐瀹氬閽燂紙鐢ㄥ浐瀹?passDiff 鎵嬪姩椹卞姩锛屾帓闄ょ湡瀹炶鏃舵姈鍔級锛?//       姣旇緝 F=1 / 10 / 1000 / 10000 涓嬬殑
//         - 娓告垙鏃堕棿鎺ㄨ繘閲忥紙娓告垙鏃堕挓锛?//         - 鍏抽敭璧勬簮澧為噺锛圓M / IP / EP / RM锛?//         - 鍗曚綅娓告垙鏃堕棿浜у嚭锛堟晥鐜囷紝搴斿熀鏈笉闅?F 鍙樺寲锛?//       鐢辨鍖哄垎銆屾椂閽熻鍘嬬缉銆嶄笌銆屾晥鐜囪鎻愰珮銆嶃€?//
// 鐢ㄦ硶: node probe-progression.mjs [瀛樻。鍚峕 [root] [port]
//   渚? node probe-progression.mjs 132._9.1e137IP
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";
const SAVE_NAME = process.argv[2] || "132._9.1e137IP";
const root = path.resolve(process.argv[3] || "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition");
const port = Number(process.argv[4] || 8240);

const files = fs.readdirSync(SAVE_DIR).filter(f => f.endsWith(".txt"));
const saveFile = files.find(f => f.replace(/\.txt$/, "") === SAVE_NAME) || files.find(f => f.includes(SAVE_NAME));
if (!saveFile) {
  console.error(`鎵句笉鍒板瓨妗ｆ牱鏈? ${SAVE_NAME}`);
  process.exit(2);
}
const saveText = fs.readFileSync(path.join(SAVE_DIR, saveFile), "utf-8");

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

console.log(`\n瀛樻。鏍锋湰: ${saveFile}`);
console.log("娴嬮噺鏂瑰紡: 鍥哄畾 60 甯?脳 20ms 澧欓挓锛堟墜鍔ㄩ┍鍔?gameLoop锛屾帓闄ょ湡瀹炶鏃舵姈鍔級\n");

const F_LIST = [1, 10, 1000, 10000];
const FRAMES = 60;
const WALL_MS = 20;

const rows = [];
for (const F of F_LIST) {
  const r = await page.evaluate(async (text, F, frames, wallMs) => {
    try { GameIntervals.stop(); } catch (e) { /* ignore */ }
    GameStorage.offlineEnabled = false;
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
      am: lg(Currency.antimatter.value),
      ip: lg(Currency.infinityPoints.value),
      ep: lg(Currency.eternityPoints.value),
      rm: lg(Currency.realityMachines.value),
      // 绂绘暎鏈哄埗鐨勭洿鎺ヨ鏁帮細鏃犻檺/姘告亽娆℃暟锛堣嚜鍔ㄨ喘涔板櫒姣忚Е鍙戜竴娆?+1 宸﹀彸锛?      inf: Currency.infinities.value.toNumber ? Currency.infinities.value.toNumber() : Number(Currency.infinities.value),
      eter: Currency.eternities.value.toNumber ? Currency.eternities.value.toNumber() : Number(Currency.eternities.value),
      speedup: getGameSpeedupFactor(),
    });
    const before = read();
    for (let i = 0; i < frames; i++) gameLoop(wallMs);
    const after = read();
    const d = (a, b) => (Number.isFinite(a) && Number.isFinite(b)) ? a - b : NaN;
    // 澶嶅師鍊嶇巼锛岄伩鍏嶅奖鍝嶅悗缁惊鐜?    GameSpeed.set(1);
    return {
      F,
      eff: before.speedup,
      dGame: d(after.game, before.game),
      dReal: d(after.real, before.real),
      dAm: d(after.am, before.am),
      dIp: d(after.ip, before.ip),
      dEp: d(after.ep, before.ep),
      dRm: d(after.rm, before.rm),
      dInf: d(after.inf, before.inf),
      dEter: d(after.eter, before.eter),
    };
  }, saveText, F, FRAMES, WALL_MS);
  rows.push(r);
  process.stdout.write(`  F=${String(F).padStart(6)} 瀹屾垚\n`);
}

const wallTotal = FRAMES * WALL_MS;
const fmt = (v, d = 3) => Number.isFinite(v) ? v.toExponential(d) : "鈥?;
console.log("\n=== 缁撴灉 ===");
console.log("     F  娓告垙鍐呰啫鑳€    螖娓告垙鏃堕棿(ms)  螖鐜板疄(ms)  娓告垙鏃堕棿/澧欓挓   螖log10(AM)  螖log10(IP)  螖log10(EP)");
for (const x of rows) {
  console.log(`  ${String(x.F).padStart(6)} ${fmt(x.eff, 2).padStart(10)}  ${fmt(x.dGame).padStart(13)}  ${(Number.isFinite(x.dReal) ? x.dReal.toFixed(0) : "鈥?).padStart(8)}  ${fmt(x.dGame / wallTotal).padStart(12)}  ${fmt(x.dAm, 2).padStart(10)}  ${fmt(x.dIp, 2).padStart(10)}  ${fmt(x.dEp, 2).padStart(10)}`);
}

const base = rows[0];
console.log("\n=== 鐩稿 F=1 鐨勫€嶆暟 ===");
console.log("     F   娓告垙鏃堕棿鍊嶇巼   鐜板疄鏃堕棿鍊嶇巼   AM 澧為噺鍊嶇巼   IP 澧為噺鍊嶇巼");
for (const x of rows) {
  const gr = x.dGame / base.dGame;
  const rr = x.dReal / (base.dReal || 1);
  const ar = base.dAm === 0 ? NaN : x.dAm / base.dAm;
  const ir = base.dIp === 0 ? NaN : x.dIp / base.dIp;
  console.log(`  ${String(x.F).padStart(6)} ${fmt(gr).padStart(13)} ${fmt(rr).padStart(13)} ${fmt(ar).padStart(13)} ${fmt(ir).padStart(13)}`);
}

console.log("\n=== 鏁堢巼鍒嗚В锛堟瘡 1 涓父鎴忓皬鏃讹級===");
console.log("     F    AM/娓告垙灏忔椂   IP/娓告垙灏忔椂   EP/娓告垙灏忔椂   鏃犻檺娆℃暟/娓告垙灏忔椂   姘告亽娆℃暟/娓告垙灏忔椂");
for (const x of rows) {
  const hours = x.dGame / 3600000;
  const per = v => (Number.isFinite(v) && hours > 0) ? v / hours : NaN;
  console.log(`  ${String(x.F).padStart(6)} ${fmt(per(x.dAm), 2).padStart(13)} ${fmt(per(x.dIp), 2).padStart(13)} ${fmt(per(x.dEp), 2).padStart(13)} ${fmt(per(x.dInf), 2).padStart(19)} ${fmt(per(x.dEter), 2).padStart(19)}`);
}

console.log("\n=== 鍒よ ===");
console.log("  路 銆屾父鎴忔椂闂村€嶇巼 鈮?F銆嶈€屻€岀幇瀹炴椂闂村€嶇巼 鈮?1銆嶁啋 F 纭疄鍘嬬缉浜嗘椂閽燂紝涓旀病鏈夋斁澶х幇瀹炴椂闂淬€?);
console.log("  路 銆屾棤闄愭鏁?娓告垙灏忔椂銆嶆槸绂绘暎鏈哄埗锛堣嚜鍔ㄨ喘涔板櫒/閲嶇疆瑙﹀彂锛夌殑棰戠巼妫€楠岋細");
console.log("    璇ュ€艰嫢涓嶉殢 F 鍙樺寲锛岃鏄庤嚜鍔ㄥ寲娌℃湁鍥犱负楂樺€嶇巼鑰屾帀闃燂紱");
console.log("    鑻ュ畠鎸?1/F 涓嬮檷锛岃鏄庤嚜鍔ㄥ寲鎴愪簡鐡堕锛堟彁楂?F 鐨勮竟闄呮敹鐩婁細琚悆鎺夛級銆?);
console.log("  路 螖log10(璧勬簮)/娓告垙灏忔椂 鍙湪**鍚屼竴涓父鎴忔椂闂寸獥鍙?*涔嬮棿鍙瘮锛涗笉鍚?F 鎺ㄨ繘鐨勬父鎴忔椂闂撮暱搴︿笉鍚岋紝");
console.log("    璇ユ瘮鍊煎ぉ鐒朵笉鍙瘮锛屼笉鑳芥嵁姝ゅ垽鏂晥鐜囬珮浣庛€?);
console.log("  路 鐪熸缂╃煭閫氬叧鏃堕棿鐨勪袱鏉℃潬鏉嗭細鈶犳彁楂?F锛堝帇缂╂椂閽燂級鈶℃彁楂樺崟浣嶆父鎴忔椂闂存晥鐜囷紙鍊嶇巼/鎴愭湰鏀瑰姩锛夈€?);

// 鈥斺€?杩藉姞瀹為獙锛氳嚜鍔ㄨ喘涔板櫒闂撮殧鎸?F 缂╂斁鍚庯紝鏁堢巼鏄惁鍥炲埌 F=1 姘村钩 鈥斺€?// 鍙湪娴嬭瘯鍐呭瓨閲屾敼 player 鏁版嵁锛屼笉鏀逛唬鐮併€?const scaled = await page.evaluate(async (text, F, frames, wallMs, baseRate) => {
  const run = (scaleIntervals) => {
    GameIntervals.stop();
    GameStorage.offlineEnabled = false;
    player = GameSaveSerializer.deserialize(text);
    player.lastUpdate = Date.now();
    GameStorage.loadPlayerObject(player);
    player.lastUpdate = Date.now();
    GameIntervals.stop();
    GameSpeed.set(F);
    if (scaleIntervals) {
      const visit = o => {
        if (!o) return;
        if (Array.isArray(o)) { o.forEach(visit); return; }
        if (o.data && typeof o.data.interval === "number") {
          o.data.interval = Math.max(1, o.data.interval / F);
        }
      };
      visit(Autobuyers.all);
    }
    const lg = v => {
      const n = v && v.toNumber ? v.toNumber() : Number(v);
      return Number.isFinite(n) && n > 0 ? Math.log10(n) : NaN;
    };
    const g0 = player.records.totalTimePlayed;
    const ip0 = lg(Currency.infinityPoints.value);
    for (let i = 0; i < frames; i++) gameLoop(wallMs);
    const g1 = player.records.totalTimePlayed;
    const ip1 = lg(Currency.infinityPoints.value);
    GameSpeed.set(1);
    return { dGame: g1 - g0, dIp: Number.isFinite(ip1 - ip0) ? ip1 - ip0 : NaN };
  };
  const plain = run(false);
  const fixed = run(true);
  const rate = r => r.dIp / (r.dGame / 3600000);
  return {
    F,
    plainRate: rate(plain), fixedRate: rate(fixed),
    plainIp: plain.dIp, fixedIp: fixed.dIp,
    baseRate,
  };
}, saveText, 10000, FRAMES, WALL_MS, (rows[0].dIp / (rows[0].dGame / 3600000)));

console.log("\n=== 鐡堕瀵圭収锛欶=10000 鏃舵妸鑷姩璐拱鍣ㄩ棿闅旀寜 F 缂╃煭锛堜粎鏀瑰唴瀛樻暟鎹級===");
const fmt2 = v => Number.isFinite(v) ? v.toExponential(2) : "鈥?;
console.log(`  F=1     姣忔父鎴忓皬鏃?螖log10(IP) = ${fmt2(scaled.baseRate)}`);
console.log(`  F=10000 鍘熸牱              = ${fmt2(scaled.plainRate)}锛堢浉瀵?F=1 鏁堢巼 ${fmt2(scaled.plainRate / scaled.baseRate)}锛塦);
console.log(`  F=10000 闂撮殧/F            = ${fmt2(scaled.fixedRate)}锛堢浉瀵?F=1 鏁堢巼 ${fmt2(scaled.fixedRate / scaled.baseRate)}锛塦);
console.log(`  鈫?鍗曠獥鍙?IP 澧為噺锛氬師鏍?${fmt2(scaled.plainIp)} vs 闂撮殧/F ${fmt2(scaled.fixedIp)}`);

await browser.close();
server.close();
