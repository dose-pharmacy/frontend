import { NavLink } from "react-router"

/**
 * Dashboard tab navigation.
 *
 * Scoped to dashboard content only: Overview, Sales, Credit, Narcotics and
 * Finance are real pages in the router, each answering a different question —
 * what needs attention now, what sales happened, what money is owed, what
 * controlled medicines are held and moving, and how the pharmacy is doing.
 * Inventory and Purchasing are deliberately absent: they are full modules, not
 * dashboard tabs, and remain reachable from the sidebar, which links every
 * Inventory and Purchasing page directly. No new routes were invented.
 */
const SUB_LINKS = [
  { to: "/dashboard", label: "Overview", end: true },
  { to: "/dashboard/sales", label: "Sales", end: false },
  { to: "/dashboard/credit", label: "Credit", end: false },
  { to: "/dashboard/narcotics", label: "Narcotics", end: false },
  { to: "/dashboard/finance", label: "Finance", end: false },
]

export default function DashboardSubNav() {
  return (
    <nav
      className="bg-white border-b border-[#E6ECE2] px-4 sm:px-6 flex items-center gap-1 overflow-x-auto"
      aria-label="Dashboard sub-navigation"
    >
      {SUB_LINKS.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7A9076]/40 ${
              isActive
                ? "border-[#7A9076] text-[#4F6B4A]"
                : "border-transparent text-[#666666] hover:text-[#333333] hover:border-[#C6D4BF]"
            }`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  )
}