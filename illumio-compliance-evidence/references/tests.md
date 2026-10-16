# Test catalogue

Every test is binary against a stated rule, runs on tool results already
saved to the evidence folder, and names the file it reads. Results are
PASS, FAIL, EXCEPTION (fails the rule with a justification the user
supplied, or a result the tool could not complete: capped or truncated;
shown orange), ATTESTED (the PCE cannot observe it; a named person attests
to a document) or NOT TESTED (an input the user did not supply). A test is
run once per scope pair unless marked "scope-wide". A test with several
clauses takes the worst clause result. A matrix row with several tests
takes the worst test result, in the order FAIL, EXCEPTION, NOT TESTED,
ATTESTED, PASS.

Justifications for T2 and T4 exceptions are asked for once, after Step 2
shows the rows; a row without one is FAIL.

Inputs from the user: the scope pairs; the **approved services list**
(port, proto, direction in or out, consumer or destination, justification,
reference) when they have one; justifications for exceptions; and the
attestations in T12 to T14.

## Inventory

**T1 Scope inventory.** `get-workloads labels: "app=<app>" detail_level:
"compact" max_results: 10000`, then keep rows whose `env` column equals the
pair's env (the tool takes one label; a list fails schema validation). Keep
`href`, `name`, `hostname`, `ip_addresses`, `managed`, `enforcement_mode`,
`visibility_level`, `online`, `ven_status`, `last_heartbeat_on`,
`policy_sync_state`, `health_errors`. Table: workload, hostname, addresses, managed, mode, VEN
status, heartbeat, sync state. Rule: every pair has at least one
workload. A pair with none is FAIL (the scope label is not in use) and
every later test for that pair is NOT TESTED. If `truncated` is true,
re-run with `max_results` lowered and say the inventory is partial.

**T2 Enforcement.** Over managed rows of T1: `enforcement_mode` equals
`full` for 100%. `selective` with a justification is EXCEPTION; `selective`
without, `visibility_only` or `idle` is FAIL. Table: workload, mode,
justification.

**T3 VEN health.** Over managed rows of T1: `ven_status` is `active`,
`last_heartbeat_on` is within 24 hours of the collection time,
`policy_sync_state` is `synced`, `health_errors` is empty. Rule: all four
for every row. Table: workload, failing field, value. Any failing row makes
the test FAIL. An unhealthy VEN may not be enforcing the policy the pack cites.

**T4 Unmanaged workloads in scope.** Rows of T1 with `managed` false. They
carry no VEN and enforce nothing; they only give the PCE an identity for
the address. Rule: zero rows, or each row with a justification (EXCEPTION).

## Policy (active)

**T5 Active policy for the scope.** Two calls per pair:
`get-rulesets pversion: "active" labels: ["app=<app>", "env=<env>"]`
(rulesets scoped to the pair) and `get-rulesets pversion: "active"
actor_labels: ["app=<app>", "env=<env>"] actor_side: "any"` (rules that
name the pair on one side, in any ruleset; the server matches only direct
label actors, not label groups, so say so when label groups are in use).
Union by ruleset `href`. The output is `policy_version`, `rulesets[]` with
`href`, `name`, `enabled`, `description`, `scopes` (`[{key, value, href}]`
per scope, `[[]]` when unscoped) and `rules[]` with `rule_type` (allow,
deny, override_deny), `href`, `enabled`, `description`, `consumers`,
`providers`, `ingress_services`, `resolve_labels_as`, `unscoped_consumers`.
Rule: every enabled allow rule that provides into the scope (provider is
`{all_workloads: true}` inside a ruleset scoped to the pair, or provider
labels name the pair) has a non-empty `description`. Rules without one are
listed; the test is FAIL. There are no timestamps on rulesets or rules;
T11 and T13 cover change history.

**T6 No broad consumer into the scope.** Over the providing allow rules of
T5. A consumer is broad when it is `{all_workloads: true}` with
`unscoped_consumers` true (absent or false means scoped) or in an unscoped
ruleset (any managed workload in the estate), or an `ip_list` whose name contains `0.0.0.0/0` or `::/0`,
or whose ranges in `get-iplists` (scope-wide, one call, draft lists; say
so) include `0.0.0.0/0` or `::/0`. Rule: zero broad consumers. Each hit is
listed with the ruleset, rule and consumer; the test is FAIL. A consumer
`{all_workloads: true}` inside a ruleset scoped to the pair means the
pair's own workloads and is not broad.

**T7 Admitted services versus the approved list.** Over the providing
allow rules of T5, collect `ingress_services`: `{port, to_port, proto}`
entries expand to port ranges; `{service: {name, href}}` entries are
listed by name and marked "service object, ports not expanded" (no tool
expands them); an empty list means all services. Three clauses: no
all-services rule into the scope; no unexpanded service object; every
admitted port/proto is in the approved list for direction in. The first
two are always evaluated. Without the approved list the third is NOT
TESTED and the admitted set is written out as the candidate list; the
test result is then the worst of the first two clauses.
Flag for review regardless: 21, 23, 69, 80, 110, 143, 389 (cleartext).

## Boundary traffic

Window: PCI 90 days, DORA and NIS2 30 days, unless the user sets it.
`end_date` is the collection date, `start_date` is that minus the window,
both as `YYYY-MM-DD`.

Capped results: a grouped call with `total_pce_flows` of 500 is a lower
bound. The saved file stays in the index; the test cannot be PASS. Re-run
with a narrower window or split by `include_services` until no part is
capped, count every re-run on the cover, and compute the test over the
union of the uncapped parts. A violation visible in a capped result is
FAIL regardless; a capped result with no violation is EXCEPTION "capped".

**T8 Inbound boundary flows.** Four calls per pair:
1. `get-traffic-flows include_destinations: ["app=<app>", "env=<env>"]
   policy_decisions: ["allowed"] group_by: ["source_app", "source", "port",
   "proto", "policy"]`. Drop rows whose `src_app`/`src_env` is a scope pair
   (intra-scope). The rest are allowed crossings: source app (env) or IP,
   port, proto, `num_connections`. Clauses: every port/proto is in the
   approved list for direction in (NOT TESTED without the list); no source
   with an empty `src_hostname` (not a workload) and no public source,
   unless the address is inside a named IP list that a T5 rule uses. The
   result is the worst clause.
2. The same call with `policy_decisions: ["potentially_blocked"]`. Rule:
   zero rows. A potentially blocked flow into the scope means a workload in
   the scope is not enforcing (visibility mode) and the boundary is not
   real yet.
3. `get-traffic-flows-summary include_destinations: ["app=<app>",
   "env=<env>"] detail_level: "standard"`: `totals.connections`,
   `totals.pce_flows`, `totals.truncated`, the `blocked` section as evidence
   that the control is active. No pass rule; it is evidence.
4. `get-traffic-timeline include_destinations: ["app=<app>", "env=<env>"]
   policy_decisions: ["blocked", "potentially_blocked"] bucket: "1d"
   split_by: "policy_decision" spikes: true` for the same window: the
   detection evidence (DORA Art 10, NIS2 Annex 3.2). Quote
   `effective_bucket` and `resolution_note`; name `spikes.worst` only when
   there is no `caveat`. No pass rule; it is evidence.

Excludes cannot express "not (app AND env)" (each exclude entry is its own
OR condition), which is why intra-scope rows are dropped client-side.

**T9 Outbound boundary flows.** Two calls per pair (no timeline):
`get-traffic-flows include_sources: ["app=<app>", "env=<env>"]
policy_decisions: ["allowed"] group_by: ["dest_app", "destination", "port",
"proto", "policy"]` and the summary with `include_sources`. Drop
intra-scope rows. Rows with an empty `dst_hostname` are destinations
outside the managed estate; `dst_fqdn` names them when the PCE resolved
one; public addresses are listed first. Rule: every destination, port and
proto is in the approved list for direction out (NOT TESTED without the
list, with the observed set as the candidate); public destinations not in
a named IP list a T5 rule uses are listed as a finding. The cap rule
above applies.

**T10 Unknown endpoints inside scope subnets** (scope-wide). Run Steps 2
to 4 of `illumio-unknown-endpoints` with the T1 inventories and the T6
`get-iplists` result reused, which leaves three calls:
`get-traffic-flows-summary start_date/end_date: the window detail_level:
"full"`, `find-unmanaged-traffic lookback_days: <window days> direction:
"both" min_connections: 1 top_n: 500`, and `discover-process-egress
start_date/end_date: the window`. Classify as that skill does, then keep
its U1 findings whose neighbourhood prefix contains an in-scope workload
address. Rule: zero. Each hit is a host inside the scope's own subnets that
the PCE does not know and that no segmentation rule can name.

## Change control, logging, attestations

**T11 Change control** (scope-wide). `compare-draft-active resource_type:
"rule_sets"`. The result is either `{"status": "in_sync"}` (nothing
pending: PASS) or `changes.created/updated/deleted` lists of `{href, type,
name}`; keep entries whose `href` is a T5 ruleset. Rule: none, PASS; some,
EXCEPTION listing them (draft
work in progress is not a violation, but the pack cites active policy and
must say what is about to change). Then `get-events timestamp_gte:
"<window start>T00:00:00Z" timestamp_lte: "<window end>T23:59:59Z"
max_results: 500`; keep rows whose `event_type` mentions `provision`,
`sec_policy`, `rule` or `enforcement`. `created_by` is the text form of a
dict; read the `username` out of it. Table: `timestamp`, `event_type`,
actor, the event's `status` field (success or failure). Evidence only; the events carry no resource hrefs
(illumio-mcp-server issue in the gap table), so they show that and when
policy changed, not what.

**T12 Isolation capability.** From T5: an enabled `deny` or
`override_deny` rule or a ringfence ruleset (name `RF-<app>-<env>` or the
user's name) for the pair in active policy is the capability. The drill is
an attestation: date, who ran it, the record. ATTESTED when supplied, else
NOT TESTED. This skill never calls `ringfence-*`,
`emergency-isolate-application` or any write tool.

**T13 Review cadence.** Attestation: date of the last review of the scope's
rules, by whom, the record. Rule: within 6 months for PCI 1.2.7, within the
organisation's stated cadence for DORA and NIS2. ATTESTED or NOT TESTED.
T11's event table is the supporting evidence.

**T14 Logging** (scope-wide). Rule: T11's `get-events` returned at least
one raw row for the window (before the policy filter), and every pair's T8
summary has `totals.pce_flows` above zero. Retention period is an attestation.

## Query budget

Per pair: T1 1, T5 2, T8 4, T9 2 = 9. Scope-wide: `get-labels` 2,
`get-iplists` 1, `compare-draft-active` 1, `get-events` 1, T10 3
(summary, `find-unmanaged-traffic`, `discover-process-egress`). Total
9 x pairs + 8, plus any re-runs of capped queries. Three pairs: 35 PCE
queries. `check-pce-connection` and `get-server-changelog` do not count.
State the number in the pack.
