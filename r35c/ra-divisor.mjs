// 关键修正：升级上限 memoryUpgradeCapped 用的是 0.5*req(24)（ra.js:168-175），
// 所以把 req 曲线整体 ÷k 时，升级上限也会同步下降 → 产率倍率随之变小。
// 这里求「真正能让 20 级进 180 分钟」的 k。
const T = 180 * 60, cap = 25;
const req0 = L => { if (L >= cap) return Infinity; const a = L + L * L / 10;
  return Math.floor(Math.pow(a, 5.52) * Math.pow(1.5, Math.max(0, L - 15)) * 1e6); };
const rawCPS = 4 * Math.pow(4088528 / 3e5, 2);
function evalK(k) {
  const req = L => req0(L) / k;
  let cum = 0; for (let L = 0; L < 20; L++) cum += req(L);
  const half = 0.5 * req(24);
  const nM = Math.floor(Math.log(half / 1000) / Math.log(5));
  const nC = Math.floor(Math.log(half / 5000) / Math.log(25));
  const mm = Math.pow(1.3, Math.max(0, nM)), cm = Math.pow(1.5, Math.max(0, nC));
  const prod = rawCPS * cm * mm;
  const got = 0.5 * prod * T * T;
  return { k, cum, nM, nC, mm, cm, prod, got, ratio: got / cum };
}
console.log("k      cum(20)      memUp/chunkUp  产率       180min产出   覆盖率");
for (const k of [1, 56, 100, 300, 1000, 3000, 1e4, 3e4, 1e5]) {
  const r = evalK(k);
  console.log(`${String(k).padEnd(6)} ${r.cum.toExponential(2)}   ${r.nM}/${r.nC}  ×${r.mm.toFixed(0)}/×${r.cm.toFixed(0)}  ${r.prod.toExponential(2)}/s  ${r.got.toExponential(2)}  ${(r.ratio*100).toFixed(1)}%`);
}
// 二分找 100% 覆盖的最小 k
let lo = 1, hi = 1e9;
for (let i = 0; i < 80; i++) { const mid = Math.sqrt(lo * hi); if (evalK(mid).ratio < 1) lo = mid; else hi = mid; }
console.log("\n刚好 100% 覆盖: k ≈", hi.toExponential(3), "→ 系数 1e6/k =", (1e6 / hi).toExponential(2));
console.log("k=56 时覆盖率", (evalK(56).ratio * 100).toFixed(1), "% → 仍缺", (1 / evalK(56).ratio).toFixed(2), "×");
