import Image from "next/image";
import { KINDS, type Space } from "@/data/hunt";
import { BUSY_LABEL, STALE_MS, ago, people, zoneFor } from "@/lib/occupancy";
import { BusyDot, readingFor, type Live } from "./Busy";
import BookingHandoff from "./BookingHandoff";

const EVERYONE = ["Faculty", "Graduate Students", "Staff", "Students"];

function audience(list: string[]) {
  if (EVERYONE.every((x) => list.includes(x))) return "Students, faculty and staff";
  return list.join(", ");
}

// Some photo captions in the source are just file names.
const isCaption = (alt: string) => alt.length > 0 && !/\.(jpe?g|png)$/i.test(alt);

type Props = { space: Space; live: Live; onBack: () => void };

export default function SpaceDetail({ space: s, live, onBack }: Props) {
  const kind = KINDS.find((k) => k.id === s.kind)!.label;
  const facts: [string, string][] = [];
  if (s.level !== null) facts.push(["Level", String(s.level)]);
  if (s.reservableBy.length) facts.push([s.reservable ? "Who can reserve" : "Open to", audience(s.reservableBy)]);
  const seats = ["study", "grad", "faculty"].includes(s.kind) ? s.fitout?.seats : null;
  if (seats) facts.push(["Seats", String(seats)]);
  if (s.features.length) facts.push(["In the room", s.features.join(" · ")]);

  return (
    <article key={s.id} className="animate-enter px-5 pb-10 pt-4 sm:px-7">
      <button
        type="button"
        onClick={onBack}
        className="-ml-2 flex h-9 items-center gap-1 rounded-md px-2 text-[13px] font-medium text-graphite transition-colors duration-150 hover:bg-vellum hover:text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M10 3.5 5.5 8 10 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        All spaces
      </button>

      {s.photo && (
        <figure className="mt-3">
          <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-vellum outline outline-1 -outline-offset-1 outline-black/10">
            <Image
              src={s.photo.src}
              alt={isCaption(s.photo.alt) ? s.photo.alt : s.title}
              fill
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover"
              priority
            />
          </div>
          {isCaption(s.photo.alt) && (
            <figcaption className="mt-2 text-[12px] leading-relaxed text-pencil [text-wrap:pretty]">{s.photo.alt}</figcaption>
          )}
        </figure>
      )}

      <header className="mt-6 flex items-start gap-4">
        {s.room && (
          <span className="plaque mt-0.5 rounded-lg bg-accent px-2.5 py-1.5 text-[26px] font-semibold leading-none">
            {s.room}
          </span>
        )}
        <div className="min-w-0">
          <p className="annot text-pencil">{s.room ? "Hunt Library" : kind}</p>
          <h2 className="mt-1 text-[22px] font-semibold leading-tight tracking-[-0.01em] [text-wrap:balance]">
            {s.room ? s.title.replace(` ${s.room}`, "") : s.title}
          </h2>
        </div>
      </header>

      {s.description && (
        <p className="mt-4 text-[14px] leading-relaxed text-graphite [text-wrap:pretty]">
          {s.description.length > 320 ? `${s.description.slice(0, 320).replace(/\s+\S*$/, "")}…` : s.description}
        </p>
      )}

      <dl className="mt-6 border-t border-rule">
        <NowRow space={s} live={live} />
        {facts.map(([label, value]) => (
          <div key={label} className="flex gap-4 border-b border-rule-soft py-3 text-[14px]">
            <dt className="w-32 shrink-0 text-pencil">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {(seats || s.features.length > 0) && (
        <p className="mt-2 text-[12px] text-pencil">Seats and room features are read from the Libraries&apos; photo captions.</p>
      )}

      {s.reservable && <BookingHandoff space={s} />}

      <div className="mt-6 flex flex-wrap gap-2">
        {s.url && (
          <a
            href={s.url}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-[14px] font-medium transition-[background-color,transform] duration-150 ease-out-quint active:scale-[0.97] ${
              s.reservable ? "shadow-[inset_0_0_0_1px_var(--color-rule-strong)] hover:bg-vellum" : "bg-ink text-sheet"
            }`}
          >
            {s.reservable ? "About this room on NC State" : "View on NC State Libraries"}
            <Arrow />
          </a>
        )}
        {s.requestUrl && (
          <a
            href={s.requestUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-[14px] font-medium shadow-[inset_0_0_0_1px_var(--color-rule-strong)] transition-colors duration-150 hover:bg-vellum"
          >
            Request this space
            <Arrow />
          </a>
        )}
      </div>
    </article>
  );
}

/** How busy it is right now: its own sensor zone if it has one, otherwise the whole level. */
function NowRow({ space, live }: { space: Space; live: Live }) {
  const { data, now } = live;
  if (data === undefined || space.level === null) return null;
  const found = readingFor(live, space);
  const r = found?.reading;
  let value: React.ReactNode;
  let note: string | null = null;
  if (data === null) value = <span className="font-normal text-pencil">Live headcounts unavailable</span>;
  else if (!r || r.busy === null) value = <span className="font-normal text-pencil">{found?.own ? "Its people sensor is off right now" : `No people sensor on Level ${space.level}`}</span>;
  else {
    value = (
      <span className="flex items-center gap-1.5">
        <BusyDot busy={r.busy} />
        {found.own ? BUSY_LABEL[r.busy] : `Level ${space.level} is ${BUSY_LABEL[r.busy].toLowerCase()}`}
        <span className="font-normal text-graphite">· {people(r.count)}</span>
      </span>
    );
    const zone = found.own ? zoneFor(data, space.room ?? space.title) : null;
    note = [
      !found.own && "This room has no sensor of its own.",
      zone && zone.refs.length > 1 && `Counted as one zone: ${zone.name}.`,
      `Updated ${ago(data.at, now)}${now - Date.parse(data.at) > STALE_MS ? ", may be out of date" : ""}.`,
    ]
      .filter(Boolean)
      .join(" ");
  }
  return (
    <div className="flex gap-4 border-b border-rule-soft py-3 text-[14px]">
      <dt className="w-32 shrink-0 text-pencil">Right now</dt>
      <dd className="min-w-0 font-medium">
        {value}
        {note && <span className="mt-0.5 block text-[12px] font-normal text-pencil">{note}</span>}
      </dd>
    </div>
  );
}

function Arrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M4.5 9.5 9.5 4.5M5 4.5h4.5V9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
