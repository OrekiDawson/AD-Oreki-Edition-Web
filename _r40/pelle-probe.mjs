// R40-A4 · 佩勒段（doomed）只读诊断探针
//
// 目的：解释「IU25 / 进入佩勒之后 endState 走平」的真实原因，采集 team-lead 指定口径：
//   1) OrekiEndgameAutomation._lastError 与全部节流字段（_lastSlowMs/_lastImMs/_lastDoomBuyMs/_laitelaRunAtMs/_laiHold）
//   2) endState 三要素：log10(log10(totalAM)+1) 的输入、OREKI_PELLE_END_OFFSET、OREKI_PELLE_END_TARGET_EXP、当前 endState
//   3) 佩勒进度：Rifts / GalaxyGenerator.generatedGalaxies / realityShards / doomed
//   4) 是否是「需要手动界面操作」的步骤（用 player.break / autobuyersOn / hasMaxedInterval 的实测值判定）
//   5) 反物质到底停在哪个值：toString() 原值、mantissa/exponent 分开、gte(NUMBER_MAX_VALUE)/gte(Decimal.MAX_VALUE)、
//      AD1/AD8 的产量与成本（产量 > 0 而总量不动 ⇒ 被钳位，产量 = 0 ⇒ 数值链断了）
//
// 只读：不写任何 player 字段，不调任何 purchase/start/breakInfinity。
//
// 用法（端口只能 8884/9374）：
//   node _r40/pelle-probe.mjs [秒=1200] [tag] [sampleMs=1000]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { launchBrowser, openGame } from "../lib/edge-launch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "AD-Oreki-Edition");
const DURATION = (Number(process.argv[2]) || 1200) * 1000;
const TAG = process.argv[3] || `r40a4-pelle-${Date.now()}`;
const SAMPLE_MS = Number(process.argv[4]) || 1000;
const PORT = Number(process.env.OREKI_HTTP_PORT || 8884);
const EDGE_PORT = Number(process.env.OREKI_CDP_PORT || 9374);

const JSONL = path.join(HERE, `${TAG}.jsonl`);
const LOG = path.join(HERE, `${TAG}.log`);

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
  try { fs.writeFileSync(LOG, logLines.join("\n") + "\n"); } catch (e) { /* ignore */ }
}

function killEdge() {
  const ps = `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | `
    + `Where-Object { $_.CommandLine -like '*remote-debugging-port=${EDGE_PORT}*' } | `
    + `ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
  try { execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: "ignore" }); } catch (e) { /* ignore */ }
}
killEdge();

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(ROOT, "." + p);
  if (!f.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(PORT, "127.0.0.1", r));
log(`[serve] ${PORT} cdp=${EDGE_PORT} ${DURATION / 1000}s sample=${SAMPLE_MS}ms tag=${TAG}`);

const SAMPLE = () => {
  const T = fn => { try { const v = fn(); return v === undefined ? null : v; } catch (e) { return null; } };
  const S = v => { try { return v === null || v === undefined ? null : v.toString(); } catch (e) { return null; } };
  const L = v => { try { return v && v.log10 ? Math.round(v.log10() * 1e3) / 1e3 : null; } catch (e) { return null; } };
  const o = { t: Math.round((Date.now() - window.__r40T0) / 100) / 10 };
  try {
    // ── 速度自证（C.35 §7 未知项）：倍率存在 localStorage 而不是存档里，所以只能读键值。
    // 键不存在 = 用默认（GAME_SPEED_DEFAULT = 10000）；存在则说明**有人改过**。
    // 注意动态速度默认开启，升档也会写这个键 ⇒ 本字段同时是「有没有中途升档」的证据。
    o.spd = (() => { try { return localStorage.getItem("oreki-game-speed"); } catch (e) { return null; } })();
    o.spdDyn = (() => { try { return localStorage.getItem("oreki-game-speed-dynamic"); } catch (e) { return null; } })();
    o.realities = player.realities;
    o.doomed = T(() => Pelle.isDoomed === true);
    o.gameEnd = player.isGameEnd === true;
    o.endState = T(() => Number(GameEnd.endState.toFixed(6)));

    // ── 反物质：原值 + 分解 + 两种上限比较
    o.am = S(player.antimatter);
    o.amM = T(() => player.antimatter.mantissa);
    o.amE = T(() => Number(player.antimatter.exponent));
    o.amIsNum = T(() => typeof player.antimatter === "number");
    o.gteNumMax = T(() => player.antimatter.gte(Decimal.NUMBER_MAX_VALUE) === true);
    o.gteDecMax = T(() => player.antimatter.gte(Decimal.MAX_VALUE) === true);
    o.goal = S(T(() => Player.infinityGoal));
    o.totAM = S(T(() => player.celestials.pelle.records.totalAntimatter));
    o.totAML = L(T(() => player.celestials.pelle.records.totalAntimatter));
    o.thisMaxAML = L(T(() => player.records.thisReality.maxAM));

    // ── 是否是「没接管 / 需要手动操作」：break 链
    o.brk = T(() => player.break === true);
    o.abOn = T(() => player.auto.autobuyersOn === true);
    o.bcMaxInt = T(() => Autobuyer.bigCrunch.hasMaxedInterval === true);
    o.bcActive = T(() => Autobuyer.bigCrunch.isActive === true);
    o.etActive = T(() => Autobuyer.eternity.isActive === true);
    o.icRun = T(() => InfinityChallenge.isRunning === true);
    o.ncRun = T(() => NormalChallenge.isRunning === true);
    o.ecRun = T(() => EternityChallenge.isRunning === true);

    // ── 维度链
    o.ad1amtL = L(T(() => AntimatterDimension(1).amount));
    o.ad1prodL = L(T(() => AntimatterDimension(1).productionPerSecond));
    o.ad1costL = L(T(() => AntimatterDimension(1).cost));
    o.ad1aff = T(() => AntimatterDimension(1).isAffordable === true);
    o.ad8amtL = L(T(() => AntimatterDimension(8).amount));
    o.ad8prodL = L(T(() => AntimatterDimension(8).productionPerSecond));
    o.ad8costL = L(T(() => AntimatterDimension(8).cost));
    o.ad8aff = T(() => AntimatterDimension(8).isAffordable === true);
    o.ad8unl = T(() => AntimatterDimension(8).isUnlocked === true);
    o.prodL = L(T(() => Currency.antimatter.productionPerSecond));
    o.ticksPsL = L(T(() => new Decimal(Tickspeed.perSecond)));

    // ── 佩勒进度
    o.rift = T(() => PelleRifts.all.map(r => (r.isUnlocked ? 1 : 0)).join(""));
    o.riftAct = T(() => PelleRifts.all.map(r => (r.isActive ? 1 : 0)).join(""));
    o.gg = T(() => player.celestials.pelle.galaxyGenerator.generatedGalaxies);
    o.ggSpent = T(() => player.celestials.pelle.galaxyGenerator.spentGalaxies);
    o.rsL = L(T(() => Currency.realityShards.value));
    o.remL = L(T(() => Currency.remnants.value));
    o.puBought = T(() => PelleUpgrade.all.filter(u => u.isBought).map(u => u.id).join("|"));
    // ── R40-A5 末日循环观测
    o.rem = T(() => player.celestials.pelle.remnants);
    o.remGain = T(() => Pelle.remnantsGain);
    o.keepAuto = T(() => PelleUpgrade.keepAutobuyers.isBought === true);
    o.ivl = T(() => Autobuyer.bigCrunch.data.interval);
    o.ipL = T(() => Math.round(Currency.infinityPoints.value.log10() * 1e2) / 1e2);
    o.armN = T(() => globalThis.OrekiEndgameAutomation?._doomArmageddons);
    o.phase = T(() => globalThis.OrekiEndgameAutomation?._doomPhase);
    o.crunchOn = T(() => globalThis.OrekiEndgameAutomation?._doomCrunchesOn);
    o.canArm = T(() => Pelle.canArmageddon === true);
    // ── R40-A5b：验证「毁灭态大坍缩自动器没解锁 ⇒ 必须自己按按钮」这条
    o.bcUnl = T(() => Autobuyer.bigCrunch.isUnlocked === true);
    o.strike = T(() => PelleStrikes.infinity.hasStrike === true);
    o.bcCost = T(() => Autobuyer.bigCrunch.cost);

    // ── endgame 自动化内部状态（节流 + 错误）
    const e = globalThis.OrekiEndgameAutomation;
    o.eStep = T(() => e.step);
    // ── R41 缺陷卡（报告 §11）需要的 4 个字段：EC 重建链是否断在这一步
    o.ecUnlocked = T(() => player.challenge.eternity.unlocked);
    o.ecs = T(() => { const a = []; for (let i = 1; i <= 12; i++) a.push(EternityChallenge(i).completions); return a.join(","); });
    o.ecTarget = T(() => globalThis.OrekiDilationAutomation?._targetEc());
    o.ttMaxL = T(() => Math.round(Currency.timeTheorems.max.log10() * 1e2) / 1e2);
    o.realityStudy = T(() => TimeStudy.reality.isBought === true);
    // ── R40-S1 智能策略层（只读解释器）：证明它挂到了活对象、且没降级
    o.smOk = T(() => globalThis.OrekiSmartStrategy?.evaluate()?.ok ?? null);
    o.smStage = T(() => globalThis.OrekiSmartStrategy?.evaluate()?.stage?.id ?? null);
    o.smStrat = T(() => globalThis.OrekiSmartStrategy?.evaluate()?.strategy?.id ?? null);
    o.smGoal = T(() => globalThis.OrekiSmartStrategy?.evaluate()?.goal?.id ?? null);
    o.smDeg = T(() => globalThis.OrekiSmartStrategy?.evaluate()?.degraded ?? null);
    o.smErr = T(() => globalThis.OrekiSmartStrategy?.debugState()?.lastError ?? null);
    o.smDegN = T(() => globalThis.OrekiSmartStrategy?.debugState()?.degradedCount ?? null);
    o.smBlock = T(() => (globalThis.OrekiSmartStrategy?.evaluate()?.blockers || []).map(b => b.id).join("|"));
    // ── R40-S2 智能执行层：证明它挂到活对象、边界生效（不是只看代码存在）
    o.exOk = T(() => globalThis.OrekiSmartExecutor?.debugState() != null);
    o.exReg = T(() => (globalThis.OrekiSmartExecutor?.debugState()?.registered || []).join("|"));
    o.exActN = T(() => globalThis.OrekiSmartExecutor?.debugState()?.actionCount ?? null);
    o.exTryN = T(() => globalThis.OrekiSmartExecutor?.debugState()?.attemptCount ?? null);
    o.exLast = T(() => {
      const a = globalThis.OrekiSmartExecutor?.debugState()?.action;
      return a ? `${a.verb}@${a.source}:${a.acted ? 1 : 0}` : null;
    });
    o.exNext = T(() => globalThis.OrekiSmartExecutor?.debugState()?.next?.label ?? null);
    o.exHold = T(() => globalThis.OrekiSmartExecutor?.debugState()?.manualHold?.remainSec ?? null);
    o.exIdle = T(() => JSON.stringify(globalThis.OrekiSmartExecutor?.debugState()?.idle ?? {}));
    o.exDeg = T(() => globalThis.OrekiSmartExecutor?.debugState()?.degraded ?? null);
    o.exErr = T(() => globalThis.OrekiSmartExecutor?.debugState()?.error ?? null);
    o.eErr = T(() => e._lastError);
    o.eSlowMs = T(() => Math.round(Date.now() - (e._lastSlowMs || 0)));
    o.eImMs = T(() => Math.round(Date.now() - (e._lastImMs || 0)));
    o.eDoomMs = T(() => Math.round(Date.now() - (e._lastDoomBuyMs || 0)));
    o.eLaiRunMs = T(() => Math.round(Date.now() - (e._laitelaRunAtMs || 0)));
    o.eLaiHold = T(() => e._laiHold === true);
    o.ePelleUp = T(() => e._pelleUpgrades);
    o.eDoomOff = T(() => e._doomResetsOff);
    o.iuBought = T(() => JSON.stringify(e._iuBought));
  } catch (err) { o.err = String((err && err.message) || err); }
  return o;
};

let cleanup = async () => {};
try {
  const launched = await launchBrowser({ port: EDGE_PORT });
  const browser = launched.browser;
  cleanup = launched.cleanup;
  const { page, errors } = await openGame(browser, { port: PORT });
  const consoleErrs = [];
  const orekilog = [];
  page.on("console", m => {
    const t = m.text();
    if (/OREKI|R3[0-9]|R4[0-9]|佩勒|R38-LAI|R38-IU25/i.test(t)) {
      orekilog.push(t.slice(0, 300));
      if (orekilog.length > 300) orekilog.shift();
    }
    if (m.type() === "error") {
      consoleErrs.push(t.slice(0, 240));
      if (consoleErrs.length > 200) consoleErrs.shift();
    }
  });

  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
  await page.reload({ waitUntil: "load", timeout: 60000 });
  log("[newgame] 真实新档");

  for (let i = 0; i < 200; i++) {
    const ok = await page.evaluate(() => {
      try { return typeof player === "object" && typeof Pelle === "object" && typeof GameEnd === "object"; }
      catch (e) { return false; }
    }).catch(() => false);
    if (ok) break;
    await new Promise(r => setTimeout(r, 300));
  }
  await page.evaluate(() => { window.__r40T0 = Date.now(); });

  // [R40-S3 归因用] OREKI_NO_EXEC=1 时关掉智能执行层，用来分离「执行层带来的额外购买」与
  // 「本底推进速度」。只在探针里用，不改产品代码。
  if (process.env.OREKI_NO_EXEC === "1") {
    const off = await page.evaluate(() => {
      try { return globalThis.OrekiSmartExecutor?.setEnabled(false) ?? null; } catch (e) { return `ERR:${e.message}`; }
    });
    log(`[attrib] OREKI_NO_EXEC=1 → executor enabled=${JSON.stringify(off)}`);
  }

  // 一次性把 endState 三要素的真实取值打出来（不是公式复述，是运行时读常量）
  const consts = await page.evaluate(() => {
    try {
      const mod = globalThis.__OREKI_END_CONSTS__ || null;
      return { mod };
    } catch (e) { return { err: String(e && e.message) }; }
  });
  log("[consts-global]", JSON.stringify(consts));

  const t0 = Date.now();
  let lastLog = -1;
  let lastPelle = -1;
  const firsts = {};
  while (Date.now() - t0 < DURATION) {
    const s = await page.evaluate(SAMPLE).catch(e => ({ err: String(e && e.message) }));
    if (s && !s.err) {
      try { fs.appendFileSync(JSONL, JSON.stringify(s) + "\n"); } catch (e) { /* ignore */ }
      const mark = (k, v, extra = "") => {
        if (v && !firsts[k]) { firsts[k] = s.t; log(`[FIRST] ${k} t=${s.t}s r=${s.realities} am=${s.am} ${extra}`); }
      };
      mark("doomed", s.doomed === true);
      mark("gameEnd", s.gameEnd === true);

      if (s.doomed && firsts.pelleT0 === undefined) { firsts.pelleT0 = s.t; log(`[PELLE-T0] t=${s.t}s am=${s.am} brk=${s.brk} endState=${s.endState}`); }

      const el = Math.floor((Date.now() - t0) / 1000);
      // 佩勒段每 5 s 打一行，其余每 30 s 一行
      const due = s.doomed ? (el - lastPelle >= 5) : (el - lastLog >= 30);
      if (due) {
        if (s.doomed) lastPelle = el; else lastLog = el;
        log(`[${String(el).padStart(4)}s] doom=${s.doomed ? 1 : 0} end=${s.endState} am=${s.am}` +
          ` totAML=${s.totAML} brk=${s.brk ? 1 : 0} abOn=${s.abOn ? 1 : 0} bcInt=${s.bcMaxInt ? 1 : 0}` +
          ` ad1=${s.ad1amtL}/${s.ad1prodL}/${s.ad1costL}${s.ad1aff ? "+" : "-"}` +
          ` ad8=${s.ad8amtL}/${s.ad8prodL}/${s.ad8costL}${s.ad8aff ? "+" : "-"} prod=${s.prodL}` +
          ` rift=${s.rift}/${s.riftAct} gg=${s.gg} rsL=${s.rsL} pu=${s.puBought}` +
          ` rem=${s.rem} remGain=${s.remGain} keepAuto=${s.keepAuto ? 1 : 0} ivl=${s.ivl} ipL=${s.ipL}` +
          ` arm=${s.armN} ph=${s.phase} cr=${s.crunchOn} canArm=${s.canArm ? 1 : 0}` +
          ` eStep=${s.eStep} eErr="${s.eErr || ""}" doomMs=${s.eDoomMs} slowMs=${s.eSlowMs} laiHold=${s.eLaiHold ? 1 : 0}`);
      }
    }
    const wait = SAMPLE_MS - ((Date.now() - t0) % SAMPLE_MS);
    await new Promise(r => setTimeout(r, Math.max(0, Math.min(wait, SAMPLE_MS))));
  }

  const fin = await page.evaluate(SAMPLE).catch(() => null);
  log("[final]", JSON.stringify(fin));
  log("[firsts]", JSON.stringify(firsts));
  if (orekilog.length) log("[oreki-log-tail]", JSON.stringify(orekilog.slice(-40)));
  if (errors?.length) log("[pageerror]", JSON.stringify(errors.slice(0, 5)));
  if (consoleErrs.length) log("[console-err-tail]", JSON.stringify(consoleErrs.slice(-8)));
} catch (e) {
  log("[fatal]", String((e && e.stack) || e));
} finally {
  try { await cleanup(); } catch (e) { /* ignore */ }
  try { server.close(); } catch (e) { /* ignore */ }
  killEdge();
  log("[done]");
  process.exit(0);
}
