import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router"
import {
  getBinCard,
  type BinCardResult,
  type StockTransactionDto,
} from "../../features/inventory/stockApi"
import {
  fetchProductOptions,
  type ProductOption,
} from "../../features/inventory/inventoryService"
import { listLocations } from "../../features/inventory/locationsApi"
import {
  listProductBatches,
  type BatchDto,
} from "../../features/inventory/batchesApi"
import PageHeader from "../../components/ui/PageHeader"
import Select from "../../components/ui/Select"
import Button from "../../components/ui/Button"
import EmptyState from "../../components/ui/EmptyState"
import StatusChip, { type StatusTone } from "../../components/ui/StatusChip"

function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function prettyType(t: string) {
  if (!t) return ""
  if (t === t.toUpperCase()) return t.charAt(0) + t.slice(1).toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function TxTypeBadge({ type }: { type: string }) {
  const map: Record<string, StatusTone> = {
    received: "green",
    sale: "blue",
    transfer: "purple",
    adjustment: "orange",
    opening: "sage",
    disposal: "red",
    return: "amber",
    receipt: "green",
  }
  return (
    <StatusChip
      label={prettyType(type)}
      tone={map[type.toLowerCase()] ?? "gray"}
    />
  )
}

export default function BinCardPage() {
  const [params, setParams] = useSearchParams()
  const initProductId = params.get("productId") || ""
  const initBatchId = params.get("batchId") || ""
  const initLocationId = params.get("locationId") || ""

  const [products, setProducts] = useState<ProductOption[]>([])
  const [locations, setLocations] = useState<{ id: string, name: string }[]>([])
  const [batches, setBatches] = useState<BatchDto[]>([])

  const [productId, setProductId] = useState(initProductId)
  const [batchId, setBatchId] = useState(initBatchId)
  const [locationId, setLocationId] = useState(initLocationId)

  const [card, setCard] = useState<BinCardResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [typeFilter, setTypeFilter] = useState("")

  useEffect(() => {
    Promise.all([fetchProductOptions(), listLocations({ limit: 100 })]).then(
      ([p, l]) => {
        setProducts(p)
        setLocations(
          l.data
            .filter((x) => x.isActive)
            .map((x) => ({ id: x.id, name: x.name })),
        )
      },
    )
  }, [])

  useEffect(() => {
    if (!productId) {
      setBatches([])
      return
    }
    listProductBatches(productId, { limit: 100 }).then((b) => {
      setBatches(b.data)
    })
  }, [productId])

  useEffect(() => {
    if (!productId || !locationId) {
      setCard(null)
      return
    }
    setLoading(true)
    setError("")
    getBinCard({ productId, locationId, batchId: batchId || undefined })
      .then((res) => setCard(res))
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Failed to load bin card",
        ),
      )
      .finally(() => setLoading(false))
  }, [productId, locationId, batchId])

  const hasFilters = !!(fromDate || toDate || typeFilter)

  const ledger = useMemo(() => {
    const all = card?.transactions ?? []
    const filtered = all.filter((t) => {
      if (fromDate && t.date < fromDate) return false
      if (toDate && t.date > toDate) return false
      if (typeFilter && t.transactionType !== typeFilter) return false
      return true
    })
    let running = card?.openingBalance ?? 0
    return filtered.map((t) => {
      running += t.in - t.out
      return { ...t, runningBalance: running }
    })
  }, [card, fromDate, toDate, typeFilter])

  const openingBalance = card?.openingBalance ?? 0
  const closing = ledger.length
    ? ledger[ledger.length - 1].runningBalance
    : openingBalance
  const totals = useMemo(
    () => ({
      totalIn: ledger.reduce((a, t) => a + t.in, 0),
      totalOut: ledger.reduce((a, t) => a + t.out, 0),
    }),
    [ledger],
  )

  function handleExportCSV() {
    const header = "Date,Reference,Type,In,Out,Balance\n"
    const rows = ledger
      .map(
        (e) =>
          `${e.date},${e.reference || ""},${e.transactionType},${e.in},${e.out},${e.runningBalance}`,
      )
      .join("\n")
    const blob = new Blob([header + rows], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "bin-card.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const selectedProduct = products.find((p) => p.id === productId)
  const selectedLocation = locations.find((l) => l.id === locationId)
  const selectedBatch = batches.find((b) => b.id === batchId)
  const unit = card?.baseUnit?.name || selectedProduct?.baseUnit || ""

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title={
          selectedProduct ? `Bin Card — ${selectedProduct.name}` : "Bin Card"
        }
        subtitle="Stock movement history and ledger"
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => window.print()}
              disabled={!card}
            >
              Print
            </Button>
            <Button
              onClick={handleExportCSV}
              disabled={!card || ledger.length === 0}
            >
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="p-6 flex flex-col gap-6 overflow-y-auto">
        <div className="bg-white rounded-xl border border-[#E6ECE2] p-4 flex flex-col gap-4">
          <p className="text-sm font-semibold text-[#333333]">
            Bin Card Selection
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            <Select
              label="Product *"
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value)
                setBatchId("")
                setParams({})
              }}
            >
              <option value="">Select Product...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Select
              label="Location *"
              value={locationId}
              onChange={(e) => {
                setLocationId(e.target.value)
                setParams({})
              }}
            >
              <option value="">Select Location...</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
            <Select
              label="Batch (Optional)"
              value={batchId}
              onChange={(e) => {
                setBatchId(e.target.value)
                setParams({})
              }}
              disabled={!productId}
            >
              <option value="">All Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batchNumber}
                </option>
              ))}
            </Select>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#666666]">From Date</label>
              <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} className="w-full rounded-xl border border-[#C6D4BF] px-3 py-2 text-sm focus:border-[#B6C8AF] focus:outline-none" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#666666]">To Date</label>
              <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} className="w-full rounded-xl border border-[#C6D4BF] px-3 py-2 text-sm focus:border-[#B6C8AF] focus:outline-none" />
            </div>
          </div>
          {(fromDate || toDate) && (
            <button onClick={() => { setFromDate(""); setToDate(""); setPage(1); }} className="text-xs font-semibold text-[#7A9076] hover:underline self-end">Clear Date Range</button>
          )}
        </div>

        {!productId || !locationId ? (
          <EmptyState
            title="Select Product and Location"
            description="A product and location must be selected to view the bin card."
          />
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : loading ? (
          <div className="p-6 space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-[#E6ECE2] rounded-lg" />
            ))}
          </div>
        ) : card ? (
          <div className="flex flex-col gap-6">
            <div className="rounded-xl bg-[#E6ECE2]/40 p-4 border border-[#E6ECE2]">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-[#666666] mb-1">Product</p>
                  <p className="font-bold text-[#333333]">
                    {selectedProduct?.name}
                  </p>
                </div>
                <div>
                  <p className="text-[#666666] mb-1">Location</p>
                  <p className="font-semibold text-[#333333]">
                    {selectedLocation?.name}
                  </p>
                </div>
                <div>
                  <p className="text-[#666666] mb-1">Batch</p>
                  <p className="font-mono font-semibold text-[#333333]">
                    {selectedBatch ? selectedBatch.batchNumber : "All Batches"}
                  </p>
                </div>
                <div>
                  <p className="text-[#666666] mb-1">Unit</p>
                  <p className="font-semibold text-[#333333]">
                    {unit ? `${unit}s` : "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#E6ECE2] p-4 flex items-center justify-between bg-white">
              <span className="text-xs font-semibold text-[#666666] uppercase tracking-wide">
                Opening Balance
              </span>
              <span className="text-xl font-bold text-[#333333]">
                {openingBalance.toLocaleString()} {unit ? `${unit}s` : ""}
              </span>
            </div>

            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[150px]">
                <label className="text-xs font-medium text-[#666666] block mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full rounded-xl border border-[#C6D4BF] px-3 py-2 text-sm focus:border-[#B6C8AF] focus:outline-none"
                />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="text-xs font-medium text-[#666666] block mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full rounded-xl border border-[#C6D4BF] px-3 py-2 text-sm focus:border-[#B6C8AF] focus:outline-none"
                />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="text-xs font-medium text-[#666666] block mb-1">
                  Movement Type
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full rounded-xl border border-[#C6D4BF] px-3 py-2 text-sm focus:border-[#B6C8AF] focus:outline-none"
                >
                  <option value="">All Movements</option>
                  {[
                    "RECEIPT",
                    "SALE",
                    "TRANSFER",
                    "ADJUSTMENT",
                    "OPENING",
                    "DISPOSAL",
                    "RETURN",
                  ].map((t) => (
                    <option key={t} value={t}>
                      {prettyType(t)}
                    </option>
                  ))}
                </select>
              </div>
              {hasFilters && (
                <button
                  onClick={() => {
                    setFromDate("")
                    setToDate("")
                    setTypeFilter("")
                  }}
                  className="text-xs font-semibold text-[#7A9076] hover:underline pb-2"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#E6ECE2] text-left">
                      <th className="px-4 py-3 font-semibold text-[#333333]">
                        Date
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">
                        Reference
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">
                        Type
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#333333] text-right">
                        IN
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#333333] text-right">
                        OUT
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#333333] text-right">
                        Balance
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#333333] text-right hidden lg:table-cell">
                        Cost
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tx.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-8 text-center text-sm text-[#999]"
                        >
                          No movements in the selected range.
                        </td>
                      </tr>
                    ) : (
                      ledger.map((t, i) => (
                        <tr
                          key={t.transactionId}
                          className={
                            i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"
                          }
                        >
                          <td className="px-4 py-3 text-[#666666] whitespace-nowrap text-xs">
                            {fmtDate(t.date)}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[#666666]">
                            {t.reference || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <TxTypeBadge type={t.transactionType} />
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-green-700">
                            {t.in > 0 ? (
                              t.in.toLocaleString()
                            ) : (
                              <span className="text-[#999] font-normal">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-red-600">
                            {t.out > 0 ? (
                              t.out.toLocaleString()
                            ) : (
                              <span className="text-[#999] font-normal">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-[#333333]">
                            {t.runningBalance.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-[#666666] hidden lg:table-cell">
                            {t.costPrice != null
                              ? `${t.costPrice.toLocaleString()} ETB`
                              : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-[#E6ECE2] bg-[#E6ECE2]/20">
                <div className="grid grid-cols-3 px-4 py-4 text-sm">
                  <div>
                    <p className="text-xs text-[#999]">Total IN</p>
                    <p className="font-bold text-green-700">
                      +{totals.totalIn.toLocaleString()}{" "}
                      {unit ? `${unit}s` : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#999]">Total OUT</p>
                    <p className="font-bold text-red-600">
                      −{totals.totalOut.toLocaleString()}{" "}
                      {unit ? `${unit}s` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#999]">Closing Balance</p>
                    <p className="font-bold text-[#333333]">
                      {closing.toLocaleString()} {unit ? `${unit}s` : ""}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}