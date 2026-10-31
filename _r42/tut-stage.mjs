// R42 · 教程「按 stage() 正确定位章节」专项取证
//
// 为什么单独跑：
//   tut-accept.mjs 里那一次定位测量是无效的——页面里的自动机在这款 MOD 下
//   1~2 分钟就能把档推到永恒，导致 5 个状态全部落在 ch07。
//   这里改成：先关掉自动购买器总开关冻住进度（player.auto.autobuyersOn=false），
//   再在**同一个 evaluate** 里改状态 + 打开教程，避免中间夹进任何一次游戏 tick。
//
// 判定依据是 src/core/oreki-tutorial.js:294-317 的 getTutorialStartIndex()：
//   early    : galaxies>=1 -> ch03；dimensionBoosts>=1 -> ch02；否则 ch01
//   infinity : !player.break -> ch04；IP 指数 <11 -> ch05；否则 ch06
//   其它阶段 : 该 stageKey 的第一章（eternity->ch07 reality->ch11 celestials->ch13 doomed->ch16）
//
// 运行：
//   node _tools/_r42/tut-stage.mjs _tools/_r42

import fs from "node:fs";
import path from "node:path";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const OUT = process.argv[2] || "_tools/_r42";
const SERVE_PORT = 8099;
const CDP_PORT = 9337;
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

// 每个状态是一段在页面里执行的字符串；执行完就地打开教程
const STATES = [
  {
    name: "全新档（无维度提升、无星系）",
    expect: "ch01",
    js: `player.eternities = 0; player.realities = 0; player.infinities = 0;
         player.galaxies = 0; player.dimensionBoosts = 0; player.break = false;`,
  },
  {
    name: "开局·已有 1 次维度提升",
    expect: "ch02",
    js: `player.dimensionBoosts = 1; player.galaxies = 0;`,
  },
  {
    name: "开局·已有 1 个反物质星系",
    expect: "ch03",
    js: `player.galaxies = 1;`,
  },
  {
    name: "无限期·1 次无限、未打破",
    expect: "ch04",
    js: `player.galaxies = 0; player.dimensionBoosts = 0;
         player.infinities = 1; player.break = false;`,
  },
  {
    name: "无限期·已打破、无限点数 1e0",
    expect: "ch05",
    js: `player.infinities = 1; player.break = true;
         player.infinityPoints = new Decimal(1);`,
  },
  {
    name: "无限期·已打破、无限点数 1e12",
    expect: "ch06",
    js: `player.infinities = 1; player.break = true;
         player.infinityPoints = new Decimal("1e12");`,
  },
  {
    name: "永恒期·永恒次数 1",
    expect: "ch07",
    js: `player.infinities = 1; player.break = true;
         player.infinityPoints = new Decimal("1e20"); player.eternities = 1;`,
  },
  {
    name: "现实期·现实次数 1",
    expect: "ch11",
    js: `player.eternities = 1; player.eternities = 1;
         player.realities = 1;`,
  },
  {
    name: "天神期·已向特蕾莎投入",
    expect: "ch13",
    js: `player.realities = 1; try { Teresa.pouredAmount = 1; } catch (e) {}`,
  },
  {
    name: "毁灭现实·佩勒",
    expect: "ch16",
    js: `player.realities = 1; try { Teresa.pouredAmount = 1; } catch (e) {}
         try { player.celestials.pelle.doomed = true; } catch (e) {}`,
  },
];

const report = { at: new Date().toISOString(), results: [] };
const { browser, cleanup } = await launchBrowser({ port: CDP_PORT });

try {
  const { page, errors } = await openGame(browser, { port: SERVE_PORT, url: "http://127.0.0.1", waitMs: 90000 });
  report.pageErrors = errors.slice(0, 5);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await sleep(1500);

  // 越过开始按钮
  const start = await page.evaluate(() => {
    const c = Array.from(document.querySelectorAll("button, [class*=button]"))
      .filter(n => n.getBoundingClientRect().width > 0)
      .map(n => {
        const r = n.getBoundingClientRect();
        return { t: (n.innerText || "").trim().slice(0, 20), x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
    return c.find(h => /开始|Start|进入|继续|Continue|新游戏|新档/i.test(h.t)) || null;
  });
  if (start) { await page.mouse.click(start.x, start.y); await sleep(2500); }
  for (let i = 0; i < 5; i++) {
    const n = await page.evaluate(() => document.querySelectorAll(".l-modal-overlay").length);
    if (!n) break;
    await page.keyboard.press("Escape");
    await sleep(300);
  }

  // 冻住进度
  const frozen = await page.evaluate(() => {
    try {
      player.auto.autobuyersOn = false;
      return { autobuyersOn: player.auto.autobuyersOn };
    } catch (e) { return { error: String(e && e.message || e) }; }
  });
  report.frozen = frozen;

  for (const st of STATES) {
    const got = await page.evaluate(src => {
      const out = { ok: true, errors: [] };
      try {
        // 每次都从干净的「无高阶段」基线起步，避免上一状态残留
        player.eternities = 0; player.realities = 0;
        try { Teresa.pouredAmount = 0; } catch (e) { out.errors.push("Teresa:" + e.message); }
        // eslint-disable-next-line no-new-func
        new Function(src)();
        if (window.TutorialReadingPosition) {
          window.TutorialReadingPosition.chapterId = null;
          window.TutorialReadingPosition.scrollTop = 0;
        }
        window.Modal.orekiTutorial.show();
      } catch (e) {
        out.ok = false;
        out.errors.push(String(e && e.message || e));
      }
      return out;
    }, st.js);
    await sleep(900);
    const read = await page.evaluate(() => ({
      head: document.querySelector(".c-oreki-tut__head-title")?.innerText || "",
      counter: document.querySelector(".c-oreki-tut__counter")?.innerText || "",
      stage: document.querySelector(".c-oreki-tut__current-name")?.innerText || "",
      rows: Array.from(document.querySelectorAll(".c-oreki-tut__current-name")).map(n => n.innerText),
    }));
    // 记录实际状态，便于判断注入是否生效
    const state = await page.evaluate(() => ({
      eternities: String(player.eternities), realities: String(player.realities),
      infinities: String(player.infinities), break: Boolean(player.break),
      ipExp: (() => { try { return Currency.infinityPoints.exponent; } catch (e) { return "n/a"; } })(),
      galaxies: String(player.galaxies), dimensionBoosts: String(player.dimensionBoosts),
      stageNow: (() => { try { return Pelle.isDoomed; } catch (e) { return "n/a"; } })(),
    }));
    report.results.push({ state: st.name, expect: st.expect, injected: got, actual: read, playerState: state });

    // 关掉教程
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll("button")).find(n => /关闭教程/.test(n.innerText || ""));
      if (b) b.click();
    });
    await sleep(500);
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find(n => /确定|OK|关闭/.test(n.innerText || "")); if (b) b.click(); });
    await sleep(300);
  }
} catch (e) {
  report.fatal = String(e && e.stack || e);
} finally {
  await cleanup();
}

for (const r of report.results) {
  // 章标题形如「第 5 章　打破无限」，中间是全角空格，不能用定长 slice
  const m = /^第\s*(\d+)\s*章/.exec(r.actual.head || "");
  r.actualId = m ? `ch${String(m[1]).padStart(2, "0")}` : null;
  r.pass = r.actualId === r.expect;
}

fs.writeFileSync(path.join(OUT, "tut-stage-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.results.map(r => ({
  state: r.state, expect: r.expect, actualId: r.actualId, head: r.actual.head, stage: r.actual.stage, pass: r.pass,
})), null, 2));
console.log("frozen:", JSON.stringify(report.frozen), "fatal:", report.fatal || "none");
