// Rough floor geometry, traced by eye from NC State Libraries' Hunt floor maps
// (lib.ncsu.edu/hunt/map). Coordinates are pixels on those maps at 2000px wide,
// the renderers scale them. Rooms are on the right floor and roughly in the
// right spot, but it's not exact. Where a map labels a range of rooms
// ("3309–3316") I guessed the order.

import { pointIn } from "../lib/furnish.ts";

export type Pt = [number, number];

export type Shape = {
  kind: "room" | "zone" | "stair" | "core" | "counter";
  poly: Pt[];
  /** Room number, or the space title if it doesn't have one. Links the shape to a space. */
  ref?: string;
  label?: string;
  /** Where to put the label, if the middle of the shape is a bad spot for it. */
  at?: Pt;
  /** Index of the edge with the glass front and door, or for a stair the edge you step on from (edge i goes from point i to i+1). */
  front?: number;
  /** Stairs: whether the flight from this floor goes up or down. `front` is the edge you step on from. */
  dir?: "up" | "down";
  /** What to furnish it as. Rooms default to a meeting table. */
  fit?: "meeting" | "lab" | "commons" | "empty" | "quiet" | "lounge" | "carrels" | "alcove" | "theater" | "showcase" | "hall" | "exhibit" | "cafe" | "auditorium";
  /** Added automatically: the other end of a stair traced on the floor above or below. */
  twin?: boolean;
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

/** Splits a rectangle into equal rooms along its long side, in the given order, all opening on `front`. */
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
    { kind: "stair", dir: "up", front: W, poly: rect(523, 447, 627, 550) }, // a second flight up to Level 4, next to the Monumental Stair
    { kind: "stair", dir: "down", front: N, poly: rect(125, 225, 180, 305) },
    { kind: "core", poly: rect(527, 157, 588, 287) },
    { kind: "core", poly: rect(673, 447, 780, 550) },
    { kind: "core", poly: rect(1130, 447, 1200, 550) },
    { kind: "core", poly: rect(1297, 430, 1357, 550) },
    { kind: "core", poly: rect(1283, 157, 1357, 200) },
  ],
};

// Level 2 is traced on its own map, which is a bit smaller and offset from
// Level 3's. This lines them up (checked against the building outline and the
// stair connecting them).
const fromLevel2Map = ([x, y]: Pt): Pt => [Math.round((x - 38) * 1.0588 + 45), Math.round((y - 125) * 1.0588 + 150)];

const level2Shapes: Shape[] = [
  {
    kind: "zone",
    ref: "Quiet Reading Room",
    label: "Quiet Reading Room",
    fit: "quiet",
    poly: [
      [173, 262],
      [372, 262],
      [372, 512],
      [55, 512],
      [55, 295],
      [173, 295],
    ],
  },
  { kind: "zone", ref: "2302", label: "Idea Alcove", fit: "alcove", poly: rect(457, 262, 535, 368) },
  { kind: "zone", ref: "2008", label: "Study Carrels", fit: "carrels", poly: rect(555, 376, 1065, 394) },
  {
    kind: "zone",
    ref: "Rain Garden Reading Lounge",
    label: "Rain Garden Reading Lounge",
    at: [660, 640],
    fit: "lounge",
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
    fit: "showcase",
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
    fit: "exhibit",
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
    fit: "theater",
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
    fit: "hall",
    poly: [
      [1560, 205],
      [1762, 165],
      [1845, 600],
      [1685, 635],
      [1600, 440],
    ],
  },
  { kind: "counter", ref: "Ask Us", label: "Ask Us", poly: rect(1145, 435, 1212, 500) },
  { kind: "core", poly: rect(498, 220, 552, 252) },
  { kind: "core", poly: rect(1198, 130, 1280, 300) },
  { kind: "core", poly: rect(492, 405, 590, 500) }, // the enclosed exit stair
  { kind: "core", poly: rect(630, 405, 712, 500) },
  { kind: "core", poly: rect(732, 405, 855, 497) },
  { kind: "core", poly: rect(1090, 372, 1140, 498) },
  { kind: "core", poly: rect(1240, 372, 1282, 490) },
  // stairs up to Level 3 aren't traced here, they get added from Level 3's "down" stairs so the two ends always line up
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
  { kind: "core", poly: rect(505, 133, 552, 220) }, // an exit stair, closed to the floor
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

/** A floor traced on its own map, moved onto Level 3's coordinates. */
const aligned = (map: (p: Pt) => Pt, plate: Pt[], shapes: Shape[]): Floor => ({
  traced: true,
  plate: plate.map(map),
  shapes: shapes.map((s) => ({ ...s, poly: s.poly.map(map), at: s.at && map(s.at) })),
});

const level2 = aligned(
  fromLevel2Map,
  [
    [38, 125],
    // left out the bookBot storage vault, it's a pit next to this floor and not somewhere you can go
    [552, 125],
    [552, 372],
    [1198, 372],
    [1198, 125],
    [1280, 125],
    // left out the staff offices in the north-east corner, the outline steps in around Duke Energy Hall
    [1470, 88],
    [1504, 295],
    [1575, 280],
    [1556, 203],
    [1764, 162],
    [1850, 608],
    [1280, 722],
    [1280, 775],
    [970, 775],
    [38, 618],
  ],
  level2Shapes,
);

// Level 4's map is the same scale as Level 3's, just 22px higher (checked against the elevators and stair cores)
const level4 = aligned(
  ([x, y]) => [x, y + 22],
  [
    [45, 128],
    [1355, 128],
    // left out the Institute for Emerging Issues' offices, what's left has its lecture hall and meeting rooms
    [1355, 388],
    [1896, 308],
    [1963, 660],
    [1405, 755],
    [1065, 815],
    [1035, 815],
    // the floor curves back here around the Oval View window wall
    [955, 625],
    [935, 590],
    [885, 573],
    [545, 573],
    [500, 595],
    [440, 712],
    [45, 645],
  ],
  [
    {
      kind: "zone",
      ref: "Lake Raleigh Learning Commons",
      label: "Lake Raleigh Learning Commons",
      at: [175, 520],
      fit: "commons",
      poly: [
        [62, 140],
        [135, 140],
        [135, 305],
        [420, 292],
        [440, 380],
        [315, 430],
        [285, 520],
        [468, 590],
        [430, 688],
        [62, 632],
      ],
    },
    {
      kind: "zone",
      ref: "Graduate Student Commons",
      label: "Graduate Student Commons",
      at: [1160, 300],
      fit: "commons",
      poly: [
        [1024, 132],
        [1303, 132],
        [1303, 385],
        [1230, 385],
        [1230, 418],
        [1022, 418],
        [1022, 360],
        [975, 360],
        [975, 240],
        [1024, 240],
      ],
    },
    {
      kind: "zone",
      ref: "Oval View Reading Room",
      label: "Oval View Reading Room",
      fit: "lounge",
      poly: [
        [978, 578],
        [1283, 572],
        [1283, 752],
        [1050, 792],
      ],
    },
    { kind: "zone", ref: "Locker Bay", label: "Lockers", at: [975, 400], poly: rect(955, 364, 1020, 470) },
    {
      kind: "zone", // not part of the Libraries, its two bookable rooms are drawn inside it
      label: "Institute for Emerging Issues",
      at: [1560, 520],
      poly: [
        [1358, 392],
        [1893, 313],
        [1958, 656],
        [1408, 750],
        [1388, 640],
        [1358, 640],
      ],
    },
    ...strip(["4510", "4511", "4512"], 148, 158, 190, 298, E),
    ...strip(["4513", "4514", "4515"], 215, 132, 272, 290, W),
    {
      kind: "room",
      ref: "4505",
      label: "Visualization Lab",
      front: S,
      fit: "theater",
      poly: [
        [272, 132],
        [470, 132],
        [470, 270],
        [272, 288],
      ],
    },
    { kind: "room", ref: "4411", label: "4411", front: S, poly: rect(470, 132, 538, 192) },
    {
      kind: "room",
      ref: "4403",
      label: "Esports & Gaming Lab",
      front: S,
      fit: "lab",
      poly: [
        [590, 132],
        [892, 132],
        [892, 240],
        [590, 262],
      ],
    },
    { kind: "room", ref: "4401", label: "Maker Studio", front: S, fit: "showcase", poly: rect(892, 132, 970, 238) },
    ...strip(["4321", "4322"], 970, 132, 1022, 236, E),
    ...strip(["4311", "4312", "4313", "4314", "4315"], 1305, 132, 1353, 385, W),
    { kind: "room", poly: rect(885, 360, 935, 440) }, // media studio 4217, not bookable
    { kind: "room", ref: "4215", label: "4215", front: W, fit: "lab", poly: rect(885, 442, 935, 525) },
    { kind: "room", ref: "4302", label: "4302", front: N, poly: rect(1022, 420, 1085, 470) },
    { kind: "room", ref: "Audio Rooms", label: "Audio", front: S, fit: "empty", poly: rect(957, 472, 1085, 527) },
    { kind: "room", ref: "4210", label: "VR Room", front: S, fit: "empty", poly: rect(1085, 472, 1135, 527) },
    {
      kind: "room",
      ref: "4502",
      label: "Cornelson Room",
      front: 0,
      poly: [
        [348, 474],
        [452, 440],
        [458, 500],
        [385, 545],
        [334, 522],
      ],
    },
    {
      kind: "room",
      ref: "4106",
      label: "Lecture Hall",
      front: 3,
      fit: "auditorium",
      poly: [
        [1705, 352],
        [1890, 322],
        [1918, 468],
        [1732, 495],
      ],
    },
    {
      kind: "room",
      ref: "4101",
      label: "Meeting Rooms",
      front: 0,
      poly: [
        [1404, 652],
        [1505, 634],
        [1515, 720],
        [1414, 740],
      ],
    },
    { kind: "core", poly: rect(470, 194, 512, 270) },
    { kind: "core", poly: rect(538, 132, 590, 266) },
    { kind: "core", poly: rect(672, 422, 758, 525) },
    { kind: "core", poly: rect(783, 422, 883, 525) },
    {
      kind: "core",
      poly: [
        [1087, 420],
        [1200, 420],
        [1200, 525],
        [1137, 525],
        [1137, 470],
        [1087, 470],
      ],
    },
    { kind: "core", poly: rect(1205, 390, 1353, 525) },
    {
      kind: "stair", // up to the Skyline Reading Room, starting from the east end
      dir: "up",
      front: E,
      poly: [
        [318, 440],
        [440, 405],
        [450, 435],
        [330, 470],
      ],
    },
  ],
);

// Level 5's map is also the same scale as Level 3's, 7px right and 12px higher (checked against the elevators)
const level5 = aligned(
  ([x, y]) => [x - 7, y + 12],
  [
    // left out the planted roofs north and south of the floor too
    [55, 138],
    [150, 138],
    [150, 200],
    // left out the staff floor and the University Centers suite
    [312, 198],
    [332, 400],
    [470, 400],
    [470, 478],
    [640, 478],
    [640, 432],
    [890, 432],
    [890, 516],
    [1266, 522],
    [1266, 750],
    [1250, 750],
    [150, 563],
    [150, 672],
    [55, 655],
  ],
  [
    { kind: "zone", ref: "Skyline Terrace", label: "Skyline Terrace", at: [102, 560], fit: "cafe", poly: rect(62, 148, 143, 648) },
    {
      kind: "zone",
      ref: "Skyline Reading Room",
      label: "Skyline Reading Room",
      at: [250, 330],
      fit: "quiet",
      poly: [
        [165, 216],
        [296, 210],
        [312, 436],
        [292, 538],
        [750, 556],
        [750, 640],
        [165, 545],
      ],
    },
    {
      kind: "zone",
      ref: "Faculty Research Commons",
      label: "Faculty Research Commons",
      at: [990, 640],
      fit: "commons",
      poly: [
        [792, 572],
        [1193, 572],
        [1193, 736],
        [792, 668],
      ],
    },
    ...strip(["5241", "5242", "5243", "5244", "5245"], 890, 526, 1140, 568, S),
    { kind: "room", ref: "5234", label: "5234", front: W, poly: rect(1197, 526, 1260, 594) },
    ...strip(["5231", "5232", "5233"], 1197, 598, 1250, 742, W),
    ...strip(["5210", "5211"], 792, 606, 824, 666, E),
    ...strip(["5222", "5223", "5224"], 1100, 606, 1172, 690, W),
    { kind: "counter", ref: "5302", label: "Vending", poly: rect(446, 490, 524, 530) },
    { kind: "core", poly: rect(532, 483, 632, 535) },
    { kind: "core", poly: rect(678, 435, 712, 515) },
    { kind: "core", poly: rect(765, 435, 888, 518) },
  ],
);

// Level 1's map is drawn smaller than Level 3's, this lines it up (checked against the east elevators and the bookBot)
const level1 = aligned(
  ([x, y]) => [Math.round((x - 48) * 1.049 + 45), Math.round((y - 435) * 1.049 + 150)],
  [
    [48, 435],
    // the bookBot's vault again
    [562, 435],
    [562, 682],
    [1218, 682],
    [1218, 435],
    [1230, 435],
    [1350, 420],
    [1362, 382],
    [1768, 342],
    [1878, 922],
    [1430, 1010],
    [1405, 882],
    [548, 882],
    [548, 1000],
    [48, 900],
  ],
  [
    { kind: "zone", ref: "Robot Alley", label: "Robot Alley", poly: rect(1224, 446, 1300, 700) },
    {
      kind: "zone",
      label: "Lobby",
      at: [1390, 530],
      poly: [
        [1304, 428],
        [1492, 406],
        [1506, 556],
        [1390, 586],
        [1304, 600],
      ],
    },
    {
      kind: "zone",
      ref: "Common Grounds Café",
      label: "Common Grounds Café",
      fit: "cafe",
      poly: [
        [1502, 402],
        [1590, 388],
        [1612, 530],
        [1516, 546],
      ],
    },
    {
      kind: "zone",
      label: "Staff only",
      poly: [
        [54, 441],
        [556, 441],
        [556, 688],
        [1104, 688],
        [1104, 876],
        [554, 876],
        [554, 994],
        [54, 896],
      ],
    },
    {
      kind: "zone",
      poly: [
        [1612, 364],
        [1764, 349],
        [1870, 917],
        [1704, 950],
        [1642, 600],
        [1622, 540],
      ],
    },
    {
      kind: "room",
      ref: "1103",
      label: "Auditorium",
      front: 0,
      fit: "auditorium",
      poly: [
        [1392, 594],
        [1638, 602],
        [1698, 950],
        [1464, 994],
      ],
    },
    { kind: "room", ref: "1202", label: "Lactation Room", front: N, fit: "empty", poly: rect(1336, 800, 1400, 842) },
    { kind: "room", ref: "1203", label: "Restroom", front: N, fit: "empty", poly: rect(1262, 800, 1306, 842) },
    { kind: "core", poly: rect(1150, 716, 1258, 845) },
    { kind: "core", poly: rect(1260, 716, 1298, 798) },
  ],
);

/** Adds the other end of every traced stair on the next floor, if that floor has room for it. */
function link(floors: Record<number, Floor>) {
  for (const [n, floor] of Object.entries(floors))
    for (const s of [...floor.shapes]) {
      if (s.kind !== "stair" || !s.dir || s.twin) continue;
      const other = floors[Number(n) + (s.dir === "up" ? 1 : -1)];
      if (!other || !s.poly.every((p) => pointIn(other.plate, p))) continue;
      // the other end is entered from the opposite edge: where one flight starts, the other one arrives
      other.shapes.push({ kind: "stair", twin: true, dir: s.dir === "up" ? "down" : "up", front: ((s.front ?? 0) + 2) % s.poly.length, poly: s.poly });
    }
  return floors;
}

export const FLOORS: Record<number, Floor> = link({
  1: level1,
  2: level2,
  3: level3,
  4: level4,
  5: level5,
});
