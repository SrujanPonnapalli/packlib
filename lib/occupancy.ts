// Live headcounts from the sensors NC State Libraries use for their own
// "how busy is Hunt" page. The endpoint is undocumented, so everything it
// returns is checked here and anything odd becomes "no reading", never a crash.

export const SOURCE = "https://www.lib.ncsu.edu/space-occupancy/realtime-data.php";

/** NC State's own three words. */
export type Busy = "quiet" | "busy" | "packed";
export const BUSY_LABEL: Record<Busy, string> = { quiet: "Not busy", busy: "Busy", packed: "Very busy" };

export type Reading = {
  id: number;
  name: string;
  /** People counted; null when the sensor is off or sent nothing usable. */
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

/** Which sensors make up a library: its building total and each floor (one sensor, or several added up). */
export type Sensors = {
  slug: "hunt" | "hill";
  building: number;
  levels: Record<number, number[]>;
  /** Seats per sensor, for floors made of several sensors. */
  capacity: Record<number, number>;
  /** Which drawn spaces (geometry refs) each named-area sensor covers. */
  zones: Record<number, string[]>;
};

export const HUNT_SENSORS: Sensors = {
  slug: "hunt",
  building: BUILDING_ID,
  levels: Object.fromEntries(Object.entries(LEVEL_IDS).map(([n, id]) => [n, [id]])),
  capacity: {},
  zones: ZONE_REFS,
};

// Hill nests building → wing (West, Tower, East) → floor → area, so Floors 1
// and 2 are three sensors each. G is level 0; Floor B has no sensor.
export const HILL_SENSORS: Sensors = {
  slug: "hill",
  building: 264,
  levels: { 0: [280], 1: [266, 4478, 273], 2: [269, 282, 278], 3: [286], 4: [290], 5: [291], 6: [292], 7: [293], 8: [294], 9: [295] },
  // shortcut: count ÷ share from one reading on 17 Nov 2026 (shares come rounded to 1%, so ±2%); remeasure if NC State changes a floor.
  capacity: { 266: 191, 4478: 76, 273: 493, 269: 144, 282: 282, 278: 27 },
  // Named areas inside the floor sensors, read 17 Nov 2026, to refs in data/hill-geometry.ts.
  zones: {
    268: ["1328"], // Fishbowl Forum
    5249: ["1320"], // Hill of Beans Seating Area
    267: ["1325", "1311"], // Quiet Reading Rooms
    4476: ["1222"], // Makerspace
    281: ["1402"], // Mezzanine, where the Game Space is
    277: ["1133", "1133A"], // Digital Media Lab
    275: ["1132"], // Graduate Student Commons
    274: ["Learning Commons", "Armstrong Memorial Popular Reading Lounge"],
    276: ["1128"], // Special Collections Reading Room
    271: ["2312"], // Faculty Research Commons
    270: ["2306", "Study Lounge 2301"], // Floor 2 West Wing general seating
    4477: ["2317"], // Gaming and VR Studio
    283: ["2200"], // Academic Success Center
    284: ["South Study Lounge (Floor 2)"],
    285: ["2419"], // Innovation Studio
    287: ["3425"], // Data Experience Lab
    288: ["South Study Lounge (Floor 3)"],
    289: ["North Forum"],
  },
};

// "Feels like" cut-offs (upper % for not busy, then busy) from NC State's
// occupancy script. Most areas use the first set; Hunt's Level 3 and Hill's
// Mezzanine use the mezzanine set, Hill's carrel floors 4–9 and Learning
// Commons have their own. Sensor IDs are unique across both libraries.
const STANDARD: [number, number] = [25, 45];
const CARRELS: [number, number] = [40, 60];
const THRESHOLDS: Record<number, [number, number]> = {
  1353: [19.8, 35.6],
  281: [19.8, 35.6],
  274: [30, 55],
  290: CARRELS, 291: CARRELS, 292: CARRELS, 293: CARRELS, 294: CARRELS, 295: CARRELS,
};

export function busyness(id: number, share: number): Busy {
  const [quiet, busy] = THRESHOLDS[id] ?? STANDARD;
  const pct = share * 100;
  return pct <= quiet ? "quiet" : pct <= busy ? "busy" : "packed";
}


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

/** One endpoint response: the area itself plus its children. Throws if the shape is not what NC State sends. */
export function parse(raw: unknown): { self: Reading; at: string; children: Reading[] } {
  const self = reading(raw);
  if (!self || !isObj(raw)) throw new Error("occupancy: unexpected response");
  const at = typeof raw.timestamp === "string" && !Number.isNaN(Date.parse(raw.timestamp)) ? raw.timestamp : null;
  if (!at) throw new Error("occupancy: no timestamp");
  const children = Array.isArray(raw.childCounts) ? raw.childCounts.map(reading).filter((r): r is Reading => r !== null) : [];
  return { self, at, children };
}

async function read(id: number, library: Sensors["slug"]): Promise<unknown> {
  const res = await fetch(`${SOURCE}?id=${id}&library=${library}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`occupancy ${id}: HTTP ${res.status}`);
  return res.json();
}

/** The building plus every floor sensor (5 requests for Hunt, 15 for Hill). Sensors that fail come back null; a failed building request throws. */
export async function readLibrary(s: Sensors): Promise<{ building: unknown; sensors: Record<number, unknown> }> {
  const ids = Object.values(s.levels).flat();
  const [building, ...rest] = await Promise.allSettled([read(s.building, s.slug), ...ids.map((id) => read(id, s.slug))]);
  if (building.status === "rejected") throw building.reason;
  return { building: building.value, sensors: Object.fromEntries(ids.map((id, i) => [id, rest[i].status === "fulfilled" ? rest[i].value : null])) };
}

/**
 * A floor made of several sensors: people added up, share against their
 * combined seats. If any part has no reading the floor has none either, so a
 * missing wing never shows as a quieter floor.
 */
export function sumLevel(parts: (Reading | null)[], capacity: Record<number, number>): { count: number | null; share: number | null } {
  if (parts.length === 1) return { count: parts[0]?.count ?? null, share: parts[0]?.share ?? null };
  if (parts.some((r) => r?.count == null || !capacity[r.id])) return { count: null, share: null };
  const count = parts.reduce((a, r) => a + r!.count!, 0);
  const seats = parts.reduce((a, r) => a + capacity[r!.id], 0);
  return { count, share: Math.min(count / seats, 1) };
}

/** Joins the building response and every floor sensor's response into what the page shows. */
export function combineLibrary(s: Sensors, building: unknown, sensors: Record<number, unknown>): Occupancy {
  const b = parse(building);
  const out: Occupancy = { at: b.at, building: b.self, levels: {}, zones: [] };
  for (const [n, ids] of Object.entries(s.levels)) {
    const parts = ids.map((id) => {
      try {
        const r = parse(sensors[id]);
        for (const z of r.children) if (s.zones[z.id]) out.zones.push({ ...z, level: Number(n), refs: s.zones[z.id] });
        return r.self;
      } catch {
        return b.children.find((c) => c.id === id) ?? null; // a floor that failed keeps its total from the building response
      }
    });
    if (ids.length === 1) {
      if (parts[0]) out.levels[Number(n)] = parts[0];
    } else if (parts.some(Boolean)) {
      const { count, share } = sumLevel(parts, s.capacity);
      out.levels[Number(n)] = { id: ids[0], name: `Floor ${n}`, count, share, busy: share === null ? null : busyness(0, share) };
    }
  }
  return out;
}

/** Hunt's building response plus one response per level, keyed by level number. */
export const combine = (building: unknown, levels: Record<number, unknown>) =>
  combineLibrary(HUNT_SENSORS, building, Object.fromEntries(Object.entries(LEVEL_IDS).map(([n, id]) => [id, levels[Number(n)]])));

export const SENSORS = { hunt: HUNT_SENSORS, hill: HILL_SENSORS } as const;

/** Zone covering a drawn space, if any. */
export const zoneFor = (o: Occupancy | null | undefined, ref: string) => o?.zones.find((z) => z.refs.includes(ref)) ?? null;

/** "about 35 people", never "0 people": a sensor reading zero does not mean the room is empty. */
export function people(count: number | null) {
  if (count === null) return null;
  if (count < 5) return "a few people at most";
  return `about ${count} people`;
}

export function ago(at: string, now: number) {
  const min = Math.max(0, Math.round((now - Date.parse(at)) / 60000));
  return min < 1 ? "just now" : min < 60 ? `${min} min ago` : `${Math.floor(min / 60)} h ago`;
}

/** Older than this, the numbers are shown as out of date. */
export const STALE_MS = 20 * 60 * 1000;
