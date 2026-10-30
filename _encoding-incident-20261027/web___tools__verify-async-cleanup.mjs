// 鍥炲綊娴嬭瘯锛欰sync.run 涓夋潯璺緞锛堟甯稿紓姝?/ 鍚屾鍥為€€ / 鍗曟壒鏃╅€€ / 寮傚父锛夌殑娓呯悊濂戠害
// 鏂█鍙ｅ緞锛歛syncExit 蹇呴』鍦ㄨ繖鍥涙潯璺緞涓嬮兘琚皟鐢ㄤ竴娆★紱OrekiSpeed 鍐荤粨浠ょ墝蹇呴』琚噴鏀撅紱
//           GameIntervals 蹇呴』琚噸鍚紱Async.enabled 涓嶅緱琚案涔呯疆 false銆?
//
// 鐢ㄦ硶锛歯ode verify-async-cleanup.mjs   锛堥€€鍑虹爜 0 = 鍏ㄩ儴閫氳繃锛?
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
await new Promise(r => server.listen(8470, "127.0.0.1", r));

const browser = await launchViaConnect({ protocolTimeout: 300000 });
const page = await browser.newPage();
const errs = [];
const NOISE = /googletagmanager|google-analytics|kaspersky-labs|progress\.info is not a function|ModalProgressBar|Vue warn/;
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => { if (m.type() === "error" && !NOISE.test(m.text())) errs.push(`CONSOLE: ${m.text().slice(0, 160)}`); });
await page.goto("http://127.0.0.1:8470/index.html", { waitUntil: "load", timeout: 60000 });
let ready = false;
for (let i = 0; i < 80; i++) {
  ready = await page.evaluate(() => { try { return typeof gameLoop === "function" && typeof Async === "object" && typeof player === "object"; } catch (e) { return false; } }).catch(() => false);
  if (ready) break;
  await new Promise(r => setTimeout(r, 400));
}
if (!ready) { console.log("FAIL  娓告垙鏈惎鍔?); await browser.close(); server.close(); process.exit(1); }
console.log("PASS  灏辩华");

await page.evaluate(() => {
  const st = { entry: 0, exit: 0, then: 0 };
  window.__t = {
    st,
    reset() { st.entry = 0; st.exit = 0; st.then = 0; return true; },
    hook() {
      if (window.Async.__hookedT) return true;
      const orig = Async.run.bind(Async);
      Async.run = (fun, maxIter, config = {}) => {
        const c = { ...config };
        if (config.asyncEntry) c.asyncEntry = (...a) => { st.entry++; return config.asyncEntry(...a); };
        if (config.asyncExit) c.asyncExit = (...a) => { st.exit++; return config.asyncExit(...a); };
        if (config.then) c.then = (...a) => { st.then++; return config.then(...a); };
        return orig(fun, maxIter, c);
      };
      window.Async.__hookedT = true;
      return true;
    },
    state() {
      return { ...st,
        locked: (() => { try { return GameSpeed.isSimulationLocked; } catch (e) { return null; } })(),
        intervals: (() => { try { return GameIntervals.gameLoop.isStarted; } catch (e) { return null; } })(),
        bar: (() => { try { return ui.$viewModel.modal.progressBar !== undefined; } catch (e) { return null; } })(),
        asyncEnabled: (() => { try { return Async.enabled; } catch (e) { return null; } })(),
        eff: (() => { try { return GameSpeed.effectiveFactor; } catch (e) { return null; } })(),
        factor: (() => { try { return GameSpeed.factor; } catch (e) { return null; } })(),
      };
    },
    load(text, F) {
      try { GameIntervals.stop(); } catch (e) { }
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { }
      GameSpeed.set(F);
      return true;
    },
    sim(sec, real, fast) { simulateTime(sec, real, fast); return true; },
    cleanup() {
      try { GameSpeed.endSimulation(); } catch (e) { }
      try { ui.$viewModel.modal.progressBar = undefined; } catch (e) { }
      try { Async.enabled = true; } catch (e) { }
      return true;
    },
  };
  window.__t.hook();
});

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  鈥?${detail}` : ""}`); };
const note = t => console.log(`NOTE  ${t}`);
const MID = "132._9.1e137IP.txt";
const save = f => fs.readFileSync(path.join(SAVE_DIR, f), "utf-8");
async function waitIdle(timeoutMs = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const st = await page.evaluate(() => window.__t.state());
    if (st.then > 0 && !st.locked) return st;
    await new Promise(r => setTimeout(r, 80));
  }
  return page.evaluate(() => window.__t.state());
}

// ---------- T1 姝ｅ父寮傛 ----------
await page.evaluate(({ text }) => { window.__t.load(text, 10000); window.__t.reset(); }, { text: save(MID) });
await page.evaluate(() => window.__t.sim(300, false, false));
await waitIdle();
const t1 = await page.evaluate(() => window.__t.state());
console.log(`  T1 姝ｅ父寮傛锛歟ntry=${t1.entry} exit=${t1.exit} then=${t1.then} locked=${t1.locked} intervals=${t1.intervals} enabled=${t1.asyncEnabled}`);
check("[T1] 姝ｅ父寮傛锛歛syncExit 璋冪敤 1 娆°€侀攣閲婃斁銆乮ntervals 閲嶅惎銆丄sync.enabled 鎭㈠",
  t1.entry >= 1 && t1.exit === 1 && t1.then === 1 && t1.locked === false && t1.intervals === true && t1.asyncEnabled === true,
  `entry=${t1.entry} exit=${t1.exit} then=${t1.then} locked=${t1.locked} intervals=${t1.intervals}`);
await page.evaluate(() => window.__t.cleanup());

// ---------- T2 鍚屾鍥為€€锛圓sync.enabled=false锛?----------
await page.evaluate(({ text }) => { window.__t.load(text, 10000); window.__t.reset(); }, { text: save(MID) });
await page.evaluate(() => { Async.enabled = false; window.__t.sim(60, false, false); });
await new Promise(r => setTimeout(r, 400));
const t2 = await page.evaluate(() => window.__t.state());
console.log(`  T2 鍚屾鍥為€€锛歟ntry=${t2.entry} exit=${t2.exit} then=${t2.then} locked=${t2.locked} intervals=${t2.intervals}`);
check("[T2] 鍚屾鍥為€€涔熸墽琛?asyncExit锛堥攣閲婃斁 + intervals 閲嶅惎锛夛紝鑰屼笉鏄彧璺?then",
  t2.exit === 1 && t2.then === 1 && t2.locked === false && t2.intervals === true,
  `exit=${t2.exit} then=${t2.then} locked=${t2.locked} intervals=${t2.intervals}`);
await page.evaluate(() => window.__t.cleanup());

// ---------- T3 鍗曟壒鏃╅€€锛坱icks 灏戝埌涓€娈靛唴璺戝畬锛?----------
await page.evaluate(({ text }) => { window.__t.load(text, 10000); window.__t.reset(); }, { text: save(MID) });
await page.evaluate(() => window.__t.sim(1, false, false));
await new Promise(r => setTimeout(r, 400));
const t3 = await page.evaluate(() => window.__t.state());
console.log(`  T3 鍗曟壒鏃╅€€锛歟ntry=${t3.entry} exit=${t3.exit} then=${t3.then} locked=${t3.locked} intervals=${t3.intervals} bar=${t3.bar}`);
check("[T3] 鍗曟壒鏃╅€€锛坃run 绗竴娈靛氨璺戝畬锛変篃鎵ц asyncExit锛氶攣閲婃斁銆乮ntervals 閲嶅惎銆佽繘搴︽潯娓呴櫎",
  t3.exit === 1 && t3.locked === false && t3.intervals === true && t3.bar === false,
  `entry=${t3.entry} exit=${t3.exit} locked=${t3.locked} intervals=${t3.intervals} bar=${t3.bar}`);
await page.evaluate(() => window.__t.cleanup());

// ---------- T4 寮傚父閫€鍑?----------
const t4 = await page.evaluate(async () => {
  const before = Async.enabled;
  let exit = 0, then = 0, rejected = false;
  try {
    await Async.run(() => { throw new Error("probe-throw"); }, 5, {
      maxTime: 1, batchSize: 1,
      asyncExit: () => { exit++; },
      then: () => { then++; },
    });
  } catch (e) { rejected = true; }
  const out = { before, after: Async.enabled, rejected, exit, then };
  try { Async.enabled = true; } catch (e) { }
  return out;
});
console.log(`  T4 寮傚父锛歳ejected=${t4.rejected} exit=${t4.exit} then=${t4.then} enabled ${t4.before}鈫?{t4.after}`);
check("[T4] 寮傚父閫€鍑猴細asyncExit 浠嶈璋冪敤锛坒ail-safe 娓呯悊锛夛紝Async.enabled 鎭㈠涓?true锛宼hen 涓嶆墽琛?,
  t4.rejected === true && t4.exit === 1 && t4.then === 0 && t4.after === true,
  `exit=${t4.exit} then=${t4.then} enabled=${t4.after}`);

// ---------- T5 閲嶅娓呯悊瀹夊叏 ----------
const t5 = await page.evaluate(() => {
  let err = null;
  try {
    GameSpeed.endSimulation();          // 鏃犲弬锛氬己鍒惰В鍐?
    GameSpeed.endSimulation();          // 鍐嶆潵涓€娆?
    const tok = GameSpeed.beginSimulation();
    GameSpeed.endSimulation(tok);
    GameSpeed.endSimulation(tok);       // 鐢ㄥ凡澶辨晥浠ょ墝鍐嶉噴鏀句竴娆?
  } catch (e) { err = e.message; }
  return { err, locked: GameSpeed.isSimulationLocked, eff: GameSpeed.effectiveFactor };
});
check("[T5] 閲嶅娓呯悊瀹夊叏锛氬娆?endSimulation / 澶辨晥浠ょ墝閲婃斁閮戒笉鎶涢敊锛屾渶缁堜负瑙ｉ攣鐘舵€?,
  t5.err === null && t5.locked === false, `err=${t5.err || "鏃?} locked=${t5.locked} eff=${t5.eff}`);

// ---------- T6 杩炵画涓ゆ缁撶畻 + 涓€旀敼鍊嶇巼 ----------
await page.evaluate(({ text }) => { window.__t.load(text, 10000); window.__t.reset(); }, { text: save(MID) });
await page.evaluate(() => window.__t.sim(60, false, false));
await waitIdle();
const afterFirst = await page.evaluate(() => window.__t.state());
await page.evaluate(() => { GameSpeed.set(2); window.__t.reset(); });
await page.evaluate(() => window.__t.sim(60, false, false));
await waitIdle();                     // 绗簩娆＄粨绠椾篃瑕佺瓑鐪熸缁撴潫锛屼笉鑳藉浐瀹?400ms
const t6b = await page.evaluate(() => window.__t.state());
console.log(`  绗竴娆″悗 eff=${afterFirst.eff}锛涙敼鍊嶇巼=2 鍚?eff=${t6b.eff}锛堝瓨鍊?${t6b.factor}锛夛紝绗簩娆?exit=${t6b.exit}`);
check("[T6] 缁撶畻鍚庡彲姝ｅ父淇敼鍊嶇巼锛堟棤浠ょ墝娉勬紡锛夛紝涓旂浜屾缁撶畻鎸夋柊鍊嶇巼鎵ц",
  afterFirst.locked === false && t6b.eff === 2 && t6b.exit === 1 && t6b.locked === false,
  `eff ${afterFirst.eff} 鈫?${t6b.eff}锛岀浜屾 exit=${t6b.exit} locked=${t6b.locked}`);
await page.evaluate(() => window.__t.cleanup());

// ---------- T7 妯℃嫙鏈熼棿鍊嶇巼鍐荤粨锛堜慨澶嶄笉寰楃牬鍧忓師鏈夎涔夛級 ----------
await page.evaluate(({ text }) => { window.__t.load(text, 10000); window.__t.reset(); }, { text: save(MID) });
await page.evaluate(() => window.__t.sim(300, false, false));
await new Promise(r => setTimeout(r, 300));
const t7mid = await page.evaluate(() => {
  const before = GameSpeed.effectiveFactor;
  GameSpeed.set(3);
  const after = GameSpeed.effectiveFactor;
  GameSpeed.set(10000);
  return { before, after, locked: GameSpeed.isSimulationLocked };
});
await waitIdle();
const t7end = await page.evaluate(() => window.__t.state());
check("[T7] 妯℃嫙杩涜涓€嶇巼浠嶈鍐荤粨锛堟敼璁剧疆涓嶅奖鍝嶇敓鏁堝€硷級锛岀粨鏉熷悗姝ｅ父瑙ｅ喕",
  t7mid.locked === true && t7mid.after === t7mid.before && t7end.locked === false,
  `locked=${t7mid.locked} eff ${t7mid.before}鈫?{t7mid.after}锛涚粨鏉熷悗 locked=${t7end.locked}`);
await page.evaluate(() => window.__t.cleanup());

// ---------- T8 鏃?then 鐨勮皟鐢ㄤ篃蹇呴』鎭㈠ enabled ----------
const t8 = await page.evaluate(async () => {
  const before = Async.enabled;
  await Async.run(() => { }, 3, { maxTime: 1, batchSize: 1 });
  const after = Async.enabled;
  try { Async.enabled = true; } catch (e) { }
  return { before, after };
});
check("[T8] 鏈彁渚?then 鐨?Async.run 涔熶細鎭㈠ Async.enabled锛堜笉鍐嶆案涔呭け鏁堬級",
  t8.before === true && t8.after === true, `enabled ${t8.before}鈫?{t8.after}`);

// ---------- T9 鍥炶皟鎶涢敊鐨勫紓甯镐紭鍏堢骇 ----------
const t9 = await page.evaluate(async () => {
  const out = {};
  // 9a: asyncEntry 鎶涢敊 鈫?asyncExit 浠嶆墽琛岋紝寮傚父鍚戝浼犳挱
  {
    let exit = 0;
    const before = Async.enabled;
    let msg = null;
    try {
      await Async.run(() => { }, 3, {
        maxTime: 1, batchSize: 1,
        asyncEntry: () => { throw new Error("entry-boom"); },
        asyncExit: () => { exit++; },
      });
    } catch (e) { msg = e.message; }
    out.entryThrows = { exit, msg, enabled: Async.enabled, before };
    try { Async.enabled = true; } catch (e) { }
  }
  // 9b: 鍙湁 asyncExit 鎶涢敊 鈫?浠?exit 鐨勫紓甯镐负鍑嗭紝enabled 浠嶆仮澶?
  {
    let msg = null;
    try {
      await Async.run(() => { }, 300, {
        maxTime: 1, batchSize: 1, sleepTime: 1,
        asyncExit: () => { throw new Error("exit-boom"); },
      });
    } catch (e) { msg = e.message; }
    out.exitThrows = { msg, enabled: Async.enabled };
    try { Async.enabled = true; } catch (e) { }
  }
  // 9c: fun 鎶涢敊 + asyncExit 涔熸姏閿?鈫?搴斾互 fun 鐨勫師濮嬪紓甯镐负鍑嗭紙涓嶈瑕嗙洊锛?
  {
    let msg = null;
    try {
      await Async.run(() => { throw new Error("body-boom"); }, 300, {
        maxTime: 1, batchSize: 1, sleepTime: 1,
        asyncExit: () => { throw new Error("exit-boom-2"); },
      });
    } catch (e) { msg = e.message; }
    out.bothThrow = { msg, enabled: Async.enabled };
    try { Async.enabled = true; } catch (e) { }
  }
  return out;
});
console.log(`  T9a asyncEntry 鎶涢敊锛歟xit=${t9.entryThrows.exit} msg=${t9.entryThrows.msg} enabled=${t9.entryThrows.before}鈫?{t9.entryThrows.enabled}`);
console.log(`  T9b 浠?asyncExit 鎶涢敊锛歮sg=${t9.exitThrows.msg} enabled=${t9.exitThrows.enabled}`);
console.log(`  T9c 涓よ€呴兘鎶涢敊锛歮sg=${t9.bothThrow.msg} enabled=${t9.bothThrow.enabled}`);
check("[T9] asyncEntry 鎶涢敊鏃?asyncExit 浠嶆墽琛屻€佸紓甯告甯镐紶鎾€乪nabled 鎭㈠",
  t9.entryThrows.exit === 1 && t9.entryThrows.msg === "entry-boom" && t9.entryThrows.enabled === true,
  `exit=${t9.entryThrows.exit} msg=${t9.entryThrows.msg}`);
check("[T10] 浠?asyncExit 鎶涢敊鏃讹細寮傚父鍚戝浼犳挱锛堜笉琚悶鎺夛級锛宔nabled 浠嶆仮澶?,
  t9.exitThrows.msg === "exit-boom" && t9.exitThrows.enabled === true,
  `msg=${t9.exitThrows.msg} enabled=${t9.exitThrows.enabled}`);
check("[T11] 璁＄畻寮傚父 + 娓呯悊寮傚父鍚屾椂鍙戠敓鏃讹紝浠ヨ绠楀紓甯镐负鍑嗭紙娓呯悊涓嶈鐩栧師濮嬮敊璇級",
  t9.bothThrow.msg === "body-boom" && t9.bothThrow.enabled === true,
  `msg=${t9.bothThrow.msg}`);

check("[E] 鍏ㄦ祦绋嬫棤鏈崟鑾疯剼鏈紓甯?, errs.length === 0, errs.slice(0, 3).join(" | "));

const pass = results.filter(r => r.ok).length;
console.log(`\n==== 缁撴灉锛?{pass} 閫氳繃 / ${results.length - pass} 澶辫触 ====`);
await browser.close();
server.close();
process.exit(pass === results.length ? 0 : 1);
