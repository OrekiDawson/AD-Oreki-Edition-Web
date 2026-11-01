// R50-TUT-01 教程中文化 lint
//
// 目的：把「教程界面里还剩多少拉丁字母」这件事变成可机读、可回归的数字，
// 而不是靠人肉翻 18 章。允许名单（ALLOW）只放**玩家在游戏界面上真的会看到、
// 且不可能翻译**的东西，每一条都要写理由——这份文件本身就是判据的存档。
//
// 用法：
//   node reports/_r50/_tut_lint.mjs             表格 + 断言，失败退出码 1
//   node reports/_r50/_tut_lint.mjs --json      额外把机读结果写进 reports/_r50/_tut_lint.json
//
// 扫描面：oreki-tutorial-data.json 的全部字符串值。
// 内部字段（id / stageKey / chapterId / key）不参与正文判定，但**单独统计**并打印，
// 而不是整章跳过——整章跳过会让「某章正文全英文但 id 是中文」这种情形漏网。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const JSON_PATH = path.join(ROOT, "src", "core", "oreki-tutorial-data.json");
const OUT_JSON = path.join(ROOT, "reports", "_r50", "_tut_lint.json");
const WRITE_JSON = process.argv.includes("--json");

/**
 * 允许保留的拉丁片段。匹配方式：把文本里「数字里的 e」（1e308 / 5e130）先剥掉，
 * 剩下的拉丁串按下面的正则逐条判定，命中即视为「允许」。
 *
 * 每条都要能回答：「玩家在界面上看得见它吗？看得见的东西翻掉会不会找不到？」
 * 看不见、或看得见但界面本身有中文的，一律不许进这张表。
 */
const ALLOW = [
  // —— 界面下拉框里的字面值：玩家要在下拉框里找到它 ——
  { re: /^Emoji$/u, why: "游戏内置记数法在下拉框里的名字，改了就选不到。" },
  { re: /^Blobs$/u, why: "同上，记数法下拉框里的一个名字，官方中文界面也没翻译它。" },
  // —— 产品 / 作者名：按钮标题里就有 ——
  { re: /^Oreki$/u, why: "作者名，常驻按钮「打开 Oreki 中文教程」的标题里就有，属专有名词。" },
  // —— 成就原名 ——
  { re: /^DLC$/u, why: "成就 41 的官方名称「无需 DLC」，DLC 是成就名的一部分，改了就对不上成就列表。" },
  // —— 需要玩家逐字输入的存档/导入字面值 ——
  { re: /^IEATASS$/u, why: "隐藏成就 14 的存档导入字符串，必须逐字一致才生效。", context: /导入|输入/u },
  { re: /^(?:save|tree|do|a|barrel|roll)$/u, why: "隐藏成就 15 / 37 的导入框字面值（「do a barrel roll」「save」「tree」），多一个字就不生效。", context: /导入|输入框/u },
  // —— 键盘按键名：字面值必须和键盘一致 ——
  { re: /^(?:ALT|CTRL|SHIFT|TAB|ESC|ENTER)$/u, why: "键盘按键字面名，按钮/快捷键上就是这个字，改了按不出来。" },
  // —— 附录 A 标识对照表首列：每条都紧挨中文名，正文不用 ——
  {
    re: /^(?:EC|ID|IC|IM|RM|RU|TD|DT|TP|IU|DM|DE|DU|UI|MOD|autoEC|START|SAM|SIP\d|SEP\d|STP|TTF|ACH\d|ACHNR|log10|max)$/u,
    why: "附录 A「界面英文标识与中文名对照」表的首列。18 章正文已零英文，这张表只在玩家想核对界面缩写时查，每条右侧都有中文名与用途。",
    context: /界面标识|复兴树节点标识|自动化配置键/u,
  },
];

/**
 * 掩码：先在文本上抹掉这几类「不是英文词、只是符号」的片段，再对剩余部分做拉丁字母判定。
 * 掩码 ≠ 跳过检查——每类都写清为什么它不是待翻译的英文，并且只抹掉最小范围。
 */
const MASKS = [
  { re: /`[^`]*`/gu, why: "反引号内是字面值 / 数学记号（存档字符串、ee15.955 之类），原样照抄才算数" },
  { re: /附录\s*[A-F]/gu, why: "附录编号字母，是编号不是英文词（同「第〇节」）" },
  { re: /[A-Z](?=\s*键)/gu, why: "键盘按键（「F 键」这种写法）" },
  { re: /(?:按|快捷键|键盘)\s*(?:[A-Z]\s*)+/gu, why: "键盘按键序列（「按 A」「键盘 S」「依次按 … B A」）" },
  { re: /(?:上上下下左右左右)\s*(?:[A-Z]\s*)+(?:回车)?/gu, why: "科乐美秘籍的按键序列" },
];

/** 内部字段：不参与正文判定，单独统计 */
const INTERNAL_KEYS = new Set(["id", "stageKey", "chapterId", "key"]);

/** 数值里的 e：1e308 / 5e130 / 1.8e308 / 1E40 */
const SCI = /(?<=[0-9.])[eE](?=[+-]?[0-9])/gu;
const LATIN = /[A-Za-z]/u;
const TOKEN = /[A-Za-z]+/gu;

function walk(value, pathParts, out) {
  if (Array.isArray(value)) {
    value.forEach((item, i) => walk(item, [...pathParts, `[${i}]`], out));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) walk(child, [...pathParts, key], out);
    return;
  }
  if (typeof value === "string") out.push({ pathParts, text: value });
}

function keyOf(pathParts) {
  // 取最后一个「非下标」的键名，用来判断是不是内部字段
  for (let i = pathParts.length - 1; i >= 0; i--) {
    if (!pathParts[i].startsWith("[")) return pathParts[i];
  }
  return "";
}

/** 把一段文本切成「违规片段」：先剥数值里的 e，再按 MASKS 抹掉非英文符号，剩下的拉丁串逐条判定 */
function violationsOf(text) {
  let scanned = text.replace(SCI, "");
  const masked = [];
  for (const mask of MASKS) {
    scanned = scanned.replace(mask.re, hit => {
      masked.push({ hit, why: mask.why });
      return "·".repeat([...hit].length);
    });
  }
  if (!LATIN.test(scanned)) return { hasLatin: false, bare: [], allowed: [], masked };
  const bare = [];
  const allowed = [];
  for (const token of scanned.match(TOKEN) ?? []) {
    const rule = ALLOW.find(entry => entry.re.test(token) && (!entry.context || entry.context.test(text)));
    if (rule) allowed.push({ token, why: rule.why });
    else bare.push(token);
  }
  // 单字母（V / X / N 等）也算违规：不得简单保留，必须结合上下文给中文名
  return { hasLatin: true, bare, allowed, masked };
}

function latinCharCount(text) {
  return (text.replace(SCI, "").match(/[A-Za-z]/gu) ?? []).length;
}

function main() {
  const data = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
  const chapters = Array.isArray(data.chapters) ? data.chapters : [];
  const appendices = Array.isArray(data.appendices) ? data.appendices : [];
  const other = Object.fromEntries(
    Object.entries(data).filter(([k]) => k !== "chapters" && k !== "appendices")
  );

  /** 一个「单元」= 一章 / 一个附录 / 文件级字段 */
  const units = [];
  chapters.forEach((chapter, i) => units.push({
    kind: "chapter",
    index: i,
    id: chapter.id,
    title: chapter.title,
    node: chapter,
    label: `[${i}] ${chapter.title}`,
  }));
  appendices.forEach((apx, i) => units.push({
    kind: "appendix",
    index: i,
    id: apx.id,
    title: apx.title,
    node: apx,
    label: `[附录 ${String.fromCharCode(65 + i)}] ${apx.title}`,
  }));
  units.push({ kind: "meta", index: -1, id: "meta", title: "文件级字段", node: other, label: "[文件级] note / progressHints" });

  const report = { generatedAt: new Date().toISOString(), file: "src/core/oreki-tutorial-data.json", units: [], totals: {} };
  let totalVisibleChars = 0;
  let totalLatinChars = 0;
  let totalBareFragments = 0;
  let totalInternal = 0;

  for (const unit of units) {
    const rows = [];
    walk(unit.node, [], rows);
    const fragments = [];
    const internal = [];
    let visibleChars = 0;
    let latinChars = 0;

    for (const row of rows) {
      const key = keyOf(row.pathParts);
      const where = row.pathParts.map(p => (p.startsWith("[") ? p : `.${p}`)).join("").replace(/^\./u, "");
      // 文件级 note / progressHints 是写给维护者的（里面全是仓库路径与模块名），
      // 渲染层不展示给玩家，所以整块按内部字段计，但仍然逐条列出来接受人工过目。
      if (unit.kind === "meta" || INTERNAL_KEYS.has(key)) {
        if (LATIN.test(row.text)) internal.push({ path: where, text: row.text });
        continue;
      }
      visibleChars += row.text.length;
      const result = violationsOf(row.text);
      if (!result.hasLatin) continue;
      latinChars += result.bare.join("").length;
      fragments.push({
        path: where,
        field: key,
        text: row.text,
        bare: result.bare,
        allowed: result.allowed,
        masked: result.masked,
      });
    }

    totalVisibleChars += visibleChars;
    totalLatinChars += latinChars;
    totalBareFragments += fragments.length;
    totalInternal += internal.length;

    report.units.push({
      kind: unit.kind,
      index: unit.index,
      id: unit.id,
      title: unit.title,
      visibleChars,
      latinChars,
      latinRatio: visibleChars ? Number((latinChars / visibleChars * 100).toFixed(2)) : 0,
      fragments: fragments.length,
      internalFields: internal.length,
      rows: fragments,
      internalRows: internal,
    });
  }

  report.totals = {
    units: report.units.length,
    visibleChars: totalVisibleChars,
    latinChars: totalLatinChars,
    latinRatio: Number((totalLatinChars / totalVisibleChars * 100).toFixed(2)),
    fragments: totalBareFragments,
    internalFields: totalInternal,
  };

  // ── 人读表格 ──────────────────────────────────────────────────────
  const pad = (text, width) => {
    // 中文按 2 格算，否则表格会歪
    let w = 0;
    for (const ch of text) w += /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/u.test(ch) ? 2 : 1;
    return text + " ".repeat(Math.max(0, width - w));
  };
  console.log("R50-TUT-01 教程中文化 lint");
  console.log(`源文件：src/core/oreki-tutorial-data.json`);
  console.log("");
  console.log(`${pad("单元", 44)}${pad("可见字数", 10)}${pad("拉丁字母", 10)}${pad("占比", 8)}${pad("含英文片段", 12)}内部字段`);
  console.log("-".repeat(96));
  for (const unit of report.units) {
    console.log(
      `${pad(unit.title.slice(0, 21), 44)}${pad(String(unit.visibleChars), 10)}${pad(String(unit.latinChars), 10)}` +
      `${pad(`${unit.latinRatio}%`, 8)}${pad(String(unit.fragments), 12)}${unit.internalFields}`
    );
  }
  console.log("-".repeat(96));
  const t = report.totals;
  console.log(`${pad("合计", 44)}${pad(String(t.visibleChars), 10)}${pad(String(t.latinChars), 10)}${pad(`${t.latinRatio}%`, 8)}${pad(String(t.fragments), 12)}${t.internalFields}`);

  // ── 违规明细 ──────────────────────────────────────────────────────
  const offenders = report.units.filter(u => u.fragments > 0);
  if (offenders.length) {
    console.log("");
    console.log("== 含英文的可见片段 ==");
    for (const unit of offenders) {
      console.log(`\n### ${unit.title}（${unit.fragments} 处）`);
      for (const row of unit.rows) {
        const tags = [];
        if (row.bare.length) tags.push(`违规 ${row.bare.join(" ")}`);
        if (row.allowed.length) tags.push(`白名单 ${row.allowed.map(a => a.token).join(" ")}`);
        if (row.masked.length) tags.push(`掩码 ${row.masked.map(m => m.hit).join(" ")}`);
        const text = row.text.replace(/\s+/gu, " ").slice(0, 110);
        console.log(`  - ${row.path}  [${tags.join(" | ")}]\n    ${text}`);
      }
    }
  }

  // ── 断言 ──────────────────────────────────────────────────────────
  const byId = new Map(report.units.filter(u => u.kind === "chapter").map(u => [u.id, u]));
  const assertions = [];
  const assert = (name, ok, detail) => assertions.push({ name, ok, detail });

  const chBody = id => byId.get(id);
  const chapterZeroLatin = (id, name, allowInternal = true) => {
    const unit = chBody(id);
    if (!unit) return assert(name, false, `找不到 ${id}`);
    const bad = unit.rows.filter(row => row.bare.length > 0);
    assert(name, bad.length === 0, bad.length ? `${bad.length} 处：${bad.slice(0, 3).map(b => b.path).join(", ")}` : "正文零英文");
  };

  chapterZeroLatin("ch12", "A1 第 12 章正文零英文单词");
  chapterZeroLatin("ch14", "A2 第 14 章（薇）零英文");
  chapterZeroLatin("ch07", "A3 第 7 章零英文");
  chapterZeroLatin("ch08", "A4 第 8 章零英文");

  // 裸 EC / 裸 X 专项：即使将来有人把 EC 加进白名单，这两条也会把它抓出来
  const bareIn = (id, token) => {
    const unit = byId.get(id);
    if (!unit) return false;
    return unit.rows.some(row => row.bare.includes(token) || row.text.replace(SCI, "").match(new RegExp(`(?<![A-Za-z])${token}(?![A-Za-z])`, "u")));
  };
  assert("A5 第 7 章无裸 EC", !bareIn("ch07", "EC"), bareIn("ch07", "EC") ? "ch07 出现裸 EC" : "未出现");
  assert("A6 第 8 章无裸 X", !bareIn("ch08", "X"), bareIn("ch08", "X") ? "ch08 出现裸 X" : "未出现");

  // 全篇：可见正文里不允许有非白名单拉丁串
  const globalBad = report.units
    .filter(u => u.kind === "chapter")
    .flatMap(u => u.rows.filter(r => r.bare.length > 0).map(r => `${u.id}:${r.path}`));
  assert("A7 全部 18 章正文无非白名单英文", globalBad.length === 0, globalBad.length ? `${globalBad.length} 处，例：${globalBad.slice(0, 5).join(" / ")}` : "全通过");

  console.log("");
  console.log("== 断言 ==");
  for (const item of assertions) console.log(`  ${item.ok ? "PASS" : "FAIL"}  ${item.name} — ${item.detail}`);
  report.assertions = assertions;

  if (WRITE_JSON) {
    fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
    console.log(`\n机读结果：${path.relative(ROOT, OUT_JSON)}`);
  }

  const failed = assertions.filter(a => !a.ok);
  console.log(`\n结论：${failed.length === 0 ? "全部通过" : `${failed.length} 条断言失败`}`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main();
