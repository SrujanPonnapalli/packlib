// Study Match: answer a few questions, get up to three places back with reasons
// in plain words. Hard rules (who can use it, enough seats, a screen to present
// on) always win over the score, everything else is just a preference.

import type { Busy } from "./occupancy.ts";

export type Who = "undergrad" | "grad" | "faculty" | "staff";
export type Work = "focus" | "group" | "present" | "unwind";
export type Ask = { size: number; work: Work; when: "now" | "later"; hours: number; who: Who };

/** How an open space feels. Rooms are private so they don't have one. */
export type Vibe = "quiet" | "lounge" | "social";

export type Candidate = {
  id: string;
  title: string;
  level: number;
  room: string | null;
  /** True for bookable rooms, false for open seating you can just walk into. */
  bookable: boolean;
  /** Who may use or book it, in NC State's words ("Students", "Faculty", ...). */
  eligible: string[];
  seats: number | null;
  /** Office-like rooms meant for one person. */
  solo?: boolean;
  /** Open seating made of individual spots like carrels, so it's bad for a group sitting together. */
  individual?: boolean;
  display: boolean;
  whiteboard: boolean;
  outsideWindow: boolean;
  maxHours: number | null;
  vibe?: Vibe;
  /** Live busyness of the space itself, when it has a sensor. */
  busy?: Busy | null;
  count?: number | null;
};

export type Match = { id: string; score: number; reasons: string[]; cautions: string[]; similar: string[] };

const WHO: Record<Who, string[]> = {
  undergrad: ["Students"],
  grad: ["Graduate Students", "Students"],
  faculty: ["Faculty"],
  staff: ["Staff"],
};

const UNLISTED_MAX = 6; // TODO: rooms whose captions don't give a seat count are trusted for up to six, change if the Libraries publish capacities

/** The hard rules. Returns why a place is ruled out, or null if it's allowed. */
export function ruledOut(c: Candidate, a: Ask): string | null {
  if (!c.eligible.some((e) => WHO[a.who].includes(e))) return "not open to you";
  if (c.bookable) {
    if (c.solo && a.size > 1) return "a room for one";
    if (c.seats !== null ? c.seats < a.size : a.size > UNLISTED_MAX) return "too few seats";
  }
  if (c.individual && a.size > 1) return "single seats only";
  if (a.work === "present" && !c.display) return "no screen";
  if (a.size > 1 && c.vibe === "quiet" && a.work !== "focus") return "a quiet space, so no talking";
  return null;
}

export function score(c: Candidate, a: Ask): Omit<Match, "similar"> {
  let s = 0;
  const reasons: string[] = [];
  const cautions: string[] = [];
  const add = (points: number, why?: string) => {
    s += points;
    if (why) (points >= 0 ? reasons : cautions).push(why);
  };

  // what you're there to do
  if (a.work === "focus") {
    if (c.vibe === "quiet") add(3, a.size > 1 ? "A quiet space, so you'll work side by side in silence" : "A quiet space: no talking");
    else if (c.solo) add(3, "An office-like room made for one");
    else if (c.bookable) add(a.size === 1 ? 2 : 2.5, a.size === 1 ? "A room to yourself, with a door" : "A room with a door, away from the noise");
    else if (c.vibe === "lounge") add(1, "Soft seating, usually calm");
    else add(-1);
  } else if (a.work === "group") {
    if (c.bookable) add(c.whiteboard ? 3 : 2, c.whiteboard ? "Whiteboard walls to work things out on" : "A room you can talk in");
    else if (c.vibe === "social") add(2, "An open area made for working together");
    else add(0);
    if (c.bookable && c.display) add(1, "A wall display to share a laptop");
  } else if (a.work === "present") {
    add(3, "A wall display to practise on");
    if (c.whiteboard) add(0.5);
  } else {
    if (c.vibe === "lounge") add(3, "Soft seating and a relaxed feel");
    else if (c.vibe === "social") add(1, "Lively, with room to spread out");
    else if (c.vibe === "quiet") add(1, "Calm and light-filled");
    else add(-1);
  }

  // size: a room that fits, not just the biggest one
  if (c.bookable) {
    if (c.seats !== null) {
      const spare = c.seats - a.size;
      if (a.size === 1 && c.seats >= 6) add(-1.5, `Seats ${c.seats}; the Libraries ask people working alone to leave big rooms for groups`);
      else if (spare <= 2) add(1, `Seats ${c.seats}, about right for ${a.size === 1 ? "you" : "your group"}`);
      else add(-0.3 * spare, `Seats ${c.seats}, more than you need`);
    } else if (!c.solo) add(-0.4, "Seat count isn't listed");
  }

  // when and for how long
  if (a.when === "now") {
    if (!c.bookable) add(1.5, "No booking needed: just walk in");
    else add(-0.5, "Needs a booking; check on NC State whether it's free now");
    if (c.busy === "quiet") add(1, "Not busy right now");
    else if (c.busy === "packed") add(-2, "Very busy right now");
    else if (c.busy === "busy") add(-0.5, "Busy right now");
  } else if (c.bookable) add(1, "You can book it ahead");
  else add(-0.5, "Can't be booked: first come, first served");
  if (c.bookable && c.maxHours !== null && c.maxHours < a.hours) add(-1.5, `Bookings max out at ${c.maxHours} hours`);
  else if (!c.bookable && a.hours >= 4) add(0.5, "Stay as long as you like");

  if (c.outsideWindow) add(0.3, "Outside windows");
  return { id: c.id, score: Math.round(s * 100) / 100, reasons, cautions };
}

const sameShape = (a: Candidate, b: Candidate) =>
  a.bookable && b.bookable && a.level === b.level && a.seats === b.seats && a.display === b.display && a.whiteboard === b.whiteboard;

/**
 * Up to three places, best first. Near-identical rooms on the same level get
 * collapsed into one result that lists the rest as `similar`, so the three
 * results are actually different options and not three doors down the same hall.
 */
export function match(candidates: Candidate[], a: Ask, limit = 3): { matches: Match[]; ruled: Record<string, number> } {
  const ruled: Record<string, number> = {};
  const allowed = candidates.filter((c) => {
    const why = ruledOut(c, a);
    if (why) ruled[why] = (ruled[why] ?? 0) + 1;
    return !why;
  });
  const ranked = allowed.map((c) => ({ c, m: score(c, a) })).sort((x, y) => y.m.score - x.m.score || x.c.title.localeCompare(y.c.title));
  const out: { c: Candidate; m: Match }[] = [];
  for (const { c, m } of ranked) {
    const twin = out.find((o) => sameShape(o.c, c) && o.m.score === m.score);
    if (twin) twin.m.similar.push(c.room ?? c.title);
    else if (out.length < limit) out.push({ c, m: { ...m, similar: [] } });
  }
  return { matches: out.map((o) => o.m), ruled };
}

/** "2 hours" -> 2, "4 hours" -> 4, "24 hours" -> 24. */
export const hoursOf = (text: string | null) => (text ? Number(/(\d+)\s*hour/.exec(text)?.[1] ?? NaN) || null : null);
