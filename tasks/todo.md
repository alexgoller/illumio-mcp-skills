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

# illumio-rapid-risk-reduction (issue #10, 2026-11-04)

Spec: skills issue #10. Server is 0.13.1 (released 2026-10-31); `emergency-isolate-application`
is an MCP prompt, not a tool, so the runbook spells out its tool calls.

- [x] Ground truth: tool schemas dumped from the 0.13.1 registry; output shapes of summary,
      timeline, lateral-movement, infra, unknown-endpoints, identity graph, workloads, rulesets,
      ringfence dry run (shapes.md in scratchpad)
- [x] `references/scoring.md`: triage classes X1-X6, blast radius x ease, buckets today/week/on-demand
- [x] `references/report-template.md`: one-page plan skeleton, call-plan blocks marked DO_NOT_CALL
- [x] `scripts/triage.py`: merges saved results, scores, writes plan.json, plan.md, call-plans.md;
      never talks to the PCE; tolerant of missing files
- [x] Synthetic fixture in the scratchpad exercising every class; run the script; read the output
- [x] `SKILL.md`: one question, PCE budget, steps 0-7, verification, older servers
- [x] README entry, package.sh produces the zip, layout check
- [x] Cold-read test by a fresh agent (10 scenarios), fix clarity gaps
- [x] PR #12, CI green, closes #10
- [x] Fold PR #11's grouped admin-port query into #12 (ports per crossing), close #11 on the owner's instruction

## Review

Built from the 0.13.1 registry (schemas dumped from a worktree of origin/main) and an
Explore agent's field-level map of nine tool outputs. `emergency-isolate-application` turned
out to be an MCP prompt, not a tool, so the runbook spells out its calls. Script verified on a
synthetic fixture covering every class (2 today, 6 this week, 2 runbooks, 3 watch) and on a
workloads-only fixture (empty plan, missing inputs named). Cold-read by a fresh agent found 15
gaps, 3 of them contradictions (stop vs continue on an old server, narrow vs annotate on a
capped query, a ringfence ease the sample did not reproduce); all fixed in script and docs.
Not run against a live PCE.

# Rapid risk reduction: dashboard and risk report (2026-11-04)

Requests: "add a jsx dashboards similar to the ones we did before to the skill" and "make this a
report too, where we would see the risk and the tool recommends what to do".

- [x] `scripts/triage.py` writes `report.md` (executive summary, risk register, risk / what we saw /
      evidence / recommendation / rollback per exposure, watch items, runbooks, baseline, method)
- [x] `scripts/triage.py` writes `dashboard.jsx` by filling the DATA block of
      `references/dashboard-example.jsx`; the example carries the fixture data and is the template
- [x] `references/dashboard-spec.md` (shared conventions, colour mapping, data constants, tabs,
      checklist) and `references/risk-report-template.md`
- [x] SKILL.md: three views from one plan.json, Step 8 Present, files table, verification;
      README entry; description kept under 1024
- [x] Verified: both fixtures render all 7 tabs with 0 errors and a legend per section;
      screenshots of Overview, Block today and Baseline inspected; example DATA block equals a
      fresh run
- [x] PR #15, CI green

## Review

One `plan.json` feeds plan.md, report.md and dashboard.jsx, so the three cannot disagree. The
dashboard is generated, not hand-built: the example file doubles as the template. The empty
fixture renders every tab with one grey sentence per section and a green banner.

# Rapid risk reduction: risk map (2026-11-05)

Request: the handover in `tasks/handover/risk-map-handover-bundle.zip` (ignored in git):
add a risk map (first dashboard tab, plan.md line, report.md section) ranked on unmanaged
inbound, unmanaged admin sources, environment crossings, wide-reach accounts and workloads not
enforcing; public sources are a footnote. Fix the eight bugs in section 6 first. Test data:
`bundle/inputs` (demo100, not committed). No PCE calls.

Before state on demo100 (current main): 107 lines (94 X1, 13 X2), 0 today, 107 week, 85 watch,
10,717,516 allowed connections would stop, 0 crown jewels, 6 impossible `env=-` crossings.

## Section 6 fixes (each with a before/after on demo100)
- [x] 6.1 `-` is not an environment in `x2_env_crossings` (13 X2 lines become 7)
- [x] 6.2 `admitting_rules` honours scopes and `unscoped_consumers`
- [x] 6.3 baseline wording uses `bucket`; resolution note separate
- [x] 6.4 `unknown` cap flagged when `totals.returned` < `totals.unknown_endpoints`
- [x] 6.5 X1 IP lists split: public / internal (review) / on a named list (warning); X2 denies
      warn about Kerberos, LDAP, SMB to domain controllers
- [x] 6.6 `--lateral-days`, header states the shorter window; Step 3 fallback in SKILL.md
- [x] 6.7 crown jewels default to top three `--prod-env` apps by `risk_rank_score` when no
      bridges exist; header says so
- [x] 6.8 capped admin map: report the span covered (`first_detected`/`last_detected`); SKILL.md
      skips the re-pull when the rows already sit inside one day

## Risk map
- [x] `risk_map()` in triage.py: headline, apps (bands by percentile, `risk_rank_score`),
      env_matrix, rule_drift (override denies only, three shapes, `rule_updated_at`,
      `override_denies_unchecked`), fix_first (evidence-driven, identify before block for
      internal sources), optional `draft_active.json` (`total_pending_changes`)
- [x] Expected on demo100: 101 lines, 10,511,869 allowed would stop (today/week is 79/22, not 0/101: see
      the review); headline 216/0/206/10; 94 X1
      (14 internal, 80 public); 19 of 23 wide reach; top apps pos (PCI) 19, payment 18, ad 17,
      ordering (Production) 17; largest crossing Users to Production 57,107,172 / 2,668,431;
      drift 9: 1,673,028, 3: 675,127, RF-ordering-Production 6,709; unchecked 7
- [x] Re-run with public X1 lines removed: pos (PCI) 20, ordering (Production) 18, payment 18,
      ad 17, ecomm 17; no "public" on the tab
- [x] Dashboard: "Risk map" first tab (takeaway, 4 KPIs, shaded grid of 12 apps, env matrix,
      drift table when non-empty, fix first); legends; readable at 400px; empty states
- [x] plan.md line after the totals; report.md "Where the risk sits" after the summary
- [x] Docs: SKILL.md (description, overview, Step 3 fallback, Step 6 ninth pull, Step 8,
      Verification), scoring.md (map section, not the plan score), dashboard-spec.md,
      dashboard-example.jsx, report-template.md, risk-report-template.md
- [x] Render demo100 and empty data: every tab, 0 console errors; screenshots inspected
- [x] Section 8 decided from Illumio semantics and the data, on Alex's instruction (no question
      asked): selective reports everything a deny does not catch as allowed, so allowed traffic
      that no draft allow rule admits on a wholly selective side is "allowed, no rule" and
      deny-safe; internal X1 sources stay override deny in the call plan but always sit in
      "this week: identify first"; skill palette; ninth pull (compare-draft-active) added
- [x] Labelling never assumed: readiness verdict (ready / partial / not ready) in every header,
      the script no longer exits without app/env columns, "label first" leads when unlabelled
      workloads are the majority
- [x] PR #16; server issues illumio-mcp-server #70 to #75 filed

## Review

Before, on demo100: 107 lines (6 impossible `env=-` crossings), 0 today, 107 week, no crown
jewels, one IP list holding all 94 sources, "13. ordering | prod" cited as admitting crossings
it cannot admit. After: 101 lines (94 X1, 7 X2), 79 today (public sources nothing admits, on
wholly selective destinations), 22 this week (14 internal sources to identify first, 1 public
source an allow rule admits, 7 crossings with admitting rules), 3 runbooks defaulted from the
map (pos PCI, payment, ad), 85 watch, 10,511,869 allowed connections would stop. Headline
216/0/206/10, 94 sources (14 internal, 80 public), 19 of 23 wide reach, top apps pos (PCI) 19,
payment 18, ad 17, ordering (Production) 17, largest crossing Users to Production 57,107,172 /
2,668,431, drift 9: 1,673,028, 3: 675,127, RF-ordering-Production 6,709 (changed inside the
window), 7 unchecked; readiness partial (10 flowpilot workloads without env). Without public
sources: pos (PCI) 20, ordering (Production) 18, payment 18, ad 17, ecomm 17, 0 today, and the
word "public" is nowhere on the tab. All four data sets (demo100, demo100 without public
sources, the synthetic fixture, workloads only) render eight tabs with no console errors and a
legend in every section; screenshots of the Risk map at 1280px and 400px inspected. The
example's DATA block equals a fresh fixture run. The description is under 1024 characters and
package.sh builds. Not run against a live PCE; the "allowed on selective" rule is inferred from
enforcement modes and the draft rules, and flagged as such in scoring.md.

# Rapid risk reduction: provisioned and draft policy views (2026-11-05)

Request (forwarded from David Killian, verbatim): "If it could have 2 modes. Just look at
provisioned policy. And look at both provisioned and policy in draft view (to see the delta
between what exists, and what work is left to do)."

Design: the triage scores against the **provisioned** (active) policy in both views, because
the reported policy decisions in the traffic come from the provisioned policy. The draft view
reads the draft as well and reports the delta: rulesets and rules new, changed or removed in
the draft, and for every exposure whether a provisioned deny already names it (yet it reports
allowed), a draft deny covers it (work left: provision), or nothing does (work left: draft).

## Plan

- [x] triage.py: `--policy provisioned|draft`; `rulesets.json` must be pversion active (exit
      otherwise); draft view reads `rulesets_draft.json`; `draft_active.json` in both views
- [x] triage.py: `covering_denies(rs, line)` for X1 (IP-list consumer), X2 (env consumer) and
      ringfences (scoped ruleset with a deny to all workloads); `policy_delta` (rulesets and
      rules new/changed/removed by normalised href, new rules by kind, pending count,
      exposures drafted/provisioned/none); per-line `cover` and `policy_state`
- [x] triage.py: wording moves from "draft rule" to "provisioned rule" where a decision is
      explained; drift wording exact (provisioned override denies); draft-view sentences in
      header, map line, takeaway, fix first, actions, call-plan notes
- [x] Dashboard template: `scope.policyView`, `riskMap.policy`; Risk map tab "Policy" strip
      (provisioned line, or the delta tiles in the draft view); line state badge; legends
- [x] Fixtures: rulesets.json as active for all four sets; fixture draft with a new RRR
      ruleset, a changed rule and a new ringfence; draft_active.json; demo100 draft equal to
      active (delta zero); run_all.sh runs both views
- [x] Verify: demo100 provisioned view reproduces 101 lines, 79 today, 22 week, drift 9/3/
      6,709; draft view on identical draft says so; fixture draft view shows the delta; all
      renders 0 errors with legends; screenshots inspected; DATA block of the example equals
      a fixture draft-view run
- [x] Docs: SKILL.md (Step 0 question, Step 6 pulls, Step 7 flag, Step 8, Verification,
      Mistakes, description), scoring.md section 9, dashboard-spec.md, report-template.md,
      risk-report-template.md, README.md; package.sh builds
- [x] Branch, PR, memory

## Review

Both views run on the four data sets. demo100 provisioned view: unchanged 101 lines, 79
today, 22 this week, 3 runbooks, 85 watch, drift 3 rows (9., 3., RF-ordering-Production),
and 12 of 101 exposures already named by a provisioned deny (the pos Staging and ordering
Production ringfence denies and the threat-feed override deny; all reported allowed, which
is the drift finding seen from the exposure side). demo100 draft view with a draft equal to
active: "the draft equals the provisioned policy", 0 drafted, 89 to draft. Synthetic
fixture draft view: draft adds RRR-2026-10-20 and RF-ad-prod (4 rules), changes Core-AD
(1 rule), 4 pending; 3 exposures drafted (ad ringfence, the internal source, mgmt->prod),
1 provisioned but reported allowed (the public source, named by RF-shop-prod's Any deny),
4 to draft; the drafted lines say "provision the drafted ... in ...". Two cover rules were
tightened after the first run: a deny names a crossing only through env labels or all
workloads (a quarantine-label or OT-label deny no longer counts), and a deny with named
services (telnet, S-SSH) is listed as unresolved, not as a cover (it had marked all 101
demo100 lines). All six outputs render eight tabs with 0 errors and a legend per section;
Risk map at 1280 and 400 px and the This week tab inspected. The example's DATA block
equals a fresh fixture draft-view run; description 1017 chars; package.sh builds. Server
issue #76 filed (find-unknown-endpoints resolves ip_lists against the draft). Not run
against a live PCE.

## 2026-11-05 Install documentation (INSTALL.md, PR #18)

- [x] Verify how Claude Code 2.1.318 loads a skill: zip via `--plugin-dir` (session, `<folder>:<skill>`), `--plugin-url` from a release asset (`url-0-<folder>:<skill>`), folder under `.claude/skills/` (folder name is the invocation name), folder of bare skills (not loaded), marketplace manifest at the repo root (all eight as `illumio:<name>`)
- [x] Read the server's Claude Code and Claude Desktop install blocks
- [x] Confirm docs facts (claude-code-guide agent): skill dirs and precedence, `--plugin-url`, marketplace manifest, `document-skills@anthropic-agent-skills`, `frontend-design@claude-plugins-official`, mcp scopes, Desktop Code tab reads `claude_desktop_config.json`
- [x] Add `.claude-plugin/marketplace.json` (one plugin `illumio`, no version, `strict: false`), validated with `claude plugin validate .`, installed and uninstalled locally
- [x] Write `INSTALL.md`: prerequisites and server-version table, Claude Code (server, routes A to D, check, document skills, dashboards), Claude Desktop (chat and Cowork, Code tab), claude.ai, troubleshooting
- [x] README: install section points at INSTALL.md with the one-line plugin install; Releasing notes the manifest needs no version bump
- [x] Verify: package.sh still builds eight zips; every Claude Code command in the doc was run once except `claude mcp add` (needs a server)
- [x] PR #18 merged 2026-11-05 (after #17); `claude plugin install illumio --marketplace alexgoller/illumio-mcp-skills` run against GitHub from the repo directory: all eight skills listed as `illumio:<name>`, then removed again

### Review
One manifest file turns the repo into a marketplace, which replaced the README's old `--plugin-dir x.zip` advice (true, but session-only and namespaced `x:x`). "Unzip it into your skills directory" was also true but hid that the folder name becomes the invocation name, which bites for the two directories named differently from their skills. Desktop and claude.ai menu paths come from the help centre, not from a local test. A `&&` chain that failed at `git checkout` silently skipped the todo append in the first attempt; the plan is recorded here after the merge.

## 2026-11-06 Illumio Field design across all skills

Finding: no skill followed Illumio Field. Seven rendering skills shared an older palette (green `#00C48C` labelled "Illumio primary", navy `#1A1F36`, orange `#FF6B35`, teal `#00B4D8`, Tailwind greys, DM Sans or Inter, rounded cards, pill badges); the docx rules used Arial and "Illumio Dark Navy". app-profile renders text only.

- [x] One "Illumio Field" block, identical in every rendering skill (seven copies, diffed against the source): tan and white grounds, Server Slate text, `#D6D7D7` borders, Illumio Orange accent only, status red `#BE122F` / green `#166644` / gold `#F97607` and `#FFA22F` / cyan `#2D454C`, Montserrat, square corners, slate table header rows
- [x] Dashboards: `const C` replaced in security-dashboard and daily SKILL.md, unknown-endpoints spec and example, compliance example, rapid-risk-reduction example (triage.py template) and spec; DM Sans to Montserrat; radii 0 and 2 only; legends and colour keys renamed
- [x] Documents: pce-assessment docx rules, compliance pack-template and outputs (docx and pptx), agentic-ai report template and Sankey (light theme only; the dark theme had no Field definition)
- [x] README convention names Illumio Field; the agentic-ai layout no longer lists two files that never existed
- [x] Verify: rapid-risk-reduction six runs rendered (48 tabs, no errors, legend on every coloured section, example equals the generated file); unknown-endpoints and compliance examples rendered (7 tabs each, no errors); Sankey rendered with filters exercised; screenshots at 1280 and 400 inspected; no old hex, DM Sans or pill left in any skill; package.sh builds eight zips; descriptions unchanged

### Review
Four agents in four worktrees, one skill group each, merged without a conflict; the shared block and palette were written once and inserted verbatim, which is what made the seven copies identical. Judgement calls to look at: the daily health banner's middle state is Circuit Gold with slate text; the Sankey's first two series (Server Slate, System Cyan) are close in hue, named by the legend and chips; KPI numbers in rapid-risk-reduction use weight 300 like the title.
