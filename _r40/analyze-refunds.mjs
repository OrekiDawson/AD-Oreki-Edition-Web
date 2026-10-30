// R40-A · refunds 事件归类：把每条 respec 调用栈归到「哪个调用点」，并统计
// 「连续两次 respec 之间 EC 完成总数有没有变化」= 这次清零是否白费。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] || path.join(HERE, "r40a-diag.refunds.jsonl");
const lines = fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean);

// 把同一时刻（±50ms）的一批 refund 合并成一次 respec 事件
const events = [];
let cur = null;
for (const l of lines) {
  let r;
  try { r = JSON.parse(l); } catch (e) { continue; }
  if (!cur || r.at - cur.lastAt > 50) {
    cur = { at: r.at, lastAt: r.at, n: 0, ids: [], unlocked: r.unlocked, studiesLen: r.studiesLen, realities: r.realities, stack: r.stack };
    events.push(cur);
  }
  cur.lastAt = r.at;
  cur.n += 1;
  cur.ids.push(r.id);
}

const callerOf = stack => {
  const m = [...String(stack).matchAll(/at (?:\w+\.)?(\w+) \((http[^)]+)\)/g)];
  for (const x of m) {
    const url = x[2];
    if (url.includes("/probe") || url.includes("pptr")) continue;
    const f = url.replace(/^https?:\/\/[^/]+\//, "").replace(/:\d+:\d+$/, "");
    const fn = x[1];
    if (fn === "respecTimeStudies") continue;
    return `${f} :: ${fn}`;
  }
  return "unknown";
};

const byCaller = new Map();
for (const e of events) {
  const c = callerOf(e.stack);
  byCaller.set(c, (byCaller.get(c) || 0) + 1);
}

console.log(`文件: ${path.basename(file)}`);
console.log(`refund 行: ${lines.length}  合并后 respec 事件: ${events.length}`);
console.log("调用点分布:");
for (const [k, v] of [...byCaller].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);

// 相邻 respec 之间的间隔 & 「白费」判定（用 realities 变化近似：现实重置也会清零）
console.log("\n事件表 (t, 条目数, unlocked, studiesLen, realities, caller):");
let prev = null;
let wasted = 0;
for (const e of events) {
  const c = callerOf(e.stack);
  const gap = prev === null ? "-" : ((e.at - prev.at) / 1000).toFixed(2) + "s";
  if (prev && e.realities === prev.realities) wasted += 1;
  console.log(`  t=${(e.at / 1000).toFixed(1).padStart(6)}s gap=${String(gap).padStart(6)} n=${String(e.n).padStart(2)} ` +
    `unl=${String(e.unlocked).padStart(2)} sN=${String(e.studiesLen).padStart(2)} r=${e.realities} ${c}`);
  prev = e;
}
console.log(`\n其中「realities 未变」的 respec 次数: ${wasted} / ${Math.max(events.length - 1, 0)}`);
