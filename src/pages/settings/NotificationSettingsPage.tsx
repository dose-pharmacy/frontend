// ── Notification settings page (/settings/notifications) ──────────────────────
// Lives under the app's existing Settings area. Loads/saves the backend's
// notification preferences and (for ADMIN users only) exposes the manual
// scheduler runs that the backend documents as admin operations.

import { useEffect, useRef, useState } from "react";
import PageHeader from "../../components/ui/PageHeader";
import { useAuth } from "../../features/auth/AuthContext";
import { useNotifications } from "../../features/notifications/NotificationsContext";
import {
  NotificationsApiError,
  runPaymentReminders,
  runExpiryAlerts,
  type NotificationSettingsDto,
  type SchedulerRunResultDto,
} from "../../features/notifications/notificationsApi";

type SettingsForm = Omit<NotificationSettingsDto, "createdAt" | "updatedAt">;

const EMPTY_FORM: SettingsForm = {
  paymentRemindersEnabled: false,
  remindBeforeDueDays: 0,
  remindOnDueDate: false,
  remindWhenOverdue: false,
  expiryAlertsEnabled: false,
  alertWithin6Months: false,
  alertWithin1Year: false,
};

function normalizeSettings(s: NotificationSettingsDto): SettingsForm {
  return {
    paymentRemindersEnabled: Boolean(s.paymentRemindersEnabled),
    remindBeforeDueDays:
      typeof s.remindBeforeDueDays === "number" && s.remindBeforeDueDays >= 0
        ? s.remindBeforeDueDays
        : 0,
    remindOnDueDate: Boolean(s.remindOnDueDate),
    remindWhenOverdue: Boolean(s.remindWhenOverdue),
    expiryAlertsEnabled: Boolean(s.expiryAlertsEnabled),
    alertWithin6Months: Boolean(s.alertWithin6Months),
    alertWithin1Year: Boolean(s.alertWithin1Year),
  };
}

// Toggle switch styled consistently with the app's other settings controls.
function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm text-[#333333]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#B6C8AF] focus:ring-offset-2 ${
          checked ? "bg-[#B6C8AF]" : "bg-gray-300"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        aria-label={label}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

export default function NotificationSettingsPage() {
  const { user } = useAuth();
  const { settings, settingsLoading, loadSettings, saveSettings } = useNotifications();
  const isAdmin = user?.role === "ADMIN";

  const [form, setForm] = useState<SettingsForm>(EMPTY_FORM);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [reminderRun, setReminderRun] = useState<{
    running: boolean;
    result: SchedulerRunResultDto | null;
    error: string;
  }>({ running: false, result: null, error: "" });
  const [expiryRun, setExpiryRun] = useState<{
    running: boolean;
    result: SchedulerRunResultDto | null;
    error: string;
  }>({ running: false, result: null, error: "" });

  const initializedRef = useRef(false);

  async function handleLoad() {
    setLoadError("");
    try {
      await loadSettings();
    } catch (e) {
      setLoadError(
        e instanceof NotificationsApiError
          ? e.message
          : "Unable to load notification settings.",
      );
    }
  }

  // Load once on mount, then keep the form in sync with the returned data.
  useEffect(() => {
    void handleLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (settings && !initializedRef.current) {
      setForm(normalizeSettings(settings));
      initializedRef.current = true;
    }
  }, [settings]);

  async function handleSave() {
    setSaveError("");
    setSaveMsg("");
    setSaving(true);
    try {
      const updated = await saveSettings({ ...form });
      // Adopt whatever the backend actually returned.
      setForm(normalizeSettings(updated));
      setSaveMsg("Notification settings saved.");
    } catch (e) {
      setSaveError(
        e instanceof NotificationsApiError
          ? e.message
          : "Unable to save notification settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  function setField<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleRunReminders() {
    setReminderRun((r) => ({ ...r, running: true, error: "", result: null }));
    try {
      const result = await runPaymentReminders();
      setReminderRun((r) => ({ ...r, running: false, result }));
    } catch (e) {
      setReminderRun((r) => ({
        ...r,
        running: false,
        error: e instanceof NotificationsApiError ? e.message : "The reminder check failed.",
      }));
    }
  }

  async function handleRunExpiry() {
    setExpiryRun((r) => ({ ...r, running: true, error: "", result: null }));
    try {
      const result = await runExpiryAlerts();
      setExpiryRun((r) => ({ ...r, running: false, result }));
    } catch (e) {
      setExpiryRun((r) => ({
        ...r,
        running: false,
        error: e instanceof NotificationsApiError ? e.message : "The expiry alert check failed.",
      }));
    }
  }

  return (
    <div className="min-h-full">
      <PageHeader
        breadcrumb="Settings / Notifications"
        title="Notification Settings"
        subtitle="Control payment reminders and expiry alerts"
        actions={
          <button
            onClick={() => void handleLoad()}
            disabled={settingsLoading}
            className="rounded-lg bg-[#E6ECE2] hover:bg-[#C6D4BF] disabled:opacity-50 transition-colors px-3 py-1.5 text-xs font-semibold text-[#333333]"
          >
            {settingsLoading ? "Loading…" : "Reload"}
          </button>
        }
      />

      <div className="mx-auto max-w-2xl px-6 py-5 space-y-5">
        {loadError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {loadError}
            <button onClick={() => void handleLoad()} className="ml-2 font-semibold underline">
              Retry
            </button>
          </div>
        )}

        {/* Payment reminders */}
        <section className="rounded-xl border border-[#E6ECE2] bg-white">
          <header className="border-b border-[#E6ECE2] px-4 py-3">
            <h2 className="text-sm font-bold text-[#333333]">Payment Reminders</h2>
            <p className="text-xs text-[#666666] mt-0.5">
              Alerts about supplier invoice payments approaching due date, due today, or overdue.
            </p>
          </header>
          <div className="divide-y divide-[#E6ECE2] px-4">
            <Toggle
              label="Payment reminders enabled"
              checked={form.paymentRemindersEnabled}
              onChange={(v) => setField("paymentRemindersEnabled", v)}
            />
            <div className="flex items-center justify-between gap-4 py-3">
              <span className="text-sm text-[#333333]">Remind before due date (days)</span>
              <input
                type="number"
                min={0}
                step={1}
                value={form.remindBeforeDueDays}
                disabled={!form.paymentRemindersEnabled}
                onChange={(e) =>
                  setField("remindBeforeDueDays", Math.max(0, Number(e.target.value) || 0))
                }
                className="w-20 rounded-lg border border-[#E6ECE2] bg-white px-2.5 py-1.5 text-sm text-[#333333] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]"
                aria-label="Remind before due date in days"
              />
            </div>
            <Toggle
              label="Remind on due date"
              checked={form.remindOnDueDate}
              disabled={!form.paymentRemindersEnabled}
              onChange={(v) => setField("remindOnDueDate", v)}
            />
            <Toggle
              label="Remind when overdue"
              checked={form.remindWhenOverdue}
              disabled={!form.paymentRemindersEnabled}
              onChange={(v) => setField("remindWhenOverdue", v)}
            />
          </div>
        </section>

        {/* Expiry alerts */}
        <section className="rounded-xl border border-[#E6ECE2] bg-white">
          <header className="border-b border-[#E6ECE2] px-4 py-3">
            <h2 className="text-sm font-bold text-[#333333]">Expiry Alerts</h2>
            <p className="text-xs text-[#666666] mt-0.5">
              Alerts for products expiring soon or already expired.
            </p>
          </header>
          <div className="divide-y divide-[#E6ECE2] px-4">
            <Toggle
              label="Expiry alerts enabled"
              checked={form.expiryAlertsEnabled}
              onChange={(v) => setField("expiryAlertsEnabled", v)}
            />
            <Toggle
              label="Alert within 6 months"
              checked={form.alertWithin6Months}
              disabled={!form.expiryAlertsEnabled}
              onChange={(v) => setField("alertWithin6Months", v)}
            />
            <Toggle
              label="Alert within 1 year"
              checked={form.alertWithin1Year}
              disabled={!form.expiryAlertsEnabled}
              onChange={(v) => setField("alertWithin1Year", v)}
            />
          </div>
        </section>

        {saveMsg && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
            {saveMsg}
          </div>
        )}
        {saveError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {saveError}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={() => void handleSave()}
            disabled={saving || settingsLoading}
            className="rounded-lg bg-[#4F6B4A] hover:bg-[#3F5A3A] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors px-4 py-2 text-sm font-semibold text-white"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>

        {/* Admin — manual scheduler runs (backend documents these as ADMIN-only) */}
        {isAdmin && (
          <section className="rounded-xl border border-[#E6ECE2] bg-white">
            <header className="border-b border-[#E6ECE2] px-4 py-3">
              <h2 className="text-sm font-bold text-[#333333]">Admin — manual scheduler runs</h2>
              <p className="text-xs text-[#666666] mt-0.5">
                These admin-only operations trigger the backend schedulers on demand.
              </p>
            </header>
            <div className="space-y-4 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-[#333333]">Run Payment Reminder Check</p>
                  {reminderRun.result && (
                    <p className="text-xs text-[#666666] mt-0.5">
                      Created {reminderRun.result.created} · Skipped {reminderRun.result.skipped}
                    </p>
                  )}
                  {reminderRun.error && (
                    <p className="text-xs text-red-600 mt-0.5">{reminderRun.error}</p>
                  )}
                </div>
                <button
                  onClick={() => void handleRunReminders()}
                  disabled={reminderRun.running}
                  className="rounded-lg border border-[#4F6B4A] px-3 py-1.5 text-xs font-semibold text-[#4F6B4A] hover:bg-[#E6ECE2] disabled:opacity-50 transition-colors"
                >
                  {reminderRun.running ? "Running…" : "Run Payment Reminder Check"}
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E6ECE2] pt-4">
                <div>
                  <p className="text-sm text-[#333333]">Run Expiry Alert Check</p>
                  {expiryRun.result && (
                    <p className="text-xs text-[#666666] mt-0.5">
                      Created {expiryRun.result.created} · Skipped {expiryRun.result.skipped}
                    </p>
                  )}
                  {expiryRun.error && (
                    <p className="text-xs text-red-600 mt-0.5">{expiryRun.error}</p>
                  )}
                </div>
                <button
                  onClick={() => void handleRunExpiry()}
                  disabled={expiryRun.running}
                  className="rounded-lg border border-[#4F6B4A] px-3 py-1.5 text-xs font-semibold text-[#4F6B4A] hover:bg-[#E6ECE2] disabled:opacity-50 transition-colors"
                >
                  {expiryRun.running ? "Running…" : "Run Expiry Alert Check"}
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}