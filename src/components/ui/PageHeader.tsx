interface PageHeaderProps {
  title: string;
  /**
   * `ReactNode`, not `string`, so a page that is still loading can put a
   * `SkeletonBar` here instead of the word "Loading". Every existing caller
   * passes a plain string, which this still accepts unchanged.
   */
  subtitle?: React.ReactNode;
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
          {/* A `div`, not a `p`: the subtitle may now contain block-level
              skeleton bars, which are not valid inside a paragraph. Tailwind's
              preflight zeroes margins, so this looks identical to the old `p`. */}
          {subtitle && <div className="text-sm text-black/75 mt-0.5">{subtitle}</div>}
        </div>
        {actions && <div className="flex items-center gap-3 flex-wrap">{actions}</div>}
      </div>
    </div>
  );
}
