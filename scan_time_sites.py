import re
import sys
from pathlib import Path

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
pats = sys.argv[2:] or ["getGlobalSpeedFactor", "toInGameTimeMs", "inGameTimeOf", "seedInGameTime"]
rx = re.compile("|".join(pats))
hits = []
for p in sorted(Path(root).rglob("*.js")):
    if "node_modules" in p.parts:
        continue
    try:
        text = p.read_text(encoding="utf-8")
    except Exception:
        continue
    for i, line in enumerate(text.splitlines(), 1):
        if rx.search(line):
            hits.append((p.as_posix(), i, line.strip()[:150]))
for h in hits:
    print(f"{h[0]}:{h[1]}: {h[2]}")
print("TOTAL", len(hits))
