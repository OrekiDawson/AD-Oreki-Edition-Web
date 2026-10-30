// R38 线上冒烟：直接打开线上站点，确认模块图加载完整、无 console error
// 用法： node _r38m/livesmoke.mjs [url]
import { launchBrowser } from "../lib/edge-launch.mjs";

const URL = process.argv[2] || "https://oreki.net/";
const { browser, cleanup } = await launchBrowser({ port: 9367, headless: true, extraArgs: ["--ignore-certificate-errors", "--allow-insecure-localhost"] });
const page = await browser.newPage();
try { await page.setViewport({ width: 1280, height: 900 }); } catch { /* ignore */ }
const errors = [];
page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
page.on("pageerror", e => errors.push("pageerror: " + String(e.message).slice(0, 200)));
page.on("requestfailed", r => errors.push("reqfail: " + r.url().slice(-90) + " " + (r.failure()?.errorText || "")));

const t0 = Date.now();
await page.goto(URL, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 9000));

const info = await page.evaluate(() => {
  const out = { title: document.title, gameLoaded: false, antimatterText: null, err: null };
  try {
    out.gameLoaded = typeof window.GameUI !== "undefined";
    const el = document.querySelector(".c-antimatter-amount, #antimatter, .o-antimatter");
    out.antimatterText = el ? el.textContent.trim().slice(0, 40) : null;
  } catch (e) { out.err = String(e.message); }
  return out;
}).catch(e => ({ err: String(e.message) }));

console.log(JSON.stringify({
  url: URL, loadMs: Date.now() - t0, info,
  errorCount: errors.length, errors: errors.slice(0, 8),
}, null, 2));
await cleanup();
process.exit(errors.length === 0 && info.gameLoaded ? 0 : 1);
