# Risk report: section skeleton

`scripts/triage.py` writes `report.md` in this shape from the same
`plan.json` as the one-page plan and the dashboard, so the three never
disagree. Present it as markdown, as a Claude Doc, or as a .docx through
the docx skill when the user asked for a document. Keep the script's
numbers and sentences; add context, not figures.

## 0. Header

`Rapid risk reduction report, <date>`: the window, production
environments, crown jewels and their source, the draft ruleset name, and
"Nothing in this report is created or provisioned." A lower-bounds line
when any query hit its cap.

## 1. Executive summary

One paragraph: how many exposures have a draft fix, how many can be
blocked today, how many need a review or a ringfence this week, how many
runbooks are in reserve, how many observations have no rule; and the
one number a reader needs, the currently allowed connections that would
stop across every deny line. Then the top three lines as "score, class,
exposure: action".

## 1a. Where the risk sits

Directly after the executive summary, from `plan.json["risk_map"]`, the
same figures as the dashboard's Risk map tab and the plan's map line:
the takeaway sentence; **Readiness** (verdict, labelled of total, what
sits outside every scoped fix); **Policy read** (the view; in the draft
view the delta table of rulesets and rules new, changed, removed, and
the exposures drafted, provisioned but reported allowed, nothing
drafted); **Headline** (enforcement modes,
unmanaged admin-port sources with the public split only when public
exist, apps reaching most of the estate over the lateral window,
override denies not showing and unchecked); **Apps, ranked** (the top
12 with the six measures and the map rank score, stated as not the
plan score); **Traffic between environments** (allowed, potentially
blocked, blocked per pair); **Rules not showing in traffic** (ruleset,
should stop, reported allowed, basis, enforced on, rule updated; the
override denies that exist only in the draft are counted, not listed);
**Fix first** (the generated list). Neutral wording throughout.

## 2. Risk register

One table, every line in score order, then the watch items:

`# | Risk | Score | Blast radius | Ease | Would have blocked (allowed/pb/blocked) | Recommended action | When`

The action is one clause ("override deny from an IP list of the source
to all workloads on 3389/tcp, 22/tcp, today"). Watch rows carry a dash
for score and ease and "watch: ..." as the action. Close with the
sentence that explains the score and the would-have-blocked split.

## 3. Risks in detail

One block per line, in score order:

- **Risk.** Why this exposure matters, from the class (`WHY` in the
  script): the attacker's view in one or two sentences.
- **What we saw.** The plan's detail line: sources, ports, decision mix,
  peer apps, allow-list size, admitting rules.
- **Evidence.** The tool results and rows behind it, plus blast radius,
  ease and would-have-blocked.
- **Recommendation.** What to draft, where (`RRR-<date>` or
  `RF-<app>-<env>`), when (today or this week), and what would stop
  with whose confirmation. For a ringfence: the allow list, what gets no
  rule, the enforcement move that follows.
- **Rollback.** Delete the draft; nothing is provisioned.

## 4. Observations without a rule

X3 and X6, same block shape, with "Recommendation" naming the human
decision: narrow the admitting rule or list, confirm the account's
reach with its owner.

## 5. Isolation runbooks

One bullet per crown jewel: the ruleset name, the calls in order ending
in `provision-policy`, the effect, the undo. "Incident use only."

## 6. Baseline and 7-day review

The timeline numbers (bucket, median, total, worst spike or caveat) and
the review sentence: re-run the timeline and this skill with the same
window; blocked should rise and potentially blocked fall.

## 7. Method and semantics

The nine pulls (ten in the draft view), the scoring reference, and the
Illumio sentences: scores use the provisioned rules, the policy the
reported decisions come from; override deny beats every allow and is
for incidents; a selective
ringfence needs its deny rule; deny rules are enforced on the consumer
side with a label consumer and at the destination with an IP-list
consumer; selective enforcement reports everything a deny does not
catch as allowed, so "allowed, no rule" counts as deny-safe; labels are
not assumed complete; rollback is deleting the draft.

## Colour

Text has none. A .docx with status cells uses the dashboard mapping only
(red = today, orange = this week, grey = watch and on demand) and every
coloured table ends with a legend.
