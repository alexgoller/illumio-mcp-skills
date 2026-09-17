---
name: illumio-agentic-ai-risk-assessment
description: "Use when the user asks for an agentic AI risk assessment, AI agent risk, shadow AI assessment, or which endpoints run Claude, ChatGPT, Cursor, Copilot, Codex, Gemini, Windsurf or similar agents on an Illumio PCE. Also use for: what are the AI agents talking to, AI agent reach, an AI agent Sankey or flow diagram of AI processes to internal systems, or assess agentic AI in the org, the PCE or this tenant. Not for general PCE health, ransomware or segmentation assessments (those are illumio-pce-assessment and illumio-daily-assessment). Requires the illumio-mcp MCP server."
---

# Illumio Agentic AI Risk Assessment

Answer four questions a CISO or auditor asks about agentic AI, with evidence
from the PCE:

1. Which managed workloads run agentic AI clients (Claude, ChatGPT, Cursor,
   Copilot, Codex and the like)?
2. What internal systems do those agents connect to, on which ports, under
   which user?
3. What do the agents send outbound, and to whom?
4. Does current policy stop any of it, and what should change?

Output: a written risk assessment (risk register, regulatory mapping,
prioritised Illumio recommendations) and an interactive Sankey of endpoint to
agent to internal application.

The skill is descriptive and advisory. It **never provisions policy**. It may
draft rulesets and hand them to the user for review.

## Files

| File | Use it for |
| --- | --- |
| `references/agent-catalog.md` | process names, matching rules, vendor egress hints |
| `references/risk-rubric.md` | likelihood and impact scales, R1 to R11, regulatory table |
| `references/report-template.md` | ten-section skeleton with the sentence each section opens with |
| `references/sankey-template.html` | the reach diagram; replace `RAW`, `HOSTS`, `APPS` |
| `scripts/aggregate_flows.py` | merges saved query results into one flow table, emits the Sankey constants |

Read the catalog and rubric before Step 3. Read the template before Step 7.

## Preconditions and the one up-front question

- `illumio-mcp:check-pce-connection` must succeed. If it fails, stop and say
  so.
- Ask **one** question before starting, covering both: report format (Claude
  Doc, .docx, markdown in chat) and lookback window (default: everything the
  PCE holds, typically 4 to 30 days). Ask nothing else up front. Make
  assumptions and state them at the top of the report.
- Optional scope override: a label expression for the source population.
  Default `type=endpoint`. When `type` is not a label dimension, fall back in
  this order: `app=vdi` plus `app=laptop` (two values, so two queries per
  slice and `--population "app=vdi|app=laptop"` for the script), then
  `env=Users`. When several of these exist, `type` wins. If no endpoint-like
  label exists, use all workloads and say so in the scope section.

## Workflow

Create a task list with one item per step plus the verification task. Save
every raw tool result to a scratch file; the harness writes large results to
disk anyway, and the script reads them from there.

### Step 1: Connection and label schema

```
illumio-mcp:check-pce-connection
illumio-mcp:get-labels            max_results: 500
```

`get-labels` returns a Python-repr list (`Labels: [{'href':..., 'key':...,
'value':...}, ...]`), not JSON. Build a map of label key to values. Decide two things and write them down:

- the **source-population key** (`type`, else `app`, else `env`)
- the **defining label set** (see Label handling below)

### Step 2: Workload inventory with labels

```
illumio-mcp:get-workloads         detail_level: "compact", max_results: 10000
```

Save the result as `scratch/workloads.json`. `compact` returns split-format
JSON (`columns` + `data`) with `href`, `hostname`, `ip_addresses`, `os_type`,
`enforcement_mode` and one column per label key. It is a superset of
`labels_only` and also gives the IPs needed to resolve IP-only destinations
and the per-workload enforcement mode that Step 5 needs (the enforcement
status tool only returns aggregates). Build
`hosts[hostname] = {href, ips, enforcement_mode, labels{key: value}}` for
**every** workload; destinations are resolved against it later. Select the source population by
the chosen label. Record the count and the split by the second-level grouping
(VDI versus laptop from `app`, or whatever the org uses).

### Step 3: Traffic from the source population, grouped by process

```
illumio-mcp:get-traffic-flows
  group_by: ["process", "source", "destination", "port", "proto", "policy"]
  include_sources:      ["<population label>", "<slice label>"]
  include_destinations: ["<destination slice label>"]
  start_date: "YYYY-MM-DD"   end_date: "YYYY-MM-DD"
```

The result is split-format JSON: `columns` plus `data` rows, with
`process_name` (full path as the VEN reported it), `src_hostname`, `src_ip`,
`dst_hostname`, `dst_ip`, `dst_fqdn`, `port`, `proto`, `policy_decision` and
`num_connections`, sorted by connections descending. `total_pce_flows` is the
number of flows the PCE returned before grouping.

Two constraints decide the query plan:

1. **The PCE returns at most 500 flows per query, silently.** The server
   overrides `max_results` to 500, and `truncated` only reports byte-size
   trimming of the response, never the PCE cap. A result with
   `total_pce_flows` of 500 (or 500 rows) is a truncated result. Split until
   every slice comes back under 500.
2. **`include_sources` and `include_destinations` take label shorthand only**
   (`key=value`). Workload hrefs and bare IPs fail with a
   `TrafficQueryFilter` type error. Entries in one list are **ANDed**:
   `["bu=hr", "bu=health"]` returns nothing unless a workload carries both.

Slicing plan:

- Outer loop: values of a source-side label that partitions the population
  (`role` works: contractor, admin, employee; `os` as a fallback). When the
  population itself is two label values (`app=vdi`, `app=laptop`), those two
  values are the outermost loop and `role` nests inside.
- OR is always a second query. For `bu=hr` or `bu=health`, run one query
  with `["bu=hr"]` and one with `["bu=health"]`; the script merges them.
- Inner loop: values of a destination-side label that partitions internal
  systems (`bu`; `app` if there is no `bu`).
- One extra query per source slice with **no** destination filter, to catch
  egress and unlabeled destinations.
- Save each result as `flows_<src>_<dst>.json` in the scratchpad. Note the
  row count of every slice; any slice at 500 must be split again (add a third
  label, or split by `proto`, or halve the date window).

Merge:

```bash
python3 scripts/aggregate_flows.py \
  --flows scratch/flows_*.json \
  --workloads scratch/workloads.json \
  --egress scratch/egress.json \
  --population "type=endpoint" \
  --out scratch/merged
```

The script de-duplicates on (process, source, destination, port, proto), tags
each row with the catalog family, extracts the Windows user from the process
path, resolves destinations against the workload map, and splits rows into
**internal** (destination is a managed workload), **egress** (IP or FQDN not
in the map), **ambiguous** (host process) and **unattributed** (no process).
It also prints every input file that held exactly 500 rows. Run `--help` for
options. Outputs: `merged/flows.csv`, `merged/summary.json`,
`merged/sankey_data.js` holding the `RAW`, `HOSTS` and `APPS` constants, and
`merged/sankey.html`, the template with those constants spliced in.

### Step 4: Egress detail

```
illumio-mcp:discover-process-egress
  include_sources: ["<population label>"]
  process: ["claude", "chatgpt", "cursor", "codex", "copilot", "gemini", "windsurf", "ollama"]
  lookback_days: 30
  limit: 100
  max_results: 500
```

- Map destinations to providers with the hints table in the catalog. Confirm
  with the FQDN the PCE resolved or reverse DNS; otherwise write "likely".
- Save the result as `scratch/egress.json` and pass it to the script with
  `--egress`. Each finding carries `process` (basename only), `destination`
  (FQDN if resolved, else IP), `port`, `proto`, `policy_decision`,
  `permitted_today`, `connections`, and `likely_provider` with
  `provider_confidence` when the server could attribute it. Record
  `permitted_today` and connection counts per destination.
- Any RFC1918 destination not in the workload map is an **unmanaged internal
  host**. Report it separately from vendor egress. Cross-check whether the
  same address appears as a *source* of blocked or potentially blocked
  traffic against the endpoints; if so, call it a possible foothold (R7).

### Step 5: Policy posture

```
illumio-mcp:get-workload-enforcement-status
illumio-mcp:get-rulesets              max_results: 200
illumio-mcp:compare-draft-active      resource_type: "rule_sets"
illumio-mcp:enforcement-readiness     (optional, for the two or three most-reached apps)
```

- Enforcement mode counts overall (from the enforcement status tool) and
  for the source population (from the `enforcement_mode` column of the
  Step 2 inventory; the status tool only returns per-app aggregates).
- For each ruleset decide whether it touches the population as consumer or
  any agent-reached app as provider. Note rules whose name or description
  claims process restriction but whose services are port-only (R5). Note
  any/any allows inside app scopes.
- From the draft-versus-active result, say whether the observed state is
  live or partly unprovisioned. Report only what the filtered call returns;
  pending changes on other object types are out of scope.
- In selective enforcement, "allowed" in Explorer means "no deny matched",
  not "an allow rule exists". Say so in the posture section.

### Step 6: Analysis

Compute from `merged/flows.csv` and `summary.json`:

- endpoints with agents, by kind and role; agents per endpoint; endpoints
  per agent
- connections and distinct flows per (agent, app) and per (agent, host, port)
- **regulated reach**: destination carries `compliance=*`, `env=PCI`, or the
  org's equivalent
- **administrative reach**: destination `role` in {dc, jumpbox, bastion,
  admin} or `app` in {ad, jump-infra}, and port in {22, 3389, 88, 389, 445,
  5985, 5986}
- **odd ports**: anything on a regulated or admin host that is not the app's
  expected service (TFTP 69, POP3 110, IMAP 143, 5938 and similar are red
  flags)
- **personal-data reach**: apps named hr, hrm, crm, payroll, people, or
  carrying a `data=pii` style label
- **label contradictions**: if a `risk` or `tier` label exists, compare it to
  observed reach (R10)

### Step 7: Score and write

Fill the risk register and regulatory table from `references/risk-rubric.md`
and write the report along `references/report-template.md`. Publish
`merged/sankey.html` as the Sankey artifact (favicon, title "Agentic AI
Reach"). Then run the verification task below before publishing anything.

## Label handling

Every workload in the report, source or destination, is shown with its
**defining labels**: the ones that say what the thing is, not all labels.

- **Always show when present**: `app`, `env`, `role`, `loc`.
- **Show when they add meaning**: `bu`, `type`, `os`, `compliance`, `data` or
  `classification`.
- **Drop**: labels that only steer policy or incident workflow.
  `quarantine.illumio.com=*`, `DFIRBubble=*`, IR bubble labels, `risk=*` when
  it is a policy knob, `kc=*` cluster tags, temporary migration tags.

Rule of thumb: if the label would change during an incident or a policy
rollout without the asset changing, it is a policy label and is dropped.
Dropped means dropped from the printed label set only. `risk` and `tier` are
still read for the R10 comparison below.

Decide the set once in Step 1, state it in the scope section, and use the
same set in every table. In the Sankey the destination column shows `app`
with `bu` and `compliance` as small print; the source column shows hostname
with `role` and user.

If a `risk` label exists, compare it to the evidence and report
contradictions. VDIs labelled Low Risk that carry the most agent reach is a
finding, not decoration.

## Outputs

**Report**: the ten sections of `references/report-template.md`, in order,
each opening with its point. Format follows the up-front answer: Claude Doc
by default in Cowork, a markdown file in Claude Code, `.docx` on request via
the docx skill.

**Sankey**: three columns (endpoint grouped VDI then laptop, agent process,
internal application), link width is connections, colour by agent in the
fixed order Cursor, ChatGPT, Claude, then others. Filters for agent, source
kind and regulated only. Tooltip lists the hosts and ports behind a ribbon.
Sortable flow table below. Light and dark theme. d3 7.9.0 and d3-sankey
0.12.3 from cdnjs. The script fills `RAW`, `HOSTS` and `APPS`; leave the
rest of the template alone.

**Draft rulesets** (only when the user asks "write the rules"): emit ruleset
drafts as JSON or as `create-ruleset` / `create-deny-rule` call plans. Never
provision. Patterns:

- deny `type=endpoint` to `compliance=SWIFT` on all services
- process-qualified allow (`chrome.exe`, `msedge.exe` on 443) paired with a
  deny on all services, for browser-only apps
- deny agent process services (`Cursor.exe`, `Claude.exe`, `ChatGPT.exe` and
  the macOS paths) to `role=dc` on 88, 389, 445 and to `app=hrm` on all
- allow `role=admin` endpoints to `app=jump-infra` on 22 and 3389 from
  `ssh`, `mstsc.exe`, `Microsoft Remote Desktop`; deny everything else from
  `type=endpoint`
- IP list of sanctioned vendor ranges; allow agent processes to that list
  only

Order in every recommendation list: allow rules, then denies, then the
enforcement flip.

## Verification task (last, every run)

- [ ] Endpoint count in the summary equals distinct sources in the merged
      table
- [ ] Every (agent, app) total in the chart equals the sum of its appendix
      rows
- [ ] Every regulated flag in the inventory has at least one appendix row to
      a compliance-labelled host
- [ ] No query slice returned exactly 500 rows; if one did, it was split
      further or the report says the slice is truncated
- [ ] Every ruleset named in the posture table exists in `get-rulesets`
      output
- [ ] No recommendation references a label value that does not exist in the
      org

## Known PCE and MCP quirks

- Explorer caps at 500 flows per query; the server pins `max_results` to
  500 and `truncated` only reflects byte trimming. Check `total_pce_flows`.
  Slice.
- `include_sources` and `include_destinations` take `key=value` strings only;
  hrefs and IPs are rejected. Multiple entries are ANDed.
- `get-traffic-flows` results over roughly 25k tokens are written to a file by
  the harness; read them with the script, not by eye.
- Process names carry the Windows user in the path (`C:\Users\<user>\...`);
  macOS paths carry no user.
- `compare-draft-active` may report pending changes on non-ruleset objects
  while showing zero ruleset changes; report only what the filtered call
  returns.
- `discover-process-egress` marks unmanaged RFC1918 hosts as egress; treat
  those separately from vendor egress.
- Selective enforcement: "allowed" usually means "no deny matched", not "an
  allow rule exists".

## Common mistakes

| Mistake | Fix |
| --- | --- |
| One big `get-traffic-flows` query for the whole population | It silently caps at 500 rows. Slice by source label x destination label. |
| Passing hrefs or IPs to `include_sources` | Label shorthand only. Resolve IPs after the query against the workload map. |
| Two label values in one list to mean OR | That is AND. Run one query per value. |
| Scoring VS Code, Chrome or python as agents | Ambiguous hosts go in their own table, unscored, and the scope section says so. |
| Counting process `-` rows as agent traffic | They are a VEN visibility gap. Report the percentage under coverage. |
| Showing every label on every host | Defining labels only, same set in every table. |
| Recommending a deny before the allow exists | Allow rules first, denies second, enforcement last. |
| Writing the report before the verification task | The six checks run before anything is published. |

## Worked example (regression)

Org 5636114, 17 Sep 2026, window 14 to 17 Sep: 206 workloads, 16 endpoints,
15 with agents (8 VDI, 7 laptop), 72 agent flows to 18 internal hosts across
10 apps, 1,618,222 connections, all allowed, all workloads in selective
enforcement, 3 endpoints reaching SWIFT hosts, 5 reaching pay-web01, ruleset
16 port-only, egress 187k connections Claude to Anthropic and 200k ChatGPT to
Cloudflare-fronted IPs, unmanaged host 192.168.2.18 reached by three agents
and scanning endpoints. Overall rating High. A correct run against the same
PCE reproduces these numbers.
