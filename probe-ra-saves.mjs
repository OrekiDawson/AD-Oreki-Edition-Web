// 鎺㈡煡锛氬摢浜涙牱鏈瓨妗ｅ叿澶?Ra / 瀹犵墿璁板繂鏉′欢锛堝彧璇伙紝涓嶆敼瀛樻。锛?// 鐢ㄦ硶锛歯ode probe-ra-saves.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const ROOT = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };
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
await new Promise(r => server.listen(8420, "127.0.0.1", r));

const browser = await launchViaConnect({ protocolTimeout: 120000 });
const page = await browser.newPage();
await page.goto("http://127.0.0.1:8420/index.html", { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 80; i++) {
  const ok = await page.evaluate(() => {
    try { return typeof gameLoop === "function" && typeof Ra === "object" && typeof player === "object"; } catch (e) { return false; }
  }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}
console.log("PASS 灏辩华");

const files = fs.readdirSync(SAVE_DIR).filter(f => f.endsWith(".txt")).sort();
const out = [];
for (const f of files) {
  const text = fs.readFileSync(path.join(SAVE_DIR, f), "utf-8");
  const info = await page.evaluate((t) => {
    try {
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      const p = GameSaveSerializer.deserialize(t);
      player = p;
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      const ra = player.celestials && player.celestials.ra;
      const pets = {};
      let allPets = [];
      try { allPets = Ra.pets.all; } catch (e) { /* ignore */ }
      for (const pet of allPets) {
        pets[pet.key] = {
          unlocked: !!pet.isUnlocked,
          level: pet.level,
          memories: pet.memories,
          chunks: pet.memoryChunks,
          canChunks: !!pet.canGetMemoryChunks,
          chunkPS: (() => { try { return pet.memoryChunksPerSecond; } catch (e) { return null; } })(),
        };
      }
      return {
        ok: true,
        realities: (() => { try { return Number(Currency.realities.value); } catch (e) { return null; } })(),
        raUnlocked: (() => { try { return !!Ra.isUnlocked; } catch (e) { return false; } })(),
        raRunning: (() => { try { return !!Ra.isRunning; } catch (e) { return false; } })(),
        momentumTime: ra ? ra.momentumTime : null,
        petWithRemembrance: (() => { try { return Ra.petWithRemembrance || null; } catch (e) { return null; } })(),
        productionPerMemoryChunk: (() => { try { return Ra.productionPerMemoryChunk; } catch (e) { return null; } })(),
        pets,
        bhUnlocked: (() => { try { return !!BlackHoles.areUnlocked; } catch (e) { return null; } })(),
        bhPaused: (() => { try { return !!BlackHoles.arePaused; } catch (e) { return null; } })(),
        bhActive: (() => { try { return BlackHoles.list.map(h => !!h.isActive); } catch (e) { return null; } })(),
        enslavedStoringReal: (() => { try { return !!Enslaved.isStoringRealTime; } catch (e) { return null; } })(),
        speedup: (() => { try { return getGameSpeedupFactor(); } catch (e) { return null; } })(),
      };
    } catch (e) { return { ok: false, err: e.message }; }
  }, text);
  out.push({ file: f, ...info });
  const short = (v) => (typeof v === "number" ? v.toExponential(3) : String(v));
  console.log(`\n=== ${f}`);
  if (!info.ok) { console.log("   瑙ｆ瀽澶辫触:", info.err); continue; }
  console.log(`   realities=${info.realities} Ra=${info.raUnlocked}/${info.raRunning} momentumTime=${short(info.momentumTime)} remembrance=${info.petWithRemembrance} prodPerChunk=${short(info.productionPerMemoryChunk)}`);
  for (const [k, v] of Object.entries(info.pets || {})) {
    if (!v.unlocked && !v.level && !v.memories) continue;
    console.log(`     pet ${k.padEnd(8)} unlocked=${v.unlocked} lv=${v.level} memories=${short(v.memories)} chunks=${short(v.chunks)} canChunks=${v.canChunks} chunk/s=${short(v.chunkPS)}`);
  }
}

fs.writeFileSync("C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/ra-save-probe.json", JSON.stringify(out, null, 2));
await browser.close();
server.close();
console.log("\n宸插啓鍏?_research/ra-save-probe.json");
