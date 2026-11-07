// R94：教程渲染兼容性定向测试（Web）
// 目标：附录正文（Markdown 子集）必须渲染成 HTML，玩家永远看不到 `|---|`、`**`、反引号。
// 用例覆盖：普通表格、多列表格、长文本、特殊符号、制表符、空单元格、移动端换行、转义。
//
// 为什么不直接 import：本仓库没有 package.json / 打包器，src 下是浏览器 ESM 文件；
// 现有夹具（如 test-r93-tickspeed-order.mjs）统一用「读源码 + 求值」的方式测试生产代码，
// 这里沿用同一模式，保证测到的是真实 renderTutorialMarkdown，而不是复制的逻辑。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const mdSrc = read("src/components/tutorial/oreki-tutorial-markdown.js")
  .replace(/^export\s+/gmu, "");
const factory = new Function(mdSrc + "\nreturn renderTutorialMarkdown;");
const renderTutorialMarkdown = factory();

const data = JSON.parse(read("src/core/oreki-tutorial-data.json"));

let pass = 0;
const fails = [];
function check(name, ok, detail = "") {
  if (ok) { pass++; console.log(`PASS ${name}${detail ? "  — " + detail : ""}`); }
  else { fails.push(name); console.log(`FAIL ${name}${detail ? "  — " + detail : ""}`); }
}

// --- 1. 普通 3 列表格 ---
const table = "| 写法 | 例子 | 读法 |\n|---|---|---|\n| 科学 | `1.23e45` | 1.23 乘 10 的 45 次方 |\n| 对数 | `e45.09` | 10 的 45.09 次方 |";
const html = renderTutorialMarkdown(table);
check("普通表格渲染为 <table>", html.includes("<table") && html.includes("</table>"));
check("表格有 3 个表头单元格", (html.match(/<th>/g) || []).length === 3, `th=${(html.match(/<th>/g) || []).length}`);
check("表格数据行共 6 个 <td>", (html.match(/<td>/g) || []).length === 6, `td=${(html.match(/<td>/g) || []).length}`);
check("不残留分隔行 |---|", !html.includes("|---"));
check("单元格内行内代码被渲染", html.includes("<code>1.23e45</code>"));

// --- 2. 多列表格 + 空单元格 ---
const wide = "| a | b | c | d |\n|---|---|---|---|\n| 1 |  | 3 |  |";
const wideHtml = renderTutorialMarkdown(wide);
check("4 列表格保留 4 个表头", (wideHtml.match(/<th>/g) || []).length === 4);
check("空单元格不丢列（仍 4 个 td）", (wideHtml.match(/<td>/g) || []).length === 4);

// --- 3. 粗体 / 转义 / 特殊符号 ---
const inlineMd = "**重点** 与 `<script>` 以及 a|b 文本";
const inlineHtml = renderTutorialMarkdown(inlineMd);
check("**粗体** 渲染为 <strong>", inlineHtml.includes("<strong>重点</strong>"));
check("尖括号被转义（不允许注入）", inlineHtml.includes("&lt;script&gt;") && !inlineHtml.includes("<script>"));
check("段落里的半角竖线原样保留（不当表格）", inlineHtml.includes("a|b"));

// --- 4. 标题 / 列表 / 分隔线 ---
const blocks = "## 大标题\n### 小标题\n\n- 项目一\n- 项目二\n\n1. 第一\n2. 第二\n\n---";
const blockHtml = renderTutorialMarkdown(blocks);
check("## 渲染为 <h2>", blockHtml.includes("<h2>大标题</h2>"));
check("### 渲染为 <h3>", blockHtml.includes("<h3>小标题</h3>"));
check("无序列表渲染为 <ul>", blockHtml.includes("<ul") && (blockHtml.match(/<li>/g) || []).length >= 4);
check("有序列表渲染为 <ol>", blockHtml.includes("<ol"));
check("不残留行首 # 标记", !/(^|\n)#{2,}\s/u.test(blockHtml));

// --- 5. 制表符与长文本 ---
const longText = "很长的说明".repeat(80) + "\t带制表符";
const longHtml = renderTutorialMarkdown(longText);
check("长文本单段渲染（1 个 <p>）", (longHtml.match(/<p/g) || []).length === 1);
check("制表符不破坏结构（仍在同一段里）", longHtml.includes("带制表符"));

// --- 6. 真实附录内容全量渲染 ---
const appendices = data.appendices || [];
check("存在附录数据", appendices.length >= 7, `count=${appendices.length}`);
const rawLeak = [];
let tableAppendices = 0;
for (const ap of appendices) {
  const h = renderTutorialMarkdown(ap.body || "");
  if (h.includes("|---") || h.includes("**") || h.includes("`")) rawLeak.push(ap.title);
  if ((ap.body || "").includes("|---")) tableAppendices += 1;
}
check("全部附录渲染后不残留 |--- / ** / 反引号", rawLeak.length === 0, rawLeak.join(","));
check("含表格的附录都被渲染成 <table>", tableAppendices > 0, `含表格附录=${tableAppendices}`);

// --- 7. 附录 C 专项（R94 修正） ---
const appC = appendices.find(a => (a.title || "").includes("记数法"));
check("附录 C 存在", !!appC);
const appCHtml = renderTutorialMarkdown(appC ? appC.body : "");
check("附录 C 表格被渲染为 <table>", appCHtml.includes("<table"));
check("附录 C 两层指数示例以 <code> 呈现", appCHtml.includes("<code>1.23e1.00e9</code>"));

console.log(`\n教程渲染兼容性测试（Web）：${pass} 项通过，失败 ${fails.length} 项`);
if (fails.length) { fails.forEach(f => console.log("  FAIL", f)); process.exit(1); }
console.log("  全部通过");