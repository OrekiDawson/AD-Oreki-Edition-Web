// 成就工具 + 存档工具 验收
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "../AD-Oreki-Edition");
const port = Number(process.argv[3] || 8088);
const outDir = path.resolve(process.argv[4] || "./shots");
fs.mkdirSync(outDir, { recursive: true });

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webm": "video/webm", ".mp3": "audio/mpeg", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf", ".eot": "application/vnd.ms-fontobject", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404).end(); return; } res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" }); res.end(d); });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", args: ["--no-sandbox", "--disable-gpu", "--mute-audio"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 950 });
const errs = [];
page.on("pageerror", e => errs.push(e.message));
const results = [];
const check = (n, p, d = "") => { results.push({ n, p }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };

await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));

const openOptions = () => page.evaluate(() => {
  player.antimatter = new Decimal("1e100");
  GameUI.update();
  const opt = Tabs.all.find(t => t.config.key === "options");
  opt.show();
  opt.subtabs.find(s => s.key === "gameplay").show();
});
await openOptions();
await new Promise(r => setTimeout(r, 800));

// ---------- 成就工具 ----------
await page.evaluate(() => Modal.orekiAchievement.show());
await new Promise(r => setTimeout(r, 900));
const modal1 = await page.evaluate(() => ({
  open: !document.querySelector(".c-oreki-tool") ? false : document.body.innerText.includes("成就工具"),
  hasAck: !!document.querySelector(".c-oreki-tool__ack input"),
  hasWarning: document.body.innerText.includes("作弊式"),
}));
check("成就工具弹窗打开并有风险提示", modal1.open && modal1.hasWarning);
check("成就工具默认未勾选确认（不会自动执行）", modal1.hasAck);
await page.screenshot({ path: path.join(outDir, "achievement-modal.png") });

const beforeCounts = await page.evaluate(() => ({
  normal: OrekiAchievementTool.normalUnlocked,
  secret: OrekiAchievementTool.secretUnlocked,
}));

// 未勾选时「解锁」按钮根本不应出现
const blocked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "解锁");
  return { found: !!btn, inUi: btn ? !!btn.closest("#ui") : null };
});
const afterBlocked = await page.evaluate(() => OrekiAchievementTool.normalUnlocked);
check("未勾选确认时不存在「解锁」按钮（无法误触发）", !blocked.found && afterBlocked === beforeCounts.normal,
  `解锁数 ${beforeCounts.normal} → ${afterBlocked}`);

// 勾选 → 全部 → 预览数量 → 确认
await page.evaluate(() => {
  document.querySelector(".c-oreki-tool__ack input").click();
});
await page.evaluate(() => {
  [...document.querySelectorAll(".c-oreki-tool__scope-btn")].find(b => b.textContent.trim() === "全部成就").click();
});
await new Promise(r => setTimeout(r, 500));
const previewText = await page.evaluate(() => document.querySelector(".c-oreki-tool__hint").textContent.trim());
check("切换到「全部成就」后显示预览数量", /将解锁\s*\d+\s*个成就/.test(previewText), previewText.replace(/\s+/g, " ").slice(0, 60));
const confirmReady = await page.evaluate(() =>
  [...document.querySelectorAll("button")].some(b => b.textContent.trim() === "解锁"));
check("勾选后「解锁」按钮出现", confirmReady);

await page.screenshot({ path: path.join(outDir, "achievement-modal-ready.png") });
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "解锁").click();
});
await new Promise(r => setTimeout(r, 1500));
const afterUnlock = await page.evaluate(() => ({
  normal: OrekiAchievementTool.normalUnlocked,
  secret: OrekiAchievementTool.secretUnlocked,
  normalTotal: OrekiAchievementTool.normalTotal,
  secretTotal: OrekiAchievementTool.secretTotal,
  modalClosed: !document.querySelector(".c-oreki-tool"),
  bitsValid: player.achievementBits.every(b => Number.isInteger(b) && b >= 0),
  secretBitsValid: player.secretAchievementBits.every(b => Number.isInteger(b) && b >= 0),
}));
check("确认后全部成就被解锁", afterUnlock.normal === afterUnlock.normalTotal && afterUnlock.secret === afterUnlock.secretTotal,
  `普通 ${afterUnlock.normal}/${afterUnlock.normalTotal}，隐藏 ${afterUnlock.secret}/${afterUnlock.secretTotal}`);
check("执行后弹窗自动关闭", afterUnlock.modalClosed);
check("成就位图字段仍为合法整数（未写入非法 ID）", afterUnlock.bitsValid && afterUnlock.secretBitsValid);

// ---------- 存档工具 ----------
// 解锁成就时游戏自身的弹窗（如成就 55 的提示）会排在队列前面，先清空队列
await page.evaluate(() => Modal.hideAll());
await new Promise(r => setTimeout(r, 400));
await page.evaluate(() => Modal.orekiSave.show());
await new Promise(r => setTimeout(r, 900));
const saveModal = await page.evaluate(() => {
  const text = document.body.innerText;
  return {
    open: !!document.querySelector(".c-oreki-tool__info"),
    hasVersion: /存档版本/.test(text),
    hasAch: /成就/.test(text),
    hasImport: !!document.querySelector(".c-oreki-tool__textarea"),
    hasReset: text.includes("重置当前存档"),
  };
});
check("存档工具显示基本信息", saveModal.open && saveModal.hasVersion && saveModal.hasAch);
check("存档工具提供导入框与重置入口", saveModal.hasImport && saveModal.hasReset);
await page.screenshot({ path: path.join(outDir, "save-modal.png") });

// 备份
await page.evaluate(() => [...document.querySelectorAll(".c-oreki-tool__btn")].find(b => b.textContent.trim() === "立即备份").click());
await new Promise(r => setTimeout(r, 600));
const backup = await page.evaluate(() => {
  const raw = localStorage.getItem("oreki-save-backup");
  return { exists: !!raw, len: raw ? JSON.parse(raw).data.length : 0 };
});
check("立即备份写入本地快照", backup.exists && backup.len > 100, `${backup.len} 字符`);

// 非法导入（分步等待 Vue 更新）
await page.evaluate(() => {
  const ta = document.querySelector(".c-oreki-tool__textarea");
  ta.value = "这不是一个有效存档，只是一段随手输入的无关文本内容";
  ta.dispatchEvent(new Event("input", { bubbles: true }));
});
await new Promise(r => setTimeout(r, 400));
await page.evaluate(() => document.querySelector(".c-oreki-tool__ack input").click());
await new Promise(r => setTimeout(r, 400));
await page.evaluate(() => [...document.querySelectorAll(".c-oreki-tool__btn")].find(b => b.textContent.trim() === "导入").click());
await new Promise(r => setTimeout(r, 800));
const badImport = await page.evaluate(() => document.querySelector(".c-oreki-tool__status")?.textContent.trim() || "");
check("非法存档文本被拒绝并给出提示", /不像是有效存档|无法解析|校验/.test(badImport), badImport.slice(0, 60));

// 合法往返导入
const roundtrip = await page.evaluate(() => {
  const text = OrekiSaveTool.exportText();
  const r = OrekiSaveTool.importText(text);
  return { ok: r.ok, message: r.message, ach: OrekiAchievementTool.normalUnlocked };
});
await new Promise(r => setTimeout(r, 1500));
const afterImport = await page.evaluate(() => OrekiAchievementTool.normalUnlocked);
check("导出文本可原样导入（往返一致）", roundtrip.ok && afterImport === roundtrip.ach,
  `${roundtrip.message}；成就数 ${roundtrip.ach} → ${afterImport}`);

check("无未捕获异常", errs.length === 0, errs.slice(0, 2).join(" | "));

await browser.close();
server.close();
const failed = results.filter(r => !r.p);
console.log(`\n===== ${results.length - failed.length}/${results.length} 通过 =====`);
process.exit(failed.length ? 1 : 0);
