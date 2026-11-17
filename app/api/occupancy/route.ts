import { cacheLife } from "next/cache";
import { connection } from "next/server";
import { combine, readHunt } from "@/lib/occupancy";

// cached for 5 minutes and shared by everyone, so NC State only gets a few
// requests an hour instead of one per visit.
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
