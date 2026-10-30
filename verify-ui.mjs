// 设置界面 UI 验收
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8092);
const outDir = path.resolve(process.argv[4] || "./shots");
fs.mkdirSync(outDir, { recursive: true });

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
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio", "--autoplay-policy=no-user-gesture-required"],
});
const results = [];
const check = (n, p, d = "") => { results.push({ n, p, d }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };

const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(e.message));
await page.setViewport({ width: 1280, height: 900 });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));

// 解锁并切到 选项 → 游戏玩法
await page.evaluate(() => {
  player.antimatter = new Decimal("1e100");
  player.records.totalAntimatter = new Decimal("1e100");
  GameUI.update();
  const opt = Tabs.all.find(t => t.config.key === "options");
  if (opt) {
    opt.show();
    const sub = opt.subtabs.find(s => s.key === "gameplay");
    if (sub) sub.show();
  }
});
await new Promise(r => setTimeout(r, 1500));

const text = await page.evaluate(() => document.body.innerText);
check("游戏玩法页出现「游戏速度」区块", text.includes("游戏速度：×"), text.match(/游戏速度：×[^\n]*/)?.[0] || "");
check("显示默认倍率 10000", text.includes("游戏速度：×10000"));
check("显示范围提示", text.includes("1× ~ 100000×"));
check("提供快捷倍率按钮", ["×1", "×10", "×100", "×1000", "×10000", "×100000"].every(x => text.includes(x)));
check("提供恢复默认按钮", text.includes("恢复默认"));
check("提供自定义输入框", await page.evaluate(() => !!document.querySelector(".c-oreki-speed__field")));

await page.screenshot({ path: path.join(outDir, "options-desktop.png"), fullPage: false });

// 点击 ×1000 预设
const clicked = await page.evaluate(() => {
  const btns = [...document.querySelectorAll(".c-oreki-speed__preset")];
  const target = btns.find(b => b.textContent.trim() === "×1000");
  if (!target) return false;
  target.click();
  return true;
});
await new Promise(r => setTimeout(r, 800));
const afterPreset = await page.evaluate(() => ({ factor: getGlobalSpeedFactor(), stored: localStorage.getItem("oreki-game-speed") }));
check("点击 ×1000 立即生效并写入本地存储", clicked && afterPreset.factor === 1000 && afterPreset.stored === "1000",
  `factor=${afterPreset.factor} stored=${afterPreset.stored}`);

// 输入非法值
const invalid = await page.evaluate(() => {
  const input = document.querySelector(".c-oreki-speed__field");
  input.value = "-1";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  const applyBtn = [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "应用倍率");
  applyBtn.click();
  return { factor: getGlobalSpeedFactor() };
});
await new Promise(r => setTimeout(r, 500));
check("输入 -1 被拒绝，倍率保持 1000", invalid.factor === 1000, `factor=${invalid.factor}`);

// 合法自定义值
await page.evaluate(() => {
  const input = document.querySelector(".c-oreki-speed__field");
  input.value = "12345";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "应用倍率").click();
});
await new Promise(r => setTimeout(r, 500));
const custom = await page.evaluate(() => getGlobalSpeedFactor());
check("自定义 12345 生效", custom === 12345, `factor=${custom}`);

// 窄屏：必须用新的 page（改变 isMobile 会导致页面重载，丢失状态）
const mobile = await browser.newPage();
await mobile.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await mobile.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));
const openGameplay = pg => pg.evaluate(() => {
  player.antimatter = new Decimal("1e100");
  player.records.totalAntimatter = new Decimal("1e100");
  GameUI.update();
  const opt = Tabs.all.find(t => t.config.key === "options");
  if (opt) {
    opt.show();
    const sub = opt.subtabs.find(s => s.key === "gameplay");
    if (sub) sub.show();
  }
});
await openGameplay(mobile);
await new Promise(r => setTimeout(r, 1200));
await mobile.screenshot({ path: path.join(outDir, "options-mobile.png") });
// 上游为固定桌面布局且未声明 viewport：手机浏览器按 980px 布局宽度渲染后整体缩放，
// 因此这里验证「无横向溢出 + 控件尺寸可点」，堆叠规则另用 700px 桌面窗口验证
const m1 = await mobile.evaluate(() => {
  const el = document.querySelector(".c-oreki-speed__preset");
  return {
    vw: window.innerWidth,
    docW: document.documentElement.scrollWidth,
    hasBlock: !!document.querySelector(".c-oreki-speed__info"),
    presetHeight: el ? Math.round(el.getBoundingClientRect().height) : 0,
  };
});
check("手机视口下无横向溢出", m1.docW <= m1.vw + 2, `innerWidth=${m1.vw} scrollWidth=${m1.docW}`);
check("手机视口下速度区块存在且按钮尺寸合理", m1.hasBlock && m1.presetHeight >= 40, `按钮高度 ${m1.presetHeight}px`);

const narrow = await browser.newPage();
await narrow.setViewport({ width: 700, height: 900 });
await narrow.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));
await openGameplay(narrow);
await new Promise(r => setTimeout(r, 1200));
await narrow.screenshot({ path: path.join(outDir, "options-narrow.png") });
const n1 = await narrow.evaluate(() => {
  const info = document.querySelector(".c-oreki-speed__info");
  const input = document.querySelector(".c-oreki-speed__input");
  if (!info || !input) return { stacked: false, noOverflow: false };
  const r1 = info.getBoundingClientRect(), r2 = input.getBoundingClientRect();
  return {
    stacked: Math.abs(r1.top - r2.top) > 10,
    noOverflow: document.documentElement.scrollWidth <= window.innerWidth + 2,
  };
});
check("700px 窄窗下信息区与输入区纵向堆叠", n1.stacked === true, JSON.stringify(n1));
check("700px 窄窗下无横向溢出", n1.noOverflow === true);

check("无未捕获异常", errs.length === 0, errs.slice(0, 2).join(" | "));

await browser.close();
server.close();
const failed = results.filter(r => !r.p);
console.log(`\n===== ${results.length - failed.length}/${results.length} 通过 =====`);
process.exit(failed.length ? 1 : 0);
