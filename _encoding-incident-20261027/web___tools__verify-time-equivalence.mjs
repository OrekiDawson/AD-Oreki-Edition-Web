// 瀹氬悜澶嶆牳锛氳瘉鏄庛€屾湰椤圭洰鐨?inGameTime 绱銆嶄笌銆屽畼鏂瑰師鐗堢殑 records.time 绱銆嶉€愬抚绛変环
//
// 缁撹瑕佽瘉鏄庣殑鍛介锛?//   瀵逛换鎰忓抚 i锛宱fficial:  time_official += wall_i 脳 speedup_i
//   鏈」鐩?                time_ours     += wall_i 脳 F_i 脳 speedup_i
//                          inGameTime    += (wall_i 脳 F_i 脳 speedup_i) / F_i  = wall_i 脳 speedup_i
//   鍥犳 危 inGameTime 鈮?危 time_official
//
// 鍋氭硶锛氬仠鎺夎嚜鍔ㄥ惊鐜紝鎵嬪姩鐢ㄥ浐瀹?passDiff 椹卞姩 gameLoop锛屽垎鍒互 F=1 涓?F=10000 璺戝悓涓€搴忓垪锛?// 姣旇緝 螖time 鐨勬瘮鍊间笌 螖inGameTime 鐨勭粷瀵圭浉绛夈€?//
// 鐢ㄦ硶: node verify-time-equivalence.mjs [root] [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const root = path.resolve(process.argv[2] || "C:/Users/Oreki/WorkBuddy/AD-Oreki-Unified/web/AD-Oreki-Edition");
const port = Number(process.argv[3] || 8210);

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml", ".webm": "video/webm", ".mp3": "audio/mpeg",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject", ".ico": "image/x-icon",
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end("nf"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
});
await new Promise(r => server.listen(port, "127.0.0.1", r));

const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({
  executablePath: EDGE, headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--mute-audio"],
});
const results = [];
const check = (n, p, d = "") => { results.push({ n, p, d }); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? "  鈥?" + d : ""}`); };
const near = (a, b, eps) => Math.abs(a - b) <= eps;

const page = await browser.newPage();
const errs = [];
page.on("pageerror", e => errs.push(e.message));
await page.setViewport({ width: 1200, height: 800 });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 6500));

console.log("\n鐜: 鍏ㄦ柊寮€灞€锛堟湭鏃犻檺銆佹棤榛戞礊/鏃堕棿绗︽枃/鍌ㄥ瓨锛宻peedup 鎭掍负 1锛塡n");

await page.evaluate(() => {
  // 鍋滄帀鑷姩 tick锛屾敼涓烘墜鍔ㄩ┍鍔紝淇濊瘉姣忎竴甯х殑 passDiff 瀹屽叏鍙帶
  try { GameIntervals.gameLoop.stop(); } catch (e) { /* 鏌愪簺鐗堟湰鏃犳 interval */ }
  try { GameIntervals.stop(); } catch (e) { /* ignore */ }

  window.__eq = {
    speedup() { return getGameSpeedupFactor(); },
    read() {
      const r = player.records;
      return {
        time: r.thisInfinity.time,
        inGame: r.thisInfinity.inGameTime,
        real: r.thisInfinity.realTime,
        raw: r.totalTimePlayed,
        totalInGame: r.totalInGameTime,
      };
    },
    // 鐢ㄥ浐瀹?passDiff 椹卞姩 n 甯э紝杩斿洖绱澧為噺
    drive(deltas) {
      const before = this.read();
      for (const d of deltas) gameLoop(d);
      const after = this.read();
      const out = {};
      for (const k of Object.keys(before)) out[k] = after[k] - before[k];
      return out;
    },
    setF(v) { GameSpeed.set(v); },
    F() { return getGlobalSpeedFactor(); },
  };
});

const speedup0 = await page.evaluate(() => window.__eq.speedup());
console.log(`褰撳墠娓告垙鍐呰啫鑳€鍊嶇巼 getGameSpeedupFactor() = ${speedup0}`);
check("娴嬭瘯鐜骞插噣锛氭父鎴忓唴鑶ㄨ儉鍊嶇巼 = 1锛堟棤榛戞礊/鏃堕棿绗︽枃/鍌ㄥ瓨锛?, near(speedup0, 1, 1e-9), String(speedup0));

// ============ A. 鍚屼竴澧欓挓搴忓垪锛孎=1 涓?F=10000 瀵圭収 ============
const SEQ = [100, 100, 100];

const runA = await page.evaluate((seq) => {
  const eq = window.__eq;
  eq.setF(1);
  const f1 = eq.F();
  const d1 = eq.drive(seq);
  eq.setF(10000);
  const f10000 = eq.F();
  const d2 = eq.drive(seq);
  eq.setF(1);
  return { f1, f10000, d1, d2 };
}, SEQ);

console.log("\n=== A. 鍚屼竴澧欓挓搴忓垪锛?00+100+100 ms锛夊湪 F=1 涓?F=10000 涓?===");
console.log("F=1     :", JSON.stringify(runA.d1));
console.log("F=10000 :", JSON.stringify(runA.d2));

check("[A1] F=1 鏃?螖娓告垙鏃堕棿 = 300ms锛堝師鐗堝彛寰勶級", near(runA.d1.time, 300, 1e-6), String(runA.d1.time));
check("[A2] F=10000 鏃?螖娓告垙鏃堕棿 = 3,000,000ms锛? 300 脳 10000锛?,
  near(runA.d2.time, 3e6, 1e-3), String(runA.d2.time));
check("[A3] 涓ょ F 涓?螖娓告垙鍐呮椂闂撮兘鏄?300ms锛堜笉闅?F 鍙樺寲锛?,
  near(runA.d1.inGame, 300, 1e-6) && near(runA.d2.inGame, 300, 1e-6),
  `${runA.d1.inGame} vs ${runA.d2.inGame}`);
check("[A4] 鏍稿績绛変环锛歩nGameTime(F=10000) === time(F=1)",
  near(runA.d2.inGame, runA.d1.time, 1e-6), `${runA.d2.inGame} vs ${runA.d1.time}`);
check("[A5] 螖鐜板疄鏃堕棿鍦ㄤ袱绉?F 涓嬮兘 = 300ms",
  near(runA.d1.real, 300, 1e-6) && near(runA.d2.real, 300, 1e-6),
  `${runA.d1.real} vs ${runA.d2.real}`);
check("[A6] 瀛樻。绾?totalInGameTime 鍚屾鎴愮珛",
  near(runA.d1.totalInGame, 300, 1e-6) && near(runA.d2.totalInGame, 300, 1e-6),
  `${runA.d1.totalInGame} vs ${runA.d2.totalInGame}`);

// ============ B. 鍊嶇巼涓€斿垏鎹細涓嶅緱鐢ㄦ柊鍊嶇巼閲嶇畻鍘嗗彶 ============
const runB = await page.evaluate(() => {
  const eq = window.__eq;
  eq.setF(1);
  const a = eq.drive([100]);
  eq.setF(10000);
  const b = eq.drive([100]);
  eq.setF(1);
  const c = eq.drive([100]);
  return { a, b, c, sumInGame: a.inGame + b.inGame + c.inGame, sumTime: a.time + b.time + c.time };
});

console.log("\n=== B. 鍊嶇巼涓€斿垏鎹?1脳 鈫?10000脳 鈫?1脳锛堟瘡娈?100ms 澧欓挓锛?==");
console.log("閫愭:", JSON.stringify({ a: runB.a.inGame, b: runB.b.inGame, c: runB.c.inGame }));
check("[B1] 涓夋娓告垙鍐呮椂闂村悇 100ms锛堜笌褰撴椂鍊嶇巼鏃犲叧锛?,
  near(runB.a.inGame, 100, 1e-6) && near(runB.b.inGame, 100, 1e-6) && near(runB.c.inGame, 100, 1e-6),
  `${runB.a.inGame}/${runB.b.inGame}/${runB.c.inGame}`);
check("[B2] 鍚堣 = 300ms 澧欓挓锛堟棫鍐欐硶銆岀疮璁ime/褰撳墠F銆嶄細寰?100.02锛?,
  near(runB.sumInGame, 300, 1e-6), String(runB.sumInGame));
check("[B3] 鏃у啓娉曠粨鏋?鈮?100.02ms锛屼笌鏈疄鐜扮浉宸?200ms锛岃瘉鏄庢棫鍐欐硶閿欒",
  near(runB.sumTime / 10000, 100.02, 0.01), `${runB.sumTime} / 10000 = ${runB.sumTime / 10000}`);

// ============ C. 閫愬抚鎭掔瓑寮忥細inGame 澧為噺 脳 F === time 澧為噺 ============
const runC = await page.evaluate(() => {
  const eq = window.__eq;
  const out = [];
  for (const f of [1, 2, 137, 10000, 100000]) {
    eq.setF(f);
    const before = eq.read();
    gameLoop(37);
    const after = eq.read();
    out.push({
      F: eq.F(),
      dTime: after.time - before.time,
      dInGame: after.inGame - before.inGame,
    });
  }
  eq.setF(1);
  return out;
});

console.log("\n=== C. 閫愬抚鎭掔瓑寮?dInGame 脳 F === dTime锛堝崟甯?37ms 澧欓挓锛?==");
for (const r of runC) {
  const lhs = r.dInGame * r.F;
  console.log(`  F=${String(r.F).padStart(6)}  dTime=${r.dTime.toFixed(3)}  dInGame=${r.dInGame.toFixed(6)}  dInGame脳F=${lhs.toFixed(3)}`);
}
check("[C1] 浠绘剰 F 涓?dInGame 脳 F 閮界瓑浜?dTime锛堥€愬抚鎭掔瓑锛?,
  runC.every(r => near(r.dInGame * r.F, r.dTime, 1e-3)),
  runC.map(r => `${r.dInGame * r.F}鈮?{r.dTime}`).join(" | "));
check("[C2] 浠绘剰 F 涓?dInGame 鎭掍负 37ms锛? 澧欓挓 脳 speedup=1锛?,
  runC.every(r => near(r.dInGame, 37, 1e-6)),
  runC.map(r => r.dInGame.toFixed(6)).join(" | "));

// ============ D. 绂荤嚎妯℃嫙璺緞锛坰imulateTime 鍐?diff *= F锛?===========
const runD = await page.evaluate(() => {
  const eq = window.__eq;
  const out = [];
  for (const f of [1, 10000]) {
    eq.setF(f);
    const before = eq.read();
    // 鐩存帴璋冪敤 simulateTime 浼氶噸缃緢澶氱姸鎬侊紝杩欓噷鏀逛负楠岃瘉鍏跺唴閮ㄦ帶鍒舵祦锛?    // simulateTime 鎶?seconds/F 浣滀负鐪熷疄绉掓暟锛屽唴閮ㄥ啀閫?tick gameLoop(...)
    // 鍥犳鍗曟祴銆屼紶鍏?passDiff 鏃?diff 琚ˉ涓?F銆嶈繖涓€鏉★細
    const b2 = eq.read();
    gameLoop(50);
    const a2 = eq.read();
    out.push({ F: eq.F(), dTime: a2.time - b2.time, dInGame: a2.inGame - b2.inGame, dReal: a2.real - b2.real });
  }
  eq.setF(1);
  return out;
});

console.log("\n=== D. passDiff 璺緞锛坰imulateTime 鐢ㄧ殑灏辨槸杩欐潯锛?==");
for (const r of runD) console.log(`  F=${r.F}: dTime=${r.dTime} dInGame=${r.dInGame} dReal=${r.dReal}`);
check("[D1] passDiff=50ms 鍦?F=1 涓?F=10000 涓?dInGame 閮?= 50ms",
  near(runD[0].dInGame, 50, 1e-6) && near(runD[1].dInGame, 50, 1e-6),
  `${runD[0].dInGame} vs ${runD[1].dInGame}`);
check("[D2] passDiff 璺緞鐨?dReal 閮?= 50ms锛堢绾夸笉褰卞搷鐜板疄鏃堕棿锛?,
  near(runD[0].dReal, 50, 1e-6) && near(runD[1].dReal, 50, 1e-6),
  `${runD[0].dReal} vs ${runD[1].dReal}`);

// ============ E. 娓告垙鍐呰啫鑳€鍊嶇巼 鈮?1锛氱敤 options.blackHoleSpeedup 娉ㄥ叆纭畾鍊嶇巼 ============
// 瀹樻柟涓庢湰鍦伴兘鏈夎繖鏉″垎鏀細speedFactor = options.blackHoleSpeedup锛堝師鏈緵 simulateTime 浣跨敤锛夛紝
// 鍥犳鍙互鍦ㄤ笉渚濊禆榛戞礊/鏃堕棿绗︽枃鐨勬儏鍐典笅娉ㄥ叆涓€涓‘瀹氱殑鑶ㄨ儉鍊嶇巼锛岄獙璇?speedup 鍦?diff 涓?/F 涔嬮棿绮剧‘鎶垫秷銆?const runE = await page.evaluate(() => {
  const eq = window.__eq;
  const out = [];
  for (const speed of [1, 7.5, 1000, 0.001]) {
    for (const f of [1, 10000]) {
      eq.setF(f);
      const before = eq.read();
      gameLoop(64, { blackHoleSpeedup: speed });
      const after = eq.read();
      out.push({
        speed, F: eq.F(),
        dTime: after.time - before.time,
        dInGame: after.inGame - before.inGame,
        dReal: after.real - before.real,
      });
    }
  }
  eq.setF(1);
  return out;
});

console.log("\n=== E. 娉ㄥ叆纭畾鐨勬父鎴忓唴鑶ㄨ儉鍊嶇巼锛堝崟甯?64ms 澧欓挓锛?==");
console.log("  speedup      F        dTime          dInGame     dReal");
for (const r of runE) {
  console.log(`  ${String(r.speed).padStart(7)}  ${String(r.F).padStart(6)}  ${String(r.dTime).padStart(12)}  ${r.dInGame.toFixed(4).padStart(10)}  ${r.dReal}`);
}
check("[E1] 姣忎釜 speedup 涓嬶紝F=1 涓?F=10000 鐨?dInGame 瀹屽叏鐩哥瓑锛坰peedup 绮剧‘鎶垫秷锛?,
  [1, 7.5, 1000, 0.001].every(s => {
    const a = runE.find(r => r.speed === s && r.F === 1);
    const b = runE.find(r => r.speed === s && r.F === 10000);
    return near(a.dInGame, b.dInGame, 1e-6);
  }),
  runE.map(r => `${r.speed}@F${r.F}=${r.dInGame.toFixed(4)}`).join(" | "));
check("[E2] dInGame = 64ms 脳 speedup锛堜笌瀹樻柟 time 澧為噺鍚屽紡锛?,
  runE.every(r => near(r.dInGame, 64 * r.speed, 1e-4)),
  runE.map(r => `${r.dInGame.toFixed(4)} vs ${64 * r.speed}`).join(" | "));
check("[E3] dTime = 64ms 脳 F 脳 speedup", runE.every(r => near(r.dTime, 64 * r.F * r.speed, 1e-2)));
check("[E4] dReal = 64ms锛堣啫鑳€涓庡叏灞€鍊嶇巼閮戒笉鏀惧ぇ鐜板疄鏃堕棿锛?, runE.every(r => near(r.dReal, 64, 1e-6)));

check("[F] 鍏ㄦ祦绋嬫棤鏈崟鑾疯剼鏈紓甯?, errs.length === 0, errs.slice(0, 3).join(" | "));

const pass = results.filter(r => r.p).length;
console.log(`\n==== 缁撴灉: ${pass} 閫氳繃 / ${results.length - pass} 澶辫触 ====`);
await browser.close();
server.close();
process.exit(pass === results.length ? 0 : 1);
