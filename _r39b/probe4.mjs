import puppeteer from "puppeteer-core";
const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9362", defaultViewport: null });
const pages = await b.pages();
const page = pages.find(p => p.url().includes("8872")) || pages[0];
const out = await page.evaluate(() => {
  const o = {};
  const safe = (k, f) => { try { o[k] = f(); } catch (e) { o[k] = "ERR:" + (e && e.message); } };
  safe("bought1_10", () => {
    const a = [];
    for (let i = 1; i <= 10; i++) { try { if (TimeStudy(i).isBought) a.push(i); } catch (e) {} }
    return a.join(",");
  });
  safe("chain", () => {
    const a = [];
    for (const id of [11, 21, 31, 41, 51, 61, 62, 71, 72, 73, 171, 181, 191, 192, 193, 211, 214]) {
      try { const s = TimeStudy(id); a.push(`${id}:${s.isBought ? "B" : (s.canBeBought ? "C" : "-")}`); } catch (e) { a.push(`${id}:?`); }
    }
    return a.join(" ");
  });
  safe("autoState", () => {
    const a = globalThis.OrekiEternityAutomation;
    if (!a) return "none";
    return JSON.stringify({
      active: a.active, frame: a._frame, pref: a.preferredColumn,
      respec: a.needsBranchRespec, blocked: a.blockedStudies, lastErr: a._lastError,
      shouldHold: (() => { try { return a.shouldHoldReset(); } catch (e) { return "err"; } })(),
    });
  });
  safe("respecCount", () => globalThis.OrekiEternityAutomation?._respecCount ?? "n/a");
  safe("ec1Comp", () => `${EternityChallenge(1).completions}/${EternityChallenge(1).maxCompletions}`);
  safe("treeValid", () => {
    try { return typeof TimeStudyTree === "function" ? "fn" : "obj"; } catch (e) { return "ERR"; }
  });
  return o;
});
console.log(JSON.stringify(out, null, 1));
b.disconnect();
