/** The libraries StudyScape covers, by URL slug. Hill joins in H4, once its floors are traced. */
export const LIBRARIES = {
  hunt: { name: "Hunt Library", full: "James B. Hunt Jr. Library" },
} as const;

export type LibrarySlug = keyof typeof LIBRARIES;

export const isLibrary = (slug: string): slug is LibrarySlug => Object.hasOwn(LIBRARIES, slug);

export const libraryParams = () => Object.keys(LIBRARIES).map((library) => ({ library }));
