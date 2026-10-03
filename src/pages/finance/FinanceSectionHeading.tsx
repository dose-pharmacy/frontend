// ── Finance section heading ───────────────────────────────────────────────────
// One heading shape for every section of the single Finance page, so the two
// halves (Overview, Reports) read as two parts of one document rather than two
// unrelated screens.
//
// The heading is the anchor TARGET for the in-page nav (`FinanceSectionNav`),
// which is why it carries the id — the section itself owns `aria-labelledby`
// and points at the same id, so the heading stays the accessible name of its
// section instead of a bare visual label.

import type { ReactNode } from "react";

export default function FinanceSectionHeading({
  id,
  title,
  subtitle,
  actions,
}: {
  /** Matches the `<section aria-labelledby>` that wraps this heading. */
  id: string;
  title: string;
  subtitle?: string;
  /** Right-hand controls. Section-scoped: they must refresh THIS section only. */
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 px-4 pt-6 pb-3 sm:px-6">
      <div className="min-w-0">
        <h2 id={id} className="text-xl font-semibold text-text-primary">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-sm text-text-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
