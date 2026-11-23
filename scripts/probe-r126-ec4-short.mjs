#!/usr/bin/env node
// R126 EC4 短程生产路径探针。
//
// 用途：从一份真实保存进入 EC4 前状态，观察自动永恒、无限次数累计、
// EC4 原版购买入口与后续 EC 是否发生进度。只使用生产模块，不写资源或完成位。

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const savePath = path.resolve(arg("save", ""));
const maxSeconds = Number(arg("max-sec", 180));
const sampleMs = Number(arg("sample-ms", 1000));
const enableEternityAutobuyer = process.argv.includes("--enable-eternity");
const disableEcEntryHold = process.argv.includes("--disable-ec-entry-hold");
const out = path.resolve(arg("out", path.join(REPO, "reports", "R126", "EC4短程探针")));
fs.mkdirSync(out, { recursive: true });

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
    const server = http.createServer((request, response) => {
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
            "Content-Type": mime[path.extname(target).toLowerCase()] || "application/octet-stream",
            "Cache-Control": "no-store",
          });
          fs.createReadStream(target).pipe(response);
        });
      } catch {
        response.writeHead(500).end("500");
      }
    });
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function sample(page, startedAt) {
  return page.evaluate((startedAtArg) => {
    const number = value => {
      try {
        const result = Number(value);
        return Number.isFinite(result) ? result : null;
      } catch {
        return null;
      }
    };
    const log10 = value => {
      try {
        const result = Number(value.log10());
        return Number.isFinite(result) ? result : null;
      } catch {
        return null;
      }
    };
    const safe = fn => {
      try {
        return fn();
      } catch (error) {
        return { error: String(error?.message || error) };
      }
    };
    const ec4Study = safe(() => globalThis.TimeStudy.eternityChallenge(4));
    return {
      wallSeconds: Math.round((Date.now() - startedAtArg) / 100) / 10,
      pageIso: new Date().toISOString(),
      reality: number(player.realities),
      eternitiesLog10: log10(Currency.eternities.value),
      infinities: number(Currency.infinities.value),
      infinitiesLog10: log10(Currency.infinities.value),
      infinitiesBanked: number(Currency.infinitiesBanked.value),
      infinitiesBankedLog10: log10(Currency.infinitiesBanked.value),
      infinitiesTotal: number(Currency.infinitiesTotal.value),
      infinitiesTotalLog10: log10(Currency.infinitiesTotal.value),
      ecDone: Array.from({ length: 12 }, (_, index) => number(EternityChallenge(index + 1).completions)),
      ecUnlocked: number(player.challenge.eternity.unlocked),
      ecRunning: EternityChallenge.isRunning === true,
      nextEc: number(globalThis.OrekiEternityAutomation?.nextUnfinishedEcId?.()),
      ecEntryPending: globalThis.OrekiEternityAutomation?.ecEntryPending?.() === true,
      ec4: ec4Study && typeof ec4Study === "object" && !ec4Study.error ? {
        bought: ec4Study.isBought === true,
        canBuy: ec4Study.canBeBought === true,
        current: number(ec4Study.requirementCurrent),
        total: number(ec4Study.requirementTotal),
        currentLog10: log10(ec4Study.requirementCurrent),
        totalLog10: log10(ec4Study.requirementTotal),
        entryMet: ec4Study.isEntryGoalMet === true,
      } : ec4Study,
      eternityAutobuyer: safe(() => ({
        active: player.auto.eternity.isActive === true,
        mode: number(player.auto.eternity.mode),
        xHighestLog10: log10(player.auto.eternity.xHighest),
      })),
      canEternity: Player.canEternity === true,
      runtimeError: globalThis.OrekiEternityAutomation?._lastError || null,
    };
  }, startedAt);
}

async function main() {
  if (!savePath || !fs.existsSync(savePath)) {
    throw new Error(`--save 指向的存档不存在: ${savePath}`);
  }
  const saveText = fs.readFileSync(savePath, "utf8").trim();
  const server = await startServer(REPO);
  const browser = await chromium.launch({
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
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  try {
    const base = `http://127.0.0.1:${server.address().port}/index.html`;
    await page.goto(base, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.evaluate(save => {
      localStorage.clear();
      localStorage.setItem("dimensionSave", save);
      localStorage.setItem("dimensionTestSave", save);
    }, saveText);
    const startedAt = Date.now();
    await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForFunction(
      () => window.player && window.OrekiEternityAutomation && window.Currency,
      null,
      { timeout: 120_000 },
    );
    if (enableEternityAutobuyer) {
      await page.evaluate(() => {
        player.auto.autobuyersOn = true;
        player.auto.eternity.isActive = true;
      });
    }
    if (disableEcEntryHold) {
      await page.evaluate(() => {
        OrekiEternityAutomation.ecEntryPending = () => false;
      });
    }
    await page.screenshot({ path: path.join(out, "initial.png") });

    const samples = [];
    let completed = false;
    const initialEc4Completions = await page.evaluate(
      () => Number(EternityChallenge(4).completions),
    );
    let nextSampleAt = 0;
    while (Date.now() - startedAt < maxSeconds * 1000) {
      const elapsed = (Date.now() - startedAt) / 1000;
      if (elapsed >= nextSampleAt) {
        const current = await sample(page, startedAt);
        samples.push(current);
        fs.appendFileSync(path.join(out, "samples.jsonl"), `${JSON.stringify(current)}\n`);
        nextSampleAt = elapsed + sampleMs / 1000;
        if ((current.ecDone?.[3] ?? 0) > initialEc4Completions
          || (current.ecUnlocked ?? 0) === 4) {
          completed = true;
          break;
        }
      }
      await page.waitForTimeout(200);
    }
    const finalState = await sample(page, startedAt);
    await page.screenshot({ path: path.join(out, "final.png") });
    const checkpoint = await page.evaluate(() => {
      try {
        return GameStorage.exportModifiedSave();
      } catch (error) {
        return `ERROR: ${String(error?.message || error)}`;
      }
    });
    const checkpointPath = path.join(out, "checkpoint.txt");
    fs.writeFileSync(checkpointPath, `${checkpoint}\n`);
    const summary = {
      save: savePath,
      source: path.basename(REPO),
      maxSeconds,
      enableEternityAutobuyer,
      disableEcEntryHold,
      sampleCount: samples.length,
      ec4Progressed: completed,
      initial: samples[0] || null,
      final: finalState,
      checkpointPath,
      errors,
    };
    fs.writeFileSync(path.join(out, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
    console.log(JSON.stringify(summary, null, 2));
    if (!completed || errors.length) process.exitCode = 2;
  } finally {
    await context.close();
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

await main();
