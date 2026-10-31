import json, collections, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

FILES = {"run1": "r40a6-run1.jsonl", "run2": "r40a6-run2.jsonl"}
BOOLS = ["gameEnd","brk","doomed","dilUnl","Vunl","iu15","iu25","laiUnl","ds6","keepAuto","bcMaxInt","strikeInf"]

data = {}
for tag, fn in FILES.items():
    rows = []
    with open(fn, encoding='utf-8') as f:
        for i, line in enumerate(f, 1):
            line = line.strip()
            if not line: continue
            try:
                rows.append((i, json.loads(line)))
            except Exception as e:
                print(f"{tag} 第{i}行解析失败: {e}")
    data[tag] = rows
    print(f"[{tag}] 行数={len(rows)}  首 t={rows[0][1]['t']}  末 t={rows[-1][1]['t']}")
    print()

for tag, rows in data.items():
    print("="*70)
    print(f"### {tag}  ← {FILES[tag]}")
    print("="*70)

    # 采样间隔
    ts = [r['t'] for _, r in rows]
    dts = [round(ts[i+1]-ts[i], 2) for i in range(len(ts)-1)]
    c = collections.Counter(dts)
    print(f"[采样间隔] 最近间隔分布(前6): {c.most_common(6)}")
    print(f"[采样间隔] min={min(dts)} max={max(dts)} 中位={sorted(dts)[len(dts)//2]}")
    print(f"[t 范围] {ts[0]} -> {ts[-1]}  跨度={round(ts[-1]-ts[0],1)}")
    print()

    # 首 3 条零状态
    print("[首3条关键字段]")
    for i, r in rows[:3]:
        print(f"  行{i} t={r['t']} gameEnd={r['gameEnd']} endState={r['endState']} brk={r['brk']} realities={r['realities']} pamL={r['pamL']} totAML={r['totAML']} doomPhase={r['doomPhase']} realSec={r['realSec']}")
    print()

    # gameEnd 翻转
    print("[gameEnd 翻转]")
    flips = []
    prev = None
    for i, r in rows:
        if prev is None or r['gameEnd'] != prev:
            flips.append((i, r['t'], prev, r['gameEnd']))
        prev = r['gameEnd']
    for f in flips:
        print(f"  行{f[0]} t={f[1]}  {f[2]} -> {f[3]}")
    if not flips or all(f[3]==False for f in flips):
        print("  （从未为 true）")
    print()

    # gameEnd true 连续段
    ge = [(i, r) for i, r in rows if r['gameEnd']]
    if ge:
        first_i, first_r = ge[0]
        print(f"[首次通关] 行{first_i} t={first_r['t']}")
        for k in ["gameEnd","endState","pamL","totAML","brk","doomed","realities","crunches","factor","factorEff","dynOn","dynRamps","doomPhase","ecDone","Vunl","iu15","iu25","laiUnl","laiTier","ds","ds6","imL","imCapL","amL","realSec"]:
            print(f"    {k} = {first_r.get(k)}")
        # 连续性检查
        idxs = [i for i, _ in ge]
        print(f"  为 true 的采样数 = {len(ge)} / 总行数 {len(rows)}")
        print(f"  首行号={idxs[0]} 末行号={idxs[-1]}  是否连续 = {idxs == list(range(idxs[0], idxs[-1]+1))}")
        print(f"  之后是否出现过 false = {any(not r['gameEnd'] for _, r in rows if _ > first_i)}")
        # 翻转后末条
        last_r = ge[-1][1]
        print(f"[通关后末条] 行{ge[-1][0]} t={last_r['t']} endState={last_r['endState']} pamL={last_r['pamL']} realities={last_r['realities']} totalT_after={round(last_r['t']-first_r['t'],1)}")
        # endState 增长轨迹
        print("[通关后 endState 轨迹]")
        step = max(1, len(ge)//10)
        for i, r in ge[::step]:
            print(f"    t={r['t']} endState={r['endState']} pamL={r['pamL']}")
        print(f"    t={ge[-1][1]['t']} endState={ge[-1][1]['endState']} pamL={ge[-1][1]['pamL']} (末)")
    else:
        print("[通关] 从未 gameEnd:true")
    print()

    # brk 翻转
    print("[brk 翻转 / 首次为 true]")
    prev = None
    for i, r in rows:
        if prev is None or r['brk'] != prev:
            print(f"  行{i} t={r['t']}  {prev} -> {r['brk']}   (realities={r['realities']}, totAML={r['totAML']})")
        prev = r['brk']
    print()

    # 里程碑首次为真
    print("[里程碑首次为真]")
    for k in ["brk","doomed","dilUnl","Vunl","iu15","iu25","laiUnl","ds6"]:
        hit = [(i, r[k]) for i, r in rows if r[k]]
        if hit:
            i, r = rows[hit[0][0]-1]
            print(f"  {k:10s} 首次 true: 行{i} t={r['t']}")
        else:
            print(f"  {k:10s} 未到达")
    # laiTier 阶梯
    print("[laiTier 阶梯]")
    prev = None
    for i, r in rows:
        if r['laiTier'] != prev:
            print(f"  行{i} t={r['t']}  laiTier {prev} -> {r['laiTier']}")
            prev = r['laiTier']
    # ds (dimension string) 变化
    print("[ds 变化]")
    prev = None
    for i, r in rows:
        if r['ds'] != prev:
            print(f"  行{i} t={r['t']}  ds={r['ds']!r}")
            prev = r['ds']
    print()

    # 倍率
    print("[倍率]")
    for k in ["factor","factorEff","dynOn","dynRamps"]:
        vals = [r[k] for _, r in rows]
        print(f"  {k}: unique={sorted(set(vals))[:8]}{'...' if len(set(vals))>8 else ''}  n_unique={len(set(vals))}")
    print()

    # 末条
    last = rows[-1][1]
    print(f"[末条] 行{rows[-1][0]} t={last['t']} gameEnd={last['gameEnd']} endState={last['endState']} pamL={last['pamL']} brk={last['brk']} doomed={last['doomed']} realities={last['realities']} ecDone={last['ecDone']} iu25={last['iu25']} laiTier={last['laiTier']} eErr={last['eErr']!r}")
    print()
