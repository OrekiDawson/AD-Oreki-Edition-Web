/**
 * R36 · notify.js 通知洪水治理 · 可复现单元测试（R37 上限 3→4）
 *
 * 目的：用**确定性的**单元测试证明三条行为，而不是靠肉眼看动画：
 *   1) 任意高频调用下，同时可见的普通通知条恒 ≤ MAX_VISIBLE(4)；
 *   2) 同一文本重复 → 合并为一条并显示 ×N，**不**新增元素；
 *   3) 高优先级事件（现实/永恒/打击）在满员时**挤掉**低优先级，
 *      低优先级事件在满员时**折叠**进「还有 N 条」汇总条。
 *
 * 运行（不需要浏览器、不需要构建）：
 *   node web/_tools/_r36_notify_test.mjs
 * 退出码 0 = 全部通过；非 0 = 失败（附具体失败项）。
 *
 * 实现说明：notify.js 内部维护模块级 `live` 队列，每个用例用
 * **独立的模块实例**（import URL 加 `?v=N` 查询串）拿到干净状态，
 * 避免用例之间互相污染。
 *
 * 背景：R35 实测通知峰值 72 条、遮挡 143% 视口，根因是原版 notify.js
 * 直接 appendChild，无队列 / 无上限 / 无去重。
 */

import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NOTIFY_PATH = path.resolve(HERE, "..", "AD-Oreki-Edition", "src", "core", "notify.js");

/* ---------------- 极简 DOM mock ---------------- */
class MockClassList {
  constructor() {
    this.set = new Set();
  }

  add(...names) {
    for (const n of names) this.set.add(n);
  }

  remove(...names) {
    for (const n of names) this.set.delete(n);
  }

  contains(name) {
    return this.set.has(name);
  }
}

class MockElement {
  constructor(tag) {
    this.tagName = tag;
    this.classList = new MockClassList();
    this.children = [];
    this.parentNode = null;
    this.textContent = "";
    this.offsetWidth = 100;
    this._listeners = {};
    this.onclick = null;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  insertBefore(child, ref) {
    child.parentNode = this;
    const index = ref ? this.children.indexOf(ref) : -1;
    if (index === -1) this.children.push(child);
    else this.children.splice(index, 0, child);
    return child;
  }

  get firstChild() {
    return this.children.length ? this.children[0] : null;
  }

  remove() {
    if (!this.parentNode) return;
    const siblings = this.parentNode.children;
    const index = siblings.indexOf(this);
    if (index !== -1) siblings.splice(index, 1);
    this.parentNode = null;
  }

  cloneNode() {
    const copy = new MockElement(this.tagName);
    for (const name of this.classList.set) copy.classList.add(name);
    copy.textContent = this.textContent;
    return copy;
  }

  addEventListener(type, fn) {
    (this._listeners[type] ||= []).push(fn);
  }

  click() {
    for (const fn of this._listeners.click || []) fn();
  }
}

let container = new MockElement("div");
globalThis.document = {
  createElement: tag => new MockElement(tag),
  getElementById: id => (id === "notification-container" ? container : null)
};
globalThis.GameUI = { initialized: true };

let instanceCounter = 0;
/** 拿一个全新的 notify 模块实例（干净的 live 队列） */
async function freshNotify() {
  container = new MockElement("div");
  const url = pathToFileURL(NOTIFY_PATH).href + `?v=${++instanceCounter}`;
  const mod = await import(url);
  return mod.notify;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const visible = () => container.children.filter(el => !el.classList.contains("o-notification--overflow"));
const overflowEl = () => container.children.find(el => el.classList.contains("o-notification--overflow"));

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
  } catch (e) {
    failures++;
    console.log(`  [FAIL] ${name}\n         ${e.message}`);
  }
}

/* ---------------- 用例 1：洪水上限 ---------------- */
console.log("\n[用例 1] 高频洪水下可见条数恒 ≤ 4");
{
  const notify = await freshNotify();
  for (let i = 0; i < 200; i++) notify.info(`洪水测试 ${i}`);
  check("200 条 info 之后可见条数 ≤ 4", () => {
    assert.ok(visible().length <= 4, `可见 ${visible().length} 条，超过 4`);
  });
  check("汇总条存在且计数 = 196（200 − 4）", () => {
    const el = overflowEl();
    assert.ok(el, "汇总条未生成");
    assert.equal(el.textContent, "还有 196 条提示", `实际: ${el.textContent}`);
  });
  console.log(`         可见=${visible().length} 汇总条="${overflowEl()?.textContent}"`);
}

/* ---------------- 用例 2：同文合并 ---------------- */
console.log("\n[用例 2] 同文重复合并为一条并显示 ×N");
{
  const notify = await freshNotify();
  notify.info("同一条提示");
  notify.info("同一条提示");
  notify.info("同一条提示");
  check("三条相同文本只产生 1 个元素", () => {
    assert.equal(visible().length, 1, `可见 ${visible().length} 个元素`);
  });
  check("文本带 ×3 计数", () => {
    assert.equal(visible()[0].textContent, "同一条提示 ×3", `实际: ${visible()[0].textContent}`);
  });
  check("没有折叠溢出（未满员）", () => {
    assert.ok(!overflowEl(), "不该产生汇总条");
  });
}

/* ---------------- 用例 3：优先级挤占 ---------------- */
console.log("\n[用例 3] 高优先级事件挤掉低优先级，低优先级折叠");
{
  const notify = await freshNotify();
  notify.info("低优先级 A");
  notify.info("低优先级 B");
  notify.info("低优先级 C");
  notify.info("低优先级 D");
  const beforeHigh = visible().map(el => el.textContent);
  check("满员前有 4 条低优先级", () => {
    assert.equal(beforeHigh.length, 4, `实际 ${beforeHigh.length}`);
  });
  notify.reality("现实达成");
  check("现实通知出现后可见仍 ≤ 4", () => {
    assert.ok(visible().length <= 4, `可见 ${visible().length} 条`);
  });
  check("现实通知在屏", () => {
    assert.ok(visible().some(el => el.textContent === "现实达成"), "现实通知不在屏");
  });
  check("至少一条低优先级被挤掉", () => {
    const now = visible().map(el => el.textContent);
    const survived = beforeHigh.filter(t => now.includes(t));
    assert.ok(survived.length < 4, `低优先级一条都没被挤掉: ${survived}`);
  });
  console.log(`         挤占前=${JSON.stringify(beforeHigh)} 挤占后=${JSON.stringify(visible().map(el => el.textContent))}`);
}

/* ---------------- 用例 4：汇总条点击清零 ---------------- */
console.log("\n[用例 4] 点击汇总条清零折叠计数");
{
  const notify = await freshNotify();
  for (let i = 0; i < 10; i++) notify.info(`折叠测试 ${i}`);
  const ov = overflowEl();
  check("汇总条存在", () => assert.ok(ov));
  check("汇总条计数 = 6（10 − 4）", () => {
    assert.equal(ov.textContent, "还有 6 条提示", `实际: ${ov.textContent}`);
  });
  ov.click();
  check("点击后汇总条移除", () => {
    assert.ok(!overflowEl(), "汇总条未移除");
  });
  check("点击后可见条数 ≤ 4", () => {
    assert.ok(visible().length <= 4, `可见 ${visible().length} 条`);
  });
}

/* ---------------- 用例 5：点击单条通知可关闭 ---------------- */
console.log("\n[用例 5] 点击单条通知关闭它");
{
  const notify = await freshNotify();
  notify.info("待关闭");
  check("点击后进入离场状态", () => {
    visible()[0].onclick();
    assert.ok(visible()[0].classList.contains("a-notification--leave"), "未进入离场状态");
  });
}

/* ---------------- 用例 6：GameUI 未就绪时不丢失 ---------------- */
console.log("\n[用例 6] GameUI 未就绪时延迟重试而不是丢弃");
{
  globalThis.GameUI = { initialized: false };
  const notify = await freshNotify();
  notify.info("延迟提示");
  await sleep(700);
  globalThis.GameUI = { initialized: true };
  await sleep(700);
  check("延迟后消息最终送达", () => {
    assert.ok(visible().some(el => el.textContent === "延迟提示"), "消息丢失");
  });
}

/* ---------------- 用例 7：折叠不吞掉高优先级事件 ---------------- */
console.log("\n[用例 7] 满员 + 折叠状态下，高优先级事件仍能上屏");
{
  const notify = await freshNotify();
  for (let i = 0; i < 50; i++) notify.info(`刷屏 ${i}`);
  notify.eternity("永恒达成");
  notify.strike("打击降临");
  check("永恒通知在屏", () => {
    assert.ok(visible().some(el => el.textContent === "永恒达成"), "永恒通知不在屏");
  });
  check("打击通知在屏", () => {
    assert.ok(visible().some(el => el.textContent === "打击降临"), "打击通知不在屏");
  });
  check("可见条数仍 ≤ 4", () => {
    assert.ok(visible().length <= 4, `可见 ${visible().length} 条`);
  });
  console.log(`         最终可见=${JSON.stringify(visible().map(el => el.textContent))}`);
}

console.log(`\n结果：${failures === 0 ? "全部通过" : `${failures} 项失败`}`);
process.exit(failures === 0 ? 0 : 1);
