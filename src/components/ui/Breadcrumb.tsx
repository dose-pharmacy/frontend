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
    <nav className="flex items-center gap-1.5 px-6 py-3 border-b border-[#ABDBE3] bg-white text-sm" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-[#ABDBE3]">→</span>}
          {item.to ? (
            <Link to={item.to} className="text-[#49B0C1] hover:underline font-medium">
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
