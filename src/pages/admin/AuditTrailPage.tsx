import { useState, useEffect, useCallback, useRef } from "react";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import {
  listAuditTrail,
  AuditApiError,
  type AuditTrailEntryDto,
} from "../../features/audit/auditApi";

const PAGE_SIZE = 20;

const ACTION_OPTIONS = [
  "CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "EXPORT", "IMPORT",
  "APPROVE", "REJECT", "CANCEL", "COMPLETE", "CONFIRM", "CLOSE",
] as const;

const ENTITY_OPTIONS = [
  "USER", "PRODUCT", "BATCH", "STOCK_TRANSACTION", "STOCK_TRANSFER",
  "PURCHASE_ORDER", "PURCHASE_REQUIREMENT", "GOODS_RECEIPT", "SUPPLIER_INVOICE",
  "SUPPLIER_PAYMENT", "PURCHASE_RETURN", "SALE", "PAYMENT", "SUPPLIER",
  "LOCATION", "EXPIRY_ACTION", "REORDER_CONFIG", "DISCOUNT_AUTH_RULE",
  "SLOW_MOVING_CONFIG", "GENERIC_PRODUCT", "MANUFACTURER",
] as const;

const ACTION_BADGES: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
  CONFIRM: "bg-cyan-100 text-cyan-700",
  CLOSE: "bg-gray-100 text-gray-600",
  CANCEL: "bg-orange-100 text-orange-700",
  COMPLETE: "bg-green-100 text-green-700",
  APPROVE: "bg-green-100 text-green-700",
  REJECT: "bg-red-100 text-red-700",
  LOGIN: "bg-purple-100 text-purple-700",
  LOGOUT: "bg-purple-100 text-purple-700",
};

function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Flatten JSON metadata into readable key/value rows (never a raw dump). */
function jsonToRows(value: unknown, prefix = ""): { key: string; value: string }[] {
  if (value === null || value === undefined) return [];
  if (typeof value !== "object") {
    return [{ key: prefix || "value", value: String(value) }];
  }
  if (Array.isArray(value)) {
    return [{
      key: prefix || "value",
      value: value
        .map((v) => (v !== null && typeof v === "object" ? JSON.stringify(v) : String(v)))
        .join(", ") || "—",
    }];
  }
  const rows: { key: string; value: string }[] = [];
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      rows.push(...jsonToRows(v, key));
    } else if (Array.isArray(v)) {
      rows.push(...jsonToRows(v, key));
    } else {
      rows.push({ key, value: v === null || v === undefined ? "—" : String(v) });
    }
  }
  return rows;
}

const inputClass =
  "w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm bg-white focus:border-[#4F6B4A] focus:outline-none transition-all";

export default function AuditTrailPage() {
  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [entityIdInput, setEntityIdInput] = useState("");
  const [userIdInput, setUserIdInput] = useState("");
  const [entityId, setEntityId] = useState("");
  const [userId, setUserId] = useState("");

  const [rows, setRows] = useState<AuditTrailEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Debounce the free-text id filters.
  const entityIdTimer = useRef<number | null>(null);
  const userIdTimer = useRef<number | null>(null);

  useEffect(() => {
    if (entityIdTimer.current) window.clearTimeout(entityIdTimer.current);
    entityIdTimer.current = window.setTimeout(() => {
      setEntityId(entityIdInput.trim());
      setPage(1);
    }, 300);
    return () => {
      if (entityIdTimer.current) window.clearTimeout(entityIdTimer.current);
    };
  }, [entityIdInput]);

  useEffect(() => {
    if (userIdTimer.current) window.clearTimeout(userIdTimer.current);
    userIdTimer.current = window.setTimeout(() => {
      setUserId(userIdInput.trim());
      setPage(1);
    }, 300);
    return () => {
      if (userIdTimer.current) window.clearTimeout(userIdTimer.current);
    };
  }, [userIdInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listAuditTrail({
        page,
        limit: PAGE_SIZE,
        action: action || undefined,
        entity: entity || undefined,
        entityId: entityId || undefined,
        userId: userId || undefined,
        startDate: dateFrom ? `${dateFrom}T00:00:00.000` : undefined,
        endDate: dateTo ? `${dateTo}T23:59:59.999` : undefined,
      });
      setRows(res.data);
      setTotal(res.total);
      setPageSize(res.pageSize);
      setTotalPages(res.totalPages);
    } catch (e) {
      setError(e instanceof AuditApiError ? e.message : "Failed to load the audit trail.");
    } finally {
      setLoading(false);
    }
  }, [page, action, entity, entityId, userId, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    setAction("");
    setEntity("");
    setEntityIdInput("");
    setUserIdInput("");
    setEntityId("");
    setUserId("");
    setPage(1);
  }

  // ── Detail modal ───────────────────────────────────────────────────────────

  const [detail, setDetail] = useState<AuditTrailEntryDto | null>(null);

  const oldRows = detail ? jsonToRows(detail.oldData) : [];
  const newRows = detail ? jsonToRows(detail.newData) : [];

  function filterToRecord(entry: AuditTrailEntryDto) {
    setDetail(null);
    setEntity(entry.entity);
    setEntityIdInput(entry.entityId);
    setEntityId(entry.entityId);
    setAction("");
    setDateFrom("");
    setDateTo("");
    setUserIdInput("");
    setUserId("");
    setPage(1);
  }

  function filterToUser(entry: AuditTrailEntryDto) {
    if (!entry.userId) return;
    setDetail(null);
    setUserIdInput(entry.userId);
    setUserId(entry.userId);
    setEntity("");
    setEntityIdInput("");
    setEntityId("");
    setAction("");
    setPage(1);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Settings / Audit Trail"
        title="Audit Trail"
        subtitle="Recorded business events across the pharmacy — who did what, and when."
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
              <label className="text-sm font-medium text-[#333333]">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
              <label className="text-sm font-medium text-[#333333]">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
              <label className="text-sm font-medium text-[#333333]">Action</label>
              <select
                value={action}
                onChange={(e) => { setAction(e.target.value); setPage(1); }}
                className={inputClass}
              >
                <option value="">All Actions</option>
                {ACTION_OPTIONS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 flex-1 min-w-[170px]">
              <label className="text-sm font-medium text-[#333333]">Entity</label>
              <select
                value={entity}
                onChange={(e) => { setEntity(e.target.value); setPage(1); }}
                className={inputClass}
              >
                <option value="">All Entities</option>
                {ENTITY_OPTIONS.map((en) => (
                  <option key={en} value={en}>{en}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-[#333333]">Record ID</label>
              <input
                type="text"
                value={entityIdInput}
                onChange={(e) => setEntityIdInput(e.target.value)}
                placeholder="Filter by entity ID…"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-[#333333]">User ID</label>
              <input
                type="text"
                value={userIdInput}
                onChange={(e) => setUserIdInput(e.target.value)}
                placeholder="Filter by user ID…"
                className={inputClass}
              />
            </div>
            <button
              onClick={clearFilters}
              className="rounded-xl border border-[#C6D4BF] px-4 py-2.5 text-sm font-semibold text-[#666666] hover:bg-[#E6ECE2] transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="h-8 w-8 rounded-full border-4 border-[#E6ECE2] border-t-[#4F6B4A] animate-spin" />
              <p className="text-sm text-[#666666]">Loading audit trail...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 px-6">
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 max-w-md text-center">{error}</p>
              <Button onClick={() => void load()}>Retry</Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <p className="font-semibold text-[#333333]">No audit records found</p>
              <p className="text-sm text-[#666666]">No events match the selected filters.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead>
                    <tr className="bg-[#E6ECE2] text-left">
                      {["Time", "User", "Action", "Entity", "Event", "Record ID", "IP", ""].map((h) => (
                        <th key={h} className="px-4 py-3 font-semibold text-[#333333]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={row.id}
                        className={`cursor-pointer hover:bg-[#E6ECE2]/30 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/40"}`}
                        onClick={() => setDetail(row)}
                      >
                        <td className="px-4 py-3 text-[#666666] whitespace-nowrap">{fmtDateTime(row.createdAt)}</td>
                        <td className="px-4 py-3 text-[#333333]">
                          {row.user ? (
                            <>
                              <p className="font-medium">{row.user.name}</p>
                              <p className="text-xs text-[#666666]">{row.user.email}</p>
                            </>
                          ) : (
                            <span className="text-xs text-[#999999]">System</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ACTION_BADGES[row.action] ?? "bg-gray-100 text-gray-600"}`}>
                            {row.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#333333] whitespace-nowrap">{row.entity}</td>
                        <td className="px-4 py-3 text-[#333333]">{row.description ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-[#666666] max-w-[160px] truncate" title={row.entityId}>{row.entityId}</td>
                        <td className="px-4 py-3 font-mono text-xs text-[#666666]">{row.ipAddress ?? "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); setDetail(row); }}
                            className="text-xs font-semibold text-[#7A9076] hover:underline whitespace-nowrap"
                          >
                            View →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-5 py-3 border-t border-[#E6ECE2] flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-[#666666]">
                  Showing {total === 0 ? 0 : Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total} events
                </p>
                {totalPages > 1 && (
                  <div className="flex gap-1">
                    <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg px-3 py-1.5 text-xs border border-[#C6D4BF] text-[#666666] hover:bg-[#E6ECE2] disabled:opacity-40 transition-colors">←</button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button key={p} onClick={() => setPage(p)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${p === page ? "bg-[#4F6B4A] text-white" : "border border-[#C6D4BF] text-[#666666] hover:bg-[#E6ECE2]"}`}>{p}</button>
                    ))}
                    <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg px-3 py-1.5 text-xs border border-[#C6D4BF] text-[#666666] hover:bg-[#E6ECE2] disabled:opacity-40 transition-colors">→</button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Detail modal */}
      <Modal open={!!detail} title={detail ? `${detail.action} · ${detail.entity}` : "Audit Record"} onClose={() => setDetail(null)} size="lg">
        {detail && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ["When", fmtDateTime(detail.createdAt)],
                ["User", detail.user ? `${detail.user.name}` : "System"],
                ["Event", detail.description ?? "—"],
                ["Entity ID", detail.entityId],
                ["IP Address", detail.ipAddress ?? "—"],
                ["User Agent", detail.userAgent ?? "—"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-[#E6ECE2]/40 border border-[#E6ECE2] px-4 py-3">
                  <p className="text-xs text-[#666666]">{label}</p>
                  <p className="text-sm font-semibold text-[#333333] mt-0.5 break-all">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-bold text-[#333333] mb-2">Before (old data)</h3>
                {oldRows.length === 0 ? (
                  <p className="text-sm text-[#666666]">No previous values recorded.</p>
                ) : (
                  <div className="rounded-xl border border-[#E6ECE2] overflow-hidden">
                    <table className="w-full text-xs">
                      <tbody>
                        {oldRows.map((r, i) => (
                          <tr key={`${r.key}-${i}`} className={i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/40"}>
                            <td className="px-3 py-2 font-mono text-[#666666] w-1/2 break-all">{r.key}</td>
                            <td className="px-3 py-2 text-[#333333] break-all">{r.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#333333] mb-2">After (new data)</h3>
                {newRows.length === 0 ? (
                  <p className="text-sm text-[#666666]">No new values recorded.</p>
                ) : (
                  <div className="rounded-xl border border-[#E6ECE2] overflow-hidden">
                    <table className="w-full text-xs">
                      <tbody>
                        {newRows.map((r, i) => (
                          <tr key={`${r.key}-${i}`} className={i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/40"}>
                            <td className="px-3 py-2 font-mono text-[#666666] w-1/2 break-all">{r.key}</td>
                            <td className="px-3 py-2 text-[#333333] break-all">{r.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              {detail.userId && (
                <Button variant="secondary" onClick={() => filterToUser(detail)}>View user history</Button>
              )}
              <Button variant="secondary" onClick={() => filterToRecord(detail)}>View record history</Button>
              <Button onClick={() => setDetail(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
