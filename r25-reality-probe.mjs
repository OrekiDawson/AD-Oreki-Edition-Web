// R25 第 6 步：真实执行一次 Reality，并观测解锁后的状态（只执行 + 观测，不写后续自动化）
// 用法：node r25-reality-probe.mjs [项目目录] [端口] [最长等待秒]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { launchBrowser, openGame } from "./lib/edge-launch.mjs";

const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8805);
const WAIT = Number(process.argv[4] || 120);

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".ico": "image/x-icon",
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(root, "." + p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    res.end(d);
  });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const { browser, cleanup } = await launchBrowser({ port: Number(process.env.OREKI_EDGE_PORT || 9444) });
const { page, errors } = await openGame(browser, { port });

// 统计所有 console error（比 pageerror 更宽）
let consoleErrors = 0;
const consoleSamples = [];
page.on("console", m => {
  if (m.type() === "error") {
    consoleErrors++;
    if (consoleSamples.length < 3) consoleSamples.push(m.text().slice(0, 200));
  }
});

await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
await page.reload({ waitUntil: "load", timeout: 60000 });
for (let i = 0; i < 150; i++) {
  const ok = await page.evaluate(() => {
    try { return typeof player === "object" && typeof AntimatterDimension === "function"; }
    catch { return false; }
  }).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 400));
}

const snap = () => page.evaluate(() => {
  const p = f => { try { return f(); } catch (e) { return `ERR ${e.message}`; } };
  return {
    realities: p(() => player.realities),
    maxEPexp: p(() => player.records.thisReality.maxEP.exponent),
    ecDone: p(() => { const o=[]; for(let i=1;i<=12;i++){ try{ o.push(EternityChallenge(i).completions); }catch(e){ o.push(-1); } } return o.join(","); }),
    dilStudies: p(() => player.dilation.studies.join(",")),
    realityStudy: p(() => TimeStudy.reality.isBought === true),
    canReality: p(() => isRealityAvailable() === true),
    et: p(() => player.eternities.toString()),
    epLog: p(() => Currency.eternityPoints.value.log10()),
    gainedRM: p(() => MachineHandler.gainedRealityMachines.toString()),
    rm: p(() => Currency.realityMachines.value.toString()),
    glyphInvLen: p(() => player.reality.glyphs.inventory.length),
    glyphInvSample: p(() => JSON.stringify(player.reality.glyphs.inventory.slice(0, 2))),
    glyphActive: p(() => JSON.stringify(player.reality.glyphs.active)),
    glyphProtected: p(() => JSON.stringify(player.reality.glyphs.protectedRows)),
    realityKeys: p(() => Object.keys(player.reality).join(",")),
    realityUpgradeBits: p(() => player.reality.upgradeBits),
    perkPoints: p(() => player.reality.perkPoints),
    seed: p(() => String(player.reality.seed)),
    unlockedEC: p(() => player.reality.unlockedEC),
    glyphSelectionActive: p(() => GlyphSelection.active === true),
    tabUnlocked: p(() => ({ reality: Tab.reality.isUnlocked, glyphs: Tab.glyphs.isUnlocked, perks: Tab.perks.isUnlocked })),
    progressFlags: p(() => ({
      realityUnlocked: PlayerProgress.realityUnlocked(),
      current: PlayerProgress.current.isRealityUnlocked,
    })),
    blackHoleUnlocked: p(() => BlackHole(1).isUnlocked === true),
    machineHandler: p(() => ({ name: typeof MachineHandler, hasGained: typeof MachineHandler.gainedRealityMachines })),
    automatorUnlocked: p(() => AutomationTabUnlocked?.() ?? null),
  };
});

console.log("=== R25 Reality 执行 + 观测 ===");
let before = null;
const t0 = Date.now();
while (Date.now() - t0 < WAIT * 1000) {
  const s = await snap();
  if (s.canReality === true) { before = s; break; }
  await new Promise(r => setTimeout(r, 1000));
}
if (!before) {
  console.log("!! 等待超时：", WAIT, "秒内 canReality 未变 true");
  const s = await snap();
  console.log("末态:", JSON.stringify(s));
  console.log("console error:", consoleErrors, consoleSamples);
  await cleanup(); server.close(); process.exit(1);
}
console.log("Reality 前:", JSON.stringify(before, null, 0));

// 真实执行：manual reality 路径（与玩家点「现实」一致：锁种子 + 送初始/同伴符文 + 全部奖励）
const doReality = await page.evaluate(() => {
  try {
    if (!isRealityAvailable()) return "not available";
    const animOn = player.options.animations.reality;
    // 关掉 10 秒动画再走真实的 processManualReality 路径；不改任何结算逻辑
    player.options.animations.reality = false;
    processManualReality(false, undefined);
    player.options.animations.reality = animOn;
    return "ok";
  } catch (e) {
    return `ERR ${e.message}\n${e.stack}`;
  }
});
console.log("执行 processManualReality(false, undefined) ->", doReality);

await new Promise(r => setTimeout(r, 2500));
const after = await snap();
console.log("Reality 后:", JSON.stringify(after, null, 0));

const probe = await page.evaluate(() => {
  const p = f => { try { return f(); } catch (e) { return `ERR ${e.message}`; } };
  return {
    realities: p(() => player.realities),
    realityCountViaMachines: p(() => MachineHandler.realities.toString()),
    rm: p(() => Currency.realityMachines.value.toString()),
    rmGain: p(() => MachineHandler.gainedRealityMachines.toString()),
    glyphsInventory: p(() => player.reality.glyphs.inventory.map(g => ({ type: g.type, strength: String(g.strength), level: g.level, id: g.id }))),
    activeGlyphs: p(() => player.reality.glyphs.active.length),
    glyphKeys: p(() => player.reality.glyphs.inventory.length ? Object.keys(player.reality.glyphs.inventory[0]).join(",") : ""),
    perkPoints: p(() => player.reality.perkPoints),
    perkTree: p(() => Perk.firstPerk.isBought),
    upgradeBits: p(() => player.reality.upgradeBits),
    unlockedEC: p(() => player.reality.unlockedEC),
    tabUnlocked: p(() => ({ reality: Tab.reality.isUnlocked, glyphs: Tab.glyphs.isUnlocked, perks: Tab.perks.isUnlocked })),
    realityUpgradeCount: p(() => RealityUpgrades.all.filter(u => u.isBought).length),
    canBuyUpgrade: p(() => RealityUpgrades.all.slice(0, 6).map(u => ({ id: u.id, can: u.canBeBought, cost: String(u.cost) }))),
    blackHole: p(() => ({ un1: BlackHole(1).isUnlocked, unlocked: player.blackHole.map(b => b.unlocked) })),
    glyphSelection: p(() => ({ active: GlyphSelection.active, choiceCount: GlyphSelection.choiceCount, level: String(gainedGlyphLevel()) })),
    automator: p(() => ({ unlocked: typeof Automator !== "undefined", isActive: Automator?.isActive })),
    achievementsNow: p(() => Achievements.all.filter(a => a.isUnlocked).length),
  };
});
console.log("Reality 后详细:", JSON.stringify(probe, null, 0));
console.log("console error 数:", consoleErrors, JSON.stringify(consoleErrors ? consoleSamples : []));
console.log("pageerror 数:", errors.length, JSON.stringify(errors.slice(0, 3)));

await cleanup();
server.close();
process.exit(0);
