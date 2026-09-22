import { Outlet } from "react-router";
import { Boxes, ChartColumn, Cross, Receipt, Bell } from "lucide-react";

function IconCube() {
  return <Boxes className="h-5 w-5 text-[#7A9076]" />;
}
function IconReceipt() {
  return <Receipt className="h-5 w-5 text-[#7A9076]" />;
}
function IconChart() {
  return <ChartColumn className="h-5 w-5 text-[#7A9076]" />;
}
function IconBell() {
  return <Bell className="h-5 w-5 text-[#7A9076]" />;
}

export default function AuthLayout() {
  return (
    <div className="min-h-full bg-[#FAF9F4] flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-[#E6ECE2] px-12 relative overflow-hidden">
        {/* decorative circles */}
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-white/40" />
        <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-white/40" />
        <div className="absolute top-1/3 right-8 h-40 w-40 rounded-full bg-white/30" />

        <div className="relative z-10 text-center text-[#333333]">
          {/* logo mark */}
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/70 backdrop-blur-sm shadow-lg">
            <Cross className="h-11 w-11 text-[#333333]" strokeWidth={2} aria-hidden />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3">DOSE PHARMACY</h1>
          <p className="text-lg font-semibold text-[#333333]/90 mb-2">Pharmacy Management System</p>
          <p className="text-sm text-[#333333]/70 max-w-xs leading-relaxed">
            Streamline your pharmacy operations — from inventory and expiry tracking to point-of-sale and purchasing.
          </p>

          <div className="mt-12 grid grid-cols-2 gap-4 text-left">
            {[
              { icon: <IconCube />, label: "Inventory Control" },
              { icon: <IconReceipt />, label: "Point of Sale" },
              { icon: <IconChart />, label: "Reports & Analytics" },
              { icon: <IconBell />, label: "Expiry Alerts" },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl bg-white/70 px-4 py-3">
                <span className="flex-shrink-0">{icon}</span>
                <span className="text-sm font-medium text-[#333333]/90">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — auth form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-12">
        {/* mobile logo */}
        <div className="mb-8 flex flex-col items-center lg:hidden">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-[#B6C8AF] shadow">
            <Cross className="h-8 w-8 text-[#333333]" strokeWidth={2} aria-hidden />
          </div>
          <span className="text-lg font-bold text-[#333333]">DOSE PHARMACY</span>
          <span className="text-sm text-[#666666]">Pharmacy Management System</span>
        </div>

        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
