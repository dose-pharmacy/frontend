import { useNavigate } from "react-router"
import { Boxes, ChevronRight, Package, ShoppingCart, Truck } from "lucide-react"
import { SectionLabel } from "./Panel"

interface QuickAction {
  label: string
  caption: string
  to: string
  icon: React.ReactNode
}

// Same routes/handlers as before — presentation only.
const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "New Sale",
    caption: "Open point of sale",
    to: "/pos",
    icon: <ShoppingCart className="h-5 w-5" />,
  },
  {
    label: "Purchase Requirement",
    caption: "Create a requirement",
    to: "/purchasing/requirements/new",
    icon: <Package className="h-5 w-5" />,
  },
  {
    label: "New Purchase Order",
    caption: "Create a purchase order",
    to: "/purchasing/orders/new",
    icon: <Boxes className="h-5 w-5" />,
  },
  {
    label: "Receive Goods",
    caption: "Receive incoming inventory",
    to: "/purchasing/deliveries/new",
    icon: <Truck className="h-5 w-5" />,
  },
]

export default function QuickActions() {
  const navigate = useNavigate()

  return (
    <section aria-label="Quick actions" className="flex flex-col gap-3">
      <SectionLabel>Quick Actions</SectionLabel>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => navigate(action.to)}
            className="group flex items-center gap-4 rounded-xl border border-[#DBEFF3] bg-white px-4 py-4 text-left shadow-sm transition-all hover:border-[#49B0C1] hover:bg-[#DBEFF3]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#49B0C1]"
          >
            <span
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-[#49B0C1] text-white transition-transform group-hover:scale-105"
              aria-hidden
            >
              {action.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-[#333333]">
                {action.label}
              </span>
              <span className="mt-0.5 block truncate text-xs text-[#666666]">
                {action.caption}
              </span>
            </span>
            <ChevronRight
              className="h-4 w-4 flex-shrink-0 text-[#999999] transition-transform group-hover:translate-x-1 group-hover:text-[#2A7F8C]"
              aria-hidden
            />
          </button>
        ))}
      </div>
    </section>
  )
}
