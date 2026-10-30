# -*- coding: utf-8 -*-
"""保真度验证：对重放内容模拟原损坏链（路径替换 → CP936 误解码 → UTF-8 重写），
与实际损坏备份逐字节比对。完全一致 ⇒ 重放版与损坏前磁盘版完全一致。"""
import os, subprocess

INC = r"C:\Users\Oreki\WorkBuddy\AD-Oreki-Unified\web\_tools\_encoding-incident-20261027"
REP = os.path.join(INC, "replayed")
# 损坏备份文件名格式: <相对路径 __ 连接>
name_to_backup = {}
for fn in os.listdir(INC):
    if fn.endswith((".mjs", ".py")) and "__" in fn:
        base = fn.split("__")[-1]
        name_to_backup[base] = os.path.join(INC, fn)

ps_script = os.path.join(INC, "simulate_corrupt.ps1")
with open(ps_script, "w", encoding="utf-8-sig") as f:
    f.write(r"""
param([string]$InFile,[string]$OutFile)
$data=[System.IO.File]::ReadAllBytes($InFile)
$utf8=[System.Text.Encoding]::UTF8
$enc936=[System.Text.Encoding]::GetEncoding(936)
# 1) 先按 CP936 误读原始 UTF-8 字节（无效序列 → '?'）
$mis=$enc936.GetString($utf8.GetBytes($utf8.GetString($data)))
# 2) 再做路径替换（与当时一致）
$mis=$mis.Replace("2026-10-24-00-34-44\","AD-Oreki-Unified\web\")
$mis=$mis.Replace("2026-10-24-00-34-44","AD-Oreki-Unified/web")
$mis=$mis.Replace("2026-10-24-01-19-39\","AD-Oreki-Unified\android\")
$mis=$mis.Replace("2026-10-24-01-19-39","AD-Oreki-Unified/android")
# 3) 以 UTF-8(BOM) 写回
$utf8bom=New-Object System.Text.UTF8Encoding($true)
[System.IO.File]::WriteAllBytes($OutFile,$utf8bom.GetBytes($mis))
""")

results = {"match": [], "diff": [], "nobackup": []}
for fn in sorted(os.listdir(REP)):
    rep = os.path.join(REP, fn)
    bak = name_to_backup.get(fn)
    if not bak:
        results["nobackup"].append(fn); continue
    sim = os.path.join(INC, "_sim.bin")
    subprocess.run(["powershell","-NoProfile","-File",ps_script,"-InFile",rep,"-OutFile",sim],
                   capture_output=True)
    a = open(sim,"rb").read()
    b = open(bak,"rb").read()
    # 去掉备份中的 BOM 再比
    if b.startswith(b"\xef\xbb\xbf"): b = b[3:]
    if a.startswith(b"\xef\xbb\xbf"): a = a[3:]
    if a == b:
        results["match"].append(fn)
    else:
        # 找第一个差异位置
        i = next((i for i,(x,y) in enumerate(zip(a,b)) if x!=y), min(len(a),len(b)))
        results["diff"].append((fn, i, len(a), len(b)))

print(f"=== 完全一致（重放=损坏前磁盘版）: {len(results['match'])} ===")
for fn in results["match"]: print("  MATCH", fn)
print(f"=== 有差异: {len(results['diff'])} ===")
for fn,i,la,lb in results["diff"]: print(f"  DIFF  {fn}  首差异@{i}  模拟长={la} 备份长={lb}")
print(f"=== 无备份: {results['nobackup']} ===")
