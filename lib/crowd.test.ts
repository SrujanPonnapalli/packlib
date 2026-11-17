import { test } from "node:test";
import assert from "node:assert/strict";
import { onPiece, scatter } from "./crowd.ts";
import { pointIn } from "./furnish.ts";
import type { Pt } from "../data/hunt-geometry.ts";

const room: Pt[] = [[0, 0], [200, 0], [200, 100], [0, 100]];
const core: Pt[] = [[80, 30], [120, 30], [120, 70], [80, 70]];
const table = { x: 40, y: 50, w: 30, d: 10, rot: 0, h: 0.3, base: 0, tone: "table" as const };

test("people stand inside the space, off the cores and the furniture", () => {
  const pts = scatter([room], 120, 7, [core], [table]);
  assert.equal(pts.length, 120);
  for (const p of pts) {
    assert.ok(pointIn(room, p));
    assert.ok(!pointIn(core, p));
    assert.ok(!onPiece([table], p));
  }
});

test("the same zone gets the same crowd every time", () => {
  assert.deepEqual(scatter([room], 10, 42), scatter([room], 10, 42));
  assert.notDeepEqual(scatter([room], 10, 42), scatter([room], 10, 43));
});

test("a space with no free floor returns fewer people instead of hanging", () => {
  assert.deepEqual(scatter([core], 5, 1, [room]), []);
});
