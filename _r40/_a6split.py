import json, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def load(fn):
    out=[]
    with open(fn, encoding='utf-8') as f:
        for i, line in enumerate(f, 1):
            line=line.strip()
            if line: out.append((i, json.loads(line)))
    return out

def monotonic_info(rows, tag):
    ts=[r['t'] for _,r in rows]
    bad=[(rows[k][0], ts[k], ts[k+1]) for k in range(len(ts)-1) if ts[k+1] < ts[k]]
    print(f"[{tag}] 行数={len(rows)} 首t={ts[0]} 末t={ts[-1]} 逆序次数={len(bad)}")
    if bad: print(f"   前5处逆序(行号,t_i,t_i+1): {bad[:5]}")
    return len(bad)

print("### run1 单调性")
r1=load("r40a6-run1.jsonl")
monotonic_info(r1,"run1")

print()
print("### run2 拆分")
r2=load("r40a6-run2.jsonl")
odd=[x for x in r2 if x[0]%2==1]
even=[x for x in r2 if x[0]%2==0]
print(f"奇数行 {len(odd)} 条:"); monotonic_info(odd,"odd")
print(f"偶数行 {len(even)} 条:"); monotonic_info(even,"even")

print()
print("--- 奇数行(疑似本轮新档) 首3末3 ---")
for i,r in odd[:3]+odd[-3:]:
    print(f" 行{i} t={r['t']} gameEnd={r['gameEnd']} endState={r['endState']} realities={r['realities']} totAML=%.4g brk={r['brk']} doomed={r['doomed']} iu25={r['iu25']} laiTier={r['laiTier']} ecDone={r['ecDone']}")
print("--- 偶数行(疑似另一会话) 首3末3 ---")
for i,r in even[:3]+even[-3:]:
    print(f" 行{i} t={r['t']} gameEnd={r['gameEnd']} endState={r['endState']} realities={r['realities']} totAML=%.4g brk={r['brk']} doomed={r['doomed']} iu25={r['iu25']} laiTier={r['laiTier']} ecDone={r['ecDone']}")

print()
print("### run2 各会话里程碑")
for name, rows in [("odd", odd), ("even", even)]:
    print(f"--- {name} (末 t={rows[-1][1]['t']}) ---")
    for k in ["gameEnd","brk","doomed","dilUnl","Vunl","iu15","iu25","laiUnl","ds6"]:
        hit=[(i,r) for i,r in rows if r[k]]
        if hit:
            i,r=hit[0]
            print(f"   {k:9s} 首次 true 行{i} t={r['t']}   共{len(hit)}条")
        else:
            print(f"   {k:9s} 未出现")
    mx=0; mt=None
    for i,r in rows:
        if r['laiTier']>mx: mx=r['laiTier']; mt=r['t']
    print(f"   laiTier 峰值={mx} (t={mt})")
