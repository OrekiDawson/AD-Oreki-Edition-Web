// R30：真实新档 → 鹿颈长（Effarig）三阶段推进 定向验证
//
// 只采数据，**不做任何购买 / 不做任何状态写入**：全部靠生产自动化
// （`OrekiCelestialAutomation` / `OrekiRealityAutomation` / `OrekiEternityAutomation`）。
//
// 与 `_r29-run2` 的差别：
//   · R30 起 `OrekiCelestialAutomation` 会**按 cost 升序真实购买 EffarigUnlock**，
//     并且 `_canEnter("effarig")` 增加了 `EffarigUnlock.run.isUnlocked` 前置。
//     本脚本用来验证：入场券是否真的买到、阶段位是否被真实重置推进。
//
// 用法：
//   node _r30-celestial.mjs [项目目录] [总时长秒]
//   环境变量：OREKI_JSONL=<输出 jsonl 路径>
//
// 端口固定：
//   · CDP 9427（主 Agent 占用 9422 / 9424 / 9426，禁止使用）
//   · 本地静态服务 8787
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchBrowser, openGame } from "./lib/edge-launch.mjs";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const DURATION = Number(process.argv[3] || 300) * 1000;
const SERVE_PORT = 8787;
const CDP_PORT = 9427;
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
await new Promise(r => server.listen(SERVE_PORT, "127.0.0.1", r));

const { browser, cleanup } = await launchBrowser({ port: CDP_PORT });
const { page, errors: errs } = await openGame(browser, { port: SERVE_PORT });

// 真正的新档
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

const t0 = Date.now();
const milestone = {};
const record = (name, t) => {
  if (milestone[name] !== undefined) return;
  milestone[name] = t;
  console.log(`  ★ ${name} @ ${t}s`);
  if (JSONL) fs.appendFileSync(JSONL, JSON.stringify({ milestone: name, t }) + "\n");
};

console.log("=== R30 真实新档 → 鹿颈长三阶段（纯生产自动化，端口 9427）===");

let last = null;
while (Date.now() - t0 < DURATION) {
  const s = await page.evaluate(() => {
    const L = v => {
      try {
        if (v === null || v === undefined) return null;
        const t = String(v);
        const i = t.indexOf("e");
        if (i < 0) {
          const n = Number(t);
          return n === 0 ? null : Math.log10(Math.abs(n));
        }
        return Math.log10(Math.abs(Number(t.slice(0, i)))) + Number(t.slice(i + 1));
      } catch (e) { return null; }
    };
    const pick = f => { try { return f(); } catch (e) { return null; } };
    const dbg = pick(() => globalThis.OrekiCelestialAutomation?.debugState) || {};
    return {
      // ── 需求清单字段 ──────────────────────────────────────────────
      realities: pick(() => player.realities),
      pouredL: pick(() => L(Teresa.pouredAmount)),
      relicShardsL: pick(() => L(Currency.relicShards.value)),
      teresaRun: pick(() => player.celestials.teresa.run === true),
      effarigRun: pick(() => player.celestials.effarig.run === true),
      effarigStage: pick(() => Effarig.currentStage),
      effarigStageName: pick(() => Effarig.currentStageName),
      effarigUnlockInfinity: pick(() => EffarigUnlock.infinity.isUnlocked === true),
      effarigUnlockEternity: pick(() => EffarigUnlock.eternity.isUnlocked === true),
      effarigUnlockReality: pick(() => EffarigUnlock.reality.isUnlocked === true),
      effarigUnlockRun: pick(() => EffarigUnlock.run.isUnlocked === true),
      effarigUnlockRunBuyable: pick(() =>
        !EffarigUnlock.run.isUnlocked && Currency.relicShards.gte(EffarigUnlock.run.cost)),
      enslavedUnlocked: pick(() => Enslaved.isUnlocked === true),
      enslavedRun: pick(() => player.celestials.enslaved.run === true),
      vRun: pick(() => player.celestials.v.run === true),
      celestialEntered: pick(() => JSON.stringify(globalThis.OrekiCelestialAutomation?._entered ?? {})),
      endState: pick(() => GameEnd.endState),
      // ── 自动化快照（R30 新增 getter）────────────────────────────────
      dbg,
      // ── 现场诊断 ──────────────────────────────────────────────────
      amL: pick(() => L(Currency.antimatter.value)),
      maxInL: pick(() => L(player.records.thisInfinity.maxAM)),
      maxEtL: pick(() => L(player.records.thisEternity.maxAM)),
      maxIPL: pick(() => L(player.records.thisEternity.maxIP)),
      ipL: pick(() => L(Currency.infinityPoints.value)),
      epL: pick(() => L(Currency.eternityPoints.value)),
      epGainL: pick(() => L(gainedEternityPoints())),
      goalL: pick(() => L(Player.eternityGoal)),
      canCrunch: pick(() => Player.canCrunch === true),
      canEternity: pick(() => Player.canEternity === true),
      canReality: pick(() => isRealityAvailable() === true),
      realityStudy: pick(() => TimeStudy.reality.isBought === true),
      inf: pick(() => player.infinities.toString()),
      et: pick(() => player.eternities.toString()),
      ecDone: pick(() => { const o = []; for (let i = 1; i <= 12; i++) {
        try { o.push(EternityChallenge(i).completions); } catch (e) { o.push(-1); } } return o.join(","); }),
      ttL: pick(() => L(Currency.timeTheorems.value)),
      dilationUnlocked: pick(() => PlayerProgress.dilationUnlocked() === true),
      inCelestial: pick(() => isInCelestialReality() === true),
      teresaUnlockedNow: pick(() => Teresa.isUnlocked === true),
      effarigUnlocked: pick(() => TeresaUnlocks.effarig.isUnlocked === true),
    };
  }).catch(() => null);
  if (!s) { await new Promise(r => setTimeout(r, 500)); continue; }

  const t = Math.floor((Date.now() - t0) / 1000);
  s.t = t;
  last = s;

  if (Number(s.realities) >= 1) record("首次现实", t);
  if (s.pouredL !== null && s.pouredL >= 24) record("特蕾莎浇满1e24", t);
  if (s.effarigUnlocked) record("鹿颈长解锁位(A147+浇注)", t);
  if (s.relicShardsL !== null) record("首次获得遗迹碎片", t);
  if (s.effarigUnlockRun) record("买到 EffarigUnlock.run 入场券", t);
  if (s.effarigStage >= 2) record("鹿颈长阶段=ETERNITY（真实 Big Crunch 已推进）", t);
  if (s.effarigUnlockEternity) record("EffarigUnlock.eternity 解锁（真实 Eternity）", t);
  if (s.effarigStage >= 3) record("鹿颈长阶段=REALITY", t);
  if (s.effarigUnlockReality) record("EffarigUnlock.reality 解锁（真实 Reality）", t);
  if (s.enslavedUnlocked) record("无名氏解锁", t);
  if (s.endState >= 1) record("endState>=1（真实终局）", t);

  if (JSONL) fs.appendFileSync(JSONL, JSON.stringify(s) + "\n");
  if (t % 5 === 0) {
    console.log(`t=${String(t).padStart(4)}s realities=${s.realities} shardsL=${s.relicShardsL === null ? "-" : s.relicShardsL.toFixed(2)}` +
      ` stage=${s.effarigStage}(${s.effarigStageName}) run=${s.effarigRun}` +
      ` tickInf=${s.effarigUnlockInfinity ? 1 : 0} tickEt=${s.effarigUnlockEternity ? 1 : 0} ticket=${s.effarigUnlockRun ? 1 : 0}` +
      ` am=1e${s.amL === null ? "-" : s.amL.toFixed(1)} canCrunch=${s.canCrunch} canEt=${s.canEternity} ep=1e${s.epL === null ? "-" : s.epL.toFixed(0)}` +
      ` ecDone=${s.ecDone}`);
  }

  await new Promise(r => setTimeout(r, 1000));
}

console.log("\n=== 里程碑 ===");
for (const [k, v] of Object.entries(milestone)) console.log(`  ${k}: ${v}s`);
if (Object.keys(milestone).length === 0) console.log("  （无）");
if (last) {
  console.log("\n=== 末态（关键字段）===");
  const keys = ["t", "realities", "pouredL", "relicShardsL", "teresaRun", "effarigRun", "effarigStage",
    "effarigStageName", "effarigUnlockRun", "effarigUnlockInfinity", "effarigUnlockEternity",
    "effarigUnlockReality", "enslavedUnlocked", "enslavedRun", "vRun", "celestialEntered", "endState",
    "amL", "maxEtL", "maxIPL", "epL", "epGainL", "canCrunch", "canEternity", "canReality", "ecDone"];
  console.log(JSON.stringify(Object.fromEntries(keys.map(k => [k, last[k]]))));
  console.log("\n=== debugState ===");
  console.log(JSON.stringify(last.dbg));
}
console.log(`\nconsole error 数：${errs.length}`);
if (errs.length) console.log("前 3 条：", errs.slice(0, 3));

await cleanup();
server.close();
process.exit(0);
