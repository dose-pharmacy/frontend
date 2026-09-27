import { useState, useEffect, useRef } from "react"
import { NavLink, Outlet, useNavigate, useLocation } from "react-router"
import { useAuth } from "../features/auth/AuthContext"
import {
  IconBox as SharedIconBox,
  IconCheckCircle,
  IconWarningTriangle,
} from "../components/ui/icons"

// ── Icons ────────────────────────────────────────────────────────────────────

function IconGrid() {
  return <LayoutGrid className="h-5 w-5" />;
}
function IconBox() {
  return <Boxes className="h-5 w-5" />;
}
function IconCart() {
  return <ShoppingCart className="h-5 w-5" />;
}
function IconTruck() {
  return <Truck className="h-5 w-5" />;
}
function IconCog() {
  return <Settings className="h-5 w-5" />;
}
function IconChevron({ open }: { open: boolean }) {
  return (
    <ChevronRight
      className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
    />
  );
}
function IconMenu() {
  return <Menu className="h-5 w-5" />;
}
function IconBell() {
  return <Bell className="h-5 w-5" />;
}
function IconX() {
  return <X className="h-5 w-5" />;
}
function IconAlertTriangle({ className = "h-5 w-5" }: { className?: string }) {
  return <AlertTriangle className={className} />;
}
function IconCheckCircle({ className = "h-5 w-5" }: { className?: string }) {
  return <PackageCheck className={className} />;
}
function IconPackage({ className = "h-5 w-5" }: { className?: string }) {
  return <Package className={className} />;
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
    to: "/inventory/groups",
    label: "Settings",
    icon: <IconCog />,
    dividerBefore: true,
    children: [
      { to: "/inventory/groups", label: "Product Groups" },
      { to: "/inventory/units", label: "Units" },
      { to: "/inventory/locations", label: "Locations" },
      { to: "/settings/audit-trail", label: "Audit Trail" },
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
      <div className="flex items-center justify-between px-3 py-4 border-b border-[#C6D4BF]/40 flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E6ECE2] flex-shrink-0">
              <Cross className="h-4 w-4 text-[#333333]" strokeWidth={2.5} aria-hidden />
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
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E6ECE2] mx-auto">
            <Cross className="h-4 w-4 text-[#333333]" strokeWidth={2.5} aria-hidden />
          </div>
        )}
        {!collapsed && (
          <button
            onClick={onToggleCollapse}
            className="rounded-md p-1.5 text-[#666666] hover:bg-[#E6ECE2] hover:text-[#333333] transition-colors hidden md:flex"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
        {collapsed && (
          <button
            onClick={onToggleCollapse}
            className="rounded-md p-1.5 text-[#666666] hover:bg-[#E6ECE2] hover:text-[#333333] transition-colors hidden md:flex mx-auto"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
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
                  <div className="mx-2 my-2 border-t border-[#333333]/15" />
                )}
                <div
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-not-allowed opacity-40 ${
                    collapsed ? "justify-center" : ""
                  }`}
                >
                  <span className="flex-shrink-0 text-[#333333]">{item.icon}</span>
                  {!collapsed && <span className="text-sm font-medium text-[#333333]">{item.label}</span>}
                </div>
              </div>
            )
          }

          if (!hasChildren) {
            return (
              <div key={item.to} className="space-y-0.5">
                {item.dividerBefore && <div className="mx-2 my-2 border-t border-[#333333]/15" />}
              <NavLink
                to={item.to}
                title={collapsed ? item.label : undefined}
                onClick={onCloseMobile}
                className={({ isActive: _ia }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${collapsed ? "justify-center" : ""} ${active ? "bg-[#E6ECE2] text-[#4F6B4A] font-semibold" : "text-[#333333]/75 hover:bg-[#E6ECE2] hover:text-[#333333]"}`
                }
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
              </NavLink>
              </div>
            )
          }

          return (
            <div key={item.to} className="space-y-0.5">
              {item.dividerBefore && <div className="mx-2 my-2 border-t border-[#333333]/15" />}
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
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${collapsed ? "justify-center" : "justify-between"} ${active ? "bg-[#E6ECE2] text-[#4F6B4A] font-semibold" : "text-[#333333]/75 hover:bg-[#E6ECE2] hover:text-[#333333]"}`}
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
                <div className="ml-4 mt-1 pl-3 border-l-2 border-[#333333]/15 space-y-0.5">
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
                            <div className="flex-1 border-t border-[#333333]/15" />
                            <span className="text-[9px] font-bold text-[#333333]/45 uppercase tracking-widest">Settings</span>
                            <div className="flex-1 border-t border-[#333333]/15" />
                          </div>
                        )}
                        <NavLink
                          to={child.to}
                          onClick={onCloseMobile}
                          className={() =>
                            `flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${exactActive ? "bg-[#E6ECE2] text-[#4F6B4A] font-semibold" : "text-[#333333]/75 hover:bg-[#E6ECE2] hover:text-[#333333]"}`
                          }
                        >
                          <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${exactActive ? "bg-[#A0B59C]" : "bg-[#333333]/40"}`} />
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
              <button onClick={onCloseMobile} className="p-1.5 rounded-lg text-[#666666] hover:text-[#333333] hover:bg-[#E6ECE2] transition-colors">
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
            <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-red-500" />
          </span>
          {!collapsed && (
            <span className="text-sm font-medium text-[#333333]">
              Notifications
            </span>
          )}
        </button>

        {notifOpen && (
          <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-lg border border-[#E6ECE2] shadow-lg z-50 overflow-hidden">
            <div className="divide-y divide-[#E6ECE2]">
              {[
                {
                  icon: <IconWarningTriangle className="h-4 w-4" />,
                  iconColor: "text-yellow-500",
                  text: "5 products near expiry date",
                  time: "10m",
                },
                {
                  icon: <SharedIconBox className="h-4 w-4" />,
                  iconColor: "text-blue-500",
                  text: "Reorder: Panadol 500mg",
                  time: "1h",
                },
                {
                  icon: <IconCheckCircle className="h-4 w-4" />,
                  iconColor: "text-green-600",
                  text: "PO-2026-0018 delivered",
                  time: "3h",
                },
              ].map((n) => (
                <button
                  key={n.text}
                  className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-[#F5F5F0] text-left"
                >
                  <span className={`flex-shrink-0 mt-0.5 ${n.iconColor}`}>
                    {n.icon}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-[#333333] leading-snug">
                      {n.text}
                    </span>
                    <span className="block text-[10px] text-[#999999] mt-0.5">
                      {n.time}
                    </span>
                  </span>
                </button>
              ))}
            </div>
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
  )
}
