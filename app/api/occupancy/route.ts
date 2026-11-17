import { cacheLife } from "next/cache";
import { connection } from "next/server";
import { combine, readHunt } from "@/lib/occupancy";

// Every visitor shares one copy for five minutes, so NC State sees a handful
// of requests an hour, not one per visit.
async function huntOccupancy() {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  const { building, levels } = await readHunt(); // thrown results are not cached, so the next visit retries
  return combine(building, levels);
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
