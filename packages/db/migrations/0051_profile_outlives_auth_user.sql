-- 0051 delete my account removes the auth user (launch Step 2, Mhofu's
-- ruling of 13 Nov 2026: "hard delete, keep the anonymised profile").
--
-- Every account gets a wallet the moment it is created, and wallets,
-- tickets, journeys, transfers and gifts point at public.profiles with
-- ON DELETE RESTRICT, because money history is append only. The profile in
-- turn was deleted automatically with its auth user, so deleting an auth
-- user always failed. This removes only that link: the auth user (address,
-- password hash, identities, sessions) can now be deleted outright through
-- the admin API, and the profile, already emptied by anonymise_me, stays as
-- the anonymous anchor the ledger needs. No data is removed here, and new
-- profiles are still created from new auth users exactly as before.
--
-- The deliberate exception to the additive only rule for launch migrations,
-- recorded in docs/launch/STEP-2-REPORT.md.
alter table public.profiles drop constraint profiles_id_fkey;

comment on table public.profiles is
  'One row per account. Outlives its auth user after delete my account: by then anonymise_me has emptied it, and it stays only as the anchor for append only money and ticket history.';
