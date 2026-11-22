import { test, expect } from "@playwright/test";

// This is a genuine mobile Chromium boot test, NOT a full stage/save/completion test.
// Stage, autobuyer and persistence changes still require scoped Playwright acceptance.
test("fresh mobile session boots the real game without JS exceptions", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await expect(page.locator("#ui")).toBeVisible({ timeout: 45_000 });
  await expect.poll(async () => (await page.locator("#ui").innerText()).trim().length, {
    timeout: 55_000,
    message: "Game UI did not render non-empty text",
  }).toBeGreaterThan(0);
  await expect.poll(() => page.locator("#ui button").count(), {
    timeout: 55_000,
    message: "Game UI did not expose any interactive button",
  }).toBeGreaterThan(0);
  expect(pageErrors, "Unhandled browser errors").toEqual([]);
});

test("stage speed follows Break/Reality and preserves manual choice across reload", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  async function openGameplay() {
    const toggle = page.locator("button.c-oreki-nav__toggle");
    if (await toggle.isVisible() && await toggle.getAttribute("aria-expanded") !== "true") {
      await toggle.click();
    }
    await page.locator(".o-tab-btn--modern-tabs").filter({ hasText: "选项" }).click();
    if (await toggle.isVisible() && await toggle.getAttribute("aria-expanded") !== "true") {
      await toggle.click();
    }
    await page.locator(".o-tab-btn--subtab").filter({ hasText: "游戏玩法" }).click();
    await expect(page.locator('input[aria-label="自定义游戏速度倍率"]')).toBeVisible();
  }

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#ui")).toBeVisible({ timeout: 45_000 });
  await openGameplay();

  await expect.poll(() => page.evaluate(() => ({
    factor: GameSpeed.factor,
    managed: GameSpeed.isStageManaged,
  }))).toEqual({ factor: 500, managed: true });
  await expect(page.locator(".c-oreki-speed__hint").filter({ hasText: "Break 前 500×" }))
    .toBeVisible();

  await page.locator('input[aria-label="自定义游戏速度倍率"]').fill("2400");
  await page.getByRole("button", { name: "应用倍率" }).click();
  await expect.poll(() => page.evaluate(() => GameSpeed.factor)).toBe(2400);
  await expect(page.locator(".c-oreki-speed__hint").filter({ hasText: "已使用你的手动倍率" }))
    .toBeVisible();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#ui")).toBeVisible({ timeout: 45_000 });
  await openGameplay();
  await expect.poll(() => page.evaluate(() => ({
    factor: GameSpeed.factor,
    managed: GameSpeed.isStageManaged,
  }))).toEqual({ factor: 2400, managed: false });

  await page.getByRole("button", { name: /恢复默认/ }).click();
  await expect.poll(() => page.evaluate(() => ({
    factor: GameSpeed.factor,
    managed: GameSpeed.isStageManaged,
  }))).toEqual({ factor: 500, managed: true });
  expect(pageErrors, "Unhandled browser errors").toEqual([]);
});
