# Evidence pack structure (Markdown and Word)

The document rendering of `pack.json` (see `pack-schema.md`): one Word
document per framework and scope, in the illumio-pce-assessment style
(Arial, Illumio navy headings, status cells), built with the docx skill,
and the same content as Markdown for diffing between runs. Everything
below is a section heading in that order. The deck and the dashboard are
defined in `outputs.md`.

## Cover

Framework and version, scope name (for example "CDE, prod"), PCE and org,
window, date and time of collection with zone, pack version (run number),
and the sentence: "Evidence of segmentation controls collected from the
Illumio PCE. This pack supports the controls listed in section 3; it is
not a certification and does not cover requirements marked out of scope."

## 1. Scope declaration

The `app`/`env` pairs, who confirmed them and when, the workload count per
pair, and the label hrefs used in every query. Connected-to systems the
user named. The unknown-endpoint check for the scope subnets (T10) sits
here because it tests the scope boundary itself.

## 2. Method

One paragraph: active policy was read (never draft), traffic was read for
the window stated, every number comes from the tool results in the
appendix, tests are binary with the rule stated, items the PCE cannot
observe are attestations signed by a named person, and the pack is
re-runnable for drift.

## 3. Control summary

One table: requirement, test ids, result (PASS, FAIL, EXCEPTION,
ATTESTED, NOT TESTED; a row takes the worst of its tests in that order
from FAIL down to PASS, as `tests.md` defines), evidence section. Status
cells use the four colours and a legend row directly under the table:
red FAIL, orange EXCEPTION (justified failure or capped result), green
PASS, teal ATTESTED or NOT TESTED (the word in the cell tells them apart).
No other colour in the document carries meaning; the Method section
repeats this sentence.

## 4. Requirement sections (one per matrix row)

- Requirement text, quoted from the official source with its citation.
- Control as implemented in Illumio, in two sentences.
- Evidence: the tables for the tests named in the matrix row, each with
  the query that produced it (tool, arguments, timestamp) in a caption.
- Result and the rule that produced it.
- Gap and remediation when the result is FAIL, with an owner line left for
  the user.
- Out-of-Illumio note from the matrix.

## 5. Test results

The full T-table from `tests.md` with the measured values, the pass rule
and the result, so a reader can re-derive every status in section 3.

## 6. Attestations

One row per item the PCE cannot observe: the statement, who attests, date,
and the document they point to (review minutes, pen test report, drill
record). Empty rows stay in the table so the auditor sees what is missing.

## 7. Drift since the previous pack

When a previous pack's Markdown is available, cite its date and run
number, then one table with columns item, previous, current, change
(added, removed, changed) covering: each test whose result changed,
rulesets in scope added or removed, workloads in scope added or removed,
admitted services added or removed, unknown endpoints in scope subnets
appeared or resolved. Read the previous twin's section 5 and its evidence
index for the comparison. Otherwise "first run".

## 8. Out of scope

The matrix's "not claimed" list verbatim.

## Appendix A: Evidence index

One row per evidence file: file name, which tests use it, the tool and
arguments, collection timestamp, row count, SHA-256. This is the index an
auditor's evidence request is answered from.

## Appendix B: Raw results

Each tool result saved unmodified as JSON (or the text the tool returned)
under `evidence/<run>/NN-<tool>-<pair>.json` in call order (scope-wide
calls carry `all` as the pair), named in Appendix A. The docx
embeds the index, not the files.

## Other formats

The PowerPoint deck and the React dashboard are rendered from the same
`pack.json`; their structure is in `outputs.md` and the dashboard's
working example is `dashboard-example.jsx`.
