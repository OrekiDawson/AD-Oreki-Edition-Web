import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://127.0.0.1:4173/";
const SAVE_PATH =
  process.env.SAVE_PATH ||
  "/home/oreki/AD-Oreki-Edition/reports/R118-01/evidence/web-cont4/save-at-failure.txt";
const OUT = "/home/oreki/AD-Oreki-Edition/工作树/web/r120-01/reports/R120-01/user-closed";
const UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

mkdirSync(OUT, { recursive: true });
const saveString = readFileSync(SAVE_PATH, "utf8").trim();
const result = {
  savePath: SAVE_PATH,
  startedAt: new Date().toISOString(),
  steps: {},
  consoleErrors: [],
  pageErrors: [],
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 412, height: 915 },
  isMobile: true,
  hasTouch: true,
  locale: "zh-CN",
  userAgent: UA,
});
const page = await context.newPage();
page.on("console", message => {
  if (message.type() === "error") result.consoleErrors.push(message.text());
});
page.on("pageerror", error => result.pageErrors.push(String(error?.stack || error)));

const waitForGame = () =>
  page.waitForFunction(
    () => window.player && window.GameUI && window.GameUI.initialized === true,
    null,
    { timeout: 30000 },
  );

const dismissModals = async () => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    for (const label of ["跳过", "确定", "是", "继续", "好的"]) {
      const button = page.getByRole("button", { name: label, exact: true }).first();
      if (await button.isVisible().catch(() => false)) {
        await button.click({ timeout: 2000, force: true }).catch(() => {});
      }
    }
    const overlay = page.locator(".c-modal-overlay").first();
    if (!(await overlay.isVisible().catch(() => false))) return;
    await page.evaluate(() => {
      try {
        Modal.hideAll();
      } catch {
        // 只清理导入后的进度/提示弹窗。
      }
    });
    await page.waitForTimeout(250);
  }
};

const openTab = async name => {
  await dismissModals();
  const entry = page
    .locator(".o-tab-btn--modern-tabs .l-tab-btn-inner")
    .filter({ hasText: name })
    .first();
  if (!(await entry.isVisible().catch(() => false))) {
    await page.locator(".c-oreki-nav__toggle").first().click();
    await page.waitForTimeout(300);
  }
  await entry.click({ timeout: 8000 });
  await page.waitForTimeout(500);
  return page.evaluate(() => ui.view.tab);
};

const snapshot = () =>
  page.evaluate(() => {
    const automation = globalThis.OrekiEternityAutomation;
    return {
      autoEternityActive: player.auto.eternity.isActive === true,
      autoEternityUnlocked: (() => {
        try {
          return Autobuyer.eternity.isUnlocked === true;
        } catch {
          return null;
        }
      })(),
      userClosed: automation?._eternityAutoUserClosed === true,
      adopted: automation?._eternityAutobuyerAdopted === true,
      lastSeenActive: automation?._eternityAutoLastSeenActive,
      eternities: String(player.eternities),
      autoGate: automation ? automation._eternityBootstrapActive() === true : null,
      lockedDrive: automation ? automation._lockedLayerDriveAllowed() === true : null,
    };
  });

try {
  await page.goto(BASE, { waitUntil: "load", timeout: 30000 });
  await waitForGame();
  await page.evaluate(save => GameStorage.import(save), saveString);
  await page.waitForTimeout(2500);
  await dismissModals();
  await page.waitForTimeout(500);
  const imported = await snapshot();
  if (!imported.autoEternityUnlocked || !imported.autoEternityActive) {
    throw new Error(`夹具状态不满足已解锁且开启：${JSON.stringify(imported)}`);
  }
  result.steps.imported = { status: "PASS", value: imported };

  const currentTab = await openTab("自动化");
  if (currentTab !== "automation") {
    throw new Error(`自动化页实际=${currentTab}`);
  }

  const toggleRect = await page.evaluate(() => {
    const row = [...document.querySelectorAll(".c-autobuyer-box-row")].find(element =>
      element.querySelector(".l-autobuyer-box__header")?.textContent?.includes("自动永恒"),
    );
    const footer = row?.querySelector(".l-autobuyer-box__footer");
    if (!footer) return null;
    const rect = footer.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  if (!toggleRect || toggleRect.height <= 0) {
    await page.screenshot({ path: `${OUT}/fail-automation.png` });
    throw new Error(`未找到可见的自动永恒开关：${JSON.stringify(toggleRect)}`);
  }
  const clickX = toggleRect.width > 0
    ? toggleRect.x + toggleRect.width / 2
    : Math.min(402, toggleRect.x + 10);
  await page.mouse.click(clickX, toggleRect.y + toggleRect.height / 2);
  let closed = await snapshot();
  for (let attempt = 0; attempt < 20 && !closed.userClosed; attempt += 1) {
    await page.waitForTimeout(500);
    closed = await snapshot();
  }
  if (closed.autoEternityActive || !closed.userClosed || closed.autoGate || closed.lockedDrive) {
    throw new Error(`手动关闭未被粘滞尊重：${JSON.stringify(closed)}`);
  }
  result.steps.manualClose = { status: "PASS", value: closed };
  await page.screenshot({ path: `${OUT}/01-manual-close.png` });

  await page.evaluate(() => GameStorage.save(true));
  await page.reload({ waitUntil: "load" });
  await waitForGame();
  await page.waitForTimeout(5000);
  const reloaded = await snapshot();
  if (reloaded.autoEternityActive || reloaded.autoGate || reloaded.lockedDrive) {
    throw new Error(`reload 后 MOD 重新接管了玩家关闭：${JSON.stringify(reloaded)}`);
  }
  result.steps.reload = { status: "PASS", value: reloaded };
  await page.screenshot({ path: `${OUT}/02-after-reload.png` });

  result.verdict = "PASS";
} catch (error) {
  result.verdict = "FAIL";
  result.error = String(error?.stack || error);
  await page.screenshot({ path: `${OUT}/fail.png` }).catch(() => {});
} finally {
  result.finishedAt = new Date().toISOString();
  writeFileSync(`${OUT}/results.json`, JSON.stringify(result, null, 2));
  await context.close();
  await browser.close();
}

console.log(JSON.stringify(result, null, 2));
process.exitCode = result.verdict === "PASS" ? 0 : 1;
