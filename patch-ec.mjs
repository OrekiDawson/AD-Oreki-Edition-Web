const fs = require("fs");
const p = "src/core/oreki-eternity-automation.js";
let s = fs.readFileSync(p, "utf8");

const start = s.indexOf("  advanceEternityChallenges() {");
const endMarker = "  shouldHoldReset() {";
const end = s.indexOf(endMarker);
if (start < 0 || end < 0 || end < start) {
  console.log("定位失败");
  process.exit(1);
}

const block = [
  "  buyEcStudiesAndStart() {",
  "    try {",
  "      // 1) 能买的 EC 研究都买掉（canBeBought 会自己校验：unlocked 为 0 / 主研究已买 / 二级资源达标）",
  "      for (let id = 1; id <= 12; id++) {",
  "        try {",
  "          const study = TimeStudy.eternityChallenge(id);",
  "          if (study && !study.isBought) study.purchase();",
  "        } catch (e) {",
  "          // 该 EC 研究暂不可买",
  "        }",
  "      }",
  "",
  "      // 2) 已有挑战在跑就不插手（完成逻辑交给 oreki-instant-challenges）",
  "      if (EternityChallenge.isRunning) return false;",
  "",
  "      // 3) 进入当前已解锁的那一关",
  "      const unlockedId = player.challenge.eternity.unlocked;",
  "      if (!unlockedId) return false;",
  "      let challenge;",
  "      try {",
  "        challenge = EternityChallenge(unlockedId);",
  "      } catch (e) {",
  "        return false;",
  "      }",
  "      if (!challenge || !challenge.isUnlocked) return false;",
  "      if (challenge.completions >= challenge.maxCompletions) {",
  "        // [AD11.1] 这一关已满：必须 respecTimeStudies 才能把 unlocked 清 0，",
  "        // 否则 ECTimeStudyState.canBeBought 里那条 unlocked !== 0 就直接 return false，",
  "        // 后面所有 EC 研究永远买不上（实测卡在 EC2 满级后无法推进）。",
  "        // respec 会退款并清空普通研究，下一步由 AD10 的自动买研究重新补齐。",
  "        respecTimeStudies(true);",
  "        return false;",
  "      }",
  "      return challenge.start(true) === true;",
  "    } catch (e) {",
  "      return false;",
  "    }",
  "  },",
  "",
  "",
].join("\n");

s = s.slice(0, start) + block + s.slice(end);
s = s.split("this.advanceEternityChallenges()").join("this.buyEcStudiesAndStart()");
fs.writeFileSync(p, s);
console.log("已回退为已验证版本 + respec 修复");
