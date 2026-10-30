// 自动机执行节拍 A/B：currentInterval 是否应按全局速度缩放
// 固定存档 + 固定 F + 固定「现实时间」（帧长 20ms × 帧数）比较真实进度。
// 用法：node exp-automator-cadence.mjs --save=861...txt --script=2 --frames=600 [--F=10000]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const ROOT = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon",
};
const argNum = (k, d) => { const h = process.argv.find(a => a.startsWith(`--${k}=`)); const v = h ? Number(h.split("=")[1]) : NaN; return Number.isFinite(v) ? v : d; };
const argStr = (k, d) => { const h = process.argv.find(a => a.startsWith(`--${k}=`)); return h ? h.split("=")[1] : d; };

const SAVE = argStr("save", "861._92R+1.0e11RM.txt");
const SCRIPT_ID = argNum("script", 2);
const FRAMES = argNum("frames", 600);
const WARM = argNum("warm", 0);
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
await new Promise(r => server.listen(8495, "127.0.0.1", r));

const browser = await launchViaConnect({ protocolTimeout: 600000 });
const page = await browser.newPage();
const errs = [];
const NOISE = /googletagmanager|google-analytics|kaspersky-labs|Vue warn|progress\.info/;
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => { if (m.type() === "error" && !NOISE.test(m.text())) errs.push(`CONSOLE: ${m.text().slice(0, 200)}`); });
await page.goto("http://127.0.0.1:8495/index.html", { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 80; i++) {
  const ok = await page.evaluate(() => { try { return typeof gameLoop === "function"; } catch (e) { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

await page.evaluate(() => {
  const lg = v => { try { const d = v.log10 ? v.log10() : v; const n = d && d.toNumber ? d.toNumber() : Number(d); return Number.isFinite(n) ? n : NaN; } catch (e) { return NaN; } };
  window.__a = {
    cmds: 0, restarts: 0, baseMs: 0,
    setup(text, F, scriptId, scaled) {
      try { GameIntervals.stop(); } catch (e) { }
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { }
      GameSpeed.set(F);
      player.auto.autobuyersOn = true;
      player.reality.automator.forceUnlock = true;

      // 生产开关（若已撤下则用实例级覆盖模拟，结论见 _research/automator-cadence-实验结论.md）
      const base = () => Math.clampMin(Math.pow(0.994, Currency.realities.value) * 500, 1);
      window.__a.baseMs = base();
      if (typeof GameSpeed.setScaleAutomatorCadence === "function") {
        GameSpeed.setScaleAutomatorCadence(scaled);
      } else {
        Object.defineProperty(AutomatorBackend, "currentInterval", {
          configurable: true,
          get: () => (scaled ? Math.clampMin(base() / Math.max(1, getGlobalSpeedFactor()), 0.001) : base()),
        });
      }

      // 只包裹一次：setup 会被多臂反复调用，重复包裹会让计数翻倍
      if (!AutomatorBackend.__origStep) {
        AutomatorBackend.__origStep = AutomatorBackend.step;
        AutomatorBackend.step = function (...a) { window.__a.cmds++; return AutomatorBackend.__origStep.apply(this, a); };
      }
      if (!AutomatorBackend.__origRestart) {
        AutomatorBackend.__origRestart = AutomatorBackend.restart;
        AutomatorBackend.restart = function (...a) { window.__a.restarts++; return AutomatorBackend.__origRestart.apply(this, a); };
      }

      AutomatorBackend.state.repeat = true;
      // 只让脚本自己产生 Reality，排除存档自带 Reality 自动购买器的干扰
      try { Autobuyer.reality.isActive = false; player.auto.reality.isActive = false; } catch (e) { }
      AutomatorBackend.start(scriptId);
      AutomatorBackend.state.mode = 2; // RUN
      window.__a.cmds = 0;
      window.__a.restarts = 0;
      return {
        unlocked: Player.automatorUnlocked,
        forceUnlocked: player.reality.automator.forceUnlock,
        realities: player.realities,
        baseMs: +window.__a.baseMs.toFixed(2),
        effMs: +AutomatorBackend.currentInterval.toFixed(4),
        scriptLen: (AutomatorBackend.currentRawText || "").split("\n").length,
        isRunning: AutomatorBackend.isRunning,
      };
    },
    step(n, ms) { for (let i = 0; i < n; i++) gameLoop(ms); },
    snap() {
      let ecSum = 0;
      try { for (const v of Object.values(player.eternityChalls || {})) ecSum += (typeof v === "number" ? v : 0); } catch (e) { }
      const num = v => { try { return v && v.toNumber ? v.toNumber() : Number(v); } catch (e) { return NaN; } };
      return {
        eternities: num(player.eternities),
        realities: num(player.realities),
        infinities: num(player.infinities),
        tt: num(player.timestudy.theorem),
        ecSum,
        epLog: +lg(Currency.eternityPoints.value).toFixed(2),
        rmLog: +lg(player.reality.realityMachines).toFixed(2),
        line: AutomatorBackend.stack.top ? AutomatorBackend.stack.top.lineNumber : -1,
        cmds: window.__a.cmds,
        restarts: window.__a.restarts,
        realS: +(player.records.realTimePlayed / 1000).toFixed(2),
      };
    },
  };
});

const text = fs.readFileSync(path.join(SAVE_DIR, SAVE), "utf-8");
const rows = [];
for (const F of [1, 10000]) {
  for (const scaled of [false, true]) {
    const info = await page.evaluate(({ t, F, s, id }) => window.__a.setup(t, F, id, s), { t: text, F, s: scaled, id: SCRIPT_ID });
    if (WARM > 0) await page.evaluate(({ n, ms }) => window.__a.step(n, ms), { n: WARM, ms: FRAME_MS });
    const s0 = await page.evaluate(() => window.__a.snap());
    const t0 = Date.now();
    await page.evaluate(({ n, ms }) => window.__a.step(n, ms), { n: FRAMES, ms: FRAME_MS });
    const cpu = Date.now() - t0;
    const s1 = await page.evaluate(() => window.__a.snap());
    rows.push({ F, scaled, info, s0, s1, cpu });
    console.log(`\n[${SAVE} script=${SCRIPT_ID} F=${F} 节拍${scaled ? "缩放" : "原样"}] ` +
      `base=${info.baseMs}ms eff=${info.effMs}ms running=${info.isRunning} unlocked=${info.unlocked} 脚本${info.scriptLen}行`);
    console.log(`  现实窗口 ${(FRAMES * FRAME_MS / 1000).toFixed(1)}s（CPU ${(cpu / 1000).toFixed(1)}s, ${(cpu / FRAMES).toFixed(1)}ms/帧）`);
    console.log(`  自动机执行 ${s1.cmds - s0.cmds} 次尝试 / 重启 ${s1.restarts - s0.restarts} 次，行号 ${s0.line}→${s1.line}`);
    console.log(`  永恒 ${s0.eternities}→${s1.eternities}  Δ${(s1.eternities - s0.eternities).toLocaleString()}`);
    console.log(`  现实 ${s0.realities}→${s1.realities}  Δ${(s1.realities - s0.realities).toLocaleString()}`);
    console.log(`  无限 ${s0.infinities}→${s1.infinities}  Δ${(s1.infinities - s0.infinities).toLocaleString()}`);
    console.log(`  TT ${s0.tt}→${s1.tt}  Δ${(s1.tt - s0.tt).toLocaleString()}   EC合计 ${s0.ecSum}→${s1.ecSum}  Δ${s1.ecSum - s0.ecSum}`);
    console.log(`  log10(EP) ${s0.epLog}→${s1.epLog} (Δ${(s1.epLog - s0.epLog).toFixed(2)})  log10(RM) ${s0.rmLog}→${s1.rmLog} (Δ${(s1.rmLog - s0.rmLog).toFixed(2)})`);
  }
}

if (errs.length) console.log("\n异常：" + errs.slice(0, 6).join(" | "));
await browser.close();
server.close();
