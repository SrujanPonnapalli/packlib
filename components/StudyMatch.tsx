import { KINDS, spaces, type Space } from "@/data/hunt";
import { hoursOf, match, type Ask, type Candidate, type Match, type Vibe } from "@/lib/match";
import { zoneFor, type Occupancy } from "@/lib/occupancy";

// how each open space feels, based on the Libraries' own descriptions
// ("a tranquil, light-filled space", "colorful soft seating", "promotes group collaboration")
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

/** Everything Study Match can suggest: open seating with a known vibe, plus bookable study, grad and faculty rooms. */
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
        seats: s.fitout?.seats ?? (Number(/seating for (\d+)/.exec(s.description ?? "")?.[1]) || null),
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
  /** Whether the 3D model (and its pins) is on screen. */
  onModel: boolean;
  onOpen: (s: Space) => void;
};

export default function StudyMatch({ ask, onAsk, result, onModel, onOpen }: Props) {
  const { matches, ruled } = result;
  return (
    <div className="px-5 pb-12 pt-5 sm:px-7">
      <div className="flex flex-col gap-4">
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
                    className={`h-8 rounded-full px-3 text-[13px] font-medium transition-[background-color,color,transform] duration-150 ease-out-quint active:scale-[0.97] ${
                      on ? "bg-ink text-sheet" : "text-graphite shadow-[inset_0_0_0_1px_var(--color-rule)] hover:bg-vellum hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <h2 className="mt-8 flex items-baseline gap-2 border-b border-rule pb-2" aria-live="polite">
        <span className="text-[14px] font-semibold">{matches.length ? "Best places for you" : "Nothing fits all of that"}</span>
        <span className="ml-auto text-[12px] text-pencil">{matches.length && onModel ? "Also marked on the model" : ""}</span>
      </h2>

      {matches.length ? (
        <ol className="mt-3 flex flex-col gap-2.5">
          {matches.map((m, i) => (
            <Result key={m.id} rank={i + 1} m={m} onOpen={onOpen} />
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
        Ranked from the Libraries&apos; room details and live headcounts. NC State doesn&apos;t publish which rooms are booked, so check a room is free when you book it.
      </p>
    </div>
  );
}

function Result({ rank, m, onOpen }: { rank: number; m: Match; onOpen: (s: Space) => void }) {
  const s = spaces.find((x) => x.id === m.id)!;
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(s)}
        className="group w-full rounded-xl p-4 text-left shadow-[inset_0_0_0_1px_var(--color-rule)] transition-[background-color,box-shadow] duration-150 hover:bg-sheet hover:shadow-lift"
      >
        <div className="flex items-start gap-3">
          <span
            className={`plaque grid size-8 shrink-0 place-items-center rounded-md text-[19px] font-semibold leading-none ${rank === 1 ? "bg-accent text-ink" : "bg-vellum text-graphite"}`}
            aria-label={`Match ${rank}`}
          >
            {rank}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold leading-snug">{s.title}</span>
            <span className="block text-[12px] text-pencil">
              Level {s.level} · {s.reservable ? kindLabel(s) : "Open seating"}
              {s.reservable && " · Book on NC State"}
            </span>
          </span>
        </div>
        <ul className="mt-3 flex flex-col gap-1 pl-11">
          {m.reasons.slice(0, 3).map((r) => (
            <li key={r} className="flex gap-2 text-[13px] leading-snug text-graphite">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="mt-px shrink-0 text-accent-deep">
                <path d="m3 7.5 2.5 2.5L11 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {r}
            </li>
          ))}
          {m.cautions.slice(0, 2).map((c) => (
            <li key={c} className="flex gap-2 text-[12.5px] leading-snug text-pencil">
              <span aria-hidden="true" className="mx-[5px] mt-[6px] size-1 shrink-0 rounded-full bg-faint" />
              {c}
            </li>
          ))}
        </ul>
        {m.similar.length > 0 && (
          <p className="mt-2.5 pl-11 text-[12px] text-pencil">
            Same kind of room: <span className="plaque text-[13px] text-graphite">{m.similar.join(", ")}</span>
          </p>
        )}
      </button>
    </li>
  );
}
