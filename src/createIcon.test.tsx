/**
 * Behaviour of the icon runtime. Geometry is covered by geometry.test.ts.
 *
 * Rendering goes through renderToStaticMarkup rather than a DOM: every claim
 * here is about the markup a consumer receives, so a real DOM would add a
 * dependency without adding confidence.
 */
import { renderToStaticMarkup as render } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createIcon, GRID, OPTICAL_BREAKPOINT, toSvgString } from "./createIcon.js";
import { Deduction, Payslip } from "./generated/index.js";

const LG = { base: ["M2 2h20v20H2z"], fill: { container: 0, knockout: [] } };
const SM = { base: ["M1 1h14v14H1z"] };

describe("size and stroke", () => {
  it("defaults to 24 and the large master's resting weight", () => {
    const html = render(<Payslip />);
    expect(html).toContain('width="24"');
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain(`stroke-width="${GRID.lg.strokeWidth}"`);
  });

  it("takes the small master's resting weight when it switches", () => {
    expect(render(<Payslip size={16} />)).toContain(`stroke-width="${GRID.sm.strokeWidth}"`);
  });

  it("lets an explicit strokeWidth win over the master's default", () => {
    expect(render(<Payslip size={16} strokeWidth={3} />)).toContain('stroke-width="3"');
  });

  it("scales the stroke against the box when absoluteStrokeWidth is set", () => {
    // 1.5 units on a 24 grid rendered at 48px would double visually; the prop
    // divides it back out so the rendered weight matches a 24px icon.
    const html = render(<Payslip size={48} strokeWidth={1.5} absoluteStrokeWidth />);
    expect(html).toContain('stroke-width="0.75"');
  });
});

describe("optical master selection", () => {
  const Dual = createIcon("Dual", { lg: LG, sm: SM });
  const LgOnly = createIcon("LgOnly", { lg: LG });

  it("uses the small master at and below the breakpoint", () => {
    expect(render(<Dual size={OPTICAL_BREAKPOINT} />)).toContain('viewBox="0 0 16 16"');
  });

  it("uses the large master above it", () => {
    expect(render(<Dual size={OPTICAL_BREAKPOINT + 1} />)).toContain('viewBox="0 0 24 24"');
  });

  it("can be forced in either direction", () => {
    expect(render(<Dual size={32} optical="sm" />)).toContain('viewBox="0 0 16 16"');
    expect(render(<Dual size={12} optical="lg" />)).toContain('viewBox="0 0 24 24"');
  });

  it("falls back to the large master rather than failing when there is no small one", () => {
    expect(render(<LgOnly size={16} />)).toContain('viewBox="0 0 24 24"');
  });
});

describe("filled variant", () => {
  it("is opt-in", () => {
    expect(render(<Payslip />)).not.toContain('data-variant="filled"');
    expect(render(<Payslip variant="filled" />)).toContain('data-variant="filled"');
  });

  it("paints a solid body and cuts the details out of it", () => {
    const html = render(<Payslip variant="filled" />);
    expect(html).toContain('fill="currentColor"');
    expect(html).toContain("<mask");
    expect(html).toMatch(/stroke="#000"/);
  });

  it("falls back to the outline on a mark with no filled form", () => {
    const NoFill = createIcon("NoFill", { lg: { base: ["M2 2h20"] } });
    expect(render(<NoFill variant="filled" />)).not.toContain('data-variant="filled"');
  });

  it("adds the badge knockout to the same mask on a composed mark", () => {
    const html = render(<Deduction variant="filled" />);
    expect(html).toContain("<mask");
    // one mask, carrying both the detail knockouts and the badge disc
    expect(html.match(/<mask/g)).toHaveLength(1);
    expect(html).toContain(`r="${GRID.lg.knockoutRadius}"`);
  });
});

describe("accessibility", () => {
  it("is decorative unless it is given a name", () => {
    const html = render(<Payslip />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role="img"');
  });

  it("enters the accessibility tree once it carries meaning", () => {
    const html = render(<Payslip aria-label="Payslip" />);
    expect(html).toContain('role="img"');
    expect(html).not.toContain("aria-hidden");
  });

  it("accepts aria-labelledby as a name too", () => {
    const html = render(<Payslip aria-labelledby="x" />);
    expect(html).toContain('role="img"');
    expect(html).not.toContain("aria-hidden");
  });
});

describe("mask ids", () => {
  it("are unique per instance, so two composed marks cannot collide", () => {
    const html = render(
      <>
        <Deduction />
        <Deduction />
      </>,
    );
    const ids = [...html.matchAll(/mask id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it("contain nothing that breaks a url(#…) reference", () => {
    const id = render(<Deduction />).match(/mask id="([^"]+)"/)?.[1];
    expect(id).toMatch(/^[A-Za-z][A-Za-z0-9]*$/);
  });
});

describe("passthrough", () => {
  it("forwards className and arbitrary svg props", () => {
    const html = render(<Payslip className="pi-draw" data-testid="x" focusable="false" />);
    expect(html).toContain('class="pi-draw"');
    expect(html).toContain('data-testid="x"');
    expect(html).toContain('focusable="false"');
  });

  it("lets a caller override a default", () => {
    expect(render(<Payslip stroke="red" />)).toContain('stroke="red"');
  });
});

describe("toSvgString", () => {
  it("produces the same geometry as the component, for non-React consumers", () => {
    const svg = toSvgString({ lg: { base: ["M2 2h20"] } }, { size: 20 });
    expect(svg).toContain('width="20"');
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain('d="M2 2h20"');
    expect(svg).toContain('stroke="currentColor"');
  });

  it("honours the optical breakpoint like the component does", () => {
    expect(toSvgString({ lg: LG, sm: SM }, { size: 16 })).toContain('viewBox="0 0 16 16"');
    expect(toSvgString({ lg: LG, sm: SM }, { size: 24 })).toContain('viewBox="0 0 24 24"');
  });
});
