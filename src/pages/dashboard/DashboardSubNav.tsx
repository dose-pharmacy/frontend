import { NavLink } from "react-router"

const SUB_LINKS = [
  { to: "/dashboard", label: "Overview", end: true },
  { to: "/dashboard/sales", label: "Sales" },
  { to: "/dashboard/profitability", label: "Profitability" },
]

export default function DashboardSubNav() {
  return (
    <nav
      className="bg-white border-b border-[#DBEFF3] px-4 sm:px-6 flex items-center gap-1 overflow-x-auto"
      aria-label="Dashboard sub-navigation"
    >
      {SUB_LINKS.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              isActive
                ? "border-[#49B0C1] text-[#2A7F8C]"
                : "border-transparent text-[#666666] hover:text-[#333333] hover:border-[#A5D6E0]"
            }`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  )
}