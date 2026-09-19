import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router";
import { useAuth } from "../features/auth/AuthContext";

// ── Icons ────────────────────────────────────────────────────────────────────

function IconGrid() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
    </svg>
  );
}
function IconBox() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764-2.382zM4.447 8.342A1 1 0 003 9.236V15a1 1 0 00.553.894l4 2A1 1 0 009 17v-5.764a1 1 0 00-.553-.894l-4-2z"/>
    </svg>
  );
}
function IconCart() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3z"/>
      <path d="M16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
    </svg>
  );
}
function IconTruck() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
      <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1v-1h3.05a2.5 2.5 0 014.9 0H19a1 1 0 001-1v-3.414a1 1 0 00-.293-.707l-2.586-2.586A1 1 0 0016.414 7H15V5a1 1 0 00-1-1H3z"/>
    </svg>
  );
}
function IconChart() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
    </svg>
  );
}
function IconCog() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/>
    </svg>
  );
}
function IconChevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-90" : ""}`}>
      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
    </svg>
  );
}
function IconMenu() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
    </svg>
  );
}
function IconReceipt() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"/>
    </svg>
  );
}
function IconBell() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6z"/>
      <path d="M10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
    </svg>
  );
}
function IconSearch() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
    </svg>
  );
}
function IconX() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
    </svg>
  );
}

// ── Nav tree ─────────────────────────────────────────────────────────────────

type NavChild = { to: string; label: string; dividerBefore?: boolean };

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  dividerBefore?: boolean;
  children?: NavChild[];
};

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: <IconGrid /> },
  { to: "/pos", label: "Point of Sale", icon: <IconCart /> },
  {
    to: "/inventory",
    label: "Inventory",
    icon: <IconBox />,
    children: [
      { to: "/inventory", label: "Overview" },
      { to: "/inventory/products", label: "Products" },
      { to: "/inventory/stock", label: "Stock" },
      { to: "/inventory/batches-expiry", label: "Batches & Expiry" },
      { to: "/inventory/transfers", label: "Transfers" },
      { to: "/inventory/reorder", label: "Reorder" },
    ],
  },
  { to: "/sales", label: "Sales", icon: <IconReceipt /> },
  {
    to: "/purchasing",
    label: "Purchasing",
    icon: <IconTruck />,
    children: [
      { to: "/purchasing", label: "Requirements" },
      { to: "/purchasing/orders", label: "Purchase Orders" },
      { to: "/purchasing/deliveries/new", label: "Deliveries" },
      { to: "/purchasing/payables", label: "Supplier Payables" },
      { to: "/purchasing/returns/new", label: "Returns" },
    ],
  },
  {
    to: "/reports",
    label: "Reports",
    icon: <IconChart />,
    children: [
      { to: "/reports", label: "Overview" },
      { to: "/reports/sales", label: "Sales Report" },
      { to: "/reports/profitability", label: "Profitability" },
      { to: "/reports/stock-performance", label: "Stock Performance" },
      { to: "/reports/margins", label: "Profit Margins" },
      { to: "/reports/audit-trail", label: "Audit Trail" },
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
    ],
  },
];

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();

  function isPathActive(path: string) {
    if (path === "/dashboard") return location.pathname === "/dashboard";
    if (path === "/inventory") return location.pathname === "/inventory";
    if (path === "/sales") return location.pathname === "/sales";
    return location.pathname.startsWith(path);
  }

  function sectionIsActive(item: NavItem) {
    if (item.children) return item.children.some((c) => location.pathname === c.to || (c.to !== "/inventory" && location.pathname.startsWith(c.to)));
    return isPathActive(item.to);
  }

  // Track which sections are open
  const defaultOpen = NAV.filter(
    (item) => item.children && sectionIsActive(item)
  ).map((item) => item.to);

  const [openSections, setOpenSections] = useState<string[]>(defaultOpen);

  function toggleSection(to: string) {
    setOpenSections((prev) =>
      prev.includes(to) ? prev.filter((s) => s !== to) : [...prev, to]
    );
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo + collapse toggle */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-[#ABDBE3]/40 flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/30 flex-shrink-0">
              <svg className="h-4 w-4 text-white" viewBox="0 0 48 48" fill="none" aria-hidden>
                <rect x="20" y="4" width="8" height="40" rx="4" fill="currentColor"/>
                <rect x="4" y="20" width="40" height="8" rx="4" fill="currentColor"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none tracking-wide">PharmaCare</p>
              <p className="text-[10px] text-white/60 mt-0.5">Management System</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/30 mx-auto">
            <svg className="h-4 w-4 text-white" viewBox="0 0 48 48" fill="none" aria-hidden>
              <rect x="20" y="4" width="8" height="40" rx="4" fill="currentColor"/>
              <rect x="4" y="20" width="40" height="8" rx="4" fill="currentColor"/>
            </svg>
          </div>
        )}
        {!collapsed && (
          <button
            onClick={onToggleCollapse}
            className="rounded-md p-1.5 text-white/60 hover:bg-white/20 hover:text-white transition-colors hidden md:flex"
            title="Collapse sidebar"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd"/>
            </svg>
          </button>
        )}
        {collapsed && (
          <button
            onClick={onToggleCollapse}
            className="rounded-md p-1.5 text-white/60 hover:bg-white/20 hover:text-white transition-colors hidden md:flex mx-auto"
            title="Expand sidebar"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
            </svg>
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label="Main navigation">
        {NAV.map((item) => {
          const active = sectionIsActive(item);
          const isOpen = openSections.includes(item.to);
          const hasChildren = !!item.children;

          if (item.disabled) {
            return (
              <div key={item.to}>
                {item.dividerBefore && (
                  <div className="mx-2 my-2 border-t border-white/20" />
                )}
                <div
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-not-allowed opacity-30 ${collapsed ? "justify-center" : ""}`}
                >
                  <span className="flex-shrink-0 text-white">{item.icon}</span>
                  {!collapsed && <span className="text-sm font-medium text-white">{item.label}</span>}
                </div>
              </div>
            );
          }

          if (!hasChildren) {
            return (
              <div key={item.to} className="space-y-0.5">
                {item.dividerBefore && <div className="mx-2 my-2 border-t border-white/20" />}
              <NavLink
                to={item.to}
                title={collapsed ? item.label : undefined}
                onClick={onCloseMobile}
                className={({ isActive: _ia }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${collapsed ? "justify-center" : ""} ${active ? "bg-white text-[#49B0C1] shadow-sm font-semibold" : "text-white/80 hover:bg-white/20 hover:text-white"}`
                }
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
              </NavLink>
              </div>
            );
          }

          return (
            <div key={item.to} className="space-y-0.5">
              {item.dividerBefore && <div className="mx-2 my-2 border-t border-white/20" />}
              <button
                onClick={() => {
                  if (collapsed) {
                    onToggleCollapse();
                    setOpenSections((prev) => [...prev.filter((s) => s !== item.to), item.to]);
                  } else {
                    toggleSection(item.to);
                  }
                }}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${collapsed ? "justify-center" : "justify-between"} ${active ? "bg-white text-[#49B0C1] shadow-sm font-semibold" : "text-white/80 hover:bg-white/20 hover:text-white"}`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                </div>
                {!collapsed && <IconChevron open={isOpen} />}
              </button>

              {/* Sub-items */}
              {!collapsed && isOpen && (
                <div className="ml-4 mt-1 pl-3 border-l-2 border-white/30 space-y-0.5">
                  {item.children!.map((child) => {
                    const exactActive = location.pathname === child.to || (child.to !== "/inventory" && child.to !== "/reports/sales" && location.pathname.startsWith(child.to) && !item.children!.some((other) => other.to !== child.to && location.pathname.startsWith(other.to) && other.to.length > child.to.length));
                    return (
                      <div key={child.to}>
                        {child.dividerBefore && (
                          <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                            <div className="flex-1 border-t border-white/20" />
                            <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Settings</span>
                            <div className="flex-1 border-t border-white/20" />
                          </div>
                        )}
                        <NavLink
                          to={child.to}
                          onClick={onCloseMobile}
                          className={() =>
                            `flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${exactActive ? "bg-[#ABDBE3] text-[#333333] font-semibold" : "text-white/70 hover:bg-white/15 hover:text-white"}`
                          }
                        >
                          <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${exactActive ? "bg-[#49B0C1]" : "bg-white/50"}`} />
                          {child.label}
                        </NavLink>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom: version tag */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-[#ABDBE3]/30 flex-shrink-0 bg-[#3da0b3]/30">
          <p className="text-[10px] text-white/50 font-medium">PharmaCare v2.0</p>
          <p className="text-[10px] text-white/30 mt-0.5">© 2026 All rights reserved</p>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col bg-[#49B0C1] flex-shrink-0 transition-all duration-300 border-r border-[#ABDBE3]/40 shadow-lg ${collapsed ? "w-16" : "w-60"}`}
        style={{ minHeight: "100vh" }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={onCloseMobile} />
          {/* Drawer */}
          <aside className="relative w-64 bg-[#49B0C1] flex flex-col h-full shadow-2xl border-r border-[#ABDBE3]/40">
            <div className="absolute top-3 right-3 z-10">
              <button onClick={onCloseMobile} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors">
                <IconX />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}

// ── Top bar ───────────────────────────────────────────────────────────────────

function TopBar({
  onToggleMobile,
  onToggleCollapse,
}: {
  onToggleMobile: () => void;
  onToggleCollapse: () => void;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchFocused, setSearchFocused] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  async function handleLogout() {
    navigate("/login", { replace: true });
    // Clears the Better Auth session server-side + local state.
    await logout();
  }

  return (
    <header className="h-14 bg-white border-b border-[#DBEFF3] flex items-center gap-3 px-4 flex-shrink-0 sticky top-0 z-30 shadow-sm">
      {/* Mobile menu toggle */}
      <button
        onClick={onToggleMobile}
        className="md:hidden rounded-lg p-2 text-[#666666] hover:bg-[#DBEFF3] transition-colors"
        aria-label="Open navigation"
      >
        <IconMenu />
      </button>

      {/* Desktop collapse toggle */}
      <button
        onClick={onToggleCollapse}
        className="hidden md:flex rounded-lg p-2 text-[#666666] hover:bg-[#DBEFF3] transition-colors"
        aria-label="Toggle sidebar"
      >
        <IconMenu />
      </button>

      {/* Search */}
      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-all ${searchFocused ? "border-[#49B0C1] bg-[#DBEFF3]/40 w-72" : "border-[#DBEFF3] bg-[#DBEFF3]/40 w-52"} hidden sm:flex`}>
        <span className="text-[#666666]"><IconSearch /></span>
        <input
          type="text"
          placeholder="Search anything…"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          className="bg-transparent text-sm text-[#333333] placeholder-[#999] outline-none w-full"
        />
      </div>

      <div className="flex-1" />

      {/* Notifications */}
      <div className="relative">
        <button
          onClick={() => setNotifOpen((v) => !v)}
          className="relative rounded-lg p-2 text-[#666666] hover:bg-[#DBEFF3] transition-colors"
          aria-label="Notifications"
        >
          <IconBell />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>

        {notifOpen && (
          <div className="absolute right-0 top-12 w-80 bg-white rounded-xl border border-[#DBEFF3] shadow-xl z-50 overflow-hidden">
            <div className="bg-[#49B0C1] px-4 py-3 flex items-center justify-between">
              <p className="text-sm font-bold text-white">Notifications</p>
              <button onClick={() => setNotifOpen(false)} className="text-white/60 hover:text-white"><IconX /></button>
            </div>
            <div className="divide-y divide-[#DBEFF3]">
              {[
                { icon: "⚠️", text: "5 products near expiry date", time: "10 min ago", color: "bg-yellow-50" },
                { icon: "📦", text: "Stock reorder alert: Panadol 500mg", time: "1 hr ago", color: "bg-blue-50" },
                { icon: "✅", text: "PO-2026-0018 delivery confirmed", time: "3 hr ago", color: "bg-green-50" },
              ].map((n) => (
                <div key={n.text} className={`flex items-start gap-3 px-4 py-3 hover:bg-[#DBEFF3]/40 cursor-pointer ${n.color}`}>
                  <span className="text-base flex-shrink-0 mt-0.5">{n.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#333333] leading-snug">{n.text}</p>
                    <p className="text-[11px] text-[#666666] mt-0.5">{n.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-2.5 bg-[#DBEFF3]/40 border-t border-[#DBEFF3]">
              <button className="text-xs text-[#49B0C1] hover:underline font-medium">View all notifications →</button>
            </div>
          </div>
        )}
      </div>

      {/* Profile */}
      <div className="flex items-center gap-2.5 pl-2 border-l border-[#DBEFF3]">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#49B0C1] text-white text-sm font-bold flex-shrink-0">
          {user?.name?.charAt(0).toUpperCase() ?? "U"}
        </div>
        <div className="hidden sm:block text-right">
          <p className="text-xs font-semibold text-[#333333] leading-none">{user?.name}</p>
          <p className="text-[10px] text-[#666666] capitalize mt-0.5">{user?.role?.replace("_", " ")}</p>
        </div>
        <button
          onClick={handleLogout}
          className="ml-1 rounded-lg bg-[#DBEFF3] hover:bg-[#ABDBE3] transition-colors px-3 py-1.5 text-xs font-semibold text-[#333333]"
        >
          Logout
        </button>
      </div>
    </header>
  );
}

// ── App layout ────────────────────────────────────────────────────────────────

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auto-collapse on small desktop
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 1024 && window.innerWidth >= 768) {
        setCollapsed(true);
      } else if (window.innerWidth >= 1024) {
        setCollapsed(false);
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="flex h-full bg-[#F4F8FA]">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        {/* <TopBar
          onToggleMobile={() => setMobileOpen(true)}
          onToggleCollapse={() => setCollapsed((v) => !v)}
        /> */}

        <main className="flex-1 flex flex-col min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
