import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { isLibrary, levelName, libraryParams, LIBRARIES, type LibrarySlug } from "@/data/libraries";
import { libraryView } from "@/data/library-view";
import SiteHeader from "@/components/SiteHeader";
import TrendsChart from "@/components/TrendsChart";
import { BusyDot, Ticker } from "@/components/Busy";
import { summary, instant as instantOf, slot } from "@/lib/history";
import { recentHistory } from "@/lib/history-store";
import { BUSY_LABEL, busyness, SENSORS } from "@/lib/occupancy";

export async function generateMetadata({ params }: PageProps<"/[library]/trends">): Promise<Metadata> {
  const { library } = await params;
  const name = isLibrary(library) ? LIBRARIES[library].name : "the library";
  return {
    title: `${name} trends — PackLib`,
    description: `How busy ${name} Library has been over the last week, from NC State's own sensors.`,
  };
}

const FORECAST_AFTER_DAYS = 14;
const tz = { timeZone: "America/New_York" } as const;
const when = new Intl.DateTimeFormat("en-US", { ...tz, weekday: "short", hour: "numeric", minute: "2-digit" });
const date = new Intl.DateTimeFormat("en-US", { ...tz, day: "numeric", month: "short", year: "numeric" });

export const generateStaticParams = libraryParams;

// Reading params up front blocks navigation in theory; both libraries are prerendered, so not in practice.
export const instant = false;

export default async function TrendsPage({ params }: PageProps<"/[library]/trends">) {
  const { library } = await params;
  if (!isLibrary(library)) notFound();
  return (
    <>
      <SiteHeader library={library} current="trends" />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-5 pb-16 pt-8 sm:px-10">
          <p className="annot text-pencil">{LIBRARIES[library].full}</p>
          <h1 className="mt-2 text-[30px] [text-wrap:balance] font-semibold leading-tight tracking-[-0.02em]">How busy {LIBRARIES[library].name} gets</h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-graphite [text-wrap:pretty]">
            PackLib saves NC State&apos;s sensor headcounts every 5 minutes. Here is the last week, for the whole building and each {library === "hunt" ? "level" : "floor"}.
          </p>
          <Suspense fallback={<TrendsSkeleton />}>
            <Trends library={library} />
          </Suspense>
        </div>
      </main>
    </>
  );
}

async function Trends({ library }: { library: LibrarySlug }) {
  await connection(); // read at request time, never baked into the build
  let h;
  try {
    h = await recentHistory(library);
  } catch (err) {
    console.error(err);
    return <p className="mt-8 rounded-xl bg-sheet p-5 text-[14px] text-graphite shadow-[inset_0_0_0_1px_var(--color-rule)]">The saved history can&apos;t be read right now. Live numbers are still on the map.</p>;
  }
  const now = h.readAt;
  const s = summary(h, now);
  const since = h.since ? instantOf(h.since, 0) : null;
  const days = since ? Math.floor((now - since) / 86_400_000) : 0;
  const forecastFrom = since ? since + FORECAST_AFTER_DAYS * 86_400_000 : null;
  const busy = s.latest?.share != null ? busyness(SENSORS[library].building, s.latest.share) : null;

  const isPeak = !!(s.latest && s.peak && s.latest.count >= s.peak.count);
  // Today since midnight in Raleigh, for the little line beside the headcount.
  const today = s.latest ? slot(new Date(s.latest.t).toISOString()).day : null;
  const todays = h.t.flatMap((t, i) => (today && h.total[i] !== null && slot(new Date(t).toISOString()).day === today ? [{ t, c: h.total[i]! }] : []));
  // Up to two smaller cards beside Now; the week's high only when it isn't now.
  const others = [
    s.hourChange !== null && { label: "Over the last hour", body: <Change pct={s.hourChange} then={`${s.hourAgo!.toLocaleString("en-US")} people an hour ago`} /> },
    s.change !== null && { label: "Against yesterday, same time", body: <Change pct={s.change} then={`${s.yesterday!.toLocaleString("en-US")} people then`} /> },
    s.peak && !isPeak && {
      label: "Busiest this week",
      body: (
        <>
          <Ticker value={s.peak.count} from={0} ms={600} comma className={BIG_SM} /> <span>people</span>
          <Small>{when.format(s.peak.t)}</Small>
        </>
      ),
    },
  ]
    .filter((o) => !!o)
    .slice(0, 2);

  return (
    <>
      <dl className="mt-8 grid gap-px overflow-hidden rounded-xl bg-rule sm:grid-cols-2 lg:grid-cols-4">
        <div className="animate-enter bg-sheet px-5 py-5 sm:col-span-2">
          <dt className="flex items-center gap-2 text-[12px] font-medium text-pencil">
            Now
            {isPeak && <span className="rounded-full bg-[var(--color-packed)]/12 px-2 py-0.5 text-[11px] font-semibold text-packed-ink">Week&apos;s high</span>}
          </dt>
          <dd className="mt-1 flex items-end justify-between gap-6 text-[14px] text-graphite">
            {s.latest ? (
              <div>
                <Ticker value={s.latest.count} from={0} ms={700} comma className="plaque mr-1.5 text-[64px] font-semibold leading-none tracking-[-0.02em] text-ink" />
                <span>people</span>
                <Small>
                  {busy && <BusyDot busy={busy} />}
                  {s.latest.share != null && `${Math.round(s.latest.share * 100)}% full · `}
                  {busy ? BUSY_LABEL[busy] : ""} · {when.format(s.latest.t)}
                </Small>
              </div>
            ) : (
              <Small>No readings yet</Small>
            )}
            {todays.length > 1 && <TodayLine points={todays} />}
          </dd>
        </div>
        {others.map((o, i) => (
          <Stat key={o.label} label={o.label} i={i + 1} wide={others.length === 1}>
            {o.body}
          </Stat>
        ))}
      </dl>

      <TrendsChart h={h} now={now} place={chartPlace(library)} />

      {s.change === null && <Collecting days={days} />}
      <p className="mt-3 max-w-2xl animate-enter text-[12px] [animation-delay:240ms] leading-relaxed text-pencil [text-wrap:pretty]">
        {since ? `Collecting since ${date.format(since)} (${days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"}`}). ` : ""}
        {forecastFrom && forecastFrom > now
          ? `Forecasts start once there are ${FORECAST_AFTER_DAYS} days of readings, around ${date.format(forecastFrom)}. `
          : ""}
        Counts come from NC State Libraries&apos; sensors; a sensor reading zero doesn&apos;t mean a space is empty. Gaps are times the sensors or PackLib&apos;s collector didn&apos;t report.
      </p>
    </>
  );
}

function Stat({ label, i, wide, children }: { label: string; i: number; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`animate-enter bg-sheet px-5 py-5 ${wide ? "sm:col-span-2" : ""}`} style={{ animationDelay: `${i * 50}ms` }}>
      <dt className="text-[12px] font-medium text-pencil">{label}</dt>
      <dd className="mt-1 text-[14px] text-graphite">{children}</dd>
    </div>
  );
}

const BIG_SM = "plaque mr-1 text-[32px] font-semibold leading-none tracking-[-0.01em] text-ink";

/** Today's headcount so far, as a small line: the shape of the day at a glance. */
function TodayLine({ points }: { points: { t: number; c: number }[] }) {
  const W = 180;
  const H = 48;
  const t0 = points[0].t;
  const span = Math.max(points[points.length - 1].t - t0, 1);
  const max = Math.max(...points.map((p) => p.c), 1);
  const xy = points.map((p) => [((p.t - t0) / span) * W, H - 2 - (p.c / max) * (H - 4)] as const);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const [lx, ly] = xy[xy.length - 1];
  return (
    <figure className="hidden shrink-0 sm:block" aria-label="Today's headcount so far">
      <svg width={W} height={H} viewBox={`-2 0 ${W + 6} ${H}`} className="overflow-visible">
        <path d={`${d}L${W},${H}L0,${H}Z`} fill="var(--color-ink)" fillOpacity={0.05} />
        <path d={d} fill="none" stroke="var(--color-ink)" strokeWidth={1.5} strokeLinejoin="round" pathLength={1} className="draw" />
        <circle cx={lx} cy={ly} r={3} fill="var(--color-ink)" />
      </svg>
      <figcaption className="mt-1 text-right text-[11px] text-pencil">Today so far</figcaption>
    </figure>
  );
}

// Until there's a day to compare against, a thin line under the chart shows the history filling up toward forecasts.
function Collecting({ days }: { days: number }) {
  const n = Math.min(days + 1, FORECAST_AFTER_DAYS);
  return (
    <p className="mt-6 flex animate-enter flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-pencil [animation-delay:200ms]">
      <span className="font-medium text-graphite">
        Collecting history: day {n} of {FORECAST_AFTER_DAYS}
      </span>
      <span className="flex gap-[3px]" aria-hidden="true">
        {Array.from({ length: FORECAST_AFTER_DAYS }, (_, i) => (
          <span key={i} className={`h-2 w-1.5 rounded-[1px] ${i < n ? "bg-accent-deep" : "bg-rule-strong"}`} />
        ))}
      </span>
      <span>Comparisons from tomorrow, forecasts after day {FORECAST_AFTER_DAYS}.</span>
    </p>
  );
}

// A change in headcount: the number in ink, with a small arrow coloured like busyness (fewer people is good news).
function Change({ pct, then }: { pct: number; then: string }) {
  const tone = Math.abs(pct) < 1 ? "busy" : pct < 0 ? "quiet" : "packed";
  return (
    <>
      <span className="flex items-center gap-1.5">
        {tone !== "busy" && (
          <span className="text-[22px] font-semibold leading-none" style={{ color: `var(--color-${tone}-ink)` }} aria-hidden="true">
            {pct < 0 ? "↓" : "↑"}
          </span>
        )}
        {tone === "busy" ? (
          <span className={BIG_SM}>No change</span>
        ) : (
          <Ticker value={Math.abs(pct)} from={0} ms={600} suffix="%" className={BIG_SM} />
        )}
        <span className="sr-only">{pct < 0 ? "fewer" : "more"}</span>
      </span>
      <Small>{then}</Small>
    </>
  );
}

/** The shape of the page while the history loads: the same cells and chart frame, shimmering. */
function TrendsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the saved history">
      <div className="mt-8 grid gap-px overflow-hidden rounded-xl bg-rule sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`bg-sheet px-5 py-5 ${i === 0 ? "sm:col-span-2" : ""}`}>
            <div className="skeleton h-3 w-20 rounded" />
            <div className="skeleton mt-3 h-10 w-28 rounded-md" />
            <div className="skeleton mt-2.5 h-3 w-36 rounded" />
          </div>
        ))}
      </div>
      <div className="mt-10 flex items-center gap-3">
        <div className="skeleton h-3 w-64 max-w-[60%] rounded" />
        <div className="skeleton ml-auto h-8 w-[148px] rounded-full" />
      </div>
      <div className="skeleton mt-3 h-[320px] rounded-xl" />
    </div>
  );
}

const Small =({ children }: { children: React.ReactNode }) => <span className="mt-1.5 flex items-center gap-1.5 text-[12px] text-pencil">{children}</span>;

function chartPlace(library: LibrarySlug) {
  const lib = libraryView(library);
  const sensed = SENSORS[library].levels;
  const unsensed = lib.levels.find((l) => !(l.n in sensed));
  return {
    name: lib.name,
    levelNames: Object.fromEntries(lib.levels.map((l) => [l.n, levelName(lib, l.n)])),
    noSensor: unsensed ? levelName(lib, unsensed.n) : null,
  };
}
