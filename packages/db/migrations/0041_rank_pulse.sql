-- 0041 rank pulse (batch V5)
--
-- The gap this closes: redeem_board_code has accepted p_vehicle since 0018,
-- but the hwindi surface never sent one, so every ticket_events row carried a
-- null vehicle_id and the kombi board could only ever read the unverified
-- default (K1). Ruled by Mhofu 2026-07-26: the conductor's shift gains one
-- step, "which kombi are you on today", and every clear from that shift
-- stamps the vehicle. That single declaration is what makes a per kombi fill
-- state possible at all. It is a shift declaration and nothing more: no crew
-- identity, no roster, no assignment, no dispatch (N1 stays out of scope).
--
-- Two things ship here:
--   1. conductor_vehicles(): the picker's list. Riders still cannot read the
--      vehicles table (owner scoped since 0001); this security definer door
--      returns only the fleet the calling conductor already works for, and
--      only the two fields the picker shows.
--   2. kombi_board() v3: the same aggregate contract as 0032/0037 plus the
--      rank pulse pair. pulse_fares counts fares cleared on that vehicle
--      inside a short named window; pulse_window_minutes ships the window
--      itself so the app never hardcodes a number the database chose.
--
-- Rank pulse is a COUNT, not AI (AI-USAGE-MAP.md). Counted fares against
-- declared seats, thresholds named in apps/web/src/lib/kombi/pulse.ts. It
-- describes a vehicle's ledger in the last few minutes, never a person, and
-- no rider id, conductor id or ticket id leaves this function.

-- ---------------------------------------------------------------------------
-- The pulse window. Short on purpose: a rank fills in minutes, and a stale
-- count would read as a promise. Kept in one place, returned to the caller.
-- ---------------------------------------------------------------------------
create or replace function private.pulse_window()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '20 minutes';
$$;

revoke execute on function private.pulse_window() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- M4 slice: every kombi_board lateral scans ticket_events by vehicle over a
-- time window, and the only index on that table is (ticket_id, created_at).
-- The partial index matches all four laterals and the new pulse count.
-- ---------------------------------------------------------------------------
create index if not exists ticket_events_vehicle_recent_idx
  on public.ticket_events (vehicle_id, created_at desc)
  where event_type = 'redeemed';

-- ---------------------------------------------------------------------------
-- conductor_vehicles: the shift picker's list, own fleet only.
-- ---------------------------------------------------------------------------
create or replace function public.conductor_vehicles()
returns table (id uuid, plate text, capacity smallint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select c.owner_id into v_owner
  from public.conductors c
  where c.profile_id = v_uid and c.active;
  if not found then
    raise exception 'not an active conductor';
  end if;

  return query
  select v.id, v.plate, v.capacity
  from public.vehicles v
  where v.owner_id = v_owner
    and v.active
  order by v.plate;
end;
$$;

revoke execute on function public.conductor_vehicles() from public, anon;
grant execute on function public.conductor_vehicles() to authenticated;

-- ---------------------------------------------------------------------------
-- kombi_board v3: 0037's guest readable aggregates plus the rank pulse pair.
-- ---------------------------------------------------------------------------
drop function public.kombi_board();

create or replace function public.kombi_board()
returns table (
  plate text,
  capacity smallint,
  verified_fares_30d bigint,
  fare_days_30d bigint,
  peak_hour_load_30d bigint,
  drift_days_30d bigint,
  last_verified_at timestamptz,
  pulse_fares bigint,
  pulse_window_minutes integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_window interval := private.pulse_window();
begin
  return query
  select
    v.plate,
    v.capacity,
    coalesce(agg.fares, 0)::bigint as verified_fares_30d,
    coalesce(agg.days, 0)::bigint as fare_days_30d,
    peak.peak_hour::bigint as peak_hour_load_30d,
    coalesce(drift.days, 0)::bigint as drift_days_30d,
    agg.last_at as last_verified_at,
    coalesce(pulse.fares, 0)::bigint as pulse_fares,
    (extract(epoch from v_window) / 60)::integer as pulse_window_minutes
  from public.vehicles v
  left join lateral (
    select
      count(*) as fares,
      count(distinct (e.created_at at time zone 'Africa/Harare')::date) as days,
      max(e.created_at) as last_at
    from public.ticket_events e
    where e.vehicle_id = v.id
      and e.event_type = 'redeemed'
      and e.created_at >= now() - interval '30 days'
  ) agg on true
  left join lateral (
    select max(h.fares) as peak_hour
    from (
      select count(*) as fares
      from public.ticket_events e
      where e.vehicle_id = v.id
        and e.event_type = 'redeemed'
        and e.created_at >= now() - interval '30 days'
      group by date_trunc('hour', e.created_at)
    ) h
  ) peak on true
  left join lateral (
    -- days whose busiest hour cleared more fares than the declared seats:
    -- the declared-vs-proven contradiction, counted, never narrated at a
    -- person. A vehicle with no declared capacity cannot drift.
    select count(*) as days
    from (
      select hh.day
      from (
        select
          (e.created_at at time zone 'Africa/Harare')::date as day,
          date_trunc('hour', e.created_at) as hr,
          count(*) as fares
        from public.ticket_events e
        where e.vehicle_id = v.id
          and e.event_type = 'redeemed'
          and e.created_at >= now() - interval '30 days'
        group by 1, 2
      ) hh
      group by hh.day
      having max(hh.fares) > coalesce(v.capacity, 32767)
    ) dd
  ) drift on true
  left join lateral (
    -- the pulse: fares cleared on this vehicle inside the short window.
    -- A count of ledger rows, nothing derived, nothing predicted.
    select count(*) as fares
    from public.ticket_events e
    where e.vehicle_id = v.id
      and e.event_type = 'redeemed'
      and e.created_at >= now() - v_window
  ) pulse on true
  where v.active
  order by v.plate;
end;
$$;

revoke execute on function public.kombi_board() from public;
grant execute on function public.kombi_board() to anon, authenticated;
