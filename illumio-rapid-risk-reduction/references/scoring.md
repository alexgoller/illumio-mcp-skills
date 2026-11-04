# Scoring: blast radius x ease

Every finding gets two numbers and their product. Both are computed by
`scripts/triage.py` from the saved tool results, and the plan prints the
inputs next to the score so a line can be disputed.

## Blast radius (0-10)

How much of the estate the exposure touches.

| Input | Points |
| --- | --- |
| enforced workloads reached (`peers_enforced`, or dst hosts in `full`/`selective`) | 1 per workload, cap 5 |
| distinct destination apps touched | 1 per app, cap 3 |
| admin port involved (22, 3389, 445, 135, 139, 5985, 5986, 1433, 3306, 5432) | +2 |
| lateral-movement bridge or articulation point | +2 |
| crosses a production boundary (non-prod -> prod) | +1 |

## Ease (0-10)

How safely it can be blocked without breaking something.

| Input | Points |
| --- | --- |
| traffic already `potentially_blocked` or `blocked` (policy already says no) | +4 |
| source is not a workload at all (unknown endpoint) | +3 |
| source profiled as `scanner` | +2 |
| fix is a single deny rule (not a ringfence that needs an allow-list) | +2 |
| a label scope exists for the provider side | +1 |
| source is a user-facing app or a shared service (DNS, AD, monitoring) | -4 |
| traffic is `allowed` and intra-app | disqualified from "block today" |

## Placement

| Score | List |
| --- | --- |
| >= 30, ease >= 6 | Block today (deny rule) -- e.g. an already potentially-blocked admin port crossing into production scores 5 x 7 = 35 |
| >= 25 | Fence this week (selective ringfence) |
| critical app named by the user, any score | Isolate on demand (runbook) |
| identity findings | Questions, never rules |

The thresholds are a starting point, not a law; the plan prints them so the
reader can move a line.
