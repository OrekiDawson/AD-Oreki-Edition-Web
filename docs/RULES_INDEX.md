# 当前规则索引

本文件只登记当前生效规则的入口，不复制正文。历史、废止和被取代内容不出现在本索引，统一位于本目录的 `rules/archive/`。

## 1. 常驻入口

### 1.1 核心规则

[CORE](rules/CORE.md)

### 1.2 协作、并发与交接

[AGENT_WORKFLOW](rules/AGENT_WORKFLOW.md)

## 2. 按职责加载

### 2.1 Android 业务、基线与逆向分析

[ANDROID](rules/ANDROID.md) · [Android 细则](rules/DETAIL_ANDROID.md)

### 2.2 Web 逻辑与移动端

[WEB](rules/WEB.md) · [Web 细则](rules/DETAIL_WEB.md)

### 2.3 构建、测试、签名与发布

[RELEASE](rules/RELEASE.md) · [Release 细则](rules/DETAIL_RELEASE.md)

### 2.4 工具链、平台与共享资源

[TOOLCHAIN](rules/TOOLCHAIN.md) · [Toolchain 细则](rules/DETAIL_TOOLCHAIN.md)

### 2.5 Git、工作区和文件保护

[GIT](rules/GIT.md)

### 2.6 教程、术语和 README

[TUTORIAL](rules/TUTORIAL.md) · [Tutorial 细则](rules/DETAIL_TUTORIAL.md)

### 2.7 规则维护

[GOVERNANCE](rules/GOVERNANCE.md)

## 3. 当前长期证据规则

### 3.1 阶段与 GUI

[长期规则：验证与证据](../../../docs/长期规则_验证与证据.md)

### 3.2 事实台账

Android：`docs/FACTS.md`；Web：`docs/FACTS.md`。

### 3.3 跨端差异

[WEB_ANDROID_DIFFERENCES](../../../WEB_ANDROID_DIFFERENCES.md)

### 3.4 首次大坍缩与 Break 阶段保护

[长期规则 §15](../../../docs/长期规则_验证与证据.md#15-首次大坍缩后禁止立即-break-infinity)

### 3.5 FACTS 与 README 编号格式

[长期规则 §17](../../../docs/长期规则_验证与证据.md#17-规则文档与-facts-编号格式)

## 4. 编号与归档规则

### 4.1 生效规则编号

生效正文使用连续层级编号：`1.`、`1.1`、`1.1.1`。R 编号只作为来源或任务标识，不代替正文层级。

### 4.2 历史归档目录

本仓库的历史规则统一位于 `rules/archive/`。

### 4.3 归档隔离

归档文件不能被当前规则入口引用为权威正文，不能出现在活动规则正文中。规则被取代时，先从活动文件删除，再移动到归档目录；只在当前索引保留新的权威入口。
| 首次大坍缩后禁止立即 Break Infinity（R99） | [长期规则_验证与证据](../../../docs/长期规则_验证与证据.md) §15 | 长期 |
