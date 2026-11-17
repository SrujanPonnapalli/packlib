// Turns NC State's live responses into stored history. The collector keeps
// every sensor NC State reports (building, levels, zones), even ones that are
// switched off, so gaps and outages show up later.

import { LEVEL_IDS, parse, type Reading } from "./occupancy.ts";

/** "building", "level#3", "zone#1342". */
export type Series = string;
/** One stored reading: [minute of the New York day, people or null, fraction of capacity or null]. */
export type Entry = [number, number | null, number | null];

const entry = (minute: number, r: Reading): Entry => [minute, r.count, r.share === null ? null : Math.round(r.share * 1000) / 1000];

/** New York calendar day and minute of the day, so days split at local midnight even across DST. */
export function slot(at: string): { day: string; minute: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(at))
      .map((x) => [x.type, x.value]),
  );
  return { day: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute) };
}

/** Every series in one poll. Throws if the building response is unusable. A failed level keeps its total from the building. */
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
