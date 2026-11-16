# StudyScape: Product Strategy for a Next-Generation NC State Library Space Finder

**Research date: November 16, 2026.** The recommendation is to build this—but not as “a nicer version of the library busyness dashboard.” The strongest product is a **task-first study-space decision engine with a spatial 3D interface**: tell it *who you are with, when you need a place, and what kind of environment you want*, and it should tell you where to go, why, when the room is available, and how to book it.

The reference project at `lib-occupancy.brendonhab.com` is a good proof that NC State occupancy data can support an independent student project. Its current frontend shows Hill and Hunt occupancy counts, percentage full, recent history, one-hour forecasts, yesterday comparisons, and forecast charts; the implementation refreshes its state every five minutes. Its author also documents historical collection and forecasting around data derived from NC State's occupancy system. citeturn140094view0turn140094view1turn140094view2

But its fundamental unit is **“How busy is the library?”** Your project should answer the much more valuable question:

> **“Where should I study right now—or at the time I care about?”**

That distinction drives almost every product and engineering decision below.

## Product thesis and competitive benchmark

### What the existing busyness project gets right

The reference application is technically thoughtful. It gives users a fast answer about overall Hill/Hunt activity, exposes historical behavior, adds forecasting, handles loading/errors, supports counts versus percentages, and has a transparent explanation of its data and prediction system. Its frontend is React/TypeScript/Tailwind, and the current implementation compares the most recent reading with both the expected occupancy an hour ahead and the equivalent time on the previous day. citeturn140094view0turn140094view1

Its strongest idea is probably not the graph itself, but **forecasting**. Knowing that Hunt is 49% full is useful; knowing that it is likely to become materially busier over the next hour can change a decision. The author's own documentation says the project has accumulated historical occupancy data since fall 2023 and uses that history for predictions. citeturn140094view2

The weakness is product scope. The homepage ultimately gives one large dashboard card per library. There is no spatial understanding of *where* the occupancy is, no mapping between occupancy zones and actual study spaces, no room discovery, no capacity matching, no reservation availability, no eligibility filtering, no wayfinding, and no booking handoff. Those omissions are visible directly in the current frontend implementation. citeturn140094view0turn140094view1

So I would **not compete on prettier charts**. I would preserve the reference project's historical/forecast insight as one ingredient, then move the product substantially downstream toward a decision.

### What best-in-class adjacent products suggest

Campus-space products tend to fall into two camps. Duke's current library-space finder is essentially a searchable catalog: users filter by noise level, features, and library, then reserve rooms through a separate reservation system. It is useful, but spatially modest. citeturn819750view2

Products such as MazeMap go further spatially: they can place bookable workspaces directly on indoor maps, color-code availability, find nearby bookable spaces, integrate university scheduling systems, and combine room-booking state with sensor occupancy. Lancaster University has used that model to expose room capacities, booking information, occupancy and other campus resources within its student app. citeturn819750view0turn819750view1

NC State itself already has an important precedent. The Libraries' in-house Hill/Hunt touchscreen application combines **maps, rooms, directions, events and occupancy**, drawing from multiple APIs including the room-reservation system and Occuspace. It explicitly provides path-drawing wayfinding and occupancy views, although it does not allow users to reserve rooms on the shared kiosks. The Libraries also notes that maintaining this kind of custom application requires continuing development effort. citeturn521666view4turn521666view5

That gives your project a clear opportunity:

**Combine the decision intelligence missing from occupancy dashboards with the spatial intuitiveness missing from reservation grids.**

I would use the working name **StudyScape**. Other reasonable names are *FindSpace*, *StudyState*, *Spot*, and *StudyMap*. Because university marks are protected, the safest public branding would be something like **“StudyScape — an independent NC State study-space explorer”**, rather than making it appear to be an official NC State application. The Libraries permits website information to be reproduced for noncommercial personal or educational purposes as a general rule, while specifically protecting its logo/logotype and restricting automated activity that creates undue API/server load. citeturn521666view0turn521666view1

iturn323152image0turn323152image1turn323152image3turn323152image4

The architectural contrast above matters to scope. Hunt has five comparatively legible levels and a strong visual identity; Hill has towers, multiple wings, many more vertical transitions and a substantially more complicated spatial graph. That is one reason Hunt should be first.

## The product I would actually build

### Core job to be done

The primary persona is not “someone curious about occupancy.” It is a student who is about to make a physical decision.

Examples:

**Solo student:** “I have two hours between classes. I want somewhere quiet with natural light and I don't want to wander around looking for a seat.”

**Group of four:** “We need to talk and use a whiteboard at 4:00. What's actually available?”

**Group of six:** “Nothing is available right now. Which room opens first?”

**Graduate student:** “Show me spaces I'm eligible for that are quieter than the public floors.”

**Student with mobility needs:** “Give me a route that doesn't require stairs.”

NC State's existing Spaces API already exposes dimensions that make these useful searches realistic: reservability, building, sound level, work type, access and lighting are documented query dimensions, and individual records can expose access and reservation eligibility. citeturn140094view4

NC State's own study-room research also strongly supports *capacity-aware matching*. In its 2023 observational study, the Libraries reported that most studied rooms were designed for four to six people, but the median observed occupancy was only 1.5 people, 40% of observations had a single person in the room, and the Libraries explicitly encourages individual users to choose smaller rooms so larger rooms remain available to groups. citeturn140094view3turn521666view2

That gives the recommendation engine a legitimate user-experience purpose: **not merely finding any valid room, but finding the right-sized room.**

### The central interaction

The homepage should make the 3D building visually prominent while keeping the user's task simpler than manipulating a model.

On desktop I would use roughly a **60/40 spatial/workflow layout**:

```text
┌───────────────────────────────────────────────────────────────┐
│ StudyScape          HUNT ▾             Now · updated 2m ago  │
├─────────────────────────────────┬─────────────────────────────┤
│                                 │ Find me a place             │
│          3D HUNT MODEL          │                             │
│                                 │ 4 people                    │
│     Floor 5   ▬                 │ 3:30–5:00 PM                │
│     Floor 4   ▬                 │ Collaborative               │
│     Floor 3   ▬                 │ Whiteboard                  │
│     Floor 2   ▬                 │                             │
│     Floor 1   ▬                 │ [ Find the best spaces ]    │
│                                 │                             │
├─────────────────────────────────┴─────────────────────────────┤
│ NOW ─── 3:30 ─── 4:00 ─── 4:30 ─── 5:00 ─── 5:30 ───────►  │
└───────────────────────────────────────────────────────────────┘
```

The user can interact either direction.

**Task → map:** enter “4 people, collaborative, 4 PM, whiteboard.” The app ranks three matches, explodes the appropriate floor and highlights the best room.

**Map → task:** click a floor or room. A drawer gives its properties and availability, and lets the user ask for the next free interval.

That dual-direction interaction is much stronger than treating the building as a 3D novelty.

### Screen-by-screen experience

The **Home / Find** screen opens with Hunt in a clean axonometric view. Each occupancy zone receives a restrained busyness treatment. The user immediately sees a compact prompt: *How many people? When? What kind of study?* “Now” is the default.

Submitting the query produces no more than three initial recommendations:

```text
BEST MATCH
Group Study 3202
Floor 3 · Seats 4

Available 3:30–5:30
Collaborative zone · currently lightly occupied
Whiteboard
Perfect capacity fit

[Show in building]        [Book on NC State]
```

The important detail is the explanation. Never output an opaque “92% match.” Tell the user **why**.

The **Explore** mode makes the 3D model more dominant. Hovering or focusing a floor raises it slightly. Selecting it produces an exploded-floor transition while the other levels become translucent. Zones can show occupancy as a surface treatment, while reservable rooms have a separate availability indication.

Those two concepts must remain visually distinct:

- **Occupancy:** “How crowded is the surrounding physical area?”
- **Availability:** “Is this reservable room free during my selected interval?”

NC State's public occupancy displays are zone-oriented, not individual-room presence detectors. Hunt's public view includes areas such as the Skyline Reading Room, Learning Commons, Quiet Reading Room and Rain Garden-related areas; Hill's view includes areas such as tower study floors, North Forum, South Study Lounge and other larger zones. citeturn983845view0turn983845view1

Therefore the UI should never imply, for example, **“Room 3213 is physically empty”** merely because the surrounding zone has low occupancy.

The **Room / Space Detail** drawer should contain:

```text
Group Study Room 3202
Hunt · Level 3

Capacity          4
Environment       Collaborative
Area busyness     Low · updated 2 min ago
Amenities         Whiteboard · Display
Eligibility       Active NC State users

Today
3:00   3:30   4:00   4:30   5:00   5:30
██████ ░░░░░░░░░░░░ ████████████
booked    available       booked

Next opening
3:30–5:00 PM

[Book this room]
```

If reservation data has not been authorized, the app should instead explicitly say **“Live reservation availability unavailable — check NC State”** rather than deriving or guessing it.

### The standout feature: Time Lens

The genuinely differentiated feature I would build is a **time scrubber that turns the building into a temporal decision surface**.

Drag:

**Now → 4 PM → 5 PM → 7 PM**

and simultaneously update:

- expected occupancy by zone,
- room availability,
- recommended spaces,
- next-open-room labels,
- floor emphasis.

This turns the WebGL model into something functionally meaningful rather than decorative.

A student could literally drag from 4:00 to 6:00 and watch the building evolve:

> **4:00** — Hunt Level 3 crowded, Room 3202 booked.  
> **4:30** — Room 3202 opens.  
> **5:00** — Level 4 becomes the better overall recommendation.  
> **6:00** — quiet zones become substantially less crowded.

The existing occupancy project demonstrates why adding a time dimension is promising: it already computes historical and forecast change, rather than only reporting a static current number. citeturn140094view0turn140094view2

This would be visually impressive **and** answer a real question: *Should we leave now, or is there a better place in 30 minutes?*

## Data reality and integration plan

This is where the project's success will be determined. The encouraging news is that nearly all the necessary concepts exist. The challenge is that they do **not all exist as public, documented APIs**.

| Data / capability | Verified state in Nov. 2026 | Use in StudyScape | Recommended approach |
|---|---|---|---|
| Library-space metadata | **Public, documented** | names, attributes, access, reservation properties | Use directly |
| Official floor plans | **Public documents/pages** | geometry and labeling | Trace/transform into your own normalized geometry; confirm derivative-use comfort with Libraries |
| Public occupancy display | **Public UI** | current zone busyness | Use only through an approved interface/feed |
| NC State site-local occupancy endpoint described by benchmark | **Undocumented from NC State's API docs; reported publicly by benchmark author** | current zone counts | Verify with Web Team before relying on it |
| Occuspace Customer API | **Documented but authorized** | live + historical occupancy | Request read-only access through Libraries |
| Room reservation UI | **Public entry point; authentication required** | final booking | Safe external handoff |
| Mazévo standard API | **Customer/admin-key controlled** | rooms, hours, bookings/availability | Ask Libraries for scoped read-only key or mediated endpoint |
| Mazévo booking API | **More privileged integration** | creating bookings directly | Not MVP |
| Room/time deep-link | **Not verified** | preselected booking handoff | Technical spike; graceful fallback |
| NC State touchscreen wayfinding graph | **Internal implementation exists** | indoor routes | Ask whether route/map data can be shared |

### Spaces data is the easiest win

NC State currently documents the Spaces API at `/api/spaces/everything.json`. It explicitly supports filters including building, reservability, sound level, work type, access and lighting, and it returns space identifiers plus access and reservation metadata. citeturn140094view4

That means a useful **static recommendation engine can exist before any private integration is approved**.

Even an early version could answer:

> “Show me quiet Hunt spaces suitable for individual work with natural light.”

That is already more task-oriented than an occupancy dashboard.

### Occupancy needs careful handling

Occuspace's official customer API supports real-time and historical occupancy estimates, including count, percentage, timestamp and active-state information. But the API documentation explicitly says requests require Bearer tokens supplied by Occuspace. It is therefore an **authorized API, not an open public endpoint**. citeturn440022view4

The reference project independently states that it gets NC State occupancy information through a publicly accessible NC State endpoint and even identifies a `space-occupancy/realtime-data.php` URL pattern. That is useful evidence that a site-local interface has existed, but NC State's documented developer API pages do not establish that endpoint as a supported third-party API. Treat it as **observed/undocumented until the Libraries confirms intended use, rate limits and stability**. citeturn140094view2

That distinction matters. Don't build a production dependency around “the endpoint happened to respond.”

The best request to the Libraries is:

> “Could I receive read-only access to the occupancy zones already powering the public Hill/Hunt displays, or is there an approved public endpoint you would prefer student applications to use?”

That is a much stronger position than scraping or reverse-engineering the display.

NC State already integrates Occuspace into its own touchscreen application, so its Web/UX teams have direct experience with this exact integration. citeturn521666view4

### Room availability is feasible if NC State cooperates

NC State officially moved its room reservation platform to Mazévo beginning in summer 2024, and its current reservation guidance still sends users into the official room-reservation system. The current policies require an active Unity ID for reservations, generally permit most rooms to be reserved seven days ahead, impose two reservations per person per day and 30 per 30 days, and include special eligibility rules for graduate, faculty and visualization spaces. citeturn923598search2turn521666view2turn521666view3

Mazévo's documentation is encouraging. Its standard customer API can return:

- buildings,
- rooms,
- building hours,
- bookings between specified start/end times,
- bookings filtered by room/building/status.

But Mazévo says API keys are created by global administrators, and newer keys can be restricted to specific API calls. citeturn440022view3

That is almost ideal for your use case. The Libraries could theoretically issue or mediate a key capable only of something resembling:

```text
Rooms
BuildingHours
GetEvents
```

Your server could then turn bookings into anonymous busy intervals.

**Do not return event names, contact information, organizations or other reservation metadata to the browser.** You do not need them. Your normalized availability service should expose only:

```json
{
  "spaceId": "hunt-3202",
  "intervals": [
    {
      "start": "2026-11-16T15:00:00-05:00",
      "end": "2026-11-16T15:30:00-05:00",
      "status": "busy"
    }
  ]
}
```

This is both simpler and more privacy-preserving.

### Booking should remain an official handoff

The safest MVP is:

**StudyScape finds → NC State authenticates and books.**

Do not proxy Unity credentials. Do not automate login. Do not simulate the authenticated reservation form.

A room/time-specific deep link would be great, but I found no authoritative current documentation establishing that NC State's reservation frontend supports URL parameters that reliably preselect a particular room and time.

Therefore implement three levels:

**Ideal:** official supported deep link, if the Libraries documents one.

**Good fallback:** open the official reservation system and automatically copy/show `Hunt 3202 · Nov 16 · 3:30–5 PM`.

**Minimum:** open the official room-booking page.

The product remains valuable even at the minimum level.

### Privacy, licensing and data freshness

Occuspace's measurements should be presented as **estimated aggregate occupancy**, not precise human counts. Its API itself calls the values occupancy estimations and includes timestamps and `isActive` status. citeturn440022view4

Every live datum in your internal model should therefore include provenance:

```ts
type Provenance = {
  source: "occuspace" | "ncsu-spaces" | "mazevo" | "manual"
  observedAt?: Date
  fetchedAt: Date
  status: "live" | "stale" | "unavailable"
  confidence?: "high" | "medium" | "low"
}
```

The interface should visibly say things such as:

**Area occupancy · 31% · updated 3 min ago**

rather than simply painting something green.

Also avoid aggressive polling. NC State's terms expressly warn automated tools against placing undue burden on website APIs/servers and say automated activity can be restricted. citeturn521666view1

A server-side cached feed at something like a five-minute interval is far more defensible than every browser directly hammering upstream services.

## Recommendation engine and information model

You do not need an LLM to recommend spaces. A deterministic engine will be faster, transparent and easier to validate.

### Hard constraints first

A result is excluded if any required condition fails:

```text
building is open during requested interval
AND user may access the space
AND user may reserve it, if reservation is required
AND capacity >= group size
AND room is available for the complete interval
AND requested activity is compatible with the environment
AND accessibility requirement can be satisfied
AND special prerequisite is met, where applicable
```

Do not let scoring override hard constraints.

For example, a faculty-only space can never become a “great match” for an undergraduate merely because it is quiet.

### Then rank valid choices

A useful initial scoring model is:

| Signal | Weight | Reason |
|---|---:|---|
| Capacity fit | 25 | avoids one person occupying large group rooms |
| Availability fit | 20 | protects the requested full study interval |
| Surrounding zone occupancy | 20 | helps users actually find a comfortable area |
| Noise / work-style match | 15 | critical to study behavior |
| Requested amenities / lighting | 10 | whiteboard, monitor, natural light, etc. |
| Walking / vertical-travel cost | 5 | useful once routing exists |
| Near-future occupancy trend | 5 | rewards a space unlikely to become unpleasant immediately |

For capacity fit, don't simply reward “bigger.” A four-person group should score a four- or five-seat room better than a ten-seat room. That policy aligns with the Libraries' own recommendation that individual users preserve larger rooms for groups. citeturn521666view2turn140094view3

A simplified capacity component might be:

```ts
if (capacity < groupSize) return INVALID

const excess = capacity - groupSize
capacityFit = Math.max(0, 1 - excess / Math.max(groupSize, 4))
```

Then present human-readable reasons, not the internal math:

> **Best match because:** seats 4 · free for your entire 90 minutes · collaborative environment · whiteboard · surrounding area currently lightly occupied.

### The crucial occupancy/room mapping

Model occupancy zones independently of spaces.

```ts
Building
 ├── Floor
 │    ├── Space
 │    │    ├── geometry
 │    │    ├── capacity
 │    │    ├── features[]
 │    │    └── eligibility
 │    │
 │    └── OccupancyZone
 │         ├── geometry
 │         ├── liveEstimate
 │         └── mappedSpaces[]
 │
 └── RoutingGraph
```

The relationship between a room and an occupancy zone should be explicit:

```ts
type ZoneSpaceMapping = {
  zoneId: string
  spaceId: string
  relation: "contains" | "adjacent" | "same-floor"
  confidence: number
}
```

Then the UI can truthfully say:

**“Surrounding area: moderately busy”**

instead of falsely stating:

**“Room is moderately busy.”**

That semantic distinction is one of the most important signs of a well-built product.

### Availability computation

Once you have room bookings, “next available slot” is easy interval algebra.

For a user requesting 60 minutes, take:

```text
building-open intervals
MINUS
booked intervals
```

and select the earliest remaining interval of at least 60 minutes.

That powers three queries:

```text
time-first
"Find rooms for 5 people from 4–5 PM."

room-first
"When is room 3202 next available for 90 minutes?"

floor-first
"Which Level 4 room opens next?"
```

The recommendation API can expose all three through the same underlying availability engine.

## Browser-native 3D and system architecture

This should be **programmatic spatial data rendered in WebGL/WebGPU**, not a Blender-authored building model.

React Three Fiber remains a React renderer for Three.js, and its documentation includes performance techniques such as rendering on demand, performance regression handling and instancing. Three.js continues to support `ShapeGeometry` and `ExtrudeGeometry`, which fit the “2D polygon → shallow architectural volume” model very well. Its current documentation also says `WebGLRenderer` remains the recommended renderer for pure WebGL 2 applications even while WebGPU development advances. citeturn855629search12turn855629search2turn855629search21turn855629search36

### Geometry pipeline

The official Hunt maps are sufficiently detailed to establish room outlines and floor relationships. My inspection of the official floor-plan PDF shows clearly separated geometry for levels 1–2 and for levels 3–5. citeturn739959view0turn739959view1

I would create the building through this pipeline:

```text
Official floor plan
       ↓
vector extraction / one-time tracing
       ↓
normalized SVG / GeoJSON
       ↓
semantic annotation
 roomId / zoneId / door / stairs
       ↓
build-time geometry compiler
       ↓
compact JSON geometry
       ↓
Three.js ShapeGeometry / ExtrudeGeometry
```

Your source-of-truth geometry might resemble:

```json
{
  "floor": "hunt-3",
  "elevation": 8.4,
  "spaces": [
    {
      "id": "hunt-3202",
      "type": "study-room",
      "polygon": [[12.1,8.2],[15.7,8.2],[15.7,11.6],[12.1,11.6]],
      "doors": [[13.1,8.2]]
    }
  ]
}
```

This approach has an enormous product advantage: **geometry and domain objects are identical concepts.**

Clicking a polygon already gives you the room ID.

Filtering rooms directly changes meshes.

An occupancy update directly changes a zone material.

Search results can animate the corresponding room.

There is no brittle “figure out which polygon in `library.glb` represents Room 3202” layer.

Manual tracing is not a failure of programmatic 3D. It is simply the one-time conversion of source architectural information into structured spatial data.

### The 3D interaction model

Use an **orthographic or very low-perspective camera**, not a free-roaming first-person camera.

The building should behave like an architectural instrument:

**Rest:** five assembled floor slabs.

**Hover/focus:** target floor rises perhaps 4–8 px visually.

**Select:** floors explode vertically; selected floor comes into visual focus.

**Select room:** room surface rises slightly and outline strengthens.

**Filter/search:** nonmatching rooms desaturate instead of disappearing completely.

**Time change:** occupancy surfaces smoothly interpolate rather than flash.

**Recommendation:** camera glides toward the floor and highlights the recommended destination.

Animations should be around a few hundred milliseconds, interruptible and disabled/reduced under `prefers-reduced-motion`.

Avoid photorealistic chairs, laptops, shelves and decorative clutter. The important visual primitives are:

- floor plates,
- rooms,
- circulation,
- stairs/elevators,
- occupancy zones,
- destinations,
- labels.

The art direction I would choose is **“architectural model + premium transit map.”** Matte surfaces, subtle ambient occlusion, soft elevation, lots of negative space and typography outside the Canvas. No game HUD.

### Recommended application architecture

```text
                         ┌──────────────────────────┐
                         │ NC State Spaces API      │
                         └────────────┬─────────────┘
                                      │
 ┌────────────────────┐               │
 │ Approved occupancy │───────────────┤
 │ feed / Occuspace   │               │
 └────────────────────┘               ▼
                            ┌───────────────────┐
 ┌────────────────────┐     │ Normalization /   │
 │ Mazévo read API    │────►│ caching service   │
 │ if authorized      │     └─────────┬─────────┘
 └────────────────────┘               │
                                      ▼
                            ┌───────────────────┐
                            │ Recommendation    │
                            │ + availability    │
                            └─────────┬─────────┘
                                      │
                      ┌───────────────┴──────────────┐
                      ▼                              ▼
               HTML / 2D UI                  R3F 3D scene
```

For one student, my stack would be:

| Layer | Choice |
|---|---|
| Application | Next.js + TypeScript |
| 3D | Three.js + React Three Fiber |
| 3D utilities | Drei |
| State | Zustand |
| Server-state fetching | TanStack Query |
| UI | Tailwind + hand-built component system |
| Animation | Framer Motion for DOM; react-spring or controlled R3F interpolation for scene |
| Validation | Zod at every external-data boundary |
| Persistence | PostgreSQL only when historical snapshots/mappings require it |
| Geometry | build-time SVG/GeoJSON → normalized JSON |
| Deployment | Vercel/Cloudflare-class platform |
| Monitoring | simple upstream health/freshness logging |

The Canvas should be lazy-loaded rather than part of the critical initial JavaScript path; Next.js explicitly supports deferring client components/libraries with dynamic loading. citeturn855629search0

### 3D should be prominent, but not the only/default interaction

My explicit recommendation is:

**Desktop:** show 3D immediately as the dominant visual companion.

**Mobile:** default to task UI + 2D floor representation; offer **View in 3D**.

**Accessibility / reduced capability:** complete HTML/list experience without needing the Canvas.

So if the binary question is **“3D default or secondary?”**, I choose **secondary in the information architecture, primary in the visual identity.**

That distinction is important.

The user should never *need* to orbit a model to find a room.

But when the app has found one, the 3D model should make its location instantly understandable.

This also gives you progressive enhancement and much better resilience. Room pages, availability and recommendation results remain ordinary indexable HTML. The WebGL layer enhances them rather than becoming the application's only usable interface.

## Hunt-first implementation plan

### Hunt should unequivocally come first

The official Hunt plans show five levels with comparatively coherent floor geometry. Hill's official mapping is far more complex: tower levels, east and west wings, basement/ground/upper floors and cross-wing circulation. The Hill room directory even instructs visitors that movement between wings may require returning to the first floor and taking the appropriate wing's elevator or stairs. citeturn739959view0turn739959view1turn739959view2turn923598search9

That means Hill is not merely “five more floor polygons.”

It introduces:

- more vertical topology,
- wing transitions,
- more route graph states,
- more labels,
- more occupancy zones,
- more opportunities for incorrect spatial relationships.

Hunt also offers a much more visually distinctive first demo.

**Build Hunt until it feels finished. Then build Hill.**

### The de-risking sequence

Do **not** begin by spending three weeks tracing every wall.

The first technical sprint should answer the questions capable of killing the product.

| Spike | Question | Pass condition |
|---|---|---|
| Occupancy | What live feed are we allowed to consume? | approved endpoint/feed identified |
| Reservation | Can Libraries expose anonymous busy intervals through Mazévo? | read-only access or explicit “no” |
| Booking | Does a supported room/time deep link exist? | verified parameterization or fallback chosen |
| Identity mapping | Can Spaces records, map room numbers and Mazévo IDs be reconciled? | 10 sample Hunt rooms matched |
| Geometry | Can one Hunt floor become clean polygons cheaply? | interactive floor rendered accurately |
| Mobile performance | Can representative geometry hold smooth interaction on a phone? | acceptable tested experience |
| Accessibility | Can every 3D operation be achieved through DOM controls? | full keyboard/list equivalent |

There is a particularly good reason to contact the Libraries early: their touchscreen team explicitly says it is willing to share code and implementation tips with others interested in building similar applications, although the full project is not maintained as open source. citeturn521666view5

I would contact the Web Team with a small prototype rather than just an idea. The Spaces API documentation provides a Web Team support contact, which is the natural starting point. citeturn140094view4

### Realistic one-student roadmap

Assuming roughly **10–15 serious hours per week**, these are planning estimates rather than guarantees.

**Foundation — about 1–2 weeks**

Build the design skeleton, fetch the Spaces API, normalize Hunt spaces, test one floor's geometry, and contact Libraries about approved occupancy/reservation access.

Deliverable: searchable Hunt space list plus a crude interactive Level 2.

**Spatial MVP — about 2–3 weeks**

Finish Hunt's five floors; implement floor selection, room selection, exploded mode, labels, 2D fallback and mobile behavior.

Deliverable: genuinely polished Hunt explorer using static space metadata.

**Study Match — about 1–2 weeks**

Add group size, time, duration, sound, lighting, amenities and eligibility. Implement hard filtering and explainable ranking.

Deliverable: “Find me a place” works even without private APIs.

**Live occupancy — about 1 week after access is settled**

Map occupancy zones to 3D geometry, add freshness/staleness semantics and integrate occupancy into ranking.

Deliverable: live Hunt heatmap that doesn't misrepresent room-level presence.

**Reservation intelligence — about 2–3 weeks if API access is granted**

Normalize Mazévo intervals; add time-specific room search, timelines, next-slot calculation, room-first/floor-first queries and booking handoff.

Deliverable: the major utility leap.

**Polish and launch — about 2 weeks**

Accessibility, keyboard navigation, reduced motion, phone testing, visual refinement, telemetry, upstream failure states, empty states and usability testing.

A high-quality Hunt release is therefore roughly a **9–13 week part-time project** once you account for polish. External permission can take longer than engineering, which is why integration requests belong at the beginning.

### MVP versus stretch

The **must-have release** should include Hunt, programmatic 3D floors/rooms, a strong 2D/list equivalent, Spaces API metadata, zone occupancy if permission permits, explicit freshness, Study Match recommendations, room/space details, eligibility handling and an official booking handoff.

The **next priority** is live room availability, time-first search, next free slot and Time Lens.

Only then would I add **Hill**.

Later stretch features could include occupancy forecasting, full indoor directions, favorites, “near me,” schedule-aware suggestions, alerts such as “Room 3202 opens in 15 minutes,” and—only with explicit institutional support—authenticated booking through an approved API.

I would **not** prioritize accounts, social features, AI chat, reviews, gamification, AR or photorealistic interiors.

They all dilute the strongest job.

## Product requirements, risks and launch criteria

### The compact PRD

**Positioning**

> **StudyScape helps NC State students find the best place to study—not just see how busy the library is.**

**Primary promise**

> Tell us your group, time and needs. We'll show you the best places, where they are, how busy the area is, and when you can book them.

**Primary actions**

```text
Find a place
Explore the building
Check a room
Find the next opening
Book on NC State
```

**Product principles**

The answer comes before the visualization.

3D always represents real semantic data.

Occupancy and reservation availability are never conflated.

Every recommendation is explainable.

Every live value exposes freshness.

Every Canvas interaction has a non-Canvas equivalent.

University authentication always remains with the university.

### Feasibility assessment

| Capability | Technical feasibility | External dependency | Recommendation |
|---|---:|---:|---|
| Polished Hunt 3D | Very high | Low | Build |
| Clickable floors/rooms | Very high | Low | Build |
| Metadata-based recommendations | Very high | Low | Build |
| Live zone busyness | High | Medium | Seek approved feed |
| Historical/forecast occupancy | High | Medium | Add after live integration |
| Room availability | High technically | High institutionally | Major integration target |
| Find next free room | High once availability exists | High | Build immediately after API |
| Booking-site handoff | Very high | Low | Build |
| Room/time preselection | Unknown | Medium | Spike |
| Direct authenticated booking | Possible but disproportionate | Very high | Defer |
| Indoor directions | Medium/high | Medium | Hunt later |
| Hill full model | High | Low technically, high effort | Phase two |

### Principal risks

**The biggest risk is API permission, not Three.js.**

If Mazévo access is unavailable, you lose the seamless availability search but still retain a strong occupancy + study-space recommendation product.

If approved live occupancy access is unavailable, you can still create a space finder from the documented Spaces API, with buttons to NC State's official live occupancy and booking interfaces.

If both integrations become available, the project becomes substantially more compelling because the entire decision loop collapses into one interface.

**Geometry drift** is the second risk. Floor layouts change. Keep geometry independent of visual code and version your building dataset so updates do not require rewriting the renderer.

**Semantic error** is the third. Incorrectly mapping an occupancy zone to a room is worse than not mapping it at all. Store confidence and allow a room to have no occupancy association.

**Performance** is manageable if you avoid photorealism. React Three Fiber recommends patterns such as instancing and demand-driven rendering for scenes with many objects. citeturn855629search2turn855629search8

**Scope creep** is probably the largest personal-project risk. Hill, routing, forecasting, reservation integration and beautiful 3D could each become their own project. Hunt-first protects you against that.

### Success criteria

The most important measurements should be task outcomes rather than visits.

Before launch, put 8–12 students through scenarios such as:

> “You and three friends need somewhere to talk for an hour beginning at 4.”

> “You need the quietest reasonable place to work alone right now.”

> “This room is booked. Find its next 90-minute opening.”

> “You're on your phone and don't want to use the 3D view.”

I would set these product targets:

| Metric | Target |
|---|---:|
| Users who successfully identify a valid study option | >90% |
| Median time to first useful recommendation | <20 sec |
| Basic “find somewhere now” task | <10 sec |
| Recommendation users who understand *why* it was suggested | >90% |
| Users who confuse occupancy with room availability | <10% |
| Booking handoff success | >95% |
| Mobile core-task completion | comparable to desktop |
| Keyboard-only core-task completion | 100% |
| Stale upstream data shown without a warning | 0 |
| p75 LCP target for useful HTML UI | <2.5 sec |
| Normal 3D interaction | visually smooth on representative student hardware |

The Libraries has already done usability research around its physical/digital space experiences, including its own touchscreen implementation and study-room usage, so there is unusually good institutional precedent for treating this as a UX problem rather than merely an engineering demo. citeturn521666view5turn140094view3

### The final product decision

The version I would commit to is:

**StudyScape — Hunt Library first.**

A student opens it and immediately sees Hunt as a beautifully rendered, data-driven architectural object. Beside it is one compact question:

**What do you need?**

They enter:

> **4 people · today at 4 PM · 90 min · collaborative · whiteboard**

The app responds:

> **Best choice: Group Study 3202**  
> Seats 4 · available for your full session · collaborative · whiteboard · surrounding area less busy than the other matches.

The third floor separates from the building. The room glows. The timeline below shows the open interval. Two alternatives appear underneath.

The student drags the Time Lens to 5 PM.

The occupancy surface changes. Another room becomes available. The rankings reorder.

They click **Book on NC State**.

Authentication and booking remain inside NC State's official system.

That experience would preserve what is valuable about the existing occupancy project—live data, historical understanding and prediction—while solving the part it does not address: **turning library information into a concrete decision.** It would also build on capabilities that NC State itself already demonstrates separately through its Spaces API, occupancy system, room-reservation platform and touchscreen wayfinding work. citeturn140094view2turn140094view4turn440022view3turn521666view4

The 3D is what makes people remember it. **The recommendation, availability and booking workflow are what make them keep using it.**