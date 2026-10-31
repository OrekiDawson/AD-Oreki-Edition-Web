import json, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

rows=[]
with open("r40a6-run2.jsonl", encoding='utf-8') as f:
    for i, line in enumerate(f,1):
        line=line.strip()
        if line: rows.append((i, json.loads(line)))

# 贪心双轨重建：每行分配给"末 t 小于它且最接近"的那条轨
tracks=[[],[]]
last=[-1e9,-1e9]
for i,r in rows:
    t=r['t']
    cands=[k for k in range(2) if last[k] <= t+0.01]
    if not cands:
        # 两条轨都超过它 -> 归给末t较大的（说明是更晚的乱序）
        k=0 if last[0]>last[1] else 1
    else:
        k=min(cands, key=lambda k: t-last[k])
    tracks[k].append((i,r)); last[k]=t

for k,tr in enumerate(tracks):
    ts=[r['t'] for _,r in tr]
    inv=sum(1 for x in range(len(ts)-1) if ts[x+1]<ts[x])
    print("="*72)
    print(f"轨{k}: {len(tr)} 条  t {ts[0]} -> {ts[-1]}  逆序={inv}  首行号={tr[0][0]} 末行号={tr[-1][0]}")
    print("="*72)
    for ii in range(min(3,len(tr))):
        i, r = tr[ii]
        print(f" 首{ii+1} 行{i} t={r['t']} realSec={r['realSec']} gameEnd={r['gameEnd']} realities={r['realities']} totAML={r['totAML']:.6g} brk={r['brk']} dilUnl={r['dilUnl']} ds={r['ds']!r} crunch={r['crunches']}")
    print(" [里程碑]")
    for key in ["gameEnd","brk","doomed","dilUnl","Vunl","iu15","iu25","laiUnl","ds6"]:
        hit=[(i,r) for i,r in tr if r[key]]
        if hit:
            i,r=hit[0]; print(f"   {key:9s} 首次 true 行{i} t={r['t']}  共{len(hit)}条")
        else:
            print(f"   {key:9s} 未出现")
    mx=max(r['laiTier'] for _,r in tr); mt=[r['t'] for _,r in tr if r['laiTier']==mx][0]
    print(f"   laiTier 峰值={mx} 首达 t={mt}")
    last_r=tr[-1][1]
    print(f" [末条] 行{tr[-1][0]} t={last_r['t']} realSec={last_r['realSec']} gameEnd={last_r['gameEnd']} endState={last_r['endState']} realities={last_r['realities']} pamL={last_r['pamL']} brk={last_r['brk']} doomed={last_r['doomed']} ecDone={last_r['ecDone']} iu25={last_r['iu25']} laiTier={last_r['laiTier']} doomPhase={last_r['doomPhase']} eErr={last_r['eErr']!r}")
    print()
