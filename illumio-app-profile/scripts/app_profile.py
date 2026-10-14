#!/usr/bin/env python3
"""Merge the saved illumio-mcp results for one app into a profile and findings.

Inputs (all optional except workloads; missing files are reported, not fatal):
  <scratch>/workloads.json             get-workloads, compact, UNFILTERED
  <scratch>/inbound.json               get-traffic-flows-summary, include_destinations = app
  <scratch>/outbound.json              get-traffic-flows-summary, include_sources = app
  <scratch>/rulesets_scoped.json       get-rulesets, labels = app
  <scratch>/rulesets_referencing.json  get-rulesets, actor_labels = app
  <scratch>/timeline_in.json           get-traffic-timeline, include_destinations = app
  <scratch>/timeline_out.json          get-traffic-timeline, include_sources = app

Outputs: <out>/profile.json and <out>/findings.md.

The script never talks to the PCE. Candidate rules are suggestions; nothing
here creates anything.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

STALE_HEARTBEAT_HOURS = 24


# --------------------------------------------------------------------------- io

def load(path: pathlib.Path):
    if not path.exists():
        return None
    text = path.read_text()
    # Tool results are sometimes saved with a "Labels: " style prefix or as the
    # MCP envelope; take the first JSON object we can find.
    start = text.find("{")
    return json.loads(text[start:]) if start >= 0 else None


def split_rows(envelope: dict | None) -> list[dict]:
    """Split-format {columns, data} -> list of dicts."""
    if not envelope or "columns" not in envelope:
        return []
    cols = envelope["columns"]
    return [dict(zip(cols, row)) for row in envelope.get("data", [])]


# ---------------------------------------------------------------------- labels

def parse_app(labels: list[str]) -> dict[str, str]:
    out = {}
    for item in labels:
        key, _, value = item.partition("=")
        if not key or not value:
            sys.exit(f"--app takes key=value, got {item!r}")
        out[key.strip()] = value.strip()
    return out


def carries(row: dict, app: dict[str, str]) -> bool:
    return all(str(row.get(k)) == v for k, v in app.items())


# ------------------------------------------------------------------- workloads

def workload_section(rows: list[dict], app: dict[str, str], now: datetime) -> dict:
    mine = [r for r in rows if carries(r, app)]
    by_host = {str(r.get("hostname") or r.get("name")): r for r in rows}
    breakdown = Counter(str(r.get("enforcement_mode") or "unknown") for r in mine)
    stale = []
    for r in mine:
        reasons = []
        status = r.get("ven_status")
        if r.get("managed") and status not in (None, "active"):
            reasons.append(f"ven_status={status}")
        hb = r.get("last_heartbeat_on")
        if hb:
            try:
                age = now - datetime.fromisoformat(str(hb).replace("Z", "+00:00"))
                if age > timedelta(hours=STALE_HEARTBEAT_HOURS):
                    reasons.append(f"last heartbeat {age.days}d {age.seconds // 3600}h ago")
            except ValueError:
                pass
        if (r.get("health_errors") or 0) > 0:
            reasons.append(f"health: {r.get('health_error_types')}")
        if r.get("managed") and r.get("online") is False:
            reasons.append("offline")
        if reasons:
            stale.append({"hostname": r.get("hostname"), "why": reasons})
    table = [{k: r.get(k) for k in ("hostname", "role", "enforcement_mode", "visibility_level",
                                    "online", "ven_status", "last_heartbeat_on",
                                    "agent_version", "policy_sync_state", "health_errors")}
             for r in mine]
    return {"count": len(mine), "enforcement_breakdown": dict(breakdown),
            "visibility_only": [r.get("hostname") for r in mine
                                if r.get("enforcement_mode") == "visibility_only"],
            "stale_vens": stale, "workloads": table, "_hosts": by_host}


# --------------------------------------------------------------------- traffic

def host_labels(hosts: dict, name: str) -> dict | None:
    """Peer hostname -> its label dict, or None when it is not a managed host."""
    r = hosts.get(name)
    if r is None:
        # The summary labels a peer by fqdn / ip-list / hostname / ip; try the
        # bare host part of an fqdn too.
        r = hosts.get(name.split(".")[0])
    if r is None:
        return None
    return {k: v for k, v in r.items()
            if k not in ("href", "name", "hostname", "ip_addresses", "os_type", "online",
                         "managed", "enforcement_mode", "visibility_level", "ven_status",
                         "last_heartbeat_on", "agent_version", "policy_sync_state",
                         "health_errors", "health_error_types") and v not in (None, "")}


def traffic_section(summary: dict | None, direction: str, app_identity: str, hosts: dict) -> dict:
    if not summary:
        return {"available": False}
    totals = summary.get("totals", {})
    peers = []
    for row in summary.get("app_to_app", []):
        peer = row["from"] if direction == "inbound" else row["to"]
        peers.append({"peer": peer, "policy_decision": row.get("policy_decision"),
                      "connections": row.get("connections", 0)})
    blocked = []
    for row in summary.get("blocked", []):
        peer_host = row.get("src_label") if direction == "inbound" else row.get("dst_label")
        labels = host_labels(hosts, str(peer_host))
        blocked.append({"peer_host": peer_host, "peer_labels": labels,
                        "port": row.get("port"), "proto": row.get("proto"),
                        "policy_decision": row.get("policy_decision"),
                        "process": row.get("process_name"),
                        "connections": row.get("connections", 0)})
    return {
        "available": True,
        "truncated": bool(totals.get("truncated")),
        "pce_flows": totals.get("pce_flows"),
        "rows": totals.get("rows"),
        "section_totals": summary.get("section_totals", {}),
        "peers": sorted(peers, key=lambda p: -p["connections"]),
        "blocked": sorted(blocked, key=lambda b: -b["connections"]),
        "by_process": summary.get("by_process", [])[:25],
    }


# ---------------------------------------------------------------------- policy

def rule_services(rule: dict) -> set[tuple]:
    out = set()
    for svc in rule.get("ingress_services", []):
        if "service" in svc:
            out.add(("service", svc["service"].get("name") or svc["service"].get("href")))
        elif svc.get("port") is not None:
            out.add((svc.get("proto"), svc["port"], svc.get("to_port") or svc["port"]))
    return out


def covered(port, proto, services: set[tuple]) -> bool:
    for s in services:
        if s[0] == "service" and s[1] == "All Services":
            return True
        if len(s) == 3 and s[0] == proto and s[1] <= (port or -1) <= s[2]:
            return True
    return False


def policy_section(scoped: dict | None, referencing: dict | None) -> dict:
    out = {"policy_version": (scoped or referencing or {}).get("policy_version"),
           "scoped_rulesets": [], "referencing_rules": [], "allow_services": set()}
    for rs in (scoped or {}).get("rulesets", []):
        out["scoped_rulesets"].append({"name": rs["name"], "enabled": rs.get("enabled"),
                                       "rules": len(rs.get("rules", []))})
        for rule in rs.get("rules", []):
            if rule.get("rule_type") == "allow" and rule.get("enabled", True):
                out["allow_services"] |= rule_services(rule)
    for rs in (referencing or {}).get("rulesets", []):
        for rule in rs.get("rules", []):
            out["referencing_rules"].append({"ruleset": rs["name"], "rule_type": rule.get("rule_type"),
                                             "href": rule.get("href"), "consumers": rule.get("consumers"),
                                             "providers": rule.get("providers"),
                                             "ingress_services": rule.get("ingress_services")})
            if rule.get("rule_type") == "allow" and rule.get("enabled", True):
                out["allow_services"] |= rule_services(rule)
    out["allow_services"] = sorted(map(list, out["allow_services"]), key=str)
    return out


# -------------------------------------------------------------------- timeline

def timeline_section(t: dict | None) -> dict:
    if not t:
        return {"available": False}
    spikes = t.get("spikes") or {}
    return {"available": True, "bucket": t.get("bucket"), "effective_bucket": t.get("effective_bucket"),
            "rows_spanning_buckets": t.get("rows_spanning_buckets"),
            "resolution_note": t.get("resolution_note"),
            "series": [(b["bucket_start"], b["flows"]) for b in t.get("series", [])],
            "totals": t.get("totals"), "worst": spikes.get("worst"),
            "caveat": spikes.get("caveat"), "median_nonzero": spikes.get("median_nonzero")}


# -------------------------------------------------------------------- findings

def candidate_rules(blocked_in: list[dict], app: dict[str, str], allow: list) -> list[dict]:
    services = {tuple(s) for s in allow}
    by_peer: dict[tuple, dict] = {}
    for b in blocked_in:
        if covered(b["port"], b["proto"], services):
            continue
        # Name the peer by the same dimensions that identify the app (app, env),
        # not by every label it carries: a rule on app+env+role+loc is too
        # specific to survive the next host in that app.
        identity = ({k: b["peer_labels"][k] for k in app if k in b["peer_labels"]}
                    if b["peer_labels"] else None) or None
        key = (json.dumps(identity, sort_keys=True) if identity else b["peer_host"],
               b["port"], b["proto"])
        c = by_peer.setdefault(key, {"consumer": identity or {"address": b["peer_host"]},
                                     "port": b["port"], "proto": b["proto"], "connections": 0,
                                     "evidence": []})
        c["connections"] += b["connections"]
        c["evidence"].append(b["peer_host"])
    rules = []
    for c in sorted(by_peer.values(), key=lambda c: -c["connections"]):
        consumer = c["consumer"]
        labelled = "address" not in consumer
        rules.append({
            "text": (f"allow {', '.join(f'{k}={v}' for k, v in consumer.items()) if labelled else consumer['address']}"
                     f" -> {', '.join(f'{k}={v}' for k, v in app.items())} on {c['port']}/{c['proto']}"
                     f" ({c['connections']} blocked connections)"),
            "needs_ip_list": not labelled,
            "create_ruleset_plan": {
                "tool": "create-ruleset", "DO_NOT_CALL": "suggestion for review",
                "name": f"RS-{'-'.join(app.values())}-allow",
                "scopes": [[{"key": k, "value": v} for k, v in app.items()]],
                "rules": [{"consumers": ([{"label": {"key": k, "value": v}} for k, v in consumer.items()]
                                         if labelled else [{"ip_list": {"name": f"<create for {consumer['address']}>"}}]),
                           "providers": [{"label": {"key": k, "value": v}} for k, v in app.items()],
                           "ingress_services": [{"port": c["port"], "proto": c["proto"]}]}],
            },
            "evidence_hosts": sorted(set(c["evidence"]))[:10],
        })
    return rules


def write_findings(path: pathlib.Path, p: dict) -> None:
    L = []
    w = p["workloads"]
    L.append(f"# Findings for {p['app']}\n")
    L.append(f"Policy version: {p['policy'].get('policy_version') or 'unknown'}. "
             f"Workloads: {w['count']} ({', '.join(f'{k}: {v}' for k, v in w['enforcement_breakdown'].items()) or 'none'}).\n")
    L.append("## 1. Workloads in visibility mode")
    L.append(", ".join(w["visibility_only"]) if w["visibility_only"] else "none")
    L.append("\n## 2. Stale VENs")
    L += [f"- {s['hostname']}: {'; '.join(s['why'])}" for s in w["stale_vens"]] or ["none"]
    L.append("\n## 3. Blocked services with no rule")
    L += [f"- {r['text']}" for r in p["candidate_rules"]] or ["none -- every blocked pair is covered by an allow rule, or there are no blocked flows"]
    L.append("\n## 4. Blocked-flow spikes")
    for name in ("inbound", "outbound"):
        t = p["timeline"].get(name) or {}
        if not t.get("available"):
            continue
        if t.get("caveat"):
            L.append(f"- {name}: no spike reported -- {t['caveat']}")
        elif t.get("worst"):
            wst = t["worst"]
            L.append(f"- {name}: {wst['bucket_start']} had {wst['flows']} blocked flows, "
                     f"{wst['multiple']}x the median of non-zero {t['bucket']} buckets")
        else:
            L.append(f"- {name}: none above 3x the median")
    L.append("\n## 5. Candidate allow rules (suggested, not created)")
    for r in p["candidate_rules"]:
        L.append(f"- {r['text']}" + (" -- consumer is unlabelled, needs an IP list" if r["needs_ip_list"] else ""))
        L.append("```json\n" + json.dumps(r["create_ruleset_plan"], indent=1) + "\n```")
    if not p["candidate_rules"]:
        L.append("none")
    ready = not w["visibility_only"] and not p["candidate_rules"]
    L.append("\n## Readiness")
    L.append("Ready for enforcement: nothing in visibility mode and no uncovered blocked services."
             if ready else "Not ready: " + "; ".join(filter(None, [
                 f"{len(w['visibility_only'])} workload(s) in visibility mode" if w["visibility_only"] else "",
                 f"{len(p['candidate_rules'])} blocked service(s) without a rule" if p["candidate_rules"] else ""])))
    for name in ("inbound", "outbound"):
        t = p["traffic"].get(name) or {}
        if t.get("truncated"):
            L.append(f"\nNOTE: {name} traffic hit the PCE cap ({t.get('pce_flows')} flows); every count above is a lower bound.")
    path.write_text("\n".join(L) + "\n")


# ------------------------------------------------------------------------ main

def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--app", action="append", required=True, help="key=value, repeatable (app=shop, env=prod)")
    ap.add_argument("--scratch", type=pathlib.Path, required=True)
    ap.add_argument("--out", type=pathlib.Path, required=True)
    ap.add_argument("--now", default=None, help="ISO timestamp for heartbeat age (tests)")
    a = ap.parse_args(argv)
    app = parse_app(a.app)
    now = datetime.fromisoformat(a.now) if a.now else datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    files = {n: a.scratch / f"{n}.json" for n in ("workloads", "inbound", "outbound", "rulesets_scoped",
                                                 "rulesets_referencing", "timeline_in", "timeline_out")}
    data = {n: load(f) for n, f in files.items()}
    if data["workloads"] is None:
        sys.exit(f"{files['workloads']} is required (get-workloads, compact, unfiltered)")

    wl = workload_section(split_rows(data["workloads"]), app, now)
    hosts = wl.pop("_hosts")
    identity = " / ".join(app.values())
    traffic = {"inbound": traffic_section(data["inbound"], "inbound", identity, hosts),
               "outbound": traffic_section(data["outbound"], "outbound", identity, hosts)}
    policy = policy_section(data["rulesets_scoped"], data["rulesets_referencing"])
    timeline = {"inbound": timeline_section(data["timeline_in"]),
                "outbound": timeline_section(data["timeline_out"])}
    blocked_in = traffic["inbound"].get("blocked", []) if traffic["inbound"].get("available") else []
    profile = {
        "app": ", ".join(f"{k}={v}" for k, v in app.items()),
        "generated_at": now.isoformat(),
        "inputs": {n: f.exists() for n, f in files.items()},
        "workloads": wl, "traffic": traffic, "policy": policy, "timeline": timeline,
        "candidate_rules": candidate_rules(blocked_in, app, policy["allow_services"]),
    }
    a.out.mkdir(parents=True, exist_ok=True)
    (a.out / "profile.json").write_text(json.dumps(profile, indent=1, default=str))
    write_findings(a.out / "findings.md", profile)
    missing = [n for n, ok in profile["inputs"].items() if not ok]
    print(f"wrote {a.out / 'profile.json'} and findings.md"
          + (f"; missing inputs: {', '.join(missing)}" if missing else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
