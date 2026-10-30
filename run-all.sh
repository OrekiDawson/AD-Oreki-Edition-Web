#!/usr/bin/env bash
# AD: Oreki Edition 全套验收（16 组）
# 用法：bash run-all.sh [项目目录]
set -u
cd "$(dirname "$0")"

export PATH="$HOME/.workbuddy/binaries/node/versions/22.22.2-6:$PATH"
unset ELECTRON_RUN_AS_NODE
# 浏览器启动兼容层（见 lib/patch-launch.mjs）：
# 本机 Edge 156 在有后台实例时会把新启动委派出去，puppeteer.launch 会立刻拿到 exit 0。
# 这里统一用 spawn+connect 的方式接替 launch，避免整套测试因浏览器启动方式而失败。
export OREKI_PATCH_DIR="$(pwd)"
export NODE_OPTIONS="--import=file://$(pwd -W 2>/dev/null || pwd)/lib/patch-launch.mjs"

TARGET="${1:-../AD-Oreki-Edition}"
PORT=8200
FAILED=0
SUITES=()
SAVE_ZIP="C:/Users/Oreki/Downloads/反物质维度steam网页全存档-1123个.zip"

# 本套件全部用到的脚本（顺序即执行顺序）
SCRIPTS=(
  smoke.mjs
  verify-speed.mjs
  verify-ui.mjs
  verify-tools.mjs
  verify-gameplay.mjs
  verify-late-game.mjs
  verify-save-compat.mjs
  verify-time-ui.mjs
  verify-time-dynamics.mjs
  verify-time-dataset.mjs
  verify-time-equivalence.mjs
  verify-challenge-time-semantics.mjs
  verify-instant-challenges.mjs
  verify-ec12-limit.mjs
  verify-time-rupg.mjs
  verify-time-enslaved.mjs
  verify-async-cleanup.mjs
  verify-autobuyer-toggle-ui.mjs
  verify-tickspeed-toggle-ui.mjs
)

echo "════════════════════════════════════════════════════════════"
echo "  预检：测试只允许访问本地副本"
echo "════════════════════════════════════════════════════════════"
GUARD_FAIL=0
for s in "${SCRIPTS[@]}"; do
  if [ ! -f "$s" ]; then
    echo "  ✗ 缺少脚本 $s"
    GUARD_FAIL=1
    continue
  fi
  # page.goto 只允许指向 127.0.0.1 / localhost
  if grep -nE "page\.goto\([^)]*https?://" "$s" 2>/dev/null | grep -qv "127\.0\.0\.1\|localhost"; then
    echo "  ✗ $s 的 page.goto 指向了非本地地址："
    grep -nE "page\.goto\([^)]*https?://" "$s" | grep -v "127\.0\.0\.1\|localhost" | sed 's/^/      /'
    GUARD_FAIL=1
  fi
done
if [ "$GUARD_FAIL" -eq 0 ]; then
  echo "  ✓ ${#SCRIPTS[@]} 个脚本都只访问本地副本，不触线上环境"
else
  echo "  → 预检失败，终止运行"
  exit 2
fi

# 存档压缩包完整性（只读校验，测试不得修改它）
sha_of_zip() {
  if [ -f "$SAVE_ZIP" ]; then
    sha256sum "$SAVE_ZIP" 2>/dev/null | cut -d' ' -f1
  else
    echo "missing"
  fi
}
ZIP_BEFORE="$(sha_of_zip)"
echo "  存档包指纹（运行前）: ${ZIP_BEFORE:0:16}…"

run() {
  local name="$1"; shift
  local script="$1"; shift
  echo ""
  echo "════════════════════════════════════════════════════════════"
  echo "  $name"
  echo "════════════════════════════════════════════════════════════"
  local log
  log="$(mktemp)"
  node "$script" "$TARGET" "$PORT" >"$log" 2>&1
  local code=$?
  grep -vE "^\s*$" "$log"
  rm -f "$log"
  # 以 node 的退出码为准，不能用 grep 的（管道会吞掉失败）
  if [ "$code" -eq 0 ]; then
    SUITES+=("PASS  $name")
    echo "→ $name 通过"
  else
    SUITES+=("FAIL  $name（exit $code）")
    FAILED=$((FAILED + 1))
    echo "→ $name 失败（exit $code）"
  fi
  PORT=$((PORT + 2))
}

run "1. 启动冒烟（项目根目录直接托管）"   smoke.mjs
run "2. 速度系统"                        verify-speed.mjs
run "3. 设置界面与响应式"                verify-ui.mjs
run "4. 成就/存档工具"                   verify-tools.mjs
run "5. 核心玩法回归"                    verify-gameplay.mjs
run "6. 后期系统（Eternity/Pelle/黑洞/Reality）" verify-late-game.mjs
run "7. 跨版本存档兼容性"                verify-save-compat.mjs
run "8. 时间统计语义与挑战最佳时间（浏览器）" verify-time-ui.mjs
run "9. 动态倍率/特殊阶段/离线结算的时间语义" verify-time-dynamics.mjs

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  10. 1123 个真实存档的时间口径（Node，无需浏览器）"
echo "════════════════════════════════════════════════════════════"
node verify-time-dataset.mjs >/tmp/ds.log 2>&1
ds_code=$?
grep -vE "^\s*$" /tmp/ds.log
if [ "$ds_code" -eq 0 ]; then
  SUITES+=("PASS  10. 1123 存档时间口径")
  echo "→ 10. 1123 存档时间口径 通过"
else
  SUITES+=("FAIL  10. 1123 存档时间口径（exit $ds_code）")
  FAILED=$((FAILED + 1))
  echo "→ 10. 1123 存档时间口径 失败（exit $ds_code）"
fi

run "11. inGameTime 与官方 time 的等价性"  verify-time-equivalence.mjs
run "11b. 挑战计时/限时判定同源（C/IC/EC + EC12）" verify-challenge-time-semantics.mjs
run "11c. 挑战进入即完成（C/IC/EC，含幂等与未解锁防线）" verify-instant-challenges.mjs
run "11d. EC12 限时语义（F=1/2/10000、中途切倍率、边界、即时完成优先）" verify-ec12-limit.mjs
run "12. RUPG22/RUPG23/EU6 时间口径"      verify-time-rupg.mjs
run "13. bestInfinity / Enslaved 释放与储存上限" verify-time-enslaved.mjs
run "14. Async.run 清理契约（正常/同步回退/单批/异常）" verify-async-cleanup.mjs
run "15. 自动购买器间隔缩放：设置页入口与持久化" verify-autobuyer-toggle-ui.mjs
run "16. Tick Speed 购买器间隔缩放：入口/独立性/持久化" verify-tickspeed-toggle-ui.mjs

# 运行后再校验一次存档包未被改动
ZIP_AFTER="$(sha_of_zip)"
echo ""
if [ "$ZIP_BEFORE" = "$ZIP_AFTER" ]; then
  echo "  ✓ 存档包未被修改（${ZIP_AFTER:0:16}…）"
else
  echo "  ✗ 存档包指纹变化：${ZIP_BEFORE:0:16}… → ${ZIP_AFTER:0:16}…"
  SUITES+=("FAIL  存档包完整性")
  FAILED=$((FAILED + 1))
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  汇总"
echo "════════════════════════════════════════════════════════════"
for s in "${SUITES[@]}"; do echo "  $s"; done
echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "全部套件通过 ✅"
else
  echo "有 $FAILED 个套件失败 ❌"
fi
exit "$FAILED"
