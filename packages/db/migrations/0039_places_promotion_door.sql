-- 0039 places promotion door (batch M3)
-- private.promote_places() runs under pg_cron, but PostgREST exposes only
-- the public schema, so the promotion and RLS test suites (service role,
-- house pattern of the ledger tests) and the e2e promotion trigger need a
-- public door. Service role only: clients never run the scheduler's pass,
-- they wait for it like everyone else.

create or replace function public.run_places_promotion()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.promote_places();
$$;

revoke execute on function public.run_places_promotion() from public, anon, authenticated;
grant execute on function public.run_places_promotion() to service_role;
