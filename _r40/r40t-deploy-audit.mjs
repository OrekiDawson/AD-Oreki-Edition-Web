// R40-T 部署前条件审计（只读）
// 1) filelist 登记的每一项：源码在不在、部署副本在不在、内容是否一致
// 2) 源码 src/ 下所有相对 import 的目标：有没有漏登记（漏一个 = 线上 404，页面白屏）
// 3) 部署副本里有没有混进不该有的目录（_tools / _wt_head / reports / upstream / node_modules）
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const WEB = path.resolve("C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web");
const SRC = path.join(WEB, "AD-Oreki-Edition");
const SITE = path.join(WEB, "_deploy/site");
const LIST = path.join(WEB, "_deploy/filelist.txt");

const sha = b => crypto.createHash("sha256").update(b).digest("hex");
const list = fs.readFileSync(LIST, "utf8").split(/\r?\n/u).map(s => s.trim())
  .filter(s => s && !s.startsWith("#")).map(s => s.replace(/\\/gu, "/"));
const listSet = new Set(list);

// ── 1. 清单逐项 ────────────────────────────────────────────────────────
const missingSrc = [], missingSite = [], differs = [];
for (const rel of list) {
  const s = path.join(SRC, rel);
  const d = path.join(SITE, rel);
  if (!fs.existsSync(s)) { missingSrc.push(rel); continue; }
  if (!fs.existsSync(d)) { missingSite.push(rel); continue; }
  if (sha(fs.readFileSync(s)) !== sha(fs.readFileSync(d))) differs.push(rel);
}

// ── 2. 源目录里没登记的文件（= 不会被同步）──────────────────────────────
const walk = (dir, base = SRC, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out);
    else out.push(path.relative(base, p).replace(/\\/gu, "/"));
  }
  return out;
};
const srcFiles = walk(SRC).filter(f => !f.startsWith(".git"));
const unregistered = srcFiles.filter(f => !listSet.has(f));

// ── 3. 相对 import 目标是否都已登记（只看 src/ 下的 js）─────────────────
const importRe = /(?:^|\n)\s*(?:import|export)[^;\n]*?from\s+["']([^"']+)["']|(?:^|\n)\s*import\s+["']([^"']+)["']/gu;
const brokenImports = [];
let importCount = 0;
for (const rel of srcFiles) {
  if (!rel.endsWith(".js")) continue;
  const code = fs.readFileSync(path.join(SRC, rel), "utf8");
  for (const m of code.matchAll(importRe)) {
    const spec = m[1] || m[2];
    if (!spec || !spec.startsWith(".")) continue;
    importCount++;
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec));
    const abs = path.join(SRC, target);
    const why = [];
    if (!fs.existsSync(abs)) why.push("源码里也没有这个文件");
    else if (!listSet.has(target)) why.push("存在但清单未登记");
    if (!fs.existsSync(path.join(SITE, target))) why.push("部署副本里没有");
    if (why.length) brokenImports.push({ from: rel, spec, target, why: why.join("；") });
  }
}

// ── 4. 部署副本里的越界目录 ─────────────────────────────────────────────
const forbidden = ["_tools", "_wt_head", "reports", "upstream", "_research", "_backup", "_saves", "node_modules", ".git"];
const presentForbidden = forbidden.filter(d => fs.existsSync(path.join(SITE, d)));
const siteTop = fs.readdirSync(SITE);

console.log("=== 1. 清单逐项 ===");
console.log(`清单 ${list.length} 项；源码缺失 ${missingSrc.length}；部署副本缺失 ${missingSite.length}；内容不一致 ${differs.length}`);
differs.forEach(f => console.log(`  [差异] ${f}`));
missingSite.forEach(f => console.log(`  [副本缺失] ${f}`));
missingSrc.forEach(f => console.log(`  [源码缺失] ${f}`));

console.log("\n=== 2. 源码里有、清单没登记（不会被同步）===");
console.log(`共 ${unregistered.length} 个文件`);
unregistered.filter(f => f.startsWith("src/")).forEach(f => console.log(`  ${f}`));
const unregRoot = unregistered.filter(f => !f.startsWith("src/"));
console.log(`（src/ 之外 ${unregRoot.length} 个：${unregRoot.slice(0, 12).join(" / ")}${unregRoot.length > 12 ? " …" : ""}）`);

console.log("\n=== 3. 相对 import 目标核查 ===");
console.log(`扫描 ${importCount} 条相对 import，问题 ${brokenImports.length} 条`);
brokenImports.forEach(b => console.log(`  [404 风险] ${b.from}  →  ${b.spec}（${b.target}）：${b.why}`));

console.log("\n=== 4. 部署副本越界目录 ===");
console.log(`site 顶层：${siteTop.join(" / ")}`);
console.log(presentForbidden.length ? `  [存在] ${presentForbidden.join(" / ")}` : "  未发现 _tools / _wt_head / reports / upstream / node_modules / .git");

// ── 6. 部署副本自身的 import 自洽性（现状线上会不会 404）────────────────
const siteFiles = walk(SITE, SITE).filter(f => !f.startsWith(".git/"));
const siteBroken = [];
let siteImports = 0;
for (const rel of siteFiles) {
  if (!rel.endsWith(".js")) continue;
  const code = fs.readFileSync(path.join(SITE, rel), "utf8");
  for (const m of code.matchAll(importRe)) {
    const spec = m[1] || m[2];
    if (!spec || !spec.startsWith(".")) continue;
    siteImports++;
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec));
    if (!fs.existsSync(path.join(SITE, target))) siteBroken.push({ from: rel, spec, target });
  }
}
console.log("\n=== 6. 部署副本自身 import 自洽性 ===");
console.log(`扫描 ${siteImports} 条相对 import，解析不到 ${siteBroken.length} 条`);
siteBroken.forEach(b => console.log(`  [现状 404] ${b.from}  →  ${b.spec}（${b.target}）`));

// ── 5. 本轮 8 个文件的落位 ─────────────────────────────────────────────
const mine = [
  "scripts/renumber_tutorial_chapters.mjs", "scripts/validate_tutorial.mjs",
  "src/components/modals/OrekiTutorialModal.js", "src/components/tutorial/OrekiTutorialStyles.js",
  "src/components/tutorial/oreki-tutorial-markdown.js",
  "src/core/oreki-tutorial-data.json", "src/core/oreki-tutorial-data.gen.js",
  "src/core/oreki-tutorial.js",
];
console.log("\n=== 5. 本轮改动文件的部署落位 ===");
for (const rel of mine) {
  const inList = listSet.has(rel) ? "清单已登记" : "清单未登记";
  const inSite = fs.existsSync(path.join(SITE, rel)) ? "副本有" : "副本无";
  const same = fs.existsSync(path.join(SITE, rel)) &&
    fs.existsSync(path.join(SRC, rel)) &&
    sha(fs.readFileSync(path.join(SITE, rel))) === sha(fs.readFileSync(path.join(SRC, rel)));
  console.log(`  ${rel}  ${inList} / ${inSite}${same ? " / 内容一致" : " / 内容不同或缺失"}`);
}
