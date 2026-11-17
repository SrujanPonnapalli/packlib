import Image from "next/image";
import { KINDS, LEVELS, type Kind, type Space } from "@/data/hunt";
import { BUSY_LABEL, zoneFor } from "@/lib/occupancy";
import { BusyDot, type Live } from "./Busy";

// numbered rooms of these kinds are basically identical, so show them as a grid
// of tiles instead of sixty rows that only differ by one number
const PLAQUE_KINDS: Kind[] = ["study", "grad", "faculty"];
const isPlaque = (s: Space) => s.room !== null && PLAQUE_KINDS.includes(s.kind);
const kindLabel = (k: Kind) => KINDS.find((x) => x.id === k)!.label;

type Props = { spaces: Space[]; live: Live; onOpen: (s: Space) => void };

export default function SpaceList({ spaces, live, onOpen }: Props) {
  const groups = [...LEVELS.map((l) => l.n), null]
    .map((n) => ({ n, items: spaces.filter((s) => s.level === n) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-9">
      {groups.map(({ n, items }) => {
        const levelBusy = n !== null ? live.data?.levels[n]?.busy : null;
        return (
        <section key={n ?? "around"} aria-labelledby={`level-${n}`}>
          <h2 id={`level-${n}`} className="flex items-baseline gap-2 border-b border-rule pb-2">
            <span className="text-[14px] font-semibold">{n === null ? "Around Hunt" : `Level ${n}`}</span>
            {levelBusy && (
              <span className="flex items-center gap-1.5 self-center text-[12px] text-graphite">
                <BusyDot busy={levelBusy} />
                {BUSY_LABEL[levelBusy]} now
              </span>
            )}
            <span className="ml-auto text-[12px] tabular-nums text-pencil">{items.length}</span>
          </h2>

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
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5">
                  {rooms.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => onOpen(s)}
                        aria-label={s.title}
                        className="plaque h-11 w-full rounded-md bg-paper text-[17px] font-semibold text-ink shadow-[inset_0_0_0_1px_var(--color-rule)] transition-[background-color,box-shadow,transform] duration-150 ease-out-quint hover:bg-sheet hover:shadow-lift active:scale-[0.97]"
                      >
                        {s.room}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
        );
      })}
    </div>
  );
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0 text-faint transition-transform duration-150 ease-out-quint group-hover:translate-x-0.5 group-hover:text-graphite">
      <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
