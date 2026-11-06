#!/usr/bin/env python3
"""Merge the saved illumio-mcp results of a label-advisor run, infer the
missing labels and write the advice, the report body, the apply plan and
the dashboard.

Inputs (<scratch>/, every file optional; what was read is listed in
advice.json["inputs"]):
  labels.txt               get-labels usage:true max_results:10000 (text: "Labels: [repr]")
  workloads.json           get-workloads detail_level:compact, unfiltered (split format)
  workloads_full_<n>.json  get-workloads detail_level:full ip_address:<prefix>, one per batch
  summary.json             get-traffic-flows-summary over the window, unfiltered, detail_level full
  flows_src_<n>.json       get-traffic-flows include_sources:[hrefs] grouped by
                           source, destination, port, proto, process (500-flow cap per call)
  flows_dst_<n>.json       the same with include_destinations
  infra.json               identify-infrastructure-services (only on estates with app labels)
  model-suggestions.json   written by the model after reading unresolved.md (--model)
  preferences.json         apply preferences (dimensions, min_confidence, scope, dry_run)

Outputs (<out>/): advice.json, suggestions.md, unresolved.md, plan.json, plan.md and
dashboard.jsx (the template in references/ with its DATA block replaced).

--plan-batches reads labels.txt and workloads.json only and writes <out>/batches.json:
the full-detail batches (ip_address prefix per /24, unlabelled first, capped by
--max-full) and the flow batches (at most 25 workload hrefs each, unlabelled and partly
labelled first), then exits.

The rules (signals, confidence, fill gaps only, conflicts, hubs) are stated once in
references/inference.md; the process and port table lives in references/process-roles.md
and is parsed at run time. The script never talks to the PCE and never changes a label:
plan.md is a dry run until the skill applies it with the user's explicit yes.
"""
from __future__ import annotations

import argparse
import ast
import fnmatch
import ipaddress
import json
import pathlib
import re
import sys
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone

STANDARD = ["role", "app", "env", "loc"]
COMPACT_COLUMNS = {"href", "name", "hostname", "ip_addresses", "os_type", "online", "managed",
                   "enforcement_mode", "visibility_level", "ven_status", "last_heartbeat_on",
                   "agent_version", "policy_sync_state", "health_errors", "health_error_types"}
NA = "-"
PROTO_NAMES = {6: "tcp", 17: "udp", 1: "icmp", "6": "tcp", "17": "udp", "1": "icmp"}
CONF_RANK = {"low": 0, "medium": 1, "high": 2}
# Signal kinds grouped into evidence families. "high" needs two families that agree
# (references/inference.md, section 3).
FAMILY = {"listening_process": "listener", "listening_port": "listener", "fan_in": "traffic",
          "hostname_token": "hostname", "peer_app": "peers", "peer_env": "peers",
          "subnet_majority": "subnet", "ven_os": "listener", "model_knowledge": "model"}
# A domain controller also serves these; when listener rows disagree only in this way,
# Directory wins (inference.md, section 2).
YIELDS_TO_DIRECTORY = {"DNS", "DHCP", "NTP", "File"}
# The customer's role vocabulary is matched case-insensitively and through these aliases
# before a canonical value is proposed as new.
ROLE_SYNONYMS = {
    "Web": {"web", "webserver", "www", "frontend", "web server", "http"},
    "App": {"app", "application", "appserver", "app server", "middleware", "api", "backend"},
    "Database": {"database", "db", "databases", "sql", "data", "dbms"},
    "Cache": {"cache", "caching"},
    "Queue": {"queue", "mq", "messaging", "broker", "message queue"},
    "Directory": {"directory", "ad", "activedirectory", "active directory", "domain controller", "dc", "ldap", "identity"},
    "DNS": {"dns", "nameserver", "name server"},
    "DHCP": {"dhcp"},
    "NTP": {"ntp", "time"},
    "File": {"file", "fileserver", "file server", "nas", "storage", "smb", "share"},
    "Mail": {"mail", "email", "smtp", "exchange"},
    "Monitoring": {"monitoring", "monitor", "observability", "nms"},
    "Logging": {"logging", "log", "logs", "siem"},
    "Backup": {"backup", "backups"},
    "Container Host": {"container host", "container", "containers", "docker", "k8s", "kubernetes", "node"},
    "Hypervisor": {"hypervisor", "esx", "esxi", "vmware", "virtualisation", "virtualization"},
    "CI": {"ci", "cicd", "build", "jenkins"},
    "VDI": {"vdi", "desktop", "virtual desktop"},
    "Print": {"print", "printer", "printing"},
}
# Fan-in: a destination port with this many distinct sources (or 25 percent of the
# managed workloads, whichever is lower, never below 3) makes the workload a hub.
HUB_SOURCES = 20
HUB_SHARE = 0.25
HUB_FLOOR = 3
PEER_APP_SHARE = 0.70
PEER_ENV_SHARE = 0.90
MAX_FULL_BATCH = 150
FLOW_BATCH = 25


# --------------------------------------------------------------------------- io

def read_text(path: pathlib.Path):
    try:
        return path.read_text()
    except OSError:
        return None


def load_json(path: pathlib.Path):
    """A saved tool result: JSON, possibly with a text prefix before the first brace."""
    text = read_text(path)
    if text is None:
        return None
    start = text.find("{")
    if start < 0:
        return None
    try:
        return json.loads(text[start:])
    except json.JSONDecodeError:
        return None


def load_labels(path: pathlib.Path):
    """get-labels returns the text 'Labels: [python repr]'; JSON is accepted too."""
    text = read_text(path)
    if text is None:
        return None
    body = text.strip()
    if body.startswith("Labels:"):
        body = body[len("Labels:"):].strip()
    for parser in (json.loads, ast.literal_eval):
        try:
            data = parser(body)
            if isinstance(data, list):
                return [d for d in data if isinstance(d, dict)]
        except (ValueError, SyntaxError):
            continue
    return None


def split_rows(envelope) -> list:
    if not isinstance(envelope, dict) or "columns" not in envelope:
        return []
    cols = envelope["columns"]
    return [dict(zip(cols, row)) for row in envelope.get("data", [])]


def label_value(v):
    """A label cell: None, '' and '-' are missing."""
    s = str(v).strip() if v is not None else ""
    return s if s and s != NA else None


def proto_name(p) -> str:
    return PROTO_NAMES.get(p, str(p).lower() if p is not None else "tcp")


def basename(proc) -> str:
    text = str(proc or "").strip()
    for sep in ("\\", "/"):
        if sep in text:
            text = text.rsplit(sep, 1)[-1]
    return text


def os_family(*hints) -> str:
    text = " ".join(str(h) for h in hints if h).lower()
    if "win" in text:
        return "windows"
    for mark in ("linux", "ubuntu", "rhel", "centos", "debian", "sles", "suse", "amzn", "amazon", "oracle", "rocky", "alma", "fedora"):
        if mark in text:
            return "linux"
    return "unknown"


def subnet24(ip: str):
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return None
    if addr.version != 4:
        return None
    return str(ipaddress.ip_network(f"{ip}/24", strict=False))


# ------------------------------------------------------------- process table

def load_process_table(path: pathlib.Path) -> list:
    """references/process-roles.md: rows of process | port | proto | os | role | note.
    A port cell may hold a comma-separated list; '*' is any. Role '-' is a known
    listener that carries no role (agents, sshd, RDP)."""
    text = read_text(path)
    rows = []
    if text is None:
        return rows
    for line in text.splitlines():
        if not line.strip().startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 5 or cells[0].lower() == "process" or set(cells[0]) <= {"-", ":", " "}:
            continue
        process, port, proto, os_, role = cells[:5]
        note = cells[5] if len(cells) > 5 else ""
        ports = set()
        for p in port.split(","):
            p = p.strip()
            if p == "*":
                ports.add("*")
            elif p.isdigit():
                ports.add(int(p))
        rows.append({"process": process.lower(), "ports": ports, "proto": proto.lower() or "*",
                     "os": os_.lower() or "*", "role": role if role != "-" else None,
                     "known": True, "note": note, "hub_only": note.lower().startswith("hub only")})
    return rows


def table_match(table: list, process: str, port, proto: str, os_: str) -> list:
    """Rows matching a listener. Process rows are preferred over port-only rows; a
    specific port over '*'. Unknown os matches every row."""
    proc = basename(process).lower()
    hits = []
    for r in table:
        if r["process"] == "*" or r["process"] != proc:
            continue
        if not (port in r["ports"] or "*" in r["ports"]):
            continue
        if r["proto"] not in ("*", proto):
            continue
        if r["os"] not in ("*", os_) and os_ != "unknown":
            continue
        hits.append(r)
    hits.sort(key=lambda r: ("*" in r["ports"], r["os"] == "*"))
    return hits


def port_only_match(table: list, port, proto: str, allow_hub_only: bool) -> list:
    out = []
    for r in table:
        if r["process"] != "*" or port not in r["ports"]:
            continue
        if r["proto"] not in ("*", proto):
            continue
        if r["hub_only"] and not allow_hub_only:
            continue
        out.append(r)
    return out


def known_process(table: list, process: str) -> bool:
    proc = basename(process).lower()
    return any(r["process"] == proc for r in table)


# ------------------------------------------------------------------ inventory

def load_inventory(scratch: pathlib.Path, inputs: dict):
    """labels.txt, workloads.json and the full-detail batches into one workload list."""
    labels = load_labels(scratch / "labels.txt")
    if labels is None:
        inputs["missing"].append("labels.txt")
        labels = []
    else:
        inputs["files"].append("labels.txt")
    vocab = defaultdict(set)
    for l in labels:
        k, v = l.get("key"), label_value(l.get("value"))
        if k and v:
            vocab[k].add(v)

    env = load_json(scratch / "workloads.json")
    rows = split_rows(env)
    if env is None:
        inputs["missing"].append("workloads.json")
    else:
        inputs["files"].append("workloads.json")
        if env.get("truncated"):
            inputs["truncated"].append("workloads.json")
    label_columns = set()
    if rows:
        label_columns = set(rows[0].keys()) - COMPACT_COLUMNS
    custom = sorted((set(vocab) | label_columns) - set(STANDARD))
    dims = STANDARD + custom

    workloads = {}
    order = []
    for r in rows:
        href = r.get("href")
        if not href:
            continue
        ips = [ip.strip() for ip in str(r.get("ip_addresses") or "").split(",") if ip.strip()]
        w = {"href": href, "hostname": r.get("hostname") or r.get("name") or href.rsplit("/", 1)[-1],
             "name": r.get("name"), "ips": ips, "os": os_family(r.get("os_type")),
             "online": bool(r.get("online")), "managed": bool(r.get("managed")),
             "labels": {}, "listeners": None, "os_id": None}
        for d in dims:
            v = label_value(r.get(d))
            if v:
                w["labels"][d] = v
        workloads[href] = w
        order.append(href)

    full_files = sorted(scratch.glob("workloads_full_*.json"), key=lambda p: natural_key(p.name))
    for path in full_files:
        env = load_json(path)
        if env is None:
            inputs["missing"].append(path.name)
            continue
        inputs["files"].append(path.name)
        if env.get("truncated"):
            inputs["truncated"].append(path.name)
        for rec in env.get("workloads") or []:
            href = rec.get("href")
            if not href:
                continue
            w = workloads.get(href)
            if w is None:
                ips = [i.get("address") for i in (rec.get("interfaces") or []) if isinstance(i, dict) and i.get("address")]
                w = {"href": href, "hostname": rec.get("hostname") or rec.get("name") or href.rsplit("/", 1)[-1],
                     "name": rec.get("name"), "ips": ips, "os": "unknown",
                     "online": bool(rec.get("online")), "managed": bool(rec.get("managed") or rec.get("agent") or rec.get("ven")),
                     "labels": {}, "listeners": None, "os_id": None}
                for lbl in rec.get("labels") or []:
                    k, v = lbl.get("key"), label_value(lbl.get("value"))
                    if k and v and k in dims:
                        w["labels"][k] = v
                workloads[href] = w
                order.append(href)
            w["os_id"] = rec.get("os_id") or rec.get("os_detail")
            fam = os_family(rec.get("os_id"), rec.get("os_detail"), rec.get("os_type"))
            if fam != "unknown":
                w["os"] = fam
            ports = ((rec.get("services") or {}).get("open_service_ports") or [])
            listeners = []
            for p in ports:
                if not isinstance(p, dict) or p.get("port") is None:
                    continue
                listeners.append({"port": int(p["port"]), "proto": proto_name(p.get("protocol")),
                                  "process": basename(p.get("process_name")), "raw": p.get("process_name"),
                                  "user": p.get("user"), "package": p.get("package"),
                                  "service": p.get("win_service_name")})
            w["listeners"] = listeners
    # Label values seen on workloads count as vocabulary too (labels.txt may be capped).
    for w in workloads.values():
        for k, v in w["labels"].items():
            vocab[k].add(v)
    return [workloads[h] for h in order], dims, custom, {k: sorted(v) for k, v in vocab.items()}


def natural_key(name: str):
    return [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", name)]


def label_state(w: dict, dims: list) -> str:
    """unlabelled: no label in any dimension; fully_labelled: every standard dimension
    (role, app, env, loc) present; partly_labelled: the rest. Custom dimensions count
    toward "unlabelled" but not toward "fully": a sparsely used custom key would
    otherwise keep an estate from ever reading as fully labelled (coverage per
    dimension carries the custom keys)."""
    if not any(d in w["labels"] for d in dims):
        return "unlabelled"
    standard = [d for d in STANDARD if d in dims] or dims
    return "fully_labelled" if all(d in w["labels"] for d in standard) else "partly_labelled"


# -------------------------------------------------------------------- traffic

def load_flows(scratch: pathlib.Path, inputs: dict):
    files = sorted(scratch.glob("flows_*.json"), key=lambda p: natural_key(p.name))
    rows, calls, truncated, pce_flows = [], 0, 0, 0
    for path in files:
        env = load_json(path)
        if env is None:
            inputs["missing"].append(path.name)
            continue
        inputs["files"].append(path.name)
        calls += 1
        if env.get("truncated"):
            truncated += 1
            inputs["truncated"].append(path.name)
        pce_flows += int(env.get("total_pce_flows") or 0)
        for r in split_rows(env):
            try:
                port = int(r.get("port")) if r.get("port") not in (None, NA) else None
            except (TypeError, ValueError):
                port = None
            rows.append({"src_ip": r.get("src_ip"), "src_hostname": label_value(r.get("src_hostname")),
                         "dst_ip": r.get("dst_ip"), "dst_hostname": label_value(r.get("dst_hostname")),
                         "port": port, "proto": proto_name(r.get("proto")),
                         "process": label_value(r.get("process_name")),
                         "conns": int(r.get("num_connections") or 0)})
    return rows, {"calls": calls, "truncated_calls": truncated, "pce_flows": pce_flows}


def resolve_side(ip, hostname, by_ip: dict, by_host: dict):
    if ip in by_ip:
        return by_ip[ip]
    if hostname and hostname.lower() in by_host:
        return by_host[hostname.lower()]
    return None


# ------------------------------------------------------------------ mining

def tokens_of(hostname: str) -> set:
    """(position, token) pairs: the hostname split on - _ . gives the positions; each
    part yields itself and, when it mixes letters and digits, its letter and digit runs."""
    parts = [p for p in re.split(r"[-_.]", str(hostname or "").lower()) if p]
    out = set()
    for i, p in enumerate(parts):
        out.add((i, p))
        runs = re.findall(r"[a-z]+|\d+", p)
        if len(runs) > 1:
            for r in runs:
                out.add((i, r))
    return out


def keep_rule(support: int, counter: int) -> bool:
    """support >= 3 with no counter-example; a rule with 10 or more supporting hosts
    survives counter-examples up to one in ten (they surface as conflicts)."""
    return support >= 3 and (counter == 0 or (support >= 10 and counter * 10 <= support))


def mine_hostname_rules(workloads: list, dims: list) -> dict:
    """{dim: {(pos, token): rule}}"""
    rules = {}
    for dim in dims:
        counts = defaultdict(Counter)
        for w in workloads:
            v = w["labels"].get(dim)
            if not v:
                continue
            for key in tokens_of(w["hostname"]):
                counts[key][v] += 1
        found = {}
        for (pos, tok), c in counts.items():
            value, support = c.most_common(1)[0]
            counter = sum(c.values()) - support
            if keep_rule(support, counter):
                found[(pos, tok)] = {"dimension": dim, "rule": f"hostname part {pos + 1} (split on - _ . and letter/digit runs)",
                                     "token": tok, "value": value, "support": support, "counter": counter}
        # A whole part ("web01") adds nothing when one of its runs ("web") already maps
        # to the same value at the same position.
        pruned = {}
        for (pos, tok), rule in found.items():
            runs = re.findall(r"[a-z]+|\d+", tok)
            if len(runs) > 1 and any((pos, r) in found and found[(pos, r)]["value"] == rule["value"] for r in runs):
                continue
            pruned[(pos, tok)] = rule
        rules[dim] = pruned
    return rules


def mine_subnet_rules(workloads: list, dims: list) -> dict:
    """{dim: {subnet: rule}} for loc and the custom dimensions: majority of 80 percent
    or more among at least 3 labelled workloads in the /24."""
    rules = {}
    for dim in dims:
        counts = defaultdict(Counter)
        for w in workloads:
            v = w["labels"].get(dim)
            net = subnet24(w["ips"][0]) if w["ips"] else None
            if v and net:
                counts[net][v] += 1
        found = {}
        for net, c in counts.items():
            value, support = c.most_common(1)[0]
            total = sum(c.values())
            if support >= 3 and support / total >= 0.8:
                found[net] = {"dimension": dim, "rule": "subnet /24 majority (80 percent or more)",
                              "token": net, "value": value, "support": support, "counter": total - support}
        rules[dim] = found
    return rules


# ------------------------------------------------------------------ vocabulary

def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(s).lower()).strip()


def role_value(canonical: str, vocab: dict):
    """(value, new_value): the customer's existing role value for a canonical role, by
    case-insensitive match or alias; else the canonical value flagged as new."""
    existing = vocab.get("role", [])
    for v in existing:
        if norm(v) == norm(canonical):
            return v, False
    aliases = ROLE_SYNONYMS.get(canonical, set())
    for v in existing:
        if norm(v) in aliases:
            return v, False
    return canonical, True


def same_value(a, b) -> bool:
    return norm(a) == norm(b)


# ----------------------------------------------------------------- inference

def analyse(workloads: list, dims: list, custom: list, vocab: dict, flows: list, table: list,
            infra, inputs: dict) -> dict:
    by_href = {w["href"]: w for w in workloads}
    by_ip, by_host = {}, {}
    for w in workloads:
        for ip in w["ips"]:
            by_ip.setdefault(ip, w["href"])
        by_host.setdefault(str(w["hostname"]).lower(), w["href"])
        if w.get("name"):
            by_host.setdefault(str(w["name"]).lower(), w["href"])
    managed = [w for w in workloads if w["managed"]]

    # traffic: adjacency, fan-in per destination port, rows per workload
    adj = defaultdict(Counter)
    fan_in = defaultdict(lambda: defaultdict(set))   # href -> (port, proto) -> set(src)
    touched = Counter()
    flows_with_process = flows_without_process = 0
    for f in flows:
        if f["process"]:
            flows_with_process += 1
        else:
            flows_without_process += 1
        s = resolve_side(f["src_ip"], f["src_hostname"], by_ip, by_host)
        d = resolve_side(f["dst_ip"], f["dst_hostname"], by_ip, by_host)
        if s:
            touched[s] += 1
        if d:
            touched[d] += 1
            if f["port"] is not None:
                fan_in[d][(f["port"], f["proto"])].add(f["src_ip"] or f["src_hostname"] or "?")
        if s and d and s != d:
            adj[s][d] += f["conns"]
            adj[d][s] += f["conns"]

    # hubs
    threshold = max(HUB_FLOOR, min(HUB_SOURCES, int(HUB_SHARE * len(managed) + 0.999))) if managed else HUB_SOURCES
    hubs = {}
    for href, ports in fan_in.items():
        ranked = sorted(ports.items(), key=lambda kv: (-len(kv[1]), kv[0][0]))
        qualifying = [(pp, srcs) for pp, srcs in ranked if len(srcs) >= threshold]
        if not qualifying:
            continue
        (port, proto), srcs = qualifying[0]
        w = by_href[href]
        rows = port_only_match(table, port, proto, allow_hub_only=True)
        kind = rows[0]["role"].lower() if rows and rows[0]["role"] else "service"
        proc = listener_process(w, port, proto)
        hubs[href] = {"href": href, "hostname": w["hostname"], "port": port, "proto": proto, "process": proc,
                      "sources": len(srcs), "kind": kind, "from": "fan-in",
                      "other_ports": [f"{p}/{q}" for (p, q), _ in qualifying[1:]]}
    infra_apps = {}
    if isinstance(infra, dict):
        for r in infra.get("results") or []:
            if r.get("tier") in ("Core Infrastructure", "Shared Service"):
                infra_apps[(r.get("app"), r.get("env"))] = r
    for w in workloads:
        key = (w["labels"].get("app"), w["labels"].get("env"))
        if key in infra_apps and key[0]:
            r = infra_apps[key]
            if w["href"] in hubs:
                continue   # found by fan-in already; the tool confirms it
            srcs = set()
            for s in fan_in.get(w["href"], {}).values():
                srcs |= s
            hubs[w["href"]] = {"href": w["href"], "hostname": w["hostname"], "port": None, "proto": None,
                               "process": None, "sources": len(srcs),
                               "kind": f"{r.get('tier', 'infrastructure').lower()} ({r.get('dominant_pattern', 'provider')})",
                               "from": "infra-tool", "other_ports": []}

    # conventions
    hostname_rules = mine_hostname_rules(workloads, dims)
    subnet_rules = mine_subnet_rules(workloads, ["loc"] + custom)
    conventions = []
    for dim in dims:
        conventions.extend(sorted(hostname_rules[dim].values(), key=lambda r: (-r["support"], r["token"])))
    for dim in ["loc"] + custom:
        conventions.extend(sorted(subnet_rules[dim].values(), key=lambda r: (-r["support"], r["token"])))
    app_members = Counter(w["labels"]["app"] for w in workloads if "app" in w["labels"])

    suggestions, conflicts, unresolved_wl = [], [], []
    unresolved_proc = defaultdict(lambda: {"workloads": 0, "hosts": []})
    for w in workloads:
        href = w["href"]
        is_hub = href in hubs
        candidates = defaultdict(list)   # dim -> signals with _value
        why = defaultdict(list)

        # role: listeners
        if w["listeners"] is None:
            why["role"].append("no full-detail record (no listener data)")
        else:
            covered_ports = set()
            for l in w["listeners"]:
                hits = table_match(table, l["process"], l["port"], l["proto"], w["os"])
                if hits:
                    row = hits[0]
                    covered_ports.add((l["port"], l["proto"]))
                    if row["role"]:
                        value, new = role_value(row["role"], vocab)
                        candidates["role"].append({"kind": "listening_process", "_value": value, "_new": new,
                                                   "evidence": f"{l['process']} listening on {l['port']}/{l['proto']} (table: {row['role']}{', ' + row['note'] if row['note'] else ''})"})
                        if row["os"] != "*" and w["os"] == row["os"]:
                            candidates["role"].append({"kind": "ven_os", "_value": value, "_new": new,
                                                       "evidence": f"{w['os']} VEN; the {l['process']} row is {row['os']}-specific"})
                    continue
                if known_process(table, l["process"]):
                    continue   # a known binary on an unlisted port: not a role, not unresolved
                prow = port_only_match(table, l["port"], l["proto"], allow_hub_only=False)
                if prow and prow[0]["role"]:
                    covered_ports.add((l["port"], l["proto"]))
                    value, new = role_value(prow[0]["role"], vocab)
                    candidates["role"].append({"kind": "listening_port", "_value": value, "_new": new,
                                               "evidence": f"listener {l['process'] or 'unknown process'} on {l['port']}/{l['proto']} (port table: {prow[0]['role']})"})
                    continue
                key = (l["process"] or "(no process name)", l["port"], l["proto"], w["os"])
                unresolved_proc[key]["workloads"] += 1
                if len(unresolved_proc[key]["hosts"]) < 10:
                    unresolved_proc[key]["hosts"].append(w["hostname"])
            # ports served in traffic that no listener record explained
            for (port, proto), srcs in fan_in.get(href, {}).items():
                if (port, proto) in covered_ports or len(srcs) < 2:
                    continue
                prow = port_only_match(table, port, proto, allow_hub_only=False)
                if prow and prow[0]["role"] and not any(l["port"] == port and l["proto"] == proto for l in w["listeners"]):
                    value, new = role_value(prow[0]["role"], vocab)
                    candidates["role"].append({"kind": "listening_port", "_value": value, "_new": new,
                                               "evidence": f"serves {port}/{proto} to {len(srcs)} sources in the window (port table: {prow[0]['role']})"})
        if w["listeners"] is None and href in fan_in:
            for (port, proto), srcs in fan_in[href].items():
                if len(srcs) < 2:
                    continue
                prow = port_only_match(table, port, proto, allow_hub_only=False)
                if prow and prow[0]["role"]:
                    value, new = role_value(prow[0]["role"], vocab)
                    candidates["role"].append({"kind": "listening_port", "_value": value, "_new": new,
                                               "evidence": f"serves {port}/{proto} to {len(srcs)} sources in the window (port table: {prow[0]['role']})"})
        if is_hub and hubs[href]["port"] is not None:
            h = hubs[href]
            prow = port_only_match(table, h["port"], h["proto"], allow_hub_only=True)
            if prow and prow[0]["role"]:
                value, new = role_value(prow[0]["role"], vocab)
                candidates["role"].append({"kind": "fan_in", "_value": value, "_new": new,
                                           "evidence": f"hub: {h['sources']} distinct sources on {h['port']}/{h['proto']}{' (also ' + ', '.join(h['other_ports']) + ')' if h['other_ports'] else ''}"})

        # hostname conventions, every dimension
        toks = tokens_of(w["hostname"])
        for dim in dims:
            fired = {}
            for key in toks:
                rule = hostname_rules[dim].get(key)
                if rule and (rule["value"] not in fired or fired[rule["value"]]["support"] < rule["support"]):
                    fired[rule["value"]] = rule
            if not fired:
                why[dim].append("no convention match")
                continue
            ranked = sorted(fired.values(), key=lambda r: -r["support"])
            if len(ranked) > 1 and ranked[0]["support"] == ranked[1]["support"]:
                why[dim].append("hostname rules disagree: " + " vs ".join(f"{r['token']} -> {r['value']}" for r in ranked))
                continue
            r = ranked[0]
            candidates[dim].append({"kind": "hostname_token", "_value": r["value"], "_new": False,
                                    "_support": r["support"], "_counter": r["counter"],
                                    "evidence": f"token {r['token']} (part {r['rule'].split()[2]}) maps to {r['value']} on {r['support']} labelled hosts, {r['counter']} counter-examples"})

        # peers (not for hubs, never through hubs)
        peers = {p: c for p, c in adj.get(href, {}).items() if p not in hubs and p in by_href}
        if is_hub:
            why["app"].append("hub: peers say nothing about it")
            why["env"].append("hub: peers say nothing about it")
        elif not peers:
            if touched.get(href):
                why["app"].append("no labelled peers")
                why["env"].append("no labelled peers")
            else:
                why["app"].append("no traffic in window")
                why["env"].append("no traffic in window")
        else:
            for dim, share, member_min in (("app", PEER_APP_SHARE, 2), ("env", PEER_ENV_SHARE, 1)):
                weights, counts = Counter(), Counter()
                for p, c in peers.items():
                    v = by_href[p]["labels"].get(dim)
                    if v:
                        weights[v] += c
                        counts[v] += 1
                total = sum(weights.values())
                if not total:
                    why[dim].append("no labelled peers")
                    continue
                value, weight = weights.most_common(1)[0]
                if weight / total >= share and (dim != "app" or app_members.get(value, 0) >= member_min):
                    candidates[dim].append({"kind": f"peer_{dim}", "_value": value, "_new": False,
                                            "evidence": f"{counts[value]} of {sum(counts.values())} labelled peers ({weight} of {total} connections) carry {dim}={value}"})
                else:
                    why[dim].append(f"labelled peers split: " + ", ".join(f"{v} {int(100 * c / total)} percent" for v, c in weights.most_common(3)))

        # subnet majority: loc and custom dimensions
        net = subnet24(w["ips"][0]) if w["ips"] else None
        for dim in ["loc"] + custom:
            rule = subnet_rules[dim].get(net) if net else None
            if rule:
                candidates[dim].append({"kind": "subnet_majority", "_value": rule["value"], "_new": False,
                                        "_support": rule["support"], "_counter": rule["counter"],
                                        "evidence": f"{rule['support']} of {rule['support'] + rule['counter']} labelled workloads in {net} carry {dim}={rule['value']}"})
            else:
                why[dim].append("no labelled neighbours in the /24" if net else "no IP address")

        # decide per dimension
        missing_unresolved = []
        for dim in dims:
            sigs = candidates.get(dim, [])
            decision = decide(sigs)
            if decision is None:
                if sigs:
                    why[dim].append("signals disagree: " + " vs ".join(sorted({f"{s['_value']} ({s['kind']})" for s in sigs})))
                if dim not in w["labels"]:
                    missing_unresolved.append(dim)
                continue
            value, chosen, confidence, new = decision
            if dim in custom and value not in vocab.get(dim, []):
                missing_unresolved.append(dim)
                continue
            if dim in w["labels"]:
                if not same_value(w["labels"][dim], value):
                    conflicts.append({"href": href, "hostname": w["hostname"], "dimension": dim,
                                      "existing": w["labels"][dim], "suggested": value, "confidence": confidence,
                                      "signals": public_signals(chosen)})
                continue
            suggestions.append({"href": href, "hostname": w["hostname"], "dimension": dim, "value": value,
                                "confidence": confidence, "source": "script", "new_value": bool(new and dim in STANDARD),
                                "signals": public_signals(chosen)})
        if missing_unresolved:
            reasons = []
            for dim in missing_unresolved:
                r = "; ".join(dict.fromkeys(why.get(dim, []))) or "no evidence"
                reasons.append(f"{dim}: {r}")
            unresolved_wl.append({"href": href, "hostname": w["hostname"], "missing": missing_unresolved,
                                  "why": " | ".join(reasons)})

    processes = [{"process": k[0], "port": k[1], "proto": k[2], "os": k[3], **v}
                 for k, v in sorted(unresolved_proc.items(), key=lambda kv: (-kv[1]["workloads"], kv[0]))]

    # readiness
    states = Counter(label_state(w, dims) for w in workloads)
    coverage = {d: {"labelled": sum(1 for w in workloads if d in w["labels"]),
                    "missing": sum(1 for w in workloads if d not in w["labels"])} for d in dims}
    with_listeners = sum(1 for w in workloads if w["listeners"])
    full_detail = sum(1 for w in workloads if w["listeners"] is not None)
    readiness = {
        "workloads": len(workloads), "managed": len(managed),
        "online": sum(1 for w in workloads if w["online"]),
        "unmanaged": len(workloads) - len(managed),
        "fully_labelled": states["fully_labelled"], "partly_labelled": states["partly_labelled"],
        "unlabelled": states["unlabelled"],
        "coverage": coverage,
        "process_visibility": {"with_listeners": with_listeners, "without": len(workloads) - with_listeners,
                               "flows_with_process": flows_with_process, "flows_without_process": flows_without_process},
        "traffic": {"flows": inputs["_traffic"]["pce_flows"], "calls": inputs["_traffic"]["calls"],
                    "truncated_calls": inputs["_traffic"]["truncated_calls"]},
        "notes": [],
    }
    notes = readiness["notes"]
    notes.append("fully labelled means all four standard dimensions (role, app, env, loc) are present; custom dimensions ("
                 + (", ".join(custom) if custom else "none") + ") count in the coverage table, not in this verdict")
    notes.append(f"full detail (listener records) read for {full_detail} of {len(workloads)} workloads; "
                 f"{with_listeners} report at least one listener")
    if not flows:
        notes.append("no flow rows read: peer, fan-in and port evidence is absent")
    if inputs["truncated"]:
        notes.append("truncated inputs (counts are lower bounds): " + ", ".join(inputs["truncated"]))
    if inputs["missing"]:
        notes.append("not read: " + ", ".join(inputs["missing"]))
    if hubs:
        notes.append(f"{len(hubs)} hubs (fan-in threshold {threshold} sources on one port, or listed by identify-infrastructure-services) excluded as peer evidence")
    if not workloads:
        notes.append("empty estate: nothing to label")

    return {
        "readiness": readiness,
        "conventions": conventions,
        "hubs": sorted(hubs.values(), key=lambda h: (-h["sources"], h["hostname"])),
        "suggestions": suggestions,
        "conflicts": conflicts,
        "unresolved": {"processes": processes, "workloads": unresolved_wl},
    }


def listener_process(w: dict, port, proto):
    for l in w.get("listeners") or []:
        if l["port"] == port and l["proto"] == proto:
            return l["process"] or None
    return None


def decide(sigs: list):
    """(value, signals, confidence, new_value) or None when nothing or a tie."""
    if not sigs:
        return None
    groups = defaultdict(list)
    for s in sigs:
        placed = False
        for v in groups:
            if same_value(v, s["_value"]):
                groups[v].append(s)
                placed = True
                break
        if not placed:
            groups[s["_value"]].append(s)
    # dedupe by kind within a value
    for v in groups:
        seen, kept = set(), []
        for s in groups[v]:
            if s["kind"] in seen:
                continue
            seen.add(s["kind"])
            kept.append(s)
        groups[v] = kept
    if len(groups) > 1 and "Directory" in groups and all(v == "Directory" or v in YIELDS_TO_DIRECTORY for v in groups):
        groups = {"Directory": groups["Directory"]}
    ranked = sorted(groups.items(), key=lambda kv: (-len({FAMILY[s["kind"]] for s in kv[1]}), -len(kv[1])))
    if len(ranked) > 1:
        a, b = ranked[0][1], ranked[1][1]
        if (len({FAMILY[s["kind"]] for s in a}), len(a)) == (len({FAMILY[s["kind"]] for s in b}), len(b)):
            return None
    value, chosen = ranked[0]
    return value, chosen, confidence_of(chosen), any(s.get("_new") for s in chosen)


def confidence_of(sigs: list) -> str:
    kinds = {s["kind"] for s in sigs}
    if kinds == {"model_knowledge"}:
        return sigs[0].get("_confidence", "low")
    families = {FAMILY[s["kind"]] for s in sigs}
    if len(families) >= 2:
        return "high"
    s = sigs[0]
    if s["kind"] in ("hostname_token", "subnet_majority") and s.get("_support", 0) >= 5 and s.get("_counter", 0) == 0:
        return "high"
    return "medium"


def public_signals(sigs: list) -> list:
    return [{"kind": s["kind"], "evidence": s["evidence"]} for s in sigs]


# ------------------------------------------------------------------ model merge

def merge_model(advice: dict, entries, workloads: list, dims: list, custom: list, vocab: dict) -> list:
    """model-suggestions.json entries become suggestions with source model; capped at
    medium; ignored with a note when the workload carries the dimension, the href or
    dimension is unknown, or a custom value does not exist yet."""
    notes = []
    by_href = {w["href"]: w for w in workloads}
    index = {(s["href"], s["dimension"]): s for s in advice["suggestions"]}
    merged = 0
    for e in entries if isinstance(entries, list) else []:
        if not isinstance(e, dict):
            continue
        href, dim, value = e.get("href"), e.get("dimension"), label_value(e.get("value"))
        conf = str(e.get("confidence") or "low").lower()
        conf = "medium" if conf in ("medium", "high") else "low"
        evidence = str(e.get("evidence") or "model knowledge")
        w = by_href.get(href)
        if w is None:
            notes.append(f"model: unknown href {href} ignored")
            continue
        if dim not in dims:
            notes.append(f"model: {w['hostname']} dimension {dim} is not a label key here; ignored")
            continue
        if not value:
            notes.append(f"model: {w['hostname']} {dim} has no value; ignored")
            continue
        if dim in w["labels"]:
            notes.append(f"model: {w['hostname']} already carries {dim}={w['labels'][dim]}; ignored")
            continue
        if dim in custom and value not in vocab.get(dim, []):
            notes.append(f"model: {w['hostname']} {dim}={value} is not an existing value of a custom dimension; ignored")
            continue
        signal = {"kind": "model_knowledge", "evidence": evidence}
        existing = index.get((href, dim))
        if existing:
            if same_value(existing["value"], value):
                existing["signals"].append(signal)
                notes.append(f"model agrees with the script on {w['hostname']} {dim}={existing['value']} (confidence unchanged)")
            else:
                notes.append(f"model proposes {w['hostname']} {dim}={value}, the script {existing['value']}; the script's suggestion stands")
            continue
        new = dim in STANDARD and not any(same_value(v, value) for v in vocab.get(dim, []))
        s = {"href": href, "hostname": w["hostname"], "dimension": dim, "value": value,
             "confidence": conf, "source": "model", "new_value": new, "signals": [signal]}
        advice["suggestions"].append(s)
        index[(href, dim)] = s
        merged += 1
        advice["unresolved"]["workloads"] = [u for u in advice["unresolved"]["workloads"]
                                             if not (u["href"] == href and u["missing"] == [dim])]
        for u in advice["unresolved"]["workloads"]:
            if u["href"] == href and dim in u["missing"]:
                u["missing"] = [d for d in u["missing"] if d != dim]
    notes.insert(0, f"model pass: {merged} suggestions merged, {len(notes)} notes")
    return notes


# ------------------------------------------------------------------------ plan

def default_preferences(dims: list) -> dict:
    return {"dimensions": list(dims), "min_confidence": "high", "scope": {"type": "all"}, "dry_run": True}


def in_scope(w: dict, scope: dict) -> bool:
    kind = (scope or {}).get("type", "all")
    value = (scope or {}).get("value")
    if kind == "all":
        return True
    if kind == "env":
        return same_value(w["labels"].get("env", ""), value or "")
    if kind == "subnet":
        try:
            net = ipaddress.ip_network(str(value), strict=False)
        except ValueError:
            return False
        return any(ipaddress.ip_address(ip) in net for ip in w["ips"] if is_ip(ip))
    if kind == "hostname":
        pattern = str(value or "").lower()
        host = str(w["hostname"]).lower()
        return fnmatch.fnmatchcase(host, pattern) if any(c in pattern for c in "*?[") else pattern in host
    if kind == "hrefs":
        return w["href"] in set(value or [])
    return False


def is_ip(s: str) -> bool:
    try:
        ipaddress.ip_address(s)
        return True
    except ValueError:
        return False


def build_plan(advice: dict, workloads: list, dims: list, prefs: dict) -> dict:
    by_href = {w["href"]: w for w in workloads}
    want = set(prefs.get("dimensions") or dims)
    floor = CONF_RANK.get(str(prefs.get("min_confidence", "high")).lower(), 2)
    scope = prefs.get("scope") or {"type": "all"}
    per = {}
    for s in advice["suggestions"]:
        w = by_href.get(s["href"])
        if w is None or s["dimension"] not in want or CONF_RANK.get(s["confidence"], 0) < floor:
            continue
        if s["dimension"] in w["labels"] or not in_scope(w, scope):
            continue
        entry = per.setdefault(s["href"], {"href": s["href"], "hostname": s["hostname"],
                                           "before": dict(w["labels"]), "add": {}, "after": {},
                                           "confidence": {}, "new_labels": []})
        entry["add"][s["dimension"]] = s["value"]
        entry["confidence"][s["dimension"]] = s["confidence"]
        if s.get("new_value"):
            entry["new_labels"].append({"key": s["dimension"], "value": s["value"]})
    new_labels = Counter()
    for e in per.values():
        e["after"] = {**e["before"], **e["add"]}
        for nl in e["new_labels"]:
            new_labels[(nl["key"], nl["value"])] += 1
    entries = sorted(per.values(), key=lambda e: e["hostname"])
    return {
        "preferences": {"dimensions": sorted(want, key=lambda d: dims.index(d) if d in dims else 99),
                        "min_confidence": prefs.get("min_confidence", "high"), "scope": scope,
                        "dry_run": bool(prefs.get("dry_run", True))},
        "workloads": entries,
        "new_labels": [{"key": k, "value": v, "workloads": n} for (k, v), n in sorted(new_labels.items())],
        "counts": {"workloads": len(entries), "labels_added": sum(len(e["add"]) for e in entries),
                   "labels_created": len(new_labels)},
    }


# -------------------------------------------------------------------- batches

def plan_batches(workloads: list, dims: list, max_full: int) -> dict:
    """Full-detail batches by /24 prefix (unlabelled first, under MAX_FULL_BATCH each,
    capped by max_full in total) and flow batches of FLOW_BATCH hrefs."""
    rank = {"unlabelled": 0, "partly_labelled": 1, "fully_labelled": 2}
    groups = defaultdict(list)
    no_ip = 0
    for w in workloads:
        net = subnet24(w["ips"][0]) if w["ips"] else None
        if net is None:
            no_ip += 1
            continue
        groups[net].append(w)
    ordered = sorted(groups.items(), key=lambda kv: (-sum(1 for w in kv[1] if label_state(w, dims) != "fully_labelled"), -len(kv[1]), kv[0]))
    full, used = [], 0
    for net, ws in ordered:
        if used and used + len(ws) > max_full:
            continue
        prefix = net.rsplit(".", 1)[0] + "."
        chunks = [(prefix, ws)]
        if len(ws) > MAX_FULL_BATCH:
            sub = defaultdict(list)
            for w in ws:
                sub[prefix + w["ips"][0].rsplit(".", 1)[-1][0]].append(w)
            chunks = sorted(sub.items())
        for p, chunk in chunks:
            full.append({"n": len(full) + 1, "ip_address": p,
                         "workloads": len(chunk), "unlabelled": sum(1 for w in chunk if label_state(w, dims) == "unlabelled")})
        used += len(ws)
        if used >= max_full:
            break
    hrefs = [w["href"] for w in sorted(workloads, key=lambda w: (rank[label_state(w, dims)], w["hostname"]))]
    flows = [{"n": i + 1, "hrefs": hrefs[k:k + FLOW_BATCH]} for i, k in enumerate(range(0, len(hrefs), FLOW_BATCH))]
    return {"full": full, "flows": flows,
            "notes": [f"{used} of {len(workloads)} workloads in {len(full)} full-detail batches (cap {max_full}); "
                      f"{no_ip} without an IPv4 address cannot be fetched by ip_address prefix",
                      f"{len(flows)} flow batches of up to {FLOW_BATCH} hrefs: one get-traffic-flows as include_sources "
                      f"(flows_src_<n>.json) and one as include_destinations (flows_dst_<n>.json) each"]}


# -------------------------------------------------------------------- writers

def md_table(headers: list, rows: list) -> str:
    out = ["| " + " | ".join(headers) + " |", "| " + " | ".join("---" for _ in headers) + " |"]
    for r in rows:
        out.append("| " + " | ".join(str(c).replace("|", "/") for c in r) + " |")
    return "\n".join(out)


def labels_text(d: dict) -> str:
    return ", ".join(f"{k}={v}" for k, v in sorted(d.items())) or "(none)"


def write_suggestions_md(a: dict) -> str:
    r = a["readiness"]
    lines = ["# Label advice", "",
             f"Generated {a['generated']}; window {a['window']['start']} to {a['window']['end']} ({a['window']['days']} days).", "",
             "## Readiness", "",
             f"{r['workloads']} workloads ({r['managed']} managed, {r['online']} online, {r['unmanaged']} unmanaged): "
             f"{r['fully_labelled']} fully labelled, {r['partly_labelled']} partly labelled, {r['unlabelled']} unlabelled.", "",
             md_table(["dimension", "labelled", "missing"], [[d, c["labelled"], c["missing"]] for d, c in r["coverage"].items()]), "",
             f"Process visibility: {r['process_visibility']['with_listeners']} workloads with listeners, "
             f"{r['process_visibility']['without']} without; {r['process_visibility']['flows_with_process']} flow rows with a process name, "
             f"{r['process_visibility']['flows_without_process']} without. Traffic: {r['traffic']['flows']} flows over "
             f"{r['traffic']['calls']} calls, {r['traffic']['truncated_calls']} capped.", ""]
    for n in r["notes"]:
        lines.append(f"- {n}")
    lines += ["", "## Suggestions", ""]
    if not a["suggestions"]:
        lines.append("None: every dimension the evidence could speak to is already labelled.")
    for dim in a["dimensions"]["standard"] + a["dimensions"]["custom"]:
        for conf in ("high", "medium", "low"):
            rows = [s for s in a["suggestions"] if s["dimension"] == dim and s["confidence"] == conf]
            if not rows:
                continue
            lines += [f"### {dim}, {conf} ({len(rows)})", "",
                      md_table(["hostname", "value", "new", "source", "signals"],
                               [[s["hostname"], s["value"], "yes" if s["new_value"] else "", s["source"],
                                 "; ".join(f"{g['kind']}: {g['evidence']}" for g in s["signals"])] for s in rows]), ""]
    lines += ["## Conventions", ""]
    lines.append(md_table(["dimension", "rule", "token", "value", "support", "counter"],
                          [[c["dimension"], c["rule"], c["token"], c["value"], c["support"], c["counter"]] for c in a["conventions"]])
                 if a["conventions"] else "None mined (fewer than 3 labelled workloads share a token or a subnet).")
    lines += ["", "## Conflicts", ""]
    lines.append(md_table(["hostname", "dimension", "existing", "suggested", "confidence", "signals"],
                          [[c["hostname"], c["dimension"], c["existing"], c["suggested"], c["confidence"],
                            "; ".join(f"{g['kind']}: {g['evidence']}" for g in c["signals"])] for c in a["conflicts"]])
                 if a["conflicts"] else "None: no existing label disagrees with the evidence.")
    lines += ["", "## Hubs", ""]
    lines.append(md_table(["hostname", "port", "process", "sources", "kind", "from"],
                          [[h["hostname"], f"{h['port']}/{h['proto']}" if h["port"] else "", h["process"] or "", h["sources"], h["kind"], h["from"]] for h in a["hubs"]])
                 if a["hubs"] else "None found.")
    u = a["unresolved"]
    lines += ["", "## Unresolved", "",
              f"{len(u['processes'])} listener kinds not in the table, {len(u['workloads'])} workloads with a dimension nothing speaks to (details in unresolved.md).", ""]
    p = a["plan"]
    lines += ["## Apply plan", "",
              f"Preferences: dimensions {', '.join(p['preferences']['dimensions'])}; minimum confidence {p['preferences']['min_confidence']}; "
              f"scope {p['preferences']['scope'].get('type', 'all')}; dry run {'yes' if p['preferences']['dry_run'] else 'no'}.",
              f"{p['counts']['workloads']} workloads, {p['counts']['labels_added']} labels added, {p['counts']['labels_created']} label values to create.", ""]
    if p["workloads"]:
        lines.append(md_table(["hostname", "before", "add", "confidence"],
                              [[e["hostname"], labels_text(e["before"]), labels_text(e["add"]),
                                ", ".join(f"{k} {v}" for k, v in e["confidence"].items())] for e in p["workloads"]]))
    return "\n".join(lines) + "\n"


def write_unresolved_md(a: dict) -> str:
    u = a["unresolved"]
    lines = ["# Unresolved: what the model pass should look at", "",
             "The script found no table row or no evidence for these. Add what you can justify from your own",
             "knowledge (the binary, the vendor product, the port) to `model-suggestions.json` and rerun with `--model`.",
             "Confidence is `low` or `medium` (never high: model knowledge is one signal); standard dimensions may",
             "name a value not in the vocabulary, custom dimensions may not.", "",
             "## Listeners not in process-roles.md", ""]
    lines.append(md_table(["process", "port", "proto", "os", "workloads", "hosts"],
                          [[p["process"], p["port"], p["proto"], p["os"], p["workloads"], ", ".join(p["hosts"])] for p in u["processes"]])
                 if u["processes"] else "None.")
    lines += ["", "## Workloads with a dimension nothing speaks to", ""]
    lines.append(md_table(["hostname", "href", "missing", "why"],
                          [[w["hostname"], w["href"], ", ".join(w["missing"]), w["why"]] for w in u["workloads"]])
                 if u["workloads"] else "None.")
    lines += ["", "## Shape to write back (`model-suggestions.json`)", "", "```json",
              json.dumps([{"href": "/orgs/1/workloads/<id>", "dimension": "role", "value": "Backup",
                           "confidence": "medium", "evidence": "svc_foo.exe on 9443/tcp is the Foo Backup manager port"}], indent=2),
              "```", ""]
    return "\n".join(lines)


def write_plan_md(a: dict) -> str:
    p = a["plan"]
    pref = p["preferences"]
    lines = ["# Apply plan" + (" (dry run)" if pref["dry_run"] else ""), "",
             f"Dimensions {', '.join(pref['dimensions'])}; minimum confidence {pref['min_confidence']}; scope {json.dumps(pref['scope'])}.",
             f"{p['counts']['workloads']} workloads, {p['counts']['labels_added']} labels added, {p['counts']['labels_created']} label values to create.",
             "Fill gaps only: no entry changes a label the workload already carries. `update-workload labels` replaces the",
             "whole set, so every call below carries the full set (before plus additions); the rollback call carries the before set.", ""]
    if p["new_labels"]:
        lines += ["## Label values to create first", "",
                  md_table(["key", "value", "workloads"], [[n["key"], n["value"], n["workloads"]] for n in p["new_labels"]]),
                  "", "Check each with `get-labels key:<key> value:<value>` for an exact match before `create-label`.", ""]
    lines += ["## Table", ""]
    if not p["workloads"]:
        lines.append("Nothing to apply under these preferences.")
    else:
        lines.append(md_table(["hostname", "href", "before", "add", "after", "confidence"],
                              [[e["hostname"], e["href"], labels_text(e["before"]), labels_text(e["add"]), labels_text(e["after"]),
                                ", ".join(f"{k} {v}" for k, v in e["confidence"].items())] for e in p["workloads"]]))
        lines += ["", "## Calls per workload", "",
                  "Apply only after the user's explicit yes, one workload at a time, re-reading the workload's labels",
                  "first (`get-workloads detail_level:labels_only href`) and skipping a key filled meanwhile.", ""]
        for e in p["workloads"]:
            lines += [f"### {e['hostname']}", "",
                      f"- apply: `update-workload href:{e['href']} labels:{call_labels(e['after'])}`",
                      f"- rollback: `update-workload href:{e['href']} labels:{call_labels(e['before'])}`", ""]
    return "\n".join(lines) + "\n"


def call_labels(d: dict) -> str:
    return json.dumps([{"key": k, "value": v} for k, v in sorted(d.items())])


def write_dashboard(path: pathlib.Path, advice: dict, template: pathlib.Path) -> str:
    if not template.exists():
        return f"no dashboard: template {template} not found"
    lines = template.read_text().split("\n")
    start = [i for i, l in enumerate(lines) if l.strip() == "// ===== DATA START ====="]
    end = [i for i, l in enumerate(lines) if l.strip() == "// ===== DATA END ====="]
    if not start or not end or end[0] <= start[0]:
        return "no dashboard: template has no DATA markers on their own lines"
    out = lines[:start[0] + 1] + ["const DATA = " + json.dumps(advice, indent=2) + ";"] + lines[end[0]:]
    path.write_text("\n".join(out))
    return "dashboard.jsx"


# ------------------------------------------------------------------------ main

def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--scratch", type=pathlib.Path, required=True, help="directory with the saved tool results")
    ap.add_argument("--out", type=pathlib.Path, required=True, help="output directory")
    ap.add_argument("--window-days", type=int, default=30)
    ap.add_argument("--date", help="Today as YYYY-MM-DD (default: the real date); fixes the window end and the generated stamp, used for reproducible runs")
    ap.add_argument("--max-full", type=int, default=300, help="workloads that get a full-detail batch, unlabelled first")
    ap.add_argument("--plan-batches", action="store_true", help="write batches.json from labels.txt and workloads.json, then exit")
    ap.add_argument("--model", action="store_true", help="merge model-suggestions.json")
    ap.add_argument("--template", type=pathlib.Path, default=None, help="dashboard template (default ../references/dashboard-example.jsx)")
    ap.add_argument("--preferences", type=pathlib.Path, default=None, help="preferences.json (default scratch/preferences.json if present)")
    ap.add_argument("--table", type=pathlib.Path, default=None, help="process table (default ../references/process-roles.md)")
    a = ap.parse_args(argv)

    here = pathlib.Path(__file__).resolve().parent
    template = a.template or here.parent / "references" / "dashboard-example.jsx"
    table_path = a.table or here.parent / "references" / "process-roles.md"
    a.out.mkdir(parents=True, exist_ok=True)
    inputs = {"files": [], "truncated": [], "missing": []}

    workloads, dims, custom, vocab = load_inventory(a.scratch, inputs)

    if a.plan_batches:
        batches = plan_batches(workloads, dims, a.max_full)
        (a.out / "batches.json").write_text(json.dumps(batches, indent=2) + "\n")
        print(f"batches.json: {len(batches['full'])} full-detail batches, {len(batches['flows'])} flow batches")
        for n in batches["notes"]:
            print(f"  {n}")
        for b in batches["full"]:
            print(f"  full {b['n']}: ip_address {b['ip_address']} ({b['workloads']} workloads, {b['unlabelled']} unlabelled)")
        return 0

    table = load_process_table(table_path)
    if not table:
        print(f"note: process table {table_path} not found or empty; role evidence from listeners is off", file=sys.stderr)
    flows, traffic = load_flows(a.scratch, inputs)
    inputs["_traffic"] = traffic
    summary = load_json(a.scratch / "summary.json")
    if summary is None:
        inputs["missing"].append("summary.json")
    else:
        inputs["files"].append("summary.json")
        if (summary.get("totals") or {}).get("truncated"):
            inputs["truncated"].append("summary.json")
        if not flows and summary.get("totals"):
            traffic["pce_flows"] = int(summary["totals"].get("pce_flows") or summary["totals"].get("rows") or 0)
    infra = load_json(a.scratch / "infra.json")
    if infra is None:
        inputs["missing"].append("infra.json")
    else:
        inputs["files"].append("infra.json")
        if "results" not in infra:
            inputs["missing"].append("infra.json (message only: " + str(infra.get("message", "no results"))[:80] + ")")

    today = date.fromisoformat(a.date) if a.date else date.today()
    window = {"start": (today - timedelta(days=a.window_days)).isoformat(), "end": today.isoformat(), "days": a.window_days}
    if isinstance(summary, dict) and isinstance(summary.get("window"), dict):
        s, e = str(summary["window"].get("start", ""))[:10], str(summary["window"].get("end", ""))[:10]
        if s and e:
            try:
                window = {"start": s, "end": e, "days": (date.fromisoformat(e) - date.fromisoformat(s)).days}
            except ValueError:
                pass

    result = analyse(workloads, dims, custom, vocab, flows, table, infra, inputs)
    advice = {
        "generated": (today.isoformat() + "T00:00:00Z") if a.date else datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "window": window,
        "inputs": {"files": inputs["files"], "truncated": inputs["truncated"], "missing": inputs["missing"]},
        "dimensions": {"standard": list(STANDARD), "custom": custom, "values": {d: vocab.get(d, []) for d in dims}},
        **result,
    }

    if a.model:
        entries = load_json_list(a.scratch / "model-suggestions.json")
        if entries is None:
            advice["inputs"]["missing"].append("model-suggestions.json")
            advice["readiness"]["notes"].append("model pass requested but model-suggestions.json not read")
        else:
            advice["inputs"]["files"].append("model-suggestions.json")
            advice["readiness"]["notes"].extend(merge_model(advice, entries, workloads, dims, custom, vocab))
    advice["suggestions"].sort(key=lambda s: (-CONF_RANK[s["confidence"]], dims.index(s["dimension"]), s["hostname"]))

    pref_path = a.preferences or (a.scratch / "preferences.json")
    prefs = load_json(pref_path) if pref_path.exists() else None
    if isinstance(prefs, dict):
        advice["inputs"]["files"].append(pref_path.name)
        prefs = {**default_preferences(dims), **prefs}
    else:
        prefs = default_preferences(dims)
    advice["plan"] = build_plan(advice, workloads, dims, prefs)

    (a.out / "advice.json").write_text(json.dumps(advice, indent=2) + "\n")
    (a.out / "plan.json").write_text(json.dumps(advice["plan"], indent=2) + "\n")
    (a.out / "suggestions.md").write_text(write_suggestions_md(advice))
    (a.out / "unresolved.md").write_text(write_unresolved_md(advice))
    (a.out / "plan.md").write_text(write_plan_md(advice))
    dash = write_dashboard(a.out / "dashboard.jsx", advice, template)

    r = advice["readiness"]
    print(f"readiness: {r['workloads']} workloads, {r['fully_labelled']} fully labelled, {r['partly_labelled']} partly, {r['unlabelled']} unlabelled")
    print(f"suggestions: {len(advice['suggestions'])} ({', '.join(f'{c} {n}' for c, n in Counter(s['confidence'] for s in advice['suggestions']).items()) or 'none'}); "
          f"conflicts: {len(advice['conflicts'])}; hubs: {len(advice['hubs'])}; conventions: {len(advice['conventions'])}")
    print(f"plan: {advice['plan']['counts']['workloads']} workloads, {advice['plan']['counts']['labels_added']} labels")
    print(f"wrote advice.json, suggestions.md, unresolved.md, plan.json, plan.md, {dash}")
    return 0


def load_json_list(path: pathlib.Path):
    text = read_text(path)
    if text is None:
        return None
    start = text.find("[")
    if start < 0:
        return []
    try:
        data = json.loads(text[start:])
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, list) else []


if __name__ == "__main__":
    sys.exit(main())
