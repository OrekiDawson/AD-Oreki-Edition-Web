# -*- coding: utf-8 -*-
"""R42：把 Break Infinity 的真实操作机制补进 ch05（唯一内容源 oreki-tutorial-data.json）。

只改 ch05 的 stageGoal / entry / steps / buyOrder / automation / challenges /
numbers / done / traps / subtitle。其它 17 章与 7 篇附录一个字节都不动。

每个数字都对应到已核实的源码行，见 CHECKS 注释。运行：
    python web/_tools/_r42/patch_ch05.py
"""
import io
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
JSON_PATH = os.path.join(ROOT, "AD-Oreki-Edition", "src", "core", "oreki-tutorial-data.json")


def load():
    with io.open(JSON_PATH, encoding="utf-8") as f:
        return json.load(f)


def main():
    data = load()
    ch = None
    for c in data["chapters"]:
        if c["id"] == "ch05":
            ch = c
            break
    if ch is None:
        print("FATAL: 找不到 ch05", file=sys.stderr)
        return 2

    old = json.dumps(ch, ensure_ascii=False, sort_keys=True)

    ch["subtitle"] = "150000 → 100 毫秒，32767 无限点数"

    ch["stageGoal"] = (
        "先把大坍缩自动器的间隔从 150000 毫秒降到 100 毫秒（15 级、累计 32767 无限点数），"
        "再让「打破无限」真的发生（player.break 变真）。成功后反物质可以超过 1.7976931348623157e308，"
        "12 个打破无限升级（9 个一次性 + 3 个可重复）会被逐条买走。"
    )

    ch["entry"] = (
        "你已经完成过第一次无限（无限次数 ≥ 1），并且不在任何挑战里。"
        "这时大坍缩自动器的间隔还没拉满——它就是本章第一件要解决的事："
        "breakInfinity() 第一行就是「间隔没拉满就直接 return」（src/game.js:95），所以是先有间隔、后有打破。"
        "间隔从 150000 毫秒起，每买一级 ×0.6、成本 ×2（src/core/autobuyers/autobuyer.js:169-177），"
        "第 15 级落到 100 毫秒，价格依次 1、2、4、…、16384，累计 32767 无限点数。"
    )

    ch["steps"] = [
        {
            "text": "打开底栏「自动化 / Automation」→ 自动购买器，确认页面顶部的自动购买器总开关是开着的。"
                    "本 MOD 的间隔自动购买和自动打破都受这个开关控制（player.auto.autobuyersOn）。",
            "auto": False,
        },
        {
            "text": "在同一个页面找到「大坍缩 / Big Crunch」那一格的按钮。"
                    "还显示「时间间隔减少 40%」加一行「价格：N 无限点数」= 还没拉满；这个按钮整块消失 = 已经到 100 毫秒。",
            "auto": False,
        },
        {
            "text": "把这个按钮点 15 次，价格每次翻倍（1 → 2 → 4 → … → 16384），总共花 32767 无限点数。"
                    "原版没有任何自动购买器会升这一项，只能手点；本 MOD 会在无限点数够的时候按同一价格连续替你买完，"
                    "你只要看这个按钮是不是已经消失。",
            "auto": True,
        },
        {
            "text": "间隔到 100 毫秒后，去底栏「无限 / Infinity」→「打破无限 / Break Infinity」页，点页面顶部的按钮。"
                    "本 MOD 在间隔拉满、总开关开着、且不在任何挑战里时会自动替你按一次（src/game.js:217-225）；"
                    "如果按钮文字还是没变，自己点一下。",
            "auto": False,
        },
        {
            "text": "判据一：顶部按钮文字变成「已打破无限」。注意它是开关（player.break = !player.break，src/game.js:102），"
                    "变成「已打破无限」之后就不要再点，再点会退回未打破。",
            "auto": False,
        },
        {
            "text": "判据二：顶部反物质能显示超过 1.80e308 的数（例如 1.90e308），不再被截断成「无限」。",
            "auto": False,
        },
        {
            "text": "打破的一瞬间，所有自动购买器的间隔会被免费拉满（src/game.js:97-99），"
                    "此后你不用再为任何购买器的间隔掏无限点数。",
            "auto": True,
        },
        {
            "text": "12 个打破无限升级由本 MOD 每帧自动买（src/core/oreki-autobuy-break-infinity.js:22-32）："
                    "价格从 1e4 到 1e15 无限点数，含 3 个可重复的"
                    "（计数频率成本增速 1e6 起 8 级、反物质维度成本增速 1e7 起 7 级、无限点数自动生成 1e7 起 10 级）。",
            "auto": True,
        },
    ]

    ch["buyOrder"] = [
        "最先买：大坍缩间隔升级 1 → 2 → 4 → … → 16384 无限点数，15 级共 32767。"
        "这是通往「打破无限」的唯一路径，优先级高于所有无限升级——钱先留给它。",
        "间隔没拉满之前，一条无限升级都不要买：多一次坍缩没意义，多一级间隔才是进度。",
        "1e4 无限点数｜基于产生的总反物质，给予反物质维度倍数加成（一次性）",
        "5e4 无限点数｜基于当前反物质，给予反物质维度倍数加成（一次性）",
        "5e11 无限点数｜星系增强 50%（一次性）",
        "1e5 无限点数｜基于无限次数，给予反物质维度倍数加成（一次性）",
        "1e6 无限点数｜基于已完成的成就数，给予反物质维度倍数加成（一次性）",
        "1e7 无限点数｜基于最慢的普通挑战时间，给予反物质维度倍数加成（一次性）",
        "2e7 无限点数｜被动生成无限次数（一次性）",
        "5e9 无限点数｜自动购买最大维度提升（一次性）",
        "1e15 无限点数｜自动购买器速度加倍（一次性）",
        "以上 12 条全部自动购买，顺序由「当前买得起哪一条」决定，不需要你排序。",
    ]

    ch["automation"] = (
        "整章不需要手动操作，前提是自动购买器总开关开着。间隔升级走的是真实购买路径、照价扣无限点数，"
        "余额够一级就买一级，15 级买完为止；把 12 个打破无限升级逐条买下的是自动购买模块。"
        "这两件事都受 player.auto.autobuyersOn 控制（默认开），并且在任何挑战里都不生效。"
        "另外 breakInfinity() 内部会先把所有自动购买器的间隔免费拉满再翻转 player.break"
        "（src/game.js:97-99），这是原版行为，不是本 MOD 加的。"
    )

    ch["challenges"] = (
        "「打破无限」本身不需要先完成任何挑战，但有两条与挑战相关的硬约束。"
        "① 任何挑战进行中 breakInfinity() 会直接返回（src/game.js:96），本 MOD 的闸门在挑战里同样不工作"
        "（普通挑战、无限挑战、永恒挑战都算，src/core/oreki-break-infinity-gate.js:67），所以要打破就先把挑战停掉。"
        "② 想自己手点间隔升级按钮的话，原版要求先完成普通挑战 12，否则那一行只显示「完成挑战以升级自动购买间隔」"
        "（src/core/autobuyers/big-crunch-autobuyer.js:30-32、src/components/tabs/autobuyers/AutobuyerIntervalButton.js:39-52）；"
        "本 MOD 的自动购买走的是照价扣无限点数的同一入口，不受这条界面门槛限制。"
    )

    numbers = [
        {"label": "大坍缩自动器初始间隔", "value": "150000 毫秒", "src": "src/core/player.js:81-83"},
        {"label": "每级间隔变化", "value": "×0.6，下限 100 毫秒", "src": "src/core/autobuyers/autobuyer.js:169-177"},
        {"label": "拉满需要的级数", "value": "15 级（150000×0.6^14 ≈ 117.5 仍未到 100，第 15 级落到 70.5 被下限截成 100）",
         "src": "src/core/oreki-break-infinity-gate.js:46-51"},
        {"label": "单级价格序列", "value": "1、2、4、…、16384 无限点数（每级 ×2）", "src": "src/core/autobuyers/autobuyer.js:172"},
        {"label": "拉满累计成本", "value": "32767 无限点数（= 2^15 − 1）", "src": "src/core/oreki-break-infinity-gate.js:51"},
        {"label": "间隔拉满的判据", "value": "大坍缩自动器 interval ≤ 100 毫秒", "src": "src/core/autobuyers/autobuyer.js:165-167"},
        {"label": "Break 前置条件", "value": "大坍缩自动器间隔 ≤ 100 毫秒", "src": "src/game.js:95"},
        {"label": "Break 时免费做的事", "value": "所有自动购买器间隔直接拉满", "src": "src/game.js:97-99"},
        {"label": "打破无限升级数量", "value": "12 个（9 个一次性 + 3 个可重复）",
         "src": "src/core/secret-formula/infinity/break-infinity-upgrades.js:29-146"},
        {"label": "最便宜的打破无限升级", "value": "1e4 无限点数（基于总反物质的维度加成）",
         "src": "src/core/secret-formula/infinity/break-infinity-upgrades.js:30-36"},
        {"label": "最贵的打破无限升级", "value": "1e15 无限点数（自动购买器速度加倍）",
         "src": "src/core/secret-formula/infinity/break-infinity-upgrades.js:98-102"},
        {"label": "实测：Break 发生的时刻", "value": "t = 5 秒（首次无限后 1 秒）",
         "src": "web/_tools/_r21-300.jsonl（milestone Break）"},
        {"label": "Break 后无限点数尺度", "value": "10^(log10(本纪最高反物质)/30 − 0.75) × 无限点数倍率",
         "src": "src/game.js:149-163"},
        {"label": "3 个可重复 Break 升级的等级与涨幅",
         "value": "计数频率成本增速 8 级（每级 ×5）/ 维度成本增速 7 级（每级 ×5e3）/ 无限点数自动生成 10 级（每级 ×10）",
         "src": "src/core/secret-formula/infinity/break-infinity-upgrades.js:104-136"},
    ]
    ch["numbers"] = numbers

    ch["done"] = (
        "「无限 / Infinity → 打破无限 / Break Infinity」的按钮显示「已打破无限」，反物质超过 1.80e308；"
        "同时大坍缩自动器那一行的间隔升级按钮已经消失（间隔 = 100 毫秒）。"
    )

    ch["traps"] = [
        "「打破无限」是开关不是一次性按钮：如果它已经是「已打破无限」，再点会退回未打破状态"
        "（player.break = !player.break，src/game.js:102）。本 MOD 的自动化带 !player.break 守卫，"
        "但你的手没有——看到已打破就别再点。",
        "自己手点间隔按钮点了没反应：原版要求先完成普通挑战 12，这个按钮才会出现"
        "（src/core/autobuyers/big-crunch-autobuyer.js:30-32）。本 MOD 的自动购买绕过了这条界面门槛，"
        "但你要是关掉了自动购买器总开关，就得先补普通挑战 12。",
        "把无限点数全花在无限升级上，间隔一级都买不起：间隔总共要 32767 无限点数，"
        "没拉满之前钱只留给它，别的一律不买。",
        "无限点数涨得太慢、半天买不起一级间隔：先买「无限 / Infinity」→「无限升级 / Infinity Upgrades」里"
        "那句「将所有来源的无限点乘以 ×2」的可重复升级。它按成本 ×2、效果 ×2 滚，"
        "是没打破之前唯一能把每次坍缩收益抬上去的通道。",
        "打破无限后反物质能超过 1e308，但单次坍缩收益仍然只有 10^(本纪最高反物质/30−0.75)×倍率；"
        "无限点数要涨数量级靠的是无限维度（第 6 章），不是多坍缩几次。",
        "12 个升级里最贵的是 1e15 无限点数那条，别盯着它看进度——它要到很后面才买得起，不影响主线。",
    ]

    ch["note"] = (
        "本章通常只持续几秒：间隔被自动买满 → 自动按 Break → 12 个升级被逐条买走。"
        "你真正要做的只是确认按钮文字变了。本章不刷无限挑战——无限挑战随打破无限一起在本章末尾才解锁，"
        "要等第 6 章逐个亮起再点；无限挑战 1~8 的解锁阈值与目标见第 6 章。"
    )

    new = json.dumps(ch, ensure_ascii=False, sort_keys=True)
    if old == new:
        print("NOOP: ch05 内容未变化")
        return 0

    data["updatedAt"] = "2026-10-31"

    text = json.dumps(data, ensure_ascii=False, indent=2)
    # 与仓库现状保持一致：UTF-8 无 BOM、LF、结尾一个换行
    with io.open(JSON_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(text + "\n")
    print("OK: 已写入", JSON_PATH)
    return 0


if __name__ == "__main__":
    sys.exit(main())
