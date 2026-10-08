import { useState, useEffect, useRef } from "react"
import { NavLink, Outlet, useNavigate, useLocation } from "react-router"
import { useAuth } from "../features/auth/AuthContext"
import {
  NotificationsProvider,
  useNotifications,
} from "../features/notifications/NotificationsContext"
import {
  notificationTypeLabel,
  severityTone,
  formatNotificationTime,
} from "../features/notifications/notificationsApi"

// ── Icons ────────────────────────────────────────────────────────────────────

function IconGrid() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path
        fillRule="evenodd"
        d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
        clipRule="evenodd"
      />
    </svg>
  )
}
function IconBox() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764-2.382zM4.447 8.342A1 1 0 003 9.236V15a1 1 0 00.553.894l4 2A1 1 0 009 17v-5.764a1 1 0 00-.553-.894l-4-2z" />
    </svg>
  )
}
function IconCart() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3z" />
      <path d="M16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
    </svg>
  )
}
function IconTruck() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
      <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1v-1h3.05a2.5 2.5 0 014.9 0H19a1 1 0 001-1v-3.414a1 1 0 00-.293-.707l-2.586-2.586A1 1 0 0016.414 7H15V5a1 1 0 00-1-1H3z" />
    </svg>
  )
}
function IconFinance() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M4 2a1 1 0 00-1 1v1.06A3.5 3.5 0 002.5 4h15a1 1 0 110 2h-.527A3.5 3.5 0 0016 6.06V6a1 1 0 112 0v.94A3.5 3.5 0 0017.5 6h.5a1 1 0 110 2h-.5a3.5 3.5 0 00-1 1.06V10a1 1 0 11-2 0V9.06A3.5 3.5 0 0012.5 8H4.5a1 1 0 100 2h.527A3.5 3.5 0 006 10.06V10a1 1 0 11-2 0v-.94A3.5 3.5 0 002.5 8H2a1 1 0 110-2h.5A3.5 3.5 0 004 4.06V3a1 1 0 00-1-1z" />
      <path d="M9.25 6.5h1.5a.75.75 0 010 1.5h-1.5v1h1.25a.75.75 0 01.75.75v1h1a.75.75 0 010 1.5h-1v1.25a.75.75 0 01-1.5 0V10.5H9.5a.75.75 0 010-1.5H11V8.25H9.75a.75.75 0 01-.75-.75V6.5h.25z" />
    </svg>
  )
}
function IconReport() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M3 3.5A1.5 1.5 0 014.5 2h11A1.5 1.5 0 0117 3.5v13a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16.5v-13zm3 3a1 1 0 000 2h8a1 1 0 100-2H6zm0 3.5a1 1 0 000 2h8a1 1 0 100-2H6zm0 3.5a1 1 0 000 2h5a1 1 0 100-2H6z" />
    </svg>
  )
}
function IconCog() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path
        fillRule="evenodd"
        d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
        clipRule="evenodd"
      />
    </svg>
  )
}
function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`w-3.5 h-3.5 transition-transform duration-200 ${
        open ? "rotate-90" : ""
      }`}
    >
      <path
        fillRule="evenodd"
        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
        clipRule="evenodd"
      />
    </svg>
  )
}
function IconMenu() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path
        fillRule="evenodd"
        d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
        clipRule="evenodd"
      />
    </svg>
  )
}
function IconBell() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6z" />
      <path d="M10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
    </svg>
  )
}
function IconX() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path
        fillRule="evenodd"
        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  )
}

// ── Nav tree ─────────────────────────────────────────────────────────────────

type NavChild = { to: string; label: string; dividerBefore?: boolean }

type NavItem = {
  to: string
  label: string
  icon: React.ReactNode
  disabled?: boolean
  dividerBefore?: boolean
  children?: NavChild[]
}

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: <IconGrid /> },
  { to: "/pos", label: "Point of Sale", icon: <IconCart /> },
  {
    to: "/inventory/products",
    label: "Inventory",
    icon: <IconBox />,
    children: [
      { to: "/inventory/products", label: "Products" },
      { to: "/inventory/stock", label: "Stock" },
      { to: "/inventory/batches-expiry", label: "Batches & Expiry" },
      { to: "/inventory/transfers", label: "Transfers" },
      { to: "/inventory/reorder", label: "Reorder" },
    ],
  },
  {
    to: "/purchasing",
    label: "Purchasing",
    icon: <IconTruck />,
    children: [
      { to: "/purchasing", label: "Requirements" },
      { to: "/purchasing/orders", label: "Purchase Orders" },
      { to: "/purchasing/deliveries", label: "Deliveries" },
      { to: "/purchasing/invoices", label: "Supplier Invoices" },
      { to: "/purchasing/payables", label: "Supplier Payables" },
      { to: "/purchasing/returns", label: "Returns" },
    ],
  },
  {
    // Was a "Reports" group whose only child was Narcotics. The group added a
    // level of nesting around a single link and duplicated the Dashboard tab
    // bar, which already carries Narcotics, so the child is promoted to a
    // top-level item here instead of the group being deleted outright (which
    // would have left Narcotics unreachable from the sidebar entirely).
    to: "/dashboard/narcotics",
    label: "Narcotics",
    icon: <IconReport />,
    dividerBefore: true,
  },
  {
    to: "/inventory/groups",
    label: "Settings",
    icon: <IconCog />,
    dividerBefore: true,
    children: [
      { to: "/inventory/groups", label: "Product Groups" },
      { to: "/inventory/units", label: "Units" },
      { to: "/inventory/locations", label: "Locations" },
      { to: "/settings/audit-trail", label: "Audit Trail" },
      { to: "/settings/notifications", label: "Notifications" },
    ],
  },
]

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}) {
  const location = useLocation()
  const navigate = useNavigate()

  function isPathActive(path: string) {
    if (path === "/dashboard") return location.pathname.startsWith("/dashboard")
    return location.pathname.startsWith(path)
  }

  function sectionIsActive(item: NavItem) {
    if (item.children)
      return item.children.some(
        (c) =>
          location.pathname === c.to ||
          location.pathname.startsWith(c.to),
      )
    return isPathActive(item.to)
  }

  // Track which sections are open
  const defaultOpen = NAV.filter(
    (item) => item.children && sectionIsActive(item),
  ).map((item) => item.to)

  const [openSections, setOpenSections] = useState<string[]>(defaultOpen)

  function toggleSection(to: string) {
    setOpenSections((prev) =>
      prev.includes(to) ? prev.filter((s) => s !== to) : [...prev, to],
    )
  }

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white">
      {/* Logo + collapse toggle */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-[#E6ECE2] flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#B6C8AF] flex-shrink-0">
              <svg
                className="h-4 w-4 text-[#4F6B4A]"
                viewBox="0 0 48 48"
                fill="none"
                aria-hidden
              >
                <rect
                  x="20"
                  y="4"
                  width="8"
                  height="40"
                  rx="4"
                  fill="currentColor"
                />
                <rect
                  x="4"
                  y="20"
                  width="40"
                  height="8"
                  rx="4"
                  fill="currentColor"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-[#333333] leading-none tracking-wide">
                DOSE PHARMACY
              </p>
              <p className="text-[10px] text-[#999999] mt-0.5">
                Management System
              </p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#B6C8AF] mx-auto">
            <svg
              className="h-4 w-4 text-[#4F6B4A]"
              viewBox="0 0 48 48"
              fill="none"
              aria-hidden
            >
              <rect
                x="20"
                y="4"
                width="8"
                height="40"
                rx="4"
                fill="currentColor"
              />
              <rect
                x="4"
                y="20"
                width="40"
                height="8"
                rx="4"
                fill="currentColor"
              />
            </svg>
          </div>
        )}
        {!collapsed && (
          <button
            onClick={onToggleCollapse}
            className="rounded-md p-1.5 text-[#999999] hover:bg-[#E6ECE2] hover:text-[#333333] transition-colors hidden md:flex"
            title="Collapse sidebar"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path
                fillRule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
        {collapsed && (
          <button
            onClick={onToggleCollapse}
            className="rounded-md p-1.5 text-[#999999] hover:bg-[#E6ECE2] hover:text-[#333333] transition-colors hidden md:flex mx-auto"
            title="Expand sidebar"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav
        className="flex-1 overflow-y-auto py-3 px-2"
        aria-label="Main navigation"
      >
        {NAV.map((item) => {
          const active = sectionIsActive(item)
          const isOpen = openSections.includes(item.to)
          const hasChildren = !!item.children

          if (item.disabled) {
            return (
              <div key={item.to}>
                {item.dividerBefore && (
                  <div className="mx-2 my-2 border-t border-[#E6ECE2]" />
                )}
                <div
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-not-allowed opacity-40 ${
                    collapsed ? "justify-center" : ""
                  }`}
                >
                  <span className="flex-shrink-0 text-[#999999]">
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <span className="text-sm font-medium text-[#999999]">
                      {item.label}
                    </span>
                  )}
                </div>
              </div>
            )
          }

          if (!hasChildren) {
            return (
              <div key={item.to} className="space-y-0.5">
                {item.dividerBefore && (
                  <div className="mx-2 my-2 border-t border-[#E6ECE2]" />
                )}
                <NavLink
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  onClick={onCloseMobile}
                  className={({ isActive: _ia }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${
                      collapsed ? "justify-center" : ""
                    } ${
                      active
                        ? "bg-[#E6ECE2] text-[#4F6B4A] font-semibold"
                        : "text-[#666666] hover:bg-[#E6ECE2]/70 hover:text-[#333333]"
                    }`
                  }
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!collapsed && (
                    <span className="text-sm font-medium">{item.label}</span>
                  )}
                </NavLink>
              </div>
            )
          }

          return (
            <div key={item.to} className="space-y-0.5">
              {item.dividerBefore && (
                <div className="mx-2 my-2 border-t border-[#E6ECE2]" />
              )}
              <button
                onClick={() => {
                  if (collapsed) {
                    onToggleCollapse()
                    setOpenSections((prev) => [
                      ...prev.filter((s) => s !== item.to),
                      item.to,
                    ])
                  } else {
                    toggleSection(item.to)
                  }
                }}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  collapsed ? "justify-center" : "justify-between"
                } ${
                  active
                    ? "bg-[#E6ECE2] text-[#4F6B4A] font-semibold"
                    : "text-[#666666] hover:bg-[#E6ECE2]/70 hover:text-[#333333]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!collapsed && (
                    <span className="text-sm font-medium">{item.label}</span>
                  )}
                </div>
                {!collapsed && <IconChevron open={isOpen} />}
              </button>

              {/* Sub-items */}
              {!collapsed && isOpen && (
                <div className="ml-4 mt-1 pl-3 border-l-2 border-[#C6D4BF] space-y-0.5">
                  {item.children!.map((child) => {
                    const exactActive =
                      location.pathname === child.to ||
                      (location.pathname.startsWith(child.to) &&
                        !item.children!.some(
                          (other) =>
                            other.to !== child.to &&
                            location.pathname.startsWith(other.to) &&
                            other.to.length > child.to.length,
                        ))
                    return (
                      <div key={child.to}>
                        {child.dividerBefore && (
                          <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                            <div className="flex-1 border-t border-[#E6ECE2]" />
                            <span className="text-[9px] font-bold text-[#999999] uppercase tracking-widest">
                              Settings
                            </span>
                            <div className="flex-1 border-t border-[#E6ECE2]" />
                          </div>
                        )}
                        <NavLink
                          to={child.to}
                          onClick={onCloseMobile}
                          className={() =>
                            `flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${
                              exactActive
                                ? "bg-[#E6ECE2] text-[#4F6B4A] font-semibold"
                                : "text-[#666666] hover:bg-[#E6ECE2]/70 hover:text-[#333333]"
                            }`
                          }
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                              exactActive ? "bg-[#4F6B4A]" : "bg-[#C6D4BF]"
                            }`}
                          />
                          {child.label}
                        </NavLink>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Bottom: user actions (search / notifications / profile) */}
      <SidebarFooter collapsed={collapsed} />
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col bg-white flex-shrink-0 transition-all duration-300 border-r border-[#E6ECE2] shadow-sm ${
          collapsed ? "w-16" : "w-60"
        }`}
        style={{ minHeight: "100dvh" }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={onCloseMobile}
          />
          {/* Drawer */}
          <aside className="relative w-64 bg-white flex flex-col h-full shadow-2xl border-r border-[#E6ECE2]">
            <div className="absolute top-3 right-3 z-10">
              <button
                onClick={onCloseMobile}
                className="p-1.5 rounded-lg text-[#999999] hover:text-[#333333] hover:bg-[#E6ECE2] transition-colors"
              >
                <IconX />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}

// ── Sidebar footer (search / notifications / profile) ─────────────────────────

function SidebarFooter({
  collapsed,
}: {
  collapsed: boolean
}) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const {
    notifications,
    unreadCount,
    loading,
    error,
    filters,
    refresh,
    markRead,
    markAllRead,
  } = useNotifications()
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!notifOpen) return
    const onDown = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [notifOpen])

  async function handleLogout() {
    navigate("/login", { replace: true })
    // Clears the Better Auth session server-side + local state.
    await logout()
  }

  return (
    <div className="border-t border-[#E6ECE2] px-3 py-3 flex flex-col gap-3 flex-shrink-0">
      {/* Notifications */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setNotifOpen((v) => !v)}
          className={`relative flex items-center gap-2 rounded-lg p-2 text-[#666666] hover:bg-[#E6ECE2] transition-colors w-full ${
            collapsed ? "justify-center" : "justify-start"
          }`}
          aria-label="Notifications"
        >
          <span className="relative flex-shrink-0">
            <IconBell />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </span>
          {!collapsed && (
            <span className="text-sm font-medium text-[#333333]">
              Notifications
            </span>
          )}
        </button>

        {notifOpen && (
          <div className="absolute bottom-full left-0 mb-2 w-72 bg-white rounded-lg border border-[#E6ECE2] shadow-lg z-50 overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-[#E6ECE2] px-3 py-2">
              <p className="text-xs font-bold text-[#333333]">Notifications</p>
              {unreadCount > 0 && (
                <button
                  onClick={() => void markAllRead()}
                  className="text-[10px] font-semibold text-[#7A9076] hover:underline"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {error && (
              <div className="px-3 py-3">
                <p className="text-xs text-red-600">{error}</p>
                <button
                  onClick={() => void refresh()}
                  className="text-[10px] font-semibold text-[#7A9076] underline mt-1"
                >
                  Retry
                </button>
              </div>
            )}

            {!error && loading && notifications.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-[#999999]">
                Loading notifications…
              </p>
            )}

            {!error && !loading && notifications.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-[#999999]">
                {filters.isRead === false
                  ? "No unread notifications"
                  : "No notifications"}
              </p>
            )}

            {notifications.length > 0 && (
              <div className="max-h-80 overflow-y-auto divide-y divide-[#E6ECE2]">
                {notifications.slice(0, 8).map((n) => {
                  const unread = !n.isRead
                  const tone = severityTone(n.severity)
                  return (
                    <button
                      key={n.id}
                      onClick={() => void markRead(n.id)}
                      className={`w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-[#F5F5F0] text-left ${
                        unread ? "bg-[#FBFDF9]" : ""
                      }`}
                    >
                      <span className="flex-shrink-0 mt-1.5 flex items-center">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            unread ? "bg-[#4F6B4A]" : "bg-gray-300"
                          }`}
                        />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span
                          className={`block text-sm leading-snug ${
                            unread
                              ? "font-semibold text-[#333333]"
                              : "font-medium text-[#555555]"
                          }`}
                        >
                          {n.title}
                        </span>
                        {n.message && (
                          <span className="block text-xs text-[#666666] mt-0.5 line-clamp-2">
                            {n.message}
                          </span>
                        )}
                        <span className="block text-[10px] text-[#999999] mt-1">
                          {notificationTypeLabel(n.type)} ·{" "}
                          {formatNotificationTime(n.createdAt)}
                        </span>
                      </span>
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                          tone === "danger"
                            ? "bg-red-500"
                            : tone === "warning"
                              ? "bg-yellow-500"
                              : "bg-[#B6C8AF]"
                        }`}
                      />
                    </button>
                  )
                })}
              </div>
            )}

            <button
              onClick={() => {
                setNotifOpen(false)
                navigate("/notifications")
              }}
              className="w-full border-t border-[#E6ECE2] px-3 py-2 text-xs font-semibold text-[#7A9076] hover:bg-[#F5F5F0]"
            >
              View all notifications
            </button>
          </div>
        )}
      </div>

      {/* Profile */}
      <div
        className={`flex items-center gap-2.5 pt-2 border-t border-[#E6ECE2] ${
          collapsed ? "justify-center" : ""
        }`}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E6ECE2] text-[#4F6B4A] text-sm font-bold flex-shrink-0">
          {user?.name?.charAt(0).toUpperCase() ?? "U"}
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-semibold text-[#333333] leading-none truncate">
                {user?.name}
              </p>
              <p className="text-[10px] text-[#666666] capitalize mt-0.5 truncate">
                {user?.role?.replace("_", " ")}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex-shrink-0 rounded-lg bg-[#E6ECE2] hover:bg-[#C6D4BF] transition-colors px-3 py-1.5 text-xs font-semibold text-[#333333]"
            >
              Logout
            </button>
          </>
        )}
      </div>

      {/* Version tag */}
      <div className="pt-1">
        <p
          className={`text-[10px] text-[#999999] font-medium ${
            collapsed ? "text-center" : ""
          }`}
        >
          DOSE PHARMACY v2.0
        </p>
        {!collapsed && (
          <p className="text-[10px] text-[#999999] mt-0.5">
            © 2026 All rights reserved
          </p>
        )}
      </div>
    </div>
  )
}

// ── App layout ────────────────────────────────────────────────────────────────

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Auto-collapse on small desktop
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 1024 && window.innerWidth >= 768) {
        setCollapsed(true)
      } else if (window.innerWidth >= 1024) {
        setCollapsed(false)
      }
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return (
    <NotificationsProvider>
      <div className="flex h-dvh overflow-hidden bg-[#FAF9F4]">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        {/* Mobile nav trigger (header removed) */}
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          className="md:hidden fixed top-3 left-3 z-40 rounded-lg p-2 bg-white border border-[#E6ECE2] text-[#666666] shadow-sm hover:bg-[#E6ECE2] transition-colors"
        >
          <IconMenu />
        </button>

        <main className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </NotificationsProvider>
  )
}
