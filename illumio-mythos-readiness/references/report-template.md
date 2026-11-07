# Mythos readiness report: section skeleton

`scripts/readiness.py` writes `readiness.md` in this shape from
`readiness.json`, so the report, the dashboard and the chat summary never
disagree. Present it as markdown, as a Claude Doc, or as a .docx through the
docx skill when the user asked for a document. Keep the script's numbers and
sentences; add context, not figures. The reader is the CISO: no scores, no
rule text, no call plans in the main body, no model vendor or product name
anywhere.

## 0. Header

`Mythos readiness, <date>`. Then, one line each: the definition ("Mythos
readiness is the user's own term for how contained a breach stays when the
attacker is an autonomous AI agent that finds a foothold, exploits and moves
laterally at machine speed, with no human in the loop"); the window; the
policy view read; the crown jewels and where they came from; "Nothing in
this report writes to the PCE"; and a lower-bounds line when any
rapid-risk-reduction input hit a cap, or an input was missing (the
lateral-movement result, which caps every app below level 5).

## 1. The question and the answer

One paragraph. "How contained would a breach be today?" answered with the
estate level and its name, the rule in one clause ("at least 80% of managed,
labelled workloads sit in applications at this level or above"), the share
of workloads where containment is in force (level 3 or above), the share
contained (level 5), the unlabelled share when it is not zero, and the
shortest path to the next level: the top three rows of `estate.to_next` as
"<app> (<env>), <n> workloads: <first step>". Then one sentence on what
levels 0 to 2 have in common (a human has to notice) and what 3 to 5 have in
common (they hold without one).

## 2. The ladder

The six-row table: level, name, what it takes (the gates in words), the
attacker's view. Under it, the two sentences from `references/ladder.md` on
human dependence and on what is counted (what is in force today, never what
is planned).

## 3. Estate and environments

The distribution table: level, name, applications, workloads. Then one row
per environment: environment, workloads, level, in-force share, contained
share, and the first row of its `to_next` as "next: <app>, <first step>".
Crown jewels are named with their level in one sentence after the tables.

## 4. Applications

One table, crown jewels first, then level ascending, then workloads
descending: application, environment, workloads, level, what moves it up
(the first next-step sentence). The unlabelled row reads "unlabelled" with
"label these workloads first" as its step. Close with the sentence that a
level is the highest whose gates, and every lower gate, pass; a single
failing gate holds an application at the level below it.

## 5. What to do next

The steps grouped by kind, in this order: label, pair a VEN, write policy,
move enforcement, provision the deny, block or identify an unknown source,
deny the crossing, narrow inbound, ringfence, review an account, check
reach. Each step one line: "<app> (<env>): <sentence> [<bucket>]", where the
bucket word is rapid-risk-reduction's (today, this week) or "plan" when no
drafted fix backs the step. No rule text. The section ends with: "The
engineer's call plans for the steps marked today and this week are in the
rapid-risk-reduction run's `call-plans.md`, under the heading each step
points at (appendix C)."

## Appendix A. Where the risk sits

The rapid-risk-reduction risk map, unchanged, from `readiness.json
["evidence"]`: the takeaway sentence; readiness (verdict, labelled of
total); headline (enforcement modes, unmanaged admin-port sources with the
public split only when public exist, apps reaching most of the estate,
override denies not showing and unchecked); applications ranked with the
six measures (stated as the risk map's rank, not a plan score); traffic
between environments; rules not showing in traffic; fix first. Opens with
"Evidence for the grades above; produced by the rapid-risk-reduction run of
<date>."

## Appendix B. Method and semantics

The gate tests in words, one line per gate; the estate rule with its
threshold; the inputs read (`plan.json`, `workloads.json`, `lateral.json`
present or missing) and every truncation note; the two caveats
(unknown-source decisions are per source, not per peer application;
wide-reach accounts per application are a lower bound); and the Illumio
sentences: selective enforcement enforces deny rules only; full enforcement
is default deny with allow rules; a provisioned ruleset on a
visibility-only workload changes nothing; a drafted rule changes nothing
until provisioned; labels are never assumed complete; nothing in this report
writes to the PCE.

## Appendix C. Call plans

One sentence: "Call plans: `call-plans.md` of the rapid-risk-reduction run
in `<rrr dir>`, under the headings the steps in section 5 point at."
Nothing copied.

## Colour

Text has none. A .docx with status cells uses the dashboard mapping only
(gate pass Safeguard Green, gate fail Risk Red, unknown grey; level badge
filled Server Slate at level 3 and above, outlined below; Illumio Orange is
never a status) and every coloured table ends with a legend.
