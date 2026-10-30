// 真实新档 → 首次 Eternity 全链实测（R19）
//
// 与既有 verify-id-to-eternity.mjs 的区别（关键）：
//   既有脚本**伪造** `player.records.thisInfinity.maxAM = 1.8e308` 作为起点，
//   用来验证「Break 之后的链条能不能走通」；
//   本脚本**不伪造任何状态**，从真正的空白新档开始，
//   唯一依赖的是生产代码里的 AD4（保留反物质）已经修好 canCrunch 死锁。
//
// 目标：证明「从零到首次 Eternity」的真实墙钟，
//      以及真实存在的第一处阻断点。
//
// 用法：node verify-real-newgame-to-eternity.mjs [项目目录] [端口] [总时长秒]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchBrowser, openGame } from "./lib/edge-launch.mjs";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8770);
const DURATION = Number(process.argv[4] || 600) * 1000;
const JSONL = process.env.OREKI_JSONL || "";

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon",
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(root, "." + p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const { browser, cleanup } = await launchBrowser({ port: Number(process.env.OREKI_EDGE_PORT || 9412) });
const { page, errors: errs } = await openGame(browser, { port });

// ── 全新存档：清掉 localStorage，确保是真正的新档 ──────────────
await page.evaluate(() => {
  try { localStorage.clear(); } catch (e) { /* ignore */ }
});
await page.reload({ waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 150; i++) {
  const ok = await page.evaluate(() => {
    try { return typeof player === "object" && typeof AntimatterDimension === "function"; }
    catch { return false; }
  }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

// ── 装自动化驱动（模拟玩家最优操作；不伪造任何数值状态）────────
const install = await page.evaluate(() => {
  try {
    const st = { upg: 0, ipMult: 0, interval: 0, idBuy: 0, idUnlock: 0, crunch: 0, breakCalls: 0, etCalls: 0, errs: [] };
    globalThis.__st = st;
    const step = () => {
      try {
        // 1) 维度 / 计数频率 / 维度提升 / 星系
        for (let t = 8; t >= 1; t--) {
          const d = AntimatterDimension(t);
          if (d.isAvailableForPurchase && d.isAffordable) { buyMaxDimension(t); st.upg++; }
        }
        try { if (typeof buyTickSpeed === "function") buyTickSpeed(); } catch (e) { /* ignore */ }
        try { if (DimBoost.canBeBought) requestDimensionBoost(1); } catch (e) { /* ignore */ }
        try { if (Galaxy.canBeBought) requestGalaxyReset(1); } catch (e) { /* ignore */ }

        // 2) 无限升级（真实购买：走 canBeBought/purchase）
        for (const u of InfinityUpgrade.all) {
          try { if (u.isAvailableForPurchase && u.canBeBought) { u.purchase(); st.upg++; } } catch (e) { /* ignore */ }
        }
        // 3) IP 倍率（成就 41 解锁后才可买）
        try { if (InfinityUpgrade.ipMult.canBeBought) { InfinityUpgrade.ipMult.buyMax(); st.ipMult++; } } catch (e) { /* ignore */ }

        // 4) 大坍缩自动器间隔升级 → Break（这是原版唯一的 UI 手点动作）
        try {
          const bc = Autobuyer.bigCrunch;
          while (!bc.hasMaxedInterval) {
            if (!bc.canBeUpgraded) break;
            const before = bc.interval;
            bc.upgradeInterval(false);
            if (bc.interval === before) break;
            st.interval++;
          }
          if (bc.hasMaxedInterval && !player.break) { breakInfinity(); st.breakCalls++; }
        } catch (e) { /* ignore */ }

        // 5) 无限维度：先 unlock 再 buyMax（游戏正常顺序）
        try {
          for (let t = 1; t <= 8; t++) {
            const d = InfinityDimension(t);
            if (!d.isUnlocked) { if (d.canUnlock) { d.unlock(); st.idUnlock++; } }
            else if (d.isAvailableForPurchase && d.isAffordable) { const b = d.amount; d.buyMax(); if (!b.eq(d.amount)) st.idBuy++; }
          }
        } catch (e) { /* ignore */ }

        // 6) Break 升级（AU6 已在生产代码里）
        try { for (const u of BreakInfinityUpgrade.all) { if (u.canBeBought) u.purchase(); } } catch (e) { /* ignore */ }

        // 7) 坍缩（走原版 bigCrunchReset）
        try {
          if (!player.break) {
            if (Player.canCrunch) { bigCrunchReset(); st.crunch++; }
          } else if (!player.auto.bigCrunch.isActive) {
            player.auto.bigCrunch.isActive = true;
          }
        } catch (e) { /* ignore */ }

        // 8) 永恒（真实调用）
        try {
          if (Player.canEternity) { eternity(false); st.etCalls++; }
        } catch (e) { if (st.errs.length < 6) st.errs.push(String(e && e.message || e)); }
      } catch (e) { if (st.errs.length < 6) st.errs.push(String(e && e.message || e)); }
    };
    setInterval(step, 10);
    setTimeout(step, 0);
    return null;
  } catch (e) { return String(e && e.message || e); }
});
if (install) { console.log("驱动安装失败:", install); await cleanup(); server.close(); process.exit(1); }

const T0 = Date.now();
const stages = {};
let printed = -1;
let done = false;
const samples = [];

while (Date.now() - T0 < DURATION) {
  const s = await page.evaluate(() => {
    const S = v => { try { return v === null || v === undefined ? null : v.toString(); } catch (e) { return null; } };
    const L = v => { const t = S(v); if (t === null) return null; const i = t.indexOf("e"); if (i >= 0) return Math.log10(Math.abs(Number(t.slice(0, i)))) + Number(t.slice(i + 1)); return Math.log10(Math.abs(Number(t)) || 1); };
    const st = globalThis.__st || {};
    const ids = [];
    for (let t = 1; t <= 8; t++) { try { const d = InfinityDimension(t); ids.push(d.isUnlocked ? 1 : 0); } catch (e) { ids.push(0); } }
    return {
      amL: L(Currency.antimatter.value),
      maxInfL: L(player.records.thisInfinity.maxAM),
      maxEtL: L(player.records.thisEternity.maxAM),
      ipL: L(player.infinityPoints),
      maxIPL: L(player.records.thisEternity.maxIP),
      inf: L(player.infinities), et: L(player.eternities),
      brk: player.break, canCrunch: Player.canCrunch,
      upg: player.infinityUpgrades.size,
      ipMult: player.IPMultPurchases,
      bcInterval: player.auto.bigCrunch.interval,
      ids, id1u: ids[0] === 1,
      canEt: Player.canEternity,
      goalL: L(Player.eternityGoal),
      mult: L(GameCache.totalIPMult.value),
      st: { upg: st.upg, ipMult: st.ipMult, interval: st.interval, idBuy: st.idBuy, idUnlock: st.idUnlock, crunch: st.crunch, etCalls: st.etCalls, errs: st.errs },
    };
  }).catch(e => ({ err: String(e && e.message || e) }));
  if (s.err) { await new Promise(r => setTimeout(r, 1000)); continue; }

  const t = +((Date.now() - T0) / 1000).toFixed(0);
  const mark = (k, c) => { if (c && stages[k] === undefined) { stages[k] = t; console.log(`  ★ ${k} @ ${t}s`); } };
  mark("首次无限", s.inf >= 1);
  mark("16个无限升级", s.upg >= 16);
  mark("间隔拉满", s.bcInterval <= 100);
  mark("Break", s.brk === true);
  mark("ID1解锁", s.id1u === true);
  mark("canEternity", s.canEt === true);
  mark("首次永恒", s.et >= 1);
  if (s.et >= 1) done = true;

  if (t % 15 === 0 && t !== printed) {
    printed = t;
    console.log(`t=${String(t).padStart(4)}s am=1e${String(s.amL).slice(0, 7)} maxEt=1e${String(s.maxEtL).slice(0, 7)} IP=1e${String(s.ipL).slice(0, 7)} maxIP=1e${String(s.maxIPL).slice(0, 7)} inf=${s.inf} 升级=${s.upg} ipMult=${s.ipMult} 间隔=${s.bcInterval} 坍缩=${s.st.crunch} brk=${s.brk} ID=[${s.ids.join("")}] canEt=${s.canEt} mult=1e${String(s.mult).slice(0, 6)}`);
  }
  if (JSONL) {
    try {
      fs.appendFileSync(JSONL, JSON.stringify({
        t, amL: s.amL, maxEtL: s.maxEtL, ipL: s.ipL, maxIPL: s.maxIPL, inf: s.inf, et: s.et,
        brk: s.brk, upg: s.upg, ipMult: s.ipMult, bcInterval: s.bcInterval, ids: s.ids,
        canEt: s.canEt, crunch: s.st.crunch, etCalls: s.st.etCalls, mult: s.mult,
      }) + "\n");
    } catch (e) { /* ignore */ }
  }
  samples.push({ t, ...s });
  if (done) break;
  await new Promise(r => setTimeout(r, 1000));
}

const fin = await page.evaluate(() => globalThis.__st).catch(() => null);
console.log(`\n===== 结果（${Math.round((Date.now() - T0) / 1000)}s）=====`);
console.log(`里程碑: ${JSON.stringify(stages)}`);
console.log(`驱动统计: ${JSON.stringify(fin)}`);
const last = samples[samples.length - 1];
if (last) {
  console.log(`末态: IP=1e${String(last.ipL).slice(0, 7)} maxIP=1e${String(last.maxIPL).slice(0, 7)} maxEt=1e${String(last.maxEtL).slice(0, 7)} inf=${last.inf} 升级=${last.upg} ipMult=${last.ipMult} 间隔=${last.bcInterval} brk=${last.brk} ID=[${last.ids.join("")}] canEt=${last.canEt} 永恒=${last.et}`);
  console.log(`永恒门槛=1e${String(last.goalL).slice(0, 7)}  totalIPMult=1e${String(last.mult).slice(0, 6)}`);
}
if (errs.length) console.log(`页面异常=${errs.length}: ${errs.slice(0, 3).join(" | ")}`);
await cleanup();
server.close();
