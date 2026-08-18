# Putting this into a product

The set is measured and tested, but nothing here has been in front of a user.
This is what to watch for, ordered by how likely it is to be wrong.

The version is still 0.x deliberately. **While the major is 0, a mark's drawing can
change without it being a breaking release** — so this is the window in which
feedback is cheap to act on. The component API is a different matter and follows
semver from the start.

---

## 1. The five marks most likely to need changing

Each of these has a specific, falsifiable thing to watch for. If nobody trips on
it, the mark is fine and this file can shrink.

### `coin` — does a circle with two bars read as an amount?

The generic money mark carries no currency symbol on purpose, so one set serves
every market. What it gains in neutrality it may lose in recognition.

It is also the most constrained mark in the set: the badge knockout reaches to
within 2.28 units of the icon centre, so anything drawn toward the bottom-right
is eaten. A concentric rim — the most coin-like alternative — is impossible at
any usable radius. Six alternatives were drawn and this was the only one that
survived both the constraint and a legibility check.

**Watch for:** anyone asking what the circle means. Anyone reaching for a
currency coin (`CoinDollar` and friends) in a place where the amount is generic.
Anyone using a text label where the icon should have carried it alone.

### `bonus` against `overtime`

`coin + plus` and `clock + plus`. Two circles, same badge. Measured 78.8% alike
at 16px, and they are in **different groups** — money and time — which is the
worst kind of collision, because a payroll run summary can show both at once.

**Watch for:** a wrong click in any list where both appear. Anyone describing
one to a colleague as "the circle with the plus".

Same shape of problem, one step milder: `recurring-payment` against `shift`
(`coin + recurring` and `clock + recurring`), measured 82.1%.

### `coin-dollar` against `coin-baht`

Measured 82.4% alike at 16px, the closest cross-base pair in the set. `$` and
`฿` are both a vertical stroke through a form, so this is largely inherent to
the symbols rather than to the drawing.

**Only matters if the product shows USD/SGD and THB in the same view.** If it
does, and someone misreads one for the other, the fix is probably a text label
next to the mark rather than a redrawn glyph.

### `contract` against `statement`

Measured 80.6%. Both are a sheet with one rule at the top and something in the
lower half. The metric weighs where the ink falls, not what shape it makes, and
a signature is not confusable with a bar chart to a reader — so this is on the
list to be disproved rather than because it is believed.

`contract` was already redrawn once at 16 units, which is what moved
`invoice`/`contract` from 84.9% down to 75.6%.

### `documents`

The only base with no interior detail at all — two overlapping sheets. It
carries "several of them" and nothing else.

**Watch for:** it being used where a specific document type was meant, or a
reviewer expecting it to say *which* documents.

---

## 2. Decisions that could turn out wrong

These are system-level bets, not drawings. Each one was made for a stated
reason; the reason may not survive contact with the product.

**Currency marks are named by symbol, not ISO code.** `CoinDollar` covers USD,
SGD, AUD, HKD, TWD, NZD and CAD, because a dollar sign genuinely cannot
distinguish them. The product is expected to carry the code in text. *Watch for:*
a screen where the code is not shown and the currency is ambiguous.

**Nine bases cannot take a badge** — `statement`, `banknote`, `exchange`,
`balance`, `margin`, `team`, `org-chart`, `client`, `social-insurance`. Their shapes lose an edge rather than a corner
to the knockout. *Watch for:* needing a state on one of them, e.g. "headcount
approved". The answer is usually to badge something else, but if it keeps
happening the shape needs redrawing.

**Two badges are refused on two bases:** `timesheet` and `clock` will not take
`pending`, because a clock badge on an icon that is already a clock reads as a
rendering error. *Watch for:* a genuine need for "timesheet awaiting review".
Currently that has to be `timesheet + exception`, which says something slightly
different.

**The 16px master takes over at 18px and below.** *Watch for:* UI sizes that
land awkwardly either side of it — a 20px icon uses the 24-unit master, which
may look lighter than a neighbouring 18px one. `optical="lg" | "sm"` forces it.

**`CoinRinggit` and `CoinRupiah` have no 16px master** and fall back to the
24-unit one scaled down, because two letters inside a 16-unit coin give about
3px per letter. *Watch for:* them looking soft next to other currency marks in a
small list. `hasSmallMaster` on the registry entry flags them.

**Right-to-left was never considered.** The badge sits at the bottom right and
does not mirror. Not an issue for any ASEAN language, but it would be for
Arabic or Hebrew.

---

## 3. Which mark means what

Do not decide this per screen. `@octomate/payroll-icons/concepts` holds the
agreed answer, and the build enforces that one idea maps to one mark:

```ts
import { iconFor } from "@octomate/payroll-icons/concepts";

iconFor("job order");   // "job-order"
iconFor("requisition"); // "job-order"  — same idea, same mark
iconFor("強積金");       // "pension-contribution"
iconFor("PTO");         // "leave"
```

Case and separators are ignored, and a term can be the concept's name, its
Chinese label, or any synonym. A term that belongs to two concepts fails the
build, so a lookup never returns a choice.

The table covers the vocabulary a contract-payroll product actually uses,
including the statutory names for Hong Kong (MPF, IR56), Singapore (CPF, SDL,
FWL, IR8A) and Malaysia (EPF, SOCSO, EIS, PCB). The same idea in three
jurisdictions resolves to the same mark — a provident fund is a provident fund.

## 4. What the set probably does not cover

25 bases and 10 modifiers compose into a lot, but the vocabulary was drawn from
one reading of the domain. Gaps will show up as "there's no icon for…".

The concept table already names them. `approximated` lists every concept that
borrows the nearest mark rather than owning one, and `npm run icons` prints the
count on every build, so the backlog cannot quietly grow:

```ts
import { approximated } from "@octomate/payroll-icons/concepts";
```

Today that is 7, and every one that is left is a near neighbour rather than a
hole: a bank file is the artefact that causes a disbursement, a client's
department really is an org unit, a contract period and a public holiday really
are dates. Those may simply be fine.

The one that is not fine is **`billing-rate`**, and it is worth saying why it
was left alone. Three marks were drawn for it and all three were rejected by
looking at them: money-over-time drawn as a diagonal fraction renders as a
literal `%`, which `tax-form` already owns; drawn as a stacked fraction it
renders as `÷` and turns to mush at 16px; and a price tag is legible but in
software a tag means *label*. Sharing `coin` with a text label beside it is
better than any of those, so `billing-rate` keeps `coin` on purpose rather than
by omission.

`margin` did get its own mark — two levels with an arrow between them, the
spread — because "the difference between two amounts" has a shape and "amount
per unit of time" does not.

Other things a payroll product might want that have no mark:

- expense claims as distinct from reimbursement
- probation, notice period, contract expiry
- payslip delivery — emailed, downloaded, printed
- multi-entity or multi-company structure
- approvals routed to a specific person, rather than the generic `approved`
- anything country-specific — a particular statutory form or filing

**Before drawing a new base, check whether a composition already says it.**
Adding a base is expensive: it needs a 24-unit master, a 16-unit master, and a
filled form. Adding a modifier is cheaper and adds a state to every base at once.

---

## 5. Making the feedback usable

Vague feedback about icons is very hard to act on. Two things make it concrete:

**Record where it happened, not just which icon.** "`deduction` in the payroll
run table" is actionable; "the deduction icon is confusing" is not — the same
mark can work in a 32px empty state and fail in a 16px dense table.

**Record what the person expected.** If someone reads `coin` as "settings", that
is a different problem from reading it as "nothing in particular".

Worth capturing:

| | |
| --- | --- |
| Icon name | as exported, e.g. `payslip-approved` |
| Where | screen, and the size it renders at |
| With or without a text label | icon-only is a much harder test |
| What was expected | the wrong reading, if there was one |
| Outline or filled | selected states use the filled weight |

Open these as issues on the repository. A screenshot at the real size is worth
more than a description.

---

## 6. What is cheap to change, and what is not

**Cheap now, while the major version is 0:**

- any mark's drawing — the geometry snapshot will flag it, and the change is a
  minor release
- adding a base, a modifier, or a composition
- adding currency coins

**Expensive at any time:**

- renaming an exported icon — that is a breaking change for every consumer
- changing the grid, the badge position, or the optical breakpoint — every mark
  is drawn against them
- changing the component props

**Already burned:** `@octomate/payroll-icons@0.1.0` is published under MIT and
cannot be withdrawn. Anything shipped is shipped.

---

## 7. Running the checks yourself

```bash
npm test                  # 35 tests, including the geometry snapshot
npm run confusability     # how alike any two marks look at 16px
npm run dev               # the docs site, with size / weight / set filters
```

`npm run confusability` needs a browser and is not part of the build:
`npm i -D playwright && npx playwright install chromium`.

Read its output with care — marks built from the same base are *supposed* to be
close, and circle families start around 78% on their shared outline alone. Only
cross-base pairs are a real signal, and it reports those separately.
