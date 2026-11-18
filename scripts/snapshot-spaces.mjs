// Fetches NC State's public Spaces API (6 MB, all libraries) and writes a
// trimmed one-library snapshot. Run by hand: `npm run snapshot` (Hunt) or
// `npm run snapshot -- --library hill`.
import { writeFile } from "node:fs/promises";

const arg = process.argv.indexOf("--library");
const library = arg >= 0 ? process.argv[arg + 1] : "hunt";
if (!/^[a-z-]+$/.test(library ?? "")) throw new Error("--library needs a slug like hill");

const API = "https://www.lib.ncsu.edu/api/spaces/everything.json";

const text = (html) =>
  String(html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&rsquo;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const res = await fetch(API, { headers: { "user-agent": "studyscape-snapshot" } });
if (!res.ok) throw new Error(`Spaces API responded ${res.status}`);
const all = await res.json();
if (!Array.isArray(all)) throw new Error("Spaces API did not return a list");

const spaces = all
  .filter((s) => s?.building?.short_name === library && s.nid && s.title)
  .map((s) => {
    const photo = (s.photography ?? []).find((p) => p?.original);
    const room = /^(\d{4}|[BG]\d{3})[A-Z]?$/.test(s.room_number ?? "") ? s.room_number : null;
    return {
      id: String(s.nid),
      title: text(s.title),
      room,
      description: text(s.description) || null,
      url: /href="([^"]+)"/.exec(s.name ?? "")?.[1] ?? null,
      photo: photo
        ? { src: photo.original, thumb: photo.thumbnail || photo.original, alt: text(photo.alt_text) }
        : null,
      reservableBy: text(s.reservable_by)
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .sort(),
      bookAhead: s.days_in_advance || null,
      maxBooking: s.reserve_up_to_x_hours || null,
      requestUrl: s.request_url || null,
    };
  })
  .sort((a, b) => a.title.localeCompare(b.title, "en", { numeric: true }));

if (spaces.length < 50) throw new Error(`Only ${spaces.length} ${library} spaces found; refusing to overwrite`);

const out = new URL(`../data/${library}-spaces.json`, import.meta.url);
await writeFile(out, JSON.stringify({ fetchedAt: new Date().toISOString(), source: API, spaces }, null, 1) + "\n");
console.log(`Wrote ${spaces.length} ${library} spaces`);
