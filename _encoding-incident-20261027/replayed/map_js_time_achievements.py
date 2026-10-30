# -*- coding: utf-8 -*-
"""只读：在 ADChinese/ADfaster 的 normal-achievements.js 中，把每一处时间读取映射到成就 ID"""
import re, io, os, sys

BASE = r"C:\Users\Oreki\WorkBuddy\2026-10-24-00-34-44\upstream"
FILES = {
    "ADChinese": os.path.join(BASE, "ADChinese", "src", "core", "secret-formula", "achievements", "normal-achievements.js"),
    "ADfaster": os.path.join(BASE, "ADfaster", "src", "core", "secret-formula", "achievements", "normal-achievements.js"),
}
TIME_RE = re.compile(r"Time\.(thisInfinity|thisEternity|thisReality)\.|records\.(thisInfinity|thisEternity|thisReality)\.|lastUpdate")

for name, path in FILES.items():
    print("=" * 30, name)
    lines = io.open(path, encoding="utf-8", errors="replace").read().splitlines()
    cur = None
    for i, l in enumerate(lines, 1):
        m = re.match(r"\s*id: (\d+),", l)
        if m:
            cur = int(m.group(1))
        if TIME_RE.search(l) and "checkRequirement" not in l and "effect" not in l:
            pass
        if TIME_RE.search(l):
            tag = "check" if "checkRequirement" in l else ("effect" if "effect" in l else ("cond" if "effectCondition" in l else "?"))
            fac = "/ getGlobalSpeedFactor()" in l or "getGlobalSpeedFactor()" in l
            print("  line %-5d ach=%-4s %-6s factor=%s   %s" % (i, cur, tag, "Y" if fac else "N", l.strip()[:110]))
