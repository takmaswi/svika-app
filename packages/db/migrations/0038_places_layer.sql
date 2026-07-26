-- 0038 places layer: nicknames, shortcuts, suggested names (batch M3)
--
-- Riders name the city the way the city actually talks. Ruling applied:
-- personal first, promote by consensus. Nothing a user types is public on
-- submission; a name is born personal (visible only to its author), becomes
-- suggested when three independent authors log a similar name at the same
-- spot, and becomes public when riders keep accepting the suggestion. Every
-- promotion APPENDS a new community row plus a place_events row; history is
-- never rewritten.
--
-- All of this is rules, deliberately not AI (AI-USAGE-MAP.md carries the
-- row): pg_trgm string similarity, a PostGIS radius, and counting distinct
-- authors. Shortcuts ride the same machinery with a Hausdorff distance in
-- metres (UTM 36S, Harare's zone) instead of string similarity.
--
-- Doors and walls, in the 0033 posture:
--   * append only in grants: clients never INSERT/UPDATE/DELETE directly,
--     the RPCs below are the only doors; the true history tables
--     (place_events, place_reports, place_submission_attempts) also carry
--     the forbid_mutation trigger,
--   * RLS from birth: personal rows visible only to the author; suggested
--     and public rows readable by everyone including guests (community
--     knowledge is the product),
--   * safety rails: per author daily caps plus the house burst rule (five
--     rejected attempts in ten minutes locks for the window), a bilingual
--     wordlist screen BEFORE even a personal save, a report door on
--     community names (three distinct reporters hide a name), and no rail
--     ever names a person: events carry counts, never author lists,
--   * independence rail: an author's voice counts toward consensus only
--     when their account predates the submission by 48 hours, so one person
--     minting three fresh accounts today cannot promote a name today. This
--     raises the cost of a sock puppet run; it does not claim to end fraud,
--     and the constant is recorded for Mhofu's ruling in the gate report.
--
-- Constants proposed (gate report lists them for ratification):
--   names: 120 m radius, 0.45 trigram similarity, 3 authors to suggested,
--   5 distinct accepting authors to public, 48 h account age;
--   shortcuts: 120 m Hausdorff, 3 authors to suggested, 5 to public;
--   caps: 20 names / 10 shortcuts / 10 reports per author per day.
--
-- The promotion job is a scheduled rule pass (pg_cron, every 15 minutes),
-- not a model. The attempt log stores outcomes only, never the typed name:
-- a rejected name is not ours to keep.

create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pg_cron;

create type public.place_kind as enum ('stop', 'place', 'gate', 'landmark');
create type public.place_scope as enum ('personal', 'suggested', 'public');
create type public.place_event_kind as enum
  ('promoted_suggested', 'promoted_public', 'hidden');

-- ---------------------------------------------------------------------------
-- tables
-- ---------------------------------------------------------------------------

create table public.place_names (
  id uuid primary key default gen_random_uuid(),
  -- null author marks a community row minted by the promotion job; personal
  -- rows always carry their author (enforced below)
  author_id uuid references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 60),
  kind public.place_kind not null default 'place',
  scope public.place_scope not null default 'personal',
  location extensions.geography(point, 4326) not null,
  -- the suggested/public row this personal row adopted by tap, if any:
  -- the acceptance signal that drives suggested -> public
  accepted_from uuid references public.place_names (id),
  -- for a public row, the suggested row it grew out of; a row with a
  -- successor stops rendering (the successor speaks for it)
  promoted_from uuid references public.place_names (id),
  created_at timestamptz not null default now(),
  constraint place_names_scope_author check (
    (scope = 'personal' and author_id is not null)
    or (scope <> 'personal' and author_id is null)
  )
);

create index place_names_location_gix on public.place_names using gist (location);
create index place_names_name_trgm on public.place_names
  using gin (name extensions.gin_trgm_ops);
create index place_names_author_idx on public.place_names (author_id, created_at desc);
create index place_names_accepted_idx on public.place_names (accepted_from)
  where accepted_from is not null;
create index place_names_promoted_idx on public.place_names (promoted_from)
  where promoted_from is not null;

create table public.shortcut_paths (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles (id) on delete cascade,
  scope public.place_scope not null default 'personal',
  path extensions.geography(linestring, 4326) not null,
  -- the saved walking journey this shortcut came from; the trace stays the
  -- rider's, the shortcut is the flagged shape
  source_journey_id uuid references public.rider_journeys (id) on delete set null,
  promoted_from uuid references public.shortcut_paths (id),
  distance_m integer check (distance_m >= 0),
  created_at timestamptz not null default now(),
  constraint shortcut_paths_scope_author check (
    (scope = 'personal' and author_id is not null)
    or (scope <> 'personal' and author_id is null)
  )
);

create index shortcut_paths_path_gix on public.shortcut_paths using gist (path);
create index shortcut_paths_author_idx on public.shortcut_paths (author_id, created_at desc);
create index shortcut_paths_promoted_idx on public.shortcut_paths (promoted_from)
  where promoted_from is not null;
-- one shortcut per journey: flagging twice returns the first row
create unique index shortcut_paths_source_journey_uidx
  on public.shortcut_paths (source_journey_id)
  where source_journey_id is not null;

-- every promotion or hide is an appended event, never an UPDATE of history
create table public.place_events (
  id bigint generated always as identity primary key,
  kind public.place_event_kind not null,
  place_name_id uuid references public.place_names (id) on delete cascade,
  shortcut_id uuid references public.shortcut_paths (id) on delete cascade,
  -- counts only, never author or reporter lists: rails flag patterns, not
  -- people
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (num_nonnulls(place_name_id, shortcut_id) = 1)
);

create index place_events_name_idx on public.place_events (place_name_id)
  where place_name_id is not null;
create index place_events_shortcut_idx on public.place_events (shortcut_id)
  where shortcut_id is not null;

create table public.place_reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  place_name_id uuid not null references public.place_names (id) on delete cascade,
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  unique (reporter_id, place_name_id)
);

create index place_reports_place_idx on public.place_reports (place_name_id);

-- outcome log for the rails; stores outcomes only, never the typed name
create table public.place_submission_attempts (
  id bigint generated always as identity primary key,
  rider_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('name', 'shortcut', 'report')),
  outcome text not null check (
    outcome in ('success', 'blocked_word', 'rate_limited', 'invalid')
  ),
  attempted_at timestamptz not null default now()
);

create index place_submission_attempts_rate_idx
  on public.place_submission_attempts (rider_id, attempted_at desc);

-- ---------------------------------------------------------------------------
-- RLS and grants
-- ---------------------------------------------------------------------------

alter table public.place_names enable row level security;
alter table public.shortcut_paths enable row level security;
alter table public.place_events enable row level security;
alter table public.place_reports enable row level security;
alter table public.place_submission_attempts enable row level security;

create policy "place names select own personal"
  on public.place_names for select
  to authenticated
  using (author_id = (select auth.uid()));

create policy "place names select community"
  on public.place_names for select
  to anon, authenticated
  using (scope <> 'personal');

create policy "shortcut paths select own personal"
  on public.shortcut_paths for select
  to authenticated
  using (author_id = (select auth.uid()));

create policy "shortcut paths select community"
  on public.shortcut_paths for select
  to anon, authenticated
  using (scope <> 'personal');

-- events only ever target community rows (the promotion job is the only
-- writer); the policy is the second wall saying exactly that
create policy "place events select community"
  on public.place_events for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.place_names n
      where n.id = place_name_id and n.scope <> 'personal'
    )
    or exists (
      select 1 from public.shortcut_paths s
      where s.id = shortcut_id and s.scope <> 'personal'
    )
  );

create policy "place reports select own"
  on public.place_reports for select
  to authenticated
  using (reporter_id = (select auth.uid()));

create policy "place submission attempts select own"
  on public.place_submission_attempts for select
  to authenticated
  using (rider_id = (select auth.uid()));

-- no direct write path for clients; the RPCs below are the only doors
revoke insert, update, delete on table public.place_names from anon, authenticated;
revoke insert, update, delete on table public.shortcut_paths from anon, authenticated;
revoke insert, update, delete on table public.place_events from anon, authenticated;
revoke insert, update, delete on table public.place_reports from anon, authenticated;
revoke insert, update, delete on table public.place_submission_attempts from anon, authenticated;
revoke select on table public.place_reports from anon;
revoke select on table public.place_submission_attempts from anon;

-- the true history tables are append only for everyone, service role
-- maintenance excepted (0001 pattern)
create trigger place_events_append_only
  before update or delete on public.place_events
  for each row execute function public.forbid_mutation();
create trigger place_reports_append_only
  before update or delete on public.place_reports
  for each row execute function public.forbid_mutation();
create trigger place_submission_attempts_append_only
  before update or delete on public.place_submission_attempts
  for each row execute function public.forbid_mutation();

-- ---------------------------------------------------------------------------
-- live read views: what actually renders and gets searched.
-- security_invoker so the base table RLS decides row by row: a guest sees
-- community rows, an author additionally sees their own personal rows.
-- Hidden names and rows with a successor drop out here, not by UPDATE.
-- ---------------------------------------------------------------------------

create view public.place_names_live
with (security_invoker = true)
as
select
  p.id,
  p.name,
  p.kind,
  p.scope,
  extensions.st_y(p.location::extensions.geometry) as lat,
  extensions.st_x(p.location::extensions.geometry) as lng,
  p.created_at
from public.place_names p
where not exists (
    select 1 from public.place_events e
    where e.place_name_id = p.id and e.kind = 'hidden'
  )
  and not exists (
    select 1 from public.place_names c where c.promoted_from = p.id
  );

create view public.shortcut_paths_live
with (security_invoker = true)
as
select
  s.id,
  s.scope,
  extensions.st_asgeojson(s.path) as path_geojson,
  s.distance_m,
  s.created_at
from public.shortcut_paths s
where not exists (
    select 1 from public.shortcut_paths c where c.promoted_from = s.id
  );

grant select on public.place_names_live to anon, authenticated;
grant select on public.shortcut_paths_live to anon, authenticated;

-- ---------------------------------------------------------------------------
-- wordlist screen: the same list the client screens with, enforced server
-- side before even a personal save. Word boundary match on the normalised
-- name plus a squashed-spaces check for the longer words. The list below is
-- a working draft in both languages; it needs Mhofu's and the translator's
-- ratification before submission (recorded in the gate report), and growing
-- it is a migration, deliberately: the screen's history is reviewable.
-- ---------------------------------------------------------------------------

create or replace function private.place_name_is_clean(p_name text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_norm text := lower(regexp_replace(coalesce(p_name, ''), '[^a-zA-Z]+', ' ', 'g'));
  v_squished text := replace(v_norm, ' ', '');
  v_banned text[] := array[
    -- english
    'fuck', 'shit', 'bitch', 'cunt', 'nigger', 'nigga', 'kaffir',
    'whore', 'slut', 'dick', 'pussy', 'asshole', 'bastard', 'wanker',
    -- shona (draft list, translator pass owed)
    'mboro', 'beche', 'mhata', 'hure', 'svira', 'ngochani'
  ];
  w text;
begin
  foreach w in array v_banned loop
    if v_norm ~ ('\m' || w || '\M') then
      return false;
    end if;
    if char_length(w) >= 5 and position(w in v_squished) > 0 then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

revoke execute on function private.place_name_is_clean(text) from public;
grant execute on function private.place_name_is_clean(text) to service_role;

-- ---------------------------------------------------------------------------
-- Door 1: a rider names a spot. Born personal, always. Tapping an existing
-- suggestion (p_accepted_from) adopts its name verbatim and records the
-- acceptance that drives suggested -> public.
-- ---------------------------------------------------------------------------

create or replace function public.submit_place_name(
  p_name text,
  p_kind public.place_kind,
  p_lat double precision,
  p_lng double precision,
  p_accepted_from uuid default null
)
returns table (outcome text, place_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text;
  v_kind public.place_kind := coalesce(p_kind, 'place');
  v_loc extensions.geography;
  v_burst integer;
  v_today integer;
  v_src record;
  v_new uuid;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  -- burst rail first (house pattern): five rejections in ten minutes locks
  select count(*) into v_burst
    from public.place_submission_attempts a
    where a.rider_id = v_uid and a.kind = 'name'
      and a.outcome <> 'success'
      and a.attempted_at > now() - interval '10 minutes';
  if v_burst >= 5 then
    insert into public.place_submission_attempts (rider_id, kind, outcome)
      values (v_uid, 'name', 'rate_limited');
    return query select 'rate_limited'::text, null::uuid;
    return;
  end if;

  -- daily cap: 20 names per author per day
  select count(*) into v_today
    from public.place_names p
    where p.author_id = v_uid and p.created_at > now() - interval '24 hours';
  if v_today >= 20 then
    insert into public.place_submission_attempts (rider_id, kind, outcome)
      values (v_uid, 'name', 'rate_limited');
    return query select 'rate_limited'::text, null::uuid;
    return;
  end if;

  if p_lat is null or p_lng is null
     or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    insert into public.place_submission_attempts (rider_id, kind, outcome)
      values (v_uid, 'name', 'invalid');
    return query select 'invalid'::text, null::uuid;
    return;
  end if;
  v_loc := extensions.st_setsrid(
    extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;

  if p_accepted_from is not null then
    -- adoption by tap: the source must be a live community name nearby
    select n.id, n.name, n.kind into v_src
      from public.place_names n
      where n.id = p_accepted_from
        and n.scope <> 'personal'
        and extensions.st_dwithin(n.location, v_loc, 150)
        and not exists (
          select 1 from public.place_events e
          where e.place_name_id = n.id and e.kind = 'hidden'
        );
    if v_src.id is null then
      insert into public.place_submission_attempts (rider_id, kind, outcome)
        values (v_uid, 'name', 'invalid');
      return query select 'invalid'::text, null::uuid;
      return;
    end if;
    v_name := v_src.name;
    v_kind := v_src.kind;
  else
    v_name := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
    if char_length(v_name) < 2 or char_length(v_name) > 60 then
      insert into public.place_submission_attempts (rider_id, kind, outcome)
        values (v_uid, 'name', 'invalid');
      return query select 'invalid'::text, null::uuid;
      return;
    end if;
    if not private.place_name_is_clean(v_name) then
      insert into public.place_submission_attempts (rider_id, kind, outcome)
        values (v_uid, 'name', 'blocked_word');
      return query select 'blocked_word'::text, null::uuid;
      return;
    end if;
  end if;

  insert into public.place_names (author_id, name, kind, scope, location, accepted_from)
    values (v_uid, v_name, v_kind, 'personal', v_loc, p_accepted_from)
    returning id into v_new;
  insert into public.place_submission_attempts (rider_id, kind, outcome)
    values (v_uid, 'name', 'success');
  return query select 'success'::text, v_new;
end;
$$;

revoke execute on function public.submit_place_name(text, public.place_kind, double precision, double precision, uuid) from public, anon;
grant execute on function public.submit_place_name(text, public.place_kind, double precision, double precision, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Door 2: recommended naming. A rider drops a pin and gets the community
-- names already standing nearby to tap instead of retyping. One indexed
-- nearest neighbour query, nothing else.
-- ---------------------------------------------------------------------------

create or replace function public.recommend_place_names(
  p_lat double precision,
  p_lng double precision
)
returns table (
  place_id uuid,
  name text,
  kind public.place_kind,
  scope public.place_scope,
  distance_m integer
)
language sql
stable
set search_path = ''
as $$
  select
    p.id,
    p.name,
    p.kind,
    p.scope,
    round(extensions.st_distance(
      p.location,
      extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
    ))::integer as distance_m
  from public.place_names p
  where p.scope <> 'personal'
    and extensions.st_dwithin(
      p.location,
      extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
      300)
    and not exists (
      select 1 from public.place_events e
      where e.place_name_id = p.id and e.kind = 'hidden'
    )
    and not exists (
      select 1 from public.place_names c where c.promoted_from = p.id
    )
  order by p.location operator(extensions.<->)
    extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
  limit 8;
$$;

revoke execute on function public.recommend_place_names(double precision, double precision) from public, anon;
grant execute on function public.recommend_place_names(double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------------
-- Door 3: public names are searchable the moment they are public (feeds the
-- D1 destination search alongside the OSM corpus). Trigram ranked, guests
-- included: search is a read of community knowledge.
-- ---------------------------------------------------------------------------

create or replace function public.search_public_places(p_q text)
returns table (
  place_id uuid,
  name text,
  kind public.place_kind,
  lat double precision,
  lng double precision,
  score real
)
language sql
stable
set search_path = ''
as $$
  select
    p.id,
    p.name,
    p.kind,
    extensions.st_y(p.location::extensions.geometry) as lat,
    extensions.st_x(p.location::extensions.geometry) as lng,
    extensions.similarity(lower(p.name), lower(btrim(coalesce(p_q, '')))) as score
  from public.place_names p
  where p.scope = 'public'
    and char_length(btrim(coalesce(p_q, ''))) between 2 and 60
    and (
      p.name ilike '%' || btrim(p_q) || '%'
      or extensions.similarity(lower(p.name), lower(btrim(p_q))) >= 0.3
    )
    and not exists (
      select 1 from public.place_events e
      where e.place_name_id = p.id and e.kind = 'hidden'
    )
    and not exists (
      select 1 from public.place_names c where c.promoted_from = p.id
    )
  order by score desc, p.created_at asc
  limit 10;
$$;

revoke execute on function public.search_public_places(text) from public;
grant execute on function public.search_public_places(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Door 4: a saved walking journey becomes a personal shortcut. The recorded
-- points ARE the shape; the server simplifies them (~5 m tolerance) and
-- keeps the metres honest with a geography length.
-- ---------------------------------------------------------------------------

create or replace function public.flag_journey_shortcut(p_journey uuid)
returns table (outcome text, shortcut_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_journey record;
  v_burst integer;
  v_today integer;
  v_points integer;
  v_line extensions.geometry;
  v_path extensions.geography;
  v_len integer;
  v_existing uuid;
  v_new uuid;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  select count(*) into v_burst
    from public.place_submission_attempts a
    where a.rider_id = v_uid and a.kind = 'shortcut'
      and a.outcome <> 'success'
      and a.attempted_at > now() - interval '10 minutes';
  if v_burst >= 5 then
    insert into public.place_submission_attempts (rider_id, kind, outcome)
      values (v_uid, 'shortcut', 'rate_limited');
    return query select 'rate_limited'::text, null::uuid;
    return;
  end if;

  select count(*) into v_today
    from public.shortcut_paths s
    where s.author_id = v_uid and s.created_at > now() - interval '24 hours';
  if v_today >= 10 then
    insert into public.place_submission_attempts (rider_id, kind, outcome)
      values (v_uid, 'shortcut', 'rate_limited');
    return query select 'rate_limited'::text, null::uuid;
    return;
  end if;

  select j.id, j.rider_id, j.status, j.mode into v_journey
    from public.rider_journeys j where j.id = p_journey;
  if v_journey.id is null or v_journey.rider_id <> v_uid then
    raise exception 'not your journey';
  end if;
  if v_journey.status <> 'complete' or v_journey.mode not in ('walk', 'mixed') then
    insert into public.place_submission_attempts (rider_id, kind, outcome)
      values (v_uid, 'shortcut', 'invalid');
    return query select 'invalid'::text, null::uuid;
    return;
  end if;

  -- flagging twice returns the first row (idempotent door)
  select s.id into v_existing
    from public.shortcut_paths s where s.source_journey_id = p_journey;
  if v_existing is not null then
    return query select 'success'::text, v_existing;
    return;
  end if;

  select count(*) into v_points
    from public.rider_journey_points pt where pt.journey_id = p_journey;
  if v_points < 5 then
    insert into public.place_submission_attempts (rider_id, kind, outcome)
      values (v_uid, 'shortcut', 'invalid');
    return query select 'invalid'::text, null::uuid;
    return;
  end if;

  select extensions.st_simplifypreservetopology(
      extensions.st_makeline(
        extensions.st_setsrid(extensions.st_makepoint(pt.lng, pt.lat), 4326)
        order by pt.seq),
      0.00005)
    into v_line
    from public.rider_journey_points pt
    where pt.journey_id = p_journey;
  v_path := v_line::extensions.geography;
  v_len := round(extensions.st_length(v_path))::integer;

  -- a shortcut is a walking cut through: 30 m to 5 km
  if v_len < 30 or v_len > 5000 then
    insert into public.place_submission_attempts (rider_id, kind, outcome)
      values (v_uid, 'shortcut', 'invalid');
    return query select 'invalid'::text, null::uuid;
    return;
  end if;

  insert into public.shortcut_paths (author_id, scope, path, source_journey_id, distance_m)
    values (v_uid, 'personal', v_path, p_journey, v_len)
    returning id into v_new;
  insert into public.place_submission_attempts (rider_id, kind, outcome)
    values (v_uid, 'shortcut', 'success');
  return query select 'success'::text, v_new;
end;
$$;

revoke execute on function public.flag_journey_shortcut(uuid) from public, anon;
grant execute on function public.flag_journey_shortcut(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Door 5: report a community name. Three distinct reporters hide it (an
-- appended 'hidden' event, counts only). Reporting twice is one report.
-- ---------------------------------------------------------------------------

create or replace function public.report_place_name(
  p_place uuid,
  p_reason text default null
)
returns table (outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_burst integer;
  v_today integer;
  v_target record;
  v_reporters integer;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  select count(*) into v_burst
    from public.place_submission_attempts a
    where a.rider_id = v_uid and a.kind = 'report'
      and a.outcome <> 'success'
      and a.attempted_at > now() - interval '10 minutes';
  if v_burst >= 5 then
    insert into public.place_submission_attempts (rider_id, kind, outcome)
      values (v_uid, 'report', 'rate_limited');
    return query select 'rate_limited'::text;
    return;
  end if;

  select count(*) into v_today
    from public.place_reports r
    where r.reporter_id = v_uid and r.created_at > now() - interval '24 hours';
  if v_today >= 10 then
    insert into public.place_submission_attempts (rider_id, kind, outcome)
      values (v_uid, 'report', 'rate_limited');
    return query select 'rate_limited'::text;
    return;
  end if;

  select n.id, n.scope into v_target
    from public.place_names n
    where n.id = p_place and n.scope <> 'personal';
  if v_target.id is null then
    insert into public.place_submission_attempts (rider_id, kind, outcome)
      values (v_uid, 'report', 'invalid');
    return query select 'invalid'::text;
    return;
  end if;

  insert into public.place_reports (reporter_id, place_name_id, reason)
    values (v_uid, p_place, nullif(btrim(coalesce(p_reason, '')), ''))
    on conflict (reporter_id, place_name_id) do nothing;
  insert into public.place_submission_attempts (rider_id, kind, outcome)
    values (v_uid, 'report', 'success');

  select count(distinct r.reporter_id) into v_reporters
    from public.place_reports r where r.place_name_id = p_place;
  if v_reporters >= 3 and not exists (
    select 1 from public.place_events e
    where e.place_name_id = p_place and e.kind = 'hidden'
  ) then
    insert into public.place_events (kind, place_name_id, detail)
      values ('hidden', p_place, jsonb_build_object('reports', v_reporters));
  end if;

  return query select 'success'::text;
end;
$$;

revoke execute on function public.report_place_name(uuid, text) from public, anon;
grant execute on function public.report_place_name(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The promotion job: a scheduled rule pass, deliberately not AI. Runs every
-- 15 minutes under pg_cron; the whole network is small, so a full pass is
-- cheap, and the not-exists guards make every pass idempotent.
-- ---------------------------------------------------------------------------

create or replace function private.promote_places()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_radius_m constant double precision := 120;
  c_similarity constant real := 0.45;
  c_suggest_authors constant integer := 3;
  c_public_accepts constant integer := 5;
  c_author_age constant interval := interval '48 hours';
  c_hausdorff_m constant double precision := 120;
  c_shortcut_suggest constant integer := 3;
  c_shortcut_public constant integer := 5;
  v_names_suggested integer := 0;
  v_names_public integer := 0;
  v_shortcuts_suggested integer := 0;
  v_shortcuts_public integer := 0;
  seed record;
  v_authors integer;
  v_name text;
  v_kind public.place_kind;
  v_loc extensions.geography;
  v_new uuid;
begin
  -- names: personal -> suggested (three independent, established authors,
  -- similar name, same spot)
  for seed in
    select p.id, p.name, p.location
    from public.place_names p
    where p.scope = 'personal'
    order by p.created_at
  loop
    if exists (
      select 1 from public.place_names c
      where c.scope <> 'personal'
        and extensions.st_dwithin(c.location, seed.location, c_radius_m)
        and extensions.similarity(lower(c.name), lower(seed.name)) >= c_similarity
    ) then
      continue;
    end if;

    select
        count(distinct p2.author_id),
        mode() within group (order by btrim(p2.name)),
        mode() within group (order by p2.kind),
        extensions.st_centroid(
          extensions.st_collect(p2.location::extensions.geometry)
        )::extensions.geography
      into v_authors, v_name, v_kind, v_loc
      from public.place_names p2
      join public.profiles pr on pr.id = p2.author_id
      where p2.scope = 'personal'
        and extensions.st_dwithin(p2.location, seed.location, c_radius_m)
        and extensions.similarity(lower(p2.name), lower(seed.name)) >= c_similarity
        and pr.created_at <= p2.created_at - c_author_age;

    if v_authors >= c_suggest_authors then
      insert into public.place_names (author_id, name, kind, scope, location)
        values (null, v_name, v_kind, 'suggested', v_loc)
        returning id into v_new;
      insert into public.place_events (kind, place_name_id, detail)
        values ('promoted_suggested', v_new, jsonb_build_object('authors', v_authors));
      v_names_suggested := v_names_suggested + 1;
    end if;
  end loop;

  -- names: suggested -> public (sustained acceptance: five distinct
  -- established authors adopted the suggestion by tap)
  for seed in
    select s.id, s.name, s.kind, s.location
    from public.place_names s
    where s.scope = 'suggested'
      and not exists (
        select 1 from public.place_names c where c.promoted_from = s.id
      )
      and not exists (
        select 1 from public.place_events e
        where e.place_name_id = s.id and e.kind = 'hidden'
      )
  loop
    select count(distinct p.author_id) into v_authors
      from public.place_names p
      join public.profiles pr on pr.id = p.author_id
      where p.accepted_from = seed.id
        and p.scope = 'personal'
        and pr.created_at <= p.created_at - c_author_age;

    if v_authors >= c_public_accepts then
      insert into public.place_names (author_id, name, kind, scope, location, promoted_from)
        values (null, seed.name, seed.kind, 'public', seed.location, seed.id)
        returning id into v_new;
      insert into public.place_events (kind, place_name_id, detail)
        values ('promoted_public', v_new, jsonb_build_object('accepts', v_authors));
      v_names_public := v_names_public + 1;
    end if;
  end loop;

  -- shortcuts: personal -> suggested (three independent, established
  -- authors walked the same cut through; Hausdorff distance in metres,
  -- UTM 36S is Harare's zone)
  for seed in
    select sp.id, sp.path, sp.distance_m
    from public.shortcut_paths sp
    where sp.scope = 'personal'
    order by sp.created_at
  loop
    if exists (
      select 1 from public.shortcut_paths c
      where c.scope <> 'personal'
        and extensions.st_hausdorffdistance(
          extensions.st_transform(c.path::extensions.geometry, 32736),
          extensions.st_transform(seed.path::extensions.geometry, 32736)
        ) <= c_hausdorff_m
    ) then
      continue;
    end if;

    select count(distinct sp2.author_id) into v_authors
      from public.shortcut_paths sp2
      join public.profiles pr on pr.id = sp2.author_id
      where sp2.scope = 'personal'
        and extensions.st_hausdorffdistance(
          extensions.st_transform(sp2.path::extensions.geometry, 32736),
          extensions.st_transform(seed.path::extensions.geometry, 32736)
        ) <= c_hausdorff_m
        and pr.created_at <= sp2.created_at - c_author_age;

    if v_authors >= c_shortcut_suggest then
      insert into public.shortcut_paths (author_id, scope, path, distance_m)
        values (null, 'suggested', seed.path, seed.distance_m)
        returning id into v_new;
      insert into public.place_events (kind, shortcut_id, detail)
        values ('promoted_suggested', v_new, jsonb_build_object('authors', v_authors));
      v_shortcuts_suggested := v_shortcuts_suggested + 1;
    end if;
  end loop;

  -- shortcuts: suggested -> public (five independent authors keep walking
  -- it; same machinery, higher bar)
  for seed in
    select s.id, s.path, s.distance_m
    from public.shortcut_paths s
    where s.scope = 'suggested'
      and not exists (
        select 1 from public.shortcut_paths c where c.promoted_from = s.id
      )
  loop
    select count(distinct sp.author_id) into v_authors
      from public.shortcut_paths sp
      join public.profiles pr on pr.id = sp.author_id
      where sp.scope = 'personal'
        and extensions.st_hausdorffdistance(
          extensions.st_transform(sp.path::extensions.geometry, 32736),
          extensions.st_transform(seed.path::extensions.geometry, 32736)
        ) <= c_hausdorff_m
        and pr.created_at <= sp.created_at - c_author_age;

    if v_authors >= c_shortcut_public then
      insert into public.shortcut_paths (author_id, scope, path, distance_m, promoted_from)
        values (null, 'public', seed.path, seed.distance_m, seed.id)
        returning id into v_new;
      insert into public.place_events (kind, shortcut_id, detail)
        values ('promoted_public', v_new, jsonb_build_object('authors', v_authors));
      v_shortcuts_public := v_shortcuts_public + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'names_suggested', v_names_suggested,
    'names_public', v_names_public,
    'shortcuts_suggested', v_shortcuts_suggested,
    'shortcuts_public', v_shortcuts_public
  );
end;
$$;

revoke execute on function private.promote_places() from public;
grant execute on function private.promote_places() to service_role;

-- the scheduled rule pass; idempotent to reschedule (same job name)
select cron.schedule(
  'svika_places_promote',
  '*/15 * * * *',
  'select private.promote_places()'
);

-- ---------------------------------------------------------------------------
-- anonymise_me learns the places stream: personal names and shortcuts are
-- the rider's and go with the rider. Community rows (author already null)
-- are aggregated knowledge and stay, exactly like promoted history should.
-- Attempt logs carry outcomes only (never the typed name), so they stay as
-- rate limit history, the guardian_link_attempts precedent.
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
  -- personal places go before the journeys they may have come from
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
