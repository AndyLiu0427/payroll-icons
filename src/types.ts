/**
 * The framework-neutral core: grid constants and the shape of an icon.
 *
 * This module imports nothing. Both the React and the Angular runtimes consume
 * the same `IconDefinition` objects, so a mark cannot drift between them — there
 * is one geometry and two ways to paint it.
 */

/**
 * Grid constants per optical size — must stay in sync with icons/manifest.json
 * and scripts/build.mjs.
 *
 * The small master is drawn on its own 16-unit grid rather than scaled from 24.
 * Below roughly 20px the modifier ring fills in and detail lines closer than
 * about 2.5 units fuse, so the small master carries fewer paths, larger
 * features, and badges with no ring at all.
 */
export const GRID = {
  lg: { canvas: 24, knockoutCentre: 17.5, knockoutRadius: 5.5, strokeWidth: 1.5 },
  sm: { canvas: 16, knockoutCentre: 11.6, knockoutRadius: 3.9, strokeWidth: 1.25 },
} as const;

/** At or below this rendered size the 16px master wins, when one exists. */
export const OPTICAL_BREAKPOINT = 18;

export type OpticalSize = keyof typeof GRID;

export interface IconGeometry {
  base: readonly string[];
  modifier?: readonly string[];
  /**
   * Enables the filled variant by derivation. `container` indexes the closed
   * outer path that becomes the solid body; `knockout` indexes the detail paths
   * cut out of it, so the mark stays legible on any background without a second
   * colour.
   *
   * Only marks whose outer path encloses every detail can be derived this way.
   * A calendar's tabs sit above its box and a person's shoulders outside their
   * head, so those carry `solid` instead.
   */
  fill?: { container: number; knockout: readonly number[] };
  /**
   * A drawn filled master — solid areas with counters as even-odd subpaths.
   * Supersedes `fill` for marks the derivation cannot reach.
   */
  solid?: readonly string[];
}

export interface IconMasters {
  lg: IconGeometry;
  sm?: IconGeometry;
}

/**
 * One icon, framework-neutral. This is what the Angular component takes and
 * what `createIcon` wraps for React.
 */
export interface IconDefinition extends IconMasters {
  /** PascalCase, matching the exported symbol. */
  name: string;
}

/** Resolves which master to paint, and with what geometry. */
export function resolveMasters(
  masters: IconMasters,
  size: number | string,
  optical: "auto" | OpticalSize,
): { variant: OpticalSize; grid: (typeof GRID)[OpticalSize]; geometry: IconGeometry } {
  const wantsSmall = optical === "sm" || (optical === "auto" && Number(size) <= OPTICAL_BREAKPOINT);
  const variant: OpticalSize = wantsSmall && masters.sm ? "sm" : "lg";
  return {
    variant,
    grid: GRID[variant],
    geometry: variant === "sm" && masters.sm ? masters.sm : masters.lg,
  };
}
