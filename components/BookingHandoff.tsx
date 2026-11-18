"use client";

import { useState } from "react";
import type { Space } from "@/data/kinds";
import { useLibrary } from "./LibraryContext";

// NC State's booking app (Mazévo, behind campus sign-in) ignores the URL, so
// there's no way to link straight to a room. Best we can do: open the booking
// site in a new tab, copy the room number, and list the clicks using the app's
// own wording (checked 17 Nov 2026).
const BOOKING_URL = "https://rooms.lib.ncsu.edu";
const GUIDELINES_URL = "https://www.lib.ncsu.edu/spaces/general-room-use-guidelines";

/** Which "type of space" to pick in the booking app, if we know it. */
function spaceType(s: Space) {
  if (s.kind === "study") return "Study Room";
  if (s.kind === "grad") return "Graduate Student Space";
  if (s.kind === "faculty") return "Faculty Space";
  if (/Media Studio|Audio/.test(s.title)) return "Digital Media Space";
  if (/^VR/.test(s.title)) return "VR Stations";
  return null;
}

export default function BookingHandoff({ space: s }: { space: Space }) {
  const lib = useLibrary();
  const [copied, setCopied] = useState(false);
  const type = spaceType(s);
  const name = s.room ?? s.title;

  const copy = () => {
    // if clipboard access is blocked the steps still say which room to look for
    navigator.clipboard?.writeText(name).then(() => setCopied(true), () => setCopied(false));
  };

  const rules = [
    s.bookAhead && `Book up to ${s.bookAhead} ahead`,
    s.maxBooking && `${s.maxBooking} at most`,
    "2 bookings a day, 30 in any 30 days",
  ].filter(Boolean);

  return (
    <section aria-labelledby="book-heading" className="mt-7 rounded-xl bg-sheet p-4 shadow-[inset_0_0_0_1px_var(--color-rule)]">
      <h3 id="book-heading" className="text-[15px] font-semibold">
        Book {s.room ? `room ${s.room}` : s.title} on NC State
      </h3>
      <p className="mt-1 text-[13px] leading-relaxed text-graphite">
        Bookings happen on the Libraries&apos; own site, which shows what&apos;s free. PackLib can&apos;t see that.
      </p>

      <ol className="mt-3 flex flex-col gap-2 text-[13px] leading-snug text-graphite">
        {[
          "Sign in with your Unity ID.",
          `Choose ${lib.name} Library, then ${type ? `“${type}”` : "the kind of space it is"}.`,
          `Find ${s.title} in the day's list${copied ? ": press ⌘F or Ctrl+F and paste to jump to it" : ""}. Grey blocks are taken; click a free time.`,
          "Arrive within 15 minutes of your start, or the room goes to someone else.",
        ].map((step, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="plaque grid size-5 shrink-0 place-items-center rounded-full bg-vellum text-[12px] font-semibold text-ink">{i + 1}</span>
            <span className="pt-px">{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <a
          href={BOOKING_URL}
          target="_blank"
          rel="noreferrer"
          onClick={copy}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-ink px-4 text-[14px] font-medium text-sheet transition-transform duration-150 ease-out-quint active:scale-[0.97]"
        >
          Open NC State booking
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M4.5 9.5 9.5 4.5M5 4.5h4.5V9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
        <span className="text-[12px] text-pencil" aria-live="polite">
          {copied ? (
            <>
              Copied <span className="plaque text-[13px] font-semibold text-ink">{name}</span> to paste into Find
            </>
          ) : (
            "Also copies the room number"
          )}
        </span>
      </div>

      <p className="mt-4 border-t border-rule-soft pt-3 text-[12px] leading-relaxed text-pencil">
        {rules.join(" · ")}.{" "}
        <a href={GUIDELINES_URL} target="_blank" rel="noreferrer" className="underline decoration-rule-strong underline-offset-2 hover:text-ink hover:decoration-ink">
          Room-use guidelines
        </a>
      </p>
    </section>
  );
}
