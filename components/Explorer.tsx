"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { KINDS, LEVELS, levelName, snapshotDate, spaces, type Kind } from "@/data/hunt";
import LevelStack from "./LevelStack";
import SpaceList from "./SpaceList";
import SpaceDetail from "./SpaceDetail";

export default function Explorer() {
  // level and open space are in the URL so views can be shared and Back works
  const params = useSearchParams();
  const selected = spaces.find((s) => s.id === params.get("space")) ?? null;
  const levelParam = Number(params.get("level"));
  const level = LEVELS.some((l) => l.n === levelParam) ? levelParam : null;

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind | "all">("all");

  function go(patch: Record<string, string | number | null>, push = false) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key);
      else next.set(key, String(value));
    }
    const url = next.size ? `?${next}` : window.location.pathname;
    window.history[push ? "pushState" : "replaceState"](null, "", url);
  }

  const matching = useMemo(() => {
    const q = query.trim().toLowerCase();
    return spaces.filter(
      (s) => (kind === "all" || s.kind === kind) && (!q || s.title.toLowerCase().includes(q)),
    );
  }, [query, kind]);

  const counts = useMemo(() => {
    const out: Record<number, number> = {};
    for (const s of matching) if (s.level !== null) out[s.level] = (out[s.level] ?? 0) + 1;
    return out;
  }, [matching]);

  const listed = level === null ? matching : matching.filter((s) => s.level === level);
  const stackLevel = selected ? selected.level : level;

  return (
    <main className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,3fr)_minmax(400px,2fr)]">
      <section aria-label="Building" className="dot-grid relative flex min-w-0 flex-col px-5 pb-5 pt-6 sm:px-10 lg:pb-8 lg:pt-9">
        <div>
          <p className="annot text-pencil">James B. Hunt Jr. Library</p>
          <h1 className="mt-1.5 text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[36px]">
            {selected ? selected.title : level !== null ? `Level ${level} · ${levelName(level)}` : "Pick a level, find a place."}
          </h1>
          <p className="mt-2 text-[14px] text-graphite">
            {selected
              ? selected.level !== null
                ? `Level ${selected.level} · ${levelName(selected.level)}`
                : "Not tied to a single level"
              : level !== null
                ? (
                  <button type="button" onClick={() => go({ level: null })} className="underline decoration-rule-strong underline-offset-4 transition-colors duration-150 hover:decoration-ink">
                    Show all five levels
                  </button>
                )
                : matching.length === spaces.length
                  ? `${spaces.length} rooms and spaces across five levels.`
                  : `${matching.length} of ${spaces.length} spaces match your filters.`}
          </p>
        </div>

        <div className="flex flex-1 items-center py-2 lg:py-4">
          <LevelStack active={stackLevel} counts={counts} onSelect={(n) => go({ level: n, space: null }, selected !== null)} />
        </div>

        <p className="text-[12px] leading-relaxed text-pencil">
          Schematic, not to scale. Space details from NC State Libraries, captured{" "}
          {snapshotDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.
        </p>
      </section>

      <section aria-label="Spaces" className="min-h-0 min-w-0 border-t border-rule bg-sheet lg:overflow-y-auto lg:border-l lg:border-t-0">
        {selected ? (
          <SpaceDetail space={selected} onBack={() => go({ space: null }, true)} />
        ) : (
          <>
            <div className="sticky top-0 z-10 border-b border-rule bg-sheet/95 px-5 pb-3 pt-5 backdrop-blur-sm sm:px-7">
              <label className="relative block">
                <span className="sr-only">Search rooms and spaces</span>
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-pencil">
                  <circle cx="7" cy="7" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <path d="m10.25 10.25 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or room number"
                  className="h-10 w-full rounded-lg bg-vellum pl-9 pr-3 text-[14px] placeholder:text-pencil focus-visible:outline-offset-0"
                />
              </label>
              <div className="-mx-5 mt-3 flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:-mx-7 sm:px-7" role="group" aria-label="Filter by type">
                {[{ id: "all" as const, label: "All" }, ...KINDS].map((k) => {
                  const on = kind === k.id;
                  return (
                    <button
                      key={k.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setKind(k.id)}
                      className={`h-8 shrink-0 rounded-full px-3 text-[13px] font-medium transition-[background-color,color,transform] duration-150 ease-out-quint active:scale-[0.97] ${
                        on ? "bg-ink text-sheet" : "text-graphite shadow-[inset_0_0_0_1px_var(--color-rule)] hover:bg-vellum hover:text-ink"
                      }`}
                    >
                      {k.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-5 pb-12 pt-6 sm:px-7">
              {listed.length > 0 ? (
                <SpaceList spaces={listed} onOpen={(s) => go({ space: s.id }, true)} />
              ) : (
                <div className="py-16 text-center">
                  <p className="text-[16px] font-semibold">Nothing matches that.</p>
                  <p className="mt-1 text-[14px] text-graphite">
                    {level !== null ? `Nothing on level ${level} fits these filters.` : "Try a room number like 3212, or a different type."}
                  </p>
                  <button
                    type="button"
                    onClick={() => { setQuery(""); setKind("all"); go({ level: null }); }}
                    className="mt-5 h-9 rounded-lg px-4 text-[13px] font-medium shadow-[inset_0_0_0_1px_var(--color-rule-strong)] transition-colors duration-150 hover:bg-vellum"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
