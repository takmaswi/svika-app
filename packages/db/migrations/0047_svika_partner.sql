-- 0047 Svika Partner: rider recorded trips become network data, by consent
--
-- The standalone field logger (tools/gps-logger) captured three things the
-- in app recorder never did: which leg of a trip a GPS point belongs to,
-- what mode that leg was (walking, waiting, riding) with its route and
-- direction, and the places where something actually happened (a drop off,
-- a rank, a terminal, a landmark). Those three gaps are closed here, inside
-- the M1 recording tables, so there is one recorder and one trace.
--
-- Consent, first and last. Partner mode is its own append only stream in
-- the 0021 consent_records machinery ('partner-v1'), exactly like
-- journey-v1 and emergency-v1, and every gate query filters by its own
-- version so no stream can move another. Without a live accepted partner
-- consent:
--   * no leg, no mark and no fare note ever reaches the server (the two
--     doors below refuse, so the recording stays on the phone),
--   * and the journey carries no partner stamp, which is what the ride
--     data pipeline reads to decide whether a trip may be ingested.
-- Turning partner mode off appends a withdrawal and the doors close again
-- from the next call. Rows already contributed stay: they are history the
-- rider chose to give, and the privacy notice says so plainly.
--
-- The raw trace does not change hands. rider_journey_points keeps exactly
-- the RLS it was born with (0033): a rider reads only their own points and
-- there is no client write path but the RPCs. Partner mode does not widen
-- that by one row. What the network gets is the derived layer: legs, marked
-- stops and fare notes, plus permission for the service role ingest to read
-- the trip. That ingest is the same script that has always fed
-- public.journeys / gps_pings / segment_times (0019); it gains a source,
-- not a new privilege.
--
-- Marked stops do not invent network stops. A named mark is submitted
-- through public.submit_place_name (0038), so it is born personal, screened
-- by the same wordlist, counted by the same daily and burst rails, and can
-- only become community knowledge through the same consensus pass as any
-- other name. A mark whose name is rejected still lands as a mark: the
-- geometry is a fact, the name is a proposal.
--
-- Everything here is additive. No existing column changes meaning, no demo
-- machinery is touched, and rider_journey_points gains one defaulted column
-- so every row already in the table stays valid.

create type public.journey_leg_mode as enum ('walking', 'waiting', 'riding');

-- Kombis have no fixed stops. A mark is where something actually happened,
-- named the way the street names it. Same four kinds the field logger used,
-- because they came out of a real corridor day.
create type public.journey_mark_kind as enum
  ('dropoff', 'rank', 'terminal', 'landmark');

-- Which accepted partner consent covered this trip's contribution, a
-- recorded fact in the shape of the journey's own consent_version. Null
-- means the trip is not a partner contribution and the pipeline never sees
-- it.
alter table public.rider_journeys add column partner_consent_version text;

create index rider_journeys_partner_idx
  on public.rider_journeys (partner_consent_version, started_at)
  where partner_consent_version is not null;

-- Which leg a trace point belongs to, stamped at capture. The field logger
-- taught this: a leg boundary time and a GPS fix time come off two
-- different clocks, so reconstructing a trip by wall clock join is a bug
-- waiting for a phone whose clocks drift. Defaulted to 0 so every point
-- already in the table remains exactly what it was: a single walking leg.
alter table public.rider_journey_points
  add column leg_index integer not null default 0 check (leg_index >= 0);

-- ---------------------------------------------------------------------------
-- legs: one row per maximal run of a single mode
-- ---------------------------------------------------------------------------
-- A journey is a chain of legs of any length: walk, wait, ride, walk,
-- ride again, walk. The recorder never declares how many there will be.
-- Route name is free text on purpose (nobody types a route code on a
-- moving kombi) and the ingest distrusts it, inferring direction from
-- geometry; it is kept because it is what a human can actually check.
create table public.rider_journey_legs (
  journey_id uuid not null references public.rider_journeys (id) on delete cascade,
  leg_index integer not null check (leg_index >= 0),
  mode public.journey_leg_mode not null,
  route_name text check (
    route_name is null or char_length(btrim(route_name)) between 2 and 80
  ),
  direction public.route_direction,
  -- what the rider actually paid on this leg, in cents. An observation,
  -- never a fare the app charges anyone.
  fare_cents integer check (fare_cents is null or fare_cents between 0 and 100000),
  started_at timestamptz not null,
  ended_at timestamptz,
  primary key (journey_id, leg_index),
  -- a route, a direction and a fare belong to a riding leg and nowhere else
  constraint rider_journey_legs_riding_only check (
    mode = 'riding'
    or (route_name is null and direction is null and fare_cents is null)
  )
);

-- ---------------------------------------------------------------------------
-- marks: the places where something happened
-- ---------------------------------------------------------------------------
create table public.rider_journey_marks (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.rider_journeys (id) on delete cascade,
  mark_seq integer not null check (mark_seq >= 0),
  leg_index integer not null check (leg_index >= 0),
  kind public.journey_mark_kind not null,
  name text check (name is null or char_length(btrim(name)) between 2 and 60),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy_m real check (accuracy_m >= 0),
  -- two different facts the field logger silently merged into one: when the
  -- GPS last knew where the phone was, and when the rider tapped. The gap
  -- between them is how far behind the mark may be.
  recorded_at timestamptz not null,
  marked_at timestamptz not null,
  -- the personal place name this mark minted, when the rider gave it one and
  -- the naming rails accepted it
  place_name_id uuid references public.place_names (id) on delete set null,
  unique (journey_id, mark_seq)
);

create index rider_journey_marks_journey_idx
  on public.rider_journey_marks (journey_id, mark_seq);

alter table public.rider_journey_legs enable row level security;
alter table public.rider_journey_marks enable row level security;

create policy "rider journey legs select own"
  on public.rider_journey_legs for select
  to authenticated
  using (
    exists (
      select 1 from public.rider_journeys j
      where j.id = journey_id and j.rider_id = (select auth.uid())
    )
  );

create policy "rider journey marks select own"
  on public.rider_journey_marks for select
  to authenticated
  using (
    exists (
      select 1 from public.rider_journeys j
      where j.id = journey_id and j.rider_id = (select auth.uid())
    )
  );

-- no direct write path for clients; the two doors below are the only ones
revoke insert, update, delete on table public.rider_journey_legs from anon, authenticated;
revoke insert, update, delete on table public.rider_journey_marks from anon, authenticated;
revoke select on table public.rider_journey_legs from anon;
revoke select on table public.rider_journey_marks from anon;

-- ---------------------------------------------------------------------------
-- consent helpers
-- ---------------------------------------------------------------------------

-- The caller's live accepted partner consent version, or null. Same shape
-- as private.journey_consent_version (0033): the newest row in the stream
-- decides, and a withdrawal closes the door from that moment.
create or replace function private.partner_consent_version(p_uid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when cr.action = 'accepted' then cr.version end
  from public.consent_records cr
  where cr.user_id = p_uid and cr.version like 'partner%'
  order by cr.created_at desc
  limit 1;
$$;

revoke execute on function private.partner_consent_version(uuid) from public;
grant execute on function private.partner_consent_version(uuid) to service_role;

-- Caps: a hard sanity wall per journey, far above any real day of riding.
create or replace function private.journey_leg_cap()
returns integer
language sql
immutable
set search_path = ''
as $$ select 60 $$;

create or replace function private.journey_mark_cap()
returns integer
language sql
immutable
set search_path = ''
as $$ select 200 $$;

revoke execute on function private.journey_leg_cap() from public;
revoke execute on function private.journey_mark_cap() from public;
grant execute on function private.journey_leg_cap() to service_role;
grant execute on function private.journey_mark_cap() to service_role;

-- ---------------------------------------------------------------------------
-- Door 1 (amended): opening a recording now stamps the partner consent that
-- covers it, when one is live. Same signature, same behaviour for everyone
-- who is not a partner: the column stays null and nothing downstream sees
-- the trip. Still idempotent per journey id.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_rider_journey(
  p_journey uuid,
  p_mode public.journey_mode,
  p_started_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_consent text;
  v_partner text;
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  v_consent := private.journey_consent_version(v_uid);
  if v_consent is null then
    raise exception 'journey consent missing';
  end if;
  v_partner := private.partner_consent_version(v_uid);

  select rider_id into v_owner from public.rider_journeys where id = p_journey;
  if v_owner is not null then
    if v_owner <> v_uid then
      raise exception 'not your journey';
    end if;
    return;
  end if;

  insert into public.rider_journeys
      (id, rider_id, mode, consent_version, partner_consent_version, started_at)
    values (p_journey, v_uid, p_mode, v_consent, v_partner, p_started_at);
end;
$$;

-- ---------------------------------------------------------------------------
-- Door 2 (amended): a trace point may now carry the leg it was captured on.
-- The key is optional, so a client that does not send it lands leg 0 exactly
-- as before. Everything else is unchanged: first sync wins, the batch
-- ceiling stands, and the row count returned is how many were new.
-- ---------------------------------------------------------------------------
create or replace function public.append_rider_journey_points(
  p_journey uuid,
  p_points jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_status public.journey_status;
  v_owner uuid;
  v_count integer;
  v_existing integer;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if jsonb_typeof(p_points) <> 'array' then
    raise exception 'points must be an array';
  end if;
  if jsonb_array_length(p_points) > 500 then
    raise exception 'batch too large';
  end if;

  select rider_id, status into v_owner, v_status
    from public.rider_journeys where id = p_journey;
  if v_owner is null or v_owner <> v_uid then
    raise exception 'not your journey';
  end if;
  if v_status <> 'recording' then
    raise exception 'journey is not recording';
  end if;

  select count(*) into v_existing
    from public.rider_journey_points where journey_id = p_journey;
  if v_existing + jsonb_array_length(p_points) > private.journey_point_cap() then
    raise exception 'journey point cap reached';
  end if;

  insert into public.rider_journey_points
      (journey_id, seq, lat, lng, accuracy_m, recorded_at, leg_index)
    select
      p_journey,
      (pt->>'seq')::integer,
      (pt->>'lat')::double precision,
      (pt->>'lng')::double precision,
      (pt->>'accuracy_m')::real,
      (pt->>'recorded_at')::timestamptz,
      greatest(coalesce((pt->>'leg_index')::integer, 0), 0)
    from jsonb_array_elements(p_points) as pt
    on conflict (journey_id, seq) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Door 5: the leg set of a recording. Partner only.
--
-- Legs are not history the way a trace point is: the leg you are on has no
-- end until you get off it, and the rider can correct the route they typed
-- on a moving kombi. So this door takes the whole current set and settles
-- it, rather than appending. It is still narrow: only your own journey,
-- only while it is recording, only under a live partner consent, and the
-- shape is checked field by field before anything lands.
--
-- Returns how many legs the journey holds afterwards.
-- ---------------------------------------------------------------------------
create or replace function public.save_rider_journey_legs(
  p_journey uuid,
  p_legs jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_owner uuid;
  v_status public.journey_status;
  v_partner text;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  v_partner := private.partner_consent_version(v_uid);
  if v_partner is null then
    raise exception 'partner consent missing';
  end if;
  if jsonb_typeof(p_legs) <> 'array' then
    raise exception 'legs must be an array';
  end if;
  if jsonb_array_length(p_legs) > private.journey_leg_cap() then
    raise exception 'journey leg cap reached';
  end if;

  select rider_id, status into v_owner, v_status
    from public.rider_journeys where id = p_journey;
  if v_owner is null or v_owner <> v_uid then
    raise exception 'not your journey';
  end if;
  if v_status <> 'recording' then
    raise exception 'journey is not recording';
  end if;

  -- the stamp is set once and never rewritten, so turning partner mode on
  -- mid trip works and the recorded fact stays the first one that applied
  update public.rider_journeys
    set partner_consent_version = coalesce(partner_consent_version, v_partner)
    where id = p_journey;

  delete from public.rider_journey_legs where journey_id = p_journey;

  insert into public.rider_journey_legs
      (journey_id, leg_index, mode, route_name, direction, fare_cents,
       started_at, ended_at)
    select
      p_journey,
      greatest((leg->>'leg_index')::integer, 0),
      (leg->>'mode')::public.journey_leg_mode,
      case when (leg->>'mode') = 'riding'
        then nullif(btrim(coalesce(leg->>'route_name', '')), '') end,
      case when (leg->>'mode') = 'riding'
        then nullif(leg->>'direction', '')::public.route_direction end,
      case when (leg->>'mode') = 'riding'
        then (leg->>'fare_cents')::integer end,
      (leg->>'started_at')::timestamptz,
      nullif(leg->>'ended_at', '')::timestamptz
    from jsonb_array_elements(p_legs) as leg;

  select count(*) into v_count
    from public.rider_journey_legs where journey_id = p_journey;
  return v_count;
end;
$$;

revoke execute on function public.save_rider_journey_legs(uuid, jsonb) from public, anon;
grant execute on function public.save_rider_journey_legs(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Door 6: one marked stop. Partner only, idempotent on (journey, mark_seq)
-- so a replayed sync never doubles a mark.
--
-- A named mark is offered to the naming layer through public.submit_place_name
-- (0038), which means it meets the same wordlist screen, the same 20 a day
-- cap and the same burst rail as a name typed on the places screen, and is
-- born personal like every other. If the rails refuse it, the mark still
-- lands: the geometry is a fact the rider recorded, the name is only a
-- proposal. The outcome is returned so the phone can say which happened.
-- ---------------------------------------------------------------------------
create or replace function public.add_rider_journey_mark(
  p_journey uuid,
  p_mark_seq integer,
  p_leg_index integer,
  p_kind public.journey_mark_kind,
  p_name text,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m real,
  p_recorded_at timestamptz,
  p_marked_at timestamptz
)
returns table (mark_id uuid, name_outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_owner uuid;
  v_partner text;
  v_existing uuid;
  v_marks integer;
  v_name text;
  v_kind public.place_kind;
  v_outcome text := 'none';
  v_place uuid;
  v_new uuid;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  v_partner := private.partner_consent_version(v_uid);
  if v_partner is null then
    raise exception 'partner consent missing';
  end if;
  if p_lat is null or p_lng is null
     or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'mark needs a position';
  end if;

  select rider_id into v_owner
    from public.rider_journeys where id = p_journey;
  if v_owner is null or v_owner <> v_uid then
    raise exception 'not your journey';
  end if;

  -- a replayed sync finds its own row and changes nothing
  select id into v_existing
    from public.rider_journey_marks
    where journey_id = p_journey and mark_seq = p_mark_seq;
  if v_existing is not null then
    return query select v_existing, 'existing'::text;
    return;
  end if;

  select count(*) into v_marks
    from public.rider_journey_marks where journey_id = p_journey;
  if v_marks >= private.journey_mark_cap() then
    raise exception 'journey mark cap reached';
  end if;

  update public.rider_journeys
    set partner_consent_version = coalesce(partner_consent_version, v_partner)
    where id = p_journey;

  v_name := nullif(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), '');
  if v_name is not null and char_length(v_name) between 2 and 60 then
    -- a stop, a rank and a terminal are all places you board or leave a
    -- kombi; only a landmark is something else
    v_kind := case when p_kind = 'landmark' then 'landmark' else 'stop' end;
    select outcome, place_id into v_outcome, v_place
      from public.submit_place_name(v_name, v_kind, p_lat, p_lng, null);
  end if;

  insert into public.rider_journey_marks
      (journey_id, mark_seq, leg_index, kind, name, lat, lng, accuracy_m,
       recorded_at, marked_at, place_name_id)
    values (
      p_journey,
      greatest(p_mark_seq, 0),
      greatest(coalesce(p_leg_index, 0), 0),
      p_kind,
      v_name,
      p_lat,
      p_lng,
      p_accuracy_m,
      p_recorded_at,
      p_marked_at,
      v_place
    )
    returning id into v_new;

  return query select v_new, v_outcome;
end;
$$;

revoke execute on function public.add_rider_journey_mark(
  uuid, integer, integer, public.journey_mark_kind, text,
  double precision, double precision, real, timestamptz, timestamptz
) from public, anon;
grant execute on function public.add_rider_journey_mark(
  uuid, integer, integer, public.journey_mark_kind, text,
  double precision, double precision, real, timestamptz, timestamptz
) to authenticated;

-- ---------------------------------------------------------------------------
-- anonymise_me learns the partner stream. Legs and marks cascade with the
-- journeys they belong to (already the case through the foreign keys); the
-- withdrawal is appended so the partner door is shut as well as the journey
-- one, and the app stream pick keeps excluding every side stream (the 0024
-- lesson, now with three exclusions instead of two).
-- ---------------------------------------------------------------------------
create or replace function public.anonymise_me()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_version text;
  v_journey_version text;
  v_partner_version text;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  select version into v_version
    from public.consent_records
    where user_id = v_uid and action = 'accepted'
      and version not like 'emergency%'
      and version not like 'journey%'
      and version not like 'partner%'
    order by created_at desc
    limit 1;

  update public.profiles
    set full_name = '', phone = null, anonymised_at = now()
    where id = v_uid;

  delete from public.saved_trips where rider_id = v_uid;
  delete from public.rider_prefs where rider_id = v_uid;

  if exists (select 1 from public.emergency_details where rider_id = v_uid) then
    insert into public.consent_records (user_id, action, version)
      values (v_uid, 'withdrawn', 'emergency-v1');
  end if;
  delete from public.emergency_details where rider_id = v_uid;

  v_journey_version := private.journey_consent_version(v_uid);
  if v_journey_version is not null then
    insert into public.consent_records (user_id, action, version)
      values (v_uid, 'withdrawn', v_journey_version);
  end if;
  v_partner_version := private.partner_consent_version(v_uid);
  if v_partner_version is not null then
    insert into public.consent_records (user_id, action, version)
      values (v_uid, 'withdrawn', v_partner_version);
  end if;

  -- feedback and mismatches go first (mismatches also cascade from
  -- journeys, this makes the intent explicit), then places, then journeys
  -- (which take their legs and marks with them)
  delete from public.trip_feedback where rider_id = v_uid;
  delete from public.plan_trace_mismatches where rider_id = v_uid;
  delete from public.place_names where author_id = v_uid and scope = 'personal';
  delete from public.shortcut_paths where author_id = v_uid and scope = 'personal';
  delete from public.rider_journeys where rider_id = v_uid;

  update public.guardian_links
    set status = 'revoked', revoked_at = now()
    where status <> 'revoked'
      and (guardian_id = v_uid or child_id = v_uid);

  insert into public.consent_records (user_id, action, version)
    values (v_uid, 'withdrawn', coalesce(v_version, 'v1'));
end;
$$;
