---
name: illumio-rapid-risk-reduction
description: "Use when the user asks what they can block or fence NOW on an Illumio PCE: rapid risk reduction, quick wins, what can we block today, reduce blast radius fast, emergency hardening, incident hardening, ransomware quick wins, what to fence first, a 24-hour or 7-day hardening plan. Triages the estate with the illumio-mcp tools, ranks exposures by blast radius and ease, and produces a one-page plan with draft-only policy: override-deny rules for the worst inbound exposures, selective ringfences for crown-jewel apps, an isolation runbook per critical app, and what each would have blocked in the last 30 days. Never provisions. Not for a full posture assessment (illumio-pce-assessment), one application (illumio-app-profile), unknown IPs alone (illumio-unknown-endpoints) or audit evidence (illumio-compliance-evidence). Requires the illumio-mcp MCP server, 0.13.1 or later."
---

# Illumio Rapid Risk Reduction

The question is not "what is our posture" but "what can we block or fence in
the next 24 hours, and the next 7 days, with the least chance of breaking
something". The answer is a short ranked plan with draft policy attached and
the evidence for each line.

## What the plan contains

1. **Block today** -- deny rules whose traffic is already `potentially_blocked`
   or comes from sources that are not workloads at all, so nothing depends on
   it: unknown sources on admin ports into enforced workloads, scanners,
   admin ports crossing an environment boundary.
2. **Fence this week** -- selective ringfences for the apps with the widest
   blast radius (lateral-movement bridges, crown jewels the user names).
3. **Isolate on demand** -- an override-deny runbook per critical app, written
   out as the calls an operator would make during an incident.
4. For every line: workloads affected, connections in the window, what the
   rule would have blocked in the last 30 days, and the rollback (delete the
   draft rule; nothing is provisioned).

## Constraints

- **Read-only except drafting.** Never call `create-*`, `update-*`,
  `delete-*`, `provision-policy`, `ringfence-batch` or
  `emergency-isolate-application`. Every rule is a call plan marked
  `DO_NOT_CALL`, in a draft ruleset named `RRR-<date>`, for a human to run.
- **Gentle on the PCE.** One flow summary per direction over the window; one
  unfiltered compact workload pull reused everywhere; admin-port traffic as
  one filtered query. Read `totals.truncated`; a capped pull makes every
  count a lower bound and the plan says so.
- **Say the Illumio semantics out loud** in the plan: override deny beats
  every allow rule and is for incidents; a selective ringfence only bites in
  selective mode because of its deny rule; deny rules are enforced on the
  consumer side, so `deny_consumer: any` (the default) is the safest flavour.
- **One question up front**, covering: window (default 30 days), which
  `env` values count as production, crown-jewel apps (optional), and output
  format. Nothing else; state assumptions at the top of the plan.

## Files

| File | Use it for |
| --- | --- |
| `references/scoring.md` | the ranking rubric: blast radius x ease, with the exact inputs |
| `references/report-template.md` | the plan's skeleton and the sentence each section opens with |
| `scripts/triage.py` | merges the saved tool results, scores, writes the plan and the call plans |

## Workflow

Create a task list with one item per step plus a verification task. Save
every raw tool result to the scratch directory; the script reads them from
there.

### Step 0: Connection and labels

```
illumio-mcp:check-pce-connection
illumio-mcp:get-labels            key: "env"
```

Stop if the connection fails. Confirm the production `env` values the user
named exist. (`get-labels` returns a Python-repr list, not JSON.)

### Step 1: Workloads, once

```
illumio-mcp:get-workloads   detail_level: "compact", max_results: 10000
```

Save as `scratch/workloads.json`. Unfiltered on purpose: it is the inventory
every later step resolves hosts against, and it carries `enforcement_mode`,
`ven_status` and one column per label. The enforcement breakdown is computed
locally.

### Step 2: Traffic over the window

```
illumio-mcp:get-traffic-flows-summary
  start_date: "YYYY-MM-DD"   end_date: "YYYY-MM-DD"
  detail_level: "full"
```

Save as `scratch/summary.json`. Its `blocked` section (every blocked and
potentially-blocked peer-host x service pair) and `app_to_app` (peer apps x
decision) drive the "already potentially blocked" scoring. If `totals.truncated`
is true, narrow the window; do not score on a capped pull.

### Step 3: Admin ports, as one filtered query

```
illumio-mcp:get-traffic-flows
  group_by: ["source_app", "dest_app", "port", "proto", "policy"]
  include_services: [{"port": 22, "proto": "tcp"}, {"port": 3389, "proto": "tcp"},
                     {"port": 445, "proto": "tcp"}, {"port": 135, "proto": "tcp"},
                     {"port": 139, "proto": "tcp"}, {"port": 5985, "proto": "tcp"},
                     {"port": 5986, "proto": "tcp"}, {"port": 1433, "proto": "tcp"},
                     {"port": 3306, "proto": "tcp"}, {"port": 5432, "proto": "tcp"}]
  start_date / end_date as above
```

Save as `scratch/admin_ports.json`. `get-traffic-flows` is capped at 500
flows; filtered to admin ports that is usually enough, and
`total_pce_flows: 500` means it was not -- say so in the plan.

### Step 4: Unknown sources

```
illumio-mcp:find-unknown-endpoints
  direction: "inbound"
  lookback_days: <window>
```

Save as `scratch/unknown.json`. Each endpoint carries `profiles` (`scanner`,
`fan_in_server`, `admin_reach`, `high_volume`, `single_peer`),
`peers_enforced`, `connections` and `likely_provider`. An unknown source with
`admin_reach` into enforced workloads is the top of the "block today" list.

### Step 5: Lateral movement

```
illumio-mcp:detect-lateral-movement-paths   lookback_days: <window>
```

Save as `scratch/lateral.json`. `high_risk_bridge_nodes` and
`articulation_points` are the apps whose ringfence removes the most paths.

### Step 6: Identities (optional, one call)

```
illumio-mcp:build-identity-graph   lookback_days: <window>
```

Save as `scratch/identity.json`. `review`-level findings (an interactive
account from several workloads, blocked flows from an identity) go into the
plan as questions, not rules; policy cannot fix a shared credential.

### Step 7: Score and draft

```bash
python3 scripts/triage.py \
  --scratch scratch --out scratch/rrr \
  --prod-env Production --prod-env prod \
  --crown-jewel app=payment,env=Production
```

Writes `rrr/plan.json`, `rrr/plan.md` and `rrr/callplans/*.json`. The
rubric is `references/scoring.md`; every score in the output names its
inputs so the ranking can be disputed line by line. Missing inputs are
reported in `plan.json["inputs"]`, never guessed.

### Step 8: Write the plan

Follow `references/report-template.md`. Open with the assumptions and the
window, then the three lists in order, each line with its evidence row ids,
then the semantics box, then the 7-day review (re-run steps 2-5 against
`pversion: draft` where the tool supports it, and `get-traffic-timeline` with
`policy_decisions: ["blocked"]` as the baseline).

### Verification

Before handing over: every call plan is marked `DO_NOT_CALL` and names
`RRR-<date>`; no rule in "block today" targets traffic that is `allowed` and
intra-app; every "fence this week" app exists as a label pair; the plan
states `truncated` for any capped pull; and the identity findings are
questions, not rules.
