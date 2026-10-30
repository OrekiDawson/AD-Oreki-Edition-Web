
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
