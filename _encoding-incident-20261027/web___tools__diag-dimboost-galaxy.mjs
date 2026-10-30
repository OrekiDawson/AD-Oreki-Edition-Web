// 璇婃柇锛氬湪澶氫釜瀛樻。 / 涓嶅悓 F 涓嬶紝閫愬抚缁熻銆岀淮搴︽彁鍗?/ 鏄熺郴銆嶇殑
//   鏉′欢灏辩华甯с€佽 interval 闃诲甯с€佸疄闄呰Е鍙戞鏁般€佺獥鍙ｅ唴杩涘害鏀剁泭
// 鐢ㄦ硶锛歯ode diag-dimboost-galaxy.mjs [--warm=200] [--frames=300] [--saves=a,b]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const ROOT = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };
const argNum = (k, d) => { const h = process.argv.find(a => a.startsWith(`--${k}=`)); const v = h ? Number(h.split("=")[1]) : NaN; return Number.isFinite(v) && v > 0 ? v : d; };
const argStr = (k, d) => { const h = process.argv.find(a => a.startsWith(`--${k}=`)); return h ? h.split("=")[1] : d; };
const WARM = argNum("warm", 200);
const FRAMES = argNum("frames", 300);
const FRAME_MS = 20;
// 鏄惁鎶婂凡涓婄嚎鐨?AD / TickSpeed 缂╂斁鎵撳紑锛堟ā鎷熺帺瀹跺綋鍓嶇殑瀹為檯閰嶇疆锛?const ADSCALE = process.argv.includes("--adscale");
const DEFAULT_SAVES = [
  "1._1e12AM.txt",
  "29._2AG+9DB+1e50AM.txt",
  "598._1R+1DB+1e9AM.txt",
  "132._9.1e137IP.txt",
];
const SAVES = argStr("saves", "").split(",").filter(Boolean).length
  ? argStr("saves", "").split(",")
  : DEFAULT_SAVES;

const ROOT_ABS = path.resolve(ROOT);
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(ROOT_ABS, "." + p);
  const rel = path.relative(ROOT_ABS, f);
  if (rel.startsWith("..") || path.isAbsolute(rel)) { res.writeHead(403).end(); return; }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(8487, "127.0.0.1", r));

const browser = await launchViaConnect({ protocolTimeout: 300000 });
const page = await browser.newPage();
const errs = [];
const NOISE = /googletagmanager|google-analytics|kaspersky-labs|Vue warn|progress\.info/;
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => { if (m.type() === "error" && !NOISE.test(m.text())) errs.push(`CONSOLE: ${m.text().slice(0, 160)}`); });
await page.goto("http://127.0.0.1:8487/index.html", { waitUntil: "load", timeout: 60000 });
let ready = false;
for (let i = 0; i < 80; i++) {
  ready = await page.evaluate(() => { try { return typeof gameLoop === "function" && typeof Autobuyers === "object"; } catch (e) { return false; } }).catch(() => false);
  if (ready) break;
  await new Promise(r => setTimeout(r, 400));
}
if (!ready) { console.log("FAIL 娓告垙鏈惎鍔?); await browser.close(); server.close(); process.exit(1); }
console.log("PASS 灏辩华");

await page.evaluate(() => {
  const lg = v => { if (v && typeof v.log10 === "function") { const d = v.log10(); const n = d && d.toNumber ? d.toNumber() : Number(d); return Number.isFinite(n) ? n : NaN; } const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.log10(n) : NaN; };
  const TARGETS = ["dimboost", "galaxy"];
  const gates = {
    dimboost: () => DimBoost.canBeBought && DimBoost.requirement.isSatisfied,
    galaxy: () => Galaxy.canBeBought && Galaxy.requirement.isSatisfied,
  };
  const counts = { dimboost: 0, galaxy: 0 };
  const st = {};
  let hooked = false;

  window.__d = {
    lg,
    hook() {
      if (hooked) return;
      for (const key of TARGETS) {
        const b = Autobuyer[key];
        const orig = b.tick.bind(b);
        b.tick = (...args) => { counts[key]++; return orig(...args); };
      }
      hooked = true;
    },
    setup(text, F, enable) {
      try { GameIntervals.stop(); } catch (e) { }
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { }
      GameSpeed.set(F);
      player.auto.autobuyersOn = true;
      const before = {};
      for (const key of TARGETS) {
        const b = Autobuyer[key];
        before[key] = { unlocked: b.isUnlocked, bought: !!b.data.isBought, active: b.isActive };
        if (enable.includes(key)) {
          if (!b.isBought) b.data.isBought = true;
          b.isActive = true;
        }
      }
      st.frames = 0;
      for (const key of TARGETS) { st[key] = { ready: 0, blocked: 0, ticked: 0 }; counts[key] = 0; }
      return {
        F, before,
        galaxies: player.galaxies,
        dimboosts: DimBoost.purchasedBoosts,
        maxAmLog: lg(player.records.thisInfinity.maxAM),
        amLog: lg(Currency.antimatter.value),
        breakOn: !!player.break,
        infinityGoal: lg(Player.infinityGoal),
        // 鑷姩璐拱鍣ㄨВ閿佹潯浠?        nc10: NormalChallenge(10).isCompleted,
        nc11: NormalChallenge(11).isCompleted,
        buyMaxBoost: BreakInfinityUpgrade.autobuyMaxDimboosts.isBought,
        buyMaxGal: EternityMilestone.autobuyMaxGalaxies.isReached,
        dbInterval: Autobuyer.dimboost.interval,
        galInterval: Autobuyer.galaxy.interval,
        adActive: Autobuyer.antimatterDimension.zeroIndexed.filter(b => b.isActive).length,
        tsActive: Autobuyer.tickspeed.isActive,
      };
    },
    step(n, ms) {
      for (let i = 0; i < n; i++) {
        const pre = {};
        for (const key of TARGETS) pre[key] = gates[key]() && Autobuyer[key].canTick === false;
        const before = { ...counts };
        gameLoop(ms);
        st.frames++;
        for (const key of TARGETS) {
          const readyNow = gates[key]();
          if (readyNow) st[key].ready++;
          if (pre[key] && readyNow) st[key].blocked++;
          if (counts[key] > before[key]) st[key].ticked++;
        }
      }
      return {
        frames: st.frames,
        detail: { dimboost: { ...st.dimboost }, galaxy: { ...st.galaxy } },
        snaps: {
          amLog: lg(Currency.antimatter.value),
          maxAmLog: lg(player.records.thisInfinity.maxAM),
          galaxies: player.galaxies,
          dimboosts: DimBoost.purchasedBoosts,
          infinityPoints: lg(Currency.infinityPoints.value),
          gameTime: player.records.totalTimePlayed,
          realTime: player.records.realTimePlayed,
        },
      };
    },
  };
  window.__d.hook();
});

const all = [];
for (const saveFile of SAVES) {
  const text = fs.readFileSync(path.join(SAVE_DIR, saveFile), "utf-8");
  for (const F of [1, 10000]) {
    const info = await page.evaluate(({ t, F, adScale }) => {
      const out = window.__d.setup(t, F, ["dimboost", "galaxy"]);
      GameSpeed.setScaleAutobuyerInterval(adScale);
      GameSpeed.setScaleTickspeedAutobuyerInterval(adScale);
      return { ...out, adScale, adInterval: Autobuyer.antimatterDimension.oneIndexed[1].effectiveInterval,
        tsInterval: Autobuyer.tickspeed.effectiveInterval };
    }, { t: text, F, adScale: ADSCALE });
    const s0 = await page.evaluate(() => ({
      amLog: window.__d.lg(Currency.antimatter.value),
      maxAmLog: window.__d.lg(player.records.thisInfinity.maxAM),
      galaxies: player.galaxies,
      dimboosts: DimBoost.purchasedBoosts,
      infinityPoints: window.__d.lg(Currency.infinityPoints.value),
    }));
    // 棰勭儹锛欶=1 鏃剁獥鍙ｅ緢鐭紝鍏堣鏈満鏃犻檺鎺ㄨ繘鍒般€屽彲浠ヨ繛缁彁鍗?鏄熺郴銆嶇殑鐘舵€?    if (WARM > 0) await page.evaluate(({ n }) => window.__d.step(n, 20), { n: WARM });
    const mid = await page.evaluate(() => ({
      amLog: window.__d.lg(Currency.antimatter.value),
      maxAmLog: window.__d.lg(player.records.thisInfinity.maxAM),
      galaxies: player.galaxies,
      dimboosts: DimBoost.purchasedBoosts,
      infinityPoints: window.__d.lg(Currency.infinityPoints.value),
    }));
    const out = await page.evaluate(({ n }) => window.__d.step(n, 20), { n: FRAMES });
    const row = {
      saveFile, F, info, s0, mid, out,
      dBoost: out.snaps.dimboosts - mid.dimboosts,
      dGal: out.snaps.galaxies - mid.galaxies,
      dMaxAm: out.snaps.maxAmLog - mid.maxAmLog,
      dGameMs: out.snaps.gameTime - (mid.gameTime ?? 0),
    };
    all.push(row);
    const d = out.detail;
    console.log(`\n[${saveFile} @ F=${F}${ADSCALE ? " +AD/TS缂╂斁" : ""}]`);
    console.log(`  闃舵: gal=${info.galaxies} boost=${info.dimboosts} maxAM=1e${info.maxAmLog?.toFixed(1)} break=${info.breakOn} ` +
      `NC10=${info.nc10} NC11=${info.nc11} buyMaxBoost=${info.buyMaxBoost} buyMaxGal=${info.buyMaxGal}`);
    console.log(`  瑙ｉ攣: boost=${JSON.stringify(info.before.dimboost)} gal=${JSON.stringify(info.before.galaxy)} ` +
      `interval(DB=${info.dbInterval}ms, GAL=${info.galInterval}ms) AD娲诲姩=${info.adActive}/8 TS=${info.tsActive} ` +
      `AD闂撮殧=${info.adInterval}ms TS闂撮殧=${info.tsInterval}ms`);
    console.log(`  娴嬮噺绐楀彛 ${out.frames} 甯?${FRAMES * 20}ms 澧欓挓): ` +
      `DB ready=${d.dimboost.ready} blocked=${d.dimboost.blocked} ticked=${d.dimboost.ticked} 螖=${row.dBoost} | ` +
      `GAL ready=${d.galaxy.ready} blocked=${d.galaxy.blocked} ticked=${d.galaxy.ticked} 螖=${row.dGal}`);
    console.log(`  杩涘害: maxAM 1e${mid.maxAmLog?.toFixed(2)}鈫?e${out.snaps.maxAmLog?.toFixed(2)} ` +
      `螖娓告垙鏃?${((out.snaps.gameTime - mid.gameTime) / 1000).toFixed(1)}s 螖鐜板疄鏃?${((out.snaps.realTime - mid.realTime) / 1000).toFixed(2)}s`);
  }
}

fs.writeFileSync("C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/diag-dimboost-galaxy.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), warm: WARM, frames: FRAMES, frameMs: FRAME_MS, rows: all, errors: errs }, null, 2));
console.log("\n宸插啓鍏?_research/diag-dimboost-galaxy.json");
if (errs.length) console.log("寮傚父锛?, errs.slice(0, 3));
await browser.close();
server.close();
