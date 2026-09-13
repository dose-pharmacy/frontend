import { useNavigate } from "react-router";
import { useAuth } from "../features/auth/AuthContext";

const MODULES = [
  { label: "Inventory", sub: "Products, batches, expiry", to: "/inventory", color: "bg-[#49B0C1]", available: true },
  { label: "POS", sub: "Point of sale", to: "/pos", color: "bg-[#49B0C1]", available: true },
  { label: "Purchasing", sub: "Purchase orders, suppliers", to: "/purchasing", color: "bg-[#49B0C1]", available: true },
  { label: "Reports", sub: "Analytics & reports", to: "/reports", color: "bg-[#49B0C1]", available: true },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="p-6 max-w-5xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#333333]">Welcome back, {user?.name}</h1>
        <p className="text-sm text-[#666666] mt-1">Pharmacy Management System — select a module to get started.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {MODULES.map(({ label, sub, to, color, available }) => (
          <button
            key={to}
            onClick={() => available ? navigate(to) : undefined}
            disabled={!available}
            className={`rounded-2xl p-6 text-left transition-all border ${
              available
                ? `${color} text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 border-transparent`
                : "bg-white border-[#DBEFF3] text-[#999] cursor-not-allowed"
            }`}
          >
            <p className="font-bold text-base">{label}</p>
            <p className={`text-xs mt-1 ${available ? "text-white/75" : "text-[#999]"}`}>{sub}</p>
            {!available && <p className="text-xs mt-2 font-medium text-[#ABDBE3]">Coming soon</p>}
          </button>
        ))}
      </div>
    </div>
  );
}
