import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { BusyDot } from "@/components/Busy";
import Arrow from "@/components/Arrow";
import Reveal from "@/components/Reveal";
import Toc from "./Toc";
import { BUILDING_ID, BUSY_LABEL, cutoffs, HILL_SENSORS, LEVEL_IDS, SOURCE, type Busy } from "@/lib/occupancy";

export const metadata: Metadata = {
  title: "About — PackLib",
  description: "How PackLib reads NC State's library sensors and decides how busy a space is.",
};

const REPO = "https://github.com/SrujanPonnapalli/packlib";

const SECTIONS = [
  { id: "data", title: "Where the numbers come from", short: "Data source" },
  { id: "busy", title: "Not busy, busy, very busy", short: "Busyness labels" },
  { id: "history", title: "History and trends", short: "History" },
  { id: "models", title: "The 3D models", short: "3D models" },
  { id: "built", title: "How it's built", short: "How it's built" },
] as const;

const link = "font-medium text-ink underline decoration-rule-strong underline-offset-[3px] transition-colors duration-150 hover:decoration-ink";

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-10 sm:pt-14">
          <header className="max-w-2xl">
            <h1 className="text-[44px] font-semibold leading-[0.95] tracking-[-0.03em] [font-stretch:82%] [text-wrap:balance] sm:text-[56px]">
              How PackLib works
            </h1>
            <p className="mt-4 text-[16px] leading-relaxed text-graphite [text-wrap:pretty]">
              Every headcount on PackLib comes from NC State Libraries&apos; own sensors. PackLib is a student project, and the libraries didn&apos;t
              make it and aren&apos;t affiliated with it.
            </p>
          </header>

          <div className="mt-12 lg:grid lg:grid-cols-[160px_minmax(0,1fr)] lg:gap-14">
            <Toc sections={SECTIONS} />

            <article className="min-w-0">
              <Section id="data">
                <p>
                  NC State Libraries counts people with sensors around Hunt and Hill and shows the results on its own occupancy pages. Those pages read
                  from a public endpoint, and PackLib reads the same one. Each reading gives a headcount and the share of the area&apos;s seats in
                  use.
                </p>
                <Reading />
                <p>
                  The site asks for fresh numbers at most every five minutes and caches them, so one request to NC State serves everyone looking at the
                  same library. Hill splits Floors 1 and 2 into three wing sensors each, and PackLib adds those up, using each wing&apos;s seat count to
                  work out how full the whole floor is.
                </p>
              </Section>

              <Section id="busy">
                <p>
                  PackLib uses the same cut-offs as NC State&apos;s own pages, so the labels match theirs. Most areas follow the first scale. A few have
                  their own, like Hill&apos;s carrel floors, which stay not busy for longer, and Hunt&apos;s Level 3, which tips over sooner.
                </p>
                <Scales />
                <p>
                  A reading of zero can just mean a sensor is offline, and some areas, like Hunt&apos;s Level 1, have no sensor at all. Those show as
                  having no reading instead of being empty.
                </p>
              </Section>

              <Section id="history">
                <p>
                  A small collector on AWS saves every library&apos;s readings every five minutes, starting 17 November 2026. The Trends page shows the
                  last week of them for the whole building and each floor.
                </p>
                <p>
                  The dashed &ldquo;typical&rdquo; line is the median headcount at the same time of day over up to seven earlier days. It appears once at
                  least three of those days have a reading, so it gets steadier as more history builds up. PackLib doesn&apos;t forecast future busyness
                  yet.
                </p>
              </Section>

              <Section id="models">
                <p>
                  Each floor of both libraries is traced by hand from NC State&apos;s floor maps, down to the stairs and elevators, which also line the
                  floors up with each other. The models aren&apos;t to scale. Busy areas are shaded, and when you zoom in each area fills with figures
                  matching its headcount.
                </p>
                <p>Room details like names, photos and who can book them come from NC State&apos;s public Spaces API.</p>
              </Section>

              <Section id="built">
                <p>
                  The site is built with Next.js, React and TypeScript and styled with Tailwind CSS. The 3D models use Three.js through React Three
                  Fiber, and the whole site runs on Vercel. The collector is two AWS Lambda functions: EventBridge Scheduler runs one every five minutes to save readings to
                  DynamoDB, and the other serves that history to the Trends page.
                </p>
                <Pipeline />
                <p>
                  Page views are counted with Vercel Web Analytics, which doesn&apos;t use cookies. The code is{" "}
                  <a href={REPO} className={link}>
                    on GitHub
                  </a>
                  .
                </p>
              </Section>

              <nav aria-label="Back to the libraries" className="mt-16 flex flex-wrap gap-2 border-t border-rule pt-8">
                {(["hunt", "hill"] as const).map((slug) => (
                  <Link
                    key={slug}
                    href={`/${slug}/trends`}
                    className="group inline-flex items-center gap-1.5 rounded-md bg-vellum px-3 py-2 text-[13px] font-medium text-graphite transition-colors duration-150 hover:text-ink active:scale-[0.98]"
                  >
                    {slug === "hunt" ? "Hunt" : "Hill"} trends
                    <Arrow />
                  </Link>
                ))}
              </nav>
            </article>
          </div>
        </div>
      </main>
    </>
  );
}

function Section({ id, children }: { id: (typeof SECTIONS)[number]["id"]; children: React.ReactNode }) {
  const title = SECTIONS.find((s) => s.id === id)!.title;
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-8 border-t border-rule pt-8 [&+&]:mt-14 first:border-t-0 first:pt-0">
      <h2 id={`${id}-h`} className="text-[22px] font-semibold leading-tight tracking-[-0.015em] text-ink">
        {title}
      </h2>
      <div className="mt-4 max-w-[68ch] space-y-4 text-[15px] leading-[1.7] text-graphite [text-wrap:pretty]">{children}</div>
    </section>
  );
}

// a real reading (Hunt's Quiet Reading Room, 19 Nov 2026). the two fields PackLib uses are marked
const FIELDS: [string, string | number | boolean | null, boolean?][] = [
  ["id", 1342],
  ["name", "Quiet Reading Room"],
  ["count", 53, true],
  ["percentage", 0.34, true],
  ["timestamp", "2026-11-19T19:14:34.866Z"],
  ["isActive", true],
  ["childCounts", null],
];

function Reading() {
  return (
    <Reveal className="my-7! max-w-[34rem]">
      <figure className="overflow-hidden rounded-xl bg-sheet shadow-lift">
        <div className="flex items-center gap-2 border-b border-rule px-4 py-2.5 font-mono text-[12px]">
          <span className="font-semibold text-accent-deep">GET</span>
          <a href={`${SOURCE}?id=1342&library=hunt`} className="truncate text-pencil transition-colors duration-150 hover:text-ink">
            lib.ncsu.edu/space-occupancy/realtime-data.php?id=1342
          </a>
        </div>
        <pre className="overflow-x-auto py-3 font-mono text-[12.5px] leading-[1.75] text-pencil">
          <code>
            <span className="block px-4">{"{"}</span>
            {FIELDS.map(([k, v, used], i) => (
              <span key={k} className={`relative block px-4 ${used ? "text-ink" : ""}`}>
                {used && <span aria-hidden="true" className="reveal-x absolute inset-0 bg-accent-wash/70" style={{ "--d": `${200 + (i - 2) * 120}ms` } as React.CSSProperties} />}
                <span className="relative">
                  {"  "}
                  <span className={used ? "font-semibold" : "text-graphite"}>&quot;{k}&quot;</span>: <Value v={v} />
                  {i < FIELDS.length - 1 ? "," : ""}
                </span>
              </span>
            ))}
            <span className="block px-4">{"}"}</span>
          </code>
        </pre>
        <figcaption className="sr-only">An example reading from NC State&apos;s sensor endpoint. PackLib uses the count and percentage fields.</figcaption>
      </figure>
    </Reveal>
  );
}

function Value({ v }: { v: string | number | boolean | null }) {
  if (typeof v === "string") return <span className="text-ink">&quot;{v}&quot;</span>;
  if (typeof v === "number") return <span className="text-accent-deep">{v}</span>;
  return <span className="text-faint">{String(v)}</span>;
}

const SCALES = [
  { label: "Most areas", id: BUILDING_ID },
  { label: "Hill, carrel floors 4–9", id: HILL_SENSORS.levels[4][0] },
  { label: "Hunt, Level 3", id: LEVEL_IDS[3] },
];

const pct = (n: number) => `${Math.round(n)}%`;

/** The cut-offs drawn as hatched bars, straight from lib/occupancy so they can't drift. */
function Scales() {
  return (
    <Reveal className="my-7!">
      <figure>
        <div className="space-y-4">
          {SCALES.map(({ label, id }, row) => {
            const [q, b] = cutoffs(id);
            const bands: [Busy, number, number][] = [
              ["quiet", 0, q],
              ["busy", q, b],
              ["packed", b, 100],
            ];
            return (
              <div key={label} className="grid gap-1.5 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center sm:gap-5">
                <span className="text-[13px] font-medium text-ink">{label}</span>
                <div>
                  <div className="reveal-x flex h-3.5 overflow-hidden rounded-[3px] shadow-[inset_0_0_0_1px_var(--color-rule)]" style={{ "--d": `${row * 140}ms` } as React.CSSProperties} role="img" aria-label={`${label}: not busy up to ${pct(q)}, busy up to ${pct(b)}, very busy above`}>
                    {bands.map(([busy, from, to]) => (
                      <span key={busy} className={`hatch-${busy} h-full`} style={{ width: `${to - from}%` }} />
                    ))}
                  </div>
                  <div className="reveal-up relative mt-1 h-4 text-[11px] tabular-nums text-pencil" style={{ "--d": `${row * 140 + 450}ms` } as React.CSSProperties} aria-hidden="true">
                    <span className="absolute left-0">0</span>
                    <span className="absolute -translate-x-1/2" style={{ left: `${q}%` }}>{pct(q)}</span>
                    <span className="absolute -translate-x-1/2" style={{ left: `${b}%` }}>{pct(b)}</span>
                    <span className="absolute right-0">100%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <figcaption className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-graphite sm:pl-[180px]">
          {(Object.keys(BUSY_LABEL) as Busy[]).map((b) => (
            <span key={b} className="inline-flex items-center gap-1.5">
              <BusyDot busy={b} />
              {BUSY_LABEL[b]}
            </span>
          ))}
          <span className="text-pencil">Share of seats taken</span>
        </figcaption>
      </figure>
    </Reveal>
  );
}

const LANES = [
  { label: "Live", steps: ["NC State sensors", "/api/occupancy, cached 5 min", "Map and Study Match"] },
  { label: "History", steps: ["NC State sensors", "Lambda, every 5 min", "DynamoDB", "History API", "Trends"] },
  { label: "Rooms", steps: ["NC State Spaces API", "Snapshot script", "Saved room details"] },
];

/** How data moves through the site, one lane per source. */
function Pipeline() {
  return (
    <Reveal className="my-7!">
      <figure className="space-y-3" aria-label="How data moves through PackLib">
        {LANES.map((lane, l) => (
          <div key={lane.label} className="rounded-xl bg-vellum/60 p-3">
            <span className="annot mb-2.5 block text-pencil">{lane.label}</span>
            <ol className="flex flex-col items-start sm:flex-row sm:flex-wrap sm:items-center">
              {lane.steps.map((step, i) => (
                <li key={step} className="flex flex-col items-start sm:flex-row sm:items-center" style={{ "--d": `${l * 180 + i * 90}ms` } as React.CSSProperties}>
                  {i > 0 && <span aria-hidden="true" className="reveal-x ml-4 h-3 w-px bg-rule-strong sm:ml-0 sm:h-px sm:w-4" />}
                  <span className={`reveal-up rounded-md bg-sheet px-2.5 py-1.5 text-[12.5px] leading-tight shadow-lift ${i === lane.steps.length - 1 ? "font-semibold text-ink" : "text-graphite"}`}>
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </figure>
    </Reveal>
  );
}
