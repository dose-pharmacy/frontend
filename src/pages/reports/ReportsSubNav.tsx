import { NavLink } from "react-router";

const SUB_LINKS = [
  { to: "/reports", label: "Overview", end: true },
  { to: "/reports/sales", label: "Sales" },
  { to: "/reports/profitability", label: "Profitability" },
  { to: "/reports/slow-moving", label: "Slow Moving" },
  { to: "/reports/narcotics", label: "Narcotics" },
];

export default function ReportsSubNav() {
  return (
    <nav className="bg-white border-b border-[#E6ECE2] px-4 sm:px-6 flex items-center gap-1 overflow-x-auto" aria-label="Reports sub-navigation">
      {SUB_LINKS.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              isActive
                ? "border-[#B6C8AF] text-[#7A9076]"
                : "border-transparent text-[#666666] hover:text-[#333333] hover:border-[#C6D4BF]"
            }`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
