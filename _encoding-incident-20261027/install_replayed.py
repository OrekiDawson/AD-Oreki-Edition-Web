# -*- coding: utf-8 -*-
"""安装重放恢复的脚本：应用路径替换后写回原位，并做语法验证。"""
import os, shutil, subprocess, py_compile, sys

SRC = r"C:\Users\Oreki\WorkBuddy\AD-Oreki-Unified\web\_tools\_encoding-incident-20261027\replayed"
WS = r"C:\Users\Oreki\WorkBuddy\AD-Oreki-Unified"
NODE = os.path.expanduser(r"~\.workbuddy\binaries\node\versions\22.22.2-6\node.exe")

dest_map = {}
for fn in os.listdir(SRC):
    if fn in ("patch_build_assert.py", "patch_stage_start.py"):
        dest_map[fn] = os.path.join(WS, "android", "AD_Oreki_Edition_Android", "work", fn)
    elif fn == "map_js_time_achievements.py":
        dest_map[fn] = os.path.join(WS, "android", "AD_Oreki_Edition_Android", "scripts", fn)
    else:
        dest_map[fn] = os.path.join(WS, "web", "_tools", fn)

def fix_paths(s):
    s = s.replace("2026-10-24-00-34-44\\", "AD-Oreki-Unified\\web\\")
    s = s.replace("2026-10-24-00-34-44", "AD-Oreki-Unified/web")
    s = s.replace("2026-10-24-01-19-39\\", "AD-Oreki-Unified\\android\\")
    s = s.replace("2026-10-24-01-19-39", "AD-Oreki-Unified/android")
    return s

ok, bad = [], []
for fn, dest in dest_map.items():
    p = os.path.join(SRC, fn)
    with open(p, encoding="utf-8") as f:
        content = f.read()
    content = fix_paths(content)
    with open(dest, "w", encoding="utf-8", newline="") as f:
        f.write(content)
    # 语法验证
    try:
        if fn.endswith((".mjs", ".js")):
            r = subprocess.run([NODE, "--check", dest], capture_output=True, text=True, timeout=60)
            if r.returncode != 0:
                bad.append((fn, "node", r.stderr[-200:]))
            else:
                ok.append(fn)
        elif fn.endswith(".py"):
            py_compile.compile(dest, doraise=True)
            ok.append(fn)
        else:
            ok.append(fn)
    except Exception as e:
        bad.append((fn, "exc", str(e)[:200]))

print(f"安装+语法通过: {len(ok)}")
print(f"语法失败: {len(bad)}")
for fn, kind, msg in bad:
    print(f"  FAIL {fn} [{kind}] {msg}")
