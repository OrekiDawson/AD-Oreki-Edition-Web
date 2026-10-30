// R25 诊断：真实新档，纯生产自动化，采样 EC4/EC6/EC8 的入口资源与 Reality 条件
// 用法：node diag-r25-ec.mjs [项目目录] [端口] [总时长秒]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchBrowser, openGame } from "./lib/edge-launch.mjs";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8790);
const DURATION = Number(process.argv[4] || 150) * 1000;
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

const { browser, cleanup } = await launchBrowser({ port: Number(process.env.OREKI_EDGE_PORT || 9432) });
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
  globalThis.__errStacks = [];
  const push = s => { try { if (globalThis.__errStacks.length < 8) globalThis.__errStacks.push(s); } catch (e) {} };
  window.addEventListener("error", e => push(`ERR ${e.message}\n${e.error && e.error.stack || ""}`));
  window.addEventListener("unhandledrejection", e => push(`REJ ${e.reason && e.reason.message}\n${e.reason && e.reason.stack || ""}`));
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
  if (JSONL) fs.appendFileSync(JSONL, JSON.stringify({ milestone: name, t }) + "\n");
};

console.log("=== R25 EC4/6/8 诊断（真实新档，纯生产自动化）===");
let last = null;
while (Date.now() - t0 < DURATION) {
  const s = await page.evaluate(() => {
    const L = globalThis.__lg;
    const pick = f => { try { return f(); } catch (e) { return null; } };
    const ec = id => {
      try {
        const st = TimeStudy.eternityChallenge(id);
        return {
          cur: st.requirementCurrent.toString(),
          tot: st.requirementTotal.toString(),
          met: st.isEntryGoalMet,
          bought: st.isBought,
        };
      } catch (e) { return null; }
    };
    return {
      inf: pick(() => player.infinities.toString()),
      infBank: pick(() => Currency.infinitiesBanked.value.toString()),
      infTotal: pick(() => Currency.infinitiesTotal.value.toString()),
      infTotalL: pick(() => L(Currency.infinitiesTotal.value)),
      ipL: pick(() => L(Currency.infinityPoints.value)),
      maxIPEternityL: pick(() => L(player.records.thisEternity.maxIP)),
      repUnl: pick(() => player.replicanti.unl === true),
      repAmtL: pick(() => L(Replicanti.amount)),
      repGal: pick(() => player.replicanti.galaxies),
      repGalMax: pick(() => Replicanti.galaxies.max),
      rgAutoUnl: pick(() => Autobuyer.replicantiGalaxy.isUnlocked === true),
      rgAutoOn: pick(() => Autobuyer.replicantiGalaxy.isEnabled === true),
      rgMilestone: pick(() => EternityMilestone.autobuyerReplicantiGalaxy.isReached === true),
      ach138: pick(() => Achievement(138).isUnlocked === true),
      ts131: pick(() => TimeStudy(131).isBought === true),
      ts121: pick(() => TimeStudy(121).isBought === true),
      ts143: pick(() => TimeStudy(143).isBought === true),
      ts123: pick(() => TimeStudy(123).isBought === true),
      ts42: pick(() => TimeStudy(42).isBought === true),
      autobuyersOn: pick(() => player.auto.autobuyersOn === true),
      ec4: ec(4), ec6: ec(6), ec8: ec(8),
      ecUnlocked: pick(() => player.challenge.eternity.unlocked),
      ecRunning: pick(() => EternityChallenge.isRunning === true),
      ecDone: pick(() => { const o=[]; for(let i=1;i<=12;i++){ try{ o.push(EternityChallenge(i).completions);}catch(e){o.push(-1);} } return o.join(","); }),
      studiesN: pick(() => TimeStudy.boughtNormalTS().length),
      boughtIds: pick(() => TimeStudy.boughtNormalTS().map(x=>x.id).join(",")),
      ttNow: pick(() => Currency.timeTheorems.value.toString()),
      et: pick(() => player.eternities.toString()),
      epL: pick(() => L(Currency.eternityPoints.value)),
      maxEPL: pick(() => L(player.records.thisReality.maxEP)),
      realityStudy: pick(() => TimeStudy.reality.isBought === true),
      canReality: pick(() => isRealityAvailable() === true),
      dil1: pick(() => DilationTimeStudyState.studies[1].isBought === true),
      dil1Can: pick(() => { try { return DilationTimeStudyState.studies[1].canBeBought; } catch(e) { return null; } }),
      dil2Can: pick(() => { try { return DilationTimeStudyState.studies[2].canBeBought; } catch(e) { return null; } }),
      dil2Aff: pick(() => { try { return DilationTimeStudyState.studies[2].isAffordable; } catch(e) { return null; } }),
      dil2Cost: pick(() => { try { return String(DilationTimeStudyState.studies[2].cost); } catch(e) { return null; } }),
      dil3Can: pick(() => { try { return DilationTimeStudyState.studies[3].canBeBought; } catch(e) { return null; } }),
      dil4: pick(() => { try { return DilationTimeStudyState.studies[4].isBought; } catch(e) { return null; } }),
      dil5: pick(() => { try { return DilationTimeStudyState.studies[5].isBought; } catch(e) { return null; } }),
      tdUnl: pick(() => { const o=[]; for(let t=4;t<=8;t++){ try{ o.push(TimeDimension(t).isUnlocked?1:0); }catch(e){ o.push(-1); } } return o.join(""); }),
      tdBought: pick(() => { const o=[]; for(let t=1;t<=8;t++){ try{ o.push(TimeDimension(t).bought?1:0); }catch(e){ o.push(-1); } } return o.join(""); }),
      achLockedPre: pick(() => Achievements.preReality.filter(a => !a.isUnlocked).map(a => a.id).join(",")),
      achPreTotal: pick(() => Achievements.preReality.length),
      dilStudies: pick(() => player.dilation.studies.join(",")),
      dilBuyProbe: pick(() => { try { return OrekiEternityAutomation.buyDilationStudies(); } catch (e) { return "ERR " + e.message; } }),
      frameMod: pick(() => OrekiEternityAutomation._frame % 30),
      respecNeed: pick(() => OrekiEternityAutomation.needsBranchRespec()),
      blocked: pick(() => [...OrekiEternityAutomation.blockedStudies()].join(",")),
      ttUsed: pick(() => Currency.timeTheorems.value.toString()),
      dil6: pick(() => DilationTimeStudyState.studies[6].isBought === true),
      ds6: pick(() => {
        try {
          return {
            td8Study: TimeStudy.timeDimension(8).isBought,
            maxEPok: player.records.thisReality.maxEP.exponent >= 4000,
            achOk: Achievements.preReality.every(a => a.isUnlocked),
            doomed: Pelle.isDoomed,
            canBuy: DilationTimeStudyState.studies[6].canBeBought,
          };
        } catch (e) { return "ERR " + e.message; }
      }),
      achCount: pick(() => Achievements.all.filter(a => a.isUnlocked).length),
      preRealityAchLeft: pick(() => {
        let n = 0;
        for (const a of Achievements.all) { try { if (a.preReality && !a.isUnlocked) n++; } catch(e) {} }
        return n;
      }),
      firstPerk: pick(() => Perk.firstPerk.isBought === true),
      td8Bought: pick(() => TimeDimension(8).isBought === true),
      ec11: pick(() => ({ c: EternityChallenge(11).completions, forb: TimeStudy.eternityChallenge(11).hasForbiddenStudies, met: TimeStudy.eternityChallenge(11).allSecondaryRequirementsMet })),
      ec12: pick(() => ({ c: EternityChallenge(12).completions, forb: TimeStudy.eternityChallenge(12).hasForbiddenStudies, met: TimeStudy.eternityChallenge(12).allSecondaryRequirementsMet })),
      ts71: pick(() => TimeStudy(71).isBought), ts72: pick(() => TimeStudy(72).isBought), ts73: pick(() => TimeStudy(73).isBought),
      ts231: pick(() => TimeStudy(231).isBought), ts232: pick(() => TimeStudy(232).isBought),
      ts233: pick(() => TimeStudy(233).isBought), ts234: pick(() => TimeStudy(234).isBought),
      bcMode: pick(() => player.auto.bigCrunch.mode), bcActive: pick(() => player.auto.bigCrunch.isActive === true),
      galaxies: pick(() => player.galaxies),
      db: pick(() => String(player.dimensionBoosts)),
      dbType: pick(() => typeof player.dimensionBoosts),
      reqTier: pick(() => String(DimBoost.requirement.tier)),
      adLen: pick(() => AntimatterDimension.index.length),
      ad8ok: pick(() => !!AntimatterDimension(8)),
      buy10: pick(() => String(player.buy10AntimatterDimensions)),
      errStacks: pick(() => (globalThis.__errStacks || []).slice(0, 3)),
      gameLoopAlive: pick(() => typeof GameUI === "object" && GameUI.diff !== undefined),
    };
  }).catch(() => null);
  if (!s) { await new Promise(r => setTimeout(r, 500)); continue; }

  const t = Math.floor((Date.now() - t0) / 1000);
  s.t = t;
  last = s;

  if (Number(s.et) >= 1) record("首次永恒", t);
  if (s.ecDone && !globalThis.__firstEc && s.ecDone !== "0,0,0,0,0,0,0,0,0,0,0,0") record("首次EC完成", t);

  if (JSONL) fs.appendFileSync(JSONL, JSON.stringify(s) + "\n");
  if (t % 10 === 0) {
    const n = v => (typeof v === "number" && isFinite(v) ? v.toFixed(1) : String(v));
    console.log(`t=${String(t).padStart(4)}s et=${String(s.et).slice(0,8)} infT=1e${n(s.infTotalL)} IP=1e${String(s.ipL).slice(0,6)} repU=${s.repUnl?1:0} rep=1e${n(s.repAmtL)} RG=${s.repGal}/${s.repGalMax} rgAuto=${s.rgAutoUnl?1:0}/${s.rgAutoOn?1:0} EC=[${s.ecDone}] unlock=${s.ecUnlocked} run=${s.ecRunning?1:0}`);
    console.log(`        EC4 ${s.ec4?`${s.ec4.cur}<${s.ec4.tot} met=${s.ec4.met}`:"-"} | EC6 ${s.ec6?`${s.ec6.cur}<${s.ec6.tot} met=${s.ec6.met}`:"-"} | EC8 ${s.ec8?`${s.ec8.cur}<${s.ec8.tot} met=${s.ec8.met}`:"-"}`);
  }

  await new Promise(r => setTimeout(r, 1000));
}

console.log("\n=== 里程碑 ===");
for (const [k, v] of Object.entries(milestone)) console.log(`  ${k}: ${v}s`);
if (last) {
  console.log("\n=== 末态 ===");
  console.log(JSON.stringify(last, null, 0));
}
if (errs.length) console.log("\n页面异常:", errs.slice(0, 3));

await cleanup();
server.close();
process.exit(0);
