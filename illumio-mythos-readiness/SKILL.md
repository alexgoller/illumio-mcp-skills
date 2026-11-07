---
name: illumio-mythos-readiness
description: "Use when the CISO or the user asks how ready the estate is against AI-driven or autonomous attackers, Mythos readiness, breach containment grade, containment maturity per application, or a readiness report for the board. Grades every application on a six-level ladder (Unseen, Seen, Planned, Enforcing, Doors shut, Contained) from what is in force on the Illumio PCE today, states one estate level with the rule behind it, and says per application what moves it up one level, as a CISO report and an Illumio Field dashboard with the rapid-risk-reduction risk map as the evidence appendix. Reads the output of an illumio-rapid-risk-reduction run (run that skill first with the same window; this skill adds no PCE call and never writes). Not for the engineer's call plans, draft rules or scores (rapid-risk-reduction), one app's profile (app-profile) or audit evidence (compliance-evidence). Requires illumio-mcp-server 0.13.1 or later, through rapid-risk-reduction."
---

# Illumio Mythos Readiness

"Mythos readiness" is the user's own term: how contained a breach stays when
the attacker is an autonomous AI agent that finds a foothold, exploits and
moves laterally at machine speed, with no human in the loop. There is no
Illumio definition behind it, and no model vendor or product is named in
anything this skill writes. The audience is the CISO.

What changes against such an attacker is time. Controls that need a human to
notice (visibility, alerts, a plan in the draft) count for little; controls
already in force (enforcement, fences, closed admin ports) count. So the
grade measures what is **in force today**, per `app (env)`, on a ladder of
six levels, and says for every application what moves it up one level. The
estate gets one level, with the rule behind it stated next to it. The
engineer's call plans stay in rapid-risk-reduction; its risk map is this
report's evidence appendix.

| Level | Name | The attacker's view |
| --- | --- | --- |
| 0 | Unseen | we would not know |
| 1 | Seen | we would know afterwards |
| 2 | Planned | we have rules; nothing stops it yet |
| 3 | Enforcing | the attacker meets rules |
| 4 | Doors shut | the easy ways in are closed |
| 5 | Contained | a breach stays where it landed |

Levels 0 to 2 depend on a human noticing. Levels 3 to 5 hold without one.
The gates behind each level are in `references/ladder.md`.

## Constraints

- **Read-only, and no PCE call of its own.** Every number comes from a
  rapid-risk-reduction run (its `plan.json` and two of its saved tool
  results). This skill never calls `create-*`, `update-*`, `delete-*`,
  `provision-policy` or `ringfence-*`, and never re-queries the PCE to
  "check" a figure.
- **One scorer.** Exposure classes, scores, ease and the risk map are
  rapid-risk-reduction's and are stated once, there. This skill grades
  against gates; it never re-derives a score, and the main body of its
  report carries no score at all.
- **The script never talks to the PCE.** `scripts/readiness.py` reads the
  saved files, applies `references/ladder.md` and writes every output. It
  is run, not re-implemented in prose.
- **Labels are never assumed complete.** Workloads without both `app` and
  `env` form one row at level 0; their share is the first thing the estate
  block states.
- **Ask one question up front** (Step 0): window, production environments,
  crown jewels, policy view, output format, and whether a rapid-risk-
  reduction run from today exists. Ask nothing else; state assumptions at
  the top of the report.

## Files

| File | Use it for |
| --- | --- |
| `references/ladder.md` | the six levels, their gates, the attacker's view, the 80% estate rule, the next-step mapping and the Illumio semantics; the rules the script applies, stated once |
| `references/report-template.md` | the section skeleton of the CISO report and what each section opens with |
| `references/dashboard-spec.md` | the dashboard's tabs, colour mapping, Illumio Field rules and checklist |
| `references/dashboard-example.jsx` | the template the script fills; never hand-edit its DATA block |
| `scripts/readiness.py` | grades every app, computes the estate and environment levels and the next steps, writes `readiness.json`, `readiness.md` and `dashboard.jsx` |
| `tests/` | synthetic estates and the checks the ladder is proven on (not needed at run time) |

## Workflow

Create a task list with one item per step plus a verification task. Use one
scratch directory for the whole run: rapid-risk-reduction saves its raw tool
results there and writes to `<scratch>/rrr`; this skill writes to
`<scratch>/mythos`.

### Step 0: Ask, then connect

One message asking for: **window** (default 30 days), **production
environments** (default: every `env` value containing `prod`), **crown
jewels** (`app=<name>,env=<env>`, repeatable; default: rapid-risk-reduction's
choice), **policy view** (`provisioned`, default; or `draft`), **output**
(chat summary, Claude Doc or .docx report, dashboard; default all three)
and **an existing rapid-risk-reduction run from today** (its scratch
directory; default none). Take the defaults for anything left blank. Then:

```
illumio-mcp:check-pce-connection
illumio-mcp:get-server-changelog
```

Stop only if the connection check fails. The changelog's first version is
the server version; rapid-risk-reduction needs 0.13.1 or later and says
what it does on older servers.

### Step 1: The rapid-risk-reduction run

When a run from today with the same window exists, reuse it; the script
needs its `plan.json` (in the run's `--out` directory), and `workloads.json`
and `lateral.json` from its scratch directory. Otherwise run the
illumio-rapid-risk-reduction skill through its Step 7 (score and write)
with the answers from Step 0, saving into `<scratch>` and writing to
`<scratch>/rrr`. Do not stop at its Step 8; this skill presents.

A missing `lateral.json` (the lateral-movement tool timed out, see that
skill's Step 3) is allowed: the reach gate becomes "unknown" and no app can
reach level 5. Say so in the report.

### Step 2: Grade

```bash
python3 <skill dir>/scripts/readiness.py \
  --rrr <scratch>/rrr --scratch <scratch> \
  --out <scratch>/mythos --date YYYY-MM-DD
```

Use absolute paths. `--date` is today. `--threshold` (default 0.8) is the
share of workloads behind the estate level; change it only when the user
asks, and the report then states the value. Writes `readiness.json` (every
app with its gates, level and next steps; estate and environments;
rapid-risk-reduction's risk map as `evidence`), `readiness.md` (the report
in the shape of `references/report-template.md`) and `dashboard.jsx` (the
template with the data in its DATA block). The script says in
`readiness.json["inputs"]` what it read and in `notes` what it could not.

### Step 3: Present

- **Lead with the answer.** The first thing the user reads is the estate
  level and its name, the share of workloads in apps where containment is
  in force (level 3 or above), the share contained (level 5), and the
  shortest path to the next level: the top rows of `estate.to_next` with
  their first step. Five sentences at most, from `readiness.json`; no
  hand-picked apps.
- **Define the term once**, in the first paragraph, in the one sentence
  from `references/ladder.md`. The customer may rename it; the definition
  stands.
- **Report** (when asked for a document): `readiness.md` follows
  `references/report-template.md`; as a Claude Doc or a .docx through the
  docx skill, pipe-delimited rows become table rows. No scores and no call
  plans in the main body; the risk map is appendix A, the method appendix B,
  and appendix C points at the rapid-risk-reduction run's `call-plans.md`
  by heading. A .docx with status cells uses only the dashboard's colour
  mapping and every coloured table ends with a legend.
- **Dashboard**: save `dashboard.jsx` as
  `/mnt/user-data/outputs/illumio_mythos_readiness_<date>.jsx` when that
  directory exists, else next to the report, and present it; it renders as
  an artifact and opens on the Readiness tab. `references/dashboard-spec.md`
  has the checklist. Never hand-build it from prose.
- **What the engineer does next** lives in rapid-risk-reduction's plan and
  call plans. When the user asks for them, point at that run; do not paste
  rule text into the CISO report.

### Verification

Before saying the report is done:

- [ ] `readiness.json` opens; every app row carries every gate id with a
      state and a reason; levels are consistent with the gates (no level
      above a failing or unknown gate).
- [ ] The estate level satisfies the stated threshold against
      `distribution`; the environment levels likewise.
- [ ] Every next step belongs to a gate of the app's next level; every
      call-plan pointer names a heading that exists in the
      rapid-risk-reduction run's `call-plans.md`.
- [ ] The unlabelled row exists when the estate has unlabelled workloads
      and its share is stated in the first paragraph.
- [ ] The first paragraph of the report answers "how ready, and what is the
      shortest path up" without a score, a rule and a vendor name.
- [ ] The dashboard renders without console errors at desktop and phone
      width, every coloured section has its legend, and the DATA block is
      the script's, not hand-edited.
- [ ] Every number in the chat summary appears in `readiness.json`.

## Mistakes this skill avoids

- **Grading intent instead of force.** A drafted ruleset, a planned
  enforcement move or an alert rule changes nothing for an attacker who is
  already moving; the gates read enforcement modes and provisioned rules,
  and a draft counts in the next step, not in the level.
- **Treating selective enforcement as contained.** Selective enforcement
  enforces deny rules only, so an app in selective with no deny rule is at
  level 2, and level 5 needs full enforcement.
- **Letter grades.** A to F invites argument about the mapping; the level
  names say what holds and the gates say why.
- **Inventing a per-app number the data does not carry.** Unknown-source
  decisions are per source, and wide-reach accounts are a lower bound per
  identity; the report says both where they bear on a gate.
- **Hiding the unlabelled.** Workloads without `app` and `env` cannot be
  graded; they are the first row and the first sentence, never a footnote.
- **Re-scoring.** Two scorers drift; this skill reads one `plan.json` and
  adds gates, never scores.
- **A second data pull.** The grade is a view of the rapid-risk-reduction
  run; reading the PCE again would produce figures the appendix cannot
  back.

## Older servers

Inherited from rapid-risk-reduction: on a server before 0.13.0 its
unknown-source classes are missing, so `no_unknown_admin` and
`no_unmanaged_inbound` cannot be decided and are "unknown"; the report
says which level that caps.

## Server gaps

Two of this skill's gates rest on figures the server reports one level
coarser than the gate needs: `find-unknown-endpoints` gives a source's
decision mix across all its peer apps, not per peer app, and
`build-identity-graph` lists the top destinations per identity, so the
per-app count of wide-reach accounts is a lower bound. Both are stated in
the report's method appendix and filed on illumio-mcp-server (#83, #84).
Rapid-risk-reduction's own gaps (#70 to #76) apply unchanged. When a server
release closes one, drop the matching caveat here and in
`references/ladder.md`.
