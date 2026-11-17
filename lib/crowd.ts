// Where to draw the people a sensor counted. The count is real; where each
// person stands is made up, the same way every time for a given zone.

import { pointIn, type Piece } from "./furnish.ts";
import type { Pt } from "../data/hunt-geometry.ts";

/** Small seeded generator, so a zone's crowd does not reshuffle on every render. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const area = (poly: Pt[]) => Math.abs(poly.reduce((s, [x, y], i) => { const [u, v] = poly[(i + 1) % poly.length]; return s + x * v - u * y; }, 0)) / 2;

/** True when a point is on a piece of furniture (with `pad` px to spare). */
export function onPiece(pieces: Piece[], [x, y]: Pt, pad = 3) {
  return pieces.some((p) => {
    const dx = x - p.x;
    const dy = y - p.y;
    if (p.round || p.tone === "chair") return Math.hypot(dx, dy) < p.w / 2 + pad;
    const c = Math.cos(p.rot);
    const s = Math.sin(p.rot);
    return Math.abs(dx * c + dy * s) < p.w / 2 + pad && Math.abs(-dx * s + dy * c) < p.d / 2 + pad;
  });
}

/**
 * `count` points spread over `polys` (in proportion to their area), clear of
 * the `avoid` shapes and of furniture. Gives up on a point after a few tries
 * rather than loop forever in a crowded room, so it can return fewer.
 */
export function scatter(polys: Pt[][], count: number, seed: number, avoid: Pt[][] = [], pieces: Piece[] = []): Pt[] {
  const rand = seeded(seed);
  const weights = polys.map(area);
  const total = weights.reduce((a, b) => a + b, 0);
  const out: Pt[] = [];
  for (let i = 0; i < count; i++) {
    let r = rand() * total;
    const poly = polys[Math.max(0, weights.findIndex((w) => (r -= w) <= 0))];
    const xs = poly.map((p) => p[0]);
    const ys = poly.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    for (let tries = 0; tries < 30; tries++) {
      const p: Pt = [x0 + rand() * (x1 - x0), y0 + rand() * (y1 - y0)];
      if (pointIn(poly, p) && !avoid.some((a) => pointIn(a, p)) && !onPiece(pieces, p)) {
        out.push(p);
        break;
      }
    }
  }
  return out;
}
