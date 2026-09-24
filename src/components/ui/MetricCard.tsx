interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  subtitle?: string;
}

export default function MetricCard({ title, value, icon, subtitle }: MetricCardProps) {
  return (
    <div className="rounded-xl bg-[#E6ECE2] p-5 flex items-start gap-4">
      <div className="flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-lg bg-white/60 text-[#7A9076]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[#666666] uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-[#333333] leading-tight mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-[#666666] mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
