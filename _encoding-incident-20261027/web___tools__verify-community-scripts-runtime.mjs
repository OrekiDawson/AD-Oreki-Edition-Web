// 绀惧尯鑷姩鏈鸿剼鏈€岀湡瀹炶繍琛屻€嶆帰閽堬紙涓嶆槸鍙紪璇戯級
//
// 鑳屾櫙锛氫笂涓€杞?`_research/community-scripts-compat.json` 鍙獙璇佷簡 41 涓ぞ鍖鸿剼鏈兘閫氳繃鏈」鐩?// 鑷姩鏈虹紪璇戝櫒锛堣娉曞眰 PASS锛夈€傛湰杞鍥炵瓟鐨勬槸**杩愯鏃?*闂锛?//   1. 鑴氭湰鐪熺殑鑳介┍鍔ㄦ父鎴忔帹杩涘悧锛埼擱eality / 螖EP / 螖EC 瀹屾垚鏁帮級
//   2. 浼氫笉浼氫腑閫斿崱浣?/ 鎶ラ敊 / 瑙﹀彂銆岃繛缁繃澶氱┖鎿嶄綔銆嶄繚鎶?//   3. 鏉′欢绛夊緟锛坵ait/until锛変笌閲嶇疆鍐崇瓥鍦ㄧ湡瀹炲抚寰幆閲屾槸鍚︽寜棰勬湡鐢熸晥
//
// 鍋氭硶锛氭妸浠撳簱鍘熷瀵煎嚭涓诧紙`AntimatterDimensionsAutomatorDataFormat...EndOfAutomatorData`锛?// 鐩存帴鍠傜粰 `AutomatorBackend.importFullScriptData()`鈥斺€斾笌鐜╁绮樿创瀵煎叆瀹屽叏鍚屼竴鏉¤矾寰勶紝
// 鐒跺悗 `AutomatorBackend.start()`锛岀敤鎵嬪姩 `gameLoop(20)` 鎺ㄨ繘鍥哄畾甯ф暟锛?鍥哄畾鐜板疄鏃堕棿锛夈€?//
// 鐢ㄦ硶锛歯ode verify-community-scripts-runtime.mjs [--frames=1500] [--f=10000] [--save=861]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const ROOT = process.env.OREKI_ROOT || "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition";
const REPO = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/ADScriptAndGuide";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";
const OUT = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/community-scripts-runtime.json";
const PORT = 8496;

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon"
};

const argStr = (k, d) => {
  const h = process.argv.find(a => a.startsWith(`--${k}=`));
  return h ? h.split("=")[1] : d;
};
const argNum = (k, d) => {
  const v = Number(argStr(k, NaN));
  return Number.isFinite(v) && v > 0 ? v : d;
};
const FRAMES = argNum("frames", 1500);   // 1500 脳 20ms = 30 绉掔幇瀹?const FACTOR = argNum("f", 10000);
const SAVE_KEY = argStr("save", "861");
const FRAME_MS = 20;

const saveFile = fs.readdirSync(SAVE_DIR).find(f => f.startsWith(`${SAVE_KEY}.`));
if (!saveFile) throw new Error(`鎵句笉鍒板瓨妗?${SAVE_KEY}`);

const CASES = [
  { label: "Ninja RealFast v3", file: "NinjatsuScripts/Ninja RealFast v3.txt" },
  { label: "Ninja PreECR v3.1", file: "NinjatsuScripts/Ninja PreECR v3.1.txt" },
  { label: "LSF-NORM", file: "LSFScripts/LSF-NORM.txt" },
];

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
  window.__r = {
    setup(text, F) {
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      try { AutomatorBackend.stop(); } catch (e) { /* ignore */ }
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      GameSpeed.set(F);
      // 甯у惊鐜繀椤荤敱鏈帰閽堥┍鍔紝閬垮厤鐪熷疄瀹氭椂鍣ㄤ笌鎵嬪姩 gameLoop 鍙犲姞
      player.reality.automator.state.mode = AUTOMATOR_MODE.PAUSE;
      return {
        F: GameSpeed.factor,
        eff: getGlobalSpeedFactor(),
        unlocked: Player.automatorUnlocked,
        realities: player.realities,
        ep: Currency.eternityPoints.value.toString(),
        rm: Currency.realityMachines.value.toString(),
        ec: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => EternityChallenge(i).completions),
      };
    },
    importRun(raw) {
      try {
        AutomatorBackend.importFullScriptData(raw, { presets: false, constants: false });
      } catch (e) {
        return { ok: false, error: `import: ${e.message}` };
      }
      // importFullScriptData 鍙妸鑴氭湰鍐欒繘 scripts 琛ㄥ苟鍒囧埌銆岀紪杈戜腑銆嶏紝涓嶄細鍒囥€岃繍琛屼腑銆嶈剼鏈€?      // 鐜╁鐨勭湡瀹炴搷浣滄槸瀵煎叆鍚庡湪鑴氭湰鍒楄〃閲岄€変腑瀹冨啀鐐瑰惎鍔紱杩欓噷绛変环鍦版墜鍔ㄥ悓姝?topLevelScript銆?      const id = AutomatorBackend.state.editorScript;
      AutomatorBackend.state.topLevelScript = id;
      try {
        AutomatorBackend.start(id);
        AutomatorBackend.mode = AUTOMATOR_MODE.RUN;
      } catch (e) {
        return { ok: false, error: `start: ${e.message}` };
      }
      return {
        ok: true,
        scriptID: id,
        name: AutomatorBackend.currentRunningScript?.name ?? "?",
        lines: (AutomatorBackend.currentRawText ?? "").split("\n").length,
        compiledCommands: AutomatorBackend.currentRunningScript?.commands?.length ?? 0,
        errors: AutomatorBackend.currentErrors?.() ?? null,
        interval: AutomatorBackend.currentInterval,
      };
    },
    snap() {
      return {
        running: AutomatorBackend.isRunning,
        isOn: AutomatorBackend.isOn,
        mode: AutomatorBackend.mode,
        line: AutomatorBackend.currentLineNumber,
        realities: player.realities,
        ec: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => EternityChallenge(i).completions),
        ep: Currency.eternityPoints.value.toString(),
        rm: Currency.realityMachines.value.toString(),
        tt: Currency.timeTheorems.value.toString(),
        totalTT: player.timestudy.theorem.toString(),
        am: Currency.antimatter.value.toString(),
        infinity: player.records.thisInfinity.time,
        eternityTime: player.records.thisEternity.time,
        realityTime: player.records.thisReality.time,
        gameTime: player.records.totalTimePlayed,
      };
    },
    step(n, ms) {
      const events = [];
      const origNotify = GameUI.notify.error;
      GameUI.notify.error = (m, ...rest) => { events.push(String(m).slice(0, 120)); return origNotify.call(GameUI.notify, m, ...rest); };
      for (let i = 0; i < n; i++) gameLoop(ms);
      GameUI.notify.error = origNotify;
      return events;
    },
  };
});

const text = fs.readFileSync(path.join(SAVE_DIR, saveFile), "utf-8");
const rows = [];
for (const c of CASES) {
  const raw = fs.readFileSync(path.join(REPO, c.file), "utf-8").trim();
  const before = await page.evaluate(({ t, f }) => window.__r.setup(t, f), { t: text, f: FACTOR });
  const info = await page.evaluate(r => window.__r.importRun(r), raw);
  if (!info.ok) {
    rows.push({ case: c.label, file: c.file, importError: info.error });
    continue;
  }
  // 棰勭儹璁╄剼鏈妸 autobuyer 璁剧疆璺戝畬
  await page.evaluate(({ n, ms }) => window.__r.step(n, ms), { n: 50, ms: FRAME_MS });
  const a = await page.evaluate(() => window.__r.snap());
  const events = await page.evaluate(({ n, ms }) => window.__r.step(n, ms), { n: FRAMES, ms: FRAME_MS });
  const b = await page.evaluate(() => window.__r.snap());

  rows.push({
    case: c.label, file: c.file,
    name: info.name, lines: info.lines, compiledCommands: info.compiledCommands,
    compileErrors: info.errors, interval: info.interval,
    startRealities: a.realities, endRealities: b.realities, dRealities: b.realities - a.realities,
    startEC: a.ec, endEC: b.ec,
    dEC: b.ec.map((v, i) => v - a.ec[i]),
    startEP: a.ep, endEP: b.ep,
    startRM: a.rm, endRM: b.rm,
    startTotalTT: a.totalTT, endTotalTT: b.totalTT,
    endRunning: b.running, endMode: b.mode, endLine: b.line,
    stalled: !b.running && b.mode !== AUTOMATOR_MODE.RUN,
    notifyErrors: events.slice(0, 6),
    frameGameSeconds: +(b.gameTime - a.gameTime).toFixed(1),
  });
}

const fmt = r => r.importError
  ? `${r.case}\t瀵煎叆澶辫触锛?{r.importError}`
  : `${r.case}\t${r.lines}琛?${r.compiledCommands}鏉t螖R=${r.dRealities}\t螖EC=${r.dEC.reduce((x, y) => x + y, 0)}\t`
    + `EP ${r.startEP.slice(0, 12)}鈫?{r.endEP.slice(0, 12)}\tRM ${r.startRM.slice(0, 10)}鈫?{r.endRM.slice(0, 10)}\t`
    + `${r.endRunning ? "杩愯涓? : `宸插仠(line ${r.endLine}, mode ${r.endMode})`}`
    + (r.notifyErrors.length ? `\t閿欒:${JSON.stringify(r.notifyErrors)}` : "");

console.log(`---- 瀛樻。 ${saveFile} / F=${FACTOR} / ${FRAMES} 甯э紙${(FRAMES * FRAME_MS / 1000).toFixed(0)} 绉掔幇瀹烇級 ----`);
console.log(rows.map(fmt).join("\n"));

if (errs.length) console.log(`\n[椤甸潰/鎺у埗鍙伴敊璇?${errs.length} 鏉\n` + errs.slice(0, 8).join("\n"));

fs.writeFileSync(OUT, JSON.stringify({
  generatedAt: new Date().toISOString(), root: ROOT, save: saveFile, factor: FACTOR,
  frames: FRAMES, frameMs: FRAME_MS, rows, pageErrors: errs,
}, null, 1), "utf-8");
console.log(`\n鏁版嵁宸插啓鍏?${OUT}`);

await browser.close();
server.close();
process.exit(errs.length === 0 ? 0 : 1);
