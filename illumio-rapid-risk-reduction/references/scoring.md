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
| X2 | Admin ports crossing an environment boundary | admin-port flows (`get-traffic-flows` grouped by source app, destination app, port, proto, policy) | `src_env` and `dst_env` differ on an admin port | **deny**: `env=<from>` -> `env=<to>` on exactly the ports seen; one rule per environment pair |
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
6379, 9200, 27017 and udp 161. The admin-port query is filtered to
exactly this set, so every row in it is admin traffic, with its port.

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
- X2: every grouped row of the environment pair in the admin-port
  flows, all ports together.
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
change in intent. `blocked` means nothing changes. `allowed` means the
VEN let it through: in full enforcement or visibility that is because an
allow rule matched, and a deny below that rule does nothing; only an
override deny bites, and it will break whatever used the rule.

**Selective enforcement reports everything a deny does not catch as
`allowed`**, whether or not an allow rule exists (it enforces only deny
rules, so there is no "potentially blocked" on it). An estate of
selective workloads therefore shows no `potentially_blocked` at all and
the denied share alone would score every deny as risky. The script
reads the draft rules instead: when the **enforcing side** of a fix (the
source workloads carrying the consumer env for an X2 deny; the
destination workloads of the source's peer apps for an X1 IP-list deny)
is wholly in selective enforcement and **no draft allow rule could admit
the traffic** (`admitting_rules` empty, scope and `unscoped_consumers`
honoured, named services counted as "could"), the allowed connections
are `allowed_not_admitted` and count towards the deny-safe share with
the denied decisions. They are shown as "allowed, no rule" (teal on the
dashboard). Any mixed enforcement, or any rule that could admit the
traffic, keeps them as plain `allowed`. A draft policy decision from the
server would make this exact; until then it is an inference from the
rulesets, stated as such.

## 4. Score and buckets

`score = B x E` (1 to 25). Lines are ordered by score, then connections.

| Bucket | Rule |
| --- | --- |
| **Block today** | fix type deny or override deny, E >= 4, and (for X1) a public source; an internal unknown source never lands here |
| **This week: fence, or deny after review** | every other line with a draft fix: ringfences; denies with E < 4 (an allow rule admits most of their traffic; the line names the admitting rules from `rulesets.json`, or the IP list for X1, and the user confirms that traffic may stop); and every X1 line with a private address, whatever its ease, marked "identify first": an internal host the PCE cannot name is usually a scanner, a backup or monitoring host, a jump box or an unlabelled server, and blocking it unidentified can stop backups or monitoring. Its call plan sits in the `-internal-review` IP list |
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

## 7. The risk map (not the plan score)

`plan.json["risk_map"]` is the "where does the risk sit" view that
opens every output. It ranks **places**, not fixes, and its
`risk_rank_score` is deliberately not the `score` above.

**Readiness first.** Labels are never assumed complete. `readiness`
counts the workloads with both `app` and `env` (`-`, empty and null are
missing), the enforcement modes of the rest, the traffic and admin-port
rows with an unlabelled side, and gives a verdict: `ready` (all
labelled), `partial` (some unlabelled, named with examples), `not ready`
(no `app`/`env` columns, or no workload with both). Everything scoped
(X2, X4, X5, the grid, ringfences, environment denies) covers labelled
workloads only; the rest is a readiness gap the plan states in its
header and, when it is the majority, leads the fix-first list.

**Apps.** One row per `app (env)` from the whole-window estate summary
(not the 500-flow admin map), six measures:

| Column | Definition |
| --- | --- |
| `unmanaged_inbound` | allowed connections into the app from `external:` or `unlabelled` sources, all ports |
| `unmanaged_admin_sources` | X1 sources with the app in `peer_apps` (internal and public together; public is a footnote) |
| `cross_env_connections` | allowed connections from labelled apps in other environments |
| `cross_env_apps` | distinct labelled apps doing that |
| `wide_reach_accounts` | review-flagged identities with the app in `destinations` (top 10 per identity, a lower bound) |
| `workloads_not_enforcing` | workloads of the app not in selective or full |

Each column gets a band 0 to 4: 0 for zero, else the percentile rank
among the non-zero values (relative, so it works at any estate size
with no fixed threshold). `risk_rank_score` is the sum of the bands (0
to 24). Rows sort crown jewels first, then score, then
`cross_env_connections`. The dashboard shows the bands as shading and
the raw values as numbers; the score itself is not shown there.

**Headline.** Workloads by enforcement mode; unmanaged admin-port
sources split internal and public; apps reaching at least three
quarters of `total_apps` in the lateral-movement result (the top list
is capped at 20, so a lower bound, over the lateral window); override
denies not showing in traffic, and how many could not be checked.

**Environment matrix.** `summary.app_to_app` rows whose two envs
differ, summed by decision per pair, sorted by allowed.

**Rules not showing in traffic (`rule_drift`).** Enabled override denies
in enabled rulesets whose named traffic is reported `allowed`. Plain
denies are out: an allow rule legitimately beats them. Three shapes are
checked (env consumer with All Services against the summary, honouring
scope; IP-list consumer to all workloads with All Services against the
unknown endpoints on that list; env consumer with literal ports and an
app in scope against the admin-port rows); anything else counts as
`override_denies_unchecked`. Each row carries the enforcing side's
modes, `rule_updated_at` and whether the rule changed inside the window.
The wording is "reported allowed", never "broken" or "bypassed": a
provisioned override deny on an enforcing workload reports blocked, so
the reasons left are a draft that is not provisioned
(`compare-draft-active` pending changes are shown beside the table), a
rule newer than the traffic, or data that is not what it looks like.

**Fix first.** Three to six sentences, each only when its evidence
exists, in this order: label first (when the estate is not ready or the
unlabelled workloads are the majority); explain the override denies not
showing; identify the widest internal unknown admin source; narrow the
largest crossing into a crown jewel or the top app, keeping Kerberos,
LDAP and SMB to the directory servers; block the public admin sources
(only when there are any); fence the top three apps and move them to
full enforcement when none is there; label the remaining unlabelled
workloads. No app name is hard-coded.

**Crown jewels on a flat network.** When none is given and the lateral
result has no bridge (`articulation_points` 0, normal on a flat
network), the default is the top three production apps by
`risk_rank_score` with a non-zero score, and the header says so.

## 8. Directory ports in X2 denies

An X2 deny whose ports include 88, 389, 445 or 636 (Kerberos, LDAP, SMB,
LDAPS) from a user or client environment breaks logins. The line names
the destination apps receiving those ports (the directory servers, read
from the admin-port rows) and the call plan carries a carve-out: an
allow for the source env to those apps on those ports, placed above the
deny (an allow beats a plain deny), or the ports dropped from the deny.
