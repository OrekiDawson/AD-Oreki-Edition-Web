// 真实 Android 模拟器 Chrome 探针（CDP over adb forward），供移动端适配测试复用。
//
// 前置（每次会话）：
//   adb reverse tcp:8288 tcp:8288
//   adb forward tcp:9222 localabstract:chrome_devtools_remote
//
// 用法：
//   node _tools/mobile-live.mjs metrics
//   node _tools/mobile-live.mjs shot _research/shots/r1-main.png
//   node _tools/mobile-live.mjs eval "window.innerWidth"
//   node _tools/mobile-live.mjs file _research/probe.js          # 执行外部脚本，返回值原样打印
//   node _tools/mobile-live.mjs tap 200 1200                     # CSS px
//   node _tools/mobile-live.mjs swipe 540 1800 540 600           # CSS px
//   node _tools/mobile-live.mjs key "hello"                      # 软键盘输入路径（不会弹真实 IME）
//   node _tools/mobile-live.mjs reload
//
// 通用参数：--url <地址> 先导航；--wait <ms> 等待；--env NAME=VALUE 注入 __ENV。
import fs from "node:fs";
import path from "node:path";

const CDP = process.env.OREKI_CDP || "http://127.0.0.1:9222";
const argv = process.argv.slice(2);

function takeFlag(name, def = null) {
  const i = argv.indexOf(name);
  if (i < 0) return def;
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v;
}
const flagUrl = takeFlag("--url");
const flagWait = Number(takeFlag("--wait", "0"));
const flagOut = takeFlag("--out");
const flagNoCache = argv.includes("--nocache");
if (flagNoCache) argv.splice(argv.indexOf("--nocache"), 1);

const cmd = argv[0];
const rest = argv.slice(1);

if (!cmd) {
  console.error("用法见文件头注释");
  process.exit(2);
}

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.connect({ browserURL: CDP, defaultViewport: null });

const pages = await browser.pages();
// 优先选已经打开游戏页的标签，避免误用 about:blank
let page = pages.find(p => p.url().includes("8288/index.html")) || pages[pages.length - 1];
if (!page) {
  console.error("没有可用标签页");
  process.exit(2);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

if (flagNoCache) {
  // 改完 CSS 后必须绕过缓存，否则量到的是旧样式表
  await page.setCacheEnabled(false);
}

function cssPx(pair) {
  return pair.map(Number);
}

if (flagUrl) {
  await page.bringToFront();
  // 游戏页要加载大量资源，等 load 容易超时；domcontentloaded + 手工等待更稳
  await page.goto(flagUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(e => {
    console.error("导航告警：" + e.message);
  });
}

let result;
switch (cmd) {
  case "reload":
    await page.reload({ waitUntil: "load" });
    result = { ok: true };
    break;
  case "metrics":
    result = await page.evaluate(() => {
      const vv = window.visualViewport;
      const de = document.documentElement;
      const meta = document.querySelector('meta[name="viewport"]');
      return {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        dpr: window.devicePixelRatio,
        clientWidth: de.clientWidth,
        clientHeight: de.clientHeight,
        scrollWidth: de.scrollWidth,
        bodyScrollWidth: document.body ? document.body.scrollWidth : null,
        visualScale: vv ? vv.scale : null,
        visualWidth: vv ? Math.round(vv.width) : null,
        visualOffsetTop: vv ? Math.round(vv.offsetTop) : null,
        viewportMeta: meta ? meta.getAttribute("content") : null,
        screenW: screen.width,
        screenH: screen.height,
        ua: navigator.userAgent,
      };
    });
    break;
  case "shot": {
    const out = path.resolve(rest[0] || flagOut || "_research/shots/live.png");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out });
    result = { path: out };
    break;
  }
  case "css": {
    // 注入/替换实验用样式表（id=probe-mobile），不动磁盘文件
    const css = fs.readFileSync(path.resolve(rest[0]), "utf8");
    result = await page.evaluate(text => {
      let el = document.getElementById("probe-mobile");
      if (!el) {
        el = document.createElement("style");
        el.id = "probe-mobile";
        document.head.appendChild(el);
      }
      el.textContent = text;
      return { injected: text.length };
    }, css);
    break;
  }
  case "uncss":
    result = await page.evaluate(() => {
      const el = document.getElementById("probe-mobile");
      if (el) el.remove();
      return { removed: !!el };
    });
    break;
  case "eval":
    result = await page.evaluate(src => {
      const f = new Function("return (" + src + ")");
      return f();
    }, rest.join(" "));
    break;
  case "file": {
    const src = fs.readFileSync(path.resolve(rest[0]), "utf8");
    result = await page.evaluate(async s => {
      const f = new Function("return (async () => {" + s + "})()");
      return await f();
    }, src);
    break;
  }
  case "tap": {
    const [x, y] = cssPx(rest);
    await page.touchscreen.tap(x, y);
    result = { tapped: [x, y] };
    break;
  }
  case "swipe": {
    const [x1, y1, x2, y2] = rest.map(Number);
    const cdp = await page.createCDPSession();
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: x1, y: y1 }],
    });
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x1 + ((x2 - x1) * i) / steps, y: y1 + ((y2 - y1) * i) / steps }],
      });
      await sleep(16);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
    result = { swiped: [x1, y1, x2, y2] };
    break;
  }
  case "key": {
    const text = rest.join(" ");
    await page.keyboard.type(text, { delay: 20 });
    result = { typed: text };
    break;
  }
  default:
    console.error("未知命令：" + cmd);
    await browser.disconnect();
    process.exit(2);
}

if (flagWait) await sleep(flagWait);
console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2));
await browser.disconnect();
