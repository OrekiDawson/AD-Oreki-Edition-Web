// [R40-S1] 只读旁路：连已经在跑的 Edge（9374），读智能策略层的实况。
// 关键：**只 connect，不 launch、不 kill**。队里可能有人正用同一个 CDP 端口跑长测，
// 任何 killEdge / launchBrowser 都会把别人的跑测打断。
//
// 用法：node _tools/_r40/smart-live-peek.mjs
import puppeteer from "puppeteer-core";

const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9374", defaultViewport: null });
const ps = await b.pages();
const p = ps.find(x => x.url().includes("127.0.0.1")) || ps[0];
const o = await p.evaluate(() => {
  const T = f => {
    try {
      const v = f();
      return v === undefined ? null : v;
    } catch (e) {
      return `ERR:${e.message}`;
    }
  };
  const hasSmart = typeof globalThis.OrekiSmartStrategy === "object" && globalThis.OrekiSmartStrategy !== null;
  return {
    url: location.href,
    hasSmart,
    dbg: T(() => globalThis.OrekiSmartStrategy.debugState()),
    decision: T(() => {
      const d = globalThis.OrekiSmartStrategy.evaluate(true);
      return {
        ok: d.ok,
        stage: d.stage,
        goal: d.goal,
        strategy: d.strategy ? { id: d.strategy.id, priorityN: d.strategy.priority.length } : null,
        blockers: (d.blockers ?? []).map(x => x.id),
        manualHold: d.manualHold,
        degraded: d.degraded,
        error: d.error,
      };
    }),
    // 顺带核对「游戏还在正常跑」：这两项一旦异常说明我们的 tick 把主循环带崩了
    gameEnd: T(() => player.isGameEnd === true),
    endState: T(() => Number(GameEnd.endState.toFixed(4))),
  };
});
console.log(JSON.stringify(o, null, 1));
await b.disconnect();
