import { useEffect, useState } from "react"
import {
  ChevronRight,
  TriangleAlert,
  Wallet,
  FileText,
  Package,
  Undo2,
  X,
} from "lucide-react"
import PageHeader from "../../components/ui/PageHeader"
import SearchInput from "../../components/ui/SearchInput"
import Pagination from "../../components/ui/Pagination"
import Button from "../../components/ui/Button"
import Modal from "../../components/ui/Modal"
import StatusChip, { type StatusTone } from "../../components/ui/StatusChip"
import AddSupplier from "./AddSupplier"

import {
  listSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
  SuppliersApiError,
  type SupplierDto,
  type SupplierDetailDto,
} from "../../features/purchasing/suppliersApi"

/*
 * IMPORTANT
 * ----------
 * The currently available supplier API provides:
 *
 * GET    /api/v1/purchasing/suppliers
 * POST   /api/v1/purchasing/suppliers
 * GET    /api/v1/purchasing/suppliers/{id}
 * PATCH  /api/v1/purchasing/suppliers/{id}
 * DELETE /api/v1/purchasing/suppliers/{id}
 *
 * The supplier detail response also contains purchaseOrders, supplierInvoices,
 * counts and totalOutstanding.
 *
 * There is currently NO confirmed global supplier-invoice-list endpoint or a
 * payment endpoint in the API file supplied, so invoice listing and payment
 * recording are intentionally omitted rather than invented.
 */

const PAGE_SIZE = 10

const PO_BADGE: Record<string, StatusTone> = {
  DRAFT: "gray",
  SENT: "blue",
  RECEIVED: "green",
  CANCELLED: "red",
}

const INV_BADGE: Record<string, StatusTone> = {
  PAID: "green",
  PARTIALLY_PAID: "orange",
  UNPAID: "yellow",
  OVERDUE: "red",
}

interface EditSupplierForm {
  name: string
  contactPerson: string
  email: string
  phone: string
  address: string
  paymentTerms: string
  isActive: boolean
}

const EMPTY_EDIT_FORM: EditSupplierForm = {
  name: "",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
  paymentTerms: "30 days",
  isActive: true,
}

type SupplierDetail = SupplierDetailDto

function fmtMoney(amount: number | null | undefined): string {
  return `${Number(amount ?? 0).toLocaleString("en-ET", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ETB`
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return "—"

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export default function SupplierPayablesPage() {
  // ---------------------------------------------------------------------------
  // Real supplier API data
  // ---------------------------------------------------------------------------

  const [suppliers, setSuppliers] = useState<SupplierDto[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)

  const [suppFilter, setSuppFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  // ---------------------------------------------------------------------------
  // Add Supplier
  // ---------------------------------------------------------------------------

  const [showAddSupplier, setShowAddSupplier] = useState(false)

  // ---------------------------------------------------------------------------
  // Supplier Detail
  // ---------------------------------------------------------------------------

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<SupplierDetail | null>(null)

  // ---------------------------------------------------------------------------
  // Edit Supplier
  // ---------------------------------------------------------------------------

  const [editOpen, setEditOpen] = useState(false)
  const [editTargetSupplierId, setEditTargetSupplierId] =
    useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditSupplierForm>({
    ...EMPTY_EDIT_FORM,
  })
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})
  const [editSuccess, setEditSuccess] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editApiError, setEditApiError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Delete Supplier
  // ---------------------------------------------------------------------------

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingSupplier, setDeletingSupplier] = useState<SupplierDto | null>(
    null,
  )
  const [deleting, setDeleting] = useState(false)
  const [deleteSuccess, setDeleteSuccess] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Load suppliers from real API
  // ---------------------------------------------------------------------------

  async function loadSuppliers() {
    setLoading(true)
    setApiError(null)

    try {
      const result = await listSuppliers({
        page: 1,
        limit: 100,
        search: search.trim() || undefined,
      })

      setSuppliers(result.data)

      // Keep pagination valid after filtering/searching.
      const maxPage = Math.max(1, Math.ceil(result.data.length / PAGE_SIZE))

      setPage((current) => Math.min(current, maxPage))
    } catch (e) {
      setApiError(
        e instanceof SuppliersApiError
          ? e.message
          : "Failed to load suppliers.",
      )
      setSuppliers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSuppliers()
  }, [search])

  // ---------------------------------------------------------------------------
  // Filtering & pagination
  // ---------------------------------------------------------------------------

  const filteredSuppliers =
    suppFilter === "all"
      ? suppliers
      : suppliers.filter((supplier) => supplier.id === suppFilter)

  const totalPages = Math.max(
    1,
    Math.ceil(filteredSuppliers.length / PAGE_SIZE),
  )

  const pagedSuppliers = filteredSuppliers.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  )

  function resetFilters() {
    setSearch("")
    setSuppFilter("all")
    setPage(1)
  }

  // ---------------------------------------------------------------------------
  // Supplier statistics
  // ---------------------------------------------------------------------------

  const totalOutstanding = filteredSuppliers.reduce(
    (sum, supplier) => sum + Number(supplier.totalOutstanding ?? 0),
    0,
  )

  const totalInvoices = filteredSuppliers.reduce(
    (sum, supplier) => sum + Number(supplier._count?.supplierInvoices ?? 0),
    0,
  )

  const totalSuppliers = filteredSuppliers.length

  const activeSuppliers = filteredSuppliers.filter(
    (supplier) => supplier.isActive,
  ).length

  // ---------------------------------------------------------------------------
  // Add supplier
  // ---------------------------------------------------------------------------

  function handleSupplierCreated(created: SupplierDto) {
    setSuppliers((prev) => [created, ...prev])
    setShowAddSupplier(false)
    setPage(1)
  }

  // ---------------------------------------------------------------------------
  // Supplier detail
  // ---------------------------------------------------------------------------

  async function openSupplierDetail(supplier: SupplierDto) {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError(null)
    setDetailData(null)

    try {
      /*
       * GET /api/v1/purchasing/suppliers/{id}
       */
      const data = await getSupplierById(supplier.id)
      setDetailData(data)
    } catch (e) {
      setDetailError(
        e instanceof SuppliersApiError
          ? e.message
          : "Failed to load supplier detail.",
      )
    } finally {
      setDetailLoading(false)
    }
  }

  function closeDetail() {
    setDetailOpen(false)
    setDetailData(null)
    setDetailError(null)
  }

  // ---------------------------------------------------------------------------
  // Edit supplier
  // ---------------------------------------------------------------------------

  async function openEdit(supplier: SupplierDto) {
    setEditTargetSupplierId(supplier.id)
    setEditErrors({})
    setEditSuccess(false)
    setEditApiError(null)

    // First populate the form using the supplier list.
    setEditForm({
      name: supplier.name,
      contactPerson: supplier.contactPerson ?? "",
      email: supplier.email ?? "",
      phone: supplier.phone ?? "",
      address: supplier.address ?? "",
      paymentTerms: supplier.paymentTerms ?? "30 days",
      isActive: supplier.isActive,
    })

    setEditOpen(true)

    // Then refresh using GET /api/v1/purchasing/suppliers/{id}
    try {
      const detail = await getSupplierById(supplier.id)

      setEditForm({
        name: detail.name,
        contactPerson: detail.contactPerson ?? "",
        email: detail.email ?? "",
        phone: detail.phone ?? "",
        address: detail.address ?? "",
        paymentTerms: detail.paymentTerms ?? "30 days",
        isActive: detail.isActive,
      })
    } catch (e) {
      setEditApiError(
        e instanceof SuppliersApiError
          ? e.message
          : "Failed to load supplier details.",
      )
    }
  }

  function closeEdit() {
    if (editSaving) return

    setEditOpen(false)
    setEditTargetSupplierId(null)
    setEditForm({ ...EMPTY_EDIT_FORM })
    setEditErrors({})
    setEditApiError(null)
  }

  function updateEditField<K extends keyof EditSupplierForm>(
    key: K,
    value: EditSupplierForm[K],
  ) {
    setEditForm((current) => ({
      ...current,
      [key]: value,
    }))

    setEditErrors((current) => ({
      ...current,
      [key]: "",
    }))
  }

  function validateEdit(): boolean {
    const errors: Record<string, string> = {}

    if (!editForm.name.trim()) {
      errors.name = "Name is required"
    }

    if (
      editForm.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)
    ) {
      errors.email = "Invalid email"
    }

    setEditErrors(errors)

    return Object.keys(errors).length === 0
  }

  async function handleSaveEdit() {
    if (!validateEdit()) return
    if (!editTargetSupplierId || editSaving) return

    setEditSaving(true)
    setEditApiError(null)

    try {
      /*
       * PATCH /api/v1/purchasing/suppliers/{id}
       */
      const updated = await updateSupplier(editTargetSupplierId, {
        name: editForm.name.trim(),
        contactPerson: editForm.contactPerson.trim() || null,
        email: editForm.email.trim() || null,
        phone: editForm.phone.trim() || null,
        address: editForm.address.trim() || null,
        paymentTerms: editForm.paymentTerms || null,
        isActive: editForm.isActive,
      })

      // Replace the actual supplier returned by the backend.
      setSuppliers((prev) =>
        prev.map((supplier) =>
          supplier.id === updated.id ? updated : supplier,
        ),
      )

      setEditSuccess(true)

      setTimeout(() => {
        setEditSuccess(false)
        setEditOpen(false)
        setEditTargetSupplierId(null)
        setEditForm({ ...EMPTY_EDIT_FORM })
      }, 800)
    } catch (e) {
      setEditApiError(
        e instanceof SuppliersApiError
          ? e.message
          : "Could not update the supplier. Please try again.",
      )
    } finally {
      setEditSaving(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Delete supplier
  // ---------------------------------------------------------------------------

  function openDelete(supplier: SupplierDto) {
    setDeletingSupplier(supplier)
    setDeleteSuccess(false)
    setDeleteError(null)
    setDeleteOpen(true)
  }

  function closeDelete() {
    if (deleting) return

    setDeleteOpen(false)
    setDeletingSupplier(null)
    setDeleteError(null)
  }

  async function handleConfirmDelete() {
    if (!deletingSupplier || deleting) return

    setDeleting(true)
    setDeleteError(null)

    try {
      /*
       * DELETE /api/v1/purchasing/suppliers/{id}
       *
       * Backend can return:
       * 409 SUPPLIER_IN_USE
       */
      await deleteSupplier(deletingSupplier.id)

      setSuppliers((prev) =>
        prev.filter((supplier) => supplier.id !== deletingSupplier.id),
      )

      setDeleteSuccess(true)

      setTimeout(() => {
        setDeleteSuccess(false)
        setDeleteOpen(false)
        setDeletingSupplier(null)
      }, 700)
    } catch (e) {
      setDeleteError(
        e instanceof SuppliersApiError
          ? e.message
          : "Could not delete the supplier. Please try again.",
      )
    } finally {
      setDeleting(false)
    }
  }

  const hasFilters = Boolean(search.trim()) || suppFilter !== "all"

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Purchasing / Supplier Payables"
        title="Supplier Accounts Payable"
        subtitle="View supplier accounts and outstanding balances."
        actions={
          <Button onClick={() => setShowAddSupplier(true)}>
            + Add Supplier
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {([
            ["Total Outstanding", fmtMoney(totalOutstanding), "text-red-600"],
            ["Total Invoices", String(totalInvoices), "text-[#333333]"],
            ["Suppliers", String(totalSuppliers), "text-[#333333]"],
            ["Active Suppliers", String(activeSuppliers), "text-green-600"],
          ] as [string, string, string][]).map(([label, value, accent]) => (
            <div
              key={label}
              className="bg-white rounded-xl border border-[#E6ECE2] p-4"
            >
              <p className="text-xs text-[#666666]">{label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${accent}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1 min-w-[200px]">
              <SearchInput
                value={search}
                onChange={(v) => {
                  setSearch(v)
                  setPage(1)
                }}
                placeholder="Search suppliers..."
              />
            </div>
            <select
              value={suppFilter}
              onChange={(e) => {
                setSuppFilter(e.target.value)
                setPage(1)
              }}
              className="sm:w-48 rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none"
            >
              <option value="all">All Suppliers</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="text-xs font-semibold text-[#7A9076] hover:underline whitespace-nowrap"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Payment availability notice */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
          <TriangleAlert className="h-4 w-4 flex-shrink-0" />
          Payment recording is temporarily unavailable until the
          supplier-invoice payment endpoint is connected.
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="h-8 w-8 rounded-full border-4 border-[#E6ECE2] border-t-[#B6C8AF] animate-spin" />
              <p className="text-sm text-[#666666]">Loading suppliers...</p>
            </div>
          ) : apiError ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 px-6">
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 max-w-md text-center">
                {apiError}
              </p>
              <Button onClick={() => void loadSuppliers()}>Retry</Button>
            </div>
          ) : pagedSuppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="h-14 w-14 rounded-2xl bg-[#E6ECE2] flex items-center justify-center">
                <svg
                  className="h-7 w-7 text-[#7A9076]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z"
                  />
                </svg>
              </div>
              <div className="text-center">
                <p className="font-semibold text-[#333333]">
                  No suppliers found
                </p>
                <p className="text-sm text-[#666666] mt-1">
                  {hasFilters
                    ? "No suppliers match your filters."
                    : "Suppliers will appear here once they are added."}
                </p>
              </div>
              {hasFilters ? (
                <button
                  onClick={resetFilters}
                  className="text-sm font-semibold text-[#7A9076] hover:underline"
                >
                  Clear Filters
                </button>
              ) : (
                <Button onClick={() => setShowAddSupplier(true)}>
                  + Add Supplier
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#E6ECE2] text-left">
                      {[
                        "Supplier",
                        "Contact",
                        "Phone",
                        "Invoices",
                        "Status",
                        "Actions",
                      ].map((heading) => (
                        <th
                          key={heading}
                          className="px-4 py-3 font-semibold text-[#333333]"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedSuppliers.map((supplier, index) => (
                      <tr
                        key={supplier.id}
                        className={`hover:bg-[#E6ECE2]/30 transition-colors ${
                          index % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/15"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <p className="text-[#333333]">{supplier.name}</p>
                          <p className="text-[11px] text-[#666666] font-mono">
                            {supplier.id}
                          </p>
                        </td>

                        <td className="px-4 py-3 text-[#333333]">
                          {supplier.contactPerson ?? "—"}
                        </td>

                        <td className="px-4 py-3 text-[#333333]">
                          {supplier.phone ?? "—"}
                        </td>

                        <td className="px-4 py-3 text-[#333333]">
                          {supplier._count?.supplierInvoices ?? 0}
                        </td>

                        <td className="px-4 py-3">
                          <StatusChip
                            label={supplier.isActive ? "Active" : "Inactive"}
                            tone={supplier.isActive ? "green" : "gray"}
                          />
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => void openSupplierDetail(supplier)}
                              className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#7A9076] hover:underline whitespace-nowrap"
                            >
                              View <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => void openEdit(supplier)}
                              className="text-xs font-semibold text-[#7A9076] hover:underline whitespace-nowrap"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => openDelete(supplier)}
                              className="text-xs text-red-500 hover:underline whitespace-nowrap"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                total={filteredSuppliers.length}
                pageSize={PAGE_SIZE}
                itemLabel="suppliers"
              />
            </>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Add Supplier                                                        */}
      {/* ------------------------------------------------------------------ */}

      <AddSupplier
        open={showAddSupplier}
        onClose={() => setShowAddSupplier(false)}
        onCreated={handleSupplierCreated}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Supplier Detail                                                     */}
      {/* ------------------------------------------------------------------ */}

      {detailOpen && (
        <SupplierDetailModal
          data={detailData}
          loading={detailLoading}
          error={detailError}
          onClose={closeDetail}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Edit Supplier                                                       */}
      {/* ------------------------------------------------------------------ */}

      <EditSupplierModal
        open={editOpen}
        form={editForm}
        errors={editErrors}
        success={editSuccess}
        saving={editSaving}
        error={editApiError}
        onChange={updateEditField}
        onSave={handleSaveEdit}
        onClose={closeEdit}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Delete Supplier                                                     */}
      {/* ------------------------------------------------------------------ */}

      <DeleteSupplierModal
        open={deleteOpen}
        supplier={deletingSupplier}
        success={deleteSuccess}
        deleting={deleting}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onClose={closeDelete}
      />
    </div>
  )
}

/* ========================================================================= */
/* Edit Supplier Modal                                                       */
/* ========================================================================= */

function EditSupplierModal({
  open,
  form,
  errors,
  success,
  saving,
  error,
  onChange,
  onSave,
  onClose,
}: {
  open: boolean
  form: EditSupplierForm
  errors: Record<string, string>
  success: boolean
  saving: boolean
  error: string | null
  onChange: <K extends keyof EditSupplierForm,>(
    key: K,
    value: EditSupplierForm[K],
  ) => void
  onSave: () => void
  onClose: () => void
}) {
  return (
    <Modal open={open} title="Edit Supplier" onClose={onClose} size="md">
      {error && (
        <p className="mb-4 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {success && (
        <p className="mb-4 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
          Supplier updated successfully!
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-[#666666]">
            Supplier Name *
          </label>

          <input
            value={form.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="ABC Pharmaceuticals Ltd"
            className={`w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none ${
              errors.name
                ? "border-red-400"
                : "border-[#C6D4BF] focus:border-[#B6C8AF]"
            }`}
          />

          {errors.name && (
            <p className="mt-1 text-xs text-red-500">{errors.name}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs text-[#666666]">
            Contact Person
          </label>

          <input
            value={form.contactPerson}
            onChange={(e) => onChange("contactPerson", e.target.value)}
            placeholder="Jane Doe"
            className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3 py-2 text-sm focus:border-[#B6C8AF] focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-[#666666]">Email</label>

          <input
            type="email"
            value={form.email}
            onChange={(e) => onChange("email", e.target.value)}
            placeholder="jane@abc.com"
            className={`w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none ${
              errors.email
                ? "border-red-400"
                : "border-[#C6D4BF] focus:border-[#B6C8AF]"
            }`}
          />

          {errors.email && (
            <p className="mt-1 text-xs text-red-500">{errors.email}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs text-[#666666]">Phone</label>

          <input
            value={form.phone}
            onChange={(e) => onChange("phone", e.target.value)}
            placeholder="+251922345678"
            className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3 py-2 text-sm focus:border-[#B6C8AF] focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-[#666666]">
            Payment Terms
          </label>

          <select
            value={form.paymentTerms}
            onChange={(e) => onChange("paymentTerms", e.target.value)}
            className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3 py-2 text-sm focus:border-[#B6C8AF] focus:outline-none"
          >
            <option value="">No terms specified</option>
            <option value="15 days">15 days</option>
            <option value="30 days">30 days</option>
            <option value="45 days">45 days</option>
            <option value="60 days">60 days</option>
            <option value="Cash on delivery">Cash on delivery</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-[#666666]">Address</label>

          <input
            value={form.address}
            onChange={(e) => onChange("address", e.target.value)}
            placeholder="Bole, Addis Ababa"
            className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3 py-2 text-sm focus:border-[#B6C8AF] focus:outline-none"
          />
        </div>

        <div className="sm:col-span-2 flex items-center gap-2">
          <input
            id="editIsActive"
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => onChange("isActive", e.target.checked)}
            className="h-4 w-4 rounded border-[#C6D4BF] text-[#7A9076] focus:ring-[#B6C8AF]"
          />

          <label htmlFor="editIsActive" className="text-sm text-[#333333]">
            Active supplier
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-6">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={onSave} loading={saving}>
          Save Changes
        </Button>
      </div>
    </Modal>
  )
}

/* ========================================================================= */
/* Delete Supplier Modal                                                     */
/* ========================================================================= */

function DeleteSupplierModal({
  open,
  supplier,
  success,
  deleting,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean
  supplier: SupplierDto | null
  success: boolean
  deleting: boolean
  error: string | null
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal open={open} title="Delete Supplier" onClose={onClose} size="sm">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-5 w-5 text-red-600"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <div className="min-w-0">
          <p className="text-sm text-[#666666]">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-[#333333]">
              {supplier?.name}
            </span>
            ?
          </p>

          <p className="mt-2 text-xs text-[#666666]">
            If this supplier has related purchase orders, invoices, or returns,
            the backend may reject the deletion.
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {success && (
        <p className="mt-4 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
          Supplier deleted successfully!
        </p>
      )}

      <div className="flex items-center justify-end gap-2 mt-6">
        <Button variant="secondary" onClick={onClose} disabled={deleting}>
          Cancel
        </Button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={deleting || success}
          className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {deleting ? "Deleting..." : "Yes, Delete"}
        </button>
      </div>
    </Modal>
  )
}

/* ========================================================================= */
/* Supplier Detail Modal                                                     */
/* ========================================================================= */

function SupplierDetailModal({
  data,
  loading,
  error,
  onClose,
}: {
  data: SupplierDetail | null
  loading: boolean
  error: string | null
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6ECE2] flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[#333333] truncate">
              {loading
                ? "Loading supplier..."
                : (data?.name ?? "Supplier Detail")}
            </h2>

            <p className="text-xs text-[#666666]">Supplier Detail</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#666666] hover:bg-[#E6ECE2] transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {loading && (
            <div className="animate-pulse space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-xl bg-[#E6ECE2]" />
                ))}
              </div>

              <div className="h-32 rounded-xl bg-[#E6ECE2]" />
              <div className="h-40 rounded-xl bg-[#E6ECE2]" />
            </div>
          )}

          {error && !loading && (
            <div className="rounded-xl flex items-center gap-2 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
              <TriangleAlert className="h-4 w-4 flex-shrink-0" /> {error}
            </div>
          )}

          {data && !loading && !error && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  {
                    label: "Total Outstanding",
                    value: fmtMoney(data.totalOutstanding ?? 0),
                    color: "text-red-500",
                    icon: <Wallet className="h-7 w-7" />,
                  },
                  {
                    label: "Purchase Orders",
                    value: String(data._count?.purchaseOrders ?? 0),
                    color: "text-[#333333]",
                    icon: <Package className="h-7 w-7" />,
                  },
                  {
                    label: "Invoices",
                    value: String(data._count?.supplierInvoices ?? 0),
                    color: "text-[#333333]",
                    icon: <FileText className="h-7 w-7" />,
                  },
                  {
                    label: "Returns",
                    value: String(data._count?.purchaseReturns ?? 0),
                    color: "text-[#333333]",
                    icon: <Undo2 className="h-7 w-7" />,
                  },
                ].map(({ label, value, color, icon }) => (
                  <div
                    key={label}
                    className="bg-white rounded-xl border border-[#E6ECE2] p-4 flex items-center gap-3"
                  >
                    <span className="text-2xl flex-shrink-0" aria-hidden>
                      {icon}
                    </span>

                    <div className="min-w-0">
                      <p className="text-xs text-[#666666]">{label}</p>

                      <p className={`text-sm font-bold ${color} truncate`}>
                        {value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Supplier information */}
              <div className="rounded-xl border border-[#E6ECE2] bg-white overflow-hidden">
                <div className="bg-[#E6ECE2] px-5 py-3 flex items-center justify-between">
                  <h3 className="font-bold text-[#333333]">
                    Supplier Information
                  </h3>

                  <StatusChip
                    label={data.isActive ? "Active" : "Inactive"}
                    tone={data.isActive ? "green" : "gray"}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 px-5 py-5">
                  <InfoRow label="Supplier ID" value={data.id} mono />

                  <InfoRow
                    label="Contact Person"
                    value={data.contactPerson ?? "—"}
                  />

                  <InfoRow label="Phone" value={data.phone ?? "—"} />

                  <InfoRow label="Email" value={data.email ?? "—"} />

                  <InfoRow label="Address" value={data.address ?? "—"} />

                  <InfoRow
                    label="Payment Terms"
                    value={data.paymentTerms ?? "—"}
                  />

                  <InfoRow label="Created" value={fmtDate(data.createdAt)} />

                  <InfoRow
                    label="Last Updated"
                    value={fmtDate(data.updatedAt)}
                  />
                </div>
              </div>

              {/* Purchase Orders */}
              <div className="rounded-xl border border-[#E6ECE2] overflow-hidden">
                <div className="bg-[#E6ECE2] px-5 py-3 flex items-center justify-between">
                  <h3 className="font-bold text-[#333333]">Purchase Orders</h3>

                  <span className="text-xs text-[#333333]">
                    Showing {(data.purchaseOrders ?? []).length} of{" "}
                    {data._count?.purchaseOrders ?? 0}
                  </span>
                </div>

                <table className="w-full text-sm bg-white">
                  <thead>
                    <tr className="bg-[#E6ECE2]">
                      {[
                        "PO Number",
                        "Status",
                        "Order Date",
                        "Expected Delivery",
                      ].map((heading) => (
                        <th
                          key={heading}
                          className="px-5 py-2.5 text-left font-semibold text-[#333333]"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {(data.purchaseOrders ?? []).length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-5 py-8 text-center text-[#666666]"
                        >
                          No purchase orders.
                        </td>
                      </tr>
                    ) : (
                      (data.purchaseOrders ?? []).map((po, i) => (
                        <tr
                          key={po.id}
                          className={
                            i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"
                          }
                        >
                          <td className="px-5 py-3 font-medium text-[#7A9076]">
                            {po.poNumber}
                          </td>

                          <td className="px-5 py-3">
                            <StatusChip
                              label={po.status}
                              tone={PO_BADGE[po.status] ?? "gray"}
                            />
                          </td>

                          <td className="px-5 py-3 text-[#333333]">
                            {fmtDate(po.orderDate)}
                          </td>

                          <td className="px-5 py-3 text-[#333333]">
                            {fmtDate(po.expectedDeliveryDate)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Supplier invoices */}
              <div className="rounded-xl border border-[#E6ECE2] overflow-hidden">
                <div className="bg-[#E6ECE2] px-5 py-3 flex items-center justify-between">
                  <h3 className="font-bold text-[#333333]">
                    Supplier Invoices
                  </h3>

                  <span className="text-xs text-[#333333]">
                    Showing {(data.supplierInvoices ?? []).length} of{" "}
                    {data._count?.supplierInvoices ?? 0}
                  </span>
                </div>

                <table className="w-full text-sm bg-white">
                  <thead>
                    <tr className="bg-[#E6ECE2]">
                      {[
                        "Invoice #",
                        "Status",
                        "Invoice Amount",
                        "Outstanding",
                      ].map((heading) => (
                        <th
                          key={heading}
                          className="px-5 py-2.5 text-left font-semibold text-[#333333]"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {(data.supplierInvoices ?? []).length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-5 py-8 text-center text-[#666666]"
                        >
                          No invoices.
                        </td>
                      </tr>
                    ) : (
                      (data.supplierInvoices ?? []).map((invoice, i) => (
                        <tr
                          key={invoice.id}
                          className={
                            i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"
                          }
                        >
                          <td className="px-5 py-3 font-medium text-[#7A9076]">
                            {invoice.invoiceNumber}
                          </td>

                          <td className="px-5 py-3">
                            <StatusChip
                              label={invoice.status.replace("_", " ")}
                              tone={INV_BADGE[invoice.status] ?? "gray"}
                            />
                          </td>

                          <td className="px-5 py-3 font-semibold text-[#333333]">
                            {fmtMoney(invoice.invoiceAmount)}
                          </td>

                          <td
                            className={`px-5 py-3 font-semibold ${
                              invoice.outstandingBalance > 0
                                ? "text-red-500"
                                : "text-green-600"
                            }`}
                          >
                            {fmtMoney(invoice.outstandingBalance)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Summary counts */}
              <div className="rounded-xl border border-[#E6ECE2] bg-white px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SummaryCount
                  label="Total Purchase Orders"
                  value={data._count?.purchaseOrders ?? 0}
                />

                <SummaryCount
                  label="Total Supplier Invoices"
                  value={data._count?.supplierInvoices ?? 0}
                />

                <SummaryCount
                  label="Total Purchase Returns"
                  value={data._count?.purchaseReturns ?? 0}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[#E6ECE2] px-6 py-3 bg-white flex-shrink-0">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ========================================================================= */
/* Small helpers                                                             */
/* ========================================================================= */

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-[#666666]">
        {label}
      </p>

      <p
        className={`text-sm text-[#333333] ${
          mono ? "font-mono" : ""
        } break-all`}
      >
        {value}
      </p>
    </div>
  )
}

function SummaryCount({ label, value }: { label: string value: number }) {
  return (
    <div className="text-center sm:text-left">
      <p className="text-xs text-[#666666]">{label}</p>

      <p className="text-lg font-bold text-[#333333]">{value}</p>
    </div>
  )
}
