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

test("C11 matter growth uses bounded global-speed compensation", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#ui")).toBeVisible({ timeout: 45_000 });

  const result = await page.evaluate(async () => {
    const module = await import("/src/core/normal-challenges.js");
    return {
      original: module.c11MatterGrowthPower(1800, 1),
      compensated: module.c11MatterGrowthPower(1800, 1800),
      invalidFallback: module.c11MatterGrowthPower(1800, 0),
    };
  });

  expect(result.original).toBe(90);
  expect(result.compensated).toBeCloseTo(90 / Math.sqrt(1800), 12);
  expect(result.compensated / result.original).toBeCloseTo(1 / Math.sqrt(1800), 12);
  expect(result.invalidFallback).toBe(90);
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

test("EC8 automation preserves purchases for unlocked but unaffordable dimensions", async ({ page }) => {
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
    player.records.thisEternity.maxAM = Decimal.pow(10, 60000);
    InfinityDimensions.fullReset();
    for (let tier = 1; tier <= 8; tier++) InfinityDimension(tier).isUnlocked = true;

    const acted = OrekiEternityAutomation.tryEternityChallenge8Purchases();
    return {
      acted,
      remaining: player.eterc8ids,
      purchases: InfinityDimensions.all.map(dimension => dimension.purchases),
    };
  });

  expect(result.acted).toBe(true);
  expect(result.remaining).toBeGreaterThanOrEqual(4);
  expect(result.purchases.slice(4)).toEqual([0, 0, 0, 0]);
  expect(pageErrors, "Unhandled browser errors").toEqual([]);

  const afterUnlockAffordability = await page.evaluate(() => {
    Currency.infinityPoints.value = Decimal.pow(10, 1000);
    const acted = OrekiEternityAutomation.tryEternityChallenge8Purchases();
    return {
      acted,
      purchases: InfinityDimensions.all.map(dimension => dimension.purchases),
    };
  });

  expect(afterUnlockAffordability.acted).toBe(true);
  expect(
    afterUnlockAffordability.purchases.slice(4).every(purchases => purchases > 0),
  ).toBe(true);
  expect(pageErrors, "Unhandled browser errors").toEqual([]);
});

test("EC automation settles through the original eternity entry after the goal is reached", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#ui")).toBeVisible({ timeout: 45_000 });
  await expect.poll(
    () => page.evaluate(() => typeof OrekiEternityAutomation !== "undefined"),
    { timeout: 45_000 },
  ).toBe(true);

  const result = await page.evaluate(() => {
    player.break = true;
    player.auto.autobuyersOn = true;
    player.auto.eternity.isActive = true;
    player.eternities = new Decimal(100);
    player.challenge.eternity.current = 1;
    player.challenge.eternity.unlocked = 1;
    player.eternityChalls.eterc1 = 0;
    player.records.thisEternity.maxIP = EternityChallenge(1).initialGoal.times(10);
    Currency.infinityPoints.value = Decimal.pow(10, 500);
    player.records.thisEternity.maxAM = Decimal.pow(10, 1e4);
    const before = {
      canEternity: Player.canEternity,
      canBeCompleted: EternityChallenge(1).canBeCompleted,
      completions: EternityChallenge(1).completions,
      current: player.challenge.eternity.current,
    };
    const acted = OrekiEternityAutomation.tickEternity();
    return {
      before,
      acted,
      after: {
        completions: EternityChallenge(1).completions,
        current: player.challenge.eternity.current,
        eternities: player.eternities.toString(),
      },
    };
  });

  expect(result.before).toEqual({
    canEternity: true,
    canBeCompleted: true,
    completions: 0,
    current: 1,
  });
  expect(result.acted).toBe(true);
  expect(result.after.completions).toBe(1);
  expect(result.after.current).toBe(0);
  expect(Number(result.after.eternities)).toBeGreaterThan(100);
  expect(pageErrors, "Unhandled browser errors").toEqual([]);
});
