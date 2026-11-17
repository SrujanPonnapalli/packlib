"use client";

import { useState } from "react";
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

/**
 * A number on a stock ticker: when it changes, each digit that changed slides out and its
 * replacement slides in, upward when the number rose and downward when it fell.
 * `from` starts it there and ticks to `value` on mount.
 */
export function Ticker({ value, format = String, from, className = "", ms = 280 }: { value: number; format?: (v: number) => string; from?: number; className?: string; ms?: number }) {
  const [t, setT] = useState({ shown: value, prev: from ?? value, n: 0 });
  if (value !== t.shown) setT({ shown: value, prev: t.shown, n: t.n + 1 });
  const now = format(t.shown);
  const before = format(t.prev);
  const dir = t.shown >= t.prev ? "up" : "down";
  const len = Math.max(now.length, before.length);
  const at = (s: string, i: number) => s[s.length - len + i] ?? "";
  return (
    <span className={`inline-flex tabular-nums ${className}`} style={{ ["--tick" as string]: `${ms}ms` }}>
      <span className="sr-only">{now}</span>
      {Array.from({ length: len }, (_, i) => {
        const c = at(now, i);
        const b = at(before, i);
        const moved = c !== b;
        // Keyed from the right, so the ones column stays the ones column when 985 becomes 1,002; the ones lead.
        const delay = { animationDelay: `${(len - 1 - i) * 35}ms` };
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

/** The first answer, at the size of an answer: how many people are in the building right now. */
export function HeroCount({ live, where }: { live: Live; where: string }) {
  const { data, now } = live;
  const b = data?.building;
  if (!data || !b || b.count === null || b.busy === null) return null;
  return (
    <div className="arrive [--d:140ms] lg:text-right">
      <Ticker value={b.count} from={0} ms={650} className="plaque text-[88px] font-semibold leading-none tracking-[-0.03em] sm:text-[112px] lg:text-[136px]" />
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
