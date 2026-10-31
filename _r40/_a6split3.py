import json, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

rows=[]
with open("r40a6-run2.jsonl", encoding='utf-8') as f:
    for i,line in enumerate(f,1):
        line=line.strip()
        if line: rows.append((i, json.loads(line)))

GAP=20.0
tracks=[]
for i,r in rows:
    t=r['t']
    cands=[k for k,tr in enumerate(tracks) if tr and t >= tr[-1][1]['t'] and t - tr[-1][1]['t'] <= GAP]
    if cands:
        k=min(cands, key=lambda k: t-tracks[k][-1][1]['t'])
    else:
        tracks.append([])
        k=len(tracks)-1
    tracks[k].append((i,r))

print(f"切出 {len(tracks)} 条轨（阈值 {GAP}s）")
for k,tr in enumerate(tracks):
    ts=[r['t'] for _,r in tr]
    inv=sum(1 for x in range(len(ts)-1) if ts[x+1]<ts[x])
    print(f"\n轨{k}: {len(tr)} 条  t {ts[0]} -> {ts[-1]}  逆序={inv}")
    for ii in range(min(3,len(tr))):
        i,r=tr[ii]
        print(f"  首{ii+1} 行{i} t={r['t']} gameEnd={r['gameEnd']} realities={r['realities']} brk={r['brk']} totAML={r['totAML']:.6g} pamL={r['pamL']} ds={r['ds']!r} ecDone={r['ecDone']}")
    for key in ["brk","doomed","dilUnl","Vunl","iu15","iu25","laiUnl","ds6","gameEnd"]:
        hit=[(i,r) for i,r in tr if r.get(key) is True]
        print(f"  {key:8s}: " + (f"首次 t={hit[0][1]['t']} (行{hit[0][0]}) 共{len(hit)}条" if hit else "未出现"))
    mx=max(r['laiTier'] for _,r in tr)
    mt=[r['t'] for _,r in tr if r['laiTier']==mx][0]
    print(f"  laiTier 峰值={mx} 首达 t={mt}")
    r=tr[-1][1]
    print(f"  末条 行{tr[-1][0]} t={r['t']} gameEnd={r['gameEnd']} endState={r['endState']} realities={r['realities']} brk={r['brk']} doomed={r['doomed']} ecDone={r['ecDone']} laiTier={r['laiTier']} eErr={r['eErr']!r}")
