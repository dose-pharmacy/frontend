import { NavLink } from "react-router"

/**
 * Dashboard tab navigation.
 *
 * Only the Overview tab renders dashboard content in this task; the other tabs
 * are deep links to the module pages that already exist in the router. No new
 * routes were invented.
 */
const SUB_LINKS = [
  { to: "/dashboard", label: "Overview", end: true },
  { to: "/dashboard/sales", label: "Sales", end: false },
  { to: "/inventory", label: "Inventory", end: false },
  { to: "/purchasing", label: "Purchasing", end: false },
  { to: "/dashboard/profitability", label: "Finance", end: false },
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