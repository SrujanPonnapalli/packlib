import { test } from "node:test";
import assert from "node:assert/strict";
import { CLOSE, OPEN, clock, demoBookings, describe, statusAt, type Booking } from "./availability.ts";

const day: Booking[] = [[600, 660], [660, 720], [900, 990]]; // 10–11, 11–12, 3–4:30

test("booked until the end of back-to-back bookings", () => {
  assert.deepEqual(statusAt(day, 610), { state: "booked", until: 720 });
});

test("free until the next booking, and 'soon' when that is under an hour away", () => {
  assert.deepEqual(statusAt(day, 720), { state: "free", until: 900 });
  assert.deepEqual(statusAt(day, 860), { state: "soon", until: 900 });
  assert.deepEqual(statusAt(day, 1000), { state: "free", until: CLOSE });
});

test("overnight, a room is free until its first booking", () => {
  assert.deepEqual(statusAt(day, 30), { state: "free", until: 600 });
  assert.equal(describe(statusAt(day, 30)), "Free until 10:00 AM");
});

test("demo bookings are stable, ordered, non-overlapping and within hours", () => {
  assert.deepEqual(demoBookings("3212", "2026-11-17"), demoBookings("3212", "2026-11-17"));
  assert.notDeepEqual(demoBookings("3212", "2026-11-17"), demoBookings("3213", "2026-11-17"));
  for (const room of ["2304", "3212", "4510", "5241"]) {
    const b = demoBookings(room, "2026-11-17");
    b.forEach(([a, e], i) => {
      assert.ok(a >= OPEN && e <= CLOSE && a < e);
      if (i) assert.ok(a >= b[i - 1][1]);
    });
  }
});

test("times read like a clock", () => {
  assert.equal(clock(15 * 60 + 30), "3:30 PM");
  assert.equal(clock(12 * 60), "12:00 PM");
  assert.equal(describe({ state: "free", until: CLOSE }), "Free for the rest of the day");
});
