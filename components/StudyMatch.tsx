import { useState } from "react";
import Image from "next/image";
import { KINDS, spaces, type Space } from "@/data/hunt";
import { hoursOf, match, type Ask, type Candidate, type Match, type Vibe } from "@/lib/match";
import { BUSY_LABEL, zoneFor, type Busy, type Occupancy } from "@/lib/occupancy";
import { BusyDot, readingFor, type Live } from "./Busy";

// How each open space feels, from the Libraries' own descriptions
// ("a tranquil, light-filled space", "colorful soft seating", "promotes group collaboration").
const VIBE: Record<string, Vibe> = {
  "Quiet Reading Room": "quiet",
  "Skyline Reading Room": "quiet",
  "Carrel Corridor": "quiet",
  "Rain Garden Reading Lounge": "lounge",
  "Oval View Reading Room": "lounge",
  "Skyline Terrace": "lounge",
  "Monumental Stair with Roman Seating": "lounge",
  "Learning Commons": "social",
  "Lake Raleigh Learning Commons": "social",
  "Idea Alcove": "social",
  "Graduate Student Commons": "social",
  "Faculty Research Commons": "social",
};

const ROOM_KINDS = new Set(["study", "grad", "faculty"]);

/** Everything Study Match may suggest: open seating with a known feel, and bookable study, graduate and faculty rooms. */
export function candidates(occupancy: Occupancy | null | undefined): Candidate[] {
  return spaces
    .filter((s) => s.level !== null && (VIBE[s.title] || (s.reservable && s.room && (ROOM_KINDS.has(s.kind) || s.title === "Cornelson Meeting Room"))))
    .map((s) => {
      const zone = zoneFor(occupancy, s.room ?? s.title);
      return {
        id: s.id,
        title: s.title,
        level: s.level!,
        room: s.room,
        bookable: s.reservable,
        eligible: s.reservableBy,
        seats: s.seats ?? (Number(/seating for (\d+)/.exec(s.description ?? "")?.[1]) || null),
        solo: /Focus/.test(s.title),
        individual: s.title === "Carrel Corridor",
        display: Boolean(s.fitout?.display || /screen|display/i.test(s.description ?? "")),
        whiteboard: Boolean(s.fitout?.whiteboard),
        outsideWindow: s.fitout?.window === "exterior",
        maxHours: hoursOf(s.maxBooking),
        vibe: VIBE[s.title],
        busy: zone?.busy ?? null,
        count: zone?.count ?? null,
      };
    });
}

export const DEFAULT_ASK: Ask = { size: 1, work: "focus", when: "now", hours: 2, who: "undergrad" };

export function findMatches(ask: Ask, occupancy: Occupancy | null | undefined) {
  return match(candidates(occupancy), ask);
}

type Option<T> = [T, string];
const QUESTIONS: { key: keyof Ask; label: string; options: Option<Ask[keyof Ask]>[] }[] = [
  { key: "size", label: "How many of you?", options: [[1, "Just me"], [3, "2–3"], [6, "4–6"], [8, "7 or more"]] },
  { key: "work", label: "To do what?", options: [["focus", "Focus"], ["group", "Work together"], ["present", "Practise a talk"], ["unwind", "Read, unwind"]] },
  { key: "when", label: "When?", options: [["now", "Right now"], ["later", "Later, booked ahead"]] },
  { key: "hours", label: "For how long?", options: [[2, "Up to 2 hours"], [4, "Half a day"], [8, "All day"]] },
  { key: "who", label: "You are", options: [["undergrad", "Undergrad"], ["grad", "Grad student"], ["faculty", "Faculty"], ["staff", "Staff"]] },
];

const kindLabel = (s: Space) => KINDS.find((k) => k.id === s.kind)!.label.replace(/s$/, "").replace("Graduate", "Graduate room").replace("Faculty", "Faculty room");

type Props = {
  ask: Ask;
  onAsk: (a: Ask) => void;
  result: ReturnType<typeof match>;
  /** Live headcounts, for each result's count. */
  live: Live;
  /** Whether the 3D model (and its numbered pins) is on screen. */
  onModel: boolean;
  onOpen: (s: Space) => void;
  /** A result card is hovered or focused (its space's geometry ref), or no longer is. */
  onHover?: (ref: string | null) => void;
};

export const CHIP =
  "h-10 rounded-full px-3.5 text-[14px] font-medium transition-[background-color,color,transform] duration-150 ease-out-quint active:scale-[0.96] sm:h-8 sm:px-3 sm:text-[13px]";
export const chipState = (on: boolean) => (on ? "bg-ink text-sheet" : "text-graphite shadow-[inset_0_0_0_1px_var(--color-rule)] hover:bg-vellum hover:text-ink");

export default function StudyMatch({ ask, onAsk, result, live, onModel, onOpen, onHover }: Props) {
  const { matches, ruled } = result;
  // The defaults already give an answer, so the answer leads and the questions fold into one sentence you can open.
  const [editing, setEditing] = useState(false);
  const sentence = QUESTIONS.map((q) => q.options.find(([v]) => v === ask[q.key])![1]);
  return (
    <div className="px-5 pb-12 pt-5 sm:px-7">
      <button
        type="button"
        aria-expanded={editing}
        aria-controls="match-questions"
        onClick={() => setEditing(!editing)}
        className="arrive group -mx-2 flex w-[calc(100%+1rem)] [--d:240ms] items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-150 hover:bg-vellum/60"
      >
        <span className="min-w-0 flex-1">
          <span className="annot block text-pencil">Matching for</span>
          <span className="mt-1 block text-[15px] font-medium leading-snug text-ink [text-wrap:pretty]">
            {sentence.map((s, i) => (
              <span key={i}>
                {i > 0 && <span className="text-faint"> · </span>}
                <span className="underline decoration-rule-strong decoration-dotted underline-offset-4">{s}</span>
              </span>
            ))}
          </span>
        </span>
        <span className="mt-[18px] flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[13px] font-medium text-graphite shadow-[inset_0_0_0_1px_var(--color-rule)] group-hover:text-ink">
          {editing ? "Done" : "Change"}
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={`transition-transform duration-200 ease-out-quint ${editing ? "rotate-180" : ""}`}>
            <path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      <div
        id="match-questions"
        inert={!editing}
        className={`grid transition-[grid-template-rows,opacity] duration-[240ms] ease-out-quint ${editing ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
      <div className="min-h-0 overflow-hidden">
      <div className="flex flex-col gap-4 pb-1 pt-4">
        {QUESTIONS.map((q) => (
          <fieldset key={q.key}>
            <legend className="mb-1.5 text-[12px] font-medium text-pencil">{q.label}</legend>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={q.label}>
              {q.options.map(([value, label]) => {
                const on = ask[q.key] === value;
                return (
                  <button
                    key={String(value)}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => onAsk({ ...ask, [q.key]: value })}
                    className={`${CHIP} ${chipState(on)}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      </div>
      </div>

      <h2 className="mt-6 flex items-baseline gap-2 border-b border-rule pb-2" aria-live="polite">
        <span className="text-[14px] font-semibold">{matches.length ? "Best places for you" : "Nothing fits all of that"}</span>
        <span className="ml-auto text-[12px] text-pencil">{matches.length && onModel ? "Also marked on the model" : ""}</span>
      </h2>

      {matches.length ? (
        <ol key={JSON.stringify(ask)} className="mt-3 flex flex-col gap-2.5">
          {matches.map((m, i) => (
            <Result key={m.id} rank={i + 1} m={m} live={live} onOpen={onOpen} onHover={onHover} />
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-[14px] leading-relaxed text-graphite">
          Everything was ruled out:{" "}
          {Object.entries(ruled)
            .map(([why, n]) => `${n} ${why}`)
            .join(", ")}
          . Try a smaller group or a different kind of work.
        </p>
      )}

      <p className="mt-6 text-[12px] leading-relaxed text-pencil">
        Ranked by room details and live headcounts. Bookings aren&apos;t public, so check a room is free.
      </p>
    </div>
  );
}

// The live line is drawn on its own, in the busyness notation, so it isn't lost among the reasons.
const LIVE: Record<string, Busy> = { "Not busy right now": "quiet", "Busy right now": "busy", "Very busy right now": "packed" };

// Reasons as short tags. Walking in is already said by "Open seating", so it isn't repeated.
const TAG: Record<string, string | null> = {
  "No booking needed: just walk in": null,
  "A quiet space: no talking": "Quiet, no talking",
  "A quiet space, so you'll work side by side in silence": "Quiet",
  "An office-like room made for one": "Room for one",
  "A room to yourself, with a door": "Private room",
  "A room with a door, away from the noise": "Has a door",
  "Soft seating, usually calm": "Soft seating",
  "Whiteboard walls to work things out on": "Whiteboard walls",
  "A room you can talk in": "Talking OK",
  "An open area made for working together": "Group area",
  "A wall display to share a laptop": "Wall display",
  "A wall display to practise on": "Wall display",
  "Soft seating and a relaxed feel": "Relaxed",
  "Lively, with room to spread out": "Lively",
  "Calm and light-filled": "Calm and bright",
  "You can book it ahead": "Book ahead",
  "Stay as long as you like": "No time limit",
  "Outside windows": "Windows",
};
const tag = (r: string) => (r in TAG ? TAG[r] : r.startsWith("Seats ") ? r.split(",")[0] : r);

function Result({ rank, m, live, onOpen, onHover }: { rank: number; m: Match; live: Live; onOpen: (s: Space) => void; onHover?: (ref: string | null) => void }) {
  const s = spaces.find((x) => x.id === m.id)!;
  const ref = s.room ?? s.title;
  const busy = LIVE[[...m.reasons, ...m.cautions].find((r) => LIVE[r]) ?? ""];
  const found = readingFor(live, s);
  const count = found?.reading.count;
  const tags = m.reasons.filter((r) => !LIVE[r]).map(tag).filter((t): t is string => !!t).slice(0, 3);
  const caution = m.cautions.find((c) => !LIVE[c]);
  const first = rank === 1;
  return (
    // First visit: part of the arrival. After that, each new answer (which remounts the list) staggers the results in.
    <li className="arrive restagger" style={{ ["--d" as string]: `${320 + rank * 80}ms`, ["--s" as string]: `${(rank - 1) * 60}ms` }}>
      <button
        type="button"
        onClick={() => onOpen(s)}
        onPointerEnter={() => onHover?.(ref)}
        onPointerLeave={() => onHover?.(null)}
        onFocus={() => onHover?.(ref)}
        onBlur={() => onHover?.(null)}
        className={`group w-full rounded-xl p-4 text-left transition-[background-color,box-shadow,transform] duration-150 ease-out-quint hover:bg-sheet hover:shadow-lift active:scale-[0.99] ${
          first ? "bg-sheet shadow-[inset_0_0_0_1.5px_var(--color-accent-deep)]" : "shadow-[inset_0_0_0_1px_var(--color-rule)]"
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`plaque grid shrink-0 place-items-center rounded-[5px] font-semibold leading-none ${
              first ? "size-10 bg-accent text-[23px] text-ink" : "mt-0.5 ml-1 size-8 text-[18px] text-ink shadow-[inset_0_0_0_1.5px_var(--color-accent-deep)]"
            }`}
            aria-label={`Match ${rank}`}
          >
            {rank}
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block font-semibold leading-snug [text-wrap:balance] ${first ? "text-[17px]" : "text-[15px]"}`}>{s.title}</span>
            <span className="block text-[12px] text-pencil">
              Level {s.level} · {s.reservable ? kindLabel(s) : "Open seating"}
              {s.reservable && " · Book on NC State"}
            </span>
            {busy && (
              <span className="mt-2 flex items-center gap-2 text-[13px] leading-snug">
                <BusyDot busy={busy} />
                <span className="font-medium text-ink">{BUSY_LABEL[busy]}</span>
                {count != null && (
                  <span className="tabular-nums text-graphite">
                    · {count.toLocaleString("en-US")} {count === 1 ? "person" : "people"} {found!.own ? "here" : `on Level ${s.level}`}
                  </span>
                )}
              </span>
            )}
          </span>
          {s.photo && (
            <span className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-vellum outline outline-1 -outline-offset-1 outline-black/10">
              <Image src={s.photo.thumb} alt="" fill sizes="80px" className="object-cover transition-transform duration-300 ease-out-quint group-hover:scale-[1.04]" />
            </span>
          )}
        </div>
        {(tags.length > 0 || caution) && (
          <div className={`mt-3 ${first ? "pl-[52px]" : "pl-[48px]"}`}>
            {tags.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label="Why it fits">
                {tags.map((t) => (
                  <li key={t} className="rounded-full bg-vellum px-2.5 py-1 text-[12px] font-medium leading-none text-graphite">
                    {t}
                  </li>
                ))}
              </ul>
            )}
            {caution && <p className="mt-2 text-[12px] leading-snug text-pencil">{caution}</p>}
          </div>
        )}
        {m.similar.length > 0 && (
          <p className={`mt-2.5 text-[12px] text-pencil ${first ? "pl-[52px]" : "pl-[48px]"}`}>
            Same kind of room: <span className="plaque text-[13px] text-graphite">{m.similar.join(", ")}</span>
          </p>
        )}
      </button>
    </li>
  );
}
