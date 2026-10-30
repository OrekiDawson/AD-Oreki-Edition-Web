const fs = require("fs");
const p = "src/core/oreki-endgame-automation.js";
let s = fs.readFileSync(p, "utf8");
const oldText = [
  "      if (Laitela.isRunning) return; // 熵自己在涨，等 game.js:1098 结算",
  "      // 只有「本现实真实时间 < 15 s」才进 run —— 结算时 game.js 用的是同一个",
  "      // `Time.thisRealityRealTime`，超过 30 s 就不会 +tier，白跑一次。",
  "      const realMs = player.records.thisReality.realTime;",
  "      if (!(realMs < LAT_RUN_ENTER_MAX_REAL_MS)) return;",
  "      Laitela.initializeRun();",
  "      this._laitelaRuns++;",
  "      this._laitelaTiers = tier;",
];
const newText = [
  "      if (Laitela.isRunning) {",
  "        // [Oreki R38-A] 见 LAT_RUN_MIN_AM_EXP 的说明：run 在位会让 ID8 停产，",
  "        // 「进得去但填不满」的 run 必须主动退出，让 ID8 复产、amE 回高位再来。",
  "        const ent = player.celestials.laitela.entropy;",
  "        const amE = Number(player.antimatter?.exponent ?? 0);",
  "        if (ent >= 0 && ent < 0.9 && amE < LAT_RUN_MIN_AM_EXP &&",
  "          this._laitelaRunAtMs && now - this._laitelaRunAtMs > LAT_RUN_ABORT_MS) {",
  "          clearCelestialRuns();",
  "          this._laitelaAborts = (this._laitelaAborts || 0) + 1;",
  "          this._laitelaRunAtMs = 0;",
  "          console.log(`[R38-LAI] 熵涨不动（amE=1e${amE.toExponential(2)} ent=${ent.toFixed(3)}），` +",
  "            `退出莱特拉 run 让 ID8 复产（累计退出 ${this._laitelaAborts} 次）`);",
  "        }",
  "        return; // 熵自己在涨，等 game.js:1092 结算",
  "      }",
  "      // 只有「本现实真实时间 < 15 s」才进 run —— 结算时 game.js 用的是同一个",
  "      // `Time.thisRealityRealTime`，超过 30 s 就不会 +tier，白跑一次现实。",
  "      const realMs = player.records.thisReality.realTime;",
  "      if (!(realMs < LAT_RUN_ENTER_MAX_REAL_MS)) return;",
  "      // [Oreki R38-A] amE 不够高（熵 < 0.033/s）就别进，否则白压 ID8",
  "      if (!(Number(player.antimatter?.exponent ?? 0) >= LAT_RUN_MIN_AM_EXP)) return;",
  "      Laitela.initializeRun();",
  "      this._laitelaRunAtMs = now;",
  "      this._laitelaRuns++;",
  "      this._laitelaTiers = tier;",
];
const norm = t => t.replace(/\r\n/g, "\n");
if (!norm(s).includes(oldText.join("\n"))) {
  console.error("anchor missing");
  process.exit(1);
}
s = norm(s).replace(oldText.join("\n"), newText.join("\n")).replace(/\n/g, "\r\n");
fs.writeFileSync(p, s);
console.log("ok");
