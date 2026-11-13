# docs/FACTS.md / WEB_ANDROID_DIFFERENCES.md 建议条目（供 Lead 合并）

## A. `docs/FACTS.md` 新增（建议放在自动化/EP 相关事实之后）

```md
### C.xx EP e4000 墙（R107-01）：接管自动永恒时未设结算门槛

- 事实（2026-11-14 真实新档 + 逐帧诊断，`reports/R107-01/ep-wall-fix/ROOT-CAUSE.md`）：
  - R104（commit 62f41e7，P0-1）为打通首次永恒，在 100 次永恒里程碑解锁后把
    `player.auto.eternity.isActive` 置 true，但保留默认 `mode=AMOUNT(0), amount=1`。
  - 原版 `EternityAutobuyerState.willEternity` 在 AMOUNT 模式下只要有 EP 收益（≥ amount=1）
    且 `Player.canEternity` 为真就结算；**IP 的被动生成**（`preProductionGenerateIP`，
    `InfinityUpgrade.ipGen` / `BreakInfinityUpgrade.ipGen`）让 canEternity 很快恢复，
    形成近每帧的永恒重置。
  - 结果：`thisEternity.maxIP` 永远停在 SIP2 起始值 5e130；`gainedEP≈1e5.4`（EP 除数 30），
    而当前 EP 已 e3683 ⇒ EP 冻结、realities 卡 15、`isRealityAvailable()` 永假。
  - 冻结现场：AM=maxAM=5e130（SAM 起始值），维度全 0，`Autobuyer.antimatterDimension(1).canTick=true`
    但 `lastTick=0`；`pageErrors=0`；gameLoop 仍在运行（记录时间/被动生成在走）。
- 修复（Web 生产）：`src/core/oreki-eternity-automation.js::_adoptEternityAutobuyerIfNeeded()`
  接管时若原版配置仍为默认（AMOUNT=1 / xHighest=1），改一次
  `mode=X_HIGHEST(2), xHighest=10`；与 R50 的「EP 收益 ≥ 当前 EP ×10」同语义。
- 验证（真实新档，interval=1、固定 10000×、动态速度关闭）：
  - 修复前：realities=15、EP=e3683.25 冻结（A/B 主跑 2950.1 s、180 min 主跑 5890.1 s）。
  - 修复后：wall 410.8 s r5、573 s r10、654.2 s r15、731.2 s r20；冻结签名消失
    （无 AM=5e130 持续窗口）；EP 最高 log10≈3.56e6。
  - 49/49 定向验收复跑结果见 `reports/R107-01/ep-wall-fix/VERIFICATION.md`。
- 边界：只改「接管时的自动永恒门槛配置」，不改 EP 公式、EP 除数、`isRealityAvailable()`
  门槛、存档字段或进度；不覆盖玩家自定义配置。
```

## B. `WEB_ANDROID_DIFFERENCES.md` 新增行（自动化/EP 表）

```md
| 自动永恒结算门槛（R107-01） | 接管原版自动永恒时一次性把默认 AMOUNT=1 改为 X_HIGHEST ×10（仅默认配置、新档会话首次接管）；避免每帧永恒重置钉死 maxIP | Android 同源门禁（Lead AVD 已落地同源修复：修复后 30 min 26 次永恒/EC 推进）；实现位置不同，语义须等价 | 已同步（2026-11-14 Web 修复）；Android 复核见 R107-01 ANDROID.md |
| EP 除数引导窗口 | `isOrekiBootstrapRun()`：现实未解锁 **或** 当前现实 DS6 未买 → 除数 30，否则 308 | 分支 `r105-ep-scale`：`eternitiesZero() || realities==0` → 30，realities>0 即 308 | **未对齐**：Android 窗口更窄；建议下一轮把 Android 条件扩到「当前现实 DS6 未买」 |
```

## C. 备注

- 以上为片段，未直接修改共享文档；合并时请保留原有编号/表格风格。
- 证据路径：`reports/R107-01/ep-wall-fix/`（ROOT-CAUSE.md、FIX.md、VERIFICATION.md、diag-stall2/、diag-stall3/、verify-fix/）。
