# Test catalogue

Every test is binary against a stated rule and names the evidence it was
computed from. Results are PASS, FAIL, EXCEPTION (fails the rule with a
justification the user supplied, or a result the tool could not complete:
capped or truncated; shown orange), ATTESTED (the PCE cannot observe it; a
named person attests to a document) or NOT TESTED (an input the user did
not supply). A test is run once per scope pair unless marked "scope-wide".
A test with several clauses takes the worst clause result. A matrix row
with several tests takes the worst test result, in the order FAIL,
EXCEPTION, NOT TESTED, ATTESTED, PASS.

T1 to T9, T11 and T14 are **computed by `collect-compliance-evidence`**
(illumio-mcp-server 0.13.0 or later) in one call for all scope pairs. The
rules below are the contract; the skill reads each per-pair result
(`result`, `measured`, `rows`, `clauses` where present) and checks it
against the rule before it goes into `pack.json`. The tool's `evidence`
descriptors (`{tool, arguments, returned, capped}`, with `query_name` on
traffic queries) are the evidence citation for those tests. T10, T12 and
T13 are listed in the tool's `not_run`; the skill computes T10 from
`find-unknown-endpoints`, and T12 and T13 from one `get-rulesets` call
per pair plus the attestations. Two departures the earlier hand-rolled
version had to document are resolved in the tool: service objects in T7
are expanded to ports from the services list, and IP lists in T6 are read
for the same policy version as the rules.

Justifications for T2 and T4 exceptions are asked for once, after Step 2
shows the rows; a row without one is FAIL. The tool returns every such row
with `justification: null`; the skill fills it in.

Inputs from the user: the scope pairs; the **approved services list**
(port, proto, direction in or out, consumer or destination, justification,
reference) when they have one, passed to the tool as `approved_services:
[{port, proto, direction, justification}]`; justifications for exceptions;
and the attestations in T12 to T14.

## Inventory

**T1 Scope inventory.** Computed by `collect-compliance-evidence`; the
skill checks the result against this rule. The tool pulls each pair's
workloads once with both labels in one AND block (descriptor: `get-workloads
labels: ["app=<app>", "env=<env>"] detail_level: "compact" max_results:
10000`). Rows carry `href`, `name`, `hostname`, `ip_addresses`, `managed`,
`enforcement_mode`, `visibility_level`, `online`, `ven_status`,
`last_heartbeat_on`, `policy_sync_state`, `health_errors`. Table: workload,
hostname, addresses, managed, mode, VEN status, heartbeat, sync state.
Rule: every pair has at least one workload. A pair with none is FAIL (the
scope label is not in use) and every later test for that pair is NOT
TESTED, which the tool marks as "no workloads in scope". `capped: true`
(the 10000-row ceiling) makes a clean result EXCEPTION and the `measured`
text says the inventory is partial. The rows' `ip_addresses` are the
in-scope addresses T10 uses.

**T2 Enforcement.** Computed by `collect-compliance-evidence`; the skill
checks the result against this rule. Over managed rows of T1:
`enforcement_mode` equals `full` for 100%. `selective` with a justification
is EXCEPTION; `selective` without, `visibility_only` or `idle` is FAIL.
`rows` lists every managed workload not in `full` with `mode` and
`justification: null`; `measured` gives the mode counts. Table: workload,
mode, justification.

**T3 VEN health.** Computed by `collect-compliance-evidence`; the skill
checks the result against this rule. Over managed rows of T1: `ven_status`
is `active`, `last_heartbeat_on` is within 24 hours of `collected_at`,
`policy_sync_state` is `synced` or `applied`, `health_errors` is empty.
Rule: all four for every row. `rows` carry `workload`, `field`, `value`,
one row per failing field. Any failing row makes the test FAIL. An
unhealthy VEN may not be enforcing the policy the pack cites.

**T4 Unmanaged workloads in scope.** Computed by
`collect-compliance-evidence`; the skill checks the result against this
rule. Rows of T1 with `managed` false. They carry no VEN and enforce
nothing; they only give the PCE an identity for the address. Rule: zero
rows, or each row with a justification (EXCEPTION). `rows` carry
`workload`, `href`, `ip_addresses`, `justification: null`.

## Policy (active)

**T5 Active policy for the scope.** Computed by
`collect-compliance-evidence`; the skill checks the result against this
rule. The tool reads the policy version once (`pversion: "active"`, echoed
as `policy_version`) and keeps, per pair, the rulesets scoped to the pair
and the rulesets holding a rule that names the pair on either side, union
by href (descriptor: `get-rulesets pversion: "active" labels: [...]
actor_labels: [...] actor_side: "any"`, with `rulesets` and
`providing_rules` counts). The providing rules are the enabled allow rules
whose provider is `{all_workloads: true}`, a label or a label group inside
a ruleset scoped to the pair, or whose provider labels name the pair. Rule:
every providing rule has a non-empty `description`. `rows` list the
undescribed rules with `ruleset`, `ruleset_href`, `rule`, `consumers`,
`providers`; the test is FAIL when any exist. `measured` reads "N of M
providing rules described; K rulesets in the pair's policy". The server
matches direct label actors, not label groups, so say so when label groups
are in use.

**T6 No broad consumer into the scope.** Computed by
`collect-compliance-evidence`; the skill checks the result against this
rule. Over the providing rules of T5. A consumer is broad when it is
`{all_workloads: true}` with `unscoped_consumers` true or in an unscoped
ruleset (any managed workload in the estate), or an `ip_list` whose name
contains `0.0.0.0/0` or `::/0`, or whose ranges in the **same policy
version** as the rules include `0.0.0.0/0` or `::/0` (descriptor:
`get-iplists pversion: "active"`). Rule: zero broad consumers. `rows` carry
`ruleset`, `rule`, `consumer`, `why`; the test is FAIL when any exist. A
consumer `{all_workloads: true}` inside a ruleset scoped to the pair means
the pair's own workloads and is not broad.

**T7 Admitted services versus the approved list.** Computed by
`collect-compliance-evidence`; the skill checks the result against this
rule. Over the providing rules of T5, `ingress_services` entries expand to
`rows` of `{ruleset, rule, port, to_port, proto, service, approved,
cleartext}`: `{port, to_port, proto}` entries as port ranges, `{service:
{name, href}}` entries **expanded to ports from the services list** of the
same policy version (`service` names the object). An empty list means all
services (`all_services_rules`). A service object with no port entries
(process-qualified, empty, or not found in the policy version) is listed in
`unexpanded` with the reason. Three clauses, reported in `clauses`:
`no_all_services_rule`, `every_service_object_expanded`,
`every_port_approved` (direction in). The first two are always evaluated.
Without the approved list the third is NOT_TESTED, `approved` is null on
every row and the admitted set is the candidate list; the test result is
then the worst of the first two clauses. `cleartext` lists the ports of
21, 23, 69, 80, 110, 143, 389 inside each row's range: flag them for
review regardless.

## Boundary traffic

Window: PCI 90 days, DORA and NIS2 30 days, unless the user sets it.
`end_date` is the collection date, `start_date` is that minus the window,
both as `YYYY-MM-DD` on the tool call; the tool echoes `window` with
`days`.

Capped results: a traffic descriptor with `capped: true` (`returned`
equals `max_results`, 500 by default) is a lower bound. The tool never
returns PASS on it: a violation visible in a capped result is FAIL, a
clean capped result is EXCEPTION "capped". Re-run with a narrower window
or a higher `max_results`, count the re-run on the cover, keep both files
in the index, and compute the test over the uncapped run.

**T8 Inbound boundary flows.** Computed by `collect-compliance-evidence`;
the skill checks the result against this rule. Three traffic queries per
pair into the pair's labels, for `allowed`, `potentially_blocked` and
`blocked` (descriptors with `query_name`
`compliance-evidence:T8:<app>/<env>:<decision>`). Rows whose source is a
scope pair are dropped (intra-scope; `measured` says how many). `rows` are
the allowed crossings grouped by `src_app`, `src_env`, `src_ip`,
`src_hostname`, `src_ip_lists`, `port`, `proto`, with `source` as `app
(env)` or hostname or IP, `connections`, `approved`, `findings`. Clauses in
`clauses`: `every_crossing_approved` (direction in; NOT_TESTED without the
list); `every_source_is_a_workload_or_named_ip_list` (no source with an
empty `src_hostname` and no public source, unless the address is inside a
named IP list a T5 rule uses); `zero_potentially_blocked` (a potentially
blocked flow into the scope means a workload in the scope is not
enforcing and the boundary is not real yet; `potentially_blocked` lists
them). The result is the worst clause, EXCEPTION when the allowed or
potentially-blocked query was capped. Evidence without a pass rule:
`blocked` (`rows`, `connections`, `capped`) as proof the control is
active, and `timeline` (`bucket: "1d"`, `effective_bucket`, `series` of
`{bucket_start, flows, connections, blocked, potentially_blocked}`,
`rows_spanning_buckets`, `worst_spike`, `spike_rule`, `caveat`) as the
detection evidence (DORA Art 10, NIS2 Annex 3.2). Quote `effective_bucket`;
name `worst_spike` only when `caveat` is null.

**T9 Outbound boundary flows.** Computed by `collect-compliance-evidence`;
the skill checks the result against this rule. One traffic query per pair
from the pair's labels, `allowed` (`query_name`
`compliance-evidence:T9:<app>/<env>:allowed`), intra-scope rows dropped.
`rows` are grouped by `dst_app`, `dst_env`, `dst_ip`, `dst_hostname`,
`dst_fqdn`, `dst_ip_lists`, `port`, `proto`, with `destination`,
`outside_estate` (empty `dst_hostname`), `public`, `in_named_ip_list`,
`connections`, `approved`, `findings`; public destinations are listed
first, then by volume. Clauses: `every_destination_approved` (direction
out; NOT_TESTED without the list, the observed set as the candidate) and
`public_destinations_in_named_ip_list` (a public destination outside any
named IP list a T5 rule uses is a finding). The cap rule above applies.

**T10 Unknown endpoints inside scope subnets** (scope-wide). Computed by
the skill from one `find-unknown-endpoints start_date/end_date: the window
direction: "both" top_n: 500` call. Keep `endpoints[]` with
`address_class: "private"` whose `neighbourhood.prefix` (the /24 or /64
shared with managed workloads) contains an in-scope address from the T1
rows; these are the U1 findings of `illumio-unknown-endpoints` inside the
scope's own subnets. Rule: zero. Each hit is a host inside the scope's own
subnets that the PCE does not know and that no segmentation rule can name;
record `ip`, `fqdn`, `neighbourhood`, `profile`, the `as_source` and
`as_destination` summaries and `peers_enforced`. `totals.flows_truncated`,
`totals.inventory_truncated` or `totals.unknown_endpoints` above the
number returned make a clean result EXCEPTION; a visible hit is FAIL.

## Change control, logging, attestations

**T11 Change control** (scope-wide). The pending-change half is computed by
`collect-compliance-evidence`; the skill checks the result against this
rule. The tool reads the pending changes once (descriptor:
`compare-draft-active resource_type: "rule_sets"`) and keeps, per pair,
the entries whose `href` is one of the pair's T5 rulesets. Rule: none,
PASS (`measured` "draft and active are in sync"); some, EXCEPTION with
`rows` of `{href, name, change_type}` (draft work in progress is not a
violation, but the pack cites active policy and must say what is about to
change). The change history is the skill's own call: `get-events kind:
"policy" timestamp_gte: "<window start>T00:00:00Z" timestamp_lte: "<window
end>T23:59:59Z" max_results: 500`. Table: `timestamp`, `event_type`,
`created_by.username` (with `created_by.type`), `status`, and from
`resource_changes[]` the `resource_type`, `name`, `href` and
`change_type` of what changed, with the rows that name a scope ruleset or
rule marked. Evidence only. The call is one PCE request per event type,
merged newest-first; `truncated: true` means a partial history (narrow the
window). Quote `event_types_unverified`: those are Illumio's documented
names not yet seen on a PCE, so their absence is not proof that no such
change happened.

**T12 Isolation capability.** From the skill's `get-rulesets pversion:
"active" labels: ["app=<app>", "env=<env>"]` call per pair: an enabled
`deny` or `override_deny` rule or a ringfence ruleset (name
`RF-<app>-<env>` or the user's name) for the pair in active policy is the
capability. The drill is an attestation: date, who ran it, the record.
ATTESTED when supplied, else NOT TESTED. This skill never calls
`ringfence-*`, `emergency-isolate-application` or any write tool.

**T13 Review cadence.** Attestation: date of the last review of the scope's
rules, by whom, the record. Rule: within 6 months for PCI 1.2.7, within the
organisation's stated cadence for DORA and NIS2. ATTESTED or NOT TESTED.
Supporting evidence, from the same `get-rulesets` result as T12: each
ruleset's and rule's `created_at`, `updated_at`, `update_type` and
`updated_by.username` (null when the API key may not list users or the
actor is a service account; say so), with the newest `updated_at` across
the pair's rulesets cited as the last policy change, next to T11's event
table.

**T14 Logging** (scope-wide). Computed by `collect-compliance-evidence`;
the skill checks the result against this rule. Rule: the tool's event
read for the window (descriptor: `get-events max_results: 500`, before any
type filter) returned at least one row, and the pair's T8 queries returned
at least one flow. `measured` gives the event count, the policy-related
subset and the flow count; `rows` are the policy-related events. NOT
TESTED when T8 was not run. Retention period is an attestation.

## Query budget

`collect-compliance-evidence` reports its own PCE reads in `queries`:
scope-wide one pull each of labels, rulesets, IP lists, services, pending
changes and events (6), plus per pair one workload pull, four traffic
queries and one deny-rule read per matched ruleset (cached across pairs).
The skill adds `find-unknown-endpoints` 1, `get-events kind: "policy"` 1,
`get-rulesets` 1 per pair, plus any re-runs of capped queries. Three
pairs: the tool's 21 plus deny-rule reads, plus 5. The number on the cover
is the tool's `queries` plus the extra calls, each counted once
(`find-unknown-endpoints` makes three PCE reads and `get-events kind:
"policy"` one request per event type inside that one call).
`check-pce-connection` and `get-server-changelog` do not count. State the
number in the pack.
