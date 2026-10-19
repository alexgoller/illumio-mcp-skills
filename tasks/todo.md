# illumio-unknown-endpoints skill — build plan (2026-10-14)

Request (verbatim): "create a skill to recognize things not mapped as
unmanaged workloads or managed workloads. like rogue/unknown IP adresses
reporting, especially with remarkable traffic profiles, but also general"

Rules: illumio-mcp tools only, read-only, gentle on the PCE, gaps become
server issues (see tasks/lessons.md).

## Plan

- [x] Server facts from the local illumio-mcp-server checkout (Explore
      subagent): how a non-workload endpoint shows in traffic rows, IP-list
      tool, workload IP fields, group_by options, truncation fields
- [x] Design: classification of a flow endpoint (managed / unmanaged /
      IP-list-known / unknown), noise exclusions, traffic-profile shapes
      (scanner, server, egress, admin-port, chatty), findings U1..Un,
      suggestions (unmanaged workload, IP list, VEN, deny) never executed
- [x] `illumio-unknown-endpoints/SKILL.md` — frontmatter, inputs, PCE
      budget, Steps 0..6, verification checklist, gap table, mistakes table
- [x] `references/findings-rubric.md` — U-findings and profile shapes
- [x] `references/report-template.md` — report skeleton
- [x] Server issues for missing capabilities, cited from the gap table
- [x] README entry; package.sh build
- [x] Cold-read test by a fresh agent on scenario questions
- [ ] Commit on branch `unknown-endpoints-skill`, push, open PR

## Review (2026-10-14)

Built: illumio-unknown-endpoints/SKILL.md (Steps 0 to 8, 5-query budget,
opt-in deep dive), references/findings-rubric.md (endpoint classes, five
profile shapes, U1 to U10, suggestion rules), references/report-template.md.
README entry. dist/illumio-unknown-endpoints.zip builds.

Verified:
- Tool shapes read from the local illumio-mcp-server checkout at 49e0788
  (Explore subagent plus direct reads). Found and reproduced in the server
  venv: IP/FQDN/IP-list strings in include_* filters fail SDK validation
  before the query is sent; exclude_* and the object form work. Filed as
  illumio-mcp-server#47.
- find-unmanaged-traffic defines unmanaged as unlabelled and carries no
  policy, FQDN, IP-list or truncation fields; the skill filters it against
  the inventory and joins policy from the summary. Filed #48 with a
  find-unknown-endpoints spec. get-iplists repr ranges filed as #49.
- discover-process-egress schema has no `limit`; the skill says the
  findings list stops at 50 and uses the by_process rollup.
- Cold-read test by a fresh agent: 12 scenarios answered as intended; its
  20 clarity items were all applied (scope query count, window convention,
  truncated_sections in the policy join, app/env granularity for U4 and
  single peer, scope filtering of Step 4 rows, bucket rule, refused calls
  not counted, standalone deep dive, noise counts only, collapsed-ranges
  line, default-list wording, CIDR rule, create-deny-rule, hostname
  dashes, truncated-inventory prefix, per-section top_n cap, U6 coverage
  downgrade, label strings accepted, direction inference, explicit create
  request).

Not verified: no illumio-mcp connection in this session, so nothing ran
against a live PCE.

Also found: illumio-mcp-server shipped #43 to #45 on 2026-10-13, so the
workarounds in the open app-profile PR (#2) are obsolete; that PR needs a
follow-up before merge.

# Release pipeline (2026-10-15)

- [x] `.github/workflows/package.yml`: build zips on push/PR, layout check, artifact, release assets on `v*` tags
- [x] README: installing a skill, releasing
- [x] Local run of package.sh plus the layout check: 6 zips ok
- [x] CI green on the PR: run 38693631703, all steps passed, artifact `skills` uploaded

# illumio-compliance-evidence skill (2026-10-16)

Request: "build this" after the evidence-pack proposal (PCI DSS, DORA, NIS2).
Assumptions (user did not answer): scope comes from label expressions the
user confirms (no fixed key); audience is internal and regulator use, with
a QSA-style evidence index as an appendix rather than a ROC format.

- [x] Server facts: get-rulesets active output fields, get-events filters and
      output, traffic summary with exclude_* labels, get-workloads label
      filter, compliance-check output, VEN fields (Explore subagent)
- [x] SKILL.md: scope confirmation, collection from active policy, binary
      tests, evidence pack (docx) and appendix with hashes, drift re-run,
      verification, gaps, mistakes
- [x] references/matrix-pci-dss.md, matrix-dora.md, matrix-nis2.md
- [x] references/tests.md (binary tests T1..Tn with tool calls and pass rules)
- [x] references/pack-template.md (docx structure, legend convention)
- [x] Server issue: compliance-check scope labels, active policy, NIS2, evidence refs
- [x] README, package.sh
- [x] cold-read test: 12 scenarios as intended, 25 clarity items applied
- [x] PR #6 opened, CI green

## Review (compliance evidence, 2026-10-16)

Built: SKILL.md (Steps 0 to 8, scope as app/env pairs confirmed in one
question, active policy only, 9 queries per pair plus 8), tests.md (T1 to
T14 with calls, fields, pass rules, cap rule, worst-of rule), three
framework matrices with "not covered" lists, pack-template.md (docx
structure, status colours with legend row, drift table, evidence index
with hashes). README entry. Issues #54 (compliance-check evidence mode)
and #55 (get-events audit fields, ruleset timestamps) filed.

Verified: tool shapes from the server checkout at fbe1cce (0.12.0) via a
subagent, including that get-workloads takes one label, get-rulesets
active output is structured without timestamps, excludes are OR'd per
entry, compliance-check reads draft and has no NIS2. Cold-read test by a
fresh agent: all 12 scenarios answered as intended; its 25 clarity items
applied (step ranges, explicit T10 calls, budget incl. get-labels, one
scope rule, timestamps claims removed from matrices, T3/T4/T11 added to
PCI rows, worst-of rule, EXCEPTION definition, T7/T8 clause handling,
cap rule, unscoped_consumers default, in_sync shape, event status field,
T14 raw rows, window end date, skill name, drift table, justification
timing, T3 table, timeline call for detection rows, data-tier input, file
naming, EXCEPTION in chat reply).

Not verified: no PCE connection; no docx was generated in this session.
Framework article numbers are references to check against the official
texts when a pack is assembled, as the matrices say.

# Compliance evidence: five output formats (2026-10-17)

Request: "the skill must be able to provide jsx artifacts, word, markdown and ppt as well as plain json".

- [x] `references/pack-schema.md`: one JSON pack model every format renders from (worst-of rules, evidence refs, drift)
- [x] `references/outputs.md`: json, md, docx, pptx (deck outline, legend strip), jsx; one base name; defaults json+md+docx
- [x] `references/dashboard-example.jsx`: rendered, 7 tabs, 0 errors, legend in every coloured section
- [x] SKILL.md: formats input, Step 8 = pack.json first then renderers, verification items, mistakes; pack-template and README updated
- [x] CI green on PR #6
# Dashboard for illumio-unknown-endpoints (2026-10-15)

Request: "the skill needs to create a similar styled dashboard as the other skills in here".

- [x] Read the dashboard conventions of illumio-daily-assessment and illumio-security-dashboard (React .jsx, inline styles, Illumio palette C, DM Sans, pill TabBar, KPICard, Badge, DataTable, app (env) tuples, /mnt/user-data/outputs path, checklist)
- [x] `references/dashboard-spec.md`: palette and status colours, data constants, banner rule, 6 tabs + conditional Deep dive, components, empty states, output, checklist
- [x] `references/dashboard-example.jsx`: working example with synthetic data
- [x] SKILL.md Step 9, Files table, frontmatter triggers, verification item; README outputs and layout
- [x] Verify: esbuild bundle + headless Chrome, every tab clicked, zero console errors, expected content found, three screenshots inspected
- [x] PR #5 opened, CI green

## Review

Rendered at 1280px: Overview (banner, 8 KPIs, severity bar, top issues), Unknown sources (chips, search, admin ports in red, policy bars with "partial"), Deep dive (stacked policy bars, 3x-median line, spike outlined, worst spike labelled). All seven tabs clicked in headless Chrome with no window errors. The example is 540 lines; it ships inside the skill so the dashboard is reproducible instead of re-derived from prose each run.

# Colour legends across skills (2026-10-16)

- [x] unknown-endpoints dashboard: neutral section strips, attention-based KPI borders, severity-coloured subnet bars, ColourKey on every tab, Legend in every section, LEGEND constant; report template legend line; spec and checklist
- [x] pce-assessment (docx): legend row under status-cell tables, KPI tile caption, colour check
- [x] security-dashboard and daily-assessment: colour key + per-section Legend requirement, neutral accents, checklist items
- [x] agentic-ai: Sankey legend lists every agent in its ribbon colour (dynamic, "other" grouped); report template stacked bar needs a legend
- [x] README convention
- [x] Verified: dashboard example re-rendered, 7 tabs, 0 errors, legend present in every section; Sankey template rendered, legend shows Cursor, ChatGPT, Claude, Codex

# Release v1.1.0 and server issue fixes (2026-10-19)

- [x] Merge PR #5 and #6 (todo.md conflict resolved by keeping both plans), tag v1.1.0, release carries 7 zips incl. illumio-compliance-evidence
- [x] illumio-mcp-server #47 include filters (branch fix/47-include-filters, worktree -wt-47)
- [x] #49 get-iplists as data, pversion, contains_ip (feat/49-iplists-data)
- [x] #55 get-events audit fields, ruleset timestamps (feat/55-events-audit-fields)
- [x] #48 find-unknown-endpoints tool (feat/48-find-unknown-endpoints)
- [x] #54 collect-compliance-evidence tool, nis2 (feat/54-compliance-evidence)
- [x] Review each PR, run the suite on the merged result, merge in order 47, 49, 55, 48, 54, resolve CHANGELOG/server.py conflicts
- [x] Skills updated to the 0.13 tools: PR #8 (unknown-endpoints) and PR #9 (compliance-evidence) merged; new server gaps filed as #61, #62
