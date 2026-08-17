/**
 * Minimum-gap analysis for authored masters.
 *
 * Two strokes that sit a fraction of a unit apart do not read as two strokes —
 * they fill in and read as one thick smudge, and they do it first at the size
 * the icon is most often used. This module finds those pairs before they ship.
 *
 * Geometry is sampled in pure JS rather than rasterised so the check can run
 * inside the normal build. The masters only use M/L/H/V/C/A/Z, which keeps the
 * sampler small; anything else throws rather than being silently skipped.
 *
 * Distances here are between stroke *edges*, not centrelines: a 1.5-unit stroke
 * reaches 0.75 either side, so two centrelines 1.6 apart leave a 0.1 gap. The
 * eye responds to the gap, so that is what is measured.
 */

const TAU = Math.PI * 2;

/* Sub-unit sampling: fine enough that the closest approach is not stepped over,
   coarse enough that a whole set stays fast. */
const STEP = 0.12;

/**
 * Splits `d` into subpaths of sampled points. Each subpath is one continuous
 * stroke; separate subpaths are separate marks to the eye even when they share
 * a <path> element, which is why they are kept apart here.
 */
export function sampleSubpaths(d, label = "path") {
  const subpaths = [];
  let pts = null;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let cmd = null;
  let i = 0;

  /*
   * Scanned character by character rather than split on a token regex. Path
   * data packs numbers with no separator when the next one starts with a sign
   * or a dot — "a.9.9 0 1 0" is five numbers, not three — and a greedy [\d.]+
   * silently swallows ".9.9" as one. Arc flags are read positionally for the
   * same reason: they are single digits and may abut the coordinate after them.
   */
  const NUM = /-?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/y;
  const skipSep = () => {
    while (i < d.length && (d[i] === " " || d[i] === "," || d[i] === "\n" || d[i] === "\t")) i++;
  };
  const num = () => {
    skipSep();
    NUM.lastIndex = i;
    const m = NUM.exec(d);
    if (!m || m.index !== i) throw new Error(`${label}: expected a number at offset ${i}`);
    i = NUM.lastIndex;
    return Number(m[0]);
  };
  const flag = () => {
    skipSep();
    const c = d[i];
    if (c !== "0" && c !== "1") throw new Error(`${label}: expected an arc flag at offset ${i}`);
    i++;
    return c === "1" ? 1 : 0;
  };
  const push = (x, y) => {
    pts.push([x, y]);
  };
  const open = (x, y) => {
    pts = [[x, y]];
    subpaths.push(pts);
  };
  const lineTo = (x, y) => {
    const n = Math.max(1, Math.ceil(Math.hypot(x - cx, y - cy) / STEP));
    for (let k = 1; k <= n; k++) push(cx + ((x - cx) * k) / n, cy + ((y - cy) * k) / n);
    cx = x;
    cy = y;
  };
  const cubicTo = (x1, y1, x2, y2, x, y) => {
    const rough =
      Math.hypot(x1 - cx, y1 - cy) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x - x2, y - y2);
    const n = Math.max(2, Math.ceil(rough / STEP));
    const [ox, oy] = [cx, cy];
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const u = 1 - t;
      push(
        u * u * u * ox + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x,
        u * u * u * oy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y,
      );
    }
    cx = x;
    cy = y;
  };
  /* endpoint -> centre parameterisation, SVG spec F.6.5 */
  const arcTo = (rx, ry, rot, fA, fS, x, y) => {
    if (rx === 0 || ry === 0) return lineTo(x, y);
    rx = Math.abs(rx);
    ry = Math.abs(ry);
    const phi = (rot * Math.PI) / 180;
    const cosP = Math.cos(phi);
    const sinP = Math.sin(phi);
    const dx2 = (cx - x) / 2;
    const dy2 = (cy - y) / 2;
    const x1p = cosP * dx2 + sinP * dy2;
    const y1p = -sinP * dx2 + cosP * dy2;
    const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (lam > 1) {
      const s = Math.sqrt(lam);
      rx *= s;
      ry *= s;
    }
    const denom = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
    const numer = Math.max(0, rx * rx * ry * ry - denom);
    const coef = (fA === fS ? -1 : 1) * Math.sqrt(denom === 0 ? 0 : numer / denom);
    const cxp = (coef * rx * y1p) / ry;
    const cyp = (-coef * ry * x1p) / rx;
    const ccx = cosP * cxp - sinP * cyp + (cx + x) / 2;
    const ccy = sinP * cxp + cosP * cyp + (cy + y) / 2;
    const ang = (ux, uy, vx, vy) => {
      const d = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy));
      const a = Math.acos(Math.min(1, Math.max(-1, d)));
      return ux * vy - uy * vx < 0 ? -a : a;
    };
    const ux = (x1p - cxp) / rx;
    const uy = (y1p - cyp) / ry;
    const t1 = ang(1, 0, ux, uy);
    let dt = ang(ux, uy, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!fS && dt > 0) dt -= TAU;
    if (fS && dt < 0) dt += TAU;
    const n = Math.max(2, Math.ceil((Math.abs(dt) * Math.max(rx, ry)) / STEP));
    for (let k = 1; k <= n; k++) {
      const th = t1 + (dt * k) / n;
      push(
        cosP * rx * Math.cos(th) - sinP * ry * Math.sin(th) + ccx,
        sinP * rx * Math.cos(th) + cosP * ry * Math.sin(th) + ccy,
      );
    }
    cx = x;
    cy = y;
  };

  skipSep();
  while (i < d.length) {
    if (/[A-Za-z]/.test(d[i])) cmd = d[i++];
    // a repeated coordinate pair after a moveto is an implicit lineto
    else if (cmd === "M") cmd = "L";
    else if (cmd === "m") cmd = "l";

    switch (cmd) {
      case "M":
        cx = num();
        cy = num();
        sx = cx;
        sy = cy;
        open(cx, cy);
        break;
      case "m":
        cx += num();
        cy += num();
        sx = cx;
        sy = cy;
        open(cx, cy);
        break;
      case "L":
        lineTo(num(), num());
        break;
      case "l":
        lineTo(cx + num(), cy + num());
        break;
      case "H":
        lineTo(num(), cy);
        break;
      case "h":
        lineTo(cx + num(), cy);
        break;
      case "V":
        lineTo(cx, num());
        break;
      case "v":
        lineTo(cx, cy + num());
        break;
      case "C":
        cubicTo(num(), num(), num(), num(), num(), num());
        break;
      case "c": {
        const [a, b, c, d2, e, f] = [
          cx + num(),
          cy + num(),
          cx + num(),
          cy + num(),
          cx + num(),
          cy + num(),
        ];
        cubicTo(a, b, c, d2, e, f);
        break;
      }
      case "A": {
        const [rx, ry, rot, fA, fS] = [num(), num(), num(), flag(), flag()];
        arcTo(rx, ry, rot, fA, fS, num(), num());
        break;
      }
      case "a": {
        const [rx, ry, rot, fA, fS] = [num(), num(), num(), flag(), flag()];
        arcTo(rx, ry, rot, fA, fS, cx + num(), cy + num());
        break;
      }
      case "Z":
      case "z":
        lineTo(sx, sy);
        break;
      default:
        throw new Error(`${label}: unsupported path command "${cmd}"`);
    }
    skipSep();
  }
  return subpaths.filter((s) => s.length > 1);
}

/** Closest approach between two point runs, plus where it happens. */
function closest(a, b) {
  let best = Infinity;
  let at = null;
  for (const [ax, ay] of a) {
    for (const [bx, by] of b) {
      const dd = (ax - bx) ** 2 + (ay - by) ** 2;
      if (dd < best) {
        best = dd;
        at = [ax, ay];
      }
    }
  }
  return { dist: Math.sqrt(best), at };
}

/**
 * Finds stroke pairs whose edges come closer than `minGap` without meeting.
 *
 * Pairs that actually touch are left alone: shapes are joined on purpose all
 * over the set — a building's wing meets its wall, a calendar's tab meets its
 * box — and those read as one object rather than as two that failed to
 * separate. Only a gap that exists but is too small to see is a defect.
 */
export function findTightGaps(paths, { strokeWidth, minGap, label = "icon" }) {
  /* Ids read as "3" for a plain path and "3.1" for the second subpath of one
     that has several — the suffix only appears where it distinguishes something. */
  const runs = [];
  paths.forEach((d, pi) => {
    const subs = sampleSubpaths(d, `${label} path ${pi}`);
    subs.forEach((pts, si) => {
      runs.push({ pts, id: subs.length > 1 ? `${pi}.${si}` : `${pi}` });
    });
  });

  const found = [];
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      const { dist, at } = closest(runs[i].pts, runs[j].pts);
      const gap = dist - strokeWidth;
      if (gap > 0.02 && gap < minGap) {
        found.push({
          pair: `${runs[i].id}/${runs[j].id}`,
          gap: +gap.toFixed(2),
          at: at.map((v) => +v.toFixed(1)),
        });
      }
    }
  }
  return found.sort((a, b) => a.gap - b.gap);
}
