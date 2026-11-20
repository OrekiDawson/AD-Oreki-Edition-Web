# R120-01 Web Pages 部署与线上冒烟

## 源码与 CI 身份

- MOD 版本：`Oreki Edition 1.0.2`
- Web 上游冻结基线：`5409e320cecef96a917cca1dfb68f1f183e499ca`
- Web 源码 SHA：`de2626805965a24c852352fad6abcdb0f5173dc9`
- 证据 PR：#91（合并提交即上述 SHA）
- 精确源码 CI：`44655186495`（Node checks / Mobile Chromium smoke 均成功）
- Pages 请求工作流：`44655447122`
- Pages 正式部署工作流：`44655489477`
- 部署开始（UTC）：`2026-11-20T01:41:50Z`
- 部署完成（UTC）：`2026-11-20T01:43:44Z`
- 可回退的上一版：Web `b87cfe181d0d84d035f916a021204b07ca47d5cc`
  （Pages Run `44393247049`，成功）

## 部署结果

- Pages 工作流：`PASS`
- `https://oreki.net/deployment.json`：

```json
{
  "web_sha": "de2626805965a24c852352fad6abcdb0f5173dc9",
  "web_ci_run_id": 44655186495
}
```

- `https://oreki.net/src/core/speed-config.js` 与本地文件逐字节一致：
  SHA-256 `2ef221b0e6dafef42f52e0efc79f0b5f411244ef4cd570e482eb2b40b6bf438a`，
  大小 15074 字节。

## 线上 Chromium 冒烟

- URL：`https://oreki.net/`
- HTTP：`200`
- Playwright：`1.65.1`
- Chromium：`159.0.8154.6`
- 移动视口：412×915、DPR 2.625、touch、`zh-CN`
- 全新浏览器上下文，无已有 storage
- `GameSpeed.factor=3000`
- `GameSpeed.isDynamic=true`
- `OrekiSmartExecutor.intervalSec=10`
- Console errors：0
- Page errors：0

本冒烟只验证线上入口、默认真实配置和基础错误状态；“线上完整 180 分钟运行”
仍以本地真实长跑和线上资源一致性为依据，不声称线上又独立执行了一次 180 分钟长跑。
