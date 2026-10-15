---
name: illumio-unknown-endpoints
description: "Use when the user asks about IP addresses in Illumio PCE traffic that are not workloads: unknown IPs, rogue hosts, rogue IP addresses, unmapped or uninventoried endpoints, what is talking to my workloads that is not a workload, hosts without a VEN, inventory gaps, scanners hitting workloads, unknown sources allowed into enforced workloads, unknown external destinations. Also for an unknown-endpoints dashboard, rogue IP dashboard, interactive view of unknown IPs, or inventory gap dashboard. Finds endpoints that are neither managed nor unmanaged workloads, profiles their traffic (scanner, fan-in server, admin-port reach, high volume), writes a report and a single-file React dashboard in the Illumio style, and suggests inventory and policy objects without creating them. Not for one application (illumio-app-profile), estate assessments (illumio-pce-assessment) or AI egress (illumio-agentic-ai-risk-assessment). Requires the illumio-mcp MCP server."
---

# Illumio Unknown Endpoints

One workflow that finds the addresses in PCE traffic that the PCE does not
know at all, neither as a managed workload (VEN) nor as an unmanaged
workload (inventory entry with interfaces), and says what each one does:
which workloads and apps it reaches or serves, on which ports, whether
policy allows it, and whether its traffic profile is remarkable (a scanner,
a shared infrastructure host, an admin-port reach, a volume outlier). The
output is a short report with findings U1 to U10 and suggested inventory
and policy objects, plus a single-file React dashboard in the same style
as the other Illumio dashboard skills, built from the report's numbers.

Everything comes from illumio-mcp tool calls; the analysis is done on the
tool results. Where a tool is missing or wrong, the workaround is given and
the server issue that removes it is named.

The skill is **read-only**. It never calls `create-*`, `update-*`,
`delete-*`, `provision-policy`, `ringfence-*` or
`emergency-isolate-application`. It may write `create-workload` or
`create-iplist` or `create-deny-rule` call plans as text for the user to
review, and stops there. If the user asks it to create one, it gives the
call plan, says this skill does not execute writes, and that the user can
run the tool directly.

## Files

| File | Use it for |
| --- | --- |
| `references/findings-rubric.md` | what "unknown" means, address classes, profile shapes, findings U1 to U10, suggestion rules |
| `references/report-template.md` | the report skeleton |
| `references/dashboard-spec.md` | the React dashboard: palette, data constants, tabs, components, checklist |
| `references/dashboard-example.jsx` | a rendered, working example of the dashboard with synthetic data; copy its components, replace the data block |

## Definitions

An endpoint in a flow is **unknown** when both hold:

1. Explorer attached no workload to it. In tool output that is a null or
   `-` hostname on that side (`src_hostname`, `dst_hostname`, or a
   `src_label`/`dst_label` that is a bare IP, an FQDN or an IP-list name).
   Managed and unmanaged workloads both carry a hostname, so an inventoried
   unmanaged workload is **not** unknown.
2. Its IP is not an interface address of any workload in the inventory
   (Step 1). This catches workloads created after the flows were recorded
   and unmanaged workloads with an empty hostname.

Membership in an IP list does not make an endpoint known. It is reported,
because "inside IP list X" changes the finding, but a /8 in a list is not an
inventory entry. The default list covering `0.0.0.0/0` never counts as
coverage.

**Noise** endpoints (link-local `169.254/16` and `fe80::/10`, multicast
`224/4` and `ff00::/8`, broadcast `255.255.255.255` and `.255` of a managed
/24, loopback) are counted in the appendix only; their connections are
dropped from every total.

**Unlabelled workloads** are workloads in the inventory without an `app`
label. One tool below reports them as "unmanaged"; they are not unknown and
are counted in one line, not profiled.

## Inputs

- **Window**: default the last 7 days. Pass it as `lookback_days: N` where a
  tool takes that, and as `start_date` today minus N and `end_date` today in
  `YYYY-MM-DD` elsewhere; both describe the same days, and the scope line
  reports the two dates.
- **Direction**: `inbound` (unknown sources reaching workloads), `outbound`
  (workloads reaching unknown destinations) or `both` (default). Infer it
  from the phrasing: "X talking to my workloads" is inbound, "my workloads
  talking to X" is outbound; ask only when neither is implied.
- **Scope**: optional labels such as `env=prod` to narrow the workload side.
  Only the summary and the egress tool accept filters; the unknown-source
  tool is estate-wide, so drop its rows whose `dst_app`/`dst_env` (or
  `src_`) do not match the scope before profiling.
- **Top**: how many endpoints to profile in the report, default 25 per
  direction. `min_connections` default 1.

Ask for the window only if the user did not say and the default would
change the answer; one question at most, then proceed with the defaults
stated in the scope line.

## Gentle on the PCE

The report costs **5 PCE queries** (1 workloads, 1 IP lists, 1 traffic
summary, 1 unknown-source scan, 1 process egress), 4 when the direction is
`inbound` (no egress call). `check-pce-connection` does not count. The
per-endpoint deep dive in Step 7 costs 2 queries per endpoint and is run
only after the user approves the stated count. Rules:

- Fetch the inventory once and the IP lists once; every classification is
  done on those two results.
- Never call `get-traffic-flows` without a filter for this question: it is
  capped at 500 raw PCE flows, which on an estate query is a random slice.
- Read completeness from the result's own fields: `truncated` on
  workloads, `totals.truncated`, `coverage_note` and `truncated_sections`
  on the summary, `totals.flows_truncated` on egress and the timeline.
  `find-unmanaged-traffic` has no truncation flag; each of its two sections
  is capped separately at `top_n` rows (address x app x port tuples, not
  endpoints), and a section with exactly `top_n` rows is treated as capped.
- A call refused by the client or by the server before a query is sent is
  not counted.
- Write tools never called: `create-*`, `update-*`, `delete-*`,
  `provision-policy`, `ringfence-*`, `emergency-isolate-application`.

Keep a running tally of calls; the scope line states it.

## Workflow

Use a task list with one item per step plus the verification task. The
report (Step 8) is written first and the dashboard (Step 9) is built from
it, so the two never disagree.

### Step 0: Connection

```
illumio-mcp:check-pce-connection
```

Stop and say so if it fails.

### Step 1: Inventory

```
illumio-mcp:get-workloads
  detail_level: "compact"
  max_results: 10000
```

`compact` is split format (`columns` plus `data`) with `href`, `name`,
`hostname`, `ip_addresses` (comma-joined interface addresses), `managed`
(true for a VEN, false for an unmanaged workload), `online`,
`enforcement_mode`, `ven_status`, `last_heartbeat_on` and one column per
label key. Build from it:

- the **known IP set**: every address in `ip_addresses`, with the
  workload's `managed` flag, `enforcement_mode` and `app` label;
- the **managed prefixes**: the /24 of every IPv4 and the /64 of every IPv6
  address of a managed workload, with the count of managed workloads in
  each.

If `truncated` is true the inventory is incomplete: say so in the scope
line as "truncated at `returned` of `total` workloads", keep every
finding's severity, and prefix every finding on an unknown endpoint with
"possibly known:" (the host may be in the unseen part). Do not re-run with
`full`; it is larger.

### Step 2: IP lists

```
illumio-mcp:get-iplists
  max_results: 1000
```

Each list has `href`, `name`, `ip_ranges` and `fqdns`. The ranges come back
as dataclass text, `IPRange(from_ip='10.0.0.0/8', to_ip=None,
exclusion=False, ...)` (illumio-mcp-server#49); read `from_ip`, `to_ip` and
`exclusion` from it. A range is a CIDR when `to_ip` is None or empty, a
single address when `from_ip` has no prefix and no `to_ip`, else a span.
Mark every default list, one with a range equal to `0.0.0.0/0` or `::/0`;
they are excluded from every "covered by IP list" statement. Lists are
read from draft policy.

### Step 3: Estate traffic summary

```
illumio-mcp:get-traffic-flows-summary
  start_date / end_date: the window
  detail_level: "full"
  include_destinations: ["env=prod"]     (only when a scope was given; inbound view)
```

Label strings such as `env=prod` are accepted here; only IP, FQDN and
HREF strings are rejected (illumio-mcp-server#47). With a scope, the summary
is one call per direction: `include_destinations` for inbound,
`include_sources` for outbound, so direction `both` runs it twice and adds
one query to the tally; one direction is one call. Read `totals.pce_flows`,
`totals.truncated`, `coverage_note`, `section_totals` and
`truncated_sections`. Use three sections:

- `external_destinations` (`dst_label`, `port`, `proto`, `policy_decision`,
  `connections`): destinations with no workload. The label is the FQDN if
  Explorer resolved one, else the IP-list name, else the IP. A row named
  after an IP list is **many addresses collapsed into one** (illumio-mcp-
  server#48); report it on a "collapsed ranges" line under the
  destinations table, excluded from every summary count, and say so.
- `blocked` (`src_label`, `dst_label`, `port`, `proto`, `policy_decision`,
  `connections`; includes `potentially_blocked`): the only place in the
  summary where an unknown **source** appears with its policy decision.
- `app_to_app` (`from`, `to`, `policy`, `connections`): rows with
  `unlabelled` or `external:<name>` on one side give the distinct apps on
  the other side.

### Step 4: Unknown sources and destinations

```
illumio-mcp:find-unmanaged-traffic
  lookback_days: 7
  direction: "both"           (or inbound / outbound)
  min_connections: 1
  top_n: 500
```

It returns `unmanaged_sources` (`src_ip`, `dst_app`, `dst_env`, `port`,
`proto` as a number, `connections`) and `unmanaged_destinations` (`dst_ip`,
`src_app`, `src_env`, ...). Its test is "no `app` label", not "no
workload", so **filter it against Step 1**:

- a `src_ip`/`dst_ip` that is in the known IP set is an unlabelled
  workload: count it (managed and unmanaged separately) in the "not
  unknown" line and drop it;
- an address in a noise class goes to the appendix count;
- everything else is an unknown endpoint. Aggregate per address:
  connections, distinct peer apps (`dst_app`/`dst_env` or `src_`), distinct
  port/proto pairs (proto 6 is tcp, 17 udp, 1 icmp), admin ports touched.

The tool carries no policy decision, FQDN, IP-list name or timestamps. Join
the policy mix from Step 3: `blocked` rows whose `src_label` or `dst_label`
equals the address give its blocked and potentially blocked counts per
port; the remainder of its connections are allowed only if the summary
covered the whole window (`totals.truncated` false and `blocked` not in
`truncated_sections`), else say "policy mix partial". Peers are known at
app/env granularity here; workloads only after Step 7. If a section has
exactly `top_n` rows it is capped: say so, treat its counts as lower
bounds, and raise `min_connections` on a re-run only if the user asks.

### Step 5: Unknown destinations with process context (skip when inbound)

```
illumio-mcp:discover-process-egress
  start_date / end_date: the window
  include_sources: ["env=prod"]        (only when a scope was given)
```

Findings carry `process`, `destination` (FQDN preferred, else IP), `port`,
`proto`, `policy_decision`, `connections`, `likely_provider` and
`provider_confidence`. "External" here already means no destination
workload, so every row is an unknown destination; still check it against
the known IP set. Merge by address or FQDN into the Step 4 destinations and
add the process names and provider. The findings list stops at 50 rows
(the schema has no `limit`); the `by_process` rollup covers everything
found, so a destination missing from the findings may still appear there.
Read `totals.flows_truncated` and `findings_truncated`.

### Step 6: Classify and find

For each unknown endpoint, using only data already held, record:

- **address class**: private (RFC 1918, `fc00::/7`), public, or a noise
  class;
- **FQDN**, when any row carried one;
- **IP lists** containing it (Step 2 ranges, exclusions honoured, default
  list dropped);
- **neighbourhood**: the managed prefix it shares, with the managed
  workload count, else none;
- **provider**, from Step 5 when present;
- **peers**: distinct apps and workloads, with how many peer workloads are
  in `full` enforcement (Step 1 by `app`/`env` match);
- **ports**: distinct port/proto pairs, flagging admin ports;
- **policy mix**: allowed / potentially blocked / blocked connections;
- **profile shapes** per `references/findings-rubric.md`: scanner, fan-in
  server, admin reach, high volume, single peer.

Then compute findings U1 to U10 from the rubric and rank them: high first,
then by connections.

### Step 7: Deep dive on one endpoint (opt-in)

For an endpoint the user picks, the natural calls are a grouped flow query
and a timeline filtered by its address. A deep dive asked for on its own,
without a report this session, still runs Steps 0 to 2 first so the address
is confirmed unknown and its IP lists are known (3 queries plus 2):

```
illumio-mcp:get-traffic-flows
  start_date / end_date: the window
  include_sources: [{"ip_address": "10.20.30.40"}]
  group_by: ["destination", "dest_app", "port", "proto", "policy", "process"]

illumio-mcp:get-traffic-timeline
  start_date / end_date: the window
  include_sources: [{"ip_address": "10.20.30.40"}]
  bucket: "1h"          (when the user asks hourly or the window is 2 days or less; else "1d")
  split_by: "policy_decision"
  spikes: true
```

The string form `include_sources: ["10.20.30.40"]` is rejected by the
server before the query is sent, with `Invalid value for include`
(illumio-mcp-server#47); the object form passes the server but the tool
schema declares strings, so a client may refuse it. Try the object form
once. If either side refuses, stop the deep dive, say it waits on #47, and
offer the two-call plan for later. For a destination, use
`include_destinations` and group by `source`, `source_app`.

Before running, state the cost: "2 queries per endpoint, 3 endpoints = 6
queries; go ahead?" Run nothing until the user answers. Always quote
`effective_bucket` and read `resolution_note` before quoting a spike; a
spike in the first bucket of the window is the window edge, and a bucket
finer than `effective_bucket` is unreliable. Report `spikes.worst` as the
rubric says.

### Step 8: Report

Write the report along `references/report-template.md`: scope line, one
summary table, findings first (high, medium, low), then the unknown sources
table, the unknown destinations table, the not-unknown line, the noise
count, and the suggestions. Suggestions follow the rubric: an unmanaged
workload entry per U1 host, an IP list per fan-in or provider group, a VEN
for a U1 host that runs an OS the user manages, a deny rule for a scanner.
They are labelled as suggestions, written as `create-workload` /
`create-iplist` call plans in a code block when the user asks for one, and
never executed.

### Step 9: Dashboard

Build the React artifact described in `references/dashboard-spec.md` from
the report, starting from `references/dashboard-example.jsx` (keep its
components, replace everything between `// ==== DATA ====` and
`// ==== END DATA ====`): same palette and components as illumio-security-dashboard and
illumio-daily-assessment (DM Sans, pill tabs, inline styles, `app (env)`
tuples), data embedded as constants, six tabs (Overview, Findings, Unknown
sources, Unknown destinations, Subnets, Suggestions) and a Deep dive tab
only when Step 7 ran. Every number on it is copied from the report; the
dashboard never computes a finding the report does not have. Save it as
`illumio_unknown_endpoints_<YYYY-MM-DD>.jsx` and present it with the
report. Skip the dashboard only when the user asked for text only.

## Verification (before publishing)

- [ ] Every address in the unknown tables is absent from the Step 1 known IP set, or the scope line says the inventory was truncated and the findings carry "possibly known:"
- [ ] Step 4 rows outside the scope labels were dropped before profiling
- [ ] No address in a noise class appears in the unknown tables
- [ ] Every finding names an endpoint that appears in a table, with the numbers the finding relies on
- [ ] The query count in the scope line equals the calls made; the connection check is not counted
- [ ] An IP-list-named row from `external_destinations` is on the collapsed-ranges line, never in a table row or a summary count
- [ ] The default IP list is not cited as coverage anywhere
- [ ] The deep dive section exists only if the user approved the stated count
- [ ] No write tool was called
- [ ] The dashboard's KPIs, table rows and banner colour match the report; it was built from the report, not from the raw tool results

## Known gaps in illumio-mcp-server

Each has a filed issue; the workaround above applies until it ships.

| Gap | Workaround | Issue |
| --- | --- | --- |
| IP, FQDN and IP-list HREF strings in `include_*` are rejected | object form once, else no per-endpoint deep dive | illumio-mcp-server#47 |
| No tool that defines unknown as "no workload, not in inventory"; `find-unmanaged-traffic` means unlabelled and has no policy, FQDN, IP-list or truncation fields | filter it against the inventory; join policy from the summary | illumio-mcp-server#48 |
| Summary `external_destinations` hides the IP behind the IP-list name; no `external_sources` section | report list-named rows as ranges; sources from `blocked` and Step 4 | illumio-mcp-server#48 |
| `get-iplists` ranges are dataclass text, draft only, no contains-IP lookup | parse `from_ip`/`to_ip`/`exclusion` from the text | illumio-mcp-server#49 |
| No `transmission` (broadcast/multicast) field on flow rows | classify noise by address | accepted, not filed |

## Common mistakes

| Mistake | Fix |
| --- | --- |
| Treating every `find-unmanaged-traffic` row as unknown | Its test is "no app label". Drop addresses that are in the inventory and count them as unlabelled workloads. |
| Calling an unmanaged workload unknown | It has a hostname and an inventory entry. Unknown means neither. |
| Citing the `0.0.0.0/0` list as coverage | The default list matches everything; only a named, narrower list counts. |
| Reading an `external_destinations` row named "Any (0.0.0.0/0 and ::/0)" as one host | It is every unknown destination collapsed; profile destinations from Step 4 and Step 5. |
| Passing `include_sources: ["10.20.30.40"]` | Rejected (#47). Object form once, else wait. |
| Running `get-traffic-flows` unfiltered to list unknown sources | 500 raw flows of an estate is a random slice. Use the summary and Step 4. |
| Mixing windows | `lookback_days: 7` and `start_date` today minus 7 with `end_date` today describe the same window; state it once. |
| Listing link-local, multicast or broadcast addresses as rogue hosts | Noise class; appendix count only. |
| Calling a first-bucket spike a spike | Read `resolution_note`; widen the window by one bucket first. |
| Creating the suggested workload or IP list | Suggestions only; never call a write tool. When asked, hand over the call plan and say the user can run the tool directly. |
| Counting a call the client or server refused | Only queries that reached the PCE count. |
