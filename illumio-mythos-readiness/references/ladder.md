# The readiness ladder

Mythos readiness is how contained a breach stays when the attacker is an autonomous AI agent
that finds a foothold, exploits and moves laterally at machine speed, with no human in the
loop. Against such an attacker the thing that changes is time: a control that needs a
person to notice counts for little, a control already in force counts in full. The grade
therefore measures what is in force today, per application and environment, and names
the one change that moves each application up a level.

This file states the rules once. `scripts/readiness.py` applies them; the report and the
dashboard quote them.

## 1. The six levels

| Level | Name | What it takes | The attacker's view |
| --- | --- | --- | --- |
| 0 | Unseen | nothing is known or nothing is enforced; the gates of level 1 fail | we would not know |
| 1 | Seen | every workload of the app carries app and env labels and is managed by a VEN | we would know afterwards |
| 2 | Planned | a provisioned ruleset is scoped to the app, or every workload is already in full enforcement | we have rules; nothing stops it yet |
| 3 | Enforcing | every workload is in selective or full enforcement, and selective workloads sit behind a provisioned deny | the attacker meets rules |
| 4 | Doors shut | no unknown source reaches the app on admin ports and no admin-port crossing from another environment is allowed in | the easy ways in are closed |
| 5 | Contained | every workload is in full enforcement, nothing unmanaged gets in, the app is not a bridge, no wide-reach account is seen in it | a breach stays where it landed |

An app's level is the highest level whose gates, and every lower level's gates, all pass.
A gate is pass, fail or unknown; unknown never passes. The grade is per `app (env)`.
Workloads that lack an app label, an env label or both form one row called `unlabelled`,
which sits at level 0 and whose only failing gate is `labelled`; its other gates are not
graded.

Levels 0 to 2 depend on a human noticing. Levels 3 to 5 hold without one.

## 2. The gates

Every test looks at every workload of the app unless the text says otherwise. The
provisioned policy is the one that counts: a drafted rule changes nothing until it is
provisioned, and the traffic decisions the inputs report come from the provisioned policy.

Level 1, Seen

- `labelled`: app and env are present on every workload. An app row passes by
  construction; the unlabelled row fails.
- `managed`: every workload is managed (a VEN is paired). The reason names how many are
  not.

Level 2, Planned

- `policy_written`: a provisioned ruleset is scoped to the app, or every workload is in
  full enforcement (full enforcement without a scoped ruleset is still policy in force).

Level 3, Enforcing

- `enforcing`: every workload is in selective or full enforcement. The reason names the
  workloads in visibility only and the idle ones.
- `fenced_if_selective`: passes when no workload is in selective enforcement. Otherwise
  it passes only when a provisioned ruleset scoped to the app carries a deny rule to all
  its workloads, because selective enforcement enforces deny rules only: without a deny,
  a selective workload stops nothing.

Level 4, Doors shut

- `no_unknown_admin`: no source the PCE does not know as a workload reaches the app on
  admin ports with connections reported allowed. The counts behind this gate are per
  source, not per app: a source that reaches three apps carries one count of allowed
  connections, so the reason says "source X reaches the app on these ports; n of its
  admin-port connections are reported allowed across its k peer apps". A failure can
  rest on a source whose allowed connections went to another of its peer apps; the fix
  (identify the source, then block it) is the same either way. Internal sources are
  identified first, as the rapid-risk-reduction plan does, because an internal host the
  PCE cannot name is usually a scanner, a backup host or an unlabelled server.
- `no_cross_env_admin`: no admin-port traffic from another environment into the app is
  reported allowed. Crossings that are already blocked or potentially blocked do not
  fail the gate.

Level 5, Contained

- `full_enforcement`: every workload is in full enforcement, which is default deny with
  allow rules. Selective enforcement enforces deny rules only and does not qualify.
- `no_unmanaged_inbound`: no allowed connection into the app comes from an unlabelled
  workload or an external address in the window.
- `not_a_bridge`: the app is not a bridge in the lateral-movement graph. It fails when
  the app is a high-risk bridge node, or when it appears in the top-reachable list
  reaching at least three quarters of the apps in the graph (the wide-reach rule of the
  rapid-risk-reduction skill). It passes when the app is in neither list and the top
  list is either shorter than its cap of 20 entries or its smallest entry sits below
  the three-quarters line. Otherwise the reach is unknown: the top-20 list is capped and
  the app may sit below the cut. The gate is also unknown when the lateral-movement
  result was not saved. The wide-reach count is a lower bound for the same reason.
- `no_wide_reach_account`: no review-flagged interactive account is seen reaching into
  the app. A lower bound: the identity graph lists the top 10 destinations per account.

When a gate's evidence file was not read by the rapid-risk-reduction run (unknown
sources, admin-port flows, the estate summary, the identity graph), that gate is
unknown, not passed, and the next step says which file to save and grade again.

## 3. The estate and the environments

The estate's level is the highest level at which at least 80 percent of the managed,
labelled workloads sit in apps at that level or higher. Level 0 always qualifies. The
same rule gives each environment its level over its own workloads. The threshold is a
parameter of the script (`--threshold`, default 0.8).

Two shares go with the level: the in-force share, workloads in apps at level 3 or higher
over all workloads including the unlabelled ones, and the contained share, the same for
level 5. The shortest path up lists the apps still below the next level, largest first,
each with its first next step.

Crown jewels, when the rapid-risk-reduction run names them, are marked and sorted first.
Nothing else differs for them: the gates are the same.

## 4. What moves an app up

For every failing or unknown gate of the next level the script writes one step. Each
step has a kind, a bucket and, when a line of the rapid-risk-reduction plan backs it, the
line's title and a pointer into that plan's `call-plans.md`. The bucket is the plan's
(`today` or `week`) when a plan line backs the step, else `plan`: human work such as
pairing a VEN or labelling. Steps carry no scores and no rule text.

| Gate | Kind | Rapid-risk-reduction line, when one exists |
| --- | --- | --- |
| `labelled` | `label` | none; "label the n workloads; the illumio-label-advisor skill suggests values" |
| `managed` | `pair_ven` | none |
| `policy_written` | `write_policy` | the app's X4 or X5 ringfence line |
| `enforcing` | `move_enforcement` | the app's X5 line |
| `fenced_if_selective` | `provision_deny` | the app's X4 or X5 line, with its policy state: drafted, provisioned or none |
| `no_unknown_admin` | `block_unknown` | every X1 line naming the app, one step per line; internal sources say "identify first" |
| `no_cross_env_admin` | `deny_crossing` | the X2 line of the environment pair |
| `full_enforcement` | `move_enforcement` | none; "move n workloads from selective to full" |
| `no_unmanaged_inbound` | `narrow_inbound` | the X3 watch lines naming the app, else "label the unlabelled sources" |
| `not_a_bridge` | `ringfence` when it fails, `check_reach` when it is unknown | the app's X4 line |
| `no_wide_reach_account` | `review_account` | the X6 watch lines; destinations per account are not per app, so the step says "review the n wide-reach accounts seen into this app" |

## 5. Illumio semantics the report relies on

- Selective enforcement enforces deny rules only. A workload in selective enforcement
  with no deny rule reaching it stops nothing, and "allowed" in its traffic means only
  that no deny matched.
- Full enforcement is default deny with allow rules. Everything not allowed is blocked.
- A provisioned ruleset on a workload in visibility-only mode changes nothing: the rules
  are evaluated and reported, not enforced.
- A drafted rule changes nothing until it is provisioned. Drafts are work waiting, not
  controls in force.
- Labels are never assumed complete. Workloads without app and env sit outside every
  scoped ruleset, every ringfence and every environment deny, and the report counts them
  rather than guessing.
- Nothing in this skill writes to the PCE. It reads what the rapid-risk-reduction run
  saved and grades it. The steps it names are carried out through that plan's call
  plans, each of which is a draft for review.

## 6. What the inputs can and cannot say

- The grade covers the window of the rapid-risk-reduction run. Traffic outside it is not
  seen.
- When a query hit its cap (the estate summary, the admin-port flows, the unknown
  endpoints, the inventory), the counts that rest on it are lower bounds and the report
  says so in its header.
- The lateral-movement graph is built from the labelled apps only and includes blocked
  traffic as edges, so a bridge is a bridge in the traffic, not necessarily in what
  policy allows today.
