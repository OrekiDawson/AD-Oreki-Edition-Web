# Android 实现与分析
权威：本文件；范围：Android 生产、反混淆与基线迁移；历史来源：§23、§41–44、§62–67、§73、§75、§76.3；状态：生效。

- 本轮涉及的旧 Java/Smali 业务须完整迁移 Kotlin；禁止新增 Java/Smali 业务或直接改 Smali 方法体修业务。必要原生 ABI 入口、第三方二进制与确有工具链限制的兼容层须事前说明文件、调用关系、无法转译原因与替代方案；不能以时间不足豁免。
- 保留原业务语义、数据结构、方法签名、字段类型与中文业务注释。业务变量/方法以职责命名；真实混淆符号只留在有证据的绑定/访问边界。
- kotlinc 不接受 DEX classpath；复用项目已验证的缓存反射/绑定机制。编译、D8、最终 APK DEX 集成、真实调用路径都须证明；独立 classes.dex 不算 APK 集成。
- REA 优先：先 doctor 与本轮真实 APK 身份，再 inspect package/class/method 与 trace references。记录命令、evidence ID、APK SHA-256、关键签名与结论。provider 失败记录原因，按 §66 使用现有 JADX/DEX 等价工具；证据不足的高风险操作保持阻塞。
- 每轮需要 Android 反编译时完整导出一次：`jadx -d output_code app.apk`。复用本轮已完成导出及历史分析，不反复导出、不覆盖重要目录；错误和截断不等于实现不存在。
- 基线来自实际 APK/XAPK、Manifest、DEX、真实类/方法/字段、ABI、签名及运行证据。禁止 alias、旧版本映射、同名位置投票、名称猜测代替真实识别。activity-alias 必须核对 enabled、targetActivity 及实际启动组件。
- 绑定唯一源：baseline/versions/<版本>/bindings.json。CONFIRMED 需要至少两个独立稳定宿主锚点一致且目标描述符唯一；一个锚点/歧义为 PARTIAL，无证据/冲突为 UNCONFIRMED。构建仅消费 CONFIRMED，其他情况阻断；不放宽断言。
- 每个版本保留不可覆盖 manifest、来源、包名、versionName/versionCode、证书 SHA-256、APK SHA-256、大小和取得时间。差异写 baseline/reports/<旧>-to-<新>.md；版本差异集中 baseline/version-config.json，单一构建实现，禁止复制整套版本脚本。
- 历史映射只作调查线索；保留分析工具、核心配置和可复现成果到 Git，大型原包/导出按 LFS 或独立归档恢复价值处理。
- 日常按改动风险定向验证；版本升级执行完整必要回归，覆盖补丁、机制、挑战原版结算、存档兼容、DEX、多 DEX 与获准设备运行。frame-observer 优先观测；不得把静态引用当运行覆盖。
- Android 深色模式、官方 Current Tab 子页签标题、原版导航结构保持有效；不自造合成顶栏。教程另读 TUTORIAL.md。
- 本模块其余低频数值/操作约束由 DETAIL_ANDROID.md 按对应历史节查阅；其与本文件重合部分仅作来源，不再次立规。
