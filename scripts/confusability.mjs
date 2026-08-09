/**
 * Measures how alike any two marks look at 16px, where the set is hardest to read.
 *
 * Every icon is rasterised at 16px (supersampled, so antialiasing does not
 * dominate) and compared pairwise on ink coverage: shared ink over total ink.
 * Two icons that occupy the same pixels score high.
 *
 *   node scripts/confusability.mjs           report
 *   node scripts/confusability.mjs --check    exit non-zero past the threshold
 *
 * Reading the numbers:
 *
 * - **Same base, different badge** is the design working. `deduction` and
 *   `bonus` are coin+down and coin+plus; they are meant to share everything but
 *   the badge, and they score in the 90s. Those are reported separately.
 * - **Circle families** score high on the shared outline alone. A stroke circle
 *   is mostly outline, so `coin` and `clock` start at ~78% before either draws
 *   anything inside. Treat that as a floor, not a defect.
 * - **Cross-base collisions** are the real signal: two marks with different
 *   meanings and different construction that still land on the same pixels.
 *
 * Needs a browser to rasterise, so it drives the same headless Chrome the docs
 * preview uses. Run after `npm run icons`.
 */
import { readFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;
const CHECK = process.argv.includes("--check");
/** Above this, a cross-base pair is worth looking at by eye. */
const THRESHOLD = 0.85;

const registrySrc = readFileSync(`${ROOT}src/generated/registry.ts`, "utf8");
const pathsSrc = readFileSync(`${ROOT}src/generated/paths.ts`, "utf8");

const arrays = {};
for (const m of pathsSrc.matchAll(/export const (\w+) = \[([\s\S]*?)\] as const;/g)) {
  arrays[m[1]] = [...m[2].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => JSON.parse(`"${x[1]}"`));
}

const icons = [
  ...registrySrc.matchAll(
    /\{ name: "([^"]+)", zh: "[^"]*", group: "([^"]+)", set: "[^"]+",([^}]*)\}/g,
  ),
].map((m) => ({
  name: m[1],
  group: m[2],
  base: m[3].match(/base: "([^"]*)"/)?.[1] ?? null,
  modifier: m[3].match(/modifier: "([^"]*)"/)?.[1] ?? null,
  currency: /symbol:/.test(m[3]),
}));

if (!icons.length) {
  console.error("\n✗ parsed 0 icons from the generated registry — run `npm run icons` first\n");
  process.exit(1);
}

const camel = (s) => s.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
const GRID = { centre: 11.6, knockout: 3.9, stroke: 1.25 };

/** The 16-unit geometry for one icon, or null when it has no small master. */
function geometry(icon) {
  if (icon.currency) {
    const coin = arrays[`${camel(icon.name.replace(/^coin-/, ""))}CoinPaths16`];
    return coin ? { base: coin } : null;
  }
  const base = arrays[`${camel(icon.base)}Paths16`];
  if (!base) return null;
  const modifier = icon.modifier ? arrays[`${camel(icon.modifier)}ModifierPaths16`] : null;
  if (icon.modifier && !modifier) return null;
  return { base, modifier };
}

const renderable = [];
const skipped = [];
for (const icon of icons) {
  const g = geometry(icon);
  if (!g) {
    skipped.push(icon.name);
    continue;
  }
  const p = (d) => `<path d="${d}"/>`;
  const body = g.modifier
    ? `<mask id="k" maskUnits="userSpaceOnUse" x="0" y="0" width="16" height="16">` +
      `<rect width="16" height="16" fill="#fff" stroke="none"/>` +
      `<circle cx="${GRID.centre}" cy="${GRID.centre}" r="${GRID.knockout}" fill="#000" stroke="none"/>` +
      `</mask><g mask="url(#k)">${g.base.map(p).join("")}</g>${g.modifier.map(p).join("")}`
    : g.base.map(p).join("");
  renderable.push({
    ...icon,
    svg:
      `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" ` +
      `fill="none" stroke="#000" stroke-width="${GRID.stroke}" stroke-linecap="round" ` +
      `stroke-linejoin="round">${body}</svg>`,
  });
}

/* ------------------------------------------------------- rasterise + score */

const { chromium } = await import("playwright").catch(() => ({ chromium: null }));
if (!chromium) {
  console.error(
    "\n✗ needs playwright to rasterise: npm i -D playwright && npx playwright install chromium\n",
  );
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage();
const pairs = await page.evaluate(
  async ([list, supersample]) => {
    const N = 16 * supersample;
    const raster = async (svg) => {
      const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
        svg.replace('width="16" height="16"', `width="${N}" height="${N}"`),
      )}`;
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = url;
      });
      const c = document.createElement("canvas");
      c.width = N;
      c.height = N;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, N, N);
      const d = ctx.getImageData(0, 0, N, N).data;
      const a = new Float32Array(N * N);
      for (let i = 0; i < N * N; i++) a[i] = d[i * 4 + 3] / 255;
      return a;
    };
    const maps = [];
    for (const ic of list) maps.push({ ...ic, a: await raster(ic.svg) });
    const out = [];
    for (let i = 0; i < maps.length; i++) {
      for (let j = i + 1; j < maps.length; j++) {
        let inter = 0;
        let uni = 0;
        const x = maps[i].a;
        const y = maps[j].a;
        for (let k = 0; k < x.length; k++) {
          inter += Math.min(x[k], y[k]);
          uni += Math.max(x[k], y[k]);
        }
        out.push({
          a: maps[i].name,
          b: maps[j].name,
          sameBase: Boolean(maps[i].base) && maps[i].base === maps[j].base,
          crossGroup: maps[i].group !== maps[j].group,
          s: uni === 0 ? 0 : inter / uni,
        });
      }
    }
    return out;
  },
  [renderable, 4],
);
await browser.close();

pairs.sort((p, q) => q.s - p.s);
const crossBase = pairs.filter((p) => !p.sameBase);
const sameBase = pairs.filter((p) => p.sameBase);
const median = pairs[Math.floor(pairs.length / 2)].s;
const pct = (n) => `${(n * 100).toFixed(1)}%`;
const line = (p) =>
  `  ${pct(p.s).padStart(6)}  ${p.a} · ${p.b}${p.crossGroup ? "  [cross-group]" : ""}`;

console.log(
  `\n${renderable.length} icons, ${pairs.length} pairs, rasterised at 16px` +
    (skipped.length ? ` (skipped, no 16px master: ${skipped.join(", ")})` : ""),
);
console.log(`median similarity ${pct(median)}\n`);
console.log("cross-base — different marks that look alike:");
console.log(crossBase.slice(0, 12).map(line).join("\n"));
console.log("\nsame base, different badge — expected to be close:");
console.log(sameBase.slice(0, 5).map(line).join("\n"));

const over = crossBase.filter((p) => p.s >= THRESHOLD);
if (over.length) {
  console.log(`\n! ${over.length} cross-base pair(s) at or above ${pct(THRESHOLD)}:`);
  console.log(over.map(line).join("\n"));
}
console.log("");

if (CHECK && over.length) process.exit(1);
