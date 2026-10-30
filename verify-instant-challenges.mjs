// 挑战进入即完成 —— 浏览器集成验收（C / IC / EC）
// 用法: node verify-instant-challenges.mjs [root] [port]
// 依赖：与 verify-time-ui.mjs 相同的启动兼容层
//   export OREKI_PATCH_DIR="$(pwd)"
//   export NODE_OPTIONS="--import=file://<tools>/lib/patch-launch.mjs"
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition");
const port = Number(process.argv[3] || 8320);

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml", ".webm": "video/webm", ".mp3": "audio/mpeg",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject", ".ico": "image/x-icon",
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end("nf"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";
const samples = fs.readdirSync(SAVE_DIR).filter(f => f.endsWith(".txt"));
const pick = name => fs.readFileSync(path.join(SAVE_DIR, samples.find(f => f.includes(name))), "utf-8");

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({
  executablePath: EDGE, headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio", "--autoplay-policy=no-user-gesture-required"],
});
const results = [];
const check = (n, ok, d = "") => { results.push({ n, ok, d }); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };

const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(e.message));
await page.setViewport({ width: 1400, height: 950 });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 6500));

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function loadSave(text) {
  return page.evaluate(async (t) => {
    try { GameIntervals.gameLoop.stop(); } catch (e) { /* ignore */ }
    try { GameIntervals.all.forEach(i => i.stop()); } catch (e) { /* ignore */ }
    GameStorage.offlineEnabled = false;
    const obj = GameSaveSerializer.deserialize(t);
    player = obj;
    player.options.retryChallenge = false;
    GameStorage.loadPlayerObject(player);
    return {
      challengesUnlocked: Tab.challenges.isUnlocked,
      ecUnlocked: player.reality.unlockedEC,
      hook: typeof OrekiInstantChallenge,
    };
  }, text);
}

// 把挑战进度清成「全部未完成」，用于验证首次完成路径（隔离夹具，不落盘）
async function resetChallengeProgress() {
  return page.evaluate(() => {
    player.challenge.normal.completedBits = 0;
    player.challenge.infinity.completedBits = 0;
    player.eternityChalls = {};
    player.challenge.eternity.requirementBits = 0;
    player.challenge.normal.current = 0;
    player.challenge.infinity.current = 0;
    player.challenge.eternity.current = 0;
    player.challenge.normal.bestTimes = Array.repeat(Number.MAX_VALUE, 11);
    return true;
  });
}

// ---------------------------------------------------------------- 载入后期存档
const lateSave = pick("1123._Endgame");
const meta = await loadSave(lateSave);
console.log(`存档: 1123._Endgame  挑战可用=${meta.challengesUnlocked}  hook=${meta.hook}`);
check("[0] 钩子已挂到 window.OrekiInstantChallenge", meta.hook === "object", meta.hook);

await resetChallengeProgress();

// ============================================================ A. 普通挑战 C
console.log("\n=== A. 普通挑战 C：进入后下一帧即完成 ===");
for (const id of [2, 3, 5, 8, 11]) {
  const r = await page.evaluate((cid) => {
    const ipBefore = Currency.infinityPoints.value;
    const infBefore = Currency.infinities.value;
    const started = NormalChallenge(cid).start();
    const enteredId = player.challenge.normal.current;
    // 进入挑战本身会做一次 bigCrunchReset(true, true)（正常入口行为），
    // 之后「进入即完成」不得再产生任何 IP / 无限次数收益 —— 从这里开始比较。
    const ipAfterEnter = Currency.infinityPoints.value;
    const infAfterEnter = Currency.infinities.value;
    const res = OrekiInstantChallenge.tryComplete();
    return {
      enteredId,
      current: player.challenge.normal.current,
      completed: NormalChallenge(cid).isCompleted,
      bestTime: player.challenge.normal.bestTimes[cid - 2],
      bestRealTime: player.challenge.normal.bestRealTimes[cid - 2],
      ipChangedAfterComplete: !Currency.infinityPoints.value.eq(ipAfterEnter),
      infChangedAfterComplete: !Currency.infinities.value.eq(infAfterEnter),
      flagged: res.normal,
    };
  }, id);
  const ok = r.enteredId === id && r.current === 0 && r.completed === true &&
    r.ipChangedAfterComplete === false && r.infChangedAfterComplete === false &&
    r.bestTime < Number.MAX_VALUE;
  check(`[A${id}] C${id} 进入即完成、退出挑战、不白送 IP/无限`, ok,
    `entered=${r.enteredId} current=${r.current} completed=${r.completed} ` +
    `IP变化=${r.ipChangedAfterComplete} 无限变化=${r.infChangedAfterComplete} ` +
    `最佳游戏时间=${r.bestTime} 最佳现实时间=${r.bestRealTime}`);
}

// A-neg：已完成的挑战重新进入不重复结算
console.log("\n=== A2. 已完成挑战重进：不重复派发 ===");
{
  const r = await page.evaluate(() => {
    const bitsBefore = player.challenge.normal.completedBits;
    const bestBefore = player.challenge.normal.bestTimes[2];
    let events = 0;
    const off = EventHub.logEvent ? null : null;
    NormalChallenge(3).start();
    const entered = player.challenge.normal.current;
    const res = OrekiInstantChallenge.tryComplete();
    return {
      entered,
      bitsSame: player.challenge.normal.completedBits === bitsBefore,
      bestSame: player.challenge.normal.bestTimes[2] === bestBefore,
      current: player.challenge.normal.current,
      flagged: res.normal,
    };
  });
  check("[A2] 重进已完成 C3：位域与最佳时间不变、不重复标记完成",
    r.entered === 3 && r.bitsSame && r.bestSame && r.current === 0 && r.flagged === false,
    JSON.stringify(r));
}

// =========================================================== B. 无限挑战 IC
console.log("\n=== B. 无限挑战 IC ===");
for (const id of [1, 3, 8]) {
  const r = await page.evaluate((cid) => {
    const ic = InfinityChallenge(cid);
    if (!ic.isUnlocked) return { skip: 'locked' };
    ic.start();
    const entered = player.challenge.infinity.current;
    const ipAfterEnter = Currency.infinityPoints.value;
    const res = OrekiInstantChallenge.tryComplete();
    return {
      entered,
      current: player.challenge.infinity.current,
      completed: ic.isCompleted,
      ipChangedAfterComplete: !Currency.infinityPoints.value.eq(ipAfterEnter),
      flagged: res.infinity,
    };
  }, id);
  if (r.skip) { check(`[B${id}] IC${id}（未解锁，跳过）`, true, "该存档 IC 未解锁，不构成本轮证据"); continue; }
  const ok = r.entered === id && r.current === 0 && r.completed === true && r.ipChangedAfterComplete === false;
  check(`[B${id}] IC${id} 进入即完成、退出挑战、不白送 IP`, ok, JSON.stringify(r));
}

// ============================================================ C. 永恒挑战 EC
console.log("\n=== C. 永恒挑战 EC（重点 EC11 / EC12）===");
for (const id of [1, 11, 12]) {
  const r = await page.evaluate((cid) => {
    const ec = EternityChallenge(cid);
    // EC 的解锁指针是「当前可挑战的下一个 EC」（player.challenge.eternity.unlocked），
    // 这里按游戏自身机制把指针指到目标挑战，不直接改完成位。
    player.challenge.eternity.unlocked = cid;
    player.challenge.eternity.current = 0;
    if (!ec.isUnlocked) return { skip: 'locked' };
    const started = ec.start();
    const entered = player.challenge.eternity.current;
    const epAfterEnter = Currency.eternityPoints.value;
    const eternitiesAfterEnter = Currency.eternities.value;
    const completionsAfterEnter = ec.completions;
    const res = OrekiInstantChallenge.tryComplete();
    return {
      started, entered,
      current: player.challenge.eternity.current,
      completions: ec.completions,
      maxCompletions: ec.maxCompletions,
      fullyCompleted: ec.isFullyCompleted,
      completionsAfterEnter,
      requirementBit: (player.challenge.eternity.requirementBits >> cid) & 1,
      epChangedAfterComplete: !Currency.eternityPoints.value.eq(epAfterEnter),
      eternitiesChangedAfterComplete: !Currency.eternities.value.eq(eternitiesAfterEnter),
      flagged: res.eternity,
    };
  }, id);
  if (r.skip) { check(`[C${id}] EC${id}（未解锁，跳过）`, true, "该存档 EC 未解锁，不构成本轮证据"); continue; }
  const ok = r.entered === id && r.current === 0 && r.fullyCompleted === true &&
    r.completions === r.maxCompletions && r.requirementBit === 0 &&
    r.epChangedAfterComplete === false && r.eternitiesChangedAfterComplete === false;
  check(`[C${id}] EC${id} 进入即补满完成、退出、不白送 EP/永恒`, ok, JSON.stringify(r));
}

// C2：EC12 不会在进入当帧被判失败（F 放大后仍存活）
console.log("\n=== C2. EC12 与限时判定竞争 ===");
{
  const r = await page.evaluate(() => {
    player.challenge.eternity.current = 0;
    player.eternityChalls = {};
    player.challenge.eternity.unlocked = 12;
    const ec = EternityChallenge(12);
    if (!ec.isUnlocked) return { skip: 'locked' };
    ec.start();
    const entered = player.challenge.eternity.current;
    EternityChallenge(12).tryFail();
    const afterFail = player.challenge.eternity.current;
    return { entered, beforeFail: entered, afterFail };
  });
  if (r.skip) check("[C2] EC12（未解锁，跳过）", true, "未解锁");
  else check("[C2] 进入 EC12 后 tryFail() 不吞掉挑战状态", r.entered === 12 && r.afterFail === 12, JSON.stringify(r));
}

// ================================================= D. 未解锁挑战不得被绕过
console.log("\n=== D. 未解锁挑战不得即时完成 ===");
{
  const earlySave = pick("1._1e12AM");
  await loadSave(earlySave);
  const r = await page.evaluate(() => {
    const target = NormalChallenge(11);
    const unlocked = target.isUnlocked;
    const bitsBefore = player.challenge.normal.completedBits;
    let started = null;
    try { started = target.start(); } catch (e) { started = 'throw:' + e.message; }
    const current = player.challenge.normal.current;
    const res = OrekiInstantChallenge.tryComplete();
    return {
      unlocked, current,
      bitsSame: player.challenge.normal.completedBits === bitsBefore,
      completed: target.isCompleted,
      flagged: res && res.normal,
    };
  });
  check("[D] 早期存档进入未解锁 C11：未进入、未完成、位域不变",
    r.unlocked === false && r.current === 0 && r.bitsSame && r.completed === false,
    JSON.stringify(r));
}

// ============================================ E. 主循环真实接线（不是直接调函数）
console.log("\n=== E. 真实主循环接线 ===");
{
  await loadSave(lateSave);
  await resetChallengeProgress();
  const r = await page.evaluate(async () => {
    NormalChallenge(4).start();
    const entered = player.challenge.normal.current;
    try { GameIntervals.gameLoop.start(); } catch (e) { /* 已在跑就用现有的 */ }
    await new Promise(r => setTimeout(r, 400));
    try { GameIntervals.gameLoop.stop(); } catch (e) { /* ignore */ }
    return {
      entered,
      current: player.challenge.normal.current,
      completed: NormalChallenge(4).isCompleted,
    };
  });
  check("[E] 由 gameLoop 钩子自动完成（未手动调用 tryComplete）",
    r.entered === 4 && r.current === 0 && r.completed === true, JSON.stringify(r));
}

// ===================================================== F. 控制台无未捕获异常
check("[F] 页面无未捕获异常", errs.length === 0, errs.slice(0, 3).join(" | "));

await browser.close();
server.close();

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
if (failed.length) {
  console.log("FAILED:");
  failed.forEach(f => console.log(`  - ${f.n} ${f.d}`));
}
process.exit(failed.length ? 1 : 0);
