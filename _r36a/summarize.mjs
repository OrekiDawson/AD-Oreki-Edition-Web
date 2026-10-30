// R36-A 汇总统计：把两份原始 JSONL 的关键指标算出来，供报告引用。
import fs from "node:fs";
import path from "node:path";

for (const f of ["_r36a-ec9.jsonl", "_r36a-fix-verify.jsonl"]) {
  const p = path.join(process.argv[2], f);
  const rows = fs.readFileSync(p, "utf8").trim().split("\n").map(l => JSON.parse(l));
  console.log("=== " + f + " ===");
  console.log("样本数=" + rows.length + "  跨度=" + rows[0].t + " → " + rows[rows.length - 1].t + " s");
  const vals = k => rows.map(r => r[k]).filter(v => typeof v === "number" && isFinite(v));
  const mx = k => { const a = vals(k); return a.length ? Math.max(...a) : null; };
  const med = a => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
  console.log("max infPowerL      = " + mx("infPowerL"));
  console.log("max ecReqCur9L     = " + mx("ecReqCur9L"));
  console.log("max ecReqTot9L     = " + mx("ecReqTot9L"));
  console.log("max ecReqCached9L  = " + mx("ecReqCached9L"));
  console.log("max epL            = " + mx("epL"));
  console.log("max dtL            = " + mx("dtL"));
  const id1 = rows.map(r => (r.idAmtL && typeof r.idAmtL[0] === "number" ? r.idAmtL[0] : null)).filter(v => v !== null);
  console.log("max idAmtL[0]      = " + (id1.length ? Math.max(...id1) : null));
  const dc = vals("sinceCrunchSec");
  console.log("sinceCrunchSec  中位=" + med(dc) + " 最小=" + Math.min(...dc) + " (单位 s)");
  const pk = vals("peakInfPowerL");
  console.log("peakInfPowerL   中位=" + med(pk) + " 最大=" + Math.max(...pk));
  // EC 链首次完成
  const first = i => { const r = rows.find(x => x.ecDone && x.ecDone[i] >= 1); return r ? r.t : null; };
  console.log("EC 首次完成 t: " + [1,2,3,4,5,6,7,8,9,10,11,12].map(i => "EC" + i + "=" + first(i-1)).join(" "));
  const last = rows[rows.length - 1];
  console.log("末态: realities=" + last.realities + " ecUnlocked=" + last.ecUnlocked
    + " ecDone=" + JSON.stringify(last.ecDone) + " maxDTL=" + last.maxDTL
    + " dilationUnlocked=" + last.dilationUnlocked + " dtStudies=" + last.dilationStudies);
  console.log("");
}
