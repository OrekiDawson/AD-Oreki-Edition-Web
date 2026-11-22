#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import {
  buildGateSummary,
  overallResult,
  recordCheckpointExport,
  validateRunnerOptions,
} from "./web-full-run-policy.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const OUT = path.resolve(arg(
  "out",
  path.join(REPO, "reports", "R124", `网页完整运行-${stamp()}`),
));
const MAX_MIN = Number(arg("max-min", 10));
const SAMPLE_MS = Number(arg("sample-ms", 10_000));
const SHOT_MS = Number(arg("shot-ms", 60_000));
const CONFIRM_SEC = Number(arg("confirm-sec", 120));
const MAX_WALL_SEC = MAX_MIN * 60;
const SHOTS = path.join(OUT, "截图");
const CHECKPOINTS = path.join(OUT, "存档快照");
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(CHECKPOINTS, { recursive: true });

function stamp() {
  const date = new Date();
  const pad = value => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-`
    + `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function iso(timestamp = Date.now()) {
  return new Date(timestamp).toISOString();
}

function gitValue(args) {
  try {
    return execFileSync("git", args, {
      cwd: REPO,
      encoding: "utf8",
      timeout: 10_000,
    }).trim();
  } catch {
    return null;
  }
}

const summary = {
  runId: path.basename(OUT),
  source: {
    repo: REPO,
    sha: gitValue(["rev-parse", "HEAD"]),
    branch: gitValue(["rev-parse", "--abbrev-ref", "HEAD"]),
    dirtyTracked: gitValue(["status", "--porcelain", "--untracked-files=no"]),
  },
  environment: {
    host: os.hostname(),
    node: process.version,
    browser: null,
    viewport: { width: 412, height: 915 },
    mobile: true,
    hasTouch: true,
  },
  timing: {
    startIso: null,
    endIso: null,
    totalWallSeconds: null,
    maxWallSeconds: MAX_WALL_SEC,
  },
  freshness: {},
  events: [],
  samples: 0,
  screenshots: 0,
  runtimeErrors: [],
  consoleErrors: [],
  checkpoints: [],
  confirm: { requiredSeconds: CONFIRM_SEC, observedSeconds: 0, regressions: 0 },
  gates: null,
  result: "NOT RUN",
  resultReason: null,
};
const samplesPath = path.join(OUT, "samples.jsonl");
const summaryPath = path.join(OUT, "summary.json");
const logPath = path.join(OUT, "run.log");
let startedMonotonic = performance.now();
let gameStartMonotonic = null;
let browser = null;
let context = null;
let page = null;
let server = null;
let stopping = false;
let gameEndAt = null;
let lastShotAt = 0;
let lastEventCount = 0;
let confirmStartedAt = null;

function log(...parts) {
  const line = `[${iso()}] ${parts.join(" ")}`;
  console.log(line);
  fs.appendFileSync(logPath, `${line}\n`);
}

function wallSeconds(monotonic = performance.now()) {
  const base = gameStartMonotonic ?? startedMonotonic;
  return Math.round((monotonic - base) / 100) / 10;
}

function writeSummary() {
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
}

function initPageProbe() {
  window.__r124 = {
    t0: Date.now(),
    storageAtStart: [],
    events: [],
    birth: null,
    last: null,
  };
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      window.__r124.storageAtStart.push(localStorage.key(i));
    }
  } catch {
    window.__r124.storageAtStart = ["ERR"];
  }

  const add = (key, value) => {
    if (window.__r124.events.some(event => event.key === key)) return;
    window.__r124.events.push({
      key,
      value,
      wallSeconds: Math.round((Date.now() - window.__r124.t0) / 100) / 10,
      iso: new Date().toISOString(),
    });
  };
  const log10 = value => {
    try {
      const result = Number(value.log10());
      return Number.isFinite(result) ? result : null;
    } catch {
      return null;
    }
  };
  const number = value => {
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  };

  setInterval(() => {
    try {
      const p = window.player;
      if (!p) return;
      const snapshot = {
        wallSeconds: Math.round((Date.now() - window.__r124.t0) / 100) / 10,
        realities: number(p.realities),
        eternitiesLog10: log10(p.eternities),
        infinitiesLog10: log10(window.Currency?.infinitiesTotal?.value),
        break: p.break === true,
        gameEnd: p.isGameEnd === true,
        antimatterLog10: log10(p.antimatter),
        infinityPointsLog10: log10(window.Currency?.infinityPoints?.value),
        eternityPointsLog10: log10(window.Currency?.eternityPoints?.value),
        dimensionBoosts: number(p.dimensionBoosts),
        galaxies: number(p.galaxies),
        speed: number(window.GameSpeed?.factor),
        visibility: document.visibilityState,
      };
      if (!window.__r124.birth) window.__r124.birth = { ...snapshot };
      window.__r124.last = snapshot;
      if (snapshot.break) add("break", snapshot.break);
      if (snapshot.infinitiesLog10 !== null && snapshot.infinitiesLog10 >= 0) {
        add("infinity", snapshot.infinitiesLog10);
      }
      if (snapshot.eternitiesLog10 !== null && snapshot.eternitiesLog10 >= 0) {
        add("eternity", snapshot.eternitiesLog10);
      }
      if (snapshot.realities !== null && snapshot.realities >= 1) {
        add("reality", snapshot.realities);
      }
      if (snapshot.gameEnd) add("gameEnd", true);
    } catch (error) {
      window.__r124.probeError = String(error?.message || error);
    }
  }, 50);
}

function startServer(root) {
  const mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".txt": "text/plain; charset=utf-8",
  };
  return new Promise((resolve, reject) => {
    const instance = http.createServer((request, response) => {
      try {
        let relative = decodeURIComponent(String(request.url || "/").split("?")[0]);
        if (relative.endsWith("/")) relative += "index.html";
        const target = path.resolve(root, `.${relative}`);
        if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
          response.writeHead(403).end("403");
          return;
        }
        fs.stat(target, (error, stat) => {
          if (error || !stat.isFile()) {
            response.writeHead(404).end("404");
            return;
          }
          response.writeHead(200, {
            "Content-Type": mime[path.extname(target).toLowerCase()]
              || "application/octet-stream",
            "Cache-Control": "no-store",
          });
          fs.createReadStream(target).pipe(response);
        });
      } catch {
        response.writeHead(500).end("500");
      }
    });
    instance.once("error", reject);
    instance.listen(0, "127.0.0.1", () => resolve(instance));
  });
}

async function screenshot(name) {
  try {
    await page.screenshot({
      path: path.join(SHOTS, `${name}.png`),
      type: "png",
    });
    summary.screenshots += 1;
    lastShotAt = Date.now();
  } catch (error) {
    summary.runtimeErrors.push(`screenshot ${name}: ${String(error?.message || error)}`);
  }
}

async function dismissMessageModal() {
  try {
    const modal = page.locator(".c-modal-message");
    if (!(await modal.isVisible())) return;
    const button = modal.locator(".c-modal__confirm-btn").last();
    if (await button.isVisible()) await button.click({ timeout: 3000 });
  } catch {
    // Message modals are presentation-only for this run; game state remains authoritative.
  }
}

async function persistCheckpoint(reason) {
  if (!page) return null;
  try {
    const checkpoint = await page.evaluate(() => {
      const storage = {};
      try {
        for (let i = 0; i < localStorage.length; i += 1) {
          const key = localStorage.key(i);
          storage[key] = localStorage.getItem(key);
        }
      } catch (error) {
        storage.__error = String(error?.message || error);
      }
      let save = null;
      try {
        save = globalThis.GameStorage?.exportModifiedSave?.() ?? null;
      } catch (error) {
        save = `ERROR: ${String(error?.message || error)}`;
      }
      return { save, storage };
    });
    const exportError = recordCheckpointExport(summary, reason, checkpoint);
    const base = `${String(summary.checkpoints.length + 1).padStart(2, "0")}-${reason}`;
    const jsonPath = path.join(CHECKPOINTS, `${base}.json`);
    fs.writeFileSync(jsonPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
    if (!exportError) {
      fs.writeFileSync(path.join(CHECKPOINTS, `${base}.txt`), checkpoint.save);
    }
    summary.checkpoints.push({
      reason,
      json: jsonPath,
      exportedSave: !exportError,
      exportError,
    });
    writeSummary();
    return jsonPath;
  } catch (error) {
    summary.runtimeErrors.push(`checkpoint ${reason}: ${String(error?.message || error)}`);
    return null;
  }
}

async function collect() {
  await dismissMessageModal();
  const current = await page.evaluate(() => ({
    events: window.__r124.events,
    birth: window.__r124.birth || null,
    last: window.__r124.last,
    storageAtStart: window.__r124.storageAtStart,
    probeError: window.__r124.probeError || null,
    visibility: document.visibilityState,
  }));
  const sample = {
    wallSeconds: wallSeconds(),
    ...current,
  };
  fs.appendFileSync(samplesPath, `${JSON.stringify(sample)}\n`);
  summary.samples += 1;
  summary.events = current.events;
  summary.freshness = {
    storageAtStart: current.storageAtStart,
    birth: current.birth,
  };
  if (current.probeError) summary.runtimeErrors.push(`page-probe: ${current.probeError}`);

  const firstReality = current.events.find(event => event.key === "reality");
  if (firstReality) summary.timing.firstRealityWallSeconds = firstReality.wallSeconds;
  const gameEnd = current.events.find(event => event.key === "gameEnd");
  if (gameEnd && gameEndAt === null) {
    gameEndAt = performance.now();
    summary.timing.gameEndWallSeconds = gameEnd.wallSeconds;
    log("首次原版 gameEnd", JSON.stringify(gameEnd));
  }
  if (current.events.length > lastEventCount) {
    lastEventCount = current.events.length;
    await screenshot(`事件-${lastEventCount}-${current.events.at(-1).key}`);
  }
  if (Date.now() - lastShotAt >= SHOT_MS) {
    await screenshot(`进度-${Math.round(wallSeconds())}秒`);
  }
  writeSummary();
  return sample;
}

async function main() {
  validateRunnerOptions({
    maxMinutes: MAX_MIN,
    sampleMs: SAMPLE_MS,
    shotMs: SHOT_MS,
    confirmSeconds: CONFIRM_SEC,
  });
  log("启动 R124 Web 完整运行器", JSON.stringify({ REPO, OUT, MAX_MIN, SAMPLE_MS }));
  server = await startServer(REPO);
  const base = `http://127.0.0.1:${server.address().port}/index.html`;

  browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "--disable-features=CalculateNativeWinOcclusion",
      "--mute-audio",
      "--no-sandbox",
      "--disable-dev-shm-usage",
    ],
  });
  summary.environment.browser = browser.version();
  context = await browser.newContext({
    viewport: summary.environment.viewport,
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) "
      + "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Mobile Safari/537.36",
  });
  await context.addInitScript(initPageProbe);
  page = await context.newPage();
  page.on("pageerror", error => summary.runtimeErrors.push(`pageerror: ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error") summary.consoleErrors.push(message.text());
  });

  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.evaluate(() => localStorage.clear());
  const t0 = Date.now();
  gameStartMonotonic = performance.now();
  startedMonotonic = gameStartMonotonic;
  summary.timing.startIso = iso(t0);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForFunction(
    () => window.player && window.OrekiSmartExecutor,
    null,
    { timeout: 120_000 },
  );
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await cdp.send("Page.setWebLifecycleState", { state: "active" });
  await page.bringToFront();
  await screenshot("开局");

  let nextSampleAt = 0;
  while (!stopping) {
    const elapsed = wallSeconds();
    if (elapsed >= nextSampleAt) {
      const sample = await collect();
      nextSampleAt = elapsed + SAMPLE_MS / 1000;
      if (sample.events.some(event => event.key === "reality")
          && summary.timing.firstRealityWallSeconds < 70 * 60) {
        await persistCheckpoint("首次现实过早");
        stopping = true;
        summary.resultReason = "首次 Reality 早于 70 分钟，停止无效长跑";
      }
      log("采样", JSON.stringify({
        wallSeconds: elapsed,
        events: sample.events.map(event => event.key),
        state: sample.last,
      }));
    }
    if (!stopping && gameEndAt !== null) {
      if (confirmStartedAt === null) confirmStartedAt = performance.now();
      summary.confirm.observedSeconds = Math.round((performance.now() - confirmStartedAt) / 1000);
      const stillEnded = await page.evaluate(() => window.player?.isGameEnd === true);
      if (!stillEnded) summary.confirm.regressions += 1;
      if (summary.confirm.observedSeconds >= CONFIRM_SEC) stopping = true;
    }
    if (!stopping && gameEndAt === null && wallSeconds() >= MAX_WALL_SEC) stopping = true;
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  const final = await collect();
  await persistCheckpoint("运行结束");
  const gameEnd = final.events.some(event => event.key === "gameEnd");
  summary.timing.totalWallSeconds = wallSeconds();
  summary.timing.endIso = iso();
  summary.gates = buildGateSummary({
    gameEnd,
    gameEndWallSeconds: summary.timing.gameEndWallSeconds,
    totalWallSeconds: summary.timing.totalWallSeconds,
    maxWallSeconds: MAX_WALL_SEC,
    confirmSeconds: summary.confirm.observedSeconds,
    requiredConfirmSeconds: CONFIRM_SEC,
    confirmRegressions: summary.confirm.regressions,
    firstRealityWallSeconds: summary.timing.firstRealityWallSeconds,
  });
  await screenshot("结束");
  summary.result = overallResult(summary.gates, {
    gameEnd,
    totalWallSeconds: summary.timing.totalWallSeconds,
    maxWallSeconds: MAX_WALL_SEC,
    errorCount: summary.runtimeErrors.length,
  });
  summary.resultReason ||= summary.gates.firstReality.reason;
  writeSummary();
  process.exitCode = summary.result === "GAMEEND-PASS" ? 0 : 2;
  log("运行结束", JSON.stringify({
    result: summary.result,
    gates: summary.gates,
    events: summary.events,
  }));
}

async function cleanup() {
  try { await context?.close(); } catch { /* ignore */ }
  try { await browser?.close(); } catch { /* ignore */ }
  try { await new Promise(resolve => server?.close(resolve)); } catch { /* ignore */ }
}

process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

try {
  await main();
} catch (error) {
  summary.runtimeErrors.push(String(error?.stack || error));
  if (summary.timing.startIso !== null) {
    summary.gates ||= buildGateSummary({
      gameEnd: false,
      gameEndWallSeconds: null,
      totalWallSeconds: wallSeconds(),
      maxWallSeconds: MAX_WALL_SEC,
      confirmSeconds: summary.confirm.observedSeconds,
      requiredConfirmSeconds: CONFIRM_SEC,
      confirmRegressions: summary.confirm.regressions,
      firstRealityWallSeconds: summary.timing.firstRealityWallSeconds,
    });
    summary.result = "RUNTIME-ERROR";
    process.exitCode = 2;
  } else {
    summary.result = "NOT RUN";
    process.exitCode = 1;
  }
  summary.resultReason = String(error?.message || error);
  writeSummary();
} finally {
  await cleanup();
}
