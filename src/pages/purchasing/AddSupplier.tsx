import { useState } from "react";
import { Check } from "lucide-react";
import {
  createSupplier,
  SuppliersApiError,
  type SupplierDto,
} from "../../features/purchasing/suppliersApi";

interface AddSupplierProps {
  open: boolean;
  onClose: () => void;
  /** Called with the created supplier (from POST /purchasing/suppliers) after a successful save. */
  onCreated?: (supplier: SupplierDto) => void;
}

const EMPTY_FORM = {
  name: "",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
  paymentTerms: "30 days",
  isActive: true,
};



export default function AddSupplier({ open, onClose, onCreated }: AddSupplierProps) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!open) return null;

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (!form.email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Invalid email";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave() {
    if (!validate() || saving) return;

    setSaving(true);
    setApiError(null);
    try {
      // POST /api/v1/purchasing/suppliers — only `name` is required server-side.
      const created = await createSupplier({
        name: form.name.trim(),
        contactPerson: form.contactPerson.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        paymentTerms: form.paymentTerms || null,
        isActive: form.isActive,
      });
      setSuccess(true);
      onCreated?.(created);
      setTimeout(() => {
        setSuccess(false);
        setForm({ ...EMPTY_FORM });
        onClose();
      }, 900);
    } catch (e) {
      setApiError(
        e instanceof SuppliersApiError
          ? e.message
          : "Could not create the supplier. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (saving) return;
    setForm({ ...EMPTY_FORM });
    setErrors({});
    setApiError(null);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E6ECE2] px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#333333]">Add Supplier</h2>
            <p className="text-xs text-[#666666]">Create a new supplier record</p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-[#666666] hover:bg-[#E6ECE2] transition-colors"
            aria-label="Close"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Error banner */}
        {apiError && (
          <div className="mx-5 mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-700 flex items-start gap-2">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden>
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
            </svg>
            <span>{apiError}</span>
          </div>
        )}

        {/* Success banner */}
        {success && (
          <div className="mx-5 mt-4 rounded-lg border border-green-300 bg-green-50 px-4 py-2.5 text-sm text-green-700 flex items-start gap-2">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden>
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd"/>
            </svg>
            <span>Supplier added successfully!</span>
          </div>
        )}

        {/* Body */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-5 py-5">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-[#666666]">Supplier Name *</label>
            <input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="ABC Pharmaceuticals"
              className={`w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none ${
                errors.name ? "border-red-400" : "border-[#C6D4BF] focus:border-[#B6C8AF]"
              }`}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          <div>
            <label className="mb-1 block text-xs text-[#666666]">Contact Person *</label>
            <input
              value={form.contactPerson}
              onChange={(e) => update("contactPerson", e.target.value)}
              placeholder="John Doe"
              className={`w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none ${
                errors.contactPerson ? "border-red-400" : "border-[#C6D4BF] focus:border-[#B6C8AF]"
              }`}
            />
            {errors.contactPerson && <p className="mt-1 text-xs text-red-500">{errors.contactPerson}</p>}
          </div>

          <div>
            <label className="mb-1 block text-xs text-[#666666]">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="john@abc.com"
              className={`w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none ${
                errors.email ? "border-red-400" : "border-[#C6D4BF] focus:border-[#B6C8AF]"
              }`}
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
          </div>

          <div>
            <label className="mb-1 block text-xs text-[#666666]">Phone *</label>
            <input
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="+251911234567"
              className={`w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none ${
                errors.phone ? "border-red-400" : "border-[#C6D4BF] focus:border-[#B6C8AF]"
              }`}
            />
            {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
          </div>

          <div>
            <label className="mb-1 block text-xs text-[#666666]">Payment Terms</label>
            <select
              value={form.paymentTerms}
              onChange={(e) => update("paymentTerms", e.target.value)}
              className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3 py-2 text-sm focus:border-[#B6C8AF] focus:outline-none"
            >
              <option>15 days</option>
              <option>30 days</option>
              <option>45 days</option>
              <option>60 days</option>
              <option>Cash on delivery</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-[#666666]">Address</label>
            <input
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder="Addis Ababa"
              className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3 py-2 text-sm focus:border-[#B6C8AF] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2 flex items-center gap-2">
            <input
              id="isActive"
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => update("isActive", e.target.checked)}
              className="h-4 w-4 rounded border-[#C6D4BF] text-[#7A9076] focus:ring-[#B6C8AF]"
            />
            <label htmlFor="isActive" className="text-sm text-[#333333]">
              Active supplier
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[#E6ECE2] px-5 py-4">
          <button
            onClick={handleClose}
            className="rounded-lg border border-[#C6D4BF] px-4 py-2 text-sm font-medium text-[#666666] hover:bg-[#E6ECE2] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-[#B6C8AF] px-5 py-2 text-sm font-bold text-[#333333] hover:bg-[#A0B59C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : (<span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4" /> Save Supplier</span>)}
          </button>
        </div>
      </div>
    </div>
  );
}