-- 0044 demand beacon (batch V8): a signal, never a dispatch
--
-- A waiting rider taps "I am here, heading to town" and conductors working
-- that route see how many people are waiting at each stop ahead. That is the
-- whole feature.
--
-- THE HARD BOUNDARY, ruled by Mhofu on the cut list and enforced here in
-- schema rather than in copy:
--   - beacon_counts returns a stop, its position on the route and an integer.
--     There is no rider id, no name, no phone, no timestamp, no destination
--     and no beacon id in its result type. A conductor cannot learn who is
--     waiting, when they arrived or where they are going, because none of it
--     leaves the function.
--   - nothing writes back. There is no accept, no claim, no assign, no
--     acknowledge and no "on my way": a conductor cannot act on a beacon
--     inside Svika, only decide for themselves where to point their kombi.
--     No table in this migration can record a conductor's response, which is
--     the structural reason this cannot quietly become dispatch.
--   - counts expire fast (20 minutes). A rider who has already boarded, gone
--     home or given up stops being counted on their own, so a stale beacon
--     can never send a kombi to an empty stop.
--   - a rider holds at most one live beacon: they are in one place.
--
-- If a future change wants a conductor to respond to a beacon, that is a
-- different product and needs Mhofu's ruling first. Flag it, do not build it.
--
-- Beacons are ephemeral operational state, not history: like the generated
-- service days in 0042 they carry no append only trigger, because withdrawing
-- one has to be able to end it. Nothing here touches money or tickets.

create table public.demand_beacons (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.profiles (id) on delete cascade,
  route_id uuid not null references public.routes (id) on delete cascade,
  direction public.route_direction not null,
  stop_id uuid not null references public.stops (id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > created_at)
);

create index demand_beacons_live_idx
  on public.demand_beacons (route_id, direction, expires_at desc);
create index demand_beacons_rider_idx
  on public.demand_beacons (rider_id, expires_at desc);

alter table public.demand_beacons enable row level security;

-- the rider sees their own beacon and nobody else's. Conductors are NOT
-- granted a select policy on this table at all: their only door is the
-- counts RPC, which cannot return a person.
create policy "demand_beacons select own"
  on public.demand_beacons for select
  to authenticated
  using (rider_id = (select auth.uid()));

revoke insert, update, delete on table public.demand_beacons from anon, authenticated;

-- ---------------------------------------------------------------------------
-- raise_beacon: "I am here, heading that way."
-- ---------------------------------------------------------------------------
create or replace function public.raise_beacon(
  p_route uuid,
  p_direction public.route_direction,
  p_stop uuid
)
returns table (outcome text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- long enough to be useful at a rank, short enough that nobody is counted
  -- after they have gone
  c_life constant interval := interval '20 minutes';
  -- a tapping contest cannot inflate a stop: raises per rider per hour
  c_max_per_hour constant integer := 12;
  v_rider uuid := (select auth.uid());
  v_recent integer;
  v_expires timestamptz;
begin
  if v_rider is null then
    raise exception 'not authenticated';
  end if;

  perform 1 from public.route_stops rs
  where rs.route_id = p_route and rs.stop_id = p_stop and rs.direction = p_direction;
  if not found then
    raise exception 'that stop is not on this route direction';
  end if;

  select count(*) into v_recent
  from public.demand_beacons b
  where b.rider_id = v_rider
    and b.created_at > now() - interval '1 hour';
  if v_recent >= c_max_per_hour then
    return query select 'rate_limited'::text, null::timestamptz;
    return;
  end if;

  -- one rider, one place: an older beacon ends the moment a new one starts.
  -- The table is aliased because this function's own OUT column is also
  -- called expires_at, and an unqualified reference is ambiguous.
  update public.demand_beacons b
  set expires_at = now()
  where b.rider_id = v_rider and b.expires_at > now();

  v_expires := now() + c_life;
  insert into public.demand_beacons (rider_id, route_id, direction, stop_id, expires_at)
  values (v_rider, p_route, p_direction, p_stop, v_expires);

  return query select 'raised'::text, v_expires;
end;
$$;

revoke execute on function public.raise_beacon(uuid, public.route_direction, uuid)
  from public, anon;
grant execute on function public.raise_beacon(uuid, public.route_direction, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- my_beacon: is the caller currently counted, and for how much longer?
--
-- The rider's own row is readable under RLS, but "is it still live" must be
-- answered by the database's clock, not by whichever machine renders the
-- screen. A web server a few seconds behind Supabase would otherwise keep
-- showing a withdrawn beacon as live, which is a small lie about something a
-- rider explicitly asked to stop.
-- ---------------------------------------------------------------------------
create or replace function public.my_beacon()
returns table (stop_id uuid, expires_at timestamptz, minutes_left integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rider uuid := (select auth.uid());
begin
  if v_rider is null then
    raise exception 'not authenticated';
  end if;
  return query
  select b.stop_id, b.expires_at,
         ceil(extract(epoch from (b.expires_at - now())) / 60)::integer
  from public.demand_beacons b
  where b.rider_id = v_rider
    and b.expires_at > now()
  order by b.expires_at desc
  limit 1;
end;
$$;

revoke execute on function public.my_beacon() from public, anon;
grant execute on function public.my_beacon() to authenticated;

-- ---------------------------------------------------------------------------
-- withdraw_beacon: "I have gone." A rider can always stop being counted.
-- ---------------------------------------------------------------------------
create or replace function public.withdraw_beacon()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rider uuid := (select auth.uid());
  v_count integer;
begin
  if v_rider is null then
    raise exception 'not authenticated';
  end if;
  update public.demand_beacons
  set expires_at = now()
  where rider_id = v_rider and expires_at > now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.withdraw_beacon() from public, anon;
grant execute on function public.withdraw_beacon() to authenticated;

-- ---------------------------------------------------------------------------
-- beacon_counts: the conductor's whole window. A stop, where it sits on the
-- route, and a number. Assignment gated exactly like the code cache (0018):
-- a conductor sees demand only for a route they are cleared to work.
-- ---------------------------------------------------------------------------
create or replace function public.beacon_counts(
  p_route uuid,
  p_direction public.route_direction
)
returns table (stop_id uuid, stop_name text, seq integer, waiting integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_conductor public.conductors%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_conductor
  from public.conductors c
  where c.profile_id = v_uid and c.active;
  if not found then
    raise exception 'not an active conductor';
  end if;

  if not private.route_assigned(v_conductor.id, p_route) then
    raise exception 'not your route';
  end if;

  return query
  select
    rs.stop_id,
    s.name,
    rs.seq,
    count(b.id)::integer as waiting
  from public.route_stops rs
  join public.stops s on s.id = rs.stop_id
  left join public.demand_beacons b
    on b.stop_id = rs.stop_id
   and b.route_id = rs.route_id
   and b.direction = rs.direction
   and b.expires_at > now()
  where rs.route_id = p_route
    and rs.direction = p_direction
  group by rs.stop_id, s.name, rs.seq
  order by rs.seq;
end;
$$;

revoke execute on function public.beacon_counts(uuid, public.route_direction)
  from public, anon;
grant execute on function public.beacon_counts(uuid, public.route_direction)
  to authenticated;
