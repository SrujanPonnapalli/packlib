import type { Space } from "@/data/hunt";
import { BUSY_LABEL, STALE_MS, ago, people, zoneFor, type Busy, type Occupancy, type Reading } from "@/lib/occupancy";

const DOT: Record<Busy, string> = { quiet: "bg-quiet", busy: "bg-busy", packed: "bg-packed" };

export function BusyDot({ busy, className = "" }: { busy: Busy; className?: string }) {
  return <span aria-hidden="true" className={`inline-block size-2 shrink-0 rounded-full ${DOT[busy]} ${className}`} />;
}

export type Live = { data: Occupancy | null | undefined; now: number };

/** Best reading for a space: its own sensor zone, otherwise its level's. */
export function readingFor({ data }: Live, space: Space): { reading: Reading; own: boolean } | null {
  const zone = zoneFor(data, space.room ?? space.title);
  if (zone) return { reading: zone, own: true };
  const level = space.level !== null ? data?.levels[space.level] : undefined;
  return level ? { reading: level, own: false } : null;
}

const stale = ({ data, now }: Live) => data != null && now - Date.parse(data.at) > STALE_MS;

/** Line under the heading saying how busy the building, level or space is right now. */
export function LiveNote({ live, level, space }: { live: Live; level: number | null; space: Space | null }) {
  const { data, now } = live;
  const base = "mt-3 flex min-h-5 flex-wrap items-center gap-x-1.5 text-[13px] leading-5";
  if (data === undefined) return <p className={`${base} text-pencil`}>Checking how busy it is…</p>;
  if (data === null) return <p className={`${base} text-pencil`}>Live headcounts are unavailable right now.</p>;

  const lv = space ? space.level : level;
  const found = space ? readingFor(live, space) : null;
  const reading = found?.reading ?? (lv !== null ? data.levels[lv] : data.building);
  const where = found?.own ? "here" : lv !== null ? `on Level ${lv}` : "in Hunt";
  if (!reading || reading.busy === null)
    return <p className={`${base} text-pencil`}>{lv === 1 ? "Level 1 has no people sensor." : `No live headcount ${where} right now.`}</p>;
  return (
    <p className={base}>
      <BusyDot busy={reading.busy} className="mr-0.5" />
      <span className="font-semibold">{BUSY_LABEL[reading.busy]}</span>
      <span className="text-graphite">
        · {people(reading.count)} {where}
      </span>
      <span className="text-pencil">
        · updated {ago(data.at, now)}
        {stale(live) && ", may be out of date"}
      </span>
    </p>
  );
}

/** Swatches for the model's heat colors. */
export function BusyKey() {
  return (
    <div className="flex items-center gap-3 text-[11px] text-graphite">
      {(Object.keys(BUSY_LABEL) as Busy[]).map((b) => (
        <span key={b} className="flex items-center gap-1.5">
          <BusyDot busy={b} />
          {BUSY_LABEL[b]}
        </span>
      ))}
    </div>
  );
}
