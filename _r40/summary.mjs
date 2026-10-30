// R40-A · 采样摘要：按时间窗口打印关键判定，用于人工核对里程碑
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] || path.join(HERE, "r40a-diag.jsonl");
const step = Number(process.argv[3] || 10); // 每 N 条打印一行
const rows = fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map(l => {
  try { return JSON.parse(l); } catch (e) { return null; }
}).filter(Boolean);

const on = b => (b ? 1 : 0);
for (let i = 0; i < rows.length; i += step) {
  const o = rows[i];
  console.log(
    `t=${String(o.t).padStart(6)}s real=${String(o.real).padStart(8)} r=${String(o.realities).padStart(3)} ` +
    `ttMaxL=${String(o.ttMaxL).padStart(6)} ttValL=${String(o.ttValL ?? "").padStart(6)} ` +
    `unl=${String(o.ecUnl).padStart(2)} cur=${String(o.ecCur).padStart(2)} sN=${String(o.sN).padStart(2)} ` +
    `s71=${on(o.s71)} s171=${on(o.s171)} s181=${on(o.s181)} ` +
    `ec2cb=${on(o.ec2canBuy)} ec2sec=${on(o.ec2sec)} ` +
    `ecs=[${o.ecs}] ds6=${on(o.ds6)} iu25=${on(o.iu25)} pelle=${on(o.pelleUnl)} end=${on(o.gameEnd)} ` +
    `refund=${o.refundTotal}`
  );
}
// 汇总
const last = rows[rows.length - 1];
console.log("\n=== 末态 ===");
console.log(JSON.stringify(last, null, 1));
const firstDs6 = rows.find(r => r.ds6 === true);
console.log(`首次 ds6=true: ${firstDs6 ? firstDs6.t + "s (real=" + firstDs6.real + ", r=" + firstDs6.realities + ")" : "从未"}`);
const maxEc = rows.reduce((a, r) => Math.max(a, String(r.ecs).split(",").reduce((s, x) => s + Number(x), 0)), 0);
console.log(`EC 完成总数峰值: ${maxEc} / 60`);
