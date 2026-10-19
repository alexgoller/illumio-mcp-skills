# DORA: control-to-evidence matrix

DORA is Regulation (EU) 2022/2554; the technical detail sits in the RTS on
the ICT risk management framework, Delegated Regulation (EU) 2024/1774.
Scope is the set of `app`/`env` pairs that support critical or important
functions, as the user confirms from their register of information. The
pack quotes article text from EUR-Lex, never from this file; article
numbers below are references to check against the official text when the
pack is assembled. Tests are defined in `tests.md`.

| Requirement | What Illumio evidences | Tests | Evidence artifact | Not covered by Illumio |
| --- | --- | --- | --- | --- |
| Art 8(1), 8(4), 8(6) identification: ICT assets and their dependencies identified, inventoried and kept current | labelled workload inventory for the scope with VEN state; unknown endpoints inside scope subnets; app-to-app dependencies from traffic | T1, T3, T10, T9 | inventory table, unknown-endpoint finding, dependency table | the register of information itself |
| RTS 2024/1774 Art 4 ICT asset management policy (inventory, classification, lifecycle) | as above, with classification carried as labels | T1, T4 | inventory table with labels | asset classification scheme |
| Art 9(2) continuous monitoring and control of ICT systems | flow visibility across the scope boundary for the window, blocked and allowed | T8, T9, T14 | boundary tables, flow totals | SIEM |
| Art 9(3) and 9(4)(b) policies limiting logical access to ICT assets; network segmentation | CDE-style boundary: full enforcement, no broad consumer, approved services only | T2, T5, T6, T7 | enforcement table, ruleset table, admitted-services table | identity and MFA |
| RTS 2024/1774 Art 13 network security management: segmentation and segregation, documented network flows, review | the same segmentation evidence plus the change events and the review attestation (rulesets carry no timestamps) | T5, T7, T8, T11, T13 | as above plus event table and attestation | network diagrams |
| Art 9(4)(c) and 10 detection: mechanisms to detect anomalous activity | blocked and potentially blocked flows per day for the scope (T8 call 4), spikes named | T8 | timeline table | alerting pipeline |
| Art 9(4)(d) and 11 response and recovery: ability to isolate ICT assets | the isolation capability (ringfence or isolation ruleset in active policy) and the dated drill attestation | T12 | isolation ruleset evidence, attestation row | the drill itself; this skill never runs an isolation |
| Art 9(4)(e) change management: ICT changes recorded, tested, approved | draft-versus-active in sync for scoped rulesets; provisioning events with actor and time | T11 | drift result, provisioning event table | change tickets |
| Art 24 to 26 digital operational resilience testing, incl. TLPT where applicable | the evidence a tester uses, and the attested test date | T8, T9, T12 | boundary tables, attestation | the test |
| Art 28 to 30 ICT third-party risk: access by providers controlled | third-party access expressed as named IP lists or labels, never the default Any list | T6, T7 | third-party rule rows | contracts and register |
| RTS 2024/1774 Art 12 logging | PCE events and flow records exist for the window | T14 | event sample, flow totals | retention policy |

Not claimed: governance (Art 5), ICT-related incident reporting (Art 17 to
23), information sharing (Art 45), and anything about the register of
information beyond what labels and traffic show.
