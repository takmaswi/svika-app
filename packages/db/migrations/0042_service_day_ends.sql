-- 0042 service day ends (batch V7, last kombi countdown)
--
-- "The last Kuwadzana kombi is usually gone by 8:40pm" is a fact about a
-- route's evenings, and the only place that fact can come from is the fare
-- ledger: the last fare cleared on a route on a given day is when its service
-- was last seen running. This migration ships the observation layer only. The
-- percentile, the fallback and the warning rule all live in
-- packages/shared/src/last-kombi.ts, where they are unit tested; the database
-- counts, it does not decide.
--
-- Two honest problems and how they are handled:
--
-- 1. A day with one or two fares is not evidence that service ended, it is
--    evidence that almost nobody used the digital ticket that day. Such a day
--    is not an observation (MIN_FARES_PER_DAY below). That rail doubles as a
--    privacy rail: an observation always describes a day several people rode,
--    never one person's last trip home.
--
-- 2. The corridor has run for days, not months, so real evenings are thin.
--    synthetic_service_days holds a clearly labelled generated evening
--    history for the demo corridor (generator: packages/db/seed/service-days.mjs,
--    committed and reviewable), exactly the way the watchdog's synthetic
--    ticket history works in 0020. It NEVER touches tickets, ticket_events or
--    the ledger. The RPC returns real and synthetic observations separately
--    labelled, the app says which it is reading, and the dataset statement
--    documents the generator. If the real history ever outgrows the synthetic
--    one the synthetic rows can simply be deleted; nothing depends on them.

create table public.synthetic_service_days (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes (id) on delete cascade,
  direction public.route_direction not null,
  day date not null,
  -- local (Africa/Harare) minute of day the last fare cleared, 0..1439
  last_fare_minute smallint not null check (last_fare_minute between 0 and 1439),
  fares integer not null check (fares > 0),
  data_source text not null default 'synthetic' check (data_source = 'synthetic'),
  generated_at timestamptz not null default now(),
  unique (route_id, direction, day)
);

alter table public.synthetic_service_days enable row level security;

-- No policies at all: this table is service role write and RPC read. Derived,
-- regenerable data, so (like 0020) it carries no append only trigger.
revoke all on table public.synthetic_service_days from anon, authenticated;

create index synthetic_service_days_route_idx
  on public.synthetic_service_days (route_id, direction, day desc);

-- M4 slice: the real observation query groups redeemed events by route and
-- local date. tickets already indexes route_id; ticket_events gets the
-- ticket + type reach it needs for this join.
create index if not exists ticket_events_redeemed_recent_idx
  on public.ticket_events (created_at desc)
  where event_type = 'redeemed';

-- ---------------------------------------------------------------------------
-- service_day_ends: one row per observed day, real rows first.
--
-- Aggregates only: a route, a date, a minute of day and how many fares that
-- day carried. No rider, ticket, conductor or vehicle leaves this function,
-- which is why (like the kombi board) it can face a guest: a rider planning
-- an evening trip without an account needs this warning most of all.
-- ---------------------------------------------------------------------------
create or replace function public.service_day_ends(
  p_route uuid,
  p_direction public.route_direction,
  p_days integer default 90
)
returns table (
  day date,
  weekday integer,
  last_fare_minute integer,
  fares integer,
  data_source text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  -- a day with fewer fares than this is not evidence of anything
  c_min_fares_per_day constant integer := 3;
  v_days integer := least(greatest(coalesce(p_days, 90), 7), 365);
begin
  return query
  with real_days as (
    select
      (e.created_at at time zone 'Africa/Harare')::date as d,
      max(
        extract(hour from (e.created_at at time zone 'Africa/Harare')) * 60
        + extract(minute from (e.created_at at time zone 'Africa/Harare'))
      )::integer as last_minute,
      count(*)::integer as day_fares
    from public.ticket_events e
    join public.tickets t on t.id = e.ticket_id
    where e.event_type = 'redeemed'
      and t.route_id = p_route
      and t.direction = p_direction
      and e.created_at >= now() - (v_days || ' days')::interval
    group by 1
    having count(*) >= c_min_fares_per_day
  ),
  synthetic as (
    select s.day as d, s.last_fare_minute::integer as last_minute, s.fares as day_fares
    from public.synthetic_service_days s
    where s.route_id = p_route
      and s.direction = p_direction
      and s.day >= (now() at time zone 'Africa/Harare')::date - v_days
      and s.fares >= c_min_fares_per_day
      -- a real day always wins over a generated one for the same date
      and not exists (select 1 from real_days r where r.d = s.day)
  ),
  merged as (
    select d, last_minute, day_fares, 'real'::text as src from real_days
    union all
    select d, last_minute, day_fares, 'synthetic'::text as src from synthetic
  )
  select
    m.d,
    extract(isodow from m.d)::integer,
    m.last_minute,
    m.day_fares,
    m.src
  from merged m
  order by m.d desc;
end;
$$;

revoke execute on function public.service_day_ends(uuid, public.route_direction, integer)
  from public;
grant execute on function public.service_day_ends(uuid, public.route_direction, integer)
  to anon, authenticated;
