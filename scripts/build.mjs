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
 *   node scripts/build.mjs            all icons
 *   node scripts/build.mjs --tier free   free-tier subset only
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { optimize } from "svgo";

const ROOT = new URL("..", import.meta.url).pathname;
const ICONS = join(ROOT, "icons");
const GEN = join(ROOT, "src/generated");
const DIST_SVG = join(ROOT, "dist/svg");

const tierArg = process.argv.indexOf("--tier");
const TIER = tierArg !== -1 ? process.argv[tierArg + 1] : "pro";
const TIERS = TIER === "free" ? new Set(["free"]) : new Set(["free", "pro"]);

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
function readMaster(dir, name, { canvas = 24, optional = false } = {}) {
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
    if (!/pathLength="1"/.test(attrs)) {
      errors.push(`${dir}/${name}.svg has a path without pathLength="1"`);
    }
    const d = attrs.match(/\bd="([^"]+)"/)?.[1];
    if (d) data.push(d);
  }
  if (!data.length) errors.push(`${dir}/${name}.svg has no path data`);
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

for (const name of Object.keys(manifest.bases)) {
  basePaths[name] = optimisePaths(readMaster("bases", name), `bases/${name}`);
  basePaths16[name] = optimisePaths(
    readMaster("bases-16", name, { canvas: 16, optional: true }),
    `bases-16/${name}`,
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

/* every file on disk must be declared, or it silently never ships */
for (const [dir, declared] of [
  ["bases", manifest.bases],
  ["modifiers", manifest.modifiers],
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

if (errors.length) {
  console.error(`\n✗ ${errors.length} problem(s) in the icon set:\n`);
  for (const e of errors) console.error(`  • ${e}`);
  console.error("");
  process.exit(1);
}

/* ------------------------------------------------------------------ emit */

rmSync(GEN, { recursive: true, force: true });
mkdirSync(join(GEN, "react"), { recursive: true });
mkdirSync(DIST_SVG, { recursive: true });

const pascal = (s) => s.replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase());
const camel = (s) => s.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());

/** Everything that ships, flattened: plain bases first, then composed marks. */
const icons = [
  ...Object.entries(manifest.bases)
    .filter(([, m]) => TIERS.has(m.tier))
    .map(([name, m]) => ({ name, zh: m.zh, group: m.group, tier: m.tier, base: name })),
  ...manifest.compositions
    .filter((c) => TIERS.has(c.tier))
    .map((c) => ({
      name: c.name,
      zh: c.zh,
      group: manifest.bases[c.base].group,
      tier: c.tier,
      base: c.base,
      modifier: c.modifier,
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
].join("\n");
writeFileSync(join(GEN, "paths.ts"), pathsModule);

/* geometry constants per optical size, mirrored from createIcon */
const OPTICAL = {
  lg: { canvas: 24, centre: 17.5, knockout: 5.5, stroke: 1.5 },
  sm: { canvas: 16, centre: 11.6, knockout: 3.9, stroke: 1.25 },
};

/** A composed mark only gets a small variant when both halves have one. */
function smallPair(icon) {
  const base = basePaths16[icon.base];
  if (!base) return null;
  if (!icon.modifier) return { base };
  const modifier = modifierPaths16[icon.modifier];
  return modifier ? { base, modifier } : null;
}

let smallCount = 0;

/* one component per icon */
for (const icon of icons) {
  const Comp = pascal(icon.name);
  const small = smallPair(icon);
  if (small) smallCount++;

  const names = [`${camel(icon.base)}Paths`];
  if (icon.modifier) names.push(`${camel(icon.modifier)}ModifierPaths`);
  if (small) {
    names.push(`${camel(icon.base)}Paths16`);
    if (icon.modifier) names.push(`${camel(icon.modifier)}ModifierPaths16`);
  }

  const lg = icon.modifier
    ? `{ base: ${camel(icon.base)}Paths, modifier: ${camel(icon.modifier)}ModifierPaths }`
    : `{ base: ${camel(icon.base)}Paths }`;
  const sm = small
    ? icon.modifier
      ? `,\n  sm: { base: ${camel(icon.base)}Paths16, modifier: ${camel(icon.modifier)}ModifierPaths16 }`
      : `,\n  sm: { base: ${camel(icon.base)}Paths16 }`
    : "";

  writeFileSync(
    join(GEN, "react", `${Comp}.ts`),
    `${HEADER}import { createIcon } from "../../createIcon";
import { ${names.join(", ")} } from "../paths";

/** ${icon.zh} — ${icon.modifier ? `${icon.base} + ${icon.modifier}` : icon.base}${
      small ? " · 24px and 16px optical masters" : " · 24px master only"
    } */
export const ${Comp} = createIcon("${Comp}", {
  lg: ${lg}${sm},
});
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

  emitSvg(
    "lg",
    {
      base: basePaths[icon.base],
      modifier: icon.modifier ? modifierPaths[icon.modifier] : undefined,
    },
    "",
  );
  if (small) emitSvg("sm", small, "-16");
}

/* registry — deliberately imports everything, for pickers and docs */
writeFileSync(
  join(GEN, "registry.ts"),
  `${HEADER}import type { IconComponent } from "../createIcon";
${icons.map((i) => `import { ${pascal(i.name)} } from "./react/${pascal(i.name)}";`).join("\n")}

export interface IconMeta {
  name: string;
  zh: string;
  group: string;
  tier: "free" | "pro";
  base: string;
  modifier?: string;
  Component: IconComponent;
}

/**
 * Every icon in the set. Importing this pulls in the whole library — use it for
 * icon pickers and documentation, never in application code that ships to users.
 */
export const registry: readonly IconMeta[] = [
${icons
  .map(
    (i) =>
      `  { name: ${JSON.stringify(i.name)}, zh: ${JSON.stringify(i.zh)}, ` +
      `group: ${JSON.stringify(i.group)}, tier: ${JSON.stringify(i.tier)}, ` +
      `base: ${JSON.stringify(i.base)}, ` +
      (i.modifier ? `modifier: ${JSON.stringify(i.modifier)}, ` : "") +
      `Component: ${pascal(i.name)} },`,
  )
  .join("\n")}
];

export const groups = ${JSON.stringify([...new Set(icons.map((i) => i.group))])} as const;
`,
);

/* public barrel */
writeFileSync(
  join(GEN, "index.ts"),
  `${HEADER}${icons.map((i) => `export { ${pascal(i.name)} } from "./react/${pascal(i.name)}";`).join("\n")}
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
  `\n✓ tier "${TIER}": ${icons.length} icons ` +
    `(${icons.length - composed} drawn, ${composed} composed) ` +
    `from ${Object.keys(basePaths).length} bases + ${Object.keys(modifierPaths).length} modifiers` +
    `\n  ${optical} have a dedicated 16px optical master` +
    (smallCount < icons.length ? " — the rest fall back to the 24px master scaled down" : ""),
);
