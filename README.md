# illumio-mcp-skills

Skills building on the Illumio MCP server for Illumio Segmentation.

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

