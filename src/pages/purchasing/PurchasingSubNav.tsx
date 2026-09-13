import { NavLink } from "react-router";

const SUB_LINKS = [
  { to: "/purchasing", label: "Requirements", end: true },
  { to: "/purchasing/orders", label: "Orders" },
  { to: "/purchasing/deliveries/new", label: "Deliveries" },
  { to: "/purchasing/payables", label: "Payables" },
  { to: "/purchasing/returns/new", label: "Returns" },
];

export default function PurchasingSubNav() {
  return (
    <nav className="bg-white border-b border-[#DBEFF3] px-4 sm:px-6 flex items-center gap-1 overflow-x-auto" aria-label="Purchasing sub-navigation">
      {SUB_LINKS.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              isActive
                ? "border-[#49B0C1] text-[#49B0C1]"
                : "border-transparent text-[#666666] hover:text-[#333333] hover:border-[#ABDBE3]"
            }`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
