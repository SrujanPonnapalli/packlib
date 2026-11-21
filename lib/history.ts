// Turns NC State's live responses into stored history. The collector keeps
// every sensor NC State reports (building, levels, zones), even ones that are
// switched off, so gaps and outages show up later.

import { parse, sumLevel, type Reading, type Sensors } from "./occupancy.ts";

/** "building", "level#3", "zone#1342". */
export type Series = string;
/** One stored reading: [minute of the New York day, people or null, fraction of capacity or null]. */
export type Entry = [number, number | null, number | null];

const entry = (minute: number, r: Pick<Reading, "count" | "share">): Entry => [minute, r.count, r.share === null ? null : Math.round(r.share * 1000) / 1000];

// one shared formatter. making these is slow and slot() runs for every reading, which was timing out the history function
const NEW_YORK = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** New York calendar day and minute of the day, so days split at local midnight even across DST. */
export function slot(at: string): { day: string; minute: number } {
  const p = Object.fromEntries(NEW_YORK.formatToParts(new Date(at)).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute) };
}

/** UTC time for a New York day and minute: tries EST and EDT and keeps whichever maps back. */
export function instant(day: string, minute: number): number {
  const [y, m, d] = day.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, 0, minute);
  for (const h of [5, 4]) {
    const t = wall + h * 3_600_000;
    const s = slot(new Date(t).toISOString());
    if (s.day === day && s.minute === minute) return t;
  }
  return wall + 5 * 3_600_000; // only the hour skipped when clocks spring forward, which never has readings anyway
}

/**
 * All readings for the building and its levels, lined up on the building's
 * poll times (one poll writes every series with the same minute). Duplicate
 * minutes (when NC State hasn't updated between polls) get collapsed.
 */
export type History = {
  t: number[];
  total: (number | null)[];
  share: (number | null)[];
  levels: Record<number, (number | null)[]>;
  /** First day PackLib has readings for. */
  since: string | null;
  /** When this was read from storage. Used as "now" for everything shown with it. */
  readAt: number;
  /** typical() for each reading, worked out by the history function from a month of readings. Older deploys of it don't send this. */
  usual?: (number | null)[];
};

export function lineUp(days: Record<Series, { day: string; r: Entry[] }[]>, since: string | null, readAt: number): History {
  const byTime = (s: Series) => {
    const m = new Map<number, Entry>();
    for (const { day, r } of days[s] ?? []) for (const e of r) m.set(instant(day, e[0]), e);
    return m;
  };
  const building = byTime("building");
  const t = [...building.keys()].sort((a, b) => a - b);
  const levels: History["levels"] = {};
  for (const s of Object.keys(days).filter((k) => k.startsWith("level#"))) {
    const n = Number(s.slice("level#".length));
    const l = byTime(s);
    levels[n] = t.map((x) => l.get(x)?.[1] ?? null);
  }
  return { t, total: t.map((x) => building.get(x)![1]), share: t.map((x) => building.get(x)![2]), levels, since, readAt };
}

/** Index of the reading nearest `time`, if one is within `within` ms. */
export function nearest(h: History, time: number, within = 15 * 60_000): number | null {
  let best: number | null = null;
  for (let i = 0; i < h.t.length; i++) if (Math.abs(h.t[i] - time) <= within && (best === null || Math.abs(h.t[i] - time) < Math.abs(h.t[best] - time))) best = i;
  return best;
}

type Headcounts = Pick<History, "t" | "total">;

const median = (xs: number[]) => {
  xs.sort((a, b) => a - b);
  const m = xs.length >> 1;
  return xs.length % 2 ? xs[m] : Math.round((xs[m - 1] + xs[m]) / 2);
};

/**
 * What's typical at each reading's time of day. Libraries run on a weekly rhythm, so it's
 * the median at the same time on the same weekday over the last 4 weeks, once 3 of those
 * weeks have a reading. Until then it's the median over the last 7 days (at least 3 of them).
 * `past` is where to look those up: a longer stretch of the same building's readings.
 */
export function typical(h: Headcounts, past: Headcounts = h, within = 15 * 60_000): (number | null)[] {
  const day = 86_400_000;
  // New York's offset from UTC. clocks only change on the hour, so it's worked out once per hour
  const offsets = new Map<number, number>();
  const offset = (time: number) => {
    const hour = Math.floor(time / 3_600_000) * 3_600_000;
    let o = offsets.get(hour);
    if (o === undefined) {
      const s = slot(new Date(hour).toISOString());
      const [y, m, d] = s.day.split("-").map(Number);
      o = Date.UTC(y, m - 1, d, 0, s.minute) - hour; // the clock on the wall, read as if it were UTC
      offsets.set(hour, o);
    }
    return o;
  };
  // index of the first reading at or after `time` (readings are sorted)
  const from = (time: number) => {
    let lo = 0, hi = past.t.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (past.t[mid] < time) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  // headcount at the same New York clock time `days` earlier, so a week back still lines up across a DST change
  const back = (t: number, days: number) => {
    const at = t - days * day + offset(t) - offset(t - days * day);
    const i = from(at);
    const best = [i - 1, i].filter((j) => j >= 0 && j < past.t.length && past.total[j] !== null && Math.abs(past.t[j] - at) <= within).sort((a, b) => Math.abs(past.t[a] - at) - Math.abs(past.t[b] - at))[0];
    return best === undefined ? null : past.total[best]!;
  };
  const found = (t: number, days: number[]) => days.map((d) => back(t, d)).filter((c) => c !== null);
  return h.t.map((t) => {
    const weekly = found(t, [7, 14, 21, 28]);
    if (weekly.length >= 3) return median(weekly);
    const daily = found(t, [1, 2, 3, 4, 5, 6, 7]);
    return daily.length >= 3 ? median(daily) : null;
  });
}

/** The numbers above the chart: now, same time yesterday, and the busiest point shown. */
export function summary(h: History, now: number) {
  const last = h.t.length - 1;
  const latest = last >= 0 && h.total[last] !== null ? { t: h.t[last], count: h.total[last]!, share: h.share[last] } : null;
  const y = latest ? nearest(h, latest.t - 86_400_000) : null;
  const yesterday = y !== null ? h.total[y] : null;
  const a = latest ? nearest(h, latest.t - 3_600_000) : null;
  const hourAgo = a !== null ? h.total[a] : null;
  let peak: { t: number; count: number } | null = null;
  h.total.forEach((c, i) => {
    if (c !== null && h.t[i] >= now - 7 * 86_400_000 && (!peak || c > peak.count)) peak = { t: h.t[i], count: c };
  });
  const pct = (then: number | null) => (latest && then ? Math.round((100 * (latest.count - then)) / then) : null);
  return { latest, yesterday, change: pct(yesterday), hourAgo, hourChange: pct(hourAgo), peak: peak as { t: number; count: number } | null };
}

/**
 * Every series in one poll. Hunt's keys have no prefix ("building", "level#2"),
 * other libraries do ("hill#building"). Zone IDs are unique across libraries.
 * If a floor sensor fails it keeps its total from the building response, if the
 * building lists it. Floors made of several sensors also store each part as a
 * zone so they can be added up again later.
 * Throws if the building response is unusable.
 */
export function observations(s: Sensors, building: unknown, responses: Record<number, unknown>): { day: string; rows: [Series, Entry][] } {
  const b = parse(building);
  const { day, minute } = slot(b.at);
  const p = s.slug === "hunt" ? "" : `${s.slug}#`;
  const rows: [Series, Entry][] = [[`${p}building`, entry(minute, b.self)]];
  for (const [n, ids] of Object.entries(s.levels)) {
    const parts = ids.map((id) => {
      try {
        const r = parse(responses[id]);
        rows.push(...r.children.map((z): [Series, Entry] => [`zone#${z.id}`, entry(minute, z)]));
        return r.self;
      } catch {
        return b.children.find((c) => c.id === id) ?? null;
      }
    });
    if (ids.length > 1) for (const r of parts) if (r) rows.push([`zone#${r.id}`, entry(minute, r)]);
    if (parts.some(Boolean)) rows.push([`${p}level#${n}`, entry(minute, sumLevel(parts, s.capacity))]);
  }
  return { day, rows };
}
