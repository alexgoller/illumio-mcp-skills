#!/usr/bin/env python3
"""Merge the saved illumio-mcp results of a rapid-risk-reduction triage, score
the exposures and write the one-page plan with its call plans.

Inputs (<scratch>/, all optional except workloads; missing files are reported):
  workloads.json       get-workloads, compact, UNFILTERED
  summary.json         get-traffic-flows-summary over the window, unfiltered, detail_level full
  admin_ports.json     get-traffic-flows grouped by source_app, dest_app, port, proto, policy,
                       filtered to the admin ports (split format; 500-flow cap)
  lateral.json         detect-lateral-movement-paths
  unknown.json         find-unknown-endpoints, direction inbound
  identities.json      build-identity-graph, include_service_accounts false
  rulesets.json        get-rulesets, pversion draft, unfiltered
  timeline.json        get-traffic-timeline, blocked + potentially_blocked, bucket 1d, spikes

Outputs: <out>/plan.json, <out>/plan.md, <out>/call-plans.md.

The script never talks to the PCE. Every rule it writes is a draft for
review marked DO_NOT_CALL; nothing is created or provisioned.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys
from collections import Counter, defaultdict
from datetime import date

ADMIN_PORTS = [(p, "tcp") for p in (21, 22, 23, 88, 135, 139, 389, 445, 636, 1433, 1521, 2049,
                                    3306, 3389, 5432, 5900, 5985, 5986, 6379, 9200, 27017)] + [(161, "udp")]
ADMIN_SET = set(ADMIN_PORTS)
PROTO_NAMES = {6: "tcp", 17: "udp", 1: "icmp", "6": "tcp", "17": "udp", "1": "icmp"}
DENIED = ("blocked", "potentially_blocked")
DECISIONS = ("allowed", "potentially_blocked", "blocked")
ANY_LIST = "Any (0.0.0.0/0 and ::/0)"


# --------------------------------------------------------------------------- io

def load(path: pathlib.Path):
    if not path.exists():
        return None
    text = path.read_text()
    start = text.find("{")
    return json.loads(text[start:]) if start >= 0 else None


def split_rows(envelope) -> list[dict]:
    if not envelope or "columns" not in envelope:
        return []
    cols = envelope["columns"]
    return [dict(zip(cols, row)) for row in envelope.get("data", [])]


def parse_identity(text) -> tuple[str, str] | None:
    """'app (env)' -> (app, env); external:*, unlabelled, '-' -> None."""
    if not isinstance(text, str):
        return None
    m = re.fullmatch(r"(.+?) \((.+)\)", text.strip())
    return (m.group(1), m.group(2)) if m else None


def proto_name(p) -> str:
    return PROTO_NAMES.get(p, str(p).lower())


def scale(n: int, steps: tuple) -> int:
    """steps = thresholds for B=2..5; below the first is 1."""
    b = 1
    for t in steps:
        if n >= t:
            b += 1
    return b


def clamp(x: int) -> int:
    return max(1, min(5, x))


def mix(counts: dict) -> dict:
    total = sum(counts.get(d, 0) for d in DECISIONS)
    denied = counts.get("blocked", 0) + counts.get("potentially_blocked", 0)
    return {"allowed": counts.get("allowed", 0), "potentially_blocked": counts.get("potentially_blocked", 0),
            "blocked": counts.get("blocked", 0), "denied_share": round(denied / total, 2) if total else None}


def ease_base(m: dict) -> int:
    s = m["denied_share"]
    if s is None:
        return 3
    return 5 if s >= 0.95 else 4 if s >= 0.70 else 3 if s >= 0.30 else 2


# ---------------------------------------------------------------------- inputs

def workload_index(rows: list[dict]) -> dict:
    apps: dict[tuple, dict] = {}
    hosts: dict[str, dict] = {}
    envs: Counter = Counter()
    for r in rows:
        app, env = r.get("app"), r.get("env")
        if env:
            envs[str(env)] += 1
        key = (str(app), str(env)) if app and env else None
        mode = str(r.get("enforcement_mode") or "unknown")
        if key:
            a = apps.setdefault(key, {"workloads": 0, "modes": Counter(), "hostnames": []})
            a["workloads"] += 1
            a["modes"][mode] += 1
            a["hostnames"].append(str(r.get("hostname") or r.get("name")))
        for name in (r.get("hostname"), r.get("name")):
            if name:
                hosts[str(name)] = {"app": app, "env": env, "enforcement_mode": mode}
    return {"apps": apps, "hosts": hosts, "envs": envs}


def pick_prod_envs(given: list[str], envs: Counter) -> list[str]:
    if given:
        return given
    return sorted(e for e in envs if "prod" in e.lower())


def existing_policy(rs: dict | None) -> dict:
    """What draft policy already has: rulesets scoped per app, deny rules, RRR rulesets."""
    out = {"policy_version": (rs or {}).get("policy_version"), "scoped": {}, "fenced": set(),
           "deny_rules": [], "rrr_rulesets": []}
    for r in (rs or {}).get("rulesets", []):
        name = r.get("name", "")
        if name.startswith("RRR-"):
            out["rrr_rulesets"].append(name)
        scope_apps = set()
        for scope in r.get("scopes") or []:
            labels = {s.get("key"): s.get("value") for s in scope if isinstance(s, dict) and "key" in s}
            if labels.get("app") and labels.get("env"):
                scope_apps.add((labels["app"], labels["env"]))
        for key in scope_apps:
            out["scoped"].setdefault(key, []).append(name)
        for rule in r.get("rules", []):
            if rule.get("rule_type") in ("deny", "override_deny"):
                entry = {"ruleset": name, "rule_type": rule["rule_type"], "href": rule.get("href"),
                         "consumers": [actor_text(a) for a in rule.get("consumers", [])],
                         "providers": [actor_text(a) for a in rule.get("providers", [])],
                         "services": [service_text(s) for s in rule.get("ingress_services", [])]}
                out["deny_rules"].append(entry)
                if scope_apps and any(p == "all workloads" for p in entry["providers"]):
                    out["fenced"] |= scope_apps
    return out


def actor_text(a: dict) -> str:
    if a.get("all_workloads"):
        return "all workloads"
    if "label" in a:
        return f"{a['label'].get('key')}={a['label'].get('value')}"
    if "ip_list" in a:
        return f"iplist:{a['ip_list'].get('name')}"
    if "label_group" in a:
        return f"label_group:{a['label_group'].get('name')}"
    return json.dumps(a, sort_keys=True)


def service_text(s: dict) -> str:
    if "service" in s:
        return str(s["service"].get("name"))
    port = s.get("port")
    to = s.get("to_port")
    return f"{port}{'-' + str(to) if to and to != port else ''}/{proto_name(s.get('proto'))}"


# -------------------------------------------------------------------- exposures

def x1_unknown_admin(unknown: dict | None, policy: dict) -> list[dict]:
    lines = []
    for e in (unknown or {}).get("endpoints", []):
        if "admin_reach" not in (e.get("profile") or []):
            continue
        src = e.get("as_source") or {}
        counts: Counter = Counter()
        for p in src.get("ports", []):
            if p.get("admin"):
                for d in DECISIONS:
                    counts[d] += (p.get("policy") or {}).get(d, 0)
        ev = (e.get("profile_evidence") or {}).get("admin_reach") or {}
        m = mix(counts)
        b = scale(src.get("peer_workloads", e.get("peer_workloads", 0)), (2, 5, 10, 25))
        ease = clamp(ease_base(m))
        lines.append({
            "class": "X1", "kind": "override_deny", "score": b * ease, "blast_radius": b, "ease": ease,
            "title": f"unknown source {e['ip']}{' (' + e['fqdn'] + ')' if e.get('fqdn') else ''} on "
                     f"{', '.join(ev.get('admin_ports') or [])}",
            "ip": e["ip"], "fqdn": e.get("fqdn"), "address_class": e.get("address_class"),
            "ip_lists": e.get("ip_lists") or [], "admin_ports": ev.get("admin_ports") or [], "profile": e.get("profile") or [],
            "allowed_connections": ev.get("allowed_connections", 0),
            "allowed_into_enforced": src.get("allowed_into_enforced", 0),
            "peer_workloads": src.get("peer_workloads", 0), "peers_enforced": e.get("peers_enforced", 0),
            "peer_apps": src.get("peer_apps") or [], "would_have_blocked": m,
            "evidence": [f"find-unknown-endpoints endpoints[ip={e['ip']}].profile_evidence.admin_reach",
                         f"as_source.ports admin rows ({src.get('connections', 0)} connections as source)"],
            "rollback": "delete the override deny rule from the draft ruleset",
        })
    return sorted(lines, key=lambda l: (-l["score"], -sum(l["would_have_blocked"][d] for d in DECISIONS)))


def x3_public_sources(unknown: dict | None, x1_ips: set) -> list[dict]:
    lines = []
    for e in (unknown or {}).get("endpoints", []):
        src = e.get("as_source")
        if e.get("address_class") != "public" or not src:
            continue
        non_admin = [p for p in src.get("ports", []) if not p.get("admin")]
        if e["ip"] in x1_ips and not non_admin:
            continue
        ports = [f"{p['port']}/{proto_name(p.get('proto'))}" for p in non_admin]
        lines.append({
            "class": "X3", "kind": "watch", "ip": e["ip"], "fqdn": e.get("fqdn"),
            "likely_provider": e.get("likely_provider"), "ip_lists": e.get("ip_lists") or [],
            "ports": ports, "peer_workloads": src.get("peer_workloads", 0),
            "peer_apps": src.get("peer_apps") or [], "allowed_into_enforced": src.get("allowed_into_enforced", 0),
            "policy": {d: (src.get("policy") or {}).get(d, 0) for d in DECISIONS},
            "blast_radius": scale(src.get("peer_workloads", 0), (2, 5, 10, 25)),
            "also_x1": e["ip"] in x1_ips,
            "evidence": [f"find-unknown-endpoints endpoints[ip={e['ip']}].as_source"],
        })
    return sorted(lines, key=lambda l: (-l["allowed_into_enforced"], -l["peer_workloads"]))


def x2_env_crossings(admin: dict | None, prod: list[str], rs: dict | None = None) -> list[dict]:
    """Grouped get-traffic-flows rows: src_app, src_env, dst_app, dst_env, port, proto,
    policy_decision, num_connections. Only admin ports, only rows with both envs labelled."""
    groups: dict[tuple, dict] = {}
    for row in split_rows(admin):
        a = (str(row.get("src_app")), str(row.get("src_env"))) if row.get("src_app") and row.get("src_env") else None
        b = (str(row.get("dst_app")), str(row.get("dst_env"))) if row.get("dst_app") and row.get("dst_env") else None
        try:
            port, proto = int(row.get("port")), proto_name(row.get("proto"))
        except (TypeError, ValueError):
            continue
        if not a or not b or a[1] == b[1] or (port, proto) not in ADMIN_SET:
            continue
        n = int(row.get("num_connections") or 0)
        dec = row.get("policy_decision") or "unknown"
        g = groups.setdefault((a[1], b[1]), {"counts": Counter(), "pairs": Counter(), "dst_apps": set(), "src_apps": set(),
                                             "ports": Counter(), "port_mix": defaultdict(Counter)})
        g["counts"][dec] += n
        g["pairs"][(f"{a[0]} ({a[1]})", f"{b[0]} ({b[1]})", dec)] += n
        g["dst_apps"].add(b)
        g["src_apps"].add(a)
        g["ports"][f"{port}/{proto}"] += n
        g["port_mix"][f"{port}/{proto}"][dec] += n
    lines = []
    for (src_env, dst_env), g in groups.items():
        m = mix(g["counts"])
        b = scale(len(g["dst_apps"]), (2, 3, 5, 10))
        ease = clamp(ease_base(m) + 1)
        seen_ports = g["ports"]
        lines.append({
            "class": "X2", "kind": "deny", "score": b * ease, "blast_radius": b, "ease": ease,
            "title": f"admin ports env={src_env} -> env={dst_env}" + (" (production)" if dst_env in prod else ""),
            "src_env": src_env, "dst_env": dst_env, "to_production": dst_env in prod,
            "dst_apps": sorted(f"{a} ({e})" for a, e in g["dst_apps"]),
            "src_apps": sorted(f"{a} ({e})" for a, e in g["src_apps"]),
            "ports_seen": [f"{p} ({n}: {', '.join(f'{d} {c}' for d, c in g['port_mix'][p].items())})" for p, n in seen_ports.most_common(8)],
            "ports": sorted(seen_ports, key=lambda x: int(x.split('/')[0])),
            "app_pairs": [{"from": f, "to": t, "policy": p, "connections": n}
                          for (f, t, p), n in sorted(g["pairs"].items(), key=lambda kv: -kv[1])[:10]],
            "would_have_blocked": m, "admitting_rules": admitting_rules(rs, src_env, dst_env) if m["allowed"] else [],
            "evidence": [f"admin-port flows rows env={src_env} -> env={dst_env} ({len(g['pairs'])} app pairs, {len(seen_ports)} ports)"],
            "rollback": "delete the deny rule from the draft ruleset",
        })
    return sorted(lines, key=lambda l: (-l["to_production"], -l["score"]))


def admitting_rules(rs: dict | None, src_env: str, dst_env: str) -> list[str]:
    """Allow rules that could admit env=src_env -> env=dst_env: consumer names that env,
    all workloads or an IP list, and the ruleset is scoped to dst_env or the provider names it."""
    out = []
    for r in (rs or {}).get("rulesets", []):
        scoped_dst = any(any(isinstance(x, dict) and x.get("key") == "env" and x.get("value") == dst_env for x in scope)
                         for scope in (r.get("scopes") or []))
        for rule in r.get("rules", []):
            if rule.get("rule_type") != "allow":
                continue
            cons = [actor_text(a) for a in rule.get("consumers", [])]
            provs = [actor_text(a) for a in rule.get("providers", [])]
            c_ok = any(c in (f"env={src_env}", "all workloads") or c.startswith("iplist:") for c in cons)
            p_ok = scoped_dst or any(pv in (f"env={dst_env}", "all workloads") for pv in provs)
            if c_ok and p_ok:
                out.append(f"{r.get('name')}: {', '.join(cons)} -> {', '.join(provs)} on {', '.join(service_text(x) for x in rule.get('ingress_services', []))}")
    return out[:5]


def inbound_remotes(summary: dict | None, app: tuple) -> dict:
    """Inbound remote apps for a ringfence allow list, from the estate app_to_app rows."""
    remotes: dict[str, Counter] = defaultdict(Counter)
    unlabelled: Counter = Counter()
    for row in (summary or {}).get("app_to_app", []):
        if parse_identity(row.get("to")) != app:
            continue
        src = parse_identity(row.get("from"))
        (remotes[row["from"]] if src else unlabelled)[row.get("policy")] += row.get("connections", 0)
    items = [{"from": k, "connections": sum(c.values()), "coverage": "already_allowed" if set(c) <= {"allowed"} else "newly_allowed",
              "policy": {d: c.get(d, 0) for d in DECISIONS}} for k, c in remotes.items()]
    items.sort(key=lambda i: -i["connections"])
    total = Counter()
    for c in remotes.values():
        total.update(c)
    return {"remote_apps": items, "already_allowed": sum(1 for i in items if i["coverage"] == "already_allowed"),
            "no_rule_possible": {"connections": sum(unlabelled.values()), "policy": {d: unlabelled.get(d, 0) for d in DECISIONS}},
            "inbound_mix": mix(total)}


def ringfence_lines(lateral: dict | None, wl: dict, summary: dict | None, policy: dict) -> list[dict]:
    reasons: dict[tuple, dict] = {}
    for n in (lateral or {}).get("high_risk_bridge_nodes", []):
        key = (str(n.get("app")), str(n.get("env")))
        reasons.setdefault(key, {})["bridge"] = {"reachable_apps": n.get("reachable_apps", 0),
                                                 "direct_connections_in": n.get("direct_connections_in"),
                                                 "direct_connections_out": n.get("direct_connections_out")}
    inbound_denied: dict[tuple, int] = Counter()
    for row in (summary or {}).get("app_to_app", []):
        to = parse_identity(row.get("to"))
        if to and row.get("policy") in DENIED:
            inbound_denied[to] += row.get("connections", 0)
    for key, a in wl["apps"].items():
        loose = a["modes"].get("visibility_only", 0) + a["modes"].get("idle", 0)
        if loose and inbound_denied.get(key):
            reasons.setdefault(key, {})["visibility"] = {"workloads_not_enforcing": loose,
                                                         "denied_inbound_connections": inbound_denied[key]}
    lines = []
    for key, why in reasons.items():
        app = wl["apps"].get(key, {"workloads": 0, "modes": Counter()})
        rem = inbound_remotes(summary, key)
        b = max(scale(why.get("bridge", {}).get("reachable_apps", 0), (2, 3, 6, 11)) if "bridge" in why else 1,
                scale(app["workloads"], (2, 5, 10, 25)) if "visibility" in why else 1)
        nr = rem["no_rule_possible"]
        base = ease_base(mix(nr["policy"])) if nr["connections"] else 4
        ease = clamp(base + (1 if key in policy["scoped"] else 0) - 1)
        classes = [c for c, k in (("X4", "bridge"), ("X5", "visibility")) if k in why]
        lines.append({
            "class": "+".join(classes), "kind": "ringfence", "score": b * ease, "blast_radius": b, "ease": ease,
            "title": f"selective ringfence {key[0]} ({key[1]}), deny_consumer any", "app": key[0], "env": key[1],
            "why": why, "workloads": app["workloads"], "enforcement": dict(app["modes"]),
            "already_fenced": key in policy["fenced"], "scoped_rulesets": policy["scoped"].get(key, []),
            "allow_list": rem, "would_have_blocked": rem["no_rule_possible"]["policy"] | {"denied_share": None},
            "evidence": [f"detect-lateral-movement-paths high_risk_bridge_nodes[{key[0]}|{key[1]}]" if "bridge" in why else None,
                         f"get-workloads rows app={key[0]} env={key[1]} ({app['workloads']} workloads)",
                         f"estate summary app_to_app rows to {key[0]} ({key[1]})"],
            "rollback": "delete the RF- ruleset from the draft; workloads stay in their current enforcement mode",
        })
        lines[-1]["evidence"] = [e for e in lines[-1]["evidence"] if e]
    return sorted(lines, key=lambda l: -l["score"])


def x6_identities(ident: dict | None) -> list[dict]:
    lines = []
    by_name = {i.get("identity"): i for i in (ident or {}).get("identities", [])}
    for f in (ident or {}).get("findings", []):
        if f.get("class") != "interactive" or f.get("interest") != "review":
            continue
        i = by_name.get(f.get("identity"), {})
        ports = []
        for p in i.get("ports", []):
            port, _, proto = str(p).partition("/")
            try:
                ports.append((int(port), proto_name(int(proto) if proto.isdigit() else proto)))
            except ValueError:
                continue
        admin = [f"{p}/{pr}" for p, pr in ports if (p, pr) in ADMIN_SET]
        lines.append({
            "class": "X6", "kind": "watch", "identity": f.get("identity"), "why": f.get("why_surfaced") or [],
            "observed_on_workloads": f.get("observed_on_workloads"), "distinct_apps": f.get("distinct_apps"),
            "connections": f.get("connections"), "admin_ports": admin,
            "blast_radius": scale(f.get("distinct_apps") or 0, (2, 3, 5, 10)),
            "evidence": [f"build-identity-graph findings[identity={f.get('identity')}]"],
        })
    return sorted(lines, key=lambda l: (-l["blast_radius"], -(l["connections"] or 0)))


def crown_jewels(given: list[tuple], ringfences: list[dict], prod: list[str]) -> tuple[list[tuple], str]:
    if given:
        return given, "given by the user"
    bridges = sorted((l for l in ringfences if "bridge" in l["why"] and l["env"] in prod),
                     key=lambda l: -l["why"]["bridge"]["reachable_apps"])
    return [(l["app"], l["env"]) for l in bridges[:3]], "defaulted to the three production bridge apps with the largest reach"


# ------------------------------------------------------------------- baseline

def baseline(t: dict | None) -> dict:
    if not t:
        return {"available": False}
    series = t.get("series", [])
    flows = [s.get("flows", 0) for s in series]
    nonzero = sorted(f for f in flows if f)
    median = nonzero[len(nonzero) // 2] if nonzero else 0
    sp = t.get("spikes") or {}
    return {"available": True, "bucket": t.get("bucket"), "effective_bucket": t.get("effective_bucket"),
            "days": len(series), "total_flows": sum(flows), "median_nonzero": median,
            "worst": None if sp.get("caveat") else sp.get("worst"), "caveat": sp.get("caveat"),
            "truncated": (t.get("totals") or {}).get("flows_truncated", False)}


# ------------------------------------------------------------------ call plans

def call_plans(p: dict) -> list[dict]:
    rs = p["ruleset_name"]
    plans = []
    x1_groups = [("today", [l for l in p["buckets"]["today"] if l["class"] == "X1"], ""),
                 ("week", [l for l in p["buckets"]["week"] if l["class"] == "X1"], "-review")]
    for bucket, x1, suffix in x1_groups:
        if not x1:
            continue
        list_name = f"RRR-unknown-admin-sources-{p['date']}{suffix}"
        plans.append({"for": f"X1 ({bucket})", "tool": "create-iplist", "DO_NOT_CALL": "draft for review", "name": list_name,
                      "description": "Unknown (non-workload) sources seen on admin ports; rapid risk reduction"
                                     + ("; these admit allowed traffic, review before the deny" if suffix else ""),
                      "ip_ranges": [{"from_ip": l["ip"], "description": l.get("fqdn") or "unknown source"} for l in x1]})
    if any(l["class"] in ("X1", "X2") for l in p["lines"]):
        if p["policy"]["rrr_rulesets"]:
            plans.append({"for": "ruleset", "tool": None, "DO_NOT_CALL": "nothing to call",
                          "_notes": f"draft ruleset {rs} already exists; the deny rules below target it"})
        else:
            plans.append({"for": "ruleset", "tool": "create-ruleset", "DO_NOT_CALL": "draft for review", "name": rs,
                          "description": f"Rapid risk reduction drafts {p['date']}; unscoped (scopes: [] = all workloads)",
                          "scopes": []})
    for bucket, x1, suffix in x1_groups:
        if not x1:
            continue
        list_name = f"RRR-unknown-admin-sources-{p['date']}{suffix}"
        ports = sorted({ap for l in x1 for ap in l["admin_ports"]})
        plans.append({"for": f"X1 ({bucket})", "tool": "create-deny-rule", "DO_NOT_CALL": "draft for review", "ruleset_name": rs,
                      "consumers": [f"iplist:{list_name}"], "providers": ["ams"],
                      "ingress_services": [{"port": int(ap.split('/')[0]), "proto": ap.split('/')[1]} for ap in ports],
                      "override_deny": True, "unscoped_consumers": True,
                      "_notes": {"why_override": "incident-grade block: must hold even where an allow rule admits the source",
                                 "would_have_blocked": {d: sum(l["would_have_blocked"][d] for l in x1) for d in DECISIONS}}})
    for l in p["lines"]:
        if l["class"] == "X2":
            plans.append({"for": f"X2 {l['src_env']}->{l['dst_env']}", "tool": "create-deny-rule", "DO_NOT_CALL": "draft for review",
                          "ruleset_name": rs, "consumers": [f"env={l['src_env']}"], "providers": [f"env={l['dst_env']}"],
                          "ingress_services": [{"port": int(ps.split('/')[0]), "proto": ps.split('/')[1]} for ps in l["ports"]],
                          "override_deny": False, "unscoped_consumers": True,
                          "_notes": {"enforced_on": f"managed workloads carrying env={l['src_env']} in selective or full enforcement",
                                     "would_have_blocked": l["would_have_blocked"], "admitting_rules": l.get("admitting_rules", [])}})
    for l in p["lines"]:
        if l["kind"] == "ringfence":
            base = {"app_name": l["app"], "env_name": l["env"], "lookback_days": p["window_days"]}
            plans.append({"for": f"{l['class']} {l['app']} ({l['env']})", "tool": "create-ringfence",
                          "DO_NOT_CALL": "the user's preview call, never this skill's", **base, "dry_run": True})
            plans.append({"for": f"{l['class']} {l['app']} ({l['env']})", "tool": "create-ringfence", "DO_NOT_CALL": "draft for review",
                          **base, "dry_run": False, "selective": True, "deny_consumer": "any",
                          "ruleset_name": f"RF-{l['app']}-{l['env']}",
                          "_notes": "allow rules for every observed inbound remote app with app and env labels; unlabelled and IP-list sources get no allow and hit the deny"})
    for app, env in p["crown_jewels"]:
        name = f"EMERGENCY-ISOLATE-{app}-{env}"
        plans.append({"for": f"CJ {app} ({env})", "runbook": name, "DO_NOT_CALL": "run only on a confirmed incident", "steps": [
            {"tool": "get-labels", "key": "app", "value": app}, {"tool": "get-labels", "key": "env", "value": env},
            {"tool": "create-ruleset", "name": name, "scopes": [[{"key": "app", "value": app}, {"key": "env", "value": env}]]},
            {"tool": "create-deny-rule", "ruleset_name": name, "providers": ["ams"], "consumers": ["ams", f"iplist:{ANY_LIST}"],
             "ingress_services": [{"service": "All Services"}], "override_deny": True, "unscoped_consumers": True,
             "effect": "all inbound to the app stops, allow rules included"},
            {"tool": "create-ruleset", "name": f"{name}-outbound", "scopes": [], "optional": True,
             "note": "outbound needs an unscoped ruleset: consumers are the app's labels, providers ams and Any"},
            {"tool": "create-deny-rule", "ruleset_name": f"{name}-outbound", "optional": True,
             "consumers": [f"app={app}", f"env={env}"], "providers": ["ams", f"iplist:{ANY_LIST}"],
             "ingress_services": [{"service": "All Services"}], "override_deny": True, "unscoped_consumers": True},
            {"tool": "provision-policy", "note": "the only step that changes enforcement"},
            {"undo": f"delete the override deny rules (delete-deny-rule) and the rulesets, then provision-policy again"},
        ]})
    return plans


# --------------------------------------------------------------------- outputs

def wb_text(m: dict) -> str:
    return f"{m.get('allowed', 0)}/{m.get('potentially_blocked', 0)}/{m.get('blocked', 0)}"


def line_text(l: dict) -> str:
    radius = {"X1": f"{l.get('peer_workloads', 0)} workloads, {l.get('peers_enforced', 0)} enforced",
              "X2": f"{len(l.get('dst_apps', []))} destination apps"}.get(l["class"], None)
    wb = f"would have blocked {wb_text(l['would_have_blocked'])} (allowed/potentially blocked/blocked)"
    if l["kind"] == "ringfence":
        radius = (f"reaches {l['why']['bridge']['reachable_apps']} apps, " if "bridge" in l["why"] else "") + f"{l['workloads']} workloads"
        wb = f"deny would catch {wb_text(l['would_have_blocked'])} (allowed/potentially blocked/blocked) from sources with no allow rule"
    return (f"**{l['score']}** | {l['class']} {l['title']} | blast radius {l['blast_radius']} ({radius}) | "
            f"{wb} | evidence: {'; '.join(l['evidence'])} | rollback: {l['rollback']}")


def modes_text(modes: dict) -> str:
    return ", ".join(f"{k} {v}" for k, v in sorted(modes.items())) or "no workloads"


def details(l: dict) -> list[str]:
    if l["class"] == "X1":
        return [f"  - override deny on purpose; source {l['ip']}{' ' + l['fqdn'] if l.get('fqdn') else ''} is {l['address_class']}, "
                f"lists: {', '.join(l['ip_lists']) or 'none'}, profile: {', '.join(l.get('profile') or [])}; allowed into enforced workloads: {l['allowed_into_enforced']}; "
                f"peer apps: {', '.join(l['peer_apps'][:6])}"
                + (f"; {l['would_have_blocked']['allowed']} allowed connections would stop: confirm admin access from this source may end" if l["would_have_blocked"]["allowed"] and l["ease"] < 4 else "")]
    if l["class"] == "X2":
        return [f"  - ports seen: {', '.join(l['ports_seen'])}; app pairs: " + "; ".join(f"{a['from']} -> {a['to']} {a['policy']} {a['connections']}" for a in l["app_pairs"][:5])
                + (f"; {l['would_have_blocked']['allowed']} allowed connections would stop: confirm they may, admitted by: "
                   + ("; ".join(l.get("admitting_rules") or []) or "no allow rule found naming these envs (a broader rule or an IP list)") if l["would_have_blocked"]["allowed"] and l["ease"] < 4 else "")]
    al = l["allow_list"]
    why = " and ".join(filter(None, [f"bridge reaching {l['why']['bridge']['reachable_apps']} apps" if "bridge" in l["why"] else "",
                                    f"{l['why']['visibility']['workloads_not_enforcing']} workloads not enforcing with {l['why']['visibility']['denied_inbound_connections']} denied inbound connections" if "visibility" in l["why"] else ""]))
    return [f"  - why: {why}; enforcement: {modes_text(l['enforcement'])}; allow list: {len(al['remote_apps'])} remote apps, {al['already_allowed']} already allowed"
            + ("; no inbound app traffic observed, so the fence denies all inbound" if not al["remote_apps"] else "")
            + f"; no rule possible for {al['no_rule_possible']['connections']} connections from unlabelled or IP-list sources (they hit the deny)"
            + ("; already fenced in draft, review that ruleset instead" if l["already_fenced"] else "")
            + (f"; scoped rulesets: {', '.join(l['scoped_rulesets'])}" if l["scoped_rulesets"] else "")]


def write_plan_md(path: pathlib.Path, p: dict) -> None:
    L = [f"# Rapid risk reduction plan, {p['date']}: {p['window'].get('start') or '?'} to {p['window'].get('end') or '?'}\n"]
    L.append(f"Production environments: {', '.join(p['production_envs']) or 'none identified (pass --prod-env)'}.")
    L.append(f"Crown jewels: {', '.join(f'{a} ({e})' for a, e in p['crown_jewels']) or 'none'} ({p['crown_jewels_source']}).")
    caps = [k for k, v in p["truncated"].items() if v]
    L.append(f"Inputs read: {', '.join(k for k, v in p['inputs'].items() if v)}; missing: {', '.join(k for k, v in p['inputs'].items() if not v) or 'none'}.")
    L.append("Counts are lower bounds on: " + ", ".join(caps) + "." if caps else "No query hit its cap.")
    L.append(f"Draft ruleset: `{p['ruleset_name']}`" + (f" (already exists in draft: {', '.join(p['policy']['rrr_rulesets'])})" if p['policy']['rrr_rulesets'] else "") + ". Nothing below is provisioned. Every rule is a draft to review; rollback is deleting it from the draft.")
    b = p["buckets"]
    L.append(f"\n{len(p['lines'])} exposures with a draft fix: {len(b['today'])} to block today, {len(b['week'])} to fence this week, "
             f"{len(p['crown_jewels'])} isolation runbooks, {len(p['watch'])} to watch.\n")
    L.append("## 1. Block today")
    for l in b["today"]:
        L.append(f"- {line_text(l)}")
        L += details(l)
    if not b["today"]:
        L.append("- nothing qualifies: no deny with ease 4 or more")
    L.append("\n## 2. This week: fence, or deny after review")
    for l in b["week"]:
        L.append(f"- {line_text(l)}")
        L += details(l)
    if not b["week"]:
        L.append("- nothing")
    L.append("\n## 3. Isolate on demand")
    for app, env in p["crown_jewels"]:
        n = p["crown_jewel_workloads"].get(f"{app} ({env})", 0)
        L.append(f"- EMERGENCY-ISOLATE-{app}-{env} ({n} workloads in inventory{'; not found, check the label values' if not n else ''}): run only on a confirmed incident. get-labels -> create-ruleset scoped to the app -> "
                 f"create-deny-rule override_deny true, providers ams, consumers ams + Any, All Services, unscoped_consumers true -> "
                 f"(optional outbound rule in an unscoped ruleset) -> provision-policy. Effect: all traffic to the app stops, allows included. "
                 f"Undo: delete the override deny rules and provision again.")
    if not p["crown_jewels"]:
        L.append("- none found: no crown jewels given and no production bridge app; name one as app (env) and re-run")
    L.append("\n## 4. Watch")
    for l in p["watch"]:
        if l["class"] == "X3":
            L.append(f"- X3 public source {l['ip']}{' ' + l['fqdn'] if l.get('fqdn') else ''}{' (' + l['likely_provider'] + ')' if l.get('likely_provider') else ''} "
                     f"reaches {l['peer_workloads']} workloads on {', '.join(l['ports']) or 'admin ports only'}; allowed into enforced: {l['allowed_into_enforced']}; "
                     f"admitted by: {', '.join(l['ip_lists']) or 'no named list (the default Any list or a broad rule)'}" + ("; admin ports covered by the X1 override deny" if l["also_x1"] else ""))
        else:
            L.append(f"- X6 {l['identity']}: {'; '.join(l['why'])}; {l['observed_on_workloads']} workloads, {l['distinct_apps']} apps"
                     + (f"; admin ports {', '.join(l['admin_ports'])} (covered by X1/X2 denies where those apply)" if l["admin_ports"] else ""))
    if not p["watch"]:
        L.append("- nothing")
    L.append("\n## 5. Baseline")
    bl = p["baseline"]
    if bl.get("available"):
        L.append(f"Blocked and potentially blocked flows per {bl['effective_bucket'] or bl['bucket']} over {bl['days']} buckets: median {bl['median_nonzero']}, total {bl['total_flows']}"
                 + (" (capped; lower bound)" if bl.get("truncated") else "") + ".")
        if bl.get("caveat"):
            L.append(f"No spike quoted: {bl['caveat']}")
        elif bl.get("worst"):
            L.append(f"Worst spike: {bl['worst']['bucket_start']} with {bl['worst']['flows']} flows, {bl['worst']['multiple']}x the median.")
        else:
            L.append("No bucket above 3x the median.")
    else:
        L.append("No timeline saved; run get-traffic-timeline for the baseline.")
    rise = sum(l["would_have_blocked"].get("allowed", 0) + l["would_have_blocked"].get("potentially_blocked", 0) for l in b["today"] + b["week"] if l["kind"] != "ringfence")
    L.append(f"Re-run the timeline 7 days after provisioning: blocked rows should rise and potentially blocked fall, and nothing else should move. "
             f"The deny lines account for {rise} connections per window (the timeline counts flows, so compare direction, not magnitude).")
    L.append("\nCall plans: see call-plans.md (every block is DO_NOT_CALL).")
    path.write_text("\n".join(L) + "\n")


def write_call_plans(path: pathlib.Path, p: dict) -> None:
    L = [f"# Call plans for {p['ruleset_name']} (DO_NOT_CALL: drafts for review)\n",
         "Apply order: IP list, ruleset, deny rules, ringfence previews then ringfences, runbooks held in reserve. "
         "In every block, `for`, `tool`, `DO_NOT_CALL` and `_notes` are not parameters; everything else is the tool's input. "
         "Deny rules with a label consumer are enforced on the source workloads; with an IP-list consumer at the destination. "
         "A deny bites only in selective or full enforcement. Override deny beats every allow rule and is used only for X1 and the runbooks.\n"]
    for c in p["call_plans"]:
        L.append(f"## {c['for']}: {c.get('tool') or c.get('runbook')}")
        L.append("```json\n" + json.dumps(c, indent=1) + "\n```")
    L.append("After the user provisions anything, re-run this skill with the same window; lines whose rule is now active should show their traffic as blocked.")
    path.write_text("\n".join(L) + "\n")


# ------------------------------------------------------------------------ main

def parse_pair(text: str) -> tuple:
    kv = dict(item.split("=", 1) for item in text.split(",") if "=" in item)
    if not kv.get("app") or not kv.get("env"):
        sys.exit(f"--crown takes app=<name>,env=<env>, got {text!r}")
    return (kv["app"].strip(), kv["env"].strip())


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--scratch", type=pathlib.Path, required=True)
    ap.add_argument("--out", type=pathlib.Path, required=True)
    ap.add_argument("--prod-env", action="append", default=[], help="env label value treated as production (repeatable; default: values containing 'prod')")
    ap.add_argument("--crown", action="append", default=[], help="crown-jewel app as app=<name>,env=<env> (repeatable)")
    ap.add_argument("--window-days", type=int, default=30)
    ap.add_argument("--date", default=date.today().isoformat(), help="YYYY-MM-DD used in the draft ruleset name")
    a = ap.parse_args(argv)

    names = ("workloads", "summary", "admin_ports", "lateral", "unknown", "identities", "rulesets", "timeline")
    files = {n: a.scratch / f"{n}.json" for n in names}
    data = {n: load(f) for n, f in files.items()}
    if data["workloads"] is None:
        sys.exit(f"{files['workloads']} is required (get-workloads, compact, unfiltered)")

    cols = (data["workloads"] or {}).get("columns") or []
    if cols and not {"app", "env"} <= set(cols):
        sys.exit("workloads.json has no app/env label columns; X2, X4, X5 and the ringfence allow lists need app and env labels")
    wl = workload_index(split_rows(data["workloads"]))
    prod = pick_prod_envs(a.prod_env, wl["envs"])
    policy = existing_policy(data["rulesets"])
    x1 = x1_unknown_admin(data["unknown"], policy)
    x2 = x2_env_crossings(data["admin_ports"], prod, data["rulesets"])
    fences = ringfence_lines(data["lateral"], wl, data["summary"], policy)
    x3 = x3_public_sources(data["unknown"], {l["ip"] for l in x1})
    x6 = x6_identities(data["identities"])
    jewels, jewels_src = crown_jewels([parse_pair(c) for c in a.crown], fences, prod)

    lines = sorted(x1 + x2 + fences, key=lambda l: -l["score"])
    today = [l for l in lines if l["kind"] in ("deny", "override_deny") and l["ease"] >= 4]
    week = [l for l in lines if l not in today]
    wl_env = data["workloads"] or {}
    truncated = {
        "workloads": bool(wl_env.get("truncated")) or wl_env.get("total", 0) >= 10000,
        "summary": bool(((data["summary"] or {}).get("totals") or {}).get("truncated")),
        "admin_ports": bool((data["admin_ports"] or {}).get("truncated")) or int((data["admin_ports"] or {}).get("total_pce_flows") or 0) >= 500,
        "unknown": bool(((data["unknown"] or {}).get("totals") or {}).get("flows_truncated")),
        "timeline": bool(((data["timeline"] or {}).get("totals") or {}).get("flows_truncated")),
    }
    plan = {
        "date": a.date, "ruleset_name": f"RRR-{a.date}", "window_days": a.window_days,
        "window": (data["summary"] or data["unknown"] or data["timeline"] or {}).get("window") or {},
        "inputs": {n: f.exists() for n, f in files.items()}, "truncated": truncated,
        "production_envs": prod, "crown_jewels": jewels, "crown_jewels_source": jewels_src,
        "crown_jewel_workloads": {f"{a} ({e})": wl["apps"].get((a, e), {}).get("workloads", 0) for a, e in jewels},
        "policy": {"policy_version": policy["policy_version"], "rrr_rulesets": policy["rrr_rulesets"],
                   "deny_rules": policy["deny_rules"],
                   "scoped": {f"{a} ({e})": v for (a, e), v in policy["scoped"].items()},
                   "fenced": sorted(f"{a} ({e})" for a, e in policy["fenced"])},
        "lines": lines, "buckets": {"today": today, "week": week}, "watch": x3 + x6,
        "baseline": baseline(data["timeline"]),
    }
    plan["call_plans"] = call_plans(plan)
    a.out.mkdir(parents=True, exist_ok=True)
    (a.out / "plan.json").write_text(json.dumps(plan, indent=1, default=str))
    write_plan_md(a.out / "plan.md", plan)
    write_call_plans(a.out / "call-plans.md", plan)
    missing = [n for n, ok in plan["inputs"].items() if not ok]
    print(f"wrote {a.out / 'plan.json'}, plan.md, call-plans.md: {len(today)} today, {len(week)} this week, "
          f"{len(jewels)} runbooks, {len(plan['watch'])} watch" + (f"; missing inputs: {', '.join(missing)}" if missing else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
