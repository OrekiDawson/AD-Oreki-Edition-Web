#!/usr/bin/env node
// 移动端适配测试门禁：Android 模拟器内核浏览器核验
// 细则见 docs/移动端适配测试门禁.md，条款见 AGENTS.md §5-A
//
// 用法：
//   node mobile-gate.mjs                 只读检查（不切前台应用）
//   node mobile-gate.mjs --launch        额外做规则 4 的运行态核验（会切走当前前台应用）
//   node mobile-gate.mjs --json out.json 保存记录
//   node mobile-gate.mjs --latest 156.0.8078.48   离线时手工指定最新稳定版基线
//
// 退出码：0 通过 / 3 阻塞 / 2 环境缺失
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const val = (f, d = null) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const out = [];
const log = s => { out.push(s); console.log(s); };
const fail = (code, msg) => {
  log(msg);
  process.exit(code);
};

// ---------- adb 定位 ----------
function findAdb() {
  const cands = [
    val("--adb"),
    process.env.ADB,
    process.env.ANDROID_HOME && path.join(process.env.ANDROID_HOME, "platform-tools", "adb.exe"),
    process.env.ANDROID_SDK_ROOT && path.join(process.env.ANDROID_SDK_ROOT, "platform-tools", "adb.exe"),
    path.join(os.homedir(), "Android", "Sdk", "platform-tools", "adb.exe"),
    path.join(os.homedir(), "AppData", "Local", "Android", "Sdk", "platform-tools", "adb.exe"),
  ].filter(Boolean);
  for (const c of cands) if (fs.existsSync(c)) return c;
  try {
    const w = execFileSync("where", ["adb"], { encoding: "utf8" }).split(/\r?\n/)[0].trim();
    if (w && fs.existsSync(w)) return w;
  } catch { /* 未安装 */ }
  return null;
}

const ADB = findAdb();
if (!ADB) fail(2, "✗ 环境缺失：找不到 adb（设置 ADB 或 ANDROID_HOME，或用 --adb 指定）");

const adbRaw = (args, serial) => {
  const full = serial ? ["-s", serial, ...args] : args;
  try {
    return execFileSync(ADB, full, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).replace(/\r/g, "");
  } catch (e) {
    return (e.stdout || "").toString().replace(/\r/g, "");
  }
};

// ---------- 设备 ----------
const devicesTxt = adbRaw(["devices", "-l"]);
const deviceLines = devicesTxt.split("\n").filter(l => /^\S+\s+device\b/.test(l));
if (deviceLines.length === 0) fail(2, `✗ 环境缺失：没有在线设备\n${devicesTxt.trim()}`);
const serial = val("--serial") ||
  (deviceLines.find(l => l.startsWith("emulator-")) || deviceLines[0]).split(/\s+/)[0];
if (!/^emulator-/.test(serial)) {
  fail(2, `✗ 环境缺失：${serial} 不是 Android 模拟器（本门禁只针对模拟器）`);
}
const adb = args => adbRaw(args, serial);
const prop = k => adb(["shell", "getprop", k]).trim();

const avdName = path.basename(
  (adb(["shell", "getprop", "ro.kernel.qemu.avd_name"]).trim() || ""),
) || "未知";

// ---------- 设备画像 ----------
const androidVersion = prop("ro.build.version.release");
const sdk = prop("ro.build.version.sdk");
const abi = prop("ro.product.cpu.abi");
const wmSize = adb(["shell", "wm", "size"]).trim();
const wmDensity = adb(["shell", "wm", "density"]).trim();

// ---------- 浏览器候选 ----------
const KNOWN = {
  "com.android.chrome": { name: "Chrome for Android", stable: true },
  "org.chromium.webview_shell": { name: "Chromium WebView Shell（系统测试壳）", stable: false },
  "com.chrome.beta": { name: "Chrome Beta", stable: false },
  "com.brave.browser": { name: "Brave", stable: true },
  "com.microsoft.emmx": { name: "Edge for Android", stable: true },
  "org.chromium.chrome": { name: "Chromium (自编译)", stable: false },
};

const pkgList = adb(["shell", "pm", "list", "packages", "-f"]).split("\n");
const installed = [];
for (const line of pkgList) {
  const m = line.match(/^package:(.+)=([\w.]+)$/);
  if (!m) continue;
  const [, apkPath, pkg] = m;
  if (!/chrome|chromium|browser|webview/i.test(pkg)) continue;
  installed.push({ pkg, apkPath });
}
const versionOf = pkg => {
  const d = adb(["shell", "dumpsys", "package", pkg]);
  const v = (d.match(/versionName=([\w.\-]+)/) || [])[1] || null;
  const c = (d.match(/versionCode=(\d+)/) || [])[1] || null;
  const up = (d.match(/lastUpdateTime=([\d\- :]+)/) || [])[1] || null;
  return { version: v, versionCode: c, lastUpdateTime: up };
};
for (const it of installed) Object.assign(it, versionOf(it.pkg));

// 运行时 WebView 提供者（规则 4 的真值来源）
const wvDump = adb(["shell", "dumpsys", "webviewupdate"]);
const wvRuntime = (wvDump.match(/Current WebView package \(name, version\): \((\S+), ([\w.\-]+)\)/) || []);
const webviewProvider = wvRuntime[1] || null;
const webviewVersion = wvRuntime[2] || null;

// 默认 http 处理器
const resolveTxt = adb(["shell", "cmd", "package", "resolve-activity", "--brief",
  "-a", "android.intent.action.VIEW", "-d", "http://example.com"]);
const defaultHandler = (resolveTxt.split("\n").map(s => s.trim()).filter(s => /^[\w.]+\/[\w.]+$/.test(s)).pop() || "");
const defaultPkg = defaultHandler.split("/")[0] || null;

// ---------- 选定浏览器 ----------
const chrome = installed.find(i => i.pkg === "com.android.chrome");
const chosen = chrome || installed.find(i => i.pkg === defaultPkg) || installed[0] || null;
const meta = chosen ? (KNOWN[chosen.pkg] || { name: chosen.pkg, stable: false }) : null;

// Chromium 内核：WebView 壳/提供者取运行时 WebView 版本；独立浏览器取其自身版本
const isWebviewShell = chosen && /webview_shell|^com\.android\.webview$/.test(chosen.pkg);
const kernelVersion = isWebviewShell ? webviewVersion : (chosen ? chosen.version : null);
const majorOf = v => {
  const m = String(v || "").match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? Number(m[1]) : null;
};
const kernelMajor = majorOf(kernelVersion);

// ---------- 最新稳定版 ----------
const PROXY = process.env.OREKI_PROXY || "http://127.0.0.1:7897";
const latestArg = val("--latest");
let latest = null;
if (latestArg) {
  latest = { versions: [latestArg], majors: [majorOf(latestArg)].filter(Boolean), source: "--latest 手工指定" };
} else {
  try {
    const raw = execFileSync("curl", ["-s", "--max-time", "25", "--proxy", PROXY,
      "https://chromiumdash.appspot.com/fetch_releases?channel=Stable&platform=Android&num=4"],
    { encoding: "utf8" });
    const arr = JSON.parse(raw);
    const majors = [...new Set(arr.map(r => Number(r.milestone)))].sort((a, b) => b - a).slice(0, 2);
    latest = {
      versions: arr.filter(r => majors.includes(Number(r.milestone))).map(r => r.version),
      majors,
      source: "chromiumdash Stable/Android",
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    latest = null;
  }
}

// ---------- 规则 4：运行态核验（可选） ----------
let launch = null;
if (has("--launch") && chosen) {
  const url = val("--url", "about:blank");
  // 必须显式指定包名：模拟器里可能同时存在多个 http 处理器，不指定会落到系统 WebView 壳
  adb(["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", url, "-p", chosen.pkg]);
  await new Promise(r => setTimeout(r, 2500));
  const top = adb(["shell", "dumpsys", "activity", "activities"]);
  const topAct = (top.match(/topResumedActivity=ActivityRecord\{\S+ \S+ ([\w.]+)\//) || [])[1] || null;
  const pid = adb(["shell", "pidof", chosen.pkg]).trim();
  launch = { url, topPackage: topAct, pid: pid || null, foreground: topAct === chosen.pkg, alive: !!pid };
}

// ---------- 判定 ----------
const reasons = [];
let pass = true;
const block = r => { pass = false; reasons.push(r); };

if (!latest) block("无法确认最新稳定版（chromiumdash 不可达且未提供 --latest）");
if (!chosen) block("模拟器内没有任何 Chromium 内核浏览器");
if (chosen && !meta.stable) block(`选定的 ${chosen.pkg} 不是稳定版浏览器（系统 WebView 测试壳），不满足规则 1`);
if (latest && kernelMajor != null && !latest.majors.includes(kernelMajor)) {
  block(`内核 ${kernelMajor} 落后于最新稳定版 M${latest.majors[0]}${latest.majors[1] ? `/M${latest.majors[1]}` : ""}`);
}
if (kernelMajor == null) block("无法解析内核版本");
if (!has("--launch")) block("未执行运行态核验（规则 4），仅安装/文件检查不算通过；需加 --launch");
else if (launch && (!launch.foreground || !launch.alive)) block("启动后未确认前台 Activity 与进程");

// ---------- 记录 ----------
const record = {
  checkedAt: new Date().toISOString(),
  serial, avd: avdName === "未知" ? null : avdName,
  android: { version: androidVersion, sdk, abi, screen: wmSize, density: wmDensity },
  browser: chosen
    ? {
      name: meta.name, pkg: chosen.pkg, apkPath: chosen.apkPath,
      version: chosen.version, versionCode: chosen.versionCode, lastUpdateTime: chosen.lastUpdateTime,
      isStableBrowser: meta.stable,
    }
    : null,
  chromiumKernel: { version: kernelVersion, major: kernelMajor, source: isWebviewShell ? "dumpsys webviewupdate（运行时）" : "包 versionName" },
  webviewProvider: { pkg: webviewProvider, version: webviewVersion },
  defaultHttpHandler: defaultHandler || null,
  allBrowserPackages: installed.map(i => `${i.pkg} ${i.version}`),
  latestStable: latest,
  launchCheck: launch,
  verdict: pass ? "PASS" : "BLOCKED",
  reasons,
};

log("════════ 移动端适配门禁（Android 模拟器）════════");
log(`设备          : ${serial}${record.avd ? ` / AVD ${record.avd}` : ""}`);
log(`Android       : ${androidVersion} (SDK ${sdk}) / ${abi}`);
log(`屏幕          : ${wmSize.replace(/^Physical size:\s*/, "")} / ${wmDensity.replace(/^Physical density:\s*/, "")} dpi`);
log(`浏览类包      : ${record.allBrowserPackages.length ? record.allBrowserPackages.join(" ; ") : "无"}`);
if (chosen) {
  log(`选定浏览器    : ${meta.name} / ${chosen.pkg} / 版本 ${chosen.version}${chosen.lastUpdateTime ? ` / 最后更新 ${chosen.lastUpdateTime}` : ""}`);
  log(`  安装路径    : ${chosen.apkPath}`);
  log(`  来源推断    : ${chosen.apkPath.startsWith("/product/") || chosen.apkPath.startsWith("/system/") ? "系统镜像预装（非商店更新）" : "侧载/商店安装"}`);
} else {
  log("选定浏览器    : 无");
}
log(`运行时内核    : ${kernelVersion || "未知"}（${record.chromiumKernel.source}）`);
log(`默认 http 处理器: ${defaultHandler || "无"}`);
log(`最新稳定版    : ${latest ? `${latest.versions.join(" / ")}（M${latest.majors.join("/M")}，${latest.source}）` : "未知（无法查询）"}`);
if (launch) log(`运行态核验    : 前台=${launch.topPackage} pid=${launch.pid} → ${launch.foreground && launch.alive ? "已运行" : "未确认"}`);
log("");
log(`门禁结论      : ${pass ? "通过 ✅" : "阻塞 ❌"}`);
for (const r of reasons) log(`  - ${r}`);
log(`核验时间      : ${record.checkedAt}`);

const jsonOut = val("--json");
if (jsonOut) {
  fs.mkdirSync(path.dirname(path.resolve(jsonOut)), { recursive: true });
  fs.writeFileSync(jsonOut, JSON.stringify(record, null, 2), "utf8");
  log(`记录已写入    : ${jsonOut}`);
}

process.exit(pass ? 0 : 3);
