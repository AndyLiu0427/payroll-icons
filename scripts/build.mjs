/**
 * Turns the authored SVG masters in icons/ into everything the package ships.
 *
 *   icons/bases/*.svg      ─┐
 *   icons/modifiers/*.svg   ├─> validate ─> optimise ─> emit
 *   icons/manifest.json    ─┘
 *
 * Emits:
 *   dist/svg/<name>.svg          raw optimised files, including composed marks
 *   src/generated/react/*.tsx    one component per icon (tree-shakeable)
 *   src/generated/paths.ts       framework-neutral path data
 *   src/generated/registry.ts    name -> metadata lookup (imports everything)
 *   src/generated/index.ts       public barrel
 *
 * Composition is a build step, not a runtime lookup, so bundlers can drop the
 * icons an app does not use.
 *
 *   node scripts/build.mjs             all icons
 *   node scripts/build.mjs --set core   the curated core subset
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { optimize } from "svgo";
import { findTightGaps } from "./gaps.mjs";

/** Edge-to-edge, in grid units. See the gap check in readMaster for why 0.4. */
const MIN_GAP = 0.4;

const ROOT = new URL("..", import.meta.url).pathname;
const ICONS = join(ROOT, "icons");
const GEN = join(ROOT, "src/generated");
const DIST_SVG = join(ROOT, "dist/svg");

const setArg = process.argv.indexOf("--set");
const SET = setArg !== -1 ? process.argv[setArg + 1] : "all";
const SETS = SET === "core" ? new Set(["core"]) : new Set(["core", "extended"]);

const manifest = JSON.parse(readFileSync(join(ICONS, "manifest.json"), "utf8"));
const errors = [];
const warnings = [];

/* ------------------------------------------------------------------ read */

/**
 * Pulls the path data out of a master. Masters are ours, so the shape is known.
 *
 * `optional` is for the 16px optical masters: an icon without one falls back to
 * the 24 master scaled down, which is worse but not broken.
 */
function readMaster(dir, name, { canvas = 24, optional = false, solid = false } = {}) {
  const file = join(ICONS, dir, `${name}.svg`);
  let raw;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    if (!optional) errors.push(`${dir}/${name}.svg is in the manifest but missing on disk`);
    return null;
  }

  const viewBox = raw.match(/viewBox="([^"]+)"/)?.[1];
  const expected = `0 0 ${canvas} ${canvas}`;
  if (viewBox !== expected) {
    errors.push(`${dir}/${name}.svg has viewBox "${viewBox}" — must be ${expected}`);
  }

  const nonPath = raw.match(/<(rect|circle|ellipse|line|polyline|polygon|g)\b/);
  if (nonPath) {
    errors.push(
      `${dir}/${name}.svg contains <${nonPath[1]}> — masters must be paths only ` +
        `so one animation rule covers the whole library`,
    );
  }

  const paths = [...raw.matchAll(/<path\b([^>]*)\/>/g)].map((m) => m[1]);
  const data = [];
  for (const attrs of paths) {
    // Solid masters are areas, not traced outlines — there is nothing for the
    // draw-on animation to run along, so they carry no pathLength.
    if (!solid && !/pathLength="1"/.test(attrs)) {
      errors.push(`${dir}/${name}.svg has a path without pathLength="1"`);
    }
    const d = attrs.match(/\bd="([^"]+)"/)?.[1];
    if (d) data.push(d);
  }
  if (!data.length) errors.push(`${dir}/${name}.svg has no path data`);

  /*
   * Two strokes a fraction of a unit apart do not read as two strokes — they
   * fill in and read as one smudge, first at the size the icon is used most.
   * Shapes that meet outright are left alone; only a gap too small to see is a
   * defect. Solid masters are areas, not traced lines, so they are exempt.
   *
   * MIN_GAP is not arbitrary: a glyph inside the 4.25-unit badge disc cannot do
   * better than about 0.45, so anything tighter is a drawing slip rather than a
   * constraint the grid imposed.
   */
  if (!solid && data.length) {
    const strokeWidth = canvas === 16 ? 1.25 : 1.5;
    try {
      for (const g of findTightGaps(data, {
        strokeWidth,
        minGap: MIN_GAP,
        label: `${dir}/${name}`,
      })) {
        errors.push(
          `${dir}/${name}.svg: strokes ${g.pair} come within ${g.gap} units near ` +
            `(${g.at[0]}, ${g.at[1]}) — under ${MIN_GAP} they merge; separate them or join them`,
        );
      }
    } catch (err) {
      errors.push(`${dir}/${name}.svg: gap check could not read the geometry — ${err.message}`);
    }
  }

  if (solid) {
    if (!/fill="currentColor"/.test(raw)) {
      errors.push(`${dir}/${name}.svg must set fill="currentColor" — it is a solid master`);
    }
    if (!/fill-rule="evenodd"/.test(raw)) {
      errors.push(
        `${dir}/${name}.svg must set fill-rule="evenodd" so counter subpaths punch holes ` +
          `instead of filling solid`,
      );
    }
    if (/stroke="currentColor"/.test(raw)) {
      errors.push(`${dir}/${name}.svg is a solid master but strokes currentColor`);
    }
  }
  return data;
}

/* -------------------------------------------------------------- optimise */

/**
 * mergePaths is off deliberately: it would fuse our separately-animatable paths
 * into one and break both the draw-on stagger and the base/modifier split.
 *
 * removeViewBox is not listed — since SVGO 4 it lives outside preset-default,
 * so leaving it out is what keeps the viewBox. Adding it back as an override
 * only produces a warning and does nothing.
 */
const SVGO_CONFIG = {
  multipass: true,
  plugins: [
    {
      name: "preset-default",
      params: {
        overrides: {
          mergePaths: false,
          convertPathData: { floatPrecision: 2, transformPrecision: 3 },
          cleanupNumericValues: { floatPrecision: 2 },
        },
      },
    },
  ],
};

function optimisePaths(paths, label, canvas = 24) {
  if (paths === null) return null;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas} ${canvas}">` +
    paths.map((d) => `<path pathLength="1" d="${d}"/>`).join("") +
    `</svg>`;
  const out = optimize(svg, { ...SVGO_CONFIG, path: label });
  const optimised = [...out.data.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map((m) => m[1]);
  if (optimised.length !== paths.length) {
    errors.push(
      `${label}: optimiser changed the path count ${paths.length} -> ${optimised.length}; ` +
        `per-path animation would break`,
    );
    return paths;
  }
  return optimised;
}

/* -------------------------------------------------------------- validate */

const basePaths = {};
const modifierPaths = {};
const basePaths16 = {};
const modifierPaths16 = {};
const solidPaths = {};
const solidPaths16 = {};

for (const name of Object.keys(manifest.bases)) {
  basePaths[name] = optimisePaths(readMaster("bases", name), `bases/${name}`);
  basePaths16[name] = optimisePaths(
    readMaster("bases-16", name, { canvas: 16, optional: true }),
    `bases-16/${name}`,
    16,
  );
  solidPaths[name] = optimisePaths(
    readMaster("bases-filled", name, { optional: true, solid: true }),
    `bases-filled/${name}`,
  );
  solidPaths16[name] = optimisePaths(
    readMaster("bases-filled-16", name, { canvas: 16, optional: true, solid: true }),
    `bases-filled-16/${name}`,
    16,
  );
}
for (const name of Object.keys(manifest.modifiers)) {
  modifierPaths[name] = optimisePaths(readMaster("modifiers", name), `modifiers/${name}`);
  modifierPaths16[name] = optimisePaths(
    readMaster("modifiers-16", name, { canvas: 16, optional: true }),
    `modifiers-16/${name}`,
    16,
  );
}

/*
 * A composed mark needs both halves at the same optical size — a 16px base with
 * a 24px badge would put the badge in the wrong place on the wrong grid.
 */
for (const c of manifest.compositions) {
  const hasBase16 = basePaths16[c.base] != null;
  const hasMod16 = modifierPaths16[c.modifier] != null;
  if (hasBase16 !== hasMod16) {
    warnings.push(
      `"${c.name}" has a 16px master for only ${hasBase16 ? "the base" : "the modifier"} — ` +
        `it will fall back to the 24px pair at small sizes`,
    );
  }
}

/* currency coins — complete icons in their own right, not base + modifier */
const currencyPaths = {};
const currencyPaths16 = {};

for (const name of Object.keys(manifest.currencies ?? {})) {
  currencyPaths[name] = optimisePaths(readMaster("currency", name), `currency/${name}`);
  currencyPaths16[name] = optimisePaths(
    readMaster("currency-16", name, { canvas: 16, optional: true }),
    `currency-16/${name}`,
    16,
  );
}

for (const name of Object.keys(manifest.bases)) {
  if (solidPaths[name] && manifest.bases[name].fill) {
    errors.push(
      `${name} has both a drawn filled master and a derived fill in the manifest — ` +
        `pick one, or the two will drift apart`,
    );
  }
  if (!solidPaths[name] && solidPaths16[name]) {
    warnings.push(`${name} has a 16px filled master but no 24px one`);
  }
}

/* every file on disk must be declared, or it silently never ships */
for (const [dir, declared] of [
  ["bases", manifest.bases],
  ["modifiers", manifest.modifiers],
  ["currency", manifest.currencies ?? {}],
]) {
  for (const file of readdirSync(join(ICONS, dir)).filter((f) => f.endsWith(".svg"))) {
    const name = basename(file, ".svg");
    if (!(name in declared)) {
      errors.push(`icons/${dir}/${file} exists but is not declared in manifest.json`);
    }
  }
}

/* the two composition rules found while drawing Plate 002, enforced */
for (const c of manifest.compositions) {
  const base = manifest.bases[c.base];
  const modifier = manifest.modifiers[c.modifier];

  if (!base) {
    errors.push(`composition "${c.name}" refers to unknown base "${c.base}"`);
    continue;
  }
  if (!modifier) {
    errors.push(`composition "${c.name}" refers to unknown modifier "${c.modifier}"`);
    continue;
  }
  if (base.composable === false) {
    errors.push(
      `composition "${c.name}" badges "${c.base}", which is display-only ` +
        `(${base.note ?? "shape does not survive the knockout"})`,
    );
  }
  if (base.conflicts?.includes(c.modifier)) {
    errors.push(
      `composition "${c.name}" puts the "${c.modifier}" badge on "${c.base}", ` +
        `which already contains that glyph — it reads as a rendering error`,
    );
  }
  if (modifier.glyph && base.conflicts == null && c.base.includes(modifier.glyph)) {
    warnings.push(`"${c.name}" may duplicate the ${modifier.glyph} glyph — check it by eye`);
  }
}

/* ----------------------------------------------------------- concepts */

/*
 * The concept table is what stops two screens showing the same idea with two
 * different marks. Its whole value is the one-to-one rule, so the rule is
 * checked rather than trusted: every concept must name an icon that exists, and
 * a search term may belong to one concept only — a word that resolves to two
 * marks sends whoever typed it back to guessing.
 */
const conceptFile = JSON.parse(readFileSync(join(ICONS, "concepts.json"), "utf8"));
const concepts = conceptFile.concepts;
const iconNames = new Set([
  ...Object.keys(manifest.bases),
  ...manifest.compositions.map((c) => c.name),
  ...Object.keys(manifest.currencies).map((c) => `coin-${c}`),
]);
const termOwner = new Map();

/*
 * Separators are flattened so a concept keyed "job-order" is still found by
 * someone typing "job order". Without it every hyphenated key needs its own
 * spaced alias, which is a rule nobody remembers and the table quietly rots.
 */
const normalise = (s) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");

for (const [name, c] of Object.entries(concepts)) {
  if (!iconNames.has(c.icon)) {
    errors.push(`concept "${name}" points at "${c.icon}", which is not an icon`);
  }
  // the Chinese label is a search term too — it is what half the team will type
  for (const term of [name, c.zh, ...(c.also ?? [])]) {
    const key = normalise(term);
    if (termOwner.has(key) && termOwner.get(key) !== name) {
      errors.push(
        `search term "${term}" is claimed by both "${termOwner.get(key)}" and "${name}" — ` +
          `a term has to resolve to one mark`,
      );
    }
    termOwner.set(key, name);
  }
}

if (errors.length) {
  console.error(`\n✗ ${errors.length} problem(s) in the icon set:\n`);
  for (const e of errors) console.error(`  • ${e}`);
  console.error("");
  process.exit(1);
}

/* ------------------------------------------------------------------ emit */

rmSync(GEN, { recursive: true, force: true });
mkdirSync(join(GEN, "react"), { recursive: true });
mkdirSync(join(GEN, "defs"), { recursive: true });
mkdirSync(DIST_SVG, { recursive: true });

const pascal = (s) => s.replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase());
const camel = (s) => s.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());

/** Everything that ships, flattened: plain bases first, then composed marks. */
const icons = [
  ...Object.entries(manifest.bases)
    .filter(([, m]) => SETS.has(m.set))
    .map(([name, m]) => ({ name, zh: m.zh, group: m.group, set: m.set, base: name })),
  ...manifest.compositions
    .filter((c) => SETS.has(c.set))
    .map((c) => ({
      name: c.name,
      zh: c.zh,
      group: manifest.bases[c.base].group,
      set: c.set,
      base: c.base,
      modifier: c.modifier,
    })),
  ...Object.entries(manifest.currencies ?? {})
    .filter(([, m]) => SETS.has(m.set))
    .map(([name, m]) => ({
      name: `coin-${name}`,
      zh: m.zh,
      group: "currency",
      set: m.set,
      currency: name,
      symbol: m.symbol,
      covers: m.covers,
    })),
];

const HEADER = "// Generated by scripts/build.mjs — do not edit.\n";
const arr = (paths) => `[\n${paths.map((d) => `  ${JSON.stringify(d)},`).join("\n")}\n]`;

/* framework-neutral path data, both optical sizes */
const pathsModule = [
  HEADER,
  ...Object.entries(basePaths).map(
    ([n, p]) => `export const ${camel(n)}Paths = ${arr(p)} as const;\n`,
  ),
  ...Object.entries(basePaths16)
    .filter(([, p]) => p != null)
    .map(([n, p]) => `export const ${camel(n)}Paths16 = ${arr(p)} as const;\n`),
  ...Object.entries(modifierPaths).map(
    ([n, p]) => `export const ${camel(n)}ModifierPaths = ${arr(p)} as const;\n`,
  ),
  ...Object.entries(modifierPaths16)
    .filter(([, p]) => p != null)
    .map(([n, p]) => `export const ${camel(n)}ModifierPaths16 = ${arr(p)} as const;\n`),
  ...Object.entries(solidPaths)
    .filter(([, p]) => p != null)
    .map(([n, p]) => `export const ${camel(n)}SolidPaths = ${arr(p)} as const;\n`),
  ...Object.entries(solidPaths16)
    .filter(([, p]) => p != null)
    .map(([n, p]) => `export const ${camel(n)}SolidPaths16 = ${arr(p)} as const;\n`),
  ...Object.entries(currencyPaths).map(
    ([n, p]) => `export const ${camel(n)}CoinPaths = ${arr(p)} as const;\n`,
  ),
  ...Object.entries(currencyPaths16)
    .filter(([, p]) => p != null)
    .map(([n, p]) => `export const ${camel(n)}CoinPaths16 = ${arr(p)} as const;\n`),
].join("\n");
writeFileSync(join(GEN, "paths.ts"), pathsModule);

/* geometry constants per optical size, mirrored from createIcon */
const OPTICAL = {
  lg: { canvas: 24, centre: 17.5, knockout: 5.5, stroke: 1.5 },
  sm: { canvas: 16, centre: 11.6, knockout: 3.9, stroke: 1.25 },
};

/**
 * Resolves an icon to the symbol names its module imports, per optical size.
 * Three shapes flow through here: a plain base, a base + modifier composition,
 * and a currency coin, which is a complete drawing with no modifier at all.
 */
/**
 * Turns a base's `fill` declaration into the index list the runtime needs, for
 * one optical size. Returns null when the base has no filled form, or when the
 * master has too few paths for the declared indices — which happens when a 16px
 * master drops detail the 24px one carries.
 */
function fillConfig(baseName, paths) {
  const spec = manifest.bases[baseName]?.fill;
  if (!spec || !paths) return null;
  const { container, skip = [] } = spec;

  if (container >= paths.length) {
    errors.push(
      `${baseName}: fill.container is ${container} but the master has ${paths.length} path(s)`,
    );
    return null;
  }
  for (const i of skip) {
    if (i >= paths.length) {
      errors.push(`${baseName}: fill.skip lists path ${i}, which the master does not have`);
      return null;
    }
  }

  const knockout = paths.map((_, i) => i).filter((i) => i !== container && !skip.includes(i));
  return { container, knockout };
}

function fillLiteral(cfg) {
  return cfg ? `, fill: { container: ${cfg.container}, knockout: [${cfg.knockout}] }` : "";
}

/** A drawn filled master supersedes the derived one. */
function solidLiteral(baseName, sixteen) {
  const has = (sixteen ? solidPaths16 : solidPaths)[baseName];
  return has ? `, solid: ${camel(baseName)}SolidPaths${sixteen ? "16" : ""}` : "";
}
function solidName(baseName, sixteen) {
  const has = (sixteen ? solidPaths16 : solidPaths)[baseName];
  return has ? [`${camel(baseName)}SolidPaths${sixteen ? "16" : ""}`] : [];
}

/**
 * A currency master is a closed ring followed by its glyph, always drawn inside
 * it — the same shape the derivation needs, so every currency coin fills.
 */
function coinFill(paths) {
  if (!paths) return null;
  return { container: 0, knockout: paths.map((_, i) => i).filter((i) => i !== 0) };
}

function resolve(icon) {
  if (icon.currency) {
    const sym = `${camel(icon.currency)}CoinPaths`;
    const fLg = coinFill(currencyPaths[icon.currency]);
    const fSm = coinFill(currencyPaths16[icon.currency]);
    return {
      lgNames: [sym],
      lg: `{ base: ${sym}${fillLiteral(fLg)} }`,
      smNames: currencyPaths16[icon.currency] ? [`${sym}16`] : null,
      sm: currencyPaths16[icon.currency] ? `{ base: ${sym}16${fillLiteral(fSm)} }` : null,
      lgPaths: { base: currencyPaths[icon.currency] },
      smPaths: currencyPaths16[icon.currency] ? { base: currencyPaths16[icon.currency] } : null,
      note: `${icon.symbol} — covers ${icon.covers.join(", ")}`,
      hasFilled: fLg != null,
    };
  }

  const b = camel(icon.base);
  const hasSmallBase = basePaths16[icon.base] != null;
  const hasSmallMod = !icon.modifier || modifierPaths16[icon.modifier] != null;
  const small = hasSmallBase && hasSmallMod;

  const fillLg = fillConfig(icon.base, basePaths[icon.base]);
  const fillSm = fillConfig(icon.base, basePaths16[icon.base]);

  if (!icon.modifier) {
    return {
      lgNames: [`${b}Paths`, ...solidName(icon.base, false)],
      lg: `{ base: ${b}Paths${fillLiteral(fillLg)}${solidLiteral(icon.base, false)} }`,
      smNames: small ? [`${b}Paths16`, ...solidName(icon.base, true)] : null,
      sm: small
        ? `{ base: ${b}Paths16${fillLiteral(fillSm)}${solidLiteral(icon.base, true)} }`
        : null,
      lgPaths: { base: basePaths[icon.base] },
      smPaths: small ? { base: basePaths16[icon.base] } : null,
      note: icon.base,
      hasFilled: fillLg != null || solidPaths[icon.base] != null,
    };
  }

  const m = camel(icon.modifier);
  return {
    lgNames: [`${b}Paths`, `${m}ModifierPaths`, ...solidName(icon.base, false)],
    lg: `{ base: ${b}Paths, modifier: ${m}ModifierPaths${fillLiteral(fillLg)}${solidLiteral(icon.base, false)} }`,
    smNames: small ? [`${b}Paths16`, `${m}ModifierPaths16`, ...solidName(icon.base, true)] : null,
    sm: small
      ? `{ base: ${b}Paths16, modifier: ${m}ModifierPaths16${fillLiteral(fillSm)}${solidLiteral(icon.base, true)} }`
      : null,
    lgPaths: { base: basePaths[icon.base], modifier: modifierPaths[icon.modifier] },
    smPaths: small
      ? { base: basePaths16[icon.base], modifier: modifierPaths16[icon.modifier] }
      : null,
    note: `${icon.base} + ${icon.modifier}`,
    hasFilled: fillLg != null || solidPaths[icon.base] != null,
  };
}

let smallCount = 0;
let filledCount = 0;

/* one component per icon */
for (const icon of icons) {
  const Comp = pascal(icon.name);
  const r = resolve(icon);
  if (r.smPaths) smallCount++;
  if (r.hasFilled) filledCount++;

  const names = [...r.lgNames, ...(r.smNames ?? [])];
  const sm = r.sm ? `,\n  sm: ${r.sm}` : "";

  const doc = `/** ${icon.zh} — ${r.note}${
    r.smPaths ? " · 24px and 16px optical masters" : " · 24px master only"
  } */`;

  /* The geometry, framework-neutral. Both runtimes consume this exact object,
     so a mark cannot drift between React and Angular. */
  writeFileSync(
    join(GEN, "defs", `${Comp}.ts`),
    `${HEADER}import type { IconDefinition } from "../../types.js";
import { ${names.join(", ")} } from "../paths.js";

${doc}
export const ${Comp}: IconDefinition = {
  name: "${Comp}",
  lg: ${r.lg}${sm},
};
`,
  );

  writeFileSync(
    join(GEN, "react", `${Comp}.ts`),
    `${HEADER}import { createIcon } from "../../createIcon.js";
import { ${Comp} as definition } from "../defs/${Comp}.js";

${doc}
export const ${Comp} = createIcon(definition);
export default ${Comp};
`,
  );

  /* raw SVG files, one per optical size */
  const p = (d, extra = "") => `<path pathLength="1"${extra} d="${d}"/>`;
  const emitSvg = (variant, geometry, suffix) => {
    const g = OPTICAL[variant];
    const id = `ko-${icon.name}${suffix}`;
    const body = geometry.modifier
      ? `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${g.canvas}" height="${g.canvas}">` +
        `<rect x="0" y="0" width="${g.canvas}" height="${g.canvas}" fill="#fff" stroke="none"/>` +
        `<circle cx="${g.centre}" cy="${g.centre}" r="${g.knockout}" fill="#000" stroke="none"/></mask>` +
        `<g mask="url(#${id})">${geometry.base.map((d) => p(d)).join("")}</g>` +
        geometry.modifier.map((d) => p(d, ' data-modifier=""')).join("")
      : geometry.base.map((d) => p(d)).join("");

    writeFileSync(
      join(DIST_SVG, `${icon.name}${suffix}.svg`),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.canvas} ${g.canvas}" fill="none" ` +
        `stroke="currentColor" stroke-width="${g.stroke}" stroke-linecap="round" ` +
        `stroke-linejoin="round">${body}</svg>\n`,
    );
  };

  emitSvg("lg", r.lgPaths, "");
  if (r.smPaths) emitSvg("sm", r.smPaths, "-16");
}

/* registry — deliberately imports everything, for pickers and docs */
writeFileSync(
  join(GEN, "registry.ts"),
  `${HEADER}import type { IconComponent } from "../createIcon.js";
${icons.map((i) => `import { ${pascal(i.name)} } from "./react/${pascal(i.name)}.js";`).join("\n")}

export interface IconMeta {
  name: string;
  zh: string;
  group: string;
  /** Curation, not a licence boundary — everything ships. */
  set: "core" | "extended";
  /** The base this is drawn from. Absent on currency coins, which stand alone. */
  base?: string;
  modifier?: string;
  /** Set on currency coins: the symbol drawn, and the codes it legitimately stands for. */
  symbol?: string;
  covers?: readonly string[];
  /** False when the icon has no dedicated 16px master and scales the 24px one down. */
  hasSmallMaster: boolean;
  /** False when variant="filled" falls back to the outline for this mark. */
  hasFilled: boolean;
  Component: IconComponent;
}

/**
 * Every icon in the set. Importing this pulls in the whole library — use it for
 * icon pickers and documentation, never in application code that ships to users.
 */
export const registry: readonly IconMeta[] = [
${icons
  .map((i) => {
    const r = resolve(i);
    return (
      `  { name: ${JSON.stringify(i.name)}, zh: ${JSON.stringify(i.zh)}, ` +
      `group: ${JSON.stringify(i.group)}, set: ${JSON.stringify(i.set)}, ` +
      (i.base ? `base: ${JSON.stringify(i.base)}, ` : "") +
      (i.modifier ? `modifier: ${JSON.stringify(i.modifier)}, ` : "") +
      (i.symbol ? `symbol: ${JSON.stringify(i.symbol)}, ` : "") +
      (i.covers ? `covers: ${JSON.stringify(i.covers)}, ` : "") +
      `hasSmallMaster: ${r.smPaths != null}, ` +
      `hasFilled: ${r.hasFilled === true}, ` +
      `Component: ${pascal(i.name)} },`
    );
  })
  .join("\n")}
];

/** Currency coins only, for building a currency picker. */
export const currencies = registry.filter((i) => i.symbol != null);

export const groups = ${JSON.stringify([...new Set(icons.map((i) => i.group))])} as const;
`,
);

/* the Angular entry point re-exports the component and every definition */
writeFileSync(
  join(GEN, "angular.ts"),
  `${HEADER}export { PayrollIconComponent } from "../angular/payroll-icon.js";
export { GRID, OPTICAL_BREAKPOINT } from "../types.js";
export type { IconDefinition, IconGeometry, IconMasters, OpticalSize } from "../types.js";

${icons.map((i) => `export { ${pascal(i.name)} } from "./defs/${pascal(i.name)}.js";`).join("\n")}
`,
);

/*
 * concepts — data only, and deliberately not importing any component.
 *
 * A screen asks "which mark means a job order?", which is a question about
 * vocabulary, not about rendering. Keeping the answer free of imports means
 * looking it up costs nothing at runtime and drags no icons into a bundle.
 */
/*
 * A core build ships fewer marks, so it must ship fewer concepts: a lookup that
 * answers with an icon the bundle does not contain is worse than answering with
 * nothing, because the caller has no way to tell.
 */
const emitted = new Set(icons.map((i) => i.name));
const conceptEntries = Object.entries(concepts).filter(([, c]) => emitted.has(c.icon));
writeFileSync(
  join(GEN, "concepts.ts"),
  `${HEADER}export interface Concept {
  /** The icon's registry name. */
  icon: string;
  zh: string;
  /** Present when the concept is specific to one jurisdiction. */
  region?: "HK" | "SG" | "MY";
  /**
   * True when the concept borrows the nearest mark instead of owning one.
   * These are the drawing backlog, not a judgement about the concept.
   */
  approximate?: boolean;
  /** Other words that should find this concept. */
  also?: readonly string[];
}

/** Every idea the set has an agreed mark for. */
export const concepts: Readonly<Record<string, Concept>> = {
${conceptEntries
  .map(([name, c]) => {
    const bits = [`icon: ${JSON.stringify(c.icon)}`, `zh: ${JSON.stringify(c.zh)}`];
    if (c.region) bits.push(`region: ${JSON.stringify(c.region)}`);
    if (c.approximate) bits.push("approximate: true");
    if (c.also) bits.push(`also: ${JSON.stringify(c.also)}`);
    return `  ${JSON.stringify(name)}: { ${bits.join(", ")} },`;
  })
  .join("\n")}
};

const norm = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[\\s_-]+/g, " ");

/**
 * Finds the mark for a term — the concept's own name, its Chinese label, or any
 * synonym. Case and separators are ignored, so "job order", "Job-Order" and
 * "job_order" all land on the same mark, and the build guarantees a term is
 * claimed by one concept only, so there is never a choice to make here.
 */
export function iconFor(term: string): string | undefined {
  const key = norm(term);
  for (const [name, c] of Object.entries(concepts)) {
    if (norm(name) === key || norm(c.zh) === key) return c.icon;
    if (c.also?.some((a) => norm(a) === key)) return c.icon;
  }
  return undefined;
}

/** Concepts still borrowing another mark — the drawing backlog. */
export const approximated: readonly string[] = ${JSON.stringify(
    conceptEntries.filter(([, c]) => c.approximate).map(([n]) => n),
  )};
`,
);

/* public barrel */
writeFileSync(
  join(GEN, "index.ts"),
  `${HEADER}${icons.map((i) => `export { ${pascal(i.name)} } from "./react/${pascal(i.name)}.js";`).join("\n")}
`,
);

/* ---------------------------------------------------------------- report */

const composed = icons.filter((i) => i.modifier).length;
if (warnings.length) {
  console.warn(`\n! ${warnings.length} warning(s):`);
  for (const w of warnings) console.warn(`  • ${w}`);
}
const optical = smallCount === icons.length ? "all" : `${smallCount}/${icons.length}`;
console.log(
  `\n✓ set "${SET}": ${icons.length} icons ` +
    `(${icons.length - composed} drawn, ${composed} composed) ` +
    `from ${Object.keys(basePaths).length} bases + ${Object.keys(modifierPaths).length} modifiers` +
    `\n  ${optical} have a dedicated 16px optical master` +
    (smallCount < icons.length ? " — the rest fall back to the 24px master scaled down" : "") +
    `\n  ${filledCount}/${icons.length} have a filled variant` +
    (filledCount < icons.length ? ' — the rest fall back to the outline on variant="filled"' : ""),
);

const approx = conceptEntries.filter(([, c]) => c.approximate);
console.log(
  `  ${conceptEntries.length} concepts mapped` +
    (approx.length
      ? `, ${approx.length} borrowing another mark: ${approx.map(([n]) => n).join(", ")}`
      : ""),
);
