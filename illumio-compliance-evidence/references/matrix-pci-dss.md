# PCI DSS v4.0.1: control-to-evidence matrix

Scope is the cardholder data environment (CDE) as a list of `app`/`env`
pairs the user confirms, plus connected-to and security-impacting systems
when the user names them. Requirement numbers are v4.0.1; the pack quotes
the requirement text from the official PCI SSC document, never from this
file. Tests are defined in `tests.md`.

| Requirement | What Illumio evidences | Tests | Evidence artifact | Not covered by Illumio |
| --- | --- | --- | --- | --- |
| 1.2.1 NSC configuration standards defined and implemented | active rulesets scoped to the CDE as the implemented standard | T5 | active ruleset table with scopes, rules, descriptions | the written standard itself |
| 1.2.5 All services, protocols and ports allowed are identified, approved and have a business need | the exact service set admitted into and out of the CDE by active rules, compared with the approved list | T7 | admitted-services table with the rule and justification per service | approval workflow |
| 1.2.6 Security features for insecure services | insecure services (telnet, FTP, SMBv1 ports, cleartext DB) in the admitted set are flagged | T7 | flagged rows in the admitted-services table | compensating controls |
| 1.2.7 NSC configurations reviewed at least every six months | the policy change events of the window and the user's last review attestation (rulesets carry no timestamps) | T11, T13 | event table, attestation row | review minutes |
| 1.3.1 Inbound traffic to the CDE restricted to necessary | no broad consumer into the CDE; observed inbound boundary flows all on approved services; zero potentially blocked | T6, T8 | boundary inbound flow table with policy decisions | |
| 1.3.2 Outbound traffic from the CDE restricted to necessary | observed outbound boundary flows all on approved egress; public destinations listed | T9 | boundary outbound flow table | proxy and DLP controls |
| 1.4.1 NSCs between trusted and untrusted networks | CDE workloads in full enforcement with healthy VENs, so default deny is live | T2, T3 | enforcement table, VEN health table | perimeter firewalls |
| 1.4.2 Inbound from untrusted networks restricted | zero allowed flows from public addresses or unknown endpoints into the CDE | T8, T10 | public-source rows of the inbound table, unknown-endpoint finding | |
| 1.4.4 CHD systems not directly accessible from untrusted networks | as 1.4.2 for the data-tier apps in scope | T8 | same, filtered to data-tier apps | |
| 10.2 Audit logs capture events | PCE events and flow records exist for the window | T14 | event sample, flow totals | log retention and SIEM |
| 11.4.5 Segmentation controls tested at least every 12 months | the control state and boundary evidence a tester verifies; the tester's report date attested | T8, T9, T12 | boundary tables, attestation row | the penetration test itself |
| 12.5.2 PCI DSS scope documented and confirmed every 12 months | the confirmed scope list with workloads, unmanaged entries in scope, and the unknown-endpoint check inside scope subnets | T1, T4, T10 | scope declaration, workload inventory, unknown-endpoint finding | data-flow diagrams |
| A1.1.2 / A1.1.3 (multi-tenant providers) logical separation | per-tenant scope separation as 1.3.x | T6, T8 | per-tenant boundary tables | |

Requirements this skill does not claim: 2.x (secure configurations), 3.x to
4.x (data protection), 5.x (malware), 6.x (software), 7.x and 8.x (identity),
9.x (physical), 11.x except 11.4.5, 12.x except 12.5.2. The pack lists them
as out of scope so a reader does not assume coverage.
