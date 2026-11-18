"use client";

import { useState } from "react";
import type { LevelInfo } from "@/data/libraries";
import { useLibrary } from "./LibraryContext";
import { LevelButton } from "./LevelRail";
import type { Busy } from "@/lib/occupancy";

// Live busyness on each slab's top, as on the 3D model: the ramp colour plus hatching.
const HEAT_FILL: Record<Busy, string> = { quiet: "var(--color-quiet)", busy: "var(--color-busy)", packed: "var(--color-packed)" };
const PITCH: Record<Busy, number> = { quiet: 7, busy: 4, packed: 4.5 };
const THICK = 9;
// Hunt's five levels sit 40 apart. A taller building gets more room per floor, so the
// floor buttons (40px on phones) never overlap: the stack grows taller instead.
const gapFor = (count: number) => (count > 6 ? 64 : 40);
const viewBox = (count: number) => {
  const top = (count - 1) * gapFor(count) + THICK + 12;
  return { x: -290, y: -top, w: 517, h: top + 185 };
};

const iso = (x: number, y: number, z: number) =>
  `${((x - y) * 0.866).toFixed(1)},${((x + y) * 0.5 - z).toFixed(1)}`;

/** `i` counts floors from the bottom. */
function slab({ footprint: [l, d] }: LevelInfo, i: number, gap: number) {
  const z = i * gap;
  const t = z + THICK;
  return {
    top: [iso(0, 0, t), iso(l, 0, t), iso(l, d, t), iso(0, d, t)].join(" "),
    side: [iso(0, d, z), iso(l, d, z), iso(l, d, t), iso(0, d, t)].join(" "),
    end: [iso(l, 0, z), iso(l, d, z), iso(l, d, t), iso(l, 0, t)].join(" "),
    // Where the leader line meets the slab, in viewBox units.
    anchorY: d / 2 - z - THICK / 2,
  };
}

type Props = {
  active: number | null;
  counts: Record<number, number>;
  busy: Record<number, Busy | null>;
  onSelect: (level: number | null) => void;
};

export default function LevelStack({ active, counts, busy, onSelect }: Props) {
  const { levels, floorWord } = useLibrary();
  const [hover, setHover] = useState<number | null>(null);
  const VB = viewBox(levels.length);
  const gap = gapFor(levels.length);
  // Bottom floor first, so upper slabs are drawn over lower ones.
  const slabs = [...levels].reverse().map((l, i) => ({ l, i, s: slab(l, i, gap) }));
  const toggle = (n: number) => onSelect(active === n ? null : n);

  return (
    <div
      className="relative mx-auto w-full max-w-[720px]"
      style={{ aspectRatio: `${VB.w} / ${VB.h}` }}
    >
      <svg
        viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {/* The same hatching as the busy swatches: denser lines, more people. */}
        <defs>
          {(Object.entries(PITCH) as [Busy, number][]).map(([b, p]) => (
            <pattern key={b} id={`stack-hatch-${b}`} width={p} height={p} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1={0} y1={0} x2={0} y2={p} stroke="rgb(23 23 23 / 0.3)" strokeWidth={1} />
              {b === "packed" && <line x1={0} y1={0} x2={p} y2={0} stroke="rgb(23 23 23 / 0.3)" strokeWidth={1} />}
            </pattern>
          ))}
        </defs>
        <polygon
          points={[iso(8, 8, -16), iso(238, 8, -16), iso(238, 108, -16), iso(8, 108, -16)].join(" ")}
          fill="var(--color-rule-soft)"
          style={{ filter: "blur(7px)" }}
        />
        {slabs.map(({ l: { n }, i, s }) => {
          const on = active === n;
          const dim = active !== null && !on;
          const lift = on ? -6 : hover === n ? -3 : 0;
          const heat = busy[n];
          // On arrival the slabs are drafted bottom to top: outline first, then the fill.
          const draft = { ["--d" as string]: `${120 + i * Math.min(110, 600 / levels.length)}ms` };
          return (
            <g key={n}>
              <line
                x1={-116}
                x2={-92}
                y1={s.anchorY}
                y2={s.anchorY}
                stroke="var(--color-rule-strong)"
                strokeWidth={0.75}
                opacity={dim ? 0.4 : 1}
              />
              <g
                onClick={() => toggle(n)}
                onPointerEnter={() => setHover(n)}
                onPointerLeave={() => setHover(null)}
                className="cursor-pointer transition-[transform,opacity] duration-200 ease-out-quint"
                style={{ transform: `translateY(${lift}px)`, opacity: dim ? 0.5 : 1 }}
                stroke="var(--color-rule-strong)"
                strokeWidth={0.75}
                strokeLinejoin="round"
              >
                <polygon points={s.side} pathLength={1} style={draft} fill={on ? "var(--color-accent-deep)" : "var(--color-slab-side)"} className="draw transition-[fill] duration-200" />
                <polygon points={s.end} pathLength={1} style={draft} fill={on ? "#0b7365" : "var(--color-slab-end)"} className="draw transition-[fill] duration-200" />
                <polygon points={s.top} pathLength={1} style={draft} fill={on ? "var(--color-accent)" : heat ? HEAT_FILL[heat] : "var(--color-slab)"} className="draw transition-[fill] duration-200" />
                {heat && !on && <polygon points={s.top} style={draft} fill={`url(#stack-hatch-${heat})`} stroke="none" pointerEvents="none" className="fill-in" />}
              </g>
            </g>
          );
        })}
      </svg>

      <ul className="absolute inset-y-0 left-0 w-[31%]">
        {[...slabs].reverse().map(({ l: { n, label, landmark }, s }) => {
          const count = counts[n] ?? 0;
          return (
            <li
              key={n}
              className="absolute left-0 right-0 -translate-y-1/2"
              style={{ top: `${((s.anchorY - VB.y) / VB.h) * 100}%` }}
            >
              <LevelButton
                n={n}
                label={label}
                word={floorWord}
                landmark={landmark}
                count={count}
                on={active === n}
                dim={(active !== null && active !== n) || count === 0}
                onClick={() => toggle(n)}
                onHover={setHover}
                busy={busy[n]}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
