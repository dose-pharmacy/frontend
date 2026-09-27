import { useEffect, useState } from "react";
import {
  createProductGroup,
  updateProductGroup,
  ProductGroupsApiError,
  type ProductGroupDto,
} from "../../features/inventory/productGroupsApi";
import Modal from "./Modal";
import Input from "./Input";
import Button from "./Button";
import FormError from "./FormError";

// ─────────────────────────────────────────────────────────────
// Form types
// ─────────────────────────────────────────────────────────────

interface GroupForm {
  name: string;
  description: string;
  margin: string;
  isActive: boolean;
}

function emptyForm(): GroupForm {
  return { name: "", description: "", margin: "", isActive: true };
}

function formErrors(f: GroupForm) {
  const e: Partial<Record<keyof GroupForm, string>> = {};
  if (!f.name.trim()) e.name = "Name is required.";
  if (
    !f.margin ||
    isNaN(Number(f.margin)) ||
    Number(f.margin) < 0 ||
    Number(f.margin) > 100
  )
    e.margin = "Enter a valid margin (0\u2013100).";
  return e;
}

function apiErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ProductGroupsApiError ? err.message : fallback;
}

// ─────────────────────────────────────────────────────────────
// Toggle Switch (matches the Settings > Product Groups modal)
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
// Reusable Add / Edit Product Group modal.
// Used by Settings > Product Groups and the Add Product form.
// ─────────────────────────────────────────────────────────────
interface ProductGroupFormModalProps {
  open: boolean;
  /** The group being edited, or null/undefined to create a new group. */
  group?: ProductGroupDto | null;
  onClose: () => void;
  /** Called after a successful create/update with the saved group. */
  onSaved?: (group: ProductGroupDto) => void | Promise<void>;
}

export default function ProductGroupFormModal({
  open,
  group,
  onClose,
  onSaved,
}: ProductGroupFormModalProps) {
  const editing = !!group;

  const [form, setForm] = useState<GroupForm>(emptyForm());
  const [errors, setErrors] = useState<Partial<Record<keyof GroupForm, string>>>(
    {},
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Reset the form whenever the modal opens for a (new) target.
  useEffect(() => {
    if (!open) return;
    if (group) {
      setForm({
        name: group.name,
        description: group.description ?? "",
        margin: String(group.defaultProfitMargin ?? 0),
        isActive: group.isActive,
      });
    } else {
      setForm(emptyForm());
    }
    setErrors({});
    setFormError(null);
    setSaving(false);
  }, [open, group]);

  function close() {
    if (saving) return;
    onClose();
  }

  async function handleSave() {
    const e = formErrors(form);
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const saved = editing
        ? await updateProductGroup(group!.id, {
            name: form.name.trim(),
            description: form.description.trim() || null,
            defaultProfitMargin: Number(form.margin),
            isActive: form.isActive,
          })
        : await createProductGroup({
            name: form.name.trim(),
            description: form.description.trim() || null,
            defaultProfitMargin: Number(form.margin),
            isActive: form.isActive,
          });
      await onSaved?.(saved);
      onClose();
    } catch (err) {
      setFormError(
        apiErrorMessage(
          err,
          editing
            ? "Could not save the group. Please try again."
            : "Could not create the group. Please try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title={editing ? "Edit Group" : "Add New Group"}
      onClose={close}
      size="md"
    >
      <div className="flex flex-col gap-4">
        <FormError message={formError} />

        <Input
          label="Group Name"
          value={form.name}
          onChange={(e) => {
            setForm((f) => ({ ...f, name: e.target.value }));
            setErrors((er) => ({ ...er, name: undefined }));
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
            setForm((f) => ({ ...f, margin: e.target.value }));
            setErrors((er) => ({ ...er, margin: undefined }));
          }}
          error={errors.margin}
        />

        {/* Status toggle */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-[#333333]">Status</label>
          <ToggleSwitch
            checked={form.isActive}
            onChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
          />
        </div>

        <div className="flex gap-3 justify-end mt-2">
          <Button variant="secondary" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} loading={saving}>
            {editing ? "Save Changes" : "Create Group"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}