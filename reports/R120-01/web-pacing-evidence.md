# R120-01 Web 节奏证据

## F=10000 历史新档合法通关

来源：`reports/R120-01/web-full-fixed/summary.json`，源码 SHA
`22a43324f121a18fd263b6208db990ac5a4e3165`。

- 浏览器：Chromium 159，手机视口 `412×915`
- 新档：`localStorage=[]`，开局 `realities=0`、`endState=0`、速度 `10000×`
- 异常：`pageerrors=[]`、`console_errors=[]`、冻结看门狗无记录
- 结果：`isGameEnd=true`，维持 180 秒未回退

| 阶段 | 墙钟 |
|---|---:|
| 首次无限 | 10.9 秒 |
| 打破无限 | 21 秒 |
| 首次永恒 | 271.1 秒 |
| 首次时间研究 | 311 秒 |
| DS6 / 膨胀研究 | 591 秒 |
| 首次现实 | 641 秒 |
| 莱特拉难度层 | 1100.9 秒 |
| Pelle 解锁 / doomed | 2051 秒 |
| `isGameEnd=true` | 2090.9 秒（34.85 分钟） |

这次跑次证明了合法结算路径和终局可达，但不满足五阶段节奏：实际墙钟远短于
`165–180` 分钟收尾目标。动态速度到达终点时为 `40000×`，但前 2090 秒中只有最后
约 9 秒发生两次自动升档，因此主要偏差不是动态停滞加速，而是 F=10000 的默认起点与
自动化推进整体过快。

## F=3000 双端默认对齐

Android 在 `OrekiGamePace.DEFAULT_SPEED` 中已采用 `3000×`。Web 本轮将
`GAME_SPEED_DEFAULT` 对齐为 `3000×`，已有合法本地设置不变。

真实 Chromium 新档验证 `reports/R120-01/speed-default/results.json`：

- 空存储新档：`factor=3000`、`stored=null`、动态升档开启，PASS
- 已保存 `10000` 后重载：仍为 `10000`，未被新默认覆盖，PASS
- `pageErrors=[]`、`consoleErrors=[]`

## 尚未完成

F=3000 的真实新档完整墙钟和五阶段时间线仍是 `NOT RUN`。不能用上述 2 秒 smoke
或 F=10000 的 34.85 分钟历史跑次冒充最终节奏验收。
