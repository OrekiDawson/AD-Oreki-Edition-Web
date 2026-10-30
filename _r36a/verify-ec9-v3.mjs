// R36-A · EC9 定向验收 v3 —— 修复后（oreki-eternity-automation.js 的 R36 修复）
//
// 目标（对应验收标准 4 / 5）：
//   4) EC1~8 已满级、资源充足环境下**真实点开 EC9**，
//      观察 EternityChallenge(9).completions 逐次 0→1→…→4→5，
//      证明奖励真实结算 + 幂等（重复进入不重复发奖）。
//   5) 下游链：DS1 → PlayerProgress.dilationUnlocked()
//      → startDilatedEternity() → player.records.thisReality.maxDT > 0。
//
// ── 为什么 v3 与 v2 不同 ────────────────────────────────────────────
// v2 的两个问题：
//   ① 幂等段被「中途发生现实」污染 —— reality.js:651 每现实清空 player.eternityChalls，
//      于是 EC9 的完成记录被清成 0，before/afterStart/afterClick 三个快照都是 0，
//      证明不了「已满级后重复进入不重复发奖」。
//   ② EP 奖励的归属不明 —— EP 是在 _giveEternityRewards() 里一次性 add 的
//      （不是每次 addCompletion 都 add），光看 EP 总量无法归因到 EC9。
// v3 的做法：
//   · 挂钩 Currency.eternityPoints.add，并在记录里带上**当时的
//     player.challenge.eternity.current** —— 也就是这笔 EP 是给哪一关的。
//   · 幂等判定用「EC9 专属的 EP 奖励笔数」：重复进入前后该笔数必须**不变**。
//   · 下游链在**首个现实发生之前**抓（realities===0 的窗口），避免被现实重置清空。
//
// 用法：node _r36a/verify-ec9-v3.mjs [项目目录] [HTTP端口] [秒] [Edge端口]
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
const port = nums.length > 0 ? nums[0] : 8854;
const DURATION = (nums.length > 1 ? nums[1] : 240) * 1000;
const EDGE_PORT = nums.length > 2 ? nums[2] : 9341;
const TAG = process.env.OREKI_TAG || `r36a-v3-${Date.now()}`;
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

// 只杀本脚本自己那个调试端口上的 Edge（同机还有别的 Agent 的实例在跑，不能全量杀）
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

  // ── 只读挂钩：addCompletion（逐次完成）+ EP.add（奖励入账，带关卡归属）──
  const hooked = await page.evaluate(() => {
    try {
      globalThis.__ecAdd = [];
      globalThis.__epAdd = [];
      // addCompletion 定义在 EternityChallengeState 上（src/core/eternity-challenge.js:169）
      const proto = Object.getPrototypeOf(EternityChallenge(1));
      const orig = proto.addCompletion;
      if (typeof orig !== "function") {
        return { ok: false, err: "找不到 addCompletion（原型=" + (proto?.constructor?.name) + "）" };
      }
      proto.addCompletion = function (auto) {
        const before = this.completions;
        const r = orig.call(this, auto);
        globalThis.__ecAdd.push({
          t: Math.round(performance.now()),
          id: this.id,
          before,
          after: this.completions,
          auto: !!auto,
        });
        // 【容量控制】10000× 速度下 addCompletion 每秒可发生数十次，
        // 只保留最近 5 秒的记录，避免内存与 JSONL 膨胀。
        const cutoff = performance.now() - 5000;
        while (globalThis.__ecAdd.length && globalThis.__ecAdd[0].t < cutoff) {
          globalThis.__ecAdd.shift();
        }
        return r;
      };
      // EP 入账：记录当时正在结算的 EC（player.challenge.eternity.current）
      // 注意归因时机：_giveEternityRewards 里 EP.add 发生在
      // player.challenge.eternity.current 被清 0 之前（oreki-instant-challenges.js:165），
      // 但「当前正在跑的挑战」更可靠的来源是刚被 addCompletion 过的那个 id
      // —— 这里用「最近一次 addCompletion 的 id」作为归因。
      //
      // 【容量控制】EP 在本 MOD 里是超高频事件（10000× 速度下每帧多次），
      // 全量记录会把 JSONL 撑到几百 MB。只保留「EC 完成引起的」那几笔：
      // 即最近一次 addCompletion 发生在最近 100 ms 内时才记录。
      const epVal = Object.getPrototypeOf(Currency.eternityPoints.value);
      const origAdd = epVal.add;
      epVal.add = function (v) {
        const beforeL = (typeof Currency.eternityPoints.value.log10 === "function"
          ? Currency.eternityPoints.value.log10() : null);
        const cur = player.challenge.eternity.current;
        const lastAdd = globalThis.__ecAdd[globalThis.__ecAdd.length - 1];
        const r = origAdd.call(this, v);
        const afterL = (typeof Currency.eternityPoints.value.log10 === "function"
          ? Currency.eternityPoints.value.log10() : null);
        const now = performance.now();
        if (lastAdd && (now - lastAdd.t) < 100) {
          globalThis.__epAdd.push({
            t: Math.round(now),
            ec: cur,
            ecByLastAdd: lastAdd.id,
            beforeL,
            afterL,
          });
        }
        return r;
      };
      return { ok: true, protoName: proto.constructor && proto.constructor.name };
    } catch (e) {
      return { ok: false, err: String(e && e.stack || e) };
    }
  });
  if (!hooked.ok) log("[hook] 挂钩失败：", hooked.err);
  else log(`[hook] addCompletion / EP.add 只读挂钩已装（原型=${hooked.protoName}）`);

  // ── 阶段 A：等 EC9 完成到 5 ──────────────────────────────────────
  const snapFn = () => {
    try {
      const ecDone = [];
      for (let i = 1; i <= 12; i++) ecDone.push(EternityChallenge(i).completions);
      return {
        ecDone,
        ec9: ecDone[8],
        ec12: ecDone[11],
        unlocked: player.challenge.eternity.unlocked,
        current: player.challenge.eternity.current,
        realities: player.realities,
        bit9: (player.challenge.eternity.requirementBits & (1 << 9)) !== 0,
        s151: TimeStudy(151).isBought === true,
        can9: TimeStudy.eternityChallenge(9).canBeBought === true,
        epL: (typeof Currency.eternityPoints.value.log10 === "function"
          ? Currency.eternityPoints.value.log10() : null),
        ipL: (typeof Currency.infinityPoints.value.log10 === "function"
          ? Currency.infinityPoints.value.log10() : null),
        adds: (globalThis.__ecAdd || []).filter(x => x.id === 9),
        epAdds: (globalThis.__epAdd || []).filter(x => x.ecByLastAdd === 9),
      };
    } catch (e) { return { err: String(e && e.message || e) }; }
  };

  const tA = Date.now();
  let s9 = null;
  let lastLog = 0;
  while (Date.now() - tA < DURATION) {
    const st = await page.evaluate(snapFn).catch(() => null);
    if (st && !st.err) {
      fs.appendFileSync(JSONL, JSON.stringify({ kind: "pollA", t: Math.floor((Date.now() - tA) / 1000), ...st }) + "\n");
      const el = Math.floor((Date.now() - tA) / 1000);
      if (el - lastLog >= 5) {
        lastLog = el;
        log(`[A ${String(el).padStart(4)}s] ec=[${st.ecDone}] r=${st.realities} unlocked=${st.unlocked} cur=${st.current} `
          + `s151=${st.s151 ? "Y" : "n"} can9=${st.can9 ? "Y" : "n"} bit9=${st.bit9 ? 1 : 0} `
          + `epL=${st.epL?.toFixed(0)} adds9=${st.adds.length} epAdds9=${st.epAdds.filter(x => x.ecByLastAdd === 9).length}`);
      }
      if (st.ec9 >= 5) { s9 = st; break; }
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  if (!s9) {
    log("[A] 超时：EC9 未在窗口内到 5 次");
  } else {
    log(`[A] EC9 已完成 5/5（t=${Math.floor((Date.now() - tA) / 1000)}s），adds9=${s9.adds.length} 条`);
    log("[A] EC9 逐次完成记录：");
    for (const a of s9.adds) log(`      before=${a.before} after=${a.after} auto=${a.auto}`);
    log(`[A] EC9 专属 EP 奖励笔数 = ${s9.epAdds.filter(x => x.ecByLastAdd === 9).length}`);
  }

  // ── 阶段 B：真实 UI 点击 EC9（按钮文本定位）────────────────────────
  const clickRes = await page.evaluate(async () => {
    try {
      if (typeof Tab !== "undefined" && Tab.eternity?.show) Tab.eternity.show();
      const sel = 'button[class*="o-time-study-eternity-challenge"]';
      let all = [];
      for (let i = 0; i < 60; i++) {
        all = Array.from(document.querySelectorAll(sel));
        if (all.length >= 12) break;
        await new Promise(r => setTimeout(r, 250));
      }
      const ecNumOf = (el) => {
        const m = (el.textContent || "").match(/永恒挑战\s*(\d+)/);
        return m ? Number(m[1]) : null;
      };
      const target = all.find(el => ecNumOf(el) === 9);
      if (!target) {
        return { ok: false, err: "找不到「永恒挑战 9」按钮", n: all.length, nums: all.map(ecNumOf) };
      }
      const before = {
        ec9: EternityChallenge(9).completions,
        epL: Currency.eternityPoints.value.log10(),
        unlocked: player.challenge.eternity.unlocked,
        epAdds9: (globalThis.__epAdd || []).filter(x => x.ecByLastAdd === 9).length,
      };
      target.click();
      await new Promise(r => setTimeout(r, 1200));
      const after = {
        ec9: EternityChallenge(9).completions,
        epL: Currency.eternityPoints.value.log10(),
        unlocked: player.challenge.eternity.unlocked,
        epAdds9: (globalThis.__epAdd || []).filter(x => x.ecByLastAdd === 9).length,
      };
      return { ok: true, n: all.length, text: (target.textContent || "").trim().slice(0, 60), before, after };
    } catch (e) { return { ok: false, err: String(e && e.stack || e) }; }
  });
  log("[B] 真实 UI 点击 EC9：", JSON.stringify(clickRes));
  fs.appendFileSync(JSONL, JSON.stringify({ kind: "click", ...clickRes }) + "\n");

  // ── 阶段 C：幂等 —— 已满级后重复进入 ──────────────────────────────
  const idem = await page.evaluate(async () => {
    try {
      const snap = () => ({
        ec9: EternityChallenge(9).completions,
        epL: Currency.eternityPoints.value.log10(),
        ipL: Currency.infinityPoints.value.log10(),
        epAdds9: (globalThis.__epAdd || []).filter(x => x.ecByLastAdd === 9).length,
        adds9: (globalThis.__ecAdd || []).filter(x => x.id === 9).length,
        current: player.challenge.eternity.current,
        unlocked: player.challenge.eternity.unlocked,
        bit9: (player.challenge.eternity.requirementBits & (1 << 9)) !== 0,
        realities: player.realities,
      });
      const before = snap();
      // 幂等场景 A：游戏自己的进入路径（buyEcStudiesAndStart 用的就是它）
      const started = EternityChallenge(9).start(true);
      await new Promise(r => setTimeout(r, 2000));
      const afterStart = snap();
      // 幂等场景 B：再点一次真实 UI 按钮
      const sel = 'button[class*="o-time-study-eternity-challenge"]';
      const all = Array.from(document.querySelectorAll(sel));
      const ecNumOf = (el) => {
        const m = (el.textContent || "").match(/永恒挑战\s*(\d+)/);
        return m ? Number(m[1]) : null;
      };
      const t9 = all.find(el => ecNumOf(el) === 9);
      if (t9) t9.click();
      await new Promise(r => setTimeout(r, 2000));
      const afterClick = snap();
      return { before, afterStart, afterClick, started };
    } catch (e) { return { err: String(e && e.stack || e) }; }
  });
  log("[C] 幂等检查：", JSON.stringify(idem, null, 1));
  fs.appendFileSync(JSONL, JSON.stringify({ kind: "idempotency", ...idem }) + "\n");

  // ── 阶段 C2：EP 奖励按关卡归因（证明「EC9 完成确实结算了 EP」）───────
  const epByEc = await page.evaluate(() => {
    try {
      const m = {};
      for (const r of (globalThis.__epAdd || [])) {
        const k = String(r.ecByLastAdd);
        if (!m[k]) m[k] = { n: 0, sumDeltaL: 0, first: null, last: null };
        const d = (r.afterL != null && r.beforeL != null) ? (r.afterL - r.beforeL) : 0;
        m[k].n++;
        m[k].sumDeltaL += d;
        if (m[k].first == null) m[k].first = r.t;
        m[k].last = r.t;
      }
      return m;
    } catch (e) { return { err: String(e && e.message || e) }; }
  });
  log("[C2] EP 奖励按关卡归因：", JSON.stringify(epByEc, null, 1));
  fs.appendFileSync(JSONL, JSON.stringify({ kind: "epByEc", ...epByEc }) + "\n");

  // ── 阶段 D：下游链（尽量在首个现实之前抓）──────────────────────────
  const chain = await page.evaluate(async () => {
    try {
      const out = { steps: [] };
      const ds1 = TimeStudy.dilation;
      out.steps.push({ s: "realities_before", v: player.realities });
      out.steps.push({ s: "ds1_isBought_before", v: ds1.isBought === true });
      out.steps.push({ s: "dilationUnlocked_before", v: PlayerProgress.dilationUnlocked() === true });
      out.steps.push({ s: "maxDT_before", v: String(player.records.thisReality.maxDT) });
      if (ds1.isBought !== true) {
        out.steps.push({ s: "ds1_purchase_return", v: ds1.purchase(true) === true });
      }
      out.steps.push({ s: "ds1_isBought_after", v: ds1.isBought === true });
      out.steps.push({ s: "dilationUnlocked_after", v: PlayerProgress.dilationUnlocked() === true });
      const started = startDilatedEternity(true);
      out.steps.push({ s: "startDilatedEternity_return", v: started === true });
      out.steps.push({ s: "dilation_active", v: player.dilation.active === true });
      await new Promise(r => setTimeout(r, 3000));
      out.steps.push({ s: "maxDT_after", v: String(player.records.thisReality.maxDT) });
      out.steps.push({ s: "maxDT_positive", v: player.records.thisReality.maxDT.gt(0) === true });
      out.steps.push({ s: "dtL", v: (typeof Currency.dilatedTime.value.log10 === "function"
        ? Currency.dilatedTime.value.log10() : null) });
      out.steps.push({ s: "dtStudies", v: player.dilation.studies.length });
      out.steps.push({ s: "isGameEnd", v: player.isGameEnd === true });
      out.steps.push({ s: "endState", v: player.endState });
      out.steps.push({ s: "realities_after", v: player.realities });
      return out;
    } catch (e) { return { err: String(e && e.stack || e) }; }
  });
  log("[D] 下游链：", JSON.stringify(chain, null, 1));
  fs.appendFileSync(JSONL, JSON.stringify({ kind: "chain", ...chain }) + "\n");

  if (errs?.length) log("[pageerror]", errs.slice(0, 5));
  log(`[out] JSONL=${JSONL}`);
  log(`[out] LOG=${LOG}`);
} finally {
  await cleanup();
  server.close();
  killEdge();
}
