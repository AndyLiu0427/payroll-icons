/**
 * Covers the concept table and its lookup.
 *
 * The table's whole value is that one idea resolves to one mark, everywhere. So
 * what is worth testing is not that the data loads but that the resolution
 * holds: that a term someone would plausibly type finds the mark, and that no
 * term finds two.
 *
 * Both failures this guards against were real. The first draft missed "job
 * order" because the key is hyphenated, and missed "強積金" because the lookup
 * searched synonyms but not the Chinese label — the word half the team types.
 */
import { describe, expect, it } from "vitest";
import { approximated, concepts, iconFor } from "./generated/concepts.js";
import { registry } from "./generated/registry.js";

const names = new Set(registry.map((i) => i.name));

describe("the table itself", () => {
  it("only points at marks that exist", () => {
    const dangling = Object.entries(concepts)
      .filter(([, c]) => !names.has(c.icon))
      .map(([n]) => n);
    expect(dangling).toEqual([]);
  });

  it("gives every concept a Chinese label, since half the team reads that first", () => {
    const missing = Object.entries(concepts)
      .filter(([, c]) => !c.zh?.trim())
      .map(([n]) => n);
    expect(missing).toEqual([]);
  });

  it("never lets one term resolve to two marks", () => {
    const owner = new Map<string, string>();
    const clashes: string[] = [];
    for (const [name, c] of Object.entries(concepts)) {
      for (const term of [name, c.zh, ...(c.also ?? [])]) {
        const key = term
          .trim()
          .toLowerCase()
          .replace(/[\s_-]+/g, " ");
        const held = owner.get(key);
        if (held && held !== name) clashes.push(`${term}: ${held} / ${name}`);
        owner.set(key, name);
      }
    }
    expect(clashes).toEqual([]);
  });
});

describe("looking a concept up", () => {
  it("finds a mark by its concept name", () => {
    expect(iconFor("assignment")).toBe("assignment");
  });

  it("ignores case and separators, so a typed phrase still lands", () => {
    for (const term of ["job-order", "job order", "Job Order", "JOB_ORDER", "  job order  "]) {
      expect(iconFor(term)).toBe("job-order");
    }
  });

  it("finds a mark by its Chinese label", () => {
    expect(iconFor("強積金")).toBe("pension-contribution");
    expect(iconFor("薪資批次")).toBe("pay-run");
  });

  it("finds a mark by a synonym someone would actually type", () => {
    expect(iconFor("PTO")).toBe("leave");
    expect(iconFor("年假")).toBe("leave");
    expect(iconFor("requisition")).toBe("job-order");
    expect(iconFor("KWSP")).toBe("pension-contribution");
  });

  it("sends the statutory names of all three jurisdictions somewhere sensible", () => {
    // the same idea in three countries should not scatter across three marks
    expect(iconFor("mpf")).toBe(iconFor("cpf"));
    expect(iconFor("cpf")).toBe(iconFor("epf"));
  });

  it("returns nothing rather than guessing", () => {
    expect(iconFor("nonsense")).toBeUndefined();
    expect(iconFor("")).toBeUndefined();
  });
});

describe("the drawing backlog", () => {
  it("lists exactly the concepts that borrow another mark", () => {
    const flagged = Object.entries(concepts)
      .filter(([, c]) => c.approximate)
      .map(([n]) => n);
    expect([...approximated].sort()).toEqual(flagged.sort());
  });

  it("still resolves — an approximation is a usable mark, not a hole", () => {
    for (const name of approximated) expect(iconFor(name)).toBeTruthy();
  });
});
