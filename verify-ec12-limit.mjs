// EC12 限时语义 —— 浏览器回归（真实代码路径，不是重实现公式）
// 用法: node verify-ec12-limit.mjs [root] [port]
//
// 目的（R4 第五阶段）：
//   EC12 的「本次永恒用了多久」必须只依赖逐帧累加器 inGameTime，
//   不能依赖「原始时间 ÷ 当前倍率」。否则中途改倍率会把整段历史重算：
//     · 倍率调低 → 历史被放大 → 瞬间超时（误判失败）
//     · 倍率调高 → 历史被压缩 → 限时被无形放宽（该失败的不失败）
//
// 全部断言走真实实现：
//   EternityChallenge(12).isWithinRestriction / .tryFail() / .start()、真实 gameLoop。
//   本文件不复制 restriction 公式，只从 ec.config.restriction() 读。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition");
const port = Number(process.argv[3] || 8322);

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

const lateSave = pick("1123._Endgame");

async function loadSave(text) {
  return page.evaluate(async (t) => {
    try { GameIntervals.gameLoop.stop(); } catch (e) { /* 未启动时忽略 */ }
    try { GameIntervals.all.forEach(i => i.stop()); } catch (e) { /* ignore */ }
    GameStorage.offlineEnabled = false;
    const obj = GameSaveSerializer.deserialize(t);
    player = obj;
    player.options.retryChallenge = false;
    GameStorage.loadPlayerObject(player);
    // 存档里的 lastUpdate 是旧的：不刷新的话第一次 tick 会算出巨量 diff，
    // 把 thisEternity.time 冲掉，夹具就不成立了。
    player.lastUpdate = Date.now();
    // 关掉自动完成/自动永恒一类会自动改写挑战状态的机制，避免干扰夹具
    for (const k of Object.keys(player.auto || {})) {
      if (player.auto[k] && typeof player.auto[k] === "object" && "isActive" in player.auto[k]) {
        player.auto[k].isActive = false;
      }
    }
    return true;
  }, text);
}

// 夹具：进入 EC12（直接置状态，不触发真实 eternity 重置），指定倍率与时间记录
// 判定值在同一次 evaluate 内读出，避免两次调用之间被真实 tick 改变状态。
async function setupEC12({ inGameMs, timeMs, realMs, completions, factor }) {
  return page.evaluate((cfg) => {
    try { GameIntervals.all.forEach(i => i.stop()); } catch (e) { /* ignore */ }
    GameSpeed.set(cfg.factor);
    player.challenge.eternity.unlocked = 12;
    player.eternityChalls = {};
    if (cfg.completions > 0) player.eternityChalls.eterc12 = cfg.completions;
    player.challenge.eternity.current = 12;
    player.records.thisEternity.time = cfg.timeMs;
    player.records.thisEternity.inGameTime = cfg.inGameMs;
    player.records.thisEternity.realTime = cfg.realMs;
    const ec = EternityChallenge(12);
    return {
      running: ec.isRunning,
      within: ec.isWithinRestriction,
      completions: ec.completions,
      limitSeconds: ec.config.restriction(ec.completions),
      inGameSeconds: player.records.thisEternity.inGameTime / 1000,
      legacySeconds: (player.records.thisEternity.time / 1000) / getGlobalSpeedFactor(),
    };
  }, { inGameMs, timeMs, realMs, completions, factor });
}

// 只读判定，不触发失败
async function within() {
  return page.evaluate(() => EternityChallenge(12).isWithinRestriction);
}

async function currentEC() {
  return page.evaluate(() => player.challenge.eternity.current);
}

// 设置夹具 → 读判定 → 触发真实 tryFail，全部在同一次 evaluate 内完成
async function judgeAndFail({ inGameMs, timeMs, realMs, completions, factor }) {
  return page.evaluate((cfg) => {
    try { GameIntervals.all.forEach(i => i.stop()); } catch (e) { /* ignore */ }
    GameSpeed.set(cfg.factor);
    player.challenge.eternity.unlocked = 12;
    player.eternityChalls = {};
    if (cfg.completions > 0) player.eternityChalls.eterc12 = cfg.completions;
    player.challenge.eternity.current = 12;
    player.records.thisEternity.time = cfg.timeMs;
    player.records.thisEternity.inGameTime = cfg.inGameMs;
    player.records.thisEternity.realTime = cfg.realMs;
    const ec = EternityChallenge(12);
    const out = {
      running: ec.isRunning,
      within: ec.isWithinRestriction,
      limitSeconds: ec.config.restriction(ec.completions),
      inGameSeconds: cfg.inGameMs / 1000,
      legacySeconds: (cfg.timeMs / 1000) / getGlobalSpeedFactor(),
    };
    out.failed = ec.tryFail();
    out.current = player.challenge.eternity.current;
    return out;
  }, { inGameMs, timeMs, realMs, completions, factor });
}

// 触发真实 tryFail，返回是否失败、挑战是否已退出
async function tryFail() {
  return page.evaluate(() => {
    const failed = EternityChallenge(12).tryFail();
    return { failed, current: player.challenge.eternity.current };
  });
}

// =====================================================================
console.log("\n### A. 倍率恒定：限时判定与 F 无关（只看 inGameTime）");
for (const [label, factor, inGameMs] of [
  ["F=1", 1, 950], ["F=2", 2, 950], ["F=10000", 10000, 950],
]) {
  await loadSave(lateSave);
  const s = await setupEC12({ inGameMs, timeMs: inGameMs * factor, realMs: inGameMs, completions: 0, factor });
  check(`[A-${label}] 0.95 游戏秒 < 限时 ${s.limitSeconds}s → 不失败`,
    s.running === true && s.within === true,
    `原始时间=${inGameMs * factor}ms 累加器=${inGameMs}ms 旧口径=${s.legacySeconds}s ` +
    `running=${s.running} within=${s.within}`);
}

console.log("\n### B. 边界：越过限时立刻失败（同样与 F 无关）");
for (const [label, factor, inGameMs] of [
  ["F=1", 1, 1050], ["F=2", 2, 1050], ["F=10000", 10000, 1050],
]) {
  await loadSave(lateSave);
  const s = await judgeAndFail({ inGameMs, timeMs: inGameMs * factor, realMs: inGameMs, completions: 0, factor });
  check(`[B-${label}] 1.05 游戏秒 > 限时 ${s.limitSeconds}s → 判失败并退出`,
    s.within === false && s.failed === true && s.current === 0,
    `原始时间=${inGameMs * factor}ms 累加器=${inGameMs}ms failed=${s.failed} current=${s.current}`);
}

// =====================================================================
console.log("\n### C. 中途切换倍率：历史时间不得被重算");
{
  // C1：历史在 F=10000 下累积（原始时间 6,000,000ms），现在把倍率调回 F=1。
  //     旧口径 = 6,000,000/1000/1 = 6000 秒 ≫ 1 秒 → 会瞬间误判失败。
  //     新口径 = 累加器 0.6 秒 → 应当仍然存活。
  await loadSave(lateSave);
  const s = await judgeAndFail({ inGameMs: 600, timeMs: 6_000_000, realMs: 600, completions: 0, factor: 1 });
  check("[C1] 高倍率历史 + 调回 F=1：仍存活（旧口径会算成 6000 秒而误判）",
    s.within === true && s.failed === false && s.current === 12,
    `累加器=${s.inGameSeconds}s 旧口径=${s.legacySeconds}s 限时=${s.limitSeconds}s`);

  // C2：历史在 F=1 下累积（原始时间 1500ms = 真实超时），现在把倍率调到 F=10000。
  //     旧口径 = 1500/1000/10000 = 0.00015 秒 → 该失败却不失败（限时被无形放宽）。
  //     新口径 = 累加器 1.5 秒 > 1 秒 → 必须判失败。
  await loadSave(lateSave);
  const s2 = await judgeAndFail({ inGameMs: 1500, timeMs: 1500, realMs: 1500, completions: 0, factor: 10000 });
  check("[C2] 低倍率历史 + 调到 F=10000：仍判失败（旧口径会算成 0.00015 秒而漏判）",
    s2.within === false && s2.failed === true && s2.current === 0,
    `累加器=${s2.inGameSeconds}s 旧口径=${s2.legacySeconds}s 限时=${s2.limitSeconds}s`);
}

// =====================================================================
console.log("\n### D. 限时随完成次数收窄");
{
  await loadSave(lateSave);
  const s = await setupEC12({ inGameMs: 90, timeMs: 90, realMs: 90, completions: 5, factor: 1 });
  check("[D1] 已满完成（限时 0.1s）下 0.09 游戏秒 → 存活",
    Math.abs(s.limitSeconds - 0.1) < 1e-9 && s.within === true, `限时=${s.limitSeconds}s within=${s.within}`);

  await loadSave(lateSave);
  const s2 = await judgeAndFail({ inGameMs: 150, timeMs: 150, realMs: 150, completions: 5, factor: 1 });
  check("[D2] 已满完成（限时 0.1s）下 0.15 游戏秒 → 判失败",
    s2.within === false && s2.failed === true && s2.current === 0, `限时=${s2.limitSeconds}s`);
}

// =====================================================================
console.log("\n### E. 进入 EC12 后的第一帧：即时完成先结算，且该帧时间增量比例未被污染");
// 背景（R4 补充令）：EC12 现在「进入即完成」，所以游戏里不存在「进入后一直计时到超时」
// 这条路径 —— 真实帧一到就先结算完成，轮不到 tryFail。因此这里能验证的正确命题是：
//   · 该帧确实走了完成结算（current 归 0、completions 补满），而不是被判失败；
//   · 同一帧里「原始时间 / 累加器」的比值仍等于全局倍率，即完成结算没有污染时间记录。
// 限时口径本身由 A–D 用夹具直测（判定只读累加器）。
{
  await loadSave(lateSave);
  for (const factor of [1, 10000]) {
    const r = await page.evaluate((f) => {
      try { GameIntervals.all.forEach(i => i.stop()); } catch (e) { /* ignore */ }
      GameSpeed.set(f);
      player.challenge.eternity.unlocked = 12;
      player.eternityChalls = {};
      player.challenge.eternity.current = 12;
      player.records.thisEternity.time = 0;
      player.records.thisEternity.inGameTime = 0;
      player.records.thisEternity.realTime = 0;
      player.lastUpdate = Date.now();
      gameLoop(500);
      return {
        dTime: player.records.thisEternity.time,
        dIg: player.records.thisEternity.inGameTime,
        dReal: player.records.thisEternity.realTime,
        current: player.challenge.eternity.current,
        completions: EternityChallenge(12).completions,
      };
    }, factor);
    const ratio = r.dIg > 0 ? r.dTime / r.dIg : Infinity;
    const ratioOk = Math.abs(ratio / factor - 1) < 0.25;
    const completed = r.current === 0 && r.completions === 5;
    check(`[E-F=${factor}] 首帧完成结算（补满 5 次、未判失败），时间增量比例=${ratio.toFixed(0)}（应≈${factor}）`,
      ratioOk && completed,
      `原始=+${Math.round(r.dTime)}ms 累加器=+${r.dIg.toFixed(3)}ms 现实=+${Math.round(r.dReal)}ms ` +
      `current=${r.current} completions=${r.completions}`);
  }
}

// =====================================================================
console.log("\n### F. 进入即完成优先于限时判定（EC12 不得被抢先判失败）");
{
  await loadSave(lateSave);
  const r = await page.evaluate(async () => {
    GameSpeed.set(10000);
    player.challenge.eternity.unlocked = 12;
    player.eternityChalls = {};
    player.challenge.eternity.current = 12;
    // 已经远超限时的历史：单看限时判定必然失败
    player.records.thisEternity.time = 10_000_000;
    player.records.thisEternity.inGameTime = 10_000;
    player.records.thisEternity.realTime = 10_000;
    const overLimit = !EternityChallenge(12).isWithinRestriction;
    const ok = typeof OrekiInstantChallenge?.tryComplete === "function";
    // 走真实主循环：game.js 里即时完成排在 EternityChallenge(12).tryFail() 之前
    try { GameIntervals.gameLoop.start(); } catch (e) { /* 已在跑 */ }
    await new Promise(r => setTimeout(r, 500));
    try { GameIntervals.gameLoop.stop(); } catch (e) { /* ignore */ }
    return {
      overLimit, ok,
      current: player.challenge.eternity.current,
      completions: EternityChallenge(12).completions,
    };
  });
  check("[F] EC12 已超时但进入即完成先结算：完成 5 次、未被判失败",
    r.overLimit === true && r.ok === true && r.current === 0 && r.completions === 5,
    JSON.stringify(r));
}

// =====================================================================
check("[G] 页面无未捕获异常", errs.length === 0, errs.slice(0, 3).join(" | "));

await browser.close();
server.close();

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
if (failed.length) {
  console.log("FAILED:");
  failed.forEach(f => console.log(`  - ${f.n} ${f.d}`));
}
process.exit(failed.length ? 1 : 0);
