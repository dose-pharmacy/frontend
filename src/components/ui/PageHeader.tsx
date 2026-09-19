interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumb?: string;
  actions?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, breadcrumb, actions }: PageHeaderProps) {
  return (
    <div className="bg- white px-6 py-5">
      {breadcrumb && (
        <p className="text-xs text-black/60 font-medium mb-1 tracking-wide">{breadcrumb}</p>
      )}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-black">{title}</h1>
          {subtitle && <p className="text-sm text-black/75 mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-3 flex-wrap">{actions}</div>}
      </div>
    </div>
  );
}
