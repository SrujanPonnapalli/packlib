"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Edges, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { FLOORS, type Floor, type Pt, type Shape } from "@/data/hunt-geometry";
import { fitoutFor, spaceByRef, spaces } from "@/data/hunt";
import { fitFloor, type Detail, type FloorFit, type Piece, type Wall } from "@/lib/furnish";

// Map pixels -> scene units, centred on the building envelope.
const U = 20;
const wx = (x: number) => (x - 1005) / U;
const wz = (y: number) => (y - 451) / U;

const RISE = 5; // floor-to-floor spacing, exaggerated so the stack reads
const LIFT = 26; // how far the floors above an open level move away
const DROP = 9; // and how far the floors below it sink
const HOME: [number, number, number] = [0, 2 * RISE, 0];
const ROOM_H = 0.5; // a closed room: one clean block
const WALL_H = 0.55; // an opened room: low, cut-away walls to see into
const STAIR_FULL = RISE - 0.4; // a stair reaches the underside of the floor above...
const STAIR_OPEN = 2.2; // ...and folds down to a low model while a level is open, so it does not tower over the rooms
const FLAT = 0.25; // closed rooms flatten to this share of their height while another room is open
const WALL_T = 2.5; // px

// Two levels of detail. From a distance the floor is a white foam massing
// model: rooms are plain blocks, nothing inside them. Opening a room lifts its
// roof: walls, glass and furniture grow up inside, outlined in teal.
const P = {
  plate: "#ece8df",
  plateSide: "#8a8478",
  zone: "#f3efe6",
  overlook: "#e6e2d8",
  block: "#fbfaf6",
  blockSide: "#e6e1d6",
  blockEdge: "#a39d90",
  hover: "#e2f4ef",
  pick: "#1ec7b1",
  pickDeep: "#0e8f7f",
  pickWash: "#d3eee7",
  wall: "#fbfaf6",
  glass: "#cfe5e0",
  core: "#cfc8ba",
  coreTop: "#dcd6ca",
  counter: "#e9e0cd",
  counterSide: "#c9bfa9",
  table: "#ddd0b7",
  chair: "#8e877c",
  soft: "#cdc4b2",
  screen: "#34322e",
  desk: "#e8dfcc",
  stair: "#d6cdb9",
  edge: "#9d978a",
};

const FITS: Record<string, FloorFit> = Object.fromEntries(Object.entries(FLOORS).map(([n, f]) => [n, fitFloor(f, fitoutFor)]));

// Geometry and data are both hand-kept, so say so when they drift apart.
if (process.env.NODE_ENV !== "production") {
  for (const [n, floor] of Object.entries(FLOORS)) {
    if (!floor.traced) continue;
    const refs = new Set(floor.shapes.map((s) => s.ref));
    for (const ref of refs) if (ref && !spaceByRef(ref)) console.warn(`Geometry: no space for "${ref}" on level ${n}`);
    for (const s of spaces)
      if (s.level === Number(n) && !refs.has(s.room ?? s.title)) console.warn(`Geometry: level ${n} has no shape for ${s.title}`);
  }
}

function extrude(poly: Pt[], height: number) {
  const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(wx(x), -wz(y))));
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

/** Time-based easing toward a target; `dt` is clamped because on-demand rendering reports idle time as one long frame. */
const ease = (dt: number, seconds: number) => 1 - Math.exp(-Math.min(dt, 1 / 30) / seconds);

// Every wall and piece of furniture is one of these two shapes, scaled.
const BOX = new THREE.BoxGeometry(1, 1, 1);
const DISC = new THREE.CylinderGeometry(0.5, 0.5, 1, 20);
const UP = new THREE.Vector3(0, 1, 0);

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

// Chairs are drawn round: softer, and less busy than a field of little boxes.
const isRound = (p: Piece) => p.round || p.tone === "chair";
const pieceMatrix = (p: Piece) => placed(wx(p.x), p.base + p.h / 2, wz(p.y), p.w / U, p.h, (isRound(p) ? p.w : p.d) / U, -p.rot);

type Item = { m: THREE.Matrix4; color?: string };

/** Many copies of one shape in a single draw call. Not clickable: the floor beneath takes the click. */
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
  }, [items]);
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

/** Materials remember their resting opacity so a floor can fade as a whole. */
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
  return useMemo(() => {
    const wall = lambert(P.wall);
    const rim = lambert(P.pickDeep);
    const glass = lambert(P.glass, 0.35, true);
    // BoxGeometry faces: +x, -x, +y (top), -y, +z, -z. ExtrudeGeometry: caps, sides.
    return {
      wall: [wall, wall, rim, wall, wall, wall],
      glass: [glass, glass, rim, glass, glass, glass],
      piece: lambert("#ffffff"), // tinted per instance
      plate: [lambert(P.plate), lambert(P.plateSide)],
      block: [lambert(P.block), lambert(P.blockSide)],
      blockHover: [lambert(P.hover), lambert(P.blockSide)],
      core: [lambert(P.coreTop), lambert(P.core)],
      counter: [lambert(P.counter), lambert(P.counterSide)],
      hit: lambert("#ffffff", 0), // invisible, but catches clicks
    };
  }, []);
}

type Hover = (e: ThreeEvent<PointerEvent>, over: boolean) => void;

function Slab({
  poly,
  height,
  color,
  material,
  cast,
  edges,
  onClick,
  onHover,
}: {
  poly: Pt[];
  height: number;
  color?: string;
  material?: THREE.Material | THREE.Material[];
  cast?: boolean;
  edges?: boolean;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  onHover?: Hover;
}) {
  const geo = useMemo(() => extrude(poly, height), [poly, height]);
  return (
    <mesh
      geometry={geo}
      material={material}
      castShadow={cast}
      receiveShadow
      onClick={onClick}
      onPointerOver={onHover && ((e) => onHover(e, true))}
      onPointerOut={onHover && ((e) => onHover(e, false))}
    >
      {!material && <meshLambertMaterial color={color} transparent />}
      {edges && <Edges threshold={15} color={P.blockEdge} transparent />}
    </mesh>
  );
}

/** The inside of an opened room or zone. It grows up out of the floor when it appears. */
function Inside({ detail, mats }: { detail: Detail; mats: ReturnType<typeof useMaterials> }) {
  const group = useRef<THREE.Group>(null!);
  const grow = useRef(0.001);
  const items = useMemo(
    () => ({
      walls: detail.walls.filter((w) => !w.glass).map((w) => ({ m: wallMatrix(w) })),
      glass: detail.walls.filter((w) => w.glass).map((w) => ({ m: wallMatrix(w) })),
      boxes: detail.pieces.filter((p) => !isRound(p)).map((p) => ({ m: pieceMatrix(p), color: P[p.tone] })),
      discs: detail.pieces.filter(isRound).map((p) => ({ m: pieceMatrix(p), color: P[p.tone] })),
    }),
    [detail],
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

type Common = {
  active: number | null;
  selectedRef: string | null;
  onSelectLevel: (n: number) => void;
  onOpenSpace: (id: string) => void;
  onClear: () => void;
};

function FloorModel({ n, floor, active, selectedRef, onSelectLevel, onOpenSpace, onClear }: Common & { n: number; floor: Floor }) {
  const group = useRef<THREE.Group>(null!);
  const [hover, setHover] = useState<string | null>(null);
  const mats = useMaterials();
  const fit = FITS[n];
  const plate = useMemo(() => extrude(floor.plate, 0.4), [floor]);
  const stairs = useMemo(() => fit.stairs.map((p) => ({ m: pieceMatrix(p), color: P.stair })), [fit]);

  const open = active === n;
  const away = active !== null && n > active;
  const under = active !== null && n < active;
  const opened = open && selectedRef ? fit.detail[selectedRef] : undefined;
  const targetY = (n - 1) * RISE + (away ? LIFT : under ? -DROP : 0);
  const targetOpacity = away ? 0 : under ? 0.05 : 1;
  // Start assembled, so a page that opens on a level animates open.
  const now = useRef({ y: (n - 1) * RISE, opacity: 1, flat: 1, stair: STAIR_FULL });
  const flights = useRef<THREE.Group>(null);
  const targetStair = active === null ? STAIR_FULL : STAIR_OPEN;
  const blocks = useRef<THREE.Group>(null!);
  const targetFlat = opened ? FLAT : 1;

  useFrame((state, dt) => {
    const s = now.current;
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
    if (s.y === targetY && s.opacity === targetOpacity) return;
    const k = ease(dt, 0.11);
    s.y += (targetY - s.y) * k;
    s.opacity += (targetOpacity - s.opacity) * k;
    if (Math.abs(targetY - s.y) < 0.01 && Math.abs(targetOpacity - s.opacity) < 0.005) {
      s.y = targetY;
      s.opacity = targetOpacity;
    } else state.invalidate();
    group.current.position.y = s.y;
    group.current.visible = s.opacity > 0.01; // floors above an open level leave entirely
    const fade = (m: THREE.Material) => {
      const base = (m.userData.base as number | undefined) ?? 1;
      m.opacity = base * s.opacity;
      m.depthWrite = s.opacity > 0.5 && base > 0.5 && !m.userData.glass;
    };
    group.current.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (mat) [mat].flat().forEach(fade);
      o.userData.cast ??= o.castShadow;
      o.castShadow = o.userData.cast && s.opacity > 0.5; // faded floors cast no shadow
    });
  });

  // Floors that have moved away let clicks fall through to what is below them.
  const click = (act: () => void) => (e: ThreeEvent<MouseEvent>) => {
    if (away || e.delta > 4) return;
    e.stopPropagation();
    act();
  };
  const point =
    (ref: string | null): Hover =>
    (e, over) => {
      if (away) return;
      e.stopPropagation();
      setHover(over ? ref : null);
      document.body.style.cursor = over ? "pointer" : "";
    };
  const openRef = (ref?: string) => {
    const space = ref ? spaceByRef(ref) : undefined;
    if (!open) onSelectLevel(n);
    else if (space) onOpenSpace(space.id);
  };
  const look = (ref?: string) => {
    const linked = ref !== undefined && spaceByRef(ref) !== undefined;
    return {
      picked: linked && ref === selectedRef,
      hot: open && linked && hover === ref,
      onHover: open && linked ? point(ref) : undefined,
    };
  };

  return (
    <group ref={group} position-y={(n - 1) * RISE}>
      <mesh
        geometry={plate}
        material={mats.plate}
        position-y={-0.4}
        castShadow
        receiveShadow
        onClick={click(() => (open ? selectedRef && onClear() : onSelectLevel(n)))}
        onPointerOver={open ? undefined : (e) => point(null)(e, true)}
        onPointerOut={open ? undefined : (e) => point(null)(e, false)}
      >
        <Edges threshold={20} color={P.edge} transparent />
      </mesh>

      {floor.shapes.map((s, i) => {
        const key = s.ref ?? `${s.kind}-${i}`;
        const { picked, hot, onHover } = look(s.ref);
        switch (s.kind) {
          case "zone":
            return (
              <Slab
                key={key}
                poly={s.poly}
                height={0.03}
                color={picked ? P.pickWash : hot ? P.hover : s.ref ? P.zone : P.overlook}
                onClick={click(() => openRef(s.ref))}
                onHover={onHover}
              />
            );
          case "core":
            return <Slab key={key} poly={s.poly} height={0.7} material={mats.core} cast edges />;
          case "counter":
            return <Slab key={key} poly={s.poly} height={0.28} material={mats.counter} cast />;
          case "stair":
            return s.ref ? (
              <Slab key={key} poly={s.poly} height={0.8} material={mats.hit} onClick={click(() => openRef(s.ref))} onHover={onHover} />
            ) : null;
          default:
            return null; // rooms are drawn from the fit below
        }
      })}

      {/* While a room is open the others flatten, so nothing stands between you and it. */}
      <group ref={blocks}>
        {fit.rooms.map((r, i) => {
          const { picked, hot, onHover } = look(r.ref);
          const onClick = click(() => openRef(r.ref));
          // An opened room is its floor (the walls and furniture come from <Inside>); every other room stays a closed block.
          return picked && opened ? (
            <Slab key={r.ref ?? i} poly={r.poly} height={0.04} color={P.pickWash} onClick={onClick} onHover={onHover} />
          ) : (
            <Slab
              key={r.ref ?? i}
              poly={r.poly}
              height={ROOM_H}
              material={picked ? [mats.blockHover[0], mats.block[1]] : hot ? mats.blockHover : mats.block}
              cast
              edges
              onClick={onClick}
              onHover={onHover}
            />
          );
        })}
      </group>

      <group ref={flights} scale-y={STAIR_FULL}>
        <Blocks geometry={BOX} material={mats.piece} items={stairs} />
      </group>
      {opened && <Inside key={selectedRef} detail={opened} mats={mats} />}
    </group>
  );
}

type Label = {
  key: string;
  text: string;
  at: THREE.Vector3;
  style: "room" | "name" | "callout";
  dim: boolean;
  picked: boolean;
};

/** Labels for the open level, plus callouts describing the open room. */
function labelsFor(active: number | null, selectedRef: string | null): Label[] {
  if (active === null) return [];
  const y = (active - 1) * RISE;
  const focus = selectedRef ? FLOORS[active].shapes.find((s) => s.ref === selectedRef) : undefined;
  const callouts = focus ? (FITS[active].detail[selectedRef!]?.callouts ?? []) : [];
  const out: Label[] = [];
  for (const s of FLOORS[active].shapes) {
    const mine = focus !== undefined && s.ref === selectedRef;
    if (!s.label || (mine && s.kind === "room")) continue;
    const [px, py] = s.at ?? centre(s.poly);
    out.push({
      key: s.label,
      text: s.label,
      at: new THREE.Vector3(wx(px), y + (s.kind === "room" ? ROOM_H : 0.3) + 0.2, wz(py)),
      style: /^\d/.test(s.label) ? "room" : "name",
      dim: focus !== undefined && !mine,
      picked: mine,
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

// A callout label: offset from its dot, and the box (px) that other callout labels must stay out of.
const PILL = { dx: 22, dy: -18, w: 200, h: 24 };

/** Pins the HTML labels (one plain overlay outside the canvas) to their places in the scene. */
function LabelSync({ labels, els }: { labels: Label[]; els: RefObject<(HTMLElement | null)[]> }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [labels, invalidate]);
  useFrame(({ camera, size }) => {
    camera.updateMatrixWorld();
    const pills: { x: number; y: number }[] = []; // where each callout's label has been put, to keep the next one clear
    labels.forEach((label, i) => {
      const el = els.current[i];
      if (!el) return;
      scratch.copy(label.at).project(camera);
      const x = (scratch.x * 0.5 + 0.5) * size.width;
      const y = (-scratch.y * 0.5 + 0.5) * size.height;
      el.style.opacity = label.dim ? "0.35" : "1";
      if (label.style !== "callout") {
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
        return;
      }
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      // The label sits up and to the right of its dot, then steps down until it is clear of the others.
      const px = x + PILL.dx;
      let py = y + PILL.dy;
      for (let hit; (hit = pills.find((q) => Math.abs(q.x - px) < PILL.w && Math.abs(q.y - py) < PILL.h)); ) py = hit.y + PILL.h;
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

/** Sunlight that follows the view, with its shadow box sized to what is on screen so shadows stay crisp up close. */
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

const FRAME = { left: 110, top: 190, bottom: 90 }; // px covered by the level rail, heading and caption
const FILL = 0.62; // share of the free area an opened space fills; the rest is floor to click off onto
const MAX_FOCUS_ZOOM = 95; // so the smallest rooms don't fill the panel

/** Frames the whole building, the open level, or the open room, whenever the selection changes. */
function Rig({ active, focus }: { active: number | null; focus: Shape | null }) {
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const invalidate = useThree((s) => s.invalidate);
  const moving = useRef(true);

  const goal = useMemo(() => {
    if (active === null)
      return {
        at: new THREE.Vector3(...HOME),
        zoom: Math.min((size.width - 110) / 104, size.height / 96),
      };
    const poly = focus?.poly ?? FLOORS[active].plate;
    const xs = poly.map((p) => wx(p[0]));
    const zs = poly.map((p) => wz(p[1]));
    const y = (active - 1) * RISE;
    const at = new THREE.Vector3((Math.min(...xs) + Math.max(...xs)) / 2, y, (Math.min(...zs) + Math.max(...zs)) / 2);
    if (!focus) {
      const w = Math.max(...xs) - Math.min(...xs);
      return { at, zoom: Math.min((size.width - 110) / (w * 1.08), size.height / 62) }; // the margin keeps clear of the level rail
    }
    // Measure the space as it will appear on screen from the current viewing angle,
    // then let it fill a fixed share of the area not covered by the heading, rail and caption.
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    camera.updateMatrixWorld(); // not yet current on a page that opens straight onto a space
    camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());
    const span = (axis: THREE.Vector3) => {
      const ds = poly.flatMap((p) => [0, WALL_H].map((h) => axis.dot(scratch.set(wx(p[0]), y + h, wz(p[1])))));
      return Math.max(...ds) - Math.min(...ds);
    };
    const free = { w: size.width - FRAME.left, h: size.height - FRAME.top - FRAME.bottom };
    const zoom = Math.min(MAX_FOCUS_ZOOM, FILL * Math.min(free.w / span(right), free.h / span(up)));
    // Centre it in that free area, not in the whole panel.
    at.addScaledVector(right, -FRAME.left / 2 / zoom).addScaledVector(up, (FRAME.top - FRAME.bottom) / 2 / zoom);
    return { at, zoom };
  }, [active, focus, size, camera]);

  useEffect(() => {
    moving.current = true;
    invalidate();
  }, [goal, invalidate]);

  // Dragging or zooming by hand takes over from the automatic framing.
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
    const k = ease(dt, 0.16);
    const step = goal.at.clone().sub(c.target).multiplyScalar(k);
    c.target.add(step);
    state.camera.position.add(step); // keep the viewing angle
    // Zoom eases in log space, so a 10x zoom feels as even as a 2x one.
    state.camera.zoom = Math.exp(Math.log(state.camera.zoom) + (Math.log(goal.zoom) - Math.log(state.camera.zoom)) * k);
    state.camera.updateProjectionMatrix();
    c.update();
    if (c.target.distanceTo(goal.at) < 0.01 && Math.abs(goal.zoom / state.camera.zoom - 1) < 0.002) moving.current = false;
    else state.invalidate();
  });

  return null;
}

export default function BuildingScene(props: Common) {
  const { active, selectedRef } = props;
  const labels = useMemo(() => labelsFor(active, selectedRef), [active, selectedRef]);
  const focus = useMemo(
    () => (active !== null && selectedRef ? (FLOORS[active].shapes.find((s) => s.ref === selectedRef) ?? null) : null),
    [active, selectedRef],
  );
  const els = useRef<(HTMLElement | null)[]>([]);

  return (
    <div className="absolute inset-0">
      <Canvas
        shadows
        orthographic
        flat
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ position: [38, 110, 80], zoom: 6, near: 0.1, far: 600 }}
        onPointerMissed={() => (document.body.style.cursor = "")}
        aria-label="3D model of Hunt Library. Use the level buttons and the list to explore without it."
      >
        <ambientLight intensity={2} />
        <Sun />
        <OrbitControls makeDefault enablePan={false} minPolarAngle={0.35} maxPolarAngle={1.3} minZoom={3} maxZoom={170} target={HOME} />
        <Rig active={active} focus={focus} />
        <LabelSync labels={labels} els={els} />
        {Object.entries(FLOORS).map(([n, floor]) => (
          <FloorModel key={n} n={Number(n)} floor={floor} {...props} />
        ))}
      </Canvas>

      {/* Paper fades so the heading, level rail and caption stay legible over a zoomed-in model. */}
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
            ) : (
              <span
                className={`block whitespace-nowrap rounded-[3px] px-1 leading-[1.5] ${
                  label.style === "name"
                    ? "annot text-[9.5px] text-graphite"
                    : `plaque text-[10px] font-medium ${label.picked ? "bg-accent font-semibold text-ink" : "text-pencil"}`
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
