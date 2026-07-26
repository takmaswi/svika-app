-- 0046 saved trips to places (M4 slice, the D1 follow-up)
--
-- Logged on the D1 gate (2026-07-23): "saved_trips is a stop pair table, so
-- plans to a place ship without a save form; an additive schema extension
-- (nicknamed place trips) is a later slice, not lost, not yet scheduled."
-- This is that slice, and it is additive exactly as promised: every existing
-- row keeps its shape and every existing query keeps working.
--
-- A saved trip is now EITHER a stop pair (as before) OR a stop to a named
-- place, and the check constraint says so rather than trusting the app. The
-- place columns carry the destination's own name and coordinates, the same
-- three values the walk tail already records for a booked ticket (0031), so a
-- saved place trip replans exactly the way the original plan did.
--
-- Two rails worth naming:
--   - to_stop_id becomes nullable, so the old NOT NULL is replaced by a
--     constraint that a trip has exactly one kind of destination
--   - the old "one per pair" uniqueness only covered stop pairs; place trips
--     get their own uniqueness on rider plus destination name, so saving the
--     same place twice renames rather than duplicates

alter table public.saved_trips
  add column dest_name text
    check (dest_name is null or char_length(btrim(dest_name)) between 1 and 80),
  add column dest_lat double precision
    check (dest_lat is null or dest_lat between -90 and 90),
  add column dest_lng double precision
    check (dest_lng is null or dest_lng between -180 and 180);

alter table public.saved_trips
  alter column to_stop_id drop not null;

-- exactly one destination: a stop, or a place with a full location
alter table public.saved_trips
  add constraint saved_trips_one_destination check (
    (to_stop_id is not null
      and dest_name is null and dest_lat is null and dest_lng is null)
    or
    (to_stop_id is null
      and dest_name is not null and dest_lat is not null and dest_lng is not null)
  );

-- the stop pair rule still holds where both are stops
alter table public.saved_trips
  drop constraint saved_trips_distinct_stops;
alter table public.saved_trips
  add constraint saved_trips_distinct_stops check (
    to_stop_id is null or from_stop_id <> to_stop_id
  );

-- Saving the same place from the same stop renames rather than duplicates.
-- Plain columns rather than an expression, and partial rather than global,
-- because a stop pair trip has a null dest_name and must not collide.
--
-- Note for the app: PostgREST cannot infer ON CONFLICT from a partial index,
-- so the save action replaces a place trip rather than upserting it (see
-- saveTrip in apps/web/src/lib/actions.ts). This index is the integrity rail
-- underneath that, not a hint to the client.
create unique index saved_trips_one_per_place
  on public.saved_trips (rider_id, from_stop_id, dest_name)
  where dest_name is not null;

-- M4, from the performance advisor run on this branch: beacon_counts joins
-- beacons by stop, and that foreign key had no covering index.
create index if not exists demand_beacons_stop_idx
  on public.demand_beacons (stop_id, expires_at desc);
