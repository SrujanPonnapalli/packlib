"use client";

import { useEffect, useState } from "react";
import type { Space } from "@/data/hunt";
import { BUSY_LABEL, STALE_MS, ago, people, zoneFor, type Busy, type Occupancy, type Reading } from "@/lib/occupancy";

const HATCH: Record<Busy, string> = { quiet: "hatch-quiet", busy: "hatch-busy", packed: "hatch-packed" };

/** Hatched swatch, denser lines = more people (see the hatch classes in globals.css). */
export function BusyDot({ busy, className = "" }: { busy: Busy; className?: string }) {
  return <span aria-hidden="true" className={`inline-block size-2.5 shrink-0 rounded-[2px] shadow-[inset_0_0_0_1px_rgb(23_23_23/0.22)] ${HATCH[busy]} ${className}`} />;
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
      {/* if the heading already says how busy it is, just add the count */}
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

/**
 * Stock-ticker style number: when it changes, each changed digit slides out and the
 * new one slides in (up if the number went up, down if it went down).
 * `from` starts it there and ticks to `value` on mount.
 */
/** `lift` is how far digits move (fraction of their height), `stagger` delays each column after the ones. */
export function Ticker({ value, format: fmt, comma, suffix = "", from, className = "", ms = 280, lift = 100, stagger = 35 }: { value: number; format?: (v: number) => string; comma?: boolean; suffix?: string; from?: number; className?: string; ms?: number; lift?: number; stagger?: number }) {
  // `comma`/`suffix` exist because server components can't pass a function
  const format = fmt ?? ((v: number) => (comma ? v.toLocaleString("en-US") : String(v)) + suffix);
  const [t, setT] = useState({ shown: value, prev: from ?? value, n: 0 });
  if (value !== t.shown) setT({ shown: value, prev: t.shown, n: t.n + 1 });
  const now = format(t.shown);
  const before = format(t.prev);
  const dir = t.shown >= t.prev ? "up" : "down";
  const len = Math.max(now.length, before.length);
  const at = (s: string, i: number) => s[s.length - len + i] ?? "";
  return (
    <span className={`inline-flex tabular-nums ${className}`} style={{ ["--tick" as string]: `${ms}ms`, ["--tick-y" as string]: `${lift}%` }}>
      <span className="sr-only">{now}</span>
      {Array.from({ length: len }, (_, i) => {
        const c = at(now, i);
        const b = at(before, i);
        const moved = c !== b;
        // keyed from the right so the ones column stays the ones column when 985 becomes 1,002
        const delay = { animationDelay: `${(len - 1 - i) * stagger}ms` };
        return (
          <span key={len - i} aria-hidden="true" className="relative inline-block overflow-hidden">
            <span key={`in${t.n}`} className={`block ${moved ? `tick-in-${dir}` : ""}`} style={delay}>
              {c || "\u200b"}
            </span>
            {moved && b && (
              <span key={`out${t.n}`} className={`absolute inset-0 block tick-out-${dir}`} style={delay}>
                {b}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

/** Counts a number up from 0 once on mount. Returns null when done (or with reduced motion) so later changes tick instead. */
function useCountUp(target: number, ms = 1400) {
  const [shown, setShown] = useState<number | null>(0);
  useEffect(() => {
    const dur = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
    const t0 = performance.now();
    let id = 0;
    const step = (t: number) => {
      const k = dur ? Math.min(1, (t - t0) / dur) : 1;
      if (k === 1) return setShown(null);
      setShown(Math.round(target * (1 - Math.pow(1 - k, 5)))); // ease-out quint: fast, then settles on the number
      id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
    // only the first value counts up, the target is only read once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return shown;
}

function HeroNumber({ value }: { value: number }) {
  const counting = useCountUp(value);
  const cls = "plaque text-[88px] font-semibold leading-none tracking-[-0.03em] sm:text-[112px] lg:text-[136px]";
  return counting === null ? <Ticker value={value} ms={650} comma className={cls} /> : <span className={`inline-flex tabular-nums ${cls}`}>{counting.toLocaleString("en-US")}</span>;
}

/** The big number: how many people are in the building right now. */
export function HeroCount({ live, where }: { live: Live; where: string }) {
  const { data, now } = live;
  const b = data?.building;
  if (!data || !b || b.count === null || b.busy === null) return null;
  return (
    <div className="arrive [--d:140ms] lg:text-right">
      <HeroNumber value={b.count} />
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

// what each level means, using NC State's cut-offs for most areas (exceptions are in lib/occupancy.ts)
const MEANS: Record<Busy, string> = {
  quiet: "Up to a quarter of the seats taken",
  busy: "A quarter to just under half the seats taken",
  packed: "Almost half the seats or more taken",
};

/** Swatches for the model's heat colors. Hover or focus one to see what it means. */
export function BusyKey() {
  return (
    <div className="pointer-events-auto flex items-center gap-1 text-[11px] text-graphite">
      {(Object.keys(BUSY_LABEL) as Busy[]).map((b) => (
        <span key={b} tabIndex={0} aria-describedby={`means-${b}`} className="group relative flex cursor-help items-center gap-1.5 rounded px-1 py-0.5 hover:text-ink">
          <BusyDot busy={b} />
          {BUSY_LABEL[b]}
          <span
            id={`means-${b}`}
            role="tooltip"
            className="pointer-events-none absolute bottom-full right-0 mb-2 w-max max-w-[200px] translate-y-1 rounded-md bg-ink/95 px-2.5 py-1.5 text-[11px] leading-snug text-sheet opacity-0 shadow-lift transition-[opacity,translate] duration-150 ease-out-quint group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
          >
            {MEANS[b]}. Some areas use different cut-offs.
          </span>
        </span>
      ))}
    </div>
  );
}
