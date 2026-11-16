import snapshot from "./hunt-spaces.json";
import type { Fitout } from "@/lib/furnish";

export type Kind = "study" | "open" | "grad" | "faculty" | "studio" | "service";

export type Space = (typeof snapshot.spaces)[number] & {
  level: number | null;
  kind: Kind;
  /** True when the Libraries list booking rules for it. */
  reservable: boolean;
  /** Read from the photo caption; null when there is no photo. */
  fitout: Fitout | null;
  /** Human-readable fit-out, shown only for bookable rooms. */
  features: string[];
};

// NC State numbers Hunt's floors and gives them no names. `landmark` is the
// best-known real space on each floor, used only as a wayfinding hint.
export const LEVELS = [
  { n: 5, landmark: "Skyline Reading Room" },
  { n: 4, landmark: "Lake Raleigh Learning Commons" },
  { n: 3, landmark: "Learning Commons" },
  { n: 2, landmark: "Rain Garden Reading Lounge" },
  { n: 1, landmark: "Auditorium" },
] as const;

export const KINDS: { id: Kind; label: string }[] = [
  { id: "study", label: "Study rooms" },
  { id: "open", label: "Open seating" },
  { id: "grad", label: "Graduate" },
  { id: "faculty", label: "Faculty" },
  { id: "studio", label: "Labs & halls" },
  { id: "service", label: "Services" },
];

// The Spaces API gives a floor only through the room number. For spaces with
// no room number, floors come from each space's own page on lib.ncsu.edu
// ("Floor: Third Floor"), checked 16 Nov 2026. The Oval is outdoors.
const LEVEL_BY_TITLE: Record<string, number> = {
  "Art Wall": 2,
  "Ask Us": 2,
  "Audio Rooms": 4,
  "Common Grounds Café": 1,
  Dataspace: 3,
  "Emerging Issues Commons": 2,
  "Faculty Research Commons": 5,
  "Graduate Student Commons": 4,
  "Lake Raleigh Learning Commons": 4,
  "Locker Bay": 4,
  "Monumental Stair with Roman Seating": 3,
  "Oval View Reading Room": 4,
  "Quiet Reading Room": 2,
  "Rain Garden Reading Lounge": 2,
  "Robot Alley": 1,
  "Skyline Reading Room": 5,
  "Skyline Terrace": 5,
};

// The API has no categories; these are sorted by hand.
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

const NUMBERS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };

// The Libraries publish no capacities for Hunt rooms, but photo captions say
// things like "table surrounded by eight task chairs, wall-mounted display,
// and whiteboard walls". That is the only source for seats and fit-out.
export function readCaption(alt: string): Fitout {
  const a = alt.toLowerCase();
  const word = /\b(\w+) (?:task |work )?chairs\b/.exec(a)?.[1] ?? /seating for (\w+)/.exec(a)?.[1];
  return {
    seats: word ? (NUMBERS[word] ?? null) : null,
    display: /display|monitor|screen/.test(a),
    whiteboard: /whiteboard|writeable/.test(a),
    window: /exterior window|external window/.test(a) ? "exterior" : /internal window|overlook/.test(a) ? "interior" : null,
    adjustable: /adjustable/.test(a),
  };
}

function featuresOf(f: Fitout): string[] {
  return [
    f.display && "Wall display",
    f.whiteboard && "Whiteboard walls",
    f.window === "exterior" && "Outside windows",
    f.window === "interior" && "Windows onto the library",
    f.adjustable && "Adjustable-height table",
  ].filter((x): x is string => Boolean(x));
}

const ROOM_KINDS: Kind[] = ["study", "grad", "faculty"];

export const spaces: Space[] = snapshot.spaces.map((s) => {
  const kind = kindOf(s.title);
  const fitout = s.photo ? readCaption(s.photo.alt) : null;
  return {
    ...s,
    level: s.room ? Number(s.room[0]) : (LEVEL_BY_TITLE[s.title] ?? null),
    kind,
    reservable: Boolean(s.bookAhead || s.maxBooking),
    fitout,
    features: fitout && ROOM_KINDS.includes(kind) ? featuresOf(fitout) : [],
  };
});

export const snapshotDate = new Date(snapshot.fetchedAt);

export const landmark = (n: number) => LEVELS.find((l) => l.n === n)?.landmark ?? "";

/** Geometry links to a space by room number, or by title when it has none. */
export const spaceByRef = (ref: string) =>
  spaces.find((s) => s.room === ref) ?? spaces.find((s) => s.title === ref);

export const fitoutFor = (ref: string) => spaceByRef(ref)?.fitout ?? null;
