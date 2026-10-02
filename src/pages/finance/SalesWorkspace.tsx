// ── Finance · Sales workspace ───────────────────────────────────────────────
// The Sales tab hosts two views of the same window: the transaction ledger and
// the sale-LINE drill-down behind it. They share the page-level filter bar, so
// switching between them keeps the date and location selection.

import { useState } from "react";
import SalesSection from "./SalesSection";
import SalesDetailSection from "./SalesDetailSection";
import type { FinanceFilters } from "./financeView";

type View = "transactions" | "lines";

export default function SalesWorkspace({ filters }: { filters: FinanceFilters }) {
  const [view, setView] = useState<View>("transactions");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex rounded-lg border border-[#C6D4BF] w-fit overflow-hidden">
        {(
          [
            { key: "transactions", label: "Transactions" },
            { key: "lines", label: "Sale lines" },
          ] as { key: View; label: string }[]
        ).map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setView(opt.key)}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${
              view === opt.key
                ? "bg-[#B6C8AF] text-[#333333]"
                : "bg-white text-[#666666] hover:bg-[#E6ECE2]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {view === "transactions" ? <SalesSection filters={filters} /> : <SalesDetailSection filters={filters} />}
    </div>
  );
}