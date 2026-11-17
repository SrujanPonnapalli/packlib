"use client";

import { useEffect, useState } from "react";
import type { Occupancy } from "@/lib/occupancy";

const EVERY = 5 * 60 * 1000; // the server refreshes on the same beat

/**
 * Live headcounts. `data` is undefined while loading and null when they could
 * not be read; a failed refresh keeps the last good reading, whose age the page shows.
 * `now` ticks each minute for the "updated N min ago" label.
 */
export function useOccupancy() {
  const [data, setData] = useState<Occupancy | null>();
  const [now, setNow] = useState(0);
  useEffect(() => {
    let last = 0;
    let gone = false;
    const load = () => {
      last = Date.now();
      fetch("/api/occupancy")
        .then((r) => (r.ok ? (r.json() as Promise<Occupancy>) : null))
        .catch(() => null)
        .then((fresh) => !gone && setData((old) => fresh ?? old ?? null));
    };
    const tick = () => {
      setNow(Date.now());
      if (Date.now() - last > EVERY) load();
    };
    const visible = () => document.visibilityState === "visible" && tick();
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 60 * 1000);
    document.addEventListener("visibilitychange", visible);
    return () => {
      gone = true;
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  return { data, now };
}
