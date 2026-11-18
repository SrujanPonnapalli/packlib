// Reads the collector's history from the AWS history function (collector/history-api.mjs),
// server only. Cached for 5 minutes and shared by everyone, same as the live
// occupancy route.

import { cacheLife } from "next/cache";
import type { History } from "./history.ts";

// public on purpose, it only serves NC State's public headcounts. scripts/deploy-collector.sh prints it
const URL = process.env.HISTORY_URL ?? "https://wfy7nvbfmkz2weglunienmbp7a0tdwjk.lambda-url.us-east-2.on.aws/";

/** The building and its levels over the last week. */
export async function recentHistory(library: "hunt" | "hill"): Promise<History> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  const res = await fetch(library === "hunt" ? URL : `${URL}?library=${library}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`history function answered ${res.status}`);
  return res.json();
}
