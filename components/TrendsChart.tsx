"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { typical, type History } from "@/lib/history";
import { BUSY_LABEL, type Busy } from "@/lib/occupancy";
import { BusyDot } from "./Busy";

// levels use a blue ramp, darkest at the bottom. blue so it doesn't clash with the green/amber/red busyness colors
const LEVEL_FILL: Record<number, string> = { 2: "#2f5f91", 3: "#4f86bd", 4: "#86b2dc", 5: "#c2d9ef" };
// Hunt's building cut-offs as NC State draws them
const CUTS: [number, Busy][] = [[0.25, "quiet"], [0.45, "busy"], [1, "packed"]];
const busyAt = (share: number): Busy => CUTS.find(([to]) => share < to)?.[1] ?? "packed";
const GAP_MS = 20 * 60_000; // gap longer than this between readings breaks the line
const PAD = { top: 18, right: 14, bottom: 28, left: 42 };
const HEIGHT = 320;

const tz = { timeZone: "America/New_York" } as const;
const dayFmt = new Intl.DateTimeFormat("en-US", { ...tz, weekday: "short", day: "numeric" });
const hourFmt = new Intl.DateTimeFormat("en-US", { ...tz, hour: "numeric" });
const hour24 = new Intl.DateTimeFormat("en-US", { ...tz, hour: "numeric", hourCycle: "h23" });
const dayKey = new Intl.DateTimeFormat("en-CA", { ...tz, year: "numeric", month: "2-digit", day: "2-digit" });
const NIGHT = (hour: number) => hour >= 22 || hour < 7;
const fullFmt = new Intl.DateTimeFormat("en-US", { ...tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function niceMax(v: number) {
  const step = 10 ** Math.floor(Math.log10(Math.max(v, 1)));
  // steps that divide into round quarters so the axis fits the data
  return [1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10].map((m) => m * step).find((m) => m >= v)!;
}

/** Runs of consecutive readings, broken at gaps and missing values. */
function runs(hi: (number | null)[], t: number[]) {
  const out: number[][] = [];
  hi.forEach((v, i) => {
    if (v === null) return;
    const run = out.at(-1);
    if (run && run.at(-1) === i - 1 && t[i] - t[i - 1] <= GAP_MS) run.push(i);
    else out.push([i]);
  });
  return out;
}

const pt = (x: number, y: number) => `${x.toFixed(1)},${y.toFixed(1)}`;

/** SVG path through the points, breaking at gaps and missing readings. */
function line(xs: number[], ys: (number | null)[], t: number[]) {
  return runs(ys, t).map((run) => `M${run.map((i) => pt(xs[i], ys[i]!)).join("L")}`).join("");
}

/** Filled areas between two stacked lines, one per unbroken run. */
function band(xs: number[], lo: number[], hi: (number | null)[], t: number[]) {
  return runs(hi, t)
    .map((run) => `M${run.map((i) => pt(xs[i], hi[i]!)).join("L")}L${[...run].reverse().map((i) => pt(xs[i], lo[i])).join("L")}Z`)
    .join("");
}

export default function TrendsChart({ h, now }: { h: History; now: number }) {
  const uid = useId().replace(/:/g, "");
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [mode, setMode] = useState<"count" | "percent">("count");
  const [at, setAt] = useState<number | null>(null);
  const [last, setLast] = useState(0); // where the tooltip was, so it fades out in place
  const usual = useMemo(() => typical(h), [h]);
  const hasUsual = usual.some((v) => v !== null);

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

  // stack levels 2 to 5. if one level is missing a reading its layer is left out at that time
  const levels = Object.keys(h.levels).map(Number).sort();
  const layers = levels.reduce<{ lv: number; d: string; base: number[] }[]>((acc, lv) => {
    const vals = h.levels[lv];
    const below = acc.at(-1)?.base ?? h.t.map(() => 0);
    const top = below.map((b, i) => (vals[i] === null ? null : b + vals[i]!));
    const d = band(xs, below.map(y), top.map((v) => (v === null ? null : y(v))), h.t);
    return [...acc, { lv, d, base: below.map((b, i) => b + (vals[i] ?? 0)) }];
  }, []);
  const shareYs = h.share.map((v) => (v === null ? null : y(v)));

  // ticks: midnights when showing several days, otherwise every few hours
  const span = t1 - t0;
  const xTicks: { t: number; label: string }[] = [];
  const stepH = span > 36 * 3_600_000 ? 24 : span > 12 * 3_600_000 ? 6 : span > 4 * 3_600_000 ? 2 : 1;
  for (let t = Math.ceil(t0 / 3_600_000) * 3_600_000; t <= t1; t += 3_600_000) {
    if (Number(hour24.format(t)) % stepH === 0) xTicks.push({ t, label: stepH === 24 ? dayFmt.format(t) : hourFmt.format(t) });
  }

  // night (10 pm to 7 am) is shaded so each day stands out on its own
  const nights: [number, number][] = [];
  for (let t = Math.floor(t0 / 3_600_000) * 3_600_000; t < t1; t += 3_600_000) {
    if (!NIGHT(Number(hour24.format(t)))) continue;
    const run = nights.at(-1);
    if (run && run[1] === t) run[1] = t + 3_600_000;
    else nights.push([t, t + 3_600_000]);
  }

  // each day's peak, labeled if there's room
  const series = mode === "count" ? h.total : h.share;
  const peakOf = new Map<string, number>();
  series.forEach((v, i) => {
    if (v === null || h.t[i] < t0) return;
    const k = dayKey.format(h.t[i]);
    const p = peakOf.get(k);
    if (p === undefined || v > series[p]!) peakOf.set(k, i);
  });
  const peaks = innerW * (86_400_000 / span) >= 84 ? [...peakOf.values()] : [];

  const show = (i: number) => {
    setAt(i);
    setLast(i);
  };
  const pick = (e: PointerEvent<SVGSVGElement>) => {
    if (!n) return;
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    let best = 0;
    xs.forEach((v, i) => Math.abs(v - px) < Math.abs(xs[best] - px) && (best = i));
    show(best);
  };
  const key = (e: KeyboardEvent) => {
    const cur = at ?? n - 1;
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, PageUp: -12, PageDown: 12 };
    if (e.key in moves) show(Math.min(n - 1, Math.max(0, cur + moves[e.key])));
    else if (e.key === "Home") show(0);
    else if (e.key === "End") show(n - 1);
    else if (e.key === "Escape") setAt(null);
    else return;
    e.preventDefault();
  };

  const tip = n ? Math.min(last, n - 1) : -1;
  const tipValue = tip >= 0 ? (mode === "count" ? h.total[tip] : h.share[tip]) : null;
  const tipLeft = tip >= 0 ? xs[tip] : 0;
  const flip = tipLeft > PAD.left + innerW * 0.62;
  const nowX = x(now);

  return (
    <figure className="mt-10 animate-enter [animation-delay:180ms]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <figcaption className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-graphite">
          {mode === "count" ? (
            <>
              <span className="flex items-center gap-1.5">
                <span className="h-[2px] w-4 rounded-full bg-ink" aria-hidden="true" /> Whole building
              </span>
              {[...levels].reverse().map((lv) => (
                <span key={lv} className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[2px]" style={{ background: LEVEL_FILL[lv] }} aria-hidden="true" /> Level {lv}
                </span>
              ))}
              {hasUsual && (
                <span className="flex items-center gap-1.5">
                  <span className="w-4 border-t-[1.5px] border-dashed border-graphite" aria-hidden="true" /> Typical for the time
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[2px] bg-[rgb(29_28_26/0.07)]" aria-hidden="true" /> Night
              </span>
              <span className="text-pencil">Level 1 has no sensor</span>
            </>
          ) : (
            CUTS.map(([, b]) => (
              <span key={b} className="flex items-center gap-1.5">
                <BusyDot busy={b} /> {BUSY_LABEL[b]}
              </span>
            ))
          )}
        </figcaption>
        <div role="radiogroup" aria-label="Show" className="relative grid grid-cols-2 rounded-full p-0.5 shadow-[inset_0_0_0_1px_var(--color-rule)]">
          <span
            aria-hidden="true"
            className="absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-ink transition-transform duration-[260ms] ease-out-quint"
            style={{ transform: mode === "percent" ? "translateX(100%)" : "none" }}
          />
          {(["count", "percent"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`relative h-7 w-[72px] rounded-full text-[12px] font-medium transition-colors duration-200 before:absolute before:-inset-x-1 before:-inset-y-2 before:content-[''] ${mode === m ? "text-sheet" : "text-graphite hover:text-ink"}`}
            >
              {m === "count" ? "People" : "% full"}
            </button>
          ))}
        </div>
      </div>

      <div ref={box} className="relative mt-3 rounded-xl bg-sheet shadow-[inset_0_0_0_1px_var(--color-rule)]">
        {width > 0 ? (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`Headcount in Hunt Library over the last ${Math.max(1, Math.round(span / 86_400_000))} days. Use the arrow keys to step through readings.`}
            tabIndex={0}
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={() => setAt(null)}
            onFocus={() => show(at ?? n - 1)}
            onBlur={() => setAt(null)}
            onKeyDown={key}
            className="block touch-pan-y select-none rounded-xl"
          >
            <defs>
              {/* data draws in from the left once, on load */}
              <clipPath id={`${uid}-reveal`}>
                <rect x={0} y={0} width={width} height={HEIGHT} className="origin-left animate-reveal [transform-box:fill-box]" />
              </clipPath>
              {/* % full is colored by how busy that counts as */}
              <linearGradient id={`${uid}-busy`} gradientUnits="userSpaceOnUse" x1={0} x2={0} y1={y(0)} y2={y(1)}>
                <stop offset={0} stopColor="var(--color-quiet)" />
                <stop offset={0.25} stopColor="var(--color-quiet)" />
                <stop offset={0.25} stopColor="var(--color-busy)" />
                <stop offset={0.45} stopColor="var(--color-busy)" />
                <stop offset={0.45} stopColor="var(--color-packed)" />
                <stop offset={1} stopColor="var(--color-packed)" />
              </linearGradient>
            </defs>

            {nights.map(([a, b]) => (
              <rect key={a} x={x(Math.max(a, t0))} width={Math.max(0, x(Math.min(b, t1)) - x(Math.max(a, t0)))} y={PAD.top} height={innerH} fill="rgb(29 28 26 / 0.045)" />
            ))}
            <g key={mode} className="animate-fade">
              {mode === "percent" &&
                CUTS.map(([to, b], i) => (
                  <line key={b} x1={PAD.left} x2={PAD.left + innerW} y1={y(to)} y2={y(to)} stroke={`var(--color-${b}-ink)`} strokeOpacity={0.35} strokeDasharray="3 4" className={i === 2 ? "hidden" : ""} />
                ))}
              {yTicks.map((v) => (
                <g key={v}>
                  <line x1={PAD.left} x2={PAD.left + innerW} y1={y(v)} y2={y(v)} stroke="var(--color-rule-soft)" />
                  <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" className="plaque fill-pencil text-[11px]">
                    {mode === "count" ? v : `${Math.round(v * 100)}%`}
                  </text>
                </g>
              ))}
            </g>
            {xTicks.map((tk) => (
              <g key={tk.t}>
                <line x1={x(tk.t)} x2={x(tk.t)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--color-rule-soft)" />
                <text x={x(tk.t)} y={HEIGHT - 9} textAnchor="middle" className="fill-pencil text-[11px]">
                  {tk.label}
                </text>
              </g>
            ))}

            <g clipPath={`url(#${uid}-reveal)`}>
              <g key={mode} className="animate-fade">
                {mode === "count" ? (
                  <>
                    {layers.map((l) => (
                      <path key={l.lv} d={l.d} fill={LEVEL_FILL[l.lv]} />
                    ))}
                    <path d={line(xs, h.total.map((v) => (v === null ? null : y(v))), h.t)} fill="none" stroke="var(--color-ink)" strokeWidth={1.5} strokeLinejoin="round" />
                    {hasUsual && <path d={line(xs, usual.map((v) => (v === null ? null : y(v))), h.t)} fill="none" stroke="var(--color-graphite)" strokeWidth={1.25} strokeDasharray="4 3" strokeLinejoin="round" />}
                  </>
                ) : (
                  <>
                    <path d={band(xs, h.t.map(() => y(0)), shareYs, h.t)} fill={`url(#${uid}-busy)`} fillOpacity={0.55} />
                    <path d={line(xs, shareYs, h.t)} fill="none" stroke={`url(#${uid}-busy)`} strokeWidth={1.75} strokeLinejoin="round" />
                  </>
                )}
              </g>
            </g>

            <g key={`peaks-${mode}`} pointerEvents="none" className="animate-fade [animation-delay:900ms]">
              {peaks.map((i) => {
                const v = series[i]!;
                const px = xs[i];
                const anchor = px > PAD.left + innerW - 70 ? "end" : px < PAD.left + 50 ? "start" : "middle";
                return (
                  <g key={i}>
                    <circle cx={px} cy={y(v)} r={2.5} fill="var(--color-ink)" />
                    <text x={px + (anchor === "end" ? -6 : anchor === "start" ? 6 : 0)} y={Math.max(PAD.top + 22, y(v) - 9)} textAnchor={anchor} className="plaque fill-ink text-[12px] font-semibold">
                      {mode === "count" ? v.toLocaleString("en-US") : `${Math.round(v * 100)}%`}
                      <tspan className="fill-pencil font-normal"> · {hourFmt.format(h.t[i])}</tspan>
                    </text>
                  </g>
                );
              })}
            </g>

            {/* now: the right edge of the measured data */}
            <g pointerEvents="none">
              <line x1={nowX} x2={nowX} y1={PAD.top - 6} y2={PAD.top + innerH} stroke="var(--color-packed)" strokeWidth={1.25} />
              <text x={nowX - 5} y={PAD.top + 3} textAnchor="end" className="fill-[var(--color-packed-ink)] text-[10px] font-semibold uppercase tracking-[0.08em]">
                Now
              </text>
            </g>

            {tip >= 0 && (
              <g pointerEvents="none" className={`transition-opacity duration-150 ${at === null ? "opacity-0" : "opacity-100"}`}>
                <line x1={tipLeft} x2={tipLeft} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--color-ink)" strokeOpacity={0.45} strokeDasharray="2 3" />
                {mode === "count" &&
                  layers.map((l) =>
                    h.levels[l.lv][tip] === null ? null : <circle key={l.lv} cx={tipLeft} cy={y(l.base[tip])} r={2.5} fill="var(--color-sheet)" stroke={LEVEL_FILL[l.lv]} strokeWidth={1.5} />,
                  )}
                {tipValue !== null && <circle cx={tipLeft} cy={y(tipValue)} r={4} fill="var(--color-sheet)" stroke="var(--color-ink)" strokeWidth={2} />}
              </g>
            )}
          </svg>
        ) : (
          <div style={{ height: HEIGHT }} />
        )}

        {tip >= 0 && width > 0 && (
          <div
            aria-live="polite"
            className={`pointer-events-none absolute top-3 left-0 w-[190px] rounded-lg bg-ink/95 px-3 py-2.5 text-sheet shadow-lift transition-[opacity,transform,translate] duration-150 ease-out-quint ${
              at === null ? "scale-[0.97] opacity-0" : "scale-100 opacity-100"
            } ${flip ? "origin-top-right" : "origin-top-left"}`}
            style={{ translate: `${flip ? tipLeft - 190 - 12 : tipLeft + 12}px 0` }}
          >
            <p className="text-[11px] text-sheet/65">{fullFmt.format(h.t[tip])}</p>
            {h.total[tip] === null ? (
              <p className="mt-1 text-[13px]">No reading</p>
            ) : (
              <>
                <p className="mt-1 flex items-baseline gap-1.5">
                  <span className="plaque text-[24px] font-semibold leading-none tabular-nums">{h.total[tip]}</span>
                  <span className="text-[12px] text-sheet/75">people</span>
                  {h.share[tip] !== null && (
                    <span className="ml-auto flex items-center gap-1.5 text-[12px] tabular-nums text-sheet/85">
                      <BusyDot busy={busyAt(h.share[tip]!)} />
                      {Math.round(h.share[tip]! * 100)}%
                    </span>
                  )}
                </p>
                {mode === "count" && (
                  <ul className="mt-2 flex flex-col gap-0.5 border-t border-sheet/15 pt-2">
                    {[...levels].reverse().map((lv) => (
                      <li key={lv} className="flex items-center gap-2 text-[12px] text-sheet/80">
                        <span className="size-2 rounded-[2px]" style={{ background: LEVEL_FILL[lv] }} aria-hidden="true" />
                        Level {lv}
                        <span className="plaque ml-auto text-[13px] tabular-nums text-sheet">{h.levels[lv][tip] ?? "–"}</span>
                      </li>
                    ))}
                    {usual[tip] !== null && (
                      <li className="mt-1 flex items-center gap-2 border-t border-sheet/15 pt-1.5 text-[12px] text-sheet/80">
                        <span className="w-2 border-t-[1.5px] border-dashed border-sheet/70" aria-hidden="true" />
                        Typical
                        <span className="plaque ml-auto text-[13px] tabular-nums text-sheet">{usual[tip]}</span>
                      </li>
                    )}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </figure>
  );
}
