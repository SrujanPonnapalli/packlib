import type { Space } from "@/data/hunt";
import { BUSY_LABEL, STALE_MS, ago, people, zoneFor, type Busy, type Occupancy, type Reading } from "@/lib/occupancy";

const HATCH: Record<Busy, string> = { quiet: "hatch-quiet", busy: "hatch-busy", packed: "hatch-packed" };

/** A hatched swatch: denser lines, more people (see the hatch classes in globals.css). */
export function BusyDot({ busy, className = "" }: { busy: Busy; className?: string }) {
  return <span aria-hidden="true" className={`inline-block size-2.5 shrink-0 rounded-[2px] shadow-[inset_0_0_0_1px_rgb(29_28_26/0.22)] ${HATCH[busy]} ${className}`} />;
}

export type Live = { data: Occupancy | null | undefined; now: number };

/** The reading that best describes a space: its own sensor zone, else its level's. */
export function readingFor({ data }: Live, space: Space): { reading: Reading; own: boolean } | null {
  const zone = zoneFor(data, space.room ?? space.title);
  if (zone) return { reading: zone, own: true };
  const level = space.level !== null ? data?.levels[space.level] : undefined;
  return level ? { reading: level, own: false } : null;
}

const stale = ({ data, now }: Live) => data != null && now - Date.parse(data.at) > STALE_MS;

/** One line under the heading: how busy the building, level or space is right now. */
export function LiveNote({ live, level, space, said = false }: { live: Live; level: number | null; space: Space | null; said?: boolean }) {
  const { data, now } = live;
  const base = "mt-3 flex min-h-5 flex-wrap items-center gap-x-1.5 text-[13px] leading-5 tabular-nums";
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
      {/* When the heading already says how busy it is, the note only adds the count. */}
      {!said && <span className="font-semibold">{BUSY_LABEL[reading.busy]}</span>}
      <span className="text-graphite">
        {!said && "· "}
        {people(reading.count)} {where}
      </span>
      <span className="text-pencil">
        · updated {ago(data.at, now)}
        {stale(live) && ", may be out of date"}
      </span>
    </p>
  );
}

/** Digits on rollers: they spin up from zero on arrival and roll to each new reading. */
export function Odometer({ value, className = "" }: { value: number; className?: string }) {
  const digits = String(value).split("");
  return (
    <span className={`inline-flex tabular-nums ${className}`}>
      <span className="sr-only">{value}</span>
      {digits.map((d, i) => (
        // Keyed from the right, so the ones column stays the ones column when 985 becomes 1,002.
        <span key={digits.length - i} aria-hidden="true" className="relative inline-block h-[1em] overflow-hidden">
          <span
            className="roll flex flex-col transition-transform duration-[900ms] ease-out-quint"
            style={{ transform: `translateY(-${Number(d)}em)`, ["--d" as string]: `${300 + i * 70}ms` }}
          >
            {"0123456789".split("").map((n) => (
              <span key={n} className="block h-[1em] leading-[1em]">
                {n}
              </span>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}

/** The first answer, at the size of an answer: how many people are in the building right now. */
export function HeroCount({ live, where }: { live: Live; where: string }) {
  const { data, now } = live;
  const b = data?.building;
  if (!data || !b || b.count === null || b.busy === null) return null;
  return (
    <div className="arrive [--d:140ms] lg:text-right">
      <Odometer value={b.count} className="plaque text-[88px] font-semibold leading-none tracking-[-0.03em] sm:text-[112px] lg:text-[136px]" />
      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[13px] leading-5 tabular-nums text-graphite lg:justify-end">
        <BusyDot busy={b.busy} className="mr-0.5" />
        <span className="font-medium text-ink">people in {where} now</span>
        <span className="text-pencil">
          · updated {ago(data.at, now)}
          {stale(live) && ", may be out of date"}
        </span>
      </p>
    </div>
  );
}

/** Swatches for the model's heat colours. */
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
