/**
 * Verifies every number the documentation states against the set itself.
 *
 *   npm run docs
 *
 * README.md and ADOPTION.md quote a couple of dozen counts — icons, bases,
 * modifiers, how many bases refuse a badge, how many filled forms are derived
 * rather than drawn. Every one of them goes stale the moment a mark is added,
 * and a document that confidently states a wrong number is worse than one that
 * states none, because a reader has no way to tell.
 *
 * This reads the manifest and the icons directory — not the build output — so
 * it can run before anything is generated, and it never writes: it reports what
 * to change and exits 1.
 *
 * A pattern that stops matching is a failure, not a skip. A check that quietly
 * matches nothing looks exactly like a check that passes, which is how a stale
 * number survives a green build.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const ICONS = join(ROOT, "icons");
const manifest = JSON.parse(readFileSync(join(ICONS, "manifest.json"), "utf8"));
const concepts = JSON.parse(readFileSync(join(ICONS, "concepts.json"), "utf8")).concepts;

const count = (dir) => readdirSync(join(ICONS, dir)).length;
const has = (dir, name) => existsSync(join(ICONS, dir, `${name}.svg`));

/* The set, derived the same way the build derives it. */
const icons = [
  ...Object.entries(manifest.bases).map(([name, m]) => ({
    name,
    set: m.set,
    sm: has("bases-16", name),
    derived: m.fill != null,
    drawn: has("bases-filled", name),
  })),
  ...manifest.compositions.map((c) => ({
    name: c.name,
    set: c.set,
    sm: has("bases-16", c.base) && has("modifiers-16", c.modifier),
    derived: manifest.bases[c.base]?.fill != null,
    drawn: has("bases-filled", c.base),
  })),
  ...Object.entries(manifest.currencies).map(([name, m]) => ({
    name: `coin-${name}`,
    set: m.set,
    sm: has("currency-16", name),
    derived: true, // a ring with its glyph inside is exactly what the derivation wants
    drawn: false,
  })),
];

const nonComposable = Object.entries(manifest.bases)
  .filter(([, b]) => b.composable === false)
  .map(([n]) => n);
const withSmall = icons.filter((i) => i.sm).length;
const WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];

/*
 * Each check pins one documented value to one computed value. The pattern must
 * capture exactly the text that should change when the set changes — no more,
 * so a rewording of the surrounding prose does not trip it, and no less, so a
 * stale number cannot hide.
 */
const checks = [
  ["README.md", "icon total", /^\*\*(\d+) icons\*\*/m, String(icons.length)],
  [
    "README.md",
    "core count",
    /- \*\*core\*\* \((\d+)\)/,
    String(icons.filter((i) => i.set === "core").length),
  ],
  [
    "README.md",
    "bases in the core line",
    /the marks nearly every payroll product needs: all (\d+) bases/,
    String(Object.keys(manifest.bases).length),
  ],
  [
    "README.md",
    "bases that refuse a badge",
    /reads as damaged\. ([A-Za-z]+) bases are/,
    WORDS[nonComposable.length] ?? String(nonComposable.length),
  ],
  [
    "README.md",
    "confusability pair count",
    /^([\d,]+) pairs is about/m,
    ((withSmall * (withSmall - 1)) / 2).toLocaleString("en-US"),
  ],
  [
    "README.md",
    "derived filled forms",
    /\*\*Derived\*\* \((\d+) marks\)/,
    String(icons.filter((i) => i.derived && !i.drawn).length),
  ],
  [
    "README.md",
    "drawn filled forms",
    /\*\*Drawn\*\* \((\d+) marks\)/,
    String(icons.filter((i) => i.drawn).length),
  ],
  [
    "README.md",
    "authored 24-unit bases",
    /bases\/\*\.svg\s+(\d+) authored/,
    String(count("bases")),
  ],
  [
    "README.md",
    "authored 16-unit bases",
    /bases-16\/\*\.svg\s+(\d+) authored/,
    String(count("bases-16")),
  ],
  [
    "README.md",
    "authored 24-unit modifiers",
    /modifiers\/\*\.svg\s+(\d+) authored/,
    String(count("modifiers")),
  ],
  [
    "README.md",
    "authored 16-unit modifiers",
    /modifiers-16\/\*\.svg\s+(\d+) authored/,
    String(count("modifiers-16")),
  ],
  [
    "README.md",
    "drawn solid masters",
    /bases-filled\/\*\.svg\s+(\d+) drawn solid/,
    String(count("bases-filled")),
  ],
  [
    "README.md",
    "drawn solid masters at 16",
    /bases-filled-16\/\*\.svg\s+(\d+) of those/,
    String(count("bases-filled-16")),
  ],
  [
    "README.md",
    "currency coins",
    /currency\/\*\.svg\s+(\d+) currency coins/,
    String(count("currency")),
  ],
  [
    "README.md",
    "currency coins at 16",
    /currency-16\/\*\.svg\s+(\d+) of those/,
    String(count("currency-16")),
  ],
  [
    "ADOPTION.md",
    "bases in the gap section",
    /^(\d+) bases and \d+ modifiers compose/m,
    String(Object.keys(manifest.bases).length),
  ],
  [
    "ADOPTION.md",
    "modifiers in the gap section",
    /^\d+ bases and (\d+) modifiers compose/m,
    String(Object.keys(manifest.modifiers).length),
  ],
  [
    "ADOPTION.md",
    "bases that refuse a badge",
    /\*\*([A-Za-z]+) bases cannot take a badge\*\*/,
    WORDS[nonComposable.length] ?? String(nonComposable.length),
  ],
  [
    "ADOPTION.md",
    "concepts still borrowing a mark",
    /^Today that is (\d+)/m,
    String(Object.values(concepts).filter((c) => c.approximate).length),
  ],
];

/* Lists go stale too, and more quietly than numbers — `draft` was missing from
   the modifier line for a whole release. */
const lists = [
  [
    "README.md",
    "the modifier vocabulary",
    /\*\*Modifiers\*\* are the states — ([^.]+)\./,
    Object.keys(manifest.modifiers),
  ],
  [
    "ADOPTION.md",
    "the bases that refuse a badge",
    /\*\*[A-Za-z]+ bases cannot take a badge\*\* — ([^.]+)\./,
    nonComposable,
  ],
];

const problems = [];
const lineOf = (text, index) => text.slice(0, index).split("\n").length;

for (const [file, label, pattern, expected] of checks) {
  const text = readFileSync(join(ROOT, file), "utf8");
  const m = text.match(pattern);
  if (!m) {
    problems.push(
      `${file}: the ${label} sentence no longer matches its pattern — reword it back, or update the pattern in scripts/docs-check.mjs`,
    );
    continue;
  }
  // the same word can open a sentence or sit mid-line, so case is not the point
  if (m[1].toLowerCase() !== expected.toLowerCase()) {
    problems.push(
      `${file}:${lineOf(text, m.index)} ${label} says ${m[1]}, but the set has ${expected}`,
    );
  }
}

for (const [file, label, pattern, expected] of lists) {
  const text = readFileSync(join(ROOT, file), "utf8");
  const m = text.match(pattern);
  if (!m) {
    problems.push(
      `${file}: the ${label} sentence no longer matches its pattern — reword it back, or update the pattern in scripts/docs-check.mjs`,
    );
    continue;
  }
  const named = [...m[1].matchAll(/`([^`]+)`/g)].map((x) => x[1]);
  const missing = expected.filter((e) => !named.includes(e));
  const extra = named.filter((n) => !expected.includes(n));
  if (missing.length || extra.length) {
    problems.push(
      `${file}:${lineOf(text, m.index)} ${label} is out of date` +
        (missing.length ? ` — missing ${missing.join(", ")}` : "") +
        (extra.length ? ` — lists ${extra.join(", ")}, which is not one` : ""),
    );
  }
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} stale figure(s) in the documentation:\n`);
  for (const p of problems) console.error(`  • ${p}`);
  console.error("");
  process.exit(1);
}
console.log(
  `✓ documentation agrees with the set (${checks.length} figures, ${lists.length} lists)`,
);
