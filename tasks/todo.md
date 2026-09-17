# illumio-agentic-ai-risk-assessment skill — build plan (2026-09-17)

Source: handoff spec pasted by the user (sections 1 to 12). The spec is complete;
no design questions are open. Assumptions stated in the review section below.

## Plan

- [x] Confirm illumio-mcp tool schemas and output field names from the local
      illumio-mcp-server checkout (Explore subagent)
- [x] `SKILL.md` — frontmatter, purpose, triggers, inputs, workflow steps 1 to 7,
      label rules, quirks, verification checklist, worked example
- [x] `references/agent-catalog.md` — process table, matching rules, vendor egress hints
- [x] `references/risk-rubric.md` — likelihood/impact scale, R1 to R11, overall
      rating, regulatory mapping table
- [x] `references/report-template.md` — ten-section skeleton with one-line openers
- [x] `references/sankey-template.html` — d3 7.9.0 + d3-sankey 0.12.3, three
      columns, filters, tooltip, sortable table, light/dark tokens, RAW/HOSTS/APPS
- [x] `scripts/aggregate_flows.py` — merge per-query JSON, dedupe, classify
      internal vs egress, catalog match, 500-row truncation warning, CSV/JSON out
- [x] Test `aggregate_flows.py` on synthetic fixtures shaped like the MCP output
- [x] Render sankey-template.html with sample data and check it in a browser
- [x] Update README.md with the new skill entry
- [x] Verification pass against section 10 checklist and spec sections 1 to 12
- [ ] Commit

## Review (2026-09-17)

Built: SKILL.md (341 lines), references/agent-catalog.md, risk-rubric.md,
report-template.md, sankey-template.html (742 lines, d3 7.9.0 + d3-sankey
0.12.3), scripts/aggregate_flows.py (stdlib only). README entry added.

Verified:
- Tool schemas read from the local illumio-mcp-server checkout. Corrections
  applied to the spec: traffic output is split format with `num_connections`,
  `src_hostname`, `dst_hostname`, `policy_decision`; `max_results` is pinned
  to 500 server-side and `truncated` only reflects byte trimming, so the cap
  check is `total_pce_flows == 500`; `compare-draft-active` takes
  `resource_type`; enforcement status has no per-workload detail, so Step 2
  uses `detail_level: compact` (a superset of `labels_only`) and Step 5
  reads the population's enforcement split from it.
- Script tested on a synthetic fixture shaped like the real output: 21
  overlapping slices, one harness-wrapped content-block file, one slice at
  the cap. Dedupe takes max not sum, Windows users extracted, policy labels
  dropped, risk-label contradictions found, AND/OR population expressions.
- Generated data spliced into the template and rendered with headless
  Chrome at 1200px; the subagent also verified 400px inside an iframe and
  the dark theme.
- Cold-read test by a fresh agent answered 12 scenario questions from the
  skill files alone; its five clarity suggestions were applied.

Not verified: no illumio-mcp tools were available in this session, so the
worked example (org 5636114) was not reproduced against the live PCE.

Deviation from the spec: Step 2 uses `compact` instead of `labels_only`
(reason above); the script splices the Sankey instead of a manual paste.
