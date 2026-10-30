// Pelle 閲嶈喘鍗囩骇銆孲hift 涔版弧銆嶉獙璇佹帰閽?
//
// 鐩殑锛?
//   1. 绛変环鎬э細鍚屼竴鐘舵€佷笅 `purchaseMax()` 涓庛€岃繛缁?purchase() 鐩村埌涔颁笉鍔ㄣ€嶇粨鏋滃畬鍏ㄤ竴鑷?
//      锛堢瓑绾с€佸墿浣欑幇瀹炵鐗囬兘鐩稿悓锛夆€斺€旇瘉鏄庡彧鏄妸 N 娆＄偣鍑诲悎骞讹紝娌℃湁鏀瑰彉璇箟銆?
//   2. 涓婇檺瀹夊叏锛氫笉浼氳秴杩?config.cap锛涗拱婊″悗鍐嶆瑙﹀彂杩斿洖 0锛堜笉浼氶噸澶?瓒婄晫璐拱锛夈€?
//   3. 鏀剁泭锛氱粺璁℃瘡娆°€屼拱婊°€嶇渷涓嬬殑鐐瑰嚮娆℃暟銆?
//   4. UI 鎺ョ嚎锛氭ā鏉跨偣鍑昏蛋 purchaseUpgrade锛孲hift 涓庨潪 Shift 琛屼负涓嶅悓銆?
//
// 鐢ㄦ硶锛歯ode verify-pelle-buymax.mjs [--boost=1e60]
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
    // 閫愭璐拱锛岀洿鍒颁拱涓嶅姩锛堟ā鎷熺帺瀹剁媯鐐癸級
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
    // 涓€娆′拱婊?
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
    // 妯℃澘鎺ョ嚎妫€鏌ワ細鐩存帴 import 鐪熷疄缁勪欢鏂囦欢锛屾鏌ユ柟娉曞瓨鍦ㄤ笖妯℃澘鎺ヤ簡璇ユ柟娉?
    async wiring() {
      const mod = await import("/src/components/tabs/celestial-pelle/PelleUpgrade.js");
      const cmp = mod.default;
      window.__cmp = cmp;
      return {
        hasHandler: Boolean(cmp && cmp.methods && typeof cmp.methods.purchaseUpgrade === "function"),
        templateUsesHandler: Boolean(cmp && /@click="purchaseUpgrade"/.test(cmp.template)),
      };
    },
    // 琛屼负楠岃瘉锛氱敤鐪熷疄缁勪欢鏂规硶妯℃嫙 shift / 闈?shift 鐐瑰嚮
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
if (!info.doomed) errs.push(`瀛樻。 ${SAVE} 鏈浜庢瘉鐏姸鎬侊紝娴嬭瘯鏃犳剰涔塦);
if (!info.hasPurchaseMax) errs.push("PelleUpgrade 閲嶈喘椤圭己灏?purchaseMax 鏂规硶");

const wiring = await page.evaluate(() => window.__b.wiring());
if (!wiring.hasHandler) errs.push("PelleUpgrade 缂哄皯 purchaseUpgrade 鏂规硶");
if (!wiring.templateUsesHandler) errs.push("PelleUpgrade 妯℃澘鏈妸鐐瑰嚮鎺ュ埌 purchaseUpgrade");

const baseState = await page.evaluate(() => window.__b.snap());
const ids = ["antimatterDimensionMult", "timeSpeedMult", "glyphLevels", "infConversion", "galaxyPower"];

const rows = [];
for (const loop of ["鍘熷纰庣墖", "娉ㄥ叆澶ч纰庣墖"]) {
  if (loop === "娉ㄥ叆澶ч纰庣墖") {
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
    if (!sameBought) errs.push(`${loop}/${id}: 绛夌骇涓嶄竴鑷?single=${single.bought} max=${max.afterBought}`);
    if (!sameRs) errs.push(`${loop}/${id}: 鍓╀綑纰庣墖涓嶄竴鑷?single=${single.rs} max=${max.rs}`);
    if (max.afterBought > max.cap) errs.push(`${loop}/${id}: 瓒呰繃涓婇檺 ${max.afterBought} > ${max.cap}`);
    if (max.again !== 0) errs.push(`${loop}/${id}: 涔版弧鍚庡啀娆¤Е鍙戜粛璐拱浜?${max.again} 绾);
    if (max.bought > 0 && !single.capped) errs.push(`${loop}/${id}: 鍗曚拱寰幆鏈埌涓婇檺锛屽彲鑳藉惊鐜鎴柇`);

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

// 琛屼负楠岃瘉锛氳蛋鐪熷疄缁勪欢鏂规硶锛屾瘮杈?shift / 闈?shift 鐐瑰嚮
const CLICK_ID = "timeSpeedMult";
await page.evaluate(() => window.__b.boost("1e80"));
const plainState = await page.evaluate(() => window.__b.snap());
const plainClick = await page.evaluate(i => window.__b.clickBehavior(i, false), CLICK_ID);
await page.evaluate(s => window.__b.restore(s), plainState);
const shiftClick = await page.evaluate(i => window.__b.clickBehavior(i, true), CLICK_ID);
await page.evaluate(s => window.__b.restore(s), baseState);

if (plainClick.delta !== 1) errs.push(`鏅€氱偣鍑诲簲鍙拱 1 绾э紝瀹為檯 ${plainClick.delta}`);
if (shiftClick.delta <= 1) errs.push(`Shift 鐐瑰嚮搴斾拱澶氱骇锛屽疄闄?${shiftClick.delta}`);
if (shiftClick.delta !== plainClick.delta && plainClick.delta === 1 && shiftClick.delta === 0) {
  errs.push("Shift 鐐瑰嚮鏈敓鏁?);
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
  console.log(`[${r.loop}] ${r.id.padEnd(24)} ${String(r.before).padStart(3)} 鉃?${String(r.after).padStart(3)} (cap ${r.cap})` +
    ` 鍗曚拱鐐瑰嚮=${String(r.clicksBefore).padStart(3)} 涔版弧鐐瑰嚮=${r.clicksAfter} 鐪?${r.saved}` +
    ` 绛変环=${r.sameBought && r.sameRs}`);
}
console.log(`\n鎬昏妭鐪佺偣鍑伙細${totalSaved}`);
console.log(`妯℃澘鎺ョ嚎锛歨andler=${wiring.hasHandler} template=${wiring.templateUsesHandler}`);
console.log(`鐐瑰嚮琛屼负锛氭櫘閫?${plainClick.delta} 绾э紝Shift=${shiftClick.delta} 绾э紙${CLICK_ID}锛塦);
console.log(errs.length ? `\n閿欒 ${errs.length} 鏉★細\n- ${errs.join("\n- ")}` : "\n鏃犻敊璇?);
console.log(`\n鏁版嵁宸插啓鍏?${OUT}`);

await browser.close();
server.close();
process.exit(errs.length ? 1 : 0);
