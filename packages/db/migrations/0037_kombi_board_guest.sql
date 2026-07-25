-- 0037 kombi board for guests
-- V2 ruling 5 (Mhofu, 2026-07-26): trust visibility is public value, so the
-- kombi board opens to the anon role. The board was built to serve only
-- vehicle registry facts and 30 day window aggregates (0032): no rider id,
-- conductor id, ticket id or event row ever leaves it, which is exactly why
-- it can face a guest. This is the ONE deliberate widening of the guest
-- surface; the GS suite pins it (anon reads the aggregates, the column set
-- is exactly the aggregate set, and the vehicles table itself stays closed
-- to riders and guests alike). Identity shaped cells (the rider's own stop
-- context) degrade in the app, not here.

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
begin
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

grant execute on function public.kombi_board() to anon;
