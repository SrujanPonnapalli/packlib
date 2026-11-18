import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FLOORS } from "./hill-geometry.ts";

const spaces: { room: string | null; title: string; bookAhead: string | null }[] = JSON.parse(
  readFileSync(new URL("./hill-spaces.json", import.meta.url), "utf8"),
).spaces;

test("every Hill shape sits inside its floor's outline box", () => {
  for (const [n, f] of Object.entries(FLOORS)) {
    const pts = [f.plate, ...(f.extra ?? [])].flat();
    const [x0, x1] = [Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[0]))];
    const [y0, y1] = [Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[1]))];
    for (const s of f.shapes) {
      if (s.ref === "Terrace") continue; // outdoors, below the west wing
      for (const [x, y] of s.poly) assert.ok(x >= x0 && x <= x1 && y >= y0 && y <= y1, `Floor ${n}: ${s.ref ?? s.label} at ${x},${y}`);
    }
  }
});

test("every bookable Hill room is drawn on its floor", () => {
  const drawn = new Set(Object.values(FLOORS).flatMap((f) => f.shapes.map((s) => s.ref)));
  const missing = spaces.filter((s) => s.bookAhead && s.room && !drawn.has(s.room)).map((s) => s.room);
  // 1133C (Audio Booths) isn't on the official map
  assert.deepEqual(missing, ["1133C"]);
});
