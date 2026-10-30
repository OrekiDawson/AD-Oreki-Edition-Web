// 探针 v2：直接在浏览器里复算 Eternity 门槛的每一项（不修改状态）。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8710);

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(root, "." + p);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404).end(); return; } res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" }); res.end(d); });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"],
});
const page = await browser.newPage();
page.on("pageerror", e => console.log("PAGEERROR:", e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 100; i++) {
  const ok = await page.evaluate(() => { try { return typeof player === "object"; } catch { return false; } }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

// 分段执行，避免一次 evaluate 里任何隐式 number 转换
const steps = {
  goal: () => ({ v: Player.eternityGoal.toString() }),
  reqEP: () => ({ v: requiredIPForEP(1).toString() }),
  logRaw: () => ({ v: String(Decimal.log(1, 5)) }),
  logType: () => ({ v: typeof Decimal.log(1, 5) }),
  divRaw: () => ({ v: Decimal.divide(1, 1).toString() }),
  cursedEP: () => ({ v: getAdjustedGlyphEffect("cursedEP").toString() }),
  shopEP: () => ({ v: ShopPurchase.EPPurchases.currentMult.toString() }),
  epMultUpgrade: () => ({ v: EternityUpgrade.epMult.effectOrDefault(1).toString() }),
  glyphEP: () => ({ v: GlyphEffect.epMult.toString() }),
  ts61: () => ({ v: TimeStudy(61).effectOrDefault(1).toString() }),
  ts122: () => ({ v: TimeStudy(122).effectOrDefault(1).toString() }),
  ts121: () => ({ v: TimeStudy(121).effectOrDefault(1).toString() }),
  ts123: () => ({ v: TimeStudy(123).effectOrDefault(1).toString() }),
  ru12: () => ({ v: RealityUpgrade(12).effectOrDefault(1).toString() }),
};
const out = {};
for (const [k, fn] of Object.entries(steps)) {
  try { out[k] = await page.evaluate(fn); } catch (e) { out[k] = { err: String(e && e.message || e) }; }
}

// 手算：分步算 totalEPMult，每步单独 evaluate，避免混合类型
const manual = await page.evaluate(() => {
  const st = {};
  try {
    const m1 = getAdjustedGlyphEffect("cursedEP").times(ShopPurchase.EPPurchases.currentMult);
    st.m1 = m1.toString();
    const m2 = m1.timesEffectsOf(EternityUpgrade.epMult, TimeStudy(61), TimeStudy(122), TimeStudy(121), TimeStudy(123), RealityUpgrade(12), GlyphEffect.epMult);
    st.m2 = m2.toString();
    const div = Decimal.divide(1, m2);
    st.div = div.toString();
    const lg = Decimal.log(div, 5);
    st.lg = String(lg);
    st.lgType = typeof lg;
    const expo = 308 * (lg + 0.7);
    st.expo = String(expo);
    const p = Decimal.pow10(expo);
    st.pow10 = p.toString();
    const clamped = p.clampMin(Number.MAX_VALUE);
    st.clamped = clamped.toString();
    st.clampedL = String(Math.log10(Number(clamped.toString())));
  } catch (e) { st.err = String(e && e.message || e); }
  return st;
});
console.log(JSON.stringify({ out, manual }, null, 2));
await browser.close();
server.close();
