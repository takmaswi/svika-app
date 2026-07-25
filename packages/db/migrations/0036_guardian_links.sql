-- 0036 guardian links (batch V3, guardian mode)
-- Family accounts with mutual confirm and no silent tracking. A guardian
-- mints an invite code; the child, signed in, enters it; only then is the
-- link active (both sides acted). Either side revokes at any time. While a
-- link is active the child's app always shows the "guardian sees your
-- trips" chip (the dignity law lives in the UI; this schema makes the link
-- readable to both sides so the chip can never be silently suppressed).
--
-- The guardian's whole window into the child is ONE RPC returning recent
-- fare trips as route, endpoints, status and timing. Deliberately excluded:
-- board codes, fares paid, wallet anything, journeys, saved trips, live
-- coordinates. Clients have no write path into the table: the RPCs below
-- are the only doors, and invite redemption is rate limited with every
-- attempt logged (the board codes v2 law applied to family invites).
--
-- Safe arrival: the rider taps "I have arrived" and mark_ticket_arrived
-- appends the 0035 'arrived' event to the append only stream. The 0026
-- ride share view learns the arrived state so a shared link shows a safe
-- arrival instead of dying when the ride ends.
-- RLS is enabled on every table this migration creates, in this migration.

create type public.guardian_link_status as enum ('invited', 'active', 'revoked');

create table public.guardian_links (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.profiles (id) on delete cascade,
  child_id uuid references public.profiles (id) on delete cascade,
  invite_code text not null check (invite_code ~ '^[0-9a-f]{12}$'),
  status public.guardian_link_status not null default 'invited',
  created_at timestamptz not null default now(),
  invite_expires_at timestamptz not null default now() + interval '7 days',
  confirmed_at timestamptz,
  revoked_at timestamptz,
  constraint guardian_links_not_self check (guardian_id is distinct from child_id),
  constraint guardian_links_active_confirmed check (
    status <> 'active' or (child_id is not null and confirmed_at is not null)
  )
);

create index guardian_links_guardian_idx on public.guardian_links (guardian_id, created_at desc);
create index guardian_links_child_idx on public.guardian_links (child_id, created_at desc);
-- one live code per code string; one active link per pair
create unique index guardian_links_code_live_idx
  on public.guardian_links (invite_code) where status = 'invited';
create unique index guardian_links_pair_active_idx
  on public.guardian_links (guardian_id, child_id) where status = 'active';

alter table public.guardian_links enable row level security;

-- both ends of a link see it: the guardian to manage it, the child so the
-- chip and the "who sees my trips" list can never be hidden from them.
-- A pending invite is the guardian's alone (the code is a secret until told).
create policy "guardian links select own side"
  on public.guardian_links for select
  to authenticated
  using (
    guardian_id = (select auth.uid())
    or child_id = (select auth.uid())
  );

revoke insert, update, delete on table public.guardian_links from anon, authenticated;

-- every invite redemption attempt is logged, success or not; the rate
-- limiter reads this table. Riders see their own attempts, nothing else.
create table public.guardian_link_attempts (
  id bigint generated always as identity primary key,
  rider_id uuid not null references public.profiles (id) on delete cascade,
  code_entered text not null,
  outcome text not null check (
    outcome in ('success', 'invalid_code', 'rate_limited')
  ),
  attempted_at timestamptz not null default now()
);

create index guardian_link_attempts_rate_idx
  on public.guardian_link_attempts (rider_id, attempted_at desc);

alter table public.guardian_link_attempts enable row level security;

create policy "guardian link attempts select own"
  on public.guardian_link_attempts for select
  to authenticated
  using (rider_id = (select auth.uid()));

create trigger guardian_link_attempts_append_only
  before update or delete on public.guardian_link_attempts
  for each row execute function public.forbid_mutation();

revoke insert, update, delete on table public.guardian_link_attempts from anon, authenticated;

-- Mints (or returns the pending) invite code for the caller as guardian.
create or replace function public.create_guardian_invite()
returns table (invite_code text, invite_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_code text;
  v_expires timestamptz;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  -- a pending unexpired invite already exists: hand the same code back
  select gl.invite_code, gl.invite_expires_at into v_code, v_expires
    from public.guardian_links gl
    where gl.guardian_id = v_uid
      and gl.status = 'invited'
      and gl.invite_expires_at > now()
    order by gl.created_at desc
    limit 1;
  if v_code is not null then
    return query select v_code, v_expires;
    return;
  end if;

  v_code := encode(extensions.gen_random_bytes(6), 'hex');
  insert into public.guardian_links (guardian_id, invite_code)
    values (v_uid, v_code)
    returning guardian_links.invite_expires_at into v_expires;

  return query select v_code, v_expires;
end;
$$;

revoke execute on function public.create_guardian_invite() from public, anon;
grant execute on function public.create_guardian_invite() to authenticated;

-- The child confirms the link by entering the code. Mutual confirm: the
-- guardian minted, the child accepts, only then is anything visible.
-- Wrong, expired and revoked codes answer identically (no oracle), every
-- attempt is logged, and five misses in ten minutes rate limits the rider.
-- Failures RETURN outcome strings instead of raising (the 0004 redeem
-- lesson: an exception would roll the attempt log back with it).
create or replace function public.accept_guardian_invite(p_code text)
returns table (outcome text, link_id uuid, guardian_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_code text := lower(btrim(coalesce(p_code, '')));
  v_link public.guardian_links%rowtype;
  v_recent_misses integer;
  v_guardian_name text;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  select count(*) into v_recent_misses
    from public.guardian_link_attempts a
    where a.rider_id = v_uid
      and a.outcome <> 'success'
      and a.attempted_at > now() - interval '10 minutes';
  if v_recent_misses >= 5 then
    insert into public.guardian_link_attempts (rider_id, code_entered, outcome)
      values (v_uid, v_code, 'rate_limited');
    return query select 'rate_limited'::text, null::uuid, null::text;
    return;
  end if;

  select * into v_link
    from public.guardian_links gl
    where gl.invite_code = v_code
      and gl.status = 'invited'
      and gl.invite_expires_at > now();

  if v_link.id is null or v_link.guardian_id = v_uid then
    insert into public.guardian_link_attempts (rider_id, code_entered, outcome)
      values (v_uid, v_code, 'invalid_code');
    return query select 'invalid_code'::text, null::uuid, null::text;
    return;
  end if;

  -- an active link for this pair already exists: fold the invite into it
  if exists (
    select 1 from public.guardian_links gl
    where gl.guardian_id = v_link.guardian_id
      and gl.child_id = v_uid
      and gl.status = 'active'
  ) then
    update public.guardian_links
      set status = 'revoked', revoked_at = now()
      where id = v_link.id;
    select gl.id into v_link.id
      from public.guardian_links gl
      where gl.guardian_id = v_link.guardian_id
        and gl.child_id = v_uid and gl.status = 'active';
  else
    update public.guardian_links
      set child_id = v_uid, status = 'active', confirmed_at = now()
      where id = v_link.id;
  end if;

  insert into public.guardian_link_attempts (rider_id, code_entered, outcome)
    values (v_uid, v_code, 'success');

  select coalesce(nullif(btrim(p.full_name), ''), 'Guardian') into v_guardian_name
    from public.profiles p where p.id = v_link.guardian_id;

  return query select 'success'::text, v_link.id, v_guardian_name;
end;
$$;

revoke execute on function public.accept_guardian_invite(text) from public, anon;
grant execute on function public.accept_guardian_invite(text) to authenticated;

-- Either side ends the link (or a guardian cancels a pending invite).
-- Ending it is instant and needs no one's permission: the child's dignity
-- and the guardian's choice weigh the same here.
create or replace function public.revoke_guardian_link(p_link uuid)
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
  update public.guardian_links
    set status = 'revoked', revoked_at = now()
    where id = p_link
      and status <> 'revoked'
      and (guardian_id = v_uid or child_id = v_uid);
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'no live link to end';
  end if;
end;
$$;

revoke execute on function public.revoke_guardian_link(uuid) from public, anon;
grant execute on function public.revoke_guardian_link(uuid) to authenticated;

-- Both sides of the caller's family in one list: the links where they are
-- guardian and the links where they are child, with the other side's name.
-- The invite code rides along only for the guardian's own pending invites.
create or replace function public.my_family_links()
returns table (
  link_id uuid,
  role text,
  other_name text,
  status public.guardian_link_status,
  invite_code text,
  invite_expires_at timestamptz,
  confirmed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    gl.id,
    case when gl.guardian_id = (select auth.uid()) then 'guardian' else 'child' end,
    case
      when gl.guardian_id = (select auth.uid())
        then coalesce(nullif(btrim(cp.full_name), ''), '')
      else coalesce(nullif(btrim(gp.full_name), ''), '')
    end,
    gl.status,
    case
      when gl.guardian_id = (select auth.uid()) and gl.status = 'invited'
        then gl.invite_code
    end,
    gl.invite_expires_at,
    gl.confirmed_at
  from public.guardian_links gl
  left join public.profiles gp on gp.id = gl.guardian_id
  left join public.profiles cp on cp.id = gl.child_id
  where gl.status in ('invited', 'active')
    and (gl.guardian_id = (select auth.uid()) or gl.child_id = (select auth.uid()))
    and (gl.status = 'active' or gl.guardian_id = (select auth.uid()))
  order by gl.created_at desc;
$$;

revoke execute on function public.my_family_links() from public, anon;
grant execute on function public.my_family_links() to authenticated;

-- The guardian's window: recent fare trips of actively linked children.
-- Status and timing only; expected_minutes is the route's typical duration
-- so the client can say "taking longer than usual" about the SITUATION.
-- No board codes, no fares, no wallet, no journeys, no coordinates.
create or replace function public.guardian_child_trips()
returns table (
  link_id uuid,
  child_name text,
  route_name text,
  direction public.route_direction,
  from_stop_name text,
  to_stop_name text,
  trip_status text,
  status_at timestamptz,
  purchased_at timestamptz,
  expected_minutes integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    gl.id,
    coalesce(nullif(btrim(p.full_name), ''), ''),
    r.name,
    t.direction,
    fs.name,
    ts_.name,
    st.status::text,
    st.status_at,
    t.purchased_at,
    r.typical_duration_minutes
  from public.guardian_links gl
  join public.profiles p on p.id = gl.child_id
  join public.tickets t on t.rider_id = gl.child_id and t.kind = 'fare'
  join public.routes r on r.id = t.route_id
  left join public.stops fs on fs.id = t.from_stop_id
  left join public.stops ts_ on ts_.id = t.to_stop_id
  join public.ticket_status st on st.ticket_id = t.id
  where gl.guardian_id = (select auth.uid())
    and gl.status = 'active'
    and (
      st.status in ('issued', 'redeemed')
      or st.status_at > now() - interval '24 hours'
    )
  order by t.purchased_at desc;
$$;

revoke execute on function public.guardian_child_trips() from public, anon;
grant execute on function public.guardian_child_trips() to authenticated;

-- The rider's own safe arrival tap: appends the 0035 event to the append
-- only stream. Only the rider, only their own live fare, never twice.
create or replace function public.mark_ticket_arrived(p_ticket uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_rider uuid;
  v_kind text;
  v_status text;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  select t.rider_id, t.kind into v_rider, v_kind
    from public.tickets t where t.id = p_ticket;
  if v_rider is null or v_rider <> v_uid then
    raise exception 'not your ticket';
  end if;
  if v_kind <> 'fare' then
    raise exception 'only fares arrive';
  end if;

  select st.status into v_status
    from public.ticket_status st where st.ticket_id = p_ticket;
  if v_status not in ('issued', 'redeemed') then
    raise exception 'the trip is not live';
  end if;

  insert into public.ticket_events (ticket_id, event_type, actor_profile_id, detail)
    values (p_ticket, 'arrived', v_uid, '{"source":"rider_tap"}'::jsonb);
end;
$$;

revoke execute on function public.mark_ticket_arrived(uuid) from public, anon;
grant execute on function public.mark_ticket_arrived(uuid) to authenticated;

-- The 0026 share view learns safe arrival: a shared link now keeps
-- answering after the rider marks arrived (until the share expires), so
-- the guardian holding the link sees "arrived safely" instead of a dead
-- page. Same columns, same exclusions, one more live status.
create or replace function public.ride_share_view(p_token text)
returns table (
  route_code text,
  route_name text,
  direction public.route_direction,
  from_stop_id uuid,
  from_stop_name text,
  to_stop_id uuid,
  to_stop_name text,
  trip_status text,
  share_expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.code,
    r.name,
    t.direction,
    t.from_stop_id,
    fs.name,
    t.to_stop_id,
    ts_.name,
    st.status::text,
    rs.expires_at
  from public.ride_shares rs
  join public.tickets t on t.id = rs.ticket_id
  join public.routes r on r.id = t.route_id
  left join public.stops fs on fs.id = t.from_stop_id
  left join public.stops ts_ on ts_.id = t.to_stop_id
  join public.ticket_status st on st.ticket_id = t.id
  where rs.token = p_token
    and rs.revoked_at is null
    and rs.expires_at > now()
    and st.status in ('issued', 'redeemed', 'arrived');
$$;

-- create_ride_share must keep minting while the trip is live including the
-- arrived tail (a rider can tap arrived then share the proof); mirror the
-- same status widening there.
create or replace function public.create_ride_share(p_ticket uuid)
returns table (share_token text, share_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_rider uuid;
  v_kind text;
  v_route uuid;
  v_status text;
  v_valid_until timestamptz;
  v_typical integer;
  v_expires timestamptz;
  v_token text;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  select t.rider_id, t.kind, t.route_id into v_rider, v_kind, v_route
    from public.tickets t where t.id = p_ticket;
  if v_rider is null or v_rider <> v_uid then
    raise exception 'not your ticket';
  end if;
  if v_kind <> 'fare' then
    raise exception 'only fares can be shared';
  end if;

  select ts.status into v_status
    from public.ticket_status ts where ts.ticket_id = p_ticket;
  if v_status not in ('issued', 'redeemed', 'arrived') then
    raise exception 'the trip has ended';
  end if;

  -- a live share already exists: hand the same link back
  select rs.token, rs.expires_at into v_token, v_expires
    from public.ride_shares rs
    where rs.ticket_id = p_ticket
      and rs.revoked_at is null
      and rs.expires_at > now()
    order by rs.created_at desc
    limit 1;
  if v_token is not null then
    return query select v_token, v_expires;
    return;
  end if;

  -- the ride window: the code can be used until valid_until, and the ride
  -- itself takes at most the route's typical duration (fallback 60 min)
  select max(bc.valid_until) into v_valid_until
    from public.board_codes bc where bc.ticket_id = p_ticket;
  select r.typical_duration_minutes into v_typical
    from public.routes r where r.id = v_route;
  v_expires := coalesce(v_valid_until, now())
    + make_interval(mins => coalesce(v_typical, 60));

  v_token := encode(extensions.gen_random_bytes(16), 'hex');
  insert into public.ride_shares (ticket_id, rider_id, token, expires_at)
    values (p_ticket, v_uid, v_token, v_expires);

  return query select v_token, v_expires;
end;
$$;

-- anonymise_me learns guardian links: "delete everything about me" must
-- also stop anyone watching your trips (and stop you watching anyone).
-- Every live link touching the caller, either side, is revoked in the same
-- transaction. Same body as 0033 plus the one revocation statement.
-- demo_reset_mine is deliberately NOT touched (demo machinery frozen by
-- branch law); the demo pool gap is flagged in the V3 gate report.
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

  update public.guardian_links
    set status = 'revoked', revoked_at = now()
    where status <> 'revoked'
      and (guardian_id = v_uid or child_id = v_uid);

  insert into public.consent_records (user_id, action, version)
    values (v_uid, 'withdrawn', coalesce(v_version, 'v1'));
end;
$$;
