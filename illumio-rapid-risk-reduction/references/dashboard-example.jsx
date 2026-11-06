import React, { useState, useMemo } from "react";

// Rapid risk reduction dashboard: the plan's numbers, nothing more.
// scripts/triage.py writes dashboard.jsx by replacing the block between
// // ==== DATA ==== and // ==== END DATA ==== below with plan.json's data;
// this file doubles as the template and as a worked example.

// Illumio Field palette (references/dashboard-spec.md, "Illumio Field").
const C = {
  accent: "#FF5500",          // Illumio Orange: active tab underline, title rule, today/new marker; never a status
  slate: "#313638",           // Server Slate: headings, primary text, table header rows
  text: "#464A4C",            // body text
  muted: "#64686A",           // captions, labels
  green: "#166644",           // Safeguard Green: pass, allowed, enforced, healthy
  greenLight: "rgba(22,102,68,0.10)",
  greenDark: "#11432F",
  teal: "#2D454C",            // System Cyan: info, selective, in progress
  tealLight: "rgba(45,69,76,0.10)",
  orange: "#F97607",          // Circuit Gold 110: warning, high (fills, swatches, bars; slate text on its tint)
  orangeLight: "rgba(249,118,7,0.10)",
  amber: "#FFA22F",           // Circuit Gold 100: medium
  amberLight: "rgba(255,162,47,0.12)",
  red: "#BE122F",             // Risk Red: critical, failed, blocked
  redLight: "rgba(190,18,47,0.10)",
  gray50: "#F7F4EE",          // page ground: Zero Trust Tan
  gray100: "#F5F5F5",         // subtle fills
  gray200: "#D6D7D7",         // borders
  gray300: "#C1C3C3",
  gray400: "#6F7274",         // muted text, minimum for small text on white
  gray500: "#64686A",         // secondary text
  gray700: "#464A4C",         // strong secondary text
  white: "#FFFFFF",
};
const FONT = '"FK Grotesk", Montserrat, Arial, sans-serif';
const MONO = "ui-monospace, Menlo, monospace";
const BAND = "#EAEBEB"; // table banding

// ==== DATA ====
const scope = {"date": "2026-11-04", "windowStart": "2026-10-05", "windowEnd": "2026-11-04", "windowDays": 30, "lateralDays": 30, "adminSpan": {"start": "2026-10-05", "end": "2026-11-03", "days": 30}, "productionEnvs": ["prod"], "crownJewels": ["pay (prod)"], "crownJewelsSource": "given by the user", "rulesetName": "RRR-2026-11-04", "lowerBounds": [], "missingInputs": [], "policyView": "draft", "headerNotes": ["No query hit its cap.", "Labelling readiness: ready, 12 of 12 workloads carry app and env; 12 connections in the estate summary involve an unlabelled workload; 1 unlabelled workloads were seen as peers of unknown sources.", "Policy read: provisioned and draft. The draft adds 2 rulesets (RRR-2026-10-20, RF-ad-prod) and 4 rules (1 allow, 2 deny, 1 override deny), changes 1 ruleset (Core-AD; 1 rule changed), removes 0 rulesets and 0 rules; compare-draft-active: 4 pending changes. Of the 8 exposures, 3 already have a draft deny or ringfence waiting for provisioning, 1 has a provisioned deny naming it that still reports allowed, and 4 have nothing drafted: the work left is to provision 3 and draft 4."]};
const kpis = {"exposures": 8, "blockToday": 1, "thisWeek": 7, "runbooks": 1, "watch": 3, "maxScore": 16, "allowedWouldStop": 240, "pbWouldStop": 680, "unknownAdminSources": 2, "envCrossings": 2, "bridges": 2};
const riskMap = {"takeaway": "Most exposure sits in pay (prod), shop (prod), ad (prod); the largest environment crossing is mgmt to prod with 200 allowed connections; 2 unmanaged sources reach workloads on admin ports; 3 of 8 fixes are already drafted and wait for provisioning.", "readiness": {"verdict": "ready", "workloads": 12, "labelled": 12, "unlabelled": 0, "withApp": 12, "withEnv": 12, "labelColumns": true, "notes": ["12 connections in the estate summary involve an unlabelled workload", "1 unlabelled workloads were seen as peers of unknown sources"], "examples": []}, "headline": {"workloads": 12, "fullEnforcement": 6, "selective": 1, "notEnforcing": 5, "unmanagedAdminSources": 2, "unmanagedAdminInternal": 1, "unmanagedAdminPublic": 1, "appsInGraph": 7, "wideReachApps": 0, "wideReachLowerBound": false, "lateralDays": 30, "overrideDeniesNotShowing": 0, "overrideDeniesUnchecked": 0}, "apps": [{"app": "pay (prod)", "workloads": 3, "crownJewel": true, "publicAdminSources": 0, "values": {"unmanagedInbound": 0, "unmanagedAdminSources": 1, "crossEnvConnections": 80, "crossEnvApps": 1, "wideReachAccounts": 0, "workloadsNotEnforcing": 2}, "bands": {"unmanagedInbound": 0, "unmanagedAdminSources": 2, "crossEnvConnections": 1, "crossEnvApps": 3, "wideReachAccounts": 0, "workloadsNotEnforcing": 3}}, {"app": "shop (prod)", "workloads": 3, "crownJewel": false, "publicAdminSources": 1, "values": {"unmanagedInbound": 0, "unmanagedAdminSources": 2, "crossEnvConnections": 120, "crossEnvApps": 1, "wideReachAccounts": 0, "workloadsNotEnforcing": 0}, "bands": {"unmanagedInbound": 0, "unmanagedAdminSources": 3, "crossEnvConnections": 3, "crossEnvApps": 3, "wideReachAccounts": 0, "workloadsNotEnforcing": 0}}, {"app": "ad (prod)", "workloads": 2, "crownJewel": false, "publicAdminSources": 0, "values": {"unmanagedInbound": 0, "unmanagedAdminSources": 1, "crossEnvConnections": 0, "crossEnvApps": 0, "wideReachAccounts": 1, "workloadsNotEnforcing": 0}, "bands": {"unmanagedInbound": 0, "unmanagedAdminSources": 2, "crossEnvConnections": 0, "crossEnvApps": 0, "wideReachAccounts": 1, "workloadsNotEnforcing": 0}}, {"app": "ci (dev)", "workloads": 2, "crownJewel": false, "publicAdminSources": 0, "values": {"unmanagedInbound": 0, "unmanagedAdminSources": 0, "crossEnvConnections": 0, "crossEnvApps": 0, "wideReachAccounts": 0, "workloadsNotEnforcing": 2}, "bands": {"unmanagedInbound": 0, "unmanagedAdminSources": 0, "crossEnvConnections": 0, "crossEnvApps": 0, "wideReachAccounts": 0, "workloadsNotEnforcing": 3}}, {"app": "hr (prod)", "workloads": 1, "crownJewel": false, "publicAdminSources": 0, "values": {"unmanagedInbound": 0, "unmanagedAdminSources": 0, "crossEnvConnections": 0, "crossEnvApps": 0, "wideReachAccounts": 0, "workloadsNotEnforcing": 1}, "bands": {"unmanagedInbound": 0, "unmanagedAdminSources": 0, "crossEnvConnections": 0, "crossEnvApps": 0, "wideReachAccounts": 0, "workloadsNotEnforcing": 1}}, {"app": "jump (mgmt)", "workloads": 1, "crownJewel": false, "publicAdminSources": 0, "values": {"unmanagedInbound": 0, "unmanagedAdminSources": 0, "crossEnvConnections": 0, "crossEnvApps": 0, "wideReachAccounts": 0, "workloadsNotEnforcing": 0}, "bands": {"unmanagedInbound": 0, "unmanagedAdminSources": 0, "crossEnvConnections": 0, "crossEnvApps": 0, "wideReachAccounts": 0, "workloadsNotEnforcing": 0}}], "appsTotal": 6, "appsExcluded": 0, "envMatrix": [{"from": "mgmt", "to": "prod", "allowed": 200, "potentiallyBlocked": 0, "blocked": 0}, {"from": "dev", "to": "prod", "allowed": 0, "potentiallyBlocked": 310, "blocked": 40}], "ruleDrift": [], "draftActive": {"available": true, "pending": 4}, "policy": {"view": "draft", "text": "Policy read: provisioned and draft. The draft adds 2 rulesets (RRR-2026-10-20, RF-ad-prod) and 4 rules (1 allow, 2 deny, 1 override deny), changes 1 ruleset (Core-AD; 1 rule changed), removes 0 rulesets and 0 rules; compare-draft-active: 4 pending changes. Of the 8 exposures, 3 already have a draft deny or ringfence waiting for provisioning, 1 has a provisioned deny naming it that still reports allowed, and 4 have nothing drafted: the work left is to provision 3 and draft 4.", "pending": {"available": true, "pending": 4}, "exposures": {"total": 8, "provisioned": 1, "drafted": 3, "none": 4}, "delta": {"rulesetsNew": ["RRR-2026-10-20", "RF-ad-prod"], "rulesetsChanged": ["Core-AD"], "rulesetsRemoved": [], "rulesetsUnchanged": 1, "rulesNew": 4, "rulesChanged": 1, "rulesRemoved": 0, "newByKind": {"allow": 1, "deny": 2, "overrideDeny": 1}}}, "fixFirst": ["Review and provision the draft: 3 of the 8 exposures below already have a draft deny or ringfence (4 pending changes in all); that is finished work waiting on provision-policy.", "Identify the 1 internal host on admin ports, starting with 10.1.1.250, which reaches 7 workloads; then label each one or block it.", "Narrow the admin-port crossing env=dev to env=prod into pay (prod) (22/tcp, 3389/tcp, 5432/tcp), keeping Kerberos, LDAP and SMB to the directory servers open.", "Block the 1 public source on admin ports with the override deny from the X1 list."], "inputs": {"summary": true, "lateral": true, "rulesets": true, "identities": true, "unknown": true}};
const lines = [{"id": "L1", "cls": "X4", "kind": "ringfence", "bucket": "week", "score": 16, "blast": 4, "ease": 4, "title": "selective ringfence ad (prod), deny_consumer any", "radius": "reaches 6 apps, 2 workloads", "wouldHaveBlocked": {"allowed": 0, "potentiallyBlocked": 0, "blocked": 0, "allowedNoRule": 0}, "evidence": ["detect-lateral-movement-paths high_risk_bridge_nodes[ad|prod]", "get-workloads rows app=ad env=prod (2 workloads)", "estate summary app_to_app rows to ad (prod)"], "rollback": "delete the RF- ruleset from the draft; workloads stay in their current enforcement mode", "detail": "bridge reaching 6 apps; enforcement: full 2; allow list: 3 remote apps, 3 already allowed; no rule possible for 0 connections from unlabelled or IP-list sources (they hit the deny); scoped rulesets: Core-AD; already drafted, not provisioned: RF-ad-prod: scoped ruleset for ad (prod) with a deny to all workloads; the work left is to review and provision that draft, not to draft another", "recommendation": "Preview, then draft a selective ringfence RF-ad-prod with deny_consumer any (this week): allow rules for 3 observed inbound remote apps (3 already allowed), a deny for everything else, enforced at the app's own workloads. Already drafted, not provisioned: RF-ad-prod: scoped ruleset for ad (prod) with a deny to all workloads; the work left is to review and provision that draft, not to draft another.", "action": "provision the drafted deny in RF-ad-prod, this week", "admittingRules": [], "state": "drafted", "cover": {"provisioned": [], "drafted": ["RF-ad-prod: scoped ruleset for ad (prod) with a deny to all workloads"]}}, {"id": "L2", "cls": "X1", "kind": "override_deny", "bucket": "week", "score": 15, "blast": 3, "ease": 5, "title": "unknown internal source 10.1.1.250 on 3389/tcp, 22/tcp", "radius": "7 workloads, 5 enforced", "wouldHaveBlocked": {"allowed": 30, "potentiallyBlocked": 370, "blocked": 240, "allowedNoRule": 0}, "evidence": ["find-unknown-endpoints endpoints[ip=10.1.1.250].profile_evidence.admin_reach", "as_source.ports admin rows (640 connections as source)"], "rollback": "delete the override deny rule from the draft ruleset", "detail": "override deny on purpose; source 10.1.1.250 is private (identify first), lists: RRR-unknown-admin-sources-2026-10-20-internal, profile: admin_reach, scanner; allowed into enforced workloads: 30; peer apps: shop (prod), pay (prod), ad (prod); a provisioned deny already names this: RF-shop-prod (deny, scope app=shop, env=prod): iplist:Any (0.0.0.0/0 and ::/0) -> all workloads on All Services; it reports allowed, so check the enforcing side (destination workloads of 3 peer apps: full 5, selective 1, visibility_only 2) and the rule's scope before adding another; already drafted, not provisioned: RRR-2026-10-20 (override deny): iplist:RRR-unknown-admin-sources-2026-10-20-internal -> all workloads on 3389/tcp, 22/tcp; RF-ad-prod (deny, scope app=ad, env=prod): iplist:Any (0.0.0.0/0 and ::/0) -> all workloads on All Services; the work left is to review and provision that draft, not to draft another", "recommendation": "Draft an override deny from an IP list holding 10.1.1.250 to all workloads on 3389/tcp, 22/tcp in RRR-2026-11-04 (this week). Override deny on purpose: it must hold even where an allow admits the source. Identify the host first: an internal address the PCE cannot name is usually a scanner, a backup or monitoring host, a jump box or an unlabelled server; label it if it belongs, keep the deny if it does not. It is on the list RRR-unknown-admin-sources-2026-10-20-internal; a rule admits it on purpose, so the list owner confirms first. A provisioned deny already names this: RF-shop-prod (deny, scope app=shop, env=prod): iplist:Any (0.0.0.0/0 and ::/0) -> all workloads on All Services; it reports allowed, so check the enforcing side (destination workloads of 3 peer apps: full 5, selective 1, visibility_only 2) and the rule's scope before adding another. Already drafted, not provisioned: RRR-2026-10-20 (override deny): iplist:RRR-unknown-admin-sources-2026-10-20-internal -> all workloads on 3389/tcp, 22/tcp; RF-ad-prod (deny, scope app=ad, env=prod): iplist:Any (0.0.0.0/0 and ::/0) -> all workloads on All Services; the work left is to review and provision that draft, not to draft another.", "action": "provision the drafted override deny in RRR-2026-10-20, this week; identify the source first; a provisioned deny in RF-shop-prod already names it and reports allowed: check enforcement mode and scope", "admittingRules": [], "state": "drafted", "cover": {"provisioned": ["RF-shop-prod (deny, scope app=shop, env=prod): iplist:Any (0.0.0.0/0 and ::/0) -> all workloads on All Services"], "drafted": ["RRR-2026-10-20 (override deny): iplist:RRR-unknown-admin-sources-2026-10-20-internal -> all workloads on 3389/tcp, 22/tcp", "RF-ad-prod (deny, scope app=ad, env=prod): iplist:Any (0.0.0.0/0 and ::/0) -> all workloads on All Services"]}}, {"id": "L3", "cls": "X2", "kind": "deny", "bucket": "today", "score": 10, "blast": 2, "ease": 5, "title": "admin ports env=dev -> env=prod (production)", "radius": "2 destination apps", "wouldHaveBlocked": {"allowed": 0, "potentiallyBlocked": 310, "blocked": 40, "allowedNoRule": 0}, "evidence": ["admin-port flows rows env=dev -> env=prod (2 app pairs, 3 ports)"], "rollback": "delete the deny rule from the draft ruleset", "detail": "ports seen: 5432/tcp (200: potentially_blocked 200), 22/tcp (110: potentially_blocked 110), 3389/tcp (40: blocked 40); app pairs: ci (dev) -> pay (prod) potentially_blocked 310; ci (dev) -> shop (prod) blocked 40", "recommendation": "Draft a deny env=dev -> env=prod on 22/tcp, 3389/tcp, 5432/tcp in RRR-2026-11-04 (today); enforced on managed workloads carrying env=dev in selective or full enforcement.", "action": "deny env=dev -> env=prod on 22/tcp, 3389/tcp, 5432/tcp, today", "admittingRules": [], "state": "none", "cover": {"provisioned": [], "drafted": []}}, {"id": "L4", "cls": "X4", "kind": "ringfence", "bucket": "week", "score": 9, "blast": 3, "ease": 3, "title": "selective ringfence jump (mgmt), deny_consumer any", "radius": "reaches 4 apps, 1 workloads", "wouldHaveBlocked": {"allowed": 0, "potentiallyBlocked": 0, "blocked": 0, "allowedNoRule": 0}, "evidence": ["detect-lateral-movement-paths high_risk_bridge_nodes[jump|mgmt]", "get-workloads rows app=jump env=mgmt (1 workloads)", "estate summary app_to_app rows to jump (mgmt)"], "rollback": "delete the RF- ruleset from the draft; workloads stay in their current enforcement mode", "detail": "bridge reaching 4 apps; enforcement: full 1; allow list: 0 remote apps, 0 already allowed; no inbound app traffic observed, so the fence denies all inbound; no rule possible for 0 connections from unlabelled or IP-list sources (they hit the deny)", "recommendation": "Preview, then draft a selective ringfence RF-jump-mgmt with deny_consumer any (this week): allow rules for 0 observed inbound remote apps (0 already allowed), a deny for everything else, enforced at the app's own workloads. No inbound app traffic was observed, so the fence denies all inbound.", "action": "selective ringfence RF-jump-mgmt, deny_consumer any, this week", "admittingRules": [], "state": "none", "cover": {"provisioned": [], "drafted": []}}, {"id": "L5", "cls": "X2", "kind": "deny", "bucket": "week", "score": 6, "blast": 2, "ease": 3, "title": "admin ports env=mgmt -> env=prod (production)", "radius": "2 destination apps", "wouldHaveBlocked": {"allowed": 200, "potentiallyBlocked": 0, "blocked": 0, "allowedNoRule": 0}, "evidence": ["admin-port flows rows env=mgmt -> env=prod (2 app pairs, 2 ports)"], "rollback": "delete the deny rule from the draft ruleset", "detail": "ports seen: 22/tcp (120: allowed 120), 3389/tcp (80: allowed 80); app pairs: jump (mgmt) -> shop (prod) allowed 120; jump (mgmt) -> pay (prod) allowed 80; 200 allowed connections would stop: confirm they may, admitted by: no allow rule found naming these envs (a broader rule or an IP list); already drafted, not provisioned: RRR-2026-10-20 (deny): env=mgmt -> env=prod on 22/tcp, 3389/tcp; the work left is to review and provision that draft, not to draft another", "recommendation": "Draft a deny env=mgmt -> env=prod on 22/tcp, 3389/tcp in RRR-2026-11-04 (this week); enforced on managed workloads carrying env=mgmt in selective or full enforcement. 200 allowed connections would stop, admitted by: no rule naming these envs (a broader rule or an IP list); confirm first. Already drafted, not provisioned: RRR-2026-10-20 (deny): env=mgmt -> env=prod on 22/tcp, 3389/tcp; the work left is to review and provision that draft, not to draft another.", "action": "provision the drafted deny in RRR-2026-10-20, this week", "admittingRules": [], "state": "drafted", "cover": {"provisioned": [], "drafted": ["RRR-2026-10-20 (deny): env=mgmt -> env=prod on 22/tcp, 3389/tcp"]}}, {"id": "L6", "cls": "X5", "kind": "ringfence", "bucket": "week", "score": 6, "blast": 2, "ease": 3, "title": "selective ringfence pay (prod), deny_consumer any", "radius": "3 workloads", "wouldHaveBlocked": {"allowed": 0, "potentiallyBlocked": 0, "blocked": 0, "allowedNoRule": 0}, "evidence": ["get-workloads rows app=pay env=prod (3 workloads)", "estate summary app_to_app rows to pay (prod)"], "rollback": "delete the RF- ruleset from the draft; workloads stay in their current enforcement mode", "detail": "2 workloads not enforcing with 365 denied inbound connections; enforcement: selective 1, visibility_only 2; allow list: 4 remote apps, 2 already allowed; no rule possible for 0 connections from unlabelled or IP-list sources (they hit the deny)", "recommendation": "Preview, then draft a selective ringfence RF-pay-prod with deny_consumer any (this week): allow rules for 4 observed inbound remote apps (2 already allowed), a deny for everything else, enforced at the app's own workloads. Then move the app's 2 non-enforcing workloads to selective enforcement (update-workload, not drafted here).", "action": "selective ringfence RF-pay-prod, deny_consumer any, this week; then selective enforcement", "admittingRules": [], "state": "none", "cover": {"provisioned": [], "drafted": []}}, {"id": "L7", "cls": "X1", "kind": "override_deny", "bucket": "week", "score": 4, "blast": 2, "ease": 2, "title": "unknown public source 203.0.113.9 (scan.example.net) on 22/tcp", "radius": "2 workloads, 2 enforced", "wouldHaveBlocked": {"allowed": 10, "potentiallyBlocked": 0, "blocked": 0, "allowedNoRule": 0}, "evidence": ["find-unknown-endpoints endpoints[ip=203.0.113.9].profile_evidence.admin_reach", "as_source.ports admin rows (90 connections as source)"], "rollback": "delete the override deny rule from the draft ruleset", "detail": "override deny on purpose; source 203.0.113.9 scan.example.net is public, lists: Partners, profile: admin_reach; allowed into enforced workloads: 90; peer apps: shop (prod); 10 allowed connections would stop: confirm admin access from this source may end; a provisioned deny already names this: RF-shop-prod (deny, scope app=shop, env=prod): iplist:Any (0.0.0.0/0 and ::/0) -> all workloads on All Services; it reports allowed, so check the enforcing side (destination workloads of 1 peer apps: full 3) and the rule's scope before adding another", "recommendation": "Draft an override deny from an IP list holding 203.0.113.9 to all workloads on 22/tcp in RRR-2026-11-04 (this week). Override deny on purpose: it must hold even where an allow admits the source. It is on the list Partners; a rule admits it on purpose, so the list owner confirms first. 10 allowed connections would stop; confirm admin access from this source may end first. A provisioned deny already names this: RF-shop-prod (deny, scope app=shop, env=prod): iplist:Any (0.0.0.0/0 and ::/0) -> all workloads on All Services; it reports allowed, so check the enforcing side (destination workloads of 1 peer apps: full 3) and the rule's scope before adding another.", "action": "override deny from an IP list of the source to all workloads on 22/tcp, this week after review; a provisioned deny in RF-shop-prod already names it and reports allowed: check enforcement mode and scope", "admittingRules": [], "state": "provisioned", "cover": {"provisioned": ["RF-shop-prod (deny, scope app=shop, env=prod): iplist:Any (0.0.0.0/0 and ::/0) -> all workloads on All Services"], "drafted": []}}, {"id": "L8", "cls": "X5", "kind": "ringfence", "bucket": "week", "score": 4, "blast": 1, "ease": 4, "title": "selective ringfence hr (prod), deny_consumer any", "radius": "1 workloads", "wouldHaveBlocked": {"allowed": 0, "potentiallyBlocked": 12, "blocked": 0, "allowedNoRule": 0}, "evidence": ["get-workloads rows app=hr env=prod (1 workloads)", "estate summary app_to_app rows to hr (prod)"], "rollback": "delete the RF- ruleset from the draft; workloads stay in their current enforcement mode", "detail": "1 workloads not enforcing with 12 denied inbound connections; enforcement: idle 1; allow list: 0 remote apps, 0 already allowed; no inbound app traffic observed, so the fence denies all inbound; no rule possible for 12 connections from unlabelled or IP-list sources (they hit the deny)", "recommendation": "Preview, then draft a selective ringfence RF-hr-prod with deny_consumer any (this week): allow rules for 0 observed inbound remote apps (0 already allowed), a deny for everything else, enforced at the app's own workloads. No inbound app traffic was observed, so the fence denies all inbound. 12 connections from unlabelled or IP-list sources get no allow and will hit the deny; label or list them first if they matter. Then move the app's 1 non-enforcing workloads to selective enforcement (update-workload, not drafted here).", "action": "selective ringfence RF-hr-prod, deny_consumer any, this week; then selective enforcement", "admittingRules": [], "state": "none", "cover": {"provisioned": [], "drafted": []}}];
const runbooks = [{"name": "EMERGENCY-ISOLATE-pay-prod", "workloads": 3, "found": true, "steps": ["get-labels key app value pay; key env value prod", "create-ruleset EMERGENCY-ISOLATE-pay-prod, scoped to app=pay, env=prod", "create-deny-rule override deny: providers ams, consumers ams and Any, All Services, unscoped_consumers true", "optional: outbound override deny in an unscoped ruleset (consumers the app's labels, providers ams and Any)", "provision-policy"], "effect": "all traffic to the app stops, allow rules included.", "undo": "delete the override deny rules and provision again."}];
const watch = [{"cls": "X3", "title": "public source 203.0.113.9 scan.example.net", "detail": "reaches 2 workloads on 443/tcp; allowed into enforced 90; admitted by Partners", "recommendation": "No draft rule. Find the rule or list admitting 203.0.113.9: Partners; narrow it or add the address to a named list. Its admin ports are covered by the X1 override deny."}, {"cls": "X3", "title": "public source 198.51.100.20", "detail": "reaches 1 workloads on 443/tcp; allowed into enforced 0; admitted by no named list", "recommendation": "No draft rule. Find the rule or list admitting 198.51.100.20: the default Any list or a broad rule; narrow it or add the address to a named list."}, {"cls": "X6", "title": "identity jdoe", "detail": "interactive account active from 9 workloads; one person on several devices, or a shared credential; interactive account reaches 6 distinct apps -- wide for a single user; 9 workloads, 6 apps; admin ports 3389/tcp, 445/tcp", "recommendation": "No Illumio rule can name an identity. Confirm with the owner whether jdoe should be active from 9 workloads across 6 apps; the admin ports it uses (3389/tcp, 445/tcp) are what the X1 and X2 denies narrow."}];
const baseline = {"available": true, "bucket": "1d", "effectiveBucket": "1d", "resolutionNote": null, "days": 30, "median": 22, "total": 706, "worst": {"bucketStart": "2026-10-14T00:00:00Z", "flows": 80, "multiple": 3.8}, "caveat": null, "truncated": false, "threshold": 63.0, "spikeBuckets": [{"bucketStart": "2026-10-14T00:00:00Z"}], "series": [{"bucketStart": "2026-10-05T00:00:00Z", "flows": 20, "pb": 16, "blocked": 4}, {"bucketStart": "2026-10-06T00:00:00Z", "flows": 22, "pb": 18, "blocked": 4}, {"bucketStart": "2026-10-07T00:00:00Z", "flows": 19, "pb": 16, "blocked": 3}, {"bucketStart": "2026-10-08T00:00:00Z", "flows": 25, "pb": 20, "blocked": 5}, {"bucketStart": "2026-10-09T00:00:00Z", "flows": 21, "pb": 17, "blocked": 4}, {"bucketStart": "2026-10-10T00:00:00Z", "flows": 20, "pb": 16, "blocked": 4}, {"bucketStart": "2026-10-11T00:00:00Z", "flows": 24, "pb": 20, "blocked": 4}, {"bucketStart": "2026-10-12T00:00:00Z", "flows": 23, "pb": 19, "blocked": 4}, {"bucketStart": "2026-10-13T00:00:00Z", "flows": 22, "pb": 18, "blocked": 4}, {"bucketStart": "2026-10-14T00:00:00Z", "flows": 80, "pb": 64, "blocked": 16}, {"bucketStart": "2026-10-15T00:00:00Z", "flows": 21, "pb": 17, "blocked": 4}, {"bucketStart": "2026-10-16T00:00:00Z", "flows": 20, "pb": 16, "blocked": 4}, {"bucketStart": "2026-10-17T00:00:00Z", "flows": 19, "pb": 16, "blocked": 3}, {"bucketStart": "2026-10-18T00:00:00Z", "flows": 22, "pb": 18, "blocked": 4}, {"bucketStart": "2026-10-19T00:00:00Z", "flows": 24, "pb": 20, "blocked": 4}, {"bucketStart": "2026-10-20T00:00:00Z", "flows": 25, "pb": 20, "blocked": 5}, {"bucketStart": "2026-10-21T00:00:00Z", "flows": 21, "pb": 17, "blocked": 4}, {"bucketStart": "2026-10-22T00:00:00Z", "flows": 20, "pb": 16, "blocked": 4}, {"bucketStart": "2026-10-23T00:00:00Z", "flows": 22, "pb": 18, "blocked": 4}, {"bucketStart": "2026-10-24T00:00:00Z", "flows": 23, "pb": 19, "blocked": 4}, {"bucketStart": "2026-10-25T00:00:00Z", "flows": 21, "pb": 17, "blocked": 4}, {"bucketStart": "2026-10-26T00:00:00Z", "flows": 20, "pb": 16, "blocked": 4}, {"bucketStart": "2026-10-27T00:00:00Z", "flows": 24, "pb": 20, "blocked": 4}, {"bucketStart": "2026-10-28T00:00:00Z", "flows": 22, "pb": 18, "blocked": 4}, {"bucketStart": "2026-10-29T00:00:00Z", "flows": 21, "pb": 17, "blocked": 4}, {"bucketStart": "2026-10-30T00:00:00Z", "flows": 20, "pb": 16, "blocked": 4}, {"bucketStart": "2026-10-31T00:00:00Z", "flows": 23, "pb": 19, "blocked": 4}, {"bucketStart": "2026-11-01T00:00:00Z", "flows": 22, "pb": 18, "blocked": 4}, {"bucketStart": "2026-11-02T00:00:00Z", "flows": 21, "pb": 17, "blocked": 4}, {"bucketStart": "2026-11-03T00:00:00Z", "flows": 19, "pb": 16, "blocked": 3}]};
const callPlans = [{"for": "X1 (internal)", "tool": "create-iplist", "runbook": null, "json": "{\n \"for\": \"X1 (internal)\",\n \"tool\": \"create-iplist\",\n \"DO_NOT_CALL\": \"draft for review\",\n \"name\": \"RRR-unknown-admin-sources-2026-11-04-internal-review\",\n \"description\": \"Rapid risk reduction: internal (private) sources on admin ports: identify each one (scanner, backup, jump host, unlabelled server), then label it or keep it here\",\n \"ip_ranges\": [\n  {\n   \"from_ip\": \"10.1.1.250\",\n   \"description\": \"unknown source\"\n  }\n ]\n}"}, {"for": "X1 (listed)", "tool": "create-iplist", "runbook": null, "json": "{\n \"for\": \"X1 (listed)\",\n \"tool\": \"create-iplist\",\n \"DO_NOT_CALL\": \"draft for review\",\n \"name\": \"RRR-unknown-admin-sources-2026-11-04-listed-review\",\n \"description\": \"Rapid risk reduction: public sources already on a named IP list: policy names that list, so check the rules that use it (allow or deny) with the list owner before this override deny\",\n \"ip_ranges\": [\n  {\n   \"from_ip\": \"203.0.113.9\",\n   \"description\": \"scan.example.net; on lists Partners\"\n  }\n ]\n}"}, {"for": "ruleset", "tool": null, "runbook": null, "json": "{\n \"for\": \"ruleset\",\n \"tool\": null,\n \"DO_NOT_CALL\": \"nothing to call\",\n \"_notes\": \"RRR ruleset already exists (RRR-2026-10-20; drafted, not provisioned); the deny rules below target RRR-2026-11-04\"\n}"}, {"for": "X1 (internal)", "tool": "create-deny-rule", "runbook": null, "json": "{\n \"for\": \"X1 (internal)\",\n \"tool\": \"create-deny-rule\",\n \"DO_NOT_CALL\": \"draft for review\",\n \"ruleset_name\": \"RRR-2026-11-04\",\n \"consumers\": [\n  \"iplist:RRR-unknown-admin-sources-2026-11-04-internal-review\"\n ],\n \"providers\": [\n  \"ams\"\n ],\n \"ingress_services\": [\n  {\n   \"port\": 22,\n   \"proto\": \"tcp\"\n  },\n  {\n   \"port\": 3389,\n   \"proto\": \"tcp\"\n  }\n ],\n \"override_deny\": true,\n \"unscoped_consumers\": true,\n \"_notes\": {\n  \"why_override\": \"incident-grade block: must hold even where an allow rule admits the source\",\n  \"sources\": \"internal (private) sources on admin ports: identify each one (scanner, backup, jump host, unlabelled server), then label it or keep it here\",\n  \"would_have_blocked\": {\n   \"allowed\": 30,\n   \"potentially_blocked\": 370,\n   \"blocked\": 240\n  },\n  \"identify_first\": \"an internal host the PCE cannot name is usually a scanner, a backup or monitoring host, a jump box or an unlabelled server; blocking it before identifying it can stop backups or monitoring\",\n  \"named_lists\": [\n   \"RRR-unknown-admin-sources-2026-10-20-internal\"\n  ],\n  \"existing_rules_naming_the_lists\": [],\n  \"admitting_allow_rules\": [],\n  \"already_covered\": {\n   \"provisioned\": [\n    \"RF-shop-prod (deny, scope app=shop, env=prod): iplist:Any (0.0.0.0/0 and ::/0) -> all workloads on All Services\"\n   ],\n   \"provisioned_note\": \"a provisioned deny already names this and it reports allowed: check the enforcing side's mode and the rule's scope before adding another\",\n   \"drafted\": [\n    \"RF-ad-prod (deny, scope app=ad, env=prod): iplist:Any (0.0.0.0/0 and ::/0) -> all workloads on All Services\",\n    \"RRR-2026-10-20 (override deny): iplist:RRR-unknown-admin-sources-2026-10-20-internal -> all workloads on 3389/tcp, 22/tcp\"\n   ],\n   \"drafted_note\": \"already drafted, not provisioned: review and provision that draft instead of creating another\"\n  }\n }\n}"}, {"for": "X1 (listed)", "tool": "create-deny-rule", "runbook": null, "json": "{\n \"for\": \"X1 (listed)\",\n \"tool\": \"create-deny-rule\",\n \"DO_NOT_CALL\": \"draft for review\",\n \"ruleset_name\": \"RRR-2026-11-04\",\n \"consumers\": [\n  \"iplist:RRR-unknown-admin-sources-2026-11-04-listed-review\"\n ],\n \"providers\": [\n  \"ams\"\n ],\n \"ingress_services\": [\n  {\n   \"port\": 22,\n   \"proto\": \"tcp\"\n  }\n ],\n \"override_deny\": true,\n \"unscoped_consumers\": true,\n \"_notes\": {\n  \"why_override\": \"incident-grade block: must hold even where an allow rule admits the source\",\n  \"sources\": \"public sources already on a named IP list: policy names that list, so check the rules that use it (allow or deny) with the list owner before this override deny\",\n  \"would_have_blocked\": {\n   \"allowed\": 10,\n   \"potentially_blocked\": 0,\n   \"blocked\": 0\n  },\n  \"named_lists\": [\n   \"Partners\"\n  ],\n  \"existing_rules_naming_the_lists\": [],\n  \"admitting_allow_rules\": [],\n  \"warning\": \"override deny beats every allow rule that admits these lists; the list owner must agree\",\n  \"already_covered\": {\n   \"provisioned\": [\n    \"RF-shop-prod (deny, scope app=shop, env=prod): iplist:Any (0.0.0.0/0 and ::/0) -> all workloads on All Services\"\n   ],\n   \"provisioned_note\": \"a provisioned deny already names this and it reports allowed: check the enforcing side's mode and the rule's scope before adding another\"\n  }\n }\n}"}, {"for": "X2 dev->prod", "tool": "create-deny-rule", "runbook": null, "json": "{\n \"for\": \"X2 dev->prod\",\n \"tool\": \"create-deny-rule\",\n \"DO_NOT_CALL\": \"draft for review\",\n \"ruleset_name\": \"RRR-2026-11-04\",\n \"consumers\": [\n  \"env=dev\"\n ],\n \"providers\": [\n  \"env=prod\"\n ],\n \"ingress_services\": [\n  {\n   \"port\": 22,\n   \"proto\": \"tcp\"\n  },\n  {\n   \"port\": 3389,\n   \"proto\": \"tcp\"\n  },\n  {\n   \"port\": 5432,\n   \"proto\": \"tcp\"\n  }\n ],\n \"override_deny\": false,\n \"unscoped_consumers\": true,\n \"_notes\": {\n  \"enforced_on\": \"managed workloads carrying env=dev in selective or full enforcement\",\n  \"would_have_blocked\": {\n   \"allowed\": 0,\n   \"potentially_blocked\": 310,\n   \"blocked\": 40,\n   \"allowed_not_admitted\": 0,\n   \"denied_share\": 1.0\n  },\n  \"admitting_rules\": []\n }\n}"}, {"for": "X2 mgmt->prod", "tool": "create-deny-rule", "runbook": null, "json": "{\n \"for\": \"X2 mgmt->prod\",\n \"tool\": \"create-deny-rule\",\n \"DO_NOT_CALL\": \"draft for review\",\n \"ruleset_name\": \"RRR-2026-11-04\",\n \"consumers\": [\n  \"env=mgmt\"\n ],\n \"providers\": [\n  \"env=prod\"\n ],\n \"ingress_services\": [\n  {\n   \"port\": 22,\n   \"proto\": \"tcp\"\n  },\n  {\n   \"port\": 3389,\n   \"proto\": \"tcp\"\n  }\n ],\n \"override_deny\": false,\n \"unscoped_consumers\": true,\n \"_notes\": {\n  \"enforced_on\": \"managed workloads carrying env=mgmt in selective or full enforcement\",\n  \"would_have_blocked\": {\n   \"allowed\": 200,\n   \"potentially_blocked\": 0,\n   \"blocked\": 0,\n   \"allowed_not_admitted\": 0,\n   \"denied_share\": 0.0\n  },\n  \"admitting_rules\": [],\n  \"already_covered\": {\n   \"drafted\": [\n    \"RRR-2026-10-20 (deny): env=mgmt -> env=prod on 22/tcp, 3389/tcp\"\n   ],\n   \"drafted_note\": \"already drafted, not provisioned: review and provision that draft instead of creating another\"\n  }\n }\n}"}, {"for": "X4 ad (prod)", "tool": "create-ringfence", "runbook": null, "json": "{\n \"for\": \"X4 ad (prod)\",\n \"tool\": \"create-ringfence\",\n \"DO_NOT_CALL\": \"the user's preview call, never this skill's\",\n \"app_name\": \"ad\",\n \"env_name\": \"prod\",\n \"lookback_days\": 30,\n \"dry_run\": true\n}"}, {"for": "X4 ad (prod)", "tool": "create-ringfence", "runbook": null, "json": "{\n \"for\": \"X4 ad (prod)\",\n \"tool\": \"create-ringfence\",\n \"DO_NOT_CALL\": \"draft for review\",\n \"app_name\": \"ad\",\n \"env_name\": \"prod\",\n \"lookback_days\": 30,\n \"dry_run\": false,\n \"selective\": true,\n \"deny_consumer\": \"any\",\n \"ruleset_name\": \"RF-ad-prod\",\n \"_notes\": \"allow rules for every observed inbound remote app with app and env labels; unlabelled and IP-list sources get no allow and hit the deny\",\n \"_already_covered\": {\n  \"drafted\": [\n   \"RF-ad-prod: scoped ruleset for ad (prod) with a deny to all workloads\"\n  ],\n  \"drafted_note\": \"already drafted, not provisioned: review and provision that draft instead of creating another\"\n }\n}"}, {"for": "X4 jump (mgmt)", "tool": "create-ringfence", "runbook": null, "json": "{\n \"for\": \"X4 jump (mgmt)\",\n \"tool\": \"create-ringfence\",\n \"DO_NOT_CALL\": \"the user's preview call, never this skill's\",\n \"app_name\": \"jump\",\n \"env_name\": \"mgmt\",\n \"lookback_days\": 30,\n \"dry_run\": true\n}"}, {"for": "X4 jump (mgmt)", "tool": "create-ringfence", "runbook": null, "json": "{\n \"for\": \"X4 jump (mgmt)\",\n \"tool\": \"create-ringfence\",\n \"DO_NOT_CALL\": \"draft for review\",\n \"app_name\": \"jump\",\n \"env_name\": \"mgmt\",\n \"lookback_days\": 30,\n \"dry_run\": false,\n \"selective\": true,\n \"deny_consumer\": \"any\",\n \"ruleset_name\": \"RF-jump-mgmt\",\n \"_notes\": \"allow rules for every observed inbound remote app with app and env labels; unlabelled and IP-list sources get no allow and hit the deny\"\n}"}, {"for": "X5 pay (prod)", "tool": "create-ringfence", "runbook": null, "json": "{\n \"for\": \"X5 pay (prod)\",\n \"tool\": \"create-ringfence\",\n \"DO_NOT_CALL\": \"the user's preview call, never this skill's\",\n \"app_name\": \"pay\",\n \"env_name\": \"prod\",\n \"lookback_days\": 30,\n \"dry_run\": true\n}"}, {"for": "X5 pay (prod)", "tool": "create-ringfence", "runbook": null, "json": "{\n \"for\": \"X5 pay (prod)\",\n \"tool\": \"create-ringfence\",\n \"DO_NOT_CALL\": \"draft for review\",\n \"app_name\": \"pay\",\n \"env_name\": \"prod\",\n \"lookback_days\": 30,\n \"dry_run\": false,\n \"selective\": true,\n \"deny_consumer\": \"any\",\n \"ruleset_name\": \"RF-pay-prod\",\n \"_notes\": \"allow rules for every observed inbound remote app with app and env labels; unlabelled and IP-list sources get no allow and hit the deny\"\n}"}, {"for": "X5 hr (prod)", "tool": "create-ringfence", "runbook": null, "json": "{\n \"for\": \"X5 hr (prod)\",\n \"tool\": \"create-ringfence\",\n \"DO_NOT_CALL\": \"the user's preview call, never this skill's\",\n \"app_name\": \"hr\",\n \"env_name\": \"prod\",\n \"lookback_days\": 30,\n \"dry_run\": true\n}"}, {"for": "X5 hr (prod)", "tool": "create-ringfence", "runbook": null, "json": "{\n \"for\": \"X5 hr (prod)\",\n \"tool\": \"create-ringfence\",\n \"DO_NOT_CALL\": \"draft for review\",\n \"app_name\": \"hr\",\n \"env_name\": \"prod\",\n \"lookback_days\": 30,\n \"dry_run\": false,\n \"selective\": true,\n \"deny_consumer\": \"any\",\n \"ruleset_name\": \"RF-hr-prod\",\n \"_notes\": \"allow rules for every observed inbound remote app with app and env labels; unlabelled and IP-list sources get no allow and hit the deny\"\n}"}, {"for": "CJ pay (prod)", "tool": null, "runbook": "EMERGENCY-ISOLATE-pay-prod", "json": "{\n \"for\": \"CJ pay (prod)\",\n \"runbook\": \"EMERGENCY-ISOLATE-pay-prod\",\n \"DO_NOT_CALL\": \"run only on a confirmed incident\",\n \"steps\": [\n  {\n   \"tool\": \"get-labels\",\n   \"key\": \"app\",\n   \"value\": \"pay\"\n  },\n  {\n   \"tool\": \"get-labels\",\n   \"key\": \"env\",\n   \"value\": \"prod\"\n  },\n  {\n   \"tool\": \"create-ruleset\",\n   \"name\": \"EMERGENCY-ISOLATE-pay-prod\",\n   \"scopes\": [\n    [\n     {\n      \"key\": \"app\",\n      \"value\": \"pay\"\n     },\n     {\n      \"key\": \"env\",\n      \"value\": \"prod\"\n     }\n    ]\n   ]\n  },\n  {\n   \"tool\": \"create-deny-rule\",\n   \"ruleset_name\": \"EMERGENCY-ISOLATE-pay-prod\",\n   \"providers\": [\n    \"ams\"\n   ],\n   \"consumers\": [\n    \"ams\",\n    \"iplist:Any (0.0.0.0/0 and ::/0)\"\n   ],\n   \"ingress_services\": [\n    {\n     \"service\": \"All Services\"\n    }\n   ],\n   \"override_deny\": true,\n   \"unscoped_consumers\": true,\n   \"effect\": \"all inbound to the app stops, allow rules included\"\n  },\n  {\n   \"tool\": \"create-ruleset\",\n   \"name\": \"EMERGENCY-ISOLATE-pay-prod-outbound\",\n   \"scopes\": [],\n   \"optional\": true,\n   \"note\": \"outbound needs an unscoped ruleset: consumers are the app's labels, providers ams and Any\"\n  },\n  {\n   \"tool\": \"create-deny-rule\",\n   \"ruleset_name\": \"EMERGENCY-ISOLATE-pay-prod-outbound\",\n   \"optional\": true,\n   \"consumers\": [\n    \"app=pay\",\n    \"env=prod\"\n   ],\n   \"providers\": [\n    \"ams\",\n    \"iplist:Any (0.0.0.0/0 and ::/0)\"\n   ],\n   \"ingress_services\": [\n    {\n     \"service\": \"All Services\"\n    }\n   ],\n   \"override_deny\": true,\n   \"unscoped_consumers\": true\n  },\n  {\n   \"tool\": \"provision-policy\",\n   \"note\": \"the only step that changes enforcement\"\n  },\n  {\n   \"undo\": \"delete the override deny rules (delete-deny-rule) and the rulesets, then provision-policy again\"\n  }\n ]\n}"}];
// ==== END DATA ====

const bucketStyle = {
  today: { bg: C.red, color: C.white, label: "BLOCK TODAY" },
  week: { bg: C.orange, color: C.slate, label: "THIS WEEK" },
  demand: { bg: C.gray300, color: C.slate, label: "ON DEMAND" },
  watch: { bg: C.gray300, color: C.slate, label: "WATCH" },
};
const kindLabel = { override_deny: "override deny", deny: "deny", ringfence: "selective ringfence", watch: "watch" };
const fmt = (n) => (n == null ? "–" : Number(n).toLocaleString("en-US"));
// Risk map: band 0 to 4 as one Server Slate tint, darker = higher percentile among the apps.
const bandBg = (b) => ["transparent", "rgba(49,54,56,0.10)", "rgba(49,54,56,0.26)", "rgba(49,54,56,0.48)", "rgba(49,54,56,0.78)"][b] || "transparent";
const bandFg = (b) => (b >= 3 ? C.white : C.slate);
const compact = (n) => (n == null ? "–" : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k` : String(n));
const readinessStyle = { ready: { bg: C.gray300, color: C.slate, label: "READY" }, partial: { bg: C.orange, color: C.slate, label: "PARTIAL" }, "not ready": { bg: C.red, color: C.white, label: "NOT READY" } };
// Eyebrows and table headers: Server Slate SemiBold caps.
const eyebrow = { fontSize: 11, color: C.slate, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6 };
const TH = { textAlign: "left", padding: "8px 10px", background: C.slate, color: C.white, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap" };

function Badge({ label, color, bg, mono, wrap }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 2, fontSize: 11, fontWeight: 600,
      background: bg, color, letterSpacing: 0.2, fontFamily: mono ? MONO : FONT, whiteSpace: wrap ? "normal" : "nowrap" }}>
      {label}
    </span>
  );
}
const BucketBadge = ({ b }) => { const s = bucketStyle[b] || bucketStyle.watch; return <Badge label={s.label} bg={s.bg} color={s.color} />; };
const ClassBadge = ({ cls }) => <Badge label={cls} bg={C.gray100} color={C.gray700} mono />;

// The top border is Risk Red or Circuit Gold only when the KPI is a risk and non-zero.
function KPICard({ label, value, subtitle, attention }) {
  const border = value > 0 && attention === "high" ? C.red : value > 0 && attention === "medium" ? C.orange : C.gray300;
  return (
    <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 0, padding: "14px 16px", borderTop: `4px solid ${border}`, minWidth: 0 }}>
      <div style={eyebrow}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 300, color: C.slate, lineHeight: 1.2, marginTop: 4 }}>{fmt(value)}</div>
      {subtitle && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{subtitle}</div>}
    </div>
  );
}

// Risk Red and Safeguard Green carry white text; Circuit Gold carries slate text.
function StatusBanner({ status, title, subtitle }) {
  const map = { high: [C.red, C.white], medium: [C.orange, C.slate], ok: [C.green, C.white] };
  const [bg, color] = map[status] || map.ok;
  return (
    <div style={{ background: bg, color, borderRadius: 0, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
      <span style={{ fontSize: 22 }}>●</span>
      <div>
        <div style={{ fontWeight: 600, fontSize: 17 }}>{title}</div>
        <div style={{ fontSize: 13, opacity: 0.92 }}>{subtitle}</div>
      </div>
    </div>
  );
}

function Swatch({ color, kind }) {
  if (kind === "text") return <span style={{ color, fontWeight: 600, fontFamily: MONO }}>{color === C.gray300 ? "·" : "22/tcp"}</span>;
  if (kind === "outline") return <span style={{ display: "inline-block", width: 14, height: 10, border: `2px solid ${color}`, borderRadius: 0 }} />;
  if (kind === "dash") return <span style={{ display: "inline-block", width: 18, borderTop: `2px dashed ${color}` }} />;
  return <span style={{ display: "inline-block", width: 14, height: 10, background: color, borderRadius: 0 }} />;
}

function Legend({ items }) {
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", fontSize: 11, color: C.muted, marginTop: 10,
      paddingTop: 8, borderTop: `1px dashed ${C.gray200}` }}>
      <span style={{ fontWeight: 600, color: C.slate }}>Legend</span>
      {items.map(([label, color, kind], i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Swatch color={color} kind={kind} />{label}</span>
      ))}
    </div>
  );
}

const LEGEND = {
  buckets: [["Risk Red: block today (deny or override deny, ease 4 or more)", C.red], ["Circuit Gold: this week (ringfence, deny after review, internal source to identify)", C.orange], ["grey: watch and isolate on demand, nothing drafted", C.gray300]],
  decisions: [["Safeguard Green: allowed by a rule, the rule would stop it", C.green], ["System Cyan: allowed, no provisioned rule, selective enforcement, a deny would catch it", C.teal], ["Circuit Gold: potentially blocked, no allow rule covers it", C.orange], ["Risk Red: blocked, already stopped, the rule makes it stick", C.red]],
  lineState: [["DRAFTED badge, System Cyan: a draft deny or ringfence already covers it, provision it", C.teal], ["PROVISIONED badge, Risk Red: a provisioned deny names it yet it reports allowed, review it", C.red], ["no badge: nothing drafted", C.gray300]],
  policy: [["System Cyan: drafted, waiting for provisioning, the work left is provision-policy", C.teal], ["Risk Red: provisioned deny names it, reported allowed, review the enforcing side and the scope", C.red], ["Circuit Gold: nothing drafted, the work left is to draft", C.orange], ["grey = no meaning", C.gray300]],
  kpi: [["KPI top border Risk Red = allowed connections that would stop, when above zero", C.red], ["Circuit Gold = exposures with no draft fix, when above zero", C.orange], ["grey = no meaning", C.gray300]],
  mapKpi: [["KPI top border Risk Red = override denies not showing in traffic, when above zero", C.red], ["Circuit Gold = unmanaged admin-port sources, when above zero", C.orange], ["grey = no meaning", C.gray300]],
  readiness: [["Risk Red: labelling not ready, label first, nothing can be scoped", C.red], ["Circuit Gold: partial, some workloads outside every scoped fix", C.orange], ["grey: ready", C.gray300]],
  grid: [["no traffic or zero", "transparent", "outline"], ["lowest quarter of the apps with a value", bandBg(1)], ["second quarter", bandBg(2)], ["third quarter", bandBg(3)], ["top quarter (one Server Slate tint, no status colour)", bandBg(4)], ["CJ badge = crown jewel, grey, no meaning", C.gray100]],
  matrix: [["allowed connections, darker Server Slate tint = more (square-root scale)", bandBg(4)], ["dot = none", C.gray300, "text"]],
  scores: [["bar length = score (blast radius x ease, 1 to 25); bar colour = bucket: Risk Red block today", C.red], ["Circuit Gold this week", C.orange]],
  timeline: [["Circuit Gold: potentially blocked flows", C.orange], ["Risk Red: blocked flows", C.red], ["spike bucket (>= 3x median), Risk Red outline", C.red, "outline"], ["3x median threshold, Risk Red dashed", C.red, "dash"]],
  runbooks: [["Risk Red text: the override deny step, beats every allow rule", C.red, "text"], ["System Cyan text: the provision step, the only one that changes enforcement", C.teal, "text"]],
};

function ColourKey() {
  const items = [["Risk Red: block today · not ready · provisioned, reported allowed", C.red, C.white], ["Circuit Gold: this week · partial · nothing drafted", C.orange, C.slate], ["grey: watch · on demand · ready", C.gray300, C.slate], ["Safeguard Green: allowed by a rule", C.green, C.white], ["System Cyan: allowed, no rule · drafted, provision it", C.teal, C.white]];
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 11, color: C.muted }}>
      <span style={{ fontWeight: 600, color: C.slate, marginRight: 2 }}>Colour key</span>
      {items.map(([l, bg, color]) => <Badge key={l} label={l} bg={bg} color={color} wrap />)}
      <span>· grey strips and borders mean nothing · Illumio Orange marks the active tab only · each section has its own legend</span>
    </div>
  );
}

// Text tabs; the active one carries the Illumio Orange underline, the one brand accent.
function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", borderBottom: `1px solid ${C.gray200}`, width: "fit-content" }}>
      {tabs.map((t) => (
        <button key={t} onClick={() => onChange(t)} style={{ border: "none", background: "transparent", cursor: "pointer", padding: "8px 12px 6px", borderRadius: 0, fontFamily: FONT,
          fontWeight: active === t ? 600 : 500, fontSize: 13, color: active === t ? C.slate : C.muted, borderBottom: `2px solid ${active === t ? C.accent : "transparent"}`, marginBottom: -1 }}>
          {t}
        </button>
      ))}
    </div>
  );
}

function Section({ title, children, right }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 0, padding: 16, marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 4, height: 16, borderRadius: 0, background: C.gray300, display: "inline-block" }} />
          <span style={{ ...eyebrow, fontSize: 12 }}>{title}</span>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function DecisionBar({ w }) {
  const nr = w.allowedNoRule || 0, a = (w.allowed || 0) - nr, p = w.potentiallyBlocked || 0, b = w.blocked || 0;
  const total = a + nr + p + b;
  const seg = (n, color) => (total ? <div title={fmt(n)} style={{ width: `${(100 * n) / total}%`, background: color }} /> : null);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 170 }}>
      <div title={`allowed by a rule ${fmt(a)} · allowed, no rule ${fmt(nr)} · potentially blocked ${fmt(p)} · blocked ${fmt(b)}`}
        style={{ display: "flex", height: 10, width: 110, borderRadius: 0, overflow: "hidden", background: C.gray200 }}>
        {seg(a, C.green)}{seg(nr, C.teal)}{seg(p, C.orange)}{seg(b, C.red)}
      </div>
      <span style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap", fontFamily: MONO }}>{fmt(w.allowed || 0)}/{fmt(p)}/{fmt(b)}{nr ? ` (${fmt(nr)} no rule)` : ""}</span>
    </div>
  );
}

function ReadinessStrip({ r }) {
  const s = readinessStyle[r.verdict] || readinessStyle.ready;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: C.text }}>
      <Badge label={s.label} bg={s.bg} color={s.color} />
      <div>
        <b>Labelling readiness.</b> {r.workloads ? `${fmt(r.labelled)} of ${fmt(r.workloads)} workloads carry app and env labels.` : "No workloads in the inventory."}
        {r.notes.length > 0 && <span> {r.notes.join("; ")}.</span>}
        {r.verdict !== "ready" && <span> Scoped fixes (ringfences, environment denies, the grid) cover labelled workloads only.</span>}
      </div>
    </div>
  );
}

const GRID_COLS = [["unmanagedInbound", "Unmanaged inbound", "allowed connections from external or unlabelled sources"],
  ["unmanagedAdminSources", "Unmanaged admin sources", "unknown sources on admin ports"],
  ["crossEnvConnections", "Cross-env connections", "allowed connections from other environments"],
  ["crossEnvApps", "Cross-env apps", "distinct apps in other environments"],
  ["wideReachAccounts", "Wide-reach accounts", "review-flagged identities touching the app"],
  ["workloadsNotEnforcing", "Not enforcing", "workloads not in selective or full"]];

function HeatGrid({ rm }) {
  if (!rm.apps.length) return <div style={{ color: C.muted, fontSize: 13 }}>{rm.inputs.summary ? "No app could be ranked: no labelled app in the inventory or the traffic summary." : "No estate summary saved; the grid needs get-traffic-flows-summary."}</div>;
  const th = { ...TH, textAlign: "center", padding: "6px 4px", fontSize: 10, letterSpacing: 0.3, whiteSpace: "normal", verticalAlign: "bottom" };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "separate", borderSpacing: 2, width: "100%", fontSize: 12 }}>
        <thead><tr><th style={{ ...th, textAlign: "left" }}>App</th><th style={th}>Workloads</th>{GRID_COLS.map(([k, label, hint]) => <th key={k} style={th} title={hint}>{label}</th>)}</tr></thead>
        <tbody>
          {rm.apps.map((a) => (
            <tr key={a.app}>
              <td style={{ padding: "6px 6px", color: C.slate, fontWeight: 600, whiteSpace: "nowrap" }}>{a.app}{a.crownJewel && <span> <Badge label="CJ" bg={C.gray100} color={C.gray700} mono /></span>}</td>
              <td style={{ padding: "6px 4px", textAlign: "center", color: C.text }}>{fmt(a.workloads)}</td>
              {GRID_COLS.map(([k]) => (
                <td key={k} title={`${fmt(a.values[k])}`} style={{ padding: "7px 4px", textAlign: "center", background: bandBg(a.bands[k]), color: bandFg(a.bands[k]), fontWeight: 600, borderRadius: 0, minWidth: 54 }}>{compact(a.values[k])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
        Top {rm.apps.length} of {rm.appsTotal} apps, ranked by the sum of the shaded bands (crown jewels first). Measures over the whole window.
        {rm.appsExcluded > 0 && ` ${fmt(rm.appsExcluded)} workloads without app or env are outside the grid.`}
        {rm.headline.unmanagedAdminPublic > 0 && ` ${fmt(rm.headline.unmanagedAdminPublic)} of the unmanaged admin sources are public addresses; they land on ${rm.apps.filter((a) => a.publicAdminSources > 0).slice(0, 4).map((a) => a.app).join(", ") || "apps outside the top rows"}.`}
      </div>
    </div>
  );
}

function EnvMatrix({ rm }) {
  const m = rm.envMatrix;
  if (!m.length) return <div style={{ color: C.muted, fontSize: 13 }}>{rm.inputs.summary ? "No allowed traffic between environments in this window." : "No estate summary saved."}</div>;
  const totals = {};
  m.forEach((r) => { totals[r.from] = (totals[r.from] || 0) + r.allowed; totals[r.to] = (totals[r.to] || 0) + r.allowed; });
  const envs = Object.keys(totals).sort((x, y) => totals[y] - totals[x]);
  const max = Math.max(1, ...m.map((r) => r.allowed));
  const look = {};
  m.forEach((r) => { look[`${r.from}|${r.to}`] = r; });
  const shade = (v) => bandBg(v <= 0 ? 0 : Math.min(4, 1 + Math.floor(4 * Math.sqrt(v / max) * 0.999)));
  const cell = { padding: "7px 4px", textAlign: "center", fontSize: 12, borderRadius: 0, minWidth: 54 };
  const th = { ...TH, padding: "6px 4px", fontSize: 10, letterSpacing: 0.3, textAlign: "center" };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "separate", borderSpacing: 2, fontSize: 12 }}>
        <thead><tr><th style={{ ...th, textAlign: "left", padding: "6px" }}>From / to</th>{envs.map((e) => <th key={e} style={th}>{e}</th>)}</tr></thead>
        <tbody>
          {envs.map((from) => (
            <tr key={from}>
              <td style={{ padding: "6px", fontWeight: 600, color: C.slate, whiteSpace: "nowrap" }}>{from}</td>
              {envs.map((to) => {
                const r = look[`${from}|${to}`];
                if (from === to || !r || !r.allowed) return <td key={to} style={{ ...cell, color: C.gray300 }}>{from === to ? "" : "·"}</td>;
                const b = Math.min(4, 1 + Math.floor(4 * Math.sqrt(r.allowed / max) * 0.999));
                return <td key={to} title={`${from} to ${to}: ${fmt(r.allowed)} allowed, ${fmt(r.potentiallyBlocked)} potentially blocked, ${fmt(r.blocked)} blocked`} style={{ ...cell, background: shade(r.allowed), color: bandFg(b), fontWeight: 600 }}>{compact(r.allowed)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Allowed connections between environments, whole window; the largest crossing is {m[0].from} to {m[0].to} with {fmt(m[0].allowed)} allowed and {fmt(m[0].blocked)} blocked.</div>
    </div>
  );
}

const stateStyle = { drafted: { bg: C.teal, color: C.white, label: "DRAFTED" }, provisioned: { bg: C.red, color: C.white, label: "PROVISIONED, REPORTED ALLOWED" } };
const StateBadge = ({ s }) => (stateStyle[s] ? <Badge label={stateStyle[s].label} bg={stateStyle[s].bg} color={stateStyle[s].color} /> : null);

// Policy read: provisioned only, or provisioned and draft with the delta. Tiles carry a
// coloured top border only when they mean something and are above zero.
function PolicyStrip({ pol }) {
  const ex = pol.exposures || { total: 0, drafted: 0, provisioned: 0, none: 0 };
  const d = pol.delta;
  const tile = (label, value, color, subtitle) => (
    <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 0, padding: "12px 14px", borderTop: `4px solid ${value > 0 && color ? color : C.gray300}`, minWidth: 0 }}>
      <div style={eyebrow}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 300, color: C.slate, lineHeight: 1.2, marginTop: 4 }}>{fmt(value)}</div>
      {subtitle && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{subtitle}</div>}
    </div>
  );
  const td = { padding: "6px 8px", borderBottom: `1px solid ${C.gray200}`, color: C.text };
  return (
    <div>
      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.45 }}>{pol.text}</div>
      {pol.view === "draft" ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginTop: 12 }}>
            {tile("Drafted, provision it", ex.drafted, C.teal, `of ${fmt(ex.total)} exposures: a draft deny or ringfence covers it`)}
            {tile("Provisioned, reported allowed", ex.provisioned, C.red, "a provisioned deny names it: review")}
            {tile("Nothing drafted", ex.none, C.orange, "the work left is to draft")}
            {tile("Pending changes", pol.pending.available ? pol.pending.pending : null, null, pol.pending.available ? "compare-draft-active, whole draft" : "compare-draft-active was not run")}
          </div>
          {d && (
            <div style={{ overflowX: "auto", marginTop: 12 }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
                <thead><tr>{["Draft against provisioned", "Rulesets", "Rules"].map((h) => <th key={h} style={{ ...TH, padding: "6px 8px" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {[["new", d.rulesetsNew, d.rulesNew, d.rulesNew ? ` (${d.newByKind.allow} allow, ${d.newByKind.deny} deny, ${d.newByKind.overrideDeny} override deny)` : ""], ["changed", d.rulesetsChanged, d.rulesChanged, ""], ["removed", d.rulesetsRemoved, d.rulesRemoved, ""]].map(([k, names, n, extra], i) => (
                    <tr key={k} style={{ background: i % 2 ? BAND : C.white }}><td style={{ ...td, fontWeight: 600, color: C.slate }}>{k}</td><td style={td}>{names.length ? names.join(", ") : "none"}</td><td style={td}>{fmt(n)}{extra}</td></tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{fmt(d.rulesetsUnchanged)} rulesets are the same in draft and active. Scores use the provisioned rules; the draft only says what is already waiting.</div>
            </div>
          )}
        </>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginTop: 12 }}>
          {tile("Provisioned, reported allowed", ex.provisioned, C.red, `of ${fmt(ex.total)} exposures: a provisioned deny names it, review`)}
          {tile("Pending changes, not read", pol.pending.available ? pol.pending.pending : null, null, pol.pending.available ? "in the draft; the draft view shows what they cover" : "compare-draft-active was not run")}
        </div>
      )}
    </div>
  );
}

function DriftTable({ rm }) {
  const th = (t) => <th style={{ ...TH, padding: "6px 8px" }}>{t}</th>;
  const td = { padding: "6px 8px", borderBottom: `1px solid ${C.gray200}`, fontSize: 12, color: C.text, verticalAlign: "top" };
  return (
    <div>
      <div style={{ fontSize: 12, color: C.text, marginBottom: 8 }}>
        Enabled provisioned override denies whose named traffic is reported allowed. A provisioned override deny on an enforcing workload reports blocked, so before adding rules check the enforcing side's mode, the rule's scope, its update time and the data itself.
        {rm.policy.delta && rm.policy.delta.newByKind.overrideDeny > 0 ? ` ${fmt(rm.policy.delta.newByKind.overrideDeny)} override den${rm.policy.delta.newByKind.overrideDeny === 1 ? "y exists" : "ies exist"} only in the draft and cannot show in traffic until provisioned.` : ""}
        {` ${fmt(rm.headline.overrideDeniesUnchecked)} override denies use shapes this check does not cover.`}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr>{th("Ruleset")}{th("Should stop")}{th("Reported allowed")}{th("Basis")}{th("Enforced on")}{th("Rule updated")}</tr></thead>
          <tbody>{rm.ruleDrift.map((d, i) => (
            <tr key={i} style={{ background: i % 2 ? BAND : C.white }}><td style={{ ...td, fontWeight: 600, color: C.slate }}>{d.ruleset}</td><td style={td}>{d.shouldStop}</td><td style={{ ...td, textAlign: "right", fontFamily: MONO }}>{fmt(d.allowed)}</td><td style={td}>{d.basis}</td><td style={td}>{d.enforcedOn}</td><td style={td}>{d.updatedAt}{d.changedInWindow ? " (changed inside the window)" : ""}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function ScoreBars({ items }) {
  if (!items.length) return <div style={{ color: C.muted, fontSize: 13 }}>No exposures with a draft fix.</div>;
  const max = Math.max(25, ...items.map((l) => l.score));
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {items.map((l) => (
        <div key={l.id} style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1.2fr) 3fr 60px", gap: 10, alignItems: "center", fontSize: 13 }}>
          <span style={{ color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><ClassBadge cls={l.cls} /> {l.title}</span>
          <div style={{ background: C.gray100, borderRadius: 0, height: 14 }}>
            <div style={{ width: `${(100 * l.score) / max}%`, height: 14, borderRadius: 0, background: l.bucket === "today" ? C.red : C.orange }} />
          </div>
          <span style={{ fontWeight: 600, color: C.slate, textAlign: "right" }}>{l.score}</span>
        </div>
      ))}
    </div>
  );
}

function LineTable({ rows, empty }) {
  const [open, setOpen] = useState(null);
  if (!rows.length) return <div style={{ color: C.muted, fontSize: 13 }}>{empty}</div>;
  const th = (t) => <th style={TH}>{t}</th>;
  const td = { padding: "8px 10px", borderBottom: `1px solid ${C.gray200}`, verticalAlign: "top", fontSize: 13, color: C.text };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead><tr>{th("Score")}{th("Class")}{th("Exposure")}{th("Fix")}{th("Blast radius")}{th("Ease")}{th("Would have blocked")}{th("")}</tr></thead>
        <tbody>
          {rows.map((l, i) => (
            <React.Fragment key={l.id}>
              <tr style={{ background: i % 2 ? BAND : C.white }}>
                <td style={{ ...td, fontWeight: 600, color: C.slate }}>{l.score}</td>
                <td style={td}><ClassBadge cls={l.cls} /></td>
                <td style={{ ...td, color: C.slate }}>{l.title}{l.state !== "none" && <span> <StateBadge s={l.state} /></span>}</td>
                <td style={td}>{kindLabel[l.kind] || l.kind}</td>
                <td style={td}>{l.blast} <span style={{ color: C.muted, fontSize: 12 }}>({l.radius})</span></td>
                <td style={td}>{l.ease}</td>
                <td style={td}><DecisionBar w={l.wouldHaveBlocked} /></td>
                <td style={td}><button onClick={() => setOpen(open === l.id ? null : l.id)} style={{ cursor: "pointer", border: `1px solid ${C.gray300}`, background: C.white, borderRadius: 0, fontFamily: FONT, fontSize: 12, padding: "3px 8px", color: C.text }}>{open === l.id ? "hide" : "detail"}</button></td>
              </tr>
              {open === l.id && (
                <tr><td colSpan={8} style={{ ...td, background: C.gray100, fontSize: 12, color: C.text }}>
                  <div><b>Recommendation:</b> {l.recommendation}</div>
                  <div style={{ marginTop: 4 }}><b>What we saw:</b> {l.detail}</div>
                  <div style={{ marginTop: 4 }}><b>Evidence:</b> {l.evidence.join("; ")}</div>
                  {l.admittingRules.length > 0 && <div style={{ marginTop: 4 }}><b>Admitted today by:</b> {l.admittingRules.join("; ")}</div>}
                  {l.cover.drafted.length > 0 && <div style={{ marginTop: 4 }}><b>Already drafted, not provisioned:</b> {l.cover.drafted.join("; ")}</div>}
                  {l.cover.provisioned.length > 0 && <div style={{ marginTop: 4 }}><b>Provisioned deny naming it, reported allowed:</b> {l.cover.provisioned.join("; ")}</div>}
                  <div style={{ marginTop: 4 }}><b>Rollback:</b> {l.rollback}</div>
                </td></tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TimelineChart({ b }) {
  if (!b.available || !b.series.length) return <div style={{ color: C.muted, fontSize: 13 }}>No timeline saved; run get-traffic-timeline for the baseline.</div>;
  const W = 900, H = 180, pad = 28;
  const max = Math.max(1, ...b.series.map((s) => s.flows));
  const bw = (W - pad * 2) / b.series.length;
  const y = (v) => H - pad - ((H - pad * 2) * v) / max;
  const spikes = new Set((b.spikeBuckets || []).map((s) => s.bucketStart));
  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={W} height={H} style={{ display: "block" }}>
        {b.series.map((s, i) => {
          const x = pad + i * bw;
          const hb = y(0) - y(s.blocked), hp = y(0) - y(s.pb);
          return (
            <g key={s.bucketStart}>
              <rect x={x + 1} y={y(0) - hb} width={Math.max(1, bw - 2)} height={hb} fill={C.red} />
              <rect x={x + 1} y={y(0) - hb - hp} width={Math.max(1, bw - 2)} height={hp} fill={C.orange} />
              {spikes.has(s.bucketStart) && <rect x={x} y={y(s.flows) - 2} width={Math.max(1, bw)} height={y(0) - y(s.flows) + 2} fill="none" stroke={C.red} strokeWidth={2} />}
            </g>
          );
        })}
        {b.threshold != null && <line x1={pad} x2={W - pad} y1={y(b.threshold)} y2={y(b.threshold)} stroke={C.red} strokeDasharray="5 4" strokeWidth={1.5} />}
        <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} stroke={C.gray300} />
        <text x={pad} y={H - 8} fontSize={10} fill={C.muted} fontFamily={FONT}>{b.series[0].bucketStart.slice(0, 10)}</text>
        <text x={W - pad} y={H - 8} fontSize={10} fill={C.muted} fontFamily={FONT} textAnchor="end">{b.series[b.series.length - 1].bucketStart.slice(0, 10)}</text>
        <text x={pad} y={14} fontSize={10} fill={C.muted} fontFamily={FONT}>max {fmt(max)} flows per {b.bucket}</text>
      </svg>
    </div>
  );
}

function CallPlanBlock({ c }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: C.slate }}>{c.for}: {c.tool || c.runbook} <Badge label="DO_NOT_CALL" bg={C.gray100} color={C.gray700} mono /></div>
      <pre style={{ background: C.gray100, border: `1px solid ${C.gray200}`, borderRadius: 0, padding: 10, fontSize: 11, color: C.text, fontFamily: MONO, overflowX: "auto", margin: "6px 0 0" }}>{c.json}</pre>
    </div>
  );
}

export default function App() {
  const tabs = ["Risk map", "Overview", "Block today", "This week", "Isolate on demand", "Watch", "Baseline", "Call plans"];
  const [tab, setTab] = useState("Risk map");
  const today = useMemo(() => lines.filter((l) => l.bucket === "today"), []);
  const week = useMemo(() => lines.filter((l) => l.bucket === "week"), []);
  const status = today.length ? "high" : week.length ? "medium" : "ok";
  const bannerTitle = today.length ? `${today.length} exposure${today.length > 1 ? "s" : ""} to block today` : week.length ? `${week.length} to fence or review this week` : "Nothing to draft";
  const subtitle = `${scope.windowStart} to ${scope.windowEnd} (${scope.windowDays} days) · production: ${scope.productionEnvs.join(", ") || "none"} · crown jewels: ${scope.crownJewels.join(", ") || "none"} · policy read: ${scope.policyView === "draft" ? "provisioned and draft" : "provisioned only"} · draft ruleset ${scope.rulesetName}` +
    (scope.lowerBounds.length ? ` · lower bounds on ${scope.lowerBounds.join(", ")}` : "") + (scope.missingInputs.length ? ` · missing inputs ${scope.missingInputs.join(", ")}` : "") + " · nothing is provisioned";
  const top = [...lines].sort((a, b) => b.score - a.score).slice(0, 5);

  return (
    <div style={{ fontFamily: FONT, background: C.gray50, minHeight: "100vh", padding: 20, color: C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 300, color: C.slate, letterSpacing: -0.2 }}>Rapid risk reduction</div>
          <div style={{ width: 40, height: 2, background: C.accent, margin: "6px 0 8px" }} />
          <div style={{ fontSize: 13, color: C.muted }}>Plan of {scope.date} · what to block or fence now, with the least chance of breaking something</div>
        </div>
        <Badge label="DRAFT ONLY · NOTHING PROVISIONED" bg={C.gray100} color={C.gray700} />
      </div>
      <div style={{ marginTop: 14 }}><StatusBanner status={status} title={bannerTitle} subtitle={subtitle} /></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
        <TabBar tabs={tabs} active={tab} onChange={setTab} />
        <ColourKey />
      </div>

      {tab === "Risk map" && (
        <>
          <div style={{ fontSize: 15, color: C.slate, marginTop: 16, lineHeight: 1.45, maxWidth: 820 }}>{riskMap.takeaway}</div>
          <Section title="Readiness">
            <ReadinessStrip r={riskMap.readiness} />
            <Legend items={LEGEND.readiness} />
          </Section>
          <Section title={riskMap.policy.view === "draft" ? "Policy: provisioned and draft, what is left to do" : "Policy: provisioned only"}>
            <PolicyStrip pol={riskMap.policy} />
            <Legend items={LEGEND.policy} />
          </Section>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginTop: 16 }}>
            <KPICard label="Workloads in full enforcement" value={riskMap.headline.fullEnforcement} subtitle={`of ${fmt(riskMap.headline.workloads)} · ${fmt(riskMap.headline.selective)} selective, ${fmt(riskMap.headline.notEnforcing)} not enforcing`} />
            <KPICard label="Unmanaged admin-port sources" value={riskMap.headline.unmanagedAdminSources} attention="medium"
              subtitle={riskMap.headline.unmanagedAdminPublic > 0 ? `${fmt(riskMap.headline.unmanagedAdminInternal)} internal, ${fmt(riskMap.headline.unmanagedAdminPublic)} public` : riskMap.headline.unmanagedAdminSources > 0 ? "all internal: identify first" : "none in this window"} />
            <KPICard label="Apps reaching most of the estate" value={riskMap.headline.wideReachApps} subtitle={riskMap.headline.wideReachApps == null ? "no lateral-movement result" : `of ${fmt(riskMap.headline.appsInGraph)} apps, three quarters or more, ${riskMap.headline.lateralDays} days${riskMap.headline.wideReachLowerBound ? " (lower bound)" : ""}`} />
            <KPICard label="Override denies not showing" value={riskMap.headline.overrideDeniesNotShowing} attention="high" subtitle={`${fmt(riskMap.headline.overrideDeniesUnchecked)} not checked (other rule shapes)`} />
          </div>
          <Section title="KPI borders"><Legend items={LEGEND.mapKpi} /></Section>
          <Section title="Where the risk sits">
            <HeatGrid rm={riskMap} />
            <Legend items={LEGEND.grid} />
          </Section>
          <Section title="Traffic between environments">
            <EnvMatrix rm={riskMap} />
            <Legend items={LEGEND.matrix} />
          </Section>
          {riskMap.ruleDrift.length > 0 && (
            <Section title="Rules not showing in traffic">
              <DriftTable rm={riskMap} />
              <Legend items={[["table text: no colour, no meaning", C.gray300]]} />
            </Section>
          )}
          {riskMap.ruleDrift.length === 0 && !riskMap.inputs.rulesets && (
            <Section title="Rules not showing in traffic"><div style={{ color: C.muted, fontSize: 13 }}>Not checked: no rulesets saved.</div></Section>
          )}
          <Section title="Fix first">
            {riskMap.fixFirst.length ? (
              <ol style={{ margin: "0 0 0 18px", padding: 0, fontSize: 13, color: C.text, lineHeight: 1.5 }}>
                {riskMap.fixFirst.map((s, i) => <li key={i} style={{ marginBottom: 6 }}>{s}</li>)}
              </ol>
            ) : <div style={{ color: C.muted, fontSize: 13 }}>Nothing stands out in this window.</div>}
            <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Generated from the evidence above; nothing has been changed on the PCE. The tabs behind this one hold every line, its score and its draft call plan.</div>
            <Legend items={[["list text: no colour, no meaning", C.gray300]]} />
          </Section>
        </>
      )}

      {tab === "Overview" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginTop: 16 }}>
            <KPICard label="Exposures with a fix" value={kpis.exposures} subtitle="draft rules and ringfences" />
            <KPICard label="Block today" value={kpis.blockToday} subtitle="deny, ease 4 or more" />
            <KPICard label="This week" value={kpis.thisWeek} subtitle="ringfences, denies after review" />
            <KPICard label="Isolation runbooks" value={kpis.runbooks} subtitle="held in reserve" />
            <KPICard label="Allowed connections that would stop" value={kpis.allowedWouldStop} subtitle="across all deny lines" attention="high" />
            <KPICard label="Watch" value={kpis.watch} subtitle="no draft fix" attention="medium" />
          </div>
          <Section title="KPI borders"><Legend items={LEGEND.kpi} /></Section>
          <Section title="Exposures by score">
            <ScoreBars items={[...lines].sort((a, b) => b.score - a.score)} />
            <Legend items={LEGEND.scores} />
          </Section>
          <Section title="Top recommendations">
            {top.length ? top.map((l) => (
              <div key={l.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderBottom: `1px solid ${C.gray200}`, fontSize: 13 }}>
                <BucketBadge b={l.bucket} />
                <div><b>{l.score}</b> · <ClassBadge cls={l.cls} /> {l.title}{l.state !== "none" && <span> <StateBadge s={l.state} /></span>}<div style={{ color: C.text, marginTop: 2 }}>{l.recommendation}</div></div>
              </div>
            )) : <div style={{ color: C.muted, fontSize: 13 }}>No exposures with a draft fix.</div>}
            <Legend items={[...LEGEND.buckets, ...LEGEND.lineState]} />
          </Section>
        </>
      )}

      {tab === "Block today" && (
        <Section title="Block today: deny or override deny with ease 4 or more">
          <LineTable rows={today} empty="Nothing qualifies: no deny with ease 4 or more." />
          <Legend items={[...LEGEND.decisions, ...LEGEND.lineState]} />
        </Section>
      )}

      {tab === "This week" && (
        <Section title="This week: fence, or deny after review">
          <LineTable rows={week} empty="Nothing this week." />
          <Legend items={[...LEGEND.decisions, ...LEGEND.lineState]} />
        </Section>
      )}

      {tab === "Isolate on demand" && (
        <Section title="Isolation runbooks (run only on a confirmed incident)">
          {runbooks.length ? runbooks.map((r) => (
            <div key={r.name} style={{ border: `1px solid ${C.gray200}`, borderRadius: 0, padding: 12, marginBottom: 10 }}>
              <div style={{ fontWeight: 600, color: C.slate }}>{r.name} <span style={{ fontWeight: 400, color: C.muted, fontSize: 12 }}>· {r.workloads} workloads in inventory{r.found ? "" : " · not found, check the label values"}</span></div>
              <ol style={{ margin: "8px 0 0 18px", padding: 0, fontSize: 13 }}>
                {r.steps.map((s, i) => <li key={i} style={{ marginBottom: 3, color: /override deny/.test(s) ? C.red : /provision-policy/.test(s) ? C.teal : C.text, fontWeight: /override deny|provision-policy/.test(s) ? 600 : 400 }}>{s}</li>)}
              </ol>
              <div style={{ fontSize: 12, color: C.text, marginTop: 6 }}><b>Effect:</b> {r.effect} <b>Undo:</b> {r.undo}</div>
            </div>
          )) : <div style={{ color: C.muted, fontSize: 13 }}>None: no crown jewels given and no production bridge app found; name one as app (env) and re-run.</div>}
          <Legend items={LEGEND.runbooks} />
        </Section>
      )}

      {tab === "Watch" && (
        <Section title="Watch: evidence without a draft rule">
          {watch.length ? watch.map((w, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderBottom: `1px solid ${C.gray200}`, fontSize: 13 }}>
              <ClassBadge cls={w.cls} />
              <div><b style={{ color: C.slate }}>{w.title}</b><div style={{ color: C.text, marginTop: 2 }}>{w.detail}</div><div style={{ color: C.muted, marginTop: 2 }}>Recommendation: {w.recommendation}</div></div>
            </div>
          )) : <div style={{ color: C.muted, fontSize: 13 }}>Nothing to watch.</div>}
          <Legend items={[["class badge: grey, no meaning", C.gray100]]} />
        </Section>
      )}

      {tab === "Baseline" && (
        <Section title={`Blocked and potentially blocked flows per ${baseline.bucket} (baseline for the 7-day review)`}>
          <div style={{ fontSize: 13, color: C.text, marginBottom: 8 }}>
            {baseline.available ? `${baseline.days} buckets of ${baseline.bucket} · median ${fmt(baseline.median)} · total ${fmt(baseline.total)}${baseline.truncated ? " (capped; lower bound)" : ""}${baseline.effectiveBucket && baseline.effectiveBucket !== baseline.bucket ? ` · the server says the rows support ${baseline.effectiveBucket} buckets` : ""} · ` : ""}
            {baseline.caveat ? `No spike quoted: ${baseline.caveat}` : baseline.worst ? `Worst spike ${baseline.worst.bucketStart} with ${fmt(baseline.worst.flows)} flows, ${baseline.worst.multiple}x the median` : baseline.available ? "No bucket above 3x the median" : ""}
          </div>
          <TimelineChart b={baseline} />
          <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>After provisioning, blocked should rise and potentially blocked fall; the deny lines account for {fmt(kpis.allowedWouldStop + kpis.pbWouldStop)} connections per window (the timeline counts flows: compare direction, not magnitude).</div>
          <Legend items={LEGEND.timeline} />
        </Section>
      )}

      {tab === "Call plans" && (
        <Section title="Call plans, in apply order (every block is DO_NOT_CALL)">
          <div style={{ fontSize: 12, color: C.text }}>In every block, for, tool, DO_NOT_CALL and _notes are not parameters. Override deny beats every allow and is used only for unknown admin-port sources and the runbooks. Nothing here has been executed.</div>
          {callPlans.length ? callPlans.map((c, i) => <CallPlanBlock key={i} c={c} />) : <div style={{ color: C.muted, fontSize: 13, marginTop: 8 }}>No call plans.</div>}
          <Legend items={[["DO_NOT_CALL badge: grey, no meaning", C.gray100]]} />
        </Section>
      )}

      <div style={{ fontSize: 11, color: C.muted, marginTop: 20 }}>
        Method: {scope.policyView === "draft" ? "ten" : "nine"} read-only illumio-mcp pulls scored by blast radius x ease (scores use the provisioned rules, the policy the reported decisions come from) (references/scoring.md); the risk map ranks apps by percentile bands of six measures and is not that score. Override deny is for incidents; a selective ringfence needs its deny rule; deny rules with a label consumer are enforced on the source, with an IP-list consumer at the destination; a deny bites only in selective or full enforcement; selective reports everything a deny does not catch as allowed. Labels are not assumed complete.
      </div>
    </div>
  );
}
