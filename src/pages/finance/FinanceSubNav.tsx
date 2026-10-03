import { NavLink } from "react-router";

/**
 * Overview / Reports tabs for the Finance module.
 *
 * The first tab carries no leading padding of its own, so its label lines up
 * with the page title above it rather than sitting one inset further right.
 */
const SUB_LINKS = [
  { to: "/dashboard/finance", label: "Overview", end: true },
  { to: "/dashboard/finance/reports", label: "Reports", end: false },
];

export default function FinanceSubNav() {
  return (
    <nav
      className="bg-white border-b border-[#E6ECE2] px-4 sm:px-6 flex items-center gap-1 overflow-x-auto"
      aria-label="Finance sub-navigation"
    >
      {SUB_LINKS.map(({ to, label, end }, i) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `px-3 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7A9076]/40 ${
              i === 0 ? "pl-4 sm:pl-0" : ""
            } ${
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
  );
}