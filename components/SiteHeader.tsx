import Link from "next/link";

const PAGES = [
  { href: "/", label: "Find a place" },
  { href: "/trends", label: "Trends" },
] as const;

export default function SiteHeader({ current }: { current: (typeof PAGES)[number]["href"] }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-rule px-5 sm:px-10">
      <Link href="/" className="text-[17px] font-bold tracking-[-0.02em]">
        Study<span className="rounded-[3px] bg-accent px-0.5">Scape</span>
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
