# illumio-mcp-skills

Skills building on the Illumio MCP server for Illumio Segmentation.

## Installing the skills

**Claude Code:** the repo is a plugin marketplace; one command installs all nine skills as `/illumio:<name>`:

```
/plugin install illumio --marketplace alexgoller/illumio-mcp-skills
```

**claude.ai and Claude Desktop:** every skill also ships as one zip, `<skill-name>.zip`, from the latest [GitHub release](https://github.com/alexgoller/illumio-mcp-skills/releases) (or `./package.sh`, which writes `dist/`); upload it under Customize > Skills.

All skills need the [illumio-mcp](https://github.com/alexgoller/illumio-mcp-server) MCP server connected to a PCE. [INSTALL.md](INSTALL.md) has the full guide: connecting the server, the plugin, skill folders, one-session loads, Claude Desktop, claude.ai, the document skills, and troubleshooting.

## Releasing

The `Package skills` workflow runs `package.sh` on every push and pull request and keeps the zips as a workflow artifact, so a broken skill layout fails the build. Pushing a tag `vX.Y.Z` creates a GitHub release with every zip attached:

```
git tag v1.0.0 && git push origin v1.0.0
```

The Claude Code plugin (`.claude-plugin/marketplace.json`) reads the skills straight from the repo and carries no version of its own, so a release needs no change there; `claude plugin update illumio@illumio-mcp-skills` pulls main. `claude plugin validate .` checks the manifest.

## Conventions

- Skills call illumio-mcp tools only; gaps become issues on [illumio-mcp-server](https://github.com/alexgoller/illumio-mcp-server). A skill may ship a script that merges and scores the saved tool results (app-profile, rapid-risk-reduction, label-advisor); such a script never talks to the PCE. Writes to the PCE happen only where a skill says so up front (label-advisor's apply mode, labels only, after confirmation).
- Every rendered output follows the [Illumio Field](https://claude.ai/artifact/GnMZFELJUu34V9YQWXRgYn) design system, the visual identity of the Illumio Brand Guidelines (November 2024): Zero Trust Tan and white grounds, Server Slate text, Illumio Orange as the one accent, Montserrat (FK Grotesk where installed), square corners, Server Slate table header rows. Each skill carries the same "Illumio Field" section in its design reference, so a zip stands alone.
- Colour is used only for meaning: Risk Red critical or blocked, Safeguard Green pass or allowed, Circuit Gold warning, System Cyan info. Every dashboard, chart, document table or diagram that uses colour, bold or a tint carries a legend where the colour appears, and decorative colour is one neutral grey.

## Skills

### illumio-pce-assessment

**Directory:** `illumio-pce-security-assessment/`

Generates a comprehensive Illumio PCE security assessment report as a branded `.docx` document. Use this skill whenever you need to analyze, assess, audit, or report on an Illumio PCE environment. The output is a Word document, not a dashboard; the interactive view of the same assessment is illumio-security-dashboard.

**Triggers:** PCE health check, segmentation roadmap, enforcement status report, lateral movement analysis, compliance check, policy gap analysis, ringfencing readiness, or anything involving evaluating the state of an Illumio deployment.

**Prerequisites:**
- The **illumio-mcp** MCP server must be connected with a healthy PCE connection
- The **docx skill** for generating valid Word documents

**Report Sections:**
1. Executive Summary with KPI dashboard
2. Environment Overview (workload inventory, enforcement modes)
3. Security Status & Compliance Findings
4. Custom Policy Compliance (user-defined rules of thumb)
5. Lateral Movement Risk Analysis
6. Infrastructure Services Classification
7. Unmanaged Traffic Analysis
8. Segmentation & Enforcement Roadmap (6 phases)
9. Immediate Action Items
10. Summary

**Data Sources (via illumio-mcp):**
- Workload enforcement status
- Labels & taxonomy
- Rulesets & policy
- Infrastructure services classification
- Lateral movement path detection
- Unmanaged traffic analysis
- Compliance checks (general, PCI-DSS, NIST, CIS)
- Draft vs active policy comparison
- Traffic flow analysis

The report follows Illumio Field (Montserrat with Arial fallback, Server Slate headings, status cells with a legend row) and is saved as a `.docx` file.

### illumio-app-profile

**Directory:** `illumio-app-profile/`

Everything about one application, identified by labels (`app=shop, env=prod`): inbound and outbound traffic by peer and service, workloads with enforcement mode and VEN health, the policy that matches the app from draft or active, blocked flows over time with spikes, and findings with candidate (never provisioned) allow rules.

**Triggers:** tell me everything about app X, app profile, what does app X talk to, who talks to app X, is app X ready for enforcement, what is being blocked for app X.

**Prerequisites:**
- The **illumio-mcp** MCP server, **0.10.0 or later** (`get-traffic-timeline`, VEN health in compact workloads, `get-rulesets` `pversion`/`actor_labels`); older servers work at the cost of one query per timeline bucket
- Read-only: drafts rules as text or a `create-ruleset` call plan, never calls them

**Steps:** connection → labels → workloads (one unfiltered compact call, reused for peer lookup) → traffic summary per direction → rulesets scoped to and naming the app → blocked timeline with spikes → `scripts/app_profile.py` merges and writes the findings → profile.

### illumio-rapid-risk-reduction

**Directory:** `illumio-rapid-risk-reduction/`

What can we block or fence **now** with the least chance of breaking something, and where does the risk sit. Checks labelling readiness first (labels are never assumed complete), triages the estate (unknown sources on admin ports, admin ports crossing environments, internet-exposed listeners, lateral-movement bridge apps, visibility-mode apps that policy already wants to block, identities with wide reach), scores each exposure by blast radius x ease, and produces three views of one result, each opening with a risk map (apps ranked on unmanaged inbound traffic, unmanaged admin-port sources, environment crossings, wide-reach accounts and workloads not enforcing; traffic between environments; override denies not showing in traffic; a generated fix-first list): a one-page plan (block today, fence this week, isolate on demand, watch), a risk report (risk, what was seen, evidence and recommended action per exposure) and a single-file React dashboard in Illumio Field. Every fix is a draft call plan marked `DO_NOT_CALL`: override deny rules for unknown admin-port sources, plain denies for environment crossings, selective ringfences with `deny_consumer: any`, and an isolation runbook per crown-jewel app spelled out as tool calls. Nothing is created or provisioned.

**Triggers:** rapid risk reduction, quick wins, what can we block today, reduce blast radius fast, emergency hardening, incident hardening, ransomware quick wins, what to fence first, 24-hour or 7-day plan, where does the risk sit, risk map.

**Policy views:** provisioned only (default: what the PCE enforces today, the policy the reported decisions come from) or provisioned and draft (the delta: rulesets and rules the draft adds, changes or removes; per exposure whether a draft deny already covers it, a provisioned deny names it yet it reports allowed, or nothing is drafted). Scores use the provisioned rules in both views.

**Prerequisites:**
- The **illumio-mcp** MCP server, **0.13.1 or later** (`find-unknown-endpoints`, `get-traffic-timeline`, `detect-lateral-movement-paths`, `build-identity-graph`)
- Python 3 for `scripts/triage.py` (stdlib only)

**Steps:** the one question → connection → workloads (one unfiltered compact call) → the estate traffic summary and the admin-port flows grouped by app pair and port → lateral movement → unknown sources → identity graph → the provisioned rulesets (plus the draft in the draft view), the draft-to-active comparison and the blocked timeline → `scripts/triage.py` scores, builds the risk map and writes `plan.md`, `call-plans.md`, `report.md` and `dashboard.jsx` from one `plan.json` → present the map, the plan, the dashboard and, on request, the report. Nine data pulls plus the connection check.

**Layout:**
- `SKILL.md` — the one question, PCE budget, steps 0 to 7, verification, older servers
- `references/scoring.md` — exposure classes X1 to X6 and CJ, blast radius and ease tables, buckets, measurement, Illumio semantics
- `references/report-template.md` — the one-page skeleton and the call-plan appendix
- `references/risk-report-template.md` — the risk report: register, risk and recommendation per exposure
- `references/dashboard-spec.md` and `references/dashboard-example.jsx` — the dashboard: colour mapping, data constants, tabs, checklist; the example is also the template the script fills
- `scripts/triage.py` — merge, score, write all three views

### illumio-security-dashboard

**Directory:** `illumio-security-dashboard-skill/`

Generates an interactive single-file React (.jsx) security assessment dashboard for an Illumio PCE environment. Use this skill for interactive security posture visualization, network topology views, lateral movement visualization, or browser-based PCE security status. Not for the Word report; that is illumio-pce-assessment.

**Triggers:** Interactive assessment, security dashboard, visual security report, network topology view, lateral movement visualization, or any request for a browser-based view of PCE security status.

**Prerequisites:**
- The **illumio-mcp** MCP server must be connected with a healthy PCE connection
- The **frontend-design skill** for design quality guidance

**Dashboard Tabs:**
1. **Overview** — KPI cards, enforcement donut chart, compliance cards, app status table
2. **Network Graph** — D3 force-directed graph with risk filtering, legend, detail panel, lateral movement bars
3. **Policy Violations** — Alert banner, violations table, remediation card (conditional on custom rules)
4. **High-Risk Ports** — Visual port cards with severity, connections, affected apps
5. **Unmanaged Traffic** — KPI cards, traffic table, anomaly alerts

**Data Sources (via illumio-mcp):**
- Workload enforcement status
- Labels & taxonomy
- Rulesets & policy
- Infrastructure services classification
- Lateral movement path detection
- Unmanaged traffic analysis
- Compliance checks
- Traffic flow analysis

The dashboard follows Illumio Field and renders as a Claude artifact with D3 network graph visualization.

### illumio-agentic-ai-risk-assessment

**Directory:** `illumio-agentic-ai-risk-assessment/`

Runs an end-to-end agentic AI security and risk assessment against an Illumio PCE: which managed endpoints run agentic AI clients (Claude, ChatGPT, Cursor, Copilot, Codex, Gemini, Windsurf and similar), what internal systems those agents reach and on which ports, what they send outbound and to whom, and whether current policy stops any of it.

**Triggers:** agentic AI risk assessment, AI agent risk, shadow AI assessment, which endpoints run Claude / ChatGPT / Cursor, what are the AI agents talking to, AI agent reach, AI agent Sankey, assess agentic AI in the PCE.

**Prerequisites:**
- The **illumio-mcp** MCP server must be connected with a healthy PCE connection
- Python 3 for `scripts/aggregate_flows.py` (stdlib only)

**Outputs:**
- A ten-section written report: executive summary, scope, endpoint inventory with defining labels, reach into internal systems, external egress, policy posture, risk register (R1 to R11, likelihood x impact), regulatory mapping (DORA, NIS2, EU AI Act, PCI DSS, SWIFT CSCF, HIPAA, GDPR), sequenced Illumio recommendations, appendix flow table
- An interactive Sankey artifact: endpoint to agent process to internal application, with agent, source-kind and regulated-only filters and a sortable flow table
- On request, draft rulesets as `create-ruleset` / `create-deny-rule` call plans. The skill never provisions policy.

**Layout:**
- `SKILL.md` — workflow, label rules, verification checklist, PCE quirks
- `references/agent-catalog.md` — process names, matching rules, vendor egress hints
- `references/risk-rubric.md` — scoring and regulatory mapping
- `references/report-template.md` — report skeleton
- `references/sankey-template.html` — the reach diagram (d3 + d3-sankey)
- `scripts/aggregate_flows.py` — merges sliced `get-traffic-flows` results into one flow table and emits the Sankey data

**Data Sources (via illumio-mcp):**
- Labels and workload inventory
- Traffic flows grouped by process, sliced by label to stay under the PCE's 500-flow query cap
- Process egress discovery
- Workload enforcement status, rulesets, draft versus active comparison, enforcement readiness


### illumio-unknown-endpoints

**Directory:** `illumio-unknown-endpoints/`

Finds the addresses in PCE traffic that the PCE does not know at all, neither as a managed workload nor as an unmanaged workload, profiles what each one does, and suggests the inventory and policy objects that would name it. Read-only; illumio-mcp tools only, no helper scripts. Requires illumio-mcp-server 0.13.0 or later (`find-unknown-endpoints`); the v1.1.0 release of this skill is the version for older servers.

**Triggers:** unknown IPs, rogue hosts, rogue IP addresses, unmapped or uninventoried endpoints, what is talking to my workloads that is not a workload, hosts without a VEN, inventory gaps, scanners hitting workloads, unknown sources allowed into enforced workloads, unknown external destinations.

**Prerequisites:**
- The **illumio-mcp** MCP server must be connected with a healthy PCE connection

**Outputs:**
- A single-file React dashboard in Illumio Field like the other dashboard skills: health banner, KPI cards, findings, unknown sources and destinations tables with policy bars, a subnets view of inventory gaps, suggestions, and a deep-dive timeline when run
- A report: scope line with the query count and truncation, summary counts, findings U1 to U10 (host inside a managed subnet, scanner, admin-port reach, allowed into enforced workloads, uninventoried infrastructure, public source, notable public destination, no IP-list object, volume outlier, unverified counts), unknown sources and destinations tables with address class, IP-list coverage, subnet neighbourhood, peers, ports, policy mix and profile shape, and suggested `create-workload` / `create-iplist` / `create-deny-rule` objects that are never executed
- An opt-in deep dive per endpoint: peer x port x policy table and a spike-marked timeline

**Layout:**
- `SKILL.md` — definitions, workflow Steps 0 to 5, PCE budget (1 query), verification checklist, server gaps, common mistakes
- `references/findings-rubric.md` — endpoint classes, profile shapes, findings U1 to U10, suggestion rules
- `references/report-template.md` — report skeleton

**Data Sources (via illumio-mcp):**
- `find-unknown-endpoints`: one Explorer pull joined server-side against the workload inventory and the draft IP lists, with address class, IP-list coverage, subnet neighbourhood, peers, ports, policy mix and profile shapes per endpoint
- Per-endpoint deep dive (`find-unknown-endpoints ip:` with its timeline) and, on request, `get-traffic-flows` filtered by the address for the process table

### illumio-compliance-evidence

**Directory:** `illumio-compliance-evidence/`

Turns the PCE into audit evidence for the segmentation controls a framework asks for: PCI DSS v4.0.1, DORA (with RTS 2024/1774) and NIS2 (with Implementing Regulation 2024/2690 and the national law). Scope is a list of `app`/`env` pairs. Read-only; illumio-mcp tools plus the docx skill.

**Triggers:** prove or evidence compliance, audit evidence pack, auditor or QSA or regulator request, segmentation proof, are we compliant, show the auditor, PCI CDE evidence, DORA evidence, NIS2 evidence.

**Prerequisites:**
- The **illumio-mcp** MCP server connected with a healthy PCE connection, **0.13.0 or later** (`collect-compliance-evidence`, `find-unknown-endpoints`, `get-events` with `kind` and `resource_changes`, ruleset timestamps); on an older server use the v1.1.0 release of this skill
- The **docx skill** for the Word document

**Outputs** (any set of `json`, `md`, `docx`, `pptx`, `jsx`, all rendered from one `pack.json`):
- `pack.json`: the pack model (scope, tests per pair, requirements, attestations, findings, boundary tables, drift, evidence index with hashes), for GRC tools and the next run's drift
- A Word evidence pack: scope declaration with label hrefs, method, control summary per requirement (PASS, FAIL, EXCEPTION, ATTESTED, NOT TESTED with a legend row), one section per requirement with the evidence tables and the query that produced them, the full test table, attestations, drift since the previous pack, the out-of-scope list, and an evidence index with SHA-256 hashes
- A Markdown twin for diffing between runs, and a zip of the raw tool results
- A PowerPoint deck: title with overall status, scope and method, control summary, one slide per failing or excepted requirement, attestations, drift, out of scope, evidence index, with a legend strip on every status slide
- A React dashboard in Illumio Field: overview, requirements with expandable tests and evidence, tests per pair, boundary traffic with policy bars and the blocked-per-day timeline, attestations, drift, evidence index, with a colour key and a legend in every section

**Layout:**
- `SKILL.md` — inputs, scope confirmation, Steps 0 to 6, verification, server gaps, common mistakes
- `references/tests.md` — tests T1 to T14 with the rules, what `collect-compliance-evidence` computes, what the skill reads, and the query budget
- `references/matrix-pci-dss.md`, `matrix-dora.md`, `matrix-nis2.md` — requirement to evidence mapping with what Illumio does not cover
- `references/pack-schema.md` — the JSON pack model every format renders from
- `references/outputs.md` — the five formats, file names, deck outline
- `references/pack-template.md` — Markdown and Word structure, colours and legend, appendices
- `references/dashboard-example.jsx` — working dashboard with synthetic pack data

**Data Sources (via illumio-mcp):**
- `collect-compliance-evidence`: one call per framework run for all scope pairs, computing T1 to T9, T11 and T14 from active policy (inventory, enforcement, VEN health, providing rules, broad consumers, admitted services with service objects expanded, inbound and outbound boundary flows with the blocked timeline, pending draft changes, events and flows in window)
- `find-unknown-endpoints` for unknown hosts inside scope subnets (T10)
- `get-events kind: "policy"` for the change history with actor and resource changes (T11), `get-rulesets pversion: "active"` per pair for the isolation capability and the ruleset timestamps (T12, T13)

### illumio-label-advisor

**Directory:** `illumio-label-advisor/`

What labels should these workloads have. Never assumes the estate is labelled: reads the label vocabulary (the four standard dimensions plus every custom dimension that has labels), the workload inventory with listening processes and ports, traffic by process and peer, and the infrastructure hubs; mines the hostname convention from the workloads that are already labelled; and proposes one value per missing dimension per workload with a confidence (high, medium, low) and the evidence sentence behind it. Fill gaps only: a label a workload carries is never suggested for or changed, and a disagreement is reported as a conflict. Output is a report that opens with the readiness verdict and a single-file React dashboard in Illumio Field (readiness, suggestions, conventions, conflicts, unresolved, apply plan). Apply mode, on request and after an explicit confirmation with the workload count, creates the missing labels with an exact-match check, assigns the merged label set per workload, verifies, and leaves a log and a rollback plan. Labels only; nothing else on the PCE is touched.

**Triggers:** suggest labels, label the estate, improve labelling, what labels should these workloads have, auto-label, propose role or app or env or loc, apply suggested labels, labelling readiness.

**Prerequisites:**
- The **illumio-mcp** MCP server, **0.13.0 or later** (`group_by` on `get-traffic-flows`, label shorthand in include filters, `detail_level` on `get-workloads`)
- Python 3 for `scripts/advise.py` (stdlib only)

**Layout:**
- `SKILL.md`: suggest and apply workflows, constraints, verification, common mistakes
- `references/inference.md`: the signals, confidence rules, hubs, convention mining, conflicts and limits, stated once
- `references/process-roles.md`: the listening process and port to role table the script reads at run time
- `references/report-template.md`: report skeleton
- `references/dashboard-spec.md`, `references/dashboard-example.jsx`: dashboard contract, Illumio Field rules and the template the script fills
- `scripts/advise.py`: plans the batches, merges the saved results, mines conventions, scores suggestions, writes the report, the plan and the dashboard
- `tests/`: three synthetic estates and the checks the rules are proven on (not in the zip)

**Data Sources (via illumio-mcp):**
- `get-labels usage:true` for the vocabulary and the dimensions
- `get-workloads` compact (inventory) and full in subnet batches (listening processes and ports, OS)
- `get-traffic-flows-summary` once, `get-traffic-flows` grouped by source, destination, port, proto and process per batch of 25 workloads as sources and as destinations
- `identify-infrastructure-services` when app labels exist; otherwise hubs by fan-in
- Apply mode only: `create-label`, `update-workload` (labels field)

**Known gaps (server issues):** [#78](https://github.com/alexgoller/illumio-mcp-server/issues/78) label values resolved by partial match on update, [#79](https://github.com/alexgoller/illumio-mcp-server/issues/79) bulk additive label assignment, [#80](https://github.com/alexgoller/illumio-mcp-server/issues/80) label dimensions, [#81](https://github.com/alexgoller/illumio-mcp-server/issues/81) paging for full workload detail, [#82](https://github.com/alexgoller/illumio-mcp-server/issues/82) workload-level infrastructure detection.

## Research

Notes on ideas that are not skills yet. [research/application-detection.md](research/application-detection.md): automatic application detection by clustering workloads on traffic and process evidence; prior art, algorithms feasible in stdlib Python, hostname token mining, evaluation against already-labelled workloads, and a recommended experimental pipeline. The label advisor deliberately does not cluster; see the note for why and for what an experiment would look like.
