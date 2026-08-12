import type { CSSProperties, ForwardRefExoticComponent, RefAttributes, SVGProps } from "react";
import { createElement, forwardRef, useId } from "react";
import { GRID, type IconDefinition, type IconMasters, OPTICAL_BREAKPOINT } from "./types.js";

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
  /**
   * Which optical master to draw. "auto" (the default) picks the 16px master at
   * 18px and below, where it exists. Force one when an icon sits in a row that
   * must stay visually consistent regardless of its own box.
   */
  optical?: "auto" | "lg" | "sm";
  /**
   * `"filled"` gives the solid weight used for selected and tab-bar states.
   * Falls back to the outline on marks that have no filled form — a nav row
   * never breaks, it just stops changing weight for that one item. Check
   * `hasFilled` on the registry entry if you need to know in advance.
   */
  variant?: "outline" | "filled";
}

export type IconComponent = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;

export type { IconDefinition, IconGeometry, IconMasters, OpticalSize } from "./types.js";
export { GRID, OPTICAL_BREAKPOINT } from "./types.js";

const SVG_DEFAULTS = {
  xmlns: "http://www.w3.org/2000/svg",
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
export function createIcon(definition: IconDefinition): IconComponent {
  const { name, ...masters }: { name: string } & IconMasters = definition;
  const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(props, ref) {
    const {
      size = 24,
      strokeWidth,
      absoluteStrokeWidth = false,
      optical = "auto",
      variant = "outline",
      children,
      ...rest
    } = props;

    // useId() output contains colons, which are legal in an id but awkward
    // inside url(#…) references — strip them.
    const maskId = `pi${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

    const wantsSmall =
      optical === "sm" || (optical === "auto" && Number(size) <= OPTICAL_BREAKPOINT);
    const opticalVariant = wantsSmall && masters.sm ? "sm" : "lg";
    const grid = GRID[opticalVariant];
    const geometry = opticalVariant === "sm" && masters.sm ? masters.sm : masters.lg;

    // Each master has its own resting weight, so an unset strokeWidth follows
    // the master rather than a single library-wide default.
    const requested = strokeWidth ?? grid.strokeWidth;
    const resolvedStroke = absoluteStrokeWidth
      ? (Number(requested) * grid.canvas) / Number(size)
      : requested;

    // An icon is decorative unless the caller gave it an accessible name.
    const named = rest["aria-label"] != null || rest["aria-labelledby"] != null;

    const basePaths = geometry.base.map((d, i) =>
      createElement("path", { key: `b${i}`, d, pathLength: 1 }),
    );

    const filled = variant === "filled" && (geometry.solid != null || geometry.fill != null);

    /* A drawn filled master is already the finished silhouette — just paint it. */
    if (filled && geometry.solid) {
      const badge = geometry.modifier;
      return createElement(
        "svg",
        {
          ref,
          ...SVG_DEFAULTS,
          viewBox: `0 0 ${grid.canvas} ${grid.canvas}`,
          width: size,
          height: size,
          strokeWidth: resolvedStroke,
          "data-variant": "filled",
          "aria-hidden": named ? undefined : true,
          role: named ? "img" : undefined,
          ...rest,
        },
        badge
          ? createElement(
              "mask",
              {
                key: "mask",
                id: maskId,
                maskUnits: "userSpaceOnUse",
                x: 0,
                y: 0,
                width: grid.canvas,
                height: grid.canvas,
              },
              createElement("rect", {
                x: 0,
                y: 0,
                width: grid.canvas,
                height: grid.canvas,
                fill: "#fff",
                stroke: "none",
              }),
              createElement("circle", {
                cx: grid.knockoutCentre,
                cy: grid.knockoutCentre,
                r: grid.knockoutRadius,
                fill: "#000",
                stroke: "none",
              }),
            )
          : null,
        createElement(
          "g",
          { key: "solid", ...(badge ? { mask: `url(#${maskId})` } : {}) },
          geometry.solid.map((d, i) =>
            createElement("path", {
              key: `s${i}`,
              d,
              fill: "currentColor",
              fillRule: "evenodd",
              stroke: "none",
            }),
          ),
        ),
        ...(badge ?? []).map((d, i) =>
          createElement("path", { key: `m${i}`, d, pathLength: 1, "data-modifier": "" }),
        ),
        children,
      );
    }

    /*
     * One mask carries every subtraction: the detail strokes cut out of the
     * solid body, plus the badge disc when the mark is composed. Two masks
     * cannot stack on one element, so they are merged here.
     */
    if (filled && geometry.fill) {
      const { container, knockout } = geometry.fill;
      const body = geometry.base[container];
      return createElement(
        "svg",
        {
          ref,
          ...SVG_DEFAULTS,
          viewBox: `0 0 ${grid.canvas} ${grid.canvas}`,
          width: size,
          height: size,
          strokeWidth: resolvedStroke,
          "data-variant": "filled",
          "aria-hidden": named ? undefined : true,
          role: named ? "img" : undefined,
          ...rest,
        },
        createElement(
          "mask",
          {
            key: "mask",
            id: maskId,
            maskUnits: "userSpaceOnUse",
            x: 0,
            y: 0,
            width: grid.canvas,
            height: grid.canvas,
          },
          createElement("path", {
            key: "body",
            d: body,
            fill: "#fff",
            stroke: "#fff",
            strokeWidth: resolvedStroke,
          }),
          ...knockout.map((i) =>
            createElement("path", {
              key: `k${i}`,
              d: geometry.base[i],
              fill: "none",
              stroke: "#000",
              strokeWidth: resolvedStroke,
            }),
          ),
          geometry.modifier
            ? createElement("circle", {
                key: "badge",
                cx: grid.knockoutCentre,
                cy: grid.knockoutCentre,
                r: grid.knockoutRadius,
                fill: "#000",
                stroke: "none",
              })
            : null,
        ),
        createElement("path", {
          key: "solid",
          d: body,
          fill: "currentColor",
          stroke: "currentColor",
          strokeWidth: resolvedStroke,
          mask: `url(#${maskId})`,
        }),
        ...(geometry.modifier ?? []).map((d, i) =>
          createElement("path", { key: `m${i}`, d, pathLength: 1, "data-modifier": "" }),
        ),
        children,
      );
    }

    const contents = geometry.modifier
      ? [
          createElement(
            "mask",
            {
              key: "mask",
              id: maskId,
              maskUnits: "userSpaceOnUse",
              x: 0,
              y: 0,
              width: grid.canvas,
              height: grid.canvas,
            },
            createElement("rect", {
              x: 0,
              y: 0,
              width: grid.canvas,
              height: grid.canvas,
              fill: "#fff",
              stroke: "none",
            }),
            createElement("circle", {
              cx: grid.knockoutCentre,
              cy: grid.knockoutCentre,
              r: grid.knockoutRadius,
              fill: "#000",
              stroke: "none",
            }),
          ),
          createElement("g", { key: "base", mask: `url(#${maskId})` }, basePaths),
          ...geometry.modifier.map((d, i) =>
            createElement("path", { key: `m${i}`, d, pathLength: 1, "data-modifier": "" }),
          ),
        ]
      : basePaths;

    return createElement(
      "svg",
      {
        ref,
        ...SVG_DEFAULTS,
        viewBox: `0 0 ${grid.canvas} ${grid.canvas}`,
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
  masters: IconMasters,
  options: {
    size?: number;
    strokeWidth?: number;
    id?: string;
    optical?: "auto" | "lg" | "sm";
  } = {},
): string {
  const { size = 24, strokeWidth, id = "pi", optical = "auto" } = options;

  const wantsSmall = optical === "sm" || (optical === "auto" && size <= OPTICAL_BREAKPOINT);
  const opticalVariant = wantsSmall && masters.sm ? "sm" : "lg";
  const grid = GRID[opticalVariant];
  const geometry = opticalVariant === "sm" && masters.sm ? masters.sm : masters.lg;
  const sw = strokeWidth ?? grid.strokeWidth;

  const attrs =
    `xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 ${grid.canvas} ${grid.canvas}" fill="none" stroke="currentColor" ` +
    `stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"`;
  const p = (d: string, extra = "") => `<path pathLength="1"${extra} d="${d}"/>`;

  if (!geometry.modifier) {
    return `<svg ${attrs}>${geometry.base.map((d) => p(d)).join("")}</svg>`;
  }

  const maskId = `${id}-knockout`;
  const c = grid.canvas;
  return (
    `<svg ${attrs}>` +
    `<mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="${c}" height="${c}">` +
    `<rect x="0" y="0" width="${c}" height="${c}" fill="#fff" stroke="none"/>` +
    `<circle cx="${grid.knockoutCentre}" cy="${grid.knockoutCentre}" r="${grid.knockoutRadius}" fill="#000" stroke="none"/>` +
    `</mask>` +
    `<g mask="url(#${maskId})">${geometry.base.map((d) => p(d)).join("")}</g>` +
    geometry.modifier.map((d) => p(d, ' data-modifier=""')).join("") +
    `</svg>`
  );
}

/** Re-exported so generated modules can annotate themselves. */
export type IconStyle = CSSProperties;
