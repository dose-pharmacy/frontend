// ── Finance in-page navigation ────────────────────────────────────────────────
// The Finance module is ONE page with two sections (Overview, Reports), so this
// navigates BETWEEN SECTIONS of the current document rather than between routes.
//
// Why anchors rather than `<NavLink>`: the page scrolls inside a
// `overflow-y-auto` container, not the window, so a plain `#hash` click would ask
// the browser to scroll the window and would silently do nothing. The parent page
// therefore owns the scrolling (`onNavigate`) and this component only renders the
// controls and the current position.
//
// Anchors stay real `<a href="#…">` elements, so they are keyboard focusable,
// middle-clickable and copy-linkable; the parent's handler scrolls and then
// replaces the URL fragment, which keeps a refresh on the shared link landing on
// the same section.

export interface FinanceSectionLink {
  /** Element id of the `<section>` — the hash target. */
  id: string;
  label: string;
}

export default function FinanceSectionNav({
  links,
  activeId,
  onNavigate,
}: {
  links: FinanceSectionLink[];
  /** Id of the section currently at the top of the scroll container. */
  activeId: string;
  onNavigate: (id: string) => void;
}) {
  return (
    <nav
      className="bg-white border-b border-[#E6ECE2] px-4 sm:px-6 flex items-center gap-1 overflow-x-auto"
      aria-label="Finance sections"
    >
      {links.map(({ id, label }, i) => {
        const isActive = activeId === id;
        return (
          <a
            key={id}
            href={`#${id}`}
            onClick={(e) => {
              // Handle the scroll ourselves (see the file comment) but keep the
              // link's real behaviour for modified clicks.
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              onNavigate(id);
            }}
            aria-current={isActive ? "true" : undefined}
            className={`px-3 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7A9076]/40 ${
              i === 0 ? "pl-4 sm:pl-0" : ""
            } ${
              isActive
                ? "border-[#7A9076] text-[#4F6B4A]"
                : "border-transparent text-[#666666] hover:text-[#333333] hover:border-[#C6D4BF]"
            }`}
          >
            {label}
          </a>
        );
      })}
    </nav>
  );
}
