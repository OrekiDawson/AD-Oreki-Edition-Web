// R40-C · 缺陷探针：在真实 AVD Chrome 里按指定视口测「遮挡 / 溢出 / 裁切 / 触控尺寸」
// 用法：node _tools/_r40c/probe.mjs [w,h] [w,h] ...
// 输出 JSON：每档视口的 UI 高度差、横向溢出、被固定层遮挡的可点元素、文本裁切、<44 触控目标
const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await browser.pages();
const page = pages.find(p => p.url().includes("8288")) || pages[pages.length - 1];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cdp = await page.createCDPSession();
await page.setCacheEnabled(false);

const argv = process.argv.slice(2).filter(a => /^\d+x\d+$/.test(a));
const VIEWS = (argv.length ? argv : ["320x640", "360x640", "392x676", "430x932", "768x360"]).map(s => {
  const [w, h] = s.split("x").map(Number);
  return { w, h, name: s };
});

const TABS = ["维度", "挑战", "自动化", "成就", "统计数据", "选项"];

const PROBE = () => {
  const de = document.documentElement;
  const vw = window.innerWidth, vh = window.innerHeight;
  const vis = e => {
    const s = getComputedStyle(e);
    if (s.visibility === "hidden" || s.display === "none" || +s.opacity === 0) return false;
    if (e.getClientRects().length === 0) return false;
    const b = e.getBoundingClientRect();
    return b.width > 0 && b.height > 0;
  };
  const nm = e => `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}.${String(e.className || "").split(/\s+/)[0]}`;

  const ui = document.querySelector("#ui");
  const ub = ui.getBoundingClientRect();

  // 固定层（.c-game-ui--fixed 及其子元素）遮挡情况
  const fixedLayer = document.querySelector(".c-game-ui--fixed");
  const overlays = [];
  if (fixedLayer) {
    for (const e of fixedLayer.querySelectorAll("*")) {
      if (!vis(e)) continue;
      const b = e.getBoundingClientRect();
      if (b.width < 12 || b.height < 12) continue;
      const cs = getComputedStyle(e);
      if (!["absolute", "fixed"].includes(cs.position)) continue;
      overlays.push({ el: nm(e), x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), text: (e.innerText || "").replace(/\s+/g, " ").trim().slice(0, 16) });
    }
  }
  // 只保留「画在内容之上」且不是整块遮罩的悬浮件
  const floating = overlays.filter(o => o.w < vw * 0.9 && o.h < vh * 0.5);

  const clickable = [...document.querySelectorAll("#ui button, #ui a, #ui input, #ui select")].filter(vis);
  const covered = [];
  for (const f of floating) {
    for (const c of clickable) {
      const cb = c.getBoundingClientRect();
      const ix = Math.min(f.x + f.w, cb.right) - Math.max(f.x, cb.left);
      const iy = Math.min(f.y + f.h, cb.bottom) - Math.max(f.y, cb.top);
      if (ix > 6 && iy > 6) {
        covered.push({ by: f.el, byText: f.text, target: nm(c), targetText: (c.innerText || "").replace(/\s+/g, " ").trim().slice(0, 18), overlapPct: Math.round((ix * iy) / Math.max(1, cb.width * cb.height) * 100) });
      }
    }
  }

  // 文本被水平裁切（按钮/标签）
  const clipped = [];
  for (const e of document.querySelectorAll("#ui button, #ui .o-tab-btn, #ui .l-tab-btn-inner, #ui span, #ui div")) {
    if (!vis(e)) continue;
    const s = getComputedStyle(e);
    if (s.overflowX === "auto" || s.overflowX === "scroll") continue;
    if (e.children.length > 0) continue; // 只看叶子节点，避免容器噪声
    const t = (e.innerText || "").trim();
    if (!t) continue;
    if (e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0) {
      clipped.push({ el: nm(e), sw: e.scrollWidth, cw: e.clientWidth, text: t.slice(0, 20) });
    }
  }

  // 竖排文字：宽度过窄但高度很高（如「维度献祭」按钮被挤成竖排）
  const vertical = [];
  for (const e of document.querySelectorAll("#ui button")) {
    if (!vis(e)) continue;
    const b = e.getBoundingClientRect();
    const t = (e.innerText || "").replace(/\s+/g, "");
    if (t.length >= 4 && b.width < 60 && b.height > b.width * 1.6) {
      vertical.push({ el: nm(e), w: Math.round(b.width), h: Math.round(b.height), text: t.slice(0, 18) });
    }
  }

  // < 44 触控目标
  const small = clickable.map(e => {
    const b = e.getBoundingClientRect();
    return { el: nm(e), w: Math.round(b.width), h: Math.round(b.height), text: (e.innerText || "").replace(/\s+/g, " ").trim().slice(0, 16) };
  }).filter(x => x.w < 44 || x.h < 44);

  return {
    vw, vh,
    uiRect: { x: Math.round(ub.x), y: Math.round(ub.y), w: Math.round(ub.width), h: Math.round(ub.height), bottom: Math.round(ub.bottom) },
    uiBottomOver: Math.round(ub.bottom - vh),
    uiRightGap: Math.round(vw - (ub.x + ub.width)),
    docOverflow: de.scrollWidth - de.clientWidth,
    uiScroll: { sh: ui.scrollHeight, ch: ui.clientHeight },
    floating,
    coveredCount: covered.length, covered: covered.slice(0, 6),
    clippedCount: clipped.length, clipped: clipped.slice(0, 6),
    verticalCount: vertical.length, vertical: vertical.slice(0, 4),
    smallCount: small.length, small: small.slice(0, 6),
  };
};

const out = [];
for (const v of VIEWS) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: v.w, height: v.h, deviceScaleFactor: 2, mobile: true, screenWidth: v.w, screenHeight: v.h });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await sleep(500);
  for (const tab of TABS) {
    await page.evaluate(n => {
      const b = [...document.querySelectorAll(".l-tab-btn-inner")].find(x => (x.innerText || "").trim() === n);
      if (b) b.click();
    }, tab);
    await sleep(350);
    const r = await page.evaluate(PROBE);
    out.push({ view: v.name, tab, ...r });
    console.log(`${v.name.padEnd(9)} ${tab.padEnd(5)} uiBottomOver=${String(r.uiBottomOver).padEnd(4)} uiRightGap=${String(r.uiRightGap).padEnd(3)} docOvf=${String(r.docOverflow).padEnd(3)} covered=${String(r.coveredCount).padEnd(3)} clipped=${String(r.clippedCount).padEnd(3)} vertical=${String(r.verticalCount).padEnd(2)} small=${r.smallCount}`);
    if (r.coveredCount) console.log("    covered:", JSON.stringify(r.covered.slice(0, 3)));
    if (r.verticalCount) console.log("    vertical:", JSON.stringify(r.vertical.slice(0, 2)));
    if (r.clippedCount) console.log("    clipped:", JSON.stringify(r.clipped.slice(0, 3)));
  }
}
await cdp.send("Emulation.clearDeviceMetricsOverride").catch(() => {});
await import("node:fs").then(fs => fs.writeFileSync("C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_tools/_r40c/probe.json", JSON.stringify(out, null, 2)));
await browser.disconnect();
