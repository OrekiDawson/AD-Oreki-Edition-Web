#!/usr/bin/env python3
"""校验三处 AGENTS.md 是同一份文件（硬链接），并可选重建。

背景
----
工作区根 `AGENTS.md` 是全局规则唯一源，但它所在的 `AD-Oreki-Unified/` 根目录
**不是 git 仓库**。两个平台仓库的 `AGENTS.md` 都引用「规则源 = 工作区根 `AGENTS.md` §4-X」，
而在 2026-10-29 之前那份文件从未进入任何 repo —— clone 后引用全是悬空指针。

现在通过硬链接把同一份文件放进两个仓库：

    工作区根                        AD-Oreki-Unified/AGENTS.md            （权威源）
    Web 仓库镜像                    web/AD-Oreki-Edition/docs/AGENTS_GLOBAL.md
    Android 仓库镜像                android/AD_Oreki_Edition_Android/docs/AGENTS_GLOBAL.md

三处必须是同一个 inode，才能做到「改一处、三处同步」。一旦有人用「另存为 / 新建同名文件」
替换了镜像，硬链接就断了，三处开始分叉。本脚本就是守这条线的。

用法
----
    python scripts/check_agents_sync.py           # 只检查，不一致时退出码 1
    python scripts/check_agents_sync.py --fix     # 以工作区根为准重建硬链接

退出码
------
    0  三处 inode 与 SHA-256 均一致
    1  不一致（已打印差异）；--fix 模式下未能修复时同样返回 1
    2  权威源缺失（工作区根 AGENTS.md 不存在）
"""

from __future__ import annotations

import hashlib
import os
import sys

# 本脚本同时存放于三个位置，必须能自适应定位工作区根：
#   工作区根/scripts/check_agents_sync.py
#   web/AD-Oreki-Edition/scripts/check_agents_sync.py
#   android/AD_Oreki_Edition_Android/scripts/check_agents_sync.py
#
# 判据：工作区根是**同时直接包含 `web/AD-Oreki-Edition` 与
# `android/AD_Oreki_Edition_Android` 两个子目录**的那个目录。
# 从脚本位置逐级向上找，找到即停。
WEB_REL = os.path.join("web", "AD-Oreki-Edition")
ANDROID_REL = os.path.join("android", "AD_Oreki_Edition_Android")


def find_root(start: str) -> str | None:
    cur = os.path.abspath(start)
    while True:
        if os.path.isdir(os.path.join(cur, WEB_REL)) and os.path.isdir(os.path.join(cur, ANDROID_REL)):
            return cur
        parent = os.path.dirname(cur)
        if parent == cur:
            return None
        cur = parent


_HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = find_root(_HERE)

if ROOT is None:
    print("[WARN] 未找到统一工作区根（应同时包含 web/AD-Oreki-Edition 与 "
          "android/AD_Oreki_Edition_Android）。", file=sys.stderr)
    print("       如果你只 clone 了单个仓库，这是预期情况：", file=sys.stderr)
    print("       全局规则内容已随仓库入库，直接读 docs/AGENTS_GLOBAL.md 即可；", file=sys.stderr)
    print("       三处一致性校验只能在完整工作区里做。", file=sys.stderr)
    sys.exit(0)

AUTHORITATIVE = os.path.join(ROOT, "AGENTS.md")
MIRRORS = [
    os.path.join(ROOT, WEB_REL, "docs", "AGENTS_GLOBAL.md"),
    os.path.join(ROOT, ANDROID_REL, "docs", "AGENTS_GLOBAL.md"),
]


def sha256_of(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def describe(path: str) -> tuple[int, int, str]:
    st = os.stat(path)
    return st.st_ino, st.st_size, sha256_of(path)


def rel(path: str) -> str:
    try:
        return os.path.relpath(path, ROOT).replace("\\", "/")
    except ValueError:
        return path


def report() -> bool:
    """打印三处状态，返回是否全部一致。"""
    if not os.path.isfile(AUTHORITATIVE):
        print(f"[FAIL] 权威源缺失: {rel(AUTHORITATIVE)}", file=sys.stderr)
        return False

    rows = []
    for path in [AUTHORITATIVE] + MIRRORS:
        if not os.path.isfile(path):
            print(f"[FAIL] 文件不存在: {rel(path)}", file=sys.stderr)
            return False
        rows.append((path, *describe(path)))

    inodes = {r[1] for r in rows}
    hashes = {r[3] for r in rows}

    print("三处 AGENTS.md 状态：")
    for path, ino, size, digest in rows:
        print(f"  inode={ino:<20} size={size:>7}B  sha256={digest[:16]}  {rel(path)}")

    ok = True
    if len(inodes) == 1:
        print("  [OK] inode 一致 —— 三处是同一文件（硬链接），改一处即三处同步")
    else:
        ok = False
        print(f"  [FAIL] inode 不一致（{len(inodes)} 种）—— 硬链接已断裂，三处已分叉")

    if len(hashes) == 1:
        print("  [OK] SHA-256 一致")
    else:
        ok = False
        print(f"  [FAIL] SHA-256 不一致（{len(hashes)} 种）—— 内容已分叉")
        for path, _ino, _size, digest in rows:
            print(f"         {digest}  {rel(path)}")
    return ok


def fix() -> bool:
    """以工作区根为准，重建镜像的硬链接。"""
    if not os.path.isfile(AUTHORITATIVE):
        print(f"[FAIL] 权威源缺失，无法修复: {rel(AUTHORITATIVE)}", file=sys.stderr)
        return False

    src_ino = os.stat(AUTHORITATIVE).st_ino
    for path in MIRRORS:
        parent = os.path.dirname(path)
        if parent:
            os.makedirs(parent, exist_ok=True)

        if os.path.isfile(path):
            if os.stat(path).st_ino == src_ino:
                print(f"  [SKIP] 已是硬链接: {rel(path)}")
                continue
            # 内容若与权威源不同，先留个备份，避免静默丢改动
            if sha256_of(path) != sha256_of(AUTHORITATIVE):
                backup = path + ".diverged.bak"
                os.replace(path, backup)
                print(f"  [WARN] 内容与权威源不同，已备份到 {rel(backup)}")
            else:
                os.unlink(path)
        try:
            os.link(AUTHORITATIVE, path)
            print(f"  [FIX] 已重建硬链接: {rel(path)}")
        except OSError as exc:  # 跨卷/权限等情况
            print(f"  [FAIL] 无法建立硬链接 {rel(path)}: {exc}", file=sys.stderr)
            return False
    return True


def main(argv: list[str]) -> int:
    do_fix = "--fix" in argv

    if not os.path.isfile(AUTHORITATIVE):
        print(f"[FAIL] 权威源缺失: {rel(AUTHORITATIVE)}", file=sys.stderr)
        return 2

    if do_fix:
        print("以工作区根为准重建镜像硬链接…")
        if not fix():
            return 1
        print()

    ok = report()
    if ok:
        print("\n结论：三处一致。")
        return 0

    if not do_fix:
        print("\n结论：不一致。执行 `python scripts/check_agents_sync.py --fix` 以工作区根为准重建。",
              file=sys.stderr)
    else:
        print("\n结论：修复后仍不一致，请人工检查。", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
