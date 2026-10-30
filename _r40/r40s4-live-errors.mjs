// [R40-S4] 线上 pageErrors 归因：跑 140 s，只数 pageerror 与 404 请求，不做任何快照。
// 目的：把 r40s4-live-full 里那条 "Unexpected token '<'" 的**次数与来源 URL** 钉死。
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const SEC = Number(process.argv[2]) || 140;
const { browser, cleanup } = await launchBrowser({ port: 9396 });
const { page, errors } = await openGame(browser, { url: "https://oreki.net", port: 443, waitMs: 90000 });

const failed = [];
page.on("requestfailed", r => failed.push(`${r.failure()?.errorText || "?"} ${r.url()}`));
const notFound = [];
page.on("response", r => { if (r.status() === 404) notFound.push(r.url()); });

await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
await page.reload({ waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, SEC * 1000));

const counts = {};
for (const e of errors) { const k = e.split("\n")[0].slice(0, 160); counts[k] = (counts[k] || 0) + 1; }
console.log(JSON.stringify({
  seconds: SEC,
  pageErrorCount: errors.length,
  pageErrorKinds: counts,
  notFoundCount: notFound.length,
  notFoundUrls: [...new Set(notFound)],
  failedCount: failed.length,
  failedSample: failed.slice(0, 5),
}, null, 1));
await cleanup();
process.exit(0);
