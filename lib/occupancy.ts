// Live headcounts from the sensors NC State Libraries use for their own
// "how busy is Hunt" page. The endpoint isn't documented, so everything it
// returns gets checked here and anything weird becomes "no reading" instead of a crash.

export const SOURCE = "https://www.lib.ncsu.edu/space-occupancy/realtime-data.php";

/** NC State's own three labels. */
export type Busy = "quiet" | "busy" | "packed";
export const BUSY_LABEL: Record<Busy, string> = { quiet: "Not busy", busy: "Busy", packed: "Very busy" };

export type Reading = {
  id: number;
  name: string;
  /** People counted. null if the sensor is off or sent nothing usable. */
  count: number | null;
  /** Share of capacity, 0–1. */
  share: number | null;
  busy: Busy | null;
};

export type Zone = Reading & { level: number; refs: string[] };

export type Occupancy = {
  /** When NC State's sensors were read (ISO time). */
  at: string;
  building: Reading;
  levels: Record<number, Reading>;
  zones: Zone[];
};

// Hunt has no sensor on Level 1.
export const LEVEL_IDS: Record<number, number> = { 2: 1352, 3: 1353, 4: 1354, 5: 1355 };
export const BUILDING_ID = 1356;

// "Feels like" cut-offs (upper % for not busy, then busy) from NC State's
// occupancy script. Hunt uses the first set everywhere except Level 3, which
// uses the mezzanine one.
const STANDARD: [number, number] = [25, 45];
const THRESHOLDS: Record<number, [number, number]> = { 1353: [19.8, 35.6] };

export function busyness(id: number, share: number): Busy {
  const [quiet, busy] = THRESHOLDS[id] ?? STANDARD;
  const pct = share * 100;
  return pct <= quiet ? "quiet" : pct <= busy ? "busy" : "packed";
}

/** Which drawn spaces (geometry refs) each sensor zone covers. */
export const ZONE_REFS: Record<number, string[]> = {
  4402: ["2008"], // Carrel Corridor
  1342: ["Quiet Reading Room"],
  1341: ["Rain Garden Reading Lounge", "2302"], // counted together with the Idea Alcove and the floor's edges
  1343: ["3200"], // Learning Commons
  1344: ["3201"], // The Landing
  1345: ["Lake Raleigh Learning Commons"],
  1348: ["Graduate Student Commons"],
  5352: ["4401"], // Maker Studio
  1346: ["4403"], // Esports and Gaming Lab
  1349: ["Oval View Reading Room"],
  1347: ["4505"], // Teaching and Visualization Lab
  1351: ["Faculty Research Commons"],
  1350: ["Skyline Reading Room"],
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

function reading(raw: unknown): Reading | null {
  if (!isObj(raw) || typeof raw.id !== "number") return null;
  const on = raw.isActive !== false;
  const count = on ? num(raw.count) : null;
  const share = on && count !== null ? num(raw.percentage) : null;
  return {
    id: raw.id,
    name: typeof raw.name === "string" ? raw.name : "",
    count: count === null ? null : Math.round(count),
    share: share === null ? null : Math.min(share, 1),
    busy: share === null ? null : busyness(raw.id, share),
  };
}

/** One endpoint response: the area plus its children. Throws if it's not the shape NC State sends. */
export function parse(raw: unknown): { self: Reading; at: string; children: Reading[] } {
  const self = reading(raw);
  if (!self || !isObj(raw)) throw new Error("occupancy: unexpected response");
  const at = typeof raw.timestamp === "string" && !Number.isNaN(Date.parse(raw.timestamp)) ? raw.timestamp : null;
  if (!at) throw new Error("occupancy: no timestamp");
  const children = Array.isArray(raw.childCounts) ? raw.childCounts.map(reading).filter((r): r is Reading => r !== null) : [];
  return { self, at, children };
}

/** Combines the building response and one response per level into what the page shows. */
export function combine(building: unknown, levels: Record<number, unknown>): Occupancy {
  const b = parse(building);
  const out: Occupancy = { at: b.at, building: b.self, levels: {}, zones: [] };
  for (const [n, id] of Object.entries(LEVEL_IDS)) {
    const fromBuilding = b.children.find((c) => c.id === id);
    let level = fromBuilding ?? null;
    try {
      const l = parse(levels[Number(n)]);
      level = l.self;
      for (const z of l.children) if (ZONE_REFS[z.id]) out.zones.push({ ...z, level: Number(n), refs: ZONE_REFS[z.id] });
    } catch {
      // a level that failed still gets its total from the building response
    }
    if (level) out.levels[Number(n)] = level;
  }
  return out;
}

/** Zone covering a drawn space, if there is one. */
export const zoneFor = (o: Occupancy | null | undefined, ref: string) => o?.zones.find((z) => z.refs.includes(ref)) ?? null;

/** "about 35 people", never "0 people", since a sensor reading zero doesn't mean the room is empty. */
export function people(count: number | null) {
  if (count === null) return null;
  if (count < 5) return "a few people at most";
  return `about ${count} people`;
}

export function ago(at: string, now: number) {
  const min = Math.max(0, Math.round((now - Date.parse(at)) / 60000));
  return min < 1 ? "just now" : min < 60 ? `${min} min ago` : `${Math.floor(min / 60)} h ago`;
}

/** Older than this and the numbers show as out of date. */
export const STALE_MS = 20 * 60 * 1000;
