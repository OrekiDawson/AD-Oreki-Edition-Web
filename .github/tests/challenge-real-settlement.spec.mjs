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

test("EC8 automation preserves purchases for locked infinity dimensions", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#ui")).toBeVisible({ timeout: 45_000 });
  await expect.poll(
    () => page.evaluate(() => typeof OrekiEternityAutomation !== "undefined"),
    { timeout: 45_000 },
  ).toBe(true);

  const result = await page.evaluate(() => {
    Pelle.isDoomed = false;
    player.challenge.eternity.current = 8;
    player.eterc8ids = 50;
    player.eterc8repl = 40;
    player.auto.autobuyersOn = true;
    player.auto.eternity.isActive = true;
    Currency.infinityPoints.value = Decimal.pow(10, 130);
    player.records.thisEternity.maxAM = Decimal.pow(10, 2400);
    InfinityDimensions.fullReset();
    for (let tier = 1; tier <= 3; tier++) InfinityDimension(tier).isUnlocked = true;

    const acted = OrekiEternityAutomation.tryEternityChallenge8Purchases();
    return {
      acted,
      remaining: player.eterc8ids,
      purchases: InfinityDimensions.all.map(dimension => dimension.purchases),
    };
  });

  expect(result.acted).toBe(true);
  expect(result.remaining).toBeGreaterThanOrEqual(5);
  expect(result.purchases.slice(0, 3).every(purchases => purchases > 0)).toBe(true);
  expect(result.purchases.slice(3)).toEqual([0, 0, 0, 0, 0]);
  expect(pageErrors, "Unhandled browser errors").toEqual([]);
});
