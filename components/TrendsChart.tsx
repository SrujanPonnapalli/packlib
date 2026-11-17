"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { History } from "@/lib/history";

// warm greys from the paper palette, darkest at the bottom
const LEVEL_FILL: Record<number, string> = { 2: "#8f897d", 3: "#aaa498", 4: "#c4beb2", 5: "#dcd7cc" };
const BANDS = [
  { from: 0, to: 0.25, color: "var(--color-quiet)", label: "Not busy" },
  { from: 0.25, to: 0.45, color: "var(--color-busy)", label: "Busy" },
  { from: 0.45, to: 1, color: "var(--color-packed)", label: "Very busy" },
];
const GAP_MS = 20 * 60_000; // gap longer than this between readings breaks the line
const PAD = { top: 12, right: 12, bottom: 28, left: 40 };
const HEIGHT = 300;

const tz = { timeZone: "America/New_York" } as const;
const dayFmt = new Intl.DateTimeFormat("en-US", { ...tz, weekday: "short", day: "numeric" });
const hourFmt = new Intl.DateTimeFormat("en-US", { ...tz, hour: "numeric" });
const fullFmt = new Intl.DateTimeFormat("en-US", { ...tz, weekday: "short", hour: "numeric", minute: "2-digit" });

function niceMax(v: number) {
  const step = 10 ** Math.floor(Math.log10(Math.max(v, 1)));
  return [1, 2, 2.5, 5, 10].map((m) => m * step).find((m) => m >= v)! ;
}

/** SVG path through the points, breaking at gaps and missing readings. */
function line(xs: number[], ys: (number | null)[], t: number[]) {
  let d = "";
  let pen = false;
  ys.forEach((y, i) => {
    if (y === null || (i > 0 && t[i] - t[i - 1] > GAP_MS)) pen = false;
    if (y === null) return;
    d += `${pen ? "L" : "M"}${xs[i].toFixed(1)},${y.toFixed(1)}`;
    pen = true;
  });
  return d;
}

/** Filled areas between two stacked lines, one per unbroken run. */
function band(xs: number[], lo: number[], hi: (number | null)[], t: number[]) {
  const runs: number[][] = [];
  hi.forEach((v, i) => {
    if (v === null) return;
    const run = runs.at(-1);
    if (run && run.at(-1) === i - 1 && t[i] - t[i - 1] <= GAP_MS) run.push(i);
    else runs.push([i]);
  });
  return runs
    .map((run) => {
      const top = run.map((i) => `${xs[i].toFixed(1)},${(hi[i] as number).toFixed(1)}`);
      const bottom = [...run].reverse().map((i) => `${xs[i].toFixed(1)},${lo[i].toFixed(1)}`);
      return `M${top.join("L")}L${bottom.join("L")}Z`;
    })
    .join("");
}

export default function TrendsChart({ h, now }: { h: History; now: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [mode, setMode] = useState<"count" | "percent">("count");
  const [at, setAt] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = h.t.length;
  const t0 = Math.max(h.t[0] ?? now, now - 7 * 86_400_000);
  const t1 = Math.max(h.t[n - 1] ?? now, now, t0 + 3_600_000); // right edge is now, so a stalled collector shows up as a gap
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0)) * innerW;
  const xs = h.t.map(x);

  const counts = h.total.filter((c): c is number => c !== null);
  const yMax = mode === "count" ? niceMax(Math.max(10, ...counts) * 1.08) : 1;
  const y = (v: number) => PAD.top + innerH - (v / yMax) * innerH;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);

  // stack levels 2 to 5, if one level is missing a reading its layer is left out at that time
  const levels = Object.keys(h.levels).map(Number).sort();
  const layers = levels.reduce<{ lv: number; d: string; base: number[] }[]>((acc, lv) => {
    const vals = h.levels[lv];
    const below = acc.at(-1)?.base ?? h.t.map(() => 0);
    const top = below.map((b, i) => (vals[i] === null ? null : b + vals[i]!));
    const d = band(xs, below.map(y), top.map((v) => (v === null ? null : y(v))), h.t);
    return [...acc, { lv, d, base: below.map((b, i) => b + (vals[i] ?? 0)) }];
  }, []);

  // ticks: midnights when showing several days, otherwise every few hours
  const span = t1 - t0;
  const xTicks: { t: number; label: string }[] = [];
  const stepH = span > 36 * 3_600_000 ? 24 : span > 12 * 3_600_000 ? 6 : span > 4 * 3_600_000 ? 2 : 1;
  for (let t = Math.ceil(t0 / 3_600_000) * 3_600_000; t <= t1; t += 3_600_000) {
    const hour = Number(new Intl.DateTimeFormat("en-US", { ...tz, hour: "numeric", hourCycle: "h23" }).format(t));
    if (hour % stepH === 0) xTicks.push({ t, label: stepH === 24 ? dayFmt.format(t) : hourFmt.format(t) });
  }

  const shown = at ?? n - 1;
  const pick = (e: PointerEvent<SVGSVGElement>) => {
    if (!n) return;
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    let best = 0;
    xs.forEach((v, i) => Math.abs(v - px) < Math.abs(xs[best] - px) && (best = i));
    setAt(best);
  };
  const key = (e: KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, PageUp: -12, PageDown: 12 };
    if (e.key in moves) setAt(Math.min(n - 1, Math.max(0, shown + moves[e.key])));
    else if (e.key === "Home") setAt(0);
    else if (e.key === "End") setAt(n - 1);
    else return;
    e.preventDefault();
  };

  const readout =
    shown >= 0 && n
      ? [
          fullFmt.format(h.t[shown]),
          h.total[shown] === null ? "no reading" : mode === "count" ? `${h.total[shown]} people` : `${Math.round((h.share[shown] ?? 0) * 100)}% full`,
          ...(mode === "count" ? levels.map((lv) => `L${lv} ${h.levels[lv][shown] ?? "–"}`) : []),
        ].join(" · ")
      : "No readings yet";

  return (
    <figure className="mt-8">
      <div className="flex flex-wrap items-center gap-3">
        <p className="plaque min-w-0 flex-1 text-[14px] text-graphite" aria-live="polite">
          {readout}
        </p>
        <div role="radiogroup" aria-label="Show" className="flex rounded-full p-0.5 shadow-[inset_0_0_0_1px_var(--color-rule)]">
          {(["count", "percent"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`relative h-7 rounded-full px-3 text-[12px] font-medium transition-colors duration-150 before:absolute before:-inset-x-1 before:-inset-y-2 before:content-[''] ${mode === m ? "bg-ink text-sheet" : "text-graphite hover:text-ink"}`}
            >
              {m === "count" ? "People" : "% full"}
            </button>
          ))}
        </div>
      </div>

      <div ref={box} className="mt-3 rounded-xl bg-sheet shadow-[inset_0_0_0_1px_var(--color-rule)]">
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`Headcount in Hunt Library over the last ${Math.max(1, Math.round(span / 86_400_000))} days. Use the arrow keys to step through readings.`}
            tabIndex={0}
            onPointerMove={pick}
            onPointerLeave={() => setAt(null)}
            onKeyDown={key}
            className="block touch-pan-y select-none rounded-xl"
          >
            {mode === "percent" &&
              BANDS.map((b) => (
                <g key={b.label}>
                  <rect x={PAD.left} width={innerW} y={y(b.to)} height={y(b.from) - y(b.to)} fill={b.color} opacity={0.14} />
                  <text x={PAD.left + innerW - 6} y={y(b.to) + 14} textAnchor="end" className="fill-pencil text-[11px]">
                    {b.label}
                  </text>
                </g>
              ))}
            {yTicks.map((v) => (
              <g key={v}>
                <line x1={PAD.left} x2={PAD.left + innerW} y1={y(v)} y2={y(v)} stroke="var(--color-rule)" />
                <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" className="plaque fill-pencil text-[11px]">
                  {mode === "count" ? v : `${Math.round(v * 100)}%`}
                </text>
              </g>
            ))}
            {xTicks.map((tk) => (
              <text key={tk.t} x={x(tk.t)} y={HEIGHT - 8} textAnchor="middle" className="fill-pencil text-[11px]">
                {tk.label}
              </text>
            ))}

            {mode === "count" ? (
              <>
                {layers.map((l) => (
                  <path key={l.lv} d={l.d} fill={LEVEL_FILL[l.lv]} />
                ))}
                <path d={line(xs, h.total.map((v) => (v === null ? null : y(v))), h.t)} fill="none" stroke="var(--color-ink)" strokeWidth={1.5} strokeLinejoin="round" />
              </>
            ) : (
              <path d={line(xs, h.share.map((v) => (v === null ? null : y(v))), h.t)} fill="none" stroke="var(--color-ink)" strokeWidth={1.5} strokeLinejoin="round" />
            )}

            {shown >= 0 && n > 0 && (
              <g pointerEvents="none">
                <line x1={xs[shown]} x2={xs[shown]} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--color-accent-deep)" strokeDasharray="2 3" />
                {(mode === "count" ? h.total[shown] : h.share[shown]) !== null && (
                  <circle cx={xs[shown]} cy={y((mode === "count" ? h.total[shown] : h.share[shown])!)} r={3.5} fill="var(--color-accent-deep)" stroke="var(--color-sheet)" strokeWidth={1.5} />
                )}
              </g>
            )}
          </svg>
        )}
        {width === 0 && <div style={{ height: HEIGHT }} />}
      </div>

      {mode === "count" && (
        <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-pencil">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-ink" aria-hidden="true" /> Whole building
          </span>
          {levels.map((lv) => (
            <span key={lv} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: LEVEL_FILL[lv] }} aria-hidden="true" /> Level {lv}
            </span>
          ))}
          <span>Level 1 has no sensor.</span>
        </figcaption>
      )}
    </figure>
  );
}
