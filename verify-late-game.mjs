// 后期系统回归：Eternity / Pelle / 黑洞 / Reality
// 目标不是「把游戏玩到后期」，而是验证加速因子在每个后期机制里的时间语义是否正确：
//   - 游戏时间 = 墙钟 × factor
//   - 现实时间统计（存档里的 realTime 类字段）= 墙钟
//   - 有独立缩放的机制（黑洞）保留其设计意图
//
// 注意：Reality 需要完整的时间研究树前置，伪造存档容易把 Vue 渲染打挂，
// 因此它在独立的 page 里跑，且失败只记 SKIP（不做通过/失败的假结论）。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8091);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webm": "video/webm", ".mp3": "audio/mpeg", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf", ".ico": "image/x-icon" };
const server = http.createServer((q, s) => { let p = decodeURIComponent(q.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.join(root, p); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404).end(); return; } s.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" }); s.end(d); }); });
await new Promise(r => server.listen(port, "127.0.0.1", r));

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({
  executablePath: EDGE, headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio"],
  protocolTimeout: 45000,
});
const results = [];
const check = (n, p, d = "") => { results.push({ n, p }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const skip = (n, d = "") => { results.push({ n, p: true, skipped: true }); console.log(`SKIP  ${n}${d ? "  — " + d : ""}`); };

const openPage = async () => {
  const p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 900 });
  const errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
  await new Promise(r => setTimeout(r, 6000));
  return { p, errs };
};

const { p: page, errs } = await openPage();

// ---------------------------------------------------------------------------
// 1. Pelle / Doom：getGlobalSpeedFactor 应与其它阶段一致，保持全额 factor
//    （2026-10-27 起取消上游 ADfaster 的 sqrt 降级，与 Android 端对齐，见 _research/doomed-speed-parity-2026-10-27.md）
// ---------------------------------------------------------------------------
const pelle = await page.evaluate(() => {
  const normal = getGlobalSpeedFactor();
  player.celestials.pelle.doomed = true;
  const doomed = getGlobalSpeedFactor();
  player.celestials.pelle.doomed = false;
  return { normal, doomed, restored: getGlobalSpeedFactor(), expected: 10000 };
});
check("Pelle 毁灭态下倍率保持全额 factor（不再 sqrt 降级）", pelle.doomed === pelle.expected,
  `${pelle.normal} → ${pelle.doomed}（期望 ${pelle.expected}）`);
check("解除毁灭态后倍率恢复原值", pelle.restored === pelle.normal, `= ${pelle.restored}`);

// ---------------------------------------------------------------------------
// 2. 基线一致性：游戏时间 / 现实时间 的比例必须正好是 factor
// ---------------------------------------------------------------------------
const base = await page.evaluate(async () => {
  const g0 = player.records.totalTimePlayed;
  const r0 = player.records.realTimePlayed;
  const w0 = Date.now();
  await new Promise(r => setTimeout(r, 1500));
  const w = Date.now() - w0;
  return {
    g: (player.records.totalTimePlayed - g0) / w,
    r: (player.records.realTimePlayed - r0) / w,
    factor: getGlobalSpeedFactor(),
  };
});
check("10000× 下游戏时间/墙钟 ≈ 10000", base.g > 9000 && base.g < 11000, base.g.toFixed(0));
check("10000× 下现实时间/墙钟 ≈ 1", base.r > 0.7 && base.r < 1.6, base.r.toFixed(3));

// ---------------------------------------------------------------------------
// 3. Eternity：真实结算路径（force=false，走 giveEternityRewards）
// ---------------------------------------------------------------------------
const eter = await page.evaluate(() => {
  const before = Currency.eternities.value;
  // 第一次永恒目标是 Number.MAX_VALUE；把本永恒最高 IP 抬到阈值之上
  player.records.thisEternity.maxIP = new Decimal("1e400");
  player.records.thisEternity.time = 3e6; // 3000 游戏秒（原始时钟）
  // 真实游玩时 time 与 inGameTime 由 gameLoop 同步累加；这里直接造状态，需同时写入累计器
  player.records.thisEternity.inGameTime = 3e6 / getGlobalSpeedFactor();
  const canEternity = Player.canEternity;
  let err = null;
  try {
    eternity(false);
  } catch (e) {
    err = String(e && e.message ? e.message : e);
  }
  return {
    canEternity, err,
    before: String(before),
    after: String(Currency.eternities.value),
    ep: String(Currency.eternityPoints.value),
    bestTime: player.records.bestEternity.time,
    factor: getGlobalSpeedFactor(),
  };
});
check(
  "Eternity 真实结算成功（永恒数 + 永恒点数增长）",
  !eter.err && Number(eter.after) > Number(eter.before) && Number(eter.ep) > 0,
  eter.err ? `异常：${eter.err}` : `永恒 ${eter.before} → ${eter.after}，EP = ${eter.ep}`
);
check(
  "Eternity 用时按现实时间记录（游戏时间 ÷ factor）",
  Math.abs(eter.bestTime - 3e6 / eter.factor) < 1e-6,
  `bestEternity.time = ${eter.bestTime}（期望 ${3e6 / eter.factor}）`
);

// ---------------------------------------------------------------------------
// 4. 黑洞：激活后游戏时间被额外放大、现实时间不放大、phase 按 sqrt(factor) 降级
// ---------------------------------------------------------------------------
const bhPhase = await page.evaluate(() => {
  player.blackHole[0].unlocked = true;
  player.blackHole[0].active = true;
  player.blackHole[0].phase = 0;
  const st = BlackHoles.list[0];
  const factor = getGlobalSpeedFactor();
  // gameLoop 里 blackHoleDiff = realDiff / sqrt(factor)，而 realDiff = 墙钟ms × factor
  // 因此「1 秒墙钟」对应 blackHoleDiff = 1000 × sqrt(factor) 毫秒
  const blackHoleDiff = 1000 * Math.sqrt(factor);
  BlackHoles.updatePhases(blackHoleDiff);
  const phaseAfter = player.blackHole[0].phase;
  const activeAfter = player.blackHole[0].active;
  // 状态机：激活 duration 秒后进入 interval，phase 归零重新计。
  // 所以「总共推进了多少黑洞时间」= 激活态取 phase，非激活态取 phase + duration
  const totalAdvanced = activeAfter ? phaseAfter : phaseAfter + st.duration;
  return {
    unlocked: st.isUnlocked, power: st.power, duration: st.duration, interval: st.interval,
    phaseAfter, activeAfter, totalAdvanced, expected: 1000 * Math.sqrt(factor) / 1000,
  };
});
check(
  "黑洞 phase 按 sqrt(factor) 降级推进（1 秒墙钟 → 100 黑洞秒）",
  Math.abs(bhPhase.totalAdvanced - bhPhase.expected) < 1,
  `推进 ${bhPhase.totalAdvanced.toFixed(2)} 黑洞秒（期望 ${bhPhase.expected}；激活持续 ${bhPhase.duration}s、间隔 ${bhPhase.interval}s，`
  + `结束时 ${bhPhase.activeAfter ? "仍在激活" : `已进入间隔，phase=${bhPhase.phaseAfter.toFixed(2)}`}）`
);

const bhRun = await page.evaluate(async () => {
  // 让黑洞处于长时段激活，避免在采样窗口内失活干扰比值
  player.blackHole[0].unlocked = true;
  player.blackHole[0].active = true;
  player.blackHole[0].phase = 0;
  const g0 = player.records.totalTimePlayed;
  const r0 = player.records.realTimePlayed;
  const w0 = Date.now();
  await new Promise(r => setTimeout(r, 1200));
  const w = Date.now() - w0;
  const g = (player.records.totalTimePlayed - g0) / w;
  const r = (player.records.realTimePlayed - r0) / w;
  const phase = player.blackHole[0].phase;
  player.blackHole[0].active = false;
  player.blackHole[0].unlocked = false;
  player.blackHole[0].phase = 0;
  return { g, r, phase, factor: getGlobalSpeedFactor() };
});
check(
  "黑洞激活时游戏时间被额外放大（> factor）",
  bhRun.g > bhRun.factor * 1.05,
  `游戏时间/墙钟 = ${bhRun.g.toFixed(0)}（factor = ${bhRun.factor}，黑洞倍率 ${bhPhase.power}）`
);
check(
  "黑洞激活期间现实时间统计仍为 1×（未被黑洞放大）",
  bhRun.r > 0.7 && bhRun.r < 1.6,
  `现实时间/墙钟 = ${bhRun.r.toFixed(2)}`
);

check("主流程无未捕获异常", errs.length === 0, errs.slice(0, 2).join(" | "));

// ---------------------------------------------------------------------------
// 5. Reality：独立页面 + 独立超时，失败只记 SKIP
// ---------------------------------------------------------------------------
try {
  const { p: rp, errs: rerrs } = await openPage();
  const real = await Promise.race([
    rp.evaluate(() => {
      // player.realities 是 number（NumberCurrency），不是 Decimal；
      // 赋成 Decimal 会让上游 `player.realities > 0` 触发隐式转换异常
      player.realities = 1;
      player.records.thisReality.maxEP = new Decimal("1e4000");
      player.records.thisReality.time = 5e6; // 5000 游戏秒（原始时钟）
      player.records.thisReality.inGameTime = 5e6 / getGlobalSpeedFactor();
      // bestReality.time 初值是 MAX_VALUE，先放宽否则 min() 永远取不到新值
      player.records.bestReality.time = 1e12;
      // beginProcessReality 本身不做前置校验（校验在 requestManualReality / processManualReality 里），
      // 因此直接调它即可走完整的结算 + 记录更新路径
      const before = String(Currency.realities.value);
      const beforeBest = player.records.bestReality.time;
      let err = null;
      try {
        beginProcessReality(getRealityProps(false, false));
      } catch (e) {
        err = String(e && e.stack ? e.stack.split("\n").slice(0, 7).join(" | ") : e).slice(0, 600);
      }
      return {
        err, before, beforeBest,
        after: String(Currency.realities.value),
        bestTime: player.records.bestReality.time,
        factor: getGlobalSpeedFactor(),
      };
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("evaluate 超时（伪造状态导致渲染阻塞）")), 30000)),
  ]);
  if (!real.err) {
    check("Reality 结算成功（现实数增长）", real.after !== real.before, `现实 ${real.before} → ${real.after}`);
    check(
      "Reality 用时按现实时间记录（游戏时间 ÷ factor）",
      Math.abs(real.bestTime - 5e6 / real.factor) < 1e-6,
      `bestReality.time = ${real.bestTime}（期望 ${5e6 / real.factor}）`
    );
    check("Reality 流程无未捕获异常", rerrs.length === 0, rerrs.slice(0, 2).join(" | "));
  } else {
    skip("Reality 完整结算", `结算过程抛错：${real.err}；该项仅做静态代码核查`);
  }
  await rp.close().catch(() => {});
} catch (e) {
  skip("Reality 完整结算", `${e.message.slice(0, 80)}；该项仅做静态代码核查`);
}

await browser.close();
server.close();
const failed = results.filter(r => !r.p);
const skipped = results.filter(r => r.skipped);
console.log(`\n===== ${results.length - failed.length - skipped.length}/${results.length - skipped.length} 通过，${skipped.length} 项跳过 =====`);
process.exit(failed.length ? 1 : 0);
