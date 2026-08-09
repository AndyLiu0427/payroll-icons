/**
 * Pins the geometry and the system's invariants.
 *
 * The value of this library is precise path data, and nothing else guards it:
 * the build validates that masters are well formed, but a refactor that
 * silently changed a curve would pass every check and ship. The snapshot here
 * is that guard. When it fails, either the drawing changed on purpose — update
 * it — or something moved that should not have.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GRID } from "./createIcon.js";
import * as paths from "./generated/paths.js";
import { registry } from "./generated/registry.js";

const manifest = JSON.parse(
  readFileSync(new URL("../icons/manifest.json", import.meta.url), "utf8"),
);

/** Every path array the build emitted, keyed by export name. */
const allPaths = Object.entries(paths).filter(([, v]) => Array.isArray(v)) as [
  string,
  readonly string[],
][];

describe("geometry snapshot", () => {
  it("pins every path array", () => {
    const shape = Object.fromEntries(allPaths.map(([k, v]) => [k, v]));
    expect(shape).toMatchSnapshot();
  });

  it("pins the icon list and how each is composed", () => {
    expect(
      registry.map((i) =>
        [i.name, i.set, i.base ?? "-", i.modifier ?? "-", i.hasSmallMaster, i.hasFilled].join(" "),
      ),
    ).toMatchSnapshot();
  });
});

describe("grid discipline", () => {
  const within = (d: string, canvas: number) => {
    // Path data is authored, not arbitrary: every coordinate pair is a number
    // in grid units. Arc radii and flags are numbers too, so this is a coarse
    // bound rather than a bounding box — enough to catch a stray 40 in a 24 box.
    const nums = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
    return nums.every((n) => n >= -canvas && n <= canvas * 1.5);
  };

  it("keeps 24-unit masters in plausible range", () => {
    for (const [name, arr] of allPaths) {
      if (name.endsWith("16")) continue;
      for (const d of arr) expect(within(d, 24), `${name}: ${d}`).toBe(true);
    }
  });

  it("keeps 16-unit masters in plausible range", () => {
    for (const [name, arr] of allPaths) {
      if (!name.endsWith("16")) continue;
      for (const d of arr) expect(within(d, 16), `${name}: ${d}`).toBe(true);
    }
  });

  it("agrees with the manifest on the grid constants", () => {
    expect(GRID.lg.canvas).toBe(manifest.grid.canvas);
    expect(GRID.lg.knockoutCentre).toBe(manifest.grid.modifierCentre[0]);
    expect(GRID.lg.knockoutRadius).toBe(manifest.grid.knockoutRadius);
    expect(GRID.lg.strokeWidth).toBe(manifest.grid.strokeWidth);
  });
});

describe("system rules", () => {
  it("never badges a display-only base", () => {
    const displayOnly = Object.entries(manifest.bases)
      .filter(([, b]) => (b as { composable?: boolean }).composable === false)
      .map(([n]) => n);
    const offenders = registry.filter((i) => i.modifier && displayOnly.includes(i.base ?? ""));
    expect(offenders.map((i) => i.name)).toEqual([]);
  });

  it("never repeats a glyph the base already contains", () => {
    const offenders = registry.filter((i) => {
      const conflicts = (manifest.bases[i.base ?? ""] as { conflicts?: string[] })?.conflicts;
      return i.modifier && conflicts?.includes(i.modifier);
    });
    expect(offenders.map((i) => i.name)).toEqual([]);
  });

  it("gives a composed mark both halves at the same optical size", () => {
    // A 16-unit base with a 24-unit badge would place the badge off-grid.
    for (const icon of registry) {
      if (!icon.modifier || !icon.hasSmallMaster) continue;
      const base = (paths as Record<string, unknown>)[`${camel(icon.base ?? "")}Paths16`];
      const mod = (paths as Record<string, unknown>)[`${camel(icon.modifier)}ModifierPaths16`];
      expect(Boolean(base) && Boolean(mod), icon.name).toBe(true);
    }
  });

  it("carries no currency symbol on the generic coin", () => {
    // The whole point of coin is that one set serves every market.
    const coin = registry.find((i) => i.name === "coin");
    expect(coin?.symbol).toBeUndefined();
  });

  it("names every currency coin by symbol and lists what it covers", () => {
    for (const c of registry.filter((i) => i.symbol)) {
      expect(c.covers?.length, c.name).toBeGreaterThan(0);
    }
  });
});

describe("what ships", () => {
  it("exports one component per registry entry", () => {
    for (const icon of registry) expect(typeof icon.Component).toBe("object");
  });

  it("keeps the core subset a strict subset of the whole", () => {
    const core = registry.filter((i) => i.set === "core");
    expect(core.length).toBeGreaterThan(0);
    expect(core.length).toBeLessThan(registry.length);
  });

  it("has no duplicate names", () => {
    const names = registry.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("uses kebab-case names throughout", () => {
    for (const i of registry) expect(i.name, i.name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

function camel(s: string) {
  return s.replace(/[-_](\w)/g, (_, c: string) => c.toUpperCase());
}
