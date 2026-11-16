// Schematic floor geometry, traced by eye from NC State Libraries' published
// Hunt floor maps (lib.ncsu.edu/hunt/map). Coordinates are pixels on those maps
// at 2000px wide; the renderers scale them. Rooms are on the right floor and in
// roughly the right place, but this is not survey data: where a map labels a
// run of rooms ("3309–3316") the order inside the run is assumed.

export type Pt = [number, number];

export type Shape = {
  kind: "room" | "zone" | "stair" | "core" | "counter";
  poly: Pt[];
  /** Room number, or space title when it has none. Links the shape to a space. */
  ref?: string;
  label?: string;
  /** Where the label sits, when the middle of the shape is a bad place for it. */
  at?: Pt;
  /** Index of the edge with the glass front and door, or for a stair the edge you step on from (edge i runs from point i to i+1). */
  front?: number;
  /** Stairs: whether the flight from this floor goes up or down. The `front` edge is where you step on. */
  dir?: "up" | "down";
  /** What to furnish it as. Rooms default to a meeting table. */
  fit?: "meeting" | "lab" | "commons" | "empty";
};

export type Floor = { plate: Pt[]; shapes: Shape[]; traced: boolean };

const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

// Edges of rect(): 0 north, 1 east, 2 south, 3 west.
const N = 0, E = 1, S = 2, W = 3;

/** Splits a rectangle into equal rooms along its long side, in the order given, all opening on `front`. */
function strip(refs: string[], x0: number, y0: number, x1: number, y1: number, front: number): Shape[] {
  const across = x1 - x0 > y1 - y0;
  const step = (across ? x1 - x0 : y1 - y0) / refs.length;
  return refs.map((ref, i) => ({
    kind: "room",
    ref,
    label: ref,
    front,
    poly: across
      ? rect(x0 + i * step, y0, x0 + (i + 1) * step, y1)
      : rect(x0, y0 + i * step, x1, y0 + (i + 1) * step),
  }));
}

/** Whole-building envelope drawn on every map. */
export const ENVELOPE: Pt[] = [
  [45, 150],
  [1360, 150],
  [1845, 57],
  [1965, 667],
  [1050, 845],
  [45, 675],
];

const LEVEL_3_PLATE: Pt[] = [
  [125, 200],
  [495, 200],
  [495, 285],
  [525, 285],
  [525, 152],
  [1360, 152],
  [1360, 553],
  [417, 553],
  [417, 275],
  [180, 275],
  [180, 305],
  [125, 305],
];

const level3: Floor = {
  traced: true,
  plate: LEVEL_3_PLATE,
  shapes: [
    {
      kind: "zone",
      ref: "3200",
      label: "Learning Commons",
      at: [1175, 200],
      fit: "commons",
      poly: [
        [648, 175],
        [1265, 175],
        [1265, 258],
        [1020, 258],
        [1000, 430],
        [893, 430],
        [893, 540],
        [800, 540],
        [800, 445],
        [648, 445],
      ],
    },
    {
      kind: "zone",
      label: "Overlook",
      at: [490, 310],
      poly: [
        [428, 296],
        [516, 296],
        [522, 306],
        [522, 340],
        [516, 348],
        [428, 348],
      ],
    },
    ...strip(["3316", "3315", "3314", "3313", "3312", "3309"], 180, 220, 475, 272, N),
    ...strip(["3307", "3306", "3305", "3304"], 420, 350, 475, 550, E),
    ...strip(["3241", "3242", "3243"], 588, 157, 627, 287, E),
    ...strip(["3215", "3214", "3213", "3212"], 1283, 200, 1357, 357, W),
    { kind: "room", ref: "3217", label: "3217", front: W, poly: rect(1170, 310, 1215, 356) },
    { kind: "room", ref: "3218", label: "3218", front: E, poly: rect(1215, 310, 1260, 356) },
    { kind: "room", ref: "3219", label: "3219", front: W, poly: rect(1170, 357, 1215, 403) },
    { kind: "room", ref: "3220", label: "3220", front: E, poly: rect(1215, 357, 1260, 403) },
    ...strip(["3208", "3209"], 1200, 467, 1297, 550, N),
    { kind: "room", ref: "3211", label: "3211", front: W, fit: "empty", poly: rect(1283, 357, 1357, 430) },
    {
      kind: "counter",
      label: "Printing",
      at: [832, 262],
      poly: [
        [792, 240],
        [850, 220],
        [884, 228],
        [887, 241],
        [850, 238],
        [808, 256],
        [798, 298],
        [814, 314],
        [792, 328],
        [778, 312],
        [781, 262],
      ],
    },
    {
      kind: "room",
      ref: "3201",
      label: "The Landing",
      front: N,
      poly: [
        [1005, 447],
        [1125, 447],
        [1125, 550],
        [1020, 550],
      ],
    },
    {
      kind: "room",
      ref: "Dataspace",
      label: "Dataspace",
      front: 7,
      fit: "lab",
      poly: [
        [1040, 270],
        [1130, 270],
        [1145, 290],
        [1145, 390],
        [1128, 405],
        [1103, 405],
        [1015, 385],
        [1025, 300],
      ],
    },
    // The two stairs by the overlook are one run: up to Level 4 from the east, and beside it down to Level 2.
    { kind: "stair", ref: "Monumental Stair with Roman Seating", dir: "up", front: E, poly: rect(545, 360, 612, 447) },
    {
      kind: "stair",
      dir: "down", // to Level 2, heading south
      front: N,
      poly: [
        [908, 460],
        [1005, 450],
        [1015, 548],
        [910, 548],
      ],
    },
    { kind: "stair", dir: "down", front: W, poly: rect(523, 447, 627, 550) },
    { kind: "stair", dir: "down", front: N, poly: rect(125, 225, 180, 305) },
    { kind: "core", poly: rect(527, 157, 588, 287) },
    { kind: "core", poly: rect(673, 447, 780, 550) },
    { kind: "core", poly: rect(1130, 447, 1200, 550) },
    { kind: "core", poly: rect(1297, 430, 1357, 550) },
    { kind: "core", poly: rect(1283, 157, 1357, 200) },
  ],
};

// Level 2 is traced on its own map, which is drawn slightly smaller and offset
// from Level 3's. This lines the two up (checked against the building outline
// and the stair that joins them).
const fromLevel2Map = ([x, y]: Pt): Pt => [Math.round((x - 38) * 1.0588 + 45), Math.round((y - 125) * 1.0588 + 150)];

const level2Shapes: Shape[] = [
  {
    kind: "zone",
    ref: "Quiet Reading Room",
    label: "Quiet Reading Room",
    poly: [
      [173, 262],
      [372, 262],
      [372, 512],
      [55, 512],
      [55, 295],
      [173, 295],
    ],
  },
  { kind: "zone", ref: "2302", label: "Idea Alcove", poly: rect(457, 262, 535, 372) },
  { kind: "zone", ref: "2008", label: "Study Carrels", poly: rect(555, 375, 1065, 392) },
  {
    kind: "zone",
    ref: "Rain Garden Reading Lounge",
    label: "Rain Garden Reading Lounge",
    at: [660, 640],
    fit: "commons",
    poly: [
      [500, 548],
      [850, 548],
      [905, 600],
      [972, 768],
      [412, 675],
      [455, 580],
    ],
  },
  {
    kind: "zone",
    ref: "2200",
    label: "Technology Showcase",
    poly: [
      [1050, 625],
      [1195, 618],
      [1200, 700],
      [1068, 722],
    ],
  },
  {
    kind: "zone",
    ref: "Emerging Issues Commons",
    label: "Emerging Issues Commons",
    at: [1425, 290],
    poly: [
      [1345, 250],
      [1490, 250],
      [1510, 330],
      [1530, 420],
      [1345, 420],
    ],
  },
  { kind: "zone", label: "Lobby", poly: rect(1300, 432, 1530, 540) },
  ...strip(["2312", "2313", "2314", "2315"], 168, 190, 362, 242, S),
  ...strip(["2309", "2308", "2307", "2306", "2305", "2304"], 390, 190, 447, 502, E),
  ...strip(["2322", "2323", "2324", "2325", "2326", "2327", "2328"], 100, 532, 447, 582, N),
  {
    kind: "room",
    ref: "2206",
    label: "iPearl Theater",
    front: S,
    fit: "empty",
    poly: [
      [948, 405],
      [1090, 405],
      [1090, 498],
      [960, 498],
    ],
  },
  {
    kind: "room",
    ref: "2110A",
    label: "Duke Energy Hall",
    front: 4,
    fit: "empty",
    poly: [
      [1560, 205],
      [1762, 165],
      [1845, 600],
      [1685, 635],
      [1600, 440],
    ],
  },
  { kind: "counter", ref: "Ask Us", label: "Ask Us", poly: rect(1145, 435, 1212, 500) },
  { kind: "core", label: "bookBot", poly: rect(552, 130, 1198, 372) },
  { kind: "core", poly: rect(498, 220, 552, 252) },
  { kind: "core", poly: rect(1198, 130, 1280, 300) },
  { kind: "core", poly: rect(630, 405, 712, 500) },
  { kind: "core", poly: rect(732, 405, 855, 497) },
  { kind: "core", poly: rect(1090, 372, 1140, 498) },
  { kind: "core", poly: rect(1240, 372, 1282, 490) },
  {
    kind: "core", // staff area
    poly: [
      [1472, 128],
      [1590, 105],
      [1640, 320],
      [1520, 345],
    ],
  },
  {
    kind: "core",
    poly: [
      [1620, 62],
      [1738, 40],
      [1760, 162],
      [1642, 192],
    ],
  },
  // Up to Level 3: these sit under Level 3's "down" stairs and rise toward where those begin.
  { kind: "stair", dir: "up", front: S, poly: rect(118, 205, 165, 272) },
  { kind: "stair", dir: "up", front: E, poly: rect(492, 405, 590, 500) },
  {
    kind: "stair",
    dir: "up",
    front: S,
    poly: [
      [855, 415],
      [945, 405],
      [955, 490],
      [855, 498],
    ],
  },
  {
    kind: "stair", // to the Institute for Emerging Issues and Level 4
    dir: "up",
    front: S,
    poly: [
      [1558, 565],
      [1598, 557],
      [1620, 640],
      [1580, 650],
    ],
  },
  { kind: "stair", dir: "down", front: S, poly: rect(505, 130, 552, 218) },
  {
    kind: "stair", // down to Level 1
    dir: "down",
    front: S,
    poly: [
      [1288, 230],
      [1322, 235],
      [1335, 330],
      [1300, 335],
    ],
  },
];

const level2: Floor = {
  traced: true,
  plate: (
    [
      [38, 125],
      [1280, 125],
      [1740, 35],
      [1850, 608],
      [1280, 722],
      [1280, 775],
      [970, 775],
      [38, 618],
    ] as Pt[]
  ).map(fromLevel2Map),
  shapes: level2Shapes.map((s) => ({ ...s, poly: s.poly.map(fromLevel2Map), at: s.at && fromLevel2Map(s.at) })),
};

// Levels 1, 4 and 5 are placeholders until they are traced.
const placeholder = (plate: Pt[]): Floor => ({ traced: false, plate, shapes: [] });

export const FLOORS: Record<number, Floor> = {
  1: placeholder(ENVELOPE),
  2: level2,
  3: level3,
  4: placeholder(LEVEL_3_PLATE),
  5: placeholder(LEVEL_3_PLATE),
};
