import OrderItemReceivingDetails from "../pages/purchasing/OrderItemReceivingDetails"

/** TEMPORARY debug view — renders OrderItemReceivingDetails with the sample
 *  PO-1367819629 payload so the component can be verified without auth.
 *  Remove this file and its route after verification. */
export default function DebugReceivingDetails() {
  return (
    <div className="min-h-screen bg-[#F7F5EF] p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-lg font-bold mb-1">
          Debug: OrderItemReceivingDetails
        </h1>
        <p className="text-sm text-[#666666] mb-4">
          Renders with the API sample for PO-1367819629 (Paracetamol 500mg,
          40/30/10 @ 50 ETB).
        </p>
        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
          <OrderItemReceivingDetails
            items={[
              {
                id: "item-1",
                name: "Paracetamol 500mg",
                sku: "Para-001",
                unitLabel: "Tablet",
                ordered: 40,
                received: 30,
                remaining: 10,
                unitCost: 50,
              },
              {
                id: "item-2",
                name: "Amoxicillin 250mg",
                sku: "Amox-002",
                unitLabel: "Capsule",
                ordered: 0,
                received: 0,
                remaining: 0,
                unitCost: 120,
              },
            ]}
          />
        </div>
      </div>
    </div>
  )
}