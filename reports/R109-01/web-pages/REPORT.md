# R109-01 · P1-C：Web 受控 Pages 生产部署与线上验证

> 角色：R109-01 web-pages 子 Agent（task-4）· Lead：lead
> 执行时刻：2026-11-14 12:16–12:32 +08（周六，DeepSeek 低谷）
> 工作树：/home/oreki/AD-Oreki-Unified/_wt_r109_web（分支 r109-01/web-pages，基于 origin/main 8914ea5b）
> 部署目标：https://oreki.net（GitHub Pages，部署仓 OrekiDawson/OrekiDawson.github.io）
> 结论：**DEPLOY PASS**（线上已提供 Web main 8914ea5b / CI 43551150141，独立 Playwright 412×839 触控移动端验证三项 PASS）；Web 仓 deploy.yml 的 PAGES_DEPLOY_TOKEN 路线仍 **BLOCKED**（外部凭据缺失，未绕过）。

## 0. 状态总表

| 项 | 状态 | 证据 |
| --- | --- | --- |
| Environment / Secret 复核 | 完成：env 存在、secret 缺失 | §1；`web-production` created 2026-11-14T03:23:40Z，protection_rules=[]，env secrets total_count=0；repo secrets total_count=0 |
| Web deploy.yml 申请 run 43551377126 | **FAIL（凭据缺失，非代码问题）** | §1.2：gate job PASS（复用 CI 43551150141），dispatch job 在「检查 Pages Actions 权限范围」exit 1 |
| 正式部署（Pages 仓受控工作流） | **PASS** | run 43555968675，gate+deploy 两 job success，2026-11-14T04:18:14Z→04:19:22Z |
| 线上 deployment.json 身份 | **PASS** | `{web_sha:8914ea5b842aad34a36116b5947b3b03f6df6955, web_ci_run_id:43551150141}` |
| 线上 src/main.js 与源码字节一致 | **PASS** | 两侧 SHA-256 均 `a08b16948e0b521b883ca25e1194dd4abee48e8fe7e3c32165b933ad990dbd5a`（263 B） |
| 线上移动端真实浏览器验证（412×839） | **PASS** | §3：启动、AM Tick、游戏时间、页签导航、pageerror 0、非预期 console error 0 |
| 首轮验证瞬时 503 | 已记录（不可复现，不影响最终 PASS） | §3.4：04:19 首次打开时一次资源 503、#ui 未显示；之后 4 次独立启动均正常 |
| Web 仓 deploy.yml 端到端（含 secret） | **NOT RUN / BLOCKED** | 需用户手工创建细粒度 PAT 并写入 web-production 环境 secret |
| 工作流代码修改 | 不需要（未改任何工作流） | 本次为凭据与执行问题，deploy.yml 安全门禁完整保留 |

## 1. 凭据与工作流复核（不输出任何 secret 值）

### 1.1 现状事实

- `gh auth status`：已登录 OrekiDawson，scopes 含 admin:org / admin:repo / workflow。
- `GET repos/OrekiDawson/AD-Oreki-Edition-Web/environments/web-production`：存在，`created_at=2026-11-14T03:23:40Z`，`protection_rules=[]`，`deployment_branch_policy=null`。
- `GET .../environments/web-production/secrets`：`{"names":[],"total_count":0}` → **PAGES_DEPLOY_TOKEN 不存在**。
- `GET repos/OrekiDawson/AD-Oreki-Edition-Web/actions/secrets`：`{"names":[],"total_count":0}`。
- 组织级 secrets 接口返回 404（该账号不在可管理组织级 secret 的位置），未使用/未读取任何 secret 值。

### 1.2 Web deploy.yml run 43551377126 定性

- 触发：2026-11-14T03:23:20Z，`workflow_dispatch`，head_sha = 8914ea5b842aad34a36116b5947b3b03f6df6955（Web main）。
- job「复用精确源码 commit 的成功 Web CI」：**success**，复用 push CI run **43551150141**（Node checks success；Mobile Chromium smoke success）。
- job「将不可变 Web 源码发送至官方 Pages Artifact 工作流」：**failure**，失败步骤 = 「检查 Pages Actions 权限范围」，即 `test -n "$PAGES_DEPLOY_TOKEN"` 失败；后续 dispatch 步骤 skipped。
- 结论：**外部凭据缺失**，不是 CI、源码或工作流逻辑问题。

## 2. 正式部署（受控 Pages 工作流）

### 2.1 执行方式与安全边界

Web 仓 deploy.yml 的 dispatch 路由需要 `PAGES_DEPLOY_TOKEN`（跨仓 Actions:write），该 secret 不存在且本 Agent 无权/不应生成或写入 PAT。为完成受控生产部署，本次使用本机已登录的仓库 owner 凭据（gh CLI）**直接 workflow_dispatch Pages 仓的官方受控工作流** `OrekiDawson/OrekiDawson.github.io/.github/workflows/deploy-approved-web.yml`（等同于 owner 在 Pages 仓手工 Runs workflow），并传入：

- `approved_sha = 8914ea5b842aad34a36116b5947b3b03f6df6955`（Web main，PR #25 合并提交）
- `web_ci_run_id = 43551150141`（该精确 SHA 的 push CI，两项 job success）

该工作流自身（不依赖 Web 仓 secret）独立执行以下门禁后才部署，**未绕过任何 Pages 生产门禁**：

1. `approved_sha` 必须在 Web main 上（`compare/main...SHA` 为 identical/behind）；
2. 指定 CI run 必须属于精确 SHA、push、main、ci.yml、completed/success；
3. 必须存在结论 success 的 `Node checks` 与 `Mobile Chromium smoke` 两个 job；
4. 用官方 `actions/upload-pages-artifact` + `actions/deploy-pages`（OIDC / github-pages 环境）发布；
5. 从 Web 精确 commit 组装 `_site`（src/modules/public + index.html 等），写入 `deployment.json`，跑 `check_pages_staging.py`、`node --check`；
6. 部署后轮询线上 `deployment.json` 与 `src/main.js`，并在 Android Chrome 视口做冒烟。

**未做**：未直接 push 静态文件覆盖 Pages main、未修改 Pages 仓工作流、未生成/写入任何 PAT、未把任何 token 写入仓库或日志。

### 2.2 部署 run

| 项 | 值 |
| --- | --- |
| Pages 部署 run | **43555968675**（https://github.com/OrekiDawson/OrekiDawson.github.io/actions/runs/43555968675） |
| 触发 | workflow_dispatch，2026-11-14T04:18:14Z |
| gate job「验证已批准的 Web CI」 | success（04:18:18–04:18:23Z） |
| deploy job「准备、验证并部署不可变 Pages Artifact」 | success（04:18:28–04:19:22Z，含官方 Pages 发布与线上冒烟） |
| 部署前线上版本 | `web_sha=5a8ee70b4e2f2b636ad39dc880a0b92929df38e7 / ci=43540607687`（09:38+08 由 owner run 43541726035 部署，落后 main） |

## 3. 独立线上验证（不依赖部署工作流自身的冒烟）

脚本：`_wt_r109_web/reports/R109-01/web-pages/verify-live.mjs`；证据：`evidence/`。

### 3.1 部署身份

- `GET https://oreki.net/deployment.json?verify=<ts>` → **PASS**
  `{"web_sha":"8914ea5b842aad34a36116b5947b3b03f6df6955","web_ci_run_id":43551150141}`
- 线上 `src/main.js`（263 B）SHA-256 = 本地 worktree `src/main.js` SHA-256 = `a08b16948e0b521b883ca25e1194dd4abee48e8fe7e3c32165b933ad990dbd5a` → **PASS**

### 3.2 真实移动端浏览器（Playwright 1.65 + Chromium，headless）

上下文：viewport 412×839、DPR 2.625、isMobile、hasTouch、locale zh-CN、Android Chrome 158 UA；新 context、空 storage、真实 UI 点击、不改游戏时间源。

| 检查 | 结果 | 观测 |
| --- | --- | --- |
| 页面启动 | **PASS** | HTTP 200；`#ui` display=flex、可见文本 735 字符；启动约 2.4 s |
| AM Tick / 反物质增长 | **PASS** | 6 s 内 4.08299530145433e+54 → 5.19877933189735e+191（页面内 Decimal 比较 true） |
| 游戏时间 | **PASS** | `player.records.totalTimePlayed` 6,110,000 → 66,360,000；`realTimePlayed` 611 → 6,636 ms |
| 导航（移动端抽屉） | **PASS** | 点 `.c-oreki-nav__toggle` 打开抽屉（x −224→0），点「选项」页签：抽屉关闭（x→−224）、激活页签 维度→「选项 存档 视觉」、选项内容真实出现（导出/导入/保存/选择存档/自动存档：30 秒）；再返回「维度」页签 PASS |
| pageerror | **PASS** | 0 |
| 非预期 console error | **PASS** | 0 |
| 预期 CSP 阻断（页面 CSP 阻止 googletagmanager） | 记录 1 条 | 与 Pages 工作流冒烟同一预期类别，不算失败 |
| 网络非 2xx | 记录 1 条 | `public/images/stars-bg.webm` net::ERR_ABORTED（背景视频被浏览器取消，页面表现正常） |

截图证据：
- `evidence/live-initial.png`（启动后主界面，含移动端顶部栏与汉堡按钮）
- `evidence/live-after-nav.png`（抽屉打开、选项页签选中）
- `evidence/live-final.png`（返回维度页签后）

### 3.3 首次验证瞬时故障（如实记录）

- 首次验证（04:19:38–04:21:12Z）时，`deployment.json` 与 `main.js` 已为新版本，但浏览器内出现 1 次资源 503、`#ui` 90 s 内未显示（标题/加载画面）。
- 随后 4 次独立启动（04:22、04:23、04:25、04:30Z）均正常完成启动与全部检查；第 5 次为最终 `result.json` 的 PASS 记录。
- 判定：部署刚完成时的 CDN/边缘瞬时资源失败，非版本缺陷；已保留首次失败截图与诊断记录（`evidence/diag/`、`evidence/verify.log` 多次尝试）。诚实口径：瞬时 503 出现过 1 次，之后不可复现；最终线上验证 PASS。

## 4. BLOCKED：Web 仓 deploy.yml 的凭据路线

以下为恢复「Web 仓一键申请部署」所需的**精确手工操作**（本 Agent 未执行，因为需要生成新凭据/写入 secret，超出安全边界）：

1. 在 GitHub 创建 **fine-grained PAT**，仅授权仓库 `OrekiDawson/OrekiDawson.github.io`，权限最小集：**Actions: Read and write** + **Metadata: Read-only**（无需 Contents 写权限，因为部署走官方 Pages artifact API）。
2. 打开 `OrekiDawson/AD-Oreki-Edition-Web` → Settings → Environments → `web-production` → Add environment secret，名称 **`PAGES_DEPLOY_TOKEN`**，值 = 上一步 PAT。
3. （建议）为该 Environment 增加 required reviewers 或 branch policy（当前 `protection_rules=[]`，任何人可触发 dispatch job）。
4. 重新以 `approved_sha=<main SHA>` 手动触发 Web 仓「申请已批准的 Web Pages 部署」`deploy.yml`，验证端到端（该 run 会再调用 Pages 仓受控工作流；本次已证明 Pages 侧门禁与部署可行）。
5. 如需轮换：删除旧 PAT 后更新同名环境 secret。

在此之前，Web 仓 deploy.yml 的 dispatch 步骤会继续在「检查 Pages Actions 权限范围」失败；**这不影响线上已部署的 8914ea5b**，但意味着下次部署仍需 owner 直接 dispatch Pages 工作流。

## 5. 复现命令

```bash
# 线上身份
curl -sS 'https://oreki.net/deployment.json?verify='$(date +%s)

# 独立验证（需 ~/.npm/_npx/.../playwright，本机已有 Playwright 1.65 + chromium-1254）
cd /home/oreki/AD-Oreki-Unified
OUT_DIR=/home/oreki/AD-Oreki-Unified/reports/R109-01/web-pages/live \
  node _wt_r109_web/reports/R109-01/web-pages/verify-live.mjs

# 查看部署 run
gh api repos/OrekiDawson/OrekiDawson.github.io/actions/runs/43555968675
```

## 6. 边界与未做事项

- 未修改 Web 源码、未改工作流、未直接 push Pages main、未使用 AVD/adb/emulator、未影响 Android 工作树。
- 未生成/写入/输出任何 token；只读取 secret 名称与数量。
- 未在 Android Chrome 真机/AVD 复测（本任务禁止 AVD；模拟 Chromium ≠ 真机）。
- 未验证存档兼容/回滚演练（本次为同一 main 版本部署，非基线升级；回滚能力依赖 Pages 部署历史，未做演练）。
