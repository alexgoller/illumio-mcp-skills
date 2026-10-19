# Output formats

The user picks any set of: `json`, `md`, `docx`, `pptx`, `jsx`. Default
when they do not say: `json`, `md`, `docx`. `pack.json` is always written
first, and every other format is rendered from it, never from the tool
results directly. Files share one base name,
`Illumio_Evidence_<framework>_<scope>_<YYYY-MM-DD>`, under
`/mnt/user-data/outputs/` when it exists, else the working directory; the
evidence folder is zipped beside them. Present every file produced.

Colour in every format follows the repo convention: status colours only
(red FAIL, orange EXCEPTION, green PASS, teal ATTESTED and NOT TESTED),
a legend wherever they appear, no decorative colour.

## json

`pack.json` as in `pack-schema.md`, pretty-printed, UTF-8. Nothing else.
A second file, `pack.min.json`, only on request.

## md

The Markdown twin along `pack-template.md`: cover block, sections 1 to 8,
Appendix A as a table. Status words in capitals, no colour. It is the diff
base for the next run's drift.

## docx

Built with the docx skill from the Markdown twin, in the style of
`illumio-pce-assessment`: Arial, Illumio navy headings, status cells with
the legend row under every table that uses them, the KPI tiles on the
cover (pairs, workloads, PASS, FAIL, EXCEPTION, open attestations) with
their caption. Validate with the docx skill's validator before presenting.

## pptx

Built with the pptx skill. Illumio palette, DM Sans or Arial, one message
per slide, a legend strip on every slide that uses status colours. Deck:

1. Title: framework and version, scope name, run date, overall status as
   one coloured word with the legend strip.
2. Scope and method: the pairs table (app (env), workloads, managed), the
   window, "active policy", the query count, the disclaimer sentence.
3. Control summary: the requirements table with status cells, split over
   two slides when more than twelve rows.
4. One slide per requirement whose result is FAIL or EXCEPTION: requirement
   id and title, the control in one sentence, the measured values from the
   test rows (at most eight rows), gap, remediation, owner line.
5. Attestations: the table, empty rows kept and marked NOT TESTED.
6. Drift: the drift table, or "first run".
7. Out of scope: the `not_covered` list.
8. Evidence index: file, tool, collected at, hash prefix (first 12
   characters), split over slides of fifteen rows.

No slide carries a number that is not in `pack.json`.

## jsx

A single-file React dashboard in the style of the other skills, built
from `dashboard-example.jsx` next to this file: keep its components,
replace the block between `// ==== DATA ====` and `// ==== END DATA ====`
with the `pack.json` content. The example's data block holds file names
in every `evidence` list; a pack built from `collect-compliance-evidence`
holds query descriptors there too, which the Requirements rows show as
`tool` plus `query_name` (one line in the example's join) and the Evidence
tab shows under the tool result's index row. Tabs: Overview (status
banner, KPIs, findings), Requirements (status filter, expandable rows with
tests and evidence: files and query descriptors), Tests (per pair,
measured values), Boundary (admitted
services and crossings with policy bars, the timeline), Attestations,
Drift (only with a previous run), Evidence (index with hashes). Colour key
next to the tab bar and a legend in every section, as
`illumio-unknown-endpoints/references/dashboard-spec.md` requires. Saved
as `<base name>.jsx`.
