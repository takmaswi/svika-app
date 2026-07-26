-- 0048 two holes in 0047, found by attacking it rather than by a failing test
--
-- 1. Discarding a recording did not take its legs and marks.
--
--    0033 is explicit about what a discard means: "an unsaved trace is not
--    history to keep, it is data the rider chose not to hand over", and it
--    deletes the trace points to say so. Legs, marked stops and fare notes
--    are exactly the same kind of data and 0047 left them standing, so a
--    rider who tagged a trip and then discarded it still had the shape of
--    that trip, its route, its fare and the places they marked sitting on
--    the server. The journey row stays as the discarded fact; everything
--    the rider recorded onto it goes.
--
-- 2. A mark kept a name the wordlist had already refused.
--
--    add_rider_journey_mark offers a name to public.submit_place_name, which
--    screens it against the bilingual wordlist (0038). When that screen said
--    blocked_word the place row was correctly refused, and then the mark
--    stored the same string anyway. Nobody but its author could read it, and
--    anonymise_me would remove it, but a word the house has already refused
--    has no business being kept at all. The mark still lands: the geometry
--    is a fact the rider recorded, and only the name was ever a proposal.

create or replace function public.discard_rider_journey(p_journey uuid)
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

  update public.rider_journeys
    set status = 'discarded', ended_at = coalesce(ended_at, now())
    where id = p_journey and rider_id = v_uid and status = 'recording';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'no recording journey to discard';
  end if;

  delete from public.rider_journey_points where journey_id = p_journey;
  delete from public.rider_journey_marks where journey_id = p_journey;
  delete from public.rider_journey_legs where journey_id = p_journey;
end;
$$;

create or replace function public.add_rider_journey_mark(
  p_journey uuid,
  p_mark_seq integer,
  p_leg_index integer,
  p_kind public.journey_mark_kind,
  p_name text,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m real,
  p_recorded_at timestamptz,
  p_marked_at timestamptz
)
returns table (mark_id uuid, name_outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_owner uuid;
  v_partner text;
  v_existing uuid;
  v_marks integer;
  v_name text;
  v_kind public.place_kind;
  v_outcome text := 'none';
  v_place uuid;
  v_new uuid;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  v_partner := private.partner_consent_version(v_uid);
  if v_partner is null then
    raise exception 'partner consent missing';
  end if;
  if p_lat is null or p_lng is null
     or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'mark needs a position';
  end if;

  select rider_id into v_owner
    from public.rider_journeys where id = p_journey;
  if v_owner is null or v_owner <> v_uid then
    raise exception 'not your journey';
  end if;

  select id into v_existing
    from public.rider_journey_marks
    where journey_id = p_journey and mark_seq = p_mark_seq;
  if v_existing is not null then
    return query select v_existing, 'existing'::text;
    return;
  end if;

  select count(*) into v_marks
    from public.rider_journey_marks where journey_id = p_journey;
  if v_marks >= private.journey_mark_cap() then
    raise exception 'journey mark cap reached';
  end if;

  update public.rider_journeys
    set partner_consent_version = coalesce(partner_consent_version, v_partner)
    where id = p_journey;

  v_name := nullif(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), '');
  if v_name is not null and char_length(v_name) between 2 and 60 then
    v_kind := case when p_kind = 'landmark' then 'landmark' else 'stop' end;
    select outcome, place_id into v_outcome, v_place
      from public.submit_place_name(v_name, v_kind, p_lat, p_lng, null);
    -- a name the wordlist refused is not kept anywhere, including here
    if v_outcome = 'blocked_word' then
      v_name := null;
    end if;
  elsif v_name is not null then
    -- too short or too long to be a name; the mark keeps its geometry only
    v_name := null;
    v_outcome := 'invalid';
  end if;

  insert into public.rider_journey_marks
      (journey_id, mark_seq, leg_index, kind, name, lat, lng, accuracy_m,
       recorded_at, marked_at, place_name_id)
    values (
      p_journey,
      greatest(p_mark_seq, 0),
      greatest(coalesce(p_leg_index, 0), 0),
      p_kind,
      v_name,
      p_lat,
      p_lng,
      p_accuracy_m,
      p_recorded_at,
      p_marked_at,
      v_place
    )
    returning id into v_new;

  return query select v_new, v_outcome;
end;
$$;
