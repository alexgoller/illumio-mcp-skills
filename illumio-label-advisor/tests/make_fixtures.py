#!/usr/bin/env python3
"""Write three synthetic estates into tests/fixtures/<name>/scratch/ in the exact shapes
the illumio-mcp tools return (see the server's tools/labels.py, tools/workloads.py,
tools/traffic.py and tools/ringfence.py):

  unlabelled  60 workloads, no labels, opaque hostnames (srvNNNN), listeners and traffic
              with a directory hub, a DNS hub and a backup hub
  half        120 workloads, 60 labelled with the convention <env>-<app>-<role><nn>, the
              rest unlabelled or partly labelled; two planted env conflicts; custom
              dimension bu by subnet; model-suggestions.json and preferences.json
  full        80 workloads fully labelled including bu: the advisor must stay silent

Deterministic (seeded). Standard library only.
"""
from __future__ import annotations

import json
import pathlib
import random
import shutil

HERE = pathlib.Path(__file__).resolve().parent
FIXTURES = HERE / "fixtures"
WINDOW = {"start": "2026-10-07T00:00:00Z", "end": "2026-11-06T23:59:59Z"}
ORG = "/orgs/1"

LINUX_COMMON = [("sshd", 22, "tcp"), ("zabbix_agentd", 10050, "tcp"), ("node_exporter", 9100, "tcp")]
WIN_COMMON = [("C:\\Windows\\System32\\svchost.exe", 3389, "tcp"), ("System", 445, "tcp"),
              ("C:\\Windows\\System32\\svchost.exe", 135, "tcp")]
PROFILES = {
    "web": ("linux", [("nginx", 443, "tcp"), ("nginx", 80, "tcp")]),
    "app": ("linux", [("java", 8080, "tcp")]),
    "db-mysql": ("linux", [("mysqld", 3306, "tcp")]),
    "db-mssql": ("windows", [("C:\\Program Files\\Microsoft SQL Server\\MSSQL15.MSSQLSERVER\\MSSQL\\Binn\\sqlservr.exe", 1433, "tcp")]),
    "db-pg": ("linux", [("postgres", 5432, "tcp")]),
    "cache": ("linux", [("redis-server", 6379, "tcp")]),
    "queue": ("linux", [("beam.smp", 5672, "tcp"), ("beam.smp", 15672, "tcp")]),
    "dc": ("windows", [("C:\\Windows\\System32\\lsass.exe", p, "tcp") for p in (389, 88, 636, 3268)]
           + [("C:\\Windows\\System32\\lsass.exe", p, "udp") for p in (389, 88)]
           + [("C:\\Windows\\System32\\dns.exe", 53, "tcp"), ("C:\\Windows\\System32\\dns.exe", 53, "udp")]),
    "dns": ("linux", [("named", 53, "tcp"), ("named", 53, "udp")]),
    "backup": ("linux", [("bprd", 13720, "tcp"), ("bpcd", 13782, "tcp")]),
    "mon": ("linux", [("zabbix_server", 10051, "tcp")]),
    "file": ("linux", [("smbd", 445, "tcp")]),
    "unknown-win": ("windows", [("C:\\Program Files\\Foo\\svc_foo.exe", 9443, "tcp")]),
    "unknown-linux": ("linux", [("vendord", 7777, "tcp")]),
}
DB_PORT = {"db-mysql": 3306, "db-mssql": 1433, "db-pg": 5432}
OS_ID = {"linux": ("ubuntu-x86_64-jammy", "Ubuntu 22.04.4 LTS"), "windows": ("win-x86_64-server-2019", "Windows Server 2019 Datacenter")}
PROTO_NUM = {"tcp": 6, "udp": 17}


class Estate:
    def __init__(self, name: str, seed: int):
        self.name = name
        self.rng = random.Random(seed)
        self.hosts = []
        self.flows = []
        self.labels = {}      # (key, value) -> href
        self.counter = 0

    def href(self) -> str:
        self.counter += 1
        return f"{ORG}/workloads/{self.counter:08x}-{self.rng.getrandbits(16):04x}-4a1b-9c2d-{self.rng.getrandbits(48):012x}"

    def label_href(self, key: str, value: str) -> str:
        if (key, value) not in self.labels:
            self.labels[(key, value)] = f"{ORG}/labels/{100 + len(self.labels)}"
        return self.labels[(key, value)]

    def add(self, hostname: str, ip: str, profile: str, labels: dict, managed: bool = True, group=None) -> dict:
        os_, listeners = PROFILES.get(profile, ("linux", []))
        common = LINUX_COMMON if os_ == "linux" else WIN_COMMON
        h = {"href": self.href(), "hostname": hostname, "ip": ip, "os": os_, "profile": profile,
             "labels": dict(labels), "managed": managed, "group": group,
             "listeners": (listeners + common) if managed else []}
        for k, v in labels.items():
            self.label_href(k, v)
        self.hosts.append(h)
        return h

    def flow(self, src, dst, port: int, proto: str, process, lo=5, hi=400):
        """src/dst: host dicts or (ip, hostname-or-None) tuples for externals."""
        s = (src["ip"], src["hostname"]) if isinstance(src, dict) else src
        d = (dst["ip"], dst["hostname"]) if isinstance(dst, dict) else dst
        self.flows.append({"src_ip": s[0], "src_hostname": s[1] or "-", "dst_ip": d[0], "dst_hostname": d[1] or "-",
                           "dst_fqdn": "-", "port": port, "proto": proto, "process_name": process or "-",
                           "num_connections": self.rng.randint(lo, hi)})

    # ---------------------------------------------------------------- traffic
    def wire(self, cross_app: float = 0.0):
        by_profile = lambda *ps: [h for h in self.hosts if h["profile"] in ps and h["managed"]]
        dcs, dnss, backups, mons = by_profile("dc"), by_profile("dns"), by_profile("backup"), by_profile("mon")
        managed = [h for h in self.hosts if h["managed"]]
        for h in managed:
            for dc in dcs:
                if h is not dc:
                    self.flow(h, dc, 389, "tcp", "lsass.exe" if h["os"] == "windows" else "sssd_be")
                    self.flow(h, dc, 88, "tcp", "lsass.exe" if h["os"] == "windows" else "sssd_be")
            for d in dnss:
                if h is not d:
                    self.flow(h, d, 53, "udp", None)
            for b in backups:
                if h is not b:
                    self.flow(h, b, 13720, "tcp", "bpcd", 1, 30)
            for m in mons:
                if h is not m:
                    self.flow(m, h, 10050, "tcp", "zabbix_server", 50, 900)
        groups = {}
        for h in managed:
            if h["group"] is not None:
                groups.setdefault(h["group"], []).append(h)
        ext = 1
        for g, members in groups.items():
            webs = [h for h in members if h["profile"] == "web"]
            apps = [h for h in members if h["profile"] == "app"]
            dbs = [h for h in members if h["profile"].startswith("db-")]
            caches = [h for h in members if h["profile"] == "cache"]
            queues = [h for h in members if h["profile"] == "queue"]
            utils = [h for h in members if h["profile"].startswith("unknown")]
            for w in webs:
                for a in apps:
                    self.flow(w, a, 8080, "tcp", "nginx")
                for _ in range(3):
                    self.flow((f"203.0.113.{ext}", None), w, 443, "tcp", "nginx")
                    ext += 1
            for a in apps:
                for d in dbs:
                    self.flow(a, d, DB_PORT[d["profile"]], "tcp", "java")
                for c in caches:
                    self.flow(a, c, 6379, "tcp", "java")
                for q in queues:
                    self.flow(a, q, 5672, "tcp", "java")
                if cross_app and self.rng.random() < cross_app:
                    others = [x for x in managed if x["profile"] == "app" and x["group"] != g and x["group"] is not None]
                    if others:
                        self.flow(a, self.rng.choice(others), 8080, "tcp", "java", 1, 20)
            for u in utils:
                for d in dbs[:1]:
                    self.flow(u, d, DB_PORT[d["profile"]], "tcp", None, 1, 20)
                for a in apps[:1]:
                    self.flow(a, u, 9443 if u["profile"] == "unknown-win" else 7777, "tcp", None, 1, 20)

    # ----------------------------------------------------------------- writers
    def write(self, extra: dict | None = None):
        out = FIXTURES / self.name / "scratch"
        if out.exists():
            shutil.rmtree(out)
        out.mkdir(parents=True)
        self.write_labels(out)
        self.write_workloads(out)
        self.write_full(out)
        self.write_flows(out)
        self.write_summary(out)
        for name, payload in (extra or {}).items():
            (out / name).write_text(json.dumps(payload, indent=2) + "\n")
        return out

    def write_labels(self, out: pathlib.Path):
        usage = {"label_group": False, "ruleset": False, "static_policy_scopes": False, "pairing_profile": False,
                 "permission": False, "workload": True, "container_workload": False, "firewall_coexistence_scope": False,
                 "containers_inherit_host_policy_scope": False, "blocked_connection_reject_scope": False,
                 "enforcement_boundary": False, "loopback_interfaces_in_policy_scope": False,
                 "virtual_server": False, "virtual_service": False}
        labels = [{"href": href, "key": k, "value": v, "created_at": "2026-01-10T09:00:00.000Z",
                   "updated_at": "2026-01-10T09:00:00.000Z", "created_by": {"href": "/users/1"},
                   "updated_by": {"href": "/users/1"}, "usage": dict(usage)}
                  for (k, v), href in sorted(self.labels.items(), key=lambda kv: kv[1])]
        (out / "labels.txt").write_text(f"Labels: {labels!r}")

    def write_workloads(self, out: pathlib.Path):
        keys = []
        for h in self.hosts:
            for k in h["labels"]:
                if k not in keys:
                    keys.append(k)
        columns = ["href", "name", "hostname", "ip_addresses", "os_type", "online", "managed", "enforcement_mode",
                   "visibility_level", "ven_status", "last_heartbeat_on", "agent_version", "policy_sync_state",
                   "health_errors", "health_error_types"] + keys
        data = []
        for h in self.hosts:
            row = {"href": h["href"], "name": h["hostname"], "hostname": h["hostname"], "ip_addresses": h["ip"],
                   "os_type": h["os"], "online": h["managed"], "managed": h["managed"],
                   "enforcement_mode": "visibility_only" if h["managed"] else "idle",
                   "visibility_level": "flow_summary" if h["managed"] else None,
                   "ven_status": "active" if h["managed"] else None,
                   "last_heartbeat_on": "2026-11-06T07:58:00.000Z" if h["managed"] else None,
                   "agent_version": "23.2.30-8550" if h["managed"] else None,
                   "policy_sync_state": "synced" if h["managed"] else None,
                   "health_errors": 0 if h["managed"] else None, "health_error_types": None}
            for k in keys:
                row[k] = h["labels"].get(k)
            data.append([row[c] for c in columns])
        env = {"total": len(data), "returned": len(data), "truncated": False, "columns": columns, "data": data}
        (out / "workloads.json").write_text(json.dumps(env))

    def write_full(self, out: pathlib.Path):
        nets = {}
        for h in self.hosts:
            nets.setdefault(h["ip"].rsplit(".", 1)[0] + ".", []).append(h)
        for n, (prefix, hosts) in enumerate(sorted(nets.items()), 1):
            records = []
            for h in hosts:
                os_id, os_detail = OS_ID[h["os"]]
                rec = {"href": h["href"], "name": h["hostname"], "hostname": h["hostname"], "os_type": h["os"],
                       "os_id": os_id if h["managed"] else None, "os_detail": os_detail if h["managed"] else None,
                       "online": h["managed"], "deleted": False,
                       "interfaces": [{"name": "eth0", "address": h["ip"], "cidr_block": 24, "link_state": "up",
                                       "network_detection_mode": "single_private_brn"}],
                       "labels": [{"href": self.label_href(k, v), "key": k, "value": v} for k, v in h["labels"].items()],
                       "enforcement_mode": "visibility_only" if h["managed"] else "idle",
                       "visibility_level": "flow_summary", "managed": h["managed"]}
                if h["managed"]:
                    rec["services"] = {"uptime_seconds": self.rng.randint(10000, 9000000), "open_service_ports": [
                        {"port": port, "protocol": PROTO_NUM[proto], "address": "0.0.0.0",
                         "user": "SYSTEM" if h["os"] == "windows" else proc.split("/")[-1][:8],
                         "package": None if h["os"] == "windows" else proc, "process_name": proc,
                         "win_service_name": (proc.rsplit("\\", 1)[-1].replace(".exe", "") if h["os"] == "windows" else None)}
                        for proc, port, proto in h["listeners"]]}
                    rec["agent"] = {"href": h["href"].replace("/workloads/", "/vens/"), "type": "Host",
                                    "status": {"status": "active", "agent_version": "23.2.30-8550",
                                               "security_policy_sync_state": "synced", "last_heartbeat_on": "2026-11-06T07:58:00.000Z"}}
                    rec["ven"] = {"href": h["href"].replace("/workloads/", "/vens/")}
                records.append(rec)
            env = {"total": len(records), "returned": len(records), "truncated": False, "workloads": records}
            (out / f"workloads_full_{n}.json").write_text(json.dumps(env))

    def write_flows(self, out: pathlib.Path, truncate_first_dst: bool = False):
        columns = ["src_ip", "src_hostname", "dst_ip", "dst_hostname", "dst_fqdn", "port", "proto", "process_name",
                   "num_connections", "bytes_in", "bytes_out", "first_detected", "last_detected"]
        hrefs = [h["href"] for h in self.hosts]
        by_ip = {h["ip"]: h["href"] for h in self.hosts}
        for n, k in enumerate(range(0, len(hrefs), 25), 1):
            batch = set(hrefs[k:k + 25])
            for side, name in (("src", f"flows_src_{n}.json"), ("dst", f"flows_dst_{n}.json")):
                rows = [f for f in self.flows if by_ip.get(f[f"{side}_ip"]) in batch]
                if not rows:
                    (out / name).write_text(json.dumps({"message": "No traffic flows found for the given query parameters",
                                                        "start_date": WINDOW["start"], "end_date": WINDOW["end"]}))
                    continue
                rows.sort(key=lambda f: -f["num_connections"])
                data = [[f[c] for c in columns[:9]] + [f["num_connections"] * 1200, f["num_connections"] * 400,
                                                       "2026-10-07T03:12:00Z", "2026-11-06T06:40:00Z"] for f in rows]
                env = {"total_pce_flows": len(rows), "total_rows": len(rows), "returned_rows": len(rows),
                       "truncated": False, "columns": columns, "data": data}
                if truncate_first_dst and name == "flows_dst_1.json":
                    env.update({"total_pce_flows": 500, "total_rows": len(rows) + 40, "truncated": True})
                (out / name).write_text(json.dumps(env))

    def write_summary(self, out: pathlib.Path):
        by_ip = {h["ip"]: h for h in self.hosts}
        conns = sum(f["num_connections"] for f in self.flows)
        procs = {}
        for f in self.flows:
            if f["process_name"] == "-":
                continue
            p = procs.setdefault(f["process_name"], {"process": f["process_name"], "connections": 0, "dests": {}, "users": []})
            p["connections"] += f["num_connections"]
            key = (f["dst_hostname"] if f["dst_hostname"] != "-" else f["dst_ip"], f["port"], f["proto"])
            p["dests"][key] = p["dests"].get(key, 0) + f["num_connections"]
        by_process = []
        for p in sorted(procs.values(), key=lambda p: -p["connections"]):
            dests = sorted(p["dests"].items(), key=lambda kv: -kv[1])[:10]
            by_process.append({"process": p["process"], "connections": p["connections"], "destination_count": len(p["dests"]),
                               "users": [], "destinations": [{"to": k[0], "port": k[1], "proto": k[2], "policy": "allowed",
                                                              "connections": c, "process_runs_on": "source"} for k, c in dests]})
        a2a = {}
        for f in self.flows:
            s, d = by_ip.get(f["src_ip"]), by_ip.get(f["dst_ip"])
            ident = lambda h: (f"{h['labels']['app']} ({h['labels']['env']})" if h and h["labels"].get("app") and h["labels"].get("env")
                               else "unlabelled") if h else "external:203.0.113.0/24"
            key = (ident(s), ident(d))
            if key[0] != key[1]:
                a2a[key] = a2a.get(key, 0) + f["num_connections"]
        app_to_app = [{"from": k[0], "to": k[1], "policy": "allowed", "connections": c}
                      for k, c in sorted(a2a.items(), key=lambda kv: -kv[1])]
        keys = sorted({k for h in self.hosts for k in h["labels"]})
        summary = {
            "totals": {"rows": len(self.flows), "connections": conns, "distinct_processes": len(procs),
                       "pce_flows": len(self.flows), "truncated_at": 200000, "truncated": False},
            "section_totals": {"by_process": len(by_process), "app_to_app": len(app_to_app)},
            "by_process": by_process, "external_destinations": [], "blocked": [], "app_to_app": app_to_app,
            "identity_labels": ["app", "env"],
            "available_dimensions": {"dimensions": ["process", "source", "destination", "port", "proto", "policy", "direction"] + (["source_app", "dest_app"] if keys else []),
                                     "labels": keys},
            "window": dict(WINDOW),
        }
        (out / "summary.json").write_text(json.dumps(summary))


# ------------------------------------------------------------------ estates

def build_unlabelled() -> Estate:
    e = Estate("unlabelled", 11)
    numbers = list(range(100, 999))
    e.rng.shuffle(numbers)
    profiles = (["dc"] * 2 + ["dns"] * 2 + ["web"] * 12 + ["app"] * 12 + ["db-mysql"] * 6 + ["db-mssql"] * 4
                + ["db-pg"] * 4 + ["cache"] * 3 + ["queue"] * 2 + ["mon", "backup"] + ["file"] * 2
                + ["unknown-win"] * 4 + ["unknown-linux"] * 3)
    ips = [f"10.0.{s}.{h}" for s in (1, 2, 3) for h in range(10, 40)]
    e.rng.shuffle(ips)
    group_of = {"web": 0, "app": 0, "db-mysql": 0, "db-mssql": 0, "db-pg": 0, "cache": 0, "queue": 0, "unknown-win": 0, "unknown-linux": 0}
    for i, p in enumerate(profiles):
        group = None
        if p in group_of:
            group = group_of[p] % 6
            group_of[p] += 1
        e.add(f"srv{numbers[i]:04d}", ips[i], p, {}, group=group)
    e.add(f"srv{numbers[58]:04d}", ips[58], "none", {}, managed=False)
    e.add(f"srv{numbers[59]:04d}", ips[59], "none", {}, managed=False)
    e.wire()
    return e


ENVS = {"prd": "Production", "stg": "Staging"}
APPS = ["shop", "pay", "crm"]
ROLES = {"web": ("Web", "web"), "app": ("App", "app"), "db": ("Database", None)}
DB_OF = {"shop": "db-mysql", "pay": "db-mssql", "crm": "db-pg"}
SUBNET = {("prd", "shop"): "10.10.1", ("prd", "pay"): "10.10.2", ("prd", "crm"): "10.10.3",
          ("stg", "shop"): "10.20.1", ("stg", "pay"): "10.20.2", ("stg", "crm"): "10.20.3"}
BU = {"shop": "Retail", "pay": "Retail", "crm": "Sales"}


def full_labels(env: str, app: str, role: str) -> dict:
    return {"role": ROLES[role][0], "app": app, "env": ENVS[env], "loc": "DC1" if env == "prd" else "DC2", "bu": BU[app]}


def add_infra(e: Estate, labelled: bool = True):
    infra = [("dc01", "dc", "Directory", "ad"), ("dc02", "dc", "Directory", "ad"), ("dns01", "dns", "DNS", "dns"),
             ("dns02", "dns", "DNS", "dns"), ("bk01", "backup", "Backup", "backup"), ("mon01", "mon", "Monitoring", "monitoring")]
    for i, (host, profile, role, app) in enumerate(infra):
        labels = {"role": role, "app": app, "env": "Production", "loc": "DC1", "bu": "Corporate"} if labelled else {}
        e.add(host, f"10.10.0.{10 + i}", profile, labels)


def add_combos(e: Estate, per_combo: int, start: int, labelled, group_base=0) -> list:
    """Hosts <env>-<app>-<role><nn> for every env x app x role; `labelled(host_index)` says
    which labels a host gets (a dict or {})."""
    hosts = []
    g = group_base
    for env in ENVS:
        for app in APPS:
            g += 1
            for role in ROLES:
                for n in range(start, start + per_combo):
                    profile = DB_OF[app] if role == "db" else role
                    host = f"{env}-{app}-{role}{n:02d}"
                    ip = f"{SUBNET[(env, app)]}.{10 + n * 5 + list(ROLES).index(role)}"
                    h = e.add(host, ip, profile, labelled(host, full_labels(env, app, role)), group=g)
                    hosts.append(h)
    return hosts


def build_half() -> Estate:
    e = Estate("half", 23)
    add_infra(e)
    planted = {"prd-shop-web03", "prd-pay-app03"}

    def label_first(host, labels):
        if host in planted:
            return {**labels, "env": "Staging"}
        return labels
    add_combos(e, 3, 1, label_first)
    partly = set()

    def label_rest(host, labels):
        if e.rng.random() < 0.37:
            keys = e.rng.sample(sorted(labels), e.rng.randint(1, 3))
            partly.add(host)
            return {k: labels[k] for k in keys}
        return {}
    add_combos(e, 3, 4, label_rest)
    util_win = e.add("prd-shop-util01", "10.10.1.200", "unknown-win", {}, group=1)
    util_lin = e.add("stg-crm-util01", "10.20.3.200", "unknown-linux", {}, group=6)
    e.add("prd-pay-job01", "10.10.2.201", "app", {"role": "App"}, group=2)
    e.add("stg-shop-job01", "10.20.1.201", "app", {"env": "Staging", "loc": "DC2"}, group=4)
    unm1 = e.add("unm01", "10.10.9.10", "none", {}, managed=False)
    e.add("unm02", "10.10.9.11", "none", {}, managed=False)
    e.wire(cross_app=0.2)
    labelled_web = next(h for h in e.hosts if h["hostname"] == "prd-shop-web01")
    stg_util_app = next(h for h in e.hosts if h["hostname"].startswith("stg-crm-app") and not h["labels"])
    model = [
        {"href": util_win["href"], "dimension": "role", "value": "Backup", "confidence": "medium",
         "evidence": "svc_foo.exe on 9443/tcp is the Foo Backup manager service port"},
        {"href": labelled_web["href"], "dimension": "role", "value": "Web", "confidence": "high",
         "evidence": "nginx"},
        {"href": f"{ORG}/workloads/00000000-0000-4000-8000-000000000000", "dimension": "role", "value": "Web",
         "confidence": "low", "evidence": "unknown href"},
        {"href": util_lin["href"], "dimension": "app", "value": "crm", "confidence": "high",
         "evidence": "vendord is the crm vendor's integration daemon"},
        {"href": stg_util_app["href"], "dimension": "bu", "value": "Marketing", "confidence": "medium",
         "evidence": "a value the custom dimension does not have"},
        {"href": unm1["href"], "dimension": "loc", "value": "DC1", "confidence": "low",
         "evidence": "10.10.0.0/16 is the DC1 range in the customer's IPAM"},
    ]
    prefs = {"dimensions": ["role", "app", "env", "loc", "bu"], "min_confidence": "high",
             "scope": {"type": "all"}, "dry_run": True}
    infra = infra_result(e)
    e.write({"model-suggestions.json": model, "preferences.json": prefs, "infra.json": infra})
    e.write_flows(FIXTURES / e.name / "scratch", truncate_first_dst=True)
    return e


def build_full() -> Estate:
    e = Estate("full", 37)
    add_infra(e)
    add_combos(e, 4, 1, lambda host, labels: labels)
    e.add("prd-shop-lb01", "10.10.1.250", "none", {"role": "Web", "app": "shop", "env": "Production", "loc": "DC1", "bu": "Retail"}, managed=False)
    e.add("stg-shop-lb01", "10.20.1.250", "none", {"role": "Web", "app": "shop", "env": "Staging", "loc": "DC2", "bu": "Retail"}, managed=False)
    e.wire()
    e.write({"infra.json": infra_result(e)})
    return e


def infra_result(e: Estate) -> dict:
    results = [
        {"app": "ad", "env": "Production", "is_production": True, "infrastructure_score": 92.5, "tier": "Core Infrastructure",
         "dominant_pattern": "provider", "in_degree": 6, "out_degree": 0, "betweenness_centrality": 0.0, "consumer_ratio": 1.0,
         "inbound_connections": 48000, "outbound_connections": 0, "total_connections": 48000, "unmanaged_sources": 0,
         "consumed_by": ["shop|Production", "pay|Production", "crm|Production", "shop|Staging", "pay|Staging", "crm|Staging"], "consumes": []},
        {"app": "dns", "env": "Production", "is_production": True, "infrastructure_score": 88.0, "tier": "Core Infrastructure",
         "dominant_pattern": "provider", "in_degree": 6, "out_degree": 0, "betweenness_centrality": 0.0, "consumer_ratio": 1.0,
         "inbound_connections": 20000, "outbound_connections": 0, "total_connections": 20000, "unmanaged_sources": 0,
         "consumed_by": ["shop|Production", "pay|Production", "crm|Production"], "consumes": []},
        {"app": "backup", "env": "Production", "is_production": True, "infrastructure_score": 61.0, "tier": "Shared Service",
         "dominant_pattern": "provider", "in_degree": 6, "out_degree": 0, "betweenness_centrality": 0.0, "consumer_ratio": 1.0,
         "inbound_connections": 3000, "outbound_connections": 0, "total_connections": 3000, "unmanaged_sources": 0,
         "consumed_by": ["shop|Production", "pay|Production"], "consumes": []},
        {"app": "monitoring", "env": "Production", "is_production": True, "infrastructure_score": 58.0, "tier": "Shared Service",
         "dominant_pattern": "consumer", "in_degree": 0, "out_degree": 6, "betweenness_centrality": 0.0, "consumer_ratio": 0.0,
         "inbound_connections": 0, "outbound_connections": 9000, "total_connections": 9000, "unmanaged_sources": 0,
         "consumed_by": [], "consumes": ["shop|Production", "pay|Production", "crm|Production"]},
        {"app": "shop", "env": "Production", "is_production": True, "infrastructure_score": 12.0, "tier": "Standard Application",
         "dominant_pattern": "consumer", "in_degree": 0, "out_degree": 4, "betweenness_centrality": 0.0, "consumer_ratio": 0.0,
         "inbound_connections": 0, "outbound_connections": 7000, "total_connections": 7000, "unmanaged_sources": 3,
         "consumed_by": [], "consumes": ["ad|Production", "dns|Production", "backup|Production"]},
    ]
    return {"summary": {"total_flows_analyzed": len(e.flows), "lookback_days": 30, "unique_apps": 9,
                        "unique_app_to_app_edges": 24, "min_connections_filter": 1,
                        "tier_counts": {"core_infrastructure": 2, "shared_service": 2, "standard_application": 1}},
            "results": results}


def main():
    u = build_unlabelled()
    u.write({"infra.json": {"message": "Traffic data has no labeled app flows to analyze", "total_flows": len(u.flows)}})
    h = build_half()
    f = build_full()
    for e in (u, h, f):
        labelled = sum(1 for x in e.hosts if x["labels"])
        print(f"{e.name}: {len(e.hosts)} workloads, {labelled} with labels, {len(e.flows)} flow rows -> {FIXTURES / e.name / 'scratch'}")


if __name__ == "__main__":
    main()
