// R40-A · 只读检查 R39 长跑末态（对照基线，不修改任何 R39 文件）
import fs from "node:fs";
const f = process.argv[2];
const rows = fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map(l => {
  try { return JSON.parse(l); } catch (e) { return null; }
}).filter(Boolean);
console.log(`行数 ${rows.length}`);
const show = o => {
  const keys = ["t", "realities", "ds6", "iu25", "pelleUnl", "gameEnd", "epKL", "hold", "Vunl", "laiTier", "glyphN", "endState", "sprint"];
  console.log(keys.map(k => `${k}=${JSON.stringify(o[k])}`).join(" "));
};
console.log("--- 每 60 行 ---");
for (let i = 0; i < rows.length; i += 60) show(rows[i]);
console.log("--- 末 3 条 ---");
rows.slice(-3).forEach(show);
