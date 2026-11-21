import { test, expect } from "@playwright/test";

// R113-01 P1 回归：桌面 / 平板（>900px）下通知条同样会盖住 HowToPlay 的「?」「i」悬浮按钮。
//
// 背景：R112-01 已修 ≤900px 的同类遮挡（.github/tests/notification-icon-hit.spec.mjs），
// 并明确把桌面记为「未修（有意）」（reports/R112-01/Web-P1.md §6）。R113-01 实测补全：
//   1280×800 / 1024×768 下 #notification-container 仍是 absolute / top:0 / right:0，
//   「?」「i」是 right:2rem、20×20 的悬浮按钮，4 条通知在屏时两者中心都落在通知条上；
//   通知是 pointer-events:auto，真实点击「?」只会关掉一条通知，玩法说明根本不打开，
//   与手机端缺陷同源同判据（按钮可见不可点）。
// 修复：public/stylesheets/oreki.css 的 @media (min-width: 901px) 把通知容器右边界
//   由 0 改为 right: 4.4rem（本页根字号 10px，20px 宽图标 + 20px 右边距需要让出 44px），
//   通知内容 / 条数 / 时长 / 点击关闭行为不变，≤900px 规则也不动。
//
// 本用例只验 UI 命中；冻结主循环是为避免「首次无限」等消息弹窗打断断言，不改游戏进度。

async function prepareFourToasts(page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#ui")).toBeVisible({ timeout: 45_000 });
  await expect.poll(() => page.evaluate(() => Boolean(window.GameUI?.initialized)), {
    timeout: 60_000,
    message: "GameUI 未初始化",
  }).toBe(true);
  await page.evaluate(() => {
    window.GameIntervals.gameLoop.stop();
    window.Modal.hideAll();
  });
  // 启动期通知先清空：点掉折叠汇总条让 notify 内部队列归零，再等已有通知自然消失
  await page.evaluate(() => {
    const overflow = document.querySelector("#notification-container > .o-notification--overflow");
    if (overflow) overflow.click();
  });
  await expect.poll(
    () => page.evaluate(() => document.getElementById("notification-container").children.length),
    { timeout: 20_000, message: "启动期通知未清空" },
  ).toBe(0);
  await page.evaluate(() => {
    for (let i = 0; i < 4; i++) window.GameUI.notify.success("遮挡回归通知 " + (i + 1), 120_000);
  });
  await expect.poll(
    () => page.evaluate(() => document.getElementById("notification-container").children.length),
    { timeout: 5_000, message: "测试通知未出现" },
  ).toBe(4);
  await page.waitForTimeout(800); // 等入场动画结束
}

async function expectHelpIconsClickable(page) {
  const hits = await page.evaluate(() => {
    const findButton = text => [...document.querySelectorAll(".l-help-me")]
      .find(el => [...el.childNodes].some(node =>
        node.nodeType === Node.TEXT_NODE && node.textContent.trim() === text));
    const result = {};
    for (const [key, text] of [["help", "?"], ["info", "i"]]) {
      const el = findButton(text);
      if (!el) {
        result[key] = null;
        continue;
      }
      const rect = el.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      result[key] = {
        receivesTap: Boolean(hit) && (hit === el || el.contains(hit)),
        hitClass: hit ? String(hit.className) : null,
      };
    }
    return result;
  });
  expect(hits.help, "右上角「?」按钮不存在").not.toBeNull();
  expect(hits.info, "右上角「i」按钮不存在").not.toBeNull();
  expect(hits.help.receivesTap, "「?」被 " + hits.help.hitClass + " 遮挡，点击会被通知吃掉").toBe(true);
  expect(hits.info.receivesTap, "「i」被 " + hits.info.hitClass + " 遮挡，点击会被通知吃掉").toBe(true);

  // 真实点击「?」：应打开玩法说明（H2P 页签出现），而不是关掉一条通知
  const toastsBefore = await page.evaluate(
    () => document.getElementById("notification-container").children.length,
  );
  const center = await page.evaluate(() => {
    const el = [...document.querySelectorAll(".l-help-me")].find(item =>
      [...item.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim() === "?"));
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  await page.mouse.click(center.x, center.y);
  await expect.poll(() => page.evaluate(() => Boolean(window.Modal?.h2p?.isOpen)), {
    timeout: 5_000,
    message: "点击「?」未打开玩法说明",
  }).toBe(true);
  const toastsAfter = await page.evaluate(
    () => document.getElementById("notification-container").children.length,
  );
  expect(toastsAfter, "点击「?」消耗了一条通知，说明点击仍被通知拦截").toBe(toastsBefore);
}

test.describe("desktop 1280x800", () => {
  test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false });

  test("notification toasts must not cover the floating help/info buttons on desktop", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await prepareFourToasts(page);
    await expectHelpIconsClickable(page);
    expect(pageErrors, "Unhandled browser errors").toEqual([]);
  });
});

test.describe("tablet 1024x768", () => {
  test.use({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false });

  test("notification toasts must not cover the floating help/info buttons on tablet", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await prepareFourToasts(page);
    await expectHelpIconsClickable(page);
    expect(pageErrors, "Unhandled browser errors").toEqual([]);
  });
});
