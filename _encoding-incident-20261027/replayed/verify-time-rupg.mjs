// 时间语义（二）：RUPG22 / RUPG23 / EU6 / IU 的时间输入现状快照
//
// ⚠️ 状态说明（2026-10-26 第三轮）：
//   用户已把项目最高目标改为「最大化缩短现实通关时间」并**暂缓** Q1/Q2（RUPG22、EU6）修复。
//   生产代码已回滚到基线 470d0e8，本脚本因此改为**现状快照**：
//   断言的目标不是「与官方一致」，而是「精确知道现在用的是什么口径、放大多少倍」，
//   以便评估「保留放大 = 有效加速」还是「需要重新设计」。
//
// 预期值一律由本脚本**独立计算**（只用官方公式 + 自己设定的输入），
// 不调用生产代码里的 inGameTimeOf / totalInGameTimeMs 来算期望值。
//
// 用法: node verify-time-rupg.mjs [root] [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "C:/Users/Oreki/WorkBuddy/2026-10-24-00-34-44/AD-Oreki-Edition");
const port = Number(process.argv[3] || 8220);

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

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({
  executablePath: EDGE, headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio"],
});
const results = [];
const notes = [];
const check = (n, p, d = "") => { results.push({ n, p, d }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const note = (n, d = "") => { notes.push({ n, d }); console.log(`NOTE  ${n}${d ? "  — " + d : ""}`); };
const rel = (a, b) => Math.abs(a - b) / Math.max(1, Math.abs(b));

// —— 独立参考实现（照抄官方公式，不引用生产代码）——
const MS_PER_DAY = 86400000;                       // 与 TimeSpan.totalDays = _ms / 864e5 同式
const official22 = days => Math.pow(10, Math.pow(1 + 2 * Math.log10(days + 1), 1.6));
const eu6Normal = days => Math.max(days, 1);
const eu6Doomed = days => 1 + days;

const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(e.message));
await page.setViewport({ width: 1200, height: 800 });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 6500));

await page.evaluate(() => {
  try { GameIntervals.all.forEach(i => i.stop()); } catch (e) { /* ignore */ }
  window.__r = {
    current22() { return RealityUpgrade(22).effectValue.toNumber(); },
    rupg23Effect() { return Number(RealityUpgrade(23).effectValue); },
    eu6() { const v = EternityUpgrade.tdMultRealTime.effectValue; return v && v.toNumber ? v.toNumber() : Number(v); },
    // 直接摆状态：time / realTime / inGameTime 三者都显式给出
    setReality(realMs, F) {
      player.records.thisReality.realTime = realMs;
      player.records.thisReality.time = realMs * F;
      player.records.thisReality.inGameTime = realMs;
    },
    setTotal(realMs, F) {
      player.records.totalTimePlayed = realMs * F;
      player.records.totalInGameTime = realMs;
    },
    // 只读原始字段（不经 inGameTimeOf）
    rawInGameMs() { return player.records.thisReality.inGameTime; },
    rawTimeMs() { return player.records.thisReality.time; },
    bestReality(ms) { player.records.bestReality.time = ms; },
    gateNow() { return Time.thisReality.totalMinutes / getGlobalSpeedFactor() < 15; },
    gateOfficialEquiv() { return player.records.thisReality.inGameTime / 60000 < 15; },
    setF(v) { GameSpeed.set(v); },
    F() { return getGlobalSpeedFactor(); },
    doomed(v) { player.celestials.pelle.doomed = v; },
    runFrame(d = 1) { gameLoop(d); },
  };
});

console.log("\n环境: 全新开局，已停掉所有 interval，手动控帧");
console.log("口径: 现状快照（Q1/Q2 已按用户要求暂缓，代码回滚到 470d0e8）\n");

// ================= A. RUPG22 现状 =================
console.log("=== A. RUPG22「超越时光」：现状输入 = records.thisReality.time（未剥 F）===");
const FS = [1, 2, 137, 10000];
const REAL_SECS = [600, 3600];
const rupg22 = await page.evaluate(({ fs, secs }) => {
  const r = window.__r;
  const out = [];
  for (const F of fs) {
    for (const s of secs) {
      r.setF(F);
      r.setReality(s * 1000, F);
      out.push({ F, eff: r.F(), realMs: s * 1000, current: r.current22() });
    }
  }
  return out;
}, { fs: FS, secs: REAL_SECS });

console.log("    F  实际F  现实(分钟)   现状 effect    官方口径(真实天数)  现状/官方");
const rowsA = rupg22.map(x => {
  const realDays = x.realMs / MS_PER_DAY;
  return {
    ...x, realDays,
    official: official22(realDays),                      // 官方在 F=1 等价口径
    scaledByF: official22(x.realMs * x.eff / MS_PER_DAY), // 现状应当等于这个
    doubleDiv: official22(x.realMs / x.eff / MS_PER_DAY),
    msAsDays: official22(x.realMs),
  };
});
for (const x of rowsA) {
  console.log(`  ${String(x.F).padStart(5)} ${String(x.eff).padStart(6)}  ${String(x.realMs / 60000).padStart(9)}  ${x.current.toExponential(4).padStart(13)}  ${x.official.toExponential(4).padStart(18)}  ${(x.current / x.official).toExponential(3)}`);
}

check("[A1] F=1 时现状 = 官方公式(真实天数)（F=1 无放大，这是原版锚点）",
  rel(rowsA.filter(x => x.F === 1)[0].current, rowsA.filter(x => x.F === 1)[0].official) < 1e-9);
check("[A2] 任意 F 下现状 = 官方公式(F × 真实天数) —— 精确刻画「输入被 F 放大」",
  rowsA.every(x => rel(x.current, x.scaledByF) < 1e-9),
  rowsA.map(x => `F${x.F}:${rel(x.current, x.scaledByF).toExponential(1)}`).join(" "));
check("[A3] 放大方向正确：F 越大 effect 越大（单调不减）",
  [600, 3600].every(s => {
    const g = rowsA.filter(x => x.realMs === s * 1000).map(x => x.current);
    return g.every((v, i) => i === 0 || v >= g[i - 1] - 1e-9);
  }));
check("[A4] 不是「重复除 F」：现状 ≠ 官方公式(天数/F)",
  rowsA.filter(x => x.F > 1).every(x => rel(x.current, x.doubleDiv) > 1e-6));
check("[A5] 不是「天/毫秒混淆」：现状 ≠ 官方公式(毫秒当天数)",
  rowsA.every(x => rel(x.current, x.msAsDays) > 1e-6));
note(`[A-结论] RUPG22 现状 = 时间维度倍率读「含 F 的游戏时间」，实际放大 ${(rowsA.find(x => x.F === 10000 && x.realMs === 600000).current / rowsA.find(x => x.F === 10000 && x.realMs === 600000).official).toExponential(2)} 倍（F=10000、现实 10 分钟）`);

// ================= B. RUPG23（未改，等价）=================
console.log("\n=== B. RUPG23「快速复现」：门槛与效果（与官方等价，未受影响）===");
const rupg23 = await page.evaluate((fs) => {
  const r = window.__r;
  const out = [];
  for (const F of fs) {
    for (const realMin of [5, 10, 14.9, 15.1, 20]) {
      r.setF(F);
      r.setReality(realMin * 60000, F);
      r.bestReality(realMin * 60000);
      out.push({ F, realMin, gateNow: r.gateNow(), gateOff: r.gateOfficialEquiv(), effect: r.rupg23Effect() });
    }
  }
  return out;
}, FS);
let gateAllEqual = true;
for (const x of rupg23) if (x.gateNow !== x.gateOff) gateAllEqual = false;
check(`[B1] RUPG23 门槛在 F=${FS.join("/")} 下与官方判定一致（${rupg23.length} 组）`, gateAllEqual);
check("[B2] RUPG23 效果只依赖 bestReality（已归一化），与 F 无关",
  [5, 10, 14.9, 15.1, 20].every(m => {
    const g = rupg23.filter(x => x.realMin === m).map(x => x.effect);
    return g.every(v => rel(v, g[0]) < 1e-12);
  }));
check("[B3] 效果符合官方 15/clamp(minutes, 1/12, 15)",
  rupg23.every(x => rel(x.effect, 15 / Math.min(Math.max(x.realMin, 1 / 12), 15)) < 1e-9));

// ================= C. 旧存档 / 历史倍率 =================
console.log("\n=== C. 旧存档初始化与历史倍率变化 ===");
const legacy = await page.evaluate(() => {
  const r = window.__r;
  const out = {};
  r.setF(10000);
  r.setReality(600000, 10000);
  player.records.thisReality.inGameTime = 0;
  r.runFrame(1);
  out.sameFactor = { inGameMs: r.rawInGameMs(), timeMs: r.rawTimeMs(), effect: r.current22() };
  r.setF(10000);
  r.setReality(600000, 100);
  player.records.thisReality.inGameTime = 0;
  r.runFrame(1);
  out.historyFactor = { inGameMs: r.rawInGameMs(), timeMs: r.rawTimeMs(), effect: r.current22() };
  r.setF(1);
  r.setReality(600000, 1);
  r.runFrame(1);
  const base = r.current22();
  r.setF(10000);
  r.runFrame(1);
  out.midSwitch = { effectRatio: r.current22() / base };
  r.setF(1);
  return out;
});
console.log("  C1:", JSON.stringify(legacy.sameFactor));
console.log("  C2:", JSON.stringify(legacy.historyFactor));
console.log("  C3:", JSON.stringify(legacy.midSwitch));
check("[C1] 旧存档首帧补齐后 inGameTime = time/F（历史恒定假设成立）",
  rel(legacy.sameFactor.inGameMs, 600000) < 1e-3, String(legacy.sameFactor.inGameMs));
check("[C2] 历史倍率≠当前倍率时 inGameTime 基准缩小（此处 100 倍）——已知近似",
  Math.abs(legacy.historyFactor.inGameMs / 600000 - 0.01) < 5e-4,
  `ratio=${(legacy.historyFactor.inGameMs / 600000).toFixed(6)}`);
check("[C3] 中途改倍率不重算历史（1ms 墙钟内 effect 变化 < 0.1%）",
  legacy.midSwitch.effectRatio < 1.001 && legacy.midSwitch.effectRatio > 0.999,
  legacy.midSwitch.effectRatio.toFixed(6));
check("[C4] 现状 effect 由原始 time 决定（与 inGameTime 的补齐偏差无关）",
  rel(legacy.historyFactor.effect, official22(legacy.historyFactor.timeMs / MS_PER_DAY)) < 1e-6,
  `${legacy.historyFactor.effect.toFixed(4)} vs ${official22(legacy.historyFactor.timeMs / MS_PER_DAY).toFixed(4)}`);
note("[C-含义] 旧存档的「基准近似」只影响 inGameTime（统计与本次未启用的修复），不污染 RUPG22 现状收益");

// ================= D. EU6 现状（两分支）=================
console.log("\n=== D. EU6「tdMultRealTime」：非末日 / 末日两分支现状 ===");
const REAL_MS_EU = 2 * MS_PER_DAY;
const eu6 = await page.evaluate(({ fs, realMs }) => {
  const r = window.__r;
  const out = [];
  for (const F of fs) {
    r.setF(F);
    r.doomed(false);
    r.setTotal(realMs, F);
    out.push({ F, branch: "normal", eff: r.F(), current: r.eu6() });
    r.doomed(true);
    const eff = r.F();
    r.setReality(realMs, eff);
    out.push({ F, branch: "doomed", eff, current: r.eu6() });
    r.doomed(false);
  }
  r.setF(1);
  r.doomed(false);
  r.setTotal(60000, 1);
  out.push({ F: 1, branch: "normal", eff: 1, current: r.eu6(), floor: true });
  r.setF(1);
  return out;
}, { fs: FS, realMs: REAL_MS_EU });

const realDaysEU = REAL_MS_EU / MS_PER_DAY;
const rowsD = eu6.map(x => {
  const official = x.floor ? 1 : (x.branch === "normal" ? eu6Normal(realDaysEU) : eu6Doomed(realDaysEU));
  const scaledByEff = x.branch === "normal" ? eu6Normal(realDaysEU * x.eff) : eu6Doomed(realDaysEU * x.eff);
  const doubleDiv = x.branch === "normal" ? eu6Normal(realDaysEU / x.eff) : eu6Doomed(realDaysEU / x.eff);
  const msAsDays = x.branch === "normal" ? eu6Normal(REAL_MS_EU) : eu6Doomed(REAL_MS_EU);
  return { ...x, official, scaledByEff, doubleDiv, msAsDays };
});
console.log("    F  实际F  分支      现状 effect   官方口径   现状/官方   重复除F值");
for (const x of rowsD) {
  console.log(`  ${String(x.F).padStart(5)} ${String(x.eff).padStart(6)}  ${(x.floor ? "normal*" : x.branch).padEnd(8)} ${x.current.toExponential(4).padStart(11)} ${x.official.toExponential(3).padStart(9)}  ${(x.current / x.official).toExponential(3).padStart(9)}  ${x.doubleDiv.toExponential(3).padStart(9)}`);
}
const realRows = rowsD.filter(x => !x.floor);
check("[D1] 非末日分支现状 = max(真实天数 × F, 1)（被 F 线性放大）",
  realRows.filter(x => x.branch === "normal").every(x => rel(x.current, x.scaledByEff) < 1e-9),
  realRows.filter(x => x.branch === "normal").map(x => `F${x.F}:${x.current}`).join(" "));
check("[D2] 末日分支现状 = 1 + 真实天数 × 实际F（实际F 在末日是 √F）",
  realRows.filter(x => x.branch === "doomed").every(x => rel(x.current, x.scaledByEff) < 1e-9),
  realRows.filter(x => x.branch === "doomed").map(x => `F${x.F}:${x.current.toFixed(3)}`).join(" "));
check("[D3] 末日分支保留 +1 结构（不会退化成非末日公式）",
  realRows.filter(x => x.branch === "doomed").every(x => rel(x.current, eu6Normal(realDaysEU)) > 1e-6));
check("[D4] 两支都不是「重复除 F」",
  realRows.filter(x => x.F > 1).every(x => rel(x.current, x.doubleDiv) > 1e-6));
check("[D5] 两支都不是「天/毫秒混淆」",
  realRows.every(x => rel(x.current, x.msAsDays) > 1e-6));
check("[D6] 非末日的 max(...,1) 下限仍保留：现实 1 分钟 → 1×",
  rel(rowsD.find(x => x.floor).current, 1) < 1e-9);
note("[D-结论] EU6 现状把 √F ~ F 乘进时间维度倍率；F=10000 时非末日 20000×、末日 201×（官方分别 2× 与 3×）");

// ================= E. IU19 / IU202 现状 =================
console.log("\n=== E. IU19 / IU202 现状（同样读未剥 F 的时间）===");
const iu = await page.evaluate(() => {
  const r = window.__r;
  const num = v => (v && typeof v.toNumber === "function") ? v.toNumber() : Number(v);
  const out = [];
  for (const F of [1, 2, 137, 10000]) {
    r.setF(F);
    player.records.totalTimePlayed = 60 * 60000 * F;
    player.records.thisInfinity.time = 3 * 60000 * F;
    player.records.thisInfinity.inGameTime = 3 * 60000;
    out.push({
      F: r.F(),
      totalTimeMult: num(InfinityUpgrade.totalTimeMult.effectValue),
      thisInfinityTimeMult: num(InfinityUpgrade.thisInfinityTimeMult.effectValue),
    });
  }
  r.setF(1);
  return out;
});
for (const x of iu) {
  console.log(`  F=${String(x.F).padStart(6)}: totalTimeMult=${x.totalTimeMult.toFixed(4)}×  thisInfinityTimeMult=${x.thisInfinityTimeMult.toFixed(4)}×`);
}
const iuTotalRef = Math.pow(60 / 2, 0.15);
const iuInfRef = Math.max(Math.pow(3 / 4, 0.25), 1);
check("[E1] IU19 totalTimeMult = (现实分钟 × F / 2)^0.15（现状：被幂次放大）",
  iu.every(x => rel(x.totalTimeMult, Math.pow(60 * x.F / 2, 0.15)) < 1e-9),
  iu.map(x => `F${x.F}:${(x.totalTimeMult / iuTotalRef).toFixed(2)}×`).join(" "));
check("[E2] IU202 thisInfinityTimeMult = max((现实分钟 × F / 4)^0.25, 1)（现状：被幂次放大）",
  iu.every(x => rel(x.thisInfinityTimeMult, Math.max(Math.pow(3 * x.F / 4, 0.25), 1)) < 1e-9),
  iu.map(x => `F${x.F}:${(x.thisInfinityTimeMult / iuInfRef).toFixed(2)}×`).join(" "));
note("[E-结论] IU 的放大是幂次型（0.15 / 0.25），F=10000 时分别 3.98× / 9.31×，是真实生产倍率而非显示值");

check("[F] 全流程无未捕获脚本异常", errs.length === 0, errs.slice(0, 3).join(" | "));

const pass = results.filter(r => r.p).length;
console.log(`\n==== 结果: ${pass} 通过 / ${results.length - pass} 失败 / ${notes.length} 条结论 ====`);
await browser.close();
server.close();
process.exit(pass === results.length ? 0 : 1);
