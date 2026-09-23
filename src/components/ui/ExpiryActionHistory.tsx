import { useEffect, useState } from "react";
import { getExpiryActions, type ExpiryActionDto } from "../../features/inventory/expiryApi";

const ACTION_LABELS: Record<string, string> = {
  RETURN_TO_SUPPLIER: "Return to Supplier",
  DISPOSE: "Dispose",
};

const BADGE_STYLES: Record<string, string> = {
  RETURN_TO_SUPPLIER: "bg-[#E6ECE2] text-[#7A9076]",
  DISPOSE: "bg-red-500 text-white",
};

function formatDateTime(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ExpiryActionHistory({ batchId, refreshKey = 0 }: { batchId: string; refreshKey?: number }) {
  const [actions, setActions] = useState<ExpiryActionDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    getExpiryActions(batchId, { page: 1, limit: 5 })
      .then((res) => {
        if (cancelled) return;
        setActions(res.data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load action history.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [batchId, open, refreshKey]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-xs font-semibold text-[#7A9076] hover:underline"
      >
        Show past actions
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-[#C6D4BF] flex flex-col">
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="flex items-center justify-between px-4 py-2.5 text-xs font-bold text-[#333333] uppercase tracking-wide hover:bg-[#E6ECE2]/40 transition-colors"
      >
        Past Actions
        <span className="text-[#666666] normal-case font-medium">Hide</span>
      </button>
      {loading ? (
        <div className="px-4 py-3 space-y-2 animate-pulse">
          <div className="h-8 rounded bg-[#E6ECE2]" />
          <div className="h-8 rounded bg-[#E6ECE2]" />
        </div>
      ) : error ? (
        <p className="px-4 py-3 text-xs text-red-600">{error}</p>
      ) : actions.length === 0 ? (
        <p className="px-4 py-3 text-xs text-[#666666]">No past actions for this batch.</p>
      ) : (
        <ul className="divide-y divide-[#E6ECE2]">
          {actions.map((a) => (
            <li key={a.id} className="px-4 py-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STYLES[a.actionType] ?? "bg-[#E6ECE2] text-[#7A9076]"}`}>
                    {ACTION_LABELS[a.actionType] ?? a.actionType}
                  </span>
                </div>
                <p className="text-xs text-[#666666] mt-1 truncate">
                  {a.quantity} units · {formatDateTime(a.createdAt)}
                  {a.reason ? ` · ${a.reason}` : ""}
                </p>
              </div>
              {a.discountPercent > 0 && (
                <span className="text-xs font-semibold text-orange-500 flex-shrink-0">-{a.discountPercent}%</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
