#!/usr/bin/env python3
"""独立检查 Web 的 import 闭包与 _deploy/filelist.txt 的覆盖关系。

为什么不依赖 `sync_deploy.py --dry-run`：
  --dry-run 回答的是「按清单同步会写哪些文件」，它默认清单是对的。
  但清单本身可能就是错的（漏项 / 多项）。本脚本从入口 `src/main.js` 真实
  求一遍静态 import 闭包，再拿闭包去对清单，才能发现「运行时需要但清单里没有」。

用法：
    python check_import_closure.py [--src <Web源码根>]
"""
from __future__ import annotations

import argparse
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.abspath(os.path.join(HERE, "..", ".."))

# import ... from 'x' / export ... from 'x' / import('x')
IMPORT_RE = re.compile(
    r"""(?<![\w$])(?:"""
    r"""import\s+(?:[\w*\s{},$]+\s+from\s+)?|"""
    r"""export\s+[\w*\s{},$]+\s+from\s+|"""
    r"""import\s*\(\s*"""
    r""")['"]([^'"]+)['"]"""
)


def norm(p: str) -> str:
    return p.replace("\\", "/")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=os.path.join(WEB, "AD-Oreki-Edition"))
    ap.add_argument("--entry", default="src/main.js")
    args = ap.parse_args()
    src_root = os.path.abspath(args.src)

    filelist_path = os.path.join(WEB, "_deploy", "filelist.txt")
    fl = set()
    with open(filelist_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                fl.add(norm(line))
    print(f"filelist 条目: {len(fl)}")

    graph: dict[str, list[str]] = {}
    for dirpath, _dirnames, filenames in os.walk(os.path.join(src_root, "src")):
        for fn in filenames:
            if not fn.endswith(".js"):
                continue
            full = os.path.join(dirpath, fn)
            rel = norm(os.path.relpath(full, src_root))
            with open(full, encoding="utf-8", errors="replace") as fh:
                txt = fh.read()
            deps = []
            for m in IMPORT_RE.finditer(txt):
                s = m.group(1)
                if not s.startswith("."):
                    continue
                t = norm(os.path.normpath(os.path.join(os.path.dirname(rel), s)))
                if not t.endswith(".js"):
                    t += ".js"
                deps.append(t)
            graph[rel] = deps

    seen: set[str] = set()
    missing: list[str] = []
    stack = [args.entry]
    while stack:
        cur = stack.pop()
        if cur in seen:
            continue
        seen.add(cur)
        if not os.path.exists(os.path.join(src_root, cur)):
            missing.append(cur)
            continue
        stack.extend(graph.get(cur, []))
    print(f"从 {args.entry} 可达 {len(seen)} 个模块")
    if missing:
        print(f"\n!!! 闭包里引用了但源码不存在（{len(missing)}）")
        for x in sorted(set(missing)):
            print("   ", x)

    not_in_fl = sorted(x for x in seen if x not in fl)
    print(f"\n=== 闭包内、但不在 filelist（{len(not_in_fl)}）===")
    for x in not_in_fl:
        print("   ", x)

    no_src = sorted(
        x for x in fl if x.startswith("src/") and not os.path.exists(os.path.join(src_root, x))
    )
    print(f"\n=== filelist 里有、但源码不存在（{len(no_src)}）===")
    for x in no_src:
        print("   ", x)

    unused = sorted(set(graph) - seen - fl)
    print(f"\n=== 源码里未被闭包引用、也不在 filelist（{len(unused)}，通常是探针/未接线模块）===")
    for x in unused:
        print("   ", x)

    hard_fail = bool(not_in_fl) or bool(no_src)
    print("\n判定:", "FAIL（清单与闭包不一致）" if hard_fail else "PASS（闭包全部被清单覆盖）")
    return 1 if hard_fail else 0


if __name__ == "__main__":
    sys.exit(main())
