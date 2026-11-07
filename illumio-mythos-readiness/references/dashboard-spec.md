# Dashboard specification

The dashboard is a single-file React component (`.jsx`) in the same style
as the other Illumio dashboard skills: light mode, the Illumio Field
palette, Montserrat, square cards, text tabs with an Illumio Orange
underline, inline styles, every number embedded as a constant. It shows
what `readiness.json` holds and nothing it does not.

`scripts/readiness.py` writes `dashboard.jsx` itself: it takes
`dashboard-example.jsx` next to this file as the template and replaces
the block between the two marker lines with the readiness object. The
example therefore doubles as a worked rendering (its DATA is a
hand-written sample in the contract's shape) and as the template. The
skill never hand-builds the dashboard from prose; if the template is
missing, say so and ship the report without it.

## DATA contract

`dashboard-example.jsx` holds, each on its own line and exactly once:

```
// ===== DATA START =====
const DATA = {...};
// ===== DATA END =====
```

The script replaces everything between the two marker lines (markers
matched as whole lines, never as substrings) with
`const DATA = <json.dumps(readiness)>;`. `DATA` is the `readiness.json`
object exactly: `generated`, `date`, `rrr`, `inputs`, `ladder`,
`gate_text`, `estate`, `envs`, `apps`, `evidence`, `notes` (the shape is
in the skill's data contract; the component reads no other key). Nothing
else in the file changes, and nothing in the DATA block is hand-edited: a
number that looks wrong is fixed in the script and the block is
regenerated.

Every tab renders on a partial or empty `readiness.json`: missing keys
read as empty objects or arrays and each section then shows one grey
sentence. Gate ids and their order come from `ladder[].gates`; the words
for each gate come from `gate_text`; the component holds short column
labels and the plain-word headings for the step kinds, nothing more.

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
  borders are grey (counts are facts, not risks) except on the Evidence
  tab, where the risk map's own KPI rule applies. A colour key sits by
  the tab bar on every tab, and every section that uses colour ends with
  a `Legend` naming the colours used there. The legend texts live in one
  `LEGEND` constant.
- 16px gutters: the page padding and the card padding are 16px.
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
| Gate passes | Safeguard Green fill, white text | gate cells on the Apps tab |
| Gate fails | Risk Red fill, white text | gate cells on the Apps tab |
| Gate unknown (never passes) | grey `C.gray300` fill, slate text | gate cells on the Apps tab |
| Level 3 and above: holds without a human | Server Slate filled badge, white text | level badges on every tab; bars of the per-level distribution |
| Level 0 to 2: depends on a human noticing | Server Slate outline badge; grey `C.gray300` bars | same places |
| Step bucket today (an RRR line with ease 4 or more backs it) | Risk Red fill, white text | `TODAY` badge, Next steps |
| Step bucket week (an RRR line backs it) | Circuit Gold `#F97607` fill, slate text | `WEEK` badge, Next steps |
| Step bucket plan (human work, no RRR line) | grey `C.gray300` fill, slate text | `PLAN` badge, Next steps |
| Crown jewel | text badge `crown jewel`, grey, no colour | Apps, Next steps; `CJ` on the Evidence grid |
| An input was truncated or missing; counts from it are lower bounds | System Cyan: 10% tint with a 3px System Cyan left border | Method, Inputs section |
| Labelling readiness of the RRR run | grey ready, Circuit Gold partial, Risk Red not ready | Evidence tab |
| Risk map KPI borders | Risk Red when override denies not showing is above zero; Circuit Gold when unmanaged admin-port sources is above zero; grey otherwise | Evidence tab |
| Risk map bands 0 to 4 | one Server Slate tint, darker = higher percentile among the apps | Evidence grid and environment matrix |
| Tile top borders, section strips, borders | grey | no meaning |

Illumio Orange is not a status colour on this page: it marks the active
tab and the title rule only. Gold `#FFA22F` and System Cyan badges are
not used; the only cyan is the truncated or missing input line.

## Header

Title "Mythos readiness", the Illumio Orange rule, then one line: the
grading date (`date`), the RRR run date and traffic window (`rrr.date`,
`rrr.window`, `rrr.window_days`), the workload and row counts, the estate
level with its name. A grey badge `READ ONLY · NOTHING CHANGED ON THE
PCE` at the right. No banner: the grade has no single verdict colour.

## Tabs

The tab bar opens on **Readiness**; the four other tabs stay behind it.
No second file.

0. **Readiness**: the one-sentence definition of Mythos readiness; **The
   ladder**: six rows (level badge, name, the gates in words from
   `gate_text`, the attacker's view, "depends on a human noticing" or
   "holds without one"), the estate's row marked with a grey "estate is
   here" badge; four grey tiles (estate level with its name and the next
   level, in-force share, contained share, workloads with managed and
   labelled); **Apps and workloads per level**: the `estate.distribution`
   as a table with a bar per level, slate at level 3 and above, grey
   below; **Environments**: env, workloads, level badge, in-force share,
   contained share, next level, the rows to lift; **To the next level**:
   the 80% rule stated with `estate.threshold`, the share of managed
   labelled workloads already at the next level (derived from the app
   rows) and the bar it must reach, then `estate.to_next` as a table (app,
   env, workloads, level badge, first step). Every section ends with a
   legend.
1. **Apps**: two filters in the section head (env, level), the count line,
   the grid: app with the crown jewel badge, env, workloads, level badge,
   one cell per gate id in ladder order under a level group header
   (pass, fail, unknown; the cell's title attribute carries the gate in
   words and the reason), the first next-step sentence; under the table
   the gate words from `gate_text`; the legend. The table scrolls inside
   its card at phone width.
2. **Next steps**: the count line (steps, rows, today, week, plan), then
   one section per step kind in the fixed order label, pair a VEN, write
   policy, move enforcement, provision the deny, block or identify
   unknown source, deny the crossing, narrow inbound, ringfence, review
   account, check reach (a kind with no step gets no section); each row:
   bucket badge, app (env) with the crown jewel badge, the gate's short
   word, the sentence, the call-plan pointer in mono when present. The
   top line says call plans live in the RRR run's `call-plans.md` and
   nothing here writes to the PCE. Legend per section.
3. **Evidence**: a boxed line stating this is the rapid-risk-reduction
   risk map, unchanged, and where the call plans live; the takeaway; the
   labelling readiness verdict with counts and notes; the four headline
   KPI tiles with the risk map's border rule and its own legend section;
   **Where the risk sits**: apps ranked with the six measures shaded by
   band; **Traffic between environments**: the matrix; **Rules not
   showing in traffic**: the drift table or one grey sentence; **Fix
   first**: the ordered list. Everything comes from `evidence` and is
   rendered as RRR's Risk map tab renders it, in snake_case.
4. **Method**: **The gates in words**: level, gate id (mono), passes when
   (`gate_text`), holds; the level rule and the 80% rule in one
   paragraph; **Illumio semantics the gates rest on**: selective enforces
   deny rules only; full enforcement is default deny; a provisioned
   ruleset on a visibility-only workload changes nothing; a drafted rule
   changes nothing until provisioned; labels never assumed complete;
   nothing here writes to the PCE; **Inputs**: the RRR run's date,
   window, lateral days, policy view, crown jewels and source, the input
   file paths, the pulls saved, a System Cyan line for truncated pulls
   and one for missing ones; **Notes**: `notes` as a list. Legends.

Footer on every tab: the method line (the three input files, the ladder
by reference to `references/ladder.md`, the 80% rule with the threshold,
scores and call plans stay in the RRR run, nothing on the PCE was read or
changed).

## Empty states

Every tab renders with `DATA = {}` and with every array empty: one grey
sentence per section, counts show `n/a`, the header says "unknown date"
and "?" for the window, the Apps filters still work. No tab may throw on
a missing key, an app without `gates` or `next_steps`, an `evidence`
without `apps`, or an `estate` without `to_next`.

## Output

Save as `/mnt/user-data/outputs/illumio_mythos_readiness_<YYYY-MM-DD>.jsx`
when that directory exists, else next to `readiness.json`, and present
the file. It renders directly in Claude's UI.

## Checklist

The skill runs this before handing the dashboard over:

- [ ] The DATA block came from `scripts/readiness.py` (the block between the markers is `const DATA = <readiness.json>;` on one line) and was not hand-edited; every number on the page equals the matching number in readiness.json and readiness.md
- [ ] The two marker lines appear exactly once each, with nothing else on those lines
- [ ] Five tabs in this order: Readiness, Apps, Next steps, Evidence, Method
- [ ] The file renders with zero console errors at 1280px and at 400px (every tab clicked, errors and `console.error` both counted)
- [ ] Every section that uses a colour ends with a legend; the colour key sits by the tab bar on every tab
- [ ] At 400px nothing scrolls horizontally except tables inside their own card
- [ ] Gate cells follow the mapping: Safeguard Green pass, Risk Red fail, grey unknown; level badges filled Server Slate at level 3 and above and outlined below; bucket badges Risk Red today, Circuit Gold with slate text week, grey plan; the crown jewel is a text badge, not a colour
- [ ] Illumio Orange appears only as the active tab underline and the title rule
- [ ] The Apps grid has one column per gate id in `ladder[].gates` order and every row has a cell in each; the Next steps count equals the sum of `apps[].next_steps`
- [ ] The Evidence tab states that it is the RRR risk map unchanged and that call plans live in that run's `call-plans.md`
- [ ] The 80% rule is stated with `estate.threshold` on the Readiness and Method tabs
- [ ] Truncated and missing inputs are named on the Method tab when `rrr.truncated` or `rrr.missing_inputs` says so
- [ ] All tabs render with empty data
- [ ] No em dashes anywhere in the file
