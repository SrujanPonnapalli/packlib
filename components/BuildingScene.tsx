"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Edges, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { Floor, Pt, Shape } from "@/data/hunt-geometry";
import { levelName, spaceByRef, type LibraryView } from "@/data/libraries";
import type { Space } from "@/data/kinds";
import { inset, fitFloor, pointIn, type Detail, type FloorFit, type Piece, type Wall } from "@/lib/furnish";
import { useLibrary } from "./LibraryContext";
import { scatter, seeded } from "@/lib/crowd";
import { useTheme } from "@/lib/theme";
import { forPage } from "@/lib/keys";
import { BUSY_LABEL, zoneFor, type Busy, type Occupancy, type Zone } from "@/lib/occupancy";

// map pixels -> scene units, centered on the building
const U = 20;
const wx = (x: number) => (x - 1005) / U;
const wz = (y: number) => (y - 451) / U;

const LIFT = 26; // how far the floors above an open level move away
const DROP = 9; // and how far the floors below it sink
// in the whole-building view the floors spread apart (exploded view) so each
// level's heat shows on its own instead of blending through the glass
const SPREAD = 1.5;
const ROOM_H = 0.5; // closed room: just a block
const WALL_H = 0.55; // open room: low cut-away walls so you can see inside
// A stair comes up through the opening in the floor above, flush with it (the library's rise)...
const STAIR_OPEN = 2.2; // ...and folds down low while a level is open so it doesn't tower over the rooms
const GLASS = 0.5; // how solid a floor is in the whole-building view
// Every material can fade, so three.js would sort them all by distance from the
// camera, and rotating the model flips which transparent layer is on top (colors
// snap instead of changing smoothly). So floors draw bottom to top instead, and by
// layer within a floor, which is a fixed order that doesn't depend on the camera.
// (Set per mesh because three.js resets a group's order at every nested group.)
const DRAW = { plate: 0, floor: 1, heat: 2, rooms: 3 };
const drawOrder = (n: number, layer: keyof typeof DRAW) => n * 10 + DRAW[layer];
const FLAT = 0.25; // how flat closed rooms get while another room is open
const WALL_T = 2.5; // px

// Two levels of detail. From far away the floor is plain white blocks with
// nothing inside. Opening a room shows its walls, glass and furniture,
// outlined in teal.
const LIGHT = {
  plate: "#ebebeb",
  plateSide: "#878787",
  zone: "#f4f4f4",
  overlook: "#e4e4e4",
  block: "#fcfcfc",
  blockSide: "#e3e3e3",
  blockEdge: "#a0a0a0",
  hover: "#e2f4ef",
  pick: "#1ec7b1",
  pickDeep: "#0e8f7f",
  pickWash: "#d3eee7",
  wall: "#fcfcfc",
  glass: "#cfe5e0",
  core: "#cccccc",
  coreTop: "#d9d9d9",
  counter: "#e9e0cd",
  counterSide: "#c9bfa9",
  table: "#ddd0b7",
  chair: "#868686",
  soft: "#cdc4b2",
  screen: "#34322e",
  desk: "#e8dfcc",
  stair: "#d4d4d4",
  edge: "#999999",
};
// dark theme: same neutral model at night. floors just above the page color, rooms a bit lighter
const DARK: typeof LIGHT = {
  plate: "#242424",
  plateSide: "#0c0c0c",
  zone: "#2a2a2a",
  overlook: "#303030",
  block: "#383838",
  blockSide: "#2c2c2c",
  blockEdge: "#5a5a5a",
  hover: "#1c3c37",
  pick: "#1ec7b1",
  pickDeep: "#3cd3bf",
  pickWash: "#174540",
  wall: "#3a3a3a",
  glass: "#2b4a45",
  core: "#454545",
  coreTop: "#3d3d3d",
  counter: "#4a4a4a",
  counterSide: "#3a3a3a",
  table: "#5a5a5a",
  chair: "#8c8c8c",
  soft: "#505050",
  screen: "#0e0e0e",
  desk: "#525252",
  stair: "#404040",
  edge: "#575757",
};

// busyness, pale to strong (same ramp as the page). the floor's wash shows it
const HEAT_LIGHT: Record<Busy, string> = { quiet: "#9dd08a", busy: "#f2b84b", packed: "#d9533a" };
const HEAT_DARK: Record<Busy, string> = { quiet: "#82bb6f", busy: "#e3aa43", packed: "#d45a40" };
const PALETTES = { light: { ...LIGHT, heat: HEAT_LIGHT }, dark: { ...DARK, heat: HEAT_DARK } };
type Palette = (typeof PALETTES)["light"];
/** Scene colors for the current theme. Switching recolors the model in place, no rebuild and the camera stays put. */
const usePalette = (): Palette => PALETTES[useTheme()];
const CLOTHES = ["#45413b", "#5d5850", "#776d61", "#4c5864", "#8b5b4a", "#6a7461"];
const PEOPLE_ZOOM = 14; // closer than this and dots turn into people
const CROWD_CAP = 220; // per zone, keeps a packed commons readable and cheap to draw

/** Everything the scene needs about a library, computed once per library. */
type Model = {
  lib: LibraryView;
  floors: Record<number, Floor>;
  fits: Record<number, FloorFit>;
  /** Floor-to-floor spacing, exaggerated so the stack is easier to read. */
  rise: number;
  /** Height of floor `n`, spread apart or not. */
  y: (n: number, spread?: number) => number;
  home: [number, number, number];
  /** Height the match pins float at in the whole-building view (above the top floor). */
  pinTop: number;
  /** Floors sorted by height, for staggering the intro. */
  order: number[];
  byRef: (ref: string) => Space | undefined;
};

function useModel(): Model {
  const lib = useLibrary();
  return useMemo(() => {
    const byRef = (ref: string) => spaceByRef(lib, ref);
    const order = Object.keys(lib.floors).map(Number).sort((a, b) => a - b);
    const y = (n: number, spread = 1) => order.indexOf(n) * lib.rise * spread;
    const top = y(order.at(-1)!, SPREAD);
    return {
      lib,
      floors: lib.floors,
      fits: Object.fromEntries(Object.entries(lib.floors).map(([n, f]) => [n, fitFloor(f, (ref) => byRef(ref)?.fitout ?? null)])),
      rise: lib.rise,
      y,
      home: [0, top / 2, 0],
      pinTop: top + ROOM_H + 4,
      order,
      byRef,
    };
  }, [lib]);
}

/** Geometry and space data are both kept by hand, so warn when they don't match. */
function useDriftWarnings({ floors, lib, byRef }: Model) {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    for (const [n, floor] of Object.entries(floors)) {
      if (!floor.traced) continue;
      const refs = new Set(floor.shapes.map((s) => s.ref));
      for (const ref of refs) if (ref && !byRef(ref)) console.warn(`Geometry: no space for "${ref}" on level ${n}`);
      for (const s of lib.spaces)
        if (s.level === Number(n) && !refs.has(s.room ?? s.title)) console.warn(`Geometry: level ${n} has no shape for ${s.title}`);
    }
  }, [floors, lib, byRef]);
}

function extrude(poly: Pt[], height: number, holes: Pt[][] = []) {
  const flat = (ring: Pt[]) => ring.map(([x, y]) => new THREE.Vector2(wx(x), -wz(y)));
  const shape = new THREE.Shape(flat(poly));
  for (const h of holes) shape.holes.push(new THREE.Path(flat(h)));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
  });
  geo.rotateX(-Math.PI / 2); // lie flat, extruding upward
  return geo;
}

function centre(poly: Pt[]): Pt {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}

/** Eases toward a target over time. `dt` is clamped since on-demand rendering reports idle time as one huge frame. */
const ease = (dt: number, seconds: number) => 1 - Math.exp(-Math.min(dt, 1 / 30) / seconds);

// every wall and piece of furniture is one of these two shapes, scaled
const BOX = new THREE.BoxGeometry(1, 1, 1);
const DISC = new THREE.CylinderGeometry(0.5, 0.5, 1, 20);
const UP = new THREE.Vector3(0, 1, 0);
// a person: tapered body plus a head. both unit-sized and scaled per instance
const BODY = new THREE.CylinderGeometry(0.72, 1, 1, 10).translate(0, 0.5, 0);
const HEAD = new THREE.SphereGeometry(1, 12, 8);

const placed = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rot: number) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(UP, rot), new THREE.Vector3(sx, sy, sz));

function wallMatrix(w: Wall) {
  const dx = w.b[0] - w.a[0];
  const dy = w.b[1] - w.a[1];
  return placed(
    wx((w.a[0] + w.b[0]) / 2),
    WALL_H / 2,
    wz((w.a[1] + w.b[1]) / 2),
    Math.hypot(dx, dy) / U,
    WALL_H,
    WALL_T / U,
    -Math.atan2(dy, dx),
  );
}

// round chairs look less busy than a bunch of tiny boxes
const isRound = (p: Piece) => p.round || p.tone === "chair";
const pieceMatrix = (p: Piece) => placed(wx(p.x), p.base + p.h / 2, wz(p.y), p.w / U, p.h, (isRound(p) ? p.w : p.d) / U, -p.rot);

type Item = { m: THREE.Matrix4; color?: string };

/** Instanced mesh: lots of copies of one shape in one draw call. Not clickable, the floor under it gets the click. */
function Blocks({
  geometry,
  material,
  items,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  items: Item[];
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const c = new THREE.Color();
    items.forEach((it, i) => {
      mesh.setMatrixAt(i, it.m);
      if (it.color) mesh.setColorAt(i, c.set(it.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [items, material, geometry]); // new material (theme switch) means a new mesh, which needs its colors set again
  if (items.length === 0) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, items.length]}
      castShadow
      receiveShadow
      frustumCulled={false}
      raycast={() => null}
    />
  );
}

/** Materials remember their normal opacity so a whole floor can fade together. */
function lambert(color: string, base = 1, glass = false) {
  const m = new THREE.MeshLambertMaterial({
    color,
    transparent: true,
    opacity: base,
  });
  m.userData = { base, glass };
  return m;
}

function useMaterials() {
  const P = usePalette();
  return useMemo(() => {
    const wall = lambert(P.wall);
    const rim = lambert(P.pickDeep);
    const glass = lambert(P.glass, 0.35, true);
    // BoxGeometry faces: +x, -x, +y (top), -y, +z, -z. ExtrudeGeometry: caps, sides.
    return {
      wall: [wall, wall, rim, wall, wall, wall],
      glass: [glass, glass, rim, glass, glass, glass],
      piece: lambert("#ffffff"), // tinted per instance
      plate: [lambert(P.plate), lambert(P.plateSide)].map((m) => ((m.userData.floor = true), m)),
      block: [lambert(P.block), lambert(P.blockSide)],
      blockHover: [lambert(P.hover), lambert(P.blockSide)],
      core: [lambert(P.coreTop), lambert(P.core)],
      counter: [lambert(P.counter), lambert(P.counterSide)],
      hit: lambert("#ffffff", 0), // invisible, but catches clicks
      heat: Object.fromEntries((Object.keys(P.heat) as Busy[]).map((b) => [b, hatched(b, P.heat[b])])) as Record<Busy, THREE.MeshLambertMaterial>,
      // on the open level, just a light wash so the labels and people stay readable
      wash: Object.fromEntries((Object.keys(P.heat) as Busy[]).map((b) => [b, lambert(P.heat[b], 0.3, true)])) as Record<Busy, THREE.MeshLambertMaterial>,
    };
  }, [P]);
}

// hatch spacing in scene units (about 6, 4, 3 px at overview zoom). denser = more people, same as the swatches
const HATCH: Record<Busy, { pitch: number; cross: boolean }> = { quiet: { pitch: 1, cross: false }, busy: { pitch: 0.6, cross: false }, packed: { pitch: 0.55, cross: true } };

/** Heat material: ramp color with hatching on top. Cap UVs are in scene units so the hatch is even across rooms. */
function hatched(b: Busy, color: string) {
  const m = lambert(color, 0.8, true);
  if (typeof document === "undefined") return m;
  const size = 32;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, size, size);
  g.strokeStyle = "#8f8f8f"; // darkens the heat color for the hatch lines
  g.lineWidth = 5;
  // draw the diagonals past the corners so the tile repeats without seams
  const diag = (flip: boolean) => {
    for (const o of [-size, 0, size]) {
      g.beginPath();
      if (flip) { g.moveTo(o, 0); g.lineTo(o + size, size); } else { g.moveTo(o, size); g.lineTo(o + size, 0); }
      g.stroke();
    }
  };
  diag(false);
  if (HATCH[b].cross) diag(true);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / HATCH[b].pitch, 1 / HATCH[b].pitch);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  m.map = t;
  return m;
}

type Hover = (e: ThreeEvent<PointerEvent>, over: boolean) => void;

function Slab({
  poly,
  height,
  color,
  material,
  cast,
  edges,
  floor,
  order = 0,
  onClick,
  onHover,
}: {
  poly: Pt[];
  height: number;
  color?: string;
  material?: THREE.Material | THREE.Material[];
  cast?: boolean;
  edges?: boolean;
  /** Part of the floor itself, turns to glass in the whole-building view. */
  floor?: boolean;
  /** Fixed draw order (see DRAW). */
  order?: number;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  onHover?: Hover;
}) {
  const geo = useMemo(() => extrude(poly, height), [poly, height]);
  const P = usePalette();
  return (
    <mesh
      geometry={geo}
      material={material}
      renderOrder={order}
      castShadow={cast}
      receiveShadow
      onClick={onClick}
      onPointerOver={onHover && ((e) => onHover(e, true))}
      onPointerOut={onHover && ((e) => onHover(e, false))}
    >
      {!material && <meshLambertMaterial color={color} transparent userData={{ floor }} />}
      {edges && <Edges threshold={15} color={P.blockEdge} transparent renderOrder={order} />}
    </mesh>
  );
}

/** Inside of an opened room or zone. Grows up out of the floor when it appears. */
function Inside({ detail, mats }: { detail: Detail; mats: ReturnType<typeof useMaterials> }) {
  const group = useRef<THREE.Group>(null!);
  const grow = useRef(0.001);
  const P = usePalette();
  const items = useMemo(
    () => ({
      walls: detail.walls.filter((w) => !w.glass).map((w) => ({ m: wallMatrix(w) })),
      glass: detail.walls.filter((w) => w.glass).map((w) => ({ m: wallMatrix(w) })),
      boxes: detail.pieces.filter((p) => !isRound(p)).map((p) => ({ m: pieceMatrix(p), color: P[p.tone] })),
      discs: detail.pieces.filter(isRound).map((p) => ({ m: pieceMatrix(p), color: P[p.tone] })),
    }),
    [detail, P],
  );
  useFrame((state, dt) => {
    if (grow.current === 1) return;
    grow.current += (1 - grow.current) * ease(dt, 0.09);
    if (grow.current > 0.995) grow.current = 1;
    else state.invalidate();
    group.current.scale.y = grow.current;
  });
  return (
    <group ref={group} scale-y={0.001}>
      <Blocks geometry={BOX} material={mats.wall} items={items.walls} />
      <Blocks geometry={BOX} material={mats.glass} items={items.glass} />
      <Blocks geometry={BOX} material={mats.piece} items={items.boxes} />
      <Blocks geometry={DISC} material={mats.piece} items={items.discs} />
    </group>
  );
}

/** People for one sensor zone, placed on its space. */
type Crowd = {
  zone: Zone;
  room: boolean; // closed rooms show people as dots on the roof until opened
  polys: Pt[][];
  seated: { at: Pt; rot: number }[];
  standing: Pt[];
  walkTo: Pt[]; // spots the walking people move between
};

function crowdsFor(n: number, floor: Floor, fit: FloorFit, zones: Zone[]): Crowd[] {
  return zones.flatMap((zone) => {
    // every shape, not just the first: Hill draws one space (the stacks, a floor's carrels) as several shapes
    const shapes = floor.shapes.filter((s) => s.ref !== undefined && zone.refs.includes(s.ref));
    if (!shapes.length || zone.count === null) return [];
    const room = shapes[0].kind === "room";
    const polys = shapes.map((s) => (room ? (fit.rooms.find((r) => r.ref === s.ref)?.poly ?? s.poly) : s.poly));
    const avoid = floor.shapes.filter((s) => s.kind !== "zone" && !zone.refs.includes(s.ref ?? "")).map((s) => s.poly);
    const pieces = zone.refs.flatMap((ref) => fit.detail[ref]?.pieces ?? []);
    // most people in a study space are sitting, so fill chairs first (shuffled), then the floor
    const rand = seeded(zone.id * 7 + n);
    const chairs = pieces.filter((p) => p.tone === "chair").sort(() => rand() - 0.5);
    const total = Math.min(zone.count, CROWD_CAP);
    const seated = chairs.slice(0, Math.min(chairs.length, Math.round(total * 0.75))).map((c) => ({ at: [c.x, c.y] as Pt, rot: c.rot }));
    return [
      {
        zone,
        room,
        polys,
        seated,
        standing: scatter(polys, total - seated.length, zone.id, avoid, pieces),
        walkTo: scatter(polys, 24, zone.id + 1, avoid, pieces),
      },
    ];
  });
}

const tint = (k: number) => CLOTHES[k % CLOTHES.length];
// drawn a bit bigger than real life so people are still visible at room zoom
const person = (x: number, z: number, base: number, sitting: boolean, color: string): Item[] => [
  { m: placed(x, base + (sitting ? 0.18 : 0), z, 0.15, sitting ? 0.27 : 0.5, 0.15, 0), color },
  { m: placed(x, base + (sitting ? 0.56 : 0.63), z, 0.11, 0.11, 0.11, 0), color },
];

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// first visit in a session: floors rise into place one by one (the layout marks later loads)
const arriving = () => typeof document !== "undefined" && !document.documentElement.dataset.arrived && !reduceMotion();

/** People walking between a few spots in their zone. Positions are made up, only the count is real. */
function Walkers({ crowd, base, count, mats }: { crowd: Crowd; base: number; count: number; mats: ReturnType<typeof useMaterials> }) {
  const body = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.InstancedMesh>(null);
  const walkers = useMemo(() => {
    const rand = seeded(crowd.zone.id + 99);
    return crowd.standing.slice(0, count).map((p, k) => ({ x: p[0], y: p[1], to: crowd.walkTo[k % crowd.walkTo.length], speed: 8 + rand() * 6, rand, k }));
  }, [crowd, count]);
  useLayoutEffect(() => {
    const c = new THREE.Color();
    walkers.forEach((w) => {
      body.current?.setColorAt(w.k, c.set(tint(w.k + 3)));
      head.current?.setColorAt(w.k, c.set(tint(w.k + 3)));
    });
  }, [walkers, mats]); // a theme switch rebuilds the meshes, so they need their colors again
  useFrame((state, dt) => {
    if (!body.current || !head.current) return;
    const step = Math.min(dt, 1 / 20);
    walkers.forEach((w) => {
      const dx = w.to[0] - w.x;
      const dy = w.to[1] - w.y;
      const d = Math.hypot(dx, dy);
      if (d < 1) w.to = crowd.walkTo[Math.floor(w.rand() * crowd.walkTo.length)];
      else {
        const k = Math.min(1, (w.speed * step) / d);
        w.x += dx * k;
        w.y += dy * k;
      }
      const bob = Math.abs(Math.sin(state.clock.elapsedTime * 9 + w.k)) * 0.025; // a little step in the walk
      const [b, h] = person(wx(w.x), wz(w.y), base + bob, false, "");
      body.current!.setMatrixAt(w.k, b.m);
      head.current!.setMatrixAt(w.k, h.m);
    });
    body.current.instanceMatrix.needsUpdate = true;
    head.current.instanceMatrix.needsUpdate = true;
    state.invalidate();
  });
  if (!walkers.length) return null;
  return (
    <>
      <instancedMesh ref={body} args={[BODY, mats.piece, walkers.length]} castShadow frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={head} args={[HEAD, mats.piece, walkers.length]} castShadow frustumCulled={false} raycast={() => null} />
    </>
  );
}

/** A zone's people up close: little figures, sitting on chairs first, some walking. */
function People({ crowd, base, mats }: { crowd: Crowd; base: number; mats: ReturnType<typeof useMaterials> }) {
  const moving = !reduceMotion() ? Math.round(crowd.standing.length * 0.35) : 0;
  const items = useMemo(() => {
    const still = [
      ...crowd.seated.map((s, k) => person(wx(s.at[0]), wz(s.at[1]), base, true, tint(k))),
      ...crowd.standing.slice(moving).map(([x, y], k) => person(wx(x), wz(y), base, false, tint(k + 1))),
    ];
    return { body: still.map((p) => p[0]), head: still.map((p) => p[1]) };
  }, [crowd, base, moving]);
  return (
    <>
      <Blocks geometry={BODY} material={mats.piece} items={items.body} />
      <Blocks geometry={HEAD} material={mats.piece} items={items.head} />
      {moving > 0 && <Walkers crowd={crowd} base={base} count={moving} mats={mats} />}
    </>
  );
}

type Common = {
  active: number | null;
  selectedRef: string | null;
  onSelectLevel: (n: number) => void;
  onOpenSpace: (id: string) => void;
  onClear: () => void;
  occupancy?: Occupancy | null;
  /** Study Match results, best first, tinted and numbered on the model. */
  matches?: string[];
  /** The match whose card is hovered/focused in the list, so its pin can stand out. */
  highlight?: string | null;
};

function FloorModel({ m, n, floor, active, selectedRef, onSelectLevel, onOpenSpace, onClear, occupancy, matches = [], onTip }: Common & { m: Model; n: number; floor: Floor; onTip?: (ref: string | null) => void }) {
  const group = useRef<THREE.Group>(null!);
  const [hover, setHover] = useState<string | null>(null);
  const mats = useMaterials();
  const fit = m.fits[n];
  const STAIR_FULL = m.rise;
  // every stair going down gets an opening in the floor so you can see the flight below coming up through it.
  // a wing that doesn't touch the rest of the floor (Hill) is its own plate with its own openings.
  const plates = useMemo(() => {
    const holes = floor.shapes.filter((s) => s.kind === "stair" && s.dir === "down").map((s) => inset(s.poly, 2));
    const all = [floor.plate, ...(floor.extra ?? [])];
    const owner = (h: Pt[]) => Math.max(0, all.findIndex((p) => pointIn(p, h[0])));
    return all.map((poly, i) => extrude(poly, 0.4, holes.filter((h) => owner(h) === i)));
  }, [floor]);
  const P = usePalette();
  const stairs = useMemo(() => fit.stairs.map((p) => ({ m: pieceMatrix(p), color: P.stair })), [fit, P]);
  const wells = useMemo(() => fit.wells.map((p) => ({ m: pieceMatrix(p), color: P.stair })), [fit, P]);
  // an elevator that stops on the floor above rises to it as a glass shaft, like the stairs
  const shafts = useMemo(() => {
    const above = m.floors[m.order[m.order.indexOf(n) + 1]];
    return floor.shapes.filter((s) => s.kind === "lift" && above?.shapes.some((a) => a.kind === "lift" && pointIn(a.poly, centre(s.poly)))).map((s) => inset(s.poly, 3));
  }, [m, n, floor]);

  const open = active === n;
  const away = active !== null && n > active;
  const under = active !== null && n < active;
  const opened = open && selectedRef ? fit.detail[selectedRef] : undefined;
  const targetY = m.y(n, active === null ? SPREAD : 1) + (away ? LIFT : under ? -DROP : 0);
  // in the whole-building view, untraced floors are glass so you can see through them
  const ghost = active === null && !floor.traced;
  // only show the two floors right below. with Hill's tower, six wide floors would just be clutter
  const near2 = active !== null && m.order.indexOf(active) - m.order.indexOf(n) <= 2;
  const targetOpacity = away ? 0 : under ? (near2 ? 0.05 : 0) : ghost ? 0.14 : 1;
  // on the intro each floor starts hidden below its spot. otherwise start assembled so opening a level on page load still animates
  const [born] = useState(() => (arriving() ? performance.now() + 200 + m.order.indexOf(n) * Math.min(120, 700 / m.order.length) : 0));
  const now = useRef({ y: m.y(n, SPREAD) - (born ? 4 : 0), opacity: born ? 0 : 1, flat: 1, stair: born ? 0.01 : STAIR_FULL * SPREAD, glass: 1 });
  // in the whole-building view the floors are glass so you can see every level's rooms and the stairs
  const glassy = active === null;
  const targetGlass = glassy ? GLASS : 1;
  const flights = useRef<THREE.Group>(null);
  const targetStair = active === null ? STAIR_FULL * SPREAD : STAIR_OPEN; // still reaching the spread-out floor above
  const blocks = useRef<THREE.Group>(null!);
  const targetFlat = opened ? FLAT : 1;
  // new materials (theme switch) start fully opaque, so reapply the floor's fade
  const refade = useRef(false);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    refade.current = true;
    invalidate();
  }, [mats, invalidate]);

  const crowds = useMemo(() => crowdsFor(n, floor, fit, occupancy?.zones.filter((z) => z.level === n) ?? []), [n, floor, fit, occupancy]);
  // dots turn into people once you're close enough, or right away when a space is opened
  const [near, setNear] = useState(false);
  const close = open && (selectedRef !== null || near);

  useFrame((state, dt) => {
    const s = now.current;
    if (open && near !== state.camera.zoom > PEOPLE_ZOOM) setNear(!near);
    if (born && performance.now() < born) {
      if (group.current) group.current.visible = false;
      state.invalidate();
      return;
    }
    if (s.flat !== targetFlat) {
      s.flat += (targetFlat - s.flat) * ease(dt, 0.1);
      if (Math.abs(targetFlat - s.flat) < 0.002) s.flat = targetFlat;
      else state.invalidate();
      blocks.current.scale.y = s.flat;
    }
    if (s.stair !== targetStair) {
      s.stair += (targetStair - s.stair) * ease(dt, 0.11);
      if (Math.abs(targetStair - s.stair) < 0.005) s.stair = targetStair;
      else state.invalidate();
      if (flights.current) flights.current.scale.y = s.stair;
    }
    if (s.y === targetY && s.opacity === targetOpacity && s.glass === targetGlass && !refade.current) return;
    refade.current = false;
    const k = reduceMotion() ? 1 : ease(dt, 0.11);
    s.y += (targetY - s.y) * k;
    s.opacity += (targetOpacity - s.opacity) * k;
    s.glass += (targetGlass - s.glass) * k;
    if (Math.abs(targetY - s.y) < 0.01 && Math.abs(targetOpacity - s.opacity) < 0.005 && Math.abs(targetGlass - s.glass) < 0.005) {
      s.y = targetY;
      s.opacity = targetOpacity;
      s.glass = targetGlass;
    } else state.invalidate();
    group.current.position.y = s.y;
    group.current.visible = s.opacity > 0.01; // floors above the open level move away completely
    const fade = (m: THREE.Material) => {
      const base = (m.userData.base as number | undefined) ?? 1;
      const seen = s.opacity * (m.userData.floor ? s.glass : 1);
      m.opacity = base * seen;
      m.depthWrite = seen > 0.5 && base > 0.5 && !m.userData.glass;
    };
    group.current.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (mat) [mat].flat().forEach(fade);
      o.userData.cast ??= o.castShadow;
      const glassFloor = s.glass < 0.5 && mat !== undefined && [mat].flat()[0].userData.floor;
      o.castShadow = o.userData.cast && s.opacity > 0.5 && !glassFloor; // faded/glass floors don't cast shadows
    });
  });

  // floors that moved out of the way let clicks go through to the ones below
  const click = (act: () => void) => (e: ThreeEvent<MouseEvent>) => {
    if (away || ghost || e.delta > 4) return;
    e.stopPropagation();
    act();
  };
  const point =
    (ref: string | null): Hover =>
    (e, over) => {
      if (away || ghost) return;
      e.stopPropagation();
      setHover(over ? ref : null);
      onTip?.(over ? ref : null);
      document.body.style.cursor = over ? "pointer" : "";
    };
  const openRef = (ref?: string) => {
    const space = ref ? m.byRef(ref) : undefined;
    if (!open) onSelectLevel(n);
    else if (space) onOpenSpace(space.id);
  };
  const look = (ref?: string) => {
    const linked = ref !== undefined && m.byRef(ref) !== undefined;
    return {
      picked: linked && ref === selectedRef,
      hot: (open && linked && hover === ref) || (ref !== undefined && matches.includes(ref)),
      onHover: open && linked ? point(ref) : undefined,
    };
  };

  return (
    <group ref={group} position-y={m.y(n)}>
      {plates.map((plate, i) => (
        <mesh
          key={i}
          geometry={plate}
          material={mats.plate}
          renderOrder={drawOrder(n, "plate")}
          position-y={-0.4}
          castShadow
          receiveShadow
          onClick={glassy ? undefined : click(() => (open ? selectedRef && onClear() : onSelectLevel(n)))}
          onPointerOver={open || glassy ? undefined : (e) => point(null)(e, true)}
          onPointerOut={open || glassy ? undefined : (e) => point(null)(e, false)}
        >
          <Edges threshold={20} color={P.edge} transparent renderOrder={drawOrder(n, "plate")} />
        </mesh>
      ))}

      {floor.shapes.map((s, i) => {
        const key = `${s.ref ?? s.kind}-${i}`; // Hill draws some spaces as several shapes
        const { picked, hot, onHover } = look(s.ref);
        switch (s.kind) {
          case "zone":
            return (
              <Slab
                key={key}
                poly={s.poly}
                height={0.03}
                color={picked ? P.pickWash : hot ? P.hover : s.ref ? P.zone : P.overlook}
                floor
                order={drawOrder(n, "floor")}
                onClick={glassy ? undefined : click(() => openRef(s.ref))}
                onHover={onHover}
              />
            );
          case "core":
            return <Slab key={key} poly={s.poly} height={0.7} material={mats.core} cast edges />;
          case "lift":
            return <Slab key={key} poly={s.poly} height={0.9} material={mats.core} cast edges />;
          case "counter":
            return <Slab key={key} poly={s.poly} height={0.28} material={mats.counter} cast onClick={click(() => openRef(s.ref))} onHover={onHover} />;
          case "stair":
            return s.ref && s.dir !== "down" ? (
              <Slab key={key} poly={s.poly} height={0.8} material={mats.hit} onClick={click(() => openRef(s.ref))} onHover={onHover} />
            ) : null;
          default:
            return null; // rooms are drawn from the fit below
        }
      })}

      {/* while a room is open the others flatten so nothing blocks the view */}
      <group ref={blocks}>
        {fit.rooms.map((r, i) => {
          const { picked, hot, onHover } = look(r.ref);
          const onClick = click(() => openRef(r.ref));
          // an open room is just its floor (walls/furniture come from <Inside>), every other room stays a block
          return picked && opened ? (
            <Slab key={`${r.ref}-${i}`} poly={r.poly} height={0.04} color={P.pickWash} order={drawOrder(n, "rooms")} onClick={onClick} onHover={onHover} />
          ) : (
            <Slab
              key={`${r.ref}-${i}`}
              poly={r.poly}
              height={ROOM_H}
              material={picked ? [mats.blockHover[0], mats.block[1]] : hot ? mats.blockHover : mats.block}
              order={drawOrder(n, "rooms")}
              cast
              edges
              onClick={onClick}
              onHover={onHover}
            />
          );
        })}
      </group>

      <group ref={flights} scale-y={STAIR_FULL * SPREAD}>
        <Blocks geometry={BOX} material={mats.piece} items={stairs} />
        {shafts.map((poly, i) => (
          <Slab key={i} poly={poly} height={1} material={mats.glass} />
        ))}
      </group>
      {/* stairs going down, seen from this floor. only on the open level, otherwise the floor below already shows them */}
      <group visible={open} scale-y={STAIR_OPEN}>
        <Blocks geometry={BOX} material={mats.piece} items={wells} />
      </group>
      {opened && <Inside key={selectedRef} detail={opened} mats={mats} />}

      {/* hatch each counted zone by how busy it is: every level in the whole-building view, the open level until a room is opened */}
      {(glassy || (open && !opened)) &&
        crowds.flatMap(({ zone, room, polys }) => {
          const busy = zone.busy;
          if (!busy) return [];
          return polys.map((poly, i) => (
            <group key={`${zone.id}-${i}`} position-y={room ? ROOM_H : 0.03}>
              <Slab poly={poly} height={0.02} material={glassy ? mats.heat[busy] : mats.wash[busy]} order={drawOrder(n, "heat")} />
            </group>
          ));
        })}
      {/* up close, people stand on the floor of open spaces and the opened room. further out the wash shows it instead */}
      {close &&
        crowds
          .filter((c) => !c.room || c.zone.refs.includes(selectedRef ?? ""))
          .map((c) => <People key={c.zone.id} crowd={c} base={c.room ? 0.04 : 0.03} mats={mats} />)}
    </group>
  );
}

type Label = {
  key: string;
  text: string;
  at: THREE.Vector3;
  style: "room" | "name" | "callout" | "match";
  dim: boolean;
  picked: boolean;
  /** A match pin raised above the stack: where its stem lands on its own floor, plus that floor's tag. */
  foot?: THREE.Vector3;
  tag?: string;
  /** A space's name, in its outline in the scene. Only shown once it fits, so small spaces get named as you zoom in. */
  within?: THREE.Vector3[];
  /** Restrooms, elevators etc. Named last so they give way to the actual study spaces. */
  core?: boolean;
};

// in the whole-building view match pins float above the top floor (Model.pinTop) on a stem down to their own floor,
// otherwise a pin could be mistaken for a room on whatever floor happens to be underneath it.

/** Labels for the open level, plus callouts for the open room. */
function labelsFor({ floors: FLOORS, fits: FITS, y: yOf, pinTop, lib }: Model, active: number | null, selectedRef: string | null, matches: string[]): Label[] {
  // Study Match pins: on every floor in the whole-building view, otherwise just on the open floor
  const pins: Label[] = matches.flatMap((ref, i) => {
    const n = Number(Object.keys(FLOORS).find((k) => FLOORS[Number(k)].shapes.some((s) => s.ref === ref)));
    const shape = FLOORS[n]?.shapes.find((s) => s.ref === ref);
    if (!shape || (active !== null && n !== active) || ref === selectedRef) return [];
    const [px, py] = shape.at ?? centre(shape.poly);
    const floorY = yOf(n, active === null ? SPREAD : 1) + (shape.kind === "room" ? ROOM_H : 0.3);
    const whole = active === null;
    return [
      {
        key: `match-${ref}`,
        text: String(i + 1),
        at: new THREE.Vector3(wx(px), whole ? pinTop : floorY + 0.35, wz(py)),
        style: "match" as const,
        dim: false,
        picked: i === 0,
        foot: whole ? new THREE.Vector3(wx(px), floorY, wz(py)) : undefined,
        tag: whole ? levelName(lib, n) : undefined,
      },
    ];
  });
  if (active === null) return pins;
  const y = yOf(active);
  const focus = selectedRef ? FLOORS[active].shapes.find((s) => s.ref === selectedRef) : undefined;
  const callouts = focus ? (FITS[active].detail[selectedRef!]?.callouts ?? []) : [];
  const out: Label[] = [...pins];
  for (const [i, s] of FLOORS[active].shapes.entries()) {
    const mine = focus !== undefined && s.ref === selectedRef;
    if (!s.label || mine) continue;
    const [px, py] = s.at ?? centre(s.poly);
    out.push({
      key: `${active}-${i}`,
      text: s.label,
      at: new THREE.Vector3(wx(px), y + (s.kind === "room" ? ROOM_H : 0.3) + 0.2, wz(py)),
      style: /^\d/.test(s.label) ? "room" : "name",
      dim: focus !== undefined && !mine,
      picked: mine,
      within: s.poly.map(([x, z]) => new THREE.Vector3(wx(x), y, wz(z))),
      core: s.kind === "core" || s.kind === "lift",
    });
  }
  callouts.forEach((c) =>
    out.push({
      key: `${selectedRef}-${c.text}`,
      text: c.text,
      at: new THREE.Vector3(wx(c.at[0]), y + c.height, wz(c.at[1])),
      style: "callout",
      dim: false,
      picked: false,
    }),
  );
  return out;
}

const scratch = new THREE.Vector3();

/** Whether a label box (px) fits inside a space's on-screen bounds, with a little overhang allowed. */
function fits(poly: THREE.Vector3[], box: { w: number; h: number }, camera: THREE.Camera, size: { width: number; height: number }) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of poly) {
    scratch.copy(p).project(camera);
    const x = scratch.x * size.width / 2;
    const y = scratch.y * size.height / 2;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return box.w <= (x1 - x0) * 1.15 && box.h <= (y1 - y0) * 1.3;
}
const RANK = { match: -1, name: 0, room: 1, callout: 2 };

// callout label: offset from its dot, plus its box (px) that other labels have to avoid
const PILL = { dx: 22, dy: -18, w: 200, h: 24 };

/** Keeps the HTML labels (one overlay outside the canvas) pinned to their spots in the scene. */
function LabelSync({ labels, els }: { labels: Label[]; els: RefObject<(HTMLElement | null)[]> }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [labels, invalidate]);
  useFrame(({ camera, size }) => {
    camera.updateMatrixWorld();
    const pills: { x: number; y: number }[] = []; // where each callout label ended up, so the next one can avoid it
    const taken: { x: number; y: number; w: number; h: number }[] = []; // labels already placed, later ones can't overlap them
    const pins: { l: number; r: number; t: number; b: number }[] = []; // match pins (with their tags) placed so far
    // names get placed before room numbers, so on a crowded floor the numbers are what get dropped
    const order = labels.map((_, i) => i).sort((a, b) => RANK[labels[a].style] - RANK[labels[b].style] || Number(!!labels[a].core) - Number(!!labels[b].core));
    order.forEach((i) => {
      const label = labels[i];
      const el = els.current[i];
      if (!el) return;
      scratch.copy(label.at).project(camera);
      const x = (scratch.x * 0.5 + 0.5) * size.width;
      const y = (-scratch.y * 0.5 + 0.5) * size.height;
      el.style.opacity = label.dim ? "0.35" : "1";
      if (label.style === "match") {
        // if a pin (or its tag to the right) would cover an earlier one, raise it above. its stem just gets longer
        const pin = el.querySelector("button");
        const half = (pin?.offsetHeight ?? 32) / 2 + 3;
        const right = (pin?.offsetWidth ?? 32) / 2 + (label.tag ? ((pin?.lastElementChild as HTMLElement | null)?.offsetWidth ?? 60) + 10 : 3);
        let py = y;
        for (let k = 0, hit; k <= pins.length && (hit = pins.find((q) => x - half < q.r && x + right > q.l && py - half < q.b && py + half > q.t)); k++) py = hit.t - half - 0.5;
        pins.push({ l: x - half, r: x + right, t: py - half, b: py + half });
        // the element sits at the pin's point, the stem and foot dot are placed relative to it
        el.style.transform = `translate(${x.toFixed(1)}px, ${py.toFixed(1)}px)`;
        taken.push({ x, y: py, w: 32, h: 32 });
        if (!label.foot) return;
        scratch.copy(label.foot).project(camera);
        const dx = (scratch.x * 0.5 + 0.5) * size.width - x;
        const dy = (-scratch.y * 0.5 + 0.5) * size.height - py;
        const [line, dot] = el.firstElementChild!.children as unknown as HTMLElement[];
        line.style.width = `${Math.hypot(dx, dy).toFixed(1)}px`;
        line.style.transform = `rotate(${Math.atan2(dy, dx).toFixed(3)}rad)`;
        dot.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
        return;
      }
      if (label.style !== "callout") {
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
        // room numbers scale with the model so small rooms stay readable on a big floor
        if (label.style === "room") (el.firstElementChild as HTMLElement).style.fontSize = `${Math.min(10, Math.max(6.5, camera.zoom * 0.9)).toFixed(1)}px`;
        const box = { x, y, w: el.offsetWidth, h: el.offsetHeight };
        if (label.within && !fits(label.within, box, camera, size)) el.style.opacity = "0";
        else if (taken.some((o) => Math.abs(o.x - x) < (o.w + box.w) / 2 && Math.abs(o.y - y) < (o.h + box.h) / 2)) el.style.opacity = "0";
        else taken.push(box);
        return;
      }
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      // label goes up and to the right of its dot, then moves down until it's clear of the others
      const px = x + PILL.dx;
      let py = y + PILL.dy;
      // step slightly past the label we hit, exactly PILL.h can round down and hit the same label forever.
      // the loop limit is just a safety net, each step clears one earlier label so it never needs more
      for (let k = 0, hit; k <= pills.length && (hit = pills.find((q) => Math.abs(q.x - px) < PILL.w && Math.abs(q.y - py) < PILL.h)); k++) py = hit.y + PILL.h + 0.5;
      pills.push({ x: px, y: py });
      const [, line, pill] = el.children as unknown as HTMLElement[];
      const dy = py - y;
      line.style.width = `${Math.hypot(PILL.dx, dy).toFixed(1)}px`;
      line.style.transform = `rotate(${Math.atan2(dy, PILL.dx).toFixed(3)}rad)`;
      pill.style.transform = `translate(${PILL.dx}px, ${dy.toFixed(1)}px) translateY(-50%)`;
    });
  });
  return null;
}

const SUN = new THREE.Vector3(26, 80, 34);

/** Sunlight that follows the camera. The shadow box is sized to what's on screen so shadows stay sharp up close. */
function Sun() {
  const light = useRef<THREE.DirectionalLight>(null!);
  useFrame((state) => {
    const l = light.current;
    const target = (state.controls as unknown as { target: THREE.Vector3 } | null)?.target;
    if (!target) return;
    l.position.copy(target).add(SUN);
    l.target.position.copy(target);
    l.target.updateMatrixWorld();
    const half = Math.min(70, (Math.max(state.size.width, state.size.height) / state.camera.zoom) * 0.7 + 2);
    const box = l.shadow.camera;
    if (box.right !== half) {
      box.left = box.bottom = -half;
      box.right = box.top = half;
      box.updateProjectionMatrix();
    }
  });
  return (
    <directionalLight
      ref={light}
      intensity={1.3}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.02}
      shadow-camera-near={1}
      shadow-camera-far={240}
    />
  );
}

/** Px of the panel edges covered by the heading, level rail and caption, measured from the page. */
type Cover = { left: number; top: number; bottom: number };
const GUTTER = 24; // padding between the model and anything covering it
const FILL = 0.62; // how much of the free area an opened space fills, the rest is floor you can click to close it
const LEVEL_FILL = 0.94; // an open level nearly fills it
const MAX_FOCUS_ZOOM = 95;
const MIN_ZOOM = 3;
const MAX_ZOOM = 170; // so the smallest rooms don't fill the panel

/**
 * Measures what floats over the model: elements in the same panel with
 * `data-cover="top|left|bottom"`. Re-measures when they or the panel resize,
 * e.g. the heading wrapping to two lines or the live count loading in.
 */
function useCover(root: RefObject<HTMLDivElement | null>): Cover {
  const [cover, setCover] = useState<Cover>({ left: 110, top: 190, bottom: 90 });
  useEffect(() => {
    const el = root.current;
    const panel = el?.parentElement;
    if (!el || !panel) return;
    const covers = () => [...panel.querySelectorAll<HTMLElement>("[data-cover]")];
    const measure = () => {
      const r = el.getBoundingClientRect();
      const next: Cover = { left: 0, top: 0, bottom: 0 };
      for (const c of covers()) {
        const b = c.getBoundingClientRect();
        if (!b.width || !b.height) continue;
        const side = c.dataset.cover as keyof Cover;
        const px = side === "top" ? b.bottom - r.top : side === "left" ? b.right - r.left : r.bottom - b.top;
        next[side] = Math.max(next[side], Math.round(px));
      }
      setCover((c) => (c.left === next.left && c.top === next.top && c.bottom === next.bottom ? c : next));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    covers().forEach((c) => ro.observe(c));
    measure();
    return () => ro.disconnect();
  }, [root]);
  return cover;
}

const footprint = (f: Floor) => [f.plate, ...(f.extra ?? [])].flat();

/** Frames the whole building, the open level, or the open room when the selection changes. */
function Rig({ m, active, focus, cover, pins }: { m: Model; active: number | null; focus: Shape | null; cover: Cover; pins: boolean }) {
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const invalidate = useThree((s) => s.invalidate);
  const moving = useRef(true);

  const goal = useMemo(() => {
    // every point that has to be on screen, at the height it'll end up at
    const at3 = (poly: Pt[], ys: number[]) => poly.flatMap(([x, z]) => ys.map((y) => new THREE.Vector3(wx(x), y, wz(z))));
    const pts =
      active === null
        ? m.order.flatMap((n) => at3(footprint(m.floors[n]), [m.y(n, SPREAD), m.y(n, SPREAD) + ROOM_H]))
        : at3(focus?.poly ?? footprint(m.floors[active]), [m.y(active), m.y(active) + WALL_H]);
    // Study Match pins float above the stack and have to fit on screen, but the building is what gets centered
    const pinPts = active === null && pins ? m.order.flatMap((n) => at3(footprint(m.floors[n]), [m.pinTop])) : [];
    const at = new THREE.Box3().setFromPoints(pts).getCenter(new THREE.Vector3());
    // measure it as it'll look on screen from the current angle, then fit it
    // into a share of the area the heading, rail and caption leave free
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    camera.updateMatrixWorld(); // not yet current on a page that opens straight onto a space
    camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());
    const extent = (axis: THREE.Vector3, of: THREE.Vector3[]) => {
      const ds = of.map((p) => axis.dot(p) - axis.dot(at));
      return { lo: Math.min(...ds), hi: Math.max(...ds) }; // relative to `at`, in scene units along the screen axis
    };
    const across = extent(right, [...pts, ...pinPts]);
    const tall = extent(up, pts);
    const tallAll = extent(up, [...pts, ...pinPts]);
    const edge = { left: cover.left + GUTTER, right: GUTTER, top: cover.top + GUTTER, bottom: cover.bottom + GUTTER };
    const free = { w: Math.max(120, size.width - edge.left - edge.right), h: Math.max(120, size.height - edge.top - edge.bottom) };
    const fit = Math.min(free.w / (across.hi - across.lo), free.h / (tallAll.hi - tallAll.lo));
    const zoom = focus ? Math.min(MAX_FOCUS_ZOOM, FILL * fit) : LEVEL_FILL * fit;
    // center the building's outline in the free area (not the whole panel), then nudge it down only as much as the pins need
    const halfH = free.h / 2 / zoom;
    const mid = (tall.lo + tall.hi) / 2;
    const up_ = Math.max(mid, tallAll.hi - halfH); // screen-up offset of the free area's middle from `at`
    at.addScaledVector(right, (across.lo + across.hi) / 2 - (edge.left - edge.right) / 2 / zoom).addScaledVector(up, up_ + (edge.top - edge.bottom) / 2 / zoom);
    return { at, zoom };
  }, [m, active, focus, size, camera, cover, pins]);

  useEffect(() => {
    moving.current = true;
    invalidate();
  }, [goal, invalidate]);

  // dragging or zooming manually turns off the auto framing
  useEffect(() => {
    const c = controls as unknown as THREE.EventDispatcher<{
      start: object;
    }> | null;
    if (!c) return;
    const stop = () => (moving.current = false);
    c.addEventListener("start", stop);
    invalidate(); // the controls arrive a tick after the first frame
    return () => c.removeEventListener("start", stop);
  }, [controls, invalidate]);

  useFrame((state, dt) => {
    const c = state.controls as unknown as {
      target: THREE.Vector3;
      update: () => void;
    } | null;
    if (!moving.current || !c) return;
    const k = reduceMotion() ? 1 : ease(dt, 0.16); // biggest animation on the page, so reduced motion just jumps there
    const step = goal.at.clone().sub(c.target).multiplyScalar(k);
    c.target.add(step);
    state.camera.position.add(step); // keep the viewing angle
    // zoom eases in log space so a 10x zoom feels as smooth as a 2x one
    state.camera.zoom = Math.exp(Math.log(state.camera.zoom) + (Math.log(goal.zoom) - Math.log(state.camera.zoom)) * k);
    state.camera.updateProjectionMatrix();
    c.update();
    if (c.target.distanceTo(goal.at) < 0.01 && Math.abs(goal.zoom / state.camera.zoom - 1) < 0.002) moving.current = false;
    else state.invalidate();
  });

  return null;
}

type Orbit = THREE.EventDispatcher<{ start: object }> & { target: THREE.Vector3; update: () => void };
const TURN = Math.PI / 8; // one ← or → press
const ZOOM_STEP = 1.25; // one + or − press
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** ← → rotate the model and + − zoom, eased like a drag or scroll. Either one turns off the auto framing. */
function KeyControls() {
  const controls = useThree((s) => s.controls) as unknown as Orbit | null;
  const invalidate = useThree((s) => s.invalidate);
  const left = useRef({ turn: 0, zoom: 1 }); // left to apply: radians, and a zoom factor
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!controls || !forPage(e)) return;
      const l = left.current;
      if (e.key === "ArrowLeft") l.turn += TURN;
      else if (e.key === "ArrowRight") l.turn -= TURN;
      else if (e.key === "+" || e.key === "=") l.zoom *= ZOOM_STEP;
      else if (e.key === "-" || e.key === "_") l.zoom /= ZOOM_STEP;
      else return;
      e.preventDefault();
      controls.dispatchEvent({ type: "start" });
      invalidate();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [controls, invalidate]);
  useFrame((state, dt) => {
    const l = left.current;
    if (!controls || (l.turn === 0 && l.zoom === 1)) return;
    const k = reduceMotion() ? 1 : ease(dt, 0.12);
    const turn = Math.abs(l.turn) < 1e-3 ? l.turn : l.turn * k;
    const zoom = Math.abs(Math.log(l.zoom)) < 1e-3 ? l.zoom : Math.exp(Math.log(l.zoom) * k);
    l.turn -= turn;
    l.zoom /= zoom;
    const cam = state.camera;
    cam.position.sub(controls.target).applyAxisAngle(Y_AXIS, turn).add(controls.target);
    cam.zoom = THREE.MathUtils.clamp(cam.zoom * zoom, MIN_ZOOM, MAX_ZOOM);
    cam.updateProjectionMatrix();
    controls.update();
    state.invalidate();
  });
  return null;
}

export default function BuildingScene(props: Common) {
  const { active, selectedRef } = props;
  const m = useModel();
  useDriftWarnings(m);
  const matchKey = (props.matches ?? []).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the joined refs so a new array with the same matches keeps the labels
  const labels = useMemo(() => labelsFor(m, active, selectedRef, props.matches ?? []), [m, active, selectedRef, matchKey]);
  const focus = useMemo(
    () => (active !== null && selectedRef ? (m.floors[active].shapes.find((s) => s.ref === selectedRef) ?? null) : null),
    [m, active, selectedRef],
  );
  const els = useRef<(HTMLElement | null)[]>([]);
  // hovered space's name, live count and seats, follows the pointer (moved directly, no re-render)
  const [tipRef, setTipRef] = useState<string | null>(null);
  const tipEl = useRef<HTMLDivElement>(null);
  const tipSpace = tipRef && tipRef !== selectedRef ? m.byRef(tipRef) : undefined;
  const tipZone = tipRef ? zoneFor(props.occupancy, tipRef) : null;
  const root = useRef<HTMLDivElement>(null);
  const cover = useCover(root);

  return (
    <div
      ref={root}
      className="absolute inset-0"
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        tipEl.current?.style.setProperty("translate", `${e.clientX - r.left + 14}px ${e.clientY - r.top + 16}px`);
      }}
      onPointerLeave={() => setTipRef(null)}
    >
      <Canvas
        shadows
        orthographic
        flat
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ position: [38, 110, 80], zoom: 6, near: 0.1, far: 600 }}
        onPointerMissed={() => (document.body.style.cursor = "")}
        aria-label={`3D model of ${m.lib.name} Library. Use the ${m.lib.floorWord.toLowerCase()} buttons and the list to explore without it.`}
      >
        <ambientLight intensity={2} />
        <Sun />
        <OrbitControls makeDefault enablePan={false} minPolarAngle={0.35} maxPolarAngle={1.3} minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM} target={m.home} />
        <KeyControls />
        <Rig m={m} active={active} focus={focus} cover={cover} pins={active === null && (props.matches ?? []).length > 0} />
        <LabelSync labels={labels} els={els} />
        {Object.entries(m.floors).map(([n, floor]) => (
          <FloorModel key={n} m={m} n={Number(n)} floor={floor} {...props} onTip={setTipRef} />
        ))}
      </Canvas>

      <div
        ref={tipEl}
        aria-hidden="true"
        className={`pointer-events-none absolute left-0 top-0 z-20 max-w-[220px] rounded-lg bg-ink/95 px-2.5 py-2 text-sheet shadow-lift transition-opacity duration-150 [@media(hover:none)]:hidden ${tipSpace ? "opacity-100" : "opacity-0"}`}
      >
        {tipSpace && (
          <>
            <p className="text-[13px] font-semibold leading-snug">{tipSpace.title}</p>
            <p className="mt-0.5 text-[11px] tabular-nums text-sheet/70">
              {[
                tipZone?.busy && `${BUSY_LABEL[tipZone.busy]} · ${tipZone.count} ${tipZone.count === 1 ? "person" : "people"}`,
                tipSpace.seats && `${tipSpace.seats} seats`,
                tipSpace.room && tipSpace.room !== tipSpace.title && `Room ${tipSpace.room}`,
              ]
                .filter(Boolean)
                .join(" · ") || "Click to open"}
            </p>
          </>
        )}
      </div>

      {/* fade so the heading, level rail and caption stay readable over a zoomed-in model */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-48 bg-gradient-to-b from-paper via-paper/80 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-28 bg-gradient-to-r from-paper via-paper/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-28 bg-gradient-to-t from-paper via-paper/80 to-transparent" />

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {labels.map((label, i) => (
          <span
            key={label.key}
            ref={(el) => {
              els.current[i] = el;
            }}
            className="absolute left-0 top-0 opacity-0 transition-opacity duration-300"
            style={label.style === "callout" ? { transitionDelay: `${200 + i * 50}ms` } : undefined}
          >
            {label.style === "callout" ? (
              <>
                <span className="absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-2 ring-sheet" />
                <span className="absolute left-0 top-0 h-px origin-left bg-ink" />
                <span className="annot absolute left-0 top-0 whitespace-nowrap rounded-[4px] bg-sheet px-1.5 py-[3px] text-[10px] leading-none text-ink shadow-lift">
                  {label.text}
                </span>
              </>
            ) : label.style === "match" ? (
              // all three matches in teal, ranked like the cards: #1 solid and bigger, #2 and #3 outlined.
              // above the whole building, a stem goes down to a dot on the pin's floor, with a tag naming the floor.
              <span className="arrive absolute left-0 top-0 [--d:900ms]">
                {label.foot && (
                  <>
                    <span className="absolute left-0 top-0 h-[1.5px] origin-left bg-accent-deep" />
                    <span className="absolute left-0 top-0 size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-deep ring-2 ring-sheet" />
                  </>
                )}
                {/* clicking a pin opens its space. mouse only, the overlay is hidden from screen readers and the result cards handle keyboard */}
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => {
                    const space = m.byRef(label.key.slice("match-".length));
                    if (space) props.onOpenSpace(space.id);
                  }}
                  className={`plaque pointer-events-auto absolute left-0 top-0 grid -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full font-semibold leading-none shadow-lift transition-[scale] duration-150 ease-out-quint hover:scale-[1.15] active:scale-95 ${
                    label.picked ? "size-8 bg-accent text-[17px] text-on-accent ring-2 ring-sheet" : "size-6 bg-sheet text-[14px] text-ink ring-2 ring-accent-deep"
                  } ${props.highlight && label.key === `match-${props.highlight}` ? "scale-[1.2]" : ""}`}
                >
                  {label.text}
                  {label.tag && (
                    <span className="annot absolute left-full top-1/2 ml-1.5 -translate-y-1/2 whitespace-nowrap rounded-[4px] bg-sheet px-1.5 py-[3px] text-[10px] leading-none text-ink shadow-lift">
                      {label.tag}
                    </span>
                  )}
                </button>
              </span>
            ) : (
              <span
                className={`block rounded-[3px] px-1 ${
                  label.style === "name"
                    ? // sentence case with a halo, readable over the grey blocks and the busyness wash
                      `map-label w-max max-w-[16ch] text-center text-[11px] font-medium leading-[1.2] tracking-[-0.005em] ${label.core ? "text-pencil" : "text-ink"}`
                    : `plaque whitespace-nowrap text-[10px] font-medium leading-[1.5] ${label.picked ? "bg-accent font-semibold text-on-accent" : "map-label text-graphite"}`
                }`}
              >
                {label.text}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
