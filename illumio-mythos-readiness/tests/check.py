#!/usr/bin/env python3
"""Assert what tests/expectations.md states about the runs in tests/out/<name>/.
Run tests/run_all.sh (which calls this last). Exit 1 when any check fails."""
from __future__ import annotations

import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
SKILL = HERE.parent
OUT = HERE / "out"
GATES = ["labelled", "managed", "policy_written", "enforcing", "fenced_if_selective", "no_unknown_admin", "no_cross_env_admin",
         "full_enforcement", "no_unmanaged_inbound", "not_a_bridge", "no_wide_reach_account"]
LEVEL_GATES = {1: ["labelled", "managed"], 2: ["policy_written"], 3: ["enforcing", "fenced_if_selective"],
               4: ["no_unknown_admin", "no_cross_env_admin"], 5: ["full_enforcement", "no_unmanaged_inbound", "not_a_bridge", "no_wide_reach_account"]}
KINDS = {"label", "pair_ven", "write_policy", "move_enforcement", "provision_deny", "block_unknown", "deny_crossing",
         "narrow_inbound", "ringfence", "review_account", "check_reach"}
KIND_OF = {"labelled": {"label"}, "managed": {"pair_ven"}, "policy_written": {"write_policy"}, "enforcing": {"move_enforcement"},
           "fenced_if_selective": {"provision_deny"}, "no_unknown_admin": {"block_unknown"}, "no_cross_env_admin": {"deny_crossing"},
           "full_enforcement": {"move_enforcement"}, "no_unmanaged_inbound": {"narrow_inbound"}, "not_a_bridge": {"ringfence", "check_reach"},
           "no_wide_reach_account": {"review_account"}}
BUCKETS = {"today", "week", "plan"}
MARK_START, MARK_END = "// ===== DATA START =====", "// ===== DATA END ====="
SCORE_WORDS = re.compile(r"\b(score|blast radius|ease)\b", re.I)
EXPECTED = {
    "mixed": {"pay (prod)": 4, "shop (prod)": 3, "billing (prod)": 3, "crm (prod)": 2, "erp (prod)": 4, "hr (staging)": 2,
              "wiki (staging)": 1, "ci (dev)": 1, "legacy (dev)": 0, "logs (mgmt)": 5, "dns (mgmt)": 4, "unlabelled": 0},
    "contained": {"web (prod)": 5, "api (prod)": 5, "db (prod)": 5, "batch (prod)": 5, "mon (mgmt)": 5},
    "unlabelled": {"unlabelled": 0},
}
EXPECTED_ESTATE = {"mixed": 2, "contained": 5, "unlabelled": 0, "mixed-nolateral": 2}
EXPECTED_ENVS = {"mixed": {"prod": 2, "staging": 1, "dev": 0, "mgmt": 4}, "contained": {"prod": 5, "mgmt": 5}, "unlabelled": {},
                 "mixed-nolateral": {"prod": 2, "staging": 1, "dev": 0, "mgmt": 4}}
failures = []


def check(cond: bool, msg: str) -> None:
    if not cond:
        failures.append(msg)
        print(f"FAIL {msg}")


def grade(gates: dict) -> int:
    level = 0
    for L in range(1, 6):
        if all(gates[g]["state"] == "pass" for g in LEVEL_GATES[L]):
            level = L
        else:
            break
    return level


def level_of(rows: list[dict], threshold: float) -> int:
    labelled = [r for r in rows if r["env"] is not None]
    den = sum(r["managed"] for r in labelled)
    level = 0
    for L in range(1, 6):
        if den and sum(r["managed"] for r in labelled if r["level"] >= L) / den >= threshold:
            level = L
        else:
            break
    return level


def common(name: str) -> dict:
    d = OUT / name
    r = json.loads((d / "readiness.json").read_text())
    plan = json.loads((d / "rrr" / "plan.json").read_text())
    for key in ("generated", "date", "rrr", "inputs", "ladder", "gate_text", "estate", "envs", "apps", "evidence", "notes"):
        check(key in r, f"{name}: readiness.json lacks {key}")
    check(r["date"] == "2026-11-06" and r["generated"] == "2026-11-06T00:00:00Z", f"{name}: --date not honoured")
    check([l["level"] for l in r["ladder"]] == list(range(6)) and r["ladder"][5]["name"] == "Contained", f"{name}: ladder shape")
    check([l["human_dependent"] for l in r["ladder"]] == [True, True, True, False, False, False], f"{name}: human_dependent flags")
    check(set(r["gate_text"]) == set(GATES), f"{name}: gate_text keys")
    titles = {l["title"] for l in plan["lines"]}
    fors = {c["for"] for c in plan.get("call_plans") or []}

    # evidence is plan.risk_map's named keys, unchanged
    rm = plan["risk_map"]
    check(r["evidence"] == {k: rm.get(k) for k in ("readiness", "headline", "apps", "env_matrix", "rule_drift", "fix_first", "takeaway")},
          f"{name}: evidence differs from plan.risk_map")
    check(sorted(r["rrr"]["crown_jewels"]) == sorted(f"{a} ({e})" for a, e in plan["crown_jewels"]), f"{name}: crown jewels differ from the plan")

    # rows: every gate on every row, level from the gates, next steps = the non-passing gates of level + 1
    seen_crown_gap = False
    for i, row in enumerate(r["apps"]):
        key = row["key"]
        check(set(row["gates"]) == set(GATES), f"{name}: {key} lacks a gate")
        check(all(g["state"] in ("pass", "fail", "unknown") for g in row["gates"].values()), f"{name}: {key} bad gate state")
        check(all(g["reason"] for g in row["gates"].values() if g["state"] != "pass"), f"{name}: {key} non-passing gate without reason")
        check(row["level"] == grade(row["gates"]), f"{name}: {key} level {row['level']} != gates")
        check(row["level_name"] == r["ladder"][row["level"]]["name"], f"{name}: {key} level_name")
        check(row["next_level"] == (row["level"] + 1 if row["level"] < 5 else None), f"{name}: {key} next_level")
        check(sum(row["enforcement"].values()) == row["workloads"], f"{name}: {key} enforcement counts != workloads")
        want = {g for g in LEVEL_GATES.get(row["level"] + 1, []) if row["gates"][g]["state"] != "pass"}
        if key == "unlabelled":
            want = {"labelled"}   # its other gates are not graded and produce no step
        got = {s["gate"] for s in row["next_steps"]}
        check(got == want, f"{name}: {key} next steps cover {sorted(got)}, expected {sorted(want)}")
        for s in row["next_steps"]:
            check(s["kind"] in KINDS and s["kind"] in KIND_OF[s["gate"]], f"{name}: {key} step kind {s['kind']} for {s['gate']}")
            check(s["bucket"] in BUCKETS, f"{name}: {key} step bucket {s['bucket']}")
            check(not SCORE_WORDS.search(s["sentence"]) and "score" not in s, f"{name}: {key} step carries a score: {s['sentence']}")
            check(s["sentence"] and key in s["sentence"] or key == "unlabelled", f"{name}: {key} step sentence does not name the app")
            if s["call_plan"]:
                check(s["call_plan"].startswith("call-plans.md: ") and s["call_plan"][len("call-plans.md: "):] in fors and s["rrr_lines"][0] in titles,
                      f"{name}: {key} call_plan {s['call_plan']} is not a call-plans.md heading, or its line title is not in plan.json")
                check(s["bucket"] in ("today", "week"), f"{name}: {key} call-plan step with bucket {s['bucket']}")
            else:
                check(s["bucket"] == "plan" or not s["rrr_lines"], f"{name}: {key} step without call plan but with bucket {s['bucket']}")
        if row["crown_jewel"]:
            check(not seen_crown_gap, f"{name}: crown jewel {key} sorted after a non-crown row")
        else:
            seen_crown_gap = True
        for s in row["next_steps"]:
            if s["kind"] in ("narrow_inbound", "review_account") and s["rrr_lines"]:
                check(s["bucket"] == "plan" and s["call_plan"] is None and all(t.startswith(("X3 ", "X6 ")) for t in s["rrr_lines"]),
                      f"{name}: {key} watch-backed step must have bucket plan, watch titles and no call plan")
        if key == "unlabelled":
            check(row["env"] is None and row["level"] == 0 and row["gates"]["labelled"]["state"] == "fail", f"{name}: unlabelled row shape")
            check(row["measures"] is None and row["risk_rank_score"] is None, f"{name}: unlabelled row must carry null measures and score")
            check(all(row["gates"][g] == {"state": "unknown", "reason": "not graded: unlabelled"} for g in GATES if g != "labelled"),
                  f"{name}: unlabelled row gates must be unknown, not graded")
            check(len(row["next_steps"]) == 1 and row["next_steps"][0]["kind"] == "label" and "illumio-label-advisor" in row["next_steps"][0]["sentence"],
                  f"{name}: unlabelled row next step")
        else:
            check(isinstance(row["measures"], dict) and len(row["measures"]) == 6 and isinstance(row["risk_rank_score"], int), f"{name}: {key} measures shape")
    # apps sort: crown first, then level ascending, then workloads descending
    keyed = [(not a["crown_jewel"], a["level"], -a["workloads"]) for a in r["apps"]]
    check(keyed == sorted(keyed), f"{name}: apps not sorted crown, level, workloads")

    # the 80 percent rule on the estate and per env; shares and distribution add up
    e = r["estate"]
    check(e["threshold"] == 0.8, f"{name}: threshold")
    check(e["level"] == level_of(r["apps"], e["threshold"]), f"{name}: estate level {e['level']} breaks the 80% rule")
    check(e["workloads"] == sum(a["workloads"] for a in r["apps"]), f"{name}: estate workloads")
    check(sum(v["workloads"] for v in e["distribution"].values()) == e["workloads"] and sum(v["apps"] for v in e["distribution"].values()) == len(r["apps"]),
          f"{name}: distribution does not add up")
    check(e["in_force_share"] == round(sum(a["workloads"] for a in r["apps"] if a["level"] >= 3) / e["workloads"], 2), f"{name}: in_force_share")
    check(e["contained_share"] == round(sum(a["workloads"] for a in r["apps"] if a["level"] >= 5) / e["workloads"], 2), f"{name}: contained_share")
    check(e["next_level"] == (e["level"] + 1 if e["level"] < 5 else None), f"{name}: estate next_level")
    if e["next_level"] is not None:
        below = {a["key"] for a in r["apps"] if a["level"] < e["next_level"]}
        check({(t["app"], t["env"]) for t in e["to_next"]} == {(a["app"], a["env"]) for a in r["apps"] if a["key"] in below}, f"{name}: to_next members")
        sizes = [t["workloads"] for t in e["to_next"]]
        check(sizes == sorted(sizes, reverse=True), f"{name}: to_next not ordered by workloads descending")
        check(all(t["first_step"] for t in e["to_next"]), f"{name}: to_next without a first step")
    else:
        check(e["to_next"] == [], f"{name}: to_next must be empty at level 5")
    for env in r["envs"]:
        rows = [a for a in r["apps"] if a["env"] == env["env"]]
        check(env["level"] == level_of(rows, e["threshold"]), f"{name}: env {env['env']} level breaks the 80% rule")
        check(env["workloads"] == sum(a["workloads"] for a in rows), f"{name}: env {env['env']} workloads")
    check({x["env"] for x in r["envs"]} == {a["env"] for a in r["apps"] if a["env"] is not None}, f"{name}: envs do not match the app rows")
    check(e["level"] == EXPECTED_ESTATE[name], f"{name}: estate level {e['level']}, expected {EXPECTED_ESTATE[name]}")
    check({x["env"]: x["level"] for x in r["envs"]} == EXPECTED_ENVS[name], f"{name}: env levels {[(x['env'], x['level']) for x in r['envs']]}")

    # readiness.md: the sections in order, no score in the main body, no em dash
    md = (d / "readiness.md").read_text()
    heads = ["# Mythos readiness, 2026-11-06", "## 1. The question and the answer", "## 2. The ladder", "## 3. Estate and environments",
             "## 4. Apps", "## 5. What to do next", "## Appendix A. The risk map", "## Appendix B. Method and semantics", "## Appendix C. Call plans"]
    pos = [md.find(h) for h in heads]
    check(all(p >= 0 for p in pos) and pos == sorted(pos), f"{name}: readiness.md sections missing or out of order")
    body = md[:md.find("## Appendix A")]
    check(not SCORE_WORDS.search(body), f"{name}: a score word in the main body of readiness.md")
    check("Nothing in this report writes to the PCE." in md, f"{name}: readiness.md lacks the no-write line")
    check("Levels 0 to 2 depend on a human noticing" in md, f"{name}: readiness.md lacks the human-dependence sentence")
    check("call-plans.md" in md.split("## Appendix C")[1], f"{name}: appendix C lacks the call-plans pointer")

    # dashboard: written from references/dashboard-example.jsx, markers once each, DATA equals readiness.json
    dash_path = d / "dashboard.jsx"
    check(dash_path.exists(), f"{name}: dashboard.jsx not written (template {SKILL / 'references' / 'dashboard-example.jsx'} missing?)")
    if dash_path.exists():
        dash = dash_path.read_text().split("\n")
        starts = [i for i, l in enumerate(dash) if l.strip() == MARK_START]
        ends = [i for i, l in enumerate(dash) if l.strip() == MARK_END]
        check(len(starts) == 1 and len(ends) == 1 and ends[0] > starts[0], f"{name}: dashboard markers not exactly once each")
        check(sum(1 for l in dash if l.startswith("const DATA =")) == 1, f"{name}: dashboard declares DATA more than once")
        if starts and ends:
            block = "\n".join(dash[starts[0] + 1:ends[0]]).strip()
            check(block.startswith("const DATA = ") and block.endswith(";"), f"{name}: DATA block shape")
            try:
                check(json.loads(block[len("const DATA = "):-1]) == r, f"{name}: dashboard DATA != readiness.json")
            except json.JSONDecodeError:
                check(False, f"{name}: dashboard DATA is not JSON")
    return r


def levels(r: dict) -> dict:
    return {a["key"]: a["level"] for a in r["apps"]}


def row(r: dict, key: str) -> dict:
    return next(a for a in r["apps"] if a["key"] == key)


def failing(a: dict) -> set:
    return {g for g, v in a["gates"].items() if v["state"] == "fail"}


def main() -> int:
    # mixed: every level planted
    r = common("mixed")
    check(levels(r) == EXPECTED["mixed"], f"mixed: levels {levels(r)}")
    check(r["rrr"]["crown_jewels"] == ["pay (prod)"] and r["apps"][0]["key"] == "pay (prod)" and r["apps"][0]["crown_jewel"], "mixed: pay (prod) is the crown jewel and first")
    check(failing(row(r, "pay (prod)")) == {"not_a_bridge"}, "mixed: pay (prod) must fail not_a_bridge only")
    check(row(r, "pay (prod)")["next_steps"][0]["kind"] == "ringfence" and row(r, "pay (prod)")["next_steps"][0]["call_plan"], "mixed: pay (prod) ringfence step with call plan")
    check(failing(row(r, "hr (staging)")) == {"fenced_if_selective", "full_enforcement"}, "mixed: hr (staging) must fail fenced_if_selective (and so full_enforcement) only")
    check(row(r, "hr (staging)")["next_steps"][0]["kind"] == "provision_deny", "mixed: hr (staging) step is provision_deny")
    shop = row(r, "shop (prod)")
    check("no_unknown_admin" in failing(shop) and "10.9.9.9" in shop["gates"]["no_unknown_admin"]["reason"], "mixed: shop (prod) fails no_unknown_admin on 10.9.9.9")
    check([s["kind"] for s in shop["next_steps"]] == ["block_unknown"] and "identify" in shop["next_steps"][0]["sentence"], "mixed: shop (prod) internal source says identify first")
    check("per source" in r["notes"][0] or "per source" in " ".join(r["notes"]), "mixed: X1 per-source caveat note")
    check(row(r, "pay (prod)")["gates"]["no_unknown_admin"]["state"] == "pass", "mixed: a public source with 0 allowed connections must not fail pay (prod)")
    bill = row(r, "billing (prod)")
    check(failing(bill) == {"no_cross_env_admin"} and bill["next_steps"][0]["kind"] == "deny_crossing" and bill["next_steps"][0]["bucket"] == "today",
          "mixed: billing (prod) fails the dev-to-prod crossing with a today deny step")
    check(row(r, "crm (prod)")["gates"]["no_cross_env_admin"]["state"] == "pass", "mixed: a potentially blocked crossing must not fail crm (prod)")
    check(row(r, "crm (prod)")["next_steps"][0]["kind"] == "move_enforcement" and row(r, "crm (prod)")["next_steps"][0]["call_plan"], "mixed: crm (prod) move_enforcement with the X5 line")
    erp = row(r, "erp (prod)")
    check(failing(erp) == {"no_wide_reach_account"} and erp["next_steps"][0]["kind"] == "review_account" and "jdoe" in erp["next_steps"][0]["sentence"], "mixed: erp (prod) wide-reach account")
    dns = row(r, "dns (mgmt)")
    check(failing(dns) == {"no_unmanaged_inbound"} and dns["next_steps"][0]["kind"] == "narrow_inbound" and "198.51.100.7" in dns["next_steps"][0]["sentence"], "mixed: dns (mgmt) unmanaged inbound names the X3 source")
    leg = row(r, "legacy (dev)")
    check("managed" in failing(leg) and leg["next_steps"][0]["kind"] == "pair_ven", "mixed: legacy (dev) needs a VEN")
    wiki = row(r, "wiki (staging)")
    check(wiki["next_steps"][0]["kind"] == "write_policy" and wiki["next_steps"][0]["bucket"] == "week" and wiki["next_steps"][0]["call_plan"], "mixed: wiki (staging) write_policy backed by its X5 line")
    check(row(r, "logs (mgmt)")["next_steps"] == [], "mixed: logs (mgmt) has nothing left")
    check(row(r, "unlabelled")["workloads"] == 15, "mixed: 15 unlabelled workloads")
    check(r["estate"]["workloads"] == 98 and r["estate"]["in_force_share"] == 0.49 and r["estate"]["contained_share"] == 0.08, f"mixed: estate shares {r['estate']['in_force_share']} {r['estate']['contained_share']}")
    check([t["app"] for t in r["estate"]["to_next"][:2]] == ["unlabelled", "crm"], "mixed: to_next starts with the 15 unlabelled workloads, then crm (prod)")
    check(r["inputs"]["lateral"] is not None, "mixed: lateral.json read")

    # mixed without lateral.json
    n = common("mixed-nolateral")
    check(n["inputs"]["lateral"] is None, "mixed-nolateral: lateral must be null")
    check(all(a["gates"]["not_a_bridge"] == {"state": "unknown", "reason": "reach unknown: lateral.json missing"} for a in n["apps"] if a["key"] != "unlabelled"),
          "mixed-nolateral: not_a_bridge must be unknown on every app row")
    check(all(a["level"] < 5 for a in n["apps"]), "mixed-nolateral: no app may reach level 5")
    check(n["estate"]["distribution"]["5"] == {"apps": 0, "workloads": 0}, "mixed-nolateral: level 5 empty")
    logs = row(n, "logs (mgmt)")
    check(logs["level"] == 4 and [s["kind"] for s in logs["next_steps"]] == ["check_reach"], "mixed-nolateral: logs (mgmt) drops to 4 with a check_reach step")
    check(any("lateral.json missing" in x for x in n["notes"]), "mixed-nolateral: note about the missing lateral result")
    others = {k: v for k, v in levels(n).items()}
    check(others == {**EXPECTED["mixed"], "logs (mgmt)": 4}, f"mixed-nolateral: levels {others}")

    # contained: everything at 5
    c = common("contained")
    check(levels(c) == EXPECTED["contained"], f"contained: levels {levels(c)}")
    check(c["estate"]["next_level"] is None and c["estate"]["to_next"] == [] and c["estate"]["contained_share"] == 1.0, "contained: estate at the top")
    check(all(a["next_steps"] == [] for a in c["apps"]), "contained: no next steps")
    check(all(v["state"] == "pass" for a in c["apps"] for v in a["gates"].values()), "contained: every gate passes")
    check("Nothing: every app is at level 5." in (OUT / "contained" / "readiness.md").read_text(), "contained: section 5 says nothing is left")

    # unlabelled: one row, level 0, no envs
    u = common("unlabelled")
    check(levels(u) == EXPECTED["unlabelled"] and len(u["apps"]) == 1, f"unlabelled: rows {levels(u)}")
    check(u["estate"] | {} and u["estate"]["distribution"]["0"] == {"apps": 1, "workloads": 40}, "unlabelled: distribution")
    check(u["envs"] == [] and u["estate"]["labelled"] == 0 and u["estate"]["managed"] == 40, "unlabelled: no env, nothing labelled")
    check(any("no app or env column" in x for x in u["notes"]), "unlabelled: note about the missing columns")

    # every kind of the mapping table appears in at least one run
    kinds = {s["kind"] for x in (r, n, c, u) for a in x["apps"] for s in a["next_steps"]}
    check(kinds == KINDS, f"kinds never exercised: {sorted(KINDS - kinds)}")

    # repo rules: no em dashes anywhere in the skill, no bytecode left behind
    for path in SKILL.rglob("*"):
        if path.is_file() and path.suffix in (".py", ".md", ".sh", ".jsx", ".json", ".txt") and "tests/out" not in str(path) and "tests/fixtures" not in str(path):
            try:
                text = path.read_text()
            except UnicodeDecodeError:
                continue
            check(chr(0x2014) not in text, f"em dash in {path.relative_to(SKILL)}")
    for path in (OUT.rglob("readiness.md")):
        check(chr(0x2014) not in path.read_text(), f"em dash in {path.relative_to(SKILL)}")
    check(not list(SKILL.rglob("__pycache__")), "__pycache__ left in the skill directory")

    if failures:
        print(f"{len(failures)} failure(s)")
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
