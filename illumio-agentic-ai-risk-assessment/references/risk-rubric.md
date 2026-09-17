# Risk rubric and regulatory mapping

## Scoring

Likelihood 1 to 5, impact 1 to 5, score is the product (1 to 25).

Likelihood is anchored on **observed traffic**, not on what could happen:

| Likelihood | Evidence |
| --- | --- |
| 5 | Path open, in daily use by several endpoints, no compensating control |
| 4 | Path open and in use, or in use by one endpoint |
| 3 | Path open (no deny matches), no observed use in the window |
| 2 | Path open but a compensating control exists outside Illumio (MFA, proxy) |
| 1 | Hypothetical: no path in policy and none observed |

Impact is anchored on the destination:

| Impact | Destination |
| --- | --- |
| 5 | Regulated zone (SWIFT, PCI, HIPAA), domain controllers, bastions |
| 4 | Personal data (HR, CRM, payroll), production databases |
| 3 | Other production applications |
| 2 | Non-production, dev, test |
| 1 | Egress to a sanctioned vendor with no internal reach |

Overall rating:

- **High**: any of R1 to R4 scores 15 or above
- **Medium**: the top score across all lines is 9 to 14
- **Low**: everything else

## Risk register lines

Include a line only when the trigger evidence exists. Fill assets, hosts and
counts from the merged flow table. Never invent a line to fill the table.

| # | Risk | Trigger evidence | Default impact |
| --- | --- | --- | --- |
| R1 | Agent-driven lateral movement via bastions | agent process to a host with `role` in {jumpbox, bastion, jump} or `app` in {jump-infra, bastion} on 22 or 3389 | 5 |
| R2 | Regulated or sensitive data exposure to model vendors | the same endpoint has an agent flow to a regulated or PII app **and** vendor egress from that agent | 5 |
| R3 | Regulated-zone scope creep (SWIFT, PCI, HIPAA) | agent flow to a host carrying a `compliance=*` label or `env=PCI` | 5 |
| R4 | Credential and Kerberos abuse | agent flow to `role=dc` or `app=ad` on 88, 389, 445, 464, 636, 3268, or any port not expected of a DC | 5 |
| R5 | Existing control not effective | a ruleset's name or description promises process restriction but its services are port-only | inherits the path it was meant to guard |
| R6 | Contractor or third-party endpoints as launchpads | `role=contractor` (or equivalent) endpoints run agents | 4 |
| R7 | Unmanaged host reached by agents | agent egress to an RFC1918 address that is not a managed workload | 4 |
| R8 | Personal-data processing without basis (GDPR) | agent flow to an app named hr, hrm, crm, payroll, people, or carrying `data=pii` | 4 |
| R9 | Shadow AI blind spot | ambiguous hosts plus unattributed rows above 10 percent of rows from the population | 3 |
| R10 | Label drift misdirects policy | `risk`, `tier` or similar labels contradict observed reach (Low Risk VDIs carry the most agent reach) | 3 |
| R11 | Local model runtime on endpoints | `ollama` or `LM Studio` present; data stays local but model files and prompts are unmanaged | 2 |

For each line the register row carries: ID, risk title, assets (hostnames or
label groups), evidence (one sentence with a count from the flow table),
likelihood, impact, score, the recommendation ID that closes it.

## Regulatory mapping

Practitioner's read, not legal advice. Say that in the report.

Include only regimes the org plausibly falls under. Infer from labels:

| Signal in the PCE | Regime |
| --- | --- |
| `compliance=SWIFT` or app named swift | SWIFT CSCF |
| `env=PCI`, `compliance=PCI-DSS`, app named pos, payment, card | PCI DSS v4.0 |
| `compliance=HIPAA`, app named ehr, patient, `bu=health` | HIPAA Security Rule |
| any EU `loc` value, or org known to be in the EU | GDPR, NIS2, EU AI Act (always include these three for EU orgs) |
| financial `bu` values (bank, treasury, trading, insurance, payments) | DORA |

Reference set. Quote the article and one line of evidence from this run.

| Regime | Requirement that bites | Evidence pattern |
| --- | --- | --- |
| DORA Art. 9 | Network segmentation, least privilege, restriction of access to ICT assets | endpoints with agents reach N internal apps with no process-qualified rule |
| DORA Art. 28 | Third-party ICT service providers must be managed and contracted | model vendors receive traffic without a register entry |
| NIS2 Art. 21(2)(i) | Access control policies and asset management | agents run on N endpoints not covered by an AI-use inventory |
| NIS2 Art. 21(2)(d) | Supply chain security | vendor egress not restricted to sanctioned providers |
| EU AI Act Art. 4 | AI literacy obligations for staff using AI systems | contractors and employees run agentic tools without evidence of training |
| EU AI Act Art. 26 | Deployer duties; generally not high-risk for coding assistants, note it | agents used for HR data (R8) may edge toward Annex III use |
| PCI DSS v4.0 Req. 1 | Network security controls between CDE and other networks | agent flows into `env=PCI` hosts |
| PCI DSS v4.0 Req. 6.4 | Protection of public-facing apps and change control | agents writing to PCI app hosts on non-service ports |
| PCI DSS v4.0 Req. 7 | Restrict access by business need to know | endpoint population, not admins, reaches CDE |
| SWIFT CSCF 1.1 | SWIFT environment protection, separation from general IT | endpoints with agents reach SWIFT-labelled hosts |
| SWIFT CSCF 2.9 | Transaction business controls | agent traffic on non-SWIFT ports into the secure zone |
| SWIFT CSCF 6.1 | Malware protection on operator PCs | agentic clients on operator endpoints are unmanaged software |
| SWIFT CSCF 6.4 | Logging and monitoring | flows are visible but not alerted on |
| HIPAA 164.312(a)(1) | Access control | agent reach into PHI apps |
| HIPAA 164.312(e)(1) | Transmission security | PHI-adjacent endpoints egress to vendors |
| GDPR Art. 28 | Processor contracts | model vendor receives personal data without a DPA |
| GDPR Art. 32 | Security of processing | segmentation gap between endpoints and HR/CRM |
| GDPR Art. 35 | DPIA for high-risk processing | agent use on personal data has no DPIA on record |

Keep the report's regulatory table to one row per regime article that has
evidence. Drop rows without evidence.
