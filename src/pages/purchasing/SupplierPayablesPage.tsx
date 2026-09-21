import { useEffect, useState } from "react";
import PageHeader from "../../components/ui/PageHeader";
import AddSupplier from "./AddSupplier";

import {
  listSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
  SuppliersApiError,
  type SupplierDto,
  type SupplierDetailDto,
} from "../../features/purchasing/suppliersApi";

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
 * The supplier detail response also contains:
 * - purchaseOrders
 * - supplierInvoices
 * - counts
 * - totalOutstanding
 *
 * There is currently NO confirmed global supplier-invoice-list endpoint
 * or payment endpoint in the API file supplied.
 *
 * Therefore invoice-listing/payment functionality that depended on:
 * - getInvoices()
 * - Invoice
 * - invoice date
 * - due date
 * - paid amount
 * - payment POST endpoint
 *
 * has intentionally been commented out rather than invented.
 */

const PAGE_SIZE = 5;

const PO_BADGE: Record<string, string> = {
  DRAFT: "bg-gray-400 text-white",
  SENT: "bg-blue-500 text-white",
  RECEIVED: "bg-green-500 text-white",
  CANCELLED: "bg-red-500 text-white",
};

const INV_BADGE: Record<string, string> = {
  PAID: "bg-green-500 text-white",
  PARTIALLY_PAID: "bg-orange-400 text-white",
  UNPAID: "bg-yellow-400 text-[#333333]",
  OVERDUE: "bg-red-500 text-white",
};

interface EditSupplierForm {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  paymentTerms: string;
  isActive: boolean;
}

const EMPTY_EDIT_FORM: EditSupplierForm = {
  name: "",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
  paymentTerms: "30 days",
  isActive: true,
};

type SupplierDetail = SupplierDetailDto;

function fmtMoney(amount: number | null | undefined): string {
  return `${Number(amount ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ETB`;
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function SupplierPayablesPage() {
  // ---------------------------------------------------------------------------
  // Real supplier API data
  // ---------------------------------------------------------------------------

  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const [suppFilter, setSuppFilter] = useState("all");

  /*
   * Invoice status filtering is temporarily disabled because the supplied
   * supplier API does not expose a global invoice-list endpoint.
   *
   * Keep these commented until the actual invoice endpoint is provided.
   *
   * const [statusFilter, setStatusFilter] = useState("all");
   */

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // ---------------------------------------------------------------------------
  // Add Supplier
  // ---------------------------------------------------------------------------

  const [showAddSupplier, setShowAddSupplier] = useState(false);

  // ---------------------------------------------------------------------------
  // Supplier Detail
  // ---------------------------------------------------------------------------

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<SupplierDetail | null>(null);

  // ---------------------------------------------------------------------------
  // Edit Supplier
  // ---------------------------------------------------------------------------

  const [editOpen, setEditOpen] = useState(false);
  const [editTargetSupplierId, setEditTargetSupplierId] = useState<string | null>(
    null,
  );
  const [editForm, setEditForm] = useState<EditSupplierForm>({
    ...EMPTY_EDIT_FORM,
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editSuccess, setEditSuccess] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editApiError, setEditApiError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Delete Supplier
  // ---------------------------------------------------------------------------

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingSupplier, setDeletingSupplier] =
    useState<SupplierDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Record Payment
  // ---------------------------------------------------------------------------

  /*
   * COMMENTED OUT UNTIL THE REAL PAYMENT ENDPOINT IS PROVIDED.
   *
   * The current supplier API contains no payment endpoint.
   *
   * const [payInvoiceId, setPayInvoiceId] = useState("");
   * const [payAmount, setPayAmount] = useState("");
   * const [payMethod, setPayMethod] = useState("Bank Transfer");
   * const [payDate, setPayDate] = useState(
   *   new Date().toISOString().split("T")[0],
   * );
   * const [payRef, setPayRef] = useState("");
   * const [paySuccess, setPaySuccess] = useState(false);
   */

  // ---------------------------------------------------------------------------
  // Load suppliers from real API
  // ---------------------------------------------------------------------------

  async function loadSuppliers() {
    setLoading(true);
    setApiError(null);

    try {
      const result = await listSuppliers({
        page: 1,
        limit: 100,
        search: search.trim() || undefined,
      });

      setSuppliers(result.data);

      // Keep pagination valid after filtering/searching.
      const maxPage = Math.max(
        1,
        Math.ceil(result.data.length / PAGE_SIZE),
      );

      setPage((current) => Math.min(current, maxPage));
    } catch (e) {
      setApiError(
        e instanceof SuppliersApiError
          ? e.message
          : "Failed to load suppliers.",
      );
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSuppliers();
  }, [search]);

  // ---------------------------------------------------------------------------
  // Supplier statistics
  // ---------------------------------------------------------------------------

  /*
   * These are based on the real supplier list returned by the backend.
   *
   * totalOutstanding comes directly from SupplierDto.totalOutstanding.
   * supplier invoice count comes from _count.supplierInvoices.
   */

  const totalOutstanding = suppliers.reduce(
    (sum, supplier) => sum + Number(supplier.totalOutstanding ?? 0),
    0,
  );

  const totalInvoices = suppliers.reduce(
    (sum, supplier) => sum + Number(supplier._count?.supplierInvoices ?? 0),
    0,
  );

  const totalSuppliers = suppliers.length;

  const activeSuppliers = suppliers.filter((supplier) => supplier.isActive).length;

  /*
   * OVERDUE and PAID THIS MONTH are intentionally not calculated here.
   *
   * Reason:
   * SupplierDto does not contain:
   * - invoice due date
   * - payment date
   * - paid amount
   *
   * So calculating those values from the available API would be incorrect.
   */

  // ---------------------------------------------------------------------------
  // Pagination
  // ---------------------------------------------------------------------------

  const totalPages = Math.max(
    1,
    Math.ceil(suppliers.length / PAGE_SIZE),
  );

  const pagedSuppliers = suppliers.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  // ---------------------------------------------------------------------------
  // Add supplier
  // ---------------------------------------------------------------------------

  function handleSupplierCreated(created: SupplierDto) {
    setSuppliers((prev) => [created, ...prev]);
    setShowAddSupplier(false);
    setPage(1);
  }

  // ---------------------------------------------------------------------------
  // Supplier detail
  // ---------------------------------------------------------------------------

  async function openSupplierDetail(supplier: SupplierDto) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetailData(null);

    try {
      /*
       * GET /api/v1/purchasing/suppliers/{id}
       */
      const data = await getSupplierById(supplier.id);
      setDetailData(data);
    } catch (e) {
      setDetailError(
        e instanceof SuppliersApiError
          ? e.message
          : "Failed to load supplier detail.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setDetailOpen(false);
    setDetailData(null);
    setDetailError(null);
  }

  // ---------------------------------------------------------------------------
  // Edit supplier
  // ---------------------------------------------------------------------------

  async function openEdit(supplier: SupplierDto) {
    setEditTargetSupplierId(supplier.id);
    setEditErrors({});
    setEditSuccess(false);
    setEditApiError(null);

    /*
     * First populate the form using the supplier list.
     */
    setEditForm({
      name: supplier.name,
      contactPerson: supplier.contactPerson ?? "",
      email: supplier.email ?? "",
      phone: supplier.phone ?? "",
      address: supplier.address ?? "",
      paymentTerms: supplier.paymentTerms ?? "30 days",
      isActive: supplier.isActive,
    });

    setEditOpen(true);

    /*
     * Then refresh using:
     * GET /api/v1/purchasing/suppliers/{id}
     */
    try {
      const detail = await getSupplierById(supplier.id);

      setEditForm({
        name: detail.name,
        contactPerson: detail.contactPerson ?? "",
        email: detail.email ?? "",
        phone: detail.phone ?? "",
        address: detail.address ?? "",
        paymentTerms: detail.paymentTerms ?? "30 days",
        isActive: detail.isActive,
      });
    } catch (e) {
      setEditApiError(
        e instanceof SuppliersApiError
          ? e.message
          : "Failed to load supplier details.",
      );
    }
  }

  function closeEdit() {
    if (editSaving) return;

    setEditOpen(false);
    setEditTargetSupplierId(null);
    setEditForm({ ...EMPTY_EDIT_FORM });
    setEditErrors({});
    setEditApiError(null);
  }

  function updateEditField<K extends keyof EditSupplierForm>(
    key: K,
    value: EditSupplierForm[K],
  ) {
    setEditForm((current) => ({
      ...current,
      [key]: value,
    }));

    setEditErrors((current) => ({
      ...current,
      [key]: "",
    }));
  }

  function validateEdit(): boolean {
    const errors: Record<string, string> = {};

    if (!editForm.name.trim()) {
      errors.name = "Name is required";
    }

    if (
      editForm.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)
    ) {
      errors.email = "Invalid email";
    }

    setEditErrors(errors);

    return Object.keys(errors).length === 0;
  }

  async function handleSaveEdit() {
    if (!validateEdit()) return;
    if (!editTargetSupplierId || editSaving) return;

    setEditSaving(true);
    setEditApiError(null);

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
      });

      /*
       * Replace the actual supplier returned by the backend.
       */
      setSuppliers((prev) =>
        prev.map((supplier) =>
          supplier.id === updated.id ? updated : supplier,
        ),
      );

      setEditSuccess(true);

      setTimeout(() => {
        setEditSuccess(false);
        setEditOpen(false);
        setEditTargetSupplierId(null);
        setEditForm({ ...EMPTY_EDIT_FORM });
      }, 800);
    } catch (e) {
      setEditApiError(
        e instanceof SuppliersApiError
          ? e.message
          : "Could not update the supplier. Please try again.",
      );
    } finally {
      setEditSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete supplier
  // ---------------------------------------------------------------------------

  function openDelete(supplier: SupplierDto) {
    setDeletingSupplier(supplier);
    setDeleteSuccess(false);
    setDeleteError(null);
    setDeleteOpen(true);
  }

  function closeDelete() {
    if (deleting) return;

    setDeleteOpen(false);
    setDeletingSupplier(null);
    setDeleteError(null);
  }

  async function handleConfirmDelete() {
    if (!deletingSupplier || deleting) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      /*
       * DELETE /api/v1/purchasing/suppliers/{id}
       *
       * Backend can return:
       * 409 SUPPLIER_IN_USE
       */
      await deleteSupplier(deletingSupplier.id);

      setSuppliers((prev) =>
        prev.filter((supplier) => supplier.id !== deletingSupplier.id),
      );

      setDeleteSuccess(true);

      setTimeout(() => {
        setDeleteSuccess(false);
        setDeleteOpen(false);
        setDeletingSupplier(null);
      }, 700);
    } catch (e) {
      setDeleteError(
        e instanceof SuppliersApiError
          ? e.message
          : "Could not delete the supplier. Please try again.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <PageHeader
        title="Supplier Accounts Payable"
        subtitle="Purchasing → Accounts Payable"
        actions={
          <div className="flex items-center gap-2">
            {/*
             * Generate Report is currently UI-only.
             * Connect this after the real reporting endpoint is provided.
             */}
            <button
              type="button"
              className="rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/20 transition-colors"
            >
              Generate Report
            </button>

            {/*
             * RECORD PAYMENT TEMPORARILY DISABLED.
             *
             * There is no confirmed payment endpoint in suppliersApi.ts.
             *
             * <button ...>
             *   Record Payment
             * </button>
             */}

            <button
              type="button"
              onClick={() => setShowAddSupplier(true)}
              className="rounded-lg bg-[#49B0C1] border border-[#49B0C1] px-4 py-2 text-sm font-bold text-white hover:bg-[#3a9baf] transition-colors"
            >
              + Add Supplier
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {/* ---------------------------------------------------------------- */}
        {/* Stats                                                           */}
        {/* ---------------------------------------------------------------- */}

        <div className="bg-white px-4 sm:px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-[#DBEFF3]">
          {[
            {
              label: "Total Outstanding",
              value: fmtMoney(totalOutstanding),
              color: "text-red-500",
              icon: "💰",
            },
            {
              label: "Total Invoices",
              value: String(totalInvoices),
              color: "text-[#333333]",
              icon: "📄",
            },
            {
              label: "Suppliers",
              value: String(totalSuppliers),
              color: "text-[#333333]",
              icon: "🏢",
            },
            {
              label: "Active Suppliers",
              value: String(activeSuppliers),
              color: "text-green-600",
              icon: "✅",
            },
          ].map(({ label, value, color, icon }) => (
            <div
              key={label}
              className="bg-[#DBEFF3] rounded-xl p-4 flex items-center gap-3 border border-[#ABDBE3]/30 shadow-sm"
            >
              <span className="text-2xl flex-shrink-0" aria-hidden>
                {icon}
              </span>

              <div className="min-w-0">
                <p className="text-xs text-[#666666]">{label}</p>

                <p
                  className={`text-sm font-bold ${color} truncate`}
                >
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* API error                                                        */}
        {/* ---------------------------------------------------------------- */}

        {apiError && (
          <div className="mx-4 sm:mx-6 mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            ⚠ {apiError}
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Filters                                                          */}
        {/* ---------------------------------------------------------------- */}

        <div className="bg-[#DBEFF3] px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3 border-b border-[#ABDBE3]">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[#666666] uppercase tracking-wide">
              Supplier
            </span>

            <select
              value={suppFilter}
              onChange={(e) => {
                setSuppFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-[#ABDBE3] bg-white px-2 py-1.5 text-sm focus:border-[#49B0C1] focus:outline-none"
            >
              <option value="all">All Suppliers</option>

              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          {/*
           * STATUS FILTER COMMENTED OUT.
           *
           * The supplied supplier API does not provide a global invoice
           * endpoint with status filtering.
           *
           * <div>
           *   <span>Status</span>
           *   <select>...</select>
           * </div>
           */}

          <div className="flex flex-col gap-0.5 flex-1 min-w-[160px] max-w-xs">
            <span className="text-[10px] text-[#666666] uppercase tracking-wide">
              Search
            </span>

            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#666666]"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                  clipRule="evenodd"
                />
              </svg>

              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search suppliers..."
                className="w-full rounded-md border border-[#ABDBE3] bg-white pl-8 pr-3 py-1.5 text-sm focus:border-[#49B0C1] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Supplier table                                                   */}
        {/* ---------------------------------------------------------------- */}

        <div className="px-4 sm:px-6 py-4">
          <div className="rounded-xl border border-[#DBEFF3] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#ABDBE3]">
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
                      className="px-4 py-3 text-left font-semibold text-[#333333]"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr
                      key={i}
                      className={
                        i % 2 === 0
                          ? "bg-white"
                          : "bg-[#DBEFF3]/30"
                      }
                    >
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-[#ABDBE3]/40 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : pagedSuppliers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-[#666666]"
                    >
                      No suppliers found.
                    </td>
                  </tr>
                ) : (
                  pagedSuppliers.map((supplier, index) => (
                    <tr
                      key={supplier.id}
                      onClick={() => void openSupplierDetail(supplier)}
                      className={`cursor-pointer hover:bg-[#DBEFF3]/60 transition-colors ${index % 2 === 0
                          ? "bg-white"
                          : "bg-[#DBEFF3]/20"
                        }`}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-[#333333]">
                            {supplier.name}
                          </p>

                          <p className="text-[11px] text-[#666666] font-mono">
                            {supplier.id}
                          </p>
                        </div>
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
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${supplier.isActive
                              ? "bg-green-500 text-white"
                              : "bg-gray-400 text-white"
                            }`}
                        >
                          {supplier.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {/* View */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void openSupplierDetail(supplier);
                            }}
                            className="text-[#49B0C1] hover:text-[#3a9baf]"
                            title="View supplier"
                          >
                            <svg
                              className="h-4 w-4"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                              <path
                                fillRule="evenodd"
                                d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void openEdit(supplier);
                            }}
                            className="text-[#49B0C1] hover:text-[#3a9baf]"
                            title="Edit supplier"
                          >
                            <svg
                              className="h-4 w-4"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDelete(supplier);
                            }}
                            className="text-red-500 hover:text-red-700"
                            title="Delete supplier"
                          >
                            <svg
                              className="h-4 w-4"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && suppliers.length > 0 && (
            <div className="flex items-center justify-between mt-3 px-1">
              <p className="text-sm text-[#666666]">
                Showing{" "}
                {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, suppliers.length)}{" "}
                of {suppliers.length} suppliers
              </p>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((current) => current - 1)}
                  className="rounded-lg px-3 py-1.5 text-sm text-[#666666] border border-[#ABDBE3] hover:bg-[#DBEFF3] disabled:opacity-40 transition-colors"
                >
                  ← Prev
                </button>

                {Array.from(
                  { length: totalPages },
                  (_, index) => index + 1,
                ).map((pageNumber) => (
                  <button
                    type="button"
                    key={pageNumber}
                    onClick={() => setPage(pageNumber)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${pageNumber === page
                        ? "bg-[#49B0C1] text-white"
                        : "text-[#666666] border border-[#ABDBE3] hover:bg-[#DBEFF3]"
                      }`}
                  >
                    {pageNumber}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={page === totalPages}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-lg px-3 py-1.5 text-sm text-[#666666] border border-[#ABDBE3] hover:bg-[#DBEFF3] disabled:opacity-40 transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Record Payment - disabled                                        */}
        {/* ---------------------------------------------------------------- */}

        {/*
         * RECORD PAYMENT FORM COMMENTED OUT.
         *
         * Reason:
         * No payment endpoint was included in suppliersApi.ts.
         *
         * Once you provide the supplier invoice payment endpoint,
         * we can restore this section and connect it to the backend.
         */}


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

      {editOpen && (
        <EditSupplierModal
          form={editForm}
          errors={editErrors}
          success={editSuccess}
          saving={editSaving}
          error={editApiError}
          onChange={updateEditField}
          onSave={handleSaveEdit}
          onClose={closeEdit}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Delete Supplier                                                     */}
      {/* ------------------------------------------------------------------ */}

      {deleteOpen && (
        <DeleteSupplierModal
          supplier={deletingSupplier}
          success={deleteSuccess}
          deleting={deleting}
          error={deleteError}
          onConfirm={handleConfirmDelete}
          onClose={closeDelete}
        />
      )}
    </div>
  );
}

/* ========================================================================= */
/* Edit Supplier Modal                                                       */
/* ========================================================================= */

function EditSupplierModal({
  form,
  errors,
  success,
  saving,
  error,
  onChange,
  onSave,
  onClose,
}: {
  form: EditSupplierForm;
  errors: Record<string, string>;
  success: boolean;
  saving: boolean;
  error: string | null;
  onChange: <K extends keyof EditSupplierForm>(
    key: K,
    value: EditSupplierForm[K],
  ) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#DBEFF3] bg-[#ABDBE3] px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#333333]">
              Edit Supplier
            </h2>

            <p className="text-xs text-[#333333]/80">
              Update supplier information
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#333333] hover:bg-white/40 transition-colors"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            ⚠ {error}
          </div>
        )}

        {success && (
          <div className="mx-5 mt-4 rounded-lg border border-green-300 bg-green-50 px-4 py-2.5 text-sm text-green-700">
            ✅ Supplier updated successfully!
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-5 py-5">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-[#666666]">
              Supplier Name *
            </label>

            <input
              value={form.name}
              onChange={(e) => onChange("name", e.target.value)}
              placeholder="ABC Pharmaceuticals Ltd"
              className={`w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none ${errors.name
                  ? "border-red-400"
                  : "border-[#ABDBE3] focus:border-[#49B0C1]"
                }`}
            />

            {errors.name && (
              <p className="mt-1 text-xs text-red-500">
                {errors.name}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs text-[#666666]">
              Contact Person
            </label>

            <input
              value={form.contactPerson}
              onChange={(e) =>
                onChange("contactPerson", e.target.value)
              }
              placeholder="Jane Doe"
              className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-[#666666]">
              Email
            </label>

            <input
              type="email"
              value={form.email}
              onChange={(e) => onChange("email", e.target.value)}
              placeholder="jane@abc.com"
              className={`w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none ${errors.email
                  ? "border-red-400"
                  : "border-[#ABDBE3] focus:border-[#49B0C1]"
                }`}
            />

            {errors.email && (
              <p className="mt-1 text-xs text-red-500">
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs text-[#666666]">
              Phone
            </label>

            <input
              value={form.phone}
              onChange={(e) => onChange("phone", e.target.value)}
              placeholder="+251922345678"
              className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-[#666666]">
              Payment Terms
            </label>

            <select
              value={form.paymentTerms}
              onChange={(e) =>
                onChange("paymentTerms", e.target.value)
              }
              className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none"
            >
              <option value="">No terms specified</option>
              <option value="15 days">15 days</option>
              <option value="30 days">30 days</option>
              <option value="45 days">45 days</option>
              <option value="60 days">60 days</option>
              <option value="Cash on delivery">
                Cash on delivery
              </option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-[#666666]">
              Address
            </label>

            <input
              value={form.address}
              onChange={(e) =>
                onChange("address", e.target.value)
              }
              placeholder="Bole, Addis Ababa"
              className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2 flex items-center gap-2">
            <input
              id="editIsActive"
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                onChange("isActive", e.target.checked)
              }
              className="h-4 w-4 rounded border-[#ABDBE3] text-[#49B0C1] focus:ring-[#49B0C1]"
            />

            <label
              htmlFor="editIsActive"
              className="text-sm text-[#333333]"
            >
              Active supplier
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#DBEFF3] px-5 py-4 bg-white">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-[#ABDBE3] px-4 py-2 text-sm font-medium text-[#666666] hover:bg-[#DBEFF3] transition-colors disabled:opacity-40"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-[#49B0C1] px-5 py-2 text-sm font-bold text-white hover:bg-[#3a9baf] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "✓ Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* Delete Supplier Modal                                                     */
/* ========================================================================= */

function DeleteSupplierModal({
  supplier,
  success,
  deleting,
  error,
  onConfirm,
  onClose,
}: {
  supplier: SupplierDto | null;
  success: boolean;
  deleting: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-5 py-5">
          <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-5 w-5 text-red-600"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          <div className="min-w-0">
            <h3 className="text-lg font-bold text-[#333333]">
              Delete Supplier
            </h3>

            <p className="mt-1 text-sm text-[#666666]">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-[#333333]">
                {supplier?.name}
              </span>
              ?
            </p>

            <p className="mt-2 text-xs text-[#666666]">
              If this supplier has related purchase orders, invoices,
              or returns, the backend may reject the deletion.
            </p>
          </div>
        </div>

        {error && (
          <div className="mx-5 mb-3 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            ⚠ {error}
          </div>
        )}

        {success && (
          <div className="mx-5 mb-3 rounded-lg border border-green-300 bg-green-50 px-4 py-2.5 text-sm text-green-700">
            ✅ Supplier deleted successfully!
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-[#DBEFF3] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-lg border border-[#ABDBE3] px-4 py-2 text-sm font-medium text-[#666666] hover:bg-[#DBEFF3] transition-colors disabled:opacity-40"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting || success}
            className="rounded-lg bg-red-500 px-5 py-2 text-sm font-bold text-white hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {deleting ? "Deleting..." : "✓ Yes, Delete"}
          </button>
        </div>
      </div>
    </div>
  );
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
  data: SupplierDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-[#ABDBE3] px-5 py-4 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[#333333] truncate">
              {loading
                ? "Loading supplier..."
                : data?.name ?? "Supplier Detail"}
            </h2>

            <p className="text-xs text-[#333333]/80">
              Purchasing → Supplier Detail
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#333333] hover:bg-white/40 transition-colors"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 bg-[#FAFDFE]">
          {loading && (
            <div className="animate-pulse space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-20 rounded-xl bg-[#DBEFF3]"
                  />
                ))}
              </div>

              <div className="h-32 rounded-xl bg-[#DBEFF3]" />
              <div className="h-40 rounded-xl bg-[#DBEFF3]" />
            </div>
          )}

          {error && !loading && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
              ⚠ {error}
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
                    icon: "💰",
                  },
                  {
                    label: "Purchase Orders",
                    value: String(
                      data._count?.purchaseOrders ?? 0,
                    ),
                    color: "text-[#333333]",
                    icon: "📦",
                  },
                  {
                    label: "Invoices",
                    value: String(
                      data._count?.supplierInvoices ?? 0,
                    ),
                    color: "text-[#333333]",
                    icon: "📄",
                  },
                  {
                    label: "Returns",
                    value: String(
                      data._count?.purchaseReturns ?? 0,
                    ),
                    color: "text-[#333333]",
                    icon: "↩️",
                  },
                ].map(({ label, value, color, icon }) => (
                  <div
                    key={label}
                    className="bg-[#DBEFF3] rounded-xl p-4 flex items-center gap-3 border border-[#ABDBE3]/30"
                  >
                    <span
                      className="text-2xl flex-shrink-0"
                      aria-hidden
                    >
                      {icon}
                    </span>

                    <div className="min-w-0">
                      <p className="text-xs text-[#666666]">
                        {label}
                      </p>

                      <p
                        className={`text-sm font-bold ${color} truncate`}
                      >
                        {value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Supplier information */}
              <div className="rounded-xl border border-[#DBEFF3] bg-white overflow-hidden">
                <div className="bg-[#ABDBE3] px-5 py-3 flex items-center justify-between">
                  <h3 className="font-bold text-[#333333]">
                    Supplier Information
                  </h3>

                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${data.isActive
                        ? "bg-green-500 text-white"
                        : "bg-gray-400 text-white"
                      }`}
                  >
                    {data.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 px-5 py-5">
                  <InfoRow label="Supplier ID" value={data.id} mono />

                  <InfoRow
                    label="Contact Person"
                    value={data.contactPerson ?? "—"}
                  />

                  <InfoRow
                    label="Phone"
                    value={data.phone ?? "—"}
                  />

                  <InfoRow
                    label="Email"
                    value={data.email ?? "—"}
                  />

                  <InfoRow
                    label="Address"
                    value={data.address ?? "—"}
                  />

                  <InfoRow
                    label="Payment Terms"
                    value={data.paymentTerms ?? "—"}
                  />

                  <InfoRow
                    label="Created"
                    value={fmtDate(data.createdAt)}
                  />

                  <InfoRow
                    label="Last Updated"
                    value={fmtDate(data.updatedAt)}
                  />
                </div>
              </div>

              {/* Purchase Orders */}
              <div className="rounded-xl border border-[#DBEFF3] overflow-hidden">
                <div className="bg-[#ABDBE3] px-5 py-3 flex items-center justify-between">
                  <h3 className="font-bold text-[#333333]">
                    Purchase Orders
                  </h3>

                  <span className="text-xs text-[#333333]">
                    Showing{" "}
                    {(data.purchaseOrders ?? []).length} of{" "}
                    {data._count?.purchaseOrders ?? 0}
                  </span>
                </div>

                <table className="w-full text-sm bg-white">
                  <thead>
                    <tr className="bg-[#DBEFF3]/60">
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
                            i % 2 === 0
                              ? "bg-white"
                              : "bg-[#DBEFF3]/20"
                          }
                        >
                          <td className="px-5 py-3 font-medium text-[#49B0C1]">
                            {po.poNumber}
                          </td>

                          <td className="px-5 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${PO_BADGE[po.status] ??
                                "bg-gray-400 text-white"
                                }`}
                            >
                              {po.status}
                            </span>
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
              <div className="rounded-xl border border-[#DBEFF3] overflow-hidden">
                <div className="bg-[#ABDBE3] px-5 py-3 flex items-center justify-between">
                  <h3 className="font-bold text-[#333333]">
                    Supplier Invoices
                  </h3>

                  <span className="text-xs text-[#333333]">
                    Showing{" "}
                    {(data.supplierInvoices ?? []).length} of{" "}
                    {data._count?.supplierInvoices ?? 0}
                  </span>
                </div>

                <table className="w-full text-sm bg-white">
                  <thead>
                    <tr className="bg-[#DBEFF3]/60">
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
                            i % 2 === 0
                              ? "bg-white"
                              : "bg-[#DBEFF3]/20"
                          }
                        >
                          <td className="px-5 py-3 font-medium text-[#49B0C1]">
                            {invoice.invoiceNumber}
                          </td>

                          <td className="px-5 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${INV_BADGE[invoice.status] ??
                                "bg-gray-400 text-white"
                                }`}
                            >
                              {invoice.status.replace("_", " ")}
                            </span>
                          </td>

                          <td className="px-5 py-3 font-semibold text-[#333333]">
                            {fmtMoney(invoice.invoiceAmount)}
                          </td>

                          <td
                            className={`px-5 py-3 font-semibold ${invoice.outstandingBalance > 0
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
              <div className="rounded-xl border border-[#DBEFF3] bg-[#DBEFF3]/40 px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        <div className="flex items-center justify-end gap-2 border-t border-[#DBEFF3] px-5 py-3 bg-white flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#ABDBE3] px-4 py-2 text-sm font-medium text-[#666666] hover:bg-[#DBEFF3] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* Small helpers                                                             */
/* ========================================================================= */

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-[#666666]">
        {label}
      </p>

      <p
        className={`text-sm text-[#333333] ${mono ? "font-mono" : ""
          } break-all`}
      >
        {value}
      </p>
    </div>
  );
}

function SummaryCount({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="text-center sm:text-left">
      <p className="text-xs text-[#666666]">{label}</p>

      <p className="text-lg font-bold text-[#333333]">
        {value}
      </p>
    </div>
  );
}

//Main invoice listing → commented out, because your current supplier endpoint does not provide a global invoice-list endpoint.
//Record Payment → commented out, because you haven't provided a payment endpoint.
//Invoice date/due date/reference/paid fields → commented out, because SupplierInvoiceDto doesn't contain them.