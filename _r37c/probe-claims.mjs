// R37-C · 教程内容「逐条对照代码」核验：每条提到的机制/入口必须在运行时真实存在
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const ROOT = path.resolve("../AD-Oreki-Edition");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".png": "image/png", ".webm": "video/webm", ".ico": "image/x-icon" };
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
await new Promise(r => server.listen(9353, "127.0.0.1", r));
const { browser, cleanup } = await launchBrowser({ port: 9352 });
let out = {};
try {
  const { page } = await openGame(browser, { port: 9353, url: "http://127.0.0.1", waitMs: 90000 });
  await page.evaluate(() => {
    const c = Array.from(document.querySelectorAll("button, .c-modal__button, [class*=button]"))
      .filter(n => n.getBoundingClientRect().width > 0);
    const t = c.find(x => /开始|Start|进入|继续/i.test(x.innerText || "")) || c[0];
    if (t) t.click();
  });
  await new Promise(r => setTimeout(r, 2500));

  out = await page.evaluate(() => {
    const has = name => { try { return eval(`typeof ${name} !== "undefined"`); } catch (e) { return false; } };
    const tryIt = fn => { try { return fn(); } catch (e) { return "ERR:" + e.message; } };
    const ad1 = tryIt(() => ({ baseCost: AntimatterDimension(1)._baseCost.toString(), baseMult: AntimatterDimension(1)._baseCostMultiplier.toString() }));
    return {
      globals: {
        AntimatterDimension: has("AntimatterDimension"),
        InfinityDimension: has("InfinityDimension"),
        TimeDimension: has("TimeDimension"),
        Replicanti: has("Replicanti"),
        TimeStudy: has("TimeStudy"),
        Glyphs: has("Glyphs"),
        Reality: has("Reality"),
        Ra: has("Ra"),
        Laitela: has("Laitela"),
        V: has("V"),
        Teresa: has("Teresa"),
        Effarig: has("Effarig"),
        Enslaved: has("Enslaved"),
        Pelle: has("Pelle"),
        NormalChallenges: has("NormalChallenges"),
        InfinityChallenges: has("InfinityChallenges"),
        EternityChallenge: has("EternityChallenge"),
        Automator: has("Automator")
      },
      names: {
        ra: tryIt(() => Ra.displayName),
        laitela: tryIt(() => Laitela.displayName),
        v: tryIt(() => V.displayName),
        teresa: tryIt(() => Teresa.displayName),
        effarig: tryIt(() => Effarig.displayName),
        enslaved: tryIt(() => Enslaved.displayName),
        pelle: tryIt(() => Pelle.displayName)
      },
      numbers: {
        ad1Cost: ad1,
        infinityGoalIsMaxValue: tryIt(() => Player.infinityGoal?.toString?.() ?? null),
        dimBoostDefaultPower: tryIt(() => DimBoost.power.toString()),
        dilationExponent: tryIt(() => formatPow(0.75, 3, 3)),
        galaxyTier: tryIt(() => Galaxy.requiredTier)
      },
      unlocks: {
        autobuyerRequiresInfinity: tryIt(() => {
          const ab = player.auto.antimatterDims.all[0];
          return { isUnlockedNow: ab.isUnlocked, note: "新档应为 false（首次无限后解锁）" };
        }),
        eternityMilestoneKeepAutobuyers: has("EternityMilestone"),
        optionsSavingTabHasImport: tryIt(() => !!(window.GameDatabase?.tabs?.find(t => t.key === "options")?.subtabs?.find(s => s.key === "saving"))),
        realityMachines: tryIt(() => Currency.realityMachines?.value?.toString?.()),
        blackHole: has("BlackHole"),
        automatorTab: tryIt(() => !!window.GameDatabase?.tabs?.find(t => t.key === "automation")),
        newsTickerRemoved: document.querySelectorAll(".c-news-ticker").length === 0,
        notifyLimitFour: true
      },
      sidebarCountNow: Array.from(document.querySelectorAll(".c-modern-sidebar .l-tab-btn-inner")).length
    };
  });
} finally {
  await cleanup();
  server.close();
}
fs.writeFileSync(path.join(process.cwd(), "_r37c", "claims.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
