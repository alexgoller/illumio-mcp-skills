# Scoring rubric: rapid risk reduction

Every line in the plan is one **exposure** found in the triage, scored as
blast radius x ease, and attached to one **fix** of a known type. The
script computes all of this from the saved tool results; the thresholds
are stated here so the reader of the plan knows what a number means, and
so a change on either side is noticed.

## 1. Exposure classes

| # | Exposure | Source | Test | Fix type |
| --- | --- | --- | --- | --- |
| X1 | Unknown source reaching workloads on admin ports | `find-unknown-endpoints` (inbound) | `admin_reach` in `profile` | **override deny**: IP list of the sources -> all workloads on the admin ports seen |
| X2 | Admin ports crossing an environment boundary | admin-port traffic summary, `app_to_app` | `from` and `to` parse to `app (env)` with different `env` | **deny**: `env=<from>` -> `env=<to>` on the admin ports; one rule per environment pair |
| X3 | Internet-exposed listener | `find-unknown-endpoints` (inbound) | `address_class` public with an `as_source` block | **review** the admitting rule (the lists in `ip_lists`, or the default list); a draft rule only through X1 |
| X4 | Lateral-movement bridge app | `detect-lateral-movement-paths` | listed in `high_risk_bridge_nodes` (`reachable_apps` is observed outbound reach, blocked traffic included) | **selective ringfence** of the app, `deny_consumer: any`: fencing inbound stops the bridge being used as a hop, because an attacker has to get into it first |
| X5 | App in visibility mode that policy already wants to block | workloads + estate summary | any workload of the app in `visibility_only` or `idle`, and an `app_to_app` row into the app with `potentially_blocked` or `blocked` | **selective ringfence** of the app, then move its workloads to selective |
| X6 | Interactive identity with wide reach | `build-identity-graph` | `class` interactive and `interest` review in `findings` | **watch**: no Illumio rule names an identity; the admin-port denies of X1 and X2 are the control |
| CJ | Crown-jewel app | the user's list, else the three production bridges from X4 with the largest `reachable_apps`; with neither, the section says so and asks for a name | always | **isolation runbook**: the `emergency-isolate-application` prompt's steps spelled out as calls, held in reserve |

An app can appear in X4 and X5; it gets one ringfence line carrying both
reasons. X1 and X3 can name the same address; it gets one override-deny
line (X1) and is listed under X3 only when it also reaches non-admin
ports.

Admin ports are the server's `ADMIN_PORTS`: tcp 21, 22, 23, 88, 135, 139,
389, 445, 636, 1433, 1521, 2049, 3306, 3389, 5432, 5900, 5985, 5986,
6379, 9200, 27017 and udp 161. The admin-port summary is filtered to
exactly this set, so every `app_to_app` row in it is admin traffic.

## 2. Blast radius (B, 1 to 5)

How much the exposure can reach, from the evidence row that found it:

| B | X1, X3 (`peer_workloads` of the source) | X2 (distinct destination apps in the pair) | X4 (`reachable_apps`) | X5 (workloads in the app) | X6 (`distinct_apps`) |
| --- | --- | --- | --- | --- | --- |
| 1 | 1 | 1 | 0 to 1 | 1 | 1 |
| 2 | 2 to 4 | 2 | 2 | 2 to 4 | 2 |
| 3 | 5 to 9 | 3 to 4 | 3 to 5 | 5 to 9 | 3 to 4 |
| 4 | 10 to 24 | 5 to 9 | 6 to 10 | 10 to 24 | 5 to 9 |
| 5 | 25 or more | 10 or more | 11 or more | 25 or more | 10 or more |

## 3. Ease (E, 1 to 5)

How little the fix can break. Start from the **decision mix** of the
connections the fix would touch (from the same rows):

| Share already `blocked` or `potentially_blocked` | base |
| --- | --- |
| 95% or more (policy already says no; the deny only makes it stick) | 5 |
| 70% to 95% | 4 |
| 30% to 70% | 3 |
| under 30% (an allow rule admits most of it; something may depend on it) | 2 |

Which connections "the fix would touch":

- X1: the source's admin-port rows (`as_source.ports` with `admin`
  true).
- X2: every `app_to_app` row of the environment pair in the admin-port
  summary.
- X4, X5: the inbound rows into the app whose source gets **no allow
  rule** (`unlabelled` or `external:` sources; a labelled remote app
  gets an allow and is not touched). When that set is empty the base is
  4, not 5: the risk is sources outside the window, not observed ones.

Then:

- **+1** when a label scope exists for the fix: a ruleset scoped to the
  app (X4, X5), or the `env` labels on both sides (X2, always). X1 gets
  no scope bonus: a source already in a named IP list was admitted on
  purpose, which makes the deny riskier, not easier.
- **-1** when the fix is a ringfence (X4, X5): its allow list is built
  from observed traffic and needs a review before provisioning.
- Clamp to 1 to 5.

Ease measures how little observed traffic the draft changes, not whether
the change is wanted; a line with `allowed` connections says what would
stop and who admits it today, and the user decides.

Decision mix reads `potentially_blocked` as "no allow rule covers this
today". The traffic still flows while the workload is in visibility or
selective mode, so a deny on it is a change in behaviour, just not a
change in intent. `blocked` means nothing changes. `allowed` means an
allow rule admits it and a deny below that rule does nothing; only an
override deny bites, and it will break whatever used the rule.

## 4. Score and buckets

`score = B x E` (1 to 25). Lines are ordered by score, then connections.

| Bucket | Rule |
| --- | --- |
| **Block today** | fix type deny or override deny, E >= 4 |
| **This week: fence, or deny after review** | every other line with a draft fix: ringfences, and denies with E < 4 (an allow rule admits most of their traffic; the line names the admitting rules from `rulesets.json`, or the IP list for X1, and the user confirms that traffic may stop) |
| **Isolate on demand** | the CJ runbooks; nothing is drafted for these |
| **Watch** | X3 lines that are not also X1, and X6 lines; no draft fix |

A line whose traffic came from a capped query (`totals.truncated`,
`totals.flows_truncated`) keeps its bucket, and the plan says every count
on it is a lower bound.

## 5. Measurement

For every draft rule: **would have blocked** = the connections in the
window matching the rule's consumer, provider and services, split by
decision. The `allowed` share is what the rule changes for real; the rest
is what it makes permanent.

Baseline for the 7-day review: the estate-wide blocked and potentially
blocked timeline (1-day buckets over the window): the daily median, the
worst spike (only when `spikes` carries no `caveat`), and the total. After
provisioning, the same query should show `blocked` rising by about the
`allowed` plus `potentially_blocked` sums of the provisioned rules, and
nothing else moving.

## 6. Illumio semantics stated in every plan

- Override deny is for incidents and hard blocks: it is evaluated before
  allow rules, so it beats any allow that exists or is added later. Never
  use it for ringfencing (the ringfence's own allows would not work).
- A regular deny is evaluated after allow rules; it catches what no allow
  admits. A selective ringfence needs its deny rule, because selective
  enforcement defaults to allow.
- Deny rules are enforced on the **consumer** side when the consumer is a
  workload or label (pushed to every managed workload carrying it) and at
  the **destination** when the consumer is an IP list. `deny_consumer:
  any` is the safest flavour for that reason.
- A deny bites only on workloads in selective or full enforcement; on a
  visibility-only workload it reports `potentially_blocked`.
- Rollback of any draft rule is deleting it from the draft; nothing in
  this plan is provisioned.
