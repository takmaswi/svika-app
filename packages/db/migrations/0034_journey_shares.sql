-- 0034 journey shares (batch M2)
-- "Share a trip to a friend": a rider shares a SAVED journey as a guide
-- link. Same capability pattern as ride shares (0026): 128 bit hex token
-- minted server side, token scoped, expiring, revocable, viewable with no
-- account. The viewer's whole world is one RPC answering only for a live
-- token: the trip's name, mode, distance, and the trace itself as points
-- with RELATIVE time offsets from the trace start. Deliberately excluded:
-- who recorded it, the journey id, absolute timestamps (when a person
-- walks somewhere is theirs), and GPS accuracy values.
-- A guide link outlives a ride share on purpose: a friend visits on
-- Saturday, the link is sent on Wednesday. Seven days, then dead.
-- RLS is enabled on the table this migration creates, in this migration.

create table public.journey_shares (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.rider_journeys (id) on delete cascade,
  rider_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique check (char_length(token) = 32),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index journey_shares_journey_idx on public.journey_shares (journey_id);
create index journey_shares_rider_idx on public.journey_shares (rider_id, created_at desc);

alter table public.journey_shares enable row level security;

-- the owning rider sees their own shares (to show and revoke them);
-- no direct write policies or grants: the RPCs below are the only doors
create policy "journey shares select own"
  on public.journey_shares for select
  to authenticated
  using (rider_id = (select auth.uid()));

revoke insert, update, delete on table public.journey_shares from anon, authenticated;
revoke select on table public.journey_shares from anon;

-- Mints (or returns the existing live) guide link for the caller's own
-- SAVED journey. Idempotent per journey while the share lives.
create or replace function public.create_journey_share(p_journey uuid)
returns table (share_token text, share_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_owner uuid;
  v_status public.journey_status;
  v_token text;
  v_expires timestamptz;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  select rider_id, status into v_owner, v_status
    from public.rider_journeys where id = p_journey;
  if v_owner is null or v_owner <> v_uid then
    raise exception 'not your journey';
  end if;
  if v_status <> 'complete' then
    raise exception 'only saved journeys can be shared';
  end if;

  select js.token, js.expires_at into v_token, v_expires
    from public.journey_shares js
    where js.journey_id = p_journey
      and js.revoked_at is null
      and js.expires_at > now()
    order by js.created_at desc
    limit 1;
  if v_token is not null then
    return query select v_token, v_expires;
    return;
  end if;

  v_token := encode(extensions.gen_random_bytes(16), 'hex');
  v_expires := now() + interval '7 days';
  insert into public.journey_shares (journey_id, rider_id, token, expires_at)
    values (p_journey, v_uid, v_token, v_expires);

  return query select v_token, v_expires;
end;
$$;

revoke execute on function public.create_journey_share(uuid) from public, anon;
grant execute on function public.create_journey_share(uuid) to authenticated;

-- Kills a guide link immediately. Only the owning rider can.
create or replace function public.revoke_journey_share(p_share uuid)
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
  update public.journey_shares
    set revoked_at = now()
    where id = p_share and rider_id = v_uid and revoked_at is null;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'no live share to revoke';
  end if;
end;
$$;

revoke execute on function public.revoke_journey_share(uuid) from public, anon;
grant execute on function public.revoke_journey_share(uuid) to authenticated;

-- The viewer's whole world: one jsonb document for a live token, null
-- otherwise. Points carry seq, lng, lat and a millisecond offset from the
-- trace start (relative pacing for the derived steps, never wall clock).
create or replace function public.journey_share_view(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', j.name,
    'mode', j.mode,
    'distance_m', j.distance_m,
    'share_expires_at', js.expires_at,
    'points', coalesce(
      (
        select jsonb_agg(
          jsonb_build_array(
            p.lng,
            p.lat,
            (extract(epoch from (p.recorded_at - first.t0)) * 1000)::bigint
          )
          order by p.seq
        )
        from public.rider_journey_points p,
          (
            select min(recorded_at) as t0
            from public.rider_journey_points
            where journey_id = j.id
          ) as first
        where p.journey_id = j.id
      ),
      '[]'::jsonb
    )
  )
  from public.journey_shares js
  join public.rider_journeys j on j.id = js.journey_id
  where js.token = p_token
    and js.revoked_at is null
    and js.expires_at > now()
    and j.status = 'complete';
$$;

revoke execute on function public.journey_share_view(text) from public;
grant execute on function public.journey_share_view(text) to anon, authenticated;
