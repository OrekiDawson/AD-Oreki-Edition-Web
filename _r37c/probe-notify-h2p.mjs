// R37-C · 定点探测：通知条几何（窄屏右缘）+ 320 视口 H2P 弹窗为何没渲染
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const ROOT = path.resolve("../AD-Oreki-Edition");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".webm": "video/webm", ".ico": "image/x-icon", ".ttf": "font/ttf" };
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
await new Promise(r => server.listen(9353, "127.0.0.1", r));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const { browser, cleanup } = await launchBrowser({ port: 9352 });
const out = {};
try {
  const { page } = await openGame(browser, { port: 9353, url: "http://127.0.0.1", waitMs: 90000 });
  await page.evaluate(() => {
    const cands = Array.from(document.querySelectorAll("button, .c-modal__button, [class*=button]"))
      .filter(n => n.getBoundingClientRect().width > 0);
    const t = cands.find(c => /开始|Start|进入|继续/i.test(c.innerText || "")) || cands[0];
    if (t) t.click();
  });
  await sleep(2500);

  out.notifyByViewport = [];
  for (const vp of [{ n: "320", w: 320, h: 640 }, { n: "360", w: 360, h: 640 },
                    { n: "392", w: 392, h: 676 }, { n: "800", w: 800, h: 600 }]) {
    await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1, isMobile: vp.w < 700, hasTouch: vp.w < 700 });
    await sleep(700);
    const r = await page.evaluate(async () => {
      const pc = document.getElementById("notification-container");
      // 等自然清空
      for (let i = 0; i < 30 && pc.children.length; i++) await new Promise(r => setTimeout(r, 250));
      for (let i = 1; i <= 6; i++) GameUI.notify.info(`窄屏通知长度测试第 ${i} 条`, 60000);
      // 再来一条超长文本，验证换行
      GameUI.notify.info("这是一条非常长的通知文本用于验证窄屏换行行为是否会把屏幕撑破或者被右缘裁切掉一半", 60000);
      await new Promise(r => setTimeout(r, 700));
      const nodes = Array.from(pc.children)
        .filter(n => n.getClientRects().length > 0)
        .filter(n => !n.classList.contains("o-notification--overflow"));
      const cr = pc.getBoundingClientRect();
      return {
        innerWidth,
        docScrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
        container: { x: Math.round(cr.x), right: Math.round(cr.right), w: Math.round(cr.width),
          position: getComputedStyle(pc).position, maxWidth: getComputedStyle(pc).maxWidth,
          parent: String(pc.parentElement?.className || "").slice(0, 40) },
        count: nodes.length,
        items: nodes.map(n => { const b = n.getBoundingClientRect();
          return { text: n.innerText.slice(0, 18), x: Math.round(b.x), right: Math.round(b.right),
            w: Math.round(b.width), h: Math.round(b.height),
            offRight: Math.round(b.right - innerWidth),
            anim: n.className.includes("--enter") ? "enter" : (n.className.includes("--leave") ? "leave" : "") }; })
      };
    });
    out.notifyByViewport.push({ vp: vp.n, ...r });
  }

  // H2P at 320
  await page.setViewport({ width: 320, height: 640, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await sleep(800);
  out.h2p320 = await page.evaluate(async () => {
    const snap = () => ({
      modalCurrent: (() => { try { return window.ui.view.modal.current?.constructor?.name ?? "none"; } catch (e) { return "err:" + e.message; } })(),
      hasH2PEl: !!document.querySelector(".l-h2p-modal"),
      modalEls: Array.from(document.querySelectorAll(".c-modal, .l-h2p-modal, .c-modal__inner"))
        .map(m => ({ cls: String(m.className).slice(0, 40), rect: (() => { const b = m.getBoundingClientRect();
          return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; })() })),
      modalId: (() => { try { return window.ui.view.modal.current?.constructor?.modalConfig?.id ?? null; } catch { return null; } })(),
      bodyText: (document.body.innerText || "").slice(0, 80)
    });
    const before = snap();
    let err = null;
    try { window.Modal.h2p.show(); } catch (e) { err = String(e); }
    await new Promise(r => setTimeout(r, 1500));
    return { before, err, after: snap() };
  });
  await page.screenshot({ path: path.join(process.cwd(), "_r37c", "probe_320_h2p.png") });

  // 320 下点「?」按钮能否打开
  out.h2p320Click = await page.evaluate(async () => {
    window.Modal.hideAll();
    await new Promise(r => setTimeout(r, 400));
    const btn = document.querySelector(".o-tab-btn.l-help-me");
    if (!btn) return { error: "no help btn" };
    const b = btn.getBoundingClientRect();
    return { btn: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) },
      clickable: b.width >= 44 && b.height >= 44 };
  });
} finally {
  await cleanup();
  server.close();
}
fs.writeFileSync(path.join(process.cwd(), "_r37c", "probe.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
