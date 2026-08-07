import type { CSSProperties, ForwardRefExoticComponent, RefAttributes, SVGProps } from "react";
import { createElement, forwardRef, useId } from "react";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "ref"> {
  /** Rendered width and height in px. Defaults to 24. */
  size?: number | string;
  /** Stroke weight in grid units. Defaults to 1.5. */
  strokeWidth?: number | string;
  /**
   * Keep the stroke visually constant across sizes instead of scaling it with
   * the icon. Useful when mixing 16px and 32px marks in the same row.
   */
  absoluteStrokeWidth?: boolean;
}

export type IconComponent = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;

/** Grid constants — must stay in sync with icons/manifest.json. */
export const GRID = {
  canvas: 24,
  knockoutCentre: 17.5,
  knockoutRadius: 5.5,
} as const;

const SVG_DEFAULTS = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: `0 0 ${GRID.canvas} ${GRID.canvas}`,
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/**
 * Builds an icon component from path data.
 *
 * Passing `modifier` produces a composed mark: the base is masked with a
 * knockout disc in the bottom-right zone and the modifier is drawn into the
 * hole. That knockout is what keeps a badge legible without a colour change,
 * so it is applied here rather than baked into the path data.
 */
export function createIcon(
  name: string,
  base: readonly string[],
  modifier?: readonly string[],
): IconComponent {
  const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(props, ref) {
    const { size = 24, strokeWidth = 1.5, absoluteStrokeWidth = false, children, ...rest } = props;

    // useId() output contains colons, which are legal in an id but awkward
    // inside url(#…) references — strip them.
    const maskId = `pi${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

    const resolvedStroke = absoluteStrokeWidth
      ? (Number(strokeWidth) * GRID.canvas) / Number(size)
      : strokeWidth;

    // An icon is decorative unless the caller gave it an accessible name.
    const named = rest["aria-label"] != null || rest["aria-labelledby"] != null;

    const basePaths = base.map((d, i) => createElement("path", { key: `b${i}`, d, pathLength: 1 }));

    const contents = modifier
      ? [
          createElement(
            "mask",
            {
              key: "mask",
              id: maskId,
              maskUnits: "userSpaceOnUse",
              x: 0,
              y: 0,
              width: GRID.canvas,
              height: GRID.canvas,
            },
            createElement("rect", {
              x: 0,
              y: 0,
              width: GRID.canvas,
              height: GRID.canvas,
              fill: "#fff",
              stroke: "none",
            }),
            createElement("circle", {
              cx: GRID.knockoutCentre,
              cy: GRID.knockoutCentre,
              r: GRID.knockoutRadius,
              fill: "#000",
              stroke: "none",
            }),
          ),
          createElement("g", { key: "base", mask: `url(#${maskId})` }, basePaths),
          ...modifier.map((d, i) =>
            createElement("path", { key: `m${i}`, d, pathLength: 1, "data-modifier": "" }),
          ),
        ]
      : basePaths;

    return createElement(
      "svg",
      {
        ref,
        ...SVG_DEFAULTS,
        width: size,
        height: size,
        strokeWidth: resolvedStroke,
        "aria-hidden": named ? undefined : true,
        role: named ? "img" : undefined,
        ...rest,
      },
      ...contents,
      children,
    );
  });

  Icon.displayName = name;
  return Icon;
}

/**
 * Renders an icon to an SVG string. For consumers outside React — Angular
 * templates, server-rendered email, static site generators.
 */
export function toSvgString(
  base: readonly string[],
  modifier?: readonly string[],
  options: { size?: number; strokeWidth?: number; id?: string } = {},
): string {
  const { size = 24, strokeWidth = 1.5, id = "pi" } = options;
  const attrs =
    `xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 ${GRID.canvas} ${GRID.canvas}" fill="none" stroke="currentColor" ` +
    `stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"`;
  const p = (d: string, extra = "") => `<path pathLength="1"${extra} d="${d}"/>`;

  if (!modifier) {
    return `<svg ${attrs}>${base.map((d) => p(d)).join("")}</svg>`;
  }

  const maskId = `${id}-knockout`;
  return (
    `<svg ${attrs}>` +
    `<mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">` +
    `<rect x="0" y="0" width="24" height="24" fill="#fff" stroke="none"/>` +
    `<circle cx="${GRID.knockoutCentre}" cy="${GRID.knockoutCentre}" r="${GRID.knockoutRadius}" fill="#000" stroke="none"/>` +
    `</mask>` +
    `<g mask="url(#${maskId})">${base.map((d) => p(d)).join("")}</g>` +
    modifier.map((d) => p(d, ' data-modifier=""')).join("") +
    `</svg>`
  );
}

/** Re-exported so generated modules can annotate themselves. */
export type IconStyle = CSSProperties;
