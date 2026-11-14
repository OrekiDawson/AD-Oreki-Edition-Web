// R109-01 P1-C · oreki.net 线上受控 Pages 部署独立验证（v2：启动重试 + 网络状态记录 + 正确页签选择器）
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";

const OUT = process.env.OUT_DIR || "/home/oreki/AD-Oreki-Unified/reports/R109-01/web-pages/live";
const EXPECTED_SHA = process.env.EXPECTED_SHA || "8914ea5b842aad34a36116b5947b3b03f6df6955";
const EXPECTED_CI = Number(process.env.EXPECTED_CI || "43551150141");
const REPO = process.env.WEB_REPO || "/home/oreki/AD-Oreki-Unified/_wt_r109_web";
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "verify.log"), "");
const log = (...a) => { const s = "[" + new Date().toISOString() + "] " + a.join(" "); console.log(s); fs.appendFileSync(path.join(OUT, "verify.log"), s + "\n"); };
const writeJson = (n, o) => fs.writeFileSync(path.join(OUT, n), JSON.stringify(o, null, 2) + "\n");
const sha256 = b => crypto.createHash("sha256").update(b).digest("hex");
const sleep = ms => new Promise(r => setTimeout(r, ms));

const result = {
  startedAt: new Date().toISOString(),
  expected: { sha: EXPECTED_SHA, ciRun: EXPECTED_CI },
  deployment: { status: "NOT RUN" },
  sourceIntegrity: { status: "NOT RUN" },
  browser: { status: "NOT RUN" },
  console: { pageErrors: [], consoleErrors: [], expectedCspErrors: [], badResponses: [] },
  screenshots: [],
  checks: {},
  attempts: [],
};

// 1) 线上 deployment.json
let deployment = null;
for (let attempt = 1; attempt <= 12; attempt++) {
  try {
    const res = await fetch("https://oreki.net/deployment.json?verify=" + Date.now(), { headers: { "cache-control": "no-cache" } });
    const text = await res.text();
    log("deployment.json attempt", attempt, "HTTP", res.status, text.slice(0, 200));
    if (res.ok) {
      const j = JSON.parse(text);
      deployment = j;
      if (j.web_sha === EXPECTED_SHA && Number(j.web_ci_run_id) === EXPECTED_CI) break;
    }
  } catch (e) { log("deployment.json attempt", attempt, "error", String(e)); }
  if (attempt < 12) await sleep(10000);
}
result.deployment = { status: deployment && deployment.web_sha === EXPECTED_SHA && Number(deployment.web_ci_run_id) === EXPECTED_CI ? "PASS" : "FAIL", observed: deployment };
writeJson("deployment.json", result.deployment);
if (result.deployment.status !== "PASS") {
  log("FATAL: deployment.json 与批准 SHA/CI 不一致");
  result.finishedAt = new Date().toISOString();
  writeJson("result.json", result);
  process.exit(2);
}

// 2) 线上 src/main.js 字节一致性
try {
  const [liveRes, local] = await Promise.all([
    fetch("https://oreki.net/src/main.js?verify=" + Date.now(), { headers: { "cache-control": "no-cache" } }),
    fs.promises.readFile(path.join(REPO, "src/main.js")),
  ]);
  const live = Buffer.from(await liveRes.arrayBuffer());
  const liveHash = sha256(live), localHash = sha256(local);
  result.sourceIntegrity = {
    status: liveRes.ok && liveHash === localHash ? "PASS" : "FAIL",
    httpStatus: liveRes.status, liveBytes: live.length, localBytes: local.length,
    liveSha256: liveHash, localSha256: localHash, path: "src/main.js",
  };
  fs.writeFileSync(path.join(OUT, "live-main.js"), live);
  fs.writeFileSync(path.join(OUT, "local-main.js"), local);
} catch (e) {
  result.sourceIntegrity = { status: "FAIL", error: String(e) };
}
writeJson("source-integrity.json", result.sourceIntegrity);
log("source integrity", result.sourceIntegrity.status, result.sourceIntegrity.liveSha256, "==", result.sourceIntegrity.localSha256);

// 3) 浏览器验证
const req = createRequire("/home/oreki/.npm/_npx/e41f203b7505f1fb/noop.js");
const { chromium } = req("playwright");
const browser = await chromium.launch({
  headless: true,
  args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
    "--disable-features=CalculateNativeWinOcclusion", "--mute-audio", "--no-sandbox"],
});
let page = null;
const shot = async (name) => { const p = path.join(OUT, name); await page.screenshot({ path: p, fullPage: false }); result.screenshots.push(p); log("screenshot", p); };

const dismissDialogs = async (tag) => {
  let n = 0;
  for (let i = 0; i < 20; i++) {
    const btn = page.locator(".c-modal button, #modal button, .modal button")
      .filter({ hasText: /嗯呐|^好$|确定|^开始|关闭|继续|^OK$|^×$/ }).first();
    if (await btn.count().catch(() => 0) && await btn.isVisible().catch(() => false)) {
      await btn.click({ timeout: 4000 }).catch(() => {});
      n++; await sleep(600);
    } else break;
  }
  log("dialogs dismissed (" + (tag || "") + "):", n);
  return n;
};
const probe = () => page.evaluate(() => {
  const cs = globalThis.Currency;
  return {
    antimatter: cs?.antimatter?.value?.toString?.() ?? null,
    totalTimeMs: globalThis.player?.records?.totalTimePlayed ?? null,
    realTimeMs: globalThis.player?.records?.realTimePlayed ?? null,
    uiTextLen: document.querySelector("#ui")?.innerText?.trim().length ?? 0,
    uiDisplay: (() => { const u = document.querySelector("#ui"); return u ? getComputedStyle(u).display : null; })(),
    activeTabs: [...document.querySelectorAll(".o-tab-btn")].filter(e => e.classList.contains("o-tab-btn--active") || e.classList.contains("o-tab-btn--oreki-current")).map(e => e.textContent.trim().slice(0, 10)).slice(0, 6),
    bodyTextSample: document.body.innerText.trim().slice(0, 160),
  };
});

let boot = null;
try {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const ctx = await browser.newContext({
      viewport: { width: 412, height: 839 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true,
      locale: "zh-CN",
      userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Mobile Safari/537.36",
    });
    page = await ctx.newPage();
    const att = { attempt, badResponses: [], pageErrors: [], consoleErrors: [], expectedCspErrors: [] };
    page.on("pageerror", e => { att.pageErrors.push(String(e)); result.console.pageErrors.push(String(e)); log("pageerror:", String(e)); });
    page.on("console", m => {
      if (m.type() !== "error") return;
      const t = m.text();
      if (t.includes("googletagmanager.com/gtag/js") && t.includes("Content Security Policy")) { att.expectedCspErrors.push(t); result.console.expectedCspErrors.push(t); }
      else { att.consoleErrors.push(t); result.console.consoleErrors.push(t); log("console error:", t); }
    });
    page.on("response", r => { if (r.status() >= 400) { const rec = { status: r.status(), url: r.url() }; att.badResponses.push(rec); result.console.badResponses.push(rec); log("bad response", r.status(), r.url()); } });
    page.on("requestfailed", r => { if (!r.url().includes("googletagmanager")) { const rec = { status: "failed", url: r.url(), err: r.failure()?.errorText || "" }; att.badResponses.push(rec); result.console.badResponses.push(rec); } });

    const t0 = Date.now();
    let ok = false;
    try {
      const response = await page.goto("https://oreki.net/?verify=" + Date.now(), { waitUntil: "domcontentloaded", timeout: 90000 });
      att.httpStatus = response ? response.status() : null;
      log("attempt", attempt, "HTTP", att.httpStatus, "in", Date.now() - t0, "ms");
      await page.waitForFunction(() => {
        const u = document.querySelector("#ui");
        return !!u && getComputedStyle(u).display !== "none" && (u.innerText || "").trim().length > 20;
      }, null, { timeout: 60000 });
      await page.waitForFunction(() => globalThis.Currency?.antimatter?.value && typeof globalThis.Currency.antimatter.value.gt === "function", null, { timeout: 30000 });
      ok = true;
      att.boot = true;
      att.bootMs = Date.now() - t0;
      boot = att;
      log("attempt", attempt, "game booted");
      break;
    } catch (e) {
      att.boot = false; att.error = String(e).slice(0, 400);
      log("attempt", attempt, "boot FAIL:", att.error);
      try { await page.screenshot({ path: path.join(OUT, "live-boot-fail-attempt" + attempt + ".png"), fullPage: false }); } catch {}
      await ctx.close().catch(() => {});
      page = null;
      result.attempts.push(att);
      await sleep(8000);
    }
  }
  if (!boot) throw new Error("连续 3 次无法完成线上启动");
  result.attempts.push(boot);

  // 关闭教程/弹窗：真实点击 .c-modal 内的确认按钮（嗯呐/好/确定/关闭/继续/OK/×）
  await dismissDialogs("after-boot");
  const before = await probe();
  log("before", JSON.stringify(before));
  await sleep(6000);
  const after = await probe();
  log("after", JSON.stringify(after));

  const amGrowth = await page.evaluate(([a, b]) => {
    try { return new globalThis.Decimal(b).gt(new globalThis.Decimal(a)); } catch { return null; }
  }, [before.antimatter, after.antimatter]);
  const timeGrew = Number(after.totalTimeMs) > Number(before.totalTimeMs) || Number(after.realTimeMs) > Number(before.realTimeMs);
  result.checks.boot = { status: after.uiTextLen > 10 ? "PASS" : "FAIL", uiTextLen: after.uiTextLen, uiDisplay: after.uiDisplay, bootMs: boot.bootMs };
  result.checks.amTick = { status: amGrowth === true ? "PASS" : "FAIL", before: before.antimatter, after: after.antimatter, comparator: amGrowth };
  result.checks.gameTime = { status: timeGrew ? "PASS" : "NOT OBSERVED", before: { totalTimeMs: before.totalTimeMs, realTimeMs: before.realTimeMs }, after: { totalTimeMs: after.totalTimeMs, realTimeMs: after.realTimeMs } };
  await shot("live-initial.png");

  // 导航：移动端真实交互——关闭弹窗后点汉堡按钮打开页签抽屉，点「选项」页签，断言抽屉关闭+激活态迁移+选项内容出现；再返回「维度」
  const nav = { status: "FAIL" };
  const drawerState = () => page.evaluate(() => {
    const d = document.querySelector(".c-modern-sidebar--drawer");
    if (!d) return null;
    const r = d.getBoundingClientRect();
    return { x: Math.round(r.x), w: Math.round(r.width), opened: r.x >= -50 };
  });
  const activeTab = () => page.evaluate(() => {
    const e = [...document.querySelectorAll(".o-tab-btn--modern-tabs")].find(el => el.classList.contains("o-tab-btn--active") || el.classList.contains("o-tab-btn--oreki-current"));
    return e ? e.textContent.trim().replace(/\s+/g, " ").slice(0, 8) : null;
  });
  const drawerBefore = await drawerState();
  const activeBefore = await activeTab();
  log("drawer before", JSON.stringify(drawerBefore), "active tab:", activeBefore);
  let toggleClicked = false;
  for (let attempt = 0; attempt < 3 && !toggleClicked; attempt++) {
    await dismissDialogs("before-nav-" + attempt);
    try { await page.locator(".c-oreki-nav__toggle").first().click({ timeout: 8000 }); toggleClicked = true; }
    catch (e) { log("toggle click attempt", attempt, "failed:", String(e).slice(0, 120)); await sleep(1000); }
  }
  await sleep(900);
  const drawerOpen = await drawerState();
  log("drawer open", JSON.stringify(drawerOpen));
  const optionsTab = page.locator(".o-tab-btn--modern-tabs").filter({ hasText: "选项" }).first();
  const optionsVisible = await optionsTab.isVisible().catch(() => false);
  let optionsActive = false, optionsTextShown = false, drawerClosed = false, clickedText = null;
  if (optionsVisible) {
    clickedText = (await optionsTab.innerText().catch(() => "")).trim().replace(/\s+/g, " ");
    await dismissDialogs("before-tab");
    await optionsTab.click({ timeout: 12000 });
    await sleep(1800);
    const st = await page.evaluate(() => {
      const d = document.querySelector(".c-modern-sidebar--drawer");
      const r = d ? d.getBoundingClientRect() : null;
      const ui = document.querySelector("#ui");
      const active = [...document.querySelectorAll(".o-tab-btn--modern-tabs")].find(e => e.classList.contains("o-tab-btn--active") || e.classList.contains("o-tab-btn--oreki-current"));
      return {
        drawerX: r ? Math.round(r.x) : null,
        active: active ? active.textContent.trim().replace(/\s+/g, " ").slice(0, 8) : null,
        uiText: (ui?.innerText || "").slice(0, 1200),
      };
    });
    drawerClosed = st.drawerX !== null && st.drawerX < -50;
    optionsActive = st.active !== null && st.active.includes("选项");
    optionsTextShown = /导出存档|导入存档|自动存档|保存游戏|选择存档|重置游戏/.test(st.uiText);
    Object.assign(nav, {
      status: (drawerOpen && drawerOpen.opened && optionsVisible && drawerClosed && optionsActive && optionsTextShown) ? "PASS" : "FAIL",
      clickedText, toggleClicked, drawerBefore, drawerOpen, drawerClosedAfterClick: drawerClosed,
      activeBefore, activeAfter: st.active, optionsTextShown,
      optionsSample: st.uiText.slice(0, 300),
    });
    await shot("live-after-nav.png");
    // 返回「维度」页签
    await page.locator(".c-oreki-nav__toggle").first().click({ timeout: 10000 });
    await sleep(900);
    const dimensionTab = page.locator(".o-tab-btn--modern-tabs").filter({ hasText: "维度" }).first();
    await dimensionTab.click({ timeout: 10000 });
    await sleep(1200);
    const backActive = await activeTab();
    const backDrawer = await drawerState();
    nav.returnNav = {
      status: backActive?.includes("维度") && backDrawer && !backDrawer.opened ? "PASS" : "FAIL",
      activeAfterReturn: backActive,
      drawer: backDrawer,
    };
    if (nav.returnNav.status !== "PASS") nav.status = "FAIL";
  } else {
    Object.assign(nav, { status: "FAIL", reason: "选项页签不可见", drawerBefore, drawerOpen, activeBefore });
  }
  log("navigation result", JSON.stringify(nav));
  result.checks.navigation = nav;

  await shot("live-final.png");

  result.browser = {
    status: (result.checks.boot.status === "PASS" && result.checks.amTick.status === "PASS" && result.checks.navigation.status === "PASS" && result.console.pageErrors.length === 0 && result.console.consoleErrors.length === 0) ? "PASS" : "FAIL",
    httpStatus: boot.httpStatus,
    viewport: { width: 412, height: 839, dpr: 2.625, isMobile: true, hasTouch: true, locale: "zh-CN" },
    url: "https://oreki.net/",
    observed: { before, after },
  };
} catch (e) {
  result.browser = { status: "FAIL", error: String(e && e.stack || e) };
  log("browser verification FAIL", String(e && e.stack || e));
  try { if (page) await shot("live-failure.png"); } catch {}
} finally {
  await browser.close().catch(() => {});
}
result.finishedAt = new Date().toISOString();
writeJson("result.json", result);
log("RESULT", JSON.stringify({ deployment: result.deployment.status, sourceIntegrity: result.sourceIntegrity.status, browser: result.browser.status, pageErrors: result.console.pageErrors.length, consoleErrors: result.console.consoleErrors.length, expectedCsp: result.console.expectedCspErrors.length, badResponses: result.console.badResponses.length }));
process.exit(result.deployment.status === "PASS" && result.sourceIntegrity.status === "PASS" && result.browser.status === "PASS" ? 0 : 1);