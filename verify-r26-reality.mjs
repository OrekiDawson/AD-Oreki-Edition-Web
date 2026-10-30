// R26：真实新档 → 首次 Reality → 现实循环（纯生产自动化，脚本不点任何按钮）
//
// 与 verify-r21-eternity.mjs 的差别：
//   · 增加现实层观测（realities / RM / 符文 / 现实升级位 / perk 点 / EC 完成数）；
//   · 记录首次现实与每次现实增量，用于确认「现实确实发生并有奖励」；
//   · 时长参数默认 300 秒。
//
// 用法：node verify-r26-reality.mjs [项目目录] [端口] [总时长秒]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchBrowser, openGame } from "./lib/edge-launch.mjs";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8781);
const DURATION = Number(process.argv[4] || 300) * 1000;
const JSONL = process.env.OREKI_JSONL || "";

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

const { browser, cleanup } = await launchBrowser({ port: Number(process.env.OREKI_EDGE_PORT || 9423) });
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
      const t = v.toString();
      const i = t.indexOf("e");
      if (i < 0) return Math.log10(Math.abs(Number(t)));
      return Math.log10(Math.abs(Number(t.slice(0, i)))) + Number(t.slice(i + 1));
    } catch (e) { return NaN; }
  };
  globalThis.__lg = lg;
});

const t0 = Date.now();
const milestone = {};
const record = (name, t) => {
  if (milestone[name] !== undefined) return;
  milestone[name] = t;
  console.log(`  ★ ${name} @ ${t}s`);
};

console.log("=== R26 真实新档（纯生产自动化）→ Reality → 现实循环 ===");

let last = null;
let prevRealities = 0;
while (Date.now() - t0 < DURATION) {
  const s = await page.evaluate(() => {
    const L = globalThis.__lg;
    const pick = f => { try { return f(); } catch (e) { return null; } };
    const ids = [];
    for (let t = 1; t <= 8; t++) ids.push(pick(() => (InfinityDimension(t).isUnlocked ? 1 : 0)) || 0);
    return {
      amL: pick(() => L(Currency.antimatter.value)),
      maxInL: pick(() => L(player.records.thisInfinity.maxAM)),
      maxEtL: pick(() => L(player.records.thisEternity.maxAM)),
      ipL: pick(() => L(Currency.infinityPoints.value)),
      epL: pick(() => L(Currency.eternityPoints.value)),
      maxEpL: pick(() => L(player.records.thisReality.maxEP)),
      et: pick(() => player.eternities.toString()),
      inf: pick(() => player.infinities.toString()),
      brk: pick(() => player.break === true),
      canEt: pick(() => Player.canEternity === true),
      ids,
      ttL: pick(() => L(Currency.timeTheorems.value)),
      realityStudy: pick(() => TimeStudy.reality.isBought === true),
      ecDone: pick(() => { const o = []; for (let i = 1; i <= 12; i++) { try { o.push(EternityChallenge(i).completions); } catch (e) { o.push(-1); } } return o.join(","); }),
      canReality: pick(() => isRealityAvailable() === true),
      lock: pick(() => isInCelestialReality()),
      // ── 现实层 ──
      rl: pick(() => player.realities),
      rmL: pick(() => L(Currency.realityMachines.value)),
      rmGainL: pick(() => L(MachineHandler.gainedRealityMachines)),
      ppL: pick(() => L(Currency.perkPoints.value)),
      glyphAct: pick(() => Glyphs.activeWithoutCompanion.length),
      glyphInv: pick(() => Glyphs.inventoryList.length),
      glyphMax: pick(() => Glyphs.activeSlotCount),
      upgBits: pick(() => player.reality.upgradeBits),
      upgReqs: pick(() => player.reality.upgReqs),
      rebuy: pick(() => JSON.stringify(player.reality.rebuyables)),
      seed: pick(() => player.reality.seed),
      fired: pick(() => globalThis.OrekiRealityAutomation?._realitiesFired ?? -1),
      teresa: pick(() => Achievement(147).isUnlocked),
      achCount: pick(() => Achievements.all.filter(a => a.isUnlocked).length),
      endState: pick(() => +GameEnd.endState.toFixed(3)),
      isGameEnd: pick(() => player.isGameEnd === true),
    };
  }).catch(() => null);
  if (!s) { await new Promise(r => setTimeout(r, 500)); continue; }

  const t = Math.floor((Date.now() - t0) / 1000);
  s.t = t;
  last = s;

  if (s.brk) record("Break", t);
  if (Number(s.inf) >= 1) record("首次无限", t);
  if (s.canEt) record("canEternity=true", t);
  if (Number(s.et) >= 1) record("首次永恒", t);
  if (s.realityStudy) record("TimeStudy.reality 已买", t);
  if (s.canReality) record("canReality=true", t);
  if (s.rl >= 1) record("首次 Reality（realities>=1）", t);
  if (s.teresa) record("特蕾莎解锁（成就147）", t);
  if (prevRealities !== 0 && s.rl > prevRealities) console.log(`  · 第 ${s.rl} 次现实 @ ${t}s（RM=1e${String(s.rmL).slice(0, 7)}）`);
  prevRealities = s.rl;

  if (JSONL) fs.appendFileSync(JSONL, JSON.stringify(s) + "\n");
  if (t % 5 === 0 || t < 5) {
    console.log(`t=${String(t).padStart(4)}s et=${String(s.et).slice(0, 7)} ec=[${s.ecDone}] canReal=${s.canReality} rl=${s.rl} RM=1e${String(s.rmL).slice(0, 6)} 符文=${s.glyphAct}/${s.glyphInv} 升级位=${s.upgBits} req=${s.upgReqs} 按钮=${s.fired}`);
  }

  await new Promise(r => setTimeout(r, 1000));
}

console.log("\n=== 里程碑 ===");
for (const [k, v] of Object.entries(milestone)) console.log(`  ${k}: ${v}s`);
if (last) {
  console.log("\n=== 末态 ===");
  console.log(JSON.stringify(last, null, 0));
}
console.log(`\n页面异常数：${errs.length}`);
if (errs.length) console.log(errs.slice(0, 5));

await cleanup();
server.close();
process.exit(0);
