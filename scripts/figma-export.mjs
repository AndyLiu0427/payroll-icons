/**
 * Emits a Figma-ready bundle from the built icon set.
 *
 *   figma-export/
 *     24/outline/payslip.svg
 *     24/filled/payslip.svg
 *     16/outline/payslip.svg
 *     …
 *     components.json     what to name each component and its variant properties
 *
 * Figma names a frame after the file it came from, so one folder per
 * size-and-style imports as a clean set. components.json then says how to
 * combine them: one component set per icon, with `size` and `style` variant
 * properties, matching the props on the React component so a designer and an
 * engineer are naming the same thing.
 *
 *   node scripts/figma-export.mjs
 *
 * Run after `npm run icons`, which is what writes the path data this reads.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = join(ROOT, "figma-export");

const manifest = JSON.parse(readFileSync(join(ROOT, "icons/manifest.json"), "utf8"));

/* The registry the build just generated is the list of what actually ships. */
const registrySrc = readFileSync(join(ROOT, "src/generated/registry.ts"), "utf8");
const pathsSrc = readFileSync(join(ROOT, "src/generated/paths.ts"), "utf8");

/** Pulls `export const fooPaths = [...]` back out of the generated module. */
function readPathArrays(src) {
  const out = {};
  for (const m of src.matchAll(/export const (\w+) = \[([\s\S]*?)\] as const;/g)) {
    out[m[1]] = [...m[2].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => JSON.parse(`"${x[1]}"`));
  }
  return out;
}
const PATHS = readPathArrays(pathsSrc);

/** And the registry rows, which carry the metadata we need for naming. */
const icons = [
  ...registrySrc.matchAll(
    /\{ name: "([^"]+)", zh: "([^"]*)", group: "([^"]+)", tier: "([^"]+)",([^}]*)\}/g,
  ),
].map((m) => {
  const rest = m[5];
  const grab = (k) => rest.match(new RegExp(`${k}: "([^"]*)"`))?.[1];
  return {
    name: m[1],
    zh: m[2],
    group: m[3],
    tier: m[4],
    base: grab("base"),
    modifier: grab("modifier"),
    symbol: grab("symbol"),
    hasSmallMaster: /hasSmallMaster: true/.test(rest),
    hasFilled: /hasFilled: true/.test(rest),
  };
});

const GRID = {
  24: { canvas: 24, centre: 17.5, knockout: 5.5, stroke: 1.5 },
  16: { canvas: 16, centre: 11.6, knockout: 3.9, stroke: 1.25 },
};

const camel = (s) => s.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());

/** Resolves an icon to its base and modifier path arrays at one size. */
function geometryFor(icon, size) {
  const sfx = size === 16 ? "16" : "";
  if (icon.symbol) {
    // RM and Rp have no 16-unit master; the exporter simply skips that variant.
    const coin = PATHS[`${camel(icon.name.replace(/^coin-/, ""))}CoinPaths${sfx}`];
    return coin ? { base: coin } : null;
  }
  const base = PATHS[`${camel(icon.base)}Paths${sfx}`];
  if (!base) return null;
  const modifier = icon.modifier ? PATHS[`${camel(icon.modifier)}ModifierPaths${sfx}`] : undefined;
  if (icon.modifier && !modifier) return null;
  return { base, modifier };
}

/** A drawn filled master, when the icon has one at this size. */
function solidFor(icon, size) {
  if (!icon.base) return null;
  return PATHS[`${camel(icon.base)}SolidPaths${size === 16 ? "16" : ""}`] ?? null;
}

function fillFor(icon, base) {
  if (!base) return null;
  // A currency master is a closed ring plus its glyph, always drawn inside it.
  if (icon.symbol) {
    return { container: 0, knockout: base.map((_, i) => i).filter((i) => i !== 0) };
  }
  const spec = manifest.bases[icon.base]?.fill;
  if (!spec) return null;
  const skip = spec.skip ?? [];
  return {
    container: spec.container,
    knockout: base.map((_, i) => i).filter((i) => i !== spec.container && !skip.includes(i)),
  };
}

const p = (d, extra = "") => `<path pathLength="1"${extra} d="${d}"/>`;

function render(icon, size, style) {
  const g = GRID[size];
  const geo = geometryFor(icon, size);
  if (!geo) return null;

  const open =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 ${g.canvas} ${g.canvas}" fill="none" stroke="currentColor" ` +
    `stroke-width="${g.stroke}" stroke-linecap="round" stroke-linejoin="round">`;
  const id = `ko-${icon.name}-${size}-${style}`;

  if (style === "filled") {
    const solid = solidFor(icon, size);
    if (solid) {
      const body = solid
        .map((d) => `<path d="${d}" fill="currentColor" fill-rule="evenodd"/>`)
        .join("");
      return geo.modifier
        ? `${open}<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${g.canvas}" height="${g.canvas}">` +
            `<rect x="0" y="0" width="${g.canvas}" height="${g.canvas}" fill="#fff" stroke="none"/>` +
            `<circle cx="${g.centre}" cy="${g.centre}" r="${g.knockout}" fill="#000" stroke="none"/></mask>` +
            `<g mask="url(#${id})">${body}</g>` +
            geo.modifier.map((d) => p(d, ' data-modifier=""')).join("") +
            `</svg>\n`
        : `${open}${body}</svg>\n`;
    }
    const fill = fillFor(icon, geo.base);
    if (!fill) return null;
    const body = geo.base[fill.container];
    return (
      `${open}<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${g.canvas}" height="${g.canvas}">` +
      `<path d="${body}" fill="#fff" stroke="#fff" stroke-width="${g.stroke}"/>` +
      fill.knockout
        .map(
          (i) => `<path d="${geo.base[i]}" fill="none" stroke="#000" stroke-width="${g.stroke}"/>`,
        )
        .join("") +
      (geo.modifier
        ? `<circle cx="${g.centre}" cy="${g.centre}" r="${g.knockout}" fill="#000" stroke="none"/>`
        : "") +
      `</mask>` +
      `<path d="${body}" fill="currentColor" stroke="currentColor" stroke-width="${g.stroke}" mask="url(#${id})"/>` +
      (geo.modifier ?? []).map((d) => p(d, ' data-modifier=""')).join("") +
      `</svg>\n`
    );
  }

  if (!geo.modifier) return `${open}${geo.base.map((d) => p(d)).join("")}</svg>\n`;
  return (
    `${open}<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${g.canvas}" height="${g.canvas}">` +
    `<rect x="0" y="0" width="${g.canvas}" height="${g.canvas}" fill="#fff" stroke="none"/>` +
    `<circle cx="${g.centre}" cy="${g.centre}" r="${g.knockout}" fill="#000" stroke="none"/></mask>` +
    `<g mask="url(#${id})">${geo.base.map((d) => p(d)).join("")}</g>` +
    geo.modifier.map((d) => p(d, ' data-modifier=""')).join("") +
    `</svg>\n`
  );
}

/* ------------------------------------------------------------------ emit */

rmSync(OUT, { recursive: true, force: true });

const components = [];
let files = 0;

for (const icon of icons) {
  const variants = [];
  for (const size of [24, 16]) {
    for (const style of ["outline", "filled"]) {
      const svg = render(icon, size, style);
      if (!svg) continue;
      const dir = join(OUT, String(size), style);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${icon.name}.svg`), svg);
      variants.push({ size, style, file: `${size}/${style}/${icon.name}.svg` });
      files++;
    }
  }
  if (!variants.length) continue;
  components.push({
    /* Slashes group the component in Figma's assets panel. */
    component: `Payroll/${icon.group}/${icon.name}`,
    description: icon.zh + (icon.modifier ? ` (${icon.base} + ${icon.modifier})` : ""),
    tier: icon.tier,
    /* Property names match the React props, so both sides say the same words. */
    variantProperties: {
      size: [...new Set(variants.map((v) => v.size))],
      style: [...new Set(variants.map((v) => v.style))],
    },
    variants,
  });
}

writeFileSync(
  join(OUT, "components.json"),
  `${JSON.stringify(
    {
      $comment:
        "Import each size/style folder into Figma, select the frames, Create Multiple Components, " +
        "then Combine as Variants per icon. Component and property names below match the React API.",
      generated: "scripts/figma-export.mjs",
      components,
    },
    null,
    2,
  )}\n`,
);

const withFilled = components.filter((c) => c.variantProperties.style.includes("filled")).length;
console.log(
  `\n✓ figma-export/: ${files} SVG files across ${components.length} components` +
    `\n  ${withFilled} have a filled style; the rest are outline only` +
    `\n  components.json describes the component and variant naming`,
);
