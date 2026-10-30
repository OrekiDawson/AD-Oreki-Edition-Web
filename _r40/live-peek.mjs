// 只读旁路：连到正在跑的 CDP（9374），现场读一次状态。不写任何字段。
import puppeteer from "puppeteer-core";
import { execSync } from "node:child_process";

const PORT = Number(process.env.OREKI_CDP_PORT || 9374);
const exe = (() => {
  const out = execSync("powershell -NoProfile -Command \"(Get-Process msedge -ErrorAction SilentlyContinue | Select-Object -First 1).Path\"", { encoding: "utf8" }).trim();
  return out || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
})();
const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null });
const pages = await browser.pages();
const page = pages.find(p => p.url().includes("127.0.0.1")) || pages[0];
const out = await page.evaluate(() => {
  const S = v => { try { return v === null || v === undefined ? null : v.toString(); } catch (e) { return null; } };
  const T = fn => { try { const v = fn(); return v === undefined ? null : v; } catch (e) { return String(e && e.message); } };
  const d = globalThis.OrekiDilationAutomation, c = globalThis.OrekiCelestialAutomation, e = globalThis.OrekiEndgameAutomation;
  return {
    t: Math.round((Date.now() - window.__r40T0) / 1000),
    realities: player.realities,
    thisRealSec: T(() => Time.thisRealityRealTime.totalSeconds.toFixed(1)),
    am: S(player.antimatter),
    break: player.break,
    // 谁在压现实
    dilHold: T(() => d.hold === true),
    dilPhase: T(() => d._phase), dilStep: T(() => d._step),
    dilHoldMs: T(() => Math.round(Date.now() - (d._holdSinceMs || 0))),
    coolMs: T(() => Math.round(d._cooldownUntilMs - Date.now())),
    celHold: T(() => c.holdReality === true),
    celPhase: T(() => c._phase),
    etHold: T(() => globalThis.OrekiEternityAutomation?.shouldHoldReset() === true),
    reHold: T(() => globalThis.OrekiRealityAutomation?.shouldHoldReset?.() === true),
    laiHold: T(() => e._laiHold),
    laiTier: T(() => Laitela.difficultyTier),
    laiEnt: T(() => player.celestials.laitela.entropy),
    laiRun: T(() => Laitela.isRunning),
    laiReal: T(() => (Laitela.entropyGainPerSecond)),
    laiMaxDim: T(() => Laitela.maxAllowedDimension),
    laiUnl: T(() => Laitela.isUnlocked),
    iu15: T(() => ImaginaryUpgrade(15).isBought),
    iu25: T(() => ImaginaryUpgrade(25).isBought),
    imL: T(() => Currency.imaginaryMachines.value.log10().toFixed(2)),
    imCap: T(() => MachineHandler.currentIMCap.toFixed(2)),
    eStep: T(() => e.step),
    eErr: T(() => e._lastError),
    ecs: T(() => { const a = []; for (let i = 1; i <= 12; i++) a.push(EternityChallenge(i).completions); return a.join(","); }),
    tt: T(() => Currency.timeTheorems.max.log10().toFixed(2)),
    maxDTL: T(() => player.records.thisReality.maxDT.pLog10().toFixed(2)),
    repL: T(() => player.records.thisReality.maxReplicanti.pLog10().toFixed(1)),
    infL: T(() => Currency.infinitiesTotal.value.pLog10().toFixed(1)),
    Vunl: T(() => VUnlocks.vAchievementUnlock.isUnlocked),
    mainProg: T(() => Object.entries(GameDatabase.celestials.v.mainUnlock).map(([k, v]) => `${k}:${v.progress().toFixed(3)}`).join(" ")),
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.disconnect();
