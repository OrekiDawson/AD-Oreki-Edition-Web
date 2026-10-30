// 审查测试基础设施补丁 lib/patch-launch.mjs 的行为边界（不涉及游戏逻辑）
// 检查项：端口唯一性 / 并发启动 / close 回收 / 异常退出是否泄漏进程 / 非 Edge 二进制的兼容性
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { launchViaConnect } from "./lib/patch-launch.mjs";

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};
const note = t => console.log(`NOTE  ${t}`);

const edgeCount = () => {
  const r = spawnSync("tasklist", ["/FI", "IMAGENAME eq msedge.exe", "/FO", "CSV"], { encoding: "utf8" });
  return Math.max(0, (r.stdout.match(/msedge\.exe/g) || []).length);
};

// 1) 并发启动 3 个：端口必须互不相同，且各自连到自己的实例
const before = edgeCount();
const browsers = await Promise.all([
  launchViaConnect({ protocolTimeout: 60000 }),
  launchViaConnect({ protocolTimeout: 60000 }),
  launchViaConnect({ protocolTimeout: 60000 }),
]);
const versions = await Promise.all(browsers.map(b => b.version()));
const ports = browsers.map(b => {
  try { return new URL(b.wsEndpoint()).port; } catch (e) { return "?"; }
});
check("[P1] 并发启动 3 个浏览器全部成功", versions.length === 3 && versions.every(v => /Edg|Chrome/.test(v)),
  versions.join(" / "));
check("[P2] 三个实例连到互不相同的调试端口（无端口复用/串线）",
  new Set(ports).size === 3, ports.join(" / "));
const pages = await Promise.all(browsers.map(async (b, i) => {
  const p = await b.newPage();
  await p.goto(`data:text/html,<title>inst-${i}</title>`);
  return p.title();
}));
check("[P3] 每个实例的页面互相隔离（各自读到自己的 title）",
  pages.every((t, i) => t === `inst-${i}`), pages.join(" / "));

// 2) close 是否回收自己那一个进程
for (const b of browsers) await b.close();
await new Promise(r => setTimeout(r, 1500));
const after = edgeCount();
check("[P4] close 之后进程被回收（未持续堆积）", after <= Math.max(before, 0) + 2,
  `close 前 ${before} 个 msedge 进程 → close 后 ${after} 个`);

// 3) 异常路径：不 close 直接丢引用（模拟脚本中途抛错）
const leak = await launchViaConnect({ protocolTimeout: 60000 });
const ws = leak.wsEndpoint();
await leak.disconnect();             // 只断开，不 close —— 等价于"脚本崩了没走到 finally"
await new Promise(r => setTimeout(r, 1200));
const leaked = edgeCount();
note(`[P5-风险] 只 disconnect 不 close 时，浏览器进程仍存活（${leaked} 个 msedge）→ 脚本异常退出会留下孤儿进程；` +
  "patch-launch 只保证 close() 路径干净，没有 atexit 兜底。建议各脚本用 try/finally，或由 run-all.sh 结束后统一清理。");
check("[P5] 该风险已被确认存在（不是静默泄漏）", leaked > after, `${after} → ${leaked}`);
// 清理刚才那个孤儿
try {
  const port = new URL(ws).port;
  spawnSync("taskkill", ["/F", "/FI", `WINDOWTITLE eq *${port}*`], { stdio: "ignore" });
} catch (e) { /* ignore */ }

// 4) CI / 非 Windows 兼容性（静态判断，不执行）
const src = fs.readFileSync("./lib/patch-launch.mjs", "utf8");
const usesTaskkill = /taskkill/.test(src);
const hardcodedEdge = /C:\/Program Files \(x86\)\/Microsoft\/Edge/.test(src);
const alwaysHeadlessNew = /--headless=new/.test(src) && !/headless:\s*"shell"/.test(src);
note(`[P6-CI] 该补丁依赖 Windows 专有命令 taskkill（${usesTaskkill}）与硬编码 Edge 路径（${hardcodedEdge}），` +
  `且无条件传 --headless=new（不含 --headless=shell 分支）→ 在 Linux/macOS CI 或换用 chrome-headless-shell 时不适用，需要平台分支。`);
check("[P6] 已确认补丁不是跨平台通用实现（仅本机 Windows 环境可用）", usesTaskkill && hardcodedEdge,
  `taskkill=${usesTaskkill} 硬编码路径=${hardcodedEdge}`);

// 5) 端口占用冲突场景：占住端口后启动，是否会误连到别的实例
note("[P7-风险] 端口取 9500+random(200)，只在单进程内自增；**跨进程不协商**。" +
  "若两台测试进程同时启动，极小概率取到同一端口，后启动者会 connect 到先启动者的浏览器（串线）。" +
  "本机串行跑测试时不会触发；并行跑（如 CI 分片）需要改成 OS 分配空闲端口。");

const pass = results.filter(r => r.ok).length;
console.log(`\n==== 结果：${pass} 通过 / ${results.length - pass} 失败 ====`);
process.exit(pass === results.length ? 0 : 1);
