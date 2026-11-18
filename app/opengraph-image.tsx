import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { FLOORS } from "@/data/hill-geometry";

// share card for links to the site (and the GitHub social preview). Hill's real traced
// floors as an exploded stack, ported from the cover on my personal site. heat, picks and
// the trend are illustrative, not live data.
export const alt = "PackLib: a 3D model of Hill Library with how busy each floor is and Study Match picks";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Pt = [number, number];
type Heat = "quiet" | "busy" | "packed" | "pick";

const INK = "#171717";
const MUTED = "#6b6b6b";
const TEAL = "#1ec7b1";
const DEEP = "#0e8f7f";
const HEAT = { quiet: "#9dd08a", busy: "#f2b84b", packed: "#d9533a", pick: TEAL };
const HATCH = { quiet: 19, busy: 11, packed: 12.5 };

// flat axonometric projection of each floor (same numbers as the personal site's generator)
const TH = (-22 * Math.PI) / 180;
const proj = ([x, y]: Pt): Pt => [(x * Math.cos(TH) - y * Math.sin(TH)) * 0.24, (x * Math.sin(TH) + y * Math.cos(TH)) * 0.4 * 0.24];
const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const plates = (n: number) => [FLOORS[n].plate, ...(FLOORS[n].extra ?? [])];
const all = LEVELS.flatMap((n) => plates(n).flat().map(proj));
const minX = Math.min(...all.map((p) => p[0]));
const minY = Math.min(...all.map((p) => p[1]));
const P = (p: Pt): Pt => {
  const [x, y] = proj(p);
  return [x - minX + 4, y - minY + 4];
};
const d = (poly: Pt[]) => "M" + poly.map((p) => P(p).map((v) => v.toFixed(1)).join(" ")).join("L") + "Z";
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
// the two Study Match picks: the lounge on top of the tower and the Living Room on floor 2
const PICKS: Record<string, number> = { "9:Study lounge": 1, "2:Living Room": 2 };

const GAP = 46;
const THICK = 9;
const floors = LEVELS.map((n, i) => {
  const f = FLOORS[n];
  const pts = plates(n).flat().map(P);
  const zones = f.shapes
    .filter((s) => s.kind === "zone" || (s.kind === "room" && /quiet|lounge|commons/.test(s.fit ?? "")))
    .map((s) => {
      const rank = PICKS[`${n}:${s.label}`];
      const h = hash(`${n}${s.ref ?? s.label}${s.poly[0]}`) % 10;
      const heat: Heat = rank ? "pick" : h < 7 ? "quiet" : h < 9 ? "busy" : "packed";
      const c = P(s.poly.reduce<Pt>((a, p) => [a[0] + p[0] / s.poly.length, a[1] + p[1] / s.poly.length], [0, 0]));
      return { d: d(s.poly), heat, rank, at: c };
    });
  return {
    n,
    lift: i * GAP,
    tag: pts.reduce((a, p) => (p[0] < a[0] ? p : a)),
    top: Math.min(...pts.map((p) => p[1])) - i * 48,
    bottom: Math.max(...pts.map((p) => p[1])) - i * 44,
    plate: plates(n).map(d).join(""),
    rooms: f.shapes.filter((s) => s.kind === "room" || s.kind === "counter").map((s) => d(s.poly)).join(""),
    cores: f.shapes.filter((s) => s.kind === "core" || s.kind === "stair" || s.kind === "lift").map((s) => d(s.poly)).join(""),
    zones,
    picked: zones.some((z) => z.rank),
  };
});
const pins = floors.flatMap((f) => f.zones.filter((z) => z.rank).map((z) => ({ rank: z.rank, x: z.at[0], y: z.at[1] - f.lift })));

const VB_X = -40;
const VB_Y = Math.min(...floors.map((f) => f.top)) - 12;
const VB_W = Math.ceil(Math.max(...all.map((p) => p[0])) - minX + 8) - VB_X + 6;
const VB_H = Math.max(...floors.map((f) => f.bottom)) + THICK + 12 - VB_Y;
// the stack sits right of the text, like the cover (left 33%, 63% wide)
const HILL = { left: 396, top: 6, width: 756 };
const K = HILL.width / VB_W;
const toPx = (x: number, y: number) => [HILL.left + (x - VB_X) * K, HILL.top + (y - VB_Y) * K];

// today's trend: floors stacked in the Trends chart's blue ramp, a dashed "usual" line and a now marker
const HOURS = Array.from({ length: 35 }, (_, k) => 7 + k / 2);
const NOW = 17;
const usual = (h: number) => 90 + 820 * Math.exp(-(((h - 14.5) / 3.4) ** 2)) + 300 * Math.exp(-(((h - 20.5) / 1.5) ** 2));
const today = HOURS.slice(0, NOW + 1).map((h) => usual(h) * (1.06 + 0.07 * Math.sin(h * 1.9)));
const TX = (k: number) => (k / (HOURS.length - 1)) * 100;
const TY = (v: number) => 40 - (v / 1300) * 38;
function smooth(pts: number[][], move = true) {
  return pts
    .map((p, i) => {
      if (i === 0) return `${move ? "M" : "L"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
      const [a, b, c] = [pts[i - 2] ?? pts[i - 1], pts[i - 1], pts[i + 1] ?? p];
      const c1 = [b[0] + (p[0] - a[0]) / 6, b[1] + (p[1] - a[1]) / 6];
      const c2 = [p[0] - (c[0] - b[0]) / 6, p[1] - (c[1] - b[1]) / 6];
      return `C${c1.map((v) => v.toFixed(2)).join(" ")} ${c2.map((v) => v.toFixed(2)).join(" ")} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
    })
    .join("");
}
let below = today.map(() => 0);
const bands = [
  [0.34, "rgb(47,95,145)"],
  [0.26, "rgb(79,134,189)"],
  [0.22, "rgb(134,178,220)"],
  [0.18, "rgb(194,217,239)"],
].map(([share, fill]) => {
  const top = today.map((v, k) => below[k] + v * (share as number));
  const path = smooth(top.map((v, k) => [TX(k), TY(v)])) + smooth(below.map((v, k) => [TX(k), TY(v)]).reverse(), false) + "Z";
  below = top;
  return { path, fill: fill as string };
});
const hereNow = Math.round(today[NOW] / 10) * 10;

// read once at module scope so the image can be prerendered at build time
const [archivo600, archivo700] = await Promise.all([600, 700].map((w) => readFile(join(process.cwd(), `app/fonts/archivo-${w}.ttf`))));
const caps = { color: MUTED, fontSize: 17, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" } as const;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#f6f6f6", color: INK, fontFamily: "Archivo" }}>
        {/* teal wash pooled under the stack, and a faint dot grid fading out at the edges */}
        <svg width="1200" height="630" style={{ position: "absolute", left: 0, top: 0 }}>
          <defs>
            <radialGradient id="wash">
              <stop offset="0" stopColor="rgb(211,238,231)" stopOpacity="0.7" />
              <stop offset="0.72" stopColor="rgb(211,238,231)" stopOpacity="0" />
            </radialGradient>
            <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="12" cy="12" r="1" fill="rgba(23,23,23,0.12)" />
            </pattern>
            <radialGradient id="fade">
              <stop offset="0.35" stopColor="#fff" />
              <stop offset="1" stopColor="#000" />
            </radialGradient>
            <mask id="m">
              <rect x="480" y="0" width="552" height="485" fill="url(#fade)" />
            </mask>
          </defs>
          <ellipse cx="768" cy="265" rx="408" ry="277" fill="url(#wash)" />
          <rect x="480" y="0" width="552" height="485" fill="url(#dots)" mask="url(#m)" />
        </svg>

        <svg width={HILL.width} height={VB_H * K} viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`} style={{ position: "absolute", left: HILL.left, top: HILL.top }}>
          <defs>
            {(Object.keys(HATCH) as (keyof typeof HATCH)[]).map((b) => (
              <pattern key={b} id={`h-${b}`} width={HATCH[b]} height={HATCH[b]} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2={HATCH[b]} stroke="rgba(23,23,23,0.3)" strokeWidth="2.2" />
                {b === "packed" && <line x1="0" y1="0" x2={HATCH[b]} y2="0" stroke="rgba(23,23,23,0.3)" strokeWidth="2.2" />}
              </pattern>
            ))}
            <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="16" />
            </filter>
          </defs>
          <ellipse cx={(VB_W + VB_X) * 0.55} cy={VB_H * 0.5} rx={VB_W * 0.4} ry={VB_H * 0.2} fill="rgba(23,23,23,0.1)" filter="url(#blur)" />
          {floors.map((f) => (
            <g key={f.n} transform={`translate(0 ${-f.lift})`}>
              <path d={f.plate} transform={`translate(0 ${THICK})`} fill="#d6d6d6" stroke="#c4c4c4" strokeWidth="0.75" />
              <path d={f.plate} fill={f.picked ? "#f4fbf9" : "#fcfcfc"} stroke={f.picked ? DEEP : "#a0a0a0"} strokeWidth={f.picked ? 1.2 : 0.8} strokeLinejoin="round" />
              <path d={f.cores} fill="#e3e3e3" />
              <path d={f.rooms} fill="none" stroke="rgba(23,23,23,0.14)" strokeWidth="0.5" />
              {f.zones.map((z, j) => (
                <g key={j}>
                  <path d={z.d} fill={z.rank === 2 ? "#8fdccf" : HEAT[z.heat]} />
                  {z.heat !== "pick" && <path d={z.d} fill={`url(#h-${z.heat})`} />}
                </g>
              ))}
            </g>
          ))}
          {pins.map((p) => (
            <g key={p.rank}>
              <line x1={p.x} y1={p.y} x2={p.x} y2={p.y - 34} stroke={DEEP} strokeWidth="1.2" />
              <circle cx={p.x} cy={p.y} r="4.5" fill={DEEP} stroke="#fff" strokeWidth="3" />
              <circle cx={p.x} cy={p.y - 52} r="19" fill={p.rank === 1 ? TEAL : "#fff"} stroke={p.rank === 1 ? "#fff" : DEEP} strokeWidth="3" />
            </g>
          ))}
        </svg>

        {/* svg text has no font in the renderer, so floor numbers and pin numbers are placed as text over the svg */}
        {floors.map((f) => {
          const [x, y] = toPx(f.tag[0] - 12, f.tag[1] - f.lift + 8);
          return (
            <div key={f.n} style={{ position: "absolute", left: x - 60, top: y - 22, width: 60, display: "flex", justifyContent: "flex-end", fontSize: 22, fontWeight: 600, color: f.picked ? DEEP : MUTED }}>
              {f.n === 0 ? "G" : String(f.n)}
            </div>
          );
        })}
        {pins.map((p) => {
          const [x, y] = toPx(p.x, p.y - 52);
          return (
            <div key={p.rank} style={{ position: "absolute", left: x - 20, top: y - 13, width: 40, display: "flex", justifyContent: "center", fontSize: 21, fontWeight: 700, color: p.rank === 1 ? INK : DEEP }}>
              {String(p.rank)}
            </div>
          );
        })}

        <div style={{ position: "absolute", left: 66, top: 66, display: "flex", flexDirection: "column" }}>
          <div style={{ ...caps, fontSize: 19 }}>D. H. Hill Jr. Library</div>
          <div style={{ marginTop: 14, fontSize: 56, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1 }}>Find a place.</div>
          <div style={{ ...caps, marginTop: 50 }}>Study Match</div>
          {["Floor 9 Study Lounge", "Living Room"].map((name, i) => (
            <div key={name} style={{ marginTop: 16, display: "flex", alignItems: "center", fontSize: 23, fontWeight: 600 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  marginRight: 14,
                  borderRadius: 17,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 19,
                  fontWeight: 700,
                  background: i === 0 ? TEAL : "#fff",
                  color: i === 0 ? INK : DEEP,
                  border: i === 0 ? "none" : `2px solid ${DEEP}`,
                }}
              >
                {String(i + 1)}
              </div>
              {name}
            </div>
          ))}
        </div>

        <div style={{ position: "absolute", left: 66, top: 370, width: 300, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={caps}>Today</div>
            <div style={{ display: "flex", fontSize: 17, fontWeight: 600, color: MUTED }}>
              <span style={{ color: INK, fontWeight: 700, marginRight: 6 }}>{String(hereNow)}</span>here now
            </div>
          </div>
          <svg width="300" height="80" viewBox="0 0 100 40" preserveAspectRatio="none" style={{ marginTop: 12 }}>
            {bands.map((b) => (
              <path key={b.fill} d={b.path} fill={b.fill} />
            ))}
            <path d={smooth(HOURS.map((h, k) => [TX(k), TY(usual(h))]))} fill="none" stroke="#525252" strokeWidth="0.35" strokeDasharray="1 0.9" />
            <line x1={TX(NOW)} x2={TX(NOW)} y1="0" y2="40" stroke="#d9533a" strokeWidth="0.45" />
            <line x1="0" x2="100" y1="40" y2="40" stroke="rgba(23,23,23,0.18)" strokeWidth="0.6" />
          </svg>
          <div style={{ position: "relative", height: 22, marginTop: 8, display: "flex" }}>
            {["8a", "12p", "4p", "8p"].map((l, i) => (
              <div key={l} style={{ position: "absolute", left: (TX(2 + i * 8) / 100) * 300 - 20, width: 40, display: "flex", justifyContent: "center", fontSize: 15, fontWeight: 600, color: "#8a8a8a" }}>
                {l}
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: "absolute", left: 66, bottom: 46, display: "flex", alignItems: "center", fontSize: 22, fontWeight: 700 }}>
          {/* same mark as app/icon.svg */}
          <svg width="30" height="30" viewBox="1 3 30 30" stroke="#f6f6f6" strokeWidth="1.6" strokeLinejoin="round" style={{ marginRight: 10 }}>
            <path d="M5 24L16 29.5L27 24v2.5L16 32L5 26.5Z" fill="#525252" />
            <path d="M5 24L16 18.5L27 24L16 29.5Z" fill={INK} />
            <path d="M5 19L16 24.5L27 19v2.5L16 27L5 21.5Z" fill="#525252" />
            <path d="M5 19L16 13.5L27 19L16 24.5Z" fill={INK} />
            <path d="M5 10L16 15.5L27 10v2.5L16 18L5 12.5Z" fill="#9a0000" />
            <path d="M5 10L16 4.5L27 10L16 15.5Z" fill="#e01e1e" />
          </svg>
          PackLib
          <span style={{ marginLeft: 12, fontSize: 17, fontWeight: 600, color: MUTED }}>live study spaces at NC State</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Archivo", data: archivo600, weight: 600 },
        { name: "Archivo", data: archivo700, weight: 700 },
      ],
    },
  );
}
