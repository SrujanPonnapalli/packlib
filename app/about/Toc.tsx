"use client";

import { useEffect, useState } from "react";

/** Contents list that marks the section being read. */
export default function Toc({ sections }: { sections: readonly { id: string; short: string }[] }) {
  const [current, setCurrent] = useState(sections[0].id);

  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter((e) => e !== null);
    // a section counts as current once its top passes the upper third of the screen
    const io = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting).map((e) => e.target.id);
        if (seen.length) setCurrent(sections.find((s) => seen.includes(s.id))!.id);
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  return (
    <nav aria-label="On this page" className="hidden lg:block">
      <ol className="sticky top-8 space-y-0.5 border-l border-rule text-[13px]">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              onClick={() => setCurrent(s.id)}
              aria-current={s.id === current ? "location" : undefined}
              className="-ml-px block border-l py-1 pl-4 transition-colors duration-200 border-transparent text-pencil hover:text-ink aria-[current]:border-ink aria-[current]:font-medium aria-[current]:text-ink"
            >
              {s.short}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
