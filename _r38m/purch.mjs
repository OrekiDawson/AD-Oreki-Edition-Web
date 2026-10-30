// R38 主 Agent · IU15 端到端买入实验（独立于 Agent A 的第二条证据链）
//
// 与 lockexp 的区别：只做一件事——把「解锁 → 买入」跑通，并留下原始探针。
//
// 设计要点（读代码得出，不是猜的）：
//   * `ImaginaryUpgradeState.tryUnlock()` 注册在 `GAME_EVENT.GAME_TICK_AFTER`
//     （imaginary-upgrades.js:7），所以「需求满足」的那一刻会**自动**置
//     `player.reality.imaginaryUpgReqs` 位，不需要我们手动点。
//   * 我们唯一要负责的是：在现实开始前就把原版锁打开
//     （`setMechanicLock(true)`），让 maxID1 在整个现实里恒为 0。
//   * 需求位点亮后 `purchase()` 才可用（cost 1e9 IM，实测 imCap 1e111992，必够）。
//
// 用法： node _r38m/purch.mjs [秒数] [标签]
// 产出： _r38m/<标签>.jsonl / <标签>.log
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "AD-Oreki-Edition");
const argv = process.argv.slice(2);
const DURATION = (Number(argv[0]) || 420) * 1000;
const TAG = argv[1] || `purch-${Date.now()}`;
const PORT = Number(process.env.OREKI_HTTP_PORT || 8875);
const CDP_PORT = Number(process.env.OREKI_CDP_PORT || 9365);
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

const SAMPLE = () => {
  const S = v => { try { return v === null || v === undefined ? null : v.toString(); } catch { return null; } };
  const o = { t: Math.round((Date.now() - window.__r38mT0) / 100) / 10 };
  try {
    const p = player;
    o.realities = Math.round(p.realities);
    o.amE = Number(p.antimatter?.exponent ?? 0);
    o.maxID1 = S(p.requirementChecks.reality.maxID1);
    o.id1 = S(InfinityDimension(1).amount);
    o.imL = (() => { try { const v = Currency.imaginaryMachines.value; const l = typeof v.log10 === "function" ? v.log10() : Decimal.log10(v); return Math.round(l * 1e4) / 1e4; } catch { return null; } })();
    o.imUnlocked = (() => { try { return MachineHandler.isIMUnlocked === true; } catch { return null; } })();
    o.lockOn = (() => { try { return ImaginaryUpgrade(15).hasPlayerLock; } catch { return null; } })();
    o.lockActive = (() => { try { return ImaginaryUpgrade(15).isLockingMechanics; } catch { return null; } })();
    o.iu15Possible = (() => { try { return ImaginaryUpgrade(15).isPossible; } catch { return null; } })();
    o.iu15Avail = (() => { try { return ImaginaryUpgrade(15).isAvailableForPurchase; } catch { return null; } })();
    o.iu15Bought = (() => { try { return ImaginaryUpgrade(15).isBought; } catch { return null; } })();
    o.laitelaUnlocked = (() => { try { return Laitela.isUnlocked; } catch { return null; } })();
    o.reqText = (() => { try { return ImaginaryUpgrade(15).requirement; } catch { return null; } })();
    o.phase = window.__r38mPhase || "waitIM";
  } catch (e) { o.err = String(e && e.message || e); }
  return o;
};

await page.evaluate(() => { window.__r38mT0 = Date.now(); window.__r38mPhase = "waitIM"; });
try { await page.evaluate(() => { GameSpeed.factor = 10000; }); } catch { /* ignore */ }

let phase = "waitIM";
let lockAt = null;
let boughtLogged = false;
const t0 = Date.now();
let lastLogAt = 0;
let exitCode = 0;

try {
  while (Date.now() - t0 < DURATION) {
    let s = null;
    try { s = await page.evaluate(SAMPLE); } catch (e) { s = { err: String(e.message).slice(0, 120) }; }
    const rec = { ...s, wall: Math.round((Date.now() - t0) / 100) / 10 };
    try { fs.appendFileSync(JSONL, JSON.stringify(rec) + "\n"); } catch { /* ignore */ }

    if (phase === "waitIM" && s && s.imUnlocked === true) {
      const r = await page.evaluate(() => {
        const out = {};
        try {
          ImaginaryUpgrade(15).setMechanicLock(true);
          out.lockOn = ImaginaryUpgrade(15).hasPlayerLock;
          out.realities = Math.round(player.realities);
          out.maxID1 = player.requirementChecks.reality.maxID1.toString();
        } catch (e) { out.err = String(e && e.message || e); }
        return out;
      });
      log(`\n[LOCK] wall=${rec.wall}s ${JSON.stringify(r)}`);
      lockAt = r.realities;
      phase = "armed";
      await page.evaluate(() => { window.__r38mPhase = "armed"; });
    }

    // 开锁后等一次自然现实（realities 增加）⇒ 新现实里 maxID1 归零、锁生效
    if (phase === "armed" && s && s.realities > lockAt) {
      log(`[ARMED] wall=${rec.wall}s realities=${s.realities} maxID1=${s.maxID1} lockActive=${s.lockActive}`);
      phase = "sprint";
      await page.evaluate(() => { window.__r38mPhase = "sprint"; });
    }

    // sprint：需求位由 tryUnlock 自动点亮，点亮后立刻调用 purchase()
    if (phase === "sprint" && s && s.iu15Avail === true && s.iu15Bought !== true) {
      const r = await page.evaluate(() => {
        const out = {};
        try {
          out.beforePaid = String(Currency.imaginaryMachines.value);
          out.cost = String(ImaginaryUpgrade(15).cost);
          out.canApply = ImaginaryUpgrade(15).canBeApplied;
          const ok = ImaginaryUpgrade(15).purchase();
          out.purchaseReturned = ok;
          out.bought = ImaginaryUpgrade(15).isBought;
          out.laitelaUnlocked = Laitela.isUnlocked;
          out.lockAfter = ImaginaryUpgrade(15).hasPlayerLock;
        } catch (e) { out.err = String(e && e.message || e); }
        return out;
      });
      log(`\n[PURCHASE] wall=${rec.wall}s amE=${s.amE} maxID1=${s.maxID1} -> ${JSON.stringify(r)}`);
      if (r.bought === true) {
        phase = "bought";
        boughtLogged = true;
        await page.evaluate(() => { window.__r38mPhase = "bought"; });
      }
    }

    if (Date.now() - lastLogAt > 10000) {
      lastLogAt = Date.now();
      log(`[${String(rec.wall).padStart(5)}s] ${phase.padEnd(7)} r=${s?.realities} amE=${s?.amE?.toExponential?.(3)} ` +
        `id1=${s?.id1} maxID1=${(s?.maxID1 || "").slice(0, 10)} lock=${s?.lockActive ? 1 : 0} ` +
        `imUnl=${s?.imUnlocked ? 1 : 0} imL=${s?.imL} iu15=${s?.iu15Bought ? "BOUGHT" : s?.iu15Avail ? "AVAIL" : s?.iu15Possible ? "possible" : "blocked"} ` +
        `laitela=${s?.laitelaUnlocked ? 1 : 0}`);
    }

    if (boughtLogged) break;
    await new Promise(r => setTimeout(r, SAMPLE_MS));
  }
} finally {
  const last = (() => { try { return JSON.parse(fs.readFileSync(JSONL, "utf8").trim().split("\n").pop()); } catch { return null; } })();
  log(`\n[END] phase=${phase} 最后: ${JSON.stringify(last)}`);
  log(`[END] 页内异常 ${errors.length} 条${errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""}`);
  log(`[END] 结论: ${last?.iu15Bought === true && last?.laitelaUnlocked === true
    ? "IU15 已买入且莱特拉已解锁（已实测）"
    : "未在时限内买入（未达成，不得记为通过）"}`);
  exitCode = last?.iu15Bought === true ? 0 : 2;
  await cleanup();
  server.close();
  process.exit(exitCode);
}
