export const NARCOTIC_SALE_REMINDER =
  "Narcotic medicine — check the required prescription/reference before completing the sale";

export default function NarcoticBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700 ${className}`}
    >
      Narcotic
    </span>
  );
}
