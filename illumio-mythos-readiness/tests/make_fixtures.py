#!/usr/bin/env python3
"""Write three synthetic rapid-risk-reduction scratch sets into tests/fixtures/<name>/, in
the shapes illumio-rapid-risk-reduction/scripts/triage.py reads (see that skill's
references and the illumio-mcp 0.13 tool results), so the readiness ladder can be
graded end to end:

  unlabelled  40 workloads, no app or env column: one unlabelled row at level 0
  mixed       98 workloads, 11 apps over prod, staging, dev and mgmt, planted so that
              every level 0 to 5 has at least one app (expectations.md lists them)
  contained   40 workloads, 5 apps, every one at level 5

Every file RRR reads is written: workloads, summary, admin_ports, lateral, unknown,
identities, rulesets (active), rulesets_draft, timeline, draft_active. Deterministic,
standard library only.
"""
from __future__ import annotations

import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
FIXTURES = HERE / "fixtures"
WINDOW = {"start": "2026-10-07T00:00:00Z", "end": "2026-11-06T00:00:00Z"}
ANY = "Any (0.0.0.0/0 and ::/0)"
EXTERNAL_ANY = f"external:{ANY}"
COLS = ["href", "name", "hostname", "ip_addresses", "os_type", "online", "managed", "enforcement_mode", "visibility_level",
        "ven_status", "last_heartbeat_on", "agent_version", "policy_sync_state", "health_errors", "health_error_types"]
LABEL_COLS = ["role", "app", "env", "loc"]
ADMIN_COLS = ["src_app", "src_env", "dst_app", "dst_env", "port", "proto", "policy_decision", "num_connections", "first_detected", "last_detected"]
FIRST, LAST = "2026-10-08T01:00:00Z", "2026-11-05T22:00:00Z"


class Estate:
    def __init__(self, name: str, labelled: bool = True):
        self.name = name
        self.labelled = labelled
        self.rows: list[list] = []
        self.labels: dict[tuple, str] = {}
        self.n = 0

    def label_href(self, key: str, value: str) -> str:
        return self.labels.setdefault((key, value), f"/orgs/1/labels/{100 + len(self.labels)}")

    def add(self, app: str | None, env: str | None, count: int, mode: str, role: str = "app", managed: bool = True,
            subnet: int | None = None) -> None:
        """count workloads of app (env) in one enforcement mode; app/env None, '' or '-' plant an unlabelled side."""
        subnet = subnet if subnet is not None else (self.n // 20) + 1
        for i in range(count):
            self.n += 1
            host = f"{app or 'srv'}-{env or 'x'}-{i + 1:02d}".replace("--", "-")
            row = [f"/orgs/1/workloads/{self.n}", host, host, f"10.{subnet}.{(self.n // 250) + 1}.{(self.n % 250) + 1}", "linux",
                   managed, managed, mode, "flow_summary" if managed else None, "active" if managed else None,
                   "2026-11-05T06:00:00Z" if managed else None, "24.2.0" if managed else None, "synced" if managed else None, 0, None]
            if self.labelled:
                row += [role, app, env, "dc1"]
                for k, v in (("app", app), ("env", env)):
                    if v and v != "-":
                        self.label_href(k, v)
            self.rows.append(row)

    def workloads(self) -> dict:
        cols = COLS + (LABEL_COLS if self.labelled else [])
        return {"total": len(self.rows), "returned": len(self.rows), "truncated": False, "columns": cols, "data": self.rows}

    def ruleset(self, i: int, app: str, env: str, fenced: bool, allow_from: list[tuple[str, str]] | None = None,
                services: list[dict] | None = None) -> dict:
        """A ruleset scoped to app (env): an intra-scope allow, optional allows from other apps and, when
        fenced, a deny from Any to all its workloads (what RRR's existing_policy calls fenced)."""
        svcs = services or [{"service": {"name": "All Services", "href": "/orgs/1/sec_policy/active/services/1"}}]
        rules = [{"rule_type": "allow", "href": f"/orgs/1/sec_policy/active/rule_sets/{i}/sec_rules/{i}0", "enabled": True,
                  "consumers": [{"all_workloads": True}], "providers": [{"all_workloads": True}], "ingress_services": svcs}]
        for j, (a, e) in enumerate(allow_from or [], 1):
            rules.append({"rule_type": "allow", "href": f"/orgs/1/sec_policy/active/rule_sets/{i}/sec_rules/{i}{j}", "enabled": True,
                          "consumers": [{"label": {"key": "app", "value": a, "href": self.label_href("app", a)}},
                                        {"label": {"key": "env", "value": e, "href": self.label_href("env", e)}}],
                          "providers": [{"all_workloads": True}], "ingress_services": svcs, "unscoped_consumers": True})
        if fenced:
            rules.append({"rule_type": "deny", "href": f"/orgs/1/sec_policy/active/rule_sets/{i}/deny_rules/{i}9", "enabled": True,
                          "consumers": [{"ip_list": {"name": ANY, "href": "/orgs/1/sec_policy/active/ip_lists/1"}}],
                          "providers": [{"all_workloads": True}], "ingress_services": [{"service": {"name": "All Services", "href": "/orgs/1/sec_policy/active/services/1"}}]})
        return {"href": f"/orgs/1/sec_policy/active/rule_sets/{i}", "name": f"{'RF' if fenced else 'RS'}-{app}-{env}", "enabled": True, "description": "",
                "scopes": [[{"key": "app", "value": app, "href": self.label_href("app", app)}, {"key": "env", "value": env, "href": self.label_href("env", env)}]],
                "rules": rules}

    def write(self, files: dict) -> pathlib.Path:
        d = FIXTURES / self.name
        d.mkdir(parents=True, exist_ok=True)
        for old in d.glob("*.json"):
            old.unlink()
        files = {"workloads.json": self.workloads(), **files}
        for name, doc in files.items():
            (d / name).write_text(json.dumps(doc, indent=1) + "\n")
        return d


# ------------------------------------------------------------------ builders

def a2a(from_, to, policy, n) -> dict:
    return {"from": from_, "to": to, "policy": policy, "connections": n}


def summary(rows: list[dict], blocked: list[dict] | None = None) -> dict:
    conns = sum(r["connections"] for r in rows)
    return {"totals": {"rows": len(rows) * 40, "connections": conns, "pce_flows": len(rows) * 40, "truncated_at": 200000, "truncated": False},
            "section_totals": {"by_process": 0, "external_destinations": 1, "blocked": len(blocked or []), "app_to_app": len(rows)},
            "app_to_app": rows, "blocked": blocked or [],
            "external_destinations": [{"dst_label": "updates.example.net", "port": 443, "proto": "tcp", "policy_decision": "allowed", "connections": 300}],
            "identity_labels": ["app", "env"], "window": WINDOW}


def admin_ports(rows: list[tuple]) -> dict:
    data = [[sa, se, da, de, port, 6, dec, n, FIRST, LAST] for sa, se, da, de, port, dec, n in rows]
    return {"total_pce_flows": len(rows) * 10, "total_rows": len(rows), "returned_rows": len(rows), "truncated": False, "columns": ADMIN_COLS, "data": data}


def lateral(total_apps: int, bridges: list[tuple[str, str, int]], top: list[tuple[str, str, int]]) -> dict:
    bridge_keys = {(a, e) for a, e, _ in bridges}
    return {"lookback_days": 30, "total_apps": total_apps, "total_edges": total_apps * 2, "articulation_points": len(bridges),
            "high_risk_bridge_nodes": [{"app": a, "env": e, "is_articulation_point": True, "reachable_apps": r,
                                        "direct_connections_out": 2, "direct_connections_in": 3} for a, e, r in bridges],
            "top_reachable_nodes": [{"app": a, "env": e, "reachable_apps": r, "is_bridge_node": (a, e) in bridge_keys} for a, e, r in top],
            "recommendation": "ringfence bridges first" if bridges else "no bridge: the graph is flat"}


def port_row(port: int, proto: str, admin: bool, policy: dict) -> dict:
    n = sum(policy.values())
    return {"port": port, "proto": proto, "connections": n, "flows": n, "peers": max(1, n // 20), "admin": admin, "policy": policy}


def endpoint(ip: str, public: bool, ports: list[dict], peer_apps: list[str], peer_workloads: int, fqdn: str | None = None,
             lists: list[str] | None = None) -> dict:
    admin = [p for p in ports if p["admin"]]
    policy = {d: sum(p["policy"].get(d, 0) for p in ports) for d in ("allowed", "potentially_blocked", "blocked")}
    total = sum(p["connections"] for p in ports)
    e = {"ip": ip, "fqdn": fqdn, "address_class": "public" if public else "private", "noise": False, "ip_lists": lists or [],
         "likely_provider": None, "provider_confidence": None,
         "neighbourhood": None if public else {"prefix": ip.rsplit(".", 1)[0] + ".0/24", "managed_workloads": 4},
         "connections": total, "peer_workloads": peer_workloads, "peers_enforced": peer_workloads,
         "as_source": {"connections": total, "flows": total, "peer_workloads": peer_workloads, "peer_apps": peer_apps, "distinct_ports": len(ports),
                       "ports": ports, "policy": policy, "allowed_into_enforced": policy["allowed"], "first_seen": FIRST, "last_seen": LAST},
         "profile": [], "profile_evidence": {}}
    if admin:
        e["profile"].append("admin_reach")
        e["profile_evidence"]["admin_reach"] = {"admin_ports": [f"{p['port']}/{p['proto']}" for p in admin],
                                                "allowed_connections": sum(p["policy"].get("allowed", 0) for p in admin)}
    return e


def unknown(endpoints: list[dict], inventory: int, unlabelled_seen: int = 0) -> dict:
    return {"window": WINDOW, "direction": "inbound",
            "totals": {"unknown_endpoints": len(endpoints), "returned": len(endpoints), "unknown_connections": sum(e["connections"] for e in endpoints),
                       "noise_endpoints": 2, "noise_connections": 10, "unlabelled_workloads_seen": unlabelled_seen, "known_by_inventory_only": 0,
                       "rows_between_unknowns": 0, "pce_flows": 900, "pce_queries": 3, "flows_truncated": False, "inventory_workloads": inventory,
                       "inventory_truncated": False, "ip_lists": 3, "ip_lists_truncated": False, "default_ip_lists": [ANY]},
            "profiles": {}, "endpoints": endpoints}


def identities(review: list[tuple[str, list[tuple[str, int]], int]]) -> dict:
    """review = [(identity, [(destination app (env), connections)], observed_on_workloads)]"""
    findings = [{"identity": "svc-backup", "class": "service", "interest": "expected", "why_surfaced": ["service account"],
                 "observed_on_workloads": 30, "distinct_apps": 6, "external_destinations": 0, "distinct_destinations": 30, "connections": 9000}]
    idents = []
    for name, dests, on in review:
        findings.append({"identity": name, "class": "interactive", "interest": "review",
                         "why_surfaced": [f"interactive account active from {on} workloads; one person on several devices, or a shared credential",
                                          f"interactive account reaches {len(dests)} distinct apps, wide for a single user"],
                         "observed_on_workloads": on, "distinct_apps": len(dests), "external_destinations": 0,
                         "distinct_destinations": len(dests) * 2, "connections": sum(c for _, c in dests)})
        idents.append({"identity": name, "class": "interactive", "classified_because": "not a known daemon account", "observed_on_workloads": on,
                       "distinct_apps": len(dests), "external_destinations": 0, "distinct_destinations": len(dests) * 2,
                       "connections": sum(c for _, c in dests), "flow_rows": 80, "destinations": [{"to": t, "connections": c} for t, c in dests],
                       "ports": ["3389/6", "445/6"], "processes": ["mstsc.exe"], "policy_decisions": {"allowed": 100, "potentially_blocked": 20}})
    return {"window": WINDOW, "totals": {"flow_rows": 500, "rows_with_identity": 300, "identities": 1 + len(review), "interactive": len(review),
                                         "service": 1, "edges": 0}, "findings": findings, "identities": idents}


def rulesets(rs: list[dict]) -> dict:
    return {"policy_version": "active", "total_count": len(rs), "rulesets": rs}


def rulesets_draft(rs: list[dict]) -> dict:
    text = json.dumps(rs).replace("/sec_policy/active/", "/sec_policy/draft/")
    return {"policy_version": "draft", "total_count": len(rs), "rulesets": json.loads(text)}


def timeline() -> dict:
    flows = [20, 22, 19, 25, 21, 20, 24, 23, 22, 21, 21, 20, 19, 22, 24, 25, 21, 20, 22, 23, 21, 20, 24, 22, 21, 20, 23, 22, 21, 19]
    series = []
    for i, f in enumerate(flows):
        day = 7 + i
        stamp = f"2026-10-{day:02d}T00:00:00Z" if day <= 31 else f"2026-11-{day - 31:02d}T00:00:00Z"
        series.append({"bucket_start": stamp, "flows": f, "connections": f * 3, "by_policy_decision": {"potentially_blocked": f - f // 5, "blocked": f // 5}})
    return {"window": WINDOW, "bucket": "1d", "effective_bucket": "1d", "series": series,
            "totals": {"flows": sum(flows), "connections": sum(flows) * 3, "pce_flows": sum(flows), "flows_truncated": False},
            "rows_spanning_buckets": 0, "spikes": {"metric": "flows", "rule": ">= 3x the median of non-zero buckets", "median_nonzero": 21,
                                                   "threshold": 63.0, "buckets": [], "worst": None}}


IN_SYNC = {"message": "No differences between draft and active policy", "status": "in_sync"}


# ------------------------------------------------------------------- estates

def build_unlabelled() -> Estate:
    e = Estate("unlabelled", labelled=False)
    e.add(None, None, 20, "visibility_only")
    e.add(None, None, 10, "selective")
    e.add(None, None, 10, "full")
    rows = [a2a("unlabelled", "unlabelled", "allowed", 5000), a2a(EXTERNAL_ANY, "unlabelled", "potentially_blocked", 40)]
    adm = [(None, None, None, None, 22, "allowed", 300), (None, None, None, None, 3389, "potentially_blocked", 40)]
    src = endpoint("10.9.9.9", False, [port_row(22, "tcp", True, {"allowed": 10, "potentially_blocked": 50})], [], 6)
    rs = [{"href": "/orgs/1/sec_policy/active/rule_sets/1", "name": "Default-allow", "enabled": True, "description": "", "scopes": [[]],
           "rules": [{"rule_type": "allow", "href": "/orgs/1/sec_policy/active/rule_sets/1/sec_rules/10", "enabled": True,
                      "consumers": [{"all_workloads": True}], "providers": [{"all_workloads": True}],
                      "ingress_services": [{"port": 443, "proto": "tcp"}]}]}]
    e.write({"summary.json": summary(rows), "admin_ports.json": admin_ports(adm), "lateral.json": lateral(0, [], []),
             "unknown.json": unknown([src], 40, unlabelled_seen=6), "identities.json": identities([]),
             "rulesets.json": rulesets(rs), "rulesets_draft.json": rulesets_draft(rs), "timeline.json": timeline(), "draft_active.json": IN_SYNC})
    return e


def build_mixed() -> Estate:
    e = Estate("mixed")
    # level 4: crown jewel and bridge, everything else passes
    e.add("pay", "prod", 10, "full", subnet=1)
    # level 3: selective and fenced, but an internal unknown source is allowed in on admin ports
    e.add("shop", "prod", 12, "selective", subnet=2)
    # level 3: full and scoped, but a dev-to-prod admin crossing is reported allowed
    e.add("billing", "prod", 6, "full", subnet=3)
    # level 2: scoped ruleset, 4 workloads still in visibility only
    e.add("crm", "prod", 8, "full", subnet=4)
    e.add("crm", "prod", 4, "visibility_only", subnet=4)
    # level 4: full and scoped, but a wide-reach account is seen in it
    e.add("erp", "prod", 8, "full", subnet=5)
    # level 2: enforcing, but the selective half has no deny behind it (fails fenced_if_selective, and so full_enforcement)
    e.add("hr", "staging", 3, "full", subnet=6)
    e.add("hr", "staging", 3, "selective", subnet=6)
    # level 1: visibility only, no ruleset
    e.add("wiki", "staging", 5, "visibility_only", subnet=7)
    e.add("ci", "dev", 6, "visibility_only", subnet=8)
    # level 0: one workload has no VEN
    e.add("legacy", "dev", 5, "full", subnet=9)
    e.add("legacy", "dev", 1, "idle", managed=False, subnet=9)
    # level 5: full, scoped, nothing unmanaged in, not a bridge, no account
    e.add("logs", "mgmt", 8, "full", subnet=10)
    # level 4: full and scoped, but DNS from everywhere is allowed in
    e.add("dns", "mgmt", 4, "full", subnet=11)
    # unlabelled: app without env, env without app, neither
    e.add("batch", "-", 5, "visibility_only", subnet=12)
    e.add("", "prod", 5, "selective", subnet=12)
    e.add(None, None, 5, "visibility_only", subnet=12)

    rows = [
        a2a("shop (prod)", "pay (prod)", "allowed", 4000), a2a("pay (prod)", "billing (prod)", "allowed", 1000),
        a2a("crm (prod)", "erp (prod)", "allowed", 700), a2a("billing (prod)", "erp (prod)", "allowed", 200),
        a2a("ci (dev)", "billing (prod)", "allowed", 90), a2a("ci (dev)", "crm (prod)", "potentially_blocked", 200),
        a2a("ci (dev)", "pay (prod)", "blocked", 30), a2a("hr (staging)", "crm (prod)", "potentially_blocked", 15),
        a2a("unlabelled", "wiki (staging)", "allowed", 30), a2a("unlabelled", "wiki (staging)", "potentially_blocked", 20),
        a2a("unlabelled", "crm (prod)", "potentially_blocked", 10), a2a(EXTERNAL_ANY, "ci (dev)", "potentially_blocked", 50),
        a2a(EXTERNAL_ANY, "dns (mgmt)", "allowed", 500), a2a("shop (prod)", "logs (mgmt)", "allowed", 800),
        a2a("pay (prod)", "logs (mgmt)", "allowed", 600), a2a("legacy (dev)", "wiki (staging)", "allowed", 10),
        a2a("erp (prod)", "dns (mgmt)", "allowed", 120),
    ]
    blocked = [{"process_name": "-", "src_label": "ci-dev-01", "dst_label": "crm-prod-09", "port": 5432, "proto": "tcp", "policy_decision": "potentially_blocked", "connections": 200},
               {"process_name": "-", "src_label": "ci-dev-02", "dst_label": "pay-prod-01", "port": 22, "proto": "tcp", "policy_decision": "blocked", "connections": 30}]
    adm = [("ci", "dev", "billing", "prod", 22, "allowed", 90), ("ci", "dev", "crm", "prod", 5432, "potentially_blocked", 200),
           ("ci", "dev", "pay", "prod", 22, "blocked", 30), ("hr", "staging", "crm", "prod", 3389, "potentially_blocked", 15),
           ("shop", "prod", "pay", "prod", 3306, "allowed", 3000), (None, None, "crm", "prod", 3389, "potentially_blocked", 10)]
    lat = lateral(11, [("pay", "prod", 7)], [("pay", "prod", 7), ("shop", "prod", 5), ("crm", "prod", 4), ("ci", "dev", 3),
                                             ("erp", "prod", 2), ("logs", "mgmt", 2), ("billing", "prod", 1)])
    eps = [
        endpoint("10.9.9.9", False, [port_row(22, "tcp", True, {"allowed": 25, "potentially_blocked": 60}),
                                     port_row(3389, "tcp", True, {"potentially_blocked": 100})], ["shop (prod)", "crm (prod)"], 9),
        endpoint("203.0.113.50", True, [port_row(3389, "tcp", True, {"blocked": 60})], ["pay (prod)"], 2, fqdn="probe.example.net"),
        endpoint("198.51.100.7", True, [port_row(53, "udp", False, {"allowed": 500})], ["dns (mgmt)"], 4, fqdn="resolver.example.org"),
    ]
    ident = identities([("jdoe", [("crm (prod)", 300), ("erp (prod)", 120), ("shop (prod)", 40)], 7)])
    rs = [
        e.ruleset(1, "pay", "prod", True, allow_from=[("shop", "prod")]),
        e.ruleset(2, "shop", "prod", True),
        e.ruleset(3, "billing", "prod", False, allow_from=[("pay", "prod")]),
        e.ruleset(4, "crm", "prod", False),
        e.ruleset(5, "erp", "prod", False, allow_from=[("crm", "prod"), ("billing", "prod")]),
        e.ruleset(6, "hr", "staging", False),
        e.ruleset(7, "logs", "mgmt", True, allow_from=[("shop", "prod"), ("pay", "prod")]),
        e.ruleset(8, "dns", "mgmt", False, services=[{"port": 53, "proto": "udp"}, {"port": 53, "proto": "tcp"}]),
    ]
    e.write({"summary.json": summary(rows, blocked), "admin_ports.json": admin_ports(adm), "lateral.json": lat,
             "unknown.json": unknown(eps, 98, unlabelled_seen=3), "identities.json": ident,
             "rulesets.json": rulesets(rs), "rulesets_draft.json": rulesets_draft(rs), "timeline.json": timeline(), "draft_active.json": IN_SYNC})
    return e


def build_contained() -> Estate:
    e = Estate("contained")
    e.add("web", "prod", 10, "full", subnet=1)
    e.add("api", "prod", 10, "full", subnet=2)
    e.add("db", "prod", 8, "full", subnet=3)
    e.add("batch", "prod", 6, "full", subnet=4)
    e.add("mon", "mgmt", 6, "full", subnet=5)
    rows = [a2a("web (prod)", "api (prod)", "allowed", 6000), a2a("api (prod)", "db (prod)", "allowed", 4000),
            a2a("batch (prod)", "db (prod)", "allowed", 900), a2a("mon (mgmt)", "web (prod)", "allowed", 100),
            a2a(EXTERNAL_ANY, "web (prod)", "blocked", 20)]
    adm = [("web", "prod", "db", "prod", 5432, "allowed", 2000), ("api", "prod", "db", "prod", 5432, "allowed", 3000)]
    lat = lateral(5, [], [("web", "prod", 2), ("api", "prod", 2), ("db", "prod", 1), ("batch", "prod", 1), ("mon", "mgmt", 1)])
    eps = [endpoint("198.51.100.9", True, [port_row(443, "tcp", False, {"blocked": 20})], ["web (prod)"], 2)]
    rs = [e.ruleset(1, "web", "prod", True, allow_from=[("mon", "mgmt")]), e.ruleset(2, "api", "prod", True, allow_from=[("web", "prod")]),
          e.ruleset(3, "db", "prod", True, allow_from=[("api", "prod"), ("batch", "prod")]), e.ruleset(4, "batch", "prod", True),
          e.ruleset(5, "mon", "mgmt", True)]
    e.write({"summary.json": summary(rows), "admin_ports.json": admin_ports(adm), "lateral.json": lat,
             "unknown.json": unknown(eps, 40), "identities.json": identities([]),
             "rulesets.json": rulesets(rs), "rulesets_draft.json": rulesets_draft(rs), "timeline.json": timeline(), "draft_active.json": IN_SYNC})
    return e


def main() -> None:
    for e in (build_unlabelled(), build_mixed(), build_contained()):
        print(f"{e.name}: {len(e.rows)} workloads -> {FIXTURES / e.name}")


if __name__ == "__main__":
    main()
