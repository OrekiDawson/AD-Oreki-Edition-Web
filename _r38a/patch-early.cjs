const fs = require("fs");
const p = "src/core/oreki-early-automation.js";
let s = fs.readFileSync(p, "utf8");
const start = s.indexOf("  /** [Oreki R37-A] 冲刺前 ID1 自动购买器的开关快照");
if (start < 0) { console.error("start anchor missing"); process.exit(1); }
const endMark = "\r\n};\r\n";
const end = s.indexOf(endMark, start);
if (end < 0) { console.error("end anchor missing"); process.exit(1); }
const delegate = [
  "  /**",
  "   * 【R38-A】是否应当暂停购买无限维度。**只读委托**，真正的状态机在",
  "   * `src/core/oreki-iu15-sprint.js`（OrekiIu15Sprint）。",
  "   *",
  "   * 历史：R36/R37 在这里自己写了一套触发条件，但两版都从未触发过 ——",
  "   * 关键是「只挡 ID1」在物理上无效：ID2~ID8 会 produceDimensions 到 ID1",
  "   * （infinity-dimension.js:377-379），必须把 8 层全部锁死；",
  "   * 且反物质会被大坍缩/永恒清零，必须同时冻结二者（见新模块顶部注释）。",
  "   */",
  "  isIu15SprintActive() {",
  "    try {",
  "      return globalThis.OrekiIu15Sprint?.active === true;",
  "    } catch (e) {",
  "      return false;",
  "    }",
  "  },",
  "",
].join("\r\n");
s = s.slice(0, start) + delegate + s.slice(end + 2);
fs.writeFileSync(p, s);
console.log("ok");
console.log(s.slice(-700));
