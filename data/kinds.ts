// Shared by both libraries and safe for the browser: no space data in here.
import type { Fitout } from "@/lib/furnish";

export type Kind = "study" | "open" | "grad" | "faculty" | "studio" | "service";

/** One space as scripts/snapshot-spaces.mjs writes it, for either library. */
type Snapshotted = {
  id: string;
  title: string;
  room: string | null;
  description: string | null;
  url: string;
  photo: { src: string; thumb: string; alt: string } | null;
  reservableBy: string[];
  bookAhead: string | null;
  maxBooking: string | null;
  requestUrl: string | null;
};

export type Space = Snapshotted & {
  level: number | null;
  kind: Kind;
  /** True when the Libraries list booking rules for it. */
  reservable: boolean;
  /** Read from the photo caption; null when there is no photo. */
  fitout: Fitout | null;
  /** Official count from the booking site where it lists one, else the photo caption's. */
  seats: number | null;
  seatsFrom: "booking" | "caption" | null;
  /** Human-readable fit-out, shown only for bookable rooms. */
  features: string[];
};

export const KINDS: { id: Kind; label: string }[] = [
  { id: "study", label: "Study rooms" },
  { id: "open", label: "Open seating" },
  { id: "grad", label: "Graduate" },
  { id: "faculty", label: "Faculty" },
  { id: "studio", label: "Labs & halls" },
  { id: "service", label: "Services" },
];
