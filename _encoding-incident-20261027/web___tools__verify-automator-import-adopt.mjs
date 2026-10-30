// 鑷姩鏈鸿剼鏈鍏?鈫?杩愯妲芥帴绠?琛屼负鎺㈤拡
//
// 楠岃瘉 `AutomatorBackend.adoptImportedScript()`锛?//   姝ｅ悜锛氳嚜鍔ㄦ満姝ｅ湪杩愯 鈫?瀵煎叆鑴氭湰鍚庤繍琛屾Ы鍒囧埌鏂拌剼鏈笖缁х画杩愯锛堣€佽涓猴細浠嶈窇鏃ц剼鏈級
//   杈圭晫 A锛氳嚜鍔ㄦ満宸插仠姝?鈫?鍙鍏ヤ笉鍚姩锛岃繍琛屾Ы涓嶅彉
//   杈圭晫 B锛氳嚜鍔ㄦ満宸叉殏鍋?鈫?鍒囪繍琛屾Ы浣嗕繚鎸佹殏鍋?//   瀵圭収锛氱粫杩?adoptImportedScript 璧拌€佷唬鐮佽矾寰勶紝纭鑰佽涓虹‘瀹炴槸銆屼笉鍒囨崲銆?//
// 鐢ㄦ硶锛歯ode verify-automator-import-adopt.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const ROOT = process.env.OREKI_ROOT || "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition";
const REPO = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/ADScriptAndGuide";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";
const OUT = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/automator-import-adopt.json";
const PORT = 8497;

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon"
};

const SCRIPT_A = fs.readFileSync(path.join(REPO, "NinjatsuScripts/Ninja RealFast v3.txt"), "utf-8").trim();
const SCRIPT_B = fs.readFileSync(path.join(REPO, "LSFScripts/LSF-NORM.txt"), "utf-8").trim();
const SAVE = fs.readFileSync(path.join(SAVE_DIR, "861._92R+1.0e11RM.txt"), "utf-8");

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(ROOT, "." + p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(PORT, "127.0.0.1", r));

const browser = await launchViaConnect({ protocolTimeout: 300000 });
const page = await browser.newPage();
const errs = [];
const NOISE = /googletagmanager|google-analytics|kaspersky-labs|Vue warn|progress\.info/;
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => {
  if (m.type() === "error" && !NOISE.test(m.text())) errs.push(`CONSOLE: ${m.text().slice(0, 200)}`);
});
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 80; i++) {
  const ok = await page.evaluate(() => {
    try { return typeof gameLoop === "function" && typeof AutomatorBackend === "object"; } catch (e) { return false; }
  }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

await page.evaluate(() => {
  window.__a = {
    reset() {
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      try { AutomatorBackend.stop(); } catch (e) { /* ignore */ }
      player = GameSaveSerializer.deserialize(window.__A_SAVE);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      GameSpeed.set(10000);
      player.reality.automator.state.mode = AUTOMATOR_MODE.PAUSE;
    },
    // 鐢ㄣ€屾ā寮忋€嶆妸鑷姩鏈烘憜鍒版寚瀹氱姸鎬侊細stopped / running / paused
    prime(scriptRaw, state) {
      AutomatorBackend.importFullScriptData(scriptRaw, { presets: false, constants: false });
      const id = AutomatorBackend.state.editorScript;
      AutomatorBackend.state.topLevelScript = id;
      if (state === "stopped") {
        AutomatorBackend.stop();
      } else {
        AutomatorBackend.start(id, state === "paused" ? AUTOMATOR_MODE.PAUSE : AUTOMATOR_MODE.RUN);
      }
      return this.describe();
    },
    describe() {
      return {
        isOn: AutomatorBackend.isOn,
        isRunning: AutomatorBackend.isRunning,
        mode: AutomatorBackend.mode,
        topLevelName: AutomatorBackend.currentRunningScript?.name ?? null,
        editorName: AutomatorBackend.currentEditingScript?.name ?? null,
        topLevelID: AutomatorBackend.state.topLevelScript,
        editorID: AutomatorBackend.state.editorScript,
        lines: (AutomatorBackend.currentRawText ?? "").split("\n").length,
        stackDepth: AutomatorBackend.stack.length ?? null,
        line: AutomatorBackend.currentLineNumber,
      };
    },
    // 璧颁慨濂藉悗鐨勭湡瀹炲叆鍙?    importVia(raw) {
      const adopted = AutomatorBackend.importFullScriptData(raw, { presets: false, constants: false });
      return { adopted, ...this.describe() };
    },
    // 璧般€屼慨澶嶅墠銆嶇殑绛変环璺緞锛歝reateNewScript + initializeFromSave锛屼笉鎺ョ杩愯妲?    importLegacy(raw) {
      const parsed = AutomatorBackend.parseFullScriptData(raw);
      AutomatorData.createNewScript(parsed.content, parsed.name);
      AutomatorBackend.initializeFromSave();
      return this.describe();
    },
    step(n, ms) {
      for (let i = 0; i < n; i++) gameLoop(ms);
      return {
        line: AutomatorBackend.currentLineNumber,
        running: AutomatorBackend.isRunning,
        realities: player.realities,
        ep: Currency.eternityPoints.value.toString(),
      };
    },
  };
});
await page.evaluate(s => { window.__A_SAVE = s; }, SAVE);

const rows = [];
const check = (name, ok, detail) => {
  rows.push({ name, ok, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? `  鈥斺€?${detail}` : ""}`);
};

// ---------- 1. 姝ｅ悜锛氳繍琛屼腑瀵煎叆 鈫?杩愯妲藉垏鎹㈠苟缁х画杩愯 ----------
let r = await page.evaluate(({ a, b }) => {
  window.__a.reset();
  const before = window.__a.prime(a, "running");
  window.__a.step(30, 20);
  const after = window.__a.importVia(b);
  window.__a.step(60, 20);
  return { before, after, final: window.__a.describe() };
}, { a: SCRIPT_A, b: SCRIPT_B });
check("姝ｅ悜锛氬鍏ュ墠杩愯鐨勬槸 A 鑴氭湰锛圧ealFast锛?, r.before.topLevelName === "Ninja RealFast",
  `topLevel=${r.before.topLevelName}`);
check("姝ｅ悜锛氬鍏?B 鍚庤繍琛屾Ы鍒囧埌 B锛圠SF-NORM锛?, r.after.topLevelName === "LSF-NORM",
  `topLevel=${r.after.topLevelName}, adopted=${r.after.adopted}`);
check("姝ｅ悜锛氬鍏ュ悗浠嶅湪杩愯", r.after.isRunning === true, `isRunning=${r.after.isRunning}, mode=${r.after.mode}`);
check("姝ｅ悜锛氳繍琛屽唴瀹圭‘瀹炴槸 B锛堣鏁颁笌 A 涓嶅悓锛?, r.after.lines !== r.before.lines,
  `A=${r.before.lines}琛?鈫?B=${r.after.lines}琛宍);
check("姝ｅ悜锛氬垏鎹㈠悗 60 甯т粛鍦ㄨ繍琛岋紙娌℃湁绔嬪埢缁撴潫锛?, r.final.isRunning === true, `isRunning=${r.final.isRunning}`);

// ---------- 2. 瀵圭収锛氫慨澶嶅墠璺緞涓嶅垏鎹㈣繍琛屾Ы ----------
r = await page.evaluate(({ a, b }) => {
  window.__a.reset();
  const before = window.__a.prime(a, "running");
  window.__a.step(30, 20);
  const after = window.__a.importLegacy(b);
  return { before, after };
}, { a: SCRIPT_A, b: SCRIPT_B });
check("瀵圭収锛氫慨澶嶅墠璺緞瀵煎叆鍚庤繍琛屾Ы浠嶆槸 A锛圔ug 澶嶇幇锛?,
  r.after.topLevelName === "Ninja RealFast" && r.after.editorName === "LSF-NORM",
  `杩愯=${r.after.topLevelName} / 缂栬緫=${r.after.editorName}`);

// ---------- 3. 杈圭晫 A锛氬凡鍋滄 鈫?鍙鍏ヤ笉鍚姩 ----------
r = await page.evaluate(({ a, b }) => {
  window.__a.reset();
  const before = window.__a.prime(a, "stopped");
  const after = window.__a.importVia(b);
  return { before, after };
}, { a: SCRIPT_A, b: SCRIPT_B });
check("杈圭晫A锛氳嚜鍔ㄦ満鍋滄鐘舵€佷笅瀵煎叆涓嶄細鑷姩鍚姩", r.after.isOn === false && r.after.isRunning === false,
  `isOn=${r.after.isOn}, isRunning=${r.after.isRunning}`);
check("杈圭晫A锛氬仠姝㈢姸鎬佷笅杩愯妲戒繚鎸佷笉鍙?, r.after.topLevelID === r.before.topLevelID,
  `topLevel ${r.before.topLevelID} 鈫?${r.after.topLevelID}`);
check("杈圭晫A锛氭柊鑴氭湰浠嶈璁句负缂栬緫涓紙鐜╁鍙嚜琛岄€夋嫨锛?, r.after.editorName === "LSF-NORM",
  `editor=${r.after.editorName}`);

// ---------- 4. 杈圭晫 B锛氬凡鏆傚仠 鈫?鍒囨Ы浣嗕繚鎸佹殏鍋?----------
r = await page.evaluate(({ a, b }) => {
  window.__a.reset();
  const before = window.__a.prime(a, "paused");
  const after = window.__a.importVia(b);
  window.__a.step(40, 20);
  return { before, after, final: window.__a.describe() };
}, { a: SCRIPT_A, b: SCRIPT_B });
check("杈圭晫B锛氭殏鍋滅姸鎬佷笅瀵煎叆鍚庤繍琛屾Ы鍒囧埌 B", r.after.topLevelName === "LSF-NORM",
  `topLevel=${r.after.topLevelName}`);
check("杈圭晫B锛氬鍏ュ悗浠嶄繚鎸佹殏鍋滐紙涓嶆搮鑷户缁級",
  r.after.mode === 1 && r.after.isRunning === false && r.final.isRunning === false,
  `mode=${r.after.mode}, isRunning=${r.after.isRunning}, 璺?40 甯у悗 isRunning=${r.final.isRunning}`);

// ---------- 5. 浜屾瀵煎叆鍚屼竴鑴氭湰锛氫笉閲嶅鍫嗙Н杩愯鎬併€佷笉宕?----------
r = await page.evaluate(({ b }) => {
  window.__a.reset();
  window.__a.prime(b, "running");
  const first = window.__a.importVia(b);
  const second = window.__a.importVia(b);
  window.__a.step(30, 20);
  return { first, second, final: window.__a.describe() };
}, { b: SCRIPT_B });
check("閲嶅瀵煎叆锛氫袱娆″鍏ュ悗浠嶅彧鏈変竴浠借繍琛屾Ы涓旇繍琛屾甯?,
  r.second.topLevelName === "LSF-NORM" && r.final.isRunning === true && r.second.editorID !== r.first.editorID,
  `topLevel=${r.second.topLevelName}, isRunning=${r.final.isRunning}`);

check("椤甸潰/鎺у埗鍙版棤閿欒", errs.length === 0, errs.length ? errs.slice(0, 4).join(" | ") : "0 鏉?);

fs.writeFileSync(OUT, JSON.stringify({
  generatedAt: new Date().toISOString(), save: "861._92R+1.0e11RM", factor: 10000,
  rows, pageErrors: errs,
}, null, 1), "utf-8");
console.log(`\n鏁版嵁宸插啓鍏?${OUT}`);

const failed = rows.filter(x => !x.ok).length;
console.log(`鍚堣 ${rows.length} 椤癸細PASS ${rows.length - failed} / FAIL ${failed}`);

await browser.close();
server.close();
process.exit(failed === 0 ? 0 : 1);
