# Payroll Icon System

Icons for payroll, time and attendance, statutory contributions, billing and payments.

Generic icon sets give you one `file-text` for a payslip, an invoice, a receipt and a
withholding certificate. This set forces them apart, and expresses state through a fixed
badge vocabulary instead of drawing a new mark for every combination.

- **Two optical sizes** — a 24-unit master and a separately drawn 16-unit master, picked automatically
- **`currentColor` only** — no baked fills, no hard-coded palette
- **Currency-neutral by default** — `coin` ships blank; nine currency coins cover the rest
- **Outline and filled** — every mark has both weights, at both optical sizes
- **Animation-ready** — every path carries `pathLength="1"`, so one CSS rule times the whole library
- **Tree-shakeable** — importing one icon costs ~1.4 kB; the set never ships whole

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
`up`, `down`, `plus`, `minus`.

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

### Two rules the build enforces

Both were found by drawing the set, and both fail CI rather than living in a style guide.

**Display-only bases cannot be badged.** A wide, short shape like `banknote` loses a run of
its bottom edge to the knockout instead of a corner, and reads as damaged. Six bases are
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

**Derived** (34 marks). The outer path becomes a solid body and the detail
strokes are masked out of it. No new artwork, and the filled form can never
drift from the outline because it *is* the outline. Declared as
`fill: { container, skip }` in the manifest. Currency coins derive for free —
a ring with its glyph inside is exactly the shape the derivation wants.

**Drawn** (20 marks). Everything the derivation cannot reach: a calendar's tabs
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

## Outside React

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

## Repository layout

```
icons/
  bases/*.svg        21 authored 24-unit masters — the source of truth
  bases-16/*.svg     21 authored 16-unit masters
  modifiers/*.svg     9 authored 24-unit masters
  modifiers-16/*.svg  9 authored 16-unit masters
  bases-filled/*.svg      11 drawn solid masters, for shapes the fill cannot derive
  bases-filled-16/*.svg   11 of those at 16 units
  currency/*.svg      9 currency coins — complete icons, ring plus glyph
  currency-16/*.svg   7 of those at 16 units; two-letter marks are 24 only
  manifest.json      what each mark means, how it may be used, which tier
scripts/build.mjs    validate → optimise → compose → emit
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
3. Declare it in `icons/manifest.json` with its group, tier, and whether it is composable.
4. Draw the 16-unit master into `icons/bases-16/` with the same filename. Optional —
   without it the icon still works, it just scales the large master down at small sizes.
5. `npm run icons` — the build validates the files and generates everything else.

The build rejects masters with the wrong viewBox for their grid, with `<rect>`/`<circle>`/`<g>`
instead of paths, with a missing `pathLength`, or present on disk but undeclared in the
manifest. It also rejects a master whose path count changes under optimisation — usually a
sign of a degenerate path, such as a dot drawn as a zero-length capped segment. Draw dots as
real circles; the optimiser's idea of "useless" is scale-relative, so `v.01` survives on the
24 grid and vanishes on the 16 grid.

## Scripts

| Command | Does |
| --- | --- |
| `npm run icons` | Validate masters and generate components, data and SVGs |
| `npm run icons:free` | Same, free tier only |
| `npm run figma` | Generate, then emit the Figma import bundle |
| `npm run build` | Generate, then compile the package to `dist/` |
| `npm run dev` | Documentation site with hot reload |
| `npm run typecheck` | `tsc --noEmit` across src, demo and scripts |
| `npm run lint` | Biome |

## Tiers

`tier` in the manifest drives `npm run icons:free`, which builds a subset.

Note on what that actually protects: withholding *compositions* is weak, since anyone with
the free bases and modifiers can compose the rest themselves — the composition rules are
published right here. Treat the tier field as packaging, not as a licence boundary. Real
paid-tier value has to be additional artwork:

- a published Figma library, which needs a paid Figma plan
- a duotone or two-tone weight, if the product ever needs a third emphasis level
- additional currency glyphs beyond the nine drawn (₹, ₩, ₪, ₦ …)

## Licence

MIT. See [LICENSE](LICENSE).
