import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import SiteHeader from "@/components/SiteHeader";
import TrendsChart from "@/components/TrendsChart";
import { BusyDot } from "@/components/Busy";
import { summary, instant } from "@/lib/history";
import { recentHistory } from "@/lib/history-store";
import { BUILDING_ID, BUSY_LABEL, busyness } from "@/lib/occupancy";

export const metadata: Metadata = {
  title: "Trends — StudyScape",
  description: "How busy Hunt Library has been over the last week, from NC State's own sensors.",
};

const FORECAST_AFTER_DAYS = 14;
const tz = { timeZone: "America/New_York" } as const;
const when = new Intl.DateTimeFormat("en-US", { ...tz, weekday: "short", hour: "numeric", minute: "2-digit" });
const date = new Intl.DateTimeFormat("en-US", { ...tz, day: "numeric", month: "short", year: "numeric" });

export default function TrendsPage() {
  return (
    <>
      <SiteHeader current="/trends" />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-5 pb-16 pt-8 sm:px-10">
          <p className="annot text-pencil">James B. Hunt Jr. Library</p>
          <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.02em]">How busy Hunt gets</h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-graphite [text-wrap:pretty]">
            StudyScape saves NC State&apos;s sensor headcounts every 5 minutes. Here is the last week, for the whole building and each level.
          </p>
          <Suspense fallback={<div className="mt-8 h-[420px] animate-pulse rounded-xl bg-vellum/60" />}>
            <Trends />
          </Suspense>
        </div>
      </main>
    </>
  );
}

async function Trends() {
  await connection(); // read at request time, never baked into the build
  let h;
  try {
    h = await recentHistory();
  } catch (err) {
    console.error(err);
    return <p className="mt-8 rounded-xl bg-sheet p-5 text-[14px] text-graphite shadow-[inset_0_0_0_1px_var(--color-rule)]">The saved history can&apos;t be read right now. Live numbers are still on the map.</p>;
  }
  const now = h.readAt;
  const s = summary(h, now);
  const since = h.since ? instant(h.since, 0) : null;
  const days = since ? Math.floor((now - since) / 86_400_000) : 0;
  const forecastFrom = since ? since + FORECAST_AFTER_DAYS * 86_400_000 : null;
  const busy = s.latest?.share != null ? busyness(BUILDING_ID, s.latest.share) : null;

  return (
    <>
      <dl className="mt-8 grid gap-px overflow-hidden rounded-xl bg-rule sm:grid-cols-3">
        <Stat label="Now">
          {s.latest ? (
            <>
              <Big>{s.latest.count}</Big> people
              <Small>
                {busy && <BusyDot busy={busy} />}
                {s.latest.share != null && `${Math.round(s.latest.share * 100)}% full · `}
                {busy ? BUSY_LABEL[busy] : ""} · {when.format(s.latest.t)}
              </Small>
            </>
          ) : (
            <Small>No readings yet</Small>
          )}
        </Stat>
        <Stat label="Against yesterday, same time">
          {s.change !== null ? (
            <>
              <Big>{`${s.change > 0 ? "+" : ""}${s.change}%`}</Big>
              <Small>{s.yesterday} people then</Small>
            </>
          ) : (
            <Small>Shows once there&apos;s a full day of readings</Small>
          )}
        </Stat>
        <Stat label="Busiest this week">
          {s.peak ? (
            <>
              <Big>{s.peak.count}</Big> people
              <Small>{when.format(s.peak.t)}</Small>
            </>
          ) : (
            <Small>No readings yet</Small>
          )}
        </Stat>
      </dl>

      <TrendsChart h={h} now={now} />

      <p className="mt-6 max-w-2xl text-[12px] leading-relaxed text-pencil [text-wrap:pretty]">
        {since ? `Collecting since ${date.format(since)} (${days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"}`}). ` : ""}
        {forecastFrom && forecastFrom > now
          ? `Forecasts start once there are ${FORECAST_AFTER_DAYS} days of readings, around ${date.format(forecastFrom)}. `
          : ""}
        Counts come from NC State Libraries&apos; sensors; a sensor reading zero doesn&apos;t mean a space is empty. Gaps are times the sensors or StudyScape&apos;s collector didn&apos;t report.
      </p>
    </>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-sheet px-5 py-4">
      <dt className="text-[12px] font-medium text-pencil">{label}</dt>
      <dd className="mt-1 text-[14px] text-graphite">{children}</dd>
    </div>
  );
}

const Big = ({ children }: { children: React.ReactNode }) => <span className="plaque mr-1 text-[32px] font-semibold leading-none text-ink">{children}</span>;
const Small = ({ children }: { children: React.ReactNode }) => <span className="mt-1.5 flex items-center gap-1.5 text-[12px] text-pencil">{children}</span>;
