// The libraries PackLib covers (by URL slug) and the shape of the data a page
// gets for one. Safe for the browser: the actual data is built on the server
// (data/library-view.ts) and passed down, so a page only loads its own library.
import type { Floor } from "./hunt-geometry";
import type { Space } from "./kinds";

// Hill first since the site opens on it, and it's first in the header switch
export const LIBRARIES = {
  hill: { name: "Hill", full: "D. H. Hill Jr. Library" },
  hunt: { name: "Hunt", full: "James B. Hunt Jr. Library" },
} as const;

export type LibrarySlug = keyof typeof LIBRARIES;

export const isLibrary = (slug: string): slug is LibrarySlug => Object.hasOwn(LIBRARIES, slug);

export const libraryParams = () => Object.keys(LIBRARIES).map((library) => ({ library }));

export type LevelInfo = {
  n: number;
  /** What the building calls it, e.g. "3", "G", "B". */
  label: string;
  landmark: string;
  /** Rough [length, depth] for the phone stack, not to scale. */
  footprint: [number, number];
};

export type LibraryView = {
  slug: LibrarySlug;
  name: string;
  full: string;
  /** "Level 3" in Hunt, "Floor 3" in Hill. */
  floorWord: "Level" | "Floor";
  /** Top floor first. */
  levels: LevelInfo[];
  spaces: Space[];
  /** Geometry in Hunt's map coordinates (Hill's gets rescaled to match), keyed by level. */
  floors: Record<number, Floor>;
  /** Floor-to-floor spacing on the 3D model. */
  rise: number;
};

export const levelName = (lib: LibraryView, n: number) => `${lib.floorWord} ${lib.levels.find((l) => l.n === n)?.label ?? n}`;

/** Geometry links to a space by room number, or by title if it doesn't have one. */
export const spaceByRef = (lib: LibraryView, ref: string) => lib.spaces.find((s) => s.room === ref) ?? lib.spaces.find((s) => s.title === ref);
