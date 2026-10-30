// R36-A · EC9 定向验收（真实新档 + 真实点击 + 幂等 + 下游链）
//
// 目的（对应验收标准 4 / 5）：
//   4) EC1~8 已满级、资源充足环境下**真实点开 EC9**，
//      观察 EternityChallenge(9).completions 从 4 变 5，
//      证明奖励真实结算 + 幂等（重复进入不重复发奖）。
//   5) 下游链验证：DS1 购买 → PlayerProgress.dilationUnlocked()
//      → startDilatedEternity() → player.records.thisReality.maxDT > 0。
//
// ── 关键设计：为什么用「挂钩 addCompletion」而不是直接改 completions ──
// 本 MOD 的 `oreki-instant-challenges.js` 在进入 EC 后会在**同一帧内**用
// `while (!isFullyCompleted) addCompletion(false)` 把 5 次完成一次性补满，
// 所以在 1 Hz 采样下 EC9 是 0 → 5 跳变，看不到中间的 4 → 5。
// 解决办法：**只读挂钩** `EternityChallengeState.prototype.addCompletion`，
// 把每一次 +1 单独记下来（含前后 EP / IP / 完成数）。
// 挂钩只是「在旁边看着」，不改任何返回值、不跳过任何一次 addCompletion，
// 因此 4 → 5 这一步是**游戏自己算出来的**，不是我们写进去的。
//
// 用法：node _r36a/verify-ec9-directed.mjs [项目目录] [HTTP端口] [秒] [Edge端口]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(HERE, "..", "..", "AD-Oreki-Edition");
const argv = process.argv.slice(2);
const nums = [];
let rootArg = null;
for (const a of argv) {
  if (/^\d+$/.test(a)) nums.push(Number(a));
  else if (rootArg === null) rootArg = a;
}
const root = path.resolve(rootArg || DEFAULT_ROOT);
const port = nums.length > 0 ? nums[0] : 8852;
const DURATION = (nums.length > 1 ? nums[1] : 200) * 1000;
const EDGE_PORT = nums.length > 2 ? nums[2] : 9341;
const TAG = process.env.OREKI_TAG || `r36a-direct-${Date.now()}`;
const JSONL = path.join(HERE, `_${TAG}.jsonl`);
const LOG = path.join(HERE, `_${TAG}.log`);

if (!fs.existsSync(path.join(root, "index.html"))) {
  console.error(`[fatal] 项目根无效：${root}`);
  process.exit(2);
}

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon",
  ".webm": "video/webm", ".woff2": "font/woff2",
};
const logLines = [];
function log(...a) {
  const s = a.map(x => (typeof x === "string" ? x : JSON.stringify(x))).join(" ");
  console.log(s);
  logLines.push(s);
  fs.writeFileSync(LOG, logLines.join("\n") + "\n");
}

// 只杀本脚本自己那个调试端口上的 Edge（同机还有别的 Agent 的实例在跑）
function killEdge() {
  const ps = `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | `
    + `Where-Object { $_.CommandLine -like '*remote-debugging-port=${EDGE_PORT}*' } | `
    + `ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
  try {
    execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: "ignore" });
    log(`[cleanup] 端口 ${EDGE_PORT} 已清理`);
  } catch (e) {
    log(`[cleanup] 端口 ${EDGE_PORT} 无遗留 Edge`);
  }
}
killEdge();

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(root, "." + p);
  if (!f.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));
log(`[serve] ${root} -> http://127.0.0.1:${port}/`);

let cleanup = async () => {};
try {
  const launched = await launchBrowser({ port: EDGE_PORT });
  cleanup = launched.cleanup;
  const { page, errors: errs } = await openGame(launched.browser, { port });

  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
  await page.reload({ waitUntil: "load", timeout: 60000 });
  log("[newgame] localStorage 清空 + 重载 = 真实新档");

  for (let i = 0; i < 200; i++) {
    const ok = await page.evaluate(() => {
      try {
        return typeof player === "object" && typeof EternityChallenge === "function"
          && typeof TimeStudy === "function" && typeof Currency === "function";
      } catch { return false; }
    }).catch(() => false);
    if (ok) break;
    await new Promise(r => setTimeout(r, 400));
  }

  // ── 装「只读挂钩」：记录每一次 EC 完成 +1 的前后状态 ──────────────
  const hooked = await page.evaluate(() => {
    try {
      const rec = [];
      globalThis.__ecAdd = rec;
      // addCompletion 定义在 **EternityChallengeState** 上（src/core/eternity-challenge.js:169），
      // 不是 ECTimeStudyState 上 —— 取原型要拿挑战实例的原型，不是时间研究实例的原型。
      const proto = Object.getPrototypeOf(EternityChallenge(1));
      const orig = proto.addCompletion;
      if (typeof orig !== "function") return { ok: false, err: "找不到 addCompletion（原型=" + (proto && proto.constructor && proto.constructor.name) + "）" };
      proto.addCompletion = function (auto) {
        const before = this.completions;
        const epBefore = Currency.eternityPoints.value;
        const r = orig.call(this, auto);
        const after = this.completions;
        const epAfter = Currency.eternityPoints.value;
        rec.push({
          t: Math.round(performance.now()),
          id: this.id,
          before,
          after,
          auto: !!auto,
          epBeforeL: (typeof epBefore.log10 === "function" ? epBefore.log10() : null),
          epAfterL: (typeof epAfter.log10 === "function" ? epAfter.log10() : null),
        });
        return r;
      };
      // 同时挂钩 EP 入账，验证「奖励真实结算」
      const epRec = [];
      globalThis.__epAdd = epRec;
      const epVal = Object.getPrototypeOf(Currency.eternityPoints.value);
      const origAdd = epVal.add;
      epVal.add = function (v) {
        const before = Currency.eternityPoints.value;
        const r = origAdd.call(this, v);
        epRec.push({
          t: Math.round(performance.now()),
          deltaL: (typeof before.log10 === "function" ? before.log10() : null),
          afterL: (typeof Currency.eternityPoints.value.log10 === "function"
            ? Currency.eternityPoints.value.log10() : null),
        });
        return r;
      };
      return { ok: true, protoName: proto.constructor && proto.constructor.name };
    } catch (e) {
      return { ok: false, err: String(e && e.stack || e) };
    }
  });
  if (!hooked.ok) {
    log("[hook] 挂钩失败：", hooked.err);
  } else {
    log("[hook] addCompletion / EP.add 只读挂钩已装（原型=" + hooked.protoName + "）");
  }

  // ── 等待 EC1~8 满级 + EC9 可购买 ───────────────────────────────
  const waitStart = Date.now();
  let ready = null;
  while (Date.now() - waitStart < DURATION) {
    const st = await page.evaluate(() => {
      try {
        const ecDone = [];
        for (let i = 1; i <= 12; i++) ecDone.push(EternityChallenge(i).completions);
        const s9 = TimeStudy.eternityChallenge(9);
        return {
          ecDone,
          ec1to8Max: ecDone.slice(0, 8).every(v => v >= 5),
          ec9Done: ecDone[8],
          canBuy9: s9.canBeBought === true,
          isBought9: s9.isBought === true,
          reqCur9L: (typeof s9.cachedCurrentRequirement?.log10 === "function"
            ? s9.cachedCurrentRequirement.log10() : null),
          reqTot9L: (typeof s9.requirementTotal?.log10 === "function" ? s9.requirementTotal.log10() : null),
          bit9: (player.challenge.eternity.requirementBits & (1 << 9)) !== 0,
          tt: (typeof Currency.timeTheorems.value?.log10 === "function" ? Currency.timeTheorems.value.log10() : null),
          study151Bought: TimeStudy(151).isBought === true,
          study181Bought: TimeStudy(181).isBought === true,
          study231Bought: TimeStudy(231).isBought === true,
          study232Bought: TimeStudy(232).isBought === true,
          study233Bought: TimeStudy(233).isBought === true,
          study234Bought: TimeStudy(234).isBought === true,
          ec9CanBeBought: s9.canBeBought === true,
          epL: (typeof Currency.eternityPoints.value.log10 === "function" ? Currency.eternityPoints.value.log10() : null),
          realities: player.realities,
          unlocked: player.challenge.eternity.unlocked,
          current: player.challenge.eternity.current,
        };
      } catch (e) { return { err: String(e && e.message || e) }; }
    }).catch(() => null);
    if (st && !st.err) {
      const line = `[${String(Math.floor((Date.now() - waitStart) / 1000)).padStart(4)}s] `
        + `ec=[${st.ecDone}] ec1to8Max=${st.ec1to8Max ? "Y" : "n"} `
        + `canBuy9=${st.canBuy9 ? "Y" : "n"} bought9=${st.isBought9 ? "Y" : "n"} bit9=${st.bit9 ? 1 : 0} `
        + `s151=${st.study151Bought ? "Y" : "n"} s181=${st.study181Bought ? "Y" : "n"} `
        + `s23=${[st.study231Bought, st.study232Bought, st.study233Bought, st.study234Bought].map(v => v ? "Y" : "n").join("")} `
        + `reqCur9=${st.reqCur9L?.toFixed(0)} reqTot9=${st.reqTot9L?.toFixed(0)} `
        + `ttL=${st.tt?.toFixed(1)} epL=${st.epL?.toFixed(0)} r=${st.realities} unlocked=${st.unlocked} cur=${st.current}`;
      log(line);
      fs.appendFileSync(JSONL, JSON.stringify({ kind: "poll", t: Math.floor((Date.now() - waitStart) / 1000), ...st }) + "\n");
      if (st.ec1to8Max && st.canBuy9 && !st.isBought9) { ready = st; break; }
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  if (!ready) {
    log("[warn] 未等到「EC1~8 满级 + EC9 可购买」窗口");
  } else {
    log("[ready] EC1~8 满级、EC9 可购买，开始真实点击");
  }

  // ── 真实点击 EC9：走 UI 按钮 → TimeStudyButton.handleClick → study.purchase() ──
  // 注意 class 细节（TimeStudyButton.js:49-102）：
  //   classObject 里**没有**基础类名 `o-time-study-eternity-challenge`，
  //   只有 studyClass 拼出来的 `${pathClass}--available / --bought / --unavailable`
  //   （pathClass = "o-time-study-eternity-challenge"，单横线）。
  //   所以正确选择器是 [class*="o-time-study-eternity-challenge"]（子串匹配）。
  //   定位 EC9 不用数组下标（渲染顺序会变），改用 Vue 内部实例读 study.id。
  const clicked = await page.evaluate(async () => {
    try {
      // 切到「永恒」页 → 「时间研究」子页，让时间研究树渲染出来
      if (typeof Tab !== "undefined" && Tab.eternity?.show) Tab.eternity.show();
      // 等待渐进渲染完成（TimeStudiesTab.created 每帧 +2，renderedStudyCount 到顶才齐）
      const sel = 'button[class*="o-time-study-eternity-challenge"]';
      let all = [];
      for (let i = 0; i < 60; i++) {
        all = Array.from(document.querySelectorAll(sel));
        if (all.length >= 12) break;
        await new Promise(r => setTimeout(r, 250));
      }
      if (!all.length) return { ok: false, err: "页面上找不到 EC 时间研究按钮", n: 0 };
      // 从按钮的 Vue 组件实例读出 study.id，精确挑出 EC9
      const idOf = (el) => {
        try {
          const inst = el.__vueParentComponent || el.__vue__;
          const s = inst?.props?.setup?.study;
          return s && typeof s.id === "number" ? s.id : null;
        } catch (e) { return null; }
      };
      // 按钮文本形如「永恒挑战 9 (5/5) 要求：…」→ 用文本里的关卡号定位。
      // （Vue 内部实例在生产构建里读不到 props，故以文本为准。）
      const ecNumOf = (el) => {
        const m = (el.textContent || "").match(/永恒挑战\s*(\d+)/);
        return m ? Number(m[1]) : null;
      };
      let target = all.find(el => idOf(el) === 9) || all.find(el => ecNumOf(el) === 9) || null;
      let byId = !!target;
      if (!target) {
        // 兜底：按 DOM 顺序取第 9 个（EC1..EC12 的渲染顺序）
        target = all[8] || null;
      }
      if (!target) return { ok: false, err: "找不到 EC9 按钮", n: all.length };
      const ids = all.map(idOf);
      const nums = all.map(ecNumOf);
      const before = {
        ec9: EternityChallenge(9).completions,
        unlocked: player.challenge.eternity.unlocked,
        isBought9: TimeStudy.eternityChallenge(9).isBought === true,
      };
      target.click();
      await new Promise(r => setTimeout(r, 300));
      const after = {
        ec9: EternityChallenge(9).completions,
        unlocked: player.challenge.eternity.unlocked,
        isBought9: TimeStudy.eternityChallenge(9).isBought === true,
      };
      return {
        ok: true, n: all.length, byId, ids, nums,
        cls: target.className, text: (target.textContent || "").trim().slice(0, 80),
        before, after,
      };
    } catch (e) {
      return { ok: false, err: String(e && e.stack || e) };
    }
  });
  log("[click] EC9 真实点击：", JSON.stringify(clicked));

  // ── 观察 4 → 5 与幂等 ───────────────────────────────────────────
  const t0 = Date.now();
  while (Date.now() - t0 < 25000) {
    const st = await page.evaluate(() => {
      try {
        return {
          ec9: EternityChallenge(9).completions,
          ecDone: Array.from({ length: 12 }, (_, i) => EternityChallenge(i + 1).completions),
          unlocked: player.challenge.eternity.unlocked,
          current: player.challenge.eternity.current,
          bit9: (player.challenge.eternity.requirementBits & (1 << 9)) !== 0,
          epL: (typeof Currency.eternityPoints.value.log10 === "function" ? Currency.eternityPoints.value.log10() : null),
          adds: (globalThis.__ecAdd || []).filter(x => x.id === 9),
          epAdds: globalThis.__epAdd || [],
        };
      } catch (e) { return { err: String(e && e.message || e) }; }
    }).catch(() => null);
    if (st && !st.err) {
      fs.appendFileSync(JSONL, JSON.stringify({ kind: "clickwatch", dt: Date.now() - t0, ...st }) + "\n");
      log(`[watch] dt=${Date.now() - t0}ms ec9=${st.ec9} unlocked=${st.unlocked} cur=${st.current} `
        + `bit9=${st.bit9 ? 1 : 0} epL=${st.epL?.toFixed(0)} adds9=${JSON.stringify(st.adds)}`);
      if (st.ec9 >= 5 && st.adds.some(x => x.before === 4 && x.after === 5)) break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  // ── 幂等检查：EC9 已满级后再「真实点一次」/ 再请求进入一次 ─────────
  const idem = await page.evaluate(async () => {
    try {
      const before = {
        ec9: EternityChallenge(9).completions,
        epL: Currency.eternityPoints.value.log10(),
        ipL: Currency.infinityPoints.value.log10(),
      };
      // 幂等场景 A：已满级的 EC 再走一次 start()（游戏自己的路径）
      const started = EternityChallenge(9).start(true);
      await new Promise(r => setTimeout(r, 1500));
      const afterStart = {
        ec9: EternityChallenge(9).completions,
        epL: Currency.eternityPoints.value.log10(),
        ipL: Currency.infinityPoints.value.log10(),
        started,
      };
      // 幂等场景 B：再点一次 EC9 的 UI 按钮（已满级时应无新完成）
      const sel = 'button[class*="o-time-study-eternity-challenge"]';
      const all = Array.from(document.querySelectorAll(sel));
      const idOf = (el) => {
        try {
          const inst = el.__vueParentComponent || el.__vue__;
          const s = inst?.props?.setup?.study;
          return s && typeof s.id === "number" ? s.id : null;
        } catch (e) { return null; }
      };
      const ecNumOf = (el) => {
        const m = (el.textContent || "").match(/永恒挑战\s*(\d+)/);
        return m ? Number(m[1]) : null;
      };
      const t9 = all.find(el => idOf(el) === 9) || all.find(el => ecNumOf(el) === 9) || all[8] || null;
      if (t9) t9.click();
      await new Promise(r => setTimeout(r, 1500));
      const afterClick = {
        ec9: EternityChallenge(9).completions,
        epL: Currency.eternityPoints.value.log10(),
        ipL: Currency.infinityPoints.value.log10(),
      };
      return { before, afterStart, afterClick, adds9: (globalThis.__ecAdd || []).filter(x => x.id === 9) };
    } catch (e) {
      return { err: String(e && e.stack || e) };
    }
  });
  log("[idempotency]", JSON.stringify(idem, null, 1));
  fs.appendFileSync(JSONL, JSON.stringify({ kind: "idempotency", ...idem }) + "\n");

  // ── 下游链：DS1 → dilationUnlocked → startDilatedEternity → maxDT > 0 ──
  const chain = await page.evaluate(async () => {
    try {
      const out = { steps: [] };
      const ds1 = TimeStudy.dilation;
      out.steps.push({ s: "ds1_isBought_before", v: ds1.isBought === true });
      out.steps.push({ s: "dilationUnlocked_before", v: PlayerProgress.dilationUnlocked() === true });
      out.steps.push({ s: "maxDT_before", v: String(player.records.thisReality.maxDT) });
      // 若 DS1 还没买，就真实购买（走游戏自己的 purchase 路径）
      if (ds1.isBought !== true) {
        const ok = ds1.purchase(true);
        out.steps.push({ s: "ds1_purchase_return", v: ok === true });
      }
      out.steps.push({ s: "ds1_isBought_after", v: ds1.isBought === true });
      out.steps.push({ s: "dilationUnlocked_after", v: PlayerProgress.dilationUnlocked() === true });
      // 真实启动膨胀永恒
      const started = startDilatedEternity(true);
      out.steps.push({ s: "startDilatedEternity_return", v: started === true });
      out.steps.push({ s: "dilation_active", v: player.dilation.active === true });
      await new Promise(r => setTimeout(r, 2500));
      out.steps.push({ s: "maxDT_after", v: String(player.records.thisReality.maxDT) });
      out.steps.push({ s: "maxDT_positive", v: player.records.thisReality.maxDT.gt(0) === true });
      out.steps.push({ s: "dtL", v: (typeof Currency.dilatedTime.value.log10 === "function"
        ? Currency.dilatedTime.value.log10() : null) });
      out.steps.push({ s: "dtStudies", v: player.dilation.studies.length });
      out.steps.push({ s: "isGameEnd", v: player.isGameEnd === true });
      out.steps.push({ s: "endState", v: player.endState });
      out.steps.push({ s: "realities", v: player.realities });
      return out;
    } catch (e) {
      return { err: String(e && e.stack || e) };
    }
  });
  log("[chain]", JSON.stringify(chain, null, 1));
  fs.appendFileSync(JSONL, JSON.stringify({ kind: "chain", ...chain }) + "\n");

  if (errs?.length) log("[pageerror]", errs.slice(0, 5));
  log(`[out] JSONL=${JSONL}`);
  log(`[out] LOG=${LOG}`);
} finally {
  await cleanup();
  server.close();
  killEdge();
}
