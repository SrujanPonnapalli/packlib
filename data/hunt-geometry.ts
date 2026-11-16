// Rough floor geometry, traced by eye from NC State Libraries' Hunt floor maps
// (lib.ncsu.edu/hunt/map). Coordinates are pixels on those maps at 2000px wide,
// the renderers scale them. Rooms are on the right floor and roughly in the
// right spot, but it's not exact. Where a map labels a range of rooms
// ("3309–3316") I guessed the order.

export type Pt = [number, number];

export type Shape = {
  kind: "room" | "zone" | "stair" | "core" | "counter";
  poly: Pt[];
  /** Room number, or the space title if it doesn't have one. Links the shape to a space. */
  ref?: string;
  label?: string;
  /** Where to put the label, if the middle of the shape is a bad spot for it. */
  at?: Pt;
  /** Index of the edge with the glass front and door (edge i goes from point i to i+1). */
  front?: number;
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
const N = 0, E = 1, W = 3;

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

/** Outline of the whole building, drawn on every map. */
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
      label: "Reading Room Overlook",
      at: [448, 330],
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
    { kind: "stair", ref: "Monumental Stair with Roman Seating", poly: rect(545, 360, 612, 437) },
    {
      kind: "stair",
      poly: [
        [908, 460],
        [1005, 450],
        [1015, 548],
        [910, 548],
      ],
    },
    { kind: "stair", poly: rect(523, 447, 627, 550) },
    { kind: "stair", poly: rect(125, 225, 180, 305) },
    { kind: "core", poly: rect(527, 157, 588, 287) },
    { kind: "core", poly: rect(673, 447, 780, 550) },
    { kind: "core", poly: rect(1130, 447, 1200, 550) },
    { kind: "core", poly: rect(1297, 430, 1357, 550) },
    { kind: "core", poly: rect(1283, 157, 1357, 200) },
  ],
};

// Levels 1, 2, 4 and 5 are placeholders until I trace them.
const placeholder = (plate: Pt[]): Floor => ({ traced: false, plate, shapes: [] });

export const FLOORS: Record<number, Floor> = {
  1: placeholder(ENVELOPE),
  2: placeholder(ENVELOPE),
  3: level3,
  4: placeholder(LEVEL_3_PLATE),
  5: placeholder(LEVEL_3_PLATE),
};
