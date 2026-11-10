# savestates — Web 端存档样本

Web 端存档与 Android 同源（JSON 结构一致，见 `docs/FACTS.md`），可用于双端行为等价核对。

## 目录

| 目录 | 内容 |
|---|---|
| `original/` | 官方上游基线存档 |
| `mod/` | MOD 存档 |
| `regression/` | 回归验证用（合法进度不退化、跨版本导入） |
| `fixtures/` | 构造夹具（明确标注非真实进度） |

## 与 Android 的关系

Android 样本位于 `android/AD_Oreki_Edition_Android/savestates/`，两者字段语义必须一致；
跨端核对时以同一份 JSON 分别导入两端，比较阶段状态与关键字段。

## 隐私

用户真实存档不入库（只读、非公开），仅保留 SHA-256 于 `android/.../docs/FACTS.md`。
