---
name: illumio-rapid-risk-reduction
description: "Use when the user asks what they can block or fence now with the least chance of breaking something on an Illumio PCE, or where the risk sits: rapid risk reduction, quick wins, what can we block today, what to fence first, 24-hour or 7-day plan, risk map. Triages the estate with illumio-mcp tools (unknown admin-port sources, environment crossings, internet-exposed listeners, lateral-movement bridges, non-enforcing apps, wide-reach identities), checks labelling readiness, ranks each exposure by blast radius x ease, and produces a risk map (ranked apps, crossings, rules not showing in traffic, fix first), a one-page plan, a risk report and a React dashboard, all draft-only (denies, selective ringfences, isolation runbooks, each with its rollback), scored against the provisioned policy, plus a draft view: what is already drafted, what is left. Never provisions. Not for one app, audit evidence or estate reports (app-profile, compliance-evidence, pce-assessment). Requires illumio-mcp-server 0.13.1 or later."
---

# Illumio Rapid Risk Reduction

One workflow for "what can we block or fence **now** with the least chance
of breaking something" and "where does the risk sit". It reads the estate
once, scores every exposure by blast radius x ease, and produces three
views of one result, each opening with the **risk map**: labelling
readiness, the apps ranked by unmanaged inbound traffic, unmanaged
admin-port sources, environment crossings, wide-reach accounts and
workloads not enforcing; the traffic between environments; the override
denies that do not show in traffic; and a short fix-first list:

- the **plan**, one page: block these today, fence these this week,
  isolate these on demand, watch these;
- the **risk report**: every exposure with the risk it carries, what was
  seen, the evidence, and the recommended action;
- the **dashboard**, a single-file React artifact in the Illumio style,
  whose first tab is the risk map.

Every fix is a draft call plan marked `DO_NOT_CALL`; the skill creates
and provisions nothing. Everything comes from illumio-mcp tool calls.
`scripts/triage.py` merges the saved results, scores them and writes all
three views from one `plan.json`; it never talks to the PCE.

**Labels are never assumed complete.** Every scoped finding (environment
denies, ringfences, the app grid) covers workloads carrying both `app`
and `env`. The script counts the rest as a readiness gap, states it in
every header, and when no workload is labelled the plan leads with
"label first" and keeps only the classes that need no label (unknown
admin-port sources, public sources, identities, the baseline).

**Two policy views.** The **provisioned** view (default) reads the
active rulesets only: what the PCE enforces today, the policy the
reported decisions in the traffic come from. The **draft** view reads
the draft as well and shows the delta between what exists and what is
left to do: the rulesets and rules the draft adds, changes or removes,
and for every exposure whether a provisioned deny already names it (yet
it reports allowed), a draft deny or ringfence already covers it (the
work left is to provision) or nothing does (the work left is to draft).
Scores, admitting rules and "allowed, no rule" use the provisioned rules
in both views.

## Constraints

- **Read-only.** Never call `provision-policy`, `ringfence-batch`,
  `create-*`, `update-*` or `delete-*`, not even `create-ringfence` with
  `dry_run: true`. Fixes are call plans in a fenced block with
  `"DO_NOT_CALL"` as the first key. If the user asks to apply one, give
  every block the rule depends on in apply order (IP list, ruleset, rule),
  with `for`, `tool`, `DO_NOT_CALL` and `_notes` stripped so what is left
  is the tool's input, and say that this skill does not execute writes:
  they can ask for the call outside this skill or use the PCE UI.
- **Gentle on the PCE.** Nine data pulls plus the connection check (ten
  in the draft view):
  one traffic summary and one admin-port flow query over the window, one
  lateral-movement pull, one
  `find-unknown-endpoints` (three requests inside), one identity graph,
  one timeline, one workload pull, one ruleset pull of the provisioned
  policy (plus one of the draft in the draft view), one draft-to-active
  comparison. Reuse every result; do not re-query per app. Every pull
  that takes a window uses the same one (`start_date` to `end_date`, or
  `lookback_days` equal to its span, with `end_date` today), except the
  lateral-movement pull when it times out (Step 3). On a capped result
  see Step 2.
- **Illumio semantics in the output** (see `references/scoring.md` section
  6): override deny is for incidents and beats every allow rule; a
  selective ringfence needs its deny rule to bite; deny rules are
  enforced on the consumer side when the consumer is a label or workload,
  and at the destination when it is an IP list; a deny bites only in
  selective or full enforcement; and a workload in **selective**
  enforcement reports everything a deny does not catch as `allowed`,
  whether or not an allow rule exists (full enforcement and visibility
  report `allowed` only when a rule matched). The script therefore reads
  the provisioned rules: allowed traffic that no allow rule admits, on an
  enforcing side wholly in selective, counts as deny-safe in the ease
  score and is shown as "allowed, no rule".
- **Ask one question up front** (Step 0) covering: window (default 30
  days), which `env` values are production (default: values containing
  `prod`), crown-jewel apps as `app (env)` (optional; default: the three
  production bridge apps with the largest reach), the policy view
  (default: provisioned only; "provisioned and draft" adds what is
  already drafted and what is left to do), and output (default:
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
policy view, output format) in a single message and take the defaults
for anything left blank. Then:

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
are partial and the plan says so.

**Readiness.** Do not assume the estate is labelled. The script counts
the workloads carrying both `app` and `env` (a `-` or empty cell is
missing) and writes a verdict into every header: `ready` (all
labelled), `partial` (some outside every scoped fix, named with their
enforcement modes) or `not ready` (no `app`/`env` columns, or no
workload with both). On `not ready` the plan still runs: X1, X3, X6 and
the baseline need no label, X2, X4, X5 and the app grid are empty, and
the fix-first list opens with "label first". Say this to the user as the
first finding; the estate is not ready for scoped rules until it has
labels, and the skill's job is then to say so, not to invent scope.

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
`total_pce_flows` of 500 on the admin map means a cap was hit. First
look at the admin map's `first_detected` and `last_detected` columns:
when every row already sits inside one day, halving the window returns
the same rows, so skip the re-pull and let the script report the span
the sample covers (it does so in the header). Otherwise halve the window
once and re-pull every window-bound result (Step 2 to Step 6) so all
inputs share one window; tell the user.
If it is still capped, keep the results: the script marks the counts as
lower bounds in the plan header and the lines keep their buckets. The
same rule applies to `totals.flows_truncated` on Step 4 and Step 6, and
to Step 4's `top_n`: when `totals.returned` is below
`totals.unknown_endpoints`, the X1 and X3 counts are lower bounds and
the header says so.

### Step 3: Lateral movement

```
illumio-mcp:detect-lateral-movement-paths
  lookback_days: <window>
  max_hops: 4
```

Saved as `scratch/lateral.json`. `high_risk_bridge_nodes` (`app`, `env`,
`reachable_apps`) are the X4 ringfence candidates;
`top_reachable_nodes` (capped at 20) and `total_apps` feed the risk
map's "apps reaching most of the estate" (reach of at least three
quarters of `total_apps`, a lower bound when the list is full). The tool
has no truncation flag and its edges include blocked traffic; reach is
observed connectivity, not allowed connectivity.

**Timeout fallback.** On a few hundred workloads the 30-day call can
time out (60 seconds). Retry once with `lookback_days: 7`, keep every
other pull on the full window, and pass `--lateral-days 7` in Step 7 so
the plan header states the shorter window. A flat network returns no
bridge (`articulation_points` 0): that is normal, and the crown jewels
then default to the top three production apps on the risk map.

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
  pversion: "active"
```

Unfiltered, saved as `scratch/rulesets.json`: the **provisioned**
policy, read in both views. Costs one extra request per ruleset for its
deny rules; run it once. The script refuses a draft pull in this file.
It uses it to say which apps already have a scoped ruleset (ease +1),
which are already fenced (a scoped ruleset with a deny to all
workloads), which allow rules could admit an environment crossing or an
unknown source (honouring ruleset scope and `unscoped_consumers`; a
named service cannot be resolved and is marked), which enabled override
denies name traffic that is reported allowed (the risk map's "rules not
showing in traffic"), which provisioned denies already name an exposure
that still reports allowed, and whether an `RRR-` ruleset already
exists (then the deny-rule call plans target it instead of creating
one).

```
illumio-mcp:get-rulesets        (draft view only)
  pversion: "draft"
```

Unfiltered, saved as `scratch/rulesets_draft.json`, only when the user
chose the draft view. The script diffs it against the provisioned pull
by href (rulesets and rules new, changed, removed) and marks every
exposure a draft deny or ringfence already covers as "drafted": the work
left is to provision, not to draft another. It never scores against the
draft.

```
illumio-mcp:compare-draft-active
```

Saved as `scratch/draft_active.json`, both views. Says whether the
draft is what is active (`status: in_sync`) or how many changes are
pending (`total_pending_changes`; the lists may be empty). In the
provisioned view the header says the pending changes were not read; in
the draft view the count sits beside the delta. The script tolerates
the file being missing.

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
  --crown app=pay,env=prod \
  --lateral-days 7 \
  --policy provisioned
```

Use absolute paths: the skill directory for the script, the session's
scratch directory for the saved results. `--window-days` is the span of
the Step 2 window; `--date` is today and names the draft ruleset
`RRR-<date>`. `--prod-env` and `--crown` are repeatable and come from the
question in Step 0; omit `--prod-env` to use every `env` value containing
`prod`, omit `--crown` to default to the three production bridge apps with
the largest reach, or, on a flat network with no bridge, the three
production apps ranked highest on the risk map (the header says which).
`--lateral-days` is only for the Step 3 fallback. `--policy` is
`provisioned` (default) or `draft`; `draft` needs
`rulesets_draft.json` and adds `policy_delta` to `plan.json`, a
`cover` and `policy_state` (`drafted`, `provisioned`, `none`) to every
line, and the policy line to every header. A crown jewel with no
workloads in the inventory still gets its runbook, flagged "not found,
check the label values". Writes `plan.json` (every line with its
evidence, scores, recommendation and call plans, plus the `risk_map`
block: readiness, headline, ranked apps, environment matrix, rule drift,
fix first), `plan.md` (the one page, with the map line after the
totals), `call-plans.md` (the appendix), `report.md` (the risk report,
with "Where the risk sits" after the executive summary) and
`dashboard.jsx` (the template in `references/` with the plan's data in
its DATA block, the Risk map tab first). The script is tolerant of
missing files and says in `plan.json["inputs"]` what it read; a missing
input empties its exposure class, it does not invent one.

### Step 8: Present

- **Lead with the map.** Whatever the format, the first thing the user
  reads is the readiness verdict, the policy line (what was read; in the
  draft view what is already drafted, what is provisioned but still
  reports allowed, and what is left to draft) and the fix-first list
  from `plan.json["risk_map"]`: where the risk sits, in five sentences
  at most, generated from the evidence (no hand-picked apps). Public
  sources appear only when they exist; on a normal enterprise estate the
  ranking is driven by unmanaged internal hosts, environment crossings,
  wide-reach accounts and workloads not enforcing.
- **Plan**: `plan.md` follows `references/report-template.md`; present it
  in chat with the header assumptions. Keep the script's numbers; do not
  re-derive a score from prose.
- **Dashboard**: save `dashboard.jsx` as
  `/mnt/user-data/outputs/illumio_rapid_risk_reduction_<date>.jsx` when
  that directory exists, else next to the plan, and present it; it
  renders as an artifact and opens on the Risk map tab.
  `references/dashboard-spec.md` has the checklist. Never hand-build it
  from prose.
- **Report** (when asked for a report or a document): `report.md`
  follows `references/risk-report-template.md`; as a Claude Doc or a
  .docx through the docx skill, pipe-delimited rows become table rows.
  A .docx with status cells uses only the dashboard's colour mapping and
  every coloured table ends with a legend.

### Verification

Before handing over: every line in "Block today" is a deny or override
deny with ease 4 or more and a public or labelled source (an internal
unknown source is always "this week: identify first"); every X1 line
says "override deny" and every ringfence line says "selective" with
`deny_consumer any`, and its call plan carries `"deny_consumer": "any"`;
every call plan block carries `DO_NOT_CALL`; an X2 deny carrying
Kerberos, LDAP or SMB names the directory servers and its carve-out;
every runbook ends in `provision-policy` with its undo; no spike is
quoted that carried a caveat; and every result's cap flag is false, or
the plan header names the counts that are lower bounds and the span the
admin map covers. The header states the labelling readiness, the policy view (and in the
draft view the delta and the three exposure counts, equal in `plan.md`,
`report.md` and the dashboard's policy tiles) and, when the lateral
pull used a shorter window, says so; `rulesets.json` is the active
pull (the script refuses a draft there), and a line marked "drafted"
says "provision", never "draft another". The risk map's
headline, ranked apps, largest crossing and drift rows are identical in
`plan.md`, `report.md` and the dashboard (one `risk_map` block); the
fix-first list names no app that the evidence does not; the word
"public" appears nowhere on the Risk map tab when no public source
exists; and every drift row says "reported allowed", never "broken" or
"bypassed". The dashboard's KPIs and the report's register show the
same numbers as the plan; the dashboard renders every tab with the data
it has, including an empty estate. Nothing was created: the transcript
holds no `create-*`, `update-*`, `delete-*`, `provision-policy` or
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
- Assuming the estate is labelled. Unlabelled workloads are counted and
  named as a readiness gap, never silently dropped or guessed into an
  app; `-` from the server is a missing label, not an environment.
- Reading `allowed` on a selective workload as "an allow rule admits
  it". Selective reports everything a deny does not catch as allowed;
  the draft rules decide.
- Blocking an internal unknown source before identifying it. On a real
  network it is usually a scanner, a backup host, a jump box or an
  unlabelled server; the call plan keeps it in a review list.
- Calling an override deny "bypassed" or "broken" because its traffic
  shows as allowed. It is "reported allowed"; the pending changes, the
  rule's update time and the data decide why.
- Leading with public sources. They are a footnote that appears only
  when they exist; seeded demo traffic makes them look like the story.
- Scoring against the draft. The reported decisions come from the
  provisioned policy; the draft only says what is already waiting, so a
  draft-only override deny is "drafted, not provisioned", never "not
  showing in traffic".
- Proposing a rule the draft already holds. In the draft view the line
  says "provision the drafted deny in <ruleset>" and the call plan notes
  carry `already_covered`.

## Older servers

`find-unknown-endpoints` shipped in 0.13.0. On an older server the
unknown-source classes (X1, X3) cannot be computed; run the rest, say the
two classes are missing in the plan header, and point the user at
illumio-unknown-endpoints v1.1.0 for a hand-built substitute. Before
0.10.0 `get-traffic-timeline` is missing too: skip the baseline and say
so.

## Server gaps

None blocking; all filed on illumio-mcp-server. An admin-port exposure
tool read through the 200k summary path would make the admin map
complete on a large estate (the 500-flow `get-traffic-flows` path
covered one day of a 30-day window on 216 workloads): issue #70. A
draft policy decision next to the reported one on the traffic tools
would make "allowed, no rule" exact instead of inferred from the
rulesets: #71. Resolving named services in `get-rulesets` would make
the admitting-rule and drift checks exact: #72.
`detect-lateral-movement-paths` times out at 30 days on a few hundred
workloads and caps reach at 20 apps without a total: #73.
`find-unknown-endpoints` has no flag for the `top_n` cut: #74.
`compare-draft-active` changes shape when in sync, and grouped flows
mark an unlabelled side with `-`: #75. `find-unknown-endpoints`
resolves an endpoint's `ip_lists` against the draft IP lists (the SDK
default) with no `pversion` and no echo, so a draft-only list shows on
an endpoint in the provisioned view: #76. When a server release closes
one, drop the matching inference here.
