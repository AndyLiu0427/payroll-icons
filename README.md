# Payroll Icon System

**63 icons** for payroll, time and attendance, statutory contributions, staffing,
billing and payments — each in two optical sizes and two weights.

Generic icon sets give you one `file-text` for a payslip, an invoice, a receipt and a
withholding certificate. This set forces them apart, and expresses state through a fixed
badge vocabulary instead of drawing a new mark for every combination.

- **Two optical sizes** — a 24-unit master and a separately drawn 16-unit master, picked automatically
- **`currentColor` only** — no baked fills, no hard-coded palette
- **Currency-neutral by default** — `coin` ships blank; nine currency coins cover the rest
- **Outline and filled** — every mark has both weights, at both optical sizes
- **Animation-ready** — every path carries `pathLength="1"`, so one CSS rule times the whole library
- **Tree-shakeable** — one icon is ~1.3 kB gzipped, three are ~1.5 kB; the set never ships whole

**[Browse every icon →](https://andyliu0427.github.io/payroll-icons/)** — search in English or
Chinese, switch size and weight, click to copy the import.

```bash
npm install @octomate/payroll-icons
```

```tsx
import { Payslip, Deduction, InvoiceException } from "@octomate/payroll-icons";

<Payslip />
<Deduction size={20} />
<InvoiceException size={32} strokeWidth={2} aria-label="Billing exception" />
```

Icons are decorative by default (`aria-hidden`). Passing `aria-label` or `aria-labelledby`
switches them to `role="img"`, so they only enter the accessibility tree when they carry
meaning the surrounding text does not.

## The system

Two kinds of mark, combined at build time.

**Bases** are the nouns — `payslip`, `invoice`, `coin`, `calendar`, `employee`, `bank`.
**Modifiers** are the states — `approved`, `pending`, `recurring`, `exception`, `locked`,
`draft`, `up`, `down`, `plus`, `minus`.

A modifier occupies the reserved 10 × 10 zone at the bottom right. The base is masked with a
5.5u knockout disc so the badge stays legible without any colour change:

```
deduction   = coin + down
allowance   = coin + up
leave       = calendar + minus
overtime    = clock + plus
onboarding  = employee + plus
credit-note = invoice + minus
```

That is why the set covers far more concepts than it contains drawings. Adding a modifier
adds a row of new states across every base.

### Keeping marks apart

`npm run confusability` rasterises every icon at 16px — where the set is
hardest to read — and scores each pair on shared ink. Median similarity across
1,830 pairs is about 22%.

Read the output carefully. Two marks built from the same base are *supposed* to
be close: `deduction` and `bonus` are `coin + down` and `coin + plus`, and
score in the 90s by design. Circle families start around 78% on their shared
outline alone, before either draws anything inside. Only cross-base pairs — two
different meanings landing on the same pixels — are a real signal, and those
are reported separately.

It measures ink distribution, not shape, so treat it as a place to look rather
than a verdict. `contract` and `statement` score 81% because both are a sheet
with one top rule and something in the lower half; a signature and a bar chart
are not remotely confusable to a reader.

### Two rules the build enforces

Both were found by drawing the set, and both fail CI rather than living in a style guide.

**Display-only bases cannot be badged.** A wide, short shape like `banknote` loses a run of
its bottom edge to the knockout instead of a corner, and reads as damaged. Eight bases are
marked `composable: false` in [`icons/manifest.json`](icons/manifest.json); composing one is
a build error.

**A modifier cannot repeat a glyph its base already contains.** `timesheet + pending` puts a
clock badge on an icon that is already a clock. Bases declare `conflicts` and the build
rejects the combination.

```
✗ 2 problem(s) in the icon set:

  • composition "banknote-approved" badges "banknote", which is display-only
    (wide and short — knockout eats a run of the bottom edge, not a corner)
  • composition "timesheet-pending" puts the "pending" badge on "timesheet",
    which already contains that glyph — it reads as a rendering error
```

## Optical sizes

Small icons are not scaled-down large ones. Every mark has two masters:

| | Canvas | Stroke | Badge |
| --- | --- | --- | --- |
| `lg` | 24 units, live 20 | 1.5u | ring at (17.5, 17.5) r 4.25, knockout r 5.5 |
| `sm` | 16 units, live 14 | 1.25u | **no ring**, glyph at (11.6, 11.6), knockout r 3.9 |

Below about 20px a 4.25u ring is under 6px across and fills in solid, which turns
every composed mark into a blob. The small master drops the ring entirely — the
knockout already provides the separation the ring was doing — and spends the room
on a bigger glyph. It also carries fewer detail lines, because strokes closer than
about 2.5 units fuse at that size.

Selection is automatic:

```tsx
<Payslip size={24} />   {/* 24-unit master */}
<Payslip size={16} />   {/* 16-unit master */}
<Payslip size={16} optical="lg" />  {/* force the large master */}
```

The cutover is at 18px (`OPTICAL_BREAKPOINT`). An icon with no small master falls
back to the large one scaled down rather than failing, and `npm run icons` reports
how many have one. Stroke width follows the master unless you set it explicitly.

The demo site has a **16px compare** toggle that puts both side by side.

## Currency coins

The generic `coin` deliberately carries no currency symbol, so one set serves every
market. When a specific currency does need showing, there are nine currency coins —
named **by symbol, not by ISO code**, because a dollar sign cannot distinguish USD
from SGD from AUD and an icon that claims to would be lying:

| Icon | Symbol | Stands for |
| --- | --- | --- |
| `CoinDollar` | $ | USD, SGD, AUD, HKD, TWD, NZD, CAD |
| `CoinEuro` | € | EUR |
| `CoinPound` | £ | GBP |
| `CoinYen` | ¥ | JPY, CNY |
| `CoinPeso` | ₱ | PHP |
| `CoinDong` | ₫ | VND |
| `CoinBaht` | ฿ | THB |
| `CoinRinggit` | RM | MYR |
| `CoinRupiah` | Rp | IDR |

`covers` on each registry entry records the codes, so a currency picker can map a
code to its mark and let the product label carry the code itself:

```ts
import { currencies } from "@octomate/payroll-icons/registry";

const markFor = (code: string) =>
  currencies.find((c) => c.covers?.includes(code))?.Component;
```

Currency coins are display-only. The glyph fills the coin, so there is no room for
a badge — and a deduction is `coin + down`, not `coin-ringgit + down`. Two letters
inside a 16-unit coin give about 3px per letter, so `CoinRinggit` and `CoinRupiah`
have no small master and fall back to the 24-unit one; `hasSmallMaster` on the
registry entry tells you which.

## Filled variant

For selected and tab-bar states. Every mark has one, at both optical sizes:

```tsx
<Payslip variant="filled" />
```

Two mechanisms produce it, and which one a mark uses is a property of its shape,
not a policy:

**Derived** (36 marks). The outer path becomes a solid body and the detail
strokes are masked out of it. No new artwork, and the filled form can never
drift from the outline because it *is* the outline. Declared as
`fill: { container, skip }` in the manifest. Currency coins derive for free —
a ring with its glyph inside is exactly the shape the derivation wants.

**Drawn** (27 marks). Everything the derivation cannot reach: a calendar's tabs
sit above its box, a person's shoulders outside their head, and `bank`,
`exchange`, `balance`, `pay-run` have no closed outer path at all. These live in
`icons/bases-filled/` as solid silhouettes with counters as even-odd subpaths.

A base may not have both — the build rejects it, because two sources for one
form drift apart:

```
✗ 1 problem(s) in the icon set:

  • calendar has both a drawn filled master and a derived fill in the manifest
    — pick one, or the two will drift apart
```

`ledger` is the one mark that was derived, judged, and moved to drawn: its spine
follows the container edge, so knocking it out bit the silhouette, and skipping
it left something indistinguishable from a filled invoice. In a set whose whole
purpose is telling documents apart, that collision mattered more than the saved
artwork.

Draw-on animation is an outline effect and is disabled on filled marks
automatically.

## Figma

`npm run figma` emits an import-ready bundle:

```
figma-export/
  24/outline/*.svg   54    16/outline/*.svg   52
  24/filled/*.svg    54    16/filled/*.svg    52
  components.json
```

One folder per size and style, so each imports into Figma as a clean set.
`components.json` names every component (`Payroll/<group>/<name>`) and its
variant properties — `size` and `style`, matching the React props, so a
designer and an engineer are naming the same thing.

To assemble: import each folder, select the frames, **Create Multiple
Components**, then **Combine as Variants** per icon.

Publishing this as a shared Figma library needs a paid Figma plan; the bundle
and naming are plan-independent.

## Themes

`currentColor` is the only colour in the package, so an icon takes the colour of
whatever it sits in and no theme switch is needed.

The filled variant is the part worth stating plainly, since it uses a mask: the
knockouts cut through to **whatever is behind the icon**, not to white. Checked
on white, near-black, a saturated blue surface and in an accent colour — the
detail knocked out of a filled `payslip` shows the blue when it sits on blue.

There is no separate dark-mode stroke weight. Light-on-dark does bleed slightly
heavier, but at 1.5 units on a 24 grid the effect is small enough that a
reduced weight was hard to tell from the shipped one, and not worth a second
code path. Compared at 1.5, 1.35 and 1.25 against the light rendering before
deciding.

## Animation

Optional, opt-in, one import:

```tsx
import "@octomate/payroll-icons/animate.css";

<Payslip className="pi-draw" />
```

`pathLength="1"` normalises every path to a length of 1, so `stroke-dasharray: 1` is exactly
one full path whether the real geometry is 8 units long or 80. Timing is identical across the
library without per-icon tuning. Tunable per instance:

```css
.my-icon {
  --pi-duration: 400ms;
  --pi-stagger: 40ms;
  --pi-ease: ease-out;
}
```

`prefers-reduced-motion: reduce` disables it. `.pi-hover` adds a restrained hover scale.

## Angular

```bash
npm install @octomate/payroll-icons
```

```ts
import { PayrollIconComponent, Payslip, Deduction } from "@octomate/payroll-icons/angular";

@Component({ imports: [PayrollIconComponent], template: `
  <pi-icon [icon]="Payslip" />
  <pi-icon [icon]="Deduction" [size]="16" />
  <pi-icon [icon]="Payslip" variant="filled" ariaLabel="Payslip" />
` })
class Example {
  protected readonly Payslip = Payslip;
  protected readonly Deduction = Deduction;
}
```

The component takes the icon *object*, not a name — the same shape
lucide-angular uses — so a template pulls in only the marks it names and the
rest tree-shake away. A name-keyed registry would import all 54.

Inputs mirror the React props: `size`, `strokeWidth`, `absoluteStrokeWidth`,
`optical`, `variant`, plus `ariaLabel` in place of the `aria-*` attributes.
Both runtimes consume the same `IconDefinition` objects, so a mark cannot drift
between them.

Two things worth knowing:

- The library is compiled with `ngc` in partial mode, not plain `tsc`. Signal
  `input()` needs the Angular compiler to register it on the component
  definition; a plain-tsc build produces a component whose bindings silently do
  nothing and whose inputs land as stray HTML attributes.
- That constrains TypeScript. Angular's compiler-cli pins `typescript` below
  6.1, so the library tracks the TypeScript the Angular toolchain supports
  rather than the newest release.

## Outside React or Angular

The package is React-first but the geometry is not.

```ts
// raw path data
import { coinPaths, coinPaths16, downModifierPaths } from "@octomate/payroll-icons/paths";

// render to a string — Angular, email, SSG
import { toSvgString } from "@octomate/payroll-icons";
toSvgString(
  { lg: { base: coinPaths, modifier: downModifierPaths } },
  { size: 20 },
);
```

Optimised `.svg` files ship for both optical sizes, at
`@octomate/payroll-icons/svg/deduction.svg` and `…/svg/deduction-16.svg`.

Adding a Vue, Svelte or Angular target is one emitter in
[`scripts/build.mjs`](scripts/build.mjs) — the validation, optimisation and composition
stages are already framework-neutral.

## Which mark means what

Picking an icon per screen is how a set drifts: one page shows a job order with a
clipboard, another with a briefcase, and both authors were being reasonable. The concept
table makes that decision once.

```ts
import { concepts, iconFor, approximated } from "@octomate/payroll-icons/concepts";

iconFor("job order");   // "job-order"
iconFor("requisition"); // "job-order"  — same idea, same mark
iconFor("強積金");       // "pension-contribution"
iconFor("PTO");         // "leave"
```

A term can be the concept's name, its Chinese label, or any listed synonym, and case and
separators are ignored. The build fails if a concept points at a mark that does not exist,
or if one term is claimed by two concepts — a word that resolves to two marks sends whoever
typed it straight back to guessing.

It is plain data with no component imports, so a lookup pulls no icons into a bundle.

`approximated` lists concepts still borrowing the nearest mark rather than owning one.
That is the drawing backlog, stated as data instead of as a paragraph someone has to
remember to update, and `npm run icons` prints the count on every build.

## Repository layout

```
icons/
  bases/*.svg        24 authored 24-unit masters — the source of truth
  bases-16/*.svg     24 authored 16-unit masters
  modifiers/*.svg    10 authored 24-unit masters
  modifiers-16/*.svg 10 authored 16-unit masters
  bases-filled/*.svg      13 drawn solid masters, for shapes the fill cannot derive
  bases-filled-16/*.svg   13 of those at 16 units
  currency/*.svg      9 currency coins — complete icons, ring plus glyph
  currency-16/*.svg   7 of those at 16 units; two-letter marks are 24 only
  manifest.json      what each mark means, how it may be used, which set
  concepts.json      which idea resolves to which mark, and by what search terms
scripts/build.mjs    validate → optimise → compose → emit
scripts/gaps.mjs     path sampler behind the minimum-gap guard
scripts/shapes.mjs   recurring-shape audit (npm run shapes)
src/
  createIcon.tsx     the runtime (masking, sizing, a11y)
  animate.css        optional motion layer
  generated/         build output, gitignored
demo/                the documentation site
```

Masters are edited in a vector editor and committed as SVG. Nothing in `src/generated/`
is written by hand.

### Adding an icon

1. Draw it on the 24 × 24 grid, stroke 1.5, paths only, and save to `icons/bases/`.
2. Add `pathLength="1"` to every path.
3. Declare it in `icons/manifest.json` with its group, set, and whether it is composable.
4. Draw the 16-unit master into `icons/bases-16/` with the same filename. Optional —
   without it the icon still works, it just scales the large master down at small sizes.
5. `npm run icons` — the build validates the files and generates everything else.

The build rejects masters with the wrong viewBox for their grid, with `<rect>`/`<circle>`/`<g>`
instead of paths, with a missing `pathLength`, or present on disk but undeclared in the
manifest. It also rejects a master whose path count changes under optimisation — usually a
sign of a degenerate path, such as a dot drawn as a zero-length capped segment. Draw dots as
real circles; the optimiser's idea of "useless" is scale-relative, so `v.01` survives on the
24 grid and vanishes on the 16 grid.

It also rejects strokes that come within **0.4 units** of each other without meeting. Two
lines a fraction of a unit apart do not read as two lines — the white between them fills in
and the pair reads as one thick smudge, at exactly the sizes these icons are used. Shapes
that touch outright are fine and common: a building's wing meets its wall, a calendar's tab
meets its box. Only a gap too small to see is a defect, so the fix is always to separate the
strokes further or to join them properly.

The number comes from the badge geometry rather than from taste: a glyph inside the
4.25-unit modifier disc cannot clear more than about 0.45 units, so anything tighter is a
slip rather than a constraint the grid imposed.

Gaps are measured **edge to edge**, which is why the 16-unit master needs more room than a
scaled-down 24 looks like it should. Its stroke is 1.25 of 16 units — 7.8% of the canvas —
against 1.5 of 24, or 6.25%. The small master's line is a quarter heavier relative to its
own grid, so its gaps have to be drawn wider, not scaled down.

### The shape canon

Shapes that recur across the set are drawn to one value, so a document corner is the same
corner everywhere:

| Role | 24-grid | 16-grid |
| --- | --- | --- |
| Large circle — a coin's rim, a clock face, a circular arrow | 8.2 | 5.5 |
| Container corner — the rounded rectangle that forms a mark's body | 2.5 | 1.5 |
| Small element corner — an org-chart node, a case handle, a building top | 1.5 | 1.0 |

Nobody notices this directly. What gets noticed is the absence: a set where the same object
is drawn three slightly different ways reads as handmade, and not in a good way. Twelve marks
used to carry three different large-circle radii — 8.2, 8.4 and 8.5 — for what the eye reads
as one circle.

Deliberate exceptions are fine and exist: `ledger` gives its page edge a squarer corner than
its spine, because a book is not a document. The canon is there so that divergence is a
decision rather than a drift.

`npm run shapes` prints every radius in use, grouped by the job it does, and marks the ones
that match the canon. Run it after drawing a new master — it takes a second and it is the
only thing that catches a corner landing at 2.0 because that is what the editor snapped to.

## Scripts

| Command | Does |
| --- | --- |
| `npm run icons` | Validate masters and generate components, data and SVGs |
| `npm run icons:core` | Same, curated core subset only |
| `npm run figma` | Generate, then emit the Figma import bundle |
| `npm run confusability` | Measure how alike any two marks look at 16px¹ |
| `npm run shapes` | Audit recurring shapes against the canon |
| `npm run build` | Generate, then compile the package to `dist/` |
| `npm run dev` | Documentation site with hot reload |
| `npm test` | Vitest — runtime behaviour and the geometry snapshot |
| `npm run typecheck` | `tsc --noEmit` across src, demo and scripts |
| `npm run lint` | Biome |

¹ Needs a browser to rasterise and is not part of the build, so playwright is
not a dependency. Install it when you want to run the check:
`npm i -D playwright && npx playwright install chromium`.

## Core and extended

Everything in this package ships, under one MIT licence. There is no paid tier
and no gated subset — an earlier plan for one was dropped because it would not
have held: the bases, the modifiers and the composition rules are all published
here, so anyone can compose the rest in a few minutes.

`set` in the manifest curates rather than gates:

- **core** (35) — the marks nearly every payroll product needs: all 24 bases,
  plus the states that come up immediately.
- **extended** (28) — the long tail. Currency coins, and the composed states a
  product reaches for once the basics are in place.

`npm run icons:core` builds the subset. It is an adoption aid, not a boundary —
useful when introducing the set to a team and you want a short list to start
from. For bundle size it does nothing: tree-shaking already drops what an app
does not import.

The docs site has the same filter.

## Commercial use

MIT, so: use it in commercial products, modify it, redistribute it, no
attribution required beyond keeping the licence notice.

If you want something that is not here — marks for a domain this set does not
cover, a house style applied across it, or an assembled Figma library with
components and variants — that is work rather than a licence, and worth asking
about at the issue tracker.

Note that the Figma *import bundle* is not the paid part of that: `npm run
figma` generates it from the public masters in one command.

## Licence

MIT. See [LICENSE](LICENSE).
