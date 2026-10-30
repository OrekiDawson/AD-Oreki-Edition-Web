// 瀹為獙 v3锛氶€愬抚鍒ゅ畾銆屾潯浠跺凡婊¤冻銆佸彧琚?interval 鎸′綇銆嶇殑甯ф暟锛堢洿鎺ラ噺鍖栭棿闅旀垚鏈級
// 鐩爣閾撅細缁村害鎻愬崌 鈫?鏄熺郴锛堟槦绯婚渶瑕佺淮搴︽彁鍗囨暟锛夛紝鐘舵€佺敤鏃犻檺鍓嶅瓨妗?+ 寮哄埗瑙ｉ攣璐拱鍣?//
// 鐢ㄦ硶锛歯ode exp-autobuyer-blocked.mjs [--frames=300]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const ROOT = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";
const SAVE_FILE = "29._2AG+9DB+1e50AM.txt";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };
const argNum = (k, d) => { const h = process.argv.find(a => a.startsWith(`--${k}=`)); const v = h ? Number(h.split("=")[1]) : NaN; return Number.isFinite(v) && v > 0 ? v : d; };
const FRAMES = argNum("frames", 300);
const FRAME_MS = 20;

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
await new Promise(r => server.listen(8483, "127.0.0.1", r));

const browser = await launchViaConnect({ protocolTimeout: 300000 });
const page = await browser.newPage();
const errs = [];
const NOISE = /googletagmanager|google-analytics|kaspersky-labs|Vue warn|progress\.info/;
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => { if (m.type() === "error" && !NOISE.test(m.text())) errs.push(`CONSOLE: ${m.text().slice(0, 160)}`); });
await page.goto("http://127.0.0.1:8483/index.html", { waitUntil: "load", timeout: 60000 });
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
  const num = v => { const n = v && v.toNumber ? v.toNumber() : Number(v); return Number.isFinite(n) ? n : NaN; };
  const ready$ = {
    dimboost: () => { try { return DimBoost.canBeBought && DimBoost.requirement.isSatisfied; } catch (e) { return false; } },
    galaxy: () => { try { return Galaxy.canBeBought && Galaxy.requirement.isSatisfied; } catch (e) { return false; } },
    tickspeed: () => { try { return Tickspeed.isAvailableForPurchase && Tickspeed.isAffordable; } catch (e) { return false; } },
    bigCrunch: () => { try { return Player.canCrunch; } catch (e) { return false; } },
  };
  const st = {};
  const counts = {};
  const LIST = Object.keys(ready$);
  let hooked = false;

  window.__b = {
    lg, num, LIST,
    hook() {
      if (hooked) return;
      for (const key of LIST) {
        const b = Autobuyer[key];
        const orig = b.tick.bind(b);
        counts[key] = 0;
        b.tick = (...args) => { counts[key]++; return orig(...args); };
      }
      hooked = true;
    },
    reset() {
      st.frames = 0;
      for (const key of LIST) { st[key] = { ready: 0, blocked: 0, ticked: 0 }; counts[key] = 0; }
    },
    // 缂╂斁寮€鍒版寚瀹氶泦鍚堬紙绌烘暟缁?= 鍏ㄥ叧锛?    applyScaling(set) {
      for (const key of LIST) {
        const want = set.includes(key);
        Object.defineProperty(Autobuyer[key], "usesSpeedScaledInterval", { configurable: true, get: () => want });
      }
      for (const b of Autobuyer.antimatterDimension.zeroIndexed) {
        Object.defineProperty(b, "usesSpeedScaledInterval", { configurable: true, get: () => false });
      }
      return LIST.map(k => ({ key: k, eff: Autobuyer[k].effectiveInterval, raw: Autobuyer[k].interval }));
    },
    setup(text, F, scaledSet) {
      try { GameIntervals.stop(); } catch (e) { }
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { }
      GameSpeed.set(F);
      GameSpeed.setScaleAutobuyerInterval(scaledSet.length > 0);
      for (const key of LIST) {
        const b = Autobuyer[key];
        if (!b.isBought) b.data.isBought = true;
        b.isActive = true;
      }
      player.auto.autobuyersOn = true;
      const eff = this.applyScaling(scaledSet);
      this.reset();
      return {
        F, scaledSet, eff,
        galaxies: player.galaxies, dimboosts: DimBoost.purchasedBoosts,
        breakOn: !!player.break, autobuyersOn: player.auto.autobuyersOn,
      };
    },
    // 閫愬抚锛氬厛璺戜竴甯э紝鍐嶈褰曘€屾潯浠跺氨缁?/ 琚棿闅旈樆濉炪€?    step(n, ms) {
      for (let i = 0; i < n; i++) {
        const pre = {};
        for (const key of LIST) pre[key] = ready$[key]() && Autobuyer[key].canTick === false;
        const before = {};
        for (const key of LIST) before[key] = counts[key];
        gameLoop(ms);
        st.frames++;
        for (const key of LIST) {
          const b = Autobuyer[key];
          const readyNow = ready$[key]();
          if (readyNow) st[key].ready++;
          if (pre[key] && readyNow) st[key].blocked++;
          if (counts[key] > before[key]) st[key].ticked++;
        }
      }
      return {
        frames: st.frames,
        detail: Object.fromEntries(LIST.map(k => [k, { ...st[k] }])),
        snaps: {
          amLog: lg(Currency.antimatter.value),
          galaxies: player.galaxies, dimboosts: DimBoost.purchasedBoosts,
          tickUpg: (() => { try { return Tickspeed.totalUpgrades; } catch (e) { return null; } })(),
          game: player.records.totalTimePlayed,
        },
      };
    },
  };
  window.__b.hook();
});

const saveText = fs.readFileSync(path.join(SAVE_DIR, SAVE_FILE), "utf-8");
const rows = [];
const runArm = async (F, scaledSet, label) => {
  const info = await page.evaluate(({ text, F, scaledSet }) => window.__b.setup(text, F, scaledSet), { text: saveText, F, scaledSet });
  const s0 = await page.evaluate(() => ({
    amLog: (() => { const v = Currency.antimatter.value; const d = v.log10 ? v.log10() : null; const n = d && d.toNumber ? d.toNumber() : Number(d); return n; })(),
    galaxies: player.galaxies, dimboosts: DimBoost.purchasedBoosts,
    tickUpg: (() => { try { return Tickspeed.totalUpgrades; } catch (e) { return null; } })(),
  }));
  const t0 = Date.now();
  const out = await page.evaluate(({ n, ms }) => window.__b.step(n, ms), { n: FRAMES, ms: FRAME_MS });
  const cpu = Date.now() - t0;
  const row = {
    label, F, scaledSet, info,
    ready: out.detail, frames: out.frames,
    dAm: out.snaps.amLog - s0.amLog,
    dGal: out.snaps.galaxies - s0.galaxies,
    dBoost: out.snaps.dimboosts - s0.dimboosts,
    dTickUpg: (out.snaps.tickUpg ?? 0) - (s0.tickUpg ?? 0),
    cpuPerFrame: cpu / FRAMES,
    eff: info.eff,
  };
  rows.push(row);
  const d = out.detail;
  console.log(`  ${label.padEnd(22)} F=${String(F).padStart(5)}锛歚 +
    `ready(boost=${d.dimboost.ready}, gal=${d.galaxy.ready}, tick=${d.tickspeed.ready}, crunch=${d.bigCrunch.ready}) ` +
    `blocked(boost=${d.dimboost.blocked}, gal=${d.galaxy.blocked}, tick=${d.tickspeed.blocked}, crunch=${d.bigCrunch.blocked}) ` +
    `ticked(boost=${d.dimboost.ticked}, gal=${d.galaxy.ticked}, tick=${d.tickspeed.ticked}) ` +
    `螖boost=${row.dBoost} 螖gal=${row.dGal} 螖tickUpg=${row.dTickUpg} 螖logAM=${row.dAm.toFixed(3)} CPU/甯?${row.cpuPerFrame.toFixed(3)}ms`);
  return row;
};

console.log("\n--- 鍩虹嚎锛氬叏閮ㄥ叧闂缉鏀撅紙interval 鎸夌幇瀹炴椂闂达級 ---");
for (const F of [1, 10000]) await runArm(F, [], `baseline F=${F}`);

console.log("\n--- 鍙缉鏀剧淮搴︽彁鍗?---");
for (const F of [1, 10000]) await runArm(F, ["dimboost"], `dimboost-only F=${F}`);

console.log("\n--- 鍙缉鏀炬槦绯?---");
for (const F of [1, 10000]) await runArm(F, ["galaxy"], `galaxy-only F=${F}`);

console.log("\n--- 鍚屾椂缂╂斁缁村害鎻愬崌 + 鏄熺郴锛堥摼寮忥級 ---");
for (const F of [1, 10000]) await runArm(F, ["dimboost", "galaxy"], `chain F=${F}`);

console.log("\n--- 鍙缉鏀?Tick Speed ---");
for (const F of [1, 10000]) await runArm(F, ["tickspeed"], `tickspeed-only F=${F}`);

fs.writeFileSync("C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/exp-autobuyer-blocked.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), save: SAVE_FILE, frames: FRAMES, frameMs: FRAME_MS, rows, errors: errs }, null, 2));
console.log("\n宸插啓鍏?_research/exp-autobuyer-blocked.json");
if (errs.length) console.log("寮傚父锛?, errs.slice(0, 3));
await browser.close();
server.close();
