// Pelle 重购升级「Shift 买满」验证探针
//
// 目的：
//   1. 等价性：同一状态下 `purchaseMax()` 与「连续 purchase() 直到买不动」结果完全一致
//      （等级、剩余现实碎片都相同）——证明只是把 N 次点击合并，没有改变语义。
//   2. 上限安全：不会超过 config.cap；买满后再次触发返回 0（不会重复/越界购买）。
//   3. 收益：统计每次「买满」省下的点击次数。
//   4. UI 接线：模板点击走 purchaseUpgrade，Shift 与非 Shift 行为不同。
//
// 用法：node verify-pelle-buymax.mjs [--boost=1e60]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const ROOT = process.env.OREKI_ROOT || "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition";
const SAVE_DIR = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_saves/samples";
const OUT = "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_research/pelle-buymax-2026-10-27.json";
const SAVE = "1105._6.7e11DT+Cel7+3.9e44RS.txt";

const argStr = (k, d) => {
  const h = process.argv.find(a => a.startsWith(`--${k}=`));
  return h ? h.split("=")[1] : d;
};
const BOOST = argStr("boost", "");

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon"
};

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
await new Promise(r => server.listen(8494, "127.0.0.1", r));

const browser = await launchViaConnect({ protocolTimeout: 300000 });
const page = await browser.newPage();
const errs = [];
const NOISE = /googletagmanager|google-analytics|kaspersky-labs|Vue warn|progress\.info/;
page.on("pageerror", e => errs.push(`PAGEERR: ${e.message}`));
page.on("console", m => {
  if (m.type() === "error" && !NOISE.test(m.text())) errs.push(`CONSOLE: ${m.text().slice(0, 160)}`);
});
await page.goto("http://127.0.0.1:8494/index.html", { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 80; i++) {
  const ok = await page.evaluate(() => {
    try { return typeof GameSpeed === "object" && typeof Pelle === "object"; } catch (e) { return false; }
  }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

await page.evaluate(() => {
  const clone = o => JSON.parse(JSON.stringify(o));
  window.__b = {
    setup(text) {
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      player = GameSaveSerializer.deserialize(text);
      player.lastUpdate = Date.now();
      GameStorage.loadPlayerObject(player);
      player.lastUpdate = Date.now();
      try { GameIntervals.stop(); } catch (e) { /* ignore */ }
      const walk = o => {
        for (const k of Object.keys(o)) {
          const v = o[k];
          if (v && typeof v === "object") {
            if ("isActive" in v) v.isActive = false;
            walk(v);
          }
        }
      };
      walk(player.auto);
      player.auto.autobuyersOn = false;
      try { AutomatorBackend.stop(); } catch (e) { /* ignore */ }
      return {
        doomed: Boolean(Pelle.isDoomed),
        rs: String(Currency.realityShards.value),
        rebuyables: clone(player.celestials.pelle.rebuyables),
        hasPurchaseMax: typeof PelleUpgrade.antimatterDimensionMult.purchaseMax === "function",
      };
    },
    boost(rs) {
      player.celestials.pelle.realityShards = new Decimal(rs);
      return String(Currency.realityShards.value);
    },
    snap() {
      return {
        rs: player.celestials.pelle.realityShards.toString(),
        rebuyables: clone(player.celestials.pelle.rebuyables),
      };
    },
    restore(s) {
      player.celestials.pelle.realityShards = new Decimal(s.rs);
      for (const k of Object.keys(s.rebuyables)) player.celestials.pelle.rebuyables[k] = s.rebuyables[k];
      return String(Currency.realityShards.value);
    },
    // 逐次购买，直到买不动（模拟玩家狂点）
    single(id, limit = 2000) {
      const u = PelleUpgrade.all.find(x => x.id === id);
      let clicks = 0;
      while (u.canBeBought && clicks < limit) {
        u.purchase();
        clicks++;
      }
      return {
        clicks,
        bought: u.boughtAmount,
        rs: String(Currency.realityShards.value),
        capped: u.isCapped,
        cap: u.config.cap,
      };
    },
    // 一次买满
    max(id) {
      const u = PelleUpgrade.all.find(x => x.id === id);
      const beforeBought = u.boughtAmount;
      const beforeRs = String(Currency.realityShards.value);
      const bought = u.purchaseMax();
      const again = u.purchaseMax();
      return {
        bought,
        again,
        beforeBought,
        afterBought: u.boughtAmount,
        beforeRs,
        rs: String(Currency.realityShards.value),
        capped: u.isCapped,
        cap: u.config.cap,
      };
    },
    // 模板接线检查：直接 import 真实组件文件，检查方法存在且模板接了该方法
    async wiring() {
      const mod = await import("/src/components/tabs/celestial-pelle/PelleUpgrade.js");
      const cmp = mod.default;
      window.__cmp = cmp;
      return {
        hasHandler: Boolean(cmp && cmp.methods && typeof cmp.methods.purchaseUpgrade === "function"),
        templateUsesHandler: Boolean(cmp && /@click="purchaseUpgrade"/.test(cmp.template)),
      };
    },
    // 行为验证：用真实组件方法模拟 shift / 非 shift 点击
    clickBehavior(id, shift) {
      const u = PelleUpgrade.all.find(x => x.id === id);
      const before = u.boughtAmount;
      const fakeThis = { faded: false, upgrade: u };
      window.__cmp.methods.purchaseUpgrade.call(fakeThis, { shiftKey: shift });
      return { before, after: u.boughtAmount, delta: u.boughtAmount - before };
    },
  };
});

const text = fs.readFileSync(path.join(SAVE_DIR, SAVE), "utf-8");
const info = await page.evaluate(t => window.__b.setup(t), text);
if (!info.doomed) errs.push(`存档 ${SAVE} 未处于毁灭状态，测试无意义`);
if (!info.hasPurchaseMax) errs.push("PelleUpgrade 重购项缺少 purchaseMax 方法");

const wiring = await page.evaluate(() => window.__b.wiring());
if (!wiring.hasHandler) errs.push("PelleUpgrade 缺少 purchaseUpgrade 方法");
if (!wiring.templateUsesHandler) errs.push("PelleUpgrade 模板未把点击接到 purchaseUpgrade");

const baseState = await page.evaluate(() => window.__b.snap());
const ids = ["antimatterDimensionMult", "timeSpeedMult", "glyphLevels", "infConversion", "galaxyPower"];

const rows = [];
for (const loop of ["原始碎片", "注入大额碎片"]) {
  if (loop === "注入大额碎片") {
    if (!BOOST) continue;
    await page.evaluate(r => window.__b.boost(r), BOOST);
  }
  for (const id of ids) {
    const state = await page.evaluate(() => window.__b.snap());
    const single = await page.evaluate(i => window.__b.single(i), id);
    await page.evaluate(s => window.__b.restore(s), state);
    const max = await page.evaluate(i => window.__b.max(i), id);
    await page.evaluate(s => window.__b.restore(s), state);

    const sameBought = single.bought === max.afterBought;
    const sameRs = single.rs === max.rs;
    if (!sameBought) errs.push(`${loop}/${id}: 等级不一致 single=${single.bought} max=${max.afterBought}`);
    if (!sameRs) errs.push(`${loop}/${id}: 剩余碎片不一致 single=${single.rs} max=${max.rs}`);
    if (max.afterBought > max.cap) errs.push(`${loop}/${id}: 超过上限 ${max.afterBought} > ${max.cap}`);
    if (max.again !== 0) errs.push(`${loop}/${id}: 买满后再次触发仍购买了 ${max.again} 级`);
    if (max.bought > 0 && !single.capped) errs.push(`${loop}/${id}: 单买循环未到上限，可能循环被截断`);

    rows.push({
      loop, id,
      cap: single.cap,
      before: max.beforeBought,
      after: max.afterBought,
      clicksBefore: single.clicks,
      clicksAfter: max.bought > 0 ? 1 : 0,
      saved: Math.max(0, single.clicks - (max.bought > 0 ? 1 : 0)),
      sameBought, sameRs,
      rsBefore: max.beforeRs.slice(0, 10),
      rsAfter: max.rs.slice(0, 10),
    });
  }
}
await page.evaluate(s => window.__b.restore(s), baseState);

// 行为验证：走真实组件方法，比较 shift / 非 shift 点击
const CLICK_ID = "timeSpeedMult";
await page.evaluate(() => window.__b.boost("1e80"));
const plainState = await page.evaluate(() => window.__b.snap());
const plainClick = await page.evaluate(i => window.__b.clickBehavior(i, false), CLICK_ID);
await page.evaluate(s => window.__b.restore(s), plainState);
const shiftClick = await page.evaluate(i => window.__b.clickBehavior(i, true), CLICK_ID);
await page.evaluate(s => window.__b.restore(s), baseState);

if (plainClick.delta !== 1) errs.push(`普通点击应只买 1 级，实际 ${plainClick.delta}`);
if (shiftClick.delta <= 1) errs.push(`Shift 点击应买多级，实际 ${shiftClick.delta}`);
if (shiftClick.delta !== plainClick.delta && plainClick.delta === 1 && shiftClick.delta === 0) {
  errs.push("Shift 点击未生效");
}

const totalSaved = rows.reduce((a, r) => a + r.saved, 0);
const report = {
  generatedAt: new Date().toISOString(),
  root: ROOT,
  save: SAVE,
  boost: BOOST || null,
  wiring,
  clickBehavior: { id: CLICK_ID, plain: plainClick, shift: shiftClick },
  rows,
  totalClicksSaved: totalSaved,
  errors: errs,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 1), "utf-8");

for (const r of rows) {
  console.log(`[${r.loop}] ${r.id.padEnd(24)} ${String(r.before).padStart(3)} ➜ ${String(r.after).padStart(3)} (cap ${r.cap})` +
    ` 单买点击=${String(r.clicksBefore).padStart(3)} 买满点击=${r.clicksAfter} 省=${r.saved}` +
    ` 等价=${r.sameBought && r.sameRs}`);
}
console.log(`\n总节省点击：${totalSaved}`);
console.log(`模板接线：handler=${wiring.hasHandler} template=${wiring.templateUsesHandler}`);
console.log(errs.length ? `\n错误 ${errs.length} 条：\n- ${errs.join("\n- ")}` : "\n无错误");
console.log(`\n数据已写入 ${OUT}`);

await browser.close();
server.close();
process.exit(errs.length ? 1 : 0);
