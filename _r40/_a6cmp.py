import json, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def load(fn):
    out=[]
    with open(fn, encoding='utf-8') as f:
        for i,line in enumerate(f,1):
            line=line.strip()
            if not line: continue
            try: out.append(json.loads(line))
            except: pass
    return out

FILES=[("708.1s r40s1-full","r40s1-full.jsonl"),
       ("783.1s r40a5-arm2","r40a5-arm2.jsonl"),
       ("721.5s r40s3-tut-light","r40s3-tutorial-light.jsonl"),
       ("915.8s r40a6-run1","r40a6-run1.jsonl")]

data={}
for tag,fn in FILES:
    try: data[tag]=load(fn)
    except Exception as e: print(f"{tag} 读取失败: {e}")

def first_at(rows, pred):
    for r in rows:
        try:
            if pred(r): return r
        except: pass
    return None

print("## 每跑基本信息")
for tag, rows in data.items():
    ts=[r['t'] for r in rows]
    print(f"{tag}: 行数={len(rows)} t={ts[0]}->{ts[-1]} 采样密度={len(rows)/(ts[-1]-ts[0]+0.001):.2f}条/s 字段数={len(rows[0])}")

print()
print("## 按现实数到达时刻（秒）")
Ns=[5,10,20,25,30,40,50,60,75,80,100,105]
hdr="| 现实 | " + " | ".join(t for t,_ in FILES) + " |"
print(hdr)
print("|" + "---|"*(len(FILES)+1))
for n in Ns:
    cells=[]
    for tag,_ in FILES:
        rows=data.get(tag) or []
        r=first_at(rows, lambda r,n=n: (r.get('realities') or 0)>=n)
        cells.append(f"{r['t']}" if r else "—")
    print(f"| {n} | " + " | ".join(cells) + " |")

print()
print("## 关键里程碑时刻（秒）")
def get(rows,key):
    r=first_at(rows, lambda r,k=key: r.get(k) is True)
    return r['t'] if r else None
def getf(rows, pred):
    r=first_at(rows,pred); return r['t'] if r else None

keys=[("brk","brk"),("doomed","doomed"),("gameEnd","gameEnd")]
for name,key in keys:
    cells=[]
    for tag,_ in FILES:
        rows=data.get(tag) or []
        v=get(rows,key); cells.append(str(v) if v is not None else "—")
    print(f"| {name} | " + " | ".join(cells) + " |")

print()
print("## interval(ivl) 首次到 100 / 首次 brk 前后")
for tag,_ in FILES:
    rows=data.get(tag) or []
    r=first_at(rows, lambda r: r.get('ivl')==100 or r.get('bcMaxInt') is True)
    if r: print(f"  {tag}: ivl=100 首次 t={r['t']} (ivl={r.get('ivl')}, bcMaxInt={r.get('bcMaxInt')})")
    else: print(f"  {tag}: 无 ivl/bcMaxInt 字段或未达")

print()
print("## 帧率代理 ticksPsL (log10 ticks/s) 统计")
for tag,_ in FILES:
    rows=data.get(tag) or []
    vals=[r['ticksPsL'] for r in rows if isinstance(r.get('ticksPsL'), (int,float))]
    if vals:
        vals.sort()
        print(f"  {tag}: n={len(vals)} 中位={vals[len(vals)//2]:.3f} 首={vals[0]:.3f} 末={vals[-1]:.3f}")
    else:
        print(f"  {tag}: 无该字段")
