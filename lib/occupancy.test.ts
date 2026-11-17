import { test } from "node:test";
import assert from "node:assert/strict";
import { ago, busyness, combine, parse, people } from "./occupancy.ts";

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
