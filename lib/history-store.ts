// Reads the collector's history from the AWS history function (collector/history-api.mjs),
// on the server only. Every visitor shares one read for five minutes, like the
// live occupancy route.

import { cacheLife } from "next/cache";
import type { History } from "./history.ts";

// Public by design: it serves NC State's public headcounts. Printed by scripts/deploy-collector.sh.
const URL = process.env.HISTORY_URL ?? "https://wfy7nvbfmkz2weglunienmbp7a0tdwjk.lambda-url.us-east-2.on.aws/";

/** The building and its levels over the last week. */
export async function recentHistory(): Promise<History> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  const res = await fetch(URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`history function answered ${res.status}`);
  return res.json();
}
