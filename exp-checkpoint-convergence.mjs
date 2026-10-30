// 检查点收敛测试（Web 端，决定论）：同一存档、同一自动化配置下，
// 测「到达固定里程碑所需的游戏时间 T_game 是否与全局倍率 F 无关」。
//
// 判据（来自 docs/AUTOBUYER_THROUGHPUT_AUDIT_2026-10-28.md §5）：
//   T_game(F=1/2/10000) 基本一致（≤1%） → 加速已完全兑现，无可修项
//   T_game 随 F 显著变长（≥3×）        → 存在真缺陷，缺口即「可修的现实时间」
//
// 用法：node _tools/exp-checkpoint-convergence.mjs [--save=29._2AG+9DB+1e50AM.txt] [--Fs=1,2,10000]
// 说明：完全手动驱动 gameLoop(20)，GameIntervals 已停，不依赖墙钟，可重复。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const ROOT = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";
const OUT_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };

const argVal = (k, d) => { const h = process.argv.find(a => a.startsWith(`--${k}=`)); return h ? h.split("=").slice(1).join("=") : d; };
const SAVE_FILE = argVal("save", "29._2AG+9DB+1e50AM.txt");
const Fs = argVal("Fs", "1,2,10000").split(",").map(Number).filter(v => v > 0);
const MAX_FRAMES = Number(argVal("maxFrames", 300000));
const FRAME_MS = 20;
const TAG = argVal("tag", "");
const INTERVAL = Number(argVal("interval", 0));
const CPU_FRAMES = Number(argVal("cpuFrames", 0));

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(ROOT, "." + p);
  const rel = path.relative(ROOT, f);
  if (rel.startsWith("..") || path.isAbsolute(rel)) { res.writeHead(403).end(); return; }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(8482, "127.0.0.1", r));

const browser = await launchViaConnect({ protocolTimeout: 900000 });
const page = await browser.newPage();
const errs = [];
const NOISE = /googletagmanager|google-analytics|kaspersky-labs|Vue warn|progress\.info/;
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => { if (m.type() === "error" && !NOISE.test(m.text())) errs.push(`CONSOLE: ${m.text().slice(0, 160)}`); });
await page.goto("http://127.0.0.1:8481".replace("8481", "8482") + "/index.html", { waitUntil: "load", timeout: 60000 });

let ready = false;
for (let i = 0; i < 80; i++) {
  ready = await page.evaluate(() => { try { return typeof gameLoop === "function" && typeof player === "object"; } catch (e) { return false; } }).catch(() => false);
  if (ready) break;
  await new Promise(r => setTimeout(r, 400));
}
if (!ready) { console.log("FAIL 游戏未启动"); await browser.close(); server.close(); process.exit(1); }

await page.evaluate(() => {
  const lg = v => { if (v && typeof v.log10 === "function") { const d = v.log10(); const n = d && d.toNumber ? d.toNumber() : Number(d); return Number.isFinite(n) ? n : NaN; } const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.log10(n) : NaN; };
  const num = v => { const n = v && v.toNumber ? v.toNumber() : Number(v); return Number.isFinite(n) ? n : NaN; };

  window.__k = {
    lg, num,
    // 载入存档 + 设 F，停掉自动循环（决定论）
    setup(text, F, forcedInterval) {
      try { GameIntervals.stop(); } catch (e) { }
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { }
      GameSpeed.set(F);
      // 一致性：两端都保持默认（缩放开关关），因为本次是测「默认状态」的兑现度
      GameSpeed.setScaleAutobuyerInterval(false);
      GameSpeed.setScaleTickspeedAutobuyerInterval(false);
      const on = [];
      const iv = Number(forcedInterval);
      try {
        Autobuyer.antimatterDimension.zeroIndexed.forEach(b => { if (b.isBought) { b.data.isActive = true; if (iv > 0) { b.data.interval = iv; b.data.lastTick = player.records.realTimePlayed; } } on.push('AD'); });
      } catch (e) { }
      try { if (Autobuyer.tickspeed.isBought) { Autobuyer.tickspeed.data.isActive = true; if (iv > 0) { Autobuyer.tickspeed.data.interval = iv; Autobuyer.tickspeed.data.lastTick = player.records.realTimePlayed; } on.push('TS'); } } catch (e) { }
      try { if (Autobuyer.bigCrunch.isBought) { Autobuyer.bigCrunch.data.isActive = false; } } catch (e) { }
      return {
        F: GameSpeed.factor,
        startAM: lg(Currency.antimatter.value),
        startInf: num(Currency.infinities.value),
        startEt: num(Currency.eternities.value),
        startReal: num(player.records.realTimePlayed),
        autoOn: on,
      };
    },
    // CPU 预算探针：稳态下每帧耗时（含微步）
    cpuProbe(n, frameMs) {
      const t0 = performance.now();
      for (let i = 0; i < n; i++) gameLoop(frameMs);
      return { avgMs: (performance.now() - t0) / n, n };
    },
    // 单次 evaluate 内跑完全部帧，避免逐帧 IPC 开销
    runMilestones(maxFrames, frameMs, targets) {
      const num = v => { const n = v && v.toNumber ? v.toNumber() : Number(v); return Number.isFinite(n) ? n : NaN; };
      const lg = v => { try { return num(v.log10()); } catch (e) { return NaN; } };
      const hit = {};
      const g0 = player.records.totalTimePlayed, r0 = player.records.realTimePlayed;
      for (let i = 0; i < maxFrames; i++) {
        gameLoop(frameMs);
        const inf = num(Currency.infinities.value);
        const et = num(Currency.eternities.value);
        const rl = num(Currency.realities?.value);
        const am = lg(Currency.antimatter.value);
        if (hit.infinities === undefined && inf > 0) hit.infinities = { frame: i + 1, dGame: player.records.totalTimePlayed - g0, dReal: player.records.realTimePlayed - r0 };
        if (hit.eternities === undefined && et > 0) hit.eternities = { frame: i + 1, dGame: player.records.totalTimePlayed - g0, dReal: player.records.realTimePlayed - r0 };
        if (hit.realities === undefined && rl > 0) hit.realities = { frame: i + 1, dGame: player.records.totalTimePlayed - g0, dReal: player.records.realTimePlayed - r0 };
        for (const t of targets) {
          if (hit['am' + t] === undefined && am >= t) hit['am' + t] = { frame: i + 1, dGame: player.records.totalTimePlayed - g0, dReal: player.records.realTimePlayed - r0 };
        }
        if (hit.infinities && hit.eternities && hit.realities && targets.every(t => hit['am' + t])) { hit.totalFrames = i + 1; break; }
      }
      hit.totalFrames = hit.totalFrames || maxFrames;
      hit.finalAM = lg(Currency.antimatter.value);
      hit.finalInf = num(Currency.infinities.value);
      hit.finalEt = num(Currency.eternities.value);
      hit.finalReal = player.records.realTimePlayed - r0;
      return hit;
    },
  };
});

const saveText = fs.readFileSync(path.join(SAVE_DIR, SAVE_FILE), "utf-8");
const rows = [];
for (const F of Fs) {
  const info = await page.evaluate(({ text, F, iv }) => window.__k.setup(text, F, iv), { text: saveText, F, iv: INTERVAL });
  // 目标 AM 阈值：起点 +100 / +200 个数量级（该阶段内单调，用作「固定阈值」检查点）
  const targets = [Math.ceil(info.startAM + 100), Math.ceil(info.startAM + 200)];
  if (CPU_FRAMES > 0) {
    const cpu = await page.evaluate(({ n, ms }) => window.__k.cpuProbe(n, ms), { n: CPU_FRAMES, ms: FRAME_MS });
    console.log(`F=${String(F).padStart(5)} | CPU 稳态 ${cpu.avgMs.toFixed(2)} ms/帧（${cpu.n} 帧）`);
  }
  const t0 = Date.now();
  const hit = await page.evaluate(({ mf, ms, tg }) => window.__k.runMilestones(mf, ms, tg), { mf: MAX_FRAMES, ms: FRAME_MS, tg: targets });
  const wall = Date.now() - t0;
  const row = { F, start: info, targets, hit, cpuMs: wall };
  rows.push(row);
  const f = k => (hit[k] ? `${(hit[k].dGame / 1000).toFixed(1)}s/${hit[k].frame}f` : '未达');
  console.log(`F=${String(F).padStart(5)} | 首个∞=${f('infinities')} 首个Eternity=${f('eternities')} 首个Reality=${f('realities')} | +100数量级=${f('am' + targets[0])} | Δreal=${(hit.finalReal / 1000).toFixed(1)}s | cpu=${wall}ms`);
}

const out = { generatedAt: new Date().toISOString(), save: SAVE_FILE, frameMs: FRAME_MS, maxFrames: MAX_FRAMES, rows, errors: errs };
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, `exp-checkpoint${TAG}.json`), JSON.stringify(out, null, 2));

// 收敛比：以 F=1 为基准
const base = rows.find(r => r.F === 1) || rows[0];
console.log('\n收敛比（T_game(F) / T_game(F=1)，越接近 1 越健康）：');
for (const r of rows) {
  const ratio = (k) => (base.hit[k] && r.hit[k]) ? (r.hit[k].dGame / base.hit[k].dGame).toFixed(3) : '—';
  console.log(`  F=${String(r.F).padStart(5)}  首个∞=${ratio('infinities')}  +100量级=${ratio('am' + r.targets[0])}`);
}
console.log(`\n已写入 _research/exp-checkpoint${TAG}.json  errors=${errs.length}`);
await browser.close();
server.close();
process.exit(errs.length ? 1 : 0);
