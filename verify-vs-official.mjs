// 原版 vs 本项目 运行时行为对比
// 用法: node verify-vs-official.mjs <mineDir> [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(process.argv[2] ?? "../_deploy/site");
const PORT = Number(process.argv[3] ?? 8300);
const OFFICIAL = "https://ivark.github.io/AntimatterDimensions/";

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webm": "video/webm",
  ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".woff": "font/woff",
  ".woff2": "font/woff2", ".txt": "text/plain",
};

function serve(root, port) {
  return new Promise(res => {
    const s = http.createServer((req, rq) => {
      const p = decodeURIComponent(req.url.split("?")[0]);
      let f = path.join(root, p);
      if (p.endsWith("/")) f = path.join(f, "index.html");
      if (!f.startsWith(root)) { rq.writeHead(403).end(); return; }
      fs.readFile(f, (e, d) => {
        if (e) { rq.writeHead(404).end("nf"); return; }
        rq.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] ?? "application/octet-stream" });
        rq.end(d);
      });
    });
    s.listen(port, "127.0.0.1", () => res(s));
  });
}

const EDGE = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find(p => fs.existsSync(p));

// 每项: [分组, 名称, 函数体(返回可比较的字符串/数字)]
// 所有函数体都是「先固定状态，再读数」，保证两边起点一致
const CASES = [
  ["时长显示", "format 1e100", `return format(new Decimal("1e100"))`],
  ["时长显示", "format 1234567.89", `return format(new Decimal("1234567.89"))`],
  ["时长显示", "format 0.00001", `return format(new Decimal("0.00001"))`],
  ["时长显示", "formatX 1000", `return formatX(new Decimal(1000))`],
  ["时长显示", "format 1e6 保留 3 位", `return format(new Decimal("1e6"), 3, 3)`],

  ["反物质维度", "各层基础成本", `return [1,2,3,4,5,6,7,8].map(t => AntimatterDimension(t).cost.toString()).join(" | ")`],
  ["反物质维度", "各层基础倍率", `return [1,2,3,4,5,6,7,8].map(t => AntimatterDimension(t).multiplier.toString()).join(" | ")`],
  ["反物质维度", "AD1 买 10 次后成本", `player.dimensions.antimatter[0].bought = 10; return AntimatterDimension(1).cost.toString()`],
  ["反物质维度", "AD8 买 50 次后成本", `player.dimensions.antimatter[7].bought = 50; return AntimatterDimension(8).cost.toString()`],
  ["反物质维度", "AD 购买数量上限(无加成)", `return String(AntimatterDimension(1).boughtBefore10)`],
  ["反物质维度", "基础 TickSpeed 成本", `return Tickspeed.cost.toString()`],
  ["反物质维度", "基础 TickSpeed 倍率", `return Tickspeed.multiplier.toString()`],
  ["反物质维度", "买 10 次 TickSpeed 后成本", `player.totalTickBought = 10; return Tickspeed.cost.toString()`],
  ["反物质维度", "TickSpeed 硬上限", `return String(Tickspeed.costScale ? "有缩放" : "无缩放")`],

  ["Dimension Boost", "Boost 需求", `return (typeof DimensionBoost !== "undefined" ? DimensionBoost.requirement.toString() : "N/A")`],
  // 注：维度倍率随 bought 变化需要跨 tick 才生效（AD 内部按 tick 重算），
  // 故此项由 probe-bought.mjs 单独验证（两侧同为 1 → 等待 600ms → 2/32，完全一致）。

  ["Antimatter Galaxy", "Galaxy 需求", `return Galaxy.requirement.toString()`],
  ["Antimatter Galaxy", "Galaxy 成本倍率", `return Galaxy.costMult.toString()`],
  ["Antimatter Galaxy", "Galaxy 效果", `return String(Galaxy.effectValue)`],
  ["Antimatter Galaxy", "Galaxy 基础数量", `return String(player.galaxies)`],

  ["Infinity", "1e308 反物质的 IP 收益", `
    player.antimatter = new Decimal("1e308");
    return gainedInfinityPoints().toString();`],
  ["Infinity", "1e1000 反物质的 IP 收益", `
    player.antimatter = new Decimal("1e1000");
    return gainedInfinityPoints().toString();`],
  ["Infinity", "ID1 成本", `return InfinityDimension(1).cost.toString()`],
  ["Infinity", "ID1 倍率", `return InfinityDimension(1).multiplier.toString()`],
  ["Infinity", "ID8 成本", `return InfinityDimension(8).cost.toString()`],
  ["Infinity", "无限升级 dim18mult 成本", `return InfinityUpgrade.dim18mult.cost.toString()`],
  ["Infinity", "无限升级 dim27mult 成本", `return InfinityUpgrade.dim27mult.cost.toString()`],
  ["Infinity", "无限升级 buy10Mult 成本", `return InfinityUpgrade.buy10Mult.cost.toString()`],
  ["Infinity", "无限升级 totalTimeMult 成本", `return InfinityUpgrade.totalTimeMult.cost.toString()`],

  ["Eternity", "1000 永恒点的永恒收益", `
    player.eternityPoints = new Decimal(1000);
    return gainedEternities().toString();`],
  ["Eternity", "1e10 永恒点的永恒收益", `
    player.eternityPoints = new Decimal("1e10");
    return gainedEternities().toString();`],
  ["Eternity", "TD1 成本", `return TimeDimension(1).cost.toString()`],
  ["Eternity", "TD1 倍率", `return TimeDimension(1).multiplier.toString()`],
  ["Eternity", "TS11 成本", `return TimeStudy(11).cost.toString()`],
  ["Eternity", "TS41 成本", `return TimeStudy(41).cost.toString()`],
  ["Eternity", "TS171 成本", `return TimeStudy(171).cost.toString()`],
  ["Eternity", "Dilation 升级 1 成本", `return DilationUpgrade.dtGain.cost.toString()`],
  ["Eternity", "永恒挑战数量", `return String(Object.keys(player.eternityChalls).length)`],
  ["Eternity", "普通挑战数量", `return String(Object.keys(player.challenge).length) + "类 / 普通挑战记录" + String(player.challenge.normal.bestTimes.length) + "条"`],

  ["Reality", "机器收益(默认态)", `return MachineHandler.gainedRealityMachines.toString()`],
  ["Reality", "现实升级 1 成本", `return RealityUpgrade(1).cost.toString()`],
  ["Reality", "符文强度基础值", `return String(Glyphs.baseStrength ?? "N/A")`],
  ["Reality", "perk 总数", `return String(Perks.all.length)`],
  ["Reality", "thisReality 字段数", `return String(Object.keys(player.records.thisReality).length)`],

  ["后期机制", "黑洞加速时长常量", `return String(BlackHoles.ACCELERATION_TIME)`],
  ["后期机制", "黑洞1 持续时长", `return String(BlackHole(1).duration)`],
  ["后期机制", "黑洞1 间隔", `return String(BlackHole(1).interval)`],
  ["后期机制", "黑洞1 默认是否解锁", `return String(BlackHole(1).isUnlocked)`],
  ["后期机制", "Pelle 是否毁灭态", `return String(Pelle.isDoomed)`],

  ["自动购买器", "AD 自动购买器默认间隔", `return Autobuyer.antimatterDimension(1).interval.toString()`],
  ["自动购买器", "BigCrunch 自动购买器间隔", `return Autobuyer.bigCrunch.interval.toString()`],
  ["自动购买器", "Eternity 自动购买器默认解锁态", `return String(Autobuyer.eternity.isUnlocked)`],
  ["自动购买器", "自动购买器条目数", `return String(Object.keys(Autobuyer).length)`],
  ["自动购买器", "AD1 自动购买器默认解锁态", `return String(Autobuyer.antimatterDimension(1).isUnlocked)`],

  ["升级效果", "无限升级 dim18mult 效果", `return String(InfinityUpgrade.dim18mult.effectValue)`],
  ["升级效果", "无限升级 buy10Mult 效果", `return String(InfinityUpgrade.buy10Mult.effectValue)`],
  ["升级效果", "无限升级 totalTimeMult 效果", `return String(InfinityUpgrade.totalTimeMult.effectValue)`],
  ["升级效果", "击破无限 totalAMMult 效果", `return String(BreakInfinityUpgrade.totalAMMult.effectValue)`],
  ["升级效果", "击破无限 currentAMMult 效果", `return String(BreakInfinityUpgrade.currentAMMult.effectValue)`],
  ["升级效果", "击破无限 galaxyBoost 效果", `return String(BreakInfinityUpgrade.galaxyBoost.effectValue)`],
  ["升级效果", "Dilation dtGain 效果", `return String(DilationUpgrade.dtGain.effectValue)`],
  ["升级效果", "TS11 效果", `return String(TimeStudy(11).effectValue)`],
  ["升级效果", "TS21 效果", `return String(TimeStudy(21).effectValue)`],
  ["升级效果", "TS31 效果", `return String(TimeStudy(31).effectValue)`],
  ["升级效果", "TS32 效果(无限维度倍率)", `return TimeStudy(32).isBought ? String(TimeStudy(32).effectValue) : "未购买(两侧同)"`],
  ["升级效果", "现实升级1 效果", `return String(RealityUpgrade(1).effectValue)`],
  ["升级效果", "首个 Perk 效果", `return String(Perks.all[0].effectValue)`],

  ["重置规则", "初始无限次数", `return String(Currency.infinities.value)`],
  ["重置规则", "初始永恒次数", `return String(Currency.eternities.value)`],
  ["重置规则", "初始现实次数", `return String(Currency.realities.value)`],
  ["重置规则", "初始是否已击破无限", `return String(player.break)`],
  ["重置规则", "初始 Dilation 是否解锁", `return String(player.dilation.unlocked)`],
  ["重置规则", "初始关卡挑战记录", `return String(Object.keys(player.records.thisInfinity).length)`],

  ["存档结构", "player 顶级字段数", `return String(Object.keys(player).length)`],
  ["存档结构", "存档版本", `return String(player.version)`],
  ["存档结构", "records 字段数", `return String(Object.keys(player.records).length)`],

  ["成就", "普通成就总数", `return String(Achievements.all.length)`],
  ["成就", "隐藏成就总数", `return String(SecretAchievements.all.length)`],
];

async function collect(page) {
  const out = [];
  for (const [group, name, body] of CASES) {
    let value;
    try {
      value = await page.evaluate(new Function(body));
    } catch (e) {
      value = "ERR: " + String(e && e.message ? e.message : e).slice(0, 80);
    }
    out.push({ group, name, value: String(value).replace(/\s+/g, " ").trim() });
  }
  return out;
}

const s = await serve(ROOT, PORT);
const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: "new",
  args: ["--no-sandbox", "--proxy-server=http://127.0.0.1:7897",
    "--proxy-bypass-list=127.0.0.1;localhost", "--ignore-certificate-errors"],
});

const pOff = await browser.newPage();
const offErrs = [];
pOff.on("pageerror", e => offErrs.push(String(e.message).slice(0, 100)));
await pOff.goto(OFFICIAL, { waitUntil: "load", timeout: 120000 });
await new Promise(r => setTimeout(r, 12000));

const pMine = await browser.newPage();
const mineErrs = [];
pMine.on("pageerror", e => mineErrs.push(String(e.message).slice(0, 100)));
await pMine.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "load", timeout: 120000 });
await new Promise(r => setTimeout(r, 8000));

const off = await collect(pOff);
const mine = await collect(pMine);

let same = 0, diff = 0, both = 0;
const rows = [];
for (let i = 0; i < CASES.length; i++) {
  const a = off[i].value, b = mine[i].value;
  const eq = a === b;
  if (eq) same++; else diff++;
  if (a.startsWith("ERR") && b.startsWith("ERR")) both++;
  rows.push({ group: off[i].group, name: off[i].name, off: a, mine: b, eq });
}

const groups = [...new Set(rows.map(r => r.group))];
console.log("\n══════════════ 原版 vs 本项目 逐项对比 ══════════════\n");
for (const g of groups) {
  console.log(`【${g}】`);
  for (const r of rows.filter(x => x.group === g)) {
    const mark = r.eq ? "一致  " : "★差异 ";
    console.log(`  ${mark} ${r.name}`);
    if (!r.eq) {
      console.log(`         原版: ${r.off}`);
      console.log(`         本项目: ${r.mine}`);
    }
  }
  console.log("");
}

console.log("══════════════ 汇总 ══════════════");
console.log(`总项数 ${CASES.length}｜完全一致 ${same}｜存在差异 ${diff}｜两侧均不可用 ${both}`);
console.log("原版控制台错误:", offErrs.slice(0, 3).join(" | ") || "无");
console.log("本项目控制台错误:", mineErrs.slice(0, 3).join(" | ") || "无");

fs.writeFileSync("../_research/vs-official-result.json", JSON.stringify(rows, null, 2));

await browser.close();
s.close();
