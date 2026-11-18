import Link from "next/link";

import { LIBRARIES, type LibrarySlug } from "@/data/libraries";

const PAGES = [
  { id: "find", path: "", label: "Find a place" },
  { id: "trends", path: "/trends", label: "Trends" },
] as const;

type Page = (typeof PAGES)[number]["id"];

/** Without a library (the picker at `/`) just show the logo. */
export default function SiteHeader({ library, current }: { library?: LibrarySlug; current?: Page }) {
  const path = PAGES.find((p) => p.id === current)?.path ?? "";
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-rule px-5 sm:gap-4 sm:px-10">
      <Link href="/" aria-label="StudyScape: choose a library" className="flex items-center gap-2 text-[17px] font-bold tracking-[-0.02em]">
        {/* three stacked plates with one highlighted */}
        <svg width="18" height="16" viewBox="0 0 18 16" aria-hidden="true">
          <path d="M9 1.5 16.5 4.5 9 7.5 1.5 4.5Z" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
          <path d="M9 5 16.5 8 9 11 1.5 8Z" fill="var(--color-accent)" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
          <path d="M1.5 11.5 9 14.5l7.5-3" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {/* on phones the switch and page links need the space, the logo stays */}
        <span className={library ? "hidden sm:inline" : undefined}>StudyScape</span>
      </Link>
      {library && (
        <>
          {/* Hunt | Hill: same page in the other library */}
          <nav aria-label="Library" className="flex rounded-lg bg-vellum p-0.5">
            {(Object.keys(LIBRARIES) as LibrarySlug[]).map((slug) => (
              <Link
                key={slug}
                href={`/${slug}${path}`}
                aria-current={slug === library ? "page" : undefined}
                className={`rounded-md px-2.5 py-1 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-150 ${
                  slug === library ? "bg-sheet text-ink shadow-[0_0_0_1px_var(--color-rule),0_1px_2px_rgb(23_23_23/0.06)]" : "text-pencil hover:text-ink"
                }`}
              >
                {LIBRARIES[slug].name}
              </Link>
            ))}
          </nav>
          <span className="hidden h-4 w-px bg-rule-strong sm:block" aria-hidden="true" />
          <nav aria-label="Pages" className="flex gap-1">
            {PAGES.map((p) => (
              <Link
                key={p.id}
                href={`/${library}${p.path}`}
                aria-current={p.id === current ? "page" : undefined}
                className={`whitespace-nowrap rounded-md px-2 py-1 text-[13px] font-medium transition-colors duration-150 ${
                  p.id === current ? "text-ink" : "text-pencil hover:bg-vellum hover:text-ink"
                }`}
              >
                {p.label}
              </Link>
            ))}
          </nav>
        </>
      )}
      <p className="ml-auto hidden text-[12px] text-pencil lg:block">An independent NC State study-space explorer</p>
    </header>
  );
}
