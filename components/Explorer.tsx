"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { KINDS, LEVELS, landmark, snapshotDate, spaces, type Kind } from "@/data/hunt";
import LevelRail from "./LevelRail";
import LevelStack from "./LevelStack";
import SpaceList from "./SpaceList";
import SpaceDetail from "./SpaceDetail";
import { BusyKey, HeroCount, LiveNote } from "./Busy";
import { useOccupancy } from "./useOccupancy";
import StudyMatch, { CHIP, DEFAULT_ASK, chipState, findMatches } from "./StudyMatch";
import { BUSY_LABEL } from "@/lib/occupancy";
import type { Ask } from "@/lib/match";

// three.js is only fetched where the 3D model is shown.
const BuildingScene = dynamic(() => import("./BuildingScene"), { ssr: false });

// Phones get the flat stack: a draggable 3D canvas would fight page scrolling.
const WIDE = "(min-width: 1024px)";
const subscribeWide = (fn: () => void) => {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", fn);
  return () => mq.removeEventListener("change", fn);
};

export default function Explorer() {
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => false);
  // Level and open space live in the URL so a view can be shared and Back works.
  const params = useSearchParams();
  const selected = spaces.find((s) => s.id === params.get("space")) ?? null;
  const levelParam = Number(params.get("level"));
  const level = LEVELS.some((l) => l.n === levelParam) ? levelParam : null;

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind | "all">("study"); // most visitors want a study room
  const live = useOccupancy();
  // The panel opens on Study Match: most visitors come with a task, not to browse.
  const [mode, setMode] = useState<"match" | "browse">("match");
  const [ask, setAsk] = useState<Ask>(DEFAULT_ASK);
  const [highlight, setHighlight] = useState<string | null>(null);
  const result = useMemo(() => findMatches(ask, live.data), [ask, live.data]);
  const matchRefs = mode === "match" ? result.matches.map((m) => { const s = spaces.find((x) => x.id === m.id)!; return s.room ?? s.title; }) : [];
  const busy = useMemo(
    () => Object.fromEntries(LEVELS.map(({ n }) => [n, live.data?.levels[n]?.busy ?? null])),
    [live.data],
  );

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

  // With nothing picked, the heading answers the first question: how busy is it?
  const overall = live.data?.building.busy ?? null;
  const said = !selected && level === null && overall !== null;
  const hero = said && live.data?.building.count != null;
  // While the first reading loads, hold the hero's space so the heading doesn't jump when it lands.
  const heroPending = !selected && level === null && live.data === undefined;

  const listed = level === null ? matching : matching.filter((s) => s.level === level);
  const stackLevel = selected ? selected.level : level;
  // Picking a level while a space is open leaves the space.
  const selectLevel = (n: number | null) => go({ level: n, space: null }, selected !== null);

  return (
    <main className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,3fr)_minmax(400px,2fr)]">
      <section aria-label="Building" className="dot-grid relative flex min-w-0 flex-col px-5 pb-5 pt-6 sm:px-10 lg:pb-8 lg:pt-9">
        <div className="pointer-events-none relative z-10 [&_button]:pointer-events-auto">
          <p className="annot arrive text-pencil">James B. Hunt Jr. Library</p>
          {/* With nothing picked, the live headcount is the hero: below the label on phones, opposite the heading on wide screens. */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between lg:gap-8">
          {(hero || heroPending) && (
            <div className="mt-2 lg:order-last lg:-mt-5">
              {hero ? (
                <HeroCount live={live} where="Hunt" />
              ) : (
                <div aria-hidden="true" className="flex flex-col gap-1 lg:items-end">
                  <div className="skeleton h-[88px] w-[160px] rounded-lg sm:h-[112px] sm:w-[200px] lg:h-[136px] lg:w-[230px]" />
                  <div className="skeleton h-5 w-[210px] rounded" />
                </div>
              )}
            </div>
          )}
          <div className="min-w-0">
          <h1 className="arrive mt-1.5 text-[28px] [--d:80ms] [text-wrap:balance] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[36px]">
            {selected ? selected.title : level !== null ? `Level ${level}` : said ? `Hunt is ${BUSY_LABEL[overall!].toLowerCase()} right now.` : "Find a place to study in Hunt."}
          </h1>
          <p className="arrive mt-2 text-[14px] text-graphite [--d:160ms]">
            {selected ? (
              selected.level !== null ? `Level ${selected.level}` : "Not tied to a single level"
            ) : level !== null ? (
              <>
                Home of the {landmark(level)}.{" "}
                <button type="button" onClick={() => go({ level: null })} className="underline decoration-rule-strong underline-offset-4 transition-colors duration-150 hover:decoration-ink">
                  Show all five levels
                </button>
              </>
            ) : mode === "match" ? (
              result.matches.length ? (
                `Your best match is on Level ${spaces.find((x) => x.id === result.matches[0].id)!.level}${wide ? ", numbered on the model" : ""}.`
              ) : (
                "Nothing fits those answers yet."
              )
            ) : kind === "all" && !query.trim() ? (
              `${spaces.length} rooms and spaces across five levels.`
            ) : (
              `Showing ${matching.length} of ${spaces.length} rooms and spaces.`
            )}
          </p>
          {!hero && !heroPending && <LiveNote live={live} level={level} space={selected} said={said} />}
          </div>
          </div>
        </div>

        {wide ? (
          <>
            {/* The model fills the whole panel; the heading and caption float over it. */}
            <BuildingScene
              active={stackLevel}
              selectedRef={selected ? (selected.room ?? selected.title) : null}
              onSelectLevel={selectLevel}
              onOpenSpace={(id) => go({ space: id }, true)}
              onClear={() => go({ space: null }, true)}
              occupancy={live.data}
              matches={matchRefs}
              highlight={highlight}
            />
            <div className="absolute left-10 top-1/2 z-10 -translate-y-1/2">
              <LevelRail active={stackLevel} counts={counts} busy={busy} onSelect={selectLevel} />
            </div>
            <div className="min-h-[360px] flex-1" />
          </>
        ) : (
          <div className="flex flex-1 items-center py-2">
            <LevelStack active={stackLevel} counts={counts} busy={busy} onSelect={selectLevel} />
          </div>
        )}

        <div className="pointer-events-none relative z-10 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <p className="max-w-[60ch] text-[12px] leading-relaxed text-pencil">
            Schematic, not to scale. {wide && "Traced by eye from the Libraries' floor maps. Drag to turn, scroll to zoom. "}
            Space details from NC State Libraries, captured{" "}
            {snapshotDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.
            {live.data && ` Headcounts are live from the Libraries' sensors${wide ? "; where each person is drawn is made up" : ""}.`}
          </p>
          {wide && live.data && <BusyKey />}
        </div>
      </section>

      <section aria-label="Spaces" className="min-h-0 min-w-0 border-t border-rule bg-sheet lg:overflow-y-auto lg:border-l lg:border-t-0">
        {selected ? (
          <SpaceDetail space={selected} live={live} onBack={() => go({ space: null }, true)} />
        ) : (
          <>
            <div className="flex gap-1 border-b border-rule px-5 pt-4 sm:px-7" role="tablist" aria-label="Find or browse">
              {(
                [
                  ["match", "Find a spot"],
                  ["browse", "Browse all"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={mode === id}
                  onClick={() => setMode(id)}
                  className={`-mb-px h-10 border-b-2 px-2 text-[14px] font-medium transition-colors duration-150 ${
                    mode === id ? "border-ink text-ink" : "border-transparent text-pencil hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {mode === "match" ? (
              <StudyMatch ask={ask} onAsk={setAsk} result={result} onModel={wide} onOpen={(s) => go({ space: s.id }, true)} onHover={setHighlight} />
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
                {[...KINDS, { id: "all" as const, label: "Everything" }].map((k) => {
                  const on = kind === k.id;
                  return (
                    <button
                      key={k.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setKind(k.id)}
                      className={`shrink-0 ${CHIP} ${chipState(on)}`}
                    >
                      {k.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-5 pb-12 pt-6 sm:px-7">
              {listed.length > 0 ? (
                <SpaceList spaces={listed} live={live} onOpen={(s) => go({ space: s.id }, true)} />
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
          </>
        )}
      </section>
    </main>
  );
}
