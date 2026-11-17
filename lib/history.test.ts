import { test } from "node:test";
import assert from "node:assert/strict";
import { observations, slot } from "./history.ts";

const at = "2026-11-17T19:45:10Z"; // 2:45 pm in Raleigh
const building = {
  id: 1356, name: "Hunt Library", count: 350, percentage: 0.1934, timestamp: at, isActive: true,
  childCounts: [
    { id: 1352, name: "Level 2", count: 60, percentage: 0.11, isActive: true },
    { id: 1353, name: "Level 3", count: 100, percentage: 0.27, isActive: true },
  ],
};
const level2 = {
  id: 1352, name: "Level 2", count: 61, percentage: 0.11, timestamp: at, isActive: true,
  childCounts: [
    { id: 4402, name: "Carrel Corridor", count: 4, percentage: 0.05, isActive: true },
    { id: 5000, name: "A zone StudyScape doesn't draw", count: 3, percentage: 0.1, isActive: true },
    { id: 1342, name: "Quiet Reading Room", count: 9, percentage: 0.2, isActive: false },
  ],
};

test("days split at New York midnight, including across the clocks changing", () => {
  assert.deepEqual(slot(at), { day: "2026-11-17", minute: 14 * 60 + 45 });
  assert.deepEqual(slot("2026-11-18T04:59:00Z"), { day: "2026-11-17", minute: 23 * 60 + 59 }, "EST is UTC-5");
  assert.deepEqual(slot("2026-07-01T04:00:00Z"), { day: "2026-07-01", minute: 0 }, "EDT is UTC-4");
});

test("one poll stores the building, each level and every zone, keeping switched-off sensors as no reading", () => {
  const { day, rows } = observations(building, { 2: level2, 3: null });
  assert.equal(day, "2026-11-17");
  assert.deepEqual(Object.fromEntries(rows), {
    building: [885, 350, 0.193],
    "level#2": [885, 61, 0.11],
    "zone#4402": [885, 4, 0.05],
    "zone#5000": [885, 3, 0.1],
    "zone#1342": [885, null, null],
    "level#3": [885, 100, 0.27], // its own request failed, so the building's total stands in
  });
});

test("an unusable building response writes nothing", () => {
  assert.throws(() => observations({ error: "down" }, {}));
});
