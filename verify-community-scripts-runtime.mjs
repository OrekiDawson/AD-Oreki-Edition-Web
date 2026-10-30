// 社区自动机脚本「真实运行」探针（不是只编译）
//
// 背景：上一轮 `_research/community-scripts-compat.json` 只验证了 41 个社区脚本能通过本项目
// 自动机编译器（语法层 PASS）。本轮要回答的是**运行时**问题：
//   1. 脚本真的能驱动游戏推进吗（ΔReality / ΔEP / ΔEC 完成数）
//   2. 会不会中途卡住 / 报错 / 触发「连续过多空操作」保护
//   3. 条件等待（wait/until）与重置决策在真实帧循环里是否按预期生效
//
// 做法：把仓库原始导出串（`AntimatterDimensionsAutomatorDataFormat...EndOfAutomatorData`）
// 直接喂给 `AutomatorBackend.importFullScriptData()`——与玩家粘贴导入完全同一条路径，
// 然后 `AutomatorBackend.start()`，用手动 `gameLoop(20)` 推进固定帧数（=固定现实时间）。
//
// 用法：node verify-community-scripts-runtime.mjs [--frames=1500] [--f=10000] [--save=861]
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
const FRAMES = argNum("frames", 1500);   // 1500 × 20ms = 30 秒现实
const FACTOR = argNum("f", 10000);
const SAVE_KEY = argStr("save", "861");
const FRAME_MS = 20;

const saveFile = fs.readdirSync(SAVE_DIR).find(f => f.startsWith(`${SAVE_KEY}.`));
if (!saveFile) throw new Error(`找不到存档 ${SAVE_KEY}`);

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
      // 帧循环必须由本探针驱动，避免真实定时器与手动 gameLoop 叠加
      player.reality.automator.state.mode = AUTOMATOR_MODE.PAUSE;
      return {
        F: GameSpeed.factor,
        eff: getGlobalSpeedFactor(),
        unlocked: Player.automatorUnlocked,
        realities: player.realities,
        ep: Currency.eternityPoints.value.toString(),
        rm: Currency.realityMachines.value.toString(),
        ec: player.eternityChallenges.completions.map(c => c),
        ecTime: player.eternityChallenges.timeSinceLastCompletion,
      };
    },
    importRun(raw) {
      try {
        AutomatorBackend.importFullScriptData(raw, { presets: false, constants: false });
      } catch (e) {
        return { ok: false, error: `import: ${e.message}` };
      }
      // importFullScriptData 只把脚本写进 scripts 表并切到「编辑中」，不会切「运行中」脚本。
      // 玩家的真实操作是导入后在脚本列表里选中它再点启动；这里等价地手动同步 topLevelScript。
      const id = AutomatorBackend.state.editorScript;
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
        ec: player.eternityChallenges.completions.map(c => c),
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
  // 预热让脚本把 autobuyer 设置跑完
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
  ? `${r.case}\t导入失败：${r.importError}`
  : `${r.case}\t${r.lines}行/${r.compiledCommands}条\tΔR=${r.dRealities}\tΔEC=${r.dEC.reduce((x, y) => x + y, 0)}\t`
    + `EP ${r.startEP.slice(0, 12)}→${r.endEP.slice(0, 12)}\tRM ${r.startRM.slice(0, 10)}→${r.endRM.slice(0, 10)}\t`
    + `${r.endRunning ? "运行中" : `已停(line ${r.endLine}, mode ${r.endMode})`}`
    + (r.notifyErrors.length ? `\t错误:${JSON.stringify(r.notifyErrors)}` : "");

console.log(`---- 存档 ${saveFile} / F=${FACTOR} / ${FRAMES} 帧（${(FRAMES * FRAME_MS / 1000).toFixed(0)} 秒现实） ----`);
console.log(rows.map(fmt).join("\n"));

if (errs.length) console.log(`\n[页面/控制台错误 ${errs.length} 条]\n` + errs.slice(0, 8).join("\n"));

fs.writeFileSync(OUT, JSON.stringify({
  generatedAt: new Date().toISOString(), root: ROOT, save: saveFile, factor: FACTOR,
  frames: FRAMES, frameMs: FRAME_MS, rows, pageErrors: errs,
}, null, 1), "utf-8");
console.log(`\n数据已写入 ${OUT}`);

await browser.close();
server.close();
process.exit(errs.length === 0 ? 0 : 1);
