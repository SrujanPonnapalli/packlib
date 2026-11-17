import Link from "next/link";

const PAGES = [
  { href: "/", label: "Find a place" },
  { href: "/trends", label: "Trends" },
] as const;

export default function SiteHeader({ current }: { current: (typeof PAGES)[number]["href"] }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-rule px-5 sm:px-10">
      <Link href="/" className="flex items-center gap-2 text-[17px] font-bold tracking-[-0.02em]">
        {/* Three stacked plates, one picked out: the site's whole idea in a mark. */}
        <svg width="18" height="16" viewBox="0 0 18 16" aria-hidden="true">
          <path d="M9 1.5 16.5 4.5 9 7.5 1.5 4.5Z" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
          <path d="M9 5 16.5 8 9 11 1.5 8Z" fill="var(--color-accent)" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
          <path d="M1.5 11.5 9 14.5l7.5-3" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        StudyScape
      </Link>
      <span className="h-4 w-px bg-rule-strong" aria-hidden="true" />
      <nav aria-label="Pages" className="flex gap-1">
        {PAGES.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            aria-current={p.href === current ? "page" : undefined}
            className={`rounded-md px-2 py-1 text-[13px] font-medium transition-colors duration-150 ${
              p.href === current ? "text-ink" : "text-pencil hover:bg-vellum hover:text-ink"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </nav>
      <p className="ml-auto hidden text-[12px] text-pencil md:block">Hunt Library · an independent NC State study-space explorer</p>
    </header>
  );
}
