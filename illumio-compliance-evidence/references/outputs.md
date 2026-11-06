# Output formats

The user picks any set of: `json`, `md`, `docx`, `pptx`, `jsx`. Default
when they do not say: `json`, `md`, `docx`. `pack.json` is always written
first, and every other format is rendered from it, never from the tool
results directly. Files share one base name,
`Illumio_Evidence_<framework>_<scope>_<YYYY-MM-DD>`, under
`/mnt/user-data/outputs/` when it exists, else the working directory; the
evidence folder is zipped beside them. Present every file produced.

Colour in every format follows Illumio Field, below: status colours only
(Risk Red FAIL, Circuit Gold EXCEPTION, Safeguard Green PASS, System Cyan
ATTESTED and NOT TESTED), a legend wherever they appear, no decorative
colour, Illumio Orange never as a status.

### Illumio Field

Every rendered output of every skill in this repo follows the Illumio Field
design system, which implements the visual identity of the Illumio Brand
Guidelines (November 2024). Visual identity only; no brand messaging.

- **Grounds.** Page on Zero Trust Tan `#F7F4EE`; cards, panels and tables
  white; square corners (0, at most 2px on small tags); 1px borders
  `#D6D7D7`; table banding `#EAEBEB`.
- **Text.** Server Slate `#313638` for headings and primary text, `#464A4C`
  for body, `#64686A` for captions and labels, `#6F7274` the lightest
  colour for small text on white. Page title in weight 300 (Light);
  eyebrows and section labels in Server Slate SemiBold caps; emphasis
  SemiBold.
- **Font.** `"FK Grotesk", Montserrat, Arial, sans-serif`; load Montserrat
  300, 400, 500 and 600 from Google Fonts.
- **Accent.** Illumio Orange `#FF5500` is the one brand accent: the active
  tab underline, the rule under the page title, a "today" or "new" marker.
  As text only at 24px and up or bold on white; never on tan (contrast
  1.1); never as a status colour.
- **Status colours**, for meaning only, each with a legend where it
  appears: Risk Red `#BE122F` critical, failed, blocked; Safeguard Green
  `#166644` pass, allowed, enforced, healthy; Circuit Gold `#F97607`
  warning, high; Gold `#FFA22F` medium; System Cyan `#2D454C` info,
  selective, in progress. Red, green and cyan may be text on white; gold
  is a fill, swatch, border or bar with slate text, never small text.
  Row and badge tints are the status colour at 10% over white
  (`rgba(190,18,47,0.10)` and so on), never a separate hue.
- **Tables.** Server Slate header row with white text, light banding,
  hairline borders.
- **Decoration.** None in colour: section strips, dividers and inactive
  elements are slate greys.

## json

`pack.json` as in `pack-schema.md`, pretty-printed, UTF-8. Nothing else.
A second file, `pack.min.json`, only on request.

## md

The Markdown twin along `pack-template.md`: cover block, sections 1 to 8,
Appendix A as a table. Status words in capitals, no colour. It is the diff
base for the next run's drift.

## docx

Built with the docx skill from the Markdown twin, in the Illumio Field
document style shared with `illumio-pce-assessment`:

- Font Montserrat, with Arial as the fallback when Montserrat is not
  installed on the machine that opens the file (declare both, Montserrat
  first).
- Headings Server Slate `#313638` SemiBold; body text `#464A4C`.
- Tables: header row Server Slate with white text, hairline borders
  `#D6D7D7`, banding `#EAEBEB`, square cells.
- Status cells: FAIL Risk Red `#BE122F`, EXCEPTION Circuit Gold `#F97607`,
  PASS Safeguard Green `#166644`, ATTESTED and NOT TESTED System Cyan
  `#2D454C`; white text on red, green and cyan, Server Slate text on
  gold. The legend row directly under every table that uses them stays
  exactly as `pack-template.md` section 3 requires.
- The KPI tiles on the cover (pairs, workloads, PASS, FAIL, EXCEPTION,
  open attestations) with their caption: white, square, 1px `#D6D7D7`
  border; a status colour only as a tile's top border and only when its
  count is above zero.
- Logo: the Illumio logo from the Illumio Field design system assets when
  the session has it (the `illumio-field-style` skill describes how);
  never redraw it; without it, no logo.

Validate with the docx skill's validator before presenting.

## pptx

Built with the pptx skill in the Illumio Field slide style, the corporate
template look: 16:9, Montserrat with Arial as the fallback, one message
per slide, a legend strip on every slide that uses status colours.

- Content slides on Zero Trust Tan `#F7F4EE`: title top-left in
  Montserrat Light, footer bottom-left in muted grey `#64686A`.
- Title, divider and closing slides on Server Slate `#313638` with white
  text.
- Numbered steps as hexagons, Server Slate or Illumio Orange `#FF5500`
  fill with a white number.
- Cards white and square, optional 8px top border (Server Slate for what
  exists, Illumio Orange for what is new).
- Tables: Server Slate header row with white text, hairline borders
  `#D6D7D7`, banding `#EAEBEB`.
- Status colours as in the docx: Risk Red `#BE122F`, Circuit Gold
  `#F97607` with slate text, Safeguard Green `#166644`, System Cyan
  `#2D454C`; the legend strip on every status slide.
- Illumio Orange only for large text (24pt and up) or accents, never on
  tan, never as a status.
- Logo: the Illumio logo from the Illumio Field design system assets when
  the session has it (the `illumio-field-style` skill describes how;
  white logo on slate slides, colour logo on tan); never redraw it;
  without it, no logo.

Deck:

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

A single-file React dashboard in the Illumio Field style above, built
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
