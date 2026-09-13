import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { getBatch, getProduct, getTransactions, daysUntilExpiry } from "../../features/inventory/inventoryService";
import type { Batch, Product, Transaction } from "../../features/inventory/inventoryMock";
import Breadcrumb from "../../components/ui/Breadcrumb";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import ConfirmationDialog from "../../components/ui/ConfirmationDialog";

export default function BatchDetailPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [recallOpen, setRecallOpen] = useState(false);
  const [recalling, setRecalling] = useState(false);

  useEffect(() => {
    if (!batchId) return;
    getBatch(batchId).then(async (b) => {
      if (!b) { navigate("/inventory/batches"); return; }
      setBatch(b);
      const [p, t] = await Promise.all([getProduct(b.productId), getTransactions(b.productId)]);
      setProduct(p);
      setTransactions(t.filter((tx) => tx.batchId === batchId));
      setLoading(false);
    });
  }, [batchId, navigate]);

  async function handleRecall() {
    setRecalling(true);
    await new Promise((r) => setTimeout(r, 1000));
    setRecalling(false);
    setRecallOpen(false);
    alert("Batch recalled (mock). Real implementation requires backend.");
  }

  if (loading) return (
    <div className="flex flex-col">
      <div className="p-6 animate-pulse space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-[#DBEFF3]" />)}</div>
    </div>
  );

  if (!batch || !product) return null;

  const days = daysUntilExpiry(batch.expiryDate);
  const daysColor = days < 0 ? "text-red-600" : days <= 30 ? "text-orange-600" : days <= 60 ? "text-yellow-600" : "text-green-600";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Breadcrumb items={[{ label: "Inventory", to: "/inventory" }, { label: "Batches", to: "/inventory/batches" }, { label: batch.batchNumber }]} />

      <div className="p-6 flex flex-col gap-6">
        {/* Batch info */}
        <div className="bg-[#DBEFF3] rounded-xl p-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoItem label="Batch Number" value={batch.batchNumber} mono />
            <InfoItem label="Product" value={product.name} />
            <InfoItem label="Quantity" value={String(batch.quantity)} />
            <InfoItem label="Received Date" value={batch.receivedDate} />
            <InfoItem label="Expiry Date" value={batch.expiryDate} />
            <InfoItem label="Supplier" value={batch.supplier} />
            <InfoItem label="Location" value={batch.location} />
            <div>
              <p className="text-xs text-[#666666] font-medium uppercase tracking-wide">Status</p>
              <div className="mt-1"><StatusBadge status={batch.status} /></div>
            </div>
            <div>
              <p className="text-xs text-[#666666] font-medium uppercase tracking-wide">Days Remaining</p>
              <p className={`text-2xl font-bold mt-1 ${daysColor}`}>
                {days < 0 ? "Expired" : `${days} days`}
              </p>
            </div>
          </div>
        </div>

        {/* Transaction history */}
        <section>
          <h3 className="text-base font-bold text-[#333333] mb-3">Transaction History</h3>
          <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
            {transactions.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[#666666]">No transactions recorded for this batch.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#DBEFF3]">
                      {["Date", "Type", "Quantity", "Reference"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-semibold text-[#333333]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t, i) => (
                      <tr key={t.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/30"}>
                        <td className="px-4 py-3 text-[#666666]">{t.date}</td>
                        <td className="px-4 py-3 capitalize text-[#333333]">{t.type}</td>
                        <td className="px-4 py-3 font-semibold text-[#333333]">{t.quantity}</td>
                        <td className="px-4 py-3 font-mono text-xs text-[#666666]">{t.reference}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setRecallOpen(true)}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
          >
            Recall This Batch
          </button>
          <Button onClick={() => alert("Transfer — backend integration pending")}>Transfer</Button>
          <Button variant="secondary" onClick={() => alert("Adjust — backend integration pending")}>Adjust</Button>
        </div>
      </div>

      <ConfirmationDialog
        open={recallOpen}
        title="Recall This Batch?"
        message={`This will recall batch ${batch.batchNumber}. This action cannot be undone. Proceed?`}
        confirmLabel="Recall Batch"
        onConfirm={handleRecall}
        onCancel={() => setRecallOpen(false)}
        loading={recalling}
        danger
      />
    </div>
  );
}

function InfoItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-[#666666] font-medium uppercase tracking-wide">{label}</p>
      <p className={`mt-1 font-semibold text-[#333333] ${mono ? "font-mono text-sm" : "text-sm"}`}>{value}</p>
    </div>
  );
}
