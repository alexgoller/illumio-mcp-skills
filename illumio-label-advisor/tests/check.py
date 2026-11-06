#!/usr/bin/env python3
"""Assert what tests/expectations.md states about the runs in tests/out/<name>/.
Run tests/make_fixtures.py and tests/run_all.sh first. Exit 1 on the first failure."""
from __future__ import annotations

import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
SKILL = HERE.parent
OUT = HERE / "out"
FIXTURES = HERE / "fixtures"
KINDS = {"listening_process", "listening_port", "hostname_token", "peer_app", "peer_env",
         "subnet_majority", "ven_os", "fan_in", "model_knowledge"}
CONF = {"high", "medium", "low"}
MARK_START, MARK_END = "// ===== DATA START =====", "// ===== DATA END ====="
failures = []


def check(cond: bool, msg: str):
    if not cond:
        failures.append(msg)
        print(f"FAIL {msg}")


def load_labels_of(fixture: str) -> dict:
    """href -> {key: value} from the fixture's workloads.json, '-' and null missing."""
    env = json.loads((FIXTURES / fixture / "scratch" / "workloads.json").read_text())
    fixed = {"href", "name", "hostname", "ip_addresses", "os_type", "online", "managed", "enforcement_mode",
             "visibility_level", "ven_status", "last_heartbeat_on", "agent_version", "policy_sync_state",
             "health_errors", "health_error_types"}
    out = {}
    for row in env["data"]:
        r = dict(zip(env["columns"], row))
        out[r["href"]] = {k: v for k, v in r.items() if k not in fixed and v not in (None, "", "-")}
    return out


def common(name: str, fixture: str) -> dict:
    d = OUT / name
    a = json.loads((d / "advice.json").read_text())
    before = load_labels_of(fixture)
    for key in ("generated", "window", "inputs", "dimensions", "readiness", "conventions", "hubs",
                "suggestions", "conflicts", "unresolved", "plan"):
        check(key in a, f"{name}: advice.json lacks {key}")
    r = a["readiness"]
    check(r["fully_labelled"] + r["partly_labelled"] + r["unlabelled"] == r["workloads"], f"{name}: label states do not add up")
    check(r["managed"] + r["unmanaged"] == r["workloads"], f"{name}: managed + unmanaged != workloads")
    check(len(before) == r["workloads"], f"{name}: readiness.workloads {r['workloads']} != fixture {len(before)}")
    dims = a["dimensions"]["standard"] + a["dimensions"]["custom"]
    for s in a["suggestions"] + a["conflicts"]:
        check(s["dimension"] in dims, f"{name}: {s['hostname']} suggests unknown dimension {s['dimension']}")
        check(s["confidence"] in CONF, f"{name}: bad confidence {s['confidence']}")
        check(all(g["kind"] in KINDS for g in s["signals"]), f"{name}: {s['hostname']} signal kind outside the closed list")
        check(len(s["signals"]) >= 1, f"{name}: {s['hostname']} {s['dimension']} has no signals")
    for s in a["suggestions"]:
        check(s["dimension"] not in before.get(s["href"], {}), f"{name}: suggestion for {s['hostname']} {s['dimension']} but the workload carries it (fill gaps only)")
        check(s["source"] in ("script", "model"), f"{name}: bad source {s['source']}")
        if s["dimension"] in a["dimensions"]["custom"]:
            check(not s["new_value"] and s["value"] in a["dimensions"]["values"][s["dimension"]],
                  f"{name}: custom dimension {s['dimension']} proposes a value not in use: {s['value']}")
        if s["source"] == "model":
            check(s["confidence"] != "high", f"{name}: model suggestion {s['hostname']} is high")
            check(any(g["kind"] == "model_knowledge" for g in s["signals"]), f"{name}: model suggestion without model_knowledge signal")
    for c in a["conflicts"]:
        check(before.get(c["href"], {}).get(c["dimension"]) == c["existing"], f"{name}: conflict {c['hostname']} existing value does not match the fixture")
        check(c["existing"].lower() != c["suggested"].lower(), f"{name}: conflict {c['hostname']} with equal values")
    # plan: fill gaps only, after = before + add, counts, rollback equals before
    p = a["plan"]
    plan_json = json.loads((d / "plan.json").read_text())
    check(plan_json == p, f"{name}: plan.json differs from advice.plan")
    floor = {"low": 0, "medium": 1, "high": 2}[p["preferences"]["min_confidence"]]
    added = created = 0
    for e in p["workloads"]:
        check(e["before"] == before[e["href"]], f"{name}: plan before for {e['hostname']} differs from the fixture labels")
        check(not set(e["add"]) & set(e["before"]), f"{name}: plan adds a key {e['hostname']} already had")
        check(e["after"] == {**e["before"], **e["add"]}, f"{name}: plan after != before + add for {e['hostname']}")
        check(set(e["confidence"]) == set(e["add"]), f"{name}: plan confidence keys != add keys for {e['hostname']}")
        check(all({"low": 0, "medium": 1, "high": 2}[c] >= floor for c in e["confidence"].values()), f"{name}: plan entry below min_confidence for {e['hostname']}")
        check(set(e["add"]) <= set(p["preferences"]["dimensions"]), f"{name}: plan adds a dimension outside preferences for {e['hostname']}")
        added += len(e["add"])
    check(p["counts"] == {"workloads": len(p["workloads"]), "labels_added": added, "labels_created": len(p["new_labels"])}, f"{name}: plan counts wrong {p['counts']}")
    plan_md = (d / "plan.md").read_text()
    rollbacks = {}
    for m in re.finditer(r"- rollback: `update-workload href:(\S+) labels:(\[.*?\])`", plan_md):
        rollbacks[m.group(1)] = {x["key"]: x["value"] for x in json.loads(m.group(2))}
    check(set(rollbacks) == {e["href"] for e in p["workloads"]}, f"{name}: plan.md rollback calls do not cover the plan ({len(rollbacks)} vs {len(p['workloads'])})")
    for e in p["workloads"]:
        check(rollbacks.get(e["href"]) == e["before"], f"{name}: rollback for {e['hostname']} != before state")
    applies = {m.group(1): {x["key"]: x["value"] for x in json.loads(m.group(2))}
               for m in re.finditer(r"- apply: `update-workload href:(\S+) labels:(\[.*?\])`", plan_md)}
    for e in p["workloads"]:
        check(applies.get(e["href"]) == e["after"], f"{name}: apply call for {e['hostname']} != after state")
    # dashboard: markers on their own lines, one DATA constant equal to advice.json
    dash = (d / "dashboard.jsx").read_text().split("\n")
    starts = [i for i, l in enumerate(dash) if l.strip() == MARK_START]
    ends = [i for i, l in enumerate(dash) if l.strip() == MARK_END]
    check(len(starts) == 1 and len(ends) == 1 and ends[0] > starts[0], f"{name}: dashboard markers not exactly once each")
    check(sum(1 for l in dash if l.startswith("const DATA =")) == 1, f"{name}: dashboard declares DATA more than once")
    if starts and ends:
        block = "\n".join(dash[starts[0] + 1:ends[0]]).strip()
        check(block.startswith("const DATA = ") and block.endswith(";"), f"{name}: DATA block shape")
        try:
            check(json.loads(block[len("const DATA = "):-1]) == a, f"{name}: dashboard DATA != advice.json")
        except json.JSONDecodeError:
            check(False, f"{name}: dashboard DATA is not JSON")
    for f in ("suggestions.md", "unresolved.md", "plan.md"):
        check((d / f).exists() and (d / f).stat().st_size > 0, f"{name}: {f} missing or empty")
    return a


def batches(name: str, fixture: str):
    b = json.loads((OUT / name / "batches.json").read_text())
    before = load_labels_of(fixture)
    check(all(x["workloads"] <= 150 for x in b["full"]), f"{name}: a full-detail batch exceeds 150 workloads")
    check(all(x["ip_address"].endswith(".") and x["ip_address"].count(".") >= 3 for x in b["full"]), f"{name}: full batch prefix is not a /24 prefix")
    check(all(len(x["hrefs"]) <= 25 for x in b["flows"]), f"{name}: a flow batch exceeds 25 hrefs")
    seq = [h for x in b["flows"] for h in x["hrefs"]]
    check(set(seq) == set(before) and len(seq) == len(before), f"{name}: flow batches do not cover every workload once")
    ranks = [0 if not before[h] else 1 for h in seq]
    check(ranks == sorted(ranks), f"{name}: flow batches do not put unlabelled workloads first")


def kinds_of(a: dict) -> set:
    return {g["kind"] for s in a["suggestions"] + a["conflicts"] for g in s["signals"]}


def main() -> int:
    # unlabelled
    a = common("unlabelled", "unlabelled")
    batches("unlabelled", "unlabelled")
    r = a["readiness"]
    check(r["unlabelled"] == 60 and r["fully_labelled"] == 0 and r["partly_labelled"] == 0, "unlabelled: readiness states")
    check(a["dimensions"]["custom"] == [], "unlabelled: custom dimensions should be empty")
    check({s["dimension"] for s in a["suggestions"]} == {"role"}, "unlabelled: only role can be suggested")
    check(len(a["suggestions"]) >= 40, f"unlabelled: expected 40+ role suggestions, got {len(a['suggestions'])}")
    check(all(s["new_value"] for s in a["suggestions"]), "unlabelled: every role value is new (empty vocabulary)")
    check(a["conflicts"] == [] and a["conventions"] == [], "unlabelled: no conflicts, no conventions")
    hub_kinds = sorted(h["kind"] for h in a["hubs"])
    check(hub_kinds.count("directory") == 2 and hub_kinds.count("dns") == 2 and "backup" in hub_kinds, f"unlabelled: hubs {hub_kinds}")
    check(all(h["from"] == "fan-in" for h in a["hubs"]), "unlabelled: hubs must come from fan-in")
    dirs = [s for s in a["suggestions"] if s["value"] == "Directory"]
    check(len(dirs) == 2 and all(s["confidence"] == "high" for s in dirs), "unlabelled: two high Directory suggestions")
    check({"listening_process", "ven_os", "fan_in"} <= kinds_of(a), f"unlabelled: kinds {kinds_of(a)}")
    procs = {p["process"] for p in a["unresolved"]["processes"]}
    check(procs == {"svc_foo.exe", "vendord"}, f"unlabelled: unresolved processes {procs}")
    check(len(a["unresolved"]["workloads"]) == 60, "unlabelled: every workload has app/env/loc unresolved")
    check("infra.json (message only: Traffic data has no labeled app flows to analyze)" in a["inputs"]["missing"], "unlabelled: infra message not recorded")
    check(a["plan"]["counts"]["workloads"] > 0 and a["plan"]["new_labels"], "unlabelled: plan should carry the high role suggestions with new label values")

    # half
    a = common("half", "half")
    batches("half", "half")
    r = a["readiness"]
    check(r["workloads"] == 120 and r["fully_labelled"] == 60, f"half: readiness {r['fully_labelled']} fully labelled")
    check(a["dimensions"]["custom"] == ["bu"], "half: custom dimension bu")
    check("flows_dst_1.json" in a["inputs"]["truncated"] and r["traffic"]["truncated_calls"] == 1, "half: truncated flow call not recorded")
    conflicts = sorted((c["hostname"], c["dimension"], c["existing"], c["suggested"], c["confidence"]) for c in a["conflicts"])
    check(conflicts == [("prd-pay-app03", "env", "Staging", "Production", "high"), ("prd-shop-web03", "env", "Staging", "Production", "high")], f"half: conflicts {conflicts}")
    check({"listening_process", "hostname_token", "peer_app", "peer_env", "subnet_majority", "ven_os"} <= kinds_of(a), f"half: kinds {kinds_of(a)}")
    conv = {(c["dimension"], c["token"], c["value"]) for c in a["conventions"]}
    for want in (("env", "prd", "Production"), ("env", "stg", "Staging"), ("app", "shop", "shop"), ("role", "web", "Web"), ("bu", "10.10.3.0/24", "Sales"), ("loc", "10.20.1.0/24", "DC2")):
        check(want in conv, f"half: convention {want} not mined")
    prd = next(c for c in a["conventions"] if c["dimension"] == "env" and c["token"] == "prd")
    check(prd["counter"] == 2, f"half: prd rule should carry the 2 planted counter-examples, has {prd['counter']}")
    check({s["dimension"] for s in a["suggestions"]} == {"role", "app", "env", "loc", "bu"}, "half: every dimension gets suggestions")
    check(len([s for s in a["suggestions"] if s["dimension"] == "bu"]) >= 40, "half: bu suggestions by subnet")
    check(all(not s["new_value"] for s in a["suggestions"]), "half: no new values (vocabulary complete)")
    hubs = {h["hostname"]: h for h in a["hubs"]}
    check({"dc01", "dc02", "dns01", "dns02", "bk01"} <= set(hubs), f"half: hubs {sorted(hubs)}")
    check(hubs["dc01"]["from"] == "fan-in" and hubs.get("mon01", {}).get("from") == "infra-tool", "half: hub sources")
    check(not any(s["href"] == hubs["dc01"]["href"] for s in a["suggestions"]), "half: a labelled hub gets no suggestion")
    plan_hosts = {e["hostname"]: e for e in a["plan"]["workloads"]}
    check("prd-shop-web03" not in plan_hosts and "prd-pay-app03" not in plan_hosts, "half: conflict hosts must not be in the plan")
    check(a["plan"]["preferences"]["min_confidence"] == "high" and a["plan"]["preferences"]["dimensions"] == ["role", "app", "env", "loc", "bu"], "half: preferences.json not applied")
    check(all(c == "high" for e in a["plan"]["workloads"] for c in e["confidence"].values()), "half: plan carries a non-high entry")
    unres = {w["hostname"]: w for w in a["unresolved"]["workloads"]}
    check("prd-shop-util01" in unres and "role" in unres["prd-shop-util01"]["missing"], "half: util01 role unresolved before the model pass")
    check("unm02" in unres and len(unres["unm02"]["missing"]) == 5, "half: unmanaged host with nothing to go on")

    # half with the model pass
    m = common("half-model", "half")
    model = [s for s in m["suggestions"] if s["source"] == "model"]
    check(len(model) == 1 and model[0]["hostname"] == "prd-shop-util01" and model[0]["value"] == "Backup" and model[0]["confidence"] == "medium", f"half-model: merged {[(s['hostname'], s['dimension'], s['value']) for s in model]}")
    check(len(m["suggestions"]) == len(a["suggestions"]) + 1, "half-model: exactly one suggestion added")
    notes = "\n".join(m["readiness"]["notes"])
    for want in ("already carries role=Web", "unknown href", "not an existing value of a custom dimension", "model agrees with the script on stg-crm-util01 app=crm", "model agrees with the script on unm01 loc=DC1"):
        check(want in notes, f"half-model: note missing: {want}")
    check(m["conflicts"] == a["conflicts"], "half-model: conflicts unchanged by the model pass")
    check(not any(w["hostname"] == "prd-shop-util01" for w in m["unresolved"]["workloads"]), "half-model: util01 resolved by the model")

    # full
    a = common("full", "full")
    batches("full", "full")
    r = a["readiness"]
    check(r["workloads"] == 80 and r["fully_labelled"] == 80 and r["partly_labelled"] == 0 and r["unlabelled"] == 0, f"full: readiness {r}")
    check(all(c["missing"] == 0 for c in r["coverage"].values()), "full: coverage has gaps")
    check(a["suggestions"] == [] and a["conflicts"] == [], f"full: expected silence, got {len(a['suggestions'])} suggestions, {len(a['conflicts'])} conflicts")
    check(a["unresolved"]["workloads"] == [] and a["unresolved"]["processes"] == [], "full: nothing unresolved")
    check(a["plan"]["counts"] == {"workloads": 0, "labels_added": 0, "labels_created": 0}, "full: empty plan")
    check(len(a["hubs"]) >= 5 and len(a["conventions"]) > 0, "full: hubs and conventions still reported")

    # repo rules: no em dashes anywhere in the skill, no bytecode left behind
    for path in SKILL.rglob("*"):
        if path.is_file() and path.suffix in (".py", ".md", ".sh", ".jsx", ".json", ".txt"):
            try:
                text = path.read_text()
            except UnicodeDecodeError:
                continue
            check(chr(0x2014) not in text, f"em dash in {path.relative_to(SKILL)}")
    check(not list(SKILL.rglob("__pycache__")), "__pycache__ left in the skill directory")

    if failures:
        print(f"{len(failures)} failure(s)")
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
