// 把 src/core/oreki-tutorial-data.json 机械转成一个 ESM 模块供浏览器直接 import。
//
// 为什么需要这一步：
//   本项目没有打包器（index.html 直接 <script type="module" src="./src/main.js">），
//   而 `import data from "./x.json" with { type: "json" }` 需要 import attributes
//   （Chrome 123+ / Safari 17.2+ / Firefox 128+），超出 src/supported-browsers.js 声明的
//   Chrome 79 / Safari 13.1 / Firefox 78 范围。用 fetch 又会让渲染变成异步，
//   而 H2P 页签的 info() 是同步返回 HTML 字符串。
//   所以这里在「提交前」做一次机械转换：JSON 仍是唯一内容源，产物只是同一份数据的 ESM 外壳。
//
// 约束：
//   1. 产物带「自动生成，请勿手改」头，任何人手改都会在校验脚本里被发现；
//   2. 生成过程不做任何语义加工（不排序、不补默认值），保证两边字节级等价；
//   3. scripts/validate_tutorial.mjs 会比对两边是否同步，CI 里能拦住「改了 JSON 忘了生成」。
//
// 用法：node scripts/gen_tutorial_module.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src", "core", "oreki-tutorial-data.json");
const OUT = path.join(ROOT, "src", "core", "oreki-tutorial-data.gen.js");

const BANNER = `// ---------------------------------------------------------------------------
// 自动生成，请勿手改。
// 源文件：src/core/oreki-tutorial-data.json（唯一内容源）
// 生成器：node scripts/gen_tutorial_module.mjs
// 校验：  node scripts/validate_tutorial.mjs（会比对本文件与 JSON 是否同步）
// ---------------------------------------------------------------------------
`;

export function buildModuleSource(jsonText) {
  const data = JSON.parse(jsonText);
  // 附录里声明了 `auto` 的条目，正文由构建期从各章字段聚合而来，不允许人工维护。
  // 目前只有 `apx_automation`（把 18 章的 `automation` 字段按章顺序拼成
  // 「哪些事永远不用你做」的总览）。这样它不可能和各章正文不一致——
  // 这是它值得存在的唯一理由。
  if (Array.isArray(data.appendices)) {
    for (const apx of data.appendices) {
      if (apx.auto === "automation") apx.body = aggregateAutomation(data.chapters);
    }
  }
  // JSON.stringify 的输出本身就是合法的 JS 对象字面量（JSON 是 JS 的子集）；
  // 这里只做一次格式化，不做任何字段加工（附录聚合是唯一例外，且已在上面写明）。
  return `${BANNER}export default ${JSON.stringify(data, null, 2)};\n`;
}

/**
 * 把各章的 `automation` 字段按章顺序聚合成一节正文。
 * 只读取已有字段，不新增任何人工内容。
 */
export function aggregateAutomation(chapters) {
  const list = Array.isArray(chapters) ? chapters : [];
  const parts = list
    .filter(chapter => typeof chapter.automation === "string" && chapter.automation.trim() !== "")
    .map(chapter => `### ${chapter.title}\n\n${chapter.automation.trim()}`);
  if (parts.length === 0) return "（本 MOD 暂无自动化说明）";
  return [
    "本附录由各章的「自动化配置」字段自动汇总，**不单独维护**——它和各章正文永远一致。",
    "按章节顺序排列，方便你确认「这件事到底要不要我手动做」。",
    "",
    ...parts,
  ].join("\n\n");
}


export function readTutorialJson() {
  return fs.readFileSync(SRC, "utf-8");
}

/** 环境变量名两端必须同名（见 docs/AGENTS_GLOBAL.md 发布门控一节） */
export const ALLOW_DRAFT_ENV = "OREKI_TUTORIAL_ALLOW_DRAFT";

/**
 * 列出所有 `draft: true` 的章节。发布门控的唯一判据。
 * @returns {{id: string, title: string}[]}
 */
export function listDraftChapters(data) {
  const chapters = Array.isArray(data?.chapters) ? data.chapters : [];
  return chapters
    .filter(chapter => chapter.draft === true)
    .map(chapter => ({ id: chapter.id, title: chapter.title }));
}

/**
 * 发布门控：默认 fail closed。
 *
 * 为什么必须有这个函数，而不是靠「记得检查」：
 * 草稿章在界面上会渲染成「本章尚未写完（草稿）」占位卡。开发期这样是合理的
 * （至少玩家知道这章存在、正在写），但如果带着草稿发布，教程就变成一份
 * 缺了终局的质量不合格文档 —— 而**没有任何人会因此报错**。这正是「静默故障」，
 * 必须由机器卡住。
 *
 * 判据只有一条：存在 draft 章 ⇒ 非零退出，除非显式 `OREKI_TUTORIAL_ALLOW_DRAFT=1`。
 * 默认严格，不默认放行。
 *
 * @returns {{ok: boolean, drafts: {id: string, title: string}[], allowed: boolean}}
 */
export function checkReleaseGate(data, env = process.env) {
  const drafts = listDraftChapters(data);
  const allowed = env[ALLOW_DRAFT_ENV] === "1";
  return { ok: drafts.length === 0 || allowed, drafts, allowed };
}

function main() {
  const raw = readTutorialJson();
  const data = JSON.parse(raw);
  const checkOnly = process.argv.slice(2).includes("--check");
  const gate = checkReleaseGate(data);

  if (checkOnly) {
    // 只检查、不写盘：供发布流程在拷贝到 _deploy/site 之前调用。
    if (!gate.ok) {
      console.error(`[gen] 发布被拒绝：还有 ${gate.drafts.length} 章是草稿（玩家会看到「尚未写完」占位卡）`);
      for (const d of gate.drafts) console.error(`  - ${d.id}  ${d.title}`);
      console.error(`[gen] 写完后再发布；确需带草稿出包时设置 ${ALLOW_DRAFT_ENV}=1（两端同名）。`);
      process.exit(1);
    }
    // 放行时必须说清放行了什么。「通过」三个字单独出现会让人误以为教程已经写完，
    // 所以这里把「是带草稿放行的」和数量都写出来 —— 日志不能比事实更乐观。
    if (gate.drafts.length === 0) {
      console.log(`[gen] 发布门控通过（草稿 0 章）`);
    } else {
      console.warn(`[gen] 发布门控被 ${ALLOW_DRAFT_ENV}=1 显式放行：将带 ${gate.drafts.length} 章草稿发布`);
      for (const d of gate.drafts) console.warn(`  - ${d.id}  ${d.title}`);
    }
    return;
  }

  const source = buildModuleSource(raw);
  fs.writeFileSync(OUT, source, "utf-8");
  console.log(`[gen] ${path.relative(ROOT, OUT)} 已生成（${data.chapters.length} 章，${source.length} 字节）`);
  if (gate.drafts.length > 0) {
    // 开发期允许生成（否则根本没法预览已完稿的章节），但必须每次都说清楚。
    console.warn(`[gen] 注意：${gate.drafts.length} 章仍是草稿，发布前请用 --check 复核：`);
    for (const d of gate.drafts) console.warn(`  - ${d.id}  ${d.title}`);
  }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
