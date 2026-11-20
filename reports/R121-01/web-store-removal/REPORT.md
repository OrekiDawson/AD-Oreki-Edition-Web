# R121-01 Web STD/IAP 商店移除

## 结果

- 生产入口：PASS。商店页签固定不可解锁，`ShopTab`、购买弹窗、IAP 重置弹窗与支付初始化已移除。
- 数值效果：PASS。11 个旧商店购买键的 `currentMult` 均为中性 `1`；历史 IAP 开关与购买次数不能恢复效果。
- 购买动作：PASS。商店购买、复活、6 小时和 24 小时时间跳跃均返回失败，未推进游戏时间。
- 旧存档：PASS。保留 `IAP.enabled`、`IAP.checkoutSession`、`options.confirmations.respecIAP` 和 `GameDatabase.shopPurchases` 键，保存并重载后仍无商店效果。
- 原版互通：PASS。冻结上游 `5409e320cecef96a917cca1dfb68f1f183e499ca` 的真实存档导入本版、导出后由实际原版页面再次导入，再回传本版；两端 `checkPlayerObject` 均无错误。
- 手机 GUI：PASS。Pixel 7 / 412×915 触控上下文无商店导航项，无商店 DOM，页面错误 0，支付请求 0。

## 证据

- `mobile-store-removed.png`：412×915 实际页面。
- `mobile-sidebar.png`：手机侧栏实际展开截图，只显示维度、自动化、成就、统计数据、选项，无商店。
- `result.json`：商店不可达、全部倍率中性、无支付 API 与网络请求的手机页面只读快照。
- `.github/tests/web-store-removal.spec.mjs`：自动化回归，包含历史购买状态、重载和原版双向存档往返。
- `savestates/original/new-save.txt`：上游冻结基线真实新档，SHA-256 `2dd3c80baf76570893ea6b829e3d964e30b7c3fce8289b14897ce77d1147509a`。

## 验证

- Playwright 全套：8/8 PASS，其中原版互通专项使用 `UPSTREAM_INTEROP_URL` 实际运行上游页面。
- Node/阶段/自动化/调度/部署规则/教程检查：全部 PASS。
- 商店移除不等于完整游戏节奏验收；Web 总终局与五阶段结论仍以新的独立真实长跑为准。
