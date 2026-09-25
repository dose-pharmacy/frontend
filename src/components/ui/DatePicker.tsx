import { useEffect, useRef, useState } from "react"
import { DayPicker } from "react-day-picker"
import "react-day-picker/dist/style.css"

interface DatePickerProps {
  value: string            // "YYYY-MM-DD" or ""
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
}

// Approximate popup footprint. Used only to decide whether the calendar has
// enough room to open below the field or should flip above it. The calendar
// itself is never resized.
const POPUP_W = 304
const POPUP_H = 360
const POPUP_GAP = 8

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function fromISO(s: string): Date | undefined {
  if (!s) return undefined
  const d = new Date(s + "T00:00:00")
  return Number.isNaN(d.getTime()) ? undefined : d
}

function fmtDisplay(s: string): string {
  const d = fromISO(s)
  if (!d) return ""
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export default function DatePicker({
  value,
  onChange,
  placeholder = "Select a date...",
  disabled,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Date | undefined>(fromISO(value))
  const wrapRef = useRef<HTMLDivElement>(null)
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(
    null,
  )

  // Sync external value → internal
  useEffect(() => {
    setSelected(fromISO(value))
  }, [value])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  // Anchor the calendar to the field with position:fixed so it is never
  // clipped by an overflow container (e.g. a scrolling modal body). It opens
  // below the field when there is room, flips above when there isn't, and is
  // clamped to stay inside the viewport. The calendar itself is unchanged.
  useEffect(() => {
    if (!open) {
      setPopupPos(null)
      return
    }
    function place() {
      const wrap = wrapRef.current
      if (!wrap) return
      const rect = wrap.getBoundingClientRect()
      const below = window.innerHeight - rect.bottom
      const above = rect.top
      const top =
        below >= POPUP_H
          ? rect.bottom + POPUP_GAP
          : above >= POPUP_H
            ? rect.top - POPUP_GAP - POPUP_H
            : rect.bottom + POPUP_GAP
      const left = Math.max(
        POPUP_GAP,
        Math.min(rect.left, window.innerWidth - POPUP_W - POPUP_GAP),
      )
      setPopupPos({ top: Math.max(POPUP_GAP, top), left })
    }
    place()
    window.addEventListener("scroll", place, true)
    window.addEventListener("resize", place)
    return () => {
      window.removeEventListener("scroll", place, true)
      window.removeEventListener("resize", place)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative">
      {/* Trigger — matches SC_DATE visually */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full rounded-xl border border-[#C6D4BF] bg-white px-3.5 py-2.5 text-sm text-left text-[#4A4A4A] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20 disabled:opacity-50 flex items-center justify-between gap-2"
      >
        <span className={selected ? "text-[#4A4A4A]" : "text-[#9A9A9A]"}>
          {selected ? fmtDisplay(value) : placeholder}
        </span>
        <svg
          className="h-4 w-4 text-[#7A9076] shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Popup calendar — fixed-positioned so it is never clipped by the
          modal's overflow container; stays anchored to the field. */}
      {open && popupPos && (
        <div
          style={{
            position: "fixed",
            top: popupPos.top,
            left: popupPos.left,
            zIndex: 50,
          }}
          className="rounded-xl border border-[#E6ECE2] bg-white shadow-lg p-3"
        >
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={(d) => {
              setSelected(d)
              onChange(d ? toISO(d) : "")
              setOpen(false)
            }}
            showOutsideDays
            classNames={{
              months: "flex flex-col",
              month: "space-y-3",
              month_caption: "flex justify-center pt-1 relative items-center",
              caption_label: "text-sm font-bold text-[#4A4A4A]",
              nav: "flex items-center gap-1",
              button_previous:
                "h-7 w-7 rounded-lg text-[#7A9076] hover:bg-[#E6ECE2] inline-flex items-center justify-center transition-colors",
              button_next:
                "h-7 w-7 rounded-lg text-[#7A9076] hover:bg-[#E6ECE2] inline-flex items-center justify-center transition-colors",
              month_grid: "w-full border-collapse",
              weekdays: "flex",
              weekday:
                "w-9 h-8 text-[0.7rem] uppercase tracking-wide text-[#8A8A8A] font-semibold flex items-center justify-center",
              week: "flex w-full mt-1",
              day: "w-9 h-9 p-0 text-center",
              day_button:
                "w-9 h-9 rounded-lg text-sm text-[#4A4A4A] hover:bg-[#E6ECE2] transition-colors inline-flex items-center justify-center",
              selected:
                "!bg-[#B6C8AF] !text-[#333333] font-bold rounded-lg hover:!bg-[#A5B89E]",
              today:
                "ring-1 ring-[#B6C8AF] ring-inset rounded-lg",
              outside: "text-[#C8C8C8]",
              disabled: "text-[#C8C8C8] opacity-50 cursor-not-allowed",
              hidden: "invisible",
            }}
          />
        </div>
      )}
    </div>
  )
}