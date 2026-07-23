-- 0032 kombi board
-- The rider-facing kombi board (batch K1): aggregate fare counts per vehicle
-- so the trust surface can derive its states by rules in the app
-- (apps/web/src/lib/kombi/trust.ts). Riders cannot read the vehicles table
-- (owner scoped since 0001), and must never read ticket_events rows that are
-- not theirs; this function returns only vehicle registry facts and window
-- aggregates. No rider id, conductor id, ticket id or event row ever leaves
-- it: counts describe a vehicle's ledger pattern, never a person.
--
-- Vehicles carry no route linkage today; the board serves the whole (small)
-- registry. Route scoping arrives when conductor shifts start stamping
-- vehicle ids on redemptions (N1 substrate, out of scope here).

create or replace function public.kombi_board()
returns table (
  plate text,
  capacity smallint,
  verified_fares_30d bigint,
  fare_days_30d bigint,
  peak_hour_load_30d bigint,
  drift_days_30d bigint,
  last_verified_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  return query
  select
    v.plate,
    v.capacity,
    coalesce(agg.fares, 0)::bigint as verified_fares_30d,
    coalesce(agg.days, 0)::bigint as fare_days_30d,
    peak.peak_hour::bigint as peak_hour_load_30d,
    coalesce(drift.days, 0)::bigint as drift_days_30d,
    agg.last_at as last_verified_at
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
  where v.active
  order by v.plate;
end;
$$;

revoke execute on function public.kombi_board() from public, anon;
grant execute on function public.kombi_board() to authenticated;
