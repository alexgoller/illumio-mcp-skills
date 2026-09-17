#!/usr/bin/env python3
"""Merge saved illumio-mcp query results into one agentic-AI flow table.

Inputs
  --flows      one or more JSON files saved from `get-traffic-flows`
               (split format: {"columns": [...], "data": [[...], ...]})
  --workloads  one JSON file saved from `get-workloads`
               (detail_level compact or labels_only; `full` also works)
  --egress     optional JSON file(s) saved from `discover-process-egress`
  --population label expression selecting the source population,
               e.g. "type=endpoint", "app=vdi,env=Users" (comma = AND) or
               "app=vdi|app=laptop" (pipe = OR between AND groups)

Outputs (in --out)
  flows.csv         every de-duplicated row with its classification
  summary.json      counts the report and the risk register are built from
  sankey_data.js    RAW / HOSTS / APPS constants for sankey-template.html
  sankey.html       the template with those constants spliced in, when
                    --sankey-template is given (ready to publish)

The script also prints a query-coverage report: which input files hit the
PCE's 500-flow cap and must be split further.

Stdlib only. Run with --help for options.
"""

from __future__ import annotations

import argparse
import ast
import csv
import ipaddress
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

PCE_FLOW_CAP = 500

# ---------------------------------------------------------------------------
# Agent catalog (mirror of references/agent-catalog.md; longest pattern wins)
# ---------------------------------------------------------------------------

UNAMBIGUOUS = [
    ("m365copilot", "Copilot"),
    ("lm studio", "LM Studio"),
    ("lmstudio", "LM Studio"),
    ("openclaw", "OpenClaw"),
    ("chatgpt", "ChatGPT"),
    ("windsurf", "Windsurf"),
    ("copilot", "Copilot"),
    ("claude", "Claude"),
    ("cursor", "Cursor"),
    ("gemini", "Gemini"),
    ("ollama", "Ollama"),
    ("codex", "Codex"),
    ("aider", "Aider"),
    ("goose", "Goose"),
]

AMBIGUOUS = [
    ("code.exe", "VS Code"),
    ("electron", "VS Code"),
    ("msedge", "Edge"),
    ("chrome", "Chrome"),
    ("python", "python"),
    ("node", "node"),
]

AGENT_ORDER = ["Cursor", "ChatGPT", "Claude", "Claude Code", "Codex", "Windsurf",
               "Copilot", "Gemini", "Aider", "Goose", "OpenClaw", "Ollama", "LM Studio"]

UNATTRIBUTED = {"", "-", "unknown", "none", "null", "nan"}

ADMIN_ROLES = {"dc", "jumpbox", "bastion", "admin", "jump"}
ADMIN_APPS = {"ad", "jump-infra", "bastion", "jumpbox"}
ADMIN_PORTS = {22, 3389, 88, 389, 445, 464, 636, 3268, 5985, 5986}
PII_APP_HINTS = ("hr", "hrm", "crm", "payroll", "people")
ODD_PORTS = {69, 110, 143, 5938, 23, 21, 25}

DEFAULT_DEFINING_LABELS = ["app", "env", "role", "loc", "bu", "type", "os",
                           "compliance", "data", "classification"]

WIN_USER_RE = re.compile(r"[a-z]:[\\/]+users[\\/]+([^\\/]+)", re.IGNORECASE)


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------

def load_json_loose(path: Path):
    """Load a tool result that may be raw JSON, a harness content-block list,
    a Python repr (get-labels), or JSON with a text prefix."""
    text = path.read_text(encoding="utf-8", errors="replace")
    for candidate in (text, text[text.find("{"):text.rfind("}") + 1],
                      text[text.find("["):text.rfind("]") + 1]):
        if not candidate:
            continue
        try:
            obj = json.loads(candidate)
        except json.JSONDecodeError:
            try:
                obj = ast.literal_eval(candidate)
            except (ValueError, SyntaxError):
                continue
        # harness content blocks: [{"type": "text", "text": "..."}]
        if isinstance(obj, list) and obj and isinstance(obj[0], dict) and "text" in obj[0]:
            inner = "".join(b.get("text", "") for b in obj if isinstance(b, dict))
            try:
                return json.loads(inner[inner.find("{"):inner.rfind("}") + 1])
            except json.JSONDecodeError:
                return inner
        return obj
    sys.exit(f"cannot parse {path}")


def split_to_records(obj) -> list[dict]:
    """Split-format ({columns, data}) or records ({workloads|rulesets|findings: [...]})."""
    if isinstance(obj, dict) and "columns" in obj and "data" in obj:
        cols = obj["columns"]
        return [dict(zip(cols, row)) for row in obj["data"]]
    if isinstance(obj, dict):
        for key in ("workloads", "findings", "flows", "rows"):
            if isinstance(obj.get(key), list):
                return obj[key]
    if isinstance(obj, list):
        return obj
    return []


def clean(v):
    if v is None:
        return ""
    s = str(v).strip()
    return "" if s.lower() in {"nan", "none", "null", "<na>"} else s


# ---------------------------------------------------------------------------
# Workloads
# ---------------------------------------------------------------------------

NON_LABEL_COLUMNS = {"href", "name", "hostname", "ip_addresses", "os_type", "online",
                     "managed", "enforcement_mode", "visibility_level", "labels",
                     "description", "public_ip", "interfaces", "agent"}


def build_host_map(path: Path):
    obj = load_json_loose(path)
    hosts: dict[str, dict] = {}
    ip_index: dict[str, str] = {}
    for rec in split_to_records(obj):
        hostname = clean(rec.get("hostname")) or clean(rec.get("name"))
        if not hostname:
            continue
        labels: dict[str, str] = {}
        if isinstance(rec.get("labels"), list):          # detail_level full
            for lab in rec["labels"]:
                if isinstance(lab, dict) and lab.get("key"):
                    labels[lab["key"]] = clean(lab.get("value"))
        for k, v in rec.items():                          # compact / labels_only
            if k not in NON_LABEL_COLUMNS and clean(v) and not isinstance(v, (list, dict)):
                labels.setdefault(k, clean(v))
        ips: list[str] = []
        raw_ips = rec.get("ip_addresses")
        if isinstance(raw_ips, str):
            ips = [p.strip() for p in raw_ips.split(",") if p.strip()]
        elif isinstance(raw_ips, list):
            ips = [clean(p) for p in raw_ips if clean(p)]
        for iface in rec.get("interfaces") or []:
            if isinstance(iface, dict) and clean(iface.get("address")):
                ips.append(clean(iface["address"]))
        hosts[hostname] = {
            "href": clean(rec.get("href")),
            "ips": sorted(set(ips)),
            "os": clean(rec.get("os_type")),
            "enforcement_mode": clean(rec.get("enforcement_mode")),
            "labels": labels,
        }
        for ip in ips:
            ip_index.setdefault(ip, hostname)
    return hosts, ip_index


def parse_population(expr: str) -> list[list[tuple[str, str]]]:
    """'a=1,b=2|c=3' -> [[(a,1),(b,2)], [(c,3)]]: OR of AND groups."""
    groups = []
    for alt in (expr or "").split("|"):
        pairs = []
        for part in alt.split(","):
            part = part.strip()
            if not part:
                continue
            if "=" not in part:
                sys.exit(f"population term '{part}' must be key=value")
            k, v = part.split("=", 1)
            pairs.append((k.strip(), v.strip()))
        if pairs:
            groups.append(pairs)
    return groups


def in_population(host: dict, groups) -> bool:
    if not groups:
        return True
    return any(all(host["labels"].get(k, "").lower() == v.lower() for k, v in g) for g in groups)


def host_kind(host: dict, kind_label: str) -> str:
    v = (host["labels"].get(kind_label) or host["labels"].get("type") or "").lower()
    if "vdi" in v:
        return "vdi"
    if "laptop" in v or "notebook" in v or "workstation" in v:
        return "laptop"
    return v or "endpoint"


# ---------------------------------------------------------------------------
# Process classification
# ---------------------------------------------------------------------------

def normalise_process(raw: str) -> str:
    return clean(raw).replace("\\", "/").rsplit("/", 1)[-1].lower()


def classify_process(raw: str, extra: list[tuple[str, str]]):
    """Return (family, class) with class in agent | ambiguous | unattributed | other."""
    base = normalise_process(raw)
    if base in UNATTRIBUTED:
        return "unattributed", "unattributed"
    for pat, fam in sorted(extra + UNAMBIGUOUS, key=lambda p: -len(p[0])):
        if pat in base:
            return fam, "agent"
    for pat, fam in AMBIGUOUS:
        if pat in base:
            return fam, "ambiguous"
    return base, "other"


def windows_user(raw: str) -> str:
    m = WIN_USER_RE.search(clean(raw))
    return m.group(1) if m else ""


def is_private(ip: str) -> bool:
    try:
        return ipaddress.ip_address(ip).is_private
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Flow merge
# ---------------------------------------------------------------------------

def to_int(v) -> int:
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return 0


def merge_flows(files, hosts, ip_index, pop_pairs, extra_agents):
    merged: dict[tuple, dict] = {}
    coverage = []
    outside_population = 0
    for path in files:
        obj = load_json_loose(path)
        recs = split_to_records(obj)
        pce_flows = obj.get("total_pce_flows") if isinstance(obj, dict) else None
        coverage.append({
            "file": str(path),
            "rows": len(recs),
            "total_pce_flows": pce_flows,
            "at_cap": (pce_flows is not None and pce_flows >= PCE_FLOW_CAP) or len(recs) >= PCE_FLOW_CAP,
            "message": obj.get("message") if isinstance(obj, dict) else None,
            "error": obj.get("error") if isinstance(obj, dict) else None,
        })
        for r in recs:
            process_raw = clean(r.get("process_name"))
            src_host = clean(r.get("src_hostname")) or ip_index.get(clean(r.get("src_ip")), "")
            src_ip = clean(r.get("src_ip"))
            dst_host = clean(r.get("dst_hostname")) or ip_index.get(clean(r.get("dst_ip")), "")
            dst_ip = clean(r.get("dst_ip"))
            dst_fqdn = clean(r.get("dst_fqdn"))
            port = to_int(r.get("port"))
            proto = clean(r.get("proto")).lower() or "tcp"
            if proto in {"6", "6.0"}:
                proto = "tcp"
            elif proto in {"17", "17.0"}:
                proto = "udp"
            conns = to_int(r.get("num_connections") or r.get("connections"))
            policy = clean(r.get("policy_decision")) or "unknown"

            src = hosts.get(src_host)
            if src is None or (pop_pairs and not in_population(src, pop_pairs)):
                outside_population += 1
                continue

            family, klass = classify_process(process_raw, extra_agents)
            dst_label = dst_host or dst_fqdn or dst_ip
            key = (process_raw.lower(), src_host, dst_label, port, proto)
            row = merged.get(key)
            if row is None:
                row = {
                    "src": src_host, "src_ip": src_ip,
                    "user": windows_user(process_raw) or clean(r.get("user_name")),
                    "process": process_raw, "agent": family, "class": klass,
                    "dst": dst_label, "dst_host": dst_host, "dst_ip": dst_ip,
                    "dst_fqdn": dst_fqdn, "port": port, "proto": proto,
                    "connections": conns, "policy": policy,
                    "scope": ("internal" if dst_host
                              else "unmanaged_internal" if is_private(dst_ip)
                              else "egress"),
                    "seen_in": 1,
                }
                merged[key] = row
            else:
                # Overlapping slices return the same grouped row; take the max,
                # do not sum, or overlaps would inflate counts.
                row["connections"] = max(row["connections"], conns)
                row["seen_in"] += 1
                if row["policy"] == "unknown" and policy != "unknown":
                    row["policy"] = policy
    return list(merged.values()), coverage, outside_population


# ---------------------------------------------------------------------------
# Analysis
# ---------------------------------------------------------------------------

def defining(labels: dict, keep: list[str]) -> dict:
    return {k: labels[k] for k in keep if labels.get(k)}


def is_regulated(labels: dict, reg_label: str, reg_env_re: re.Pattern) -> bool:
    if labels.get(reg_label):
        return True
    return bool(reg_env_re.search(labels.get("env", "")))


def analyse(rows, hosts, pop_pairs, args):
    keep = [k.strip() for k in args.labels.split(",") if k.strip()]
    reg_env_re = re.compile(args.regulated_env, re.IGNORECASE)
    population = {h for h, v in hosts.items() if not pop_pairs or in_population(v, pop_pairs)}

    agent_rows = [r for r in rows if r["class"] == "agent"]
    internal = [r for r in agent_rows if r["scope"] == "internal"]
    egress = [r for r in agent_rows if r["scope"] != "internal"]

    for r in internal:
        d = hosts[r["dst_host"]]
        r["dst_labels"] = defining(d["labels"], keep)
        r["app"] = d["labels"].get("app") or r["dst_host"]
        r["regulated"] = is_regulated(d["labels"], args.regulated_label, reg_env_re)
        role = d["labels"].get("role", "").lower()
        app = d["labels"].get("app", "").lower()
        r["admin"] = (role in ADMIN_ROLES or app in ADMIN_APPS) and r["port"] in ADMIN_PORTS
        r["pii"] = any(h == app or app.startswith(h) or app.endswith(h) for h in PII_APP_HINTS) \
            or d["labels"].get("data", "").lower() == "pii"
        r["odd_port"] = (r["regulated"] or role in ADMIN_ROLES or app in ADMIN_APPS) \
            and r["port"] in ODD_PORTS

    def by(rows_, keyf):
        out = defaultdict(lambda: {"flows": 0, "connections": 0, "endpoints": set(), "hosts": set(), "ports": set()})
        for r in rows_:
            k = keyf(r)
            o = out[k]
            o["flows"] += 1
            o["connections"] += r["connections"]
            o["endpoints"].add(r["src"])
            o["hosts"].add(r.get("dst_host") or r["dst"])
            o["ports"].add(f'{r["port"]}/{r["proto"]}')
        return {("|".join(k) if isinstance(k, tuple) else k): {
            "flows": v["flows"], "connections": v["connections"],
            "endpoints": sorted(v["endpoints"]), "hosts": sorted(v["hosts"]),
            "ports": sorted(v["ports"]),
        } for k, v in out.items()}

    endpoints_with_agents = sorted({r["src"] for r in agent_rows})
    inventory = []
    for h in sorted(population):
        hv = hosts[h]
        mine = [r for r in agent_rows if r["src"] == h]
        users = Counter(r["user"] for r in mine if r["user"])
        inventory.append({
            "endpoint": h,
            "kind": host_kind(hv, args.kind_label),
            "labels": defining(hv["labels"], keep),
            "enforcement_mode": hv["enforcement_mode"],
            "user": users.most_common(1)[0][0] if users else "",
            "agents": sorted({r["agent"] for r in mine}, key=agent_sort_key),
            "apps": sorted({r["app"] for r in mine if r["scope"] == "internal"}),
            "regulated": any(r.get("regulated") for r in mine),
            "admin": any(r.get("admin") for r in mine),
            "pii": any(r.get("pii") for r in mine),
            "connections": sum(r["connections"] for r in mine),
        })

    all_pop_rows = [r for r in rows]
    unattributed = [r for r in all_pop_rows if r["class"] == "unattributed"]
    ambiguous = [r for r in all_pop_rows if r["class"] == "ambiguous"]
    n_rows = len(all_pop_rows) or 1

    risk_contradictions = []
    for inv in inventory:
        rl = hosts[inv["endpoint"]]["labels"].get("risk", "")
        if rl and "low" in rl.lower() and (inv["regulated"] or inv["admin"]):
            risk_contradictions.append({"endpoint": inv["endpoint"], "risk_label": rl,
                                        "regulated": inv["regulated"], "admin": inv["admin"]})

    summary = {
        "population": {"expression": args.population, "count": len(population),
                       "by_kind": dict(Counter(i["kind"] for i in inventory)),
                       "enforcement_modes": dict(Counter(i["enforcement_mode"] for i in inventory if i["enforcement_mode"]))},
        "endpoints_with_agents": {"count": len(endpoints_with_agents),
                                  "by_kind": dict(Counter(i["kind"] for i in inventory if i["agents"])),
                                  "by_role": dict(Counter(i["labels"].get("role", "") for i in inventory if i["agents"]))},
        "agents": {a: {**v, "endpoint_count": len(v["endpoints"])} for a, v in
                   sorted(by(agent_rows, lambda r: r["agent"]).items(), key=lambda kv: agent_sort_key(kv[0]))},
        "internal": {
            "flows": len(internal),
            "connections": sum(r["connections"] for r in internal),
            "hosts": len({r["dst_host"] for r in internal}),
            "apps": len({r["app"] for r in internal}),
            "policy": dict(Counter(r["policy"] for r in internal)),
            "by_agent_app": by(internal, lambda r: (r["agent"], r["app"])),
            "by_agent_host_port": by(internal, lambda r: (r["agent"], r["dst_host"], f'{r["port"]}/{r["proto"]}')),
            "by_app": by(internal, lambda r: r["app"]),
        },
        "regulated_reach": [slim(r) for r in internal if r["regulated"]],
        "admin_reach": [slim(r) for r in internal if r["admin"]],
        "pii_reach": [slim(r) for r in internal if r["pii"]],
        "odd_ports": [slim(r) for r in internal if r["odd_port"]],
        "egress": {
            "vendor_or_external": [slim(r) for r in egress if r["scope"] == "egress"],
            "unmanaged_internal": [slim(r) for r in egress if r["scope"] == "unmanaged_internal"],
            "connections": sum(r["connections"] for r in egress),
        },
        "coverage": {
            "rows_total": len(all_pop_rows),
            "unattributed_rows": len(unattributed),
            "unattributed_pct": round(100 * len(unattributed) / n_rows, 1),
            "ambiguous_rows": len(ambiguous),
            "ambiguous_pct": round(100 * len(ambiguous) / n_rows, 1),
            "possible_agent_hosts": by(ambiguous, lambda r: r["agent"]),
            "other_processes_top": Counter(r["agent"] for r in all_pop_rows if r["class"] == "other").most_common(15),
        },
        "risk_label_contradictions": risk_contradictions,
        "inventory": inventory,
    }
    return summary, internal, egress


def slim(r):
    return {k: r[k] for k in ("src", "user", "agent", "dst", "port", "proto",
                              "connections", "policy") if k in r} | \
           {k: r[k] for k in ("app", "dst_labels", "regulated", "admin", "pii") if k in r}


def agent_sort_key(a: str):
    return (AGENT_ORDER.index(a) if a in AGENT_ORDER else len(AGENT_ORDER), a)


# ---------------------------------------------------------------------------
# Egress findings from discover-process-egress
# ---------------------------------------------------------------------------

def load_egress(files, hosts, ip_index, extra_agents):
    out = []
    for path in files:
        obj = load_json_loose(path)
        for f in split_to_records(obj):
            fam, klass = classify_process(clean(f.get("process")), extra_agents)
            dest = clean(f.get("destination"))
            managed = dest in hosts or dest in ip_index
            out.append({
                "process": clean(f.get("process")), "agent": fam, "class": klass,
                "destination": dest, "port": to_int(f.get("port")),
                "proto": clean(f.get("proto")) or "tcp",
                "connections": to_int(f.get("connections")),
                "policy": clean(f.get("policy_decision")),
                "permitted_today": bool(f.get("permitted_today")),
                "likely_provider": clean(f.get("likely_provider")),
                "provider_confidence": clean(f.get("provider_confidence")),
                "scope": ("managed" if managed
                          else "unmanaged_internal" if is_private(dest)
                          else "egress"),
            })
    return out


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

CSV_FIELDS = ["src", "user", "src_labels", "process", "agent", "class", "scope", "dst",
              "dst_ip", "dst_fqdn", "app", "dst_labels", "port", "proto", "connections",
              "policy", "regulated", "admin", "pii", "odd_port", "seen_in"]


def fmt_labels(d: dict) -> str:
    return " ".join(f"{k}={v}" for k, v in d.items())


def write_csv(path: Path, rows, hosts, keep):
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=CSV_FIELDS, extrasaction="ignore")
        w.writeheader()
        for r in sorted(rows, key=lambda r: (-r["connections"], r["src"], r["dst"])):
            out = dict(r)
            out["src_labels"] = fmt_labels(defining(hosts[r["src"]]["labels"], keep))
            out["dst_labels"] = fmt_labels(r.get("dst_labels", {}))
            w.writerow(out)


def write_sankey(path: Path, internal, hosts, keep, args):
    raw, host_out, app_out = [], {}, {}
    reg_env_re = re.compile(args.regulated_env, re.IGNORECASE)
    for r in sorted(internal, key=lambda r: (agent_sort_key(r["agent"]), -r["connections"])):
        raw.append({"src": r["src"], "user": r["user"], "kind": host_kind(hosts[r["src"]], args.kind_label),
                    "agent": r["agent"], "dst": r["dst_host"], "app": r["app"], "port": r["port"],
                    "proto": r["proto"], "connections": r["connections"], "policy": r["policy"]})
        s = hosts[r["src"]]
        host_out.setdefault(r["src"], {"kind": host_kind(s, args.kind_label), "user": r["user"],
                                       "labels": defining(s["labels"], keep)})
        if r["user"] and not host_out[r["src"]]["user"]:
            host_out[r["src"]]["user"] = r["user"]
        d = hosts[r["dst_host"]]
        host_out.setdefault(r["dst_host"], {"kind": "server", "labels": defining(d["labels"], keep)})
        app_out.setdefault(r["app"], {
            "bu": d["labels"].get("bu", ""), "env": d["labels"].get("env", ""),
            "compliance": d["labels"].get(args.regulated_label, ""),
            "regulated": is_regulated(d["labels"], args.regulated_label, reg_env_re),
        })
    js = ("// ==== DATA (generated by aggregate_flows.py) ====\n"
          f"const RAW = {json.dumps(raw, indent=1)};\n"
          f"const HOSTS = {json.dumps(host_out, indent=1)};\n"
          f"const APPS = {json.dumps(app_out, indent=1)};\n")
    path.write_text(js, encoding="utf-8")
    return len(raw)


DATA_START = "// ==== DATA"
DATA_END = "// ==== END DATA ===="


def splice_template(template: Path, data_js: Path, out: Path):
    html = template.read_text(encoding="utf-8")
    start, end = html.find(DATA_START), html.find(DATA_END)
    if start < 0 or end < 0:
        sys.exit(f"{template} has no '{DATA_START} ... {DATA_END}' block")
    out.write_text(html[:start] + data_js.read_text(encoding="utf-8") + html[end:], encoding="utf-8")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--flows", nargs="+", required=True, type=Path, help="get-traffic-flows result files")
    ap.add_argument("--workloads", required=True, type=Path, help="get-workloads result file")
    ap.add_argument("--egress", nargs="*", default=[], type=Path, help="discover-process-egress result files")
    ap.add_argument("--population", default="",
                    help='source population, e.g. "type=endpoint"; comma = AND, pipe = OR ("app=vdi|app=laptop")')
    ap.add_argument("--labels", default=",".join(DEFAULT_DEFINING_LABELS),
                    help="defining label keys to show, comma separated")
    ap.add_argument("--kind-label", default="app", help="label whose value says vdi vs laptop (default app)")
    ap.add_argument("--regulated-label", default="compliance", help="label key whose presence marks a regulated host")
    ap.add_argument("--regulated-env", default=r"^(pci|swift|hipaa)", help="regex on env values that mark a regulated host")
    ap.add_argument("--extra-agent", action="append", default=[],
                    help="add a catalog entry as Family=substring, repeatable")
    ap.add_argument("--sankey-template", type=Path,
                    default=Path(__file__).resolve().parent.parent / "references" / "sankey-template.html",
                    help="sankey-template.html to fill; pass an empty string to skip")
    ap.add_argument("--out", required=True, type=Path, help="output directory")
    args = ap.parse_args(argv)

    extra = []
    for e in args.extra_agent:
        fam, _, pat = e.partition("=")
        if not pat:
            sys.exit(f"--extra-agent needs Family=substring, got {e!r}")
        extra.append((pat.lower(), fam))

    hosts, ip_index = build_host_map(args.workloads)
    pop_pairs = parse_population(args.population)
    rows, coverage, outside = merge_flows(args.flows, hosts, ip_index, pop_pairs, extra)
    summary, internal, egress = analyse(rows, hosts, pop_pairs, args)
    summary["egress"]["discover_process_egress"] = load_egress(args.egress, hosts, ip_index, extra)
    summary["query_coverage"] = {"files": coverage, "rows_outside_population": outside,
                                 "files_at_cap": [c["file"] for c in coverage if c["at_cap"]]}

    args.out.mkdir(parents=True, exist_ok=True)
    keep = [k.strip() for k in args.labels.split(",") if k.strip()]
    write_csv(args.out / "flows.csv", rows, hosts, keep)
    n_raw = write_sankey(args.out / "sankey_data.js", internal, hosts, keep, args)
    if args.sankey_template and str(args.sankey_template) and args.sankey_template.exists():
        splice_template(args.sankey_template, args.out / "sankey_data.js", args.out / "sankey.html")
    (args.out / "summary.json").write_text(json.dumps(summary, indent=1, default=list), encoding="utf-8")

    p = summary["population"]
    e = summary["endpoints_with_agents"]
    i = summary["internal"]
    c = summary["coverage"]
    print(f"workloads: {len(hosts)}  population: {p['count']} {p['by_kind']}")
    print(f"endpoints with agents: {e['count']} {e['by_kind']}")
    print(f"agent flows internal: {i['flows']} to {i['hosts']} hosts across {i['apps']} apps, "
          f"{i['connections']:,} connections, policy {i['policy']}")
    print(f"agent egress rows: {len(summary['egress']['vendor_or_external'])} external, "
          f"{len(summary['egress']['unmanaged_internal'])} unmanaged RFC1918")
    print(f"regulated reach rows: {len(summary['regulated_reach'])}  admin: {len(summary['admin_reach'])}  "
          f"pii: {len(summary['pii_reach'])}  odd ports: {len(summary['odd_ports'])}")
    print(f"coverage: {c['unattributed_pct']}% unattributed, {c['ambiguous_pct']}% ambiguous hosts, "
          f"{outside} rows outside population")
    print(f"sankey rows: {n_raw}  -> {args.out} "
          f"({'sankey.html ready' if (args.out / 'sankey.html').exists() else 'sankey_data.js only'})")
    at_cap = summary["query_coverage"]["files_at_cap"]
    if at_cap:
        print(f"\nWARNING {len(at_cap)} slice(s) hit the {PCE_FLOW_CAP}-flow PCE cap and must be split further:")
        for f in at_cap:
            print(f"  {f}")
    for cv in coverage:
        if cv["error"]:
            print(f"ERROR in {cv['file']}: {cv['error']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
