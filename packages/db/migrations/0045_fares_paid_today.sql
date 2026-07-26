-- 0045 live fare board (batch V4, last by ruling)
--
-- Every digital ticket is a verified fare observation: somebody actually paid
-- that, and the ledger says so. This function is the whole database side of
-- the fare board, and it is deliberately the dumbest possible thing: a group
-- by. It returns, for one route and direction today, how many tickets were
-- bought at each fare in each local hour.
--
-- Everything that decides anything (what is typical, what the range is, which
-- hour was busiest) lives in packages/shared/src/fare-board.ts where it is
-- unit tested. History, not editorial: the board shows what was paid and never
-- says whether that was fair, or predicts what the next hour will cost.
--
-- Not AI, and AI-USAGE-MAP.md says so.
--
-- Privacy: a fare is a price, not a person. The rows carry no rider, no
-- ticket, no conductor and no vehicle, and the hour bucket is as fine as time
-- ever gets. Cash reservations are counted alongside wallet payments because
-- both are fares a rider committed to at a stated price.

-- M4 slice: the board scans today's tickets for one route and direction. The
-- only index on tickets is (route_id) from 0004.
create index if not exists tickets_route_day_idx
  on public.tickets (route_id, direction, purchased_at desc);

create or replace function public.fares_paid_today(
  p_route uuid,
  p_direction public.route_direction
)
returns table (hour integer, fare_cents integer, tickets integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select
    extract(hour from (t.purchased_at at time zone 'Africa/Harare'))::integer,
    t.fare_cents,
    count(*)::integer
  from public.tickets t
  where t.route_id = p_route
    and t.direction = p_direction
    and t.kind = 'fare'
    and (t.purchased_at at time zone 'Africa/Harare')::date
        = (now() at time zone 'Africa/Harare')::date
  group by 1, 2
  order by 1, 2;
end;
$$;

-- guest readable like the rest of the board surfaces: what riders paid on a
-- public route is public value, and nothing personal leaves here
revoke execute on function public.fares_paid_today(uuid, public.route_direction)
  from public;
grant execute on function public.fares_paid_today(uuid, public.route_direction)
  to anon, authenticated;
