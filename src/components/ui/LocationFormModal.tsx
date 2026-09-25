import { useEffect, useState } from "react"
import {
  createLocation,
  updateLocation,
  LocationsApiError,
  type LocationDto,
} from "../../features/inventory/locationsApi"
import Modal from "./Modal"
import Input from "./Input"
import FormError from "./FormError"
import Button from "./Button"

// ─────────────────────────────────────────────────────────────
// Toggle switch — used inside the Add/Edit location form
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

// ─────────────────────────────────────────────────────────────
// Add / Edit location form types
// ─────────────────────────────────────────────────────────────
interface LocationForm {
  name: string
  description: string
  isActive: boolean
}

function emptyForm(): LocationForm {
  return { name: "", description: "", isActive: true }
}

function formErrors(f: LocationForm) {
  const e: Partial<Record<keyof LocationForm, string>> = {}
  if (!f.name.trim()) e.name = "Name is required."
  return e
}

function apiErrorMessage(err: unknown, fallback: string): string {
  return err instanceof LocationsApiError ? err.message : fallback
}

// ─────────────────────────────────────────────────────────────
// Reusable Add/Edit Location modal.
// Used by Settings > Locations and the Add Stock form.
// ─────────────────────────────────────────────────────────────
interface LocationFormModalProps {
  open: boolean
  /** "add" creates a new location; "edit" updates `location`. */
  mode: "add" | "edit"
  /** The location being edited when mode === "edit". */
  location?: LocationDto | null
  onClose: () => void
  /** Called after a successful save with the saved location. */
  onSaved?: (location: LocationDto) => void | Promise<void>
}

export default function LocationFormModal({
  open,
  mode,
  location,
  onClose,
  onSaved,
}: LocationFormModalProps) {
  const [form, setForm] = useState<LocationForm>(emptyForm())
  const [errors, setErrors] = useState<
    Partial<Record<keyof LocationForm, string>>
  >({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Reset the form whenever the modal opens (mode/location are snapshotted
  // at that moment on purpose).
  useEffect(() => {
    if (!open) return
    setForm(
      mode === "edit" && location
        ? {
            name: location.name,
            description: location.description ?? "",
            isActive: location.isActive,
          }
        : emptyForm(),
    )
    setErrors({})
    setFormError(null)
    setSaving(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function close() {
    if (saving) return
    onClose()
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
      const saved =
        mode === "edit" && location
          ? await updateLocation(location.id, {
              name: form.name.trim(),
              description: form.description.trim() || null,
              isActive: form.isActive,
            })
          : await createLocation({
              name: form.name.trim(),
              description: form.description.trim() || null,
              isActive: form.isActive,
            })
      await onSaved?.(saved)
      onClose()
    } catch (err) {
      setFormError(
        apiErrorMessage(
          err,
          location
            ? "Could not save the location. Please try again."
            : "Could not create the location. Please try again.",
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={mode === "edit" ? "Edit Location" : "Add Location"}
      onClose={close}
      size="sm"
    >
      <div className="flex flex-col gap-4">
        <FormError message={formError} />

        <Input
          label="Name"
          value={form.name}
          onChange={(e) => {
            setForm((f) => ({ ...f, name: e.target.value }))
            setErrors((er) => ({ ...er, name: undefined }))
          }}
          error={errors.name}
          placeholder="e.g. Main Store"
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
            placeholder="Short description of this location"
            className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3.5 py-2.5 text-sm text-[#333333] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20 resize-none"
          />
        </div>

        {/* Status toggle */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-[#333333]">Status</label>
          <ToggleSwitch
            checked={form.isActive}
            onChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
            label="Active"
          />
          <p className="text-xs text-[#666666]">
            {form.isActive
              ? "Location is active and available for stock."
              : "Location will be marked inactive."}
          </p>
        </div>

        <div className="flex gap-3 justify-end mt-2">
          <Button variant="secondary" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} loading={saving}>
            {mode === "edit" ? "Save Changes" : "Create Location"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}