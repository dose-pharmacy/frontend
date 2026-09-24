import { Link } from "react-router";

interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1.5 px-6 py-3 border-b border-[#C6D4BF] bg-white text-sm" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-[#C6D4BF]">→</span>}
          {item.to ? (
            <Link to={item.to} className="text-[#7A9076] hover:underline font-medium">
              {item.label}
            </Link>
          ) : (
            <span className="text-[#666666]">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
