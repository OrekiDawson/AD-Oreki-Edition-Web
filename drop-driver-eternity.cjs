const fs = require("fs");
const p = "verify-r21-eternity.mjs";
let s = fs.readFileSync(p, "utf8");

// 生产代码已有 AD13 自动永恒；脚本侧不再代点，避免测出的是脚本而不是生产逻辑
const start = s.indexOf("      // 节奏化：只有 EP 收益达到当前 EP 的 10 倍才永恒");
const end = s.indexOf("    } catch (e) { /* ignore */ }\n  };", start);
if (start < 0 || end < 0) {
  console.log("未找到脚本侧永恒块，可能已移除");
} else {
  s = s.slice(0, start) + s.slice(end);
  console.log("已移除脚本侧点永恒");
}
fs.writeFileSync(p, s);
