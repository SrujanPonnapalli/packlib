"use client";

import { useState } from "react";
import { LEVELS } from "@/data/hunt";

// Schematic footprint per level as [length, depth]; not to scale.
const FOOTPRINT: Record<number, [number, number]> = {
  1: [230, 100],
  2: [250, 100],
  3: [250, 100],
  4: [250, 100],
  5: [150, 100],
};
const GAP = 40;
const THICK = 9;
const VB = { x: -290, y: -181, w: 517, h: 366 };

const iso = (x: number, y: number, z: number) =>
  `${((x - y) * 0.866).toFixed(1)},${((x + y) * 0.5 - z).toFixed(1)}`;

function slab(n: number) {
  const [l, d] = FOOTPRINT[n];
  const z = (n - 1) * GAP;
  const t = z + THICK;
  return {
    top: [iso(0, 0, t), iso(l, 0, t), iso(l, d, t), iso(0, d, t)].join(" "),
    side: [iso(0, d, z), iso(l, d, z), iso(l, d, t), iso(0, d, t)].join(" "),
    end: [iso(l, 0, z), iso(l, d, z), iso(l, d, t), iso(l, 0, t)].join(" "),
    // Where the leader line meets the slab, in viewBox units.
    anchorY: 50 - z - THICK / 2,
  };
}

type Props = {
  active: number | null;
  counts: Record<number, number>;
  onSelect: (level: number | null) => void;
};

export default function LevelStack({ active, counts, onSelect }: Props) {
  const [hover, setHover] = useState<number | null>(null);
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
        <polygon
          points={[iso(8, 8, -16), iso(238, 8, -16), iso(238, 108, -16), iso(8, 108, -16)].join(" ")}
          fill="rgb(29 28 26 / 0.07)"
          style={{ filter: "blur(7px)" }}
        />
        {[...LEVELS].reverse().map(({ n }) => {
          const s = slab(n);
          const on = active === n;
          const dim = active !== null && !on;
          const lift = on ? -6 : hover === n ? -3 : 0;
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
                <polygon points={s.side} fill={on ? "#d9ab1f" : "var(--color-slab-side)"} className="transition-[fill] duration-200" />
                <polygon points={s.end} fill={on ? "#c49917" : "var(--color-slab-end)"} className="transition-[fill] duration-200" />
                <polygon points={s.top} fill={on ? "var(--color-stair)" : "var(--color-slab)"} className="transition-[fill] duration-200" />
              </g>
            </g>
          );
        })}
      </svg>

      <ul className="absolute inset-y-0 left-0 w-[31%]">
        {LEVELS.map(({ n, name }) => {
          const on = active === n;
          const count = counts[n] ?? 0;
          const dim = (active !== null && !on) || count === 0;
          return (
            <li
              key={n}
              className="absolute left-0 right-0 -translate-y-1/2"
              style={{ top: `${((slab(n).anchorY - VB.y) / VB.h) * 100}%` }}
            >
              <button
                type="button"
                aria-pressed={on}
                aria-label={`Level ${n}, ${name}, ${count} ${count === 1 ? "space" : "spaces"}`}
                onClick={() => toggle(n)}
                onPointerEnter={() => setHover(n)}
                onPointerLeave={() => setHover(null)}
                className={`group flex w-full items-center gap-2.5 rounded-md py-1 text-left transition-opacity duration-200 ${dim ? "opacity-50" : ""}`}
              >
                <span
                  className={`plaque grid size-7 shrink-0 place-items-center rounded-md text-[18px] sm:size-9 sm:text-[22px] font-semibold leading-none transition-colors duration-200 ${
                    on ? "bg-stair text-ink" : "text-ink group-hover:bg-vellum"
                  }`}
                >
                  {n}
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span className="block whitespace-nowrap text-[13px] font-medium leading-tight">{name}</span>
                  <span className="block text-[12px] leading-tight tabular-nums text-pencil">
                    {count} {count === 1 ? "space" : "spaces"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
