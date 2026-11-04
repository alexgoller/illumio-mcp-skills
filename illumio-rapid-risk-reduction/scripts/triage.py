#!/usr/bin/env python3
"""Score exposures and draft rapid-risk-reduction policy from saved illumio-mcp results.

Inputs (<scratch>/*.json; missing files are reported in plan.json["inputs"]):
  workloads.json     get-workloads, compact, unfiltered
  summary.json       get-traffic-flows-summary, detail_level full
  admin_ports.json   get-traffic-flows grouped by source_app/dest_app/port/proto/policy,
                     filtered to the admin ports
  unknown.json       find-unknown-endpoints, direction inbound
  lateral.json       detect-lateral-movement-paths
  identity.json      build-identity-graph (optional)

Outputs: <out>/plan.json, <out>/plan.md, <out>/callplans/*.json.
Every call plan is marked DO_NOT_CALL. The script never talks to the PCE.
The rubric is references/scoring.md; every score prints its inputs.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
from collections import Counter, defaultdict
from datetime import date

ADMIN_PORTS = {22, 3389, 445, 135, 139, 5985, 5986, 1433, 3306, 5432}
SHARED_SERVICE_HINTS = ("dns", "ad", "ldap", "ntp", "monitor", "nagios", "backup", "syslog", "proxy")
BLOCK_TODAY = (30, 6)      # (score, ease): an already potentially-blocked admin port crossing into prod is 5 x 7 = 35
FENCE_WEEK = 25


def load(path: pathlib.Path):
    if not path.exists():
        return None
    text = path.read_text(); start = text.find("{")
    return json.loads(text[start:]) if start >= 0 else None


def rows(envelope):
    if not envelope or "columns" not in envelope:
        return []
    return [dict(zip(envelope["columns"], r)) for r in envelope.get("data", [])]


# ----------------------------------------------------------------- inventory

def inventory(workloads, prod_envs):
    hosts, apps = {}, defaultdict(lambda: {"workloads": 0, "modes": Counter(), "env": None})
    for w in rows(workloads):
        name = str(w.get("hostname") or w.get("name"))
        hosts[name] = w
        key = (w.get("app"), w.get("env"))
        if w.get("app"):
            apps[key]["workloads"] += 1
            apps[key]["modes"][w.get("enforcement_mode") or "unknown"] += 1
            apps[key]["env"] = w.get("env")
    return hosts, apps


def is_prod(env, prod_envs):
    return env is not None and str(env).lower() in {e.lower() for e in prod_envs}


# ------------------------------------------------------------------ scoring

def score_blast(enforced_reached, apps_touched, admin, bridge, crosses_prod):
    b = min(enforced_reached, 5) + min(apps_touched, 3) + (2 if admin else 0) + (2 if bridge else 0) + (1 if crosses_prod else 0)
    return min(b, 10)


def score_ease(already_denied, unknown_source, scanner, single_deny, scope_exists, shared_service):
    e = (4 if already_denied else 0) + (3 if unknown_source else 0) + (2 if scanner else 0) + (2 if single_deny else 0) + (1 if scope_exists else 0) - (4 if shared_service else 0)
    return max(0, min(e, 10))


# ----------------------------------------------------------------- findings

def unknown_findings(unknown, hosts, today):
    out = []
    for ep in (unknown or {}).get("endpoints", []):
        profiles = ep.get("profiles") or []
        admin = "admin_reach" in profiles
        peers_enf = int(ep.get("peers_enforced") or 0)
        peers = ep.get("peer_workloads") or []
        apps = {(hosts.get(str(p), {}).get("app")) for p in peers} - {None}
        blast = score_blast(peers_enf, len(apps), admin, False, False)
        ease = score_ease(False, True, "scanner" in profiles, True, False, False)
        score = blast * ease
        f = {"kind": "unknown_source", "what": f"unknown source {ep['ip']} ({', '.join(profiles) or 'no profile'}"
                                                f"{', ' + ep['likely_provider'] if ep.get('likely_provider') else ''})",
             "from": ep["ip"], "to": f"{len(peers)} workloads ({peers_enf} enforced)", "admin": admin,
             "connections": int(ep.get("connections") or 0), "enforced_reached": peers_enf, "apps": sorted(apps),
             "blast": blast, "ease": ease, "score": score,
             "inputs": {"peers_enforced": peers_enf, "apps_touched": len(apps), "admin_reach": admin, "profiles": profiles}}
        f["callplan"] = {
            "DO_NOT_CALL": "draft for review", "step_1": {"tool": "create-iplist",
                "arguments": {"name": f"RRR-{today}-src-{ep['ip'].replace('.', '-').replace(':', '-')}",
                              "description": f"Unknown source profiled as {', '.join(profiles) or 'unprofiled'}", "ip_ranges": [{"from_ip": ep["ip"]}]}},
            "step_2": {"tool": "create-deny-rule", "arguments": {
                "ruleset_name": f"RRR-{today}", "override_deny": bool(admin and peers_enf),
                "consumers": [{"ip_list": f"RRR-{today}-src-{ep['ip'].replace('.', '-').replace(':', '-')}"}],
                "providers": [{"all_workloads": True}],
                "ingress_services": [{"port": p, "proto": "tcp"} for p in sorted(ADMIN_PORTS)] if admin else [{"all_services": True}],
                "description": f"RRR: unknown source {ep['ip']} reached {peers_enf} enforced workloads"
                               f"{' on admin ports' if admin else ''} in the window"}},
            "rollback": "delete-deny-rule on the rule href, delete-iplist on the list; nothing is provisioned"}
        out.append(f)
    return out


def admin_boundary_findings(admin_ports, apps, prod_envs, today):
    out = []
    agg = defaultdict(lambda: {"conns": 0, "decisions": Counter(), "ports": set()})
    for r in rows(admin_ports):
        try: port = int(r.get("port"))
        except (TypeError, ValueError): continue
        if port not in ADMIN_PORTS: continue
        src = (r.get("src_app"), r.get("src_env")); dst = (r.get("dst_app"), r.get("dst_env"))
        if src == dst or not dst[0]: continue
        crosses = (not is_prod(src[1], prod_envs)) and is_prod(dst[1], prod_envs)
        key = (src, dst)
        agg[key]["conns"] += int(r.get("num_connections") or 0)
        agg[key]["decisions"][r.get("policy_decision") or "unknown"] += 1
        agg[key]["ports"].add(port); agg[key]["crosses"] = crosses
    for (src, dst), a in agg.items():
        already = all(d in ("blocked", "potentially_blocked") for d in a["decisions"])
        shared = any(h in str(src[0] or "").lower() for h in SHARED_SERVICE_HINTS)
        dst_info = apps.get(dst, {})
        blast = score_blast(dst_info.get("modes", Counter()).get("full", 0) + dst_info.get("modes", Counter()).get("selective", 0), 1, True, False, a.get("crosses", False))
        ease = score_ease(already, False, False, True, bool(dst[0]), shared)
        f = {"kind": "admin_port_boundary", "what": f"admin ports {sorted(a['ports'])} from {src[0] or 'unlabelled'}/{src[1] or '-'} to {dst[0]}/{dst[1]}",
             "from": f"{src[0]}/{src[1]}", "to": f"{dst[0]}/{dst[1]}", "admin": True, "connections": a["conns"],
             "enforced_reached": blast, "apps": [f"{dst[0]}/{dst[1]}"], "blast": blast, "ease": ease, "score": blast * ease,
             "inputs": {"decisions": dict(a["decisions"]), "crosses_prod_boundary": a.get("crosses", False), "shared_service_source": shared}}
        consumers = ([{"label": {"key": "app", "value": src[0]}}, {"label": {"key": "env", "value": src[1]}}] if src[0] else [{"all_workloads": True}])
        f["callplan"] = {"DO_NOT_CALL": "draft for review", "tool": "create-deny-rule", "arguments": {
            "ruleset_name": f"RRR-{today}", "override_deny": False, "consumers": consumers,
            "providers": [{"label": {"key": "app", "value": dst[0]}}, {"label": {"key": "env", "value": dst[1]}}],
            "ingress_services": [{"port": p, "proto": "tcp"} for p in sorted(a["ports"])],
            "description": f"RRR: admin ports across the {src[1]}->{dst[1]} boundary; {dict(a['decisions'])} in the window"},
            "rollback": "delete-deny-rule on the rule href; nothing is provisioned"}
        out.append(f)
    return out


def ringfence_candidates(lateral, apps, summary, crown, today):
    bridges = {(b.get("app"), b.get("env")) for b in (lateral or {}).get("high_risk_bridge_nodes", []) if isinstance(b, dict)}
    arts = {(b.get("app"), b.get("env")) for b in (lateral or {}).get("articulation_points", []) if isinstance(b, dict)}
    inbound = defaultdict(lambda: {"peers": set(), "pb": 0, "allowed": 0})
    for r in (summary or {}).get("app_to_app", []):
        to = tuple((r.get("to") or " / ").split(" / ", 1)) if isinstance(r.get("to"), str) else (None, None)
        inbound[to]["peers"].add(r.get("from"))
        inbound[to]["pb" if r.get("policy_decision") in ("blocked", "potentially_blocked") else "allowed"] += 1
    out = []
    for key, info in apps.items():
        bridge = key in bridges or key in arts
        inb = inbound.get(key, {"peers": set(), "pb": 0, "allowed": 0})
        vis = info["modes"].get("visibility_only", 0)
        blast = score_blast(info["workloads"], len(inb["peers"]), False, bridge, False)
        ease = score_ease(inb["pb"] > 0 and inb["allowed"] == 0, False, False, False, True, False)
        score = blast * ease + (10 if key in crown else 0)
        if score < FENCE_WEEK and key not in crown and not bridge:
            continue
        out.append({"kind": "ringfence", "app": key[0], "env": key[1], "bridge": bridge, "crown_jewel": key in crown,
                    "workloads": info["workloads"], "modes": dict(info["modes"]), "inbound_peer_apps": len(inb["peers"]),
                    "inbound_potentially_blocked": inb["pb"], "visibility_only_workloads": vis,
                    "blast": blast, "ease": ease, "score": score,
                    "callplan": {"DO_NOT_CALL": "draft for review", "tool": "create-ringfence",
                                 "arguments": {"app_name": key[0], "env_name": key[1], "selective": True, "dry_run": True,
                                               "ruleset_name": f"RRR-{today}-RF-{key[0]}-{key[1]}"},
                                 "note": "dry_run previews the allow-list; the deny rule is what makes a selective ringfence bite",
                                 "rollback": "delete-ruleset on the draft ruleset; nothing is provisioned"}})
    return sorted(out, key=lambda f: -f["score"])


def isolation_runbooks(crown, apps, today):
    out = []
    for key in crown:
        info = apps.get(key, {"workloads": 0, "modes": Counter()})
        out.append({"app": key[0], "env": key[1], "workloads": info["workloads"], "incident_use_only": True,
                    "steps": [
                        {"tool": "create-ruleset", "arguments": {"name": f"ISOLATE-{key[0]}-{key[1]}", "scopes": [[{"key": "app", "value": key[0]}, {"key": "env", "value": key[1]}]]}},
                        {"tool": "create-deny-rule", "arguments": {"ruleset_name": f"ISOLATE-{key[0]}-{key[1]}", "override_deny": True,
                                                                   "consumers": [{"all_workloads": True}, {"ip_list": "Any (0.0.0.0/0 and ::/0)"}],
                                                                   "providers": [{"label": {"key": "app", "value": key[0]}}, {"label": {"key": "env", "value": key[1]}}],
                                                                   "ingress_services": [{"all_services": True}],
                                                                   "description": "ISOLATION: override deny, beats every allow; incident use only"}},
                        {"tool": "provision-policy", "note": "confirm-gated; a person runs this, and only in an incident"}],
                    "blast_radius": f"every inbound connection to {info['workloads']} workloads stops, including from its own clients",
                    "rollback": "delete the ISOLATE ruleset and provision again"})
    return out


# ------------------------------------------------------------------- output

def write_plan(out: pathlib.Path, plan: dict):
    (out / "callplans").mkdir(parents=True, exist_ok=True)
    for i, f in enumerate(plan["block_today"], 1):
        (out / "callplans" / f"block-{i:02d}.json").write_text(json.dumps(f["callplan"], indent=1))
    for i, f in enumerate(plan["fence_this_week"], 1):
        (out / "callplans" / f"fence-{i:02d}.json").write_text(json.dumps(f["callplan"], indent=1))
    for i, r in enumerate(plan["isolate_on_demand"], 1):
        (out / "callplans" / f"isolate-{i:02d}.json").write_text(json.dumps(r, indent=1))
    (out / "plan.json").write_text(json.dumps(plan, indent=1, default=str))
    L = [f"# Rapid risk reduction plan -- {plan['window']}", "",
         f"{len(plan['block_today'])} to block today, {len(plan['fence_this_week'])} to fence this week, "
         f"{len(plan['isolate_on_demand'])} isolation runbooks. Nothing is provisioned.", ""]
    if plan["caveats"]: L += ["**Caveats:** " + "; ".join(plan["caveats"]), ""]
    L += ["## Block today", "", "| # | what | connections | enforced reached | blast x ease | override | plan |", "| --- | --- | --- | --- | --- | --- | --- |"]
    for i, f in enumerate(plan["block_today"], 1):
        ov = f["callplan"].get("step_2", f["callplan"]).get("arguments", {}).get("override_deny", False)
        L.append(f"| {i} | {f['what']} | {f['connections']} | {f['enforced_reached']} | {f['blast']} x {f['ease']} = {f['score']} | {'yes' if ov else 'no'} | callplans/block-{i:02d}.json |")
    L += ["", "## Fence this week", "", "| # | app | bridge | inbound peer apps | potentially blocked | workloads | modes | plan |", "| --- | --- | --- | --- | --- | --- | --- | --- |"]
    for i, f in enumerate(plan["fence_this_week"], 1):
        L.append(f"| {i} | {f['app']}/{f['env']}{' (crown jewel)' if f['crown_jewel'] else ''} | {'yes' if f['bridge'] else 'no'} | {f['inbound_peer_apps']} | {f['inbound_potentially_blocked']} | {f['workloads']} | {f['modes']} | callplans/fence-{i:02d}.json |")
    L += ["", "## Isolate on demand"] + [f"- {r['app']}/{r['env']}: {r['workloads']} workloads -- callplans/isolate-{i:02d}.json (incident use only)" for i, r in enumerate(plan["isolate_on_demand"], 1)]
    L += ["", "## Questions, not rules"] + ([f"- {q}" for q in plan["questions"]] or ["- none"])
    L += ["", "## Semantics", "- Override deny beats every allow rule; incident use.", "- A selective ringfence bites only in selective mode, through its deny rule.",
          "- Deny rules are enforced on the consumer side; `deny_consumer: any` touches only the destination workloads.", "- Nothing here is provisioned until a person runs provision-policy."]
    (out / "plan.md").write_text("\n".join(L) + "\n")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--scratch", type=pathlib.Path, required=True); ap.add_argument("--out", type=pathlib.Path, required=True)
    ap.add_argument("--prod-env", action="append", default=[], help="env values that count as production (repeatable)")
    ap.add_argument("--crown-jewel", action="append", default=[], help="app=<a>,env=<e> (repeatable)")
    ap.add_argument("--today", default=date.today().isoformat())
    a = ap.parse_args(argv)
    crown = set()
    for cj in a.crown_jewel:
        kv = dict(p.split("=", 1) for p in cj.split(",")); crown.add((kv.get("app"), kv.get("env")))
    files = {n: a.scratch / f"{n}.json" for n in ("workloads", "summary", "admin_ports", "unknown", "lateral", "identity")}
    data = {n: load(f) for n, f in files.items()}
    if data["workloads"] is None:
        sys.exit(f"{files['workloads']} is required")
    hosts, apps = inventory(data["workloads"], a.prod_env)
    caveats = []
    for n in ("summary", "unknown"):
        if (data[n] or {}).get("totals", {}).get("truncated") or (data[n] or {}).get("totals", {}).get("flows_truncated"):
            caveats.append(f"{n} hit the PCE cap; counts are lower bounds")
    if data["admin_ports"] and int(data["admin_ports"].get("total_pce_flows") or 0) >= 500:
        caveats.append("admin_ports hit the 500-flow cap; narrow the window")
    findings = unknown_findings(data["unknown"], hosts, a.today) + admin_boundary_findings(data["admin_ports"], apps, a.prod_env, a.today)
    block = sorted([f for f in findings if f["score"] >= BLOCK_TODAY[0] and f["ease"] >= BLOCK_TODAY[1]], key=lambda f: -f["score"])
    fence = ringfence_candidates(data["lateral"], apps, data["summary"], crown, a.today)
    questions = []
    for f in (data["identity"] or {}).get("findings", []):
        if f.get("interest") == "review":
            questions.append(f"identity {f['identity']}: " + "; ".join(f.get("why_surfaced", [])))
    for f in findings:
        if f["kind"] == "admin_port_boundary" and f["inputs"].get("shared_service_source"):
            questions.append(f"{f['what']}: source looks like a shared service; confirm before denying")
    plan = {"window": a.today, "inputs": {n: f.exists() for n, f in files.items()}, "caveats": caveats,
            "thresholds": {"block_today": {"score": BLOCK_TODAY[0], "ease": BLOCK_TODAY[1]}, "fence_this_week": FENCE_WEEK},
            "block_today": block, "fence_this_week": fence, "isolate_on_demand": isolation_runbooks(sorted(crown), apps, a.today),
            "below_threshold": [f for f in findings if f not in block], "questions": questions}
    write_plan(a.out, plan)
    print(f"wrote {a.out}/plan.md: block {len(block)}, fence {len(fence)}, isolate {len(plan['isolate_on_demand'])}, questions {len(questions)}"
          + (f"; missing inputs: {[n for n, ok in plan['inputs'].items() if not ok]}" if not all(plan["inputs"].values()) else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
