#!/usr/bin/env python3
"""Grade an estate on the readiness ladder from a rapid-risk-reduction run and write
the CISO report, its json and the dashboard.

Mythos readiness is how contained a breach stays when the attacker is an autonomous AI
agent that finds a foothold, exploits and moves laterally at machine speed, with no
human in the loop. Controls that need a person to notice count for little; controls
in force today count. The ladder (references/ladder.md) has six levels, 0 Unseen to
5 Contained, graded per app (env) from what the rapid-risk-reduction run saved.

Inputs:
  <rrr>/plan.json          written by illumio-rapid-risk-reduction/scripts/triage.py
  <scratch>/workloads.json get-workloads, compact, unfiltered (the RRR scratch copy)
  <scratch>/lateral.json   detect-lateral-movement-paths (optional; without it the
                           not_a_bridge gate is unknown and no app can reach level 5)

Outputs (<out>/): readiness.json, readiness.md and dashboard.jsx (the template in
references/ with its DATA block replaced; skipped with a note when the template is
not there yet).

The script reads files only. It never calls the PCE and never writes to it.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone

# ------------------------------------------------------------------ the ladder

LADDER = [
    {"level": 0, "name": "Unseen", "gates": [], "attacker": "we would not know", "human_dependent": True,
     "takes": "nothing is known or nothing is enforced; the gates of level 1 fail"},
    {"level": 1, "name": "Seen", "gates": ["labelled", "managed"], "attacker": "we would know afterwards", "human_dependent": True,
     "takes": "app and env labels on every workload, and a VEN on every workload"},
    {"level": 2, "name": "Planned", "gates": ["policy_written"], "attacker": "we have rules; nothing stops it yet", "human_dependent": True,
     "takes": "a provisioned ruleset scoped to the app, or every workload in full enforcement"},
    {"level": 3, "name": "Enforcing", "gates": ["enforcing", "fenced_if_selective"], "attacker": "the attacker meets rules", "human_dependent": False,
     "takes": "every workload in selective or full enforcement; selective ones behind a provisioned deny"},
    {"level": 4, "name": "Doors shut", "gates": ["no_unknown_admin", "no_cross_env_admin"], "attacker": "the easy ways in are closed", "human_dependent": False,
     "takes": "no unknown source allowed in on admin ports; no admin-port crossing from another environment allowed in"},
    {"level": 5, "name": "Contained", "gates": ["full_enforcement", "no_unmanaged_inbound", "not_a_bridge", "no_wide_reach_account"],
     "attacker": "a breach stays where it landed", "human_dependent": False,
     "takes": "every workload in full enforcement; nothing unmanaged allowed in; not a bridge; no wide-reach account seen in it"},
]
LEVEL_NAME = {l["level"]: l["name"] for l in LADDER}
GATE_LEVEL = {g: l["level"] for l in LADDER for g in l["gates"]}
GATE_IDS = [g for l in LADDER for g in l["gates"]]

GATE_TEXT = {
    "labelled": "app and env labels on every workload",
    "managed": "a VEN on every workload (managed)",
    "policy_written": "a provisioned ruleset scoped to the app, or every workload in full enforcement",
    "enforcing": "every workload in selective or full enforcement",
    "fenced_if_selective": "when any workload is in selective enforcement, a provisioned ruleset scoped to the app with a deny to all its workloads (selective enforces deny rules only)",
    "no_unknown_admin": "no unknown source reaches the app on admin ports with connections reported allowed (counted per source, not per app)",
    "no_cross_env_admin": "no admin-port traffic from another environment into the app is reported allowed",
    "full_enforcement": "every workload in full enforcement (default deny with allow rules)",
    "no_unmanaged_inbound": "no allowed connection into the app from an unlabelled workload or an external address",
    "not_a_bridge": "not a bridge in the lateral-movement graph and not reaching three quarters of its apps (the top-20 list is capped, so a lower bound)",
    "no_wide_reach_account": "no review-flagged account seen reaching into the app (a lower bound: top 10 destinations per account)",
}
# gate -> (kind on fail, kind on unknown)
KIND_OF = {
    "labelled": ("label", "label"), "managed": ("pair_ven", "pair_ven"), "policy_written": ("write_policy", "write_policy"),
    "enforcing": ("move_enforcement", "move_enforcement"), "fenced_if_selective": ("provision_deny", "provision_deny"),
    "no_unknown_admin": ("block_unknown", "block_unknown"), "no_cross_env_admin": ("deny_crossing", "deny_crossing"),
    "full_enforcement": ("move_enforcement", "move_enforcement"), "no_unmanaged_inbound": ("narrow_inbound", "narrow_inbound"),
    "not_a_bridge": ("ringfence", "check_reach"), "no_wide_reach_account": ("review_account", "review_account"),
}
KIND_LABEL = {
    "label": "Label", "pair_ven": "Pair a VEN", "write_policy": "Write policy", "move_enforcement": "Move enforcement",
    "provision_deny": "Provision the deny", "block_unknown": "Block unknown admin sources", "deny_crossing": "Deny environment crossings",
    "narrow_inbound": "Narrow unmanaged inbound", "ringfence": "Ringfence", "review_account": "Review accounts", "check_reach": "Check reach",
}
# gate -> the RRR input file its evidence comes from; unread means the gate is unknown
EVIDENCE_INPUT = {"no_unknown_admin": "unknown", "no_cross_env_admin": "admin_ports",
                  "no_unmanaged_inbound": "summary", "no_wide_reach_account": "identities"}
SEMANTICS = [
    "Selective enforcement enforces deny rules only; a selective workload with no deny reaching it stops nothing.",
    "Full enforcement is default deny with allow rules.",
    "A provisioned ruleset on a visibility-only workload changes nothing.",
    "A drafted rule changes nothing until it is provisioned.",
    "Labels are never assumed complete; unlabelled workloads are counted, not guessed.",
    "Nothing in this skill writes to the PCE.",
]
DEFINITION = ("Mythos readiness is how contained a breach stays when the attacker is an autonomous AI agent that finds a foothold, "
              "exploits and moves laterally at machine speed, with no human in the loop.")
MODES = ("full", "selective", "visibility_only", "idle")
ENFORCING = ("selective", "full")
WIDE_REACH = 0.75
TOP_CAP = 20
MARK_START, MARK_END = "// ===== DATA START =====", "// ===== DATA END ====="
UNLABELLED = "unlabelled"


# ------------------------------------------------------------------------- io

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


def label_value(v):
    """None, '' and '-' (the server's marker for an unlabelled side) are missing."""
    s = str(v).strip() if v is not None else ""
    return s if s and s != "-" else None


def key_of(app: str, env: str) -> str:
    return f"{app} ({env})"


def plural(n: int, word: str) -> str:
    return f"{n} {word}{'' if n == 1 else 's'}"


# -------------------------------------------------------------------- inventory

def group_workloads(rows: list[dict]) -> tuple[dict, dict]:
    """App rows keyed by 'app (env)' plus the one unlabelled row."""
    apps: dict[str, dict] = {}
    unl = {"app": UNLABELLED, "env": None, "key": UNLABELLED, "workloads": 0, "managed": 0, "modes": Counter(), "hosts": []}
    for r in rows:
        app, env = label_value(r.get("app")), label_value(r.get("env"))
        mode = str(r.get("enforcement_mode") or "unknown")
        managed = bool(r.get("managed"))
        if app and env:
            a = apps.setdefault(key_of(app, env), {"app": app, "env": env, "key": key_of(app, env), "workloads": 0, "managed": 0,
                                                    "modes": Counter(), "hosts": []})
        else:
            a = unl
        a["workloads"] += 1
        a["managed"] += managed
        a["modes"][mode] += 1
        a["hosts"].append(str(r.get("hostname") or r.get("name") or r.get("href") or "?"))
    return apps, unl


def enforcement_of(modes: Counter) -> dict:
    out = {m: modes.get(m, 0) for m in MODES}
    for m, c in modes.items():
        if m not in out:
            out[m] = c
    return out


def not_enforcing(modes: Counter) -> int:
    return sum(c for m, c in modes.items() if m not in ENFORCING)


def modes_text(modes: Counter) -> str:
    return ", ".join(f"{m} {c}" for m, c in sorted(modes.items(), key=lambda kv: -kv[1])) or "none"


# ------------------------------------------------------------------------ gates

def gate(state: str, reason: str = "") -> dict:
    return {"state": state, "reason": reason}


def g_managed(a: dict) -> dict:
    n = a["workloads"] - a["managed"]
    return gate("pass") if n == 0 else gate("fail", f"{n} of {a['workloads']} workloads are not managed (no VEN paired)")


def g_policy_written(a: dict, policy: dict) -> dict:
    scoped = policy.get("scoped", {}).get(a["key"]) or []
    off = a["workloads"] - a["modes"].get("full", 0)
    if scoped or off == 0:
        return gate("pass")
    return gate("fail", f"no provisioned ruleset is scoped to {a['key']} and {off} of {a['workloads']} workloads are not in full enforcement")


def g_enforcing(a: dict) -> dict:
    m = a["modes"]
    vis, idle = m.get("visibility_only", 0), m.get("idle", 0)
    other = not_enforcing(m) - vis - idle
    if not_enforcing(m) == 0:
        return gate("pass")
    parts = []
    if vis:
        parts.append(f"{vis} of {a['workloads']} workloads in visibility_only" + (f" ({idle} idle)" if idle else ""))
    elif idle:
        parts.append(f"{idle} of {a['workloads']} workloads idle")
    if other:
        parts.append(f"{other} in a mode that is not selective or full ({modes_text(Counter({k: v for k, v in m.items() if k not in ENFORCING + ('visibility_only', 'idle')}))})")
    return gate("fail", "; ".join(parts))


def g_fenced(a: dict, policy: dict) -> dict:
    sel = a["modes"].get("selective", 0)
    if sel == 0 or a["key"] in (policy.get("fenced") or []):
        return gate("pass")
    return gate("fail", f"{sel} of {a['workloads']} workloads in selective enforcement, which enforces deny rules only, "
                        f"and no provisioned ruleset scoped to {a['key']} carries a deny to all its workloads")


def x1_hits(a: dict, lines: list[dict]) -> list[dict]:
    return [l for l in lines if l.get("class") == "X1" and a["key"] in (l.get("peer_apps") or []) and (l.get("allowed_connections") or 0) > 0]


def x1_reason(l: dict) -> str:
    return (f"source {l.get('ip')} reaches the app on {', '.join(l.get('admin_ports') or [])}; {l.get('allowed_connections', 0)} of its "
            f"admin-port connections are reported allowed across its {len(l.get('peer_apps') or [])} peer apps")


def g_no_unknown_admin(a: dict, lines: list[dict]) -> dict:
    hits = x1_hits(a, lines)
    return gate("pass") if not hits else gate("fail", "; ".join(x1_reason(l) for l in hits))


def x2_hits(a: dict, lines: list[dict]) -> list[tuple[dict, list[dict]]]:
    out = []
    for l in lines:
        if l.get("class") != "X2" or a["key"] not in (l.get("dst_apps") or []):
            continue
        pairs = [p for p in l.get("app_pairs") or [] if p.get("to") == a["key"] and p.get("policy") == "allowed"]
        if pairs:
            out.append((l, pairs))
    return out


def g_no_cross_env_admin(a: dict, lines: list[dict]) -> dict:
    hits = x2_hits(a, lines)
    if not hits:
        return gate("pass")
    parts = [f"admin ports from env={l.get('src_env')} into the app are reported allowed: "
             + ", ".join(f"{p['from']} {p.get('connections', 0)} connections" for p in pairs) for l, pairs in hits]
    return gate("fail", "; ".join(parts))


def g_full_enforcement(a: dict) -> dict:
    m = a["modes"]
    if m.get("full", 0) == a["workloads"]:
        return gate("pass")
    sel, off = m.get("selective", 0), not_enforcing(m)
    parts = []
    if sel:
        parts.append(f"{sel} of {a['workloads']} workloads in selective enforcement (deny rules only)")
    if off:
        parts.append(f"{off} of {a['workloads']} workloads not enforcing")
    return gate("fail", "; ".join(parts))


def g_no_unmanaged_inbound(row: dict | None) -> dict:
    n = (row or {}).get("unmanaged_inbound") or 0
    return gate("pass") if n == 0 else gate("fail", f"{n} allowed connections into the app from unlabelled or external sources in the window")


def g_not_a_bridge(a: dict, lateral: dict | None) -> dict:
    if lateral is None:
        return gate("unknown", "reach unknown: lateral.json missing")
    total = lateral.get("total_apps") or 0
    cut = WIDE_REACH * total
    for n in lateral.get("high_risk_bridge_nodes") or []:
        if key_of(str(n.get("app")), str(n.get("env"))) == a["key"]:
            return gate("fail", f"bridge in the lateral-movement graph, reaching {n.get('reachable_apps', 0)} apps")
    top = lateral.get("top_reachable_nodes") or []
    for n in top:
        if key_of(str(n.get("app")), str(n.get("env"))) == a["key"]:
            r = n.get("reachable_apps", 0)
            if total and r >= cut:
                return gate("fail", f"reaches {r} of {total} apps in the lateral-movement graph, at least three quarters")
            return gate("pass")
    if len(top) < TOP_CAP or not total or min(n.get("reachable_apps", 0) for n in top) < cut:
        return gate("pass")
    return gate("unknown", "reach unknown: the top-20 list is capped")


def g_no_wide_reach_account(row: dict | None) -> dict:
    n = (row or {}).get("wide_reach_accounts") or 0
    return gate("pass") if n == 0 else gate("fail", f"{plural(n, 'review-flagged account')} seen reaching into the app (a lower bound)")


def grade(gates: dict) -> int:
    level = 0
    for l in LADDER[1:]:
        if all(gates[g]["state"] == "pass" for g in l["gates"]):
            level = l["level"]
        else:
            break
    return level


def app_gates(a: dict, ctx: dict) -> dict:
    row = ctx["map_rows"].get(a["key"])
    gates = {
        "labelled": gate("pass"),
        "managed": g_managed(a),
        "policy_written": g_policy_written(a, ctx["policy"]),
        "enforcing": g_enforcing(a),
        "fenced_if_selective": g_fenced(a, ctx["policy"]),
        "no_unknown_admin": g_no_unknown_admin(a, ctx["lines"]),
        "no_cross_env_admin": g_no_cross_env_admin(a, ctx["lines"]),
        "full_enforcement": g_full_enforcement(a),
        "no_unmanaged_inbound": g_no_unmanaged_inbound(row),
        "not_a_bridge": g_not_a_bridge(a, ctx["lateral"]),
        "no_wide_reach_account": g_no_wide_reach_account(row),
    }
    for g, name in EVIDENCE_INPUT.items():
        if not ctx["rrr_inputs"].get(name, False):
            gates[g] = gate("unknown", f"not checked: {name}.json was not read by the rapid-risk-reduction run")
    return gates


def unlabelled_gates(unl: dict) -> dict:
    gates = {g: gate("unknown", "not graded: unlabelled") for g in GATE_IDS}
    gates["labelled"] = gate("fail", f"{unl['workloads']} workloads lack an app label, an env label or both")
    return gates


# ------------------------------------------------------------------- next steps

DEFAULT_LISTS: list = []  # plan.default_ip_lists, set in main; decides the X1 group heading


def call_plan_heading(l: dict) -> str:
    """The heading rapid-risk-reduction's call-plans.md gives the line's plan (its `for` key):
    X1 by group, X2 by environment pair, ringfences by class, app and env."""
    c = str(l.get("class") or "")
    if c == "X1":
        if l.get("address_class") != "public":
            g = "internal"
        elif [n for n in (l.get("ip_lists") or []) if n not in DEFAULT_LISTS]:
            g = "listed"
        else:
            g = "today" if l.get("bucket") == "today" else "review"
        return f"X1 ({g})"
    if c == "X2":
        return f"X2 {l.get('src_env')}->{l.get('dst_env')}"
    return f"{c} {l.get('app')} ({l.get('env')})"


def step(gate_id: str, reason: str, kind: str, sentence: str, bucket: str, rrr_lines: list[str] | None = None, line: dict | None = None) -> dict:
    titles = rrr_lines or []
    pointer = f"call-plans.md: {call_plan_heading(line)}" if line and titles and bucket != "plan" else None
    return {"gate": gate_id, "reason": reason, "kind": kind, "sentence": sentence, "bucket": bucket,
            "rrr_lines": titles, "call_plan": pointer}


def app_line(a: dict, lines: list[dict], classes: tuple) -> dict | None:
    for l in lines:
        if l.get("kind") == "ringfence" and l.get("app") == a["app"] and l.get("env") == a["env"] \
                and any(c in str(l.get("class", "")).split("+") for c in classes):
            return l
    return None


def steps_for(a: dict, gate_id: str, g: dict, ctx: dict) -> list[dict]:
    key, m, n = a["key"], a["modes"], a["workloads"]
    kind = KIND_OF[gate_id][0 if g["state"] == "fail" else 1]
    if g["state"] == "unknown" and g["reason"].startswith("not checked:"):
        name = EVIDENCE_INPUT[gate_id]
        return [step(gate_id, g["reason"], kind, f"save {name}.json from the rapid-risk-reduction run and grade {key} again; "
                                                 f"{GATE_TEXT[gate_id].split(' (')[0]} cannot be judged without it", "plan")]
    if gate_id == "labelled":
        return [step(gate_id, g["reason"], kind, f"label the {n} workloads without app and env; the illumio-label-advisor skill suggests values", "plan")]
    if gate_id == "managed":
        k = n - a["managed"]
        return [step(gate_id, g["reason"], kind, f"pair a VEN on the {plural(k, 'unmanaged workload')} of {key} so the PCE can see and enforce {'it' if k == 1 else 'them'}", "plan")]
    if gate_id == "policy_written":
        l = app_line(a, ctx["lines"], ("X4", "X5"))
        if l:
            return [step(gate_id, g["reason"], kind, f"write a ruleset scoped to {key}: the rapid-risk-reduction ringfence drafts it from the inbound apps seen "
                                                     f"and adds a deny to all its workloads", l["bucket"], [l["title"]], line=l)]
        return [step(gate_id, g["reason"], kind, f"write a ruleset scoped to {key} (allow rules for its inbound apps and a deny to all its workloads), "
                                                 f"or move all {n} workloads to full enforcement", "plan")]
    if gate_id == "enforcing":
        off = not_enforcing(m)
        l = app_line(a, ctx["lines"], ("X5",))
        names = " and ".join(k.replace("_", " ") for k, v in sorted(m.items(), key=lambda kv: -kv[1]) if k not in ENFORCING and v)
        s = f"move {off} of {n} workloads of {key} from {names} to selective or full enforcement"
        if l:
            return [step(gate_id, g["reason"], kind, s + ", once the ringfence is provisioned so the deny has something to hold", l["bucket"], [l["title"]], line=l)]
        return [step(gate_id, g["reason"], kind, s, "plan")]
    if gate_id == "fenced_if_selective":
        sel = m.get("selective", 0)
        l = app_line(a, ctx["lines"], ("X4", "X5"))
        state = (l or {}).get("policy_state") or "none"
        tail = f"{plural(sel, 'workload')} of {key} {'is' if sel == 1 else 'are'} in selective enforcement, which enforces deny rules only"
        if l and state == "drafted":
            s = f"provision the drafted ringfence for {key}: {tail}, and a drafted deny changes nothing until provisioned"
        elif l and state == "provisioned":
            s = f"a provisioned deny names {key} but no ruleset scoped to the app denies all its workloads; add that deny and provision it: {tail}"
        else:
            s = f"draft and provision a ruleset scoped to {key} with a deny to all its workloads: {tail}"
        return [step(gate_id, g["reason"], kind, s, l["bucket"] if l else "plan", [l["title"]] if l else None, line=l)]
    if gate_id == "no_unknown_admin":
        out = []
        for l in x1_hits(a, ctx["lines"]):
            ports = ", ".join(l.get("admin_ports") or [])
            who = f"{l.get('ip')}{' (' + l['fqdn'] + ')' if l.get('fqdn') else ''}"
            if l.get("address_class") == "public":
                s = f"block the public source {who} on {ports} with the override deny; {l.get('allowed_connections', 0)} of its admin-port connections into {key} and its other peer apps are reported allowed"
            else:
                s = (f"identify the internal source {who} first (it reaches {key} on {ports}, and {l.get('allowed_connections', 0)} of its admin-port connections "
                     f"are reported allowed across {plural(len(l.get('peer_apps') or []), 'peer app')}), then label it as a workload or block it with the override deny")
            out.append(step(gate_id, x1_reason(l), kind, s, l["bucket"], [l["title"]], line=l))
        return out
    if gate_id == "no_cross_env_admin":
        out = []
        for l, pairs in x2_hits(a, ctx["lines"]):
            froms = ", ".join(sorted({p["from"] for p in pairs}))
            conns = sum(p.get("connections", 0) for p in pairs)
            s = (f"deny admin ports from env={l.get('src_env')} into env={l.get('dst_env')}: {froms} reaches {key} on "
                 f"{', '.join(l.get('ports') or [])} with {conns} connections reported allowed")
            out.append(step(gate_id, g["reason"], kind, s, l["bucket"], [l["title"]], line=l))
        return out
    if gate_id == "full_enforcement":
        sel, off = m.get("selective", 0), not_enforcing(m)
        s = f"move {sel} of {n} workloads of {key} from selective to full enforcement (default deny with allow rules)"
        if off:
            s += f", and the {off} not enforcing with them"
        return [step(gate_id, g["reason"], kind, s, "plan")]
    if gate_id == "no_unmanaged_inbound":
        row = ctx["map_rows"].get(key) or {}
        x3 = [w for w in ctx["watch"] if w.get("class") == "X3" and key in (w.get("peer_apps") or [])]
        conns = row.get("unmanaged_inbound", 0)
        if x3:
            ips = ", ".join(f"{w['ip']}{' (' + w['fqdn'] + ')' if w.get('fqdn') else ''}" for w in x3)
            s = f"narrow the rule or list admitting the public {'source' if len(x3) == 1 else 'sources'} {ips} into {key}; {conns} allowed connections came in from unlabelled or external sources"
            return [step(gate_id, g["reason"], kind, s, "plan", [f"X3 public source {w['ip']}" for w in x3])]
        return [step(gate_id, g["reason"], kind, f"label the unlabelled sources sending {conns} allowed connections into {key}, or narrow the rule or list admitting them", "plan")]
    if gate_id == "not_a_bridge":
        l = app_line(a, ctx["lines"], ("X4",))
        if g["state"] == "unknown":
            return [step(gate_id, g["reason"], kind, f"check the reach of {key}: {g['reason']}; run the lateral-movement query again and grade again", "plan")]
        if l:
            return [step(gate_id, g["reason"], kind, f"fence {key}: it is a bridge, so a breach there reaches the apps behind it; the rapid-risk-reduction ringfence drafts the ruleset", l["bucket"], [l["title"]], line=l)]
        return [step(gate_id, g["reason"], kind, f"fence {key}: {g['reason']}", "plan")]
    if gate_id == "no_wide_reach_account":
        row = ctx["map_rows"].get(key) or {}
        x6 = [w for w in ctx["watch"] if w.get("class") == "X6"]
        names = ", ".join(str(w.get("identity")) for w in x6)
        s = f"review the {plural(row.get('wide_reach_accounts', 0), 'wide-reach account')} seen into {key}"
        s += f" (the review-flagged accounts are {names})" if names else ""
        s += "; no rule can name an account, so confirm their reach with the owners"
        return [step(gate_id, g["reason"], kind, s, "plan", [f"X6 {w.get('identity')}" for w in x6])]
    return []


def next_steps(a: dict, gates: dict, level: int, ctx: dict) -> list[dict]:
    if level >= 5:
        return []
    out = []
    for g in LADDER[level + 1]["gates"]:
        if gates[g]["state"] != "pass":
            out.extend(steps_for(a, g, gates[g], ctx))
    return out


# ------------------------------------------------------------- estate blocks

def share(num: int, den: int) -> float:
    return round(num / den, 2) if den else 0.0


def block(rows: list[dict], threshold: float) -> dict:
    """Level and shares over a set of rows (apps and, for the estate, the unlabelled row)."""
    labelled = [r for r in rows if r["env"] is not None]
    managed_labelled = sum(r["managed"] for r in labelled)
    level = 0
    for L in range(1, 6):
        at = sum(r["managed"] for r in labelled if r["level"] >= L)
        if managed_labelled and at / managed_labelled >= threshold:
            level = L
        else:
            break
    workloads = sum(r["workloads"] for r in rows)
    dist = {str(L): {"apps": sum(1 for r in rows if r["level"] == L), "workloads": sum(r["workloads"] for r in rows if r["level"] == L)} for L in range(6)}
    nxt = level + 1 if level < 5 else None
    to_next = sorted((r for r in rows if nxt is not None and r["level"] < nxt), key=lambda r: (-r["workloads"], r["key"]))
    return {"workloads": workloads, "level": level, "next_level": nxt, "distribution": dist,
            "in_force_share": share(sum(r["workloads"] for r in rows if r["level"] >= 3), workloads),
            "contained_share": share(sum(r["workloads"] for r in rows if r["level"] >= 5), workloads),
            "to_next": [{"app": r["app"], "env": r["env"], "workloads": r["workloads"], "level": r["level"],
                         "first_step": r["next_steps"][0]["sentence"] if r["next_steps"] else ""} for r in to_next]}


# ----------------------------------------------------------------- the grade

def build(plan: dict, wl_env: dict, lateral: dict | None, paths: dict, date: str, threshold: float) -> dict:
    rows = split_rows(wl_env)
    cols = wl_env.get("columns") or []
    has_labels = {"app", "env"} <= set(cols)
    if not has_labels:
        rows = [{**r, "app": None, "env": None} for r in rows]
    apps, unl = group_workloads(rows)
    rm = plan.get("risk_map") or {}
    policy = plan.get("policy") or {}
    crown = {key_of(*c) if isinstance(c, (list, tuple)) else str(c) for c in plan.get("crown_jewels") or []}
    DEFAULT_LISTS[:] = plan.get("default_ip_lists") or ["Any (0.0.0.0/0 and ::/0)"]
    ctx = {"lines": plan.get("lines") or [], "watch": plan.get("watch") or [], "policy": policy, "lateral": lateral,
           "map_rows": {r["app"]: r for r in rm.get("apps") or []}, "rrr_inputs": plan.get("inputs") or {}}

    app_rows = []
    for key, a in sorted(apps.items()):
        gates = app_gates(a, ctx)
        level = grade(gates)
        row = {"app": a["app"], "env": a["env"], "key": key, "workloads": a["workloads"], "crown_jewel": key in crown,
               "enforcement": enforcement_of(a["modes"]), "managed": a["managed"],
               "level": level, "level_name": LEVEL_NAME[level], "next_level": level + 1 if level < 5 else None,
               "gates": gates, "next_steps": next_steps(a, gates, level, ctx)}
        mr = ctx["map_rows"].get(key) or {}
        row["risk_rank_score"] = mr.get("risk_rank_score", 0)
        row["measures"] = {k: mr.get(k, 0) for k in ("unmanaged_inbound", "unmanaged_admin_sources", "cross_env_connections",
                                                       "cross_env_apps", "wide_reach_accounts", "workloads_not_enforcing")}
        app_rows.append(row)
    all_rows = list(app_rows)
    if unl["workloads"]:
        gates = unlabelled_gates(unl)
        all_rows.append({"app": UNLABELLED, "env": None, "key": UNLABELLED, "workloads": unl["workloads"], "crown_jewel": False,
                         "enforcement": enforcement_of(unl["modes"]), "managed": unl["managed"], "level": 0, "level_name": LEVEL_NAME[0],
                         "next_level": 1, "gates": gates, "next_steps": steps_for(unl | {"key": UNLABELLED}, "labelled", gates["labelled"], ctx),
                         "risk_rank_score": None, "measures": None})
    all_rows.sort(key=lambda r: (not r["crown_jewel"], r["level"], -r["workloads"], r["key"]))

    estate = block(all_rows, threshold)
    estate = {"workloads": estate["workloads"], "managed": sum(r["managed"] for r in all_rows),
              "labelled": sum(r["workloads"] for r in app_rows), "threshold": threshold, **{k: v for k, v in estate.items() if k != "workloads"}}
    prod = set(plan.get("production_envs") or [])
    by_env: dict[str, list] = defaultdict(list)
    for r in app_rows:
        by_env[r["env"]].append(r)
    envs = [{"env": e, **block(rs, threshold)} for e, rs in by_env.items()]
    envs.sort(key=lambda x: (x["env"] not in prod, -x["workloads"], x["env"]))

    notes = [
        "X1 counts are per source, not per app, so a no_unknown_admin failure can rest on a source whose allowed connections went to another peer app",
        "the wide-reach rule reads the top-20 reachable list, so the count of wide-reach apps is a lower bound",
        "gates are tested against the provisioned policy; a drafted rule changes nothing until it is provisioned",
    ]
    if lateral is None:
        notes.append("lateral.json missing: not_a_bridge is unknown on every app, so no app can reach level 5 until the lateral-movement result is saved")
    if not has_labels:
        notes.append("the workload inventory has no app or env column: every workload sits in the unlabelled row at level 0")
    elif unl["workloads"]:
        notes.append(f"{unl['workloads']} of {estate['workloads']} workloads lack app or env and sit in the unlabelled row at level 0")
    trunc = [k for k, v in (plan.get("truncated") or {}).items() if v]
    if trunc:
        notes.append("rapid-risk-reduction inputs that hit a cap: " + ", ".join(trunc) + "; the gates that rest on them are lower bounds")
    missing = plan.get("missing_inputs") or []
    if missing:
        notes.append("rapid-risk-reduction inputs not read: " + ", ".join(missing) + "; gates that need them are unknown, never passed")
    if not app_rows:
        notes.append("no app could be graded: no workload carries both an app and an env label")

    return {
        "generated": f"{date}T00:00:00Z", "date": date,
        "rrr": {"date": plan.get("date"), "window": plan.get("window") or {}, "window_days": plan.get("window_days"),
                "lateral_days": plan.get("lateral_days"), "policy_view": plan.get("policy_view"),
                "crown_jewels": sorted(crown), "crown_jewels_source": plan.get("crown_jewels_source"),
                "inputs": plan.get("inputs") or {}, "truncated": plan.get("truncated") or {}, "missing_inputs": missing},
        "inputs": paths,
        "ladder": [{k: v for k, v in l.items() if k != "takes"} for l in LADDER],
        "gate_text": dict(GATE_TEXT),
        "estate": estate, "envs": envs, "apps": all_rows,
        "evidence": {k: rm.get(k) for k in ("readiness", "headline", "apps", "env_matrix", "rule_drift", "fix_first", "takeaway")},
        "notes": notes,
    }


# ----------------------------------------------------------------- markdown

def md_table(headers: list, rows: list) -> str:
    out = ["| " + " | ".join(headers) + " |", "| " + " | ".join("---" for _ in headers) + " |"]
    for r in rows:
        out.append("| " + " | ".join(str(c).replace("|", "/") for c in r) + " |")
    return "\n".join(out)


def pct(x: float) -> str:
    return f"{round(x * 100)}%"


def row_name(r: dict) -> str:
    return r["key"] + (" (crown jewel)" if r.get("crown_jewel") else "")


def answer_paragraph(d: dict) -> str:
    e = d["estate"]
    L, name = e["level"], LEVEL_NAME[e["level"]]
    bar = pct(e["threshold"])
    att = LADDER[L]["attacker"]
    s = f"The estate stands at level {L}, {name}: "
    if L == 0 and not e["labelled"]:
        s += f"no workload carries both an app and an env label, so nothing can be graded above level 0 and the attacker's view is \"{att}\". "
    elif L == 0:
        s += (f"fewer than {bar} of the managed, labelled workloads sit in apps that have reached level 1, so the attacker's view is "
              f"\"{att}\". ")
    else:
        s += f"at least {bar} of the managed, labelled workloads sit in apps at level {L} or higher, so the attacker's view is \"{att}\". "
    s += (f"{pct(e['in_force_share'])} of all {e['workloads']} workloads are in apps where enforcement is in force today (level 3 or higher) "
          f"and {pct(e['contained_share'])} are in apps where a breach stays where it landed (level 5). ")
    if e["next_level"] is None:
        s += "There is no level above this one; the work is to keep every app where it is."
        return s
    nxt = e["next_level"]
    rows = {r["key"]: r for r in d["apps"]}
    top = [{**t, "first_step": KIND_LABEL[rows[t["app"] if t["env"] is None else key_of(t["app"], t["env"])]["next_steps"][0]["kind"]].lower()}
           for t in e["to_next"][:3]]
    if not top:
        s += f"Nothing stands between the estate and level {nxt}, {LEVEL_NAME[nxt]}."
        return s
    s += f"The shortest path to level {nxt}, {LEVEL_NAME[nxt]}, runs through the {'three ' if len(top) == 3 else ''}largest apps still below it: "
    s += "; ".join(f"{key_of(t['app'], t['env']) if t['env'] else 'the ' + t['app'] + ' workloads'}, {t['workloads']} at level {t['level']}: {t['first_step']}" for t in top)
    s += ". Section 4 grades every app and section 5 lists the steps."
    return s


def header_lines(d: dict, rrr_dir: str) -> list[str]:
    r = d["rrr"]
    w = r.get("window") or {}
    out = [f"# Mythos readiness, {d['date']}", "", DEFINITION, "",
           f"Window: {str(w.get('start', '?'))[:10]} to {str(w.get('end', '?'))[:10]} ({r.get('window_days')} days; lateral-movement window {r.get('lateral_days')} days). "
           f"Policy view: {r.get('policy_view')}. Rapid-risk-reduction run of {r.get('date')} in `{rrr_dir}`.",
           f"Crown jewels: {', '.join(r['crown_jewels']) if r['crown_jewels'] else 'none'} ({r.get('crown_jewels_source')}).",
           "Nothing in this report writes to the PCE."]
    trunc = [k for k, v in (r.get("truncated") or {}).items() if v]
    if trunc:
        out.append(f"Lower bounds: the rapid-risk-reduction inputs {', '.join(trunc)} hit their cap, so the counts that rest on them are lower bounds.")
    if r.get("missing_inputs"):
        out.append(f"Not read by the rapid-risk-reduction run: {', '.join(r['missing_inputs'])}; the gates that need them are unknown, never passed.")
    if d["inputs"].get("lateral") is None:
        out.append("lateral.json was not found: the bridge gate is unknown on every app and no app can reach level 5.")
    return out


def ladder_section() -> list[str]:
    rows = [[l["level"], l["name"], l["takes"], l["attacker"]] for l in LADDER]
    return ["## 2. The ladder", "", md_table(["Level", "Name", "What it takes", "Attacker's view"], rows), "",
            "Levels 0 to 2 depend on a human noticing. Levels 3 to 5 hold without one. An app's level is the highest level whose gates, "
            "and every lower level's gates, all pass; an unknown gate never passes."]


def estate_section(d: dict) -> list[str]:
    e = d["estate"]
    dist = [[L, LEVEL_NAME[int(L)], v["apps"], v["workloads"]] for L, v in e["distribution"].items()]
    out = ["## 3. Estate and environments", "",
           f"{e['workloads']} workloads, {e['managed']} managed, {e['labelled']} with app and env. Estate level {e['level']}, {LEVEL_NAME[e['level']]} "
           f"(at least {pct(e['threshold'])} of the managed, labelled workloads in apps at that level or higher). "
           f"In force: {pct(e['in_force_share'])}. Contained: {pct(e['contained_share'])}.", "",
           md_table(["Level", "Name", "Apps", "Workloads"], dist), ""]
    if d["envs"]:
        rows = [[x["env"], x["level"], LEVEL_NAME[x["level"]], x["workloads"], pct(x["in_force_share"]), pct(x["contained_share"])] for x in d["envs"]]
        out += [md_table(["Environment", "Level", "Name", "Workloads", "In force", "Contained"], rows), ""]
    else:
        out += ["No environment can be graded: no workload carries both an app and an env label.", ""]
    return out


def apps_section(d: dict) -> list[str]:
    rows = []
    for r in d["apps"]:
        first = r["next_steps"][0]["sentence"] if r["next_steps"] else ("at the top of the ladder" if r["level"] == 5 else "")
        rows.append([r["app"] + (" (crown jewel)" if r["crown_jewel"] else ""), r["env"] if r["env"] else "-", r["workloads"],
                     f"{r['level']} {r['level_name']}", first])
    return ["## 4. Apps", "", "Crown jewels first, then by level and size. The last column is the first step that moves the app up one level.", "",
            md_table(["App", "Env", "Workloads", "Level", "What moves it up"], rows), ""]


def steps_section(d: dict) -> list[str]:
    by_kind: dict[str, list] = defaultdict(list)
    for r in d["apps"]:
        for s in r["next_steps"]:
            by_kind[s["kind"]].append((r, s))
    out = ["## 5. What to do next", "",
           "Every step is the failing or unknown gate of the app's next level. The bucket is the rapid-risk-reduction plan's (today, week) "
           "when a line of that plan backs the step, else plan: human work. Call plans live in appendix C.", ""]
    if not by_kind:
        out += ["Nothing: every app is at level 5.", ""]
    for kind in KIND_LABEL:
        if kind not in by_kind:
            continue
        out.append(f"### {KIND_LABEL[kind]}")
        out.append("")
        for r, s in by_kind[kind]:
            tail = f" ({s['bucket']}" + (f"; {s['call_plan']}" if s["call_plan"] else "") + ")"
            out.append(f"- {row_name(r)}, to level {r['next_level']}: {s['sentence']}{tail}")
        out.append("")
    return out


def evidence_section(d: dict) -> list[str]:
    ev = d["evidence"]
    out = ["## Appendix A. The risk map", "", "Copied from the rapid-risk-reduction run; nothing here is re-derived.", ""]
    if ev.get("takeaway"):
        out += [f"Takeaway: {ev['takeaway']}", ""]
    rd = ev.get("readiness") or {}
    if rd:
        out += [f"Labelling readiness: {rd.get('verdict')}, {rd.get('labelled')} of {rd.get('workloads')} workloads carry app and env"
                + ("; " + "; ".join(rd.get("notes") or []) if rd.get("notes") else "") + ".", ""]
    h = ev.get("headline") or {}
    if h:
        out += [f"Headline: {h.get('workloads')} workloads, {h.get('full_enforcement')} in full enforcement, {h.get('selective')} selective, "
                f"{h.get('not_enforcing')} not enforcing; {h.get('unmanaged_admin_sources')} unmanaged admin-port sources "
                f"({h.get('unmanaged_admin_internal')} internal, {h.get('unmanaged_admin_public')} public); "
                f"{h.get('apps_in_graph')} apps in the lateral-movement graph, {h.get('wide_reach_apps')} with wide reach"
                + (" (lower bound)" if h.get("wide_reach_lower_bound") else "")
                + f"; {h.get('override_denies_not_showing')} override denies not showing in traffic, {h.get('override_denies_unchecked')} unchecked.", ""]
    apps = ev.get("apps") or []
    if apps:
        rows = [[a["app"] + (" (crown jewel)" if a.get("crown_jewel") else ""), a.get("workloads"), a.get("unmanaged_inbound"), a.get("unmanaged_admin_sources"),
                 a.get("cross_env_connections"), a.get("cross_env_apps"), a.get("wide_reach_accounts"), a.get("workloads_not_enforcing")] for a in apps]
        out += ["Apps ranked (the six measures):", "",
                md_table(["App", "Workloads", "Unmanaged inbound", "Unmanaged admin sources", "Cross-env connections", "Cross-env apps",
                          "Wide-reach accounts", "Not enforcing"], rows), ""]
    em = ev.get("env_matrix") or []
    if em:
        out += ["Environment matrix (allowed / potentially blocked / blocked):", "",
                md_table(["From", "To", "Allowed", "Potentially blocked", "Blocked"],
                         [[m["from"], m["to"], m["allowed"], m["potentially_blocked"], m["blocked"]] for m in em]), ""]
    else:
        out += ["Environment matrix: no crossing between labelled environments in the window.", ""]
    drift = ev.get("rule_drift") or []
    if drift:
        out += ["Rules not showing in traffic:", ""] + [f"- {x.get('ruleset')}: {x.get('text') or x.get('rule') or json.dumps(x)[:160]}" for x in drift] + [""]
    else:
        out += ["Rules not showing in traffic: none.", ""]
    ff = ev.get("fix_first") or []
    if ff:
        out += ["Fix first:", ""] + [f"{i}. {s}" for i, s in enumerate(ff, 1)] + [""]
    return out


def method_section(d: dict) -> list[str]:
    out = ["## Appendix B. Method and semantics", "", "Gate tests, in words (every workload of the app unless said):", ""]
    for l in LADDER[1:]:
        for g in l["gates"]:
            out.append(f"- level {l['level']} `{g}`: {GATE_TEXT[g]}")
    out += ["", f"The estate's level is the highest level at which at least {pct(d['estate']['threshold'])} of the managed, labelled workloads sit "
            "in apps at that level or higher; level 0 always qualifies. Each environment is graded the same way over its own workloads. "
            "The in-force share counts workloads in apps at level 3 or higher over all workloads, unlabelled included; the contained share does the same for level 5.", "",
            "Illumio semantics the grade relies on:", ""]
    out += [f"- {s}" for s in SEMANTICS]
    r = d["rrr"]
    read = [k for k, v in (r.get("inputs") or {}).items() if v]
    out += ["", f"Inputs: `{d['inputs']['plan']}`, `{d['inputs']['workloads']}`" + (f", `{d['inputs']['lateral']}`" if d["inputs"].get("lateral") else ", no lateral.json") + ".",
            f"The rapid-risk-reduction run read: {', '.join(read) or 'nothing recorded'}.", "", "Notes:", ""]
    out += [f"- {n}" for n in d["notes"]]
    return out + [""]


def write_md(path: pathlib.Path, d: dict, rrr_dir: str) -> None:
    lines = header_lines(d, rrr_dir) + ["", "## 1. The question and the answer", "", answer_paragraph(d), ""]
    lines += ladder_section() + [""]
    lines += estate_section(d)
    lines += apps_section(d)
    lines += steps_section(d)
    lines += evidence_section(d)
    lines += method_section(d)
    lines += ["## Appendix C. Call plans", "",
              f"Call plans: `call-plans.md` of the rapid-risk-reduction run (`{rrr_dir}`), under the headings each step in section 5 points at. "
              "Every block there is a draft for review; nothing in this report writes to the PCE.", ""]
    path.write_text("\n".join(lines))


def write_dashboard(path: pathlib.Path, d: dict, template: pathlib.Path) -> str:
    if not template.exists():
        return f"no dashboard: template {template} not found"
    lines = template.read_text().split("\n")
    start = [i for i, l in enumerate(lines) if l.strip() == MARK_START]
    end = [i for i, l in enumerate(lines) if l.strip() == MARK_END]
    if not start or not end or end[0] <= start[0]:
        return "no dashboard: template has no DATA markers on their own lines"
    out = lines[:start[0] + 1] + ["const DATA = " + json.dumps(d, indent=2) + ";"] + lines[end[0]:]
    path.write_text("\n".join(out))
    return "dashboard.jsx"


# ------------------------------------------------------------------------ main

def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--rrr", type=pathlib.Path, required=True, help="rapid-risk-reduction output directory (plan.json)")
    ap.add_argument("--scratch", type=pathlib.Path, required=True, help="rapid-risk-reduction scratch directory (workloads.json, lateral.json)")
    ap.add_argument("--out", type=pathlib.Path, required=True, help="output directory")
    ap.add_argument("--date", default=None, help="today as YYYY-MM-DD; fixes date and generated for reproducible runs")
    ap.add_argument("--threshold", type=float, default=0.8, help="share of managed labelled workloads that sets the estate level (default 0.8)")
    ap.add_argument("--template", type=pathlib.Path, default=None, help="dashboard template (default ../references/dashboard-example.jsx)")
    a = ap.parse_args(argv)

    plan_path, wl_path, lat_path = a.rrr / "plan.json", a.scratch / "workloads.json", a.scratch / "lateral.json"
    plan = load(plan_path)
    if plan is None:
        sys.exit(f"{plan_path} is required: run illumio-rapid-risk-reduction/scripts/triage.py first")
    wl_env = load(wl_path)
    if wl_env is None:
        sys.exit(f"{wl_path} is required (get-workloads, compact, unfiltered; the rapid-risk-reduction scratch copy)")
    lateral = load(lat_path)
    date = a.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    paths = {"plan": str(plan_path), "workloads": str(wl_path), "lateral": str(lat_path) if lateral is not None else None}

    d = build(plan, wl_env, lateral, paths, date, a.threshold)
    a.out.mkdir(parents=True, exist_ok=True)
    (a.out / "readiness.json").write_text(json.dumps(d, indent=2) + "\n")
    write_md(a.out / "readiness.md", d, str(a.rrr))
    here = pathlib.Path(__file__).resolve().parent
    dash = write_dashboard(a.out / "dashboard.jsx", d, a.template or here.parent / "references" / "dashboard-example.jsx")

    e = d["estate"]
    print(f"estate level {e['level']} {LEVEL_NAME[e['level']]}: {e['workloads']} workloads, in force {pct(e['in_force_share'])}, contained {pct(e['contained_share'])}; "
          f"{len(d['apps'])} rows, levels " + ", ".join(f"{L}: {v['apps']}" for L, v in e["distribution"].items()))
    if lateral is None:
        print("note: lateral.json not found; not_a_bridge is unknown on every app")
    print(f"wrote readiness.json, readiness.md, {dash}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
