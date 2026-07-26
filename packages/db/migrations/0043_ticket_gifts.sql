-- 0043 send a ride, not money (batch V6)
--
-- Credit transfers (0011) hand over value that the receiver still has to
-- spend. A gifted ride hands over the ride itself: the sender pays from their
-- wallet, the recipient needs no account, no wallet and no app, only the four
-- digit board code, and the hwindi clears it exactly like any other code.
-- Nothing new happens at the kombi door, which is the point: board codes v2
-- scoping and rate limiting already cover it, and no code path in the
-- redemption RPCs changes here.
--
-- What is new is one row and one honest money question.
--
-- The row: ticket_gifts marks a ticket as bought for someone else. It exists
-- because the sender is the ticket's rider_id (they paid, and the ledger must
-- say who paid) while not being its rider in any real sense. Their home
-- screen must not offer to board it, and the commute pattern miner must not
-- learn a habit from a trip they never took.
--
-- The money question: a gift can be taken back. Until this migration nothing
-- in Svika ever refunded anything, and a refund is the one direction money
-- has never moved. revoke_gift is therefore written the same way redemption
-- is: one ticket lock shared with private.apply_redemption (same key), a
-- status check under that lock, an appended cancelled event, and a two sided
-- ledger transaction that returns exactly the fare from escrow to the wallet
-- it came from. Revoke twice and the second call finds a cancelled ticket and
-- refuses. Revoke a boarded ride and it refuses. The ledger invariant tests
-- carry the proof.
--
-- Cash gifts are deliberately impossible: an unpaid reservation is not a gift,
-- and there would be nothing to take back.

create table public.ticket_gifts (
  ticket_id uuid primary key references public.tickets (id) on delete restrict,
  sender_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index ticket_gifts_sender_idx on public.ticket_gifts (sender_id, created_at desc);

alter table public.ticket_gifts enable row level security;

-- the sender sees their own gifts; nobody else sees that a ticket was gifted,
-- and the recipient is never a row anywhere, because Svika does not know them
create policy "ticket_gifts select own"
  on public.ticket_gifts for select
  to authenticated
  using (sender_id = (select auth.uid()));

revoke insert, update, delete on table public.ticket_gifts from anon, authenticated;

create trigger ticket_gifts_append_only
  before update or delete on public.ticket_gifts
  for each row execute function public.forbid_mutation();

-- ---------------------------------------------------------------------------
-- gift_ticket: buy a ride for someone else.
--
-- Deliberately delegates to purchase_ticket rather than copying it: fare
-- lookup, stop validation, the plausible fare rail, the balance check, the
-- board code allocation and the issued event are all one implementation, and
-- a gift can never drift away from a normal purchase.
-- ---------------------------------------------------------------------------
create or replace function public.gift_ticket(
  p_route uuid,
  p_direction public.route_direction,
  p_from_stop uuid default null,
  p_to_stop uuid default null,
  p_valid_minutes integer default 240
)
returns table (ticket_id uuid, board_code text, fare_cents integer, valid_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sender uuid := (select auth.uid());
  v_bought record;
begin
  if v_sender is null then
    raise exception 'not authenticated';
  end if;

  select * into v_bought
  from public.purchase_ticket(
    p_route, p_direction, p_valid_minutes, p_from_stop, p_to_stop, 'wallet'
  );

  insert into public.ticket_gifts (ticket_id, sender_id)
  values (v_bought.ticket_id, v_sender);

  return query select
    v_bought.ticket_id, v_bought.board_code, v_bought.fare_cents, v_bought.valid_until;
end;
$$;

revoke execute on function public.gift_ticket(uuid, public.route_direction, uuid, uuid, integer)
  from public, anon;
grant execute on function public.gift_ticket(uuid, public.route_direction, uuid, uuid, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- revoke_gift: take back a ride nobody boarded.
--
-- Outcomes instead of exceptions for the expected refusals, so the sender's
-- screen can say what happened and the caller's transaction survives.
-- ---------------------------------------------------------------------------
create or replace function public.revoke_gift(p_ticket uuid)
returns table (outcome text, refunded_cents integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sender uuid := (select auth.uid());
  v_gift public.ticket_gifts%rowtype;
  v_ticket public.tickets%rowtype;
  v_status public.ticket_event_type;
  v_wallet uuid;
  v_escrow uuid;
  v_txn uuid;
begin
  if v_sender is null then
    raise exception 'not authenticated';
  end if;

  select * into v_gift
  from public.ticket_gifts g
  where g.ticket_id = p_ticket and g.sender_id = v_sender;
  if not found then
    -- a ticket that is not the caller's gift and a ticket that does not exist
    -- answer identically: no oracle for other people's tickets
    return query select 'not_your_gift'::text, null::integer;
    return;
  end if;

  -- the same lock private.apply_redemption takes, so a revoke racing a
  -- conductor's clear resolves one way or the other, never both
  perform pg_advisory_xact_lock(hashtextextended(p_ticket::text, 7));

  select * into v_ticket from public.tickets t where t.id = p_ticket;

  select e.event_type into v_status
  from public.ticket_events e
  where e.ticket_id = p_ticket
  order by e.created_at desc, e.id desc
  limit 1;

  if v_status is distinct from 'issued' then
    return query select
      (case when v_status = 'cancelled' then 'already_revoked' else 'already_boarded' end)::text,
      null::integer;
    return;
  end if;

  insert into public.ticket_events (ticket_id, event_type, actor_profile_id, detail)
  values (p_ticket, 'cancelled', v_sender, jsonb_build_object('reason', 'gift_revoked'));

  -- gifts are always wallet paid (gift_ticket allows nothing else), so the
  -- fare is sitting in escrow waiting for a redemption that will not come
  select id into v_wallet
  from public.ledger_accounts
  where profile_id = v_sender and kind = 'rider_wallet';
  select id into v_escrow
  from public.ledger_accounts
  where kind = 'platform_escrow' and profile_id is null;

  insert into public.ledger_transactions (kind, ticket_id, memo, created_by)
  values ('refund', p_ticket, 'gifted ride taken back before boarding', v_sender)
  returning id into v_txn;

  insert into public.ledger_postings (transaction_id, account_id, amount_cents)
  values
    (v_txn, v_escrow, -v_ticket.fare_cents),
    (v_txn, v_wallet, v_ticket.fare_cents);

  return query select 'revoked'::text, v_ticket.fare_cents;
end;
$$;

revoke execute on function public.revoke_gift(uuid) from public, anon;
grant execute on function public.revoke_gift(uuid) to authenticated;
