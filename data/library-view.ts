// Server only: builds what a library's pages get. Importing a library's data
// here (not in client components) keeps Hill's spaces and floors off Hunt's pages.
import { LIBRARIES, type LibrarySlug, type LibraryView } from "./libraries";
import type { Floor, Pt } from "./hunt-geometry";
import { FLOORS as HUNT_FLOORS } from "./hunt-geometry";
import { LEVELS as HUNT_LEVELS, spaces as huntSpaces } from "./hunt";
import { FLOORS as HILL_FLOORS } from "./hill-geometry";
import { LEVELS as HILL_LEVELS, spaces as hillSpaces } from "./hill";

const HUNT_FOOTPRINT: Record<number, [number, number]> = { 1: [230, 100], 2: [250, 100], 3: [250, 100], 4: [250, 100], 5: [150, 100] };
// Hill: a basement and ground floor under the tower, three wide floors, then the narrow tower.
const hillFootprint = (n: number): [number, number] => (n <= 0 ? [120, 80] : n <= 2 ? [250, 100] : n === 3 ? [170, 90] : [110, 90]);

// Hill is traced on its own Floor 1 map (3392 px wide, about 17 px a metre);
// the 3D model is built for Hunt's (2000 px, about 11 px a metre, centred on 1005, 451).
const HILL_SCALE = 0.62;
const HILL_CENTRE: Pt = [1670, 765];
const toHunt = ([x, y]: Pt): Pt => [Math.round((x - HILL_CENTRE[0]) * HILL_SCALE + 1005), Math.round((y - HILL_CENTRE[1]) * HILL_SCALE + 451)];
const rescale = (f: Floor): Floor => ({
  ...f,
  plate: f.plate.map(toHunt),
  extra: f.extra?.map((p) => p.map(toHunt)),
  shapes: f.shapes.map((s) => ({ ...s, poly: s.poly.map(toHunt), at: s.at && toHunt(s.at) })),
});

export function libraryView(slug: LibrarySlug): LibraryView {
  if (slug === "hunt")
    return {
      slug,
      ...LIBRARIES.hunt,
      floorWord: "Level",
      levels: HUNT_LEVELS.map((l) => ({ ...l, label: String(l.n), footprint: HUNT_FOOTPRINT[l.n] })),
      spaces: huntSpaces,
      floors: HUNT_FLOORS,
      rise: 5,
    };
  return {
    slug,
    ...LIBRARIES.hill,
    floorWord: "Floor",
    levels: HILL_LEVELS.map((l) => ({ ...l, footprint: hillFootprint(l.n) })),
    spaces: hillSpaces,
    floors: Object.fromEntries(Object.entries(HILL_FLOORS).map(([n, f]) => [n, rescale(f)])),
    rise: 3.6,
  };
}
