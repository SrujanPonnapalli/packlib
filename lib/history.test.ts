import { test } from "node:test";
import assert from "node:assert/strict";
import { instant, lineUp, observations, slot, summary, typical } from "./history.ts";
import { HILL_SENSORS, HUNT_SENSORS } from "./occupancy.ts";

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
  const { day, rows } = observations(HUNT_SENSORS, building, { 1352: level2, 1353: null });
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
  assert.throws(() => observations(HUNT_SENSORS, { error: "down" }, {}));
});

test("Hill: prefixed keys, a floor added up from its wings, and each wing kept as a zone", () => {
  const hill = { id: 264, name: "Hill Library", count: 1065, percentage: 0.46, timestamp: at, isActive: true, childCounts: [] };
  const wing = (id: number, count: number, percentage: number, kids: object[] = []) => ({ id, name: "", count, percentage, timestamp: at, isActive: true, childCounts: kids });
  const { rows } = observations(HILL_SENSORS, hill, {
    266: wing(266, 105, 0.55, [{ id: 267, name: "Quiet Reading Rooms", count: 65, percentage: 0.61, isActive: true }]),
    4478: wing(4478, 25, 0.33),
    273: wing(273, 296, 0.6),
    269: wing(269, 39, 0.27),
    282: null, // Floor 2's tower sensor failed
    278: wing(278, 13, 0.48),
    290: wing(290, 75, 0.5),
  });
  const got = Object.fromEntries(rows);
  assert.deepEqual(got["hill#building"], [885, 1065, 0.46]);
  assert.deepEqual(got["hill#level#1"], [885, 426, 0.561], "105 + 25 + 296 people against 191 + 76 + 493 seats");
  assert.deepEqual(got["zone#267"], [885, 65, 0.61]);
  assert.deepEqual(got["zone#4478"], [885, 25, 0.33]);
  assert.deepEqual(got["hill#level#2"], [885, null, null], "a missing wing makes the floor no reading, not a quieter floor");
  assert.deepEqual(got["zone#269"], [885, 39, 0.27]);
  assert.deepEqual(got["hill#level#4"], [885, 75, 0.5]);
  assert.equal(got["hill#level#5"], undefined, "a single-sensor floor with no response and no building total writes nothing");
  assert.equal(rows.filter(([k]) => k === "building" || k.startsWith("level#")).length, 0, "nothing lands in Hunt's keys");
});

test("stored days become one time-ordered history, with repeated minutes collapsed", () => {
  const h = lineUp(
    {
      building: [
        { day: "2026-11-17", r: [[75, 178, 0.1], [75, 178, 0.1], [79, 158, 0.09]] },
        { day: "2026-11-16", r: [[1435, 200, 0.11]] },
      ],
      "level#2": [{ day: "2026-11-17", r: [[79, 30, 0.05]] }],
    },
    "2026-11-16",
    0,
  );
  assert.deepEqual(h.t, [Date.parse("2026-11-17T04:55:00Z"), Date.parse("2026-11-17T06:15:00Z"), Date.parse("2026-11-17T06:19:00Z")]);
  assert.deepEqual(h.total, [200, 178, 158]);
  assert.deepEqual(h.levels[2], [null, null, 30], "a level with no reading at that poll is a gap, not zero");
  assert.equal(instant("2026-03-08", 3 * 60), Date.parse("2026-03-08T07:00:00Z"), "after clocks go forward");
});

test("now against yesterday at this time, and the week's peak", () => {
  const day = 86_400_000;
  const t0 = Date.parse("2026-11-17T19:00:00Z");
  const h = { t: [t0 - day - 4 * 60_000, t0 - 3600_000, t0], total: [400, 900, 500], share: [0.2, 0.5, 0.28], levels: {}, since: null, readAt: t0 };
  const s = summary(h, t0);
  assert.equal(s.latest?.count, 500);
  assert.equal(s.yesterday, 400, "within 15 minutes of exactly a day earlier");
  assert.equal(s.change, 25);
  assert.deepEqual(s.peak, { t: t0 - 3600_000, count: 900 });
  assert.equal(s.hourChange, -44, "an hour ago there were 900");
  assert.equal(summary({ ...h, t: [t0], total: [500], share: [0.28] }, t0).change, null, "no reading yesterday, no comparison");
});

test("typical is the median of the same time on earlier days, once 3 days exist", () => {
  const day = 86_400_000;
  const t0 = Date.parse("2026-11-20T18:00:00Z");
  // Readings at 1 pm on four days (the oldest a few minutes off the hour), plus one at 5 pm yesterday.
  const t = [t0 - 3 * day + 5 * 60_000, t0 - 2 * day, t0 - day, t0 - day + 4 * 3600_000, t0];
  const h = { t, total: [300, 900, 600, 50, 700], share: t.map(() => null), levels: {}, since: null, readAt: t0 };
  const out = typical(h);
  assert.equal(out[4], 600, "median of 300, 900 and 600");
  assert.equal(out[2], null, "only two earlier days");
});
