# illumio-mcp-skills

Skills building on the Illumio MCP server for Illumio Segmentation.

## Installing a skill

Every skill ships as one zip, `<skill-name>.zip`, holding a single folder with `SKILL.md` inside. Get it from the latest [GitHub release](https://github.com/alexgoller/illumio-mcp-skills/releases), or build it locally with `./package.sh` (writes `dist/`).

- **claude.ai**: Settings > Capabilities > Skills > upload the zip.
- **Claude Code**: `claude --plugin-dir /path/to/<skill-name>.zip`, or unzip it into your skills directory.

All skills need the [illumio-mcp](https://github.com/alexgoller/illumio-mcp-server) MCP server connected to a PCE.

## Releasing

The `Package skills` workflow runs `package.sh` on every push and pull request and keeps the zips as a workflow artifact, so a broken skill layout fails the build. Pushing a tag `vX.Y.Z` creates a GitHub release with every zip attached:

```
git tag v1.0.0 && git push origin v1.0.0
```

## Skills

### illumio-pce-assessment

**Directory:** `illumio-pce-security-assessment/`

Generates a comprehensive Illumio PCE security assessment report as a branded `.docx` document. Use this skill whenever you need to analyze, assess, audit, or report on an Illumio PCE environment.

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

The report is styled with Illumio brand colors and saved as a `.docx` file.

### illumio-app-profile

**Directory:** `illumio-app-profile/`

Everything about one application, identified by labels (`app=shop, env=prod`): inbound and outbound traffic by peer and service, workloads with enforcement mode and VEN health, the policy that matches the app from draft or active, blocked flows over time with spikes, and findings with candidate (never provisioned) allow rules.

**Triggers:** tell me everything about app X, app profile, what does app X talk to, who talks to app X, is app X ready for enforcement, what is being blocked for app X.

**Prerequisites:**
- The **illumio-mcp** MCP server, **0.10.0 or later** (`get-traffic-timeline`, VEN health in compact workloads, `get-rulesets` `pversion`/`actor_labels`); older servers work at the cost of one query per timeline bucket
- Read-only: drafts rules as text or a `create-ruleset` call plan, never calls them

**Steps:** connection → labels → workloads (one unfiltered compact call, reused for peer lookup) → traffic summary per direction → rulesets scoped to and naming the app → blocked timeline with spikes → `scripts/app_profile.py` merges and writes the findings → profile.

### illumio-security-dashboard

**Directory:** `illumio-security-dashboard-skill/`

Generates an interactive single-file React (.jsx) security assessment dashboard for an Illumio PCE environment. Use this skill for interactive security posture visualization, network topology views, lateral movement visualization, or browser-based PCE security status.

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

The dashboard uses Illumio brand colors, DM Sans font, and renders as a Claude artifact with D3 network graph visualization.

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

Finds the addresses in PCE traffic that the PCE does not know at all, neither as a managed workload nor as an unmanaged workload, profiles what each one does, and suggests the inventory and policy objects that would name it. Read-only; illumio-mcp tools only, no helper scripts.

**Triggers:** unknown IPs, rogue hosts, rogue IP addresses, unmapped or uninventoried endpoints, what is talking to my workloads that is not a workload, hosts without a VEN, inventory gaps, scanners hitting workloads, unknown sources allowed into enforced workloads, unknown external destinations.

**Prerequisites:**
- The **illumio-mcp** MCP server must be connected with a healthy PCE connection

**Outputs:**
- A report: scope line with the query count and truncation, summary counts, findings U1 to U10 (host inside a managed subnet, scanner, admin-port reach, allowed into enforced workloads, uninventoried infrastructure, public source, notable public destination, no IP-list object, volume outlier, unverified policy mix), unknown sources and destinations tables with address class, IP-list coverage, subnet neighbourhood, peers, ports, policy mix and profile shape, and suggested `create-workload` / `create-iplist` / `create-deny-rule` objects that are never executed
- An opt-in deep dive per endpoint: peer x port x policy table and a spike-marked timeline

**Layout:**
- `SKILL.md` — definitions, workflow Steps 0 to 8, PCE budget (5 queries), verification checklist, server gaps, common mistakes
- `references/findings-rubric.md` — endpoint classes, profile shapes, findings U1 to U10, suggestion rules
- `references/report-template.md` — report skeleton

**Data Sources (via illumio-mcp):**
- Workload inventory (compact, with interface addresses and managed flag) and IP lists
- Traffic summary (external destinations, blocked, app-to-app), unmanaged-traffic scan filtered against the inventory, process egress
- Per-endpoint grouped flows and timeline (waits on illumio-mcp-server#47)

### illumio-compliance-evidence

**Directory:** `illumio-compliance-evidence/`

Turns the PCE into audit evidence for the segmentation controls a framework asks for: PCI DSS v4.0.1, DORA (with RTS 2024/1774) and NIS2 (with Implementing Regulation 2024/2690 and the national law). Scope is a list of `app`/`env` pairs. Read-only; illumio-mcp tools plus the docx skill.

**Triggers:** prove or evidence compliance, audit evidence pack, auditor or QSA or regulator request, segmentation proof, are we compliant, show the auditor, PCI CDE evidence, DORA evidence, NIS2 evidence.

**Prerequisites:**
- The **illumio-mcp** MCP server connected with a healthy PCE connection (0.10.0 or later for active-policy rulesets)
- The **docx skill** for the Word document

**Outputs:**
- A Word evidence pack: scope declaration with label hrefs, method, control summary per requirement (PASS, FAIL, EXCEPTION, ATTESTED, NOT TESTED with a legend row), one section per requirement with the evidence tables and the query that produced them, the full test table, attestations, drift since the previous pack, the out-of-scope list, and an evidence index with SHA-256 hashes
- A Markdown twin for diffing between runs, and a zip of the raw tool results

**Layout:**
- `SKILL.md` — inputs, scope confirmation, Steps 0 to 8, verification, server gaps, common mistakes
- `references/tests.md` — tests T1 to T14 with calls, fields, pass rules and the query budget (9 per pair plus 8)
- `references/matrix-pci-dss.md`, `matrix-dora.md`, `matrix-nis2.md` — requirement to evidence mapping with what Illumio does not cover
- `references/pack-template.md` — document structure, colours and legend, appendices, optional dashboard

**Data Sources (via illumio-mcp):**
- Workload inventory with enforcement mode and VEN health, active rulesets (scope and actor filters), IP lists
- Boundary traffic in and out of each scope pair by policy decision, traffic summaries
- Unknown endpoints inside scope subnets (via illumio-unknown-endpoints), draft-versus-active drift, PCE events
