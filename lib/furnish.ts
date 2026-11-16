// Simplified walls and furniture for the 3D model, laid out in floor-map pixels
// (20px = 1 scene unit). Plain geometry with no three.js so it's testable.
import type { Floor, Pt } from "@/data/hunt-geometry";

/** What a room's photo caption tells us. Unknown stuff stays null/false. */
export type Fitout = {
  seats: number | null;
  display: boolean;
  whiteboard: boolean;
  window: "exterior" | "interior" | null;
  adjustable: boolean;
};

export type Tone = "table" | "chair" | "soft" | "screen" | "desk" | "stair";

/** A block: center and footprint in px, rotation in radians, height and base in scene units. */
export type Piece = { x: number; y: number; w: number; d: number; rot: number; h: number; base: number; tone: Tone; round?: boolean };
export type Wall = { a: Pt; b: Pt; glass: boolean };
export type Callout = { at: Pt; height: number; text: string };
/** What shows up when a room or zone is opened. */
export type Detail = { walls: Wall[]; pieces: Piece[]; callouts: Callout[] };
export type FloorFit = {
  /** Room floors shrunk by half a wall so neighboring walls sit side by side. */
  rooms: { ref?: string; poly: Pt[] }[];
  /** Steps are drawn at every zoom level, everything else waits until its room is opened. */
  stairs: Piece[];
  detail: Record<string, Detail>;
};

const WALL_IN = 1.5;
const NO_FITOUT: Fitout = { seats: null, display: false, whiteboard: false, window: null, adjustable: false };

const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];
const len = (a: Pt) => Math.hypot(a[0], a[1]);
const norm = (a: Pt): Pt => mul(a, 1 / len(a));
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const at = (p: Pt) => ({ x: p[0], y: p[1] });

export const centroid = (poly: Pt[]): Pt => mul(poly.reduce(add, [0, 0]), 1 / poly.length);

export function pointIn(poly: Pt[], [x, y]: Pt) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function edgeDistance(poly: Pt[], p: Pt) {
  let best = Infinity;
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const ab = sub(b, a);
    const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab)));
    best = Math.min(best, len(sub(p, lerp(a, b, t))));
  });
  return best;
}

/** Shrinks a convex polygon by `d`, keeping sharp corners. */
export function inset(poly: Pt[], d: number): Pt[] {
  const c = centroid(poly);
  const lines = poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const dir = sub(b, a);
    let n: Pt = norm([-dir[1], dir[0]]);
    if (dot(sub(c, lerp(a, b, 0.5)), n) < 0) n = mul(n, -1);
    return { p: add(a, mul(n, d)), dir };
  });
  return lines.map((l1, i) => {
    const l0 = lines[(i - 1 + lines.length) % lines.length];
    const cross = l0.dir[0] * l1.dir[1] - l0.dir[1] * l1.dir[0];
    if (Math.abs(cross) < 1e-9) return l1.p;
    const w = sub(l1.p, l0.p);
    return add(l0.p, mul(l0.dir, (w[0] * l1.dir[1] - w[1] * l1.dir[0]) / cross));
  });
}

/** A frame lined up with the polygon's longest edge: center, axes, and extents along them. */
function frame(poly: Pt[]) {
  let longest = 0;
  poly.forEach((a, i) => {
    if (len(sub(poly[(i + 1) % poly.length], a)) > len(sub(poly[(longest + 1) % poly.length], poly[longest]))) longest = i;
  });
  const ax = norm(sub(poly[(longest + 1) % poly.length], poly[longest]));
  const ay: Pt = [-ax[1], ax[0]];
  const c0 = centroid(poly);
  const us = poly.map((p) => dot(sub(p, c0), ax));
  const vs = poly.map((p) => dot(sub(p, c0), ay));
  const c = add(c0, add(mul(ax, (Math.max(...us) + Math.min(...us)) / 2), mul(ay, (Math.max(...vs) + Math.min(...vs)) / 2)));
  return {
    c,
    ax,
    L: Math.max(...us) - Math.min(...us),
    W: Math.max(...vs) - Math.min(...vs),
    rot: Math.atan2(ax[1], ax[0]),
    at: (u: number, v: number) => add(c, add(mul(ax, u), mul(ay, v))),
  };
}

/** Points on a staggered grid inside `poly`, away from its edges and from every `avoid` polygon. */
export function gridIn(poly: Pt[], step: number, margin: number, avoid: Pt[][] = []): Pt[] {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const out: Pt[] = [];
  let row = 0;
  for (let y = Math.min(...ys) + step / 2; y < Math.max(...ys); y += step * 0.87, row++)
    for (let x = Math.min(...xs) + (row % 2 ? step : step / 2); x < Math.max(...xs); x += step) {
      const p: Pt = [x, y];
      if (!pointIn(poly, p) || edgeDistance(poly, p) < margin) continue;
      if (avoid.some((a) => pointIn(a, p) || edgeDistance(a, p) < margin)) continue;
      out.push(p);
    }
  return out;
}

/** Room walls: glass at the front with a gap for the door, and glass at the back if the room has a window. */
export function roomWalls(room: Pt[], front: number, backGlass: boolean): Wall[] {
  const n = room.length;
  const back = n === 4 ? (front + 2) % 4 : -1;
  return room.flatMap((a, i): Wall[] => {
    const b = room[(i + 1) % n];
    if (i !== front) return [{ a, b, glass: backGlass && i === back }];
    const half = Math.min(9, len(sub(b, a)) * 0.3) / len(sub(b, a)) / 2;
    return [
      { a, b: lerp(a, b, 0.25 - half), glass: true },
      { a: lerp(a, b, 0.25 + half), b, glass: true },
    ];
  });
}

/** One table with chairs around it, plus the screen and callouts from the caption. */
export function meetingRoom(room: Pt[], front: number, f: Fitout) {
  const fr = frame(room);
  const seats = f.seats ?? 6; // TODO: rooms with no count in their caption just get six chairs
  const ends = seats >= 8 ? 2 : 0;
  const side1 = Math.ceil((seats - ends) / 2);
  const side2 = seats - ends - side1;
  const C = 6; // chair size
  const GAP = 1.5;
  const M = 3;
  const pitch = Math.min(11, (fr.L - 2 * M - (ends ? 2 * (GAP + C) : 0)) / side1);
  const tL = side1 * pitch;
  const tD = Math.max(7, Math.min(15, fr.W - 2 * (GAP + C + M)));
  const off = tD / 2 + GAP + C / 2;
  const chair = (u: number, v: number): Piece => ({ ...at(fr.at(u, v)), w: C, d: C, rot: fr.rot, h: 0.2, base: 0, tone: "chair" });

  const pieces: Piece[] = [{ ...at(fr.c), w: tL, d: tD, rot: fr.rot, h: 0.3, base: 0, tone: "table" }];
  for (let k = 0; k < side1; k++) pieces.push(chair(-tL / 2 + pitch * (k + 0.5), -off));
  for (let k = 0; k < side2; k++) pieces.push(chair(-tL / 2 + (tL / side2) * (k + 0.5), off));
  if (ends) pieces.push(chair(-(tL / 2 + GAP + C / 2), 0), chair(tL / 2 + GAP + C / 2, 0));

  const edges = room.map((a, i) => ({ a, b: room[(i + 1) % room.length], i }));
  const back = room.length === 4 ? (front + 2) % 4 : -1;
  const short = edges.filter((e) => e.i !== front && Math.abs(dot(norm(sub(e.b, e.a)), fr.ax)) < 0.5);
  const screenWall = short.find((e) => e.i !== back) ?? short[0];

  const callouts: Callout[] = [
    { at: fr.c, height: 0.32, text: f.adjustable ? "Adjustable-height table" : f.seats ? `Table for ${f.seats}` : "Table and chairs" },
  ];
  if (f.display && screenWall) {
    const mid = lerp(screenWall.a, screenWall.b, 0.5);
    const pos = add(mid, mul(norm(sub(fr.c, mid)), 1.4));
    const d = sub(screenWall.b, screenWall.a);
    pieces.push({ ...at(pos), w: len(d) * 0.5, d: 1, rot: Math.atan2(d[1], d[0]), h: 0.28, base: 0.32, tone: "screen" });
    callouts.push({ at: pos, height: 0.62, text: "Wall display" });
  }
  if (f.whiteboard) {
    const e = edges.find((e) => e.i !== front && e.i !== back && e !== screenWall);
    if (e) callouts.push({ at: lerp(e.a, e.b, 0.5), height: 0.75, text: "Whiteboard walls" });
  }
  if (f.window && back >= 0) {
    const e = edges[back];
    callouts.push({ at: lerp(e.a, e.b, 0.5), height: 0.7, text: f.window === "exterior" ? "Outside window" : "Window onto the library" });
  }
  return { pieces, callouts };
}

/** Rows of workstations, each a desk, a monitor and a chair. */
function lab(room: Pt[]): Piece[] {
  return gridIn(room, 18, 10).flatMap(([x, y]): Piece[] => [
    { x, y, w: 13, d: 7, rot: 0, h: 0.28, base: 0, tone: "desk" },
    { x, y: y - 2.3, w: 9, d: 1, rot: 0, h: 0.2, base: 0.28, tone: "screen" },
    { x, y: y + 6, w: 5, d: 5, rot: 0, h: 0.2, base: 0, tone: "chair" },
  ]);
}

/** Open study furniture, mixed up so it looks like a commons instead of a grid. */
function commons(zone: Pt[], avoid: Pt[][]): Piece[] {
  // a few big aligned groups, one kind per row. looks cleaner than a random mix
  const STEP = 46;
  return gridIn(zone, STEP, 18, avoid).flatMap(([x, y]): Piece[] => {
    const p = (u: number, v: number) => at([x + u, y + v]);
    switch (Math.round(y / (STEP * 0.87)) % 3) {
      case 0: // six-top
        return [
          { x, y, w: 28, d: 13, rot: 0, h: 0.3, base: 0, tone: "table" },
          ...[-9, 0, 9].flatMap((u) => [-11, 11].map((v): Piece => ({ ...p(u, v), w: 6, d: 6, rot: 0, h: 0.2, base: 0, tone: "chair" }))),
        ];
      case 1: // round table with stools
        return [
          { x, y, w: 16, d: 16, rot: 0, h: 0.3, base: 0, tone: "table", round: true },
          ...[0, 1, 2, 3].map((i): Piece => {
            const a = Math.PI / 4 + (i * Math.PI) / 2;
            return { ...p(13 * Math.cos(a), 13 * Math.sin(a)), w: 6, d: 6, rot: 0, h: 0.2, base: 0, tone: "chair", round: true };
          }),
        ];
      default: // two soft chairs and a side table
        return [
          { ...p(-11, 0), w: 12, d: 12, rot: 0, h: 0.18, base: 0, tone: "soft" },
          { ...p(11, 0), w: 12, d: 12, rot: 0, h: 0.18, base: 0, tone: "soft" },
          { x, y, w: 6, d: 6, rot: 0, h: 0.22, base: 0, tone: "table", round: true },
        ];
    }
  });
}

/** A flight of steps rising along the stair's long side. */
export function steps(poly: Pt[]): Piece[] {
  const fr = frame(poly);
  const n = Math.max(4, Math.round(fr.L / 6));
  return Array.from({ length: n }, (_, i) => ({
    ...at(fr.at(-fr.L / 2 + ((i + 0.5) * fr.L) / n, 0)),
    w: fr.L / n,
    d: fr.W,
    rot: fr.rot,
    h: 0.06 + ((i + 1) * 0.7) / n,
    base: 0,
    tone: "stair" as const,
  }));
}

export function fitFloor(floor: Floor, fitoutOf: (ref: string) => Fitout | null): FloorFit {
  const out: FloorFit = { rooms: [], stairs: [], detail: {} };
  const solids = floor.shapes.filter((s) => s.kind !== "zone").map((s) => s.poly);
  for (const s of floor.shapes) {
    if (s.kind === "room") {
      const room = inset(s.poly, WALL_IN);
      const f = (s.ref && fitoutOf(s.ref)) || NO_FITOUT;
      const front = s.front ?? 0;
      out.rooms.push({ ref: s.ref, poly: room });
      if (!s.ref) continue;
      const fit = s.fit ?? "meeting";
      const m = fit === "meeting" ? meetingRoom(room, front, f) : { pieces: fit === "lab" ? lab(room) : [], callouts: [] };
      out.detail[s.ref] = { walls: roomWalls(room, front, f.window !== null), ...m };
    } else if (s.kind === "zone" && s.fit === "commons" && s.ref)
      out.detail[s.ref] = { walls: [], pieces: commons(s.poly, solids), callouts: [] };
    else if (s.kind === "stair") out.stairs.push(...steps(s.poly));
  }
  return out;
}
