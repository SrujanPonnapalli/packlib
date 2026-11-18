"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BUSY_LABEL, people } from "@/lib/occupancy";
import type { LibrarySlug } from "@/data/libraries";
import { BusyDot } from "./Busy";
import { useOccupancy } from "./useOccupancy";

export const LAST_KEY = "studyscape:library";

/** Remembers the library you last looked at, so `/` can take you back there. */
export function rememberLibrary(slug: LibrarySlug) {
  try {
    localStorage.setItem(LAST_KEY, slug);
  } catch {} // private windows can refuse storage; the picker just shows again
}

type Card = { slug: LibrarySlug; name: string; full: string; blurb: string; spaces: number; floors: string };

// Only a visit that starts at `/` jumps to the last library, and only once: the logo still reaches the picker.
let jumped = false;

export default function LibraryPicker({ cards }: { cards: Card[] }) {
  const router = useRouter();
  useEffect(() => {
    const entry = performance.getEntriesByType("navigation")[0];
    if (jumped || (entry && new URL(entry.name).pathname !== "/")) return;
    jumped = true;
    let last: string | null = null;
    try {
      last = localStorage.getItem(LAST_KEY);
    } catch {}
    const known = cards.find((c) => c.slug === last);
    if (known) router.replace(`/${known.slug}`);
  }, [cards, router]);

  return (
    <ul className="mt-8 grid gap-4 sm:grid-cols-2">
      {cards.map((c, i) => (
        <li key={c.slug} className="arrive" style={{ ["--d" as string]: `${120 + i * 80}ms` }}>
          <PickerCard card={c} />
        </li>
      ))}
    </ul>
  );
}

function PickerCard({ card: c }: { card: Card }) {
  const live = useOccupancy(c.slug);
  const b = live.data?.building;
  return (
    <Link
      href={`/${c.slug}`}
      onClick={() => rememberLibrary(c.slug)}
      className="group flex h-full flex-col rounded-xl bg-sheet p-5 shadow-[inset_0_0_0_1px_var(--color-rule)] transition-[box-shadow,transform] duration-150 ease-out-quint hover:shadow-lift active:scale-[0.99] sm:p-6"
    >
      <span className="annot text-pencil">{c.full}</span>
      <span className="mt-2 flex items-baseline justify-between gap-4">
        <span className="text-[40px] font-semibold leading-none tracking-[-0.03em] sm:text-[48px]">{c.name}</span>
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="shrink-0 text-pencil transition-[color,translate] duration-150 ease-out-quint group-hover:translate-x-0.5 group-hover:text-ink">
          <path d="M4 10h11m-4-4.5L15.5 10 11 14.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="mt-3 text-[14px] leading-relaxed text-graphite [text-wrap:pretty]">{c.blurb}</span>
      <span className="mt-5 flex min-h-5 flex-wrap items-center gap-x-1.5 border-t border-rule pt-4 text-[13px] tabular-nums">
        {live.data === undefined ? (
          <span className="text-pencil">Checking how busy it is…</span>
        ) : b?.busy ? (
          <>
            <BusyDot busy={b.busy} className="mr-0.5" />
            <span className="font-semibold">{BUSY_LABEL[b.busy]}</span>
            <span className="text-graphite">· {people(b.count)} now</span>
          </>
        ) : (
          <span className="text-pencil">No live headcount right now</span>
        )}
      </span>
      <span className="mt-1 text-[12px] tabular-nums text-pencil">
        {c.spaces} rooms and spaces · {c.floors}
      </span>
    </Link>
  );
}
