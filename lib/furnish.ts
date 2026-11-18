// Stylised walls and furniture for the 3D model, laid out in floor-map pixels
// (20px = 1 scene unit). Plain geometry with no three.js, so it can be tested.
import type { Floor, Pt, Shape } from "@/data/hunt-geometry";

/** What a room's photo caption tells us. Unknowns stay null or false. */
export type Fitout = {
  seats: number | null;
  display: boolean;
  whiteboard: boolean;
  window: "exterior" | "interior" | null;
  adjustable: boolean;
};

export type Tone = "table" | "chair" | "soft" | "screen" | "desk" | "stair";

/** A block: centre and footprint in px, rotation in radians on the map, height and base in scene units. */
export type Piece = { x: number; y: number; w: number; d: number; rot: number; h: number; base: number; tone: Tone; round?: boolean };
export type Wall = { a: Pt; b: Pt; glass: boolean };
export type Callout = { at: Pt; height: number; text: string };
/** What appears when one room or zone is opened up. */
export type Detail = { walls: Wall[]; pieces: Piece[]; callouts: Callout[] };
export type FloorFit = {
  /** Room floors, shrunk by half a wall so neighbours' walls sit side by side. */
  rooms: { ref?: string; poly: Pt[] }[];
  /** Steps are drawn at every zoom; everything else waits until its room is opened. */
  stairs: Piece[];
  /** Flights going down, drawn flat in the floor. */
  wells: Piece[];
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

/** A frame aligned to the polygon's longest edge: centre, axes, and extents along them. */
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

/** Points on a staggered grid inside `poly`, clear of its edges and of every `avoid` polygon. */
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

/** Room walls: glass on the front with a door gap, and glass at the back when the room has a window. */
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

/** One table with chairs around it, plus the screen and callouts the caption mentions. */
export function meetingRoom(room: Pt[], front: number, f: Fitout) {
  const fr = frame(room);
  const seats = f.seats ?? 6; // shortcut: rooms with no count in their caption are drawn with six chairs
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

/** Open study furniture, varied so the floor reads as a commons, not a grid. */
function commons(zone: Pt[], avoid: Pt[][]): Piece[] {
  // Few, large, aligned groups, one kind per row: a calm rhythm reads better than a varied scatter.
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

/** A frame on the edge you step onto a stair from: `u` runs along that edge, `v` away from it across the stair. */
function flight(poly: Pt[], entry: number, tread = 7) {
  const a = poly[entry % poly.length];
  const ex = norm(sub(poly[(entry + 1) % poly.length], a));
  let into: Pt = [-ex[1], ex[0]];
  if (dot(sub(centroid(poly), a), into) < 0) into = mul(into, -1);
  const us = poly.map((q) => dot(sub(q, a), ex));
  const mid = (Math.min(...us) + Math.max(...us)) / 2;
  // Slightly inside the outline, so a slanted edge never pushes a tread off the floor.
  const W = (Math.max(...us) - Math.min(...us)) * 0.88;
  const D = Math.max(...poly.map((q) => dot(sub(q, a), into))) * 0.92;
  const n = Math.max(tread > 7 ? 2 : 5, Math.round(D / tread));
  return { W, D, n, pitch: D / n, rot: Math.atan2(ex[1], ex[0]), place: (v: number, u = 0) => at(add(a, add(mul(ex, mid + u), mul(into, v + D * 0.04)))) };
}

/**
 * One straight flight up, starting at the `entry` edge and arriving at the far side. It climbs the share `span` of the
 * floor-to-floor rise (a landing splits a stair into two). Heights are fractions of the rise (1 = the floor above), so the scene sets the scale.
 */
export function steps(poly: Pt[], entry = 0, [lo, hi]: [number, number] = [0, 1], tread?: number): Piece[] {
  const f = flight(poly, entry, tread);
  const T = 0.14; // tread thickness
  return Array.from({ length: f.n }, (_, i) => {
    const top = lo + ((hi - lo) * (i + 1)) / f.n;
    return { ...f.place((i + 0.5) * f.pitch), w: f.W, d: f.pitch, rot: f.rot, h: Math.min(T, top), base: Math.max(0, top - T), tone: "stair" as const };
  });
}

/** The same flight seen from the floor above: treads dropping away from the `entry` edge, through the opening in the floor. */
export function well(poly: Pt[], entry = 0, [lo, hi]: [number, number] = [0, 1], tread?: number): Piece[] {
  const f = flight(poly, entry, tread);
  const T = 0.14;
  return Array.from({ length: f.n }, (_, i) => ({
    ...f.place((i + 0.5) * f.pitch), w: f.W, d: f.pitch, rot: f.rot, h: T, base: hi - 1 - ((hi - lo) * (i + 1)) / f.n - T, tone: "stair" as const,
  }));
}

/** A stair landing: one flat slab at `h` (a fraction of the rise), filling the outline, edge 0 along one side. */
function landing(poly: Pt[], h: number): Piece[] {
  const f = flight(poly, 0);
  const W = f.W / 0.88, D = f.D / 0.92; // the whole outline, so the flights on either side meet it
  return [{ ...f.place(D / 2 - f.D * 0.04), w: W, d: D, rot: f.rot, h: 0.14, base: h - 0.14, tone: "stair" }];
}

const box = (p: Pt, w: number, d: number, h: number, tone: Tone, rot = 0, base = 0): Piece => ({ ...at(p), w, d, rot, h, base, tone });
const disc = (p: Pt, w: number, h: number, tone: Tone, base = 0): Piece => ({ ...at(p), w, d: w, rot: 0, h, base, tone, round: true });
/** `n` points on a circle around `c`, starting at angle `a0` and covering `sweep` radians. */
const ring = (c: Pt, r: number, n: number, a0 = 0, sweep = 2 * Math.PI): { p: Pt; a: number }[] =>
  Array.from({ length: n }, (_, i) => {
    const a = a0 + (sweep * (sweep === 2 * Math.PI ? i : i + 0.5)) / n;
    return { p: [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)] as Pt, a };
  });

/** Stylised furniture for the one-of-a-kind spaces. Each is a few large, regular groups: what the place is for, not an inventory. */
function special(fit: NonNullable<Shape["fit"]>, poly: Pt[], front: number, avoid: Pt[][]): Piece[] {
  switch (fit) {
    case "quiet": // long reading tables in rows
      return gridIn(poly, 58, 24, avoid).flatMap(([x, y]) => [
        box([x, y], 38, 12, 0.3, "table"),
        ...[-12, 0, 12].flatMap((u) => [-10, 10].map((v) => disc([x + u, y + v], 6, 0.2, "chair"))),
      ]);
    case "lounge": // curved sofas around low tables, as the map draws them
      return gridIn(poly, 80, 38, avoid).flatMap(([x, y], k) => [
        disc([x, y], 20, 0.16, "table"),
        ...ring([x, y], 29, 7, k * 2.1, Math.PI * 1.15).map(({ p, a }) => box(p, 13.5, 10, 0.2, "soft", a + Math.PI / 2)),
      ]);
    case "alcove": { // a ring of easy chairs
      const c = centroid(poly);
      return [disc(c, 16, 0.2, "table"), ...ring(c, 24, 6).map(({ p, a }) => box(p, 11, 11, 0.18, "soft", a))];
    }
    case "carrels": { // one row of single desks, each with a privacy screen
      const fr = frame(poly);
      const n = Math.floor(fr.L / 17);
      return Array.from({ length: n }, (_, i) => (i + 0.5 - n / 2) * 17).flatMap((u) => [
        box(fr.at(u, -3), 11, 7, 0.28, "desk", fr.rot),
        box(fr.at(u, -6.5), 12, 1, 0.3, "screen", fr.rot, 0.1),
        disc(fr.at(u, 4.5), 5, 0.2, "chair"),
      ]);
    }
    case "showcase": // plinths with a screen on each
      return gridIn(poly, 38, 16, avoid).flatMap(([x, y]) => [box([x, y], 13, 13, 0.34, "desk"), box([x, y], 11, 1.5, 0.3, "screen", 0, 0.34)]);
    case "exhibit": // display walls with a table between
      return gridIn(poly, 50, 20, avoid).flatMap(([x, y], k) =>
        k % 2 ? [disc([x, y], 15, 0.3, "table"), ...ring([x, y], 12, 4, Math.PI / 4).map(({ p }) => disc(p, 5.5, 0.2, "chair"))] : [box([x, y], 28, 2.5, 0.55, "desk")],
      );
    case "cafe": // small tables for two
      return gridIn(poly, 34, 14, avoid).flatMap(([x, y]) => [disc([x, y], 10, 0.3, "table"), disc([x - 8.5, y], 5, 0.2, "chair"), disc([x + 8.5, y], 5, 0.2, "chair")]);
    case "auditorium": { // curved rows of seating facing a stage at the front
      const f = flight(poly, front);
      const local = (v: number, u = 0): Pt => {
        const q = f.place(v, u);
        return [q.x, q.y];
      };
      const rows = Math.max(3, Math.floor((f.D * 0.68) / 20));
      return [
        box(local(f.D * 0.07), f.W * 0.5, f.D * 0.08, 0.12, "table", f.rot),
        ...Array.from({ length: rows }, (_, i) => f.D * 0.3 + i * 20).flatMap((r) => {
          const sweep = Math.min(Math.PI * 0.55, (f.W * 0.8) / r);
          const n = Math.max(3, Math.round((r * sweep) / 22));
          return ring([0, 0], r, n, Math.PI / 2 - sweep / 2, sweep)
            .filter(({ p }) => pointIn(poly, local(p[1], p[0])) && edgeDistance(poly, local(p[1], p[0])) > 8)
            .map(({ p, a }) => box(local(p[1], p[0]), (r * sweep) / n - 2, 7, 0.2, "soft", f.rot + a + Math.PI / 2));
        }),
      ];
    }
    case "hall": // round banquet tables
      return gridIn(poly, 64, 30, avoid).flatMap(([x, y]) => [disc([x, y], 22, 0.3, "table"), ...ring([x, y], 16, 6).map(({ p }) => disc(p, 6, 0.2, "chair"))]);
    case "theater": { // a gently curved wall of screens, with stools facing it
      const f = flight(poly, front);
      const r = f.W * 0.6;
      const sweep = Math.PI * 0.5;
      const seg = (r * sweep) / 9;
      const local = (v: number, u = 0): Pt => {
        const q = f.place(v, u);
        return [q.x, q.y];
      };
      return [
        ...ring([0, f.D * 0.84 - r], r, 9, Math.PI / 2 - sweep / 2, sweep).map(({ p, a }) => box(local(p[1], p[0]), seg + 0.5, 1.5, 0.5, "screen", f.rot + a + Math.PI / 2, 0.04)),
        ...[0.26, 0.44].flatMap((v, row) => [-2, -1, 0, 1, 2].map((i) => disc(local(f.D * v, (i + row * 0.5 - 0.25) * f.W * 0.15), 7, 0.22, "soft"))),
      ];
    }
    case "lab":
      return lab(poly);
    case "commons":
      return commons(poly, avoid);
    default:
      return [];
  }
}

export function fitFloor(floor: Floor, fitoutOf: (ref: string) => Fitout | null): FloorFit {
  const out: FloorFit = { rooms: [], stairs: [], wells: [], detail: {} };
  const solids = floor.shapes.filter((s) => s.kind !== "zone").map((s) => s.poly);
  for (const s of floor.shapes) {
    if (s.kind === "room") {
      const room = inset(s.poly, WALL_IN);
      const f = (s.ref && fitoutOf(s.ref)) || NO_FITOUT;
      const front = s.front ?? 0;
      out.rooms.push({ ref: s.ref, poly: room });
      if (!s.ref) continue;
      const fit = s.fit ?? "meeting";
      const m = fit === "meeting" ? meetingRoom(room, front, f) : { pieces: special(fit, room, front, []), callouts: [] };
      out.detail[s.ref] = { walls: roomWalls(room, front, f.window !== null), ...m };
    } else if (s.kind === "zone" && s.fit && s.ref) out.detail[s.ref] = { walls: [], pieces: special(s.fit, s.poly, 0, solids), callouts: [] };
    else if (s.kind === "stair") (s.dir === "down" ? out.wells : out.stairs).push(...(s.span && s.span[0] === s.span[1] ? landing(s.poly, s.span[0] - (s.dir === "down" ? 1 : 0)) : (s.dir === "down" ? well : steps)(s.poly, s.front, s.span, s.tread)));
  }
  return out;
}
