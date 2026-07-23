-- 0031 trip walk tails (D1, destination first planning)
-- A rider who plans to a place rather than a stop gets a walking tail from
-- the alight stop to the destination point. The tail is plain rider-owned
-- data: no money, no history rewrite. It powers the in ride walk cue and
-- the honest "then N m walk" line, and later D2 compares the planned tail
-- against the recorded trace. One row per ticket, written at booking,
-- never updated. RLS is enabled in this migration, on the table it creates.

create table public.trip_walk_tails (
  ticket_id uuid primary key references public.tickets (id) on delete cascade,
  rider_id uuid not null references public.profiles (id) on delete cascade,
  dest_name text not null check (char_length(btrim(dest_name)) between 1 and 120),
  dest_lng double precision not null check (dest_lng between -180 and 180),
  dest_lat double precision not null check (dest_lat between -90 and 90),
  walk_meters integer not null check (walk_meters between 0 and 100000),
  created_at timestamptz not null default now()
);

create index trip_walk_tails_rider_idx on public.trip_walk_tails (rider_id, created_at desc);

alter table public.trip_walk_tails enable row level security;

create policy "trip walk tails select own"
  on public.trip_walk_tails for select
  to authenticated
  using (rider_id = (select auth.uid()));

-- insert only for the rider's own ticket; no update or delete policy, the
-- row is a fact about the booking
create policy "trip walk tails insert own"
  on public.trip_walk_tails for insert
  to authenticated
  with check (
    rider_id = (select auth.uid())
    and exists (
      select 1
      from public.tickets t
      where t.id = ticket_id
        and t.rider_id = (select auth.uid())
    )
  );

revoke all on table public.trip_walk_tails from anon;
grant select, insert on table public.trip_walk_tails to authenticated;
