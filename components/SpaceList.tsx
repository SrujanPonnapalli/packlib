import { useState } from "react";
import Image from "next/image";
import { KINDS, LEVELS, type Kind, type Space } from "@/data/hunt";
import { BUSY_LABEL, zoneFor } from "@/lib/occupancy";
import { BusyDot, type Live } from "./Busy";

// Numbered rooms of these kinds are near-identical, so they show as a grid of
// door plaques instead of sixty rows that differ by one number.
const PLAQUE_KINDS: Kind[] = ["study", "grad", "faculty"];
const isPlaque = (s: Space) => s.room !== null && PLAQUE_KINDS.includes(s.kind);
const kindLabel = (k: Kind) => KINDS.find((x) => x.id === k)!.label;

type Props = { spaces: Space[]; live: Live; onOpen: (s: Space) => void };

export default function SpaceList({ spaces, live, onOpen }: Props) {
  const groups = [...LEVELS.map((l) => l.n), null]
    .map((n) => ({ n, items: spaces.filter((s) => s.level === n) }))
    .filter((g) => g.items.length > 0);
  // Levels you've folded away; all start open.
  const [folded, setFolded] = useState<Set<number | null>>(new Set());
  const toggle = (n: number | null) => setFolded((f) => (f.has(n) ? new Set([...f].filter((x) => x !== n)) : new Set([...f, n])));

  return (
    <div className="flex flex-col gap-9">
      {groups.map(({ n, items }, gi) => {
        const levelBusy = n !== null ? live.data?.levels[n]?.busy : null;
        return (
        // A new filter or floor remounts the list (keyed by the caller): each level fades in after the one above.
        <section key={n ?? "around"} aria-labelledby={`level-${n}`} className="animate-enter" style={{ animationDelay: `${Math.min(gi, 4) * 50}ms` }}>
          <h2 id={`level-${n}`} className="border-b border-rule">
            <button
              type="button"
              aria-expanded={!folded.has(n)}
              aria-controls={`level-${n}-body`}
              onClick={() => toggle(n)}
              className="group -mx-2 flex w-[calc(100%+1rem)] items-baseline gap-2 rounded-md px-2 pb-2 pt-1 text-left transition-colors duration-150 hover:bg-vellum/60"
            >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={`shrink-0 self-center text-pencil transition-transform duration-200 ease-out-quint group-hover:text-ink ${folded.has(n) ? "-rotate-90" : ""}`}>
              <path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[14px] font-semibold">{n === null ? "Around Hunt" : `Level ${n}`}</span>
            {levelBusy && (
              <span className="flex items-center gap-1.5 self-center text-[12px] text-graphite">
                <BusyDot busy={levelBusy} />
                {BUSY_LABEL[levelBusy]} now
              </span>
            )}
            <span className="ml-auto text-[12px] tabular-nums text-pencil">{items.length}</span>
            </button>
          </h2>

          <div
            id={`level-${n}-body`}
            inert={folded.has(n)}
            className={`grid transition-[grid-template-rows,opacity] duration-[240ms] ease-out-quint ${folded.has(n) ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}
          >
          <div className="min-h-0 overflow-hidden">
          <ul>
            {items.filter((s) => !isPlaque(s)).map((s) => {
              const zone = zoneFor(live.data, s.room ?? s.title);
              return (
              <li key={s.id} className="border-b border-rule-soft">
                <button
                  type="button"
                  onClick={() => onOpen(s)}
                  className="group -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors duration-150 hover:bg-vellum/60"
                >
                  <span className="relative h-10 w-14 shrink-0 overflow-hidden rounded-md bg-vellum outline outline-1 -outline-offset-1 outline-black/10">
                    {s.photo && <Image src={s.photo.thumb} alt="" fill sizes="56px" className="object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{s.title}</span>
                    <span className="block truncate text-[12px] text-pencil">
                      {kindLabel(s.kind)}
                      {s.room && ` · ${s.room}`}
                      {s.reservable && " · Reservable"}
                    </span>
                  </span>
                  {zone?.busy && (
                    <span className="flex shrink-0 items-center gap-1.5 text-[12px] text-graphite">
                      <BusyDot busy={zone.busy} />
                      {BUSY_LABEL[zone.busy]}
                    </span>
                  )}
                  <Chevron />
                </button>
              </li>
              );
            })}
          </ul>

          {PLAQUE_KINDS.map((k) => {
            const rooms = items.filter((s) => isPlaque(s) && s.kind === k);
            if (rooms.length === 0) return null;
            return (
              <div key={k} className="mt-4">
                <h3 className="mb-2 text-[12px] text-pencil">
                  {kindLabel(k)} <span className="tabular-nums">· {rooms.length}</span>
                </h3>
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-1.5">
                  {rooms.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => onOpen(s)}
                        aria-label={[s.title, s.seats && `${s.seats} seats`, s.fitout?.display && "wall display", s.fitout?.whiteboard && "whiteboard"].filter(Boolean).join(", ")}
                        className="flex w-full flex-col items-start rounded-md bg-paper px-2.5 py-2 text-left shadow-[inset_0_0_0_1px_var(--color-rule)] transition-[background-color,box-shadow,transform] duration-150 ease-out-quint hover:bg-sheet hover:shadow-lift active:scale-[0.97]"
                      >
                        <span className="plaque text-[17px] font-semibold leading-none text-ink">{s.room}</span>
                        {/* Seats on the left as one unit (chair + count), fit-out on the right, so the number can only belong to the chair. */}
                        <span className="mt-2 flex w-full items-center gap-1.5">
                          {s.seats ? (
                            <span title={`${s.seats} seats`} className="flex h-5 items-center gap-1 whitespace-nowrap rounded bg-vellum px-1.5 text-[12px] font-semibold leading-none tabular-nums text-ink">
                              <ChairIcon />
                              {s.seats}
                            </span>
                          ) : (
                            <span className="text-[11px] text-faint">Seats not listed</span>
                          )}
                          <span className="ml-auto flex items-center gap-1">
                            {s.fitout?.display && <DisplayIcon />}
                            {s.fitout?.whiteboard && <BoardIcon />}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          </div>
          </div>
        </section>
        );
      })}
    </div>
  );
}

// Seats: Lucide's "armchair" (ISC licence), inlined.
function ChairIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" className="text-graphite">
      <path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3" />
      <path d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z" />
      <path d="M5 18v2" />
      <path d="M19 18v2" />
    </svg>
  );
}

// Tiny fit-out marks for the room tiles: a screen on a stand, and a board with a line drawn on it.
function DisplayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="text-graphite">
      <title>Wall display</title>
      <rect x="1" y="2" width="10" height="6.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 10.5h4M6 8.5v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
function BoardIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="text-graphite">
      <title>Whiteboard</title>
      <rect x="1" y="1.5" width="10" height="9" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="m3 7.5 2-2 1.5 1.5L9 4.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0 text-faint transition-transform duration-150 ease-out-quint group-hover:translate-x-0.5 group-hover:text-graphite">
      <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
