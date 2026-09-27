import { useEffect, useState } from "react";
import {
  createUnit,
  updateUnit,
  UnitsApiError,
  type UnitDto,
} from "../../features/inventory/unitsApi";
import Modal from "./Modal";
import Button from "./Button";

// ─────────────────────────────────────────────────────────────
// Form types (matches Settings > Units)
// ─────────────────────────────────────────────────────────────
type UnitFormData = {
  name: string;
  symbol: string;
  description: string;
  isActive: boolean;
};

const emptyForm: UnitFormData = {
  name: "",
  symbol: "",
  description: "",
  isActive: true,
};

function apiErrorMessage(err: unknown, fallback: string): string {
  return err instanceof UnitsApiError ? err.message : fallback;
}

// ─────────────────────────────────────────────────────────────
// Toggle Switch (matches Settings > Units)
// ─────────────────────────────────────────────────────────────
function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
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
      <span className="text-sm font-medium text-[#333333]">
        {checked ? "Active" : "Inactive"}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Reusable Add / Edit Unit modal.
// Used by Settings > Units and the Add Product form.
// ─────────────────────────────────────────────────────────────
interface UnitFormModalProps {
  open: boolean;
  /** The unit being edited, or null/undefined to create a new unit. */
  unit?: UnitDto | null;
  onClose: () => void;
  /** Called after a successful create/update with the saved unit. */
  onSaved?: (unit: UnitDto) => void | Promise<void>;
}

export default function UnitFormModal({
  open,
  unit,
  onClose,
  onSaved,
}: UnitFormModalProps) {
  const editing = !!unit;

  const [form, setForm] = useState<UnitFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Reset the form whenever the modal opens for a (new) target.
  useEffect(() => {
    if (!open) return;
    if (unit) {
      setForm({
        name: unit.name,
        symbol: unit.symbol,
        description: unit.description ?? "",
        isActive: unit.isActive,
      });
    } else {
      setForm(emptyForm);
    }
    setActionError(null);
    setSaving(false);
  }, [open, unit]);

  function close() {
    if (saving) return;
    onClose();
  }

  async function handleSubmit() {
    if (!form.name.trim() || !form.symbol.trim()) return;
    setSaving(true);
    setActionError(null);
    try {
      const saved = editing
        ? await updateUnit(unit!.id, {
            name: form.name,
            symbol: form.symbol,
            description: form.description.trim() || null,
            isActive: form.isActive,
          })
        : await createUnit({
            name: form.name,
            symbol: form.symbol,
            description: form.description.trim() || null,
            isActive: form.isActive,
          });
      await onSaved?.(saved);
      onClose();
    } catch (err) {
      setActionError(
        apiErrorMessage(
          err,
          editing
            ? "Could not save the unit. Please try again."
            : "Could not create the unit. Please try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = !!(form.name.trim() && form.symbol.trim());

  return (
    <Modal
      open={open}
      title={editing ? `Edit Unit — ${unit?.name ?? ""}` : "Add Unit"}
      onClose={close}
      size="md"
    >
      {actionError && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      )}

      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-semibold text-[#333333] mb-1">
            Unit Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Kilogram"
            className="w-full rounded-lg border border-[#E6ECE2] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#333333] mb-1">
            Symbol <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.symbol}
            onChange={(e) => setForm({ ...form, symbol: e.target.value })}
            placeholder="e.g. kg"
            className="w-full rounded-lg border border-[#E6ECE2] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#333333] mb-1">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Optional description for this unit..."
            rows={3}
            className="w-full rounded-lg border border-[#E6ECE2] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B6C8AF] resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#333333] mb-2">
            Status
          </label>
          <ToggleSwitch
            checked={form.isActive}
            onChange={(v) => setForm({ ...form, isActive: v })}
          />
        </div>

        <div className="flex gap-3 justify-end mt-2">
          <Button variant="secondary" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            loading={saving}
            disabled={!canSubmit}
          >
            {editing ? "Save Changes" : "Create Unit"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}