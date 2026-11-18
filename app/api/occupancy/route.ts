import { cacheLife } from "next/cache";
import { connection } from "next/server";
import { combineLibrary, readLibrary, SENSORS } from "@/lib/occupancy";

// Every visitor shares one copy per library for five minutes, so NC State sees
// a handful of requests an hour, not one per visit.
async function occupancy(library: keyof typeof SENSORS) {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  const s = SENSORS[library];
  const { building, sensors } = await readLibrary(s); // thrown results are not cached, so the next visit retries
  return combineLibrary(s, building, sensors);
}

export async function GET(req: Request) {
  await connection(); // read at request time, never baked into the build
  const library = new URL(req.url).searchParams.get("library") ?? "hunt";
  if (!Object.hasOwn(SENSORS, library)) return Response.json({ error: "unknown library" }, { status: 404 });
  try {
    return Response.json(await occupancy(library as keyof typeof SENSORS));
  } catch (err) {
    console.error(err);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
