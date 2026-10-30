// 绾夸笂楠屾敹锛歍ick Speed 璐拱鍣ㄩ棿闅旂缉鏀惧紑鍏筹紙榛樿鍏抽棴 / 涓?AD 寮€鍏崇嫭绔?/ 鐢熸晥锛?// 鐢ㄦ硶锛?//   node verify-live-tickspeed.mjs                  鈫?鐩存帴鎵?https://oreki.net
//   node verify-live-tickspeed.mjs --serve-deploy   鈫?鏈湴鎵樼 _deploy/site锛堜笌绾夸笂鍚屽瓧鑺傦級鍚庨獙鏀?import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import puppeteer from "puppeteer-core";

const SERVE_DEPLOY = process.argv.includes("--serve-deploy");
const DEPLOY_DIR = path.resolve("C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/_deploy/site");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".webm": "video/webm", ".mp3": "audio/mpeg", ".ttf": "font/ttf",
  ".woff": "font/woff", ".woff2": "font/woff2", ".otf": "font/otf", ".ico": "image/x-icon" };

let server = null;
let URL = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "https://oreki.net/";
if (SERVE_DEPLOY) {
  server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const f = path.join(DEPLOY_DIR, p);
    if (!f.startsWith(DEPLOY_DIR)) { res.writeHead(403).end(); return; }
    fs.readFile(f, (err, data) => {
      if (err) { res.writeHead(404).end("nf"); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
      res.end(data);
    });
  });
  await new Promise(r => server.listen(8098, "127.0.0.1", r));
  URL = "http://127.0.0.1:8098/";
}

const EDGE = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find(p => fs.existsSync(p));

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  鈥?${detail}` : ""}`);
  ok ? pass++ : fail++;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE, headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio", "--no-proxy-server", "--ignore-certificate-errors"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });
const errs = [];
page.on("pageerror", e => errs.push(String(e.message).slice(0, 160)));

const resp = await page.goto(URL, { waitUntil: "load", timeout: 120000 });
check("绾夸笂棣栭〉杩斿洖 200", resp && resp.status() === 200, `HTTP ${resp && resp.status()}`);

let ready = false;
for (let i = 0; i < 40; i++) {
  ready = await page.evaluate(() => {
    try { return typeof player !== "undefined" && typeof Tabs !== "undefined" && typeof GameSpeed !== "undefined"; } catch (e) { return false; }
  }).catch(() => false);
  if (ready) break;
  await sleep(2000);
}
check("娓告垙鍒濆鍖栧畬鎴?, ready);
if (!ready) { await browser.close(); process.exit(1); }

// 娓呮帀鏈満閬楃暀鐨勫紑鍏崇姸鎬侊紝妯℃嫙棣栨璁块棶
await page.evaluate(() => {
  window.localStorage.removeItem("oreki-autobuyer-interval-scale");
  window.localStorage.removeItem("oreki-tickspeed-autobuyer-interval-scale");
});
await page.reload({ waitUntil: "load", timeout: 120000 });
for (let i = 0; i < 40; i++) {
  ready = await page.evaluate(() => { try { return typeof player !== "undefined"; } catch (e) { return false; } }).catch(() => false);
  if (ready) break;
  await sleep(2000);
}

await page.evaluate(() => {
  player.antimatter = new Decimal("1e100");
  player.records.totalAntimatter = new Decimal("1e100");
  GameUI.update();
  const opt = Tabs.all.find(t => t.config.key === "options");
  opt.show();
  opt.subtabs.find(s => s.key === "gameplay").show();
});
await sleep(1500);

const before = await page.evaluate(() => {
  const ts = document.querySelector(".c-oreki-speed__tickspeed-toggle");
  const ad = document.querySelector(".c-oreki-speed__autobuyer-toggle:not(.c-oreki-speed__tickspeed-toggle)");
  return {
    hasTs: !!ts, hasAd: !!ad,
    tsText: ts ? ts.textContent.replace(/\s+/gu, " ").trim() : "",
    adText: ad ? ad.textContent.replace(/\s+/gu, " ").trim() : "",
    tsFlag: GameSpeed.scaleTickspeedAutobuyerInterval,
    adFlag: GameSpeed.scaleAutobuyerInterval,
    hasScope: document.body.innerText.includes("浠呭奖鍝?Tick Speed 鑷姩璐拱鍣?),
  };
});
check("绾夸笂璁剧疆椤靛嚭鐜?Tick Speed 寮€鍏?, before.hasTs, `銆?{before.tsText}銆峘);
check("绾夸笂涓や釜寮€鍏抽兘榛樿鍏抽棴", before.tsFlag === false && before.adFlag === false && before.tsText.endsWith("鍏抽棴"),
  `ts=${before.tsFlag} ad=${before.adFlag}`);
check("绾夸笂鏂囨鍖呭惈浣滅敤鑼冨洿", before.hasScope);

// 鎵撳紑 AD 寮€鍏筹細Tick Speed 蹇呴』涓嶅彈褰卞搷
await page.evaluate(() => document.querySelector(".c-oreki-speed__autobuyer-toggle:not(.c-oreki-speed__tickspeed-toggle)").click());
await sleep(400);
const adOnly = await page.evaluate(() => {
  const adB = Autobuyer.antimatterDimension.zeroIndexed[0];
  const tsB = Autobuyer.tickspeed;
  return {
    adFlag: GameSpeed.scaleAutobuyerInterval,
    tsFlag: GameSpeed.scaleTickspeedAutobuyerInterval,
    adEff: adB.effectiveInterval, adRaw: adB.interval,
    tsEff: tsB.effectiveInterval, tsRaw: tsB.interval,
  };
});
check("鍙紑 AD 寮€鍏虫椂 Tick Speed 闂撮殧涓嶅彉锛堢嚎涓婄‘璁や簰鐩哥嫭绔嬶級",
  adOnly.adFlag === true && adOnly.tsFlag === false && adOnly.tsEff === adOnly.tsRaw,
  `ad ${adOnly.adRaw}鈫?{adOnly.adEff}锛泃s ${adOnly.tsRaw}鈫?{adOnly.tsEff}`);

// 鍏?AD銆佸紑 Tick Speed
await page.evaluate(() => document.querySelector(".c-oreki-speed__autobuyer-toggle:not(.c-oreki-speed__tickspeed-toggle)").click());
await sleep(300);
await page.evaluate(() => document.querySelector(".c-oreki-speed__tickspeed-toggle").click());
await sleep(500);
const tsOn = await page.evaluate(() => {
  const adB = Autobuyer.antimatterDimension.zeroIndexed[0];
  const tsB = Autobuyer.tickspeed;
  return {
    tsFlag: GameSpeed.scaleTickspeedAutobuyerInterval,
    stored: window.localStorage.getItem("oreki-tickspeed-autobuyer-interval-scale"),
    text: document.querySelector(".c-oreki-speed__tickspeed-toggle").textContent.replace(/\s+/gu, " ").trim(),
    tsEff: tsB.effectiveInterval, tsRaw: tsB.interval,
    adEff: adB.effectiveInterval, adRaw: adB.interval,
    factor: getGlobalSpeedFactor(),
  };
});
check("绾夸笂鐐瑰嚮鍚?Tick Speed 寮€鍏崇敓鏁堝苟鎸佷箙鍖?,
  tsOn.tsFlag === true && tsOn.stored === "1" && tsOn.text.endsWith("寮€鍚?),
  `flag=${tsOn.tsFlag} stored=${tsOn.stored}`);
check("绾夸笂 Tick Speed 闂撮殧 = interval / 鍊嶇巼銆丄D 涓嶅彈鐗佃繛",
  Math.abs(tsOn.tsEff - tsOn.tsRaw / tsOn.factor) < 1e-9 && tsOn.adEff === tsOn.adRaw,
  `ts ${tsOn.tsRaw}鈫?{tsOn.tsEff}锛團=${tsOn.factor}锛夛紱ad ${tsOn.adRaw}鈫?{tsOn.adEff}`);

check("绾夸笂鏃犳湭鎹曡幏寮傚父", errs.length === 0, errs.slice(0, 3).join(" | "));

await browser.close();
if (server) server.close();
console.log(`\n===== ${pass}/${pass + fail} 閫氳繃 =====`);
process.exit(fail ? 1 : 0);
