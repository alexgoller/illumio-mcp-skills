# Dashboard specification

The dashboard is a single-file React component (`.jsx`) in the same style
as the other Illumio dashboard skills: light mode, the Illumio Field
palette, Montserrat, square cards, text tabs with an Illumio Orange
underline, inline styles, every number embedded as a constant. It shows
what `advice.json` holds and nothing it does not.

`scripts/advise.py` writes `dashboard.jsx` itself: it takes
`dashboard-example.jsx` next to this file as the template and replaces
the block between the two marker lines with the advice. The example
therefore doubles as a worked rendering (its DATA is a hand-written
sample in the schema's shape) and as the template. Do not hand-build the
dashboard from prose; if the template is missing, say so and ship the
report and the plan without it.

## DATA contract

`dashboard-example.jsx` holds, each on its own line and exactly once:

```
// ===== DATA START =====
const DATA = {...};
// ===== DATA END =====
```

The script replaces everything between the two marker lines (markers
matched as whole lines, never as substrings) with
`const DATA = <json.dumps(advice)>;`. `DATA` is the `advice.json` object
exactly: `generated`, `window`, `inputs`, `dimensions`, `readiness`,
`conventions`, `hubs`, `suggestions`, `conflicts`, `unresolved`, `plan`
(the shape is in the skill's data contract; the component reads no other
key). Nothing else in the file changes, and nothing in the DATA block is
hand-edited: a number that looks wrong is fixed in the script and the
block is regenerated.

Every tab renders on a partial or empty `advice.json`: missing keys read
as empty objects or arrays and each section then shows one grey sentence.
A row's `plan.workloads[].new_labels` may hold `"key=value"` strings or
`{key, value}` objects; both put the NEW badge on the matching add.

## Conventions shared with the other dashboards

- React with hooks, one default export, inline `style={{}}` only, no
  external calls, Montserrat (300, 400, 500, 600) via a `<link>` in the
  component body, no chart library (the bars are plain divs).
- Palette `C`, `FONT`, `MONO` and `BAND` as in the Illumio Field section
  below: page ground Zero Trust Tan, white square cards with 1px
  `C.gray200` borders, table header rows Server Slate with white text,
  banding `#EAEBEB`, page title in weight 300, section titles and
  eyebrows Server Slate SemiBold caps, badges rounded at most 2px, no
  pills; the active tab carries a 2px Illumio Orange underline and the
  page title its 2px rule, and Illumio Orange appears nowhere else.
- **Colour carries meaning only.** Section strips are grey. Tile top
  borders are grey (counts are facts, not risks). A colour key sits by
  the tab bar on every tab, and every section that uses colour ends with
  a `Legend` naming the colours used there. The legend texts live in one
  `LEGEND` constant.
- Phone width: at 400px nothing scrolls horizontally except tables, which
  scroll inside their own card (`overflowX: auto` on the table wrapper,
  never on the page).

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

## Colour mapping

| Meaning | Colour | Where it appears |
| --- | --- | --- |
| Confidence high (two independent signal kinds agree, or a convention with support 5 or more and no counter-example) | Safeguard Green fill, white text | `HIGH` badge: Suggestions, Conflicts, Apply plan |
| Confidence medium (one signal) | Gold `#FFA22F` fill, slate text | `MEDIUM` badge, same tabs |
| Confidence low (model knowledge only) | grey `C.gray300` fill, slate text | `LOW` badge, same tabs |
| Suggestion written by the model, not the script | System Cyan outline badge `MODEL` | Suggestions source column |
| An input was truncated or missing; counts from it are lower bounds | System Cyan: 10% tint with a 3px System Cyan left border | Readiness, Inputs section |
| Conflict: the evidence disagrees with a label the workload already carries | Risk Red 10% tint on the row only | Conflicts tab |
| Workloads that carry the label; VEN reports listeners; flows carry a process | Server Slate bar segment | Readiness coverage and process visibility bars |
| Workloads missing the label; no listeners; no process name | grey `C.gray300` bar segment | same bars |
| A value not yet in the label vocabulary | `NEW` badge, grey mono, no colour | Suggestions, Apply plan |
| Dimension key, `(custom)` for a non-standard key | grey mono badge, no colour | every table that names a dimension |
| Tile top borders, section strips, borders | grey | no meaning |

Circuit Gold `#F97607` and Illumio Orange are not status colours on this
page: Illumio Orange marks the active tab and the title rule only, and
no warning state exists in the advice. Nothing on the page is red except
the conflict rows and the colour key chip that explains them.

## Header

Title "Label advisor", the Illumio Orange rule, then one line: advice
date (`generated`), traffic window (`window.start` to `window.end`,
`window.days`), the workload count, the suggestion and conflict counts.
A grey badge `ADVICE ONLY · NOTHING APPLIED` at the right. No banner: the
advice has no verdict, so no status colour belongs in the header.

## Tabs

The tab bar opens on **Readiness**; the five other tabs stay behind it.
No second file.

0. **Readiness**: four grey tiles (workloads with managed, unmanaged and
   online; fully labelled; partly labelled; unlabelled); **Label coverage
   per dimension**: one two-segment bar per dimension in
   `dimensions.standard` then `dimensions.custom` (custom marked), slate
   for labelled and grey for missing, counts and the labelled share
   beneath, a dimension without coverage counted gets one grey sentence,
   then the vocabulary line (standard and custom keys, every value per
   key); **VEN process visibility**: the same bar for workloads with and
   without listeners and for flows with and without a process name, then
   the traffic line (flows, calls, truncated calls, window); **Inputs**:
   the file list, a System Cyan info line for the truncated files and one
   for the missing files, or a grey sentence when neither exists;
   **Hubs**: table hostname, port, process, sources, kind, found by
   (`infra-tool` reads as identify-infrastructure-services, `fan-in` as
   fan-in count), with the note that a hub's peers say little about its
   own labels; **Notes**: `readiness.notes` as a list. Every section ends
   with a legend.
1. **Suggestions**: three filters in the section head (dimension from
   `dimensions`, confidence, source), the count line (shown of total, high,
   medium, low, from the model, new values, distinct workloads), the table
   hostname, dimension badge, value with `NEW` where `new_value` is true,
   confidence badge, source (`MODEL` outline badge or plain "script"),
   signals as plain text `kind: evidence` joined by semicolons; the note
   that a suggestion never names a dimension the workload already carries;
   the legend.
2. **Conventions**: the explanation of support and counter, the table
   dimension, rule, token (mono), value, support, counter; legend.
3. **Conflicts**: the explanation that nothing here enters the plan, the
   table hostname, dimension, existing, suggested, confidence, signals,
   every row on the Risk Red tint; legend naming the tint first.
4. **Unresolved**: two sections. **Processes and ports not in the role
   table**: process (mono), port/proto, OS, workloads, hosts joined by
   commas, with the sentence that the model reads these and writes
   model-suggestions.json. **Workloads with nothing to go on**: hostname,
   missing dimensions as badges, why. Legends.
5. **Apply plan**: the preferences line (dimensions, minimum confidence,
   scope, dry run or live run requested); three grey tiles (workloads to
   update, labels to add, labels to create); **Per workload**: hostname,
   before, adds (SemiBold mono, `NEW` after an add listed in the row's
   `new_labels`), after, confidence as one badge per added key; **New
   labels**: key, value with `NEW`, workloads; then the boxed note that
   this page applies nothing and the apply step belongs to the skill
   (create-label, update-workload, rollback in plan.md). When `plan` has
   no preferences and no workloads the tab is one grey sentence.

Footer on every tab: the method line (read-only pulls, the confidence
rules by reference to `references/inference.md`, nothing on the PCE was
changed).

## Empty states

Every tab renders with `DATA = {}` and with every array empty: one grey
sentence per section, counts show `n/a`, the header says "unknown date"
and "?" for the window, the Suggestions filters still work. No tab may
throw on a missing key, an empty object in `readiness.coverage`, a
`plan` without `preferences`, or a suggestion without `signals`.

## Output

Save as `/mnt/user-data/outputs/illumio_label_advisor_<YYYY-MM-DD>.jsx`
when that directory exists, else next to `advice.json`, and present the
file. It renders directly in Claude's UI.

## Checklist

The skill runs this before handing the dashboard over:

- [ ] The DATA block came from `scripts/advise.py` (the block between the markers is `const DATA = <advice.json>;` on one line) and was not hand-edited; every number on the page equals the matching number in advice.json and suggestions.md
- [ ] The two marker lines appear exactly once each, with nothing else on those lines
- [ ] The file renders with zero console errors (every tab clicked, errors and `console.error` both counted)
- [ ] Every section that uses a colour ends with a legend; the colour key sits by the tab bar on every tab
- [ ] At 400px nothing scrolls horizontally except tables inside their own card
- [ ] Confidence badges follow the mapping: Safeguard Green high, Gold with slate text medium, grey low; `MODEL` is a System Cyan outline; the Risk Red tint appears on conflict rows only
- [ ] Illumio Orange appears only as the active tab underline and the title rule
- [ ] The suggestion count line equals `suggestions.length`; the plan tiles equal `plan.counts`; the new labels table equals `plan.new_labels`
- [ ] Truncated and missing inputs are named on the Readiness tab when `inputs.truncated` or `inputs.missing` is non-empty
- [ ] The Apply plan tab says the apply step is the skill's, not the dashboard's
- [ ] All tabs render with empty data
- [ ] No em dashes anywhere in the file
