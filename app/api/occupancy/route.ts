import { cacheLife } from "next/cache";
import { connection } from "next/server";
import { BUILDING_ID, LEVEL_IDS, SOURCE, combine } from "@/lib/occupancy";

async function read(id: number) {
  const res = await fetch(`${SOURCE}?id=${id}&library=hunt`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`occupancy ${id}: HTTP ${res.status}`);
  return res.json();
}

// 5 requests cover all of Hunt. cached for 5 minutes and shared by everyone, so
// NC State only gets a few requests an hour instead of one per visit.
async function huntOccupancy() {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  const levels = Object.entries(LEVEL_IDS);
  const [building, ...rest] = await Promise.allSettled([read(BUILDING_ID), ...levels.map(([, id]) => read(id))]);
  if (building.status === "rejected") throw building.reason; // thrown results are not cached, so the next visit retries
  return combine(building.value, Object.fromEntries(levels.map(([n], i) => [n, rest[i].status === "fulfilled" ? rest[i].value : null])));
}

export async function GET() {
  await connection(); // read at request time, never baked into the build
  try {
    return Response.json(await huntOccupancy());
  } catch (err) {
    console.error(err);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
