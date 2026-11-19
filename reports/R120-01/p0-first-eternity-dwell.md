# R120-01 P0：未解锁自动永恒绕过首次永恒驻留

## 结论

- 缺陷：**CONFIRMED**
- 根因修复与回归夹具：**PASS**
- 真实浏览器回归：见本文件“修复后验证”
- 首次完整 180 分钟通关：**NOT RUN**

## 真实新档复现

- 运行源：`r120-01/runtime-p0`，启动时 HEAD `1866dc881e64f48ae1384cf102aae24f1a29d272`
- 运行器：`reports/R107-01/runner/run-180min.mjs --mode full --probe-et 0`
- 浏览器：Playwright 1.65.1 + Chromium 159.0.8154.6
- 视口：412×915，移动端触控，简体中文
- 新档判定：`localStorage=[]`、`realities=0`、`break=false`、速度 10000×

关键时间线：

| 墙钟 | 事实 |
|---:|---|
| 11 s | 首次无限 |
| 21 s | `break=true` |
| 21–23 s | `player.auto.eternity.isActive=true`、`eAutoUnl=false` |
| 101 s | 首次永恒，`et>0` |
| 101 s | 立即进入时间研究 |

原版自动永恒在首次永恒时必然尚未解锁；R118/R119 为跨读档所有权会把未解锁的
`isActive` 持久化为 true。`firstEternityDwellRemainingMs()` 原先把该内部写入误判为
玩家亲自开启开关，因而在首帧 `canEternity` 直接放行，绕过 R115 的 180 s 驻留。

## 修复

- `src/core/oreki-eternity-automation.js`：只有自动器已解锁且真实开关为 true 时，
  才允许绕过首次永恒驻留。
- `scripts/check_eternity_gate.mjs`：新增“未解锁开关为 true 仍驻留”的回归；
  保留“已解锁玩家开关立即放行”的正向语义。
- 回归结果：177 项检查、0 失败。

## 证据

- `web-full/run.log`
- `web-full/samples.jsonl`
- `web-full/console.log`
- `web-full/screenshots/evt-03-eternity-t101s.png`
- `web-full/screenshots/evt-04-timestudy-t101s.png`

修复前跑次在发现 P0 后按 `FAIL_EARLY` 停止，不将 101 s 首永恒的新档继续用于 180 分钟结论。

## 修复后验证

修复后使用独立真实新档，先执行阶段门禁、MOD 总开关、托管购买器恢复和存档重载，
再等待首次永恒。必须证明 `et=0` 持续至少 180 s 驻留期，之后才允许真实结算。

结果：**PASS**

- 新档文档起点：`1795085563491`
- 首次无限：`+5.2 s`
- 打破无限：`+15.3 s`
- 首次永恒：`+269.2 s`（此前修复前为 `+101 s`）
- 首次现实：`+625.2 s`（`realities=5`、`stage=glyphs`）
- 阶段门禁、MOD 总开关、托管自动购买器恢复、存档 reload、首永恒、首现实：全部 PASS
- `consoleErrors=0`、`pageErrors=0`
- `requestFailures=4` 均为页面 reload 时浏览器主动 abort 的 `.webm` 背景视频，不是业务资源 404

证据：

- `web-gate-fixed/web-runtime-results.json`
- `web-gate-fixed/01-fresh-start.png`
- `web-gate-fixed/07-first-eternity.png`
- `web-gate-fixed/08-first-reality.png`
- `web-gate-fixed/09-post-reality-30s.png`
