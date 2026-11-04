---
name: illumio-rapid-risk-reduction
description: "Use when the user asks what they can block or fence now with the least chance of breaking something on an Illumio PCE: rapid risk reduction, quick wins, what can we block today, reduce blast radius fast, incident hardening, ransomware quick wins, what to fence first, a 24-hour or 7-day plan. Triages the estate with illumio-mcp tools (unknown admin-port sources, environment-crossing admin ports, internet-exposed listeners, lateral-movement bridges, non-enforcing apps policy already blocks, wide-reach identities), ranks each exposure by blast radius x ease, and produces a one-page plan, a risk report (risk, evidence, recommendation per exposure) and a React dashboard, all draft-only: override deny and deny rules, selective ringfences, an isolation runbook per crown-jewel app, each with its rollback. Never provisions. Not for one app, audit evidence or estate reports (illumio-app-profile, illumio-compliance-evidence, illumio-pce-assessment). Requires illumio-mcp-server 0.13.1 or later."
---

# Illumio Rapid Risk Reduction

One workflow for "what can we block or fence **now** with the least chance
of breaking something". It reads the estate once, scores every exposure
by blast radius x ease, and produces three views of one result:

- the **plan**, one page: block these today, fence these this week,
  isolate these on demand, watch these;
- the **risk report**: every exposure with the risk it carries, what was
  seen, the evidence, and the recommended action;
- the **dashboard**, a single-file React artifact in the Illumio style.

Every fix is a draft call plan marked `DO_NOT_CALL`; the skill creates
and provisions nothing. Everything comes from illumio-mcp tool calls.
`scripts/triage.py` merges the saved results, scores them and writes all
three views from one `plan.json`; it never talks to the PCE.

## Constraints

- **Read-only.** Never call `provision-policy`, `ringfence-batch`,
  `create-*`, `update-*` or `delete-*`, not even `create-ringfence` with
  `dry_run: true`. Fixes are call plans in a fenced block with
  `"DO_NOT_CALL"` as the first key. If the user asks to apply one, give
  every block the rule depends on in apply order (IP list, ruleset, rule),
  with `for`, `tool`, `DO_NOT_CALL` and `_notes` stripped so what is left
  is the tool's input, and say that this skill does not execute writes:
  they can ask for the call outside this skill or use the PCE UI.
- **Gentle on the PCE.** Eight data pulls plus the connection check:
  one traffic summary and one admin-port flow query over the window, one
  lateral-movement pull, one
  `find-unknown-endpoints` (three requests inside), one identity graph,
  one timeline, one workload pull, one ruleset pull. Reuse every result;
  do not re-query per app. Every pull that takes a window uses the same
  one (`start_date` to `end_date`, or `lookback_days` equal to its span,
  with `end_date` today). On a capped result see Step 2.
- **Illumio semantics in the output** (see `references/scoring.md` section
  6): override deny is for incidents and beats every allow rule; a
  selective ringfence needs its deny rule to bite; deny rules are
  enforced on the consumer side when the consumer is a label or workload,
  and at the destination when it is an IP list; a deny bites only in
  selective or full enforcement.
- **Ask one question up front** (Step 0) covering: window (default 30
  days), which `env` values are production (default: values containing
  `prod`), crown-jewel apps as `app (env)` (optional; default: the three
  production bridge apps with the largest reach), and output (default:
  the plan in chat plus the dashboard artifact; the report on request,
  as markdown, Claude Doc or .docx). Ask nothing else; the user answers
  with their own label values, and the plan's header states what was
  assumed.

## Files

| File | Use it for |
| --- | --- |
| `references/scoring.md` | exposure classes X1 to X6 and CJ, blast radius and ease tables, buckets, measurement, the Illumio semantics every plan states |
| `references/report-template.md` | the one-page plan skeleton and the appendix of call plans |
| `references/risk-report-template.md` | the risk report: register, risk and recommendation per exposure |
| `references/dashboard-spec.md` | the dashboard: colour mapping, data constants, tabs, checklist |
| `references/dashboard-example.jsx` | the dashboard template the script fills, and a worked example |
| `scripts/triage.py` | merges the saved tool results, scores, writes `plan.json`, `plan.md`, `call-plans.md`, `report.md`, `dashboard.jsx` |

## Workflow

Create a task list with one item per step plus a verification task. Save
every raw tool result to a scratch directory under the file names below;
the script reads them from there.

### Step 0: Ask, then connect

Ask the one question (window, production environments, crown jewels,
output format) in a single message and take the defaults for anything
left blank. Then:

```
illumio-mcp:check-pce-connection
illumio-mcp:get-server-changelog
```

Stop only if the connection check fails. The changelog's first version
is the server version: 0.13.0 or later has every tool this skill reads
(0.13.1 fixed IP-list writes, which this skill never does). If
`find-unknown-endpoints` is missing, X1 and X3 cannot be computed: say
so and continue with the other steps (see "Older servers").

### Step 1: Inventory

```
illumio-mcp:get-workloads
  detail_level: "compact"
  max_results: 10000
```

One call, **unfiltered**, saved as `scratch/workloads.json`. Split-format
JSON (`columns` + `data`) with `hostname`, `ip_addresses`,
`enforcement_mode`, `ven_status`, and one column per label key (`app`,
`env`, ...). The script derives the enforcement breakdown per app, the
`env` values, and the hostname-to-app map the traffic sections need. If
`truncated` is true or `total` reaches `max_results`, the per-app counts
are partial and the plan says so. The estate must label with `app` and
`env`; with other keys the script stops and says which classes need
them.

### Step 2: Traffic, one summary and the admin-port map

```
illumio-mcp:get-traffic-flows-summary
  start_date: "YYYY-MM-DD"   end_date: "YYYY-MM-DD"
  detail_level: "full"
```

Unfiltered, saved as `scratch/summary.json`: the estate map. Its
`app_to_app` rows (`from`, `to` as `app (env)`, `policy`, `connections`)
feed the ringfence allow lists and the visibility-mode test; `blocked`
rows carry hostnames and ports.

```
illumio-mcp:get-traffic-flows
  start_date: "YYYY-MM-DD"   end_date: "YYYY-MM-DD"
  group_by: ["source_app", "dest_app", "port", "proto", "policy"]
  include_services: [
    {"port": 21, "proto": "tcp"}, {"port": 22, "proto": "tcp"}, {"port": 23, "proto": "tcp"},
    {"port": 88, "proto": "tcp"}, {"port": 135, "proto": "tcp"}, {"port": 139, "proto": "tcp"},
    {"port": 389, "proto": "tcp"}, {"port": 445, "proto": "tcp"}, {"port": 636, "proto": "tcp"},
    {"port": 1433, "proto": "tcp"}, {"port": 1521, "proto": "tcp"}, {"port": 2049, "proto": "tcp"},
    {"port": 3306, "proto": "tcp"}, {"port": 3389, "proto": "tcp"}, {"port": 5432, "proto": "tcp"},
    {"port": 5900, "proto": "tcp"}, {"port": 5985, "proto": "tcp"}, {"port": 5986, "proto": "tcp"},
    {"port": 6379, "proto": "tcp"}, {"port": 9200, "proto": "tcp"}, {"port": 27017, "proto": "tcp"},
    {"port": 161, "proto": "udp"}
  ]
```

Saved as `scratch/admin_ports.json`: the admin-port map, split format
(`columns` + `data`) with `src_app`, `src_env`, `dst_app`, `dst_env`,
`port`, `proto`, `policy_decision`, `num_connections`. A row whose envs
differ is an environment crossing on that port (X2), so the deny for a
pair names exactly the ports seen. The list is the server's
`ADMIN_PORTS`; keep it exactly. `get-traffic-flows` reads at most 500
raw flows before grouping: `total_pce_flows` of 500 means the admin map
is a sample, the plan says so, and a shorter window is the fix.

The summary names a non-workload source by its IP-list name, so a public
source usually shows as `external:Any (0.0.0.0/0 and ::/0)` or
`unlabelled`; internet exposure is read from Step 4, not from here.

**Capped results.** `totals.truncated` on the summary (200k) or
`total_pce_flows` of 500 on the admin map means a cap was hit. Halve the
window once and re-pull every window-bound result (Step 2 to Step 6) so
all inputs share one window; tell the user.
If it is still capped, keep the results: the script marks the counts as
lower bounds in the plan header and the lines keep their buckets. The
same rule applies to `totals.flows_truncated` on Step 4 and Step 6.

### Step 3: Lateral movement

```
illumio-mcp:detect-lateral-movement-paths
  lookback_days: <window>
  max_hops: 4
```

Saved as `scratch/lateral.json`. `high_risk_bridge_nodes` (`app`, `env`,
`reachable_apps`) are the X4 ringfence candidates. The tool has no
truncation flag and its edges include blocked traffic; reach is observed
connectivity, not allowed connectivity.

### Step 4: Unknown sources

```
illumio-mcp:find-unknown-endpoints
  direction: "inbound"
  lookback_days: <window>
  top_n: 100
```

Saved as `scratch/unknown.json`. An endpoint with `admin_reach` in
`profile` is X1 (`profile_evidence.admin_reach.admin_ports`,
`allowed_connections`, `as_source.allowed_into_enforced`,
`peers_enforced`). An endpoint with `address_class` public and an
`as_source` block is X3. Read `totals.flows_truncated`.

### Step 5: Identities

```
illumio-mcp:build-identity-graph
  lookback_days: <window>
  include_service_accounts: false
```

Saved as `scratch/identities.json`. `findings` with `class` interactive
and `interest` review are X6; the identity's `ports` (as `port/proto`,
proto numeric) say whether admin ports are involved. If the result
carries `note` (no flow has a user), X6 is empty; say so.

### Step 6: Policy and baseline

```
illumio-mcp:get-rulesets
  pversion: "draft"
```

Unfiltered, saved as `scratch/rulesets.json`. Costs one extra request
per ruleset for its deny rules; run it once. The script uses it to say
which apps already have a scoped ruleset (ease +1), which are already
fenced (a scoped ruleset with a deny to all workloads), which allow rules
admit a low-ease environment crossing, and whether an `RRR-` ruleset
already exists (then the deny-rule call plans target it instead of
creating one).

```
illumio-mcp:get-traffic-timeline
  start_date: "YYYY-MM-DD"   end_date: "YYYY-MM-DD"
  bucket: "1d"
  policy_decisions: ["blocked", "potentially_blocked"]
  split_by: "policy_decision"
  spikes: true
```

Saved as `scratch/timeline.json`: the baseline for the 7-day review.
Quote `spikes.worst` only when `spikes` carries no `caveat`.

### Step 7: Score and write

```bash
python3 <skill dir>/scripts/triage.py \
  --scratch <scratch dir> --out <scratch dir>/rrr \
  --window-days 30 --date YYYY-MM-DD \
  --prod-env prod --prod-env production \
  --crown app=pay,env=prod
```

Use absolute paths: the skill directory for the script, the session's
scratch directory for the saved results. `--window-days` is the span of
the Step 2 window; `--date` is today and names the draft ruleset
`RRR-<date>`. `--prod-env` and `--crown` are repeatable and come from the
question in Step 0; omit `--prod-env` to use every `env` value containing
`prod`, omit `--crown` to default to the three production bridge apps with
the largest reach. A crown jewel with no workloads in the inventory still
gets its runbook, flagged "not found, check the label values". Writes
`plan.json` (every line with its evidence, scores, recommendation and
call plans), `plan.md` (the one page), `call-plans.md` (the appendix),
`report.md` (the risk report) and `dashboard.jsx` (the template in
`references/` with the plan's data in its DATA block). The script is
tolerant of missing files and says in `plan.json["inputs"]` what it
read; a missing input empties its exposure class, it does not invent one.

### Step 8: Present

- **Plan**: `plan.md` follows `references/report-template.md`; present it
  in chat with the header assumptions. Keep the script's numbers; do not
  re-derive a score from prose.
- **Dashboard**: save `dashboard.jsx` as
  `/mnt/user-data/outputs/illumio_rapid_risk_reduction_<date>.jsx` when
  that directory exists, else next to the plan, and present it; it
  renders as an artifact. `references/dashboard-spec.md` has the
  checklist. Never hand-build it from prose.
- **Report** (when asked for a report or a document): `report.md`
  follows `references/risk-report-template.md`; as a Claude Doc or a
  .docx through the docx skill, pipe-delimited rows become table rows.
  A .docx with status cells uses only the dashboard's colour mapping and
  every coloured table ends with a legend.

### Verification

Before handing over: every line in "Block today" is a deny or override
deny with ease 4 or more; every X1 line says "override deny" and every
ringfence line says "selective" with `deny_consumer any`, and its call
plan carries `"deny_consumer": "any"`; every call plan block carries
`DO_NOT_CALL`; every runbook ends in `provision-policy` with its undo; no
spike is quoted that carried a caveat; and every result's cap flag is
false, or the plan header names the counts that are lower bounds. The
dashboard's KPIs and the report's register show the same numbers as the
plan (they come from one `plan.json`); the dashboard renders every tab
with the data it has. Nothing was created: the transcript holds no
`create-*`, `update-*`, `delete-*`, `provision-policy` or
`ringfence-batch` call.

## Mistakes this skill avoids

- Proposing an override deny for a ringfence (its allows would never
  match) or a plain deny for an incident (an allow above it wins).
- Treating `potentially_blocked` as "unused": the traffic flows today on
  every workload not in full enforcement; it is "not admitted by any
  rule", which is why it scores as easy, not as free.
- Reading a public source off the traffic summary (it collapses into the
  IP-list name) instead of `find-unknown-endpoints`.
- Calling `create-ringfence` with `dry_run: true` to preview: still a
  write tool, still outside this skill. The allow list in the plan is
  computed from the estate summary; the preview is the user's first call
  plan, never this skill's.
- Fetching the `emergency-isolate-application` MCP prompt: the runbook
  already spells out its steps as calls; the prompt itself ends in
  `provision-policy`.
- Running the lateral-movement or identity tools per app. One estate
  call each.

## Older servers

`find-unknown-endpoints` shipped in 0.13.0. On an older server the
unknown-source classes (X1, X3) cannot be computed; run the rest, say the
two classes are missing in the plan header, and point the user at
illumio-unknown-endpoints v1.1.0 for a hand-built substitute. Before
0.10.0 `get-traffic-timeline` is missing too: skip the baseline and say
so.

## Server gaps

None blocking. A `get-admin-port-exposure` tool (admin-port traffic
grouped by source env, destination env, port and decision, read through
the 200k summary path instead of the 500-flow `get-traffic-flows` path)
would make the admin map complete on a large estate. File it on
illumio-mcp-server when `total_pce_flows` hits 500 on a one-week window.
