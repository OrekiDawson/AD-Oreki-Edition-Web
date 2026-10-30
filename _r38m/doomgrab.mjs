// R38-M · 并行观察器：挂在长跑浏览器的 CDP 上，
//   ① 一进入毁灭现实（Pelle.isDoomed）立刻把存档抓下来存成检查点，后续验证不必再等 10 分钟；
//   ② 同时把 pamE / ad1 / 反物质指数写到独立 jsonl，不受主脚本 900 s 上限限制。
//
// 只读 + 一次 `GameStorage.save(true,false)`（就是把当前进度落盘，不推进游戏）。
//
// 用法： node _r38m/doomgrab.mjs [持续时间秒]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TAG = process.env.OREKI_TAG || `doomgrab-${Date.now()}`;
const SECONDS = Number(process.argv[2] || 1200);
const PORT = process.env.OREKI_CDP_PORT || "9352";
const CP = path.join(HERE, "cp-doomed.txt");
const JSONL = path.join(HERE, `${TAG}.jsonl`);

const b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null });
const pages = await b.pages();
const page = pages.find(p => p.url().includes("index.html"));
if (!page) {
  console.log("[grab] 没找到游戏页面，退出");
  await b.disconnect();
  process.exit(1);
}
console.log("[grab] attached", page.url());

let saved = false;
const t0 = Date.now();
while (Date.now() - t0 < SECONDS * 1000) {
  const s = await page.evaluate(() => {
    const g = (fn, d = null) => { try { return fn(); } catch (e) { return d; } };
    return {
      t: Math.round((Date.now() - (window.__r38mT0 || (window.__r38mT0 = Date.now()))) / 100) / 10,
      realities: g(() => Math.round(player.realities), 0),
      doomed: g(() => player.celestials.pelle.doomed === true, false),
      pamE: g(() => Number(player.celestials.pelle.records.totalAntimatter.exponent), 0),
      pamL: g(() => Number(player.celestials.pelle.records.totalAntimatter.plus(1).log10()), 0),
      amE: g(() => Number(player.antimatter.exponent), 0),
      ad1L: g(() => Number(AntimatterDimension(1).amount.log10()), 0),
      endState: g(() => Number(GameEnd.endState.toFixed(4)), 0),
      gameEnd: g(() => player.isGameEnd === true, false),
      crunchL: g(() => Number(Currency.infinitiesTotal.value.log10()), 0),
      bcActive: g(() => Autobuyer.bigCrunch.isActive, null),
      etActive: g(() => Autobuyer.eternity.isActive, null),
      resetsOff: g(() => globalThis.OrekiEndgameAutomation?._doomResetsOff, null),
      idol: g(() => globalThis.OrekiEndgameAutomation?.step, null),
    };
  }).catch(e => ({ err: String(e && e.message) }));

  try { fs.appendFileSync(JSONL, JSON.stringify(s) + "\n"); } catch (e) { /* ignore */ }

  if (s.doomed && !saved) {
    const raw = await page.evaluate(() => {
      try { GameStorage.save(true, false); return localStorage.getItem("dimensionSave"); }
      catch (e) { return null; }
    }).catch(() => null);
    if (raw) {
      fs.writeFileSync(CP, raw);
      saved = true;
      console.log(`[grab] 已保存毁灭态检查点 ${CP} (${raw.length} bytes) pamE=${s.pamE}`);
    }
  }
  if (s.doomed) {
    console.log(`pamE=${s.pamE} endState=${s.endState} amE=${s.amE} ad1L=${Math.round(s.ad1L)} ` +
      `crunchL=${Math.round(s.crunchL)} bc=${s.bcActive} et=${s.etActive} resetsOff=${s.resetsOff} gameEnd=${s.gameEnd}`);
  }
  if (s.gameEnd) { console.log("[grab] isGameEnd 已置位"); break; }
  await new Promise(r => setTimeout(r, 2000));
}
await b.disconnect();
console.log("[grab] done, jsonl =", JSONL);
