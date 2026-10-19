---
name: illumio-compliance-evidence
description: "Use when the user wants to prove, evidence, document or audit segmentation controls in an Illumio PCE for a regulation or standard: PCI DSS (CDE segmentation, requirement 1, 11.4.5, 12.5.2), DORA (ICT asset identification, network segmentation, isolation, change control), NIS2 (network security and segmentation, asset inventory, access control), or an audit evidence pack, compliance evidence, auditor request, QSA evidence, regulator evidence, segmentation proof, control evidence, are we compliant, show the auditor. Scope is a list of app and env label pairs. Produces an evidence pack as JSON, Markdown, Word, PowerPoint and a React dashboard, all from one pack model, with binary test results, attestations, raw tool results and hashes, re-runnable for drift. Not a compliance score (that is compliance-check) and not a general assessment (illumio-pce-assessment). Requires illumio-mcp-server 0.13.0 or later (collect-compliance-evidence) and the docx skill."
---

# Illumio Compliance Evidence Pack

One workflow that turns the PCE into audit evidence for the segmentation
controls a framework asks for. The output is an evidence pack: scope
declaration, requirement-by-requirement evidence from **active** policy and
observed traffic, binary test results with the rule stated, attestations
for what the PCE cannot observe, the raw tool results with SHA-256 hashes,
and a drift section against the previous pack. The pack is one JSON model
(`references/pack-schema.md`) rendered into whichever of JSON, Markdown,
Word, PowerPoint and a React dashboard the user asks for
(`references/outputs.md`). It is evidence that
supports named controls. It is not a certification, not a score, and it
says which requirements it does not cover.

Everything comes from illumio-mcp tool calls plus the docx skill for the
document. The tests T1 to T9, T11 and T14 are computed server-side by
`illumio-mcp:collect-compliance-evidence` in one call per framework run;
the skill maps the results to the framework matrix, adds T10, the change
history, the attestations and the drift, and renders the pack. The skill is
**read-only**: it never calls `create-*`, `update-*`, `delete-*`,
`provision-policy`, `ringfence-*` or `emergency-isolate-application`, and
it never runs an isolation drill. Drills, reviews and pen tests are
attestations by a named person.

**Older servers.** This version needs illumio-mcp-server 0.13.0 or later
(`collect-compliance-evidence`, `find-unknown-endpoints`, `get-events`
with `kind` and `resource_changes`, ruleset timestamps, `get-iplists`
`pversion`). On an older server use the v1.1.0 release of this skill
(https://github.com/alexgoller/illumio-mcp-skills/releases/tag/v1.1.0),
which runs the fourteen tests by hand from the individual tools. Step 0
checks the version.

## Files

| File | Use it for |
| --- | --- |
| `references/tests.md` | tests T1 to T14: the rules, what the tool computes, what the skill reads, query budget |
| `references/matrix-pci-dss.md` | PCI DSS v4.0.1 requirement to evidence mapping |
| `references/matrix-dora.md` | DORA and RTS 2024/1774 mapping |
| `references/matrix-nis2.md` | NIS2, Implementing Regulation 2024/2690 and national law mapping |
| `references/pack-schema.md` | the JSON pack model every output is rendered from |
| `references/outputs.md` | the five formats (json, md, docx, pptx, jsx), file names, deck outline |
| `references/pack-template.md` | the document structure (Markdown and Word), status colours and legend, appendices |
| `references/dashboard-example.jsx` | working dashboard with synthetic pack data; replace the data block |

The docx mechanics (Arial, Illumio navy headings, status cells, validation)
are those of the `illumio-pce-assessment` skill (directory
`illumio-pce-security-assessment`); read the docx skill before building
the Word document and the pptx skill before building the deck.

## Inputs

- **Framework**: `pci-dss`, `dora` or `nis2`. One pack per framework. For
  a second framework on the same scope, reuse the evidence folder; only
  the matrix and the document differ.
- **Scope**: a list of `app`/`env` pairs, for example `pay/prod`,
  `pay-db/prod`, `tokenizer/prod`. For PCI this is the CDE plus connected-to
  systems the user names; for DORA the apps behind critical or important
  functions; for NIS2 the apps delivering the essential or important
  service. If the user has a dedicated scope label, resolve it to pairs
  with `get-workloads` and still list the pairs. **Always confirm the
  pairs with the user before any traffic query, even when they listed
  them**, in one combined question at Step 1 that also asks for
  connected-to systems, the window, the approved services list, the
  attestations, the previous pack and the PCE version. Wrong scope makes
  the whole pack wrong. A pair whose label does not exist is an error from
  the tool (`unresolved_scope_labels` with the valid values), never a
  wider query.
- **Data-tier pairs** (PCI 1.4.4 only): which pairs hold cardholder data.
  Default: all pairs.
- **Window**: PCI 90 days, DORA and NIS2 30 days by default.
- **Approved services list**: port, proto, direction, consumer or
  destination, justification, reference. Optional; without it the
  approved-list clauses of T7, T8 and T9 are NOT TESTED and the pack
  writes the observed set as the candidate list. It is passed to the tool
  as `approved_services: [{port, proto, direction, justification}]`; the
  consumer or destination and the reference stay in `pack.json` `inputs`.
- **Attestations**: last policy review (date, who, record), isolation drill
  (date, who, record), segmentation test or pen test (date, tester, report),
  log retention period. Optional; missing ones stay as empty rows.
- **Previous pack**: path to the earlier `pack.json` (or Markdown twin),
  for drift.
- **Formats**: any of `json`, `md`, `docx`, `pptx`, `jsx`. Default `json`,
  `md`, `docx`. `pack.json` is always written, since every other format is
  rendered from it.

## Gentle on the PCE

The pack costs one `collect-compliance-evidence` call plus three kinds of
extra call (see the budget in `references/tests.md`). The tool reports its
own PCE reads in `queries`: six scope-wide (labels, rulesets, IP lists,
services, pending changes, events) plus per pair one workload pull, four
traffic queries and one deny-rule read per matched ruleset. The skill adds
`find-unknown-endpoints` (1), `get-events kind: "policy"` (1) and
`get-rulesets` (1 per pair). Three pairs: about 26 plus the deny-rule
reads. The cover states the tool's `queries` plus the extra calls. State
the number in the chat reply before starting when it exceeds 40. Rules:

- Read policy from **active** only: `pversion: "active"` on the tool call
  (its default, echoed as `policy_version`) and on every `get-rulesets`
  call. Draft is cited once, in T11, as pending change.
- Do not call `compliance-check` for evidence: it reads draft and scores
  heuristics. It may be named as a first look.
- Do not call `enforcement-readiness` or `get-policy-coverage-report`;
  they re-query traffic the pack already holds.
- Do not re-run the individual tests by hand (`get-workloads`,
  `get-traffic-flows`, `compare-draft-active`); the tool result is the
  evidence for T1 to T9, T11 and T14.
- Read completeness from the results: `capped` on every evidence
  descriptor and `rows_truncated` on every per-pair result in the tool
  output, `totals.flows_truncated` and `totals.inventory_truncated` on
  `find-unknown-endpoints`, `truncated` on `get-events`. A capped result
  never yields PASS; the tool already applies this to its own tests.
- Save every tool result verbatim before reading it (Step 6 depends on it).

## Workflow

Use a task list with one item per step plus the verification task.

### Step 0: Connection and identity

```
illumio-mcp:check-pce-connection
illumio-mcp:get-server-changelog
```

Record `pce`, `org_id` and `server_version` for the cover. Stop if the
connection fails. Stop if `server_version` is below 0.13.0 or
`collect-compliance-evidence` is not in the tool list, and point the user
to the v1.1.0 release of this skill. The PCE software version is not
exposed; the user supplies it or the cover says "not recorded".

### Step 1: Scope, framework, inputs

Collect the inputs above and confirm the pair list with the user. Label
hrefs come back from the tool in Step 2 (`scope.pairs[].app_href`,
`env_href`), so no label call is needed here. Create the evidence folder
`evidence/<framework>-<scope-name>-<YYYYMMDD-HHMM>/` and number every
saved result `NN-<tool>-<pair>.json` in call order (`all` for scope-wide
calls).

### Step 2: Tests T1 to T9, T11, T14 in one call

One call for all scope pairs:

```
illumio-mcp:collect-compliance-evidence
  scope: [{app: "pay", env: "prod"}, {app: "pay-db", env: "prod"}]
  pversion: "active"
  start_date: "<window start>"  end_date: "<window end>"
  approved_services: [{port: 443, proto: "tcp", direction: "in", justification: "API"}, ...]
```

(`approved_services` only when the user supplied the list; `max_results`
and `max_rows` only when a result comes back capped or row-truncated.)
Save the result as `01-collect-compliance-evidence-all.json`. The result
has `policy_version`, `collected_at`, `window`, `scope.pairs[]` with hrefs
and workload counts, `overall`, `queries`, `tests[]` with
`{id, name, scope, rule, result, per_pair: {"<app>/<env>": {result,
measured, rows, evidence, ...}}}`, and `not_run` for T10, T12, T13.
Then:

1. Copy `scope.pairs` into the pack's scope declaration (add
   `data_tier`).
2. For each test, copy `id`, `name`, `scope`, `rule`, `result` and
   `per_pair` into `pack.json` `tests`, checking every per-pair result
   against the rule in `references/tests.md` (the `measured` and `rows`
   fields are what the check reads). Where the tool returns FAIL for T2
   or T4 with rows whose `justification` is null, ask the user once for
   justifications; a row with one becomes EXCEPTION, the per-pair result
   becomes EXCEPTION when every row has one, and the test result is
   recomputed as the worst per-pair result.
3. The `evidence` entries of each per-pair result are query descriptors
   (`{tool, arguments, returned, capped}`, with `query_name` on traffic
   queries). Keep them as they are in `pack.json`; they map to the
   evidence index as `references/pack-schema.md` describes.
4. Fill the `boundary` block per pair from T8 (`rows` as
   `inbound_admitted` with `source` as the pack's `peer`, the
   `potentially_blocked` count, `blocked.connections`, `timeline`) and T9
   (`rows` as `outbound_admitted` with `dst_fqdn` as `fqdn`).
5. Any `rows_truncated: true` means the pack's table is partial; say so in
   the caption and re-run with a higher `max_rows` when the user needs
   every row. Any `capped: true` descriptor is already EXCEPTION or FAIL
   in the tool's result; re-run with a narrower window or a higher
   `max_results` and keep the re-run's file beside the first.

### Step 3: Unknown endpoints in scope subnets (T10)

One call, window equal to the pack window:

```
illumio-mcp:find-unknown-endpoints
  start_date: "<window start>"  end_date: "<window end>"
  direction: "both"  top_n: 500
```

Keep `endpoints[]` with `address_class: "private"` and a `neighbourhood`
whose `prefix` contains at least one in-scope address (the T1 rows'
`ip_addresses`); these are the U1 hits of `illumio-unknown-endpoints`
inside the scope's own subnets. Zero is PASS. `totals.flows_truncated`,
`totals.inventory_truncated`, or `totals.unknown_endpoints` above the
number returned make the result EXCEPTION unless a hit is visible (FAIL).

### Step 4: Change history and review evidence (T11, T12, T13)

Pending changes for T11 come from the tool (Step 2). The change history
is one call:

```
illumio-mcp:get-events kind: "policy"
  timestamp_gte: "<window start>T00:00:00Z"  timestamp_lte: "<window end>T23:59:59Z"
  max_results: 500
```

Read `created_by.username` (and `created_by.type`), `resource_changes[]`
(`resource_type`, `href`, `name`, `change_type`, `changes`) and `status`
per event; mark the events whose `resource_changes` name a ruleset or rule
of the scope. Quote `event_types_unverified` (documented event names not
yet seen on a PCE) and `truncated` in the caption; a truncated list is a
partial history.

Then one call per pair for the scope's rulesets with their timestamps:

```
illumio-mcp:get-rulesets pversion: "active" labels: ["app=<app>", "env=<env>"]
```

T12 takes the isolation capability from it (an enabled `deny` or
`override_deny` rule, or a ringfence ruleset); T13 takes `updated_at`,
`update_type` and `updated_by.username` per ruleset and rule as the
supporting evidence next to the review attestation (`updated_by.username`
is null when the API key may not list users; say so).

### Step 5: Attestations (T12, T13, retention)

Fill the attestation rows from the inputs. Name the isolation capability
found in Step 4 and leave the drill as attestation. Never run one.

### Step 6: Pack model, then formats

1. Hash every file in the evidence folder (`shasum -a 256`); the hashes go
   into `evidence_index`. The index row for
   `01-collect-compliance-evidence-all.json` carries the tool's query
   descriptors under `queries`.
2. Build `pack.json` along `references/pack-schema.md`: scope with hrefs,
   tests with per-pair results and evidence, requirements from
   the framework matrix with the worst-of rule, attestations, findings,
   boundary tables, drift against the previous `pack.json` (or Markdown
   twin) as the drift table of `references/pack-template.md` section 7,
   evidence index, not-covered list, `overall`. Check it against the
   schema's rules before rendering anything.
3. Render the requested formats from `pack.json` only, as
   `references/outputs.md` defines: Markdown twin (`pack-template.md`),
   Word via the docx skill with status cells and the legend row under every
   status table, PowerPoint via the pptx skill with the deck outline and a
   legend strip on every status slide, the React dashboard from
   `references/dashboard-example.jsx` with the data block replaced. No
   format shows a number that is not in `pack.json`. Validate the docx
   and pptx with their skills' validators.
4. Save under one base name,
   `Illumio_Evidence_<framework>_<scope>_<YYYY-MM-DD>`, in
   `/mnt/user-data/outputs/` when it exists, else the working directory,
   with a zip of the evidence folder beside them. Present every file.

The chat reply is short: the control summary table, the FAIL, EXCEPTION
and NOT TESTED items, the query count, and the file paths.

## Verification (before publishing)

- [ ] The scope pairs in the cover equal the pairs the user confirmed, with the hrefs from the tool's `scope.pairs`
- [ ] Every status in the control summary can be re-derived from the test table
- [ ] Every test row names its evidence: a file in the index with a hash, or a query descriptor recorded under `queries` in the index row of the tool result
- [ ] No PASS sits on a capped or truncated result
- [ ] `policy_version` is `active` in the tool result and in every saved `get-rulesets` result
- [ ] The tool's `overall` equals the pack's worst requirement result, or every difference is a justification the user supplied (T2, T4) or a test the tool does not run (T10, T12, T13)
- [ ] Every empty attestation is still a row in section 6
- [ ] The out-of-scope list is present and verbatim from the matrix
- [ ] Requirement text is quoted from the official source, not from the matrix
- [ ] `queries` on the cover equals the tool's `queries` plus the extra calls (`find-unknown-endpoints`, `get-events`, one `get-rulesets` per pair, re-runs), excluding the connection check and the changelog
- [ ] No write tool was called; no isolation was run
- [ ] Every table with status cells has the legend row; every deck slide and dashboard section that uses status colour has its legend
- [ ] `pack.json` exists, validates against the schema rules, and every other file was rendered from it; a spot check of three numbers in each format matches it

## Known gaps in illumio-mcp-server

| Gap | Workaround | Issue |
| --- | --- | --- |
| `collect-compliance-evidence` takes no justifications; T2 and T4 rows come back with `justification: null` | the skill asks the user and sets EXCEPTION per row client-side | accepted, not filed |
| `collect-compliance-evidence` returns the pair's ruleset count, not the rulesets or their deny rules | T12 capability and T13 timestamps come from one `get-rulesets` call per pair | accepted, not filed |
| `get-events` event names marked expected (`sec_policy.create`, `sec_rule.update`, `workload.update`) are documented, not yet seen on a PCE | `event_types_unverified` is quoted in the pack; a missing provisioning event is not proof of no change | noted in the server changelog |
| The PCE software version is not exposed | the user supplies it or the cover says "not recorded" | accepted, not filed |

## Common mistakes

| Mistake | Fix |
| --- | --- |
| Reporting a `compliance_score` | The pack has no score. Each requirement is PASS, FAIL, EXCEPTION, ATTESTED or NOT TESTED with its rule. |
| Running the fourteen tests by hand on a 0.13 server | One `collect-compliance-evidence` call does T1 to T9, T11, T14; the skill adds T10, the change history and the attestations. |
| Reading draft policy | `pversion: "active"` on the tool call and on every `get-rulesets` call; the cover says "active". |
| Treating a capped result as complete | `capped: true` in a descriptor is a lower bound; the tool returns EXCEPTION or FAIL, never PASS. Narrow the window or raise `max_results`. |
| Calling the tool once per pair | All scope pairs go in one `scope` list; intra-scope rows are dropped only when the tool knows every pair. |
| Taking a FAIL on T2 or T4 as final | Ask for justifications once; a justified row is EXCEPTION. |
| Counting an all-workloads consumer in a scoped ruleset as broad | Inside a ruleset scoped to the pair it means the pair's own workloads; the tool already spares it. |
| Quoting requirement text from the matrix | The matrix holds references; quote the official text and cite it. |
| Rendering the deck or dashboard from the tool results | Everything renders from `pack.json`; build it first. |
| Skipping `pack.json` because only a deck was asked for | It is always written; the deck is a view of it. |
| Claiming PCI, DORA or NIS2 compliance | The pack evidences segmentation controls; section 8 lists what it does not cover. |
| Running an isolation to prove T12 | Never. It is an attestation. |
| Skipping the scope confirmation | One combined question at Step 1, every time. |
