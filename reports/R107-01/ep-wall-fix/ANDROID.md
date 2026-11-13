# Android 侧判断（只读分析，未改 Android 仓库）

## 1. PR #15（分支 `r105-ep-scale`）的条件

`scripts/payload/kotlin/kajfosz/antimatterdimensions/oreki/OrekiEpGainScale.kt`：

```kotlin
private fun readBootstrapRun(): Boolean {
    if (OrekiStageAuto.eternitiesZero()) return true
    val realities = GameApi.realitiesValue() ?: return false
    val cmp = GameApi.compareToDouble(realities, 0.0) ?: return false
    ...
}
```

即：**首次永恒之前**，或 **realities == 0** 时 EP 除数 308→30；一旦 `realities > 0`
就恢复 308。补丁点 `prestige.c.g()` 的 `308.0` 常量（`scripts/build_mod.py::patch_ep_gain_scale`）。

## 2. 与 Web 的差异

Web `isOrekiBootstrapRun()`（`src/core/oreki-bootstrap.js`）=
`!PlayerProgress.realityUnlocked() || TimeStudy.reality.isBought !== true`，
即 **每个现实内、直到买下膨胀研究 6（DS6/TimeStudy.reality）都算引导窗口**，除数保持 30。

而本次 Web 冻结现场 `realities=15, ds6=false` ⇒ Web 除数**已经是 30**。
所以：

- **PR #15 本身不足以解释/修复 EP e4000 墙**：墙发生在 realities>0 且 Web 除数已为 30 的阶段；
  墙的直接原因是原版自动永恒被接管后使用默认 `AMOUNT=1`，**每帧结算永恒**，
  `maxIP` 永远停在 SIP2 起始值 5e130，`gainedEP≈1e5.4` 远小于 EP e3683。
- PR #15 仍然**必要**：它修的是「首次永恒前用 308 除数导致 EP 曲线过慢」的问题，
  与本次墙是两个不同阶段。
- 若 Android 想让 EP 曲线与 Web 完全同口径，应把 `OrekiEpGainScale` 的窗口
  从 `realities == 0` 扩到 **Web 的 bootstrap 语义**（当前现实内 DS6 未买），
  否则首次现实后 Android 会比 Web 早退回 308。

## 3. Android 待移植/待核对清单（不修改 Android 仓库）

| # | 项 | 依据 | 优先级 |
|---|---|---|---|
| A1 | 核对 Android「自动永恒」接管/门禁是否等价于 Web 的 `X_HIGHEST ×10` 门槛，禁止出现「canEternity 即结算」 | 本次 Web P0；Lead AVD 已落地同源修复（30 min 26 次永恒/EC 推进） | P0（已由 Lead 处理，复核即可） |
| A2 | `OrekiEpGainScale` 窗口对齐 Web `isOrekiBootstrapRun()`（现实内 DS6 未买仍用 30） | Web `src/core/oreki-bootstrap.js` | P1 |
| A3 | 增加「realities≥15 后 EP 是否继续增长」的回归探针（真实墙钟 + 存档快照） | 本轮冻结只在 r15 后暴露 | P1 |
| A4 | 在 `docs/FACTS.md` 记录「AMOUNT=1 默认自动永恒 + SIP2/SAM 起始值」组合会钉死 maxIP 的机制 | 本轮证据 | P1 |
| A5 | 如果 Android 也要 180 min 门禁，增加从 r15 继续跑到 gameEnd 的长时间验证 | 本轮 Web 已验证 r15→r20+ | P1 |

## 4. 结论

- **PR #15 不是 EP e4000 墙的充分修复**（墙在它覆盖的窗口之外）。
- 真正的修复是「接管自动永恒时同时设置结算门槛」（Web 已修；Android 同源修复由 Lead 落地）。
- Android 与 Web 的 EP 除数窗口仍存在语义差异（A2），建议下一轮对齐并在 FACTS 记录。
