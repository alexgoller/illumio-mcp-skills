---
name: illumio-label-advisor
description: "Use when the user asks to suggest labels, improve labelling, what labels should these workloads have, label the estate, auto-label, propose role, app, env or loc, or apply suggested labels on an Illumio PCE. Reads the estate with illumio-mcp tools (label vocabulary including custom dimensions, workloads with listening processes and ports, traffic by process and peer, infrastructure hubs), mines the hostname convention from what is already labelled, and proposes one value per missing dimension per workload with a confidence and the evidence behind it, as a report and an Illumio Field dashboard. Fill gaps only: a label a workload carries is never changed; disagreements are reported as conflicts. Apply mode, on request, writes the accepted suggestions after explicit confirmation, with exact label creation, a before-and-after log and a rollback plan. Not for policy, one app's profile or risk triage (rapid-risk-reduction, app-profile). Requires illumio-mcp-server 0.13.0 or later."
---

# Illumio Label Advisor

One workflow for "what labels should these workloads have". The skill never
assumes the estate is labelled well, or at all. It reads what the PCE knows
about every workload (hostname, OS, listening processes and ports, who it
talks to and who talks to it, where it sits) and what the customer has
already decided (the label vocabulary, the hostname convention visible on the
labelled workloads, the custom label dimensions), and proposes one value per
missing dimension per workload. Every suggestion carries a confidence and the
evidence sentence it rests on, so the user can accept it, change it or
ignore it.

Two modes:

- **Suggest** (default, read-only): the report, the dashboard, the apply plan
  as a table. Nothing is written.
- **Apply** (on request): the user's preferences choose which suggestions
  become labels; the skill creates the missing labels, assigns the merged
  set per workload, verifies, and writes a log and a rollback plan.

**Fill gaps only.** A dimension the workload already carries is never
suggested for and never changed, in either mode. When the evidence disagrees
with an existing label the pair goes to the **conflicts** section for a
human to look at.

## Constraints

- **Suggest mode is read-only.** No `create-*`, `update-*`, `delete-*`,
  `provision-policy` or `ringfence-*` call.
- **Apply mode writes labels and nothing else.** `create-label` for values
  with no exact match, `update-workload` with the `labels` field only. Never
  enforcement mode, names, interfaces, policy. Never a label a workload
  already carries. Never a new value for a custom dimension (existing values
  only); new values for `role`, `app`, `env` and `loc` are allowed and
  listed before anything is written.
- **The script never talks to the PCE.** `scripts/advise.py` reads the saved
  tool results, applies the rules in `references/inference.md` and writes
  every output. Tool results are saved raw; the script is run, not
  re-implemented in prose.
- **Gentle on the PCE.** One labels call, one compact inventory, full detail
  in subnet batches (unlabelled workloads first, 300 by default), one traffic
  summary, two capped flow queries per batch of 25 workloads, and the
  infrastructure-service tool once. Read `truncated` on every result; the
  readiness section names every call that hit a cap.
- **Illumio semantics.** Label values `-`, empty and null are missing.
  `update-workload labels` replaces the whole set, so every write carries
  the existing labels plus the additions. `get-labels` matches the value
  partially, so an "exists" check compares the returned values exactly.
- **Ask one question up front** (Step 0): mode, window, scope, output
  format. In apply mode a second question collects the preferences
  (Step A1). Ask nothing else; state assumptions at the top of the report.

## Files

| File | Use it for |
| --- | --- |
| `references/inference.md` | the signals, the confidence rules, hubs, conventions, conflicts, limits; the rules the script applies, stated once |
| `references/process-roles.md` | the listening process and port to role table the script reads at run time; extend it, do not copy it |
| `references/report-template.md` | the section skeleton of the report and the sentence each opens with |
| `references/dashboard-spec.md` | the dashboard's tabs, colour mapping, Illumio Field rules and checklist |
| `references/dashboard-example.jsx` | the template the script fills; never hand-edit its DATA block |
| `scripts/advise.py` | plans the batches, merges the saved results, mines conventions, scores suggestions, writes the report, the plan and the dashboard |
| `tests/` | synthetic estates and the checks the skill's rules are proven on (not needed at run time) |

## Workflow: suggest mode

Create a task list with one item per step plus a verification task. Save
every raw tool result under one scratch directory, with the file names
below; the script reads them from there.

### Step 0: Ask, then connect

One message asking for: **mode** (suggest, default; or apply), **window**
(default 30 days), **scope** (default the whole estate; or an `env`, a
subnet, a hostname pattern, a list of hostnames), **output** (chat report,
dashboard, Claude Doc, .docx; default report plus dashboard). Take the
defaults for anything left blank. Then:

```
illumio-mcp:check-pce-connection
illumio-mcp:get-server-changelog
```

Stop only if the connection fails. The changelog's first version is the
server version; 0.13.0 or later has every parameter this skill uses
(`group_by` on flows, label shorthand in include filters, `detail_level` on
workloads).

### Step 1: Vocabulary and inventory

```
illumio-mcp:get-labels
  usage: true
  max_results: 10000
```

Save the text as `scratch/labels.txt` (the response is `Labels: [...]`, a
Python-repr list, not JSON; the script parses it). Every key in it is a
dimension: `role`, `app`, `env`, `loc` and every other key is a custom
dimension. A custom dimension with no labels yet is invisible here (server
issue #80); if the user names one, record it in the report as "not read".

```
illumio-mcp:get-workloads
  detail_level: "compact"
  max_results: 10000
```

One call, **unfiltered**, saved as `scratch/workloads.json` (split format,
`columns` + `data`, one column per label key, plus `hostname`,
`ip_addresses`, `os_type`, `online`, `managed`, `enforcement_mode` and the
VEN health columns). This is the inventory every later step is keyed on.

### Step 2: Plan the batches

```bash
python3 <skill dir>/scripts/advise.py \
  --scratch <scratch dir> --out <scratch dir>/advice --plan-batches
```

Writes `scratch/batches.json`: the full-detail batches (one `ip_address`
prefix per /24, unlabelled and partly labelled workloads first, 300
workloads by default; `--max-full` raises it) and the flow batches (up to
25 workload hrefs each). The script decides the batches from the
inventory; do not pick subnets by hand.

### Step 3: Listening processes and ports

For every entry in `batches.json["full"]`:

```
illumio-mcp:get-workloads
  detail_level: "full"
  ip_address: "<prefix>"        # e.g. "10.20.3."
  max_results: 10000
```

Save as `scratch/workloads_full_<n>.json`. Full detail carries
`services.open_service_ports` (port, protocol, process name, user) and
`os_id`; it is capped by response size with no paging (server issue #81),
so when a batch returns `truncated: true`, re-run it as ten calls with the
prefix followed by one digit (`"10.20.3.1"` to `"10.20.3.9"` and
`"10.20.3.0"`) and save each under its own `<n>` suffix; the script dedupes
by href. The PCE only reports listeners the VEN has seen; a workload
without `open_service_ports` is counted under "without process visibility"
in readiness, not treated as silent.

### Step 4: Traffic

One estate-wide summary over the window:

```
illumio-mcp:get-traffic-flows-summary
  start_date: "YYYY-MM-DD"   end_date: "YYYY-MM-DD"
  detail_level: "full"
```

Save as `scratch/summary.json` (`by_process`, `app_to_app`,
`external_destinations`, `section_totals`, `totals.truncated`).

Then, for every entry in `batches.json["flows"]`, one query with the batch
as sources and one with it as destinations:

```
illumio-mcp:get-traffic-flows
  include_sources: ["<href>", "<href>", ...]      # up to 25
  group_by: ["source", "destination", "port", "proto", "process"]
  start_date: "YYYY-MM-DD"   end_date: "YYYY-MM-DD"
  max_results: 500
```

Save as `scratch/flows_src_<n>.json`; the same call with
`include_destinations` as `scratch/flows_dst_<n>.json`. Each call is capped
at 500 flows; a capped batch is a sample and the script says so per
workload. Process names appear only where the VEN reports them.

### Step 5: Infrastructure hubs

When the inventory has at least one `app` label:

```
illumio-mcp:identify-infrastructure-services
  lookback_days: <window days>
```

Save as `scratch/infra.json`. On an estate with no app labels the tool
returns a message only; skip the file and let the script find hubs by
fan-in (a destination port with 20 or more distinct sources, or a quarter
of the managed workloads).

### Step 6: Score and write

```bash
python3 <skill dir>/scripts/advise.py \
  --scratch <scratch dir> --out <scratch dir>/advice --window-days 30
```

Use absolute paths. Writes `advice.json` (readiness, conventions, hubs,
suggestions, conflicts, unresolved, plan), `suggestions.md` (the report
body), `unresolved.md` (what the model pass should look at), `plan.json`
and `plan.md` (the apply table with a rollback call per workload) and
`dashboard.jsx` (the template with the DATA block filled). With no
`preferences.json` the plan uses the defaults: every dimension, confidence
`high` only, the whole scope, dry run.

### Step 7: Model pass

Read `advice/unresolved.md`. It lists the listening processes and ports the
table in `references/process-roles.md` does not know, and the workloads
with nothing to go on. Where your own knowledge gives a defensible answer
(the binary is a known product, the port is a registered service, the
vendor documents the role), write `scratch/model-suggestions.json`:

```json
[{"href": "/orgs/1/workloads/x", "dimension": "role", "value": "Queue",
  "confidence": "medium", "evidence": "beam.smp listening on 5672/tcp is RabbitMQ"}]
```

Confidence is `medium` when the evidence names the binary and the port,
`low` when it is a guess from one of them. Never suggest `app`, `env` or
`loc` from knowledge alone, and never a value for a custom dimension. Then
re-run Step 6 with `--model`; the script merges the file, marks the source
and caps the confidence. If a process is common enough to deserve a row,
add it to `references/process-roles.md` instead and re-run without the
model file.

### Step 8: Present

- **Readiness first.** Whatever the format, the first thing the user reads
  is the readiness verdict from `advice.json["readiness"]`: how many
  workloads are fully, partly and not labelled, the coverage per dimension,
  how many VENs report no listeners, which calls hit a cap.
- **Report**: `suggestions.md` follows `references/report-template.md`;
  present it in chat with the Step 0 assumptions. Keep the script's counts
  and confidences; do not re-derive a confidence from prose.
- **Dashboard**: save `dashboard.jsx` as
  `/mnt/user-data/outputs/illumio_label_advisor_<date>.jsx` when that
  directory exists, else next to the report, and present it; it opens on
  the Readiness tab. `references/dashboard-spec.md` has the checklist.
  Never hand-build it from prose.
- **The apply plan** is shown as a table (hostname, before, additions,
  after, confidence) with the line "Nothing has been written. Say apply to
  go through the plan." Suggest mode ends here.

## Workflow: apply mode

Apply mode starts from a finished suggest run (`advice.json` exists).

### Step A1: Preferences

One message asking for: **dimensions** to apply (default all, custom ones
included), **minimum confidence** (default `high`), **scope** (default the
Step 0 scope), **dry run** (default yes: the plan is produced and nothing is
written until the user says apply). Write the answers as
`scratch/preferences.json`:

```json
{"dimensions": ["role", "app", "env", "loc", "bu"], "min_confidence": "high",
 "scope": {"type": "all"}, "dry_run": true}
```

Re-run Step 6 (with `--model` if the model pass was used). Present
`plan.md`: the table, the counts line (workloads, labels added, labels
created) and the new values that would be created. The user confirms with
the exact workload count ("apply to 25 workloads"); anything else is not a
confirmation.

### Step A2: Labels

For every entry in `plan.json["new_labels"]`:

```
illumio-mcp:get-labels   key: "<key>", value: "<value>"
```

The value matches partially; the label exists only when one returned entry
has exactly this value (case-sensitive). Only then is it skipped; otherwise:

```
illumio-mcp:create-label   key: "<key>", value: "<value>"
```

Record every created label in `scratch/apply-log.md`.

### Step A3: Workloads

For every entry in `plan.json["workloads"]`, in order:

1. Re-read the workload: `illumio-mcp:get-workloads detail_level:
   "labels_only" hostname: "<hostname>"`, match the href. If a key the plan
   adds has appeared meanwhile, drop that key from the additions (fill gaps
   only, at write time too); if nothing is left, skip the workload.
2. Write the merged set, existing labels first:

```
illumio-mcp:update-workload
  href: "<href>"
  labels: [{"key": "role", "value": "Web"}, {"key": "env", "value": "Production"}]
```

3. Append to `apply-log.md`: hostname, before, additions, after, result.
   Stop at the first error and report it; never retry a write blindly.

### Step A4: Verify and hand over

One `get-workloads detail_level: "labels_only" max_results: 10000`; for
every touched workload the labels must equal `after` in the log. Report
the count written, the count skipped and why, the labels created, and the
rollback: `plan.md` carries one `update-workload` call per workload with
its `before` set. Nothing else on the PCE has changed.

### Verification

Before handing over: the report and the dashboard open with the readiness
verdict and name every capped call; every suggestion has a confidence,
a source and at least one signal with an evidence sentence; no suggestion
names a dimension its workload already carries (the conflicts section does
that); every custom-dimension suggestion uses an existing value; hubs are
listed and none of them served as peer evidence for another workload's
`app` or `env`; the apply plan's counts equal the table; the dashboard
renders every tab with a legend on every coloured section; in suggest mode
the transcript holds no `create-*`, `update-*` or `delete-*` call; in apply
mode every write is in `apply-log.md` with its before and after, the
verification read matches, and the rollback plan exists.

## Mistakes this skill avoids

- Treating a label value of `-` as a value. It is missing.
- Suggesting `app` or `env` for a hub. A domain controller talks to
  everything; its peers say nothing about it, and it says nothing about
  them, which is why hubs are excluded from peer evidence both ways.
- Reading `sshd` or RDP as a role. Every server listens on them.
- Calling `update-workload` with only the new labels. The field replaces
  the set; the write carries the merged set.
- Trusting `get-labels` with a value filter as an existence check. `Prod`
  returns `Production`; compare the value exactly (server issue #78).
- Naming a cluster of unlabelled workloads an application because they
  talk to each other. Application detection is research
  (`research/application-detection.md` in the repo), not a suggestion.
- Letting the model propose `env` or `loc` from a hostname it has never
  seen in the customer's convention. Knowledge covers binaries and ports;
  conventions come from the labelled workloads.
