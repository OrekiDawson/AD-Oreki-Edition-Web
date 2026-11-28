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

test("stage speed follows real Break/Reality and manual mode stays fixed", async ({ page }) => {
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

  const speed = () => page.evaluate(() => ({
    factor: GameSpeed.factor,
    mode: GameSpeed.mode,
    managed: GameSpeed.isStageManaged,
    dynamicApi: typeof GameSpeed.setDynamic,
    modeKey: localStorage.getItem("oreki-game-speed-mode"),
    manualKey: localStorage.getItem("oreki-game-speed-manual"),
  }));
  await expect.poll(speed).toEqual({
    factor: 500,
    mode: "stage",
    managed: true,
    dynamicApi: "undefined",
    modeKey: "stage",
    manualKey: "500",
  });
  await expect(page.getByRole("button", { name: "阶段自动", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "手动固定", exact: true })).toBeVisible();
  await expect(page.locator(".c-oreki-speed__hint").filter({ hasText: "Break 前 500×" }))
    .toBeVisible();

  const stageInputs = await page.evaluate(async () => {
    const module = await import("/src/core/speed-config.js");
    return {
      preBreak: module.progressionSpeedForState(false, 0),
      postBreak: module.progressionSpeedForState(true, 0),
      postReality: module.progressionSpeedForState(true, { gt: () => true }),
    };
  });
  expect(stageInputs).toEqual({ preBreak: 500, postBreak: 70, postReality: 3000 });

  await page.locator('input[aria-label="自定义游戏速度倍率"]').fill("2400");
  await page.getByRole("button", { name: "应用倍率" }).click();
  await expect.poll(speed).toEqual({
    factor: 2400,
    mode: "manual",
    managed: false,
    dynamicApi: "undefined",
    modeKey: "manual",
    manualKey: "2400",
  });
  await expect.poll(() => page.evaluate(() => GameSpeed.factor)).toBe(2400);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#ui")).toBeVisible({ timeout: 45_000 });
  await openGameplay();
  await expect.poll(speed).toEqual({
    factor: 2400,
    mode: "manual",
    managed: false,
    dynamicApi: "undefined",
    modeKey: "manual",
    manualKey: "2400",
  });

  await page.getByRole("button", { name: /恢复默认/ }).click();
  await expect.poll(() => page.evaluate(() => ({
    factor: GameSpeed.factor,
    mode: GameSpeed.mode,
  }))).toEqual({ factor: 500, mode: "stage" });

  await page.getByRole("button", { name: "手动固定", exact: true }).click();
  await expect.poll(() => page.evaluate(() => ({
    factor: GameSpeed.factor,
    mode: GameSpeed.mode,
  }))).toEqual({ factor: 2400, mode: "manual" });
  expect(pageErrors, "Unhandled browser errors").toEqual([]);
});

test("legacy speed configuration migrates and save import does not overwrite speed mode", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("oreki-game-speed", "2400");
    localStorage.setItem("oreki-game-speed-stage-managed", "0");
    localStorage.setItem("oreki-game-speed-dynamic", "1");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#ui")).toBeVisible({ timeout: 45_000 });
  await expect.poll(() => page.evaluate(() => ({
    mode: GameSpeed.mode,
    factor: GameSpeed.factor,
    manual: localStorage.getItem("oreki-game-speed-manual"),
    oldStage: localStorage.getItem("oreki-game-speed-stage-managed"),
    oldDynamic: localStorage.getItem("oreki-game-speed-dynamic"),
  }))).toEqual({
    mode: "manual",
    factor: 2400,
    manual: "2400",
    oldStage: null,
    oldDynamic: null,
  });

  const save = await page.evaluate(() => GameStorage.exportModifiedSave());
  await page.evaluate(({ save }) => {
    GameSpeed.setStageMode();
    GameStorage.import(save);
  }, { save });
  await expect.poll(() => page.evaluate(() => ({
    mode: GameSpeed.mode,
    factor: GameSpeed.factor,
    manual: localStorage.getItem("oreki-game-speed-manual"),
  }))).toEqual({ mode: "stage", factor: 500, manual: "2400" });

  await page.evaluate(() => GameSpeed.set(1));
  await expect.poll(() => page.evaluate(() => GameSpeed.factor)).toBe(1);
  expect(pageErrors, "Unhandled browser errors").toEqual([]);
});
