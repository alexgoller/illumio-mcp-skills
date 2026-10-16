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
