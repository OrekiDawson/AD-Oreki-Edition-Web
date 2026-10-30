"""把「挑战/成就时间门槛」从 `原始时间 / 当前倍率` 改为逐帧累加器口径。

为什么：`Time.thisX.totalS / getGlobalSpeedFactor()` 会把整段历史按**当前**倍率重算，
玩家中途改倍率时历史时间瞬间被放大/缩小 F 倍；而挑战成绩（bestTimes）早已用
`inGameTimeOf` 累加器。两种口径不同源，正是「挑战计时被倍率破坏」的根因。

改写映射（单位换算保持等价，仅换时钟）：
  Time.thisX.totalMilliseconds / F -> inGameTimeOf(player.records.thisX)
  Time.thisX.totalSeconds      / F -> inGameSecondsOf(player.records.thisX)
  Time.thisX.totalMinutes      / F -> inGameSecondsOf(player.records.thisX) / 60
"""
import re
import sys
from pathlib import Path

ROOT = Path(sys.argv[1])
FILES = [
    "src/core/secret-formula/achievements/normal-achievements.js",
    "src/core/secret-formula/eternity/time-studies/normal-time-studies.js",
    "src/core/secret-formula/reality/reality-upgrades.js",
]
UNIT = {"Milliseconds": None, "Seconds": "", "Minutes": " / 60"}
PAT = re.compile(r"Time\.this(Infinity|Eternity|Reality)\.total(Milliseconds|Seconds|Minutes)\s*/\s*getGlobalSpeedFactor\(\)")

total = 0
for rel in FILES:
    p = ROOT / rel
    src = p.read_text(encoding="utf-8")

    def repl(m):
        sec, unit = m.group(1), m.group(2)
        if UNIT[unit] is None:
            return f"inGameTimeOf(player.records.this{sec})"
        return f"inGameSecondsOf(player.records.this{sec}){UNIT[unit]}"

    out, n = PAT.subn(repl, src)
    assert n > 0, f"{rel}: 未匹配到任何站点"
    p.write_text(out, encoding="utf-8")
    total += n
    print(f"{rel}: {n} 处")

print("TOTAL", total)
assert total == 17, f"替换数不符：{total} != 17"
