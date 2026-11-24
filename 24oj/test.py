from __future__ import annotations

import argparse
import os
import json
import re
import sys
import time
from fractions import Fraction
from itertools import permutations, product
from multiprocessing import Pool

# ---------------------------------------------------------------- 模板与运算符
# 11 种括号模板（与 base24.py 一致）；{0}..{3} 为数字位，{op0}..{op2} 为运算符位
_TEMPLATES = [
    "(({0}{op0}{1}){op1}{2}){op2}{3}",
    "({0}{op0}{1}){op1}({2}{op2}{3})",
    "({0}{op0}({1}{op1}{2})){op2}{3}",
    "{0}{op0}(({1}{op1}{2}){op2}{3})",
    "{0}{op0}({1}{op1}({2}{op2}{3}))",
    "({0}{op0}{1}{op1}{2}){op2}{3}",
    "({0}{op0}{1}){op1}{2}{op2}{3}",
    "{0}{op0}({1}{op1}{2}{op2}{3})",
    "{0}{op0}({1}{op1}{2}){op2}{3}",
    "({0}{op0}{1}{op1}{2}{op2}{3})",
    "{0}{op0}{1}{op1}{2}{op2}{3}",
]

_OPS = ["+", "-", "*", "/"]

# 浮点粗筛阈值：3 层运算的分母上界很小，真值 != 24 的式子与 24 至少差 1e-9 量级，
# 远大于 double 的 ~1e-15 舍入误差，故 1e-6 既不漏判也不误判。
_FLOAT_TOL = 1e-6

# 变量名用 A/B/C/D，避免字符串 replace 把 "10" 拆成 "1""0"
_VAR_NAMES = ("A", "B", "C", "D")

_TOKEN_RE = re.compile(r"\{([0-3])\}|\{op([0-2])\}")


def _split_template(tmpl: str):
    """把模板切成 token 序列：('lit', 文本) / ('num', 下标) / ('op', 下标)。"""
    segs, pos = [], 0
    for m in _TOKEN_RE.finditer(tmpl):
        if m.start() > pos:
            segs.append(("lit", tmpl[pos:m.start()]))
        if m.group(1) is not None:
            segs.append(("num", int(m.group(1))))
        else:
            segs.append(("op", int(m.group(2))))
        pos = m.end()
    if pos < len(tmpl):
        segs.append(("lit", tmpl[pos:]))
    return segs


def _build_programs():
    """预编译全部 (模板, 运算符三元组) -> (code_object, fmt_string)。

    fmt_string 是只留数字位的 format 模板，如 "(({}+{})*{})-{}"，
    命中 24 时才调用 .format()，避免为 99.6% 的废式子拼串。
    """
    programs = []
    for tmpl in _TEMPLATES:
        segs = _split_template(tmpl)
        for ops_idx in product(range(4), repeat=3):
            ops = [_OPS[i] for i in ops_idx]
            fmt, expr = [], []
            for kind, val in segs:
                if kind == "lit":
                    fmt.append(val); expr.append(val)
                elif kind == "op":
                    o = ops[val]
                    fmt.append(o); expr.append(o)
                else:  # num
                    fmt.append("{}")
                    expr.append(_VAR_NAMES[val])
            fmt_str = "".join(fmt)
            try:
                obj = compile("".join(expr), "<24>", "eval")
            except SyntaxError:      # 理论上不会发生，兜底
                obj = None
            programs.append((obj, fmt_str))
    return programs


_PROGRAMS = None          # 进程内惰性初始化


def _programs():
    global _PROGRAMS
    if _PROGRAMS is None:
        _PROGRAMS = _build_programs()
    return _PROGRAMS


def solve_group(nums):
    """返回该组（nums 为 4 元组，顺序任意）的全部 24 点表达式，已排序去重。"""
    found = set()
    programs = _programs()
    for perm in set(permutations(nums)):
        fenv = dict(zip(_VAR_NAMES, (float(x) for x in perm)))
        for obj, fmt in programs:
            if obj is None:
                continue
            try:
                v = eval(obj, {"__builtins__": {}}, fenv)   # noqa: S307
            except ZeroDivisionError:
                continue
            except Exception:
                continue
            if not isinstance(v, (int, float)) or abs(v - 24.0) > _FLOAT_TOL:
                continue
            # 浮点过筛 -> Fraction 精确复算
            senv = dict(zip(_VAR_NAMES, (Fraction(x) for x in perm)))
            try:
                exact = eval(obj, {"__builtins__": {}}, senv)   # noqa: S307
            except ZeroDivisionError:
                continue
            except Exception:
                continue
            if exact == 24:
                found.add(fmt.format(*perm))
    return sorted(found)


def _worker(nums_list):
    return [(t, solve_group(t)) for t in nums_list]


def enumerate_groups(n):
    """全部组合，按 a>=b>=c>=d 归一化；顺序与 24点_每组解列表 一致。"""
    groups = []
    for a in range(1, n + 1):
        for b in range(1, a + 1):
            for c in range(1, b + 1):
                for d in range(1, c + 1):
                    groups.append((a, b, c, d))
    return groups


# ---------------------------------------------------------------- 朴素实现（自检用）
def _naive_safe_eval(expr):
    """逐字符调度场 + Fraction，任何异常/除零返回 None。"""
    try:
        nums, ops = [], []
        prec = {"+": 1, "-": 1, "*": 2, "/": 2}

        def apply():
            b, a = nums.pop(), nums.pop()
            op = ops.pop()
            if op == "+": nums.append(a + b)
            elif op == "-": nums.append(a - b)
            elif op == "*": nums.append(a * b)
            elif op == "/":
                if b.numerator == 0:
                    raise ZeroDivisionError
                nums.append(a / b)

        i = 0
        while i < len(expr):
            ch = expr[i]
            if ch.isdigit():
                j = i
                while j < len(expr) and expr[j].isdigit():
                    j += 1
                nums.append(Fraction(int(expr[i:j])))
                i = j
                continue
            if ch == "(":
                ops.append(ch)
            elif ch == ")":
                while ops and ops[-1] != "(":
                    apply()
                ops.pop()
            elif ch in prec:
                while ops and ops[-1] != "(" and prec.get(ops[-1], 0) >= prec[ch]:
                    apply()
                ops.append(ch)
            i += 1
        while ops:
            apply()
        return nums[0] if len(nums) == 1 else None
    except Exception:
        return None


def solve_group_naive(nums):
    found = set()
    for perm in set(permutations(nums)):
        a, b, c, d = perm
        for ops_idx in product(range(4), repeat=3):
            op0, op1, op2 = (_OPS[i] for i in ops_idx)
            for tmpl in _TEMPLATES:
                exp = tmpl.format(a, b, c, d, op0=op0, op1=op1, op2=op2)
                if _naive_safe_eval(exp) == 24:
                    found.add(exp)
    return sorted(found)


def selftest(n=7):
    """与朴素实现逐组交叉比对。"""
    groups = enumerate_groups(n)
    bad = 0
    t0 = time.time()
    for g in groups:
        fast, slow = solve_group(g), solve_group_naive(g)
        if fast != slow:
            bad += 1
            if bad <= 3:
                print("  MISMATCH %s: fast=%d slow=%d" % (g, len(fast), len(slow)))
    total = sum(len(solve_group(g)) for g in groups)
    print("selftest N=%d: %d 组，%d 处不一致，解总数 %d，耗时 %.1fs"
          % (n, len(groups), bad, total, time.time() - t0))
    return bad == 0


# ---------------------------------------------------------------- 主流程
def build_data(n, workers=1, progress=False):
    groups = enumerate_groups(n)
    results = {}
    t0 = time.time()
    if workers and workers > 1:
        chunk = max(1, len(groups) // (workers * 4))
        tasks = [groups[i:i + chunk] for i in range(0, len(groups), chunk)]
        with Pool(workers) as pool:
            for part in pool.imap_unordered(_worker, tasks):
                for k, v in part:
                    results[k] = v
                if progress:
                    print("  ... %d/%d 组 (%.1fs)" % (len(results), len(groups), time.time() - t0),
                          file=sys.stderr)
    else:
        for idx, g in enumerate(groups, 1):
            results[g] = solve_group(g)
            if progress and idx % 200 == 0:
                print("  ... %d/%d 组 (%.1fs)" % (idx, len(groups), time.time() - t0),
                      file=sys.stderr)

    data = {}
    for g in groups:                      # 保持枚举顺序，输出可复现
        sols = results[g]
        data["%d,%d,%d,%d" % g] = {"cnt": len(sols), "content": sols}
    return data, time.time() - t0


def verify(data):
    keys = list(data.keys())
    cnt_sum = sum(v["cnt"] for v in data.values())
    assert all(v["cnt"] == len(v["content"]) for v in data.values()), "cnt != len(content)"
    assert len(set(keys)) == len(keys), "键重复"
    solvable = sum(1 for v in data.values() if v["cnt"])
    top = max(data.items(), key=lambda kv: kv[1]["cnt"])
    return {
        "keys": len(keys),
        "solvable": solvable,
        "unsolvable": len(keys) - solvable,
        "total_solutions": cnt_sum,
        "max_key": top[0],
        "max_cnt": top[1]["cnt"],
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description="24 点全解字典生成器（JSON 输出）")
    ap.add_argument("n", nargs="?", type=int, default=13, help="牌面最大值，默认 13")
    ap.add_argument("out", nargs="?", default="data_24.json", help="输出 JSON 路径")
    ap.add_argument("-w", "--workers", type=int, default=1, help="并行进程数，默认 1")
    ap.add_argument("--compact", action="store_true", help="无缩进紧凑输出")
    ap.add_argument("--selftest", action="store_true", help="与朴素实现交叉验证")
    ap.add_argument("--progress", action="store_true", help="打印进度")
    args = ap.parse_args(argv)

    if args.selftest:
        sys.exit(0 if selftest(7) else 1)

    data, elapsed = build_data(args.n, args.workers, args.progress)
    indent = None if args.compact else 2
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)
        f.write("\n")

    st = verify(data)
    print("N=%d  键 %d 个 / 有解 %d / 无解 %d / 解总数 %d / 单组最大 %s=%d  耗时 %.1fs"
          % (args.n, st["keys"], st["solvable"], st["unsolvable"],
             st["total_solutions"], st["max_key"], st["max_cnt"], elapsed))
    print("已写入 %s（%.1f KB）" % (args.out, os.path.getsize(args.out) / 1024))


if __name__ == "__main__":
    main()