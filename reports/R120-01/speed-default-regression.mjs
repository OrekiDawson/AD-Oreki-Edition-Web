import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://127.0.0.1:4173/";
const OUT = new URL("./speed-default/", import.meta.url);
mkdirSync(OUT, { recursive: true });

const result = {
  base: BASE,
  startedAt: new Date().toISOString(),
  steps: {},
  pageErrors: [],
  consoleErrors: [],
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2.625,
  isMobile: true,
  hasTouch: true,
  locale: "zh-CN",
  userAgent:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/158.0.0.0 Mobile Safari/537.36",
});
const page = await context.newPage();
page.on("pageerror", error => result.pageErrors.push(String(error?.stack || error)));
page.on("console", message => {
  if (message.type() === "error") result.consoleErrors.push(message.text());
});

const waitForGame = () =>
  page.waitForFunction(
    () => window.player && window.GameSpeed && window.GameUI?.initialized === true,
    null,
    { timeout: 30000 },
  );

const speedSnapshot = () =>
  page.evaluate(() => ({
    factor: GameSpeed.factor,
    stored: localStorage.getItem(GameSpeed.storageKey),
    dynamic: GameSpeed.isDynamic,
    label: GameSpeed.modeLabel,
  }));

try {
  await page.goto(BASE, { waitUntil: "load", timeout: 30000 });
  await waitForGame();
  const fresh = await speedSnapshot();
  if (fresh.factor !== 3000 || fresh.stored !== null || fresh.dynamic !== true) {
    throw new Error(`新档默认速度不符合预期：${JSON.stringify(fresh)}`);
  }
  result.steps.fresh = { status: "PASS", value: fresh };

  await page.evaluate(() => localStorage.setItem(GameSpeed.storageKey, "10000"));
  await page.reload({ waitUntil: "load" });
  await waitForGame();
  const preserved = await speedSnapshot();
  if (preserved.factor !== 10000 || preserved.stored !== "10000") {
    throw new Error(`已有合法速度设置未被保留：${JSON.stringify(preserved)}`);
  }
  result.steps.existingSavedValue = { status: "PASS", value: preserved };

  if (result.pageErrors.length > 0 || result.consoleErrors.length > 0) {
    throw new Error(`浏览器错误：${JSON.stringify({
      pageErrors: result.pageErrors,
      consoleErrors: result.consoleErrors,
    })}`);
  }
  result.verdict = "PASS";
} catch (error) {
  result.verdict = "FAIL";
  result.error = String(error?.stack || error);
} finally {
  result.finishedAt = new Date().toISOString();
  writeFileSync(new URL("./results.json", OUT), JSON.stringify(result, null, 2));
  await context.close();
  await browser.close();
}

console.log(JSON.stringify(result, null, 2));
process.exitCode = result.verdict === "PASS" ? 0 : 1;
