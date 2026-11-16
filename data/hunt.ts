import snapshot from "./hunt-spaces.json";

export type Kind = "study" | "open" | "grad" | "faculty" | "studio" | "service";

export type Space = (typeof snapshot.spaces)[number] & {
  level: number | null;
  kind: Kind;
  /** True if the Libraries list booking rules for it. */
  reservable: boolean;
};

export const LEVELS = [
  { n: 5, name: "Skyline" },
  { n: 4, name: "Studios & labs" },
  { n: 3, name: "Learning Commons" },
  { n: 2, name: "Reading rooms" },
  { n: 1, name: "Arrival" },
] as const;

export const KINDS: { id: Kind; label: string }[] = [
  { id: "study", label: "Study rooms" },
  { id: "open", label: "Open seating" },
  { id: "grad", label: "Graduate" },
  { id: "faculty", label: "Faculty" },
  { id: "studio", label: "Labs & halls" },
  { id: "service", label: "Services" },
];

// Sorted by hand. The Spaces API only gives a floor through the room number and
// has no categories at all, so named spaces get placed and sorted here.
const LEVEL_BY_TITLE: Record<string, number> = {
  "Art Wall": 2,
  "Ask Us": 2,
  "Audio Rooms": 4,
  "Common Grounds Café": 1,
  Dataspace: 4,
  "Emerging Issues Commons": 1,
  "Faculty Research Commons": 5,
  "Graduate Student Commons": 4,
  "Lake Raleigh Learning Commons": 4,
  "Locker Bay": 4,
  "Oval View Reading Room": 4,
  "Quiet Reading Room": 2,
  "Rain Garden Reading Lounge": 2,
  "Robot Alley": 1,
  "Skyline Reading Room": 5,
  "Skyline Terrace": 5,
};

const OPEN = new Set([
  "Carrel Corridor",
  "Idea Alcove",
  "Lake Raleigh Learning Commons",
  "Learning Commons",
  "Monumental Stair with Roman Seating",
  "Oval View Reading Room",
  "Quiet Reading Room",
  "Rain Garden Reading Lounge",
  "Skyline Reading Room",
  "Skyline Terrace",
]);

const SERVICE = new Set([
  "Art Wall",
  "Ask Us",
  "Common Grounds Café",
  "Emerging Issues Commons",
  "Interfaith Prayer & Meditation Room",
  "Lactation Room",
  "Locker Bay",
  "Oval",
  "Robot Alley",
  "Single Occupant Toilet",
  "Vending Machines",
]);

function kindOf(title: string): Kind {
  if (/^Study Room/.test(title)) return "study";
  if (/^Graduate/.test(title)) return "grad";
  if (/^Faculty/.test(title)) return "faculty";
  if (OPEN.has(title)) return "open";
  if (SERVICE.has(title)) return "service";
  return "studio";
}

export const spaces: Space[] = snapshot.spaces.map((s) => ({
  ...s,
  level: s.room ? Number(s.room[0]) : (LEVEL_BY_TITLE[s.title] ?? null),
  kind: kindOf(s.title),
  reservable: Boolean(s.bookAhead || s.maxBooking),
}));

export const snapshotDate = new Date(snapshot.fetchedAt);

export const levelName = (n: number | null) =>
  LEVELS.find((l) => l.n === n)?.name ?? "Around Hunt";
