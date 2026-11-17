import { test } from "node:test";
import assert from "node:assert/strict";
import { hoursOf, match, ruledOut, type Ask, type Candidate } from "./match.ts";

const everyone = ["Faculty", "Graduate Students", "Staff", "Students"];
const room = (id: string, seats: number | null, more: Partial<Candidate> = {}): Candidate => ({
  id, title: `Study Room ${id}`, level: Number(id[0]), room: id, bookable: true, eligible: everyone,
  seats, display: true, whiteboard: true, outsideWindow: false, maxHours: 2, ...more,
});
const open = (id: string, vibe: Candidate["vibe"], more: Partial<Candidate> = {}): Candidate => ({
  id, title: id, level: 2, room: null, bookable: false, eligible: everyone, seats: null,
  display: false, whiteboard: false, outsideWindow: false, maxHours: null, vibe, ...more,
});
const ask = (over: Partial<Ask> = {}): Ask => ({ size: 1, work: "focus", when: "now", hours: 2, who: "undergrad", ...over });

const places = [
  room("3208", 8), room("3212", 8), room("3209", 6), room("2314", 4), room("2305", null),
  room("4311", null, { title: "Graduate Study Room 4311", eligible: ["Graduate Students"], maxHours: 4 }),
  room("5210", null, { title: "Faculty Focus 5210", eligible: ["Faculty"], solo: true, maxHours: 24, display: false, whiteboard: false }),
  open("Quiet Reading Room", "quiet", { busy: "quiet" }),
  open("Carrel Corridor", "quiet", { individual: true }),
  open("Learning Commons", "social", { level: 3, busy: "busy" }),
  open("Rain Garden Reading Lounge", "lounge", { busy: "packed" }),
];

test("hard rules are never traded for score", () => {
  for (const a of [ask({ size: 8, work: "group" }), ask({ work: "present" }), ask({ who: "undergrad" }), ask({ size: 4, work: "group", who: "faculty" })]) {
    for (const m of match(places, a).matches) assert.equal(ruledOut(places.find((p) => p.id === m.id)!, a), null);
  }
  assert.equal(ruledOut(places[5], ask()), "not open to you", "undergrads can't use grad rooms");
  assert.equal(ruledOut(places[6], ask({ who: "faculty", size: 2 })), "a room for one");
  assert.equal(ruledOut(places[7], ask({ size: 3, work: "group" })), "a quiet space, so no talking");
  assert.equal(ruledOut(places[8], ask({ work: "present" })), "no screen");
});

test("a group gets a room that fits, not the biggest one", () => {
  const [best] = match(places, ask({ size: 4, work: "group", when: "later" })).matches;
  assert.equal(best.id, "2314");
  const eight = match(places, ask({ size: 8, work: "group", when: "later" })).matches;
  assert.equal(eight[0].id, "3208");
  assert.deepEqual(eight[0].similar, ["3212"], "identical rooms on one level collapse into one result");
});

test("working alone now, the quiet reading room beats a big bookable room", () => {
  const { matches } = match(places, ask());
  assert.equal(matches[0].id, "Quiet Reading Room");
  assert.ok(matches[0].reasons.includes("No booking needed: just walk in"));
  const big = match(places, ask({ when: "later" })).matches.find((m) => m.id === "3208");
  assert.ok(!big || big.cautions.some((c) => c.includes("leave big rooms for groups")));
});

test("live busyness counts now, not when booking ahead", () => {
  const now = match(places, ask({ work: "unwind" })).matches;
  assert.ok(now.find((m) => m.id === "Rain Garden Reading Lounge")?.cautions.includes("Very busy right now") ?? true);
  const later = match(places, ask({ work: "unwind", when: "later" })).matches;
  assert.ok(later.every((m) => m.cautions.every((c) => !/busy right now/i.test(c))));
});

test("booking ahead to focus alone, an office for one beats walk-in seats", () => {
  assert.equal(match(places, ask({ who: "faculty", when: "later", hours: 8 })).matches[0].id, "5210");
  assert.ok(!match(places, ask({ size: 6 })).matches.some((m) => m.id === "Carrel Corridor"), "carrels are single seats");
});

test("long sessions warn about booking limits", () => {
  const m = match(places, ask({ size: 4, work: "group", hours: 8, when: "later" })).matches.find((x) => x.id === "2314");
  assert.ok(m?.cautions.includes("Bookings max out at 2 hours"));
});

test("at most three results, and the rules that ruled places out are counted", () => {
  const { matches, ruled } = match(places, ask({ size: 8, work: "present" }));
  assert.ok(matches.length <= 3);
  assert.ok(ruled["too few seats"] > 0 && ruled["no screen"] > 0);
});

test("booking limits read from NC State's text", () => {
  assert.equal(hoursOf("2 hours"), 2);
  assert.equal(hoursOf("24 hours"), 24);
  assert.equal(hoursOf(null), null);
});
