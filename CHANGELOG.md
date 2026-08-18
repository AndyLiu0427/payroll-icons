# Changelog

All notable changes to this package are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

While the major version is 0, the shape of a mark may change in a minor
release — the drawings are still settling. The component API will not.

## [Unreleased]

### Added

- **A `draft` modifier**, and `pay-run-draft` / `assignment-draft` with it.
  Draft was the one state the vocabulary could not say, so `payslip-draft` had
  been borrowing `pending` — but a draft is unsent and pending is sent and
  waiting, which are different rows in a list and different actions to take.

  The glyph is a pencil, drawn into the badge zone directly rather than inside
  a disc, the way `locked` and `recurring` already are. Its tip sits at the
  badge's diagonal extreme, so the weight it needed came from widening the body
  rather than lengthening it — growing it kept the tip 0.03 units from the
  knockout edge, against the 0.5 clear ring the disc modifiers hold.

  Which marks got the state came from the server rather than from guessing:
  `Draft` is a real status on `PayrollRun` and on `Assignment`, and there is no
  payslip status at all. The speculative `payslip-draft` concept is gone and
  `payroll-run-draft` and `assignment-draft` replace it. The backlog of
  concepts borrowing another mark drops from 13 to 12.

- **`social-insurance`, and `levy` from composition.** SOCSO, EIS, SDL and FWL
  were all borrowing the generic `shield`, which meant four different statutory
  schemes drew the same mark — and Malaysia, where SOCSO and EIS appear on the
  same payslip, lands in the second half of the year.

  `social-insurance` is a figure inside the shield: protection of a person. It
  derives its filled form from the outline, so it needed no drawn solid.

  `levy` needed no drawing at all. A levy is a statutory outflow, and `down`
  already means 扣除 / 支出, so `shield + down` says it — which is exactly the
  rule this repo tells everyone else to follow before adding a base. It scores
  87.0% against `pension-contribution` (`shield + up`), which is the same
  relationship `deduction` and `allowance` have on `coin` at 88.7%: same base,
  different badge, and the badge is the whole point.

  The statutory family now reads as one system — down is money out, up is money
  in, a figure inside is protection. Concepts borrowing another mark: 12 to 8.

- **`margin`** — two levels with an arrow between them, the spread. It had been
  borrowing `balance`, which is a pair of scales and means reconciliation.

  `billing-rate` deliberately did **not** get one. Three marks were drawn and
  all three failed on sight: money-over-time as a diagonal fraction renders as a
  literal `%`, which `tax-form` owns; as a stacked fraction it renders as `÷`
  and is mush at 16px; a price tag is legible but reads as *label* in software.
  Sharing `coin` beside a text label beats all three. "The difference between
  two amounts" has a shape; "amount per unit of time" does not.

  Concepts borrowing another mark: 8 to 7.

## [0.2.0] — 2026-08-17

### Added

- **A `staffing` group, with `client` and `assignment`.** Contract-payroll and
  staffing products place a consultant at a client for a period, and the set had
  no mark for either end of that. `client` is an office block, deliberately
  unlike `bank`'s pediment and columns; `assignment` is a case, a silhouette
  nothing else in the set uses.

  `job-order` is **not** a third base — a job order is a placement that has not
  been filled, which is `assignment` + the existing `pending` modifier. The same
  composition gives `assignment-approved` and `assignment-exception`.

  `client` is marked `composable: false`: its lower wing occupies the modifier
  zone, so badging it destroys the mark. `assignment` composes cleanly.

- **An Angular entry point.** `@octomate/payroll-icons/angular` exports a
  `PayrollIconComponent` and every icon as an `IconDefinition`. The geometry
  moved into a framework-free core that both runtimes consume, so a mark cannot
  drift between React and Angular.

- **A minimum-gap guard in the build.** Strokes that come within 0.4 units of
  each other without meeting now fail the build, naming the file, the stroke
  pair and the coordinate. Geometry is sampled in pure JS (`scripts/gaps.mjs`)
  so the check runs in the normal build rather than needing a rasteriser, and it
  compares subpaths rather than whole `<path>` elements — separate marks inside
  one element merge just as readily.

  The 0.4 comes from the badge geometry, not from taste: a glyph inside the
  4.25-unit modifier disc cannot clear more than about 0.45, so anything tighter
  is a slip rather than a constraint the grid imposed.

- **A concept table**, at `@octomate/payroll-icons/concepts`. 66 ideas, each
  pinned to exactly one mark, so two screens showing the same thing cannot show
  it differently. `iconFor(term)` resolves a concept name, its Chinese label or
  any synonym, ignoring case and separators — `"job order"`, `"job-order"`,
  `"requisition"` and `"職缺"` all land on `job-order`. The build fails if a
  concept names an icon that does not exist, or if a term is claimed twice: a
  word that resolves to two marks sends whoever typed it back to guessing.

  It covers the statutory vocabulary of all three jurisdictions — MPF and IR56
  for Hong Kong, CPF, SDL, FWL and IR8A for Singapore, EPF, SOCSO, EIS and PCB
  for Malaysia — and the same idea in three countries resolves to one mark.

  `approximated` lists the concepts still borrowing the nearest mark instead of
  owning one, and the build prints the count. It is 13 today, which is the
  drawing backlog stated as data rather than as a paragraph someone has to
  remember to update.

- **A shape canon, and `npm run shapes` to audit against it.** Recurring shapes
  now have one value each: the large circle is 8.2 at 24 and 5.5 at 16, a
  container corner 2.5 and 1.5, a small element corner 1.5 and 1.0. The script
  prints every radius in use grouped by the job it does. It reports rather than
  fails — `ledger`'s squarer page edge is deliberate, and a gate that cried wolf
  about it would train everyone to ignore the gate.

- `npm run confusability`, which rasterises every icon at 16px and scores each
  pair on shared ink, separating pairs that are alike by design from marks that
  genuinely collide.
- A test suite. 47 tests covering the runtime's behaviour — size and stroke
  resolution, optical master selection, the filled variant and its fallback,
  the accessibility contract, mask-id uniqueness — the path sampler behind the
  gap guard, and a snapshot of every path array, which is the only thing that
  catches a drawing changing when it should not have.

### Changed

- **Redrawn to clear the new gap threshold.** Fourteen masters had strokes a
  fraction of a unit apart, which fills in and reads as one thick smudge at the
  sizes these icons are used:

  - `exception` at 16 had 0.11 units between the stem and the dot, so it drew a
    plain vertical line rather than an exclamation mark.
  - `tax-form` at 16 had 0.04 between a counter and the slash. The percent could
    not be given room beside the container's rule, so the small master now drops
    the rule — which is what a separate optical master is for.
  - `timesheet` at 16 had 0.05 between the clock and the box floor; the clock
    did not fit and is now smaller.
  - `team` at both sizes had a hairline between head and shoulders, the worst of
    both worlds — neither a clean join nor a clean separation.
  - `pay-run`, `approved`, and the `dollar`, `yen`, `rupiah`, `baht`, `peso` and
    `dong` coins were adjusted for the same reason.

  No mark changed silhouette; the geometry snapshot records the exact paths.

- **Recurring shapes brought onto the canon.** `clock` (8.5) and `pay-run` (8.4)
  now use the large-circle radius of 8.2 that the ten coins already shared —
  twelve marks had carried three radii for what the eye reads as one circle.
  `documents`, `banknote`, `assignment` and `ledger`'s spine moved onto the
  container-corner radius. Every bounding box is unchanged; only the corners
  and the two circles moved, by fractions of a unit.

- TypeScript held at 5.9. Angular's compiler-cli pins `typescript` below 6.1,
  so shipping an Angular entry point means tracking the TypeScript the Angular
  toolchain supports. Nothing is lost: TypeScript 7 emitted byte-identical
  `.js` and `.d.ts`.
- Toolchain brought current: Vite 8, Vitest 4, plugin-react 6, and the GitHub
  Actions moved up a major each, with CI on Node 24. The published output is
  unaffected — the emitted `.js` and `.d.ts` are byte for byte what TypeScript
  5.9 produced; only the source maps differ, since those encode the compiler.
- `contract` redrawn at 16 units: one rule instead of two, and a larger
  signature. It scored 84.9% similar to `invoice` at 16px, the closest
  cross-base pair, and that similarity propagated to every composed mark built
  on either. Now 75.6%, and the previous worst pair overall —
  `credit-note` against `contract-signed` at 86.2% — is gone.
- **Breaking (registry shape).** `tier: "free" | "pro"` on registry entries is
  now `set: "core" | "extended"`. The old name implied a paywall that does not
  exist — everything ships under one MIT licence. The new name describes what
  the field actually does: curate a starting subset. `npm run icons:free` is
  now `npm run icons:core`.
- `homepage` now points at the documentation site rather than the README.


## [0.1.0] — 2026-08-09

First preview release.

### Added

- **54 icons** for payroll, time and attendance, statutory contributions,
  billing and payments, built from 21 bases combined with 9 modifiers.
- **Two optical sizes.** A 24-unit master and a separately drawn 16-unit
  master, selected automatically at 18px and below. The small master drops the
  modifier ring, which fills in solid below that size, and carries fewer detail
  lines.
- **Two weights.** `variant="filled"` for selected and tab-bar states, on every
  mark at both sizes. 34 are derived from the outline by masking; 20 are drawn
  solid masters for shapes the derivation cannot reach.
- **Nine currency coins**, named by symbol rather than ISO code, each carrying
  the `covers` list of codes it legitimately stands for.
- **Draw-on animation**, opt-in via `animate.css`. Every path carries
  `pathLength="1"`, so one rule times the whole library.
- **Framework-neutral exports** — raw path data, `toSvgString()`, and optimised
  `.svg` files alongside the React components.
- **Figma import bundle** via `npm run figma`: 212 SVGs plus a manifest naming
  each component and its size/style variant properties.

### Notes

- `coin` ships without a currency symbol so one set serves every market.
- Icons are decorative by default; passing `aria-label` switches them to
  `role="img"`.
- Two system rules are enforced at build time rather than documented: a
  display-only base cannot be badged, and a modifier cannot repeat a glyph its
  base already contains.
