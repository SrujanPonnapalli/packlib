import { test } from "node:test";
import assert from "node:assert/strict";
import { fitFloor, gridIn, inset, meetingRoom, pointIn, type Fitout } from "./furnish.ts";
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

test("every piece of Level 3 furniture sits on the floor plate", () => {
  const floor = FLOORS[3];
  const fit = fitFloor(floor, () => fitout(8));
  assert.ok(fit.pieces.length > 100);
  for (const p of fit.pieces) assert.ok(pointIn(floor.plate, [p.x, p.y]), `piece at ${p.x},${p.y} is off the plate`);
});
