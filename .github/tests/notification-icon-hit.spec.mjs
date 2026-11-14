import { test, expect } from "@playwright/test";

// R112-01 P1 回归：窄屏右上角的通知条不得盖住 HowToPlay 的「?」「i」悬浮按钮。
//
// 现象（Playwright 1.65.0 + Chromium 158.0.8127.18 / Pixel 7，412×915，默认 10000×）：
//   #notification-container 是 absolute / top:0 / right:0 / z-index:1000，通知逐条从 y≈0 往下堆；
//   HowToPlay 的「?」（y 45~93）与「i」（y 96~144）是 right:2rem 的 48×48 悬浮按钮，
//   正好落在同一条右侧竖带里。412/360/320 三档实测：2 条通知盖住「?」，4 条连「i」一起盖住。
//   通知条是 pointer-events:auto，因此点在按钮上命中的是通知（点击 = 关闭通知），按钮收不到点击。
//   默认 10000× 新档 10 s 采样平均 2.55 条在屏，两个按钮遮挡率各 8/20 采样 = 40%。
// 修复：public/stylesheets/oreki.css 窄屏（≤900px）把通知容器右边界由 0 改为 right:8rem
//   （本页根字号 10px，按钮竖带占右侧 68px），max-width 同步改为 calc(100vw - 9rem)，
//   给右上角悬浮按钮让出右侧空档；通知内容、条数、时长与点击关闭行为不变。
//
// 本用例只验 UI 命中，不推进游戏进度、不写存档字段：冻结主循环只为避免
// 「首次无限」等消息弹窗在断言过程中出现，冻结前已经发生的游戏进度照常保留。
test("notification toasts must not cover the floating help/info buttons on mobile", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#ui")).toBeVisible({ timeout: 45_000 });
  await expect.poll(() => page.evaluate(() => Boolean(window.GameUI?.initialized)), {
    timeout: 60_000,
    message: "GameUI 未初始化",
  }).toBe(true);

  // 冻结主循环并关掉已打开的弹窗，避免新的消息弹窗打断命中测试
  await page.evaluate(() => {
    window.GameIntervals.gameLoop.stop();
    window.Modal.hideAll();
  });
  // 等启动期已触发的通知自然消失（默认 2 s + 0.5 s 离场动画），
  // 同时点掉「还有 N 条提示」折叠汇总条（它只有被点击才会清零）。
  // 这样 notify 内部 live 队列也会归零，下面才能稳定显示正好 4 条。
  await page.evaluate(() => {
    const overflow = document.querySelector("#notification-container > .o-notification--overflow");
    if (overflow) overflow.click();
  });
  await expect.poll(
    () => page.evaluate(() => document.getElementById("notification-container").children.length),
    { timeout: 20_000, message: "启动期通知未清空" },
  ).toBe(0);

  await page.evaluate(() => {
    for (let i = 0; i < 4; i++) window.GameUI.notify.success("回归测试通知 " + (i + 1), 120_000);
  });
  await expect.poll(
    () => page.evaluate(() => document.getElementById("notification-container").children.length),
    { timeout: 5_000, message: "测试通知未出现" },
  ).toBe(4);
  // 入场动画（a-notification--enter 0.5s）结束后再测命中
  await page.waitForTimeout(800);

  const hits = await page.evaluate(() => {
    const findButton = text => [...document.querySelectorAll(".l-help-me")]
      .find(el => el.textContent.trim() === text);
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

  // 真点一下「?」：应打开玩法说明，而不是关掉一条通知
  const toastsBefore = await page.evaluate(
    () => document.getElementById("notification-container").children.length,
  );
  const center = await page.evaluate(() => {
    const el = [...document.querySelectorAll(".l-help-me")].find(item => item.textContent.trim() === "?");
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  await page.touchscreen.tap(center.x, center.y);
  await expect.poll(() => page.evaluate(() => Boolean(window.Modal?.h2p?.isOpen)), {
    timeout: 5_000,
    message: "点击「?」未打开玩法说明",
  }).toBe(true);
  const toastsAfter = await page.evaluate(
    () => document.getElementById("notification-container").children.length,
  );
  expect(toastsAfter, "点击「?」消耗了一条通知，说明点击仍被通知拦截").toBe(toastsBefore);

  expect(pageErrors, "Unhandled browser errors").toEqual([]);
});
