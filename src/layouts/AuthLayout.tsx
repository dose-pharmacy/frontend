import { Outlet } from "react-router";

export default function AuthLayout() {
  return (
    <div className="min-h-full bg-white flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-[#49B0C1] px-12 relative overflow-hidden">
        {/* decorative circles */}
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-white/10" />
        <div className="absolute top-1/3 right-8 h-40 w-40 rounded-full bg-white/5" />

        <div className="relative z-10 text-center text-white">
          {/* logo mark */}
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm shadow-lg">
            <svg className="h-11 w-11 text-white" viewBox="0 0 48 48" fill="none" aria-hidden>
              <rect x="20" y="4" width="8" height="40" rx="4" fill="currentColor"/>
              <rect x="4" y="20" width="40" height="8" rx="4" fill="currentColor"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3">PharmaCare</h1>
          <p className="text-lg font-semibold text-white/90 mb-2">Pharmacy Management System</p>
          <p className="text-sm text-white/70 max-w-xs leading-relaxed">
            Streamline your pharmacy operations — from inventory and expiry tracking to point-of-sale and purchasing.
          </p>

          <div className="mt-12 grid grid-cols-2 gap-4 text-left">
            {[
              { icon: "📦", label: "Inventory Control" },
              { icon: "🧾", label: "Point of Sale" },
              { icon: "📊", label: "Reports & Analytics" },
              { icon: "🔔", label: "Expiry Alerts" },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3">
                <span className="text-lg">{icon}</span>
                <span className="text-sm font-medium text-white/90">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — auth form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-12">
        {/* mobile logo */}
        <div className="mb-8 flex flex-col items-center lg:hidden">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-[#49B0C1] shadow">
            <svg className="h-8 w-8 text-white" viewBox="0 0 48 48" fill="none" aria-hidden>
              <rect x="20" y="4" width="8" height="40" rx="4" fill="currentColor"/>
              <rect x="4" y="20" width="40" height="8" rx="4" fill="currentColor"/>
            </svg>
          </div>
          <span className="text-lg font-bold text-[#333333]">PharmaCare</span>
          <span className="text-sm text-[#666666]">Pharmacy Management System</span>
        </div>

        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
