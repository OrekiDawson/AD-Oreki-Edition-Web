# R104/R121-01 Web 真实新档终局证据

## 来源

- 原始运行源码：`9ee0b214dc5ef3b963f8b62b6d1124a34d4b4a52`
- 当前冻结发布源码：`b799e2341eb2feb409f290eeb4c04d2dfde23ea0`
- `9ee0b214` 是 `b799e234` 的祖先；两者在 `src/`、`public/` 与
  `index.html` 上无差异，仅后续增加证据与部署审计文件。
- 浏览器：Playwright Chromium `159.0.8154.6`
- 视口：412×915，DPR 2.625，移动触控，`zh-CN`
- 新档：全新 browser context，storage 为空；默认 `3000×`

## 结果

- 首次真实 `player.isGameEnd=true`：
  `2026-11-20T00:46:50.094Z`
- 开始时间：`2026-11-19T21:52:38.957Z`
- 真实墙钟：`10451.1s`（174.19 分钟）
- 硬上限：10800s
- 结果：**PASS**
- Pelle 解锁与末日态：`10421.1s`
- 终态：`endState=1.025575`、`realities=65`、`doomed=true`
- 页面错误、控制台错误、冻结告警：0

## 文件

- `summary.json`：完整机器可读摘要
- `samples.jsonl.gz`：真实采样序列
- `run.log.gz`：运行日志
- `console.log.gz`：浏览器控制台日志

本目录是持久证据副本；原始报告仍保留在
`reports/R120-01/web-final-3000-r2-20261120/`。
