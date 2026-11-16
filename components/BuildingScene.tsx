"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Edges, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { FLOORS, type Floor, type Pt } from "@/data/hunt-geometry";
import { fitoutFor, spaceByRef, spaces } from "@/data/hunt";
import { fitFloor, type FloorFit, type Piece, type Wall } from "@/lib/furnish";

// map pixels -> scene units, centered on the building
const U = 20;
const wx = (x: number) => (x - 1005) / U;
const wz = (y: number) => (y - 451) / U;

const RISE = 5; // floor-to-floor spacing, exaggerated so the stack is easier to read
const LIFT = 26; // how far the floors above an open level move away
const DROP = 9; // and how far the floors below it sink
const HOME: [number, number, number] = [0, 2 * RISE, 0];
const WALL_H = 0.75; // low cut-away walls so you can see into rooms
const WALL_T = 3; // px

// Architecture model look: white walls with a black cut line like a floor plan,
// wood furniture, and Hunt's yellow only for the selected item.
const P = {
  plate: "#ebe7de",
  plateSide: "#7a756b",
  zone: "#f3eee3",
  overlook: "#efe9dc",
  room: "#e2dccf",
  hover: "#efe2bb",
  pick: "#f2c230",
  pickWash: "#f6e3a4",
  wall: "#faf8f3",
  cut: "#2f2d29",
  glass: "#d9e2e1",
  glassTop: "#7f8888",
  core: "#cdc6b7",
  coreTop: "#a39c8e",
  counter: "#e6dcc6",
  counterSide: "#b9ae97",
  table: "#d6c7aa",
  chair: "#77716a",
  soft: "#bcb3a2",
  screen: "#2b2a27",
  desk: "#e2d8c3",
  stair: "#dad2c1",
  edge: "#8f897c",
};

const FITS: Record<string, FloorFit> = Object.fromEntries(
  Object.entries(FLOORS).map(([n, f]) => [n, fitFloor(f, fitoutFor)]),
);

// geometry and space data are both kept by hand, so warn when they don't match
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
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
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

// every block on every floor is one of these two shapes, scaled
const BOX = new THREE.BoxGeometry(1, 1, 1);
const DISC = new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
const UP = new THREE.Vector3(0, 1, 0);

const placed = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rot: number) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(UP, rot), new THREE.Vector3(sx, sy, sz));

function wallMatrix(w: Wall) {
  const dx = w.b[0] - w.a[0];
  const dy = w.b[1] - w.a[1];
  return placed(wx((w.a[0] + w.b[0]) / 2), WALL_H / 2, wz((w.a[1] + w.b[1]) / 2), Math.hypot(dx, dy) / U, WALL_H, WALL_T / U, -Math.atan2(dy, dx));
}

const pieceMatrix = (p: Piece) =>
  placed(wx(p.x), p.base + p.h / 2, wz(p.y), p.w / U, p.h, (p.round ? p.w : p.d) / U, -p.rot);

type Item = { m: THREE.Matrix4; color?: string };

/** Instanced mesh: lots of copies of one shape in one draw call. Not clickable, the room floor under it gets the click. */
function Blocks({ geometry, material, items }: { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; items: Item[] }) {
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
    <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow receiveShadow frustumCulled={false} raycast={() => null} />
  );
}

/** Materials remember their normal opacity so a whole floor can fade together. */
function lambert(color: string, base = 1, glass = false) {
  const m = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: base });
  m.userData = { base, glass };
  return m;
}

function useMaterials() {
  return useMemo(() => {
    const wall = lambert(P.wall);
    const cut = lambert(P.cut);
    const glass = lambert(P.glass, 0.3, true);
    const glassTop = lambert(P.glassTop, 0.85);
    // BoxGeometry faces: +x, -x, +y (top), -y, +z, -z. ExtrudeGeometry: caps, sides.
    return {
      wall: [wall, wall, cut, wall, wall, wall],
      glass: [glass, glass, glassTop, glass, glass, glass],
      piece: lambert("#ffffff"), // tinted per instance
      plate: [lambert(P.plate), lambert(P.plateSide)],
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
  onClick,
  onHover,
}: {
  poly: Pt[];
  height: number;
  color?: string;
  material?: THREE.Material | THREE.Material[];
  cast?: boolean;
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
    </mesh>
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
  const items = useMemo(
    () => ({
      walls: fit.walls.filter((w) => !w.glass).map((w) => ({ m: wallMatrix(w) })),
      glass: fit.walls.filter((w) => w.glass).map((w) => ({ m: wallMatrix(w) })),
      boxes: fit.pieces.filter((p) => !p.round).map((p) => ({ m: pieceMatrix(p), color: P[p.tone] })),
      discs: fit.pieces.filter((p) => p.round).map((p) => ({ m: pieceMatrix(p), color: P[p.tone] })),
    }),
    [fit],
  );

  const open = active === n;
  const away = active !== null && n > active;
  const under = active !== null && n < active;
  const targetY = (n - 1) * RISE + (away ? LIFT : under ? -DROP : 0);
  const targetOpacity = away ? 0.06 : under ? 0.14 : 1;
  // start assembled so opening a level on page load still animates
  const now = useRef({ y: (n - 1) * RISE, opacity: 1 });

  useFrame((state, dt) => {
    const s = now.current;
    if (s.y === targetY && s.opacity === targetOpacity) return;
    const k = ease(dt, 0.11);
    s.y += (targetY - s.y) * k;
    s.opacity += (targetOpacity - s.opacity) * k;
    if (Math.abs(targetY - s.y) < 0.01 && Math.abs(targetOpacity - s.opacity) < 0.005) {
      s.y = targetY;
      s.opacity = targetOpacity;
    } else state.invalidate();
    group.current.position.y = s.y;
    const fade = (m: THREE.Material) => {
      const base = (m.userData.base as number | undefined) ?? 1;
      m.opacity = base * s.opacity;
      m.depthWrite = s.opacity > 0.5 && base > 0.5 && !m.userData.glass;
    };
    group.current.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (mat) [mat].flat().forEach(fade);
      o.userData.cast ??= o.castShadow;
      o.castShadow = o.userData.cast && s.opacity > 0.5; // faded floors don't cast shadows
    });
  });

  // floors that moved out of the way let clicks go through to the ones below
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
            return <Slab key={key} poly={s.poly} height={0.9} material={mats.core} cast />;
          case "counter":
            return <Slab key={key} poly={s.poly} height={0.32} material={mats.counter} cast />;
          case "stair":
            return s.ref ? (
              <Slab key={key} poly={s.poly} height={0.8} material={mats.hit} onClick={click(() => openRef(s.ref))} onHover={onHover} />
            ) : null;
          default:
            return null; // rooms are drawn from the fit below
        }
      })}

      {fit.rooms.map((r, i) => {
        const { picked, hot, onHover } = look(r.ref);
        return (
          <Slab
            key={r.ref ?? i}
            poly={r.poly}
            height={0.06}
            color={picked ? P.pick : hot ? P.hover : P.room}
            onClick={click(() => openRef(r.ref))}
            onHover={onHover}
          />
        );
      })}

      <Blocks geometry={BOX} material={mats.wall} items={items.walls} />
      <Blocks geometry={BOX} material={mats.glass} items={items.glass} />
      <Blocks geometry={BOX} material={mats.piece} items={items.boxes} />
      <Blocks geometry={DISC} material={mats.piece} items={items.discs} />
    </group>
  );
}

type Label = { key: string; text: string; at: THREE.Vector3; style: "room" | "name" | "callout"; dim: boolean; picked: boolean; flip?: boolean };

/** Labels for the open level, plus callouts for the open room. */
function labelsFor(active: number | null, selectedRef: string | null): Label[] {
  if (active === null) return [];
  const y = (active - 1) * RISE;
  const callouts = selectedRef ? (FITS[active].callouts[selectedRef] ?? []) : [];
  const focused = callouts.length > 0;
  const out: Label[] = [];
  for (const s of FLOORS[active].shapes) {
    if (!s.label || (focused && s.ref === selectedRef)) continue;
    const [px, py] = s.at ?? centre(s.poly);
    out.push({
      key: s.label,
      text: s.label,
      at: new THREE.Vector3(wx(px), y + (s.kind === "room" ? WALL_H : 0.35) + 0.25, wz(py)),
      style: /^\d/.test(s.label) ? "room" : "name",
      dim: focused,
      picked: s.ref !== undefined && s.ref === selectedRef,
    });
  }
  callouts.forEach((c, i) =>
    out.push({
      key: `${selectedRef}-${c.text}`,
      text: c.text,
      at: new THREE.Vector3(wx(c.at[0]), y + c.height, wz(c.at[1])),
      style: "callout",
      dim: false,
      picked: false,
      flip: i % 2 === 1,
    }),
  );
  return out;
}

const scratch = new THREE.Vector3();

/** Keeps the HTML labels (one overlay outside the canvas) pinned to their spots in the scene. */
function LabelSync({ labels, els }: { labels: Label[]; els: RefObject<(HTMLElement | null)[]> }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [labels, invalidate]);
  useFrame(({ camera, size }) => {
    camera.updateMatrixWorld();
    labels.forEach((label, i) => {
      const el = els.current[i];
      if (!el) return;
      scratch.copy(label.at).project(camera);
      const x = ((scratch.x * 0.5 + 0.5) * size.width).toFixed(1);
      const y = ((-scratch.y * 0.5 + 0.5) * size.height).toFixed(1);
      el.style.transform = label.style === "callout" ? `translate(${x}px, ${y}px)` : `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      el.style.opacity = label.dim ? "0.4" : "1";
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
      intensity={1.25}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.02}
      shadow-camera-near={1}
      shadow-camera-far={240}
    />
  );
}

/** Frames the whole building, the open level, or the open room when the selection changes. */
function Rig({ active, focus }: { active: number | null; focus: Pt[] | null }) {
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls);
  const invalidate = useThree((s) => s.invalidate);
  const moving = useRef(true);

  const goal = useMemo(() => {
    if (active === null) return { at: new THREE.Vector3(...HOME), zoom: Math.min((size.width - 110) / 104, size.height / 96) };
    const poly = focus ?? FLOORS[active].plate;
    const xs = poly.map((p) => wx(p[0]));
    const zs = poly.map((p) => wz(p[1]));
    const w = Math.max(...xs) - Math.min(...xs);
    const d = Math.max(...zs) - Math.min(...zs);
    return {
      at: new THREE.Vector3((Math.min(...xs) + Math.max(...xs)) / 2, (active - 1) * RISE, (Math.min(...zs) + Math.max(...zs)) / 2),
      zoom: focus
        ? Math.min(80, Math.min(size.width * 0.6, size.height * 0.6) / (Math.max(w, d) * 1.6 + 6)) // keep a bit of the neighbors in view
        : Math.min((size.width - 110) / (w * 1.08), size.height / 62), // margin so it doesn't run into the level rail
    };
  }, [active, focus, size]);

  useEffect(() => {
    moving.current = true;
    invalidate();
  }, [goal, invalidate]);

  // dragging or zooming manually turns off the auto framing
  useEffect(() => {
    const c = controls as unknown as THREE.EventDispatcher<{ start: object }> | null;
    if (!c) return;
    const stop = () => (moving.current = false);
    c.addEventListener("start", stop);
    invalidate(); // the controls arrive a tick after the first frame
    return () => c.removeEventListener("start", stop);
  }, [controls, invalidate]);

  useFrame((state, dt) => {
    const c = state.controls as unknown as { target: THREE.Vector3; update: () => void } | null;
    if (!moving.current || !c) return;
    const k = ease(dt, 0.16);
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

export default function BuildingScene(props: Common) {
  const { active, selectedRef } = props;
  const labels = useMemo(() => labelsFor(active, selectedRef), [active, selectedRef]);
  const focus = useMemo(
    () => (active !== null && selectedRef ? (FLOORS[active].shapes.find((s) => s.ref === selectedRef && s.kind !== "zone")?.poly ?? null) : null),
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
        <ambientLight intensity={2.05} />
        <Sun />
        <OrbitControls makeDefault enablePan={false} minPolarAngle={0.35} maxPolarAngle={1.3} minZoom={3} maxZoom={170} target={HOME} />
        <Rig active={active} focus={focus} />
        <LabelSync labels={labels} els={els} />
        {Object.entries(FLOORS).map(([n, floor]) => (
          <FloorModel key={n} n={Number(n)} floor={floor} {...props} />
        ))}
      </Canvas>

      {/* fade so the heading, level rail and caption stay readable over a zoomed-in model */}
      <div className="pointer-events-none absolute z-[1] inset-x-0 top-0 h-48 bg-gradient-to-b from-paper via-paper/80 to-transparent" />
      <div className="pointer-events-none absolute z-[1] inset-y-0 left-0 w-28 bg-gradient-to-r from-paper via-paper/70 to-transparent" />
      <div className="pointer-events-none absolute z-[1] inset-x-0 bottom-0 h-28 bg-gradient-to-t from-paper via-paper/80 to-transparent" />

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {labels.map((label, i) => (
          <span
            key={label.key}
            ref={(el) => {
              els.current[i] = el;
            }}
            className="absolute left-0 top-0 opacity-0 transition-opacity duration-300"
            style={label.style === "callout" ? { transitionDelay: `${120 + i * 40}ms` } : undefined}
          >
            {label.style === "callout" ? (
              <>
                <span className="absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-2 ring-sheet" />
                {/* every other callout leans down instead of up so neighbors don't collide */}
                <span className={`absolute left-0 top-0 h-px w-[22px] origin-left bg-ink ${label.flip ? "rotate-[38deg]" : "-rotate-[38deg]"}`} />
                <span
                  className={`annot absolute left-[16px] whitespace-nowrap rounded-[4px] bg-sheet px-1.5 py-[3px] text-[10px] leading-none text-ink shadow-lift ${
                    label.flip ? "top-[11px]" : "top-[-27px]"
                  }`}
                >
                  {label.text}
                </span>
              </>
            ) : (
              <span
                className={`plaque block whitespace-nowrap rounded-[3px] px-1 leading-[1.5] ${
                  label.style === "name"
                    ? "annot text-[10px] text-graphite"
                    : `text-[10px] font-semibold ${label.picked ? "bg-ink text-sheet" : "text-ink"}`
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
