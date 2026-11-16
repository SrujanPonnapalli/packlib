"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Edges, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { FLOORS, type Floor, type Pt, type Shape } from "@/data/hunt-geometry";
import { spaceByRef, spaces } from "@/data/hunt";

// map pixels -> scene units, centered on the building
const wx = (x: number) => (x - 1005) / 20;
const wz = (y: number) => (y - 451) / 20;

const RISE = 5; // floor-to-floor spacing, exaggerated so the stack is easier to read
const LIFT = 26; // how far the floors above an open level move away
const DROP = 9; // and how far the floors below it sink
const EDGE = "#8f897c";
const HOME: [number, number, number] = [0, 2 * RISE, 0];

const LOOK = {
  plate: { height: 0.4, color: "#ebe7de" },
  zone: { height: 0.08, color: "#f6f2e9" },
  room: { height: 1.5, color: "#d5cebf" },
  stair: { height: 0.6, color: "#c7c0b1" },
  core: { height: 2.1, color: "#bdb6a8" },
} as const;
const HOVER = "#e9dfc3";
const PICK = "#f2c230";

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

function centre(poly: Pt[]): [number, number] {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  return [wx((Math.min(...xs) + Math.max(...xs)) / 2), wz((Math.min(...ys) + Math.max(...ys)) / 2)];
}

/** Eases toward a target over time. `dt` is clamped since on-demand rendering reports idle time as one huge frame. */
const ease = (dt: number, seconds: number) => 1 - Math.exp(-Math.min(dt, 1 / 30) / seconds);

type Common = {
  active: number | null;
  selectedRef: string | null;
  onSelectLevel: (n: number) => void;
  onOpenSpace: (id: string) => void;
};

function Block({
  shape,
  color,
  y = 0,
  onClick,
  onHover,
}: {
  shape: Shape;
  color: string;
  y?: number;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  onHover?: (e: ThreeEvent<PointerEvent>, over: boolean) => void;
}) {
  const geo = useMemo(() => extrude(shape.poly, LOOK[shape.kind].height), [shape]);
  return (
    <mesh
      geometry={geo}
      position-y={y}
      onClick={onClick}
      onPointerOver={onHover && ((e) => onHover(e, true))}
      onPointerOut={onHover && ((e) => onHover(e, false))}
    >
      <meshLambertMaterial color={color} transparent />
      {shape.kind !== "zone" && <Edges threshold={20} color={EDGE} transparent />}
    </mesh>
  );
}

function FloorModel({ n, floor, active, selectedRef, onSelectLevel, onOpenSpace }: Common & { n: number; floor: Floor }) {
  const group = useRef<THREE.Group>(null!);
  const [hover, setHover] = useState<string | null>(null);
  const plate = useMemo(() => extrude(floor.plate, LOOK.plate.height), [floor]);

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
    group.current.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (!m) return;
      m.opacity = s.opacity;
      m.depthWrite = s.opacity > 0.5;
    });
  });

  // floors that moved out of the way let clicks go through to the ones below
  const click = (act: () => void) => (e: ThreeEvent<MouseEvent>) => {
    if (away || e.delta > 4) return;
    e.stopPropagation();
    act();
  };
  const point = (ref: string | null) => (e: ThreeEvent<PointerEvent>, over: boolean) => {
    if (away) return;
    e.stopPropagation();
    setHover(over ? ref : null);
    document.body.style.cursor = over ? "pointer" : "";
  };

  return (
    <group ref={group} position-y={(n - 1) * RISE}>
      <mesh
        geometry={plate}
        position-y={-LOOK.plate.height}
        onClick={click(() => !open && onSelectLevel(n))}
        onPointerOver={open ? undefined : (e) => point(null)(e, true)}
        onPointerOut={open ? undefined : (e) => point(null)(e, false)}
      >
        <meshLambertMaterial color={LOOK.plate.color} transparent />
        <Edges threshold={20} color={EDGE} transparent />
      </mesh>

      {floor.shapes.map((shape, i) => {
        const space = shape.ref ? spaceByRef(shape.ref) : undefined;
        const picked = shape.ref !== undefined && shape.ref === selectedRef;
        const hot = open && space !== undefined && hover === shape.ref;
        return (
          <group key={shape.ref ?? i}>
            <Block
              shape={shape}
              color={picked ? PICK : hot ? HOVER : LOOK[shape.kind].color}
              y={picked && shape.kind !== "zone" ? 0.35 : 0}
              onClick={click(() => (open && space ? onOpenSpace(space.id) : onSelectLevel(n)))}
              onHover={open && !space ? undefined : point(shape.ref ?? null)}
            />
          </group>
        );
      })}
    </group>
  );
}

type Label = { ref?: string; text: string; at: THREE.Vector3; name: boolean };

/** Labels for the open level and where each one sits in the scene. */
function labelsFor(active: number | null): Label[] {
  if (active === null) return [];
  return FLOORS[active].shapes.flatMap((s) => {
    if (!s.label) return [];
    const [x, z] = s.at ? [wx(s.at[0]), wz(s.at[1])] : centre(s.poly);
    return [{ ref: s.ref, text: s.label, at: new THREE.Vector3(x, (active - 1) * RISE + LOOK[s.kind].height + 0.4, z), name: !/^\d/.test(s.label) }];
  });
}

const scratch = new THREE.Vector3();

/** Keeps the HTML labels (one overlay outside the canvas) pinned to their rooms. */
function LabelSync({ labels, els }: { labels: Label[]; els: React.RefObject<(HTMLElement | null)[]> }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [labels, invalidate]);
  useFrame(({ camera, size }) => {
    camera.updateMatrixWorld();
    labels.forEach((label, i) => {
      const el = els.current[i];
      if (!el) return;
      scratch.copy(label.at).project(camera);
      const x = (scratch.x * 0.5 + 0.5) * size.width;
      const y = (-scratch.y * 0.5 + 0.5) * size.height;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
      el.style.opacity = "1";
    });
  });
  return null;
}

/** Frames the whole building or the open level when the selection changes. */
function Rig({ active }: { active: number | null }) {
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls);
  const invalidate = useThree((s) => s.invalidate);
  const moving = useRef(true);

  const goal = useMemo(() => {
    if (active === null) return { at: new THREE.Vector3(...HOME), zoom: Math.min((size.width - 110) / 104, size.height / 96) };
    const plate = FLOORS[active].plate;
    const xs = plate.map((p) => wx(p[0]));
    const zs = plate.map((p) => wz(p[1]));
    const w = Math.max(...xs) - Math.min(...xs);
    return {
      at: new THREE.Vector3((Math.min(...xs) + Math.max(...xs)) / 2, (active - 1) * RISE, (Math.min(...zs) + Math.max(...zs)) / 2),
      zoom: Math.min((size.width - 110) / (w * 1.08), size.height / 62), // margin so it doesn't run into the level rail
    };
  }, [active, size]);

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
    const k = ease(dt, 0.14);
    const step = goal.at.clone().sub(c.target).multiplyScalar(k);
    c.target.add(step);
    state.camera.position.add(step); // keep the viewing angle
    state.camera.zoom += (goal.zoom - state.camera.zoom) * k;
    state.camera.updateProjectionMatrix();
    c.update();
    if (c.target.distanceTo(goal.at) < 0.02 && Math.abs(goal.zoom - state.camera.zoom) < 0.01) moving.current = false;
    else state.invalidate();
  });

  return null;
}

export default function BuildingScene(props: Common) {
  const labels = useMemo(() => labelsFor(props.active), [props.active]);
  const els = useRef<(HTMLElement | null)[]>([]);

  return (
    <div className="absolute inset-0">
      <Canvas
        orthographic
        flat
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ position: [38, 110, 80], zoom: 6, near: 0.1, far: 600 }}
        onPointerMissed={() => (document.body.style.cursor = "")}
        aria-label="3D model of Hunt Library. Use the level buttons and the list to explore without it."
      >
        <ambientLight intensity={1.6} />
        <directionalLight position={[40, 90, 30]} intensity={1.6} />
        <OrbitControls makeDefault enablePan={false} minPolarAngle={0.35} maxPolarAngle={1.3} minZoom={3} maxZoom={40} target={HOME} />
        <Rig active={props.active} />
        <LabelSync labels={labels} els={els} />
        {Object.entries(FLOORS).map(([n, floor]) => (
          <FloorModel key={n} n={Number(n)} floor={floor} {...props} />
        ))}
      </Canvas>

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {labels.map((label, i) => {
          const picked = label.ref !== undefined && label.ref === props.selectedRef;
          return (
            <span
              key={`${props.active}-${label.text}`}
              ref={(el) => {
                els.current[i] = el;
              }}
              className={`plaque absolute left-0 top-0 whitespace-nowrap rounded-[3px] px-1 leading-[1.5] opacity-0 transition-opacity duration-200 ${
                label.name ? "annot text-[10px] text-graphite" : `text-[10px] font-semibold ${picked ? "bg-ink text-sheet" : "text-ink"}`
              }`}
            >
              {label.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
