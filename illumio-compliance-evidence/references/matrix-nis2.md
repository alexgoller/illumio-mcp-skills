# NIS2: control-to-evidence matrix

NIS2 is Directive (EU) 2022/2555, applied through national law (Germany:
the NIS2 implementation act and BSI guidance), with Implementing
Regulation (EU) 2024/2690 giving detailed measures for digital
infrastructure and ICT service providers. Scope is the set of `app`/`env`
pairs that deliver the essential or important service, as the user
confirms. The pack cites the national transposition the user names and
quotes requirement text from the official sources, never from this file;
the Annex section numbers of 2024/2690 below are references to check when
the pack is assembled. Tests are defined in `tests.md`.

| Requirement | What Illumio evidences | Tests | Evidence artifact | Not covered by Illumio |
| --- | --- | --- | --- | --- |
| Art 21(2)(a) risk analysis and information system security policies | segmentation policy for the scope, as implemented in active rulesets | T5 | active ruleset table | the policy documents |
| Art 21(2)(b) incident handling; IR 2024/2690 Annex 3.2 monitoring and logging | blocked and potentially blocked flows per day for the scope (T8 call 4); PCE events | T8, T11, T14 | timeline table, event sample | SOC process |
| Art 21(2)(d) supply chain security | supplier access to the scope as named IP lists or labels with justification; no default Any list | T6, T7 | third-party rule rows | supplier contracts |
| Art 21(2)(e) network and information systems security; Annex 6.7 network security | full enforcement on scope workloads, no broad consumer, approved services only, public sources excluded | T2, T6, T7, T8 | enforcement table, admitted-services table, boundary tables | patching, hardening |
| Annex 6.8 network segmentation | the scope boundary: rules, enforcement, observed crossing flows, no unknown hosts inside it | T5, T6, T8, T9, T10 | ruleset table, boundary tables, unknown-endpoint finding | |
| Art 21(2)(f) effectiveness assessment; Annex 7 | the binary test results and their dates, re-runnable for drift | all | test results table, previous-run comparison | audit programme |
| Art 21(2)(i) access control and asset management; Annex 11 access control; Annex 12.4 asset inventory | labelled inventory with VEN state; unknown endpoints inside scope subnets; access expressed as rules | T1, T3, T4, T10 | inventory table, unknown-endpoint finding | identity, MFA |
| Annex 6.3 configuration management and 6.4 change management | draft-versus-active in sync; provisioning events with actor and time | T11 | drift result, provisioning event table | change process |
| Art 21(2)(c) business continuity; isolation of affected assets | isolation ruleset in active policy and the dated drill attestation | T12 | isolation evidence, attestation row | BCP/DR plans |

Not claimed: cyber hygiene and training (Art 21(2)(g)), cryptography (h),
HR security (i, partly), MFA (j), reporting obligations (Art 23), and the
registration and governance duties of the national law.
