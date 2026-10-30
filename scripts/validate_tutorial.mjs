// 教程正文的构建期校验。
//
// 契约来源：docs/TUTORIAL_SCHEMA.md「校验规则（构建期必须全部通过）」8 条。
// 这个脚本就是那 8 条的机器实现，另外补了 2 条「防回归」检查（见 EXTRA_RULES）：
//   E1. src/core/oreki-tutorial-data.gen.js 必须与 JSON 同步（改了 JSON 忘了生成 = 网页显示旧正文）
//   E2. 空字段必须留痕（规则 8 的配套：为空的字段要在 note 里说明「为什么这里不需要」）
//
// 规则 8（译名黑名单）的权威来源是 docs/TUTORIAL_GLOSSARY.md 第四节。
// 表里每一条「官方 0 次」的写法都在这里变成一条硬断言，命中即构建失败。
// 这条规则的意义：译名错误是**不可见**错误——玩家看不出「时间定理」是错的，
// 只有对着官方字符串表逐词统计才发现官方一次都没这么写过。所以它必须机器卡，
// 不能靠人工 review。
//
// 用法：
//   node scripts/validate_tutorial.mjs            校验，失败时退出码 1
//   node scripts/validate_tutorial.mjs --stats    额外打印每章字数与条目数
//
// 退出码：0 全通过；1 有 FAIL。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildModuleSource } from "./gen_tutorial_module.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_JSON_PATH = path.join(ROOT, "src", "core", "oreki-tutorial-data.json");
const GEN_PATH = path.join(ROOT, "src", "core", "oreki-tutorial-data.gen.js");

/** 可选：把某个 .json 作为最后一个参数传入，可以用夹具验证校验规则本身（此时跳过产物同步检查） */
const argJson = process.argv.slice(2).find(arg => arg.endsWith(".json"));
const JSON_PATH = argJson ? path.resolve(process.cwd(), argJson) : DEFAULT_JSON_PATH;

/** 生成器/渲染层认识的唯一结构版本 */
const SUPPORTED_SCHEMA_VERSION = 1;

/** 规则 6：占位词与模糊表述 */
const FORBIDDEN_PHRASES = [
  "TODO", "待补", "XXX",
  "足够高", "继续推进", "必要升级", "大约差不多", "差不多够",
];

/**
 * 规则 8：禁用译名黑名单 → 正确写法。
 * **不在本文件里维护词表**——词表唯一来源是 docs/TUTORIAL_GLOSSARY.md 第四节
 * 「禁用译名（官方 0 次，一律不许用）」那张表。Android 生成器
 * `android/.../scripts/oreki_tutorial_gen.py` 解析的是同一张表。
 *
 * 为什么必须共读一个源：黑名单一旦两处硬编码就会漂移，而译名错误的后果是
 * 「玩家照着做但界面上没有这个东西」，属于不可见缺陷。漂移不会有任何报错，
 * 只会在某一端悄悄失效。
 *
 * 表格行格式：`| **时间定理** | **时间之理** | 说明 |`
 * 第一个单元格可写多个禁用写法，用 `/` 分隔（如 `艾法瑞格 / 艾法瑞`）。
 */
const GLOSSARY_PATH = path.join(ROOT, "docs", "TUTORIAL_GLOSSARY.md");

function loadForbiddenTerms() {
  if (!fs.existsSync(GLOSSARY_PATH)) {
    console.log(`FAIL [8 译名] 找不到译名表 ${path.relative(ROOT, GLOSSARY_PATH)}`);
    process.exit(1);
  }
  const lines = fs.readFileSync(GLOSSARY_PATH, "utf-8").split(/\r?\n/u);
  // 只扫第四节（从「## 四、禁用译名」到下一个二级标题）
  const start = lines.findIndex(line => /^##\s*四、禁用译名/u.test(line));
  if (start < 0) {
    console.log("FAIL [8 译名] 译名表里找不到「## 四、禁用译名」这一节");
    process.exit(1);
  }
  const terms = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s/u.test(line)) break; // 下一节，停
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map(cell => cell.trim());
    if (cells.length < 2) continue;
    if (/^-+$/u.test(cells[0].replace(/:/gu, ""))) continue; // 分隔行
    if (cells[0] === "禁止使用") continue; // 表头
    // 去掉 markdown 强调符号，允许单元格里用 / 并列多个禁用写法
    const strip = text => text.replace(/\*\*/gu, "").replace(/`/gu, "").trim();
    const correct = strip(cells[1]);
    for (const term of strip(cells[0]).split(/\s*\/\s*/u)) {
      // 单元格里常带括注说明（`灌注（特蕾莎）`），禁用词本体不含括注
      const bare = term.replace(/（[^）]*）/gu, "").trim();
      if (bare.length > 0) terms.push({ term: bare, correct, why: "见 docs/TUTORIAL_GLOSSARY.md 第四节" });
    }
  }
  if (terms.length === 0) {
    console.log("FAIL [8 译名] 从译名表第四节解析出 0 条禁用写法，表格格式可能改了");
    process.exit(1);
  }
  return terms;
}

/**
 * 规则 8 的例外语境：正文里**主动纠正**某个错译时，会把错译写在「」里
 * （例如「官方译名是『时间之理』，不是『时间定理』」）。
 * 这类句子是文档资产而不是错误，扫描前先剥掉，否则守则本身会把守则判红。
 * 只剥「明确否定 + 引号」的片段，不允许用引号把真正的误用包起来蒙混过关。
 */
const CORRECTION_SPAN = /(?:不是|禁止写作|不要写成|误译为|错译作|错误写法是)\s*[「『][^」』]{1,40}[」』]/gu;

/**
 * 规则 10 的扫描面：**不在 JSON 里、但玩家真的会看到**的中文文案。
 *
 * 为什么需要这条：教程正文已经全部搬进 JSON，但阶段卡片的 `focus` / `nextSteps`
 * 仍写在这几个模块里（是「你现在该干什么」的一句话提示，按阶段动态选）。
 * 2026-10-30 实测：`src/core/oreki-tutorial.js:108` 当时写着
 * 「把 RM 灌注给特蕾莎换时间定理」—— 一句话里两个禁用译名，而第 8 条规则
 * 只扫 JSON，完全看不见它。
 *
 * 教训：只校验「内容的正确位置」是不够的，还必须校验「内容可能出现的位置」。
 * 新增模块只要含玩家可见中文，就要加进这张表。
 */
const PLAYER_VISIBLE_SOURCES = [
  "src/core/oreki-tutorial.js",
  "src/components/tutorial/OrekiTutorial.js",
  "src/components/modals/OrekiTutorialModal.js",
  "src/core/oreki-tutorial-entry.js",
];

/** E2：空字段留痕时，note 里必须出现的对应关键词 */
const EMPTY_FIELD_HINTS = {
  buyOrder: "购买",
  challenges: "挑战",
  numbers: "数值",
  traps: "坑",
  table: "表",
};

/** 十个内容字段的期望类型 */
const CONTENT_FIELDS = {
  stageGoal: "string",
  entry: "string",
  steps: "array",
  buyOrder: "array",
  automation: "string",
  challenges: "string|null",
  numbers: "array",
  done: "string",
  next: "string",
  traps: "array",
};

const results = [];
function record(rule, ok, message) {
  results.push({ rule, ok, message });
  if (!ok) console.log(`FAIL [${rule}] ${message}`);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function expectedOk(field, value) {
  const expected = CONTENT_FIELDS[field];
  if (expected === "string|null") return typeof value === "string" || value === null;
  return typeOf(value) === expected;
}

/** 把一章里所有会展示给玩家的字符串收集起来（规则 6 的扫描面） */
function collectTexts(chapter) {
  const texts = [];
  const push = value => {
    if (typeof value === "string") texts.push(value);
  };
  for (const field of ["title", "subtitle", "stageGoal", "entry", "automation", "challenges", "done", "next", "note"]) {
    push(chapter[field]);
  }
  for (const field of ["steps", "buyOrder", "traps"]) {
    if (Array.isArray(chapter[field])) {
      for (const item of chapter[field]) {
        if (typeof item === "string") texts.push(item);
        else if (isPlainObject(item)) push(item.text);
      }
    }
  }
  if (Array.isArray(chapter.numbers)) {
    for (const num of chapter.numbers) {
      if (!isPlainObject(num)) continue;
      push(num.label);
      push(num.value);
      push(num.src);
    }
  }
  if (chapter.table && Array.isArray(chapter.table.rows)) {
    for (const row of chapter.table.rows) {
      for (const cell of row) push(cell);
    }
    for (const cell of chapter.table.head || []) push(cell);
  }
  return texts;
}

/**
 * 规则 5 的实现：解析 `numbers[].src` 里的 路径[:行] 片段。
 * 允许的写法（教程里真实出现过的三种）：
 *   src/game.js:139-143, :176
 *   src/core/player.js:985-988 + modules/break_infinity.js:1546
 *   web/_tools/_r21-300.jsonl（milestone 首次无限）
 * 每段都要能落到一个真实存在的文件；带行号时行号不得超过该文件行数。
 */
function checkSourceRef(src) {
  const problems = [];
  if (typeof src !== "string" || src.trim() === "") {
    return ["src 为空"];
  }
  const segments = src.split(/[+;]/u).map(part => part.trim()).filter(Boolean);
  if (segments.length === 0) problems.push("src 里没有可解析的片段");
  let matchedAny = false;
  for (const segment of segments) {
    // 扩展名要按「长的在前」排列，否则 .jsonl 会被 .json 先匹配掉
    const fileMatch = segment.match(/([A-Za-z0-9_@./-]+\.(?:jsonl|json|mjs|js|py|md|csv))/u);
    if (!fileMatch) {
      problems.push(`片段「${segment}」里找不到 文件名:行`);
      continue;
    }
    matchedAny = true;
    const relPath = fileMatch[1];
    // src 里允许写三种基准路径：游戏根目录（src/...）、web/ 目录（_tools/...）、
    // 以及工作区根（web/_tools/...）。逐个基准试，命中一个即可。
    const candidates = [ROOT, path.resolve(ROOT, ".."), path.resolve(ROOT, "..", "..")]
      .map(base => path.join(base, relPath));
    const absPath = candidates.find(candidate => fs.existsSync(candidate));
    if (!absPath) {
      problems.push(`文件不存在：${relPath}`);
      continue;
    }
    // 只解析「文件名之后」的数字：文件名里的日期/编号（如 _r21-300.jsonl）不是行号
    const afterFile = segment.slice(segment.indexOf(fileMatch[0]) + fileMatch[0].length);
    const numbers = (afterFile.match(/\d+/gu) || []).map(Number);
    if (numbers.length === 0) continue;
    const lineCount = fs.readFileSync(absPath, "utf-8").split(/\r?\n/u).length;
    const maxLine = Math.max(...numbers);
    // 文件名里的数字（例如 _r21-300.jsonl）会被当成行号，这里用行数兜底：
    // 只有「明显超出文件行数」才判错，避免误伤文件名中的日期/编号。
    if (maxLine > lineCount) {
      problems.push(`${relPath} 只有 ${lineCount} 行，引用了第 ${maxLine} 行`);
    }
  }
  if (!matchedAny && problems.length === 0) problems.push("src 里没有可解析的 文件名");
  return problems;
}

function main() {
  const raw = fs.readFileSync(JSON_PATH, "utf-8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    console.log(`FAIL [0] JSON 解析失败：${error.message}`);
    process.exit(1);
  }

  // ── 规则 1：schemaVersion ────────────────────────────────────────────
  record(
    "1 schemaVersion",
    data.schemaVersion === SUPPORTED_SCHEMA_VERSION,
    `schemaVersion = ${data.schemaVersion}，期望 ${SUPPORTED_SCHEMA_VERSION}`
  );

  const chapters = Array.isArray(data.chapters) ? data.chapters : [];

  // ── 规则 2：章节非空、id 唯一且连续 ─────────────────────────────────
  record("2 chapters", chapters.length > 0, "chapters 为空");
  const ids = chapters.map(chapter => chapter.id);
  const duplicated = ids.filter((id, i) => ids.indexOf(id) !== i);
  record("2 chapters", duplicated.length === 0, `id 重复：${[...new Set(duplicated)].join("、")}`);
  const expectedIds = chapters.map((_, i) => `ch${String(i).padStart(2, "0")}`);
  const orderOk = ids.length === expectedIds.length && ids.every((id, i) => id === expectedIds[i]);
  record(
    "2 chapters",
    orderOk,
    `id 不连续：实际 ${ids.join(",")}，期望 ${expectedIds.join(",")}`
  );

  // ── 规则 3：十个内容字段 + 三个必填非空字符串 ───────────────────────
  for (const chapter of chapters) {
    for (const [field, expected] of Object.entries(CONTENT_FIELDS)) {
      if (!(field in chapter)) {
        record("3 字段", false, `${chapter.id} 缺字段 ${field}`);
        continue;
      }
      record("3 字段", expectedOk(field, chapter[field]), `${chapter.id}.${field} 类型应为 ${expected}，实际 ${typeOf(chapter[field])}`);
    }
    for (const field of ["stageGoal", "entry", "done"]) {
      const value = chapter[field];
      record(
        "3 字段",
        typeof value === "string" && value.trim().length > 0,
        `${chapter.id}.${field} 必须是非空字符串`
      );
    }
  }

  // ── 规则 4：steps 非空（draft 除外） ────────────────────────────────
  for (const chapter of chapters) {
    if (chapter.draft === true) continue;
    const steps = Array.isArray(chapter.steps) ? chapter.steps : [];
    record("4 steps", steps.length > 0, `${chapter.id} 不是草稿但 steps 为空`);
    for (const [i, step] of steps.entries()) {
      record("4 steps", isPlainObject(step), `${chapter.id}.steps[${i}] 不是对象`);
      if (isPlainObject(step)) {
        record("4 steps", typeof step.text === "string" && step.text.trim() !== "", `${chapter.id}.steps[${i}].text 为空`);
        record("4 steps", typeof step.auto === "boolean", `${chapter.id}.steps[${i}].auto 必须是布尔值`);
      }
    }
  }

  // ── 规则 5：numbers[].src 可定位 ────────────────────────────────────
  for (const chapter of chapters) {
    if (!Array.isArray(chapter.numbers)) continue;
    for (const [i, num] of chapter.numbers.entries()) {
      if (!isPlainObject(num)) {
        record("5 numbers", false, `${chapter.id}.numbers[${i}] 不是对象`);
        continue;
      }
      for (const field of ["label", "value", "src"]) {
        record(
          "5 numbers",
          typeof num[field] === "string" && num[field].trim() !== "",
          `${chapter.id}.numbers[${i}].${field} 为空`
        );
      }
      const problems = checkSourceRef(num.src);
      record("5 numbers", problems.length === 0, `${chapter.id}.numbers[${i}]「${num.label}」：${problems.join("；")}`);
    }
  }

  // ── 规则 6：禁止占位词 / 模糊表述 ──────────────────────────────────
  for (const chapter of chapters) {
    const blob = collectTexts(chapter).join("\n");
    for (const phrase of FORBIDDEN_PHRASES) {
      record("6 措辞", !blob.includes(phrase), `${chapter.id} 出现禁用表述「${phrase}」`);
    }
  }

  // ── 规则 7：末日章必须写终局判据 ──────────────────────────────────
  const doomedChapters = chapters.filter(chapter => chapter.stageKey === "doomed");
  record("7 终局", doomedChapters.length > 0, "找不到 stageKey = doomed 的章节");
  for (const chapter of doomedChapters) {
    const blob = JSON.stringify(chapter);
    record(
      "7 终局",
      blob.includes("1e1000") || blob.includes("1000"),
      `${chapter.id} 没有写出终局判据（1e1000 / 1000）`
    );
  }

  // ── E1：生成产物与 JSON 同步 ───────────────────────────────────────
  if (argJson) {
    record("E1 产物同步", true, "使用夹具校验，跳过产物同步检查");
  } else if (!fs.existsSync(GEN_PATH)) {
    record("E1 产物同步", false, `缺少 ${path.relative(ROOT, GEN_PATH)}，请运行 node scripts/gen_tutorial_module.mjs`);
  } else {
    const expected = buildModuleSource(raw);
    const actual = fs.readFileSync(GEN_PATH, "utf-8");
    record(
      "E1 产物同步",
      expected === actual,
      "oreki-tutorial-data.gen.js 与 JSON 不同步，请运行 node scripts/gen_tutorial_module.mjs"
    );
  }

  // ── 规则 8：禁用译名黑名单（词表来自 docs/TUTORIAL_GLOSSARY.md 第四节）──
  const forbiddenTerms = loadForbiddenTerms();
  console.log(`译名黑名单: ${forbiddenTerms.length} 条禁用写法（解析自 docs/TUTORIAL_GLOSSARY.md）`);
  for (const chapter of chapters) {
    const raw = collectTexts(chapter).join("\n");
    const blob = raw.replace(CORRECTION_SPAN, "");
    for (const { term, correct, why } of forbiddenTerms) {
      record(
        "8 译名",
        !blob.includes(term),
        `${chapter.id} 出现禁用译名「${term}」，应写作「${correct}」（${why}）`
      );
    }
  }

  // ── E2：空字段必须留痕 ─────────────────────────────────────────────
  // 读者和维护者都无法区分「这里真的不需要」和「作者漏了」，所以只要一章里
  // 存在空字段，就必须有 note 写清为什么。机器无法判断语义，所以这条只卡
  // 「有没有解释」而不是「解释得对不对」——它挡不住敷衍，但能挡住静默留空。
  //
  // 注意不要把 `challenges: null` 当成缺陷：schema 里 null 的语义就是
  // 「本阶段没有挑战」，它本身已经是一种说明。真正会让人误解的是
  // 「整章字段留着不写、也没有 note」。
  for (const chapter of chapters) {
    if (chapter.draft === true) continue;
    const empty = [];
    for (const field of Object.keys(EMPTY_FIELD_HINTS)) {
      const value = chapter[field];
      const isEmpty = Array.isArray(value) ? value.length === 0 : value === null || value === undefined;
      if (isEmpty) empty.push(field);
    }
    if (empty.length === 0) continue;
    const note = typeof chapter.note === "string" ? chapter.note.trim() : "";
    record(
      "E2 留痕",
      note.length > 0,
      `${chapter.id} 有 ${empty.length} 个空字段（${empty.join("、")}），但没有 note 说明原因`
    );
  }

  // ── 规则 9：附录（顶层 `appendices`，与 chapters 平级）────────────────
  // 附录不是章节：它没有十字段，只有 id / title / body（body 是 Markdown）。
  // 之所以不塞进 chapters，是因为 chapters 的 id 必须连续（规则 2），
  // 而附录在语义上不属于主线进度。
  const appendices = Array.isArray(data.appendices) ? data.appendices : [];
  record("9 附录", Array.isArray(data.appendices), "缺少顶层 appendices 数组");
  record("9 附录", appendices.length > 0, "appendices 为空");
  const apxIds = appendices.map(apx => apx.id);
  record("9 附录", new Set(apxIds).size === apxIds.length, `appendices 的 id 重复：${apxIds.join(",")}`);
  for (const apx of appendices) {
    record("9 附录", typeof apx.id === "string" && /^apx_[a-z0-9_]+$/u.test(apx.id), `${apx.id} 的 id 必须形如 apx_xxx`);
    record("9 附录", typeof apx.title === "string" && apx.title.trim() !== "", `${apx.id} 缺 title`);
    // `auto` 的条目正文由构建期聚合，JSON 里不写 body
    if (apx.auto !== undefined) {
      record(
        "9 附录",
        apx.auto === "automation",
        `${apx.id} 的 auto 只支持 "automation"，实际是 ${JSON.stringify(apx.auto)}`
      );
      continue;
    }
    const body = typeof apx.body === "string" ? apx.body : "";
    record("9 附录", body.trim().length >= 200, `${apx.id} 的 body 太短（${body.trim().length} 字符），附录不是一句话能交代的`);
    const blob = body.replace(CORRECTION_SPAN, "");
    for (const phrase of FORBIDDEN_PHRASES) {
      record("9 附录", !blob.includes(phrase), `${apx.id} 出现禁用表述「${phrase}」`);
    }
    for (const { term, correct, why } of forbiddenTerms) {
      record("9 附录", !blob.includes(term), `${apx.id} 出现禁用译名「${term}」，应写作「${correct}」（${why}）`);
    }
  }

  // ── 规则 10：JSON 之外的玩家可见文案 ───────────────────────────────
  for (const relPath of PLAYER_VISIBLE_SOURCES) {
    const absPath = path.join(ROOT, relPath);
    if (!fs.existsSync(absPath)) {
      record("10 文案", false, `找不到 ${relPath}（改过文件名就同步更新 PLAYER_VISIBLE_SOURCES）`);
      continue;
    }
    const blob = fs.readFileSync(absPath, "utf-8").replace(CORRECTION_SPAN, "");
    for (const phrase of FORBIDDEN_PHRASES) {
      record("10 文案", !blob.includes(phrase), `${relPath} 出现禁用表述「${phrase}」`);
    }
    for (const { term, correct, why } of forbiddenTerms) {
      record("10 文案", !blob.includes(term), `${relPath} 出现禁用译名「${term}」，应写作「${correct}」（${why}）`);
    }
  }

  // ── E3 章号引用：所有「第 N 章」的 N 必须真实存在 ────────────────────
  // 为什么要这条：正文里保留「见第 9 章」这种写法（可读、能对应目录），代价是一旦插章，
  // 所有写死的章号都会指向别的章。重编号脚本能在插章时统一改写，但脚本本身也会出错，
  // 而「第 20 章」这种越界引用是**指向不存在的东西**，必须在构建期拦住。
  // 0 合法：ch00 的标题就是「第 0 章　开始之前」，判 0 越界会把导览章判红。
  const chapterRefPattern = /第\s*(\d+)\s*章/gu;
  const refScopes = chapters.map((chapter, i) => ({
    where: `${chapter.id}（chapters[${i}]）`,
    // title 单独是为了让报错能定位到「标题写着第 N 章」这种最典型的错位
    text: `${chapter.title || ""}\n${JSON.stringify(chapter)}`,
  }));
  for (const apx of appendices) {
    if (typeof apx.body === "string") refScopes.push({ where: `${apx.id}.body`, text: apx.body });
  }
  for (const scope of refScopes) {
    const outOfRange = [];
    for (const match of scope.text.matchAll(chapterRefPattern)) {
      const n = Number(match[1]);
      if (n < 0 || n > chapters.length - 1) outOfRange.push(match[0]);
    }
    const unique = [...new Set(outOfRange)];
    record(
      "E3 章号",
      unique.length === 0,
      `${scope.where} 引用了不存在的章号 ${unique.join("、")}（当前只有 第 0 章 ~ 第 ${chapters.length - 1} 章）`
    );
  }

  // ── 汇总 ──────────────────────────────────────────────────────────
  const failed = results.filter(item => !item.ok);
  const rules = [...new Set(results.map(item => item.rule))];
  console.log("");
  console.log("── 教程数据校验 ─────────────────────────────");
  console.log(`文件      : ${path.relative(ROOT, JSON_PATH)}`);
  console.log(`章节数    : ${chapters.length}（草稿 ${chapters.filter(c => c.draft === true).length} 章）`);
  console.log(`检查项    : ${results.length}（规则组 ${rules.length} 个）`);
  console.log(`通过 / 失败: ${results.length - failed.length} / ${failed.length}`);
  for (const rule of rules) {
    const group = results.filter(item => item.rule === rule);
    const bad = group.filter(item => !item.ok).length;
    console.log(`  ${bad === 0 ? "PASS" : "FAIL"}  ${rule}（${group.length} 项${bad ? `，${bad} 项失败` : ""}）`);
  }

  if (process.argv.includes("--stats")) {
    console.log("");
    console.log("── 每章字数 / 条目数 ────────────────────────");
    for (const chapter of chapters) {
      const chars = collectTexts(chapter).join("").replace(/\s+/gu, "").length;
      const steps = Array.isArray(chapter.steps) ? chapter.steps.length : 0;
      const autos = Array.isArray(chapter.steps) ? chapter.steps.filter(step => step.auto).length : 0;
      const nums = Array.isArray(chapter.numbers) ? chapter.numbers.length : 0;
      const traps = Array.isArray(chapter.traps) ? chapter.traps.length : 0;
      console.log(
        `  ${chapter.id} draft=${String(chapter.draft).padEnd(5)} 字=${String(chars).padStart(5)}`
        + ` steps=${steps}（auto ${autos}） numbers=${nums} traps=${traps}`
      );
    }
  }

  console.log("");
  if (failed.length > 0) {
    console.log(`校验未通过：${failed.length} 项失败`);
    process.exit(1);
  }
  console.log("校验通过");
  process.exit(0);
}

main();
