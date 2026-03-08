---
name: illumio-pce-assessment
description: "Generate a comprehensive Illumio PCE security assessment report as a branded .docx document. Use this skill whenever the user asks to analyze, assess, audit, or report on their Illumio PCE environment, microsegmentation posture, Zero Trust Segmentation status, enforcement readiness, or policy coverage. Also trigger when the user mentions: PCE health check, segmentation roadmap, enforcement status report, lateral movement analysis, compliance check, policy gap analysis, ringfencing readiness, or anything involving evaluating the state of an Illumio deployment. The skill produces a multi-section Word document using Illumio brand colors covering environment overview, security findings, policy compliance against custom rules of thumb, lateral movement risks, infrastructure service classification, unmanaged traffic blind spots, and a phased enforcement roadmap. Requires the illumio-mcp MCP server to be connected."
---

# Illumio PCE Security Assessment Report

Generate a professional, branded Word document that comprehensively assesses an Illumio PCE environment's security posture, policy coverage, enforcement status, and provides a phased roadmap to full Zero Trust Segmentation.

## Prerequisites

- The **illumio-mcp** MCP server must be connected and the PCE connection must be healthy (verify with `check-pce-connection`)
- The **docx skill** (`/mnt/skills/public/docx/SKILL.md`) must be read before generating the report — it contains critical rules for creating valid .docx files with the `docx` npm package

## Workflow

Follow these steps in order. Each step gathers a specific data dimension from the PCE. Run all data collection before starting the report generation.

### Step 1: Verify PCE Connectivity

```
illumio-mcp:check-pce-connection
```

If this fails, stop and inform the user. The MCP server credentials or network may need attention.

### Step 2: Collect Data (All Steps Required)

Run each of these MCP tool calls. When the result is too large for context, use `bash_tool` with `python3` or `grep` to parse the JSON from the tool results file.

#### 2a. Workload Inventory & Enforcement Status

```
illumio-mcp:get-workload-enforcement-status
```

This returns the full breakdown of workloads by app, environment, enforcement mode, and flags mixed-enforcement applications. Capture:
- Total workload count
- Enforcement mode distribution (visibility_only, selective, full, idle)
- Per-application enforcement breakdown
- Mixed-enforcement app groups (these are a governance risk)

#### 2b. Labels

```
illumio-mcp:get-labels  (max_results: 500)
```

Parse the label taxonomy to understand the organizational model (role, app, env, loc, bu, etc.). Look for:
- Label key types in use
- Inconsistencies (e.g., duplicate env values like "prod" vs "prd")
- Stale or test labels
- Unlabeled workloads (from the workload data cross-referenced with labels)

#### 2c. Rulesets & Policy

```
illumio-mcp:get-rulesets  (max_results: 100)
```

Capture existing rulesets, their scopes, rules (allow and deny), and note:
- Total ruleset count
- Whether ringfence rulesets exist
- Scope of each ruleset (global vs application-scoped)
- Deny rules in place

#### 2d. Infrastructure Services

```
illumio-mcp:identify-infrastructure-services  (lookback_days: 90, top_n: 20)
```

Returns a ranked list of applications by infrastructure score, identifying which apps are Core Infrastructure, Shared Services, or Standard Applications. These determine the ringfencing priority order.

#### 2e. Lateral Movement Paths

```
illumio-mcp:detect-lateral-movement-paths  (lookback_days: 30, max_hops: 4)
```

Identifies articulation points (bridge nodes) and reachability metrics. These are the most critical lateral movement risks — if compromised, they connect otherwise-isolated app groups.

#### 2f. Unmanaged Traffic

```
illumio-mcp:find-unmanaged-traffic  (lookback_days: 30, min_connections: 10, top_n: 30)
```

Finds traffic from/to IP addresses not paired with a VEN agent. These are policy blind spots. Flag unusual patterns (e.g., outbound RDP from servers, unexpected external IPs).

#### 2g. Compliance Check

```
illumio-mcp:compliance-check  (framework: "general", lookback_days: 30)
```

Returns a compliance score and specific findings (pass/fail/warning/info). The framework can be changed to "pci-dss", "nist", or "cis" if the user specifies a regulatory context.

#### 2h. Draft vs Active Policy

```
illumio-mcp:compare-draft-active  (resource_type: "all")
```

Shows pending policy changes that haven't been provisioned yet.

#### 2i. Custom Rule-of-Thumb Validation (User-Specific)

The user may provide custom security rules of thumb (e.g., "RDP/SSH must go through jumphost", "no direct internet access from DB tier", "PCI workloads must be fully enforced"). For each rule, query the relevant traffic flows:

```
illumio-mcp:get-traffic-flows-summary
  start_date: <90 days ago>
  end_date: <today>
  include_services: [{"port": <relevant_port>, "proto": "tcp"}]
```

Compare the observed traffic against the stated policy to identify violations. For jumphost rules specifically, look for:
- Direct SSH (22) or RDP (3389) from user endpoints to servers (violation)
- SSH/RDP from endpoints to jumphost (compliant)
- SSH/RDP from jumphost to servers (compliant)

#### 2j. Potentially Blocked Traffic

```
illumio-mcp:get-traffic-flows-summary
  start_date: <90 days ago>
  end_date: <today>
  policy_decisions: ["potentially_blocked", "blocked"]
```

These flows would be blocked if enforcement were enabled. They highlight what would break during enforcement rollout and need explicit allow rules.

### Step 3: Generate the Report

Read the docx skill first:
```
view /mnt/skills/public/docx/SKILL.md
```

Then generate the .docx using `docx-js` (npm package `docx`). Install if needed: `npm install -g docx`.

## Report Structure

The report should contain these sections. Adapt based on available data — skip sections where data is insufficient.

### Cover Page
- Title: "ILLUMIO PCE — Environment Security Assessment"
- Subtitle: "Policy Status, Enforcement Readiness & Segmentation Roadmap"
- Date and classification

### 1. Executive Summary
- KPI dashboard (total workloads, applications, compliance score, policy coverage %)
- Overall risk assessment in prose

### 2. Environment Overview
- **Workload inventory table**: app, env, workload count, enforcement mode, mixed flag, risk rating
- **Enforcement mode distribution**: counts and percentages with status indicators
- **Mixed enforcement applications**: highlight inconsistencies per app group

### 3. Security Status & Compliance Findings
- **Compliance assessment table**: check ID, name, detail, pass/fail status
- **Existing rulesets summary**: what rules exist, scope, gaps
- **High-risk port exposure table**: port, protocol, affected apps, connections, risk level

### 4. Custom Policy Compliance (User Rules of Thumb)
- For each user-provided rule, show:
  - **Compliant traffic table**: flows that follow the rule
  - **Violation traffic table**: flows that break the rule (highlighted in red)
  - Prose analysis and remediation recommendations

### 5. Lateral Movement Risk Analysis
- **Bridge nodes table**: articulation points with reachability counts
- **Reachability ranking table**: apps sorted by how many other apps they can reach
- Prose analysis of the most dangerous lateral movement paths

### 6. Infrastructure Services Classification
- **Infrastructure services table**: app, score, tier, pattern, in/out degree
- Explanation of the segmentation priority order

### 7. Unmanaged Traffic Analysis
- **Unmanaged sources table**: source IP, destination app, port, connections
- **Unmanaged destinations table**: source app, destination IP, port, connections
- Flag anomalies and recommend remediation

### 8. Segmentation & Enforcement Roadmap
- **Phase 1 — Foundation & Visibility (Weeks 1–4)**: Label cleanup, IP list creation, traffic validation
- **Phase 2 — Core Infrastructure Policy (Weeks 5–8)**: Policy core infra services, jumphost rules, database access rules
- **Phase 3 — Application Ringfencing (Weeks 9–16)**: Ringfencing table with priority order based on infrastructure score
- **Phase 4 — Selective Enforcement (Weeks 17–24)**: Move visibility_only to selective, add deny rules
- **Phase 5 — Full Enforcement (Weeks 25–36)**: Move selective to full, validate coverage >95%
- **Phase 6 — Continuous Governance (Ongoing)**: Monthly reviews, KPIs, change management

### 9. Immediate Action Items
- Prioritized table: action, impact, effort, priority (CRITICAL/WARNING/INFO)
- Focus on items achievable within 2 weeks

### 10. Summary
- Concise closing with the 3 most critical findings and the roadmap timeline

## Branding & Styling

Use Illumio brand colors throughout:

| Purpose | Color | Hex |
|---------|-------|-----|
| Primary brand green | Illumio Green | `00C48C` |
| Dark text / headers | Illumio Dark Navy | `1A1F36` |
| Teal accent | Illumio Teal | `00B4D8` |
| Warning | Illumio Orange | `FF6B35` |
| Critical / alert | Illumio Red | `E63946` |
| Light background | Light Green BG | `F0F7F4` |
| Body text gray | Gray | `6B7280` |

### Status Cells
Use colored cells for status indicators:
- **CRITICAL / FAIL / High Risk**: Red background (`E63946`), white text
- **WARNING / Medium Risk**: Orange background (`FF6B35`), white text
- **PASS / OK / Enforced / Low Risk**: Green background (`00C48C`), white text
- **INFO / In Progress**: Teal background (`00B4D8`), white text

### Typography
- Font: Arial throughout
- Headings: Bold, Illumio Dark Navy, H1 at 32pt, H2 at 26pt
- Body: 20pt (10pt), Illumio Dark Navy
- Table headers: White text on Illumio Dark Navy background
- Page header: Green bottom border, italic gray text with "Confidential" in red
- Page footer: Gray top border with page numbers

### Tables
- Use thin gray borders (`E5E7EB`)
- Cell margins: 60 top/bottom, 100 left/right
- Always set both `columnWidths` and cell `width` in DXA
- Use `ShadingType.CLEAR` for fills (never SOLID)

### KPI Dashboard
For the executive summary, create a 4-cell table with no borders, each cell a different brand color, containing a large number and a small label. This creates a visual dashboard effect.

## Adapting the Report

The report template above is a starting point. Adapt based on:

- **User context**: If the user specifies a regulatory framework (DORA, NIS2, PCI-DSS), run the compliance check with that framework and add a dedicated compliance section
- **Scope**: If the user asks about a specific application or environment, scope all queries accordingly
- **Depth**: For a quick health check, reduce to sections 1, 2, 3, and 9. For a full assessment, include all sections
- **Custom rules**: Always ask the user if they have rules of thumb (jumphost policies, network zoning, etc.) and validate against observed traffic
- **Audience**: For C-level, emphasize the executive summary and roadmap. For technical teams, include more traffic flow detail

## Output

Save the final report as:
```
/mnt/user-data/outputs/Illumio_PCE_Security_Assessment_<YYYY-MM-DD>.docx
```

Validate with:
```bash
python /mnt/skills/public/docx/scripts/office/validate.py <output_path>
```

Present to the user with `present_files` and provide a brief summary of the key findings.
