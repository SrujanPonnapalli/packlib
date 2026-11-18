import { test } from "node:test";
import assert from "node:assert/strict";
import { HILL_SENSORS, ago, busyness, combine, combineLibrary, parse, people, sumLevel, zoneFor } from "./occupancy.ts";

const at = "2026-11-17T05:14:46.292Z";
const building = {
  id: 1356, name: "Hunt Library", count: 350, percentage: 0.19, timestamp: at, isActive: true,
  childCounts: [
    { id: 1352, name: "Level 2", count: 60, percentage: 0.11, isActive: true },
    { id: 1353, name: "Level 3", count: 100, percentage: 0.27, isActive: true },
  ],
};
const level2 = {
  id: 1352, name: "Level 2", count: 60, percentage: 0.11, timestamp: at, isActive: true,
  childCounts: [
    { id: 4402, name: "Carrel Corridor", count: 0, percentage: 0, isActive: true },
    { id: 1341, name: "Rain Garden Lounge + Idea Alcove + Perimeter", count: 35, percentage: 0.5, isActive: true },
    { id: 9999, name: "Unknown zone", count: 3, percentage: 0.1, isActive: true },
  ],
};

test("NC State's cut-offs: 25/45 everywhere, 19.8/35.6 for Level 3", () => {
  assert.equal(busyness(1352, 0.25), "quiet");
  assert.equal(busyness(1352, 0.26), "busy");
  assert.equal(busyness(1352, 0.46), "packed");
  assert.equal(busyness(1353, 0.25), "busy");
  assert.equal(busyness(1353, 0.36), "packed");
});

test("Hill's own cut-offs: carrel floors 40/60, Learning Commons 30/55, Mezzanine 19.8/35.6", () => {
  assert.equal(busyness(290, 0.5), "busy");
  assert.equal(busyness(295, 0.61), "packed");
  assert.equal(busyness(274, 0.3), "quiet");
  assert.equal(busyness(274, 0.56), "packed");
  assert.equal(busyness(281, 0.2), "busy");
  assert.equal(busyness(280, 0.46), "packed", "Floor G uses the standard set");
});

test("a floor of several sensors adds up, and has no reading if any part is missing", () => {
  const r = (id: number, count: number | null) => ({ id, name: "", count, share: null, busy: null });
  assert.deepEqual(sumLevel([r(1, 30), r(2, 10)], { 1: 60, 2: 40 }), { count: 40, share: 0.4 });
  assert.deepEqual(sumLevel([r(1, 30), r(2, null)], { 1: 60, 2: 40 }), { count: null, share: null });
  assert.deepEqual(sumLevel([r(1, 30), null], { 1: 60, 2: 40 }), { count: null, share: null });
  assert.deepEqual(sumLevel([r(1, 30), r(3, 5)], { 1: 60 }), { count: null, share: null }, "unknown seats, no guess");
});

test("a full response becomes building, level and zone readings", () => {
  const o = combine(building, { 2: level2 });
  assert.equal(o.at, at);
  assert.equal(o.building.count, 350);
  assert.equal(o.levels[2].busy, "quiet");
  assert.equal(o.levels[3].count, 100, "a level without its own response keeps the building's total");
  assert.deepEqual(o.zones.map((z) => z.refs), [["2008"], ["Rain Garden Reading Lounge", "2302"]], "unknown zones are dropped");
  assert.equal(o.zones[1].busy, "packed");
});

test("inactive sensors and bad fields are 'no reading', not zero", () => {
  const o = combine(building, {
    2: { ...level2, childCounts: [{ id: 4402, count: null, percentage: null, isActive: false }, { id: 1342, count: "lots", percentage: 0.2 }] },
  });
  assert.deepEqual(o.zones.map((z) => [z.count, z.busy]), [[null, null], [null, null]]);
});

test("a broken response throws, so the route can say the data is unavailable", () => {
  assert.throws(() => parse(null));
  assert.throws(() => parse({ id: 1356, count: 3 }), /timestamp/);
  assert.throws(() => combine("<html>", {}));
  assert.doesNotThrow(() => combine(building, { 2: "<html>", 4: { nope: true } }));
});

test("counts never claim a space is empty", () => {
  assert.equal(people(0), "a few people at most");
  assert.equal(people(35), "about 35 people");
  assert.equal(people(null), null);
  assert.equal(ago(at, Date.parse(at) + 7 * 60000), "7 min ago");
});

test("Hill: a floor of three sensors is added up, its areas link to drawn spaces, a missing part blanks the floor", () => {
  const hill = { id: 264, name: "Hill Library", count: 974, percentage: 0.42, timestamp: at, isActive: true, childCounts: [] };
  const part = (id: number, count: number, childCounts: unknown[] = []) => ({ id, name: "", count, percentage: 0.3, timestamp: at, isActive: true, childCounts });
  const o = combineLibrary(HILL_SENSORS, hill, {
    266: part(266, 53, [{ id: 268, name: "Fishbowl Forum", count: 11, percentage: 0.2, isActive: true }]),
    4478: part(4478, 19),
    273: part(273, 288, [{ id: 274, name: "Learning Commons", count: 194, percentage: 0.6, isActive: true }]),
    269: part(269, 22),
    282: null,
    278: part(278, 10),
    290: part(290, 63),
  });
  assert.equal(o.levels[1].count, 360);
  assert.equal(o.levels[1].share, 360 / (191 + 76 + 493));
  assert.equal(o.levels[2].count, null); // the tower part failed and the building lists only wings
  assert.equal(o.levels[4].count, 63);
  // Floor 4 has no named areas, so its own sensor shades its seating (30% is quiet on a carrel floor).
  assert.deepEqual(o.zones.map((z) => [z.level, z.refs[0], z.busy]), [[1, "1328", "quiet"], [1, "Learning Commons", "packed"], [4, "Seating Floor 4", "quiet"]]);
  // ...but no space takes the whole floor's count as its own.
  assert.equal(zoneFor(o, "Seating Floor 4"), null);
  assert.equal(zoneFor(o, "1328")?.count, 11);
});
