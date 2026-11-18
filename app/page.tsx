import SiteHeader from "@/components/SiteHeader";
import LibraryPicker from "@/components/LibraryPicker";
import { libraryView } from "@/data/library-view";

const BLURB = {
  hunt: "Five levels of reading rooms, commons and bookable rooms on Centennial Campus.",
  hill: "Wide lower floors under a tall tower of carrels and study rooms, on North Campus.",
} as const;

export default function Home() {
  const cards = (["hunt", "hill"] as const).map((slug) => {
    const lib = libraryView(slug);
    return { slug, name: lib.name, full: lib.full, blurb: BLURB[slug], spaces: lib.spaces.length, floors: `${lib.levels.length} ${lib.floorWord.toLowerCase()}s` };
  });
  return (
    <>
      <SiteHeader />
      <main className="dot-grid flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-5 pb-16 pt-10 sm:px-10 sm:pt-16">
          <p className="annot arrive text-pencil">An independent NC State study-space explorer</p>
          <h1 className="arrive mt-2 text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] [--d:60ms] [text-wrap:balance] sm:text-[40px]">Which library?</h1>
          <p className="arrive mt-2 max-w-xl text-[14px] leading-relaxed text-graphite [--d:100ms]">
            Live headcounts from NC State&apos;s own sensors, every room on a 3D map, and a match for what you came to do.
          </p>
          <LibraryPicker cards={cards} />
        </div>
      </main>
    </>
  );
}
