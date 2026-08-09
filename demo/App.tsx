import { useMemo, useState } from "react";
import pkg from "../package.json";
import type { IconMeta } from "../src/generated/registry";
import { registry } from "../src/generated/registry";

const GROUP_LABELS: Record<string, string> = {
  documents: "文件 Documents",
  time: "時間 Time",
  money: "金流 Money",
  statutory: "法定 Statutory",
  organisation: "組織 Organisation",
  process: "流程 Process",
  currency: "幣別 Currency",
};

const SIZES = [16, 20, 24, 32] as const;
const STROKES = ["auto", 1.25, 1.5, 2] as const;

function importLine(icon: IconMeta) {
  const pascal = icon.name.replace(/(^|-)(\w)/g, (_, __, c: string) => c.toUpperCase());
  return `import { ${pascal} } from "@octomate/payroll-icons";`;
}

export default function App() {
  const [query, setQuery] = useState("");
  const [size, setSize] = useState<number>(24);
  const [stroke, setStroke] = useState<number | "auto">("auto");
  const [animate, setAnimate] = useState(false);
  const [tier, setTier] = useState<"all" | "free" | "pro">("all");
  const [copied, setCopied] = useState<string | null>(null);
  const [replayKey, setReplayKey] = useState(0);
  const [compare, setCompare] = useState(false);
  const [filled, setFilled] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return registry.filter((i) => {
      if (tier !== "all" && i.tier !== tier) return false;
      if (!q) return true;
      return (
        i.name.includes(q) ||
        i.zh.includes(query.trim()) ||
        (i.base?.includes(q) ?? false) ||
        (i.modifier?.includes(q) ?? false) ||
        (i.covers?.some((c) => c.toLowerCase().includes(q)) ?? false)
      );
    });
  }, [query, tier]);

  const grouped = useMemo(() => {
    const map = new Map<string, IconMeta[]>();
    for (const icon of filtered) {
      const list = map.get(icon.group);
      if (list) list.push(icon);
      else map.set(icon.group, [icon]);
    }
    return [...map.entries()];
  }, [filtered]);

  async function copy(icon: IconMeta) {
    try {
      await navigator.clipboard.writeText(importLine(icon));
      setCopied(icon.name);
      setTimeout(() => setCopied((c) => (c === icon.name ? null : c)), 1400);
    } catch {
      setCopied(null);
    }
  }

  const freeCount = registry.filter((i) => i.tier === "free").length;

  return (
    <div className="sheet">
      <header className="titleblock">
        <div className="titleblock__main">
          <h1>Payroll Icon System</h1>
          <p>
            Payroll, time, statutory and billing marks built from{" "}
            {new Set(registry.map((i) => i.base).filter(Boolean)).size} bases combined with a fixed
            modifier vocabulary. 24 × 24 grid, stroke only, <code>currentColor</code>,
            animation-ready.
          </p>
        </div>
        <dl className="fields">
          <div className="field">
            <dt>Icons</dt>
            <dd>{registry.length}</dd>
          </div>
          <div className="field">
            <dt>Free tier</dt>
            <dd>{freeCount}</dd>
          </div>
          <div className="field">
            <dt>Grid</dt>
            <dd>24 × 24 / live 20</dd>
          </div>
          <div className="field">
            <dt>Version</dt>
            <dd>{pkg.version}</dd>
          </div>
        </dl>
      </header>

      <div className="controls">
        <input
          type="search"
          className="search"
          placeholder="Search — payslip, 扣除, invoice, recurring…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search icons"
        />

        <div className="ctrl">
          <span className="ctrl__label">Size</span>
          {SIZES.map((s) => (
            <button key={s} type="button" aria-pressed={size === s} onClick={() => setSize(s)}>
              {s}
            </button>
          ))}
        </div>

        <div className="ctrl">
          <span className="ctrl__label">Stroke</span>
          {STROKES.map((s) => (
            <button key={s} type="button" aria-pressed={stroke === s} onClick={() => setStroke(s)}>
              {s}
            </button>
          ))}
        </div>

        <div className="ctrl">
          <span className="ctrl__label">Tier</span>
          {(["all", "free", "pro"] as const).map((t) => (
            <button key={t} type="button" aria-pressed={tier === t} onClick={() => setTier(t)}>
              {t}
            </button>
          ))}
        </div>

        <div className="ctrl">
          <button
            type="button"
            aria-pressed={animate}
            onClick={() => {
              setAnimate((a) => !a);
              setReplayKey((k) => k + 1);
            }}
          >
            Draw-on
          </button>
          {animate && (
            <button type="button" onClick={() => setReplayKey((k) => k + 1)}>
              Replay ↻
            </button>
          )}
          <button type="button" aria-pressed={filled} onClick={() => setFilled((f) => !f)}>
            Filled
          </button>
          <button type="button" aria-pressed={compare} onClick={() => setCompare((c) => !c)}>
            16px compare
          </button>
        </div>
      </div>

      {compare && (
        <section className="compare">
          <div className="grouphead">
            <span>Optical size — 16px master vs the 24px master scaled down</span>
            <span>both rendered at 16px</span>
          </div>
          <p className="compare__note">
            Left column is the dedicated 16-unit master, right is the 24-unit master forced to the
            same box with <code>optical="lg"</code>. The badge ring is what breaks first.
          </p>
          <div className="compare__grid">
            {registry.slice(0, 24).map((icon) => {
              const Icon = icon.Component;
              return (
                <div className="compare__pair" key={icon.name}>
                  <Icon size={16} optical="sm" />
                  <Icon size={16} optical="lg" />
                  <span>{icon.name}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {grouped.length === 0 && (
        <p className="empty">
          Nothing matches “{query}”. Try an English name, a Chinese term, or a modifier like{" "}
          <code>recurring</code>.
        </p>
      )}

      {grouped.map(([group, icons]) => (
        <section key={group} className="group">
          <div className="grouphead">
            <span>{GROUP_LABELS[group] ?? group}</span>
            <span>{icons.length}</span>
          </div>
          <div className="grid">
            {icons.map((icon) => {
              const Icon = icon.Component;
              return (
                <button
                  key={icon.name}
                  type="button"
                  className="cell"
                  onClick={() => copy(icon)}
                  title={importLine(icon)}
                >
                  <span className="cell__art">
                    <Icon
                      key={replayKey}
                      size={size}
                      strokeWidth={stroke === "auto" ? undefined : stroke}
                      variant={filled ? "filled" : "outline"}
                      className={animate ? "pi-draw" : undefined}
                    />
                  </span>
                  <span className="cell__name">{icon.name}</span>
                  <span className="cell__zh">{icon.zh}</span>
                  {icon.modifier && (
                    <span className="cell__formula">
                      {icon.base} + {icon.modifier}
                    </span>
                  )}
                  {icon.covers && (
                    <span className="cell__covers">{icon.covers.slice(0, 4).join(" · ")}</span>
                  )}
                  {filled && !icon.hasFilled && <span className="cell__nofill">outline only</span>}
                  {icon.tier === "pro" && <span className="cell__tier">pro</span>}
                  {copied === icon.name && <span className="cell__copied">Copied import</span>}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <footer className="footnote">
        <span>Payroll Icon System</span>
        <span>Click any icon to copy its import</span>
        <span>24 × 24 · currentColor · pathLength=1</span>
      </footer>
    </div>
  );
}
