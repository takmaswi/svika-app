-- 0033 rider journeys and journey points (batch M1)
-- A rider records a real trip from their own phone. Named rider_journeys
-- because public.journeys is already taken: 0019 owns it for the field data
-- ingest pipeline (service role writes, route bound, spine training data).
-- These tables are the opposite animal: rider owned, client fed through
-- RPCs, no route required (a walk is a journey), consent stamped.
--
-- rider_journeys carry the trip facts, rider_journey_points the GPS trace,
-- both append only in spirit and in grants. The trace is personal location
-- data, so the doors are narrow:
--   * a rider reads only their own rows (RLS from birth),
--   * clients have no direct write path; the four RPCs below are the doors,
--   * upload requires a live accepted journey consent (the journey-v1
--     stream in the 0021 consent_records machinery); without it nothing
--     reaches the server and the trace stays on the device,
--   * points are first sync wins: a replayed batch can never overwrite a
--     point already landed (on conflict do nothing), and the RPC reports
--     how many rows were new so the client can flag conflicts,
--   * discarding a recording deletes its points: an unsaved trace is not
--     history to keep, it is data the rider chose not to hand over.
-- anonymise_me() learns the new stream: journey rows go with the rider, and
-- the app stream pick must not be stolen by a journey consent row (same
-- lesson as 0024's emergency fix).
-- Server side this is storage, nothing clever: no map matching, no analysis
-- (docs/PRODUCTION-PUSH-PLAN.md M1.5).

create type public.journey_mode as enum ('kombi', 'walk', 'mixed');
create type public.journey_status as enum ('recording', 'complete', 'discarded');

create table public.rider_journeys (
  -- minted on the phone so an offline recording owns its id before the
  -- server ever hears of it
  id uuid primary key,
  rider_id uuid not null references public.profiles (id) on delete cascade,
  name text check (char_length(name) <= 80),
  mode public.journey_mode not null default 'walk',
  status public.journey_status not null default 'recording',
  -- which accepted journey consent covered the upload, a recorded fact
  consent_version text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  -- the trip summary the rider saw and saved; the server does not recompute
  distance_m integer check (distance_m >= 0),
  created_at timestamptz not null default now()
);

create index rider_journeys_rider_idx
  on public.rider_journeys (rider_id, created_at desc);

create table public.rider_journey_points (
  journey_id uuid not null references public.rider_journeys (id) on delete cascade,
  seq integer not null check (seq >= 0),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy_m real check (accuracy_m >= 0),
  recorded_at timestamptz not null,
  primary key (journey_id, seq)
);

alter table public.rider_journeys enable row level security;
alter table public.rider_journey_points enable row level security;

create policy "rider journeys select own"
  on public.rider_journeys for select
  to authenticated
  using (rider_id = (select auth.uid()));

create policy "rider journey points select own"
  on public.rider_journey_points for select
  to authenticated
  using (
    exists (
      select 1 from public.rider_journeys j
      where j.id = journey_id and j.rider_id = (select auth.uid())
    )
  );

-- no direct write path for clients; the RPCs below are the only doors
revoke insert, update, delete on table public.rider_journeys from anon, authenticated;
revoke insert, update, delete on table public.rider_journey_points from anon, authenticated;
revoke select on table public.rider_journeys from anon;
revoke select on table public.rider_journey_points from anon;

-- One journey may hold at most this many points: a hard sanity wall against
-- a runaway client, far above any real day of riding.
create or replace function private.journey_point_cap()
returns integer
language sql
immutable
set search_path = ''
as $$ select 100000 $$;

-- The caller's live accepted journey consent version, or null.
create or replace function private.journey_consent_version(p_uid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when cr.action = 'accepted' then cr.version end
  from public.consent_records cr
  where cr.user_id = p_uid and cr.version like 'journey%'
  order by cr.created_at desc
  limit 1;
$$;

-- both helpers are called only from inside the definer RPCs below; no
-- client role ever needs them (0006 pattern)
revoke execute on function private.journey_point_cap() from public;
revoke execute on function private.journey_consent_version(uuid) from public;
grant execute on function private.journey_point_cap() to service_role;
grant execute on function private.journey_consent_version(uuid) to service_role;

-- Door 1: a recording announces itself. Idempotent per journey id so an
-- interrupted sync can call again without harm.
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
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  v_consent := private.journey_consent_version(v_uid);
  if v_consent is null then
    raise exception 'journey consent missing';
  end if;

  select rider_id into v_owner from public.rider_journeys where id = p_journey;
  if v_owner is not null then
    if v_owner <> v_uid then
      raise exception 'not your journey';
    end if;
    return;
  end if;

  insert into public.rider_journeys (id, rider_id, mode, consent_version, started_at)
    values (p_journey, v_uid, p_mode, v_consent, p_started_at);
end;
$$;

revoke execute on function public.upsert_rider_journey(uuid, public.journey_mode, timestamptz) from public, anon;
grant execute on function public.upsert_rider_journey(uuid, public.journey_mode, timestamptz) to authenticated;

-- Door 2: a batch of trace points. First sync wins: a seq already landed is
-- never overwritten. Returns how many rows were new so the client can flag
-- a conflicted replay instead of silently trusting it. A batch carries at
-- most 500 points; a 20 minute recording at the tightest sampling is ~400,
-- so batches stay small without ever needing to hit the wall.
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
      (journey_id, seq, lat, lng, accuracy_m, recorded_at)
    select
      p_journey,
      (pt->>'seq')::integer,
      (pt->>'lat')::double precision,
      (pt->>'lng')::double precision,
      (pt->>'accuracy_m')::real,
      (pt->>'recorded_at')::timestamptz
    from jsonb_array_elements(p_points) as pt
    on conflict (journey_id, seq) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.append_rider_journey_points(uuid, jsonb) from public, anon;
grant execute on function public.append_rider_journey_points(uuid, jsonb) to authenticated;

-- Door 3: the rider saves the trip. One transition, recording to complete;
-- the points are history and stay exactly as they landed.
create or replace function public.complete_rider_journey(
  p_journey uuid,
  p_name text,
  p_mode public.journey_mode,
  p_ended_at timestamptz,
  p_distance_m integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_count integer;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if p_name is not null and char_length(p_name) > 80 then
    raise exception 'name too long';
  end if;

  update public.rider_journeys
    set status = 'complete',
        name = nullif(trim(p_name), ''),
        mode = p_mode,
        ended_at = p_ended_at,
        distance_m = greatest(p_distance_m, 0)
    where id = p_journey and rider_id = v_uid and status = 'recording';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'no recording journey to complete';
  end if;
end;
$$;

revoke execute on function public.complete_rider_journey(uuid, text, public.journey_mode, timestamptz, integer) from public, anon;
grant execute on function public.complete_rider_journey(uuid, text, public.journey_mode, timestamptz, integer) to authenticated;

-- Door 4: the rider discards the recording. The trace goes with it: an
-- unsaved trace is not history, it is personal data the rider declined to
-- keep. The journey row stays as the discarded fact.
create or replace function public.discard_rider_journey(p_journey uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_count integer;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  update public.rider_journeys
    set status = 'discarded', ended_at = coalesce(ended_at, now())
    where id = p_journey and rider_id = v_uid and status = 'recording';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'no recording journey to discard';
  end if;

  delete from public.rider_journey_points where journey_id = p_journey;
end;
$$;

revoke execute on function public.discard_rider_journey(uuid) from public, anon;
grant execute on function public.discard_rider_journey(uuid) to authenticated;

-- anonymise_me learns the journey stream: rider journeys are personal
-- location data and go with the rider (cascade takes the points), the
-- journey stream gets its own withdrawal, and the app stream pick now
-- excludes journey consents exactly as it excludes emergency ones (the
-- 0024 lesson).
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
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  select version into v_version
    from public.consent_records
    where user_id = v_uid and action = 'accepted'
      and version not like 'emergency%'
      and version not like 'journey%'
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
  delete from public.rider_journeys where rider_id = v_uid;

  insert into public.consent_records (user_id, action, version)
    values (v_uid, 'withdrawn', coalesce(v_version, 'v1'));
end;
$$;
