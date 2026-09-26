import { useState, useEffect, useCallback, useMemo } from "react"
import { useNavigate } from "react-router"
import PageHeader from "../../components/ui/PageHeader"
import SearchInput from "../../components/ui/SearchInput"
import Button from "../../components/ui/Button"
import Pagination from "../../components/ui/Pagination"
import Modal from "../../components/ui/Modal"
import {
  listGoodsReceipts,
  deleteGoodsReceipt,
  type GoodsReceiptDto,
  type GoodsReceiptStatus,
  GoodsReceiptsApiError,
} from "../../features/purchasing/goodsReceiptsApi"
import { listSuppliers, type SupplierDto } from "../../features/purchasing/suppliersApi"

function fmtDate(d: string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

const STATUS_BADGE: Record<GoodsReceiptStatus, string> = {
  MATCHED: "bg-green-100 text-green-700",
  DISCREPANCY: "bg-yellow-100 text-yellow-700",
  RESOLVED: "bg-blue-100 text-blue-700",
}

export default function GoodsReceiptsPage() {
  const navigate = useNavigate()
  const [receipts, setReceipts] = useState<GoodsReceiptDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<GoodsReceiptStatus | "">("")
  const [toast, setToast] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<GoodsReceiptDto | null>(null)
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([])

  const PAGE_SIZE = 20

  useEffect(() => {
    listSuppliers({ limit: 100 })
      .then((r) => setSuppliers(r.data))
      .catch(() => {})
  }, [])

  const supplierName = useCallback(
    (id: string | undefined | null) => {
      if (!id) return "—"
      return suppliers.find((s) => s.id === id)?.name ?? "—"
    },
    [suppliers],
  )

  const loadReceipts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listGoodsReceipts({
        page,
        limit: PAGE_SIZE,
        status: statusFilter || undefined,
      })
      setReceipts(res.data)
      setTotalPages(res.meta.totalPages)
      setTotalCount(res.meta.total)
    } catch (e) {
      setError(e instanceof GoodsReceiptsApiError ? e.message : "Failed to load goods receipts.")
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => {
    loadReceipts()
  }, [loadReceipts])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(""), 3000)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteGoodsReceipt(deleteTarget.id)
      setDeleteTarget(null)
      showToast("Goods receipt deleted successfully.")
      loadReceipts()
    } catch (e) {
      setDeleteTarget(null)
      showToast(e instanceof GoodsReceiptsApiError ? e.message : "Failed to delete goods receipt.")
    } finally {
      setDeleting(false)
    }
  }

  const visibleReceipts = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return receipts
    return receipts.filter((r) =>
      r.receiptNumber.toLowerCase().includes(q) ||
      (r.purchaseOrder?.poNumber ?? "").toLowerCase().includes(q) ||
      supplierName(r.supplierId).toLowerCase().includes(q),
    )
  }, [receipts, search, supplierName])

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Purchasing / Goods Receipts"
        title="Goods Receipts"
        subtitle="View and manage received goods from suppliers."
        actions={
          <Button onClick={() => navigate("/purchasing/deliveries/new")}>
            + Register Receipt
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="flex-1">
              <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search receipts..." />
            </div>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as GoodsReceiptStatus | ""); setPage(1) }} className="sm:w-48 rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none">
              <option value="">All Statuses</option>
              <option value="MATCHED">Matched</option>
              <option value="DISCREPANCY">Discrepancy</option>
              <option value="RESOLVED">Resolved</option>
            </select>
            {(search || statusFilter) && (
              <button onClick={() => { setSearch(""); setStatusFilter(""); setPage(1) }} className="text-xs font-semibold text-[#7A9076] hover:underline">Reset</button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden flex-shrink-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="h-8 w-8 rounded-full border-4 border-[#E6ECE2] border-t-[#B6C8AF] animate-spin" />
              <p className="text-sm text-[#666666]">Loading goods receipts...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 px-6">
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 max-w-md text-center">{error}</p>
              <Button onClick={loadReceipts}>Retry</Button>
            </div>
          ) : receipts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="h-14 w-14 rounded-2xl bg-[#E6ECE2] flex items-center justify-center">
                <svg className="h-7 w-7 text-[#7A9076]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="font-semibold text-[#333333]">No goods receipts found</p>
                <p className="text-sm text-[#666666] mt-1">
                  {(search || statusFilter)
                    ? "No goods receipts match your filters."
                    : "Goods receipts will appear here once they are created."}
                </p>
              </div>
              {(search || statusFilter) ? (
                <button onClick={() => { setSearch(""); setStatusFilter(""); setPage(1) }} className="text-sm font-semibold text-[#7A9076] hover:underline">Clear Filters</button>
              ) : (
                <Button onClick={() => navigate("/purchasing/deliveries/new")}>+ Register Receipt</Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#E6ECE2] text-left">
                      {["Receipt #", "Purchase Order", "Supplier", "Received Date", "Status", "Items", "Created By", "Confirmed", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-3 font-semibold text-[#333333]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleReceipts.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-sm text-[#999]">No receipts match your search.</td>
                      </tr>
                    ) : (
                      visibleReceipts.map((r, i) => {
                        const itemCount = r._count?.items ?? r.items?.length ?? 0
                        const confirmed = !!r.confirmedBy || !!r.confirmedById || !!r.confirmedAt
                        return (
                          <tr key={r.id} className={`hover:bg-[#E6ECE2]/30 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/15"}`}>
                            <td className="px-4 py-3">
                              <button onClick={() => navigate(`/purchasing/deliveries/${r.id}/reconcile`)} className="font-semibold text-[#7A9076] hover:underline">{r.receiptNumber}</button>
                            </td>
                            <td className="px-4 py-3 text-[#333333]">{r.purchaseOrder?.poNumber ?? r.purchaseOrderId}</td>
                            <td className="px-4 py-3 text-[#333333]">{supplierName(r.supplierId)}</td>
                            <td className="px-4 py-3 text-[#666666] whitespace-nowrap">{fmtDate(r.receivedDate)}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-bold rounded-full px-2.5 py-0.5 ${STATUS_BADGE[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                                {r.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[#666666]">
                              {itemCount} item{itemCount !== 1 ? "s" : ""}
                            </td>
                            <td className="px-4 py-3 text-[#666666]">{r.createdBy?.name ?? "—"}</td>
                            <td className="px-4 py-3 text-[#666666]">
                              {confirmed
                                ? (r.confirmedBy ? `Yes · ${r.confirmedBy.name}` : "Yes")
                                : "No"}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button onClick={() => navigate(`/purchasing/deliveries/${r.id}/reconcile`)} className="text-xs font-semibold text-[#7A9076] hover:underline whitespace-nowrap">
                                  View
                                </button>
                                {!confirmed && (
                                  <button onClick={() => setDeleteTarget(r)} className="text-xs text-red-500 hover:underline whitespace-nowrap">
                                    Delete
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  label={
                    <>
                      Showing {Math.min((page - 1) * PAGE_SIZE + 1, totalCount)}–
                      {Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} receipts
                    </>
                  }
                />
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      <Modal open={!!deleteTarget} title="Delete Goods Receipt?" onClose={() => setDeleteTarget(null)} size="sm">
        <p className="text-sm text-[#666666]">Delete {deleteTarget?.receiptNumber}?</p>
        <p className="mt-2 text-xs text-[#999]">This action cannot be undone. Only unconfirmed receipts can be deleted.</p>
        <div className="flex gap-3 justify-end mt-6">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <button onClick={handleDelete} disabled={deleting} className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 bg-red-600 hover:bg-red-700 text-white`}>
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </Modal>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-[#333333] px-5 py-3.5 text-sm text-white shadow-xl">
          <svg className="h-4 w-4 shrink-0 text-[#7A9076]" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
          {toast}
        </div>
      )}
    </div>
  )
}