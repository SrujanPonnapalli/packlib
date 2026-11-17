// Room availability. NC State's booking system (Mazévo) sits behind campus
// sign-in and has no public feed, so these bookings are made up: plausible,
// the same for a given room and day, and labelled "Demo" wherever they show.

import { seeded } from "./crowd.ts";

/** Minutes from midnight. */
export type Booking = [number, number];

// Hunt is open around the clock on most days, so rooms can be booked at any hour; demo bookings are rare overnight.
export const OPEN = 0;
export const CLOSE = 24 * 60;
const SLOT = 30;

const hash = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;

/** One day's demo bookings for a room, busiest in the mid-afternoon. `day` is YYYY-MM-DD. */
export function demoBookings(room: string, day: string): Booking[] {
  const rand = seeded(hash(`${room} ${day}`));
  const out: Booking[] = [];
  for (let t = OPEN; t < CLOSE; ) {
    const hour = t / 60;
    const base = hour >= 8 && hour < 23 ? 0.1 : 0.02;
    if (rand() < base + 0.32 * Math.exp(-((hour - 15) ** 2) / 12)) {
      const end = Math.min(CLOSE, t + SLOT * (2 + Math.floor(rand() * 5))); // 1 to 3 hours
      out.push([t, end]);
      t = end;
    } else t += SLOT * (1 + Math.floor(rand() * 3));
  }
  return out;
}

export type Availability = "free" | "soon" | "booked";
export type Status = { state: Availability; until: number };

/** Free or booked at `minute`, and until when. "soon": free, but booked within the hour. */
export function statusAt(bookings: Booking[], minute: number): Status {
  const current = bookings.find(([a, b]) => a <= minute && minute < b);
  if (current) {
    let until = current[1];
    for (let next; (next = bookings.find(([a]) => a === until)); ) until = next[1]; // back-to-back bookings
    return { state: "booked", until };
  }
  const until = bookings.find(([a]) => a > minute)?.[0] ?? CLOSE;
  return { state: until - minute < 60 ? "soon" : "free", until };
}

export function clock(minute: number) {
  if (minute >= CLOSE) return "midnight";
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export const AVAIL_LABEL: Record<Availability, string> = { free: "Free", soon: "Free for under an hour", booked: "Booked" };

export function describe(s: Status) {
  if (s.state === "booked") return `Booked until ${clock(s.until)}`;
  return s.until >= CLOSE ? "Free for the rest of the day" : `Free until ${clock(s.until)}`;
}
