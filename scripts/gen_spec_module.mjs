// 把 shared/spec 下的策略/模型 JSON 机械转成 ESM 模块，供浏览器直接 import。
//
// 为什么需要这一步（与 gen_tutorial_module.mjs 同因）：
//   本项目没有打包器（index.html 直接 <script type="module" src="./src/main.js">），
//   `import data from "./x.json" with { type: "json" }` 需要 import attributes
//   （Chrome 123+），超出 src/supported-browsers.js 声明的浏览器范围。
//   所以「提交前」做一次机械转换：JSON 仍是唯一内容源，产物只是同一份数据的 ESM 外壳。
//
// 约束：
//   1. 产物带「自动生成，请勿手改」头；
//   2. 生成过程不做任何语义加工（不排序、不补默认值、不改字段名），保证两边数据等价；
//   3. `--check` 只比对、不写入，供提交前的流水线拦住「改了 JSON 忘了生成」。
//
// 用法：
//   node scripts/gen_spec_module.mjs          # 生成 / 覆盖
//   node scripts/gen_spec_module.mjs --check  # 只校验是否同步，不同步则 exit 1

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * 规格文件登记表。新增一份规格时只在这里加一行，
 * 解释器里用 `import spec from "./<name>.gen.js"` 即可。
 * 注意：这些 JSON 由 team-lead 维护，本脚本只读。
 */
export const SPECS = [
  { src: "src/core/oreki-smart-strategy.json", out: "src/core/oreki-smart-strategy.gen.js" },
  { src: "src/core/oreki-route-model.json", out: "src/core/oreki-route-model.gen.js" },
];

const BANNER = `// ---------------------------------------------------------------------------
// 自动生成，请勿手改。
// 源文件：{SRC}（唯一内容源，由 team-lead 维护）
// 生成器：node scripts/gen_spec_module.mjs
// 校验：  node scripts/gen_spec_module.mjs --check
// ---------------------------------------------------------------------------
`;

/**
 * 把一个 JSON 文本变成 ESM 源码。
 * 只做 `JSON.parse` → `JSON.stringify(…, 2)`，不改变任何键值（顺序、类型都原样保留）。
 */
export function buildModuleSource(jsonText, srcLabel) {
  const data = JSON.parse(jsonText);
  const body = JSON.stringify(data, null, 2);
  return `${BANNER.replace("{SRC}", srcLabel)}\nconst data = ${body};\n\nexport default data;\n`;
}

function main() {
  const checkOnly = process.argv.includes("--check");
  let bad = 0;
  for (const spec of SPECS) {
    const srcPath = path.join(ROOT, spec.src);
    const outPath = path.join(ROOT, spec.out);
    if (!fs.existsSync(srcPath)) {
      console.error(`[skip] 源文件不存在：${spec.src}`);
      bad++;
      continue;
    }
    const wanted = buildModuleSource(fs.readFileSync(srcPath, "utf8"), spec.src);
    const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, "utf8") : null;
    if (current === wanted) {
      console.log(`[ok]   ${spec.out}`);
      continue;
    }
    if (checkOnly) {
      console.error(`[diff] ${spec.out} 与 ${spec.src} 不同步，请运行 node scripts/gen_spec_module.mjs`);
      bad++;
      continue;
    }
    fs.writeFileSync(outPath, wanted);
    console.log(`[gen]  ${spec.out}`);
  }
  if (bad > 0) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
