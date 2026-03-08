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
