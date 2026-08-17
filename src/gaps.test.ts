/**
 * Covers the path sampler behind the build's minimum-gap guard.
 *
 * The guard can only fail a build correctly if the sampler reads geometry
 * correctly, and the sampler is the one piece of this repo that reimplements a
 * spec — arc endpoint parameterisation, and a scanner for the ways path data
 * packs numbers together. Both have failure modes that look like success: a
 * mis-parsed arc still produces points, just the wrong ones, and the guard then
 * passes a mark it should have caught.
 */
import { describe, expect, it } from "vitest";
// @ts-expect-error — build tooling is plain JS, deliberately untyped
import { findTightGaps, sampleSubpaths } from "../scripts/gaps.mjs";

const flat = (d: string) => sampleSubpaths(d).flat() as [number, number][];
const maxRadialError = (pts: [number, number][], cx: number, cy: number, r: number) =>
  Math.max(...pts.map(([x, y]) => Math.abs(Math.hypot(x - cx, y - cy) - r)));

describe("scanning path data", () => {
  it("separates numbers that are packed without a delimiter", () => {
    // ".9.9" is two numbers; a greedy [\d.]+ reads it as one and shifts every
    // argument after it by one position.
    const pts = flat("M5.4 5.2a.9.9 0 1 0 1.8 0 .9.9 0 1 0-1.8 0z");
    expect(maxRadialError(pts, 6.3, 5.2, 0.9)).toBeLessThan(0.02);
  });

  it("reads arc flags positionally, even when they abut the next coordinate", () => {
    const spaced = flat("M2 8a6 6 0 0 1 12 0");
    const packed = flat("M2 8a6 6 0 011 12 0".replace("0 011 12 0", "0 0 1 12 0"));
    expect(packed.length).toBe(spaced.length);
    expect(maxRadialError(spaced, 8, 8, 6)).toBeLessThan(0.02);
  });

  it("treats an extra coordinate pair after a moveto as a lineto", () => {
    const [sub] = sampleSubpaths("M2 2 10 2");
    expect(sub.at(-1)).toEqual([10, 2]);
  });

  it("follows the sweep flag rather than always taking the short way round", () => {
    const [a] = sampleSubpaths("M4 8a4 4 0 0 1 8 0");
    const [b] = sampleSubpaths("M4 8a4 4 0 0 0 8 0");
    expect(a[Math.floor(a.length / 2)][1]).toBeLessThan(8); // sweeps above
    expect(b[Math.floor(b.length / 2)][1]).toBeGreaterThan(8); // sweeps below
  });

  it("refuses a command it cannot draw instead of skipping it", () => {
    expect(() => sampleSubpaths("M2 2Q6 6 10 2", "quad")).toThrow(/unsupported/);
  });
});

describe("subpath splitting", () => {
  it("keeps subpaths of one <path> apart, since the eye sees separate marks", () => {
    expect(sampleSubpaths("M6.8 7h1.6M10.4 7h1.6")).toHaveLength(2);
  });
});

describe("finding gaps", () => {
  const gapOf = (a: string, b: string, strokeWidth: number) =>
    findTightGaps([a, b], { strokeWidth, minGap: 99 })[0]?.gap;

  it("measures between stroke edges, not centrelines", () => {
    // centrelines 2 apart, stroke 1.5 -> 0.5 of white between the edges
    expect(gapOf("M4 8h16", "M4 10h16", 1.5)).toBeCloseTo(0.5, 2);
  });

  it("ignores shapes that meet, which the set joins on purpose", () => {
    expect(findTightGaps(["M4 8h16", "M12 8v8"], { strokeWidth: 1.5, minGap: 99 })).toHaveLength(0);
  });

  it("ignores shapes that overlap outright", () => {
    expect(findTightGaps(["M4 8h16", "M4 8.5h16"], { strokeWidth: 1.5, minGap: 99 })).toHaveLength(
      0,
    );
  });

  it("reports only pairs under the threshold", () => {
    const paths = ["M4 4h16", "M4 6h16", "M4 12h16"];
    const found = findTightGaps(paths, { strokeWidth: 1.5, minGap: 1 });
    expect(found.map((f: { pair: string }) => f.pair)).toEqual(["0/1"]);
  });

  it("names where the closest approach happens, so a fix has somewhere to go", () => {
    const [hit] = findTightGaps(["M4 8h4", "M4 10h4"], { strokeWidth: 1.5, minGap: 99 });
    expect(hit.at[1]).toBeCloseTo(8, 1);
  });

  it("scales with stroke weight — the same drawing is tighter at 16", () => {
    expect(gapOf("M4 8h8", "M4 10h8", 1.25)).toBeGreaterThan(gapOf("M4 8h8", "M4 10h8", 1.5));
  });
});
