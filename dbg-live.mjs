// 线上启动诊断：抓全部控制台输出与失败请求
import fs from "node:fs";
import puppeteer from "puppeteer-core";

const URL = process.argv[2] ?? "https://orekidawson.github.io/";
const WAIT = Number(process.argv[3] ?? 30000);
const EDGE = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find(p => fs.existsSync(p));

const browser = await puppeteer.launch({
  executablePath: EDGE, headless: "new",
  args: ["--no-sandbox", "--proxy-server=http://127.0.0.1:7897", "--proxy-bypass-list=127.0.0.1;localhost", "--ignore-certificate-errors"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

page.on("console", m => {
  const t = m.type();
  if (t === "error" || t === "warning") console.log(`[console.${t}]`, m.text().slice(0, 300));
});
page.on("pageerror", e => console.log("[pageerror]", String(e.message).slice(0, 300)));
page.on("requestfailed", r => console.log("[reqfail]", r.url().slice(0, 120), "::", r.failure()?.errorText));
page.on("response", r => { if (r.status() >= 400) console.log("[http", r.status() + "]", r.url().slice(0, 120)); });

const t0 = Date.now();
await page.goto(URL, { waitUntil: "load", timeout: 120000 });
console.log(`\nload 完成，耗时 ${Date.now() - t0}ms`);

// 轮询等待 player 出现
let ok = false;
for (let i = 1; i <= Math.ceil(WAIT / 3000); i++) {
  await new Promise(r => setTimeout(r, 3000));
  const st = await page.evaluate(() => ({
    hasPlayer: typeof window.player !== "undefined",
    hasGameSpeed: typeof window.getGlobalSpeedFactor === "function",
    uiLen: (document.getElementById("ui")?.innerText ?? "").length,
    loadingDisplay: getComputedStyle(document.getElementById("loading") ?? document.body).display,
    errs: (window.errorMessages ?? []).slice(0, 5),
  }));
  console.log(`+${i * 3}s  player=${st.hasPlayer} speedFn=${st.hasGameSpeed} uiTextLen=${st.uiLen} loading=${st.loadingDisplay}`);
  if (st.errs.length) console.log("   页面内错误:", st.errs.join(" | ").slice(0, 300));
  if (st.hasPlayer) { ok = true; break; }
}

if (ok) {
  const info = await page.evaluate(() => ({
    factor: getGlobalSpeedFactor(),
    version: player.version,
    am: String(player.antimatter),
    ui: (document.getElementById("ui")?.innerText ?? "").slice(0, 180),
  }));
  console.log("\n=== 启动成功 ===");
  console.log("factor =", info.factor, "| version =", info.version, "| am =", info.am);
  console.log("界面文本:", JSON.stringify(info.ui.slice(0, 120)));
} else {
  console.log("\n=== 启动失败：player 始终未定义 ===");
  const html = await page.content();
  fs.writeFileSync("../_research/live-dom-fail.html", html);
  console.log("DOM 已保存，长度", html.length);
}

await browser.close();
