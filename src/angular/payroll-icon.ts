import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { type IconDefinition, type OpticalSize, resolveMasters } from "../types.js";

/**
 * Renders a payroll icon.
 *
 * Takes the icon *object* rather than a name, the same shape lucide-angular
 * uses, so a template only pulls in the marks it names and the rest tree-shake
 * away. A name-keyed registry would import all 54.
 *
 *   import { Payslip, Deduction } from "@octomate/payroll-icons/angular";
 *
 *   <pi-icon [icon]="Payslip" />
 *   <pi-icon [icon]="Deduction" [size]="16" />
 *   <pi-icon [icon]="Payslip" variant="filled" ariaLabel="Payslip" />
 *
 * Colour comes from `currentColor`, so the icon takes the colour of whatever it
 * sits in — style the host, not the icon.
 */
let nextMaskId = 0;

@Component({
  selector: "pi-icon",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      [attr.viewBox]="viewBox()"
      [attr.width]="size()"
      [attr.height]="size()"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="resolvedStroke()"
      stroke-linecap="round"
      stroke-linejoin="round"
      [attr.data-variant]="isFilled() ? 'filled' : null"
      [attr.aria-hidden]="ariaLabel() ? null : 'true'"
      [attr.role]="ariaLabel() ? 'img' : null"
      [attr.aria-label]="ariaLabel()"
    >
      @if (mask(); as m) {
        <mask
          [attr.id]="maskId"
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          [attr.width]="canvas()"
          [attr.height]="canvas()"
        >
          @if (m.body; as body) {
            <!-- filled-by-derivation: the solid body, minus its own detail -->
            <path [attr.d]="body" fill="#fff" stroke="#fff" [attr.stroke-width]="resolvedStroke()" />
            @for (d of m.knockout; track $index) {
              <path [attr.d]="d" fill="none" stroke="#000" [attr.stroke-width]="resolvedStroke()" />
            }
          } @else {
            <rect x="0" y="0" [attr.width]="canvas()" [attr.height]="canvas()" fill="#fff" stroke="none" />
          }
          @if (m.badge) {
            <circle
              [attr.cx]="grid().knockoutCentre"
              [attr.cy]="grid().knockoutCentre"
              [attr.r]="grid().knockoutRadius"
              fill="#000"
              stroke="none"
            />
          }
        </mask>
      }

      @if (solidPaths(); as solid) {
        <g [attr.mask]="maskRef()">
          @for (d of solid; track $index) {
            <path [attr.d]="d" fill="currentColor" fill-rule="evenodd" stroke="none" />
          }
        </g>
      } @else if (filledBody(); as body) {
        <path
          [attr.d]="body"
          fill="currentColor"
          stroke="currentColor"
          [attr.stroke-width]="resolvedStroke()"
          [attr.mask]="maskRef()"
        />
      } @else if (modifierPaths()) {
        <g [attr.mask]="maskRef()">
          @for (d of basePaths(); track $index) {
            <path [attr.d]="d" pathLength="1" />
          }
        </g>
      } @else {
        @for (d of basePaths(); track $index) {
          <path [attr.d]="d" pathLength="1" />
        }
      }

      @for (d of modifierPaths(); track $index) {
        <path [attr.d]="d" pathLength="1" data-modifier="" />
      }
    </svg>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
    `,
  ],
})
export class PayrollIconComponent {
  /** The icon to draw. Import it by name from the package. */
  readonly icon = input.required<IconDefinition>();
  /** Rendered width and height in px. */
  readonly size = input<number>(24);
  /** Stroke weight in grid units. Unset follows the master: 1.5 at 24, 1.25 at 16. */
  readonly strokeWidth = input<number | undefined>(undefined);
  /** Keep the stroke visually constant across sizes instead of scaling with the box. */
  readonly absoluteStrokeWidth = input<boolean>(false);
  /** Which optical master to draw. "auto" picks the 16-unit one at 18px and below. */
  readonly optical = input<"auto" | OpticalSize>("auto");
  /** "filled" is the solid weight for selected and tab-bar states. */
  readonly variant = input<"outline" | "filled">("outline");
  /**
   * Giving the icon a name moves it into the accessibility tree as role="img".
   * Leave it unset when the surrounding text already carries the meaning.
   */
  readonly ariaLabel = input<string | undefined>(undefined);

  /**
   * Angular has no useId, so ids come from a module counter — the same approach
   * Angular Material takes. Two instances of one icon on a page get different
   * ids, which is what url(#…) needs.
   */
  protected readonly maskId = `pi-${nextMaskId++}`;

  private readonly resolved = computed(() =>
    resolveMasters(this.icon(), this.size(), this.optical()),
  );

  protected readonly grid = computed(() => this.resolved().grid);
  protected readonly canvas = computed(() => this.resolved().grid.canvas);
  protected readonly viewBox = computed(() => `0 0 ${this.canvas()} ${this.canvas()}`);
  protected readonly basePaths = computed(() => this.resolved().geometry.base);
  protected readonly modifierPaths = computed(() => this.resolved().geometry.modifier ?? null);

  /** Filled only applies where the mark has a filled form; otherwise it stays outline. */
  protected readonly isFilled = computed(() => {
    if (this.variant() !== "filled") return false;
    const g = this.resolved().geometry;
    return g.solid != null || g.fill != null;
  });

  protected readonly solidPaths = computed(() =>
    this.isFilled() ? (this.resolved().geometry.solid ?? null) : null,
  );

  protected readonly filledBody = computed(() => {
    if (!this.isFilled() || this.solidPaths()) return null;
    const g = this.resolved().geometry;
    return g.fill ? (g.base[g.fill.container] ?? null) : null;
  });

  /**
   * One mask carries every subtraction — detail strokes cut out of a filled
   * body, plus the badge disc on a composed mark. Two masks cannot stack on one
   * element, so they merge here.
   */
  protected readonly mask = computed(() => {
    const g = this.resolved().geometry;
    const badge = g.modifier != null;
    if (this.isFilled() && g.fill && !g.solid) {
      return {
        body: g.base[g.fill.container],
        knockout: g.fill.knockout.map((i) => g.base[i]).filter((d): d is string => d != null),
        badge,
      };
    }
    if (badge) return { body: null, knockout: [], badge };
    return null;
  });

  protected readonly maskRef = computed(() => (this.mask() ? `url(#${this.maskId})` : null));

  protected readonly resolvedStroke = computed(() => {
    const { grid } = this.resolved();
    const requested = this.strokeWidth() ?? grid.strokeWidth;
    return this.absoluteStrokeWidth() ? (requested * grid.canvas) / this.size() : requested;
  });
}

export type { IconDefinition, IconGeometry, IconMasters, OpticalSize } from "../types.js";
export { GRID, OPTICAL_BREAKPOINT } from "../types.js";
