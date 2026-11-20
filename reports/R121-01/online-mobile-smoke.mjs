import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const 基础地址 = process.env.BASE_URL || "https://oreki.net/";
const 输出目录 = fileURLToPath(new URL("./online-mobile/", import.meta.url));
mkdirSync(输出目录, { recursive: true });

const 结果 = {
  基础地址,
  开始时间: new Date().toISOString(),
  页面错误: [],
  控制台错误: [],
  网络失败: [],
  HTTP错误: [],
  导航取消请求: [],
  检查: {},
};

const 浏览器 = await chromium.launch({ headless: true });
const 上下文 = await 浏览器.newContext({
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2.625,
  isMobile: true,
  hasTouch: true,
  locale: "zh-CN",
  userAgent:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/158.0.0.0 Mobile Safari/537.36",
});
const 页面 = await 上下文.newPage();
页面.on("pageerror", 错误 => 结果.页面错误.push(String(错误?.stack || 错误)));
页面.on("console", 消息 => {
  if (消息.type() === "error") 结果.控制台错误.push(消息.text());
});
页面.on("requestfailed", 请求 => {
  const 条目 = {
    url: 请求.url(),
    error: 请求.failure()?.errorText || "未知网络错误",
  };
  if (条目.error.includes("ERR_ABORTED")) {
    结果.导航取消请求.push(条目);
  } else {
    结果.网络失败.push(条目);
  }
});
页面.on("response", 响应 => {
  if (响应.status() >= 400) {
    结果.HTTP错误.push({ url: 响应.url(), status: 响应.status() });
  }
});

const 等待游戏 = () =>
  页面.waitForFunction(
    () => window.player && window.GameSpeed && window.GameUI?.initialized === true,
    null,
    { timeout: 45_000 },
  );

const 读取速度 = () =>
  页面.evaluate(() => ({
    factor: GameSpeed.factor,
    stored: localStorage.getItem(GameSpeed.storageKey),
    dynamic: GameSpeed.isDynamic,
    label: GameSpeed.modeLabel,
  }));

try {
  const 响应 = await 页面.goto(基础地址, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  结果.检查.入口 = {
    状态: "PASS",
    http状态: 响应?.status() || null,
    最终地址: 页面.url(),
  };
  await 等待游戏();
  await 页面.waitForTimeout(2_000);

  const 新档 = await 读取速度();
  if (新档.factor !== 3000 || 新档.stored !== null || 新档.dynamic !== true) {
    throw new Error(`线上新档默认速度不符合预期：${JSON.stringify(新档)}`);
  }
  结果.检查.新档默认速度 = { 状态: "PASS", 值: 新档 };

  const 初始游戏状态 = await 页面.evaluate(() => ({
    realities: player.realities,
    isGameEnd: player.isGameEnd,
    doomed: Pelle?.isDoomed ?? null,
    tutorialActive: player.tutorialState !== undefined,
  }));
  结果.检查.新档边界 = { 状态: "PASS", 值: 初始游戏状态 };

  await 页面.evaluate(() => localStorage.setItem(GameSpeed.storageKey, "10000"));
  await 页面.reload({ waitUntil: "domcontentloaded", timeout: 45_000 });
  await 等待游戏();
  await 页面.waitForTimeout(2_000);
  const 合法持久值 = await 读取速度();
  if (合法持久值.factor !== 10000 || 合法持久值.stored !== "10000") {
    throw new Error(`线上合法倍率未保留：${JSON.stringify(合法持久值)}`);
  }
  结果.检查.合法倍率持久化 = { 状态: "PASS", 值: 合法持久值 };

  await 页面.screenshot({
    path: `${输出目录}/99-final.png`,
    fullPage: true,
  });

  if (
    结果.页面错误.length ||
    结果.控制台错误.length ||
    结果.网络失败.length ||
    结果.HTTP错误.length
  ) {
    throw new Error(
      `线上浏览器错误：${JSON.stringify({
        页面错误: 结果.页面错误,
        控制台错误: 结果.控制台错误,
        网络失败: 结果.网络失败,
        HTTP错误: 结果.HTTP错误,
      })}`,
    );
  }
  结果.结论 = "PASS";
} catch (错误) {
  结果.结论 = "FAIL";
  结果.错误 = String(错误?.stack || 错误);
  await 页面.screenshot({
    path: `${输出目录}/99-failure.png`,
    fullPage: true,
  }).catch(() => {});
} finally {
  结果.结束时间 = new Date().toISOString();
  writeFileSync(
    `${输出目录}/results.json`,
    JSON.stringify(结果, null, 2) + "\n",
  );
  await 上下文.close();
  await 浏览器.close();
}

console.log(JSON.stringify(结果, null, 2));
process.exitCode = 结果.结论 === "PASS" ? 0 : 1;
