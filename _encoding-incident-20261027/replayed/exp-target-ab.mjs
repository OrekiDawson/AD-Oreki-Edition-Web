// 单目标 A/B：自动购买器 interval 缩放（目标由 --target 指定）
// 关键修正：阻塞判定用「帧首状态」——gates 满足但 canTick 因 interval 未到而为 false，
// 这样即使该帧内随即购买成功也不会漏计机会。
// 用法：node exp-target-ab.mjs --target=galaxy --saves=a.txt,b.txt [--frames=400] [--warm=100]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const ROOT = "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/AD-Oreki-Edition";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/_saves/samples";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };
const argNum = (k, d) => { const h = process.argv.find(a => a.startsWith(`--${k}=`)); const v = h ? Number(h.split("=")[1]) : NaN; return Number.isFinite(v) && v > 0 ? v : d; };
const argStr = (k, d) => { const h = process.argv.find(a => a.startsWith(`--${k}=`)); return h ? h.split("=")[1] : d; };
const TARGET = argStr("target", "galaxy");
const FRAMES = argNum("frames", 400);
const WARM = argNum("warm", 100);
const FRAME_MS = 20;
const SAVES = argStr("saves", "132._9.1e137IP.txt").split(",");

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
await new Promise(r => server.listen(8491, "127.0.0.1", r));
const browser = await launchViaConnect({ protocolTimeout: 300000 });
const page = await browser.newPage();
const errs = [];
const NOISE = /googletagmanager|google-analytics|kaspersky-labs|Vue warn|progress\.info/;
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => { if (m.type() === "error" && !NOISE.test(m.text())) errs.push(`CONSOLE: ${m.text().slice(0, 160)}`); });
await page.goto("http://127.0.0.1:8491/index.html", { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 80; i++) {
  const ok = await page.evaluate(() => { try { return typeof gameLoop === "function"; } catch (e) { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

await page.evaluate(() => {
  const lg = v => { try { const d = v.log10 ? v.log10() : v; const n = d && d.toNumber ? d.toNumber() : Number(d); return Number.isFinite(n) ? n : NaN; } catch (e) { return NaN; } };
  window.__x = {
    lg,
    tickCount: 0,
    hooked: false,
    hook(target) {
      if (this.hooked) return;
      const b = Autobuyer[target];
      const orig = b.tick.bind(b);
      b.tick = (...a) => { window.__x.tickCount++; return orig(...a); };
      this.hooked = true;
    },
    gates(target) {
      return target === "galaxy"
        ? Galaxy.canBeBought && Galaxy.requirement.isSatisfied
        : DimBoost.canBeBought && DimBoost.requirement.isSatisfied;
    },
    setup(text, F, target, scaled) {
      try { GameIntervals.stop(); } catch (e) { }
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { }
      GameSpeed.set(F);
      GameSpeed.setScaleAutobuyerInterval(true);
      GameSpeed.setScaleTickspeedAutobuyerInterval(true);
      player.auto.autobuyersOn = true;
      const b = Autobuyer[target];
      if (!b.isBought) b.data.isBought = true;
      b.isActive = true;
      Object.defineProperty(b, "usesSpeedScaledInterval", { configurable: true, get: () => scaled });
      this.target = target;
      this.tickCount = 0;
      this.st = { ready: 0, blocked: 0, readyAndAllowed: 0, ticked: 0, frames: 0, postReadyNoTick: 0, trace: [] };
      return {
        F, scaled, target,
        interval: b.interval, effective: b.effectiveInterval,
        buyMax: target === "galaxy"
          ? EternityMilestone.autobuyMaxGalaxies.isReached
          : BreakInfinityUpgrade.autobuyMaxDimboosts.isBought,
      };
    },
    step(n, ms) {
      for (let i = 0; i < n; i++) {
        const ready = this.gates(this.target);
        const canTick = Autobuyer[this.target].canTick;
        const before = this.tickCount;
        if (ready) {
          this.st.ready++;
          if (canTick) this.st.readyAndAllowed++;
          else this.st.blocked++;
        }
        gameLoop(ms);
        this.st.frames++;
        const tickedThisFrame = this.tickCount > before;
        if (tickedThisFrame) this.st.ticked++;
        // 帧末门槛已满足但本帧没触发 → 说明在 loop 内部就被 interval 挡住了
        if (this.gates(this.target) && !tickedThisFrame) this.st.postReadyNoTick++;
        if (i % 100 === 99) {
          this.st.trace.push({
            f: i + 1,
            gal: player.galaxies,
            boost: DimBoost.purchasedBoosts,
            maxAm: +this.lg(player.records.thisInfinity.maxAM).toFixed(1),
            ip: +this.lg(Currency.infinityPoints.value).toFixed(1),
            ep: +this.lg(Currency.eternityPoints.value).toFixed(1),
          });
        }
      }
      return JSON.parse(JSON.stringify(this.st));
    },
    snap() {
      return {
        amLog: +lg(Currency.antimatter.value).toFixed(3),
        maxAmLog: +lg(player.records.thisInfinity.maxAM).toFixed(3),
        galaxies: player.galaxies,
        boosts: DimBoost.purchasedBoosts,
        ipLog: +lg(Currency.infinityPoints.value).toFixed(3),
        epLog: +lg(Currency.eternityPoints.value).toFixed(3),
        gameS: +(player.records.totalTimePlayed / 1000).toFixed(2),
        realS: +(player.records.realTimePlayed / 1000).toFixed(2),
      };
    },
  };
});

const rows = [];
for (const saveFile of SAVES) {
  const text = fs.readFileSync(path.join(SAVE_DIR, saveFile), "utf-8");
  const runArm = async (F, scaled, label) => {
    const info = await page.evaluate(({ t, F, target, s }) => {
      window.__x.hook(target);
      return window.__x.setup(t, F, target, s);
    }, { t: text, F, target: TARGET, s: scaled });
    await page.evaluate(({ n, ms }) => window.__x.step(n, ms), { n: WARM, ms: FRAME_MS });
    const s0 = await page.evaluate(() => window.__x.snap());
    const t0 = Date.now();
    const st = await page.evaluate(({ n, ms }) => window.__x.step(n, ms), { n: FRAMES, ms: FRAME_MS });
    const cpu = Date.now() - t0;
    const s1 = await page.evaluate(() => window.__x.snap());
    const row = {
      saveFile, label, F, scaled, info, s0, s1,
      ready: st.ready, blocked: st.blocked, allowed: st.readyAndAllowed, ticked: st.ticked, postNoTick: st.postReadyNoTick,
      dGal: s1.galaxies - s0.galaxies, dBoost: s1.boosts - s0.boosts,
      dMaxAm: +(s1.maxAmLog - s0.maxAmLog).toFixed(2),
      dIP: +(s1.ipLog - s0.ipLog).toFixed(3),
      dEP: +(s1.epLog - s0.epLog).toFixed(3),
      dGameS: +(s1.gameS - s0.gameS).toFixed(1),
      dRealS: +(s1.realS - s0.realS).toFixed(3),
      cpuPerFrame: +(cpu / FRAMES).toFixed(3),
      trace: st.trace,
    };
    rows.push(row);
    console.log(`  ${saveFile.slice(0, 26).padEnd(28)} ${label.padEnd(16)} F=${String(F).padStart(5)} ` +
      `${scaled ? "缩放开" : "缩放关"} eff=${String(info.effective).slice(0, 7)}ms ` +
      `| ready=${row.ready} blocked=${row.blocked} allowed=${row.allowed} ticked=${row.ticked} postNoTick=${row.postNoTick} ` +
      `| Δgal=${row.dGal} Δboost=${row.dBoost} ΔlogMaxAM=${row.dMaxAm} ΔIP=${row.dIP} ΔEP=${row.dEP} ` +
      `Δ游戏=${row.dGameS}s CPU/帧=${row.cpuPerFrame}ms`);
    return row;
  };
  console.log(`\n=== ${saveFile}｜target=${TARGET}｜预热 ${WARM}｜测量 ${FRAMES} 帧 × ${FRAME_MS}ms ===`);
  await runArm(10000, false, "F=10000 关");
  await runArm(10000, true, "F=10000 开");
  await runArm(1, false, "F=1 关");
  await runArm(1, true, "F=1 开");
}

const out = "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/_research/exp-target-ab.json";
fs.writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), target: TARGET, warm: WARM, frames: FRAMES, frameMs: FRAME_MS, rows, errors: errs }, null, 2));
console.log(`\n已写入 ${out}`);
if (errs.length) console.log("异常：", errs.slice(0, 3));
await browser.close();
server.close();
