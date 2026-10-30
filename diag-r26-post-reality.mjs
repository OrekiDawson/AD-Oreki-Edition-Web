// 诊断：首次 Reality 之后为什么反物质爬不过 1e270（ID1 需要 1e1100）
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchBrowser, openGame } from "./lib/edge-launch.mjs";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8793);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };
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
const { browser, cleanup } = await launchBrowser({ port: Number(process.env.OREKI_EDGE_PORT || 9424) });
const { page, errors: errs } = await openGame(browser, { port });
await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
await page.reload({ waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 150; i++) {
  const ok = await page.evaluate(() => { try { return typeof player === "object"; } catch { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

const t0 = Date.now();
let realityAt = null;
while (Date.now() - t0 < 200000 && realityAt === null) {
  const rl = await page.evaluate(() => { try { return player.realities; } catch { return 0; } });
  if (rl > 0) realityAt = Math.floor((Date.now() - t0) / 1000);
  else await new Promise(r => setTimeout(r, 1000));
}
console.log(`首次现实 @ ${realityAt}s`);

for (let i = 0; i < 22; i++) {
  const s = await page.evaluate(() => {
    const out = {};
    const t = (k, f) => { try { out[k] = f(); } catch (e) { out[k] = "ERR:" + e.message; } };
    const L = v => { try { const s2 = v.toString(); const i2 = s2.indexOf("e"); return i2 < 0 ? +(+s2).toFixed(3) : +(+s2.slice(0, i2)).toFixed(3) + "e" + s2.slice(i2 + 1); } catch (e) { return "?"; } };
    t("amL", () => L(Currency.antimatter.value));
    t("maxEtL", () => L(player.records.thisEternity.maxAM));
    t("db", () => player.dimensionBoosts);
    t("gal", () => player.galaxies);
    t("tsL", () => L(Tickspeed.current));
    t("tdTotal", () => L(Currency.timeShards.value));
    t("ipL", () => L(Currency.infinityPoints.value));
    t("ipUpg", () => player.infinityUpgrades.size);
    t("ipMultBuy", () => player.IPMultPurchases);
    t("brk", () => player.break);
    t("id1u", () => InfinityDimension(1).isUnlocked);
    t("id1req", () => L(InfinityDimension(1).amRequirement));
    t("id1reach", () => InfinityDimension(1).antimatterRequirementReached);
    t("etUnl", () => PlayerProgress.eternityUnlocked());
    t("dimCan", () => DimBoost.canBeBought);
    t("dimReq", () => L(DimBoost.requirement));
    t("galCan", () => Galaxy.canBeBought);
    t("galReq", () => L(Galaxy.requirement));
    t("routine", () => { const r = tryOrekiEarlyRoutine(); return String(r); });
    t("early", () => JSON.stringify(tryOrekiEarlyAutomation()));
    t("autoOn", () => player.auto.autobuyersOn);
    t("adAut", () => player.auto.dimensions.isActive);
    t("adtiers", () => { const a = []; for (let i = 1; i <= 8; i++) a.push(AntimatterDimension(i).bought); return a.join(""); });
    t("ad8tot", () => L(AntimatterDimension(8).totalAmount));
    t("speed", () => +getGameSpeedupFactor().toFixed(1));
    t("adCost8", () => L(AntimatterDimension(8).cost));
    t("et", () => player.eternities.toString().slice(0, 8));
    t("realities", () => player.realities);
    return out;
  }).catch(e => ({ err: String(e).slice(0, 120) }));
  console.log(`+${i * 2}s ${JSON.stringify(s)}`);
  await new Promise(r => setTimeout(r, 2000));
}
console.log("页面异常数:", errs.length, errs.slice(0, 5));
await cleanup();
server.close();
process.exit(0);
