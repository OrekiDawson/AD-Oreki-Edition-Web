# 构建、发布与交付

本文件只包含当前生效的构建、测试和交付要求。Android 与 Web 的平台细节分别由 `ANDROID.md`、`WEB.md` 和对应细则补充。

## 1. 构建

### 1.1 Android

默认使用 `./gradlew assembleRelease --offline`；Windows 使用等价的 `gradlew.bat`。优先复用当前 JDK、Android SDK、Gradle、D8 和缓存，只有缺少必要依赖时才联网补齐。

### 1.2 构建输入

构建前保护用户已有修改、上一个可回滚产物和当前签名输入。候选构建写入候选位置，不覆盖稳定产物；只生成 APK，不以 XAPK 作为 MOD 交付物。

### 1.3 构建结果

报告必须绑定源码输入、项目/包名、版本、产物路径、文件大小、SHA-256、签名和验证结果。`BUILD SUCCESSFUL`、退出码或复制成功本身不能证明稳定交付。

## 2. 验证

### 2.1 候选验证

候选允许按实际开发需要多次构建。每次候选都必须使用对应 APK 做定向测试；旧 APK 的测试结果不得转移给新 APK。

### 2.2 Android 运行验证

影响 Android 运行行为的改动，按影响范围执行 Kotlin→D8→DEX→APK、签名、契约检查、独立 AVD 安装和真实 GUI 验证。共享 AVD 与正式构建资源必须串行。

### 2.3 Web 验证

影响 Web 行为的改动，执行项目实际使用的模块校验、定向测试、移动端 GUI 检查和部署后访问检查。静态检查不能替代浏览器中的真实行为验证。

### 2.4 结果分级

报告明确区分 `PASS`、`FAIL`、`BLOCKED` 和 `NOT RUN`。未完成必要运行验证的产物只能称为候选，不能称为稳定版。

## 3. Android 正式交付

### 3.1 门禁

只有通过必要签名、契约和运行验证的同一份 APK 才能正式发布。发布前冻结构建输入，并记录 APK SHA-256 与 `release-manifest.json`。

### 3.2 四渠道

正式 Android APK 使用同一份已验证文件交付到 OneDrive、Google Drive、GitHub Releases 和 Kubuntu 本地 SSH/SFTP 目录。任何渠道失败都单独记录和重试，不重建 APK，也不把部分成功写成全部完成。

### 3.3 发布工具

优先使用 `scripts/publish_four_channels.py`：普通构建不上传；正式发布显式使用 `--publish`；仅更新本地 SSH/SFTP 使用 `--local-only`；检查使用 `--check`；预演使用 `--dry-run`。

### 3.4 Release

每个经过验证的 APK 使用唯一更新标签 `android-update-<正式版本>-<SHA256前8位>` 创建 GitHub Release。已有 Release 不覆盖、不删除；同标签仅在 SHA-256 相同的情况下按幂等处理。

## 4. Web 正式部署

### 4.1

Web 修改完成必要测试后，按当前 Git 流程提交并推送 `main`，再部署到线上站点并检查实际页面、关键功能和资源加载。

### 4.2

源码仓库是唯一功能修改入口；`web/_deploy/site` 只接受同步后的部署内容，不直接实现游戏功能。

## 5. 报告与安全

### 5.1

交付报告记录构建环境、耗时、源码输入、产物身份、验证边界、Git 状态、部署状态和未解决阻碍；动态环境事实放入 FACTS 或任务记录。

### 5.2

凭据、私钥、远端配置和个人路径不得进入仓库、日志或 Release 附件。禁止强推、破坏性历史重写、删除用户存档或发布未经验证的候选包。
