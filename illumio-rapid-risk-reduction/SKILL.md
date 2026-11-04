---
name: illumio-rapid-risk-reduction
description: "Use when the user asks what they can block or fence now with the least chance of breaking something on an Illumio PCE: rapid risk reduction, quick wins, what can we block today, reduce blast radius fast, emergency hardening, incident hardening, ransomware quick wins, what to fence first, a 24-hour or 7-day plan, what to isolate first. Triages the estate with illumio-mcp tools (unknown sources on admin ports, admin ports crossing environments, internet-exposed listeners, lateral-movement bridge apps, visibility-mode apps that policy already wants to block, identities with wide reach), ranks each exposure by blast radius x ease, and produces a one-page plan with draft-only policy: override deny rules, plain deny rules, selective ringfences and an isolation runbook per crown-jewel app, each with evidence, what it would have blocked and its rollback. Never provisions. Not for one app (illumio-app-profile), audit evidence (illumio-compliance-evidence), unknown-IP inventory (illumio-unknown-endpoints) or estate reports (illumio-pce-assessment). Requires illumio-mcp-server 0.13.1 or later."
---

# Illumio Rapid Risk Reduction

One workflow for "what can we block or fence **now** with the least chance
of breaking something". It reads the estate once, scores every exposure
by blast radius x ease, and writes a one-page plan: block these today,
fence these this week, isolate these on demand, watch these. Every fix is
a draft call plan marked `DO_NOT_CALL`; the skill creates and provisions
nothing.

Everything comes from illumio-mcp tool calls. `scripts/triage.py` merges
the saved results, scores them and writes the plan; it never talks to the
PCE.

## Constraints

- **Read-only.** Never call `provision-policy`, `ringfence-batch`,
  `create-*`, `update-*` or `delete-*`, not even `create-ringfence` with
  `dry_run: true`. Fixes are call plans in a fenced block with
  `"DO_NOT_CALL"` as the first key. If the user asks to apply one, give the
  block, say this skill does not execute writes, and that they can run the
  tool directly.
- **Gentle on the PCE.** Nine queries for the whole triage: two traffic
  summaries over the window, one lateral-movement pull, one
  `find-unknown-endpoints` (three pulls inside), one identity graph, one
  timeline, one workload pull, one ruleset pull. Reuse every result; do
  not re-query per app. Read `totals.truncated` and
  `totals.flows_truncated` on every traffic result; a row count is not
  evidence of completeness.
- **Illumio semantics in the output** (see `references/scoring.md` section
  6): override deny is for incidents and beats every allow rule; a
  selective ringfence needs its deny rule to bite; deny rules are
  enforced on the consumer side when the consumer is a label or workload,
  and at the destination when it is an IP list; a deny bites only in
  selective or full enforcement.
- **Ask one question up front** covering: window (default 30 days),
  which `env` values are production (default: values containing `prod`),
  crown-jewel apps as `app (env)` (optional; default: the top three
  production bridge apps), and output format (markdown in chat, Claude
  Doc, .docx). Ask nothing else; state the assumptions at the top of the
  plan.

## Files

| File | Use it for |
| --- | --- |
| `references/scoring.md` | exposure classes X1 to X6 and CJ, blast radius and ease tables, buckets, measurement, the Illumio semantics every plan states |
| `references/report-template.md` | the one-page plan skeleton and the appendix of call plans |
| `scripts/triage.py` | merges the saved tool results, scores, writes `plan.json`, `plan.md`, `call-plans.md` |

## Workflow

Create a task list with one item per step plus a verification task. Save
every raw tool result to a scratch directory under the file names below;
the script reads them from there.

### Step 0: Connection and version

```
illumio-mcp:check-pce-connection
```

Stop if it fails. If `find-unknown-endpoints` or `get-traffic-timeline`
is not in the tool list, the server is older than 0.13; say so and stop
(see "Older servers").

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
`env` values, and the hostname-to-app map the traffic sections need.

### Step 2: Traffic, two summaries

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
illumio-mcp:get-traffic-flows-summary
  start_date: "YYYY-MM-DD"   end_date: "YYYY-MM-DD"
  detail_level: "full"
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

Saved as `scratch/summary_admin.json`: the admin-port map. Every
`app_to_app` row in it is admin traffic, so a row whose `from` and `to`
carry different `env` values is an environment crossing on an admin port
(X2). The list is the server's `ADMIN_PORTS`; keep it exactly.

The summary names a non-workload source by its IP-list name, so a public
source usually shows as `external:Any (0.0.0.0/0 and ::/0)` or
`unlabelled`; internet exposure is read from Step 4, not from here.
`totals.truncated` true means the 200k cap was hit: narrow the window.

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
fenced (a scoped ruleset with a deny to all workloads), and whether an
`RRR-` ruleset already exists.

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
python3 scripts/triage.py \
  --scratch scratch --out scratch/rrr \
  --window-days 30 --date YYYY-MM-DD \
  --prod-env prod --prod-env production \
  --crown app=pay,env=prod
```

`--prod-env` and `--crown` are repeatable and come from the question in
Step 0; omit `--prod-env` to use every `env` value containing `prod`,
omit `--crown` to default to the top three production bridge apps.
Writes `plan.json` (every line with its evidence, scores and call plans),
`plan.md` (the one page) and `call-plans.md` (the appendix). The script
is tolerant of missing files and says in `plan.json["inputs"]` what it
read; a missing input empties its exposure class, it does not invent one.

Then write the plan following `references/report-template.md`: the
header with the assumptions, the four lists, the baseline, the appendix.
Keep the script's numbers; do not re-derive a score from prose. When the
user asked for a Claude Doc or .docx, render the same content there; a
.docx that uses status colours ends every coloured table with a legend.

### Verification

Before handing over: every line in "Block today" is a deny or override
deny with ease 4 or more; every X1 line says "override deny" and every
ringfence line says "selective" and `deny_consumer: any`; every call plan
block starts with `DO_NOT_CALL`; every runbook ends in `provision-policy`
with its undo; no spike is quoted that carried a caveat; and every
traffic result's cap flag is false, or the plan says which counts are
lower bounds. Nothing was created: the transcript holds no `create-*`,
`provision-policy` or `ringfence-batch` call.

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
  plan.
- Running the lateral-movement or identity tools per app. One estate
  call each.

## Older servers

`find-unknown-endpoints` and `collect-compliance-evidence` shipped in
0.13.0, the IP-list fixes in 0.13.1. On an older server the unknown-source
classes (X1, X3) cannot be computed; run the rest, say the two classes
are missing, and point the user at illumio-unknown-endpoints v1.1.0 for a
hand-built substitute. `illumio-mcp:get-server-changelog` reports the
server version.

## Server gaps

None blocking. A `get-admin-port-exposure` tool (admin-port traffic
grouped by source env, destination env, port and decision in one call)
would replace the second summary and give port detail for allowed rows,
which the summary's `app_to_app` section does not carry. File it on
illumio-mcp-server if Step 2 proves expensive on a large estate.
