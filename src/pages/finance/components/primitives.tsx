// ── Finance primitives ───────────────────────────────────────────────────────
// The shared building blocks both Finance pages are assembled from, so the two
// pages are pixel-identical in style by construction rather than by convention.
//
// What these enforce:
//   • Every card has the same height, padding, radius, border, label size and
//     value size. A card's height is driven by its content box, not by whatever
//     grid cell it lands in, so a short value never leaves a ragged row.
//   • A money value NEVER wraps: the figure and its "ETB" suffix sit on one
//     line via `whitespace-nowrap`, and the suffix shrinks instead of wrapping.
//   • A missing value renders "—" and is never coerced to 0. A real 0 renders
//     as 0.00 — the two are different facts.
//   • Colour is never the only signal: every toned figure also carries a label
//     and, where the sign matters, a leading `+`/`−`.
//   • Nothing is ever a blank rectangle — loading, empty and error all have a
//     visible state that occupies the same space as the real content.

import type { ReactNode } from "react";
import { ResponsiveContainer } from "recharts";
import { fmtMoneyNumber } from "../../../utils/format";
import {
  CARD,
  TONE_BAR,
  TONE_BORDER,
  TONE_SURFACE,
  TONE_TEXT,
  TEXT,
  type Tone,
} from "./tokens";

export const EM_DASH = "—";

// ─── Money ───────────────────────────────────────────────────────────────────

/**
 * A money figure with a small muted "ETB" suffix on the same line.
 *
 * `nowrap` is load-bearing: a six-figure amount plus a currency suffix is the
 * most common cause of a value breaking onto a second line inside a narrow
 * grid cell, which visually doubles the card's height and desynchronises the row.
 */
export function MoneyValue({
  value,
  tone = "neutral",
  size = "md",
  currency = "ETB",
}: {
  value: number | null | undefined;
  tone?: Tone;
  /** `md` for cards, `lg` for hero figures, `sm` for dense inline rows. */
  size?: "sm" | "md" | "lg";
  currency?: string | null;
}) {
  const text = fmtMoneyNumber(value);
  const valueSize =
    size === "lg" ? TEXT.heroValue : size === "sm" ? "text-base font-semibold tabular-nums" : TEXT.cardValue;
  const suffixSize = size === "lg" ? "text-sm" : "text-xs";

  if (text === null) {
    return <span className={`${valueSize} text-text-muted`}>{EM_DASH}</span>;
  }

  return (
    <span className={`inline-flex items-baseline gap-1 whitespace-nowrap ${TONE_TEXT[tone]}`}>
      <span className={valueSize}>{text}</span>
      {currency && <span className={`${suffixSize} font-medium text-text-muted`}>{currency}</span>}
    </span>
  );
}

/** A signed percentage. `grossMargin` arrives already scaled — never rescaled here. */
export function PercentValue({
  value,
  tone = "neutral",
  size = "md",
}: {
  value: number | null | undefined;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
}) {
  const valueSize =
    size === "lg" ? TEXT.heroValue : size === "sm" ? "text-base font-semibold tabular-nums" : TEXT.cardValue;
  if (value == null || !Number.isFinite(value)) {
    return <span className={`${valueSize} text-text-muted`}>{EM_DASH}</span>;
  }
  return <span className={`${valueSize} ${TONE_TEXT[tone]}`}>{value.toFixed(1)}%</span>;
}

/** An integer count with thousands separators — never `47.00`. */
export function CountValue({
  value,
  tone = "neutral",
  size = "md",
}: {
  value: number | null | undefined;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
}) {
  const valueSize =
    size === "lg" ? TEXT.heroValue : size === "sm" ? "text-base font-semibold tabular-nums" : TEXT.cardValue;
  if (value == null || !Number.isFinite(value)) {
    return <span className={`${valueSize} text-text-muted`}>{EM_DASH}</span>;
  }
  return <span className={`${valueSize} ${TONE_TEXT[tone]}`}>{value.toLocaleString("en-ET")}</span>;
}

// ─── Cards ───────────────────────────────────────────────────────────────────

/**
 * The standard metric card. Every figure on both pages uses this one, so label
 * size, value size, padding and radius cannot vary between sections.
 */
export function StatCard({
  label,
  children,
  hint,
  tone = "neutral",
  trend,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  /** Optional secondary line, e.g. a share or a comparison. */
  trend?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`${CARD} ${TONE_SURFACE[tone]} ${TONE_BORDER[tone]} p-4 sm:p-5 min-h-[115px] sm:min-h-[125px] flex flex-col justify-between gap-1.5 ${className}`}
    >
      <div>
        <p className={TEXT.cardLabel}>{label}</p>
        <div className="min-w-0 mt-1">{children}</div>
      </div>
      {(trend || hint) && (
        <div className="mt-auto pt-1">
          {trend && <p className={`${TEXT.hint} truncate`}>{trend}</p>}
          {hint && <p className={TEXT.hint}>{hint}</p>}
        </div>
      )}
    </div>
  );
}

/** The oversized variant used for the 3-4 headline figures. */
export function KpiHero({
  label,
  children,
  hint,
  tone = "neutral",
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div
      className={`${CARD} ${TONE_SURFACE[tone]} ${TONE_BORDER[tone]} p-5 sm:p-6 min-h-[135px] sm:min-h-[145px] flex flex-col justify-between gap-2 ${className}`}
    >
      <div>
        <p className={TEXT.cardLabel}>{label}</p>
        <div className="min-w-0 mt-1">{children}</div>
      </div>
      {hint && (
        <div className="mt-auto pt-1">
          <p className={TEXT.hint}>{hint}</p>
        </div>
      )}
    </div>
  );
}

/**
 * The section shell. One header layout for every section: title, optional
 * subtitle, optional right-hand action (legend / toggle / badge).
 */
export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = "",
  bodyClassName = "p-5 sm:p-6 flex flex-col gap-6",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`${CARD} overflow-hidden shadow-xs ${className}`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-5 py-4 bg-canvas/40">
        <div className="min-w-0">
          <h2 className={TEXT.sectionTitle}>{title}</h2>
          {subtitle && <p className={`${TEXT.hint} mt-0.5`}>{subtitle}</p>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </header>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

// ─── States ──────────────────────────────────────────────────────────────────

/** Never a blank rectangle: any no-data area gets this. */
export function EmptyState({
  message,
  hint,
  icon = "chart",
  compact = false,
}: {
  message: string;
  hint?: string;
  icon?: "chart" | "list" | "box" | "alert";
  compact?: boolean;
}) {
  const paths: Record<string, string> = {
    chart: "M3 3.5A1.5 1.5 0 014.5 2h11A1.5 1.5 0 0117 3.5v13a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16.5v-13z",
    list: "M6 5h9a1 1 0 110 2H6a1 1 0 010-2zm0 4h9a1 1 0 110 2H6a1 1 0 010-2zm0 4h9a1 1 0 110 2H6a1 1 0 010-2zM3.5 6a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 4a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 4a.75.75 0 11-1.5 0 .75.75 0 011.5 0z",
    box: "M3 6.5A1.5 1.5 0 014.5 5h3.879a1.5 1.5 0 011.06.44l.682.68A.5.5 0 0010.5 6h5A1.5 1.5 0 0117 7.5v8a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 15.5v-9z",
    alert: "M10 2a8 8 0 100 16 8 8 0 000-16zm0 4a1 1 0 011 1v4a1 1 0 11-2 0V7a1 1 0 011-1zm0 8.5a1.2 1.2 0 100-2.4 1.2 1.2 0 000 2.4z",
  };
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${compact ? "py-6 px-3 gap-1.5" : "py-10 px-4 gap-2"}`}
    >
      <svg viewBox="0 0 20 20" className="w-6 h-6 text-text-muted" fill="currentColor" aria-hidden>
        <path
          fillRule="evenodd"
          d={paths[icon]}
          clipRule="evenodd"
        />
      </svg>
      <p className="text-sm text-text-secondary">{message}</p>
      {hint && <p className={TEXT.hint}>{hint}</p>}
    </div>
  );
}

/** Inline error with retry. Renders INSIDE the page flow, never a blank screen. */
export function ErrorBanner({
  message,
  onRetry,
  className = "",
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 ${className}`}
    >
      <p className="text-sm text-red-700">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          Retry
        </button>
      )}
    </div>
  );
}

// ─── Skeletons ───────────────────────────────────────────────────────────────

/** Mirrors `StatCard`'s box so a loading row occupies the final layout's space. */
export function StatCardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`${CARD} bg-canvas p-4 sm:p-5 min-h-[115px] sm:min-h-[125px] flex flex-col justify-between gap-2 ${className}`}
      aria-hidden
    >
      <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
      <div className="h-7 w-32 rounded bg-gray-100 animate-pulse" />
    </div>
  );
}

/** Mirrors `SectionCard`'s body: header line plus a content-shaped placeholder. */
export function SectionSkeleton({
  rows = 3,
  chart = false,
  className = "",
}: {
  rows?: number;
  chart?: boolean;
  className?: string;
}) {
  return (
    <div className={`${CARD} overflow-hidden ${className}`} aria-hidden>
      <div className="border-b border-gray-200 px-4 py-3">
        <div className="h-4 w-40 rounded bg-gray-100 animate-pulse" />
      </div>
      <div className="p-4">
        {chart ? (
          <div className="h-56 w-full rounded-lg bg-gray-100 animate-pulse" />
        ) : (
          <div className="flex flex-col gap-3">
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} className="h-8 w-full rounded bg-gray-100 animate-pulse" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Controls ────────────────────────────────────────────────────────────────

/**
 * A radio-group styled as a segmented control.
 *
 * Real `<input type="radio">` elements, so arrow-key navigation, grouping and
 * screen-reader semantics all come from the platform rather than from key
 * handlers written here.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  className = "",
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <fieldset className={`flex flex-col gap-1.5 ${className}`}>
      <legend className="text-sm font-medium text-text-primary">{label}</legend>
      <div className="inline-flex rounded-lg border border-gray-200 bg-canvas p-0.5" role="none">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <label
              key={opt.value}
              className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors select-none focus-within:ring-2 focus-within:ring-primary-mid ${
                active ? "bg-white text-accent shadow-sm" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <input
                type="radio"
                name={label}
                value={opt.value}
                checked={active}
                onChange={() => onChange(opt.value)}
                className="sr-only"
              />
              {opt.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * An on/off toggle that is a real button.
 *
 * `aria-pressed` carries the state so it is announced, and the label always
 * shows which mode is active — the coloured pill alone is not the signal.
 */
export function ToggleButton({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title={title}
      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-mid ${
        active
          ? "border-accent bg-accent text-white"
          : "border-gray-200 bg-white text-text-secondary hover:border-gray-300 hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

/** A keyboard-focusable chip used for the active-filter summary. */
export function FilterChip({ label, onClear }: { label: string; onClear?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary-mid bg-green-50 px-2.5 py-1 text-xs font-medium text-accent">
      {label}
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Remove filter ${label}`}
          className="rounded-full px-0.5 text-accent hover:bg-green-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-mid"
        >
          ×
        </button>
      )}
    </span>
  );
}

/**
 * Marks whether a section honours the active filters.
 *
 * Derived from `scopeNotes[section].basis`: `COMPANY` means the figure ignores
 * the location/product-group filter, so showing it next to a "Filtered" badge
 * prevents a whole-company balance being read as "for the selected location".
 * Colour is never the only signal — the badge states the scope in words.
 */
export function ScopeBadge({ basis }: { basis?: "REPORT_SCOPE" | "COMPANY" }) {
  if (basis === "COMPANY") {
    return (
      <span className="rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[11px] font-semibold text-yellow-700">
        Company-wide
      </span>
    );
  }
  if (basis === "REPORT_SCOPE") {
    return (
      <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">
        Filtered
      </span>
    );
  }
  return null;
}

// ─── Chart frame ─────────────────────────────────────────────────────────────

/**
 * A fixed-height chart area with an explicit numeric height.
 *
 * The height is set in px on a real element rather than via a percentage,
 * because `ResponsiveContainer` measures its parent: inside a `height: 100%`
 * chain that resolves to 0 the chart renders nothing at all. A minimum of 1px
 * guarantees the measurement can never collapse to zero.
 */
export function ChartFrame({
  title,
  height = 240,
  children,
}: {
  title: string;
  height?: number;
  children: ReactNode;
}) {
  return (
    <figure className="m-0 w-full">
      <figcaption className="sr-only">{title}</figcaption>
      <div style={{ height: Math.max(1, height), minHeight: 1 }} role="img" aria-label={title}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

// ─── Layout helpers ──────────────────────────────────────────────────────────

/** Colspan helper for the shared 12 / 2 / 1 column grid. */
export function span(n: number): string {
  return `lg:col-span-${n}`;
}

/** Horizontal progress bar. `pct` is a 0-100 number; null renders a neutral track. */
export function ProgressBar({
  pct,
  tone = "positive",
  className = "",
}: {
  pct: number | null;
  tone?: Tone;
  className?: string;
}) {
  const width = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full bg-gray-100 ${className}`}
      role="presentation"
    >
      <div className={`h-full rounded-full ${TONE_BAR[tone]}`} style={{ width: `${width}%` }} />
    </div>
  );
}

/** A colour swatch + label, used in legends. Paired with a text label so colour is never alone. */
export function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} aria-hidden />
      {label}
    </span>
  );
}