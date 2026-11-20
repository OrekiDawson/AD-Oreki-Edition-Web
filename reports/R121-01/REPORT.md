# R121-01 Web 定向复验

## 结论

- 线上 `https://oreki.net/`：**PASS**
- 线上部署源码：`b799e2341eb2feb409f290eeb4c04d2dfde23ea0`
- 已纳入的真实终局证据源码：`9ee0b214dc5ef3b963f8b62b6d1124a34d4b4a52`
- 历史真实新档终局：`isGameEnd=true`，`10451.1s`（174.19 分钟），
  `PASS`
- 本轮不重复完整终局长跑：**NOT RUN**

## Playwright 复验

环境为 Playwright Chromium、412×915 移动视口、DPR 2.625、触控、
简体中文。检查结果：

1. 入口 HTTP 200，最终地址仍为 `https://oreki.net/`。
2. 全新浏览器上下文默认 `GameSpeed.factor=3000`，未写入倍率偏好，
   动态倍率开启。
3. 初始 `realities=0`、`isGameEnd=false`、`doomed=false`，教程正常。
4. 写入合法 `10000×` 后重载，倍率与持久值均保留。
5. 页面错误、控制台错误、HTTP 错误和非导航网络失败均为 0。
6. 重载导航会主动取消背景视频及字体请求，记录为
   `ERR_ABORTED`，与资源 404/500 或加载失败区分。

一次复跑在等待页面完整 `load` 事件时遇到 45 秒网络超时，但同一进程没有
页面错误或 HTTP 错误；随后改为等待 `DOMContentLoaded` 并以
`GameUI.initialized`、`player`、`GameSpeed` 三项真实运行状态作为完成
条件，复验 PASS。该超时截图保留为
`99-transient-load-timeout.png`，不用于冒充功能失败或成功。

证据：

- `reports/R121-01/online-mobile-smoke.mjs`
- `reports/R121-01/online-mobile/results.json`
- `reports/R121-01/online-mobile/99-final.png`

## Pelle 偏晚定位

既有真实新档采样显示：

| 墙钟 | 状态 |
| ---: | --- |
| 3411.0s | 首次 Reality，`realities=5` |
| 6411.1s | `realities=20`，特蕾莎与全部现实升级完成 |
| 7651.1s | 莱特拉难度层达到 1，`realities=30` |
| 10421.1s | `realities=65`，此时才解锁 Pelle 并进入毁灭态 |
| 10451.1s | 原版 `isGameEnd=true` |

因此 Pelle 偏晚的主因是现实轮次与莱特拉链持续约 116.8 分钟，
而不是 Pelle 终局公式或毁灭态输出失败。进入毁灭态后 30 秒内完成真实
终局，当前 `endState` 公式无需调整。本轮不改门槛、不伪造现实次数，也
不以缩短终局目标掩盖轮次耗时。

## 跨端状态

- Web 已有真实终局 PASS 基线。
- Android 最终 APK 正使用 KVM AVD 从全新存档验收，结论待运行结果。
- 在 Android 结果完成前，不宣称双端终局已同时 PASS。

## 审查门禁

Kody 付费审查按用户令暂停。PR #93 创建时仓库既有触发器仍自动连接了
Kody，事件与处置见 `incident-kody-trigger.md`。PR 已立即关闭，Web 与
Android 的 `kody-trigger.yml` 工作流已禁用；本报告不把 Kody 状态记为
PASS，也不声称可确认费用为 0。
