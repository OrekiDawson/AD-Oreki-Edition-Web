// P0/P2 鍙鎺㈤拡锛欰sync.run 涓夋潯璺緞鐨勬竻鐞嗚涓?+ 鑷姩璐拱鍣ㄧ殑璁℃椂璇箟
// 涓嶆敼 src锛涙墍鏈夋彃妗╅兘鍦ㄩ〉闈㈣繍琛屾椂鍋氾紙鍖呰鍑芥暟锛岃皟鐢ㄥ悗杩樺師锛?
//
// 鐢ㄦ硶锛歯ode probe-async-cadence.mjs
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
await new Promise(r => server.listen(8450, "127.0.0.1", r));

const browser = await launchViaConnect({ protocolTimeout: 300000 });
const page = await browser.newPage();
const errs = [];
const NOISE = /googletagmanager|google-analytics|kaspersky-labs/;
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => { if (m.type() === "error" && !NOISE.test(m.text())) errs.push(`CONSOLE: ${m.text().slice(0, 160)}`); });
await page.goto("http://127.0.0.1:8450/index.html", { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 80; i++) {
  const ok = await page.evaluate(() => { try { return typeof gameLoop === "function" && typeof Async === "object" && typeof player === "object"; } catch (e) { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}
console.log("PASS 灏辩华");

await page.evaluate(() => {
  const lg = v => { if (v && typeof v.log10 === "function") { const d = v.log10(); const n = d && d.toNumber ? d.toNumber() : Number(d); return Number.isFinite(n) ? n : NaN; } const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.log10(n) : NaN; };
  const num = v => { const n = v && v.toNumber ? v.toNumber() : Number(v); return Number.isFinite(n) ? n : NaN; };

  const sim = { entry: 0, exit: 0, then: 0, bars: [], maxTicks: null };
  const ab = { attempts: 0, purchases: 0, perBuyer: {} };
  let abWrapped = false;

  window.__p = {
    lg, num,
    resetSim() { sim.entry = 0; sim.exit = 0; sim.then = 0; sim.bars = []; sim.maxTicks = null; },
    simState() {
      return {
        ...sim,
        locked: (() => { try { return GameSpeed.isSimulationLocked; } catch (e) { return null; } })(),
        gameLoopRunning: (() => { try { return GameIntervals.gameLoop.isStarted; } catch (e) { return null; } })(),
        asyncEnabled: (() => { try { return Async.enabled; } catch (e) { return null; } })(),
      };
    },
    // 鍖呰 Async.run锛氳褰?three 鍥炶皟鏄惁琚皟鐢紝骞惰褰曡繘搴︽潯 max锛? 琚帴鍙楃殑 tick 鏁帮級
    hookAsync() {
      if (window.Async.__hooked) return true;
      const orig = Async.run.bind(Async);
      const wrapped = (fun, maxIter, config = {}) => {
        const c = { ...config };
        c.asyncEntry = (...a) => { sim.entry++; try { const b = ui.$viewModel.modal.progressBar; if (b && b.max != null) sim.maxTicks = b.max; } catch (e) { /* ignore */ } return config.asyncEntry && config.asyncEntry(...a); };
        c.asyncExit = (...a) => { sim.exit++; return config.asyncExit && config.asyncExit(...a); };
        c.then = config.then ? (...a) => { sim.then++; return config.then(...a); } : undefined;
        return orig(fun, maxIter, c);
      };
      Async.run = wrapped;
      window.Async.__hooked = true;
      return true;
    },
    // 鍖呰姣忎釜鑷姩璐拱鍣ㄧ殑 tick锛岀粺璁?灏濊瘯"鍜?鐪熸鑺变簡璧勬簮"鐨勬鏁?
    hookAutobuyers() {
      if (abWrapped) return true;
      for (const b of Autobuyers.all) {
        if (!b || typeof b.tick !== "function") continue;
        const orig = b.tick.bind(b);
        const key = b.constructor && b.constructor.name || "anon";
        b.__origTick = orig;
        b.tick = (...args) => {
          ab.attempts++;
          ab.perBuyer[key] = (ab.perBuyer[key] || 0) + 1;
          return orig(...args);
        };
      }
      abWrapped = true;
      return true;
    },
    abState() { return { ...ab, perBuyer: { ...ab.perBuyer } }; },
    resetAb() { ab.attempts = 0; ab.purchases = 0; ab.perBuyer = {}; return true; },
    load(text, F) {
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      GameSpeed.set(F);
      return this.snap();
    },
    snap() {
      const safe = f => { try { return f(); } catch (e) { return undefined; } };
      return {
        game: player.records.totalTimePlayed,
        real: player.records.realTimePlayed,
        amLog: lg(Currency.antimatter.value),
        ipLog: lg(Currency.infinityPoints.value),
        epLog: lg(Currency.eternityPoints.value),
        inf: num(Currency.infinities.value),
        eter: num(Currency.eternities.value),
        speedup: safe(() => getGameSpeedupFactor()),
        locked: safe(() => GameSpeed.isSimulationLocked),
        intervals: safe(() => GameIntervals.gameLoop.isStarted),
      };
    },
    // 鐩存帴璋?simulateTime锛堜笌 storage.js:506 瀹屽叏鐩稿悓鐨勫弬鏁板舰鐘讹級
    sim(sec, real, fast) { simulateTime(sec, real, fast); return true; },
    // 鑷姩璐拱鍣細鍙惎鐢ㄦ寚瀹氬嚑涓?+ 閲囨牱 interval / timeSinceLastTick
    probeAutobuyers() {
      const out = [];
      for (const b of Autobuyers.all) {
        if (!b) continue;
        out.push({
          name: (b.constructor && b.constructor.name) || "anon",
          isBought: (() => { try { return !!b.isBought; } catch (e) { return null; } })(),
          isEnabled: (() => { try { return !!b.isEnabled; } catch (e) { return null; } })(),
          interval: (() => { try { return b.interval; } catch (e) { return null; } })(),
          since: (() => { try { return b.timeSinceLastTick; } catch (e) { return null; } })(),
          canTick: (() => { try { return !!b.canTick; } catch (e) { return null; } })(),
        });
      }
      return out;
    },
    runFrames(n, ms) { for (let i = 0; i < n; i++) gameLoop(ms); return this.snap(); },
  };
  window.__p.hookAsync();
});

const e = (v, d = 3) => (Number.isFinite(v) ? v.toExponential(d) : "鈥?);
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  鈥?${detail}` : ""}`); };
const note = t => console.log(`NOTE  ${t}`);
const save = f => fs.readFileSync(path.join(SAVE_DIR, f), "utf-8");

// ================= A. Async.run 涓夋潯璺緞 =================
console.log("\n========== A. Async.run 璺緞涓庢竻鐞嗚涓?==========");
const A = {};

// A1 姝ｅ父寮傛锛坱ick 瓒冲澶氾紝蹇呯劧鍒嗘壒锛?
{
  await page.evaluate(({ text }) => { window.__p.load(text, 10000); window.__p.resetSim(); }, { text: save("132._9.1e137IP.txt") });
  await page.evaluate(() => window.__p.sim(300, false, false));
  // 绛夋ā鎷熺湡姝ｇ粨鏉燂紙閿侀噴鏀撅級
  for (let i = 0; i < 600; i++) {
    const st = await page.evaluate(() => window.__p.simState());
    if (!st.locked) break;
    await new Promise(r => setTimeout(r, 100));
  }
  A.normal = await page.evaluate(() => window.__p.simState());
  console.log(`  A1 姝ｅ父寮傛锛歟ntry=${A.normal.entry} exit=${A.normal.exit} then=${A.normal.then} ticks=${A.normal.maxTicks} 閿?${A.normal.locked} intervals=${A.normal.gameLoopRunning} asyncEnabled=${A.normal.asyncEnabled}`);
}
check("[A1] 姝ｅ父寮傛璺緞锛歛syncEntry / asyncExit / then 涓夎€呴兘瑙﹀彂锛岄攣閲婃斁銆佽鏃跺櫒閲嶅惎",
  A.normal.entry >= 1 && A.normal.exit === 1 && A.normal.then === 1 && A.normal.locked === false && A.normal.gameLoopRunning === true,
  `entry=${A.normal.entry} exit=${A.normal.exit} then=${A.normal.then} locked=${A.normal.locked} intervals=${A.normal.gameLoopRunning}`);

// A2 鍗曟壒瀹屾垚锛坃run 鐨?`if (!remaining) return;` 鏃╅€€锛夆啋 asyncExit 搴斿綋涓嶈Е鍙?
{
  await page.evaluate(({ text }) => { window.__p.load(text, 1); window.__p.resetSim(); }, { text: save("132._9.1e137IP.txt") });
  // S 灏?鈫?ticks 灏?鈫?鍙兘 60ms 鍐呰窇瀹?
  await page.evaluate(() => window.__p.sim(1, false, false));
  await new Promise(r => setTimeout(r, 800));
  A.small = await page.evaluate(() => window.__p.simState());
  console.log(`  A2 鍗曟壒(1s 绂荤嚎)锛歟ntry=${A.small.entry} exit=${A.small.exit} then=${A.small.then} ticks=${A.small.maxTicks} 閿?${A.small.locked} intervals=${A.small.gameLoopRunning}`);
}
note(`[A2] 1 绉掔绾跨殑 tick 鏁?${A.small.maxTicks}锛宔ntry=${A.small.entry}锛?=棣栨灏辫窇瀹岋紝娌¤繘寮傛寰幆锛夈€乪xit=${A.small.exit}銆俙 +
  `杩欐鏄?src/core/async-utils.js:73 \`if (!config.progress.remaining) return;\` 鐨勬棭閫€鍒嗘敮銆俙);

// A3 鍚屾鍥為€€锛圓sync.enabled=false 鏃跺啀璺戜竴娆★級
{
  await page.evaluate(({ text }) => { window.__p.load(text, 10000); window.__p.resetSim(); }, { text: save("132._9.1e137IP.txt") });
  await page.evaluate(() => { Async.enabled = false; window.__p.sim(60, false, false); });
  await new Promise(r => setTimeout(r, 500));
  A.sync = await page.evaluate(() => window.__p.simState());
  console.log(`  A3 鍚屾鍥為€€锛歟ntry=${A.sync.entry} exit=${A.sync.exit} then=${A.sync.then} 閿?${A.sync.locked} intervals=${A.sync.gameLoopRunning} asyncEnabled=${A.sync.asyncEnabled}`);
  // 娓呯悊锛堜笉鏀?src锛屽彧鏄妸杩愯鏃剁姸鎬佸浣嶏紝閬垮厤姹℃煋鍚庣画鐢ㄤ緥锛?
  await page.evaluate(() => { try { GameSpeed.endSimulation(); } catch (e) { } Async.enabled = true; });
}
check("[A3] 鍚屾鍥為€€璺緞锛歵hen 瑙﹀彂锛屼絾 asyncEntry/asyncExit 閮戒笉瑙﹀彂锛堟竻鐞嗚璺宠繃锛?,
  A.sync.then >= 1 && A.sync.entry === 0 && A.sync.exit === 0,
  `entry=${A.sync.entry} exit=${A.sync.exit} then=${A.sync.then}`);
check("[A3b] 鍚屾鍥為€€鍚庡€嶇巼浠嶈鍐荤粨锛圤rekiSpeed.endSimulation 鏈墽琛?鈫?浠ょ墝娉勬紡锛?,
  A.sync.locked === true, `locked=${A.sync.locked}`);
note(`[A3-椋庨櫓] 鍚屾鍥為€€鍚屾椂璺宠繃 \`GameStorage.postLoadStuff()\`锛堥噸鍚?GameIntervals锛変笌 \`OrekiSpeed.endSimulation\`锛歚 +
  `intervals=${A.sync.gameLoopRunning}锛坒alse = 娓告垙鍋滄憜锛夈€侀攣=${A.sync.locked}锛坱rue = 鍊嶇巼璁剧疆鏀逛笉鍔紝鐩村埌鍒锋柊锛夈€俙);

// A4 寮傚父璺緞锛歠un 鎶涢敊 鈫?promise reject 鈫?then 涓嶆墽琛?鈫?enabled 姘镐箙 false
{
  A.exc = await page.evaluate(async () => {
    const before = Async.enabled;
    let exitCalled = 0, thenCalled = 0, rejected = false;
    try {
      await Async.run(() => { throw new Error("probe"); }, 5, {
        maxTime: 1, batchSize: 1,
        asyncExit: () => { exitCalled++; },
        then: () => { thenCalled++; },
      });
    } catch (e) { rejected = true; }
    const after = Async.enabled;
    try { Async.enabled = true; } catch (e) { /* ignore */ }
    return { before, after, rejected, exitCalled, thenCalled };
  });
  console.log(`  A4 寮傚父锛歳ejected=${A.exc.rejected} asyncExit=${A.exc.exitCalled} then=${A.exc.thenCalled} Async.enabled ${A.exc.before} 鈫?${A.exc.after}`);
}
check("[A4] 寮傚父閫€鍑哄悗 Async.enabled 涓嶄細鎭㈠锛堟案涔?false锛夛紝涓?asyncExit/then 閮戒笉瑙﹀彂",
  A.exc.rejected === true && A.exc.after === false && A.exc.exitCalled === 0 && A.exc.thenCalled === 0,
  `enabled ${A.exc.before}鈫?{A.exc.after}锛宔xit=${A.exc.exitCalled} then=${A.exc.thenCalled}`);
note("[A4-鍚庢灉] enabled 涓€鏃﹀彉 false锛屾杩涚▼鍐?*鍚庣画鎵€鏈?* Async.run锛堝惈姣忔绂荤嚎缁撶畻锛夐兘浼氳蛋鍚屾鍥為€€ 鈫?姣忔閮借烦杩?restart intervals + 瑙ｅ喕銆?);

// A5 閲嶅鑾峰彇浠ょ墝
{
  A.token = await page.evaluate(() => {
    const t1 = GameSpeed.beginSimulation();
    const t2 = GameSpeed.beginSimulation();
    const lockedAfterTwo = GameSpeed.isSimulationLocked;
    GameSpeed.endSimulation(t1);                 // 鐢ㄦ棫浠ょ墝閲婃斁
    const lockedAfterOld = GameSpeed.isSimulationLocked;
    GameSpeed.endSimulation(t2);                 // 鐢ㄥ綋鍓嶄护鐗岄噴鏀?
    return { lockedAfterTwo, lockedAfterOld, lockedAfterNew: GameSpeed.isSimulationLocked };
  });
  console.log(`  A5 浠ょ墝锛氫袱娆?begin 鍚?locked=${A.token.lockedAfterTwo}锛涚敤鏃т护鐗?end 鍚?locked=${A.token.lockedAfterOld}锛涚敤鏂颁护鐗?end 鍚?locked=${A.token.lockedAfterNew}`);
}
check("[A5] 浠ょ墝鍙兘琚€屽綋鍓嶉偅涓€涓€嶉噴鏀撅細鏃т护鐗岄噴鏀捐闈欓粯蹇界暐锛堥噸澶嶅姞閿?= 娉勬紡璺緞锛?,
  A.token.lockedAfterTwo === true && A.token.lockedAfterOld === true && A.token.lockedAfterNew === false,
  `two=${A.token.lockedAfterTwo} old=${A.token.lockedAfterOld} new=${A.token.lockedAfterNew}`);

// ================= B. 鑷姩璐拱鍣ㄨ妭濂?=================
console.log("\n========== B. 鑷姩璐拱鍣細璁℃椂璇箟涓庨珮 F 涓嬬殑棰戠巼 ==========");
await page.evaluate(() => window.__p.hookAutobuyers());
const SAVE_AB = "1000._9.73e14iM+Cel6+1.84e45SG.txt";
const abInfo = await page.evaluate(({ text }) => { window.__p.load(text, 1); return window.__p.probeAutobuyers(); }, { text: save(SAVE_AB) });
const enabledAB = abInfo.filter(x => x.isEnabled && x.interval != null);
console.log(`  瀛樻。 ${SAVE_AB}锛氳嚜鍔ㄨ喘涔板櫒鍏?${abInfo.length} 涓紝鍏朵腑宸插惎鐢?${enabledAB.length} 涓猔);
console.log(`  宸插惎鐢ㄦ牱渚嬶紙interval 鍗曚綅瑙傚療锛夛細`);
for (const x of enabledAB.slice(0, 6)) console.log(`    ${x.name.padEnd(32)} interval=${x.interval}ms since=${x.since?.toFixed?.(0) ?? x.since} canTick=${x.canTick}`);
const intervalSample = enabledAB[0]?.interval;

// B1锛氬悓鏍?200 甯э紝F=1 vs F=10000锛岀湅"鑷姩璐拱鍣ㄨЕ鍙戞鏁?/ 娓告垙鏃堕棿"
const B = [];
for (const F of [1, 10000]) {
  await page.evaluate(({ text, F }) => { window.__p.load(text, F); window.__p.resetAb(); }, { text: save(SAVE_AB), F });
  const s0 = await page.evaluate(() => window.__p.snap());
  const r = await page.evaluate(() => window.__p.runFrames(200, 20));
  const abState = await page.evaluate(() => window.__p.abState());
  B.push({ F, s0, s1: r, ab: abState, dGame: r.game - s0.game, dReal: r.real - s0.real, dAm: r.amLog - s0.amLog, dIp: r.ipLog - s0.ipLog });
  const cur = B[B.length - 1];
  console.log(`  F=${String(F).padStart(5)}锛氬抚 200锛屛旀父鎴忔椂闂?${e(cur.dGame)}ms锛屛旂幇瀹?${cur.dReal.toFixed(0)}ms锛宍 +
    `鑷姩璐拱鍣?tick 璋冪敤=${abState.attempts}锛屛攍og10(AM)=${cur.dAm.toFixed(4)}锛屛攍og10(IP)=${cur.dIp.toFixed(4)}`);
}
const b1 = B[0], b2 = B[1];
console.log(`  姣?1 涓?娓告垙灏忔椂"鐨勮喘涔板櫒 tick 鏁帮細F=1 ${(b1.ab.attempts / (b1.dGame / 3600000)).toFixed(3)}锛孎=10000 ${(b2.ab.attempts / (b2.dGame / 3600000)).toFixed(6)}`);
check("[B1] 鑷姩璐拱鍣ㄧ殑瑙﹀彂鐢便€岃嚜韬鏃跺櫒 + 鐜板疄鏃堕棿銆嶅喅瀹氾紝涓嶉殢 F 缂╂斁",
  Math.abs(b2.ab.attempts - b1.ab.attempts) / Math.max(b1.ab.attempts, 1) < 0.25,
  `鍚屾牱 200 甯э細F=1 ${b1.ab.attempts} 娆?vs F=10000 ${b2.ab.attempts} 娆★紙娓告垙鏃堕棿宸?${(b2.dGame / b1.dGame).toFixed(0)}脳锛塦);
note(`[B1-缁撹] 鍚屾牱鐨?200 甯э紙= 4s 鐜板疄鏃堕棿浠ｇ悊锛夛紝F=1 鎺ㄨ繘 ${e(b1.dGame)}ms 娓告垙鏃堕棿銆佽喘涔板櫒瑙﹀彂 ${b1.ab.attempts} 娆★紱` +
  `F=10000 鎺ㄨ繘 ${e(b2.dGame)}ms锛?{(b2.dGame / b1.dGame).toFixed(0)}脳 娓告垙鏃堕棿锛夛紝璐拱鍣ㄨЕ鍙戞鏁板嚑涔庝笉鍙橈紙${b2.ab.attempts} 娆★級銆俙 +
  `鈫?鍗曚綅娓告垙鏃堕棿鍐呯殑璐拱鍐崇瓥瀵嗗害闅?F 绾挎€т笅闄嶏紱杩欏氨鏄?k 瀹為獙閲?3.64脳 缂哄彛鍦ㄧ敓浜ц嚜鍔ㄨ喘涔板櫒涓婄殑瀵瑰簲琛ㄧ幇銆俙);
note(`[B1-鏈哄埗] 婧愮爜锛歕`timeSinceLastTick = player.records.realTimePlayed - data.lastTick\`锛坅utobuyer.js:100锛夛紝` +
  `鑰?\`realTimePlayed\` 绱姞鐨勬槸 \`realDiff / F\` = 澧欓挓銆傛墍浠?interval锛堟牱渚?${intervalSample}ms锛夋槸**鐜板疄姣**锛屼笌 F 鏃犲叧銆俙);

// ================= C. 绂荤嚎妯℃嫙涓殑鑷姩璐拱鍣?=================
console.log("\n========== C. 绂荤嚎妯℃嫙锛坒ast=false锛夐噷鐨勮嚜鍔ㄨ喘涔板櫒棰戠巼 ==========");
const C = [];
for (const F of [1, 10000]) {
  await page.evaluate(({ text, F }) => { window.__p.load(text, F); window.__p.resetAb(); window.__p.resetSim(); }, { text: save(SAVE_AB), F });
  const s0 = await page.evaluate(() => window.__p.snap());
  await page.evaluate(() => window.__p.sim(300, false, false));
  for (let i = 0; i < 600; i++) {
    const st = await page.evaluate(() => window.__p.simState());
    if (!st.locked) break;
    await new Promise(r => setTimeout(r, 100));
  }
  const s1 = await page.evaluate(() => window.__p.snap());
  const abState = await page.evaluate(() => window.__p.abState());
  const sim = await page.evaluate(() => window.__p.simState());
  C.push({ F, ticks: sim.maxTicks, attempts: abState.attempts, dGame: s1.game - s0.game, dReal: s1.real - s0.real });
  console.log(`  F=${String(F).padStart(5)}锛氱绾?300s锛宼icks=${sim.maxTicks}锛屛旀父鎴?${e(s1.game - s0.game)}ms锛屛旂幇瀹?${(s1.real - s0.real).toFixed(0)}ms锛岃喘涔板櫒 tick=${abState.attempts}`);
}
const c1 = C[0], c2 = C[1];
check("[C1] 绂荤嚎妯℃嫙鐨?tick 鏁颁笌 F 鏃犲叧锛堝悓涓€鐜板疄绉掓暟 鈫?鍚屼竴鎵规鏁帮級",
  Math.abs((c2.ticks || 0) - (c1.ticks || 0)) <= Math.max(2, c1.ticks * 0.02),
  `F=1 ${c1.ticks} vs F=10000 ${c2.ticks}`);
check("[C2] 绂荤嚎鏃惰喘涔板櫒鍙寜 tick 瑙﹀彂锛坱ick 鏁颁笌 F 鏃犲叧锛夆啋 楂?F 涓嬪崟浣嶆父鎴忔椂闂寸殑鍐崇瓥瀵嗗害鍚屾牱琚█閲?,
  Math.abs((c2.attempts || 0) - (c1.attempts || 0)) <= Math.max(0.05 * c1.attempts, 5),
  `F=1 ${c1.attempts} 娆?vs F=10000 ${c2.attempts} 娆★紙娓告垙鏃堕棿宸?${(c2.dGame / c1.dGame).toFixed(0)}脳锛塦);

check("[E] 鍏ㄦ祦绋嬫棤鏈崟鑾疯剼鏈紓甯?, errs.length === 0, errs.slice(0, 3).join(" | "));

fs.writeFileSync("C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/probe-async-cadence.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), A, B, C, abInfo: abInfo.filter(x => x.isEnabled).slice(0, 8), verdict: results, errors: errs }, null, 2));
console.log("\n宸插啓鍏?_research/probe-async-cadence.json");
const pass = results.filter(r => r.ok).length;
console.log(`\n==== 缁撴灉锛?{pass} 閫氳繃 / ${results.length - pass} 澶辫触 ====`);
await browser.close();
server.close();
process.exit(pass === results.length ? 0 : 1);
