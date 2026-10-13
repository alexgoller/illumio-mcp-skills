---
name: illumio-app-profile
description: "Use when the user asks about one application in an Illumio PCE: tell me everything about app X, app profile, what does app X talk to, who talks to app X, is app X ready for enforcement, what is being blocked for app X, show blocked flows for app X over time. The app is identified by labels such as app=shop, env=prod. Not for estate-wide assessments (illumio-pce-assessment), daily operations (illumio-daily-assessment) or agentic AI reach (illumio-agentic-ai-risk-assessment). Requires the illumio-mcp MCP server."
---

# Illumio Application Profile

One workflow that answers "tell me everything about app X" from the PCE and
writes a short profile with findings: the app's workloads and VEN health,
inbound and outbound traffic by peer and service with policy decisions, the
policy that matches it, blocked flows over time, and candidate allow rules.

Everything comes from illumio-mcp tool calls. There are no helper scripts;
the analysis is done on the tool results. Where a tool is missing, the
workaround is given and the server issue that would remove it is named.

The skill is **read-only**. It never calls `create-*`, `update-*`,
`delete-*`, `provision-policy`, `ringfence-*` or
`emergency-isolate-application`. It may draft rules as text or as a
`create-ruleset` call plan for the user to review, and stops there.

## Files

| File | Use it for |
| --- | --- |
| `references/findings-rubric.md` | finding definitions F0 to F9, the spike rule, candidate-rule construction |
| `references/profile-template.md` | the profile skeleton |

The spike rule and the findings list are shared with illumio-tui's app focus
mode. Keep them identical so both give the same answer for the same app.

## Inputs

- **App labels**, at least `app=<name>`, usually with `env=` and sometimes
  `loc=`. If the user names the app without labels, resolve it in Step 1
  and confirm which `env` they mean when more than one exists.
- **Direction**: `in`, `out` or `both` (default `both`).
- **Window**: default the last 7 days, as `start_date` today minus 7 and
  `end_date` today in `YYYY-MM-DD`. Any other window on request.
- **Timeline**: opt-in. It costs one query per bucket, so it is never run
  without the user's answer to the cost question in Step 5.

Ask for the direction and window only if the user did not say; one question
at most, then proceed with the defaults stated in the profile.

## Gentle on the PCE

The whole profile costs 10 PCE queries without the timeline (2 labels, 1
workloads, 4 traffic, 2 rulesets, 1 draft-versus-active), 9 when the
direction is `in` or `out`, plus 3 per direction only if a grouped traffic
result hits the 500-flow cap. `check-pce-connection` does not count. Rules:

- Filter every traffic query by the app's labels, so any result cap lands
  on this app and not the estate.
- Resolve labels once and fetch workloads once. Compute the enforcement
  breakdown and VEN health from the workload list.
- **Read tools not to call** (they cost PCE queries for data already held):
  `get-workload-enforcement-status`, `enforcement-readiness`,
  `get-policy-coverage-report`. Mention the last two as follow-ups.
- **Write tools never called**: `create-*`, `update-*`, `delete-*`,
  `provision-policy`, `ringfence-*`, `emergency-isolate-application`.
- Read completeness from the result's own fields (`totals.truncated` on the
  summary, `total_pce_flows` on grouped flows). Never infer completeness
  from row counts.
- The timeline is asked for, never assumed.

Keep a running tally of calls; the scope line of the profile states it.

## Workflow

Use a task list with one item per step plus the verification task.

### Step 0: Connection

```
illumio-mcp:check-pce-connection
```

Stop and say so if it fails.

### Step 1: Resolve the app's labels

```
illumio-mcp:get-labels      key: "app"
illumio-mcp:get-labels      key: "env"      (only if env was given)
```

The result is Python-repr text: `Labels: [{'href': '/orgs/1/labels/5',
'key': 'app', 'value': 'shop'}, ...]`. Note the href of every label the
user named and confirm each exists. Keep the whole app/env/loc href-to-value
map; Step 4 needs it to read scopes and rule actors.

### Step 2: Workloads

```
illumio-mcp:get-workloads
  labels: "app=shop"
  detail_level: "full"
  max_results: 1000
```

Pass **one** `key=value` string in `labels`; the server resolves it to an
href. The schema calls it a JSON list, but a list string is mis-parsed and
returns `unresolved_label_filter`, so narrow `env` (and `loc`) yourself from
the `labels` list of each returned workload.

`full` is small when filtered to one app and is the only level with VEN
data: `agent.status.status`, `agent.status.last_heartbeat_on`,
`agent.status.agent_version`, `agent.status.agent_health`. `compact` lacks
all of them (illumio-mcp-server#44). If the full payload is cut
(`truncated: true`), re-run with `compact` and say VEN health was not
available.

From the list compute: count, enforcement breakdown (`full`, `selective`,
`visibility_only`, `idle`), and stale VENs (`online` false, heartbeat older
than 24 hours, or status not active).

### Step 3: Traffic, one grouped query and one summary per direction

Inbound (skip when direction is `out`):

```
illumio-mcp:get-traffic-flows
  start_date / end_date: the window
  include_destinations: ["app=shop", "env=prod"]
  group_by: ["source", "source_app", "port", "proto", "policy"]

illumio-mcp:get-traffic-flows-summary
  start_date / end_date: the window
  include_destinations: ["app=shop", "env=prod"]
  detail_level: "standard"
```

Outbound (skip when direction is `in`): the same two calls with
`include_sources` and `group_by: ["destination", "dest_app", "port",
"proto", "policy"]`.

- Entries in one include list are ANDed, so `["app=shop", "env=prod"]`
  means exactly this app. There is no "source OR destination is the app"
  filter, which is why each direction is its own call.
- The grouped result is split-format JSON (`columns` plus `data` rows) with
  `src_hostname`/`src_ip`/`src_app`/`src_env` (or the `dst_` set),
  `port`, `proto`, `policy_decision`, `num_connections`. Pivot it to
  **peer x service x policy decision** with connection counts. A peer with
  no hostname is unmanaged; keep it as its IP or FQDN.
- It is capped at 500 PCE flows. If `total_pce_flows` is 500, re-run that
  direction three times with `policy_decisions` set to `["blocked"]`,
  `["potentially_blocked"]` and `["allowed"]`, use those three results in
  place of the capped one, and add the 3 queries to the tally. If a split
  is still at 500, say so; the blocked rows then come from the summary's
  `blocked` section, which caps at 200,000.
- The summary gives exact `totals.connections` and `totals.pce_flows`, the
  `blocked` section (`src_label`, `dst_label`, `port`, `proto`,
  `policy_decision`, `connections`), `external_destinations` and
  `app_to_app`. Check `totals.truncated` and quote `totals.coverage_note`
  when it is set.
- **Intra-app flows** (peer carries the app's own labels) appear in the
  inbound view with the source known and in the outbound view with the
  destination known. Match them on port, proto, policy and connection count
  and list each once, with both ends, in the intra-app table only; remove
  them from the inbound and outbound tables. If counts differ between the
  two views, keep both rows in the intra-app table and say they could not
  be matched.

### Step 4: Policy

```
illumio-mcp:get-rulesets   labels: "[[\"/orgs/1/labels/5\", \"/orgs/1/labels/9\"]]"   (app and env hrefs from Step 1)
illumio-mcp:get-rulesets   max_results: 500
illumio-mcp:compare-draft-active   resource_type: "rule_sets"
```

- The ruleset `labels` filter is passed to the PCE as-is, so it must be the
  PCE's own JSON string of href lists; `key=value` is not resolved here
  (illumio-mcp-server#45). It matches scopes only.
- Rules that name the app as consumer or provider can sit in any ruleset,
  so the second call is unfiltered and the match is done on the result.
  Each ruleset costs the server one extra request for its deny rules; with
  hundreds of rulesets, skip the unfiltered call, say so, and report scope
  matches only.
- Scopes and actors come back as SDK dataclass text with hrefs only:
  `Actor(actors=None, label=Reference(href='/orgs/1/labels/3'), ...)`,
  `Actor(actors='ams', ...)` for all workloads,
  `ip_list=Reference(href=...)`, `LabelSet(labels=[Label(href=...), ...])`
  for scopes, `ServicePort(port=443, proto=6, to_port=None, ...)` for
  services (proto 6 tcp, 17 udp; no services means all services). Resolve
  every href through the Step 1 map. A rule names the app when an actor's
  labels all agree with the app's labels and include `app`.
- `get-rulesets` reads **draft** policy and cannot read active. The profile
  always says "policy read from draft". In the draft-versus-active result,
  keep only `changes.created/updated/deleted` entries whose `href` is one
  of the app's scoped or referencing rulesets; those are F7, anything else
  is out of scope.
- **Coverage test** for every blocked or potentially blocked (peer,
  port/proto) pair from Step 3. A rule covers the pair when all of these
  hold:
  1. the rule is `allow` and enabled, in an enabled ruleset;
  2. the ruleset's scope labels are added to both the consumer and the
     provider side (that is how the PCE applies a scope; extra-scope rules
     are not distinguishable in the output, so treat every rule as scoped);
  3. the provider side matches the app (inbound) or the peer (outbound),
     and the consumer side the other way round. An actor matches a managed
     workload when every label the actor names agrees with the workload's
     labels. `actors='ams'` matches any **managed** workload and never an
     unmanaged IP or FQDN; an unmanaged peer is matched only by an
     `ip_list` actor, which this skill cannot see into, so say "possibly
     covered by IP list <name>" and still list the pair under F3;
  4. a service entry spans the port and proto (`to_port` is a range end;
     an empty services list means all services; a `Service(href=...)`
     object cannot be inspected here, treat it as not covering and say so).
  Uncovered pairs are finding F3 and seed the candidate rules.

### Step 5: Blocked timeline (opt-in)

There is no time-bucketed traffic tool (illumio-mcp-server#43), so the
timeline is one `get-traffic-flows-summary` per bucket. Plan, ask, then run.

1. Fix the window on bucket boundaries in UTC: a one-day timeline ends at
   the last full hour and starts 24 hours before it; a one-week timeline
   ends at the last 6-hour boundary (00, 06, 12, 18 UTC). Choose the
   bucket: 1 hour for one day (24 buckets), 6 hours for a week (28). Any
   other window: a size giving 12 to 48 buckets.
2. Tell the user the cost and the cheaper options, in one sentence of this
   shape, with the real numbers: "48 queries for 1 day at 1h buckets, both
   directions (24 at 2h, 8 at 6h); go ahead?" Cheaper options may drop
   below 12 buckets; that is the trade the user is choosing. Run nothing
   until they answer.
3. Per bucket and direction:

```
illumio-mcp:get-traffic-flows-summary
  start_date: "2026-10-12T14:00:00Z"
  end_date:   "2026-10-12T14:59:59Z"
  include_destinations: ["app=shop", "env=prod"]     (include_sources for out)
  policy_decisions: ["blocked"]                       (add potentially_blocked only on request)
  detail_level: "standard"
```

Full timestamps pass through to the PCE unchanged; bare dates would expand
to whole days. Example for a day ending at the last full hour,
2026-10-13T20:00Z: bucket 0 is `2026-10-12T20:00:00Z` to
`2026-10-12T20:59:59Z`, bucket 23 is `2026-10-13T19:00:00Z` to
`2026-10-13T19:59:59Z`. Record `totals.pce_flows` (flows) and
`totals.connections` per bucket, summing both directions.

4. Spike rule: median over the **non-zero** buckets; a spike is any bucket
   with flows at least 3 times that median; the worst spike is the largest
   multiple, named by weekday and time range in the user's local zone,
   with the zone stated once and the multiple to one decimal
   ("Tue 14:00-15:00 CEST, 7.2x median"). Fewer than 3 non-zero buckets is
   "too sparse", not a finding. Show the series as one line per bucket with
   a bar.

### Step 6: Findings and profile

Compute F0 to F9 from `references/findings-rubric.md` using only the data
already collected. Write the profile along
`references/profile-template.md`, findings first, ordered: enforcement
blockers, blocked services, hygiene. State the query count and any
truncation in the scope line.

Candidate allow rules: one per uncovered blocked pair, consumer and
provider as labels when the peer is a managed workload, else an IP list
suggestion with the observed addresses; service as port/proto with the
well-known name; ranked by connections, intra-app first. Label them as
suggestions. When the user asks for a call plan, emit `create-ruleset`
arguments in a code block and do not call it.

## Verification (before publishing)

- [ ] Workload count in the summary line equals the rows in the workload table
- [ ] Every F3 pair appears in the inbound, outbound or intra-app table with a non-zero blocked column
- [ ] The query count in the scope line equals the calls made, and the connection check is not counted
- [ ] Every candidate rule maps to one F3 pair
- [ ] Every ruleset named in the policy section is in a `get-rulesets` result
- [ ] The profile says "draft" for policy and names any pending change
- [ ] The timeline section exists only if the user approved the queries; the query count stated matches the plan
- [ ] No write tool was called

## Known gaps in illumio-mcp-server

Each has a filed issue; the workaround above applies until it ships.

| Gap | Workaround | Issue |
| --- | --- | --- |
| No time-bucketed traffic counts | one summary query per bucket, after asking | illumio-mcp-server#43 |
| `get-workloads` `compact` has no VEN health | `full`, filtered to one app | illumio-mcp-server#44 |
| `get-rulesets`: draft only, raw `labels`, no actor filter, dataclass actors | unfiltered fetch, resolve hrefs by hand, always say "draft" | illumio-mcp-server#45 |
| No combined inbound-plus-outbound filter | two calls per window | accepted, not filed |

## Common mistakes

| Mistake | Fix |
| --- | --- |
| Running the timeline without asking | State the query count, wait for a yes. |
| Calling `get-workload-enforcement-status` or `enforcement-readiness` | The workload list already holds the modes; readiness re-queries traffic. |
| Passing `labels: '["app=shop","env=prod"]'` to `get-workloads` | One `key=value` string; narrow `env` from the result. |
| Passing `app=shop` to `get-rulesets` `labels` | It wants the PCE's JSON of href lists. |
| Reading `total_rows` as completeness | Check `total_pce_flows == 500` and `totals.truncated`. |
| Listing an intra-app flow in both directions | Match on port, proto, policy and count; show it once with both ends. |
| Treating `actors='ams'` as covering an unmanaged IP | All workloads means managed workloads; an unmanaged peer needs an IP list actor, so the pair stays F3. |
| Ignoring the ruleset scope when matching actors | The scope labels apply to both sides of every rule in it. |
| Writing candidate rules as if they were applied | They are suggestions; say so in the heading and never call a write tool. |
