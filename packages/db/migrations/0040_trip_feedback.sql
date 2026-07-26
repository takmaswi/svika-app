-- 0040 trip feedback and plan versus trace mismatches (batch D2)
--
-- Did we get you there right? Two answer channels, both rider owned, both
-- append only in the 0031 walk tails posture (insert once through a narrow
-- policy, no update or delete for anyone but service maintenance):
--
--   * trip_feedback: the explicit three tap card after arrival. Right
--     kombi, right stop, walking bearable; each answer nullable because
--     the card is skippable and partial. One row per ticket, insertable
--     only by the rider who owns an ARRIVED ticket (the event stream is
--     the proof), so feedback cannot be minted for rides that never
--     landed.
--   * plan_trace_mismatches: the implicit channel. Where a rider recorded
--     their journey (M1) over a planned trip, the phone compares the
--     planned alight stop and walking tail against the trace using the
--     documented geometry rules in packages/shared/src/plan-trace-mismatch.ts
--     (named constants, no model, the honest seed for a future learned
--     ranker which would then need its baseline and metrics table first).
--     A detected mismatch lands here against the plan that produced it.
--
-- Neither table carries a conductor or vehicle column, deliberately: a
-- mismatch belongs to the plan, feedback belongs to the trip, and no
-- surfaced output ever singles out a person or a kombi (product law).
-- anonymise_me learns both tables: opinions and derived traces go with
-- the rider.

create table public.trip_feedback (
  ticket_id uuid primary key references public.tickets (id) on delete cascade,
  rider_id uuid not null references public.profiles (id) on delete cascade,
  right_kombi boolean,
  right_stop boolean,
  walk_ok boolean,
  created_at timestamptz not null default now(),
  -- a row with no answers is a skip, and a skip is simply no row
  constraint trip_feedback_says_something check (
    num_nonnulls(right_kombi, right_stop, walk_ok) >= 1
  )
);

create index trip_feedback_rider_idx
  on public.trip_feedback (rider_id, created_at desc);

create table public.plan_trace_mismatches (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  rider_id uuid not null references public.profiles (id) on delete cascade,
  -- the recording that produced the comparison; goes if the journey goes
  journey_id uuid references public.rider_journeys (id) on delete cascade,
  kind text not null check (kind in ('early_alight', 'late_alight', 'long_walk')),
  alight_offset_m integer check (alight_offset_m >= 0),
  planned_walk_m integer not null check (planned_walk_m >= 0),
  actual_walk_m integer check (actual_walk_m >= 0),
  created_at timestamptz not null default now(),
  -- one verdict of each kind per plan; a replayed comparison changes nothing
  unique (ticket_id, kind)
);

create index plan_trace_mismatches_rider_idx
  on public.plan_trace_mismatches (rider_id, created_at desc);
create index plan_trace_mismatches_ticket_idx
  on public.plan_trace_mismatches (ticket_id);

alter table public.trip_feedback enable row level security;
alter table public.plan_trace_mismatches enable row level security;

create policy "trip feedback select own"
  on public.trip_feedback for select
  to authenticated
  using (rider_id = (select auth.uid()));

-- insert only for the rider's own ARRIVED ticket: the event stream proves
-- the trip landed before an opinion about it exists
create policy "trip feedback insert own arrived"
  on public.trip_feedback for insert
  to authenticated
  with check (
    rider_id = (select auth.uid())
    and exists (
      select 1
      from public.tickets t
      where t.id = ticket_id
        and t.rider_id = (select auth.uid())
    )
    and exists (
      select 1
      from public.ticket_events e
      where e.ticket_id = trip_feedback.ticket_id
        and e.event_type = 'arrived'
    )
  );

create policy "plan trace mismatches select own"
  on public.plan_trace_mismatches for select
  to authenticated
  using (rider_id = (select auth.uid()));

create policy "plan trace mismatches insert own"
  on public.plan_trace_mismatches for insert
  to authenticated
  with check (
    rider_id = (select auth.uid())
    and exists (
      select 1
      from public.tickets t
      where t.id = ticket_id
        and t.rider_id = (select auth.uid())
    )
    and (
      journey_id is null
      or exists (
        select 1
        from public.rider_journeys j
        where j.id = journey_id
          and j.rider_id = (select auth.uid())
      )
    )
  );

-- append only in grants: no update or delete path for clients, ever
revoke update, delete on table public.trip_feedback from anon, authenticated;
revoke update, delete on table public.plan_trace_mismatches from anon, authenticated;
revoke all on table public.trip_feedback from anon;
revoke all on table public.plan_trace_mismatches from anon;
grant select, insert on table public.trip_feedback to authenticated;
grant select, insert on table public.plan_trace_mismatches to authenticated;

-- anonymise_me learns the feedback stream: opinions and derived
-- comparisons go with the rider (0038 version plus the two new deletes)
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
  -- feedback and mismatches go first (mismatches also cascade from
  -- journeys, this makes the intent explicit), then places, then journeys
  delete from public.trip_feedback where rider_id = v_uid;
  delete from public.plan_trace_mismatches where rider_id = v_uid;
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
