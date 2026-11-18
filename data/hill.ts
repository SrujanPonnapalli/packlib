import snapshot from "./hill-spaces.json";
import { featuresOf, readCaption } from "./hunt";
import type { Kind, Space } from "./kinds";

// Hill's floors: B is -1 and G is 0, so room B404 is on -1 and 5424 is on 5.
// `landmark` is the best-known space on each floor, as a wayfinding hint.
export const LEVELS = [
  { n: 9, label: "9", landmark: "Engineering (Eos) Lab" },
  { n: 8, label: "8", landmark: "Bookstacks" },
  { n: 7, label: "7", landmark: "Bookstacks" },
  { n: 6, label: "6", landmark: "Bookstacks" },
  { n: 5, label: "5", landmark: "Bookstacks" },
  { n: 4, label: "4", landmark: "Bookstacks" },
  { n: 3, label: "3", landmark: "North Forum" },
  { n: 2, label: "2", landmark: "Academic Success Center" },
  { n: 1, label: "1", landmark: "Learning Commons" },
  { n: 0, label: "G", landmark: "Ground Floor Reading Room" },
  { n: -1, label: "B", landmark: "METRC" },
] as const;

// Spaces without a room number. Floors come from each space's page on
// lib.ncsu.edu ("First Floor, Tower"), checked 17 Nov 2026. The Brickyard and
// the Hillsborough Street Patio are outside, Research Study Rooms are on 4–9.
const LEVEL_BY_TITLE: Record<string, number> = {
  "Ask Us": 1,
  "Ask Us Lobby": 1,
  "Atrium Food Court": 0,
  "Bookstacks Floor 4": 4,
  "Bookstacks Floor 5": 5,
  "Bookstacks Floor 6": 6,
  "Bookstacks Floor 7": 7,
  "Bookstacks Floor 8": 8,
  "Bookstacks Floor 9": 9,
  Conservatory: 1,
  "Engineering (Eos) Lab": 9,
  "Entrance Desk (Floor 1)": 1,
  "Entrance Desk (Floor G)": 0,
  "Faculty Senate Chambers": 2,
  "North Forum": 3,
  "South Study Lounge (Floor 2)": 2,
  "South Study Lounge (Floor 3)": 3,
  "Special Collections Service Desk": 1,
  Terrace: 1,
  "Vending and Lockers": 1,
};

// the API has no categories so these are sorted by hand
const OPEN = new Set([
  "Armstrong Memorial Popular Reading Lounge",
  "Bookstacks Floor 4", "Bookstacks Floor 5", "Bookstacks Floor 6", "Bookstacks Floor 7", "Bookstacks Floor 8", "Bookstacks Floor 9",
  "Fishbowl Forum",
  "Ground Floor Reading Room",
  "Hill of Beans Seating",
  "Hillsborough Street Patio",
  "Learning Commons",
  "Living Room",
  "North Forum",
  "Quiet Reading Room",
  "South Study Lounge (Floor 2)", "South Study Lounge (Floor 3)",
  "Study Lounge 2142", "Study Lounge 2301", "Study Lounge 2424",
  "Terrace",
]);

const SERVICE = new Set([
  "Academic Success Center",
  "Ask Us",
  "Ask Us Lobby",
  "Atrium Food Court",
  "Brickyard",
  "College of Education Student Services",
  "Consultation 3424",
  "Consultation 3428",
  "Entrance Desk (Floor 1)",
  "Entrance Desk (Floor G)",
  "Friends of the Libraries Office",
  "Hill of Beans Café",
  "Interfaith Prayer & Meditation Space",
  "Lactation Room",
  "Office of Undergraduate Research (OUR)",
  "Quick Print",
  "Single Occupant Toilet",
  "Special Collections Service Desk",
  "Vending and Lockers",
]);

function kindOf(title: string): Kind {
  if (OPEN.has(title)) return "open";
  if (SERVICE.has(title)) return "service";
  if (title === "Faculty Senate Chambers") return "studio";
  if (/^(MacMillan )?Study Room/.test(title)) return "study";
  if (/^Graduate|^Research Study Rooms$/.test(title)) return "grad";
  if (/^Faculty/.test(title)) return "faculty";
  return "studio";
}

// Seat counts from NC State's booking site (rooms.lib.ncsu.edu, zone 2 = Hill),
// read while signed in on 17 Nov 2026. Keyed by room number. Audio Booths are
// four 2-seat booths.
const BOOKING_SEATS: Record<string, number> = {
  1145: 14, "1145A": 6, "1145B": 6, 2203: 5, 2205: 5, 2207: 5, 2211: 5, 2213: 5,
  4419: 5, 4430: 6, 5419: 5, 5424: 5, 5425: 5, 5426: 5, 5427: 5, 5428: 5, 5430: 5,
  6406: 5, 6419: 5, 6422: 10, 6424: 10, 6426: 10, 7406: 5, 7419: 5, 7422: 10, 7424: 10, 7426: 10,
  8406: 5, 8419: 5, 8424: 5, 8425: 5, 8426: 5, 8427: 5, 8428: 5, 9411: 10, 9412: 10, 9413: 10,
  "1132A": 10, "1132B": 6, "1132C": 4, "1132E": 4, 2405: 10, 3405: 10, 4400: 10, 5400: 10,
  2310: 10, "2312B": 6, "2312C": 4, "2312E": 6, "2312F": 6, "2312G": 10, "2312K": 2, "2312L": 2, "2312N": 28,
  "1133A": 4, "1133C": 2, 2322: 3,
};

const ROOM_KINDS: Kind[] = ["study", "grad", "faculty"];

export const levelOfRoom = (room: string) => (room[0] === "B" ? -1 : room[0] === "G" ? 0 : Number(room[0]));

export const spaces: Space[] = snapshot.spaces.map((s) => {
  const kind = kindOf(s.title);
  const caption = s.photo ? readCaption(s.photo.alt) : null;
  const official = BOOKING_SEATS[s.room ?? s.title] ?? null;
  const fitout = caption && official ? { ...caption, seats: official } : caption;
  return {
    ...s,
    level: s.room ? levelOfRoom(s.room) : (LEVEL_BY_TITLE[s.title] ?? null),
    kind,
    reservable: Boolean(s.bookAhead || s.maxBooking),
    fitout,
    seats: official ?? caption?.seats ?? null,
    seatsFrom: official ? "booking" : caption?.seats ? "caption" : null,
    features: fitout && ROOM_KINDS.includes(kind) ? featuresOf(fitout) : [],
  };
});

export const snapshotDate = new Date(snapshot.fetchedAt);
