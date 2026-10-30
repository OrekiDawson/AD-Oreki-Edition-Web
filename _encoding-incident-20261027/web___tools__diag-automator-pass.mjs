// 鍙璇婃柇锛氳嚜鍔ㄦ満鎵ц涓€鏁存绀惧尯鑴氭湰锛堜竴娆?Reality 娴佺▼锛夐渶瑕佸灏戠幇瀹炴椂闂达紝
// 浠ュ強 F=1 涓?F=10000 鏄惁涓€鑷达紙鑻ヤ竴鑷达紝璇存槑鑷姩鏈哄畬鍏ㄤ笉鍙楀叏灞€鍔犻€熷奖鍝嶏級銆?// 鐢ㄦ硶锛歯ode diag-automator-pass.mjs --save=... --script=4 [--maxFrames=20000]
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
    // 璺戝埌鏍堢┖锛堣剼鏈粨鏉燂級鎴栬揪鍒板抚涓婇檺锛涜繑鍥炲抚鏁颁笌杩囩▼涓殑琛屽彿杞ㄨ抗閲囨牱
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
  console.log(`\n[F=${F}] 鑺傛媿=${info.interval}ms 鑴氭湰=${info.lines}琛宍);
  console.log(`  涓€娆″畬鏁存祦绋嬶細${r.done ? "宸插畬鎴? : `鏈畬鎴愶紙鍗″湪绗?${r.line} 琛岋級`}锛宍 +
    `${r.frames} 甯?鈫?妯℃嫙鐜板疄鏃堕棿 ${(r.frames * FRAME_MS / 1000).toFixed(1)}s锛圕PU ${(cpu / 1000).toFixed(1)}s锛塦);
  console.log(`  Reality ${info.realities} 鈫?${r.realities}锛埼?{r.realities - info.realities}锛塦);
  console.log(`  琛屽彿杞ㄨ抗(姣?0甯?: ${r.trace.map(t => `${t[0]}:${t[1]}`).join(" ")}`);
}
if (errs.length) console.log("\n寮傚父锛? + errs.slice(0, 5).join(" | "));
await browser.close();
server.close();
