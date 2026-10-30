// 自动机 wait 静默挂起探针
//
// 要回答的问题（不是猜测，而是实测）：
//   1. `wait <条件>` 的条件永远不成立时，自动机停在原地，玩家在界面上能否分辨它「在等」还是「在跑」？
//   2. 条件后来成立时能否正常继续（不误报、不重复通知、不重复执行后续命令）？
//   3. 暂停 / 停止 / 重新启动时等待状态是否会残留（残留会让「已等待」时间失真、少记日志）？
//   4. `until` 循环（每轮都会执行正文）不能被误报成「等待中」。
//
// 用法：node verify-automator-wait-hang.mjs [--save=861] [--f=10000]
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
if (!saveFile) throw new Error(`找不到存档 ${SAVE_KEY}`);

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
      // 真正打开「现实 → 自动机」子页，让控制条挂载，才能读到玩家看到的真实文案
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
log(`存档 ${saveFile} | 自动机解锁=${boot.unlocked} | 现实数=${boot.realities} | F=${FACTOR}`);
log(`已切到标签页 ${boot.tab}/${boot.subtab} | 膨胀中=${boot.dilationActive}`);
await new Promise(r => setTimeout(r, 500));

// ---------- 场景 1：条件永远不成立（pending TP 在未膨胀时恒为 0） ----------
const HANG = [
  "wait total tt >= 1e300",
  "notify \"resumed\"",
  "pause 0.2s",
].join("\n");
const r1s = await page.evaluate(c => window.__w.setScript(c), HANG);
await new Promise(r => setTimeout(r, 300));
await page.evaluate(() => window.__w.step(25, 20));
const s1a = await page.evaluate(() => window.__w.snap());
await page.evaluate(() => window.__w.step(250, 20)); // 再跑 5 秒现实 = 50000 游戏秒
const s1b = await page.evaluate(() => window.__w.snap());
log("\n[场景1] wait 条件恒为假（pending tp，未膨胀）");
log(`  编译命令数=${r1s.commands} 错误=${JSON.stringify(r1s.errors)}`);
log(`  起点: 行=${s1a.line} isWaiting=${s1a.isWaiting} 等待=${s1a.waitingFor}`);
log(`  5 秒后: 行=${s1b.line} isWaiting=${s1b.isWaiting} 等待=${s1b.waitingFor} 已等=${s1b.waitAgeMs}ms`);
log(`  游戏时间推进: ${(s1b.gameTime - s1a.gameTime).toFixed(0)} 秒`);
log(`  界面状态文案: ${JSON.stringify(s1b.statusTexts)}`);
log(`  事件日志尾部: ${JSON.stringify(s1b.logTail.slice(-2))}`);
results.push({ case: "hang", compiled: r1s, start: s1a, after5s: s1b });

// ---------- 场景 2：等待中途条件成立 → 应继续 ----------
const s2pre = await page.evaluate(() => window.__w.snap());
await page.evaluate(() => window.__w.setTT("1e300"));
const s2notify = await page.evaluate(() => window.__w.step(30, 20));
const s2 = await page.evaluate(() => window.__w.snap());
log("\n[场景2] 条件成立后应继续");
log(`  成立前: 行=${s2pre.line} isWaiting=${s2pre.isWaiting}`);
log(`  成立后: 行=${s2.line} isWaiting=${s2.isWaiting} 运行=${s2.running}`);
log(`  notify 触发: ${JSON.stringify(s2notify.notified)}`);
log(`  事件日志尾部: ${JSON.stringify(s2.logTail.slice(-3))}`);
results.push({ case: "resume", before: s2pre, snap: s2, notified: s2notify.notified });

// ---------- 场景 3：等待中暂停 → 恢复 ----------
await page.evaluate(() => window.__w.setTT("1000")); // 把条件重新变回「不成立」
const waitScript = await page.evaluate(c => window.__w.setScript(c), HANG);
await page.evaluate(() => window.__w.step(20, 20));
const s3a = await page.evaluate(() => window.__w.snap());
await page.evaluate(() => window.__w.pause());
await page.evaluate(() => window.__w.step(60, 20)); // 暂停 1.2 秒
const s3b = await page.evaluate(() => window.__w.snap());
await page.evaluate(() => window.__w.resume());
await page.evaluate(() => window.__w.step(10, 20));
const s3c = await page.evaluate(() => window.__w.snap());
log("\n[场景3] 等待中暂停 1.2 秒再恢复");
log(`  暂停前: isWaiting=${s3a.isWaiting} 已等=${s3a.waitAgeMs}ms`);
log(`  暂停中: mode=${s3b.mode} isWaiting=${s3b.isWaiting} 文案=${JSON.stringify(s3b.statusTexts)}`);
log(`  恢复后: isWaiting=${s3c.isWaiting} 已等=${s3c.waitAgeMs}ms（若含暂停时间则 > 1000ms 的失真）`);
results.push({ case: "pause", beforePause: s3a, paused: s3b, resumed: s3c });

// ---------- 场景 4：等待中停止再重启 ----------
await page.evaluate(() => window.__w.stop());
const s4a = await page.evaluate(() => window.__w.snap());
const s4b = await page.evaluate(c => window.__w.setScript(c), HANG);
await page.evaluate(() => window.__w.step(30, 20));
const s4c = await page.evaluate(() => window.__w.snap());
log("\n[场景4] 等待中停止再重启");
log(`  停止后: isOn=${s4a.isOn} isWaiting=${s4a.isWaiting} 运行=${s4a.running}`);
log(`  重启后: 行=${s4c.line} isWaiting=${s4c.isWaiting} 已等=${s4c.waitAgeMs}ms 日志=${s4c.logLen} 条`);
log(`  重启日志尾部: ${JSON.stringify(s4c.logTail.slice(-3))}`);
results.push({ case: "stop-restart", stopped: s4a, restarted: s4c, compiled: s4b });

// ---------- 场景 5：until 循环不能被误判成「等待中」 ----------
const untilScript = "until total tt >= 1e300 {\n  pause 0.4s\n}";
const r5 = await page.evaluate(c => window.__w.setScript(c), untilScript);
await page.evaluate(() => window.__w.step(150, 20)); // 3 秒
const s5 = await page.evaluate(() => window.__w.snap());
log("\n[场景5] until 循环（正文是 pause，条件恒假）");
log(`  编译命令数=${r5.commands} 错误=${JSON.stringify(r5.errors)}`);
log(`  运行=${s5.running} isWaiting=${s5.isWaiting} 行=${s5.line}`);
log(`  界面状态文案: ${JSON.stringify(s5.statusTexts)}`);
log(`  日志条数=${s5.logLen} 尾部=${JSON.stringify(s5.logTail.slice(-2))}`);
results.push({ case: "until-loop", compiled: r5, snap: s5 });

// ---------- 场景 6：模拟「同一个 wait 已经等了 70 秒」 ----------
await page.evaluate(() => window.__w.setScript("wait total tt >= 1e300"));
await page.evaluate(() => window.__w.step(20, 20));
const s6a = await page.evaluate(() => window.__w.snap());
const aged = await page.evaluate(() => window.__w.agoWait(70000));
const s6step1 = await page.evaluate(() => window.__w.step(20, 20));
const s6b = await page.evaluate(() => window.__w.snap());
const s6step2 = await page.evaluate(() => window.__w.step(20, 20));
const s6c = await page.evaluate(() => window.__w.snap());
const warnCount = await page.evaluate(() => window.__w.countLog("WAIT 指令已等待"));
const warnCount2 = await page.evaluate(() => window.__w.countLog("WAIT 指令已等待"));
log("\n[场景6] 把等待起点推到 70 秒前（模拟久等）");
log(`  推前: isWaiting=${s6a.isWaiting} 已等=${s6a.waitAgeMs}ms 文案=${JSON.stringify(s6a.statusTexts)}`);
log(`  推后: 已等=${aged}ms 文案=${JSON.stringify(s6b.statusTexts)}`);
log(`  状态类名: ${JSON.stringify(s6b.statusClasses)}`);
log(`  告警日志条数: 第1次=${warnCount} 第2次=${warnCount2}（不应随帧重复增长）`);
log(`  日志尾部: ${JSON.stringify(s6c.logTail.slice(-3))}`);
results.push({ case: "long-wait", before: s6a, aged, after: s6b, loggedOnce: warnCount, loggedTwice: warnCount2, tail: s6c.logTail });

// ---------- 场景 7：另外两种 wait（事件 / 黑洞）也要给出等待对象 ----------
const r7 = await page.evaluate(c => window.__w.setScript(c), "wait eternity\nnotify \"saw eternity\"");
await page.evaluate(() => window.__w.step(20, 20));
const s7 = await page.evaluate(() => window.__w.snap());
const r7b = await page.evaluate(c => window.__w.setScript(c), "wait black hole off\nnotify \"bh off\"");
await page.evaluate(() => window.__w.step(20, 20));
const s7b = await page.evaluate(() => window.__w.snap());
log("\n[场景7] wait eternity / wait black hole off 的等待对象");
log(`  wait eternity: isWaiting=${s7.isWaiting} 等待=${s7.waitingFor} 文案=${JSON.stringify(s7.statusTexts)}`);
log(`  wait bh off: isWaiting=${s7b.isWaiting} 等待=${s7b.waitingFor} 文案=${JSON.stringify(s7b.statusTexts)}`);
results.push({ case: "wait-others", eternity: s7, blackHole: s7b, compiledEternity: r7, compiledBH: r7b });

log(`\n页面错误: ${errs.length ? JSON.stringify(errs.slice(0, 5)) : "无"}`);
fs.writeFileSync(OUT, JSON.stringify({ save: saveFile, factor: FACTOR, boot, results, errors: errs }, null, 2), "utf-8");
log(`数据已写入 ${OUT}`);

await browser.close();
server.close();
