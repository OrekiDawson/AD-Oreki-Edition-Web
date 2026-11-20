import { test, expect } from "@playwright/test";

const INTEROP_SAVES = [
  "/savestates/original/new-save.txt",
  "/savestates/regression/legal-eternity.txt",
];

// R121-01: the Web build no longer ships a reachable STD/IAP store.  Keep old
// save fields readable, but prove on the running game that stale purchases
// cannot restore any shop multiplier or time skip.
test("Web store is removed and legacy purchase data cannot affect gameplay", async ({ page }) => {
  const pageErrors = [];
  const paymentRequests = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("request", request => {
    if (request.url().includes("antimatterdimensionspayments")) paymentRequests.push(request.url());
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#ui")).toBeVisible({ timeout: 45_000 });
  await expect.poll(() => page.evaluate(() => Boolean(window.GameUI?.initialized)), {
    timeout: 60_000,
    message: "GameUI 未初始化",
  }).toBe(true);

  const result = await page.evaluate(async () => {
    window.GameIntervals.gameLoop.stop();
    window.Modal.hideAll();

    // Simulate the worst compatibility case: a logged-in player with stale
    // IAP enabled and every historic purchase count present.
    window.Cloud.loggedIn = true;
    window.player.IAP.enabled = true;
    window.ShopPurchaseData.totalSTD = 10000;
    window.ShopPurchaseData.spentSTD = 4000;
    window.ShopPurchaseData.respecAvailable = true;
    for (const purchase of window.ShopPurchase.all) purchase.purchases = 50;

    const effects = {};
    for (const purchase of window.ShopPurchase.all) {
      effects[purchase.config.key] = {
        current: purchase.currentMult,
        next: purchase.nextMult,
        purchaseResult: await purchase.purchase(),
      };
    }
    const beforeRealTime = window.player.records.realTimePlayed;
    const skipResults = [
      window.shop.purchaseTimeSkip(),
      window.shop.purchaseLongerTimeSkip(),
    ];

    return {
      effects,
      skipResults,
      realTimeAdvancedBySkip: window.player.records.realTimePlayed - beforeRealTime,
      iapEnabled: window.ShopPurchaseData.isIAPEnabled,
      canRespec: window.ShopPurchaseData.canRespec,
      respecResult: await window.ShopPurchaseData.respecAll(),
      shopUnlocked: window.GameDatabase.tabs.find(tab => tab.key === "shop").condition(),
      restoredShopTab: window.Tabs.findRestorableTab(10),
      directShopResult: (() => {
        window.Tab.shop.show(true);
        return { tab: window.ui.view.tab, subtab: window.ui.view.subtab };
      })(),
      shopNavItems: [...document.querySelectorAll("#oreki-sidebar button")]
        .filter(element => element.textContent.includes("商店")).length,
      legacyShopNodes: document.querySelectorAll("[data-v-shop-tab], .c-modal-store-buttons").length,
      shopModalPresent: Boolean(window.Modal.shop),
      respecModalPresent: Boolean(window.Modal.respecIAP),
      paymentsObjectPresent: Boolean(window.Payments),
      ordinaryDimensionTabVisible: Boolean(window.Tab.dimensions.isAvailable),
    };
  });

  const expectedKeys = [
    "dimPurchases",
    "allDimPurchases",
    "IPPurchases",
    "replicantiPurchases",
    "EPPurchases",
    "dilatedTimePurchases",
    "RMPurchases",
    "smallTimeSkip",
    "bigTimeSkip",
    "singleCosmeticSet",
    "allCosmeticSets",
  ];
  expect(Object.keys(result.effects)).toEqual(expectedKeys);
  for (const [key, effect] of Object.entries(result.effects)) {
    expect(effect.current, `${key} 的历史购买不得恢复当前倍率`).toBe(1);
    expect(effect.next, `${key} 不得提供后续商店倍率`).toBe(1);
    expect(effect.purchaseResult, `${key} 购买入口必须 fail-closed`).toBe(false);
  }
  expect(result.skipResults).toEqual([false, false]);
  expect(result.realTimeAdvancedBySkip).toBe(0);
  expect(result.iapEnabled).toBe(false);
  expect(result.canRespec).toBe(false);
  expect(result.respecResult).toBe(false);
  expect(result.shopUnlocked).toBe(false);
  expect(result.restoredShopTab).toBeNull();
  expect(result.directShopResult.tab).toBe("dimensions");
  expect(result.shopNavItems).toBe(0);
  expect(result.legacyShopNodes).toBe(0);
  expect(result.shopModalPresent).toBe(false);
  expect(result.respecModalPresent).toBe(false);
  expect(result.paymentsObjectPresent).toBe(false);
  expect(result.ordinaryDimensionTabVisible).toBe(true);
  expect(paymentRequests).toEqual([]);

  // Persist the stale IAP fields, reload, and verify compatibility does not
  // resurrect the removed store or its effects after a real page restart.
  await page.evaluate(() => window.GameStorage.save());
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect.poll(() => page.evaluate(() => Boolean(window.GameUI?.initialized)), {
    timeout: 60_000,
    message: "重载后 GameUI 未初始化",
  }).toBe(true);
  const afterReload = await page.evaluate(() => ({
    iapEnabled: window.ShopPurchaseData.isIAPEnabled,
    multipliers: window.ShopPurchase.all.map(purchase => purchase.currentMult),
    shopUnlocked: window.GameDatabase.tabs.find(tab => tab.key === "shop").condition(),
    legacyShopNodes: document.querySelectorAll("[data-v-shop-tab], .c-modal-store-buttons").length,
  }));
  expect(afterReload.iapEnabled).toBe(false);
  expect(afterReload.multipliers).toEqual(Array(expectedKeys.length).fill(1));
  expect(afterReload.shopUnlocked).toBe(false);
  expect(afterReload.legacyShopNodes).toBe(0);
  expect(pageErrors, "Unhandled browser errors").toEqual([]);
});

test("original saves round-trip through the storeless build without schema loss", async ({ browser }) => {
  const imported = [];
  for (const path of INTEROP_SAVES) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect.poll(() => page.evaluate(() => Boolean(window.GameUI?.initialized)), {
      timeout: 60_000,
      message: "GameUI 未初始化",
    }).toBe(true);
    imported.push(await page.evaluate(async path => {
      const encoded = (await (await fetch(path)).text()).trim();
      window.GameStorage.import(encoded);
      const exported = window.GameStorage.exportModifiedSave();
      const decoded = window.GameSaveSerializer.deserialize(exported);
      const validation = window.GameStorage.checkPlayerObject(decoded);
      window.GameStorage.import(exported);
      return {
        path,
        exported,
        validation,
        iapEnabled: decoded.IAP?.enabled,
        checkoutSessionPresent: Object.hasOwn(decoded.IAP ?? {}, "checkoutSession"),
        respecIAPPresent: typeof decoded.options?.confirmations?.respecIAP === "boolean",
        antimatter: decoded.antimatter,
        reimportedIAPEnabled: window.player.IAP?.enabled,
        storeEffectCurrentMult: window.ShopPurchase.dimPurchases.currentMult,
      };
    }, path));
    await context.close();
  }

  for (const save of imported) {
    expect(save.validation, save.path).toBe("");
    expect(save.iapEnabled, save.path).toBe(false);
    expect(save.checkoutSessionPresent, save.path).toBe(true);
    expect(save.respecIAPPresent, save.path).toBe(true);
    expect(typeof save.antimatter === "string" || typeof save.antimatter === "number", save.path).toBe(true);
    expect(Number(save.antimatter), save.path).toBeGreaterThan(0);
    expect(save.reimportedIAPEnabled, save.path).toBe(false);
    expect(save.storeEffectCurrentMult, save.path).toBe(1);
  }
});

test("storeless export round-trips through the frozen upstream original", async ({ browser }) => {
  const upstreamURL = process.env.UPSTREAM_INTEROP_URL;
  test.skip(!upstreamURL && !process.env.CI, "UPSTREAM_INTEROP_URL 未提供；本地轻量运行跳过原版实例");
  expect(upstreamURL, "CI 发布门禁必须提供冻结上游原版地址").toBeTruthy();

  const modExports = [];
  for (const path of INTEROP_SAVES) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect.poll(() => page.evaluate(() => Boolean(window.GameUI?.initialized)), {
      timeout: 60_000,
      message: "GameUI 未初始化",
    }).toBe(true);
    modExports.push(await page.evaluate(async path => {
      const originalSave = (await (await fetch(path)).text()).trim();
      window.GameStorage.import(originalSave);
      return window.GameStorage.exportModifiedSave();
    }, path));
    await context.close();
  }

  const upstreamResults = [];
  for (const modExport of modExports) {
    const upstreamContext = await browser.newContext();
    const upstream = await upstreamContext.newPage();
    await upstream.goto(upstreamURL, { waitUntil: "domcontentloaded" });
    await expect.poll(() => upstream.evaluate(() => Boolean(window.GameUI?.initialized)), {
      timeout: 90_000,
      message: "原版 GameUI 未初始化",
    }).toBe(true);
    upstreamResults.push(await upstream.evaluate(modExport => {
      window.GameStorage.import(modExport);
      const exported = window.GameStorage.exportModifiedSave();
      const decoded = window.GameSaveSerializer.deserialize(exported);
      return {
        exported,
        validation: window.GameStorage.checkPlayerObject(decoded),
        iapEnabled: decoded.IAP?.enabled,
        respecIAPPresent: typeof decoded.options?.confirmations?.respecIAP === "boolean",
        antimatter: decoded.antimatter,
      };
    }, modExport));
    await upstreamContext.close();
  }
  for (const result of upstreamResults) {
    expect(result.validation).toBe("");
    expect(result.iapEnabled).toBe(false);
    expect(result.respecIAPPresent).toBe(true);
    expect(typeof result.antimatter === "string" || typeof result.antimatter === "number").toBe(true);
    expect(Number(result.antimatter)).toBeGreaterThan(0);
  }

  const finalImports = [];
  for (const upstreamResult of upstreamResults) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect.poll(() => page.evaluate(() => Boolean(window.GameUI?.initialized)), {
      timeout: 60_000,
      message: "GameUI 未初始化",
    }).toBe(true);
    finalImports.push(await page.evaluate(originalExport => {
      window.GameStorage.import(originalExport);
      return {
        validation: window.GameStorage.checkPlayerObject(window.player),
        iapEnabled: window.player.IAP?.enabled,
        storeEffectsNeutral: window.ShopPurchase.all.every(purchase => purchase.currentMult === 1),
      };
    }, upstreamResult.exported));
    await context.close();
  }
  for (const finalImport of finalImports) {
    expect(finalImport.validation).toBe("");
    expect(finalImport.iapEnabled).toBe(false);
    expect(finalImport.storeEffectsNeutral).toBe(true);
  }
});
