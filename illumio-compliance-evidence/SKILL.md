---
name: illumio-compliance-evidence
description: "Use when the user wants to prove, evidence, document or audit segmentation controls in an Illumio PCE for a regulation or standard: PCI DSS (CDE segmentation, requirement 1, 11.4.5, 12.5.2), DORA (ICT asset identification, network segmentation, isolation, change control), NIS2 (network security and segmentation, asset inventory, access control), or an audit evidence pack, compliance evidence, auditor request, QSA evidence, regulator evidence, segmentation proof, control evidence, are we compliant, show the auditor. Scope is a list of app and env label pairs. Produces an evidence pack as JSON, Markdown, Word, PowerPoint and a React dashboard, all from one pack model, with binary test results, attestations, raw tool results and hashes, re-runnable for drift. Not a compliance score (that is compliance-check) and not a general assessment (illumio-pce-assessment). Requires the illumio-mcp MCP server and the docx skill."
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
document; the analysis is done on the tool results. The skill is
**read-only**: it never calls `create-*`, `update-*`, `delete-*`,
`provision-policy`, `ringfence-*` or `emergency-isolate-application`, and
it never runs an isolation drill. Drills, reviews and pen tests are
attestations by a named person.

## Files

| File | Use it for |
| --- | --- |
| `references/tests.md` | tests T1 to T14: calls, measured fields, pass rules, query budget |
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
  the whole pack wrong.
- **Data-tier pairs** (PCI 1.4.4 only): which pairs hold cardholder data.
  Default: all pairs.
- **Window**: PCI 90 days, DORA and NIS2 30 days by default.
- **Approved services list**: port, proto, direction, consumer or
  destination, justification, reference. Optional; without it T7 and T9
  are NOT TESTED and the pack writes the observed set as the candidate list.
- **Attestations**: last policy review (date, who, record), isolation drill
  (date, who, record), segmentation test or pen test (date, tester, report),
  log retention period. Optional; missing ones stay as empty rows.
- **Previous pack**: path to the earlier `pack.json` (or Markdown twin),
  for drift.
- **Formats**: any of `json`, `md`, `docx`, `pptx`, `jsx`. Default `json`,
  `md`, `docx`. `pack.json` is always written, since every other format is
  rendered from it.

## Gentle on the PCE

The pack costs 9 queries per scope pair plus 8 scope-wide (see the budget
in `references/tests.md`); three pairs is 35, plus re-runs of capped
queries. State the number in the pack
and in the chat reply before starting when it exceeds 40. Rules:

- Read policy from **active** only (`pversion: "active"`). Draft is cited
  once, in T11, as pending change.
- Fetch the inventory once per pair and reuse it for T1 to T4 and T10.
- Do not call `compliance-check` for evidence: it reads draft, scores
  heuristics, and has no NIS2 (gap table). It may be named as a first look.
- Do not call `enforcement-readiness` or `get-policy-coverage-report`;
  they re-query traffic the pack already holds.
- Read completeness from the results: `truncated` on workloads,
  `total_pce_flows == 500` on grouped flows, `totals.truncated` on
  summaries. A capped result never yields PASS.
- Save every tool result verbatim before reading it (Step 8 depends on it).

## Workflow

Use a task list with one item per step plus the verification task.

### Step 0: Connection and identity

```
illumio-mcp:check-pce-connection
illumio-mcp:get-server-changelog
```

Record `pce`, `org_id` and `server_version` for the cover. The PCE software
version is not exposed; the user supplies it or the cover says "not
recorded". Stop if the connection fails.

### Step 1: Scope, framework, inputs

Collect the inputs above. Resolve each pair's label hrefs with
`get-labels key: "app"` and `get-labels key: "env"` (2 calls, scope-wide)
so the scope declaration cites hrefs. Confirm the pair list with the user.
Create the evidence folder `evidence/<framework>-<scope-name>-<YYYYMMDD-HHMM>/`
and number every saved result `NN-<tool>-<pair>.json` in call order.

### Step 2: Inventory (T1 to T4)

Per pair, `get-workloads labels: "app=<app>" detail_level: "compact"
max_results: 10000`, narrowed to the env client-side. Build the tables for
T1 (inventory), T2 (enforcement), T3 (VEN health), T4 (unmanaged). Keep
every in-scope IP address for T10.

### Step 3: Active policy (T5 to T7)

Per pair, the two `get-rulesets pversion: "active"` calls (scope filter,
then actor filter), union by href. Scope-wide, `get-iplists` once for the
default-list check in T6 (draft lists; say so). Build the providing-rule
set, then T5 (justifications), T6 (broad consumers), T7 (admitted services
versus approved). When label groups appear in actors, say that the actor
filter cannot see through them and that the scoped call is the complete
source for scoped rulesets.

### Step 4: Boundary traffic (T8, T9)

Per pair, the four inbound calls and the two outbound calls of
`references/tests.md`. Drop intra-scope rows client-side. Apply the cap
rule from `tests.md`: never PASS from a capped result, re-run narrower,
count the re-runs, a visible violation is FAIL.

### Step 5: Unknown endpoints in scope subnets (T10)

Run Steps 2 to 4 of `illumio-unknown-endpoints` with the Step 2
inventories and the Step 3 IP lists reused; the three remaining calls and
their arguments are in T10 of `references/tests.md`. Keep U1 findings
whose prefix holds an in-scope address. Zero is PASS.

### Step 6: Change control and logging (T11, T14)

`compare-draft-active resource_type: "rule_sets"`, filtered to the T5
ruleset hrefs. `get-events` for the window with `max_results: 500`, kept
to policy and enforcement event types, actor read from the `created_by`
text. T14 passes when events and flows both exist for the window.

### Step 7: Attestations (T12, T13, retention)

Fill the attestation rows from the inputs. Name the isolation capability
found in T5 (deny or override-deny rule, ringfence ruleset) and leave the
drill as attestation. Never run one.

### Step 8: Pack model, then formats

1. Hash every file in the evidence folder (`shasum -a 256`); the hashes go
   into `evidence_index`.
2. Build `pack.json` along `references/pack-schema.md`: scope with hrefs,
   tests with per-pair results and evidence file names, requirements from
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

- [ ] The scope pairs in the cover equal the pairs the user confirmed, with hrefs
- [ ] Every status in the control summary can be re-derived from the test table
- [ ] Every test row names the evidence file it was computed from, and that file is in the index with a hash
- [ ] No PASS sits on a capped or truncated result
- [ ] `policy_version` is `active` in every saved ruleset result
- [ ] Every empty attestation is still a row in section 6
- [ ] The out-of-scope list is present and verbatim from the matrix
- [ ] Requirement text is quoted from the official source, not from the matrix
- [ ] The query count on the cover equals the calls made, excluding the connection check and the changelog
- [ ] No write tool was called; no isolation was run
- [ ] Every table with status cells has the legend row; every deck slide and dashboard section that uses status colour has its legend
- [ ] `pack.json` exists, validates against the schema rules, and every other file was rendered from it; a spot check of three numbers in each format matches it

## Known gaps in illumio-mcp-server

| Gap | Workaround | Issue |
| --- | --- | --- |
| `compliance-check` reads draft, scores keyword heuristics, has no NIS2, drops an unknown scope label silently | not used for evidence; this skill's tests instead | illumio-mcp-server#54 |
| `get-events` has no resource hrefs or changes, `created_by` is dict text, event type names for provisioning are undocumented | events show who and when, not what; actor parsed from text | illumio-mcp-server#55 |
| `get-workloads` takes one label | filter by app, narrow env client-side | accepted, not filed |
| `get-iplists` reads draft only, ranges as text | used only for the default-list check, stated as draft | illumio-mcp-server#49 |
| No ruleset or rule timestamps in `get-rulesets` | review cadence is an attestation plus the event list | folded into #55 |
| Excludes cannot express `not (app AND env)` | intra-scope rows dropped client-side | accepted, not filed |
| Per-IP traffic filters rejected | unknown-endpoint check stays at the subnet level | illumio-mcp-server#47 |

## Common mistakes

| Mistake | Fix |
| --- | --- |
| Reporting a `compliance_score` | The pack has no score. Each requirement is PASS, FAIL, EXCEPTION, ATTESTED or NOT TESTED with its rule. |
| Reading draft policy | `pversion: "active"` on every ruleset call; the cover says "active". |
| Treating a capped flow query as complete | `total_pce_flows == 500` is a lower bound; EXCEPTION, narrow the window. |
| Passing `labels: ["app=x","env=y"]` to `get-workloads` | One string; narrow env from the result. |
| Using `exclude_sources` to remove the scope | Excludes are OR'd per entry; drop intra-scope rows client-side. |
| Counting an all-workloads consumer in a scoped ruleset as broad | Inside a ruleset scoped to the pair it means the pair's own workloads. |
| Quoting requirement text from the matrix | The matrix holds references; quote the official text and cite it. |
| Rendering the deck or dashboard from the tool results | Everything renders from `pack.json`; build it first. |
| Skipping `pack.json` because only a deck was asked for | It is always written; the deck is a view of it. |
| Claiming PCI, DORA or NIS2 compliance | The pack evidences segmentation controls; section 8 lists what it does not cover. |
| Running an isolation to prove T12 | Never. It is an attestation. |
| Skipping the scope confirmation | One combined question at Step 1, every time. |
