import { test, expect } from "@playwright/test";

// R112-01-W2 回归：现代侧栏货币的「最新资源」档必须随真实解锁刷新，而不是只在刷新页面后正确。
//
// 现象（Playwright 1.65.0 + Chromium 158，Pixel 7 412×915，全新浏览器上下文、默认 10000×）：
//   新档侧栏货币固定显示「反物质」；默认档（player.options.sidebarResourceID === 0，
//   选项→视觉效果里写作「侧栏（现代 UI）: 最新资源」）在首次无限真实结算后
//   仍停在反物质，-- 而重新加载页面（组件重新挂载）后立刻变成「无限点数」。
// 根因：ModernSidebarCurrency 的 resource computed 直接读 player 解锁状态（非 Vue 响应式），
//   且组件在 created 阶段先调用过一次 update()（core/ui.js 全局 mixin），该次求值发生在
//   $recompute 依赖挂上之前；此后 sidebarID 恒为 0 不再变化，computed 永久命中首次缓存。
// 修复：update() 每帧把「最新可用资源 id」写入响应式字段 defaultResourceID，computed 只读该字段。
//
// 本用例只读状态与 DOM 文本，不写存档字段；首次无限由默认 10000× 的真实游玩自然达成。
test("sidebar latest-resource readout follows real unlocks without a reload", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#ui")).toBeVisible({ timeout: 45_000 });
  await expect.poll(() => page.evaluate(() => Boolean(window.GameUI?.initialized)), {
    timeout: 60_000,
    message: "GameUI 未初始化",
  }).toBe(true);

  const read = () => page.evaluate(() => {
    const vue = document.querySelector(".c-sidebar-resource")?.__vue__ ?? null;
    const available = window.GameDatabase.sidebarResources
      .filter(entry => entry.isAvailable())
      .map(entry => entry.id);
    const latestAvailableId = available.length ? Math.max(...available) : 0;
    const expected = window.GameDatabase.sidebarResources.find(entry => entry.id === latestAvailableId);
    return {
      sidebarID: vue ? vue.sidebarID : null,
      resolvedId: vue ? vue.resource.id : null,
      domName: document.querySelector(".c-sidebar-resource__name")?.textContent?.trim() ?? null,
      latestAvailableId,
      expectedName: expected ? (expected.resourceName ?? expected.optionName) : null,
      infinityUnlocked: window.PlayerProgress.infinityUnlocked(),
    };
  });

  const initial = await read();
  expect(initial.sidebarID, "新档侧栏默认应为「最新资源」档（sidebarResourceID===0）").toBe(0);
  expect(initial.resolvedId, "新档侧栏应显示当前最新可用资源").toBe(initial.latestAvailableId);
  expect(initial.domName).toBe(initial.expectedName);

  // 默认 10000× 新档真实游玩：首次无限在数秒内自然结算，不需要注入任何存档/时间。
  await expect.poll(() => page.evaluate(() => window.PlayerProgress.infinityUnlocked()), {
    timeout: 90_000,
    message: "首次无限未在窗口内达成",
  }).toBe(true);

  await expect.poll(async () => (await read()).latestAvailableId, {
    timeout: 5_000,
    message: "无限点数未解锁，无法验证侧栏刷新",
  }).toBeGreaterThanOrEqual(3);

  // 核心断言：解锁无限点数后，未加载存档 / 未刷新页面，侧栏「最新资源」也必须切到无限点数。
  await expect.poll(async () => (await read()).resolvedId, {
    timeout: 10_000,
    message: "解锁无限点数后侧栏仍停在旧资源（「最新资源」没有跟随真实解锁刷新）",
  }).toBe(3);
  const afterUnlock = await read();
  expect(afterUnlock.domName, "侧栏资源名称应与解析出的资源一致").toBe(afterUnlock.expectedName);
  expect(afterUnlock.domName).toBe("无限点数");

  expect(pageErrors, "Unhandled browser errors").toEqual([]);
});
