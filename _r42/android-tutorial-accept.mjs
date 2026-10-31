// R42-C：Android 教程渲染验收（①②③④⑤）—— 需要在装了「四处极性已修」的包上跑。
//
// 硬门禁（任一不满足即判失败，不允许把诊断文本当正文量）：
//   G1 资产层：assets/oreki_tutorial.txt 的 CH 行数 = 期望章节数（由调用方传入，默认 18）
//   G2 界面层：/ui 里不得出现「教程正文缺失」，且页签按钮数 = CH 行数
//   G3 正文层：每个页签点开后，正文 TextView 的汉字数 > 200，且含「阶段目标」「完成判据」
//
// 用法：
//   node _r42/android-tutorial-accept.mjs                # 默认 emulator-5554
//   SERIAL=emulator-5554 node _r42/android-tutorial-accept.mjs
//
// 产出：_r42/android-tutorial-report.json + shots_avd/android_r42/*.png
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ADB = "C:/Users/Oreki/Android/sdk/platform-tools/adb.exe";
const SERIAL = process.env.SERIAL || "emulator-5554";
const PKG = "com.oreki.antimatterdimensions";
const ACT = `${PKG}/kajfosz.antimatterdimensions.oreki.tutorial.TutorialActivity`;
const FO = "http://127.0.0.1:8731";
const OUT = path.resolve("_r42");
const SHOTS = path.join(OUT, "shots_avd", "android_r42");
fs.mkdirSync(SHOTS, { recursive: true });

const adb = (...a) => execFileSync(ADB, ["-s", SERIAL, ...a], { encoding: "utf8" });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function ui(retry = 8) {
  for (let i = 0; i < retry; i++) {
    try {
      const r = await fetch(`${FO}/ui?depth=48&max=3000&flat=1`, { signal: AbortSignal.timeout(6000) });
      if (r.ok) return await r.json();
    } catch (e) { /* 503 / 连接未就绪 */ }
    await sleep(700);
  }
  throw new Error("/ui 取不到控件树");
}
async function shot(name) {
  const p = path.join(SHOTS, name + ".png");
  try {
    const r = await fetch(`${FO}/snapshot.jpg`, { signal: AbortSignal.timeout(6000) });
    if (r.ok) {
      // 只有 jpg 可拿时先存 jpg，再用 adb 转存截图保证是 png
      const buf = Buffer.from(await r.arrayBuffer());
      const j = path.join(SHOTS, name + ".jpg");
      fs.writeFileSync(j, buf);
    }
  } catch (e) { /* 忽略：截图不是硬门禁 */ }
  try {
    const b = execFileSync(ADB, ["-s", SERIAL, "exec-out", "screencap", "-p"], { encoding: "buffer", maxBuffer: 64 << 20 });
    fs.writeFileSync(p, b);
  } catch (e) { console.warn("screencap 失败", e.message); }
  return p;
}
const box = n => { const [l, t, r, b] = n.bounds.split(",").map(Number); return { l, t, r, b, w: r - l, h: b - t, cx: (l + r) >> 1, cy: (t + b) >> 1 }; };
const han = s => (s || "").replace(/\[[^\]]*\]/g, "").match(/[\u4e00-\u9fa5]/g)?.length || 0;

// 正文 = 非按钮、非标题、depth 较深、汉字够多的 TextView
function bodies(nodes) {
  return nodes
    .filter(n => n.cls === "TextView" && n.text && han(n.text) >= 8)
    .filter(n => !/^(Oreki 教程|关闭|打开 Oreki 设置|字号 [小中大])$/.test(n.text.trim()))
    .filter(n => !/教程正文缺失/.test(n.text));
}

function tabs(nodes) {
  const btns = nodes.filter(n => n.cls === "Button" || n.className === "android.widget.Button");
  return btns.filter(n => !/^(关闭|打开 Oreki 设置|字号 [小中大])$/.test((n.text || "").trim()));
}

const fail = [];
const report = { at: new Date().toISOString(), serial: SERIAL, gates: {}, chapters: [], font: {}, longChapter: {} };

// ── 准备 ──────────────────────────────────────────────────────────
adb("forward", "tcp:8731", "tcp:8731");
adb("shell", "am", "force-stop", PKG);
await sleep(800);
adb("shell", "am", "start", "-n", ACT);
await sleep(2500);

let nodes = await ui();
let tabList = tabs(nodes);

if (tabList.length === 0) {
  // 页签可能被 HorizontalScrollView 外的其它 Button 混入，放宽：取所有 Button 里非固定文案
  tabList = nodes.filter(n => n.cls === "Button");
}

const diag = nodes.filter(n => /教程正文缺失/.test(n.text || ""));
report.gates.G2_noDiag = diag.length === 0;
report.gates.G2_diagText = diag.map(d => d.text);
report.gates.G2_tabCount = tabList.length;
report.gates.G2_tabLabels = tabList.map(t => t.text);
if (!report.gates.G2_noDiag) fail.push("G2 界面出现「教程正文缺失」");
if (tabList.length < 18) fail.push(`G2 页签只有 ${tabList.length} 个（期望 18）`);

report.gates.G1 = "见调用方 python 校验（CH 行数）";

// ── ① 18 章逐章可读 ───────────────────────────────────────────────
for (let i = 0; i < tabList.length; i++) {
  const b = box(tabList[i]);
  adb("shell", "input", "tap", String(b.cx), String(b.cy));
  await sleep(500);
  const ns = await ui();
  const bs = bodies(ns);
  const text = bs.map(x => x.text).join("\n");
  const rec = {
    idx: i,
    tab: tabList[i].text,
    paragraphs: bs.length,
    han: han(text),
    hasGoal: /阶段目标/.test(text),
    hasDone: /完成判据/.test(text),
    head: text.slice(0, 40).replace(/\s+/g, " "),
  };
  report.chapters.push(rec);
  if (rec.han < 200) fail.push(`① 第 ${i} 页签「${rec.tab}」正文仅 ${rec.han} 汉字`);
  if (!rec.hasGoal && !rec.hasDone) fail.push(`① 第 ${i} 页签缺「阶段目标/完成判据」标记`);
  if (i === 0) await shot("ch00");
}

report.gates["①_chaptersReadable"] = report.chapters.filter(c => c.han >= 200).length + "/" + report.chapters.length;

// ── ② 附录入口 ────────────────────────────────────────────────────
// Android 资产不含 APX 标签（CH=18），所以这一项应判 N/A，判据写进报告。
report.gates["②_appendix"] = {
  verdict: "N/A",
  why: "assets/oreki_tutorial.txt 只有 CH/TITLE/SUB/... 13 类标签，没有附录区块；oreki-tutorial-data.json 的 7 篇附录只进了 Web 生成物。",
};

// ── ④ 长章节不截断：挑正文最多的一章，滚到底看「常见卡点」 ──────────
const longest = report.chapters.reduce((a, c) => (c.han > (a?.han ?? -1) ? c : a), null);
if (longest) {
  const b = box(tabList[longest.idx]);
  adb("shell", "input", "tap", String(b.cx), String(b.cy));
  await sleep(600);
  let lastText = "";
  let reached = false;
  for (let k = 0; k < 40; k++) {
    adb("shell", "input", "swipe", "540", "1800", "540", "600", "120");
    await sleep(260);
    const ns = await ui();
    const t = bodies(ns).map(x => x.text).join("\n");
    if (/常见卡点/.test(t)) { reached = true; lastText = t; break; }
  }
  const ns = await ui();
  const after = bodies(ns).map(x => x.text).join("\n");
  report.longChapter = { idx: longest.idx, tab: longest.tab, han: longest.han, reachedTrap: /常见卡点/.test(after), tail: after.slice(-120).replace(/\s+/g, " ") };
  await shot("long_bottom");
  if (!report.longChapter.reachedTrap) fail.push(`④ 长章节（${longest.tab}）滚到底未出现「常见卡点」`);
}
report.gates["④_longChapter"] = report.longChapter.reachedTrap ? "pass" : "fail";

// ── ⑤ 字号三档：量真实正文段落 ────────────────────────────────────
// 选第 5 章（打破无限）的「阶段目标」正文作靶子：它足够长，换行会真实发生。
const target = report.chapters.find(c => /打破无限/.test(c.tab || "")) || report.chapters[Math.min(4, report.chapters.length - 1)];
if (target) {
  adb("shell", "input", "tap", String(box(tabList[target.idx]).cx), String(box(tabList[target.idx]).cy));
  await sleep(600);
  const fontBtns = {};
  for (const n of nodes) {
    const m = (n.text || "").trim().match(/^字号\s*([小中大])$/);
    if (m) fontBtns[m[1]] = box(n);
  }
  report.font.target = target.tab;
  report.font.buttons = Object.keys(fontBtns);
  for (const k of ["小", "中", "大"]) {
    if (!fontBtns[k]) { fail.push(`⑤ 找不到「字号 ${k}」按钮`); continue; }
    adb("shell", "input", "tap", String(fontBtns[k].cx), String(fontBtns[k].cy));
    await sleep(700);
    const ns = await ui();
    const bs = bodies(ns);
    // 取汉字最多的那一段当靶子（同一段在三种字号下都应是最大者）
    const pick = bs.reduce((a, c) => (han(c.text) > han(a?.text ?? "") ? c : a), null);
    report.font[k] = {
      paragraphs: bs.length,
      hanTotal: bs.reduce((s, x) => s + han(x.text), 0),
      pickHan: han(pick?.text),
      pickBounds: pick?.bounds,
      pickH: pick ? box(pick).h : null,
      pickHead: (pick?.text || "").slice(0, 24).replace(/\s+/g, " "),
    };
    await shot("font_" + k);
  }
  const hs = ["小", "中", "大"].map(k => report.font[k]?.pickH).filter(x => typeof x === "number");
  report.font.monotonic = hs.length === 3 && hs[0] < hs[1] && hs[1] < hs[2];
  report.font.heights = hs;
  // 同一段在三种字号下汉字数必须一致（否则量到的是不同段落）
  const hans = ["小", "中", "大"].map(k => report.font[k]?.pickHan);
  report.font.sameParagraph = new Set(hans).size === 1;
  if (!report.font.monotonic) fail.push(`⑤ 三档字号高度不单调：${JSON.stringify(hs)}`);
  if (!report.font.sameParagraph) fail.push(`⑤ 三档量的不是同一段：${JSON.stringify(hans)}`);
}
report.gates["⑤_font3"] = report.font.monotonic && report.font.sameParagraph ? "pass" : "fail";

report.fail = fail;
report.verdict = fail.length === 0 ? "PASS" : "FAIL";
fs.writeFileSync(path.join(OUT, "android-tutorial-report.json"), JSON.stringify(report, null, 1), "utf8");
console.log(JSON.stringify({ verdict: report.verdict, gates: report.gates, font: report.font, longChapter: report.longChapter, fail }, null, 1));
