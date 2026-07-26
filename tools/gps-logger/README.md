# Svika GPS Logger — SUPERSEDED

> **This tool is retired. Do not use it for a data day, and do not copy code
> out of it.**
>
> Data collection lives inside the Svika app now, as **Svika Partner**. A
> rider turns partner mode on in their profile (`/app/partner`), records a
> trip on the record screen exactly as they always could, and the trip now
> carries what this tool used to capture: leg tagging (walking, waiting,
> riding, with the route, direction and what the fare was) and marked stops
> dropped where something actually happened. Those reach the same pipeline
> tables this tool's bundles fed, through `pnpm spine:ingest -- --partner`.
>
> Why it moved: a field tool that lives outside the workspace is never
> typechecked, linted or tested by CI, and this one drifted away from the
> schema underneath it (its upload button has had no valid target since
> migration 0019). More to the point, corridor data cannot come from a
> laptop on the same wifi as a phone. It has to come from riders, with
> consent, on the app they already have.
>
> **It is kept, not deleted.** The two bundles in
> `assets/Takunda real kombi ride data/` are the entire real dataset Svika
> stands on, and this is the code that recorded them on 2026-07-07. They
> still re ingest with `pnpm spine:ingest`, and its 28 unit tests still
> pass. It is the record of how the first real data was collected.
>
> Read `docs/PARTNER-GATE-REPORT.md` before touching anything here: its step
> 1 is a line by line audit of every bug, rough edge and product law
> violation this tool carries, and which of them the in app flow fixed.

---

## What it was

A small phone web app for corridor data days. You open it, start a journey, and
walk it: from home, onto a kombi, riding, maybe a transfer to a second kombi,
then walking to your destination. Every GPS point it records is tagged with what
you were doing at that moment (walking, waiting, or riding) and which leg of the
trip it belongs to. Marked points are the places where things actually happen:
a drop off, a rank, a terminal, a landmark.

It is a field tool. It lives outside the production apps (not in the pnpm
workspace) and never touches rider money, tickets, or auth.

## One journey, several legs

A journey is a chain of legs. A leg is one continuous stretch of a single mode:

```
walk  ->  wait  ->  ride kombi A  ->  walk (transfer)  ->  ride kombi B  ->  walk (arrive)
 0        1          2                3                    4                 5
```

You never declare how many legs there will be. You might end after one kombi, or
keep going through a transfer. Each time you board, you open a new riding leg
with its own route name and direction. Each time you get off, you go back to
walking. This works any number of times in one journey.

## How to use it on a journey

1. **Start.** Tap the big green **Start journey**. It begins in walking mode and
   starts logging your location straight away. Keep the phone screen on (it
   holds a wake lock for you) and start walking.
2. **Board.** When you get on a kombi, tap **Boarded kombi**. Type the route
   name (for example "Mt Pleasant Heights to Rezende") and pick **Outbound** or
   **Inbound**. It switches to riding mode.
3. **Mark points as you go.** Tap **Mark point** whenever something happens: a
   drop off, a rank, a terminal, a landmark. Pick the type, add a name if you
   have one (you can leave it blank and name it later). Names like "Pamachurch"
   or "next left" or "4th Street bus terminal" are exactly right.
4. **Get off.** Tap **Got off kombi**. It goes back to walking. If you walk to
   another rank, that walk is just a normal walking leg, no route needed.
5. **Board again if you transfer.** Tap **Boarded kombi** for the next kombi and
   set its own route and direction. Repeat as many times as the trip takes.
6. **Arrive.** Tap **Arrived / End**. The journey is saved.
7. **Export.** Open the finished journey and tap **Export GeoJSON + CSV**. If you
   opened the app from your laptop's dev server the files land straight in
   `tools/gps-logger/output/`. Otherwise they download to the phone and you move
   them into `output/` later.

Record the same trip a few times at different hours. Each run is kept separate,
saved on the phone, and still there when you come back.

## Live stats while you ride

Current mode (big and colour coded), current leg, points logged, elapsed time,
and current speed. All large and legible for a bumpy kombi in sunlight.

## Offline first and crash safe

Every point and every event is written to IndexedDB the instant it is captured.
A lost signal, the app going to the background, or a dying battery never loses
the journey. If the app reloads mid trip, the home screen offers to resume the
journey in progress.

## Running it

```bash
cd tools/gps-logger
pnpm install --ignore-workspace   # isolated from the monorepo
pnpm dev                          # opens on http://<your-lan-ip>:5175
```

Open that LAN address on your phone (same wifi as the laptop). Location needs a
secure context, so use `localhost` on the laptop, or serve the built app over
https for a real field phone:

```bash
pnpm build && pnpm preview
```

Install it to the home screen (Add to home screen) so it opens full screen and
keeps working with no signal.

```bash
pnpm typecheck && pnpm test        # 28 unit tests over the pure logic
```

## What it exports

Each journey exports four files, named `<date>_<label>_<id>.*`:

| File | What it is |
| --- | --- |
| `.geojson` | One LineString per leg (the leg boundaries are where walking became riding and where transfers happened), a Point at every mode change, a Point per raw ping, and a Point per marked place. Drops straight into any map tool. |
| `.pings.csv` | One row per GPS point: `journey_id, seq, leg_index, mode, route_name, direction, recorded_at, lat, lng, accuracy_m, speed_mps, heading_deg, altitude_m`. |
| `.points.csv` | The marked points: `journey_id, leg_index, mode, marker_type, name, recorded_at, lat, lng, accuracy_m`. |
| `.bundle.json` | The database and seed payload: proposed `gps_pings` rows plus the marked points reshaped as drop in `stops` for the seed. |

## How it maps to the Svika schema

Marked points map directly onto **`public.stops`**
(`packages/db/migrations/0002_transit_network.sql`): name, lat, lng. The bundle
emits them in the same keyed object shape `packages/db/seed/network.json` uses,
so a corridor capture can be pasted into the seed. The slug is derived from the
name (`sp_rezende_rank`); unnamed points get a stable fallback key.

**`gps_pings` does not exist yet.** Only `public.stops` is in the migrations. The
`.bundle.json` `gps_pings` array is the *proposed* shape a future migration and
seed can ingest without reshaping. Proposed columns:

```
gps_pings
  id            uuid primary key default gen_random_uuid()
  journey_id    text not null
  seq           integer not null          -- 0-based order within the journey
  leg_index     integer not null
  mode          text not null             -- walking | waiting | riding
  route_code    text                      -- null for now (route_name is free text)
  route_name    text
  direction     public.route_direction    -- outbound | inbound, riding legs only
  recorded_at   timestamptz not null
  lat           double precision not null check (lat between -90 and 90)
  lng           double precision not null check (lng between -180 and 180)
  accuracy_m    double precision
  speed_mps     double precision
  heading_deg   double precision
  altitude_m    double precision
  source        text not null             -- 'field_logger'
```

Creating that table (with RLS from the first migration, per the project rules)
is a product decision for Mhofu, not something this tool invents. When it lands,
`src/upload.ts` posts the same rows through PostgREST behind the anon key plus a
signed in access token.

## Optional upload

The **Upload to database** button is a Tier 2 path on purpose. Local export is
the primary, reliable route. Upload needs `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` (or the `NEXT_PUBLIC_` names) in the repo `.env.local`,
and it needs the `gps_pings` table to exist. Until then it reports clearly that
there is no target and points you back to export. Your data is always safe on the
phone regardless.

## Layout

```
src/
  types.ts      domain types (Journey, Leg, Ping, MarkedPoint, JourneyEvent)
  db.ts         IndexedDB storage (idb)
  reducer.ts    pure state transitions (unit tested)
  journey.ts    the live recorder: sensors + persistence
  geomath.ts    haversine, speed, formatting (unit tested)
  sensor.ts     watchPosition + wake lock wrappers
  export.ts     GeoJSON, CSV, and the db/seed bundle (unit tested)
  deliver.ts    save to output/ (dev server) or download
  upload.ts     optional Supabase upload adapter
  ui/           the three screens (home, active, detail) + modals
```
