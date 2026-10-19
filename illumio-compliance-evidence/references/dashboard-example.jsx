import React, { useState, useMemo } from "react";

// Worked example of outputs.md "jsx" with synthetic data. A real run replaces
// the DATA block with the content of pack.json (see pack-schema.md).

const C = {
  green: "#00C48C", greenLight: "#E8FAF3", greenDark: "#00A876",
  teal: "#00B4D8", tealLight: "#E5F7FB",
  navy: "#1A1F36",
  orange: "#FF6B35", orangeLight: "#FFF3ED",
  red: "#E63946", redLight: "#FDE8EA",
  amber: "#FEF3C7", amberDark: "#92400E",
  gray50: "#F9FAFB", gray100: "#F3F4F6", gray200: "#E5E7EB", gray300: "#D1D5DB",
  gray400: "#9CA3AF", gray500: "#6B7280", gray700: "#374151", white: "#FFFFFF",
};

// ==== DATA ====
const pack = {
  schema: "illumio-compliance-evidence/1", framework: "pci-dss", framework_version: "v4.0.1",
  scope_name: "CDE prod", run_at: "2026-10-17T09:30:00+02:00", run_number: 3, previous_run_at: "2026-09-17T09:12:00+02:00",
  pce: "pce.example.com:8443", org_id: 1, pce_version: null, server_version: "0.12.0",
  window: { start: "2026-07-19", end: "2026-10-17", days: 90 }, queries: 35, policy_version: "active", overall: "FAIL",
  disclaimer: "Evidence of segmentation controls collected from the Illumio PCE. Supports the controls listed; not a certification; the out-of-scope list says what it does not claim.",
};
const scope = {
  pairs: [
    { app: "pay", env: "prod", app_href: "/orgs/1/labels/12", env_href: "/orgs/1/labels/3", workloads: 6, managed: 6, data_tier: false },
    { app: "pay-db", env: "prod", app_href: "/orgs/1/labels/14", env_href: "/orgs/1/labels/3", workloads: 3, managed: 3, data_tier: true },
    { app: "tokenizer", env: "prod", app_href: "/orgs/1/labels/19", env_href: "/orgs/1/labels/3", workloads: 2, managed: 1, data_tier: true },
  ],
  connected_systems: ["jump/prod"], confirmed_by: "Alex Goller", confirmed_at: "2026-10-17T09:05:00+02:00",
};
const tests = [
  { id: "T1", name: "Scope inventory", scope: "pair", rule: "every pair has at least one workload", result: "PASS",
    per_pair: { "pay/prod": { result: "PASS", measured: "6 workloads", evidence: ["05-get-workloads-pay-prod.json"] }, "pay-db/prod": { result: "PASS", measured: "3 workloads", evidence: ["06-get-workloads-pay-db-prod.json"] }, "tokenizer/prod": { result: "PASS", measured: "2 workloads", evidence: ["07-get-workloads-tokenizer-prod.json"] } } },
  { id: "T2", name: "Enforcement", scope: "pair", rule: "enforcement_mode equals full for 100% of managed workloads", result: "FAIL",
    per_pair: { "pay/prod": { result: "FAIL", measured: "5 of 6 full; pay-web-03 selective, no justification", evidence: ["05-get-workloads-pay-prod.json"] }, "pay-db/prod": { result: "PASS", measured: "3 of 3 full", evidence: ["06-get-workloads-pay-db-prod.json"] }, "tokenizer/prod": { result: "PASS", measured: "1 of 1 full", evidence: ["07-get-workloads-tokenizer-prod.json"] } } },
  { id: "T3", name: "VEN health", scope: "pair", rule: "active, heartbeat < 24h, synced, no health errors", result: "FAIL",
    per_pair: { "pay/prod": { result: "FAIL", measured: "pay-web-05 last_heartbeat_on 3 days ago", evidence: ["05-get-workloads-pay-prod.json"] }, "pay-db/prod": { result: "PASS", measured: "3 healthy", evidence: ["06-get-workloads-pay-db-prod.json"] }, "tokenizer/prod": { result: "PASS", measured: "1 healthy", evidence: ["07-get-workloads-tokenizer-prod.json"] } } },
  { id: "T4", name: "Unmanaged in scope", scope: "pair", rule: "zero, or each justified", result: "EXCEPTION",
    per_pair: { "pay/prod": { result: "PASS", measured: "0", evidence: ["05-get-workloads-pay-prod.json"] }, "pay-db/prod": { result: "PASS", measured: "0", evidence: ["06-get-workloads-pay-db-prod.json"] }, "tokenizer/prod": { result: "EXCEPTION", measured: "1 unmanaged (hsm-01), justified: HSM appliance, vendor-managed", evidence: ["07-get-workloads-tokenizer-prod.json"] } } },
  { id: "T5", name: "Justified providing rules", scope: "pair", rule: "every providing allow rule has a description", result: "FAIL",
    per_pair: { "pay/prod": { result: "FAIL", measured: "1 of 4 rules without description (CDE-inbound rule 2)", evidence: ["08-get-rulesets-pay-prod.json", "09-get-rulesets-pay-prod.json"] }, "pay-db/prod": { result: "PASS", measured: "2 of 2", evidence: ["10-get-rulesets-pay-db-prod.json", "11-get-rulesets-pay-db-prod.json"] }, "tokenizer/prod": { result: "PASS", measured: "1 of 1", evidence: ["12-get-rulesets-tokenizer-prod.json", "13-get-rulesets-tokenizer-prod.json"] } } },
  { id: "T6", name: "No broad consumer", scope: "pair", rule: "no all-workloads unscoped or 0.0.0.0/0 list into scope", result: "PASS",
    per_pair: { "pay/prod": { result: "PASS", measured: "0 broad", evidence: ["08-get-rulesets-pay-prod.json", "14-get-iplists-all.json"] }, "pay-db/prod": { result: "PASS", measured: "0 broad", evidence: ["10-get-rulesets-pay-db-prod.json"] }, "tokenizer/prod": { result: "PASS", measured: "0 broad", evidence: ["12-get-rulesets-tokenizer-prod.json"] } } },
  { id: "T7", name: "Admitted services vs approved", scope: "pair", rule: "no all-services rule, no unexpanded service object, admitted subset of approved", result: "PASS",
    per_pair: { "pay/prod": { result: "PASS", measured: "443/tcp, 8443/tcp approved", evidence: ["08-get-rulesets-pay-prod.json"] }, "pay-db/prod": { result: "PASS", measured: "5432/tcp approved", evidence: ["10-get-rulesets-pay-db-prod.json"] }, "tokenizer/prod": { result: "PASS", measured: "8443/tcp approved", evidence: ["12-get-rulesets-tokenizer-prod.json"] } } },
  { id: "T8", name: "Inbound boundary", scope: "pair", rule: "crossings on approved services, no unknown or public source, zero potentially blocked", result: "EXCEPTION",
    per_pair: { "pay/prod": { result: "EXCEPTION", measured: "capped at 500 flows after one split; no violation in 1,240 rows", evidence: ["15-get-traffic-flows-pay-prod.json", "16-get-traffic-flows-pay-prod.json", "17-get-traffic-flows-summary-pay-prod.json", "18-get-traffic-timeline-pay-prod.json"] }, "pay-db/prod": { result: "PASS", measured: "2 crossings, both approved; 0 potentially blocked", evidence: ["19-get-traffic-flows-pay-db-prod.json", "20-get-traffic-flows-pay-db-prod.json", "21-get-traffic-flows-summary-pay-db-prod.json", "22-get-traffic-timeline-pay-db-prod.json"] }, "tokenizer/prod": { result: "PASS", measured: "1 crossing, approved; 0 potentially blocked", evidence: ["23-get-traffic-flows-tokenizer-prod.json", "24-get-traffic-flows-tokenizer-prod.json", "25-get-traffic-flows-summary-tokenizer-prod.json", "26-get-traffic-timeline-tokenizer-prod.json"] } } },
  { id: "T9", name: "Outbound boundary", scope: "pair", rule: "destinations on approved egress", result: "NOT_TESTED",
    per_pair: { "pay/prod": { result: "NOT_TESTED", measured: "no approved egress list; 4 destinations observed", evidence: ["27-get-traffic-flows-pay-prod.json", "28-get-traffic-flows-summary-pay-prod.json"] }, "pay-db/prod": { result: "NOT_TESTED", measured: "2 destinations observed", evidence: ["29-get-traffic-flows-pay-db-prod.json", "30-get-traffic-flows-summary-pay-db-prod.json"] }, "tokenizer/prod": { result: "NOT_TESTED", measured: "1 destination observed", evidence: ["31-get-traffic-flows-tokenizer-prod.json", "32-get-traffic-flows-summary-tokenizer-prod.json"] } } },
  { id: "T10", name: "Unknown endpoints in scope subnets", scope: "wide", rule: "zero", result: "FAIL",
    per_pair: { all: { result: "FAIL", measured: "1 unknown host 10.1.5.9 in 10.1.5.0/24 (pay/prod)", evidence: ["33-get-traffic-flows-summary-all.json", "34-find-unmanaged-traffic-all.json", "35-discover-process-egress-all.json"] } } },
  { id: "T11", name: "Change control", scope: "wide", rule: "no pending draft change to scope rulesets", result: "EXCEPTION",
    per_pair: { all: { result: "EXCEPTION", measured: "1 pending update: CDE-inbound; 3 provisioning events in window", evidence: ["36-compare-draft-active-all.json", "37-get-events-all.json"] } } },
  { id: "T12", name: "Isolation capability", scope: "wide", rule: "deny or ringfence in active policy; drill attested", result: "NOT_TESTED",
    per_pair: { all: { result: "NOT_TESTED", measured: "override-deny ruleset CDE-isolate present; no drill attestation", evidence: ["08-get-rulesets-pay-prod.json"] } } },
  { id: "T13", name: "Review cadence", scope: "wide", rule: "reviewed within 6 months", result: "ATTESTED",
    per_pair: { all: { result: "ATTESTED", measured: "review 2026-08-30 by Alex Goller", evidence: ["37-get-events-all.json"] } } },
  { id: "T14", name: "Logging", scope: "wide", rule: "events and flows exist for the window", result: "PASS",
    per_pair: { all: { result: "PASS", measured: "40 events; flows in every pair", evidence: ["37-get-events-all.json"] } } },
];
const requirements = [
  { id: "1.2.1", title: "NSC configuration standards implemented", citation: "PCI DSS v4.0.1, Req 1.2.1", tests: ["T5"], result: "FAIL", gap: "One providing rule has no justification.", remediation: "Add the description or remove the rule.", owner: null, not_covered: "the written standard itself" },
  { id: "1.2.5", title: "Services, protocols and ports approved", citation: "PCI DSS v4.0.1, Req 1.2.5", tests: ["T7"], result: "PASS", gap: null, remediation: null, owner: null, not_covered: "approval workflow" },
  { id: "1.2.6", title: "Security features for insecure services", citation: "PCI DSS v4.0.1, Req 1.2.6", tests: ["T7"], result: "PASS", gap: null, remediation: null, owner: null, not_covered: "compensating controls" },
  { id: "1.2.7", title: "NSC configurations reviewed every six months", citation: "PCI DSS v4.0.1, Req 1.2.7", tests: ["T11", "T13"], result: "EXCEPTION", gap: "A draft change to CDE-inbound is pending.", remediation: "Provision or discard before the audit date.", owner: null, not_covered: "review minutes" },
  { id: "1.3.1", title: "Inbound traffic to the CDE restricted", citation: "PCI DSS v4.0.1, Req 1.3.1", tests: ["T6", "T8"], result: "EXCEPTION", gap: "pay/prod inbound query capped; no violation seen.", remediation: "Re-run with a 30-day window.", owner: null, not_covered: null },
  { id: "1.3.2", title: "Outbound traffic from the CDE restricted", citation: "PCI DSS v4.0.1, Req 1.3.2", tests: ["T9"], result: "NOT_TESTED", gap: "No approved egress list supplied.", remediation: "Approve the observed destinations or supply the list.", owner: null, not_covered: "proxy and DLP controls" },
  { id: "1.4.1", title: "NSCs between trusted and untrusted networks", citation: "PCI DSS v4.0.1, Req 1.4.1", tests: ["T2", "T3"], result: "FAIL", gap: "pay-web-03 selective; pay-web-05 VEN stale 3 days.", remediation: "Move pay-web-03 to full; repair pay-web-05 VEN.", owner: null, not_covered: "perimeter firewalls" },
  { id: "1.4.2", title: "Inbound from untrusted networks restricted", citation: "PCI DSS v4.0.1, Req 1.4.2", tests: ["T8", "T10"], result: "FAIL", gap: "Unknown host 10.1.5.9 inside 10.1.5.0/24.", remediation: "Identify the host; VEN or unmanaged entry.", owner: null, not_covered: null },
  { id: "1.4.4", title: "CHD systems not directly accessible from untrusted", citation: "PCI DSS v4.0.1, Req 1.4.4", tests: ["T8"], result: "PASS", gap: null, remediation: null, owner: null, not_covered: null },
  { id: "10.2", title: "Audit logs capture events", citation: "PCI DSS v4.0.1, Req 10.2", tests: ["T14"], result: "PASS", gap: null, remediation: null, owner: null, not_covered: "log retention and SIEM" },
  { id: "11.4.5", title: "Segmentation controls tested every 12 months", citation: "PCI DSS v4.0.1, Req 11.4.5", tests: ["T8", "T9", "T12"], result: "NOT_TESTED", gap: "No pen test attestation.", remediation: "Attach the tester's report.", owner: null, not_covered: "the penetration test itself" },
  { id: "12.5.2", title: "Scope documented and confirmed every 12 months", citation: "PCI DSS v4.0.1, Req 12.5.2", tests: ["T1", "T4", "T10"], result: "FAIL", gap: "Unknown host inside scope subnet.", remediation: "As 1.4.2.", owner: null, not_covered: "data-flow diagrams" },
];
const attestations = [
  { id: "A1", statement: "Rules for the scope were reviewed", cadence: "6 months", attested_by: "Alex Goller", date: "2026-08-30", document: "Review minutes 2026-08-30", result: "ATTESTED" },
  { id: "A2", statement: "Isolation drill executed", cadence: "12 months", attested_by: null, date: null, document: null, result: "NOT_TESTED" },
  { id: "A3", statement: "Segmentation penetration test", cadence: "12 months", attested_by: null, date: null, document: null, result: "NOT_TESTED" },
  { id: "A4", statement: "Flow and event log retention", cadence: "12 months", attested_by: "Alex Goller", date: "2026-10-17", document: "PCE retention setting screenshot", result: "ATTESTED" },
];
const findings = [
  { requirement: "1.4.1", test: "T2", result: "FAIL", pair: "pay/prod", detail: "pay-web-03 selective, no justification", remediation: "Move to full", owner: null },
  { requirement: "1.4.1", test: "T3", result: "FAIL", pair: "pay/prod", detail: "pay-web-05 heartbeat 3 days old", remediation: "Repair VEN", owner: null },
  { requirement: "1.4.2", test: "T10", result: "FAIL", pair: "pay/prod", detail: "10.1.5.9 unknown inside 10.1.5.0/24", remediation: "Identify host", owner: null },
  { requirement: "1.2.1", test: "T5", result: "FAIL", pair: "pay/prod", detail: "CDE-inbound rule 2 has no description", remediation: "Add justification", owner: null },
  { requirement: "1.2.7", test: "T11", result: "EXCEPTION", pair: "all", detail: "Pending draft update to CDE-inbound", remediation: "Provision or discard", owner: null },
  { requirement: "1.3.1", test: "T8", result: "EXCEPTION", pair: "pay/prod", detail: "Query capped; no violation in 1,240 rows", remediation: "Re-run narrower", owner: null },
];
const boundary = {
  "pay/prod": {
    inbound_admitted: [
      { peer: "web (prod)", port: 443, proto: "tcp", connections: 120400, approved: true, policy: { allowed: 120400, potentiallyBlocked: 0, blocked: 0 } },
      { peer: "jump (prod)", port: 8443, proto: "tcp", connections: 310, approved: true, policy: { allowed: 310, potentiallyBlocked: 0, blocked: 0 } },
    ],
    inbound_potentially_blocked: 0, inbound_blocked_connections: 3120,
    outbound_admitted: [
      { destination: "pay-db (prod)", port: 5432, proto: "tcp", connections: 88000, approved: null, policy: { allowed: 88000, potentiallyBlocked: 0, blocked: 0 } },
      { destination: "10.0.0.53", fqdn: null, port: 53, proto: "udp", connections: 41200, approved: null, policy: { allowed: 41200, potentiallyBlocked: 0, blocked: 0 } },
    ],
    timeline: { bucket: "1d", effective_bucket: "1d", series: Array.from({ length: 14 }, (_, i) => ({ bucket_start: `2026-10-${String(4 + i).padStart(2, "0")}T00:00:00Z`, blocked: [30, 28, 35, 31, 29, 190, 33, 30, 27, 32, 31, 29, 34, 30][i], potentially_blocked: 0 })), worst_spike: { bucket_start: "2026-10-09T00:00:00Z", multiple: 6.1, label: "Fri 2026-10-09" }, caveat: null },
  },
};
const drift = { previous_run_at: "2026-09-17T09:12:00+02:00", items: [
  { item: "T2 pay/prod", previous: "PASS", current: "FAIL", change: "changed" },
  { item: "T10", previous: "PASS", current: "FAIL", change: "changed" },
  { item: "ruleset CDE-isolate", previous: "absent", current: "present", change: "added" },
  { item: "workload pay-web-06", previous: "present", current: "absent", change: "removed" },
] };
const evidence_index = [
  { file: "05-get-workloads-pay-prod.json", tool: "get-workloads", collected_at: "2026-10-17T09:31:12+02:00", rows: 6, tests: ["T1", "T2", "T3", "T4"], sha256: "9f2c1a7e44b0c3d1e5f6a7b8c9d0e1f2a3b4c5d6e7f8091a2b3c4d5e6f708192" },
  { file: "08-get-rulesets-pay-prod.json", tool: "get-rulesets", collected_at: "2026-10-17T09:32:40+02:00", rows: 2, tests: ["T5", "T6", "T7", "T12"], sha256: "1b3d5f7a9c0e2f4a6b8d0f1a3c5e7b9d1f3a5c7e9b0d2f4a6c8e0b1d3f5a7c9e" },
  { file: "15-get-traffic-flows-pay-prod.json", tool: "get-traffic-flows", collected_at: "2026-10-17T09:35:02+02:00", rows: 500, tests: ["T8"], sha256: "a1c3e5b7d9f0a2c4e6b8d0f2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2b4d6f8a0c2" },
  { file: "37-get-events-all.json", tool: "get-events", collected_at: "2026-10-17T09:41:55+02:00", rows: 40, tests: ["T11", "T13", "T14"], sha256: "c0e2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2" },
];
const not_covered = ["2.x secure configurations", "3.x to 4.x data protection", "5.x malware", "6.x software", "7.x and 8.x identity", "9.x physical", "11.x except 11.4.5", "12.x except 12.5.2"];
// ==== END DATA ====

const font = "'DM Sans', system-ui, sans-serif";
const mono = "ui-monospace, Menlo, monospace";
const ORDER = ["FAIL", "EXCEPTION", "NOT_TESTED", "ATTESTED", "PASS"];
const STATUS = {
  FAIL: { bg: C.red, color: C.white, label: "FAIL" },
  EXCEPTION: { bg: C.orange, color: C.white, label: "EXCEPTION" },
  NOT_TESTED: { bg: C.teal, color: C.white, label: "NOT TESTED" },
  ATTESTED: { bg: C.teal, color: C.white, label: "ATTESTED" },
  PASS: { bg: C.green, color: C.white, label: "PASS" },
};
const fmt = (n) => (n == null ? "–" : n.toLocaleString("en-US"));
// An evidence entry is a file name, or a query descriptor from
// collect-compliance-evidence ({tool, query_name, ...}); render both.
const evidenceLabel = (e) => (typeof e === "string" ? e : [e.tool, e.query_name].filter(Boolean).join(" ") || JSON.stringify(e));
const worst = (list) => ORDER.find((s) => list.includes(s)) || "PASS";

function Badge({ label, color, bg }) {
  return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: bg, color, whiteSpace: "nowrap", fontFamily: font }}>{label}</span>;
}
const StatusBadge = ({ s }) => <Badge label={STATUS[s].label} bg={STATUS[s].bg} color={STATUS[s].color} />;

function Swatch({ color, kind }) {
  if (kind === "outline") return <span style={{ display: "inline-block", width: 14, height: 10, border: `2px solid ${color}`, borderRadius: 2 }} />;
  if (kind === "dash") return <span style={{ display: "inline-block", width: 18, borderTop: `2px dashed ${color}` }} />;
  return <span style={{ display: "inline-block", width: 14, height: 10, background: color, borderRadius: 2 }} />;
}
function Legend({ items }) {
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", fontSize: 11, color: C.gray500, marginTop: 10, paddingTop: 8, borderTop: `1px dashed ${C.gray200}` }}>
      <span style={{ fontWeight: 700 }}>Legend</span>
      {items.map(([label, color, kind], i) => <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Swatch color={color} kind={kind} />{label}</span>)}
    </div>
  );
}
const LEGEND = {
  status: [["FAIL", C.red], ["EXCEPTION: justified failure or capped result", C.orange], ["NOT TESTED or ATTESTED (the word says which)", C.teal], ["PASS", C.green]],
  rows: [["row tint: FAIL", C.redLight], ["row tint: EXCEPTION", C.orangeLight], ["no tint: other", C.white]],
  policy: [["allowed", C.green], ["potentially blocked", C.orange], ["blocked", C.red]],
  timeline: [["blocked per day", C.red], ["potentially blocked", C.orange], ["spike (>= 3x median)", C.red, "outline"], ["3x median", C.red, "dash"]],
  kpi: [["KPI top border: red or orange only when the count is above zero; grey otherwise", C.gray300]],
};
function ColourKey() {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 11, color: C.gray500 }}>
      <span style={{ fontWeight: 700, marginRight: 2 }}>Colour key</span>
      {ORDER.filter((s) => s !== "ATTESTED").map((s) => <StatusBadge key={s} s={s} />)}
      <span>· grey strips and borders mean nothing · each section has its own legend</span>
    </div>
  );
}
function KPICard({ label, value, subtitle, attention }) {
  const border = value > 0 && attention === "high" ? C.red : value > 0 && attention === "medium" ? C.orange : C.gray300;
  return (
    <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 12, padding: "14px 16px", borderTop: `4px solid ${border}`, minWidth: 0 }}>
      <div style={{ fontSize: 12, color: C.gray500, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: C.navy, lineHeight: 1.2, marginTop: 4 }}>{fmt(value)}</div>
      {subtitle && <div style={{ fontSize: 12, color: C.gray500, marginTop: 2 }}>{subtitle}</div>}
    </div>
  );
}
function StatusBanner({ status, subtitle }) {
  const title = { FAIL: "Controls failing", EXCEPTION: "Exceptions to resolve", NOT_TESTED: "Inputs missing", ATTESTED: "Attestations only", PASS: "All tested controls pass" }[status];
  return (
    <div style={{ background: STATUS[status].bg, color: C.white, borderRadius: 12, padding: "14px 18px" }}>
      <div style={{ fontWeight: 800, fontSize: 17 }}>{STATUS[status].label}: {title}</div>
      <div style={{ fontSize: 13, opacity: 0.92 }}>{subtitle}</div>
    </div>
  );
}
function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", background: C.gray100, padding: 6, borderRadius: 999, width: "fit-content" }}>
      {tabs.map((t) => (
        <button key={t} onClick={() => onChange(t)} style={{ border: "none", cursor: "pointer", padding: "7px 14px", borderRadius: 999, fontFamily: font, fontWeight: 700, fontSize: 13, background: active === t ? C.navy : "transparent", color: active === t ? C.white : C.gray700 }}>{t}</button>
      ))}
    </div>
  );
}
function Section({ title, children, right }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 12, padding: 16, marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 4, height: 18, borderRadius: 2, background: C.gray300, display: "inline-block" }} />
          <span style={{ fontWeight: 800, color: C.navy, fontSize: 15 }}>{title}</span>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}
function Chip({ label, active, onClick }) {
  return <button onClick={onClick} style={{ cursor: "pointer", border: `1px solid ${active ? C.navy : C.gray300}`, background: active ? C.navy : C.white, color: active ? C.white : C.gray700, borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 600, fontFamily: font }}>{label}</button>;
}
function PolicyBar({ policy }) {
  const a = policy.allowed || 0, p = policy.potentiallyBlocked || 0, b = policy.blocked || 0, total = a + p + b;
  const seg = (n, color) => (total ? <div title={fmt(n)} style={{ width: `${(100 * n) / total}%`, background: color }} /> : null);
  return <div title={`allowed ${fmt(a)} · potentially blocked ${fmt(p)} · blocked ${fmt(b)}`} style={{ display: "flex", height: 10, width: 110, borderRadius: 5, overflow: "hidden", background: C.gray200 }}>{seg(a, C.green)}{seg(p, C.orange)}{seg(b, C.red)}</div>;
}
function Table({ columns, rows, tint, empty }) {
  if (!rows.length) return <div style={{ color: C.gray500, fontSize: 13 }}>{empty}</div>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
        <thead><tr>{columns.map((c) => <th key={c.key} style={{ textAlign: "left", padding: "8px 10px", color: C.gray500, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, borderBottom: `2px solid ${C.gray200}`, whiteSpace: "nowrap" }}>{c.label}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i} style={{ background: tint ? tint(r) : "transparent" }}>
            {columns.map((c) => <td key={c.key} style={{ padding: "8px 10px", borderBottom: `1px solid ${C.gray100}`, verticalAlign: "top", color: C.navy }}>{c.render ? c.render(r) : r[c.key]}</td>)}
          </tr>))}</tbody>
      </table>
    </div>
  );
}
const tintByResult = (r) => (r.result === "FAIL" ? C.redLight : r.result === "EXCEPTION" ? C.orangeLight : "transparent");

function TimelineChart({ t }) {
  const w = 900, h = 200, pad = { l: 36, r: 10, t: 16, b: 36 };
  const s = t.series, max = Math.max(1, ...s.map((x) => x.blocked + x.potentially_blocked));
  const nz = s.map((x) => x.blocked + x.potentially_blocked).filter((v) => v > 0).sort((a, b) => a - b);
  const median = nz.length ? nz[Math.floor(nz.length / 2)] : 0, thr = median * 3;
  const bw = (w - pad.l - pad.r) / s.length, y = (v) => pad.t + (h - pad.t - pad.b) * (1 - v / max);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", fontFamily: font }}>
      {[0, 0.5, 1].map((f) => <g key={f}><line x1={pad.l} x2={w - pad.r} y1={y(max * f)} y2={y(max * f)} stroke={C.gray200} /><text x={pad.l - 6} y={y(max * f) + 4} fontSize={10} fill={C.gray500} textAnchor="end">{Math.round(max * f)}</text></g>)}
      {s.map((x, i) => {
        const X = pad.l + i * bw + 2, width = Math.max(1, bw - 4), tot = x.blocked + x.potentially_blocked, spike = thr > 0 && tot >= thr;
        return (
          <g key={i}>
            <rect x={X} y={y(x.potentially_blocked)} width={width} height={y(0) - y(x.potentially_blocked)} fill={C.orange} />
            <rect x={X} y={y(tot)} width={width} height={y(0) - y(tot) - (y(0) - y(x.potentially_blocked))} fill={C.red} />
            {spike && <rect x={X - 1} y={y(tot) - 1} width={width + 2} height={y(0) - y(tot) + 2} fill="none" stroke={C.red} strokeWidth={2} />}
            <text x={X + width / 2} y={h - pad.b + 14} fontSize={10} fill={C.gray500} textAnchor="middle">{x.bucket_start.slice(5, 10)}</text>
          </g>);
      })}
      {thr > 0 && <line x1={pad.l} x2={w - pad.r} y1={y(thr)} y2={y(thr)} stroke={C.red} strokeDasharray="4 4" />}
      <text x={pad.l} y={h - 4} fontSize={10} fill={C.gray500}>bucket {t.bucket} (effective {t.effective_bucket}), UTC</text>
    </svg>
  );
}

function Overview() {
  const count = (s) => requirements.filter((r) => r.result === s).length;
  const workloads = scope.pairs.reduce((a, p) => a + p.workloads, 0);
  const openAtt = attestations.filter((a) => a.result === "NOT_TESTED").length;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 16 }}>
        <KPICard label="Scope pairs" value={scope.pairs.length} subtitle={`${workloads} workloads`} />
        <KPICard label="Requirements FAIL" value={count("FAIL")} attention="high" />
        <KPICard label="Exceptions" value={count("EXCEPTION")} attention="medium" />
        <KPICard label="Not tested" value={count("NOT_TESTED")} subtitle="inputs missing" attention="medium" />
        <KPICard label="Open attestations" value={openAtt} attention="medium" />
        <KPICard label="PCE queries" value={pack.queries} />
      </div>
      <Section title="Requirements by status">
        {(() => { const tot = requirements.length || 1; return (
          <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: C.gray100 }}>
            {ORDER.map((s) => <div key={s} style={{ width: `${(100 * count(s)) / tot}%`, background: STATUS[s].bg }} />)}
          </div>); })()}
        <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 13, color: C.gray700, flexWrap: "wrap" }}>
          {ORDER.map((s) => <span key={s}><b style={{ color: STATUS[s].bg }}>{count(s)}</b> {STATUS[s].label.toLowerCase()}</span>)}
        </div>
        <Legend items={[...LEGEND.status, ...LEGEND.kpi]} />
      </Section>
      <Section title="Findings to act on">
        {findings.length ? findings.map((f, i) => (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "8px 0", borderBottom: i < findings.length - 1 ? `1px solid ${C.gray100}` : "none" }}>
            <StatusBadge s={f.result} />
            <div>
              <div style={{ fontWeight: 700, color: C.navy, fontSize: 14 }}>Req {f.requirement} · {f.test} · {f.pair}</div>
              <div style={{ color: C.gray700, fontSize: 13 }}>{f.detail} <span style={{ color: C.gray500 }}>→ {f.remediation}{f.owner ? ` (${f.owner})` : " (owner: unassigned)"}</span></div>
            </div>
          </div>)) : <div style={{ color: C.gray500, fontSize: 13 }}>No findings</div>}
        <Legend items={LEGEND.status} />
      </Section>
      <div style={{ color: C.gray500, fontSize: 12, marginTop: 14, lineHeight: 1.5 }}>{pack.disclaimer} Not covered: {not_covered.join("; ")}.</div>
    </div>
  );
}

function RequirementsTab() {
  const [f, setF] = useState(null);
  const [open, setOpen] = useState(null);
  const rows = requirements.filter((r) => !f || r.result === f);
  return (
    <Section title="Control summary" right={<span style={{ color: C.gray500, fontSize: 12 }}>{rows.length} of {requirements.length}</span>}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>{ORDER.map((s) => <Chip key={s} label={STATUS[s].label} active={f === s} onClick={() => setF(f === s ? null : s)} />)}</div>
      <Table columns={[
        { key: "id", label: "Req", render: (r) => <span style={{ fontWeight: 800 }}>{r.id}</span> },
        { key: "title", label: "Requirement", render: (r) => <span>{r.title}<div style={{ color: C.gray500, fontSize: 11 }}>{r.citation}</div></span> },
        { key: "tests", label: "Tests", render: (r) => r.tests.join(", ") },
        { key: "result", label: "Result", render: (r) => <StatusBadge s={r.result} /> },
        { key: "gap", label: "Gap / remediation", render: (r) => (r.gap ? <span>{r.gap} <span style={{ color: C.gray500 }}>→ {r.remediation}</span></span> : <span style={{ color: C.gray400 }}>–</span>) },
        { key: "more", label: "", render: (r) => <button onClick={() => setOpen(open === r.id ? null : r.id)} style={{ fontFamily: font, fontSize: 12, cursor: "pointer", border: `1px solid ${C.gray300}`, background: C.white, borderRadius: 6, padding: "2px 8px" }}>{open === r.id ? "hide" : "tests"}</button> },
      ]} rows={rows} tint={tintByResult} empty="No requirements match" />
      {open && (() => { const r = requirements.find((x) => x.id === open); return (
        <div style={{ marginTop: 10, background: C.gray50, borderRadius: 10, padding: 12, fontSize: 13 }}>
          <div style={{ fontWeight: 700, color: C.navy }}>Req {r.id}: tests and evidence</div>
          {r.tests.map((tid) => { const t = tests.find((x) => x.id === tid); return (
            <div key={tid} style={{ marginTop: 6 }}><StatusBadge s={t.result} /> <b>{t.id} {t.name}</b> <span style={{ color: C.gray500 }}>rule: {t.rule}</span>
              {Object.entries(t.per_pair).map(([p, v]) => <div key={p} style={{ marginLeft: 12, color: C.gray700 }}>{p}: {v.measured} <span style={{ fontFamily: mono, fontSize: 11, color: C.gray500 }}>{v.evidence.map(evidenceLabel).join(", ")}</span></div>)}
            </div>); })}
          {r.not_covered && <div style={{ marginTop: 6, color: C.gray500 }}>Not covered by Illumio: {r.not_covered}</div>}
        </div>); })()}
      <Legend items={[...LEGEND.status, ...LEGEND.rows]} />
    </Section>
  );
}

function TestsTab() {
  const pairs = [...new Set(tests.flatMap((t) => Object.keys(t.per_pair)))];
  return (
    <Section title="Tests per pair">
      <Table columns={[
        { key: "id", label: "Test", render: (t) => <span><b>{t.id}</b> {t.name}<div style={{ color: C.gray500, fontSize: 11 }}>{t.rule}</div></span> },
        ...pairs.map((p) => ({ key: p, label: p, render: (t) => { const v = t.per_pair[p]; return v ? <span><StatusBadge s={v.result} /><div style={{ fontSize: 12, marginTop: 3 }}>{v.measured}</div></span> : <span style={{ color: C.gray400 }}>–</span>; } })),
        { key: "result", label: "Result", render: (t) => <StatusBadge s={t.result} /> },
      ]} rows={tests} tint={tintByResult} empty="No tests" />
      <Legend items={[...LEGEND.status, ...LEGEND.rows, ["a test takes the worst pair; a requirement the worst test: FAIL > EXCEPTION > NOT TESTED > ATTESTED > PASS", C.gray300]]} />
    </Section>
  );
}

function BoundaryTab() {
  const pairs = Object.keys(boundary);
  const [pair, setPair] = useState(pairs[0]);
  const b = boundary[pair];
  const approvedCell = (r) => (r.approved === true ? <Badge label="approved" bg={C.green} color={C.white} /> : r.approved === false ? <Badge label="not approved" bg={C.red} color={C.white} /> : <Badge label="no list" bg={C.teal} color={C.white} />);
  if (!b) return <Section title="Boundary"><div style={{ color: C.gray500, fontSize: 13 }}>No boundary data</div></Section>;
  return (
    <div>
      <Section title="Boundary traffic" right={<div style={{ display: "flex", gap: 6 }}>{pairs.map((p) => <Chip key={p} label={p} active={pair === p} onClick={() => setPair(p)} />)}</div>}>
        <div style={{ fontWeight: 700, color: C.navy, fontSize: 13, marginBottom: 6 }}>Inbound crossings (allowed) · potentially blocked {fmt(b.inbound_potentially_blocked)} · blocked connections {fmt(b.inbound_blocked_connections)}</div>
        <Table columns={[
          { key: "peer", label: "Source" }, { key: "port", label: "Port", render: (r) => <span style={{ fontFamily: mono }}>{r.port}/{r.proto}</span> },
          { key: "connections", label: "Connections", render: (r) => fmt(r.connections) }, { key: "policy", label: "Policy", render: (r) => <PolicyBar policy={r.policy} /> }, { key: "approved", label: "Approved", render: approvedCell },
        ]} rows={b.inbound_admitted} empty="No inbound crossings" />
        <div style={{ fontWeight: 700, color: C.navy, fontSize: 13, margin: "14px 0 6px" }}>Outbound crossings (allowed)</div>
        <Table columns={[
          { key: "destination", label: "Destination", render: (r) => <span>{r.destination}{r.fqdn ? <div style={{ color: C.gray500, fontSize: 11 }}>{r.fqdn}</div> : null}</span> }, { key: "port", label: "Port", render: (r) => <span style={{ fontFamily: mono }}>{r.port}/{r.proto}</span> },
          { key: "connections", label: "Connections", render: (r) => fmt(r.connections) }, { key: "policy", label: "Policy", render: (r) => <PolicyBar policy={r.policy} /> }, { key: "approved", label: "Approved", render: approvedCell },
        ]} rows={b.outbound_admitted} empty="No outbound crossings" />
        <Legend items={[...LEGEND.policy, ["approved: on the user's list", C.green], ["not approved: on no list although a list exists", C.red], ["no list: approved list not supplied (NOT TESTED)", C.teal]]} />
      </Section>
      <Section title="Blocked and potentially blocked per day">
        <TimelineChart t={b.timeline} />
        <div style={{ fontSize: 13, color: C.gray700, marginTop: 6 }}>{b.timeline.worst_spike ? <span>Worst spike <b style={{ color: C.red }}>{b.timeline.worst_spike.label}, {b.timeline.worst_spike.multiple}x median</b></span> : "No spike"}{b.timeline.caveat && <div style={{ color: C.amberDark }}>{b.timeline.caveat}</div>}</div>
        <Legend items={LEGEND.timeline} />
      </Section>
    </div>
  );
}

function AttestationsTab() {
  return (
    <Section title="Attestations">
      <Table columns={[
        { key: "id", label: "#" }, { key: "statement", label: "Statement" }, { key: "cadence", label: "Cadence" },
        { key: "attested_by", label: "Attested by", render: (a) => a.attested_by || <span style={{ color: C.gray400 }}>–</span> }, { key: "date", label: "Date", render: (a) => a.date || <span style={{ color: C.gray400 }}>–</span> },
        { key: "document", label: "Document", render: (a) => a.document || <span style={{ color: C.gray400 }}>–</span> }, { key: "result", label: "Result", render: (a) => <StatusBadge s={a.result} /> },
      ]} rows={attestations} empty="No attestations" />
      <Legend items={[["ATTESTED: a named person points to a document", C.teal], ["NOT TESTED: row left empty on purpose so the gap is visible", C.teal]]} />
    </Section>
  );
}

function DriftTab() {
  return (
    <Section title={`Drift since ${drift.previous_run_at}`}>
      <Table columns={[{ key: "item", label: "Item" }, { key: "previous", label: "Previous" }, { key: "current", label: "Current" }, { key: "change", label: "Change", render: (d) => <Badge label={d.change} bg={d.change === "removed" ? C.red : d.change === "added" ? C.teal : C.orange} color={C.white} /> }]} rows={drift.items} empty="No drift" />
      <Legend items={[["changed", C.orange], ["added", C.teal], ["removed", C.red]]} />
    </Section>
  );
}

function EvidenceTab() {
  return (
    <Section title="Evidence index" right={<span style={{ color: C.gray500, fontSize: 12 }}>{evidence_index.length} files</span>}>
      <Table columns={[
        { key: "file", label: "File", render: (e) => <span style={{ fontFamily: mono, fontSize: 12 }}>{e.file}</span> }, { key: "tool", label: "Tool" }, { key: "collected_at", label: "Collected" },
        { key: "rows", label: "Rows" }, { key: "tests", label: "Tests", render: (e) => e.tests.join(", ") }, { key: "sha256", label: "SHA-256", render: (e) => <span style={{ fontFamily: mono, fontSize: 11 }} title={e.sha256}>{e.sha256.slice(0, 12)}…</span> },
      ]} rows={evidence_index} empty="No evidence files" />
      <div style={{ color: C.gray500, fontSize: 12, marginTop: 8 }}>No colour is used in this section.</div>
    </Section>
  );
}

export default function ComplianceEvidenceDashboard() {
  const tabs = ["Overview", "Requirements", "Tests", "Boundary", "Attestations", ...(drift.previous_run_at ? ["Drift"] : []), "Evidence"];
  const [tab, setTab] = useState("Overview");
  const status = pack.overall || worst(requirements.map((r) => r.result));
  const subtitle = `${pack.framework.toUpperCase()} ${pack.framework_version} · ${pack.scope_name} · ${pack.window.start} to ${pack.window.end} (${pack.window.days} days) · ${pack.policy_version} policy · ${pack.queries} PCE queries · run ${pack.run_number}`;
  return (
    <div style={{ fontFamily: font, background: C.gray50, minHeight: "100vh", padding: 20, color: C.navy }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 12, color: C.green, fontWeight: 800, letterSpacing: 1 }}>ILLUMIO · COMPLIANCE EVIDENCE</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{pack.scope_name} · {pack.pce}</div>
          </div>
          <div style={{ fontSize: 12, color: C.gray500 }}>collected {pack.run_at} · server {pack.server_version}</div>
        </div>
        <StatusBanner status={status} subtitle={subtitle} />
        <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <TabBar tabs={tabs} active={tab} onChange={setTab} />
          <ColourKey />
        </div>
        {tab === "Overview" && <Overview />}
        {tab === "Requirements" && <RequirementsTab />}
        {tab === "Tests" && <TestsTab />}
        {tab === "Boundary" && <BoundaryTab />}
        {tab === "Attestations" && <AttestationsTab />}
        {tab === "Drift" && <DriftTab />}
        {tab === "Evidence" && <EvidenceTab />}
      </div>
    </div>
  );
}
