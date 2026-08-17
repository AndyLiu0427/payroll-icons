/**
 * Resolves the built package the way a consumer will, not the way a permissive
 * bundler will.
 *
 * This exists because two release-blocking defects got past every other check:
 * the emitted imports had no file extensions, which Node ESM and strict-ESM
 * bundlers both reject on a "type": "module" package; and `sideEffects: false`
 * let webpack drop the animate.css import entirely. esbuild resolved the first
 * and papered over the second, so a green esbuild bundle proved nothing.
 *
 *   node scripts/smoke.mjs
 *
 * Run after `npm run build`. Exits non-zero on the first failure.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = new URL("..", import.meta.url).pathname;
const DIST = join(ROOT, "dist");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

const failures = [];
const ok = [];
const check = (label, fn) => {
  try {
    const detail = fn();
    ok.push(`${label}${detail ? ` — ${detail}` : ""}`);
  } catch (err) {
    failures.push(`${label}: ${err.message}`);
  }
};

/* ---- the package must exist before anything else is meaningful ---- */
if (!existsSync(DIST)) {
  console.error("\n✗ dist/ is missing — run `npm run build` first\n");
  process.exit(1);
}

/* ---- every path the exports map promises must be on disk ---- */
check("exports map resolves", () => {
  const missing = [];
  const walk = (key, value) => {
    if (typeof value === "string") {
      if (value.includes("*")) return;
      if (!existsSync(join(ROOT, value))) missing.push(`${key} -> ${value}`);
    } else {
      for (const [k, v] of Object.entries(value)) walk(`${key} [${k}]`, v);
    }
  };
  for (const [k, v] of Object.entries(pkg.exports)) walk(k, v);
  if (missing.length) throw new Error(`missing ${missing.join(", ")}`);
  return `${Object.keys(pkg.exports).length} entry points`;
});

/* ---- Node ESM refuses extensionless relative imports in a module package ---- */
check("no extensionless relative imports", () => {
  const bad = [];
  const scan = (dir) => {
    for (const entry of execFileSync("find", [dir, "-name", "*.js"], { encoding: "utf8" })
      .split("\n")
      .filter(Boolean)) {
      const src = readFileSync(entry, "utf8");
      for (const m of src.matchAll(/from\s+"(\.[^"]*)"/g)) {
        if (!m[1].endsWith(".js")) bad.push(`${entry.replace(ROOT, "")}: ${m[1]}`);
      }
    }
  };
  scan(DIST);
  if (bad.length) throw new Error(`${bad.length} found, e.g. ${bad[0]}`);
  return "all fully specified";
});

/* ---- a CSS file is a side effect; saying otherwise lets bundlers drop it ---- */
check("sideEffects protects the stylesheet", () => {
  const se = pkg.sideEffects;
  if (se === false) {
    throw new Error(
      'sideEffects: false lets webpack drop `import "…/animate.css"` — use ["**/*.css"]',
    );
  }
  if (!Array.isArray(se) || !se.some((p) => p.endsWith(".css"))) {
    throw new Error("sideEffects should list the CSS so bundlers keep it");
  }
  return JSON.stringify(se);
});

/* ---- and the real thing: import it the way Node will ---- */
const entries = [
  ["main", ".", ["createIcon", "toSvgString", "GRID", "OPTICAL_BREAKPOINT"]],
  ["registry", "./registry", ["registry", "currencies"]],
  ["paths", "./paths", ["coinPaths"]],
  ["concepts", "./concepts", ["concepts", "iconFor", "approximated"]],
];

for (const [label, subpath, expected] of entries) {
  const target = subpath === "." ? pkg.exports["."] : pkg.exports[subpath];
  const file = typeof target === "string" ? target : target.default;
  const mod = await import(pathToFileURL(join(ROOT, file)).href);
  check(`import ${label}`, () => {
    const missing = expected.filter((e) => mod[e] === undefined);
    if (missing.length) throw new Error(`missing export(s) ${missing.join(", ")}`);
    return `${Object.keys(mod).length} exports`;
  });
}

/* ---- the metadata npm renders on the package page ---- */
check("npm page metadata", () => {
  const missing = ["description", "license", "repository", "homepage", "bugs", "author"].filter(
    (f) => pkg[f] === undefined,
  );
  if (missing.length) throw new Error(`missing ${missing.join(", ")}`);
  return "complete";
});

/* ---------------------------------------------------------------- report */

for (const line of ok) console.log(`  ✓ ${line}`);
if (failures.length) {
  console.error(`\n✗ ${failures.length} release blocker(s):\n`);
  for (const f of failures) console.error(`  • ${f}`);
  console.error("");
  process.exit(1);
}
console.log(`\n✓ package resolves as a consumer will (${ok.length} checks)\n`);
