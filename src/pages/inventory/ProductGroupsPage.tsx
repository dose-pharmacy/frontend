import { useEffect, useState } from "react";
import { getGroups, getProducts } from "../../features/inventory/inventoryService";
import type { ProductGroup, Product } from "../../features/inventory/inventoryMock";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import FormError from "../../components/ui/FormError";
import MetricCard from "../../components/ui/MetricCard";

interface GroupForm {
  name: string;
  description: string;
  margin: string;
}

function emptyForm(): GroupForm { return { name: "", description: "", margin: "" }; }
function formErrors(f: GroupForm) {
  const e: Partial<GroupForm> = {};
  if (!f.name.trim()) e.name = "Name is required.";
  if (!f.margin || isNaN(Number(f.margin)) || Number(f.margin) < 0 || Number(f.margin) > 100) e.margin = "Enter a valid margin (0–100).";
  return e;
}

export default function ProductGroupsPage() {
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductGroup | null>(null);
  const [form, setForm] = useState<GroupForm>(emptyForm());
  const [errors, setErrors] = useState<Partial<GroupForm>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getGroups(), getProducts()]).then(([g, p]) => {
      setGroups(g); setProducts(p); setLoading(false);
    });
  }, []);

  function openAdd() { setEditTarget(null); setForm(emptyForm()); setErrors({}); setFormError(null); setModalOpen(true); }
  function openEdit(g: ProductGroup) { setEditTarget(g); setForm({ name: g.name, description: g.description, margin: String(g.margin) }); setErrors({}); setFormError(null); setModalOpen(true); }

  async function handleSave() {
    const e = formErrors(form);
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    setModalOpen(false);
    // In mock mode, just show an alert; real implementation will call API
    alert(editTarget ? "Group updated (mock)." : "Group created (mock).");
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this group?")) return;
    setGroups((prev) => prev.filter((g) => g.id !== id));
  }

  const avgMargin = groups.length ? (groups.reduce((s, g) => s + g.margin, 0) / groups.length).toFixed(1) : "—";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader breadcrumb="Settings / Product Groups" title="Product Groups" subtitle="Manage product categories and profit margins." actions={
        <Button onClick={openAdd}>+ Add New Group</Button>
      } />

      <div className="p-6 flex flex-col gap-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <MetricCard title="Total Groups" value={groups.length} icon={<GroupIcon />} />
          <MetricCard title="Average Margin" value={`${avgMargin}%`} icon={<PercentIcon />} />
        </div>

        <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3 animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-[#DBEFF3]" />)}</div>
          ) : groups.length === 0 ? (
            <EmptyState title="No groups yet" description="Create your first product group." action={<Button onClick={openAdd}>Add Group</Button>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#DBEFF3]">
                    {["Group Name", "Description", "# Items", "Default Margin", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-[#333333]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g, i) => (
                    <tr key={g.id} className={`transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/30"} hover:bg-[#ABDBE3]/20`}>
                      <td className="px-4 py-3 font-semibold text-[#333333]">{g.name}</td>
                      <td className="px-4 py-3 text-[#666666] max-w-xs truncate">{g.description}</td>
                      <td className="px-4 py-3 text-[#333333]">{g.productIds.length}</td>
                      <td className="px-4 py-3 font-semibold text-[#333333]">{g.margin}%</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(g)} className="text-xs font-semibold text-[#49B0C1] hover:underline" title="Edit">✏️ Edit</button>
                          <button onClick={() => handleDelete(g.id)} className="text-xs font-semibold text-red-500 hover:underline" title="Delete">🗑️ Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit/Add Modal */}
      <Modal open={modalOpen} title={editTarget ? "Edit Group" : "Add New Group"} onClose={() => setModalOpen(false)} size="md">
        <div className="flex flex-col gap-4">
          <FormError message={formError} />
          <Input label="Group Name" value={form.name} onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setErrors((er) => ({ ...er, name: undefined })); }} error={errors.name} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#333333]">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3.5 py-2.5 text-sm text-[#333333] focus:border-[#49B0C1] focus:outline-none focus:ring-2 focus:ring-[#49B0C1]/20 resize-none"
            />
          </div>
          <Input label="Profit Margin (%)" type="number" min={0} max={100} value={form.margin} onChange={(e) => { setForm((f) => ({ ...f, margin: e.target.value })); setErrors((er) => ({ ...er, margin: undefined })); }} error={errors.margin} />

          {editTarget && (
            <div className="rounded-xl bg-[#DBEFF3] p-4">
              <p className="text-xs font-semibold text-[#49B0C1] uppercase tracking-wide mb-2">Products in Group ({editTarget.productIds.length})</p>
              {editTarget.productIds.map((pid) => {
                const p = products.find((x) => x.id === pid);
                return p ? (
                  <div key={pid} className="flex items-center justify-between py-1.5 border-b border-white/60 last:border-0">
                    <span className="text-sm text-[#333333]">{p.name}</span>
                    <button className="text-xs text-red-500 hover:underline" onClick={() => alert("Remove product — backend pending")}>Remove</button>
                  </div>
                ) : null;
              })}
              <button className="mt-3 text-xs font-semibold text-[#49B0C1] hover:underline" onClick={() => alert("Add products — backend pending")}>+ Add Products</button>
            </div>
          )}

          <div className="flex gap-3 justify-end mt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>Save Changes</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function GroupIcon() { return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z"/></svg>; }
function PercentIcon() { return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z"/></svg>; }
