// R38 主 Agent · IU15 可行性判定实验（只读生产代码，仅页面内实验性挂载）
//
// 要回答的唯一问题：
//   打开原版 IU15 锁定（ImaginaryUpgrade(15).setMechanicLock(true)）后，
//   所有无限维度都会被原版 buyMax 拒绝（ID2 生产 ID1 ⇒ tier>1 也拦）。
//   在这种「零 ID」状态下，AM 指数还能不能爬到 1.5e12？要多久？卡在哪里？
//
// 用法： node _r38m/lockexp.mjs [总秒数] [标签]
// 产出： _r38m/<标签>.jsonl（2s 一条）  _r38m/<标签>.log（10s 一条人读）
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "AD-Oreki-Edition");
const argv = process.argv.slice(2);
const DURATION = (Number(argv[0]) || 1320) * 1000;
const TAG = argv[1] || `lockexp-${Date.now()}`;
const PORT = Number(process.env.OREKI_HTTP_PORT || 8871);
const CDP_PORT = Number(process.env.OREKI_CDP_PORT || 9361);
const SAMPLE_MS = Number(process.env.OREKI_SAMPLE_MS || 2000);
const JSONL = path.join(HERE, `${TAG}.jsonl`);
const LOG = path.join(HERE, `${TAG}.log`);

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon",
  ".webm": "video/webm", ".woff2": "font/woff2",
};

const logLines = [];
function log(...a) {
  const s = a.map(x => (typeof x === "string" ? x : JSON.stringify(x))).join(" ");
  console.log(s);
  logLines.push(s);
  try { fs.writeFileSync(LOG, logLines.join("\n") + "\n"); } catch { /* ignore */ }
}

function killEdge() {
  const ps = `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | `
    + `Where-Object { $_.CommandLine -like '*remote-debugging-port=${CDP_PORT}*' } | `
    + `ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
  try { execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: "ignore" }); } catch { /* ignore */ }
}
killEdge();

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(ROOT, "." + p);
  if (!f.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(PORT, "127.0.0.1", r));
log(`[serve] ${ROOT} -> http://127.0.0.1:${PORT}/  (cdp ${CDP_PORT}, ${DURATION / 1000}s)`);

const { browser, cleanup } = await launchBrowser({ port: CDP_PORT, headless: true });
const { page, errors } = await openGame(browser, { port: PORT });
log("[open] 游戏已就绪");

// ── 页面内采样（纯读） ────────────────────────────────────────────────
const SAMPLE = () => {
  const L = v => {
    try {
      if (v === null || v === undefined) return null;
      const n = typeof v === "number" ? v : (v.log10 ? v.log10() : Number(v));
      return Number.isFinite(n) ? Math.round(n * 1e4) / 1e4 : null;
    } catch { return null; }
  };
  const S = v => { try { return v === null || v === undefined ? null : v.toString(); } catch { return null; } };
  const o = { t: Math.round((Date.now() - window.__r38mT0) / 100) / 10 };
  try {
    const p = player;
    o.real = Math.round((p.records?.totalTimePlayed ?? 0) / 1000);
    o.realities = Math.round(p.realities);
    o.amE = Number(p.antimatter?.exponent ?? 0);
    o.id1 = S(InfinityDimension(1).amount);
    o.id1Unl = (() => { try { return InfinityDimension(1).isUnlocked; } catch { return null; } })();
    o.maxID1 = S(p.requirementChecks.reality.maxID1);
    o.imL = L(Currency.imaginaryMachines.value);
    o.imCap = L(MachineHandler.currentIMCap);
    o.dimboosts = p.dimensionBoosts;
    o.galaxies = p.galaxies;
    o.epL = L(Currency.eternityPoints.value);
    o.rmL = L(Currency.realityMachines.value);
    o.ipL = L(Currency.infinityPoints.value);
    o.repL = L(Replicanti.amount);
    o.tdL = L(Currency.timeShards?.value ?? null);

    // IU15 三态
    o.iu15Possible = (() => { try { return ImaginaryUpgrade(15).isPossible; } catch { return null; } })();
    o.iu15Avail = (() => { try { return ImaginaryUpgrade(15).isAvailableForPurchase; } catch { return null; } })();
    o.iu15Bought = (() => { try { return ImaginaryUpgrade(15).isBought; } catch { return null; } })();
    o.lockOn = (() => { try { return ImaginaryUpgrade(15).hasPlayerLock; } catch { return null; } })();
    o.lockActive = (() => { try { return ImaginaryUpgrade(15).isLockingMechanics; } catch { return null; } })();

    // 阶段标记（由脚本写入 window）
    o.phase = window.__r38mPhase || "climb";
    o.hold = window.__r38mHold === true;
    o.note = window.__r38mNote || null;
  } catch (e) {
    o.err = String(e && e.message || e);
  }
  return o;
};

await page.evaluate(() => { window.__r38mT0 = Date.now(); window.__r38mPhase = "climb"; });
try { await page.evaluate(() => GameSpeed.factor = 10000); } catch { /* 已默认 10000 */ }

let phase = "climb";
let lockAt = null;
let holdAt = null;
let exitCode = 0;
const t0 = Date.now();
let lastLogAt = 0;

try {
  while (Date.now() - t0 < DURATION) {
    let s = null;
    try { s = await page.evaluate(SAMPLE); } catch (e) { s = { ErrSample: String(e.message).slice(0, 120) }; }
    const rec = { ...s, wall: Math.round((Date.now() - t0) / 100) / 10, phase };
    try { fs.appendFileSync(JSONL, JSON.stringify(rec) + "\n"); } catch { /* ignore */ }

    // ── 阶段推进（不再强制现实重置：改为开锁后等一次「自然现实」）──────
    // 教训（实测）：`autoReality()` 在 `GlyphSelection.active` 或 `isRealityAvailable()` 为假时
    // 直接 return，我第一版强制重置实际没发生（realities 10 → 10），于是 maxID1 仍 >0、
    // `isPossible` 为假、锁形同虚设，ID1 照样被买。改为让 oreki 现实自动化自然推进一次，
    // 重置后 maxID1 归零且锁在第一帧就已生效，ID1 从此买不进来。
    if (phase === "climb" && s && (s.imCap ?? 0) >= 9) {
      const r = await page.evaluate(() => {
        const out = {};
        try {
          ImaginaryUpgrade(15).setMechanicLock(true);
          out.lockOn = ImaginaryUpgrade(15).hasPlayerLock;
          out.lockActiveNow = ImaginaryUpgrade(15).isLockingMechanics;
          out.realities = Math.round(player.realities);
          out.glyphSel = (() => { try { return GlyphSelection.active === true; } catch { return null; } })();
          out.realityAvail = (() => { try { return isRealityAvailable() === true; } catch { return null; } })();
        } catch (e) { out.err = String(e && e.message || e); }
        return out;
      });
      log(`
[LOCK] t=${rec.wall}s realities=${s.realities} imCap=${s.imCap} -> ${JSON.stringify(r)}`);
      lockAt = r.realities;
      phase = "armed";
      await page.evaluate(() => { window.__r38mPhase = "armed"; });
    }

    // 开锁后等一次自然现实：realities 增加且 maxID1 归零 ⇒ 锁真正生效
    if (phase === "armed" && s && s.realities > lockAt) {
      if (s.maxID1 === "0" || s.maxID1 === "0e+0") {
        log(`[ARMED] t=${rec.wall}s realities=${s.realities} maxID1=0 id1=${s.id1} lockActive=${s.lockActive}`);
        const r = await page.evaluate(() => {
          const out = {};
          try {
            out.lockActive = ImaginaryUpgrade(15).isLockingMechanics;
            const ra = globalThis.OrekiRealityAutomation;
            out.hasRA = !!ra;
            if (ra && typeof ra.shouldReality === "function") {
              if (!ra.__origShouldReality) ra.__origShouldReality = ra.shouldReality;
              ra.shouldReality = () => false;
              out.held = true;
            }
            // 【R38 追加】同时冻结永恒重置：实测只压现实时，amE 被永恒反复打回 24，
            // 天花板只有 1.2e8，测不出「不重置时能爬多高」。
            out.froze = {};
            try {
              if (typeof Autobuyer !== "undefined" && Autobuyer.eternity) {
                Autobuyer.eternity.isActive = false;
                out.froze.eternityAB = true;
              }
            } catch (e) { out.froze.eternityAB = String(e.message); }
            try {
              const ea = globalThis.OrekiEternityAutomation;
              if (ea && typeof ea.shouldEternity === "function") {
                if (!ea.__origShouldEternity) ea.__origShouldEternity = ea.shouldEternity;
                ea.shouldEternity = () => false;
                out.froze.eternityAuto = true;
              } else { out.froze.eternityAuto = "no-shouldEternity"; }
            } catch (e) { out.froze.eternityAuto = String(e.message); }
            try {
              const ca = globalThis.OrekiCelestialAutomation;
              if (ca && typeof ca.tick === "function") {
                ca.__origTick = ca.tick; ca.tick = () => null;
                out.froze.celestial = true;
              }
            } catch (e) { out.froze.celestial = String(e.message); }
            window.__r38mHold = true;
            out.id1 = InfinityDimension(1).amount.toString();
            out.maxID1 = player.requirementChecks.reality.maxID1.toString();
          } catch (e) { out.err = String(e && e.message || e); }
          return out;
        });
        log("[HOLD] 结果:", JSON.stringify(r));
        phase = "hold";
        holdAt = Date.now();
        await page.evaluate(() => { window.__r38mPhase = "hold"; });
      } else if (Date.now() - (holdAt || 0) === 0) {
        // 还在同一个现实里（realities 增加了但 maxID1 未归零）——记录一次即可
        if (!globalThis.__warnedMaxId1) {
          globalThis.__warnedMaxId1 = true;
          log(`[WARN] 自然现实后 maxID1=${s.maxID1} 仍非 0（该现实已被 ID1 污染），等下一个`);
        }
      }
    }

    // 每 10 秒人读一行
    if (Date.now() - lastLogAt > 10000) {
      lastLogAt = Date.now();
      log(`[${String(rec.wall).padStart(5)}s] ${phase.padEnd(9)} r=${s?.realities} amE=${s?.amE?.toExponential?.(3)} ` +
        `id1=${s?.id1} maxID1=${(s?.maxID1 || "").slice(0, 14)} lock=${s?.lockActive ? 1 : 0} ` +
        `im=${s?.imL}/${s?.imCap} iu15=${s?.iu15Avail ? "AVAIL" : (s?.iu15Possible ? "possible" : "BLOCKED")} ` +
        `db=${s?.dimboosts} gal=${s?.galaxies} rep=${s?.repL} td=${s?.tdL}`);
    }

    // 达成即停
    if (s && (s.iu15Avail === true || (s.amE ?? 0) >= 1.5e12)) {
      log(`\n[REACHED] t=${rec.wall}s amE=${s.amE} iu15Avail=${s.iu15Avail}`);
      break;
    }
    await new Promise(r => setTimeout(r, SAMPLE_MS));
  }
} finally {
  const last = (() => { try { return JSON.parse(fs.readFileSync(JSONL, "utf8").trim().split("\n").pop()); } catch { return null; } })();
  log(`\n[END] phase=${phase} 最后: ${JSON.stringify(last)}`);
  if (errors.length) log(`[pageerror] ${errors.length} 条: ${errors.slice(0, 3).join(" | ")}`);
  try { await cleanup(); } catch { /* ignore */ }
  try { server.close(); } catch { /* ignore */ }
  killEdge();
}
process.exit(exitCode);
