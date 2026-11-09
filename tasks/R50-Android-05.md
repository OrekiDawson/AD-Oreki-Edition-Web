# R50-AND-05　Android 教程全中文化与界面检查

| 项 | 内容 |
| --- | --- |
| 编号 | R50-AND-05 |
| 标题 | Android 侧教程中文化落地 + 原创界面与深色模式检查 |
| 负责 Agent | tutorial-agent |
| 贡献者 | tutorial-agent（教程中文化与验收清单）、main（决策与协调） |
| 建单时间 | 2026-11-01 12:36 |
| 状态 | 进行中（Web 侧已完成，Android 侧待构建） |
| 来源 | 用户 2026-11-01 12:03「Android 三路专项」 |

## 一、目标

教程正文已在 **Web 侧**完成全量中文化（唯一数据源已修）。本任务负责把它**在 Android 侧真正落地并验证**，
同时检查原创界面、深色模式、小屏布局。

## 二、Web 侧已完成（作为 Android 侧的输入）

| 指标 | 结果 |
| --- | --- |
| 18 章正文拉丁字母 | 1013 → **0** |
| 含英文片段 | 105 → **0 违规** |
| 第 12 章（复兴树/自动机/黑洞） | 178 个拉丁字母 / 18 处 → **0** |
| 第 14 章（薇、太阳神） | 31 → **0** |
| 第 7 章 `EC`、第 8 章裸 `X` | 已清 |
| 校验 | `validate_tutorial.mjs` 14 组 2118 项全通过 |

唯一正文源：`web/AD-Oreki-Edition/src/core/oreki-tutorial-data.json`
派生文件：`oreki-tutorial-data.gen.js`（已同步提交）

## 三、Android 侧待做

| # | 项 | 说明 |
| --- | --- | --- |
| 1 | 构建期重新生成 `assets/oreki_tutorial.txt` | 由 `build_mod.py` 的 `patch_tutorial_content()` 从同一 JSON 生成；**禁止手改该 txt** |
| 2 | 资产一致性 | APK 内 txt 与仓库 payload 逐字节 `cmp` 一致；字节数量级对齐（改前 166158 B） |
| 3 | 旧文案清零 | grep 计数为 0：`SAM/SIP1/SEP3/ACHNR/START/TTF/log10/autoEC/R37-A/（EC）/（RM）` |
| 4 | 新文案存在 | grep 计数 >0：`起始反物质/起始无限点数/起始永恒点数/成就免重置节点/以 10 为底取对数` |
| 5 | 运行期渲染 | 拉起 `TutorialActivity` 截图，确认第 12 章/薇章/第 7 章正文为中文 |
| 6 | 必须保留项 | 第 17 章的 `F 键`、`B A 回车`、`IEATASS`、`save`、`tree` **按原样保留**（翻掉即失效），验收时不得当漏翻 |
| 7 | 附录 A | 中英对照表**保留**（已裁定：元信息层，正文不依赖）；新三列表头正常显示 |

## 四、界面检查项

| 项 | 要求 |
| --- | --- |
| 顶栏 | 显示「当前页面」 |
| 导航 | 官方 Current Tab / 底栏 / 侧栏保持原版结构、顺序、层级、交互；**不得用自制导航栏替换** |
| 深色模式 | 所有原创页面支持 |
| 教程按钮 | 「打开 Oreki 中文教程」颜色必须为 `#0078D7` |
| 小屏布局 | 长文本不溢出、可滚动、弹窗不遮挡 |
| 已知缺陷 | 639×890 视口下「具体操作」区初显 1.5 行、滚轮需先点击 —— 已在 Web 侧记录，Android 侧确认是否同样存在 |

## 五、禁止事项

- **不得**手工维护 Android 第二份教程正文（唯一源是 Web 的 JSON）
- **不得**手改 `assets/oreki_tutorial.txt`
- 不得为消除英文而改游戏机制含义
- 不得改 Web 仓库（Web 侧已交付）
- 不得改 `docs/FACTS.md`

## 六、验收标准

| # | 标准 |
| --- | --- |
| 1 | APK 内 txt 与仓库 payload 逐字节一致 |
| 2 | 旧文案 grep 全 0，新文案 grep 全 >0 |
| 3 | `TutorialActivity` 截图证明第 12 章/薇章/第 7 章为中文 |
| 4 | 附录 A 正常；保留项未被误翻 |
| 5 | 深色模式与小屏截图 |
| 6 | 全量英文残留扫描报告 |

## 七、依赖与冲突

| 项 | 说明 |
| --- | --- |
| AVD | `oreki_test` 单台，与 android-agent 串行；本任务需构建 + 装机，**须等 AVD 空闲** |
| 构建 | 由主 Agent 统一调度，与 android-agent 的 smali 改动合并批次 |
| 文件冲突 | 本任务只碰构建输入（JSON 已在 Web 侧）与教程渲染验证，不改游戏逻辑 smali |

## 八、执行记录

| 时间 | 执行者 | 事件 | 证据 |
| --- | --- | --- | --- |
| 2026年11月1日 11:28 | tutorial-agent | Web 侧 18 章正文中文化完成（Android 侧的输入） | Web commit `2f9417c` |
| 2026年11月1日 11:29 | tutorial-agent | Web 侧回写执行结果与判定理由 | Web commit `b2c6e76` |
| 2026年11月1日 11:32 | tutorial-agent | Web 侧回写附录 A 保留决策与 Android 验收清单（本单 §三 的来源） | Web commit `6b611be`（对应 `R50-TUT-01 §12.5/§12.6/§12.7`） |
| 2026年11月1日 12:06 | main | 建单 R50-AND-05，与 AND-03/04、DOC-02 同批同步双端 | Android commit `48076eb`、Web commit `6d5a584` |
| 2026年11月1日 12:12 | tutorial-agent | 读码核对生成链路（§九）；全库搜索确认无第二份正文（§十）；新增 `scripts/verify_tutorial_zh.py`，34 条机读检查通过（§十一） | Android commit `8e9fd91`、Web commit `775f31f` |
| 2026年11月1日 12:13 | main | 提交已中文化的 payload 版 `oreki_tutorial.txt` | Android commit `dd2716c` |
| 2026年11月1日 12:23 | tutorial-agent | 补 §十三 G 组可执行清单（13.1~13.7）；`--apk` 复跑 40/40 通过 | Android commit `f381817`、`reports/_r50/android_accept.json` |
| 2026年11月1日 12:28 | tutorial-agent | 同步清单到 Web 仓库 | Web commit `88a03cd` |
| 2026年11月1日 12:33 | tutorial-agent | 补 §13.0 三条红线与 §13.8 A/B 分级；修正措辞边界（F 组≠运行期已验证） | Android commit `9038e4b` |
| 2026年11月1日 13:19 | tutorial-agent | `r50_tap_tab.py` 加离线模式并做 mock 自测，12/12 通过（§十四） | `scripts/test_r50_tap_tab.py` 输出 |

## 九、生成链路（读码核对，2026年11月1日 12:12 随 commit `8e9fd91` 提交）

链路只有一条，**没有第二份正文**：

```
web/AD-Oreki-Edition/src/core/oreki-tutorial-data.json        ← 唯一内容源（只读）
        │  scripts/oreki_tutorial_gen.py:69  DEFAULT_JSON
        │  scripts/oreki_tutorial_gen.py:1102 generate()
        ▼
android/AD_Oreki_Edition_Android/scripts/payload/assets/oreki_tutorial.txt   ← 生成物（构建输入）
        │  scripts/oreki_tutorial_gen.py:70  DEFAULT_OUT
        │  scripts/build_mod.py:4123  shutil.copy2(payload → work/mod/assets)
        ▼
android/AD_Oreki_Edition_Android/work/mod/assets/oreki_tutorial.txt          ← 真正被打包的字节
        ▼
APK: assets/oreki_tutorial.txt
        ▼
scripts/payload/smali/kajfosz/antimatterdimensions/oreki/tutorial/TutorialActivity.smali:380-382
        const-string v1, "oreki_tutorial.txt" → readAssetInto(ArrayList, String)
```

**关键位置一览**

| 位置 | 内容 |
| --- | --- |
| `scripts/oreki_tutorial_gen.py:69` | `DEFAULT_JSON` = Web 仓库的 `oreki-tutorial-data.json`（跨仓库相对路径，只读） |
| `scripts/oreki_tutorial_gen.py:70` | `DEFAULT_OUT` = `scripts/payload/assets/oreki_tutorial.txt` |
| `scripts/oreki_tutorial_gen.py:716` | `MAX_ASSET_BYTES = 2 MB`（体积上限） |
| `scripts/oreki_tutorial_gen.py:929` | `build_text()`：单元 = 18 章 + 附录 → `TAG\|flag\|text` 纯文本 |
| `scripts/oreki_tutorial_gen.py:952` | `parse_text()`：把文本解回结构（回读校验用） |
| `scripts/oreki_tutorial_gen.py:1012` | `verify_roundtrip()`：逐字段与 JSON 比对 |
| `scripts/oreki_tutorial_gen.py:1102` | `generate()`：三层断言 + 写盘；`OREKI_TUTORIAL_JSON` / `_OUT` 可覆盖路径 |
| `scripts/build_mod.py:4055` | `TUTORIAL_ASSETS = ("oreki_tutorial.txt",)` —— 只允许这一份 |
| `scripts/build_mod.py:4070` | `patch_tutorial_content()`：调用 `gen.generate(strict=…)`，默认严格（`OREKI_TUTORIAL_ALLOW_DRAFT=1` 才放宽 draft） |
| `scripts/build_mod.py:4123` | payload → `work/mod/assets` 拷贝，并断言字节数相等 |
| `scripts/build_mod.py:4129-4138` | 对**真正打包的字节**重做：非空 / 无 BOM / ≤2 MB / 解码回读中文串一致 / 汉字 ≥1000 |
| `scripts/build_mod.py:4148` | `verify_roundtrip()` 重跑；单元数只认 JSON 长度，不写死 |
| `scripts/build_mod.py:4167` | 附录守卫：每个 `apx_*` 必须有 `CH` 且第二条记录是 `TITLE`（否则页面出现空白大标题） |
| `scripts/build_mod.py:4191` | 正文不许出现 `\|src/`（源码路径不进正文） |
| `scripts/build_mod.py:4198` | 上一版正文禁止回归：payload 与 work/mod 里都不许有 `*legacy*.txt` |
| `scripts/build_mod.py:4218` | `readAssetInto` 只允许 1 处定义 + 1 处调用（防有人加第二份 assets） |
| `scripts/build_mod.py:1749` | 打包后直接读 APK 的 ZIP 目录，断言 `assets/oreki_tutorial.txt` 存在且非空、原有 22 条 assets 未丢 |
| `scripts/build_mod.py:4742` | 调用顺序：`patch_tutorial_content()` → `patch_tutorial_entry()`（后者要求教程类已进 mod 树） |

**结论**：`assets/oreki_tutorial.txt` 是**派生文件**，正文只存在于 Web 的 JSON。手改 txt 会在下次构建被覆盖，且 `A2 同步` 检查会立刻报红。任务单 §五「不得手改」在代码层有对应守卫（4198 行 legacy 守卫、4148 行回读校验），不是仅靠人守。

## 十、旧文案残留预检（2026年11月1日 12:12 随 commit `8e9fd91` 提交）

- `scripts/` 全目录（`.py/.txt/.json/.md`）搜 `复兴树|起始反物质|成就免重置节点`：**除 `payload/assets/oreki_tutorial.txt` 外 0 处**
- `scripts/payload/assets/` 目录下只有 `oreki_tutorial.txt` 一个文件，不存在第二份教程资产
- `TutorialContent.smali` 在仓库里不存在（`find` 全仓 0 命中）——正文已改为 assets 承载，smali 只留界面标签（阶段目标 / 具体操作 / 购买优先级…）

**结论**：唯一源规则成立，没有第二份硬编码正文。

> **历史残留提示（下轮别白找）**：`TutorialContent.smali` **在本仓库不存在**（`find . -name "TutorialContent.smali"` 全仓 0 命中）。
> `build_mod.py:4062` 的函数注释里还写着「生成 TutorialContent.smali」，那是 R40F 之前的说法——
> 正文早已改为 assets 承载（`TUTORIAL_ASSETS`），smali 里只剩界面标签（阶段目标 / 具体操作 / 购买优先级…）。
> 下轮若有人按注释去找这个文件，直接以本节为准，不要再建一份。

## 十一、验收脚本（可复跑）

`android/AD_Oreki_Edition_Android/scripts/verify_tutorial_zh.py`

```bash
# 只查仓库内资产（任何机器都能跑，不需要 AVD）
python scripts/verify_tutorial_zh.py

# 构建后额外核对 APK 里的 assets
python scripts/verify_tutorial_zh.py --apk build/<产物>.apk --json reports/_r50/android_accept.json
```

覆盖 **34 条机读检查**（加 `--apk` 为 40 条），分 7 组：

| 组 | 条数 | 查什么 |
| --- | --- | --- |
| A 资产层 | 8 | 从 JSON 现场重新生成 → 与 payload **逐字节比对**；源路径正确；work/mod 旁本一致；24 个单元；无 BOM；体积；汉字数 |
| B 旧文案 | 11 | `SAM/SIP1/SEP3/ACHNR/START/TTF/log10/autoEC` 正文 0 次、附录 ≤1 次；`R37-A/（EC）/（RM）` 全文 0 次 |
| C 新文案 | 7 | 5 个新词在正文存在；第 12 章四个中文节点名齐全且旧缩写为 0 |
| D 保留项 | 6 | `F 键 / B A 回车 / IEATASS / save / tree / Emoji 记数法` 必须仍在（防过度翻译） |
| E 单源一致 | 3 | 单元 id 与顺序 == JSON；标题逐字一致；第 12 章抽样 3 条 steps 逐字命中 |
| F APK | 4 | （给 `--apk` 才跑）APK 内 assets 与 payload 逐字节一致、原有 assets 未丢 |
| G 装机项 | 8 | 只打印 TODO 清单，**不假装通过** |

首次运行结果（2026年11月1日 12:12，未给 `--apk`）：**34/34 通过**，其中
`A1` 24 单元 / 1155 条记录 / 41342 汉字 / 167445 字节；`A2` payload 与现场生成逐字节一致。

加 `--apk release/反物质维度.apk` 复跑（2026年11月1日 12:23，随 commit `f381817` 提交）：**40/40 通过**，APK 内 assets 与 payload、与现场生成
三者逐字节一致，原有 assets 23 条未丢。机读结果：`reports/_r50/android_accept.json`。

## 十二、待确认（不阻塞）

| 项 | 说明 |
| --- | --- |
| ~~`payload/assets/oreki_tutorial.txt` 未提交~~ | **已解决**：主 Agent 提交 `dd2716c` |
| ~~`tasks/R50-TUT-01.md` 在 Android 仓库显示 `M`~~ | **已解决**：已随构建批次提交 |
| 装机项 G（8 条） | 等 AVD 空闲 + 构建完成后按 §十三 执行 |

## 十三、G 组可执行清单（构建装机后照抄，2026年11月1日 12:23 定稿）

> 开工前先跑一遍离线部分，确认要装的东西本身是对的（**已通过，见下**）：
>
> ```bash
> cd /c/Users/Oreki/WorkBuddy/AD-Oreki-Unified/android/AD_Oreki_Edition_Android
> python scripts/verify_tutorial_zh.py --apk "release/反物质维度.apk" --json reports/_r50/android_accept.json
> ```
>
> **实测**（结果随 commit `f381817` 于 2026年11月1日 12:23 提交）：`release/反物质维度.apk`（2026年11月1日 11:32 构建）里的
> `assets/oreki_tutorial.txt` 为 167445 字节，与 payload、与现场从 JSON 生成的结果**三者逐字节一致**，
> 原有 assets 23 条未丢。
>
> **措辞边界（重要）**：这只证明 **APK 内的教程资产正确且是中文**，属于 F 组（资产层）。
> **运行期渲染（字体、换行、滚动、深色、小屏）一项都还没跑**，G 组 8 条全部未验证。
> 在 G 组跑完之前，不得对外表述为「Android 教程已验证」。
>
> **当前状态**：
> | 组 | 范围 | 状态 |
> | --- | --- | --- |
> | A/B/C/D/E + F | 资产层：内容、同步、唯一源、APK 内 bytes | **已通过（40/40 离线）** |
> | G1~G8 | 运行期渲染：字体 / 换行 / 滚动 / 深色 / 小屏 / 按钮取色 | **未验证**，等 AVD |

### 13.0 红线：这三条踩了会污染别人或不可恢复，动设备前先读

| # | 红线 | 后果 | 强制做法 |
| --- | --- | --- | --- |
| **R1** | 任何 `adb` 命令没带 `-s $SER` | 命令会落到**用户真机**：`install -r` 直接替换用户手机上的游戏，存档不兼容即等于**丢档，不可恢复**（2026-10-31 已发生过一次，`eff53b1` 修的） | 13.1 里 `SER` 必须从 `adb devices -l` 的 `emulator-*` 取；每次执行前先 `echo $ADB` 确认带 `-s`；一律用 `$ADB` 而不是裸 `adb` |
| **R2** | `wm size` / `wm density` / `uimode night` 改完不还原 | 不是不可恢复，但**会污染后续所有 agent 的截图与验证基线**（小屏状态下的截图不能当默认分辨率证据） | 13.1 先记录三个基线值；13.5 结束**立刻**执行 `wm size reset` + `wm density reset` + `uimode night auto`；离开前再查一次 |
| **R3** | `pm clear` / `uninstall` 图省事重开新档 | 会抹掉 `oreki_test` 上的测试存档，前一个 agent 刚跑出来的进度（如 A13 的 `dimensionBoosts` 验证现场）**当场作废** | 本任务**禁止**清数据；只需要 `am force-stop` + 重新 `am start` 就能拿到干净界面 |

> **恢复兜底**：真踩到 R2 且记不住原值时，`wm size reset` / `wm density reset` 会把设备恢复成出厂 AVD 的物理参数，不依赖任何记录，可以放心用。

### 13.1 前置：认设备、装包（禁止落到真机）

```bash
cd /c/Users/Oreki/WorkBuddy/AD-Oreki-Unified/android/AD_Oreki_Edition_Android
adb devices -l                                   # 只认 emulator-xxxx；没有就先起 oreki_test
export SER=$(adb devices -l | grep -o "emulator-[0-9]*" | head -1)
test -n "$SER" || { echo "没有模拟器在线，停"; }
export ADB="adb -s $SER"
mkdir -p reports/_r50/android
$ADB install -r "release/反物质维度.apk"
$ADB shell am force-stop com.oreki.antimatterdimensions
```

包名**不要硬编码**（applicationId 与类名包是两个东西，见 13.2 的说明）：

```bash
export PKG=$($ADB shell pm list packages | grep -o "com\.oreki\.antimatterdimensions" | head -1)
test -n "$PKG" || { echo "设备上没装本 Mod"; }
echo "applicationId = $PKG"
```

截图**必须三步留痕**（否则抓到桌面也可能被当成页面——同仓库其他 agent 会 `am force-stop`，App 随时可能被踢到后台）：

```bash
shot() {   # 用法：shot 输出文件.png —— 拍前判、拍后复核，中间被切走也算无效
  local out="$1" before after
  before=$($ADB shell dumpsys window | grep -o "mCurrentFocus=.*")
  case "$before" in
    *oreki.tutorial.TutorialActivity*) ;;
    *) echo "!! 前台不是教程页（$before），本次截图作废"; return 1 ;;
  esac
  $ADB exec-out screencap -p > "$out"
  after=$($ADB shell dumpsys window | grep -o "mCurrentFocus=.*")
  if [ "$before" != "$after" ]; then
    mv "$out" "${out%.png}_suspect.png"
    echo "!! 拍摄期间前台变了 → 已改名 _suspect（$after）"
    return 1
  fi
  echo "OK $out  前置与复核一致"
}
```

**为什么拍后还要复核**：`exec-out screencap` 本身要几十毫秒，这期间别的 agent 可能
`am force-stop` 把 App 踢到后台（android-scheduler-agent 2026年11月1日的截图事故就是这么发生的）。
拍前判只能挡住「本来就不对」，拍后比才能挡住「拍的过程中被切走」。

记下两个基线值，收工要还原：

```bash
$ADB shell wm size        # 例：Physical size: 1080x1920
$ADB shell wm density     # 例：Physical density: 440
$ADB shell cmd uimode night   # 例：Night mode: auto
```

### 13.2 打开教程 + 按章截图

教程界面是**代码构建的布局**（`TutorialActivity.smali` 顶部注释：LinearLayout(vertical) = 操作行 / 字号行 / 章节页签 HorizontalScrollView / 正文 ScrollView），
24 个页签没有资源 ID、Activity 也不读 intent extra，所以**只能用「文字定位 + 点击」**，不能 `am start --es chapter`。

```bash
# 组件名：applicationId 是 com.oreki.antimatterdimensions，但类的包名仍是 kajfosz/...
# （构建期只改 manifest 的 package，不重排 smali 目录）——两段写错任何一段都会 ActivityNotFound
$ADB shell am start -n "$PKG/kajfosz.antimatterdimensions.oreki.tutorial.TutorialActivity"
sleep 2

# 先看当前界面上有什么（第一次务必看一眼，页签名/字号会影响坐标）
python scripts/r50_tap_tab.py --serial "$SER" --list

> **`am start` 的两种写法**：
> ✅ `"$PKG/kajfosz.antimatterdimensions.oreki.tutorial.TutorialActivity"`（应用 id / **类全名**）
> ❌ `com.oreki.antimatterdimensions/.TutorialActivity`（简写会被拼成 `com.oreki...TutorialActivity`，不存在）
>
> `TutorialActivity` 在清单里是 `exported="false"`，但同构建的 `SpeedSettingsActivity` 实测可直接 `am start`
> （构建带 debug 位），所以本页大概率也能直接拉起。**若被拒绝**，退路是「桌面长按图标 → 教程快捷方式」，
> 或从游戏内「选项」页点顶部按钮进入——两条都不影响后续 dump/截图流程。
> （`exported=false` 但可 `am start` 这条由 android-scheduler-agent 在 `R50-AND-04 §17.4/§17.5` 实测，2026年11月1日 13:54 同步）
```

页签文字规则（`TutorialActivity.smali:1632 tabLabel`）：取标题里全角空格「　」之后的**前 6 个字**，超出截断加省略号。

实际标签长这样（**第一次跑 `--list` 时对着这张表核对**，对不上说明页签渲染与预期不符，先停）：

| 单元 | 标题 | 页签显示文字 |
| --- | --- | --- |
| 第 12 章 | 第 12 章　复兴树、自动机与黑洞 | `复兴树、自动…` |
| 第 14 章 | 第 14 章　天神（二）：薇、太阳神 | `天神（二）：…` |
| 第 7 章 | 第 7 章　复制器与首次永恒 | `复制器与首次…` |
| 附录 A | 附录 A　术语表 | `术语表` |

> 注意是 6 个字，**不是** 7 个字：`复兴树、自动机…` 是错的，`复兴树、自动…` 才对。

| 要哪一章 | 点哪个页签关键字 |
| --- | --- |
| 第 12 章 复兴树、自动机与黑洞 | `复兴树` |
| 第 14 章 天神（二）：薇、太阳神 | `天神（二）` |
| 第 7 章 复制器与首次永恒 | `复制器` |
| 第 8 章 时间研究与永恒里程碑 | `时间研究` |
| 第 17 章 隐藏条件与成就总表 | `隐藏条件` |
| 附录 A 术语表 | `术语表` |

`r50_tap_tab.py` 的退出码（脚本会自己拒绝歧义，不需要人记）：

| 退出码 | 含义 | 怎么办 |
| --- | --- | --- |
| 0 | 唯一命中且在屏幕内（已点击，或 `--no-tap` 只报坐标） | 继续 |
| 1 | 没找到 | 先 `--list` 看当前界面；页签可能还没滑到 |
| 2 | adb 出错 | 查 `$SER` 是否在线 |
| 3 | **关键字歧义** | 换更具体的关键字，例如 `无限` 会同时命中「第一次无限 / 无限升级与普… / 打破无限 / 无限维度与无…」，必须写 `无限升级` 或 `无限维度` |

```bash
# 点页签（找不到会自动横向滑页签条再试；--no-tap 只报坐标）
python scripts/r50_tap_tab.py --serial "$SER" 复兴树

# 截图（第一屏）
$ADB exec-out screencap -p > reports/_r50/android/ch12_01_top.png

# 往下翻正文（坐标取自 wm size；1080x1920 下用这组，其它分辨率按比例缩放）
$ADB shell input swipe 540 1500 540 700 300 ; sleep 1
$ADB exec-out screencap -p > reports/_r50/android/ch12_02_body.png
$ADB shell input swipe 540 1500 540 700 300 ; sleep 1
$ADB exec-out screencap -p > reports/_r50/android/ch12_03_body.png
```

其它章同法，只换关键字与文件名：

```bash
python scripts/r50_tap_tab.py --serial "$SER" 天神（二）
$ADB exec-out screencap -p > reports/_r50/android/ch14_v_01.png
$ADB shell input swipe 540 1500 540 700 300 ; sleep 1
$ADB exec-out screencap -p > reports/_r50/android/ch14_v_02.png

python scripts/r50_tap_tab.py --serial "$SER" 复制器
$ADB exec-out screencap -p > reports/_r50/android/ch07_01.png

python scripts/r50_tap_tab.py --serial "$SER" 时间研究
$ADB exec-out screencap -p > reports/_r50/android/ch08_01.png

python scripts/r50_tap_tab.py --serial "$SER" 隐藏条件
$ADB exec-out screencap -p > reports/_r50/android/ch17_01.png

python scripts/r50_tap_tab.py --serial "$SER" 术语表
$ADB exec-out screencap -p > reports/_r50/android/apxA_01.png
```

### 13.3 逐条判定标准

判定方式：截图 + `adb shell uiautomator dump` 的文本一起看。**截图里有字但看不清的，以 dump 文本为准。**

| # | 检查 | 通过（必须出现） | 失败（出现即判负） |
| --- | --- | --- | --- |
| G1 | 第 12 章（`ch12_01/02/03`） | `起始反物质`、`起始无限点数`、`起始永恒点数`、`成就免重置节点`、`复兴树`、`黑洞` | `SAM`、`SIP1`、`SIP2`、`SEP1`、`SEP2`、`SEP3`、`ACH1`、`ACHNR`、`START`、`STP`、`TTF` |
| G2 | 第 14 章（`ch14_v_01/02`） | `让薇出现`、`空间定理`、`太阳神`、`以 10 为底取对数`（若出现公式处） | `薇（V）`、`V 的现实`、`floor(`、`max(` |
| G3 | 第 7 章（`ch07_01`） | `永恒挑战`、`复制器` | `永恒挑战（EC）`、裸 `EC` |
| G4 | 第 8 章（`ch08_01`） | `已凑到的数量 / 12900` | 裸 `X`、`X/12900`、`TD1` |
| G5 | 第 17 章（`ch17_01`） | `F 键`、`上上下下左右左右 B A 回车`、`IEATASS`、`save`、`tree`、`Emoji 记数法` **按原样** | **以上任何一个被"翻译"了**（如 `F 键`→`F键位`、`IEATASS`→中文） |
| G6 | 附录 A（`apxA_01`） | 表头三列 `界面标识 / 中文名 / 用途`；行内如 `SAM`+`起始反物质` 成对出现 | 三列串行、表头缺列、`SAM` 无对应中文名 |
| G7 | 顶栏与入口按钮 | 教程页顶栏可见；主界面教程按钮底色为 `#0078D7` | 顶栏缺失；按钮色明显偏离（见下方取色命令） |
| G8 | 深色模式 + 小屏 | 见 13.4 / 13.5 | 切浅色后正文变白底黑字但标题仍深色（配色断裂）；小屏下正文横向出界、按钮被遮挡 |

**核验文案可直接用 dump 文本，比看截图准**：

```bash
$ADB shell uiautomator dump /sdcard/r50.xml >/dev/null
$ADB exec-out cat /sdcard/r50.xml > reports/_r50/android/dump_ch12.xml
grep -c "起始反物质" reports/_r50/android/dump_ch12.xml     # 期望 >0
grep -c "SAM"        reports/_r50/android/dump_ch12.xml     # 期望 0
```

> **grep 原始 XML 的前提**：真机 dump 里换行是实体 `&#10;`、`&` 是 `&amp;`（`xml.etree` 解析时才解码）。
> 所以 **grep 只对「不跨行、不含 &」的短语有效**——`起始反物质`「成就免重置节点」这类可以；
> 要核对跨行的长句（如 G5 的「上上下下左右左右 B A 回车」若被换行拆开），必须用解析后的文本：
> `python scripts/r50_tap_tab.py --xml <dump> --list` 看解码后的 `text`，不要直接 grep XML。

**G7 取色**（PIL 已装，实测 13.0.0）：

```bash
# 主界面「选项」页顶部有「打开 Oreki 中文教程」按钮，截一张
$ADB exec-out screencap -p > reports/_r50/android/entry_button.png
python - <<'PY'
from PIL import Image
im = Image.open("reports/_r50/android/entry_button.png").convert("RGB")
t = (0x00, 0x78, 0xD7)
hit = sum(1 for p in im.getdata() if all(abs(a - b) < 12 for a, b in zip(p, t)))
print(f"#0078D7 命中 {hit} 像素，占比 {hit / (im.width * im.height) * 100:.2f}%")
print("判定：占比 > 0.05% 视为按钮底色正确" if hit else "判定：完全没找到 #0078D7")
PY
```

### 13.4 深色模式（系统设置，应用内没有主题开关）

教程界面本身是**纯深色、无浅色回退**（`TutorialActivity.smali` 顶部注释：Theme.Material.NoActionBar + 根容器 `#0F1318`），
所以这里要验的不是「深色好看」，而是**系统切浅色时不能出现配色断裂**：

```bash
$ADB shell cmd uimode night yes
$ADB shell am force-stop com.oreki.antimatterdimensions
$ADB shell am start -n com.oreki.antimatterdimensions/kajfosz.antimatterdimensions.oreki.tutorial.TutorialActivity
sleep 2
$ADB exec-out screencap -p > reports/_r50/android/dark_night.png

$ADB shell cmd uimode night no
$ADB shell am force-stop com.oreki.antimatterdimensions
$ADB shell am start -n com.oreki.antimatterdimensions/kajfosz.antimatterdimensions.oreki.tutorial.TutorialActivity
sleep 2
$ADB exec-out screencap -p > reports/_r50/android/dark_light_system.png
```

判定：两张图应**视觉一致**（都是深色），文字仍为浅色、正文可读；若「系统浅色」时出现白底 + 浅色字（看不清）即为失败。
> **静态预期**（`TutorialActivity.smali:152` 注释 + 无任何 `uiMode` / `isNightMode` 读取）：窗口主题是恒深色的
> `Theme.Material.NoActionBar`，不随系统 uiMode 翻转，所以两张图**本来就该一样**。
> 真机若出现差异，说明有主题资源泄漏，属缺陷而不是预期。
收工还原：`$ADB shell cmd uimode night auto`（或恢复到 13.1 记录的基线值）。

### 13.5 小屏（用户报告的 639×890 那档）

```bash
$ADB shell wm size 639x890
$ADB shell wm density 320
$ADB shell am force-stop com.oreki.antimatterdimensions
$ADB shell am start -n com.oreki.antimatterdimensions/kajfosz.antimatterdimensions.oreki.tutorial.TutorialActivity
sleep 2
$ADB exec-out screencap -p > reports/_r50/android/small_01.png
python scripts/r50_tap_tab.py --serial "$SER" 复兴树
$ADB exec-out screencap -p > reports/_r50/android/small_ch12.png
```

判定：

| 项 | 通过 | 失败 |
| --- | --- | --- |
| 页签条 | 可横向滑动，能滑到第 24 个（附录 F） | 页签被裁剪且滑不动 |
| 正文 | 长句自动换行、可纵向滚动到底 | 横向出界（需左右拖）、文字被裁 |
| 「具体操作」区块 | 至少能完整看到前 2 条步骤，且**滚轮/滑动能滚动它** | 只露 1.5 行且滑不动（Web 侧 639×890 的同类缺陷，见 R50-TUT-01 §12.5 决策二） |
> **静态预期**：Android 的正文是**单个** `ScrollView` 且 `weight=1.0f` 占满剩余高度
> （`TutorialActivity.smali:350-353`，布局结构见文件头注释 38 行），没有 Web 侧那种「内层定高滚动盒」，
> 所以 639×890 下**大概率不复现** 1.5 行截断。真机上若仍出现，说明是另一处布局问题，需另记。
| 弹窗/顶栏 | 不遮挡正文首行 | 顶栏压住标题 |

**必须还原**（不还原会让后续 agent 的截图与验证全部失真）：

```bash
$ADB shell wm size reset
$ADB shell wm density reset
$ADB shell am force-stop com.oreki.antimatterdimensions
```

### 13.6 已知坑（照抄时会踩）

> 这一节都是「会跑错、但环境还救得回来」的坑；**会污染别人或不可恢复的，全在 13.0 红线**，先读那一节。

| 坑 | 说明 |
| --- | --- |
| 页签点不到 | 24 个页签一屏放不下，直接 `input tap` 固定坐标会点到别的章。**必须用 `r50_tap_tab.py` 按文字定位**（它找不到会自动横向滑动页签条再试） |
| `am start --es chapter` 不存在 | `TutorialActivity` 不读 intent extra（全文件无 `getStringExtra`），只能点页签 |
| 打开时停在别的章 | 打开时按 `TutorialProgress.stage()` 自动定位到「你现在该读的章」，不是第 0 章；先 `--list` 看当前在哪 |
| 小屏改完不生效 | `wm size` 后必须 `am force-stop` + 重新 `am start`，否则沿用旧布局 |
| 截图是全屏 | 想只截教程区就按 `wm size` 推算裁剪；不要把整屏当「教程界面」交付 |
| AVD 只有一个 | 与 android-agent 串行；开跑前在群里说一声，跑完立即 `wm size reset` |
| 截图抓到桌面 | 别的 agent 随时会 `force-stop`。**必须用 13.1 的 `shot()`**（拍前判前台 + 拍后复核），否则可能把桌面当页面交上去（已有实例） |

### 13.7 交付物命名（固定，方便汇总）

```
reports/_r50/android/
├── ch12_01_top.png  ch12_02_body.png  ch12_03_body.png
├── ch14_v_01.png    ch14_v_02.png
├── ch07_01.png      ch08_01.png       ch17_01.png
├── apxA_01.png
├── dark_night.png   dark_light_system.png
├── entry_button.png
├── small_01.png     small_ch12.png
├── dump_ch12.xml    （G1 的文本证据）
└── android_accept.json（离线部分机读结果）
```

### 13.8 分级：哪些能截图直判、哪些必须独占设备

只有一台 AVD，所以「并行」只能是**互不影响的串行**：A 类可以断点续跑、哪条失败都不阻塞其余；
B 类会改环境，必须排在最后，且失败也要先还原再报。

| 类 | 项目 | 是否改环境 | 判定手段 | 失败会怎样 |
| --- | --- | --- | --- | --- |
| **A（只读）** | G1 第 12 章正文 | 否 | `uiautomator dump` 文本 grep（自动）+ 截图留证 | 不影响其它项，可单独复跑 |
| **A（只读）** | G2 第 14 章薇 | 否 | 同上 | 同上 |
| **A（只读）** | G3 第 7 章 EC | 否 | 同上 | 同上 |
| **A（只读）** | G4 第 8 章 X | 否 | 同上 | 同上 |
| **A（只读）** | G5 第 17 章保留项 | 否 | 同上（要滚到含 `IEATASS` 那屏） | 同上 |
| **A（只读）** | G6 附录 A 表头 | 否 | 同上（页签在最后，需先滑到最右） | 同上 |
| **A（只读，跨页签）** | G7 顶栏 + 按钮取色 | 否 | dump 看顶栏；主界面截图 + PIL 取 `#0078D7` | 需离开教程页，回来即可 |
| **B（改环境）** | G8 深色 + 小屏 | **是**（`uimode` / `wm size` / `wm density`） | 两张截图人眼比对一致性 + 4 条布局判据 | 不还原就污染后续所有验证 → **必须最后跑** |

**按「能否只靠截图判」再分一层**（给主 Agent 排期用）：

| 判定强度 | 项目 | 说明 |
| --- | --- | --- |
| **纯截图即可判** | G1~G6 | 只要把那一屏截下来，内容对不对肉眼可判；dump 文本只是让判定更客观、可留证 |
| **截图 + 取色** | G7 | 顶栏看截图即可；按钮底色必须采样，肉眼对 `#0078D7` 不可靠（深色背景下偏差 12 以内都算对） |
| **必须两次对比** | G8 | 单张截图判不了「深色/浅色是否一致」，必须 `dark_night.png` 与 `dark_light_system.png` 成对看；小屏必须与常规分辨率截图成对看 |

**最小串行窗口**：一次装机后，A 类约 8 分钟（7 条 × 切页签 + 滚动 + 截图），B 类约 4 分钟（两次重启 + 两次改参数 + 还原）。
**如果 AVD 只空出很短一段时间**，优先跑 A 类（把「正文是不是中文」这个用户最关心的结论先拿到），B 类另约时间。

## 十四、mock 自测（不需要 AVD，2026年11月1日 13:19）

`scripts/test_r50_tap_tab.py`：用**真实教程标题**按 `tabLabel()` 规则造 24 个页签，
拼成与 uiautomator dump 同构的 XML，让 `r50_tap_tab.py` 自己去解析、匹配、拒绝歧义。
这样 AVD 空出来时第一次 `--list` 是真验证，不是现场调试。

```bash
python scripts/test_r50_tap_tab.py
```

**结果：12/12 通过。** 这一轮自测直接抓出 4 个真问题，都已修：

| # | 问题 | 后果（若没测出来） | 修法 |
| --- | --- | --- | --- |
| 1 | 前缀匹配会撞车（`无限` 命中 4 条） | 静默截错章，整份验收结论作废 | 新增 `resolve()`：唯一命中才算 ok，多条直接返回 3 并列出候选 |
| 2 | 没判「屏幕外」 | 24 个页签一屏放不下，点到屏外坐标不生效，截图停在上一个章 | 命中节点 `x1 ≥ 屏宽` 时判为 offscreen，转去横向滑页签条 |
| 3 | `--xml` 离线模式仍会调 adb | 无设备复跑时报 adb 错误，误判成脚本坏了 | 离线分支不再走滑动兜底 |
| 4 | 文档里把页签写成「前 7 字」 | 人工核对 `--list` 时会以为渲染错了 | 统一按 smali 的 6 字，并在 §13.2 补了实际标签对照表 |

产物（可人工复核，也可直接喂给 `--xml`）：

| 文件 | 内容 |
| --- | --- |
| `reports/_r50/mock_ui_tabs.xml` | 24 个页签 × 全部文字节点（`--list` 用） |
| `reports/_r50/mock_ui_tabs_scrolled.xml` | 模拟「已滑到第 12 章附近」的 6 个可见页签（命中路径用） |
| `reports/_r50/mock_ui_tabs_offscreen.xml` | 页签整体挪到屏外（offscreen 判据用） |

**边界**：mock 只证明「XML → 文字 → 坐标」的解析与判定逻辑正确，
**不证明真机 dump 的结构与 mock 一致**。真机首次 `--list` 仍需人工核对（§13.2 的对照表）。

### 14.1 真机 dump 回归（2026年11月1日 14:10，样本来自 android-scheduler-agent）

样本：`reports/_r50/fixtures/ui_settings_before.xml`（A17 上 `Oreki 设置` 页整页 dump，22 个非空文字节点）。

| 用例 | 断言 | 结果 |
| --- | --- | --- |
| T14-a | 真机 dump 可解析，且每个节点都有合法 bounds | 通过 |
| T14-b | 空 `text=""` 节点不被当成命中 | 通过 |
| T14-c | 无残留 `&#10;` 字面量（实体已解码为真实换行） | 通过 |
| T14-d | 可点节点「保存间隔」定位成功且 `clickable=true` | 通过 |
| T14-e | 纯文本节点「调度说明」也能定位（`clickable=false`） | 通过 |
| T15-a | `&#10;` → 真实换行 | 通过 |
| T15-b | `&amp;` → `&` | 通过 |

自测总数 **22 条，22/22 通过**（`python scripts/test_r50_tap_tab.py`）。

**两条边界必须记住**：

1. 这份样本里「智能调度」是**单个 TextView**，不存在父子同文案。所以 **T11（父子去重）仍然只有 mock 覆盖**，
   不能当作已真机验证。真机第一次 `--list` 时若出现 `ambiguous`，先怀疑父子/重复节点，再怀疑关键字。
2. 实体解码是 `xml.etree.ElementTree` 自带行为，此前**没有任何用例守着**——万一将来有人把解析换成手写正则，
   跨行文案会静默匹配失败。T15 就是给这次替换设的护栏。

## 十五、教程侧旁证：`infinities` 恒 42 但 IP 在涨（2026年11月1日 13:27）

**背景**：android-agent 观察到 IP 涨 24% 而 `player.infinities` 恒为 42，需要判断是
「坍缩停了」还是「坍缩在跑但计数 bug」。教程正文是按原版机制写的，可以当**原版应有行为**的判据。

### 15.1 教程口径（原文摘录）

| 出处 | 原文 | 说明 |
| --- | --- | --- |
| 第 3 章 stageGoal | 「…完成第 1 次大坍缩，拿到无限点数…**判据：无限次数 ≥ 1 且无限点数 > 0**」 | 无限次数的唯一来源是坍缩 |
| 第 3 章 automation | 「第一次大坍缩由开局自动化在**「还没打破无限、且满足大坍缩条件」**时自动替你按下」 | 打破无限之后，坍缩交给原版自动大坍缩（间隔已拉满 100 毫秒） |
| 第 5 章 numbers | 「**打破无限后的单次坍缩收益** = 10 的「以 10 为底取本纪最高反物质 ÷ 30 − 0.75」次方 × 无限点数倍率」 | 打破无限之后**坍缩仍然发生**，每次仍结算 |
| 第 5 章 traps | 「打破无限后…单次坍缩收益仍然只有…；无限点数要涨数量级靠的是无限维度，**不是多坍缩几次**」 | 语义仍是「可以多次坍缩」，只是量级靠无限维度 |
| 第 5 章 numbers | 「3 个可重复的打破无限升级：…/ **无限点数自动生成** 10 级（每级 ×10）」 | **存在不经过坍缩的被动 IP 来源** |

**教程给出的原版语义**：破无限后坍缩持续发生 → 每次 `+无限次数`、`+无限点数`。
所以「无限次数冻结」在原版语义下属于异常，不是正常状态。

### 15.2 代码印证（Web 侧源码，只读）

| 位置 | 事实 |
| --- | --- |
| `src/core/big-crunch.js:70` | `Currency.infinities.add(gainedInfinities().round())` —— **无限次数的唯一增量点**（另一处 `oreki-instant-challenges.js:127` 同属坍缩路径） |
| `src/game.js:542` | `gainedInfinities()` 返回值恒 `≥ 1`（挑战/佩勒特殊情形为 1，其余再乘成就与时间研究）→ **只要发生一次坍缩，计数必然 +≥1**，不存在「坍缩了但加了 0」 |
| `src/core/big-crunch.js:190` | `Currency.infinityPoints.add(BreakInfinityUpgrade.ipGen.effectOrDefault(0) × diff/60000)` —— **IP 每帧被动增长，完全不经过坍缩** |
| `src/core/player.js:967` | `canCrunch` = `thisInfinity.maxAM ≥ goal`（常规为 `NUMBER_MAX_VALUE`），每次坍缩后 `thisInfinity` 重置 |

### 15.3 结论

**`infinities` 恒 42 + IP 上涨，不构成「计数 bug」的证据**，两种解释里更符合代码与教程的是：

> **(a) 坍缩确实没有发生；IP 来自打破无限的可重复升级「无限点数自动生成」（`ipGen`），它不经过坍缩。**

理由：`infinities` 只有坍缩一个增量点，且每次必 +≥1；而 IP 有一条独立的被动来源。
只要 `ipGen` 已买，IP 就会持续上涨，与坍缩是否发生无关。

### 15.4 给排查方的决定性判据（都不需要教程）

| 判据 | 通过（= 坍缩真的停了） | 不通过（= 计数 bug） |
| --- | --- | --- |
| 每分钟 IP 增量 ≈ `BreakInfinityUpgrade.ipGen.effect`（`big-crunch.js:190` 的 `diff/60000` 即「每分钟 × effect」） | 两个数相等 → 零坍缩 | IP 增量明显大于 ipGen → 有坍缩在结算 |
| `player.records.thisInfinity.maxAM` 是否在涨 | 涨而 `infinities` 不动 → 卡在坍缩闸门 | 不涨 → AM 层另有阻塞 |
| `player.records.thisInfinity.realTime` / 本纪时长 | 持续增长说明这一纪没重置 | 每 100 毫秒重置说明坍缩在跑 |

### 15.5 边界

本节只覆盖**教程口径 + Web 源码**。Android 侧若用 smali 改过坍缩闸门（例如 `X_HIGHEST` 门控），
真正卡住的位置在那边，需要 android-agent 的 smali 读数确认；本节的结论是「不要用 IP 上涨去推断坍缩在跑」。

### 15.6 补充：`ipGen` 是「历史最佳 IP/分钟的比例」，不是固定产出（关键修正）

读 `src/core/secret-formula/infinity/break-infinity-upgrades.js:129-142`：

```js
ipGen: rebuyable({
  initialCost: 1e7, costIncrease: 10, maxUpgrades: 10,
  effect: value => Player.bestRunIPPM.times(value / 20),   // value = 已买等级 0~10
  description: 自动生产你过去 10 次无限中最佳的无限点/分钟的 (5 × 等级)%
})
```

而 `Player.bestRunIPPM`（`src/core/cache.js:50-55`）= `player.records.recentInfinities` 里
`IP / 真实时长` 的**最大值**（折算每分钟）。于是：

| 事实 | 推论 |
| --- | --- |
| 满级 10 级 ⇒ `bestRunIPPM × 10/20` = **历史最佳 IP/分钟的 50%** | 纯 ipGen 的产出**上限锁死在 0.5 × 历史最佳值**，它不会自我加速 |
| 该速率与当前是否坍缩无关，只与历史最佳有关 | IP 会**线性**增长，不是指数；坍缩停了它照样涨 |
| 历史最佳来自「过去 10 次无限」 | 坍缩停了以后，历史最佳**不再被刷新**，速率就固定不动 |

**到 1e8 的时间（纯 ipGen，无坍缩）**：

```
t(分钟) = (1e8 − 当前 IP) / (0.5 × bestRunIPPM)
```

举例：若单次坍缩 0.1 秒给 1 IP ⇒ bestRunIPPM ≈ 600 ⇒ 满级 ipGen = 300 IP/分钟
⇒ 到 1e8 需 ≈ 33 万分钟（≈ 231 天）。**靠等是到不了的**，除非历史最佳本身已很高。

> 结论：`ipGen` 是「把已经达到过的速度固定下来一半」，不是新的增长引擎。
> 「IP 涨不涨」不能用来判断系统健康，只能用来算「离 1e8 还有多久」。

### 15.7 待办：教程第 5 章该处措辞不够精确（未改，等构建批次）

第 5 章 numbers 现写作：「3 个可重复的打破无限升级｜… / **无限点数自动生成 10 级（每级 ×10）**」。
「每级 ×10」讲的是**价格**（`costIncrease: 10`），但没写**效果**，容易被读成「效果每级 ×10」。

建议改为：「无限点数自动生成：10 级，价格每级 ×10，**效果每级 +5%，满级 = 历史最佳 IP/分钟的 50%**」。

**未现在修改的原因**：改 JSON 就会让 `payload/assets/oreki_tutorial.txt` 落后于源，
`verify_tutorial_zh.py` 的 A2（逐字节同步）会立刻变红，而当前不允许构建。
建议与下一次构建批次一起改（改 JSON → 重生成 gen.js 与 payload → 重跑 A/B/C/D/E/F 组）。
