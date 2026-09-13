import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { getProducts, getGroups } from "../../features/inventory/inventoryService"
import type { Product, ProductGroup } from "../../features/inventory/inventoryMock"
import MetricCard from "../../components/ui/MetricCard"
import SearchInput from "../../components/ui/SearchInput"
import Select from "../../components/ui/Select"
import StatusBadge from "../../components/ui/StatusBadge"
import Pagination from "../../components/ui/Pagination"
import EmptyState from "../../components/ui/EmptyState"
import Button from "../../components/ui/Button"
import PageHeader from "../../components/ui/PageHeader"

const PAGE_SIZE = 10

export default function ProductsPage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [groups, setGroups] = useState<ProductGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [groupFilter, setGroupFilter] = useState("")
  const [page, setPage] = useState(1)

  useEffect(() => {
    Promise.all([getProducts(), getGroups()]).then(([p, g]) => {
      setProducts(p)
      setGroups(g)
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    let list = products
    if (search)
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.genericName.toLowerCase().includes(search.toLowerCase()) ||
          p.sku.toLowerCase().includes(search.toLowerCase()) ||
          p.brand.toLowerCase().includes(search.toLowerCase())
      )
    if (statusFilter) list = list.filter((p) => p.status === statusFilter)
    if (groupFilter) list = list.filter((p) => p.groupId === groupFilter)
    return list
  }, [products, search, statusFilter, groupFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const metrics = useMemo(
    () => ({
      total: products.length,
      inStock: products.filter((p) => p.status === "in_stock").length,
      lowStock: products.filter((p) => p.status === "low_stock").length,
      outOfStock: products.filter((p) => p.status === "out_of_stock").length,
    }),
    [products]
  )

  function groupName(groupId: string) {
    return groups.find((g) => g.id === groupId)?.name ?? groupId
  }

  function handleSearch(v: string) {
    setSearch(v)
    setPage(1)
  }

  function formatExpiry(dateStr: string) {
    const d = new Date(dateStr)
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Inventory / Products"
        title="Products"
        subtitle="Manage medicines and inventory items."
        actions={
          <Button onClick={() => alert("Add Product — backend integration pending")}>
            + Add Product
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Total Products" value={loading ? "—" : metrics.total} icon={<BoxIcon />} />
          <MetricCard title="In Stock" value={loading ? "—" : metrics.inStock} icon={<CheckIcon />} />
          <MetricCard title="Low Stock" value={loading ? "—" : metrics.lowStock} icon={<WarnIcon />} subtitle="Needs attention" />
          <MetricCard title="Out of Stock" value={loading ? "—" : metrics.outOfStock} icon={<AlertIcon />} subtitle="Action required" />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <SearchInput value={search} onChange={handleSearch} placeholder="Search by name, SKU, generic name, brand..." />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="sm:w-44"
            >
              <option value="">All Statuses</option>
              <option value="in_stock">In Stock</option>
              <option value="low_stock">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
            </Select>
            <Select
              value={groupFilter}
              onChange={(e) => { setGroupFilter(e.target.value); setPage(1) }}
              className="sm:w-48"
            >
              <option value="">All Groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
          {loading ? (
            <LoadingSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState title="No products found" description="Try adjusting your search or filters." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#DBEFF3] text-left">
                      <th className="px-4 py-3 font-semibold text-[#333333]">Product</th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">SKU</th>
                      <th className="px-4 py-3 font-semibold text-[#333333] hidden sm:table-cell">Group</th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">Stock</th>
                      <th className="px-4 py-3 font-semibold text-[#333333] hidden md:table-cell">Location</th>
                      <th className="px-4 py-3 font-semibold text-[#333333] hidden lg:table-cell">Nearest Expiry</th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">Status</th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((product, i) => (
                      <tr key={product.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-[#333333]">{product.name}</p>
                            <p className="text-xs text-[#666666]">{product.genericName} · {product.brand}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#666666]">{product.sku}</td>
                        <td className="px-4 py-3 text-[#666666] hidden sm:table-cell">{groupName(product.groupId)}</td>
                        <td className="px-4 py-3 font-semibold text-[#333333]">
                          {product.totalStock.toLocaleString()} {product.baseUnit}s
                        </td>
                        <td className="px-4 py-3 text-[#666666] hidden md:table-cell">{product.location}</td>
                        <td className="px-4 py-3 text-[#666666] hidden lg:table-cell">{formatExpiry(product.nearestExpiry)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={product.status} />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => navigate(`/inventory/products/${product.id}`)}
                            className="text-xs font-semibold text-[#49B0C1] hover:underline"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-3 animate-pulse">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-10 rounded-lg bg-[#DBEFF3]" />
      ))}
    </div>
  )
}

function BoxIcon() {
  return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
}
function CheckIcon() {
  return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}
function WarnIcon() {
  return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
}
function AlertIcon() {
  return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
}
