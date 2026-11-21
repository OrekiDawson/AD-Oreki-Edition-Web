import { test, expect } from "@playwright/test";

test("running challenge is not completed without reaching its goal", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#ui")).toBeVisible({ timeout: 45_000 });
  await expect.poll(
    () => page.evaluate(() => typeof player !== "undefined" && Boolean(player.challenge)),
    { timeout: 45_000 },
  ).toBe(true);

  const before = await page.evaluate(() => {
    player.challenge.normal.current = 1;
    player.challenge.normal.completedBits = 0;
    return {
      realTime: player.records.realTimePlayed,
      completedBits: player.challenge.normal.completedBits,
    };
  });

  await expect.poll(
    () => page.evaluate(beforeTime => player.records.realTimePlayed > beforeTime, before.realTime),
    { timeout: 10_000, message: "游戏主循环没有继续推进" },
  ).toBe(true);

  const after = await page.evaluate(() => ({
    current: player.challenge.normal.current,
    completedBits: player.challenge.normal.completedBits,
  }));
  expect(after.completedBits).toBe(0);
  expect(after.current).toBe(1);
  expect(pageErrors, "Unhandled browser errors").toEqual([]);
});
