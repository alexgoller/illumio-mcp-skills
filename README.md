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
