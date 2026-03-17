---
name: illumio-daily-assessment
description: "Generate an on-demand daily health and security assessment dashboard for an Illumio Core PCE environment. Produces a single-file React (.jsx) artifact covering blocked traffic, workload health and heartbeat status, security posture drift, data exfiltration indicators, and critical events from the last 24 hours. Use this skill whenever the user asks for a daily check, daily assessment, morning briefing, environment health check, what's going wrong, blocked traffic report, workload status, heartbeat check, security posture overview, exfiltration detection, PCE daily ops, or anything that implies a routine operational review of their Illumio environment. Also trigger when the user says: daily report, daily dashboard, what happened overnight, anything broken, environment status, show me problems, security findings today, blocked flows, offline workloads, agent issues, or health summary. Requires the illumio-mcp MCP server to be connected."
---

# Illumio Daily Assessment Dashboard

Generate a single-file React component (.jsx) that gives an operator a fast, actionable daily health and security view of their Illumio Core PCE. This is not a deep assessment — it's the "morning coffee" dashboard that surfaces what changed, what's broken, and what needs attention right now.

## Prerequisites

- The **illumio-mcp** MCP server must be connected (verify with `check-pce-connection`)
- All date ranges default to the **last 24 hours** unless the user specifies otherwise (some queries use longer lookbacks for context, noted below)

## Philosophy

A daily assessment is different from a full security assessment. The goal here is operational awareness, not strategic planning. Think of it as an SRE's morning check for microsegmentation:

- **Speed over depth**: Surface the top problems, don't enumerate everything
- **Change detection**: What's different from yesterday? New blocked traffic, workloads going offline, enforcement changes
- **Actionable items**: Every finding should suggest what to do about it
- **Red/amber/green at a glance**: The operator should know in 2 seconds if things are OK or on fire

## Data Collection

Collect all data from the PCE before generating the artifact. Run these in the order listed. When results are large, parse with `bash_tool` + `python3`.

### 1. PCE Connection Health

```
illumio-mcp:check-pce-connection
```

If this fails, stop and surface the connection error prominently — the PCE being unreachable is finding #1.

### 2. Blocked & Potentially Blocked Traffic (Last 24h)

This is the most operationally urgent data — traffic that's being dropped or would be dropped.

```
illumio-mcp:get-traffic-flows-summary
  start_date: <24 hours ago>
  end_date: <now>
  policy_decisions: ["blocked", "potentially_blocked"]
  max_results: 200
```

Parse the results to extract:
- Total blocked connection count
- Total potentially blocked connection count
- Top sources and destinations by connection volume
- Top blocked ports/services
- Whether any blocked traffic involves production workloads (cross-reference with labels)

Also run a **7-day lookback** for trend context:
```
illumio-mcp:get-traffic-flows-summary
  start_date: <7 days ago>
  end_date: <now>
  policy_decisions: ["blocked", "potentially_blocked"]
  max_results: 500
```

This lets the dashboard show whether today's blocked traffic volume is normal or spiking.

### 3. Workload Health & Heartbeats

```
illumio-mcp:get-workloads
  online: false
  max_results: 500
```

This returns workloads whose VEN agent hasn't sent a heartbeat recently (offline). Capture:
- Total offline workload count
- Which apps/envs they belong to
- Whether any are in production

Also get the full workload picture for context:
```
illumio-mcp:get-workload-enforcement-status
```

From this, derive:
- Total workloads and enforcement distribution
- Any mixed-enforcement applications (governance risk)
- Apps that changed enforcement mode recently (compare with events)

### 4. PCE Events (Last 24h)

Pull recent events focusing on errors and warnings — these surface agent issues, policy failures, and system problems.

```
illumio-mcp:get-events
  severity: "err"
  timestamp_gte: <24 hours ago ISO 8601>
  max_results: 50
```

```
illumio-mcp:get-events
  severity: "warning"
  timestamp_gte: <24 hours ago ISO 8601>
  max_results: 50
```

```
illumio-mcp:get-events
  status: "failure"
  timestamp_gte: <24 hours ago ISO 8601>
  max_results: 50
```

Combine and deduplicate. Categorize events into:
- **Agent issues**: VEN communication failures, heartbeat timeouts
- **Policy issues**: Rule provisioning failures, policy compute errors
- **System issues**: PCE component errors, capacity warnings
- **Security events**: Tampering alerts, unauthorized access attempts

### 5. Data Exfiltration Indicators

Query for unusually large outbound traffic patterns. The idea is to find workloads sending abnormal volumes to external IPs or unexpected destinations.

```
illumio-mcp:get-traffic-flows-summary
  start_date: <24 hours ago>
  end_date: <now>
  max_results: 500
```

From the full flow data, use Python to:
1. **Aggregate connections per source workload** — flag any source with an unusually high connection count (top 5 by volume)
2. **Identify outbound flows to external/unmanaged IPs** — especially on non-standard ports (not 80, 443, 53)
3. **Flag large fan-out patterns** — a single source connecting to many distinct destinations (>20 unique destinations in 24h is suspicious)
4. **Flag high-risk port usage** — outbound connections on ports commonly used for data exfil: 20/21 (FTP), 22 (SCP/SFTP), 3389 (RDP), 445 (SMB), or any port >10000 to external IPs

This is heuristic-based — clearly label findings as "indicators" not "confirmed exfiltration."

### 6. Unmanaged Traffic (Blind Spots)

```
illumio-mcp:find-unmanaged-traffic
  lookback_days: 1
  min_connections: 5
  top_n: 20
```

These are flows from/to IPs that don't have a VEN. New unmanaged traffic appearing in the last 24h could mean:
- A new system was deployed without an agent
- An attacker is using an unmonitored host
- Infrastructure (load balancers, scanners) is generating noise

### 7. Compliance Snapshot

```
illumio-mcp:compliance-check
  framework: "general"
  lookback_days: 1
```

Quick compliance score for the last 24h. The dashboard shows this as a single number with pass/fail/warning breakdown.

### 8. Security Posture Drift (Optional Context)

If time allows, also run:
```
illumio-mcp:detect-lateral-movement-paths
  lookback_days: 1
  max_hops: 3
```

This identifies any new lateral movement paths that appeared in the last day — new bridge nodes or expanded reachability.

## Data Transformation

Transform raw PCE data into JavaScript data structures embedded as `const` declarations at the top of the .jsx file. The artifact is fully self-contained.

### Data Structures to Build

1. **`summaryKPIs`** — Object with top-level numbers:
   ```js
   {
     totalWorkloads: N,
     onlineWorkloads: N,
     offlineWorkloads: N,
     blockedFlows24h: N,
     potentiallyBlockedFlows24h: N,
     blockedTrend7d: [N, N, N, N, N, N, N], // daily counts
     errorEvents24h: N,
     warningEvents24h: N,
     complianceScore: N, // percentage
     unmanagedSources: N,
     exfilIndicators: N // count of flagged patterns
   }
   ```

2. **`blockedTraffic`** — Array of `{ source, destination, port, proto, connections, policyDecision, severity }` sorted by connections descending

3. **`offlineWorkloads`** — Array of `{ name, hostname, app, env, ip, lastHeartbeat, enforcement }` for all offline workloads

4. **`enforcementStatus`** — `{ visibility_only: N, selective: N, full: N, idle: N, mixedApps: [{app, env, modes}] }`

5. **`criticalEvents`** — Array of `{ timestamp, severity, eventType, status, summary }` sorted by timestamp descending

6. **`exfilIndicators`** — Array of `{ source, destinationCount, connectionCount, topPorts, riskLevel, reason }` for flagged sources

7. **`unmanagedTraffic`** — Array of `{ ip, direction, destination, port, connections, riskNote }` sorted by connections descending

8. **`complianceFindings`** — Array of `{ id, name, detail, status }` from the compliance check

9. **`lateralMovement`** — Array of `{ app, env, reachable, bridge }` if lateral movement data was collected

## React Component Architecture

### Technology Stack
- **React** with hooks (`useState`, `useEffect`, `useRef`)
- **Tailwind-free**: All styling is inline `style={{}}` objects
- **Single file**: Everything in one .jsx file, no separate CSS
- **No external API calls**: All data embedded as constants

### Design System

Use the Illumio brand palette (same as the security dashboard skill):

```javascript
const C = {
  green: "#00C48C",
  greenLight: "#E8FAF3",
  greenDark: "#00A876",
  teal: "#00B4D8",
  tealLight: "#E5F7FB",
  navy: "#1A1F36",
  orange: "#FF6B35",
  orangeLight: "#FFF3ED",
  red: "#E63946",
  redLight: "#FDE8EA",
  gray50: "#F9FAFB",
  gray100: "#F3F4F6",
  gray200: "#E5E7EB",
  gray300: "#D1D5DB",
  gray400: "#9CA3AF",
  gray500: "#6B7280",
  gray700: "#374151",
  white: "#FFFFFF",
};
```

Use Google Fonts `DM Sans` (weights 400–800) loaded via `<link>` in the component body.

### Overall Health Indicator

At the very top of the dashboard, show a single large status indicator that summarizes everything:

- **GREEN ("All Clear")**: No offline production workloads, <5 blocked flows, no error events, no exfil indicators
- **AMBER ("Attention Needed")**: Some offline workloads OR 5-50 blocked flows OR warning events OR minor exfil indicators
- **RED ("Action Required")**: Production workloads offline OR >50 blocked flows OR error events OR critical exfil indicators OR compliance failures

The thresholds above are defaults — the logic should be clearly written so it's easy to adjust.

### Tab Structure

Use a pill-style tab bar with 6 tabs:

1. **Overview** — Health indicator, KPI cards (8 metrics), blocked traffic trend sparkline (7-day), top 5 issues list
2. **Blocked Traffic** — Full blocked/potentially_blocked flow table with search, severity badges, source/dest grouping
3. **Workload Health** — Offline workloads table, enforcement distribution donut, mixed-enforcement alerts
4. **Events & Alerts** — Timeline of error/warning events, categorized by type, severity badges
5. **Exfiltration Watch** — Flagged sources with risk indicators, fan-out visualization, unusual port activity
6. **Blind Spots** — Unmanaged traffic table, new unmanaged sources, compliance score card

### Tab 1: Overview

This is the "glance" view. It should answer "is everything OK?" in under 3 seconds.

- **Health banner**: Full-width bar, green/amber/red with icon and one-line summary
- **KPI row**: 4 cards across — Total Workloads (with online/offline split), Blocked Flows (24h with 7d trend arrow), Error Events, Compliance Score
- **Second KPI row**: 4 more cards — Offline Workloads, Exfil Indicators, Unmanaged Sources, Mixed-Enforcement Apps
- **Trend sparkline**: Small inline SVG showing 7-day blocked traffic trend (just dots and lines, no axis)
- **Top Issues**: Prioritized list of the 5 most urgent findings across all categories, each with a severity badge and one-line description. These are the "fix these first" items.

### Tab 2: Blocked Traffic

- **Summary bar**: Total blocked + potentially blocked counts with percentage of total traffic
- **Filter chips**: By policy decision (blocked vs potentially_blocked), by severity
- **Table**: Source (app/env or IP), Destination (app/env or IP), Port, Proto, Connections, Policy Decision, Severity
- Sort by connections descending by default
- Red-tinted rows for blocked, amber for potentially_blocked
- If >50 flows, show top 50 with "and N more..." footer

### Tab 3: Workload Health

- **Enforcement donut chart**: SVG with visibility_only / selective / full / idle segments
- **Offline workloads table**: Name, App (Env), IP, Enforcement Mode, status badge "OFFLINE"
- **Mixed enforcement alerts**: Cards for each app group where workloads have inconsistent enforcement modes
- **Heartbeat summary**: Count of workloads by last-seen bucket (last 1h, 1-6h, 6-24h, >24h)

### Tab 4: Events & Alerts

- **Event timeline**: Vertical timeline with colored dots (red for errors, orange for warnings)
- **Category filter**: Agent / Policy / System / Security
- **Event cards**: Each shows timestamp, severity badge, event type, and summary text
- **Counts bar**: Total errors, warnings, and failures in the last 24h

### Tab 5: Exfiltration Watch

This tab surfaces suspicious patterns. Frame everything as "indicators" — make it clear these are heuristic flags, not confirmed incidents.

- **Risk summary cards**: Count of high/medium/low risk indicators
- **Flagged sources table**: Source workload, # of unique destinations, # of connections, top ports used, risk level, reason for flag
- **Fan-out visualization**: Simple horizontal bar chart showing top 10 sources by unique destination count
- **Unusual port activity**: Table of outbound connections on non-standard ports (not 80/443/53) to external IPs

### Tab 6: Blind Spots

- **Unmanaged traffic table**: IP, Direction, Connected App (Env), Port, Connections, Risk Note
- **New sources badge**: Highlight IPs that appear only in the last 24h
- **Compliance card**: Score with pass/fail/warning breakdown from the compliance check
- **Lateral movement summary** (if data available): Count of bridge nodes, max reachability, compared to baseline

### Component Inventory

Build these reusable sub-components inside the file:

- **`Badge`**: Pill-shaped `{ label, color, bg }`
- **`SeverityBadge`**: Pre-mapped for critical/high/medium/low/info
- **`KPICard`**: Label, value, subtitle, trend arrow (up/down/flat), accent color
- **`StatusBanner`**: Full-width banner with icon, title, and subtitle — colored by health status
- **`Sparkline`**: Inline SVG sparkline from an array of numbers
- **`DataTable`**: Generic sortable table with column definitions, search box, row coloring callback
- **`DonutChart`**: SVG donut with legend
- **`TimelineEvent`**: Single event in the timeline with dot, timestamp, and content
- **`TabBar`**: Pill-style tab switcher

### Critical: App/Env Tuple Convention

Same as the other Illumio skills — always display applications as `app (env)` tuples. Never show app name alone without the environment context.

### Timestamps

Display all timestamps in the user's local timezone. Show relative time ("2h ago", "14m ago") alongside the absolute timestamp.

## Output

Save the artifact as:
```
/mnt/user-data/outputs/illumio_daily_assessment_<YYYY-MM-DD>.jsx
```

Present to the user with `present_files`. The artifact renders directly in Claude's UI.

## Quality Checklist

Before finalizing, verify:

- [ ] Health banner correctly reflects the worst status across all categories
- [ ] All KPI cards show real numbers from the collected data
- [ ] Blocked traffic table is sorted by connections descending
- [ ] Offline workloads show app (env) tuples, not just hostnames
- [ ] Events are deduplicated and categorized correctly
- [ ] Exfiltration indicators are clearly labeled as heuristic, not confirmed
- [ ] Unmanaged traffic shows direction (inbound/outbound)
- [ ] Sparkline trend is visible and correctly scaled
- [ ] All tabs render without errors
- [ ] No empty state crashes — gracefully handle zero results for any section
- [ ] Compliance score displays even if only "general" framework was used
- [ ] Top Issues list on Overview pulls the most urgent items from all categories
