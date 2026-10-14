---
name: illumio-app-profile
description: "Use when the user asks to tell me everything about app X, for an app profile, what does app X talk to, who talks to app X, is app X ready for enforcement, or what is being blocked for app X on an Illumio PCE. The app is identified by labels (app=shop, env=prod). Produces a short profile: inbound and outbound traffic by peer and service, workloads with enforcement mode and VEN health, the policy that matches the app from draft or active, blocked flows over time with spikes, and findings with candidate (never provisioned) allow rules. Not for estate-wide health, ransomware or AI-agent assessments (those are illumio-daily-assessment, illumio-pce-assessment, illumio-agentic-ai-risk-assessment). Requires the illumio-mcp MCP server, 0.10.0 or later."
---

# Illumio App Profile

One workflow for "tell me everything about app X". The app is a label set,
typically `app=<name>` plus `env=<env>` (add `loc` if the user gives one).
Everything comes from the PCE through illumio-mcp; nothing is provisioned.

## What the profile contains

1. **Inbound traffic** to the app: peer × service (port/proto) × policy
   decision, with connection counts.
2. **Outbound traffic** from the app, the same way.
3. **Intra-app traffic** listed once, as its own group.
4. **Workloads** in the app: name, role, enforcement mode, VEN status, health,
   last heartbeat; the enforcement breakdown (full / selective /
   visibility_only / idle).
5. **Policy that matches the app**: rulesets scoped to its labels, rules
   anywhere that name its labels as consumer or provider, and whether that is
   draft or active.
6. **Blocked flows over time** with spikes (>= 3x the median of the non-zero
   buckets), the worst named with its time and multiple.
7. **Findings**: workloads still in visibility mode, blocked services with no
   rule, stale VENs, blocked-flow spikes, and candidate allow rules.

## Constraints

- **Read-only.** Never call `create-*`, `update-*`, `delete-*`,
  `provision-policy`, `ringfence-*` or `emergency-isolate-application`.
  Candidate rules are text, or a `create-ruleset` call plan the user can review.
- **Gentle on the PCE.** Every traffic query is filtered by the app's labels so
  the result cap lands on this app, not the estate. Resolve labels once, fetch
  workloads once, compute the enforcement breakdown locally. The timeline is
  one query per direction. Read `totals.truncated` and `section_totals`; a
  row count is not evidence of completeness.
- **Ask one question up front**, covering direction (`in`, `out`, `both`;
  default both), window (default 7 days), policy version (`draft` or
  `active`; default draft) and output format (markdown in chat, Claude Doc,
  .docx). Ask nothing else; state assumptions at the top of the profile.

## Files

| File | Use it for |
| --- | --- |
| `references/report-template.md` | the section skeleton and the sentence each opens with |
| `scripts/app_profile.py` | merges the saved tool results, computes the findings and candidate rules |

## Workflow

Create a task list with one item per step plus a verification task. Save
every raw tool result to the scratch directory; the script reads them from
there.

### Step 0: Connection

```
illumio-mcp:check-pce-connection
```

Stop if it fails.

### Step 1: Resolve the app's labels

```
illumio-mcp:get-labels   key: "app", value: "<name>"
illumio-mcp:get-labels   key: "env", value: "<env>"
```

The result is a Python-repr list (`Labels: [{'href':..., 'key':..., 'value':...}]`),
not JSON. `key` matches exactly, `value` partially, so check the returned value
is the one asked for. Keep the `key=value` strings; every later step takes that
form.

### Step 2: Workloads and VEN health

```
illumio-mcp:get-workloads
  detail_level: "compact"
  max_results: 10000
```

One call, **unfiltered**, saved as `scratch/workloads.json`. The app's own
workloads are selected locally by label; the rest is the inventory the script
uses to turn a peer's hostname into its app labels (traffic sections name
peers by host). Split-format JSON (`columns` + `data`) with `hostname`,
`enforcement_mode`, `visibility_level`, `online`, `managed`, `ven_status`,
`last_heartbeat_on`, `agent_version`, `policy_sync_state`, `health_errors`,
`health_error_types`, and one column per label key (`role` included). The
enforcement breakdown and stale-VEN list are computed from this file; do not
call `get-workload-enforcement-status` as well.

A VEN is **stale** when `ven_status` is not `active`, or `last_heartbeat_on`
is older than 24 hours, or `health_errors` > 0.

### Step 3: Traffic, by direction

Inbound (skip when direction is `out`):

```
illumio-mcp:get-traffic-flows-summary
  include_destinations: ["app=<name>", "env=<env>"]
  start_date: "YYYY-MM-DD"   end_date: "YYYY-MM-DD"
  detail_level: "full"
```

Outbound (skip when direction is `in`): the same with `include_sources`.
Save as `scratch/inbound.json` and `scratch/outbound.json`.

Why the summary and not `get-traffic-flows`: the summary queries the PCE wide
(200k flows) and aggregates; `get-traffic-flows` is capped at 500 flows per
call, which one busy app exceeds in a day. The summary's sections are what the
profile needs: `app_to_app` (peer app × policy decision × connections),
`blocked` (peer host × port/proto × decision, every blocked and potentially
blocked pair), and `by_process` (process × destination × port × decision).
`section_totals` carries the full count of each section whatever was
displayed; `totals.truncated` means the PCE cap was hit and every count is a
lower bound -- narrow the window rather than report it as complete.

Entries in one include list are ANDed, so `["app=shop", "env=prod"]` is
exactly this app. Rows whose source and destination are both the app are
intra-app; they appear in both files and the script lists them once.

Service-level detail for **allowed** peers is not in the summary (the blocked
section is complete, the allowed side is summarised per app). When the user
needs it, one `get-traffic-flows` with `group_by: ["source_app", "port",
"proto", "policy"]` gives a port breakdown from a 500-flow sample; say it is a
sample.

### Step 4: Policy

```
illumio-mcp:get-rulesets
  labels: ["app=<name>", "env=<env>"]     # rulesets SCOPED to the app
  pversion: "<draft|active>"
illumio-mcp:get-rulesets
  actor_labels: ["app=<name>", "env=<env>"]   # rules that NAME the app
  pversion: "<draft|active>"
```

Save as `scratch/rulesets_scoped.json` and `scratch/rulesets_referencing.json`.
Both responses carry `policy_version`; the profile states it. Scopes, actors
and services are plain data (`{key, value, href}`, `{all_workloads: true}`,
`{ip_list: {name, href}}`, `{port, proto: "tcp"}`, `{service: {name, href}}`),
and allow, deny and override-deny rules share one shape under `rule_type`.

The second call fetches every ruleset and costs one extra request per ruleset
for its deny rules. That is the price of "rules anywhere that name this app";
say so if the estate is large, and run it once.

Optional: `illumio-mcp:compare-draft-active resource_type: "rule_sets"` only
to say whether pending changes touch the app's rulesets.

### Step 5: Blocked flows over time

```
illumio-mcp:get-traffic-timeline
  start_date: "YYYY-MM-DD"   end_date: "YYYY-MM-DD"
  bucket: "1h"                          # 1 day; "6h" for a week
  policy_decisions: ["blocked", "potentially_blocked"]
  split_by: "policy_decision"
  spikes: true
  include_destinations: ["app=<name>", "env=<env>"]
```

One call per direction (`include_sources` for outbound). Save as
`scratch/timeline_in.json` / `scratch/timeline_out.json`.

**Read `effective_bucket` before quoting a spike.** Explorer aggregates older
flows per day, so a fine bucket piles day-wide rows onto their start: on one
estate 54 of 69 blocked rows landed in the 00:00 bucket, a "27x spike" that was
the aggregation. If `effective_bucket` is coarser than what you asked for,
re-run with that bucket. If `spikes.caveat` is present, report the caveat, not
the multiple. `rows_spanning_buckets` and `resolution_note` explain why.

### Step 6: Merge and findings

```bash
python3 scripts/app_profile.py \
  --app "app=<name>" --app "env=<env>" \
  --scratch scratch --out scratch/profile
```

Writes `profile/profile.json` (every table the report needs) and
`profile/findings.md`. Findings, in the order they are written:

- **visibility-mode workloads** -- the app is not enforced anywhere those run;
- **stale VENs** -- offline, not active, no heartbeat in 24h, or health errors;
- **blocked services with no rule** -- a blocked or potentially-blocked
  peer × service that no allow rule scoped to, or naming, the app covers;
- **blocked-flow spikes** -- only when the timeline carried no caveat;
- **candidate allow rules** -- one per blocked peer app × service, as text and
  as a `create-ruleset` call plan. Peers without an app label are named by
  address and need an IP list, which the plan says. These are suggestions;
  the skill never calls them.

The script is tolerant of missing files (an `out`-only profile has no
inbound file) and says in `profile.json["inputs"]` what it read.

### Step 7: Write the profile

Follow `references/report-template.md`. Open with the assumptions (direction,
window, policy version), then the sections in order. Keep tables to the top
10 rows by connections and say how many rows there were. Every finding names
the evidence row it came from.

### Verification

Before handing over: the `policy_version` in the profile matches what the user
asked for; no spike is quoted that carried a caveat; every candidate rule
corresponds to a blocked row in `profile.json`; and `totals.truncated` is
false on every traffic result, or the profile says it is not.

## Older servers

Before illumio-mcp 0.10.0 there is no `get-traffic-timeline`, `compact` has
no VEN columns, and `get-rulesets` has no `pversion` or `actor_labels`. The
skill still works, at a cost: the timeline is one
`get-traffic-flows-summary` per bucket (ask the user first and say how many
calls; offer `6h`), VEN health needs `detail_level: "full"`, and "rules naming
the app" means an unfiltered `get-rulesets` and matching label hrefs by hand.
`illumio-mcp:get-server-changelog` reports the server version.
