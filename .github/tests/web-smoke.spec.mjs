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
