// Turning NC State's live responses into stored history. The collector keeps
// every sensor NC State reports (building, levels, every zone), including
// sensors that are switched off, so gaps and outages show up later.

import { LEVEL_IDS, parse, type Reading } from "./occupancy.ts";

/** "building", "level#3", "zone#1342". */
export type Series = string;
/** One stored reading: [minute of the New York day, people or null, share of capacity or null]. */
export type Entry = [number, number | null, number | null];

const entry = (minute: number, r: Reading): Entry => [minute, r.count, r.share === null ? null : Math.round(r.share * 1000) / 1000];

/** New York calendar day and minute of that day, so days split at local midnight across DST. */
export function slot(at: string): { day: string; minute: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(at))
      .map((x) => [x.type, x.value]),
  );
  return { day: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute) };
}

/** UTC time of a New York day and minute: tries EST and EDT and keeps the one that maps back. */
export function instant(day: string, minute: number): number {
  const [y, m, d] = day.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, 0, minute);
  for (const h of [5, 4]) {
    const t = wall + h * 3_600_000;
    const s = slot(new Date(t).toISOString());
    if (s.day === day && s.minute === minute) return t;
  }
  return wall + 5 * 3_600_000; // only the hour skipped when clocks go forward, which never has readings
}

/**
 * All readings of the building and its levels, lined up on the building's
 * poll times (one poll writes every series with the same minute). Duplicate
 * minutes, which happen when NC State hasn't updated between polls, collapse.
 */
export type History = {
  t: number[];
  total: (number | null)[];
  share: (number | null)[];
  levels: Record<number, (number | null)[]>;
  /** First day StudyScape has readings for. */
  since: string | null;
  /** When this was read from storage; "now" for everything shown with it. */
  readAt: number;
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
  for (const n of Object.keys(LEVEL_IDS).map(Number)) {
    const l = byTime(`level#${n}`);
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

/** The numbers above the chart: now, the same time yesterday, and the busiest moment shown. */
export function summary(h: History, now: number) {
  const last = h.t.length - 1;
  const latest = last >= 0 && h.total[last] !== null ? { t: h.t[last], count: h.total[last]!, share: h.share[last] } : null;
  const y = latest ? nearest(h, latest.t - 86_400_000) : null;
  const yesterday = y !== null ? h.total[y] : null;
  let peak: { t: number; count: number } | null = null;
  h.total.forEach((c, i) => {
    if (c !== null && h.t[i] >= now - 7 * 86_400_000 && (!peak || c > peak.count)) peak = { t: h.t[i], count: c };
  });
  return { latest, yesterday, change: latest && yesterday ? Math.round((100 * (latest.count - yesterday)) / yesterday) : null, peak: peak as { t: number; count: number } | null };
}

/** Every series in one poll. Throws if the building response is unusable; a failed level keeps its total from the building. */
export function observations(building: unknown, levels: Record<number, unknown>): { day: string; rows: [Series, Entry][] } {
  const b = parse(building);
  const { day, minute } = slot(b.at);
  const rows: [Series, Entry][] = [["building", entry(minute, b.self)]];
  for (const [n, id] of Object.entries(LEVEL_IDS)) {
    try {
      const l = parse(levels[Number(n)]);
      rows.push([`level#${n}`, entry(minute, l.self)], ...l.children.map((z): [Series, Entry] => [`zone#${z.id}`, entry(minute, z)]));
    } catch {
      const total = b.children.find((c) => c.id === id);
      if (total) rows.push([`level#${n}`, entry(minute, total)]);
    }
  }
  return { day, rows };
}
