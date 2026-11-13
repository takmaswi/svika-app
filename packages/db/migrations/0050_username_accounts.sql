-- 0050 username and password accounts (launch Step 2, ruling 4)
--
-- No phone, no email, no name. Supabase Auth needs an email or a phone, so
-- each username account carries a SYNTHETIC address on the reserved
-- `.invalid` top level domain (RFC 2606): it is never shown, never sent to,
-- and can never be delivered or bought by anyone, so a password reset by
-- email can never be used to take an account over. Accounts are created by
-- the `svika-accounts` Edge Function with the platform's own service role
-- (email_confirm true, so no confirmation mail is ever attempted); the web
-- app and this repo never hold that key.
--
-- Recovery is username plus a one time recovery code, shown once at sign
-- up, stored only as a salted SHA-256 hash here, single use, and reissued
-- after every reset.
--
-- Every sign up, sign in, recovery attempt and username lookup is logged by
-- the function (never by a client), the function refuses when a username or
-- an address has too many recent attempts, and it deletes rows older than
-- 30 days. A client cannot forge or read any of it: RLS on,
-- no client policy on the attempt log or the codes.

create table public.account_usernames (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- lower case, 3 to 20 of a-z 0-9 _ . (checked again in the function)
  username text not null unique check (username ~ '^[a-z0-9_.]{3,20}$'),
  created_at timestamptz not null default now()
);
alter table public.account_usernames enable row level security;
create policy account_usernames_own on public.account_usernames
  for select to authenticated using (user_id = (select auth.uid()));
grant select on public.account_usernames to authenticated;

create table public.account_recovery_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code_salt text not null,
  code_hash text not null,
  issued_at timestamptz not null default now()
);
alter table public.account_recovery_codes enable row level security;
-- no policies: only the service role (the Edge Function) touches codes
revoke all on public.account_recovery_codes from anon, authenticated;

create table public.auth_attempts (
  id bigint generated always as identity primary key,
  username text not null,
  kind text not null check (kind in ('sign_up', 'sign_in', 'recover', 'check')),
  ok boolean not null,
  -- a salted hash of the caller's network address, for spotting a burst;
  -- never the address itself
  origin_hash text,
  at timestamptz not null default now()
);
create index auth_attempts_username_at on public.auth_attempts (username, at desc);
create index auth_attempts_origin_at on public.auth_attempts (origin_hash, at desc);
alter table public.auth_attempts enable row level security;
revoke all on public.auth_attempts from anon, authenticated;

-- The rider's own username, for the greeting and the profile.
create or replace function public.my_username()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select username from public.account_usernames where user_id = (select auth.uid());
$$;
revoke execute on function public.my_username() from public, anon;
grant execute on function public.my_username() to authenticated;

-- The function screens usernames with the same wordlist places use. The
-- private schema is not exposed over the API, so a service role only door.
create or replace function public.username_is_clean(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.place_name_is_clean(p_username);
$$;
revoke execute on function public.username_is_clean(text) from public, anon, authenticated;
grant execute on function public.username_is_clean(text) to service_role;

-- Delete my account: anonymise_me already wipes the personal rows; a
-- username account additionally loses its username and recovery code so
-- the name is free again and nothing can sign back in by recovery.
create or replace function public.forget_my_username()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  delete from public.account_recovery_codes where user_id = v_uid;
  delete from public.account_usernames where user_id = v_uid;
end;
$$;
revoke execute on function public.forget_my_username() from public, anon;
grant execute on function public.forget_my_username() to authenticated;
