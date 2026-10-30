// 自动机脚本导入 → 运行槽接管 行为探针
//
// 验证 `AutomatorBackend.adoptImportedScript()`：
//   正向：自动机正在运行 → 导入脚本后运行槽切到新脚本且继续运行（老行为：仍跑旧脚本）
//   边界 A：自动机已停止 → 只导入不启动，运行槽不变
//   边界 B：自动机已暂停 → 切运行槽但保持暂停
//   对照：绕过 adoptImportedScript 走老代码路径，确认老行为确实是「不切换」
//
// 用法：node verify-automator-import-adopt.mjs
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
    // 用「模式」把自动机摆到指定状态：stopped / running / paused
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
    // 走修好后的真实入口
    importVia(raw) {
      const adopted = AutomatorBackend.importFullScriptData(raw, { presets: false, constants: false });
      return { adopted, ...this.describe() };
    },
    // 走「修复前」的等价路径：createNewScript + initializeFromSave，不接管运行槽
    importLegacy(raw) {
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
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? `  —— ${detail}` : ""}`);
};

// ---------- 1. 正向：运行中导入 → 运行槽切换并继续运行 ----------
let r = await page.evaluate(({ a, b }) => {
  window.__a.reset();
  const before = window.__a.prime(a, "running");
  window.__a.step(30, 20);
  const after = window.__a.importVia(b);
  window.__a.step(60, 20);
  return { before, after, final: window.__a.describe() };
}, { a: SCRIPT_A, b: SCRIPT_B });
check("正向：导入前运行的是 A 脚本（RealFast）", r.before.topLevelName === "Ninja RealFast v3",
  `topLevel=${r.before.topLevelName}`);
check("正向：导入 B 后运行槽切到 B（LSF-NORM）", r.after.topLevelName === "LSF-NORM",
  `topLevel=${r.after.topLevelName}, adopted=${r.after.adopted}`);
check("正向：导入后仍在运行", r.after.isRunning === true, `isRunning=${r.after.isRunning}, mode=${r.after.mode}`);
check("正向：运行内容确实是 B（行数与 A 不同）", r.after.lines !== r.before.lines,
  `A=${r.before.lines}行 → B=${r.after.lines}行`);
check("正向：切换后 60 帧仍在运行（没有立刻结束）", r.final.running === true, `running=${r.final.running}`);

// ---------- 2. 对照：修复前路径不切换运行槽 ----------
r = await page.evaluate(({ a, b }) => {
  window.__a.reset();
  const before = window.__a.prime(a, "running");
  window.__a.step(30, 20);
  const after = window.__a.importLegacy(b);
  return { before, after };
}, { a: SCRIPT_A, b: SCRIPT_B });
check("对照：修复前路径导入后运行槽仍是 A（Bug 复现）",
  r.after.topLevelName === "Ninja RealFast v3" && r.after.editorName === "LSF-NORM",
  `运行=${r.after.topLevelName} / 编辑=${r.after.editorName}`);

// ---------- 3. 边界 A：已停止 → 只导入不启动 ----------
r = await page.evaluate(({ a, b }) => {
  window.__a.reset();
  const before = window.__a.prime(a, "stopped");
  const after = window.__a.importVia(b);
  return { before, after };
}, { a: SCRIPT_A, b: SCRIPT_B });
check("边界A：自动机停止状态下导入不会自动启动", r.after.isOn === false && r.after.isRunning === false,
  `isOn=${r.after.isOn}, isRunning=${r.after.isRunning}`);
check("边界A：停止状态下运行槽保持不变", r.after.topLevelID === r.before.topLevelID,
  `topLevel ${r.before.topLevelID} → ${r.after.topLevelID}`);
check("边界A：新脚本仍被设为编辑中（玩家可自行选择）", r.after.editorName === "LSF-NORM",
  `editor=${r.after.editorName}`);

// ---------- 4. 边界 B：已暂停 → 切槽但保持暂停 ----------
r = await page.evaluate(({ a, b }) => {
  window.__a.reset();
  const before = window.__a.prime(a, "paused");
  const after = window.__a.importVia(b);
  window.__a.step(40, 20);
  return { before, after, final: window.__a.describe() };
}, { a: SCRIPT_A, b: SCRIPT_B });
check("边界B：暂停状态下导入后运行槽切到 B", r.after.topLevelName === "LSF-NORM",
  `topLevel=${r.after.topLevelName}`);
check("边界B：导入后仍保持暂停（不擅自继续）",
  r.after.mode === 0 && r.after.isRunning === false && r.final.running === false,
  `mode=${r.after.mode}, isRunning=${r.after.isRunning}, 跑 40 帧后 running=${r.final.running}`);

// ---------- 5. 二次导入同一脚本：不重复堆积运行态、不崩 ----------
r = await page.evaluate(({ b }) => {
  window.__a.reset();
  window.__a.prime(b, "running");
  const first = window.__a.importVia(b);
  const second = window.__a.importVia(b);
  window.__a.step(30, 20);
  return { first, second, final: window.__a.describe() };
}, { b: SCRIPT_B });
check("重复导入：两次导入后仍只有一份运行槽且运行正常",
  r.second.topLevelName === "LSF-NORM" && r.final.running === true && r.second.editorID !== r.first.editorID,
  `topLevel=${r.second.topLevelName}, running=${r.final.running}`);

check("页面/控制台无错误", errs.length === 0, errs.length ? errs.slice(0, 4).join(" | ") : "0 条");

fs.writeFileSync(OUT, JSON.stringify({
  generatedAt: new Date().toISOString(), save: "861._92R+1.0e11RM", factor: 10000,
  rows, pageErrors: errs,
}, null, 1), "utf-8");
console.log(`\n数据已写入 ${OUT}`);

const failed = rows.filter(x => !x.ok).length;
console.log(`合计 ${rows.length} 项：PASS ${rows.length - failed} / FAIL ${failed}`);

await browser.close();
server.close();
process.exit(failed === 0 ? 0 : 1);
