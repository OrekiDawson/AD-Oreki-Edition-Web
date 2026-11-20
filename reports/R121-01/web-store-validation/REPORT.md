# R121-01 Web 商店移除候选真实新档验收

## 候选与运行

- 源码 Commit：`327792cf6c446699e1b6498df9877abee8894706`
- 源码工作树：clean
- 浏览器：Playwright 1.65.1 / Chromium 159.0.8154.6
- 视口：Pixel 7 等效 412×915、DPR 2.625、touch、zh-CN
- 新档：全新 browser context，document 起始与页面加载后双重清空 localStorage；出生时反物质 10、Infinity/Eternity/Reality 全 0
- 默认：游戏速度 3000×、动态速度开启、调度 tick 10 秒
- 观测约束：不改游戏时间源，不写资源、阶段、结算或存档；仅做 10 秒只读采样与截图

## 真实节点

| 节点 | 真实墙钟 |
| --- | ---: |
| 首次 Infinity | 11.9 秒 |
| 首次 Break | 42.0 秒 |
| 首次 Eternity | 761.9 秒（12 分 41.9 秒） |
| 首次时间研究 | 812.0 秒（13 分 32 秒） |
| DS6 / 首次膨胀研究 | 3502.0 秒（58 分 22 秒） |
| 首次 Reality / 5 现实 | **3512.0 秒（58 分 32 秒）** |
| 主动停止 | 约 3564.5 秒（59 分 24.5 秒） |

运行期间始终保持 3000×，动态升档次数为 0。357 个采样、57 张截图；pageerror、console error、采样错误均为 0。

## 五项门禁

| 门禁 | 状态 | 依据 |
| --- | --- | --- |
| GAMEPLAY LEGALITY | **PASS（本次观测范围）** | 空新档真实推进；Infinity、Break、Eternity、时间研究、DS6、Reality 均由游戏机制触发；未发现伪造资源、非法解锁或外部写存档。 |
| PACING | **FAIL** | 首次 Reality 58.53 分钟，早于正式 70 分钟阻断线 11.47 分钟，远超 ±5 分钟容差。 |
| ENDGAME | **NOT RUN** | PACING FAIL 后按门禁停止无效终局长跑。 |
| POST-ENDGAME STABILITY | **NOT RUN** | 未进入终局。 |
| SAVE COMPATIBILITY | **NOT RUN（完整矩阵）** | 商店功能 PR 的自动门禁已覆盖原版新档与真实首次永恒档双向；本次长跑未在 Reality 稳定点导出并完成原版往返。 |

## 结论

该候选商店移除后的合法前中期运行正常，但首次 Reality 仍明显提前，正式判定为 **PACING FAIL**，不得晋升稳定版或发布。下一步必须先修复 Reality 过早出现的直接根因，再定向复测首次 Reality；在 PASS 前不重跑完整终局。

## 文件

- `summary.json`：结构化运行与门禁结论。
- `samples.jsonl.gz`：357 条逐 10 秒采样。
- `run.log.gz`、`console.log.gz`：运行与控制台日志。
- `00-start.png`：空新档起点。
- `evt-01-infinity-t12s.png`、`evt-02-break-t42s.png`、`evt-03-eternity-t762s.png`：关键阶段截图。
- `evt-07-reality-t3512s.png`：首次 Reality 阻断证据。
