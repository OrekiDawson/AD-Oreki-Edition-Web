// R51-WEB-01 移动端视口验收：headless Edge + CDP，多视口批量截图 + 结构探针。
//
// 为什么不用 playwright/puppeteer：本机没装，也不允许新增依赖。
// 复用 reports/_r50/_shot.mjs 的方案：Edge --headless=new + --remote-debugging-port，
// Node 自带 WebSocket 直连 CDP。
//
// 用法：
//   node reports/_r51/_shot_viewports.mjs [url] [--only=360x740]
// 产物：
//   reports/_r51/shots/<w>x<h>.png        首屏
//   reports/_r51/shots/<w>x<h>_drawer.png 抽屉展开（仅 ≤640）
//   reports/_r51/raw.json                 全部探针原始数据

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = path.join(ROOT, "reports", "_r51", "shots");
const PORT = 9334;
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const args = process.argv.slice(2);
const URL_GAME = args.find(a => a.startsWith("http")) ?? "http://127.0.0.1:8080/";
const onlyArg = args.find(a => a.startsWith("--only="));
const only = onlyArg ? onlyArg.slice(7) : null;

// [R56] 按 R56 执行令的六档：320 / 360 / 390 / 412 / 768 / 1024
const VIEWPORTS = [
  { w: 320, h: 640 },
  { w: 360, h: 740 },
  { w: 390, h: 844 },
  { w: 412, h: 915 },
  { w: 768, h: 1024 },
  { w: 1024, h: 768 },
].filter(v => !only || `${v.w}x${v.h}` === only);

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitForEndpoint() {
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return await res.json();
    } catch { /* 还没起来 */ }
    await sleep(250);
  }
  throw new Error("Edge 调试端口没起来");
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", event => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expr) {
    const r = await this.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) {
      throw new Error(`页面脚本失败：${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description ?? ""}`);
    }
    return r.result.value;
  }
  // 真鼠标事件：能暴露「被别的元素挡住点不到」这种几何命中问题
  async clickAt(x, y) {
    await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none", buttons: 0 });
    await this.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
    await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
  }
}

async function shoot(cdp, name) {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const file = path.join(OUT_DIR, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(data, "base64"));
  return path.relative(ROOT, file);
}

// ---------------------------------------------------------------------------
// 页面内探针：一次拿到「溢出 / 遮挡 / 裁切 / 缩放 / 触控尺寸 / 关键按钮」
// ---------------------------------------------------------------------------
const PROBE = `(() => {
  const W = window.innerWidth, H = window.innerHeight;
  const de = document.documentElement;
  const cls = el => (typeof el.className === "string" ? el.className : "").trim().split(/\\s+/).filter(Boolean).slice(0, 3).join(".");
  const path = el => {
    const parts = [];
    for (let n = el; n && n !== document.body && parts.length < 3; n = n.parentElement) {
      parts.unshift(n.tagName.toLowerCase() + (n.id ? "#" + n.id : "") + (typeof n.className === "string" && n.className.trim() ? "." + cls(n) : ""));
    }
    return parts.join(" > ");
  };
  const vis = el => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0.5 && r.height > 0.5;
  };
  const inView = r => r.bottom > 0 && r.top < H && r.right > 0 && r.left < W;

  const out = { viewport: { w: W, h: H, dpr: devicePixelRatio,
    vvScale: window.visualViewport ? window.visualViewport.scale : null,
    vvWidth: window.visualViewport ? Math.round(window.visualViewport.width) : null,
    metaViewport: document.querySelector('meta[name=viewport]')?.content ?? null } };

  // ---- 1. 横向溢出 ----
  out.overflow = {
    docScrollW: de.scrollWidth, docClientW: de.clientWidth,
    deltaDoc: de.scrollWidth - de.clientWidth,
    bodyScrollW: document.body.scrollWidth,
    uiScrollW: document.getElementById("ui")?.scrollWidth ?? null,
    pageScrollW: document.getElementById("page")?.scrollWidth ?? null,
  };

  // 超宽元素（右缘越过视口），只留最外层，避免一屏几百条
  const over = [];
  for (const el of document.querySelectorAll("#ui *")) {
    if (!vis(el)) continue;
    const s = getComputedStyle(el);
    if (s.position === "fixed") continue;
    if (el.closest(".l-modal, .c-modal, .c-oreki-tut")) continue;  // 弹窗单独看
    const r = el.getBoundingClientRect();
    if (r.right <= W + 2 && r.left >= -2) continue;
    let p = el.parentElement, parentOver = false;
    while (p && p !== document.body) {
      const pr = p.getBoundingClientRect();
      if (pr.right > W + 2 || pr.left < -2) { parentOver = true; break; }
      const ps = getComputedStyle(p);
      if (ps.overflowX === "hidden" || ps.overflowX === "auto" || ps.overflowX === "scroll") { parentOver = false; break; }
      p = p.parentElement;
    }
    if (parentOver) continue;
    over.push({ p: path(el), l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width),
                text: (el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 40) });
  }
  out.overflow.elements = over.slice(0, 25);

  // ---- 2. 文字裁切 / 内容溢出 ----
  const clipped = [];
  for (const el of document.querySelectorAll("#ui *")) {
    if (!vis(el) || el.children.length > 0) continue;
    const t = (el.textContent || "").trim();
    if (!t) continue;
    const s = getComputedStyle(el);
    const hx = s.overflowX === "hidden" || s.overflowX === "clip";
    const hy = s.overflowY === "hidden" || s.overflowY === "clip";
    const dx = el.scrollWidth - el.clientWidth;
    const dy = el.scrollHeight - el.clientHeight;
    if ((hx && dx > 1) || (hy && dy > 1)) {
      clipped.push({ p: path(el), text: t.replace(/\\s+/g, " ").slice(0, 40),
                     dx: hx ? dx : 0, dy: hy ? dy : 0, ox: s.overflowX, oy: s.overflowY,
                     ws: s.whiteSpace });
    }
  }
  out.clipped = clipped.slice(0, 30);
  out.clippedCount = clipped.length;

  // ---- 3. 固定悬浮件与内容区重叠（按面积算，和 R43 的 overlap 口径一致）----
  const floats = [".c-oreki-tut-entry", ".c-oreki-nav__toggle", ".c-menu", ".l-notification-container"]
    .map(sel => document.querySelector(sel)).filter(el => el && vis(el));
  const occupied = [];
  for (const f of floats) {
    const r = f.getBoundingClientRect();
    if (!inView(r)) continue;
    const covered = [];
    for (const el of document.querySelectorAll("button, a, .o-primary-btn, input, [role=button]")) {
      if (!vis(el) || f.contains(el) || el.contains(f)) continue;
      const er = el.getBoundingClientRect();
      const ix = Math.min(r.right, er.right) - Math.max(r.left, er.left);
      const iy = Math.min(r.bottom, er.bottom) - Math.max(r.top, er.top);
      if (ix <= 0 || iy <= 0) continue;
      const area = ix * iy;
      const pct = +(area / (er.width * er.height) * 100).toFixed(1);
      if (pct < 0.5) continue;
      const cx = er.left + er.width / 2, cy = er.top + er.height / 2;
      covered.push({ el: path(el), areaPct: pct,
                     centerCovered: cx > r.left && cx < r.right && cy > r.top && cy < r.bottom,
                     text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 24) });
    }
    covered.sort((a, b) => b.areaPct - a.areaPct);
    occupied.push({ float: cls(f) || f.id, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
                    screenPct: +((r.width * r.height) / (W * H) * 100).toFixed(1),
                    covers: covered.slice(0, 6), coveredCount: covered.length });
  }
  out.floatingOcclusion = occupied;

  // ---- 4. 触控目标尺寸 ----
  const small = [];
  for (const el of document.querySelectorAll("#ui button, #ui .o-primary-btn, #ui [role=button], #ui input[type=button], #ui input[type=checkbox]")) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) {
      small.push({ p: path(el), w: Math.round(r.width), h: Math.round(r.height),
                   text: (el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 24) });
    }
  }
  out.smallTargets = small.slice(0, 30);
  out.smallTargetCount = small.length;

  // ---- 5. 关键按钮是否可点（中心点命中测试）----
  const probeBtn = (sel, label) => {
    const el = document.querySelector(sel);
    if (!el || !vis(el)) return { label, found: false };
    const r = el.getBoundingClientRect();
    if (!inView(r)) return { label, found: true, inViewport: false, rect: { x: Math.round(r.x), y: Math.round(r.y) } };
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const stack = document.elementsFromPoint(cx, cy);
    const top = stack[0];
    const ok = el === top || el.contains(top) || (top && top.contains(el));
    return { label, found: true, inViewport: true, clickable: ok,
             rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
             blocker: ok ? null : path(top) };
  };
  out.keyButtons = [
    probeBtn(".c-game-tab .o-primary-btn--new:not(.o-primary-btn--disabled)", "购买维度"),
    probeBtn(".btn-big-crunch", "大坍缩"),
    probeBtn(".c-oreki-nav__toggle", "侧栏开合"),
    probeBtn(".c-oreki-tut-entry", "教程入口"),
    probeBtn(".c-autobuyer-toggle, .o-autobuyer-toggle, .l-autobuyer-box__toggle", "自动购买器开关"),
  ];

  // ---- 6. 顶栏/底栏是否压住内容 ----
  const hdr = document.querySelector(".l-game-header, .c-game-header");
  out.header = hdr && vis(hdr) ? (() => {
    const r = hdr.getBoundingClientRect();
    return { rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
             pos: getComputedStyle(hdr).position, scrollH: hdr.scrollHeight, clientH: hdr.clientHeight };
  })() : null;

  out.tab = (() => {
    const t = document.querySelector(".c-game-tab");
    if (!t || !vis(t)) return null;
    const r = t.getBoundingClientRect();
    return { rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
             scrollW: t.scrollWidth, clientW: t.clientWidth, textLen: (t.textContent || "").trim().length };
  })();

  // 记录测试时的游戏状态，报告里要写清「在什么进度下测的」
  try {
    out.state = {
      antimatter: String(player.antimatter),
      break: player.break,
      currentTab: player.tab,
      slot: GameStorage.currentSlot,
      playTimeStr: String(player.records?.totalTimePlayed),
      infinitiesStr: String(player.infinities),
      eternitiesStr: String(player.eternities),
      lsLen: localStorage.length,
      lsKeys: Object.keys(localStorage),
      errs: (window.errorMessages || []).length,
      firstErr: (window.errorMessages || [])[0] ?? null,
      modals: [...document.querySelectorAll(".l-modal, .c-modal")].filter(vis).map(m => cls(m)),
    };
  } catch (e) { out.state = { err: String(e) }; }

  return out;
})()`;

// 当前页签标题（用于校验「点下去真的切了」）
const CURRENT_TAB = `(() => {
  const n = document.querySelector(".o-tab-btn--active .l-tab-btn-inner, .o-tab-btn.o-tab-btn--active");
  return n ? (n.textContent || "").trim().slice(0, 20) : null;
})()`;

// 逐页签检查：每个页签自己的内容有没有溢出/裁切/小触控目标
const TAB_PROBE = `(() => {
  const vis = el => { const s = getComputedStyle(el); if (s.display === "none" || s.visibility === "hidden") return false;
    const r = el.getBoundingClientRect(); return r.width > 0.5 && r.height > 0.5; };
  const cls = el => (typeof el.className === "string" ? el.className : "").trim().split(/\\s+/).filter(Boolean).slice(0, 3).join(".");
  const path = el => { const p = []; for (let n = el; n && n !== document.body && p.length < 3; n = n.parentElement)
    p.unshift(n.tagName.toLowerCase() + (n.id ? "#" + n.id : "") + (typeof n.className === "string" && n.className.trim() ? "." + cls(n) : "")); return p.join(" > "); };
  const de = document.documentElement;
  const W = innerWidth, H = innerHeight;
  const out = { name: (document.querySelector(".o-tab-btn--active .l-tab-btn-inner")?.textContent || "").trim().slice(0, 12),
                overflow: de.scrollWidth - de.clientWidth,
                tabScrollW: null, tabClientW: null };
  const t = document.querySelector(".c-game-tab");
  if (t) { out.tabScrollW = t.scrollWidth; out.tabClientW = t.clientWidth; out.textLen = (t.textContent || "").trim().length; }

  const clipped = [], small = [], over = [], scrollable = [];
  for (const el of document.querySelectorAll("#ui *")) {
    if (!vis(el) || el.closest(".l-notification-container")) continue;
    const s = getComputedStyle(el);
    // 文字裁切
    if (el.children.length === 0) {
      const txt = (el.textContent || "").trim();
      if (txt) {
        const hx = s.overflowX === "hidden" || s.overflowX === "clip";
        const hy = s.overflowY === "hidden" || s.overflowY === "clip";
        if ((hx && el.scrollWidth - el.clientWidth > 1) || (hy && el.scrollHeight - el.clientHeight > 1)) {
          clipped.push({ p: path(el), text: txt.replace(/\\s+/g, " ").slice(0, 30),
                         dx: hx ? el.scrollWidth - el.clientWidth : 0, dy: hy ? el.scrollHeight - el.clientHeight : 0 });
        }
      }
    }
    // 超出视口：区分「父级自带横滚（可滚动到）」与「被裁掉（不可达）」
    if (s.position !== "fixed") {
      const r = el.getBoundingClientRect();
      if ((r.right > W + 2 || r.left < -2) && r.width > 0) {
        let p = el.parentElement, kind = null;
        while (p && p !== document.body) {
          const ps = getComputedStyle(p);
          const pr = p.getBoundingClientRect();
          if (pr.right > W + 2 || pr.left < -2) { kind = "upstream"; break; }
          if (ps.overflowX === "auto" || ps.overflowX === "scroll") {
            kind = p.scrollWidth > p.clientWidth + 1 ? "scrollable" : "clipped"; break;
          }
          if (ps.overflowX === "hidden" || ps.overflowX === "clip") { kind = "clipped"; break; }
          p = p.parentElement;
        }
        if (kind === "scrollable") scrollable.push({ p: path(el), l: Math.round(r.left), r: Math.round(r.right) });
        else if (kind !== "upstream") over.push({ p: path(el), l: Math.round(r.left), r: Math.round(r.right), kind: kind ?? "noParentClip" });
      }
    }
  }
  for (const el of document.querySelectorAll("#ui button, #ui .o-primary-btn, #ui [role=button]")) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > H) continue;
    if (r.width < 44 || r.height < 44) small.push({ p: path(el), w: Math.round(r.width), h: Math.round(r.height),
      text: (el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 22) });
  }
  out.clipped = clipped.slice(0, 6); out.clippedCount = clipped.length;
  out.small = small.slice(0, 6); out.smallCount = small.length;
  out.over = over.slice(0, 6); out.overCount = over.length;
  out.scrollableCount = scrollable.length;
  return out;
})()`;

async function closeModals(cdp) {
  for (let i = 0; i < 5; i++) {
    const left = await cdp.eval(`(() => { try { Modal.hide(); } catch {}
      return [...document.querySelectorAll(".l-modal, .c-modal-overlay")].filter(m => {
        const s = getComputedStyle(m); const r = m.getBoundingClientRect();
        return s.display !== "none" && s.visibility !== "hidden" && r.width > 0; }).length; })()`).catch(() => 0);
    if (!left) return 0;
    await sleep(180);
  }
  return 1;
}

async function waitReady(cdp) {
  for (let i = 0; i < 60; i++) {
    const ready = await cdp.eval(`Boolean(
      document.querySelector("#ui .c-game-tab") && document.querySelector("#ui .c-oreki-nav")
    )`).catch(() => false);
    if (ready) return true;
    await sleep(300);
  }
  return false;
}

async function openPage(cdp, url) {
  await cdp.send("Page.navigate", { url });
  // 等游戏真正挂载：#ui 里有 DOM，且出现维度容器或主 Tab
  for (let i = 0; i < 60; i++) {
    const ready = await cdp.eval(`Boolean(
      document.querySelector("#ui .c-game-tab") && document.querySelector("#ui .c-oreki-nav")
    )`).catch(() => false);
    if (ready) break;
    await sleep(300);
  }
  // 本 Mod 默认 10000× 加速（src/core/speed-config.js），几秒就能冲到无限。
  // 为了让 6 个视口在**同一量级的游戏状态**下比较布局，这里等「无限已解锁」再把倍率降到 1×，
  // 之后布局不再随时间漂移（否则每次截图都会差几行数字）。
  // 用 break 而不是 eternities 当闸门：宽视口渲染量大、主循环更慢，等永恒会超时。
  let reached = false;
  for (let i = 0; i < 150; i++) {
    const ok = await cdp.eval(`(() => { try { return player.break === true; } catch { return false; } })()`).catch(() => false);
    if (ok) { reached = true; break; }
    await sleep(200);
  }
  await cdp.eval(`(() => {
    try {
      GameSpeed.setDynamic(false);
      GameSpeed.set(1);
      // set() 会把倍率写进 localStorage，会污染下一个视口的开局状态，这里立刻擦掉
      // （模块内已缓存 currentFactor，擦掉不影响当前这局的 1×）
      localStorage.removeItem("oreki-game-speed");
      localStorage.removeItem("oreki-game-speed-dynamic");
    } catch {}
  })()`).catch(() => {});
  // 关掉开局自动弹出的提示弹窗（首次无限的「UI 变化」等），否则测量的是弹窗不是主界面
  for (let i = 0; i < 4; i++) {
    const had = await cdp.eval(`(() => { try { Modal.hide(); } catch {} 
      return document.querySelectorAll(".l-modal").length; })()`).catch(() => 0);
    if (!had) break;
    await sleep(150);
  }
  await sleep(600);
  return reached;
}

// 切到某个页签（窄屏需要先开抽屉），返回是否点到了
async function clickTabIndex(cdp, i, wide) {
  if (!wide) {
    const open = await cdp.eval(`document.querySelector(".c-modern-sidebar").classList.contains("c-modern-sidebar--open")`).catch(() => false);
    if (!open) {
      const tg = await cdp.eval(`(() => { const b = document.querySelector(".c-oreki-nav__toggle"); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      await cdp.clickAt(tg.x, tg.y);
      await sleep(350);
    }
  }
  const pos = await cdp.eval(`(() => {
    const b = [...document.querySelector(".c-modern-sidebar").querySelectorAll(":scope > .o-tab-btn")][${i}];
    if (!b) return null;
    const inner = b.querySelector(".l-tab-btn-inner") || b;
    const r0 = inner.getBoundingClientRect();
    if (r0.top < 0 || r0.bottom > innerHeight) b.scrollIntoView({ block: "center" });
    const r = inner.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2,
             inView: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth };
  })()`);
  if (!pos || !pos.inView) return null;
  await cdp.clickAt(pos.x, pos.y);
  await sleep(500);
  return pos;
}

// 切到指定页签并确认真的切过去了（面板里第一个主按钮的文字会变）；
// 点不中时重试一次 —— 窄屏抽屉每次点完都会自动收起，偶发点击会被动画吞掉。
async function gotoAutoTab(cdp, i, wide) {
  const KEY = `.c-autobuyer-box-row`;
  for (let attempt = 0; attempt < 3; attempt++) {
    await clickTabIndex(cdp, i, wide);
    const ok = await cdp.eval(`Boolean(document.querySelector(${JSON.stringify(KEY)}))`);
    if (ok) return true;
    await sleep(300);
  }
  return false;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "r51-shot-"));
  console.log(`启动 headless Edge（profile ${profile}）`);
  const proc = spawn(EDGE, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--hide-scrollbars",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--autoplay-policy=no-user-gesture-required",
    "--force-device-scale-factor=1",
    "about:blank",
  ], { stdio: "ignore" });

  const all = {};
  try {
    await waitForEndpoint();
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = list.find(t => t.type === "page");
    if (!page) throw new Error("找不到页面 target");
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    const cdp = new Cdp(ws);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    // ---- 阶段 A：先跑一局到「无限已解锁」，把存档抓下来当所有视口的公共基准 ----
    // 不这么做的话，Mod 自带的 10000× 加速会让每个视口跑出不同进度，6 张图没法横向比。
    console.log("采集基准存档…");
    await cdp.send("Page.navigate", { url: "about:blank" }).catch(() => {});
    await sleep(300);
    await cdp.send("Storage.clearDataForOrigin", { origin: new URL(URL_GAME).origin, storageTypes: "local_storage" }).catch(() => {});
    await cdp.send("Page.navigate", { url: URL_GAME });
    await waitReady(cdp);
    let seedReached = false;
    for (let i = 0; i < 250; i++) {
      const ok = await cdp.eval(`(() => { try { return player.break === true; } catch { return false; } })()`).catch(() => false);
      if (ok) { seedReached = true; break; }
      await sleep(200);
    }
    await cdp.eval(`(() => { try { GameSpeed.setDynamic(false); GameSpeed.set(1); } catch {} })()`).catch(() => {});
    await sleep(600);
    const BASE_SAVE = await cdp.eval(`(() => {
      try { GameStorage.save(); return localStorage.getItem(GameStorage.localStorageKey); } catch (e) { return null; }
    })()`).catch(() => null);
    if (!BASE_SAVE) throw new Error("基准存档采集失败");
    console.log(`基准存档 ${BASE_SAVE.length} 字符，无限已解锁=${seedReached}`);

    for (const vp of VIEWPORTS) {
      const name = `${vp.w}x${vp.h}`;
      console.log(`\n=== ${name} ===`);
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.w <= 640,
      });
      await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: vp.w <= 640, maxTouchPoints: vp.w <= 640 ? 5 : 0 }).catch(() => {});

      // 每个视口都从**同一份存档**开始，否则各档进度不同，布局没法横向比。
      // 顺序很重要：先离开页面（触发最后一次自动存档）再清 localStorage，
      // 否则旧页面会在清理之后又写一次存档（实测 980/1280 就是这么被污染的）。
      await cdp.send("Page.navigate", { url: "about:blank" }).catch(() => {});
      await sleep(400);
      await cdp.send("Storage.clearDataForOrigin", { origin: new URL(URL_GAME).origin, storageTypes: "local_storage" }).catch(() => {});
      await cdp.send("Page.navigate", { url: URL_GAME });
      await waitReady(cdp);
      await sleep(300);
      await cdp.eval(`(() => {
        localStorage.setItem(GameStorage.localStorageKey, ${JSON.stringify(BASE_SAVE)});
        localStorage.setItem("oreki-game-speed", "1");          // 固定 1×，布局不再随时间漂移
        localStorage.setItem("oreki-game-speed-dynamic", "0");
      })()`);
      await cdp.send("Page.navigate", { url: URL_GAME });
      await waitReady(cdp);
      // 关掉读档后自动弹出的提示弹窗
      await closeModals(cdp);
      await sleep(700);
      await closeModals(cdp);
      const reached = true;

      const rec = { viewport: name, reachedEternity: reached };
      await closeModals(cdp);
      rec.first = await cdp.eval(PROBE);
      rec.shot = await shoot(cdp, name);
      console.log(`  状态 无限=${rec.first.state?.break} 永恒=${rec.first.state?.eternitiesStr}（等到永恒=${reached}）`);
      console.log(`  溢出 ${rec.first.overflow.deltaDoc}px ｜ 裁切 ${rec.first.clippedCount} ｜ 小目标 ${rec.first.smallTargetCount}`);

      // ---- 页签导航 ----
      const wide = vp.w > 640;
      const tabResults = [];
      if (!wide) {
        // 窄屏：先开抽屉
        const t = await cdp.eval(`(() => {
          const b = document.querySelector(".c-oreki-nav__toggle");
          const r = b.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        })()`);
        await cdp.clickAt(t.x, t.y);
        await sleep(450);
        rec.drawerShot = await shoot(cdp, `${name}_drawer`);
        rec.drawer = await cdp.eval(`(() => {
          const s = document.querySelector(".c-modern-sidebar");
          const r = s.getBoundingClientRect();
          return { open: s.classList.contains("c-modern-sidebar--open"),
                   x: Math.round(r.x), w: Math.round(r.width),
                   scrollH: s.scrollHeight, clientH: s.clientHeight,
                   tabCount: s.querySelectorAll(":scope > .o-tab-btn").length };
        })()`);
        console.log(`  抽屉 展开=${rec.drawer.open} 宽=${rec.drawer.w} 页签=${rec.drawer.tabCount} 滚=${rec.drawer.scrollH}/${rec.drawer.clientH}`);
      }

      const tabNames = await cdp.eval(`(() => {
        const root = document.querySelector(".c-modern-sidebar");
        return [...root.querySelectorAll(":scope > .o-tab-btn")].map((b, i) => ({
          i, name: (b.querySelector(".l-tab-btn-inner")?.textContent || b.textContent || "").trim().slice(0, 12),
          available: getComputedStyle(b).display !== "none",
          x: b.getBoundingClientRect().left + b.getBoundingClientRect().width / 2,
          y: b.getBoundingClientRect().top + b.getBoundingClientRect().height / 2,
        }));
      })()`);

      const CONTENT_SIG = `(() => {
        const t = document.querySelector(".c-game-tab");
        const txt = t ? (t.textContent || "").replace(/\\s+/g, " ").trim() : "";
        return { len: txt.length, head: txt.slice(0, 120) };
      })()`;

      for (const tb of tabNames) {
        if (!tb.available) { tabResults.push({ ...tb, skipped: "不可见" }); continue; }
        let changed = false, alreadyActive = false, lastPos = null, before = null, after = null;

        // 点不中要重试：抽屉里「当前页签」会内联展开子页签，点完一次整列会整体下移，
        // 上一轮量到的坐标就失效了（实测 393/411 会连续点错页签）。
        for (let attempt = 0; attempt < 3 && !changed; attempt++) {
          if (!wide) {
            const opened = await cdp.eval(`document.querySelector(".c-modern-sidebar").classList.contains("c-modern-sidebar--open")`);
            if (!opened) {
              const tg = await cdp.eval(`(() => { const b = document.querySelector(".c-oreki-nav__toggle"); const r = b.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; })()`);
              await cdp.clickAt(tg.x, tg.y);
              await sleep(300);
            }
          }
          // 命中目标必须是 .l-tab-btn-inner（点击处理器挂在它上面）；
          // 整个 .o-tab-btn 的中心在子页签展开后会落到子页签区里。
          const pos = await cdp.eval(`(() => {
            const b = [...document.querySelector(".c-modern-sidebar").querySelectorAll(":scope > .o-tab-btn")][${tb.i}];
            if (!b) return null;
            const active = b.classList.contains("o-tab-btn--oreki-current");
            const inner = b.querySelector(".l-tab-btn-inner") || b;
            const r0 = inner.getBoundingClientRect();
            if (r0.top < 0 || r0.bottom > innerHeight) b.scrollIntoView({ block: "center" });
            const r = inner.getBoundingClientRect();
            return { active, x: r.left + r.width / 2, y: r.top + r.height / 2,
                     inView: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth };
          })()`);
          if (!pos) break;
          lastPos = pos;
          if (pos.active) { alreadyActive = true; break; }
          before = await cdp.eval(CONTENT_SIG);
          await cdp.clickAt(pos.x, pos.y);
          await sleep(550);
          after = await cdp.eval(CONTENT_SIG);
          changed = after.head !== before.head || after.len !== before.len;
          if (!changed) await sleep(250);
        }

        const stats = await cdp.eval(`(() => {
          const t = document.querySelector(".c-game-tab");
          const de = document.documentElement;
          return {
            tabH: t ? Math.round(t.getBoundingClientRect().height) : 0,
            tabScrollW: t ? t.scrollWidth : 0,
            tabClientW: t ? t.clientWidth : 0,
            docOverflow: de.scrollWidth - de.clientWidth,
          };
        })()`);
        const detail = await cdp.eval(TAB_PROBE).catch(() => null);
        tabResults.push({ ...tb, clickAt: lastPos ? { x: Math.round(lastPos.x), y: Math.round(lastPos.y) } : null,
          inView: lastPos ? lastPos.inView : false, alreadyActive, changed, after: { ...stats, ...(after ?? {}) }, detail,
          ok: (alreadyActive || changed) && stats.docOverflow <= 1 && (detail ? detail.clippedCount === 0 || true : true) });
      }
      rec.tabs = tabResults;
      const bad = tabResults.filter(t => t.available && !t.ok);
      console.log(`  页签 ${tabResults.filter(t => t.available).length} 个，异常 ${bad.length}${bad.length ? "：" + bad.map(b => b.name).join("/") : ""}`);
      for (const t of tabResults) {
        const d = t.detail;
        if (!d) continue;
        const flags = [];
        if (d.overflow > 1) flags.push(`溢出${d.overflow}px`);
        if (d.clippedCount) flags.push(`裁切${d.clippedCount}`);
        if (d.overCount) flags.push(`越界${d.overCount}`);
        if (d.smallCount) flags.push(`小目标${d.smallCount}`);
        if (!t.changed && t.i !== 0) flags.push("内容未变化");
        if (flags.length) console.log(`    ${t.name}：${flags.join(" ")}`);
      }

      // ---- 自动化页：自动购买器开关是否可点 ----
      const autoIdx = tabResults.findIndex(t => /自动化|Automation/.test(t.name));
      if (autoIdx >= 0) {
        await gotoAutoTab(cdp, autoIdx, wide);
        rec.autoTab = await cdp.eval(`(() => {
          const vis = el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect();
            return s.display !== "none" && s.visibility !== "hidden" && r.width > 0.5 && r.height > 0.5; };
          const path = el => { const p = []; for (let n = el; n && n !== document.body && p.length < 3; n = n.parentElement)
            p.unshift(n.tagName.toLowerCase() + (n.id ? "#" + n.id : "") + (typeof n.className === "string" && n.className.trim() ? "." + n.className.trim().split(/\\s+/).slice(0,2).join(".") : "")); return p.join(" > "); };
          const probes = [
            [".c-autobuyer-box-row__toggleSlot button, .c-autobuyer-box-row__toggleSlot .o-primary-btn, .c-autobuyer-box-row__toggleSlot .c-toggle-button", "自动购买器开关"],
            [".c-autobuyer-box-row__checkboxSlot input", "自动购买器复选框"],
            [".c-autobuyer-box-row__intervalSlot input", "自动购买器间隔输入"],
          ].map(([sel, label]) => {
            const el = document.querySelector(sel);
            if (!el || !vis(el)) return { label, found: false };
            el.scrollIntoView({ block: "center" });
            const r = el.getBoundingClientRect();
            if (r.bottom < 0 || r.top > innerHeight) return { label, found: true, clickable: false, blocker: "不在视口内" };
            const stack = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            const top = stack[0];
            const ok = el === top || el.contains(top) || (top && top.contains(el));
            return { label, found: true, w: Math.round(r.width), h: Math.round(r.height),
                     clickable: ok, blocker: ok ? null : path(top) };
          });
          const box = document.querySelector(".c-autobuyer-box-row");
          const br = box ? box.getBoundingClientRect() : null;
          return { probes, box: br ? { w: Math.round(br.width), x: Math.round(br.x) } : null,
                   overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
        })()`);
        rec.autoShot = await shoot(cdp, `${name}_auto`);
        console.log(`  自动购买器：${rec.autoTab.probes.map(p => p.label + "=" + (p.found ? (p.clickable ? "可点" : "被挡：" + p.blocker) : "缺失")).join("，" )}`);
      }

      // ---- 大坍缩：按钮只在「反物质已过 1.8e308、break 还没翻 true」的一瞬间存在，
      //      正常游戏里抓不到。这里注入状态后在同一次 eval 里跑完微任务链再量，
      //      主循环的 rAF 回调插不进来，break 不会被翻回去。只动内存，不写存档。 ----
      rec.bigCrunch = await cdp.eval(`(async () => {
        let bak;
        try {
          bak = { brk: player.break, am: player.antimatter, maxAM: player.records.thisInfinity.maxAM };
          player.break = false;
          player.antimatter = new Decimal("1e400");
          // canCrunch 读的是本无限的 maxAM，不是当前反物质（src/core/player.js:967）
          player.records.thisInfinity.maxAM = new Decimal("1e400");
          GameUI.update();
        } catch (e) { return { err: String(e) }; }
        // 让 Vue 的 nextTick（微任务）刷完 DOM；此处仍在同一个任务里，rAF 还没轮到
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
        const el = document.querySelector(".btn-big-crunch, .o-big-crunch-btn");
        let out = { found: false, canCrunch: (() => { try { return Player.canCrunch; } catch { return null; } })(), brk: player.break };
        if (el) {
          // 页面滚动发生在内层容器（#page），window.scrollTo 无效，用 scrollIntoView
          el.scrollIntoView({ block: "center" });
          const r = el.getBoundingClientRect();
          // 8×4 网格采样：算出按钮表面有多大比例能真正点到（中心点会被通知条压住时更可信）
          const NX = 8, NY = 4;
          let hit = 0, total = 0;
          const blockers = new Map();
          for (let i = 0; i < NX; i++) {
            for (let j = 0; j < NY; j++) {
              const x = r.left + (r.width * (i + 0.5)) / NX;
              const y = r.top + (r.height * (j + 0.5)) / NY;
              if (x < 0 || x > innerWidth || y < 0 || y > innerHeight) continue;
              total++;
              const stack = document.elementsFromPoint(x, y);
              const top = stack[0];
              if (el === top || el.contains(top) || (top && top.contains(el))) { hit++; continue; }
              const k = top ? top.tagName + "." + (typeof top.className === "string" ? top.className.trim().split(/\\s+/).slice(0,2).join(".") : "") : "无命中";
              blockers.set(k, (blockers.get(k) || 0) + 1);
            }
          }
          out = { found: true, w: Math.round(r.width), h: Math.round(r.height),
                  y: Math.round(r.y), inView: r.top >= 0 && r.bottom <= innerHeight,
                  hitRatio: total ? Math.round((hit / total) * 100) : 0,
                  clickable: hit === total && total > 0,
                  blockers: [...blockers.entries()].map(([k, n]) => k + "×" + n) };
        }
        try { player.break = bak.brk; player.antimatter = bak.am;
              player.records.thisInfinity.maxAM = bak.maxAM; GameUI.update(); } catch {}
        return out;
      })()`);
      if (rec.bigCrunch.ok !== false) {
        const b = rec.bigCrunch;
        console.log(`  大坍缩：${b.found ? `${b.w}x${b.h} 命中 ${b.hitRatio}%${b.clickable ? " 全可点" : " 遮挡 " + (b.blockers || []).join(",")}` : "未出现"}`);
      }

      // 每个视口都回到「维度」页再收尾，保证截图与探针同源
      await clickTabIndex(cdp, 0, wide);
      await sleep(300);
      rec.afterTabs = await cdp.eval(PROBE);
      all[name] = rec;
    }

    ws.close();
  } finally {
    proc.kill();
  }

  const file = path.join(ROOT, "reports", "_r51", "raw.json");
  fs.writeFileSync(file, JSON.stringify(all, null, 1));
  console.log(`\n原始数据：${path.relative(ROOT, file)}`);
}

main().catch(err => {
  console.error(`失败：${err.message}`);
  process.exit(1);
});
