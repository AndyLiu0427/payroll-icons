# Payroll Icon System

Icons for payroll, time and attendance, statutory contributions, billing and payments.

Generic icon sets give you one `file-text` for a payslip, an invoice, a receipt and a
withholding certificate. This set forces them apart, and expresses state through a fixed
badge vocabulary instead of drawing a new mark for every combination.

- **24 × 24 grid**, 20 × 20 live area, 1.5u stroke, round caps and joins
- **`currentColor` only** — no baked fills, no hard-coded palette
- **No currency symbols** — `coin` ships blank so one set serves every market
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
import { coinPaths, downModifierPaths } from "@octomate/payroll-icons/paths";

// render to a string — Angular, email, SSG
import { toSvgString } from "@octomate/payroll-icons";
toSvgString(coinPaths, downModifierPaths, { size: 20 });
```

Optimised `.svg` files ship too, at `@octomate/payroll-icons/svg/deduction.svg`.

Adding a Vue, Svelte or Angular target is one emitter in
[`scripts/build.mjs`](scripts/build.mjs) — the validation, optimisation and composition
stages are already framework-neutral.

## Repository layout

```
icons/
  bases/*.svg        21 authored masters — the source of truth
  modifiers/*.svg     9 authored masters
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
4. `npm run icons` — the build validates the file and generates everything else.

The build rejects masters with the wrong viewBox, with `<rect>`/`<circle>`/`<g>` instead of
paths, with a missing `pathLength`, or present on disk but undeclared in the manifest.

## Scripts

| Command | Does |
| --- | --- |
| `npm run icons` | Validate masters and generate components, data and SVGs |
| `npm run icons:free` | Same, free tier only |
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

- 16px and 20px masters drawn separately, not scaled down (the modifier ring collapses below 20px)
- per-currency `coin` variants
- filled variants for selected and tab-bar states
- the Figma library

## Licence

MIT. See [LICENSE](LICENSE).
