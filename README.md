# PackLib

Live at [packlib.srujanponnapalli.com](https://packlib.srujanponnapalli.com).

PackLib helps NC State students find a place to study in D. H. Hill Jr. and James B. Hunt Jr. libraries. It shows how busy each floor and reading room is right now on a 3D model of the building, and suggests spaces that suit how you want to work, who you're with, and how long you'll stay.

It's an independent student project. NC State Libraries didn't make it and isn't affiliated with it.

## What it does

- NC State Libraries publishes readings from people-counting sensors. PackLib reads them every five minutes and labels each floor and area not busy, busy or very busy, using the libraries' own thresholds.
- Each library has a 3D model, with every floor's rooms, stairs and elevators traced by hand from the official floor maps. Busy areas are shaded, and when you zoom in, each area fills with figures matching its headcount. Phones get a flat stack of floors instead.
- Study Match ranks the spaces you're allowed to use. You tell it whether you're an undergrad, grad student or faculty member, how you want to work and for how long, and each pick comes with a short reason. A space you can't book, or one too small for your group, is ruled out however well it scores otherwise.
- For a bookable room, PackLib opens NC State's booking site and copies the room number for you.
- A small AWS collector saves every reading, and each library's Trends page shows today's numbers alongside the history so far. Forecasts switch on once there are 14 days of data.

## How it works

```
NC State sensors ──► /api/occupancy (Next.js, cached 5 min) ──► the explorer
        │
        └──► AWS Lambda every 5 min ──► DynamoDB ──► history API ──► Trends
NC State Spaces API ──► npm run snapshot ──► data/*-spaces.json
```

- Occupancy comes from NC State's realtime endpoint. The site's own API route caches it, so visitors never call NC State directly and one request per library serves everyone.
- Space details (names, room numbers, photos, who can book) come from NC State's public Spaces API. A script saves a trimmed snapshot into `data/`, so the site keeps working when that API is down.
- Floor geometry lives in `data/hunt-geometry.ts` and `data/hill-geometry.ts`. Coordinates are pixels on the official maps, and the floors are lined up with each other using the stairs and elevators.
- History comes from `collector/`, an AWS SAM template with two Lambda functions. One saves readings to DynamoDB on a schedule and the other serves them to the Trends page.

## Running it locally

Requires Node 20.9 or later (CI uses Node 24).

```bash
npm install
npm run dev
```

Then open [localhost:3000](http://localhost:3000). The site reads live occupancy and the deployed history API, so you don't need any keys or setup.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm test` | Run the tests (Node's built-in test runner) |
| `npm run lint` | Lint with ESLint |
| `npm run build` | Production build |
| `npm run snapshot` | Refresh Hunt's spaces from the Spaces API (`-- --library hill` for Hill) |

Set `HISTORY_URL` to use your own history API. Deploying the collector takes an AWS account and the AWS CLI; `scripts/deploy-collector.sh` does the rest.

`main` is what's live. Work goes into `development` first, and pull requests should target it. Every push to `development` gets a Vercel preview, and it's merged into `main` to release.

## Project layout

```
app/          routes: /hill, /hunt, their /trends pages, and /api/occupancy
components/   the explorer, 3D scene, Study Match, trends chart
lib/          occupancy, matching, history, and furniture layout logic, with tests
data/         per-library config, space snapshots, traced floor geometry
collector/    AWS Lambda collector and history API (SAM template)
scripts/      spaces snapshot and collector deploy
```

## Built with

Next.js, React, TypeScript, Tailwind CSS, Three.js with React Three Fiber, Vercel, and AWS Lambda, DynamoDB and EventBridge Scheduler.

## Caveats

- A reading of zero may just mean a sensor is offline.
- Booking availability isn't public, so PackLib can't tell you whether a room is free.
- The floor models are traced by eye and aren't to scale.
