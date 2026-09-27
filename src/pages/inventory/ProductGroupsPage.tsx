import { useCallback, useEffect, useRef, useState } from "react"
import { Search } from "lucide-react"
import {
  createProductGroup,
  deactivateProductGroup,
  getProductGroup,
  listProductGroups,
  updateProductGroup,
  ProductGroupsApiError,
  type ProductGroupDto,
  type ProductGroupListMeta,
} from "../../features/inventory/productGroupsApi"
import PageHeader from "../../components/ui/PageHeader"
import Button from "../../components/ui/Button"
import Pagination from "../../components/ui/Pagination"
import EmptyState from "../../components/ui/EmptyState"
import StatusChip from "../../components/ui/StatusChip"
import Modal from "../../components/ui/Modal"
import Input from "../../components/ui/Input"
import FormError from "../../components/ui/FormError"
import MetricCard from "../../components/ui/MetricCard"

const PAGE_LIMIT = 20

interface GroupForm {
  name: string
  description: string
  margin: string
  isActive: boolean
}

function emptyForm(): GroupForm {
  return { name: "", description: "", margin: "", isActive: true }
}

function formErrors(f: GroupForm) {
  const e: Partial<Record<keyof GroupForm, string>> = {}
  if (!f.name.trim()) e.name = "Name is required."
  if (
    !f.margin ||
    isNaN(Number(f.margin)) ||
    Number(f.margin) < 0 ||
    Number(f.margin) > 100
  )
    e.margin = "Enter a valid margin (0–100)."
  return e
}

function apiErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ProductGroupsApiError ? err.message : fallback
}

// ─────────────────────────────────────────────────────────────
// Toggle Switch
// ─────────────────────────────────────────────────────────────
function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#B6C8AF] focus:ring-offset-2 ${
          checked ? "bg-[#B6C8AF]" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      {label && (
        <span className="text-sm font-medium text-[#333333]">
          {checked ? "Active" : "Inactive"}
        </span>
      )}
    </div>
  )
}

export default function ProductGroupsPage() {
  // ── List state ──
  const [groups, setGroups] = useState<ProductGroupDto[]>([])
  const [meta, setMeta] = useState<ProductGroupListMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const requestSeq = useRef(0)

  // ── Modal state ──
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ProductGroupDto | null>(null)
  const [detailTarget, setDetailTarget] = useState<ProductGroupDto | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Confirm activate/deactivate target
  const [confirmTarget, setConfirmTarget] = useState<ProductGroupDto | null>(
    null,
  )

  // ── Form state ──
  const [form, setForm] = useState<GroupForm>(emptyForm())
  const [errors, setErrors] =
    useState<Partial<Record<keyof GroupForm, string>>>({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // ── Row action state ──
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // ── Load groups from the API (server-side search + pagination) ──
  const reload = useCallback(async (searchTerm: string, pageNum: number) => {
    const seq = ++requestSeq.current
    setLoading(true)
    setLoadError(null)
    try {
      const res = await listProductGroups({
        page: pageNum,
        limit: PAGE_LIMIT,
        search: searchTerm.trim() || undefined,
      })
      if (seq !== requestSeq.current) return
      setGroups(res.data)
      setMeta(res.meta)
    } catch (err) {
      if (seq !== requestSeq.current) return
      setLoadError(
        apiErrorMessage(
          err,
          "Failed to load product groups. Please try again.",
        ),
      )
    } finally {
      if (seq === requestSeq.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => void reload(search, page), search ? 300 : 0)
    return () => clearTimeout(t)
  }, [reload, search, page])

  // Reset to page 1 whenever the search query changes
  useEffect(() => {
    setPage(1)
  }, [search])

  function openAdd() {
    setEditTarget(null)
    setForm(emptyForm())
    setErrors({})
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(g: ProductGroupDto) {
    setEditTarget(g)
    setForm({
      name: g.name,
      description: g.description ?? "",
      margin: String(g.defaultProfitMargin ?? 0),
      isActive: g.isActive,
    })
    setErrors({})
    setFormError(null)
    setModalOpen(true)
  }

  // ── Detail: open with row data, then refetch the full record ──
  function openDetail(g: ProductGroupDto) {
    setDetailTarget(g)
    setDetailLoading(true)
    getProductGroup(g.id)
      .then((fresh) =>
        setDetailTarget((cur) => (cur?.id === fresh.id ? fresh : cur)),
      )
      .catch(() => {
        /* keep the row data if the refetch fails */
      })
      .finally(() => setDetailLoading(false))
  }

  async function handleSave() {
    const e = formErrors(form)
    if (Object.keys(e).length) {
      setErrors(e)
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (editTarget) {
        await updateProductGroup(editTarget.id, {
          name: form.name.trim(),
          description: form.description.trim() || null,
          defaultProfitMargin: Number(form.margin),
          isActive: form.isActive,
        })
      } else {
        await createProductGroup({
          name: form.name.trim(),
          description: form.description.trim() || null,
          defaultProfitMargin: Number(form.margin),
          isActive: form.isActive,
        })
      }
      setModalOpen(false)
      await reload(search, page)
    } catch (err) {
      setFormError(
        apiErrorMessage(
          err,
          editTarget
            ? "Could not save the group. Please try again."
            : "Could not create the group. Please try again.",
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  // ── Ask for confirmation (opens custom modal) ──
  function requestToggleActive(g: ProductGroupDto) {
    setConfirmTarget(g)
  }

  // ── Perform the actual toggle (called from confirm modal) ──
  async function confirmToggleActive() {
    const g = confirmTarget
    if (!g) return
    setTogglingId(g.id)
    setLoadError(null)
    try {
      if (g.isActive) {
        await deactivateProductGroup(g.id)
      } else {
        await updateProductGroup(g.id, { isActive: true })
      }
      setConfirmTarget(null)
      await reload(search, page)
    } catch (err) {
      setLoadError(
        apiErrorMessage(
          err,
          "Could not update the group status. Please try again.",
        ),
      )
      setConfirmTarget(null)
    } finally {
      setTogglingId(null)
    }
  }

  const avgMargin = groups.length
    ? (
        groups.reduce((s, g) => s + (g.defaultProfitMargin ?? 0), 0) /
        groups.length
      ).toFixed(1)
    : "—"

  const totalGroups = meta?.total ?? groups.length
  const totalPages = meta?.totalPages ?? 1

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Settings / Product Groups"
        title="Product Groups"
        subtitle="Manage product categories and profit margins."
        actions={<Button onClick={openAdd}>+ Add New Group</Button>}
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <MetricCard
            title="Total Groups"
            value={loading ? "—" : totalGroups}
            icon={<GroupIcon />}
          />
          <MetricCard
            title="Average Margin"
            value={loading ? "—" : `${avgMargin}%`}
            icon={<PercentIcon />}
          />
        </div>

        {/* Error banner */}
        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-center justify-between gap-3">
            <p className="text-sm text-red-700">{loadError}</p>
            <Button
              variant="secondary"
              onClick={() => void reload(search, page)}
              className="flex-shrink-0"
            >
              Retry
            </Button>
          </div>
        )}

        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
          {/* Toolbar: search + pagination info */}
          <div className="px-4 py-3 border-b border-[#E6ECE2] flex flex-wrap items-center justify-between gap-3">
            <div className="relative max-w-sm flex-1 min-w-[200px]">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#999]"
                aria-hidden
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by group name…"
                className="w-full rounded-lg border border-[#C6D4BF] bg-white pl-9 pr-9 py-2.5 text-sm text-[#333333] placeholder:text-[#999] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20 transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#333333]"
                >
                  ×
                </button>
              )}
            </div>

            {!loading && meta && (
              <span className="text-xs text-[#666666]">
                {totalGroups} group{totalGroups !== 1 ? "s" : ""} · Page{" "}
                {meta.page} of {totalPages}
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-6 space-y-3 animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-[#E6ECE2]" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <EmptyState
              title={
                search.trim() ? "No groups match your search" : "No groups yet"
              }
              description={
                search.trim()
                  ? "Try a different search term."
                  : "Create your first product group."
              }
              action={
                search.trim() ? undefined : (
                  <Button onClick={openAdd}>Add Group</Button>
                )
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#E6ECE2]">
                      {[
                        "Group Name",
                        "Description",
                        "# Items",
                        "Default Margin",
                        "Status",
                        "Actions",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left font-semibold text-[#333333]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g, i) => (
                      <tr
                        key={g.id}
                        onClick={() => openDetail(g)}
                        className={`cursor-pointer transition-colors ${
                          i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/30"
                        } hover:bg-[#C6D4BF]/30`}
                      >
                        <td className="px-4 py-3 font-semibold text-[#333333]">
                          {g.name}
                        </td>
                        <td className="px-4 py-3 text-[#666666] max-w-xs truncate">
                          {g.description ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-[#333333]">
                          {g._count?.products ?? 0}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#333333]">
                          {g.defaultProfitMargin}%
                        </td>
                        <td className="px-4 py-3">
                          <StatusChip
                            label={g.isActive ? "Active" : "Inactive"}
                            tone={g.isActive ? "green" : "gray"}
                          />
                        </td>
                        <td
                          className="px-4 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex gap-2">
                            <button
                              onClick={() => openEdit(g)}
                              disabled={togglingId === g.id}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#7A9076] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Edit"
                            >
                              <svg
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="h-3.5 w-3.5"
                                aria-hidden
                              >
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                              </svg>
                              Edit
                            </button>
                            <button
                              onClick={() => requestToggleActive(g)}
                              disabled={togglingId === g.id}
                              className={`text-xs font-semibold hover:underline disabled:opacity-50 disabled:cursor-not-allowed ${
                                g.isActive ? "text-red-500" : "text-green-600"
                              }`}
                              title={g.isActive ? "Deactivate" : "Activate"}
                            >
                              {togglingId === g.id ? (
                                "Saving…"
                              ) : g.isActive ? (
                                <>
                                  <svg
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    className="h-3.5 w-3.5"
                                    aria-hidden
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM8 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm3-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                      clipRule="evenodd"
                                    />
                                  </svg>{" "}
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <svg
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    className="h-3.5 w-3.5"
                                    aria-hidden
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z"
                                      clipRule="evenodd"
                                    />
                                  </svg>{" "}
                                  Activate
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination footer */}
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                total={totalGroups}
                pageSize={PAGE_LIMIT}
                itemLabel="groups"
              />
            </>
          )}
        </div>
      </div>

      {/* ─────────── Add / Edit Modal ─────────── */}
      <Modal
        open={modalOpen}
        title={editTarget ? "Edit Group" : "Add New Group"}
        onClose={() => setModalOpen(false)}
        size="md"
      >
        <div className="flex flex-col gap-4">
          <FormError message={formError} />

          <Input
            label="Group Name"
            value={form.name}
            onChange={(e) => {
              setForm((f) => ({ ...f, name: e.target.value }))
              setErrors((er) => ({ ...er, name: undefined }))
            }}
            error={errors.name}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#333333]">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={3}
              className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3.5 py-2.5 text-sm text-[#333333] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20 resize-none"
            />
          </div>

          <Input
            label="Profit Margin (%)"
            type="number"
            min={0}
            max={100}
            value={form.margin}
            onChange={(e) => {
              setForm((f) => ({ ...f, margin: e.target.value }))
              setErrors((er) => ({ ...er, margin: undefined }))
            }}
            error={errors.margin}
          />

          {/* Status toggle */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[#333333]">Status</label>
            <ToggleSwitch
              checked={form.isActive}
              onChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              label="Status"
            />
          </div>

          <div className="flex gap-3 justify-end mt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editTarget ? "Save Changes" : "Create Group"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─────────── Detail Modal ─────────── */}
      <Modal
        open={!!detailTarget}
        title="Group Details"
        onClose={() => setDetailTarget(null)}
        size="md"
      >
        {detailTarget && (
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-lg font-bold text-[#333333]">
                {detailTarget.name}
              </h3>
              <div className="mt-2">
                <StatusChip
                  label={detailTarget.isActive ? "Active" : "Inactive"}
                  tone={detailTarget.isActive ? "green" : "gray"}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="col-span-2">
                <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide">
                  Description
                </p>
                <p className="text-[#333333] mt-1">
                  {detailTarget.description || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide">
                  Default Profit Margin
                </p>
                <p className="text-[#333333] mt-1 font-semibold">
                  {detailTarget.defaultProfitMargin}%
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide">
                  # Products
                </p>
                <p className="text-[#333333] mt-1">
                  {detailLoading
                    ? "…"
                    : (detailTarget.products?.length ??
                      detailTarget._count?.products ??
                      0)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide">
                  Created At
                </p>
                <p className="text-[#333333] mt-1">
                  {detailTarget.createdAt
                    ? new Date(detailTarget.createdAt).toLocaleString()
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide">
                  Updated At
                </p>
                <p className="text-[#333333] mt-1">
                  {detailTarget.updatedAt
                    ? new Date(detailTarget.updatedAt).toLocaleString()
                    : "—"}
                </p>
              </div>
            </div>

            {/* Products under this group (from GET /{id}) */}
            <div className="rounded-xl bg-[#E6ECE2] p-4">
              <p className="text-xs font-semibold text-[#7A9076] uppercase tracking-wide mb-2">
                Products in Group (
                {detailTarget.products?.length ??
                  detailTarget._count?.products ??
                  0}
                )
              </p>
              {detailLoading ? (
                <p className="text-sm text-[#666666]">Loading products…</p>
              ) : !detailTarget.products?.length ? (
                <p className="text-sm text-[#666666]">
                  No products assigned to this group yet.
                </p>
              ) : (
                detailTarget.products.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between py-1.5 border-b border-white/60 last:border-0"
                  >
                    <span className="text-sm text-[#333333]">
                      {p.name ?? p.id}
                    </span>
                    {p.sku && (
                      <span className="text-xs text-[#666666] font-mono">
                        {p.sku}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-3 justify-end mt-2">
              <Button variant="secondary" onClick={() => setDetailTarget(null)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  const g = detailTarget
                  setDetailTarget(null)
                  openEdit(g)
                }}
              >
                Edit Group
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─────────── Confirm Activate / Deactivate Modal ─────────── */}
      <Modal
        open={!!confirmTarget}
        title={
          confirmTarget?.isActive ? "Deactivate Group" : "Reactivate Group"
        }
        onClose={() => {
          if (togglingId) return // block close while saving
          setConfirmTarget(null)
        }}
        size="sm"
      >
        {confirmTarget && (
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  confirmTarget.isActive
                    ? "bg-amber-500 text-white"
                    : "bg-green-100 text-green-600"
                }`}
              >
                {confirmTarget.isActive ? (
                  // warning icon
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                    />
                  </svg>
                ) : (
                  // check icon
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>

              <div className="flex-1">
                <p className="text-sm font-semibold text-[#333333]">
                  {confirmTarget.isActive ? (
                    <>Deactivate “{confirmTarget.name}”?</>
                  ) : (
                    <>Reactivate “{confirmTarget.name}”?</>
                  )}
                </p>
                <p className="text-sm text-[#666666] mt-1">
                  {confirmTarget.isActive ? (
                    <>
                      This group will be hidden from new product assignments.
                      Existing products will keep their current group. You can
                      reactivate it anytime.
                    </>
                  ) : (
                    <>
                      This group will become available again for new product
                      assignments.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                onClick={() => setConfirmTarget(null)}
                disabled={togglingId === confirmTarget.id}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void confirmToggleActive()}
                loading={togglingId === confirmTarget.id}
              >
                {confirmTarget.isActive ? "Yes, Deactivate" : "Yes, Reactivate"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function GroupIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z"
      />
    </svg>
  )
}

function PercentIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z"
      />
    </svg>
  )
}
