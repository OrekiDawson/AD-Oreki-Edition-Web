// R35-A2 诊断探针：只定位「EC9~EC12 为什么打不到 / EC12 为什么恒 0」。
// 只读，不改任何状态。用法：node _r35a2-diag.mjs [项目目录] [HTTP端口] [秒] [Edge端口]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchBrowser, openGame } from "./lib/edge-launch.mjs";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8831);
const DURATION = Number(process.argv[4] || 150) * 1000;
const EDGE_PORT = Number(process.argv[5] || 9471);
const JSONL = process.env.OREKI_JSONL || `_r35a2-diag-${Date.now()}.jsonl`;

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon",
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(root, "." + p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

let cleanup = async () => {};
try {
  const launched = await launchBrowser({ port: EDGE_PORT });
  const browser = launched.browser;
  cleanup = launched.cleanup;
  const { page, errors: errs } = await openGame(browser, { port });

  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
  await page.reload({ waitUntil: "load", timeout: 60000 });
  for (let i = 0; i < 150; i++) {
    const ok = await page.evaluate(() => {
      try { return typeof player === "object" && typeof AntimatterDimension === "function"; }
      catch { return false; }
    }).catch(() => false);
    if (ok) break;
    await new Promise(r => setTimeout(r, 400));
  }

  await page.evaluate(() => {
    const lg = v => {
      try {
        if (v === null || v === undefined) return null;
        const t = String(v);
        if (t === "0" || t === "0e0") return null;
        if (t.includes("Infinity") || t === "NaN") return null;
        const i = t.indexOf("e");
        if (i < 0) { const n = Number(t); return Number.isFinite(n) && n > 0 ? Math.log10(n) : null; }
        return Math.log10(Math.abs(Number(t.slice(0, i)))) + Number(t.slice(i + 1));
      } catch (e) { return null; }
    };
    globalThis.__lg = lg;
    globalThis.__t0 = Date.now();
    const pick = f => { try { return f(); } catch (e) { return null; }; };
    const bought = id => pick(() => TimeStudy(id).isBought === true);
    const ecInfo = id => {
      const st = pick(() => TimeStudy.eternityChallenge(id));
      const ch = pick(() => EternityChallenge(id));
      return {
        c: pick(() => ch.completions),
        canBuy: pick(() => st.canBeBought === true),
        affordable: pick(() => st.isAffordable === true),
        reqMet: pick(() => st.config.requirement.some(s => TimeStudy(s).isBought) === true),
        secondary: pick(() => st.allSecondaryRequirementsMet === true),
        entryGoal: pick(() => st.isEntryGoalMet === true),
        forb: pick(() => st.hasForbiddenStudies === true),
        unlocked: pick(() => ch.isUnlocked === true),
        running: pick(() => ch.isRunning === true),
      };
    };
    globalThis.__snap2 = () => ({
      t: Math.floor((Date.now() - globalThis.__t0) / 1000),
      realities: pick(() => player.realities),
      ecDone: pick(() => { const a = []; for (let i = 1; i <= 12; i++) a.push(EternityChallenge(i).completions); return a.join(","); }),
      ecUnlocked: pick(() => player.challenge.eternity.unlocked),
      ecCurrent: pick(() => player.challenge.eternity.current),
      ecRunning: pick(() => EternityChallenge.isRunning === true),
      studiesN: pick(() => player.timestudy.studies.length),
      studiesTail: pick(() => player.timestudy.studies.slice(-14).join(",")),
      ttNow: pick(() => lg(Currency.timeTheorems.value)),
      ttMax: pick(() => lg(Currency.timeTheorems.max)),
      dimPath: pick(() => JSON.stringify({
        c: GameCache.currentStudyTree.value?.currDimPathCount,
        a: GameCache.currentStudyTree.value?.allowedDimPathCount,
      })),
      ts: pick(() => [61, 71, 72, 73, 111, 121, 131, 141, 151, 161, 171, 181, 191, 192, 193, 211, 212, 213, 214, 221, 225, 231, 233]
        .map(id => `${id}:${TimeStudy(id).isBought ? 1 : 0}`).join(" ")),
      ec9: ecInfo(9), ec10: ecInfo(10), ec11: ecInfo(11), ec12: ecInfo(12),
      ipowerL: pick(() => lg(Currency.infinityPower.value)),
      epL: pick(() => lg(Currency.eternityPoints.value)),
      ipL: pick(() => lg(Currency.infinityPoints.value)),
      dtL: pick(() => lg(Currency.dilatedTime.value)),
      maxDT: pick(() => player.records.thisReality.maxDT.toString()),
      ds1: pick(() => DilationTimeStudyState.studies[1].isBought === true),
      ds1CanBuy: pick(() => DilationTimeStudyState.studies[1].canBeBought === true),
      ds1Req: pick(() => DilationTimeStudyState.studies[1].config.requirement() === true),
      ec11full: pick(() => EternityChallenge(11).isFullyCompleted === true),
      ec12full: pick(() => EternityChallenge(12).isFullyCompleted === true),
      ec12sec: pick(() => inGameSecondsOf(player.records.thisEternity)),
      ec12lim: pick(() => EternityChallenge(12).config.restriction(EternityChallenge(12).completions)),
      hold: pick(() => globalThis.OrekiCelestialAutomation?.holdRealityForV === true),
      dcHold: pick(() => globalThis.OrekiCelestialAutomation?.holdRealityForDeepChallenge === true),
      deep: pick(() => globalThis.OrekiDilationAutomation?.debugState),
      gates: pick(() => globalThis.OrekiCelestialAutomation?.debugState?.gates),
    });
  });

  const t0 = Date.now();
  let last = 0;
  console.log("=== R35-A2 EC 深链诊断 ===");
  while (Date.now() - t0 < DURATION) {
    let s = null;
    try { s = await page.evaluate(() => globalThis.__snap2()); } catch (e) { s = { err: String(e) }; }
    if (s) {
      fs.appendFileSync(JSONL, JSON.stringify(s) + "\n");
      const el = Math.floor((Date.now() - t0) / 1000);
      if (el - last >= 10) {
        last = el;
        console.log(`[${String(el).padStart(4)}s] r=${s.realities} ec=${s.ecDone} un=${s.ecUnlocked} cur=${s.ecCurrent}` +
          ` st=${s.studiesN} tt=${s.ttNow?.toFixed(1)} dimPath=${s.dimPath}`);
        console.log(`        ts ${s.ts}`);
        console.log(`        ec11 ${JSON.stringify(s.ec11)} ec12 ${JSON.stringify(s.ec12)} lim=${s.ec12lim?.toFixed(2)} sec=${s.ec12sec?.toFixed(2)} ipow=${s.ipowerL?.toFixed(0)}`);
        console.log(`        deep ${JSON.stringify(s.deep)}`);
      }
    }
    await new Promise(r => setTimeout(r, 3000));
  }
  console.log("=== 末态 ===");
  console.log(JSON.stringify(await page.evaluate(() => globalThis.__snap2()).catch(() => null), null, 1));
  if (errs?.length) console.log("页面错误:", errs.slice(0, 5));
  console.log("JSONL:", JSONL);
} finally {
  await cleanup();
  server.close();
}
