// 只读诊断：自动机执行一整段社区脚本（一次 Reality 流程）需要多少现实时间，
// 以及 F=1 与 F=10000 是否一致（若一致，说明自动机完全不受全局加速影响）。
// 用法：node diag-automator-pass.mjs --save=... --script=4 [--maxFrames=20000]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const ROOT = "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/AD-Oreki-Edition";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/_saves/samples";
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon",
};
const argNum = (k, d) => { const h = process.argv.find(a => a.startsWith(`--${k}=`)); const v = h ? Number(h.split("=")[1]) : NaN; return Number.isFinite(v) ? v : d; };
const argStr = (k, d) => { const h = process.argv.find(a => a.startsWith(`--${k}=`)); return h ? h.split("=")[1] : d; };

const SAVE = argStr("save", "861._92R+1.0e11RM.txt");
const SCRIPT_ID = argNum("script", 4);
const MAX_FRAMES = argNum("maxFrames", 20000);
const FRAME_MS = 20;

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
await new Promise(r => server.listen(8497, "127.0.0.1", r));

const browser = await launchViaConnect({ protocolTimeout: 600000 });
const page = await browser.newPage();
const errs = [];
const NOISE = /googletagmanager|google-analytics|kaspersky-labs|Vue warn|progress\.info/;
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => { if (m.type() === "error" && !NOISE.test(m.text())) errs.push(`CONSOLE: ${m.text().slice(0, 200)}`); });
await page.goto("http://127.0.0.1:8497/index.html", { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 80; i++) {
  const ok = await page.evaluate(() => { try { return typeof gameLoop === "function"; } catch (e) { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

await page.evaluate(() => {
  window.__p = {
    setup(text, F, scriptId) {
      try { GameIntervals.stop(); } catch (e) { }
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { }
      GameSpeed.set(F);
      player.auto.autobuyersOn = true;
      player.reality.automator.forceUnlock = true;
      AutomatorBackend.state.repeat = false;
      AutomatorBackend.start(scriptId);
      AutomatorBackend.state.mode = 2;
      return {
        interval: +AutomatorBackend.currentInterval.toFixed(2),
        lines: (AutomatorBackend.currentRawText || "").split("\n").length,
        realities: +player.realities,
      };
    },
    // 跑到栈空（脚本结束）或达到帧上限；返回帧数与过程中的行号轨迹采样
    run(maxFrames, ms) {
      const trace = [];
      let frames = 0;
      for (let i = 0; i < maxFrames; i++) {
        if (AutomatorBackend.stack.isEmpty) break;
        gameLoop(ms);
        frames++;
        if (i % 50 === 0) {
          const top = AutomatorBackend.stack.top;
          trace.push([i, top ? top.lineNumber : -1]);
        }
      }
      return {
        frames,
        done: AutomatorBackend.stack.isEmpty,
        line: AutomatorBackend.stack.top ? AutomatorBackend.stack.top.lineNumber : -1,
        realities: +player.realities,
        trace: trace.slice(0, 40),
      };
    },
  };
});

const text = fs.readFileSync(path.join(SAVE_DIR, SAVE), "utf-8");
for (const F of [1, 10000]) {
  const info = await page.evaluate(({ t, F, id }) => window.__p.setup(t, F, id), { t: text, F, id: SCRIPT_ID });
  const t0 = Date.now();
  const r = await page.evaluate(({ n, ms }) => window.__p.run(n, ms), { n: MAX_FRAMES, ms: FRAME_MS });
  const cpu = Date.now() - t0;
  console.log(`\n[F=${F}] 节拍=${info.interval}ms 脚本=${info.lines}行`);
  console.log(`  一次完整流程：${r.done ? "已完成" : `未完成（卡在第 ${r.line} 行）`}，` +
    `${r.frames} 帧 → 模拟现实时间 ${(r.frames * FRAME_MS / 1000).toFixed(1)}s（CPU ${(cpu / 1000).toFixed(1)}s）`);
  console.log(`  Reality ${info.realities} → ${r.realities}（Δ${r.realities - info.realities}）`);
  console.log(`  行号轨迹(每50帧): ${r.trace.map(t => `${t[0]}:${t[1]}`).join(" ")}`);
}
if (errs.length) console.log("\n异常：" + errs.slice(0, 5).join(" | "));
await browser.close();
server.close();
