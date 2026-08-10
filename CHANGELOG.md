# Changelog

All notable changes to this package are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

While the major version is 0, the shape of a mark may change in a minor
release — the drawings are still settling. The component API will not.

## [Unreleased]

### Added

- `npm run confusability`, which rasterises every icon at 16px and scores each
  pair on shared ink, separating pairs that are alike by design from marks that
  genuinely collide.
- A test suite. 35 tests covering the runtime's behaviour — size and stroke
  resolution, optical master selection, the filled variant and its fallback,
  the accessibility contract, mask-id uniqueness — and a snapshot of every
  path array, which is the only thing that catches a drawing changing when it
  should not have.

### Changed

- Toolchain brought current: TypeScript 7, Vite 8, Vitest 4, plugin-react 6,
  and the GitHub Actions moved up a major each, with CI on Node 24. The
  published output is unaffected — the emitted `.js` and `.d.ts` are byte for
  byte what TypeScript 5.9 produced; only the source maps differ, since those
  encode the compiler.

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
