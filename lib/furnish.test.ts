import { test } from "node:test";
import assert from "node:assert/strict";
import { fitFloor, gridIn, inset, meetingRoom, pointIn, steps, type Fitout } from "./furnish.ts";
import { FLOORS, type Pt } from "../data/hunt-geometry.ts";

const square: Pt[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
const fitout = (seats: number | null): Fitout => ({ seats, display: true, whiteboard: true, window: null, adjustable: false });

test("inset shrinks a rectangle evenly", () => {
  assert.deepEqual(inset(square, 1).map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]), [[1, 1], [9, 1], [9, 9], [1, 9]]);
});

test("a room seats as many chairs as its caption says, all inside it", () => {
  const room: Pt[] = [[0, 0], [74, 0], [74, 39], [0, 39]];
  for (const seats of [4, 6, 8, 10]) {
    const chairs = meetingRoom(room, 3, fitout(seats)).pieces.filter((p) => p.tone === "chair");
    assert.equal(chairs.length, seats);
    for (const c of chairs) assert.ok(pointIn(room, [c.x, c.y]), `chair outside room for ${seats} seats`);
  }
});

test("rooms with no seat count still get a table and chairs, and no number is claimed", () => {
  const { pieces, callouts } = meetingRoom([[0, 0], [50, 0], [50, 50], [0, 50]], 0, fitout(null));
  assert.equal(pieces.filter((p) => p.tone === "chair").length, 6);
  assert.equal(callouts[0].text, "Table and chairs");
});

test("grid points avoid other shapes", () => {
  const hole: Pt[] = [[40, 40], [60, 40], [60, 60], [40, 60]];
  const pts = gridIn([[0, 0], [100, 0], [100, 100], [0, 100]], 10, 2, [hole]);
  assert.ok(pts.length > 20);
  assert.ok(pts.every((p) => !pointIn(hole, p)));
});

for (const level of [2, 3])
  test(`every room, stair and piece of furniture on Level ${level} sits on the floor plate`, () => {
    const floor = FLOORS[level];
    const fit = fitFloor(floor, () => fitout(8));
    const pieces = [...fit.stairs, ...fit.wells, ...Object.values(fit.detail).flatMap((d) => d.pieces)];
    assert.ok(pieces.length > 60);
    for (const p of pieces) assert.ok(pointIn(floor.plate, [p.x, p.y]), `piece at ${p.x},${p.y} is off the plate`);
    for (const r of fit.rooms) for (const q of r.poly) assert.ok(pointIn(floor.plate, q), `room ${r.ref} corner ${q} is off the plate`);
  });

test("a stair is one straight flight from its entry edge up to the floor above", () => {
  const treads = steps([[0, 0], [60, 0], [60, 80], [0, 80]], 0);
  const tops = treads.map((p) => p.base + p.h);
  assert.equal(tops.at(-1), 1);
  assert.ok(tops.every((top, i) => i === 0 || top > tops[i - 1]), "every tread is higher than the last");
  assert.ok(treads[0].y < 15 && treads.at(-1)!.y > 65, "it starts at the entry edge and ends at the far side");
});
