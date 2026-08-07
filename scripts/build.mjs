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

/** Pulls the path data out of a master. Masters are ours, so the shape is known. */
function readMaster(dir, name) {
  const file = join(ICONS, dir, `${name}.svg`);
  let raw;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    errors.push(`${dir}/${name}.svg is in the manifest but missing on disk`);
    return [];
  }

  const viewBox = raw.match(/viewBox="([^"]+)"/)?.[1];
  if (viewBox !== "0 0 24 24") {
    errors.push(`${dir}/${name}.svg has viewBox "${viewBox}" — every master must be 0 0 24 24`);
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

function optimisePaths(paths, label) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
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

for (const name of Object.keys(manifest.bases)) {
  basePaths[name] = optimisePaths(readMaster("bases", name), `bases/${name}`);
}
for (const name of Object.keys(manifest.modifiers)) {
  modifierPaths[name] = optimisePaths(readMaster("modifiers", name), `modifiers/${name}`);
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

/* framework-neutral path data */
const pathsModule = [
  HEADER,
  ...Object.entries(basePaths).map(
    ([n, p]) => `export const ${camel(n)}Paths = ${arr(p)} as const;\n`,
  ),
  ...Object.entries(modifierPaths).map(
    ([n, p]) => `export const ${camel(n)}ModifierPaths = ${arr(p)} as const;\n`,
  ),
].join("\n");
writeFileSync(join(GEN, "paths.ts"), pathsModule);

/* one component per icon */
for (const icon of icons) {
  const Comp = pascal(icon.name);
  const imports = icon.modifier
    ? `import { ${camel(icon.base)}Paths, ${camel(icon.modifier)}ModifierPaths } from "../paths";`
    : `import { ${camel(icon.base)}Paths } from "../paths";`;
  const args = icon.modifier
    ? `${camel(icon.base)}Paths, ${camel(icon.modifier)}ModifierPaths`
    : `${camel(icon.base)}Paths`;

  writeFileSync(
    join(GEN, "react", `${Comp}.ts`),
    `${HEADER}import { createIcon } from "../../createIcon";
${imports}

/** ${icon.zh} — ${icon.modifier ? `${icon.base} + ${icon.modifier}` : icon.base} */
export const ${Comp} = createIcon("${Comp}", ${args});
export default ${Comp};
`,
  );

  /* raw SVG, for consumers that want a file rather than a component */
  const p = (d, extra = "") => `<path pathLength="1"${extra} d="${d}"/>`;
  const body = icon.modifier
    ? `<mask id="ko-${icon.name}" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">` +
      `<rect x="0" y="0" width="24" height="24" fill="#fff" stroke="none"/>` +
      `<circle cx="17.5" cy="17.5" r="5.5" fill="#000" stroke="none"/></mask>` +
      `<g mask="url(#ko-${icon.name})">${basePaths[icon.base].map((d) => p(d)).join("")}</g>` +
      modifierPaths[icon.modifier].map((d) => p(d, ' data-modifier=""')).join("")
    : basePaths[icon.base].map((d) => p(d)).join("");

  writeFileSync(
    join(DIST_SVG, `${icon.name}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ` +
      `stroke="currentColor" stroke-width="1.5" stroke-linecap="round" ` +
      `stroke-linejoin="round">${body}</svg>\n`,
  );
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
console.log(
  `\n✓ tier "${TIER}": ${icons.length} icons ` +
    `(${icons.length - composed} drawn, ${composed} composed) ` +
    `from ${Object.keys(basePaths).length} bases + ${Object.keys(modifierPaths).length} modifiers`,
);
