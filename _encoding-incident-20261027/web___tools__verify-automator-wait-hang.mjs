// 鑷姩鏈?wait 闈欓粯鎸傝捣鎺㈤拡
//
// 瑕佸洖绛旂殑闂锛堜笉鏄寽娴嬶紝鑰屾槸瀹炴祴锛夛細
//   1. `wait <鏉′欢>` 鐨勬潯浠舵案杩滀笉鎴愮珛鏃讹紝鑷姩鏈哄仠鍦ㄥ師鍦帮紝鐜╁鍦ㄧ晫闈笂鑳藉惁鍒嗚鲸瀹冦€屽湪绛夈€嶈繕鏄€屽湪璺戙€嶏紵
//   2. 鏉′欢鍚庢潵鎴愮珛鏃惰兘鍚︽甯哥户缁紙涓嶈鎶ャ€佷笉閲嶅閫氱煡銆佷笉閲嶅鎵ц鍚庣画鍛戒护锛夛紵
//   3. 鏆傚仠 / 鍋滄 / 閲嶆柊鍚姩鏃剁瓑寰呯姸鎬佹槸鍚︿細娈嬬暀锛堟畫鐣欎細璁┿€屽凡绛夊緟銆嶆椂闂村け鐪熴€佸皯璁版棩蹇楋級锛?//   4. `until` 寰幆锛堟瘡杞兘浼氭墽琛屾鏂囷級涓嶈兘琚鎶ユ垚銆岀瓑寰呬腑銆嶃€?//
// 鐢ㄦ硶锛歯ode verify-automator-wait-hang.mjs [--save=861] [--f=10000]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const ROOT = process.env.OREKI_ROOT || "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";
const OUT = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/automator-wait-hang.json";
const PORT = 8497;
const FRAME_MS = 20;

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon"
};

const argStr = (k, d) => {
  const h = process.argv.find(a => a.startsWith(`--${k}=`));
  return h ? h.split("=")[1] : d;
};
const argNum = (k, d) => {
  const v = Number(argStr(k, NaN));
  return Number.isFinite(v) && v > 0 ? v : d;
};
const SAVE_KEY = argStr("save", "861");
const FACTOR = argNum("f", 10000);

const saveFile = fs.readdirSync(SAVE_DIR).find(f => f.startsWith(`${SAVE_KEY}.`));
if (!saveFile) throw new Error(`鎵句笉鍒板瓨妗?${SAVE_KEY}`);

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
await new Promise(r => server.listen(PORT, "127.0.0.1", r));

const browser = await launchViaConnect({ protocolTimeout: 300000 });
const page = await browser.newPage();
const errs = [];
const NOISE = /googletagmanager|google-analytics|kaspersky-labs|Vue warn|progress\.info/;
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => {
  if (m.type() === "error" && !NOISE.test(m.text())) errs.push(`CONSOLE: ${m.text().slice(0, 200)}`);
});
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 80; i++) {
  const ok = await page.evaluate(() => {
    try { return typeof gameLoop === "function" && typeof AutomatorBackend === "object"; } catch (e) { return false; }
  }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

await page.evaluate(() => {
  window.__w = {
    boot(text, F) {
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      try { AutomatorBackend.stop(); } catch (e) { /* ignore */ }
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      GameSpeed.set(F);
      player.reality.automator.state.mode = AUTOMATOR_MODE.PAUSE;
      // 鐪熸鎵撳紑銆岀幇瀹?鈫?鑷姩鏈恒€嶅瓙椤碉紝璁╂帶鍒舵潯鎸傝浇锛屾墠鑳借鍒扮帺瀹剁湅鍒扮殑鐪熷疄鏂囨
      Tab.automation.show(true, Tab.automation.subtabs.find(s => s.key === "automator"));
      return {
        unlocked: Player.automatorUnlocked,
        realities: player.realities,
        totalTT: player.timestudy.theorem.toString(),
        dilationActive: player.dilation.active,
        ended: player.endgame,
        tab: ui.view.tab,
        subtab: ui.view.subtab,
      };
    },
    setScript(content) {
      const id = player.reality.automator.state.editorScript;
      player.reality.automator.scripts[id].name = "WAIT-TEST";
      AutomatorBackend.saveScript(id, content);
      player.reality.automator.state.topLevelScript = id;
      AutomatorBackend.start(id);
      AutomatorBackend.mode = AUTOMATOR_MODE.RUN;
      return {
        id,
        name: AutomatorBackend.currentRunningScript?.name ?? "?",
        commands: AutomatorBackend.currentRunningScript?.commands?.length ?? 0,
        errors: (AutomatorData.currentErrors() || []).slice(0, 3),
      };
    },
    step(n, ms = 20) {
      const notified = [];
      const orig = GameUI.notify.automator;
      GameUI.notify.automator = (m, ...rest) => { notified.push(String(m).slice(0, 80)); return orig.call(GameUI.notify, m, ...rest); };
      const errNotified = [];
      const origErr = GameUI.notify.error;
      GameUI.notify.error = (m, ...rest) => { errNotified.push(String(m).slice(0, 80)); return origErr.call(GameUI.notify, m, ...rest); };
      for (let i = 0; i < n; i++) gameLoop(ms);
      GameUI.notify.automator = orig;
      GameUI.notify.error = origErr;
      return { notified, errNotified };
    },
    snap() {
      const statusEls = [...document.querySelectorAll(".c-automator__status-text")];
      return {
        running: AutomatorBackend.isRunning,
        isOn: AutomatorBackend.isOn,
        mode: AutomatorBackend.mode,
        line: AutomatorBackend.currentLineNumber,
        isWaiting: AutomatorData.isWaiting,
        waitingFor: AutomatorData.waitingFor ?? null,
        waitAgeMs: AutomatorData.isWaiting ? Date.now() - AutomatorData.waitStart : null,
        statusTexts: statusEls.map(e => e.textContent.replace(/\s+/gu, " ").trim()).filter(Boolean),
        statusClasses: statusEls.map(e => e.className),
        logTail: AutomatorData.eventLog.slice(-5).map(e => `L${e.line}: ${e.message}`),
        logLen: AutomatorData.eventLog.length,
        totalTT: player.timestudy.theorem.toString(),
        gameTime: player.records.thisReality.time,
      };
    },
    setTT(v) { player.timestudy.theorem = new Decimal(v); },
    countLog(re) {
      const rx = new RegExp(re);
      return AutomatorData.eventLog.filter(e => rx.test(e.message)).length;
    },
    agoWait(ms) {
      AutomatorData.waitStart = Date.now() - ms;
      return Date.now() - AutomatorData.waitStart;
    },
    pause() { AutomatorBackend.pause(); },
    resume() { AutomatorBackend.mode = AUTOMATOR_MODE.RUN; },
    stop() { AutomatorBackend.stop(); },
  };
});

const text = fs.readFileSync(path.join(SAVE_DIR, saveFile), "utf-8");
const results = [];
const log = (...a) => console.log(...a);

const boot = await page.evaluate(({ t, f }) => window.__w.boot(t, f), { t: text, f: FACTOR });
log(`瀛樻。 ${saveFile} | 鑷姩鏈鸿В閿?${boot.unlocked} | 鐜板疄鏁?${boot.realities} | F=${FACTOR}`);
log(`宸插垏鍒版爣绛鹃〉 ${boot.tab}/${boot.subtab} | 鑶ㄨ儉涓?${boot.dilationActive}`);
await new Promise(r => setTimeout(r, 500));

// ---------- 鍦烘櫙 1锛氭潯浠舵案杩滀笉鎴愮珛锛坧ending TP 鍦ㄦ湭鑶ㄨ儉鏃舵亽涓?0锛?----------
const HANG = [
  "wait total tt >= 1e300",
  "notify \"resumed\"",
  "pause 0.2s",
].join("\n");
const r1s = await page.evaluate(c => window.__w.setScript(c), HANG);
await new Promise(r => setTimeout(r, 300));
await page.evaluate(() => window.__w.step(25, 20));
const s1a = await page.evaluate(() => window.__w.snap());
await page.evaluate(() => window.__w.step(250, 20)); // 鍐嶈窇 5 绉掔幇瀹?= 50000 娓告垙绉?const s1b = await page.evaluate(() => window.__w.snap());
log("\n[鍦烘櫙1] wait 鏉′欢鎭掍负鍋囷紙pending tp锛屾湭鑶ㄨ儉锛?);
log(`  缂栬瘧鍛戒护鏁?${r1s.commands} 閿欒=${JSON.stringify(r1s.errors)}`);
log(`  璧风偣: 琛?${s1a.line} isWaiting=${s1a.isWaiting} 绛夊緟=${s1a.waitingFor}`);
log(`  5 绉掑悗: 琛?${s1b.line} isWaiting=${s1b.isWaiting} 绛夊緟=${s1b.waitingFor} 宸茬瓑=${s1b.waitAgeMs}ms`);
log(`  娓告垙鏃堕棿鎺ㄨ繘: ${(s1b.gameTime - s1a.gameTime).toFixed(0)} 绉抈);
log(`  鐣岄潰鐘舵€佹枃妗? ${JSON.stringify(s1b.statusTexts)}`);
log(`  浜嬩欢鏃ュ織灏鹃儴: ${JSON.stringify(s1b.logTail.slice(-2))}`);
results.push({ case: "hang", compiled: r1s, start: s1a, after5s: s1b });

// ---------- 鍦烘櫙 2锛氱瓑寰呬腑閫旀潯浠舵垚绔?鈫?搴旂户缁?----------
const s2pre = await page.evaluate(() => window.__w.snap());
await page.evaluate(() => window.__w.setTT("1e300"));
const s2notify = await page.evaluate(() => window.__w.step(30, 20));
const s2 = await page.evaluate(() => window.__w.snap());
log("\n[鍦烘櫙2] 鏉′欢鎴愮珛鍚庡簲缁х画");
log(`  鎴愮珛鍓? 琛?${s2pre.line} isWaiting=${s2pre.isWaiting}`);
log(`  鎴愮珛鍚? 琛?${s2.line} isWaiting=${s2.isWaiting} 杩愯=${s2.running}`);
log(`  notify 瑙﹀彂: ${JSON.stringify(s2notify.notified)}`);
log(`  浜嬩欢鏃ュ織灏鹃儴: ${JSON.stringify(s2.logTail.slice(-3))}`);
results.push({ case: "resume", before: s2pre, snap: s2, notified: s2notify.notified });

// ---------- 鍦烘櫙 3锛氱瓑寰呬腑鏆傚仠 鈫?鎭㈠ ----------
await page.evaluate(() => window.__w.setTT("1000")); // 鎶婃潯浠堕噸鏂板彉鍥炪€屼笉鎴愮珛銆?const waitScript = await page.evaluate(c => window.__w.setScript(c), HANG);
await page.evaluate(() => window.__w.step(20, 20));
const s3a = await page.evaluate(() => window.__w.snap());
await page.evaluate(() => window.__w.pause());
await page.evaluate(() => window.__w.step(60, 20)); // 鏆傚仠 1.2 绉?const s3b = await page.evaluate(() => window.__w.snap());
await page.evaluate(() => window.__w.resume());
await page.evaluate(() => window.__w.step(10, 20));
const s3c = await page.evaluate(() => window.__w.snap());
log("\n[鍦烘櫙3] 绛夊緟涓殏鍋?1.2 绉掑啀鎭㈠");
log(`  鏆傚仠鍓? isWaiting=${s3a.isWaiting} 宸茬瓑=${s3a.waitAgeMs}ms`);
log(`  鏆傚仠涓? mode=${s3b.mode} isWaiting=${s3b.isWaiting} 鏂囨=${JSON.stringify(s3b.statusTexts)}`);
log(`  鎭㈠鍚? isWaiting=${s3c.isWaiting} 宸茬瓑=${s3c.waitAgeMs}ms锛堣嫢鍚殏鍋滄椂闂村垯 > 1000ms 鐨勫け鐪燂級`);
results.push({ case: "pause", beforePause: s3a, paused: s3b, resumed: s3c });

// ---------- 鍦烘櫙 4锛氱瓑寰呬腑鍋滄鍐嶉噸鍚?----------
await page.evaluate(() => window.__w.stop());
const s4a = await page.evaluate(() => window.__w.snap());
const s4b = await page.evaluate(c => window.__w.setScript(c), HANG);
await page.evaluate(() => window.__w.step(30, 20));
const s4c = await page.evaluate(() => window.__w.snap());
log("\n[鍦烘櫙4] 绛夊緟涓仠姝㈠啀閲嶅惎");
log(`  鍋滄鍚? isOn=${s4a.isOn} isWaiting=${s4a.isWaiting} 杩愯=${s4a.running}`);
log(`  閲嶅惎鍚? 琛?${s4c.line} isWaiting=${s4c.isWaiting} 宸茬瓑=${s4c.waitAgeMs}ms 鏃ュ織=${s4c.logLen} 鏉);
log(`  閲嶅惎鏃ュ織灏鹃儴: ${JSON.stringify(s4c.logTail.slice(-3))}`);
results.push({ case: "stop-restart", stopped: s4a, restarted: s4c, compiled: s4b });

// ---------- 鍦烘櫙 5锛歶ntil 寰幆涓嶈兘琚鍒ゆ垚銆岀瓑寰呬腑銆?----------
const untilScript = "until total tt >= 1e300 {\n  pause 0.4s\n}";
const r5 = await page.evaluate(c => window.__w.setScript(c), untilScript);
await page.evaluate(() => window.__w.step(150, 20)); // 3 绉?const s5 = await page.evaluate(() => window.__w.snap());
log("\n[鍦烘櫙5] until 寰幆锛堟鏂囨槸 pause锛屾潯浠舵亽鍋囷級");
log(`  缂栬瘧鍛戒护鏁?${r5.commands} 閿欒=${JSON.stringify(r5.errors)}`);
log(`  杩愯=${s5.running} isWaiting=${s5.isWaiting} 琛?${s5.line}`);
log(`  鐣岄潰鐘舵€佹枃妗? ${JSON.stringify(s5.statusTexts)}`);
log(`  鏃ュ織鏉℃暟=${s5.logLen} 灏鹃儴=${JSON.stringify(s5.logTail.slice(-2))}`);
results.push({ case: "until-loop", compiled: r5, snap: s5 });

// ---------- 鍦烘櫙 6锛氭ā鎷熴€屽悓涓€涓?wait 宸茬粡绛変簡 70 绉掋€?----------
await page.evaluate(() => window.__w.setScript("wait total tt >= 1e300"));
await page.evaluate(() => window.__w.step(20, 20));
const s6a = await page.evaluate(() => window.__w.snap());
const aged = await page.evaluate(() => window.__w.agoWait(70000));
const s6step1 = await page.evaluate(() => window.__w.step(20, 20));
const s6b = await page.evaluate(() => window.__w.snap());
const s6step2 = await page.evaluate(() => window.__w.step(20, 20));
const s6c = await page.evaluate(() => window.__w.snap());
const warnCount = await page.evaluate(() => window.__w.countLog("WAIT 鎸囦护宸茬瓑寰?));
const warnCount2 = await page.evaluate(() => window.__w.countLog("WAIT 鎸囦护宸茬瓑寰?));
log("\n[鍦烘櫙6] 鎶婄瓑寰呰捣鐐规帹鍒?70 绉掑墠锛堟ā鎷熶箙绛夛級");
log(`  鎺ㄥ墠: isWaiting=${s6a.isWaiting} 宸茬瓑=${s6a.waitAgeMs}ms 鏂囨=${JSON.stringify(s6a.statusTexts)}`);
log(`  鎺ㄥ悗: 宸茬瓑=${aged}ms 鏂囨=${JSON.stringify(s6b.statusTexts)}`);
log(`  鐘舵€佺被鍚? ${JSON.stringify(s6b.statusClasses)}`);
log(`  鍛婅鏃ュ織鏉℃暟: 绗?娆?${warnCount} 绗?娆?${warnCount2}锛堜笉搴旈殢甯ч噸澶嶅闀匡級`);
log(`  鏃ュ織灏鹃儴: ${JSON.stringify(s6c.logTail.slice(-3))}`);
results.push({ case: "long-wait", before: s6a, aged, after: s6b, loggedOnce: warnCount, loggedTwice: warnCount2, tail: s6c.logTail });

// ---------- 鍦烘櫙 7锛氬彟澶栦袱绉?wait锛堜簨浠?/ 榛戞礊锛変篃瑕佺粰鍑虹瓑寰呭璞?----------
const r7 = await page.evaluate(c => window.__w.setScript(c), "wait eternity\nnotify \"saw eternity\"");
await page.evaluate(() => window.__w.step(20, 20));
const s7 = await page.evaluate(() => window.__w.snap());
const r7b = await page.evaluate(c => window.__w.setScript(c), "wait black hole off\nnotify \"bh off\"");
await page.evaluate(() => window.__w.step(20, 20));
const s7b = await page.evaluate(() => window.__w.snap());
log("\n[鍦烘櫙7] wait eternity / wait black hole off 鐨勭瓑寰呭璞?);
log(`  wait eternity: isWaiting=${s7.isWaiting} 绛夊緟=${s7.waitingFor} 鏂囨=${JSON.stringify(s7.statusTexts)}`);
log(`  wait bh off: isWaiting=${s7b.isWaiting} 绛夊緟=${s7b.waitingFor} 鏂囨=${JSON.stringify(s7b.statusTexts)}`);
results.push({ case: "wait-others", eternity: s7, blackHole: s7b, compiledEternity: r7, compiledBH: r7b });

log(`\n椤甸潰閿欒: ${errs.length ? JSON.stringify(errs.slice(0, 5)) : "鏃?}`);
fs.writeFileSync(OUT, JSON.stringify({ save: saveFile, factor: FACTOR, boot, results, errors: errs }, null, 2), "utf-8");
log(`鏁版嵁宸插啓鍏?${OUT}`);

await browser.close();
server.close();
