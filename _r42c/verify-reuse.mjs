// R42-C · 共享浏览器复用行为自证（INC-2026-1031-04 回归用例）
//
// 目的：证明修好之后的 edge-launch.mjs 满足四条：
//   1) 第一次调用：新建 1 个实例、1 个页面；
//   2) 第二次调用（同 tag）：**不新建实例、不新建页面**，命中 reuse 分支；
//   3) 复用实例的 cleanup() 只 disconnect，不 close；
//   4) 页面上有且仅有 1 个 tab（不算扩展后台页）。
//
// 运行：node _tools/_r42c/verify-reuse.mjs
// 依赖：先在 AD-Oreki-Edition 目录起静态服务（8099），或用已有服务。

import { launchBrowser, openGame, SHARED_CDP_PORT } from "../lib/edge-launch.mjs";

const TAG = "verify-reuse";
const SERVE_PORT = Number(process.env.OREKI_SERVE_PORT || 8099);
const out = { tag: TAG, sharedPort: SHARED_CDP_PORT, steps: [] };

async function pageCount(browser) {
  const pages = await browser.pages();
  const list = pages.map(p => p.url());
  // Edge 自带内置页（autofill / newtab 等），所以「总页面数 = 1」不是有效判据。
  // 真正要证明的是：**带本脚本 tag 的页面只有 1 个**，且运行 N 次不增长。
  const mine = list.filter(u => u.includes(`orekiTag=${TAG}`));
  return { total: list.length, mine: mine.length, urls: list };
}

async function once(label) {
  const { browser, cleanup, reused } = await launchBrowser({});
  const before = await pageCount(browser);
  const { page, errors } = await openGame(browser, {
    port: SERVE_PORT, tag: TAG, waitMs: 60000, reusePage: true,
  });
  const after = await pageCount(browser);
  const ok = await page.evaluate(() => {
    try { return typeof player === "object" && typeof AntimatterDimension === "function"; }
    catch { return false; }
  }).catch(() => false);
  out.steps.push({
    label,
    reusedInstance: !!reused,
    pagesBeforeOpen: before.total,
    pagesAfterOpen: after.total,
    myPages: after.mine,
    openedUrl: page.url(),
    gameReady: ok,
    errors: errors.slice(0, 3),
  });
  await cleanup();
  return out.steps[out.steps.length - 1];
}

const a = await once("first");
const b = await once("second");
const c = await once("third");

const verdict = {
  实例被复用_第2次: b.reusedInstance === true,
  实例被复用_第3次: c.reusedInstance === true,
  页面数未增长_第2次: b.pagesAfterOpen === a.pagesAfterOpen,
  页面数未增长_第3次: c.pagesAfterOpen === a.pagesAfterOpen,
  本tag页面恒为1个: a.myPages === 1 && b.myPages === 1 && c.myPages === 1,
  复用后游戏仍可读: b.gameReady === true && c.gameReady === true,
};
out.verdict = verdict;
out.pass = Object.values(verdict).every(Boolean);

console.log(JSON.stringify(out, null, 2));
process.exit(out.pass ? 0 : 1);
