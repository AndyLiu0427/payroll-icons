/**
 * Audits the shapes that recur across the set.
 *
 *   npm run shapes
 *
 * A set feels machine-made when the same object is drawn the same way every
 * time, and hand-made when it is not — a document corner at 2.5 in nine marks
 * and 2.0 in a tenth reads as sloppiness long before anyone can say why. This
 * prints what is actually in use so a new master can be checked against it.
 *
 * It reports rather than fails. Some divergence is deliberate — a ledger's page
 * edge is squarer than its spine on purpose — and a gate that cried wolf about
 * those would train everyone to ignore it. The canon in README.md is the
 * decision; this is the instrument that shows whether the drawings still match.
 *
 * Only arcs are read, and only their radius and sweep, so this needs none of
 * the point sampling in gaps.mjs.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const ICONS = join(ROOT, "icons");
const NUM = /-?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/y;

/** The canonical radii. Anything else is a decision someone should have made. */
export const CANON = {
  24: { largeCircle: 8.2, containerCorner: 2.5, smallCorner: 1.5 },
  16: { largeCircle: 5.5, containerCorner: 1.5, smallCorner: 1.0 },
};

/**
 * Every arc in `d`, with the radius as authored and the sweep it turns through.
 *
 * Sweep comes from the chord rather than a full endpoint-to-centre conversion:
 * telling a corner from a circle only needs to know roughly how far round the
 * arc goes, and the chord gives that in one step.
 */
export function walkArcs(d) {
  const out = [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let cmd = null;
  const sep = () => {
    while (i < d.length && " ,\n\t".includes(d[i])) i++;
  };
  const num = () => {
    sep();
    NUM.lastIndex = i;
    const m = NUM.exec(d);
    if (!m) throw new Error(`bad number at offset ${i}`);
    i = NUM.lastIndex;
    return Number(m[0]);
  };
  const flag = () => {
    sep();
    return d[i++] === "1" ? 1 : 0;
  };
  const skip = (n) => {
    for (let k = 0; k < n; k++) num();
  };

  sep();
  while (i < d.length) {
    if (/[A-Za-z]/.test(d[i])) cmd = d[i++];
    else if (cmd === "M") cmd = "L";
    else if (cmd === "m") cmd = "l";

    if (cmd === "M" || cmd === "m") {
      const [x, y] = [num(), num()];
      cx = cmd === "M" ? x : cx + x;
      cy = cmd === "M" ? y : cy + y;
      sx = cx;
      sy = cy;
    } else if (cmd === "L" || cmd === "l") {
      const [x, y] = [num(), num()];
      cx = cmd === "L" ? x : cx + x;
      cy = cmd === "L" ? y : cy + y;
    } else if (cmd === "H") cx = num();
    else if (cmd === "h") cx += num();
    else if (cmd === "V") cy = num();
    else if (cmd === "v") cy += num();
    else if (cmd === "C" || cmd === "c") {
      skip(4);
      const [x, y] = [num(), num()];
      cx = cmd === "C" ? x : cx + x;
      cy = cmd === "C" ? y : cy + y;
    } else if (cmd === "A" || cmd === "a") {
      const rx = num();
      num();
      num();
      const large = flag();
      flag();
      const [dx, dy] = [num(), num()];
      const ex = cmd === "A" ? dx : cx + dx;
      const ey = cmd === "A" ? dy : cy + dy;
      const chord = Math.hypot(ex - cx, ey - cy);
      const r = Math.max(rx, chord / 2);
      let sweep = 2 * Math.asin(Math.min(1, chord / (2 * r))) * (180 / Math.PI);
      if (large) sweep = 360 - sweep;
      out.push({ r: rx, sweep: Math.round(sweep) });
      cx = ex;
      cy = ey;
    } else if (cmd === "Z" || cmd === "z") {
      cx = sx;
      cy = sy;
    } else throw new Error(`unsupported path command "${cmd}"`);
    sep();
  }
  return out;
}

/** A corner turns about a quarter; a circle is drawn as two half arcs. */
export const roleOf = (arc) =>
  arc.sweep >= 150 ? "circle" : arc.sweep >= 55 && arc.sweep <= 120 ? "corner" : "other";

const DIRS = [
  ["bases", 24],
  ["currency", 24],
  ["modifiers", 24],
  ["bases-16", 16],
  ["currency-16", 16],
  ["modifiers-16", 16],
];

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [dir, grid] of DIRS) {
    const buckets = new Map();
    for (const file of readdirSync(join(ICONS, dir))) {
      const raw = readFileSync(join(ICONS, dir, file), "utf8");
      for (const m of raw.matchAll(/\bd="([^"]+)"/g)) {
        for (const arc of walkArcs(m[1])) {
          const key = `${roleOf(arc)}|${arc.r}`;
          if (!buckets.has(key))
            buckets.set(key, { role: roleOf(arc), r: arc.r, icons: new Set() });
          buckets.get(key).icons.add(file.replace(".svg", ""));
        }
      }
    }

    const canon = CANON[grid];
    console.log(`\n${dir}  (${grid}-grid)`);
    for (const role of ["circle", "corner", "other"]) {
      const rows = [...buckets.values()].filter((b) => b.role === role).sort((a, b) => a.r - b.r);
      if (!rows.length) continue;
      console.log(`  ${role}`);
      for (const row of rows) {
        const isCanon =
          row.r === canon.largeCircle ||
          row.r === canon.containerCorner ||
          row.r === canon.smallCorner;
        const names = [...row.icons].sort();
        console.log(
          `   ${isCanon ? "·" : " "} r=${String(row.r).padEnd(5)} ×${String(row.icons.size).padStart(2)}  ` +
            names.slice(0, 7).join(" ") +
            (names.length > 7 ? ` +${names.length - 7}` : ""),
        );
      }
    }
  }
  console.log(
    `\n· marks a radius in the canon: large circle ${CANON[24].largeCircle}/${CANON[16].largeCircle}, ` +
      `container corner ${CANON[24].containerCorner}/${CANON[16].containerCorner}, ` +
      `small corner ${CANON[24].smallCorner}/${CANON[16].smallCorner} (24/16).`,
  );
}
