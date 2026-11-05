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
  rulesets.json        get-rulesets, pversion active (the provisioned policy), unfiltered
  rulesets_draft.json  get-rulesets, pversion draft, unfiltered (draft view only: --policy draft)
  timeline.json        get-traffic-timeline, blocked + potentially_blocked, bucket 1d, spikes
  draft_active.json    compare-draft-active (optional: pending changes between draft and active)

Policy views (--policy): "provisioned" reads the active rulesets only; "draft" reads both.
Scores, admitting rules and "allowed, no rule" always use the provisioned rules, because the
reported policy decisions in the traffic come from them. The draft view adds the delta: the
rulesets and rules the draft adds, changes or removes, and for every exposure whether a
provisioned deny already names it (yet it reports allowed), a draft deny covers it (work
left: provision) or nothing does (work left: draft).

Outputs: <out>/plan.json, <out>/plan.md (the one page), <out>/call-plans.md,
<out>/report.md (the risk report: every exposure with its risk, evidence and
recommendation) and <out>/dashboard.jsx (the template in references/ with the
plan's data in its DATA block). plan.json carries the risk map (where the
risk sits: labelling readiness, ranked apps, environment matrix, override
denies not showing in traffic, fix first) that the three views share.

Labels are never assumed complete: workloads without app and env labels are
counted, kept out of every scoped finding, and reported as a readiness gap.

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
# Kerberos, LDAP, SMB and LDAPS to the directory servers: a deny on these from a user
# environment breaks logins, so X2 denies carrying them get a warning and a carve-out.
DIRECTORY_PORTS = {88: "Kerberos", 389: "LDAP", 445: "SMB", 636: "LDAPS"}
PROTO_NAMES = {6: "tcp", 17: "udp", 1: "icmp", "6": "tcp", "17": "udp", "1": "icmp"}
DENIED = ("blocked", "potentially_blocked")
DECISIONS = ("allowed", "potentially_blocked", "blocked")
ANY_LIST = "Any (0.0.0.0/0 and ::/0)"
UNMANAGED_PREFIXES = ("external:", "unlabelled")
ENFORCING = ("selective", "full")


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


def label_value(v) -> str | None:
    """A label cell: None, '' and '-' (the server's marker for an unlabelled side) are missing."""
    s = str(v).strip() if v is not None else ""
    return s if s and s != "-" else None


def env_of(text) -> str | None:
    """env of an 'app (env)' identity; None for external:*, unlabelled and bare names."""
    if not isinstance(text, str) or text.startswith(UNMANAGED_PREFIXES):
        return None
    pair = parse_identity(text)
    return pair[1] if pair else None


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


def mix(counts: dict, not_admitted: int = 0) -> dict:
    """Decision mix of the connections a fix touches. `not_admitted` is the part of `allowed`
    that no provisioned allow rule admits on workloads in selective enforcement: selective reports
    everything a deny does not catch as allowed, so a new deny would catch it without
    contradicting any rule. It counts towards the deny-safe share with the denied decisions."""
    total = sum(counts.get(d, 0) for d in DECISIONS)
    not_admitted = min(int(not_admitted or 0), counts.get("allowed", 0))
    safe = counts.get("blocked", 0) + counts.get("potentially_blocked", 0) + not_admitted
    return {"allowed": counts.get("allowed", 0), "potentially_blocked": counts.get("potentially_blocked", 0),
            "blocked": counts.get("blocked", 0), "allowed_not_admitted": not_admitted,
            "denied_share": round(safe / total, 2) if total else None}


def ease_base(m: dict) -> int:
    s = m["denied_share"]
    if s is None:
        return 3
    return 5 if s >= 0.95 else 4 if s >= 0.70 else 3 if s >= 0.30 else 2


def only_selective(modes: Counter | dict) -> bool:
    """True when every workload on the enforcing side is in selective enforcement, the one
    mode where a reported `allowed` means only 'no deny matched' (full enforcement and
    visibility report allowed only when an allow rule matched)."""
    return bool(modes) and set(modes) <= {"selective"}


# ---------------------------------------------------------------------- inputs

def workload_index(rows: list[dict], has_label_columns: bool = True) -> dict:
    """Per-app inventory plus the labelling readiness counts. A workload without both app
    and env is kept out of `apps` (nothing can be scoped to it) and counted in `labels`."""
    apps: dict[tuple, dict] = {}
    hosts: dict[str, dict] = {}
    envs: Counter = Counter()
    env_modes: dict[str, Counter] = defaultdict(Counter)
    modes_total: Counter = Counter()
    labels = {"workloads": 0, "with_app": 0, "with_env": 0, "with_both": 0, "label_columns": has_label_columns,
              "unlabelled_modes": Counter(), "unlabelled_examples": [], "app_without_env": Counter()}
    for r in rows:
        app, env = label_value(r.get("app")), label_value(r.get("env"))
        mode = str(r.get("enforcement_mode") or "unknown")
        labels["workloads"] += 1
        modes_total[mode] += 1
        labels["with_app"] += bool(app)
        labels["with_env"] += bool(env)
        if env:
            envs[env] += 1
            env_modes[env][mode] += 1
        if app and env:
            labels["with_both"] += 1
            a = apps.setdefault((app, env), {"workloads": 0, "modes": Counter(), "hostnames": []})
            a["workloads"] += 1
            a["modes"][mode] += 1
            a["hostnames"].append(str(r.get("hostname") or r.get("name")))
        else:
            labels["unlabelled_modes"][mode] += 1
            if app:
                labels["app_without_env"][app] += 1
            if len(labels["unlabelled_examples"]) < 8:
                labels["unlabelled_examples"].append(str(r.get("hostname") or r.get("name") or app or r.get("href") or "?"))
        for name in (r.get("hostname"), r.get("name")):
            if name:
                hosts[str(name)] = {"app": app, "env": env, "enforcement_mode": mode}
    return {"apps": apps, "hosts": hosts, "envs": envs, "env_modes": env_modes, "modes_total": modes_total, "labels": labels}


def pick_prod_envs(given: list[str], envs: Counter) -> list[str]:
    if given:
        return given
    return sorted(e for e in envs if "prod" in e.lower())


def existing_policy(rs: dict | None) -> dict:
    """What a policy version already has: rulesets scoped per app, deny rules, RRR rulesets."""
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


def norm_href(h) -> str:
    """The same object has /sec_policy/draft/ and /sec_policy/active/ hrefs; compare without."""
    return str(h or "").replace("/sec_policy/draft/", "/sec_policy/").replace("/sec_policy/active/", "/sec_policy/")


def rule_sig(rule: dict) -> str:
    keep = {k: rule.get(k) for k in ("rule_type", "enabled", "consumers", "providers", "ingress_services", "unscoped_consumers", "resolve_labels_as")}
    return norm_href(json.dumps(keep, sort_keys=True, default=str))


def policy_delta(active: dict | None, draft: dict | None) -> dict:
    """Rulesets and rules the draft adds, changes or removes against the provisioned policy,
    matched by href with the policy version stripped."""
    A = {norm_href(r.get("href")): r for r in (active or {}).get("rulesets", [])}
    D = {norm_href(r.get("href")): r for r in (draft or {}).get("rulesets", [])}
    rs = {"new": [], "changed": [], "removed": [], "unchanged": 0}
    rules = Counter()
    kinds: Counter = Counter()
    for h, r in D.items():
        if h not in A:
            rs["new"].append(r.get("name"))
            for rule in r.get("rules", []):
                rules["new"] += 1
                kinds[rule.get("rule_type") or "?"] += 1
            continue
        a = A[h]
        ra = {norm_href(x.get("href")): x for x in a.get("rules", [])}
        rd = {norm_href(x.get("href")): x for x in r.get("rules", [])}
        n0 = sum(rules.values())
        for k, x in rd.items():
            if k not in ra:
                rules["new"] += 1
                kinds[x.get("rule_type") or "?"] += 1
            elif rule_sig(x) != rule_sig(ra[k]):
                rules["changed"] += 1
        rules["removed"] += sum(1 for k in ra if k not in rd)
        head = any(a.get(k) != r.get(k) for k in ("name", "enabled")) or norm_href(json.dumps(a.get("scopes"), sort_keys=True, default=str)) != norm_href(json.dumps(r.get("scopes"), sort_keys=True, default=str))
        if head or sum(rules.values()) != n0:
            rs["changed"].append(r.get("name"))
        else:
            rs["unchanged"] += 1
    for h, a in A.items():
        if h not in D:
            rs["removed"].append(a.get("name"))
            rules["removed"] += len(a.get("rules", []))
    return {"rulesets": rs, "rules": {"new": rules["new"], "changed": rules["changed"], "removed": rules["removed"], "new_by_kind": dict(kinds)}}


def side_names_env(kinds: list[tuple], env: str, scope_env: str | None) -> bool:
    """Does one side of a deny name workloads carrying env=<env> exactly: all workloads, or an
    env label equal to it, inside a scope that allows it? Other label keys, label groups and
    IP lists only could, which is not enough to say a deny already names a crossing."""
    if scope_env and scope_env != env:
        return False
    if any(k == "all" for k, _ in kinds):
        return True
    envs = {v for k, v in kinds if k == "env"}
    return bool(envs) and env in envs


def covering_denies(rs: dict | None, l: dict, default_lists: list[str]) -> list[dict]:
    """Deny rules in this policy version that name the exposure: for X1 a deny whose consumer
    is an IP list holding the source (or the default Any list) and whose providers reach the
    peer apps; for X2 a deny from env=src to env=dst (env labels or all workloads, honouring
    ruleset scope); for a ringfence a scoped ruleset with a deny to all workloads. Services
    must cover the ports seen; a rule whose services are named (not resolvable here) is
    returned with ports "unresolved" and does not count as a cover."""
    out = []
    if l["kind"] == "ringfence":
        key = (l["app"], l["env"])
        for r in (rs or {}).get("rulesets", []):
            if r.get("enabled") is False:
                continue
            scoped = any((s.get("app"), s.get("env")) == key for s in rule_scopes(r))
            if scoped and any(rule.get("rule_type") in ("deny", "override_deny") and rule.get("enabled") is not False
                              and any(actor_kind(a)[0] == "all" for a in rule.get("providers", [])) for rule in r.get("rules", [])):
                out.append({"key": ("fence", norm_href(r.get("href"))), "ruleset": r.get("name"), "rule_type": "deny",
                            "text": f"{r.get('name')}: scoped ruleset for {l['app']} ({l['env']}) with a deny to all workloads", "ports": "all"})
        return out
    want = {(int(p.split("/")[0]), p.split("/")[1]) for p in (l["admin_ports"] if l["class"] == "X1" else l["ports"])}
    lists = set(l.get("ip_lists") or []) | set(default_lists)
    peers = {parse_identity(p) for p in l.get("peer_apps") or []} - {None}
    for r in (rs or {}).get("rulesets", []):
        if r.get("enabled") is False:
            continue
        sets = rule_scopes(r) or [{}]
        for rule in r.get("rules", []):
            if rule.get("rule_type") not in ("deny", "override_deny") or rule.get("enabled") is False:
                continue
            cons = [actor_kind(a) for a in rule.get("consumers", [])]
            provs = [actor_kind(a) for a in rule.get("providers", [])]
            unscoped = bool(rule.get("unscoped_consumers"))
            hit = False
            if l["class"] == "X1":
                c_ok = any(k == "iplist" and v in lists for k, v in cons)
                reach = any(not (s.get("app") or s.get("env")) or ((s.get("app"), s.get("env")) in peers)
                            or (s.get("app") and not s.get("env") and any(a == s["app"] for a, _ in peers))
                            or (s.get("env") and not s.get("app") and any(e == s["env"] for _, e in peers)) for s in sets)
                p_ok = any(k == "all" or (k == "env" and any(e == v for _, e in peers)) or (k == "app" and any(a == v for a, _ in peers)) for k, v in provs)
                hit = c_ok and reach and p_ok
            else:
                for s in sets:
                    if side_names_env(provs, l["dst_env"], s.get("env")) and side_names_env(cons, l["src_env"], None if unscoped else s.get("env")):
                        hit = True
                        break
            if not hit:
                continue
            svcs = rule.get("ingress_services") or []
            all_svc = any((s.get("service") or {}).get("name") == "All Services" for s in svcs)
            covered = {(p, pr) for p, pr in want for s in svcs if s.get("port")
                       and int(s["port"]) <= p <= int(s.get("to_port") or s["port"]) and proto_name(s.get("proto")) == pr}
            named = any("service" in s for s in svcs) and not all_svc
            if all_svc or covered == want:
                ports = "all"
            elif covered:
                ports = f"{len(covered)} of {len(want)} ports"
            elif named:
                ports = "unresolved"
            else:
                continue
            scope_txt = "; ".join(", ".join(f"{k}={v}" for k, v in s.items()) for s in sets if s)
            out.append({"key": (norm_href(rule.get("href")), rule_sig(rule)), "ruleset": r.get("name"), "rule_type": rule["rule_type"],
                        "text": f"{r.get('name')} ({rule['rule_type'].replace('_', ' ')}{', scope ' + scope_txt if scope_txt else ''}): {', '.join(actor_text(a) for a in rule.get('consumers', []))} -> "
                                f"{', '.join(actor_text(a) for a in rule.get('providers', []))} on {', '.join(service_text(x) for x in svcs)}"
                                + ("" if ports == "all" else (" (named service, not resolved here)" if ports == "unresolved" else f" ({ports})")), "ports": ports})
    return out[:8]


def policy_view(view: str, active: dict | None, draft: dict | None, da: dict | None, lines: list[dict], default_lists: list[str]) -> dict:
    """What the policy read covers, and per exposure whether a provisioned deny names it, a
    draft deny covers it, or nothing does."""
    for l in lines:
        found = covering_denies(active, l, default_lists)
        prov = [c for c in found if c["ports"] != "unresolved"]
        unresolved = [c for c in found if c["ports"] == "unresolved"]
        drafted = []
        if view == "draft":
            seen = {c["key"] for c in found}
            drafted = [c for c in covering_denies(draft, l, default_lists) if c["key"] not in seen and c["ports"] != "unresolved"]
        strip = lambda cs: [{k: v for k, v in c.items() if k != "key"} for c in cs[:5]]
        l["cover"] = {"provisioned": strip(prov), "drafted": strip(drafted), "unresolved": strip(unresolved)}
        l["policy_state"] = "drafted" if drafted else ("provisioned" if prov else "none")
    states = Counter(l["policy_state"] for l in lines)
    out = {"view": view, "read": active is not None, "pending": draft_state(da), "delta": policy_delta(active, draft) if view == "draft" else None,
           "exposures": {"total": len(lines), "provisioned": states["provisioned"], "drafted": states["drafted"], "none": states["none"]}}
    out["text"] = policy_text(out)
    return out


def policy_text(pol: dict) -> str:
    pend, ex = pol["pending"], pol["exposures"]
    s_ = lambda n: "" if n == 1 else "s"
    if not pol.get("read", True):
        return "Policy not read: no rulesets saved, so existing rules, admitting rules and 'allowed, no rule' were not checked."
    if pol["view"] == "provisioned":
        s = "Policy read: provisioned (active) rulesets, the policy the reported decisions come from."
        if pend.get("available"):
            s += (f" The draft holds {pend['pending']} pending change{s_(pend['pending'])} that were not read; the draft view shows what is drafted but not provisioned."
                  if pend["pending"] else " Draft and active are in sync.")
        else:
            s += " compare-draft-active was not run, so whether the draft differs is unknown."
        if ex["provisioned"]:
            s += (f" {ex['provisioned']} exposure{s_(ex['provisioned'])} already {'has' if ex['provisioned'] == 1 else 'have'} a provisioned deny naming "
                  f"{'it' if ex['provisioned'] == 1 else 'them'} that still reports allowed: check the enforcing side's mode and the rule's scope before adding another.")
        return s
    d = pol["delta"]
    rs, ru = d["rulesets"], d["rules"]
    if not (rs["new"] or rs["changed"] or rs["removed"] or ru["new"] or ru["changed"] or ru["removed"]):
        s = "Policy read: provisioned and draft. The draft equals the provisioned policy, so every fix below is new work."
    else:
        kinds = ", ".join(f"{n} {k.replace('_', ' ')}" for k, n in sorted(ru["new_by_kind"].items()))
        s = (f"Policy read: provisioned and draft. The draft adds {len(rs['new'])} ruleset{s_(len(rs['new']))}"
             + (f" ({', '.join(rs['new'][:3])}{', ...' if len(rs['new']) > 3 else ''})" if rs["new"] else "")
             + f" and {ru['new']} rule{s_(ru['new'])}" + (f" ({kinds})" if kinds else "")
             + f", changes {len(rs['changed'])} ruleset{s_(len(rs['changed']))}" + (f" ({', '.join(rs['changed'][:3])}{', ...' if len(rs['changed']) > 3 else ''}; {ru['changed']} rule{s_(ru['changed'])} changed)" if rs["changed"] else "")
             + f", removes {len(rs['removed'])} ruleset{s_(len(rs['removed']))} and {ru['removed']} rule{s_(ru['removed'])}"
             + (f"; compare-draft-active: {pend['pending']} pending change{s_(pend['pending'])}" if pend.get("available") else "; compare-draft-active was not run") + ".")
    if ex["total"]:
        s += (f" Of the {ex['total']} exposure{s_(ex['total'])}, {ex['drafted']} already {'has' if ex['drafted'] == 1 else 'have'} a draft deny or ringfence waiting for provisioning, "
              f"{ex['provisioned']} {'has' if ex['provisioned'] == 1 else 'have'} a provisioned deny naming {'it' if ex['provisioned'] == 1 else 'them'} that still reports allowed, "
              f"and {ex['none']} {'has' if ex['none'] == 1 else 'have'} nothing drafted: the work left is to provision {ex['drafted']} and draft {ex['none']}.")
    return s


def cover_text(l: dict, inline: bool = False) -> str:
    """Sentences for the recommendation; with inline=True, clauses for a details line."""
    c = l.get("cover") or {}
    parts = []
    if c.get("provisioned"):
        parts.append("a provisioned deny already names this: " + "; ".join(x["text"] for x in c["provisioned"])
                     + f"; it reports allowed, so check the enforcing side ({l.get('enforcing_side', '?')}) and the rule's scope before adding another")
    if c.get("drafted"):
        parts.append("already drafted, not provisioned: " + "; ".join(x["text"] for x in c["drafted"])
                     + "; the work left is to review and provision that draft, not to draft another")
    if c.get("unresolved"):
        parts.append(f"{len(c['unresolved'])} provisioned den{'y names' if len(c['unresolved']) == 1 else 'ies name'} this source with a named service that cannot be resolved here, not checked: "
                     + "; ".join(x["ruleset"] for x in c["unresolved"]))
    if not parts:
        return ""
    if inline:
        return "; " + "; ".join(parts)
    return " " + " ".join(p[0].upper() + p[1:] + "." for p in parts)


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

def x1_unknown_admin(unknown: dict | None, policy: dict, rs: dict | None = None, wl: dict | None = None) -> list[dict]:
    default_lists = ((unknown or {}).get("totals") or {}).get("default_ip_lists") or [ANY_LIST]
    lines = []
    for e in (unknown or {}).get("endpoints", []):
        if "admin_reach" not in (e.get("profile") or []):
            continue
        src = e.get("as_source") or {}
        counts: Counter = Counter()
        ports = set()
        for p in src.get("ports", []):
            if p.get("admin"):
                ports.add((int(p.get("port") or 0), proto_name(p.get("proto"))))
                for d in DECISIONS:
                    counts[d] += (p.get("policy") or {}).get(d, 0)
        ev = (e.get("profile_evidence") or {}).get("admin_reach") or {}
        peer_apps = src.get("peer_apps") or []
        # An IP-list deny is enforced at the destination: the peer apps' workloads.
        peer_modes: Counter = Counter()
        for pa in peer_apps:
            pair = parse_identity(pa)
            if pair and wl:
                peer_modes.update(wl["apps"].get(pair, {}).get("modes", Counter()))
        admitting = admitting_list_rules(rs, list(e.get("ip_lists") or []) + list(default_lists), ports, peer_apps) if counts["allowed"] else []
        not_admitted = counts["allowed"] if (not admitting and only_selective(peer_modes)) else 0
        m = mix(counts, not_admitted)
        b = scale(src.get("peer_workloads", e.get("peer_workloads", 0)), (2, 5, 10, 25))
        ease = clamp(ease_base(m))
        public = e.get("address_class") == "public"
        lines.append({
            "class": "X1", "kind": "override_deny", "score": b * ease, "blast_radius": b, "ease": ease,
            "title": f"unknown {'public' if public else 'internal'} source {e['ip']}{' (' + e['fqdn'] + ')' if e.get('fqdn') else ''} on "
                     f"{', '.join(ev.get('admin_ports') or [])}",
            "ip": e["ip"], "fqdn": e.get("fqdn"), "address_class": e.get("address_class"),
            "ip_lists": e.get("ip_lists") or [], "admin_ports": ev.get("admin_ports") or [], "profile": e.get("profile") or [],
            "allowed_connections": ev.get("allowed_connections", 0),
            "allowed_into_enforced": src.get("allowed_into_enforced", 0),
            "peer_workloads": src.get("peer_workloads", 0), "peers_enforced": e.get("peers_enforced", 0),
            "peer_apps": peer_apps, "would_have_blocked": m, "admitting_rules": admitting,
            "enforcing_side": f"destination workloads of {len(peer_apps)} peer apps: {modes_text(peer_modes)}",
            "evidence": [f"find-unknown-endpoints endpoints[ip={e['ip']}].profile_evidence.admin_reach",
                         f"as_source.ports admin rows ({src.get('connections', 0)} connections as source)"],
            "rollback": "delete the override deny rule from the draft ruleset",
        })
    return sorted(lines, key=lambda l: (-l["score"], -sum(l["would_have_blocked"][d] for d in DECISIONS)))


def rule_scopes(r: dict) -> list[dict]:
    """A ruleset's scope sets as {key: value} dicts; [] (or [[]]) means unscoped, all workloads."""
    sets = []
    for scope in r.get("scopes") or []:
        d = {s.get("key"): s.get("value") for s in scope if isinstance(s, dict) and "key" in s}
        if d:
            sets.append(d)
    return sets


def actor_kind(a: dict) -> tuple[str, str | None]:
    if a.get("all_workloads"):
        return ("all", None)
    if "label" in a:
        return (str(a["label"].get("key")), a["label"].get("value"))
    if "ip_list" in a:
        return ("iplist", a["ip_list"].get("name"))
    if "label_group" in a:
        return ("label_group", a["label_group"].get("name"))
    return ("other", None)


def side_can_be_env(kinds: list[tuple], env: str, scope_env: str | None, workload_side: bool) -> bool:
    """Could one side of a rule resolve to workloads carrying env=<env> inside a scope set?
    Labels in an actor list are combined (a workload must carry all of them), so an env
    label on the side decides exactly; labels of other keys (role, app, loc) and label
    groups only could, so they count; all workloads always counts; an IP list counts on the
    consumer side only (a list can hold workload addresses), never as a provider."""
    if scope_env and scope_env != env:
        return False
    if any(k == "all" for k, _ in kinds):
        return True
    envs = {v for k, v in kinds if k == "env"}
    if envs:
        return env in envs
    if any(k not in ("iplist", "env") for k, _ in kinds):
        return True
    return any(k == "iplist" for k, _ in kinds) and not workload_side


def services_cover(svcs: list[dict], ports: set | None) -> int:
    """2 when the rule's services name one of the ports (or All Services), 1 for a named
    service that cannot be resolved here (it could cover them), 0 when the literal ports
    miss. `ports` None means any service counts."""
    if ports is None or not svcs:
        return 2
    best = 0
    for s in svcs:
        if "service" in s:
            best = max(best, 2 if (s["service"] or {}).get("name") == "All Services" else 1)
            continue
        try:
            lo, hi, pr = int(s.get("port") or 0), int(s.get("to_port") or s.get("port") or 0), proto_name(s.get("proto"))
        except (TypeError, ValueError):
            continue
        if any(lo <= p <= hi and pr == q for p, q in ports):
            best = 2
    return best


def admitting_rules(rs: dict | None, src_env: str, dst_env: str, ports: set | None = None) -> list[str]:
    """Allow rules that could admit env=src_env -> env=dst_env on the ports, honouring
    ruleset scope: providers live inside the scope; consumers do too unless the rule has
    unscoped_consumers. A ruleset scoped to env=dst_env therefore admits a crossing only
    through a rule whose consumers are unscoped. Exact matches (literal ports, All
    Services) come first; a named service cannot be resolved here and is marked."""
    out = []
    for r in (rs or {}).get("rulesets", []):
        if r.get("enabled") is False:
            continue
        sets = rule_scopes(r) or [{}]
        for rule in r.get("rules", []):
            if rule.get("rule_type") != "allow" or rule.get("enabled") is False:
                continue
            cover = services_cover(rule.get("ingress_services") or [], ports)
            if not cover:
                continue
            cons = [actor_kind(a) for a in rule.get("consumers", [])]
            provs = [actor_kind(a) for a in rule.get("providers", [])]
            unscoped = bool(rule.get("unscoped_consumers"))
            hit = 0
            for s in sets:
                s_env = s.get("env")
                p_ok = side_can_be_env(provs, dst_env, s_env, True)
                c_ok = side_can_be_env(cons, src_env, None if unscoped else s_env, False)
                if p_ok and c_ok:
                    # precision: an env label or all workloads names the side exactly; another label key only could
                    hit = 1 + any(p[0] in ("all", "env") or s_env == dst_env for p in provs) + any(c[0] in ("all", "env") for c in cons)
                    break
            if hit:
                scope_txt = "; ".join(", ".join(f"{k}={v}" for k, v in s.items()) for s in sets if s) or "unscoped"
                out.append((cover, hit, f"{r.get('name')} [scope {scope_txt}{', unscoped consumers' if unscoped else ''}]: "
                            f"{', '.join(actor_text(a) for a in rule.get('consumers', []))} -> {', '.join(actor_text(a) for a in rule.get('providers', []))} "
                            f"on {', '.join(service_text(x) for x in rule.get('ingress_services', []))}" + (" (named service, not resolved here)" if cover == 1 else "")))
    out.sort(key=lambda t: -(t[0] + t[1]))
    return [t[2] for t in out[:5]]


def admitting_list_rules(rs: dict | None, lists: list[str], ports: set, peer_apps: list[str]) -> list[str]:
    """Allow rules whose consumer is one of the IP lists holding an unknown source, whose
    services cover the admin ports seen (a named service cannot be resolved here and counts),
    and whose ruleset scope reaches a peer app. These are the rules an override deny beats."""
    want = set(lists)
    peers = {parse_identity(p) for p in peer_apps} - {None}
    out = []
    for r in (rs or {}).get("rulesets", []):
        if r.get("enabled") is False:
            continue
        sets = rule_scopes(r) or [{}]
        reach = any(not (s.get("app") or s.get("env")) or ((s.get("app"), s.get("env")) in peers)
                    or (s.get("app") and not s.get("env") and any(a == s["app"] for a, _ in peers))
                    or (s.get("env") and not s.get("app") and any(e == s["env"] for _, e in peers)) for s in sets)
        if not reach:
            continue
        for rule in r.get("rules", []):
            if rule.get("rule_type") != "allow" or rule.get("enabled") is False:
                continue
            names = {actor_kind(a)[1] for a in rule.get("consumers", []) if actor_kind(a)[0] == "iplist"}
            if not names & want:
                continue
            svcs = rule.get("ingress_services") or []
            covers = any("service" in s for s in svcs) or any(
                (int(s.get("port") or 0) <= p <= int(s.get("to_port") or s.get("port") or 0)) and proto_name(s.get("proto")) == pr
                for s in svcs for p, pr in ports)
            if covers:
                out.append(f"{r.get('name')}: {', '.join(actor_text(a) for a in rule.get('consumers', []))} -> "
                           f"{', '.join(actor_text(a) for a in rule.get('providers', []))} on {', '.join(service_text(x) for x in svcs)}")
    return out[:5]


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


def admin_rows(admin: dict | None) -> list[dict]:
    """Grouped admin-port rows with typed fields; a side whose env is '-' or empty is unlabelled."""
    out = []
    for row in split_rows(admin):
        try:
            port, proto = int(row.get("port")), proto_name(row.get("proto"))
        except (TypeError, ValueError):
            continue
        out.append({"src_app": label_value(row.get("src_app")), "src_env": label_value(row.get("src_env")),
                    "dst_app": label_value(row.get("dst_app")), "dst_env": label_value(row.get("dst_env")),
                    "port": port, "proto": proto, "policy_decision": row.get("policy_decision") or "unknown",
                    "num_connections": int(row.get("num_connections") or 0),
                    "first_detected": row.get("first_detected"), "last_detected": row.get("last_detected")})
    return out


def admin_span(admin: dict | None) -> dict:
    """What the 500-flow admin map really covers: the detection span of its rows."""
    rows = [r for r in admin_rows(admin) if r.get("first_detected") and r.get("last_detected")]
    if not rows:
        return {"start": None, "end": None, "days": None}
    start = min(r["first_detected"] for r in rows)
    end = max(r["last_detected"] for r in rows)
    try:
        d0, d1 = date.fromisoformat(start[:10]), date.fromisoformat(end[:10])
        days = (d1 - d0).days + 1
    except ValueError:
        days = None
    return {"start": start[:10], "end": end[:10], "days": days}


def x2_env_crossings(admin: dict | None, prod: list[str], rs: dict | None = None, wl: dict | None = None) -> list[dict]:
    """Grouped get-traffic-flows rows: src_app, src_env, dst_app, dst_env, port, proto,
    policy_decision, num_connections. Only admin ports, only rows with both envs labelled;
    a '-' env is an unlabelled side and never an environment."""
    groups: dict[tuple, dict] = {}
    for row in admin_rows(admin):
        a = (row["src_app"], row["src_env"]) if row["src_app"] and row["src_env"] else None
        b = (row["dst_app"], row["dst_env"]) if row["dst_app"] and row["dst_env"] else None
        port, proto = row["port"], row["proto"]
        if not a or not b or a[1] == b[1] or (port, proto) not in ADMIN_SET:
            continue
        n = row["num_connections"]
        dec = row["policy_decision"]
        g = groups.setdefault((a[1], b[1]), {"counts": Counter(), "pairs": Counter(), "dst_apps": set(), "src_apps": set(),
                                             "ports": Counter(), "port_mix": defaultdict(Counter), "directory": defaultdict(set)})
        g["counts"][dec] += n
        g["pairs"][(f"{a[0]} ({a[1]})", f"{b[0]} ({b[1]})", dec)] += n
        g["dst_apps"].add(b)
        g["src_apps"].add(a)
        g["ports"][f"{port}/{proto}"] += n
        g["port_mix"][f"{port}/{proto}"][dec] += n
        if port in DIRECTORY_PORTS and proto == "tcp":
            g["directory"][f"{port}/{proto}"].add(f"{b[0]} ({b[1]})")
    lines = []
    for (src_env, dst_env), g in groups.items():
        admitting = admitting_rules(rs, src_env, dst_env, {(int(p.split("/")[0]), p.split("/")[1]) for p in g["ports"]}) if g["counts"]["allowed"] else []
        # A label-consumer deny is enforced on the source workloads carrying env=src_env.
        src_modes = (wl or {}).get("env_modes", {}).get(src_env, Counter())
        not_admitted = g["counts"]["allowed"] if (not admitting and only_selective(src_modes)) else 0
        m = mix(g["counts"], not_admitted)
        b = scale(len(g["dst_apps"]), (2, 3, 5, 10))
        ease = clamp(ease_base(m) + 1)
        seen_ports = g["ports"]
        directory = {p: sorted(apps) for p, apps in sorted(g["directory"].items())}
        lines.append({
            "class": "X2", "kind": "deny", "score": b * ease, "blast_radius": b, "ease": ease,
            "title": f"admin ports env={src_env} -> env={dst_env}" + (" (production)" if dst_env in prod else ""),
            "src_env": src_env, "dst_env": dst_env, "to_production": dst_env in prod,
            "dst_apps": sorted(f"{a} ({e})" for a, e in g["dst_apps"]),
            "src_apps": sorted(f"{a} ({e})" for a, e in g["src_apps"]),
            "ports_seen": [f"{p} ({n}: {', '.join(f'{d} {c}' for d, c in g['port_mix'][p].items())})" for p, n in seen_ports.most_common(8)],
            "ports": sorted(seen_ports, key=lambda x: int(x.split('/')[0])),
            "directory_ports": directory,
            "app_pairs": [{"from": f, "to": t, "policy": p, "connections": n}
                          for (f, t, p), n in sorted(g["pairs"].items(), key=lambda kv: -kv[1])[:10]],
            "would_have_blocked": m, "admitting_rules": admitting,
            "enforcing_side": f"source workloads env={src_env}: {modes_text(src_modes)}",
            "evidence": [f"admin-port flows rows env={src_env} -> env={dst_env} ({len(g['pairs'])} app pairs, {len(seen_ports)} ports)"],
            "rollback": "delete the deny rule from the draft ruleset",
        })
    return sorted(lines, key=lambda l: (-l["to_production"], -l["score"]))


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


def crown_jewels(given: list[tuple], ringfences: list[dict], prod: list[str], map_rows: list[dict] | None = None) -> tuple[list[tuple], str]:
    if given:
        return given, "given by the user"
    bridges = sorted((l for l in ringfences if "bridge" in l["why"] and l["env"] in prod),
                     key=lambda l: -l["why"]["bridge"]["reachable_apps"])
    if bridges:
        return [(l["app"], l["env"]) for l in bridges[:3]], "defaulted to the three production bridge apps with the largest reach"
    # A flat network has no articulation points, so no bridges: fall back to the risk map.
    ranked = [parse_identity(r["app"]) for r in (map_rows or [])
              if parse_identity(r["app"]) and parse_identity(r["app"])[1] in prod and r["workloads"] and r["risk_rank_score"]]
    if ranked:
        return ranked[:3], "defaulted to the three production apps ranked highest on the risk map (no bridge app in the lateral-movement result)"
    return [], "none: no crown jewels given, no bridge app and no production app on the map"


# ------------------------------------------------------------------- baseline

def baseline(t: dict | None) -> dict:
    if not t:
        return {"available": False}
    series = t.get("series", [])
    flows = [s.get("flows", 0) for s in series]
    nonzero = sorted(f for f in flows if f)
    median = nonzero[len(nonzero) // 2] if nonzero else 0
    sp = t.get("spikes") or {}
    return {"available": True, "bucket": t.get("bucket") or "1d", "effective_bucket": t.get("effective_bucket"),
            "resolution_note": t.get("resolution_note"),
            "days": len(series), "total_flows": sum(flows), "median_nonzero": median,
            "worst": None if sp.get("caveat") else sp.get("worst"), "caveat": sp.get("caveat"),
            "threshold": sp.get("threshold"), "spike_buckets": sp.get("buckets") or [],
            "truncated": (t.get("totals") or {}).get("flows_truncated", False)}


# ------------------------------------------------------------------ call plans

def x1_group(l: dict, default_lists: list[str]) -> str:
    """Which IP list an X1 source goes in: a source already on a named list was admitted on
    purpose, an internal source is usually a scanner, backup or unlabelled server to identify
    first, a public source with no allowed traffic can be blocked today."""
    if l["address_class"] != "public":
        return "internal"
    if [n for n in l["ip_lists"] if n not in default_lists]:
        return "listed"
    return "today" if l.get("bucket") == "today" else "review"


X1_GROUPS = {
    "today": ("", "public sources on admin ports; nothing in the draft admits them"),
    "review": ("-review", "public sources on admin ports that an allow rule admits today; review that rule before the deny"),
    "internal": ("-internal-review", "internal (private) sources on admin ports: identify each one (scanner, backup, jump host, unlabelled server), then label it or keep it here"),
    "listed": ("-listed-review", "public sources already on a named IP list: policy names that list, so check the rules that use it (allow or deny) with the list owner before this override deny"),
}


def call_plans(p: dict) -> list[dict]:
    rs = p["ruleset_name"]
    default_lists = p.get("default_ip_lists") or [ANY_LIST]
    plans = []
    groups: dict[str, list[dict]] = {g: [] for g in X1_GROUPS}
    for l in p["lines"]:
        if l["class"] == "X1":
            groups[x1_group(l, default_lists)].append(l)
    for g, x1 in groups.items():
        if not x1:
            continue
        suffix, why = X1_GROUPS[g]
        plans.append({"for": f"X1 ({g})", "tool": "create-iplist", "DO_NOT_CALL": "draft for review",
                      "name": f"RRR-unknown-admin-sources-{p['date']}{suffix}",
                      "description": f"Rapid risk reduction: {why}",
                      "ip_ranges": [{"from_ip": l["ip"], "description": (l.get("fqdn") or "unknown source")
                                     + (f"; on lists {', '.join(l['ip_lists'])}" if g == "listed" else "")} for l in x1]})
    if any(l["class"] in ("X1", "X2") for l in p["lines"]):
        if p["policy"]["rrr_rulesets"]:
            where = "provisioned" if set(p["policy"]["rrr_rulesets"]) - set(p["policy"].get("rrr_rulesets_drafted") or []) else "drafted, not provisioned"
            plans.append({"for": "ruleset", "tool": None, "DO_NOT_CALL": "nothing to call",
                          "_notes": f"RRR ruleset already exists ({', '.join(p['policy']['rrr_rulesets'])}; {where}); the deny rules below target {rs}"})
        else:
            plans.append({"for": "ruleset", "tool": "create-ruleset", "DO_NOT_CALL": "draft for review", "name": rs,
                          "description": f"Rapid risk reduction drafts {p['date']}; unscoped (scopes: [] = all workloads)",
                          "scopes": []})
    for g, x1 in groups.items():
        if not x1:
            continue
        suffix, why = X1_GROUPS[g]
        ports = sorted({ap for l in x1 for ap in l["admin_ports"]})
        notes = {"why_override": "incident-grade block: must hold even where an allow rule admits the source",
                 "sources": why,
                 "would_have_blocked": {d: sum(l["would_have_blocked"][d] for l in x1) for d in DECISIONS}}
        if g == "internal":
            notes["identify_first"] = "an internal host the PCE cannot name is usually a scanner, a backup or monitoring host, a jump box or an unlabelled server; blocking it before identifying it can stop backups or monitoring"
        if g in ("listed", "internal"):
            lists = sorted({n for l in x1 for n in l["ip_lists"] if n not in default_lists})
            if lists:
                notes["named_lists"] = lists
                notes["existing_rules_naming_the_lists"] = sorted({f"{d['ruleset']} ({d['rule_type']}): {', '.join(d['consumers'])} -> {', '.join(d['providers'])}"
                                                                   for d in p["policy"]["deny_rules"] if any(f"iplist:{n}" in d["consumers"] for n in lists)})
                notes["admitting_allow_rules"] = sorted({r for l in x1 for r in l.get("admitting_rules", [])})
        if g == "listed":
            notes["warning"] = "override deny beats every allow rule that admits these lists; the list owner must agree"
        cov = cover_notes(x1)
        if cov:
            notes["already_covered"] = cov
        plans.append({"for": f"X1 ({g})", "tool": "create-deny-rule", "DO_NOT_CALL": "draft for review", "ruleset_name": rs,
                      "consumers": [f"iplist:RRR-unknown-admin-sources-{p['date']}{suffix}"], "providers": ["ams"],
                      "ingress_services": [{"port": int(ap.split('/')[0]), "proto": ap.split('/')[1]} for ap in ports],
                      "override_deny": True, "unscoped_consumers": True, "_notes": notes})
    for l in p["lines"]:
        if l["class"] == "X2":
            notes = {"enforced_on": f"managed workloads carrying env={l['src_env']} in selective or full enforcement",
                     "would_have_blocked": l["would_have_blocked"], "admitting_rules": l.get("admitting_rules", [])}
            cov = cover_notes([l])
            if cov:
                notes["already_covered"] = cov
            if l.get("directory_ports"):
                notes["directory_warning"] = directory_warning(l)
                notes["carve_out"] = {"tool": "create-rule", "DO_NOT_CALL": "draft for review, before the deny",
                                      "consumers": [f"env={l['src_env']}"],
                                      "providers": sorted({a for apps in l["directory_ports"].values() for a in apps}),
                                      "ingress_services": [{"port": int(ps.split('/')[0]), "proto": ps.split('/')[1]} for ps in l["directory_ports"]],
                                      "_notes": "an allow for the directory servers on these ports beats the plain deny; alternatively drop the ports from the deny"}
            plans.append({"for": f"X2 {l['src_env']}->{l['dst_env']}", "tool": "create-deny-rule", "DO_NOT_CALL": "draft for review",
                          "ruleset_name": rs, "consumers": [f"env={l['src_env']}"], "providers": [f"env={l['dst_env']}"],
                          "ingress_services": [{"port": int(ps.split('/')[0]), "proto": ps.split('/')[1]} for ps in l["ports"]],
                          "override_deny": False, "unscoped_consumers": True, "_notes": notes})
    for l in p["lines"]:
        if l["kind"] == "ringfence":
            base = {"app_name": l["app"], "env_name": l["env"], "lookback_days": p["window_days"]}
            plans.append({"for": f"{l['class']} {l['app']} ({l['env']})", "tool": "create-ringfence",
                          "DO_NOT_CALL": "the user's preview call, never this skill's", **base, "dry_run": True})
            plans.append({"for": f"{l['class']} {l['app']} ({l['env']})", "tool": "create-ringfence", "DO_NOT_CALL": "draft for review",
                          **base, "dry_run": False, "selective": True, "deny_consumer": "any",
                          "ruleset_name": f"RF-{l['app']}-{l['env']}",
                          "_notes": "allow rules for every observed inbound remote app with app and env labels; unlabelled and IP-list sources get no allow and hit the deny",
                          **({"_already_covered": cover_notes([l])} if cover_notes([l]) else {})})
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


def cover_notes(ls: list[dict]) -> dict:
    """For a call plan: the denies that already name these exposures, provisioned or drafted."""
    out = {}
    prov = sorted({c["text"] for l in ls for c in (l.get("cover") or {}).get("provisioned", [])})
    drafted = sorted({c["text"] for l in ls for c in (l.get("cover") or {}).get("drafted", [])})
    if prov:
        out["provisioned"] = prov
        out["provisioned_note"] = "a provisioned deny already names this and it reports allowed: check the enforcing side's mode and the rule's scope before adding another"
    if drafted:
        out["drafted"] = drafted
        out["drafted_note"] = "already drafted, not provisioned: review and provision that draft instead of creating another"
    return out


# -------------------------------------------------------------------- risk map

def bands(values: list) -> list[int]:
    """0 for zero, else 1 to 4 by percentile rank among the non-zero values: relative, so the
    shading works at any estate size without fixed thresholds."""
    nz = sorted(v for v in values if v)
    def band(v):
        if not v:
            return 0
        below = sum(1 for x in nz if x <= v)
        return min(4, 1 + int(4 * (below - 1) / max(1, len(nz))))
    return [band(v) for v in values]


def readiness(wl: dict, summary: dict | None, admin: dict | None, unknown: dict | None) -> dict:
    """Labelling readiness: labels are never assumed complete. Everything scoped (X2, X4, X5,
    the grid, the ringfences, the env denies) needs app and env on the workload; what lacks
    them is counted here and leads the plan when it is the majority."""
    lab = wl["labels"]
    n, both = lab["workloads"], lab["with_both"]
    unl = n - both
    traffic_unl = sum(r.get("connections", 0) for r in (summary or {}).get("app_to_app", [])
                      if r.get("from") == "unlabelled" or r.get("to") == "unlabelled")
    admin_unl = [r for r in admin_rows(admin) if (r["src_app"] and not r["src_env"]) or (r["dst_app"] and not r["dst_env"])
                 or (r["src_env"] and not r["src_app"]) or (r["dst_env"] and not r["dst_app"])]
    seen = ((unknown or {}).get("totals") or {}).get("unlabelled_workloads_seen")
    if not lab["label_columns"] or (n and both == 0):
        verdict = "not ready"
    elif unl:
        verdict = "partial"
    else:
        verdict = "ready"
    notes = []
    if not lab["label_columns"]:
        notes.append("the workload inventory has no app or env label column: nothing can be scoped, fenced or ranked by app until workloads are labelled")
    elif n and both == 0:
        notes.append("no workload carries both an app and an env label: nothing can be scoped, fenced or ranked by app until they do")
    elif unl:
        notes.append(f"{unl} of {n} workloads lack app or env ({n - lab['with_app']} without app, {n - lab['with_env']} without env; "
                     f"{modes_text(lab['unlabelled_modes'])}): they sit outside every grid row, ringfence and environment deny")
        if lab["app_without_env"]:
            notes.append("apps with workloads missing env: " + ", ".join(f"{a} ({c})" for a, c in lab["app_without_env"].most_common(6)))
    if traffic_unl:
        notes.append(f"{traffic_unl} connections in the estate summary involve an unlabelled workload")
    if admin_unl:
        notes.append(f"{len(admin_unl)} admin-port rows have an unlabelled side (the server reports it as '-'); they are not environment crossings")
    if seen:
        notes.append(f"{seen} unlabelled workloads were seen as peers of unknown sources")
    return {"verdict": verdict, "workloads": n, "labelled": both, "unlabelled": unl, "with_app": lab["with_app"], "with_env": lab["with_env"],
            "label_columns": lab["label_columns"], "unlabelled_modes": dict(lab["unlabelled_modes"]), "unlabelled_examples": lab["unlabelled_examples"],
            "traffic_connections_unlabelled": traffic_unl, "admin_rows_unlabelled": len(admin_unl), "unlabelled_seen_by_unknown_sources": seen,
            "share_labelled": round(both / n, 2) if n else None, "notes": notes}


def map_apps(summary: dict | None, lines: list[dict], ident: dict | None, wl: dict) -> list[dict]:
    """One row per app (env) with the six measures and their bands. Whole-window summary, not
    the 500-flow admin map."""
    un, cross, cross_apps = Counter(), Counter(), defaultdict(set)
    for r in (summary or {}).get("app_to_app", []):
        if r.get("policy") != "allowed":
            continue
        f, t = r.get("from"), r.get("to")
        te = env_of(t)
        if te is None:
            continue
        if isinstance(f, str) and f.startswith(UNMANAGED_PREFIXES):
            un[t] += r.get("connections", 0)
        elif env_of(f) not in (None, te):
            cross[t] += r.get("connections", 0)
            cross_apps[t].add(f)
    internal, public = defaultdict(set), defaultdict(set)
    for l in lines:
        if l["class"] == "X1":
            for a in l["peer_apps"]:
                (public if l["address_class"] == "public" else internal)[a].add(l["ip"])
    review = {f.get("identity") for f in (ident or {}).get("findings", []) if f.get("interest") == "review"}
    acct = defaultdict(set)
    for i in (ident or {}).get("identities", []):
        if i.get("identity") in review:
            for d in i.get("destinations") or []:   # top 10 per identity, so a lower bound
                if env_of(d.get("to")) is not None:
                    acct[d["to"]].add(i["identity"])
    wl_total = {f"{a} ({e})": v["workloads"] for (a, e), v in wl["apps"].items()}
    wl_off = {f"{a} ({e})": sum(c for m, c in v["modes"].items() if m not in ENFORCING) for (a, e), v in wl["apps"].items()}
    names = sorted(set(wl_total) | set(un) | set(cross))
    cols = {
        "unmanaged_inbound": [un[a] for a in names],
        "unmanaged_admin_sources": [len(internal[a]) + len(public[a]) for a in names],
        "cross_env_connections": [cross[a] for a in names],
        "cross_env_apps": [len(cross_apps[a]) for a in names],
        "wide_reach_accounts": [len(acct[a]) for a in names],
        "workloads_not_enforcing": [wl_off.get(a, 0) for a in names],
    }
    b = {k: bands(v) for k, v in cols.items()}
    rows = []
    for i, a in enumerate(names):
        row = {"app": a, "workloads": wl_total.get(a, 0), "crown_jewel": False,
               "public_admin_sources": len(public[a]), "internal_admin_sources": len(internal[a]),
               **{k: cols[k][i] for k in cols}, "bands": {k: b[k][i] for k in cols}}
        row["risk_rank_score"] = sum(row["bands"].values())
        rows.append(row)
    return rank_apps(rows)


def rank_apps(rows: list[dict]) -> list[dict]:
    return sorted(rows, key=lambda r: (not r["crown_jewel"], -r["risk_rank_score"], -r["cross_env_connections"], r["app"]))


def env_matrix(summary: dict | None) -> list[dict]:
    m: dict[tuple, Counter] = defaultdict(Counter)
    for r in (summary or {}).get("app_to_app", []):
        a, b = env_of(r.get("from")), env_of(r.get("to"))
        if a and b and a != b:
            m[(a, b)][r.get("policy")] += r.get("connections", 0)
    return sorted(({"from": a, "to": b, "allowed": c.get("allowed", 0), "potentially_blocked": c.get("potentially_blocked", 0), "blocked": c.get("blocked", 0)}
                   for (a, b), c in m.items()), key=lambda r: -r["allowed"])


def rule_drift(rs: dict | None, summary: dict | None, unknown: dict | None, admin: dict | None, wl: dict, window_start: str | None) -> tuple[list[dict], int]:
    """Enabled provisioned override denies, in enabled rulesets, whose named traffic is
    reported allowed. Plain denies are out: an allow rule legitimately beats them. Three rule
    shapes are checked; everything else (role labels, named services) is counted as unchecked."""
    found, unchecked = [], 0
    arows = admin_rows(admin)
    a2a = (summary or {}).get("app_to_app", [])
    endpoints = (unknown or {}).get("endpoints", [])
    for r in (rs or {}).get("rulesets", []):
        if not r.get("enabled"):
            continue
        scope = {(k, v) for s in rule_scopes(r) for k, v in s.items()}
        s_env = {v for k, v in scope if k == "env"}
        s_app = {v for k, v in scope if k == "app"}
        for rule in r.get("rules", []):
            if rule.get("rule_type") != "override_deny" or not rule.get("enabled"):
                continue
            cons = [actor_kind(a) for a in rule.get("consumers", [])]
            prov = [actor_kind(a) for a in rule.get("providers", [])]
            svcs = rule.get("ingress_services") or []
            all_svc = any((s.get("service") or {}).get("name") == "All Services" for s in svcs)
            ports = {(int(s["port"]), proto_name(s.get("proto"))) for s in svcs if s.get("port")}
            c_env = {v for k, v in cons if k == "env"}
            c_ip = [v for k, v in cons if k == "iplist" and not (v or "").startswith("Any")]
            p_all = ("all", None) in prov
            p_env = {v for k, v in prov if k == "env"}
            n, basis, enforced = None, None, None
            if all_svc and c_env and (p_all or p_env):
                n = sum(x.get("connections", 0) for x in a2a if x.get("policy") == "allowed"
                        and env_of(x.get("from")) in c_env and env_of(x.get("to")) and (p_all or env_of(x.get("to")) in p_env)
                        and (not s_env or env_of(x.get("to")) in s_env) and (not s_app or parse_identity(x.get("to"))[0] in s_app)
                        and env_of(x.get("from")) != env_of(x.get("to")))
                basis = "window, all ports"
                modes = Counter()
                for e in c_env:
                    modes.update(wl["env_modes"].get(e, Counter()))
                enforced = f"source workloads env={', env='.join(sorted(c_env))}: {modes_text(modes)}"
            elif all_svc and c_ip and p_all:
                n = sum(((e.get("as_source") or {}).get("policy") or {}).get("allowed", 0)
                        for e in endpoints if set(c_ip) & set(e.get("ip_lists") or []))
                basis = "window, all ports, top endpoints only"
                enforced = f"destination workloads (all): {modes_text(wl['modes_total'])}"
            elif ports and c_env and p_all and s_app:
                n = sum(x["num_connections"] for x in arows if x["policy_decision"] == "allowed"
                        and x["src_env"] in c_env and x["dst_app"] in s_app and (not s_env or x["dst_env"] in s_env)
                        and (x["port"], x["proto"]) in ports)
                basis = "admin-port sample"
                modes = Counter()
                for e in c_env:
                    modes.update(wl["env_modes"].get(e, Counter()))
                enforced = f"source workloads env={', env='.join(sorted(c_env))}: {modes_text(modes)}"
            else:
                unchecked += 1
                continue
            if n:
                upd = rule.get("updated_at")
                found.append({"ruleset": r.get("name"), "rule_href": rule.get("href"),
                              "consumers": [actor_text(a) for a in rule.get("consumers", [])],
                              "providers": [actor_text(a) for a in rule.get("providers", [])],
                              "services": [service_text(s) for s in svcs],
                              "allowed_connections": n, "basis": basis, "enforced_on": enforced,
                              "rule_updated_at": upd, "changed_in_window": bool(upd and window_start and str(upd) >= str(window_start))})
    return sorted(found, key=lambda x: -x["allowed_connections"]), unchecked


def draft_state(da: dict | None) -> dict:
    """compare-draft-active: in sync, or a count of pending changes (the lists may be empty)."""
    if not da:
        return {"available": False}
    if da.get("status") == "in_sync":
        return {"available": True, "pending": 0, "created": 0, "updated": 0, "deleted": 0}
    return {"available": True, "pending": int(da.get("total_pending_changes") or 0), "created": int(da.get("created_count") or 0),
            "updated": int(da.get("updated_count") or 0), "deleted": int(da.get("deleted_count") or 0)}


def fix_first(rm: dict, lines: list[dict], crown: list[str]) -> list[str]:
    """Three to five sentences, each only when its evidence exists, in a fixed order. Nothing
    here is hard-coded to an app."""
    out = []
    ready = rm["readiness"]
    label_first = ready["verdict"] == "not ready" or (ready["workloads"] and ready["unlabelled"] * 2 >= ready["workloads"])
    label_sentence = None
    if ready["verdict"] != "ready":
        if ready["verdict"] == "not ready":
            label_sentence = ("Label the workloads first: " + (ready["notes"][0] if ready["notes"] else "no app and env labels") +
                             ". Until then the plan can only block unknown admin-port sources and watch public sources and identities.")
        else:
            label_sentence = (f"Label the {ready['unlabelled']} workloads without app or env ({', '.join(ready['unlabelled_examples'][:4])}"
                              f"{', ...' if len(ready['unlabelled_examples']) > 4 else ''}): they are outside every ringfence, environment deny and grid row.")
    if label_first and label_sentence:
        out.append(label_sentence)
    h = rm["headline"]
    if rm["rule_drift"]:
        names = ", ".join(d["ruleset"] for d in rm["rule_drift"][:3])
        out.append(f"Explain why {len(rm['rule_drift'])} enabled provisioned override den{'y' if len(rm['rule_drift']) == 1 else 'ies'} ({names}) "
                   f"{'does' if len(rm['rule_drift']) == 1 else 'do'} not show as blocked in the traffic: a provisioned override deny on an enforcing workload reports blocked, "
                   "so check the enforcing side's mode, the rule's scope and its update time; every later step relies on rules biting.")
    pol = rm.get("policy") or {}
    ex = pol.get("exposures") or {}
    if pol.get("view") == "draft" and ex.get("drafted"):
        pend = pol["pending"]
        out.append(f"Review and provision the draft: {ex['drafted']} of the {ex['total']} exposures below already have a draft deny or ringfence"
                   + (f" ({pend['pending']} pending change{'s' if pend['pending'] != 1 else ''} in all)" if pend.get("available") else "")
                   + "; that is finished work waiting on provision-policy.")
    internal = [l for l in lines if l["class"] == "X1" and l["address_class"] != "public"]
    if internal:
        widest = max(internal, key=lambda l: (l["peer_workloads"], l["would_have_blocked"]["allowed"]))
        out.append(f"Identify the {len(internal)} internal host{'s' if len(internal) > 1 else ''} on admin ports, starting with {widest['ip']}"
                   f"{' (' + widest['fqdn'] + ')' if widest.get('fqdn') else ''}, which reaches {widest['peer_workloads']} workloads; then label each one or block it.")
    top = [r["app"] for r in rm["apps"][:1]]
    targets = set(crown) | set(top)
    x2 = [l for l in lines if l["class"] == "X2"]
    hit = [(l, a) for l in x2 for a in l["dst_apps"] if a in targets]
    if hit:
        l, a = max(hit, key=lambda la: la[0]["would_have_blocked"]["allowed"] + la[0]["would_have_blocked"]["potentially_blocked"])
        out.append(f"Narrow the admin-port crossing env={l['src_env']} to env={l['dst_env']} into {a} ({', '.join(l['ports'][:6])}), "
                   "keeping Kerberos, LDAP and SMB to the directory servers open.")
    if h["unmanaged_admin_public"]:
        out.append(f"Block the {h['unmanaged_admin_public']} public source{'s' if h['unmanaged_admin_public'] > 1 else ''} on admin ports with the override deny from the X1 list.")
    if h["workloads"] and not h["full_enforcement"]:
        three = ", ".join(r["app"] for r in rm["apps"][:3])
        if three:
            out.append(f"No workload is in full enforcement: fence {three} first and move them to full enforcement.")
    if label_sentence and not label_first:
        out.append(label_sentence)
    return out[:6]


def takeaway(rm: dict) -> str:
    h, ready = rm["headline"], rm["readiness"]
    if ready["verdict"] == "not ready":
        return "The estate is not ready for scoped fixes: " + (ready["notes"][0] if ready["notes"] else "workloads carry no app and env labels") + "."
    parts = []
    top = [r["app"] for r in rm["apps"][:3] if r["risk_rank_score"]]
    if top:
        parts.append("most exposure sits in " + ", ".join(top))
    if rm["env_matrix"]:
        m = rm["env_matrix"][0]
        parts.append(f"the largest environment crossing is {m['from']} to {m['to']} with {m['allowed']:,} allowed connections")
    if h["unmanaged_admin_sources"]:
        parts.append(f"{h['unmanaged_admin_sources']} unmanaged sources reach workloads on admin ports")
    if rm["rule_drift"]:
        parts.append(f"{len(rm['rule_drift'])} override den{'y does' if len(rm['rule_drift']) == 1 else 'ies do'} not show in traffic")
    if ready["verdict"] == "partial":
        parts.append(f"{ready['unlabelled']} of {ready['workloads']} workloads are unlabelled")
    pol = rm.get("policy") or {}
    if pol.get("view") == "draft" and pol["exposures"]["total"]:
        parts.append(f"{pol['exposures']['drafted']} of {pol['exposures']['total']} fixes are already drafted and wait for provisioning")
    if not parts:
        return "No exposure stands out in this window."
    return (parts[0][0].upper() + parts[0][1:]) + ("; " + "; ".join(parts[1:]) if len(parts) > 1 else "") + "."


def risk_map(data: dict, wl: dict, lines: list[dict], window_start: str | None, lateral_days: int | None, policy: dict | None = None) -> dict:
    lat = data.get("lateral") or {}
    nodes = lat.get("top_reachable_nodes") or []
    total_apps = lat.get("total_apps")
    wide = (sum(1 for n in nodes if n.get("reachable_apps", 0) >= 0.75 * total_apps) if nodes and total_apps else None)
    x1 = [l for l in lines if l["class"] == "X1"]
    drifted, unchecked = rule_drift(data.get("rulesets"), data.get("summary"), data.get("unknown"), data.get("admin_ports"), wl, window_start)
    modes = wl["modes_total"]
    rm = {
        "readiness": readiness(wl, data.get("summary"), data.get("admin_ports"), data.get("unknown")),
        "headline": {"workloads": sum(modes.values()), "full_enforcement": modes.get("full", 0), "selective": modes.get("selective", 0),
                     "not_enforcing": sum(v for k, v in modes.items() if k not in ENFORCING),
                     "unmanaged_admin_sources": len(x1),
                     "unmanaged_admin_internal": sum(l["address_class"] != "public" for l in x1),
                     "unmanaged_admin_public": sum(l["address_class"] == "public" for l in x1),
                     "apps_in_graph": total_apps, "wide_reach_apps": wide, "wide_reach_lower_bound": len(nodes) >= 20,
                     "lateral_days": lateral_days,
                     "override_denies_not_showing": len(drifted), "override_denies_unchecked": unchecked},
        "apps": map_apps(data.get("summary"), lines, data.get("identities"), wl),
        "env_matrix": env_matrix(data.get("summary")),
        "rule_drift": drifted,
        "draft_active": draft_state(data.get("draft_active")),
        "policy": policy or {},
        "inputs": {"summary": data.get("summary") is not None, "lateral": bool(nodes), "rulesets": data.get("rulesets") is not None,
                   "identities": bool((data.get("identities") or {}).get("identities")), "unknown": data.get("unknown") is not None},
        "apps_without_env_excluded": wl["labels"]["workloads"] - wl["labels"]["with_both"],
    }
    return rm


def pin_crown(rm: dict, crown: list[tuple], lines: list[dict]) -> None:
    names = {f"{a} ({e})" for a, e in crown}
    for r in rm["apps"]:
        r["crown_jewel"] = r["app"] in names
    rm["apps"] = rank_apps(rm["apps"])
    rm["fix_first"] = fix_first(rm, lines, sorted(names))
    rm["takeaway"] = takeaway(rm)


# --------------------------------------------------------------------- outputs

WHY = {
    "X1": "A host the PCE does not know as a workload is reaching workloads on administrative ports. "
          "That is how lateral movement and ransomware staging look from the network: no VEN, no label, no owner.",
    "X2": "Administrative protocols crossing an environment boundary let a compromise in one environment "
          "reach another through the ports attackers use first.",
    "X4": "A bridge app connects groups of applications that would otherwise be isolated; a compromise "
          "there reaches the most apps in the fewest hops.",
    "X5": "The app is not enforcing, yet policy already marks inbound traffic to it as blocked or potentially "
          "blocked: the decision has been made and is not being applied.",
    "X3": "A public address reaches workloads directly: the listener is internet-exposed, admitted by a rule or "
          "a broad IP list.",
    "X6": "An interactive account active from many workloads or reaching many apps is a shared credential or an "
          "over-reaching user; policy cannot name an identity, so this is a question for the owner.",
}


def directory_warning(l: dict) -> str:
    parts = [f"{p} ({DIRECTORY_PORTS[int(p.split('/')[0])]}) to {', '.join(apps)}" for p, apps in l["directory_ports"].items()]
    return ("the deny carries " + "; ".join(parts)
            + ": denying these from a user or client environment breaks logins; add an allow for the directory servers on these ports above the deny, or drop the ports")


def not_admitted_text(l: dict) -> str:
    na = l["would_have_blocked"].get("allowed_not_admitted", 0)
    if not na:
        return ""
    return (f"; {na} of the allowed connections are admitted by no provisioned allow rule and the enforcing side ({l.get('enforcing_side', '?')}) "
            f"is wholly in selective enforcement, which reports everything a deny does not catch as allowed: the deny would catch them without contradicting a rule")


def action(l: dict) -> str:
    """One clause for tables: what to do, when. A drafted cover replaces the action (the work
    left is to provision); a provisioned cover is appended (it reports allowed: review)."""
    when = "today" if l.get("bucket") == "today" else "this week"
    c = l.get("cover") or {}
    if c.get("drafted"):
        s = (f"provision the drafted {c['drafted'][0]['rule_type'].replace('_', ' ')} in {c['drafted'][0]['ruleset']}, {when}"
             + ("; identify the source first" if l["class"] == "X1" and l.get("address_class") != "public" else ""))
    else:
        s = action_base(l, when)
    if c.get("provisioned"):
        s += f"; a provisioned {c['provisioned'][0]['rule_type'].replace('_', ' ')} in {c['provisioned'][0]['ruleset']} already names it and reports allowed: check enforcement mode and scope"
    return s


def action_base(l: dict, when: str) -> str:
    if l["class"] == "X1":
        if l.get("address_class") != "public":
            return f"identify the source, then label it or override deny it from an IP list to all workloads on {', '.join(l['admin_ports'])}, {when}"
        return f"override deny from an IP list of the source to all workloads on {', '.join(l['admin_ports'])}, {when}" + (" after review" if l["ease"] < 4 else "")
    if l["class"] == "X2":
        return f"deny env={l['src_env']} -> env={l['dst_env']} on {', '.join(l['ports'])}, {when}" + (" after review" if l["ease"] < 4 else "") + ("; carve out the directory ports" if l.get("directory_ports") else "")
    return f"selective ringfence RF-{l['app']}-{l['env']}, deny_consumer any, {when}" + ("; then selective enforcement" if "visibility" in l["why"] else "")


def recommendation(l: dict) -> str:
    wb = l["would_have_blocked"]
    when = "today" if l.get("bucket") == "today" else "this week"
    if l["class"] == "X1":
        r = (f"Draft an override deny from an IP list holding {l['ip']} to all workloads on {', '.join(l['admin_ports'])} "
             f"in {l['ruleset']} ({when}). Override deny on purpose: it must hold even where an allow admits the source.")
        if l.get("address_class") != "public":
            r += (" Identify the host first: an internal address the PCE cannot name is usually a scanner, a backup or monitoring host, "
                  "a jump box or an unlabelled server; label it if it belongs, keep the deny if it does not.")
        if l["ip_lists"]:
            r += f" It is on the list{'s' if len(l['ip_lists']) > 1 else ''} {', '.join(l['ip_lists'])}; a rule admits it on purpose, so the list owner confirms first."
        if wb["allowed"] and l["ease"] < 4:
            r += f" {wb['allowed']} allowed connections would stop; confirm admin access from this source may end first."
        if l.get("admitting_rules"):
            r += " Admitted today by: " + "; ".join(l["admitting_rules"]) + "."
        return r + cover_text(l)
    if l["class"] == "X2":
        r = (f"Draft a deny env={l['src_env']} -> env={l['dst_env']} on {', '.join(l['ports'])} in {l['ruleset']} ({when}); "
             f"enforced on managed workloads carrying env={l['src_env']} in selective or full enforcement.")
        if wb["allowed"] and l["ease"] < 4:
            r += (f" {wb['allowed']} allowed connections would stop, admitted by: "
                  + ("; ".join(l.get("admitting_rules") or []) or "no rule naming these envs (a broader rule or an IP list)") + "; confirm first.")
        if l.get("directory_ports"):
            r += " Warning: " + directory_warning(l) + "."
        return r + cover_text(l)
    al = l["allow_list"]
    r = (f"Preview, then draft a selective ringfence RF-{l['app']}-{l['env']} with deny_consumer any ({when}): "
         f"allow rules for {len(al['remote_apps'])} observed inbound remote apps ({al['already_allowed']} already allowed), "
         f"a deny for everything else, enforced at the app's own workloads.")
    if not al["remote_apps"]:
        r += " No inbound app traffic was observed, so the fence denies all inbound."
    if al["no_rule_possible"]["connections"]:
        r += f" {al['no_rule_possible']['connections']} connections from unlabelled or IP-list sources get no allow and will hit the deny; label or list them first if they matter."
    if "visibility" in l["why"]:
        r += f" Then move the app's {l['why']['visibility']['workloads_not_enforcing']} non-enforcing workloads to selective enforcement (update-workload, not drafted here)."
    if l["already_fenced"]:
        r += " A ringfence is already provisioned for this app; review why its deny does not show before adding another."
    return r + cover_text(l)


def watch_action(w: dict) -> str:
    return "find the admitting rule or list and narrow it" if w["class"] == "X3" else "confirm the account's reach with its owner"


def watch_recommendation(w: dict) -> str:
    if w["class"] == "X3":
        base = f"No draft rule. Find the rule or list admitting {w['ip']}: {', '.join(w['ip_lists']) or 'the default Any list or a broad rule'}; narrow it or add the address to a named list."
        return base + (" Its admin ports are covered by the X1 override deny." if w.get("also_x1") else "")
    return (f"No Illumio rule can name an identity. Confirm with the owner whether {w['identity']} should be active from "
            f"{w['observed_on_workloads']} workloads across {w['distinct_apps']} apps"
            + (f"; the admin ports it uses ({', '.join(w['admin_ports'])}) are what the X1 and X2 denies narrow." if w["admin_ports"] else "."))


def wb_text(m: dict) -> str:
    return f"{m.get('allowed', 0)}/{m.get('potentially_blocked', 0)}/{m.get('blocked', 0)}"


def wb_note(m: dict) -> str:
    na = m.get("allowed_not_admitted", 0)
    return f"; {na} of the allowed are admitted by no provisioned rule" if na else ""


def line_text(l: dict) -> str:
    radius = {"X1": f"{l.get('peer_workloads', 0)} workloads, {l.get('peers_enforced', 0)} enforced",
              "X2": f"{len(l.get('dst_apps', []))} destination apps"}.get(l["class"], None)
    wb = f"would have blocked {wb_text(l['would_have_blocked'])} (allowed/potentially blocked/blocked){wb_note(l['would_have_blocked'])}"
    if l["kind"] == "ringfence":
        radius = (f"reaches {l['why']['bridge']['reachable_apps']} apps, " if "bridge" in l["why"] else "") + f"{l['workloads']} workloads"
        wb = f"deny would catch {wb_text(l['would_have_blocked'])} (allowed/potentially blocked/blocked) from sources with no allow rule"
    return (f"**{l['score']}** | {l['class']} {l['title']} | blast radius {l['blast_radius']} ({radius}) | "
            f"{wb} | evidence: {'; '.join(l['evidence'])} | rollback: {l['rollback']}")


def modes_text(modes: dict) -> str:
    return ", ".join(f"{k} {v}" for k, v in sorted(modes.items())) or "no workloads"


def details(l: dict) -> list[str]:
    if l["class"] == "X1":
        return [f"  - override deny on purpose; source {l['ip']}{' ' + l['fqdn'] if l.get('fqdn') else ''} is {l['address_class']}"
                + ("" if l["address_class"] == "public" else " (identify first)") + ", "
                f"lists: {', '.join(l['ip_lists']) or 'none'}, profile: {', '.join(l.get('profile') or [])}; allowed into enforced workloads: {l['allowed_into_enforced']}; "
                f"peer apps: {', '.join(l['peer_apps'][:6])}"
                + (f"; {l['would_have_blocked']['allowed']} allowed connections would stop: confirm admin access from this source may end" if l["would_have_blocked"]["allowed"] and l["ease"] < 4 else "")
                + (f"; admitted by: {'; '.join(l['admitting_rules'])}" if l.get("admitting_rules") else "")
                + not_admitted_text(l) + cover_text(l, True)]
    if l["class"] == "X2":
        return [f"  - ports seen: {', '.join(l['ports_seen'])}; app pairs: " + "; ".join(f"{a['from']} -> {a['to']} {a['policy']} {a['connections']}" for a in l["app_pairs"][:5])
                + (f"; {l['would_have_blocked']['allowed']} allowed connections would stop: confirm they may, admitted by: "
                   + ("; ".join(l.get("admitting_rules") or []) or "no allow rule found naming these envs (a broader rule or an IP list)") if l["would_have_blocked"]["allowed"] and l["ease"] < 4 else "")
                + not_admitted_text(l)
                + (f"; warning: {directory_warning(l)}" if l.get("directory_ports") else "") + cover_text(l, True)]
    al = l["allow_list"]
    why = " and ".join(filter(None, [f"bridge reaching {l['why']['bridge']['reachable_apps']} apps" if "bridge" in l["why"] else "",
                                    f"{l['why']['visibility']['workloads_not_enforcing']} workloads not enforcing with {l['why']['visibility']['denied_inbound_connections']} denied inbound connections" if "visibility" in l["why"] else ""]))
    return [f"  - why: {why}; enforcement: {modes_text(l['enforcement'])}; allow list: {len(al['remote_apps'])} remote apps, {al['already_allowed']} already allowed"
            + ("; no inbound app traffic observed, so the fence denies all inbound" if not al["remote_apps"] else "")
            + f"; no rule possible for {al['no_rule_possible']['connections']} connections from unlabelled or IP-list sources (they hit the deny)"
            + ("; a ringfence is already provisioned, review why its deny does not show" if l["already_fenced"] else "")
            + (f"; scoped rulesets: {', '.join(l['scoped_rulesets'])}" if l["scoped_rulesets"] else "") + cover_text(l, True)]


def header_notes(p: dict) -> list[str]:
    """Header lines shared by the plan and the report: caps, the admin-map span, the lateral
    window, the unknown-endpoint coverage and the labelling readiness."""
    L = []
    caps = [k for k, v in p["truncated"].items() if v]
    L.append("Counts are lower bounds on: " + ", ".join(caps) + "." if caps else "No query hit its cap.")
    span = p.get("admin_span") or {}
    if p["truncated"].get("admin_ports") and span.get("start"):
        L.append(f"The admin-port map hit the 500-flow cap and covers {span['start']} to {span['end']}"
                 + (f" ({span['days']} day{'s' if span['days'] != 1 else ''} of the {p['window_days']}-day window)" if span.get("days") else "")
                 + "; X2 lines are a sample of that span.")
    uc = p.get("unknown_coverage") or {}
    if uc.get("returned") and uc.get("unknown_endpoints") and uc["returned"] < uc["unknown_endpoints"]:
        L.append(f"Unknown endpoints: the {uc['returned']} busiest of {uc['unknown_endpoints']} were read, so X1 and X3 counts are lower bounds.")
    if p.get("lateral_days") and p["lateral_days"] != p["window_days"]:
        L.append(f"Lateral movement was read over {p['lateral_days']} days, not the {p['window_days']}-day window (the longer query timed out).")
    r = p["risk_map"]["readiness"]
    L.append(f"Labelling readiness: {r['verdict']}" + (f", {r['labelled']} of {r['workloads']} workloads carry app and env" if r["workloads"] else "")
             + ("; " + "; ".join(r["notes"]) if r["notes"] else "") + ".")
    L.append(p["risk_map"]["policy"]["text"])
    return L


def map_line(rm: dict) -> str:
    top = ", ".join(r["app"] for r in rm["apps"][:3])
    s = "Where the risk sits: " + (top if top else "no app could be ranked")
    if rm["env_matrix"]:
        m = rm["env_matrix"][0]
        s += f"; largest crossing {m['from']} to {m['to']}, {m['allowed']:,} allowed connections"
    if rm["rule_drift"]:
        s += f"; {len(rm['rule_drift'])} override den{'y' if len(rm['rule_drift']) == 1 else 'ies'} not showing in traffic"
    pol = rm.get("policy") or {}
    if pol.get("view") == "draft" and pol["exposures"]["total"]:
        s += f"; {pol['exposures']['drafted']} of {pol['exposures']['total']} fixes already drafted, {pol['exposures']['none']} to draft"
    return s + "."


def baseline_text(bl: dict) -> str:
    s = (f"Blocked and potentially blocked flows per {bl['bucket']} over {bl['days']} buckets: median {bl['median_nonzero']}, total {bl['total_flows']}"
         + (" (capped; lower bound)" if bl.get("truncated") else "") + ".")
    if bl.get("effective_bucket") and bl["effective_bucket"] != bl["bucket"]:
        s += f" Explorer rows span more than one bucket; the server says the data supports {bl['effective_bucket']} buckets" + (f": {bl['resolution_note']}" if bl.get("resolution_note") else ".")
    return s


def write_plan_md(path: pathlib.Path, p: dict) -> None:
    L = [f"# Rapid risk reduction plan, {p['date']}: {p['window'].get('start') or '?'} to {p['window'].get('end') or '?'}\n"]
    L.append(f"Production environments: {', '.join(p['production_envs']) or 'none identified (pass --prod-env)'}.")
    L.append(f"Crown jewels: {', '.join(f'{a} ({e})' for a, e in p['crown_jewels']) or 'none'} ({p['crown_jewels_source']}).")
    L.append(f"Inputs read: {', '.join(k for k, v in p['inputs'].items() if v)}; missing: {', '.join(k for k, v in p['inputs'].items() if not v) or 'none'}.")
    L += header_notes(p)
    rrr_prov = [x for x in p["policy"]["rrr_rulesets"] if x not in (p["policy"].get("rrr_rulesets_drafted") or [])]
    rrr_draft = p["policy"].get("rrr_rulesets_drafted") or []
    L.append(f"Draft ruleset: `{p['ruleset_name']}`" + (f" (RRR ruleset already provisioned: {', '.join(rrr_prov)})" if rrr_prov else "") + (f" (RRR ruleset already drafted, not provisioned: {', '.join(rrr_draft)})" if rrr_draft else "")
             + ". Nothing below is provisioned. Every rule is a draft to review; rollback is deleting it from the draft.")
    b = p["buckets"]
    L.append(f"\n{len(p['lines'])} exposures with a draft fix: {len(b['today'])} to block today, {len(b['week'])} to fence this week, "
             f"{len(p['crown_jewels'])} isolation runbooks, {len(p['watch'])} to watch.")
    L.append(map_line(p["risk_map"]) + "\n")
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
        L.append(baseline_text(bl))
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


def line_detail(l: dict) -> str:
    t = details(l)[0].strip().lstrip("- ").strip()
    return t[5:] if t.startswith("why: ") else t


def write_report_md(path: pathlib.Path, p: dict) -> None:
    b = p["buckets"]
    L = [f"# Rapid risk reduction report, {p['date']}\n",
         f"Window {p['window'].get('start') or '?'} to {p['window'].get('end') or '?'} ({p['window_days']} days). "
         f"Production environments: {', '.join(p['production_envs']) or 'none identified'}. "
         f"Crown jewels: {', '.join(f'{a} ({e})' for a, e in p['crown_jewels']) or 'none'} ({p['crown_jewels_source']}). "
         f"Draft ruleset `{p['ruleset_name']}`. Nothing in this report is created or provisioned."]
    L += header_notes(p)
    L.append("\n## 1. Executive summary\n")
    allowed_stop = sum(l["would_have_blocked"].get("allowed", 0) for l in b["today"] + b["week"] if l["kind"] != "ringfence")
    L.append(f"{len(p['lines'])} exposures have a draft fix: {len(b['today'])} can be blocked today with little chance of breaking anything, "
             f"{len(b['week'])} need a review or a ringfence this week, {len(p['crown_jewels'])} crown-jewel app{'s have' if len(p['crown_jewels']) != 1 else ' has'} an isolation runbook in reserve, "
             f"and {len(p['watch'])} observations have no rule to draft. Across every deny line, {allowed_stop} currently allowed connections would stop; "
             f"everything else the rules touch is already blocked or admitted by no rule.")
    top = sorted(p["lines"], key=lambda l: -l["score"])[:3]
    for l in top:
        L.append(f"- **{l['score']}** {l['class']} {l['title']}: {l['action']}.")
    L += report_map_section(p["risk_map"])
    L.append("\n## 2. Risk register\n")
    L.append("| # | Risk | Score | Blast radius | Ease | Would have blocked (allowed/pb/blocked) | Recommended action | When |")
    L.append("| --- | --- | --- | --- | --- | --- | --- | --- |")
    for i, l in enumerate(sorted(p["lines"], key=lambda l: -l["score"]), 1):
        L.append(f"| {i} | {l['class']} {l['title']} | {l['score']} | {l['blast_radius']} | {l['ease']} | {wb_text(l['would_have_blocked'])} | {l['action']} | {'today' if l['bucket'] == 'today' else 'this week'} |")
    for w in p["watch"]:
        L.append(f"| – | {w['class']} {w.get('ip') or w.get('identity')} | – | {w['blast_radius']} | – | – | watch: {w['action']} | now |")
    L.append("\nScore = blast radius x ease (1 to 25); see references/scoring.md for the thresholds. Would have blocked counts the window's connections the rule matches, by policy decision: allowed is what would really stop, the rest is what the rule makes permanent.")
    L.append("\n## 3. Risks in detail\n")
    for l in sorted(p["lines"], key=lambda l: -l["score"]):
        cls = l["class"].split("+")[0]
        L.append(f"### {l['score']} · {l['class']} {l['title']}\n")
        L.append(f"**Risk.** {WHY.get(cls, '')}")
        L.append(f"\n**What we saw.** {line_detail(l)}")
        L.append(f"\n**Evidence.** {'; '.join(l['evidence'])}. Blast radius {l['blast_radius']}, ease {l['ease']}, would have blocked {wb_text(l['would_have_blocked'])} (allowed/potentially blocked/blocked){wb_note(l['would_have_blocked'])}.")
        L.append(f"\n**Recommendation.** {l['recommendation']}")
        L.append(f"\n**Rollback.** {l['rollback']}.\n")
    L.append("## 4. Observations without a rule\n")
    for w in p["watch"]:
        cls = w["class"]
        who = (f"{w['ip']}{' ' + w['fqdn'] if w.get('fqdn') else ''}" if cls == "X3" else w["identity"])
        seen = (f"reaches {w['peer_workloads']} workloads on {', '.join(w['ports']) or 'admin ports only'}; allowed into enforced: {w['allowed_into_enforced']}; "
                f"admitted by: {', '.join(w['ip_lists']) or 'no named list'}" if cls == "X3"
                else f"{'; '.join(w['why'])}; {w['observed_on_workloads']} workloads, {w['distinct_apps']} apps" + (f"; admin ports {', '.join(w['admin_ports'])}" if w["admin_ports"] else ""))
        L.append(f"### {cls} {who}\n\n**Risk.** {WHY.get(cls, '')}\n\n**What we saw.** {seen}.\n\n**Recommendation.** {w['recommendation']}\n")
    if not p["watch"]:
        L.append("None.\n")
    L.append("## 5. Isolation runbooks (incident use only)\n")
    for app, env in p["crown_jewels"]:
        n = p["crown_jewel_workloads"].get(f"{app} ({env})", 0)
        L.append(f"- **EMERGENCY-ISOLATE-{app}-{env}** ({n} workloads in inventory{'; not found, check the label values' if not n else ''}): "
                 f"get-labels, create-ruleset scoped to the app, create-deny-rule with override_deny true (providers ams, consumers ams and Any, All Services, unscoped_consumers true), "
                 f"an optional outbound rule in an unscoped ruleset, then provision-policy. Effect: all traffic to the app stops, allow rules included. Undo: delete the override deny rules and provision again.")
    if not p["crown_jewels"]:
        L.append("None: no crown jewels given and no production bridge app; name one as app (env) and re-run.")
    L.append("\n## 6. Baseline and 7-day review\n")
    bl = p["baseline"]
    if bl.get("available"):
        L.append(baseline_text(bl) + " "
                 + (f"No spike quoted: {bl['caveat']}" if bl.get("caveat") else f"Worst spike {bl['worst']['bucket_start']} with {bl['worst']['flows']} flows, {bl['worst']['multiple']}x the median." if bl.get("worst") else "No bucket above 3x the median."))
    else:
        L.append("No timeline saved; run get-traffic-timeline for the baseline.")
    L.append("Re-run the timeline 7 days after provisioning: blocked rows should rise and potentially blocked fall, and nothing else should move. Re-run this skill with the same window; lines whose rule is active should show their traffic as blocked.")
    L.append("\n## 7. Method and semantics\n")
    L.append(f"{'Ten' if p['policy_view'] == 'draft' else 'Nine'} read-only illumio-mcp pulls over one window: workloads, the estate traffic summary, the admin-port flows grouped by app pair and port, lateral-movement paths, unknown endpoints, the identity graph, the provisioned rulesets{' and the draft rulesets' if p['policy_view'] == 'draft' else ''}, the draft-to-active comparison and the blocked timeline. "
             "Override deny is evaluated before allow rules and is used only for unknown admin-port sources and the runbooks. A regular deny catches what no allow admits and needs selective or full enforcement to bite. "
             "A selective ringfence needs its deny rule. Deny rules with a label consumer are enforced on the source workloads; with an IP-list consumer at the destination, which is why deny_consumer any is the safest flavour. "
             "Scores use the provisioned rules, the policy the reported decisions come from. Selective enforcement reports everything a deny does not catch as allowed, so an allowed connection that no provisioned allow rule admits counts as deny-safe in the ease score; full enforcement and visibility report allowed only when a rule matched. "
             "Labels are not assumed complete: workloads without app and env are counted as a readiness gap and kept out of every scoped finding. "
             "Rollback of any draft is deleting it; nothing here is provisioned. Call plans are in call-plans.md, every block marked DO_NOT_CALL.")
    path.write_text("\n".join(L) + "\n")


def report_map_section(rm: dict) -> list[str]:
    """'Where the risk sits', directly after the executive summary: the same figures as the
    dashboard's Risk map tab and plan.md's map line, read from one risk_map block."""
    h, r = rm["headline"], rm["readiness"]
    L = ["\n## 1a. Where the risk sits\n", rm["takeaway"], ""]
    L.append(f"**Readiness.** {r['verdict']}" + (f": {r['labelled']} of {r['workloads']} workloads carry app and env labels" if r["workloads"] else "")
             + ("; " + "; ".join(r["notes"]) if r["notes"] else "") + ".")
    L.append(f"\n**Headline.** {h['workloads']} workloads: {h['full_enforcement']} in full enforcement, {h['selective']} selective, {h['not_enforcing']} not enforcing. "
             f"{h['unmanaged_admin_sources']} unmanaged sources on admin ports" + (f" ({h['unmanaged_admin_internal']} internal, {h['unmanaged_admin_public']} public)" if h["unmanaged_admin_public"] else (" (all internal)" if h["unmanaged_admin_sources"] else "")) + ". "
             + (f"{h['wide_reach_apps']} of {h['apps_in_graph']} apps reach at least three quarters of the estate" + (" (the reach list is capped at 20, so a lower bound)" if h.get("wide_reach_lower_bound") else "") + f", over {h['lateral_days']} days. " if h.get("wide_reach_apps") is not None else "Reach not available (no lateral-movement result). ")
             + f"{h['override_denies_not_showing']} override denies do not show in traffic, {h['override_denies_unchecked']} could not be checked.")
    L.append("\n**Apps, ranked.** Measures over the window; the map rank score is the sum of the percentile bands of the six measures (0 to 24) and is not the plan score (blast radius x ease)."
             + (f" {rm['apps_without_env_excluded']} workloads without app or env are outside the grid." if rm.get("apps_without_env_excluded") else ""))
    if rm["apps"]:
        L.append("\n| App | Workloads | Unmanaged inbound | Unmanaged admin sources | Cross-env connections | Cross-env apps | Wide-reach accounts | Not enforcing | Map rank score |")
        L.append("| --- | --- | --- | --- | --- | --- | --- | --- | --- |")
        for a in rm["apps"][:12]:
            L.append(f"| {a['app']}{' (crown jewel)' if a['crown_jewel'] else ''} | {a['workloads']} | {a['unmanaged_inbound']:,} | {a['unmanaged_admin_sources']} | {a['cross_env_connections']:,} | {a['cross_env_apps']} | {a['wide_reach_accounts']} | {a['workloads_not_enforcing']} | {a['risk_rank_score']} |")
    else:
        L.append("\nNo app could be ranked" + ("" if rm["inputs"]["summary"] else " (no estate summary)") + ".")
    L.append("\n**Traffic between environments.** Allowed connections, from row to column, whole window.")
    if rm["env_matrix"]:
        L.append("\n| From | To | Allowed | Potentially blocked | Blocked |\n| --- | --- | --- | --- | --- |")
        for m in rm["env_matrix"][:12]:
            L.append(f"| {m['from']} | {m['to']} | {m['allowed']:,} | {m['potentially_blocked']:,} | {m['blocked']:,} |")
    else:
        L.append("\nNo traffic between environments" + ("" if rm["inputs"]["summary"] else " (no estate summary)") + ".")
    pol = rm.get("policy") or {}
    L.append("\n**Policy read.** " + pol.get("text", "No rulesets saved."))
    d = pol.get("delta")
    if d and (d["rulesets"]["new"] or d["rulesets"]["changed"] or d["rulesets"]["removed"]):
        L.append("\n| Draft against provisioned | Rulesets | Rules |\n| --- | --- | --- |")
        L.append(f"| new | {', '.join(d['rulesets']['new']) or 'none'} | {d['rules']['new']}" + (" (" + ", ".join(f"{n} {k.replace('_', ' ')}" for k, n in sorted(d['rules']['new_by_kind'].items())) + ")" if d['rules']['new'] else "") + " |")
        L.append(f"| changed | {', '.join(d['rulesets']['changed']) or 'none'} | {d['rules']['changed']} |")
        L.append(f"| removed | {', '.join(d['rulesets']['removed']) or 'none'} | {d['rules']['removed']} |")
    if pol.get("exposures", {}).get("total"):
        ex = pol["exposures"]
        L.append(f"\nExposures by policy state: {ex['drafted']} drafted (provision), {ex['provisioned']} provisioned but reported allowed (review), {ex['none']} nothing drafted (draft)." if pol.get("view") == "draft"
                 else f"\nExposures with a provisioned deny already naming them: {ex['provisioned']} of {ex['total']}.")
    L.append("\n**Rules not showing in traffic.** Enabled provisioned override denies whose named traffic is reported allowed. A provisioned override deny on an enforcing workload reports blocked, so check the enforcing side's mode, the rule's scope and its update time before adding rules."
             + (f" {d['rules']['new_by_kind'].get('override_deny', 0)} override den{'y exists' if d['rules']['new_by_kind'].get('override_deny', 0) == 1 else 'ies exist'} only in the draft and cannot show in traffic until provisioned." if d and d["rules"]["new_by_kind"].get("override_deny") else "")
             + f" {h['override_denies_unchecked']} override denies use shapes this check does not cover (role labels, named services).")
    if rm["rule_drift"]:
        L.append("\n| Ruleset | Should stop | Reported allowed | Basis | Enforced on | Rule updated |\n| --- | --- | --- | --- | --- | --- |")
        for d in rm["rule_drift"]:
            L.append(f"| {d['ruleset']} | {', '.join(d['consumers'])} -> {', '.join(d['providers'])} on {', '.join(d['services'])} | {d['allowed_connections']:,} | {d['basis']} | {d['enforced_on']} | {str(d['rule_updated_at'] or '?')[:10]}{' (changed inside the window)' if d['changed_in_window'] else ''} |")
    elif rm["inputs"]["rulesets"]:
        L.append("\nNone found.")
    else:
        L.append("\nNot checked: no rulesets saved.")
    L.append("\n**Fix first.**\n")
    for i, s in enumerate(rm["fix_first"], 1):
        L.append(f"{i}. {s}")
    if not rm["fix_first"]:
        L.append("Nothing stands out.")
    return L


def dashboard_data(p: dict) -> str:
    def wb(m):
        return {"allowed": m.get("allowed", 0), "potentiallyBlocked": m.get("potentially_blocked", 0), "blocked": m.get("blocked", 0),
                "allowedNoRule": m.get("allowed_not_admitted", 0)}
    def radius(l):
        if l["kind"] == "ringfence":
            return (f"reaches {l['why']['bridge']['reachable_apps']} apps, " if "bridge" in l["why"] else "") + f"{l['workloads']} workloads"
        return {"X1": f"{l.get('peer_workloads', 0)} workloads, {l.get('peers_enforced', 0)} enforced",
                "X2": f"{len(l.get('dst_apps', []))} destination apps"}.get(l["class"], "")
    lines = [{"id": f"L{i}", "cls": l["class"], "kind": l["kind"], "bucket": l["bucket"], "score": l["score"], "blast": l["blast_radius"], "ease": l["ease"],
              "title": l["title"], "radius": radius(l), "wouldHaveBlocked": wb(l["would_have_blocked"]), "evidence": l["evidence"], "rollback": l["rollback"],
              "detail": line_detail(l), "recommendation": l["recommendation"], "action": l["action"], "admittingRules": l.get("admitting_rules") or [],
              "state": l.get("policy_state", "none"), "cover": {"provisioned": [c["text"] for c in (l.get("cover") or {}).get("provisioned", [])],
                                                                "drafted": [c["text"] for c in (l.get("cover") or {}).get("drafted", [])]}}
             for i, l in enumerate(sorted(p["lines"], key=lambda l: -l["score"]), 1)]
    b = p["baseline"]
    runbooks = []
    for app, env in p["crown_jewels"]:
        n = p["crown_jewel_workloads"].get(f"{app} ({env})", 0)
        runbooks.append({"name": f"EMERGENCY-ISOLATE-{app}-{env}", "workloads": n, "found": n > 0,
                         "steps": [f"get-labels key app value {app}; key env value {env}",
                                   f"create-ruleset EMERGENCY-ISOLATE-{app}-{env}, scoped to app={app}, env={env}",
                                   "create-deny-rule override deny: providers ams, consumers ams and Any, All Services, unscoped_consumers true",
                                   "optional: outbound override deny in an unscoped ruleset (consumers the app's labels, providers ams and Any)",
                                   "provision-policy"],
                         "effect": "all traffic to the app stops, allow rules included.", "undo": "delete the override deny rules and provision again."})
    watch = [{"cls": w["class"], "title": (f"public source {w['ip']}{' ' + w['fqdn'] if w.get('fqdn') else ''}" if w["class"] == "X3" else f"identity {w['identity']}"),
              "detail": (f"reaches {w['peer_workloads']} workloads on {', '.join(w['ports']) or 'admin ports only'}; allowed into enforced {w['allowed_into_enforced']}; admitted by {', '.join(w['ip_lists']) or 'no named list'}" if w["class"] == "X3"
                         else f"{'; '.join(w['why'])}; {w['observed_on_workloads']} workloads, {w['distinct_apps']} apps" + (f"; admin ports {', '.join(w['admin_ports'])}" if w["admin_ports"] else "")),
              "recommendation": w["recommendation"]} for w in p["watch"]]
    series = []
    for s in (p.get("_timeline_series") or []):
        bp = s.get("by_policy_decision") or {}
        series.append({"bucketStart": s.get("bucket_start"), "flows": s.get("flows", 0), "pb": bp.get("potentially_blocked", 0), "blocked": bp.get("blocked", 0)})
    denies = [l for l in p["buckets"]["today"] + p["buckets"]["week"] if l["kind"] != "ringfence"]
    kpis = {"exposures": len(p["lines"]), "blockToday": len(p["buckets"]["today"]), "thisWeek": len(p["buckets"]["week"]), "runbooks": len(p["crown_jewels"]),
            "watch": len(p["watch"]), "maxScore": max([l["score"] for l in p["lines"]] or [0]),
            "allowedWouldStop": sum(l["would_have_blocked"].get("allowed", 0) for l in denies),
            "pbWouldStop": sum(l["would_have_blocked"].get("potentially_blocked", 0) for l in denies),
            "unknownAdminSources": sum(1 for l in p["lines"] if l["class"] == "X1"), "envCrossings": sum(1 for l in p["lines"] if l["class"] == "X2"),
            "bridges": sum(1 for l in p["lines"] if "X4" in l["class"])}
    scope = {"date": p["date"], "windowStart": str(p["window"].get("start") or "?")[:10], "windowEnd": str(p["window"].get("end") or "?")[:10], "windowDays": p["window_days"],
             "lateralDays": p.get("lateral_days"), "adminSpan": p.get("admin_span") or {},
             "productionEnvs": p["production_envs"], "crownJewels": [f"{a} ({e})" for a, e in p["crown_jewels"]], "crownJewelsSource": p["crown_jewels_source"],
             "rulesetName": p["ruleset_name"], "lowerBounds": [k for k, v in p["truncated"].items() if v], "missingInputs": p["missing_inputs"],
             "policyView": p["policy_view"], "headerNotes": header_notes(p)}
    baseline = {"available": bool(b.get("available")), "bucket": b.get("bucket") or "1d", "effectiveBucket": b.get("effective_bucket"), "resolutionNote": b.get("resolution_note"),
                "days": b.get("days", 0), "median": b.get("median_nonzero", 0),
                "total": b.get("total_flows", 0), "worst": ({"bucketStart": b["worst"]["bucket_start"], "flows": b["worst"]["flows"], "multiple": b["worst"]["multiple"]} if b.get("worst") else None),
                "caveat": b.get("caveat"), "truncated": bool(b.get("truncated")), "threshold": b.get("threshold"), "spikeBuckets": [{"bucketStart": x["bucket_start"]} for x in (b.get("spike_buckets") or [])] if not b.get("caveat") else [],
                "series": series}
    plans = [{"for": c["for"], "tool": c.get("tool"), "runbook": c.get("runbook"), "json": json.dumps(c, indent=1)} for c in p["call_plans"]]
    rm = p["risk_map"]
    h, r = rm["headline"], rm["readiness"]
    risk_map = {
        "takeaway": rm["takeaway"],
        "readiness": {"verdict": r["verdict"], "workloads": r["workloads"], "labelled": r["labelled"], "unlabelled": r["unlabelled"],
                      "withApp": r["with_app"], "withEnv": r["with_env"], "labelColumns": r["label_columns"], "notes": r["notes"], "examples": r["unlabelled_examples"]},
        "headline": {"workloads": h["workloads"], "fullEnforcement": h["full_enforcement"], "selective": h["selective"], "notEnforcing": h["not_enforcing"],
                     "unmanagedAdminSources": h["unmanaged_admin_sources"], "unmanagedAdminInternal": h["unmanaged_admin_internal"], "unmanagedAdminPublic": h["unmanaged_admin_public"],
                     "appsInGraph": h["apps_in_graph"], "wideReachApps": h["wide_reach_apps"], "wideReachLowerBound": h["wide_reach_lower_bound"], "lateralDays": h["lateral_days"],
                     "overrideDeniesNotShowing": h["override_denies_not_showing"], "overrideDeniesUnchecked": h["override_denies_unchecked"]},
        "apps": [{"app": a["app"], "workloads": a["workloads"], "crownJewel": a["crown_jewel"], "publicAdminSources": a["public_admin_sources"],
                  "values": {"unmanagedInbound": a["unmanaged_inbound"], "unmanagedAdminSources": a["unmanaged_admin_sources"], "crossEnvConnections": a["cross_env_connections"],
                             "crossEnvApps": a["cross_env_apps"], "wideReachAccounts": a["wide_reach_accounts"], "workloadsNotEnforcing": a["workloads_not_enforcing"]},
                  "bands": {"unmanagedInbound": a["bands"]["unmanaged_inbound"], "unmanagedAdminSources": a["bands"]["unmanaged_admin_sources"], "crossEnvConnections": a["bands"]["cross_env_connections"],
                            "crossEnvApps": a["bands"]["cross_env_apps"], "wideReachAccounts": a["bands"]["wide_reach_accounts"], "workloadsNotEnforcing": a["bands"]["workloads_not_enforcing"]}}
                 for a in rm["apps"][:12]],
        "appsTotal": len(rm["apps"]), "appsExcluded": rm.get("apps_without_env_excluded", 0),
        "envMatrix": [{"from": m["from"], "to": m["to"], "allowed": m["allowed"], "potentiallyBlocked": m["potentially_blocked"], "blocked": m["blocked"]} for m in rm["env_matrix"]],
        "ruleDrift": [{"ruleset": d["ruleset"], "shouldStop": f"{', '.join(d['consumers'])} -> {', '.join(d['providers'])} on {', '.join(d['services'])}", "allowed": d["allowed_connections"],
                       "basis": d["basis"], "enforcedOn": d["enforced_on"], "updatedAt": str(d["rule_updated_at"] or "?")[:10], "changedInWindow": d["changed_in_window"]} for d in rm["rule_drift"]],
        "draftActive": {"available": bool(rm["draft_active"].get("available")), "pending": rm["draft_active"].get("pending", 0)},
        "policy": policy_js(rm.get("policy") or {}),
        "fixFirst": rm["fix_first"],
        "inputs": rm["inputs"],
    }
    j = lambda v: json.dumps(v, indent=None, default=str)
    return "\n".join([f"const scope = {j(scope)};", f"const kpis = {j(kpis)};", f"const riskMap = {j(risk_map)};", f"const lines = {j(lines)};", f"const runbooks = {j(runbooks)};",
                       f"const watch = {j(watch)};", f"const baseline = {j(baseline)};", f"const callPlans = {j(plans)};"])


def policy_js(pol: dict) -> dict:
    d = pol.get("delta")
    return {"view": pol.get("view", "provisioned"), "text": pol.get("text", ""),
            "pending": {"available": bool(pol.get("pending", {}).get("available")), "pending": pol.get("pending", {}).get("pending", 0)},
            "exposures": pol.get("exposures") or {"total": 0, "provisioned": 0, "drafted": 0, "none": 0},
            "delta": ({"rulesetsNew": d["rulesets"]["new"], "rulesetsChanged": d["rulesets"]["changed"], "rulesetsRemoved": d["rulesets"]["removed"],
                       "rulesetsUnchanged": d["rulesets"]["unchanged"], "rulesNew": d["rules"]["new"], "rulesChanged": d["rules"]["changed"], "rulesRemoved": d["rules"]["removed"],
                       "newByKind": {"allow": d["rules"]["new_by_kind"].get("allow", 0), "deny": d["rules"]["new_by_kind"].get("deny", 0), "overrideDeny": d["rules"]["new_by_kind"].get("override_deny", 0)}}
                      if d else None)}


def write_dashboard(path: pathlib.Path, p: dict, template: pathlib.Path) -> str:
    if not template.exists():
        return f" (no dashboard: template {template} not found)"
    t = template.read_text()
    start, end = "\n// ==== DATA ====\n", "\n// ==== END DATA ===="
    i, k = t.find(start), t.find(end)
    if i < 0 or k < 0:
        return " (no dashboard: template has no DATA markers on their own lines)"
    out = t[:i + len(start)] + dashboard_data(p) + t[k:]
    out = out.replace("// this file doubles as the template and as a worked example.", f"// generated by scripts/triage.py on {p['date']} from plan.json.")
    path.write_text(out)
    return ", dashboard.jsx"


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
    ap.add_argument("--lateral-days", type=int, default=None, help="window of detect-lateral-movement-paths when it had to be shorter (default: the result's lookback_days)")
    ap.add_argument("--date", default=date.today().isoformat(), help="YYYY-MM-DD used in the draft ruleset name")
    ap.add_argument("--policy", choices=("provisioned", "draft"), default="provisioned",
                    help="provisioned: read rulesets.json (pversion active) only; draft: also read rulesets_draft.json and report the delta (default: provisioned)")
    ap.add_argument("--template", type=pathlib.Path, default=None, help="dashboard template (default: ../references/dashboard-example.jsx)")
    a = ap.parse_args(argv)

    names = ("workloads", "summary", "admin_ports", "lateral", "unknown", "identities", "rulesets", "rulesets_draft", "timeline", "draft_active")
    files = {n: a.scratch / f"{n}.json" for n in names}
    data = {n: load(f) for n, f in files.items()}
    if data["workloads"] is None:
        sys.exit(f"{files['workloads']} is required (get-workloads, compact, unfiltered)")
    if data["rulesets"] is not None and str(data["rulesets"].get("policy_version") or "active").lower() != "active":
        sys.exit(f"{files['rulesets']} holds the {data['rulesets'].get('policy_version')} policy; the script scores against the provisioned policy. "
                 "Save get-rulesets pversion active there, and the draft pull as rulesets_draft.json for the draft view.")
    if a.policy == "draft":
        if data["rulesets_draft"] is None:
            sys.exit(f"--policy draft needs {files['rulesets_draft']} (get-rulesets, pversion draft, unfiltered)")
        if str(data["rulesets_draft"].get("policy_version") or "draft").lower() != "draft":
            sys.exit(f"{files['rulesets_draft']} holds the {data['rulesets_draft'].get('policy_version')} policy, not the draft")
    else:
        data["rulesets_draft"] = None

    cols = (data["workloads"] or {}).get("columns") or []
    has_labels = {"app", "env"} <= set(cols)
    wl = workload_index(split_rows(data["workloads"]) if has_labels else [{**r, "app": None, "env": None} for r in split_rows(data["workloads"])], has_labels)
    prod = pick_prod_envs(a.prod_env, wl["envs"])
    policy = existing_policy(data["rulesets"])
    x1 = x1_unknown_admin(data["unknown"], policy, data["rulesets"], wl)
    x2 = x2_env_crossings(data["admin_ports"], prod, data["rulesets"], wl)
    fences = ringfence_lines(data["lateral"], wl, data["summary"], policy)
    x3 = x3_public_sources(data["unknown"], {l["ip"] for l in x1})
    x6 = x6_identities(data["identities"])

    lines = sorted(x1 + x2 + fences, key=lambda l: -l["score"])
    unk_totals = (data["unknown"] or {}).get("totals") or {}
    default_lists = unk_totals.get("default_ip_lists") or [ANY_LIST]
    pol = policy_view(a.policy, data["rulesets"], data["rulesets_draft"], data["draft_active"], lines, default_lists)
    if a.policy == "draft":
        drafted_rrr = [n for n in existing_policy(data["rulesets_draft"])["rrr_rulesets"] if n not in policy["rrr_rulesets"]]
        policy["rrr_rulesets_drafted"] = drafted_rrr
        policy["rrr_rulesets"] = policy["rrr_rulesets"] + drafted_rrr
    else:
        policy["rrr_rulesets_drafted"] = []
    # Block today: denies with ease 4 or more, except internal unknown sources, which are
    # identified first (usually a scanner, a backup host or an unlabelled server).
    today = [l for l in lines if l["kind"] in ("deny", "override_deny") and l["ease"] >= 4
             and not (l["class"] == "X1" and l.get("address_class") != "public")]
    week = [l for l in lines if l not in today]
    for l in lines:
        l["bucket"] = "today" if l in today else "week"
    window = (data["summary"] or data["unknown"] or data["timeline"] or {}).get("window") or {}
    lateral_days = a.lateral_days or (data["lateral"] or {}).get("lookback_days") or a.window_days
    rm = risk_map(data, wl, lines, str(window.get("start") or "")[:10] or None, lateral_days, pol)
    jewels, jewels_src = crown_jewels([parse_pair(c) for c in a.crown], fences, prod, rm["apps"])
    pin_crown(rm, jewels, lines)

    wl_env = data["workloads"] or {}
    span = admin_span(data["admin_ports"])
    truncated = {
        "workloads": bool(wl_env.get("truncated")) or wl_env.get("total", 0) >= 10000,
        "summary": bool(((data["summary"] or {}).get("totals") or {}).get("truncated")),
        "admin_ports": bool((data["admin_ports"] or {}).get("truncated")) or int((data["admin_ports"] or {}).get("total_pce_flows") or 0) >= 500,
        "unknown": bool(unk_totals.get("flows_truncated")) or (int(unk_totals.get("returned") or 0) < int(unk_totals.get("unknown_endpoints") or 0)),
        "timeline": bool(((data["timeline"] or {}).get("totals") or {}).get("flows_truncated")),
    }
    plan = {
        "date": a.date, "ruleset_name": f"RRR-{a.date}", "window_days": a.window_days, "lateral_days": lateral_days,
        "window": window, "admin_span": span,
        "inputs": {n: f.exists() for n, f in files.items() if n != "rulesets_draft" or a.policy == "draft"}, "truncated": truncated,
        "policy_view": a.policy, "policy_delta": pol.get("delta"),
        "unknown_coverage": {"returned": unk_totals.get("returned"), "unknown_endpoints": unk_totals.get("unknown_endpoints")},
        "default_ip_lists": default_lists,
        "production_envs": prod, "crown_jewels": jewels, "crown_jewels_source": jewels_src,
        "crown_jewel_workloads": {f"{a} ({e})": wl["apps"].get((a, e), {}).get("workloads", 0) for a, e in jewels},
        "policy": {"policy_version": policy["policy_version"], "rrr_rulesets": policy["rrr_rulesets"], "rrr_rulesets_drafted": policy["rrr_rulesets_drafted"],
                   "deny_rules": policy["deny_rules"],
                   "scoped": {f"{a} ({e})": v for (a, e), v in policy["scoped"].items()},
                   "fenced": sorted(f"{a} ({e})" for a, e in policy["fenced"])},
        "lines": lines, "buckets": {"today": today, "week": week}, "watch": x3 + x6,
        "risk_map": rm,
        "baseline": baseline(data["timeline"]),
        "_timeline_series": (data["timeline"] or {}).get("series") or [],
    }
    for l in lines:
        l["ruleset"] = plan["ruleset_name"]
        l["recommendation"] = recommendation(l)
        l["action"] = action(l)
        l["why"] = l.get("why") if isinstance(l.get("why"), dict) else l.get("why")
    for w in plan["watch"]:
        w["recommendation"] = watch_recommendation(w)
        w["action"] = watch_action(w)
    plan["missing_inputs"] = [n for n, ok in plan["inputs"].items() if not ok and n != "draft_active"]
    plan["call_plans"] = call_plans(plan)
    a.out.mkdir(parents=True, exist_ok=True)
    (a.out / "plan.json").write_text(json.dumps(plan, indent=1, default=str))
    write_plan_md(a.out / "plan.md", plan)
    write_call_plans(a.out / "call-plans.md", plan)
    write_report_md(a.out / "report.md", plan)
    template = a.template or pathlib.Path(__file__).resolve().parent.parent / "references" / "dashboard-example.jsx"
    dash_note = write_dashboard(a.out / "dashboard.jsx", plan, template)
    missing = plan["missing_inputs"]
    ex = pol["exposures"]
    print(f"wrote {a.out / 'plan.json'}, plan.md, call-plans.md, report.md{dash_note}: {len(today)} today, {len(week)} this week, "
          f"{len(jewels)} runbooks, {len(plan['watch'])} watch; policy {a.policy}"
          + (f", {ex['drafted']} drafted, {ex['provisioned']} provisioned, {ex['none']} to draft" if a.policy == "draft" else f", {ex['provisioned']} with a provisioned deny")
          + (f"; missing inputs: {', '.join(missing)}" if missing else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
