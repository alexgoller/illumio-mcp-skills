---
name: illumio-unknown-endpoints
description: "Use when the user asks about IP addresses in Illumio PCE traffic that are not workloads: unknown IPs, rogue hosts, rogue IP addresses, unmapped or uninventoried endpoints, what is talking to my workloads that is not a workload, hosts without a VEN, inventory gaps, scanners hitting workloads, unknown sources allowed into enforced workloads, unknown external destinations. Also for an unknown-endpoints dashboard, rogue IP dashboard, interactive view of unknown IPs, or inventory gap dashboard. Finds endpoints that are neither managed nor unmanaged workloads, profiles their traffic (scanner, fan-in server, admin-port reach, high volume), writes a report and a single-file React dashboard in the Illumio style, and suggests inventory and policy objects without creating them. Not for one application (illumio-app-profile), estate assessments (illumio-pce-assessment) or AI egress (illumio-agentic-ai-risk-assessment). Requires illumio-mcp-server 0.13.0 or later (the find-unknown-endpoints tool)."
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
tool results. One tool, `find-unknown-endpoints`, does the inventory join,
the IP-list lookup, the address classes and the profile shapes
server-side; the skill reads its output, computes the findings, writes the
report and builds the dashboard.

The skill is **read-only**. It never calls `create-*`, `update-*`,
`delete-*`, `provision-policy`, `ringfence-*` or
`emergency-isolate-application`. It may write `create-workload` or
`create-iplist` or `create-deny-rule` call plans as text for the user to
review, and stops there. If the user asks it to create one, it gives the
call plan, says this skill does not execute writes, and that the user can
run the tool directly.

## Older servers

`find-unknown-endpoints` shipped in illumio-mcp-server 0.13.0. On an
older server the tool is not listed; say so and stop, or use the
[v1.1.0 release](https://github.com/alexgoller/illumio-mcp-skills/releases/tag/v1.1.0)
of this skill, which builds the same report from `get-workloads`,
`get-iplists`, `get-traffic-flows-summary` and `find-unmanaged-traffic`
filtered by hand, at five queries instead of one.

## Files

| File | Use it for |
| --- | --- |
| `references/findings-rubric.md` | what "unknown" means, address classes, profile shapes, findings U1 to U10, suggestion rules |
| `references/report-template.md` | the report skeleton |
| `references/dashboard-spec.md` | the React dashboard: palette, data constants, tabs, components, checklist |
| `references/dashboard-example.jsx` | a rendered, working example of the dashboard with synthetic data; copy its components, replace the data block |

## Definitions

An endpoint in a flow is **unknown** when both hold:

1. Explorer attached no workload to it. Managed and unmanaged workloads
   both carry a workload object, so an inventoried unmanaged workload is
   **not** unknown.
2. Its IP is not an interface address of any workload in the inventory.
   This catches workloads created after the flows were recorded and
   unmanaged workloads with an empty hostname.

`find-unknown-endpoints` applies both tests. Membership in an IP list does
not make an endpoint known. It is reported in `ip_lists`, because "inside
IP list X" changes the finding, but a /8 in a list is not an inventory
entry. The default list covering `0.0.0.0/0` never counts as coverage; the
tool drops it from `ip_lists` and names it in `totals.default_ip_lists`.

**Noise** endpoints (`address_class` of `link_local`, `multicast`,
`broadcast` or `loopback`) are counted in `totals.noise_endpoints` and
`totals.noise_connections`, listed only with `include_noise: true`, and go
to the appendix; their connections are in no other total.

**Unlabelled workloads** are workloads in the inventory without an `app`
label. `find-unmanaged-traffic` reports them as "unmanaged"; they are not
unknown. The tool counts them in `totals.unlabelled_workloads_seen` and
shows them as the peer app `unlabelled`; they are one line in the
appendix, not profiled.

## Inputs

- **Window**: default the last 7 days. Pass it as `lookback_days: N`, or
  as `start_date` and `end_date` in `YYYY-MM-DD`; the tool echoes the
  window it used in `window.start` and `window.end`, and the scope line
  reports those two dates.
- **Direction**: `inbound` (unknown sources reaching workloads, the
  `as_source` block), `outbound` (workloads reaching unknown destinations,
  `as_destination`) or `both` (default). Infer it from the phrasing: "X
  talking to my workloads" is inbound, "my workloads talking to X" is
  outbound; ask only when neither is implied.
- **Scope**: optional labels such as `env=prod` to narrow the workload
  side. The tool is estate-wide; apply the scope on its output by keeping
  the endpoints whose `peer_apps` (`app (env)` strings) include a peer in
  scope. An endpoint's connection count then still spans all its peers;
  say "estate-wide count" in the table, and use the Step 3 `ip` call,
  whose `peers` table carries `peer_app` per row, when the user needs the
  in-scope share.
- **Top**: `top_n`, how many endpoints to profile in the report, default
  25 (the tool's default is 50); `totals.unknown_endpoints` says how many
  exist. `min_connections` default 1.
- **Noise**: `include_noise: true` only when the user asks to see the
  link-local, multicast, broadcast or loopback addresses.

Ask for the window only if the user did not say and the default would
change the answer; one question at most, then proceed with the defaults
stated in the scope line.

## Gentle on the PCE

The report costs **1 PCE query**: one `find-unknown-endpoints` call, which
runs one Explorer pull over the window for all three policy decisions and
reads the workload inventory and the draft IP lists inside the same call.
`direction: both` is still one pull on the estate scan; the tool reports
its own count in `totals.pce_queries` (2 when it ran two pulls, which the
per-address `ip` mode does for `both`, one per side). Quote that field,
never a tally of your own. `check-pce-connection` does not count. The
per-endpoint deep dive in Step 3 costs 1 to 2 queries per endpoint and is
run only after the user approves the stated count. Rules:

- One estate call per report. Do not re-run with a wider `top_n` to see
  more endpoints; `totals.unknown_endpoints` already says how many there
  are, and a second call is a second Explorer pull.
- Never call `get-traffic-flows` without a filter for this question: it is
  capped at 500 raw PCE flows, which on an estate query is a random slice.
- Read completeness from the result's own fields: `totals.flows_truncated`
  (the Explorer cap, default 200,000 flows), `totals.inventory_truncated`
  with `totals.inventory_workloads`, `totals.ip_lists_truncated`, and the
  `coverage_note` sentence that sums them up. `totals.returned` against
  `totals.unknown_endpoints` says how many endpoints the table shows.
- A call refused by the client or by the server before a query is sent is
  not counted.
- Write tools never called: `create-*`, `update-*`, `delete-*`,
  `provision-policy`, `ringfence-*`, `emergency-isolate-application`.

The scope line states `totals.pce_queries` plus the deep-dive calls.

## Workflow

Use a task list with one item per step plus the verification task. The
report (Step 4) is written first and the dashboard (Step 5) is built from
it, so the two never disagree.

### Step 0: Connection

```
illumio-mcp:check-pce-connection
```

Stop and say so if it fails. If `find-unknown-endpoints` is not among the
server's tools, the server is older than 0.13.0: see "Older servers".

### Step 1: Scan

```
illumio-mcp:find-unknown-endpoints
  lookback_days: 7            (or start_date / end_date)
  direction: "both"           (or inbound / outbound)
  min_connections: 1
  top_n: 25
  include_noise: false
```

The envelope carries `window`, `direction`, `totals`, `profiles` (the
shape thresholds in words), `endpoints`, `coverage_note` and `note`, plus
`noise` when `include_noise` was set. Read `totals` first:

- `unknown_endpoints`, `returned`, `unknown_connections`: the headline
  numbers and how many endpoints the table holds;
- `noise_endpoints`, `noise_connections`: the appendix line;
- `unlabelled_workloads_seen`, `known_by_inventory_only`,
  `rows_between_unknowns`: one appendix line each (workloads without an
  `app` label seen as peers; addresses Explorer did not name but the
  inventory did, treated as known; flow rows with no workload on either
  side, not profiled);
- `pce_flows`, `pce_queries`, `flows_truncated`, `inventory_workloads`,
  `inventory_truncated`, `ip_lists`, `ip_lists_truncated`,
  `default_ip_lists`: the scope line.

Each entry in `endpoints` (sorted by connections, highest first) has:

- `ip`, `fqdn` (the name Explorer resolved most often, else null),
  `address_class` (`private` includes RFC 1918, carrier NAT `100.64/10`
  and `fc00::/7`; else `public`; noise classes only under `noise`),
  `noise`;
- `ip_lists`: named lists containing it, exclusions honoured, the default
  list dropped; `likely_provider` and `provider_confidence` for public
  addresses;
- `neighbourhood`: `{prefix, managed_workloads}` when the /24 or /64 holds
  at least one managed workload, else null;
- `connections`, `peer_workloads`, `peers_enforced` (peer workloads in
  `full` enforcement, both directions together);
- `as_source` and/or `as_destination`, each with `connections`, `flows`,
  `peer_workloads`, `peer_apps` (`app (env)` strings, `unlabelled` for a
  workload without an app label), `distinct_ports`, `ports` (top 10 by
  connections: `port`, `proto`, `connections`, `flows`, `peers`, `admin`,
  `policy`), `policy` (`allowed`, `potentially_blocked`, `blocked`
  connections), `allowed_into_enforced`, `first_seen`, `last_seen`;
- `profile`: the shapes that apply (`scanner`, `fan_in_server`,
  `admin_reach`, `high_volume`, `single_peer`) and `profile_evidence`,
  the numbers each test used. Quote those numbers in findings; do not
  re-derive a shape from the ports list.

If `inventory_truncated` is true the inventory was incomplete: say so in
the scope line as "inventory truncated at `inventory_workloads`
workloads", keep every finding's severity, and prefix every finding with
"possibly known:" (the host may be a workload in the unseen part). If
`flows_truncated` is true, every count is a lower bound; say so, and
raise `min_connections` or narrow the window on a re-run only if the user
asks.

### Step 2: Classify and find

For each endpoint in `endpoints`, carry its `address_class`, `fqdn`,
`ip_lists`, `neighbourhood`, `likely_provider`, peers, ports, policy mix
and `profile` straight into the table. Then compute findings U1 to U10
from `references/findings-rubric.md`: the shapes are the tool's, the
findings are the skill's, each quoting `profile_evidence` and the
`as_source` / `as_destination` numbers it relies on. Rank them high
first, then by connections.

### Step 3: Deep dive on one endpoint (opt-in)

For an endpoint the user picks, one call profiles the address with its
complete peer x port table and a timeline:

```
illumio-mcp:find-unknown-endpoints
  ip: "10.20.30.40"
  start_date / end_date: the window
  direction: "inbound"        (or outbound; both runs one pull per side)
```

Explorer is filtered to the address server-side, so the profile is built
from that address's flows, not from the estate slice under the cap. The
response is the Step 1 envelope for that one address: `ip`, one entry in
`endpoints` whose `as_source` / `as_destination` block now also carries
`peers` (one row per peer x port x proto: `peer`, `peer_app`,
`peer_enforcement_mode`, `port`, `proto`, `admin`, `connections`,
`flows`, `policy`, `first_seen`, `last_seen`), and `timeline` with
`bucket` (1h when the window is two days or less, else 1d),
`effective_bucket`, `series` (`bucket_start`, `flows`, `connections`,
`by_policy_decision`), `spikes` (`median_nonzero`, `threshold`,
`buckets`, `worst`, `caveat` when present) and `resolution_note` when
rows span buckets. An address that is in the inventory comes back as
`known: true` with its `workload` and no query is run; a window with no
flows for it says so in `message`. A deep dive asked for on its own,
without a report this session, is the same one call.

When the user wants the grouped peer x port x process table, which the
`ip` call does not carry, the process column comes from a plain IP
string filter:

```
illumio-mcp:get-traffic-flows
  start_date / end_date: the window
  include_sources: ["10.20.30.40"]
  group_by: ["destination", "dest_app", "port", "proto", "policy", "process"]
```

For a destination, use `include_destinations` and group by `source`,
`source_app`. `discover-process-egress include_destinations:
["<ip>"]` is the alternative for an outbound destination when the
`likely_provider` matters. FQDN and transmission strings are accepted on
`include_destinations` only; on the source side the server answers
`unsupported_source_filter` without querying the PCE.

Before running, state the cost: "1 query per endpoint for the profile and
timeline, 2 with the process table; 3 endpoints = 3 queries; go ahead?"
Run nothing until the user answers. Always quote `effective_bucket` and
read `resolution_note` before quoting a spike; a spike in the first bucket
of the window is the window edge, and a bucket finer than
`effective_bucket` is unreliable. Report `spikes.worst` as the rubric
says, and only when `spikes` carries no `caveat`.

### Step 4: Report

Write the report along `references/report-template.md`: scope line, one
summary table, findings first (high, medium, low), then the unknown sources
table, the unknown destinations table, the suggestions, and the appendix
with the noise count and the three tool counters. Suggestions follow the
rubric: an unmanaged workload entry per U1 host, an IP list per fan-in or
provider group, a VEN for a U1 host that runs an OS the user manages, a
deny rule for a scanner. They are labelled as suggestions, written as
`create-workload` / `create-iplist` call plans in a code block when the
user asks for one, and never executed.

### Step 5: Dashboard

Build the React artifact described in `references/dashboard-spec.md` from
the report, starting from `references/dashboard-example.jsx` (keep its
components, replace everything between `// ==== DATA ====` and
`// ==== END DATA ====`): same palette and components as illumio-security-dashboard and
illumio-daily-assessment (DM Sans, pill tabs, inline styles, `app (env)`
tuples), data embedded as constants, six tabs (Overview, Findings, Unknown
sources, Unknown destinations, Subnets, Suggestions) and a Deep dive tab
only when Step 3 ran. Every number on it is copied from the report; the
dashboard never computes a finding the report does not have. Colour is
used only for meaning, and every section that uses colour, bold or a tint
ends with a legend naming each one; the report's tables carry the same
legend line. Save it as
`illumio_unknown_endpoints_<YYYY-MM-DD>.jsx` and present it with the
report. Skip the dashboard only when the user asked for text only.

## Verification (before publishing)

- [ ] Every address in the unknown tables comes from the tool's `endpoints` list, or from `noise` only when the user asked for `include_noise`; no address with a noise `address_class` is in the tables otherwise
- [ ] The scope line says "inventory truncated" and every finding carries "possibly known:" when `totals.inventory_truncated` is true; counts are called lower bounds when `totals.flows_truncated` is true
- [ ] Endpoints outside the scope labels were dropped by `peer_apps` before profiling, and the table says the counts are estate-wide
- [ ] Every finding names an endpoint that appears in a table and quotes the `profile_evidence` or `as_source` / `as_destination` numbers its test used
- [ ] The query count in the scope line equals `totals.pce_queries` plus the approved deep-dive calls; the connection check is not counted
- [ ] No list named in `totals.default_ip_lists` is cited as coverage anywhere
- [ ] The deep dive section exists only if the user approved the stated count
- [ ] No write tool was called
- [ ] The dashboard's KPIs, table rows and banner colour match the report; it was built from the report, not from the raw tool results

## Known gaps in illumio-mcp-server

The fixes for #47, #48 and #49 shipped in 0.13.0 and are no longer
listed. What remains is small; each row says whether an issue is filed.

| Gap | Workaround | Issue |
| --- | --- | --- |
| `find-unknown-endpoints` takes no label scope | filter its output by `peer_apps`; per-peer split from the `ip` call | not filed |
| `find-unknown-endpoints` is not verified against a live PCE; the fixture estate in its tests is the contract | read `coverage_note` and the truncation flags on every run | noted in the server changelog |
| No `transmission` (broadcast/multicast) field on flow rows | the tool classifies noise by address | accepted, not filed |

## Common mistakes

| Mistake | Fix |
| --- | --- |
| Calling `find-unmanaged-traffic` for unknown endpoints | It means unlabelled: its test is "no app label", so it lists unlabelled VENs and drops labelled unmanaged workloads. Use `find-unknown-endpoints`. |
| Calling an unmanaged workload unknown | It has an inventory entry. Unknown means no workload attached and not an interface address; the tool applies both tests. |
| Citing the `0.0.0.0/0` list as coverage | The default list matches everything; the tool drops it from `ip_lists` and names it in `totals.default_ip_lists`. |
| Re-deriving a scanner or fan-in from the ports list | The shapes are in `profile`; quote `profile_evidence` instead. |
| Running `get-traffic-flows` unfiltered to list unknown sources | 500 raw flows of an estate is a random slice. Use the Step 1 scan. |
| Counting the deep dive as one query for `direction: both` | The `ip` call runs one pull per side; read `totals.pce_queries` from its response. |
| Mixing windows | `lookback_days: 7` and `start_date` today minus 7 with `end_date` today describe the same window; quote `window.start` and `window.end` once. |
| Listing link-local, multicast or broadcast addresses as rogue hosts | Noise class; appendix count only, listed only with `include_noise`. |
| Calling a first-bucket spike a spike | Read `resolution_note` and `spikes.caveat`; widen the window by one bucket first. |
| Creating the suggested workload or IP list | Suggestions only; never call a write tool. When asked, hand over the call plan and say the user can run the tool directly. |
| Counting a call the client or server refused | Only queries that reached the PCE count; an `unsupported_source_filter` or `known: true` answer ran no query. |
